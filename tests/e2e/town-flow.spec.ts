import { expect, test, type Page } from '@playwright/test';
import { EXAMPLE_QUEST } from '../../packages/contracts/src/example';
const tasks = ['1', '2', '3'].map((questId, i) => ({
  ...EXAMPLE_QUEST,
  title: ['在窗边发现三种颜色', '留意生活里的小细节', '换个角度看看日常'][i]!,
  questId,
  versionId: `${questId}:1`,
  publishedAt: '2026-09-15T00:00:00Z',
}));
async function content(page: Page, empty = false) {
  await page.clock.install({ time: new Date('2026-09-15T08:00:00Z') });
  await page.route('**/api/public/catalog', (route) =>
    route.fulfill({
      json: {
        schemaVersion: 1,
        revision: '1',
        serverTime: '2026-09-15T08:00:00Z',
        expiresAt: '2026-09-16T08:00:00Z',
        tasks: empty ? [] : tasks,
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
        serverTime: '2026-09-15T08:00:00Z',
        snapshot: empty ? null : tasks[0],
      },
    }),
  );
}
for (const width of [1280, 375]) {
  test(`home journey, stable recommendation, post-completion record and layouts at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await content(page);
    await page.goto('/');
    await expect(page.getByRole('button', { name: '接取支线', exact: true })).toBeVisible();
    const title = await page.locator('.quest-card h2').innerText();
    await page.clock.runFor(2000);
    await page.getByRole('link', { name: '角色卡', exact: true }).click();
    await page.getByRole('link', { name: '发现', exact: true }).click();
    await expect(page.locator('.quest-card h2')).toHaveText(title);
    await page.reload();
    await expect(page.locator('.quest-card h2')).toHaveText(title);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: `docs/validation/images/town-recommended-${width}.png`,
      fullPage: true,
    });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: `docs/validation/images/town-first-screen-${width}.png` });
    const primary = await page.getByRole('button', { name: '接取支线', exact: true }).boundingBox();
    expect(primary!.y + primary!.height).toBeLessThan(900 - (width < 640 ? 60 : 0));
    await page.getByRole('button', { name: '换一条', exact: true }).click();
    await expect(page.locator('.quest-card h2')).not.toHaveText(title);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    const acceptedTitle = await page.locator('.quest-card h2').innerText();
    await page.getByRole('button', { name: '接取支线', exact: true }).click();
    await expect(page.getByRole('button', { name: '我完成了', exact: true })).toBeVisible();
    await page.reload();
    await expect(page.locator('.quest-card h2')).toHaveText(acceptedTitle);
    await expect(page.getByRole('heading', { name: '进行中的支线', exact: true })).toBeVisible();
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: `docs/validation/images/town-active-${width}.png`,
      fullPage: true,
    });
    // Same-event duplicate dispatch exercises the synchronous submission lock.
    await page.getByRole('button', { name: '我完成了', exact: true }).evaluate((button) => {
      (button as HTMLButtonElement).click();
      (button as HTMLButtonElement).click();
    });
    await expect(page.getByText('已完成 · +10 XP', { exact: true })).toBeVisible();
    await expect(page.getByRole('textbox')).toHaveCount(0);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: `docs/validation/images/town-completed-${width}.png`,
      fullPage: true,
    });
    await page.getByRole('button', { name: '记一句 / 添加照片', exact: true }).click();
    await page.getByLabel('一句记录（可跳过）').fill('窗外的日常，也有新发现。');
    await page
      .getByLabel('照片（可跳过，仅保存在本机）')
      .setInputFiles('apps/web/public/art/town-dusk.png');
    await expect(page.getByText(/已准备照片/)).toBeVisible();
    await page.getByRole('button', { name: '保存记录', exact: true }).click();
    await expect(page.getByText('记录已保存，奖励保持不变。')).toBeVisible();
    await expect(page.getByRole('img', { name: '这次经历的私人照片' })).toBeVisible();
    await page.getByRole('button', { name: '发现下一条', exact: true }).click();
    await expect(page.getByRole('button', { name: '接取支线', exact: true })).toBeVisible();
    await page.getByRole('link', { name: '我的支线', exact: true }).click();
    await page.getByRole('button', { name: '已完成', exact: true }).click();
    await expect(page.locator('.grid .card')).toHaveCount(1);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: `docs/validation/images/town-journal-${width}.png`,
      fullPage: true,
    });
    await page.getByRole('link', { name: '角色卡', exact: true }).click();
    await expect(page.getByText('10 XP · 1 次完成', { exact: true })).toBeVisible();
    await expect(page.getByText('窗外的日常，也有新发现。')).toBeVisible();
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: `docs/validation/images/town-profile-${width}.png`,
      fullPage: true,
    });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.getByRole('link', { name: '设置', exact: true }).click();
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: `docs/validation/images/town-settings-${width}.png`,
      fullPage: true,
    });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });
}
test('ordinary takes priority with a visible daily switch, journal completes without a form', async ({
  page,
}) => {
  await content(page);
  await page.goto('/');
  await page.getByRole('button', { name: '接取支线', exact: true }).click();
  await page.getByRole('link', { name: /今日支线/ }).click();
  await page.getByRole('button', { name: '接取今日支线', exact: true }).click();
  await expect(page).toHaveURL(/\/executions\//);
  await expect(page.getByRole('button', { name: '我完成了', exact: true })).toBeVisible();
  await page.goto('/');
  await expect(page.getByRole('button', { name: /^普通支线 ·/ })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByRole('button', { name: /^今日支线 ·/ }).click();
  await expect(page.getByRole('button', { name: /^今日支线 ·/ })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.goto('/quests');
  await expect(page.getByRole('button', { name: '我完成了', exact: true })).toHaveCount(2);
  await page.getByRole('button', { name: '我完成了', exact: true }).first().click();
  await expect(page.getByText('已完成 · +10 XP', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '我完成了', exact: true })).toHaveCount(1);
});
test('empty content, reduced motion and keyboard navigation stay usable', async ({ page }) => {
  await content(page, true);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '小镇正在准备新的支线' })).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: '跳至主要内容' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('main')).toBeFocused();
  await page.goto('/quests');
  await expect(page.getByRole('link', { name: '发现一条支线' })).toBeVisible();
});

test('failed completion rolls back, shows no reward and can retry safely', async ({ page }) => {
  await content(page);
  await page.goto('/');
  await page.getByRole('button', { name: '接取支线', exact: true }).click();
  await expect(page.getByRole('button', { name: '我完成了', exact: true })).toBeVisible();
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.add;
    IDBObjectStore.prototype.add = function (...args) {
      if (this.name === 'xp') {
        IDBObjectStore.prototype.add = original;
        this.transaction.abort();
        throw new DOMException('模拟存储写入失败', 'QuotaExceededError');
      }
      return original.apply(this, args);
    };
  });
  await page.getByRole('button', { name: '我完成了', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('未保存成功，请重试');
  await expect(page.getByText('已完成 · +10 XP', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '我完成了', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: '我完成了', exact: true }).click();
  await expect(page.getByText('已完成 · +10 XP', { exact: true })).toBeVisible();
  await page.goto('/profile');
  await expect(page.getByText('10 XP · 1 次完成', { exact: true })).toBeVisible();
});
