# Customowe startupy (ekran ładowania)

Wrzuć tu plik z animacją, a apka **sama go wykryje po nazwie** i doda jako startup w
Sklepie pupila (kategoria „Startupy").

## Nazwa pliku = `NAZWA_CENA`

Przykłady:

| Plik                    | Nazwa w apce | Koszt      |
|-------------------------|--------------|------------|
| `IDEALNIAK_130.webp`    | Idealniak    | 130 monet  |
| `KOSMOS_0.webp`         | Kosmos       | darmowy    |
| `ZLOTY_SMOK_250.webp`   | Zloty smok   | 250 monet  |

- **NAZWA** — dowolna; podkreślenia `_` zamieniają się na spacje, pierwsza litera duża.
- **CENA** — ostatni człon, jeśli jest liczbą (`0` lub brak = darmowy).

## Format (żeby NIE lagowało)

- **Animowany WebP** (najlepszy — lekki, obsługuje przezroczystość). GIF też zadziała.
- Rozmiar: **max ~480×480 px**.
- Tło: **czarne** (`#000`, jak splash) **albo przezroczyste**.
- ~**24 klatki/s**, **zapętlone**, waga **≤ ~250 KB**.

## WAŻNE

Pliki są **wbudowywane przy kompilacji APK** (jak ikona/splash). Nowy plik pojawi się
dopiero **po nowym buildzie** — nie wskoczy przez OTA.
