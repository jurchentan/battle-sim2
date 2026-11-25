import { legacyEchelonCount, type ArmyRoster } from '../../models';
import { battleLibraryDb } from '../library/terrainLibraryDb';
import { normalizeRosterDocument } from './rosterDocuments';

let pendingMigrationCount = 0;

/** Returns and clears the number of legacy echelons migrated since the last call. */
export function takeRosterMigrationCount(): number {
  const count = pendingMigrationCount;
  pendingMigrationCount = 0;
  return count;
}

function migrateRecord(record: ArmyRoster): { document: ArmyRoster; migrated: boolean } {
  const count = legacyEchelonCount(record);
  pendingMigrationCount += count;
  return { document: normalizeRosterDocument(record), migrated: count > 0 };
}

export async function listRosterRecords(): Promise<ArmyRoster[]> {
  const table = battleLibraryDb().armyRosters;
  const records = await table.orderBy('updatedAt').reverse().toArray();
  const migrated: ArmyRoster[] = [];

  const documents = records.map((record) => {
    const result = migrateRecord(record);
    if (result.migrated) migrated.push(result.document);
    return result.document;
  });

  if (migrated.length > 0) {
    await table.bulkPut(migrated);
  }

  return documents;
}

export async function getRosterRecord(id: string): Promise<ArmyRoster | undefined> {
  const table = battleLibraryDb().armyRosters;
  const record = await table.get(id);
  if (!record) return undefined;

  const result = migrateRecord(record);
  if (result.migrated) {
    await table.put(result.document);
  }
  return result.document;
}

export async function putRosterRecord(document: ArmyRoster): Promise<void> {
  await battleLibraryDb().armyRosters.put(normalizeRosterDocument(document));
}

export async function deleteRosterRecord(id: string): Promise<void> {
  await battleLibraryDb().armyRosters.delete(id);
}
