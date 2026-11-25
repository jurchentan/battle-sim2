import {
  armyRosterSchema,
  createId,
  defaultFactionNamingModes,
  defaultFactionStrengths,
  type ArmyRoster,
  type Faction,
  type UnitDefinition,
  type UnitEchelon,
  type UnitType,
} from '../../models';
import { defaultSymbolStyle } from './rosterDocuments';

export const GENERATOR_ARMS = ['infantry', 'cavalry', 'artillery'] as const;
export type GeneratorArm = (typeof GENERATOR_ARMS)[number];

export type ArmyStructure = 'independent' | 'divisions' | 'corps' | 'army';

export type ArmyStrengthMode = 'average' | 'total';

export interface ArmyGeneratorArmInput {
  unitType: GeneratorArm;
  brigadeCount: number;
  strengthMode: ArmyStrengthMode;
  /** Average strength per brigade, or the exact total for the arm. */
  strengthValue: number;
}

export type ArmyGeneratorFactionInput =
  | { kind: 'existing'; factionId: string }
  | { kind: 'new'; name: string; color: string; labelColor?: string };

export interface ArmyGeneratorInput {
  faction: ArmyGeneratorFactionInput;
  structure: ArmyStructure;
  brigadesPerDivision?: number;
  divisionsPerCorps?: number;
  /** Optional custom name for the single army root. */
  armyName?: string;
  arms: ArmyGeneratorArmInput[];
}

export interface ArmyPlanNode {
  echelon: UnitEchelon;
  unitType: UnitType;
  customName?: string;
  initialStrength: number | null;
  children: ArmyPlanNode[];
}

export interface ArmyPlanSummary {
  brigadeCount: number;
  totalStrength: number;
  armyCount: number;
  corpsCount: number;
  divisionCount: number;
}

export type ArmyPlanResult =
  | { ok: true; roots: ArmyPlanNode[]; summary: ArmyPlanSummary; factionName?: string }
  | { ok: false; error: string };

export type GenerateArmyResult =
  | {
      ok: true;
      document: ArmyRoster;
      factionId: string;
      factionName: string;
      unitIds: string[];
      rootUnitIds: string[];
      summary: ArmyPlanSummary;
    }
  | { ok: false; error: string };

const ARMY_TREE_LABEL = 'army';

function chunk<T>(items: readonly T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function planNode(
  echelon: UnitEchelon,
  unitType: UnitType,
  children: ArmyPlanNode[] = [],
  options: { customName?: string; initialStrength?: number | null } = {},
): ArmyPlanNode {
  return {
    echelon,
    unitType,
    initialStrength: options.initialStrength ?? null,
    children,
    ...(options.customName ? { customName: options.customName } : {}),
  };
}

function sumBrigadeStrength(roots: readonly ArmyPlanNode[]): number {
  let total = 0;
  const visit = (node: ArmyPlanNode): void => {
    if (node.echelon === 'brigade') {
      total += node.initialStrength ?? 0;
    }
    for (const child of node.children) visit(child);
  };
  for (const root of roots) visit(root);
  return total;
}

function countEchelon(roots: readonly ArmyPlanNode[], echelon: UnitEchelon): number {
  let count = 0;
  const visit = (node: ArmyPlanNode): void => {
    if (node.echelon === echelon) count += 1;
    for (const child of node.children) visit(child);
  };
  for (const root of roots) visit(root);
  return count;
}

function summarizePlan(roots: readonly ArmyPlanNode[]): ArmyPlanSummary {
  return {
    brigadeCount: countEchelon(roots, 'brigade'),
    totalStrength: sumBrigadeStrength(roots),
    armyCount: countEchelon(roots, 'army'),
    corpsCount: countEchelon(roots, 'corps'),
    divisionCount: countEchelon(roots, 'division'),
  };
}

function brigadeStrength(arm: ArmyGeneratorArmInput): number {
  return arm.strengthMode === 'total' ? arm.strengthValue / arm.brigadeCount : arm.strengthValue;
}

function armBrigadeStrengths(arm: ArmyGeneratorArmInput): number[] {
  const strength = brigadeStrength(arm);
  return Array.from({ length: arm.brigadeCount }, () => strength);
}

function divisionNodes(
  arm: GeneratorArm,
  strengths: readonly number[],
  brigadesPerDivision: number,
): ArmyPlanNode[] {
  return chunk(strengths, brigadesPerDivision).map((divisionStrengths) =>
    planNode(
      'division',
      arm,
      divisionStrengths.map((strength) =>
        planNode('brigade', arm, [], { initialStrength: strength }),
      ),
    ),
  );
}

function corpsNodes(
  arm: GeneratorArm,
  divisions: readonly ArmyPlanNode[],
  divisionsPerCorps: number,
): ArmyPlanNode[] {
  return chunk(divisions, divisionsPerCorps).map((corpsDivisions) =>
    planNode('corps', arm, [...corpsDivisions]),
  );
}

/**
 * Builds the structural preview for a generated army without creating ids.
 * Invalid structures, counts, and strengths are rejected before any commit.
 */
export function planArmy(input: ArmyGeneratorInput): ArmyPlanResult {
  const activeArms = input.arms.filter((arm) => arm.brigadeCount > 0);
  if (activeArms.length === 0) {
    return { ok: false, error: 'Add at least one arm with a brigade count above zero.' };
  }

  for (const arm of input.arms) {
    if (!GENERATOR_ARMS.includes(arm.unitType)) {
      return { ok: false, error: 'Each arm must be infantry, cavalry, or artillery.' };
    }
    if (!Number.isInteger(arm.brigadeCount) || arm.brigadeCount < 0) {
      return { ok: false, error: 'Brigade counts must be whole numbers of zero or more.' };
    }
    if (arm.brigadeCount > 0) {
      if (arm.strengthMode !== 'average' && arm.strengthMode !== 'total') {
        return { ok: false, error: 'Choose an average or exact strength mode for each arm.' };
      }
      if (!Number.isFinite(arm.strengthValue) || arm.strengthValue <= 0) {
        return {
          ok: false,
          error: 'Strength values must be positive when the arm has brigades.',
        };
      }
    }
  }

  const needsDivisions = input.structure !== 'independent';
  if (needsDivisions) {
    const value = input.brigadesPerDivision;
    if (!Number.isInteger(value) || (value ?? 0) < 1) {
      return { ok: false, error: 'Brigades per division must be a whole number of one or more.' };
    }
  }

  const needsCorps = input.structure === 'corps' || input.structure === 'army';
  if (needsCorps) {
    const value = input.divisionsPerCorps;
    if (!Number.isInteger(value) || (value ?? 0) < 1) {
      return { ok: false, error: 'Divisions per corps must be a whole number of one or more.' };
    }
  }

  const armyName = input.armyName?.trim();
  const roots: ArmyPlanNode[] = [];

  if (input.structure === 'independent') {
    for (const arm of activeArms) {
      for (const strength of armBrigadeStrengths(arm)) {
        roots.push(planNode('brigade', arm.unitType, [], { initialStrength: strength }));
      }
    }
    return { ok: true, roots, summary: summarizePlan(roots) };
  }

  const brigadesPerDivision = input.brigadesPerDivision as number;
  const divisionsByArm = activeArms.map((arm) => ({
    arm: arm.unitType,
    divisions: divisionNodes(arm.unitType, armBrigadeStrengths(arm), brigadesPerDivision),
  }));

  if (input.structure === 'divisions') {
    for (const entry of divisionsByArm) {
      roots.push(...entry.divisions);
    }
    return { ok: true, roots, summary: summarizePlan(roots) };
  }

  const divisionsPerCorps = input.divisionsPerCorps as number;
  const corpsByArm = divisionsByArm.map((entry) => ({
    arm: entry.arm,
    corps: corpsNodes(entry.arm, entry.divisions, divisionsPerCorps),
  }));

  if (input.structure === 'corps') {
    for (const entry of corpsByArm) {
      roots.push(...entry.corps);
    }
    return { ok: true, roots, summary: summarizePlan(roots) };
  }

  const army = planNode(
    'army',
    'other',
    corpsByArm.flatMap((entry) => entry.corps),
    { customName: armyName || undefined },
  );
  roots.push(army);
  return { ok: true, roots, summary: summarizePlan(roots) };
}

function resolveFaction(
  document: ArmyRoster,
  input: ArmyGeneratorFactionInput,
): { ok: true; faction: Faction; next: ArmyRoster } | { ok: false; error: string } {
  if (input.kind === 'existing') {
    const faction = document.factions.find((candidate) => candidate.id === input.factionId);
    if (!faction) return { ok: false, error: 'Choose a faction for the generated army.' };
    return { ok: true, faction, next: document };
  }

  const name = input.name.trim();
  if (!name) return { ok: false, error: 'A faction name is required.' };
  const color = input.color.trim();
  if (!color) return { ok: false, error: 'A faction color is required.' };

  const faction: Faction = {
    id: createId(),
    name,
    color,
    ...(input.labelColor ? { labelColor: input.labelColor } : {}),
    namingModes: defaultFactionNamingModes(),
    defaultStrengths: defaultFactionStrengths(),
  };

  return {
    ok: true,
    faction,
    next: {
      ...document,
      factions: [...document.factions, faction],
    },
  };
}

function instantiatePlan(
  node: ArmyPlanNode,
  parentUnitId: string | null,
  faction: Faction,
  units: UnitDefinition[],
): string[] {
  const unit: UnitDefinition = {
    id: createId(),
    factionId: faction.id,
    echelon: node.echelon,
    unitType: node.unitType,
    parentUnitId,
    initialStrength: node.initialStrength,
    defaultSymbolStyle: defaultSymbolStyle(faction.color),
    ...(node.customName ? { customName: node.customName } : {}),
  };

  units.push(unit);
  const ids = [unit.id];
  for (const child of node.children) {
    ids.push(...instantiatePlan(child, unit.id, faction, units));
  }
  return ids;
}

/**
 * Appends one homogeneous army to the roster. The whole army is built before
 * schema validation, so callers can commit it as a single history entry.
 */
export function generateArmy(document: ArmyRoster, input: ArmyGeneratorInput): GenerateArmyResult {
  const plan = planArmy(input);
  if (!plan.ok) return plan;

  const resolved = resolveFaction(document, input.faction);
  if (!resolved.ok) return resolved;

  const units: UnitDefinition[] = [];
  const rootUnitIds: string[] = [];
  for (const root of plan.roots) {
    const ids = instantiatePlan(root, null, resolved.faction, units);
    if (ids[0]) rootUnitIds.push(ids[0]);
  }

  const next: ArmyRoster = {
    ...resolved.next,
    units: [...resolved.next.units, ...units],
    updatedAt: new Date().toISOString(),
  };

  const parsed = armyRosterSchema.safeParse(next);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return {
      ok: false,
      error: issue?.message ?? 'The generated army is not valid.',
    };
  }

  return {
    ok: true,
    document: parsed.data,
    factionId: resolved.faction.id,
    factionName: resolved.faction.name,
    unitIds: units.map((unit) => unit.id),
    rootUnitIds,
    summary: plan.summary,
  };
}

/** Human-readable preview line, e.g. "Army · 4 corps · 10 divisions · 24 brigades". */
export function armyPlanSummaryLabel(summary: ArmyPlanSummary): string {
  const parts: string[] = [];
  if (summary.armyCount > 0) {
    parts.push(`${summary.armyCount} ${summary.armyCount === 1 ? ARMY_TREE_LABEL : 'armies'}`);
  }
  if (summary.corpsCount > 0) {
    parts.push(`${summary.corpsCount} corps`);
  }
  if (summary.divisionCount > 0) {
    parts.push(`${summary.divisionCount} division${summary.divisionCount === 1 ? '' : 's'}`);
  }
  if (summary.brigadeCount > 0) {
    parts.push(`${summary.brigadeCount} brigade${summary.brigadeCount === 1 ? '' : 's'}`);
  }
  return parts.join(' · ');
}
