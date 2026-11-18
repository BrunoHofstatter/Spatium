import { expect, test, type Page } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  // Time keeps flowing from this moment so entries get distinct creation times.
  await page.clock.install({ time: new Date('2026-11-17T10:00:00') });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('./');
});

const titles = (page: Page) =>
  page.locator('.agendaEntryTitle').allTextContents();
async function add(page: Page, title: string, pick?: string[]) {
  await page.getByRole('textbox', { name: 'New entry title' }).fill(title);
  if (pick) {
    await page.getByLabel(/^Entry date:/).click();
    const popover = page.locator('.agendaAdd .datePopover');
    for (const name of pick)
      await popover.getByRole('button', { name }).click();
    await expect(popover).toBeHidden();
  }
  await page.getByRole('button', { name: 'Add', exact: true }).click();
}

test('adds dated entries in order, grays and hides past ones, and persists', async ({
  page,
}) => {
  const card = page.locator('.panelCard').first();
  await expect(card).toHaveClass(/agendaCard/);
  await expect(card).toContainText('Nothing upcoming');
  await page.getByRole('link', { name: 'Open panel Agenda' }).click();
  await expect(page).toHaveURL(/#\/agenda$/);
  await expect(page.getByLabel(/^Entry date:/)).toHaveText(/17\/11\/2026/);

  await add(page, 'Dentist');
  await add(page, 'Trip', ['Next month', 'Saturday 5 December 2026']);
  await add(page, 'Old thing', ['Previous month', 'Tuesday 10 November 2026']);
  await add(page, 'Essay', ['Tuesday 17 November 2026']);
  await expect
    .poll(() => titles(page))
    .toEqual(['Old thing', 'Dentist', 'Essay', 'Trip']);
  await expect(page.locator('.agendaMonth h2')).toHaveText([
    'November 2026',
    'December 2026',
  ]);
  // Same-day entries share one date label.
  const today = page.locator('.agendaDay[data-date="2026-11-17"]');
  await expect(today).toHaveClass(/today/);
  await expect(today.locator('.agendaDate')).toHaveText(/Tue\s*17\/11/);
  await expect(today.locator('.agendaEntry')).toHaveCount(2);
  await expect(page.locator('.agendaDay[data-date="2026-11-10"]')).toHaveClass(
    /past/,
  );
  await expect(page.locator('.agendaCalendar .calendarDay.marked')).toHaveCount(
    2,
  );

  const hide = page.getByRole('button', { name: 'Hide past entries' });
  await hide.click();
  await expect(hide).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => titles(page)).toEqual(['Dentist', 'Essay', 'Trip']);
  await page.waitForTimeout(500);
  await page.reload();
  await expect.poll(() => titles(page)).toEqual(['Dentist', 'Essay', 'Trip']);
  await page.getByRole('button', { name: 'Hide past entries' }).click();
  await expect
    .poll(() => titles(page))
    .toEqual(['Old thing', 'Dentist', 'Essay', 'Trip']);

  await page.getByRole('link', { name: 'Home' }).click();
  await expect(card.locator('.agendaThumbnail li')).toHaveText([
    /17\/11\s*Dentist/,
    /17\/11\s*Essay/,
    /05\/12\s*Trip/,
  ]);
});

test('edits, re-dates, deletes and undoes an entry', async ({ page }) => {
  await page.goto('./#/agenda');
  await add(page, 'Dentist');
  await add(page, 'Trip', ['Saturday 28 November 2026']);
  await page.getByRole('button', { name: 'Edit Dentist' }).click();
  const field = page.getByRole('textbox', { name: 'Entry title', exact: true });
  await field.fill('Dentist appointment');
  await field.press('Enter');
  await expect
    .poll(() => titles(page))
    .toEqual(['Dentist appointment', 'Trip']);

  await page.getByRole('button', { name: 'Edit Dentist appointment' }).click();
  await page
    .getByRole('textbox', { name: 'Entry title', exact: true })
    .fill('Checkup');
  await page.getByLabel(/^Change date:/).click();
  await page
    .locator('.agendaEntry.editing .datePopover')
    .getByRole('button', { name: 'Monday 30 November 2026' })
    .click();
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await expect.poll(() => titles(page)).toEqual(['Trip', 'Checkup']);
  await expect(
    page.locator('.agendaDay[data-date="2026-11-30"] .agendaEntryTitle'),
  ).toHaveText('Checkup');

  await page.getByRole('button', { name: 'Edit Trip' }).click();
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect.poll(() => titles(page)).toEqual(['Checkup']);
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect.poll(() => titles(page)).toEqual(['Trip', 'Checkup']);

  // Clicking elsewhere finishes an edit and keeps the change.
  await page.getByRole('button', { name: 'Edit Trip' }).click();
  await page
    .getByRole('textbox', { name: 'Entry title', exact: true })
    .fill('Beach trip');
  await page.locator('.agendaMonth h2').click();
  await expect.poll(() => titles(page)).toEqual(['Beach trip', 'Checkup']);
});

test('side calendar picks the new entry date and jumps to that day', async ({
  page,
}) => {
  await page.goto('./#/agenda');
  for (let i = 0; i < 12; i++) await add(page, `Filler ${i}`);
  await add(page, 'Party', ['Next month', 'Thursday 31 December 2026']);
  const calendar = page.getByRole('group', { name: 'Agenda calendar' });
  await calendar.getByRole('button', { name: 'Next month' }).click();
  await calendar
    .getByRole('button', { name: 'Thursday 31 December 2026' })
    .click();
  await expect(page.getByLabel(/^Entry date:/)).toHaveText(/31\/12\/2026/);
  await expect(
    page.locator('.agendaDay[data-date="2026-12-31"]'),
  ).toBeInViewport();
});

test('the Agenda card can be renamed and reordered but not deleted', async ({
  page,
}) => {
  await page.getByLabel('Actions for Agenda').click();
  await expect(page.locator('.agendaCard .panelMenu .danger')).toHaveCount(0);
  await page.getByRole('button', { name: 'Move down' }).first().click();
  await expect(page.locator('.panelCard h2')).toHaveText([
    'Personal',
    'Agenda',
  ]);
  await page.getByLabel('Actions for Agenda').click();
  await page
    .locator('.agendaCard')
    .getByRole('button', { name: 'Rename' })
    .click();
  const name = page.getByRole('textbox', { name: 'Panel name' });
  await name.fill('Dates');
  await name.press('Enter');
  await page.waitForTimeout(500);
  await page.reload();
  await expect(page.locator('.panelCard h2')).toHaveText(['Personal', 'Dates']);
  await page.getByRole('link', { name: 'Open panel Dates' }).click();
  await page.getByRole('link', { name: 'Settings' }).click();
  await page.getByRole('link', { name: 'Back to panel Dates' }).click();
  await expect(page).toHaveURL(/#\/agenda$/);
});

test('places the calendar beside the list on desktop and below it on phones', async ({
  page,
  isMobile,
}) => {
  await page.goto('./#/agenda');
  await add(page, 'Dentist');
  const list = await page.locator('.agendaMain').boundingBox(),
    calendar = await page.locator('.agendaCalendar').boundingBox();
  if (isMobile) expect(calendar!.y).toBeGreaterThan(list!.y + list!.height - 1);
  else expect(calendar!.x).toBeGreaterThan(list!.x + list!.width - 1);
  const width = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(width).toBeLessThanOrEqual(0);
});
