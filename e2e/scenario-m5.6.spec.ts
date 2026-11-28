import { expect, test, type Page } from '@playwright/test';

interface SelectedState {
  x: number;
  y: number;
  rotationDegrees: number;
  frontageLength: number;
}

function mapPoint(
  box: { x: number; y: number; width: number; height: number },
  worldX: number,
  worldY: number,
) {
  const scale = Math.min((box.width - 96) / 2000, (box.height - 96) / 1400);
  const offsetX = (box.width - 2000 * scale) / 2;
  const offsetY = (box.height - 1400 * scale) / 2;
  return {
    x: box.x + offsetX + worldX * scale,
    y: box.y + offsetY + worldY * scale,
  };
}

async function dragLine(
  page: Page,
  start: { x: number; y: number },
  end: { x: number; y: number },
): Promise<void> {
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(end.x, end.y, { steps: 12 });
  await page.mouse.up();
}

async function selectedStates(page: Page): Promise<Record<string, SelectedState>> {
  const canvas = page.getByTestId('scenario-canvas');
  return JSON.parse((await canvas.getAttribute('data-selected-states')) ?? '{}');
}

test('draws a division battle line, recentres command labels, and flips in place', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('tab', { name: 'Scenario Editor' }).click();
  await expect(page.getByRole('heading', { name: 'Scenario Editor' })).toBeVisible();

  const canvas = page.getByTestId('scenario-canvas');
  const box = await canvas.boundingBox();
  if (!box) throw new Error('Scenario canvas has no bounding box');

  // Deploying I Corps also deploys Voss Division, so the command labels have
  // something to recentre. The brigades themselves are already on the map.
  await page.getByRole('button', { name: 'Deploy I Corps', exact: true }).click();
  await page.mouse.click(mapPoint(box, 400, 300).x, mapPoint(box, 400, 300).y);
  await expect(canvas).toHaveAttribute('data-deployed-count', '8');
  const beforeLine = await selectedStates(page);
  const divisionBefore = beforeLine['unit-north-division'];
  const corpsBefore = beforeLine['unit-north-corps'];
  if (!divisionBefore || !corpsBefore) {
    throw new Error('The command deployment did not select its formations');
  }

  await page.getByRole('button', { name: 'Select unit Voss Division', exact: true }).click();
  await expect(canvas).toHaveAttribute('data-battle-line-brigade-count', '3');
  await expect(page.getByTestId('battle-line-draw')).toBeEnabled();

  await page.getByTestId('battle-line-draw').click();
  await expect(canvas).toHaveAttribute('data-battle-line-active', 'true');
  await expect(page.getByTestId('battle-line-draw')).toHaveText('Cancel battle line');

  await dragLine(page, mapPoint(box, 300, 900), mapPoint(box, 1300, 900));

  await expect(canvas).toHaveAttribute('data-battle-line-active', 'false');
  await expect(canvas).toHaveAttribute('data-last-battle-line-count', '5');
  await expect(canvas).toHaveAttribute('data-selected-count', '5');
  await expect(canvas).toHaveAttribute('data-terrain-features', '9');

  const states = await selectedStates(page);
  const first = states['unit-north-brigade-1'];
  const second = states['unit-north-brigade-2'];
  const third = states['unit-north-brigade-3'];
  const division = states['unit-north-division'];
  const corps = states['unit-north-corps'];
  if (!first || !second || !third || !division || !corps) {
    throw new Error('The battle line did not select every placed formation');
  }

  expect(first.x).toBeLessThan(second.x);
  expect(second.x).toBeLessThan(third.x);
  expect(first.y).toBeCloseTo(900, -1);
  expect(second.y).toBeCloseTo(900, -1);
  expect(third.y).toBeCloseTo(900, -1);
  const nearZero = (value: number) => Math.min(value, 360 - value);
  expect(nearZero(first.rotationDegrees)).toBeLessThan(2);
  expect(nearZero(second.rotationDegrees)).toBeLessThan(2);
  expect(nearZero(third.rotationDegrees)).toBeLessThan(2);

  // Voss Division and I Corps sit behind their own brigade group at 120/240.
  expect(division.y).toBeCloseTo(1020, -1);
  expect(corps.y).toBeCloseTo(1140, -1);
  expect(division.x).toBeCloseTo((first.x + second.x + third.x) / 3, 0);
  expect(nearZero(division.rotationDegrees)).toBeLessThan(2);

  // One undo restores the old brigade and command positions.
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(canvas).toHaveAttribute('data-last-battle-line-count', '0');

  const undone = await selectedStates(page);
  expect(undone['unit-north-brigade-1']).toMatchObject({ x: 700, y: 520 });
  expect(undone['unit-north-division']).toMatchObject({
    x: divisionBefore.x,
    y: divisionBefore.y,
  });
  expect(undone['unit-north-corps']).toMatchObject({ x: corpsBefore.x, y: corpsBefore.y });

  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  const redone = await selectedStates(page);
  expect(redone['unit-north-brigade-1']?.x).toBeCloseTo(first.x, 0);
  expect(redone['unit-north-corps']?.y).toBeCloseTo(1140, -1);

  // Redraw, then flip every formation 180° without moving anything.
  await page.getByTestId('battle-line-draw').click();
  await dragLine(page, mapPoint(box, 500, 500), mapPoint(box, 1100, 500));
  await expect(canvas).toHaveAttribute('data-last-battle-line-count', '5');

  const beforeFlip = await selectedStates(page);
  await page.getByTestId('bulk-flip-180').click();
  await expect(canvas).toHaveAttribute('data-last-battle-line-count', '5');
  const afterFlip = await selectedStates(page);

  for (const unitId of Object.keys(beforeFlip)) {
    const before = beforeFlip[unitId];
    const after = afterFlip[unitId];
    if (!before || !after) throw new Error(`Missing state for ${unitId}`);
    expect(after.x).toBeCloseTo(before.x, 1);
    expect(after.y).toBeCloseTo(before.y, 1);
    expect(after.rotationDegrees).toBeCloseTo((before.rotationDegrees + 180) % 360, 1);
  }

  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  const afterUndo = await selectedStates(page);
  expect(afterUndo['unit-north-brigade-1']?.rotationDegrees).toBe(
    beforeFlip['unit-north-brigade-1']?.rotationDegrees,
  );
  await expect(canvas).toHaveAttribute('data-last-battle-line-count', '0');
});

test('draws a battle line from a selected parent formation in the inspector', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('tab', { name: 'Scenario Editor' }).click();
  await expect(page.getByRole('heading', { name: 'Scenario Editor' })).toBeVisible();

  const canvas = page.getByTestId('scenario-canvas');
  const box = await canvas.boundingBox();
  if (!box) throw new Error('Scenario canvas has no bounding box');

  await page.getByRole('button', { name: 'Select unit I Corps', exact: true }).click();
  const place = page.getByRole('button', { name: 'Place on map', exact: true });
  const drawFromInspector = page.getByTestId('battle-line-draw');
  await expect(page.getByTestId('formation-actions')).toBeVisible();
  await expect(place).toBeVisible();
  await expect(drawFromInspector).toBeVisible();
  await expect(drawFromInspector).toBeEnabled();

  await drawFromInspector.click();
  await expect(canvas).toHaveAttribute('data-battle-line-active', 'true');

  await dragLine(page, mapPoint(box, 300, 900), mapPoint(box, 1300, 900));
  await expect(canvas).toHaveAttribute('data-battle-line-active', 'false');
  await expect(canvas).toHaveAttribute('data-last-battle-line-count', '5');
  await expect(canvas).toHaveAttribute('data-selected-count', '5');
  await expect(canvas).toHaveAttribute('data-deployed-count', '8');

  const placed = await selectedStates(page);
  expect(placed['unit-north-division']?.y).toBeCloseTo(1020, -1);
  expect(placed['unit-north-corps']?.y).toBeCloseTo(1140, -1);
  expect(placed['unit-north-army']).toBeUndefined();
});

test('confirms a cascading parent delete and restores it with one undo', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('tab', { name: 'Scenario Editor' }).click();
  await expect(page.getByRole('heading', { name: 'Scenario Editor' })).toBeVisible();

  const canvas = page.getByTestId('scenario-canvas');
  const oob = page.getByTestId('scenario-oob');
  await expect(canvas).toHaveAttribute('data-deployed-count', '6');

  await page.getByRole('button', { name: 'Select unit Voss Division', exact: true }).click();
  await page.getByTestId('delete-unit').click();
  const warning = page.getByTestId('delete-unit-warning');
  await expect(warning).toContainText('3 subordinate formations');
  await expect(warning).toContainText('remove their states from every phase');

  await page.getByTestId('confirm-delete-unit').click();
  await expect(oob).not.toContainText('Voss Division');
  await expect(oob).not.toContainText('1st Brigade');
  await expect(canvas).toHaveAttribute('data-deployed-count', '3');

  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(oob).toContainText('Voss Division');
  await expect(oob).toContainText('1st Brigade');
  await expect(canvas).toHaveAttribute('data-deployed-count', '6');
});

test('places arbitrary brigades on a short overlapping line and applies bulk edits', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('tab', { name: 'Scenario Editor' }).click();
  await expect(page.getByRole('heading', { name: 'Scenario Editor' })).toBeVisible();

  const canvas = page.getByTestId('scenario-canvas');
  const box = await canvas.boundingBox();
  if (!box) throw new Error('Scenario canvas has no bounding box');

  const northBrigade = page.getByRole('button', {
    name: 'Select unit 1st Brigade',
    exact: true,
  });
  const southBrigade = page.getByRole('button', {
    name: 'Select unit Johnstons Brigade',
    exact: true,
  });
  await northBrigade.click();
  await southBrigade.click({ modifiers: ['Shift'] });
  await expect(canvas).toHaveAttribute('data-selected-count', '2');
  await expect(canvas).toHaveAttribute('data-battle-line-brigade-count', '2');

  // A 60-unit line is much shorter than the 240 units of frontage, so the
  // rectangles overlap instead of the action being rejected.
  await page.getByTestId('battle-line-draw').click();
  await dragLine(page, mapPoint(box, 600, 300), mapPoint(box, 660, 300));
  await expect(canvas).toHaveAttribute('data-last-battle-line-count', '2');
  await expect(canvas).toHaveAttribute('data-battle-line-error', '');

  const placed = await selectedStates(page);
  expect(Object.keys(placed)).toEqual(['unit-north-brigade-1', 'unit-south-brigade-1']);
  const north = placed['unit-north-brigade-1'];
  const south = placed['unit-south-brigade-1'];
  if (!north || !south) throw new Error('Both brigades should be deployed');
  expect(north.x).toBeLessThan(south.x);
  expect(south.x - north.x).toBeLessThan(north.frontageLength);
  expect(north.y).toBeCloseTo(300, -1);
  expect(south.y).toBeCloseTo(300, -1);
  const nearZero = (value: number) => Math.min(value, 360 - value);
  expect(nearZero(north.rotationDegrees)).toBeLessThan(2);
  expect(nearZero(south.rotationDegrees)).toBeLessThan(2);

  await expect(page.getByTestId('selected-unit-count')).toHaveText('2 formations selected');
  const frontage = page.getByLabel('Frontage (all selected)');
  await frontage.fill('150');
  await frontage.press('Enter');
  await expect
    .poll(async () => {
      const states = await selectedStates(page);
      return [
        states['unit-north-brigade-1']?.frontageLength,
        states['unit-south-brigade-1']?.frontageLength,
      ];
    })
    .toEqual([150, 150]);

  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  const afterFrontageUndo = await selectedStates(page);
  expect(afterFrontageUndo['unit-north-brigade-1']?.frontageLength).toBe(120);
  expect(afterFrontageUndo['unit-south-brigade-1']?.frontageLength).toBe(120);
  await expect(canvas).toHaveAttribute('data-last-battle-line-count', '0');

  const beforeBulkFlip = await selectedStates(page);
  await page.getByTestId('bulk-flip-180').click();
  const afterBulkFlip = await selectedStates(page);
  for (const unitId of Object.keys(beforeBulkFlip)) {
    const before = beforeBulkFlip[unitId];
    const after = afterBulkFlip[unitId];
    if (!before || !after) throw new Error(`Missing state for ${unitId}`);
    expect(after.x).toBeCloseTo(before.x, 1);
    expect(after.y).toBeCloseTo(before.y, 1);
    expect(after.rotationDegrees).toBeCloseTo((before.rotationDegrees + 180) % 360, 1);
  }

  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  const afterBulkUndo = await selectedStates(page);
  const nearZeroAfterUndo = (value: number) => Math.min(value, 360 - value);
  expect(
    nearZeroAfterUndo(afterBulkUndo['unit-north-brigade-1']?.rotationDegrees ?? 0),
  ).toBeLessThan(2);
  expect(
    nearZeroAfterUndo(afterBulkUndo['unit-south-brigade-1']?.rotationDegrees ?? 0),
  ).toBeLessThan(2);
});

test('disables the tool without brigades, cancels with Escape, and clears on reset', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('tab', { name: 'Scenario Editor' }).click();
  await expect(page.getByRole('heading', { name: 'Scenario Editor' })).toBeVisible();

  const canvas = page.getByTestId('scenario-canvas');
  const box = await canvas.boundingBox();
  if (!box) throw new Error('Scenario canvas has no bounding box');

  await page.mouse.click(mapPoint(box, 100, 100).x, mapPoint(box, 100, 100).y);
  await expect(canvas).toHaveAttribute('data-selected-count', '0');
  await expect(page.getByTestId('formation-actions')).toHaveCount(0);

  await page.getByRole('button', { name: 'Select unit Voss Division', exact: true }).click();
  await expect(page.getByTestId('formation-actions')).toBeVisible();
  await expect(page.getByTestId('battle-line-draw')).toBeEnabled();
  await page.getByTestId('battle-line-draw').click();
  await expect(canvas).toHaveAttribute('data-battle-line-active', 'true');

  await page.keyboard.press('Escape');
  await expect(canvas).toHaveAttribute('data-battle-line-active', 'false');
  await expect(canvas).toHaveAttribute('data-deployed-count', '6');
  await expect(canvas).toHaveAttribute('data-last-battle-line-count', '0');

  // Escape also abandons an in-progress stroke without recording history.
  await page.getByTestId('battle-line-draw').click();
  await page.mouse.move(mapPoint(box, 300, 400).x, mapPoint(box, 300, 400).y);
  await page.mouse.down();
  await page.mouse.move(mapPoint(box, 700, 400).x, mapPoint(box, 700, 400).y, { steps: 8 });
  await expect(canvas).toHaveAttribute('data-battle-line-draft-points', /^[2-9]\d*$/);
  await page.keyboard.press('Escape');
  await page.mouse.up();
  await expect(canvas).toHaveAttribute('data-battle-line-active', 'false');
  await expect(canvas).toHaveAttribute('data-battle-line-draft-points', '0');
  await expect(canvas).toHaveAttribute('data-deployed-count', '6');
  await expect(canvas).toHaveAttribute('data-last-battle-line-count', '0');
  await expect(page.getByRole('button', { name: 'Undo', exact: true })).toBeDisabled();

  // A completed line is cleared by the keyboard undo path. Selecting Voss
  // Division also deploys its division command behind the brigades.
  await page.getByTestId('battle-line-draw').click();
  await dragLine(page, mapPoint(box, 300, 950), mapPoint(box, 1300, 950));
  await expect(canvas).toHaveAttribute('data-last-battle-line-count', '4');
  await page.keyboard.press('Control+z');
  await expect(canvas).toHaveAttribute('data-last-battle-line-count', '0');

  // Drawing again and resetting the scenario also clears the transient line.
  await page.getByTestId('battle-line-draw').click();
  await dragLine(page, mapPoint(box, 300, 950), mapPoint(box, 1300, 950));
  await expect(canvas).toHaveAttribute('data-last-battle-line-count', '4');

  await page.getByRole('button', { name: 'New scenario' }).click();
  const dialog = page.getByTestId('new-scenario-dialog');
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('Scenario name').fill('Reset Line');
  await dialog.getByRole('button', { name: 'Create scenario' }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByTestId('scenario-name')).toHaveText('Reset Line');
  await expect(canvas).toHaveAttribute('data-last-battle-line-count', '0');
  await expect(canvas).toHaveAttribute('data-deployed-count', '0');
  await expect(page.getByTestId('formation-actions')).toHaveCount(0);
});
