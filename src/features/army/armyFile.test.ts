import { describe, expect, it } from 'vitest';
import { armyRosterSchema, createSeedRoster } from '../../models';
import { armyFileName, migrateArmyDocument, parseArmyFile, serializeArmyFile } from './armyFile';

describe('army file format', () => {
  it('round-trips an army roster with equivalent semantic data', () => {
    const source = createSeedRoster();
    const result = parseArmyFile(serializeArmyFile(source));

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.document).toEqual(source);
    expect(result.document.units).toHaveLength(source.units.length);
    expect(armyRosterSchema.safeParse(result.document).success).toBe(true);
  });

  it('rejects malformed JSON and non-object payloads', () => {
    expect(parseArmyFile('{not json')).toMatchObject({
      ok: false,
      error: 'The army file is not valid JSON.',
    });
    expect(parseArmyFile('[]')).toMatchObject({
      ok: false,
      error: 'The army file must contain a JSON object.',
    });
    expect(parseArmyFile('{"name":"missing version"}')).toMatchObject({
      ok: false,
      error: 'The army file is missing a valid schemaVersion.',
    });
  });

  it('rejects schema versions newer than the app supports', () => {
    const future = { ...createSeedRoster(), schemaVersion: 99 };
    const result = parseArmyFile(JSON.stringify(future));

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('newer than this app supports');
    }
  });

  it('infers the smallest unit when importing files written before the setting', () => {
    const legacy = structuredClone(createSeedRoster()) as Record<string, unknown>;
    delete legacy.smallestUnitEchelon;

    const result = parseArmyFile(JSON.stringify(legacy));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.document.smallestUnitEchelon).toBe('brigade');
  });

  it('normalizes legacy unit names and commander records on import', () => {
    const legacy = JSON.parse(JSON.stringify(createSeedRoster())) as Record<string, unknown>;
    legacy.commanders = [{ id: 'commander-legacy', name: 'Legacy Commander' }];

    const units = legacy.units as Record<string, unknown>[];
    const first = units[0]!;
    first.name = 'Legacy Army';
    delete first.customName;
    first.commanderId = 'commander-legacy';
    delete first.commander;

    const result = parseArmyFile(JSON.stringify(legacy));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.document.units[0]?.customName).toBe('Legacy Army');
    expect(result.document.units[0]?.commander).toBe('Legacy Commander');
    expect('commanders' in result.document).toBe(false);
  });

  it('rejects hierarchy cycles without throwing', () => {
    const cyclic = createSeedRoster();
    const army = cyclic.units.find((unit) => unit.id === 'unit-north-army');
    if (!army) throw new Error('Missing seeded army');
    army.parentUnitId = 'unit-north-brigade-1';

    const result = parseArmyFile(JSON.stringify(cyclic));

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('failed schema validation');
      expect(result.issues?.join(' ')).toContain('Cycle detected');
    }
  });

  it('runs registered migration hooks in version order', () => {
    const result = migrateArmyDocument({ schemaVersion: 0, name: 'Legacy' }, 0, {
      0: (document) => ({
        ...document,
        schemaVersion: 1,
        migrated: true,
      }),
    });

    expect(result).toEqual({
      ok: true,
      document: { schemaVersion: 1, name: 'Legacy', migrated: true },
    });
  });

  it('reports missing or incorrect migration hooks', () => {
    expect(migrateArmyDocument({ schemaVersion: 0 }, 0, {})).toMatchObject({
      ok: false,
      error: 'No migration is available from army schema version 0.',
    });

    expect(
      migrateArmyDocument({ schemaVersion: 0 }, 0, {
        0: (document) => document,
      }),
    ).toMatchObject({
      ok: false,
      error: 'The migration from army schema version 0 must set schemaVersion to 1.',
    });
  });

  it('builds safe portable filenames', () => {
    expect(armyFileName({ name: 'Ashford Campaign Rosters' })).toBe(
      'ashford-campaign-rosters.army.json',
    );
    expect(armyFileName({ name: '  ***  ' })).toBe('army-roster.army.json');
  });
});
