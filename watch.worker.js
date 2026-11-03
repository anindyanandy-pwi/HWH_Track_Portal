// HWH Track Portal – the BLIND-SPOT WATCH computed in a Web Worker (urgent fix B3a, 03-Nov-2026).
// Nothing heavy runs on the page's main thread any more: this worker asks the server for the history files it lacks, unpacks and parses
// them, keeps them in the device cache (IndexedDB "hwhtp" / files – the same cache the pages use), merges them, runs PE.computeWatch and
// saves the result (kind "watch"). The page shows the last stored watch at once and can cancel this worker at any time.
self.window = self;
importScripts('engine.js');
let API = '', TOKEN = '';
const say = t => self.postMessage({ t: 'say', text: t });

// ---------- device cache (IndexedDB, same database as store.js)
let dbp = null;
function db() { if (dbp) return dbp; dbp = new Promise((res, rej) => { const r = indexedDB.open('hwhtp', 1); r.onupgradeneeded = () => { const d = r.result; ['kv', 'files'].forEach(s => { if (!d.objectStoreNames.contains(s)) d.createObjectStore(s); }); }; r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); return dbp; }
const req = r => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
async function idb(mode, fn) { const d = await db(); return new Promise((res, rej) => { const t = d.transaction('files', mode); let out; Promise.resolve(fn(t.objectStore('files'))).then(v => { out = v; }); t.oncomplete = () => res(out); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error); }); }
const keys = () => idb('readonly', s => req(s.getAllKeys()));
const getF = id => idb('readonly', s => req(s.get(id)));
const putF = (id, v) => idb('readwrite', s => req(s.put(v, id)));

// ---------- server (background; cancelled with the worker)
async function call(fn, args, ms) {
  const c = new AbortController(); const t = setTimeout(() => c.abort(), ms || 180000);
  try {
    const r = await fetch(API, { method: 'POST', body: JSON.stringify({ t: TOKEN, fn, args: args || {} }), headers: { 'Content-Type': 'text/plain;charset=utf-8' }, redirect: 'follow', signal: c.signal });
    const j = await r.json(); if (!j.ok) throw new Error(j.error || 'server error'); return j.data;
  } catch (e) { throw new Error(e.name === 'AbortError' ? 'the server did not answer in ' + Math.round((ms || 180000) / 1000) + ' s' : (e.message || String(e))); }
  finally { clearTimeout(t); }
}
async function unB64(b64) { const bin = atob(b64); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return await new Response(new Blob([u]).stream().pipeThrough(new DecompressionStream('gzip'))).text(); }
async function gzB64(text) { const buf = await new Response(new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer(); const u = new Uint8Array(buf); let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); }
/** the files of `want`: new ones fetched from the server (in rounds), the rest from the device cache */
async function files(want) {
  const have = await keys(); let list = [], more = true, n = 0;
  while (more && n < 30) {
    n++; say(n === 1 ? '   asking the server for the files this device does not hold yet…' : '   fetching the rest (round ' + n + ')…');
    const r = await call('files', { want, have }, 240000); list = r.list; more = r.more;
    for (const id of Object.keys(r.data || {})) { const v = JSON.parse(await unB64(r.data[id])); await putF(id, v); have.push(id); }
  }
  const out = []; for (const f of list) out.push(Object.assign({}, f, { data: await getF(f.id) }));
  return out;
}
const merge = (fl, kind, group) => { const L = fl.filter(f => f.kind === kind && (group == null || f.group === group)).sort((a, b) => String(a.pressId).localeCompare(String(b.pressId))); const by = new Map(); for (const f of L) for (const r of (Array.isArray(f.data) ? f.data : [])) by.set(r.id || JSON.stringify(r), r); return [...by.values()]; };
const snap = (fl, kind, group) => { const L = fl.filter(f => f.kind === kind && (group == null || f.group === group)).sort((a, b) => String(a.pressId).localeCompare(String(b.pressId))); return L.length ? L[L.length - 1].data : null; };

self.onmessage = async (e) => {
  const m = e.data || {}; if (m.cmd !== 'run') return;
  API = m.api; TOKEN = m.token; const S = m.settings, b = m.boot || {}, K = b.kinds || {}; const t0 = Date.now();
  try {
    const N = PE.names(S);
    say('Blind-spot watch: getting the stored files (cards, chart data, runs, work, sheet, feed)…');
    const fl = await files([{ kind: 'blockSections', group: '_all' }, { kind: 'assetIndex', group: '_all' }, { kind: 'health', group: '*' }, { kind: 'spotCards', group: '*' }, { kind: 'trcRuns', group: '_all' }, { kind: 'workSite', group: '_all' }, { kind: 'assetChange', group: '_all' }, { kind: 'machineProg', group: '_all' }, { kind: 'itms', group: '_all' }, { kind: 'condition', group: '*' }, { kind: 'fmc', group: '*' }, { kind: 'feed', group: '_all' }, { kind: 'watch', group: '_all' }, { kind: 'ballastCushion', group: '*' }, { kind: 'tampingDue', group: '*' }, { kind: 'fmcDays', group: '*' }, { kind: 'assetChange', group: '_none' }]);
    say('   files ready (' + fl.length + ') – computing…');
    const bs = snap(fl, 'blockSections', '_all'); const L = PE.locator(N, (Array.isArray(bs) ? bs[0] : bs) || { coa: [] }, snap(fl, 'assetIndex', '_all'));
    const groups = k => [...new Set(fl.filter(f => f.kind === k && f.group !== '_all').map(f => f.group))];
    const health = groups('health').map(g => snap(fl, 'health', g)).filter(Boolean);
    const cards = merge(fl.filter(f => f.group !== '_all'), 'spotCards');
    const cond = groups('condition').map(g => snap(fl, 'condition', g) || []).flat();
    const feed = snap(fl, 'feed', '_all') || { work: [], jobs: [], units: [] };
    const fmc = PE.fmcLocate(merge(fl, 'fmc').map(r => PE.fmcClean(r, S)).filter(Boolean), L);
    const tamping = groups('tampingDue').map(g => snap(fl, 'tampingDue', g) || []).flat();
    const days = merge(fl.filter(f => f.kind === 'fmcDays'), 'fmcDays');
    const pc = PE.placeCounts(fmc);
    const ballast = groups('ballastCushion').map(g => snap(fl, 'ballastCushion', g) || []).flat();
    const stnPlace = {}; [...new Set(ballast.filter(x => !x.lid && x.stn).map(x => x.stn))].forEach(st => { try { const w = L.locate({ bsText: st + ' STN LIMIT', lineText: '' }); if (w && w.lid && w.km != null) stnPlace[st] = { lid: w.lid, km: w.km, m: w.m }; } catch (x) { } });
    // [B3a] TRC runs: one run id covers several section-lines (cross-section runs, runs entered in parts) – never merge them by run id
    const trcSeen = new Set(); const trc = []; fl.filter(f => f.kind === 'trcRuns' && f.group === '_all').forEach(f => (f.data || []).forEach(r => { const k = [r.id, r.lid, r.km, r.m, r.km2, r.m2, r.d].join('|'); if (!trcSeen.has(k)) { trcSeen.add(k); trc.push(r); } }));
    const loaded = b.loaded || {}; const tmsAt = Object.values(loaded).flat().map(x => String(x.pressAt || x.at || '')).filter(Boolean).sort().pop() || '';   // UTC kept; shown in IST
    const fmcAt = Object.values((b.fmc && b.fmc.lastRead) || {}).map(x => x.at || '').sort().pop() || '';
    const has = { health: health.length, spotCards: cards.length, trcRuns: K.trcRuns, workSite: K.workSite, fmc: fmc.length, condition: K.condition, itms: K.itms, ballastCushion: ballast.length, tampingDue: tamping.length };
    say(`   computing: ${health.reduce((a, g) => a + (g.lines || []).length, 0)} chart lines, ${cards.length} spot cards, ${trc.length} TRC run parts, ${ballast.length} ballast stretches, ${fmc.length} sheet records…`);
    const today = String(b.today || new Date().toISOString()).slice(0, 10);
    const W = PE.computeWatch({ S, N, today, now: new Date().toISOString(), health, units: feed.units || [], trc, cards, ws: merge(fl, 'workSite', '_all'), acRecent: merge(fl, 'assetChange', '_all'), mpRecent: merge(fl, 'machineProg', '_all'), fmc, feedWork: feed.work || [], jobs: feed.jobs || [], cond, itms: merge(fl, 'itms', '_all'), ballast, stnPlace, tamping, days, pnx: merge(fl, 'assetChange', '_none').filter(a => a.k === 'pnx'), fmcCoverage: (b.fmc && b.fmc.coverage) || {}, has, notPlaced: { total: pc.total, exact: pc.exact, approx: pc.approx, none: pc.none }, dataAt: { tms: tmsAt, fmc: fmcAt, feed: feed.generatedAt || '' }, prev: snap(fl, 'watch', '_all') });
    W.sig = m.sig;
    const ready = W.rules.filter(r => r.status === 'ready').length;
    const summary = { sig: m.sig, computedAt: W.computedAt, ready, waiting: W.rules.filter(r => r.status === 'waiting').map(r => r.id + ':' + r.missing.join('+')), cells: W.cells, units: Object.keys(W.units).length, ms: Date.now() - t0 };
    const lt = W.lineTypes || {}; say('   line types: ' + Object.keys(lt).map(k => `${k} ${lt[k].main} main / ${lt[k].loop} loop / ${lt[k].siding} siding / ${lt[k].unknown} unknown`).join('; '));
    const txt = JSON.stringify(W);
    say(`   ${ready} of ${W.rules.length} rules ready (${Math.round((Date.now() - t0) / 1000)} s); saving the watch (${Math.round(txt.length / 1024)} kB)…`);
    const pid = 'w' + new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);
    await call('ingest', { kind: 'watch', pressId: pid, at: W.computedAt, files: [{ group: '_all', rows: W.rules.length, b64: await gzB64(txt) }], summary }, 240000);
    self.postMessage({ t: 'done', W, summary });
  } catch (err) { self.postMessage({ t: 'error', error: String(err && err.message || err) }); }
};
