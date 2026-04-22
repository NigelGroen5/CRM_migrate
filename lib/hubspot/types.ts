// lib/hubspot/types.ts
// Types representing the HubSpot automation/v3/workflows API response

export interface HubSpotWorkflow {
    id: number;
    name: string;
    description?: string;
    type: string; // e.g. "DRIP_DELAY"
    enabled: boolean;
    portalId: number;
    insertedAt: number;
    updatedAt: number;
  
    // Enrollment trigger conditions
    // Outer array = OR groups, inner array = AND conditions within each group
    segmentCriteria: HubSpotCriteriaGroup[];
  
    // Re-enrollment triggers (usually empty for simple workflows)
    reEnrollmentTriggerSets: unknown[];
  
    // The actual steps/actions in the workflow
    actions: HubSpotAction[];
  
    // Misc enrollment settings
    allowContactToTriggerMultipleTimes: boolean;
    enrollOnCriteriaUpdate: boolean;
    allowEnrollmentFromMerge: boolean;
    isSegmentBased: boolean;
    listening: boolean;
    deleted: boolean;
  
    goalCriteria: unknown[];
    triggerSets: unknown[];
    suppressionListIds: number[];
  
    migrationStatus?: HubSpotMigrationStatus;
    creationSource?: HubSpotSource;
    updateSource?: HubSpotSource;
  }
  
  // One group of conditions (joined by AND internally, OR between groups)
  export type HubSpotCriteriaGroup = HubSpotCriterion[];
  
  export interface HubSpotCriterion {
    type: 'string' | 'bool' | 'number' | 'enumeration' | 'datetime';
    operator: HubSpotOperator;
    filterFamily: 'PropertyValue' | 'FormSubmission' | 'PageView' | string;
    property: string;
    value?: string | number | boolean;
    withinTimeMode?: 'PAST' | 'FUTURE';
  }
  
  export type HubSpotOperator =
    | 'EQ'
    | 'NEQ'
    | 'IS_EMPTY'
    | 'IS_NOT_EMPTY'
    | 'CONTAINS'
    | 'NOT_CONTAINS'
    | 'GT'
    | 'GTE'
    | 'LT'
    | 'LTE'
    | 'BETWEEN';
  
  export interface HubSpotAction {
    type: 'EXTENSION' | 'DELAY' | 'SET_CONTACT_PROPERTY' | 'BRANCH' | string;
    actionId: number;
    stepId: number;
  
    // For EXTENSION type actions (built-in HubSpot actions)
    extensionDefinitionId?: number;
    extensionDefinitionVersion?: number;
    extensionInstanceVersion?: number;
    extensionId?: number;
    metadata?: Record<string, unknown>;
  }
  
  export interface HubSpotMigrationStatus {
    portalId: number;
    workflowId: number;
    migrationStatus: string;
    enrollmentMigrationStatus: string;
    platformOwnsActions: boolean;
    flowId: number;
  }
  
  export interface HubSpotSource {
    sourceApplication: {
      source: string;
      serviceName: string;
    };
    createdByUser?: { userId: number; userEmail: string };
    updatedByUser?: { userId: number; userEmail: string };
    createdAt?: number;
    updatedAt?: number;
    clonedFromWorkflowId?: number;
  }