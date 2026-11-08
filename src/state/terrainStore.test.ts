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

  it('deletes a feature as one undoable edit', () => {
    const map = useTerrainStore.getState().document;
    const feature = map.features.find((candidate) => candidate.kind === 'forest');
    if (!feature) throw new Error('Missing seeded forest');

    useTerrainStore.getState().deleteFeature(feature.id);

    const afterDelete = useTerrainStore.getState();
    expect(afterDelete.document.features.some((candidate) => candidate.id === feature.id)).toBe(
      false,
    );
    expect(afterDelete.past).toHaveLength(1);

    useTerrainStore.getState().undo();

    expect(
      useTerrainStore.getState().document.features.some((candidate) => candidate.id === feature.id),
    ).toBe(true);
  });

  it('duplicates a feature with a new id, offset geometry, and top z-index', () => {
    const map = useTerrainStore.getState().document;
    const feature = map.features.find((candidate) => candidate.kind === 'forest');
    if (!feature || feature.geometry.type !== 'polygon') {
      throw new Error('Missing seeded forest');
    }
    const highestZ = Math.max(...map.features.map((candidate) => candidate.zIndex));

    const duplicateId = useTerrainStore.getState().duplicateFeature(feature.id);

    const state = useTerrainStore.getState();
    const duplicate = state.document.features.find((candidate) => candidate.id === duplicateId);
    expect(duplicateId).not.toBe(feature.id);
    expect(duplicate).toBeDefined();
    expect(duplicate?.zIndex).toBe(highestZ + 1);
    expect(duplicate?.name).toContain('copy');
    expect(state.past).toHaveLength(1);

    if (duplicate?.geometry.type === 'polygon') {
      expect(duplicate.geometry.points[0]).toEqual({
        x: feature.geometry.points[0].x + 24,
        y: feature.geometry.points[0].y + 24,
      });
    }
  });

  it('moves a feature through the z-order of its layer', () => {
    const map = useTerrainStore.getState().document;
    const layer = map.layers.find((candidate) => candidate.id === 'layer-areas');
    if (!layer) throw new Error('Missing seeded area layer');
    const siblings = map.features
      .filter((candidate) => candidate.layerId === layer.id)
      .sort((a, b) => a.zIndex - b.zIndex || a.id.localeCompare(b.id));
    const first = siblings[0];
    if (!first) throw new Error('Missing seeded area feature');

    useTerrainStore.getState().moveFeature(first.id, 'front');

    const afterMove = useTerrainStore
      .getState()
      .document.features.filter((candidate) => candidate.layerId === layer.id)
      .sort((a, b) => a.zIndex - b.zIndex || a.id.localeCompare(b.id));
    expect(afterMove.at(-1)?.id).toBe(first.id);
    expect(useTerrainStore.getState().past).toHaveLength(1);

    useTerrainStore.getState().undo();

    const restored = useTerrainStore
      .getState()
      .document.features.filter((candidate) => candidate.layerId === layer.id)
      .sort((a, b) => a.zIndex - b.zIndex || a.id.localeCompare(b.id));
    expect(restored[0]?.id).toBe(first.id);
  });

  it('rejects edits and additions while the target layer is hidden or locked', () => {
    const map = useTerrainStore.getState().document;
    const layer = map.layers[0];
    if (!layer) throw new Error('Missing seeded layer');
    const feature = map.features.find((candidate) => candidate.layerId === layer.id);
    if (!feature) throw new Error('Missing seeded layer feature');

    useTerrainStore.getState().setLayerVisible(layer.id, false);
    const hiddenDocument = useTerrainStore.getState().document;
    useTerrainStore.getState().updateFeature(feature.id, (current) => ({
      ...current,
      name: 'Should not apply',
    }));
    expect(useTerrainStore.getState().document).toBe(hiddenDocument);

    useTerrainStore.getState().setLayerVisible(layer.id, true);
    useTerrainStore.getState().setLayerLocked(layer.id, true);
    const lockedDocument = useTerrainStore.getState().document;
    useTerrainStore.getState().addFeature(makeFeature('feature-locked', lockedDocument));
    expect(useTerrainStore.getState().document).toBe(lockedDocument);
    expect(
      useTerrainStore
        .getState()
        .document.features.some((candidate) => candidate.id === 'feature-locked'),
    ).toBe(false);
  });

  it('reorders layers and keeps feature references intact', () => {
    const map = useTerrainStore.getState().document;
    const sorted = [...map.layers].sort((a, b) => a.zIndex - b.zIndex);
    const top = sorted.at(-1);
    if (!top) throw new Error('Missing seeded top layer');

    const before = sorted.map((layer) => layer.id);
    useTerrainStore.getState().moveLayer(top.id, 'backward');

    const layers = [...useTerrainStore.getState().document.layers].sort(
      (a, b) => a.zIndex - b.zIndex,
    );
    const after = layers.map((layer) => layer.id);
    expect(after).not.toEqual(before);
    expect(after.indexOf(top.id)).toBe(before.indexOf(top.id) - 1);
    expect(terrainMapSchema.safeParse(useTerrainStore.getState().document).success).toBe(true);

    useTerrainStore.getState().undo();

    const restored = [...useTerrainStore.getState().document.layers].sort(
      (a, b) => a.zIndex - b.zIndex,
    );
    expect(restored.map((layer) => layer.id)).toEqual(before);
  });
});
