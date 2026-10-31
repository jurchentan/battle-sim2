import { describe, expect, it } from 'vitest';
import { createSeedTerrainMap } from '../models';
import { getOrderedFeatures, isFeatureInteractive, isLayerInteractive } from './layers';

describe('terrain layer ordering', () => {
  it('sorts features by layer z-index and then feature z-index', () => {
    const map = createSeedTerrainMap();
    const ordered = getOrderedFeatures(map);
    const zPairs = ordered.map(({ feature, layer }) => [layer.zIndex, feature.zIndex]);

    const sorted = [...zPairs].sort((a, b) => {
      if (a[0] !== b[0]) return (a[0] ?? 0) - (b[0] ?? 0);
      return (a[1] ?? 0) - (b[1] ?? 0);
    });

    expect(zPairs).toEqual(sorted);
    expect(ordered).toHaveLength(map.features.length);
  });

  it('skips features that reference a missing layer', () => {
    const map = createSeedTerrainMap();
    const feature = map.features[0];
    if (!feature) throw new Error('Missing seeded feature');
    feature.layerId = 'layer-missing';

    expect(getOrderedFeatures(map).some((entry) => entry.feature.id === feature.id)).toBe(false);
  });

  it('reports hidden and locked layers as non-interactive', () => {
    const map = createSeedTerrainMap();
    const layer = map.layers[0];
    const feature = map.features.find((candidate) => candidate.layerId === layer?.id);
    if (!layer || !feature) throw new Error('Missing seeded layer feature');

    expect(isFeatureInteractive(map, feature.id)).toBe(true);

    layer.visible = false;
    expect(isLayerInteractive(layer)).toBe(false);
    expect(isFeatureInteractive(map, feature.id)).toBe(false);

    layer.visible = true;
    layer.locked = true;
    expect(isFeatureInteractive(map, feature.id)).toBe(false);
  });
});
