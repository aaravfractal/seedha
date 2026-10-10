import { createRequire } from "module"; const { chromium } = createRequire(process.cwd() + "/package.json")("@playwright/test");
const OUT = new URL(".", import.meta.url).pathname;
const [path, name, w, h, theme, clickSel] = process.argv.slice(2);
const b = await chromium.launch(); const c = await b.newContext({ viewport: { width: +w, height: +h } });
await c.addCookies([{ name: "seedha_theme", value: theme, url: "http://localhost:3000" }, { name: "seedha_cookie_consent", value: "necessary", url: "http://localhost:3000" }]);
const p = await c.newPage(); await p.goto("http://localhost:3000/login"); await p.click("#beta-login"); await p.waitForURL(/home/);
await p.goto("http://localhost:3000" + path); await p.waitForLoadState("networkidle"); await p.waitForTimeout(1500);
if (clickSel) { await p.locator(clickSel).first().click(); await p.waitForTimeout(2000); }
const info = await p.evaluate(() => { const d = document.querySelector('a[href="/desk"]'); if (!d) return null; const r = d.getBoundingClientRect(); return [r.top, r.height, getComputedStyle(d.parentElement).overflow]; });
console.log(JSON.stringify(info));
await p.screenshot({ path: `${OUT}${name}.png` }); await b.close();
