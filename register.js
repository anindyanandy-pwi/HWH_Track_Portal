// HWH Track Portal – WORK REGISTER (brief A5): every work package (Field Mini Control proof ⟷ TMS work site), filters unit / type / date /
// outcome, per-unit counts of TMS entry gaps (sheet only) and missing proof (TMS only, or sheet record without its certificates / photos).
(function () {
'use strict';
const H = window.HWHTP, UI = window.UI; const { $, esc, dmy, B, files, merge, snap, names, locator, pageHead, VIEWS, go, modal } = H;
const OUT = { matched: ['matched', 't3', 'Matched'], 'sheet only': ['sheet only', 't1', 'Sheet only – TMS entry gap'], 'tms only': ['tms only', 't2', 'TMS only – proof missing'], 'not checked': ['not checked', 't3', 'TMS – sheet not read for that day'] };
let REG = null;
VIEWS.reg = async (el) => {
  el.innerHTML = pageHead('Work register', 'Field Mini Control work proof matched to TMS work sites – date ± 1 day, SSE unit, line, km, block timing') + `<div id="regBox"><div class="busy"><div class="eyebrow">Loading</div><h2>Work register</h2><div id="rnote" class="small muted">Getting work sites, sheet records and recent changes…</div><div class="bar"><div style="width:50%"></div></div></div></div>`;
  const note = t => { const n = $('rnote'); if (n) n.textContent = t; };
  try {
    if (!REG) {
      const L = await locator(note); const N = names();
      const fl = await files([{ kind: 'workSite', group: '_all' }, { kind: 'fmc', group: '*' }, { kind: 'assetChange', group: '_all' }, { kind: 'machineProg', group: '_all' }, { kind: 'spotCards', group: '_all' }, { kind: 'feed', group: '_all' }, { kind: 'fmcDays', group: '*' }], note);
      const feed = snap(fl, 'feed', '_all') || { work: [], units: [] };
      const S0 = H.settings(); const fmc = PE.fmcLocate(merge(fl, 'fmc').map(r => PE.fmcClean(r, S0)).filter(Boolean), L); const ws = merge(fl, 'workSite', '_all');   // [PB] B2: "----" rows are not work
      fmc.forEach(r => PE.lineType(r, 'fmc', N)); ws.forEach(r => PE.lineType(r, 'workSite', N));
      const cov = {}; Object.entries((H.S.boot && H.S.boot.fmc && H.S.boot.fmc.coverage) || {}).forEach(([d, v]) => { cov[d] = v; });
      const pk = PE.buildPackages(fmc, ws, { ac: merge(fl, 'assetChange', '_all'), mp: merge(fl, 'machineProg', '_all'), fw: feed.work || [], sc: merge(fl, 'spotCards', '_all') }, { S: H.settings(), N, coverage: cov });
      pk.forEach(p => { const t = p.fmc ? p.fmc.ltp : p.ws[0] ? p.ws[0].ltp : null; p.lt = t; p.ls = p.fmc ? p.fmc.ltsub : p.ws[0] ? p.ws[0].ltsub : ''; });
      REG = { pk, fmc, ws, units: feed.units || [], days: merge(fl.filter(f => f.kind === 'fmcDays'), 'fmcDays') };
    }
    draw($('regBox'));
  } catch (e) { $('regBox').innerHTML = `<div class="panel body"><div class="inner"><b>Could not load:</b> ${esc(e.error || e.message || e)}</div></div>`; }
};
VIEWS.reg.clear = () => { REG = null; };
const F = { unit: '', type: '', out: '', from: '', to: '', q: '', lt: null }; let SHOW = 40;
const LTN = { main: 'Main line', loop: 'Loop lines', all: 'All lines' };
const ltOk = (p, v) => v === 'all' || (v === 'main' ? p.lt === 'main' : v === 'loop' ? (p.lt === 'loop' || p.lt === 'siding') : v === 'unknown' ? !p.lt : true);
const ltTagR = (t, sub) => `<span class="tag ${t === 'main' ? 't3' : t ? 't2' : 't1'}">${t ? PE.LT_TAG[t] + ' line' : 'line type unknown'}</span>${sub ? ` <span class="tag t3">${esc(sub)}</span>` : ''}`;
const d10 = d => { const m = String(d || '').match(/^(\d{4})-(\d\d)-(\d\d)/); return m ? `${m[3]}-${m[2]}-${m[1]}` : (d || ''); };
const OUTS = ['matched', 'sheet only', 'tms only', 'not checked'];
const SHORT = { matched: 'In both', 'sheet only': 'Only in Field Mini Control', 'tms only': 'Only in TMS', 'not checked': 'Not compared yet' };
function chips() {
  const c = [];
  if (F.unit) c.push(['unit', 'Unit ' + F.unit]); if (F.type) c.push(['type', F.type]); if (F.out) c.push(['out', SHORT[F.out]]);
  if (F.from) c.push(['from', 'from ' + d10(F.from)]); if (F.to) c.push(['to', 'to ' + d10(F.to)]); if (F.q) c.push(['q', '"' + F.q + '"']);
  if (F.lt && F.lt !== 'main') c.push(['lt', F.lt === 'unknown' ? 'Line type unknown' : LTN[F.lt]]);
  return c;
}
function draw(box) {
  const P = REG.pk; const units = [...new Set(P.map(p => p.u).filter(Boolean))].sort();
  const firstSheet = REG.fmc.map(r => r.date).sort()[0];
  if (F.from === '' ) F.from = firstSheet ? PE.addDays(firstSheet, -1) : '';
  const types = [...new Set(P.map(p => typeKey(p.type)).filter(Boolean))].sort();
  if (!F.lt) F.lt = (H.ltView && H.ltView()) || 'main';
  const base = P.filter(p => ltOk(p, F.lt) && (!F.unit || p.u === F.unit) && (!F.type || typeKey(p.type) === F.type) && (!F.from || p.date >= F.from) && (!F.to || p.date <= F.to) && (!F.q || JSON.stringify([p.type, p.lid, p.fmc && p.fmc.bs, p.u]).toLowerCase().includes(F.q.toLowerCase())));
  const view = base.filter(p => !F.out || p.outcome === F.out);
  const C = PE.packageCounts(base);
  const tot = k => base.filter(p => p.outcome === k).length;
  const dates = base.map(p => p.date).filter(Boolean).sort(); const span = dates.length ? `${d10(dates[0])} to ${d10(dates[dates.length - 1])} (IST dates)` : 'no dates';
  const scope = `${F.lt === 'unknown' ? 'line type unknown' : LTN[F.lt].toLowerCase()} · ${F.unit ? 'unit ' + F.unit : 'all units'} · ${span}`;
  const band = k => (PE.BAND[k] || {}).c || 'neu';
  box.innerHTML = `<div class="wsum">${OUTS.map(k => `<button class="wst ${band(k)} ${F.out === k ? 'on' : ''}" data-out="${k}"><b>${tot(k)}</b><span>${esc((PE.BAND[k] || {}).t || k)}</span></button>`).join('')}</div>
  <div class="small muted" style="margin:6px 2px">${base.length} work packages · ${esc(scope)}. A work package = one work, looked for in Field Mini Control and in TMS work sites (date ± 1 day, same SSE unit, line, km).</div>
  <div class="wbar"><button class="btn secondary sm" id="fOpen">Filter${chips().length ? ' (' + chips().length + ')' : ''}</button><input id="fQ" placeholder="Search work, place, unit" value="${esc(F.q)}" aria-label="search">
    <div class="wchips">${chips().map(([k, t]) => `<button class="wchip" data-rm="${k}" aria-label="remove filter ${esc(t)}">${esc(t)} <span aria-hidden="true">×</span></button>`).join('')}</div></div>
  ${F.unit ? dayStrip(F.unit) : ''}
  <div class="wcards">${view.slice(0, SHOW).map(p => card(p, P.indexOf(p))).join('') || '<div class="panel body"><div class="inner muted">No work package in this filter.</div></div>'}</div>
  ${view.length > SHOW ? `<button class="btn secondary" id="fMore" style="width:100%;margin-top:10px">Show more (${view.length - SHOW} more of ${view.length})</button>` : view.length ? `<div class="small muted" style="margin-top:8px">All ${view.length} shown.</div>` : ''}
  <details style="margin-top:14px"><summary class="small"><b>Per unit</b> – gaps and missing proof (${C.length} units, ${esc(scope)})</summary><div class="scroll"><table class="t compact"><thead><tr><th>Unit</th><th>Work packages</th><th>In both</th><th>Only in Field Mini Control (not in TMS)</th><th>Only in TMS (no sheet record)</th><th>Not compared yet</th><th>Sheet records with proof missing</th></tr></thead><tbody>${C.map(u => `<tr data-u="${esc(u.unit)}" style="cursor:pointer"><td><b>${esc(u.unit)}</b></td><td>${u.total}</td><td>${u.matched}</td><td>${u['sheet only'] ? `<b class="od">${u['sheet only']}</b>` : 0}</td><td>${u['tms only'] ? `<b class="od">${u['tms only']}</b>` : 0}</td><td>${u['not checked']}</td><td>${u.proofMissing ? `<b class="od">${u.proofMissing}</b>` : 0}</td></tr>`).join('')}</tbody></table></div></details>`;
  const re = () => { SHOW = 40; draw(box); };
  $('fQ').onchange = e => { F.q = e.target.value.trim(); re(); };
  $('fOpen').onclick = () => {
    modal(`<h3 style="margin:0 0 10px">Filter work packages</h3><div class="wform">
      <label>Line type<select id="mLt">${['main', 'loop', 'all', 'unknown'].map(v => `<option value="${v}" ${v === F.lt ? 'selected' : ''}>${v === 'unknown' ? 'Line type unknown' : LTN[v]}</option>`).join('')}</select></label>
      <label>Unit<select id="mU"><option value="">All units</option>${units.map(u => `<option ${u === F.unit ? 'selected' : ''}>${esc(u)}</option>`).join('')}</select></label>
      <label>Work type<select id="mT"><option value="">All work types</option>${types.map(u => `<option ${u === F.type ? 'selected' : ''}>${esc(u)}</option>`).join('')}</select></label>
      <label>Where it is<select id="mO"><option value="">All</option>${OUTS.map(k => `<option value="${k}" ${k === F.out ? 'selected' : ''}>${esc(PE.BAND[k].t)}</option>`).join('')}</select></label>
      <label>From (date)<input id="mF" type="date" value="${esc(F.from || '')}"></label><label>To (date)<input id="mTo" type="date" value="${esc(F.to)}"></label></div>
      <div style="display:flex;gap:8px;margin-top:12px"><button class="btn primary" id="mGo">Show</button><button class="btn ghost" id="mClr">Clear all</button></div>`);
    $('mGo').onclick = () => { F.lt = $('mLt').value; if (F.lt !== 'unknown' && H.setLtView) H.setLtView(F.lt); F.unit = $('mU').value; F.type = $('mT').value; F.out = $('mO').value; F.from = $('mF').value; F.to = $('mTo').value; H.closeModal(); re(); };
    $('mClr').onclick = () => { Object.assign(F, { unit: '', type: '', out: '', from: null, to: '', q: '', lt: 'main' }); H.closeModal(); re(); };
  };
  box.querySelectorAll('[data-rm]').forEach(b => b.onclick = () => { const k = b.dataset.rm; F[k] = k === 'lt' ? 'main' : k === 'from' ? null : ''; re(); });
  box.querySelectorAll('[data-out]').forEach(k => k.onclick = () => { F.out = F.out === k.dataset.out ? '' : k.dataset.out; re(); });
  box.querySelectorAll('tr[data-u]').forEach(r => r.onclick = () => { F.unit = r.dataset.u; re(); });
  box.querySelectorAll('[data-i]').forEach(r => r.onclick = () => detail(P[+r.dataset.i]));
  const m = $('fMore'); if (m) m.onclick = () => { SHOW += 40; draw(box); };
}
function card(p, i) {
  const s = PE.packageStory(p); const r = p.fmc;
  const pm = r ? PE.proofMissing(r) : null;
  return `<article class="wcard" data-i="${i}" role="button" tabindex="0"><div class="wband ${s.bandCls}">${s.bandCls === 'ok' ? '✓ ' : ''}${esc(s.band)}</div>
    <div class="wbody"><div class="wtop"><b>${esc(p.type || 'work not described')}</b><span class="small muted">${d10(p.date)} · unit ${esc(p.u || '?')}</span>${p.lt !== 'main' ? ' ' + ltTagR(p.lt, p.ls) : p.ls ? ' <span class="tag t3">' + esc(p.ls) + '</span>' : ''}</div>
    <div class="wline">${esc(s.fmcLine)}</div><div class="wline">${esc(s.tmsLine)}</div>
    ${r ? `<div class="wline ${pm.length ? 'od' : ''}">Proof: ${PE.proofCells(r).length - pm.length} of ${PE.proofCells(r).length} present${pm.length ? ' – missing: ' + esc(pm.map(PE.proofName).join(', ')) : ''}</div>` : ''}
    ${s.todo.length ? `<div class="wtodo">To do: ${esc(s.todo[0])}${s.todo.length > 1 ? ` <span class="small">(+${s.todo.length - 1} more)</span>` : ''}</div>` : ''}</div></article>`;
}
const typeKey = t => { t = String(t || '').toLowerCase(); for (const [k, re] of [['AT / SKV welding', /weld|skv|thermit/], ['Destressing', /destress|distress|de-stress/], ['SEJ', /sej/], ['Rail renewal / change', /rail|trr|panel/], ['Machine (tamping / UTV / PQRS)', /unimat|duomatic|tamp|utv|pqrs|dtex|machine|m\/c|bcm|t\/ex/], ['Ballast / screening', /ballast|screen/], ['Sleeper', /sleeper|tsr|h\/beam/], ['Glued joint', /glue/], ['Greasing / lubrication', /greas|lubric/], ['Points & crossings', /switch|crossing|point|x-ing|lhs|turnout/]]) if (re.test(t)) return k; return t ? 'Others' : ''; };
function proofCell(r) { const m = PE.proofMissing(r); const n = PE.proofCells(r).length - m.length; return m.length ? `${n} of ${PE.proofCells(r).length} · <span class="od">missing ${m.length}</span>` : `${n} of ${n} ✓`; }
/** [PB] B2: the unit's days – "work reported" / "nil report" (only ----, not a problem) / "not filled" (all blank) */
function dayStrip(u) {
  const D = (REG.days || []).filter(d => d.u === u).sort((a, b) => String(b.date).localeCompare(String(a.date)) || String(a.tab).localeCompare(String(b.tab))).slice(0, 60);
  if (!D.length) return '<div class="small muted" style="margin-top:6px">Days of this unit: known from the next sheet read.</div>';
  const cls = { 'work reported': 't3', 'nil report': 't3', 'not filled': 't1' };
  return `<details style="margin-top:6px"><summary class="small">Days of ${esc(u)} in the sheet – work reported / nil report / not filled</summary><div class="small" style="display:flex;flex-wrap:wrap;gap:4px;margin-top:4px">${D.map(d => `<span class="tag ${cls[d.status] || 't3'}" title="${esc(d.tab)}">${dmy(d.date)} ${d.kind}: ${esc(d.status)}</span>`).join('')}</div></details>`;
}
function att(p) { const a = p.att || {}; const s = []; if (a.ac.length) s.push(a.ac.length + ' asset change'); if (a.mp.length) s.push(a.mp.length + ' machine'); if (a.fw.length) s.push(a.fw.length + ' app record'); if (a.sc.length) s.push(a.sc.length + ' card compliance'); return s.join(' · ') || '—'; }
function detail(p) {
  const s = PE.packageStory(p); const r = p.fmc, w = p.ws[0];
  const pr = s.proofs.map(x => `<li class="${x.ok ? '' : 'od'}"><b>${esc(x.name)}</b>: ${x.url ? `<a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.state)}</a>` : esc(x.state)}</li>`).join('');
  modal(`<div class="wband ${s.bandCls}" style="border-radius:10px;margin-bottom:10px">${s.bandCls === 'ok' ? '✓ ' : ''}${esc(s.band)}</div>
    <h3 style="margin:0 0 6px">Work package · ${esc(p.type || 'work not described')}</h3>
    <p style="margin:0 0 4px"><b>${esc(s.sentence)}</b></p><p class="small" style="margin:0 0 6px">${esc(s.searched)}</p>
    ${s.todo.length ? `<div class="wtodo" style="margin:6px 0">${s.todo.map(t => `<div>To do: ${esc(t)}</div>`).join('')}</div>` : ''}
    <div class="wline">${esc(s.fmcLine)}</div><div class="wline">${esc(s.tmsLine)}</div>
    <h4 style="margin:12px 0 4px">Side by side</h4><div class="scroll"><table class="t compact"><thead><tr><th></th><th>Field Mini Control</th><th>TMS work site</th></tr></thead><tbody>${s.side.map(x => `<tr><td><b>${esc(x[0])}</b></td><td class="wrap ${x[3] ? 'od' : ''}">${esc(x[1])}</td><td class="wrap ${x[3] ? 'od' : ''}">${esc(x[2])}${x[3] ? ' <span class="small">(differs)</span>' : ''}</td></tr>`).join('')}</tbody></table></div>
    <h4 style="margin:12px 0 4px">Proof – all are required for every work</h4>${pr ? `<ul class="wproofs">${pr}</ul>` : '<div class="small muted">No Field Mini Control record – no sheet proof to check.</div>'}${s.blockNote ? `<div class="small ${/not filled/.test(s.blockNote) ? 'od' : 'muted'}">${esc(s.blockNote)}</div>` : ''}
    <h4 style="margin:12px 0 4px">How it was placed</h4><div class="small">${esc(s.placed)}</div>
    <h4 style="margin:12px 0 4px">Other records at the same place, ± 1 day</h4>${s.related.length ? `<ul class="small" style="margin:0;padding-left:18px">${s.related.slice(0, 30).map(x => `<li>${esc(x.what)} <span class="muted">– shown because: ${esc(x.why)}</span></li>`).join('')}</ul>` : '<div class="small muted">None found.</div>'}
    ${p.lid && p.km != null ? `<button class="btn primary sm" id="pkLoc" style="margin-top:12px">Open the location card</button>` : ''}
    <div class="small muted" style="margin-top:12px;border-top:1px solid var(--line);padding-top:8px">Source: ${esc(s.source)}${w ? ' · TMS work site no. ' + esc(w.tid) : ''} (view only)</div>`);
  const b = document.getElementById('pkLoc'); if (b) b.onclick = () => { H.closeModal(); go('loc', `${p.lid}|${p.km}|${p.m || 0}`); };
}
})();
