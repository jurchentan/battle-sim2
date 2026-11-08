import Dexie, { type Table } from 'dexie';
import type { ArmyRoster, TerrainMap } from '../../models';

export class BattleLibraryDatabase extends Dexie {
  terrainMaps!: Table<TerrainMap, string>;
  armyRosters!: Table<ArmyRoster, string>;

  constructor() {
    super('battle-map-editor');
    this.version(1).stores({
      terrainMaps: 'id, name, updatedAt',
    });
    this.version(2).stores({
      terrainMaps: 'id, name, updatedAt',
      armyRosters: 'id, name, updatedAt',
    });
    this.version(3).stores({
      terrainMaps: 'id, name, updatedAt',
      armyRosters: 'id, name, updatedAt',
      unitPresets: 'id, name, updatedAt',
    });
    this.version(4).stores({
      terrainMaps: 'id, name, updatedAt',
      armyRosters: 'id, name, updatedAt',
    });
  }
}

let database: BattleLibraryDatabase | null = null;

export function battleLibraryDb(): BattleLibraryDatabase {
  database ??= new BattleLibraryDatabase();
  return database;
}

/** @deprecated Prefer battleLibraryDb for shared library access. */
export function terrainLibraryDb(): BattleLibraryDatabase {
  return battleLibraryDb();
}

export async function listTerrainMapRecords(): Promise<TerrainMap[]> {
  return battleLibraryDb().terrainMaps.orderBy('updatedAt').reverse().toArray();
}

export async function getTerrainMapRecord(id: string): Promise<TerrainMap | undefined> {
  return battleLibraryDb().terrainMaps.get(id);
}

export async function putTerrainMapRecord(document: TerrainMap): Promise<void> {
  await battleLibraryDb().terrainMaps.put(document);
}

export async function deleteTerrainMapRecord(id: string): Promise<void> {
  await battleLibraryDb().terrainMaps.delete(id);
}
