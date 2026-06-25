# Dual Browser Viewer - Scope i założenia

> Narzędzie do podglądu strony internetowej w wielu widokach jednocześnie (mobile, desktop lub dowolna kombinacja), side-by-side, w przeglądarce.

---

## Czym jest ten produkt

Web app osadzona w przeglądarce. Renderuje dowolny URL w N panelach jednocześnie - każdy panel to niezależna "przeglądarka" z własnym typem (mobile lub desktop), własnym viewportem, zakładkami, paskiem adresu i historią nawigacji.

Cel: szybka inspekcja responsywności bez przełączania DevTools, bez fizycznego urządzenia, bez instalowania czegokolwiek. Domyślny układ to mobile + desktop, ale użytkownik może dodać kolejne panele - np. trzy różne widoki mobile obok siebie do porównania breakpointów.

---

## Kto tego używa

**Primary:** designer lub PM sprawdzający responsywność podczas przeglądu przed publishem. Chce zobaczyć jednym rzutem oka: "czy mobile się nie posypało".

**Secondary:** developer QA - weryfikuje konkretną historię przed deployem.

**Tertiary:** product marketer lub redaktor - sprawdza jak artykuł/landing wygląda na komórce zanim go opublikuje.

---

## Panele i układ

Dynamiczny układ N paneli side-by-side. Domyślnie startuje z dwoma (mobile + desktop), ale użytkownik może dodawać i usuwać panele w dowolnej kombinacji.

**Typy paneli:**
- **Mobile** - iframe z wąskim viewportem (domyślnie 375 x 812 px), symuluje smartfon
- **Desktop** - iframe z szerokim viewportem (domyślnie 1440 x 812 px), symuluje monitor

**Przykładowe układy:**
- mobile + desktop *(default)*
- mobile + mobile *(porównanie dwóch rozmiarów mobilnych)*
- mobile + mobile + mobile *(np. iPhone SE vs iPhone 14 vs Samsung S23)*
- desktop + desktop *(np. 1280 vs 1920 px)*

**Picker układów w topbarze:**
- Ikony presetów układów do quick-switcha (widoczne na screenshocie: [mobile+desktop] i [mobile+mobile])
- Przycisk `+` z dropdownem: "Dodaj widok mobilny" / "Dodaj widok desktopowy"
- Dodanie panelu: wstawia nowy panel z prawej, dzieli dostępną szerokość równo między wszystkie

**Divider między panelami:**
- Każdy divider przeciągany drag-and-drop: zmienia proporcję szerokości sąsiednich paneli
- Double-click na dividerze: reset do równego podziału wszystkich paneli
- Min. szerokość panelu: **280 px** (żeby pasek adresu był używalny)

**Menu panelu (trzy kropki `...`):**

Każdy panel ma w nagłówku przycisk `...` otwierający context menu:

| Opcja | Działanie |
|-------|-----------|
| Close | Zamyka ten panel (i jego wszystkie zakładki) |
| Duplicate | Duplikuje panel z aktualnym URL, historią i zakładkami |
| Create QR code for this URL | Generuje QR kod aktualnego URL - żeby zeskanować fizycznym telefonem |
| Switch to mobile / Switch to desktop | Przełącza typ panelu (zmienia viewport, zachowuje URL) |
| Screenshot | Screenshoot tylko tego panelu, pobiera jako PNG |
| Open in PageSpeed Insights | Otwiera `https://pagespeed.web.dev/report?url=[aktualny URL]` w nowej karcie |
| Clear cookies and local storage | Czyści cookies i localStorage scope'owane do iframe tego panelu |

---

## Zakładki (tabs)

Każdy panel ma własny, niezależny tab strip.

**Zachowanie:**
- Nowe zakładki otwierają się w tym samym panelu
- Zakładki numerowane ("1", "2", "3") zamiast tytułu strony - krótkie bo panel jest wąski
- Hover na zakładce pokazuje tooltip z pełnym tytułem strony
- Max ~10 zakładek per panel (powyżej - scrollowalny tab strip)
- Zamknięcie zakładki bez potwierdzenia jeśli history == 1, z potwierdzeniem jeśli użytkownik ma historię

**Synchronizacja zakładek (opcja):**
- Toggle "Sync tabs" w pasku narzędziowym
- Gdy ON: otwarcie URL w jednym panelu automatycznie ładuje ten sam URL w odpowiadającej zakładce drugiego panelu
- Gdy OFF (default): panele nawigują całkowicie niezależnie

---

## Pasek nawigacji (per panel)

Każdy panel ma własny pasek:

```
[←] [→] [⟳]  [  URL bar                    ]  [open-in-new-tab]
```

- **Strzałki back/forward:** historia per tab, per panel
- **Reload:** twardy reload iframe
- **URL bar:** edytowalny, Enter = navigate. Walidacja: czy wpisano URL czy search query (jeśli brak protokołu i domeny - forward do Google lub wybranej wyszukiwarki)
- **Open in new tab (systemowym):** otwiera aktualny URL w nowej karcie przeglądarki - np. żeby przekazać link
- **Share icon:** kopiuje do schowka permalink z aktualnym stanem (URL lewego i prawego panelu + rozmiary viewportów + tab layout)

---

## Emulacja viewport

**Presety mobile (lewy panel):**
| Preset | Szerokość | Wysokość |
|--------|-----------|----------|
| iPhone SE | 375 | 667 |
| iPhone 14 | 390 | 844 |
| iPhone 14 Pro Max | 430 | 932 |
| Pixel 7 | 412 | 915 |
| Samsung S23 | 360 | 780 |
| iPad Mini | 768 | 1024 |
| Custom | edytowalne | edytowalne |

**Presety desktop (prawy panel):**
| Preset | Szerokość |
|--------|-----------|
| 1280 px | standardowy laptop |
| 1440 px | MacBook Pro 14/16 |
| 1920 px | Full HD monitor |
| Custom | edytowalne |

Picker presetów: dropdown w pasku per panel, obok wyświetlania aktualnych wymiarów.

Zmiana presetu: nie resetuje URL ani historii - tylko zmienia rozmiar iframe.

---

## Ograniczenia techniczne (iframe + CORS)

Największe ograniczenie techniczne: większość stron blokuje osadzanie w iframe przez nagłówek `X-Frame-Options: DENY` lub `Content-Security-Policy: frame-ancestors 'none'`.

**Dwa podejścia do rozwiązania:**

**Opcja A - Proxy server (pełne rozwiązanie):**
Żądania do zewnętrznych URL-i przechodzą przez własny serwer proxy, który stripuje nagłówki blokujące iframe. Proxy może też rewritować linki wewnętrzne strony żeby dalsze nawigacje też szły przez proxy.

- Zalety: działa dla niemal każdej strony
- Wady: kosztowne w utrzymaniu, ryzyko prawne (cache cudzej treści), latencja

**Opcja B - Browser extension:**
Rozszerzenie przeglądarki, które modyfikuje nagłówki odpowiedzi zanim przeglądarka je przetworzy. Użytkownik instaluje raz, potem iframe działa bez proxy.

- Zalety: zero opóźnień, brak serwera proxy, zgodność prawna (użytkownik sam instaluje)
- Wady: wymaga instalacji, nie działa w przeglądarce bez rozszerzenia

**Rekomendacja dla MVP:** zacznij od Opcji B (extension) + fallback z czytelnym komunikatem gdy iframe blokowany ("Ta strona blokuje osadzanie. [Zainstaluj rozszerzenie] lub [Otwórz w nowej karcie]").

---

## Projekty i persystencja

Użytkownik może zapisywać "projekt" = named snapshot stanu:

- Układ paneli (ile, jakiego typu, w jakiej kolejności)
- Viewporty per panel
- URL i zakładki per panel
- Nazwa projektu

Projekty persystowane w localStorage (brak backendu w MVP) lub w chmurze (post-MVP).

Funkcje projektu:
- Tworzenie nowego
- Rename / Delete
- Quick-switch między projektami (switcher w topbar)
- Export projektu do JSON (share z zespołem)
- Import JSON

---

## Topbar (globalny, ponad oboma panelami)

```
[Logo]  [Project: "nazwa ▾]  [Sync ○]  [Screenshot]  [Share]  [Settings ⚙]
```

- **Project switcher:** dropdown z listą projektów
- **Sync toggle:** włącza/wyłącza synchronizację nawigacji między panelami
- **Screenshot:** robi screenshota obu paneli razem (canvas merge), pobiera jako PNG. Przydatne do raportów, handoffu.
- **Share:** kopiuje permalink z pełnym stanem
- **Settings:** preferencje globalne (domyślne viewporty, domyślna wyszukiwarka, motyw dark/light)

---

## Skróty klawiszowe

| Skrót | Akcja |
|-------|-------|
| `Cmd+L` | Focus URL bar (tego panelu który był ostatnio aktywny) |
| `Cmd+T` | Nowa zakładka w aktywnym panelu |
| `Cmd+W` | Zamknij aktywną zakładkę |
| `Cmd+R` | Reload aktywnego panelu |
| `Cmd+[` / `Cmd+]` | Back / Forward aktywnego panelu |
| `Cmd+Shift+C` | Screenshot oba panele |
| `Cmd+S` | Zapisz aktualny stan jako projekt |
| `Tab` | Przełącz aktywny panel (lewy → prawy) |

---

## Motyw i UI

- Ciemny motyw domyślnie (praca z treścią na białym tle kontrastuje lepiej)
- Jasny motyw opcjonalnie (toggle w Settings)
- UI chrome minimalistyczne: topbar ~40px, tab strip ~32px, navbar per panel ~40px. Maksimum przestrzeni dla treści.
- Fonty UI: systemowe (San Francisco / Segoe) - zero ładowania fontów własnych

---

## Co jest poza MVP

Poniższe są post-MVP, ale scope powinien je przewidywać architektonicznie:

- **Udostępnianie projektów z zespołem** (backend + auth)
- **Zapisane komentarze / pinsy na panelach** (review workflow - designer pinuje element, dev widzi pin)
- **Nagrywanie sesji** (screencast obu paneli równolegle)
- **Automatyczne testy responsywności** (porównanie screenshotów między deployami)
- **Integracja z CI/CD** (URL preview środowisk z Vercel/Netlify/Render automatycznie zaciągany)
- **Device rotation** (portrait ↔ landscape)
- ~~**Więcej niż 2 panele**~~ - przeniesione do MVP (dynamiczne dodawanie paneli)

---

## Diagram przepływu - happy path

```
User wchodzi → Domyślny układ: mobile + desktop
→ Wpisuje URL → oba panele ładują tę samą stronę
→ Widzi mobile vs desktop side-by-side
→ Klika + → "Dodaj widok mobilny" → teraz 3 panele
→ Ustawia w nowym panelu iPhone SE (375px) żeby porównać z 390px
→ W panelu desktopowym klika ... → "Open in PageSpeed Insights"
→ W panelu mobilnym klika ... → "Create QR code" → skanuje telefonem fizycznie
→ Robi Screenshot (per panel lub globalny) → pobiera PNG
→ Zapisuje stan jako projekt "Review homepage v2"
```

---

## Open questions (do rozstrzygnięcia przed buildem)

1. **Proxy vs Extension:** decyzja architektoniczna #1. Extension = mniej bólu technicznego, ale friction onboardingowa. Proxy = zero friction, ale koszt i ryzyko prawne.
2. **Auth w MVP?** Projekty w localStorage = brak logowania, ale brak sync między urządzeniami. Czy MVP musi mieć logowanie?
3. **Czy oba panele zawsze identyczny URL?** Sync default ON czy OFF? Na screenshocie panele mają różne URL-e (i.pl vs Google) - sugeruje OFF.
4. **Mobile touch simulation?** Czy lewy panel ma symulować touch events (scroll touch-like, tap zamiast click)? Wymaga dodatkowego JS injection do iframe.
5. **Monetyzacja:** SaaS (per seat), freemium (limit projektów), one-time purchase, open source?

---

*Scope v0.2 - 2026-06-20 - dynamiczne panele, menu `...`, usunięto environment switcher z MVP*
