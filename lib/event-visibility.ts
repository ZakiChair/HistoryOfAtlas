/** Engagements that can open a 3D battle reconstruction. */
export const BATTLE_EVENT_TYPES = ['battle', 'siege', 'naval'] as const;

/**
 * Every armed conflict the Battles toggle hides: engagements plus wars, campaigns and
 * conquests. Treaties are not conflicts and stay visible.
 */
export const CONFLICT_EVENT_TYPES = [...BATTLE_EVENT_TYPES, 'war', 'campaign', 'conquest'] as const;

export function isBattleEventType(type: string | undefined): boolean {
  return BATTLE_EVENT_TYPES.some((battleType) => battleType === type);
}

export function isConflictEventType(type: string | undefined): boolean {
  return CONFLICT_EVENT_TYPES.some((conflictType) => conflictType === type);
}

export function isEventLayerVisible(type: string, battlesVisible: boolean): boolean {
  return battlesVisible || !isConflictEventType(type);
}
