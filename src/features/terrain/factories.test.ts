import { describe, expect, it } from 'vitest';
import { createSeedTerrainMap, terrainMapSchema } from '../../models';
import { createPolygonFeature, createPolylineFeature, createTextFeature } from './factories';

describe('terrain feature factories', () => {
  it('creates schema-valid polygon, polyline, and text features', () => {
    const map = createSeedTerrainMap();
    const layer = map.layers[0];
    if (!layer) throw new Error('Missing seeded layer');

    const polygon = createPolygonFeature(map, layer.id, [
      { x: 10, y: 10 },
      { x: 30, y: 10 },
      { x: 20, y: 30 },
    ]);
    const polyline = createPolylineFeature(map, layer.id, [
      { x: 40, y: 40 },
      { x: 65, y: 55 },
    ]);
    const text = createTextFeature(map, layer.id, { x: 80, y: 90 });

    const document = {
      ...map,
      features: [...map.features, polygon, polyline, text],
    };

    expect(terrainMapSchema.safeParse(document).success).toBe(true);
    expect(polygon.geometry.type).toBe('polygon');
    expect(polyline.geometry.type).toBe('polyline');
    expect(text.geometry.type).toBe('textAnchor');
    expect(text.kind).toBe('label');
  });

  it('assigns an increasing z-index and readable names', () => {
    const map = createSeedTerrainMap();
    const layer = map.layers[0];
    if (!layer) throw new Error('Missing seeded layer');
    const highest = Math.max(...map.features.map((feature) => feature.zIndex));

    const first = createPolygonFeature(map, layer.id, [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 5, y: 10 },
    ]);

    const nextMap = { ...map, features: [...map.features, first] };
    const second = createPolygonFeature(nextMap, layer.id, [
      { x: 20, y: 20 },
      { x: 30, y: 20 },
      { x: 25, y: 30 },
    ]);

    expect(first.zIndex).toBe(highest + 1);
    expect(second.zIndex).toBe(highest + 2);
    expect(first.name).toMatch(/^Field \d+$/);
    expect(second.name).not.toBe(first.name);
  });
});
