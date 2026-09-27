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
const N_BLOCKS = 12;          // 4 bloki Palce + 8 bloków Siłka
const OLD_BLOCK_W = 13;       // dawny blok: Przejdź, Ćwiczenie, Komentarz, Kg, Rest, 8x Powt.
const BLOCK_W = 21;           // nowy blok: + 8 kolumn "Kg s1..s8" zaraz za Kg
const BLOCK_START = 13;       // kolumna M: początek pierwszego bloku
const OLD_TOTAL_COLS = 189;   // dawny arkusz miał kolumny A:GG
const SUMMARY_START = BLOCK_START + N_BLOCKS * BLOCK_W;   // "Przejdź do sekcji 14"
const TOTAL_COLS = SUMMARY_START + 20;                    // 285 kolumn po dodaniu Kg s1..s8

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
      const blk = { c: b < 4 ? 'palce' : 'silka', n: name, p: p };
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
