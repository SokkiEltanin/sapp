# Ikony odznak (Gablota)

PNG, przezroczyste tło, kwadrat **512×512 px**. Mapowanie pliku → odznaki jest w
`src/utils/badgeIcons.ts` (id odznaki → require pliku). Apka sama przygasza odznakę
gdy zablokowana. Bez wpisu w mapie pokazuje się ikona zastępcza (lucide).

## Już podpięte (Twoje ikony)

| plik                  | odznaka            | warunek                              |
|-----------------------|--------------------|--------------------------------------|
| `key.png`             | Pierwszy klucz     | pierwszy zalogowany wydatek          |
| `fingerprint.png`     | Skaner             | 50 zalogowanych wydatków             |
| `compass.png`         | Na kursie          | 7 dni z rzędu coś zalogowane         |
| `brand-loyalty.png`   | Z sercem           | 60 aktywnych dni                     |
| `hiking-boots.png`    | Maraton dnia       | 10 000 kroków w dzień                |
| `sun.png`             | Słoneczny tydzień  | 7 dni z rzędu nastrój ≥ 4            |
| `love.png`            | Dbam o siebie      | 30 dni z wpisem nastroju             |
| `theater-mask.png`    | Pełnia emocji      | zalogowane wszystkie nastroje 1–5    |
| `justice-scale.png`   | W równowadze       | miesiąc na plusie (przychód ≥ wydatki)|
| `signpost.png`        | Wyznaczony cel     | ustawiony pierwszy budżet            |
| `call-to-action.png`  | Wykonawca          | 25 ukończonych zadań                 |
| `crime-scene.png`     | Miejsce zbrodni 💀 | budżet przekroczony o ponad 50%      |
| `skull.png`           | Żywy trup 💀       | 3 noce z rzędu sen < 5 h             |
| `stomach.png`         | Bezdenny żołądek 💀| 5 dni z rzędu ze słodyczami          |

(💀 = antyodznaka / „grzeszek" — czerwona ramka.)

## Jeszcze na ikonie zastępczej (możesz dorobić, nazwa pliku = id)

`habit-streak-7` · `habit-streak-30` · `no-junk-7` · `saver-1000` · `saver-5000` ·
`saver-10000` · `work-100h` · `payday-first` · `loyal`

Wrzuć `<id>.png` i dopisz linię w `src/utils/badgeIcons.ts`.
Ramki wg poziomu: brąz `#CD7F32` · srebro `#C4CAD4` · złoto `#FFC83D` · grzeszki `#E5484D`.
