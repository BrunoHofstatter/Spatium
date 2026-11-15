import { expect, test, type Page } from '@playwright/test';

test.beforeEach(async ({ page }, info) => {
  test.skip(info.project.name !== 'mobile');
  await page.goto('./');
  await page.getByRole('link', { name: 'Open Personal', exact: true }).click();
});
async function seed(page: Page) {
  return page.evaluate(async () => {
    const url = '/Spatium/src/model/store.ts',
      { useStore } = await import(url);
    const s = useStore.getState(),
      p = s.doc.panelOrder[0];
    const a = s.createItem('task', p, { x: -40, y: 60 }, null),
      b = useStore.getState().createItem('task', p, { x: -40, y: 150 }, null);
    useStore.getState().setEditing(null);
    useStore.getState().select([]);
    return [a, b];
  });
}
test('touch selection mode toggles membership, protects card controls, and exposes bulk typography', async ({
  page,
}) => {
  const [a, b] = await seed(page);
  const first = page.locator(`[data-item-id="${a}"]`),
    second = page.locator(`[data-item-id="${b}"]`);
  await first.locator('.taskTitle').tap();
  await expect(first.getByRole('textbox')).toHaveCount(0);
  await page.getByRole('button', { name: 'More', exact: true }).tap();
  await page.getByRole('button', { name: 'Select more', exact: true }).tap();
  await second.locator('.taskTitle').tap();
  await expect(page.getByRole('status')).toHaveText('2 selected');
  await first.locator('.stateDot').tap();
  await expect(page.getByRole('status')).toHaveText('1 selected');
  await expect(page.locator('.stateMenu')).toHaveCount(0);
  await first.locator('.taskTitle').tap();
  await page
    .getByRole('button', { name: 'Finish selection', exact: true })
    .tap();
  await page.getByRole('button', { name: 'More', exact: true }).tap();
  await page.getByRole('button', { name: 'Title size', exact: true }).tap();
  await page
    .getByRole('button', {
      name: 'Increase selected task title size',
      exact: true,
    })
    .tap();
  await expect(
    page.getByLabel('Selected task title size', { exact: true }),
  ).toHaveValue('17');
  await page.getByRole('button', { name: 'Apply', exact: true }).tap();
  await expect(first.locator('.taskTitle')).toHaveCSS('font-size', '17px');
  await expect(second.locator('.taskTitle')).toHaveCSS('font-size', '17px');
  await page.getByRole('button', { name: 'Undo', exact: true }).tap();
  await expect(first.locator('.taskTitle')).toHaveCSS('font-size', '16px');
  await expect(second.locator('.taskTitle')).toHaveCSS('font-size', '16px');
});
test('selection survives two-finger navigation and the finished group drags and undoes together', async ({
  page,
  context,
}) => {
  const [a, b] = await seed(page);
  const first = page.locator(`[data-item-id="${a}"]`),
    second = page.locator(`[data-item-id="${b}"]`);
  await first.locator('.taskTitle').tap();
  await page.getByRole('button', { name: 'More', exact: true }).tap();
  await page.getByRole('button', { name: 'Select more', exact: true }).tap();
  await second.locator('.taskTitle').tap();
  const cdp = await context.newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [
      { x: 100, y: 220, id: 1 },
      { x: 220, y: 300, id: 2 },
    ],
  });
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [
      { x: 110, y: 235, id: 1 },
      { x: 230, y: 315, id: 2 },
    ],
  });
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: [],
  });
  await expect(page.getByRole('status')).toHaveText('2 selected');
  await page
    .getByRole('button', { name: 'Finish selection', exact: true })
    .tap();
  const beforeA = (await first.boundingBox())!,
    beforeB = (await second.boundingBox())!;
  const start = { x: beforeA.x + 100, y: beforeA.y + 20 };
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [start],
  });
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [{ x: start.x + 30, y: start.y + 40 }],
  });
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: [],
  });
  expect((await first.boundingBox())!.x - beforeA.x).toBeCloseTo(30);
  expect((await second.boundingBox())!.y - beforeB.y).toBeCloseTo(40);
  await expect(page.locator('.textEditor')).toHaveCount(0);
  await page.getByRole('button', { name: 'Undo', exact: true }).tap();
  expect((await first.boundingBox())!.x).toBeCloseTo(beforeA.x);
  expect((await second.boundingBox())!.y).toBeCloseTo(beforeB.y);
});

test('first description tap selects, subsequent tap edits, and Done commits one live-edit session', async ({
  page,
}) => {
  const [a] = await seed(page);
  await page.evaluate(async (id) => {
    const url = '/Spatium/src/model/store.ts',
      { useStore } = await import(url);
    useStore.getState().updateItem(id, { collapsed: false });
  }, a);
  const task = page.locator(`[data-item-id="${a}"]`),
    description = task.locator('.description .editable');
  await description.tap();
  await expect(task).toHaveClass(/selected/);
  await expect(
    task.getByRole('textbox', { name: 'Description', exact: true }),
  ).toHaveCount(0);
  await description.tap();
  const editor = task.getByRole('textbox', {
    name: 'Description',
    exact: true,
  });
  await editor.fill('A first line\nA second line');
  await expect(page.locator('.selectionToolbar')).toBeHidden();
  await page.getByRole('button', { name: 'Done editing', exact: true }).tap();
  await expect(description).toHaveText('A first line A second line');
  await page.getByRole('button', { name: 'Undo', exact: true }).tap();
  await expect(description).toHaveText('Add a description…');
});
test('editing follows a constrained visual viewport and restores the automatic reading view', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const viewport = Object.assign(new EventTarget(), {
      width: window.innerWidth,
      height: window.innerHeight,
      offsetLeft: 0,
      offsetTop: 0,
      pageLeft: 0,
      pageTop: 0,
      scale: 1,
    });
    Object.defineProperty(window, 'visualViewport', {
      configurable: true,
      value: viewport,
    });
  });
  await page.reload();
  const [a] = await seed(page);
  await page.evaluate(async (id) => {
    const url = '/Spatium/src/model/store.ts',
      { useStore } = await import(url),
      s = useStore.getState();
    s.updateItem(id, { collapsed: false });
    s.setViewport(s.doc.panelOrder[0], { x: 80, y: 80, zoom: 0.5 });
    s.select([id]);
  }, a);
  const before = await page.locator('.world').getAttribute('style');
  await page.getByRole('button', { name: 'Edit', exact: true }).tap();
  await page.evaluate(() => {
    Object.assign(window.visualViewport!, { height: 320 });
    window.visualViewport!.dispatchEvent(new Event('resize'));
  });
  await expect(page.locator('.canvasHint b')).toHaveText('100%');
  const done = page.getByRole('button', { name: 'Done editing', exact: true });
  expect(
    (await done.boundingBox())!.y + (await done.boundingBox())!.height,
  ).toBeLessThanOrEqual(320);
  await done.tap();
  await expect(page.locator('.world')).toHaveAttribute('style', before!);
});
test('state actions and selected resize handles remain usable at half zoom', async ({
  page,
}) => {
  const [a] = await seed(page);
  await page.evaluate(async (id) => {
    const url = '/Spatium/src/model/store.ts',
      { useStore } = await import(url),
      s = useStore.getState();
    s.select([id]);
    s.setViewport(s.doc.panelOrder[0], { x: 80, y: 80, zoom: 0.5 });
  }, a);
  const handle = await page
    .locator(`[data-item-id="${a}"] .handle-e`)
    .boundingBox();
  expect(handle!.width).toBeCloseTo(32, 0);
  const state = page.locator('.selectionToolbar .stateButton');
  expect((await state.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await state.tap();
  const done = page
    .locator('.stateMenu')
    .getByRole('button', { name: 'Done', exact: true });
  expect((await done.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await done.tap();
  await expect(page.locator(`[data-item-id="${a}"]`)).toHaveClass(/done/);
});
test('selected-area creation stays visible, avoids stacking, and area focus clears the dock', async ({
  page,
}) => {
  const area = await page.evaluate(async () => {
    const url = '/Spatium/src/model/store.ts',
      { useStore } = await import(url),
      s = useStore.getState(),
      p = s.doc.panelOrder[0];
    const area = s.createItem('area', p, { x: 0, y: 0 }, null);
    useStore.getState().resizeItem(area, { x: 0, y: 0, w: 1800, h: 1600 });
    useStore.getState().setViewport(p, { x: -800, y: -600, zoom: 1 });
    useStore.getState().setEditing(null);
    useStore.getState().select([area]);
    return area;
  });
  for (let i = 0; i < 2; i++) {
    await page.getByRole('button', { name: 'Create item', exact: true }).tap();
    await expect(page.locator('.creationContext')).toContainText('Add to');
    await page.getByRole('button', { name: 'Task', exact: true }).tap();
    await page
      .getByRole('textbox', { name: 'Task title', exact: true })
      .fill(`Task ${i}`);
    await page.getByRole('button', { name: 'Done editing', exact: true }).tap();
    const rect = (await page.locator('.task').nth(i).boundingBox())!;
    expect(rect.x).toBeGreaterThanOrEqual(0);
    expect(rect.x + rect.width).toBeLessThanOrEqual(390);
    expect(rect.y).toBeGreaterThan(60);
    expect(rect.y + rect.height).toBeLessThan(760);
    await page.evaluate(async (id) => {
      const url = '/Spatium/src/model/store.ts',
        { useStore } = await import(url);
      useStore.getState().select([id]);
    }, area);
  }
  const first = (await page.locator('.task').nth(0).boundingBox())!,
    second = (await page.locator('.task').nth(1).boundingBox())!;
  expect(second.y).toBeGreaterThanOrEqual(first.y + first.height);
  await page.getByRole('button', { name: 'Focus', exact: true }).tap();
  const areaBounds = (await page
      .locator(`[data-item-id="${area}"]`)
      .boundingBox())!,
    dock = (await page.locator('.selectionToolbar').boundingBox())!;
  expect(areaBounds.y + areaBounds.height).toBeLessThan(dock.y);
});
test('subtask grip shows an insertion marker and commits the indicated order once', async ({
  page,
  context,
}) => {
  const [a] = await seed(page);
  await page.evaluate(async (id) => {
    const url = '/Spatium/src/model/store.ts',
      { useStore } = await import(url);
    for (const title of ['First', 'Second', 'Third']) {
      const sub = useStore.getState().addSubtask(id);
      useStore.getState().updateSubtask(id, sub, { title });
    }
    useStore.getState().setEditing(null);
  }, a);
  const rows = page.locator('.subtask'),
    grip = (await rows.first().locator('.subtaskGrip').boundingBox())!,
    target = (await rows.last().boundingBox())!;
  const cdp = await context.newCDPSession(page),
    point = { x: grip.x + grip.width / 2, y: grip.y + grip.height / 2 };
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [point],
  });
  for (let step = 1; step <= 8; step++) {
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [
        {
          x: point.x,
          y: point.y + ((target.y + target.height - 4 - point.y) * step) / 8,
        },
      ],
    });
    await page.evaluate(() => new Promise(requestAnimationFrame));
  }
  await expect(page.locator('.touchDragGhost')).toBeVisible();
  await expect(page.locator('.reorderInsertion')).toBeVisible();
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: [],
  });
  await expect(rows.locator('.editable')).toHaveText([
    'Second',
    'Third',
    'First',
  ]);
  await expect(page.locator('.touchDragGhost,.reorderInsertion')).toHaveCount(
    0,
  );
  await page.getByRole('button', { name: 'Undo', exact: true }).tap();
  await expect(rows.locator('.editable')).toHaveText([
    'First',
    'Second',
    'Third',
  ]);
});
test('Home grip provides feedback and scrolls toward offscreen reorder destinations', async ({
  page,
  context,
}) => {
  await page.evaluate(async () => {
    const url = '/Spatium/src/model/store.ts',
      { useStore } = await import(url);
    for (let i = 0; i < 6; i++) useStore.getState().createPanel(`Panel ${i}`);
  });
  await page.getByRole('link', { name: 'Home', exact: true }).tap();
  const grip = (await page.locator('.panelGrip').first().boundingBox())!,
    cdp = await context.newCDPSession(page);
  const point = { x: grip.x + grip.width / 2, y: grip.y + grip.height / 2 };
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [point],
  });
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [{ x: point.x, y: 815 }],
  });
  await expect(page.locator('.touchDragGhost')).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => window.scrollY))
    .toBeGreaterThan(80);
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: [],
  });
  await expect(page.locator('.touchDragGhost,.reorderInsertion')).toHaveCount(
    0,
  );
  await expect(page.locator('.panelBoardHeader h2').first()).not.toHaveText(
    'Personal',
  );
});
