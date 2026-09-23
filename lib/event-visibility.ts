/** Battles share one map layer; wars, campaigns and treaties remain independently visible. */
export const BATTLE_EVENT_TYPES = ['battle', 'siege', 'naval'] as const;

export function isBattleEventType(type: string | undefined): boolean {
  return BATTLE_EVENT_TYPES.some((battleType) => battleType === type);
}

export function isEventLayerVisible(type: string, battlesVisible: boolean): boolean {
  return battlesVisible || !isBattleEventType(type);
}
