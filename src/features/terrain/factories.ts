import {
  createId,
  type AreaStyle,
  type PathStyle,
  type Point,
  type TerrainFeature,
  type TerrainMap,
  type TextStyle,
} from '../../models';

export const FIELD_STYLE: AreaStyle = {
  type: 'area',
  fillColor: '#d9c89a',
  strokeColor: '#b9a877',
  strokeWidth: 1.5,
  opacity: 0.5,
  pattern: 'solid',
};

export const PATH_STYLE: PathStyle = {
  type: 'path',
  strokeColor: '#7a6a4f',
  strokeWidth: 3,
  opacity: 0.9,
  dash: [],
  lineCap: 'round',
};

export const LABEL_STYLE: TextStyle = {
  type: 'text',
  textColor: '#3c3428',
  fontSize: 28,
  fontFamily: 'Georgia, serif',
};

export function nextFeatureZIndex(map: TerrainMap): number {
  return map.features.reduce((highest, feature) => Math.max(highest, feature.zIndex), 0) + 1;
}

function nextFeatureName(map: TerrainMap, kind: TerrainFeature['kind'], base: string): string {
  const count = map.features.filter((feature) => feature.kind === kind).length;
  return `${base} ${count + 1}`;
}

export function createPolygonFeature(
  map: TerrainMap,
  layerId: string,
  points: readonly Point[],
): TerrainFeature {
  return {
    id: createId(),
    layerId,
    kind: 'field',
    name: nextFeatureName(map, 'field', 'Field'),
    zIndex: nextFeatureZIndex(map),
    geometry: {
      type: 'polygon',
      points: points.map((point) => ({ ...point })),
    },
    style: { ...FIELD_STYLE },
  };
}

export function createPolylineFeature(
  map: TerrainMap,
  layerId: string,
  points: readonly Point[],
): TerrainFeature {
  return {
    id: createId(),
    layerId,
    kind: 'customPath',
    name: nextFeatureName(map, 'customPath', 'Path'),
    zIndex: nextFeatureZIndex(map),
    geometry: {
      type: 'polyline',
      points: points.map((point) => ({ ...point })),
    },
    style: { ...PATH_STYLE, dash: [...PATH_STYLE.dash] },
  };
}

export function createTextFeature(
  map: TerrainMap,
  layerId: string,
  position: Point,
): TerrainFeature {
  return {
    id: createId(),
    layerId,
    kind: 'label',
    name: nextFeatureName(map, 'label', 'Label'),
    zIndex: nextFeatureZIndex(map),
    geometry: {
      type: 'textAnchor',
      position: { ...position },
      rotationDegrees: 0,
    },
    style: { ...LABEL_STYLE },
  };
}
