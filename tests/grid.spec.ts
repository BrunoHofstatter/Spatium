import { expect, test, type Page } from '@playwright/test';
test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('./');
  await page.getByRole('link', { name: 'Open Personal', exact: true }).click();
});
async function seed(page: Page, count = 2) {
  return page.evaluate(async (count) => {
    const path = '/Spatium/src/model/store.ts',
      { useStore } = await import(path),
      s = useStore.getState(),
      p = s.doc.panelOrder[0];
    const a = s.createArea(p),
      b = useStore.getState().createArea(p, s.doc.panels[p].columns[1]);
    useStore.getState().updateItem(a, { title: 'Work' });
    useStore.getState().updateItem(b, { title: 'Personal' });
    const ids = [];
    for (let i = 0; i < count; i++) {
      const id = useStore.getState().createTask(a, (i % 2) as 0 | 1);
      useStore.getState().updateItem(id, { title: `Task ${i}` });
      ids.push(id);
    }
    useStore.getState().setEditing(null);
    useStore.getState().select([]);
    return { a, b, ids, p };
  }, count);
}
async function open(page: Page, title = 'Work') {
  await page
    .getByRole('button', { name: `Open area ${title}`, exact: true })
    .click();
  await expect(page.locator('.focusedArea')).toBeVisible();
}
async function database(page: Page, key: string) {
  return page.evaluate(async (key) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const r = indexedDB.open('keyval-store');
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
    try {
      return await new Promise<unknown>((resolve, reject) => {
        const r = db.transaction('keyval').objectStore('keyval').get(key);
        r.onsuccess = () => resolve(r.result);
        r.onerror = () => reject(r.error);
      });
    } finally {
      db.close();
    }
  }, key);
}
test('creates areas and collapsed tasks through the UI, edits inline, persists, and returns by Back', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'Add area', exact: true }).click();
  await page
    .getByRole('textbox', { name: 'Area title', exact: true })
    .fill('My area');
  await page
    .getByRole('textbox', { name: 'Area title', exact: true })
    .press('Enter');
  await page.getByRole('button', { name: 'Add task', exact: true }).click();
  const title = page.getByRole('textbox', { name: 'Task title', exact: true });
  await title.fill('Write the proposal');
  await title.press('Enter');
  await expect(page.locator('.gridTask')).toHaveClass(/collapsedTask/);
  await page.locator('.gridTask .taskTitle').click();
  await expect(page.locator('.description')).toBeVisible();
  await page.locator('.description .editable').click();
  await page
    .getByRole('textbox', { name: 'Description', exact: true })
    .fill('First line\nSecond line');
  await page
    .getByRole('textbox', { name: 'Description', exact: true })
    .press('Escape');
  await page.waitForTimeout(400);
  await page.reload();
  await expect(page.locator('.description')).toHaveText(
    'First line Second line',
  );
  await page
    .getByRole('button', { name: 'Back to panel', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: 'Open area My area' }),
  ).toBeVisible();
  await expect(page.locator('.areaMini .previewTask')).toHaveCount(1);
});
test('expansion pushes only its own column and one-column mode restores remembered membership', async ({
  page,
}) => {
  const { ids } = await seed(page, 4);
  await open(page);
  const task = (id: string) => page.locator(`[data-grid-task="${id}"]`),
    before = (await task(ids[2]).boundingBox())!,
    side = (await task(ids[3]).boundingBox())!;
  await task(ids[0]).locator('.taskTitle').click();
  expect((await task(ids[2]).boundingBox())!.y).toBeGreaterThan(before.y);
  expect((await task(ids[3]).boundingBox())!.y).toBeCloseTo(side.y);
  await page.getByRole('button', { name: 'Task column count' }).click();
  await expect(page.locator('.taskGrid.taskColumns1')).toBeVisible();
  await expect(
    page.locator('.taskColumn').first().locator('[data-grid-task]'),
  ).toHaveCount(4);
  await page.getByRole('button', { name: 'Task column count' }).click();
  await expect(
    page.locator('.taskColumn').nth(0).locator('[data-grid-task]'),
  ).toHaveCount(2);
  await expect(
    page.locator('.taskColumn').nth(1).locator('[data-grid-task]'),
  ).toHaveCount(2);
});
test('bulk selection supports font overrides, moving to another area and undo', async ({
  page,
}) => {
  const { ids } = await seed(page);
  await open(page);
  await page.getByRole('button', { name: 'Select more', exact: true }).click();
  for (const id of ids)
    await page.locator(`[data-grid-task="${id}"] .taskTitle`).click();
  await expect(
    page.getByRole('status').filter({ hasText: '2 selected' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Finish selection' }).click();
  await page.getByRole('button', { name: 'Actions', exact: true }).click();
  await page.getByRole('button', { name: 'Title size', exact: true }).click();
  await page.getByLabel('Selected task title size', { exact: true }).fill('24');
  await page.getByRole('button', { name: 'Apply', exact: true }).click();
  for (const id of ids)
    await expect(page.locator(`[data-grid-task="${id}"] .taskTitle`)).toHaveCSS(
      'font-size',
      '24px',
    );
  await page.getByRole('button', { name: 'Actions', exact: true }).click();
  await page.getByRole('button', { name: 'Move to…', exact: true }).click();
  await page.getByRole('button', { name: 'Personal', exact: true }).click();
  await expect(page.locator('[data-grid-task]')).toHaveCount(0);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page.locator('[data-grid-task]')).toHaveCount(2);
});
test('subtasks, explicit state choices, Hide Done and highlights remain available', async ({
  page,
}, info) => {
  await seed(page);
  await open(page);
  const first = page.locator('[data-grid-task]').first();
  await first.getByRole('button', { name: /Actions for task/ }).click();
  await page.getByRole('button', { name: 'Add subtask', exact: true }).click();
  await page
    .getByRole('textbox', { name: 'Subtask title', exact: true })
    .fill('Check it');
  await page
    .getByRole('textbox', { name: 'Subtask title', exact: true })
    .press('Escape');
  await first
    .getByRole('button', { name: 'Subtask state: Blank', exact: true })
    .press('Enter');
  await page
    .locator('.stateMenu')
    .getByRole('button', { name: 'Done', exact: true })
    .click();
  await expect(first.locator('.subtaskToggle')).toContainText('1/1');
  if (info.project.name === 'mobile')
    await page.getByLabel('Filters and options').click();
  await page
    .getByRole('checkbox', { name: 'Hide Done', exact: true })
    .filter({ visible: true })
    .check();
  await expect(first.locator('.subtask')).toHaveCount(0);
  await page
    .getByRole('button', { name: 'Blank', exact: true })
    .filter({ visible: true })
    .click();
  await expect(first).toHaveClass(/matched/);
});
test('desktop state click patterns and settings return to the opened area', async ({
  page,
}, info) => {
  test.skip(info.project.name !== 'desktop');
  await seed(page);
  await open(page);
  const first = page.locator('[data-grid-task]').first(),
    dot = first.getByRole('button', { name: 'Task state: Blank', exact: true });
  await dot.click();
  await expect(first).toHaveClass(/done/);
  await first.locator('.stateDot').dblclick();
  await expect(first.locator('.stateDot')).toHaveAttribute(
    'aria-label',
    'Task state: In Progress',
  );
  await first.locator('.stateDot').click({ button: 'right' });
  await expect(first.locator('.stateDot')).toHaveAttribute(
    'aria-label',
    'Task state: Blank',
  );
  await first.locator('.stateDot').dblclick({ button: 'right' });
  await expect(first.locator('.stateDot')).toHaveAttribute(
    'aria-label',
    'Task state: Delayed',
  );
  const url = page.url();
  await page
    .getByRole('link', { name: 'Settings', exact: true })
    .filter({ visible: true })
    .click();
  await page
    .getByRole('link', { name: 'Back to panel Personal', exact: true })
    .click();
  await expect(page).toHaveURL(url);
});
test('mouse drag places areas and tasks in chosen columns and creates columns only by dragging', async ({
  page,
}, info) => {
  test.skip(info.project.name !== 'desktop');
  const { a, ids } = await seed(page);
  const area = page.locator(`[data-grid-area="${a}"]`),
    r = (await area.locator('h2').boundingBox())!;
  await page.mouse.move(r.x + 30, r.y + 15);
  await page.mouse.down();
  await page.mouse.move(r.x + 50, r.y + 20);
  const target = (await page
    .locator('[data-drop-column="new"]')
    .boundingBox())!;
  await page.mouse.move(target.x + target.width / 2, target.y + 60, {
    steps: 6,
  });
  await page.mouse.up();
  await expect(page.locator('.boardColumn')).toHaveCount(3);
  await expect(
    page.locator('.boardColumn').nth(2).locator(`[data-grid-area="${a}"]`),
  ).toBeVisible();
  await open(page);
  const first = page.locator(`[data-grid-task="${ids[0]}"] .taskTitle`),
    tr = (await first.boundingBox())!,
    dest = (await page.locator('.taskColumn').nth(1).boundingBox())!;
  await page.mouse.move(tr.x + 10, tr.y + 10);
  await page.mouse.down();
  await page.mouse.move(dest.x + 30, dest.y + 4, { steps: 8 });
  await page.mouse.up();
  await expect(
    page.locator('.taskColumn').nth(1).locator('[data-grid-task]'),
  ).toHaveCount(2);
  await expect(page.locator('.description')).toHaveCount(0);
});
test('touch hold reorders while an ordinary swipe scrolls, and left-edge swipe returns to the board', async ({
  page,
  context,
}, info) => {
  test.skip(info.project.name !== 'mobile');
  await seed(page, 24);
  await open(page);
  const cdp = await context.newCDPSession(page),
    first = (await page
      .locator('[data-grid-task] .taskTitle')
      .first()
      .boundingBox())!,
    other = (await page.locator('.taskColumn').nth(1).boundingBox())!;
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: first.x + 15, y: first.y + 10 }],
  });
  await expect(page.locator('.gridDragGhost')).toBeVisible();
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [{ x: other.x + 30, y: other.y + 5 }],
  });
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: [],
  });
  await expect(
    page.locator('.taskColumn').nth(1).locator('[data-grid-task]'),
  ).toHaveCount(13);
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: 300, y: 600 }],
  });
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [{ x: 300, y: 350 }],
  });
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: [],
  });
  await expect
    .poll(() => page.locator('.areaScroll').evaluate((el) => el.scrollTop))
    .toBeGreaterThan(20);
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: 5, y: 260 }],
  });
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [{ x: 110, y: 262 }],
  });
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: [],
  });
  await expect(page.locator('.panelBoard')).toBeVisible();
});
test('migrates saved writing, pins the original backup before writing v4, and never overwrites that backup', async ({
  page,
}) => {
  const original = await page.evaluate(async () => {
    const path = '/Spatium/src/model/legacy.fixture.ts',
      { legacyFixture } = await import(path),
      raw = legacyFixture();
    const db = await new Promise<IDBDatabase>((resolve) => {
      const r = indexedDB.open('keyval-store');
      r.onsuccess = () => resolve(r.result);
    });
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('keyval', 'readwrite');
      tx.objectStore('keyval').put(raw, 'spatium-document');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
    return raw;
  });
  await page.reload();
  await page.getByRole('link', { name: 'Open Project', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Open area Parent › Child', exact: true }),
  ).toBeVisible();
  await expect
    .poll(async () => await database(page, 'spatium-before-grid-v4'))
    .toEqual(original);
  await expect
    .poll(
      async () =>
        (
          (await database(page, 'spatium-document')) as {
            schemaVersion: number;
          }
        )?.schemaVersion,
    )
    .toBe(4);
  await open(page, 'Parent › Child');
  await expect(page.locator('.description')).toHaveText(
    'First line Second line',
  );
  await page.reload();
  expect(await database(page, 'spatium-before-grid-v4')).toEqual(original);
});
test('unsupported saved documents are left intact', async ({ page }) => {
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve) => {
      const r = indexedDB.open('keyval-store');
      r.onsuccess = () => resolve(r.result);
    });
    await new Promise<void>((resolve) => {
      const tx = db.transaction('keyval', 'readwrite');
      tx.objectStore('keyval').put(
        { schemaVersion: 99, writing: 'Do not overwrite' },
        'spatium-document',
      );
      tx.oncomplete = () => resolve();
    });
    db.close();
  });
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'Your saved work needs attention' }),
  ).toBeVisible();
  expect(await database(page, 'spatium-document')).toEqual({
    schemaVersion: 99,
    writing: 'Do not overwrite',
  });
});
test('renders a large board and returns to its scroll position without changing item placement', async ({
  page,
}) => {
  await seed(page);
  await page.evaluate(async () => {
    const path = '/Spatium/src/model/store.ts',
      { useStore } = await import(path),
      s = useStore.getState(),
      p = s.doc.panelOrder[0];
    for (let i = 0; i < 12; i++) {
      const a = useStore.getState().createArea(p);
      for (let t = 0; t < 12; t++) useStore.getState().createTask(a);
    }
    useStore.getState().setEditing(null);
    useStore.getState().select([]);
  });
  const board = page.locator('.boardScroll');
  await board.evaluate((el) => (el.scrollTop = 450));
  await expect
    .poll(() => board.evaluate((el) => el.scrollTop))
    .toBeGreaterThan(400);
  const target = page
    .locator('[data-grid-area]')
    .filter({ visible: true })
    .nth(2);
  await target.locator('h2').scrollIntoViewIfNeeded();
  const position = await board.evaluate((el) => el.scrollTop);
  await target.locator('h2').click();
  await page
    .getByRole('button', { name: 'Back to panel', exact: true })
    .click();
  await expect
    .poll(() => board.evaluate((el) => el.scrollTop))
    .toBeCloseTo(position, 0);
});

test('animated navigation and responsive board/task layout remain usable', async ({
  page,
}, info) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await seed(page, 6);
  await page.screenshot({
    path: `test-results/board-${info.project.name}.png`,
    animations: 'disabled',
  });
  await open(page);
  await expect(
    page.getByRole('button', { name: 'Add task', exact: true }),
  ).toBeVisible();
  const overflow = await page
    .locator('.areaScroll')
    .evaluate((el) => el.scrollWidth > el.clientWidth);
  expect(overflow).toBe(false);
  const first = page.locator('[data-grid-task]').first();
  await first.locator('.taskTitle').click();
  await first.locator('.description .editable').click();
  await first
    .getByRole('textbox', { name: 'Description', exact: true })
    .fill(
      'This description grows naturally within its own column.\nOther tasks keep their place.',
    );
  await first
    .getByRole('textbox', { name: 'Description', exact: true })
    .press('Escape');
  await page.screenshot({
    path: `test-results/focused-${info.project.name}.png`,
    animations: 'disabled',
  });
  await page
    .getByRole('button', { name: 'Back to panel', exact: true })
    .click();
  await expect(page.locator('.panelBoard')).toBeVisible();
});
