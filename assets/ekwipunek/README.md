# Ekwipunek pupila — folder na grafiki

Osobny folder od `assets/itemybossy/` (to itemy BOJOWE, aktywne zdolności w walce —
inny system). Tu wchodzą itemy EKWIPUNKU — pasywne staty, zakładane na kotka.

Rarity (common/rare/epic/legendary/mythic) pokazujemy w apce jako kolorowa
obwódka wokół ikonki — **jedna grafika na item wystarczy**, nie trzeba rysować
5 wersji tej samej rzeczy. 30 plików total, 5 na slot.

Format: PNG, przezroczyste tło, kwadrat (podobny rozmiar jak w `assets/itemybossy/`).

Nazwy plików (dokładnie te, bo kod się do nich odwołuje przez `require()`):

## helm/ (hełm/czapka — crit%)
- `helm_slomiany.png` — Słomiany Kapelusz
- `helm_skorzany.png` — Skórzany Kaptur
- `helm_zelazny.png` — Żelazny Hełm Zwiadowcy
- `helm_krucza.png` — Kruczy Diadem
- `helm_koronaBurzy.png` — Korona Burzy

## zbroja/ (zbroja/napierśnik — flat HP)
- `zbroja_szmaciana.png` — Szmaciana Kamizelka
- `zbroja_skorzana.png` — Wzmacniana Kamizelka
- `zbroja_kolczuga.png` — Kolczuga Strażnika
- `zbroja_smoczaLuska.png` — Pancerz ze Smoczej Łuski
- `zbroja_aegis.png` — Aegis Świtu

## buty/ (buty — dodge%)
- `buty_znoszone.png` — Znoszone Sandały
- `buty_skorzane.png` — Zwinne Buty Skauta
- `buty_wiatr.png` — Buty Wiatrołaza
- `buty_cien.png` — Sandały Cienia
- `buty_kometa.png` — Buty Komety

## obroza/ (obroża — atk%)
- `obroza_sznurek.png` — Sznurkowa Obroża
- `obroza_kolce.png` — Nabijana Obroża
- `obroza_wilcza.png` — Wilczy Kieł
- `obroza_plomien.png` — Płonący Naszyjnik
- `obroza_tytan.png` — Obroża Tytana

## talizman/ (talizman — energyMult%)
- `talizman_kamyk.png` — Talizman z Kamyka
- `talizman_piorko.png` — Talizman z Piórka
- `talizman_ksiezyc.png` — Talizman Półksiężyca
- `talizman_gwiazda.png` — Talizman Spadającej Gwiazdy
- `talizman_nieskonczonosc.png` — Talizman Nieskończoności

## kolczyki/ (kolczyki — coins% bonus)
- `kolczyki_drewniane.png` — Drewniane Kolczyki
- `kolczyki_miedziane.png` — Miedziane Kolczyki
- `kolczyki_srebrne.png` — Srebrne Kolczyki
- `kolczyki_zlote.png` — Złote Kolczyki z Monetą
- `kolczyki_krezus.png` — Kolczyki Krezusa

Każda piątka w slocie to progresja poziomów odblokowania (T1→T5, najsłabszy→najsilniejszy
bazowy item), niezależna od rarity (które mnoży staty TEGO itemu). Kod czyta pliki z
`gear.ts` przez `require('../../assets/ekwipunek/<slot>/<nazwa>.png')` — jak wrzucisz
plik o dokładnie tej nazwie, apka go od razu podłapie, nic więcej nie trzeba zmieniać.
