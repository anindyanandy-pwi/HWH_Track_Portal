// ===== engine/core.js
// HWH Track Portal – shared engine, part 1: names, dates, positions, cells (portal build chat [PB], 02-Nov-2026).
// The same file runs in the browser (script tag), in Apps Script (built into src/90_Engine.gs) and in the node tests.
// Section / line naming follows TMS Control's names.js (copied 02-Nov-2026 from TMS_Control_full_workspace.zip app/src/names.js) –
// but the section list itself now comes from settings (portability rule: no division names in code).
var PE = (typeof PE !== 'undefined' && PE) || {};
(function (PE) {
  'use strict';
  var norm = function (s) { return String(s || '').toLowerCase().replace(/\bjn\b|junction/g, '').replace(/[^a-z0-9]/g, ''); };
  var LINE_DISPLAY = { UP: 'UP', DN: 'DN', REV: 'Rev', UPCH: 'Up Chord', DNCH: 'Dn Chord', '3RD': '3rd Line', SL: 'Single' };

  /** names(settings) -> section / line / unit normalisers built from the settings' section aliases. */
  PE.names = function (S) {
    // [PB] B2: the settings also set the placeholder words and the line-type name rules
    if (S && S.fmc && S.fmc.placeholders && PE.setPlaceholders) PE.setPlaceholders(S.fmc.placeholders);
    if (S && S.lineType && PE.setLineTypes) PE.setLineTypes(S.lineType);
    if (S && S.fmc && S.fmc.proofCells && PE.setProofCells) PE.setProofCells(S.fmc.proofCells, S.fmc.proofCellsBlockOnly);
    var groups = (S && S.sections) || [];
    var MAP = {};
    groups.forEach(function (g) { g.forEach(function (a) { MAP[norm(a)] = g[0]; }); });
    function sectionName(raw) {
      if (raw == null) return null; var k = norm(raw); if (!k) return null;
      if (MAP[k]) return MAP[k];
      return String(raw).trim().replace(/\s+/g, ' ');
    }
    function sectionCode(name) { for (var i = 0; i < groups.length; i++) if (groups[i][0] === name) return groups[i][1]; return name; }
    function lineKey(raw) {
      if (raw == null) return null;
      var s = String(raw).toLowerCase().replace(/\s+/g, ' ').trim(); if (!s) return null; var m;
      if ((m = s.match(/^(up|dn|down)\s*-?\s*(\d)$/))) return (m[1] === 'up' ? 'UP' : 'DN') + m[2];
      if (/up\s*chord/.test(s)) return 'UPCH';
      if (/(dn|down)\s*chord/.test(s)) return 'DNCH';
      if (/rev/.test(s)) return 'REV';
      if (/iii|3rd|third/.test(s)) return '3RD';
      if (/^single|^sl$/.test(s)) return 'SL';
      if (/^up( line)?$|^up\s*main/.test(s)) return 'UP';
      if (/^(dn|down)( line)?$|^(dn|down)\s*main/.test(s)) return 'DN';
      return s.toUpperCase().replace(/\s+/g, ' ');
    }
    function lineDisplay(k) { return LINE_DISPLAY[k] || (k && String(k).replace(/^(UP|DN)(\d)$/, '$1 $2')) || k; }
    function lineId(sec, line) { var n = sectionName(sec); if (!n) return null; var k = lineKey(line); if (!k) return null; return sectionCode(n) + ' ' + lineDisplay(k); }
    // a field line text ("REV/L", "DN/ML", "UP HBC - 1", "DN/TAK", "SL", "UP & DN") -> line key(s)
    function fieldLines(t) {
      var s = String(t || '').toUpperCase(); var out = [];
      var first = s.split('\n')[0]; var nm = first.match(/\b(UP|DN|DOWN)\b[^0-9&+]{0,10}?(?:-\s*)?([1-4])\b(?!\s*\/)/);   // "UP HBC1", "DN HBC - 1", "DN 2" -> UP1 / DN1 / DN2
      if (nm) { out.push((nm[1] === 'UP' ? 'UP' : 'DN') + nm[2]); return out; }
      if (/\bREV|REVERS/.test(s)) out.push('REV');
      if (/\bUP\b|^UP|UP\//.test(s) && !/CHORD/.test(s)) out.push('UP');
      if (/\bDN\b|^DN|DN\/|\bDOWN\b/.test(s) && !/CHORD/.test(s)) out.push('DN');
      if (/UP\s*CHORD/.test(s)) out.push('UPCH'); if (/(DN|DOWN)\s*CHORD/.test(s)) out.push('DNCH');
      if (/\bSL\b|SINGLE/.test(s)) out.push('SL');
      if (/\b3RD\b|\bIII/.test(s)) out.push('3RD');
      return out;
    }
    var pre = ((S && S.unitPrefixes) || []).map(function (p) { return p.toUpperCase(); }).sort(function (a, b) { return b.length - a.length; });
    // SSE unit key: "SSE/P.WAY/BWN(E)" / "BWN/E" / "bwn e" -> "BWNE"
    function unitKey(raw) {
      var s = String(raw || '').toUpperCase().trim(); if (!s) return '';
      for (var i = 0; i < pre.length; i++) if (s.indexOf(pre[i]) === 0) { s = s.slice(pre[i].length); break; }
      s = s.replace(/\/(SEC|SPL|INC|IC)\.?$/, '');
      return s.replace(/[^A-Z0-9]/g, '');
    }
    // storage group of a line id = its section code ("BLY-BDC DN" -> "BLY-BDC"); one Drive file per kind x section x press
    var codes = groups.map(function (g) { return g[1]; }).sort(function (a, b) { return b.length - a.length; });
    function groupOf(lid) { if (!lid) return '_none'; for (var i = 0; i < codes.length; i++) if (lid.indexOf(codes[i] + ' ') === 0) return codes[i]; return '_other'; }
    return { groupOf: groupOf, sectionName: sectionName, sectionCode: sectionCode, lineKey: lineKey, lineDisplay: lineDisplay, lineId: lineId, fieldLines: fieldLines, unitKey: unitKey, norm: norm };
  };

  // ---------- positions and cells (health.js convention: P = km*10000 + m; 200 m cells, cell 4 takes the rest of a long km) ----------
  PE.P = function (km, m) { return (+km || 0) * 10000 + (+m || 0); };
  PE.kmOf = function (p) { return Math.floor(p / 10000); };
  PE.cellOf = function (m) { return Math.max(0, Math.min(4, Math.floor((+m || 0) / 200))); };
  PE.cellKey = function (lid, km, m) { return lid + '|' + (+km) + '|' + PE.cellOf(m); };
  PE.fmtKm = function (km, m) { return km == null ? '—' : km + '/' + (m == null ? 0 : Math.round(+m * 10) / 10); };

  // ---------- dates ----------
  var p2 = function (n) { return String(n).padStart ? String(n).padStart(2, '0') : ('0' + n).slice(-2); };
  PE.p2 = p2;
  var MON = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
  /** '01/11/2026', '01/11/2026:15:25', '2026-11-01', '20-AUG-26', 'Mar-25' -> ISO date (yyyy-mm-dd or yyyy-mm) */
  PE.isoDate = function (s) {
    s = String(s == null ? '' : s).trim(); var m;
    if (!s) return null;
    if ((m = s.match(/^(\d{4})-(\d\d)-(\d\d)/))) return m[1] + '-' + m[2] + '-' + m[3];
    if ((m = s.match(/^(\d{4})(\d\d)(\d\d)/))) return m[1] + '-' + m[2] + '-' + m[3];
    if ((m = s.match(/^(\d\d?)[\/.-](\d\d?)[\/.-](\d{2,4})/))) { var y = +m[3]; if (y < 100) y += 2000; return y + '-' + p2(m[2]) + '-' + p2(m[1]); }
    if ((m = s.match(/^(\d\d?)-([A-Za-z]{3})-(\d{2,4})/)) && MON[m[2].toLowerCase()]) { var y2 = +m[3]; if (y2 < 100) y2 += 2000; return y2 + '-' + p2(MON[m[2].toLowerCase()]) + '-' + p2(m[1]); }
    if ((m = s.match(/^([A-Za-z]{3})[a-z]*[-\s'](\d{2,4})/)) && MON[m[1].toLowerCase()]) { var y3 = +m[2]; if (y3 < 100) y3 += 2000; return y3 + '-' + p2(MON[m[1].toLowerCase()]); }
    return null;
  };
  PE.addDays = function (iso, n) { var d = new Date(String(iso).slice(0, 10) + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
  var DAYC = {}, DAYN = 0;   // [B3a] day numbers cached (the watch compares dates millions of times)
  var dayNo = function (x) { x = String(x || ''); if (x.length === 7) x += '-01'; x = x.slice(0, 10); var v = DAYC[x]; if (v === undefined) { if (DAYN > 50000) { DAYC = {}; DAYN = 0; } v = DAYC[x] = Date.parse(x + 'T00:00:00Z') / 864e5; DAYN++; } return v; };
  PE.daysBetween = function (a, b) { return Math.round(dayNo(b) - dayNo(a)); };
  PE.num = function (v) { var n = parseFloat(String(v == null ? '' : v).replace(/,/g, '')); return isFinite(n) ? n : null; };
  /** minutes since midnight from "23:30", "0:30", "03.00" */
  PE.hm = function (s) { var m = String(s || '').match(/(\d{1,2})\s*[:.]\s*(\d{2})/); return m ? (+m[1]) * 60 + (+m[2]) : null; };
  /** "23:30-03:30" / "11:20 - 14:30 (190 minutes)" / "1:00 to 2:44" -> [{a, b}] minutes (b may pass midnight: b < a means next day) */
  PE.timeSpans = function (s) {
    var out = []; var re = /(\d{1,2}\s*[:.]\s*\d{2})\s*(?:-+|to|–)\s*(\d{1,2}\s*[:.]\s*\d{2})/gi; var m;
    while ((m = re.exec(String(s || '')))) out.push({ a: PE.hm(m[1]), b: PE.hm(m[2]) });
    return out;
  };
  /** km / m written in the field: "53/29-31", "km156/09-152/36", "95/13-96/03", "LOCATION KM:-89/25 - 27", "84/370-84/630" */
  PE.kmText = function (s) {
    var t = String(s || ''); var m = t.match(/(\d{1,3})\s*\/\s*(\d{1,4}(?:\.\d)?)(?:\s*(?:-|–|to)\s*(?:(\d{1,3})\s*\/\s*)?(\d{1,4}(?:\.\d)?))?/i);
    if (!m) return null;
    var km = +m[1], mm = +m[2]; var km2 = m[3] != null ? +m[3] : km, mm2 = m[4] != null ? +m[4] : mm;
    if (km > 400) return null;
    if (PE.P(km2, mm2) < PE.P(km, mm)) { var a = km; km = km2; km2 = a; var b = mm; mm = mm2; mm2 = b; }
    return { km: km, m: mm, km2: km2, m2: mm2 };
  };
  /** person-free "who": keep only designations ("SSE/P.WAY/HWH/SPL"), drop names and phone numbers. */
  PE.desig = function (s) {
    var t = String(s || ''); var m = t.match(/\b(?:SSE|JE|SE|PWI|CIOW|ADEN|AEN|DEN|Sr\.?\s*DEN)\s*\/\s*[A-Za-z.]*(?:\/[A-Za-z0-9().\-]+)*/ig);
    return m ? m.map(function (x) { return x.trim().replace(/\s+/g, ''); }).filter(function (x, i, a) { return a.indexOf(x) === i; }).join(' + ') : '';
  };
  PE.noPhone = function (s) { return String(s == null ? '' : s).replace(/(\+?91[\s-]?)?\b[6-9]\d{9}\b/g, '[phone removed]'); };
  PE.stripName = function (s) { return String(s || '').replace(/\s*\([^)]*[a-z][^)]*\)\s*$/, '').trim(); };   // "JE/PW/KQU/Sec(Soumya …)" -> "JE/PW/KQU/Sec"
  // [PB] B2: a PLACEHOLDER cell = blank, or no letter / digit at all (any dashes, dots, stars, any spacing), or a word from the settings list
  // (settings.fmc.placeholders: NIL, N/A, No work …; any case, any spacing). PE.setPlaceholders(list) is called with the settings.
  var PH = ['nil', 'nill', 'na', 'n/a', 'n.a.', 'none', 'no work', 'not applicable', 'no block', 'not required', 'no'];
  var phKey = function (x) { return String(x).toLowerCase().replace(/\s+/g, ' ').replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, '').trim(); };
  var PHSET = {}; PH.forEach(function (w) { PHSET[phKey(w)] = 1; PHSET[phKey(w).replace(/[^a-z0-9]/g, '')] = 1; });
  PE.setPlaceholders = function (list) { if (!list || !list.length) return; PHSET = {}; list.forEach(function (w) { PHSET[phKey(w)] = 1; PHSET[phKey(w).replace(/[^a-z0-9]/g, '')] = 1; }); };
  PE.empty = function (v) {
    var s = String(v == null ? '' : v).trim(); if (!s) return true;
    if (!/[A-Za-z0-9\u0900-\u097F]/.test(s) && !/[^\x00-\x7F\u2010-\u2015\u2212\u2026\u00B7\u2022\uFE58\uFE63\uFF0D\uFF3F]/.test(s)) return true;   // only dashes / dots / punctuation
    if (!/[A-Za-z0-9\u0900-\u097F]/.test(s) && /^[\s\p{P}\p{S}]*$/u.test(s)) return true;
    var k = phKey(s); return !!(PHSET[k] || PHSET[k.replace(/[^a-z0-9]/g, '')]);
  };

  // [B3b] every date-time is SHOWN in IST (Asia/Kolkata) with an "IST" label; files keep UTC. PE.ist('2026-11-02T05:28:58Z') -> "02-11-2026 10:58 IST"
  var p2i = function (n) { return (n < 10 ? '0' : '') + n; };
  PE.istParts = function (iso) {
    var s = String(iso || ''); if (!s) return null; var t;
    if (/^\d{14}$/.test(s)) t = Date.UTC(+s.slice(0, 4), +s.slice(4, 6) - 1, +s.slice(6, 8), +s.slice(8, 10), +s.slice(10, 12), +s.slice(12, 14));   // press id yyyymmddhhmmss (UTC)
    else if (/^\d{4}-\d\d-\d\d$/.test(s)) return null;   // a plain date has no time – not converted
    else t = Date.parse(s);
    if (isNaN(t)) return null; var d = new Date(t + 330 * 60000);
    return { d: p2i(d.getUTCDate()) + '-' + p2i(d.getUTCMonth() + 1) + '-' + d.getUTCFullYear(), t: p2i(d.getUTCHours()) + ':' + p2i(d.getUTCMinutes()), iso: d.toISOString().slice(0, 10) };
  };
  PE.ist = function (iso, dateOnly) { var x = PE.istParts(iso); if (!x) { var s = String(iso || ''); return /^\d{4}-\d\d-\d\d$/.test(s) ? s.slice(8, 10) + '-' + s.slice(5, 7) + '-' + s.slice(0, 4) : (s || '—'); } return dateOnly ? x.d : x.d + ' ' + x.t + ' IST'; };
  /** the IST calendar date (yyyy-mm-dd) of a UTC time */
  PE.istDate = function (iso) { var x = PE.istParts(iso); return x ? x.iso : String(iso || '').slice(0, 10); };
  /** a TMS data press shown by the collector's pressLabel / atIst, else its time in IST – never the raw press id */
  PE.pressLabel = function (p) { if (!p) return '—'; if (typeof p === 'string') return PE.ist(p); return p.pressLabel || (p.atIst ? (/IST/.test(p.atIst) ? p.atIst : p.atIst + ' IST') : PE.ist(p.at || p.pressAt || p.pressId)); };
  PE.blank = function (v) { return !String(v == null ? '' : v).trim(); };
})(PE);


// ===== engine/linetype.js
// HWH Track Portal – shared engine: LINE TYPE (batch B2, 03-Nov-2026; project doc HWH_Portal_LANDING.md "Line type").
// Every record and every stretch / yard line is MAIN (running lines of block sections + the main line through stations), LOOP (loops and
// other yard lines) or SIDING (goods, sick, engineering and other non-running lines – counted with the loop lines, tagged "siding").
// Only what the data carries is used; each answer names its source. What cannot be worked out is null ("line type unknown" – B7), never guessed.
var PE = (typeof PE !== 'undefined' && PE) || {};
(function (PE) {
  'use strict';
  var LT = { siding: [], loop: [], ask: [], main: [] };
  var rx = function (a) { return (a || []).map(function (w) { return new RegExp(w, 'i'); }); };
  /** settings.lineType: {siding: [regex…], loop: [regex…], ask: [regex…]} – ask = names the program must not decide (avoiding / fly-over lines …) */
  PE.setLineTypes = function (o) { o = o || {}; LT = { siding: rx(o.siding), loop: rx(o.loop), ask: rx(o.ask), main: (o.mainNamed || []).map(function (x) { return { tag: x.tag, re: new RegExp(x.re, 'i') }; }) }; };
  // [PB] B2a: P&C register (TMS asset changes "pnx": station, point no., line, km, line type) – decides P&C spot cards
  var PNX = null; var pkey = function (x) { return String(x || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); };
  PE.setPnx = function (list) { if (!list || !list.length) { PNX = null; return; } PNX = {}; (list || []).forEach(function (p) { if (!p || p.km == null) return; var k = pkey(p.to || p.turnout); if (!k) return; (PNX[k] = PNX[k] || []).push(p); }); };
  var any = function (L, s) { for (var i = 0; i < L.length; i++) if (L[i].test(s)) return L[i].source; return null; };
  // running-line keys of a TMS section-line (core.js lineKey): UP, DN, UP1…, DN2…, Rev, Single, Up / Dn Chord, 3rd Line
  var RUNNING = /^(UP|DN|UP\d|DN\d|REV|SL|UPCH|DNCH|3RD)$/;
  PE.isRunningKey = function (k) { return RUNNING.test(String(k || '')); };
  /** by a line NAME alone: {t, src} | null */
  PE.lineTypeByName = function (name) {
    var s = String(name || '').trim(); if (!s) return null;
    for (var i = 0; i < LT.main.length; i++) if (LT.main[i].re.test(s)) return { t: 'main', sub: LT.main[i].tag, src: 'line name "' + s + '" = ' + LT.main[i].tag + ' (main line, settings.lineType.mainNamed)' };
    var a = any(LT.ask, s); if (a) return { t: null, src: 'line name "' + s + '" – not decided (rule /' + a + '/ in settings.lineType.ask)' };
    if (any(LT.siding, s)) return { t: 'siding', src: 'line name "' + s + '"' };
    if (any(LT.loop, s)) return { t: 'loop', src: 'line name "' + s + '"' };
    return null;
  };
  /** a TMS section-line id ("BLY-BDC DN", "BLY-BDC COMMON LOOP") -> {t, src} */
  PE.lineTypeOfLid = function (lid, N) {
    if (!lid) return { t: null, src: 'no section-line' };
    var g = N ? N.groupOf(lid) : '_other'; var line = g && g.charAt(0) !== '_' ? String(lid).slice(g.length + 1) : String(lid).replace(/^\S+\s/, '');
    var k = N ? N.lineKey(line) : line.toUpperCase();
    if (PE.isRunningKey(k)) return { t: 'main', src: 'TMS section-line (running line)' };
    var b = PE.lineTypeByName(line); if (b) return { t: b.t, sub: b.sub, src: 'TMS section-line, ' + b.src };
    return { t: null, src: 'TMS line "' + line + '" not recognised' };
  };
  /** a field line text (Field Mini Control, machine progress "YD", "UP LOOP", "DN/ML", "SDG") -> {t, src} */
  PE.lineTypeOfText = function (text, N) {
    var s = String(text || '').trim(); if (!s || PE.empty(s)) return { t: null, src: 'line not given' };
    var b = PE.lineTypeByName(s); if (b) return b;
    var fl = N ? N.fieldLines(s) : []; if (fl.length) return { t: 'main', src: 'line "' + s.split('\n')[0] + '" = running line' };
    return { t: null, src: 'line "' + s.split('\n')[0] + '" not recognised' };
  };
  /** one record of a stored kind -> {t, src}; cached on the record as r.ltp / r.ltps */
  PE.lineType = function (r, kind, N) {
    if (!r) return { t: null, src: '' };
    if (r.ltp !== undefined) return { t: r.ltp, src: r.ltps, sub: r.ltsub };
    var o;
    if (kind === 'pnx' || r.k === 'pnx') {   // TMS asset register P&C line type ("Main Line" / "Loop Line") + the line name
      var nm = PE.lineTypeByName(r.ln); var f = String(r.lt || '').toLowerCase();
      o = nm && nm.t === 'main' && nm.sub ? nm : nm && nm.t === 'siding' ? { t: 'siding', src: 'asset register "' + r.lt + '", ' + nm.src } : /main/.test(f) ? { t: 'main', src: 'asset register line type "Main Line"' } : /loop/.test(f) ? { t: 'loop', src: 'asset register line type "Loop Line"' } : nm || { t: null, src: 'asset register line type not given' };
    } else if (kind === 'ballast' || kind === 'ballastCushion') {
      if (r.lid) o = PE.lineTypeOfLid(r.lid, N);
      else {
        var y = PE.lineTypeByName(r.yl);
        if (y) o = { t: y.t, sub: y.sub, src: 'ballast register, station ' + r.stn + ' yard, ' + y.src };
        else if (!String(r.yl || '').trim() && r.xo) o = { t: 'loop', src: 'ballast register, station ' + r.stn + ' yard crossover ' + r.xo };
        else if (/^\s*(line\s*no\.?\s*\d|\d+\s*$|pf\b|platform|yard\s*line|rl\s*\d|line\s*\d)/i.test(r.yl || '')) o = { t: 'loop', src: 'ballast register, station ' + r.stn + ' yard line "' + r.yl + '" (numbered yard line – not a section running line)' };
        else o = { t: null, src: 'ballast register, station ' + r.stn + ' yard line "' + (r.yl || '') + '" not recognised' };
      }
    } else if (kind === 'fmc') {
      var lt = PE.lineTypeOfText(r.line, N); var bsy = PE.lineTypeByName(r.bs);
      o = lt.t || !bsy ? lt : { t: bsy.t, src: 'place "' + r.bs + '"' };
      if (o.t) o.src = 'Field Mini Control ' + o.src;
    } else if (kind === 'workSite') {
      var k = N ? N.lineKey(r.ln) : null;
      o = PE.isRunningKey(k) ? { t: 'main', src: 'TMS work site on section-line ' + (r.ln || '') } : (PE.lineTypeByName(r.ln) || { t: null, src: 'TMS work site line "' + (r.ln || '') + '" not recognised' });
    } else if ((kind === 'spotCards' || kind === 'card') && /X-?ING/i.test(r.it || '') && PNX) {
      // P&C card: TMS hangs every card on a section-line km – a yard turnout looks like main line. The P&C register decides.
      var g0 = N ? N.groupOf(r.lid) : ''; var cl = N && r.lid ? N.lineKey(String(r.lid).slice(g0.length + 1)) : '';
      var pos = (+r.km || 0) + (+r.m || 0) / 1000;
      var cand = (PNX[pkey(r.an)] || []).filter(function (p) { return Math.abs((+p.km || 0) + (+p.m || 0) / 1000 - pos) <= 1; });
      var same = cand.filter(function (p) { return N && N.lineKey(p.ln) === cl; }); if (same.length) cand = same;
      var ts = {}; cand.forEach(function (p) { var q = PE.lineType(Object.assign({}, p, { ltp: undefined }), 'pnx', N); ts[q.t || 'unknown'] = q; });
      var tk = Object.keys(ts);
      o = !cand.length ? { t: null, src: 'P&C card, point ' + r.an + ' not in the P&C register near km ' + r.km }
        : tk.length === 1 && tk[0] !== 'unknown' ? { t: ts[tk[0]].t, sub: ts[tk[0]].sub, src: 'P&C register: point ' + r.an + ' at ' + cand[0].stn + ', ' + cand[0].ln + ' (' + cand[0].lt + ')' }
        : { t: null, src: 'P&C card, point ' + r.an + ': the register has it on ' + tk.join(' and ') + ' lines near km ' + r.km };
    } else if (kind === 'machineProg') {
      o = PE.lineTypeOfText(r.ln, N); if (o.t) o.src = 'TMS machine progress ' + o.src;
    } else if (r.lid) o = PE.lineTypeOfLid(r.lid, N);
    else o = { t: null, src: 'no line given' };
    try { r.ltp = o.t; r.ltps = o.src; r.ltsub = o.sub || ''; } catch (e) { }
    return o;
  };
  PE.LT_LABEL = { main: ['Main line', 'मुख्य लाइन'], loop: ['Loop lines', 'लूप लाइन'], all: ['All lines', 'सभी लाइन'] };
  PE.LT_TAG = { main: 'Main', loop: 'Loop', siding: 'Siding' };
  /** does a record of type t belong to a view ('main' | 'loop' | 'all')? unknown (null) only in "all" */
  PE.inView = function (t, view) { return view === 'all' || (view === 'main' ? t === 'main' : view === 'loop' ? (t === 'loop' || t === 'siding') : false); };
})(PE);


// ===== engine/locate.js
// HWH Track Portal – shared engine, part 2: the LOCATOR (brief A3). Every record -> where {lid, km, m, km2, m2, key, how, approx}.
// Rules: km/m as given; block section only -> km range from TMS's COA block-section mapping (approx); station limit -> the station's km
// from the same mapping (approx, ± 0.5 km); OHE mast -> not located until the user's mast list arrives (hook PE.mastToKm);
// asset numbers (point / crossing) -> km from TMS spot cards / P&C changes of the same section-line. Unlocated records are counted, never dropped.
var PE = (typeof PE !== 'undefined' && PE) || {};
(function (PE) {
  'use strict';
  /** hook for the OHE mast list (phase B: the user's list section+line+mast -> km/m). Returns null = not located. */
  // OHE mast <-> chainage hook (FOUNDATION D.1): the user's list comes later as rows {lid, mast, km, m}; key = section-line + mast (mast
  // numbers repeat between sections). Until PE.setMasts is given a list, every mast stays "not placed – waiting for the mast list".
  // Nothing is fetched from TMS for masts.
  var MASTS = null;
  // [C] mast number normalised: case, spaces, prefixes "AC" / "M" / "SE" / "TP" / "OHE" / "MAST NO" removed; "42 / 10 a" -> "42/10A", "4602" -> "4602"
  PE.mastKey = function (t) { var s = String(t || '').toUpperCase().replace(/\b(OHE\s*MAST|MAST\s*NO\.?|MAST|OHE|TP|AC|SE|M)\b\.?/g, ' ').replace(/\s+/g, ''); var m = s.match(/(\d{1,3})\/(\d{1,3})([A-Z]?)/) || s.match(/^[-:]*(\d{2,6})([A-Z]?)$/); if (!m) return ''; return m[3] !== undefined ? (+m[1]) + '/' + (+m[2]) + m[3] : (+m[1]) + (m[2] || ''); };
  PE.setMasts = function (rows) { if (!rows) { MASTS = null; return 0; } MASTS = {}; (rows || []).forEach(function (r) { var k = PE.mastKey(r.mast); if (!k || !r.lid) return; (MASTS[k] = MASTS[k] || []).push(r); }); return Object.keys(MASTS).length; };
  PE.mastsLoaded = function () { return !!MASTS; };
  PE.mastToKm = function (lids, mast) {
    if (!MASTS) return null; var L = MASTS[PE.mastKey(mast)] || []; if (!L.length) return null;
    var hit = lids && lids.length ? L.filter(function (r) { return lids.indexOf(r.lid) >= 0; }) : L;
    return hit.length === 1 ? { lid: hit[0].lid, km: +hit[0].km, m: +hit[0].m || 0 } : null;
  };
  // [C] a real OHE mast in a text: "TP 42/10", "OHE 42/10A", "mast no 42/10", "MAST 4602". "ERH-4602" / "E-476" are ENGINE RUNNING HOURS of a machine (user, 03-Nov) – never a mast.
  PE.MAST_RE = /\b(?:TP|OHE(?:\s*MAST)?|MAST(?:\s*NO\.?)?)\s*[-:.]?\s*(?:AC|SE|M)?\s*(\d{1,3}\s*\/\s*\d{1,3}[A-Z]?|\d{2,6}[A-Z]?)\b/i;
  PE.ERH_RE = /\b(?:ERH|E)\s*[-:.]?\s*(\d{2,6}(?:\.\d+)?)\b/i;
  // [C] mast RANGES written in TMS mast format in remarks (user, 03-Nov): "37/20A-28A" (37/20A to 37/28A), "18/29-21/00" (18/29 to 21/00),
  // "km 5/03-07" (5/3 to 5/7). A date ("03/11/2026") is not a range: no '/' or digit right before, no '/' right after.
  PE.MAST_RANGE_RE = /(?:\bkm\.?\s*)?(?<![\/\d])(\d{1,3})\s*\/\s*(\d{1,3}[A-Z]?)\s*(?:-|–|\bto\b)\s*(?:(\d{1,3})\s*\/\s*)?(\d{1,3}[A-Z]?)\b(?!\s*\/)/gi;
  PE.mastRanges = function (text) {
    var out = [], re = new RegExp(PE.MAST_RANGE_RE.source, 'gi'), m;
    while ((m = re.exec(String(text || '')))) out.push({ txt: m[0].trim(), from: (+m[1]) + '/' + m[2], to: (m[3] != null ? +m[3] : +m[1]) + '/' + m[4] });
    return out;
  };
  /** both ends of a mast range on one section-line -> {lid, km, m, km2, m2} | null */
  PE.mastRangeToKm = function (lids, rg) {
    if (!MASTS) return null; var a = MASTS[PE.mastKey(rg.from)] || [], b = MASTS[PE.mastKey(rg.to)] || [];
    if (lids && lids.length) { a = a.filter(function (r) { return lids.indexOf(r.lid) >= 0; }); b = b.filter(function (r) { return lids.indexOf(r.lid) >= 0; }); }
    var pairs = []; a.forEach(function (x) { b.forEach(function (y) { if (x.lid === y.lid) pairs.push([x, y]); }); });
    if (pairs.length !== 1) return null; var x = pairs[0][0], y = pairs[0][1];
    var px = (+x.km) * 10000 + (+x.m || 0), py = (+y.km) * 10000 + (+y.m || 0); if (px > py) { var t = x; x = y; y = t; }
    return { lid: x.lid, km: +x.km, m: +x.m || 0, km2: +y.km, m2: +y.m || 0 };
  };
  /** [C] RDPS masts vs the TMS mast list, per section-line that both cover. TMS stays the reference; RDPS only flags.
   *  rdpsAll: [[lid, km, m, lat, lon, kind, label]…] (rdps _all), masts: TMS oheMast rows {lid, mast, km, m}. Distance in metres (1 km = 1000 m). */
  PE.rdpsMastCheck = function (rdpsAll, masts, tolM) {
    tolM = tolM || 50; var R = {}, T = {}, out = { far: [], onlyRdps: [], onlyTms: [], lines: [] };
    (rdpsAll || []).forEach(function (p) { if (!p || p[5] !== 'mast' || !p[0]) return; var k = PE.mastKey(p[6]); if (!k) return; (R[p[0]] = R[p[0]] || {})[k] = { km: +p[1], m: +p[2] || 0, t: p[6] }; });
    (masts || []).forEach(function (r) { if (!r || !r.lid) return; var k = PE.mastKey(r.mast); if (!k) return; (T[r.lid] = T[r.lid] || {})[k] = { km: +r.km, m: +r.m || 0, t: r.mast }; });
    Object.keys(R).filter(function (l) { return T[l]; }).sort().forEach(function (lid) {
      var a = R[lid], b = T[lid], n = { lid: lid, both: 0, far: 0, onlyRdps: 0, onlyTms: 0 };
      Object.keys(a).forEach(function (k) {
        if (!b[k]) { n.onlyRdps++; out.onlyRdps.push({ lid: lid, mast: k, km: a[k].km, m: a[k].m }); return; }
        n.both++; var d = Math.round(Math.abs((a[k].km - b[k].km) * 1000 + (a[k].m - b[k].m)));
        if (d > tolM) { n.far++; out.far.push({ lid: lid, mast: k, rdps: [a[k].km, a[k].m], tms: [b[k].km, b[k].m], dM: d }); }
      });
      Object.keys(b).forEach(function (k) { if (!a[k]) { n.onlyTms++; out.onlyTms.push({ lid: lid, mast: k, km: b[k].km, m: b[k].m }); } });
      out.lines.push(n);
    });
    out.rdpsOnlyLines = Object.keys(R).filter(function (l) { return !T[l]; }).sort();
    return out;
  };
  PE.ASSET_RE = /\b(?:PT|POINT|PTS|T\/?O|X-?ING)\.?\s*(?:NO|NOS)?\.?\s*[-:.]?\s*(\d{1,3}\s*[A-Z]?)\b/i;

  /** ctx from the slim blockSections file {coa:[...], yards:[...]} + optional asset index {"lid|88A": [km, m]} */
  PE.locator = function (N, bs, assets) {
    var byBs = {}, byStn = {}, lids = {};
    var key2 = function (a, b) { return String(a || '').toUpperCase().replace(/[^A-Z]/g, '') + '-' + String(b || '').toUpperCase().replace(/[^A-Z]/g, ''); };
    ((bs && bs.coa) || []).forEach(function (r) {
      if (!r.lid || r.a == null) return;
      lids[r.lid] = 1;
      var ln = String(r.ln || '').toUpperCase().replace(/[^A-Z0-9]/g, '');   // COA line name: UPMAIN, DNHBC1, REVS …
      var o = { lid: r.lid, a: Math.min(r.a, r.b), b: Math.max(r.a, r.b), ln: ln };
      [key2(r.f, r.t), key2(r.t, r.f)].forEach(function (k) { (byBs[k] = byBs[k] || []).push(o); });
      if (r.f) (byStn[r.f] = byStn[r.f] || []).push({ lid: r.lid, p: r.a0, ln: ln });
      if (r.t) (byStn[r.t] = byStn[r.t] || []).push({ lid: r.lid, p: r.b0, ln: ln });
    });
    var lineOk = function (lid, keys) { if (!keys || !keys.length) return true; var disp = keys.map(function (k) { return ' ' + N.lineDisplay(k); }); return disp.some(function (d) { return lid.slice(-d.length) === d; }); };
    // [PB] 03-Nov: the field's line text is matched first to TMS's COA line name of the same block section ("DN HBC 1" = DNHBC1 -> BLY-SKG DN 1,
    // "UP HBC" = UPHBC -> BLY-SKG Up Chord), then by line key (numbered: "UP HBC1" -> UP 1); one candidate line left = that line.
    var nln = function (t) { var x = String(t || '').toUpperCase().replace(/\n[\s\S]*$/, '').replace(/[^A-Z0-9]/g, '').replace(/^DOWN/, 'DN'); return x.replace(/^(UP|DN)(ML|M|L|LINE|MAINLINE|MAIN)$/, '$1MAIN').replace(/^(UP|DN)SL$/, '$1SLOW'); };
    function pickLine(cands, keys, lineText) {
      var seen = {}; var all = cands; cands = cands.filter(function (c) { if (seen[c.lid]) return false; seen[c.lid] = 1; return true; });
      var t = nln(lineText);
      if (t.length >= 3) {
        var ex = all.filter(function (c) { return c.ln && c.ln === t; });
        if (!ex.length) ex = all.filter(function (c) { return c.ln && c.ln.length >= 4 && (t.indexOf(c.ln) === 0 || (c.ln.indexOf(t) === 0 && t.length >= 4)); });
        var s2 = {}; ex = ex.filter(function (c) { if (s2[c.lid]) return false; s2[c.lid] = 1; return true; });
        if (ex.length) return ex;
      }
      var f = cands.filter(function (c) { return lineOk(c.lid, keys); });
      if (f.length) return f;
      if (keys && keys.length) { var plain = keys.filter(function (k) { return k === 'UP' || k === 'DN'; }); var f2 = cands.filter(function (c) { return plain.some(function (k) { return new RegExp(' ' + k + ' \\d$').test(c.lid); }); }); if (f2.length === 1) return f2; }
      return cands.length === 1 ? cands : (keys && keys.length ? [] : cands);
    }
    function stationOf(text) {
      var t = String(text || '').toUpperCase().trim(); var m;
      if ((m = t.match(/^([A-Z]{2,5})\s*-?\s*(?:STN|STATION|ST\b|ST\.|SNT LIMIT|YD\b|YARD|SDG)/)) && byStn[m[1]]) return m[1];
      if ((m = t.match(/\b([A-Z]{2,5})\s+(?:STN|STATION|ST\b|ST\.)/)) && byStn[m[1]]) return m[1];
      if (/^[A-Z]{2,5}$/.test(t) && byStn[t]) return t;
      return null;
    }
    function bsOf(text) {
      var t = String(text || '').toUpperCase(); var m = t.match(/\b([A-Z]{2,5})\s*(?:STN\s*(?:LIMIT|LMT|LT)\.?\s*)?-+\s*(?!STN\b|STATION\b|LIMIT\b|YARD\b|YD\b)([A-Z]{2,5})\b/);
      if (!m) { m = t.match(/\b([A-Z]{2,5})\s+TO\s+([A-Z]{2,5})\b/); }
      return m ? [m[1], m[2]] : null;
    }
    /** rec: {lid?, km?, m?, km2?, m2?, bsText?, lineText?, texts?: [..] (location / purpose / details), sectionText?} */
    function locate(rec) {
      var W = { lid: null, km: null, m: null, km2: null, m2: null, key: null, how: 'none', approx: false, note: '' };
      var keys = rec.lineKeys || N.fieldLines(rec.lineText); var lt = rec.lineText;
      var all = [rec.locText].concat(rec.texts || [], [rec.lineText]).filter(Boolean).join(' | ');
      var kt = PE.kmText(rec.locText) || (/\bKM/i.test(rec.lineText || '') ? PE.kmText(String(rec.lineText).replace(/^[\s\S]*?\bKM\s*[:\-]*/i, '')) : null) || ((/\bkm/i).test(all) ? PE.kmText(all.replace(/^.*?\bkm\s*[:\-]*/i, '')) : null);
      var cands = [], range = null, how = 'none';
      if (rec.lid) { cands = [{ lid: rec.lid }]; }
      var bsp = bsOf(rec.bsText);
      if (!cands.length && bsp) {
        var c = byBs[bsp[0] + '-' + bsp[1]] || [];
        if (c.length) { cands = pickLine(c, keys, lt); how = 'blockSection'; if (!cands.length) W.note = 'block section ' + bsp.join('-') + ' known, but line "' + String(lt || '').split('\n')[0].trim() + '" is not one TMS maps there'; }
        else if (byStn[bsp[0]] && byStn[bsp[1]]) {   // not adjacent stations: the stretch between them on a common line
          var A = byStn[bsp[0]], B = byStn[bsp[1]]; var both = [];
          A.forEach(function (x) { B.forEach(function (y) { if (x.lid === y.lid) both.push({ lid: x.lid, a: Math.min(x.p, y.p), b: Math.max(x.p, y.p) }); }); });
          if (both.length) { cands = pickLine(both, keys, lt); how = 'blockSection'; W.note = 'stations not adjacent'; }
        }
      }
      if (!cands.length) {
        var st = stationOf(rec.bsText) || (bsp ? null : stationOf(rec.lineText));
        if (st && !cands.length) W.note = 'station ' + st + ' known, but line "' + String(lt || '').split('\n')[0].trim() + '" is not a line TMS maps there (yard / loop?)';
        if (st) { var s = pickLine(byStn[st].map(function (x) { return { lid: x.lid, a: x.p, b: x.p, p: x.p, ln: x.ln }; }), keys, lt); if (s.length) { cands = s; how = 'station'; W.note = 'station ' + st; } }
      }
      // asset number (point / crossing) on a candidate line
      var am = all.match(PE.ASSET_RE);
      if (am && assets) {
        var an = am[1].replace(/\s+/g, '').toUpperCase();
        var pool = cands.length ? cands : [];
        for (var i = 0; i < pool.length; i++) { var hit = assets[pool[i].lid + '|' + an]; if (hit) { W.lid = pool[i].lid; W.km = hit[0]; W.m = hit[1]; W.km2 = hit[0]; W.m2 = hit[1]; W.how = 'asset'; W.note = 'point ' + an; W.key = PE.cellKey(W.lid, W.km, W.m); return W; } }
      }
      if (rec.km != null && rec.lid) {   // TMS record: km/m as given
        W.lid = rec.lid; W.km = +rec.km; W.m = +rec.m || 0; W.km2 = rec.km2 != null ? +rec.km2 : W.km; W.m2 = rec.m2 != null ? +rec.m2 : W.m; W.how = 'km'; W.key = PE.cellKey(W.lid, W.km, W.m); return W;
      }
      // OHE mast numbers in the texts: kept on the record; placed exactly once the user's mast list is loaded (hook PE.mastToKm)
      var rgs = PE.mastRanges(all);
      if (rgs.length) { W.mastRanges = rgs.map(function (r) { return r.txt; }); var lidsC = cands.map(function (x) { return x.lid; });
        for (var ri = 0; ri < rgs.length; ri++) { var rk = PE.mastRangeToKm(lidsC, rgs[ri]); if (rk) { W.lid = rk.lid; W.km = rk.km; W.m = rk.m; W.km2 = rk.km2; W.m2 = rk.m2; W.how = 'mast'; W.note = 'OHE masts ' + rgs[ri].from + ' to ' + rgs[ri].to; W.key = PE.cellKey(W.lid, W.km, W.m); return W; } } }
      var masts = []; var mre = new RegExp(PE.MAST_RE.source, 'gi'), mm; while ((mm = mre.exec(all))) masts.push(mm[0].replace(/\s+/g, ''));
      if (masts.length) { W.masts = masts; for (var mi = 0; mi < masts.length; mi++) { var mk0 = PE.mastToKm(cands.map(function (x) { return x.lid; }), masts[mi]); if (mk0) { W.lid = mk0.lid; W.km = mk0.km; W.m = mk0.m; W.km2 = mk0.km; W.m2 = mk0.m; W.how = 'mast'; W.key = PE.cellKey(W.lid, W.km, W.m); return W; } } }
      if (cands.length && kt) {   // field km on the block section's line
        W.lid = cands[0].lid; W.km = kt.km; W.m = kt.m; W.km2 = kt.km2; W.m2 = kt.m2; W.how = 'km'; W.key = PE.cellKey(W.lid, W.km, W.m);
        if (cands.length > 1) W.also = cands.slice(1).map(function (x) { return x.lid; });
        return W;
      }
      if (cands.length && cands[0].a != null) {
        var c0 = cands[0]; var mid = c0.p != null ? c0.p : Math.round((c0.a + c0.b) / 2);
        W.lid = c0.lid; W.km = PE.kmOf(c0.a); W.m = c0.a - W.km * 10000; W.km2 = PE.kmOf(c0.b); W.m2 = c0.b - W.km2 * 10000;
        W.key = PE.cellKey(W.lid, PE.kmOf(mid), mid - PE.kmOf(mid) * 10000); W.how = how; W.approx = true;
        if (cands.length > 1) W.also = cands.slice(1).map(function (x) { return x.lid; });
        return W;
      }
      if (rgs.length) { W.how = 'mast'; W.note = 'OHE masts ' + rgs[0].from + ' to ' + rgs[0].to + (PE.mastsLoaded() ? ' – not both in the TMS mast list for this line' : ' – TMS mast list not loaded yet'); return W; }
      var mast = all.match(PE.MAST_RE);
      if (mast) { W.how = 'mast'; W.note = 'OHE mast ' + mast[0].replace(/\s+/g, ' ') + (PE.mastsLoaded() ? ' – not in the TMS mast list for this line' : ' – TMS mast list not loaded yet'); return W; }
      if (W.note) return W;
      W.note = bsp ? 'block section ' + bsp.join('-') + ' not in the TMS mapping' : (rec.bsText ? 'place "' + String(rec.bsText).trim() + '" not recognised' : 'no place given');
      if (cands.length === 0 && (rec.bsText || rec.lineText) && keys.length === 0 && bsp) W.note += ' (line not given)';
      return W;
    }
    return { locate: locate, stations: Object.keys(byStn).sort(), stationOf: stationOf, byStn: byStn, byBs: byBs, lids: Object.keys(lids).sort() };
  };
})(PE);


// ===== engine/press.js
// HWH Track Portal – shared engine, part 3: READER of the TMS Collector's track-health press files (brief A2a).
// Input: the files of one press of one kind as written by collector/health/press.js (schema 1: {kind, pressId, at, window, counts,
// records:{…}, filePart, fileParts}); output: slim records grouped by section-line (lid) + division-wide lists, located (km as given).
// Record shapes read from the first live press of 02-Nov-2026 (TMS data\<kind>\<kind>_<date>_<time>[_partNofM].json).
var PE = (typeof PE !== 'undefined' && PE) || {};
(function (PE) {
  'use strict';
  PE.KINDS = ['blockSections', 'workSite', 'spotCards', 'assetChange', 'machineProg', 'trcRuns', 'tqiSix', 'condition', 'itms', 'ballastCushion', 'tampingDue', 'oheMast', 'rdps'];
  PE.KIND_LABEL = { blockSections: 'Block sections', workSite: 'Work sites', spotCards: 'Spot attention cards', assetChange: 'Asset changes', machineProg: 'Machine progress', trcRuns: 'TRC run list', tqiSix: 'TQI six runs', condition: 'Condition layers', itms: 'ITMS runs', ballastCushion: 'Ballast cushion (asset register)', tampingDue: 'Tamping due (PML / CBML, turnouts)', oheMast: 'OHE mast list (TMS)', rdps: 'RDPS route survey', health: 'Track health (chart + GMT)' };

  /** several part files of one press -> one object with the record arrays joined */
  PE.combineParts = function (files) {
    files = (files || []).slice().sort(function (a, b) { return (a.filePart || 1) - (b.filePart || 1); });
    var out = null;
    files.forEach(function (f) {
      if (!out) { out = JSON.parse(JSON.stringify(Object.assign({}, f, { records: {} }))); }
      var R = f.records || {};
      Object.keys(R).forEach(function (k) { var v = R[k]; if (Array.isArray(v)) out.records[k] = (out.records[k] || []).concat(v); else if (v && typeof v === 'object') out.records[k] = Object.assign(out.records[k] || {}, v); else out.records[k] = v; });
    });
    return out || { records: {} };
  };

  var put = null;
  var s = function (v) { return v == null ? '' : String(v).trim(); };
  var dash = function (v) { v = s(v); return v === '-' || v === '--' ? '' : v; };

  /** slim(kind, combined, ctx) -> {byLid:{lid:[…]}, all:[…] (division-wide small list), count, unlocated:[…sample], extra} ; ctx = {N, L (locator), recentFrom} */
  PE.slimPress = function (kind, F, ctx) {
    var N = ctx.N, R = (F && F.records) || {}, by = {}, all = [], unl = [], count = 0, extra = {};
    put = function (b, lid, r) { var g = N.groupOf(lid); (b[g] = b[g] || []).push(r); };
    var lidOf = function (sec, line) { return N.lineId(sec, line); };
    var miss = function (r, why) { if (unl.length < 200) unl.push(Object.assign({ why: why }, r)); };
    if (kind === 'blockSections') {
      var coa = (R.coa || []).map(function (r) {
        var lid = r.tmsSection && r.tmsLine ? lidOf(r.tmsSection, r.tmsLine) : null;
        var a0 = r.fromKm != null ? PE.P(r.fromKm, r.fromM) : null, b0 = r.toKm != null ? PE.P(r.toKm, r.toM) : null;
        return { bs: s(r.blockSection), f: s(r.stationFrom).toUpperCase(), t: s(r.stationTo).toUpperCase(), lid: lid, a: a0 == null ? null : Math.min(a0, b0), b: b0 == null ? null : Math.max(a0, b0), a0: a0, b0: b0, st: r.status, dir: r.direction, ln: r.lineName };
      });
      count = coa.length;
      all = [{ coa: coa, unmapped: R.unmappedLines || [], yards: (R.yards || []).map(function (y) { return { st: y.station, k: y.kind, ln: y.line, r: y.routeName, a: PE.P(y.fromKm, y.fromM), b: PE.P(y.toKm, y.toM) }; }), traffic: R.trafficSections || [] }];
      extra = { coa: coa.length, located: coa.filter(function (c) { return c.lid && c.a != null; }).length, notInTms: coa.filter(function (c) { return !c.lid; }).length };
    }
    else if (kind === 'workSite') {
      var det = {}; (R.details || []).forEach(function (d) { if (d && d.id) det[d.id] = d; });
      (R.sites || []).forEach(function (w) {
        var lid = lidOf(w.section, w.line); var d = det[w.id] || {}; var n = d.n || {};
        var r = { id: 'ws' + w.id, tid: w.id, d: w.date, lid: lid, sec: w.section, ln: w.line, bs: w.blockSection, km: w.fromKm, m: w.fromM, km2: w.toKm, m2: w.toM,
          u: N.unitKey(w.sse), sse: w.sse, aen: w.aden, sub: w.subWork, wt: n.workType || '', blk: w.blockAdequate, lab: w.labourAdequate, ex: w.execution, cc: w.competencyCert, prot: w.protectionIrpwm, saf: w.safetyFollowed,
          by: PE.stripName(d.entryBy || ''), pre: n.preEntry || '', post: n.postEntry || '', cau: n.caution || '', loc: n.location || '',
          bReq: n.blockRequiredMin, bDem: n.blockDemandedMin, bGr: n.blockGrantedMin, bAv: n.blockAvailedMin, bFrom: n.blockAvailedFrom || '', bTo: n.blockAvailedTo || '',
          men: n.labour, prog: PE.noPhone(n.progress || ''), att: (d.attachments || []).filter(function (a) { return a.ref; }).map(function (a) { return { k: a.kind, s: a.section, ref: a.ref, nm: a.name || '' }; }) };
        count++; all.push(r); if (!lid) miss(r, 'section/line not known'); put(by, lid, r);
      });
    }
    else if (kind === 'spotCards') {
      var cd = {}; (R.details || []).forEach(function (d) { if (d && d.id) cd[d.id] = d; });
      (R.cards || []).forEach(function (c) {
        var lid = lidOf(c.section, c.line); var d = cd[c.id];
        var r = { id: 'sc' + c.id, d: c.inspDate, lid: lid, km: c.km, m: c.m, u: N.unitKey(c.sse), src: c.source, it: c.inspType, an: s(c.assetNo).toUpperCase(), ob: PE.noPhone(c.observation), p: c.priority, st: c.status, d16: c.date16 || '', by: PE.stripName(c.inspectedBy) };
        if (d) { r.cmp = d.complianceDate || ''; r.act = PE.noPhone(dash(d.actionTaken)); r.done = PE.stripName(d.doneBy); r.gang = d.gang || ''; r.tqi = d.latestTqi; r.ph = (d.photos || []).length; r.asg = d.assignDate || ''; r.need = [d.needMachine === 'Yes' ? 'machine' : '', d.needMaterial === 'Yes' ? 'material' : '', d.needManpower === 'Yes' ? 'manpower' : ''].filter(Boolean).join(','); r.prev = (d.previous || []).length; }
        count++; if (!lid) miss(r, 'section/line not known'); put(by, lid, r);
        if (ctx.recentFrom && String(c.inspDate) >= ctx.recentFrom && lid) all.push({ id: r.id, lid: lid, km: r.km, m: r.m, d: r.d, d16: r.d16, st: r.st, src: r.src, cmp: r.cmp || '', act: r.act || '' });
      });
      extra.details = (R.details || []).length;
      var ai = {}; Object.keys(by).forEach(function (g) { by[g].forEach(function (r) { if (r.an && r.lid) ai[r.lid + '|' + r.an] = [r.km, r.m]; }); }); extra.assetIndex = ai;
    }
    else if (kind === 'assetChange') {
      var parts = { rail: 'rail', sleeper: 'sleeper', ballast: 'ballast', weldJoint: 'weld', pnx: 'pnx', fastening: 'fastening' };
      var ai2 = {};
      Object.keys(parts).forEach(function (k) {
        (R[k] || []).forEach(function (a) {
          var r, lid;
          if (k === 'pnx') { lid = null; r = { id: 'acp' + (a.key || ''), k: 'pnx', d: a.date, lid: null, km: a.km, m: a.m, stn: a.station, to: s(a.turnout).toUpperCase(), lt: a.lineType, ln: a.line, t: a.reason }; }
          else {
            lid = lidOf(a.section, a.line);
            var km = a.fromKm != null ? a.fromKm : a.km, m = a.fromKm != null ? a.fromM : a.m;
            r = { id: 'ac' + (a.id || a.key || ''), k: parts[k], d: a.date, lid: lid, km: km, m: m, km2: a.toKm != null ? a.toKm : km, m2: a.toKm != null ? a.toM : m, sd: a.side || '', u: N.unitKey(a.authority) };
            if (k === 'rail') r.t = [a.railSection, a.grade, a.lengthM ? a.lengthM + ' m' : '', a.reason].filter(Boolean).join(' · ');
            if (k === 'sleeper') r.t = [a.sleeperType, a.lengthM ? a.lengthM + ' m' : '', a.reason].filter(Boolean).join(' · ');
            if (k === 'ballast') { r.t = [a.part === 'deepScreening' ? 'deep screening' : a.part, a.lengthM ? a.lengthM + ' m' : '', a.cleanCushion ? 'clean cushion ' + a.cleanCushion : '', a.means].filter(Boolean).join(' · '); r.sub = a.part; }
            if (k === 'weldJoint') r.t = (a.oldType ? a.oldType + ' → ' : '') + (a.newType || '');
            if (k === 'fastening') r.t = [a.component, a.lengthM ? a.lengthM + ' m' : '', a.reason].filter(Boolean).join(' · ');
          }
          count++; put(by, lid, r); if (!lid && k !== 'pnx') miss(r, 'section/line not known');
          if (ctx.recentFrom && String(r.d) >= ctx.recentFrom && k !== 'weldJoint') all.push(r);
          else if (ctx.recentFrom && String(r.d) >= ctx.recentFrom && k === 'weldJoint' && lid) all.push({ id: r.id, k: r.k, d: r.d, lid: lid, km: r.km, m: r.m, km2: r.km2, m2: r.m2, t: r.t });
        });
      });
      extra.byPart = {}; Object.keys(parts).forEach(function (k) { extra.byPart[k] = (R[k] || []).length; });
      extra.pnxStations = by._none ? by._none.filter(function (r) { return r.k === 'pnx'; }).length : 0;
    }
    else if (kind === 'machineProg') {
      (R.days || []).forEach(function (day) {
        (day.rows || []).forEach(function (row) {
          var n = row._n || {}; if (row._cont || !n.section) return;
          var g = function (k) { return s(row[k]); };
          var rmk = s(n.remark || row.Remark);
          // [C] "ERH-4602" / "E-476" = the machine's ENGINE RUNNING HOURS (kept per machine per day; hours worked = difference between days); a real mast only as "TP 42/10" etc.
          var erhM = rmk.match(PE.ERH_RE); var masts = []; var re = new RegExp(PE.MAST_RE.source, 'gi'), mm; while ((mm = re.exec(rmk))) masts.push(mm[0].replace(/\s+/g, ''));
          var r = { id: 'mp' + day.asOn + '|' + (row['Sr#'] || '') + '|' + n.machine, d: day.asOn, mc: n.machine, sec: n.section, ln: n.line, bs: n.between,
            dem: g('Block > Block Demanded hh:mm'), giv: g('Block > Block Given hh:mm'), eff: g('Block > Reported Effective Time hh:mm'),
            trk: g('Work Done in Block Given > Track > Kms.No(UTV)'), tos: g('Work Done in Block Given > Track > T/Outs'), pct: g('Percentage(%) Work Done to Stipulated Output'),
            who: PE.desig(rmk), masts: masts, mastRanges: PE.mastRanges(rmk).map(function (x) { return x.txt; }), erh: erhM ? +erhM[1] : null };
          if (!r.dem && !r.giv && !r.trk && !r.tos) return;   // a day with no block and no output: not a work event
          var w = ctx.L ? ctx.L.locate({ bsText: r.bs || r.sec, lineText: r.ln, lineKeys: [N.lineKey(r.ln)].filter(Boolean), texts: [rmk] }) : { how: 'none' };
          var sl = N.lineId(r.sec, r.ln);
          if (!w.lid && sl) { w = { lid: sl, how: 'section', approx: true, key: null, note: 'section only' }; }
          r.lid = w.lid; r.km = w.km; r.m = w.m; r.km2 = w.km2; r.m2 = w.m2; r.how = w.how; r.approx = w.approx; r.key = w.key;
          count++; put(by, r.lid, r); if (!r.lid) miss(r, w.note || 'not located');
          if (ctx.recentFrom && String(r.d) >= ctx.recentFrom) all.push(r);
        });
      });
    }
    else if (kind === 'trcRuns') {
      (R.runs || []).forEach(function (t) {
        var lid = lidOf(t.section, t.line);
        var r = { id: 'tr' + t.runId + '|' + (t.secCode || t.section) + '|' + (t.lineCode || t.line) + '|' + t.fromKm + '/' + t.fromM, run: t.runId, d: t.date, lid: lid, km: t.fromKm, m: t.fromM, km2: t.toKm, m2: t.toM, sp: t.speed, car: t.car, let: t.letter };
        count++; all.push(r); put(by, lid, r); if (!lid) miss(r, 'section/line not known');
      });
    }
    else if (kind === 'tqiSix') {
      (R.lines || []).forEach(function (L) {
        var lid = lidOf(L.section, L.line);
        var r = { id: 'tq' + (L.secCode || '') + L.lineCode + (L.newestRun || ''), lid: lid, d: L.newestRun, runs: (L.runs || []).map(function (x) { return { d: x.date, l: x.letter, c: x.car }; }), rows: (L.rows || []).map(function (x) { return [x.kmFrom, x.kmTo, (x.vals || []).map(function (v) { return v ? (v.tqic != null ? v.tqic : v.tqis) : null; })]; }) };
        count++; put(by, lid, r); if (!lid) miss({ section: L.section, line: L.line }, 'section/line not known');
      });
    }
    else if (kind === 'condition') {
      (R.missingLinear || []).forEach(function (c) { var lid = lidOf(c.section, c.line); var r = { id: 'ml' + count, k: 'missing', f: c.feature, lid: lid, km: c.fromKm, m: c.fromM, km2: c.toKm, m2: c.toM }; count++; put(by, lid, r); if (!lid) miss(r, 'section/line not known'); });
      (R.corrosionProne || []).forEach(function (c) { var lid = lidOf(c.section, c.line); var r = { id: 'cp' + (c.id || count), k: 'corrosion', f: c.remark || c.kind, lid: lid, km: c.fromKm, m: c.fromM, km2: c.toKm, m2: c.toM }; count++; put(by, lid, r); if (!lid) miss(r, 'section/line not known'); });
    }
    else if (kind === 'ballastCushion') {
      // [PB] B1a: TMS asset register – clean / total cushion per stretch, deep screening month. Running-line stretches by section-line;
      // station yard stretches (no section, yard line names, yard-local km) kept apart in group _yard with the station.
      (R.stretches || []).forEach(function (x, i) {
        var lid = x.section ? lidOf(x.section, x.line) : null;
        var r = { id: 'bc' + (x.secCode || '') + '|' + (x.section || x.station) + '|' + x.line + '|' + x.xover + '|' + x.kmFrom + '/' + x.mFrom, lid: lid, km: x.kmFrom, m: x.mFrom, km2: x.kmTo, m2: x.mTo, len: x.lengthKm,
          cc: x.cleanCushion == null ? null : +x.cleanCushion, tc: x.totalCushion == null ? null : +x.totalCushion, scr: x.screened || '', how: x.method || '', bt: x.ballastType || '' };
        if (x.xover) r.xo = x.xover;
        count++;
        if (!x.section) { r.stn = s(x.station).toUpperCase(); r.yl = x.line || ''; (by._yard = by._yard || []).push(r); return; }
        put(by, lid, r); if (!lid) miss(r, 'section/line not known');
      });
      extra = F.counts || {};
    }
    else if (kind === 'tampingDue') {
      // [PB] B2: TMS tamping due – stretches due (block section or through a station yard, on the section-line km) and turnouts (P-Xing) due,
      // per section-line. All on TMS section-lines = main line (the yard rows are the main line through the station).
      var col = function (row, re) { for (var k in row) if (re.test(k)) return row[k]; return ''; };
      var num = function (v) { return v === '' || v == null ? null : +v; };
      (R.dueStretches || []).forEach(function (g) {
        var lid = lidOf(g.section, g.line);
        (g.rows || []).forEach(function (x, i) {
          var r = { id: 'tds' + g.secCode + g.lineCode + '|' + i, k: 'stretch', lid: lid, km: num(col(x, /From > km/)), m: num(col(x, /From > m/)), km2: num(col(x, /To > km/)), m2: num(col(x, /To > m/)), len: num(col(x, /Length/)),
            yard: /yard/i.test(col(x, /Block Section \/Yard/)), stn: String(col(x, /Section\/Station/) || '').replace(/\s*\(.*$/, ''), trc: PE.isoDate(col(x, /Run Date/)) || '', last: PE.isoDate(col(x, /Tamping Date/)) || '', mc: col(x, /Machine Type/) || '' };
          count++; put(by, lid, r); if (!lid) miss(r, 'section/line not known');
        });
      });
      (R.dueTurnouts || []).forEach(function (g) {
        var lid = lidOf(g.section, g.line);
        (g.rows || []).forEach(function (x, i) {
          var r = { id: 'tdt' + g.secCode + g.lineCode + '|' + col(x, /P-Xing/) + '|' + i, k: 'turnout', lid: lid, km: num(col(x, /Location > km/)), m: num(col(x, /Location > m/)), pt: String(col(x, /P-Xing/) || ''), last: PE.isoDate(col(x, /Last Tamping/)) || '', trc: PE.isoDate(col(x, /Run Date/)) || '', st: col(x, /Tamping Status/) || '' };
          count++; put(by, lid, r); if (!lid) miss(r, 'section/line not known');
        });
      });
      all = (R.summary || []).map(function (x) { return { lid: lidOf(x.section, x.line), tkm: x.tkm, pml: x.pmlDue, cbml: x.cbmlPlain, pxing: x.cbmlPxing, pred: x.prediction }; });
      extra = F.counts || {};
    }
    else if (kind === 'oheMast') {
      // [C] TMS OHE mast / hecto post report: section or station, line / loop / crossover, mast no., chainage km + m. Main-line masts by section-line;
      // loop / crossover masts by station + line name. Non-mast rows (TP, ELF, Mile end, x END) are skipped.
      var mrows = R.masts || R.rows || F.rows || [];
      mrows.forEach(function (x, i) {
        var sec = x.section || x.sectionStation || x['Section/Station'] || '', ln = x.line || x['Line/Loopline/Xover'] || '', no = String(x.mast || x.mastNo || x['OHE Mast No.'] || '').trim();
        var km = x.km != null ? +x.km : +x['Chainage km'], m = x.m != null ? +x.m : +x['m'];
        if (!no || /^(TP|ELF|MILE|.*END)$/i.test(no) || isNaN(km)) return;
        var pos = String(x.pos || x.position || x.kind || 'main').toLowerCase();
        var lid = /loop|cross|xover/.test(pos) ? null : lidOf(sec, ln);
        var r = { id: 'om' + i, lid: lid, stn: lid ? '' : s(sec).toUpperCase(), ln: ln, mast: no, key: PE.mastKey ? PE.mastKey(no) : no, km: km, m: m || 0, pos: pos };
        count++; all.push(r); if (!lid && !r.stn) miss(r, 'section/line not known');
      });
      extra = { rows: count, main: all.filter(function (r) { return r.lid; }).length };
    }
    else if (kind === 'rdps') {
      // [C] RDPS survey points (prepared file, HWH lines): each point -> the TMS section-line of its route that covers its km (settings.rdps.routes,
      // line extents from the TMS chart). RDPS supports – it never overrides TMS. Points: [km, m, lat, lon, kind, label].
      var RT = (ctx.S && ctx.S.rdps && ctx.S.rdps.routes) || {}; var EX = ctx.extents || {}; var cov = {};
      (R.files || []).forEach(function (fl) {
        var rt = RT[fl.file]; if (!rt) { extra.unmapped = (extra.unmapped || []).concat([fl.file]); return; }
        var lids = []; rt.sections.forEach(function (sc) { rt.lines.forEach(function (ln) { var l = lidOf(sc, ln); if (l && lids.indexOf(l) < 0) lids.push(l); }); });
        (fl.points || []).forEach(function (pt) {
          var P = PE.P(pt[0], pt[1]); var lid = null;
          for (var i = 0; i < lids.length && !lid; i++) { var e = EX[lids[i]]; if (e && P >= e[0] - 500 && P <= e[1] + 500) lid = lids[i]; }
          var r = { f: fl.file, lid: lid, km: pt[0], m: pt[1], la: pt[2], lo: pt[3], k: pt[4], t: pt[5] };
          count++; if (lid) { put(by, lid, r); var c = cov[lid] = cov[lid] || { n: 0, masts: 0, a: P, b: P, files: {} }; c.n++; if (pt[4] === 'mast') c.masts++; c.a = Math.min(c.a, P); c.b = Math.max(c.b, P); c.files[fl.file] = 1; }
          else if (pt[4] !== 'kmpost') miss(r, 'km not on any TMS line of this route');
          if (pt[4] !== 'kmpost' && pt[4] !== 'other') all.push(pt[4] === 'mast' ? [lid || '', pt[0], pt[1], pt[2], pt[3], pt[4], pt[5]] : [lid || '', pt[0], pt[1], pt[2], pt[3], pt[4]]);   // mast label kept for the cross-check with the TMS mast list
        });
      });
      extra.coverage = Object.keys(cov).map(function (l) { var c = cov[l]; return { lid: l, points: c.n, masts: c.masts, a: c.a, b: c.b, files: Object.keys(c.files) }; });
    }
    else if (kind === 'itms') {
      // ITMS press file: records.runs [{section, line, runId, run, date, kmFrom, kmTo, folder, files:[{name, rep, size}]}]; the PDFs stay on the PC
      (R.runs || F.runs || []).forEach(function (x) {
        var p = x.section ? { lid: lidOf(x.section, x.line), date: x.date, letter: String(x.run || '').split('/')[1] || '', run: x.runId } : PE.itmsFolder(String(x.folder || '').replace(/^itms\//, ''), N);
        if (!p) { miss({ folder: x.folder }, 'folder name not understood'); return; }
        var r = { id: 'it' + p.run, d: p.date, lid: p.lid, let: p.letter, run: p.run, km: x.kmFrom, m: 0, km2: x.kmTo, m2: 0, folder: x.folder, files: (x.files || []).map(function (f) { return typeof f === 'string' ? f : f.name; }) };
        count++; all.push(r); put(by, p.lid, r); if (!p.lid) miss(r, 'section/line not known');
      });
    }
    var located = 0; Object.keys(by).forEach(function (k) { if (k !== '_none') located += by[k].length; });
    return { kind: kind, pressId: F.pressId || '', at: F.at || '', window: F.window || null, byGroup: by, all: all, count: count, located: located, unlocated: (by._none || []).length, unlocatedSample: unl, extra: extra, tmsCounts: F.counts || null };
  };

  /** "Bally-Saktigarh_IIIrd_Line_2026-08-03_e_38784228" -> {lid, date, letter, run} */
  PE.itmsFolder = function (name, N) {
    var p = String(name || '').split('_'); if (p.length < 5) return null;
    var run = p.pop(), letter = p.pop(), date = p.pop(); if (!/^\d{4}-\d\d-\d\d$/.test(date)) return null;
    for (var i = 1; i < p.length; i++) {
      var sec = p.slice(0, i).join(' '), ln = p.slice(i).join(' ');
      var sn = N.sectionName(sec); if (sn && N.sectionCode(sn) !== sn) return { lid: N.lineId(sn, ln), date: date, letter: letter, run: run, section: sn, line: ln };
    }
    return { lid: null, date: date, letter: letter, run: run, section: p.join(' '), line: '' };
  };
})(PE);


// ===== engine/fmc.js
// HWH Track Portal – shared engine, part 4: FIELD MINI CONTROL day-block parser (brief A2c). READ ONLY – nothing here writes to the sheet.
// One parser for the day-block layout (family F2): fixed columns on the left (Sr DEN, AEN, PWI unit[, assurance certificate]), then one block
// of `per` columns per day, NEWEST ON THE LEFT; row 1 = block title, row 2 = "Date:- …", row 3 = column headings, rows 4… = units (filled down).
// Each block's headings are compared with the expected list from settings (header fingerprint): a block that does not match is NOT read and
// gives a "layout changed" warning – never a silent wrong read. Names of staff are dropped (only designations kept); phone numbers removed.
var PE = (typeof PE !== 'undefined' && PE) || {};
(function (PE) {
  'use strict';
  var nh = function (s) { return String(s || '').toLowerCase().replace(/\(.*$/, '').replace(/[^a-z0-9]/g, ''); };
  PE.colName = function (c) { var s = ''; c = +c; while (c > 0) { var r = (c - 1) % 26; s = String.fromCharCode(65 + r) + s; c = Math.floor((c - 1) / 26); } return s; };
  /** "Date:- 02-03/11/2026 Night & 03/11/2026 Day" -> {date: '2026-11-03', from: '2026-11-02'};  "Date:- 03/11/2026" -> {date, from: date} */
  PE.fmcDate = function (t) {
    t = String(t || ''); var all = []; var re = /(\d{1,2})\/(\d{1,2})\/(\d{4})/g, m;
    while ((m = re.exec(t))) all.push(m[3] + '-' + PE.p2(m[2]) + '-' + PE.p2(m[1]));
    if (!all.length) return null;
    var date = all[all.length - 1], from = all[0];
    var n = t.match(/(\d{1,2})\s*-\s*\d{1,2}\/(\d{1,2})\/(\d{4})/);   // "02-03/11/2026" = night from the 2nd
    if (n) from = n[3] + '-' + PE.p2(n[2]) + '-' + PE.p2(n[1]);
    var n2 = t.match(/(\d{1,2})\/(\d{1,2})\s*-\s*\d{1,2}\/(\d{1,2})\/(\d{4})/);   // "31/10-01/11/2026"
    if (n2) from = n2[4] + '-' + PE.p2(n2[2]) + '-' + PE.p2(n2[1]);
    return { date: date, from: from < date ? from : date };
  };
  PE.FMC_COLS = {
    B: ['bs', 'line', 'purpose', 'who', 'timing', 'preTime', 'preImg', 'certSafety', 'certAgency', 'certWork', 'video', 'postTime', 'postImg', 'pdf', 'aenCheck', 'greasing', 'greasingImg', 'remarks'],
    W: ['bs', 'line', 'loc', 'speed', 'reason', 'who', 'details', 'preTime', 'preImg', 'certSafety', 'certAgency', 'certWork', 'postTime', 'postImg', 'pdf', 'aenCheck', 'greasing', 'greasingImg', 'remarks']
  };
  var REFCOLS = ['preImg', 'certSafety', 'certAgency', 'certWork', 'video', 'postImg', 'pdf', 'greasingImg'];
  var TEXTCOLS = ['bs', 'line', 'purpose', 'loc', 'speed', 'reason', 'details', 'timing', 'preTime', 'postTime', 'aenCheck', 'greasing', 'remarks'];

  /** the blocks in the first three rows: [{b, col (0-based), date, from, ok, found}] */
  PE.fmcBlocks = function (T, head) {
    var out = [], exp = T.header.map(nh);
    for (var b = 0; T.fixed + b * T.per < (head[0] || []).length || T.fixed + b * T.per < (head[1] || []).length; b++) {
      var c0 = T.fixed + b * T.per, dt = null;
      for (var j = 0; j < T.per && !dt; j++) dt = PE.fmcDate((head[1] || [])[c0 + j]) || PE.fmcDate((head[0] || [])[c0 + j]);
      var found = [], ok = true, bad = [];
      for (var k = 0; k < T.per; k++) { var h = (head[2] || [])[c0 + k]; found.push(String(h || '').trim()); var f = nh(h); if (!(f && (f.indexOf(exp[k]) === 0 || exp[k].indexOf(f) === 0))) { ok = false; bad.push(k); } }
      out.push({ b: b, col: c0, date: dt ? dt.date : null, from: dt ? dt.from : null, ok: ok && !!dt, bad: bad, found: found });
    }
    return out;
  };

  /** parse(T, grid) – T: tab settings {tab, kind B|W, fixed, per, header}; grid: {values (display), links (url | null), images (true/{url} | null), row0, col0 (1-based sheet position of values[0][0])}
   *  opts: {N, from (ISO, read blocks with date >= from), to, maxBlocks}  ->  {records, blocks, warnings} */
  PE.fmcParse = function (T, G, opts) {
    var N = opts.N, V = G.values || [], LK = G.links || [], IM = G.images || [], row0 = G.row0 || 1, col0 = G.col0 || 1;
    var cols = PE.FMC_COLS[T.kind]; var blocks = PE.fmcBlocks(T, V.slice(0, 3)); var warnings = [], records = [], used = [], dayOf = {};
    var lim = opts.maxBlocks || 999;
    for (var bi = 0; bi < blocks.length && used.length < lim; bi++) {
      var B = blocks[bi];
      if (!B.date) continue;
      if (opts.from && B.date < opts.from) break;   // newest on the left: everything further right is older
      if (opts.to && B.date > opts.to) continue;
      if (!B.ok) { warnings.push({ tab: T.tab, date: B.date, col: PE.colName(col0 + B.col), msg: 'layout changed – block not read', expected: B.bad.map(function (k) { return T.header[k]; }), found: B.bad.map(function (k) { return B.found[k]; }) }); continue; }
      used.push(B);
      var srden = '', aen = '', unit = '';
      var WORK = (opts.workCells && opts.workCells[T.kind]) || (T.kind === 'B' ? ['purpose', 'bs', 'timing'] : ['details', 'reason', 'bs', 'loc']);
      for (var r = 3; r < V.length; r++) {
        var row = V[r] || [];
        if (String(row[0] || '').trim()) srden = String(row[0]).trim();
        if (String(row[1] || '').trim()) aen = String(row[1]).trim();
        if (String(row[2] || '').trim()) unit = String(row[2]).trim();
        if (/^total$/i.test(String(row[2] || '').trim())) break;
        var o = {}; cols.forEach(function (k, i) { o[k] = String(row[B.col + i] == null ? '' : row[B.col + i]).trim(); });
        // [PB] B2: a row is WORK only when a work-describing cell (work, place / block section / km, block time) is not a placeholder.
        // All cells blank = "not filled"; only placeholders ("----", NIL …) = "nil report" (the unit reported no work that day).
        var uk = N.unitKey(unit); if (!uk) continue;
        var dk = T.kind + '|' + B.date + '|' + uk; var day = dayOf[dk] = dayOf[dk] || { tab: T.tab, kind: T.kind, date: B.date, u: uk, unitRaw: unit, aen: aen, srden: srden, status: 'not filled' };
        var allBlank = cols.every(function (k) { return PE.blank(o[k]); }) && !(LK[r] || []).slice(B.col, B.col + cols.length).some(Boolean) && !(IM[r] || []).slice(B.col, B.col + cols.length).some(Boolean);
        var isWork = WORK.some(function (k) { return !PE.empty(o[k]); });
        if (isWork) day.status = 'work reported'; else if (!allBlank && day.status === 'not filled') day.status = 'nil report';
        if (!isWork) continue;
        var cell = function (i) { return T.tab + '!' + PE.colName(col0 + B.col + i) + (row0 + r); };
        var ev = {};
        cols.forEach(function (k, i) {
          if (REFCOLS.indexOf(k) < 0) return;
          var lk = (LK[r] || [])[B.col + i], im = (IM[r] || [])[B.col + i], tx = o[k];
          if (Array.isArray(lk)) lk = lk.filter(Boolean)[0];
          if (lk) ev[k] = { t: 'link', url: String(lk), label: PE.noPhone(tx || 'link'), cell: cell(i) };
          else if (im) ev[k] = { t: 'img', cell: cell(i), url: im.url || null, label: 'image in sheet cell' };
          else if (!PE.empty(tx)) ev[k] = { t: 'text', text: PE.noPhone(tx), cell: cell(i) };
        });
        var rec = { id: 'fmc' + T.kind + '|' + B.date + '|' + (row0 + r), src: 'fmc:' + T.kind, tab: T.tab, date: B.date, from: B.from,
          srden: srden, aen: aen, unitRaw: unit, u: N.unitKey(unit), cell: cell(0) };
        TEXTCOLS.forEach(function (k) { if (o[k] != null && cols.indexOf(k) >= 0) rec[k] = PE.empty(o[k]) ? '' : PE.noPhone(o[k]); });
        rec.who = PE.desig(o.who);
        rec.ev = ev;
        rec.spans = PE.timeSpans(o.timing);
        records.push(rec);
      }
    }
    return { records: records, days: Object.keys(dayOf).map(function (k) { return dayOf[k]; }), blocks: blocks.map(function (b) { return { date: b.date, from: b.from, ok: b.ok, col: PE.colName(col0 + b.col) }; }), used: used.map(function (b) { return b.date; }), warnings: warnings };
  };

  /** [PB] B2: clean a STORED record again with today's placeholder rules: placeholder text -> '', placeholder proof -> missing.
   *  Returns null when no work-describing cell is left (the row was a nil report, not work). */
  PE.fmcClean = function (r, S) {
    var x = Object.assign({}, r); var kind = String(r.src || '').slice(4) || (/Block/.test(r.tab || '') ? 'B' : 'W');
    TEXTCOLS.forEach(function (k) { if (x[k] != null && PE.empty(x[k])) x[k] = ''; });
    if (x.who && PE.empty(x.who)) x.who = '';
    var ev = {}; Object.keys(r.ev || {}).forEach(function (k) { var e = r.ev[k]; if (e && e.t === 'text' && PE.empty(e.text)) return; ev[k] = e; }); x.ev = ev;
    var W = (S && S.fmc && S.fmc.workCells && S.fmc.workCells[kind]) || (kind === 'B' ? ['purpose', 'bs', 'timing'] : ['details', 'reason', 'bs', 'loc']);
    return W.some(function (k) { return !PE.empty(x[k]); }) ? x : null;
  };
  /** counts for the admin log: exact km (km in the text / point no. / mast) · block section or station only (approx) · not placed, with reasons */
  PE.placeCounts = function (recs) {
    var o = { total: recs.length, exact: 0, exactBy: {}, approx: 0, approxBy: {}, none: 0, reasons: {} };
    recs.forEach(function (r) {
      var w = r.where || {};
      if (w.lid && !w.approx) { o.exact++; o.exactBy[w.how] = (o.exactBy[w.how] || 0) + 1; }
      else if (w.lid) { o.approx++; o.approxBy[w.how] = (o.approxBy[w.how] || 0) + 1; }
      else { o.none++; var k = String(w.note || 'not placed').replace(/"[^"]*"/g, '"…"').replace(/block section [A-Z]+-[A-Z]+ not/, 'block section not').replace(/station [A-Z]+ known/, 'station known').replace(/block section [A-Z]+-[A-Z]+ known/, 'block section known'); o.reasons[k] = (o.reasons[k] || 0) + 1; }
    });
    return o;
  };
  PE.placeText = function (c) {
    var by = function (x) { return Object.keys(x).map(function (k) { return x[k] + ' ' + ({ km: 'by km in the text', asset: 'by point no.', mast: 'by OHE mast', blockSection: 'block section', station: 'station limit', section: 'section only' }[k] || k); }).join(', '); };
    return c.total + ' records: ' + c.exact + ' at exact km' + (c.exact ? ' (' + by(c.exactBy) + ')' : '') + ' · ' + c.approx + ' block section / station only' + (c.approx ? ' (' + by(c.approxBy) + ')' : '') + ' · ' + c.none + ' not placed';
  };
  /** locate the sheet records with the locator (block section / station / km in the caution location / point numbers) */
  PE.fmcLocate = function (recs, L) {
    return recs.map(function (r) {
      var w = L.locate({ bsText: r.bs, lineText: r.line, locText: r.loc, texts: [r.purpose, r.details, r.reason, r.remarks] });
      return Object.assign({}, r, { where: w, masts: w.masts || [] });
    });
  };
})(PE);


// ===== engine/feed.js
// HWH Track Portal – shared engine, part 5: TMS Control PORTAL FEED (schema 1, FOUNDATION F.5) – read only (brief A2b).
// The server reads Drive "TMS Control exports/portal-feed.json"; this file checks the schema and keeps what the portal shows.
var PE = (typeof PE !== 'undefined' && PE) || {};
(function (PE) {
  'use strict';
  PE.FEED_SCHEMA = 1;
  PE.feedSlim = function (F) {
    if (!F || typeof F !== 'object') throw new Error('The portal feed is not a JSON object');
    if (F.schema !== PE.FEED_SCHEMA) throw new Error('The portal feed has schema ' + F.schema + ' – this program reads schema ' + PE.FEED_SCHEMA + ' (ask TMS Control\'s report-engine chat what changed)');
    var pos = function (km, m) { return km == null ? null : [+km, +m || 0]; };
    var units = (F.units || []).map(function (u) { return { level: u.level, unit: u.unit, label: u.label || u.unit, official: u.official || '', inCharge: u.inCharge || '', section: u.section, line: u.line, lid: u.lineId, a: pos(u.fromKm, u.fromM), b: pos(u.toKm, u.toM), km: u.lengthKm, aen: u.aen || '', srden: u.srden || '', speed: u.speed }; });
    var jobs = (F.jobs || []).map(function (j) { return { id: 'fj' + j.jobId, jobId: j.jobId, type: j.type, kpi: j.kpi, u: j.unit, lid: j.lineId, km: j.fromKm, m: j.fromM, km2: j.toKm, m2: j.toM, loc: j.location, title: j.title, prio: j.priority, st: j.status, d: j.created, target: j.target, done: j.doneOn, appr: j.approvedOn, closed: j.closedOn, why: j.closeReason, src: j.source, run: j.sourceRun, first: j.firstRun, earlier: j.earlierJobs, rep: j.repeatAttended, tmsGone: j.tmsGone }; });
    var work = (F.workRecords || []).map(function (w) { return { id: 'fw' + w.id, jobId: w.jobId, u: w.unit, lid: w.lineId, km: w.fromKm, m: w.fromM, km2: w.toKm, m2: w.toM, d: w.workDate, d2: w.workDateTo, types: w.workTypes || [], qty: w.quantities || {}, men: w.men, mc: w.machine, st: w.status, sse: w.sseCheckedBy ? [w.sseCheckedBy, w.sseCheckedOn] : null, aen: w.aenApprovedBy ? [w.aenApprovedBy, w.aenApprovedOn] : null, photos: (w.photos || []).map(function (p) { return { fileId: p.fileId, kind: p.kind, at: p.takenAt }; }) }; });
    var kpi = (F.kpi || []).map(function (k) { return { unit: k.unit, last: k.lastMonth ? { period: k.lastMonth.period, total: k.lastMonth.total } : null, now: k.thisMonth ? { period: k.thisMonth.period, total: k.thisMonth.total } : null }; });
    var users = (F.users || []).map(function (u) { return { name: u.name, designation: u.designation, role: u.role, unit: u.unit }; });
    return { schema: F.schema, generatedAt: F.generatedAt, timeZone: F.timeZone, serverBuild: F.serverBuild, tmsFetchedAt: F.tmsFetchedAt || {}, units: units, jobs: jobs, work: work, kpi: kpi, users: users,
      counts: { units: units.length, jobs: jobs.length, openJobs: jobs.filter(function (j) { return !/closed|verified|deleted/i.test(j.st || ''); }).length, workRecords: work.length, photos: work.reduce(function (a, w) { return a + w.photos.length; }, 0), kpiUnits: kpi.length, users: users.length } };
  };
  /** age of the feed in hours and whether it is stale */
  PE.feedAge = function (generatedAt, nowIso, warnHours) {
    if (!generatedAt) return { hours: null, stale: true };
    var h = (Date.parse(nowIso) - Date.parse(generatedAt)) / 36e5; return { hours: Math.round(h * 10) / 10, stale: h > (warnHours || 36) };
  };
})(PE);


// ===== engine/packages.js
// HWH Track Portal – shared engine, part 6: WORK PACKAGES (brief A4).
// A sheet work-proof record (Field Mini Control "PWI at Block Site" / "PWI at Work Site") is matched to TMS work sites by
// date ± 1 day + SSE unit + line (+ km overlap from the caution location / block section; block timing ↔ TMS block availed).
// Outcomes: matched · sheet only (TMS entry gap) · TMS only (proof missing) · TMS, sheet not read for that day (not checked).
// Attached to each package: asset changes, machine rows and app work records at the same place ± 1 day, spot-card compliance ± 3 days.
var PE = (typeof PE !== 'undefined' && PE) || {};
(function (PE) {
  'use strict';
  var lin = function (km, m) { return km == null ? null : (+km) * 1000 + (+m || 0); };   // metres along the line (good enough for tolerances)
  var rng = function (o) { var a = lin(o.km, o.m), b = lin(o.km2 != null ? o.km2 : o.km, o.m2 != null ? o.m2 : o.m); if (a == null) return null; return a <= b ? [a, b] : [b, a]; };
  var near = function (A, B, tol) { if (!A || !B) return null; return A[0] - tol <= B[1] && B[0] - tol <= A[1]; };
  PE.near = near; PE.rng = rng;
  var lk = function (lid) { var m = String(lid || '').match(/ (UP|DN|Rev|Single|Up Chord|Dn Chord|3rd Line)( \d)?$/); return m ? m[0].trim() : ''; };
  var WORDS = [['weld', /weld|skv|thermit|a\.?t\.?\b/i], ['destress', /destress|distress|de-stress/i], ['sej', /sej/i], ['rail', /rail|trr|panel|dolly/i], ['tamp', /tamp|unimat|duomatic|dtex|ctr|utv|pqrs|t\/ex|b?cm\b|machine|m\/c/i],
    ['ballast', /ballast|screen|bcm/i], ['sleeper', /sleeper|tsr|psc/i], ['glued', /glue|g\/joint|g\/r\b/i], ['grease', /greas|lubric/i], ['switch', /switch|crossing|point|x-?ing|turnout|t\/o\b|lhs/i], ['lc', /\blc\b|level crossing/i], ['bridge', /bridge|br\.? ?no/i]];
  var words = function (t) { var o = {}; WORDS.forEach(function (w) { if (w[1].test(t || '')) o[w[0]] = 1; }); return o; };
  var unitEq = function (a, b) { if (!a || !b) return false; if (a === b) return true; var s = a.length < b.length ? a : b, l = a.length < b.length ? b : a; return s.length >= 3 && l.indexOf(s) === 0; };
  var spanOverlap = function (sp, from, to) {
    var a = PE.hm(from), b = PE.hm(to); if (a == null || b == null || !sp || !sp.length) return null;
    if (b < a) b += 1440;
    return sp.some(function (x) { var p = x.a, q = x.b; if (q < p) q += 1440; return p < b + 30 && a < q + 30 || p + 1440 < b + 30 && a < q + 1440 + 30; });
  };

  /** opts: {S (settings), coverage: {date: true} (sheet days read), today} ; pools: {ac, mp, fw, sc} */
  PE.buildPackages = function (fmc, ws, pools, opts) {
    var M = Object.assign({ dayTol: 1, kmTolM: 300, cardDays: 3, workDays: 1 }, (opts.S && opts.S.match) || {});
    var cand = [];
    fmc.forEach(function (r, i) {
      var W = r.where || {}; var R = W.lid ? rng(W) : null; var rw = words([r.purpose, r.details, r.reason].join(' '));
      ws.forEach(function (w, j) {
        var dd = Math.abs(PE.daysBetween(r.date, w.d)); var ddf = r.from ? Math.abs(PE.daysBetween(r.from, w.d)) : dd;
        if (Math.min(dd, ddf) > M.dayTol) return;
        if (!unitEq(r.u, w.u)) return;
        var sc = 2 - Math.min(dd, ddf);
        if (W.lid && w.lid) {
          if (W.lid === w.lid || (W.also || []).indexOf(w.lid) >= 0) sc += 3; else if (lk(W.lid) && lk(W.lid) === lk(w.lid)) sc += 1; else return;
          var n = near(R, rng(w), W.approx ? M.kmTolM * 3 : M.kmTolM);
          if (n === false && !W.approx) return; if (n) sc += 3;
        } else {
          var keys = r.line ? (opts.N ? opts.N.fieldLines(r.line) : []) : [];
          if (keys.length && w.lid && opts.N && keys.some(function (k) { return lk(w.lid) === opts.N.lineDisplay(k); })) sc += 1;
        }
        var so = spanOverlap(r.spans, w.bFrom, w.bTo); if (so) sc += 2; else if (so === false && r.tab && /Block/.test(r.tab)) sc -= 1;
        var ww = words([w.sub, w.wt, w.prog].join(' ')); var common = Object.keys(rw).filter(function (k) { return ww[k]; }).length; sc += Math.min(2, common);
        cand.push({ i: i, j: j, sc: sc });
      });
    });
    cand.sort(function (a, b) { return b.sc - a.sc; });
    var usedF = {}, usedW = {}, pk = [];
    cand.forEach(function (c) { if (usedF[c.i] || usedW[c.j]) return; usedF[c.i] = usedW[c.j] = 1; pk.push({ fmc: fmc[c.i], ws: [ws[c.j]], score: c.sc, outcome: 'matched' }); });
    // a second TMS site the same day, same unit and place joins the matched package (one block, two works)
    ws.forEach(function (w, j) {
      if (usedW[j]) return;
      for (var k = 0; k < pk.length; k++) { var p = pk[k], w0 = p.ws[0]; if (w0.d === w.d && w0.u === w.u && w0.lid === w.lid && near(rng(w0), rng(w), M.kmTolM)) { p.ws.push(w); usedW[j] = 1; return; } }
    });
    fmc.forEach(function (r, i) { if (!usedF[i]) pk.push({ fmc: r, ws: [], outcome: 'sheet only' }); });
    var cov = opts.coverage || null;
    ws.forEach(function (w, j) { if (!usedW[j]) pk.push({ fmc: null, ws: [w], outcome: !cov || cov[w.d] || cov[PE.addDays(w.d, 1)] ? 'tms only' : 'not checked' }); });
    // attachments at the same place and dates
    var idx = function (L) { var o = {}; (L || []).forEach(function (x) { if (x.lid) (o[x.lid] = o[x.lid] || []).push(x); }); return o; };
    var AC = idx(pools.ac), MP = idx(pools.mp), FW = idx(pools.fw), SC = idx(pools.sc);
    pk.forEach(function (p, n) {
      var w = p.ws[0], W = p.fmc && p.fmc.where;
      var lid = w ? w.lid : W && W.lid; var R = w ? rng(w) : W && W.lid ? rng(W) : null; var day = w ? w.d : p.fmc.date;
      p.id = 'pk' + (w ? w.tid : p.fmc.id);
      p.date = day; p.lid = lid || null; p.km = w ? w.km : W ? W.km : null; p.m = w ? w.m : W ? W.m : null; p.km2 = w ? w.km2 : W ? W.km2 : null; p.m2 = w ? w.m2 : W ? W.m2 : null;
      p.approx = !w && !!(W && W.approx);
      p.u = w ? w.u : p.fmc.u; p.type = w ? (w.sub || w.wt) : (p.fmc.purpose || p.fmc.reason || p.fmc.details || '');
      p.key = lid && p.km != null ? PE.cellKey(lid, p.km, p.m) : null;
      p.att = { ac: [], mp: [], fw: [], sc: [] };
      if (!lid) return;
      var tol = p.approx ? M.kmTolM * 3 : M.kmTolM;
      var inDays = function (d, k) { return d && Math.abs(PE.daysBetween(day, d)) <= k; };
      (AC[lid] || []).forEach(function (a) { if (inDays(a.d, M.workDays) && (!R || near(R, rng(a), tol) !== false)) p.att.ac.push(a); });
      (MP[lid] || []).forEach(function (a) { if (inDays(a.d, M.workDays) && (!R || !a.km || near(R, rng(a), tol * 3) !== false)) p.att.mp.push(a); });
      (FW[lid] || []).forEach(function (a) { if (inDays(a.d, M.workDays) && (!R || near(R, rng(a), tol) !== false)) p.att.fw.push(a); });
      (SC[lid] || []).forEach(function (a) { var cd = a.cmp || (a.st === 'closed' ? a.d16 : ''); if (inDays(cd, M.cardDays) && R && near(R, rng(a), tol)) p.att.sc.push(a); });
    });
    pk.sort(function (a, b) { return String(b.date).localeCompare(String(a.date)) || String(a.u).localeCompare(String(b.u)); });
    return pk;
  };
  /** per-unit counts for the register */
  PE.packageCounts = function (pk) {
    var u = {};
    pk.forEach(function (p) { var k = p.u || '?'; var o = u[k] = u[k] || { unit: k, total: 0, matched: 0, 'sheet only': 0, 'tms only': 0, 'not checked': 0, proofMissing: 0 }; o.total++; o[p.outcome]++; if (p.fmc && PE.proofMissing(p.fmc).length) o.proofMissing++; });
    return Object.keys(u).sort().map(function (k) { return u[k]; });
  };
  /** which certificates / photos a sheet record lacks */
  // [PB] B2: proof cells = photos, certificates, video (block site), PDF, AEN check, greasing. A placeholder ("----", NIL, No …) = missing.
  var PROOF = ['preImg', 'postImg', 'certSafety', 'certAgency', 'certWork', 'pdf', 'aenCheck', 'greasing'], PROOF_B = ['video'];
  PE.setProofCells = function (a, b) { if (a && a.length) PROOF = a.slice(); if (b) PROOF_B = b.slice(); };
  PE.proofCells = function (r) { return PROOF.concat(r && r.tab && /Block/.test(r.tab) ? PROOF_B : []); };
  PE.proofMissing = function (r) {
    return PE.proofCells(r).filter(function (k) {
      var e = r.ev && r.ev[k]; if (e) return e.t === 'text' && PE.empty(e.text);
      return PE.empty(r[k]);   // text proof (AEN check, greasing)
    });
  };

  // ---------------------------------------------------------------- [C] the work package told in plain words (project doc LANDING "Work package")
  PE.PROOF_NAME = { preImg: 'pre-work photo', postImg: 'post-work photo', certSafety: 'safety-staff certificate', certAgency: 'agency counselling certificate', certWork: 'work-details certificate',
    video: 'counselling video', pdf: 'signed measurement PDF', aenCheck: 'AEN check', greasing: 'gauge-face greasing photo', greasingImg: 'gauge-face greasing photo' };
  PE.proofName = function (k) { return PE.PROOF_NAME[k] || String(k).replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase(); };
  PE.BAND = { matched: { t: 'In both – Field Mini Control and TMS', c: 'ok' }, 'sheet only': { t: 'Only in Field Mini Control – not entered in TMS', c: 'bad' },
    'tms only': { t: 'Only in TMS – no record in Field Mini Control', c: 'warn' }, 'not checked': { t: 'Not compared yet – Field Mini Control not read for that day', c: 'neu' } };
  var dm = function (d) { if (!d) return ''; var x = String(d).length > 10 && PE.istDate ? PE.istDate(d) : String(d).slice(0, 10); var m = x.match(/^(\d{4})-(\d\d)-(\d\d)$/); return m ? m[3] + '-' + m[2] + '-' + m[1] : x; };   // dd-mm-yyyy (IST for a date-time)
  var kmT = function (o) { return o && o.km != null ? 'km ' + PE.fmtKm(o.km, o.m) + (o.km2 != null && (o.km2 !== o.km || o.m2 !== o.m) ? '–' + PE.fmtKm(o.km2, o.m2) : '') : ''; };
  var sse = function (u) { return 'SSE/P.Way/' + (u || '?'); };
  /** -> {band, bandCls, fmcLine, tmsLine, sentence, searched, todo[], side[[label, sheet, tms, differs]], proofs[{name, state, where}], blockNote, placed, related[{what, why}], source} */
  PE.packageStory = function (p) {
    var r = p.fmc, w = p.ws[0], B = PE.BAND[p.outcome] || { t: p.outcome, c: 'neu' }, o = { band: B.t, bandCls: B.c, todo: [], side: [], proofs: [], related: [] };
    var placeF = r ? [r.bs, r.line].filter(Boolean).join(', ') : '', placeW = w ? (w.lid || [w.sec, w.ln].filter(Boolean).join(' ')) + (kmT(w) ? ' ' + kmT(w) : '') : '';
    var d1 = PE.addDays(p.date, -1), d2 = PE.addDays(p.date, 1);
    o.fmcLine = r ? 'Field Mini Control: ' + r.tab + ', ' + dm(r.date) + (placeF ? ', ' + placeF : '') + (r.purpose || r.details ? ' – ' + (r.purpose || r.details) : '') : p.outcome === 'not checked' ? 'Field Mini Control: not read for ' + dm(p.date) + ' – not compared' : 'Field Mini Control: no record found';
    o.tmsLine = w ? 'TMS work site: no. ' + w.tid + ', ' + dm(w.d) + ', ' + placeW + (w.sub || w.wt ? ' – ' + (w.sub || w.wt) : '') + (p.ws.length > 1 ? ' (+' + (p.ws.length - 1) + ' more site the same day)' : '') : 'TMS work site: none found';
    if (p.outcome === 'matched') { o.sentence = 'This work is in both: Field Mini Control and a TMS work site of unit ' + p.u + '.'; o.searched = 'Matched on date (± 1 day), unit ' + p.u + ', line' + (r && r.where && r.where.lid && w.lid ? ' and km' : '') + '.'; }
    else if (p.outcome === 'sheet only') { o.sentence = 'Done in the field (Field Mini Control) but not entered in TMS.'; o.searched = 'Searched TMS work sites of unit ' + p.u + ', ' + dm(d1) + ' to ' + dm(d2) + (placeF ? ', ' + placeF : '') + ': none found.'; o.todo.push(sse(p.u) + ' to enter this work in TMS – Work Site entry.'); }
    else if (p.outcome === 'tms only') { o.sentence = 'Entered in TMS but there is no record of it in Field Mini Control.'; o.searched = 'Searched Field Mini Control rows of unit ' + p.u + ', ' + dm(d1) + ' to ' + dm(d2) + ': none found.'; o.todo.push(sse(p.u) + ' to record it in Field Mini Control with proof.'); }
    else { o.sentence = 'Entered in TMS; Field Mini Control was not read for that day, so it is not compared yet.'; o.searched = 'Field Mini Control has no read for ' + dm(p.date) + ' (or the night before).'; }
    // proofs – ALL are required for every work
    if (r) {
      var miss = PE.proofMissing(r);
      PE.proofCells(r).forEach(function (k) { var e = r.ev && r.ev[k]; var m = miss.indexOf(k) >= 0;
        o.proofs.push({ k: k, name: PE.proofName(k), state: m ? 'blank in your sheet' : e && e.t === 'link' ? 'in sheet (link)' : e && e.t === 'img' ? 'in sheet (image in the cell)' : 'in sheet', ok: !m, url: e && e.t === 'link' ? e.url : '', cell: e && e.cell || '' }); });
      if (miss.length) o.todo.push(sse(p.u) + ' to add the missing proof in Field Mini Control: ' + miss.map(PE.proofName).join(', ') + '.');
      var isBlock = /Block/.test(r.tab || '');
      o.blockNote = isBlock ? (r.timing ? '' : 'Traffic block time: not filled in your sheet (required in PWI at Block Site).') : (r.timing ? '' : 'Traffic block details are not required in PWI at Work Site – blank is not a gap.');
      if (isBlock && !r.timing) o.todo.push(sse(p.u) + ' to fill the traffic block time in Field Mini Control (PWI at Block Site).');
    }
    if (w) o.proofs.push({ k: 'tmsPhotos', name: 'TMS site photos / track parameters', state: (w.att || []).length ? (w.att || []).length + ' attached in TMS' : 'none attached in TMS', ok: (w.att || []).length > 0, tms: true });
    // side by side
    var blkF = r ? (r.timing || (/Block/.test(r.tab || '') ? 'not filled in your sheet' : 'not required (PWI at Work Site)')) : '', blkW = w ? (w.bFrom && w.bTo ? w.bFrom + '–' + w.bTo + (w.bAv ? ' (' + w.bAv + ' of ' + (w.bDem || '?') + ' min demanded)' : '') : 'not entered in TMS') : '';
    var row = function (l, a, b) { o.side.push([l, a, b, !!(a && b && String(a).toLowerCase() !== String(b).toLowerCase())]); };
    row('Date', r ? dm(r.date) + (r.from && r.from !== r.date ? ' (night from ' + dm(r.from) + ')' : '') : '—', w ? dm(w.d) : '—');
    row('Place', r ? (placeF || 'not given') + (r.where && r.where.lid && !r.where.approx ? ' → ' + r.where.lid + ' ' + kmT(r.where) : '') : '—', w ? placeW : '—');
    row('Block time', r ? blkF : '—', w ? blkW : '—');
    row('Work', r ? [r.purpose, r.reason, r.details].filter(Boolean).join(' · ') || 'blank in your sheet' : '—', w ? [w.sub || w.wt, w.prog].filter(Boolean).join(' · ') : '—');
    row('By', r ? (r.who || 'blank in your sheet') : '—', w ? (w.by || 'not given in TMS') : '—');
    o.side.forEach(function (x) { if (x[1] === '—' || x[2] === '—' || x[0] === 'Work' || x[0] === 'By') x[3] = false; });
    // placement
    var W = r && r.where || {};
    o.placed = w && w.lid ? 'Placed by the TMS work site: ' + w.lid + ' ' + kmT(w) + '.' : W.lid && !W.approx ? 'Placed exactly: ' + W.lid + ' ' + kmT(W) + (W.how === 'mast' ? ' (from the OHE mast list)' : W.how === 'asset' ? ' (from the point number)' : ' (km written in the sheet)') + '.'
      : W.lid ? (W.how === 'station' ? 'Station only' : 'Block section only') + ' – ' + W.lid + '; the sheet gives no km, the exact 200 m is not known.' : 'Not placed: ' + (W.note || 'place not recognised') + '.';
    // related records ± 1 day, explained
    var a = p.att || { ac: [], mp: [], fw: [], sc: [] };
    a.sc.forEach(function (x) { o.related.push({ what: 'Spot card ' + (x.src || '') + (x.it ? ' – ' + x.it : '') + (x.p ? ', priority P' + x.p : '') + (x.ob ? ', ' + x.ob : '') + ', closed ' + dm(x.cmp || x.d16), why: 'closed within 3 days of this work at the same place' }); });
    a.ac.forEach(function (x) { o.related.push({ what: 'TMS asset change: ' + x.k + (x.t ? ' ' + x.t : '') + ', ' + dm(x.d), why: 'same place, ± 1 day' }); });
    a.mp.forEach(function (x) { o.related.push({ what: 'TMS machine progress: ' + x.mc + ', ' + dm(x.d) + (x.approx ? ' (block section only)' : ''), why: 'same block section / place, ± 1 day' }); });
    a.fw.forEach(function (x) { o.related.push({ what: 'TMS Control work record: ' + (x.types || []).join(', ') + ', ' + dm(x.d), why: 'same place, ± 1 day' }); });
    o.source = r ? 'Field Mini Control → ' + r.tab + ', cell ' + String(r.cell || '').split('!')[1] : 'TMS → Work Site no. ' + (w ? w.tid : '?');
    return o;
  };
})(PE);


// ===== engine/rules.js
// HWH Track Portal – shared engine, part 8: LOCATION CARD – timeline of one 200 m cell and the rule-based reasons (brief A5).
// No AI: every reason is a fixed rule with its numbers shown; thresholds from settings.rules (IRPWM defaults, overrides later).
var PE = (typeof PE !== 'undefined' && PE) || {};
(function (PE) {
  'use strict';
  var lin = function (km, m) { return (+km) * 1000 + (+m || 0); };
  PE.cellRange = function (km, ci) { var a = lin(km, ci * 200); return [a, ci === 4 ? lin(+km + 1, 0) - 1 : a + 199]; };
  var inCell = function (o, C) { var R = PE.rng(o); if (!R) return false; return R[0] <= C[1] && C[0] <= R[1]; };

  /** D = the line's data {sc, ws, ac, mp, tr, tq, cond, itms, fmc (located), jobs, work, packages, health:{cells, gmt, tg}} -> items in the cell */
  PE.cellItems = function (D, lid, km, ci) {
    var C = PE.cellRange(km, ci), out = [];
    var add = function (kind, x, extra) { out.push(Object.assign({ kind: kind, d: x.d || x.date || '', x: x }, extra || {})); };
    (D.sc || []).forEach(function (x) { if (inCell(x, C)) add('card', x); });
    (D.ws || []).forEach(function (x) { if (inCell(x, C)) add('tmsWork', x); });
    (D.ac || []).forEach(function (x) { if (x.k !== 'pnx' && inCell(x, C)) add('asset', x); });
    (D.mp || []).forEach(function (x) { if (x.km != null && inCell(x, C)) add('machine', x, { approx: !!x.approx }); });
    (D.fmc || []).forEach(function (x) { var W = x.where || {}; if (W.lid === lid && inCell(W, C)) add('sheetWork', x, { d: x.date, approx: !!W.approx }); });
    (D.jobs || []).forEach(function (x) { if (inCell(x, C)) add('job', x); });
    (D.work || []).forEach(function (x) { if (inCell(x, C)) add('appWork', x); });
    (D.cond || []).forEach(function (x) { if (inCell(x, C)) add('condition', x, { d: '' }); });
    (D.tr || []).forEach(function (x) { if (inCell(x, C)) add('trcRun', x); });
    out.sort(function (a, b) { return String(b.d).localeCompare(String(a.d)); });
    return out;
  };
  var WORK = { tmsWork: 1, asset: 1, machine: 1, sheetWork: 1, appWork: 1 };
  var isGeoCard = function (x) { return /TRC|OMS|ITMS/i.test(x.src || '') || /TRC|OMS|ITMS/i.test(x.it || ''); };

  /** reasons for the cell: [{lvl: 'Act'|'Watch'|'Info', code, text}] ; open actions [{text, kind}] */
  PE.cellReasons = function (items, prof, opts) {
    var R = Object.assign({ tampMonths: 24, cleanCushionMm: 150, lifeWatch: 0.9, life: { '04': 800, '03': 525 }, backDays: 120, noActionDays: 7, tgi: { watch: 80, act: 50, urgent: 36 } }, (opts && opts.rules) || {});
    var today = (opts && opts.today) || new Date().toISOString().slice(0, 10);
    var out = [], acts = [];
    // [PB] 03-Nov: only EXACTLY placed events are facts for the rules; events placed by block section / station only ("approx") are shown
    // apart on the card as "nearby" and never drive a reason.
    items = items.filter(function (i) { return !i.approx; });
    var work = items.filter(function (i) { return WORK[i.kind]; });
    var workNear = function (d, days) { return work.filter(function (w) { return w.d && Math.abs(PE.daysBetween(w.d, d)) <= days; }); };
    // 1. card closed with no action recorded and no matching work
    var noAct = items.filter(function (i) { return i.kind === 'card' && i.x.st === 'closed' && i.x.act !== undefined && !i.x.act; });
    var noActNoWork = noAct.filter(function (i) { var d = i.x.cmp || i.x.d16 || i.d; return !workNear(d, R.noActionDays).length; });
    if (noActNoWork.length) out.push({ lvl: 'Act', code: 'noAction', text: noActNoWork.length + ' spot card(s) closed in TMS with no action recorded and no work found here within ' + R.noActionDays + ' days (e.g. ' + noActNoWork[0].x.ob + ', closed ' + (noActNoWork[0].x.cmp || noActNoWork[0].x.d16) + ')' });
    // 2. defect back after work
    var back = [];
    items.filter(function (i) { return i.kind === 'card' && isGeoCard(i.x); }).forEach(function (c) {
      var w = work.filter(function (x) { var g = PE.daysBetween(x.d, c.d); return g > 0 && g <= R.backDays; });
      if (w.length) back.push([c, w[0]]);
    });
    if (back.length) out.push({ lvl: 'Act', code: 'back', text: 'defect back after work: ' + back[0][0].x.src + ' card "' + back[0][0].x.ob + '" on ' + back[0][0].d + ', ' + PE.daysBetween(back[0][1].d, back[0][0].d) + ' days after ' + label(back[0][1]) + (back.length > 1 ? ' (+' + (back.length - 1) + ' more)' : '') });
    // 3. repeated cards
    var yr = items.filter(function (i) { return i.kind === 'card' && PE.daysBetween(i.d, today) <= 365; });
    if (yr.length >= 3) out.push({ lvl: 'Watch', code: 'repeat', text: yr.length + ' spot cards in the last 12 months in this 200 m' });
    // 4. last tamping age (TMS chart layer, else machine rows here)
    var lt = prof && prof.lt; var mt = items.filter(function (i) { return i.kind === 'machine' && /tamp|unimat|duomatic|dtex|csm|09-|ctr/i.test(i.x.mc || ''); })[0];
    var tampD = [lt, mt && mt.d].filter(Boolean).sort().pop();
    if (tampD) { var mo = PE.daysBetween(tampD, today) / 30.4; if (mo > R.tampMonths) out.push({ lvl: 'Watch', code: 'tamp', text: 'last tamping ' + tampD + (lt === tampD ? ' (TMS)' : ' (machine progress)') + ' – ' + Math.floor(mo) + ' months ago (rule ' + R.tampMonths + ')' }); else out.push({ lvl: 'Info', code: 'tamp', text: 'last tamping ' + tampD + ' – ' + Math.floor(mo) + ' months ago' }); }
    else out.push({ lvl: 'Info', code: 'tamp', text: 'no tamping date in TMS for this stretch' });
    // 5. deep screening (user's rule, 03-Nov-2026): plan it when the CLEAN BALLAST CUSHION is below rules.cleanCushionMm (150 mm) – value from
    //    TMS's ballast report (opts.cleanCushion, when that data is loaded). The date of the last deep screening is only a fact, never a reason.
    var cc = opts && opts.cleanCushion;
    if (cc && cc.mm != null) out.push({ lvl: +cc.mm < R.cleanCushionMm ? 'Act' : 'Info', code: 'cushion', text: 'clean ballast cushion ' + cc.mm + ' mm' + (cc.on ? ' (' + cc.on + ')' : '') + ' – ' + (+cc.mm < R.cleanCushionMm ? 'below ' + R.cleanCushionMm + ' mm: plan deep screening' : 'not below ' + R.cleanCushionMm + ' mm') + ' (TMS)' });
    var dsA = items.filter(function (i) { return i.kind === 'asset' && i.x.k === 'ballast' && /deep/i.test(i.x.t || i.x.sub || ''); }).map(function (i) { return i.d; }).sort().pop();
    var ds = [prof && prof.ds, dsA].filter(Boolean).sort().pop();
    if (ds) out.push({ lvl: 'Info', code: 'ds', text: 'last deep screening ' + ds + (prof && prof.ds === ds ? ' (TMS)' : ' (TMS ballast change)') });
    // 6. rail GMT carried vs life (TMS)
    if (prof && prof.cg != null && R.life[prof.rs]) { var f = prof.cg / R.life[prof.rs]; out.push({ lvl: f >= 1 ? 'Act' : f >= R.lifeWatch ? 'Watch' : 'Info', code: 'gmt', text: 'rail has carried ' + prof.cg + ' GMT of ' + R.life[prof.rs] + ' GMT life (' + Math.round(f * 100) + ' %, TMS)' }); }
    // 7. TMS TGI of the km
    if (opts && opts.tgi && opts.tgi[0]) { var v = opts.tgi[0][0]; var lv = v < R.tgi.urgent ? 'Act' : v < R.tgi.act ? 'Act' : v < R.tgi.watch ? 'Watch' : 'Info'; out.push({ lvl: lv, code: 'tgi', text: 'TMS track geometry index ' + v + ' on this km (run ' + (opts.tgi[0][1] || '?') + ')' + (opts.tgi[1] ? ', before ' + opts.tgi[1][0] : '') }); }
    // open actions
    items.forEach(function (i) {
      if (i.kind === 'card' && i.x.st === 'open') acts.push({ kind: 'card', text: 'open ' + i.x.src + ' spot card P' + i.x.p + ': ' + i.x.ob + ' (' + i.d + ')' });
      if (i.kind === 'job' && !/closed|verified|deleted/i.test(i.x.st || '')) acts.push({ kind: 'job', text: 'TMS Control job ' + i.x.jobId + ' ' + i.x.type + ' – ' + (i.x.title || '') + ' (' + i.x.st + ')' });
    });
    (opts && opts.packages || []).forEach(function (p) { if (p.outcome === 'sheet only') acts.push({ kind: 'gap', text: 'work of ' + p.date + ' in Field Mini Control but not in TMS work sites (TMS entry gap)' }); if (p.outcome === 'tms only') acts.push({ kind: 'proof', text: 'TMS work site of ' + p.date + ' (' + p.type + ') has no sheet proof' }); });
    var order = { Act: 0, Watch: 1, Info: 2 }; out.sort(function (a, b) { return order[a.lvl] - order[b.lvl]; });
    return { reasons: out, actions: acts };
  };
  function label(w) { var x = w.x; return ({ tmsWork: 'TMS work site ' + (x.sub || ''), asset: x.k + ' change', machine: 'machine ' + (x.mc || ''), sheetWork: 'sheet work ' + (x.purpose || x.details || ''), appWork: 'app work record' })[w.kind] + ' of ' + w.d; }
})(PE);


// ===== engine/health.js
// HWH Track Portal – shared engine, part 7: TRACK HEALTH (200 m cell model, chart + GMT parsing, signals, index, roll-up).
// COPIED UNCHANGED from TMS Control's track_health_phase1/platform/web/health.js (Part 1 = ENGINE, lines 10–243, track-health chat [H],
// 19-Oct-2026), handed over 29-Oct-2026 – now owned by the portal. Only the wrapper differs: PE.HE instead of window.HEALTH_ENGINE.
var PE = (typeof PE !== 'undefined' && PE) || {};
PE.HE = (function () {
  const P = (km, m) => (+km || 0) * 10000 + (+m || 0);            // position: km*10000 + m (TMS km can be longer than 1000 m – no overlap)
  const kmOf = p => Math.floor(p / 10000), mOf = p => p - kmOf(p) * 10000;
  const cellOf = m => Math.max(0, Math.min(4, Math.floor((+m || 0) / 200)));   // 200 m cell in the km; cell 4 takes the rest of a long km
  const MON = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
  const p2 = n => String(n).padStart(2, '0');
  const yy = (y, now) => { y = +y; if (y >= 100) return y; const c = (now || 2026) % 100; return y <= c + 1 ? 2000 + y : 1900 + y; };
  // 'Mar-25' / 'Feb-22 Dept. Machine' -> '2025-03'; '20251122-DTE' / '20260822' -> '2025-11-22'; '16/02/2025' or '09/04/26(B)' -> ISO
  function dateOf(s, now) {
    s = String(s == null ? '' : s).trim(); let m;
    if ((m = s.match(/^(\d{4})(\d\d)(\d\d)/))) return `${m[1]}-${m[2]}-${m[3]}`;
    if ((m = s.match(/^(\d\d?)\/(\d\d?)\/(\d{2,4})/))) return `${yy(m[3], now)}-${p2(m[2])}-${p2(m[1])}`;
    if ((m = s.match(/^([A-Za-z]{3})[a-z]*[-\s'](\d{2,4})/)) && MON[m[1].toLowerCase()]) return `${yy(m[2], now)}-${p2(MON[m[1].toLowerCase()])}`;
    return null;
  }
  const num = v => { const n = parseFloat(String(v == null ? '' : v).replace(/,/g, '')); return isFinite(n) ? n : null; };
  const EMPTY = v => v == null || v === '' || v === '0' || v === '-' || v === 0;
  // a chart layer = [[span,…], [span,…]] (sub-rows) or [span,…]; span {locationfrom, meterfrom, locationto, meterto, railsection, railsecdesc}
  function subs(raw) {
    if (!raw) return [];
    if (raw.pieces) return subs([].concat(...raw.pieces.map(p => (Array.isArray(p.data) && Array.isArray(p.data[0]) ? p.data[0] : p.data) || [])));
    if (!Array.isArray(raw)) return [];
    return raw.length && Array.isArray(raw[0]) ? raw : [raw];
  }
  function spans(list, keepZero) {
    const out = [];
    for (const x of list || []) {
      if (!x || typeof x !== 'object') continue;
      let a = P(x.locationfrom, x.meterfrom), b = P(x.locationto, x.meterto);
      if (b < a) { const t = a; a = b; b = t; }
      const v = x.railsection, d = x.railsecdesc;
      if (!keepZero && EMPTY(v) && EMPTY(d)) continue;
      out.push([a, b, v == null ? '' : String(v), d == null ? '' : String(d)]);
    }
    return out.sort((p, q) => p[0] - q[0]);
  }
  // value of a span list over [c0,c1): the span covering most of it (dominant), or every overlapping one
  function over(list, c0, c1) { const r = []; for (const s of list) { if (s[0] >= c1) break; const o = Math.min(s[1], c1) - Math.max(s[0], c0); if (o > 0 || (s[0] === s[1] && s[0] >= c0 && s[0] < c1)) r.push([s, Math.max(o, 0)]); } return r; }
  function dom(list, c0, c1) { let best = null, bo = -1; for (const [s, o] of over(list, c0, c1)) if (o > bo) { best = s; bo = o; } return best; }

  // ---------- one TMS chart file (TMS Collector 'tmsChart') ----------
  function parseChart(f, N, now) {
    const sec = N.sectionName(f.section) || f.section, lk = N.lineKey(f.line) || f.line;
    const lid = `${N.sectionCode(sec)} ${N.lineDisplay(lk)}`;
    const L = f.layers || {}; const g = k => subs(L[k]); const s0 = (k, i = 0, z) => spans(g(k)[i], z);
    const D = {   // compact span lists for the strip chart: [a, b, value]
      rsL: s0('getRailSection_LR', 0), gdL: s0('getRailSection_LR', 1), roL: s0('getRailSection_LR', 2), lyL: s0('getRailSection_LR', 3), cgL: s0('getRailSection_LR', 4),
      rsR: s0('getRailSection_RR', 0), gdR: s0('getRailSection_RR', 1), roR: s0('getRailSection_RR', 2), lyR: s0('getRailSection_RR', 3), cgR: s0('getRailSection_RR', 4),
      gy: s0('getTrafficDensity'), lt: s0('getLastTamping'), frm: s0('getMachineTamping_FRM'), bcm: s0('getMachineTamping_BCM'),
      trr: s0('getTRRRenewal'), tsr: s0('getTSRRenewal'), tfr: s0('getTFRRenewal'), tbr: s0('getTBRRenewal'), tftr: s0('getTFTRRenewal'), twr: s0('getTWRRenewal'), isd: s0('getISDRenewal'),
      cush: s0('getBallast', 0), ds: s0('getBallast', 1), bal: s0('getBallast', 2), slT: s0('getSleeper', 0), slD: s0('getSleeper', 1), slY: s0('getSleeper', 2),
      fF: s0('getFasteningMstDtl_F'), fR: s0('getFasteningMstDtl_R'), fL: s0('getFasteningMstDtl_L'),
      wf: s0('getWeekFormation'), cl: s0('getCriticalLocation'), sr: s0('getSpeedRestriction'),
      utL: s0('getUSFDRailTesting_LR'), utR: s0('getUSFDRailTesting_RR'), cv: s0('getCurve'), br: s0('getBridge'), lwL: s0('getLwrSwrFwp_LR'), lwR: s0('getLwrSwrFwp_RR'), dst: s0('getLwrDestressingDate')
    };
    // extent of the line: every span of every layer (the section's authority range)
    let a = Infinity, b = -Infinity;
    for (const k in L) for (const sub of subs(L[k])) for (const x of sub || []) { if (!x || x.locationfrom == null) continue; const p = P(x.locationfrom, x.meterfrom), q = P(x.locationto, x.meterto); if (/^getFracture/.test(k)) continue; a = Math.min(a, p, q); b = Math.max(b, p, q); }
    if (!isFinite(a)) { a = P(f.kmFrom, 0); b = P(f.kmTo, 0); }
    // TMS track geometry index per km, last three runs: 'A~84~1~09/04/26(B)~87~13/12/25(c)~72~22/01/25(b)'
    const tg = [];
    for (const x of subs(L.getTRCTgi)[0] || []) {
      const p = String(x.railsection || '').split('~'); if (p.length < 4 || EMPTY(p[1])) continue;
      const runs = []; for (const [vi, di] of [[1, 3], [4, 5], [6, 7]]) { const v = num(p[vi]); if (v == null) continue; const dd = dateOf(p[di], now); runs.push([v, dd, (String(p[di] || '').match(/\(([A-Za-z])\)/) || [])[1] || '']); }
      if (runs.length) tg.push([+x.locationfrom, p[0], runs]);
    }
    // USFD defects per km 'km#count'; fractures this year / last year / the year before 'Weld~id~RR~16/02/2025~7~558'
    const ud = {}; for (const x of subs(L.getUSFDDefectDtl)[0] || []) { const q = String(x.railsection || '').split('#'); if (q.length === 2 && +q[1] > 0) ud[+q[0]] = +q[1]; }
    const fr = []; for (const k of ['getFractureDetails_0', 'getFractureDetails_1', 'getFractureDetails_2']) for (const x of subs(L[k])[0] || []) { const q = String(x.railsection || '').split('~'); if (q.length >= 6) fr.push([q[0], q[2], dateOf(q[3], now), +q[4], +q[5], q[1]]); }
    // ---- 200 m cells
    const cells = [];
    for (let km = kmOf(a); km <= kmOf(b); km++) {
      for (let ci = 0; ci < 5; ci++) {
        const c0 = P(km, ci * 200), c1 = ci < 4 ? P(km, ci * 200 + 200) : P(km + 1, 0);
        if (c1 <= a || c0 >= b) continue;
        const v = (list, f2) => { const s = dom(list, c0, c1); return s ? (f2 ? f2(s[2], s[3]) : s[2]) : null; };
        const any = (list) => over(list, c0, c1).map(z => z[0]);
        const laid = [v(D.lyL, x => dateOf(x, now)), v(D.lyR, x => dateOf(x, now))].filter(Boolean).sort()[0] || null;
        const cg = Math.max(-1, ...[v(D.cgL, num), v(D.cgR, num)].filter(x => x != null));
        const ut = [v(D.utL, x => dateOf(x, now)), v(D.utR, x => dateOf(x, now))].filter(Boolean).sort()[0] || null;
        const srs = any(D.sr).map(s => num(s[2])).filter(x => x > 0);
        const lt = dom(D.lt, c0, c1); const ltd = lt ? String(lt[2]).split('-') : null;
        let rn = null; for (const [k, nm] of [['trr', 'TRR'], ['tsr', 'TSR'], ['tfr', 'TFR'], ['tbr', 'TBR'], ['tftr', 'TFTR'], ['twr', 'TWR'], ['isd', 'ISD']]) { const s = dom(D[k], c0, c1); if (!s) continue; const y = (String(s[2]).match(/(\d\d)-(\d\d)$/) || [])[1]; if (y && (!rn || +y > rn[1])) rn = [nm + ' ' + String(s[2]).replace(/^\d+\//, ''), +y]; }
        const cl = any(D.cl).map(s => s[2] || s[3]).filter(x => !EMPTY(x));
        const cv = any(D.cv).map(s => String(s[2]).split('$')[0]).filter(x => !EMPTY(x));
        const br = any(D.br).map(s => String(s[2]).split('$')[0]).filter(x => !EMPTY(x));
        const lw = v(D.lwL, (x, d) => d || String(x).charAt(0));
        cells.push([km, ci, v(D.rsL) || v(D.rsR), v(D.gdL) || v(D.gdR), laid, cg >= 0 ? cg : null, v(D.gy, x => num(x)),
          ltd && ltd[0] ? dateOf(ltd[0], now) : null, ltd && ltd[1] ? ltd[1] : null, v(D.ds, x => dateOf(x, now)),
          any(D.wf).some(s => s[2] === '1') ? 1 : 0, cl.length ? cl.join(', ') : null, srs.length ? Math.min(...srs) : null, ut,
          cv.length ? [...new Set(cv)].join(',') : null, br.length ? [...new Set(br)].join(',') : null, lw || null, rn ? rn[0] : null, v(D.slT)]);
      }
    }
    const det = {}; for (const k in D) det[k] = D[k].map(s => s[3] && s[3] !== s[2] ? [s[0], s[1], s[2], s[3]] : [s[0], s[1], s[2]]);
    return { meta: { lid, sec, line: f.line, lk, rc: f.sectionCode || '', lc: f.lineCode || '', a, b, at: f.fetchedAt || '' }, cells, tg, ud, fr, det };
  }
  // cell array -> object
  const CF = ['km', 'ci', 'rs', 'rg', 'rl', 'cg', 'gy', 'lt', 'lm', 'ds', 'wf', 'cl', 'sr', 'ut', 'cv', 'br', 'lw', 'rn', 'sl'];
  const cellObj = a => { const o = {}; CF.forEach((k, i) => { o[k] = a[i]; }); return o; };

  // ---------- GMT file (TMS Collector 'gmt'): GMT per section / line / km stretch / year ----------
  function parseGmt(f, N) {
    const by = {};
    for (const r of f.records || []) {
      if (r.gmt == null || r.fromKm == null || r.toKm == null) continue;
      const sec = N.sectionName(r.section) || r.section, lk = N.lineKey(r.line) || r.line; const lid = `${N.sectionCode(sec)} ${N.lineDisplay(lk)}`;
      (by[lid] = by[lid] || []).push([r.finYear, P(r.fromKm, r.fromM), P(r.toKm, r.toM), +r.gmt, r.source === 'Auto' ? 'A' : 'M']);
    }
    for (const k in by) by[k].sort((p, q) => String(p[0]).localeCompare(String(q[0])) || p[1] - q[1]);
    return { at: f.asOn || '', fullOn: f.fullOn || '', years: f.years || [], by };
  }

  // ---------- the whole set -> the stored document (cells, small) + one detail per line (strip chart) ----------
  function buildDoc(charts, gmt, N, now) {
    const lines = [], details = {}; const seen = {};
    for (const f of charts) {
      const r = parseChart(f, N, now);
      if (seen[r.meta.lid]) continue; seen[r.meta.lid] = 1;   // the same line twice: first file wins (files are named by section + line)
      lines.push(Object.assign({}, r.meta, { c: r.cells, t: r.tg, u: r.ud, f: r.fr }));
      details[r.meta.lid] = { lid: r.meta.lid, meta: r.meta, det: r.det, gmt: gmt && gmt.by[r.meta.lid] || [] };
    }
    lines.sort((p, q) => p.lid.localeCompare(q.lid));
    const at = charts.map(f => f.fetchedAt || '').sort().pop() || '';
    return { doc: { v: 1, at, gmtAt: gmt ? gmt.at : '', cf: CF, lines }, details, gmtLines: gmt ? Object.keys(gmt.by).length : 0 };
  }

  // ---------- rules (Settings HEALTH_RULES; defaults to be confirmed by the user – IRPWM / RDSO figures where they exist) ----------
  const RULES = {
    w: { geo: 30, ride: 15, rail: 20, weld: 15, struct: 10, assets: 5, attn: 5 }, cap: 40,           // confirmed by the user 16-Oct
    score: { Good: 100, Watch: 70, Act: 40, Urgent: 10 },
    tgi: { watch: 80, act: 50, urgent: 36 },          // TMS track geometry index (TGI) per km: below 80 Watch, below 50 Act, below 36 Urgent
    tgiDrop: 10,                                      // TGI fell by this much since the run before: shown as falling
    peak: { UML: 'Urgent', NBML: 'Act' }, blockRisk: 0.85,
    oms: { watch: 0.15, act: 0.20, urgent: 0.30 },    // OMS peak acceleration (g)
    life: { '04': 800, '03': 525 }, lifeWatch: 0.9,   // rail life in GMT by TMS rail-section code (04 = 60 kg, 03 = 52 kg)
    usfdDays: 365, fractMonths: 12, dsYears: 10
  };
  const LV = ['Good', 'Watch', 'Act', 'Urgent']; const lvi = s => LV.indexOf(s);
  const worse = (a, b) => (a == null ? b : b == null ? a : lvi(b) > lvi(a) ? b : a);
  const SIG = [['geo', 'Geometry'], ['ride', 'Ride'], ['rail', 'Rail'], ['weld', 'Welds'], ['struct', 'Track structure'], ['assets', 'Special assets'], ['attn', 'Attention']];
  const addM = (iso, months) => { const d = new Date(iso + 'T00:00:00Z'); d.setUTCMonth(d.getUTCMonth() + months); return d.toISOString().slice(0, 10); };
  const daysBetween = (a, b) => Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(String(a).slice(0, 10).padEnd(10, '-01').replace(/-$/, '') + 'T00:00:00Z')) / 864e5);
  const isoD = s => { s = String(s || ''); return s.length === 7 ? s + '-01' : s.slice(0, 10); };

  // sig (server 'healthData'): peaks [lid,km,m,param,value,status,run,day], blocks [lid,km,block,irpwm,mi,risk,tqic,run,day],
  //   items [lid,km,m,kind,sub,status,date,value], fract [lid,km,m,type,date], jobs [lid,km,m,type,overdue,prio,id,title], has {usfd,omspeak,trc}
  function evaluate(doc, sig, rules, today, units) {
    const R = Object.assign({}, RULES, rules || {}); for (const k of ['w', 'score', 'tgi', 'peak', 'oms', 'life']) R[k] = Object.assign({}, RULES[k], (rules || {})[k] || {});
    sig = sig || {}; today = today || new Date().toISOString().slice(0, 10);
    const key = (lid, km, ci) => lid + '|' + km + '|' + ci;
    const at = {}; const put = (lid, km, m, o) => { const k = key(lid, +km, cellOf(m)); (at[k] = at[k] || []).push(o); };
    // TRC: per km only the newest run counts
    const newest = {}; const nk = (lid, km) => lid + '|' + km;
    for (const p of sig.peaks || []) { const k = nk(p[0], p[1]); if (!newest[k] || String(p[7] || '') > newest[k]) newest[k] = String(p[7] || ''); }
    for (const b of sig.blocks || []) { const k = nk(b[0], b[1]); if (!newest[k] || String(b[8] || '') > newest[k]) newest[k] = String(b[8] || ''); }
    for (const p of sig.peaks || []) if (String(p[7] || '') === newest[nk(p[0], p[1])]) put(p[0], p[1], +p[2] - +p[1] * 1000, { t: 'peak', p });   // TRCPeaks.Pos = km*1000 + m
    for (const b of sig.blocks || []) if (String(b[8] || '') === newest[nk(b[0], b[1])]) { const k = key(b[0], +b[1], Math.max(0, Math.min(4, (+b[2] || 1) - 1))); (at[k] = at[k] || []).push({ t: 'block', b }); }
    for (const i of sig.items || []) put(i[0], i[1], i[2], { t: 'item', i });
    for (const f of sig.fract || []) put(f[0], f[1], f[2], { t: 'fract', f });
    for (const j of sig.jobs || []) put(j[0], j[1], j[2], { t: 'job', j });
    const segs = (units || []).map(u => ({ unit: u.unit, lid: u.lid, a: Math.min(+u.a, +u.b), b: Math.max(+u.a, +u.b) }));
    const unitOf = (lid, km, ci) => { const pos = km * 1000 + ci * 200 + 100; for (const s of segs) if (s.lid === lid && pos >= s.a && pos < s.b) return s.unit; return ''; };
    const fractSince = addM(today, -R.fractMonths);
    const out = [];
    (doc.lines || []).forEach((L, li) => {
      const tgk = {}; for (const t of L.t || []) tgk[t[0]] = t;
      const ffr = {}; for (const x of L.f || []) { const k = x[3] + '|' + cellOf(x[4]); (ffr[k] = ffr[k] || []).push(x); }
      for (const a of L.c || []) {
        const c = cellObj(a); const st = {}, why = {}; const add = (s, lv, txt) => { st[s] = worse(st[s], lv); if (txt) (why[s] = why[s] || []).push([lv, txt]); };
        const here = at[key(L.lid, c.km, c.ci)] || [];
        // geometry: TMS TGI of the km (TMS figure) + peaks / blocks of the newest TRC run in this 200 m
        const t = tgk[c.km];
        if (t && t[2][0]) {
          const [v, d] = t[2][0]; const prev = t[2][1];
          const lv = v < R.tgi.urgent ? 'Urgent' : v < R.tgi.act ? 'Act' : v < R.tgi.watch ? 'Watch' : 'Good';
          add('geo', lv, `TMS TGI ${v} on km ${c.km}${d ? ' (run ' + d + ')' : ''}${prev && prev[0] - v >= R.tgiDrop ? `, falling from ${prev[0]}` : ''}`);
        }
        for (const h of here) {
          if (h.t === 'peak') { const p = h.p; const lv = R.peak[p[5]]; if (lv) add('geo', lv, `${p[5]} peak ${p[3]} ${p[4]} at ${p[1]}/${Math.round(+p[2] - +p[1] * 1000)} (run ${p[6]})`); }
          if (h.t === 'block') { const b = h.b; if (b[3] === 'N') add('geo', 'Act', `block ${b[1]}/${b[2]} beyond CBML (run ${b[7]})`); else if (b[4] === 'N') add('geo', 'Act', `block ${b[1]}/${b[2]} MI beyond limit (run ${b[7]})`); else if (+b[5] >= R.blockRisk) add('geo', 'Watch', `block ${b[1]}/${b[2]} at risk ${(+b[5]).toFixed(2)} (run ${b[7]})`); }
        }
        if (st.geo == null && (t || (sig.has && sig.has.trc && sig.has.trc[L.lid]))) st.geo = 'Good';
        // ride: OMS peaks (open in TMS) in this 200 m
        for (const h of here) if (h.t === 'item' && h.i[3] === 'OMSPEAK') { const g = +h.i[7]; const lv = g >= R.oms.urgent ? 'Urgent' : g >= R.oms.act ? 'Act' : g >= R.oms.watch ? 'Watch' : null; if (lv) add('ride', lv, `OMS peak ${g} g${h.i[4] ? ' ' + h.i[4] : ''}${h.i[6] ? ' (' + h.i[6] + ')' : ''}`); }
        if (st.ride == null && sig.has && sig.has.omspeak) st.ride = 'Good';
        // rail: USFD rail defects, fractures, GMT carried vs rail life (TMS), last USFD test (TMS)
        for (const h of here) {
          if (h.t === 'item' && h.i[3] === 'USFD' && h.i[4] === 'RAIL') { const s = String(h.i[5] || '').toUpperCase(); const lv = /^IMR/.test(s) ? 'Urgent' : 'Watch'; add('rail', lv, `USFD rail defect ${s || '?'} at ${h.i[1]}/${h.i[2]}`); }
          if (h.t === 'fract' && String(h.f[4] || '') >= fractSince) add(/WELD/i.test(h.f[3]) ? 'weld' : 'rail', 'Act', `${/WELD/i.test(h.f[3]) ? 'weld' : 'rail'} fracture ${h.f[4]} at ${h.f[1]}/${h.f[2]}`);
        }
        for (const x of ffr[c.km + '|' + c.ci] || []) if (x[2] && x[2] >= fractSince) add(/weld/i.test(x[0]) ? 'weld' : 'rail', 'Act', `TMS: ${String(x[0]).toLowerCase()} fracture ${x[2]} ${x[1]} at ${x[3]}/${x[4]}`);
        const life = R.life[c.rs];
        if (c.cg != null && life) { const f = c.cg / life; if (f >= 1) add('rail', 'Act', `rail has carried ${c.cg} GMT – life ${life} GMT reached (TMS)`); else if (f >= R.lifeWatch) add('rail', 'Watch', `rail has carried ${c.cg} of ${life} GMT (TMS)`); }
        if (c.ut && daysBetween(c.ut, today) > R.usfdDays) add('rail', 'Watch', `last USFD test ${c.ut} (TMS) – over ${R.usfdDays} days`);
        if (st.rail == null && (c.cg != null || c.ut || c.rl)) st.rail = 'Good';
        // welds: USFD weld defects, DFWR, untested AT welds, joggled, O&G overdue
        for (const h of here) if (h.t === 'item') {
          const k = h.i[3], s = String(h.i[5] || '').toUpperCase();
          if (k === 'USFD' && h.i[4] === 'WELD') add('weld', /^IMR/.test(s) ? 'Urgent' : /^DFW/.test(s) ? 'Act' : 'Watch', `USFD weld defect ${s || '?'} at ${h.i[1]}/${h.i[2]}`);
          if (k === 'DFWR') add('weld', 'Act', `DFWR weld at ${h.i[1]}/${h.i[2]}`);
          if (k === 'UNTESTED') add('weld', 'Watch', `AT weld not yet USFD tested at ${h.i[1]}/${h.i[2]}`);
          if (k === 'JOG') add('weld', 'Watch', `joggled fish-plated weld at ${h.i[1]}/${h.i[2]}`);
          if (k === 'OG') add('weld', 'Watch', `oiling & greasing overdue at ${h.i[1]}/${h.i[2]}`);
        }
        if (st.weld == null && sig.has && sig.has.usfd) st.weld = 'Good';
        // track structure: deep screening age, weak formation, critical location (TMS)
        if (c.ds) { const yrs = daysBetween(c.ds, today) / 365.25; if (yrs > R.dsYears) add('struct', 'Watch', `deep screened ${c.ds} (TMS) – ${Math.floor(yrs)} years ago`); }
        if (c.wf) add('struct', 'Watch', 'weak formation (TMS)');
        if (c.cl) add('struct', 'Watch', `critical location: ${c.cl} (TMS)`);
        if (st.struct == null && (c.ds || c.sl)) st.struct = 'Good';
        // attention: open jobs here, LNA, speed restriction in force
        for (const h of here) {
          if (h.t === 'job') { const j = h.j; add('attn', j[4] ? 'Act' : +j[5] === 1 ? 'Act' : 'Watch', `job ${j[6]} ${j[3]}${j[4] ? ' – overdue' : ''}`); }
          if (h.t === 'item' && h.i[3] === 'LNA') add('attn', 'Watch', `location needing attention${h.i[6] ? ' (' + h.i[6] + ')' : ''}`);
        }
        if (c.sr) add('attn', 'Watch', `speed restriction ${c.sr} km/h (TMS)`);
        if (st.attn == null) st.attn = 'Good';
        // combined index: weighted score of the signals that have data; any Urgent caps it
        let sw = 0, ss = 0, lvl = null;
        for (const [k] of SIG) { if (st[k] == null) continue; sw += R.w[k] || 0; ss += (R.w[k] || 0) * R.score[st[k]]; lvl = worse(lvl, st[k]); }
        let idx = sw ? ss / sw : null; if (idx != null && lvl === 'Urgent') idx = Math.min(idx, R.cap);
        out.push({ li, lid: L.lid, km: c.km, ci: c.ci, c, unit: unitOf(L.lid, c.km, c.ci), st, why, idx: idx == null ? null : Math.round(idx), lvl });
      }
    });
    return out;
  }
  function rollup(cells, by) {
    const g = {};
    for (const x of cells) { const k = by(x); if (k == null) continue; const o = g[k] = g[k] || { key: k, n: 0, sum: 0, cnt: 0, Good: 0, Watch: 0, Act: 0, Urgent: 0 }; o.n++; if (x.idx != null) { o.sum += x.idx; o.cnt++; } if (x.lvl) o[x.lvl]++; }
    return Object.values(g).map(o => Object.assign(o, { idx: o.cnt ? Math.round(o.sum / o.cnt) : null, km: +(o.n * 0.2).toFixed(1) }));
  }
  return { P, kmOf, mOf, cellOf, dateOf, parseChart, parseGmt, buildDoc, evaluate, rollup, RULES, LV, SIG, CF, cellObj, worse };
})();


// ===== engine/watch.js
// HWH Track Portal – shared engine, part 9: BLIND-SPOT WATCH + HIDDEN FINDINGS (batch B1, 03-Nov-2026; project doc HWH_Portal_LANDING.md).
// A RULE REGISTRY: each rule = {id, group B|H|A, en, hi, rule (one line), needs (data kinds), thresholds (keys of settings.watch), run(ctx)}.
// The screens only iterate PE.WATCH_RULES and the stored results – a new rule is added here (or pushed by a later file) without touching them.
// Only EXACTLY placed events count in place-based rules; block-section / station-only ("approx") events never do.
// The whole watch is computed in the admin's browser from the stored history files and saved as one small file (kind "watch").
var PE = (typeof PE !== 'undefined' && PE) || {};
(function (PE) {
  'use strict';
  var lin = function (km, m) { return (+km) * 1000 + (+m || 0); };
  var monthOf = function (d) { return String(d || '').slice(0, 7); };
  function lastMonths(today, n) { var out = [], y = +today.slice(0, 4), m = +today.slice(5, 7); for (var i = n - 1; i >= 0; i--) { var mm = m - i, yy = y; while (mm < 1) { mm += 12; yy--; } out.push(yy + '-' + PE.p2(mm)); } return out; }
  function monthEnd(ym) { var y = +ym.slice(0, 4), m = +ym.slice(5, 7); var d = new Date(Date.UTC(y, m, 0)); return d.toISOString().slice(0, 10); }
  function isoWeek(d) { var t = new Date(d + 'T00:00:00Z'); var day = (t.getUTCDay() + 6) % 7; t.setUTCDate(t.getUTCDate() - day + 3); var f = new Date(Date.UTC(t.getUTCFullYear(), 0, 4)); return t.getUTCFullYear() + '-W' + PE.p2(1 + Math.round(((t - f) / 864e5 - 3 + ((f.getUTCDay() + 6) % 7)) / 7)); }
  PE.isoWeek = isoWeek; PE.lastMonths = lastMonths;

  // ---------------------------------------------------------------- the 200 m stretches (cells) of the division, with their unit
  /** cells from the health files: [{key, lid, km, ci, cg, rs, tgi:[[v, date]...]}]; units: feed units (level 2 = in-charge) */
  PE.watchCells = function (healthGroups, units) {
    var cells = [], byKey = {}, byLid = {}, byKm = {};
    var segs = (units || []).filter(function (u) { return u.lid && u.a && u.b; }).sort(function (a, b) { return (a.level === 2 ? 0 : 1) - (b.level === 2 ? 0 : 1); });
    (healthGroups || []).forEach(function (g) {
      (g && g.lines || []).forEach(function (L) {
        var tg = {}; (L.t || []).forEach(function (t) { tg[t[0]] = t[2]; });
        var fr = (L.f || []).map(function (x) { return { type: x[0], side: x[1], d: x[2], km: +x[3], m: +x[4] }; });
        (L.c || []).forEach(function (a) {
          var km = a[0], ci = a[1], pos = PE.P(km, ci * 200 + 100);
          // [B3a] the chart's line extent is padded to the section's range: a 200 m cell with no rail, GMT, tamping or TGI data is not track of this line
          var nz = function (v) { return v != null && v !== '' && v !== '0' && v !== '-'; };   // TMS fills a line's unknown stretch with '0' (e.g. SKG–BWN UP 1 at 95–106.5 km)
          if (!nz(a[2]) && a[5] == null && !nz(a[7])) return;   // [C] an old TGI value alone (e.g. SKG–BWN DN 1, 2021) is not track of this line
          var u = null; for (var i = 0; i < segs.length; i++) { var s = segs[i]; if (s.lid === L.lid && PE.P(s.a[0], s.a[1]) <= pos && pos < PE.P(s.b[0], s.b[1])) { u = s; break; } }
          var c = { key: L.lid + '|' + km + '|' + ci, lid: L.lid, km: km, ci: ci, rs: a[2], cg: a[5], lt: a[7], ds: a[9], tgi: tg[km] || null, unit: u ? u.unit : '', aen: u ? u.aen : '', srden: u ? u.srden : '' };
          cells.push(c); byKey[c.key] = c; (byLid[L.lid] = byLid[L.lid] || []).push(c); var bk = byKm[L.lid] = byKm[L.lid] || {}; (bk[km] = bk[km] || []).push(c);
        });
        if (byLid[L.lid]) byLid[L.lid].fr = fr;
      });
    });
    return { list: cells, byKey: byKey, byLid: byLid, byKm: byKm };
  };
  /** the cells an event covers (exact km range); [] when not placed exactly */
  PE.cellsOf = function (C, lid, km, m, km2, m2) {
    var L = C.byLid[lid]; if (!L || km == null) return [];
    var a = lin(km, m), b = lin(km2 != null ? km2 : km, m2 != null ? m2 : m); if (b < a) { var t = a; a = b; b = t; }
    var out = [], K = C.byKm && C.byKm[lid];
    if (K) {   // [B3a] by km (fast): only the km the event touches
      var k0 = Math.floor(a / 1000) - 1, k1 = Math.floor(b / 1000);
      if (k1 - k0 > 60) { var ks = C.kmKeys && C.kmKeys[lid]; if (!ks) { ks = Object.keys(K).map(Number).sort(function (p, q) { return p - q; }); (C.kmKeys = C.kmKeys || {})[lid] = ks; } var kk = ks.filter(function (x) { return x >= k0 && x <= k1; }); for (var z = 0; z < kk.length; z++) { var A2 = K[kk[z]]; for (var j2 = 0; j2 < A2.length; j2++) { var y = A2[j2], y0 = lin(y.km, y.ci * 200), y1 = y.ci === 4 ? lin(y.km + 1, 0) - 1 : y0 + 199; if (y0 <= b && a <= y1) out.push(y); } } return out; }
      for (var k = k0; k <= k1; k++) { var A = K[k]; if (!A) continue; for (var j = 0; j < A.length; j++) { var x = A[j], x0 = lin(x.km, x.ci * 200), x1 = x.ci === 4 ? lin(x.km + 1, 0) - 1 : x0 + 199; if (x0 <= b && a <= x1) out.push(x); } }
      return out;
    }
    for (var i = 0; i < L.length; i++) { var c = L[i], c0 = lin(c.km, c.ci * 200), c1 = c.ci === 4 ? lin(c.km + 1, 0) - 1 : c0 + 199; if (c0 <= b && a <= c1) out.push(c); }
    return out;
  };
  /** contiguous cells -> stretches {lid, km, m, km2, m2, n, unit} */
  function stretches(cells) {
    var by = {}; cells.forEach(function (c) { (by[c.lid] = by[c.lid] || []).push(c); });
    var out = [];
    Object.keys(by).forEach(function (lid) {
      var L = by[lid].sort(function (a, b) { return a.km - b.km || a.ci - b.ci; }); var cur = null;
      L.forEach(function (c) {
        var nx = cur && ((c.km === cur.lk && c.ci === cur.lci + 1) || (c.km === cur.lk + 1 && c.ci === 0 && cur.lci === 4));
        if (nx && c.unit === cur.unit) { cur.lk = c.km; cur.lci = c.ci; cur.n++; cur.km2 = c.km; cur.m2 = c.ci * 200 + 200; }
        else { if (cur) out.push(cur); cur = { lid: lid, km: c.km, m: c.ci * 200, km2: c.km, m2: c.ci * 200 + 200, n: 1, unit: c.unit, lk: c.km, lci: c.ci }; }
      });
      if (cur) out.push(cur);
    });
    return out.map(function (s) { delete s.lk; delete s.lci; if (s.m2 >= 1000) { s.km2 = s.km2 + 1; s.m2 = 0; } return s; });
  }
  PE.stretches = stretches;

  // ---------------------------------------------------------------- the registry
  var ltOfPk = function (p) { return p.fmc ? p.fmc.ltp : p.ws && p.ws[0] ? p.ws[0].ltp : null; };
  var lsOfPk = function (p) { return p.fmc ? p.fmc.ltsub : p.ws && p.ws[0] ? p.ws[0].ltsub : ''; };
  PE.WATCH_RULES = [];
  PE.addWatchRule = function (r) { PE.WATCH_RULES = PE.WATCH_RULES.filter(function (x) { return x.id !== r.id; }); PE.WATCH_RULES.push(r); return r; };
  var R = PE.addWatchRule;

  // B1 – not recorded: no TRC run over the 200 m within settings.watch.trcDays (OMS later)
  // [C] TRC interval by sanctioned sectional speed (TMS Control units, else TMS's run list): >130 km/h 2 months, >110–130 3, >100–110 4,
  // up to 100 6 months (settings.watch.trcBySpeed); "due" within the grace (settings.watch.trcGraceDays, 1 month), "overdue" beyond it.
  PE.trcInterval = function (W, sp) { if (sp == null || !(+sp > 0)) return null; var T = W.trcBySpeed || [{ above: 130, days: 61 }, { above: 110, days: 91 }, { above: 100, days: 122 }, { above: 0, days: 183 }]; for (var i = 0; i < T.length; i++) if (+sp > T[i].above) return T[i].days; return T[T.length - 1].days; };
  R({ id: 'B1', group: 'B', views: ['main', 'all'], en: 'Not recorded by TRC in time', hi: 'TRC रिकॉर्डिंग समय पर नहीं', rule: 'No TRC (track recording car) run over the 200 m within the interval for the line\'s sectional speed: above 130 km/h 2 months, above 110 3, above 100 4, up to 100 6 months; overdue = more than 1 month past the interval', needs: ['trcRuns', 'health'], later: ['omsRuns'], thresholds: ['trcBySpeed', 'trcGraceDays'], unitText: 'stretches of 200 m',
    run: function (X) {
      var W = X.W, today = X.today; var last = {}, all = {}; var g = W.trcGraceDays != null ? W.trcGraceDays : 30;
      X.trc.forEach(function (r) { PE.cellsOf(X.C, r.lid, r.km, r.m, r.km2, r.m2).forEach(function (c) { (all[c.key] = all[c.key] || []).push(r.d); if (!last[c.key] || r.d > last[c.key]) last[c.key] = r.d; }); });
      X.cellLastTrc = last;
      var spd = X.speedOf || {}; var iv = function (c) { return PE.trcInterval(W, spd[c.lid]); };
      var known = X.C.list.filter(function (c) { return iv(c) != null; }); X.speedUnknown = X.C.list.filter(function (c) { return iv(c) == null; });
      var state = function (c, d) { var l = last[c.key], I = iv(c); if (!l || l > d) return 'overdue'; var a = PE.daysBetween(l, d); return a <= I ? 'in time' : a <= I + g ? 'due' : 'overdue'; };
      X.trcState = function (c) { return iv(c) == null ? 'speed unknown' : state(c, today); };
      var bad = known.filter(function (c) { return state(c, today) === 'overdue'; }), due = known.filter(function (c) { return state(c, today) === 'due'; });
      var monthly = lastMonths(today, 12).map(function (ym) { var e = monthEnd(ym); if (e > today) e = today; return [ym, known.filter(function (c) { var ds = (all[c.key] || []).filter(function (d) { return d <= e; }); var l = ds.sort().pop(); var I = iv(c); return !l || PE.daysBetween(l, e) > I + g; }).length]; });
      return { cells: bad, records: stretches(bad).map(function (s) { var c = X.C.byKey[s.lid + '|' + s.km + '|' + (s.m / 200)]; var l = c && last[c.key]; var I = c && iv(c); s.text = (l ? 'last TRC run ' + PE.ist(l) + ' – ' + PE.daysBetween(l, today) + ' days ago' : 'no TRC run in TMS\'s run list since Mar-2023') + '; interval ' + Math.round(I / 30.4) + ' months for ' + spd[s.lid] + ' km/h'; return s; }),
        monthly: monthly, extra: { due: due.length, dueKm: Math.round(due.length * 0.2), speedUnknown: X.speedUnknown.length }, note: due.length + ' more stretches due within the 1-month grace', dataOf: ['tms'] };
    } });
  // B2 – not inspected
  R({ id: 'B2', group: 'B', en: 'Not inspected', hi: 'निरीक्षण नहीं हुआ', rule: 'No trolley / foot / footplate inspection over the stretch in time', needs: ['inspections'], thresholds: [], unitText: 'stretches' });
  // B3 – card closed, nothing done
  R({ id: 'B3', group: 'B', en: 'Closed, nothing done', hi: 'बंद, कार्य दर्ज नहीं', rule: 'Spot card closed in TMS with no action recorded (cards whose details are fetched)', needs: ['spotCards'], thresholds: [], unitText: 'cards',
    run: function (X) {
      var since = PE.addDays(X.today, -365);
      var L = X.cards.filter(function (c) { return c.st === 'closed' && c.act !== undefined && !c.act && (c.cmp || c.d16 || c.d) >= since; });
      var months = lastMonths(X.today, 12);
      return { records: L.map(function (c) { return { lid: c.lid, km: c.km, m: c.m, unit: c.u, lt: c.ltp, ls: c.ltsub, d: c.cmp || c.d16, text: c.src + ' card "' + c.ob + '" closed ' + (c.cmp || c.d16) + ' – action blank', id: c.id }; }), count: L.length, unitOf: function (r) { return r.unit; },
        monthly: months.map(function (ym) { return [ym, L.filter(function (c) { return monthOf(c.cmp || c.d16) === ym; }).length]; }), note: X.detailShare < 1 ? 'only cards whose details are fetched (' + Math.round(X.detailShare * 100) + ' %)' : '', dataOf: ['tms'] };
    } });
  // B4 – done, not in TMS
  R({ id: 'B4', group: 'B', en: 'Done, not in TMS', hi: 'कार्य हुआ, TMS में नहीं', rule: 'Field Mini Control work with proof, no matching TMS work site (date ± 1 day, unit, line, km)', needs: ['fmc', 'workSite'], thresholds: [], unitText: 'works',
    run: function (X) {
      var L = X.pk.filter(function (p) { return p.outcome === 'sheet only'; });
      return { records: L.map(function (p) { return { lid: p.lid, km: p.km, m: p.m, approx: p.approx, unit: p.u, d: p.date, lt: ltOfPk(p), ls: lsOfPk(p), text: (p.type || 'work') + ' – ' + (p.fmc && p.fmc.bs || '') + ' ' + (p.fmc && p.fmc.line || '') + ' – in Field Mini Control, not in TMS work sites', go: { view: 'reg', arg: 'sheet only' } }; }), count: L.length, unitOf: function (r) { return r.unit; },
        monthly: lastMonths(X.today, 12).map(function (ym) { return [ym, X.fmcCovered[ym] ? L.filter(function (p) { return monthOf(p.date) === ym; }).length : null]; }), dataOf: ['fmc', 'tms'] };
    } });
  // B5 – in TMS, no proof
  R({ id: 'B5', group: 'B', en: 'In TMS, no proof', hi: 'TMS में, प्रमाण नहीं', rule: 'TMS work site with no Field Mini Control proof, or proof without certificates / photos', needs: ['fmc', 'workSite'], thresholds: [], unitText: 'work sites',
    run: function (X) {
      var L = X.pk.filter(function (p) { return p.outcome === 'tms only' || (p.outcome === 'matched' && PE.proofMissing(p.fmc).length); });
      return { records: L.map(function (p) { return { lid: p.lid, km: p.km, m: p.m, unit: p.u, d: p.date, lt: ltOfPk(p), ls: lsOfPk(p), text: (p.type || '') + (p.outcome === 'tms only' ? ' – no sheet proof' : ' – missing ' + PE.proofMissing(p.fmc).map(PE.proofName).join(', ')), go: { view: 'reg', arg: p.outcome } }; }), count: L.length, unitOf: function (r) { return r.unit; },
        monthly: lastMonths(X.today, 12).map(function (ym) { return [ym, X.fmcCovered[ym] ? L.filter(function (p) { return monthOf(p.date) === ym; }).length : null]; }), dataOf: ['fmc', 'tms'] };
    } });
  // B6 – bad but untouched
  R({ id: 'B6', group: 'B', views: ['main', 'all'], en: 'Bad but untouched', hi: 'खराब, पर कोई कार्यवाही नहीं', rule: 'TMS track geometry index of the km below the limit, and in 12 months no card, no work, no open job / plan in the 200 m', needs: ['health', 'spotCards'], thresholds: ['b6TgiBelow', 'b6Months'], unitText: 'stretches',
    run: function (X) {
      var W = X.W, since = PE.addDays(X.today, -Math.round(W.b6Months * 30.4)); var touched = {};
      X.cards.forEach(function (c) { if ((c.d || '') >= since || c.st === 'open') PE.cellsOf(X.C, c.lid, c.km, c.m).forEach(function (x) { touched[x.key] = 1; }); });
      X.work.forEach(function (w) { if ((w.d || '') >= since) PE.cellsOf(X.C, w.lid, w.km, w.m, w.km2, w.m2).forEach(function (x) { touched[x.key] = 1; }); });
      X.jobs.forEach(function (j) { if (!/closed|verified|deleted/i.test(j.st || '')) PE.cellsOf(X.C, j.lid, j.km, j.m, j.km2, j.m2).forEach(function (x) { touched[x.key] = 1; }); });
      var bad = X.C.list.filter(function (c) { return c.tgi && c.tgi[0] && c.tgi[0][0] < W.b6TgiBelow && !touched[c.key]; });
      return { cells: bad, records: stretches(bad).map(function (s) { var c = X.C.byKey[s.lid + '|' + s.km + '|' + (s.m / 200)]; s.text = 'TMS TGI ' + (c && c.tgi ? c.tgi[0][0] + ' (run ' + (c.tgi[0][1] || '?') + ')' : '?') + ' – no card, no work, no plan in ' + W.b6Months + ' months'; return s; }), snapshot: true, dataOf: ['tms'] };
    } });
  // B7 – data missing
  // [C] B7 = missing in TMS (the unit fixes it in TMS / the sheet); B8 = not placed by the portal (admin: settings, mast list, speed …)
  R({ id: 'B7', group: 'B', en: 'Missing in TMS', hi: 'TMS में अनुपलब्ध', rule: 'Data TMS should hold but does not: linear data missing; ballast register clean cushion 0 / blank, clean more than total, clean = total = 50 (possibly cm), low cushion without screening date; Field Mini Control days not filled', needs: ['condition'], later: ['ballastCushion'], thresholds: [], unitText: 'items',
    run: function (X) {
      var miss = {}, why = {}; X.cond.filter(function (c) { return c.k === 'missing'; }).forEach(function (c) { PE.cellsOf(X.C, c.lid, c.km, c.m, c.km2, c.m2).forEach(function (x) { miss[x.key] = x; why[x.key] = 'TMS: linear data missing (' + (c.f || 'feature') + ')'; }); });
      var other = [];
      var place = function (b) { return b.lid ? null : b.stn + ' yard, ' + (b.yl || 'line ?') + ' ' + PE.fmtKm(b.km, b.m) + '–' + PE.fmtKm(b.km2, b.m2); };
      var add = function (b, cause, txt) { other.push({ lid: b.lid, km: b.lid ? b.km : null, m: b.m, km2: b.lid ? b.km2 : null, m2: b.m2, where: place(b), unit: b.unit || '', lt: b.ltp, ls: b.ltsub, len: b.len, q: cause, text: (place(b) ? place(b) + ': ' : '') + txt + ' – TMS ballast register' }); };
      X.ballast.forEach(function (b) {
        if (!(b.cc > 0)) add(b, 'Ballast register: clean cushion ' + (b.cc === 0 ? '0' : 'blank'), 'clean cushion ' + (b.cc === 0 ? '0' : 'not entered in TMS') + (b.scr ? ' (screened ' + b.scr + ')' : ''));
        else if (b.tc > 0 && b.cc > b.tc) add(b, 'Ballast register: clean more than total', 'clean cushion ' + b.cc + ' mm more than total ' + b.tc + ' mm');
        else if (b.cc === 50 && b.tc === 50) add(b, 'Ballast register: clean = total = 50 (cm?)', 'clean = total = 50 – possibly entered in cm, left out of deep screening until checked');
        else if (b.low && !b.scr) add(b, 'Ballast register: screening date not entered', 'clean cushion ' + b.cc + ' mm, screening date not entered in TMS');
      });
      (X.days || []).filter(function (d) { return d.status === 'not filled'; }).forEach(function (d) { other.push({ unit: d.u, lt: null, d: d.date, q: 'Field Mini Control: day not filled', text: d.u + ' – ' + d.tab + ' ' + PE.ist(d.date) + ': not filled (all cells blank in the sheet)' }); });
      var cells = Object.keys(miss).map(function (k) { return miss[k]; });
      var recs = stretches(cells).map(function (s) { s.text = why[s.lid + '|' + s.km + '|' + (s.m / 200)] || 'missing in TMS'; s.q = 'TMS: linear data missing'; s.lt = 'main'; return s; }).concat(other);
      var q = {}; if (cells.length) q['TMS: linear data missing (200 m stretches)'] = cells.length; other.forEach(function (o) { q[o.q] = (q[o.q] || 0) + 1; });
      return { records: recs, count: cells.length + other.length, unitItems: cells.concat(other), causes: q, snapshot: true, dataOf: ['tms', 'fmc'] };
    } });
  R({ id: 'B8', group: 'B', en: 'Not placed by the portal', hi: 'पोर्टल द्वारा स्थान तय नहीं', rule: 'Records the portal could not place or classify: line name not typed (Settings → line types), sectional speed unknown, sheet record without a recognisable place or mast, mast not in the TMS mast list', needs: [], thresholds: [], unitText: 'items',
    run: function (X) {
      var out = [], q = {}; var add = function (cause, r) { q[cause] = (q[cause] || 0) + 1; if (out.length < 3000) out.push(Object.assign({ q: cause }, r)); };
      (X.unknown || []).forEach(function (u) { add('Line type unknown (' + u.kind + ')', { lid: u.lid || null, km: u.km, m: u.m, where: u.where || null, unit: u.unit || '', lt: null, text: u.why }); });
      if (X.speedUnknown && X.speedUnknown.length) stretches(X.speedUnknown).forEach(function (s) { add('Sectional speed unknown – TRC interval cannot be set', Object.assign(s, { lt: 'main', text: 'no sanctioned sectional speed for ' + s.lid + ' in TMS Control or TMS – B1 not judged here' })); });
      (X.unplaced || []).forEach(function (r) { add(r.cause, r); });
      return { records: out, count: Object.keys(q).reduce(function (a, k) { return a + q[k]; }, 0), causes: q, snapshot: true, dataOf: ['tms', 'fmc'] };
    } });
  // H1 – repeat, never fixed
  R({ id: 'H1', group: 'H', en: 'Repeat, never fixed', hi: 'बार-बार, कभी ठीक नहीं', rule: 'Same 200 m gets cards again and again in 12 months, each one closed', needs: ['spotCards'], thresholds: ['repeatCards', 'repeatMonths'], src: ['Spot cards', 'TMS work', 'Machine days', 'Field sheet'],
    run: function (X) {
      var W = X.W, since = PE.addDays(X.today, -Math.round(W.repeatMonths * 30.4)); var by = {};
      X.cards.forEach(function (c) { if ((c.d || '') < since) return; var cs = PE.cellsOf(X.C, c.lid, c.km, c.m); if (cs.length) (by[cs[0].key] = by[cs[0].key] || []).push(c); });
      var wByCell = {}; X.work.forEach(function (w) { if ((w.d || '') < since) return; PE.cellsOf(X.C, w.lid, w.km, w.m, w.km2, w.m2).forEach(function (x) { (wByCell[x.key] = wByCell[x.key] || []).push(w); }); });   // [B3a] once, not per cell
      var out = [];
      Object.keys(by).forEach(function (k) {
        var L = by[k]; var dates = {}; L.forEach(function (c) { dates[c.d] = 1; }); var nd = Object.keys(dates).length;
        if (nd < W.repeatCards || L.some(function (c) { return c.st === 'open'; })) return;
        var c0 = X.C.byKey[k]; var wk = wByCell[k] || [];
        out.push({ lid: c0.lid, km: c0.km, m: c0.ci * 200, unit: c0.unit, n: L.length, d: Object.keys(dates).sort().pop(),
          title: 'Same 200 m: ' + L.length + ' cards on ' + nd + ' dates – closed every time',
          tms: L.length + ' separate cards, each closed', seen: 'one spot, ' + nd + ' inspections in ' + W.repeatMonths + ' months; work recorded here: ' + (wk.length ? wk.length + ' (' + wk.map(function (w) { return w.what; }).filter(Boolean).slice(0, 2).join(', ') + ')' : 'none') + ' – look for the cause, not one more closure' });
      });
      out.sort(function (a, b) { return b.n - a.n; });
      return { records: out, count: out.length, unitOf: function (r) { return r.unit; }, dataOf: ['tms'] };
    } });
  // H2 – work didn't improve (TMS TGI per km: run before vs run after an exactly placed work)
  R({ id: 'H2', group: 'H', views: ['main', 'all'], en: 'Work didn\'t improve', hi: 'कार्य से सुधार नहीं', rule: 'Exactly placed work, but TMS\'s TGI of the km on the next run is not better than the run before (TGI: higher = better)', needs: ['health'], thresholds: ['h2WindowDays', 'h2MinGain'], src: ['Work (exact km)', 'TRC before / after'],
    run: function (X) {
      var W = X.W, out = [], seen = {};
      X.work.forEach(function (w) {
        if (!w.d || !w.geo) return;
        PE.cellsOf(X.C, w.lid, w.km, w.m, w.km2, w.m2).forEach(function (c) {
          var k = c.key + '|' + w.d; if (seen[k] || !c.tgi) return;
          var runs = c.tgi.filter(function (r) { return r[1]; }).slice().sort(function (a, b) { return String(a[1]).localeCompare(String(b[1])); });
          var before = runs.filter(function (r) { return r[1] < w.d; }).pop(), after = runs.filter(function (r) { return r[1] > w.d && PE.daysBetween(w.d, r[1]) <= W.h2WindowDays; })[0];
          if (!before || !after) return; seen[k] = 1;
          if (after[0] - before[0] < W.h2MinGain) out.push({ lid: c.lid, km: c.km, m: c.ci * 200, unit: c.unit, d: w.d, before: before[0], after: after[0],
            title: w.what + ' on ' + w.d + ' – TGI ' + before[0] + ' before, ' + after[0] + ' after',
            tms: w.src + ' shows the work done' + (w.src === 'TMS work site' ? '' : ''), seen: 'TGI of km ' + c.km + ': ' + before[0] + ' (run ' + before[1] + ') → ' + after[0] + ' (run ' + after[1] + ') – no gain from the work' });
        });
      });
      return { records: out, count: out.length, unitOf: function (r) { return r.unit; }, monthly: lastMonths(X.today, 12).map(function (ym) { return [ym, out.filter(function (r) { return monthOf(r.d) === ym; }).length]; }), dataOf: ['tms'] };
    } });
  // H3 – defect, no card
  R({ id: 'H3', group: 'H', views: ['main', 'all'], en: 'Defect, no card', hi: 'दोष, कार्ड नहीं', rule: 'ITMS / TRC exception at a place with no spot card (iTMS wear summaries: line level only, never a 200 m stretch)', needs: ['itmsDefects'], thresholds: [], src: ['ITMS reports', 'Spot cards'] });
  // H4 – paper before work
  R({ id: 'H4', group: 'H', en: 'Paper before work', hi: 'कार्य से पहले कागज़', rule: 'Card complied on a day with no TMS work site, machine day, app record or sheet work at that place (gang work not loaded yet)', needs: ['spotCards', 'workSite'], later: ['gangWork'], thresholds: [], src: ['Spot cards', 'TMS work', 'Machine days', 'Field sheet'],
    run: function (X) {
      var since = PE.addDays(X.today, -365); var day = {};
      X.work.forEach(function (w) { if (!w.d) return; PE.cellsOf(X.C, w.lid, w.km, w.m, w.km2, w.m2).forEach(function (c) { day[c.key + '|' + w.d] = 1; }); });
      var L = X.cards.filter(function (c) { return c.st === 'closed' && c.cmp && c.cmp >= since; });
      var out = L.filter(function (c) { var cs = PE.cellsOf(X.C, c.lid, c.km, c.m); return cs.length && !cs.some(function (x) { return day[x.key + '|' + c.cmp] || day[x.key + '|' + PE.addDays(c.cmp, -1)]; }); });
      var byU = {}; out.forEach(function (c) { (byU[c.u || '?'] = byU[c.u || '?'] || []).push(c); });
      var rec = Object.keys(byU).map(function (u) { var L2 = byU[u]; var c0 = L2[0]; return { unit: u, lid: c0.lid, km: c0.km, m: c0.m, n: L2.length, d: L2.map(function (c) { return c.cmp; }).sort().pop(),
        title: L2.length + ' cards complied on days with no recorded work at that place', tms: 'cards closed – looks fine', seen: 'no TMS work site, machine day, app record or sheet work there that day (gang work not loaded yet – check before acting)', places: L2.slice(0, 5).map(function (c) { return { lid: c.lid, km: c.km, m: c.m, d: c.cmp }; }) }; }).sort(function (a, b) { return b.n - a.n; });
      return { records: rec, count: out.length, unitOf: function (r) { return r.unit; }, note: X.detailShare < 1 ? 'cards with details only (' + Math.round(X.detailShare * 100) + ' %)' : '', dataOf: ['tms', 'fmc'] };
    } });
  // H5 – ageing unseen
  R({ id: 'H5', group: 'H', en: 'Ageing unseen', hi: 'पुरानी रेल, अनदेखी', rule: 'Rail near its GMT life and weld fractures nearby – renewal proposal to be checked', needs: ['health'], later: ['renewalDue'], thresholds: ['lifeWatch', 'h5Fractures', 'h5Months', 'h5NearKm'], src: ['GMT', 'Fractures (TMS chart)', 'Renewal due'],
    run: function (X) {
      var W = X.W, life = (X.S.rules && X.S.rules.life) || { '04': 800, '03': 525 }, since = PE.addDays(X.today, -Math.round(W.h5Months * 30.4)), out = [];
      Object.keys(X.C.byLid).forEach(function (lid) {
        var L = X.C.byLid[lid], fr = (L.fr || []).filter(function (f) { return /weld/i.test(f.type) && f.d && f.d >= since; }); if (fr.length < W.h5Fractures) return;
        var done = {};
        L.forEach(function (c) {
          var lf = life[c.rs]; if (!lf || c.cg == null || c.cg / lf < W.lifeWatch || done[c.km]) return;
          var near = fr.filter(function (f) { return Math.abs(f.km - c.km) <= W.h5NearKm; }); if (near.length < W.h5Fractures) return;
          done[c.km] = 1;
          out.push({ lid: lid, km: c.km, m: c.ci * 200, unit: c.unit, n: near.length, d: near.map(function (f) { return f.d; }).sort().pop(),
            title: 'Rail at ' + Math.round(c.cg / lf * 100) + ' % of GMT life, ' + near.length + ' weld fractures within ' + W.h5NearKm + ' km',
            tms: 'GMT register and fracture list, separately', seen: c.cg + ' of ' + lf + ' GMT carried; ' + near.length + ' weld fractures since ' + since + (X.has.renewalDue ? '' : ' – renewal proposals not loaded yet: check whether it is proposed') });
        });
      });
      return { records: out, count: out.length, unitOf: function (r) { return r.unit; }, dataOf: ['tms'] };
    } });
  // H6 – season pattern
  R({ id: 'H6', group: 'H', views: ['main', 'all'], en: 'Season pattern', hi: 'मौसमी स्वरूप', rule: 'Bad every monsoon, recovers in winter – from TQI history since 2019 and water logging', needs: ['tqiHistory'], later: ['waterLogging'], thresholds: [], src: ['TQI history', 'Water logging'] });
  // needs-action tiles (A)
  R({ id: 'A1', group: 'A', en: 'Deep screening needed', hi: 'डीप स्क्रीनिंग आवश्यक', rule: 'TMS ballast register: urgent = clean cushion < rules.byLineType.*.cushionUrgentMm (100), plan = up to < cleanCushionMm (150); 0 / blank and suspect values = B7', needs: ['ballastCushion'], thresholds: [], unitText: 'stretches',
    run: function (X) {
      var L = X.ballast.filter(function (b) { return b.low && !(b.cc === 50 && b.tc === 50); }).sort(function (a, b) { return a.cc - b.cc; });
      var sum = function (A) { return Math.round(A.reduce(function (a, b) { return a + (+b.len || 0); }, 0) * 10) / 10; };
      var U = L.filter(function (b) { return b.grade === 'urgent'; }), Pn = L.filter(function (b) { return b.grade === 'plan'; });
      return { records: L.map(function (b) {
          var where = b.lid ? null : b.stn + ' yard, ' + (b.yl || 'line ?') + (b.xo ? ' x-over ' + b.xo : '');
          return { lid: b.lid, km: b.lid ? b.km : null, m: b.m, km2: b.lid ? b.km2 : null, m2: b.m2, where: where, unit: b.unit || '', lt: b.ltp, ls: b.ltsub, cc: b.cc, scr: b.scr, len: b.len, grade: b.grade,
            text: (b.grade === 'urgent' ? 'URGENT · ' : 'plan · ') + (where ? where + ' ' + PE.fmtKm(b.km, b.m) + '–' + PE.fmtKm(b.km2, b.m2) + ': ' : '') + 'clean cushion ' + b.cc + ' mm' + (b.tc != null ? ' (total ' + b.tc + ')' : '') + ' · ' + (b.scr ? 'deep screened ' + b.scr + (b.how ? ' (' + b.how + ')' : '') : 'screening date missing in TMS') + (b.tc > 0 && b.cc > b.tc ? ' · clean > total – check' : '') + ' · source: TMS ballast register' };
        }), count: L.length, kmTotal: sum(L), extra: { urgent: U.length, plan: Pn.length, urgentKm: sum(U), planKm: sum(Pn), byUnit: L.reduce(function (o, b) { var u = b.unit || '?'; var x = o[u] = o[u] || { urgent: 0, plan: 0 }; x[b.grade]++; return o; }, {}) }, unitOf: function (r) { return r.unit; },
        note: (X.W.ballastNote ? X.W.ballastNote + ' · ' : '') + U.length + ' urgent (' + sum(U) + ' km) · ' + Pn.length + ' plan (' + sum(Pn) + ' km)', snapshot: true, dataOf: ['tms'] };
    } });
  R({ id: 'A2', group: 'A', views: ['main', 'all'], en: 'Tamping due', hi: 'टैम्पिंग देय', rule: 'TMS tamping due list (PML / CBML from TRC / TQI): stretches due + turnouts on the main line', needs: ['tampingDue'], thresholds: [], unitText: 'stretches',
    run: function (X) {
      var S2 = X.tamping.filter(function (t) { return t.k === 'stretch'; }), T2 = X.tamping.filter(function (t) { return t.k === 'turnout' && !/done/i.test(t.st || ''); });
      var km = Math.round(S2.reduce(function (a, b) { return a + (+b.len || 0); }, 0) * 10) / 10;
      var unitAt = function (t) { var cs = PE.cellsOf(X.Cu, t.lid, t.km, t.m); return cs[0] ? cs[0].unit : ''; };
      var recs = S2.map(function (t) { return { lid: t.lid, km: t.km, m: t.m, km2: t.km2, m2: t.m2, unit: unitAt(t), lt: 'main', len: t.len, text: 'due ' + (t.yard ? 'through ' + t.stn + ' yard' : 'block section') + ' · last tamping ' + (t.last || '—') + (t.mc ? ' (' + t.mc + ')' : '') + ' · TRC ' + (t.trc || '—') }; })
        .concat(T2.map(function (t) { return { lid: t.lid, km: t.km, m: t.m, unit: unitAt(t), lt: 'main', turnout: 1, text: 'turnout ' + t.pt + ' due · last tamping ' + (t.last || '—') }; }));
      return { records: recs, count: S2.length, kmTotal: km, unitItems: S2.map(function (t, i) { return recs[i]; }), extra: { turnouts: T2.length, stretches: S2.length, km: km }, note: S2.length + ' stretches (' + km + ' km) · ' + T2.length + ' turnouts on the main line due', snapshot: true, dataOf: ['tms'] };
    } });
  R({ id: 'A2L', group: 'A', views: ['loop'], en: 'Turnouts due tamping', hi: 'टर्नआउट टैम्पिंग देय', rule: 'Loop-line turnouts due tamping – TMS\'s tamping list names turnouts by section-line only', needs: ['loopTurnoutsDue'], thresholds: [] });
  R({ id: 'T1', group: 'T', views: ['main', 'all'], en: 'iTMS rail wear', hi: 'iTMS रेल घिसाव', rule: 'Lip flow / vertical / lateral wear: metres over each threshold, left and right rail, per line and run – line level only, never on a 200 m stretch', needs: ['itmsWear'], thresholds: [] });
  R({ id: 'A3', group: 'A', en: 'Open P1 / P2 spot cards', hi: 'खुले P1 / P2 कार्ड', rule: 'Spot cards of priority 1 or 2 still open in TMS', needs: ['spotCards'], thresholds: [],
    run: function (X) {
      var L = X.cards.filter(function (c) { return c.st === 'open' && (+c.p === 1 || +c.p === 2); });
      var months = lastMonths(X.today, 12);
      return { records: L.map(function (c) { return { lid: c.lid, km: c.km, m: c.m, unit: c.u, lt: c.ltp, ls: c.ltsub, d: c.d, p: +c.p, text: 'P' + c.p + ' ' + c.src + ': ' + c.ob, id: c.id }; }), count: L.length, unitOf: function (r) { return r.unit; },
        monthly: months.map(function (ym) { var e = monthEnd(ym); return [ym, X.cards.filter(function (c) { return (+c.p === 1 || +c.p === 2) && c.d && c.d <= e && (c.st === 'open' || (c.d16 && c.d16 > e)); }).length]; }), dataOf: ['tms'] };
    } });
  R({ id: 'A4', group: 'A', views: ['main', 'all'], en: 'Work that didn\'t hold', hi: 'कार्य जो टिका नहीं', rule: 'Same as H2: exact work with no TGI gain on the next run', needs: ['health'], thresholds: [],
    run: function (X) { var h = X.results.H2 || { records: [] }; return { records: h.records, count: h.records.length, unitOf: function (r) { return r.unit; }, monthly: h.monthly, dataOf: ['tms'] }; } });

  // ---------------------------------------------------------------- run everything
  /** D: {S, today, health:[groups], units, trc, cards, ws, fmc (located), feedWork, jobs, acRecent, mpRecent, cond, itms, loaded, fmcCoverage, dataAt:{tms, fmc, feed}, prev (previous watch file)} */
  PE.computeView = function (D) {
    var S = D.S || {}, W = Object.assign({}, S.watch || {}), today = D.today;
    var C = PE.watchCells(D.health, D.units);
    var has = {}; Object.keys(D.has || {}).forEach(function (k) { if (D.has[k]) has[k] = 1; });
    // exactly placed work events (the rules' "work"): TMS work sites, asset changes (rail / sleeper / ballast / weld), machine days placed exactly,
    // Field Mini Control records placed exactly, TMS Control work records. Approx never.
    var work = [];
    (D.ws || []).forEach(function (w) { if (w.lid && w.km != null) work.push({ lid: w.lid, km: w.km, m: w.m, km2: w.km2, m2: w.m2, d: w.d, src: 'TMS work site', what: w.sub || w.wt, geo: /tamp|ctr|tsr|trr|screen|bcm|destress|rail|sleeper|lifting|realign|pqrs/i.test(w.sub || '') }); });
    (D.acRecent || []).forEach(function (a) { if (a.lid && a.km != null && a.k !== 'pnx') work.push({ lid: a.lid, km: a.km, m: a.m, km2: a.km2, m2: a.m2, d: a.d, src: 'TMS asset change', what: a.k + ' change', geo: /sleeper|ballast/.test(a.k) }); });
    (D.mpRecent || []).forEach(function (r) { if (r.lid && r.km != null && !r.approx) work.push({ lid: r.lid, km: r.km, m: r.m, km2: r.km2, m2: r.m2, d: r.d, src: 'TMS machine progress', what: r.mc, geo: /tamp|unimat|duomatic|dtex|csm|09|ctr|bcm|utv/i.test(r.mc || '') }); });
    (D.fmc || []).forEach(function (r) { var w = r.where || {}; if (w.lid && !w.approx) work.push({ lid: w.lid, km: w.km, m: w.m, km2: w.km2, m2: w.m2, d: r.date, src: 'Field Mini Control', what: r.purpose || r.details || r.reason, geo: /tamp|unimat|duomatic|dtex|packing|utv|pqrs|screen|destress|rail/i.test((r.purpose || '') + ' ' + (r.details || '')) }); });
    (D.feedWork || []).forEach(function (r) { if (r.lid && r.km != null) work.push({ lid: r.lid, km: r.km, m: r.m, km2: r.km2, m2: r.m2, d: r.d, src: 'TMS Control work record', what: (r.types || []).join(', '), geo: /tamp|packing|screen|rail/i.test((r.types || []).join(' ')) }); });
    var cards = (D.cards || []).filter(function (c) { return c.lid && c.km != null; });
    var withDet = cards.filter(function (c) { return c.act !== undefined; }).length;
    // a 200 m stretch outside the feed's unit map takes the unit TMS itself names most often on that km (spot cards, work sites)
    var vote = {}; (D.voteCards || cards).concat(D.voteWs || D.ws || []).forEach(function (r) { if (!r.u || !r.lid || r.km == null) return; var k = r.lid + '|' + r.km; var o = vote[k] = vote[k] || {}; o[r.u] = (o[r.u] || 0) + 1; });
    var aenOf = {}; (D.voteWs || D.ws || []).forEach(function (w) { if (w.u && w.aen) aenOf[w.u] = PE.desig(w.aen) || w.aen; }); (D.units || []).forEach(function (u) { if (u.unit && u.aen) aenOf[u.unit] = u.aen; });
    C.list.forEach(function (c) { if (c.unit) return; var o = vote[c.lid + '|' + c.km]; if (!o) { for (var d = 1; d <= 3 && !o; d++) o = vote[c.lid + '|' + (c.km - d)] || vote[c.lid + '|' + (c.km + d)]; } if (!o) return; c.unit = Object.keys(o).sort(function (a, b) { return o[b] - o[a]; })[0]; c.aen = aenOf[c.unit] || ''; c.unitBy = 'tms'; });
    // [C] sanctioned sectional speed per section-line: TMS Control units first, else TMS's TRC run list
    var speedOf = {}; (D.units || []).forEach(function (u) { if (u.lid && +u.speed > 0) speedOf[u.lid] = Math.max(speedOf[u.lid] || 0, +u.speed); });
    var spT = {}; (D.voteTrc || D.trc || []).forEach(function (r) { if (r.lid && +r.sp > 0 && (!spT[r.lid] || r.d > spT[r.lid].d)) spT[r.lid] = { d: r.d, sp: +r.sp }; }); Object.keys(spT).forEach(function (l) { if (!speedOf[l]) speedOf[l] = spT[l].sp; });
    var Cu = C; if (D.view === 'loop') C = { list: [], byKey: {}, byLid: {} };   // [PB] B2: no 200 m chart stretches on loop lines; the main cells still give the units
    var pk = PE.buildPackages(D.fmc || [], D.ws || [], { ac: D.acRecent || [], mp: D.mpRecent || [], fw: D.feedWork || [], sc: [] }, { S: S, N: D.N, coverage: D.fmcCoverage || {} });
    var fmcCovered = {}; Object.keys(D.fmcCoverage || {}).forEach(function (d) { fmcCovered[monthOf(d)] = 1; });
    var unplaced = []; (D.fmc || []).forEach(function (r) { var w = r.where || {}; if (w.lid) return; var m = (r.masts || []).length; unplaced.push({ cause: m ? (w.how === 'mast' ? 'Sheet: mast not in the TMS mast list' : 'Sheet: mast given – TMS mast list not loaded') : 'Sheet: place not recognised', unit: r.u, d: r.date, lt: r.ltp, where: (r.bs || '') + ' ' + (r.line || ''), text: r.tab + ' ' + PE.ist(r.date) + ' – ' + (r.bs || 'no place') + ' ' + (r.line || '') + ': ' + (w.note || 'not placed') }); });
    var X = { unplaced: unplaced, speedOf: speedOf, view: D.view || 'all', Cu: Cu, unknown: D.unknown || [], days: D.days || [], tamping: D.tamping || [], S: S, W: W, today: today, C: C, has: has, trc: D.trc || [], cards: cards, detailShare: cards.length ? withDet / cards.length : 0, work: work, pk: pk, jobs: D.jobs || [], cond: D.cond || [], ballast: [], fmcCovered: fmcCovered, notPlaced: D.notPlaced || {}, results: {} };
    // [PB] B1a: ballast register stretches with their unit (running line: the unit of the first 200 m; station yard: the station's unit given by the page)
    var BT = (S.rules && S.rules.byLineType) || {};
    X.ballast = (D.ballast || []).map(function (b) {
      var o = Object.assign({}, b); if (b.lid) { var cs = PE.cellsOf(Cu, b.lid, b.km, b.m, b.km2, b.m2); o.unit = cs[0] ? cs[0].unit : ''; } else { var p = (D.stnPlace || {})[b.stn]; var c2 = p ? PE.cellsOf(Cu, p.lid, p.km, p.m) : []; o.unit = c2[0] ? c2[0].unit : ''; }
      var th = BT[b.ltp === 'main' ? 'main' : 'loop'] || {}; var plan = th.cleanCushionMm || (S.rules && S.rules.cleanCushionMm) || 150, urg = th.cushionUrgentMm || 100;
      o.low = b.cc > 0 && b.cc < plan; o.grade = !o.low ? null : b.cc < urg ? 'urgent' : 'plan'; return o;
    });
    var out = { v: 1, computedAt: D.now || new Date().toISOString(), today: today, dataAt: D.dataAt || {}, freshDays: W.freshDays || {}, cells: C.list.length, rules: [], units: {}, lines: [] };
    PE.WATCH_RULES.forEach(function (r) {
      if (r.views && D.view && r.views.indexOf(D.view) < 0) return;   // [PB] B2: TRC / TQI / ITMS rules run on the main line only
      var miss = (r.needs || []).filter(function (k) { return !has[k]; });
      var e = { id: r.id, group: r.group, en: r.en, hi: r.hi, rule: r.rule, needs: r.needs, later: r.later || [], thresholds: (r.thresholds || []).map(function (k) { return [k, W[k]]; }), src: r.src || [], unitText: r.unitText || '', status: !r.run ? 'waiting' : miss.length ? 'waiting' : 'ready', missing: !r.run && !miss.length ? (r.needs || []) : miss };
      if (e.status === 'ready') {
        try {
          var res = r.run(X); X.results[r.id] = res;
          var recs = res.records || [];
          e.count = res.cells ? res.cells.length : (res.count != null ? res.count : recs.length);
          e.km = res.cells ? Math.round(res.cells.length * 0.2 * 10) / 10 : (res.kmTotal != null ? res.kmTotal : null);
          e.byUnit = {}; (res.unitItems || res.cells || recs).forEach(function (x) { var u = x.unit || '?'; e.byUnit[u] = (e.byUnit[u] || 0) + (res.cells ? 1 : (x.n && r.id === 'H4' ? x.n : 1)); });
          if (r.id === 'H4') e.count = res.count;
          recs.forEach(function (x) { if (x.lt === undefined) x.lt = x.lid ? PE.lineTypeOfLid(x.lid, D.N).t : null; });
          e.special = {}; recs.forEach(function (x) { if (x.ls) e.special[x.ls] = (e.special[x.ls] || 0) + 1; });   // [PB] B2a: "incl. N avoiding / fly-over"
          e.records = recs.slice(0, W.maxRecords || 400); e.more = Math.max(0, recs.length - e.records.length);
          e.causes = res.causes || null; e.monthly = res.monthly || null; e.snapshot = !!res.snapshot; e.note = res.note || ''; e.extra = res.extra || null; e.dataOf = res.dataOf || ['tms'];
        } catch (err) { e.status = 'error'; e.error = String(err && err.message || err); }
      }
      out.rules.push(e);
    });
    // ---------- per-unit watch score: share of the unit's 200 m stretches / works where each AVAILABLE check is in time
    var lastTrc = X.cellLastTrc || {};
    var units = {}; C.list.forEach(function (c) { var u = c.unit || '?'; var o = units[u] = units[u] || { unit: u, aen: c.aen || aenOf[u] || '', srden: c.srden, cells: 0, trcOk: 0 }; o.cells++; if (X.trcState && X.trcState(c) === 'in time') o.trcOk++; });
    pk.forEach(function (p) { var u = p.u || '?'; var o = units[u] = units[u] || { unit: u, aen: aenOf[u] || '', cells: 0, trcOk: 0 }; if (p.outcome === 'not checked') return; if (p.fmc || p.outcome === 'tms only') { o.proofN = (o.proofN || 0) + 1; if (p.fmc && !PE.proofMissing(p.fmc).length) o.proofOk = (o.proofOk || 0) + 1; } if (p.fmc) { o.entryN = (o.entryN || 0) + 1; if (p.outcome === 'matched') o.entryOk = (o.entryOk || 0) + 1; } });
    var week = isoWeek(today); var prevW = (D.prev && D.prev.weekly) || {};
    Object.keys(units).forEach(function (u) {
      var o = units[u]; var comp = [];
      if (o.cells && has.trcRuns) comp.push({ k: 'TRC', share: o.trcOk / o.cells, n: o.cells });
      if (o.proofN) comp.push({ k: 'Work proof', share: (o.proofOk || 0) / o.proofN, n: o.proofN });
      if (o.entryN) comp.push({ k: 'TMS entry', share: (o.entryOk || 0) / o.entryN, n: o.entryN });
      o.components = comp.map(function (c) { return { k: c.k, pct: Math.round(c.share * 100), n: c.n }; });
      o.missing = ['Inspection (trolley / foot / footplate) – not loaded yet'].concat(has.trcRuns ? [] : ['TRC']).concat(o.proofN ? [] : ['Work proof – no work in the sheet days read']).concat(o.entryN ? [] : ['TMS entry – no sheet work']);
      o.score = comp.length ? Math.round(comp.reduce(function (a, c) { return a + c.share; }, 0) / comp.length * 100) : null;
    });
    out.units = units;
    out.weekly = JSON.parse(JSON.stringify(prevW)); out.weekly[week] = {}; Object.keys(units).forEach(function (u) { out.weekly[week][u] = units[u].score; });
    var wk = Object.keys(out.weekly).sort(); if (wk.length > 60) wk.slice(0, wk.length - 60).forEach(function (k) { delete out.weekly[k]; });
    // ---------- monthly snapshots of rules without history (B6, B7): kept from one computation to the next
    out.snapshots = JSON.parse(JSON.stringify((D.prev && D.prev.snapshots) || {}));
    out.rules.forEach(function (e) { if (e.status !== 'ready' || !e.snapshot) return; var m = monthOf(today); (out.snapshots[e.id] = out.snapshots[e.id] || {})[m] = e.count; e.monthly = lastMonths(today, 12).map(function (ym) { var v = out.snapshots[e.id][ym]; return [ym, v == null ? null : v]; }); });
    // ---------- coverage: track seen fully in time / partly / blind (with the checks available)
    var seen = 0, partly = 0, blind = 0; var b6 = {}; ((X.results.B6 || {}).cells || []).forEach(function (c) { b6[c.key] = 1; });
    C.list.forEach(function (c) { var st = X.trcState ? X.trcState(c) : 'overdue'; if (st === 'speed unknown') return; var t = st === 'in time'; if (t && !b6[c.key]) seen++; else if (t || st === 'due') partly++; else blind++; });
    out.coverage = { seen: seen, partly: partly, blind: blind, km: { seen: Math.round(seen * 0.2), partly: Math.round(partly * 0.2), blind: Math.round(blind * 0.2) }, basis: 'TRC run in time (and not "bad but untouched"); inspections and OMS added when loaded' };
    // ---------- who is watching each line
    var lineRows = {};
    C.list.forEach(function (c) { var o = lineRows[c.lid] = lineRows[c.lid] || { lid: c.lid, units: {}, cells: 0, worstTrc: null, never: 0 }; o.cells++; o.units[c.unit || '?'] = 1; var l = lastTrc[c.key]; if (!l) o.never++; else if (!o.worstTrc || l < o.worstTrc) o.worstTrc = l; });
    var itmsLast = {}; (D.itms || []).forEach(function (r) { if (r.lid && (!itmsLast[r.lid] || r.d > itmsLast[r.lid])) itmsLast[r.lid] = r.d; });
    pk.forEach(function (p) { if (!p.lid || !lineRows[p.lid] || p.outcome === 'not checked') return; var o = lineRows[p.lid]; if (p.fmc) { o.proofN = (o.proofN || 0) + 1; if (!PE.proofMissing(p.fmc).length) o.proofOk = (o.proofOk || 0) + 1; } if (p.outcome === 'sheet only') o.gaps = (o.gaps || 0) + 1; });
    out.lines = Object.keys(lineRows).sort().map(function (k) { var o = lineRows[k]; return { lid: k, units: Object.keys(o.units), cells: o.cells, trc: o.never ? { never: true, n: o.never } : { d: o.worstTrc, days: o.worstTrc ? PE.daysBetween(o.worstTrc, today) : null }, itms: itmsLast[k] ? { d: itmsLast[k], days: PE.daysBetween(itmsLast[k], today) } : null, proof: o.proofN ? Math.round((o.proofOk || 0) / o.proofN * 100) : null, gaps: o.gaps || 0 }; });
    if (D.view === 'loop') {   // [PB] B2: loop view – one row per station yard: cushion data, cards, work proof, TMS entry (no TRC / ITMS on loops)
      var st = {}; var row = function (k) { return st[k] = st[k] || { lid: k + ' yard', stn: k, units: {}, n: 0, measured: 0, km: 0, proofN: 0, proofOk: 0, gaps: 0, cards: 0 }; };
      X.ballast.forEach(function (b) { if (b.lid || !b.stn) return; var o = row(b.stn); o.n++; o.km += +b.len || 0; if (b.cc > 0) o.measured++; if (b.unit) o.units[b.unit] = 1; });
      pk.forEach(function (p) { if (!p.fmc || p.outcome === 'not checked') return; var k = String(p.fmc.bs || '').toUpperCase().split(/[\s\-\/.]/)[0]; if (!k) return; var o = row(k); o.proofN++; if (!PE.proofMissing(p.fmc).length) o.proofOk++; if (p.outcome === 'sheet only') o.gaps++; if (p.u) o.units[p.u] = 1; });
      out.lines = Object.keys(st).sort().map(function (k) { var o = st[k]; return { lid: o.lid, loop: true, units: Object.keys(o.units), cells: o.n, km: Math.round(o.km * 10) / 10, cushion: o.n ? { n: o.n, measured: o.measured, pct: Math.round(o.measured / o.n * 100) } : null, proof: o.proofN ? Math.round(o.proofOk / o.proofN * 100) : null, gaps: o.gaps }; });
      var yl = X.ballast.filter(function (b) { return !b.lid; });
      out.coverage = { loop: true, yardStretches: yl.length, km: Math.round(yl.reduce(function (a, b) { return a + (+b.len || 0); }, 0)), measured: yl.filter(function (b) { return b.cc > 0; }).length, basis: 'loop lines are judged on inspections (not loaded yet), cushion data, spot cards, work proof and TMS entry – no TRC / ITMS' };
    }
    // ---------- getting worse fastest (TMS TGI, newest run vs the oldest of its three) and TGI month by month per line
    var fast = []; C.list.forEach(function (c) { if (!c.tgi || c.tgi.length < 2 || c.ci !== 0) return; var a = c.tgi[0], z = c.tgi[c.tgi.length - 1]; if (a[1] && z[1] && a[0] < z[0]) fast.push({ lid: c.lid, km: c.km, unit: c.unit, tgi: a[0], drop: z[0] - a[0], from: z[1], to: a[1] }); });
    fast.sort(function (a, b) { return b.drop - a.drop; }); out.fast = fast.slice(0, 30);
    var heat = {}; var act = (S.rules && S.rules.tgi && S.rules.tgi.act) || 50;
    C.list.forEach(function (c) { if (c.ci !== 0 || !c.tgi) return; c.tgi.forEach(function (r) { if (!r[1]) return; var m = monthOf(r[1]); var o = (heat[c.lid] = heat[c.lid] || {}); var x = o[m] = o[m] || { n: 0, bad: 0 }; x.n++; if (r[0] < act) x.bad++; }); });
    out.heat = { act: act, lines: Object.keys(heat).sort().map(function (lid) { return { lid: lid, months: Object.keys(heat[lid]).sort().map(function (m) { return [m, heat[lid][m].n, heat[lid][m].bad]; }) }; }) };
    out.dataDates = D.dataAt || {};
    out.inputs = D.inputs || null;
    return out;
  };

  /** [PB] B2: the watch for the three line-type views. Every input record is classified (PE.lineType: main / loop / siding / unknown with its
   *  source); each view sees only its records (All = everything, unknown included); unknown ones are listed under B7 in every view.
   *  Returns the main-line view at the top level (older pages) + views {main, loop, all} + lineTypes (counts per kind). */
  PE.computeWatch = function (D) {
    var N = D.N; var counts = {}; var unknown = []; var names = {};
    if (D.pnx && PE.setPnx) PE.setPnx(D.pnx);
    var cls = function (list, kind, kindFn) {
      (list || []).forEach(function (r) {
        var k = kindFn ? kindFn(r) : kind; var o = PE.lineType(r, k, N); var c = counts[k] = counts[k] || { main: 0, loop: 0, siding: 0, unknown: 0, total: 0 };
        c.total++; c[o.t || 'unknown']++; if (o.sub) c[o.sub] = (c[o.sub] || 0) + 1;
        if (!o.t) { var nm = (o.src.match(/"([^"]+)"/) || [])[1] || o.src; var st = r.stn || (r.where && r.where.lid ? String(r.where.lid).split(' ')[0] : r.lid ? (N ? N.groupOf(r.lid) : '') : r.bs || ''); var key = k + '|' + st + '|' + nm; var x = names[key] = names[key] || { kind: k, station: st, name: nm, why: o.src.replace(/\d+(\.\d+)?/g, '#'), n: 0 }; x.n++; }
        if (!o.t && unknown.length < 3000) unknown.push({ kind: k, why: o.src, lid: r.lid || (r.where && r.where.lid) || null, km: r.km != null ? r.km : r.where && r.where.km, m: r.m != null ? r.m : r.where && r.where.m, unit: r.u || r.unit || '', where: r.stn ? r.stn + ' yard, ' + (r.yl || '') : (r.bs || null) });
      });
    };
    cls(D.trc, 'trcRuns'); cls(D.cards, 'spotCards'); cls(D.ws, 'workSite'); cls(D.acRecent, null, function (a) { return a.k === 'pnx' ? 'pnx' : 'assetChange'; });
    cls(D.mpRecent, 'machineProg'); cls(D.fmc, 'fmc'); cls(D.feedWork, 'feedWork'); cls(D.jobs, 'feedJobs'); cls(D.cond, 'condition'); cls(D.itms, 'itms'); cls(D.ballast, 'ballast'); cls(D.tamping, 'tampingDue');
    var f = function (list, v) { return (list || []).filter(function (r) { return PE.inView(r.ltp, v); }); };
    var views = {};
    ['main', 'loop', 'all'].forEach(function (v) {
      var Dv = Object.assign({}, D, { view: v, trc: f(D.trc, v), cards: f(D.cards, v), ws: f(D.ws, v), acRecent: f(D.acRecent, v), mpRecent: f(D.mpRecent, v), fmc: f(D.fmc, v), feedWork: f(D.feedWork, v), jobs: f(D.jobs, v), cond: f(D.cond, v), itms: f(D.itms, v), ballast: f(D.ballast, v), tamping: f(D.tamping, v),
        unknown: unknown, voteTrc: D.trc, voteCards: (D.cards || []).filter(function (c) { return c.lid && c.km != null; }), voteWs: D.ws || [], prev: D.prev && D.prev.views ? D.prev.views[v] : (v === 'main' ? D.prev : null) });
      views[v] = PE.computeView(Dv); views[v].view = v;
    });
    var out = Object.assign({}, views.main); out.v = 2; out.views = views; out.lineTypes = counts; out.unknownSample = unknown.slice(0, 50);
    // [C] OHE mast placement: rows that name a mast (or a mast range in TMS mast format) and how many of them the TMS mast list placed exactly
    var mc = function (list, get) { var o = { refs: 0, placed: 0 }; (list || []).forEach(function (r) { var g = get(r); if (!g.refs) return; o.refs++; if (g.placed) o.placed++; }); return o; };
    out.mastPlace = { loaded: PE.mastsLoaded ? PE.mastsLoaded() : false,
      machineProg: mc(D.mpRecent, function (r) { return { refs: (r.masts || []).length + (r.mastRanges || []).length, placed: r.how === 'mast' && r.lid && !r.approx }; }),
      fmc: mc(D.fmc, function (r) { var w = r.where || {}; return { refs: (r.masts || []).length + ((w.masts || []).length) + ((w.mastRanges || []).length), placed: w.how === 'mast' && w.lid && !w.approx }; }) };
    out.erhRows = (D.mpRecent || []).filter(function (r) { return r.erh != null; }).length;
    out.unknownNames = Object.keys(names).map(function (k) { return names[k]; }).sort(function (a, b) { return b.n - a.n; }).slice(0, 600);
    return out;
  };
  /** the view of a stored watch file ('main' | 'loop' | 'all'); an old file (v1) has only the main-line-like top level */
  PE.watchView = function (W, v) { return W && W.views && W.views[v] ? W.views[v] : W; };

  // ---------------------------------------------------------------- reading the stored result for a scope
  /** scope: {kind: 'division'|'aen'|'unit', value} -> the units in scope */
  PE.scopeUnits = function (watch, scope) {
    var U = watch.units || {}; var all = Object.keys(U);
    if (!scope || scope.kind === 'division') return all;
    if (scope.kind === 'aen') return all.filter(function (u) { return String(U[u].aen || '') === scope.value; });
    return all.filter(function (u) { return u === scope.value; });
  };
  PE.ruleCount = function (rule, units) {
    if (rule.status !== 'ready') return null; if (!units) return rule.count;
    var set = {}; units.forEach(function (u) { set[u] = 1; }); var n = 0; Object.keys(rule.byUnit || {}).forEach(function (u) { if (set[u]) n += rule.byUnit[u]; }); return n;
  };
  /** "Do these three today" for a unit: P1 cards past date > TMS entry gaps > hidden findings > overdue checks */
  PE.threeToday = function (watch, units, W) {
    W = W || {}; var set = {}; (units || []).forEach(function (u) { set[u] = 1; }); var inU = function (r) { return !units || set[r.unit || '?']; };
    var get = function (id) { return (watch.rules || []).filter(function (r) { return r.id === id; })[0]; };
    var today = watch.today; var out = [];
    var a3 = get('A3'); if (a3 && a3.status === 'ready') (a3.records || []).filter(inU).filter(function (r) { var lim = r.p === 1 ? (W.p1Days || 3) : (W.p2Days || 7); return r.p === 1 && PE.daysBetween(r.d, today) > lim; }).sort(function (a, b) { return String(a.d).localeCompare(String(b.d)); }).slice(0, 3).forEach(function (r) {
      out.push({ rank: 1, lt: r.lt, tag: 'P1 card', title: r.text.replace(/^P1 /, '') + ' – ' + r.lid + ' ' + PE.fmtKm(r.km, r.m), why: 'Raised ' + r.d + ', still open in TMS after ' + PE.daysBetween(r.d, today) + ' days.', go: { view: 'loc', arg: r.lid + '|' + r.km + '|' + (r.m || 0) }, btn: 'Open the place' });
    });
    var b4 = get('B4'); if (b4 && b4.status === 'ready') { var g = (b4.records || []).filter(inU); if (g.length) out.push({ rank: 2, tag: 'Enter in TMS', title: g.length + ' work' + (g.length > 1 ? 's' : '') + ' done, not in TMS', why: g.slice(0, 2).map(function (r) { return r.text.split(' – ')[0] + ' (' + r.d + ')'; }).join(' and ') + ' – in Field Mini Control with proof, no TMS work site.', go: { view: 'reg', arg: 'sheet only' }, btn: 'See the works' }); }
    ['H1', 'H2', 'H5', 'H4'].forEach(function (id) { var h = get(id); if (!h || h.status !== 'ready') return; (h.records || []).filter(inU).slice(0, 1).forEach(function (r) { out.push({ rank: 3, lt: r.lt, tag: 'Hidden · ' + h.en, title: r.title + (r.lid ? ' – ' + r.lid + ' ' + PE.fmtKm(r.km, r.m) : ''), why: r.seen, go: r.lid ? { view: 'loc', arg: r.lid + '|' + r.km + '|' + (r.m || 0) } : { view: 'ov' }, btn: 'See the evidence' }); }); });
    var b1 = get('B1'); if (b1 && b1.status === 'ready') (b1.records || []).filter(inU).sort(function (a, b) { return b.n - a.n; }).slice(0, 1).forEach(function (r) { out.push({ rank: 4, lt: r.lt, tag: 'Overdue check', title: 'Not recorded: ' + r.lid + ' km ' + PE.fmtKm(r.km, r.m) + ' – ' + PE.fmtKm(r.km2, r.m2), why: r.text + ' (' + (Math.round(r.n * 0.2 * 10) / 10) + ' km).', go: { view: 'loc', arg: r.lid + '|' + r.km + '|' + (r.m || 0) }, btn: 'Open the place' }); });
    out.sort(function (a, b) { return a.rank - b.rank; });
    return out;
  };
  /** is a data source older than its schedule? -> its date, else null */
  PE.staleDate = function (watch, src, nowIso) {
    var at = (watch.dataAt || {})[src]; var lim = (watch.freshDays || {})[src]; if (!at || !lim) return null;
    return PE.daysBetween(String(at).slice(0, 10), String(nowIso || watch.today).slice(0, 10)) > lim ? String(at).slice(0, 10) : null;
  };
})(PE);

