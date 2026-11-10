import { describe, expect, it } from 'vitest';
import {
  battleScenarioSchema,
  createSeedRoster,
  createSeedTerrainMap,
  type ArmyRoster,
} from '../../models';
import {
  DEFAULT_FORMATION_FONT_SIZES,
  DEFAULT_FORMATION_LABEL_FORMATS,
  DEFAULT_FRONTAGE_BY_ECHELON,
  activeScenarioPhase,
  commanderSurname,
  createScenarioDocument,
  defaultFrontageLength,
  defaultUnitPhaseState,
  deployFormationStates,
  isRectangleFormation,
  isUpsideDownRotation,
  renderedFrontageLength,
  scenarioUnitLabel,
  scenarioUnitState,
  shortenFormationName,
  terrainFeatureBounds,
} from './scenarioDocuments';

function gateRoster(): ArmyRoster {
  const base = createSeedRoster();
  const template = base.units.find((unit) => unit.id === 'unit-north-brigade-1');
  const faction = base.factions.find((candidate) => candidate.id === 'faction-north');
  if (!template || !faction) throw new Error('The seed roster is missing its northern brigade');

  const units = Array.from({ length: 21 }, (_, index) => ({
    ...structuredClone(template),
    id: `gate-brigade-${index + 1}`,
    customName: `Gate Brigade ${String(index + 1).padStart(2, '0')}`,
    parentUnitId: null,
    initialStrength: 1500,
  }));

  return {
    ...base,
    name: 'Gate Roster',
    factions: [faction],
    units,
  };
}

describe('scenario document helpers', () => {
  it('creates a validated scenario with one active deployment phase', () => {
    const terrain = createSeedTerrainMap();
    const roster = gateRoster();

    const scenario = createScenarioDocument({
      name: '  Gate Scenario  ',
      description: '  Snapshot deployment  ',
      terrain,
      roster,
    });

    expect(battleScenarioSchema.safeParse(scenario).success).toBe(true);
    expect(scenario.name).toBe('Gate Scenario');
    expect(scenario.description).toBe('Snapshot deployment');
    expect(scenario.phases).toHaveLength(1);
    expect(scenario.activePhaseId).toBe(scenario.phases[0]?.id);
    expect(scenario.phases[0]?.name).toBe('Initial deployment');
    expect(scenario.phases[0]?.unitStates).toEqual({});
    expect(activeScenarioPhase(scenario)).toBe(scenario.phases[0]);
    expect(scenarioUnitState(scenario, 'gate-brigade-1')).toBeUndefined();
  });

  it('omits a blank description and rejects blank names', () => {
    const scenario = createScenarioDocument({
      name: 'No description',
      description: '   ',
      terrain: createSeedTerrainMap(),
      roster: gateRoster(),
    });

    expect(scenario.description).toBeUndefined();
    expect(() =>
      createScenarioDocument({
        name: '   ',
        terrain: createSeedTerrainMap(),
        roster: gateRoster(),
      }),
    ).toThrow();
  });

  it('copies terrain and roster snapshots independently of the library sources', () => {
    const terrain = createSeedTerrainMap();
    const roster = gateRoster();
    const scenario = createScenarioDocument({ name: 'Independent', terrain, roster });

    terrain.name = 'Edited terrain source';
    terrain.features[0]!.name = 'Edited feature';
    roster.name = 'Edited roster source';
    roster.units[0]!.customName = 'Edited brigade';
    roster.factions[0]!.name = 'Edited faction';

    expect(scenario.terrainSnapshot.name).toBe('Ashford Ford');
    expect(scenario.terrainSnapshot.features[0]?.name).toBe('North Wood');
    expect(scenario.rosterSnapshot.name).toBe('Gate Roster');
    expect(scenario.rosterSnapshot.units[0]?.customName).toBe('Gate Brigade 01');
    expect(scenario.rosterSnapshot.factions[0]?.name).toBe('Northern League');

    scenario.terrainSnapshot.name = 'Edited scenario terrain';
    scenario.rosterSnapshot.units[0]!.customName = 'Edited scenario brigade';

    expect(terrain.name).toBe('Edited terrain source');
    expect(roster.units[0]?.customName).toBe('Edited brigade');
  });

  it('derives default frontage and phase-local strength for a deployed brigade', () => {
    const roster = gateRoster();
    const unit = roster.units[0]!;
    const state = defaultUnitPhaseState(roster, unit, { x: 180, y: 240 });

    expect(state).toMatchObject({
      x: 180,
      y: 240,
      rotationDegrees: 0,
      frontageLength: DEFAULT_FRONTAGE_BY_ECHELON.brigade,
      visible: true,
      effectiveStrength: 1500,
      status: 'reserve',
    });
    expect(defaultFrontageLength('division')).toBe(DEFAULT_FRONTAGE_BY_ECHELON.division);
  });

  it('classifies rectangles at or below the smallest echelon and scales text by echelon', () => {
    expect(isRectangleFormation('brigade', 'brigade')).toBe(true);
    expect(isRectangleFormation('regiment', 'brigade')).toBe(true);
    expect(isRectangleFormation('other', 'brigade')).toBe(true);

    expect(isRectangleFormation('division', 'brigade')).toBe(false);
    expect(isRectangleFormation('corps', 'brigade')).toBe(false);
    expect(isRectangleFormation('army', 'brigade')).toBe(false);

    expect(isRectangleFormation('other', 'other')).toBe(true);
    expect(isRectangleFormation('regiment', 'other')).toBe(false);

    expect(DEFAULT_FORMATION_FONT_SIZES.army).toBeGreaterThan(DEFAULT_FORMATION_FONT_SIZES.corps);
    expect(DEFAULT_FORMATION_FONT_SIZES.corps).toBeGreaterThan(
      DEFAULT_FORMATION_FONT_SIZES.division,
    );
    expect(DEFAULT_FORMATION_FONT_SIZES.division).toBeGreaterThan(
      DEFAULT_FORMATION_FONT_SIZES.brigade,
    );
    expect(DEFAULT_FORMATION_FONT_SIZES.brigade).toBeGreaterThan(
      DEFAULT_FORMATION_FONT_SIZES.regiment,
    );
  });

  it('scales rendered frontage linearly from a 3,000-strong baseline', () => {
    expect(renderedFrontageLength(120, 3000, false)).toBe(120);
    expect(renderedFrontageLength(120, 6000, false)).toBe(120);
    expect(renderedFrontageLength(120, 1500, true)).toBe(60);
    expect(renderedFrontageLength(120, 3000, true)).toBe(120);
    expect(renderedFrontageLength(120, 6000, true)).toBe(240);
    expect(renderedFrontageLength(120, 0, true)).toBe(6);
    expect(renderedFrontageLength(120, null, true)).toBe(120);
  });

  it('deploys a parent with undeployed descendants in echelon rows', () => {
    const roster = createSeedRoster();
    const army = roster.units.find((unit) => unit.id === 'unit-north-army');
    if (!army) throw new Error('The seed roster is missing its northern army');

    const states = deployFormationStates(roster, army, { x: 500, y: 800 });
    expect(Object.keys(states)).toHaveLength(6);
    expect(states['unit-north-army']).toMatchObject({ x: 500, y: 800 });
    expect(states['unit-north-corps']?.y).toBe(660);
    expect(states['unit-north-division']?.y).toBe(520);
    expect(
      ['unit-north-brigade-1', 'unit-north-brigade-2', 'unit-north-brigade-3'].map(
        (unitId) => states[unitId]?.x,
      ),
    ).toEqual([340, 500, 660]);

    const partiallyDeployed = deployFormationStates(
      roster,
      army,
      { x: 500, y: 800 },
      new Set(['unit-north-brigade-2']),
    );
    expect(partiallyDeployed['unit-north-brigade-2']).toBeUndefined();
    expect(Object.keys(partiallyDeployed)).toHaveLength(5);

    const brigade = roster.units.find((unit) => unit.id === 'unit-north-brigade-1');
    if (!brigade) throw new Error('The seed roster is missing its northern brigade');
    expect(deployFormationStates(roster, brigade, { x: 10, y: 20 })).toEqual({
      'unit-north-brigade-1': expect.objectContaining({ x: 10, y: 20 }),
    });
  });

  it('defaults higher echelons to full names and lower echelons to shortened names', () => {
    expect(DEFAULT_FORMATION_LABEL_FORMATS).toMatchObject({
      army: 'full',
      corps: 'full',
      division: 'full',
      brigade: 'shortened',
      regiment: 'shortened',
      other: 'shortened',
    });
  });

  it('writes full, shortened, commander-surname, and hidden map labels', () => {
    const scenario = createScenarioDocument({
      name: 'Label styles',
      terrain: createSeedTerrainMap(),
      roster: createSeedRoster(),
    });
    const units = new Map(scenario.rosterSnapshot.units.map((unit) => [unit.id, unit] as const));
    const division = units.get('unit-north-division');
    const army = units.get('unit-north-army');
    const southernBrigade = units.get('unit-south-brigade-1');
    if (!division || !army || !southernBrigade) {
      throw new Error('The seed scenario is missing label fixtures');
    }

    expect(scenarioUnitLabel(scenario, division, undefined, 'full')).toBe('Voss Division');
    expect(scenarioUnitLabel(scenario, division, undefined, 'shortened')).toBe('Voss');
    expect(scenarioUnitLabel(scenario, division, undefined, 'commander')).toBe('Kerr');
    expect(scenarioUnitLabel(scenario, division, undefined, 'none')).toBe('');

    // The army name has no trailing echelon word to shorten.
    expect(scenarioUnitLabel(scenario, army, undefined, 'full')).toBe('Army of the North');
    expect(scenarioUnitLabel(scenario, army, undefined, 'shortened')).toBe('Army of the North');
    expect(scenarioUnitLabel(scenario, army, undefined, 'commander')).toBe('Voss');

    // Commander-style roster names reduce to the commander's surname.
    expect(scenarioUnitLabel(scenario, southernBrigade, undefined, 'full')).toBe(
      'Johnstons Brigade',
    );
    expect(scenarioUnitLabel(scenario, southernBrigade, undefined, 'shortened')).toBe('Johnston');
    expect(scenarioUnitLabel(scenario, southernBrigade, undefined, 'commander')).toBe('Johnston');
  });

  it('shortens names by removing a trailing echelon word and possessive', () => {
    expect(shortenFormationName('2nd Brigade', 'brigade')).toBe('2nd');
    expect(shortenFormationName('Stonewall Brigade', 'brigade')).toBe('Stonewall');
    expect(shortenFormationName("Smith's Division", 'division')).toBe('Smith');
    expect(shortenFormationName('Smiths division', 'division')).toBe('Smiths');
    expect(shortenFormationName('Voss Division', 'brigade')).toBe('Voss Division');
    expect(shortenFormationName('Brigade', 'brigade')).toBe('Brigade');

    expect(commanderSurname('Adele Voss')).toBe('Voss');
    expect(commanderSurname('  Ines   Kerr  ')).toBe('Kerr');
    expect(commanderSurname('   ')).toBeNull();
    expect(commanderSurname(undefined)).toBeNull();
  });

  it('flips labels only when their rotation would read upside down', () => {
    expect(isUpsideDownRotation(0)).toBe(false);
    expect(isUpsideDownRotation(90)).toBe(false);
    expect(isUpsideDownRotation(90.01)).toBe(true);
    expect(isUpsideDownRotation(180)).toBe(true);
    expect(isUpsideDownRotation(269.99)).toBe(true);
    expect(isUpsideDownRotation(270)).toBe(false);
    expect(isUpsideDownRotation(360)).toBe(false);
    expect(isUpsideDownRotation(-90)).toBe(false);
    expect(isUpsideDownRotation(-91)).toBe(true);
    expect(isUpsideDownRotation(450)).toBe(false);
  });

  it('prefers a trimmed label override over the generated roster name', () => {
    const roster = gateRoster();
    const scenario = createScenarioDocument({
      name: 'Labels',
      terrain: createSeedTerrainMap(),
      roster,
    });
    const unit = scenario.rosterSnapshot.units[0]!;

    expect(scenarioUnitLabel(scenario, unit)).toBe('Gate Brigade 01');
    expect(
      scenarioUnitLabel(scenario, unit, {
        ...defaultUnitPhaseState(roster, unit, { x: 0, y: 0 }),
        labelOverride: '  Vanguard  ',
      }),
    ).toBe('Vanguard');
    expect(
      scenarioUnitLabel(scenario, unit, {
        ...defaultUnitPhaseState(roster, unit, { x: 0, y: 0 }),
        labelOverride: '   ',
      }),
    ).toBe('Gate Brigade 01');

    const overridden = {
      ...defaultUnitPhaseState(roster, unit, { x: 0, y: 0 }),
      labelOverride: '  Stonewall Brigade  ',
    };
    expect(scenarioUnitLabel(scenario, unit, overridden, 'full')).toBe('Stonewall Brigade');
    expect(scenarioUnitLabel(scenario, unit, overridden, 'shortened')).toBe('Stonewall');
    expect(scenarioUnitLabel(scenario, unit, overridden, 'commander')).toBe('Stonewall Brigade');
    expect(scenarioUnitLabel(scenario, unit, overridden, 'none')).toBe('');
  });

  it('returns null when the active phase is missing', () => {
    const scenario = createScenarioDocument({
      name: 'Missing phase',
      terrain: createSeedTerrainMap(),
      roster: gateRoster(),
    });

    expect(activeScenarioPhase({ ...scenario, activePhaseId: 'missing' })).toBeNull();
    expect(
      scenarioUnitState({ ...scenario, activePhaseId: 'missing' }, 'gate-brigade-1'),
    ).toBeUndefined();
  });

  it('computes approximate bounds for every terrain geometry type', () => {
    const terrain = createSeedTerrainMap();
    const polygon = terrain.features.find((feature) => feature.geometry.type === 'polygon');
    const building = terrain.features.find((feature) => feature.kind === 'building');
    const label = terrain.features.find((feature) => feature.geometry.type === 'textAnchor');
    if (!polygon || !building || !label) throw new Error('Seed terrain is missing fixtures');

    const polygonPoints = polygon.geometry.type === 'polygon' ? polygon.geometry.points : [];
    const xs = polygonPoints.map((point) => point.x);
    const ys = polygonPoints.map((point) => point.y);
    expect(terrainFeatureBounds(polygon)).toEqual({
      x: Math.min(...xs),
      y: Math.min(...ys),
      width: Math.max(...xs) - Math.min(...xs),
      height: Math.max(...ys) - Math.min(...ys),
    });

    const buildingPoint = building.geometry.type === 'point' ? building.geometry.position : null;
    expect(buildingPoint).not.toBeNull();
    expect(terrainFeatureBounds(building)).toEqual({
      x: buildingPoint!.x - 9,
      y: buildingPoint!.y - 9,
      width: 18,
      height: 18,
    });

    const labelPoint = label.geometry.type === 'textAnchor' ? label.geometry.position : null;
    const fontSize = label.style.type === 'text' ? label.style.fontSize : 20;
    expect(labelPoint).not.toBeNull();
    expect(terrainFeatureBounds(label)).toMatchObject({
      x: labelPoint!.x,
      y: labelPoint!.y - fontSize,
      height: fontSize * 1.4,
    });
  });
});
