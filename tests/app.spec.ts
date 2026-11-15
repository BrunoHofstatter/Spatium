import { test, expect } from '@playwright/test';

test('subtasks, highlighting and Done visibility preserve layout', async ({
  page,
}, info) => {
  await page.goto('./');
  await page.getByRole('link', { name: 'Open Personal' }).click();
  await page.getByRole('button', { name: 'Create item', exact: true }).click();
  await page.getByRole('button', { name: 'Task', exact: true }).click();
  await page
    .getByRole('textbox', { name: 'Task title', exact: true })
    .press('Enter');
  await page.getByRole('button', { name: 'Expand task', exact: true }).click();
  await page.locator('.subtaskToggle').click();
  await page
    .getByRole('button', { name: '+ Add subtask', exact: true })
    .click();
  const input = page.getByRole('textbox', {
    name: 'Subtask title',
    exact: true,
  });
  await input.fill('A small step');
  await input.press('Tab');
  await page
    .getByRole('button', { name: 'Subtask state: Blank', exact: true })
    .press('Enter');
  await page
    .locator('.stateMenu')
    .getByRole('button', { name: 'Done', exact: true })
    .click();
  await expect(page.locator('.subtaskToggle')).toContainText('1/1');
  const before = (await page.locator('.task').boundingBox())!;
  if (info.project.name === 'mobile')
    await page.getByLabel('Filters and options').click();
  await page
    .getByRole('button', { name: 'Blank', exact: true })
    .filter({ visible: true })
    .click();
  await expect(page.locator('.task')).toHaveClass(/matched/);
  await page
    .getByRole('checkbox', { name: 'Hide Done', exact: true })
    .filter({ visible: true })
    .check();
  await expect(page.locator('.subtask')).toHaveCount(0);
  await expect(page.locator('.subtaskToggle')).toContainText('1/1');
  const after = (await page.locator('.task').boundingBox())!;
  expect(after.x).toBe(before.x);
  expect(after.y).toBe(before.y);
});

test('touch pan, pinch and item drag use the same canvas model', async ({
  page,
  context,
}, info) => {
  test.skip(info.project.name !== 'mobile');
  await page.goto('./');
  await page.getByRole('link', { name: 'Open Personal' }).click();
  const cdp = await context.newCDPSession(page);
  const initial = await page.locator('.world').getAttribute('style');
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: 80, y: 200 }],
  });
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [{ x: 130, y: 250 }],
  });
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: [],
  });
  await expect(page.locator('.world')).not.toHaveAttribute('style', initial!);
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [
      { x: 120, y: 300, id: 1 },
      { x: 220, y: 300, id: 2 },
    ],
  });
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [
      { x: 90, y: 300, id: 1 },
      { x: 250, y: 300, id: 2 },
    ],
  });
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: [],
  });
  await expect(page.locator('.canvasHint b')).not.toHaveText('100%');
  await page.getByRole('button', { name: 'Create item', exact: true }).click();
  await page.getByRole('button', { name: 'Task', exact: true }).click();
  await page
    .getByRole('textbox', { name: 'Task title', exact: true })
    .press('Enter');
  const rect = (await page.locator('.task').boundingBox())!;
  const point = { x: Math.max(40, rect.x + 90), y: rect.y + rect.height / 2 };
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [point],
  });
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [{ x: point.x + 30, y: point.y + 40 }],
  });
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: [],
  });
  expect((await page.locator('.task').boundingBox())!.y).toBeCloseTo(
    rect.y + 40,
    0,
  );
});

test('renders and navigates a 500-item document', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('link', { name: 'Open Personal' }).click();
  await page.evaluate(async () => {
    const moduleUrl = '/Spatium/src/model/store.ts';
    const { useStore } = await import(moduleUrl);
    const s = useStore.getState();
    const id = s.createItem('task', s.doc.panelOrder[0], { x: 0, y: 0 }, null);
    const sample = useStore.getState().doc.items[id];
    useStore
      .getState()
      .transact((doc: { items: Record<string, typeof sample> }) => {
        for (let n = 1; n < 500; n++) {
          const next = `perf-${n}`;
          doc.items[next] = {
            ...sample,
            id: next,
            x: (n % 25) * 280,
            y: Math.floor(n / 25) * 160,
            title: `Task ${n}`,
          };
        }
      });
    useStore.getState().setEditing(null);
  });
  await expect(page.locator('.task')).toHaveCount(500);
  await page.evaluate(async () => {
    const moduleUrl = '/Spatium/src/model/store.ts';
    const { useStore } = await import(moduleUrl);
    const s = useStore.getState();
    s.setViewport(s.doc.panelOrder[0], { x: -100, y: -100, zoom: 0.4 });
  });
  await expect(page.locator('.canvasHint b')).toHaveText('40%');
});

test('creates and edits a task, preserves it after reload, and undoes deletion', async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('./');
  await page.getByRole('link', { name: 'Open Personal' }).click();
  await page.getByRole('button', { name: 'Create item', exact: true }).click();
  await page.getByRole('button', { name: 'Task', exact: true }).click();
  const title = page.getByRole('textbox', { name: 'Task title', exact: true });
  await title.fill('Ship a little clarity');
  await title.press('Enter');
  await page
    .locator('.taskHeading')
    .getByRole('button', { name: 'Task state: Blank', exact: true })
    .press('Enter');
  await page
    .getByRole('button', { name: 'In Progress', exact: true })
    .last()
    .click();
  await page
    .locator('.taskHeading')
    .getByRole('button', { name: 'Important', exact: true })
    .click();
  await expect(page.locator('.task')).toHaveCSS('position', 'absolute');
  await expect(page.locator('.taskTitle')).toHaveText('Ship a little clarity');
  await page.waitForTimeout(700);
  await page.reload();
  await expect(page.locator('.taskTitle')).toHaveText('Ship a little clarity');
  await expect(
    page
      .locator('.taskHeading')
      .getByRole('button', { name: 'Important', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await page.locator('.task').click({ position: { x: 5, y: 15 } });
  if (info.project.name === 'mobile')
    await page.getByRole('button', { name: 'More', exact: true }).click();
  await page.getByRole('button', { name: 'Delete selection' }).click();
  await expect(page.locator('.task')).toHaveCount(0);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page.locator('.taskTitle')).toHaveText('Ship a little clarity');
  expect(errors).toEqual([]);
});

test('supports nested areas, collapse, notes and panel management', async ({
  page,
}) => {
  await page.goto('./');
  await page.getByRole('link', { name: 'Open Personal' }).click();
  await page.getByRole('button', { name: 'Create item', exact: true }).click();
  await page.getByRole('button', { name: 'Area', exact: true }).click();
  await page
    .getByRole('textbox', { name: 'Area title', exact: true })
    .fill('Project');
  await page
    .getByRole('textbox', { name: 'Area title', exact: true })
    .press('Enter');
  await page.getByRole('button', { name: 'Create item', exact: true }).click();
  await page.getByRole('button', { name: 'Note', exact: true }).click();
  await page
    .getByRole('textbox', { name: 'Note', exact: true })
    .fill('A nested thought');
  await page.getByRole('textbox', { name: 'Note', exact: true }).press('Tab');
  await expect(page.locator('.areaContent .note')).toHaveCount(1);
  await page.getByRole('button', { name: 'Collapse area' }).click();
  await expect(page.locator('.note')).toHaveCount(0);
  await page.getByRole('button', { name: 'Expand area' }).click();
  await expect(page.locator('.note')).toHaveCount(1);
  await page.getByRole('link', { name: 'Home', exact: true }).click();
  await page.getByRole('button', { name: 'New panel', exact: true }).click();
  const name = page.getByRole('textbox', { name: 'Panel name', exact: true });
  await name.fill('Studio');
  await name.press('Enter');
  await page.getByRole('link', { name: 'Open Studio', exact: true }).click();
  await expect(page.locator('.canvasEmpty')).toBeVisible();
});

test('desktop creation, direct manipulation and wheel zoom', async ({
  page,
}, info) => {
  test.skip(info.project.name !== 'desktop');
  await page.goto('./');
  await page.getByRole('link', { name: 'Open Personal' }).click();
  await page.locator('.canvas').dblclick({ position: { x: 200, y: 160 } });
  await page
    .getByRole('textbox', { name: 'Task title', exact: true })
    .fill('Drag me');
  await page
    .getByRole('textbox', { name: 'Task title', exact: true })
    .press('Enter');
  const task = page.locator('.task'),
    before = (await task.boundingBox())!;
  await page.mouse.move(before.x + 90, before.y + 15);
  await page.mouse.down();
  await page.mouse.move(before.x + 190, before.y + 65, { steps: 5 });
  await page.mouse.up();
  const after = (await task.boundingBox())!;
  expect(after.x - before.x).toBeCloseTo(100, 0);
  expect(after.y - before.y).toBeCloseTo(50, 0);
  await page.locator('.taskTitle').dblclick();
  const editor = page.getByRole('textbox', { name: 'Task title', exact: true });
  await editor.fill('Edited in place');
  await editor.press('Enter');
  await expect(task).toHaveCount(1);
  const handle = page.locator('.handle-e'),
    r = (await handle.boundingBox())!;
  await page.mouse.move(r.x + 4, r.y + 4);
  await page.mouse.down();
  await page.mouse.move(r.x + 64, r.y + 44, { steps: 4 });
  await page.mouse.up();
  expect((await task.boundingBox())!.width).toBeGreaterThan(after.width + 50);
  await page.mouse.move(900, 500);
  await page.mouse.wheel(0, -400);
  await expect(page.locator('.canvasHint b')).not.toHaveText('100%');
});
