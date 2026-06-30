# Ikony odznak (Gablota)

PNG, przezroczyste tło, kwadrat **512×512 px**. Mapowanie pliku → odznaki jest w
`src/utils/badgeIcons.ts`. Apka sama przygasza odznakę gdy zablokowana; bez wpisu w
mapie pokazuje się ikona zastępcza (lucide).

## Podpięte (26 ikon)

Dobre:
`key`→Pierwszy klucz · `fingerprint`→Skaner · `tote-bag`→Zakupowicz · `compass`→Na kursie ·
`brand-loyalty`→Z sercem · `fossil`→Wierny · `hiking-boots`→Maraton dnia · `sun`→Słoneczny tydzień ·
`love`→Dbam o siebie · `theater-mask`→Pełnia emocji · `papyrus`→Kronikarz · `justice-scale`→W równowadze ·
`speed-limit`→Pod limitem · `signpost`→Wyznaczony cel · `call-to-action`→Wykonawca · `cactus`→Tydzień mocy ·
`trunk`→Żelazna wola · `coin`→Poduszka · `gun`→Maszyna.

Grzeszki (antyodznaki, czerwona ramka):
`crime-scene`→Miejsce zbrodni · `skull`→Żywy trup · `stomach`→Bezdenny żołądek · `donut`→Słodki ząb ·
`pizza`→Fast food · `stop`→Czerwone światło · `toilet-paper`→Panikarz.

## Jeszcze na ikonie zastępczej (lucide) — nazwa pliku = id

Zwykłe: `no-junk-7` · `saver-1000` · `saver-10000` · `payday-first`

Legendarne (tier 4, fioletowa poświata): `legend-saver` · `centurion` · `unbreakable` ·
`year-one` · `clean-month` · `ultra-walk` · `titan`

Wrzuć `<id>.png` i dopisz linię w `src/utils/badgeIcons.ts`.
Ramki wg poziomu: brąz `#CD7F32` · srebro `#C4CAD4` · złoto `#FFC83D` · legenda `#A855F7` · grzeszki `#E5484D`.
