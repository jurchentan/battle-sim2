import { describe, expect, it } from 'vitest';
import {
  createSeedRoster,
  type ArmyRoster,
  type UnitDefinition,
  type UnitPhaseState,
} from '../../models';
import {
  BATTLE_LINE_COMMAND_OFFSETS,
  BATTLE_LINE_MIN_LENGTH,
  computeBattleLineLayout,
  flippedRotation,
  normalizeDegrees,
  polylineLength,
  resolveBattleLineSelection,
} from './battleLine';
import { DEFAULT_FRONTAGE_BY_ECHELON, type FormationFrontages } from './scenarioDocuments';

const FRONTAGES: FormationFrontages = { ...DEFAULT_FRONTAGE_BY_ECHELON };

/**
 * The seed roster plus a second division under I Corps. Keeping the seed
 * hierarchy means the tests exercise the same order-of-battle rules the editor
 * uses, including the north/south faction split.
 */
function battleRoster(): ArmyRoster {
  const roster = createSeedRoster();
  const divisionTemplate = roster.units.find((unit) => unit.id === 'unit-north-division');
  const brigadeTemplate = roster.units.find((unit) => unit.id === 'unit-north-brigade-1');
  if (!divisionTemplate || !brigadeTemplate) throw new Error('The seed roster is incomplete');

  const secondDivision: UnitDefinition = {
    ...structuredClone(divisionTemplate),
    id: 'unit-north-division-2',
    customName: 'Zulu Division',
    parentUnitId: 'unit-north-corps',
  };
  const secondBrigades = [1, 2].map((index): UnitDefinition => ({
    ...structuredClone(brigadeTemplate),
    id: `unit-north-brigade-${index + 3}`,
    customName: `Zulu Brigade ${index}`,
    parentUnitId: secondDivision.id,
    commander: `Zulu Commander ${index}`,
  }));

  return {
    ...roster,
    units: [...roster.units, secondDivision, ...secondBrigades],
  };
}

function deployedState(overrides: Partial<UnitPhaseState> = {}): UnitPhaseState {
  return {
    x: 0,
    y: 0,
    rotationDegrees: 0,
    frontageLength: 120,
    visible: true,
    effectiveStrength: 1500,
    status: 'holding',
    ...overrides,
  };
}

function equalFrontageStates(unitIds: readonly string[], frontage = 100) {
  return Object.fromEntries(
    unitIds.map((unitId) => [unitId, deployedState({ frontageLength: frontage })] as const),
  );
}

const VOSS_BRIGADES = ['unit-north-brigade-1', 'unit-north-brigade-2', 'unit-north-brigade-3'];
const ZULU_BRIGADES = ['unit-north-brigade-4', 'unit-north-brigade-5'];

describe('resolveBattleLineSelection', () => {
  it('resolves a division to its brigades as one group', () => {
    const result = resolveBattleLineSelection(battleRoster(), ['unit-north-division']);

    expect(result.groups).toEqual([
      {
        key: 'unit-north-division',
        ancestorUnitId: 'unit-north-division',
        brigadeIds: VOSS_BRIGADES,
      },
    ]);
    expect(result.brigadeIds).toEqual(VOSS_BRIGADES);
  });

  it('resolves a corps to all descendant brigades grouped by division', () => {
    const result = resolveBattleLineSelection(battleRoster(), ['unit-north-corps']);

    expect(result.groups).toEqual([
      {
        key: 'unit-north-division',
        ancestorUnitId: 'unit-north-division',
        brigadeIds: VOSS_BRIGADES,
      },
      {
        key: 'unit-north-division-2',
        ancestorUnitId: 'unit-north-division-2',
        brigadeIds: ZULU_BRIGADES,
      },
    ]);
    expect(result.brigadeIds).toEqual([...VOSS_BRIGADES, ...ZULU_BRIGADES]);
  });

  it('resolves an army to every descendant brigade grouped by division', () => {
    const result = resolveBattleLineSelection(battleRoster(), ['unit-north-army']);

    expect(result.groups.map((group) => group.ancestorUnitId)).toEqual([
      'unit-north-division',
      'unit-north-division-2',
    ]);
    expect(result.brigadeIds).toEqual([...VOSS_BRIGADES, ...ZULU_BRIGADES]);
  });

  it('keeps brigades from different divisions in separate groups', () => {
    const result = resolveBattleLineSelection(battleRoster(), [
      'unit-north-brigade-1',
      'unit-south-brigade-2',
    ]);

    expect(result.groups.map((group) => group.brigadeIds)).toEqual([
      ['unit-north-brigade-1'],
      ['unit-south-brigade-2'],
    ]);
    expect(result.brigadeIds).toEqual(['unit-north-brigade-1', 'unit-south-brigade-2']);
  });

  it('deduplicates a parent selected together with one of its brigades', () => {
    const result = resolveBattleLineSelection(battleRoster(), [
      'unit-north-division',
      'unit-north-brigade-2',
    ]);

    expect(result.brigadeIds).toEqual(VOSS_BRIGADES);
  });

  it('orders groups by the order of battle rather than click order', () => {
    const forward = resolveBattleLineSelection(battleRoster(), [
      'unit-north-division',
      'unit-south-division',
    ]);
    const reverse = resolveBattleLineSelection(battleRoster(), [
      'unit-south-division',
      'unit-north-division',
    ]);

    expect(forward).toEqual(reverse);
    expect(forward.brigadeIds).toEqual([
      ...VOSS_BRIGADES,
      'unit-south-brigade-1',
      'unit-south-brigade-3',
      'unit-south-brigade-2',
    ]);
  });

  it('returns an empty selection when nothing resolves to a brigade', () => {
    const result = resolveBattleLineSelection(createSeedRoster(), ['missing-unit']);
    expect(result.groups).toEqual([]);
    expect(result.brigadeIds).toEqual([]);
  });

  it('excludes brigades from hidden factions', () => {
    const result = resolveBattleLineSelection(
      battleRoster(),
      ['unit-south-division'],
      ['faction-south'],
    );

    expect(result.groups).toEqual([]);
    expect(result.brigadeIds).toEqual([]);
  });
});

describe('polylineLength', () => {
  it('sums segment lengths and ignores duplicate points', () => {
    expect(
      polylineLength([
        { x: 0, y: 0 },
        { x: 3, y: 4 },
        { x: 3, y: 4 },
        { x: 6, y: 8 },
      ]),
    ).toBe(10);
  });
});

describe('computeBattleLineLayout', () => {
  it('spreads equal-frontage brigades evenly across a straight line', () => {
    const roster = battleRoster();
    const states = equalFrontageStates(VOSS_BRIGADES);
    const result = computeBattleLineLayout({
      roster,
      states,
      brigadeIds: VOSS_BRIGADES,
      points: [
        { x: 0, y: 0 },
        { x: 300, y: 0 },
      ],
      frontageByEchelon: FRONTAGES,
      dynamicFrontage: false,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.states['unit-north-brigade-1']).toMatchObject({
      x: 50,
      y: 0,
      rotationDegrees: 0,
    });
    expect(result.states['unit-north-brigade-2']).toMatchObject({
      x: 150,
      y: 0,
      rotationDegrees: 0,
    });
    expect(result.states['unit-north-brigade-3']).toMatchObject({
      x: 250,
      y: 0,
      rotationDegrees: 0,
    });
  });

  it('leaves gaps on a long line and overlaps on a short line', () => {
    const roster = battleRoster();

    const long = computeBattleLineLayout({
      roster,
      states: equalFrontageStates(VOSS_BRIGADES),
      brigadeIds: VOSS_BRIGADES,
      points: [
        { x: 0, y: 0 },
        { x: 600, y: 0 },
      ],
      frontageByEchelon: FRONTAGES,
      dynamicFrontage: false,
    });
    const short = computeBattleLineLayout({
      roster,
      states: equalFrontageStates(VOSS_BRIGADES),
      brigadeIds: VOSS_BRIGADES,
      points: [
        { x: 0, y: 0 },
        { x: 60, y: 0 },
      ],
      frontageByEchelon: FRONTAGES,
      dynamicFrontage: false,
    });

    expect(long.ok).toBe(true);
    expect(short.ok).toBe(true);
    if (!long.ok || !short.ok) return;

    expect(long.states['unit-north-brigade-1']?.x).toBe(100);
    expect(long.states['unit-north-brigade-3']?.x).toBe(500);
    expect(short.states['unit-north-brigade-1']?.x).toBe(10);
    expect(short.states['unit-north-brigade-3']?.x).toBe(50);
  });

  it('follows arc length and local tangents on a curved line', () => {
    const roster = battleRoster();
    const result = computeBattleLineLayout({
      roster,
      states: equalFrontageStates(['unit-north-brigade-1', 'unit-north-brigade-2']),
      brigadeIds: ['unit-north-brigade-1', 'unit-north-brigade-2'],
      points: [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 100 },
      ],
      frontageByEchelon: FRONTAGES,
      dynamicFrontage: false,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.states['unit-north-brigade-1']).toMatchObject({
      x: 50,
      y: 0,
      rotationDegrees: 0,
    });
    expect(result.states['unit-north-brigade-2']).toMatchObject({
      x: 100,
      y: 50,
      rotationDegrees: 90,
    });
  });

  it('centres a single brigade at the midpoint', () => {
    const roster = battleRoster();
    const result = computeBattleLineLayout({
      roster,
      states: equalFrontageStates(['unit-north-brigade-1']),
      brigadeIds: ['unit-north-brigade-1'],
      points: [
        { x: 10, y: 20 },
        { x: 110, y: 20 },
      ],
      frontageByEchelon: FRONTAGES,
      dynamicFrontage: false,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.states['unit-north-brigade-1']).toMatchObject({ x: 60, y: 20 });
  });

  it('uses rendered frontage for proportional slots when dynamic frontage is on', () => {
    const roster = battleRoster();
    const states = {
      'unit-north-brigade-1': deployedState({
        frontageLength: 100,
        effectiveStrength: 3000,
      }),
      'unit-north-brigade-2': deployedState({
        frontageLength: 100,
        effectiveStrength: 1500,
      }),
    };
    const result = computeBattleLineLayout({
      roster,
      states,
      brigadeIds: ['unit-north-brigade-1', 'unit-north-brigade-2'],
      points: [
        { x: 0, y: 0 },
        { x: 300, y: 0 },
      ],
      frontageByEchelon: FRONTAGES,
      dynamicFrontage: true,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // Rendered frontages are 100 and 50, so the slots are 200 and 100.
    expect(result.states['unit-north-brigade-1']?.x).toBe(100);
    expect(result.states['unit-north-brigade-2']?.x).toBe(250);
  });

  it('preserves existing state fields while changing position and rotation', () => {
    const roster = battleRoster();
    const states = {
      'unit-north-brigade-1': deployedState({
        x: 5,
        y: 6,
        rotationDegrees: 12,
        frontageLength: 140,
        visible: false,
        effectiveStrength: 2100,
        status: 'engaged',
        labelOverride: 'Vanguard',
        notes: 'Hold the ford.',
      }),
    };
    const result = computeBattleLineLayout({
      roster,
      states,
      brigadeIds: ['unit-north-brigade-1'],
      points: [
        { x: 0, y: 100 },
        { x: 100, y: 100 },
      ],
      frontageByEchelon: FRONTAGES,
      dynamicFrontage: false,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.states['unit-north-brigade-1']).toEqual({
      x: 50,
      y: 100,
      rotationDegrees: 0,
      frontageLength: 140,
      visible: false,
      effectiveStrength: 2100,
      status: 'engaged',
      labelOverride: 'Vanguard',
      notes: 'Hold the ford.',
    });
  });

  it('deploys new brigades with the configured default frontage', () => {
    const roster = battleRoster();
    const result = computeBattleLineLayout({
      roster,
      states: {},
      brigadeIds: ['unit-north-brigade-1'],
      points: [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
      ],
      frontageByEchelon: { ...FRONTAGES, brigade: 155 },
      dynamicFrontage: false,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.states['unit-north-brigade-1']).toMatchObject({
      x: 50,
      y: 0,
      rotationDegrees: 0,
      frontageLength: 155,
      visible: true,
      status: 'reserve',
      effectiveStrength: 1800,
    });
  });

  it('rejects a degenerate line', () => {
    const roster = battleRoster();
    const result = computeBattleLineLayout({
      roster,
      states: {},
      brigadeIds: ['unit-north-brigade-1'],
      points: [
        { x: 0, y: 0 },
        { x: BATTLE_LINE_MIN_LENGTH / 2, y: 0 },
      ],
      frontageByEchelon: FRONTAGES,
      dynamicFrontage: false,
    });

    expect(result).toEqual({ ok: false, error: 'Draw a longer battle line.' });
  });

  it('rejects unknown or empty brigade selections', () => {
    const roster = battleRoster();
    expect(
      computeBattleLineLayout({
        roster,
        states: {},
        brigadeIds: [],
        points: [
          { x: 0, y: 0 },
          { x: 100, y: 0 },
        ],
        frontageByEchelon: FRONTAGES,
        dynamicFrontage: false,
      }).ok,
    ).toBe(false);

    expect(
      computeBattleLineLayout({
        roster,
        states: {},
        brigadeIds: ['missing-unit'],
        points: [
          { x: 0, y: 0 },
          { x: 100, y: 0 },
        ],
        frontageByEchelon: FRONTAGES,
        dynamicFrontage: false,
      }).ok,
    ).toBe(false);
  });

  it('does not mutate the roster or the existing states', () => {
    const roster = battleRoster();
    const states = equalFrontageStates(VOSS_BRIGADES);
    const rosterBefore = structuredClone(roster);
    const statesBefore = structuredClone(states);

    computeBattleLineLayout({
      roster,
      states,
      brigadeIds: VOSS_BRIGADES,
      points: [
        { x: 0, y: 0 },
        { x: 300, y: 0 },
      ],
      frontageByEchelon: FRONTAGES,
      dynamicFrontage: false,
    });

    expect(roster).toEqual(rosterBefore);
    expect(states).toEqual(statesBefore);
  });
});

describe('battle line commands', () => {
  it('recentres a deployed division behind its full brigade group', () => {
    const roster = battleRoster();
    const states = {
      ...equalFrontageStates(VOSS_BRIGADES),
      'unit-north-division': deployedState({ x: 900, y: 900, rotationDegrees: 77 }),
    };
    const result = computeBattleLineLayout({
      roster,
      states,
      brigadeIds: VOSS_BRIGADES,
      points: [
        { x: 0, y: 0 },
        { x: 300, y: 0 },
      ],
      frontageByEchelon: FRONTAGES,
      dynamicFrontage: false,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.states['unit-north-division']).toMatchObject({
      x: 150,
      y: BATTLE_LINE_COMMAND_OFFSETS.division,
      rotationDegrees: 0,
    });
    expect(result.unitIds).toEqual([...VOSS_BRIGADES, 'unit-north-division']);
  });

  it('does not recentre a partially included division', () => {
    const roster = battleRoster();
    const states = {
      ...equalFrontageStates(VOSS_BRIGADES),
      'unit-north-division': deployedState({ x: 900, y: 900, rotationDegrees: 77 }),
    };
    const result = computeBattleLineLayout({
      roster,
      states,
      brigadeIds: ['unit-north-brigade-1', 'unit-north-brigade-2'],
      points: [
        { x: 0, y: 0 },
        { x: 300, y: 0 },
      ],
      frontageByEchelon: FRONTAGES,
      dynamicFrontage: false,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.states['unit-north-division']).toBeUndefined();
    expect(result.unitIds).not.toContain('unit-north-division');
  });

  it('recentres an explicitly selected division even when only some brigades are passed', () => {
    const roster = battleRoster();
    const states = {
      ...equalFrontageStates(VOSS_BRIGADES),
      'unit-north-division': deployedState({ x: 900, y: 900, rotationDegrees: 77 }),
    };
    const result = computeBattleLineLayout({
      roster,
      states,
      brigadeIds: ['unit-north-brigade-2'],
      points: [
        { x: 0, y: 0 },
        { x: 300, y: 0 },
      ],
      frontageByEchelon: FRONTAGES,
      dynamicFrontage: false,
      explicitlySelectedUnitIds: ['unit-north-division'],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.states['unit-north-division']).toMatchObject({
      x: 150,
      y: BATTLE_LINE_COMMAND_OFFSETS.division,
      rotationDegrees: 0,
    });
  });

  it('deploys a selected division behind its brigade group', () => {
    const roster = battleRoster();
    const result = computeBattleLineLayout({
      roster,
      states: equalFrontageStates(VOSS_BRIGADES),
      brigadeIds: VOSS_BRIGADES,
      points: [
        { x: 0, y: 0 },
        { x: 300, y: 0 },
      ],
      frontageByEchelon: FRONTAGES,
      dynamicFrontage: false,
      explicitlySelectedUnitIds: ['unit-north-division'],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.states['unit-north-division']).toMatchObject({
      x: 150,
      y: BATTLE_LINE_COMMAND_OFFSETS.division,
      rotationDegrees: 0,
      status: 'reserve',
    });
    expect(result.unitIds).toEqual([...VOSS_BRIGADES, 'unit-north-division']);
  });

  it('deploys a selected corps and its divisions but not its undeployed army', () => {
    const roster = battleRoster();
    const allBrigades = [...VOSS_BRIGADES, ...ZULU_BRIGADES];
    const result = computeBattleLineLayout({
      roster,
      states: equalFrontageStates(allBrigades),
      brigadeIds: allBrigades,
      points: [
        { x: 0, y: 0 },
        { x: 500, y: 0 },
      ],
      frontageByEchelon: FRONTAGES,
      dynamicFrontage: false,
      explicitlySelectedUnitIds: ['unit-north-corps'],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.states['unit-north-division']?.y).toBe(BATTLE_LINE_COMMAND_OFFSETS.division);
    expect(result.states['unit-north-division-2']?.y).toBe(BATTLE_LINE_COMMAND_OFFSETS.division);
    expect(result.states['unit-north-corps']?.y).toBe(BATTLE_LINE_COMMAND_OFFSETS.corps);
    expect(result.states['unit-north-army']).toBeUndefined();
    expect(result.unitIds).toContain('unit-north-corps');
  });

  it('does not deploy commands for an arbitrary brigade selection', () => {
    const roster = battleRoster();
    const result = computeBattleLineLayout({
      roster,
      states: equalFrontageStates(VOSS_BRIGADES),
      brigadeIds: VOSS_BRIGADES,
      points: [
        { x: 0, y: 0 },
        { x: 300, y: 0 },
      ],
      frontageByEchelon: FRONTAGES,
      dynamicFrontage: false,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.states['unit-north-division']).toBeUndefined();
    expect(result.states['unit-north-corps']).toBeUndefined();
    expect(result.states['unit-north-army']).toBeUndefined();
  });

  it('offsets nested command labels at increasing distances', () => {
    const roster = battleRoster();
    const allBrigades = [...VOSS_BRIGADES, ...ZULU_BRIGADES];
    const result = computeBattleLineLayout({
      roster,
      states: equalFrontageStates(allBrigades),
      brigadeIds: allBrigades,
      points: [
        { x: 0, y: 0 },
        { x: 500, y: 0 },
      ],
      frontageByEchelon: FRONTAGES,
      dynamicFrontage: false,
      explicitlySelectedUnitIds: ['unit-north-army'],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.states['unit-north-division']?.y).toBe(BATTLE_LINE_COMMAND_OFFSETS.division);
    expect(result.states['unit-north-division-2']?.y).toBe(BATTLE_LINE_COMMAND_OFFSETS.division);
    expect(result.states['unit-north-corps']?.y).toBe(BATTLE_LINE_COMMAND_OFFSETS.corps);
    expect(result.states['unit-north-army']?.y).toBe(BATTLE_LINE_COMMAND_OFFSETS.army);
    expect(result.states['unit-north-division']?.rotationDegrees).toBe(0);
    expect(result.states['unit-north-corps']?.rotationDegrees).toBe(0);
  });

  it('rotates commands to the average tangent of a curved line', () => {
    const roster = battleRoster();
    const states = {
      ...equalFrontageStates(['unit-north-brigade-1', 'unit-north-brigade-2']),
      'unit-north-division': deployedState(),
    };
    const result = computeBattleLineLayout({
      roster,
      states,
      brigadeIds: ['unit-north-brigade-1', 'unit-north-brigade-2'],
      points: [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 100 },
      ],
      frontageByEchelon: FRONTAGES,
      dynamicFrontage: false,
      explicitlySelectedUnitIds: ['unit-north-division'],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.states['unit-north-division']?.rotationDegrees).toBeCloseTo(45, 1);
  });
});

describe('flip helpers', () => {
  it('normalizes rotations into [0, 360)', () => {
    expect(normalizeDegrees(0)).toBe(0);
    expect(normalizeDegrees(360)).toBe(0);
    expect(normalizeDegrees(-90)).toBe(270);
    expect(normalizeDegrees(725)).toBe(5);
  });

  it('flips a rotation by 180 degrees in place', () => {
    expect(flippedRotation(0)).toBe(180);
    expect(flippedRotation(180)).toBe(0);
    expect(flippedRotation(270)).toBe(90);
    expect(flippedRotation(-45)).toBe(135);
  });
});
