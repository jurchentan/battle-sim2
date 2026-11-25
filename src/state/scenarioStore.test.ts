import { beforeEach, describe, expect, it } from 'vitest';
import {
  createSeedBattleScenario,
  createSeedRoster,
  createSeedTerrainMap,
  type ArmyRoster,
} from '../models';
import { activeScenarioPhase } from '../features/scenario/scenarioDocuments';
import { useScenarioStore } from './scenarioStore';

function gateRoster(): ArmyRoster {
  const base = createSeedRoster();
  const template = base.units.find((unit) => unit.id === 'unit-north-brigade-1');
  const faction = base.factions.find((candidate) => candidate.id === 'faction-north');
  if (!template || !faction) throw new Error('The seed roster is missing its northern brigade');

  return {
    ...base,
    name: 'Gate Roster',
    factions: [faction],
    units: Array.from({ length: 21 }, (_, index) => ({
      ...structuredClone(template),
      id: `gate-brigade-${index + 1}`,
      customName: `Gate Brigade ${String(index + 1).padStart(2, '0')}`,
      parentUnitId: null,
      initialStrength: 1500,
    })),
  };
}

function resetStore(): void {
  useScenarioStore.getState().loadDocument(createSeedBattleScenario());
}

function unwrap<T extends { ok: true }>(result: T | { ok: false; error: string }): T {
  if (!result.ok) throw new Error(result.error);
  return result;
}

function activeState(): ReturnType<typeof activeScenarioPhase> {
  return activeScenarioPhase(useScenarioStore.getState().document);
}

function deployGateBrigades(count: number): void {
  for (let index = 0; index < count; index += 1) {
    unwrap(
      useScenarioStore.getState().placeUnit(`gate-brigade-${index + 1}`, {
        x: 200 + index * 30,
        y: 300 + (index % 3) * 40,
      }),
    );
  }
}

describe('scenario store', () => {
  beforeEach(resetStore);

  it('creates a snapshot scenario and clears history', () => {
    useScenarioStore.getState().loadDocument(createSeedBattleScenario());
    unwrap(useScenarioStore.getState().placeUnit('unit-north-corps', { x: 100, y: 100 }));
    expect(useScenarioStore.getState().past).toHaveLength(1);

    const terrain = createSeedTerrainMap();
    const roster = gateRoster();
    const result = unwrap(
      useScenarioStore.getState().createScenario({
        name: 'Gate Scenario',
        terrain,
        orderOfBattle: roster,
      }),
    );

    const document = useScenarioStore.getState().document;
    expect(document.id).toBe(result.id);
    expect(document.name).toBe('Gate Scenario');
    expect(document.terrainSnapshot).toEqual(terrain);
    expect(document.orderOfBattle.units).toHaveLength(21);
    expect(document.phases).toHaveLength(1);
    expect(useScenarioStore.getState().past).toHaveLength(0);
    expect(useScenarioStore.getState().future).toHaveLength(0);
  });

  it('deploys at least twenty brigades without changing the terrain snapshot', () => {
    const terrain = createSeedTerrainMap();
    const roster = gateRoster();
    unwrap(
      useScenarioStore.getState().createScenario({
        name: 'Gate Scenario',
        terrain,
        orderOfBattle: roster,
      }),
    );

    const originalTerrain = structuredClone(terrain);
    deployGateBrigades(20);

    const document = useScenarioStore.getState().document;
    expect(activeState()?.unitStates).toBeDefined();
    expect(Object.keys(activeState()?.unitStates ?? {})).toHaveLength(20);
    expect(document.terrainSnapshot).toEqual(originalTerrain);
    expect(document.terrainSnapshot.features).toEqual(terrain.features);
    expect(useScenarioStore.getState().past).toHaveLength(20);
  });

  it('keeps snapshots isolated when the library sources are edited later', () => {
    const terrain = createSeedTerrainMap();
    const roster = gateRoster();
    unwrap(
      useScenarioStore.getState().createScenario({
        name: 'Gate Scenario',
        terrain,
        orderOfBattle: roster,
      }),
    );
    deployGateBrigades(20);

    terrain.features.splice(0, terrain.features.length);
    roster.units.splice(0, roster.units.length);
    roster.factions[0]!.name = 'Rewritten faction';

    const document = useScenarioStore.getState().document;
    expect(document.terrainSnapshot.features).toHaveLength(9);
    expect(document.orderOfBattle.units).toHaveLength(21);
    expect(Object.keys(activeState()?.unitStates ?? {})).toHaveLength(20);
  });

  it('deploys a parent with its undeployed subordinates in one history entry', () => {
    expect(Object.keys(activeState()?.unitStates ?? {})).toHaveLength(6);

    unwrap(useScenarioStore.getState().placeUnit('unit-north-army', { x: 500, y: 800 }));

    const states = activeState()?.unitStates ?? {};
    expect(Object.keys(states)).toHaveLength(9);
    expect(states['unit-north-army']).toMatchObject({ x: 500, y: 800 });
    expect(states['unit-north-corps']?.y).toBe(660);
    expect(states['unit-north-division']?.y).toBe(520);
    expect(states['unit-north-brigade-1']).toMatchObject({ x: 700, y: 520 });
    expect(useScenarioStore.getState().past).toHaveLength(1);
  });

  it('uses per-echelon frontage defaults for new deployments', () => {
    unwrap(
      useScenarioStore.getState().placeUnit(
        'unit-north-army',
        { x: 500, y: 800 },
        {
          army: 300,
          corps: 240,
          division: 200,
          brigade: 140,
        },
      ),
    );

    const states = activeState()?.unitStates ?? {};
    expect(states['unit-north-army']?.frontageLength).toBe(300);
    expect(states['unit-north-corps']?.frontageLength).toBe(240);
    expect(states['unit-north-division']?.frontageLength).toBe(200);
    expect(useScenarioStore.getState().past).toHaveLength(1);
  });

  it('rejects duplicate deployments and invalid unit patches without recording history', () => {
    unwrap(
      useScenarioStore.getState().createScenario({
        name: 'Gate Scenario',
        terrain: createSeedTerrainMap(),
        orderOfBattle: gateRoster(),
      }),
    );
    deployGateBrigades(1);
    const afterFirstDeployment = useScenarioStore.getState().document;

    const duplicate = useScenarioStore.getState().placeUnit('gate-brigade-1', { x: 900, y: 900 });
    expect(duplicate).toEqual({
      ok: false,
      error: 'That formation is already deployed in this phase.',
    });
    expect(useScenarioStore.getState().document).toBe(afterFirstDeployment);

    const invalid = useScenarioStore
      .getState()
      .updateUnitState('gate-brigade-1', { frontageLength: 0 });
    expect(invalid.ok).toBe(false);
    expect(useScenarioStore.getState().document).toBe(afterFirstDeployment);
    expect(useScenarioStore.getState().past).toHaveLength(1);

    const missing = useScenarioStore
      .getState()
      .updateUnitState('missing-unit', { frontageLength: 100 });
    expect(missing.ok).toBe(false);
    expect(useScenarioStore.getState().past).toHaveLength(1);
  });

  it('edits deployment position, frontage, rotation, and label overrides', () => {
    unwrap(
      useScenarioStore.getState().createScenario({
        name: 'Gate Scenario',
        terrain: createSeedTerrainMap(),
        orderOfBattle: gateRoster(),
      }),
    );
    deployGateBrigades(1);

    unwrap(
      useScenarioStore.getState().updateUnitState('gate-brigade-1', {
        x: 640,
        y: 480,
        rotationDegrees: 32.5,
        frontageLength: 175,
        labelOverride: '  Vanguard Brigade  ',
      }),
    );

    expect(activeState()?.unitStates['gate-brigade-1']).toMatchObject({
      x: 640,
      y: 480,
      rotationDegrees: 32.5,
      frontageLength: 175,
      labelOverride: 'Vanguard Brigade',
    });

    unwrap(useScenarioStore.getState().updateUnitState('gate-brigade-1', { labelOverride: '   ' }));
    expect(activeState()?.unitStates['gate-brigade-1']?.labelOverride).toBeUndefined();
  });

  it('moves and rotates several formations in one history entry', () => {
    unwrap(
      useScenarioStore.getState().createScenario({
        name: 'Gate Scenario',
        terrain: createSeedTerrainMap(),
        orderOfBattle: gateRoster(),
      }),
    );
    deployGateBrigades(3);
    const pastBefore = useScenarioStore.getState().past.length;

    unwrap(
      useScenarioStore.getState().updateUnitStates({
        'gate-brigade-1': { x: 300, y: 400, rotationDegrees: 30 },
        'gate-brigade-2': { x: 340, y: 440, rotationDegrees: 30 },
      }),
    );

    expect(activeState()?.unitStates['gate-brigade-1']).toMatchObject({
      x: 300,
      y: 400,
      rotationDegrees: 30,
    });
    expect(activeState()?.unitStates['gate-brigade-2']).toMatchObject({
      x: 340,
      y: 440,
      rotationDegrees: 30,
    });
    expect(useScenarioStore.getState().past).toHaveLength(pastBefore + 1);

    useScenarioStore.getState().undo();
    expect(activeState()?.unitStates['gate-brigade-1']?.x).not.toBe(300);
    expect(useScenarioStore.getState().past).toHaveLength(pastBefore);

    useScenarioStore.getState().redo();
    expect(activeState()?.unitStates['gate-brigade-1']?.x).toBe(300);
  });

  it('rejects an invalid bulk patch without changing history or other formations', () => {
    unwrap(
      useScenarioStore.getState().createScenario({
        name: 'Gate Scenario',
        terrain: createSeedTerrainMap(),
        orderOfBattle: gateRoster(),
      }),
    );
    deployGateBrigades(2);
    const before = useScenarioStore.getState().document;
    const pastBefore = useScenarioStore.getState().past.length;

    const result = useScenarioStore.getState().updateUnitStates({
      'gate-brigade-1': { x: 400 },
      'gate-brigade-2': { frontageLength: 0 },
    });

    expect(result.ok).toBe(false);
    expect(useScenarioStore.getState().document).toBe(before);
    expect(useScenarioStore.getState().past).toHaveLength(pastBefore);
  });

  it('undeploys a multi-selection in one history entry', () => {
    unwrap(
      useScenarioStore.getState().createScenario({
        name: 'Gate Scenario',
        terrain: createSeedTerrainMap(),
        orderOfBattle: gateRoster(),
      }),
    );
    deployGateBrigades(4);
    const pastBefore = useScenarioStore.getState().past.length;

    unwrap(
      useScenarioStore
        .getState()
        .undeployUnits(['gate-brigade-1', 'gate-brigade-3', 'gate-brigade-1']),
    );

    expect(Object.keys(activeState()?.unitStates ?? {})).toHaveLength(2);
    expect(useScenarioStore.getState().past).toHaveLength(pastBefore + 1);

    useScenarioStore.getState().undo();
    expect(Object.keys(activeState()?.unitStates ?? {})).toHaveLength(4);
  });

  it('undeploys a formation and supports undo and redo', () => {
    unwrap(
      useScenarioStore.getState().createScenario({
        name: 'Gate Scenario',
        terrain: createSeedTerrainMap(),
        orderOfBattle: gateRoster(),
      }),
    );
    deployGateBrigades(20);
    expect(Object.keys(activeState()?.unitStates ?? {})).toHaveLength(20);

    unwrap(useScenarioStore.getState().undeployUnit('gate-brigade-1'));
    expect(Object.keys(activeState()?.unitStates ?? {})).toHaveLength(19);
    expect(useScenarioStore.getState().future).toHaveLength(0);

    useScenarioStore.getState().undo();
    expect(Object.keys(activeState()?.unitStates ?? {})).toHaveLength(20);
    expect(useScenarioStore.getState().future).toHaveLength(1);

    useScenarioStore.getState().undo();
    expect(Object.keys(activeState()?.unitStates ?? {})).toHaveLength(19);

    useScenarioStore.getState().redo();
    expect(Object.keys(activeState()?.unitStates ?? {})).toHaveLength(20);
    expect(useScenarioStore.getState().future).toHaveLength(1);

    useScenarioStore.getState().redo();
    expect(Object.keys(activeState()?.unitStates ?? {})).toHaveLength(19);
    expect(useScenarioStore.getState().future).toHaveLength(0);
  });

  it('renames a scenario with undo and redo', () => {
    const originalName = useScenarioStore.getState().document.name;

    expect(useScenarioStore.getState().renameDocument('   ').ok).toBe(false);
    unwrap(useScenarioStore.getState().renameDocument('  Ashford, Second Day  '));
    expect(useScenarioStore.getState().document.name).toBe('Ashford, Second Day');

    useScenarioStore.getState().undo();
    expect(useScenarioStore.getState().document.name).toBe(originalName);

    useScenarioStore.getState().redo();
    expect(useScenarioStore.getState().document.name).toBe('Ashford, Second Day');
  });

  it('clones documents loaded into the store', () => {
    const source = { ...createSeedBattleScenario(), name: 'Loaded scenario' };
    useScenarioStore.getState().loadDocument(source);

    source.name = 'Mutated source';
    source.terrainSnapshot.name = 'Mutated terrain';

    expect(useScenarioStore.getState().document.name).toBe('Loaded scenario');
    expect(useScenarioStore.getState().document.terrainSnapshot.name).toBe('Ashford Ford');
    expect(useScenarioStore.getState().past).toHaveLength(0);
    expect(useScenarioStore.getState().future).toHaveLength(0);
  });

  it('creates a map-only scenario with an empty scenario-owned order of battle', () => {
    const result = unwrap(
      useScenarioStore.getState().createScenario({
        name: '  Gate Scenario  ',
        terrain: createSeedTerrainMap(),
      }),
    );

    const document = useScenarioStore.getState().document;
    expect(document.id).toBe(result.id);
    expect(document.name).toBe('Gate Scenario');
    expect(document.orderOfBattle.name).toBe('Gate Scenario order of battle');
    expect(document.orderOfBattle.smallestUnitEchelon).toBe('brigade');
    expect(document.orderOfBattle.factions).toEqual([]);
    expect(document.orderOfBattle.units).toEqual([]);
    expect(document.phases).toHaveLength(1);
    expect(document.phases[0]?.unitStates).toEqual({});
    expect(useScenarioStore.getState().past).toHaveLength(0);
  });

  it('adds, edits, reparents, and deletes scenario formations as undoable edits', () => {
    unwrap(
      useScenarioStore.getState().createScenario({
        name: 'Gate Scenario',
        terrain: createSeedTerrainMap(),
      }),
    );

    const faction = unwrap(
      useScenarioStore.getState().addFaction({ name: 'Northern League', color: '#2f5d8a' }),
    );
    const army = unwrap(
      useScenarioStore.getState().addUnit({
        factionId: faction.id,
        customName: 'Army of the Gate',
        echelon: 'army',
        unitType: 'other',
        parentUnitId: null,
      }),
    );
    const firstDivision = unwrap(
      useScenarioStore.getState().addUnit({
        factionId: faction.id,
        echelon: 'division',
        unitType: 'infantry',
        parentUnitId: army.id,
      }),
    );
    const secondDivision = unwrap(
      useScenarioStore.getState().addUnit({
        factionId: faction.id,
        echelon: 'division',
        unitType: 'infantry',
        parentUnitId: army.id,
      }),
    );
    const brigade = unwrap(
      useScenarioStore.getState().addUnit({
        factionId: faction.id,
        echelon: 'brigade',
        unitType: 'infantry',
        parentUnitId: firstDivision.id,
      }),
    );

    const document = useScenarioStore.getState().document;
    const addedBrigade = document.orderOfBattle.units.find((unit) => unit.id === brigade.id);
    expect(addedBrigade?.parentUnitId).toBe(firstDivision.id);
    expect(addedBrigade?.initialStrength).toBe(1500);
    expect(useScenarioStore.getState().past).toHaveLength(5);

    unwrap(
      useScenarioStore.getState().updateUnit(brigade.id, {
        customName: '  Gate Brigade  ',
        commander: '  Captain Hale  ',
        initialStrength: 1750,
      }),
    );
    expect(
      useScenarioStore
        .getState()
        .document.orderOfBattle.units.find((unit) => unit.id === brigade.id),
    ).toMatchObject({
      customName: 'Gate Brigade',
      commander: 'Captain Hale',
      initialStrength: 1750,
    });

    unwrap(useScenarioStore.getState().reparentUnit(brigade.id, secondDivision.id));
    expect(
      useScenarioStore
        .getState()
        .document.orderOfBattle.units.find((unit) => unit.id === brigade.id)?.parentUnitId,
    ).toBe(secondDivision.id);
    expect(useScenarioStore.getState().past).toHaveLength(7);

    useScenarioStore.getState().undo();
    expect(
      useScenarioStore
        .getState()
        .document.orderOfBattle.units.find((unit) => unit.id === brigade.id)?.parentUnitId,
    ).toBe(firstDivision.id);
    useScenarioStore.getState().redo();
    expect(
      useScenarioStore
        .getState()
        .document.orderOfBattle.units.find((unit) => unit.id === brigade.id)?.parentUnitId,
    ).toBe(secondDivision.id);

    const beforeInvalidReparent = useScenarioStore.getState().document;
    const invalid = useScenarioStore.getState().reparentUnit(firstDivision.id, brigade.id);
    expect(invalid.ok).toBe(false);
    if (!invalid.ok) expect(invalid.error).toContain('cannot be placed under');
    expect(useScenarioStore.getState().document).toBe(beforeInvalidReparent);

    const blockedFactionDelete = useScenarioStore.getState().deleteFaction(faction.id);
    expect(blockedFactionDelete.ok).toBe(false);
    if (!blockedFactionDelete.ok) expect(blockedFactionDelete.error).toContain('units');

    const blockedArmyDelete = useScenarioStore.getState().deleteUnit(army.id);
    expect(blockedArmyDelete.ok).toBe(false);
    if (!blockedArmyDelete.ok) expect(blockedArmyDelete.error).toContain('subordinate');

    unwrap(useScenarioStore.getState().deleteUnit(brigade.id));
    expect(
      useScenarioStore
        .getState()
        .document.orderOfBattle.units.some((unit) => unit.id === brigade.id),
    ).toBe(false);
    expect(useScenarioStore.getState().past).toHaveLength(8);

    useScenarioStore.getState().undo();
    expect(
      useScenarioStore
        .getState()
        .document.orderOfBattle.units.some((unit) => unit.id === brigade.id),
    ).toBe(true);
  });

  it('cascades formation deletion through every phase and annotation link', () => {
    const before = useScenarioStore.getState().document;
    expect(before.phases).toHaveLength(2);
    expect(before.phases[0]?.unitStates['unit-north-brigade-2']).toBeDefined();
    expect(before.phases[1]?.unitStates['unit-north-brigade-2']).toBeDefined();
    expect(
      before.phases[1]?.annotations.find(
        (annotation) => annotation.id === 'annotation-north-counter',
      )?.linkedUnitId,
    ).toBe('unit-north-brigade-2');

    unwrap(useScenarioStore.getState().deleteUnit('unit-north-brigade-2'));

    const document = useScenarioStore.getState().document;
    expect(document.phases[0]?.unitStates['unit-north-brigade-2']).toBeUndefined();
    expect(document.phases[1]?.unitStates['unit-north-brigade-2']).toBeUndefined();
    expect(
      document.phases[1]?.annotations.find(
        (annotation) => annotation.id === 'annotation-north-counter',
      )?.linkedUnitId,
    ).toBeUndefined();
    expect(document.phases[0]?.annotations).toHaveLength(2);
    expect(useScenarioStore.getState().past).toHaveLength(1);

    useScenarioStore.getState().undo();
    const restored = useScenarioStore.getState().document;
    expect(restored.phases[0]?.unitStates['unit-north-brigade-2']).toBeDefined();
    expect(restored.phases[1]?.unitStates['unit-north-brigade-2']).toBeDefined();
    expect(
      restored.phases[1]?.annotations.find(
        (annotation) => annotation.id === 'annotation-north-counter',
      )?.linkedUnitId,
    ).toBe('unit-north-brigade-2');

    useScenarioStore.getState().redo();
    expect(
      useScenarioStore.getState().document.phases[0]?.unitStates['unit-north-brigade-2'],
    ).toBeUndefined();

    const blocked = useScenarioStore.getState().deleteUnit('unit-north-division');
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.error).toContain('subordinate');
  });

  it('commits a generated army as a single history entry', () => {
    unwrap(
      useScenarioStore.getState().createScenario({
        name: 'Generated Scenario',
        terrain: createSeedTerrainMap(),
      }),
    );

    const result = useScenarioStore.getState().generateArmy({
      faction: { kind: 'new', name: 'Army of the Gate', color: '#2f5d8a' },
      structure: 'divisions',
      brigadesPerDivision: 3,
      arms: [
        { unitType: 'infantry', brigadeCount: 7, strengthMode: 'average', strengthValue: 2400 },
        { unitType: 'cavalry', brigadeCount: 2, strengthMode: 'total', strengthValue: 1000 },
        { unitType: 'artillery', brigadeCount: 0, strengthMode: 'average', strengthValue: 0 },
      ],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error);

    const document = useScenarioStore.getState().document;
    expect(document.orderOfBattle.factions).toHaveLength(1);
    expect(document.orderOfBattle.factions[0]?.name).toBe('Army of the Gate');
    expect(document.orderOfBattle.units).toHaveLength(13);
    expect(document.orderOfBattle.units.filter((unit) => unit.echelon === 'division')).toHaveLength(
      4,
    );
    expect(document.orderOfBattle.units.filter((unit) => unit.echelon === 'brigade')).toHaveLength(
      9,
    );
    expect(result.factionId).toBe(document.orderOfBattle.factions[0]?.id);
    expect(result.unitIds).toHaveLength(13);
    expect(result.rootUnitIds).toHaveLength(4);
    expect(useScenarioStore.getState().past).toHaveLength(1);

    const beforeInvalid = useScenarioStore.getState().document;
    const invalid = useScenarioStore.getState().generateArmy({
      faction: { kind: 'new', name: 'Broken', color: '#123456' },
      structure: 'divisions',
      brigadesPerDivision: 0,
      arms: [
        { unitType: 'infantry', brigadeCount: 1, strengthMode: 'average', strengthValue: 900 },
      ],
    });
    expect(invalid.ok).toBe(false);
    expect(useScenarioStore.getState().document).toBe(beforeInvalid);
    expect(useScenarioStore.getState().past).toHaveLength(1);

    useScenarioStore.getState().undo();
    expect(useScenarioStore.getState().document.orderOfBattle.factions).toEqual([]);
    expect(useScenarioStore.getState().document.orderOfBattle.units).toEqual([]);

    useScenarioStore.getState().redo();
    expect(useScenarioStore.getState().document.orderOfBattle.units).toHaveLength(13);
  });
});
