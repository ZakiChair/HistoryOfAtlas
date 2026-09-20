import { beforeEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_ATLAS_STATE,
  parseAtlasUrl,
  serializeAtlasUrl,
  useAtlasStore,
} from '../../lib/store';

describe('shareable atlas state', () => {
  beforeEach(() => useAtlasStore.getState().reset());

  it('restores camera, historical zero, filters and navigation from a deep link', () => {
    const state = {
      ...DEFAULT_ATLAS_STATE,
      year: 0,
      camera: { lon: -73.912345678, lat: 41.123456789, zoom: 5.625, bearing: -31.2, pitch: 42.6 },
      filters: {
        types: ['battle', 'naval'] as const,
        eras: ['classical'] as const,
        regions: ['asia'] as const,
        entity: 'Q17',
        minImportance: 42,
      },
      selectedEvent: 'Q42',
      selectedWar: 'Q43',
      selectedEntity: 'Q44',
      locale: 'en' as const,
      theme: 'light' as const,
      projection: 'mercator' as const,
      boundarySource: 'historical-basemaps' as const,
      mode: 'heatmap' as const,
      range: [-330, 500] as [number, number],
      trails: true,
      campaignId: 'Q45',
      campaignStep: 3,
      storyId: 'world-war',
      storyStep: 4,
      speed: 25 as const,
      playing: false,
    };
    const restored = parseAtlasUrl(serializeAtlasUrl(state));
    expect(restored).toEqual(state);
  });

  it('rejects invalid enum values and finite-number attacks in URL parameters', () => {
    const state = parseAtlasUrl(
      '?y=NaN&lat=500&lon=Infinity&z=-4&e=oops&lang=xx&projection=broken&filters=%7Bbad',
    );
    expect(state.year).toBe(DEFAULT_ATLAS_STATE.year);
    expect(state.camera.lat).toBe(85.051129);
    expect(state.camera.lon).toBe(DEFAULT_ATLAS_STATE.camera.lon);
    expect(state.camera.zoom).toBe(0);
    expect(state.selectedEvent).toBeNull();
    expect(state.locale).toBe('fr');
    expect(state.projection).toBe('globe');
    expect(state.filters).toEqual(DEFAULT_ATLAS_STATE.filters);
  });

  it('retains the map latitude limit and high pitch across reloads', () => {
    for (const lat of [-85.051129, 85.051129]) {
      useAtlasStore.getState().setCamera({ lat, pitch: 85 });
      const state = useAtlasStore.getState();
      expect(state.camera.lat).toBe(lat);
      expect(parseAtlasUrl(serializeAtlasUrl(state)).camera).toEqual(state.camera);
    }
  });

  it('restores distinct, contextual playback modes without orphan timers', () => {
    expect(parseAtlasUrl('?entity=clio-ab12&follow=1&y=1800')).toMatchObject({
      entityFollowing: true,
      playing: true,
      campaignPlaying: false,
    });
    expect(parseAtlasUrl('?campaign=Q10&cplay=1&step=3&play=1')).toMatchObject({
      campaignPlaying: true,
      campaignStep: 3,
      playing: false,
      entityFollowing: false,
    });
    expect(parseAtlasUrl('?follow=1&cplay=1')).toMatchObject({
      entityFollowing: false,
      campaignPlaying: false,
      playing: false,
    });
    for (const input of ['?entity=clio-ab12&follow=1&y=1800', '?campaign=Q10&cplay=1&step=3']) {
      const state = parseAtlasUrl(input);
      expect(parseAtlasUrl(serializeAtlasUrl(state))).toEqual(state);
    }
  });

  it('stops contextual playback when selection or playback mode changes', () => {
    const state = useAtlasStore.getState();
    state.selectEntity('clio-ab12');
    state.setEntityFollowing(true);
    expect(useAtlasStore.getState()).toMatchObject({ entityFollowing: true, playing: true });
    state.selectEntity('clio-cd34');
    expect(useAtlasStore.getState()).toMatchObject({ entityFollowing: false, playing: false });
    state.setCampaign('Q10');
    state.setCampaignPlaying(true);
    state.setCampaignStep(2);
    expect(useAtlasStore.getState().campaignPlaying).toBe(true);
    state.setPlaying(true);
    expect(useAtlasStore.getState()).toMatchObject({ campaignPlaying: false, playing: true });
    state.setCampaignPlaying(true);
    state.setPlaying(false);
    expect(useAtlasStore.getState()).toMatchObject({ campaignPlaying: false, playing: false });
    state.setCampaignPlaying(true);
    state.setStory('sourced-story');
    expect(useAtlasStore.getState()).toMatchObject({ campaignPlaying: false, playing: false });
  });

  it('normalizes reversed range handles and validates filters individually', () => {
    const state = parseAtlasUrl(
      '?from=1900&to=-330&filters=%7B%22types%22%3A%5B%22naval%22%2C%22garbage%22%5D%2C%22minImportance%22%3A120%7D',
    );
    expect(state.range).toEqual([-330, 1900]);
    expect(state.filters.types).toEqual(['naval']);
    expect(state.filters.minImportance).toBe(100);
  });

  it('restores the selected boundary dataset without accepting arbitrary source URLs', () => {
    expect(parseAtlasUrl('?borders=historical-basemaps')).toHaveProperty(
      'boundarySource',
      'historical-basemaps',
    );
    expect(parseAtlasUrl('?borders=https://example.org/untrusted')).toHaveProperty(
      'boundarySource',
      'cliopatria',
    );
  });

  it('offers isolated temporal subscription without changing camera or filters references', () => {
    const initial = useAtlasStore.getState();
    const years: number[] = [];
    const unsubscribe = useAtlasStore.subscribe(
      (state) => state.year,
      (year) => years.push(year),
    );
    useAtlasStore.getState().setYear(-330);
    useAtlasStore.getState().setYear(-330);
    expect(years).toEqual([-330]);
    expect(useAtlasStore.getState().camera).toBe(initial.camera);
    expect(useAtlasStore.getState().filters).toBe(initial.filters);
    unsubscribe();
  });
});
