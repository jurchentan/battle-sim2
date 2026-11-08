import type { TerrainFeatureKind } from '../../models';

export const AREA_KINDS = ['forest', 'field', 'lake', 'swamp'] as const;
export type AreaKind = (typeof AREA_KINDS)[number];

export const PATH_KINDS = ['river', 'road', 'contour', 'customPath'] as const;
export type PathKind = (typeof PATH_KINDS)[number];

export const POINT_KINDS = ['building', 'bridge', 'fortification'] as const;
export type PointKind = (typeof POINT_KINDS)[number];

export type DrawKind = AreaKind | PathKind;

export const FEATURE_KIND_LABELS: Record<TerrainFeatureKind, string> = {
  forest: 'Forest',
  field: 'Field',
  river: 'River',
  road: 'Road',
  contour: 'Contour',
  lake: 'Lake',
  swamp: 'Swamp',
  building: 'Building',
  bridge: 'Bridge',
  fortification: 'Fortification',
  label: 'Label',
  customPath: 'Custom path',
};

export function isAreaKind(kind: string): kind is AreaKind {
  return (AREA_KINDS as readonly string[]).includes(kind);
}

export function isPathKind(kind: string): kind is PathKind {
  return (PATH_KINDS as readonly string[]).includes(kind);
}

export function isPointKind(kind: string): kind is PointKind {
  return (POINT_KINDS as readonly string[]).includes(kind);
}

export function isDrawKind(kind: string): kind is DrawKind {
  return isAreaKind(kind) || isPathKind(kind);
}
