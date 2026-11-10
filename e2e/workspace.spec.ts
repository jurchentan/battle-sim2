import { expect, test } from '@playwright/test';

test('switches between the three editor workspaces', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Terrain Editor' })).toBeVisible();
  await expect(page.getByText('Ashford Ford', { exact: true }).first()).toBeVisible();

  await page.getByRole('tab', { name: 'Army Roster Editor' }).click();
  await expect(page.getByRole('heading', { name: 'Army Roster Editor' })).toBeVisible();
  await expect(page.getByText('Ashford Campaign Rosters')).toBeVisible();

  await page.getByRole('tab', { name: 'Scenario Editor' }).click();
  await expect(page.getByRole('heading', { name: 'Scenario Editor' })).toBeVisible();
  await expect(page.getByTestId('scenario-name')).toHaveText('Action at Ashford Ford');

  await page.getByRole('tab', { name: 'Terrain Editor' }).click();
  await expect(page.getByRole('heading', { name: 'Terrain Editor' })).toBeVisible();
});
