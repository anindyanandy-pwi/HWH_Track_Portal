// HWH Track Portal – app shell (portal build chat [PB], phase A, 02-Nov-2026). No AI at run time.
// Talks to the Apps Script server with ONE call per screen (each call costs 35–50 s on Google): the history files a screen needs come in
// one "files" answer, gzip + base64, and stay on this device (IndexedDB, by Drive file id – the files never change), so the next visit is instant.
(function () {
'use strict';
const CFG = window.HWHTP_CONFIG || {}; const ST = window.HWHTP_STORE; const UI = window.UI;
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const dmy = s => { if (!s) return '—'; const m = String(s).match(/^(\d{4})-(\d\d)(?:-(\d\d))?/); return m ? (m[3] ? `${m[3]}-${m[2]}-${m[1]}` : `${m[2]}-${m[1]}`) : String(s); };
const B = s => UI ? UI.bi(s) : { p: s, s: '' };

// personal link ?t=… is kept on this device and removed from the address bar
(() => { const q = new URLSearchParams(location.search); const t = q.get('t'); if (t) { try { localStorage.setItem('hwhtp.token', t); } catch (e) { } history.replaceState(null, '', location.pathname + location.hash); } })();
let TOKEN = ''; try { TOKEN = localStorage.getItem('hwhtp.token') || ''; } catch (e) { }

// ---------- server calls ----------
function fetchT(url, opt, ms) { return new Promise((res, rej) => { const c = new AbortController(); const t = setTimeout(() => { c.abort(); rej(new Error('timeout')); }, ms); fetch(url, Object.assign({ signal: c.signal }, opt)).then(r => { clearTimeout(t); res(r); }, e => { clearTimeout(t); rej(e); }); }); }
async function call(fn, args, opt = {}) {
  const body = JSON.stringify({ t: TOKEN, fn, args: args || {} }); let r;
  try { const res = await fetchT(CFG.API, { method: 'POST', body, headers: { 'Content-Type': 'text/plain;charset=utf-8' }, redirect: 'follow' }, opt.timeout || 330000); r = await res.json(); }
  catch (e) { setNet(false); throw { error: e && e.message === 'timeout' ? 'The server did not answer in time. Try again in a minute.' : navigator.onLine === false ? 'No signal – this needs the network.' : 'Could not reach the server – try again.' }; }
  setNet(true);
  if (r.ok) return r.data;
  if (r.access) denied(r.error);
  throw r;
}
function setNet(ok, msg) { const b = $('netbar'); if (!b) return; if (ok) { b.classList.add('hidden'); return; } b.classList.remove('hidden'); b.textContent = msg || 'Server not reachable – showing data saved on this device where possible.'; }

// ---------- gzip / base64 ----------
async function gzB64(text) {
  const s = new Blob([text]).stream().pipeThrough(new CompressionStream('gzip')); const blob = await new Response(s).blob();
  return await new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result).split(',')[1]); fr.onerror = rej; fr.readAsDataURL(blob); });
}
async function unB64(b64) {
  const bin = atob(b64); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  const s = new Blob([u]).stream().pipeThrough(new DecompressionStream('gzip')); return await new Response(s).text();
}

// ---------- history files (cached on this device by Drive file id) ----------
const MEM = {};
async function files(want, note) {
  const cached = (await ST.all('files').catch(() => [])).map(x => x.key);
  let have = cached.slice(), list = [], more = true, n = 0;
  while (more && n < 6) {
    n++; if (note) note(n === 1 ? 'Asking the server (about 40 s)…' : 'Fetching the rest…');
    const r = await call('files', { want, have });
    list = r.list; more = r.more;
    for (const id of Object.keys(r.data || {})) { const txt = await unB64(r.data[id]); const val = JSON.parse(txt); MEM[id] = val; await ST.set('files', id, val).catch(() => { }); have.push(id); }
  }
  for (const f of list) if (!MEM[f.id]) MEM[f.id] = await ST.get('files', f.id).catch(() => null);
  return list.map(f => Object.assign({}, f, { data: MEM[f.id] }));
}
/** merge the records of several presses: newest press wins per record id */
function merge(fl, kind, group) {
  const L = fl.filter(f => f.kind === kind && (group == null || f.group === group)).sort((a, b) => String(a.pressId).localeCompare(String(b.pressId)));
  const by = new Map(); for (const f of L) for (const r of (Array.isArray(f.data) ? f.data : [])) by.set(r.id || JSON.stringify(r), r);
  return [...by.values()];
}
function snap(fl, kind, group) { const L = fl.filter(f => f.kind === kind && (group == null || f.group === group)).sort((a, b) => String(a.pressId).localeCompare(String(b.pressId))); return L.length ? L[L.length - 1].data : null; }

// ---------- state, settings, names ----------
const S = { boot: null, view: null, N: null, BS: null, L: null };
function settings() { return Object.assign({}, CFG.SETTINGS || {}, (S.boot && S.boot.settings) || {}); }
function names() { if (!S.N) S.N = PE.names(settings()); return S.N; }
async function locator(note) {
  if (S.L) return S.L;
  const fl = await files([{ kind: 'blockSections', group: '_all' }, { kind: 'assetIndex', group: '_all' }], note);
  const bs = snap(fl, 'blockSections'); S.BS = Array.isArray(bs) ? bs[0] : bs; S.AI = snap(fl, 'assetIndex');
  S.L = PE.locator(names(), S.BS || { coa: [] }, S.AI || null); return S.L;
}

// ---------- page frame ----------
function pageHead(title, crumbs, extra = '') { return `<div class="pagehead"><div class="crumbs">${crumbs || esc(UI.APP.org)}</div><div class="phrow"><h1>${UI ? UI.title(title) : esc(title)}</h1>${extra}</div></div>`; }
function modal(html, ok) { $('modalBody').innerHTML = html; $('modal').classList.remove('hidden'); $('modalOk').classList.toggle('hidden', !ok); $('modalOk').onclick = () => { if (ok && ok() !== false) closeModal(); }; $('modalCancel').onclick = closeModal; }
function closeModal() { $('modal').classList.add('hidden'); }
function toast(msg, bad) { const d = document.createElement('div'); d.className = 'toast'; d.style.cssText = `position:fixed;left:50%;bottom:90px;transform:translateX(-50%);z-index:99;background:${bad ? 'var(--crit)' : 'var(--ink)'};color:var(--bg);padding:10px 16px;border-radius:12px;max-width:90vw;font-size:14px`; d.textContent = msg; document.body.appendChild(d); setTimeout(() => d.remove(), 3800); }
const VIEWS = {};
function navs() {
  const A = S.boot && S.boot.role === 'admin';
  return [['loc', 'Location card'], ['reg', 'Work register']].concat(A ? [['#Admin'], ['load', 'Load TMS data'], ['fmc', 'Read Field Mini Control'], ['feed', 'Feed status'], ['links', 'Viewer links'], ['settings', 'Settings'], ['status', 'Version check']] : []);
}
function drawNav() {
  $('nav').innerHTML = navs().map(x => x[0][0] === '#' ? `<div class="navgrp">${UI.t(x[0].slice(1))}</div>` : `<button data-k="${x[0]}" class="${x[0] === S.view ? 'on' : ''}">${UI.navIcon(x[0])}${(b => `<span class="nl"><span class="p">${b.p}</span>${b.s ? `<span class="s">${b.s}</span>` : ''}</span>`)(B(x[1]))}<span class="cnt"></span></button>`).join('');
  $('nav').querySelectorAll('button[data-k]').forEach(b => b.onclick = () => go(b.dataset.k));
}
function go(k, arg) { S.view = k; S.arg = arg; try { history.replaceState(null, '', '#' + k + (arg ? '/' + encodeURIComponent(arg) : '')); } catch (e) { } render(); }
function render() {
  drawNav(); const el = $('views'); el.innerHTML = '';
  const f = VIEWS[S.view] || VIEWS.loc; Promise.resolve(f(el, S.arg)).catch(e => { el.innerHTML += `<div class="panel body"><div class="inner"><b>Could not show this page.</b><p>${esc(e.error || e.message || e)}</p></div></div>`; console.error(e); });
}
function denied(msg) {
  $('rail').classList.add('hidden'); $('boot').classList.add('hidden');
  $('views').innerHTML = `<div class="signin"><img class="slogo" src="${UI.APP.logo}" alt=""><h1>${esc(UI.APP.name)}</h1><div class="shi">${esc(UI.APP.nameHi)}</div><div class="sorg">${esc(UI.APP.org)} · ${esc(UI.APP.orgHi)}</div><div class="denied"><div class="eyebrow">Access</div><h2>Cannot open the portal</h2><p>${esc(String(msg).replace(/^ACCESS:\s*/, ''))}</p></div><div class="creditcard">${UI.credit({ br: true, full: true })}</div></div>`;
  document.body.classList.add('signedout');
}
async function start() {
  $('foot').innerHTML = UI.credit({ br: true, full: true });
  $('pname').textContent = UI.APP.name; $('porg').textContent = (UI.APP.nameHi ? UI.APP.nameHi + ' · ' : '') + UI.APP.org;
  document.title = UI.APP.name;
  if (!CFG.API) { denied('This copy of the portal has no server address yet (config.js).'); return; }
  if (!TOKEN) { denied('ACCESS: This page needs a portal link. Ask the division office (track portal admin) for one.'); return; }
  // the saved copy of the last start-up answer is shown at once, the server is asked in the background
  let saved = null; try { saved = await ST.get('kv', 'boot'); } catch (e) { }
  const fresh = call('boot').then(b => { ST.set('kv', 'boot', b).catch(() => { }); return b; });
  S.boot = saved || await fresh.catch(e => { if (!e.access) denied(e.error || 'Could not reach the server.'); throw e; });
  if (saved) fresh.then(b => { S.boot = b; drawWho(); }).catch(e => { if (!e.access) setNet(false, 'Showing the data saved on this device – the server did not answer (' + (e.error || '') + ').'); });
  $('boot').classList.add('hidden'); $('rail').classList.remove('hidden'); drawWho();
  const h = location.hash.replace(/^#/, '').split('/'); S.view = VIEWS[h[0]] ? h[0] : 'loc'; S.arg = h[1] ? decodeURIComponent(h[1]) : null;
  $('btnReload').onclick = async () => { S.L = null; try { S.boot = await call('boot'); ST.set('kv', 'boot', S.boot).catch(() => { }); } catch (e) { toast(e.error || 'Not reachable', true); } render(); };
  render();
}
function drawWho() { const b = S.boot; if (!b) return; $('who').classList.remove('hidden'); $('whoRole').textContent = b.role === 'admin' ? 'Admin' : 'Viewer'; $('whoName').textContent = b.name || ''; }

window.TMSC = { render };   // ui.js redraws on a language change
window.HWHTP = { CFG, ST, S, $, esc, dmy, B, call, files, merge, snap, gzB64, unB64, settings, names, locator, pageHead, modal, closeModal, toast, VIEWS, go, render, setNet, MEM };
document.addEventListener('DOMContentLoaded', () => { start().catch(e => console.error(e)); });
})();
