import { expect, test, type Page } from '@playwright/test';

async function openArmyWorkspace(page: Page): Promise<void> {
  await page.getByRole('tab', { name: 'Army Roster Editor' }).click();
  await expect(page.getByRole('heading', { name: 'Army Roster Editor' })).toBeVisible();
}

test('uses default strengths and generated names, with custom-name override', async ({ page }) => {
  await page.goto('/');
  await openArmyWorkspace(page);

  await page.getByRole('button', { name: 'Add unit' }).click();
  const form = page.getByTestId('unit-create-form');
  await expect(form).toBeVisible();

  const preview = form.getByTestId('unit-name-preview');
  const echelon = form.getByRole('combobox', { name: 'Echelon', exact: true });
  const unitType = form.getByRole('combobox', { name: 'Unit type', exact: true });
  const strength = form.getByLabel('Initial strength');

  await echelon.selectOption('brigade');
  await expect(preview).toHaveText('4th Brigade');
  await expect(strength).toHaveValue('1500');

  await unitType.selectOption('cavalry');
  await expect(strength).toHaveValue('800');
  await unitType.selectOption('artillery');
  await expect(strength).toHaveValue('300');
  await unitType.selectOption('infantry');
  await expect(strength).toHaveValue('1500');

  await echelon.selectOption('division');
  await expect(strength).toHaveValue('');
  await echelon.selectOption('brigade');
  await expect(strength).toHaveValue('1500');

  await form.getByLabel('Commander').fill('Jones');
  await expect(preview).toHaveText('4th Brigade');

  await form.getByLabel('Custom name').fill('Guards Brigade');
  await expect(preview).toHaveText('Guards Brigade');
  await form.getByLabel('Custom name').fill('');
  await expect(preview).toHaveText('4th Brigade');

  await form.getByRole('combobox', { name: 'Faction', exact: true }).selectOption({
    label: 'Southern Crown',
  });
  await expect(preview).toHaveText("Jones' Brigade");

  await form.getByRole('button', { name: 'Create unit' }).click();
  const editor = page.getByTestId('unit-editor');
  await expect(editor).toContainText("Jones' Brigade");
  await expect(editor.getByLabel('Commander')).toHaveValue('Jones');
  await expect(editor.getByLabel('Custom name')).toHaveValue('');
  await expect(editor.getByLabel('Initial strength')).toHaveValue('1500');
  await expect(page.getByTestId('roster-save-status')).toHaveText('Saved', { timeout: 5_000 });

  await page.reload();
  await openArmyWorkspace(page);
  const oobUnit = page.getByRole('button', { name: "Select unit Jones' Brigade" });
  await expect(oobUnit).toBeVisible();
  await oobUnit.click();
  await expect(page.getByTestId('unit-editor').getByLabel('Initial strength')).toHaveValue('1500');

  await editor.getByLabel('Custom name').fill('Crown Guard');
  await editor.getByLabel('Custom name').blur();
  await expect(editor).toContainText('Crown Guard');
  await expect(page.getByRole('button', { name: 'Select unit Crown Guard' })).toBeVisible();

  await editor.getByLabel('Custom name').fill('');
  await editor.getByLabel('Custom name').blur();
  await expect(editor).toContainText("Jones' Brigade");

  await editor.getByLabel('Commander').fill('Sigel');
  await editor.getByLabel('Commander').blur();
  await expect(editor).toContainText('Sigels Brigade');
  await expect(page.getByRole('button', { name: 'Select unit Sigels Brigade' })).toBeVisible();
  await expect(page.getByTestId('roster-save-status')).toHaveText('Saved', { timeout: 5_000 });
});

test('adds subordinates from the order of battle and rolls up formation strength', async ({
  page,
}) => {
  await page.goto('/');
  await openArmyWorkspace(page);

  const division = page.getByRole('button', { name: 'Select unit Voss Division' });
  await expect(division).toContainText('Σ 5,000');
  await expect(
    page.getByRole('button', { name: 'Add subordinate to Voss Division' }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add subordinate to 1st Brigade' })).toHaveCount(0);

  await page.getByRole('combobox', { name: 'Smallest unit' }).selectOption('regiment');
  await expect(page.getByRole('button', { name: 'Add subordinate to 1st Brigade' })).toBeVisible();

  await page.getByRole('button', { name: 'Add subordinate to 1st Brigade' }).click();
  const form = page.getByTestId('unit-create-form');
  await expect(form).toBeVisible();
  await expect(form.getByRole('combobox', { name: /^Parent formation/ })).toHaveValue(
    'unit-north-brigade-1',
  );
  await expect(form.getByRole('combobox', { name: 'Echelon', exact: true })).toHaveValue(
    'regiment',
  );
  await expect(form.getByLabel('Initial strength')).toHaveValue('500');

  await form.getByLabel('Custom name').fill('1st Grenadier Regiment');
  await form.getByLabel('Initial strength').fill('700');
  await form.getByRole('button', { name: 'Create unit' }).click();

  await expect(page.getByTestId('unit-editor')).toContainText('1st Grenadier Regiment');
  await expect(division).toContainText('Σ 3,900');
  await expect(
    page.getByRole('button', { name: 'Add subordinate to 1st Grenadier Regiment' }),
  ).toHaveCount(0);

  await page.getByLabel('Initial strength').fill('800');
  await page.getByLabel('Initial strength').blur();
  await expect(division).toContainText('Σ 4,000');
  await expect(page.getByTestId('roster-save-status')).toHaveText('Saved', { timeout: 5_000 });

  await page.reload();
  await openArmyWorkspace(page);
  await expect(page.getByRole('combobox', { name: 'Smallest unit' })).toHaveValue('regiment');
  await expect(page.getByRole('button', { name: 'Select unit Voss Division' })).toContainText(
    'Σ 4,000',
  );
});
