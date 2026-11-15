import { test, expect } from '@playwright/test';
test.beforeEach(async ({ page }) => {
  await page.goto('./');
  await page.getByRole('link', { name: 'Open Personal', exact: true }).click();
});
test('new tasks start collapsed, expand and shrink their own column, and fit live description edits', async ({
  page,
}, info) => {
  const ids = await page.evaluate(async () => {
    const url = '/Spatium/src/model/store.ts';
    const { useStore } = await import(url);
    const s = useStore.getState(),
      panel = s.doc.panelOrder[0];
    const ids = [
      s.createItem('task', panel, { x: 0, y: 120 }, null),
      useStore.getState().createItem('task', panel, { x: 0, y: 180 }, null),
      useStore.getState().createItem('task', panel, { x: 330, y: 180 }, null),
    ];
    useStore.getState().setEditing(null);
    return ids;
  });
  const a = page.locator(`[data-item-id="${ids[0]}"]`),
    b = page.locator(`[data-item-id="${ids[1]}"]`),
    side = page.locator(`[data-item-id="${ids[2]}"]`);
  await expect(
    a.getByRole('button', { name: 'Expand task', exact: true }),
  ).toBeVisible();
  const initial = (await a.boundingBox())!,
    oldB = (await b.boundingBox())!,
    oldSide = (await side.boundingBox())!;
  await a.getByRole('button', { name: 'Expand task', exact: true }).click();
  const expanded = (await a.boundingBox())!;
  expect((await b.boundingBox())!.y - oldB.y).toBeCloseTo(
    expanded.height - initial.height,
  );
  expect((await side.boundingBox())!.y).toBe(oldSide.y);
  await a.locator('.description .editable').click();
  if (info.project.name === 'mobile')
    await a.locator('.description .editable').tap();
  const editor = a.getByRole('textbox', { name: 'Description', exact: true });
  const description =
    'One line\nAnother line\nA third line\nA final line with enough words to wrap over the available card width comfortably.';
  await editor.fill(description);
  await editor.press('Escape');
  const grown = (await a.boundingBox())!;
  expect(grown.height).toBeGreaterThan(expanded.height);
  expect((await b.boundingBox())!.y - oldB.y).toBeCloseTo(
    grown.height - initial.height,
  );
  const clipped = await a
    .locator('.description .editable')
    .evaluate((el) => el.scrollHeight > el.clientHeight + 1);
  expect(clipped).toBe(false);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(a.locator('.description .editable')).toHaveText(
    'Add a description…',
  );
  expect((await b.boundingBox())!.y - oldB.y).toBeCloseTo(
    expanded.height - initial.height,
  );
  await a.getByRole('button', { name: 'Collapse task', exact: true }).click();
  expect((await b.boundingBox())!.y).toBeCloseTo(oldB.y);
});
test('task title defaults and bulk context overrides persist and can be reset', async ({
  page,
}, info) => {
  test.skip(info.project.name !== 'desktop');
  const ids = await page.evaluate(async () => {
    const url = '/Spatium/src/model/store.ts';
    const { useStore } = await import(url);
    const s = useStore.getState(),
      panel = s.doc.panelOrder[0];
    const a = s.createItem('task', panel, { x: 50, y: 150 }, null),
      b = useStore
        .getState()
        .createItem('task', panel, { x: 50, y: 220 }, null);
    useStore.getState().setEditing(null);
    useStore.getState().select([a, b]);
    return [a, b];
  });
  const first = page.locator(`[data-item-id="${ids[0]}"]`);
  await first.click({ button: 'right', position: { x: 5, y: 18 } });
  await page.getByLabel('Selected task title size', { exact: true }).fill('26');
  await page.getByRole('button', { name: 'Apply', exact: true }).click();
  for (const id of ids)
    await expect(page.locator(`[data-item-id="${id}"] .taskTitle`)).toHaveCSS(
      'font-size',
      '26px',
    );
  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  await page.getByLabel('Default task title size', { exact: true }).fill('20');
  await page
    .getByLabel('Default task title size', { exact: true })
    .press('Enter');
  await page
    .getByRole('link', { name: 'Back to panel Personal', exact: true })
    .click();
  await expect(first.locator('.taskTitle')).toHaveCSS('font-size', '26px');
  await first.click({ position: { x: 5, y: 18 } });
  await page
    .locator(`[data-item-id="${ids[1]}"]`)
    .click({ modifiers: ['Shift'], position: { x: 5, y: 18 } });
  await first.click({ button: 'right', position: { x: 5, y: 18 } });
  await page
    .getByRole('button', { name: 'Use default size', exact: true })
    .click();
  for (const id of ids)
    await expect(page.locator(`[data-item-id="${id}"] .taskTitle`)).toHaveCSS(
      'font-size',
      '20px',
    );
  await page.waitForTimeout(500);
  await page.reload();
  await expect(first.locator('.taskTitle')).toHaveCSS('font-size', '20px');
});
test('settings is wider and returns directly to its originating panel by Back and Escape', async ({
  page,
}, info) => {
  const url = page.url();
  if (info.project.name === 'mobile')
    await page.getByLabel('Filters and options').click();
  await page
    .getByRole('link', { name: 'Settings', exact: true })
    .filter({ visible: true })
    .click();
  await expect(
    page.getByRole('link', { name: 'Back to panel Personal', exact: true }),
  ).toBeVisible();
  if (info.project.name === 'desktop')
    expect(
      (await page.locator('.settingsScreen').boundingBox())!.width,
    ).toBeGreaterThan(900);
  const size = page.getByLabel('Default task title size', { exact: true });
  await size.fill('22');
  await size.press('Escape');
  await expect(page.locator('.settingsScreen')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page).toHaveURL(url);
  if (info.project.name === 'mobile')
    await page.getByLabel('Filters and options').click();
  await page
    .getByRole('link', { name: 'Settings', exact: true })
    .filter({ visible: true })
    .click();
  await page
    .getByRole('link', { name: 'Back to panel Personal', exact: true })
    .click();
  await expect(page).toHaveURL(url);
});
test('alignment guides show during task dragging and disappear when alignment is committed', async ({
  page,
}, info) => {
  test.skip(info.project.name !== 'desktop');
  const ids = await page.evaluate(async () => {
    const url = '/Spatium/src/model/store.ts';
    const { useStore } = await import(url);
    const s = useStore.getState(),
      p = s.doc.panelOrder[0];
    const a = s.createItem('task', p, { x: 20, y: 120 }, null),
      b = useStore.getState().createItem('task', p, { x: 400, y: 280 }, null);
    useStore.getState().setEditing(null);
    return [a, b];
  });
  const a = page.locator(`[data-item-id="${ids[0]}"]`),
    b = page.locator(`[data-item-id="${ids[1]}"]`),
    r = (await a.boundingBox())!;
  await page.mouse.move(r.x + 6, r.y + 20);
  await page.mouse.down();
  await page.mouse.move(r.x + 6 + 377, r.y + 20 + 157, { steps: 5 });
  await expect(page.locator('.guide-x')).toBeVisible();
  await expect(page.locator('.guide-y')).toBeVisible();
  await page.mouse.up();
  await expect(page.locator('.alignmentGuide')).toHaveCount(0);
  expect((await a.boundingBox())!.x).toBeCloseTo((await b.boundingBox())!.x);
  expect((await a.boundingBox())!.y).toBeCloseTo((await b.boundingBox())!.y);
});
test('Home is an unboxed reorderable board with exact heading and a floating creation button', async ({
  page,
}, info) => {
  await page.getByRole('link', { name: 'Home', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'my Spatium', exact: true }),
  ).toBeVisible();
  await expect(
    page.locator('.homeIntro,.homeFooter,.newPanelCard'),
  ).toHaveCount(0);
  await expect(page.locator('.panelCard')).toHaveCSS('border-top-width', '0px');
  await expect(
    page.getByRole('button', { name: 'New panel', exact: true }),
  ).toHaveCSS('position', 'fixed');
  if (info.project.name === 'desktop') {
    const columns = await page
      .locator('.panelGrid')
      .evaluate(
        (el) => getComputedStyle(el).gridTemplateColumns.split(' ').length,
      );
    expect(columns).toBe(3);
    const heading = (await page
      .getByRole('heading', { name: 'my Spatium', exact: true })
      .boundingBox())!;
    expect(heading.x + heading.width / 2).toBeCloseTo(720, 0);
  }
  await page.getByRole('button', { name: 'New panel', exact: true }).click();
  await page
    .getByRole('textbox', { name: 'Panel name', exact: true })
    .fill('Second workspace');
  await page
    .getByRole('textbox', { name: 'Panel name', exact: true })
    .press('Enter');
  await expect(
    page.getByRole('link', { name: 'Open Second workspace', exact: true }),
  ).toBeVisible();
  if (info.project.name === 'desktop') {
    const cards = page.locator('.panelCard');
    await cards.nth(1).dragTo(cards.nth(0));
    await expect(page.locator('.panelBoardHeader h2').first()).toHaveText(
      'Second workspace',
    );
  }
});
