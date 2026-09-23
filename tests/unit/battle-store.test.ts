import { beforeEach, describe, expect, it } from 'vitest';
import { parseAtlasUrl, serializeAtlasUrl, useAtlasStore } from '../../lib/store';
import { focusBattle } from '../../lib/battles/navigation';
import { openEvent } from '../../lib/navigation';

describe('battle reconstruction navigation and clocks', () => {
  beforeEach(() => useAtlasStore.getState().reset());

  it('opens a battlefield at its sourced coordinates without changing projection', () => {
    useAtlasStore.getState().setPlaying(true);
    focusBattle({ id: 'Q48314', start: { year: 1815 }, coords: [4.412, 50.68] });
    expect(useAtlasStore.getState()).toMatchObject({
      selectedEvent: 'Q48314',
      year: 1815,
      battleMode: true,
      battlePlaying: false,
      playing: false,
      campaignPlaying: false,
      projection: 'globe',
      camera: { lon: 4.412, lat: 50.68, zoom: 16.2, pitch: 60 },
    });
  });

  it('never invents a map position or date for an incomplete catalogue record', () => {
    const { camera, year } = useAtlasStore.getState();
    focusBattle({ id: 'Q42' });
    expect(useAtlasStore.getState()).toMatchObject({
      camera,
      year,
      selectedEvent: 'Q42',
      battleMode: true,
    });
  });

  it('keeps battle playback independent and pauses it when historical playback starts', () => {
    const state = useAtlasStore.getState();
    state.setBattleMode(true);
    state.setBattlePlaying(true);
    expect(useAtlasStore.getState()).toMatchObject({ battlePlaying: true, playing: false });
    state.setPlaying(true);
    expect(useAtlasStore.getState()).toMatchObject({ playing: true, battlePlaying: false });
    state.setBattlePlaying(true);
    expect(useAtlasStore.getState()).toMatchObject({ playing: false, battlePlaying: true });
    state.setBattleMode(false);
    expect(useAtlasStore.getState().battlePlaying).toBe(false);
    state.setBattlePlaying(true);
    expect(useAtlasStore.getState().battlePlaying).toBe(false);
  });

  it('pauses and resets the phase on selecting another battle', () => {
    focusBattle({ id: 'Q48314', start: { year: 1815 }, coords: [4.412, 50.68] });
    const state = useAtlasStore.getState();
    state.setBattleProgress(0.65);
    state.setBattlePlaying(true);
    state.selectEvent('Q42');
    expect(useAtlasStore.getState()).toMatchObject({ battleProgress: 0, battlePlaying: false });
  });

  it('pauses animations when the historical year or dossier changes', () => {
    const state = useAtlasStore.getState();
    state.setBattleMode(true);
    state.selectEvent('Q48314');
    state.setBattlePlaying(true);
    state.setYear(1492);
    expect(useAtlasStore.getState().battlePlaying).toBe(false);
    expect(useAtlasStore.getState().selectedEvent).toBeNull();
    state.setBattlePlaying(true);
    state.selectPerson('Q42');
    expect(useAtlasStore.getState()).toMatchObject({ battleMode: false, battlePlaying: false });
  });

  it('round-trips the requested scene phase while shared URLs always open paused', () => {
    const state = useAtlasStore.getState();
    state.setBattleMode(true);
    state.setBattleSpeed(2);
    state.setBattleProgress(0.75);
    state.setBattlePlaying(true);
    const restored = parseAtlasUrl(serializeAtlasUrl(useAtlasStore.getState()));
    expect(restored).toMatchObject({
      battleMode: true,
      battlePlaying: false,
      battleSpeed: 2,
      battleProgress: 0.75,
      playing: false,
    });
    expect(parseAtlasUrl('?battle=1&bphase=Infinity&bspeed=10&play=1')).toMatchObject({
      battleMode: true,
      battleProgress: 0,
      battleSpeed: 1,
      playing: false,
    });
  });

  it('bounds seek positions and gives replay a new revision even at phase zero', () => {
    const state = useAtlasStore.getState();
    state.setBattleProgress(-1);
    const revision = useAtlasStore.getState().battleRevision;
    state.setBattleProgress(0);
    expect(useAtlasStore.getState().battleRevision).toBeGreaterThan(revision);
    state.setBattleProgress(12);
    expect(useAtlasStore.getState().battleProgress).toBe(1);
    state.patchState({ battleProgress: NaN });
    expect(useAtlasStore.getState().battleProgress).toBe(0);
  });

  it('entering the catalogue clears dossiers that would obscure it on mobile', () => {
    useAtlasStore.getState().patchState({
      selectedPerson: 'Q42',
      selectedEntity: 'Q30',
      selectedEvent: 'Q48314',
      campaignId: 'Q45',
    });
    useAtlasStore.getState().setBattleMode(true);
    expect(useAtlasStore.getState()).toMatchObject({
      battleMode: true,
      selectedPerson: null,
      selectedEntity: null,
      selectedEvent: null,
      campaignId: null,
    });
  });

  it('restoring another shared phase for the same battle always issues a seek', () => {
    const state = useAtlasStore.getState();
    state.hydrateFromUrl('?battle=1&e=Q48314&bphase=0.2');
    const revision = useAtlasStore.getState().battleRevision;
    state.hydrateFromUrl('?battle=1&e=Q48314&bphase=0.8');
    expect(useAtlasStore.getState().battleRevision).toBeGreaterThan(revision);
    expect(useAtlasStore.getState().battleProgress).toBe(0.8);
  });

  it('normalizes conflicting dossiers and campaign contexts in a shared battle URL', () => {
    expect(
      parseAtlasUrl('?battle=1&e=Q48314&entity=Q30&person=Q42&campaign=Q45&war=Q43&story=test'),
    ).toMatchObject({
      battleMode: true,
      selectedEvent: 'Q48314',
      selectedEntity: null,
      selectedPerson: null,
      campaignId: null,
      selectedWar: null,
      storyId: null,
    });
  });

  it('leaves 3D mode when global search opens a non-battle event', () => {
    useAtlasStore.getState().setBattleMode(true);
    openEvent({ id: 'Q42', type: 'treaty', start: { year: 1815 } });
    expect(useAtlasStore.getState()).toMatchObject({ battleMode: false, selectedEvent: 'Q42' });
  });
});
