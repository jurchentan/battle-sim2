import {
  createId,
  DEFAULT_TERRAIN_HEIGHT,
  DEFAULT_TERRAIN_WIDTH,
  SCHEMA_VERSION,
  type TerrainLayer,
  type TerrainMap,
} from '../../models';

export { copyName, uniqueName } from './documentNames';

const DEFAULT_LAYERS: readonly Omit<TerrainLayer, 'id'>[] = [
  { name: 'Areas', visible: true, locked: false, zIndex: 0 },
  { name: 'Paths and water', visible: true, locked: false, zIndex: 10 },
  { name: 'Detail and labels', visible: true, locked: false, zIndex: 20 },
];

function timestamp(): string {
  return new Date().toISOString();
}

export function normalizeTerrainMap(document: TerrainMap): TerrainMap {
  return {
    ...document,
    originX: Number.isFinite(document.originX) ? document.originX : 0,
    originY: Number.isFinite(document.originY) ? document.originY : 0,
  };
}

export function createBlankTerrainMap(
  name = 'Untitled terrain',
  size: { width?: number; height?: number } = {},
): TerrainMap {
  const now = timestamp();

  return {
    schemaVersion: SCHEMA_VERSION,
    id: createId(),
    name,
    width: size.width ?? DEFAULT_TERRAIN_WIDTH,
    height: size.height ?? DEFAULT_TERRAIN_HEIGHT,
    originX: 0,
    originY: 0,
    originalCanvas: {
      width: size.width ?? DEFAULT_TERRAIN_WIDTH,
      height: size.height ?? DEFAULT_TERRAIN_HEIGHT,
      originX: 0,
      originY: 0,
    },
    backgroundStyle: 'aged-paper',
    layers: DEFAULT_LAYERS.map((layer) => ({ ...layer, id: createId() })),
    features: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function duplicateTerrainMap(source: TerrainMap, name: string): TerrainMap {
  const now = timestamp();
  return {
    ...normalizeTerrainMap(structuredClone(source)),
    id: createId(),
    name,
    createdAt: now,
    updatedAt: now,
  };
}
