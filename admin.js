// HWH Track Portal – ADMIN pages (admin link only): Load TMS data, Read Field Mini Control, Feed status, Viewer links, Settings, Version check.
// "Load TMS data": the folder "Track health monitoring\TMS data" is chosen once (File System Access API; the handle stays on this PC);
// the page reads the presses not loaded yet, previews the counts, then sends ONE server call per kind (split only above ~20 MB).
(function () {
'use strict';
const H = window.HWHTP, UI = window.UI; const { $, esc, dmy, call, gzB64, names, pageHead, VIEWS, toast, ST } = H;
const panel = (title, inner, extra = '') => `<div class="panel body" style="margin-top:12px"><div class="inner"><h3 style="margin:0 0 8px">${esc(title)} ${extra}</h3>${inner}</div></div>`;
const fmtB = n => n > 1e6 ? (n / 1e6).toFixed(1) + ' MB' : n > 1e3 ? Math.round(n / 1e3) + ' kB' : n + ' B';
const nowStamp = () => new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);
/** an inline "working… N s" line under a button – shown at once, counts every second until stop() */
function ticking(box, text) { const t0 = Date.now(); const draw = () => { box.innerHTML = `<div class="busy small"><b>${esc(text)}</b> – working… (server calls take 35–50 s) · ${Math.round((Date.now() - t0) / 1000)} s</div>`; }; draw(); const i = setInterval(draw, 1000); return () => clearInterval(i); }

// ---------- folder source: File System Access handle (Chrome / Edge) or a folder chosen with <input webkitdirectory> ----------
function srcFromHandle(root) {
  const dir = async p => { let d = root; for (const s of p.split('/').filter(Boolean)) d = await d.getDirectoryHandle(s); return d; };
  return { name: root.name, kind: 'handle',
    list: async p => { const out = []; try { const d = await dir(p); for await (const [n, h] of d.entries()) out.push({ name: n, dir: h.kind === 'directory' }); } catch (e) { } return out; },
    file: async p => { const parts = p.split('/'); const n = parts.pop(); const d = await dir(parts.join('/')); return await (await d.getFileHandle(n)).getFile(); } };
}
function srcFromList(fl) {
  const map = {}; let root = '';
  [...fl].forEach(f => { const rel = f.webkitRelativePath || f.name; const parts = rel.split('/'); root = parts[0]; map[parts.slice(1).join('/')] = f; });
  return { name: root, kind: 'list',
    list: async p => { const pre = p ? p.replace(/\/?$/, '/') : ''; const seen = {}; Object.keys(map).forEach(k => { if (!k.startsWith(pre)) return; const rest = k.slice(pre.length).split('/'); seen[rest[0]] = seen[rest[0]] || rest.length > 1; }); return Object.keys(seen).map(n => ({ name: n, dir: seen[n] })); },
    file: async p => { if (!map[p]) throw new Error('missing ' + p); return map[p]; } };
}
let SRC = null;
async function savedHandle() { try { return await ST.get('kv', 'tmsDir'); } catch (e) { return null; } }

VIEWS.load = async (el) => {
  // [PB] 03-Nov: one plain button. The folder is kept on this PC; Chrome asks once per visit to read it again ("Use the folder chosen before").
  el.innerHTML = pageHead('Load TMS data', 'From the TMS Collector\'s track-health files on this PC – only presses not loaded before') +
    panel('1. The folder', `<div id="ldAsk"></div><input id="ldInput" type="file" webkitdirectory multiple style="display:none"><div id="ldFolder" class="small muted" style="margin-top:6px"></div>`) +
    `<div id="ldPrev"></div><div id="ldRun"></div>`;
  const pick = async () => {
    if (!window.showDirectoryPicker) { $('ldInput').click(); return; }
    try { const d = await window.showDirectoryPicker({ id: 'hwhtp-tms', mode: 'read' }); await ST.set('kv', 'tmsDir', d).catch(() => { }); SRC = srcFromHandle(d); preview(); } catch (e) { if (e.name !== 'AbortError') toast(e.message, true); }
  };
  $('ldInput').onchange = e => { if (!e.target.files.length) return; SRC = srcFromList(e.target.files); preview(); };
  const h = await savedHandle();
  const ask = $('ldAsk');
  if (SRC) { ask.innerHTML = `<div class="small">Folder: <b>${esc(SRC.name)}</b> <a href="#" id="ldOther">choose another</a></div>`; $('ldOther').onclick = e => { e.preventDefault(); pick(); }; preview(); return; }
  if (h && h.queryPermission) {
    ask.innerHTML = `<button class="btn primary" id="ldAgain" style="font-size:16px;padding:12px 18px">Use the folder chosen before: ${esc(h.name)}</button> <a href="#" id="ldOther" class="small" style="margin-left:10px">choose another folder</a><p class="small muted">Chrome asks once each visit whether the portal may read it – click "Allow" / "View files".</p>`;
    $('ldAgain').onclick = async () => { try { if ((await h.queryPermission({ mode: 'read' })) !== 'granted' && (await h.requestPermission({ mode: 'read' })) !== 'granted') { toast('Permission not given', true); return; } SRC = srcFromHandle(h); preview(); } catch (e) { pick(); } };
    $('ldOther').onclick = e => { e.preventDefault(); pick(); };
  } else {
    ask.innerHTML = `<button class="btn primary" id="ldPick" style="font-size:16px;padding:12px 18px">Choose the folder: Track health monitoring\\TMS data</button><p class="small muted">It is in TMS KPI\\Track health monitoring\\TMS data on this PC. Choose it once – the portal remembers it.</p>`;
    $('ldPick').onclick = pick;
  }
};

let PLAN = null;
async function readJson(p) { const f = await SRC.file(p); return JSON.parse(await f.text()); }
async function preview() {
  $('ldFolder').textContent = 'Folder: ' + SRC.name;
  $('ldPrev').innerHTML = panel('2. What is in the folder', '<div class="muted">Reading the index files…</div>');
  const top = (await SRC.list('')).map(x => x.name);
  if (!top.includes('workSite') && !top.includes('spotCards')) { $('ldPrev').innerHTML = panel('2. What is in the folder', `<div class="od">This does not look like the "TMS data" folder (no workSite / spotCards inside). Found: ${esc(top.join(', '))}</div>`); return; }
  const boot = H.S.boot = await call('boot').catch(() => H.S.boot); const loaded = (boot && boot.loaded) || {};
  const rows = [];
  for (const k of PE.KINDS) {
    if (!top.includes(k)) { rows.push({ kind: k, missing: true }); continue; }
    let ix = null; try { ix = await readJson(k + '/index.json'); } catch (e) { rows.push({ kind: k, error: 'no index.json' }); continue; }
    const done = new Set((loaded[k] || []).filter(x => x.complete).map(x => x.pressId));
    const presses = (ix.presses || []).filter(p => p.status !== 'error' && (p.files || []).length).sort((a, b) => String(a.pressId).localeCompare(String(b.pressId)));
    const fresh = presses.filter(p => !done.has(p.pressId));
    let size = 0; const present = [];
    for (const p of fresh) { let ok = true; for (const f of p.files) { try { const ff = await SRC.file(k + '/' + f); size += ff.size; } catch (e) { ok = false; } } if (ok) present.push(p); }
    rows.push({ kind: k, presses: presses.length, fresh: present, missingFiles: fresh.length - present.length, size, last: presses[presses.length - 1] });
  }
  // track health: chart files + GMT
  let charts = [], gmt = null, hsig = '', hsize = 0;
  try { charts = (await SRC.list('Chart data')).filter(x => /\.json$/i.test(x.name)).map(x => x.name).sort(); } catch (e) { }
  for (const n of charts) { const f = await SRC.file('Chart data/' + n); hsize += f.size; hsig += n + f.size + f.lastModified; }
  try { const g = await SRC.file('GMT/gmt_all_years.json'); gmt = g; hsize += g.size; hsig += 'gmt' + g.size + g.lastModified; } catch (e) { }
  hsig = String(hsig.length) + ':' + [...hsig].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7).toString(36);
  const hm = boot && boot.health; const hFresh = charts.length && (!hm || hm.sig !== hsig);
  PLAN = { rows, charts, gmt: !!gmt, hsig, hFresh };
  const tr = r => r.missing ? `<tr><td>${esc(PE.KIND_LABEL[r.kind] || r.kind)}</td><td colspan="4" class="muted">no folder yet (the collector has not fetched it)</td></tr>` : r.error ? `<tr><td>${esc(PE.KIND_LABEL[r.kind])}</td><td colspan="4" class="od">${esc(r.error)}</td></tr>` :
    `<tr><td>${esc(PE.KIND_LABEL[r.kind] || r.kind)}</td><td class="small">${r.last ? esc(r.last.pressId) + '<br>' + esc(JSON.stringify(r.last.counts || {}).slice(0, 140)) : '—'}</td><td>${r.presses}</td><td>${r.fresh.length ? `<b>${r.fresh.length} new</b>` : '<span class="muted">all loaded</span>'}${r.missingFiles ? ` <span class="od">${r.missingFiles} with files missing</span>` : ''}</td><td>${r.fresh.length ? fmtB(r.size) : ''}</td></tr>`;
  const nNew = rows.reduce((a, r) => a + ((r.fresh || []).length), 0) + (hFresh ? 1 : 0);
  $('ldPrev').innerHTML = panel('2. What is in the folder', `<div class="scroll"><table class="t compact"><thead><tr><th>Kind</th><th>Newest press</th><th>Presses</th><th>To load</th><th>Size</th></tr></thead><tbody>${rows.map(tr).join('')}
     <tr><td>${esc(PE.KIND_LABEL.health)}</td><td class="small">${charts.length} chart files${gmt ? ' + GMT' : ' (GMT missing)'}</td><td>—</td><td>${hFresh ? '<b>new</b>' : '<span class="muted">loaded</span>'}</td><td>${hFresh ? fmtB(hsize) : ''}</td></tr></tbody></table></div>
     <div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap"><button class="btn primary" id="ldGo" ${nNew ? '' : 'disabled'}>Load what is new (${nNew})</button><label class="small"><input type="checkbox" id="ldForce"> load again even if loaded</label></div>
     <p class="small muted">Each kind is one call to the server (35–50 s each). Keep this page open until "Finished".</p>`);
  $('ldGo').onclick = () => run($('ldForce').checked);
  if ($('ldForce')) $('ldForce').onchange = e => { $('ldGo').disabled = false; };
}

async function run(force) {
  const N = names(); const log = []; $('ldRun').innerHTML = panel('3. Loading', '<pre id="plog" class="log" style="white-space:pre-wrap;max-height:420px;overflow:auto"></pre>');
  const say = t => { log.push(new Date().toTimeString().slice(0, 8) + '  ' + t); const p = $('plog'); if (p) { p.textContent = log.join('\n'); p.scrollTop = 1e9; } };
  const S = H.settings(); const recentFrom = PE.addDays(new Date().toISOString().slice(0, 10), -Math.round(((S.match && S.match.recentMonths) || 13) * 30.5));
  const results = [];
  try {
    // the locator: newest block-section mapping (loaded now if new, else from the server)
    const order = PLAN.rows.filter(r => r.fresh && (r.fresh.length || force)).map(r => r.kind);
    let L = null;
    const bsRow = PLAN.rows.find(r => r.kind === 'blockSections');
    if (bsRow && bsRow.last) { const last = bsRow.last; const parts = await Promise.all(last.files.map(f => readJson('blockSections/' + f))); const sl = PE.slimPress('blockSections', PE.combineParts(parts), { N }); L = PE.locator(N, sl.all[0], null); }
    else { H.S.L = null; L = await H.locator(); }
    for (const kind of PE.KINDS) {
      const row = PLAN.rows.find(r => r.kind === kind); if (!row || row.missing || row.error) continue;
      const presses = force && !row.fresh.length && row.last ? [row.last] : row.fresh;
      for (const p of presses) {
        say(`${PE.KIND_LABEL[kind]} – press ${p.pressId}: reading ${p.files.length} file(s)…`);
        const parts = []; for (const f of p.files) parts.push(await readJson(kind + '/' + f));
        const F = PE.combineParts(parts); F.pressId = F.pressId || p.pressId;
        const sl = PE.slimPress(kind, F, { N, L, recentFrom });
        if (kind === 'blockSections') say(`   ${sl.count} block sections in TMS's mapping – ${sl.extra.located} tied to a TMS section-line and km, ${sl.extra.notInTms} not in TMS. This is the LOCATING TABLE (used to place other records), not events.`);
        else if (kind === 'machineProg') { const h = {}; Object.values(sl.byGroup).flat().forEach(x => { const k = x.approx ? (x.how === 'section' ? 'section only' : 'block section / station only') : 'exact km'; h[k] = (h[k] || 0) + 1; }); say(`   ${sl.count} machine days with work: ${Object.entries(h).map(([k, v]) => v + ' ' + k).join(', ')}${sl.unlocated ? ', ' + sl.unlocated + ' not placed' : ''} (OHE masts in the remarks kept for the mast list)`); }
        else say(`   ${sl.count} records, ${sl.located} placed on a section-line, ${sl.unlocated} not placed${sl.unlocatedSample[0] ? ' (e.g. ' + JSON.stringify(sl.unlocatedSample[0]).slice(0, 160) + ')' : ''}`);
        const files = [];
        for (const g of Object.keys(sl.byGroup)) { const a = sl.byGroup[g]; files.push({ group: g, rows: a.length, b64: await gzB64(JSON.stringify(a)) }); }
        if (sl.all && sl.all.length) files.push({ group: '_all', rows: kind === 'blockSections' ? sl.count : sl.all.length, b64: await gzB64(JSON.stringify(sl.all)) });
        const summary = { count: sl.count, located: sl.located, unlocated: sl.unlocated, unlocatedSample: sl.unlocatedSample.slice(0, 20), extra: Object.assign({}, sl.extra, { assetIndex: undefined }), tms: sl.tmsCounts, window: sl.window };
        await send(kind, p.pressId, p.at, files, summary, force, say);
        if (kind === 'spotCards' && sl.extra.assetIndex) await send('assetIndex', p.pressId, p.at, [{ group: '_all', rows: Object.keys(sl.extra.assetIndex).length, b64: await gzB64(JSON.stringify(sl.extra.assetIndex)) }], { count: Object.keys(sl.extra.assetIndex).length }, true, say);
        if (kind === 'blockSections') L = PE.locator(N, sl.all[0], null);
        results.push({ kind, pressId: p.pressId, count: sl.count, located: sl.located, unlocated: sl.unlocated, tms: sl.tmsCounts });
      }
    }
    if (PLAN.hFresh || force) {
      say(`Track health: reading ${PLAN.charts.length} chart files + GMT…`);
      const charts = []; for (const n of PLAN.charts) charts.push(await readJson('Chart data/' + n));
      const gmt = PLAN.gmt ? PE.HE.parseGmt(await readJson('GMT/gmt_all_years.json'), N) : null;
      const B = PE.HE.buildDoc(charts, gmt, N, new Date().getFullYear());
      const groups = {}; B.doc.lines.forEach(l => { const g = N.groupOf(l.lid); (groups[g] = groups[g] || { lines: [], details: {} }).lines.push(l); groups[g].details[l.lid] = B.details[l.lid]; });
      const files = []; for (const g of Object.keys(groups)) files.push({ group: g, rows: groups[g].lines.length, b64: await gzB64(JSON.stringify(groups[g])) });
      const cells = B.doc.lines.reduce((a, l) => a + l.c.length, 0);
      const pid = 'h' + String(B.doc.at || nowStamp()).replace(/[^0-9]/g, '').slice(0, 12);
      const summary = { sig: PLAN.hsig, chartAt: B.doc.at, gmtAt: B.doc.gmtAt, n: B.doc.lines.length, cells, gmtLines: B.gmtLines, lines: B.doc.lines.map(l => ({ lid: l.lid, a: l.a, b: l.b, cells: l.c.length })) };
      say(`   ${B.doc.lines.length} section-lines, ${cells} cells of 200 m, GMT for ${B.gmtLines} lines`);
      await send('health', pid, B.doc.at, files, summary, true, say);
      results.push({ kind: 'health', lines: B.doc.lines.length, cells });
    }
    if (VIEWS.loc.clear) VIEWS.loc.clear(); if (VIEWS.reg.clear) VIEWS.reg.clear(); H.S.L = null;
    H.S.boot = await call('boot').catch(() => H.S.boot); ST.set('kv', H.BOOTKEY, H.S.boot).catch(() => { });
    // [PB] B1: the blind-spot watch (Overview / Three things) is computed again from the stored files
    if (H.watchUpdate) await H.watchUpdate(say).catch(e => say('   blind-spot watch not updated: ' + (e.error || e.message || e)));
    say('Finished.'); toast('TMS data loaded');
    try { localStorage.setItem('hwhtp.lastLoad', JSON.stringify({ at: new Date().toISOString(), results })); } catch (e) { }
  } catch (e) { say('ERROR: ' + (e.error || e.message || e)); console.error(e); }
}
async function send(kind, pressId, at, files, summary, force, say) {
  const LIM = 20 * 1024 * 1024; const parts = []; let cur = [], sz = 0;
  for (const f of files) { if (cur.length && sz + f.b64.length > LIM) { parts.push(cur); cur = []; sz = 0; } cur.push(f); sz += f.b64.length; }
  if (cur.length) parts.push(cur);
  for (let i = 0; i < parts.length; i++) {
    const bytes = parts[i].reduce((a, f) => a + f.b64.length, 0);
    say(`   sending ${parts[i].length} file(s), ${fmtB(bytes)}${parts.length > 1 ? ' – part ' + (i + 1) + ' of ' + parts.length : ''} …`);
    const r = await call('ingest', { kind, pressId, at, part: i + 1, parts: parts.length, files: parts[i], summary: i === parts.length - 1 ? summary : null, force });
    if (r.skipped) { say('   already loaded (' + r.reason + ') – skipped'); return; }
    say(`   saved ${r.files} file(s) in Drive${r.complete ? ' – done' : ''}`);
    if (r.fmcPlaced) say(r.fmcPlaced.ok ? '   Field Mini Control records placed again: ' + Object.entries(r.fmcPlaced.tabs).map(([t, x]) => t + ' – ' + x.text).join('; ') : '   Field Mini Control records not placed again: ' + r.fmcPlaced.error);
  }
}

// ---------- Field Mini Control ----------
VIEWS.fmc = async (el) => {
  const b = H.S.boot || {}; const F = b.fmc || {}; const last = F.lastRead || {};
  el.innerHTML = pageHead('Read Field Mini Control', 'READ ONLY – tabs "PWI at Block Site" and "PWI at Work Site", newest day blocks since the last read') +
    panel('Read now', `<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center"><button class="btn primary" id="fmGo">Read Field Mini Control now</button><label class="small">first day to read (optional) <input type="date" id="fmFrom"></label><label class="small"><input type="checkbox" id="fmDaily" ${F.daily ? 'checked' : ''}> read every day by itself</label></div><p class="small muted">Takes about a minute. Nothing is written to the sheet; its cache tabs are never read. A day block whose headings changed is not read – it is listed as "layout changed".</p><div id="fmOut"></div>`) +
    panel('Placeholder rows ("----", NIL, blank)', (r => r ? `<div class="small">Stored records cleaned: ${r.records.before} → ${r.records.after} (${r.records.dropped} rows were "----" / nil, not work). Work packages ${r.before.packages} → ${r.after.packages}; "sheet only" ${r.before['sheet only'] || 0} → ${r.after['sheet only'] || 0}; records missing proof ${r.before.proofMissing} → ${r.after.proofMissing}.<br>Nil-report days by unit: ${esc(Object.entries(r.nilDaysByUnit || {}).map(([u, n]) => u + ' ' + n).join(', ') || 'none')}. <span class="muted">${esc(r.note || '')}</span></div>` : '<div class="small muted">Not cleaned yet – runs by itself at the next admin start-up.</div>')(F.cleanReport) + `<div style="margin-top:8px"><button class="btn secondary sm" id="fmClean">Clean the stored records again</button> <span class="small muted" id="fmCleanOut"></span></div>`) +
    panel('Last read', Object.keys(last).length ? `<div class="scroll"><table class="t compact"><thead><tr><th>Tab</th><th>When</th><th>Days read</th><th>Records</th><th>Exact km</th><th>Block section / station only</th><th>Not placed</th><th>Warnings</th></tr></thead><tbody>${Object.entries(last).map(([t, x]) => `<tr><td>${esc(t)}</td><td class="nw">${esc(String(x.at || '').slice(0, 16).replace('T', ' '))}</td><td class="small">${esc((x.used || []).join(', '))}</td><td>${x.records}</td><td>${x.exact ?? '—'}</td><td>${x.approx ?? '—'}</td><td>${x.notPlaced ?? (x.records - x.located)}</td><td>${x.warnings ? `<b class="od">${x.warnings}</b>` : 0}</td></tr>`).join('')}</tbody></table></div>` : '<div class="muted">Not read yet.</div>');
  $('fmClean').onclick = async () => { $('fmClean').disabled = true; const stop = ticking($('fmCleanOut'), 'Cleaning'); try { const r = await call('fmcClean'); stop(); H.S.boot = await call('boot').catch(() => H.S.boot); if (VIEWS.reg.clear) VIEWS.reg.clear(); if (VIEWS.loc.clear) VIEWS.loc.clear(); H.render(); watchAfter(document.getElementById('fmOut')); } catch (e) { stop(); $('fmCleanOut').textContent = e.error || e; } };
  $('fmDaily').onchange = async e => { try { await call('fmcDaily', { on: e.target.checked }); toast(e.target.checked ? 'Daily read switched on' : 'Daily read switched off'); } catch (x) { toast(x.error, true); e.target.checked = !e.target.checked; } };
  $('fmGo').onclick = async () => {
    $('fmGo').disabled = true; const stop = ticking($('fmOut'), 'Reading Field Mini Control (about 1–3 minutes)');
    try {
      const r = await call('fmcRead', { from: $('fmFrom').value || undefined }); stop();
      $('fmOut').innerHTML = r.tabs.map(t => `<div class="panel" style="padding:10px 12px;margin-top:8px"><b>${esc(t.tab)}</b>: ${t.used.length} day block(s) (${esc(t.used.join(', '))})<div>${esc(t.placeText || (t.records + ' records'))}</div>${t.days ? `<div class="small">Unit days: ${Object.entries(t.days).map(([k, v]) => v + ' ' + esc(k)).join(' · ')}</div>` : ''}${t.place && t.place.none ? `<div class="small">Not placed – reasons: ${Object.entries(t.place.reasons).sort((a, b) => b[1] - a[1]).map(([k, v]) => v + ' × ' + esc(k)).join(' · ')}</div>` : ''}${t.warnings.length ? `<div class="od small" style="margin-top:4px">${t.warnings.map(w => esc((w.date ? w.date + ' ' : '') + (w.col ? 'column ' + w.col + ': ' : '') + w.msg + (w.expected ? ' – expected "' + w.expected.join('", "') + '", found "' + (w.found || []).join('", "') + '"' : ''))).join('<br>')}</div>` : ''}${t.unlocatedSample.length ? `<details class="small"><summary>not placed (${t.unlocated})</summary><ul>${t.unlocatedSample.map(x => `<li>${esc(x.date)} ${esc(x.unit)} – ${esc(x.place)} ${esc(x.line)}: ${esc(x.why)}</li>`).join('')}</ul></details>` : ''}</div>`).join('') + `<div class="small muted">${Math.round(r.ms / 1000)} s on the server</div>`;
      if (VIEWS.reg.clear) VIEWS.reg.clear(); if (VIEWS.loc.clear) VIEWS.loc.clear();
      H.S.boot = await call('boot').catch(() => H.S.boot);
      watchAfter($('fmOut'));
    } catch (e) { stop(); $('fmOut').innerHTML = `<div class="od">${esc(e.error || e)}</div>`; }
    $('fmGo').disabled = false;
  };
};

/** [PB] B1: after a sheet or feed read the watch is updated in the background; one line shows its progress */
function watchAfter(box) {
  if (!H.watchUpdate || !box) return; const d = document.createElement('div'); d.className = 'small muted'; d.style.marginTop = '6px'; box.appendChild(d);
  H.watchUpdate(t => { d.textContent = t.trim(); }).catch(e => { d.textContent = 'Blind-spot watch not updated: ' + (e.error || e.message || e); });
}
// ---------- Feed ----------
VIEWS.feed = async (el) => {
  const f = (H.S.boot || {}).feed || {};
  const age = f.age || {};
  el.innerHTML = pageHead('Feed status', 'TMS Control\'s read-only portal feed (Drive "TMS Control exports/portal-feed.json", schema 1)') +
    panel('Portal feed', `<div class="kpis" style="grid-template-columns:repeat(auto-fit,minmax(170px,1fr))"><div class="kpi ${age.stale ? 'crit' : 'ok'}"><div class="l">Feed age</div><div class="v">${age.hours == null ? '—' : age.hours + '<small> h</small>'}</div><div class="s">${f.generatedAt ? 'written by TMS Control ' + esc(String(f.generatedAt).slice(0, 16).replace('T', ' ')) : 'not read yet'}${age.stale ? ' – <b>older than ' + ((H.settings().feed || {}).warnHours || 36) + ' h</b>' : ''}</div></div><div class="kpi"><div class="l">Read by the portal</div><div class="v small" style="font-size:18px">${esc(String(f.readAt || '—').slice(0, 16).replace('T', ' '))}</div><div class="s">daily trigger + Read now</div></div></div>
    ${f.counts ? `<div class="small" style="margin-top:8px">${Object.entries(f.counts).map(([k, v]) => `${esc(k)}: <b>${v}</b>`).join(' · ')}</div>` : ''}${f.error ? `<div class="od small">Last error: ${esc(f.error)}</div>` : ''}
    <div style="margin-top:10px"><button class="btn primary" id="fdGo">Read now</button> <label class="small"><input type="checkbox" id="fdForce"> even if unchanged</label></div><div id="fdOut" class="small" style="margin-top:8px"></div>`);
  $('fdGo').onclick = async () => { $('fdGo').disabled = true; const stop = ticking($('fdOut'), 'Reading the portal feed'); try { const r = await call('feedRead', { force: $('fdForce').checked }); stop(); $('fdOut').innerHTML = r.ok ? (r.unchanged ? 'Unchanged since the last read – skipped.' : 'Read: ' + esc(JSON.stringify(r.counts))) : `<span class="od">${esc(r.error)}</span>`; H.S.boot = await call('boot'); if (VIEWS.loc.clear) VIEWS.loc.clear(); if (VIEWS.reg.clear) VIEWS.reg.clear(); if (r.ok && !r.unchanged) watchAfter($('fdOut')); } catch (e) { stop(); $('fdOut').innerHTML = `<span class="od">${esc(e.error || e)}</span>`; } $('fdGo').disabled = false; };
};

// ---------- viewer links ----------
VIEWS.links = async (el) => {
  el.innerHTML = pageHead('Viewer links', 'Read-only links: Overview / Three things, the location card and the work register – nothing else') + panel('Make a viewer link', `<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center"><input id="lkName" placeholder="for whom, e.g. AEN/LLH office" style="min-width:240px"><select id="lkLevel" aria-label="opens first"><option value="division">Division (Sr DEN / DEN / co-ordination) – Overview first</option><option value="aen">AEN – Three things for the AEN's units</option><option value="unit">SSE / JE unit – Three things for the unit</option></select><input id="lkUnit" list="lkUnits" placeholder="unit, e.g. LLH" style="width:120px" class="hidden"><input id="lkAen" list="lkAens" placeholder="AEN, e.g. AEN/LLH" style="width:150px" class="hidden"><datalist id="lkUnits"></datalist><datalist id="lkAens"></datalist><button class="btn primary" id="lkGo">Make link</button></div><div class="small muted" style="margin-top:6px">Read only. Division links open the Overview, AEN and unit links open "Three things" for their own track; every link can switch between the two pages.</div><div id="lkOut" class="small" style="margin-top:8px"></div>`) + panel('Links', '<div id="lkList" class="muted">Loading…</div>');
  const draw = L => { $('lkList').innerHTML = L.length ? `<div class="scroll"><table class="t compact"><thead><tr><th>For</th><th>Opens</th><th>Made</th><th>Last used</th><th>Uses</th><th>Link</th><th></th></tr></thead><tbody>${L.map(x => `<tr><td><b>${esc(x.name)}</b></td><td class="small">${x.level === 'unit' ? 'unit ' + esc(x.unit) : x.level === 'aen' ? esc(x.aen) : 'division'}</td><td class="small nw">${esc(String(x.created).slice(0, 10))}</td><td class="small nw">${esc(String(x.lastSeen || '—').slice(0, 16).replace('T', ' '))}</td><td>${esc(x.uses)}</td><td class="small"><button class="btn ghost sm" data-copy="${esc(x.link)}">Copy</button></td><td><button class="btn ${x.active ? 'secondary' : 'primary'} sm" data-id="${esc(x.id)}" data-on="${x.active ? 0 : 1}">${x.active ? 'Switch off' : 'Switch on'}</button></td></tr>`).join('')}</tbody></table></div>` : '<div class="muted">No viewer links yet.</div>';
    $('lkList').querySelectorAll('[data-copy]').forEach(b => b.onclick = () => copy(b.dataset.copy));
    $('lkList').querySelectorAll('[data-id]').forEach(b => b.onclick = async () => { try { draw(await call('linkSet', { id: b.dataset.id, active: b.dataset.on === '1' })); } catch (e) { toast(e.error, true); } }); };
  call('linkList').then(draw, e => { $('lkList').textContent = e.error; });
  const lv = () => { const v = $('lkLevel').value; $('lkUnit').classList.toggle('hidden', v !== 'unit'); $('lkAen').classList.toggle('hidden', v !== 'aen'); };
  $('lkLevel').onchange = lv;
  (async () => { try { const fl = await H.files([{ kind: 'watch', group: '_all' }, { kind: 'feed', group: '_all' }]); const w = H.snap(fl, 'watch', '_all') || { units: {} }; const f = H.snap(fl, 'feed', '_all') || { units: [] }; const U = new Set(Object.keys(w.units || {}).filter(u => u !== '?')), A = new Set(); Object.values(w.units || {}).forEach(u => { if (u.aen) A.add(u.aen); }); (f.units || []).forEach(u => { if (u.unit) U.add(u.unit); if (u.aen) A.add(u.aen); }); $('lkUnits').innerHTML = [...U].sort().map(u => `<option value="${esc(u)}">`).join(''); $('lkAens').innerHTML = [...A].sort().map(u => `<option value="${esc(u)}">`).join(''); } catch (e) { } })();
  $('lkGo').onclick = async () => { try { const r = await call('linkMake', { name: $('lkName').value, level: $('lkLevel').value, unit: $('lkUnit').value.trim().toUpperCase(), aen: $('lkAen').value.trim() }); $('lkOut').innerHTML = `Link for <b>${esc(r.name)}</b>: <code style="word-break:break-all">${esc(r.link)}</code> <button class="btn ghost sm" id="lkCp">Copy</button>`; $('lkCp').onclick = () => copy(r.link); draw(await call('linkList')); } catch (e) { toast(e.error, true); } };
};
async function copy(t) { try { await navigator.clipboard.writeText(t); toast('Copied'); } catch (e) { prompt('Copy the link', t); } }

// ---------- settings ----------
const FIELDS = [['web.appUrl', 'App address (GitHub Pages)', 'text'], ['feed.warnHours', 'Feed warning after (hours)', 'number'], ['feed.readHourIST', 'Daily feed read (hour IST)', 'number'], ['fmc.firstReadDays', 'First Field Mini Control read: days back', 'number'], ['fmc.overlapDays', 'Days read again each time (late entries)', 'number'], ['fmc.dailyHourIST', 'Daily sheet read (hour IST)', 'number'],
  ['match.dayTol', 'Work package: days apart allowed', 'number'], ['match.kmTolM', 'Work package: metres apart allowed', 'number'], ['match.cardDays', 'Card compliance: days around the work', 'number'], ['rules.tampMonths', 'Rule: tamping older than (months)', 'number'], ['rules.cleanCushionMm', 'Rule: plan deep screening when clean ballast cushion is below (mm)', 'number'], ['rules.backDays', 'Rule: defect back within (days after work)', 'number'], ['rules.noActionDays', 'Rule: no work within (days of card closing)', 'number'],
  ['watch.trcDays', 'Watch B1: TRC run needed every (days)', 'number'], ['watch.b6TgiBelow', 'Watch B6: TMS TGI below', 'number'], ['watch.b6Months', 'Watch B6: untouched for (months)', 'number'], ['watch.repeatCards', 'Watch H1: cards on how many dates', 'number'], ['watch.repeatMonths', 'Watch H1: within (months)', 'number'], ['watch.h2MinGain', 'Watch H2: least TGI gain after work', 'number'], ['watch.h2WindowDays', 'Watch H2: next run within (days)', 'number'], ['watch.p1Days', 'Three things: P1 card open longer than (days)', 'number'], ['watch.lifeWatch', 'Watch H5: share of GMT life', 'number'], ['watch.h5Fractures', 'Watch H5: weld fractures nearby', 'number']];
const getp = (o, p) => p.split('.').reduce((a, k) => a == null ? a : a[k], o); const setp = (o, p, v) => { const k = p.split('.'); let a = o; k.slice(0, -1).forEach(x => { a = a[x] = a[x] && typeof a[x] === 'object' ? a[x] : {}; }); a[k[k.length - 1]] = v; };
VIEWS.settings = async (el) => {
  el.innerHTML = pageHead('Settings', 'Division-specific values live here, not in the program (portability)') + '<div id="stBox" class="muted">Loading…</div>';
  let st; try { st = await call('status'); } catch (e) { $('stBox').textContent = e.error; return; }
  const eff = Object.assign({}, st.defaults); const ov = st.overrides || {};
  const val = p => { const v = getp(ov, p); return v != null ? v : getp(st.defaults, p); };
  $('stBox').outerHTML = panel('Common settings', `<div class="scroll"><table class="t compact"><tbody>${FIELDS.map(([p, l, t]) => `<tr><th style="text-align:left;font-weight:500">${esc(l)}<div class="small muted">${esc(p)}</div></th><td><input data-p="${p}" type="${t}" value="${esc(val(p) ?? '')}" style="width:100%;min-width:120px"></td></tr>`).join('')}</tbody></table></div>
    <details style="margin-top:8px"><summary class="small">Advanced: all overrides as JSON (sections, units, tabs, thresholds…)</summary><textarea id="stJson" rows="12" style="width:100%;font-family:var(--mono);font-size:12px">${esc(JSON.stringify(ov, null, 1))}</textarea><div class="small muted">Defaults: <details><summary>show</summary><pre style="white-space:pre-wrap;font-size:11px">${esc(JSON.stringify(st.defaults, null, 1))}</pre></details></div></details>
    <div style="margin-top:10px"><button class="btn primary" id="stSave">Save</button></div>`);
  $('stSave').onclick = async () => {
    let o; try { o = JSON.parse($('stJson').value || '{}'); } catch (e) { toast('The JSON box has an error: ' + e.message, true); return; }
    document.querySelectorAll('[data-p]').forEach(i => { const p = i.dataset.p; const v = i.type === 'number' ? (i.value === '' ? null : +i.value) : i.value.trim(); const d = getp(st.defaults, p); if (v === null || v === '' || v === d) { const k = p.split('.'); const par = getp(o, k.slice(0, -1).join('.')); if (par && typeof par === 'object') delete par[k[k.length - 1]]; } else setp(o, p, v); });
    try { await call('settingsSave', { overrides: o }); toast('Saved'); H.S.boot = await call('boot'); H.S.N = null; } catch (e) { toast(e.error, true); }
  };
};

// ---------- version check / status ----------
VIEWS.status = async (el) => {
  el.innerHTML = pageHead('Version check', 'This website, the server program and the data held') + '<div id="vsBox" class="muted">Checking…</div>';
  let site = null; try { site = await fetch('build.json?t=' + Date.now(), { cache: 'no-store' }).then(r => r.ok ? r.json() : null); } catch (e) { }
  let st; try { st = await call('status'); } catch (e) { $('vsBox').textContent = e.error; return; }
  const web = (H.CFG.VERSION || ''), srv = st.build;
  const okW = !site || site.web === web, okS = !site || !site.server || site.server === srv;
  const kinds = Object.entries(st.kinds || {}).map(([k, v]) => `<tr><td>${esc(PE.KIND_LABEL[k] || k)}</td><td>${v.files}</td><td>${Number(v.rows).toLocaleString('en-IN')}${v.allRows ? `<div class="small muted">+ ${Number(v.allRows).toLocaleString('en-IN')} in the division-wide recent copy (same records, kept for the work register)</div>` : ''}</td><td class="small">${esc(v.presses.slice(-3).join(', '))}</td><td class="small">${v.groups.filter(g => g !== '_all').length || 1}</td></tr>`).join('');
  $('vsBox').outerHTML = panel('Program', `<div class="kpis" style="grid-template-columns:repeat(auto-fit,minmax(200px,1fr))"><div class="kpi ${okW ? 'ok' : 'crit'}"><div class="l">This website</div><div class="v" style="font-size:18px">${esc(web)}</div><div class="s">${okW ? 'latest published' : 'a newer version ' + esc(site.web) + ' is published – reload the page'}</div></div><div class="kpi ${okS ? 'ok' : 'crit'}"><div class="l">Server program</div><div class="v" style="font-size:18px">${esc(srv || '—')}</div><div class="s">${okS ? 'matches this website' : 'the website expects ' + esc(site.server) + ' – run push.bat'}</div></div></div>
    <div class="small" style="margin-top:8px">Server address: <code>${esc(st.execUrl || '')}</code> · triggers: ${esc((st.triggers || []).join(', ') || 'none')}</div>`) +
    panel('Data held', kinds ? `<div class="scroll"><table class="t compact"><thead><tr><th>Kind</th><th>Files</th><th>Records</th><th>Last presses</th><th>Sections</th></tr></thead><tbody>${kinds}</tbody></table></div>` : '<div class="muted">Nothing loaded yet – Load TMS data.</div>') +
    panel('Reads (feed and Field Mini Control)', st.reads && st.reads.length ? `<div class="scroll"><table class="t compact"><thead><tr><th>When</th><th>Source</th><th>Days / version</th><th>Records</th><th>Placed</th><th>Warnings</th></tr></thead><tbody>${st.reads.map(r => `<tr><td class="nw small">${esc(String(r.When).slice(0, 16).replace('T', ' '))}</td><td class="small">${esc(r.Source)}</td><td class="small">${esc(String(r.Dates).slice(0, 80))}</td><td>${esc(r.Records)}</td><td>${esc(r.Located)}</td><td class="small">${esc(String(r.Warnings || '').slice(0, 120))}</td></tr>`).join('')}</tbody></table></div>` : '<div class="muted">None yet.</div>');
};
})();
