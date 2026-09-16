import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { EXAMPLE_QUEST } from '../../packages/contracts/src/example';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const snapshot = {
  ...EXAMPLE_QUEST,
  questId: '1',
  versionId: '1:1',
  publishedAt: '2026-09-15T00:00:00.000Z',
};
async function mockContent(page: Page) {
  await page.clock.install({ time: new Date('2026-09-15T08:00:00Z') });
  await page.route('**/api/public/catalog', (route) =>
    route.fulfill({
      json: {
        schemaVersion: 1,
        revision: '1',
        serverTime: '2026-09-15T08:00:00.000Z',
        expiresAt: '2026-09-16T08:00:00.000Z',
        tasks: [snapshot],
        withdrawals: [],
      },
    }),
  );
  await page.route('**/api/public/daily', (route) =>
    route.fulfill({
      json: {
        schemaVersion: 1,
        dailyId: 'daily:2026-09-15',
        businessDate: '2026-09-15',
        timezone: 'Asia/Shanghai',
        revision: '1',
        serverTime: '2026-09-15T08:00:00.000Z',
        snapshot,
      },
    }),
  );
}
async function acceptOrdinary(page: Page) {
  await page.goto('/quests/1');
  await page.getByRole('button', { name: '接取普通支线', exact: true }).click();
  await expect(page).toHaveURL(/\/executions\//);
}

test('themes persist, synchronize and keep quest progress intact', async ({ page, context }) => {
  await mockContent(page);
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'daily');
  await expect(page.getByRole('button', { name: '随机一条支线', exact: true })).toBeEnabled();
  await acceptOrdinary(page);
  await page.getByRole('button', { name: '确认完成（不可撤销）' }).click();
  await expect(page.getByText(/已完成 · \+10 XP/)).toBeVisible();
  const second = await context.newPage();
  await mockContent(second);
  await second.goto('/settings');
  await page.goto('/settings');
  await page.getByRole('radio', { name: '复古像素 RPG' }).check();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'pixel');
  await expect(second.getByRole('radio', { name: '复古像素 RPG' })).toBeChecked();
  await page.reload();
  await expect(page.getByRole('radio', { name: '复古像素 RPG' })).toBeChecked();
  await page.goto('/profile');
  await expect(page.getByText('10 XP', { exact: false }).first()).toBeVisible();
  await page.screenshot({ path: 'docs/validation/images/pixel-profile.png', fullPage: true });
  await page.goto('/');
  await expect(page.getByRole('button', { name: '随机一条支线', exact: true })).toBeEnabled();
  await page.screenshot({ path: 'docs/validation/images/pixel-home-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 375, height: 812 });
  await page.screenshot({ path: 'docs/validation/images/pixel-home-mobile.png', fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.goto('/settings');
  await page.screenshot({
    path: 'docs/validation/images/theme-settings-mobile.png',
    fullPage: true,
  });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('radio', { name: '简约日常' }).check();
  await expect(second.locator('html')).toHaveAttribute('data-theme', 'daily');
  await page.goto('/archive');
  await expect(page.getByRole('link', { name: /在窗边发现三种颜色/ })).toBeVisible();
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'daily');
});

test('theme preference handles invalid or unavailable storage', async ({ page }) => {
  await mockContent(page);
  await page.addInitScript(() => {
    localStorage.setItem('sidequest-theme-v1', 'unknown-future-theme');
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === 'sidequest-theme-v1') throw new DOMException('Blocked', 'SecurityError');
      original.call(this, key, value);
    };
  });
  await page.goto('/settings');
  await expect(page.getByRole('radio', { name: '简约日常' })).toBeChecked();
  await page.getByRole('radio', { name: '复古像素 RPG' }).check();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'pixel');
  await expect(page.getByText('当前浏览器无法保存外观偏好，本次切换仍然有效。')).toBeVisible();
});

test('statistics stay local and preserve completion-time note flags', async ({ page }) => {
  const posts: string[] = [];
  page.on('request', (request) => {
    if (request.method() === 'POST') posts.push(request.url());
  });
  await mockContent(page);
  await page.goto('/');
  await expect(page.getByRole('button', { name: '随机一条支线', exact: true })).toBeEnabled();
  await acceptOrdinary(page);
  await page.getByRole('button', { name: '确认完成（不可撤销）' }).click();
  await expect(page.getByText(/已完成 · \+10 XP/)).toBeVisible();
  await page.getByLabel('一句记录（可跳过）').fill('完成后才补记，不改变完成时统计');
  await page.getByRole('button', { name: '保存记录', exact: true }).click();
  await expect(page.getByText('记录已保存。')).toBeVisible();
  await page.goto('/stats');
  await expect(page.getByText('完成时存档补充率', { exact: true }).locator('..')).toContainText(
    '0%',
  );
  await expect(page.getByText('接取队列完成率', { exact: true }).locator('..')).toContainText(
    '100%',
  );
  expect(posts).toEqual([]);
});

test('photo compression, editing and removal keep rewards unchanged', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await mockContent(page);
  await page.goto('/');
  await expect(page.getByRole('button', { name: '随机一条支线', exact: true })).toBeEnabled();
  await page.screenshot({ path: 'docs/validation/images/MVP-mobile.png', fullPage: true });
  await acceptOrdinary(page);
  const image = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 2000;
    canvas.height = 1000;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#8c9c75';
    ctx.fillRect(0, 0, 2000, 1000);
    return canvas.toDataURL('image/png').split(',')[1]!;
  });
  await page.getByLabel('照片（可跳过，仅保存在本机）').setInputFiles({
    name: 'private.png',
    mimeType: 'image/png',
    buffer: Buffer.from(image, 'base64'),
  });
  await expect(page.getByText(/已准备照片/)).toBeVisible();
  await page.getByRole('button', { name: '确认完成（不可撤销）' }).click();
  await expect(page.getByRole('img', { name: '这次经历的私人照片' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('img', { name: '这次经历的私人照片' })).toBeVisible();
  await page.getByRole('button', { name: '移除照片' }).click();
  await page.getByRole('button', { name: '保存记录', exact: true }).click();
  await expect(page.getByText('记录已保存。')).toBeVisible();
  await expect(page.getByRole('img', { name: '这次经历的私人照片' })).toHaveCount(0);
  await expect(page.getByText(/已完成 · \+10 XP/)).toBeVisible();
});

test('previously visited app starts offline and completes an accepted ordinary quest', async ({
  page,
  context,
}) => {
  await mockContent(page);
  await page.goto('/');
  await expect(page.getByRole('button', { name: '随机一条支线', exact: true })).toBeEnabled();
  await acceptOrdinary(page);
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await expect
    .poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller)))
    .toBe(true);
  await context.setOffline(true);
  await page.unroute('**/api/public/catalog');
  await page.unroute('**/api/public/daily');
  await page.reload();
  await expect(page.getByRole('button', { name: '确认完成（不可撤销）' })).toBeVisible();
  await page.getByLabel('一句记录（可跳过）').fill('离线也能记录');
  await page.getByRole('button', { name: '确认完成（不可撤销）' }).click();
  await expect(page.getByText(/已完成 · \+10 XP/)).toBeVisible();
});

test('persistent browser restart retains task and reward history', async ({
  playwright,
  browserName,
}) => {
  test.skip(browserName !== 'chromium', 'This persistence fixture explicitly launches Chromium.');
  const directory = await mkdtemp(path.join(tmpdir(), 'sidequest-browser-test-'));
  let context = await playwright.chromium.launchPersistentContext(directory, {
    headless: true,
    baseURL: 'http://127.0.0.1:4173',
  });
  try {
    let page = context.pages()[0]!;
    await mockContent(page);
    await page.goto('/');
    await expect(page.getByRole('button', { name: '随机一条支线', exact: true })).toBeEnabled();
    await acceptOrdinary(page);
    await page.getByRole('button', { name: '确认完成（不可撤销）' }).click();
    await expect(page.getByText(/已完成 · \+10 XP/)).toBeVisible();
    await context.close();
    context = await playwright.chromium.launchPersistentContext(directory, {
      headless: true,
      baseURL: 'http://127.0.0.1:4173',
    });
    page = context.pages()[0]!;
    await mockContent(page);
    await page.goto('/profile');
    await expect(page.getByText('10 XP · 1 次完成')).toBeVisible();
  } finally {
    await context.close();
    await rm(directory, { recursive: true, force: true });
  }
});
test('complete, reload, edit, repeat, export and reset a private archive', async ({ page }) => {
  await mockContent(page);
  await page.goto('/');
  await expect(page.getByRole('button', { name: '随机一条支线', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: '随机一条支线', exact: true }).click();
  await page.getByRole('button', { name: '换一个', exact: true }).click();
  await expect(page.getByText('这一轮已经全部看过了。')).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: '随机一条支线', exact: true }).click();
  await expect(page.getByText('这一轮已经全部看过了。')).toBeVisible();
  await acceptOrdinary(page);
  await page.getByLabel('一句记录（可跳过）').fill('属于我的第一条记忆');
  await page.getByRole('button', { name: '确认完成（不可撤销）' }).click();
  await expect(page).toHaveURL(/\/archive\//);
  await expect(page.getByText(/已完成 · \+10 XP/)).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('一句记录（可跳过）')).toHaveValue('属于我的第一条记忆');
  await page.getByLabel('一句记录（可跳过）').fill('后来补充的记录');
  await page.getByRole('button', { name: '保存记录', exact: true }).click();
  await expect(page.getByText('记录已保存。')).toBeVisible();
  await acceptOrdinary(page);
  await page.getByRole('button', { name: '确认完成（不可撤销）' }).click();
  await expect(page.getByText(/已完成 · \+5 XP/)).toBeVisible();
  await page.getByRole('link', { name: '角色卡', exact: true }).click();
  await expect(page.getByText('15 XP · 2 次完成')).toBeVisible();
  await page.screenshot({ path: 'docs/validation/images/MVP-profile.png', fullPage: true });
  await page.getByRole('link', { name: '设置', exact: true }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: '导出全部记录' }).click();
  expect((await download).suggestedFilename()).toMatch(/\.zip$/);
  await expect(page.getByRole('button', { name: '确认删除个人数据' })).toBeDisabled();
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: '确认删除个人数据' }).click();
  await expect(page.getByRole('checkbox')).not.toBeChecked();
  await page.getByRole('link', { name: '角色卡', exact: true }).click();
  await expect(page.getByText('0 XP · 0 次完成')).toBeVisible();
});

test('daily and ordinary coexist and unfinished daily expires at midnight', async ({ page }) => {
  await mockContent(page);
  await page.goto('/');
  await expect(page.getByRole('button', { name: '随机一条支线', exact: true })).toBeEnabled();
  await acceptOrdinary(page);
  const ordinaryUrl = page.url();
  await page.goto('/daily');
  await page.getByRole('button', { name: '接取今日支线' }).click();
  await expect(page).toHaveURL(/\/executions\//);
  const dailyUrl = page.url();
  expect(dailyUrl).not.toBe(ordinaryUrl);
  await page.clock.setSystemTime(new Date('2026-09-15T16:00:00.000Z'));
  await page.clock.runFor(1500);
  await expect(page.getByText('今日支线已过期，自动放弃；没有发奖或增加完成次数。')).toBeVisible();
  await page.goto(ordinaryUrl);
  await page.getByRole('button', { name: '确认完成（不可撤销）' }).click();
  await expect(page.getByText(/已完成 · \+10 XP/)).toBeVisible();
});

test('two tabs share ordinary slot and react to reset', async ({ page, context }) => {
  await mockContent(page);
  await page.goto('/');
  await expect(page.getByRole('button', { name: '随机一条支线', exact: true })).toBeEnabled();
  const second = await context.newPage();
  await mockContent(second);
  await acceptOrdinary(page);
  await second.goto('/quests/1');
  await second.getByRole('button', { name: '接取普通支线' }).click();
  await expect(second.getByRole('alert')).toContainText('请先完成或放弃');
  await page.goto('/settings');
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: '确认删除个人数据' }).click();
  await expect(second.getByRole('alert')).toContainText('本地数据已重置');
});
