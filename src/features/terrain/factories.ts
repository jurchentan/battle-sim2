import {
  createId,
  type AreaStyle,
  type MarkerStyle,
  type PathStyle,
  type Point,
  type TerrainFeature,
  type TerrainMap,
  type TextStyle,
} from '../../models';
import { FEATURE_KIND_LABELS, type AreaKind, type PathKind, type PointKind } from './kinds';

export const AREA_STYLES: Record<AreaKind, AreaStyle> = {
  forest: {
    type: 'area',
    fillColor: '#7d8f6a',
    strokeColor: '#5e6f4d',
    strokeWidth: 2,
    opacity: 0.55,
    pattern: 'hatch-left',
  },
  field: {
    type: 'area',
    fillColor: '#d9c89a',
    strokeColor: '#b9a877',
    strokeWidth: 1.5,
    opacity: 0.5,
    pattern: 'solid',
  },
  lake: {
    type: 'area',
    fillColor: '#a9c3cb',
    strokeColor: '#7e9aa1',
    strokeWidth: 2,
    opacity: 0.7,
    pattern: 'solid',
  },
  swamp: {
    type: 'area',
    fillColor: '#a7b38f',
    strokeColor: '#7b8a68',
    strokeWidth: 1.5,
    opacity: 0.55,
    pattern: 'dots',
  },
};

export const PATH_STYLES: Record<PathKind, PathStyle> = {
  river: {
    type: 'path',
    strokeColor: '#7e9aa1',
    strokeWidth: 6,
    opacity: 0.85,
    dash: [],
    lineCap: 'round',
  },
  road: {
    type: 'path',
    strokeColor: '#b3a17c',
    strokeWidth: 4,
    opacity: 0.9,
    dash: [],
    lineCap: 'round',
  },
  contour: {
    type: 'path',
    strokeColor: '#8c8474',
    strokeWidth: 1.2,
    opacity: 0.7,
    dash: [6, 4],
    lineCap: 'round',
  },
  customPath: {
    type: 'path',
    strokeColor: '#7a6a4f',
    strokeWidth: 3,
    opacity: 0.9,
    dash: [],
    lineCap: 'round',
  },
};

export const MARKER_STYLES: Record<PointKind, MarkerStyle> = {
  building: {
    type: 'marker',
    fillColor: '#c9b79a',
    strokeColor: '#5c4a35',
    strokeWidth: 1.5,
  },
  bridge: {
    type: 'marker',
    fillColor: '#8b7355',
    strokeColor: '#4f4230',
    strokeWidth: 1.5,
  },
  fortification: {
    type: 'marker',
    fillColor: '#b7a27c',
    strokeColor: '#4f4230',
    strokeWidth: 1.5,
  },
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

function nextFeatureName(map: TerrainMap, kind: TerrainFeature['kind']): string {
  const count = map.features.filter((feature) => feature.kind === kind).length;
  return `${FEATURE_KIND_LABELS[kind]} ${count + 1}`;
}

function copyPoints(points: readonly Point[]): Point[] {
  return points.map((point) => ({ ...point }));
}

export function createPolygonFeature(
  map: TerrainMap,
  layerId: string,
  points: readonly Point[],
  kind: AreaKind = 'field',
): TerrainFeature {
  return {
    id: createId(),
    layerId,
    kind,
    name: nextFeatureName(map, kind),
    zIndex: nextFeatureZIndex(map),
    geometry: {
      type: 'polygon',
      points: copyPoints(points),
    },
    style: structuredClone(AREA_STYLES[kind]),
  };
}

export function createPolylineFeature(
  map: TerrainMap,
  layerId: string,
  points: readonly Point[],
  kind: PathKind = 'customPath',
): TerrainFeature {
  return {
    id: createId(),
    layerId,
    kind,
    name: nextFeatureName(map, kind),
    zIndex: nextFeatureZIndex(map),
    geometry: {
      type: 'polyline',
      points: copyPoints(points),
    },
    style: structuredClone(PATH_STYLES[kind]),
  };
}

export function createPointFeature(
  map: TerrainMap,
  layerId: string,
  position: Point,
  kind: PointKind,
): TerrainFeature {
  return {
    id: createId(),
    layerId,
    kind,
    name: nextFeatureName(map, kind),
    zIndex: nextFeatureZIndex(map),
    geometry: {
      type: 'point',
      position: { ...position },
    },
    style: structuredClone(MARKER_STYLES[kind]),
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
    name: nextFeatureName(map, 'label'),
    zIndex: nextFeatureZIndex(map),
    geometry: {
      type: 'textAnchor',
      position: { ...position },
      rotationDegrees: 0,
    },
    style: structuredClone(LABEL_STYLE),
  };
}
