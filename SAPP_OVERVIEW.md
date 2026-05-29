# Sapp — Przegląd całej aplikacji

Osobista apka na Android (Expo SDK 54, React Native, TypeScript).
Jeden użytkownik, ciemny motyw, polski UI, brak emoji w interfejsie.

---

## Stack techniczny

| Warstwa | Technologia |
|---------|-------------|
| Framework | Expo SDK 54 + expo-router v6 |
| Język | TypeScript |
| Baza danych | Firebase Firestore (JS SDK v11) |
| Lokalny storage | AsyncStorage (ustawienia, product memory, historia Pomodoro) |
| Stan globalny | Zustand |
| Nawigacja | expo-router (file-based) |
| Ikony | lucide-react-native |
| Gradient | expo-linear-gradient |
| Wykresy | react-native-svg (ręczny SVG) |
| Haptyki | expo-haptics |
| Build | GitHub Actions → APK → GitHub Releases |

---

## Struktura folderów

```
app/
  _layout.tsx              # Root layout, TabBar, Toast, PomodoroIndicator
  (tabs)/
    _layout.tsx            # Tab navigator
    index.tsx              # Dashboard (Główna)
    calendar.tsx           # Kalendarz
    tasks.tsx              # Zadania
    finances.tsx           # Finanse
    mood.tsx               # Nastrój
    stats.tsx              # Statystyki
    health.tsx             # Zdrowie
  pomodoro.tsx             # Timer Pomodoro (modal screen)
  settings.tsx             # Ustawienia
  search.tsx               # Wyszukiwarka globalna
  notes.tsx                # Notatki
  habits.tsx               # Nawyki
  weekly.tsx               # Tygodniowy raport
  focus.tsx                # Tryb focus
  tasks/
    [id].tsx               # Szczegóły zadania
    add.tsx                # Dodaj zadanie
  calendar/
    [id].tsx               # Szczegóły eventu
    add.tsx                # Dodaj event
  expenses/
    [id].tsx               # Szczegóły transakcji (edycja paragonu)
    add.tsx                # Dodaj wydatek/przychód ręcznie
    manual.tsx             # Alternatywny formularz ręczny
    scan.tsx               # Skanowanie paragonu (OCR)
    stats.tsx              # Statystyki wydatków
    subscriptions.tsx      # Subskrypcje
    templates.tsx          # Szablony transakcji
  work/
    add.tsx                # Dodaj zmianę roboczą

src/
  types/index.ts           # Wszystkie typy (Expense, Task, CalendarEvent, Mood, ...)
  theme/                   # colors, spacing, typography, radius, animations
  store/                   # Zustand stores
  services/                # Firebase + zewnętrzne API
  components/              # UI komponenty
  hooks/                   # Custom hooks
  utils/                   # Logika biznesowa
```

---

## Moduły — szczegółowy opis

---

### Dashboard (`app/(tabs)/index.tsx`)

**Co robi:**
- Powitanie z porą dnia i imieniem
- Wave chart SVG — 8 tygodni nastroju wstecz, kropki kolorowane wg średniego nastroju tygodnia
- Weekowy przegląd (przychody vs wydatki)
- Skrót do ostatnich wydatków
- Floating PomodoroIndicator (draggable)

**Kluczowe:**
- `moodColor(avg)` → interpoluje kolor 1–5
- `dotColors` przekazywane do WaveChart z `moodStore`

---

### Kalendarz (`app/(tabs)/calendar.tsx`)

**3 tryby przełączane togglem:**

| Tryb | Opis |
|------|------|
| Tydzień | WeekStrip z nawigacją + DayDetail pod spodem |
| Miesiąc | Kompaktowa siatka CalendarGrid + DayDetail |
| Szczegółowy | Pełnoekranowa siatka Google Calendar style (kolorowe kafelki eventów w każdym dniu) |

**Pełnoekranowy modal miesiąca:**
- Otwiera się tapnięciem w nazwę miesiąca lub pull-down (RefreshControl.onRefresh)
- Zawiera CalendarGrid + listę eventów z tego miesiąca
- Na Androidzie pull-down otwiera modal (nie odświeża — Android nie ma negatywnego scroll Y)

**DayDetail:**
- Jeśli jest coś w wybranym dniu → pokazuje DayTimeline (jeśli eventy mają godziny) lub listę eventów + tasków
- Jeśli pusty dzień → nadchodzące zadania

**Komponenty:**
- `CalendarGrid` — siatka miesięczna, tryb compact i detailed
- `WeekStrip` — 7-dniowy pasek tygodnia z kropkami
- `DayTimeline` — oś czasu godzinowa dla dnia
- `TaskItem` — zadanie w liście kalendarza

---

### Zadania (`app/(tabs)/tasks.tsx`)

**Funkcje:**
- Lista zadań z priorytetem (high/normal/low), statusem, deadlinem
- Toggle done/pending (lokalny + Firestore)
- Sortowanie wg deadline
- Filtrowanie po statusie
- Subtaski w szczegółach (`tasks/[id].tsx`)
- Szacowany czas w Pomodoro (`estimatedPomodoros`)
- Powtarzające się zadania (`recurring`: daily/weekly/monthly)
- Nastrój po ukończeniu (`CompletionMoodModal`)

---

### Finanse (`app/(tabs)/finances.tsx`)

**Funkcje:**
- Lista transakcji (wydatki + przychody)
- Podsumowanie: saldo, suma wydatków, suma przychodów
- Filtrowanie po kategoriach / datach
- `ExpenseItem` z inline expand dla paragonów (chevron → lista produktów)

**Dodawanie transakcji:**
- Ręcznie (`expenses/add.tsx`) — formularz z kategorią, tagami, kwotą
- Skan paragonu (`expenses/scan.tsx`) — OCR → auto-kategoryzacja produktów
- Szablony (`expenses/templates.tsx`) — zapisane wzorce (np. "Paliwo 150zł")

**Szczegóły transakcji (`expenses/[id].tsx`):**
- Gradient hero card: głęboka czerwień (wydatek) / zieleń (przychód)
- Kwota LICZBA + "zł" (nie "PLN")
- Dla paragonów: lista produktów, każdy edytowalny inline
  - Edycja: nazwa, cena, ilość, kategoria, tagi żywnościowe
  - Zapis poprawek → productMemory (przyszłe skany auto-kategoryzują)

**Subskrypcje (`expenses/subscriptions.tsx`):**
- Śledzenie subskrypcji z cyklem (weekly/monthly/quarterly/yearly)
- Przypomnienia przed płatnością
- Auto-deaktywacja po N miesiącach

---

### Nastrój (`app/(tabs)/mood.tsx`)

**Funkcje:**
- Logowanie nastroju (1–5) + energii (1–5) + opcjonalna notatka + tagi
- Historia wpisów z kolorowym wykresem
- Streak (ile dni z rzędu)
- `MoodNudge` — przypomnienie o logowaniu jeśli nie zrobiono dziś
- `MoodCheckInModal` — szybki check-in z dowolnego miejsca w appce

**Kolory nastroju:**
```
1 → #FF5A5F (czerwony)
2 → #FF9F43 (pomarańczowy)
3 → #FFBE55 (żółty)
4 → #43D98F (zielony)
5 → #6C63FF (fioletowy)
```

---

### Pomodoro (`app/pomodoro.tsx` + `PomodoroIndicator`)

**Timer:**
- Work 25min → Break 5min → co 4 rundy Long Break 15min
- Konfigurowalne czasy pracy
- Haptyki: medium przy play/pause, success + vibration pattern przy końcu sesji
- Historia sesji w AsyncStorage (`pomodoroHistory.ts`)

**Milestones (tylko w trybie work):**
- Lista checkboxów "co robię w tej sesji"
- Dodawanie przez TextInput + przycisk Plus
- Toggle done z CheckSquare / Square

**Floating indicator (`PomodoroIndicator`):**
- Draggable (PanResponder + Animated.ValueXY)
- Tap = otwiera `/pomodoro`, drag = przesuwa
- `didMove` ref rozróżnia tap od drag
- Pojawia się gdy timer aktywny, pozycja: bottom 88 nad tab barem

---

### Zdrowie (`app/(tabs)/health.tsx`)

**Funkcje:**
- Kroki dzienne z celem
- Sesje snu (czas, jakość)
- Cele zdrowotne (`healthGoals.ts`)
- Nawyki (`habits.tsx`) — check/count typ, daily goal, ikona, kolor, przypomnienie

---

### Statystyki (`app/(tabs)/stats.tsx`)

- Miesięczne i tygodniowe raporty
- Wydatki per kategoria
- Pomodoro stats
- Zarobki z pracy

---

## Zustand Stores

| Store | Plik | Co trzyma |
|-------|------|-----------|
| `pomodoroStore` | `store/pomodoroStore.ts` | mode, remaining, isRunning, completedRounds, milestones, taskId |
| `moodStore` | `store/moodStore.ts` | entries: MoodEntry[] |
| `calendarStore` | `store/calendarStore.ts` | events, tasks, selectedDate, loading |
| `expensesStore` | `store/expensesStore.ts` | expenses: Expense[] |
| `workStore` | `store/workStore.ts` | settings: WorkSettings, shifts: WorkShift[] |
| `toastStore` | `store/toastStore.ts` | toast queue |
| `subscriptionsStore` | `store/subscriptionsStore.ts` | subscriptions: Subscription[] |

---

## Serwisy (Firebase / API)

| Serwis | Opis |
|--------|------|
| `firebase.ts` | Inicjalizacja Firebase JS SDK v11, Firestore |
| `calendarService.ts` | CRUD: CalendarEvent, Task |
| `expensesService.ts` | CRUD: Expense |
| `moodService.ts` | CRUD: MoodEntry |
| `workService.ts` | CRUD: WorkShift |
| `subscriptionsService.ts` | CRUD: Subscription |
| `templatesService.ts` | CRUD: ExpenseTemplate |
| `notificationsService.ts` | Push notyfikacje (task reminders, subscription reminders) |
| `ocrService.ts` | Skanowanie paragonu → tekst → ReceiptItem[] |
| `weatherService.ts` | Pogoda (opcjonalnie na dashboardzie) |
| `googleCalendarService.ts` | Integracja z Google Calendar |

---

## Utilities

| Plik | Co robi |
|------|---------|
| `productMemory.ts` | Pamięć produktów: trigram fuzzy matching (próg 0.60), max 500 wpisów. Auto-kategoryzuje produkty z paragonów na podstawie historii korekt. Osobno: TagMemory dla tagów żywnościowych. |
| `receiptParser.ts` | Parsuje surowy tekst OCR → ReceiptItem[] (nazwa, cena, ilość, rabat) |
| `categories.ts` | Metadane kategorii: ikona, kolor, etykieta PL |
| `haptics.ts` | `haptic.tap()`, `haptic.medium()`, `haptic.success()` |
| `pomodoroHistory.ts` | AsyncStorage log ukończonych sesji Pomodoro |
| `weeklyReports.ts` | Kalkulacje tygodniowych raportów |
| `monthlyReports.ts` | Kalkulacje miesięcznych raportów |
| `budgets.ts` | Budżety miesięczne per kategoria |
| `tagBudgets.ts` | Budżety per tag żywnościowy |
| `fixedCosts.ts` | Stałe koszty miesięczne |
| `habits.ts` | Logika nawyków (streak, completion) |
| `healthGoals.ts` | Cele zdrowotne |
| `notesStorage.ts` | AsyncStorage dla notatek |
| `appSettings.ts` | Globalne ustawienia appki |
| `scanCounter.ts` | Licznik skanów paragonów |
| `richText.ts` | Formatowanie tekstu |
| `date.ts` | Helpers daty (pad, todayStr, fmtDay...) |

---

## Komponenty UI

### `src/components/ui/`
| Komponent | Opis |
|-----------|------|
| `PressableScale` | Pressable z animacją scale (0.96) |
| `GlassCard` | Ciemna karta z border i blur-like efektem |
| `ScreenHeader` | Nagłówek ekranu z tytułem, subtitle, rightSlot |
| `Toast` | Powiadomienia w górze ekranu |
| `TabBar` | Niestandardowy tab bar na dole |
| `TabBarIcon` | Ikona taba z badge |
| `InputField` | Stylizowany TextInput |
| `DatePickerField` | Picker daty |
| `AnimatedButton` | Przycisk z animacją |
| `Chip` | Małe label/badge |
| `AmountDisplay` | Wyświetlanie kwoty (LICZBA + zł) |
| `FullScreenAlert` | Fullscreen modal alertu |
| `PomodoroIndicator` | Draggable floating timer bubble |

### `src/components/calendar/`
| Komponent | Opis |
|-----------|------|
| `CalendarGrid` | Siatka miesięczna (compact + detailed/Google Calendar style) |
| `WeekStrip` | 7-dniowy poziomy pasek tygodnia |
| `DayTimeline` | Oś czasu godzinowa dla eventów dnia |
| `TaskItem` | Wiersz zadania z toggle i priorytetem |
| `CalendarView` | Stary widok kalendarza (legacy, nieużywany w tabs) |

### `src/components/mood/`
| Komponent | Opis |
|-----------|------|
| `MoodPicker` | Picker 1–5 z etykietami |
| `MoodCheckInModal` | Modal szybkiego logowania nastroju |
| `MoodNudge` | Banner przypominający o logowaniu |

### `src/components/expenses/`
| Komponent | Opis |
|-----------|------|
| `ExpenseItem` | Wiersz transakcji. Dla paragonów: chevron expand → inline lista produktów |
| `ExpenseSummaryCard` | Karta podsumowania (saldo, in/out) |

---

## Typy danych

| Typ | Kluczowe pola |
|-----|---------------|
| `Expense` | id, type (expense/income), amount, category, tags, date, storeName, receiptItems[] |
| `ReceiptItem` | name, price, quantity, unitPrice, discount, category, tags[] |
| `Task` | id, title, deadline, scheduledDate, status, priority, difficulty, estimatedPomodoros, subtasks[], recurring |
| `CalendarEvent` | id, title, date, startTime, endTime, allDay, priority, color |
| `MoodEntry` | id, date, mood (1-5), energy (1-5), note, tags[] |
| `WorkShift` | id, date, startTime, endTime, monthlySalary, hoursPerMonth |
| `WorkSettings` | monthlySalary, hoursPerMonth, currency, workColor |
| `Subscription` | id, name, amount, billingCycle, nextBillingDate, reminderDaysBefore, durationMonths |
| `Habit` | id, title, color, icon, type (check/count), dailyGoal, unit, reminderTime |
| `PomodoroMilestone` | id, label, done |

---

## Kategorie wydatków

`groceries` / `transport` / `entertainment` / `health` / `clothing` / `housing` / `subscriptions` / `other`

## Kategorie przychodów

`salary` / `freelance` / `gift` / `transfer` / `investment` / `other_income`

## Tagi żywnościowe (paragon)

`mięso` / `nabiał` / `ryby` / `warzywa` / `owoce` / `słodycze` / `pieczywo` / `napoje` / `przekąski` / `chemia` / `higiena` / `dania gotowe`

---

## Kluczowe mechanizmy

### Product Memory (smart kategoryzacja paragonów)
1. OCR skanuje paragon → `receiptParser.ts` → lista produktów
2. `applyProductMemory()` → trigram similarity (próg 0.60) → auto-kategoria z historii
3. Użytkownik koryguje → `saveCustomProductsToMemory()` zapisuje do AsyncStorage
4. Następny skan podobnego produktu → auto-poprawna kategoria

### Work Color Tracking
- Ustawiasz kolor w WorkSettings (`workColor`)
- Eventy kalendarza z tym kolorem liczą się jako godziny pracy
- `useWorkEarnings` kalkuluje zarobki na podstawie przegapiony/przepracowanych godzin

### Pomodoro Flow
```
startFor(taskId) → work 25min → break 5min → (×4) → long break 15min
każda ukończona work sesja → logSession() → AsyncStorage history
```

### Android Pull-down
Na Androidzie ScrollView nie ma negatywnego scroll Y (brak rubber-band).
RefreshControl.onRefresh zamiast otwierać dane, otwiera MonthModal kalendarza.
`refreshing={false}` — brak spinnera, czysty redirect do modalu.
