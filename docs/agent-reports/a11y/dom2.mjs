import { chromium, BASE, login, settle } from './lib.mjs';
const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } }); const p = await ctx.newPage();
await p.goto(BASE + '/link/DEODAR-RS26'); await settle(p); console.log((await p.textContent('body')).replace(/\s+/g,' ').slice(0, 900));
await b.close();
