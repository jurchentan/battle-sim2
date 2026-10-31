import { create } from 'zustand';
import { createSeedTerrainMap, type TerrainFeature, type TerrainMap } from '../models';

const HISTORY_LIMIT = 100;

function timestamp(): string {
  return new Date().toISOString();
}

function commit(
  state: TerrainEditorStore,
  nextDocument: TerrainMap,
): Pick<TerrainEditorStore, 'document' | 'past' | 'future'> {
  return {
    document: nextDocument,
    past: [...state.past, state.document].slice(-HISTORY_LIMIT),
    future: [],
  };
}

export interface TerrainEditorStore {
  document: TerrainMap;
  past: TerrainMap[];
  future: TerrainMap[];
  loadDocument: (document: TerrainMap) => void;
  addFeature: (feature: TerrainFeature) => void;
  updateFeature: (featureId: string, update: (feature: TerrainFeature) => TerrainFeature) => void;
  undo: () => void;
  redo: () => void;
}

export const useTerrainStore = create<TerrainEditorStore>()((set) => ({
  document: createSeedTerrainMap(),
  past: [],
  future: [],

  loadDocument: (document) =>
    set({
      document: structuredClone(document),
      past: [],
      future: [],
    }),

  addFeature: (feature) =>
    set((state) => {
      if (state.document.features.some((candidate) => candidate.id === feature.id)) {
        return state;
      }

      return commit(state, {
        ...state.document,
        features: [...state.document.features, feature],
        updatedAt: timestamp(),
      });
    }),

  updateFeature: (featureId, update) =>
    set((state) => {
      const features = state.document.features;
      const index = features.findIndex((feature) => feature.id === featureId);
      if (index === -1) return state;

      const current = features[index];
      if (!current) return state;

      const nextFeature = update(current);
      if (nextFeature === current) return state;

      return commit(state, {
        ...state.document,
        features: features.map((feature, featureIndex) =>
          featureIndex === index ? nextFeature : feature,
        ),
        updatedAt: timestamp(),
      });
    }),

  undo: () =>
    set((state) => {
      const previous = state.past[state.past.length - 1];
      if (!previous) return state;

      return {
        document: previous,
        past: state.past.slice(0, -1),
        future: [state.document, ...state.future],
      };
    }),

  redo: () =>
    set((state) => {
      const next = state.future[0];
      if (!next) return state;

      return {
        document: next,
        past: [...state.past, state.document].slice(-HISTORY_LIMIT),
        future: state.future.slice(1),
      };
    }),
}));
