import { expect, test } from '@playwright/test';

test('public UI launches a playable mission without exposing the production debug hook', async ({ page }) => {
  await page.goto('/');
  expect(await page.evaluate(() => Boolean(window.__keyfortApp))).toBe(test.info().project.metadata.production !== true);
  await page.getByTestId('quick-start-campaign-btn').click();
  await expect(page.getByTestId('battlefield-canvas')).toBeVisible();
  await expect(page.getByTestId('virtual-keyboard')).toBeVisible();
  const before = Number(await page.locator('#hud-energy-value').textContent());
  const expected = await page.getByTestId('console-sequence-box').getAttribute('data-expected-char');
  expect(expected).toBeTruthy();
  await page.keyboard.press(expected === ' ' ? 'Space' : expected!);
  await expect.poll(async () => Number(await page.locator('#hud-energy-value').textContent())).toBeGreaterThan(before);
  const visibleHud = await page.getByTestId('tactical-hud').evaluate((hud) => {
    const bounds = hud.getBoundingClientRect();
    return [...hud.querySelectorAll<HTMLElement>('.hud-stat, .hud-cell-energy')]
      .filter((el) => el.getClientRects().length > 0)
      .every((el) => {
        const cell = el.getBoundingClientRect();
        return cell.left >= bounds.left - 1 && cell.right <= bounds.right + 1;
      });
  });
  expect(visibleHud).toBe(true);
});
