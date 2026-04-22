// lib/hubspot/parser.ts
// Parses a raw HubSpot workflow API response into the neutral IntermediateWorkflow format.

import {
    HubSpotWorkflow,
    HubSpotCriteriaGroup,
    HubSpotAction,
    HubSpotOperator,
  } from './types';
  
  import {
    IntermediateWorkflow,
    TriggerGroup,
    TriggerCondition,
    IntermediateAction,
    IntermediateOperator,
  } from '../intermediate/types';
  
  import { lookupExtensionAction } from './extensions';
  
  /**
   * Main entry point — converts a raw HubSpot workflow object
   * into the CRM-agnostic IntermediateWorkflow format.
   */
  export function parseHubSpotWorkflow(raw: HubSpotWorkflow): IntermediateWorkflow {
    return {
      sourceId: String(raw.id),
      sourceCRM: 'hubspot',
      name: raw.name,
      description: raw.description,
      enabled: raw.enabled,
      createdAt: raw.insertedAt,
      updatedAt: raw.updatedAt,
      triggerGroups: parseSegmentCriteria(raw.segmentCriteria),
      actions: raw.actions.map(parseAction),
    };
  }
  
  /**
   * Converts HubSpot segmentCriteria into TriggerGroups.
   *
   * HubSpot structure:
   *   outer array = OR  (enroll if ANY group matches)
   *   inner array = AND (all conditions in a group must match)
   */
  function parseSegmentCriteria(
    criteriaGroups: HubSpotCriteriaGroup[]
  ): TriggerGroup[] {
    return criteriaGroups.map((group) => ({
      conditions: group.map((criterion): TriggerCondition => ({
        property: criterion.property,
        operator: mapOperator(criterion.operator),
        value: criterion.value !== undefined ? String(criterion.value) : undefined,
        label: `${criterion.property} ${criterion.operator}${
          criterion.value !== undefined ? ` ${criterion.value}` : ''
        }`,
      })),
    }));
  }
  
  /**
   * Maps a HubSpot operator string to our normalized IntermediateOperator.
   */
  function mapOperator(op: HubSpotOperator): IntermediateOperator {
    const map: Record<HubSpotOperator, IntermediateOperator> = {
      EQ:           'EQUALS',
      NEQ:          'NOT_EQUALS',
      IS_EMPTY:     'IS_EMPTY',
      IS_NOT_EMPTY: 'IS_NOT_EMPTY',
      CONTAINS:     'CONTAINS',
      NOT_CONTAINS: 'NOT_CONTAINS',
      GT:           'GREATER_THAN',
      GTE:          'GREATER_THAN', // no GTE in intermediate yet — close enough for now
      LT:           'LESS_THAN',
      LTE:          'LESS_THAN',    // same
      BETWEEN:      'GREATER_THAN', // fallback — flag for manual review
    };
    return map[op] ?? 'EQUALS';
  }
  
  /**
   * Converts a single HubSpot action into an IntermediateAction.
   * EXTENSION type actions are looked up via the extensions map.
   * Unknown actions are flagged for manual migration.
   */
  function parseAction(action: HubSpotAction): IntermediateAction {
    if (action.type === 'EXTENSION' && action.extensionDefinitionId !== undefined) {
      const knownType = lookupExtensionAction(action.extensionDefinitionId);
  
      if (knownType) {
        return {
          actionType: knownType,
          sourceActionType: action.type,
          parameters: action.metadata ?? {},
          requiresManualMigration: false,
        };
      }
  
      // Extension ID exists but isn't mapped yet
      return {
        actionType: 'UNKNOWN_ACTION',
        sourceActionType: action.type,
        parameters: {
          extensionDefinitionId: action.extensionDefinitionId,
          ...action.metadata,
        },
        requiresManualMigration: true,
        manualMigrationNote: `Unmapped HubSpot extension ID: ${action.extensionDefinitionId}. Add it to lib/hubspot/extensions.ts once identified.`,
      };
    }
  
    // Non-EXTENSION action types (DELAY, SET_CONTACT_PROPERTY, BRANCH, etc.)
    // Add explicit handling here as you encounter them
    return {
      actionType: 'UNKNOWN_ACTION',
      sourceActionType: action.type,
      parameters: action.metadata ?? {},
      requiresManualMigration: true,
      manualMigrationNote: `Action type "${action.type}" is not yet supported. Manual migration required.`,
    };
  }