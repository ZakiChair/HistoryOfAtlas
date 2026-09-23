import { beforeEach, describe, expect, it } from 'vitest';
import { parseAtlasUrl, serializeAtlasUrl, useAtlasStore } from '../../lib/store';
import { focusBattle } from '../../lib/battles/navigation';
import { openEvent } from '../../lib/navigation';

describe('shareable map layer visibility', () => {
  beforeEach(() => useAtlasStore.getState().reset());

  it('keeps existing links showing battles with resources initially hidden', () => {
    expect(parseAtlasUrl('?y=1815')).toMatchObject({
      battlesVisible: true,
      resourcesVisible: false,
    });
    expect(parseAtlasUrl('?battles=invalid&resources=invalid')).toMatchObject({
      battlesVisible: true,
      resourcesVisible: false,
    });
  });

  it('restores both layer choices independently through shared links', () => {
    useAtlasStore.getState().setBattlesVisible(false);
    useAtlasStore.getState().setResourcesVisible(true);
    const query = serializeAtlasUrl(useAtlasStore.getState());
    expect(new URLSearchParams(query).get('battles')).toBe('0');
    expect(new URLSearchParams(query).get('resources')).toBe('1');
    expect(parseAtlasUrl(query)).toMatchObject({ battlesVisible: false, resourcesVisible: true });
    useAtlasStore.getState().hydrateFromUrl(query);
    expect(useAtlasStore.getState()).toMatchObject({
      battlesVisible: false,
      resourcesVisible: true,
    });
  });

  it('hides reconstruction and stops its clock without losing event filters', () => {
    focusBattle({ id: 'Q48314', start: { year: 1815 }, coords: [4.412, 50.68] });
    const actions = useAtlasStore.getState();
    actions.setFilters({ types: ['naval'], regions: ['europe'] });
    const filters = useAtlasStore.getState().filters;
    actions.setBattlePlaying(true);
    actions.setBattlesVisible(false);
    expect(useAtlasStore.getState()).toMatchObject({
      battlesVisible: false,
      battleMode: false,
      battlePlaying: false,
      selectedEvent: null,
    });
    expect(useAtlasStore.getState().filters).toBe(filters);
    actions.setBattlePlaying(true);
    expect(useAtlasStore.getState().battlePlaying).toBe(false);
    actions.setBattlesVisible(true);
    expect(useAtlasStore.getState()).toMatchObject({
      battleMode: false,
      battlePlaying: false,
      selectedEvent: null,
    });
  });

  it('enforces hidden layers for state patches as well as the visibility action', () => {
    focusBattle({ id: 'Q48314', start: { year: 1815 }, coords: [4.412, 50.68] });
    useAtlasStore.getState().patchState({ battlesVisible: false, battlePlaying: true });
    expect(useAtlasStore.getState()).toMatchObject({
      battleMode: false,
      battlePlaying: false,
      selectedEvent: null,
    });
    useAtlasStore.getState().patchState({ battleMode: true, battlePlaying: true });
    expect(useAtlasStore.getState()).toMatchObject({ battleMode: false, battlePlaying: false });
  });

  it('gives a hidden layer precedence over conflicting reconstruction URL parameters', () => {
    expect(parseAtlasUrl('?battles=0&battle=1&e=Q48314&bphase=0.7')).toMatchObject({
      battlesVisible: false,
      battleMode: false,
      battlePlaying: false,
      selectedEvent: null,
    });
  });

  it('keeps a normal dossier selected when hiding the battle layer', () => {
    openEvent({ id: 'Q42', type: 'treaty', start: { year: 1815 } });
    useAtlasStore.getState().patchState({ battlesVisible: false });
    expect(useAtlasStore.getState().selectedEvent).toBe('Q42');
  });

  it('shows battles again when explicitly entering their catalogue, without autoplay', () => {
    useAtlasStore.getState().patchState({ battlesVisible: false });
    useAtlasStore.getState().setBattleMode(true);
    expect(useAtlasStore.getState()).toMatchObject({
      battlesVisible: true,
      battleMode: true,
      battlePlaying: false,
    });
  });

  it('shows an explicitly opened battlefield without resuming its animation', () => {
    useAtlasStore.getState().patchState({ battlesVisible: false });
    focusBattle({ id: 'Q48314', start: { year: 1815 }, coords: [4.412, 50.68] });
    expect(useAtlasStore.getState()).toMatchObject({
      battlesVisible: true,
      battleMode: true,
      battlePlaying: false,
      selectedEvent: 'Q48314',
    });
  });

  it.each(['battle', 'siege', 'naval'] as const)(
    'shows an explicitly opened %s from search without activating 3D',
    (type) => {
      useAtlasStore.getState().patchState({ battlesVisible: false });
      openEvent({ id: 'Q48314', type, start: { year: 1815 } });
      expect(useAtlasStore.getState()).toMatchObject({
        battlesVisible: true,
        battleMode: false,
        battlePlaying: false,
        selectedEvent: 'Q48314',
      });
    },
  );
});
