import { createRequire } from "module"; const { chromium } = createRequire(process.cwd() + "/package.json")("@playwright/test");
const BASE = "http://localhost:3000";
const OUT = new URL(".", import.meta.url).pathname;
const only = process.argv[2] && process.argv[2] !== "all" ? process.argv[2].split(",") : null;
const combos = process.argv[3] ? process.argv[3].split(",") : ["light-1440","dark-1440","light-390","dark-390"];
const pages = [
  ["home", "/home"], ["upload", "/upload"], ["flip", "/flip"], ["repeat", "/repeat"],
  ["scenario", "/scenario"], ["approvals", "/approvals"], ["savings", "/savings"], ["ask", "/ask"],
  ["proof", "/proof"], ["pro", "/pro"], ["site", "/site"], ["inbox", "/inbox"], ["assistant", "/assistant"],
  ["desk", "/desk"], ["link", "/link/DEODAR-RS26"],
  ["hotel-pine", "/hotel/deodar-view?mood=pine"], ["hotel-stone", "/hotel/deodar-view?mood=stone"],
  ["hotel-sky", "/hotel/deodar-view?mood=sky"], ["hotel-hi", "/hotel/deodar-view?lang=hi"],
  ["ratecard", "/rate-card"], ["agentdeck", "/agent-deck"],
];
const browser = await chromium.launch();
const settle = async (p) => { await p.waitForLoadState("networkidle").catch(() => {}); await p.waitForTimeout(1800); };
for (const combo of combos) {
  const [theme, w] = combo.split("-"); const width = +w;
  const c = await browser.newContext({ viewport: { width, height: width > 500 ? 900 : 844 } });
  await c.addCookies([{ name: "seedha_theme", value: theme, url: BASE }, { name: "seedha_cookie_consent", value: "necessary", url: BASE }]);
  const p = await c.newPage();
  await p.goto(BASE + "/login"); await p.click("#beta-login"); await p.waitForURL(/\/home/, { timeout: 20000 });
  if (!only || only.includes("samples")) {
    await p.goto(BASE + "/upload"); await settle(p);
    const b = p.getByRole("button", { name: /^Use sample statements$/ });
    if (await b.count()) { await b.first().click(); await p.waitForTimeout(8000); }
  }
  for (const [name, path] of pages) {
    if (only && !only.includes(name)) continue;
    try {
      await p.goto(BASE + path); await settle(p);
      await p.screenshot({ path: `${OUT}${name}-${combo}.png`, fullPage: true });
      if (name === "flip") { const t = p.getByRole("button", { name: /By money kept/ });
        if (await t.count()) { await t.first().click(); await p.waitForTimeout(2500); await p.screenshot({ path: `${OUT}flipmoney-${combo}.png`, fullPage: true }); } }
      if (name === "site") for (const tab of ["Packages", "Google kit"]) {
        const t = p.getByRole("button", { name: tab, exact: true }).or(p.getByRole("tab", { name: tab, exact: true }));
        if (await t.count()) { await t.first().click(); await p.waitForTimeout(1500); await p.screenshot({ path: `${OUT}site${tab.replace(" ","")}-${combo}.png`, fullPage: true }); } }
      if (name === "link") { const t = p.getByRole("button", { name: /Pay with UPI|Book|Continue/ });
        if (await t.count()) { await t.first().click(); await p.waitForTimeout(1500); await p.screenshot({ path: `${OUT}linkupi-${combo}.png` }); } }
    } catch (e) { console.log("ERR", name, combo, e.message.split("\n")[0]); }
  }
  await c.close();
}
await browser.close(); console.log("done");
