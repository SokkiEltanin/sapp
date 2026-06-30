# Ikony odznak (Gablota)

Wrzuć tu pliki PNG odznak. Format:

- **PNG z przezroczystym tłem**, kwadrat **512×512 px**
- nazwa pliku = **dokładne ID odznaki** (z listy poniżej), np. `saver-5000.png`
- jedna kolorowa wersja wystarczy — apka sama przygasza odznakę gdy zablokowana
  (opcjonalnie możesz dać osobną szarą `<id>-locked.png`, ale nie trzeba)

Po wrzuceniu PNG-a odkomentuj jego linię w `src/utils/badgeIcons.ts` — to wszystko.
Dopóki pliku nie ma, pokazuje się ikona zastępcza (lucide).

## Lista plików do zrobienia

| plik                       | odznaka            | opis                                  |
|----------------------------|--------------------|---------------------------------------|
| `habit-streak-3.png`       | Rozpęd             | 3 dni nawyku z rzędu                  |
| `habit-streak-7.png`       | Tydzień mocy       | 7 dni nawyku z rzędu                  |
| `habit-streak-30.png`      | Żelazna wola       | 30 dni nawyku z rzędu                 |
| `habit-all-day.png`        | Czysty dzień       | wszystkie dzisiejsze nawyki odhaczone |
| `no-junk-3.png`            | Bez cukru ×3       | 3 dni bez słodyczy                    |
| `no-junk-7.png`            | Tydzień fit        | 7 dni bez słodyczy                    |
| `no-junk-14.png`           | Dwa tygodnie       | 14 dni bez słodyczy                   |
| `saver-first.png`          | Pierwszy grosz     | pierwszy raz coś odłożone             |
| `saver-1000.png`           | Tysiąc             | 1 000 zł odłożone                     |
| `saver-5000.png`           | Poduszka           | 5 000 zł odłożone                     |
| `saver-10000.png`          | Forteca            | 10 000 zł odłożone                    |
| `work-payday-first.png`    | Pierwsza wypłata   | zalogowana pierwsza wypłata           |
| `work-50h.png`             | Robotnik           | 50 h pracy łącznie                    |
| `work-100h.png`            | Maszyna            | 100 h pracy łącznie                   |
| `receipts-25.png`          | Skaner             | 25 zalogowanych wydatków              |
| `receipts-100.png`         | Księgowy           | 100 zalogowanych wydatków             |
| `mood-7.png`               | Świadomy           | 7 dni z wpisem nastroju               |
| `mood-30.png`              | Introspekcja       | 30 dni z wpisem nastroju              |
| `steps-10k.png`            | Maraton dnia       | 10 000 kroków w jeden dzień           |
| `bills-first.png`          | Ogarnięty          | pierwszy stały rachunek śledzony      |

Kolory ramek wg poziomu (możesz się trzymać tej palety dla spójności):
brąz `#CD7F32` · srebro `#C4CAD4` · złoto `#FFC83D`.
