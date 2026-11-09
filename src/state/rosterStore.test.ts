import { beforeEach, describe, expect, it } from 'vitest';
import { armyRosterSchema, createSeedRoster, defaultFactionStrengths } from '../models';
import { findUnit, unitDisplayName, unitDynamicName } from '../features/army/rosterDocuments';
import { useRosterStore } from './rosterStore';

function resetStore(): void {
  useRosterStore.getState().loadDocument(createSeedRoster());
}

function unwrap<T extends { ok: true }>(result: T | { ok: false; error: string }): T {
  if (!result.ok) throw new Error(result.error);
  return result;
}

describe('army roster store', () => {
  beforeEach(resetStore);

  it('adds factions and a valid default hierarchy as undoable edits', () => {
    useRosterStore.getState().loadDocument({
      ...createSeedRoster(),
      factions: [],
      units: [],
    });

    const faction = unwrap(
      useRosterStore.getState().addFaction({
        name: 'Northern League',
        color: '#2f5d8a',
      }),
    );
    expect(useRosterStore.getState().document.factions[0]?.namingModes).toEqual({
      army: 'numeric-universal',
      corps: 'numeric-universal',
      division: 'numeric-universal',
      brigade: 'numeric-universal',
      regiment: 'numeric-universal',
      other: 'numeric-universal',
    });

    const army = unwrap(
      useRosterStore.getState().addUnit({
        factionId: faction.id,
        customName: 'Army of the North',
        echelon: 'army',
        unitType: 'other',
        parentUnitId: null,
        commander: 'Adele Voss',
        initialStrength: 12000,
      }),
    );
    const corps = unwrap(
      useRosterStore.getState().addUnit({
        factionId: faction.id,
        customName: 'I Corps',
        echelon: 'corps',
        unitType: 'other',
        parentUnitId: army.id,
        commander: 'Bram Holt',
        initialStrength: 9000,
      }),
    );
    const division = unwrap(
      useRosterStore.getState().addUnit({
        factionId: faction.id,
        customName: 'Voss Division',
        echelon: 'division',
        unitType: 'other',
        parentUnitId: corps.id,
        commander: 'Ines Kerr',
        initialStrength: 6000,
      }),
    );
    const brigade = unwrap(
      useRosterStore.getState().addUnit({
        factionId: faction.id,
        echelon: 'brigade',
        unitType: 'infantry',
        parentUnitId: division.id,
        commander: 'Sara Hale',
        initialStrength: 1800,
      }),
    );

    const state = useRosterStore.getState();
    expect(state.document.factions).toHaveLength(1);
    expect(state.document.units).toHaveLength(4);
    expect(state.document.units.find((unit) => unit.id === brigade.id)?.parentUnitId).toBe(
      division.id,
    );
    expect(state.past.length).toBe(5);
    expect(armyRosterSchema.safeParse(state.document).success).toBe(true);
  });

  it('applies default strengths to new strength-bearing units', () => {
    useRosterStore.getState().loadDocument({
      ...createSeedRoster(),
      factions: [],
      units: [],
    });
    const faction = unwrap(
      useRosterStore.getState().addFaction({ name: 'Test army', color: '#123456' }),
    );

    const infantry = unwrap(
      useRosterStore.getState().addUnit({
        factionId: faction.id,
        echelon: 'brigade',
        unitType: 'infantry',
        parentUnitId: null,
      }),
    );
    const cavalry = unwrap(
      useRosterStore.getState().addUnit({
        factionId: faction.id,
        echelon: 'brigade',
        unitType: 'cavalry',
        parentUnitId: null,
      }),
    );
    const artillery = unwrap(
      useRosterStore.getState().addUnit({
        factionId: faction.id,
        echelon: 'brigade',
        unitType: 'artillery',
        parentUnitId: null,
      }),
    );
    const aboveSmallest = unwrap(
      useRosterStore.getState().addUnit({
        factionId: faction.id,
        echelon: 'division',
        unitType: 'infantry',
        parentUnitId: null,
      }),
    );
    const other = unwrap(
      useRosterStore.getState().addUnit({
        factionId: faction.id,
        echelon: 'brigade',
        unitType: 'other',
        parentUnitId: null,
      }),
    );
    const explicitBlank = unwrap(
      useRosterStore.getState().addUnit({
        factionId: faction.id,
        echelon: 'brigade',
        unitType: 'infantry',
        parentUnitId: null,
        initialStrength: null,
      }),
    );

    const document = useRosterStore.getState().document;
    expect(findUnit(document, infantry.id)?.initialStrength).toBe(1500);
    expect(findUnit(document, cavalry.id)?.initialStrength).toBe(800);
    expect(findUnit(document, artillery.id)?.initialStrength).toBe(300);
    expect(findUnit(document, aboveSmallest.id)?.initialStrength).toBeNull();
    expect(findUnit(document, other.id)?.initialStrength).toBeNull();
    expect(findUnit(document, explicitBlank.id)?.initialStrength).toBeNull();
    expect(armyRosterSchema.safeParse(document).success).toBe(true);

    const customStrengths = defaultFactionStrengths();
    customStrengths.infantry.brigade = 2500;
    const customFaction = unwrap(
      useRosterStore.getState().addFaction({
        name: 'Custom army',
        color: '#654321',
        defaultStrengths: customStrengths,
      }),
    );
    const customBrigade = unwrap(
      useRosterStore.getState().addUnit({
        factionId: customFaction.id,
        echelon: 'brigade',
        unitType: 'infantry',
        parentUnitId: null,
      }),
    );
    expect(findUnit(useRosterStore.getState().document, customBrigade.id)?.initialStrength).toBe(
      2500,
    );
  });

  it('generates names from faction naming mode with custom-name precedence', () => {
    const north = unwrap(
      useRosterStore.getState().addUnit({
        factionId: 'faction-north',
        echelon: 'brigade',
        unitType: 'infantry',
        parentUnitId: 'unit-north-division',
        commander: 'Test',
      }),
    );
    let document = useRosterStore.getState().document;
    expect(unitDisplayName(document, findUnit(document, north.id)!)).toBe('4th Brigade');

    const custom = unwrap(
      useRosterStore.getState().addUnit({
        factionId: 'faction-north',
        echelon: 'brigade',
        unitType: 'infantry',
        parentUnitId: 'unit-north-division',
        customName: 'Guards Brigade',
      }),
    );
    const next = unwrap(
      useRosterStore.getState().addUnit({
        factionId: 'faction-north',
        echelon: 'brigade',
        unitType: 'infantry',
        parentUnitId: 'unit-north-division',
      }),
    );

    document = useRosterStore.getState().document;
    expect(unitDisplayName(document, findUnit(document, custom.id)!)).toBe('Guards Brigade');
    expect(unitDisplayName(document, findUnit(document, next.id)!)).toBe('5th Brigade');

    const south = unwrap(
      useRosterStore.getState().addUnit({
        factionId: 'faction-south',
        echelon: 'brigade',
        unitType: 'infantry',
        parentUnitId: 'unit-south-division',
        commander: 'Jones',
      }),
    );
    document = useRosterStore.getState().document;
    expect(unitDynamicName(document, findUnit(document, south.id)!)).toBe("Jones' Brigade");

    unwrap(useRosterStore.getState().updateUnit(south.id, { commander: '   ' }));
    document = useRosterStore.getState().document;
    expect(findUnit(document, south.id)?.commander).toBeUndefined();
    expect(unitDisplayName(document, findUnit(document, south.id)!)).toBe('4th Brigade');

    unwrap(useRosterStore.getState().updateUnit(custom.id, { customName: '   ' }));
    document = useRosterStore.getState().document;
    expect(findUnit(document, custom.id)?.customName).toBeUndefined();
    expect(unitDisplayName(document, findUnit(document, custom.id)!)).toBe('5th Brigade');
  });

  it('numbers local mode within each parent formation', () => {
    const roster = createSeedRoster();
    const north = roster.factions.find((faction) => faction.id === 'faction-north');
    if (!north) throw new Error('Missing seeded North faction');
    north.namingModes = { ...north.namingModes, brigade: 'numeric-local' };
    useRosterStore.getState().loadDocument(roster);

    const secondDivision = unwrap(
      useRosterStore.getState().addUnit({
        factionId: 'faction-north',
        customName: 'Holt Division',
        echelon: 'division',
        unitType: 'other',
        parentUnitId: 'unit-north-corps',
      }),
    );
    const secondFirst = unwrap(
      useRosterStore.getState().addUnit({
        factionId: 'faction-north',
        echelon: 'brigade',
        unitType: 'infantry',
        parentUnitId: secondDivision.id,
      }),
    );
    const secondSecond = unwrap(
      useRosterStore.getState().addUnit({
        factionId: 'faction-north',
        echelon: 'brigade',
        unitType: 'infantry',
        parentUnitId: secondDivision.id,
      }),
    );
    const firstFourth = unwrap(
      useRosterStore.getState().addUnit({
        factionId: 'faction-north',
        echelon: 'brigade',
        unitType: 'infantry',
        parentUnitId: 'unit-north-division',
      }),
    );

    const document = useRosterStore.getState().document;
    expect(unitDisplayName(document, findUnit(document, 'unit-north-brigade-1')!)).toBe(
      '1st Brigade',
    );
    expect(unitDisplayName(document, findUnit(document, secondFirst.id)!)).toBe('1st Brigade');
    expect(unitDisplayName(document, findUnit(document, secondSecond.id)!)).toBe('2nd Brigade');
    expect(unitDisplayName(document, findUnit(document, firstFourth.id)!)).toBe('4th Brigade');
  });

  it('reparents safely and rejects self-parenting and indirect cycles', () => {
    const before = useRosterStore.getState().document;

    const cycle = useRosterStore
      .getState()
      .reparentUnit('unit-north-corps', 'unit-north-brigade-1');
    expect(cycle.ok).toBe(false);
    if (!cycle.ok) expect(cycle.error).toContain('cycle');
    expect(useRosterStore.getState().document).toBe(before);
    expect(useRosterStore.getState().past).toHaveLength(0);

    const self = useRosterStore.getState().reparentUnit('unit-north-corps', 'unit-north-corps');
    expect(self.ok).toBe(false);
    if (!self.ok) expect(self.error).toContain('own parent');

    const crossFaction = useRosterStore
      .getState()
      .reparentUnit('unit-north-brigade-1', 'unit-south-division');
    expect(crossFaction.ok).toBe(false);
    if (!crossFaction.ok) expect(crossFaction.error).toContain('same faction');

    const safe = useRosterStore.getState().reparentUnit('unit-north-brigade-1', 'unit-north-corps');
    expect(safe.ok).toBe(true);
    expect(
      useRosterStore.getState().document.units.find((unit) => unit.id === 'unit-north-brigade-1')
        ?.parentUnitId,
    ).toBe('unit-north-corps');
    expect(useRosterStore.getState().past).toHaveLength(1);
  });

  it('rejects unknown parents when creating a unit', () => {
    const missingParent = useRosterStore.getState().addUnit({
      factionId: 'faction-north',
      customName: 'Lost Brigade',
      echelon: 'brigade',
      unitType: 'infantry',
      parentUnitId: 'unit-ghost',
      initialStrength: 1000,
    });
    expect(missingParent.ok).toBe(false);
    expect(useRosterStore.getState().document.units).toHaveLength(12);
  });

  it('edits unit fields, commander text, symbol style, and notes as undoable edits', () => {
    const unit = useRosterStore
      .getState()
      .document.units.find((candidate) => candidate.id === 'unit-north-brigade-1');
    if (!unit) throw new Error('Missing seeded brigade');

    unwrap(
      useRosterStore.getState().updateUnit(unit.id, {
        customName: '1st Grenadier Brigade',
        commander: 'A. Test',
        unitType: 'cavalry',
        initialStrength: 2100,
        notes: 'Held the ford.',
        defaultSymbolStyle: { ...unit.defaultSymbolStyle, color: '#123456', thickness: 9 },
      }),
    );

    const updated = useRosterStore
      .getState()
      .document.units.find((candidate) => candidate.id === unit.id);
    expect(updated?.customName).toBe('1st Grenadier Brigade');
    expect(updated?.commander).toBe('A. Test');
    expect(updated?.unitType).toBe('cavalry');
    expect(updated?.initialStrength).toBe(2100);
    expect(updated?.notes).toBe('Held the ford.');
    expect(updated?.defaultSymbolStyle).toEqual({
      ...unit.defaultSymbolStyle,
      color: '#123456',
      thickness: 9,
    });
    expect(armyRosterSchema.safeParse(useRosterStore.getState().document).success).toBe(true);

    unwrap(useRosterStore.getState().updateUnit(unit.id, { notes: '   ', commander: '  ' }));
    const cleared = useRosterStore
      .getState()
      .document.units.find((candidate) => candidate.id === unit.id);
    expect(cleared?.notes).toBeUndefined();
    expect(cleared?.commander).toBeUndefined();

    useRosterStore.getState().undo();
    const withNotes = useRosterStore
      .getState()
      .document.units.find((candidate) => candidate.id === unit.id);
    expect(withNotes?.notes).toBe('Held the ford.');
    expect(withNotes?.commander).toBe('A. Test');

    useRosterStore.getState().undo();
    const restored = useRosterStore
      .getState()
      .document.units.find((candidate) => candidate.id === unit.id);
    expect(restored?.customName).toBe(unit.customName);
  });

  it('rejects deleting a formation that still has subordinates', () => {
    const before = useRosterStore.getState().document;
    const result = useRosterStore.getState().deleteUnit('unit-north-division');

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('subordinate');
    expect(useRosterStore.getState().document).toBe(before);
  });

  it('deletes leaf units and reports their generated name when blocked', () => {
    const leaf = unwrap(useRosterStore.getState().deleteUnit('unit-north-brigade-3'));
    expect(leaf).toEqual({ ok: true });
    expect(
      useRosterStore.getState().document.units.some((unit) => unit.id === 'unit-north-brigade-3'),
    ).toBe(false);

    const blocked = useRosterStore.getState().deleteUnit('unit-north-division');
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.error).toContain('Voss Division');
    expect(armyRosterSchema.safeParse(useRosterStore.getState().document).success).toBe(true);
  });

  it('blocks deleting factions that still own units', () => {
    const before = useRosterStore.getState().document;
    const result = useRosterStore.getState().deleteFaction('faction-north');

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('units belonging');
    expect(useRosterStore.getState().document).toBe(before);
  });

  it('renames the roster and resets history when a document loads', () => {
    unwrap(useRosterStore.getState().renameDocument('  New name  '));
    expect(useRosterStore.getState().document.name).toBe('New name');
    expect(useRosterStore.getState().past).toHaveLength(1);

    const replacement = createSeedRoster();
    replacement.name = 'Replacement';
    useRosterStore.getState().loadDocument(replacement);

    expect(useRosterStore.getState().document.name).toBe('Replacement');
    expect(useRosterStore.getState().document).not.toBe(replacement);
    expect(useRosterStore.getState().past).toHaveLength(0);
    expect(useRosterStore.getState().future).toHaveLength(0);
  });

  it('changes the smallest unit and enforces leaf formations', () => {
    const before = useRosterStore.getState().document;
    const blocked = useRosterStore.getState().setSmallestUnitEchelon('corps');
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.error).toContain('below Corps');
    expect(useRosterStore.getState().document).toBe(before);

    const changed = useRosterStore.getState().setSmallestUnitEchelon('regiment');
    expect(changed.ok).toBe(true);
    expect(useRosterStore.getState().document.smallestUnitEchelon).toBe('regiment');

    const regiment = unwrap(
      useRosterStore.getState().addUnit({
        factionId: 'faction-north',
        echelon: 'regiment',
        unitType: 'infantry',
        parentUnitId: 'unit-north-brigade-1',
      }),
    );
    const document = useRosterStore.getState().document;
    expect(findUnit(document, regiment.id)?.parentUnitId).toBe('unit-north-brigade-1');
    expect(findUnit(document, regiment.id)?.initialStrength).toBe(500);
  });

  it('rejects adding subordinates to a formation at the smallest echelon', () => {
    const before = useRosterStore.getState().document;
    const result = useRosterStore.getState().addUnit({
      factionId: 'faction-north',
      customName: 'Invalid Child',
      echelon: 'regiment',
      unitType: 'infantry',
      parentUnitId: 'unit-north-brigade-1',
      initialStrength: 500,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('smallest unit');
    expect(useRosterStore.getState().document).toBe(before);
  });

  it('rejects units at or above their parent echelon', () => {
    const before = useRosterStore.getState().document;

    const armyUnderCorps = useRosterStore.getState().addUnit({
      factionId: 'faction-north',
      echelon: 'army',
      unitType: 'other',
      parentUnitId: 'unit-north-corps',
    });
    expect(armyUnderCorps.ok).toBe(false);
    if (!armyUnderCorps.ok) expect(armyUnderCorps.error).toContain('cannot be placed under');

    const divisionUnderBrigade = useRosterStore.getState().addUnit({
      factionId: 'faction-north',
      echelon: 'division',
      unitType: 'infantry',
      parentUnitId: 'unit-north-brigade-1',
    });
    expect(divisionUnderBrigade.ok).toBe(false);
    if (!divisionUnderBrigade.ok) {
      expect(divisionUnderBrigade.error).toContain('cannot be placed under');
    }

    const promotedBrigade = useRosterStore.getState().updateUnit('unit-north-brigade-1', {
      echelon: 'division',
    });
    expect(promotedBrigade.ok).toBe(false);
    if (!promotedBrigade.ok) expect(promotedBrigade.error).toContain('cannot be placed under');

    const armyReparented = useRosterStore
      .getState()
      .reparentUnit('unit-north-army', 'unit-north-corps');
    expect(armyReparented.ok).toBe(false);
    if (!armyReparented.ok) expect(armyReparented.error).toContain('cycle');

    expect(useRosterStore.getState().document).toBe(before);
  });

  it('prevents a formation with subordinates from becoming a leaf echelon', () => {
    const before = useRosterStore.getState().document;
    const result = useRosterStore.getState().updateUnit('unit-north-division', {
      echelon: 'brigade',
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('has subordinates');
    expect(useRosterStore.getState().document).toBe(before);
  });

  it('normalizes rosters loaded without a smallest-unit setting', () => {
    const legacy = structuredClone(createSeedRoster()) as Record<string, unknown>;
    delete legacy.smallestUnitEchelon;

    useRosterStore.getState().loadDocument(legacy as ReturnType<typeof createSeedRoster>);

    expect(useRosterStore.getState().document.smallestUnitEchelon).toBe('brigade');
  });

  it('undoes and redoes roster mutations', () => {
    const added = unwrap(
      useRosterStore.getState().addFaction({ name: 'Third faction', color: '#123456' }),
    );

    useRosterStore.getState().undo();
    expect(
      useRosterStore.getState().document.factions.some((faction) => faction.id === added.id),
    ).toBe(false);

    useRosterStore.getState().redo();
    expect(
      useRosterStore.getState().document.factions.some((faction) => faction.id === added.id),
    ).toBe(true);
  });
});
