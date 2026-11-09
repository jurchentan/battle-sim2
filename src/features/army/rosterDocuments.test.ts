import { describe, expect, it } from 'vitest';
import { armyRosterSchema, createSeedRoster } from '../../models';
import {
  canEchelonBeSubordinateOf,
  canHaveSubordinates,
  createBlankRoster,
  defaultUnitStrength,
  descendantUnitIds,
  draftUnitDisplayName,
  duplicateRoster,
  effectiveUnitStrength,
  eligibleParentUnits,
  findUnit,
  hierarchyPath,
  isStrengthAggregated,
  nextEchelonFor,
  normalizeRosterDocument,
  ordinalLabel,
  reparentError,
  smallestUnitChangeError,
  unitChildren,
  unitDepth,
  unitDisplayName,
  unitDynamicName,
} from './rosterDocuments';

describe('army roster document helpers', () => {
  it('creates a valid empty roster', () => {
    const roster = createBlankRoster('New roster');

    expect(armyRosterSchema.safeParse(roster).success).toBe(true);
    expect(roster.name).toBe('New roster');
    expect(roster.factions).toEqual([]);
    expect(roster.units).toEqual([]);
  });

  it('follows the default army/corps/division/brigade chain', () => {
    expect(nextEchelonFor(null)).toBe('army');
    expect(nextEchelonFor('army')).toBe('corps');
    expect(nextEchelonFor('corps')).toBe('division');
    expect(nextEchelonFor('division')).toBe('brigade');
    expect(nextEchelonFor('brigade')).toBe('regiment');
    expect(nextEchelonFor('other')).toBe('brigade');
  });

  it('duplicates a roster with a new identity and independent collections', () => {
    const source = createSeedRoster();
    const duplicate = duplicateRoster(source, 'Copied roster');

    expect(duplicate.id).not.toBe(source.id);
    expect(duplicate.name).toBe('Copied roster');
    expect(duplicate.units).toEqual(source.units);
    expect(duplicate.units).not.toBe(source.units);
    expect(duplicate.units[0]).not.toBe(source.units[0]);
    expect(armyRosterSchema.safeParse(duplicate).success).toBe(true);
  });

  it('sorts direct children by echelon and name', () => {
    const roster = createSeedRoster();
    const children = unitChildren(roster, 'unit-north-army');

    expect(children.map((unit) => unit.id)).toEqual(['unit-north-corps']);
  });

  it('reports hierarchy depth, paths, and descendants', () => {
    const roster = createSeedRoster();

    expect(unitDepth(roster, 'unit-north-army')).toBe(0);
    expect(unitDepth(roster, 'unit-north-division')).toBe(2);
    expect(hierarchyPath(roster, 'unit-north-brigade-1').map((unit) => unit.id)).toEqual([
      'unit-north-army',
      'unit-north-corps',
      'unit-north-division',
      'unit-north-brigade-1',
    ]);
    expect(descendantUnitIds(roster, 'unit-north-corps')).toEqual(
      new Set([
        'unit-north-division',
        'unit-north-brigade-1',
        'unit-north-brigade-2',
        'unit-north-brigade-3',
      ]),
    );
  });

  it('rejects unsafe parent candidates but allows a valid ancestor', () => {
    const roster = createSeedRoster();

    expect(reparentError(roster, 'unit-north-corps', 'unit-north-corps')).toContain('own parent');
    expect(reparentError(roster, 'unit-north-corps', 'unit-north-division')).toContain('cycle');
    expect(reparentError(roster, 'unit-north-brigade-1', 'unit-south-division')).toContain(
      'same faction',
    );
    expect(reparentError(roster, 'unit-north-brigade-1', 'unit-north-brigade-2')).toContain(
      'cannot be placed under',
    );
    expect(reparentError(roster, 'unit-north-brigade-1', 'unit-north-corps')).toBeNull();

    const candidates = eligibleParentUnits(roster, 'unit-north-corps');
    expect(candidates.map((unit) => unit.id)).toContain('unit-north-army');
    expect(candidates.map((unit) => unit.id)).not.toContain('unit-north-corps');
    expect(candidates.map((unit) => unit.id)).not.toContain('unit-north-division');
    expect(candidates.map((unit) => unit.id)).not.toContain('unit-south-army');
    expect(candidates.map((unit) => unit.id)).not.toContain('unit-north-brigade-1');
  });

  it('requires every subordinate to sit below its parent echelon', () => {
    const roster = createSeedRoster();

    expect(canEchelonBeSubordinateOf('corps', 'army')).toBe(true);
    expect(canEchelonBeSubordinateOf('army', 'corps')).toBe(false);
    expect(canEchelonBeSubordinateOf('division', 'division')).toBe(false);
    expect(canEchelonBeSubordinateOf('other', 'regiment')).toBe(true);

    expect(eligibleParentUnits(roster, 'unit-north-division').map((unit) => unit.id)).toEqual([
      'unit-north-army',
      'unit-north-corps',
    ]);
    expect(eligibleParentUnits(roster, 'unit-north-brigade-1').map((unit) => unit.id)).toEqual([
      'unit-north-army',
      'unit-north-corps',
      'unit-north-division',
    ]);

    roster.units.push(
      {
        ...findUnit(roster, 'unit-north-corps')!,
        id: 'unit-north-corps-2',
        customName: 'Independent Corps',
        parentUnitId: null,
      },
      {
        ...findUnit(roster, 'unit-north-brigade-1')!,
        id: 'unit-north-brigade-4',
        customName: 'Independent Brigade',
        parentUnitId: null,
      },
    );

    expect(reparentError(roster, 'unit-north-division', 'unit-north-brigade-4')).toContain(
      'cannot be placed under',
    );
    expect(reparentError(roster, 'unit-north-army', 'unit-north-corps-2')).toContain(
      'cannot be placed under',
    );
    expect(reparentError(roster, 'unit-north-corps', 'unit-north-army')).toBeNull();
  });

  it('derives formation strength from the configured smallest unit', () => {
    const roster = createSeedRoster();
    const division = findUnit(roster, 'unit-north-division');
    const brigade = findUnit(roster, 'unit-north-brigade-1');
    if (!division || !brigade) throw new Error('Missing seeded units');

    expect(effectiveUnitStrength(roster, division.id)).toBe(5000);
    expect(effectiveUnitStrength(roster, 'unit-north-corps')).toBe(5000);
    expect(effectiveUnitStrength(roster, 'unit-north-army')).toBe(5000);
    expect(effectiveUnitStrength(roster, brigade.id)).toBe(1800);
    expect(isStrengthAggregated(roster, division)).toBe(true);
    expect(isStrengthAggregated(roster, brigade)).toBe(false);
  });

  it('moves the leaf echelon when the smallest unit setting changes', () => {
    const roster = createSeedRoster();
    const division = findUnit(roster, 'unit-north-division');
    const brigade = findUnit(roster, 'unit-north-brigade-1');
    if (!division || !brigade) throw new Error('Missing seeded units');

    expect(canHaveSubordinates(roster, division)).toBe(true);
    expect(canHaveSubordinates(roster, brigade)).toBe(false);

    const regimentRoster = { ...roster, smallestUnitEchelon: 'regiment' as const };
    expect(canHaveSubordinates(regimentRoster, brigade)).toBe(true);
    expect(effectiveUnitStrength(regimentRoster, division.id)).toBe(5000);

    expect(smallestUnitChangeError(roster, 'regiment')).toBeNull();
    expect(smallestUnitChangeError(roster, 'corps')).toContain('below Corps');
  });

  it('infers the smallest unit when opening rosters saved before the setting existed', () => {
    const legacy = structuredClone(createSeedRoster()) as Partial<
      ReturnType<typeof createSeedRoster>
    >;
    delete legacy.smallestUnitEchelon;

    expect(normalizeRosterDocument(legacy as ReturnType<typeof createSeedRoster>)).toMatchObject({
      smallestUnitEchelon: 'brigade',
    });

    legacy.units?.push({
      ...legacy.units[3]!,
      id: 'unit-legacy-regiment',
      customName: 'Legacy Regiment',
      echelon: 'regiment',
      parentUnitId: 'unit-north-brigade-1',
    });
    expect(normalizeRosterDocument(legacy as ReturnType<typeof createSeedRoster>)).toMatchObject({
      smallestUnitEchelon: 'regiment',
    });
  });

  it('accepts rosters without the smallest-unit field and defaults to brigade', () => {
    const legacy = structuredClone(createSeedRoster()) as Record<string, unknown>;
    delete legacy.smallestUnitEchelon;

    const parsed = armyRosterSchema.safeParse(legacy);
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.smallestUnitEchelon).toBe('brigade');
  });

  it('provides faction default strengths only at or below the smallest unit', () => {
    const roster = createSeedRoster();
    const north = roster.factions.find((faction) => faction.id === 'faction-north')!;
    const south = roster.factions.find((faction) => faction.id === 'faction-south')!;

    expect(defaultUnitStrength(north, 'infantry', 'brigade', 'brigade')).toBe(1500);
    expect(defaultUnitStrength(north, 'cavalry', 'brigade', 'brigade')).toBe(800);
    expect(defaultUnitStrength(north, 'artillery', 'regiment', 'brigade')).toBe(100);
    expect(defaultUnitStrength(north, 'infantry', 'regiment', 'regiment')).toBe(500);
    expect(defaultUnitStrength(north, 'infantry', 'division', 'brigade')).toBeNull();
    expect(defaultUnitStrength(north, 'artillery', 'corps', 'division')).toBeNull();
    expect(defaultUnitStrength(north, 'other', 'brigade', 'brigade')).toBeNull();

    north.defaultStrengths.infantry.brigade = 2000;
    expect(defaultUnitStrength(north, 'infantry', 'brigade', 'brigade')).toBe(2000);
    expect(defaultUnitStrength(south, 'infantry', 'brigade', 'brigade')).toBe(1500);
  });

  it('formats ordinal labels with English suffixes', () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 101].map(ordinalLabel)).toEqual([
      '1st',
      '2nd',
      '3rd',
      '4th',
      '11th',
      '12th',
      '13th',
      '21st',
      '22nd',
      '23rd',
      '101st',
    ]);
  });

  it('generates universal numeric names scoped by faction and echelon', () => {
    const roster = createSeedRoster();

    expect(unitDynamicName(roster, findUnit(roster, 'unit-north-brigade-1')!)).toBe('1st Brigade');
    expect(unitDynamicName(roster, findUnit(roster, 'unit-north-brigade-2')!)).toBe('2nd Brigade');
    expect(unitDynamicName(roster, findUnit(roster, 'unit-north-brigade-3')!)).toBe('3rd Brigade');
    expect(unitDynamicName(roster, findUnit(roster, 'unit-south-brigade-1')!)).toBe(
      'Johnstons Brigade',
    );
    expect(unitDisplayName(roster, findUnit(roster, 'unit-south-division')!)).toBe(
      'Riels Division',
    );
    expect(unitDisplayName(roster, findUnit(roster, 'unit-north-army')!)).toBe('Army of the North');
  });

  it('regenerates universal numbers by faction and echelon', () => {
    const roster = createSeedRoster();

    expect(unitDynamicName(roster, findUnit(roster, 'unit-north-corps')!)).toBe('1st Corps');
    expect(unitDynamicName(roster, findUnit(roster, 'unit-north-division')!)).toBe('1st Division');
    expect(unitDynamicName(roster, findUnit(roster, 'unit-south-brigade-2')!)).toBe(
      'Sarrs Brigade',
    );
  });

  it('applies naming modes per echelon within a faction', () => {
    const roster = createSeedRoster();
    const south = roster.factions.find((faction) => faction.id === 'faction-south')!;
    south.namingModes = {
      ...south.namingModes,
      division: 'commander',
      brigade: 'numeric-universal',
    };

    expect(unitDynamicName(roster, findUnit(roster, 'unit-south-division')!)).toBe(
      'Riels Division',
    );
    expect(unitDynamicName(roster, findUnit(roster, 'unit-south-corps')!)).toBe(
      'Lucia Marrs Corps',
    );
    expect(unitDynamicName(roster, findUnit(roster, 'unit-south-brigade-1')!)).toBe('1st Brigade');
    expect(unitDynamicName(roster, findUnit(roster, 'unit-south-brigade-2')!)).toBe('2nd Brigade');
    expect(unitDynamicName(roster, findUnit(roster, 'unit-south-brigade-3')!)).toBe('3rd Brigade');
  });

  it('scopes local numbers to each parent formation', () => {
    const roster = createSeedRoster();
    const north = roster.factions.find((faction) => faction.id === 'faction-north')!;
    north.namingModes = { ...north.namingModes, brigade: 'numeric-local' };

    roster.units.push({
      ...findUnit(roster, 'unit-north-division')!,
      id: 'unit-north-division-2',
      customName: 'Holt Division',
    });
    roster.units.push(
      {
        ...findUnit(roster, 'unit-north-brigade-1')!,
        id: 'unit-north-division-2-brigade-1',
        parentUnitId: 'unit-north-division-2',
      },
      {
        ...findUnit(roster, 'unit-north-brigade-1')!,
        id: 'unit-north-division-2-brigade-2',
        parentUnitId: 'unit-north-division-2',
      },
    );

    expect(unitDynamicName(roster, findUnit(roster, 'unit-north-brigade-1')!)).toBe('1st Brigade');
    expect(unitDynamicName(roster, findUnit(roster, 'unit-north-brigade-3')!)).toBe('3rd Brigade');
    expect(unitDynamicName(roster, findUnit(roster, 'unit-north-division-2-brigade-1')!)).toBe(
      '1st Brigade',
    );
    expect(unitDynamicName(roster, findUnit(roster, 'unit-north-division-2-brigade-2')!)).toBe(
      '2nd Brigade',
    );
  });

  it('previews local numbers within the chosen parent', () => {
    const roster = createSeedRoster();
    const north = roster.factions.find((faction) => faction.id === 'faction-north')!;
    north.namingModes = { ...north.namingModes, brigade: 'numeric-local' };

    expect(
      draftUnitDisplayName(roster, {
        factionId: 'faction-north',
        echelon: 'brigade',
        parentUnitId: 'unit-north-division',
      }),
    ).toBe('4th Brigade');
    expect(
      draftUnitDisplayName(roster, {
        factionId: 'faction-north',
        echelon: 'brigade',
        parentUnitId: null,
      }),
    ).toBe('1st Brigade');
  });

  it('uses a custom name over generated names and skips custom units when numbering', () => {
    const roster = createSeedRoster();
    const first = findUnit(roster, 'unit-north-brigade-1')!;
    const second = findUnit(roster, 'unit-north-brigade-2')!;

    first.customName = 'Guards Brigade';
    expect(unitDisplayName(roster, first)).toBe('Guards Brigade');
    expect(unitDynamicName(roster, second)).toBe('1st Brigade');
  });

  it('falls back to numeric naming and handles names ending in s', () => {
    const roster = createSeedRoster();
    const brigade = findUnit(roster, 'unit-south-brigade-1')!;

    brigade.commander = 'Jones';
    expect(unitDynamicName(roster, brigade)).toBe("Jones' Brigade");

    brigade.commander = 'Sigel';
    expect(unitDynamicName(roster, brigade)).toBe('Sigels Brigade');

    brigade.commander = undefined;
    expect(unitDynamicName(roster, brigade)).toBe('1st Brigade');
  });
});
