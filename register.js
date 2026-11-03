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
      pk.forEach(p => { const t = p.fmc ? p.fmc.ltp : p.ws[0] ? p.ws[0].ltp : null; p.lt = t; });
      REG = { pk, fmc, ws, units: feed.units || [], days: merge(fl.filter(f => f.kind === 'fmcDays'), 'fmcDays') };
    }
    draw($('regBox'));
  } catch (e) { $('regBox').innerHTML = `<div class="panel body"><div class="inner"><b>Could not load:</b> ${esc(e.error || e.message || e)}</div></div>`; }
};
VIEWS.reg.clear = () => { REG = null; };
const F = { unit: '', type: '', out: '', from: '', to: '', q: '', lt: null };
const LTN = { main: 'Main line', loop: 'Loop lines', all: 'All lines' };
const ltOk = (p, v) => v === 'all' || (v === 'main' ? p.lt === 'main' : v === 'loop' ? (p.lt === 'loop' || p.lt === 'siding') : v === 'unknown' ? !p.lt : true);
const ltTagR = t => `<span class="tag ${t === 'main' ? 't3' : t ? 't2' : 't1'}">${t ? PE.LT_TAG[t] : 'type?'}</span>`;
function draw(box) {
  const P = REG.pk; const units = [...new Set(P.map(p => p.u).filter(Boolean))].sort();
  const firstSheet = REG.fmc.map(r => r.date).sort()[0];
  if (!F.from) F.from = firstSheet ? PE.addDays(firstSheet, -1) : '';
  const types = [...new Set(P.map(p => typeKey(p.type)).filter(Boolean))].sort();
  if (!F.lt) F.lt = (H.ltView && H.ltView()) || 'main';
  const view = P.filter(p => ltOk(p, F.lt) && (!F.unit || p.u === F.unit) && (!F.out || p.outcome === F.out) && (!F.type || typeKey(p.type) === F.type) && (!F.from || p.date >= F.from) && (!F.to || p.date <= F.to) && (!F.q || JSON.stringify([p.type, p.lid, p.fmc && p.fmc.bs]).toLowerCase().includes(F.q.toLowerCase())));
  const C = PE.packageCounts(view);
  const tot = k => view.filter(p => p.outcome === k).length;
  const kpi = (cls, k, l, v, s) => { const b = B(l); return `<div class="kpi ${cls}" data-out="${k}" style="cursor:pointer"><div class="l">${esc(b.p)}</div><div class="v">${v}</div><div class="s">${s}</div></div>`; };
  box.innerHTML = `<div class="kpis" style="grid-template-columns:repeat(auto-fit,minmax(170px,1fr))">${kpi('acc', '', 'Work packages', view.length, 'in the filter')}${kpi('ok', 'matched', 'matched', tot('matched'), 'sheet proof + TMS work site')}${kpi(tot('sheet only') ? 'crit' : 'ok', 'sheet only', 'sheet only', tot('sheet only'), 'done in the field, not in TMS work sites')}${kpi(tot('tms only') ? 'warn' : 'ok', 'tms only', 'tms only', tot('tms only'), 'TMS work site without sheet proof')}${kpi('', 'not checked', 'Not checked', tot('not checked'), 'TMS work on days the sheet was not read')}</div>
  <div class="panel body" style="margin-top:12px"><div class="inner"><div class="tablebar" style="flex-wrap:wrap;gap:8px">
    <select id="fU"><option value="">All units</option>${units.map(u => `<option ${u === F.unit ? 'selected' : ''}>${esc(u)}</option>`).join('')}</select>
    <select id="fT"><option value="">All work types</option>${types.map(u => `<option ${u === F.type ? 'selected' : ''}>${esc(u)}</option>`).join('')}</select>
    <select id="fO"><option value="">All outcomes</option>${Object.keys(OUT).map(k => `<option value="${k}" ${k === F.out ? 'selected' : ''}>${OUT[k][2]}</option>`).join('')}</select>
    <label class="small">from <input id="fF" type="date" value="${esc(F.from)}"></label><label class="small">to <input id="fTo" type="date" value="${esc(F.to)}"></label>
    <input id="fQ" placeholder="search" value="${esc(F.q)}" style="width:130px">
    <select id="fLt" aria-label="line type">${['main', 'loop', 'all', 'unknown'].map(v => `<option value="${v}" ${v === F.lt ? 'selected' : ''}>${v === 'unknown' ? 'Line type unknown' : LTN[v]}</option>`).join('')}</select></div>
    <div class="small muted" style="margin-top:4px">Counts · ${esc(F.lt === 'unknown' ? 'line type unknown' : LTN[F.lt].toLowerCase())}</div>
    ${F.unit ? dayStrip(F.unit) : ''}
    <details style="margin-top:6px"><summary class="small">Per unit – gaps and missing proof (${C.length} units)</summary><div class="scroll"><table class="t compact"><thead><tr><th>Unit</th><th>Packages</th><th>Matched</th><th>Sheet only (TMS gap)</th><th>TMS only (no proof)</th><th>Not checked</th><th>Sheet records lacking certificates / photos</th></tr></thead><tbody>${C.map(u => `<tr data-u="${esc(u.unit)}" style="cursor:pointer"><td><b>${esc(u.unit)}</b></td><td>${u.total}</td><td>${u.matched}</td><td>${u['sheet only'] ? `<b class="od">${u['sheet only']}</b>` : 0}</td><td>${u['tms only']}</td><td class="muted">${u['not checked']}</td><td>${u.proofMissing}</td></tr>`).join('')}</tbody></table></div></details>
    <div class="scroll" style="margin-top:8px"><table class="t compact"><thead><tr><th>Date</th><th>Unit</th><th>Outcome</th><th>Work</th><th>Where</th><th>Sheet proof</th><th>Also here</th></tr></thead><tbody>${view.slice(0, 500).map((p, i) => `<tr data-i="${P.indexOf(p)}" style="cursor:pointer"><td class="nw">${dmy(p.date)}</td><td>${esc(p.u || '')}</td><td><span class="tag ${OUT[p.outcome][1]}">${esc(UI.t(p.outcome))}</span> ${ltTagR(p.lt)}</td><td class="wrap">${esc(p.type || '')}${p.ws.length > 1 ? ` <span class="small muted">+${p.ws.length - 1} TMS</span>` : ''}</td><td class="small">${p.lid ? esc(p.lid) + ' ' + PE.fmtKm(p.km, p.m) + (p.approx ? ' <span class="tag t3">approx</span>' : '') : `<span class="muted">${esc(p.fmc && p.fmc.where ? p.fmc.where.note || 'not located' : 'not located')}</span>`}</td><td class="small">${p.fmc ? proofCell(p.fmc) : '<span class="od">none</span>'}</td><td class="small">${att(p)}</td></tr>`).join('')}</tbody></table></div>${view.length > 500 ? `<div class="pager">${view.length} packages – first 500 shown; narrow the filter</div>` : `<div class="pager">${view.length} package(s)</div>`}
  </div></div>`;
  const re = () => draw(box);
  $('fU').onchange = e => { F.unit = e.target.value; re(); }; $('fT').onchange = e => { F.type = e.target.value; re(); }; $('fO').onchange = e => { F.out = e.target.value; re(); };
  $('fLt').onchange = e => { F.lt = e.target.value; if (F.lt !== 'unknown' && H.setLtView) H.setLtView(F.lt); re(); };
  $('fF').onchange = e => { F.from = e.target.value; re(); }; $('fTo').onchange = e => { F.to = e.target.value; re(); }; $('fQ').onchange = e => { F.q = e.target.value; re(); };
  box.querySelectorAll('[data-out]').forEach(k => k.onclick = () => { F.out = k.dataset.out; re(); });
  box.querySelectorAll('tr[data-u]').forEach(r => r.onclick = () => { F.unit = r.dataset.u; re(); });
  box.querySelectorAll('tr[data-i]').forEach(r => r.onclick = () => detail(P[+r.dataset.i]));
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
  const r = p.fmc; const ev = r ? H.evRefs({ kind: 'sheetWork', x: r }) : '';
  const wsH = p.ws.map(w => `<div class="panel" style="padding:10px 12px;margin:6px 0"><b>TMS work site ${esc(w.tid)}</b> · ${dmy(w.d)} · ${esc(w.sub || w.wt)} · ${esc(w.lid || w.sec + ' ' + w.ln)} ${PE.fmtKm(w.km, w.m)}–${PE.fmtKm(w.km2, w.m2)}<div class="small">block ${esc(w.bFrom)}–${esc(w.bTo)} (${w.bAv || '?'} of ${w.bDem || '?'} min demanded) · block adequate: ${esc(w.blk)} · labour ${esc(w.men ?? '')} · ${esc(w.ex || '')} · entry by ${esc(w.by || '')}</div><div class="small">${esc(w.prog || '')}</div><div class="small muted">TMS photos / track parameters: ${(w.att || []).map(a => esc(a.s + ' ' + a.k)).join(', ') || 'none'} – open in TMS: PopUpWorkSiteDetails.jsp?worksiteid=${esc(w.tid)}</div></div>`).join('');
  const sh = r ? `<div class="panel" style="padding:10px 12px;margin:6px 0"><b>Field Mini Control – ${esc(r.tab)}</b> · ${dmy(r.date)}${r.from && r.from !== r.date ? ' (night from ' + dmy(r.from) + ')' : ''} · unit ${esc(r.unitRaw)} (${esc(r.aen)})<div class="small">${esc(r.bs)} · ${esc(r.line)}${r.loc ? ' · caution ' + esc(r.loc) + (r.speed ? ' ' + esc(r.speed) + ' km/h' : '') : ''} · ${esc(r.purpose || r.reason || '')} ${esc(r.details || '')}</div><div class="small">block ${esc(r.timing || '—')} · pre photo ${esc(r.preTime || '—')} · post photo ${esc(r.postTime || '—')} · by ${esc(r.who || '—')}</div><div class="small">AEN check: ${esc(r.aenCheck || '—')} · greasing: ${esc(r.greasing || '—')} · AEN remarks: ${esc(r.remarks || '—')}</div><div class="small" style="margin-top:4px">${ev}</div><div class="small muted">sheet cell ${esc(r.cell)} · located: ${esc(r.where ? r.where.how + (r.where.approx ? ' (approx)' : '') + (r.where.note ? ' – ' + r.where.note : '') : '—')}</div></div>` : '<div class="od">No Field Mini Control record for this TMS work site.</div>';
  const a = p.att; const al = [].concat(a.ac.map(x => `asset: ${x.k} ${x.t || ''} ${dmy(x.d)}`), a.mp.map(x => `machine: ${x.mc} ${dmy(x.d)} ${x.trk || ''}`), a.fw.map(x => `app record: ${(x.types || []).join(', ')} ${dmy(x.d)}`), a.sc.map(x => `card ${x.src} closed ${dmy(x.cmp || x.d16)}${x.act ? ' – ' + x.act : ''}`));
  modal(`<h3 style="margin:0 0 6px">Work package · <span class="tag ${OUT[p.outcome][1]}">${esc(OUT[p.outcome][2])}</span></h3>${sh}${wsH}${al.length ? `<div class="small"><b>Also at this place ± 1 day:</b><ul style="margin:4px 0;padding-left:18px">${al.slice(0, 30).map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>` : ''}${p.lid && p.km != null ? `<button class="btn primary sm" id="pkLoc">Open the location card</button>` : ''}`);
  const b = document.getElementById('pkLoc'); if (b) b.onclick = () => { H.closeModal(); go('loc', `${p.lid}|${p.km}|${p.m || 0}`); };
}
})();
