import type { ArmyRoster, TerrainMap } from '../../models';
import { armyFileName, serializeArmyFile } from '../army/armyFile';
import { serializeTerrainFile, terrainFileName } from './terrainFile';

export function downloadTextFile(filename: string, contents: string): void {
  const blob = new Blob([contents], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.rel = 'noopener';
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadTerrainFile(document: TerrainMap): void {
  downloadTextFile(terrainFileName(document), serializeTerrainFile(document));
}

export function downloadArmyFile(document: ArmyRoster): void {
  downloadTextFile(armyFileName(document), serializeArmyFile(document));
}
