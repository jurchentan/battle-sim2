import {
  SCHEMA_VERSION,
  battleScenarioSchema,
  createId,
  type ArmyRoster,
  type BattlePhase,
  type BattleScenario,
  type Point,
  type TerrainFeature,
  type TerrainMap,
  type UnitDefinition,
  type UnitEchelon,
  type UnitPhaseState,
} from '../../models';
import {
  createBlankRoster,
  effectiveUnitStrength,
  echelonRank,
  factionNamingMode,
  unitChildren,
  unitDisplayName,
  unitDynamicName,
} from '../army/rosterDocuments';

/** Default frontage drawn when a formation is first deployed. */
export const DEFAULT_FRONTAGE_BY_ECHELON: Record<UnitEchelon, number> = {
  army: 280,
  corps: 230,
  division: 180,
  brigade: 120,
};

export type FormationFrontages = Record<UnitEchelon, number>;

export const DEFAULT_FRONTAGE_LIMITS = { min: 20, max: 2000 } as const;

/**
 * Default map-label size in world units for each echelon. Formations above the
 * roster's smallest unit render as text, so higher echelons get larger text.
 */
export const DEFAULT_FORMATION_FONT_SIZES: Record<UnitEchelon, number> = {
  army: 32,
  corps: 25,
  division: 20,
  brigade: 15,
};

export type FormationFontSizes = Record<UnitEchelon, number>;

/**
 * How a formation name is written on the map. "none" hides the name while
 * keeping the formation symbol itself.
 */
export type FormationLabelFormat = 'full' | 'shortened' | 'commander' | 'none';

export type FormationLabelFormats = Record<UnitEchelon, FormationLabelFormat>;

export const DEFAULT_FORMATION_LABEL_FORMATS: FormationLabelFormats = {
  army: 'full',
  corps: 'full',
  division: 'full',
  brigade: 'shortened',
};

export const FORMATION_LABEL_FORMAT_OPTIONS: readonly {
  value: FormationLabelFormat;
  label: string;
}[] = [
  { value: 'full', label: 'Full name' },
  { value: 'shortened', label: 'Shortened' },
  { value: 'commander', label: 'Commander surname' },
  { value: 'none', label: 'No name' },
];

const ECHELON_NAME_WORDS: Record<UnitEchelon, string> = {
  army: 'Army',
  corps: 'Corps',
  division: 'Division',
  brigade: 'Brigade',
};

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function commanderSurname(commander?: string): string | null {
  const parts = commander?.trim().split(/\s+/).filter(Boolean) ?? [];
  return parts.at(-1) ?? null;
}

/** Removes a trailing echelon word (and optional possessive) from a unit name. */
export function shortenFormationName(label: string, echelon: UnitEchelon): string {
  const trimmed = label.trim();
  if (!trimmed) return trimmed;

  const suffix = new RegExp(
    `(?:['’]s?)?\\s+${escapeRegExp(ECHELON_NAME_WORDS[echelon])}\\s*$`,
    'i',
  );
  const shortened = trimmed.replace(suffix, '').trim();
  return shortened || trimmed;
}

/** Text between 90° and 270° would read upside down, so labels flip to stay legible. */
export function isUpsideDownRotation(rotationDegrees: number): boolean {
  const normalized = ((rotationDegrees % 360) + 360) % 360;
  return normalized > 90 && normalized < 270;
}

/**
 * Only formations at or below the roster's smallest-unit echelon render as
 * rectangular map symbols. Higher formations render as text labels.
 */
export function isRectangleFormation(
  echelon: UnitEchelon,
  smallestUnitEchelon: UnitEchelon,
): boolean {
  return echelonRank(echelon) >= echelonRank(smallestUnitEchelon);
}

export interface NewScenarioInput {
  name: string;
  description?: string;
  terrain: TerrainMap;
  /** Optional initial order of battle; new scenarios otherwise start empty. */
  orderOfBattle?: ArmyRoster;
}

export interface ScenarioBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function defaultFrontageLength(echelon: UnitEchelon): number {
  return DEFAULT_FRONTAGE_BY_ECHELON[echelon];
}

/**
 * Creates a self-contained scenario from a deep copy of a saved terrain map.
 * The scenario owns its order of battle; when none is supplied it starts empty
 * with brigades as the smallest formation. Later edits to library sources
 * cannot reach these snapshots.
 */
export function createScenarioDocument(input: NewScenarioInput): BattleScenario {
  const phaseId = createId();
  const now = new Date().toISOString();
  const name = input.name.trim();
  const orderOfBattle = input.orderOfBattle ?? createBlankRoster(`${name} order of battle`);
  const scenario: BattleScenario = {
    schemaVersion: SCHEMA_VERSION,
    id: createId(),
    name,
    ...(input.description?.trim() ? { description: input.description.trim() } : {}),
    terrainSnapshot: structuredClone(input.terrain),
    orderOfBattle: structuredClone(orderOfBattle),
    phases: [
      {
        id: phaseId,
        name: 'Initial deployment',
        order: 0,
        unitStates: {},
        annotations: [],
      },
    ],
    activePhaseId: phaseId,
    createdAt: now,
    updatedAt: now,
  };

  return battleScenarioSchema.parse(scenario);
}

export function activeScenarioPhase(scenario: BattleScenario): BattlePhase | null {
  return scenario.phases.find((phase) => phase.id === scenario.activePhaseId) ?? null;
}

export function scenarioUnitState(
  scenario: BattleScenario,
  unitId: string,
): UnitPhaseState | undefined {
  return activeScenarioPhase(scenario)?.unitStates[unitId];
}

/** Frontage lengths are calibrated against a formation of roughly this strength. */
export const FRONTAGE_BASELINE_STRENGTH = 3000;

/**
 * Optionally scales a formation's rendered frontage linearly with its strength.
 * The stored frontage remains the length for a baseline 3,000-strong formation.
 */
export function renderedFrontageLength(
  frontageLength: number,
  strength: number | null,
  dynamic: boolean,
): number {
  if (!dynamic) return frontageLength;
  const normalized = strength === null ? FRONTAGE_BASELINE_STRENGTH : Math.max(0, strength);
  return Math.max(6, (frontageLength * normalized) / FRONTAGE_BASELINE_STRENGTH);
}

export function scenarioUnitLabel(
  scenario: BattleScenario,
  unit: UnitDefinition,
  state?: UnitPhaseState,
  format: FormationLabelFormat = 'full',
): string {
  if (format === 'none') return '';

  const override = state?.labelOverride?.trim();
  const roster = scenario.orderOfBattle;

  if (override) {
    return format === 'shortened' ? shortenFormationName(override, unit.echelon) : override;
  }

  if (format === 'commander') {
    const surname = commanderSurname(unit.commander);
    if (surname) return surname;
  }

  if (format === 'shortened') {
    const customName = unit.customName?.trim();
    if (customName) return shortenFormationName(customName, unit.echelon);

    if (factionNamingMode(roster, unit.factionId, unit.echelon) === 'commander') {
      const surname = commanderSurname(unit.commander);
      if (surname) return surname;
    }

    return shortenFormationName(unitDynamicName(roster, unit), unit.echelon);
  }

  return unitDisplayName(roster, unit);
}

/**
 * Builds the phase-local deployment state for a unit. Frontage is graphic size;
 * strength starts from the roster's derived formation strength.
 */
export function defaultUnitPhaseState(
  roster: ArmyRoster,
  unit: UnitDefinition,
  position: Point,
  frontageLength = defaultFrontageLength(unit.echelon),
): UnitPhaseState {
  return {
    x: position.x,
    y: position.y,
    rotationDegrees: 180,
    frontageLength,
    visible: true,
    effectiveStrength: effectiveUnitStrength(roster, unit.id) ?? unit.initialStrength,
    status: 'reserve',
  };
}

const FORMATION_ROW_GAP = 140;
const FORMATION_COLUMN_GAP = 40;

interface FormationLayoutNode {
  unit: UnitDefinition;
  width: number;
  subtreeWidth: number;
  children: FormationLayoutNode[];
}

function formationNodeWidth(
  unit: UnitDefinition,
  frontageFor: (unit: UnitDefinition) => number,
): number {
  return Math.max(frontageFor(unit), DEFAULT_FORMATION_FONT_SIZES[unit.echelon] * 4);
}

function childrenLayoutWidth(children: readonly FormationLayoutNode[]): number {
  return (
    children.reduce((sum, child) => sum + child.subtreeWidth, 0) +
    Math.max(0, children.length - 1) * FORMATION_COLUMN_GAP
  );
}

function buildFormationLayout(
  roster: ArmyRoster,
  unit: UnitDefinition,
  deployedUnitIds: ReadonlySet<string>,
  frontageFor: (unit: UnitDefinition) => number,
): FormationLayoutNode {
  const children = unitChildren(roster, unit.id).flatMap((child) =>
    deployedUnitIds.has(child.id)
      ? buildFormationForest(roster, child.id, deployedUnitIds, frontageFor)
      : [buildFormationLayout(roster, child, deployedUnitIds, frontageFor)],
  );
  const width = formationNodeWidth(unit, frontageFor);
  return {
    unit,
    width,
    subtreeWidth: Math.max(width, childrenLayoutWidth(children)),
    children,
  };
}

/**
 * Undeployed subordinates of an already-deployed formation cannot be attached
 * to that formation's layout node, so promote them to the nearest new ancestor.
 */
function buildFormationForest(
  roster: ArmyRoster,
  parentUnitId: string,
  deployedUnitIds: ReadonlySet<string>,
  frontageFor: (unit: UnitDefinition) => number,
): FormationLayoutNode[] {
  return unitChildren(roster, parentUnitId).flatMap((child) =>
    deployedUnitIds.has(child.id)
      ? buildFormationForest(roster, child.id, deployedUnitIds, frontageFor)
      : [buildFormationLayout(roster, child, deployedUnitIds, frontageFor)],
  );
}

function assignFormationPositions(
  node: FormationLayoutNode,
  centerX: number,
  centerY: number,
  roster: ArmyRoster,
  states: Record<string, UnitPhaseState>,
  frontageFor: (unit: UnitDefinition) => number,
  recordState: boolean,
): void {
  if (recordState) {
    states[node.unit.id] = defaultUnitPhaseState(
      roster,
      node.unit,
      { x: centerX, y: centerY },
      frontageFor(node.unit),
    );
  }

  if (node.children.length === 0) return;
  let cursor = centerX - childrenLayoutWidth(node.children) / 2;
  for (const child of node.children) {
    assignFormationPositions(
      child,
      cursor + child.subtreeWidth / 2,
      centerY - FORMATION_ROW_GAP,
      roster,
      states,
      frontageFor,
      true,
    );
    cursor += child.subtreeWidth + FORMATION_COLUMN_GAP;
  }
}

/**
 * Deploys a parent formation and every undeployed subordinate. The layout is a
 * tidy tree: children sit side by side in front of their parent, and each parent
 * is centered behind its own children so separate branches never share one
 * global echelon row. Already-deployed subordinates keep their positions.
 */
export function deployFormationStates(
  roster: ArmyRoster,
  parent: UnitDefinition,
  position: Point,
  deployedUnitIds: ReadonlySet<string> = new Set(),
  frontageByEchelon: Partial<FormationFrontages> = {},
): Record<string, UnitPhaseState> {
  const frontageFor = (unit: UnitDefinition): number =>
    frontageByEchelon[unit.echelon] ?? defaultFrontageLength(unit.echelon);

  const states: Record<string, UnitPhaseState> = {};
  const layout = buildFormationLayout(roster, parent, deployedUnitIds, frontageFor);
  assignFormationPositions(
    layout,
    position.x,
    position.y,
    roster,
    states,
    frontageFor,
    !deployedUnitIds.has(parent.id),
  );

  return states;
}

/** Approximate world-space bounds used only for the read-only terrain selection outline. */
export function terrainFeatureBounds(feature: TerrainFeature): ScenarioBounds {
  switch (feature.geometry.type) {
    case 'polygon':
    case 'polyline': {
      const xs = feature.geometry.points.map((point) => point.x);
      const ys = feature.geometry.points.map((point) => point.y);
      const minX = Math.min(...xs);
      const minY = Math.min(...ys);
      return {
        x: minX,
        y: minY,
        width: Math.max(1, Math.max(...xs) - minX),
        height: Math.max(1, Math.max(...ys) - minY),
      };
    }
    case 'point': {
      const size = feature.kind === 'building' ? 18 : 28;
      return {
        x: feature.geometry.position.x - size / 2,
        y: feature.geometry.position.y - size / 2,
        width: size,
        height: size,
      };
    }
    case 'textAnchor': {
      const fontSize = feature.style.type === 'text' ? feature.style.fontSize : 20;
      const width = Math.max(60, (feature.name?.length ?? 5) * fontSize * 0.58);
      return {
        x: feature.geometry.position.x,
        y: feature.geometry.position.y - fontSize,
        width,
        height: fontSize * 1.4,
      };
    }
  }
}
