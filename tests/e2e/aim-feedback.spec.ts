import { expect, test } from '@playwright/test';

test('uses five-degree angle controls and shows hole-speed feedback markup', async ({ page }) => {
  await page.goto('/');
  const angle = page.locator('#angle-control');
  await expect(angle).toHaveAttribute('step', '5');
  await expect(angle).toHaveAttribute('max', '355');
  await angle.fill('35');
  await expect(page.locator('#angle-output')).toHaveText('35°');
  await expect(page.locator('#hole-speed-indicator')).toBeHidden();
});

test('serves the packaged favicon', async ({ page, request }) => {
  await page.goto('/');
  await expect(page.locator('link[rel="icon"]')).toHaveAttribute('href', './favicon.svg');
  const response = await request.get('/favicon.svg');
  expect(response.ok()).toBe(true);
  expect(await response.text()).toContain('<svg');
});
