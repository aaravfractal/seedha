import { createRequire } from 'module';
const require = createRequire('/Users/aaravsharma/Projects/seedha-real/apps/web/package.json');
export const { chromium } = require('@playwright/test');
export const AxeBuilder = require('@axe-core/playwright').default;
export const BASE = 'http://localhost:3000';
export const OUT = '/private/tmp/claude-501/-Users-aaravsharma-Projects-seedha-real/9d04038f-5044-4db6-bda6-66bccd7b848a/scratchpad';
export async function login(ctx) {
  const p = await ctx.newPage();
  await p.goto(BASE + '/login'); await p.waitForTimeout(500);
  await p.click('#beta-login');
  await p.waitForURL('**/home', { timeout: 30000 });
  await p.close();
}
export async function settle(p) { await p.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {}); await p.waitForTimeout(900); }
export const PAGE_HELPERS = `
window.__sel = function(el){ const parts=[]; let e=el; for(let i=0;i<3&&e&&e.nodeType===1;i++){ let s=e.tagName.toLowerCase(); if(e.id){s+='#'+e.id; parts.unshift(s); break;} const c=[...e.classList].slice(0,2).map(x=>x.replace(/^.*-module__([A-Za-z0-9]+)__.*$/,'$1').replace(/_[0-9a-f]{5,}$/,'')); if(c.length) s+='.'+c.join('.'); parts.unshift(s); e=e.parentElement;} return parts.join(' > '); };
window.__visible = function(el){ const r=el.getBoundingClientRect(); if(r.width===0||r.height===0) return false; const cs=getComputedStyle(el); if(cs.visibility==='hidden'||cs.display==='none'||parseFloat(cs.opacity)===0) return false; let p=el; while(p){ const s=getComputedStyle(p); if(s.clip==='rect(0px, 0px, 0px, 0px)' || s.clipPath==='inset(50%)' || (s.position==='absolute' && p.getBoundingClientRect().width<=1)) return false; p=p.parentElement;} return true; };
`;
export async function measure(p) {
  await p.addScriptTag({ content: PAGE_HELPERS });
  return p.evaluate(() => {
    const res = { fonts: [], taps: [], overflow: null };
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); const seen = new Set();
    while (walker.nextNode()) { const t = walker.currentNode; if (!t.textContent.trim()) continue; const el = t.parentElement; if (!el || seen.has(el) || el.closest('script,style,nextjs-portal')) continue; seen.add(el); if (!window.__visible(el)) continue; const fs = parseFloat(getComputedStyle(el).fontSize); if (fs < 13) res.fonts.push({ sel: window.__sel(el), fs, text: t.textContent.trim().slice(0, 40) }); }
    const q = 'a[href],button,input:not([type=hidden]),select,textarea,summary,[role=button],[role=switch],[role=tab],[tabindex]:not([tabindex="-1"])';
    for (const el of document.querySelectorAll(q)) {
      if (!window.__visible(el) || el.disabled) continue;
      if (/^(MAIN|DIALOG|OL|UL|SECTION|DIV)$/.test(el.tagName) && !el.getAttribute('role')) continue;
      if (el.getAttribute('role')==='dialog') continue;
      let r = el.getBoundingClientRect();
      if ((el.type === 'checkbox' || el.type === 'radio') && el.closest('label')) r = el.closest('label').getBoundingClientRect();
      const cs = getComputedStyle(el);
      const inline = el.tagName === 'A' && cs.display === 'inline' && el.parentElement && el.parentElement.textContent.trim().length > el.textContent.trim().length + 10;
      if (inline) continue;
      if (r.height < 48 || r.width < 44) res.taps.push({ sel: window.__sel(el), w: Math.round(r.width), h: Math.round(r.height), label: (el.getAttribute('aria-label') || el.textContent || el.value || '').trim().slice(0, 30) });
    }
    const de = document.documentElement; const sw = Math.max(de.scrollWidth, document.body.scrollWidth);
    if (sw > de.clientWidth + 1) { const offs = []; for (const el of document.body.querySelectorAll('*')) { const r = el.getBoundingClientRect(); if (r.right > de.clientWidth + 1 && r.width > 0 && window.__visible(el)) { let clipped=false; let p=el.parentElement; while(p&&p!==document.body){ const s=getComputedStyle(p); if(/(auto|scroll|hidden|clip)/.test(s.overflowX)){clipped=true;break;} p=p.parentElement;} if(!clipped) offs.push({ sel: window.__sel(el), right: Math.round(r.right) }); } } res.overflow = { scrollWidth: sw, client: de.clientWidth, offenders: offs.slice(0, 5) }; }
    return res;
  });
}
export async function axe(p) {
  const ax = await new AxeBuilder({ page: p }).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze();
  return ax.violations.map(v => ({ id: v.id, impact: v.impact, n: v.nodes.length, nodes: v.nodes.slice(0, 4).map(n => ({ t: n.target.join(' '), s: (n.any[0]?.message || n.failureSummary || '').slice(0, 160) })) }));
}
export async function bp(p) { const r = await new AxeBuilder({ page: p }).withTags(['best-practice']).analyze(); return r.violations.map(v => ({ id: v.id, n: v.nodes.length, t: v.nodes.slice(0,3).map(n => n.target.join(' ')) })); }
