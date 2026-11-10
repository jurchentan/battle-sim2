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
  regiment: 80,
  other: 100,
};

/**
 * Default map-label size in world units for each echelon. Formations above the
 * roster's smallest unit render as text, so higher echelons get larger text.
 */
export const DEFAULT_FORMATION_FONT_SIZES: Record<UnitEchelon, number> = {
  army: 76,
  corps: 56,
  division: 40,
  brigade: 28,
  regiment: 22,
  other: 28,
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
  regiment: 'shortened',
  other: 'shortened',
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
  regiment: 'Regiment',
  other: 'Formation',
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
  roster: ArmyRoster;
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
 * Creates a self-contained scenario from deep copies of a saved terrain map
 * and roster. Later edits to the library sources cannot reach these snapshots.
 */
export function createScenarioDocument(input: NewScenarioInput): BattleScenario {
  const phaseId = createId();
  const now = new Date().toISOString();
  const scenario: BattleScenario = {
    schemaVersion: SCHEMA_VERSION,
    id: createId(),
    name: input.name.trim(),
    ...(input.description?.trim() ? { description: input.description.trim() } : {}),
    terrainSnapshot: structuredClone(input.terrain),
    rosterSnapshot: structuredClone(input.roster),
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
  const roster = scenario.rosterSnapshot;

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
): UnitPhaseState {
  return {
    x: position.x,
    y: position.y,
    rotationDegrees: 0,
    frontageLength: defaultFrontageLength(unit.echelon),
    visible: true,
    effectiveStrength: effectiveUnitStrength(roster, unit.id) ?? unit.initialStrength,
    status: 'reserve',
  };
}

const FORMATION_ROW_GAP = 140;
const FORMATION_COLUMN_GAP = 40;

function formationDescendants(roster: ArmyRoster, unitId: string): UnitDefinition[] {
  const descendants: UnitDefinition[] = [];
  const seen = new Set<string>();

  const visit = (parentId: string): void => {
    for (const child of unitChildren(roster, parentId)) {
      if (seen.has(child.id)) continue;
      seen.add(child.id);
      descendants.push(child);
      visit(child.id);
    }
  };

  visit(unitId);
  return descendants;
}

/**
 * Deploys a parent formation and every undeployed subordinate. Subordinates
 * form one centered row per echelon, smallest formations at the front, with the
 * parent at the requested position behind them.
 */
export function deployFormationStates(
  roster: ArmyRoster,
  parent: UnitDefinition,
  position: Point,
  deployedUnitIds: ReadonlySet<string> = new Set(),
): Record<string, UnitPhaseState> {
  const states: Record<string, UnitPhaseState> = {};
  if (!deployedUnitIds.has(parent.id)) {
    states[parent.id] = defaultUnitPhaseState(roster, parent, position);
  }

  const rows = new Map<number, UnitDefinition[]>();
  for (const unit of formationDescendants(roster, parent.id)) {
    if (deployedUnitIds.has(unit.id)) continue;
    const rank = echelonRank(unit.echelon);
    rows.set(rank, [...(rows.get(rank) ?? []), unit]);
  }

  const orderedRows = [...rows.entries()]
    .sort(([rankA], [rankB]) => rankB - rankA)
    .map(([, units]) => units.sort((a, b) => a.id.localeCompare(b.id)));

  orderedRows.forEach((units, rowIndex) => {
    const rowY = position.y - (orderedRows.length - rowIndex) * FORMATION_ROW_GAP;
    const widths = units.map((unit) =>
      Math.max(defaultFrontageLength(unit.echelon), DEFAULT_FORMATION_FONT_SIZES[unit.echelon] * 4),
    );
    const totalWidth =
      widths.reduce((sum, width) => sum + width, 0) +
      Math.max(0, units.length - 1) * FORMATION_COLUMN_GAP;
    let cursorX = position.x - totalWidth / 2;

    units.forEach((unit, index) => {
      const width = widths[index] ?? defaultFrontageLength(unit.echelon);
      states[unit.id] = defaultUnitPhaseState(roster, unit, {
        x: cursorX + width / 2,
        y: rowY,
      });
      cursorX += width + FORMATION_COLUMN_GAP;
    });
  });

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
