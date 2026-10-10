import { chromium, BASE, OUT, login, settle, axe, measure } from './lib.mjs'; import { trapTest } from './trap.mjs'; import fs from 'fs';
const b = await chromium.launch(); const out = [];
const S = [
 ['flip money', '/flip', async p => { await p.getByRole('button', { name: 'By money kept' }).click(); await p.waitForTimeout(1500); }, null],
 ['notifications', '/home', async p => { await p.locator('button[aria-label^="Notifications"]').first().click(); await p.waitForTimeout(600); }, '[role=dialog][aria-label="Notifications"]'],
 ['account menu', '/home', async p => { await p.locator('button[aria-label^="Account menu"]').first().click(); await p.waitForTimeout(600); }, '[role=dialog][aria-label="Account"]'],
 ['palette', '/home', async p => { await p.locator('body').click({ position: { x: 5, y: 300 } }).catch(()=>{}); await p.keyboard.press('Control+k'); await p.waitForTimeout(600); }, '[role=dialog][aria-label="Search Seedha"]'],
 ['UPI sheet', '/link/DEODAR-RS26', async p => { const pay = p.getByRole('button', { name: /with UPI/ }); if (await pay.isDisabled()) { const d = p.locator('input[type=date]').first(); if (await d.count()) await d.fill('2026-11-20'); const room = p.locator('button[aria-pressed]').first(); if (await room.count()) await room.click(); } await pay.click(); await p.waitForTimeout(900); }, '[role=dialog][aria-label="Pay with UPI"]'],
 ['proof dialog', '/proof', async p => { await p.locator('button[class*="entry"]').first().click(); await p.waitForTimeout(900); }, '[role=dialog][aria-modal=true]'],
 ['desk Show QR', '/desk', async p => { const g = p.locator('button[aria-pressed]').first(); if (await g.count()) await g.click().catch(()=>{}); await p.getByRole('button', { name: /^Show QR/ }).click(); await p.waitForTimeout(2000); }, null],
 ['site review', '/site', async p => { const st = await p.textContent('main'); out.push({ siteText: st.slice(0, 200) }); }, null],
 ['inbox thread', '/inbox', async p => { await p.locator('button[class*="row"]').first().click(); await p.waitForTimeout(1200); }, null],
];
for (const theme of ['light', 'dark']) for (const w of [1440, 390]) {
  const ctx = await b.newContext({ colorScheme: theme, viewport: { width: w, height: w < 760 ? 844 : 900 } });
  await ctx.addCookies([{ name: 'seedha_theme', value: theme, url: BASE }, { name: 'seedha_cookies', value: 'necessary', url: BASE }]);
  await login(ctx); const p = await ctx.newPage();
  for (const [name, path, act, dlg] of S) {
    const r = { name, theme, w };
    try { await p.goto(BASE + path); await settle(p); await act(p); r.axe = await axe(p); if (w === 390) r.m = await measure(p);
      if (dlg && theme === 'light' && w === 1440) r.trap = await trapTest(p, dlg);
    } catch (e) { r.err = String(e).slice(0, 220); }
    out.push(r); console.log(theme, w, name, 'axe', r.axe?.length, r.err || '', r.trap ? JSON.stringify(r.trap) : '');
  }
  await ctx.close();
}
fs.writeFileSync(`${OUT}/states.json`, JSON.stringify(out, null, 1)); await b.close();
