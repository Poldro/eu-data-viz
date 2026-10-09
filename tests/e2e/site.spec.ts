import { expect, test, type Page } from '@playwright/test';

const SECTIONS = ['/', '/temi/', '/assorbimento/', '/paesi/', '/paesi/it/', '/regioni/', '/progetti/', '/pnrr/', '/beneficiari/', '/metodo/'];

/** Raccoglie gli errori di pagina e di console: un'isola che non si idrata finisce qui. */
function trackErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  return errors;
}

async function hydrated(page: Page): Promise<void> {
  await expect(page.locator('astro-island[ssr]')).toHaveCount(0);
}

for (const path of SECTIONS) {
  test(`${path} si carica senza errori e senza scorrimento orizzontale`, async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto(path);
    await hydrated(page);
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.locator('nav.sections a[aria-current="page"]')).toHaveCount(1);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(1);
    expect(errors).toEqual([]);
  });
}

test('i filtri finiscono nell’indirizzo e seguono il lettore tra le sezioni', async ({ page }) => {
  await page.goto('/');
  await hydrated(page);
  await page.getByRole('button', { name: '2014–2020' }).click();
  await page.getByRole('combobox', { name: 'Paese' }).selectOption('IT');
  await expect(page).toHaveURL(/periodo=1420/);
  await expect(page).toHaveURL(/paese=IT/);

  await page.locator('nav.sections').getByRole('link', { name: /Chi spende/ }).click();
  await expect(page).toHaveURL(/\/assorbimento\/\?.*paese=IT/);
  await hydrated(page);
  await expect(page.getByRole('button', { name: '2014–2020' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('combobox', { name: 'Paese' })).toHaveValue('IT');
});

test('la prima pagina presenta le sezioni e porta a ciascuna', async ({ page }) => {
  await page.goto('/');
  await hydrated(page);
  const cards = page.locator('.cards a');
  await expect(cards).toHaveCount(7);
  await cards.filter({ hasText: 'PNRR' }).click();
  await expect(page).toHaveURL(/\/pnrr\/$/);
  await expect(page.locator('h1')).toContainText('Italia');
});

test('cliccando un fondo nel diagramma dei flussi si filtra tutta la pagina', async ({ page, isMobile }) => {
  test.skip(isMobile, 'il clic sui nodi è verificato a larghezza desktop');
  await page.goto('/');
  await hydrated(page);
  const before = await page.locator('.kpi .value').first().innerText();
  await page.getByRole('button', { name: /Fondo sociale europeo Plus/ }).click();
  await expect(page).toHaveURL(/fondo=ESF%2B/);
  await expect(page.locator('.kpi .value').first()).not.toHaveText(before);
});

test('ogni grafico offre la tabella e il download dei dati', async ({ page }) => {
  await page.goto('/assorbimento/');
  await hydrated(page);
  const frame = page.locator('figure.frame').first();
  await frame.getByRole('button', { name: 'Tabella' }).click();
  await expect(frame.locator('table tbody tr')).toHaveCount(27);

  const download = page.waitForEvent('download');
  await frame.getByRole('button', { name: /CSV/ }).click();
  expect((await download).suggestedFilename()).toMatch(/^assorbimento-paesi-.*\.csv$/);
});

test('la ricerca dei beneficiari filtra per nome', async ({ page }) => {
  await page.goto('/beneficiari/');
  await hydrated(page);
  await page.getByRole('searchbox').fill('università');
  const names = page.locator('ol.list .name');
  await expect(names.first()).toBeVisible();
  for (const name of await names.allInnerTexts()) expect(name.toUpperCase()).toContain('UNIVERSIT');
});

test('la ricerca dei progetti filtra per regione e rimanda a OpenCoesione', async ({ page }) => {
  await page.goto('/progetti/');
  await hydrated(page);
  await page.getByRole('combobox', { name: 'Regione' }).selectOption({ label: 'Sicilia' });
  const first = page.locator('ol.list a.title').first();
  await expect(first).toHaveAttribute('href', /^https:\/\/opencoesione\.gov\.it\/it\/progetti\//);

  await page.getByRole('searchbox').fill('ferrovia');
  // La ricerca guarda titolo e beneficiario: si controlla l'intera riga.
  const rows = page.locator('ol.list li');
  await expect(rows.first()).toContainText(/ferrovia/i);
  for (const row of await rows.allInnerTexts()) expect(row.toUpperCase()).toContain('FERROVIA');
});

test('la mappa delle regioni si può stringere su un paese', async ({ page }) => {
  await page.goto('/regioni/');
  await hydrated(page);
  const regions = page.locator('.map path.region');
  const all = await regions.count();
  expect(all).toBeGreaterThan(200);
  await page.getByRole('combobox', { name: 'Inquadra' }).selectOption('IT');
  await expect(regions).toHaveCount(21);
});

test('a fine pagina c’è il rimando alla sezione successiva', async ({ page }) => {
  await page.goto('/temi/');
  await page.locator('nav.pager a.next').click();
  await expect(page).toHaveURL(/\/assorbimento\/$/);
});
