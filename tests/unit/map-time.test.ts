import { beforeEach, describe, expect, it } from 'vitest';
import { surroundingSnapshots, temporalWindow, filterEvents } from '../../lib/map-time';
import { openCampaign, openEvent } from '../../lib/navigation';
import { useAtlasStore } from '../../lib/store';
import type { Campaign } from '../../lib/schema';

describe('historical territorial transitions', () => {
  const snapshots = [
    { year: -100, url: 'a' },
    { year: 100, url: 'b' },
    { year: 200, url: 'c' },
  ];
  it('blends only the two bracketing sources, with exact endpoints', () => {
    expect(surroundingSnapshots(snapshots, 0)).toEqual({
      before: snapshots[0],
      after: snapshots[1],
      mix: 0.5,
    });
    expect(surroundingSnapshots(snapshots, 100)).toEqual({
      before: snapshots[1],
      after: snapshots[2],
      mix: 0,
    });
  });
  it('holds the last available source outside its coverage without inventing a snapshot', () => {
    expect(surroundingSnapshots(snapshots, 2026)).toEqual({
      before: snapshots[2],
      after: snapshots[2],
      mix: 0,
    });
    expect(surroundingSnapshots([], 1)).toBeNull();
  });
  it('sorts independently of source input order without mutating it', () => {
    const unordered = [snapshots[2], snapshots[0], snapshots[1]];
    expect(surroundingSnapshots(unordered, 150)).toEqual({
      before: snapshots[1],
      after: snapshots[2],
      mix: 0.5,
    });
    expect(unordered[0]).toBe(snapshots[2]);
  });
  it('widens the visibility window for rapid playback without changing source dates', () => {
    expect(temporalWindow(100, true)).toBeGreaterThan(temporalWindow(1, false));
  });
  it('includes spanning wars and combines filters rather than replacing them', () => {
    const records = [
      {
        id: 'Q1',
        type: 'war',
        start: { year: 1900 },
        end: { year: 1920 },
        importance: 80,
        region: 'asia',
        era: '20th-century',
        belligerents: [],
      },
      {
        id: 'Q2',
        type: 'battle',
        start: { year: 1910 },
        importance: 30,
        region: 'europe',
        era: '20th-century',
        belligerents: [],
      },
    ];
    expect(
      filterEvents(records, {
        year: 1910,
        window: 0,
        types: [],
        regions: ['asia'],
        eras: [],
        minImportance: 50,
      }).map((e) => e.id),
    ).toEqual(['Q1']);
  });
  it('uses inclusive astronomical bounds and exact participant identities', () => {
    const records = [
      {
        id: 'Q1',
        type: 'battle',
        start: { year: -1 },
        importance: 70,
        region: 'asia',
        era: 'classical',
        parentWar: 'Q100',
        belligerents: [{ entityId: 'Q10' }],
      },
      {
        id: 'Q2',
        type: 'war',
        start: { year: 0 },
        end: { year: 10 },
        importance: 70,
        region: 'asia',
        era: 'classical',
        parentWar: 'Q100',
        belligerents: [{ entityId: 'Q1' }],
      },
      {
        id: 'Q3',
        type: 'battle',
        start: { year: 1 },
        importance: 70,
        region: 'asia',
        era: 'classical',
        parentWar: 'Q200',
        belligerents: [{ entityId: 'Q1' }],
      },
    ];
    expect(
      filterEvents(records, {
        year: 1,
        window: 0,
        types: [],
        regions: [],
        eras: [],
        minImportance: 0,
        entity: 'Q1',
        war: 'Q100',
        range: [-1, 0],
      }).map((event) => event.id),
    ).toEqual(['Q2']);
  });
});

describe('navigation context and deep-link consistency', () => {
  beforeEach(() => useAtlasStore.getState().reset());
  it('opens an event without retaining an unrelated war or campaign filter', () => {
    useAtlasStore
      .getState()
      .patchState({ selectedWar: 'Q100', campaignId: 'Q200', playing: true, range: [1, 10] });
    openEvent({ id: 'Q300', start: { year: -330 }, coords: [12, 34] });
    const state = useAtlasStore.getState();
    expect(state.selectedEvent).toBe('Q300');
    expect(state.selectedWar).toBeNull();
    expect(state.campaignId).toBeNull();
    expect(state.playing).toBe(false);
    expect(state.year).toBe(-330);
    expect(state.range).toBeNull();
    expect(state.camera).toMatchObject({ lon: 12, lat: 34 });
  });
  it('navigates a story without covering its controls with an event drawer', () => {
    useAtlasStore
      .getState()
      .patchState({ storyId: 'source-story', storyStep: 2, selectedEvent: 'Q200' });
    openEvent(
      { id: 'Q300', start: { year: -330 }, coords: [12, 34] },
      { preserveContext: true, showDetails: false },
    );
    expect(useAtlasStore.getState()).toMatchObject({
      storyId: 'source-story',
      storyStep: 2,
      year: -330,
      selectedEvent: null,
      camera: { lon: 12, lat: 34 },
    });
  });

  it('clamps a campaign step and keeps its playback controls unobscured', () => {
    // Structural-only fixture, never included in the historical corpus.
    const campaign: Campaign = {
      id: 'Q10',
      name: { en: 'Structural test' },
      polity: 'Q20',
      sources: [{ label: 'Fixture', url: 'https://example.org' }],
      steps: [
        { eventId: 'Q30', coords: [12, 34], date: { year: 1 }, label: 'First' },
        { eventId: 'Q40', coords: [13, 35], date: { year: 2 }, label: 'Last' },
      ],
    };
    useAtlasStore.getState().selectEvent('Q50');
    openCampaign(campaign, 99);
    expect(useAtlasStore.getState()).toMatchObject({
      campaignStep: 1,
      selectedEvent: null,
      year: 2,
    });
    openCampaign(campaign, -9);
    expect(useAtlasStore.getState()).toMatchObject({
      campaignStep: 0,
      selectedEvent: null,
      year: 1,
    });
    useAtlasStore.getState().setCampaignPlaying(true);
    openCampaign(campaign, 1);
    expect(useAtlasStore.getState()).toMatchObject({
      campaignStep: 1,
      campaignPlaying: true,
      playing: false,
    });
  });
});
