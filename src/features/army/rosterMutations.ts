import {
  armyRosterSchema,
  createId,
  defaultFactionNamingModes,
  defaultFactionStrengths,
  type ArmyRoster,
  type Faction,
  type FactionDefaultStrengths,
  type FactionNamingModes,
  type SymbolStyle,
  type UnitDefinition,
  type UnitEchelon,
  type UnitType,
} from '../../models';
import {
  canEchelonHaveSubordinates,
  canHaveSubordinates,
  defaultSymbolStyle,
  defaultUnitStrength,
  descendantUnitIds,
  ECHELON_LABELS,
  echelonHierarchyError,
  findUnit,
  hasSubordinates,
  reparentError,
  unitDisplayName,
} from './rosterDocuments';

export interface NewFactionInput {
  name: string;
  color: string;
  labelColor?: string;
  namingModes?: FactionNamingModes;
  defaultStrengths?: FactionDefaultStrengths;
  notes?: string;
}

export interface NewUnitInput {
  factionId: string;
  customName?: string;
  echelon: UnitEchelon;
  unitType: UnitType;
  parentUnitId: string | null;
  commander?: string;
  /** Omit to use the default strength for the type and echelon. */
  initialStrength?: number | null;
  defaultSymbolStyle?: SymbolStyle;
  notes?: string;
}

export type UnitPatch = Partial<Omit<UnitDefinition, 'id'>>;

export type RosterMutation = { ok: true; document: ArmyRoster } | { ok: false; error: string };

export type RosterDeleteMutation =
  { ok: true; document: ArmyRoster; deletedUnitIds: string[] } | { ok: false; error: string };

export type RosterCreateMutation =
  { ok: true; document: ArmyRoster; id: string } | { ok: false; error: string };

function timestamp(): string {
  return new Date().toISOString();
}

/** Returns a compact validation message for the first schema issue. */
export function rosterSchemaError(roster: ArmyRoster): string | null {
  const result = armyRosterSchema.safeParse(roster);
  if (result.success) return null;

  const issue = result.error.issues[0];
  if (!issue) return 'The roster is not valid.';
  const path = issue.path.map(String).join('.');
  return path ? `${path}: ${issue.message}` : issue.message;
}

function finish(document: ArmyRoster): RosterMutation {
  const error = rosterSchemaError(document);
  return error ? { ok: false, error } : { ok: true, document };
}

export function addFaction(document: ArmyRoster, input: NewFactionInput): RosterCreateMutation {
  const name = input.name.trim();
  if (!name) return { ok: false, error: 'A faction name is required.' };

  const faction: Faction = {
    id: createId(),
    name,
    color: input.color,
    ...(input.labelColor ? { labelColor: input.labelColor } : {}),
    namingModes: structuredClone(input.namingModes ?? defaultFactionNamingModes()),
    defaultStrengths: structuredClone(input.defaultStrengths ?? defaultFactionStrengths()),
    ...(input.notes?.trim() ? { notes: input.notes.trim() } : {}),
  };

  const next: ArmyRoster = {
    ...document,
    factions: [...document.factions, faction],
    updatedAt: timestamp(),
  };
  const error = rosterSchemaError(next);
  if (error) return { ok: false, error };
  return { ok: true, document: next, id: faction.id };
}

export function updateFaction(
  document: ArmyRoster,
  factionId: string,
  patch: Partial<Omit<Faction, 'id'>>,
): RosterMutation {
  if (!document.factions.some((faction) => faction.id === factionId)) {
    return { ok: false, error: 'The faction could not be found.' };
  }

  const normalized: Partial<Omit<Faction, 'id'>> = { ...patch };
  if (patch.name !== undefined) {
    const name = patch.name.trim();
    if (!name) return { ok: false, error: 'A faction name is required.' };
    normalized.name = name;
  }
  if (patch.notes !== undefined) {
    normalized.notes = patch.notes.trim() === '' ? undefined : patch.notes;
  }

  return finish({
    ...document,
    factions: document.factions.map((faction) =>
      faction.id === factionId ? { ...faction, ...normalized } : faction,
    ),
    updatedAt: timestamp(),
  });
}

export function deleteFaction(document: ArmyRoster, factionId: string): RosterMutation {
  const faction = document.factions.find((candidate) => candidate.id === factionId);
  if (!faction) return { ok: false, error: 'The faction could not be found.' };

  const assigned = document.units.filter((unit) => unit.factionId === factionId);
  if (assigned.length > 0) {
    return {
      ok: false,
      error: `Move or delete the ${assigned.length} unit${
        assigned.length === 1 ? '' : 's'
      } belonging to ${faction.name} first.`,
    };
  }

  return finish({
    ...document,
    factions: document.factions.filter((candidate) => candidate.id !== factionId),
    updatedAt: timestamp(),
  });
}

export function addUnit(document: ArmyRoster, input: NewUnitInput): RosterCreateMutation {
  const faction = document.factions.find((candidate) => candidate.id === input.factionId);
  if (!faction) return { ok: false, error: 'Choose a faction for the unit.' };

  if (input.parentUnitId !== null) {
    const parent = findUnit(document, input.parentUnitId);
    if (!parent) return { ok: false, error: 'The selected parent formation could not be found.' };
    if (parent.factionId !== input.factionId) {
      return { ok: false, error: 'The parent formation must belong to the same faction.' };
    }
    const hierarchyError = echelonHierarchyError(input.echelon, parent.echelon);
    if (hierarchyError) return { ok: false, error: hierarchyError };
    if (!canHaveSubordinates(document, parent)) {
      return {
        ok: false,
        error: `${unitDisplayName(document, parent)} is at or below the smallest unit and cannot take subordinates.`,
      };
    }
  }

  const customName = input.customName?.trim();
  const commander = input.commander?.trim();
  const initialStrength =
    input.initialStrength === undefined
      ? defaultUnitStrength(faction, input.unitType, input.echelon, document.smallestUnitEchelon)
      : input.initialStrength;

  const unit: UnitDefinition = {
    id: createId(),
    factionId: input.factionId,
    ...(customName ? { customName } : {}),
    echelon: input.echelon,
    unitType: input.unitType,
    parentUnitId: input.parentUnitId,
    ...(commander ? { commander } : {}),
    initialStrength,
    defaultSymbolStyle: structuredClone(
      input.defaultSymbolStyle ?? defaultSymbolStyle(faction.color),
    ),
    ...(input.notes?.trim() ? { notes: input.notes.trim() } : {}),
  };

  const next: ArmyRoster = {
    ...document,
    units: [...document.units, unit],
    updatedAt: timestamp(),
  };
  const error = rosterSchemaError(next);
  if (error) return { ok: false, error };
  return { ok: true, document: next, id: unit.id };
}

export function updateUnit(document: ArmyRoster, unitId: string, patch: UnitPatch): RosterMutation {
  const current = findUnit(document, unitId);
  if (!current) return { ok: false, error: 'The unit could not be found.' };

  if (patch.parentUnitId !== undefined) {
    const parentError = reparentError(
      document,
      unitId,
      patch.parentUnitId,
      patch.echelon ?? current.echelon,
    );
    if (parentError) return { ok: false, error: parentError };
  }

  const nextEchelon = patch.echelon ?? current.echelon;
  const nextParentId = patch.parentUnitId !== undefined ? patch.parentUnitId : current.parentUnitId;
  if (nextParentId !== null) {
    const parent = findUnit(document, nextParentId);
    if (!parent) {
      return { ok: false, error: 'The selected parent formation could not be found.' };
    }
    const hierarchyError = echelonHierarchyError(nextEchelon, parent.echelon);
    if (hierarchyError) return { ok: false, error: hierarchyError };
  }

  if (
    patch.echelon !== undefined &&
    hasSubordinates(document, unitId) &&
    !canEchelonHaveSubordinates(patch.echelon, document.smallestUnitEchelon)
  ) {
    return {
      ok: false,
      error: `${unitDisplayName(document, current)} has subordinates and cannot become a smallest unit. Move or delete them first.`,
    };
  }

  if (patch.echelon !== undefined) {
    const blockedChild = document.units.find(
      (candidate) =>
        candidate.parentUnitId === unitId &&
        echelonHierarchyError(candidate.echelon, nextEchelon) !== null,
    );
    if (blockedChild) {
      return {
        ok: false,
        error: `${unitDisplayName(document, current)} cannot become a ${ECHELON_LABELS[nextEchelon]} while it has ${ECHELON_LABELS[blockedChild.echelon]} subordinates. Move or delete them first.`,
      };
    }
  }

  const normalized: UnitPatch = { ...patch };
  if (patch.customName !== undefined) {
    const customName = patch.customName.trim();
    normalized.customName = customName === '' ? undefined : customName;
  }
  if (patch.commander !== undefined) {
    const commander = patch.commander.trim();
    normalized.commander = commander === '' ? undefined : commander;
  }
  if (patch.notes !== undefined && patch.notes.trim() === '') {
    normalized.notes = undefined;
  }

  return finish({
    ...document,
    units: document.units.map((unit) => (unit.id === unitId ? { ...unit, ...normalized } : unit)),
    updatedAt: timestamp(),
  });
}

export function reparentUnit(
  document: ArmyRoster,
  unitId: string,
  parentUnitId: string | null,
): RosterMutation {
  const unit = findUnit(document, unitId);
  if (!unit) return { ok: false, error: 'The unit could not be found.' };
  if (unit.parentUnitId === parentUnitId) return { ok: true, document };

  return updateUnit(document, unitId, { parentUnitId });
}

export function deleteUnit(document: ArmyRoster, unitId: string): RosterDeleteMutation {
  const unit = findUnit(document, unitId);
  if (!unit) return { ok: false, error: 'The unit could not be found.' };

  const deletedUnitIds = [unit.id, ...descendantUnitIds(document, unit.id)];
  const deleted = new Set(deletedUnitIds);
  const next: ArmyRoster = {
    ...document,
    units: document.units.filter((candidate) => !deleted.has(candidate.id)),
    updatedAt: timestamp(),
  };

  const error = rosterSchemaError(next);
  return error ? { ok: false, error } : { ok: true, document: next, deletedUnitIds };
}
