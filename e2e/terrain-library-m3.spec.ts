import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';

interface CanvasMapping {
  box: { x: number; y: number; width: number; height: number };
  toScreen: (x: number, y: number) => { x: number; y: number };
}

async function getCanvasMapping(page: Page): Promise<CanvasMapping> {
  const canvas = page.getByTestId('terrain-canvas');
  await expect(canvas).toBeVisible();
  const box = await canvas.boundingBox();
  if (!box) throw new Error('Canvas has no bounding box');

  const scale = Math.min((box.width - 96) / 2000, (box.height - 96) / 1400);
  const offsetX = (box.width - 2000 * scale) / 2;
  const offsetY = (box.height - 1400 * scale) / 2;

  return {
    box,
    toScreen: (x, y) => ({
      x: box.x + offsetX + x * scale,
      y: box.y + offsetY + y * scale,
    }),
  };
}

async function clickWorld(page: Page, mapping: CanvasMapping, x: number, y: number): Promise<void> {
  const point = mapping.toScreen(x, y);
  await page.mouse.click(point.x, point.y);
}

async function exportCurrentMap(
  page: Page,
): Promise<{ path: string; document: Record<string, unknown> }> {
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  const download = await downloadPromise;
  const path = await download.path();
  if (!path) throw new Error('Export did not produce a file');
  const document = JSON.parse(await readFile(path, 'utf8')) as Record<string, unknown>;
  return { path, document };
}

test('autosaves terrain edits and restores them after reload', async ({ page }) => {
  await page.goto('/');
  const mapping = await getCanvasMapping(page);
  const counter = page.getByTestId('feature-count-total');
  await expect(counter).toHaveText('9 features');

  await clickWorld(page, mapping, 425, 315);
  await expect(page.getByTestId('selected-kind')).toHaveText('Forest');

  const nameInput = page.getByLabel('Name');
  await nameInput.fill('Northern Wood');
  await nameInput.press('Enter');
  await page.getByLabel('Fill pattern').selectOption('dots');

  const status = page.getByTestId('save-status');
  await expect(status).toHaveText('Unsaved changes');
  await expect(status).toHaveText('Saved', { timeout: 5_000 });

  await page.reload();
  await getCanvasMapping(page);
  await expect(counter).toHaveText('9 features');
  await expect(status).toHaveText('Saved');

  await clickWorld(page, mapping, 425, 315);
  await expect(page.getByTestId('selected-kind')).toHaveText('Forest');
  await expect(page.getByLabel('Name')).toHaveValue('Northern Wood');
  await expect(page.getByLabel('Fill pattern')).toHaveValue('dots');
});

test('creates, duplicates, renames, reopens, and deletes terrain documents', async ({ page }) => {
  await page.goto('/');
  const mapping = await getCanvasMapping(page);
  const counter = page.getByTestId('feature-count-total');
  const status = page.getByTestId('save-status');

  await page.getByRole('button', { name: 'New', exact: true }).click();
  const newMapDialog = page.getByTestId('new-terrain-map-dialog');
  await expect(newMapDialog).toBeVisible();
  await newMapDialog.getByRole('button', { name: 'Create map' }).click();
  await expect(newMapDialog).not.toBeVisible();
  await expect(counter).toHaveText('0 features');
  await expect(status).toHaveText('Saved');
  await expect(page.getByTestId('current-map-name')).toHaveText('Untitled terrain');

  await page.getByRole('button', { name: 'Building tool' }).click();
  await clickWorld(page, mapping, 400, 400);
  await expect(counter).toHaveText('1 features');

  await page.getByRole('button', { name: 'Copy current map' }).click();
  await expect(page.getByTestId('current-map-name')).toHaveText('Untitled terrain copy');
  await expect(counter).toHaveText('1 features');

  await page.getByRole('button', { name: 'Open terrain library' }).click();
  const dialog = page.getByTestId('terrain-library');
  await expect(dialog).toBeVisible();

  await dialog.getByRole('button', { name: 'Rename Untitled terrain copy' }).click();
  const renameInput = dialog.getByLabel('Rename map Untitled terrain copy');
  await renameInput.fill('Crossing Study');
  await renameInput.press('Enter');
  await expect(dialog.getByText('Crossing Study', { exact: true })).toBeVisible();

  await dialog.getByRole('button', { name: 'Delete Crossing Study' }).click();
  await dialog.getByRole('button', { name: 'Confirm delete' }).click();
  await expect(dialog.getByRole('button', { name: 'Delete Crossing Study' })).not.toBeVisible();
  await expect(dialog.getByText('Untitled terrain', { exact: true })).toBeVisible();

  await dialog.getByRole('button', { name: 'Close terrain library' }).click();
  await expect(page.getByTestId('current-map-name')).toHaveText('Untitled terrain');
  await expect(counter).toHaveText('1 features');

  await page.getByRole('button', { name: 'Open terrain library' }).click();
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Open Ashford Ford' }).click();
  await expect(dialog).not.toBeVisible();
  await expect(counter).toHaveText('9 features');
  await expect(page.getByTestId('current-map-name')).toHaveText('Ashford Ford');
});

test('creates a named custom-size map and expands its canvas in every direction', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByTestId('feature-count-total')).toHaveText('9 features');

  await page.getByRole('button', { name: 'New', exact: true }).click();
  const dialog = page.getByTestId('new-terrain-map-dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByTestId('new-map-planned-options')).toBeVisible();

  await dialog.getByLabel('Map name').fill('Frontier Study');
  await dialog.getByLabel('Map size').selectOption('custom');
  await dialog.getByLabel('Map width').fill('2400');
  await dialog.getByLabel('Map height').fill('1600');
  await expect(dialog.getByTestId('new-map-size-preview')).toHaveText('2400 × 1600 document units');
  await dialog.getByRole('button', { name: 'Create map' }).click();
  await expect(dialog).not.toBeVisible();

  await expect(page.getByTestId('current-map-name')).toHaveText('Frontier Study');
  await expect(page.getByTestId('feature-count-total')).toHaveText('0 features');
  await expect(page.getByTestId('document-size')).toHaveText('2400 × 1600');
  await expect(page.getByTestId('document-origin')).toHaveText('0, 0');

  await page.getByRole('button', { name: 'Expand canvas' }).click();
  const expandDialog = page.getByTestId('expand-canvas-dialog');
  await expect(expandDialog).toBeVisible();
  await expect(expandDialog.getByRole('button', { name: 'Expand canvas' })).toBeDisabled();

  await expandDialog.getByLabel('Top margin').fill('100');
  await expandDialog.getByLabel('Right margin').fill('200');
  await expandDialog.getByLabel('Bottom margin').fill('300');
  await expandDialog.getByLabel('Left margin').fill('400');
  await expect(expandDialog.getByTestId('canvas-size-preview')).toHaveText(
    'New canvas: 3000 × 2000 · origin -400, -100',
  );
  await expandDialog.getByRole('button', { name: 'Expand canvas' }).click();
  await expect(expandDialog).not.toBeVisible();

  await expect(page.getByTestId('document-size')).toHaveText('3000 × 2000');
  await expect(page.getByTestId('document-origin')).toHaveText('-400, -100');
  await expect(page.getByTestId('document-original-size')).toContainText('2400 × 1600');
  await expect(page.getByTestId('save-status')).toHaveText('Saved', { timeout: 5_000 });

  const canvas = page.getByTestId('terrain-canvas');
  await expect(canvas).toHaveAttribute('data-canvas-expanded', 'true');
  await expect(canvas).toHaveAttribute('data-outside-mode', 'show');

  await page.getByRole('button', { name: 'Grey out areas outside the original canvas' }).click();
  await expect(canvas).toHaveAttribute('data-outside-mode', 'dim');

  await page.getByRole('button', { name: 'Hide areas outside the original canvas' }).click();
  await expect(canvas).toHaveAttribute('data-outside-mode', 'hide');

  await page.getByRole('button', { name: 'Show areas outside the original canvas' }).click();
  await expect(canvas).toHaveAttribute('data-outside-mode', 'show');

  await page.getByRole('button', { name: 'Expand canvas' }).click();
  const revertDialog = page.getByTestId('expand-canvas-dialog');
  await expect(revertDialog.getByTestId('original-canvas-size')).toHaveText(
    'Original canvas: 2400 × 1600 · origin 0, 0',
  );
  await revertDialog.getByRole('button', { name: 'Revert to original size' }).click();
  await expect(revertDialog).not.toBeVisible();
  await expect(page.getByTestId('document-size')).toHaveText('2400 × 1600');
  await expect(page.getByTestId('document-origin')).toHaveText('0, 0');
  await expect(page.getByTestId('document-original-size')).not.toBeVisible();

  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.getByTestId('document-size')).toHaveText('3000 × 2000');
  await expect(page.getByTestId('document-origin')).toHaveText('-400, -100');
  await expect(page.getByTestId('save-status')).toHaveText('Saved', { timeout: 5_000 });

  await page.reload();
  await expect(page.getByTestId('current-map-name')).toHaveText('Frontier Study');
  await expect(page.getByTestId('document-size')).toHaveText('3000 × 2000');
  await expect(page.getByTestId('document-origin')).toHaveText('-400, -100');
  await expect(page.getByTestId('document-original-size')).toContainText('2400 × 1600');
});

test('opens the creation dialog from the terrain library', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Open terrain library' }).click();
  const library = page.getByTestId('terrain-library');
  await expect(library).toBeVisible();

  await library.getByRole('button', { name: 'New map' }).click();
  await expect(library).not.toBeVisible();
  await expect(page.getByTestId('new-terrain-map-dialog')).toBeVisible();
});

test('rejects canvas expansion beyond the maximum size', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Expand canvas' }).click();
  const dialog = page.getByTestId('expand-canvas-dialog');
  await expect(dialog).toBeVisible();

  await dialog.getByLabel('Right margin').fill('9000');
  await expect(dialog.getByRole('alert')).toContainText('maximum');
  await expect(dialog.getByTestId('canvas-size-preview')).toHaveText(
    'Adjust the margins to preview the new canvas.',
  );
  await expect(dialog.getByRole('button', { name: 'Expand canvas' })).toBeDisabled();

  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByTestId('document-size')).toHaveText('2000 × 1400');
});

test('rejects invalid imports without replacing the active map', async ({ page }) => {
  await page.goto('/');
  await getCanvasMapping(page);
  const counter = page.getByTestId('feature-count-total');
  await expect(counter).toHaveText('9 features');

  await page.getByTestId('terrain-import-input').setInputFiles({
    name: 'broken.terrain.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{"schemaVersion":1,"name":"Broken","layers":[],"features":[]}'),
  });

  await expect(page.getByRole('alert')).toContainText('failed schema validation');
  await expect(counter).toHaveText('9 features');
  await expect(page.getByTestId('current-map-name')).toHaveText('Ashford Ford');
});

test('exports and reimports a terrain map with equivalent data', async ({ page }) => {
  await page.goto('/');
  await getCanvasMapping(page);

  const exported = await exportCurrentMap(page);
  const original = exported.document as {
    id: string;
    name: string;
    width: number;
    height: number;
    backgroundStyle: string;
    layers: unknown;
    features: unknown;
  };
  expect(original.name).toBe('Ashford Ford');
  expect(original.features).toHaveLength(9);

  await page.getByRole('button', { name: 'New', exact: true }).click();
  await page
    .getByTestId('new-terrain-map-dialog')
    .getByRole('button', { name: 'Create map' })
    .click();
  await expect(page.getByTestId('feature-count-total')).toHaveText('0 features');

  const importInput = page.getByTestId('terrain-import-input');
  await importInput.setInputFiles(exported.path);
  await expect(page.getByTestId('feature-count-total')).toHaveText('9 features');
  await expect(page.getByTestId('current-map-name')).toHaveText('Ashford Ford');
  await expect(page.getByTestId('save-status')).toHaveText('Saved');

  const reimported = (await exportCurrentMap(page)).document as {
    id: string;
    name: string;
    width: number;
    height: number;
    backgroundStyle: string;
    layers: unknown;
    features: unknown;
  };

  expect(reimported.id).not.toBe(original.id);
  expect(reimported.name).toBe(original.name);
  expect(reimported.width).toBe(original.width);
  expect(reimported.height).toBe(original.height);
  expect(reimported.backgroundStyle).toBe(original.backgroundStyle);
  expect(reimported.layers).toEqual(original.layers);
  expect(reimported.features).toEqual(original.features);
});
