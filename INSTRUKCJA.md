# Log treningowy: instrukcja uruchomienia

Aplikacja składa się z dwóch części:

- **`app/`**: sama aplikacja (strona instalowana na ekranie telefonu, działa offline).
- **`apps-script/Code.gs`**: skrypt w Twoim arkuszu, który przyjmuje treningi z aplikacji i dopisuje wiersze.

Hosting aplikacji (gdzie ma stać pod adresem www) wybierzesz na końcu, w części D. Części A–C możesz zrobić już teraz.

## A. Zrób kopię arkusza do testów (5 minut)

1. Otwórz swój arkusz „Claude log treningowy Brian”.
2. **Plik > Utwórz kopię**. Nazwij ją np. „TEST log treningowy”.
3. Wszystkie kolejne kroki rób najpierw na kopii. Dopiero gdy wszystko działa, powtórzysz je na oryginale.

## B. Wklej skrypt do arkusza

1. W kopii arkusza: **Rozszerzenia > Apps Script**.
2. Skasuj cały kod, który tam jest, i wklej zawartość pliku `apps-script/Code.gs`.
3. W pierwszej linii ustawień zmień `ZMIEN_TO_NA_WLASNE_HASLO` na własne hasło (np. długie, losowe). To samo hasło wpiszesz w aplikacji. Zapisz (ikona dyskietki).
4. Po lewej kliknij **Ustawienia projektu** (koło zębate) i ustaw **Strefę czasową** na `Europe/Warsaw`. Sprawdź też, że w arkuszu (**Plik > Ustawienia**) strefa to też Warszawa.
5. W edytorze wybierz z listy funkcji **`autoryzuj`** i kliknij **Uruchom**. Google zapyta o zgodę na dostęp do arkusza. Zezwól. Przy ostrzeżeniu „aplikacja niezweryfikowana” wybierz **Zaawansowane > Otwórz (niebezpieczne)**. To Twój własny skrypt.

## C. Dodaj kolumny Kg s1–s8 (raz)

1. Wybierz funkcję **`dodajKolumnyKg`** i kliknij **Uruchom**.
2. Skrypt wstawia 8 kolumn „Kg s1”…„Kg s8” zaraz za kolumną „Kg” w każdym z 12 bloków ćwiczeń. Arkusz ma po tym 285 kolumn zamiast 189. Jeśli coś się nie zgadza z oczekiwanym układem, skrypt niczego nie zmienia i pisze dlaczego.
3. **Opcjonalnie**, żeby stare treningi też miały ciężary per seria (przydatne do wykresów):
   - uruchom `uzupelnijStareKgPodglad` (nic nie zapisuje, w dzienniku pokaże, ile wpisów da się uzupełnić),
   - jeśli liczby wyglądają rozsądnie, uruchom `uzupelnijStareKg`. Wypełnia tylko puste komórki na podstawie starej kolumny Kg (np. „37,5 39 40 41”). Niejasne zapisy pomija.

**Uwaga:** przesunięcie kolumn poprawi się samo we wzorach w obrębie zakładki „Dane”. Wykresy, Dashboard, „Podsumowanie” i skrypty, które odwołują się do liter kolumn, mogą wymagać poprawek. Zrobimy je razem, na kopii.

## C2. Rozszerz limit „Palce” z 4 do 8 (raz, wrzesień 2026)

Aplikacja pozwala teraz na 8 ćwiczeń „Palce” w jednym treningu (wcześniej 4). Wymaga to jednorazowej zmiany w arkuszu — rób to PO kroku C (`dodajKolumnyKg` musi być już uruchomione):

1. W edytorze Apps Script podmień cały kod na aktualną zawartość `apps-script/Code.gs` (ma teraz też funkcję `rozszerzBlokiPalce`). Zapisz.
2. Wybierz funkcję **`rozszerzBlokiPalce`** i kliknij **Uruchom**.
3. Skrypt wstawia 4 nowe bloki (84 kolumny) zaraz po dotychczasowym 4. bloku „Palce”. Dawne bloki „Siłka” (5–12) przesuwają się na pozycje 9–16 — same dane nie są ruszane, tylko przesuwają się razem z kolumnami. Arkusz ma po tym 369 kolumn zamiast 285. Jeśli coś się nie zgadza z oczekiwanym układem, skrypt niczego nie zmienia i pisze dlaczego.
4. Wdróż na nowo skrypt jako aplikację internetową (krok D poniżej — **Wdróż > Zarządzaj wdrożeniami > ołówek > Nowa wersja**), żeby zmiany w kodzie zaczęły działać.
5. Sprawdź Dashboard/Podsumowanie/wykresy — jeśli odwołują się do konkretnych liter kolumn (a nie tylko do zakładki „Dane” jako całości), mogą wymagać poprawek po przesunięciu bloków Siłka.

## C3. Popraw historyczne nazwy ćwiczeń „Palce” (raz, wrzesień 2026)

Po korekcie nazw ćwiczeń (usunięte tagi typu „(Chwytka)”/„(Dom)”/„(BM2K)” z nazw, scalone warianty tego samego ćwiczenia) trzeba jednorazowo przemianować stare wpisy w arkuszu, żeby historia była spójna z nowymi filtrami. Rób to PO kroku C2 (`rozszerzBlokiPalce` musi być już uruchomione):

1. W edytorze Apps Script podmień cały kod na aktualną zawartość `apps-script/Code.gs` (ma teraz też funkcje `zmienNazwyPalce2Podglad`/`zmienNazwyPalce2`). Zapisz.
2. Wybierz funkcję **`zmienNazwyPalce2Podglad`** i kliknij **Uruchom**. Nic nie zapisuje — w **Widok > Dziennik wykonania** zobaczysz, ile komórek zostałoby zmienionych.
3. Jeśli liczba wygląda rozsądnie, wybierz funkcję **`zmienNazwyPalce2`** i kliknij **Uruchom**. Zmienia nazwy we wszystkich 8 blokach „Palce” w zakładce „Dane” i zapisuje kopię starych/nowych nazw w nowej zakładce „Backup nazw (palce) 2” (nic nie kasuje).
4. Wdróż na nowo skrypt jako aplikację internetową (krok D poniżej), żeby ewentualne inne zmiany w kodzie zaczęły działać.

## C4. Przenieś ćwiczenia Palce zalogowane w bloku Siłka (raz, wrzesień 2026)

Kilka ćwiczeń Palce trafiło historycznie do bloku „Siłka” (prawdopodobnie z braku wolnego miejsca w Palcach, sprzed rozszerzenia limitu do 8). Ta migracja przenosi cały blok (nazwa, ciężar, serie, powtórzenia) do wolnego bloku Palce w tym samym treningu. Rób to PO kroku C3:

1. W edytorze Apps Script podmień cały kod na aktualną zawartość `apps-script/Code.gs` (ma teraz też funkcje `przeniesPalceZSilkiPodglad`/`przeniesPalceZSilki`). Zapisz.
2. Wybierz funkcję **`przeniesPalceZSilkiPodglad`** i kliknij **Uruchom**. Nic nie zapisuje — w dzienniku wykonania zobaczysz, ile wpisów zostałoby przeniesionych i czy któryś trzeba by pominąć (gdyby akurat tamtego dnia wszystkie 8 slotów Palce było już zajęte).
3. Jeśli wygląda dobrze, wybierz funkcję **`przeniesPalceZSilki`** i kliknij **Uruchom**. Przenosi wpisy i zapisuje szczegóły w nowej zakładce „Backup przeniesień (Palce z Siłki)” (nic nie kasuje bezpowrotnie).
4. Wdróż na nowo skrypt jako aplikację internetową (krok D poniżej).

## D. Wdróż skrypt i opublikuj aplikację

**Wdrożenie skryptu:**

1. W Apps Script: **Wdróż > Nowe wdrożenie** > typ **Aplikacja internetowa**.
2. **Wykonaj jako:** Ja. **Kto ma dostęp:** Wszyscy. (Bez tego aplikacja nie dosięgnie skryptu. Chroni go Twoje hasło z kroku B.)
3. Kliknij **Wdróż** i skopiuj **Adres URL aplikacji internetowej** (kończy się na `/exec`).
4. Po każdej zmianie kodu skryptu trzeba zrobić **Wdróż > Zarządzaj wdrożeniami > Edytuj > Nowa wersja**.

**Publikacja aplikacji: dwie wersje, stabilna i testowa** (zalecane, bo pozwala rozwijać aplikację, nie psując treningów)

1. Załóż konto na github.com i utwórz **prywatne** repozytorium `log-treningowy`. Kod aplikacji (ten folder) trafia do niego z gałęzi `main` (stabilna) i `test` (testowa).
2. Załóż konto na netlify.com (logowanie przez GitHub) i wybierz **Add new site > Import an existing project**, potem repozytorium. Ustawienia są już w pliku `netlify.toml` (publikowany folder to `app`). Produkcyjna gałąź to `main`.
3. W ustawieniach strony (**Site configuration > Build & deploy > Branches**) włącz **Branch deploys** dla gałęzi `test`.
4. Adresy: `https://NAZWA.netlify.app` to wersja stabilna, do treningów. `https://test--NAZWA.netlify.app` to wersja testowa. Wersja z „test” w adresie pokazuje pomarańczowy znaczek **TEST** i jest instalowana osobno.
5. Obie wersje zapisują do tego samego arkusza (ten sam adres skryptu i hasło), więc wszystko, co zapiszesz na treningu, ląduje w arkuszu.

**Jak się z tym pracuje:** nowe funkcje trafiają najpierw na gałąź `test`. Sprawdzasz je w wersji testowej (możesz jej używać na treningu). Gdy działa, przenosimy zmiany na `main`. W zainstalowanej wersji stabilnej pojawia się wtedy na ekranie startowym przycisk **Jest nowa wersja aplikacji. Zaktualizuj**. Aktualizacja nigdy nie wchodzi sama, więc nie zmieni się w trakcie treningu. Numer wersji jest w Ustawieniach.

Aplikacja musi stać pod adresem `https://` (inaczej telefon nie pozwoli na tryb offline).

## E. Pierwsze uruchomienie na telefonie

1. Otwórz adres aplikacji w Chrome (Android) lub Safari (iPhone).
2. **Zainstaluj**: Android to menu ⋮ > „Zainstaluj aplikację” / „Dodaj do ekranu głównego”. iPhone to Udostępnij > „Do ekranu początkowego”.
3. Otwórz aplikację z ekranu głównego, kliknij **koło zębate**, wklej **adres skryptu** (z kroku D) i **hasło** (z kroku B).
4. Kliknij **Testuj połączenie**. Powinno napisać „Działa” i „Kolumny Kg s1–s8 są na miejscu”. Potem **Odśwież dane**. To pobiera treningi i plan makro z arkusza do Kalendarza, Historii, Planu i podpowiedzi „Ostatnio”. Dane odświeżają się też same po każdym zapisie.
5. Pierwsze uruchomienie zrób z internetem, żeby aplikacja pobrała czcionki i zapisała się do pracy offline.

## Komputer i bezpieczeństwo

- Na komputerze otwierasz ten sam adres w przeglądarce. Aplikacja działa tak samo, także z zapisem treningów. Trening możesz uzupełniać na telefonie albo na komputerze, wszystko trafia do tego samego arkusza. Rozpoczęty, niezapisany wpis zostaje na urządzeniu, na którym go zaczęto.
- **Nie ma logowania do samej strony, bo strona nie zawiera żadnych danych.** Dane są w arkuszu, a dostęp do nich chroni hasło skryptu. Hasło nie jest w kodzie aplikacji ani na GitHubie. Wpisujesz je raz na każdym urządzeniu. Najwygodniej przez **Ustawienia > Skopiuj link na inne urządzenie**, a potem otwierasz ten link na komputerze (adres dostosuj do wersji, którą konfigurujesz).
- Ustaw **długie, losowe hasło** (min. 20 znaków), nie zwykłe słowo. Skrypt odczekuje 1,5 s po każdym złym haśle, a hasło jest w treści zapytania, nie w adresie.
- Kto zna adres skryptu i hasło, może czytać log i dopisywać wiersze (nie może usuwać ani zmieniać istniejących). Gdyby hasło wyciekło, zmień `TOKEN` w skrypcie i zrób **nową wersję wdrożenia**.
- Na cudzym komputerze użyj po pracy **Ustawienia > Usuń dane z tego urządzenia**.
- Plany treningów i własne ćwiczenia synchronizują się między urządzeniami przez ukrytą zakładkę „Aplikacja (nie ruszać)” w arkuszu.

## F. Test na kopii i przejście na oryginał

1. Zapisz kilka treningów w aplikacji. Sprawdź w kopii arkusza, że nowe wiersze wyglądają jak dotychczasowe (daty, godziny, ćwiczenia, ciężary w „Kg s1–s8”).
2. Wyłącz internet w telefonie i zapisz trening. Status w rogu pokaże „Czeka: 1”. Po włączeniu internetu wyśle się sam.
3. Gdy jesteś zadowolony: powtórz kroki B–D na **oryginalnym arkuszu** (albo od tej pory używaj kopii jako głównego pliku). Adres skryptu i hasło zmienisz w aplikacji w Ustawieniach.
4. Formularz Google możesz zostawić podłączony do oryginału, dopóki nie przestaniesz go używać.

## Co jest w aplikacji

- **Ekran startowy:** Zacznij trening (albo Kontynuuj trening, jeśli masz rozpoczęty wpis), Kalendarz, Historia, Plan. Menu (trzy kreski w rogu) jest na każdym ekranie.
- **Kalendarz:** miesiące z kolorowymi kropkami wykonanych treningów (Wspin, Palce, Siłka, Skały). Dotknięcie dnia pokazuje treningi z tego dnia. W dniu dzisiejszym i przyszłych można zaplanować trening (rodzaj i notatka). Plan zapisuje się na razie tylko w telefonie.
- **Historia, zakładka Treningi:** przedział dat i filtr ćwiczenia. Każdy trening rozwija się do pełnych szczegółów (ćwiczenia z seriami i ciężarami, rozgrzewka, wszystkie pola podsumowania).
- **Historia, zakładka Wykres:** dowolne ćwiczenie (miara: maks. ciężar, szacowany 1RM, objętość, powtórzenia…) albo dowolna zmienna z logu (sen, waga, intensywność, samopoczucie…) w wybranym przedziale dat. Można dodać drugą serię do porównania oraz wygładzić linię średnią z 7 lub 30 dni.
- **Plan:** plan makro z zakładki „Plan Makro” (tylko do odczytu), pokazany fazami od najnowszej, z rokiem przy każdym miesiącu.
- **Telefon i komputer:** ta sama aplikacja działa w przeglądarce na komputerze (szerszy układ). Oba urządzenia zapisują do tego samego arkusza. Zaplanowane treningi i własne ćwiczenia synchronizują się przez zakładkę „Aplikacja (nie ruszać)”, którą skrypt sam tworzy w arkuszu. Nieskończony wpis treningu (szkic) zostaje na urządzeniu, na którym go zaczęto.
- Kalendarz, Historia i Plan działają także przed dodaniem kolumn Kg s1–s8 (dla starych treningów ciężary czytają się z kolumny Kg).

## Jak aplikacja zapisuje dane

- **Ćwiczenie:** nazwa z listy. Gdy wybierzesz prawą lub lewą rękę, do nazwy w arkuszu dopisuje się dawna końcówka, np. „Pulls 17mm P”, „Pulls half 17mm lewa”, „Przyblok prawa”. Dzięki temu historia się nie rozjeżdża. Końcówki ustawiasz w `app/config.js`.
- **Kg:** ciężar serii 1 (czyli główny). **Kg s1–s8:** ciężar każdej wykonanej serii. Puste serie zostają puste.
- **Kolumny „Przejdź do sekcji”** zostają puste (aplikacja nie ma przeskoków między sekcjami).
- **Rest** i czasy (mm:ss) zapisują się jak w formularzu: liczba jako liczba, „5:00” jako tekst. Godziny rozgrzewki jako godziny.
- **Kolumny „Intensywność - czerwona/żółta/zielona” i „Polar Flow”** zostają puste (aplikacja ich nie ma).
- Nowe ćwiczenia dodane w aplikacji i zaplanowane treningi zapamiętuje ten telefon (nie synchronizują się między urządzeniami).
- W starych wpisach ciężary z kolumny Kg zapisane słownie (np. „35 easy, 37,5 limit”) Historia pokazuje w oryginale, ale nie ma ich na wykresach. Literówki typu 353527,5 kg są pomijane.

## Komputer i bezpieczeństwo

- Sama strona aplikacji jest publiczna, ale nie zawiera żadnych danych. Dane pojawiają się dopiero po podaniu adresu skryptu i hasła, więc to hasło (TOKEN ze skryptu) jest jedynym „logowaniem”. Ustaw długie, losowe (20+ znaków).
- **Połączenie komputera:** na telefonie: menu > Ustawienia > „Skopiuj link na inne urządzenie”. Wyślij go sobie (np. mailem) i otwórz na komputerze: aplikacja połączy się sama, a link znika z paska adresu. Traktuj go jak hasło.
- **Zmiana hasła** (np. po zgubieniu telefonu): zmień TOKEN w skrypcie, zrób nową wersję wdrożenia i wpisz nowe hasło w aplikacji na urządzeniach.

## Gdy coś nie działa

- **„Czeka: N”** w rogu: trening jest bezpieczny w telefonie. Kliknij ten napis, żeby spróbować wysłać, i przeczytaj komunikat.
- **„Złe hasło”:** hasło w aplikacji różni się od `TOKEN` w skrypcie.
- **„Skrypt zwrócił nieoczekiwaną odpowiedź”:** wdrożenie musi mieć dostęp „Wszyscy”, a adres kończyć się na `/exec`. Po zmianie kodu zrób nową wersję wdrożenia.
- **„Arkusz ma jeszcze stary układ”:** uruchom `dodajKolumnyKg` (krok C).
