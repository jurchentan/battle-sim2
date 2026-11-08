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

test('draws area, path, symbol, and label features with dedicated tools', async ({ page }) => {
  await page.goto('/');
  const mapping = await getCanvasMapping(page);
  const counter = page.getByTestId('feature-count-total');
  await expect(counter).toHaveText('9 features');

  await expect(page.getByRole('button', { name: 'Freehand mode' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByRole('button', { name: 'Vertices mode' }).click();

  await page.getByRole('button', { name: 'Forest tool' }).click();
  await clickWorld(page, mapping, 100, 100);
  await clickWorld(page, mapping, 300, 120);
  await clickWorld(page, mapping, 260, 300);
  await clickWorld(page, mapping, 120, 280);
  await page.keyboard.press('Enter');
  await expect(counter).toHaveText('10 features');
  await expect(page.getByTestId('selected-kind')).toHaveText('Forest');

  await page.getByRole('button', { name: 'Water tool' }).click();
  await clickWorld(page, mapping, 1500, 1000);
  await clickWorld(page, mapping, 1700, 1000);
  await clickWorld(page, mapping, 1600, 1150);
  await page.keyboard.press('Enter');
  await expect(counter).toHaveText('11 features');
  await expect(page.getByTestId('selected-kind')).toHaveText('Lake');

  await page.getByRole('button', { name: 'Road tool' }).click();
  await clickWorld(page, mapping, 100, 1200);
  await clickWorld(page, mapping, 300, 1250);
  await clickWorld(page, mapping, 500, 1200);
  await page.keyboard.press('Enter');
  await expect(counter).toHaveText('12 features');
  await expect(page.getByTestId('selected-kind')).toHaveText('Road');

  await page.getByRole('button', { name: 'Contour tool' }).click();
  await clickWorld(page, mapping, 1300, 200);
  await clickWorld(page, mapping, 1450, 150);
  await clickWorld(page, mapping, 1600, 220);
  await page.keyboard.press('Enter');
  await expect(counter).toHaveText('13 features');
  await expect(page.getByTestId('selected-kind')).toHaveText('Contour');

  await page.getByRole('button', { name: 'Building tool' }).click();
  await clickWorld(page, mapping, 1500, 1100);
  await expect(counter).toHaveText('14 features');
  await expect(page.getByTestId('selected-kind')).toHaveText('Building');

  await page.getByRole('button', { name: 'Bridge tool' }).click();
  await clickWorld(page, mapping, 600, 1100);
  await expect(counter).toHaveText('15 features');
  await expect(page.getByTestId('selected-kind')).toHaveText('Bridge');

  await page.getByRole('button', { name: 'Label tool' }).click();
  await clickWorld(page, mapping, 1600, 1050);
  await expect(counter).toHaveText('16 features');
  await expect(page.getByTestId('selected-kind')).toHaveText('Label');
});

test('edits styles and duplicates or deletes the selected object', async ({ page }) => {
  await page.goto('/');
  const mapping = await getCanvasMapping(page);
  const counter = page.getByTestId('feature-count-total');

  await clickWorld(page, mapping, 425, 315);
  await expect(page.getByTestId('selected-kind')).toHaveText('Forest');

  await page.getByLabel('Fill pattern').selectOption('dots');
  await expect(page.getByLabel('Fill pattern')).toHaveValue('dots');

  const strokeWidth = page.getByLabel('Stroke width');
  await strokeWidth.fill('4');
  await strokeWidth.press('Enter');
  await expect(strokeWidth).toHaveValue('4');

  await page.getByRole('button', { name: 'Duplicate' }).click();
  await expect(counter).toHaveText('10 features');
  await expect(page.getByTestId('selected-kind')).toHaveText('Forest');
  await expect(page.getByTestId('selected-position')).not.toHaveText('425, 315');

  await page.getByRole('button', { name: 'Delete' }).click();
  await expect(counter).toHaveText('9 features');
});

test('hides and locks layers, preventing edits until restored', async ({ page }) => {
  await page.goto('/');
  const mapping = await getCanvasMapping(page);
  const counter = page.getByTestId('feature-count-total');

  await clickWorld(page, mapping, 425, 315);
  await expect(page.getByTestId('selected-kind')).toHaveText('Forest');

  await page.getByRole('button', { name: 'Hide layer Areas' }).click();
  await expect(page.getByRole('button', { name: 'Show layer Areas' })).toBeVisible();
  await expect(page.getByTestId('selected-kind')).not.toBeVisible();
  await expect(counter).toHaveText('9 features');

  await page.getByRole('button', { name: 'Show layer Areas' }).click();
  await clickWorld(page, mapping, 425, 315);
  await expect(page.getByTestId('selected-kind')).toHaveText('Forest');

  await page.getByRole('button', { name: 'Lock layer Areas' }).click();
  await expect(page.getByRole('button', { name: 'Unlock layer Areas' })).toBeVisible();
  await expect(page.getByTestId('selected-kind')).not.toBeVisible();

  await page.getByRole('button', { name: 'Building tool' }).click();
  await clickWorld(page, mapping, 300, 900);
  await expect(counter).toHaveText('9 features');

  await page.getByRole('button', { name: 'Unlock layer Areas' }).click();
  await page.getByRole('button', { name: 'Building tool' }).click();
  await clickWorld(page, mapping, 300, 900);
  await expect(counter).toHaveText('10 features');
});

test('draws a simplified freehand forest polygon', async ({ page }) => {
  await page.goto('/');
  const mapping = await getCanvasMapping(page);
  const counter = page.getByTestId('feature-count-total');

  await page.getByRole('button', { name: 'Forest tool' }).click();
  await expect(page.getByRole('button', { name: 'Freehand mode' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );

  const start = mapping.toScreen(250, 800);
  const points = [
    mapping.toScreen(300, 780),
    mapping.toScreen(350, 790),
    mapping.toScreen(390, 830),
    mapping.toScreen(400, 880),
    mapping.toScreen(360, 920),
    mapping.toScreen(300, 930),
    mapping.toScreen(250, 900),
    mapping.toScreen(230, 850),
    mapping.toScreen(250, 800),
  ];

  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  for (const point of points) {
    await page.mouse.move(point.x, point.y, { steps: 4 });
  }
  await page.mouse.up();

  await expect(counter).toHaveText('10 features');
  await expect(page.getByTestId('selected-kind')).toHaveText('Forest');
});
