import { test, expect, type Page } from '@playwright/test';
async function seed(page: Page, type: 'task' | 'area') {
  await page.evaluate(async (type) => {
    const url = '/Spatium/src/model/store.ts';
    const { useStore } = await import(url);
    const s = useStore.getState();
    const id = s.createItem(
      type,
      s.doc.panelOrder[0],
      { x: 160, y: 180 },
      null,
    );
    useStore.getState().setEditing(null);
    return id;
  }, type);
}
test.beforeEach(async ({ page }) => {
  await page.goto('./');
  await page.getByRole('link', { name: 'Open Personal' }).click();
});

test('collapsed tasks keep a title row, progress ring and remembered expanded content', async ({
  page,
}, info) => {
  await page.evaluate(async () => {
    const url = '/Spatium/src/model/store.ts';
    const { useStore } = await import(url);
    const s = useStore.getState();
    const id = s.createItem(
      'task',
      s.doc.panelOrder[0],
      { x: -20, y: 160 },
      null,
    );
    const sub = useStore.getState().addSubtask(id);
    useStore.getState().updateSubtask(id, sub, { state: 'done' });
    useStore.getState().updateItem(id, { description: 'Remember this' });
    useStore.getState().setEditing(null);
  });
  const before = (await page.locator('.task').boundingBox())!;
  await page
    .getByRole('button', { name: 'Collapse task', exact: true })
    .click();
  expect((await page.locator('.task').boundingBox())!.height).toBe(40);
  await expect(
    page.locator('.description,.subtaskToggle,.subtasks'),
  ).toHaveCount(0);
  await expect(
    page.getByRole('img', { name: '1 of 1 subtasks done' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Expand task', exact: true }).click();
  expect((await page.locator('.task').boundingBox())!.height).toBe(
    before.height,
  );
  await expect(page.locator('.description')).toHaveText('Remember this');
  await expect(page.locator('.subtasks')).toBeVisible();
  await page
    .getByRole('button', { name: 'Collapse task', exact: true })
    .click();
  if (info.project.name === 'mobile')
    await page.getByRole('button', { name: 'More', exact: true }).click();
  await page
    .locator(
      info.project.name === 'mobile' ? '.actionSheet' : '.selectionToolbar',
    )
    .getByRole('button', { name: 'Subtasks', exact: true })
    .click();
  await expect(page.locator('.subtasks')).toBeVisible();
});

test('description editing preserves typography and Escape commits paragraphs', async ({
  page,
}) => {
  await page.evaluate(async () => {
    const url = '/Spatium/src/model/store.ts';
    const { useStore } = await import(url);
    const s = useStore.getState();
    const id = s.createItem(
      'task',
      s.doc.panelOrder[0],
      { x: -20, y: 160 },
      null,
    );
    useStore.getState().updateItem(id, { collapsed: false });
    useStore.getState().setEditing(null);
  });
  const font = await page
    .locator('.description .editable')
    .evaluate((el) => getComputedStyle(el).fontSize);
  await page.locator('.description .editable').click();
  const editor = page.getByRole('textbox', {
    name: 'Description',
    exact: true,
  });
  await expect(editor).toHaveCSS('font-size', font);
  await expect(editor).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  await expect(editor).toHaveCSS('border-top-width', '0px');
  await editor.fill('First line');
  await editor.press('Enter');
  await editor.pressSequentially('Second line');
  await editor.press('Escape');
  await expect(editor).toHaveCount(0);
  await expect(page.locator('.description .editable')).toHaveText(
    'First line\nSecond line',
  );
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page.locator('.description .editable')).toHaveText(
    'Add a description…',
  );
});

test('four mouse patterns apply one direct state change each', async ({
  page,
}, info) => {
  test.skip(info.project.name !== 'desktop');
  await seed(page, 'task');
  const dot = page.locator('.taskHeading .stateDot');
  await dot.click();
  await expect(dot).toHaveAttribute('aria-label', 'Task state: Done');
  await dot.dblclick();
  await expect(dot).toHaveAttribute('aria-label', 'Task state: In Progress');
  await page.waitForTimeout(400);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(dot).toHaveAttribute('aria-label', 'Task state: Done');
  await dot.click({ button: 'right' });
  await expect(dot).toHaveAttribute('aria-label', 'Task state: Blank');
  await dot.dblclick({ button: 'right' });
  await expect(dot).toHaveAttribute('aria-label', 'Task state: Delayed');
  await expect(page.locator('.contextCreateMenu,.stateMenu')).toHaveCount(0);
});

test('state-control setting persists and exposes four direct choices', async ({
  page,
}, info) => {
  test.skip(info.project.name !== 'desktop');
  await seed(page, 'task');
  const panelUrl = page.url();
  await page.goto('./#/settings');
  await page
    .getByLabel('Task state control', { exact: true })
    .selectOption('choices');
  await page.waitForTimeout(500);
  await page.goto(panelUrl);
  await page.locator('.task').click({ position: { x: 5, y: 15 } });
  for (const state of ['Done', 'Delayed', 'In Progress', 'Blank']) {
    await page
      .getByRole('button', { name: `Set task state to ${state}`, exact: true })
      .click();
    await expect(page.locator('.taskHeading .stateDot')).toHaveAttribute(
      'aria-label',
      `Task state: ${state}`,
    );
  }
  await page.reload();
  await page.locator('.taskHeading .stateDot').hover();
  await expect(
    page.getByRole('button', { name: 'Set task state to Done', exact: true }),
  ).toBeVisible();
});

test('empty-space context creation uses the pointer and the innermost group', async ({
  page,
}, info) => {
  test.skip(info.project.name !== 'desktop');
  await seed(page, 'area');
  const area = (await page.locator('.area').boundingBox())!;
  const point = { x: area.x + 60, y: area.y + 100 };
  await page.mouse.click(point.x, point.y, { button: 'right' });
  await page.getByRole('button', { name: 'Note', exact: true }).click();
  await page
    .getByRole('textbox', { name: 'Note', exact: true })
    .fill('At the pointer');
  await page
    .getByRole('textbox', { name: 'Note', exact: true })
    .press('Escape');
  const note = (await page.locator('.areaContent .note').boundingBox())!;
  expect(note.x).toBeCloseTo(point.x);
  expect(note.y).toBeCloseTo(point.y);
  await expect(page.locator('.canvas')).toHaveCSS('background-image', 'none');
  await expect(page.getByRole('button', { name: 'Snap to grid' })).toHaveCount(
    0,
  );
});

test('area headings sit outside the group, resize by handle and scale gently', async ({
  page,
}, info) => {
  test.skip(info.project.name !== 'desktop');
  await seed(page, 'area');
  const area = page.locator('.area'),
    header = page.locator('.areaHeader'),
    before = (await header.boundingBox())!,
    body = (await area.boundingBox())!;
  expect(before.y + before.height).toBeLessThan(body.y);
  const handle = (await page.locator('.titleResizeHandle').boundingBox())!;
  await page.mouse.move(handle.x + 5, handle.y + 5);
  await page.mouse.down();
  await page.mouse.move(handle.x + 55, handle.y + 35, { steps: 5 });
  await page.mouse.up();
  const larger = (await header.boundingBox())!;
  expect(larger.height).toBeGreaterThan(before.height);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  expect((await header.boundingBox())!.height).toBeCloseTo(before.height);
  await page.evaluate(async () => {
    const url = '/Spatium/src/model/store.ts';
    const { useStore } = await import(url);
    const s = useStore.getState();
    s.setViewport(s.doc.panelOrder[0], { x: 100, y: 100, zoom: 0.25 });
  });
  const smaller = (await header.boundingBox())!;
  expect(smaller.height / before.height).toBeGreaterThan(0.4);
  expect(smaller.height / before.height).toBeLessThan(0.9);
});

test('focus fits an area from its button and double middle-click', async ({
  page,
}, info) => {
  test.skip(info.project.name !== 'desktop');
  await seed(page, 'area');
  const initial = await page.locator('.world').getAttribute('style');
  await page.getByRole('button', { name: 'Focus area', exact: true }).click();
  await expect(page.locator('.world')).not.toHaveAttribute('style', initial!);
  const canvas = (await page.locator('.canvas').boundingBox())!,
    area = (await page.locator('.area').boundingBox())!,
    header = (await page.locator('.areaHeader').boundingBox())!;
  expect(header.y).toBeGreaterThanOrEqual(canvas.y + 20);
  expect(area.y + area.height).toBeLessThanOrEqual(
    canvas.y + canvas.height - 20,
  );
  await page.evaluate(async () => {
    const url = '/Spatium/src/model/store.ts';
    const { useStore } = await import(url);
    const s = useStore.getState();
    s.setViewport(s.doc.panelOrder[0], { x: 80, y: 80, zoom: 1 });
  });
  const rect = (await page.locator('.areaHeader .editable').boundingBox())!;
  await page.mouse.click(rect.x + 30, rect.y + 10, { button: 'middle' });
  await page.mouse.click(rect.x + 30, rect.y + 10, { button: 'middle' });
  await expect(page.locator('.canvasHint b')).not.toHaveText('100%');
});

test('right-to-left crossing selects partial items, left-to-right requires containment', async ({
  page,
}, info) => {
  test.skip(info.project.name !== 'desktop');
  await seed(page, 'task');
  await page.locator('.canvas').click({ position: { x: 20, y: 40 } });
  const rect = (await page.locator('.task').boundingBox())!;
  const a = { x: rect.x - 20, y: rect.y - 20 },
    b = { x: rect.x + 80, y: rect.y + rect.height + 20 };
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(b.x, b.y, { steps: 5 });
  await page.mouse.up();
  await expect(page.locator('.task')).not.toHaveClass(/selected/);
  await page.mouse.move(b.x, b.y);
  await page.mouse.down();
  await page.mouse.move(a.x, a.y, { steps: 5 });
  await expect(page.locator('.crossingSelection')).toBeVisible();
  await page.mouse.up();
  await expect(page.locator('.task')).toHaveClass(/selected/);
});

test('legacy saved panels migrate without losing item positions or task fields', async ({
  page,
}) => {
  await page.evaluate(async () => {
    const url = '/Spatium/src/model/store.ts';
    const { useStore } = await import(url);
    const s = useStore.getState(),
      panel = s.doc.panelOrder[0];
    const area = s.createItem('area', panel, { x: 120, y: 180 }, null);
    const task = useStore
      .getState()
      .createItem('task', panel, { x: 180, y: 260 }, area);
    useStore.getState().updateItem(task, {
      title: 'Existing work',
      description: 'Keep this',
      important: true,
    });
    useStore.getState().setEditing(null);
    const old = JSON.parse(JSON.stringify(useStore.getState().doc));
    old.schemaVersion = 1;
    delete old.items[area].fontSize;
    delete old.items[task].collapsed;
    delete old.settings.stateControl;
    old.settings.gridSnap = true;
    old.settings.gridSize = 20;
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('keyval-store');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction('keyval', 'readwrite');
        tx.objectStore('keyval').put(old, 'spatium-document');
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } finally {
      db.close();
    }
  });
  await page.reload();
  await expect(page.locator('.taskTitle')).toHaveText('Existing work');
  await expect(page.locator('.description')).toHaveText('Keep this');
  await expect(page.locator('.taskHeading .star')).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  const canvas = (await page.locator('.canvas').boundingBox())!,
    task = (await page.locator('.task').boundingBox())!;
  expect(task.x - canvas.x).toBeCloseTo(260);
  expect(task.y - canvas.y).toBeCloseTo(340);
  await expect(page.locator('.areaHeader')).toHaveCSS('font-size', '24px');
  await expect(page.locator('.canvas')).toHaveCSS('background-image', 'none');
});

test('pending state clicks are included when the app backgrounds', async ({
  page,
}, info) => {
  test.skip(info.project.name !== 'desktop');
  await seed(page, 'task');
  await page.locator('.taskHeading .stateDot').click();
  await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
  await expect(page.locator('.taskHeading .stateDot')).toHaveAttribute(
    'aria-label',
    'Task state: Done',
  );
  await page.waitForTimeout(400);
  await page.reload();
  await expect(page.locator('.taskHeading .stateDot')).toHaveAttribute(
    'aria-label',
    'Task state: Done',
  );
});
