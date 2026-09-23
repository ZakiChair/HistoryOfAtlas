import { useAtlasStore } from '@/lib/store';

export function focusBattle(battle: {
  id: string;
  start?: { year: number };
  coords?: [number, number];
  medium?: string;
  type?: string;
}) {
  const state = useAtlasStore.getState();
  const mobile = typeof window !== 'undefined' && window.matchMedia('(max-width: 700px)').matches;
  const wideScene = battle.medium === 'naval' || battle.medium === 'air' || battle.type === 'naval';
  state.patchState({
    battlesVisible: true,
    battleMode: true,
    battlePlaying: false,
    battleProgress: 0,
    selectedEvent: battle.id,
    selectedWar: null,
    selectedEntity: null,
    selectedPerson: null,
    campaignId: null,
    storyId: null,
    playing: false,
    range: null,
    mode: 'events',
    ...(battle.start ? { year: battle.start.year } : {}),
    ...(battle.coords && battle.start
      ? {
          camera: {
            ...state.camera,
            lon: battle.coords[0],
            lat: battle.coords[1],
            zoom: wideScene ? (mobile ? 14.4 : 15.5) : mobile ? 15.5 : 16.2,
            pitch: 60,
            bearing: -20,
          },
        }
      : {}),
  });
}
