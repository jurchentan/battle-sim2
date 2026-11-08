import type { ArmyRoster } from '../../models';
import { battleLibraryDb } from '../library/terrainLibraryDb';
import { normalizeRosterDocument } from './rosterDocuments';

export async function listRosterRecords(): Promise<ArmyRoster[]> {
  const records = await battleLibraryDb().armyRosters.orderBy('updatedAt').reverse().toArray();
  return records.map(normalizeRosterDocument);
}

export async function getRosterRecord(id: string): Promise<ArmyRoster | undefined> {
  const record = await battleLibraryDb().armyRosters.get(id);
  return record ? normalizeRosterDocument(record) : undefined;
}

export async function putRosterRecord(document: ArmyRoster): Promise<void> {
  await battleLibraryDb().armyRosters.put(normalizeRosterDocument(document));
}

export async function deleteRosterRecord(id: string): Promise<void> {
  await battleLibraryDb().armyRosters.delete(id);
}
