import { expect, test } from '@playwright/test';
test.beforeEach(async ({ page }) => {
  await page.goto('./');
  await page.getByRole('link', { name: 'Open Personal' }).click();
});

test('lifecycle save includes an active edit without blur', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'Create item', exact: true }).click();
  await page.getByRole('button', { name: 'Note', exact: true }).click();
  await page
    .getByRole('textbox', { name: 'Note', exact: true })
    .fill('Still typing when the app hides');
  await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
  await expect
    .poll(() =>
      page.evaluate(async () => {
        const db = await new Promise<IDBDatabase>((resolve, reject) => {
          const request = indexedDB.open('keyval-store');
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        });
        try {
          return await new Promise<string>((resolve, reject) => {
            const request = db
              .transaction('keyval')
              .objectStore('keyval')
              .get('spatium-document');
            request.onsuccess = () => resolve(JSON.stringify(request.result));
            request.onerror = () => reject(request.error);
          });
        } finally {
          db.close();
        }
      }),
    )
    .toContain('Still typing when the app hides');
  await page.reload();
  await expect(page.locator('.noteText')).toHaveText(
    'Still typing when the app hides',
  );
});

test('automatically sized tasks contain their controls', async ({ page }) => {
  await page.evaluate(async () => {
    const url = '/Spatium/src/model/store.ts';
    const { useStore } = await import(url);
    const s = useStore.getState();
    const id = s.createItem(
      'task',
      s.doc.panelOrder[0],
      { x: 40, y: 80 },
      null,
    );
    useStore.getState().setEditing(null);
    useStore.getState().updateItem(id, { collapsed: false });
    useStore.getState().resizeItem(id, { x: 40, y: 80, w: 160, h: 56 });
  });
  const main = (await page.locator('.taskMain').boundingBox())!,
    toggle = (await page.locator('.subtaskToggle').boundingBox())!;
  expect(toggle.y + toggle.height).toBeLessThanOrEqual(main.y + main.height);
  await page.locator('.subtaskToggle').click();
  const list = (await page.locator('.subtasks').boundingBox())!;
  expect(toggle.y + toggle.height).toBeLessThanOrEqual(list.y);
});

test('release outside the canvas before the threshold cancels the gesture', async ({
  page,
}, info) => {
  test.skip(info.project.name !== 'desktop');
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const canvas = (await page.locator('.canvas').boundingBox())!;
  await page.mouse.move(100, canvas.y + 1);
  await page.mouse.down();
  await page.mouse.move(100, canvas.y - 1);
  await page.mouse.up();
  await page.mouse.move(200, canvas.y + 100);
  await expect(page.locator('.selectionBox')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('wheel navigation works over inactive subtask content', async ({
  page,
}, info) => {
  test.skip(info.project.name !== 'desktop');
  await page.evaluate(async () => {
    const url = '/Spatium/src/model/store.ts';
    const { useStore } = await import(url);
    const s = useStore.getState();
    const id = s.createItem(
      'task',
      s.doc.panelOrder[0],
      { x: 40, y: 80 },
      null,
    );
    useStore.getState().addSubtask(id);
    useStore.getState().setEditing(null);
  });
  await page.locator('.subtasks').hover();
  await page.mouse.wheel(0, -300);
  await expect(page.locator('.canvasHint b')).not.toHaveText('100%');
});

test('color changes from one focus session form one undo entry', async ({
  page,
}) => {
  await page.getByRole('link', { name: 'Home', exact: true }).click();
  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  const color = page.getByLabel('Blank color', { exact: true });
  await color.evaluate((input: HTMLInputElement) => {
    input.focus();
    for (const value of ['#112233', '#223344', '#334455']) {
      Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        'value',
      )!.set!.call(input, value);
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }
    input.blur();
  });
  await expect(color).toHaveValue('#334455');
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(color).toHaveValue('#8b93a6');
});

test('renaming a panel permits mouse text selection without a card drag', async ({
  page,
}, info) => {
  test.skip(info.project.name !== 'desktop');
  await page.getByRole('link', { name: 'Home', exact: true }).click();
  await page.getByRole('button', { name: 'New panel', exact: true }).click();
  const input = page.getByRole('textbox', { name: 'Panel name', exact: true });
  await input.fill('A sufficiently long panel name');
  const rect = (await input.boundingBox())!;
  await page.mouse.move(rect.x + 8, rect.y + rect.height / 2);
  await page.mouse.down();
  await page.mouse.move(rect.x + 90, rect.y + rect.height / 2, { steps: 8 });
  await page.mouse.up();
  expect(
    await input.evaluate(
      (el: HTMLInputElement) =>
        (el.selectionEnd ?? 0) - (el.selectionStart ?? 0),
    ),
  ).toBeGreaterThan(0);
});

test('pinch starts over subtasks and card controls without changing task state', async ({
  page,
  context,
}, info) => {
  test.skip(info.project.name !== 'mobile');
  await page.evaluate(async () => {
    const url = '/Spatium/src/model/store.ts';
    const { useStore } = await import(url);
    const s = useStore.getState();
    const id = s.createItem(
      'task',
      s.doc.panelOrder[0],
      { x: -40, y: 80 },
      null,
    );
    useStore.getState().addSubtask(id);
    useStore.getState().setEditing(null);
  });
  const row = (await page.locator('.subtask').boundingBox())!,
    dot = (await page.locator('.taskHeading .stateDot').boundingBox())!;
  const cdp = await context.newCDPSession(page);
  const points = [
    { x: row.x + 80, y: row.y + 18, id: 1 },
    { x: dot.x + 5, y: dot.y + 5, id: 2 },
  ];
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: points,
  });
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [
      { ...points[0], x: points[0].x + 30, y: points[0].y + 30 },
      { ...points[1], x: points[1].x - 10, y: points[1].y - 20 },
    ],
  });
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: [],
  });
  await expect(page.locator('.canvasHint b')).not.toHaveText('100%');
  await expect(page.locator('.stateMenu')).toHaveCount(0);
  await expect(page.locator('.taskHeading .stateDot')).toHaveAttribute(
    'aria-label',
    'Task state: Blank',
  );
});

test('northwest area resize keeps children fixed during and after the gesture', async ({
  page,
}, info) => {
  test.skip(info.project.name !== 'desktop');
  await page.evaluate(async () => {
    const url = '/Spatium/src/model/store.ts';
    const { useStore } = await import(url);
    const s = useStore.getState();
    const panel = s.doc.panelOrder[0],
      area = s.createItem('area', panel, { x: 150, y: 150 }, null);
    useStore.getState().createItem('task', panel, { x: 190, y: 220 }, area);
    useStore.getState().setEditing(null);
    useStore.getState().select([area]);
  });
  const before = (await page.locator('.task').boundingBox())!,
    handle = (await page.locator('.handle-nw').boundingBox())!;
  await page.mouse.move(handle.x + 4, handle.y + 4);
  await page.mouse.down();
  await page.mouse.move(handle.x - 46, handle.y - 46, { steps: 5 });
  const live = (await page.locator('.task').boundingBox())!;
  expect(live.x).toBeCloseTo(before.x);
  expect(live.y).toBeCloseTo(before.y);
  await page.mouse.up();
  const after = (await page.locator('.task').boundingBox())!;
  expect(after.x).toBeCloseTo(before.x);
  expect(after.y).toBeCloseTo(before.y);
});

test('touch tap on empty canvas deselects without panning', async ({
  page,
}, info) => {
  test.skip(info.project.name !== 'mobile');
  await page.evaluate(async () => {
    const url = '/Spatium/src/model/store.ts';
    const { useStore } = await import(url);
    const s = useStore.getState();
    s.createItem('area', s.doc.panelOrder[0], { x: 10, y: 180 }, null);
    useStore.getState().setEditing(null);
  });
  await expect(page.locator('.selectionToolbar')).toBeVisible();
  const before = await page.locator('.world').getAttribute('style');
  const canvas = (await page.locator('.canvas').boundingBox())!;
  await page.touchscreen.tap(canvas.x + 20, canvas.y + 40);
  await expect(page.locator('.selectionToolbar')).toHaveCount(0);
  await expect(page.locator('.world')).toHaveAttribute('style', before!);
});

test('a stale tab cannot overwrite a newer saved document', async ({
  page,
  context,
}) => {
  await page.waitForTimeout(500);
  const other = await context.newPage();
  await other.goto(page.url());
  await other.locator('.canvas').waitFor();
  await page.locator('.panelTitle').dblclick();
  await page
    .getByRole('textbox', { name: 'Panel title', exact: true })
    .fill('Newer saved work');
  await page
    .getByRole('textbox', { name: 'Panel title', exact: true })
    .press('Enter');
  await page.waitForTimeout(500);
  await other.locator('.panelTitle').dblclick();
  await other
    .getByRole('textbox', { name: 'Panel title', exact: true })
    .fill('Stale edit');
  await other
    .getByRole('textbox', { name: 'Panel title', exact: true })
    .press('Enter');
  await expect(other.getByRole('alert')).toContainText('Another tab');
  await page.reload();
  await expect(page.locator('.panelTitle')).toHaveText('Newer saved work');
  await other.close();
});
