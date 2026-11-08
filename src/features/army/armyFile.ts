import { armyRosterSchema, SCHEMA_VERSION, type ArmyRoster } from '../../models';
import { inferSmallestUnitEchelon, normalizeRosterDocument } from './rosterDocuments';

type JsonObject = Record<string, unknown>;

export type ArmyDocumentMigration = (document: JsonObject) => JsonObject;

/**
 * Migration registry keyed by the schema version being migrated from.
 * Add an entry before bumping SCHEMA_VERSION so older files can still be opened.
 */
export const ARMY_MIGRATIONS: Readonly<Record<number, ArmyDocumentMigration>> = {};

export type ArmyMigrationResult = { ok: true; document: JsonObject } | { ok: false; error: string };

export type ArmyParseResult =
  { ok: true; document: ArmyRoster } | { ok: false; error: string; issues?: string[] };

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function migrateArmyDocument(
  document: JsonObject,
  fromVersion: number,
  migrations: Readonly<Record<number, ArmyDocumentMigration>> = ARMY_MIGRATIONS,
): ArmyMigrationResult {
  let current = document;

  for (let version = fromVersion; version < SCHEMA_VERSION; version += 1) {
    const migration = migrations[version];
    if (!migration) {
      return {
        ok: false,
        error: `No migration is available from army schema version ${version}.`,
      };
    }

    current = migration(current);
    if (current.schemaVersion !== version + 1) {
      return {
        ok: false,
        error: `The migration from army schema version ${version} must set schemaVersion to ${
          version + 1
        }.`,
      };
    }
  }

  return { ok: true, document: current };
}

export function parseArmyFile(text: string): ArmyParseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text) as unknown;
  } catch {
    return { ok: false, error: 'The army file is not valid JSON.' };
  }

  if (!isJsonObject(raw)) {
    return { ok: false, error: 'The army file must contain a JSON object.' };
  }

  const schemaVersion = raw.schemaVersion;
  if (typeof schemaVersion !== 'number' || !Number.isInteger(schemaVersion) || schemaVersion < 1) {
    return { ok: false, error: 'The army file is missing a valid schemaVersion.' };
  }

  if (schemaVersion > SCHEMA_VERSION) {
    return {
      ok: false,
      error: `Army schema version ${schemaVersion} is newer than this app supports (${SCHEMA_VERSION}).`,
    };
  }

  let candidate = raw;
  if (schemaVersion < SCHEMA_VERSION) {
    const migration = migrateArmyDocument(raw, schemaVersion);
    if (!migration.ok) return migration;
    candidate = migration.document;
  }

  const result = armyRosterSchema.safeParse(candidate);
  if (!result.success) {
    return {
      ok: false,
      error: 'The army file failed schema validation.',
      issues: result.error.issues.map((issue) => {
        const path = issue.path.map(String).join('.') || '(root)';
        return `${path}: ${issue.message}`;
      }),
    };
  }

  const document =
    'smallestUnitEchelon' in candidate
      ? result.data
      : {
          ...result.data,
          smallestUnitEchelon: inferSmallestUnitEchelon(result.data.units),
        };

  return { ok: true, document };
}

export function serializeArmyFile(document: ArmyRoster): string {
  const validated = armyRosterSchema.parse(normalizeRosterDocument(document));
  return `${JSON.stringify(validated, null, 2)}\n`;
}

export function armyFileName(document: Pick<ArmyRoster, 'name'>): string {
  const base =
    document.name
      .normalize('NFKD')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'army-roster';

  return `${base}.army.json`;
}
