import { expect, test } from '@playwright/test';

test('anonymous shell supports navigation, reload and unknown routes', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('你的下一段小冒险');
  await expect(page.getByRole('textbox')).toHaveCount(0);
  await page.getByRole('link', { name: '我的支线', exact: true }).click();
  await expect(page).toHaveURL(/\/quests$/);
  await page.reload();
  await expect(page.getByRole('heading', { name: '我的支线' })).toBeVisible();
  await page.getByRole('link', { name: '设置', exact: true }).click();
  await expect(page.getByText(/个人记录和照片仅保存在当前浏览器/)).toBeVisible();
  await page.goto('/not-a-route');
  await page.getByRole('link', { name: '发现一条支线' }).click();
  await expect(page).toHaveURL('/');
});

test('mobile shell fits the viewport and provides a keyboard skip link', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: '跳至主要内容' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('main')).toBeFocused();
});
