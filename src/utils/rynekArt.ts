// Assety ekranu Rynku (2026-09-05, user dostarczył 3 pliki wygenerowane w ChatGPT wg
// specyfikacji z tej samej sesji — patrz PR opisujący ARCHITECTURE.md dla kontekstu) —
// trzy warstwy złożone jedna pod drugą w ScrollView na app/pet-shop.tsx:
//   1. `RYNEK_BG` — tło całego ekranu (wnętrze sklepu), position:absolute pod wszystkim.
//   2. `RYNEK_TOP` — mała "tablica" z 4 oknami: skrzynka dnia (za darmo) + 3 skrzynki (gacha).
//   3. `RYNEK_BOTTOM` — właściwa lada z 8 oknami (2x4), ale UŻYWANY tylko górny rząd (4) —
//      Sklep dnia oferuje dziś tylko 4 konkretne itemy (`dailyShopSlots`), dolny rząd okien
//      zostaje pusty (tło prześwituje przez otwór, jak niewypełniona gablota) — jeśli kiedyś
//      Sklep dnia urośnie do 8 itemów, drugi rząd współrzędnych trzeba by dodać tu.
//
// Oryginalne kanwy usera miały 1080x1920 z dużym marginesem przezroczystości dookoła
// właściwej grafiki (ChatGPT wygenerował portretowy obrazek, ale treść zajmowała tylko
// część wysokości) — `RYNEK_TOP`/`RYNEK_BOTTOM` są PRZYCIĘTE (Pillow, bbox nieprzezroczystych
// pikseli + 24px marginesu) żeby nie marnować wysokości ekranu na pusty obszar.
//
// `RYNEK_BG` (2026-09-06, fix po zgłoszeniu usera "nadal [źle], musisz poprawić" ze zrzutem
// pokazującym grube czarne pasy po bokach całej sceny) — DAWNIEJ zostawiony w oryginalnym
// 1080x1920, założenie było że `resizeMode="cover"` "i tak przytnie brzegi". Fałszywe
// założenie: `TLOSKLEPIKARZ.png` miał ~12% przezroczystego marginesu po KAŻDEJ stronie (bbox
// alfa: 126-939 z 1080 szer.), a `cover` dopasowuje się do WYSOKOŚCI całej sceny (tablica+
// kotek+lada), która w tym pionowym obrazku wychodzi węższa niż potrzeba do pokrycia —
// `cover` przycinał tylko ~15px z każdej strony, zostawiając ~75px czystego marginesu
// przezroczystości (czyli czarnego tła apki) po OBU stronach na realnym ekranie. Naprawa:
// `TLOSKLEPIKARZ.png` przycięty do bbox alfa (+8px marginesu) tym samym skryptem co
// TOP/BOTTOM — teraz `cover` przycina rzeczywistą treść (trochę dachu u góry / podłogi u
// dołu, bez znaczenia wizualnego), a scena wypełnia całą szerokość bez czarnych pasów.
//
// Współrzędne okien (procent szerokości/wysokości WŁASNEGO kontenera obrazka, nie ekranu)
// zmierzone RAZ skryptem Python na kanale alfa (bbox przezroczystych "dziur" wewnątrz
// nieprzezroczystego obrysu), posortowane lewo→prawo. Jeśli obrazek zostanie kiedyś
// podmieniony/przycięty inaczej, te liczby trzeba przeliczyć od nowa tym samym skryptem.
export const RYNEK_BG = require('../../assets/lokalizacje/TLOSKLEPIKARZ.png');
export const RYNEK_TOP = require('../../assets/lokalizacje/LADAGORA.png');
export const RYNEK_BOTTOM = require('../../assets/lokalizacje/LADADOL.png');

export const RYNEK_TOP_ASPECT = 823 / 409;
export const RYNEK_BOTTOM_ASPECT = 885 / 995;

export interface PctRect { left: number; top: number; width: number; height: number }

// Slot 0 = skrzynka dnia (darmowa), 1-3 = skrzynki LOOT_BOXES (sardine/silver/gold).
export const RYNEK_TOP_SLOTS: PctRect[] = [
  { left: 13.12, top: 29.34, width: 14.95, height: 30.56 },
  { left: 32.81, top: 29.34, width: 14.95, height: 30.56 },
  { left: 52.49, top: 29.34, width: 14.82, height: 30.56 },
  { left: 72.17, top: 29.10, width: 14.95, height: 30.81 },
];

// Górny rząd lady = 4 itemy Sklepu dnia (`dailyShopSlots`, w tej samej kolejności).
export const RYNEK_BOTTOM_SLOTS: PctRect[] = [
  { left: 12.09, top: 54.37, width: 15.59, height: 13.17 },
  { left: 31.86, top: 54.37, width: 15.59, height: 13.17 },
  { left: 51.53, top: 54.37, width: 15.82, height: 13.17 },
  { left: 71.30, top: 54.37, width: 15.82, height: 13.17 },
];
