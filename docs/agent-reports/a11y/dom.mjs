import { chromium, BASE, login, settle } from './lib.mjs';
const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } }); await login(ctx); const p = await ctx.newPage();
for (const path of ['/link/DEODAR-RS26', '/proof', '/inbox', '/site']) { await p.goto(BASE + path); await settle(p);
  console.log('==', path, await p.evaluate(() => [...document.querySelectorAll('main button, main input, main a')].slice(0, 30).map(e => `${e.tagName}${e.disabled?'[dis]':''}[${e.className.toString().slice(0,40)}] ${e.getAttribute('aria-pressed')??''} ${(e.getAttribute('aria-label')||e.textContent||e.type).trim().slice(0,30)}`).join('\n'))); }
await b.close();
