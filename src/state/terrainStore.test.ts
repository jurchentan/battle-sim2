import { beforeEach, describe, expect, it } from 'vitest';
import {
  createSeedTerrainMap,
  terrainMapSchema,
  type TerrainFeature,
  type TerrainMap,
} from '../models';
import { useTerrainStore } from './terrainStore';

function resetStore(): void {
  useTerrainStore.getState().loadDocument(createSeedTerrainMap());
}

function makeFeature(id: string, map: TerrainMap): TerrainFeature {
  return {
    id,
    layerId: map.layers[0]?.id ?? 'layer-areas',
    kind: 'field',
    name: 'Test field',
    zIndex: 100,
    geometry: {
      type: 'polygon',
      points: [
        { x: 100, y: 100 },
        { x: 200, y: 100 },
        { x: 150, y: 200 },
      ],
    },
    style: {
      type: 'area',
      fillColor: '#d9c89a',
      strokeColor: '#b9a877',
      strokeWidth: 1.5,
      opacity: 0.5,
      pattern: 'solid',
    },
  };
}

describe('terrain document store', () => {
  beforeEach(resetStore);

  it('adds a feature as one undoable edit', () => {
    const before = useTerrainStore.getState().document;
    const feature = makeFeature('feature-test', before);

    useTerrainStore.getState().addFeature(feature);

    const afterAdd = useTerrainStore.getState();
    expect(afterAdd.document.features).toHaveLength(before.features.length + 1);
    expect(afterAdd.document.features.at(-1)?.id).toBe('feature-test');
    expect(afterAdd.past).toHaveLength(1);
    expect(afterAdd.future).toHaveLength(0);

    useTerrainStore.getState().undo();

    const afterUndo = useTerrainStore.getState();
    expect(afterUndo.document.features).toEqual(before.features);
    expect(afterUndo.document.updatedAt).toBe(before.updatedAt);
    expect(afterUndo.past).toHaveLength(0);
    expect(afterUndo.future).toHaveLength(1);

    useTerrainStore.getState().redo();

    const afterRedo = useTerrainStore.getState();
    expect(afterRedo.document.features.some((candidate) => candidate.id === 'feature-test')).toBe(
      true,
    );
    expect(afterRedo.past).toHaveLength(1);
    expect(afterRedo.future).toHaveLength(0);
  });

  it('records one history entry per committed update', () => {
    const map = useTerrainStore.getState().document;
    const feature = map.features.find((candidate) => candidate.kind === 'forest');
    if (!feature || feature.geometry.type !== 'polygon') {
      throw new Error('Missing seeded forest');
    }
    const beforePoints = structuredClone(feature.geometry.points);

    useTerrainStore.getState().updateFeature(feature.id, (current) => {
      if (current.geometry.type !== 'polygon') return current;
      return {
        ...current,
        geometry: {
          ...current.geometry,
          points: current.geometry.points.map((point) => ({ x: point.x + 25, y: point.y - 10 })),
        },
      };
    });

    const afterMove = useTerrainStore.getState();
    expect(afterMove.past).toHaveLength(1);
    expect(
      afterMove.document.features.find((candidate) => candidate.id === feature.id),
    ).not.toEqual(feature);

    useTerrainStore.getState().undo();

    const restored = useTerrainStore
      .getState()
      .document.features.find((candidate) => candidate.id === feature.id);
    expect(restored?.geometry.type).toBe('polygon');
    if (restored?.geometry.type === 'polygon') {
      expect(restored.geometry.points).toEqual(beforePoints);
    }
  });

  it('ignores updates that return the same feature and keeps document valid', () => {
    const map = useTerrainStore.getState().document;
    const feature = map.features[0];
    if (!feature) throw new Error('Missing seeded feature');

    useTerrainStore.getState().updateFeature(feature.id, (current) => current);

    expect(useTerrainStore.getState().past).toHaveLength(0);
    expect(terrainMapSchema.safeParse(useTerrainStore.getState().document).success).toBe(true);
  });

  it('does nothing when undoing or redoing an empty history', () => {
    const document = useTerrainStore.getState().document;

    useTerrainStore.getState().undo();
    useTerrainStore.getState().redo();

    expect(useTerrainStore.getState().document).toBe(document);
  });

  it('loads a document with a fresh history', () => {
    const map = useTerrainStore.getState().document;
    useTerrainStore.getState().addFeature(makeFeature('feature-history', map));
    expect(useTerrainStore.getState().past).toHaveLength(1);

    const replacement = createSeedTerrainMap();
    replacement.name = 'Replacement map';
    useTerrainStore.getState().loadDocument(replacement);

    const state = useTerrainStore.getState();
    expect(state.document.name).toBe('Replacement map');
    expect(state.past).toHaveLength(0);
    expect(state.future).toHaveLength(0);
    expect(state.document).not.toBe(replacement);
  });
});
