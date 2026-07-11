import { expect, test } from '@playwright/test';

test('loads the production game, worker and TrumpScript feature UI', async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'CRAZY MINI GOLF' })).toBeVisible();
  await expect(page.locator('#trump-briefing-panel')).toBeVisible();
  await expect(page.locator('#hud-strokes')).toHaveText('0');

  await page.locator('#hit-button').click();
  await expect(page.locator('#hud-strokes')).toHaveText('1');
  await expect(page.locator('#commentator')).not.toContainText('ENGINE ERROR');
  expect(consoleErrors).toEqual([]);
});

test('blocked Local Storage remains a non-fatal optional failure', async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException('Storage blocked', 'SecurityError');
    };
  });
  await page.goto('/');
  await page.locator('#hit-button').click();
  await expect(page.locator('#hud-strokes')).toHaveText('1');
  await expect(page.locator('#commentator')).not.toContainText('ENGINE ERROR');
});
