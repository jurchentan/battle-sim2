import { expect, test, type Page } from '@playwright/test';

const factionColors = {
  alpha: '#2f5d8a',
  beta: '#8a3f2f',
} as const;

function brigade(
  factionId: string,
  color: string,
  name: string,
  index: number,
  unitType: 'infantry' | 'cavalry' | 'artillery',
) {
  return {
    id: `unit-${factionId}-${index}`,
    factionId,
    customName: name,
    echelon: 'brigade',
    unitType,
    parentUnitId: null,
    commander: `Captain ${name} `,
    initialStrength: unitType === 'artillery' ? 600 : 1500,
    defaultSymbolStyle: {
      color,
      thickness: 5,
      dash: [],
      labelPosition: 'below',
    },
  };
}

const alphaNames = Array.from(
  { length: 11 },
  (_, index) => `Alpha Brigade ${String(index + 1).padStart(2, '0')}`,
);
const betaNames = Array.from(
  { length: 10 },
  (_, index) => `Beta Brigade ${String(index + 1).padStart(2, '0')}`,
);

function gateRoster() {
  const timestamp = new Date().toISOString();

  return {
    schemaVersion: 1,
    id: 'gate-roster-m5',
    name: 'Gate Roster',
    smallestUnitEchelon: 'brigade',
    factions: [
      {
        id: 'faction-alpha',
        name: 'Alpha League',
        color: factionColors.alpha,
      },
      {
        id: 'faction-beta',
        name: 'Beta Crown',
        color: factionColors.beta,
      },
    ],
    units: [
      ...alphaNames.map((name, index) =>
        brigade('faction-alpha', factionColors.alpha, name, index + 1, 'infantry'),
      ),
      ...betaNames.map((name, index) =>
        brigade(
          'faction-beta',
          factionColors.beta,
          name,
          index + 1,
          index === betaNames.length - 1 ? 'artillery' : 'cavalry',
        ),
      ),
    ],
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

async function importGateRoster(page: Page): Promise<void> {
  await page.getByRole('tab', { name: 'Army Roster Editor' }).click();
  await expect(page.getByRole('heading', { name: 'Army Roster Editor' })).toBeVisible();

  await page.getByTestId('army-import-input').setInputFiles({
    name: 'gate-roster.army.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(gateRoster())),
  });

  await expect(page.getByTestId('current-roster-name')).toHaveText('Gate Roster');
  await expect(page.getByTestId('roster-summary')).toContainText('2 factions · 21 units');
  await expect(page.getByTestId('roster-save-status')).toHaveText('Saved', { timeout: 5_000 });
}

async function createGateScenario(page: Page): Promise<void> {
  await page.getByRole('tab', { name: 'Scenario Editor' }).click();
  await expect(page.getByRole('heading', { name: 'Scenario Editor' })).toBeVisible();
  await expect(page.getByTestId('scenario-name')).not.toHaveText('');

  await page.getByRole('button', { name: 'New scenario' }).click();
  const dialog = page.getByTestId('new-scenario-dialog');
  await expect(dialog).toBeVisible();

  await expect(dialog.getByTestId('new-scenario-source-summary')).toContainText('21 formations');
  await dialog.getByLabel('Scenario name').fill('Gate Scenario');
  await dialog.getByLabel('Description').fill('Deployment gate for M5.');
  await dialog.getByRole('button', { name: 'Create scenario' }).click();

  await expect(dialog).not.toBeVisible();
  await expect(page.getByTestId('scenario-name')).toHaveText('Gate Scenario');
  await expect(page.getByTestId('scenario-oob')).toContainText('0 of 21 formations deployed');
}

test('deploys 20 brigades, edits formations, filters factions, and isolates source snapshots', async ({
  page,
}) => {
  await page.goto('/');
  await importGateRoster(page);
  await createGateScenario(page);

  const canvas = page.getByTestId('scenario-canvas');
  await expect(canvas).toBeVisible();
  await expect(canvas).toHaveAttribute('data-deployed-count', '0');
  await expect(canvas).toHaveAttribute('data-terrain-features', '9');
  const box = await canvas.boundingBox();
  if (!box) throw new Error('Scenario canvas has no bounding box');

  const names = [...alphaNames, ...betaNames];
  const gridPoint = (index: number) => ({
    x: box.x + 110 + (index % 5) * 72,
    y: box.y + 90 + Math.floor(index / 5) * 72,
  });
  let lastPoint = gridPoint(0);

  for (let index = 0; index < 20; index += 1) {
    const name = names[index];
    if (!name) throw new Error(`Missing formation name at index ${index}`);
    await page.getByRole('button', { name: `Deploy ${name}`, exact: true }).click();
    await expect(canvas).toHaveAttribute('data-placement', 'true');

    lastPoint = gridPoint(index);
    await page.mouse.click(lastPoint.x, lastPoint.y);
    await expect(canvas).toHaveAttribute('data-deployed-count', String(index + 1));
  }

  await expect(canvas).toHaveAttribute('data-placement', 'false');
  await expect(canvas).toHaveAttribute('data-visible-formations', '20');
  await expect(canvas).toHaveAttribute('data-rectangle-formations', '20');
  await expect(canvas).toHaveAttribute('data-text-formations', '0');
  await expect(canvas).toHaveAttribute('data-terrain-features', '9');
  await expect(page.getByTestId('scenario-summary')).toContainText('20 deployed');
  await expect(page.getByTestId('scenario-oob')).toContainText('20 of 21 formations deployed');

  // The last placed formation stays selected. Rotate it with the transformer
  // handle before dragging from its center.
  await expect(page.getByTestId('selected-unit-name')).toHaveText('Beta Brigade 09');
  await expect(canvas).toHaveAttribute('data-selected-kind', 'rectangle');
  const formationsScale = Math.min((box.width - 96) / 2000, (box.height - 96) / 1400);
  const rotateHandle = {
    x: lastPoint.x,
    y: lastPoint.y - (6 * formationsScale) / 2 - 32,
  };
  await page.mouse.move(rotateHandle.x, rotateHandle.y);
  await page.mouse.down();
  await page.mouse.move(rotateHandle.x + 60, rotateHandle.y + 6, { steps: 6 });
  await page.mouse.up();
  await expect(page.getByTestId('selected-unit-rotation')).not.toHaveText('0°');

  const positionBeforeDrag = await page.getByTestId('selected-unit-position').textContent();
  await page.mouse.move(lastPoint.x, lastPoint.y);
  await page.mouse.down();
  await page.mouse.move(lastPoint.x + 44, lastPoint.y + 26, { steps: 5 });
  await page.mouse.up();
  await expect(page.getByTestId('selected-unit-position')).not.toHaveText(positionBeforeDrag ?? '');

  const frontage = page.getByLabel('Frontage length');
  await frontage.fill('180');
  await frontage.press('Enter');
  await expect(page.getByTestId('selected-unit-frontage')).toHaveText('180 units');

  const rotation = page.getByLabel('Rotation');
  await rotation.fill('25');
  await rotation.press('Enter');
  await expect(page.getByTestId('selected-unit-rotation')).toHaveText('25°');
  await expect(canvas).toHaveAttribute('data-selected-label-flipped', 'false');

  await rotation.fill('180');
  await rotation.press('Enter');
  await expect(canvas).toHaveAttribute('data-selected-label-flipped', 'true');
  await rotation.fill('270');
  await rotation.press('Enter');
  await expect(canvas).toHaveAttribute('data-selected-label-flipped', 'false');
  await rotation.fill('25');
  await rotation.press('Enter');
  await expect(page.getByTestId('selected-unit-rotation')).toHaveText('25°');

  const label = page.getByLabel('Label override');
  await label.fill('Gate Vanguard');
  await label.press('Enter');
  await expect(page.getByTestId('selected-unit-label')).toHaveText('Gate Vanguard');

  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page.getByTestId('selected-unit-label')).toHaveText('Beta Brigade 09');
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await expect(page.getByTestId('selected-unit-label')).toHaveText('Gate Vanguard');

  // Inspector removal is immediate and undoable; no confirmation step remains.
  await page.getByTestId('remove-unit-from-map').click();
  await expect(canvas).toHaveAttribute('data-deployed-count', '19');
  await expect(canvas).toHaveAttribute('data-visible-formations', '19');
  await expect(page.getByRole('button', { name: 'Place on map', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(canvas).toHaveAttribute('data-deployed-count', '20');
  await expect(canvas).toHaveAttribute('data-visible-formations', '20');
  await expect(page.getByTestId('remove-unit-from-map')).toBeVisible();

  // The order of battle swaps Deploy for a direct Remove action.
  const oobRemove = page.getByRole('button', {
    name: 'Remove Alpha Brigade 01 from map',
    exact: true,
  });
  await expect(oobRemove).toBeVisible();
  await oobRemove.click();
  await expect(canvas).toHaveAttribute('data-deployed-count', '19');
  await expect(canvas).toHaveAttribute('data-visible-formations', '19');
  await expect(
    page.getByRole('button', { name: 'Deploy Alpha Brigade 01', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(canvas).toHaveAttribute('data-deployed-count', '20');
  await expect(
    page.getByRole('button', { name: 'Remove Alpha Brigade 01 from map', exact: true }),
  ).toBeVisible();

  // Faction visibility only filters the view; the deployment stays intact.
  const alphaToggle = page.getByRole('checkbox', { name: 'Show faction Alpha League' });
  const betaToggle = page.getByRole('checkbox', { name: 'Show faction Beta Crown' });

  await alphaToggle.uncheck();
  await expect(canvas).toHaveAttribute('data-visible-formations', '9');
  await betaToggle.uncheck();
  await expect(canvas).toHaveAttribute('data-visible-formations', '0');
  await expect(canvas).toHaveAttribute('data-deployed-count', '20');

  await betaToggle.check();
  await expect(canvas).toHaveAttribute('data-visible-formations', '9');
  await alphaToggle.check();
  await expect(canvas).toHaveAttribute('data-visible-formations', '20');

  // Terrain and unit modes stay separate.
  await page.getByRole('button', { name: 'Terrain mode', exact: true }).click();
  await expect(canvas).toHaveAttribute('data-mode', 'terrain');
  await expect(page.getByTestId('scenario-terrain-panel')).toBeVisible();
  await expect(page.getByTestId('scenario-oob')).not.toBeVisible();

  const scenarioMapScale = Math.min((box.width - 96) / 2000, (box.height - 96) / 1400);
  const scenarioMapOffsetX = (box.width - 2000 * scenarioMapScale) / 2;
  const scenarioMapOffsetY = (box.height - 1400 * scenarioMapScale) / 2;
  await page.mouse.click(
    box.x + scenarioMapOffsetX + 400 * scenarioMapScale,
    box.y + scenarioMapOffsetY + 320 * scenarioMapScale,
  );
  await expect(page.getByTestId('selected-terrain-kind')).toHaveText('Forest');

  await page.getByRole('button', { name: 'Units mode', exact: true }).click();
  await expect(canvas).toHaveAttribute('data-mode', 'units');
  await expect(page.getByTestId('scenario-oob')).toBeVisible();
  await expect(canvas).toHaveAttribute('data-deployed-count', '20');
  await expect(canvas).toHaveAttribute('data-terrain-features', '9');

  // Editing the terrain library source must not mutate the scenario snapshot.
  await page.getByRole('tab', { name: 'Terrain Editor' }).click();
  await expect(page.getByTestId('feature-count-total')).toHaveText('9 features');
  await page.getByRole('button', { name: 'Building tool' }).click();

  const terrainCanvas = page.getByTestId('terrain-canvas');
  const terrainBox = await terrainCanvas.boundingBox();
  if (!terrainBox) throw new Error('Terrain canvas has no bounding box');
  const scale = Math.min((terrainBox.width - 96) / 2000, (terrainBox.height - 96) / 1400);
  const offsetX = (terrainBox.width - 2000 * scale) / 2;
  const offsetY = (terrainBox.height - 1400 * scale) / 2;
  await page.mouse.click(
    terrainBox.x + offsetX + 1720 * scale,
    terrainBox.y + offsetY + 1120 * scale,
  );
  await expect(page.getByTestId('feature-count-total')).toHaveText('10 features');

  await page.getByRole('tab', { name: 'Scenario Editor' }).click();
  await expect(page.getByTestId('scenario-name')).toHaveText('Gate Scenario');
  await expect(page.getByTestId('scenario-canvas')).toHaveAttribute('data-terrain-features', '9');
  await expect(page.getByTestId('scenario-canvas')).toHaveAttribute('data-deployed-count', '20');
  await expect(page.getByTestId('scenario-oob')).toContainText('20 of 21 formations deployed');
});

test('renders higher echelons as text and applies display settings', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('tab', { name: 'Scenario Editor' }).click();
  await expect(page.getByRole('heading', { name: 'Scenario Editor' })).toBeVisible();

  const canvas = page.getByTestId('scenario-canvas');
  await expect(canvas).toBeVisible();
  await expect(canvas).toHaveAttribute('data-visible-formations', '6');
  await expect(canvas).toHaveAttribute('data-rectangle-formations', '6');
  await expect(canvas).toHaveAttribute('data-text-formations', '0');

  const box = await canvas.boundingBox();
  if (!box) throw new Error('Scenario canvas has no bounding box');

  // A corps is above the roster's smallest echelon, so it renders as text.
  await page.getByRole('button', { name: 'Deploy I Corps', exact: true }).click();
  await expect(canvas).toHaveAttribute('data-placement', 'true');
  const corpsPoint = { x: box.x + 300, y: box.y + 220 };
  await page.mouse.click(corpsPoint.x, corpsPoint.y);

  // Deploying a parent also places its undeployed subordinates in front.
  await expect(canvas).toHaveAttribute('data-visible-formations', '8');
  await expect(canvas).toHaveAttribute('data-rectangle-formations', '6');
  await expect(canvas).toHaveAttribute('data-text-formations', '2');
  await expect(canvas).toHaveAttribute('data-selected-kind', 'text');
  await expect(page.getByTestId('selected-unit-name')).toHaveText('I Corps');
  await expect(
    page.getByRole('button', { name: 'Remove Voss Division from map', exact: true }),
  ).toBeVisible();

  const corpsPosition = await page.getByTestId('selected-unit-position').textContent();
  await page.mouse.move(corpsPoint.x, corpsPoint.y);
  await page.mouse.down();
  await page.mouse.move(corpsPoint.x + 48, corpsPoint.y + 18, { steps: 5 });
  await page.mouse.up();
  await expect(page.getByTestId('selected-unit-position')).not.toHaveText(corpsPosition ?? '');

  await page.getByRole('button', { name: 'Select unit Voss Division', exact: true }).click();
  await expect(canvas).toHaveAttribute('data-selected-kind', 'text');
  await expect(page.getByTestId('selected-unit-name')).toHaveText('Voss Division');

  // Display preferences customize the text formations.
  await page.getByRole('button', { name: 'Display', exact: true }).click();
  await expect(page.getByTestId('scenario-display-settings')).toBeVisible();
  await expect(canvas).toHaveAttribute('data-uppercase-labels', 'false');

  const initialLabelFormats = JSON.parse(
    (await canvas.getAttribute('data-formation-label-formats')) ?? '{}',
  );
  expect(initialLabelFormats).toEqual({
    army: 'full',
    corps: 'full',
    division: 'full',
    brigade: 'shortened',
    regiment: 'shortened',
    other: 'shortened',
  });

  // Voss Division is selected; its map label follows the division name style
  // while the inspector keeps showing the complete roster name.
  const divisionName = page.getByLabel('Division name');
  await divisionName.selectOption('shortened');
  await expect(canvas).toHaveAttribute('data-selected-map-label', 'Voss');
  await divisionName.selectOption('commander');
  await expect(canvas).toHaveAttribute('data-selected-map-label', 'Kerr');
  await divisionName.selectOption('none');
  await expect(canvas).toHaveAttribute('data-selected-map-label', '');
  await expect(page.getByTestId('selected-unit-name')).toHaveText('Voss Division');
  await divisionName.selectOption('full');
  await expect(canvas).toHaveAttribute('data-selected-map-label', 'Voss Division');

  await page.getByLabel('Uppercase formation labels').check();
  await expect(canvas).toHaveAttribute('data-uppercase-labels', 'true');

  const armyFontSize = page.getByLabel('Army font size');
  await armyFontSize.fill('92');
  await armyFontSize.press('Enter');
  const fontSizes = JSON.parse((await canvas.getAttribute('data-formation-font-sizes')) ?? '{}');
  expect(fontSizes).toMatchObject({ army: 92, corps: 56, division: 40, brigade: 28 });

  const flippedRotation = page.getByLabel('Rotation');
  await flippedRotation.fill('180');
  await flippedRotation.press('Enter');
  await expect(canvas).toHaveAttribute('data-selected-label-flipped', 'true');
  await flippedRotation.fill('90');
  await flippedRotation.press('Enter');
  await expect(canvas).toHaveAttribute('data-selected-label-flipped', 'false');
  await flippedRotation.fill('0');
  await flippedRotation.press('Enter');
  await expect(canvas).toHaveAttribute('data-selected-label-flipped', 'false');

  await page.getByRole('button', { name: 'Reset display', exact: true }).click();
  await expect(canvas).toHaveAttribute('data-uppercase-labels', 'false');
  await expect(canvas).toHaveAttribute('data-selected-map-label', 'Voss Division');
  const resetFontSizes = JSON.parse(
    (await canvas.getAttribute('data-formation-font-sizes')) ?? '{}',
  );
  expect(resetFontSizes).toMatchObject({ army: 76, corps: 56, division: 40, brigade: 28 });
  const resetLabelFormats = JSON.parse(
    (await canvas.getAttribute('data-formation-label-formats')) ?? '{}',
  );
  expect(resetLabelFormats).toEqual(initialLabelFormats);
});

test('selects and drags a rectangle formation by its map label even when names are hidden', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('tab', { name: 'Scenario Editor' }).click();
  await expect(page.getByRole('heading', { name: 'Scenario Editor' })).toBeVisible();

  const canvas = page.getByTestId('scenario-canvas');
  let box = await canvas.boundingBox();
  if (!box) throw new Error('Scenario canvas has no bounding box');

  const screenPoint = (worldX: number, worldY: number) => {
    if (!box) throw new Error('Scenario canvas has no bounding box');
    const scale = Math.min((box.width - 96) / 2000, (box.height - 96) / 1400);
    const offsetX = (box.width - 2000 * scale) / 2;
    const offsetY = (box.height - 1400 * scale) / 2;
    return {
      x: box.x + offsetX + worldX * scale,
      y: box.y + offsetY + worldY * scale,
    };
  };

  // Seed brigade 1 sits at world 700, 520 with its label above the rectangle.
  // Clicking the label (not the rectangle) selects the formation.
  const labelAboveUnits = 8 + (28 * 1.3) / 2 + 7 / 2;
  const labelPoint = screenPoint(700, 520 - labelAboveUnits);
  await page.mouse.click(labelPoint.x, labelPoint.y);
  await expect(canvas).toHaveAttribute('data-selected-kind', 'rectangle');
  await expect(page.getByTestId('selected-unit-name')).toHaveText('1st Brigade');

  const positionBeforeDrag = await page.getByTestId('selected-unit-position').textContent();
  await page.mouse.move(labelPoint.x, labelPoint.y);
  await page.mouse.down();
  await page.mouse.move(labelPoint.x - 48, labelPoint.y + 36, { steps: 5 });
  await page.mouse.up();
  await expect(page.getByTestId('selected-unit-position')).not.toHaveText(positionBeforeDrag ?? '');

  const rotation = page.getByLabel('Rotation');
  await rotation.fill('180');
  await rotation.press('Enter');
  await expect(canvas).toHaveAttribute('data-selected-label-flipped', 'true');
  await rotation.fill('0');
  await rotation.press('Enter');
  await expect(canvas).toHaveAttribute('data-selected-label-flipped', 'false');

  await page.getByRole('button', { name: 'Display', exact: true }).click();
  const brigadeName = page.getByLabel('Brigade name');
  await brigadeName.selectOption('shortened');
  await expect(canvas).toHaveAttribute('data-selected-map-label', '1st');
  await brigadeName.selectOption('commander');
  await expect(canvas).toHaveAttribute('data-selected-map-label', 'Hale');
  await brigadeName.selectOption('none');
  await expect(canvas).toHaveAttribute('data-selected-map-label', '');
  await expect(page.getByTestId('selected-unit-name')).toHaveText('1st Brigade');

  // Dynamic frontage scales the rendered rectangle from a 3,000-strong baseline
  // without changing the stored frontage used by the inspector.
  const dynamicFrontage = page.getByLabel('Dynamic frontage by unit size');
  await dynamicFrontage.check();
  await expect(canvas).toHaveAttribute('data-dynamic-frontage', 'true');
  await expect(canvas).toHaveAttribute('data-selected-rendered-frontage', '72');
  await expect(page.getByTestId('selected-unit-frontage')).toHaveText('120 units');
  await dynamicFrontage.uncheck();
  await expect(canvas).toHaveAttribute('data-dynamic-frontage', 'false');
  await expect(canvas).toHaveAttribute('data-selected-rendered-frontage', '120');

  const positionText = await page.getByTestId('selected-unit-position').textContent();
  const [unitX, unitY] = (positionText ?? '').split(',').map((value) => Number(value.trim()));
  if (unitX === undefined || unitY === undefined || Number.isNaN(unitX + unitY)) {
    throw new Error('Could not parse the selected formation position');
  }

  // Closing the Display panel restores the canvas geometry used for map clicks.
  await page.getByRole('button', { name: 'Display', exact: true }).click();
  box = await canvas.boundingBox();
  if (!box) throw new Error('Scenario canvas has no bounding box after closing Display');

  // With names hidden, the invisible label area still selects the formation.
  const emptyPoint = screenPoint(100, 100);
  await page.mouse.click(emptyPoint.x, emptyPoint.y);
  await expect(canvas).toHaveAttribute('data-selected-kind', 'none');
  const hiddenLabelPoint = screenPoint(unitX, unitY - labelAboveUnits);
  await page.mouse.click(hiddenLabelPoint.x, hiddenLabelPoint.y);
  await expect(canvas).toHaveAttribute('data-selected-kind', 'rectangle');
  await expect(page.getByTestId('selected-unit-name')).toHaveText('1st Brigade');
});
