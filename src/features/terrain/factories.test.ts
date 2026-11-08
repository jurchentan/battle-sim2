import { describe, expect, it } from 'vitest';
import { createSeedTerrainMap, terrainMapSchema } from '../../models';
import {
  AREA_STYLES,
  MARKER_STYLES,
  PATH_STYLES,
  createPointFeature,
  createPolygonFeature,
  createPolylineFeature,
  createTextFeature,
} from './factories';
import { AREA_KINDS, PATH_KINDS, POINT_KINDS } from './kinds';

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

  it('creates every area, path, and point kind with matching styles', () => {
    const map = createSeedTerrainMap();
    const layer = map.layers[0];
    if (!layer) throw new Error('Missing seeded layer');

    const features = [
      ...AREA_KINDS.map((kind) =>
        createPolygonFeature(
          map,
          layer.id,
          [
            { x: 10, y: 10 },
            { x: 40, y: 10 },
            { x: 25, y: 35 },
          ],
          kind,
        ),
      ),
      ...PATH_KINDS.map((kind) =>
        createPolylineFeature(
          map,
          layer.id,
          [
            { x: 50, y: 50 },
            { x: 90, y: 70 },
          ],
          kind,
        ),
      ),
      ...POINT_KINDS.map((kind) => createPointFeature(map, layer.id, { x: 120, y: 120 }, kind)),
    ];

    const result = terrainMapSchema.safeParse({ ...map, features: [...map.features, ...features] });
    expect(result.success).toBe(true);

    for (const feature of features) {
      expect(feature.name).toBeTruthy();
      if (feature.geometry.type === 'polygon') {
        expect(feature.style).toEqual(AREA_STYLES[feature.kind as keyof typeof AREA_STYLES]);
      }
      if (feature.geometry.type === 'polyline') {
        expect(feature.style).toEqual(PATH_STYLES[feature.kind as keyof typeof PATH_STYLES]);
      }
      if (feature.geometry.type === 'point') {
        expect(feature.style).toEqual(MARKER_STYLES[feature.kind as keyof typeof MARKER_STYLES]);
      }
    }
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
