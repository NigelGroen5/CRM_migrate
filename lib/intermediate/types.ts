// lib/intermediate/types.ts
// CRM-agnostic intermediate workflow schema.
// HubSpot workflows get parsed INTO this format.
// Zoho workflows get built FROM this format.
// Adding a new CRM later only requires one new parser + one new builder.

export interface IntermediateWorkflow {
    // Metadata
    sourceId: string;         // Original ID from the source CRM
    sourceCRM: 'hubspot' | 'zoho' | string;
    name: string;
    description?: string;
    enabled: boolean;
    createdAt?: number;       // Unix ms
    updatedAt?: number;       // Unix ms
  
    // Enrollment logic
    // triggerGroups are joined by OR
    // conditions within each group are joined by AND
    triggerGroups: TriggerGroup[];
  
    // Ordered list of actions to execute
    actions: IntermediateAction[];
  }
  
  // One OR-group of trigger conditions
  export interface TriggerGroup {
    conditions: TriggerCondition[];
  }
  
  export interface TriggerCondition {
    // The CRM property/field being evaluated
    property: string;
  
    // Normalized operator
    operator: IntermediateOperator;
  
    // The value to compare against (optional for IS_EMPTY / IS_NOT_EMPTY)
    value?: string | number | boolean;
  
    // Human-readable label for manual migration UI fallback
    label?: string;
  }
  
  export type IntermediateOperator =
    | 'IS_EMPTY'
    | 'IS_NOT_EMPTY'
    | 'EQUALS'
    | 'NOT_EQUALS'
    | 'CONTAINS'
    | 'NOT_CONTAINS'
    | 'GREATER_THAN'
    | 'LESS_THAN';
  
  export interface IntermediateAction {
    // Normalized action type — add new types here as you support more workflows
    actionType: KnownActionType | 'UNKNOWN_ACTION';
  
    // Raw source action type (for debugging / fallback UI)
    sourceActionType: string;
  
    // Any parameters the action needs (varies by actionType)
    parameters: Record<string, unknown>;
  
    // If true, this action couldn't be auto-translated and needs manual handling
    requiresManualMigration: boolean;
  
    // Optional message to show in the manual migration UI
    manualMigrationNote?: string;
  }
  
  // Grow this list as you add support for more action types
  export type KnownActionType =
    | 'SET_MARKETING_STATUS'   // Set contact as marketing / non-marketing
    | 'SEND_EMAIL'             // Send a marketing email
    | 'SET_PROPERTY'           // Update a contact/deal/company property
    | 'ADD_TO_LIST'            // Add contact to a static list
    | 'REMOVE_FROM_LIST'       // Remove contact from a static list
    | 'CREATE_TASK'            // Create a CRM task
    | 'DELAY'                  // Wait X time before next action
    | 'BRANCH';                // Conditional branch (if/else)