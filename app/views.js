/* Widoki: Kalendarz, Historia (lista, filtry, wykresy), Plan makro. Korzysta z window.LT z app.js. */
(function () {
  'use strict';
  var LT = window.LT, $ = LT.$, esc = LT.esc, fmtN = LT.fmt;

  /* ---------- daty i formaty ---------- */
  var MONTHS = ['styczeń', 'luty', 'marzec', 'kwiecień', 'maj', 'czerwiec', 'lipiec', 'sierpień', 'wrzesień', 'październik', 'listopad', 'grudzień'];
  var MONTHS_GEN = ['stycznia', 'lutego', 'marca', 'kwietnia', 'maja', 'czerwca', 'lipca', 'sierpnia', 'września', 'października', 'listopada', 'grudnia'];
  var DAYS = ['niedziela', 'poniedziałek', 'wtorek', 'środa', 'czwartek', 'piątek', 'sobota'];
  var DAYS_S = ['nd', 'pn', 'wt', 'śr', 'cz', 'pt', 'so'];
  function p2(n) { return ('0' + n).slice(-2); }
  function pd(s) { var p = s.split('-'); return new Date(Date.UTC(+p[0], +p[1] - 1, +p[2])); }
  function ds(d) { return d.toISOString().slice(0, 10); }
  function addDays(s, n) { var d = pd(s); d.setUTCDate(d.getUTCDate() + n); return ds(d); }
  function plDate(s) { return s.slice(8, 10) + '.' + s.slice(5, 7) + '.' + s.slice(0, 4); }
  function plLong(s) { var d = pd(s); return DAYS[d.getUTCDay()] + ', ' + d.getUTCDate() + ' ' + MONTHS_GEN[d.getUTCMonth()] + ' ' + d.getUTCFullYear(); }
  function plShortDay(s) { var d = pd(s); return DAYS_S[d.getUTCDay()] + ' ' + plDate(s); }
  function rnd(v) { return Math.round(v * 100) / 100; }
  function nf(v) { return fmtN(rnd(v)); }
  var TYPEC = { 'Wspin': 'wspin', 'Palce': 'palce', 'Siłka': 'silka', 'Skały': 'skaly' };
  function tcls(t) { return TYPEC[t] || 'inne'; }
  function badge(t) { return '<span class="badge-t"><i class="dot ' + tcls(t) + '"></i>' + esc(t) + '</span>'; }
  function badges(list) { return list.length ? '<div class="badges">' + list.map(badge).join('') + '</div>' : ''; }

  /* ---------- ćwiczenia: nazwa bazowa i ręka ---------- */
  function baseOf(n) { return n.replace(/\s+(prawa|lewa|P|L)$/, ''); }
  function sideOf(n) { var m = /\s+(prawa|lewa|P|L)$/.exec(n); if (!m) return 'obie'; return (m[1] === 'prawa' || m[1] === 'P') ? 'prawa' : 'lewa'; }
  function pairs(b) {
    var out = [];
    for (var i = 0; i < b.p.length; i++) {
      var k = b.kgs ? b.kgs[i] : (b.kg != null ? b.kg : null);
      out.push({ r: b.p[i], k: k == null ? null : k });
    }
    return out;
  }
  var exCache = null, exKey = '';
  function exerciseList() {
    var all = LT.trainings(), key = all.length + '|' + (all.length ? all[all.length - 1].d : '');
    if (exCache && key === exKey) return exCache;
    var m = {};
    all.forEach(function (t) {
      var seen = {};
      t.b.forEach(function (b) {
        if (!b.n) return;
        var base = baseOf(b.n), e = m[base] || (m[base] = { name: base, n: 0, sides: {} });
        if (!seen[base]) { e.n++; seen[base] = 1; }
        e.sides[sideOf(b.n)] = 1;
      });
    });
    exCache = Object.keys(m).map(function (k) { return m[k]; }).sort(function (a, b) { return b.n - a.n || (a.name < b.name ? -1 : 1); });
    exKey = key; return exCache;
  }

  /* ---------- miary ---------- */
  function num(x) { return x != null && isFinite(x); }
  var METRICS = [
    { id: 'maxKg', label: 'Maks. ciężar', unit: 'kg', f: function (ps) { var v = ps.filter(function (x) { return num(x.k); }).map(function (x) { return x.k; }); return v.length ? Math.max.apply(null, v) : null; } },
    { id: 'e1rm', label: 'Szacowany max (1RM)', unit: 'kg', f: function (ps) { var v = ps.filter(function (x) { return num(x.k) && x.k > 0; }).map(function (x) { return x.k * (1 + x.r / 30); }); return v.length ? Math.max.apply(null, v) : null; } },
    { id: 'vol', label: 'Objętość (powt. × kg)', unit: 'kg×powt.', f: function (ps) { var v = ps.filter(function (x) { return num(x.k) && x.k > 0; }); return v.length ? v.reduce(function (a, x) { return a + x.r * x.k; }, 0) : null; } },
    { id: 'reps', label: 'Suma powtórzeń / sekund', unit: 'powt.', f: function (ps) { return ps.length ? ps.reduce(function (a, x) { return a + x.r; }, 0) : null; } },
    { id: 'maxRep', label: 'Najwięcej powt. / sek. w serii', unit: 'powt.', f: function (ps) { return ps.length ? Math.max.apply(null, ps.map(function (x) { return x.r; })) : null; } },
    { id: 'sets', label: 'Liczba serii', unit: 'serie', f: function (ps) { return ps.length || null; } },
    { id: 'avgKg', label: 'Średni ciężar serii', unit: 'kg', f: function (ps) { var v = ps.filter(function (x) { return num(x.k); }).map(function (x) { return x.k; }); return v.length ? v.reduce(function (a, x) { return a + x; }, 0) / v.length : null; } }
  ];
  function metric(id) { return METRICS.filter(function (m) { return m.id === id; })[0] || METRICS[0]; }
  function mmss(v) { if (!v) return null; var m = /^(\d+):(\d{2})(?::(\d{2}))?$/.exec(String(v).trim()); if (!m) return null; return m[3] !== undefined ? (+m[1] * 60 + +m[2] + +m[3] / 60) : (+m[1] + +m[2] / 60); }
  function diffMin(a, b) { var x = a.split(':'), y = b.split(':'); return (+y[0] * 60 + +y[1]) - (+x[0] * 60 + +x[1]); }
  function sv(key) { return function (t) { return t.s && t.s[key] != null ? t.s[key] : null; }; }
  var VARS = [
    { id: 'w', label: 'Waga', unit: 'kg', agg: 'avg', f: function (t) { return t.w != null ? t.w : null; } },
    { id: 'sen', label: 'Sen', unit: '1–5', agg: 'avg', f: function (t) { return t.sen != null ? t.sen : null; } },
    { id: 'wyr', label: 'Wyrestowanie / samopoczucie', unit: '1–5', agg: 'avg', f: function (t) { return t.wyr != null ? t.wyr : null; } },
    { id: 'int', label: 'Intensywność (subiektywnie)', unit: '1–5', agg: 'avg', f: sv('int') },
    { id: 'fiz', label: 'Jak się czułem fizycznie', unit: '1–5', agg: 'avg', f: sv('fiz') },
    { id: 'jak', label: 'Jak było jakościowo', unit: '1–5', agg: 'avg', f: sv('jak') },
    { id: 'nEx', label: 'Liczba ćwiczeń', unit: 'szt.', agg: 'sum', f: function (t) { return t.b.filter(function (b) { return b.n; }).length || null; } },
    { id: 'nSets', label: 'Liczba serii (łącznie)', unit: 'serie', agg: 'sum', f: function (t) { return t.b.reduce(function (a, b) { return a + b.p.length; }, 0) || null; } },
    { id: 'vol', label: 'Objętość łączna (powt. × kg)', unit: 'kg×powt.', agg: 'sum', f: function (t) { var s = 0, any = false; t.b.forEach(function (b) { pairs(b).forEach(function (x) { if (num(x.k) && x.k > 0) { s += x.r * x.k; any = true; } }); }); return any ? s : null; } },
    { id: 'wu', label: 'Czas rozgrzewki', unit: 'min', agg: 'sum', f: function (t) { if (!t.wu || !t.wu.s || !t.wu.e) return null; var m = diffMin(t.wu.s, t.wu.e); return m > 0 && m < 300 ? m : null; } },
    { id: 'rd', label: 'Intensywność: czerwona', unit: 'min', agg: 'sum', f: function (t) { return mmss(t.s && t.s.rd); } },
    { id: 'ye', label: 'Intensywność: żółta', unit: 'min', agg: 'sum', f: function (t) { return mmss(t.s && t.s.ye); } },
    { id: 'gr', label: 'Intensywność: zielona', unit: 'min', agg: 'sum', f: function (t) { return mmss(t.s && t.s.gr); } },
    { id: 'n', label: 'Liczba treningów w dniu', unit: 'szt.', agg: 'sum', f: function () { return 1; } }
  ];
  function vdef(id) { return VARS.filter(function (v) { return v.id === id; })[0] || VARS[0]; }

  /* ---------- serie do wykresu ---------- */
  function seriesFor(spec, from, to) {
    var byDay = {};
    LT.trainings().forEach(function (t) { if (t.d >= from && t.d <= to) (byDay[t.d] = byDay[t.d] || []).push(t); });
    var pts = [], label, unit;
    if (spec.kind === 'var') {
      var v = vdef(spec.v); label = v.label; unit = v.unit;
      Object.keys(byDay).sort().forEach(function (d) {
        var vals = byDay[d].map(v.f).filter(num);
        if (!vals.length) return;
        var sum = vals.reduce(function (a, x) { return a + x; }, 0);
        pts.push({ d: d, v: v.agg === 'sum' ? sum : sum / vals.length });
      });
    } else {
      var m = metric(spec.m); unit = m.unit;
      label = spec.ex + ' · ' + m.label + (spec.side !== 'all' ? ' (' + sideLabel(spec.side) + ')' : '');
      Object.keys(byDay).sort().forEach(function (d) {
        var ps = [];
        byDay[d].forEach(function (t) {
          t.b.forEach(function (b) {
            if (!b.n || baseOf(b.n) !== spec.ex) return;
            if (spec.side !== 'all' && sideOf(b.n) !== spec.side) return;
            ps = ps.concat(pairs(b));
          });
        });
        var val = m.f(ps);
        if (num(val)) pts.push({ d: d, v: val });
      });
    }
    return { label: label, unit: unit, pts: pts };
  }
  function sideLabel(s) { return s === 'prawa' ? 'prawa ręka' : s === 'lewa' ? 'lewa ręka' : s === 'obie' ? 'bez podziału na ręce' : 'wszystkie'; }

  /* ---------- wykres SVG ---------- */
  function niceTicks(min, max, n) {
    if (min === max) { min -= 1; max += 1; }
    var span = max - min, step = Math.pow(10, Math.floor(Math.log10(span / n))), err = span / n / step;
    if (err >= 7.5) step *= 10; else if (err >= 3.5) step *= 5; else if (err >= 1.5) step *= 2;
    var lo = Math.floor(min / step + 1e-9) * step, hi = Math.ceil(max / step - 1e-9) * step, t = [];
    for (var v = lo; v <= hi + step / 2; v += step) t.push(+v.toFixed(10));
    return t;
  }
  function axisOf(list) {
    var mn = Infinity, mx = -Infinity;
    list.forEach(function (s) { s.pts.forEach(function (p) { if (p.v < mn) mn = p.v; if (p.v > mx) mx = p.v; }); });
    var pad = (mx - mn) * 0.08; var lo = mn - pad, hi = mx + pad;
    if (mn >= 0 && lo < 0) lo = 0;
    var ticks = niceTicks(lo, hi, 4);
    return { lo: ticks[0], hi: ticks[ticks.length - 1], ticks: ticks };
  }
  function buildChart(series, W, sel) {
    var H = 250, live = series.filter(function (s) { return s.pts.length; });
    var dual = series.length === 2 && live.length === 2 && series[0].unit !== series[1].unit;
    var padL = 46, padR = dual ? 46 : 14, padT = 12, padB = 26, iw = W - padL - padR, ih = H - padT - padB;
    var xmin = Infinity, xmax = -Infinity;
    series.forEach(function (s) { s.pts.forEach(function (p) { var ms = pd(p.d).getTime(); if (ms < xmin) xmin = ms; if (ms > xmax) xmax = ms; }); });
    if (xmin === xmax) { xmin -= 3 * 864e5; xmax += 3 * 864e5; }
    function X(ms) { return padL + (ms - xmin) / (xmax - xmin) * iw; }
    var ax0 = axisOf(dual ? [series[0]] : live), ax1 = dual ? axisOf([series[1]]) : null;
    function Y(v, ax) { return padT + (1 - (v - ax.lo) / (ax.hi - ax.lo)) * ih; }
    var g = '';
    ax0.ticks.forEach(function (t) {
      var y = Y(t, ax0);
      g += '<line class="grid" x1="' + padL + '" x2="' + (W - padR) + '" y1="' + y + '" y2="' + y + '"/>';
      g += '<text class="' + (dual ? 'tA' : '') + '" x="' + (padL - 6) + '" y="' + (y + 4) + '" text-anchor="end">' + esc(nf(t)) + '</text>';
    });
    if (dual) ax1.ticks.forEach(function (t) { g += '<text class="tB" x="' + (W - padR + 6) + '" y="' + (Y(t, ax1) + 4) + '" text-anchor="start">' + esc(nf(t)) + '</text>'; });
    var span = (xmax - xmin) / 864e5;
    for (var i = 0; i <= 3; i++) {
      var ms = xmin + (xmax - xmin) * i / 3, d = ds(new Date(ms)), lab = span > 400 ? d.slice(5, 7) + '.' + d.slice(2, 4) : d.slice(8, 10) + '.' + d.slice(5, 7);
      g += '<text x="' + X(ms) + '" y="' + (H - 8) + '" text-anchor="' + (i === 0 ? 'start' : i === 3 ? 'end' : 'middle') + '">' + lab + '</text>';
    }
    g += '<line class="axis" x1="' + padL + '" x2="' + (W - padR) + '" y1="' + (padT + ih) + '" y2="' + (padT + ih) + '"/>';
    var dates = {};
    series.forEach(function (s, si) {
      if (!s.pts.length) return;
      var cls = si === 0 ? 'sA' : 'sB', ax = (dual && si === 1) ? ax1 : ax0, path = '';
      s.pts.forEach(function (p, pi) {
        var x = X(pd(p.d).getTime()), y = Y(p.v, ax); dates[p.d] = x;
        path += (pi ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1);
      });
      g += '<path class="' + cls + '" d="' + path + '"/>';
      var n = s.pts.length, r0 = n <= 45 ? 3.5 : n <= 100 ? 2.5 : 0;
      s.pts.forEach(function (p) {
        var big = sel === p.d; if (!big && !r0) return;
        var x = X(pd(p.d).getTime()), y = Y(p.v, ax), r = big ? 6 : r0;
        g += si === 0
          ? '<circle class="' + cls + (big ? ' ring' : '') + '" cx="' + x + '" cy="' + y + '" r="' + r + '"/>'
          : '<rect class="' + cls + (big ? ' ring' : '') + '" x="' + (x - r) + '" y="' + (y - r) + '" width="' + (2 * r) + '" height="' + (2 * r) + '"/>';
      });
    });
    if (sel && dates[sel] != null) g += '<line class="guide" x1="' + dates[sel] + '" x2="' + dates[sel] + '" y1="' + padT + '" y2="' + (padT + ih) + '"/>';
    g += '<rect class="hit" x="' + padL + '" y="0" width="' + iw + '" height="' + H + '" fill="transparent"/>';
    var xs = Object.keys(dates).map(function (d) { return { d: d, x: dates[d] }; });
    return { html: '<svg viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '" role="img" aria-label="Wykres: ' + esc(series.map(function (s) { return s.label; }).join(' oraz ')) + '">' + g + '</svg>', xs: xs };
  }

  /* ---------- KALENDARZ ---------- */
  var cal = { y: null, m: null, sel: null, pt: [], pn: '' };
  function renderCal() {
    var root = $('#view-cal'), today = LT.today();
    if (cal.y === null) { cal.y = +today.slice(0, 4); cal.m = +today.slice(5, 7) - 1; cal.sel = today; }
    var all = LT.trainings(), by = {}, pby = {};
    all.forEach(function (t) { (by[t.d] = by[t.d] || []).push(t); });
    LT.planned().forEach(function (p) { (pby[p.date] = pby[p.date] || []).push(p); });
    var lead = (new Date(Date.UTC(cal.y, cal.m, 1)).getUTCDay() + 6) % 7, dim = new Date(Date.UTC(cal.y, cal.m + 1, 0)).getUTCDate();
    var cells = '', i, mCount = 0, mTypes = {};
    ['pn', 'wt', 'śr', 'cz', 'pt', 'so', 'nd'].forEach(function (d) { cells += '<span class="cal-dow">' + d + '</span>'; });
    for (i = 0; i < lead; i++) cells += '<span class="day empty" aria-hidden="true"></span>';
    for (var d = 1; d <= dim; d++) {
      var dd = cal.y + '-' + p2(cal.m + 1) + '-' + p2(d), ts = by[dd] || [], ps = pby[dd] || [], types = [];
      ts.forEach(function (t) { var tt = t.t.length ? t.t : ['Inne']; tt.forEach(function (x) { if (types.indexOf(x) < 0) types.push(x); }); });
      if (ts.length) { mCount += ts.length; types.forEach(function (x) { mTypes[x] = (mTypes[x] || 0) + 1; }); }
      var dots = types.slice(0, 4).map(function (x) { return '<i class="dot ' + tcls(x) + '"></i>'; }).join('') + (ps.length ? '<i class="dot plan"></i>' : '');
      var lab = plLong(dd) + (ts.length ? ', ' + ts.length + ' ' + LT.plural(ts.length, 'trening', 'treningi', 'treningów') : '') + (ps.length ? ', zaplanowany trening' : '');
      cells += '<button type="button" class="day' + (dd === today ? ' today' : '') + (dd === cal.sel ? ' sel' : '') + '" data-d="' + dd + '" aria-label="' + esc(lab) + '"><span>' + d + '</span><span class="dots">' + dots + '</span></button>';
    }
    var stat = mCount ? mCount + ' ' + LT.plural(mCount, 'trening', 'treningi', 'treningów') + ' w tym miesiącu: ' + Object.keys(mTypes).map(function (k) { return k + ' ' + mTypes[k]; }).join(', ') : 'Brak treningów w tym miesiącu.';
    root.innerHTML =
      '<div class="cal-head"><button type="button" class="btn small" data-act="prev" aria-label="Poprzedni miesiąc">‹</button><h2>' + MONTHS[cal.m] + ' ' + cal.y + '</h2><button type="button" class="btn small" data-act="next" aria-label="Następny miesiąc">›</button></div>' +
      '<div class="cal-grid" role="group" aria-label="Dni miesiąca">' + cells + '</div>' +
      '<p class="sub-title">' + esc(stat) + '</p>' +
      '<div class="legend"><span><i class="dot wspin"></i>Wspin</span><span><i class="dot palce"></i>Palce</span><span><i class="dot silka"></i>Siłka</span><span><i class="dot skaly"></i>Skały</span><span><i class="dot plan"></i>Zaplanowany</span></div>' +
      '<div id="cal-day"></div><button type="button" class="ghost" data-act="today">Wróć do dzisiaj</button>';
    renderDay();
  }
  function renderDay() {
    var box = $('#cal-day'); if (!box) return;
    var dd = cal.sel, today = LT.today();
    var ts = LT.trainings().filter(function (t) { return t.d === dd; }), ps = LT.planned().filter(function (p) { return p.date === dd; });
    var h = '<div class="card"><h3>' + esc(plLong(dd)) + '</h3>';
    ts.forEach(function (t) {
      var names = t.b.filter(function (b) { return b.n; }).map(function (b) { return b.n; });
      h += '<div class="dayitem">' + badges(t.t) +
        '<p>' + (names.length ? esc(names.length + ' ' + LT.plural(names.length, 'ćwiczenie', 'ćwiczenia', 'ćwiczeń') + ': ' + names.slice(0, 4).join(', ') + (names.length > 4 ? '…' : '')) : 'Bez zapisanych ćwiczeń') + '</p>' +
        '<button type="button" class="btn small" data-act="open-hist" data-d="' + dd + '">Zobacz w historii</button></div>';
    });
    ps.forEach(function (p) {
      h += '<div class="dayitem"><span class="sec-h">Zaplanowane</span>' + badges(p.types) + (p.note ? '<p>' + esc(p.note) + '</p>' : '') +
        '<div class="badges">' + (dd === today ? '<button type="button" class="btn small primary" data-act="start-plan" data-id="' + p.id + '">Zacznij ten trening</button>' : '') +
        '<button type="button" class="btn small" data-act="del-plan" data-id="' + p.id + '">Usuń plan</button></div></div>';
    });
    if (!ts.length && !ps.length) h += '<p class="empty-msg">' + (dd > today ? 'Nic nie zaplanowano.' : 'Brak treningów tego dnia.') + '</p>';
    if (dd >= today) {
      h += '<div class="dayitem"><span class="sec-h">Zaplanuj trening</span><div class="chips" role="group" aria-label="Rodzaj planowanego treningu">' +
        ['Wspin', 'Palce', 'Siłka', 'Skały'].map(function (t) { return '<button type="button" data-act="ptype" data-t="' + t + '" aria-pressed="' + (cal.pt.indexOf(t) > -1) + '">' + t + '</button>'; }).join('') + '</div>' +
        '<input id="plan-note" placeholder="Notatka (opcjonalnie)" aria-label="Notatka do planowanego treningu" value="' + esc(cal.pn) + '">' +
        '<button type="button" class="btn" data-act="add-plan"' + (cal.pt.length ? '' : ' disabled') + '>Zaplanuj</button></div>';
    }
    if (dd === today) h += '<button type="button" class="btn primary" data-act="start-today">Zacznij trening</button>';
    box.innerHTML = h + '</div>';
  }
  $('#view-cal').addEventListener('click', function (e) {
    var day = e.target.closest('.day[data-d]');
    if (day) { cal.sel = day.dataset.d; cal.pt = []; cal.pn = ''; renderCal(); return; }
    var b = e.target.closest('[data-act]'); if (!b) return;
    var a = b.dataset.act;
    if (a === 'prev' || a === 'next') { cal.m += a === 'next' ? 1 : -1; if (cal.m < 0) { cal.m = 11; cal.y--; } if (cal.m > 11) { cal.m = 0; cal.y++; } renderCal(); }
    else if (a === 'today') { cal.y = null; renderCal(); }
    else if (a === 'open-hist') { H.tab = 'list'; H.from = H.to = b.dataset.d; H.preset = ''; H.ex = ''; H.openDate = b.dataset.d; LT.go('hist'); }
    else if (a === 'ptype') { var t = b.dataset.t, i = cal.pt.indexOf(t); if (i > -1) cal.pt.splice(i, 1); else cal.pt.push(t); renderDay(); }
    else if (a === 'add-plan') {
      var pl = LT.planned().slice(); pl.push({ id: Date.now(), date: cal.sel, types: cal.pt.slice(), note: cal.pn.trim() }); LT.setPlanned(pl);
      cal.pt = []; cal.pn = ''; renderCal(); LT.toast('Trening zaplanowany.');
    }
    else if (a === 'del-plan') { LT.setPlanned(LT.planned().filter(function (p) { return String(p.id) !== b.dataset.id; })); renderCal(); }
    else if (a === 'start-plan') { var p = LT.planned().filter(function (x) { return String(x.id) === b.dataset.id; })[0]; LT.startTraining({ date: cal.sel, types: p ? p.types : [] }); }
    else if (a === 'start-today') { LT.startTraining({ date: cal.sel }); }
  });
  $('#view-cal').addEventListener('input', function (e) { if (e.target.id === 'plan-note') cal.pn = e.target.value; });

  /* ---------- HISTORIA ---------- */
  var H = { smooth: 0, tab: 'list', from: null, to: null, preset: '90', ex: '', shown: 30, openDate: null, A: null, B: null, sel: null };
  var PRESETS = [['30', '30 dni'], ['90', '3 mies.'], ['180', '6 mies.'], ['365', 'Rok'], ['all', 'Wszystko']];
  function setPreset(k) {
    var to = LT.today(); H.to = to; H.preset = k;
    if (k === 'all') { var a = LT.trainings(); H.from = a.length ? a[0].d : addDays(to, -365); } else H.from = addDays(to, -(+k));
  }
  function hasWeight(name) {
    var ts = LT.trainings();
    for (var i = ts.length - 1; i >= 0; i--) for (var j = 0; j < ts[i].b.length; j++) {
      var b = ts[i].b[j]; if (b.n && baseOf(b.n) === name && pairs(b).some(function (x) { return num(x.k) && x.k > 0; })) return true;
    }
    return false;
  }
  function smartMetric(name) { return hasWeight(name) ? 'maxKg' : 'maxRep'; }
  function defaultSpec(kind) {
    if (kind === 'var') return { kind: 'var', v: 'sen' };
    var exs = exerciseList(), ex = null;
    for (var i = 0; i < exs.length && !ex; i++) if (hasWeight(exs[i].name)) ex = exs[i];
    ex = ex || exs[0];
    return { kind: 'ex', ex: ex ? ex.name : '', side: 'all', m: ex ? smartMetric(ex.name) : 'maxKg' };
  }
  function renderHist() {
    if (!H.to) setPreset('90');
    if (!H.A || (H.A.kind === 'ex' && !H.A.ex)) H.A = defaultSpec('ex');
    var root = $('#view-hist');
    root.innerHTML =
      '<div class="seg tabs" role="tablist" aria-label="Widok historii"><button type="button" role="tab" data-act="tab" data-t="list" aria-pressed="' + (H.tab === 'list') + '">Treningi</button><button type="button" role="tab" data-act="tab" data-t="chart" aria-pressed="' + (H.tab === 'chart') + '">Wykres</button></div>' +
      '<div class="card"><span class="lab">Przedział dat</span><div class="grid2"><div class="field"><label for="h-from">Od</label><input id="h-from" type="date" value="' + H.from + '"></div><div class="field"><label for="h-to">Do</label><input id="h-to" type="date" value="' + H.to + '"></div></div>' +
      '<div class="presets" role="group" aria-label="Szybki wybór okresu">' + PRESETS.map(function (p) { return '<button type="button" data-act="preset" data-k="' + p[0] + '" aria-pressed="' + (H.preset === p[0]) + '">' + p[1] + '</button>'; }).join('') + '</div></div>' +
      '<div id="hist-body" class="view"></div>';
    renderHistBody();
  }
  function renderHistBody() { if (H.tab === 'list') renderList(); else renderChartTab(); }

  /* --- lista treningów --- */
  function sumRows(t) {
    var s = t.s || {}, L = [['ile1', 'Trening 1: czas'], ['f1', 'Trening 1: focus'], ['r1', 'Trening 1: rest'], ['pr1', 'Trening 1: przebieg'], ['ile2', 'Trening 2: czas'], ['f2', 'Trening 2: focus'], ['r2', 'Trening 2: rest'], ['pr2', 'Trening 2: przebieg'],
      ['int', 'Intensywność subiektywnie (1–5)'], ['rd', 'Intensywność czerwona'], ['ye', 'Intensywność żółta'], ['gr', 'Intensywność zielona'], ['pol', 'Polar Flow'], ['fiz', 'Samopoczucie fizyczne (1–5)'], ['jak', 'Jakość treningu (1–5)'],
      ['chk', 'Focus check lista'], ['suk', 'Sukcesy'], ['sl', 'Słabe strony'], ['kom', 'Komentarz po sesji']];
    return L.filter(function (r) { return s[r[0]] != null && s[r[0]] !== ''; }).map(function (r) { return [r[1], String(s[r[0]])]; });
  }
  function exBlock(b) {
    var ps = pairs(b), h = '<div class="ex"><h4>' + esc(b.n || '(bez nazwy)') + '</h4>';
    if (ps.length) h += '<div class="chipset">' + ps.map(function (x) { return '<span class="setchip"><b>' + nf(x.r) + '</b>' + (x.k != null ? ' × ' + nf(x.k) + ' kg' : '') + '</span>'; }).join('') + '</div>';
    if (b.kgt) h += '<p class="note">Ciężar (zapis z arkusza): ' + esc(b.kgt) + '</p>';
    var extra = []; if (b.r) extra.push('Rest ' + b.r); if (b.k) extra.push(b.k);
    if (extra.length) h += '<p class="note">' + esc(extra.join(' · ')) + '</p>';
    return h + '</div>';
  }
  function trainingCard(t, exFilter, open) {
    var blocks = t.b.filter(function (b) { return !exFilter || (b.n && baseOf(b.n) === exFilter); });
    var meta = [];
    if (t.sen != null) meta.push('sen ' + t.sen); if (t.wyr != null) meta.push('wyr. ' + t.wyr);
    var nEx = t.b.filter(function (b) { return b.n; }).length; if (nEx) meta.push(nEx + ' ćw.');
    var h = '<details class="tr"' + (open ? ' open' : '') + '><summary><div class="top"><span class="date">' + esc(plShortDay(t.d)) + '</span></div>' + badges(t.t) + (meta.length ? '<span class="meta">' + esc(meta.join(' · ')) + '</span>' : '') + '</summary><div class="bd">';
    if (!exFilter) {
      var top = []; if (t.w != null) top.push('Waga ' + nf(t.w) + ' kg'); if (t.sen != null) top.push('Sen ' + t.sen + '/5'); if (t.wyr != null) top.push('Wyrestowanie ' + t.wyr + '/5');
      if (top.length) h += '<p class="line">' + esc(top.join(' · ')) + '</p>';
      if (t.cele) h += '<p class="line"><b>Cele:</b> ' + esc(t.cele) + '</p>';
      if (t.wu) {
        var w = [], wu = t.wu; if (wu.s || wu.e) w.push((wu.s || '?') + '–' + (wu.e || '?')); if (wu.dr) w.push(wu.dr); if (wu.k) w.push(wu.k);
        h += '<p class="sec-h">Rozgrzewka</p><p class="line">' + esc(w.join(' · ')) + '</p>';
      }
    }
    if (blocks.length) h += '<p class="sec-h">Ćwiczenia</p>' + blocks.map(exBlock).join('');
    if (!exFilter) {
      var rows = sumRows(t);
      if (rows.length) h += '<p class="sec-h">Podsumowanie</p><dl class="kv">' + rows.map(function (r) { return '<div><dt>' + esc(r[0]) + '</dt><dd>' + esc(r[1]) + '</dd></div>'; }).join('') + '</dl>';
      if (!blocks.length && !rows.length && !t.wu && !t.cele) h += '<p class="empty-msg">Brak szczegółów w tym wpisie.</p>';
    }
    return h + '</div></details>';
  }
  function renderList() {
    var body = $('#hist-body'), ex = H.ex;
    var all = LT.trainings().filter(function (t) { return t.d >= H.from && t.d <= H.to && (!ex || t.b.some(function (b) { return b.n && baseOf(b.n) === ex; })); });
    all.sort(function (a, b) { return a.d < b.d ? 1 : a.d > b.d ? -1 : ((b.ts || '') < (a.ts || '') ? -1 : 1); });
    var opts = '<option value="">Wszystkie ćwiczenia</option>' + exerciseList().map(function (e) { return '<option value="' + esc(e.name) + '"' + (e.name === ex ? ' selected' : '') + '>' + esc(e.name) + ' (' + e.n + '×)</option>'; }).join('');
    var h = '<div class="field"><label for="h-ex">Filtr: ćwiczenie</label><select id="h-ex">' + opts + '</select></div>' +
      '<p class="sub-title" aria-live="polite">' + all.length + ' ' + LT.plural(all.length, 'trening', 'treningi', 'treningów') + ' w wybranym okresie' + (ex ? ' z ćwiczeniem „' + esc(ex) + '”' : '') + '</p>';
    if (!all.length) h += '<div class="card"><p class="empty-msg">Brak treningów w tym przedziale. Zmień daty albo wybierz „Wszystko”.</p></div>';
    all.slice(0, H.shown).forEach(function (t) { h += trainingCard(t, ex, !!ex || t.d === H.openDate); });
    if (all.length > H.shown) h += '<button type="button" class="btn" data-act="more">Pokaż więcej (' + (all.length - H.shown) + ')</button>';
    body.innerHTML = h; H.openDate = null;
  }

  /* --- wykres --- */
  function serCard(key) {
    var s = H[key]; if (!s) return '';
    var exs = exerciseList(), cur = exs.filter(function (e) { return e.name === s.ex; })[0];
    var h = '<div class="card ser" data-s="' + key + '"><div class="head"><h3><i class="sw" style="background:' + (key === 'A' ? 'var(--sA)' : 'var(--sB)') + (key === 'B' ? ';border-radius:2px' : '') + '"></i>' + (key === 'A' ? 'Seria A' : 'Porównaj z') + '</h3>' + (key === 'B' ? '<button type="button" class="ghost" data-act="rm-b">Usuń</button>' : '') + '</div>';
    h += '<div class="field"><label for="' + key + '-kind">Co pokazać</label><select id="' + key + '-kind" data-k="kind"><option value="ex"' + (s.kind === 'ex' ? ' selected' : '') + '>Ćwiczenie</option><option value="var"' + (s.kind === 'var' ? ' selected' : '') + '>Zmienna z logu (sen, waga, intensywność…)</option></select></div>';
    if (s.kind === 'var') {
      h += '<div class="field"><label for="' + key + '-v">Zmienna</label><select id="' + key + '-v" data-k="v">' + VARS.map(function (v) { return '<option value="' + v.id + '"' + (v.id === s.v ? ' selected' : '') + '>' + esc(v.label) + '</option>'; }).join('') + '</select></div>';
    } else {
      h += '<div class="field"><label for="' + key + '-ex">Ćwiczenie</label><select id="' + key + '-ex" data-k="ex">' + exs.map(function (e) { return '<option value="' + esc(e.name) + '"' + (e.name === s.ex ? ' selected' : '') + '>' + esc(e.name) + ' (' + e.n + '×)</option>'; }).join('') + '</select></div>';
      var sides = cur ? Object.keys(cur.sides) : [];
      if (sides.length > 1) {
        var so = [['all', 'Wszystkie zapisy']]; ['prawa', 'lewa', 'obie'].forEach(function (x) { if (cur.sides[x]) so.push([x, x === 'obie' ? 'Obie ręce (bez podziału)' : x === 'prawa' ? 'Tylko prawa ręka' : 'Tylko lewa ręka']); });
        h += '<div class="field"><label for="' + key + '-side">Ręka</label><select id="' + key + '-side" data-k="side">' + so.map(function (o) { return '<option value="' + o[0] + '"' + (o[0] === s.side ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select></div>';
      }
      h += '<div class="field"><label for="' + key + '-m">Miara</label><select id="' + key + '-m" data-k="m">' + METRICS.map(function (m) { return '<option value="' + m.id + '"' + (m.id === s.m ? ' selected' : '') + '>' + esc(m.label) + ' (' + m.unit + ')</option>'; }).join('') + '</select></div>';
    }
    return h + '</div>';
  }
  function renderChartTab() {
    var body = $('#hist-body');
    body.innerHTML = '<div id="ser-A">' + serCard('A') + '</div><div id="ser-B">' + serCard('B') + '</div>' +
      (H.B ? '' : '<button type="button" class="btn" data-act="add-b">+ Porównaj z inną zmienną lub ćwiczeniem</button>') +
      '<div class="field"><label for="h-smooth">Wygładzanie linii</label><select id="h-smooth"><option value="0"' + (!H.smooth ? ' selected' : '') + '>Brak (każdy pomiar)</option><option value="7"' + (H.smooth === 7 ? ' selected' : '') + '>Średnia z 7 dni</option><option value="30"' + (H.smooth === 30 ? ' selected' : '') + '>Średnia z 30 dni</option></select></div>' +
      '<div class="chartbox" id="chart"></div><p class="chartinfo" id="chart-info" aria-live="polite"></p><div id="chart-stats" class="view"></div>';
    drawAll();
  }
  function smoothPts(pts, days) {
    return pts.map(function (p) {
      var lo = addDays(p.d, -(days - 1)), sum = 0, n = 0;
      pts.forEach(function (q) { if (q.d >= lo && q.d <= p.d) { sum += q.v; n++; } });
      return { d: p.d, v: sum / n };
    });
  }
  function fmtStat(v, unit) { return nf(v) + (unit === 'kg' || unit === 'min' ? ' ' + unit : ''); }
  function drawAll() {
    var box = $('#chart'); if (!box) return;
    var list = [seriesFor(H.A, H.from, H.to)]; if (H.B) list.push(seriesFor(H.B, H.from, H.to));
    var W = Math.max(280, Math.floor(box.clientWidth - 16)) || 340;
    var any = list.some(function (s) { return s.pts.length; });
    var drawn = list.filter(function (s) { return s.pts.length; });
    if (!any) {
      box.innerHTML = '<p class="empty-msg" style="padding:16px">Brak danych dla tych ustawień w wybranym przedziale. Zmień daty albo miarę.</p>';
      $('#chart-info').textContent = ''; $('#chart-stats').innerHTML = ''; return;
    }
    var plot = H.smooth ? list.map(function (s) { return { label: s.label, unit: s.unit, pts: smoothPts(s.pts, H.smooth) }; }) : list;
    var ch = buildChart(plot, W, H.sel);
    box.innerHTML = ch.html;
    var svg = box.querySelector('svg'), hit = svg.querySelector('.hit');
    function pick(ev) {
      var r = svg.getBoundingClientRect(), x = (ev.clientX - r.left) * (W / r.width), best = null, bd = 1e9;
      ch.xs.forEach(function (p) { var dd = Math.abs(p.x - x); if (dd < bd) { bd = dd; best = p.d; } });
      if (best && best !== H.sel) { H.sel = best; drawAll(); }
    }
    hit.addEventListener('pointerdown', pick); hit.addEventListener('pointermove', function (e) { if (e.buttons || e.pointerType === 'mouse') pick(e); });
    var sd = H.sel || (drawn[0].pts[drawn[0].pts.length - 1].d);
    var info = plShortDay(sd) + ': ' + list.map(function (s, i) { var p = s.pts.filter(function (q) { return q.d === sd; })[0]; return (i ? ' · ' : '') + (list.length > 1 ? (i ? 'B ' : 'A ') : '') + (p ? fmtStat(p.v, s.unit) : '—'); }).join('');
    $('#chart-info').textContent = (H.sel ? '' : 'Ostatni pomiar, ') + info + (H.sel ? '' : '. Dotknij wykresu, żeby zobaczyć inne dni.');
    var st = '';
    list.forEach(function (s, i) {
      var key = i === 0 ? 'A' : 'B';
      st += '<div class="card"><h3><i class="sw" style="display:inline-block;width:12px;height:12px;border-radius:' + (i ? '2px' : '50%') + ';margin-right:8px;background:' + (i ? 'var(--sB)' : 'var(--sA)') + '"></i>' + esc(s.label) + '</h3>';
      if (!s.pts.length) { st += '<p class="empty-msg">Brak pomiarów w tym przedziale.</p></div>'; return; }
      var vals = s.pts.map(function (p) { return p.v; }), mn = Math.min.apply(null, vals), mx = Math.max.apply(null, vals), av = vals.reduce(function (a, x) { return a + x; }, 0) / vals.length;
      var first = vals[0], last = vals[vals.length - 1], dl = last - first, pct = first ? dl / Math.abs(first) * 100 : null;
      st += '<dl class="statgrid"><div><dt>Pomiary</dt><dd>' + vals.length + '</dd></div><div><dt>Średnia</dt><dd>' + fmtStat(av, s.unit) + '</dd></div><div><dt>Min</dt><dd>' + fmtStat(mn, s.unit) + '</dd></div><div><dt>Maks</dt><dd>' + fmtStat(mx, s.unit) + '</dd></div>' +
        '<div><dt>Zmiana (pierwszy → ostatni)</dt><dd>' + (dl > 0 ? '+' : '') + fmtStat(dl, s.unit) + (pct != null && isFinite(pct) ? ' (' + (pct > 0 ? '+' : '') + Math.round(pct) + '%)' : '') + '</dd></div></dl>';
      st += '<details><summary style="min-height:44px;display:flex;align-items:center;cursor:pointer;color:var(--muted);font-weight:600">Pokaż dane</summary><div class="datarows"><span class="h">Data</span><span class="h">' + key + '</span><span class="h"></span>' +
        s.pts.slice().reverse().map(function (p) { return '<span>' + esc(plDate(p.d)) + '</span><span>' + fmtStat(p.v, s.unit) + '</span><span></span>'; }).join('') + '</div></details></div>';
    });
    $('#chart-stats').innerHTML = st;
  }
  function rerenderSer(key) { var el = $('#ser-' + key); if (el) el.innerHTML = serCard(key); }

  var hv = $('#view-hist');
  hv.addEventListener('click', function (e) {
    var b = e.target.closest('[data-act]'); if (!b) return;
    var a = b.dataset.act;
    if (a === 'tab') { H.tab = b.dataset.t; H.sel = null; renderHist(); }
    else if (a === 'preset') { setPreset(b.dataset.k); H.shown = 30; H.sel = null; renderHist(); }
    else if (a === 'more') { H.shown += 30; renderList(); }
    else if (a === 'add-b') { H.B = defaultSpec('var'); H.sel = null; renderChartTab(); }
    else if (a === 'rm-b') { H.B = null; H.sel = null; renderChartTab(); }
  });
  hv.addEventListener('change', function (e) {
    var t = e.target;
    if (t.id === 'h-from' || t.id === 'h-to') {
      if (t.id === 'h-from') H.from = t.value || H.from; else H.to = t.value || H.to;
      if (H.from > H.to) { var x = H.from; H.from = H.to; H.to = x; }
      H.preset = ''; H.shown = 30; H.sel = null; renderHist(); return;
    }
    if (t.id === 'h-ex') { H.ex = t.value; H.shown = 30; renderList(); return; }
    if (t.id === 'h-smooth') { H.smooth = +t.value; H.sel = null; drawAll(); return; }
    var card = t.closest('.ser'); if (!card || !t.dataset.k) return;
    var key = card.dataset.s, s = H[key], k = t.dataset.k;
    if (k === 'kind') { H[key] = defaultSpec(t.value); s = H[key]; }
    else if (k === 'ex') { s.ex = t.value; s.side = 'all'; s.m = smartMetric(t.value); }
    else s[k] = t.value;
    H.sel = null; rerenderSer(key); drawAll();
  });
  var rz; window.addEventListener('resize', function () { clearTimeout(rz); rz = setTimeout(function () { if (!$('#view-hist').hidden && H.tab === 'chart') drawAll(); }, 150); });

  /* ---------- PLAN MAKRO ---------- */
  // Fazy w arkuszu idą od lewej do prawej (najstarsze pierwsze). Rok wynika z kolejności: nagłówek "Czerwiec 2025"
  // i "Styczeń 2026" podają go wprost, a przy przejściu grudzień -> styczeń rok rośnie.
  function planTimeline(phases) {
    var year = null, prev = -1, out = [];
    phases.forEach(function (p) {
      var hm = /\b(20\d\d)\b/.exec(p.month || ''), yHint = hm ? +hm[1] : null;
      var mm = /(\d{1,2})(?:\.(\d{1,2}))?\s*-\s*(\d{1,2})\.(\d{1,2})/.exec(p.title || '');
      var mi, d0 = null, d1 = null, m1 = null;
      if (mm) { d0 = +mm[1]; d1 = +mm[3]; m1 = +mm[4] - 1; mi = (mm[2] ? +mm[2] : +mm[4]) - 1; }
      else { var nm = (p.month || '').toLowerCase().replace(/[^a-ząćęłńóśźż ]/g, '').trim().split(/\s+/)[0], k = MONTHS.indexOf(nm); mi = k; }
      if (year === null) year = yHint || 2025;
      else if (yHint) year = yHint;
      else if (prev >= 0 && mi >= 0 && mi < prev - 5) year++;
      if (mi >= 0) prev = mi;
      var label = '';
      if (mm) {
        var y1 = m1 < mi ? year + 1 : year;
        label = (m1 === mi && d1 < d0) ? d0 + '.' + p2(mi + 1) + '.' + year : d0 + '.' + p2(mi + 1) + '.' + year + ' – ' + d1 + '.' + p2(m1 + 1) + '.' + y1;
      } else if (mi >= 0) label = MONTHS[mi].charAt(0).toUpperCase() + MONTHS[mi].slice(1) + ' ' + year;
      out.push({ p: p, y: year, m: mi, label: label });
    });
    return out;
  }
  function renderPlan() {
    var root = $('#view-plan'), plan = LT.plan();
    if (!plan || !plan.phases || !plan.phases.length) {
      root.innerHTML = '<div class="card"><h3>Brak planu makro</h3><p class="empty-msg">Plan makro pobiera się z zakładki „Plan Makro” w arkuszu razem z resztą danych. ' + (LT.configured() ? 'Odśwież dane na ekranie startowym.' : 'Najpierw ustaw połączenie z arkuszem w menu.') + '</p></div>';
      return;
    }
    var tl = planTimeline(plan.phases).reverse();       // najnowsze na górze
    var h = '<p class="sub-title">Plan makro z arkusza (tylko do odczytu). ' + tl.length + ' ' + LT.plural(tl.length, 'faza', 'fazy', 'faz') + ', od najnowszej. Dotknij fazy, żeby zobaczyć plan tygodni i notatki.</p>';
    var group = '';
    tl.forEach(function (x) {
      var g = x.m >= 0 ? MONTHS[x.m].charAt(0).toUpperCase() + MONTHS[x.m].slice(1) + ' ' + x.y : '';
      if (g && g !== group) { h += '<h3 class="mh">' + esc(g) + '</h3>'; group = g; }
      h += '<details class="ph"><summary><span class="pt">' + esc(x.p.title) + '</span>' + (x.label ? '<span class="pm">' + esc(x.label) + (x.p.bp ? ' · Big Picture, orientacyjnie' : '') + '</span>' : '') + '</summary><div class="bd">';
      if (!x.p.rows.length) h += '<p class="empty-msg">Brak dodatkowych notatek w tej fazie.</p>';
      var lastL = null;
      x.p.rows.forEach(function (r) {
        h += '<div class="ex" style="border-top:0;padding-top:0">' + (r.l && r.l !== lastL ? '<p class="sec-h">' + esc(r.l) + '</p>' : '') + '<p class="line" style="white-space:pre-line">' + esc(r.t) + '</p></div>'; lastL = r.l;
      });
      h += '</div></details>';
    });
    root.innerHTML = h;
  }

  LT.register('cal', renderCal);
  LT.register('hist', renderHist);
  LT.register('plan', renderPlan);
})();
