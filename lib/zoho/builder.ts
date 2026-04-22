// lib/zoho/builder.ts
// Takes an IntermediateWorkflow and produces two things:
// 1. A Zoho API payload (for what CAN be auto-migrated)
// 2. A list of manual migration steps (for what CANNOT be auto-migrated)

import {
    IntermediateWorkflow,
    TriggerGroup,
    TriggerCondition,
    IntermediateAction,
    IntermediateOperator,
  } from '../intermediate/types';
  
  // --------------------------------------------------------------------------
  // Output types
  // --------------------------------------------------------------------------
  
  export interface ZohoBuildResult {
    // The payload to POST to Zoho's workflow API (null if nothing can be auto-migrated)
    zohoPayload: ZohoWorkflowPayload | null;
  
    // Steps the user needs to complete manually in Zoho
    manualSteps: ManualStep[];
  
    // Summary of what was and wasn't auto-migrated
    summary: MigrationSummary;
  }
  
  export interface ManualStep {
    title: string;
    description: string;
    zohoPath: string; // Where in Zoho UI to do this
  }
  
  export interface MigrationSummary {
    autoMigrated: string[];
    manualRequired: string[];
  }
  
  export interface ZohoWorkflowPayload {
    workflow_rules: ZohoWorkflowRule[];
  }
  
  export interface ZohoWorkflowRule {
    name: string;
    description: string;
    module: { api_name: string };
    status: { active: boolean };
    execute_when: {
      type: string;
      details: Record<string, unknown>;
    };
    conditions: ZohoCondition[];
  }
  
  export interface ZohoCondition {
    sequence_number: number;
    criteria_details: {
      criteria: ZohoCriteria;
    };
    instant_actions: {
      actions: ZohoAction[];
    };
  }
  
  export interface ZohoCriteria {
    group_operator: 'AND' | 'OR';
    group: ZohoCriterion[];
  }
  
  export interface ZohoCriterion {
    comparator: string;
    field: { api_name: string };
    type: 'value';
    value: unknown;
  }
  
  export interface ZohoAction {
    type: string;
    field_to_update?: { api_name: string };
    value?: unknown;
  }
  
  // --------------------------------------------------------------------------
  // Operator mapping
  // --------------------------------------------------------------------------
  
  function mapOperatorToZoho(op: IntermediateOperator): string {
    const map: Record<IntermediateOperator, string> = {
      EQUALS:       'equal',
      NOT_EQUALS:   'not_equal',
      IS_EMPTY:     'is_empty',
      IS_NOT_EMPTY: 'is_not_empty',
      CONTAINS:     'contains',
      NOT_CONTAINS: 'not_contains',
      GREATER_THAN: 'greater_than',
      LESS_THAN:    'less_than',
    };
    return map[op] ?? 'equal';
  }
  
  // --------------------------------------------------------------------------
  // Field mapping: HubSpot property name → Zoho field api_name
  // Add more mappings here as you support more workflows
  // --------------------------------------------------------------------------
  
  const FIELD_MAP: Record<string, string | null> = {
    hs_email_optout:                  'Email_Opt_Out',  // direct match ✅
    hs_email_hard_bounce_reason_enum: null,             // no Zoho equivalent ❌
  };
  
  // --------------------------------------------------------------------------
  // Action mapping
  // --------------------------------------------------------------------------
  
  function buildZohoAction(action: IntermediateAction): ZohoAction | null {
    switch (action.actionType) {
      case 'SET_MARKETING_STATUS':
        // In Zoho, the closest equivalent is setting Email_Opt_Out = true
        return {
          type: 'field_update',
          field_to_update: { api_name: 'Email_Opt_Out' },
          value: true,
        };
      default:
        return null;
    }
  }
  
  // --------------------------------------------------------------------------
  // Main builder function
  // --------------------------------------------------------------------------
  
  export function buildZohoWorkflow(workflow: IntermediateWorkflow): ZohoBuildResult {
    const autoMigrated: string[] = [];
    const manualSteps: ManualStep[] = [];
    const zohoConditionCriteria: ZohoCriterion[] = [];
    const zohoActions: ZohoAction[] = [];
  
    // --- Process triggers ---
    for (const group of workflow.triggerGroups) {
      for (const condition of group.conditions) {
        const zohoField = FIELD_MAP[condition.property];
  
        if (zohoField === undefined) {
          // Unknown field entirely
          manualSteps.push({
            title: `Unknown trigger field: ${condition.property}`,
            description: `This field has no known Zoho equivalent. You'll need to manually find the right field in Zoho.`,
            zohoPath: 'Zoho CRM → Setup → Automation → Workflow Rules → [this rule] → Condition',
          });
          continue;
        }
  
        if (zohoField === null) {
          // Known HubSpot field, but no Zoho equivalent
          if (condition.property === 'hs_email_hard_bounce_reason_enum') {
            manualSteps.push({
              title: 'Hard bounce trigger requires manual setup',
              description:
                'HubSpot tracks email hard bounces as a contact field. Zoho handles bounces differently — ' +
                'it does not expose a "bounce reason" field you can trigger workflows on directly. ' +
                'To replicate this, go to Zoho CRM → Setup → Channels → Email → Bounce Management, ' +
                'and configure bounce handling there. You may also need a custom field or a Zoho Flow automation.',
              zohoPath: 'Zoho CRM → Setup → Channels → Email → Bounce Management',
            });
          }
          continue;
        }
  
        // Field has a valid Zoho mapping ✅
        zohoConditionCriteria.push({
          comparator: mapOperatorToZoho(condition.operator),
          field: { api_name: zohoField },
          type: 'value',
          value: condition.value ?? true,
        });
        autoMigrated.push(`Trigger: ${condition.property} → ${zohoField}`);
      }
    }
  
    // --- Process actions ---
    for (const action of workflow.actions) {
      if (action.requiresManualMigration) {
        manualSteps.push({
          title: `Action requires manual setup: ${action.actionType}`,
          description: action.manualMigrationNote ?? 'This action could not be auto-translated.',
          zohoPath: 'Zoho CRM → Setup → Automation → Workflow Rules → [this rule] → Actions',
        });
        continue;
      }
  
      const zohoAction = buildZohoAction(action);
      if (zohoAction) {
        zohoActions.push(zohoAction);
        autoMigrated.push(`Action: ${action.actionType} → Zoho field_update`);
      } else {
        manualSteps.push({
          title: `Unsupported action: ${action.actionType}`,
          description: `This action type is not yet supported for auto-migration. Please add it manually in Zoho.`,
          zohoPath: 'Zoho CRM → Setup → Automation → Workflow Rules → [this rule] → Actions',
        });
      }
    }
  
    // --- Build Zoho payload (only if we have at least something to auto-migrate) ---
    let zohoPayload: ZohoWorkflowPayload | null = null;
  
    if (zohoConditionCriteria.length > 0 || zohoActions.length > 0) {
      zohoPayload = {
        workflow_rules: [
          {
            name: workflow.name.replace(/[\[\]><()/]/g, "").trim(),
            description: workflow.description ?? '',
            module: { api_name: 'Contacts' },
            status: { active: true }, // always create as inactive — user reviews before enabling
            execute_when: {
              type: 'create_or_edit', // closest to HubSpot's segment-based enrollment
              details: { repeat: true },
            },
            conditions: [
              {
                sequence_number: 1,
                criteria_details: {
                  criteria: {
                    group_operator: 'OR', // HubSpot's groups are OR'd together
                    group: zohoConditionCriteria,
                  },
                },
                instant_actions: {
                  actions: zohoActions,
                },
              },
            ],
          },
        ],
      };
    }
  
    return {
      zohoPayload,
      manualSteps,
      summary: {
        autoMigrated,
        manualRequired: manualSteps.map((s) => s.title),
      },
    };
  }