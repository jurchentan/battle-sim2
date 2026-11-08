import Dexie, { type Table } from 'dexie';
import type { TerrainMap } from '../../models';

export class TerrainLibraryDatabase extends Dexie {
  terrainMaps!: Table<TerrainMap, string>;

  constructor() {
    super('battle-map-editor');
    this.version(1).stores({
      terrainMaps: 'id, name, updatedAt',
    });
  }
}

let database: TerrainLibraryDatabase | null = null;

export function terrainLibraryDb(): TerrainLibraryDatabase {
  database ??= new TerrainLibraryDatabase();
  return database;
}

export async function listTerrainMapRecords(): Promise<TerrainMap[]> {
  return terrainLibraryDb().terrainMaps.orderBy('updatedAt').reverse().toArray();
}

export async function getTerrainMapRecord(id: string): Promise<TerrainMap | undefined> {
  return terrainLibraryDb().terrainMaps.get(id);
}

export async function putTerrainMapRecord(document: TerrainMap): Promise<void> {
  await terrainLibraryDb().terrainMaps.put(document);
}

export async function deleteTerrainMapRecord(id: string): Promise<void> {
  await terrainLibraryDb().terrainMaps.delete(id);
}
