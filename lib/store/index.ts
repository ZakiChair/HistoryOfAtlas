'use client';

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { CURRENT_YEAR, MIN_YEAR } from '../eras';
import { ERA_IDS, EVENT_TYPES, REGION_IDS } from '../types';
import type { EraId, EventType, Locale, RegionId } from '../types';

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
  locale: Locale;
  theme: 'dark' | 'light';
  projection: 'globe' | 'mercator';
  mode: 'events' | 'heatmap' | 'list';
  range: [number, number] | null;
  trails: boolean;
  playing: boolean;
  speed: 1 | 5 | 25 | 100;
  campaignId: string | null;
  campaignStep: number;
  storyId: string | null;
  storyStep: number;
}

export const DEFAULT_ATLAS_STATE: AtlasState = {
  year: 1812,
  camera: { lon: 18, lat: 32, zoom: 1.8, bearing: 0, pitch: 0 },
  filters: { types: [], eras: [], regions: [], entity: null, minImportance: 0 },
  selectedEvent: null,
  selectedWar: null,
  selectedEntity: null,
  locale: 'fr',
  theme: 'dark',
  projection: 'globe',
  mode: 'events',
  range: null,
  trails: false,
  playing: false,
  speed: 5,
  campaignId: null,
  campaignStep: 0,
  storyId: null,
  storyStep: 0,
};
export const DEFAULT_STATE = DEFAULT_ATLAS_STATE;

export function createInitialAtlasState(): AtlasState {
  return { ...DEFAULT_ATLAS_STATE, camera: { ...DEFAULT_ATLAS_STATE.camera }, filters: { ...DEFAULT_ATLAS_STATE.filters, types: [], eras: [], regions: [] } };
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
  return Array.isArray(value) ? [...new Set(value.filter((item): item is T => typeof item === 'string' && valid.includes(item as T)))] : [];
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

function normalizeCamera(camera: Partial<AtlasCamera>, fallback: AtlasCamera = DEFAULT_ATLAS_STATE.camera): AtlasCamera {
  return {
    lon: finiteNumber(camera.lon, fallback.lon, -180, 180),
    lat: finiteNumber(camera.lat, fallback.lat, -85, 85),
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
    lat: finiteNumber(query.get('lat'), state.camera.lat, -85, 85),
    zoom: finiteNumber(query.get('z'), state.camera.zoom, 0, 18),
    bearing: finiteNumber(query.get('bearing'), state.camera.bearing, -360, 360),
    pitch: finiteNumber(query.get('pitch'), state.camera.pitch, 0, 85),
  });
  try {
    const raw: unknown = JSON.parse(query.get('filters') ?? '{}');
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) state.filters = normalizeFilters(raw as Partial<AtlasFilters>);
  } catch { /* An invalid shared filter does not prevent opening the atlas. */ }
  state.selectedEvent = identifier(query.get('e'));
  state.selectedWar = identifier(query.get('war'));
  state.selectedEntity = identifier(query.get('entity'), false);
  state.locale = query.get('lang') === 'en' ? 'en' : 'fr';
  state.theme = query.get('theme') === 'light' ? 'light' : 'dark';
  state.projection = query.get('projection') === 'mercator' ? 'mercator' : 'globe';
  const mode = query.get('mode');
  state.mode = mode === 'heatmap' || mode === 'list' ? mode : 'events';
  if (query.has('from') && query.has('to')) state.range = normalizeRange([yearNumber(query.get('from'), MIN_YEAR), yearNumber(query.get('to'), CURRENT_YEAR)]);
  state.trails = query.get('trails') === '1';
  state.playing = query.get('play') === '1';
  const speed = Number(query.get('speed'));
  if (speed === 1 || speed === 5 || speed === 25 || speed === 100) state.speed = speed;
  state.campaignId = identifier(query.get('campaign'));
  state.campaignStep = Math.floor(finiteNumber(query.get('step'), 0, 0, 100_000));
  state.storyId = identifier(query.get('story'), false);
  state.storyStep = Math.floor(finiteNumber(query.get('chapter'), 0, 0, 100_000));
  return state;
}

/** No camera rounding: opening a shared URL restores the precise supplied view. */
export function serializeAtlasUrl(state: AtlasState): string {
  const query = new URLSearchParams({
    y: String(state.year), lon: String(state.camera.lon), lat: String(state.camera.lat), z: String(state.camera.zoom),
    bearing: String(state.camera.bearing), pitch: String(state.camera.pitch), lang: state.locale,
    theme: state.theme, projection: state.projection, mode: state.mode, speed: String(state.speed),
  });
  query.set('filters', JSON.stringify(state.filters));
  if (state.selectedEvent) query.set('e', state.selectedEvent);
  if (state.selectedWar) query.set('war', state.selectedWar);
  if (state.selectedEntity) query.set('entity', state.selectedEntity);
  if (state.range) { query.set('from', String(state.range[0])); query.set('to', String(state.range[1])); }
  if (state.trails) query.set('trails', '1');
  if (state.playing) query.set('play', '1');
  if (state.campaignId) { query.set('campaign', state.campaignId); query.set('step', String(state.campaignStep)); }
  if (state.storyId) { query.set('story', state.storyId); query.set('chapter', String(state.storyStep)); }
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
  setLocale: (locale: Locale) => void;
  setTheme: (theme: AtlasState['theme']) => void;
  setProjection: (projection: AtlasState['projection']) => void;
  setMode: (mode: AtlasState['mode']) => void;
  setRange: (range: [number, number] | null) => void;
  setTrails: (trails: boolean) => void;
  setPlaying: (playing: boolean) => void;
  setSpeed: (speed: AtlasState['speed']) => void;
  setCampaign: (id: string | null, step?: number) => void;
  setCampaignStep: (step: number) => void;
  setStory: (id: string | null, step?: number) => void;
  setStoryStep: (step: number) => void;
  patchState: (patch: Partial<AtlasState>) => void;
  hydrateFromUrl: (url: string | URLSearchParams) => void;
  reset: () => void;
}

export const useAtlasStore = create<AtlasState & AtlasActions>()(subscribeWithSelector((set) => ({
  ...createInitialAtlasState(),
  setYear: (year) => set((state) => ({ year: yearNumber(year, state.year) })),
  setCamera: (camera) => set((state) => ({ camera: normalizeCamera(camera, state.camera) })),
  setFilters: (filters) => set((state) => ({ filters: normalizeFilters({ ...state.filters, ...filters }) })),
  resetFilters: () => set({ filters: createInitialAtlasState().filters }),
  selectEvent: (id) => set({ selectedEvent: identifier(id) }),
  selectWar: (id) => set({ selectedWar: identifier(id) }),
  selectEntity: (id) => set({ selectedEntity: identifier(id, false) }),
  setLocale: (locale) => set({ locale }),
  setTheme: (theme) => set({ theme }),
  setProjection: (projection) => set({ projection }),
  setMode: (mode) => set({ mode }),
  setRange: (range) => set({ range: normalizeRange(range) }),
  setTrails: (trails) => set({ trails }),
  setPlaying: (playing) => set({ playing }),
  setSpeed: (speed) => set({ speed }),
  setCampaign: (id, step = 0) => set({ campaignId: identifier(id), campaignStep: Math.max(0, Math.floor(step)) }),
  setCampaignStep: (step) => set({ campaignStep: Math.max(0, Math.floor(step)) }),
  setStory: (id, step = 0) => set({ storyId: identifier(id, false), storyStep: Math.max(0, Math.floor(step)) }),
  setStoryStep: (step) => set({ storyStep: Math.max(0, Math.floor(step)) }),
  patchState: (patch) => set((state) => ({ ...patch,
    ...(patch.year !== undefined ? { year: yearNumber(patch.year, state.year) } : {}),
    ...(patch.camera ? { camera: normalizeCamera(patch.camera, state.camera) } : {}),
    ...(patch.filters ? { filters: normalizeFilters(patch.filters) } : {}),
    ...(patch.range !== undefined ? { range: normalizeRange(patch.range) } : {}),
  })),
  hydrateFromUrl: (url) => set(parseAtlasUrl(url)),
  reset: () => set(createInitialAtlasState()),
})));
