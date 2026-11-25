import { create } from 'zustand';
import { createSeedRoster, type ArmyRoster, type Faction } from '../models';
import { normalizeRosterDocument } from '../features/army/rosterDocuments';
import {
  addFaction as addFactionMutation,
  addUnit as addUnitMutation,
  deleteFaction as deleteFactionMutation,
  deleteUnit as deleteUnitMutation,
  reparentUnit as reparentUnitMutation,
  rosterSchemaError,
  updateFaction as updateFactionMutation,
  updateUnit as updateUnitMutation,
  type NewFactionInput,
  type NewUnitInput,
  type UnitPatch,
} from '../features/army/rosterMutations';

const HISTORY_LIMIT = 100;

function timestamp(): string {
  return new Date().toISOString();
}

type CommitState = Pick<RosterEditorStore, 'document' | 'past' | 'future'>;

function commit(state: RosterEditorStore, next: ArmyRoster): CommitState | null {
  const error = rosterSchemaError(next);
  if (error) return null;

  return {
    document: next,
    past: [...state.past, state.document].slice(-HISTORY_LIMIT),
    future: [],
  };
}

export type RosterMutationResult = { ok: true } | { ok: false; error: string };

export type RosterCreateResult = { ok: true; id: string } | { ok: false; error: string };

export type { NewFactionInput, NewUnitInput, UnitPatch };

export interface RosterEditorStore {
  document: ArmyRoster;
  past: ArmyRoster[];
  future: ArmyRoster[];
  loadDocument: (document: ArmyRoster) => void;
  renameDocument: (name: string) => RosterMutationResult;
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

  addFaction: (input) => {
    const result = addFactionMutation(get().document, input);
    if (!result.ok) return { ok: false, error: result.error };

    const next = commit(get(), result.document);
    if (!next) return { ok: false, error: 'The faction is not valid.' };
    set(next);
    return { ok: true, id: result.id };
  },

  updateFaction: (factionId, patch) => {
    const result = updateFactionMutation(get().document, factionId, patch);
    if (!result.ok) return { ok: false, error: result.error };

    const next = commit(get(), result.document);
    if (!next) return { ok: false, error: 'The faction is not valid.' };
    set(next);
    return { ok: true };
  },

  deleteFaction: (factionId) => {
    const result = deleteFactionMutation(get().document, factionId);
    if (!result.ok) return { ok: false, error: result.error };

    const next = commit(get(), result.document);
    if (!next) return { ok: false, error: 'The faction could not be deleted.' };
    set(next);
    return { ok: true };
  },

  addUnit: (input) => {
    const result = addUnitMutation(get().document, input);
    if (!result.ok) return { ok: false, error: result.error };

    const next = commit(get(), result.document);
    if (!next) return { ok: false, error: 'The unit is not valid.' };
    set(next);
    return { ok: true, id: result.id };
  },

  updateUnit: (unitId, patch) => {
    const result = updateUnitMutation(get().document, unitId, patch);
    if (!result.ok) return { ok: false, error: result.error };

    const next = commit(get(), result.document);
    if (!next) return { ok: false, error: 'The unit is not valid.' };
    set(next);
    return { ok: true };
  },

  reparentUnit: (unitId, parentUnitId) => {
    const result = reparentUnitMutation(get().document, unitId, parentUnitId);
    if (!result.ok) return { ok: false, error: result.error };

    const next = commit(get(), result.document);
    if (!next) return { ok: false, error: 'The unit is not valid.' };
    set(next);
    return { ok: true };
  },

  deleteUnit: (unitId) => {
    const result = deleteUnitMutation(get().document, unitId);
    if (!result.ok) return { ok: false, error: result.error };

    const next = commit(get(), result.document);
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
