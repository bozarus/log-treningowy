(function () {
  'use strict';
  var C = window.LT_CONFIG;
  var CATN = { palce: 'Palce', silka: 'Siłka' };
  var MAXSETS = C.maxSets;

  /* ---------- helpers ---------- */
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function num(v) { if (v == null || v === '') return null; var n = parseFloat(String(v).replace(',', '.')); return isFinite(n) ? n : null; }
  function fmt(n) { return n == null ? '' : String(n).replace('.', ','); }
  function today() { try { return new Date().toLocaleDateString('sv-SE'); } catch (e) { var d = new Date(); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); } }
  function nowHM() { var d = new Date(); return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2); }
  function uuid() { try { if (crypto.randomUUID) return crypto.randomUUID(); } catch (e) {} return 'id-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10); }
  // Każda kopia aplikacji (stabilna, testowa) ma własną przestrzeń pamięci, nawet gdy stoją pod jednym adresem.
  var NS = 'lt:' + location.pathname.replace(/index\.html$/, '') + ':';
  function lsGet(k, d) { try { var v = localStorage.getItem(NS + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }
  function lsSet(k, v) { try { localStorage.setItem(NS + k, JSON.stringify(v)); return true; } catch (e) { return false; } }
  function getPath(o, p) { return p.split('.').reduce(function (a, k) { return a == null ? a : a[k]; }, o); }
  function setPath(o, p, v) { var ks = p.split('.'), last = ks.pop(); var t = ks.reduce(function (a, k) { return a[k]; }, o); t[last] = v; }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  /* ---------- state ---------- */
  var uid = 1;
  function newBlock(cat) { return { id: uid++, cat: cat || 'silka', name: '', side: 'obie', comment: '', main: null, rest: '', sets: [{ reps: '', kg: null }] }; }
  function freshState() {
    return {
      v: 1, date: today(), waga: '', sen: null, wyr: null, types: [], typeOther: '', cele: '',
      warm: { start: '', end: '', drills: [], comment: '', acc: 0, since: null },
      blocks: [newBlock('silka')],
      sum: { ile1: '', focus1: '', focus1Other: '', rest1: '', przebieg1: '', ile2: '', focus2: '', focus2Other: '', rest2: '', przebieg2: '',
        intSubj: null, fiz: null, jak: null, check: [], sukcesy: '', slabe: '', komentarz: '' },
    };
  }
  var state = lsGet('lt-draft', null) || freshState();
  if (!state.blocks || !state.blocks.length) state.blocks = [newBlock('silka')];
  state.blocks.forEach(function (b) { if (b.id >= uid) uid = b.id + 1; });

  var custom = lsGet('lt-custom', { palce: [], silka: [] });
  (function migrateLegacyPalceNames() {
    var map = C.legacyPalceRename || {}; if (!Object.keys(map).length) return;
    var list = custom.palce || [], out = [], changed = false;
    list.forEach(function (n) {
      var nn = Object.prototype.hasOwnProperty.call(map, n) ? map[n] : n;
      if (nn !== n) changed = true;
      if (out.indexOf(nn) === -1) out.push(nn);
    });
    if (changed) { custom.palce = out; lsSet('lt-custom', custom); pushState(); }
  })();
  function listFor(cat) { return C.exercises[cat].concat((custom[cat] || []).filter(function (n) { return C.exercises[cat].indexOf(n) === -1; })); }
  var cfg = lsGet('lt-cfg', { url: '', token: '', theme: 'auto' });

  /* ---------- dane z arkusza (Kalendarz, Historia, Plan, podpowiedzi „Ostatnio”) ---------- */
  var DATA = window.LT_DATA || lsGet('lt-data', null);
  var recent = lsGet('lt-recent', []);      // treningi zapisane w tym telefonie, których arkusz jeszcze nie oddał w danych
  var planned = lsGet('lt-planned', []);    // zaplanowane treningi (Kalendarz), na razie tylko w tym telefonie
  function trainings() {
    var all = ((DATA && DATA.trainings) || []).concat(recent);
    all.sort(function (a, b) { return a.d < b.d ? -1 : a.d > b.d ? 1 : ((a.ts || '') < (b.ts || '') ? -1 : 1); });
    return all;
  }
  function lastFor(name) {
    var all = trainings();
    for (var i = all.length - 1; i >= 0; i--) {
      var bl = all[i].b;
      for (var j = 0; j < bl.length; j++) {
        if (bl[j].n === name && bl[j].p && bl[j].p.length) {
          var b = bl[j];
          return { date: all[i].d, kg: b.kg != null ? b.kg : null, rest: b.r || '', reps: b.p, kgs: b.kgs || null };
        }
      }
    }
    return null;
  }
  function lastWaga() { var a = trainings(); for (var i = a.length - 1; i >= 0; i--) if (a[i].w != null) return a[i].w; return null; }
  function localTs(iso) {
    var d = new Date(iso); function p(n) { return ('0' + n).slice(-2); }
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + 'T' + p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds());
  }
  function entryToTraining(e) {
    var w = e.warm || {}, wu = {}, t = { i: 0, qid: e.id, d: e.date, ts: localTs(e.ts), t: e.rodzaj ? e.rodzaj.split(', ') : [], b: [] };
    if (w.start) wu.s = w.start; if (w.end) wu.e = w.end; if (w.drills) wu.dr = w.drills; if (w.comment) wu.k = w.comment;
    if (e.waga != null) t.w = e.waga; if (e.sen != null) t.sen = e.sen; if (e.wyr != null) t.wyr = e.wyr;
    if (e.cele) t.cele = e.cele; if (Object.keys(wu).length) t.wu = wu;
    (e.blocks || []).forEach(function (b) {
      var p = (b.powt || []).filter(function (x) { return x != null; });
      var blk = { c: b.slot < 4 ? 'palce' : 'silka', n: b.cwiczenie, p: p };
      if (b.komentarz) blk.k = b.komentarz;
      if (b.kg != null) blk.kg = b.kg;
      var kgs = (b.kgs || []).slice(0, p.length); if (kgs.some(function (x) { return x != null; })) blk.kgs = kgs;
      if (b.rest) blk.r = String(b.rest);
      t.b.push(blk);
    });
    var s = e.sum || {}, q = {};
    [['ile1', 'ile1'], ['f1', 'focus1'], ['pr1', 'przebieg1'], ['r1', 'rest1'], ['f2', 'focus2'], ['pr2', 'przebieg2'], ['r2', 'rest2'], ['int', 'intSubj'],
     ['fiz', 'fiz'], ['jak', 'jak'], ['chk', 'check'], ['suk', 'sukcesy'], ['kom', 'komentarz'], ['sl', 'slabe'], ['ile2', 'ile2']].forEach(function (m) {
      var v = s[m[1]]; if (v !== '' && v != null) q[m[0]] = v;
    });
    if (Object.keys(q).length) t.s = q;
    return t;
  }

  var saveTimer;
  function scheduleSave() { clearTimeout(saveTimer); saveTimer = setTimeout(function () { lsSet('lt-draft', state); }, 300); }

  /* ---------- toast ---------- */
  var toastTimer;
  function toast(msg, isErr) {
    var t = $('#toast'); t.textContent = msg; t.className = 'toast' + (isErr ? ' err' : ''); t.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.hidden = true; }, isErr ? 6000 : 3500);
  }

  /* ---------- theme ---------- */
  function applyTheme() {
    var r = document.documentElement;
    if (cfg.theme === 'light' || cfg.theme === 'dark') r.setAttribute('data-theme', cfg.theme); else r.removeAttribute('data-theme');
  }

  /* ---------- simple bound fields ---------- */
  function fillFocusSelects() {
    $$('select[data-focus]').forEach(function (s) {
      s.innerHTML = '<option value="">—</option>' + C.focusOptions.map(function (o) { return '<option>' + esc(o) + '</option>'; }).join('') + '<option value="__other">Inne…</option>';
    });
  }
  function bindAll() {
    $$('[data-bind]').forEach(function (el) {
      if (document.activeElement === el) return;
      var v = getPath(state, el.dataset.bind); el.value = v == null ? '' : v;
    });
    $$('[data-scale]').forEach(renderScale);
    $$('[data-multi]').forEach(renderMulti);
    $('#int-hint').textContent = C.intensityHint;
    var lw = lastWaga(); $('#waga').placeholder = lw != null ? fmt(lw) : '';
    if (state.sum.ile2 || state.sum.focus2 || state.sum.rest2 || state.sum.przebieg2) $('#sub-t2').open = true;
    renderTimer(); updateConditionals(); updateBadges();
  }
  function renderScale(el) {
    var p = el.dataset.scale, cur = getPath(state, p), h = '';
    for (var i = 1; i <= 5; i++) h += '<button type="button" data-v="' + i + '" aria-pressed="' + (cur === i) + '">' + i + '</button>';
    el.innerHTML = h;
  }
  function renderMulti(el) {
    var p = el.dataset.multi, cur = getPath(state, p) || [], opts = C[el.dataset.options], h = '';
    opts.forEach(function (o) { h += '<button type="button" data-v="' + esc(o) + '" aria-pressed="' + (cur.indexOf(o) > -1) + '">' + esc(o) + '</button>'; });
    if (el.dataset.other) h += '<button type="button" data-v="__other" aria-pressed="' + (cur.indexOf('__other') > -1) + '">Inne</button>';
    el.innerHTML = h;
  }
  function updateConditionals() {
    $$('[data-show]').forEach(function (el) {
      var parts = el.dataset.show.split(':'), cur = getPath(state, parts[0]);
      el.hidden = !(Array.isArray(cur) ? cur.indexOf(parts[1]) > -1 : cur === parts[1]);
    });
  }
  function anyFilled(o) {
    return Object.keys(o).some(function (k) { var v = o[k]; return Array.isArray(v) ? v.length : (v !== '' && v != null && v !== 0); });
  }
  function updateBadges() {
    $('#badge-warm').textContent = anyFilled(state.warm) ? 'uzupełnione' : '';
    $('#badge-sum').textContent = anyFilled(state.sum) ? 'uzupełnione' : '';
  }

  document.addEventListener('input', function (e) {
    var t = e.target;
    if (t.dataset && t.dataset.bind) {
      setPath(state, t.dataset.bind, t.value); scheduleSave(); updateConditionals(); updateBadges();
    }
  });
  document.addEventListener('change', function (e) {
    var t = e.target;
    if (t.dataset && t.dataset.bind && t.tagName === 'SELECT') { setPath(state, t.dataset.bind, t.value); scheduleSave(); updateConditionals(); updateBadges(); }
  });
  document.addEventListener('click', function (e) {
    var sc = e.target.closest('[data-scale] button');
    if (sc) { var p = sc.parentNode.dataset.scale, v = +sc.dataset.v; setPath(state, p, getPath(state, p) === v ? null : v); renderScale(sc.parentNode); scheduleSave(); updateBadges(); return; }
    var mu = e.target.closest('[data-multi] button');
    if (mu) {
      var box = mu.parentNode, path = box.dataset.multi, arr = getPath(state, path), val = mu.dataset.v, i = arr.indexOf(val);
      if (i > -1) arr.splice(i, 1); else arr.push(val);
      renderMulti(box); updateConditionals(); scheduleSave(); updateBadges(); return;
    }
  });

  /* ---------- stoper rozgrzewki ---------- */
  var tickId = null, wakeLock = null;
  function elapsedMs() { var w = state.warm; return (w.acc || 0) + (w.since ? Date.now() - w.since : 0); }
  function fmtElapsed(ms) {
    var s = Math.floor(ms / 1000), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60;
    function p(n) { return ('0' + n).slice(-2); }
    return (h ? h + ':' + p(m) : p(m)) + ':' + p(ss);
  }
  function renderTimer() {
    var w = state.warm, btn = $('#timer'), running = !!w.since, el = elapsedMs();
    $('#timer-t').textContent = fmtElapsed(el);
    btn.classList.toggle('running', running); btn.classList.toggle('paused', !running && el > 0);
    btn.setAttribute('aria-pressed', String(running));
    $('#timer-s').textContent = running ? 'Trwa · dotknij, żeby zatrzymać' : (el > 0 ? 'Pauza · dotknij, żeby wznowić' : 'Dotknij, żeby zacząć');
    $('#timer-times').textContent = w.start ? 'Start ' + w.start + (w.end && !running ? ' · Koniec ' + w.end : '') : '';
    ['w-start', 'w-end'].forEach(function (id) { var i = $('#' + id); if (i && document.activeElement !== i) i.value = w[id === 'w-start' ? 'start' : 'end'] || ''; });
  }
  function startTick() { if (tickId) return; tickId = setInterval(function () { $('#timer-t').textContent = fmtElapsed(elapsedMs()); }, 250); }
  function stopTick() { clearInterval(tickId); tickId = null; }
  function requestWake() { try { if (navigator.wakeLock) navigator.wakeLock.request('screen').then(function (l) { wakeLock = l; }).catch(function () {}); } catch (e) {} }
  function releaseWake() { try { if (wakeLock) wakeLock.release(); } catch (e) {} wakeLock = null; }
  function timerToggle() {
    var w = state.warm;
    if (w.since) { w.acc = (w.acc || 0) + (Date.now() - w.since); w.since = null; w.end = nowHM(); stopTick(); releaseWake(); }
    else { if (!w.start) w.start = nowHM(); w.end = ''; w.since = Date.now(); startTick(); requestWake(); }
    scheduleSave(); renderTimer(); updateBadges();
  }
  function timerReset() {
    var w = state.warm; w.acc = 0; w.since = null; w.start = ''; w.end = ''; stopTick(); releaseWake();
    try { if (navigator.vibrate) navigator.vibrate(40); } catch (e) {}
    scheduleSave(); renderTimer(); updateBadges(); toast('Stoper wyzerowany.');
  }
  (function () {
    var btn = $('#timer'), pressT = null, longDone = false;
    btn.addEventListener('pointerdown', function () { longDone = false; clearTimeout(pressT); pressT = setTimeout(function () { longDone = true; timerReset(); }, 700); });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(function (ev) { btn.addEventListener(ev, function () { clearTimeout(pressT); }); });
    btn.addEventListener('click', function (e) { if (longDone) { longDone = false; e.preventDefault(); return; } timerToggle(); });
    btn.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    btn.addEventListener('keydown', function (e) { if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); timerReset(); } });
  })();
  document.addEventListener('visibilitychange', function () { if (!document.hidden && state.warm.since) { renderTimer(); requestWake(); } });

  /* ---------- exercise blocks ---------- */
  function sideSuffix(name, side) { var m = C.sideSuffix[name] || ['prawa', 'lewa']; return side === 'prawa' ? m[0] : m[1]; }
  function sheetName(b) { return b.side === 'obie' || !b.name ? b.name : b.name + ' ' + sideSuffix(b.name, b.side); }
  function wt(b, i) { var s = b.sets[i]; return s.kg != null ? s.kg : b.main; }
  function normalize(b) { if (b.sets[0]) b.sets[0].kg = null; b.sets.forEach(function (s) { if (s.kg != null && s.kg === b.main) s.kg = null; }); }
  function count(cat) { return state.blocks.filter(function (b) { return b.cat === cat; }).length; }
  function findBlock(id) { for (var i = 0; i < state.blocks.length; i++) if (state.blocks[i].id === id) return state.blocks[i]; }

  function setHTML(b, s, i) {
    return '<div class="set" data-i="' + i + '"><span class="n">' + (i + 1) + '</span>' +
      '<label class="f"><small>powt./sek.</small><input class="reps" inputmode="numeric" aria-label="Seria ' + (i + 1) + ' powtórzenia lub sekundy" value="' + esc(s.reps) + '"></label>' +
      '<label class="f"><small>kg</small><input class="kg" inputmode="decimal" aria-label="Seria ' + (i + 1) + ' ciężar" value=""></label>' +
      '<button class="x" type="button" data-act="rm-set" aria-label="Usuń serię ' + (i + 1) + '">×</button></div>';
  }
  function selectHTML(b) {
    return '<button type="button" class="exsel" id="e' + b.id + '" data-act="pick-ex" aria-haspopup="dialog">' +
      (b.name ? esc(b.name) : '<span class="ph">Wybierz ćwiczenie…</span>') + '</button>';
  }
  function lastHTML(b) {
    var h = b.name ? lastFor(sheetName(b)) : null; if (!h || !h.reps || !h.reps.length) return '';
    var d = h.date ? h.date.slice(8, 10) + '.' + h.date.slice(5, 7) : '';
    var kgs = (h.kgs && h.kgs.some(function (x) { return x != null; })) ? h.kgs.filter(function (x) { return x != null; }) : (h.kg != null ? [h.kg] : []);
    var same = kgs.every(function (x) { return x === kgs[0]; });
    var txt = 'Ostatnio' + (d ? ' (' + d + ')' : '') + ': ' + h.reps.map(fmt).join('/') + ' powt.' + (kgs.length ? ' @ ' + (same ? fmt(kgs[0]) : kgs.map(fmt).join('/')) + ' kg' : '');
    return '<div class="last"><span>' + esc(txt) + '</span><button class="btn small" type="button" data-act="apply-last">Jak ostatnio</button></div>';
  }
  function blockHTML(b) {
    var head = b.name
      ? '<span class="cat">' + CATN[b.cat] + '</span>'
      : '<div class="seg" role="group" aria-label="Kategoria ćwiczenia" style="flex-grow:1">' + ['palce', 'silka'].map(function (c) { return '<button type="button" data-act="cat" data-v="' + c + '" aria-pressed="' + (b.cat === c) + '">' + CATN[c] + '</button>'; }).join('') + '</div>';
    return '<article class="block" data-id="' + b.id + '">' +
      '<header class="bh">' + head + '<span class="flag" hidden>różne ciężary</span><button class="ghost" type="button" data-act="rm-block" aria-label="Usuń ćwiczenie">Usuń</button></header>' +
      selectHTML(b) +
      '<div class="newex" hidden><input class="newname" placeholder="Nazwa nowego ćwiczenia" aria-label="Nazwa nowego ćwiczenia"><button class="btn primary" type="button" data-act="new-ok">Dodaj</button></div>' +
      '<div class="side" role="group" aria-label="Ręka">' + [['obie', 'Obie ręce'], ['prawa', 'Prawa'], ['lewa', 'Lewa']].map(function (o) { return '<button type="button" data-act="side" data-v="' + o[0] + '" aria-pressed="' + (b.side === o[0]) + '">' + o[1] + '</button>'; }).join('') + '</div>' +
      lastHTML(b) +
      '<div class="row2">' +
        '<div class="field"><label for="m' + b.id + '">Ciężar główny (kg)</label><div class="step"><button type="button" data-act="dec" aria-label="Mniej o 2,5 kg">−</button><input id="m' + b.id + '" class="main" inputmode="decimal" placeholder="0" value="' + fmt(b.main) + '"><button type="button" data-act="inc" aria-label="Więcej o 2,5 kg">+</button></div></div>' +
        '<div class="field"><label for="r' + b.id + '">Rest</label><input id="r' + b.id + '" class="rest" placeholder="5:00" value="' + esc(b.rest) + '"></div>' +
      '</div>' +
      '<div class="sets">' + b.sets.map(function (s, i) { return setHTML(b, s, i); }).join('') + '</div>' +
      '<button class="btn addset" type="button" data-act="add-set">+ Seria</button>' +
      '<div class="field"><label for="c' + b.id + '">Komentarz</label><input id="c' + b.id + '" class="comment" value="' + esc(b.comment) + '"></div>' +
    '</article>';
  }
  function blockEl(id) { return document.querySelector('.block[data-id="' + id + '"]'); }
  function patch(b) {
    var el = blockEl(b.id); if (!el) return;
    var rows = $$('.set', el);
    for (var i = 0; i < rows.length; i++) {
      var inp = $('.kg', rows[i]);
      if (document.activeElement !== inp) inp.value = fmt(wt(b, i));
      inp.placeholder = fmt(b.main);
      rows[i].classList.toggle('diff', b.sets[i].kg != null);
    }
    $('.flag', el).hidden = !b.sets.some(function (s) { return s.kg != null; });
    $('[data-act="add-set"]', el).disabled = b.sets.length >= MAXSETS;
  }
  function rerender(b, focusIdx) {
    var el = blockEl(b.id), tmp = document.createElement('div');
    tmp.innerHTML = blockHTML(b);
    var fresh = tmp.firstChild; el.replaceWith(fresh); patch(b);
    if (focusIdx != null) { var r = $$('.set .reps', fresh)[focusIdx]; if (r) r.focus(); }
  }
  function renderBlocks() {
    $('#blocks').innerHTML = state.blocks.map(blockHTML).join('');
    state.blocks.forEach(patch); renderAdd();
  }

  var host = $('#blocks');
  host.addEventListener('input', function (e) {
    var el = e.target.closest('.block'); if (!el) return;
    var b = findBlock(+el.dataset.id), t = e.target;
    if (t.classList.contains('main')) {
      var c = t.value.replace(/[^\d.,]/g, ''); if (c !== t.value) t.value = c;
      b.main = num(c); normalize(b); patch(b);
    } else if (t.classList.contains('rest')) { b.rest = t.value; }
    else if (t.classList.contains('comment')) { b.comment = t.value; }
    else if (t.classList.contains('reps')) {
      var r = t.value.replace(/[^\d.,]/g, ''); if (r !== t.value) t.value = r;
      b.sets[+t.closest('.set').dataset.i].reps = r;
    } else if (t.classList.contains('kg')) {
      var k = t.value.replace(/[^\d.,]/g, ''); if (k !== t.value) t.value = k;
      var j = +t.closest('.set').dataset.i, v = num(k);
      if (j === 0) { if (v != null) { b.main = v; normalize(b); $('.main', el).value = fmt(v); } }
      else b.sets[j].kg = (v == null || v === b.main) ? null : v;
      patch(b);
    } else return;
    scheduleSave();
  });
  host.addEventListener('focusout', function (e) {
    if (e.target.classList.contains('kg')) { var el = e.target.closest('.block'); if (el) patch(findBlock(+el.dataset.id)); }
  });
  host.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && e.target.classList.contains('newname')) { e.preventDefault(); $('[data-act="new-ok"]', e.target.closest('.block')).click(); }
  });
  host.addEventListener('click', function (e) {
    var t = e.target.closest('button[data-act]'); if (!t) return;
    var el = t.closest('.block'), b = findBlock(+el.dataset.id), a = t.dataset.act;
    if (a === 'inc' || a === 'dec') {
      b.main = Math.max(0, Math.round(((b.main || 0) + (a === 'inc' ? 2.5 : -2.5)) * 100) / 100);
      normalize(b); $('.main', el).value = fmt(b.main); patch(b);
    } else if (a === 'add-set') {
      if (b.sets.length >= MAXSETS) return;
      var last = b.sets[b.sets.length - 1];
      b.sets.push({ reps: last ? last.reps : '', kg: null }); rerender(b, b.sets.length - 1);
    } else if (a === 'rm-set') {
      if (b.sets.length <= 1) return;
      var idx = +t.closest('.set').dataset.i; b.sets.splice(idx, 1);
      if (idx === 0 && b.sets[0].kg != null) b.main = b.sets[0].kg;
      normalize(b); rerender(b);
    } else if (a === 'rm-block') {
      state.blocks = state.blocks.filter(function (x) { return x !== b; });
      if (!state.blocks.length) { state.blocks = [newBlock('silka')]; renderBlocks(); } else { el.remove(); renderAdd(); }
    } else if (a === 'side') {
      b.side = t.dataset.v; rerender(b);
    } else if (a === 'cat') {
      var cat = t.dataset.v; if (cat === b.cat) return;
      if (count(cat) >= C.limits[cat]) { toast('W arkuszu jest miejsce na ' + C.limits[cat] + ' bloków „' + CATN[cat] + '”.', true); return; }
      b.cat = cat; rerender(b); renderAdd();
    } else if (a === 'pick-ex') {
      openExPicker(b); return;
    } else if (a === 'new-ok') {
      var inp = $('.newname', el), n = inp.value.trim(); if (!n) { inp.focus(); return; }
      if (listFor(b.cat).indexOf(n) === -1) { custom[b.cat].push(n); lsSet('lt-custom', custom); pushState(); }
      b.name = n; rerender(b);
    } else if (a === 'apply-last') {
      var h = lastFor(sheetName(b)); if (!h) return;
      var kgs = h.kgs || [];
      b.main = kgs[0] != null ? kgs[0] : (h.kg != null ? h.kg : null);
      if (h.rest != null && h.rest !== '') b.rest = String(h.rest);
      b.sets = h.reps.map(function (r, i) { var k = kgs[i]; return { reps: String(r).replace('.', ','), kg: (k != null && k !== b.main) ? k : null }; });
      if (!b.sets.length) b.sets = [{ reps: '', kg: null }];
      normalize(b); rerender(b);
    } else return;
    scheduleSave();
  });

  /* ---------- wybór ćwiczenia: szukajka + kaskadowe filtry ---------- */
  var exPickBlock = null, exFilters = {};
  // Wszystkie ćwiczenia, które kiedykolwiek pojawiły się w historii (nie tylko podpowiedzi/własne).
  function historyNames(cat) {
    var seen = {}, out = [];
    trainings().forEach(function (t) { t.b.forEach(function (bl) { if (bl.c === cat && bl.n && !seen[bl.n]) { seen[bl.n] = 1; out.push(bl.n); } }); });
    return out;
  }
  function allNamesFor(cat) {
    var out = listFor(cat).slice(), seen = {}; out.forEach(function (n) { seen[n] = 1; });
    historyNames(cat).forEach(function (n) { if (!seen[n]) { seen[n] = 1; out.push(n); } });
    return out;
  }
  function facetOf(cat, n, key) {
    if (cat === 'palce') { var f = (C.palceFacets || {})[n]; return f && f[key]; }
    if (cat === 'silka') return (C.silkaGroups || {})[n] || 'Inne';
    return null;
  }
  function facetDefs(cat) {
    return cat === 'palce'
      ? [['cwiczenie', 'Ćwiczenie'], ['liczba', 'Liczba palców'], ['chwyt', 'Chwyt'], ['krawadka', 'Krawądka'], ['urzadzenie', 'Urządzenie']]
      : [['grupa', 'Rodzaj']];
  }
  // Kaskadowo: opcje w wierszu liczą się z ćwiczeń pasujących do POZOSTAŁYCH już wybranych filtrów
  // (nie do siebie samego), więc np. po wybraniu "Max Hangs" w Krawądce widać tylko krawędzie, które on ma.
  function exGroups(b) {
    var names = allNamesFor(b.cat);
    return facetDefs(b.cat).map(function (d) {
      var key = d[0], label = d[1];
      var otherKeys = Object.keys(exFilters).filter(function (k) { return k !== key; });
      var cand = names.filter(function (n) { return otherKeys.every(function (k) { return facetOf(b.cat, n, k) === exFilters[k]; }); });
      var seen = {}, opts = [];
      cand.forEach(function (n) { var v = facetOf(b.cat, n, key); if (v && !seen[v]) { seen[v] = 1; opts.push(v); } });
      return { key: key, label: label, options: opts };
    }).filter(function (r) { return r.options.length >= 1; });
  }
  function exMatches(b, n, q) {
    if (q && n.toLowerCase().indexOf(q) === -1) return false;
    return Object.keys(exFilters).every(function (k) { return facetOf(b.cat, n, k) === exFilters[k]; });
  }
  function renderExFilters(b) {
    var rows = exGroups(b);
    $('#exfilters').innerHTML = rows.map(function (r) {
      return '<div class="exfrow"><span class="lbl">' + esc(r.label) + '</span><div class="chips">' +
        r.options.map(function (o) { return '<button type="button" data-k="' + esc(r.key) + '" data-v="' + esc(o) + '" aria-pressed="' + (exFilters[r.key] === o) + '">' + esc(o) + '</button>'; }).join('') +
        '</div></div>';
    }).join('');
  }
  function renderExList(b) {
    var q = $('#exq').value.trim().toLowerCase();
    var names = allNamesFor(b.cat).filter(function (n) { return exMatches(b, n, q); });
    var h = names.map(function (n) { return '<button type="button" data-name="' + esc(n) + '">' + esc(n) + '</button>'; }).join('');
    if (!names.length) h += '<p class="exempty">Nic nie pasuje — spróbuj mniej filtrów.</p>';
    h += '<button type="button" data-new="1">+ Nowe ćwiczenie…</button>';
    $('#exlist').innerHTML = h;
  }
  function openExPicker(b) {
    exPickBlock = b; exFilters = {};
    $('#exq').value = '';
    renderExFilters(b); renderExList(b);
    $('#exdlg').showModal();
    setTimeout(function () { $('#exq').focus(); }, 50);
  }
  $('#exq').addEventListener('input', function () { if (exPickBlock) renderExList(exPickBlock); });
  $('#exfilters').addEventListener('click', function (e) {
    var t = e.target.closest('button[data-k]'); if (!t || !exPickBlock) return;
    var k = t.dataset.k, v = t.dataset.v;
    if (exFilters[k] === v) delete exFilters[k]; else exFilters[k] = v;
    renderExFilters(exPickBlock); renderExList(exPickBlock);
  });
  $('#exlist').addEventListener('click', function (e) {
    var t = e.target.closest('button'); if (!t || !exPickBlock) return;
    var b = exPickBlock;
    $('#exdlg').close();
    if (t.dataset.new) { var el = blockEl(b.id), ne = $('.newex', el); ne.hidden = false; $('.newname', el).focus(); return; }
    b.name = t.dataset.name; scheduleSave(); rerender(b);
  });

  /* ---------- add exercise ---------- */
  function renderAdd() {
    $('#addbtns').innerHTML = ['palce', 'silka'].map(function (k) {
      return '<button class="btn" type="button" data-cat="' + k + '"' + (count(k) >= C.limits[k] ? ' disabled' : '') + '>+ ' + CATN[k] + '<small>' + count(k) + ' z ' + C.limits[k] + '</small></button>';
    }).join('');
  }
  function closeAdd() { $('#addbtns').hidden = true; var o = $('#addopen'); o.setAttribute('aria-expanded', 'false'); o.textContent = '+ Dodaj ćwiczenie'; }
  $('#addopen').addEventListener('click', function () {
    var box = $('#addbtns'); if (!box.hidden) { closeAdd(); return; }
    renderAdd(); box.hidden = false; this.setAttribute('aria-expanded', 'true'); this.textContent = 'Anuluj';
  });
  $('#addbtns').addEventListener('click', function (e) {
    var t = e.target.closest('button'); if (!t || t.disabled) return;
    var cat = t.dataset.cat; if (count(cat) >= C.limits[cat]) return;
    var b = newBlock(cat); state.blocks.push(b);
    host.insertAdjacentHTML('beforeend', blockHTML(b)); patch(b); renderAdd(); closeAdd(); scheduleSave();
    blockEl(b.id).scrollIntoView({ behavior: 'smooth', block: 'center' });
  });

  /* ---------- build entry ---------- */
  function focusVal(v, other) { return v === '__other' ? (other || '').trim() : v; }
  function buildEntry() {
    var slotBase = { palce: 0, silka: 4 }, used = { palce: 0, silka: 0 }, blocks = [], err = null;
    state.blocks.forEach(function (b) {
      var sets = [];
      b.sets.forEach(function (s, i) { if (String(s.reps).trim() !== '') sets.push({ reps: num(s.reps), kg: wt(b, i) }); });
      var empty = !b.name && !sets.length && b.main == null && !b.comment && !b.rest;
      if (empty) return;
      if (!b.name) { err = err || { msg: 'Wybierz ćwiczenie w każdym bloku albo usuń pusty blok.', el: blockEl(b.id) }; return; }
      var kgs = []; for (var i = 0; i < MAXSETS; i++) kgs.push(sets[i] ? sets[i].kg : null);
      var reps = []; for (var j = 0; j < MAXSETS; j++) reps.push(sets[j] ? sets[j].reps : null);
      blocks.push({ slot: slotBase[b.cat] + used[b.cat]++, cwiczenie: sheetName(b), komentarz: b.comment, kg: kgs[0] != null ? kgs[0] : b.main, kgs: kgs, rest: b.rest, powt: reps });
    });
    if (!state.date) err = err || { msg: 'Wpisz datę treningu.', el: $('#date') };
    var types = state.types.filter(function (t) { return t !== '__other'; });
    if (state.types.indexOf('__other') > -1 && state.typeOther.trim()) types.push(state.typeOther.trim());
    if (!types.length) err = err || { msg: 'Wybierz rodzaj treningu.', el: $('[data-multi="types"]') };
    if (err) return { error: err };
    var s = state.sum;
    return { entry: {
      id: uuid(), ts: new Date().toISOString(), date: state.date, waga: num(state.waga), sen: state.sen, wyr: state.wyr,
      rodzaj: types.join(', '), cele: state.cele,
      warm: { start: state.warm.start, drills: state.warm.drills.join(', '), end: state.warm.end, comment: state.warm.comment },
      blocks: blocks,
      sum: { ile1: s.ile1, focus1: focusVal(s.focus1, s.focus1Other), przebieg1: s.przebieg1, rest1: s.rest1,
        focus2: focusVal(s.focus2, s.focus2Other), przebieg2: s.przebieg2, rest2: s.rest2, intSubj: s.intSubj,
        fiz: s.fiz, jak: s.jak, check: s.check.join(', '),
        sukcesy: s.sukcesy, komentarz: s.komentarz, slabe: s.slabe, ile2: s.ile2 }
    } };
  }

  /* ---------- offline queue ---------- */
  var Q = (function () {
    var useLS = false;
    function open() {
      return new Promise(function (res, rej) {
        if (!window.indexedDB) return rej(new Error('no idb'));
        var r = indexedDB.open('lt' + NS, 1);
        r.onupgradeneeded = function () { r.result.createObjectStore('queue', { keyPath: 'id' }); };
        r.onsuccess = function () { res(r.result); };
        r.onerror = function () { rej(r.error); };
      });
    }
    function run(mode, fn) {
      return open().then(function (db) {
        return new Promise(function (res, rej) {
          var t = db.transaction('queue', mode), out = fn(t.objectStore('queue'));
          t.oncomplete = function () { res(out ? out.result : undefined); };
          t.onerror = function () { rej(t.error); }; t.onabort = function () { rej(t.error); };
        });
      });
    }
    function lsq() { return lsGet('lt-queue', []); }
    return {
      put: function (it) { if (useLS) { var q = lsq(); q.push(it); lsSet('lt-queue', q); return Promise.resolve(); }
        return run('readwrite', function (s) { return s.put(it); }).catch(function () { useLS = true; var q = lsq(); q.push(it); if (!lsSet('lt-queue', q)) throw new Error('Brak miejsca w pamięci telefonu'); }); },
      all: function () { if (useLS) return Promise.resolve(lsq()); return run('readonly', function (s) { return s.getAll(); }).then(function (a) { return (a || []).concat(lsq()); }).catch(function () { useLS = true; return lsq(); }); },
      del: function (id) { var q = lsq().filter(function (x) { return x.id !== id; }); lsSet('lt-queue', q); if (useLS) return Promise.resolve(); return run('readwrite', function (s) { return s.delete(id); }).catch(function () {}); }
    };
  })();

  function configured() { return !!(cfg.url && cfg.token); }
  function post(entry) {
    return fetch(cfg.url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ token: cfg.token, entry: entry }) })
      .then(function (r) { return r.text(); })
      .then(function (t) { try { return JSON.parse(t); } catch (e) { return { ok: false, error: 'Skrypt zwrócił nieoczekiwaną odpowiedź. Sprawdź wdrożenie (dostęp: „Wszyscy”) i adres w Ustawieniach.' }; } })
      .catch(function () { return { ok: false, offline: true, error: 'Brak połączenia z internetem.' }; });
  }
  // Wywołanie skryptu przez POST: hasło jest w treści zapytania, a nie w adresie.
  function api(action) {
    return fetch(cfg.url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ token: cfg.token, action: action }) })
      .then(function (r) { return r.json(); });
  }
  /* ---------- wspólne dane telefonu i komputera: plany i własne ćwiczenia ---------- */
  var stateDirty = lsGet('lt-state-dirty', false);
  function pushState() {
    stateDirty = true; lsSet('lt-state-dirty', true);
    if (window.LT_PREVIEW || !configured() || !navigator.onLine) return Promise.resolve(false);
    return fetch(cfg.url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ token: cfg.token, op: 'state', planned: planned, custom: custom }) })
      .then(function (r) { return r.json(); }).then(function (j) { if (j && j.ok) { stateDirty = false; lsSet('lt-state-dirty', false); return true; } return false; }).catch(function () { return false; });
  }
  function mergeState(st) {
    if (!st) return;
    if (stateDirty) { pushState(); return; }          // lokalne zmiany jeszcze nie dotarły do arkusza: nie nadpisuj ich
    planned = st.planned || []; lsSet('lt-planned', planned);
    ['palce', 'silka'].forEach(function (k) {
      var u = (custom[k] || []).slice();
      ((st.custom && st.custom[k]) || []).forEach(function (n) { if (u.indexOf(n) < 0) u.push(n); });
      custom[k] = u;
    });
    lsSet('lt-custom', custom);
  }
  var flushing = null, lastError = '';
  function flush() {
    if (flushing) return flushing;
    flushing = Q.all().then(function (items) {
      if (!items.length) return { sent: 0, left: 0 };
      if (!configured()) return { sent: 0, left: items.length, error: 'Nie ustawiono połączenia z arkuszem (Ustawienia).', noCfg: true };
      var sent = 0;
      return items.reduce(function (p, it) {
        return p.then(function (stop) {
          if (stop) return stop;
          return post(it).then(function (r) {
            if (r && r.ok) { sent++; return Q.del(it.id).then(function () { return null; }); }
            return { sent: sent, left: items.length - sent, error: (r && r.error) || 'Nieznany błąd', offline: r && r.offline };
          });
        });
      }, Promise.resolve(null)).then(function (stop) { return stop || { sent: sent, left: 0 }; });
    }).then(function (res) { lastError = res.error || ''; updateStatus(); if (res.sent) refreshData(true).catch(function () {}); return res; })
      .catch(function (e) { lastError = String(e && e.message || e); updateStatus(); return { sent: 0, left: -1, error: lastError }; })
      .then(function (res) { flushing = null; return res; });
    return flushing;
  }
  function updateStatus() {
    Q.all().then(function (items) {
      var el = $('#status'), n = items.length;
      if (n > 0) { el.className = 'status wait'; el.textContent = 'Czeka: ' + n; }
      else if (!configured()) { el.className = 'status off'; el.textContent = 'Ustaw arkusz'; }
      else if (!navigator.onLine) { el.className = 'status off'; el.textContent = 'Offline'; }
      else { el.className = 'status ok'; el.textContent = 'Wysłane'; }
    });
  }
  $('#status').addEventListener('click', function () {
    if (!configured()) { openSettings(); return; }
    flush().then(function (r) {
      if (r.error) toast(r.error, true); else if (r.sent) toast('Wysłano do arkusza (' + r.sent + ').'); else toast('Nic nie czeka na wysłanie.');
    });
  });

  // Lista ćwiczeń do wyboru liczy się na bieżąco przy otwarciu okna wyboru (openExPicker),
  // więc po odświeżeniu danych z arkusza nie trzeba nic przebudowywać w samych blokach.
  function refreshSelects() {}
  function refreshHints() {
    state.blocks.forEach(function (b) {
      var el = blockEl(b.id); if (!el) return;
      var old = $('.last', el), html = lastHTML(b);
      if (old) old.remove();
      if (html) $('.side', el).insertAdjacentHTML('afterend', html);
    });
  }

  /* ---------- pobieranie danych z arkusza ---------- */
  var refreshing = null;
  function refreshData(force) {
    if (window.LT_PREVIEW || !configured() || !navigator.onLine) return Promise.resolve(false);
    if (!force && DATA && Date.now() - (DATA.fetched || 0) < 600000) return Promise.resolve(false);
    if (refreshing) return refreshing;
    refreshing = api('data').then(function (j) {
      if (!j.ok) throw new Error(j.error || 'Nie udało się pobrać danych.');
      DATA = { at: j.at, fetched: Date.now(), trainings: j.trainings || [], plan: j.plan || null };
      mergeState(j.state); refreshSelects();
      lsSet('lt-data', DATA);
      return Q.all().then(function (items) {
        var pending = {}; items.forEach(function (x) { pending[x.id] = 1; });
        recent = recent.filter(function (t) { return pending[t.qid]; }); lsSet('lt-recent', recent);
        refreshHints(); var lw = lastWaga(); $('#waga').placeholder = lw != null ? fmt(lw) : '';
        renderCurrent(); return true;
      });
    }).then(function (v) { refreshing = null; return v; }, function (e) { refreshing = null; throw e; });
    return refreshing;
  }

  /* ---------- save ---------- */
  function resetForm() {
    stopTick(); releaseWake();
    state = freshState(); uid = Math.max.apply(null, state.blocks.map(function (b) { return b.id; })) + 1; lsSet('lt-draft', state);
    fillFocusSelects(); bindAll(); renderBlocks(); closeAdd();
    $$('details.sec').forEach(function (d) { d.open = d.id === 'sec-day'; }); window.scrollTo(0, 0);
  }
  $('#save').addEventListener('click', function () {
    if (state.warm.since) timerToggle();
    var r = buildEntry();
    if (r.error) { toast(r.error.msg, true); if (r.error.el) r.error.el.scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
    var btn = $('#save'); btn.disabled = true;
    Q.put(r.entry).then(function () {
      recent.push(entryToTraining(r.entry)); lsSet('lt-recent', recent);
      resetForm(); showView('home'); toast('Zapisano w telefonie. Wysyłam do arkusza…'); updateStatus();
      return flush();
    }).then(function (res) {
      if (!res) return;
      if (res.left === 0) toast('Zapisano w arkuszu ✓');
      else if (res.noCfg) toast('Zapisane w telefonie. Ustaw połączenie z arkuszem w Ustawieniach.', true);
      else if (res.offline) toast('Zapisane w telefonie. Wyślę, gdy wróci internet.');
      else toast('Zapisane w telefonie, ale wysyłka nie działa: ' + res.error, true);
    }).catch(function (e) { toast('Nie udało się zapisać: ' + (e && e.message || e), true); })
      .then(function () { btn.disabled = false; });
  });

  /* ---------- settings ---------- */
  var dlg = $('#settings');
  function openSettings() {
    $('#cfg-url').value = cfg.url || ''; $('#cfg-token').value = cfg.token || ''; $('#cfg-theme').value = cfg.theme || 'auto';
    $('#cfg-ver').textContent = 'Wersja aplikacji: ' + (C.version || '?') + (isTest ? ' (TEST)' : '');
    $('#cfg-changelog-body').innerHTML = (C.changelog || []).map(function (e) {
      return '<p class="sub" style="margin:.6em 0 .2em;font-weight:600">' + esc(e.v) + '</p><ul class="sub" style="margin:0 0 .6em 1.1em;padding:0">' +
        e.items.map(function (it) { return '<li>' + esc(it) + '</li>'; }).join('') + '</ul>';
    }).join('');
    $('#cfg-msg').hidden = true; dlg.showModal();
  }
  function msg(text, err) { var m = $('#cfg-msg'); m.textContent = text; m.className = 'msg' + (err ? ' err' : ''); m.hidden = false; }
  function readCfg() { cfg = { url: $('#cfg-url').value.trim(), token: $('#cfg-token').value.trim(), theme: $('#cfg-theme').value }; lsSet('lt-cfg', cfg); applyTheme(); updateStatus(); }
  $('#cfg-test').addEventListener('click', function () {
    readCfg(); if (!configured()) { msg('Wpisz adres i hasło skryptu.', true); return; }
    msg('Sprawdzam…');
    api('ping').then(function (j) {
      if (j.ok) msg('Działa. Arkusz: ' + j.sheet + ', wierszy: ' + j.rows + '. ' + (j.layout === 'ok' ? 'Kolumny Kg s1–s8 są na miejscu.' : 'Uwaga: ' + j.layout), j.layout !== 'ok');
      else msg(j.error || 'Błąd', true);
    }).catch(function () { msg('Nie udało się połączyć. Sprawdź internet, adres i to, czy wdrożenie ma dostęp „Wszyscy”.', true); });
  });
  $('#cfg-hist').addEventListener('click', function () {
    readCfg(); if (window.LT_PREVIEW) { msg('W podglądzie dane są wbudowane.'); return; }
    if (!configured()) { msg('Najpierw wpisz adres i hasło skryptu.', true); return; }
    msg('Pobieram dane z arkusza…');
    refreshData(true).then(function () { msg('Dane odświeżone (' + trainings().length + ' treningów).'); }).catch(function (e) { msg(String(e.message || e), true); });
  });
  function copyText(text, ok) {
    function fallback() { msg('Nie udało się skopiować automatycznie. Zaznacz i skopiuj ręcznie: ' + text); }
    try { navigator.clipboard.writeText(text).then(function () { msg(ok); }, fallback); } catch (e) { fallback(); }
  }
  $('#cfg-copylink').addEventListener('click', function () {
    readCfg(); if (!configured()) { msg('Najpierw wpisz adres i hasło skryptu.', true); return; }
    var code = btoa(unescape(encodeURIComponent(JSON.stringify({ u: cfg.url, t: cfg.token }))));
    copyText(location.origin + location.pathname.replace(/index\.html$/, '') + '#kod=' + encodeURIComponent(code), 'Link skopiowany. Wyślij go sobie (np. mailem) i otwórz na komputerze.');
  });
  $('#cfg-wipe').addEventListener('click', function () {
    Q.all().then(function (items) {
      if (items.length) { msg('Masz ' + items.length + ' niewysłanych treningów. Wyślij je (dotknij „Czeka” w rogu), zanim usuniesz dane.', true); return; }
      try { Object.keys(localStorage).filter(function (k) { return k.indexOf(NS) === 0; }).forEach(function (k) { localStorage.removeItem(k); }); } catch (e) {}
      location.replace(location.pathname);
    });
  });
  $('#cfg-clear').addEventListener('click', function () { resetForm(); dlg.close(); toast('Formularz wyczyszczony.'); });
  $('#settings-form').addEventListener('submit', function () { readCfg(); if (configured()) { flush(); refreshData(false).catch(function () {}); } });

  /* ---------- widoki, ekran startowy i menu ---------- */
  var TITLES = { home: 'Log treningowy', train: 'Trening', cal: 'Kalendarz', hist: 'Historia', plan: 'Plan makro' };
  var current = 'home', LTR = {};
  function plural(n, a, b, c) { var m = n % 100, d = n % 10; return n === 1 ? a : (d >= 2 && d <= 4 && !(m >= 12 && m <= 14)) ? b : c; }
  function plShort(iso) { return iso.slice(8, 10) + '.' + iso.slice(5, 7); }
  function plDateTime(iso) {
    try { return new Date(iso).toLocaleString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }); } catch (e) { return iso; }
  }
  function hasDraft() {
    var st = state;
    return !!(st.waga || st.sen != null || st.wyr != null || st.types.length || st.cele || anyFilled(st.warm) || anyFilled(st.sum) ||
      st.blocks.some(function (b) { return b.name || b.main != null || b.rest || b.comment || b.sets.some(function (x) { return String(x.reps).trim() !== ''; }); }));
  }
  function renderHome() {
    var all = trainings(), last = all.length ? all[all.length - 1] : null, draft = hasDraft();
    $('#home-train-title').textContent = draft ? 'Kontynuuj trening' : 'Zacznij trening';
    $('#home-train-sub').textContent = draft ? 'Masz rozpoczęty wpis. Wróć do niego.' : 'Nowy wpis w logu treningowym';
    $('#home-cal-sub').textContent = last ? 'Ostatni trening: ' + plShort(last.d) : 'Twoje treningi miesiąc po miesiącu';
    $('#home-hist-sub').textContent = all.length ? all.length + ' ' + plural(all.length, 'trening', 'treningi', 'treningów') + ' do przejrzenia' : 'Przeglądaj i porównuj wyniki';
    var ph = DATA && DATA.plan && DATA.plan.phases ? DATA.plan.phases.length : 0;
    $('#home-plan-sub').textContent = ph ? 'Z arkusza: ' + ph + ' ' + plural(ph, 'faza', 'fazy', 'faz') : 'Plan makro z arkusza';
    $('#home-sync').textContent = DATA && DATA.at ? 'Dane z arkusza: ' + plDateTime(DATA.at) + (window.LT_PREVIEW ? ' (podgląd)' : '') : (configured() ? 'Brak danych z arkusza. Odśwież.' : 'Brak połączenia z arkuszem. Ustaw je w menu.');
  }
  function renderCurrent() { if (current === 'home') renderHome(); else if (LTR[current]) LTR[current](); }
  function showView(name, push) {
    current = name;
    $$('.view').forEach(function (v) { v.hidden = v.id !== 'view-' + name; });
    $('#view-title').textContent = TITLES[name];
    $$('#drawer [data-go]').forEach(function (b) { if (b.dataset.go === name) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
    closeDrawer();
    if (push !== false) { try { history.pushState({ v: name }, ''); } catch (e) {} }
    window.scrollTo(0, 0);
    renderCurrent();
  }
  window.addEventListener('popstate', function (e) { showView((e.state && e.state.v) || 'home', false); });
  function openDrawer() { $('#drawer').hidden = false; $('#drawer-back').hidden = false; $('#menu-btn').setAttribute('aria-expanded', 'true'); var f = $('#drawer button'); if (f) f.focus(); }
  function closeDrawer() { $('#drawer').hidden = true; $('#drawer-back').hidden = true; $('#menu-btn').setAttribute('aria-expanded', 'false'); }
  $('#menu-btn').addEventListener('click', function () { if ($('#drawer').hidden) openDrawer(); else closeDrawer(); });
  $('#drawer-back').addEventListener('click', closeDrawer);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !$('#drawer').hidden) closeDrawer(); });
  document.addEventListener('click', function (e) { var g = e.target.closest('[data-go]'); if (g) showView(g.dataset.go); });
  $('#drawer-settings').addEventListener('click', function () { closeDrawer(); openSettings(); });
  $('#home-refresh').addEventListener('click', function () {
    if (window.LT_PREVIEW) { toast('W podglądzie dane są wbudowane.'); return; }
    if (!configured()) { openSettings(); return; }
    toast('Odświeżam dane…');
    refreshData(true).then(function () { toast('Dane odświeżone.'); renderHome(); }).catch(function (e) { toast(String(e.message || e), true); });
  });
  function startTraining(o) {
    if (o && !hasDraft()) { if (o.date) state.date = o.date; if (o.types) state.types = o.types.slice(); scheduleSave(); bindAll(); }
    showView('train');
  }
  window.LT = {
    $: $, $$: $$, esc: esc, num: num, fmt: fmt, today: today, toast: toast, plural: plural,
    trainings: trainings, plan: function () { return DATA && DATA.plan; }, dataAt: function () { return DATA && DATA.at; },
    planned: function () { return planned; }, setPlanned: function (a) { planned = a; lsSet('lt-planned', planned); pushState(); },
    go: showView, register: function (n, f) { LTR[n] = f; }, startTraining: startTraining, openSettings: openSettings, configured: configured, refresh: refreshData
  };

  /* ---------- start ---------- */
  var isTest = /test/i.test(location.hostname + location.pathname);
  if (isTest) { $('#test-badge').hidden = false; document.title = 'TEST · ' + document.title; }
  var importedCfg = false;
  (function () {
    var m = /#kod=([^&]+)/.exec(location.hash); if (!m) return;
    try { var o = JSON.parse(decodeURIComponent(escape(atob(decodeURIComponent(m[1]))))); if (o.u && o.t) { cfg.url = o.u; cfg.token = o.t; lsSet('lt-cfg', cfg); importedCfg = true; } } catch (e) {}
    try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {}
  })();
  applyTheme(); fillFocusSelects(); bindAll(); renderBlocks(); updateStatus();
  if (state.warm.since) { startTick(); requestWake(); }
  try { history.replaceState({ v: 'home' }, ''); } catch (e) {}
  showView('home', false);
  if (importedCfg) toast('Połączono z arkuszem.');
  window.addEventListener('online', function () { updateStatus(); flush(); if (stateDirty) pushState(); });
  window.addEventListener('offline', updateStatus);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) { updateStatus(); flush(); } });
  setInterval(function () { Q.all().then(function (a) { if (a.length) flush(); }); }, 60000);
  if (configured()) { flush(); refreshData(false).catch(function () {}); }
  // Aktualizacje: nowa wersja czeka w tle i wchodzi dopiero po dotknięciu przycisku na ekranie startowym,
  // więc nigdy nie zmieni się w trakcie treningu.
  if (!window.LT_PREVIEW && 'serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    var swReg = null, wantReload = false;
    var showUpdate = function () { $('#home-update').hidden = false; };
    navigator.serviceWorker.register('sw.js').then(function (reg) {
      swReg = reg;
      reg.update().catch(function () {});
      if (reg.waiting && navigator.serviceWorker.controller) showUpdate();
      reg.addEventListener('updatefound', function () {
        var w = reg.installing; if (!w) return;
        w.addEventListener('statechange', function () { if (w.state === 'installed' && navigator.serviceWorker.controller) showUpdate(); });
      });
      setInterval(function () { reg.update().catch(function () {}); }, 3600000);
    }).catch(function () {});
    document.addEventListener('visibilitychange', function () { if (!document.hidden && swReg) swReg.update().catch(function () {}); });
    navigator.serviceWorker.addEventListener('controllerchange', function () { if (wantReload) location.reload(); });
    $('#home-update').addEventListener('click', function () {
      if (swReg && swReg.waiting) { wantReload = true; swReg.waiting.postMessage('skip'); } else location.reload();
    });
    // Ręczne sprawdzenie w Ustawieniach: automatyczne wykrywanie czasem się spóźnia
    // (przeglądarka sama decyduje, kiedy sprawdzić plik sw.js), więc to daje pewność od razu.
    $('#cfg-update').addEventListener('click', function () {
      if (!swReg) { msg('Aktualizacje nie działają w tym trybie (podgląd albo stare połączenie ze service workerem).', true); return; }
      msg('Sprawdzam…');
      swReg.update().then(function () {
        setTimeout(function () {
          if (swReg.waiting) { showUpdate(); msg('Jest nowa wersja — dotknij „Zaktualizuj” na ekranie startowym (po zamknięciu Ustawień).'); }
          else msg('Masz już najnowszą wersję (' + (C.version || '?') + ').');
        }, 1200);
      }).catch(function () { msg('Nie udało się sprawdzić — brak internetu?', true); });
    });
  }
})();
