import { describe, expect, it } from 'vitest';
import { createSeedTerrainMap, terrainMapSchema } from '../../models';
import {
  copyName,
  createBlankTerrainMap,
  duplicateTerrainMap,
  uniqueName,
} from './terrainDocuments';

describe('terrain document helpers', () => {
  it('creates a valid blank terrain map with default layers', () => {
    const document = createBlankTerrainMap('New map');

    expect(terrainMapSchema.safeParse(document).success).toBe(true);
    expect(document.name).toBe('New map');
    expect(document.width).toBe(2000);
    expect(document.height).toBe(1400);
    expect(document.originX).toBe(0);
    expect(document.originY).toBe(0);
    expect(document.originalCanvas).toEqual({
      width: 2000,
      height: 1400,
      originX: 0,
      originY: 0,
    });
    expect(document.features).toEqual([]);
    expect(document.layers).toHaveLength(3);
    expect(new Set(document.layers.map((layer) => layer.id)).size).toBe(3);
  });

  it('creates blank maps with an explicit starting size', () => {
    const document = createBlankTerrainMap('Wide map', { width: 3000, height: 1800 });

    expect(document.width).toBe(3000);
    expect(document.height).toBe(1800);
    expect(document.originalCanvas).toEqual({
      width: 3000,
      height: 1800,
      originX: 0,
      originY: 0,
    });
    expect(terrainMapSchema.safeParse(document).success).toBe(true);
  });

  it('defaults missing canvas origins to zero for older documents', () => {
    const { originX: _originX, originY: _originY, ...legacy } = createSeedTerrainMap();
    const parsed = terrainMapSchema.parse(legacy);

    expect(parsed.originX).toBe(0);
    expect(parsed.originY).toBe(0);
  });

  it('resolves unique names with numeric suffixes', () => {
    expect(uniqueName('Untitled terrain', [])).toBe('Untitled terrain');
    expect(uniqueName('Untitled terrain', ['Untitled terrain'])).toBe('Untitled terrain 2');
    expect(uniqueName('Untitled terrain', ['Untitled terrain', 'Untitled terrain 2'])).toBe(
      'Untitled terrain 3',
    );
    expect(copyName('Ashford Ford', ['Ashford Ford'])).toBe('Ashford Ford copy');
    expect(copyName('Ashford Ford', ['Ashford Ford copy'])).toBe('Ashford Ford copy 2');
  });

  it('duplicates a map with a new identity and fully independent data', () => {
    const source = createSeedTerrainMap();
    const duplicate = duplicateTerrainMap(source, 'Ashford Ford copy');

    expect(duplicate.id).not.toBe(source.id);
    expect(duplicate.name).toBe('Ashford Ford copy');
    expect(duplicate.layers).toEqual(source.layers);
    expect(duplicate.features).toEqual(source.features);
    expect(duplicate.layers).not.toBe(source.layers);
    expect(duplicate.features).not.toBe(source.features);
    expect(terrainMapSchema.safeParse(duplicate).success).toBe(true);

    const sourceForest = source.features.find((feature) => feature.kind === 'forest');
    const duplicateForest = duplicate.features.find((feature) => feature.kind === 'forest');
    if (sourceForest?.geometry.type !== 'polygon') throw new Error('Missing source forest');
    if (duplicateForest?.geometry.type !== 'polygon') throw new Error('Missing duplicate forest');

    sourceForest.geometry.points[0].x = 9999;
    expect(duplicateForest.geometry.points[0].x).not.toBe(9999);
  });
});
