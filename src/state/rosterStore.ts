import { create } from 'zustand';
import {
  armyRosterSchema,
  createId,
  createSeedRoster,
  type ArmyRoster,
  type Faction,
  type FactionNamingMode,
  type SymbolStyle,
  type UnitDefinition,
  type UnitEchelon,
  type UnitType,
} from '../models';
import {
  canEchelonHaveSubordinates,
  canHaveSubordinates,
  defaultSymbolStyle,
  defaultUnitStrength,
  findUnit,
  hasSubordinates,
  normalizeRosterDocument,
  reparentError,
  smallestUnitChangeError,
  unitDisplayName,
} from '../features/army/rosterDocuments';

const HISTORY_LIMIT = 100;

function timestamp(): string {
  return new Date().toISOString();
}

function schemaError(roster: ArmyRoster): string | null {
  const result = armyRosterSchema.safeParse(roster);
  if (result.success) return null;

  const issue = result.error.issues[0];
  if (!issue) return 'The roster is not valid.';
  const path = issue.path.map(String).join('.');
  return path ? `${path}: ${issue.message}` : issue.message;
}

type CommitState = Pick<RosterEditorStore, 'document' | 'past' | 'future'>;

function commit(state: RosterEditorStore, next: ArmyRoster): CommitState | null {
  const error = schemaError(next);
  if (error) return null;

  return {
    document: next,
    past: [...state.past, state.document].slice(-HISTORY_LIMIT),
    future: [],
  };
}

export type RosterMutationResult = { ok: true } | { ok: false; error: string };

export type RosterCreateResult = { ok: true; id: string } | { ok: false; error: string };

export interface NewFactionInput {
  name: string;
  color: string;
  labelColor?: string;
  namingMode?: FactionNamingMode;
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

export interface RosterEditorStore {
  document: ArmyRoster;
  past: ArmyRoster[];
  future: ArmyRoster[];
  loadDocument: (document: ArmyRoster) => void;
  renameDocument: (name: string) => RosterMutationResult;
  setSmallestUnitEchelon: (echelon: UnitEchelon) => RosterMutationResult;
  addFaction: (input: NewFactionInput) => RosterCreateResult;
  updateFaction: (factionId: string, patch: Partial<Omit<Faction, 'id'>>) => RosterMutationResult;
  deleteFaction: (factionId: string) => RosterMutationResult;
  addUnit: (input: NewUnitInput) => RosterCreateResult;
  updateUnit: (unitId: string, patch: UnitPatch) => RosterMutationResult;
  reparentUnit: (unitId: string, parentUnitId: string | null) => RosterMutationResult;
  deleteUnit: (unitId: string) => RosterMutationResult;
  undo: () => void;
  redo: () => void;
}

export const useRosterStore = create<RosterEditorStore>()((set, get) => ({
  document: createSeedRoster(),
  past: [],
  future: [],

  loadDocument: (document) =>
    set({
      document: normalizeRosterDocument(structuredClone(document)),
      past: [],
      future: [],
    }),

  renameDocument: (name) => {
    const trimmed = name.trim();
    if (!trimmed) return { ok: false, error: 'A roster name is required.' };

    const state = get();
    if (trimmed === state.document.name) return { ok: true };

    const next = commit(state, {
      ...state.document,
      name: trimmed,
      updatedAt: timestamp(),
    });
    if (!next) return { ok: false, error: 'The roster name is not valid.' };
    set(next);
    return { ok: true };
  },

  setSmallestUnitEchelon: (echelon) => {
    const state = get();
    if (echelon === state.document.smallestUnitEchelon) return { ok: true };

    const error = smallestUnitChangeError(state.document, echelon);
    if (error) return { ok: false, error };

    const next = commit(state, {
      ...state.document,
      smallestUnitEchelon: echelon,
      updatedAt: timestamp(),
    });
    if (!next) return { ok: false, error: 'The smallest unit setting is not valid.' };
    set(next);
    return { ok: true };
  },

  addFaction: (input) => {
    const name = input.name.trim();
    if (!name) return { ok: false, error: 'A faction name is required.' };

    const state = get();
    const faction: Faction = {
      id: createId(),
      name,
      color: input.color,
      ...(input.labelColor ? { labelColor: input.labelColor } : {}),
      namingMode: input.namingMode ?? 'numeric',
      ...(input.notes ? { notes: input.notes } : {}),
    };
    const next = commit(state, {
      ...state.document,
      factions: [...state.document.factions, faction],
      updatedAt: timestamp(),
    });
    if (!next)
      return {
        ok: false,
        error:
          schemaError({ ...state.document, factions: [...state.document.factions, faction] }) ??
          'The faction is not valid.',
      };
    set(next);
    return { ok: true, id: faction.id };
  },

  updateFaction: (factionId, patch) => {
    const state = get();
    if (!state.document.factions.some((faction) => faction.id === factionId)) {
      return { ok: false, error: 'The faction could not be found.' };
    }

    const normalized: Partial<Omit<Faction, 'id'>> = { ...patch };
    if (patch.name !== undefined) {
      const name = patch.name.trim();
      if (!name) return { ok: false, error: 'A faction name is required.' };
      normalized.name = name;
    }

    const nextRoster: ArmyRoster = {
      ...state.document,
      factions: state.document.factions.map((faction) =>
        faction.id === factionId ? { ...faction, ...normalized } : faction,
      ),
      updatedAt: timestamp(),
    };
    const error = schemaError(nextRoster);
    if (error) return { ok: false, error };

    const next = commit(state, nextRoster);
    if (!next) return { ok: false, error: 'The faction is not valid.' };
    set(next);
    return { ok: true };
  },

  deleteFaction: (factionId) => {
    const state = get();
    const faction = state.document.factions.find((candidate) => candidate.id === factionId);
    if (!faction) return { ok: false, error: 'The faction could not be found.' };

    const assigned = state.document.units.filter((unit) => unit.factionId === factionId);
    if (assigned.length > 0) {
      return {
        ok: false,
        error: `Move or delete the ${assigned.length} unit${
          assigned.length === 1 ? '' : 's'
        } belonging to ${faction.name} first.`,
      };
    }

    const next = commit(state, {
      ...state.document,
      factions: state.document.factions.filter((candidate) => candidate.id !== factionId),
      updatedAt: timestamp(),
    });
    if (!next) return { ok: false, error: 'The faction could not be deleted.' };
    set(next);
    return { ok: true };
  },

  addUnit: (input) => {
    const state = get();
    const faction = state.document.factions.find((candidate) => candidate.id === input.factionId);
    if (!faction) return { ok: false, error: 'Choose a faction for the unit.' };

    if (input.parentUnitId !== null) {
      const parent = findUnit(state.document, input.parentUnitId);
      if (!parent) return { ok: false, error: 'The selected parent formation could not be found.' };
      if (parent.factionId !== input.factionId) {
        return { ok: false, error: 'The parent formation must belong to the same faction.' };
      }
      if (!canHaveSubordinates(state.document, parent)) {
        return {
          ok: false,
          error: `${unitDisplayName(state.document, parent)} is at or below the smallest unit and cannot take subordinates.`,
        };
      }
    }

    const customName = input.customName?.trim();
    const commander = input.commander?.trim();
    const initialStrength =
      input.initialStrength === undefined
        ? defaultUnitStrength(input.unitType, input.echelon, state.document.smallestUnitEchelon)
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

    const nextRoster: ArmyRoster = {
      ...state.document,
      units: [...state.document.units, unit],
      updatedAt: timestamp(),
    };
    const error = schemaError(nextRoster);
    if (error) return { ok: false, error };

    const next = commit(state, nextRoster);
    if (!next) return { ok: false, error: 'The unit is not valid.' };
    set(next);
    return { ok: true, id: unit.id };
  },

  updateUnit: (unitId, patch) => {
    const state = get();
    const current = findUnit(state.document, unitId);
    if (!current) return { ok: false, error: 'The unit could not be found.' };

    if (patch.parentUnitId !== undefined) {
      const parentError = reparentError(state.document, unitId, patch.parentUnitId);
      if (parentError) return { ok: false, error: parentError };
    }

    if (
      patch.echelon !== undefined &&
      hasSubordinates(state.document, unitId) &&
      !canEchelonHaveSubordinates(patch.echelon, state.document.smallestUnitEchelon)
    ) {
      return {
        ok: false,
        error: `${unitDisplayName(state.document, current)} has subordinates and cannot become a smallest unit. Move or delete them first.`,
      };
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

    const nextRoster: ArmyRoster = {
      ...state.document,
      units: state.document.units.map((unit) =>
        unit.id === unitId ? { ...unit, ...normalized } : unit,
      ),
      updatedAt: timestamp(),
    };
    const error = schemaError(nextRoster);
    if (error) return { ok: false, error };

    const next = commit(state, nextRoster);
    if (!next) return { ok: false, error: 'The unit is not valid.' };
    set(next);
    return { ok: true };
  },

  reparentUnit: (unitId, parentUnitId) => {
    const state = get();
    const unit = findUnit(state.document, unitId);
    if (!unit) return { ok: false, error: 'The unit could not be found.' };
    if (unit.parentUnitId === parentUnitId) return { ok: true };

    return get().updateUnit(unitId, { parentUnitId });
  },

  deleteUnit: (unitId) => {
    const state = get();
    const unit = findUnit(state.document, unitId);
    if (!unit) return { ok: false, error: 'The unit could not be found.' };

    const children = state.document.units.filter((candidate) => candidate.parentUnitId === unitId);
    if (children.length > 0) {
      return {
        ok: false,
        error: `Reparent or delete the ${children.length} subordinate unit${
          children.length === 1 ? '' : 's'
        } before deleting ${unitDisplayName(state.document, unit)}.`,
      };
    }

    const next = commit(state, {
      ...state.document,
      units: state.document.units.filter((candidate) => candidate.id !== unitId),
      updatedAt: timestamp(),
    });
    if (!next) return { ok: false, error: 'The unit could not be deleted.' };
    set(next);
    return { ok: true };
  },

  undo: () =>
    set((state) => {
      const previous = state.past[state.past.length - 1];
      if (!previous) return state;

      return {
        document: previous,
        past: state.past.slice(0, -1),
        future: [state.document, ...state.future],
      };
    }),

  redo: () =>
    set((state) => {
      const next = state.future[0];
      if (!next) return state;

      return {
        document: next,
        past: [...state.past, state.document].slice(-HISTORY_LIMIT),
        future: state.future.slice(1),
      };
    }),
}));
