import { describe, expect, it } from 'vitest';
import { armyRosterSchema, createSeedRoster } from '../../models';
import {
  armyPlanSummaryLabel,
  generateArmy,
  planArmy,
  type ArmyGeneratorInput,
} from './armyGenerator';
import { findUnit, unitChildren } from './rosterDocuments';

const NORTH_FACTION_ID = 'faction-north';

function baseInput(overrides: Partial<ArmyGeneratorInput> = {}): ArmyGeneratorInput {
  return {
    faction: { kind: 'existing', factionId: NORTH_FACTION_ID },
    structure: 'independent',
    arms: [
      { unitType: 'infantry', brigadeCount: 0, strengthMode: 'average', strengthValue: 0 },
      { unitType: 'cavalry', brigadeCount: 0, strengthMode: 'average', strengthValue: 0 },
      { unitType: 'artillery', brigadeCount: 0, strengthMode: 'average', strengthValue: 0 },
    ],
    ...overrides,
  };
}

describe('army generator planning', () => {
  it('creates independent brigades with per-arm strengths', () => {
    const result = planArmy(
      baseInput({
        arms: [
          { unitType: 'infantry', brigadeCount: 9, strengthMode: 'average', strengthValue: 3000 },
          { unitType: 'cavalry', brigadeCount: 3, strengthMode: 'average', strengthValue: 900 },
          { unitType: 'artillery', brigadeCount: 2, strengthMode: 'total', strengthValue: 1600 },
        ],
      }),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.roots).toHaveLength(14);
    expect(result.roots.every((root) => root.echelon === 'brigade')).toBe(true);
    expect(result.roots.every((root) => root.children.length === 0)).toBe(true);
    expect(result.roots.filter((root) => root.unitType === 'infantry')).toHaveLength(9);
    expect(result.roots.filter((root) => root.unitType === 'cavalry')).toHaveLength(3);
    expect(result.roots.filter((root) => root.unitType === 'artillery')).toHaveLength(2);
    expect(result.summary).toEqual({
      brigadeCount: 14,
      totalStrength: 9 * 3000 + 3 * 900 + 1600,
      armyCount: 0,
      corpsCount: 0,
      divisionCount: 0,
    });

    const artilleryStrengths = result.roots
      .filter((root) => root.unitType === 'artillery')
      .map((root) => root.initialStrength);
    expect(artilleryStrengths).toEqual([800, 800]);
  });

  it('groups brigades into divisions and keeps the remainder in a smaller division', () => {
    const result = planArmy(
      baseInput({
        structure: 'divisions',
        brigadesPerDivision: 3,
        arms: [
          { unitType: 'infantry', brigadeCount: 7, strengthMode: 'average', strengthValue: 2500 },
          { unitType: 'cavalry', brigadeCount: 2, strengthMode: 'average', strengthValue: 700 },
        ],
      }),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.roots).toHaveLength(4);
    expect(result.roots.every((root) => root.echelon === 'division')).toBe(true);
    expect(result.roots.map((root) => root.children.length)).toEqual([3, 3, 1, 2]);
    expect(result.roots.every((root) => root.initialStrength === null)).toBe(true);
    expect(result.summary).toMatchObject({
      brigadeCount: 9,
      totalStrength: 7 * 2500 + 2 * 700,
      divisionCount: 4,
      corpsCount: 0,
      armyCount: 0,
    });
  });

  it('groups divisions into corps per arm', () => {
    const result = planArmy(
      baseInput({
        structure: 'corps',
        brigadesPerDivision: 3,
        divisionsPerCorps: 2,
        arms: [
          { unitType: 'infantry', brigadeCount: 6, strengthMode: 'average', strengthValue: 2000 },
          { unitType: 'artillery', brigadeCount: 1, strengthMode: 'average', strengthValue: 600 },
        ],
      }),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.roots).toHaveLength(2);
    expect(result.roots.every((root) => root.echelon === 'corps')).toBe(true);
    expect(result.roots[0]?.unitType).toBe('infantry');
    expect(result.roots[0]?.children).toHaveLength(2);
    expect(result.roots[0]?.children.every((division) => division.children.length === 3)).toBe(
      true,
    );
    expect(result.roots[1]?.unitType).toBe('artillery');
    expect(result.roots[1]?.children).toHaveLength(1);
    expect(result.summary).toMatchObject({
      brigadeCount: 7,
      corpsCount: 2,
      divisionCount: 3,
      armyCount: 0,
    });
  });

  it('wraps every corps in one named army root', () => {
    const result = planArmy(
      baseInput({
        structure: 'army',
        brigadesPerDivision: 2,
        divisionsPerCorps: 2,
        armyName: '  Army of the Gate  ',
        arms: [
          { unitType: 'infantry', brigadeCount: 8, strengthMode: 'total', strengthValue: 20000 },
          { unitType: 'cavalry', brigadeCount: 2, strengthMode: 'average', strengthValue: 800 },
        ],
      }),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.roots).toHaveLength(1);
    const army = result.roots[0]!;
    expect(army).toMatchObject({
      echelon: 'army',
      unitType: 'other',
      customName: 'Army of the Gate',
    });
    expect(army.children).toHaveLength(3);
    expect(army.children.every((corps) => corps.echelon === 'corps')).toBe(true);
    expect(result.summary).toEqual({
      brigadeCount: 10,
      totalStrength: 20000 + 2 * 800,
      armyCount: 1,
      corpsCount: 3,
      divisionCount: 5,
    });
    expect(armyPlanSummaryLabel(result.summary)).toBe(
      '1 army · 3 corps · 5 divisions · 10 brigades',
    );
  });

  it('splits an exact total evenly across the arm brigades', () => {
    const result = planArmy(
      baseInput({
        arms: [
          { unitType: 'infantry', brigadeCount: 3, strengthMode: 'total', strengthValue: 1000 },
          { unitType: 'cavalry', brigadeCount: 2, strengthMode: 'average', strengthValue: 450 },
        ],
      }),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const infantry = result.roots.filter((root) => root.unitType === 'infantry');
    expect(infantry).toHaveLength(3);
    for (const brigade of infantry) {
      expect(brigade.initialStrength).toBeCloseTo(1000 / 3, 10);
    }
    expect(result.summary.totalStrength).toBeCloseTo(1900, 10);
  });

  it('ignores zero-count arms even when their strength values are blank', () => {
    const result = planArmy(
      baseInput({
        arms: [
          { unitType: 'infantry', brigadeCount: 2, strengthMode: 'average', strengthValue: 1200 },
          { unitType: 'cavalry', brigadeCount: 0, strengthMode: 'average', strengthValue: 0 },
          { unitType: 'artillery', brigadeCount: 0, strengthMode: 'total', strengthValue: 0 },
        ],
      }),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.roots).toHaveLength(2);
    expect(result.summary.brigadeCount).toBe(2);
  });

  it('rejects empty, fractional, or unusable plans', () => {
    expect(planArmy(baseInput())).toEqual({
      ok: false,
      error: 'Add at least one arm with a brigade count above zero.',
    });

    const fractional = planArmy(
      baseInput({
        arms: [
          { unitType: 'infantry', brigadeCount: 1.5, strengthMode: 'average', strengthValue: 100 },
        ],
      }),
    );
    expect(fractional.ok).toBe(false);
    if (!fractional.ok) expect(fractional.error).toContain('whole numbers');

    const negative = planArmy(
      baseInput({
        arms: [
          { unitType: 'infantry', brigadeCount: -1, strengthMode: 'average', strengthValue: 100 },
        ],
      }),
    );
    expect(negative.ok).toBe(false);

    const missingStrength = planArmy(
      baseInput({
        arms: [
          { unitType: 'infantry', brigadeCount: 2, strengthMode: 'average', strengthValue: 0 },
        ],
      }),
    );
    expect(missingStrength.ok).toBe(false);
    if (!missingStrength.ok) expect(missingStrength.error).toContain('positive');

    const badDivision = planArmy(
      baseInput({
        structure: 'divisions',
        brigadesPerDivision: 0,
        arms: [
          { unitType: 'infantry', brigadeCount: 2, strengthMode: 'average', strengthValue: 100 },
        ],
      }),
    );
    expect(badDivision.ok).toBe(false);
    if (!badDivision.ok) expect(badDivision.error).toContain('Brigades per division');

    const badCorps = planArmy(
      baseInput({
        structure: 'corps',
        brigadesPerDivision: 2,
        divisionsPerCorps: 1.5,
        arms: [
          { unitType: 'infantry', brigadeCount: 2, strengthMode: 'average', strengthValue: 100 },
        ],
      }),
    );
    expect(badCorps.ok).toBe(false);
    if (!badCorps.ok) expect(badCorps.error).toContain('Divisions per corps');
  });
});

describe('army generation', () => {
  it('appends a homogeneous army to an existing faction', () => {
    const roster = createSeedRoster();
    const originalUnits = roster.units.length;
    const originalFactions = roster.factions.length;

    const result = generateArmy(
      roster,
      baseInput({
        structure: 'divisions',
        brigadesPerDivision: 2,
        arms: [
          { unitType: 'infantry', brigadeCount: 4, strengthMode: 'average', strengthValue: 1800 },
          { unitType: 'cavalry', brigadeCount: 2, strengthMode: 'total', strengthValue: 1200 },
        ],
      }),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(roster.units).toHaveLength(originalUnits);
    expect(result.document.units).toHaveLength(originalUnits + 9);
    expect(result.document.factions).toHaveLength(originalFactions);
    expect(armyRosterSchema.safeParse(result.document).success).toBe(true);

    expect(result.unitIds).toHaveLength(9);
    expect(result.rootUnitIds).toHaveLength(3);
    expect(result.factionId).toBe(NORTH_FACTION_ID);
    expect(result.factionName).toBe('Northern League');

    const generated = result.document.units.slice(originalUnits);
    expect(new Set(generated.map((unit) => unit.factionId))).toEqual(new Set([NORTH_FACTION_ID]));
    expect(generated.filter((unit) => unit.echelon === 'division')).toHaveLength(3);
    expect(generated.filter((unit) => unit.echelon === 'brigade')).toHaveLength(6);

    for (const division of generated.filter((unit) => unit.echelon === 'division')) {
      expect(division.initialStrength).toBeNull();
      const children = unitChildren(result.document, division.id);
      expect(children.length).toBeGreaterThan(0);
      expect(children.every((child) => child.unitType === division.unitType)).toBe(true);
    }

    for (const brigade of generated.filter((unit) => unit.echelon === 'brigade')) {
      expect(brigade.defaultSymbolStyle.color).toBe(
        result.document.factions.find((faction) => faction.id === NORTH_FACTION_ID)?.color,
      );
      expect(brigade.initialStrength).not.toBeNull();
    }

    const cavalry = generated.filter((unit) => unit.unitType === 'cavalry');
    expect(cavalry.filter((unit) => unit.echelon === 'brigade')).toHaveLength(2);
    for (const brigade of cavalry.filter((unit) => unit.echelon === 'brigade')) {
      expect(brigade.initialStrength).toBe(600);
    }

    expect(findUnit(result.document, result.rootUnitIds[0]!)?.parentUnitId).toBeNull();
  });

  it('creates a faction when the generator is given a new one', () => {
    const roster = createSeedRoster();
    const originalFactions = roster.factions.length;

    const result = generateArmy(
      roster,
      baseInput({
        faction: { kind: 'new', name: '  Army of the Reach  ', color: '#123456' },
        arms: [
          { unitType: 'infantry', brigadeCount: 1, strengthMode: 'average', strengthValue: 900 },
        ],
      }),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.document.factions).toHaveLength(originalFactions + 1);
    expect(result.factionName).toBe('Army of the Reach');
    const faction = result.document.factions.find((candidate) => candidate.id === result.factionId);
    expect(faction).toMatchObject({ name: 'Army of the Reach', color: '#123456' });
    const generated = findUnit(result.document, result.unitIds[0]!);
    expect(generated?.factionId).toBe(result.factionId);
    expect(generated?.defaultSymbolStyle.color).toBe('#123456');
  });

  it('rejects a missing existing faction or a blank new faction without changing the roster', () => {
    const roster = createSeedRoster();
    const original = structuredClone(roster);

    const missing = generateArmy(
      roster,
      baseInput({
        faction: { kind: 'existing', factionId: 'faction-ghost' },
        arms: [
          { unitType: 'infantry', brigadeCount: 1, strengthMode: 'average', strengthValue: 900 },
        ],
      }),
    );
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.error).toContain('Choose a faction');

    const blankName = generateArmy(
      roster,
      baseInput({
        faction: { kind: 'new', name: '   ', color: '#123456' },
        arms: [
          { unitType: 'infantry', brigadeCount: 1, strengthMode: 'average', strengthValue: 900 },
        ],
      }),
    );
    expect(blankName.ok).toBe(false);
    if (!blankName.ok) expect(blankName.error).toContain('faction name');

    const blankColor = generateArmy(
      roster,
      baseInput({
        faction: { kind: 'new', name: 'New Army', color: '  ' },
        arms: [
          { unitType: 'infantry', brigadeCount: 1, strengthMode: 'average', strengthValue: 900 },
        ],
      }),
    );
    expect(blankColor.ok).toBe(false);
    if (!blankColor.ok) expect(blankColor.error).toContain('faction color');

    expect(roster).toEqual(original);
  });

  it('labels empty and populated summaries', () => {
    expect(
      armyPlanSummaryLabel({
        brigadeCount: 0,
        totalStrength: 0,
        armyCount: 0,
        corpsCount: 0,
        divisionCount: 0,
      }),
    ).toBe('');
    expect(
      armyPlanSummaryLabel({
        brigadeCount: 1,
        totalStrength: 500,
        armyCount: 0,
        corpsCount: 0,
        divisionCount: 1,
      }),
    ).toBe('1 division · 1 brigade');
  });
});
