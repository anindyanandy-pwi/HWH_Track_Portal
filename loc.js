// HWH Track Portal – LOCATION CARD "Why is this spot bad?" (brief A5): search by km / station / section-line -> one 200 m cell with its
// fixed profile (TMS chart layers + GMT), run history, every event on a timeline (source + evidence links), rule-based reasons, open actions.
(function () {
'use strict';
const H = window.HWHTP, UI = window.UI; const { $, esc, dmy, B, files, merge, snap, names, locator, pageHead, VIEWS, go, toast } = H;
const TMS_KINDS = ['workSite', 'spotCards', 'assetChange', 'machineProg', 'trcRuns', 'tqiSix', 'condition', 'itms', 'health'];
const LV = { Act: 't1', Watch: 't2', Info: 't3' };
const SRC = { card: 'TMS spot card', tmsWork: 'TMS work site', asset: 'TMS asset change', machine: 'TMS machine progress', sheetWork: 'Field Mini Control', job: 'TMS Control job', appWork: 'TMS Control work record', condition: 'TMS condition', trcRun: 'TRC run' };
const CF = ['km', 'ci', 'rs', 'rg', 'rl', 'cg', 'gy', 'lt', 'lm', 'ds', 'wf', 'cl', 'sr', 'ut', 'cv', 'br', 'lw', 'rn', 'sl'];
const RS = { '04': '60 kg', '03': '52 kg', '02': '90 R' };
const recent = () => { try { return JSON.parse(localStorage.getItem('hwhtp.recent') || '[]'); } catch (e) { return []; } };
const remember = k => { try { const r = recent().filter(x => x !== k); r.unshift(k); localStorage.setItem('hwhtp.recent', JSON.stringify(r.slice(0, 8))); } catch (e) { } };
const CACHE = {};

function lidList() {
  const S = H.S; const set = new Set();
  ((S.boot && S.boot.health && S.boot.health.lines) || []).forEach(l => set.add(l.lid));
  if (S.L) S.L.lids.forEach(l => set.add(l));
  return [...set].sort();
}
VIEWS.loc = async (el, arg) => {
  const N = names();
  el.innerHTML = pageHead('Location card', 'Why is this spot bad? – search by section-line + km, or by station') +
    `<div class="panel body"><div class="inner"><div class="tablebar" style="flex-wrap:wrap;gap:8px">
      <select id="qLid" style="min-width:200px"><option value="">Section – line…</option></select>
      <input id="qKm" type="number" min="0" placeholder="km" style="width:90px"> <input id="qM" type="number" min="0" placeholder="m" style="width:80px">
      <button class="btn primary" id="qGo">Show</button>
      <span class="muted">or station</span><input id="qStn" list="stnList" placeholder="e.g. BDC" style="width:110px" autocapitalize="characters"><datalist id="stnList"></datalist><button class="btn secondary" id="qStnGo">Find</button>
    </div><div id="qRecent" class="small muted" style="margin-top:8px"></div><div id="qNote" class="small muted"></div></div></div><div id="card"></div>`;
  const fill = () => {
    const sel = $('qLid'); const cur = sel.value || (arg ? String(arg).split('|')[0] : ''); const ll = lidList(); if (cur && !ll.includes(cur)) ll.unshift(cur); sel.innerHTML = '<option value="">Section – line…</option>' + ll.map(l => `<option value="${esc(l)}" ${l === cur ? "selected" : ""}>${esc(l)}</option>`).join('');
    if (H.S.L) $('stnList').innerHTML = H.S.L.stations.map(s => `<option value="${esc(s)}">`).join('');
    const r = recent(); $('qRecent').innerHTML = r.length ? 'Recent: ' + r.map(k => `<a href="#" data-k="${esc(k)}">${esc(k.replace(/\|/g, ' '))}</a>`).join(' · ') : '';
    $('qRecent').querySelectorAll('a').forEach(a => a.onclick = e => { e.preventDefault(); go('loc', a.dataset.k); });
  };
  fill();
  locator(t => { $('qNote').textContent = t; }).then(() => { $('qNote').textContent = ''; fill(); }, e => { $('qNote').textContent = 'Block-section list not available: ' + (e.error || e); });
  $('qGo').onclick = () => { const l = $('qLid').value, k = $('qKm').value; if (!l || k === '') { toast('Choose the section-line and type the km', true); return; } go('loc', `${l}|${+k}|${+($('qM').value || 0)}`); };
  $('qKm').onkeydown = $('qM').onkeydown = e => { if (e.key === 'Enter') $('qGo').click(); };
  $('qStnGo').onclick = async () => {
    const L = await locator(); const st = String($('qStn').value || '').toUpperCase().trim(); const hits = (L.byStn[st] || []);
    if (!hits.length) { toast('Station ' + st + ' is not in TMS\'s block-section mapping', true); return; }
    const uniq = []; hits.forEach(h => { if (!uniq.some(u => u.lid === h.lid)) uniq.push(h); });
    if (uniq.length === 1) { const p = uniq[0].p; go('loc', `${uniq[0].lid}|${PE.kmOf(p)}|${p - PE.kmOf(p) * 10000}`); return; }
    $('card').innerHTML = `<div class="panel body"><div class="inner"><b>${esc(st)}</b> is on ${uniq.length} lines – choose one:<div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:8px">${uniq.map(h => `<button class="btn secondary sm" data-k="${esc(h.lid)}|${PE.kmOf(h.p)}|${h.p - PE.kmOf(h.p) * 10000}">${esc(h.lid)} · ${PE.fmtKm(PE.kmOf(h.p), h.p - PE.kmOf(h.p) * 10000)}</button>`).join('')}</div></div></div>`;
    $('card').querySelectorAll('[data-k]').forEach(b => b.onclick = () => go('loc', b.dataset.k));
  };
  if (!arg) { $('card').innerHTML = `<div class="panel body"><div class="inner"><div class="empty">Choose a section-line and km, or a station. The card shows the 200 m stretch: TMS's fixed profile, every TRC / ITMS / OMS run, every spot card, TMS work site, asset change, machine day, Field Mini Control proof and TMS Control job or work record found there – with the reasons the rules see.</div></div></div>`; return; }
  const [lid, km, m] = arg.split('|'); $('qLid').value = lid; $('qKm').value = km; $('qM').value = m;
  await showCard($('card'), lid, +km, +m);
};

async function lineData(lid, note) {
  const N = names(); const G = N.groupOf(lid);
  if (CACHE[G]) return CACHE[G](lid);
  const L = await locator(note);
  const want = TMS_KINDS.map(k => ({ kind: k, group: G })).concat([{ kind: 'fmc', group: '*' }, { kind: 'feed', group: '_all' }]);
  const fl = await files(want, note);
  const by = k => merge(fl, k, G);
  const all = { ws: by('workSite'), sc: by('spotCards'), ac: by('assetChange'), mp: by('machineProg'), tr: by('trcRuns'), tq: by('tqiSix'), it: by('itms'), cond: snap(fl, 'condition', G) || [], health: snap(fl, 'health', G), feed: snap(fl, 'feed', '_all'), fmc: PE.fmcLocate(merge(fl, 'fmc').map(r => PE.fmcClean(r, H.settings())).filter(Boolean), L) };
  CACHE[G] = l => {
    const f = x => x.lid === l; const feed = all.feed || { jobs: [], work: [], units: [] };
    const tqs = all.tq.filter(f).sort((a, b) => String(b.d).localeCompare(String(a.d)));
    const hl = all.health ? (all.health.lines || []).find(x => x.lid === l) : null; const hd = all.health && all.health.details ? all.health.details[l] : null;
    const D = { lid: l, ws: all.ws.filter(f), sc: all.sc.filter(f), ac: all.ac.filter(f), mp: all.mp.filter(f), tr: all.tr.filter(f), tq: tqs[0] || null, itms: all.it.filter(f), cond: (all.cond || []).filter(f), fmc: all.fmc.filter(r => r.where && r.where.lid === l), jobs: (feed.jobs || []).filter(f), work: (feed.work || []).filter(f), units: (feed.units || []).filter(f), hl, hd, feedAt: feed.generatedAt, coverage: (H.S.boot && H.S.boot.fmc && H.S.boot.fmc.coverage) || {} };
    D.packages = PE.buildPackages(D.fmc, D.ws, { ac: D.ac, mp: D.mp, fw: D.work, sc: D.sc }, { S: H.settings(), N, coverage: D.coverage });
    return D;
  };
  return CACHE[G](lid);
}
VIEWS.loc.clear = () => { Object.keys(CACHE).forEach(k => delete CACHE[k]); };

async function showCard(box, lid, km, m) {
  box.innerHTML = `<div class="busy"><div class="eyebrow">Loading</div><h2>${esc(lid)} · km ${esc(km)}</h2><div id="lnote" class="small muted">Getting this section's history…</div><div class="bar"><div style="width:50%"></div></div></div>`;
  let D; try { D = await lineData(lid, t => { const n = $('lnote'); if (n) n.textContent = t; }); } catch (e) { box.innerHTML = `<div class="panel body"><div class="inner"><b>Could not load:</b> ${esc(e.error || e.message || e)}</div></div>`; return; }
  remember(`${lid}|${km}|${m}`);
  const ci = PE.cellOf(m); const S = H.settings(); const today = (H.S.boot && H.S.boot.today) || new Date().toISOString().slice(0, 10);
  const items = PE.cellItems(D, lid, km, ci);
  const C = PE.cellRange(km, ci);
  const pk = D.packages.filter(p => p.lid === lid && p.km != null && PE.near(PE.rng(p), C, 0));
  const cellArr = D.hl ? (D.hl.c || []).find(c => c[0] === km && c[1] === ci) : null; const prof = cellArr ? Object.fromEntries(CF.map((k, i) => [k, cellArr[i]])) : null;
  const tg = D.hl ? (D.hl.t || []).find(t => t[0] === km) : null;
  const R = PE.cellReasons(items, prof, { rules: S.rules, today, tgi: tg ? tg[2] : null, packages: pk });
  const unit = D.units.find(u => u.level === 2 && u.a && u.b && PE.P(u.a[0], u.a[1]) <= PE.P(km, m) && PE.P(km, m) < PE.P(u.b[0], u.b[1])) || D.units.find(u => u.a && u.b && PE.P(u.a[0], u.a[1]) <= PE.P(km, m) && PE.P(km, m) < PE.P(u.b[0], u.b[1]));
  const cards = items.filter(i => i.kind === 'card'); const yr = cards.filter(i => PE.daysBetween(i.d, today) <= 365);
  const work = items.filter(i => !i.approx && /tmsWork|asset|machine|sheetWork|appWork/.test(i.kind));
  const near = items.filter(i => i.approx);
  const kpi = (cls, l, v, s) => { const b = B(l); return `<div class="kpi ${cls}"><div class="l">${esc(b.p)}</div>${b.s ? `<div class="lh">${esc(b.s)}</div>` : ''}<div class="v">${v}</div><div class="s">${s}</div></div>`; };
  const nav = d => { let K = km, c = ci + d; if (c < 0) { K--; c = 4; } if (c > 4) { K++; c = 0; } return `${lid}|${K}|${c * 200}`; };
  box.innerHTML = `
  <div class="panel body" style="margin-top:12px"><div class="inner" style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
    <div style="flex:1;min-width:220px"><div class="eyebrow">${(t => `<span class="tag ${t.t === 'main' ? 't3' : t.t ? 't2' : 't1'}" title="${esc(t.src)}">${esc(t.t ? PE.LT_LABEL[t.t === 'siding' ? 'loop' : t.t][0] + (t.t === 'siding' ? ' (siding)' : '') : 'Line type unknown')}</span> `)(PE.lineTypeOfLid(lid, names()))}${esc(lid)}${unit ? ' · ' + esc(unit.unit) + (unit.aen ? ' · ' + esc(unit.aen) : '') : ''}</div><div style="font-size:24px;font-weight:700">km ${km} / ${ci * 200}–${ci === 4 ? 'end' : ci * 200 + 200} m</div><div class="small muted">200 m stretch around ${PE.fmtKm(km, m)}${D.feedAt ? ' · TMS Control feed of ' + esc(String(D.feedAt).slice(0, 16).replace('T', ' ')) : ''}</div></div>
    <button class="btn secondary sm" data-k="${esc(nav(-1))}">◀ previous 200 m</button><button class="btn secondary sm" data-k="${esc(nav(1))}">next 200 m ▶</button>
  </div></div>
  <div class="kpis" style="grid-template-columns:repeat(auto-fit,minmax(150px,1fr));margin-top:12px">
    ${kpi(R.reasons.some(r => r.lvl === 'Act') ? 'crit' : R.reasons.some(r => r.lvl === 'Watch') ? 'warn' : 'ok', 'Reasons', R.reasons.filter(r => r.lvl !== 'Info').length, 'rules that fire here')}
    ${kpi(cards.some(c => c.x.st === 'open') ? 'crit' : 'ok', 'Open actions', R.actions.length, 'open cards, jobs, gaps')}
    ${kpi(yr.length >= 3 ? 'warn' : 'ok', 'Spot cards', yr.length, 'last 12 months · ' + cards.length + ' in all')}
    ${kpi('acc', 'Work done', work.length, 'placed exactly here' + (near.length ? ' · +' + near.length + ' nearby (block section only)' : ''))}
  </div>
  <div class="panel body" style="margin-top:12px"><div class="inner"><h3 style="margin:0 0 8px">${UI.t('Reasons')}</h3>${R.reasons.length ? `<ul class="rlist" style="margin:0;padding-left:0;list-style:none">${R.reasons.map(r => `<li style="margin:6px 0"><span class="tag ${LV[r.lvl]}">${r.lvl === 'Info' ? 'Fact' : r.lvl}</span> ${esc(r.text)}</li>`).join('')}</ul>` : '<div class="muted">No rule fires here with the data loaded.</div>'}</div></div>
  <div class="panel body" style="margin-top:12px"><div class="inner"><h3 style="margin:0 0 8px">${UI.t('Open actions')}</h3>${R.actions.length ? `<ul style="margin:0;padding-left:18px">${R.actions.map(a => `<li>${esc(a.text)}</li>`).join('')}</ul>` : '<div class="muted">Nothing open here.</div>'}</div></div>
  ${profilePanel(prof, D, km, ci, tg)}
  ${runPanel(D, km, ci, items, tg)}
  <div class="panel body" style="margin-top:12px"><div class="inner"><h3 style="margin:0 0 8px">${UI.t('Timeline')} <span class="small muted">${items.length - near.length} events placed exactly here · newest first</span></h3>${timeline(items.filter(i => !i.approx))}${nearby(near)}</div></div>`;
  box.querySelectorAll('[data-k]').forEach(b => b.onclick = () => go('loc', b.dataset.k));
}
function profilePanel(p, D, km, ci, tg) {
  if (!p) return `<div class="panel body" style="margin-top:12px"><div class="inner"><h3 style="margin:0 0 8px">${UI.t('Fixed profile')}</h3><div class="muted">No TMS chart data for this stretch yet (Admin → Load TMS data loads the chart files and GMT).</div></div></div>`;
  const row = (l, v) => v == null || v === '' ? '' : `<tr><th style="text-align:left;font-weight:500;width:45%">${esc(l)}</th><td>${esc(v)}</td></tr>`;
  const pos = PE.P(km, ci * 200 + 100);
  // GMT by year (TMS): one value per financial year – the narrowest stretch that holds this 200 m (a year listed twice in TMS is shown once)
  const gy = {}; ((D.hd && D.hd.gmt) || []).filter(x => x[1] <= pos && pos < x[2] && x[3] != null).forEach(x => { const o = gy[x[0]]; if (!o || (x[2] - x[1]) < (o[2] - o[1])) gy[x[0]] = x; else if (o && (x[2] - x[1]) === (o[2] - o[1]) && x[3] !== o[3]) o.alt = x[3]; });
  const g = Object.keys(gy).sort().slice(-8).map(k => gy[k]);
  return `<div class="panel body" style="margin-top:12px"><div class="inner"><h3 style="margin:0 0 8px">${UI.t('Fixed profile')} <span class="small muted">TMS track health chart – TMS's figures</span></h3>
  <div class="scroll"><table class="t compact"><tbody>${row('Rail', [RS[p.rs] || p.rs, p.rg].filter(Boolean).join(' · '))}${row('Rail laid', p.rl)}${row('GMT carried by the rail', p.cg)}${row('GMT per year (traffic density)', p.gy)}${row('Last tamping', [p.lt, p.lm].filter(Boolean).join(' · '))}${row('Last deep screening', p.ds)}${row('Sleeper', p.sl)}${row('Last USFD test', p.ut)}${row('Curve', p.cv)}${row('Bridge', p.br)}${row('LWR', p.lw)}${row('Last renewal', p.rn)}${row('Weak formation', p.wf ? 'yes' : '')}${row('Critical location', p.cl)}</tbody></table></div>
  ${p.sr ? '<div class="small muted" style="margin-top:6px">Speed restriction: TMS figure not used (TMS SR data not proper) – your own PSR/TSR file will be shown here when it is loaded.</div>' : ''}
  ${g.length ? `<div class="small" style="margin-top:8px"><b>GMT by year</b> (TMS): ${g.map(x => `${esc(x[0])}: ${x[3]}${x.alt != null ? ' (also ' + x.alt + ')' : ''}`).join(' · ')}</div>` : ''}</div></div>`;
}
function runPanel(D, km, ci, items, tg) {
  const tq = D.tq; const row = tq ? tq.rows.find(r => r[0] <= km && km < r[1]) || tq.rows.find(r => r[0] === km) : null;
  const runs = items.filter(i => i.kind === 'trcRun');
  const itms = (D.itms || []).filter(r => r.km == null || (r.km <= km && km <= r.km2));
  const geo = items.filter(i => i.kind === 'card' && /TRC|OMS|ITMS/i.test(i.x.src || ''));
  const jobs = items.filter(i => i.kind === 'job' && /TRC|OMS/i.test((i.x.type || '') + (i.x.src || '')));
  return `<div class="panel body" style="margin-top:12px"><div class="inner"><h3 style="margin:0 0 8px">${UI.t('Run history')}</h3>
   ${tg ? `<div><b>TMS track geometry index (TGI) of km ${km}</b>: ${tg[2].map(r => `${r[0]}${r[1] ? ' (' + esc(r[1]) + (r[2] ? '/' + esc(r[2]) : '') + ')' : ''}`).join(' → older: ')}</div>` : ''}
   ${row ? `<div style="margin-top:6px"><b>TQI, latest six runs (TMS report 17), km ${row[0]}–${row[1]}</b><div class="scroll"><table class="t compact"><thead><tr>${tq.runs.map(r => `<th>${esc(dmy(r.d))} ${esc(r.l || '')}</th>`).join('')}</tr></thead><tbody><tr>${row[2].map(v => `<td>${v == null ? '—' : v}</td>`).join('')}</tr></tbody></table></div></div>` : (tq ? `<div class="small muted">TMS's six-run TQI table for ${esc(D.lid)} covers km ${tq.rows.length ? tq.rows[0][0] + '–' + tq.rows[tq.rows.length - 1][1] : '—'}; km ${km} is not in it${(() => { const n = tq.rows.slice().sort((a, b) => Math.abs(a[0] - km) - Math.abs(b[0] - km))[0]; return n ? ` (nearest: km ${n[0]}–${n[1]}: ${n[2].map(v => v == null ? '—' : v).join(' · ')})` : ''; })()}.</div>` : '<div class="small muted">No TQI six-run table from TMS for this line yet.</div>')}
   <div style="margin-top:6px"><b>TRC runs over this km</b> (TMS run list, from Mar-2023): ${runs.length ? runs.slice(0, 12).map(r => `${dmy(r.d)}${r.x.let ? '/' + esc(r.x.let) : ''}`).join(' · ') + (runs.length > 12 ? ' …' : '') : '<span class="muted">none listed</span>'}</div>
   <div style="margin-top:6px"><b>ITMS runs</b>: ${itms.length ? itms.slice(0, 8).map(r => `${dmy(r.d)}/${esc(r.let)} (${r.files.length} reports on the office PC: ${esc(r.folder || '')})`).join('; ') : '<span class="muted">none fetched for this line yet</span>'}</div>
   <div style="margin-top:6px"><b>TRC / OMS / ITMS defects here</b> (spot cards): ${geo.length ? geo.slice(0, 10).map(i => `${dmy(i.d)} ${esc(i.x.src)} – ${esc(i.x.ob)} (${esc(i.x.st)})`).join('; ') : '<span class="muted">none</span>'}</div>
   ${jobs.length ? `<div style="margin-top:6px"><b>TMS Control TRC / OMS jobs</b>: ${jobs.slice(0, 8).map(i => `${esc(i.x.type)} ${dmy(i.d)} – ${esc(i.x.title || '')} (${esc(i.x.st)})`).join('; ')}</div>` : ''}
  </div></div>`;
}
const SHEET = () => 'https://docs.google.com/spreadsheets/d/' + ((H.settings().fmc || {}).sheetId || '1-EWkp8nq5aL_BKs3MQymexS-1gjrrXtPbLu1ZCZ1_FI') + '/edit';
function evRefs(i) {
  const x = i.x, out = [];
  if (i.kind === 'sheetWork') { const L = { preImg: 'pre photo', postImg: 'post photo', certSafety: 'safety-staff cert.', certAgency: 'agency counselling cert.', certWork: 'work-details cert.', video: 'counselling video', pdf: 'measurement PDF', greasingImg: 'greasing photo' };
    Object.keys(L).forEach(k => { const r = (x.ev || {})[k]; if (!r) return; if (r.t === 'link') out.push(`<a href="${esc(r.url)}" target="_blank" rel="noopener">${L[k]}</a>`); else if (r.t === 'img') out.push(`<a href="${SHEET()}" target="_blank" rel="noopener" title="image placed in the sheet cell ${esc(r.cell)}">${L[k]} (cell ${esc(String(r.cell).split('!')[1] || '')})</a>`); else out.push(`<span title="${esc(r.text)}">${L[k]}: ${esc(String(r.text).slice(0, 30))}</span>`); });
    const miss = PE.proofMissing(x); if (miss.length) out.push(`<span class="od">missing: ${miss.join(', ')}</span>`); }
  if (i.kind === 'tmsWork') (x.att || []).forEach(a => out.push(`<span class="small" title="TMS attachment ${esc(a.ref)} – open the work site in TMS (PopUpWorkSiteDetails.jsp?worksiteid=${esc(x.tid)})">TMS ${esc(a.s === 'Site Photos' ? 'site photo' : 'track parameters')} ${esc(a.k)}</span>`));
  if (i.kind === 'appWork') (x.photos || []).forEach(p => out.push(`<a href="https://drive.google.com/file/d/${esc(p.fileId)}/view" target="_blank" rel="noopener">${esc(p.kind)} photo</a>`));
  if (i.kind === 'card' && x.ph) out.push(`${x.ph} photo(s) in TMS`);
  return out.join(' · ');
}
function what(i) {
  const x = i.x;
  switch (i.kind) {
    case 'card': return `<b>${esc(x.src)} ${esc(x.it || '')}</b> P${esc(x.p)} – ${esc(x.ob)}${x.an ? ' · asset ' + esc(x.an) : ''} · <i>${esc(x.st)}</i>${x.st === 'closed' ? ` ${dmy(x.cmp || x.d16)}${x.act !== undefined ? ' – action: ' + (x.act ? esc(x.act) : '<span class="od">none recorded</span>') : ''}` : ''}`;
    case 'tmsWork': return `<b>${esc(x.sub || x.wt)}</b> ${PE.fmtKm(x.km, x.m)}–${PE.fmtKm(x.km2, x.m2)} · block ${esc(x.bFrom)}–${esc(x.bTo)}${x.bAv ? ' (' + x.bAv + ' min)' : ''}${x.blk === 'No' ? ' · <span class="od">block not adequate</span>' : ''} · ${esc(x.prog || '')}`;
    case 'asset': return `<b>${esc(x.k)} change</b> ${esc(x.t || '')} ${x.sd ? '(' + esc(x.sd) + ')' : ''}`;
    case 'machine': return `<b>${esc(x.mc)}</b> ${esc(x.bs || x.sec)} ${esc(x.ln)} · block ${esc(x.giv || x.dem)} · output ${esc(x.trk || '')}${x.tos ? ' T/O ' + esc(x.tos) : ''}${x.masts && x.masts.length ? ' · mast ' + esc(x.masts.join(', ')) : ''}`;
    case 'sheetWork': return `<b>${esc(x.purpose || x.reason || x.details)}</b> ${esc(x.bs)} ${esc(x.line)}${x.loc ? ' · ' + esc(x.loc) : ''}${x.timing ? ' · block ' + esc(x.timing) : ''}${x.aenCheck ? ' · AEN: ' + esc(x.aenCheck) : ''}${x.remarks ? ' · ' + esc(x.remarks) : ''}`;
    case 'job': return `<b>${esc(x.type)}</b> ${esc(x.title || '')} · ${esc(x.st)}${x.target ? ' · target ' + dmy(x.target) : ''}`;
    case 'appWork': return `<b>${esc((x.types || []).join(', '))}</b> · ${esc(x.st || '')}${x.aen ? ' · AEN approved ' + dmy(x.aen[1]) : ''}`;
    case 'condition': return `<b>${esc(x.k === 'missing' ? 'missing linear data' : 'corrosion-prone')}</b> ${esc(x.f || '')}`;
    case 'trcRun': return `TRC run ${esc(x.let || '')} car ${esc(x.car || '')} · ${esc(x.sp || '')} km/h`;
  }
  return '';
}
function timeline(items) {
  const L = items.filter(i => i.kind !== 'trcRun');
  if (!L.length) return '<div class="muted">No event recorded in this 200 m.</div>';
  return `<div class="scroll"><table class="t compact"><thead><tr><th>Date</th><th>Source</th><th>What</th><th>Who</th><th>Evidence</th></tr></thead><tbody>${L.slice(0, 400).map(i => `<tr><td class="nw">${dmy(i.d)}</td><td class="small">${esc(SRC[i.kind] || i.kind)}${i.approx ? ' <span class="tag t3">approx</span>' : ''}</td><td class="wrap">${what(i)}</td><td class="small">${esc(i.kind === 'job' || i.kind === 'appWork' ? i.x.u : (i.x.by || i.x.who || i.x.done || i.x.u || ''))}</td><td class="small">${evRefs(i)}</td></tr>`).join('')}</tbody></table></div>${L.length > 400 ? `<div class="pager">${L.length} events – newest 400 shown</div>` : ''}`;
}
function nearby(L) {
  if (!L.length) return '';
  const rng = i => { const w = i.kind === 'sheetWork' ? (i.x.where || {}) : i.x; return w.km != null ? `${PE.fmtKm(w.km, w.m)}–${PE.fmtKm(w.km2, w.m2)}` : ''; };
  const span = L.map(i => { const w = i.kind === 'sheetWork' ? (i.x.where || {}) : i.x; return w.km != null && w.km2 != null ? Math.abs(PE.P(w.km2, w.m2) - PE.P(w.km, w.m)) / 10000 : 0; });
  return `<details style="margin-top:10px"><summary class="small"><b>Nearby – block section / station only</b> (${L.length} events, ranges up to ${Math.round(Math.max(...span) * 10) / 10} km) – not placed exactly, not counted, not used by the rules</summary>
   <div class="scroll"><table class="t compact"><thead><tr><th>Date</th><th>Source</th><th>Range</th><th>What</th><th>OHE mast</th></tr></thead><tbody>${L.slice(0, 300).map(i => `<tr><td class="nw">${dmy(i.d)}</td><td class="small">${esc(SRC[i.kind] || i.kind)}</td><td class="small nw">${rng(i)}</td><td class="wrap">${what(i)}</td><td class="small">${esc(((i.x.masts && i.x.masts.length ? i.x.masts : (i.x.where && i.x.where.masts) || [])).join(', '))}</td></tr>`).join('')}</tbody></table></div></details>`;
}
H.lineData = lineData; H.evRefs = evRefs;
})();
