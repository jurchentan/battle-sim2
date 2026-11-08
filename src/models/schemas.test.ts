import { describe, expect, it } from 'vitest';
import {
  armyRosterSchema,
  battleScenarioSchema,
  terrainMapSchema,
  type ArmyRoster,
  type BattleScenario,
  type UnitDefinition,
} from './schemas';
import {
  createSeedBattleScenario,
  createSeedDocuments,
  createSeedRoster,
  createSeedTerrainMap,
} from './seed';
import { MAX_TERRAIN_DIMENSION } from './terrainCanvas';

interface ValidationResult {
  success: boolean;
  error?: { issues: { message: string }[] };
}

function expectFailure(result: ValidationResult, messagePart?: string): void {
  expect(result.success).toBe(false);
  if (messagePart) {
    const messages = result.error?.issues.map((issue) => issue.message).join(' | ') ?? '';
    expect(messages).toContain(messagePart);
  }
}

function getUnit(roster: ArmyRoster, unitId: string): UnitDefinition {
  const unit = roster.units.find((candidate) => candidate.id === unitId);
  if (!unit) {
    throw new Error(`Missing seeded unit "${unitId}"`);
  }
  return unit;
}

function getPhase(scenario: BattleScenario, phaseId: string) {
  const phase = scenario.phases.find((candidate) => candidate.id === phaseId);
  if (!phase) {
    throw new Error(`Missing seeded phase "${phaseId}"`);
  }
  return phase;
}

function roundTrip<T>(document: T): unknown {
  return JSON.parse(JSON.stringify(document)) as unknown;
}

describe('seed documents', () => {
  it('validates the seeded terrain, roster, and scenario', () => {
    const documents = createSeedDocuments();

    expect(terrainMapSchema.safeParse(documents.terrain).success).toBe(true);
    expect(armyRosterSchema.safeParse(documents.roster).success).toBe(true);
    expect(battleScenarioSchema.safeParse(documents.scenario).success).toBe(true);
  });

  it('is deterministic and returns independent copies', () => {
    const first = createSeedDocuments();
    const second = createSeedDocuments();

    expect(first).toEqual(second);
    expect(first.terrain).not.toBe(second.terrain);
    expect(first.scenario.terrainSnapshot).not.toBe(first.terrain);
    expect(first.scenario.rosterSnapshot).not.toBe(first.roster);
  });

  it('keeps scenario snapshots independent from source documents', () => {
    const documents = createSeedDocuments();
    documents.terrain.features[0].name = 'Changed terrain';
    documents.roster.units[0].name = 'Changed roster';

    expect(documents.scenario.terrainSnapshot.features[0].name).toBe('North Wood');
    expect(documents.scenario.rosterSnapshot.units[0].name).toBe('Army of the North');
  });

  it('keeps seeded phase state deeply isolated', () => {
    const scenario = createSeedBattleScenario();
    const initialPhase = getPhase(scenario, 'phase-initial');
    const attackPhase = getPhase(scenario, 'phase-attack');

    const initialBrigade = initialPhase.unitStates['unit-north-brigade-1'];
    const attackBrigade = attackPhase.unitStates['unit-north-brigade-1'];
    if (!initialBrigade || !attackBrigade) {
      throw new Error('Missing seeded brigade state');
    }

    expect(initialBrigade).not.toBe(attackBrigade);
    expect(initialPhase.annotations).not.toBe(attackPhase.annotations);

    initialBrigade.x = 9999;
    initialPhase.annotations[0].label = 'Changed annotation';

    expect(attackBrigade.x).not.toBe(9999);
    expect(attackPhase.annotations[0].label).not.toBe('Changed annotation');
  });

  it('round-trips every document through JSON', () => {
    const documents = createSeedDocuments();

    const terrainResult = terrainMapSchema.safeParse(roundTrip(documents.terrain));
    const rosterResult = armyRosterSchema.safeParse(roundTrip(documents.roster));
    const scenarioResult = battleScenarioSchema.safeParse(roundTrip(documents.scenario));

    expect(terrainResult.success).toBe(true);
    expect(rosterResult.success).toBe(true);
    expect(scenarioResult.success).toBe(true);

    if (terrainResult.success && rosterResult.success && scenarioResult.success) {
      expect(terrainResult.data).toEqual(documents.terrain);
      expect(rosterResult.data).toEqual(documents.roster);
      expect(scenarioResult.data).toEqual(documents.scenario);
    }
  });
});

describe('terrain validation', () => {
  it('rejects duplicate layer ids', () => {
    const terrain = createSeedTerrainMap();
    terrain.layers.push({ ...terrain.layers[0], name: 'Duplicate layer' });

    expectFailure(terrainMapSchema.safeParse(terrain), 'Duplicate terrain layer id');
  });

  it('rejects features on unknown layers', () => {
    const terrain = createSeedTerrainMap();
    terrain.features[0].layerId = 'layer-missing';

    expectFailure(terrainMapSchema.safeParse(terrain), 'unknown layer');
  });

  it('rejects geometry that does not match the feature kind', () => {
    const terrain = createSeedTerrainMap();
    const forest = terrain.features.find((feature) => feature.kind === 'forest');
    if (!forest) {
      throw new Error('Missing seeded forest');
    }
    forest.geometry = {
      type: 'polyline',
      points: [
        { x: 0, y: 0 },
        { x: 10, y: 10 },
      ],
    };

    expectFailure(terrainMapSchema.safeParse(terrain), 'forest features require polygon geometry');
  });

  it('requires text for label features', () => {
    const terrain = createSeedTerrainMap();
    const label = terrain.features.find((feature) => feature.kind === 'label');
    if (!label) {
      throw new Error('Missing seeded label');
    }
    delete label.name;

    expectFailure(terrainMapSchema.safeParse(terrain), 'Label features require a name');
  });

  it('rejects canvases larger than the maximum dimension', () => {
    const terrain = createSeedTerrainMap();
    terrain.width = MAX_TERRAIN_DIMENSION + 1;

    expectFailure(terrainMapSchema.safeParse(terrain));
  });

  it('rejects malformed and future-version documents', () => {
    expectFailure(terrainMapSchema.safeParse({ name: 'not a map' }));
    expectFailure(terrainMapSchema.safeParse({ ...createSeedTerrainMap(), schemaVersion: 99 }));
  });
});

describe('army roster validation', () => {
  it('rejects duplicate unit ids', () => {
    const roster = createSeedRoster();
    roster.units.push({ ...getUnit(roster, 'unit-north-brigade-1'), name: 'Duplicate unit' });

    expectFailure(armyRosterSchema.safeParse(roster), 'Duplicate unit id');
  });

  it('rejects self-parenting units', () => {
    const roster = createSeedRoster();
    getUnit(roster, 'unit-north-corps').parentUnitId = 'unit-north-corps';

    expectFailure(armyRosterSchema.safeParse(roster), 'Cycle detected in unit hierarchy');
  });

  it('rejects indirect hierarchy cycles', () => {
    const roster = createSeedRoster();
    getUnit(roster, 'unit-north-army').parentUnitId = 'unit-north-brigade-1';

    expectFailure(armyRosterSchema.safeParse(roster), 'Cycle detected in unit hierarchy');
  });

  it('rejects dangling parent references', () => {
    const roster = createSeedRoster();
    getUnit(roster, 'unit-north-brigade-1').parentUnitId = 'unit-ghost';

    expectFailure(armyRosterSchema.safeParse(roster), 'unknown parent');
  });

  it('rejects parents from another faction', () => {
    const roster = createSeedRoster();
    getUnit(roster, 'unit-north-brigade-1').parentUnitId = 'unit-south-division';

    expectFailure(armyRosterSchema.safeParse(roster), 'same faction');
  });

  it('rejects dangling faction and commander references', () => {
    const factionRoster = createSeedRoster();
    getUnit(factionRoster, 'unit-north-brigade-1').factionId = 'faction-ghost';
    expectFailure(armyRosterSchema.safeParse(factionRoster), 'unknown faction');

    const commanderRoster = createSeedRoster();
    getUnit(commanderRoster, 'unit-north-brigade-1').commanderId = 'commander-ghost';
    expectFailure(armyRosterSchema.safeParse(commanderRoster), 'unknown commander');
  });

  it('rejects negative strengths', () => {
    const roster = createSeedRoster();
    getUnit(roster, 'unit-north-brigade-1').initialStrength = -1;

    expect(armyRosterSchema.safeParse(roster).success).toBe(false);
  });

  it('rejects duplicate commander ids', () => {
    const roster = createSeedRoster();
    roster.commanders.push({ ...roster.commanders[0], name: 'Duplicate commander' });

    expectFailure(armyRosterSchema.safeParse(roster), 'Duplicate commander id');
  });
});

describe('battle scenario validation', () => {
  it('rejects phase state for unknown units', () => {
    const scenario = createSeedBattleScenario();
    getPhase(scenario, 'phase-initial').unitStates['unit-ghost'] = {
      x: 0,
      y: 0,
      rotationDegrees: 0,
      frontageLength: 100,
      visible: true,
      effectiveStrength: 100,
      status: 'reserve',
    };

    expectFailure(battleScenarioSchema.safeParse(scenario), 'unknown unit');
  });

  it('rejects an active phase that does not exist', () => {
    const scenario = createSeedBattleScenario();
    scenario.activePhaseId = 'phase-ghost';

    expectFailure(battleScenarioSchema.safeParse(scenario), 'Active phase');
  });

  it('rejects unknown phase commander overrides', () => {
    const scenario = createSeedBattleScenario();
    const state = getPhase(scenario, 'phase-initial').unitStates['unit-north-brigade-1'];
    if (!state) {
      throw new Error('Missing seeded unit state');
    }
    state.commanderOverrideId = 'commander-ghost';

    expectFailure(battleScenarioSchema.safeParse(scenario), 'unknown commander');
  });

  it('rejects annotations linked to unknown units', () => {
    const scenario = createSeedBattleScenario();
    const phase = getPhase(scenario, 'phase-initial');
    const annotation = phase.annotations[0];
    if (!annotation) {
      throw new Error('Missing seeded annotation');
    }
    annotation.linkedUnitId = 'unit-ghost';

    expectFailure(battleScenarioSchema.safeParse(scenario), 'links to unknown unit');
  });

  it('rejects duplicate phase ids', () => {
    const scenario = createSeedBattleScenario();
    scenario.phases.push({ ...structuredClone(getPhase(scenario, 'phase-initial')), name: 'Copy' });

    expectFailure(battleScenarioSchema.safeParse(scenario), 'Duplicate phase id');
  });

  it('rejects invalid per-phase unit measurements', () => {
    const scenario = createSeedBattleScenario();
    const state = getPhase(scenario, 'phase-initial').unitStates['unit-north-brigade-1'];
    if (!state) {
      throw new Error('Missing seeded unit state');
    }
    state.frontageLength = 0;
    state.effectiveStrength = -10;

    expectFailure(battleScenarioSchema.safeParse(scenario));
  });

  it('rejects annotation kinds with incompatible geometry', () => {
    const scenario = createSeedBattleScenario();
    const phase = getPhase(scenario, 'phase-initial');
    const annotation = phase.annotations[0];
    if (!annotation) {
      throw new Error('Missing seeded annotation');
    }
    annotation.kind = 'text';

    expectFailure(
      battleScenarioSchema.safeParse(scenario),
      'text annotations require textAnchor geometry',
    );
  });

  it('rejects a scenario with no phases', () => {
    const scenario = createSeedBattleScenario();
    scenario.phases = [];

    expectFailure(battleScenarioSchema.safeParse(scenario), 'at least one phase');
  });
});
