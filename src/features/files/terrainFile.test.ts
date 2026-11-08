import { describe, expect, it } from 'vitest';
import { createSeedTerrainMap, terrainMapSchema } from '../../models';
import {
  migrateTerrainDocument,
  parseTerrainFile,
  serializeTerrainFile,
  terrainFileName,
} from './terrainFile';

describe('terrain file format', () => {
  it('round-trips a terrain map with equivalent semantic data', () => {
    const source = createSeedTerrainMap();
    const result = parseTerrainFile(serializeTerrainFile(source));

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.document).toEqual(source);
    expect(result.document.features).toHaveLength(source.features.length);
    expect(terrainMapSchema.safeParse(result.document).success).toBe(true);
  });

  it('fills missing canvas origins for older version-1 files', () => {
    const {
      originX: _originX,
      originY: _originY,
      originalCanvas: _originalCanvas,
      ...legacy
    } = createSeedTerrainMap();
    const result = parseTerrainFile(JSON.stringify(legacy));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.document.originX).toBe(0);
    expect(result.document.originY).toBe(0);
    expect(result.document.originalCanvas).toBeUndefined();
  });

  it('rejects malformed JSON and non-object payloads', () => {
    expect(parseTerrainFile('{not json')).toMatchObject({
      ok: false,
      error: 'The terrain file is not valid JSON.',
    });
    expect(parseTerrainFile('[]')).toMatchObject({
      ok: false,
      error: 'The terrain file must contain a JSON object.',
    });
    expect(parseTerrainFile('{"name":"missing version"}')).toMatchObject({
      ok: false,
      error: 'The terrain file is missing a valid schemaVersion.',
    });
  });

  it('rejects schema versions newer than the app supports', () => {
    const future = { ...createSeedTerrainMap(), schemaVersion: 99 };
    const result = parseTerrainFile(JSON.stringify(future));

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('newer than this app supports');
    }
  });

  it('reports schema validation issues without throwing', () => {
    const broken = createSeedTerrainMap();
    broken.features[0].layerId = 'missing-layer';

    const result = parseTerrainFile(JSON.stringify(broken));

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('failed schema validation');
      expect(result.issues?.join(' ')).toContain('unknown layer');
    }
  });

  it('runs registered migration hooks in version order', () => {
    const result = migrateTerrainDocument({ schemaVersion: 0, name: 'Legacy' }, 0, {
      0: (document) => ({
        ...document,
        schemaVersion: 1,
        migrated: true,
      }),
    });

    expect(result).toEqual({
      ok: true,
      document: { schemaVersion: 1, name: 'Legacy', migrated: true },
    });
  });

  it('reports missing or incorrect migration hooks', () => {
    expect(migrateTerrainDocument({ schemaVersion: 0 }, 0, {})).toMatchObject({
      ok: false,
      error: 'No migration is available from terrain schema version 0.',
    });

    expect(
      migrateTerrainDocument({ schemaVersion: 0 }, 0, {
        0: (document) => document,
      }),
    ).toMatchObject({
      ok: false,
      error: 'The migration from terrain schema version 0 must set schemaVersion to 1.',
    });
  });

  it('builds safe portable filenames', () => {
    expect(terrainFileName({ name: 'Ashford Ford' })).toBe('ashford-ford.terrain.json');
    expect(terrainFileName({ name: '  ***  ' })).toBe('terrain-map.terrain.json');
  });
});
