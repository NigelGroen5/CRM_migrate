// lib/hubspot/extensions.ts
// Maps HubSpot internal extensionDefinitionIds to readable action type strings.
//
// HubSpot uses numeric IDs for their built-in "EXTENSION" type actions.
// This map is how we translate them to our intermediate action types.
// Add new IDs here as you discover them from real workflow JSON.

import { KnownActionType } from '../intermediate/types';

export const HUBSPOT_EXTENSION_MAP: Record<number, KnownActionType> = {
  31: 'SET_MARKETING_STATUS',  // "Set marketing contact status" (non-marketing / marketing)
  // Add more as you encounter them, e.g.:
  // 4:  'SEND_EMAIL',
  // 20: 'SET_PROPERTY',
  // 22: 'ADD_TO_LIST',
  // 23: 'REMOVE_FROM_LIST',
};

/**
 * Looks up a HubSpot extensionDefinitionId and returns the readable action type.
 * Returns null if the ID is not yet mapped (caller should flag as UNKNOWN_ACTION).
 */
export function lookupExtensionAction(
  extensionDefinitionId: number
): KnownActionType | null {
  return HUBSPOT_EXTENSION_MAP[extensionDefinitionId] ?? null;
}