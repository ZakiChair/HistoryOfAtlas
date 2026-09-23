'use client';

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { CURRENT_YEAR, MIN_YEAR } from '../eras';
import { DEFAULT_LOCALE, ERA_IDS, EVENT_TYPES, REGION_IDS, isLocale } from '../types';
import type { EraId, EventType, Locale, RegionId } from '../types';

// Keep URL normalization aligned with MapLibre's Mercator latitude limit.
const MAX_MAP_LATITUDE = 85.051129;

export interface AtlasCamera {
  lon: number;
  lat: number;
  zoom: number;
  bearing: number;
  pitch: number;
}

export interface AtlasFilters {
  types: readonly EventType[];
  eras: readonly EraId[];
  regions: readonly RegionId[];
  entity: string | null;
  minImportance: number;
}

export interface AtlasState {
  year: number;
  camera: AtlasCamera;
  filters: AtlasFilters;
  selectedEvent: string | null;
  selectedWar: string | null;
  selectedEntity: string | null;
  selectedPerson: string | null;
  locale: Locale;
  theme: 'dark' | 'light';
  projection: 'globe' | 'mercator';
  boundarySource: 'cliopatria' | 'historical-basemaps';
  mode: 'events' | 'heatmap' | 'list';
  range: [number, number] | null;
  trails: boolean;
  playing: boolean;
  entityFollowing: boolean;
  campaignPlaying: boolean;
  speed: 1 | 5 | 25 | 100;
  campaignId: string | null;
  campaignStep: number;
  storyId: string | null;
  storyStep: number;
  battlesVisible: boolean;
  resourcesVisible: boolean;
  battleMode: boolean;
  battlePlaying: boolean;
  battleSpeed: 0.5 | 1 | 2;
  /** Requested seek position. The renderer owns its frame clock. */
  battleProgress: number;
  battleRevision: number;
}

export const DEFAULT_ATLAS_STATE: AtlasState = {
  year: 1812,
  camera: { lon: 18, lat: 32, zoom: 1.8, bearing: 0, pitch: 0 },
  filters: { types: [], eras: [], regions: [], entity: null, minImportance: 0 },
  selectedEvent: null,
  selectedWar: null,
  selectedEntity: null,
  selectedPerson: null,
  locale: DEFAULT_LOCALE,
  theme: 'dark',
  projection: 'globe',
  boundarySource: 'cliopatria',
  mode: 'events',
  range: null,
  trails: false,
  playing: false,
  entityFollowing: false,
  campaignPlaying: false,
  speed: 5,
  campaignId: null,
  campaignStep: 0,
  storyId: null,
  storyStep: 0,
  battlesVisible: true,
  resourcesVisible: false,
  battleMode: false,
  battlePlaying: false,
  battleSpeed: 1,
  battleProgress: 0,
  battleRevision: 0,
};
export const DEFAULT_STATE = DEFAULT_ATLAS_STATE;

export function createInitialAtlasState(): AtlasState {
  return {
    ...DEFAULT_ATLAS_STATE,
    camera: { ...DEFAULT_ATLAS_STATE.camera },
    filters: { ...DEFAULT_ATLAS_STATE.filters, types: [], eras: [], regions: [] },
  };
}

function finiteNumber(value: unknown, fallback: number, min: number, max: number): number {
  if (value === null || value === undefined || value === '') return fallback;
  const number = typeof value === 'number' || typeof value === 'string' ? Number(value) : NaN;
  return Number.isFinite(number) ? Math.max(min, Math.min(max, number)) : fallback;
}

function yearNumber(value: unknown, fallback = DEFAULT_ATLAS_STATE.year): number {
  return Math.round(finiteNumber(value, fallback, MIN_YEAR, CURRENT_YEAR));
}

function identifier(value: unknown, qid = true): string | null {
  if (typeof value !== 'string' || value.length > 200) return null;
  return (qid ? /^Q[1-9]\d*$/.test(value) : /^[\p{L}\p{N}_.: -]+$/u.test(value)) ? value : null;
}

function members<T extends string>(value: unknown, valid: readonly T[]): T[] {
  return Array.isArray(value)
    ? [
        ...new Set(
          value.filter((item): item is T => typeof item === 'string' && valid.includes(item as T)),
        ),
      ]
    : [];
}

function normalizeFilters(filters: Partial<AtlasFilters>): AtlasFilters {
  return {
    types: members(filters.types, EVENT_TYPES),
    eras: members(filters.eras, ERA_IDS),
    regions: members(filters.regions, REGION_IDS),
    entity: identifier(filters.entity, false),
    minImportance: finiteNumber(filters.minImportance, 0, 0, 100),
  };
}

function normalizeCamera(
  camera: Partial<AtlasCamera>,
  fallback: AtlasCamera = DEFAULT_ATLAS_STATE.camera,
): AtlasCamera {
  return {
    lon: finiteNumber(camera.lon, fallback.lon, -180, 180),
    lat: finiteNumber(camera.lat, fallback.lat, -MAX_MAP_LATITUDE, MAX_MAP_LATITUDE),
    zoom: finiteNumber(camera.zoom, fallback.zoom, 0, 18),
    bearing: finiteNumber(camera.bearing, fallback.bearing, -360, 360),
    pitch: finiteNumber(camera.pitch, fallback.pitch, 0, 85),
  };
}

function normalizeRange(range: [number, number] | null): [number, number] | null {
  if (!range) return null;
  const a = yearNumber(range[0], MIN_YEAR);
  const b = yearNumber(range[1], CURRENT_YEAR);
  return a <= b ? [a, b] : [b, a];
}

export function parseAtlasUrl(input: string | URLSearchParams): AtlasState {
  let query: URLSearchParams;
  if (input instanceof URLSearchParams) query = input;
  else if (/^https?:\/\//i.test(input)) query = new URL(input).searchParams;
  else query = new URLSearchParams(input.startsWith('?') ? input.slice(1) : input);
  const state = createInitialAtlasState();
  state.year = yearNumber(query.get('y'));
  state.camera = normalizeCamera({
    lon: finiteNumber(query.get('lon'), state.camera.lon, -180, 180),
    lat: finiteNumber(query.get('lat'), state.camera.lat, -MAX_MAP_LATITUDE, MAX_MAP_LATITUDE),
    zoom: finiteNumber(query.get('z'), state.camera.zoom, 0, 18),
    bearing: finiteNumber(query.get('bearing'), state.camera.bearing, -360, 360),
    pitch: finiteNumber(query.get('pitch'), state.camera.pitch, 0, 85),
  });
  try {
    const raw: unknown = JSON.parse(query.get('filters') ?? '{}');
    if (raw && typeof raw === 'object' && !Array.isArray(raw))
      state.filters = normalizeFilters(raw as Partial<AtlasFilters>);
  } catch {
    /* An invalid shared filter does not prevent opening the atlas. */
  }
  state.selectedEvent = identifier(query.get('e'));
  state.selectedWar = identifier(query.get('war'));
  state.selectedEntity = identifier(query.get('entity'), false);
  state.selectedPerson = identifier(query.get('person'));
  const locale = query.get('lang');
  state.locale = isLocale(locale) ? locale : DEFAULT_LOCALE;
  state.theme = query.get('theme') === 'light' ? 'light' : 'dark';
  state.projection = query.get('projection') === 'mercator' ? 'mercator' : 'globe';
  state.boundarySource =
    query.get('borders') === 'historical-basemaps' ? 'historical-basemaps' : 'cliopatria';
  const mode = query.get('mode');
  state.mode = mode === 'heatmap' || mode === 'list' ? mode : 'events';
  if (query.has('from') && query.has('to'))
    state.range = normalizeRange([
      yearNumber(query.get('from'), MIN_YEAR),
      yearNumber(query.get('to'), CURRENT_YEAR),
    ]);
  state.trails = query.get('trails') === '1';
  state.playing = query.get('play') === '1';
  const speed = Number(query.get('speed'));
  if (speed === 1 || speed === 5 || speed === 25 || speed === 100) state.speed = speed;
  state.campaignId = identifier(query.get('campaign'));
  state.campaignStep = Math.floor(finiteNumber(query.get('step'), 0, 0, 100_000));
  state.storyId = identifier(query.get('story'), false);
  state.storyStep = Math.floor(finiteNumber(query.get('chapter'), 0, 0, 100_000));
  state.campaignPlaying = Boolean(state.campaignId && query.get('cplay') === '1');
  state.entityFollowing = Boolean(
    state.selectedEntity && query.get('follow') === '1' && !state.campaignPlaying,
  );
  if (state.campaignPlaying) state.playing = false;
  else if (state.entityFollowing) state.playing = true;
  if (state.selectedPerson) {
    // Opening a dossier pauses its source, but the timeline can be restarted explicitly.
    state.playing = query.get('play') === '1';
    state.campaignPlaying = false;
    state.entityFollowing = false;
  }
  state.battlesVisible = query.get('battles') !== '0';
  state.resourcesVisible = query.get('resources') === '1';
  state.battleMode = query.get('battle') === '1' && state.battlesVisible;
  if (!state.battlesVisible && query.get('battle') === '1') state.selectedEvent = null;
  state.battleProgress = finiteNumber(query.get('bphase'), 0, 0, 1);
  const battleSpeed = Number(query.get('bspeed'));
  if (battleSpeed === 0.5 || battleSpeed === 1 || battleSpeed === 2)
    state.battleSpeed = battleSpeed;
  // Opening a shared reconstruction always starts paused, including reduced-motion users.
  if (state.battleMode) {
    state.selectedEntity = null;
    state.selectedPerson = null;
    state.selectedWar = null;
    state.campaignId = null;
    state.storyId = null;
    state.playing = false;
    state.campaignPlaying = false;
    state.entityFollowing = false;
  }
  return state;
}

/** No camera rounding: opening a shared URL restores the precise supplied view. */
export function serializeAtlasUrl(state: AtlasState): string {
  const query = new URLSearchParams({
    y: String(state.year),
    lon: String(state.camera.lon),
    lat: String(state.camera.lat),
    z: String(state.camera.zoom),
    bearing: String(state.camera.bearing),
    pitch: String(state.camera.pitch),
    lang: state.locale,
    theme: state.theme,
    projection: state.projection,
    mode: state.mode,
    speed: String(state.speed),
  });
  query.set('filters', JSON.stringify(state.filters));
  if (state.boundarySource !== 'cliopatria') query.set('borders', state.boundarySource);
  if (state.selectedEvent) query.set('e', state.selectedEvent);
  if (state.selectedWar) query.set('war', state.selectedWar);
  if (state.selectedEntity) query.set('entity', state.selectedEntity);
  if (state.selectedPerson) query.set('person', state.selectedPerson);
  if (state.range) {
    query.set('from', String(state.range[0]));
    query.set('to', String(state.range[1]));
  }
  if (state.trails) query.set('trails', '1');
  if (!state.battlesVisible) query.set('battles', '0');
  if (state.resourcesVisible) query.set('resources', '1');
  if (state.battleMode) {
    query.set('battle', '1');
    query.set('bphase', String(state.battleProgress));
    query.set('bspeed', String(state.battleSpeed));
  }
  if (state.playing) query.set('play', '1');
  if (state.entityFollowing && state.selectedEntity) query.set('follow', '1');
  if (state.campaignPlaying && state.campaignId) query.set('cplay', '1');
  if (state.campaignId) {
    query.set('campaign', state.campaignId);
    query.set('step', String(state.campaignStep));
  }
  if (state.storyId) {
    query.set('story', state.storyId);
    query.set('chapter', String(state.storyStep));
  }
  return `?${query.toString()}`;
}

export interface AtlasActions {
  setYear: (year: number) => void;
  setCamera: (camera: Partial<AtlasCamera>) => void;
  setFilters: (filters: Partial<AtlasFilters>) => void;
  resetFilters: () => void;
  selectEvent: (id: string | null) => void;
  selectWar: (id: string | null) => void;
  selectEntity: (id: string | null) => void;
  selectPerson: (id: string | null) => void;
  setLocale: (locale: Locale) => void;
  setTheme: (theme: AtlasState['theme']) => void;
  setProjection: (projection: AtlasState['projection']) => void;
  setBoundarySource: (source: AtlasState['boundarySource']) => void;
  setMode: (mode: AtlasState['mode']) => void;
  setRange: (range: [number, number] | null) => void;
  setTrails: (trails: boolean) => void;
  setPlaying: (playing: boolean) => void;
  setEntityFollowing: (following: boolean) => void;
  setCampaignPlaying: (playing: boolean) => void;
  setSpeed: (speed: AtlasState['speed']) => void;
  setCampaign: (id: string | null, step?: number) => void;
  setCampaignStep: (step: number) => void;
  setStory: (id: string | null, step?: number) => void;
  setStoryStep: (step: number) => void;
  setBattlesVisible: (visible: boolean) => void;
  setResourcesVisible: (visible: boolean) => void;
  setBattleMode: (enabled: boolean) => void;
  setBattlePlaying: (playing: boolean) => void;
  setBattleSpeed: (speed: AtlasState['battleSpeed']) => void;
  setBattleProgress: (progress: number) => void;
  patchState: (patch: Partial<AtlasState>) => void;
  hydrateFromUrl: (url: string | URLSearchParams) => void;
  reset: () => void;
}

/** Context playback never survives leaving its source, and only one clock runs at a time. */
function playbackPatch(state: AtlasState, patch: Partial<AtlasState>): Partial<AtlasState> {
  if (!(patch.battlesVisible ?? state.battlesVisible))
    patch = {
      ...patch,
      battleMode: false,
      battlePlaying: false,
      // A reconstruction selection must not turn into a dossier when its layer closes.
      ...(state.battleMode || patch.battleMode ? { selectedEvent: null } : {}),
    };
  if (
    state.battleMode &&
    patch.year !== undefined &&
    patch.year !== state.year &&
    patch.selectedEvent === undefined
  )
    patch = { ...patch, selectedEvent: null };
  const next = { ...state, ...patch };
  const changedEntity =
    patch.selectedEntity !== undefined && patch.selectedEntity !== state.selectedEntity;
  const changedCampaign = patch.campaignId !== undefined && patch.campaignId !== state.campaignId;
  const changedStory = patch.storyId !== undefined && patch.storyId !== state.storyId;
  if (patch.selectedPerson !== undefined) next.selectedPerson = identifier(patch.selectedPerson);
  else if (
    patch.selectedEvent ||
    patch.selectedEntity ||
    patch.selectedWar ||
    changedCampaign ||
    changedStory
  )
    next.selectedPerson = null;
  const openingOtherContext =
    changedStory ||
    Boolean(patch.selectedEvent) ||
    Boolean(patch.selectedWar) ||
    Boolean(patch.selectedPerson);
  if (changedEntity || openingOtherContext || patch.playing === false) {
    next.entityFollowing = false;
    if (state.entityFollowing) next.playing = false;
  }
  if (changedCampaign || changedEntity || openingOtherContext || patch.playing === true)
    next.campaignPlaying = false;
  if (openingOtherContext) next.playing = false;
  if (patch.entityFollowing === false && state.entityFollowing) next.playing = false;
  if (patch.entityFollowing === true && next.selectedEntity) {
    next.entityFollowing = true;
    next.campaignPlaying = false;
    next.playing = true;
  }
  if (patch.campaignPlaying === true && next.campaignId) {
    next.campaignPlaying = true;
    next.entityFollowing = false;
    next.playing = false;
  }
  if (!next.selectedEntity) next.entityFollowing = false;
  if (!next.campaignId) next.campaignPlaying = false;
  if (
    (changedEntity && next.selectedEntity) ||
    Boolean(patch.selectedPerson) ||
    (changedCampaign && next.campaignId) ||
    (changedStory && next.storyId)
  )
    next.battleMode = false;
  if (patch.battleMode === true || (patch.battlePlaying === true && next.battleMode)) {
    next.playing = false;
    next.campaignPlaying = false;
    next.entityFollowing = false;
  }
  if (
    !next.battleMode ||
    next.playing ||
    next.campaignPlaying ||
    next.entityFollowing ||
    changedCampaign ||
    changedStory ||
    changedEntity ||
    Boolean(patch.selectedPerson) ||
    (patch.year !== undefined && patch.year !== state.year)
  )
    next.battlePlaying = false;
  const changedBattle =
    patch.selectedEvent !== undefined && patch.selectedEvent !== state.selectedEvent;
  if (changedBattle) {
    next.battlePlaying = false;
    next.battleProgress = 0;
    next.battleRevision = state.battleRevision + 1;
  }
  if (patch.battleProgress !== undefined) {
    next.battleProgress = finiteNumber(patch.battleProgress, 0, 0, 1);
    next.battleRevision = state.battleRevision + 1;
  }
  return {
    ...patch,
    selectedPerson: next.selectedPerson,
    playing: next.playing,
    entityFollowing: next.entityFollowing,
    campaignPlaying: next.campaignPlaying,
    battleMode: next.battleMode,
    battlePlaying: next.battlePlaying,
    battleProgress: next.battleProgress,
    battleRevision: next.battleRevision,
  };
}

export const useAtlasStore = create<AtlasState & AtlasActions>()(
  subscribeWithSelector((set) => ({
    ...createInitialAtlasState(),
    setYear: (year) => set((state) => playbackPatch(state, { year: yearNumber(year, state.year) })),
    setCamera: (camera) => set((state) => ({ camera: normalizeCamera(camera, state.camera) })),
    setFilters: (filters) =>
      set((state) => ({ filters: normalizeFilters({ ...state.filters, ...filters }) })),
    resetFilters: () => set({ filters: createInitialAtlasState().filters }),
    selectEvent: (id) => set((state) => playbackPatch(state, { selectedEvent: identifier(id) })),
    selectWar: (id) => set((state) => playbackPatch(state, { selectedWar: identifier(id) })),
    selectEntity: (id) =>
      set((state) => playbackPatch(state, { selectedEntity: identifier(id, false) })),
    selectPerson: (id) => set((state) => playbackPatch(state, { selectedPerson: identifier(id) })),
    setLocale: (locale) => set({ locale }),
    setTheme: (theme) => set({ theme }),
    setProjection: (projection) => set({ projection }),
    setBoundarySource: (boundarySource) => set({ boundarySource }),
    setMode: (mode) => set({ mode }),
    setRange: (range) => set({ range: normalizeRange(range) }),
    setTrails: (trails) => set({ trails }),
    setPlaying: (playing) =>
      set((state) => playbackPatch(state, { playing, campaignPlaying: false })),
    setEntityFollowing: (entityFollowing) =>
      set((state) => playbackPatch(state, { entityFollowing })),
    setCampaignPlaying: (campaignPlaying) =>
      set((state) => playbackPatch(state, { campaignPlaying })),
    setSpeed: (speed) => set({ speed }),
    setCampaign: (id, step = 0) =>
      set((state) =>
        playbackPatch(state, {
          campaignId: identifier(id),
          campaignStep: Math.max(0, Math.floor(step)),
        }),
      ),
    setCampaignStep: (step) => set({ campaignStep: Math.max(0, Math.floor(step)) }),
    setStory: (id, step = 0) =>
      set((state) =>
        playbackPatch(state, {
          storyId: identifier(id, false),
          storyStep: Math.max(0, Math.floor(step)),
        }),
      ),
    setStoryStep: (step) => set({ storyStep: Math.max(0, Math.floor(step)) }),
    setBattlesVisible: (battlesVisible) => set((state) => playbackPatch(state, { battlesVisible })),
    setResourcesVisible: (resourcesVisible) => set({ resourcesVisible }),
    setBattleMode: (battleMode) =>
      set((state) =>
        playbackPatch(state, {
          battleMode,
          battlePlaying: false,
          ...(battleMode
            ? {
                battlesVisible: true,
                selectedEvent: null,
                selectedEntity: null,
                selectedPerson: null,
                selectedWar: null,
                campaignId: null,
                storyId: null,
                battleProgress: 0,
                mode: 'events' as const,
              }
            : state.battleMode
              ? { selectedEvent: null }
              : {}),
        }),
      ),
    setBattlePlaying: (battlePlaying) => set((state) => playbackPatch(state, { battlePlaying })),
    setBattleSpeed: (battleSpeed) => {
      if (battleSpeed === 0.5 || battleSpeed === 1 || battleSpeed === 2) set({ battleSpeed });
    },
    setBattleProgress: (battleProgress) => set((state) => playbackPatch(state, { battleProgress })),
    patchState: (patch) =>
      set((state) => ({
        ...playbackPatch(state, patch),
        ...(patch.year !== undefined ? { year: yearNumber(patch.year, state.year) } : {}),
        ...(patch.camera ? { camera: normalizeCamera(patch.camera, state.camera) } : {}),
        ...(patch.filters ? { filters: normalizeFilters(patch.filters) } : {}),
        ...(patch.range !== undefined ? { range: normalizeRange(patch.range) } : {}),
      })),
    hydrateFromUrl: (url) =>
      set((state) => ({ ...parseAtlasUrl(url), battleRevision: state.battleRevision + 1 })),
    reset: () => set(createInitialAtlasState()),
  })),
);
