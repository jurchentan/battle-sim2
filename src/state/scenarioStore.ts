import { create } from 'zustand';
import {
  battleScenarioSchema,
  createSeedBattleScenario,
  type BattleScenario,
  type Faction,
  type Point,
  type UnitPhaseState,
} from '../models';
import {
  generateArmy,
  type ArmyGeneratorInput,
  type GenerateArmyResult,
} from '../features/army/armyGenerator';
import {
  addFaction as addFactionMutation,
  addUnit as addUnitMutation,
  deleteFaction as deleteFactionMutation,
  deleteUnit as deleteUnitMutation,
  reparentUnit as reparentUnitMutation,
  updateFaction as updateFactionMutation,
  updateUnit as updateUnitMutation,
  type NewFactionInput,
  type NewUnitInput,
  type UnitPatch,
} from '../features/army/rosterMutations';
import {
  activeScenarioPhase,
  createScenarioDocument,
  deployFormationStates,
  type FormationFrontages,
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

export type ScenarioArmyResult = ScenarioMutationResult & {
  factionId?: string;
  factionName?: string;
  unitIds?: string[];
  rootUnitIds?: string[];
};

export interface ScenarioEditorStore {
  document: BattleScenario;
  past: BattleScenario[];
  future: BattleScenario[];
  loadDocument: (document: BattleScenario) => void;
  createScenario: (input: NewScenarioInput) => ScenarioCreateResult;
  renameDocument: (name: string) => ScenarioMutationResult;
  addFaction: (input: NewFactionInput) => ScenarioCreateResult;
  updateFaction: (factionId: string, patch: Partial<Omit<Faction, 'id'>>) => ScenarioMutationResult;
  deleteFaction: (factionId: string) => ScenarioMutationResult;
  addUnit: (input: NewUnitInput) => ScenarioCreateResult;
  updateUnit: (unitId: string, patch: UnitPatch) => ScenarioMutationResult;
  reparentUnit: (unitId: string, parentUnitId: string | null) => ScenarioMutationResult;
  deleteUnit: (unitId: string) => ScenarioMutationResult;
  generateArmy: (input: ArmyGeneratorInput) => ScenarioArmyResult;
  placeUnit: (
    unitId: string,
    position: Point,
    frontageByEchelon?: Partial<FormationFrontages>,
  ) => ScenarioMutationResult;
  updateUnitState: (unitId: string, patch: Partial<UnitPhaseState>) => ScenarioMutationResult;
  updateUnitStates: (patches: Record<string, Partial<UnitPhaseState>>) => ScenarioMutationResult;
  undeployUnit: (unitId: string) => ScenarioMutationResult;
  undeployUnits: (unitIds: readonly string[]) => ScenarioMutationResult;
  undo: () => void;
  redo: () => void;
}

function normalizeUnitStatePatch(patch: Partial<UnitPhaseState>): Partial<UnitPhaseState> {
  const normalized: Partial<UnitPhaseState> = { ...patch };
  if (patch.labelOverride !== undefined) {
    const label = patch.labelOverride.trim();
    normalized.labelOverride = label === '' ? undefined : label;
  }
  if (patch.notes !== undefined) {
    const notes = patch.notes.trim();
    normalized.notes = notes === '' ? undefined : notes;
  }
  return normalized;
}

/**
 * Removes a unit from every phase and clears annotation links. Deleting the
 * unit and its phase footprint must happen in one history entry.
 */
function cascadeDeletedUnit(document: BattleScenario, unitId: string): BattleScenario {
  return {
    ...document,
    phases: document.phases.map((phase) => {
      const unitStates = { ...phase.unitStates };
      delete unitStates[unitId];

      let annotationsChanged = false;
      const annotations = phase.annotations.map((annotation) => {
        if (annotation.linkedUnitId !== unitId) return annotation;
        annotationsChanged = true;
        const { linkedUnitId: _linkedUnitId, ...rest } = annotation;
        return rest;
      });

      return {
        ...phase,
        unitStates,
        annotations: annotationsChanged ? annotations : phase.annotations,
      };
    }),
  };
}

function withOrderOfBattle(
  document: BattleScenario,
  orderOfBattle: BattleScenario['orderOfBattle'],
): BattleScenario {
  return {
    ...document,
    orderOfBattle,
    updatedAt: timestamp(),
  };
}

export const useScenarioStore = create<ScenarioEditorStore>()((set, get) => ({
  document: createSeedBattleScenario(),
  past: [],
  future: [],

  loadDocument: (document) => {
    const parsed = battleScenarioSchema.safeParse(structuredClone(document));
    set({
      document: parsed.success ? parsed.data : structuredClone(document),
      past: [],
      future: [],
    });
  },

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

  addFaction: (input) => {
    const state = get();
    const result = addFactionMutation(state.document.orderOfBattle, input);
    if (!result.ok) return { ok: false, error: result.error };

    const next = commit(state, withOrderOfBattle(state.document, result.document));
    if (!next) return { ok: false, error: 'The faction is not valid.' };
    set(next);
    return { ok: true, id: result.id };
  },

  updateFaction: (factionId, patch) => {
    const state = get();
    const result = updateFactionMutation(state.document.orderOfBattle, factionId, patch);
    if (!result.ok) return { ok: false, error: result.error };

    const next = commit(state, withOrderOfBattle(state.document, result.document));
    if (!next) return { ok: false, error: 'The faction is not valid.' };
    set(next);
    return { ok: true };
  },

  deleteFaction: (factionId) => {
    const state = get();
    const result = deleteFactionMutation(state.document.orderOfBattle, factionId);
    if (!result.ok) return { ok: false, error: result.error };

    const next = commit(state, withOrderOfBattle(state.document, result.document));
    if (!next) return { ok: false, error: 'The faction could not be deleted.' };
    set(next);
    return { ok: true };
  },

  addUnit: (input) => {
    const state = get();
    const result = addUnitMutation(state.document.orderOfBattle, input);
    if (!result.ok) return { ok: false, error: result.error };

    const next = commit(state, withOrderOfBattle(state.document, result.document));
    if (!next) return { ok: false, error: 'The unit is not valid.' };
    set(next);
    return { ok: true, id: result.id };
  },

  updateUnit: (unitId, patch) => {
    const state = get();
    const result = updateUnitMutation(state.document.orderOfBattle, unitId, patch);
    if (!result.ok) return { ok: false, error: result.error };

    const next = commit(state, withOrderOfBattle(state.document, result.document));
    if (!next) return { ok: false, error: 'The unit is not valid.' };
    set(next);
    return { ok: true };
  },

  reparentUnit: (unitId, parentUnitId) => {
    const state = get();
    const result = reparentUnitMutation(state.document.orderOfBattle, unitId, parentUnitId);
    if (!result.ok) return { ok: false, error: result.error };

    const next = commit(state, withOrderOfBattle(state.document, result.document));
    if (!next) return { ok: false, error: 'The unit is not valid.' };
    set(next);
    return { ok: true };
  },

  deleteUnit: (unitId) => {
    const state = get();
    const result = deleteUnitMutation(state.document.orderOfBattle, unitId);
    if (!result.ok) return { ok: false, error: result.error };

    const next = commit(
      state,
      cascadeDeletedUnit(withOrderOfBattle(state.document, result.document), unitId),
    );
    if (!next) return { ok: false, error: 'The unit could not be deleted.' };
    set(next);
    return { ok: true };
  },

  generateArmy: (input) => {
    const state = get();
    const result: GenerateArmyResult = generateArmy(state.document.orderOfBattle, input);
    if (!result.ok) return { ok: false, error: result.error };

    const next = commit(state, withOrderOfBattle(state.document, result.document));
    if (!next) return { ok: false, error: 'The generated army is not valid.' };
    set(next);
    return {
      ok: true,
      factionId: result.factionId,
      factionName: result.factionName,
      unitIds: result.unitIds,
      rootUnitIds: result.rootUnitIds,
    };
  },

  placeUnit: (unitId, position, frontageByEchelon) => {
    const state = get();
    const phase = activeScenarioPhase(state.document);
    if (!phase) return { ok: false, error: 'The active phase could not be found.' };
    if (phase.unitStates[unitId]) {
      return { ok: false, error: 'That formation is already deployed in this phase.' };
    }

    const unit = state.document.orderOfBattle.units.find((candidate) => candidate.id === unitId);
    if (!unit) return { ok: false, error: 'The selected formation could not be found.' };

    const deployedUnitIds = new Set(Object.keys(phase.unitStates));
    const unitStates = deployFormationStates(
      state.document.orderOfBattle,
      unit,
      position,
      deployedUnitIds,
      frontageByEchelon,
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

    const nextState: UnitPhaseState = { ...current, ...normalizeUnitStatePatch(patch) };

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

  updateUnitStates: (patches) => {
    const state = get();
    const phase = activeScenarioPhase(state.document);
    if (!phase) return { ok: false, error: 'The active phase could not be found.' };

    const unitIds = Object.keys(patches);
    if (unitIds.length === 0) return { ok: true };

    for (const unitId of unitIds) {
      if (!phase.unitStates[unitId]) {
        return { ok: false, error: 'A selected formation is not deployed in this phase.' };
      }
    }

    const nextStates: Record<string, UnitPhaseState> = {};
    for (const unitId of unitIds) {
      const current = phase.unitStates[unitId];
      const patch = patches[unitId];
      if (!current || !patch) continue;
      nextStates[unitId] = { ...current, ...normalizeUnitStatePatch(patch) };
    }

    const next = commit(
      state,
      replaceActivePhase(state.document, (activePhase) => {
        return state.document.phases.map((candidate) =>
          candidate.id === activePhase.id
            ? { ...candidate, unitStates: { ...candidate.unitStates, ...nextStates } }
            : candidate,
        );
      }),
    );
    if (!next) return { ok: false, error: 'The selected formation states are not valid.' };

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

  undeployUnits: (unitIds) => {
    const state = get();
    const phase = activeScenarioPhase(state.document);
    if (!phase) return { ok: false, error: 'The active phase could not be found.' };

    const deployedUnitIds = [...new Set(unitIds)].filter((unitId) => phase.unitStates[unitId]);
    if (deployedUnitIds.length === 0) return { ok: true };

    const next = commit(
      state,
      replaceActivePhase(state.document, (activePhase) => {
        return state.document.phases.map((candidate) => {
          if (candidate.id !== activePhase.id) return candidate;
          const unitStates = { ...candidate.unitStates };
          for (const unitId of deployedUnitIds) {
            delete unitStates[unitId];
          }
          return { ...candidate, unitStates };
        });
      }),
    );
    if (!next) return { ok: false, error: 'The formations could not be removed.' };

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
