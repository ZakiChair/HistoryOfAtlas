import type { Map as MapInstance } from 'maplibre-gl';
import type { AtlasState } from '@/lib/store';
import { useReligionStore } from '@/lib/religions/store';
import { useEpidemicStore } from '@/lib/epidemics/store';

export interface ThematicOverlay {
  update(state: AtlasState): void;
  isReady(): boolean;
  dispose(): void;
}

export interface ThematicLayer {
  id: string;
  /** The overlay module is imported at the first state where this holds. */
  isActive(state: AtlasState): boolean;
  /** Reports module loading and import failures; a `revision` change asks WorldMap to try again. */
  store: {
    setState(patch: { status: 'loading' | 'error'; error: string | null }): void;
    subscribe(
      listener: (state: { revision: number }, previous: { revision: number }) => void,
    ): () => void;
  };
  load(): Promise<(map: MapInstance) => ThematicOverlay>;
}

/** Thematic overlays WorldMap imports on first activation; each keeps its own store, data and MapLibre layers. */
export const THEMATIC_LAYERS: readonly ThematicLayer[] = [
  {
    id: 'religions',
    isActive: (state) => state.religionsVisible,
    store: useReligionStore,
    load: () => import('./religion-overlay').then((module) => module.startReligionOverlay),
  },
  {
    id: 'epidemics',
    isActive: (state) => state.epidemicsVisible,
    store: useEpidemicStore,
    load: () => import('./epidemic-overlay').then((module) => module.startEpidemicOverlay),
  },
];
