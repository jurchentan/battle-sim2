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
        roster,
      }),
    );

    const document = useScenarioStore.getState().document;
    expect(document.id).toBe(result.id);
    expect(document.name).toBe('Gate Scenario');
    expect(document.terrainSnapshot).toEqual(terrain);
    expect(document.rosterSnapshot.units).toHaveLength(21);
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
        roster,
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
        roster,
      }),
    );
    deployGateBrigades(20);

    terrain.features.splice(0, terrain.features.length);
    roster.units.splice(0, roster.units.length);
    roster.factions[0]!.name = 'Rewritten faction';

    const document = useScenarioStore.getState().document;
    expect(document.terrainSnapshot.features).toHaveLength(9);
    expect(document.rosterSnapshot.units).toHaveLength(21);
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

  it('rejects duplicate deployments and invalid unit patches without recording history', () => {
    unwrap(
      useScenarioStore.getState().createScenario({
        name: 'Gate Scenario',
        terrain: createSeedTerrainMap(),
        roster: gateRoster(),
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
        roster: gateRoster(),
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

  it('undeploys a formation and supports undo and redo', () => {
    unwrap(
      useScenarioStore.getState().createScenario({
        name: 'Gate Scenario',
        terrain: createSeedTerrainMap(),
        roster: gateRoster(),
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
});
