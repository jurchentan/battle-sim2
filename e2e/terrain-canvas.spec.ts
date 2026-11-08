import { expect, test } from '@playwright/test';

test('draws a polygon and supports undo, redo, and zoom', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Terrain Editor' })).toBeVisible();
  const canvas = page.getByTestId('terrain-canvas');
  await expect(canvas).toBeVisible();

  const counter = page.getByTestId('feature-count-total');
  await expect(counter).toHaveText('9 features');

  await expect(page.getByRole('button', { name: 'Freehand mode' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByRole('button', { name: 'Vertices mode' }).click();

  const zoom = page.getByTestId('zoom-level');
  const initialZoom = await zoom.textContent();

  await page.getByRole('button', { name: 'Field tool' }).click();

  const box = await canvas.boundingBox();
  if (!box) throw new Error('Canvas has no bounding box');

  await page.mouse.click(box.x + box.width * 0.34, box.y + box.height * 0.36);
  await page.mouse.click(box.x + box.width * 0.49, box.y + box.height * 0.3);
  await page.mouse.click(box.x + box.width * 0.57, box.y + box.height * 0.47);
  await page.mouse.click(box.x + box.width * 0.41, box.y + box.height * 0.54);
  await page.keyboard.press('Enter');

  await expect(counter).toHaveText('10 features');
  await expect(page.getByTestId('selected-kind')).toHaveText('Field');
  await expect(page.getByRole('button', { name: 'Undo' })).toBeEnabled();

  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(counter).toHaveText('9 features');

  await page.getByRole('button', { name: 'Redo' }).click();
  await expect(counter).toHaveText('10 features');

  await page.getByRole('button', { name: 'Zoom in' }).click();
  await expect(zoom).not.toHaveText(initialZoom ?? '');

  await page.getByRole('button', { name: 'Fit' }).click();
  await expect(zoom).toHaveText(initialZoom ?? '');
});

test('pans by dragging empty canvas with the select tool', async ({ page }) => {
  await page.goto('/');
  const canvas = page.getByTestId('terrain-canvas');
  await expect(canvas).toBeVisible();

  const box = await canvas.boundingBox();
  if (!box) throw new Error('Canvas has no bounding box');

  const scale = Math.min((box.width - 96) / 2000, (box.height - 96) / 1400);
  const offsetX = (box.width - 2000 * scale) / 2;
  const offsetY = (box.height - 1400 * scale) / 2;
  const toScreen = (x: number, y: number) => ({
    x: box.x + offsetX + x * scale,
    y: box.y + offsetY + y * scale,
  });

  const building = toScreen(1080, 940);
  await page.mouse.click(building.x, building.y);
  await expect(page.getByTestId('selected-kind')).toHaveText('Building');

  const dragStart = toScreen(1000, 1200);
  const shift = 120;
  await page.mouse.move(dragStart.x, dragStart.y);
  await page.mouse.down();
  await page.mouse.move(dragStart.x + shift, dragStart.y, { steps: 6 });
  await page.mouse.up();
  await expect(page.getByTestId('selected-kind')).not.toBeVisible();

  await page.mouse.click(building.x + shift, building.y);
  await expect(page.getByTestId('selected-kind')).toHaveText('Building');
});

test('drags a seeded object and undoes the move as one gesture', async ({ page }) => {
  await page.goto('/');
  const canvas = page.getByTestId('terrain-canvas');
  await expect(canvas).toBeVisible();

  const box = await canvas.boundingBox();
  if (!box) throw new Error('Canvas has no bounding box');

  const scale = Math.min((box.width - 96) / 2000, (box.height - 96) / 1400);
  const offsetX = (box.width - 2000 * scale) / 2;
  const offsetY = (box.height - 1400 * scale) / 2;
  const start = {
    x: box.x + offsetX + 425 * scale,
    y: box.y + offsetY + 315 * scale,
  };
  await page.mouse.click(start.x, start.y);

  const position = page.getByTestId('selected-position');
  await expect(position).toHaveText('425, 315');

  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x + 40, start.y + 30, { steps: 6 });
  await page.mouse.up();

  await expect(position).not.toHaveText('425, 315');
  await expect(page.getByRole('button', { name: 'Undo' })).toBeEnabled();

  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(position).toHaveText('425, 315');
});

test('resizes and rotates an object, each undo restoring the previous state', async ({ page }) => {
  await page.goto('/');
  const canvas = page.getByTestId('terrain-canvas');
  await expect(canvas).toBeVisible();

  const box = await canvas.boundingBox();
  if (!box) throw new Error('Canvas has no bounding box');

  const scale = Math.min((box.width - 96) / 2000, (box.height - 96) / 1400);
  const offsetX = (box.width - 2000 * scale) / 2;
  const offsetY = (box.height - 1400 * scale) / 2;
  const toScreen = (x: number, y: number) => ({
    x: box.x + offsetX + x * scale,
    y: box.y + offsetY + y * scale,
  });

  const center = toScreen(425, 315);
  await page.mouse.click(center.x, center.y);
  await expect(page.getByTestId('selected-size')).toHaveText('530 × 370');

  const bottomRight = toScreen(690, 500);
  await page.mouse.move(bottomRight.x + 8, bottomRight.y + 8);
  await page.mouse.down();
  await page.mouse.move(bottomRight.x + 48, bottomRight.y + 33, { steps: 6 });
  await page.mouse.up();
  await expect(page.getByTestId('selected-size')).not.toHaveText('530 × 370');

  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.getByTestId('selected-size')).toHaveText('530 × 370');

  const topCenter = toScreen(425, 130);
  await page.mouse.move(topCenter.x, topCenter.y - 24);
  await page.mouse.down();
  await page.mouse.move(topCenter.x + 50, topCenter.y - 4, { steps: 6 });
  await page.mouse.up();
  await expect(page.getByTestId('selected-size')).not.toHaveText('530 × 370');

  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.getByTestId('selected-size')).toHaveText('530 × 370');
});
