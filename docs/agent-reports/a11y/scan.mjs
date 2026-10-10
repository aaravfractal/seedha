import { chromium, BASE, OUT, login, settle, measure, axe, bp } from './lib.mjs';
import fs from 'fs';
const group = process.argv[2];
const OWNER = ['/home','/upload','/flip','/repeat','/scenario','/approvals','/savings','/ask','/proof','/pro','/site','/inbox','/assistant','/my-place','/desk','/link','/onboard','/', '/link/DEODAR-RS26'];
const widths = (process.argv[3] || '1440,980,760,390').split(',').map(Number);
const themes = (process.argv[4] || 'light,dark').split(',');
const b = await chromium.launch(); const results = [];
for (const theme of themes) {
  const ctx = await b.newContext({ colorScheme: theme });
  await ctx.addCookies([{ name: 'seedha_theme', value: theme, url: BASE }, { name: 'seedha_cookies', value: 'necessary', url: BASE }]);
  await login(ctx);
  const p = await ctx.newPage();
  if (theme === themes[0]) { await p.goto(BASE + '/upload'); await settle(p); const sb = p.getByRole('button', { name: /Use sample statements/i }); if (await sb.count()) { await sb.first().click(); await p.waitForTimeout(8000); console.log('sample loaded'); } }
  for (const w of widths) {
    await p.setViewportSize({ width: w, height: w < 760 ? 844 : 900 });
    for (const path of OWNER) {
      const r = { path, theme, w };
      try {
        const resp = await p.goto(BASE + path, { waitUntil: 'domcontentloaded', timeout: 60000 });
        r.status = resp?.status(); await settle(p); r.url = p.url().replace(BASE, '');
        r.axe = await axe(p);
        if (w === 1440 && theme === 'light') r.bp = await bp(p);
        if (w === 390 || w === 1440) r.m = await measure(p);
      } catch (e) { r.err = String(e).slice(0, 200); }
      results.push(r); console.log(`${theme} ${w} ${path} ${r.status} ${r.url} axe=${r.axe?.length} ${r.err||''}`);
    }
  }
  await ctx.close();
}
fs.writeFileSync(`${OUT}/scan-owner.json`, JSON.stringify(results, null, 1)); await b.close();
