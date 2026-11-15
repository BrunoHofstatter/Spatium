import { test, expect, type BrowserContext } from '@playwright/test';
type Snapshot = { document: Record<string, unknown>; revision: number };
const project = 'https://pfomcrdvmrrufutppuwl.supabase.co';
const owner = '11111111-1111-4111-8111-111111111111';
const user = {
  id: owner,
  aud: 'authenticated',
  role: 'authenticated',
  email: 'owner@example.com',
  app_metadata: { provider: 'email', providers: ['email'] },
  user_metadata: {},
  created_at: '2026-11-15T00:00:00Z',
};
function token() {
  const encode = (v: unknown) =>
    Buffer.from(JSON.stringify(v)).toString('base64url');
  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: owner, exp: Math.floor(Date.now() / 1000) + 86400, aud: 'authenticated', role: 'authenticated' })}.test-signature`;
}
async function mock(
  context: BrowserContext,
  cloud: { value: Snapshot | null; fail: boolean },
) {
  await context.route(`${project}/**`, async (route) => {
    const request = route.request(),
      path = new URL(request.url()).pathname;
    if (request.method() === 'OPTIONS') {
      await route.fulfill({
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': '*',
          'Access-Control-Allow-Methods': '*',
        },
      });
      return;
    }
    if (path.startsWith('/auth/v1/token')) {
      await route.fulfill({
        json: {
          access_token: token(),
          refresh_token: 'mock-refresh-token',
          token_type: 'bearer',
          expires_in: 86400,
          user,
        },
      });
      return;
    }
    if (path === '/auth/v1/user') {
      await route.fulfill({ json: user });
      return;
    }
    if (path === '/auth/v1/logout') {
      await route.fulfill({ status: 204 });
      return;
    }
    if (cloud.fail) {
      await route.abort();
      return;
    }
    if (path.endsWith('/spatium_revision')) {
      await route.fulfill({ json: cloud.value?.revision ?? null });
      return;
    }
    if (path.endsWith('/spatium_read')) {
      await route.fulfill({ json: cloud.value });
      return;
    }
    if (path.endsWith('/spatium_save')) {
      const body = request.postDataJSON() as {
        p_document: Record<string, unknown>;
        p_expected_revision: number | null;
      };
      if (body.p_expected_revision !== (cloud.value?.revision ?? null)) {
        await route.fulfill({
          status: 409,
          json: { code: '40001', message: 'Cloud version changed' },
        });
        return;
      }
      cloud.value = {
        document: body.p_document,
        revision: (cloud.value?.revision ?? 0) + 1,
      };
      await route.fulfill({ json: cloud.value });
      return;
    }
    await route.fulfill({
      status: 404,
      json: { message: 'Unexpected mocked endpoint' },
    });
  });
}
async function signIn(page: import('@playwright/test').Page) {
  await page.goto('./#/settings');
  await page.getByLabel('Email', { exact: true }).fill('owner@example.com');
  await page.getByLabel('Password', { exact: true }).fill('test-only-password');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
}
test('first upload, a second device, local views, conflicts, recovery and offline reload', async ({
  page,
  context,
  browser,
}, info) => {
  const cloud: { value: Snapshot | null; fail: boolean } = {
    value: null,
    fail: false,
  };
  await mock(context, cloud);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await signIn(page);
  await page.getByRole('button', { name: 'Start with this device' }).click();
  await expect(
    page.getByRole('status').filter({ hasText: 'Saved to cloud' }),
  ).toBeVisible();
  const second = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: info.project.name === 'mobile',
    hasTouch: info.project.name === 'mobile',
  });
  await mock(second, cloud);
  const phone = await second.newPage();
  try {
    await signIn(phone);
    await expect(
      phone.getByRole('status').filter({ hasText: 'Saved to cloud' }),
    ).toBeVisible();
    await phone.getByRole('link', { name: 'Home', exact: true }).click();
    await phone.getByRole('link', { name: 'Open Personal' }).click();
    await phone.locator('.panelTitle').dblclick();
    const title = phone.getByRole('textbox', {
      name: 'Panel title',
      exact: true,
    });
    await title.fill('Phone project');
    await title.press('Enter');
    await expect
      .poll(() => JSON.stringify(cloud.value?.document))
      .toContain('Phone project');
    await page.getByRole('button', { name: 'Sync now', exact: true }).click();
    await page.getByRole('link', { name: 'Home', exact: true }).click();
    await expect(
      page.getByRole('link', { name: 'Open Phone project', exact: true }),
    ).toBeVisible();
    await page
      .getByRole('link', { name: 'Open Phone project', exact: true })
      .click();
    await page.evaluate(async () => {
      const path = '/Spatium/src/model/store.ts';
      const { useStore } = await import(path);
      const s = useStore.getState();
      s.setViewport(s.doc.panelOrder[0], { x: 222, y: 333, zoom: 2 });
    });
    await page.waitForTimeout(500);
    expect(JSON.stringify(cloud.value?.document)).not.toContain('222');
    cloud.fail = true;
    await page.locator('.panelTitle').dblclick();
    await page
      .getByRole('textbox', { name: 'Panel title', exact: true })
      .fill('Offline PC changes');
    await page
      .getByRole('textbox', { name: 'Panel title', exact: true })
      .press('Enter');
    await page.waitForTimeout(600);
    await page.reload();
    await expect(page.locator('.panelTitle')).toHaveText('Offline PC changes');
    cloud.fail = false;
    await phone.locator('.panelTitle').dblclick();
    await phone
      .getByRole('textbox', { name: 'Panel title', exact: true })
      .fill('Newer phone changes');
    await phone
      .getByRole('textbox', { name: 'Panel title', exact: true })
      .press('Enter');
    await expect
      .poll(() => JSON.stringify(cloud.value?.document))
      .toContain('Newer phone changes');
    await page.getByRole('link', { name: /Sync:/ }).click();
    await page.getByRole('button', { name: 'Sync now', exact: true }).click();
    await expect(
      page.getByRole('group', { name: 'Choose a saved copy' }),
    ).toBeVisible();
    await page
      .getByRole('button', { name: 'Use cloud copy', exact: true })
      .click();
    await expect(page.getByLabel('Recovery copy')).toBeVisible();
    await page
      .getByRole('link', { name: 'Back to panel Newer phone changes' })
      .click();
    await expect(page.locator('.panelTitle')).toHaveText('Newer phone changes');
    await expect(page.locator('.canvasHint b')).toHaveText('200%');
    expect(errors).toEqual([]);
  } finally {
    await second.close();
  }
});

test('wrong password leaves local work usable and does not upload', async ({
  page,
  context,
}) => {
  await context.route(`${project}/auth/v1/token**`, (route) =>
    route.fulfill({
      status: 400,
      json: {
        error: 'invalid_grant',
        error_description: 'Invalid login credentials',
        msg: 'Invalid login credentials',
      },
    }),
  );
  await signIn(page);
  await expect(page.getByRole('alert')).toContainText(
    'Invalid login credentials',
  );
  await page.getByRole('link', { name: 'Home', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Open Personal' })).toBeVisible();
});
