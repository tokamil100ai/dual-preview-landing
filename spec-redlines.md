# Spec: Red Line Ruler Feature — Dual Preview Plugin

## Kontekst projektu

Dual Preview to rozszerzenie Chrome (`app/` folder) renderujące dwa panele przeglądarki obok siebie (mobile + desktop). Główny obszar roboczy to `#panels-wrap` w `app/index.html`. Pliki do modyfikacji: `app/app.js`, `app/style.css`, `app/index.html`.

## Co budujemy

Poziome linie-linijki (inspiracja: Red Lines Tools na macOS) nakładane na cały obszar `#panels-wrap` — od lewej do prawej krawędzi. Pomagają sprawdzić czy elementy w obu panelach są wyrównane na tej samej wysokości.

---

## Wymagania funkcjonalne

### 1. Tworzenie linii

- Przycisk w UI (np. w obszarze toolbar lub floating button) z ikoną linijki / poziomej linii, oznaczony "Add line" lub ikoną `—`
- Kliknięcie przycisku dodaje nową czerwoną linię poziomą w środku widocznego obszaru `#panels-wrap`
- Linia rozciąga się od lewej do prawej krawędzi `#panels-wrap` (100% szerokości)
- Może istnieć wiele linii jednocześnie (brak limitu)

### 2. Wygląd linii

- Kolor: czerwony (`#FF3B30` lub podobny — klasyczny "redline")
- Grubość: 1px solid
- Linia jest `position: absolute` wewnątrz kontenera-nakładki nad `#panels-wrap`
- Wskaźnik pozycji: po lewej stronie linii (lub na niej) mały label pokazujący pozycję Y w pikselach od górnej krawędzi paneli, np. `"342px"` — żeby user wiedział na jakiej wysokości jest linia
- Opacity linii niezaznaczonej: 70–80% żeby nie dominowała nad treścią paneli

### 3. Interaktywność — hover

- Gdy kursor najedzie na linię (strefa klikalna: ±6px od linii, żeby łatwo złapać):
  - Kursor zmienia się na `ns-resize` (strzałki góra/dół)
  - Linia rozjaśnia się / zwiększa opacity do 100%
  - Pojawia się wizualny hint że można przeciągać (np. linia lekko się pogrubia do 2px lub zmienia kolor na jaśniejszy czerwony)

### 4. Przeciąganie (drag)

- Kliknięcie + przytrzymanie na linii → drag pionowy
- Podczas drag: linia podąża za kursorem (tylko oś Y), label aktualizuje się na bieżąco
- Snap opcjonalnie do pełnych pikseli (Math.round)
- Drag kończy się na `mouseup`
- Linia NIE może wyjść poza granice `#panels-wrap` (clamp do `[0, containerHeight]`)

### 5. Zaznaczenie linii

- Kliknięcie (bez drag) na linię → linia staje się "aktywna/zaznaczona":
  - Kolor zmienia się np. na ciemniejszy czerwony lub dodaje się outline/glow
  - Jednocześnie zaznaczona może być tylko jedna linia
  - Kliknięcie poza linią → odznaczenie
- Zaznaczona linia jest "active target" dla akcji klawiszowych i duplikacji

### 6. Usuwanie

- **Backspace lub Delete** gdy linia jest zaznaczona → usuwa ją natychmiast
- Dodatkowo: przy hover na linii pojawia się mały przycisk `×` po prawej stronie (lub lewej) linii → kliknięcie go usuwa tę linię (dla użytkowników nielubiących klawiatury)

### 7. Duplikowanie

- Gdy linia jest zaznaczona: przycisk `Duplicate` widoczny przy linii (np. obok `×`) lub skrót `Cmd+D`
- Duplikat pojawia się 20px niżej od oryginału
- Po duplikowaniu duplikat staje się aktywnym zaznaczeniem

### 8. Warstwa nakładki

- Wszystkie linie żyją w dedykowanym `<div id="redlines-overlay">` który jest:
  - `position: absolute` nad `#panels-wrap`
  - `pointer-events: none` na samym kontenerze (żeby nie blokował kliknięć w panele)
  - Indywidualne linie mają `pointer-events: all` żeby reagowały na zdarzenia
  - `z-index` wystarczająco wysoki żeby być nad panelami ale pod modalami/dropdownami
- Overlay musi mieć te same wymiary co `#panels-wrap` i być z nim zsynchronizowany (ResizeObserver lub podpięty pod istniejący layout render)

### 9. Persystencja (opcjonalnie, nice-to-have)

- Pozycje linii zapisane w `chrome.storage.local` pod kluczem `redlines`
- Przywracane po ponownym otwarciu pluginu

---

## Stan (data model)

```js
// Przykładowa struktura stanu
state.redlines = [
  { id: 'rl-1', y: 342, selected: false },
  { id: 'rl-2', y: 180, selected: true  },
];
```

Zarządzanie stanem powinno być spójne z istniejącym wzorcem w `app.js` (istniejący obiekt `state` i funkcja `render()`).

---

## UI — gdzie umieścić przycisk "Add line"

Projekt ma `#topbar` (obecnie `display:none` w CSS ale HTML istnieje) oraz może mieć floating controls. Preferowane miejsca w kolejności:

1. Jeśli topbar jest widoczny / zostanie odkryty → dodać przycisk obok istniejących `.tb-btn`
2. Jeśli nie → dodać floating button w prawym dolnym rogu `#panels-wrap`, np. okrągły FAB z ikoną `—`

Styl przycisku powinien pasować do istniejących `.tb-btn` (patrz `app/style.css`).

---

## Czego NIE robimy (out of scope)

- Linie pionowe (tylko poziome)
- Zmiana koloru linii przez użytkownika
- Grid / layout overlay (to osobna funkcja)
- Eksport / screenshot z liniami
- Linie per-panel (linie są globalne, na całej szerokości obu paneli)

---

## Pliki do modyfikacji

- `app/app.js` — logika stanu i drag
- `app/style.css` — style linii, overlay, animacje hover
- `app/index.html` — kontener overlay + przycisk dodawania

Nie tworzyć nowych plików JS — całość w istniejących plikach.
