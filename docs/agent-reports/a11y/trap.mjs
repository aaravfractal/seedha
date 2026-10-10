export async function trapTest(p, dlgSel) {
  const r = {};
  const dlg = p.locator(dlgSel).first();
  r.present = await dlg.count() > 0; if (!r.present) return r;
  r.ariaModal = await dlg.getAttribute('aria-modal');
  r.focusIn = await dlg.evaluate(d => d.contains(document.activeElement));
  const n = await dlg.evaluate(d => d.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]),select,textarea,[tabindex]:not([tabindex="-1"])').length);
  r.n = n; r.disabled = await dlg.evaluate(d => d.querySelectorAll(':disabled').length);
  let f = 0, bk = 0; const rings = new Set();
  for (let i = 0; i < n + 2; i++) { await p.keyboard.press('Tab'); if (!(await dlg.evaluate(d => d.contains(document.activeElement)))) f++; rings.add(await p.evaluate(() => { const c = getComputedStyle(document.activeElement); return c.outlineStyle === 'none' ? 'NONE:' + document.activeElement.tagName + '.' + document.activeElement.className.slice(0,30) + ' bs=' + c.boxShadow.slice(0,40) : c.outlineWidth; })); }
  for (let i = 0; i < n + 2; i++) { await p.keyboard.press('Shift+Tab'); if (!(await dlg.evaluate(d => d.contains(document.activeElement)))) bk++; }
  r.escTab = f; r.escShift = bk; r.rings = [...rings];
  await p.keyboard.press('Escape'); await p.waitForTimeout(800);
  r.closed = !(await dlg.isVisible().catch(() => false)) || (await dlg.getAttribute('aria-hidden')) === 'true';
  r.focusAfter = await p.evaluate(() => { const e = document.activeElement; return e ? (e.tagName + ':' + (e.getAttribute('aria-label') || e.textContent || '').trim().slice(0, 30)) : null; });
  return r;
}
