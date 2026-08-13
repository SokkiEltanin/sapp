# CLAUDE.md — czytaj przed pisaniem kodu

**Zanim dodasz lub zmienisz cokolwiek, przeczytaj [`ARCHITECTURE.md`](./ARCHITECTURE.md)** —
mapa: gdzie co żyje, jak się łączy, i „jak dodać X" wg wzorca (żeby nie zostawić
dead-endów). Gdy dodajesz sekcję/metrykę/store/subsystem — **zaktualizuj ARCHITECTURE.md**.

**[`NEXT_STEPS.md`](./NEXT_STEPS.md) = aktualna lista "co dalej"** (do przetestowania na
urządzeniu, znane niezałatane gap'y, odłożone rzeczy). Zaktualizuj ją po skończeniu/odkryciu
czegoś nowego — to jedyne miejsce w repo śledzące otwarte zadania między sesjami.

## Zasady, których nie łamać (najczęstsze powody psucia buildów)

1. **Style tylko przez `themedStyles((c)=>StyleSheet.create(...))`** — nigdy per-komponent
   `makeStyles(c)` w renderze (ANR: black-screen po paragonie, 30 s zwiecha edytora).
2. **`app.json android.permissions` ZASTĘPUJE domyślne Expo** — brak uprawnienia = cichy
   no-op. Ikona/splash/uprawnienia/plugins wchodzą **tylko przez nowy build APK**, nie OTA.
3. **Dashboard czyta snapshot `expenses`, nie żywy store** — patrz „Snapshot statystyk" w
   ARCHITECTURE §4. Handler, który zapisuje expenses, musi brać `useExpensesStore.getState()`.
4. **Nowa sekcja dashboardu = pełne podpięcie**: `DEFAULT_DASHBOARD_SECTIONS` +
   `SECTION_TITLES/DESC/GROUP` + node w `index.tsx`. (Playbook w ARCHITECTURE §12.)
5. **Bank „nie łapie" ≠ bug parsera** — najpierw test parsera na dokładnym stringu (heredoc
   w bashu zjada backslashe → pisz test do pliku).
6. **RN nie ma transform-origin**; animuj tylko transformy wrappera (SVG-propy stutterują);
   przelicz współrzędne przez `unit = size/2000`.
7. **Nie zostawiaj dead-endów** — rozszerzając funkcję, podłącz ją wszędzie (lista,
   statystyki, filtry, edycja, dashboard, powiadomienia, backup).
8. **Commit message: heredoc** (`git commit -F - <<'EOF'`) — backticki w `-m` się odpalają.

## Stack (skrót)

Expo SDK 54 · RN 0.81 New Arch · expo-router v6 · Zustand · Firestore + AsyncStorage ·
react-native-svg · TypeScript · UI po polsku, ciemny motyw · `com.sokki.sapp` · APK z GitHub.
