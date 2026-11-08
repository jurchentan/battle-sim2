import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';

interface UnitSeed {
  customName: string;
  faction: string;
  echelon: 'army' | 'corps' | 'division' | 'brigade';
  type: 'infantry' | 'cavalry' | 'artillery' | 'other';
  parent?: string;
  commander?: string;
  strength?: number;
}

async function openArmyWorkspace(page: Page): Promise<void> {
  await page.getByRole('tab', { name: 'Army Roster Editor' }).click();
  await expect(page.getByRole('heading', { name: 'Army Roster Editor' })).toBeVisible();
}

async function addFaction(page: Page, name: string): Promise<void> {
  await page.getByRole('button', { name: 'Add faction' }).click();
  await page.getByLabel('Faction name').fill(name);
  await page.getByRole('button', { name: 'Create faction' }).click();
  await expect(page.getByTestId('faction-manager').getByText(name, { exact: true })).toBeVisible();
}

async function addUnit(page: Page, unit: UnitSeed): Promise<void> {
  await page.getByRole('button', { name: 'Add unit' }).click();
  await expect(page.getByTestId('unit-create-form')).toBeVisible();
  const form = page.getByTestId('unit-create-form');
  await form.getByLabel('Custom name').fill(unit.customName);
  if (unit.commander) {
    await form.getByLabel('Commander').fill(unit.commander);
  }
  await form.getByRole('combobox', { name: 'Faction', exact: true }).selectOption({
    label: unit.faction,
  });
  await form.getByRole('combobox', { name: 'Unit type', exact: true }).selectOption(unit.type);
  if (unit.parent) {
    await form.getByRole('combobox', { name: /^Parent formation/ }).selectOption({
      label: unit.parent,
    });
  }
  await form.getByRole('combobox', { name: 'Echelon', exact: true }).selectOption(unit.echelon);
  if (unit.strength !== undefined) {
    await form.getByLabel('Initial strength').fill(String(unit.strength));
  }
  await page.getByRole('button', { name: 'Create unit' }).click();
  await expect(page.getByTestId('unit-editor')).toBeVisible();
  await expect(page.getByTestId('unit-editor')).toContainText(unit.customName);
}

async function buildSide(page: Page, faction: string, names: readonly string[]): Promise<void> {
  const [army, corps, division, brigadeOne, brigadeTwo, brigadeThree] = names;
  if (!army || !corps || !division || !brigadeOne || !brigadeTwo || !brigadeThree) {
    throw new Error('Each side needs six unit names');
  }

  await addUnit(page, {
    customName: army,
    faction,
    echelon: 'army',
    type: 'other',
    strength: 12000,
  });
  await addUnit(page, {
    customName: corps,
    faction,
    echelon: 'corps',
    type: 'other',
    parent: `Army · ${army}`,
    strength: 9000,
  });
  await addUnit(page, {
    customName: division,
    faction,
    echelon: 'division',
    type: 'other',
    parent: `Corps · ${corps}`,
    strength: 6000,
  });
  await addUnit(page, {
    customName: brigadeOne,
    faction,
    echelon: 'brigade',
    type: 'infantry',
    parent: `Division · ${division}`,
    strength: 1800,
  });
  await addUnit(page, {
    customName: brigadeTwo,
    faction,
    echelon: 'brigade',
    type: 'cavalry',
    parent: `Division · ${division}`,
    strength: 1500,
  });
  await addUnit(page, {
    customName: brigadeThree,
    faction,
    echelon: 'brigade',
    type: 'artillery',
    parent: `Division · ${division}`,
    strength: 900,
  });
}

test('creates two armies with the default hierarchy and reopens them after reload', async ({
  page,
}) => {
  await page.goto('/');
  await openArmyWorkspace(page);
  await expect(page.getByTestId('current-roster-name')).toHaveText('Ashford Campaign Rosters');

  await page.getByRole('button', { name: 'New', exact: true }).click();
  const dialog = page.getByTestId('new-army-roster-dialog');
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('Roster name').fill('Gate Roster');
  await dialog.getByRole('button', { name: 'Create roster' }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByTestId('current-roster-name')).toHaveText('Gate Roster');

  await addFaction(page, 'Northern League');
  await addFaction(page, 'Southern Crown');

  await buildSide(page, 'Northern League', [
    'Army of the North',
    'I Corps',
    'Voss Division',
    '1st North Brigade',
    '2nd North Brigade',
    '3rd North Brigade',
  ]);
  await buildSide(page, 'Southern Crown', [
    'Crown Army',
    'II Corps',
    'Riel Division',
    '4th Crown Brigade',
    '5th Crown Brigade',
    '6th Crown Brigade',
  ]);

  await expect(page.getByTestId('roster-summary')).toContainText('2 factions · 12 units');

  const brigade = page.getByRole('button', { name: 'Select unit 1st North Brigade' });
  await brigade.click();
  await page.getByLabel('Initial strength').fill('1750');
  await page.getByLabel('Initial strength').blur();
  await expect(page.getByTestId('roster-save-status')).toHaveText('Saved', { timeout: 5_000 });

  await page.reload();
  await openArmyWorkspace(page);
  await expect(page.getByTestId('current-roster-name')).toHaveText('Gate Roster');
  await expect(page.getByTestId('roster-summary')).toContainText('2 factions · 12 units');

  await page.getByRole('button', { name: 'Select unit 1st North Brigade' }).click();
  await expect(page.getByLabel('Initial strength')).toHaveValue('1750');
});

test('rejects a cyclic army import without replacing the active roster', async ({ page }) => {
  await page.goto('/');
  await openArmyWorkspace(page);
  await expect(page.getByTestId('current-roster-name')).toHaveText('Ashford Campaign Rosters');
  await expect(page.getByTestId('roster-summary')).toContainText('2 factions · 12 units');

  const timestamp = new Date().toISOString();
  const cyclicRoster = {
    schemaVersion: 1,
    id: 'cyclic-roster',
    name: 'Cyclic Roster',
    factions: [{ id: 'faction-cycle', name: 'Cycle Faction', color: '#123456' }],
    commanders: [],
    units: [
      {
        id: 'unit-cycle-a',
        factionId: 'faction-cycle',
        name: 'Cycle A',
        echelon: 'army',
        unitType: 'other',
        parentUnitId: 'unit-cycle-b',
        commanderId: null,
        initialStrength: null,
        defaultSymbolStyle: {
          color: '#123456',
          thickness: 4,
          dash: [],
          labelPosition: 'center',
        },
      },
      {
        id: 'unit-cycle-b',
        factionId: 'faction-cycle',
        name: 'Cycle B',
        echelon: 'corps',
        unitType: 'other',
        parentUnitId: 'unit-cycle-a',
        commanderId: null,
        initialStrength: null,
        defaultSymbolStyle: {
          color: '#123456',
          thickness: 4,
          dash: [],
          labelPosition: 'center',
        },
      },
    ],
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  await page.getByTestId('army-import-input').setInputFiles({
    name: 'cyclic.army.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(cyclicRoster)),
  });

  await expect(page.getByRole('alert')).toContainText('Cycle detected in unit hierarchy');
  await expect(page.getByTestId('current-roster-name')).toHaveText('Ashford Campaign Rosters');
  await expect(page.getByTestId('roster-summary')).toContainText('2 factions · 12 units');
});

test('exports and reimports an army roster with equivalent data', async ({ page }) => {
  await page.goto('/');
  await openArmyWorkspace(page);

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  const download = await downloadPromise;
  const path = await download.path();
  if (!path) throw new Error('Export did not produce a file');

  const original = JSON.parse(await readFile(path, 'utf8')) as {
    id: string;
    name: string;
    factions: unknown;
    units: unknown;
  };
  expect(original.name).toBe('Ashford Campaign Rosters');
  expect(original.units).toHaveLength(12);

  await page.getByRole('button', { name: 'New', exact: true }).click();
  const dialog = page.getByTestId('new-army-roster-dialog');
  await dialog.getByLabel('Roster name').fill('Import Target');
  await dialog.getByRole('button', { name: 'Create roster' }).click();
  await expect(page.getByTestId('current-roster-name')).toHaveText('Import Target');
  await expect(page.getByTestId('roster-summary')).toContainText('0 factions · 0 units');

  await page.getByTestId('army-import-input').setInputFiles(path);
  await expect(page.getByTestId('current-roster-name')).toHaveText('Ashford Campaign Rosters');
  await expect(page.getByTestId('roster-summary')).toContainText('2 factions · 12 units');
  await expect(page.getByTestId('roster-save-status')).toHaveText('Saved');

  const reimportPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  const reimportDownload = await reimportPromise;
  const reimportPath = await reimportDownload.path();
  if (!reimportPath) throw new Error('Reimport export did not produce a file');

  const reimported = JSON.parse(await readFile(reimportPath, 'utf8')) as {
    id: string;
    name: string;
    factions: unknown;
    units: unknown;
  };

  expect(reimported.id).not.toBe(original.id);
  expect(reimported.name).toBe(original.name);
  expect(reimported.factions).toEqual(original.factions);
  expect(reimported.units).toEqual(original.units);
});

test('renames, duplicates, and deletes rosters in the army library', async ({ page }) => {
  await page.goto('/');
  await openArmyWorkspace(page);

  await page.getByRole('button', { name: 'Open army roster library' }).click();
  const library = page.getByTestId('army-library');
  await expect(library).toBeVisible();

  await library.getByRole('button', { name: 'Duplicate roster Ashford Campaign Rosters' }).click();
  await expect(page.getByTestId('current-roster-name')).toHaveText('Ashford Campaign Rosters copy');

  await library
    .getByRole('button', { name: 'Rename roster Ashford Campaign Rosters copy' })
    .click();
  const renameInput = library.getByLabel('Rename roster Ashford Campaign Rosters copy');
  await renameInput.fill('Campaign Draft');
  await renameInput.press('Enter');
  await expect(library.getByText('Campaign Draft', { exact: true })).toBeVisible();

  await library.getByRole('button', { name: 'Delete roster Campaign Draft' }).click();
  await library.getByRole('button', { name: 'Confirm delete' }).click();
  await expect(
    library.getByRole('button', { name: 'Delete roster Campaign Draft' }),
  ).not.toBeVisible();
  await expect(library.getByText('Ashford Campaign Rosters', { exact: true })).toBeVisible();

  await library.getByRole('button', { name: 'Close army roster library' }).click();
  await expect(page.getByTestId('current-roster-name')).toHaveText('Ashford Campaign Rosters');
});
