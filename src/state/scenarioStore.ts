import { create } from 'zustand';
import {
  battleScenarioSchema,
  createSeedBattleScenario,
  type BattleScenario,
  type Point,
  type UnitPhaseState,
} from '../models';
import {
  activeScenarioPhase,
  createScenarioDocument,
  deployFormationStates,
  type NewScenarioInput,
} from '../features/scenario/scenarioDocuments';

const HISTORY_LIMIT = 100;

function timestamp(): string {
  return new Date().toISOString();
}

function schemaError(scenario: BattleScenario): string | null {
  const result = battleScenarioSchema.safeParse(scenario);
  if (result.success) return null;

  const issue = result.error.issues[0];
  if (!issue) return 'The scenario is not valid.';
  const path = issue.path.map(String).join('.');
  return path ? `${path}: ${issue.message}` : issue.message;
}

export type ScenarioMutationResult = { ok: true } | { ok: false; error: string };

export type ScenarioCreateResult = { ok: true; id: string } | { ok: false; error: string };

type CommitState = Pick<ScenarioEditorStore, 'document' | 'past' | 'future'>;

function commit(state: ScenarioEditorStore, next: BattleScenario): CommitState | null {
  const result = battleScenarioSchema.safeParse(next);
  if (!result.success) return null;

  return {
    document: result.data,
    past: [...state.past, state.document].slice(-HISTORY_LIMIT),
    future: [],
  };
}

function replaceActivePhase(
  scenario: BattleScenario,
  update: (phase: NonNullable<ReturnType<typeof activeScenarioPhase>>) => BattleScenario['phases'],
): BattleScenario {
  const activePhase = activeScenarioPhase(scenario);
  if (!activePhase) return scenario;

  return {
    ...scenario,
    phases: update(activePhase),
    updatedAt: timestamp(),
  };
}

export interface ScenarioEditorStore {
  document: BattleScenario;
  past: BattleScenario[];
  future: BattleScenario[];
  loadDocument: (document: BattleScenario) => void;
  createScenario: (input: NewScenarioInput) => ScenarioCreateResult;
  renameDocument: (name: string) => ScenarioMutationResult;
  placeUnit: (unitId: string, position: Point) => ScenarioMutationResult;
  updateUnitState: (unitId: string, patch: Partial<UnitPhaseState>) => ScenarioMutationResult;
  undeployUnit: (unitId: string) => ScenarioMutationResult;
  undo: () => void;
  redo: () => void;
}

export const useScenarioStore = create<ScenarioEditorStore>()((set, get) => ({
  document: createSeedBattleScenario(),
  past: [],
  future: [],

  loadDocument: (document) =>
    set({
      document: structuredClone(document),
      past: [],
      future: [],
    }),

  createScenario: (input) => {
    try {
      const document = createScenarioDocument(input);
      get().loadDocument(document);
      return { ok: true, id: document.id };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : 'The scenario could not be created.',
      };
    }
  },

  renameDocument: (name) => {
    const trimmed = name.trim();
    if (!trimmed) return { ok: false, error: 'A scenario name is required.' };

    const state = get();
    if (trimmed === state.document.name) return { ok: true };

    const next = commit(state, {
      ...state.document,
      name: trimmed,
      updatedAt: timestamp(),
    });
    if (!next) return { ok: false, error: 'The scenario name is not valid.' };
    set(next);
    return { ok: true };
  },

  placeUnit: (unitId, position) => {
    const state = get();
    const phase = activeScenarioPhase(state.document);
    if (!phase) return { ok: false, error: 'The active phase could not be found.' };
    if (phase.unitStates[unitId]) {
      return { ok: false, error: 'That formation is already deployed in this phase.' };
    }

    const unit = state.document.rosterSnapshot.units.find((candidate) => candidate.id === unitId);
    if (!unit) return { ok: false, error: 'The selected formation could not be found.' };

    const deployedUnitIds = new Set(Object.keys(phase.unitStates));
    const unitStates = deployFormationStates(
      state.document.rosterSnapshot,
      unit,
      position,
      deployedUnitIds,
    );

    const next = commit(
      state,
      replaceActivePhase(state.document, (activePhase) => {
        const phases = state.document.phases.map((candidate) =>
          candidate.id === activePhase.id
            ? {
                ...candidate,
                unitStates: { ...candidate.unitStates, ...unitStates },
              }
            : candidate,
        );
        return phases;
      }),
    );
    if (!next)
      return { ok: false, error: schemaError(state.document) ?? 'The formation is not valid.' };

    set(next);
    return { ok: true };
  },

  updateUnitState: (unitId, patch) => {
    const state = get();
    const phase = activeScenarioPhase(state.document);
    if (!phase) return { ok: false, error: 'The active phase could not be found.' };

    const current = phase.unitStates[unitId];
    if (!current) return { ok: false, error: 'That formation is not deployed in this phase.' };

    const normalized: Partial<UnitPhaseState> = { ...patch };
    if (patch.labelOverride !== undefined) {
      const label = patch.labelOverride.trim();
      normalized.labelOverride = label === '' ? undefined : label;
    }
    if (patch.notes !== undefined) {
      const notes = patch.notes.trim();
      normalized.notes = notes === '' ? undefined : notes;
    }

    const nextState: UnitPhaseState = { ...current, ...normalized };

    const next = commit(
      state,
      replaceActivePhase(state.document, (activePhase) => {
        return state.document.phases.map((candidate) =>
          candidate.id === activePhase.id
            ? {
                ...candidate,
                unitStates: { ...candidate.unitStates, [unitId]: nextState },
              }
            : candidate,
        );
      }),
    );
    if (!next) return { ok: false, error: 'The formation state is not valid.' };

    set(next);
    return { ok: true };
  },

  undeployUnit: (unitId) => {
    const state = get();
    const phase = activeScenarioPhase(state.document);
    if (!phase) return { ok: false, error: 'The active phase could not be found.' };
    if (!phase.unitStates[unitId]) {
      return { ok: false, error: 'That formation is not deployed in this phase.' };
    }

    const next = commit(
      state,
      replaceActivePhase(state.document, (activePhase) => {
        return state.document.phases.map((candidate) => {
          if (candidate.id !== activePhase.id) return candidate;
          const unitStates = { ...candidate.unitStates };
          delete unitStates[unitId];
          return { ...candidate, unitStates };
        });
      }),
    );
    if (!next) return { ok: false, error: 'The formation could not be removed.' };

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
