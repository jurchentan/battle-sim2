import { SCHEMA_VERSION, terrainMapSchema, type TerrainMap } from '../../models';

type JsonObject = Record<string, unknown>;

export type TerrainDocumentMigration = (document: JsonObject) => JsonObject;

/**
 * Migration registry keyed by the schema version being migrated from.
 * Add an entry before bumping SCHEMA_VERSION so older files can still be opened.
 */
export const TERRAIN_MIGRATIONS: Readonly<Record<number, TerrainDocumentMigration>> = {};

export type TerrainMigrationResult =
  { ok: true; document: JsonObject } | { ok: false; error: string };

export type TerrainParseResult =
  { ok: true; document: TerrainMap } | { ok: false; error: string; issues?: string[] };

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function migrateTerrainDocument(
  document: JsonObject,
  fromVersion: number,
  migrations: Readonly<Record<number, TerrainDocumentMigration>> = TERRAIN_MIGRATIONS,
): TerrainMigrationResult {
  let current = document;

  for (let version = fromVersion; version < SCHEMA_VERSION; version += 1) {
    const migration = migrations[version];
    if (!migration) {
      return {
        ok: false,
        error: `No migration is available from terrain schema version ${version}.`,
      };
    }

    current = migration(current);
    if (current.schemaVersion !== version + 1) {
      return {
        ok: false,
        error: `The migration from terrain schema version ${version} must set schemaVersion to ${
          version + 1
        }.`,
      };
    }
  }

  return { ok: true, document: current };
}

export function parseTerrainFile(text: string): TerrainParseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text) as unknown;
  } catch {
    return { ok: false, error: 'The terrain file is not valid JSON.' };
  }

  if (!isJsonObject(raw)) {
    return { ok: false, error: 'The terrain file must contain a JSON object.' };
  }

  const schemaVersion = raw.schemaVersion;
  if (typeof schemaVersion !== 'number' || !Number.isInteger(schemaVersion) || schemaVersion < 1) {
    return { ok: false, error: 'The terrain file is missing a valid schemaVersion.' };
  }

  if (schemaVersion > SCHEMA_VERSION) {
    return {
      ok: false,
      error: `Terrain schema version ${schemaVersion} is newer than this app supports (${SCHEMA_VERSION}).`,
    };
  }

  let candidate = raw;
  if (schemaVersion < SCHEMA_VERSION) {
    const migration = migrateTerrainDocument(raw, schemaVersion);
    if (!migration.ok) return migration;
    candidate = migration.document;
  }

  const result = terrainMapSchema.safeParse(candidate);
  if (!result.success) {
    return {
      ok: false,
      error: 'The terrain file failed schema validation.',
      issues: result.error.issues.map((issue) => {
        const path = issue.path.map(String).join('.') || '(root)';
        return `${path}: ${issue.message}`;
      }),
    };
  }

  return { ok: true, document: result.data };
}

export function serializeTerrainFile(document: TerrainMap): string {
  const validated = terrainMapSchema.parse(document);
  return `${JSON.stringify(validated, null, 2)}\n`;
}

export function terrainFileName(document: Pick<TerrainMap, 'name'>): string {
  const base =
    document.name
      .normalize('NFKD')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'terrain-map';

  return `${base}.terrain.json`;
}
