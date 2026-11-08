import { create } from 'zustand';
import {
  createId,
  createSeedTerrainMap,
  type TerrainFeature,
  type TerrainGeometry,
  type TerrainLayer,
  type TerrainMap,
} from '../models';

const HISTORY_LIMIT = 100;
const DUPLICATE_OFFSET = 24;

export type FeatureMove = 'forward' | 'backward' | 'front' | 'back';
export type LayerMove = 'forward' | 'backward';

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

function findLayer(document: TerrainMap, feature: TerrainFeature): TerrainLayer | undefined {
  return document.layers.find((layer) => layer.id === feature.layerId);
}

function isFeatureEditable(document: TerrainMap, feature: TerrainFeature): boolean {
  const layer = findLayer(document, feature);
  return layer !== undefined && layer.visible && !layer.locked;
}

function findFeature(document: TerrainMap, featureId: string): TerrainFeature | undefined {
  return document.features.find((feature) => feature.id === featureId);
}

function offsetGeometry(geometry: TerrainGeometry): TerrainGeometry {
  switch (geometry.type) {
    case 'polygon':
    case 'polyline':
      return {
        ...geometry,
        points: geometry.points.map((point) => ({
          x: point.x + DUPLICATE_OFFSET,
          y: point.y + DUPLICATE_OFFSET,
        })),
      };
    case 'point':
    case 'textAnchor':
      return {
        ...geometry,
        position: {
          x: geometry.position.x + DUPLICATE_OFFSET,
          y: geometry.position.y + DUPLICATE_OFFSET,
        },
      };
  }
}

function reorderByIds<T extends { id: string }>(
  items: readonly T[],
  orderedIds: readonly string[],
): T[] {
  const byId = new Map(items.map((item) => [item.id, item] as const));
  return orderedIds.map((id) => byId.get(id)).filter((item): item is T => item !== undefined);
}

function nextZIndex(document: TerrainMap): number {
  return document.features.reduce((highest, feature) => Math.max(highest, feature.zIndex), 0) + 1;
}

export interface TerrainEditorStore {
  document: TerrainMap;
  past: TerrainMap[];
  future: TerrainMap[];
  loadDocument: (document: TerrainMap) => void;
  addFeature: (feature: TerrainFeature) => void;
  updateFeature: (featureId: string, update: (feature: TerrainFeature) => TerrainFeature) => void;
  deleteFeature: (featureId: string) => void;
  duplicateFeature: (featureId: string) => string | null;
  moveFeature: (featureId: string, direction: FeatureMove) => void;
  setLayerVisible: (layerId: string, visible: boolean) => void;
  setLayerLocked: (layerId: string, locked: boolean) => void;
  moveLayer: (layerId: string, direction: LayerMove) => void;
  undo: () => void;
  redo: () => void;
}

export const useTerrainStore = create<TerrainEditorStore>()((set, get) => ({
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
      const layer = state.document.layers.find((candidate) => candidate.id === feature.layerId);
      if (!layer || !layer.visible || layer.locked) return state;

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
      if (!current || !isFeatureEditable(state.document, current)) return state;

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

  deleteFeature: (featureId) =>
    set((state) => {
      const feature = findFeature(state.document, featureId);
      if (!feature || !isFeatureEditable(state.document, feature)) return state;

      return commit(state, {
        ...state.document,
        features: state.document.features.filter((candidate) => candidate.id !== featureId),
        updatedAt: timestamp(),
      });
    }),

  duplicateFeature: (featureId) => {
    const state = get();
    const source = findFeature(state.document, featureId);
    if (!source || !isFeatureEditable(state.document, source)) return null;

    const duplicate: TerrainFeature = {
      ...structuredClone(source),
      id: createId(),
      name: source.name ? `${source.name} copy` : undefined,
      geometry: offsetGeometry(source.geometry),
      zIndex: nextZIndex(state.document),
    };

    set(
      commit(state, {
        ...state.document,
        features: [...state.document.features, duplicate],
        updatedAt: timestamp(),
      }),
    );
    return duplicate.id;
  },

  moveFeature: (featureId, direction) =>
    set((state) => {
      const feature = findFeature(state.document, featureId);
      if (!feature || !isFeatureEditable(state.document, feature)) return state;

      const siblings = state.document.features
        .filter((candidate) => candidate.layerId === feature.layerId)
        .sort((a, b) => a.zIndex - b.zIndex || a.id.localeCompare(b.id));
      const index = siblings.findIndex((candidate) => candidate.id === featureId);
      if (index === -1) return state;

      const targetIndex =
        direction === 'front'
          ? siblings.length - 1
          : direction === 'back'
            ? 0
            : direction === 'forward'
              ? index + 1
              : index - 1;

      if (targetIndex < 0 || targetIndex >= siblings.length || targetIndex === index) {
        return state;
      }

      const reordered = [...siblings];
      const [moved] = reordered.splice(index, 1);
      if (!moved) return state;
      reordered.splice(targetIndex, 0, moved);

      const zById = new Map(reordered.map((candidate, order) => [candidate.id, order] as const));
      const features = state.document.features.map((candidate) => {
        const zIndex = zById.get(candidate.id);
        return zIndex === undefined ? candidate : { ...candidate, zIndex };
      });

      return commit(state, {
        ...state.document,
        features,
        updatedAt: timestamp(),
      });
    }),

  setLayerVisible: (layerId, visible) =>
    set((state) => {
      const layer = state.document.layers.find((candidate) => candidate.id === layerId);
      if (!layer || layer.visible === visible) return state;

      return commit(state, {
        ...state.document,
        layers: state.document.layers.map((candidate) =>
          candidate.id === layerId ? { ...candidate, visible } : candidate,
        ),
        updatedAt: timestamp(),
      });
    }),

  setLayerLocked: (layerId, locked) =>
    set((state) => {
      const layer = state.document.layers.find((candidate) => candidate.id === layerId);
      if (!layer || layer.locked === locked) return state;

      return commit(state, {
        ...state.document,
        layers: state.document.layers.map((candidate) =>
          candidate.id === layerId ? { ...candidate, locked } : candidate,
        ),
        updatedAt: timestamp(),
      });
    }),

  moveLayer: (layerId, direction) =>
    set((state) => {
      const sorted = [...state.document.layers].sort(
        (a, b) => a.zIndex - b.zIndex || a.id.localeCompare(b.id),
      );
      const index = sorted.findIndex((layer) => layer.id === layerId);
      if (index === -1) return state;

      const targetIndex = direction === 'forward' ? index + 1 : index - 1;
      if (targetIndex < 0 || targetIndex >= sorted.length) return state;

      const reordered = [...sorted];
      const [moved] = reordered.splice(index, 1);
      if (!moved) return state;
      reordered.splice(targetIndex, 0, moved);

      const orderedIds = reordered.map((layer) => layer.id);
      const layers = reorderByIds(
        state.document.layers.map((layer) => ({
          ...layer,
          zIndex: orderedIds.indexOf(layer.id) * 10,
        })),
        orderedIds,
      );

      return commit(state, {
        ...state.document,
        layers,
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
