/* Konfiguracja aplikacji: listy opcji z formularza Google i układ arkusza.
   Tu edytujesz domyślne listy ćwiczeń i opcji. Zmiany widać po odświeżeniu aplikacji. */
window.LT_CONFIG = {
  version: '2026.09.28-5',   // numer wersji (zmieniany przy każdym wydaniu razem z sw.js)
  // Co nowego: najnowsza wersja na górze. "v" to tylko etykieta widoczna w apce (nie musi być identyczna z "version" wyżej).
  changelog: [
    { v: '28.09.2026', items: [
      'Nowe, uporządkowane nazwy ćwiczeń Palce (historia w arkuszu też przepisana na nowe nazwy).',
      'Historia: liczba przy nazwie ćwiczenia pokazuje teraz treningi z wybranego zakresu dat (nie z całej historii); ćwiczenia bez wystąpień w zakresie są bez liczby.',
      'Naprawiona instalacja aplikacji na telefonie (przycisk „Zainstaluj” nie działał w niektórych przeglądarkach).'
    ] }
  ],
  // Ćwiczenia bez rozróżnienia rąk w nazwie. Nowe ćwiczenia dodajesz w aplikacji ("+ Nowe ćwiczenie…").
  exercises: {
    palce: [
      'Pulls 4p half crimp 17mm',
      'Repeaters 6:10 4p open 20mm',
      'Repeaters 6:10 4p half crimp 17mm',
      'Max Hangs 4p open 20mm',
      'Density 4p 15mm',
      'Pulls 3p open',
      'Pulls 4p open 17mm'
    ],
    silka: [
      'Wyciskanie sztangi płasko',
      'Podciągi szeroko',
      'Podciągi normalne',
      'Hantle na skosie',
      'Podciągi podchwytem',
      'Wiosłowanie jednorącz',
      'Archer pullups',
      'Przyblok'
    ]
  },
  // Migracja starych nazw ćwiczeń Palce (sprzed reorganizacji, wrzesień 2026) na nowe.
  // Aplikacja używa tego RAZ, przy starcie, żeby wyczyścić ewentualne stare nazwy zapisane
  // lokalnie na telefonie (w liście "własnych" ćwiczeń) — te same nazwy, które przepisaliśmy
  // już w arkuszu. Nie dotyka historii treningów, tylko podpowiedzi w apce.
  legacyPalceRename: {
    '10mm': 'Max Hangs 4p open 10mm',
    '8mm': 'Max Hangs 4p open 8mm',
    '3p open lewa': 'Pulls 3p open',
    '3p open prawa': 'Pulls 3p open',
    '3p open': 'Pulls 3p open',
    '4p asym L': 'Pulls 4p open asym',
    '4p asym lewa': 'Pulls 4p open asym',
    '4p asym P': 'Pulls 4p open asym',
    '4p asym prawa': 'Pulls 4p open asym',
    '4p half asym lewa': 'Max Hangs 4p half crimp asym',
    '4p half asym prawa': 'Max Hangs 4p half crimp asym',
    '4p half asym lewa 5:10': 'Repeaters 5:10 4p half crimp asym',
    '4p half asym prawa 5:10': 'Repeaters 5:10 4p half crimp asym',
    '4p open asym lewa 5:10': 'Repeaters 5:10 4p open asym',
    '4p open asym prawa 5:10': 'Repeaters 5:10 4p open asym',
    '6:10  repeaters 17mm L': 'Repeaters 6:10 4p open 17mm',
    '6:10  repeaters 17mm P': 'Repeaters 6:10 4p open 17mm',
    '6:10 repeaters 17mm L': 'Repeaters 6:10 4p open 17mm',
    '6:10 repeaters 17mm P': 'Repeaters 6:10 4p open 17mm',
    '6:10  repeaters asym P': 'Repeaters 6:10 4p open 17mm',
    '6:10 repeaters asym L': 'Repeaters 6:10 4p open 17mm',
    '6:10 repeaters asym P': 'Repeaters 6:10 4p open 17mm',
    '6:10 repeaters 4p': 'Repeaters 6:10 4p open 20mm',
    '6:10 repeaters asym  3p L': 'Repeaters 6:10 3p open asym',
    '6:10 repeaters asym  3p P': 'Repeaters 6:10 3p open asym',
    '6:10 repeaters asym half  b3 P': 'Repeaters 6:10 b3 half crimp asym',
    '6:10 repeaters asym half 3p no fuck L': 'Repeaters 6:10 3p (bez środkowego) half crimp asym',
    '6:10 repeaters half 17mm  P': 'Repeaters 6:10 4p half crimp 17mm',
    '6:10 repeaters half 17mm L': 'Repeaters 6:10 4p half crimp 17mm',
    '6:10 repeaters half 17mm': 'Repeaters 6:10 4p half crimp 17mm',
    '6:10 repeaters half asym L': 'Repeaters 6:10 4p half crimp 17mm',
    '6:10 repeaters half asym P': 'Repeaters 6:10 4p half crimp 17mm',
    '7:3 repeaters 4p': 'Repeaters 7:3 4p open Campus XL',
    '7:3 repeaters asym  3p L': 'Repeaters 7:3 3p open asym',
    '7:3 repeaters asym  3p P': 'Repeaters 7:3 3p open asym',
    '7:3 repeaters asym  4p P': 'Repeaters 7:3 4p open asym',
    '7:3 repeaters asym 4p L': 'Repeaters 7:3 4p open asym',
    '7:3 repeaters asym half  3p no fuck P': 'Repeaters 7:3 3p (bez środkowego) half crimp asym',
    '7:3 repeaters asym half 3p no fuck L': 'Repeaters 7:3 3p (bez środkowego) half crimp asym',
    'BM2K 20mm': 'Max Hangs 4p open 20mm',
    'Density 4p 15mm dom': 'Density 4p 15mm',
    'Density 4p 20mm dom': 'Density 4p 20mm',
    'Density half 17mm lewa': 'Density 4p half crimp 17mm',
    'Density half 17mm prawa': 'Density 4p half crimp 17mm',
    'Density half asym lewa': 'Density 4p half crimp asym',
    'Density half asym prawa': 'Density 4p half crimp asym',
    'Dom 10mm': 'Max Hangs 4p open 10mm',
    'Dom 15mm': 'Max Hangs 4p open 15mm',
    'MH 17mm L': 'Max Hangs 4p open 17mm',
    'MH 17mm P': 'Max Hangs 4p open 17mm',
    'MH half 17mm lewa': 'Max Hangs 4p half crimp 17mm',
    'MH half 17mm prawa': 'Max Hangs 4p half crimp 17mm',
    'Pulls 17mm L': 'Pulls 4p open 17mm',
    'Pulls 17mm P': 'Pulls 4p open 17mm',
    'Pulls 17mm': 'Pulls 4p open 17mm',
    'Pulls half 17mm lewa': 'Pulls 4p half crimp 17mm',
    'Pulls half 17mm prawa': 'Pulls 4p half crimp 17mm',
    'Pulls half 17mm': 'Pulls 4p half crimp 17mm',
    'Wrist wrench P i L': 'Wrist wrench'
  },
  // Jak nazwa ćwiczenia wygląda w arkuszu, gdy wybierzesz tylko prawą lub lewą rękę.
  // Od reorganizacji nazw (wrzesień 2026) nowe nazwy ćwiczeń Palce nie mają już strony w nazwie
  // (to była osobna kolumna/wybór w apce), więc wszystko dostaje zwykłe " prawa" / " lewa".
  sideSuffix: {},
  limits: { palce: 4, silka: 8 },
  maxSets: 8,
  trainingTypes: ['Wspin', 'Palce', 'Siłka', 'Skały'],
  drills: [
    'Chwyty w tę samą stronę', 'Precyzja - tick mark aims', 'Precyzja - sticky holds',
    'Haczenie pięty', 'Perfecto', 'Krzyżobranie', 'Dead-Point', 'Wyjazd nóg'
  ],
  focusOptions: [
    'Perfecto/technika', 'Hard bouldering', 'Objętość', 'Spray', 'Board (Kilter/Moon/Tension)',
    'Projektowanie', '3x6 baldów', 'Board Crawl', 'System bouldering/perfecto', 'Powtarzanie baldów', 'FUN'
  ],
  focusCheck: [
    'Odmierzałem resty, > 3min', 'Nagrywałem wstawki', 'Try hard, serio!', 'Wspinałem się z intencją',
    'Rozgrzewałem się z intencją', 'Skończyłem zanim siła zupełnie spadła',
    'Skupiłem się na rzeczach, które były niekomfortowe', 'Wykonałem cały zamierzony plan'
  ],
  intensityHint: '5 total hardcore, 4 Kilter hard, 3 wymagające, 2 bez przesady, 1 EAF'
};
