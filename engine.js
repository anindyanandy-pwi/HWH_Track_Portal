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
  PE.daysBetween = function (a, b) { var A = String(a || ''), B = String(b || ''); if (A.length === 7) A += '-01'; if (B.length === 7) B += '-01'; return Math.round((Date.parse(B.slice(0, 10) + 'T00:00:00Z') - Date.parse(A.slice(0, 10) + 'T00:00:00Z')) / 864e5); };
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
  PE.empty = function (v) { var s = String(v == null ? '' : v).trim(); return !s || s === '---' || s === '-' || /^n\.?a\.?$/i.test(s); };
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
  PE.mastToKm = PE.mastToKm || function (/* lidCandidates, mast */) { return null; };
  PE.MAST_RE = /\b(?:ERH|OHE|MAST\s*NO\.?)\s*[-:]?\s*(\d{2,6}(?:\/\d{1,3})?)|\bE\s*-\s*(\d{3,6})\b/i;
  PE.ASSET_RE = /\b(?:PT|POINT|PTS|T\/?O|X-?ING)\.?\s*(?:NO|NOS)?\.?\s*[-:.]?\s*(\d{1,3}\s*[A-Z]?)\b/i;

  /** ctx from the slim blockSections file {coa:[...], yards:[...]} + optional asset index {"lid|88A": [km, m]} */
  PE.locator = function (N, bs, assets) {
    var byBs = {}, byStn = {}, lids = {};
    var key2 = function (a, b) { return String(a || '').toUpperCase().replace(/[^A-Z]/g, '') + '-' + String(b || '').toUpperCase().replace(/[^A-Z]/g, ''); };
    ((bs && bs.coa) || []).forEach(function (r) {
      if (!r.lid || r.a == null) return;
      lids[r.lid] = 1;
      var o = { lid: r.lid, a: Math.min(r.a, r.b), b: Math.max(r.a, r.b) };
      [key2(r.f, r.t), key2(r.t, r.f)].forEach(function (k) { (byBs[k] = byBs[k] || []).push(o); });
      if (r.f) (byStn[r.f] = byStn[r.f] || []).push({ lid: r.lid, p: r.a0 });
      if (r.t) (byStn[r.t] = byStn[r.t] || []).push({ lid: r.lid, p: r.b0 });
    });
    var lineOk = function (lid, keys) { if (!keys || !keys.length) return true; var disp = keys.map(function (k) { return ' ' + N.lineDisplay(k); }); return disp.some(function (d) { return lid.slice(-d.length) === d; }); };
    function pickLine(cands, keys) {
      var seen = {}; cands = cands.filter(function (c) { if (seen[c.lid]) return false; seen[c.lid] = 1; return true; });
      var f = cands.filter(function (c) { return lineOk(c.lid, keys); });
      if (f.length) return f;
      return keys && keys.length ? [] : cands;
    }
    function stationOf(text) {
      var t = String(text || '').toUpperCase().trim(); var m;
      if ((m = t.match(/^([A-Z]{2,5})\s*(?:STN|STATION|ST\.|YD\b|YARD|SDG)/)) && byStn[m[1]]) return m[1];
      if ((m = t.match(/\b([A-Z]{2,5})\s+(?:STN|STATION|ST\.)/)) && byStn[m[1]]) return m[1];
      if (/^[A-Z]{2,5}$/.test(t) && byStn[t]) return t;
      return null;
    }
    function bsOf(text) {
      var t = String(text || '').toUpperCase(); var m = t.match(/\b([A-Z]{2,5})\s*(?:STN\s*LIMIT\s*)?-+\s*([A-Z]{2,5})\b/);
      if (!m) { m = t.match(/\b([A-Z]{2,5})\s+TO\s+([A-Z]{2,5})\b/); }
      return m ? [m[1], m[2]] : null;
    }
    /** rec: {lid?, km?, m?, km2?, m2?, bsText?, lineText?, texts?: [..] (location / purpose / details), sectionText?} */
    function locate(rec) {
      var W = { lid: null, km: null, m: null, km2: null, m2: null, key: null, how: 'none', approx: false, note: '' };
      var keys = rec.lineKeys || N.fieldLines(rec.lineText);
      var all = [rec.locText].concat(rec.texts || [], [rec.lineText]).filter(Boolean).join(' | ');
      var kt = PE.kmText(rec.locText) || PE.kmText(String(rec.lineText || '').replace(/^.*?KM\s*[:\-]*/i, '')) || ((/\bkm/i).test(all) ? PE.kmText(all.replace(/^.*?\bkm\s*[:\-]*/i, '')) : null);
      var cands = [], range = null, how = 'none';
      if (rec.lid) { cands = [{ lid: rec.lid }]; }
      var bsp = bsOf(rec.bsText);
      if (!cands.length && bsp) {
        var c = byBs[bsp[0] + '-' + bsp[1]] || [];
        if (c.length) { cands = pickLine(c, keys); how = 'blockSection'; }
        else if (byStn[bsp[0]] && byStn[bsp[1]]) {   // not adjacent stations: the stretch between them on a common line
          var A = byStn[bsp[0]], B = byStn[bsp[1]]; var both = [];
          A.forEach(function (x) { B.forEach(function (y) { if (x.lid === y.lid) both.push({ lid: x.lid, a: Math.min(x.p, y.p), b: Math.max(x.p, y.p) }); }); });
          if (both.length) { cands = pickLine(both, keys); how = 'blockSection'; W.note = 'stations not adjacent'; }
        }
      }
      if (!cands.length) {
        var st = stationOf(rec.bsText) || (bsp ? null : stationOf(rec.lineText));
        if (st) { var s = pickLine(byStn[st].map(function (x) { return { lid: x.lid, a: x.p, b: x.p, p: x.p }; }), keys); if (s.length) { cands = s; how = 'station'; W.note = 'station ' + st; } }
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
      var mast = all.match(PE.MAST_RE);
      if (mast) { var mk = PE.mastToKm(cands.map(function (x) { return x.lid; }), mast[0]); if (mk) { W.lid = mk.lid; W.km = mk.km; W.m = mk.m; W.km2 = mk.km; W.m2 = mk.m; W.how = 'mast'; W.key = PE.cellKey(W.lid, W.km, W.m); return W; } W.how = 'mast'; W.note = 'OHE mast ' + mast[0] + ' – waiting for the mast list'; return W; }
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
  PE.KINDS = ['blockSections', 'workSite', 'spotCards', 'assetChange', 'machineProg', 'trcRuns', 'tqiSix', 'condition', 'itms'];
  PE.KIND_LABEL = { blockSections: 'Block sections', workSite: 'Work sites', spotCards: 'Spot attention cards', assetChange: 'Asset changes', machineProg: 'Machine progress', trcRuns: 'TRC run list', tqiSix: 'TQI six runs', condition: 'Condition layers', itms: 'ITMS runs', health: 'Track health (chart + GMT)' };

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
          var masts = []; var re = /\b(?:ERH|E)\s*-\s*\d{3,6}\b/gi, mm; while ((mm = re.exec(rmk))) masts.push(mm[0].replace(/\s+/g, ''));
          var r = { id: 'mp' + day.asOn + '|' + (row['Sr#'] || '') + '|' + n.machine, d: day.asOn, mc: n.machine, sec: n.section, ln: n.line, bs: n.between,
            dem: g('Block > Block Demanded hh:mm'), giv: g('Block > Block Given hh:mm'), eff: g('Block > Reported Effective Time hh:mm'),
            trk: g('Work Done in Block Given > Track > Kms.No(UTV)'), tos: g('Work Done in Block Given > Track > T/Outs'), pct: g('Percentage(%) Work Done to Stipulated Output'),
            who: PE.desig(rmk), masts: masts };
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
        var r = { id: 'tr' + t.runId, d: t.date, lid: lid, km: t.fromKm, m: t.fromM, km2: t.toKm, m2: t.toM, sp: t.speed, car: t.car, let: t.letter };
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
    var cols = PE.FMC_COLS[T.kind]; var blocks = PE.fmcBlocks(T, V.slice(0, 3)); var warnings = [], records = [], used = [];
    var lim = opts.maxBlocks || 999;
    for (var bi = 0; bi < blocks.length && used.length < lim; bi++) {
      var B = blocks[bi];
      if (!B.date) continue;
      if (opts.from && B.date < opts.from) break;   // newest on the left: everything further right is older
      if (opts.to && B.date > opts.to) continue;
      if (!B.ok) { warnings.push({ tab: T.tab, date: B.date, col: PE.colName(col0 + B.col), msg: 'layout changed – block not read', expected: B.bad.map(function (k) { return T.header[k]; }), found: B.bad.map(function (k) { return B.found[k]; }) }); continue; }
      used.push(B);
      var srden = '', aen = '', unit = '';
      for (var r = 3; r < V.length; r++) {
        var row = V[r] || [];
        if (String(row[0] || '').trim()) srden = String(row[0]).trim();
        if (String(row[1] || '').trim()) aen = String(row[1]).trim();
        if (String(row[2] || '').trim()) unit = String(row[2]).trim();
        if (/^total$/i.test(String(row[2] || '').trim())) break;
        var o = {}; cols.forEach(function (k, i) { o[k] = String(row[B.col + i] == null ? '' : row[B.col + i]).trim(); });
        var content = [o.bs, o.line, o.purpose, o.details, o.loc, o.reason].filter(function (x) { return !PE.empty(x) && !/^no work$/i.test(x); });
        if (!content.length) continue;
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
    return { records: records, blocks: blocks.map(function (b) { return { date: b.date, from: b.from, ok: b.ok, col: PE.colName(col0 + b.col) }; }), used: used.map(function (b) { return b.date; }), warnings: warnings };
  };

  /** locate the sheet records with the locator (block section / station / km in the caution location / point numbers) */
  PE.fmcLocate = function (recs, L) {
    return recs.map(function (r) {
      var w = L.locate({ bsText: r.bs, lineText: r.line, locText: r.loc, texts: [r.purpose, r.details, r.reason] });
      return Object.assign({}, r, { where: w });
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
  PE.proofMissing = function (r) {
    var need = ['preImg', 'postImg', 'certSafety', 'certAgency', 'certWork']; if (r.tab && /Block/.test(r.tab)) need.push('video');
    return need.filter(function (k) { return !(r.ev && r.ev[k]); });
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
    var R = Object.assign({ tampMonths: 24, dsYears: 10, lifeWatch: 0.9, life: { '04': 800, '03': 525 }, backDays: 120, noActionDays: 7, tgi: { watch: 80, act: 50, urgent: 36 } }, (opts && opts.rules) || {});
    var today = (opts && opts.today) || new Date().toISOString().slice(0, 10);
    var out = [], acts = [];
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
    // 5. deep screening age (TMS chart layer, else ballast changes here)
    var dsA = items.filter(function (i) { return i.kind === 'asset' && i.x.k === 'ballast' && /deep/i.test(i.x.t || i.x.sub || ''); }).map(function (i) { return i.d; }).sort().pop();
    var ds = [prof && prof.ds, dsA].filter(Boolean).sort().pop();
    if (ds) { var y = PE.daysBetween(ds, today) / 365.25; out.push({ lvl: y > R.dsYears ? 'Watch' : 'Info', code: 'ds', text: 'deep screened ' + ds + ' – ' + Math.floor(y) + ' years ago' + (y > R.dsYears ? ' (rule ' + R.dsYears + ' years)' : '') }); }
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

