/* Konfiguracja aplikacji: listy opcji z formularza Google i układ arkusza.
   Tu edytujesz domyślne listy ćwiczeń i opcji. Zmiany widać po odświeżeniu aplikacji. */
window.LT_CONFIG = {
  version: '2026.09.26-3',   // numer wersji (zmieniany przy każdym wydaniu razem z sw.js)
  // Ćwiczenia bez rozróżnienia rąk w nazwie. Nowe ćwiczenia dodajesz w aplikacji ("+ Nowe ćwiczenie…").
  exercises: {
    palce: [
      'Pulls half 17mm',
      '6:10 repeaters 4p',
      '6:10 repeaters half 17mm',
      'BM2K 20mm',
      'Density 4p 15mm dom',
      '3p open',
      'Pulls 17mm'
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
  // Jak nazwa ćwiczenia wygląda w arkuszu, gdy wybierzesz tylko prawą lub lewą rękę.
  // Zachowuje dawne nazwy z formularza (np. "Pulls 17mm P"), żeby historia się nie rozjechała.
  // Ćwiczenia spoza tej listy dostają " prawa" / " lewa".
  sideSuffix: {
    'Pulls half 17mm': ['prawa', 'lewa'],
    '6:10 repeaters half 17mm': ['P', 'L'],
    '3p open': ['prawa', 'lewa'],
    'Pulls 17mm': ['P', 'L'],
    'Przyblok': ['prawa', 'lewa']
  },
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
