import type { ArmyRoster, Point, UnitDefinition, UnitEchelon, UnitPhaseState } from '../../models';
import {
  descendantUnitIds,
  effectiveUnitStrength,
  findUnit,
  unitChildren,
} from '../army/rosterDocuments';
import {
  defaultFrontageLength,
  defaultUnitPhaseState,
  renderedFrontageLength,
  type FormationFrontages,
} from './scenarioDocuments';

/** A battle line shorter than this is treated as an accidental click. */
export const BATTLE_LINE_MIN_LENGTH = 8;

/** How far behind its brigade group each deployed command label sits. */
export const BATTLE_LINE_COMMAND_OFFSETS: Record<'division' | 'corps' | 'army', number> = {
  division: 120,
  corps: 240,
  army: 360,
};

export interface BattleLineGroup {
  /** The division (or fallback parent) that keeps these brigades together. */
  key: string;
  ancestorUnitId: string | null;
  brigadeIds: string[];
}

export interface BattleLineSelection {
  groups: BattleLineGroup[];
  brigadeIds: string[];
}

export interface BattleLineLayoutInput {
  roster: ArmyRoster;
  states: Readonly<Record<string, UnitPhaseState>>;
  brigadeIds: readonly string[];
  points: readonly Point[];
  frontageByEchelon: FormationFrontages;
  dynamicFrontage: boolean;
  /** The raw selection; an explicitly selected command is always recentred. */
  explicitlySelectedUnitIds?: readonly string[];
}

export type BattleLineLayoutResult =
  | {
      ok: true;
      states: Record<string, UnitPhaseState>;
      unitIds: string[];
      brigadeIds: string[];
    }
  | { ok: false; error: string };

export interface BattleLineMetadata {
  unitIds: string[];
  brigadeIds: string[];
  points: Point[];
}

interface PolylineSample {
  point: Point;
  tangentRadians: number;
}

function roundValue(value: number): number {
  return Math.round(value * 100) / 100;
}

export function normalizeDegrees(value: number): number {
  const normalized = value % 360;
  return normalized < 0 ? normalized + 360 : normalized;
}

/** Flips a formation in place while keeping its position and order. */
export function flippedRotation(rotationDegrees: number): number {
  return normalizeDegrees(rotationDegrees + 180);
}

function buildUnitOrder(roster: ArmyRoster): Map<string, number> {
  const order = new Map<string, number>();
  let index = 0;

  const visit = (parentUnitId: string | null): void => {
    for (const child of unitChildren(roster, parentUnitId)) {
      if (order.has(child.id)) continue;
      order.set(child.id, index);
      index += 1;
      visit(child.id);
    }
  };

  visit(null);

  for (const unit of roster.units) {
    if (order.has(unit.id)) continue;
    order.set(unit.id, index);
    index += 1;
  }

  return order;
}

/**
 * The group key keeps same-division brigades together. A brigade directly under
 * a corps falls back to that corps, and an independent brigade gets no ancestor.
 */
function groupAncestor(roster: ArmyRoster, brigade: UnitDefinition): UnitDefinition | null {
  let current = brigade.parentUnitId ? findUnit(roster, brigade.parentUnitId) : undefined;
  const immediateParent = current ?? null;
  const seen = new Set<string>();

  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    if (current.echelon === 'division') return current;
    current = current.parentUnitId ? findUnit(roster, current.parentUnitId) : undefined;
  }

  return immediateParent;
}

/**
 * Resolves a selected formation, or an arbitrary set of brigades, into ordered
 * brigade groups. Selecting a parent includes all of its descendants.
 */
export function resolveBattleLineSelection(
  roster: ArmyRoster,
  selectedUnitIds: readonly string[],
  hiddenFactionIds: readonly string[] = [],
): BattleLineSelection {
  const hiddenFactions = new Set(hiddenFactionIds);
  const order = buildUnitOrder(roster);
  const candidateIds = new Set<string>();

  for (const selectedId of new Set(selectedUnitIds)) {
    const unit = findUnit(roster, selectedId);
    if (!unit) continue;
    candidateIds.add(unit.id);
    for (const descendantId of descendantUnitIds(roster, unit.id)) {
      candidateIds.add(descendantId);
    }
  }

  const brigades = [...candidateIds]
    .flatMap((unitId) => {
      const unit = findUnit(roster, unitId);
      if (!unit || unit.echelon !== 'brigade' || hiddenFactions.has(unit.factionId)) {
        return [];
      }
      return [unit];
    })
    .sort(
      (a, b) =>
        (order.get(a.id) ?? Number.MAX_SAFE_INTEGER) -
          (order.get(b.id) ?? Number.MAX_SAFE_INTEGER) || a.id.localeCompare(b.id),
    );

  const groupsByKey = new Map<
    string,
    { ancestorUnitId: string | null; brigades: UnitDefinition[] }
  >();

  for (const brigade of brigades) {
    const ancestor = groupAncestor(roster, brigade);
    const key = ancestor?.id ?? '__independent__';
    const group = groupsByKey.get(key) ?? {
      ancestorUnitId: ancestor?.id ?? null,
      brigades: [],
    };
    group.brigades.push(brigade);
    groupsByKey.set(key, group);
  }

  const sortedGroups = [...groupsByKey.entries()]
    .map(([key, group]) => ({
      key,
      ancestorUnitId: group.ancestorUnitId,
      brigades: group.brigades,
      sortIndex:
        group.ancestorUnitId !== null
          ? (order.get(group.ancestorUnitId) ?? Number.MAX_SAFE_INTEGER)
          : Math.min(
              ...group.brigades.map((brigade) => order.get(brigade.id) ?? Number.MAX_SAFE_INTEGER),
            ),
    }))
    .sort((a, b) => a.sortIndex - b.sortIndex || a.key.localeCompare(b.key));

  return {
    groups: sortedGroups.map((group) => ({
      key: group.key,
      ancestorUnitId: group.ancestorUnitId,
      brigadeIds: group.brigades.map((brigade) => brigade.id),
    })),
    brigadeIds: sortedGroups.flatMap((group) => group.brigades.map((brigade) => brigade.id)),
  };
}

export function polylineLength(points: readonly Point[]): number {
  let total = 0;
  for (let index = 1; index < points.length; index += 1) {
    const start = points[index - 1];
    const end = points[index];
    if (!start || !end) continue;
    total += Math.hypot(end.x - start.x, end.y - start.y);
  }
  return total;
}

function samplePolyline(points: readonly Point[], distance: number): PolylineSample | null {
  if (points.length < 2) return null;

  let remaining = Math.max(0, distance);
  let fallback: PolylineSample | null = null;

  for (let index = 1; index < points.length; index += 1) {
    const start = points[index - 1];
    const end = points[index];
    if (!start || !end) continue;

    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const segmentLength = Math.hypot(dx, dy);
    if (segmentLength === 0) continue;

    const tangentRadians = Math.atan2(dy, dx);
    if (remaining <= segmentLength) {
      const fraction = remaining / segmentLength;
      return {
        point: {
          x: start.x + dx * fraction,
          y: start.y + dy * fraction,
        },
        tangentRadians,
      };
    }

    remaining -= segmentLength;
    fallback = { point: end, tangentRadians };
  }

  return fallback;
}

function commandOffset(echelon: UnitEchelon): number | null {
  if (echelon === 'division' || echelon === 'corps' || echelon === 'army') {
    return BATTLE_LINE_COMMAND_OFFSETS[echelon];
  }
  return null;
}

function allBrigadeDescendantIds(roster: ArmyRoster, unitId: string): string[] {
  const descendants = descendantUnitIds(roster, unitId);
  return roster.units
    .filter((unit) => unit.echelon === 'brigade' && descendants.has(unit.id))
    .map((unit) => unit.id);
}

function ancestorIdsOf(roster: ArmyRoster, unit: UnitDefinition): string[] {
  const ancestors: string[] = [];
  const seen = new Set<string>();
  let current = unit.parentUnitId ? findUnit(roster, unit.parentUnitId) : undefined;

  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    ancestors.push(current.id);
    current = current.parentUnitId ? findUnit(roster, current.parentUnitId) : undefined;
  }

  return ancestors;
}

/**
 * Places brigades proportionally along a freehand line. Each frontage becomes a
 * slice of the line, so a short line intentionally overlaps the rectangles.
 * Command labels inside the selected formation tree are deployed when needed and
 * sit behind their own brigade group; unrelated undeployed ancestors are not
 * added.
 */
export function computeBattleLineLayout(input: BattleLineLayoutInput): BattleLineLayoutResult {
  const { roster, states, points, frontageByEchelon, dynamicFrontage } = input;
  const brigadeIds = [...new Set(input.brigadeIds)];
  if (brigadeIds.length === 0) {
    return {
      ok: false,
      error: 'Select a formation with brigades, or select brigades directly.',
    };
  }

  const brigades = brigadeIds.flatMap((brigadeId) => {
    const unit = findUnit(roster, brigadeId);
    return unit && unit.echelon === 'brigade' ? [unit] : [];
  });
  if (brigades.length !== brigadeIds.length) {
    return { ok: false, error: 'The battle line references an unknown brigade.' };
  }

  const lineLength = polylineLength(points);
  if (points.length < 2 || lineLength < BATTLE_LINE_MIN_LENGTH) {
    return { ok: false, error: 'Draw a longer battle line.' };
  }

  const defaultBrigadeFrontage = frontageByEchelon.brigade ?? defaultFrontageLength('brigade');
  const frontages = brigades.map((brigade) => {
    const state = states[brigade.id];
    if (state) {
      return renderedFrontageLength(state.frontageLength, state.effectiveStrength, dynamicFrontage);
    }
    const strength = effectiveUnitStrength(roster, brigade.id) ?? brigade.initialStrength;
    return renderedFrontageLength(defaultBrigadeFrontage, strength, dynamicFrontage);
  });
  const totalFrontage = frontages.reduce((total, frontage) => total + frontage, 0);
  if (totalFrontage <= 0) {
    return { ok: false, error: 'The selected brigades have no frontage to draw.' };
  }

  const nextStates: Record<string, UnitPhaseState> = {};
  const placements = new Map<string, PolylineSample>();
  let travelled = 0;

  brigades.forEach((brigade, index) => {
    const frontage = frontages[index] ?? 0;
    const slotLength = (lineLength * frontage) / totalFrontage;
    const sample = samplePolyline(points, travelled + slotLength / 2);
    if (!sample) return;

    const rotationDegrees = roundValue(normalizeDegrees((sample.tangentRadians * 180) / Math.PI));
    const position = {
      x: roundValue(sample.point.x),
      y: roundValue(sample.point.y),
    };
    const current = states[brigade.id];

    nextStates[brigade.id] = current
      ? {
          ...current,
          x: position.x,
          y: position.y,
          rotationDegrees,
        }
      : {
          ...defaultUnitPhaseState(roster, brigade, position, defaultBrigadeFrontage),
          rotationDegrees,
        };

    placements.set(brigade.id, { point: position, tangentRadians: sample.tangentRadians });
    travelled += slotLength;
  });

  if (placements.size !== brigades.length) {
    return { ok: false, error: 'The battle line could not be laid out.' };
  }

  const explicitIds = new Set(input.explicitlySelectedUnitIds ?? []);
  const selectedTreeIds = new Set<string>();
  for (const selectedId of explicitIds) {
    selectedTreeIds.add(selectedId);
    for (const descendantId of descendantUnitIds(roster, selectedId)) {
      selectedTreeIds.add(descendantId);
    }
  }
  const commandBrigades = new Map<string, string[]>();

  for (const brigade of brigades) {
    for (const ancestorId of ancestorIdsOf(roster, brigade)) {
      const included = commandBrigades.get(ancestorId) ?? [];
      included.push(brigade.id);
      commandBrigades.set(ancestorId, included);
    }
  }

  const order = buildUnitOrder(roster);
  const commandIds = [...commandBrigades.keys()]
    .flatMap((commandId) => {
      const command = findUnit(roster, commandId);
      const current = states[commandId];
      const included = commandBrigades.get(commandId) ?? [];
      if (!command || included.length === 0) return [];

      const explicit = explicitIds.has(commandId);
      if (!explicit) {
        const allBrigades = allBrigadeDescendantIds(roster, commandId);
        if (allBrigades.length === 0) return [];
        const includedSet = new Set(included);
        if (!allBrigades.every((brigadeId) => includedSet.has(brigadeId))) return [];
      }

      // Deploy commands inside the selected formation tree, mirroring Place on
      // map. Unrelated undeployed ancestors are still never added.
      if (!current && !selectedTreeIds.has(command.id)) return [];

      const samples = included.flatMap((brigadeId) => {
        const sample = placements.get(brigadeId);
        return sample ? [sample] : [];
      });
      if (samples.length === 0) return [];

      const offset = commandOffset(command.echelon);
      if (offset === null) return [];

      let sumX = 0;
      let sumY = 0;
      let vectorX = 0;
      let vectorY = 0;
      for (const sample of samples) {
        sumX += sample.point.x;
        sumY += sample.point.y;
        vectorX += Math.cos(sample.tangentRadians);
        vectorY += Math.sin(sample.tangentRadians);
      }

      const centreX = sumX / samples.length;
      const centreY = sumY / samples.length;
      const angle = Math.hypot(vectorX, vectorY) < 1e-6 ? 0 : Math.atan2(vectorY, vectorX);
      const x = centreX - Math.sin(angle) * offset;
      const y = centreY + Math.cos(angle) * offset;
      const rotationDegrees = roundValue(normalizeDegrees((angle * 180) / Math.PI));
      const next = current
        ? {
            ...current,
            x: roundValue(x),
            y: roundValue(y),
            rotationDegrees,
          }
        : {
            ...defaultUnitPhaseState(
              roster,
              command,
              { x: roundValue(x), y: roundValue(y) },
              frontageByEchelon[command.echelon] ?? defaultFrontageLength(command.echelon),
            ),
            rotationDegrees,
          };

      nextStates[command.id] = next;

      return [command.id];
    })
    .sort(
      (a, b) =>
        (order.get(a) ?? Number.MAX_SAFE_INTEGER) - (order.get(b) ?? Number.MAX_SAFE_INTEGER) ||
        a.localeCompare(b),
    );

  return {
    ok: true,
    states: nextStates,
    unitIds: [...brigadeIds, ...commandIds],
    brigadeIds,
  };
}
