/**
 * LOG TRENINGOWY: zapis treningów do Arkusza Google.
 * Ten skrypt wkleja się do arkusza (Rozszerzenia > Apps Script). Instrukcja: INSTRUKCJA.md.
 * Kolumny "Intensywność - czerwona/żółta/zielona" i "Polar Flow" aplikacja zostawia puste.
 */

// ====== USTAWIENIA (zmień tylko HASŁO) ======
const TOKEN = 'ZMIEN_TO_NA_WLASNE_HASLO';   // to samo hasło wpiszesz w ustawieniach aplikacji
const SHEET_NAME = 'Dane';                    // zakładka, do której trafiają treningi
const PLAN_SHEET = 'Plan Makro';              // zakładka z planem makro (tylko do odczytu)
const STATE_SHEET = 'Aplikacja (nie ruszać)'; // zakładka, w której aplikacja trzyma plany i własne ćwiczenia

// ====== UKŁAD ARKUSZA (nie zmieniaj, chyba że zmieniasz arkusz) ======
const N_BLOCKS = 16;          // 8 bloków Palce + 8 bloków Siłka (od rozszerzenia Palce 4->8, 2026-09)
const N_PALCE = 8;            // ile pierwszych bloków to "Palce" (reszta to "Siłka")
const N_BLOCKS_PRE_PALCE8 = 12;   // ile bloków miał arkusz PRZED rozszerzeniem Palce 4->8 (do migracji)
const N_PALCE_PRE_PALCE8 = 4;     // ile z nich to były bloki Palce PRZED rozszerzeniem (do migracji)
const OLD_BLOCK_W = 13;       // dawny blok: Przejdź, Ćwiczenie, Komentarz, Kg, Rest, 8x Powt.
const BLOCK_W = 21;           // nowy blok: + 8 kolumn "Kg s1..s8" zaraz za Kg
const BLOCK_START = 13;       // kolumna M: początek pierwszego bloku
const OLD_TOTAL_COLS = 189;   // dawny arkusz miał kolumny A:GG
const SUMMARY_START = BLOCK_START + N_BLOCKS * BLOCK_W;   // "Przejdź do sekcji 14"
const TOTAL_COLS = SUMMARY_START + 20;                    // kolumn łącznie (285 + 84 po rozszerzeniu Palce)

// ====== WEJŚCIA Z APLIKACJI ======
// Nowsze wersje aplikacji wysyłają wszystko przez POST, więc hasło nie trafia do adresu URL.
// GET zostaje tylko dla starszych wersji aplikacji (ping i dane).
function doGet(e) {
  try {
    const p = (e && e.parameter) || {};
    if (!p.action) return json_({ ok: true, app: 'log-treningowy', note: 'Otwórz aplikację, nie ten adres.' });
    if (!authOk_(p.token)) { Utilities.sleep(1500); return json_({ ok: false, error: 'Złe hasło. Sprawdź hasło w Ustawieniach aplikacji.' }); }
    if (p.action === 'ping') return json_(ping_());
    if (p.action === 'data') return json_(data_());
    return json_({ ok: false, error: 'Nieznana akcja.' });
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message || err) });
  }
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    if (!authOk_(body.token)) { Utilities.sleep(1500); return json_({ ok: false, error: 'Złe hasło. Sprawdź hasło w Ustawieniach aplikacji.' }); }
    const action = body.action || body.op || (body.entry ? 'entry' : '');
    if (action === 'entry') return json_(appendEntry_(body.entry));
    if (action === 'ping') return json_(ping_());
    if (action === 'data') return json_(data_());
    if (action === 'state') return json_(saveState_(body));
    return json_({ ok: false, error: 'Nieznana akcja.' });
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message || err) });
  }
}

function ping_() {
  const sh = sheet_();
  const lay = layoutStatus_(sh);
  const tzS = Session.getScriptTimeZone(), tzA = SpreadsheetApp.getActive().getSpreadsheetTimeZone();
  let layout = lay;
  if (lay === 'ok' && tzS !== tzA) layout = 'strefa czasowa skryptu (' + tzS + ') jest inna niż arkusza (' + tzA + '). Ustaw obie na Europe/Warsaw.';
  return { ok: true, sheet: sh.getName(), rows: Math.max(0, lastRow_(sh) - 1), layout: layout };
}

function data_() {
  const sh = sheet_();
  const ncols = sh.getLastColumn(), last = lastRow_(sh);
  const values = last >= 2 ? sh.getRange(2, 1, last - 1, ncols).getValues() : [];
  const tz = Session.getScriptTimeZone();
  const fmt = {
    date: function (d) { return Utilities.formatDate(d, tz, 'yyyy-MM-dd'); },
    ts: function (d) { return Utilities.formatDate(d, tz, "yyyy-MM-dd'T'HH:mm:ss"); },
    time: function (d) { return Utilities.formatDate(d, tz, 'HH:mm'); }
  };
  let plan = null;
  const ps = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(PLAN_SHEET);
  if (ps) {
    const dr = ps.getDataRange();
    const merges = dr.getMergedRanges().map(function (m) { return { r0: m.getRow() - 1, c0: m.getColumn() - 1, r1: m.getRow() + m.getNumRows() - 2, c1: m.getColumn() + m.getNumColumns() - 2 }; });
    plan = buildPlan_(dr.getValues(), merges);
  }
  return { ok: true, at: new Date().toISOString(), trainings: buildTrainings_(values, ncols, fmt), plan: plan, state: readState_() };
}

// Zapis stanu z aplikacji. Plany: wygrywa ostatni zapis. Własne ćwiczenia: suma list (nic nie ginie).
// Same funkcje odczytu i zapisu zakładki są w sekcji "STAN APLIKACJI" niżej.
function saveState_(b) {
  const cur = readState_();
  const inc = b.custom || {};
  function union(a, c) { const o = (a || []).slice(); (c || []).forEach(function (x) { if (typeof x === 'string' && x && o.indexOf(x) < 0) o.push(x); }); return o.slice(0, 300); }
  const custom = { palce: union(cur.custom && cur.custom.palce, inc.palce), silka: union(cur.custom && cur.custom.silka, inc.silka) };
  const planned = Array.isArray(b.planned) ? b.planned.slice(0, 500) : (cur.planned || []);
  writeState_(planned, custom);
  return { ok: true, state: { planned: planned, custom: custom } };
}

function authOk_(t) { return TOKEN !== 'ZMIEN_TO_NA_WLASNE_HASLO' && t === TOKEN; }
function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function sheet_() {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  if (!sh) throw new Error('Nie ma zakładki „' + SHEET_NAME + '”.');
  return sh;
}
function lastRow_(sh) {
  const v = sh.getRange(1, 1, sh.getMaxRows(), 1).getValues();
  for (let i = v.length - 1; i >= 0; i--) if (v[i][0] !== '') return i + 1;
  return 1;
}

// Czy arkusz ma już kolumny "Kg s1..s8" we wszystkich blokach?
function layoutStatus_(sh) {
  const n = sh.getLastColumn();
  if (n === OLD_TOTAL_COLS) return 'Arkusz ma jeszcze stary układ. Uruchom funkcję dodajKolumnyKg w edytorze skryptu.';
  if (n < TOTAL_COLS) return 'Arkusz ma ' + n + ' kolumn, a powinien mieć ' + TOTAL_COLS + '.';
  const hdr = sh.getRange(1, 1, 1, TOTAL_COLS).getValues()[0];
  for (let b = 0; b < N_BLOCKS; b++) {
    const s = BLOCK_START + b * BLOCK_W - 1;   // indeks (od 0) kolumny "Przejdź do sekcji"
    if (String(hdr[s + 3]).indexOf('Kg') !== 0 || String(hdr[s + 4]).indexOf('Kg s1') !== 0 || String(hdr[s + 12]).indexOf('Rest') !== 0) {
      return 'Układ kolumn w bloku ' + (b + 1) + ' nie zgadza się z oczekiwanym (Kg, Kg s1–s8, Rest).';
    }
  }
  return 'ok';
}

// ====== ZAPIS TRENINGU ======
function appendEntry_(entry) {
  if (!entry || !entry.id) throw new Error('Pusty wpis.');
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const props = PropertiesService.getScriptProperties();
    const seen = JSON.parse(props.getProperty('SEEN_IDS') || '[]');
    if (seen.indexOf(entry.id) > -1) return { ok: true, duplicate: true };

    const sh = sheet_();
    const lay = layoutStatus_(sh);
    if (lay !== 'ok') throw new Error(lay);

    const built = buildRow_(entry);
    const last = lastRow_(sh);
    const row = last + 1;
    if (row > sh.getMaxRows()) sh.insertRowsAfter(sh.getMaxRows(), 1);
    // formaty (data, godzina itp.) bierzemy z poprzedniego wiersza
    if (last >= 2) sh.getRange(last, 1, 1, TOTAL_COLS).copyTo(sh.getRange(row, 1, 1, TOTAL_COLS), SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false);
    if (built.textCols.length) sh.getRangeList(built.textCols.map(function (c) { return sh.getRange(row, c).getA1Notation(); })).setNumberFormat('@');
    built.timeCols.forEach(function (c) { sh.getRange(row, c).setNumberFormat('h:mm:ss AM/PM'); });
    sh.getRange(row, 1, 1, TOTAL_COLS).setValues([built.row]);

    seen.push(entry.id);
    props.setProperty('SEEN_IDS', JSON.stringify(seen.slice(-300)));
    return { ok: true, row: row };
  } finally {
    lock.releaseLock();
  }
}

function timeFrac_(hm) {
  const m = /^(\d{1,2}):(\d{2})/.exec(hm || '');
  return m ? (parseInt(m[1], 10) * 60 + parseInt(m[2], 10)) / 1440 : '';
}

// Zamienia wpis z aplikacji na jeden wiersz arkusza (285 kolumn).
function buildRow_(e) {
  const row = new Array(TOTAL_COLS).fill('');
  const textCols = [], timeCols = [];
  function put(col, v) { if (v !== null && v !== undefined) row[col - 1] = v; }
  function putNum(col, v) { if (v !== null && v !== undefined && v !== '' && isFinite(v)) row[col - 1] = Number(v); }
  function putText(col, v) { if (v !== null && v !== undefined && String(v) !== '') { row[col - 1] = String(v); textCols.push(col); } }
  function putRest(col, v) {
    if (v === null || v === undefined || String(v).trim() === '') return;
    const s = String(v).trim();
    if (/^\d+([.,]\d+)?$/.test(s)) row[col - 1] = parseFloat(s.replace(',', '.')); else putText(col, s);
  }

  put(1, new Date(e.ts));
  const d = String(e.date).split('-');
  put(2, new Date(parseInt(d[0], 10), parseInt(d[1], 10) - 1, parseInt(d[2], 10)));
  putNum(3, e.waga); putNum(4, e.sen); putNum(5, e.wyr);
  put(6, e.rodzaj || ''); put(7, e.cele || '');
  // kolumna 8 ("Przejdź do sekcji") zostaje pusta: aplikacja nie ma przeskoków między sekcjami
  const w = e.warm || {};
  const t1 = timeFrac_(w.start), t2 = timeFrac_(w.end);
  if (t1 !== '') { row[8] = t1; timeCols.push(9); }
  put(10, w.drills || '');
  if (t2 !== '') { row[10] = t2; timeCols.push(11); }
  put(12, w.comment || '');

  (e.blocks || []).forEach(function (b) {
    if (b.slot < 0 || b.slot >= N_BLOCKS) return;
    const s = BLOCK_START + b.slot * BLOCK_W;      // kolumna "Przejdź do sekcji" tego bloku
    put(s + 1, b.cwiczenie || '');
    put(s + 2, b.komentarz || '');
    putNum(s + 3, b.kg);
    for (let i = 0; i < 8; i++) putNum(s + 4 + i, (b.kgs || [])[i]);
    putRest(s + 12, b.rest);
    for (let j = 0; j < 8; j++) putNum(s + 13 + j, (b.powt || [])[j]);
  });

  const m = e.sum || {}, S = SUMMARY_START;
  putText(S + 1, m.ile1);
  put(S + 2, m.focus1 || ''); put(S + 3, m.przebieg1 || ''); putText(S + 4, m.rest1);
  put(S + 5, m.focus2 || ''); put(S + 6, m.przebieg2 || ''); putText(S + 7, m.rest2);
  putNum(S + 8, m.intSubj);
  putNum(S + 13, m.fiz); putNum(S + 14, m.jak);
  put(S + 15, m.check || ''); put(S + 16, m.sukcesy || ''); put(S + 17, m.komentarz || ''); put(S + 18, m.slabe || '');
  putText(S + 20, m.ile2);
  return { row: row, textCols: textCols, timeCols: timeCols };
}

// ====== HISTORIA (podpowiedzi "Ostatnio" w aplikacji) ======
function parseKgCell_(v, n) {
  if (v === '' || v === null || v === undefined || n < 1) return null;
  if (typeof v === 'number') return (v >= 0 && v <= 400) ? new Array(n).fill(v) : null;   // literówki typu 353527,5 pomijamy
  const toks = String(v).trim().split(/[\s;]+/);
  if (!toks.length || toks.some(function (t) { return !/^\d+([.,]\d+)?$/.test(t); })) return null;
  const nums = toks.map(function (t) { return parseFloat(t.replace(',', '.')); });
  if (nums.some(function (x) { return x > 400; })) return null;   // np. "35352525" zapisane bez spacji
  if (nums.length === 1) return new Array(n).fill(nums[0]);
  if (nums.length >= n) return nums.slice(0, n);
  return null;
}

function numIn_(v, max) {
  if (typeof v === 'string' && /^\d+([.,]\d+)?$/.test(v.trim())) v = parseFloat(v.replace(',', '.'));
  return (typeof v === 'number' && isFinite(v) && v >= 0 && v <= max) ? v : null;
}
function textOf_(v, fmt) {
  if (v === '' || v === null || v === undefined) return '';
  if (v instanceof Date) return fmt.time(v);
  return String(v).trim();
}
function timeOf_(v, fmt) {
  if (v instanceof Date) return fmt.time(v);
  if (typeof v === 'number' && v >= 0 && v < 1) { const m = Math.round(v * 1440); return ('0' + Math.floor(m / 60)).slice(-2) + ':' + ('0' + (m % 60)).slice(-2); }
  return '';
}

// Zamienia wiersze zakładki "Dane" na listę treningów (dla Kalendarza, Historii i wykresów w aplikacji).
// Działa i na dawnym układzie (189 kolumn), i na nowym (285 kolumn z Kg s1–s8).
function buildTrainings_(values, ncols, fmt) {
  const hasKgs = ncols >= TOTAL_COLS;
  const bw = hasKgs ? BLOCK_W : OLD_BLOCK_W;
  const S = hasKgs ? SUMMARY_START : BLOCK_START + N_BLOCKS * OLD_BLOCK_W;   // "Przejdź do sekcji 14" (od 1)
  const out = [];
  values.forEach(function (r, ri) {
    if (!(r[1] instanceof Date)) return;
    const t = { i: ri + 2, d: fmt.date(r[1]) };
    if (r[0] instanceof Date) t.ts = fmt.ts(r[0]);
    const w = numIn_(r[2], 400); if (w !== null) t.w = w;
    const sen = numIn_(r[3], 10); if (sen !== null) t.sen = sen;
    const wyr = numIn_(r[4], 10); if (wyr !== null) t.wyr = wyr;
    t.t = String(r[5] || '').split(',').map(function (x) { return x.trim(); }).filter(String);
    if (r[6] !== '') t.cele = String(r[6]);
    const wu = {};
    const st = timeOf_(r[8], fmt), en = timeOf_(r[10], fmt);
    if (st) wu.s = st; if (en) wu.e = en;
    if (r[9] !== '') wu.dr = String(r[9]);
    if (r[11] !== '') wu.k = String(r[11]);
    if (Object.keys(wu).length) t.wu = wu;
    t.b = [];
    for (let b = 0; b < N_BLOCKS; b++) {
      const s = BLOCK_START + b * bw - 1;      // indeks (od 0) kolumny "Przejdź do sekcji"
      const name = String(r[s + 1] || '').trim();
      const p = [], idx = [];
      for (let i = 0; i < 8; i++) { const v = numIn_(r[s + (hasKgs ? 13 : 5) + i], 5000); if (v !== null) { p.push(v); idx.push(i); } }
      if (!name && !p.length) continue;
      const blk = { c: b < N_PALCE ? 'palce' : 'silka', n: name, p: p };
      if (r[s + 2] !== '') blk.k = String(r[s + 2]);
      const kgMain = numIn_(r[s + 3], 1000); if (kgMain !== null) blk.kg = kgMain;
      let kgs = null;
      if (hasKgs) {
        const arr = idx.map(function (i) { return numIn_(r[s + 4 + i], 1000); });
        if (arr.some(function (x) { return x !== null; })) kgs = arr;
      }
      if (!kgs) kgs = parseKgCell_(r[s + 3], p.length);
      if (kgs) blk.kgs = kgs; else if (r[s + 3] !== '' && kgMain === null && !(r[s + 3] instanceof Date)) blk.kgt = String(r[s + 3]);
      const restV = r[s + (hasKgs ? 12 : 4)];
      if (restV !== '' && !(restV instanceof Date)) blk.r = String(restV);
      t.b.push(blk);
    }
    const q = {};
    function tx(k, off) { const v = textOf_(r[S - 1 + off], fmt); if (v) q[k] = v; }
    function nm(k, off, mx) { const v = numIn_(r[S - 1 + off], mx); if (v !== null) q[k] = v; }
    tx('ile1', 1); tx('f1', 2); tx('pr1', 3); tx('r1', 4); tx('f2', 5); tx('pr2', 6); tx('r2', 7);
    nm('int', 8, 10); tx('rd', 9); tx('ye', 10); tx('gr', 11); tx('pol', 12); nm('fiz', 13, 10); nm('jak', 14, 10);
    tx('chk', 15); tx('suk', 16); tx('kom', 17); tx('sl', 18); tx('ile2', 20);
    if (Object.keys(q).length) t.s = q;
    out.push(t);
  });
  out.sort(function (a, b) { return a.d < b.d ? -1 : a.d > b.d ? 1 : (a.ts || '') < (b.ts || '') ? -1 : 1; });
  return out;
}

// Zamienia zakładkę "Plan Makro" (siatka tygodni, fazy w wierszu Focus) na listę faz z treścią.
function buildPlan_(values, merges) {
  const R = values.length;
  let lastRow = 0;
  for (let r = 0; r < R; r++) if (values[r].some(function (v) { return v !== '' && v !== null; })) lastRow = r;
  const span = {};                    // "r,c" -> {c1,r1} dla scalonych komórek (lewy górny róg)
  merges.forEach(function (m) { span[m.r0 + ',' + m.c0] = m; });
  function cellText(r, c) { const v = values[r][c]; return (v === '' || v === null || v === undefined) ? '' : String(v).trim(); }
  // etykiety wierszy z kolumny A: obowiązują do następnej etykiety
  const labels = [];
  let cur = '';
  for (let r = 0; r <= lastRow; r++) { const l = cellText(r, 0).replace(/\s+/g, ' ').trim(); if (l) cur = l; labels.push(cur); }
  // miesiące z wiersza 1
  const months = [];
  for (let c = 1; c < values[0].length; c++) { const t = cellText(0, c).replace(/\s+/g, ' ').trim(); if (t) months.push({ c: c, name: t }); }
  function monthOf(c) { let n = ''; months.forEach(function (m) { if (m.c <= c) n = m.name; }); return n; }
  let bpCol = -1;
  months.forEach(function (m) { if (bpCol < 0 && /big\s*picture/i.test(m.name)) bpCol = m.c; });
  const phases = [];
  for (let c = 1; c < values[1].length; c++) {
    const title = cellText(1, c);
    if (!title) continue;
    const sp = span['1,' + c];
    const c1 = sp ? sp.c1 : c;
    const rows = [];
    for (let r = 2; r <= lastRow; r++) {
      for (let cc = c; cc <= c1; cc++) {
        const t = cellText(r, cc);
        if (t) rows.push({ l: labels[r] || '', t: t });
      }
    }
    phases.push({ title: title.replace(/\s*\n\s*/g, ' · '), month: monthOf(c), c0: c, c1: c1, rows: rows, bp: bpCol >= 0 && c >= bpCol });
  }
  return { phases: phases };
}

// ====== STAN APLIKACJI (plany treningów i własne ćwiczenia, wspólne dla telefonu i komputera) ======
function stateSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(STATE_SHEET);
  if (!sh) {
    sh = ss.insertSheet(STATE_SHEET);
    sh.getRange('A1:B2').setValues([['planned', '[]'], ['exercises', '{}']]);
    sh.getRange('A4').setValue('Ta zakładka służy aplikacji do trzymania zaplanowanych treningów i własnych ćwiczeń. Nie zmieniaj jej ręcznie.');
  }
  return sh;
}
function readState_() {
  try {
    const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(STATE_SHEET);
    if (!sh) return { planned: [], custom: { palce: [], silka: [] } };
    const v = sh.getRange('B1:B2').getValues();
    const c = JSON.parse(v[1][0] || '{}');
    return { planned: JSON.parse(v[0][0] || '[]'), custom: { palce: c.palce || [], silka: c.silka || [] } };
  } catch (e) { return { planned: [], custom: { palce: [], silka: [] } }; }
}
function writeState_(planned, custom) {
  const p = JSON.stringify(Array.isArray(planned) ? planned : []);
  const c = JSON.stringify({ palce: (custom && custom.palce) || [], silka: (custom && custom.silka) || [] });
  if (p.length > 40000 || c.length > 40000) throw new Error('Za dużo danych do zapisania.');
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    stateSheet_().getRange('B1:B2').setValues([[p], [c]]);
    return { ok: true };
  } finally { lock.releaseLock(); }
}

// ====== JEDNORAZOWE NARZĘDZIA (uruchamiasz ręcznie w edytorze skryptu) ======

/** Krok 1 instrukcji: daje skryptowi zgodę na dostęp do arkusza. */
function autoryzuj() {
  SpreadsheetApp.getActiveSpreadsheet().getName();
  Logger.log('Zgody nadane. Możesz przejść do wdrożenia.');
}

/**
 * Wstawia 8 kolumn "Kg s1..s8" zaraz za kolumną Kg w każdym z 12 bloków ćwiczeń.
 * Uruchom RAZ, najlepiej najpierw na KOPII arkusza.
 */
function dodajKolumnyKg() {
  const sh = sheet_();
  const n = sh.getLastColumn();
  if (n >= TOTAL_COLS) { Logger.log('Kolumny Kg s1–s8 już są. Nic nie zmieniam.'); return; }
  if (n !== OLD_TOTAL_COLS) throw new Error('Arkusz ma ' + n + ' kolumn, a spodziewałem się ' + OLD_TOTAL_COLS + '. Nic nie zmieniam.');
  const hdr = sh.getRange(1, 1, 1, n).getValues()[0];
  for (let b = 0; b < N_BLOCKS; b++) {   // najpierw sprawdzamy wszystko, potem zmieniamy
    const kgCol = BLOCK_START + b * OLD_BLOCK_W + 3;
    if (String(hdr[kgCol - 1]).indexOf('Kg') !== 0) throw new Error('W kolumnie ' + kgCol + ' (blok ' + (b + 1) + ') nagłówek to „' + hdr[kgCol - 1] + '”, a oczekiwałem „Kg”. Nic nie zmieniam.');
  }
  for (let b = N_BLOCKS - 1; b >= 0; b--) {   // od końca, żeby numery kolumn się nie przesuwały
    const kgCol = BLOCK_START + b * OLD_BLOCK_W + 3;
    sh.insertColumnsAfter(kgCol, 8);
    const names = [];
    for (let i = 1; i <= 8; i++) names.push(b === 0 ? 'Kg s' + i : 'Kg s' + i + ' (' + (b + 1) + ')');
    sh.getRange(1, kgCol + 1, 1, 8).setValues([names]);
  }
  Logger.log('Gotowe: dodano ' + (N_BLOCKS * 8) + ' kolumn. Arkusz ma teraz ' + sh.getLastColumn() + ' kolumn.');
}

/**
 * Rozszerza limit ćwiczeń "Palce" z 4 do 8: wstawia 4 nowe bloki (84 kolumny) zaraz po
 * dotychczasowym 4. bloku Palce. Dawne bloki Siłka (5-12) przesuwają się na pozycje 9-16 —
 * ich dane NIE są ruszane, tylko przesuwają się razem z kolumnami. Uruchom RAZ, najlepiej
 * najpierw na KOPII arkusza. Wymaga, żeby wcześniej była już uruchomiona dodajKolumnyKg().
 */
function rozszerzBlokiPalce() {
  const sh = sheet_();
  const n = sh.getLastColumn();
  const NEW_BLOCKS = N_BLOCKS - N_BLOCKS_PRE_PALCE8;                 // 4 nowe bloki
  const OLD_TOTAL = SUMMARY_START - NEW_BLOCKS * BLOCK_W + 20;       // 285: suma sprzed rozszerzenia
  if (n >= TOTAL_COLS) { Logger.log('Bloki Palce już rozszerzone (8). Nic nie zmieniam.'); return; }
  if (n !== OLD_TOTAL) throw new Error('Arkusz ma ' + n + ' kolumn, a spodziewałem się ' + OLD_TOTAL + ' (12 bloków z Kg s1–s8, przed rozszerzeniem Palce). Uruchom najpierw dodajKolumnyKg(), jeśli jeszcze nie była uruchomiona.');
  const hdr = sh.getRange(1, 1, 1, n).getValues()[0];
  const insertAfterCol = BLOCK_START + N_PALCE_PRE_PALCE8 * BLOCK_W - 1;   // koniec 4. bloku (dawne Palce), 1-indeksowana kolumna
  if (String(hdr[insertAfterCol - BLOCK_W]).indexOf('Przejdź') !== 0) throw new Error('Nie znajduję początku 4. bloku tam, gdzie się spodziewałem. Nic nie zmieniam.');
  if (String(hdr[insertAfterCol]).indexOf('Przejdź') !== 0) throw new Error('Nie znajduję początku 5. bloku (dawna Siłka) tam, gdzie się spodziewałem. Nic nie zmieniam.');

  sh.insertColumnsAfter(insertAfterCol, NEW_BLOCKS * BLOCK_W);

  // Nagłówki nowych bloków (będą to bloki 5-8, kontynuacja Palce).
  for (let k = 0; k < NEW_BLOCKS; k++) {
    const blockNum = N_PALCE_PRE_PALCE8 + 1 + k;   // 5, 6, 7, 8
    const base = insertAfterCol + k * BLOCK_W;          // 0-indeksowana kolumna "Przejdź do sekcji" tego bloku
    const names = ['Przejdź do sekcji', 'Ćwiczenie', 'Komentarz', 'Kg'];
    for (let i = 1; i <= 8; i++) names.push('Kg s' + i + ' (' + blockNum + ')');
    names.push('Rest');
    for (let i = 0; i < 8; i++) names.push('Powt./sek.');
    sh.getRange(1, base + 1, 1, BLOCK_W).setValues([names]);
  }

  // Odśwież numerki "(N)" w nagłówkach "Kg sX" dawnych bloków Siłka, które właśnie się przesunęły (dawne 5-12 -> teraz 9-16).
  const n2 = sh.getLastColumn();
  const hdr2 = sh.getRange(1, 1, 1, n2).getValues()[0];
  for (let b = N_PALCE; b < N_BLOCKS; b++) {
    const base = BLOCK_START + b * BLOCK_W - 1;
    for (let i = 1; i <= 8; i++) hdr2[base + 3 + i] = 'Kg s' + i + ' (' + (b + 1) + ')';
  }
  sh.getRange(1, 1, 1, n2).setValues([hdr2]);

  Logger.log('Gotowe: dodano ' + (NEW_BLOCKS * BLOCK_W) + ' kolumn (nowe bloki Palce 5-8). Arkusz ma teraz ' + sh.getLastColumn() + ' kolumn (Palce: 8, Siłka: 8). Stare bloki Siłka są teraz blokami 9-16 — dane bez zmian, tylko przesunięte.');
}

/** Opcjonalnie: pokazuje, ile starych wpisów da się uzupełnić (nic nie zapisuje). */
function uzupelnijStareKgPodglad() { uzupelnijStareKg_(true); }
/** Opcjonalnie: uzupełnia "Kg s1..s8" w starych wierszach na podstawie kolumny Kg. Wypełnia tylko puste komórki. */
function uzupelnijStareKg() { uzupelnijStareKg_(false); }

function uzupelnijStareKg_(dry) {
  const sh = sheet_();
  const lay = layoutStatus_(sh);
  if (lay !== 'ok') throw new Error(lay);
  const last = lastRow_(sh);
  if (last < 2) return;
  const nRows = last - 1;
  const data = sh.getRange(2, 1, nRows, TOTAL_COLS).getValues();
  let filled = 0, skipped = 0;
  for (let b = 0; b < N_BLOCKS; b++) {
    const s = BLOCK_START + b * BLOCK_W - 1;
    const out = [];
    for (let r = 0; r < nRows; r++) {
      const row = data[r];
      const cur = row.slice(s + 4, s + 12);
      let res = cur;
      if (row[s + 1] !== '' && cur.every(function (x) { return x === ''; })) {
        let n = 0; for (let i = 0; i < 8; i++) if (row[s + 13 + i] !== '' && isFinite(row[s + 13 + i])) n = i + 1;
        const k = parseKgCell_(row[s + 3], n);
        if (k) { res = k.concat(new Array(8 - k.length).fill('')); filled++; }
        else if (row[s + 3] !== '') skipped++;
      }
      out.push(res);
    }
    if (!dry) sh.getRange(2, s + 5, nRows, 8).setValues(out);
  }
  Logger.log((dry ? 'PODGLĄD: ' : 'ZAPISANO: ') + 'uzupełnionych bloków: ' + filled + ', pominiętych (niejasny zapis w Kg): ' + skipped + '.');
}


// ====== JEDNORAZOWA MIGRACJA: nowe nazwy ćwiczeń „Palce” (2026-09) ======
// Historyczne nazwy w blokach Palce (1-4) zamieniamy na nowe, ustalone nazwy.
// Bloki Siłka (5-12) NIE są ruszane. Stare nazwy trafiają do osobnej zakładki
// "Backup nazw (palce)" (wiersz w "Dane", numer bloku, stara nazwa, nowa nazwa) — nic
// nie kasujemy, a "Dane" nie zmienia układu kolumn.

const RENAME_MAP_PALCE = {
  "10mm": "Max Hangs 4p open 10mm",
  "8mm": "Max Hangs 4p open 8mm",
  "3p open lewa": "Pulls 3p open",
  "3p open prawa": "Pulls 3p open",
  "4p asym L": "Pulls 4p open asym",
  "4p asym lewa": "Pulls 4p open asym",
  "4p asym P": "Pulls 4p open asym",
  "4p asym prawa": "Pulls 4p open asym",
  "4p half asym lewa 5:10": "Repeaters 5:10 4p half crimp asym",
  "4p half asym prawa 5:10": "Repeaters 5:10 4p half crimp asym",
  "4p open asym lewa 5:10": "Repeaters 5:10 4p open asym",
  "4p open asym prawa 5:10": "Repeaters 5:10 4p open asym",
  "6:10  repeaters 17mm L": "Repeaters 6:10 4p open 17mm",
  "6:10  repeaters 17mm P": "Repeaters 6:10 4p open 17mm",
  "6:10 repeaters 17mm L": "Repeaters 6:10 4p open 17mm",
  "6:10 repeaters 17mm P": "Repeaters 6:10 4p open 17mm",
  "6:10  repeaters asym P": "Repeaters 6:10 4p open 17mm",
  "6:10 repeaters asym L": "Repeaters 6:10 4p open 17mm",
  "6:10 repeaters asym P": "Repeaters 6:10 4p open 17mm",
  "6:10 repeaters 4p": "Repeaters 6:10 4p open 20mm",
  "6:10 repeaters asym  3p L": "Repeaters 6:10 3p open asym",
  "6:10 repeaters asym  3p P": "Repeaters 6:10 3p open asym",
  "6:10 repeaters asym half  b3 P": "Repeaters 6:10 b3 half crimp asym",
  "6:10 repeaters asym half 3p no fuck L": "Repeaters 6:10 3p (bez środkowego) half crimp asym",
  "6:10 repeaters half 17mm  P": "Repeaters 6:10 4p half crimp 17mm",
  "6:10 repeaters half 17mm L": "Repeaters 6:10 4p half crimp 17mm",
  "6:10 repeaters half asym L": "Repeaters 6:10 4p half crimp 17mm",
  "6:10 repeaters half asym P": "Repeaters 6:10 4p half crimp 17mm",
  "7:3 repeaters 4p": "Repeaters 7:3 4p open Campus XL",
  "7:3 repeaters asym  3p L": "Repeaters 7:3 3p open asym",
  "7:3 repeaters asym  3p P": "Repeaters 7:3 3p open asym",
  "7:3 repeaters asym  4p P": "Repeaters 7:3 4p open asym",
  "7:3 repeaters asym 4p L": "Repeaters 7:3 4p open asym",
  "7:3 repeaters asym half  3p no fuck P": "Repeaters 7:3 3p (bez środkowego) half crimp asym",
  "7:3 repeaters asym half 3p no fuck L": "Repeaters 7:3 3p (bez środkowego) half crimp asym",
  "BM2K 20mm": "Max Hangs 4p open 20mm",
  "Campus po drewnie": "Campus po drewnie",
  "Campus z ziemi": "Campus z ziemi",
  "Density 4p 15mm dom": "Density 4p 15mm",
  "Density 4p 20mm dom": "Density 4p 20mm",
  "Density half 17mm lewa": "Density 4p half crimp 17mm",
  "Density half 17mm prawa": "Density 4p half crimp 17mm",
  "Density half asym lewa": "Density 4p half crimp asym",
  "Density half asym prawa": "Density 4p half crimp asym",
  "Dom 10mm": "Max Hangs 4p open 10mm",
  "Dom 15mm": "Max Hangs 4p open 15mm",
  "MH 17mm L": "Max Hangs 4p open 17mm",
  "MH 17mm P": "Max Hangs 4p open 17mm",
  "MH half 17mm lewa": "Max Hangs 4p half crimp 17mm",
  "MH half 17mm prawa": "Max Hangs 4p half crimp 17mm",
  "Pulls 17mm L": "Pulls 4p open 17mm",
  "Pulls 17mm P": "Pulls 4p open 17mm",
  "Pulls half 17mm lewa": "Pulls 4p half crimp 17mm",
  "Pulls half 17mm prawa": "Pulls 4p half crimp 17mm",
  "Wrist wrench P i L": "Wrist wrench",
};

// "4p half asym lewa/prawa" (bez 5:10) to w rzeczywistości dwa różne ćwiczenia z jednego
// okresu na drugi (patrz Kg): do ~34 kg = half crimp, od 42 kg = open. Próg 38 kg leży
// dokładnie w przerwie między nimi (nie ma wpisów z Kg 34-42), więc jest bezpieczny.
function nowaNazwaPalce_(stara, kg) {
  const s = String(stara || '').trim();
  if (s === '4p half asym lewa' || s === '4p half asym prawa') {
    return (typeof kg === 'number' && kg >= 38) ? 'Max Hangs 4p open asym' : 'Max Hangs 4p half crimp asym';
  }
  return Object.prototype.hasOwnProperty.call(RENAME_MAP_PALCE, s) ? RENAME_MAP_PALCE[s] : null;
}

/** Podgląd: nic nie zapisuje, tylko liczy i pokazuje w Logger.log, co by się zmieniło. Uruchom NAJPIERW to. */
function zmienNazwyPalcePodglad() { zmienNazwyPalce_(true); }
/** Zapis: zmienia nazwy w "Dane" i tworzy zakładkę "Backup nazw (palce)". Uruchom PO podglądzie. */
function zmienNazwyPalce() { zmienNazwyPalce_(false); }

function zmienNazwyPalce_(dry) {
  const sh = sheet_();
  const lay = layoutStatus_(sh);
  if (lay !== 'ok') throw new Error(lay);
  const last = lastRow_(sh);
  if (last < 2) { Logger.log('Brak wierszy w "Dane".'); return; }
  const nRows = last - 1;
  const data = sh.getRange(2, 1, nRows, TOTAL_COLS).getValues();
  const log = [];          // [wiersz w Dane, blok 1-4, stara nazwa, nowa nazwa]
  const nieznane = {};     // nazwy, których nie ma w mapie — nic z nimi nie robimy
  let zmienione = 0;

  for (let b = 0; b < 4; b++) {              // tylko bloki Palce (0-3); Siłka (4-11) pomijamy
    const s = BLOCK_START + b * BLOCK_W;     // 0-indeksowana pozycja "Ćwiczenie" w tym bloku
    for (let r = 0; r < nRows; r++) {
      const row = data[r];
      const stara = String(row[s] || '').trim();
      if (!stara) continue;
      const kg = row[s + 2];
      const nowa = nowaNazwaPalce_(stara, typeof kg === 'number' ? kg : null);
      if (nowa === null) { nieznane[stara] = (nieznane[stara] || 0) + 1; continue; }
      if (nowa === stara) continue;          // np. "Campus z ziemi" — nazwa się nie zmienia
      log.push([r + 2, b + 1, stara, nowa]);
      if (!dry) row[s] = nowa;
      zmienione++;
    }
  }

  if (!dry && log.length) {
    for (let b = 0; b < 4; b++) {
      const s = BLOCK_START + b * BLOCK_W;
      const col = [];
      for (let r = 0; r < nRows; r++) col.push([data[r][s]]);
      sh.getRange(2, s + 1, nRows, 1).setValues(col);
    }
    zapiszBackupNazwPalce_(log);
  }

  const nieznaneTxt = Object.keys(nieznane).map(function (k) { return '„' + k + '” (' + nieznane[k] + '×)'; }).join(', ');
  Logger.log(
    (dry ? 'PODGLĄD (nic nie zapisano): ' : 'ZAPISANO: ') +
    'komórek do zmiany: ' + zmienione + '.' +
    (nieznaneTxt ? ' Nierozpoznane nazwy, których NIE ruszyłem: ' + nieznaneTxt : ' Wszystkie napotkane nazwy były rozpoznane.')
  );
}

function zapiszBackupNazwPalce_(log) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const name = 'Backup nazw (palce)';
  let sh = ss.getSheetByName(name);
  if (sh) ss.deleteSheet(sh);
  sh = ss.insertSheet(name);
  sh.getRange(1, 1, 1, 4).setValues([['Wiersz w "Dane"', 'Blok (1-4)', 'Stara nazwa', 'Nowa nazwa']]);
  sh.getRange('A1:D1').setFontWeight('bold');
  if (log.length) sh.getRange(2, 1, log.length, 4).setValues(log);
  sh.autoResizeColumns(1, 4);
}


// ====== ODŚWIEŻENIE LISTY ĆWICZEŃ W DASHBOARD (rozwijane menu B2:C2, "Ćwiczenie 1"/"Ćwiczenie 2") ======
// Ustawia obie listy na faktyczne nazwy ćwiczeń, jakie są teraz w zakładce "Dane"
// (Palce już po migracji na nowe nazwy, Siłka bez zmian). Można uruchamiać wielokrotnie,
// np. po każdym dopisaniu nowego ćwiczenia — zawsze przelicza od nowa z całej zakładki "Dane".
function odswiezDropdownDashboard() {
  const sh = sheet_();
  const last = lastRow_(sh);
  const palceSet = {}, silkaSet = {};
  if (last >= 2) {
    const data = sh.getRange(2, 1, last - 1, TOTAL_COLS).getValues();
    for (let b = 0; b < N_BLOCKS; b++) {
      const s = BLOCK_START + b * BLOCK_W;      // 0-indeksowana pozycja "Ćwiczenie" w tym bloku
      const bucket = b < N_PALCE ? palceSet : silkaSet;   // pierwsze N_PALCE bloków = Palce, reszta = Siłka
      for (let r = 0; r < data.length; r++) {
        const v = String(data[r][s] || '').trim();
        if (v) bucket[v] = true;
      }
    }
  }
  function pl(a, b) { return a.localeCompare(b, 'pl'); }
  const palce = Object.keys(palceSet).sort(pl);
  const silka = Object.keys(silkaSet).sort(pl);
  const list = palce.concat(silka);
  if (!list.length) { Logger.log('Brak nazw ćwiczeń w "Dane" — nic nie zmieniam.'); return; }

  const dash = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Dashboard');
  if (!dash) { Logger.log('Nie ma zakładki "Dashboard".'); return; }
  const rule = SpreadsheetApp.newDataValidation().requireValueInList(list, true).setAllowInvalid(false).build();
  dash.getRange('B2:C2').setDataValidation(rule);
  Logger.log('Gotowe: rozwijana lista w Dashboard (B2:C2) ma teraz ' + list.length + ' pozycji (' + palce.length + ' Palce, ' + silka.length + ' Siłka).');
}


// ====== DASHBOARD: przyciski "Generuj" / "Czyść" + auto-odświeżanie po zmianie B2/C2/D2 ======
// Odtworzone z Twojego starego skryptu (backup), dopasowane do obecnego układu "Dane"
// (bloki po 21 kolumn, z kolumnami "Kg s1..s8" — stary skrypt zakładał jeszcze 13-kolumnowe bloki).
function generateTrainingDashboard() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const daneSheet = ss.getSheetByName(SHEET_NAME);
  const dashSheet = ss.getSheetByName('Dashboard');
  const dane = daneSheet.getDataRange().getValues();
  const headers = dane[0];

  const idxStartMain = headers.indexOf('Waga');
  const idxEndMain = headers.indexOf('Koniec rozgrzewki');
  const idxStartEnd = headers.indexOf('Focus na ścianie 1');
  const idxEndEnd = headers.indexOf('Słabe strony');
  if ([idxStartMain, idxEndMain, idxStartEnd, idxEndEnd].some(function (i) { return i < 0; })) {
    throw new Error('Nie znalazłem jednej z kolumn ("Waga", "Koniec rozgrzewki", "Focus na ścianie 1", "Słabe strony") w nagłówkach "Dane". Sprawdź, czy nazwy nagłówków się nie zmieniły.');
  }

  const ex1 = dashSheet.getRange('B2').getValue();
  const ex2 = dashSheet.getRange('C2').getValue();
  const rodzajTreningu = dashSheet.getRange('D2').getValue();

  const exW = BLOCK_W - 1;   // szerokość bloku ćwiczenia od kolumny "Ćwiczenie" (bez "Przejdź do sekcji")
  const exerciseBlocks = [];
  for (let b = 0; b < N_BLOCKS; b++) exerciseBlocks.push(BLOCK_START + b * BLOCK_W);   // 0-indeksowana kolumna "Ćwiczenie" w bloku b

  const outputHeaders = ['Data']
    .concat(headers.slice(idxStartMain, idxEndMain + 1))
    .concat(headers.slice(exerciseBlocks[0], exerciseBlocks[0] + exW).map(function (h) { return 'Ex1: ' + h; }))
    .concat(headers.slice(exerciseBlocks[0], exerciseBlocks[0] + exW).map(function (h) { return 'Ex2: ' + h; }))
    .concat(headers.slice(idxStartEnd, idxEndEnd + 1));

  const output = [outputHeaders];
  const idxRodzaj = headers.indexOf('Rodzaj treningu');
  const idxData = headers.indexOf('Data');

  for (let r = 1; r < dane.length; r++) {
    const row = dane[r];
    if (rodzajTreningu && String(row[idxRodzaj] || '').toLowerCase() !== String(rodzajTreningu).toLowerCase()) continue;

    const data = row[idxData] || '';
    const mainSection = row.slice(idxStartMain, idxEndMain + 1);
    const endSection = row.slice(idxStartEnd, idxEndEnd + 1);

    let ex1Data = new Array(exW).fill('');
    let ex2Data = new Array(exW).fill('');
    exerciseBlocks.forEach(function (idx) {
      const name = row[idx];
      if (name === ex1) ex1Data = row.slice(idx, idx + exW);
      if (name === ex2) ex2Data = row.slice(idx, idx + exW);
    });

    let addRow = false;
    if (!ex1 && !ex2 && rodzajTreningu) addRow = true;
    else if ((ex1Data[0] && ex1Data[0] !== '') || (ex2Data[0] && ex2Data[0] !== '')) addRow = true;

    if (addRow) output.push([data].concat(mainSection, ex1Data, ex2Data, endSection));
  }

  dashSheet.getRange(4, 1, dashSheet.getMaxRows() - 3, outputHeaders.length).clearContent();
  dashSheet.getRange(4, 1, output.length, outputHeaders.length).setValues(output);
}

function clearAllMenus() {
  SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Dashboard').getRange('B2:D2').clearContent();
}

// ====== PODSUMOWANIE OKRESU (zakładka "Podsumowanie", przycisk "Pokaż") ======
function showPeriodSummary() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const daneSheet = ss.getSheetByName(SHEET_NAME);
  const summarySheet = ss.getSheetByName('Podsumowanie');

  const dataOd = summarySheet.getRange('C1').getValue();
  const dataDo = summarySheet.getRange('E1').getValue();

  if (!dataOd || !dataDo) {
    SpreadsheetApp.getUi().alert('Wybierz zakres dat w C1 i E1!');
    return;
  }

  const dane = daneSheet.getDataRange().getValues();
  const headers = dane[0];

  const filteredData = [headers];
  for (let r = 1; r < dane.length; r++) {
    const row = dane[r];
    const dataTreningu = row[1];
    if (dataTreningu instanceof Date && dataTreningu >= dataOd && dataTreningu <= dataDo) filteredData.push(row);
  }

  const nonEmptyCols = [];
  for (let c = 0; c < headers.length; c++) {
    const header = headers[c];
    if (!header || String(header).trim() === '') continue;
    let hasData = false;
    for (let r = 1; r < filteredData.length; r++) {
      const cellValue = filteredData[r][c];
      if (cellValue && String(cellValue).trim() !== '') { hasData = true; break; }
    }
    if (hasData) nonEmptyCols.push(c);
  }

  const cleanHeaders = nonEmptyCols.map(function (col) { return headers[col]; });
  const cleanData = [cleanHeaders];
  for (let r = 1; r < filteredData.length; r++) {
    cleanData.push(nonEmptyCols.map(function (col) { const v = filteredData[r][col]; return v || ''; }));
  }

  summarySheet.getRange('A4:ZZ1000').clearContent();

  if (cleanData.length > 1) {
    const numRows = cleanData.length, numCols = cleanData[0].length;
    summarySheet.getRange(4, 1, numRows, numCols).setValues(cleanData);

    const zakresInfo = 'Podsumowanie (' + (cleanData.length - 1) + ' treningów): ' +
      Utilities.formatDate(dataOd, Session.getScriptTimeZone(), 'dd.MM.yyyy') + ' - ' +
      Utilities.formatDate(dataDo, Session.getScriptTimeZone(), 'dd.MM.yyyy');

    summarySheet.getRange('A2').clearContent();
    summarySheet.getRange('A2').setValue(zakresInfo)
      .setFontWeight('bold').setFontSize(14).setWrap(false)
      .setHorizontalAlignment('left').setVerticalAlignment('middle');

    summarySheet.setColumnWidth(1, 100);
    summarySheet.setColumnWidth(3, 85);
    summarySheet.setColumnWidth(5, 85);
    for (let col = 2; col <= numCols; col++) {
      if (col === 3 || col === 5) continue;
      let maxWidth = 0;
      for (let row = 0; row < cleanData.length; row++) {
        maxWidth = Math.max(maxWidth, String(cleanData[row][col - 1] || '').length);
      }
      maxWidth = Math.max(maxWidth, String(cleanHeaders[col - 1] || '').length);
      summarySheet.setColumnWidth(col, Math.max(maxWidth * 1.2, 50));
    }
  } else {
    summarySheet.getRange('A4').setValue('Brak danych w wybranym okresie');
  }
}

// Auto-odświeżanie: zmiana B2/C2/D2 w Dashboard -> generateTrainingDashboard; zmiana E1 w Podsumowanie -> showPeriodSummary.
function onEdit(e) {
  const range = e.range, sheet = range.getSheet(), cell = range.getA1Notation();
  if (sheet.getName() === 'Dashboard' && (cell === 'B2' || cell === 'C2' || cell === 'D2')) generateTrainingDashboard();
  if (sheet.getName() === 'Podsumowanie' && cell === 'E1') showPeriodSummary();
}


// ====== PORZĄDKI W "Testy": czyszczenie nazw + kolumna ze starą nazwą obok ======
// Tylko kosmetyka (spacje, przecinki na końcu) — nazwy testów w tej zakładce to w większości
// pojedyncze, niepowtarzalne wpisy, więc nie mapujemy ich na nową strukturę (jak w "Dane"),
// tylko porządkujemy zapis. Stara (oryginalna) nazwa zostaje obok, w nowo wstawionej kolumnie B.
function wyczyscNazwyTesty() {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Testy');
  if (!sh) { Logger.log('Nie ma zakładki "Testy".'); return; }
  const last = sh.getLastRow();
  if (last < 2) { Logger.log('Brak nazw w kolumnie A.'); return; }

  const namesRange = sh.getRange(2, 1, last - 1, 1);
  const names = namesRange.getValues();

  function clean(v) {
    let s = String(v || '').trim().replace(/\s+/g, ' ');
    s = s.replace(/[,;]+$/, '').trim();
    return s;
  }

  const stare = [], nowe = [];
  let zmienione = 0;
  names.forEach(function (row) {
    const orig = row[0];
    const s = String(orig || '').trim();
    if (!s) { stare.push(['']); nowe.push(['']); return; }
    const nowa = clean(orig);
    stare.push([s]);
    nowe.push([nowa]);
    if (nowa !== s) zmienione++;
  });

  // wstaw nową kolumnę B (dane od C w prawo przesuną się razem z datami w nagłówku — nic się nie rozjedzie)
  sh.insertColumnBefore(2);
  sh.getRange('B1').setValue('Stara nazwa').setFontWeight('bold');
  sh.getRange(2, 2, stare.length, 1).setValues(stare);
  sh.getRange(2, 1, nowe.length, 1).setValues(nowe);
  sh.autoResizeColumn(1);
  sh.autoResizeColumn(2);

  Logger.log('Gotowe: wyczyszczono ' + zmienione + ' z ' + names.length + ' nazw. Stare nazwy są teraz w kolumnie B.');
}


// ====== PORZĄDKI: stare nazwy Palce na liście "własnych ćwiczeń" (zakładka "Aplikacja (nie ruszać)") ======
// Ta lista rośnie przez "+ Nowe ćwiczenie" w apce i mogła nazbierać starych nazw Palce sprzed
// reorganizacji. Czyści ją tym samym mapowaniem, którego użyliśmy do historii w "Dane".
function wyczyscCustomPalce() {
  const st = readState_();
  const list = st.custom.palce || [];
  const out = [];
  let zmienione = 0;
  list.forEach(function (n) {
    const nowa = Object.prototype.hasOwnProperty.call(RENAME_MAP_PALCE, n) ? RENAME_MAP_PALCE[n] : n;
    if (nowa !== n) zmienione++;
    if (out.indexOf(nowa) === -1) out.push(nowa);
  });
  writeState_(st.planned, { palce: out, silka: st.custom.silka });
  Logger.log('Gotowe: ' + zmienione + ' starych nazw zamienionych, lista ma teraz ' + out.length + ' pozycji (było ' + list.length + ').');
}
