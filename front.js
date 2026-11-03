// HWH Track Portal – FRONT PAGES (portal build chat, batch B1, 03-Nov-2026; designs 6 "Overview" and 8 "Three things", project doc HWH_Portal_LANDING.md).
// Division level (Sr DEN, DEN, co-ordination, admin) lands on the Overview; AEN / SSE / JE on "Three things" for their own unit. Both can switch.
// Every figure comes from the stored "watch" file (engine/watch.js, computed in the admin's browser after each data load) – a viewer downloads
// that one small file once (kept on the device), so the page opens without a long server wait. Waiting rules say which data kind they wait for.
(function () {
'use strict';
const H = window.HWHTP, UI = window.UI; const { $, esc, dmy, files, merge, snap, names, locator, VIEWS, go, call, toast, gzB64, ST } = H;
const HI = () => UI.lang() === 'hi';
const two = (en, hi) => HI() && hi ? `${esc(hi)}<span class="fx-2">${esc(en)}</span>` : `${esc(en)}${hi ? `<span class="fx-2">${esc(hi)}</span>` : ''}`;
const KIND_TXT = { inspections: 'trolley / foot / footplate inspections', itmsDefects: 'ITMS exceptions (from the report PDFs)', tqiHistory: 'TQI history since 2019', ballastCushion: 'TMS ballast report (clean cushion)', tampingDue: 'TMS tamping due list', omsRuns: 'OMS run list', gangWork: 'gang work', renewalDue: 'renewal proposals', waterLogging: 'water logging', trcRuns: 'TRC run list', health: 'TMS chart data', spotCards: 'spot cards', workSite: 'TMS work sites', fmc: 'Field Mini Control', condition: 'TMS condition layers', loopTurnoutsDue: 'a TMS list of loop-line turnouts due (the tamping list names turnouts by section-line only)', itmsWear: 'iTMS wear summary PDFs (lip flow / vertical / lateral)', tampingDue: 'TMS tamping due list', ballastCushion: 'TMS ballast register', ballast: 'ballast register', pnx: 'P&C register (asset changes)', feedWork: 'TMS Control work records', feedJobs: 'TMS Control jobs', machineProg: 'machine progress', assetChange: 'asset changes', trcRuns: 'TRC run list', itms: 'ITMS runs' };
const kindTxt = k => KIND_TXT[k] || k;

// ---------------------------------------------------------------- the watch file
const WS = { data: null, at: 0 };
async function watchGet(note) {
  if (WS.data) return WS.data;
  try { const fl = await files([{ kind: 'watch', group: '_all' }], note); WS.data = snap(fl, 'watch', '_all'); } catch (e) { WS.err = e.error || String(e); }
  return WS.data;
}
/** what the stored watch was computed from – when this differs, the admin's browser computes it again */
function inputsSig(b) {
  b = b || H.S.boot || {}; const K = b.kinds || {}; const o = {};
  ['health', 'spotCards', 'trcRuns', 'workSite', 'assetChange', 'machineProg', 'condition', 'itms', 'fmc', 'feed', 'ballastCushion', 'tampingDue', 'fmcDays'].forEach(k => { if (K[k]) o[k] = (K[k].presses || []).slice(-1)[0] + ':' + K[k].files; });
  const last = (b.fmc && b.fmc.lastRead) || {}; o.fmcAt = Object.values(last).map(x => x.at || '').sort().pop() || '';
  o.feedAt = (b.feed && b.feed.generatedAt) || ''; o.settings = JSON.stringify((b.settings || {}).watch || {}) + JSON.stringify(((b.settings || {}).rules || {}).tgi || {}) + ((b.settings || {}).rules || {}).cleanCushionMm;
  return JSON.stringify(o);
}
function watchStale() { const b = H.S.boot || {}; return !b.watch || b.watch.sig !== inputsSig(b); }
let RUNNING = null, WORKER = null, CANCEL = null;
/** admin only: compute the watch in a Web Worker (never on the page's main thread) and save it as kind "watch". Background, cancellable. */
let AGAIN = false;
async function watchUpdate(say) {
  if (RUNNING) { AGAIN = true; return RUNNING.then(() => { if (AGAIN) { AGAIN = false; return watchUpdate(say); } return WS.data; }); }   // new data came in meanwhile: once more
  say = say || (() => { });
  RUNNING = new Promise((resolve, reject) => {
    const b = H.S.boot || {}; const K = b.kinds || {};
    if (!K.health && !K.spotCards) { say('Blind-spot watch: nothing to compute yet – load TMS data first.'); resolve(null); return; }
    let w; try { w = new Worker('watch.worker.js?v=' + (H.CFG.VERSION || '')); } catch (e) { reject({ error: 'This browser cannot run the watch in the background: ' + (e.message || e) }); return; }
    WORKER = w;
    CANCEL = () => { w.terminate(); WORKER = null; say('Blind-spot watch: cancelled – the last stored watch stays.'); reject({ error: 'cancelled', cancelled: true }); };
    w.onmessage = ev => {
      const m = ev.data || {};
      if (m.t === 'say') say(m.text);
      else if (m.t === 'done') { w.terminate(); WORKER = null; WS.data = m.W; if (H.S.boot) { H.S.boot.watch = m.summary; ST.set('kv', H.BOOTKEY, H.S.boot).catch(() => { }); } say('Blind-spot watch saved – Overview and Three things show it now.'); resolve(m.W); }
      else if (m.t === 'error') { w.terminate(); WORKER = null; reject({ error: m.error }); }
    };
    w.onerror = e => { w.terminate(); WORKER = null; reject({ error: 'watch worker: ' + (e.message || 'failed') }); };
    w.postMessage({ cmd: 'run', api: H.CFG.API, token: H.token(), settings: H.settings(), boot: b, sig: inputsSig(b) });
  });
  try { return await RUNNING; } finally { RUNNING = null; CANCEL = null; }
}
H.watchCancel = () => { if (CANCEL) CANCEL(); };
H.watchRunning = () => !!RUNNING;
H.watchUpdate = watchUpdate; H.watchStale = watchStale; H.watchClear = () => { WS.data = null; };

// ---------------------------------------------------------------- scope
const SC = { kind: null, value: '' };
function myScope() {
  const b = H.S.boot || {};
  if (SC.kind) return SC;
  if (b.level === 'unit' && b.unit) return { kind: 'unit', value: b.unit };
  if (b.level === 'aen' && b.aen) return { kind: 'aen', value: b.aen };
  return { kind: 'division', value: '' };
}
function homeUnit(W) {
  const b = H.S.boot || {}; if (SC.kind === 'unit') return SC.value;
  if (b.unit) return b.unit;
  const U = Object.values(W.units || {}).filter(u => u.unit !== '?').sort((a, b) => (b.cells || 0) - (a.cells || 0)); return U[0] ? U[0].unit : '';
}
const unitsIn = (W, sc) => PE.scopeUnits(W, sc);
const scopeName = sc => sc.kind === 'division' ? (HI() ? 'मंडल' : 'Division') : sc.value;

// ---------------------------------------------------------------- [PB] B2: line type switch – Main line | Loop lines | All (default Main line, kept per viewer)
const LTK = 'hwhtp.ltview'; let LTVv = 'main'; try { LTVv = localStorage.getItem(LTK) || 'main'; } catch (e) { }
if (!/^(main|loop|all)$/.test(LTVv)) LTVv = 'main';
const LTV = () => LTVv;
function setLTV(v) { LTVv = v; try { localStorage.setItem(LTK, v); } catch (e) { } H.render(); }
H.ltView = LTV; H.setLtView = v => { LTVv = v; try { localStorage.setItem(LTK, v); } catch (e) { } };
const ltLab = v => { const L = PE.LT_LABEL[v || LTV()]; return ' · ' + (HI() ? L[1] : L[0].toLowerCase()); };
const ltTag = (t, sub) => `<span class="fx-lt ${t || 'unk'}">${esc(t ? (HI() ? { main: 'मुख्य', loop: 'लूप', siding: 'साइडिंग' }[t] : PE.LT_TAG[t]) : (HI() ? 'अज्ञात' : 'type?'))}</span>${sub ? `<span class="fx-lt sub">${esc(sub)}</span>` : ''}`;
function cushTh(v) { const R = H.settings().rules || {}; const B = (R.byLineType || {})[v === 'loop' ? 'loop' : 'main'] || {}; return { u: B.cushionUrgentMm || 100, p: B.cleanCushionMm || R.cleanCushionMm || 150 }; }
function ltSwitch() { return `<div class="fx-ltsw" role="group" aria-label="line type">${['main', 'loop', 'all'].map(v => `<button data-lt="${v}" class="${v === LTV() ? 'on' : ''}">${esc(HI() ? PE.LT_LABEL[v][1] : PE.LT_LABEL[v][0])}</button>`).join('')}</div>`; }

// ---------------------------------------------------------------- small drawings
function spark(monthly, cls) {
  const pts = (monthly || []).filter(x => x[1] != null);
  if (!pts.length) return '<div class="fx-nospark">no history yet</div>';
  const vals = (monthly || []).map(x => x[1]); const max = Math.max(1, ...pts.map(x => x[1])); const n = vals.length; const w = 120, h = 30;
  const xy = (v, i) => [Math.round(i * (w - 4) / Math.max(1, n - 1)) + 2, Math.round(h - 3 - (v / max) * (h - 6))];
  if (pts.length < 3) return `<svg class="fx-spark ${cls || ''}" viewBox="0 0 ${w} ${h}" aria-hidden="true">${vals.map((v, i) => v == null ? '' : (p => `<circle cx="${p[0]}" cy="${p[1]}" r="2.6"/>`)(xy(v, i))).join('')}</svg><div class="fx-nospark">${pts.length} month${pts.length > 1 ? 's' : ''} – too few for a trend</div>`;
  let d = '', pen = false; vals.forEach((v, i) => { if (v == null) { pen = false; return; } const p = xy(v, i); d += (pen ? 'L' : 'M') + p[0] + ' ' + p[1]; pen = true; });
  return `<svg class="fx-spark ${cls || ''}" viewBox="0 0 ${w} ${h}" aria-hidden="true"><path d="${d}" fill="none" stroke-width="2"/></svg>`;
}
function ring(pct) {
  const r = 66, c = 2 * Math.PI * r, v = pct == null ? 0 : Math.max(0, Math.min(100, pct));
  return `<svg viewBox="0 0 160 160" class="fx-ring" role="img" aria-label="watch score ${pct == null ? 'not known' : pct}"><circle cx="80" cy="80" r="${r}" fill="none" stroke="rgba(255,255,255,.18)" stroke-width="14"/><circle cx="80" cy="80" r="${r}" fill="none" stroke="#F29A2E" stroke-width="14" stroke-linecap="round" stroke-dasharray="${(c * v / 100).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 80 80)"/><text x="80" y="90" text-anchor="middle" class="fx-ringv">${pct == null ? '—' : pct}</text></svg>`;
}
const kmTxt = r => r.lid ? `${esc(r.lid)} · ${PE.fmtKm(r.km, r.m)}${r.km2 != null && (r.km2 !== r.km || r.m2 !== r.m) ? '–' + PE.fmtKm(r.km2, r.m2) : ''}${r.approx ? ' <span class="fx-chip">approx</span>' : ''}` : '';
function dataLine(W) {
  const now = new Date().toISOString(); const src = [['tms', 'TMS data', 'टीएमएस डेटा'], ['fmc', 'Field sheet', 'फ़ील्ड शीट'], ['feed', 'TMS Control', 'टीएमएस कंट्रोल']];
  return `<div class="fx-data">${src.map(([k, en, hi]) => { const d = (W.dataAt || {})[k]; const st = PE.staleDate(W, k, now); return `<span class="${st ? 'fx-stale' : ''}">${esc(HI() ? hi : en)} <b>${d ? dmy(String(d).slice(0, 10)) : '—'}</b>${st ? ' · ' + (HI() ? 'पुराना' : 'old') : ''}</span>`; }).join('')}<span>${HI() ? 'गणना' : 'computed'} <b>${dmy(String(W.computedAt || '').slice(0, 10))}</b></span></div>`;
}
function langBtn() { return `<button class="fx-lang" data-fxlang="${HI() ? 'en' : 'hi'}" aria-label="language">${HI() ? 'EN' : 'हिं'}</button>`; }
function head(title, hi, right) {
  return `<header class="fx-head"><div class="fx-brand"><b>${esc((UI.APP.short || 'HWH').split(' ')[0])}</b><span>TRACK</span></div><div class="fx-ht">${two(title, hi)}</div><div class="fx-hr">${right || ''}${langBtn()}</div></header>`;
}
function bottomNav(on) {
  const A = (H.S.boot || {}).role === 'admin';
  const it = [['ov', 'Overview', 'अवलोकन', 'M3 13h8V3H3zm10 8h8V11h-8zM3 21h8v-6H3zm10-18v6h8V3z'], ['home', 'Three things', 'तीन काम', 'M4 6h16M4 12h16M4 18h10'], ['loc', 'Location', 'स्थान', 'M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7z'], ['reg', 'Work', 'कार्य', 'M4 4h16v16H4zM8 9h8M8 13h8M8 17h5']].concat(A ? [['rules', 'Admin', 'एडमिन', 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM2 12h3m14 0h3M12 2v3m0 14v3']] : []);
  return `<nav class="fx-nav">${it.map(([k, en, hi, d]) => `<button data-go="${k}" class="${k === on ? 'on' : ''}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="${d}"/></svg><span>${esc(HI() ? hi : en)}</span></button>`).join('')}</nav>`;
}
function wire(el) {
  el.querySelectorAll('[data-go]').forEach(b => b.onclick = () => { const g = b.dataset.go; if (g === 'ov' || g === 'home' || g === 'rules') go(g); else { document.body.classList.remove('front'); go(g, b.dataset.arg || null); } });
  el.querySelectorAll('[data-fxlang]').forEach(b => b.onclick = () => UI.setLang(b.dataset.fxlang));
  el.querySelectorAll('[data-lt]').forEach(b => b.onclick = () => setLTV(b.dataset.lt));
  el.querySelectorAll('[data-place]').forEach(b => b.onclick = () => { document.body.classList.remove('front'); go('loc', b.dataset.place); });
}
const placeArg = r => r && r.lid && r.km != null ? `${r.lid}|${r.km}|${r.m || 0}` : '';
function goBtn(g) { if (!g) return ''; if (g.view === 'loc') return `data-place="${esc(g.arg)}"`; return `data-go="${esc(g.view)}"${g.arg ? ` data-arg="${esc(g.arg)}"` : ''}`; }

// waiting / empty page
function emptyPage(el, on, msg) {
  el.innerHTML = `<div class="fx">${head(on === 'ov' ? 'Overview' : 'Three things', on === 'ov' ? 'अवलोकन' : 'तीन काम')}<section class="fx-sec"><div class="fx-card"><h3>${esc(msg.t)}</h3><p>${esc(msg.p)}</p>${msg.btn || ''}</div></section>${bottomNav(on)}<div class="fx-credit">${UI.credit({ br: true })}</div></div>`;
  wire(el); const b = $('fxCompute'); if (b) b.onclick = () => computeHere(el, on);
}
async function computeHere(el, on) {
  const box = document.createElement('pre'); box.className = 'fx-log'; el.querySelector('.fx-sec').appendChild(box);
  const say = t => { box.textContent += t + '\n'; };
  try { await watchUpdate(say); go(on); } catch (e) { say('ERROR: ' + (e.error || e.message || e)); }
}
/** the small progress / status line under the scope bar: running (with Cancel) or "newer data held" (admin: Update now) */
function upd() {
  const n = $('fxUpd'); if (!n) return; const A = (H.S.boot || {}).role === 'admin';
  if (RUNNING) { n.innerHTML = `<span id="fxUpdT">${esc(H.lastSay || 'Updating the watch in the background…')}</span> <button class="fx-link" id="fxCancel">${HI() ? 'रद्द करें' : 'Cancel'}</button>`; $('fxCancel').onclick = () => H.watchCancel(); return; }
  if (A && watchStale()) { n.innerHTML = `${HI() ? 'नया डेटा उपलब्ध – निगरानी पुरानी है' : 'Newer data is held than this watch.'} <button class="fx-link" id="fxUpdNow">${HI() ? 'अभी अद्यतन करें' : 'Update now (in the background)'}</button>`; $('fxUpdNow').onclick = () => bgUpdate(); return; }
  n.innerHTML = '';
}
/** run the watch in the background from a front page; the page stays usable */
function bgUpdate() {
  const sayL = t => { H.lastSay = t.trim(); const x = $('fxUpdT'); if (x) x.textContent = H.lastSay; };
  const p = watchUpdate(sayL); upd();
  p.then(w => { H.lastSay = ''; if (w && (H.S.view === 'ov' || H.S.view === 'home')) H.render(); else upd(); }, e => { H.lastSay = ''; const n = $('fxUpd'); if (n) n.textContent = e.cancelled ? (HI() ? 'रद्द किया' : 'Cancelled – the last stored watch is shown.') : 'Could not update the watch: ' + (e.error || e.message || e); });
}
async function load(el, on) {
  document.body.classList.add('front');
  el.innerHTML = `<div class="fx">${head(on === 'ov' ? 'Overview' : 'Three things', on === 'ov' ? 'अवलोकन' : 'तीन काम')}<section class="fx-sec"><div class="fx-card"><h3>${HI() ? 'खुल रहा है…' : 'Opening…'}</h3><p id="fxNote" class="fx-muted">${HI() ? 'इस डिवाइस पर रखा डेटा' : 'Using the data kept on this device'}</p></div></section></div>`;
  const W = await watchGet(t => { const n = $('fxNote'); if (n) n.textContent = t; });
  const A = (H.S.boot || {}).role === 'admin';
  if (!W) { emptyPage(el, on, A ? { t: 'The blind-spot watch is not computed yet', p: 'It is computed on this PC from the stored files (about two server calls). It runs by itself after each Load TMS data, sheet read and feed read.', btn: '<button class="fx-btn" id="fxCompute">Compute the watch now</button>' } : { t: 'Not ready yet', p: WS.err || 'The division office has not computed the blind-spot watch yet. The Location card and the Work register work already.' }); return null; }
  // [B3a] opening a page never starts a computation: the last stored watch is shown at once; the admin gets a note when newer data is held
  setTimeout(() => upd(), 0);
  return W;
}

// ---------------------------------------------------------------- OVERVIEW (design 6)
VIEWS.ov = async (el) => {
  const W0 = await load(el, 'ov'); if (!W0) return;
  const LT = LTV(), loopV = LT === 'loop'; const W = PE.watchView(W0, LT);   // [PB] B2: every element follows the line-type switch
  const UA = Object.assign({}, W0.units || {}, W.units || {});
  const sc = myScope(); const U = PE.scopeUnits({ units: UA }, sc); const inU = r => sc.kind === 'division' || U.includes(r.unit || '?');
  const rules = W.rules || []; const B = rules.filter(r => r.group === 'B'), Hh = rules.filter(r => r.group === 'H'), Aa = rules.filter(r => r.group === 'A');
  const aens = [...new Set(Object.values(UA).map(u => u.aen).filter(Boolean))].sort(); const units = Object.keys(UA).filter(u => u !== '?').sort();
  const lines = (W.lines || []).filter(l => sc.kind === 'division' || l.units.some(u => U.includes(u)));
  // coverage in scope
  const cov = W.coverage || { seen: 0, partly: 0, blind: 0 }; const covU = sc.kind === 'division' ? cov : (() => { const b1 = rules.find(r => r.id === 'B1'); const cells = U.reduce((a, u) => a + ((W.units[u] || {}).cells || 0), 0); const blind = b1 && b1.status === 'ready' ? PE.ruleCount(b1, U) : 0; return { seen: Math.max(0, cells - blind), partly: 0, blind }; })();
  const totC = covU.seen + covU.partly + covU.blind || 1; const pc = x => Math.round(x / totC * 100);
  const blindKm = Math.round((covU.blind + covU.partly) * 0.2);
  const findLines = (W0.lines || []).filter(l => sc.kind === 'division' || l.units.some(u => U.includes(u)));
  const lab = ltLab(LT);
  const tile = r => {
    const n = PE.ruleCount(r, sc.kind === 'division' ? null : U);
    return `<div class="fx-tile ${r.status !== 'ready' ? 'wait' : n ? 'hot' : 'calm'}" ${r.status === 'ready' ? `data-rule="${esc(r.id)}" role="button" tabindex="0"` : ''}><div class="fx-th"><span class="fx-code">${esc(r.id)}</span><span class="fx-tt">${two(r.en, r.hi)}</span></div>
      ${r.status === 'ready' ? `<div class="fx-big">${n}<small> ${esc(r.unitText || 'records')}${esc(lab)}</small></div>${r.km != null && sc.kind === 'division' ? `<div class="fx-muted">≈ ${r.km} km</div>` : ''}${spark(r.monthly, n ? 'hot' : '')}` : `<div class="fx-waitt">${HI() ? 'डेटा की प्रतीक्षा' : 'waiting for data'}: ${esc(r.missing.map(kindTxt).join(', '))}</div>`}
      <div class="fx-rule">${esc(r.rule)}${r.note ? ` <i>(${esc(r.note)})</i>` : ''}</div></div>`;
  };
  const hidden = Hh.filter(r => r.status === 'ready').map(r => { const L = (r.records || []).filter(inU); return L.slice(0, 1).map(x => ({ r, x, more: L.length - 1 })); }).flat();
  const hcard = ({ r, x, more }) => `<div class="fx-hcard"><div class="fx-hk"><span class="fx-code dark">${esc(r.id)}</span> ${two(r.en, r.hi)} ${ltTag(x.lt, x.ls)}</div>${x.lid ? `<div class="fx-hloc">${kmTxt(x)}${x.unit ? ' · ' + esc(x.unit) : ''}</div>` : ''}<div class="fx-htitle">${esc(x.title)}</div>
    <div class="fx-hgrid"><div><div class="fx-lbl">${HI() ? 'केवल TMS दिखाता है' : 'TMS ALONE SHOWS'}</div><div>${esc(x.tms)}</div></div><div><div class="fx-lbl sun">${HI() ? 'जोड़कर दिखता है' : 'JOINED, WE SEE'}</div><div>${esc(x.seen)}</div></div></div>
    <div class="fx-src">${(r.src || []).map(s => `<span>${esc(s)}</span>`).join('')}${x.lid ? `<button class="fx-link" data-place="${esc(placeArg(x))}">${HI() ? 'साक्ष्य देखें' : 'See the evidence'} →</button>` : ''}</div>${more > 0 ? `<div class="fx-more">+ ${more} ${HI() ? 'और ऐसे स्थान' : 'more like this in this scope'}${r.more ? ' (' + (HI() ? 'सूची सीमित' : 'list capped') + ')' : ''}</div>` : ''}</div>`;
  const cellCls = (st) => st === 'ok' ? 'ok' : st === 'soon' ? 'soon' : st === 'over' ? 'over' : 'none';
  const trcSt = l => { if (!l.trc) return 'none'; if (l.trc.never) return l.trc.n >= l.cells ? 'none' : 'over'; const d = l.trc.days, lim = (W.freshDays && 0) || ((H.settings().watch || {}).trcDays || 120); return d <= lim * 0.8 ? 'ok' : d <= lim ? 'soon' : 'over'; };
  const itmsSt = l => { if (!l.itms) return 'none'; const lim = (H.settings().watch || {}).itmsDays || 365; return l.itms.days <= lim * 0.8 ? 'ok' : l.itms.days <= lim ? 'soon' : 'over'; };
  const proofSt = l => l.proof == null ? 'none' : l.proof >= 90 ? 'ok' : l.proof >= 60 ? 'soon' : 'over';
  const entrySt = l => l.proof == null && !l.gaps ? 'none' : l.gaps ? 'over' : 'ok';
  const cushSt = l => !l.cushion ? 'none' : l.cushion.pct >= 90 ? 'ok' : l.cushion.pct >= 60 ? 'soon' : 'over';
  const WCOL = loopV ? [['INSP', () => 'none', () => 'inspections not loaded'], ['CUSH', cushSt, l => l.cushion ? l.cushion.pct + ' % of ' + l.cushion.n + ' yard stretches measured' : 'no ballast register data'], ['CARDS', () => 'none', () => 'TMS spot cards are on section-lines – none on loop lines'], ['PROOF', proofSt, l => l.proof == null ? 'no sheet work' : l.proof + ' % with proof'], ['ENTRY', entrySt, l => l.gaps ? l.gaps + ' works not in TMS' : '']] : [['TRC', trcSt, l => l.trc && !l.trc.never ? 'last ' + dmy(l.trc.d) : l.trc && l.trc.never ? l.trc.n + ' × 200 m never run' : ''], ['OMS', () => 'none', () => 'OMS run list not loaded'], ['ITMS', itmsSt, l => l.itms ? 'last ' + dmy(l.itms.d) : 'no ITMS run'], ['INSP', () => 'none', () => 'inspections not loaded'], ['CUSH', () => 'none', () => 'ballast cushion not loaded'], ['PROOF', proofSt, l => l.proof == null ? 'no sheet work' : l.proof + ' % with proof'], ['ENTRY', entrySt, l => l.gaps ? l.gaps + ' works not in TMS' : '']];
  const today = PE.threeToday(W, sc.kind === 'division' ? null : U, H.settings().watch).slice(0, 5);
  const fast = (W.fast || []).filter(inU).slice(0, 8);
  const months = PE.lastMonths(W.today, 12);
  const heatRows = (W.heat && W.heat.lines || []).filter(l => lines.some(x => x.lid === l.lid));
  el.innerHTML = `<div class="fx">${head('Overview', 'अवलोकन', '')}
  <div class="fx-scope"><div class="fx-pills" role="group" aria-label="scope"><button data-sk="division" class="${sc.kind === 'division' ? 'on' : ''}">${HI() ? 'मंडल' : 'Division'}</button>
    <select data-sk="aen" class="${sc.kind === 'aen' ? 'on' : ''}" aria-label="AEN"><option value="">AEN ▾</option>${aens.map(a => `<option ${sc.kind === 'aen' && sc.value === a ? 'selected' : ''}>${esc(a)}</option>`).join('')}</select>
    <select data-sk="unit" class="${sc.kind === 'unit' ? 'on' : ''}" aria-label="SSE unit"><option value="">SSE ▾</option>${units.map(a => `<option ${sc.kind === 'unit' && sc.value === a ? 'selected' : ''}>${esc(a)}</option>`).join('')}</select></div>
    ${ltSwitch()}
    <div class="fx-find"><select id="fxLid" aria-label="line">${findLines.map(l => `<option>${esc(l.lid)}</option>`).join('')}</select><input id="fxKm" inputmode="numeric" placeholder="km" aria-label="km"><button class="fx-btn sm" id="fxGo">${HI() ? 'खोजें' : 'Find'}</button><button class="fx-btn sm ghost" id="fxWhere">${HI() ? 'मैं कहाँ हूँ' : 'Where am I'}</button></div>
    ${dataLine(W)}<div id="fxUpd" class="fx-upd"></div></div>

  <section class="fx-sec"><div class="fx-eyebrow">${two('Blind-spot watch', 'अनदेखे स्थानों की निगरानी')} · ${esc(scopeName(sc))}${esc(lab)}</div>
    ${loopV ? (c => `<h2 class="fx-h2">${c.yardStretches || 0} ${HI() ? 'यार्ड खंड' : 'yard stretches'} (${c.km || 0} km)${esc(lab)}</h2>
    <div class="fx-bar"><span class="seen" style="width:${c.yardStretches ? Math.round(c.measured / c.yardStretches * 100) : 0}%"></span><span class="blind" style="width:${c.yardStretches ? 100 - Math.round(c.measured / c.yardStretches * 100) : 100}%"></span></div>
    <div class="fx-legend"><span><i class="seen"></i>${HI() ? 'कुशन मापा' : 'cushion measured'} ${c.yardStretches ? Math.round(c.measured / c.yardStretches * 100) : 0} %</span><span><i class="blind"></i>${HI() ? 'डेटा नहीं' : 'no cushion data'}</span></div>`)(W.coverage || {}) : `<h2 class="fx-h2">${blindKm} ${HI() ? 'में से' : 'of'} ${Math.round(totC * 0.2)} km ${HI() ? 'ट्रैक समय पर रिकॉर्ड नहीं' : 'not recorded in time'}<small>${esc(lab)}</small></h2>
    <div class="fx-bar"><span class="seen" style="width:${pc(covU.seen)}%"></span><span class="partly" style="width:${pc(covU.partly)}%"></span><span class="blind" style="width:${pc(covU.blind)}%"></span></div>
    <div class="fx-legend"><span><i class="seen"></i>${HI() ? 'समय पर देखा' : 'seen in time'} ${pc(covU.seen)} %</span><span><i class="partly"></i>${HI() ? 'आंशिक' : 'partly'} ${pc(covU.partly)} %</span><span><i class="blind"></i>${HI() ? 'अनदेखा' : 'blind'} ${pc(covU.blind)} %</span></div>`}
    <div class="fx-muted small">${esc(cov.basis || '')}</div>
    <div class="fx-tiles">${B.map(tile).join('')}</div></section>

  <section class="fx-sec fx-dark"><div class="fx-eyebrow">${two('Hidden in the records', 'रिकॉर्ड में छिपा')}${esc(lab)}</div>
    <h2 class="fx-h2">${HI() ? 'जो अकेला TMS नहीं दिखाता' : 'What TMS alone does not show'}</h2>
    <div class="fx-hcards">${hidden.length ? hidden.map(hcard).join('') : `<div class="fx-hcard"><div class="fx-htitle">${HI() ? 'इस दायरे में कुछ नहीं' : 'Nothing found in this scope'}</div></div>`}</div>
    <div class="fx-hwait">${Hh.filter(r => r.status !== 'ready').map(r => `<span><b>${esc(r.id)}</b> ${esc(HI() ? r.hi : r.en)} – ${HI() ? 'प्रतीक्षा' : 'waiting for'}: ${esc(r.missing.map(kindTxt).join(', '))}</span>`).join('')}</div></section>

  <section class="fx-sec"><div class="fx-eyebrow">${two('Who is watching each line', 'हर लाइन पर कौन नज़र रख रहा है')}${esc(lab)}</div>
    <div class="fx-who"><div class="fx-wrow fx-whd"><span></span>${WCOL.map(c => `<span>${c[0]}</span>`).join('')}</div>
    ${lines.slice(0, 60).map(l => `<div class="fx-wrow"><span class="fx-wl">${esc(l.lid)}<small>${esc(l.units.filter(u => u !== '?').join(', '))}</small></span>${WCOL.map(c => { const st = c[1](l); return `<span class="fx-w ${cellCls(st)}" title="${esc(c[0] + ': ' + c[2](l))}"></span>`; }).join('')}</div>`).join('')}</div>
    <div class="fx-legend"><span><i class="w-ok"></i>${HI() ? 'समय पर' : 'in time'}</span><span><i class="w-soon"></i>${HI() ? 'जल्द देय' : 'due soon'}</span><span><i class="w-over"></i>${HI() ? 'अतिदेय' : 'overdue'}</span><span><i class="w-none"></i>${HI() ? 'कोई नहीं / डेटा नहीं' : 'nobody / no data'}</span></div></section>

  <section class="fx-sec"><div class="fx-eyebrow">${two('Needs action', 'कार्यवाही आवश्यक')}${esc(lab)}</div>
    <div class="fx-tiles act">${Aa.map(r => { const n = PE.ruleCount(r, sc.kind === 'division' ? null : U); const ex = r.extra || {}; const g = r.id === 'A1' && r.status === 'ready' ? (sc.kind === 'division' ? ex : U.reduce((a, u) => { const x = (ex.byUnit || {})[u]; if (x) { a.urgent += x.urgent; a.plan += x.plan; } return a; }, { urgent: 0, plan: 0 })) : null; return `<div class="fx-atile ${r.status !== 'ready' ? 'wait' : n ? 'hot' : 'calm'}" ${r.status === 'ready' ? `data-rule="${esc(r.id)}" role="button" tabindex="0"` : ''}><div class="fx-tt">${two(r.en + (r.id === 'A1' ? ' · clean cushion < ' + cushTh(LT).p + ' mm' : ''), r.hi)}</div>${r.status === 'ready' ? (g ? `<div class="fx-split"><div><div class="fx-big">${g.urgent}</div><div class="fx-anote">${HI() ? 'तत्काल' : 'urgent'} &lt; ${esc(cushTh(LT).u)} mm${sc.kind === 'division' && ex.urgentKm != null ? ' · ' + ex.urgentKm + ' km' : ''}</div></div><div><div class="fx-big">${g.plan}</div><div class="fx-anote">${HI() ? 'योजना' : 'plan'} ${esc(cushTh(LT).u)}–${esc(cushTh(LT).p - 1)} mm${sc.kind === 'division' && ex.planKm != null ? ' · ' + ex.planKm + ' km' : ''}</div></div></div><div class="fx-anote">${esc(r.unitText)}${esc(lab)}${ex.byUnit && sc.kind !== 'division' ? '' : ''}</div>` : `<div class="fx-big">${n}<small style="color:inherit"> ${esc(r.unitText || '')}${esc(lab)}${r.km != null && sc.kind === 'division' ? ' · ' + r.km + ' km' : ''}</small></div>${r.id === 'A2' && ex.turnouts != null ? `<div class="fx-anote">+ ${ex.turnouts} ${HI() ? 'टर्नआउट (मुख्य लाइन)' : 'turnouts on the main line'}</div>` : ''}`) + `${r.note && r.id !== 'A1' && r.id !== 'A2' ? `<div class="fx-anote">${esc(r.note)}</div>` : ''}${spark(r.monthly, 'light')}` : `<div class="fx-waitt">${HI() ? 'डेटा की प्रतीक्षा' : 'waiting for data'}: ${esc(r.missing.map(kindTxt).join(', '))}</div>`}</div>`; }).join('')}</div></section>

  <section class="fx-sec fx-two"><div><div class="fx-eyebrow">${two('Today', 'आज')}</div>
    <ol class="fx-today">${today.length ? today.map(t => `<li><span class="fx-chip">${esc(t.tag)}</span> ${t.lt !== undefined ? ltTag(t.lt) : ''}<b>${esc(t.title)}</b><div class="fx-muted">${esc(t.why)}</div><button class="fx-link" ${goBtn(t.go)}>${esc(t.btn)} →</button></li>`).join('') : `<li>${HI() ? 'आज कुछ ज़रूरी नहीं' : 'Nothing urgent in this scope'}</li>`}</ol></div>
    <div><div class="fx-eyebrow">${two('Getting worse fastest', 'सबसे तेज़ बिगड़ रहा')}${esc(lab)}</div>
    ${loopV ? `<div class="fx-muted">${HI() ? 'लूप लाइनों पर TRC / TQI नहीं चलता' : 'TRC / TQI do not run on loop lines – no trend here'}</div>` : fast.length ? `<table class="fx-tbl"><thead><tr><th>${HI() ? 'स्थान' : 'Place'}</th><th>TGI</th><th>${HI() ? 'गिरावट' : 'drop'}</th></tr></thead><tbody>${fast.map(f => `<tr data-place="${esc(f.lid + '|' + f.km + '|0')}"><td>${esc(f.lid)} km ${f.km}<small>${esc(f.unit || '')} · ${dmy(f.from)} → ${dmy(f.to)}</small></td><td>${f.tgi}</td><td class="hot">−${f.drop}</td></tr>`).join('')}</tbody></table>` : `<div class="fx-muted">${HI() ? 'TGI के कम से कम दो रन चाहिए' : 'Needs at least two TGI runs of a km'}</div>`}</div></section>

  <section class="fx-sec"><div class="fx-eyebrow">${two('Track quality month by month', 'माह-दर-माह ट्रैक गुणवत्ता')}</div>
    <div class="fx-muted small">${loopV ? (HI() ? 'लूप लाइनों पर TRC / TQI नहीं चलता' : 'TRC / TQI do not run on loop lines.') : HI() ? 'TMS TGI रन; खाली = उस माह कोई रन नहीं' : 'TMS TGI runs per km; share of km below ' + esc(W.heat ? W.heat.act : 50) + '. Blank = no run that month.'}</div>
    ${(r => r && !loopV ? `<div class="fx-waitt" style="margin-top:8px">${esc(HI() ? r.hi : r.en)} – ${HI() ? 'प्रतीक्षा' : 'waiting for data'}: ${esc((r.missing || []).map(kindTxt).join(', '))} <i>(${esc(r.rule)})</i></div>` : '')((W.rules || []).find(x => x.id === 'T1' && x.status !== 'ready'))}
    <div class="fx-heat"><div class="fx-hrow fx-hhd"><span></span>${months.map(m => `<span>${esc(m.slice(5))}</span>`).join('')}</div>${heatRows.length ? heatRows.map(l => { const by = {}; l.months.forEach(x => { by[x[0]] = x; }); return `<div class="fx-hrow"><span class="fx-wl">${esc(l.lid)}</span>${months.map(m => { const x = by[m]; if (!x) return '<span class="h0"></span>'; const s = x[2] / x[1]; return `<span class="${s === 0 ? 'h1' : s < 0.2 ? 'h2' : s < 0.5 ? 'h3' : 'h4'}" title="${esc(m + ': ' + x[1] + ' km run, ' + x[2] + ' below the limit')}"></span>`; }).join('')}</div>`; }).join('') : `<div class="fx-muted">${HI() ? 'इस दायरे में TGI डेटा नहीं' : 'No TGI data for this scope yet'}</div>`}</div>
    <div class="fx-legend"><span><i class="h1"></i>${HI() ? 'सब ठीक' : 'all fine'}</span><span><i class="h2"></i>&lt; 20 %</span><span><i class="h3"></i>&lt; 50 %</span><span><i class="h4"></i>≥ 50 %</span></div></section>
  ${bottomNav('ov')}<div class="fx-credit">${UI.credit({ br: true })}</div></div>`;
  wire(el);
  // [PB] B1a: a tile opens its list – every stretch / record with its place, text (e.g. screening month and source) and a link to the place
  el.querySelectorAll('[data-rule]').forEach(t => t.onclick = () => {
    const r = rules.find(x => x.id === t.dataset.rule); if (!r) return; const L = (r.records || []).filter(inU);
    H.modal(`<h3 style="margin:0 0 4px">${esc(r.id)} · ${esc(r.en)} <span class="small muted">${esc(r.hi)}</span></h3><div class="small muted">${esc(r.rule)}${r.note ? ' – ' + esc(r.note) : ''}</div>
      <div class="small" style="margin:6px 0">${L.length} listed${esc(lab)}${(sp => sp.length ? ' · incl. ' + sp.map(([k, n]) => n + ' ' + k.toLowerCase()).join(', ') : '')(Object.entries(r.special || {}))}${r.more ? ` (stored list holds the first ${(r.records || []).length} of ${(r.records || []).length + r.more})` : ''} · ${esc(scopeName(sc))}</div>
      <div style="max-height:60vh;overflow:auto"><table class="t compact"><tbody>${L.map(x => `<tr><td class="small nw">${x.lid ? esc(x.lid) + '<br>' + PE.fmtKm(x.km, x.m) + (x.km2 != null ? '–' + PE.fmtKm(x.km2, x.m2) : '') : esc(x.where || x.stn || '')}${x.unit ? '<br><span class="muted">' + esc(x.unit) + '</span>' : ''}</td><td class="small">${ltTag(x.lt, x.ls)} ${esc(x.text || x.title || '')}${x.seen ? '<div class="muted">' + esc(x.seen) + '</div>' : ''}</td><td>${x.lid && x.km != null ? `<button class="btn ghost sm" data-pl="${esc(placeArg(x))}">Open</button>` : ''}</td></tr>`).join('')}</tbody></table></div>`);
    document.querySelectorAll('#modalBody [data-pl]').forEach(b => b.onclick = () => { H.closeModal(); document.body.classList.remove('front'); go('loc', b.dataset.pl); });
  });
  el.querySelector('[data-sk="division"]').onclick = () => { SC.kind = 'division'; SC.value = ''; H.render(); };
  el.querySelectorAll('select[data-sk]').forEach(s => s.onchange = () => { if (!s.value) return; SC.kind = s.dataset.sk; SC.value = s.value; H.render(); });
  $('fxGo').onclick = () => { const km = parseFloat($('fxKm').value); if (isNaN(km)) { toast(HI() ? 'किमी लिखें' : 'Type the km', true); return; } document.body.classList.remove('front'); go('loc', `${$('fxLid').value}|${Math.floor(km)}|${Math.round((km % 1) * 1000)}`); };
  $('fxWhere').onclick = () => toast(HI() ? '"मैं कहाँ हूँ" के लिए OHE मास्ट / किमी सूची चाहिए – अभी लाइन और किमी चुनें.' : '"Where am I" needs the OHE mast / km list (not loaded yet) – pick the line and km for now.');
};

// ---------------------------------------------------------------- THREE THINGS (design 8)
VIEWS.home = async (el) => {
  const W0 = await load(el, 'home'); if (!W0) return;
  const LT = LTV(); const W = PE.watchView(W0, LT); const lab = ltLab(LT);
  const unit = homeUnit(W0); const b = H.S.boot || {};
  const U = SC.kind === 'aen' ? PE.scopeUnits({ units: Object.assign({}, W0.units, W.units) }, SC) : unit ? [unit] : null;
  const u = (W.units || {})[unit] || {};
  const weeks = Object.keys(W.weekly || {}).sort(); const thisW = PE.isoWeek(W.today); const prevW = weeks.filter(w => w < thisW).pop();
  const last = prevW && W.weekly[prevW] ? W.weekly[prevW][unit] : null;
  const three = PE.threeToday(W, U, H.settings().watch).slice(0, 3);
  const canPick = b.level !== 'unit' || b.role === 'admin';
  const units = Object.keys(Object.assign({}, W0.units, W.units)).filter(x => x !== '?').sort();
  const pill = canPick ? `<select class="fx-unit" id="fxUnit" aria-label="unit">${units.map(x => `<option ${x === unit ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select>` : `<span class="fx-unitp">${esc(unit)}</span>`;
  el.innerHTML = `<div class="fx">${head('Three things', 'तीन काम', pill)}
  <section class="fx-score"><div class="fx-ringw">${ring(u.score)}</div><div class="fx-st"><div class="fx-eyebrow light">${two('Watch score', 'निगरानी अंक')} · ${esc(unit || '—')}${esc(lab)}</div>
    <h2>${u.score == null ? (HI() ? 'अभी गणना नहीं' : 'Not computed yet') : u.score >= 80 ? (HI() ? 'आपका खंड अच्छी नज़र में है' : 'Your stretch is well watched') : u.score >= 50 ? (HI() ? 'कुछ जगहें छूट रही हैं' : 'Some stretches are slipping') : (HI() ? 'बहुत ट्रैक अनदेखा है' : 'Much of your track is not watched in time')}</h2>
    <div class="fx-lw">${last != null ? `${HI() ? 'पिछले सप्ताह' : 'Last week'} <b>${last}</b>` : (HI() ? 'पिछले सप्ताह का अंक अभी नहीं' : 'No value for last week yet')}</div>
    <ul class="fx-comp">${(u.components || []).map(c => `<li><b>${c.pct} %</b> ${esc(c.k)} <small>(${c.n})</small></li>`).join('')}${(u.missing || []).map(m => `<li class="miss">${HI() ? 'शामिल नहीं' : 'not counted'}: ${esc(m)}</li>`).join('')}</ul></div></section>
  <div class="fx-scope">${ltSwitch()}${dataLine(W)}<div id="fxUpd" class="fx-upd"></div></div>
  <section class="fx-sec"><div class="fx-eyebrow">${two('Do these three today', 'आज के तीन काम')}${esc(lab)}</div>
    <div class="fx-three">${three.length ? three.map((t, i) => `<div class="fx-tcard"><div class="fx-tn">${i + 1}</div><div class="fx-tb"><span class="fx-chip">${esc(t.tag)}</span> ${t.lt !== undefined ? ltTag(t.lt) : ''}<div class="fx-ttl">${esc(t.title)}</div><div class="fx-muted">${esc(t.why)}</div><button class="fx-btn" ${goBtn(t.go)}>${esc(t.btn)}</button></div></div>`).join('') : `<div class="fx-tcard"><div class="fx-tb"><div class="fx-ttl">${HI() ? 'आज कुछ ज़रूरी नहीं मिला' : 'Nothing pressing found for this unit'}</div><div class="fx-muted">${HI() ? 'केवल लोड हुए डेटा से' : 'From the data loaded so far only.'}</div></div></div>`}</div></section>
  <section class="fx-sec fx-big4"><button data-go="ov">${two('Full overview', 'पूरा अवलोकन')}</button><button data-go="loc">${two('Find a location', 'स्थान खोजें')}</button><button data-go="reg">${two('Work register', 'कार्य रजिस्टर')}</button><button class="dark" id="fxFoot">${two('Footplate mode', 'फुटप्लेट मोड')}</button></section>
  ${bottomNav('home')}<div class="fx-credit">${UI.credit({ br: true })}</div></div>`;
  wire(el);
  const s = $('fxUnit'); if (s) s.onchange = () => { SC.kind = 'unit'; SC.value = s.value; H.render(); };
  $('fxFoot').onclick = () => toast(HI() ? 'फुटप्लेट मोड अगले चरण में' : 'Footplate mode comes in a later batch');
};

// [PB] B2a: every distinct line name the program could not type – the user assigns them in Settings (lineType lists), no build needed
function unknownNames(W) {
  const L = (W && W.unknownNames) || []; const lt = (W && W.lineTypes) || {};
  const split = Object.entries(lt).map(([k, c]) => `<tr><td>${esc(kindTxt(k))}</td><td>${c.main}${Object.keys(c).filter(x => !['main', 'loop', 'siding', 'unknown', 'total'].includes(x)).map(x => ` <span class="small muted">(incl. ${c[x]} ${esc(x.toLowerCase())})</span>`).join('')}</td><td>${c.loop}</td><td>${c.siding}</td><td>${c.unknown ? `<b class="od">${c.unknown}</b>` : 0}</td></tr>`).join('');
  return `<h3 style="margin:18px 0 6px">Line type – main / loop / siding / unknown</h3><div class="scroll"><table class="t compact" id="ltSplit"><thead><tr><th>Data</th><th>Main</th><th>Loop</th><th>Siding</th><th>Unknown</th></tr></thead><tbody>${split}</tbody></table></div>
  <h3 style="margin:18px 0 6px">Line names not typed yet (${L.length})</h3><p class="small muted">Assign them in Settings → Advanced JSON → <code>lineType</code>: add the name (or a pattern) to <code>loop</code>, <code>siding</code> or <code>mainNamed</code>. The watch is computed again by itself.</p>
  ${L.length ? `<div class="scroll" style="max-height:420px"><table class="t compact" id="ltUnknown"><thead><tr><th>Line name</th><th>Station / section</th><th>Data</th><th>Count</th><th>Why</th></tr></thead><tbody>${L.map(x => `<tr><td><code>${esc(x.name)}</code></td><td>${esc(x.station || '—')}</td><td class="small">${esc(kindTxt(x.kind))}</td><td>${x.n}</td><td class="small muted">${esc(x.why)}</td></tr>`).join('')}</tbody></table></div>` : '<div class="muted">None.</div>'}`;
}
// ---------------------------------------------------------------- ADMIN: the rule registry
VIEWS.rules = async (el) => {
  document.body.classList.remove('front');
  el.innerHTML = H.pageHead('Rules – blind spots and hidden findings', 'Every rule of the watch: ready, or waiting for a kind of data. Thresholds are in Settings → watch.') + '<div id="ruBox" class="muted">Loading…</div>';
  const W = await watchGet(); const b = H.S.boot || {};
  const reg = PE.WATCH_RULES; const got = {}; ((W && W.rules) || []).forEach(r => { got[r.id] = r; });
  const S = H.settings().watch || {};
  $('ruBox').outerHTML = `<div class="panel body"><div class="inner"><div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center"><button class="btn primary" id="ruGo">Update the watch now</button><span class="small muted">${W ? 'computed ' + esc(String(W.computedAt).slice(0, 16).replace('T', ' ')) + (watchStale() ? ' · <b class="od">older than the data held</b>' : ' · up to date') : 'not computed yet'}</span></div><pre id="ruLog" class="log hidden" style="margin-top:8px;white-space:pre-wrap"></pre></div></div>
  <div class="panel body" style="margin-top:12px"><div class="inner"><div class="scroll"><table class="t compact"><thead><tr><th>Id</th><th>Rule</th><th>Status</th><th>Count</th><th>Needs</th><th>Thresholds (Settings → watch)</th></tr></thead><tbody>
  ${reg.map(r => { const g = got[r.id] || {}; const miss = (r.needs || []).filter(k => !(g.status === 'ready')); const st = g.status || (r.run ? 'not computed' : 'waiting'); return `<tr><td><b>${esc(r.id)}</b></td><td class="wrap"><b>${esc(r.en)}</b> · ${esc(r.hi)}<div class="small">${esc(r.rule)}</div>${g.note ? `<div class="small muted">${esc(g.note)}</div>` : ''}${g.error ? `<div class="small od">${esc(g.error)}</div>` : ''}</td><td><span class="tag ${st === 'ready' ? 't3' : st === 'error' ? 't1' : 't2'}">${esc(st)}</span>${st === 'waiting' ? `<div class="small">for: ${esc(((g.missing && g.missing.length ? g.missing : r.needs) || []).map(kindTxt).join(', '))}</div>` : ''}</td><td>${g.count != null ? g.count : '—'}</td><td class="small">${esc((r.needs || []).map(kindTxt).join(', '))}${(r.later || []).length ? `<div class="muted">later: ${esc(r.later.map(kindTxt).join(', '))}</div>` : ''}</td><td class="small">${(r.thresholds || []).map(k => `${esc(k)} = <b>${esc(S[k])}</b>`).join('<br>') || '—'}</td></tr>`; }).join('')}
  </tbody></table></div>${unknownNames(W)}<p class="small muted">A new rule is one entry in engine/watch.js (PE.addWatchRule) – the screens list whatever the registry holds. Only exactly placed events count; block-section / station-only records never do.</p></div></div>`;
  $('ruGo').onclick = async () => { $('ruGo').disabled = true; const lg = $('ruLog'); lg.classList.remove('hidden'); lg.textContent = ''; try { await watchUpdate(t => { lg.textContent += t + '\n'; }); H.render(); } catch (e) { lg.textContent += 'ERROR: ' + (e.error || e.message || e); } $('ruGo').disabled = false; };
};
})();
