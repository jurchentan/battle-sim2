import {
  armyRosterSchema,
  createId,
  SCHEMA_VERSION,
  type ArmyRoster,
  type FactionNamingMode,
  type SymbolStyle,
  type UnitDefinition,
  type UnitEchelon,
  type UnitType,
} from '../../models';

export const ECHELON_ORDER: readonly UnitEchelon[] = [
  'army',
  'corps',
  'division',
  'brigade',
  'regiment',
  'other',
];

export const ECHELON_LABELS: Record<UnitEchelon, string> = {
  army: 'Army',
  corps: 'Corps',
  division: 'Division',
  brigade: 'Brigade',
  regiment: 'Regiment',
  other: 'Other',
};

/** Labels used inside generated unit names; "other" reads better as Formation. */
const DYNAMIC_ECHELON_LABELS: Record<UnitEchelon, string> = {
  ...ECHELON_LABELS,
  other: 'Formation',
};

/**
 * Default starting strength for new strength-bearing units. Values only apply
 * at or below the roster's smallest-unit echelon; formations above it derive
 * their strength from subordinates. "Other" unit types stay blank.
 */
export const DEFAULT_UNIT_STRENGTHS: Record<UnitType, Record<UnitEchelon, number>> = {
  infantry: {
    army: 20000,
    corps: 10000,
    division: 5000,
    brigade: 1500,
    regiment: 500,
    other: 500,
  },
  cavalry: {
    army: 8000,
    corps: 4000,
    division: 2000,
    brigade: 800,
    regiment: 300,
    other: 300,
  },
  artillery: {
    army: 3000,
    corps: 1500,
    division: 800,
    brigade: 300,
    regiment: 100,
    other: 100,
  },
  other: {
    army: 0,
    corps: 0,
    division: 0,
    brigade: 0,
    regiment: 0,
    other: 0,
  },
};

export function echelonRank(echelon: UnitEchelon): number {
  return ECHELON_ORDER.indexOf(echelon);
}

export function defaultUnitStrength(
  unitType: UnitType,
  echelon: UnitEchelon,
  smallestUnitEchelon: UnitEchelon,
): number | null {
  if (unitType === 'other') return null;
  if (echelonRank(echelon) < echelonRank(smallestUnitEchelon)) return null;
  return DEFAULT_UNIT_STRENGTHS[unitType][echelon];
}

export function ordinalLabel(value: number): string {
  const mod100 = value % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${value}th`;

  switch (value % 10) {
    case 1:
      return `${value}st`;
    case 2:
      return `${value}nd`;
    case 3:
      return `${value}rd`;
    default:
      return `${value}th`;
  }
}

export function defaultSymbolStyle(color: string): SymbolStyle {
  return {
    color,
    thickness: 7,
    dash: [],
    labelPosition: 'above',
  };
}

export function nextEchelonFor(parentEchelon: UnitEchelon | null): UnitEchelon {
  if (!parentEchelon) return 'army';
  const index = ECHELON_ORDER.indexOf(parentEchelon);
  if (index === -1 || index === ECHELON_ORDER.length - 1) return 'brigade';
  return ECHELON_ORDER[index + 1] ?? 'brigade';
}

/**
 * Infers the deepest regular echelon present in a roster. Used to upgrade
 * rosters saved before the smallest-unit setting existed without dropping
 * regiment or other custom leaves.
 */
export function inferSmallestUnitEchelon(units: readonly UnitDefinition[]): UnitEchelon {
  let smallest: UnitEchelon = 'brigade';

  for (const unit of units) {
    if (unit.echelon === 'other') continue;
    if (echelonRank(unit.echelon) > echelonRank(smallest)) {
      smallest = unit.echelon;
    }
  }

  return smallest;
}

export function normalizeRosterDocument(document: ArmyRoster): ArmyRoster {
  const withSmallestUnit = document.smallestUnitEchelon
    ? document
    : {
        ...document,
        smallestUnitEchelon: inferSmallestUnitEchelon(document.units),
      };

  const parsed = armyRosterSchema.safeParse(withSmallestUnit);
  return parsed.success ? parsed.data : withSmallestUnit;
}

export function canEchelonHaveSubordinates(
  echelon: UnitEchelon,
  smallestUnitEchelon: UnitEchelon,
): boolean {
  if (echelon === 'other') return false;
  return echelonRank(echelon) < echelonRank(smallestUnitEchelon);
}

export function canHaveSubordinates(roster: ArmyRoster, unit: UnitDefinition): boolean {
  return canEchelonHaveSubordinates(unit.echelon, roster.smallestUnitEchelon);
}

export function hasSubordinates(roster: ArmyRoster, unitId: string): boolean {
  return roster.units.some((unit) => unit.parentUnitId === unitId);
}

/**
 * Formation strength is derived from subordinates once a unit can have them.
 * Units at or below the configured smallest echelon carry their own strength.
 */
export function isStrengthAggregated(roster: ArmyRoster, unit: UnitDefinition): boolean {
  return canHaveSubordinates(roster, unit) && hasSubordinates(roster, unit.id);
}

export function effectiveUnitStrength(
  roster: ArmyRoster,
  unitId: string,
  seen: Set<string> = new Set(),
): number | null {
  if (seen.has(unitId)) return null;

  const unit = findUnit(roster, unitId);
  if (!unit) return null;

  if (!canHaveSubordinates(roster, unit)) return unit.initialStrength;

  const children = unitChildren(roster, unit.id);
  if (children.length === 0) return unit.initialStrength;

  seen.add(unitId);
  let total = 0;
  let hasStrength = false;

  for (const child of children) {
    const strength = effectiveUnitStrength(roster, child.id, seen);
    if (strength === null) continue;
    total += strength;
    hasStrength = true;
  }

  seen.delete(unitId);
  return hasStrength ? total : null;
}

export function smallestUnitChangeError(
  roster: ArmyRoster,
  smallestUnitEchelon: UnitEchelon,
): string | null {
  const nextRank = echelonRank(smallestUnitEchelon);
  const parentIds = new Set(
    roster.units
      .map((unit) => unit.parentUnitId)
      .filter((unitId): unitId is string => unitId !== null),
  );

  const deeper = roster.units.filter(
    (unit) => unit.echelon !== 'other' && echelonRank(unit.echelon) > nextRank,
  );
  if (deeper.length > 0) {
    const names = deeper
      .slice(0, 3)
      .map((unit) => unitDisplayName(roster, unit))
      .join(', ');
    return `Change or remove ${deeper.length === 1 ? 'the unit' : 'the units'} below ${
      ECHELON_LABELS[smallestUnitEchelon]
    } before making it the smallest unit (${names}${deeper.length > 3 ? ', …' : ''}).`;
  }

  const blockingParent = roster.units.find(
    (unit) =>
      unit.echelon !== 'other' && echelonRank(unit.echelon) >= nextRank && parentIds.has(unit.id),
  );
  if (blockingParent) {
    return `${unitDisplayName(roster, blockingParent)} still has subordinates. Move or delete them before making ${
      ECHELON_LABELS[smallestUnitEchelon]
    } the smallest unit.`;
  }

  return null;
}

export function createBlankRoster(name = 'Untitled roster'): ArmyRoster {
  const now = new Date().toISOString();
  return {
    schemaVersion: SCHEMA_VERSION,
    id: createId(),
    name,
    smallestUnitEchelon: 'brigade',
    factions: [],
    units: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function duplicateRoster(source: ArmyRoster, name: string): ArmyRoster {
  const now = new Date().toISOString();
  return {
    ...structuredClone(source),
    id: createId(),
    name,
    createdAt: now,
    updatedAt: now,
  };
}

export function findUnit(roster: ArmyRoster, unitId: string): UnitDefinition | undefined {
  return roster.units.find((unit) => unit.id === unitId);
}

export function factionNamingMode(roster: ArmyRoster, factionId: string): FactionNamingMode {
  return roster.factions.find((faction) => faction.id === factionId)?.namingMode ?? 'numeric';
}

function numericOrdinalFor(roster: ArmyRoster, unit: UnitDefinition): number {
  const peers = roster.units.filter(
    (candidate) =>
      candidate.factionId === unit.factionId &&
      candidate.echelon === unit.echelon &&
      !candidate.customName?.trim(),
  );
  return Math.max(1, peers.findIndex((candidate) => candidate.id === unit.id) + 1);
}

function commanderStyleName(commander: string, echelon: UnitEchelon): string {
  const base = commander.trim();
  const possessive = /s$/i.test(base) ? "'" : 's';
  return `${base}${possessive} ${DYNAMIC_ECHELON_LABELS[echelon]}`;
}

export function unitDynamicName(roster: ArmyRoster, unit: UnitDefinition): string {
  if (factionNamingMode(roster, unit.factionId) === 'commander' && unit.commander?.trim()) {
    return commanderStyleName(unit.commander, unit.echelon);
  }

  return `${ordinalLabel(numericOrdinalFor(roster, unit))} ${DYNAMIC_ECHELON_LABELS[unit.echelon]}`;
}

export function unitDisplayName(roster: ArmyRoster, unit: UnitDefinition): string {
  const customName = unit.customName?.trim();
  return customName ? customName : unitDynamicName(roster, unit);
}

/** Preview of the name a not-yet-created unit would receive. */
export function draftUnitDisplayName(
  roster: ArmyRoster,
  input: {
    factionId: string;
    echelon: UnitEchelon;
    commander?: string;
    customName?: string;
  },
): string {
  const customName = input.customName?.trim();
  if (customName) return customName;

  if (factionNamingMode(roster, input.factionId) === 'commander' && input.commander?.trim()) {
    return commanderStyleName(input.commander, input.echelon);
  }

  const peerCount = roster.units.filter(
    (unit) =>
      unit.factionId === input.factionId &&
      unit.echelon === input.echelon &&
      !unit.customName?.trim(),
  ).length;

  return `${ordinalLabel(peerCount + 1)} ${DYNAMIC_ECHELON_LABELS[input.echelon]}`;
}

export function unitChildren(roster: ArmyRoster, parentUnitId: string | null): UnitDefinition[] {
  const children = roster.units.filter((unit) => unit.parentUnitId === parentUnitId);
  return [...children].sort((a, b) => {
    const echelonDelta = ECHELON_ORDER.indexOf(a.echelon) - ECHELON_ORDER.indexOf(b.echelon);
    if (echelonDelta !== 0) return echelonDelta;
    return (
      unitDisplayName(roster, a).localeCompare(unitDisplayName(roster, b)) ||
      a.id.localeCompare(b.id)
    );
  });
}

export function descendantUnitIds(roster: ArmyRoster, unitId: string): Set<string> {
  const descendants = new Set<string>();
  const queue = [unitId];

  while (queue.length > 0) {
    const currentId = queue.shift();
    if (!currentId) continue;
    for (const unit of roster.units) {
      if (unit.parentUnitId !== currentId || descendants.has(unit.id)) continue;
      descendants.add(unit.id);
      queue.push(unit.id);
    }
  }

  return descendants;
}

export function unitDepth(roster: ArmyRoster, unitId: string): number {
  const byId = new Map(roster.units.map((unit) => [unit.id, unit] as const));
  const seen = new Set<string>();
  let depth = 0;
  let current = byId.get(unitId)?.parentUnitId ?? null;

  while (current && !seen.has(current)) {
    seen.add(current);
    depth += 1;
    current = byId.get(current)?.parentUnitId ?? null;
  }

  return depth;
}

export function hierarchyPath(roster: ArmyRoster, unitId: string): UnitDefinition[] {
  const byId = new Map(roster.units.map((unit) => [unit.id, unit] as const));
  const path: UnitDefinition[] = [];
  const seen = new Set<string>();
  let current = byId.get(unitId);

  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    path.unshift(current);
    current = current.parentUnitId ? byId.get(current.parentUnitId) : undefined;
  }

  return path;
}

/**
 * Returns a human-readable reason when a proposed parent is illegal, or null when it is safe.
 * A unit may never be parented to itself, to a unit in another faction, or to one of its own
 * descendants (which would create a hierarchy cycle).
 */
export function reparentError(
  roster: ArmyRoster,
  unitId: string,
  parentUnitId: string | null,
): string | null {
  if (parentUnitId === null) return null;
  if (parentUnitId === unitId) return 'A unit cannot be its own parent.';

  const unit = findUnit(roster, unitId);
  if (!unit) return 'The unit could not be found.';

  const parent = findUnit(roster, parentUnitId);
  if (!parent) return 'The selected parent formation could not be found.';

  if (parent.factionId !== unit.factionId) {
    return 'The parent formation must belong to the same faction.';
  }

  if (descendantUnitIds(roster, unitId).has(parentUnitId)) {
    return 'That parent would create a cycle in the chain of command.';
  }

  if (!canHaveSubordinates(roster, parent)) {
    return `${unitDisplayName(roster, parent)} is a ${
      ECHELON_LABELS[parent.echelon]
    } and cannot take subordinates while ${ECHELON_LABELS[roster.smallestUnitEchelon]} is the smallest unit.`;
  }

  return null;
}

export function eligibleParentUnits(roster: ArmyRoster, unitId: string): UnitDefinition[] {
  const blocked = descendantUnitIds(roster, unitId);
  blocked.add(unitId);
  return roster.units
    .filter((unit) => !blocked.has(unit.id))
    .filter((unit) => unit.factionId === findUnit(roster, unitId)?.factionId)
    .filter((unit) => canHaveSubordinates(roster, unit))
    .sort((a, b) => {
      const depthDelta = unitDepth(roster, a.id) - unitDepth(roster, b.id);
      if (depthDelta !== 0) return depthDelta;
      return (
        unitDisplayName(roster, a).localeCompare(unitDisplayName(roster, b)) ||
        a.id.localeCompare(b.id)
      );
    });
}
