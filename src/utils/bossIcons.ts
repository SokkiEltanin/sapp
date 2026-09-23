import { ImageSourcePropType } from 'react-native';
import { AttackKind } from '@/utils/bosses';

// ─────────────────────────────────────────────────────────────────────────────
// Custom boss artwork. Maps campaign Boss.id → file. require() paths must be
// static literals, so one line per boss (mirrors src/utils/badgeIcons.ts
// exactly — same pattern, same reasoning). Ids without an entry fall back to
// the boss's `emoji` field in the UI (see BossArt) — nothing breaks if art
// is missing.
//
// Foldery (2026-09-02, posegregowane analogicznie do `assets/ekwipunek/<slot>/` —
// user: "wszystkie bossy posegregować na kampanie/questy/eventy-rajdy, umiejętności"):
//   assets/bossy/kampania/      — 22 bossów kampanii (samurai...wizard) + 3 martwe
//                                 pliki zostawione na wypadek przyszłego użycia
//                                 (BOSS_atakfire_adventure.png — brak odpowiadającego
//                                 id w BOSSES; BOSS_reaperatack_reaper.png/BOSS_
//                                 pazurattack_cerberus.png — zastąpione customowym
//                                 artem burnout/doubt 2026-09-23).
//   assets/bossy/questy/        — minibossy questowe (mb_*, dawne assets/minibosses/ +
//                                 wilk/grizzly/osa) + 3 martwe (goat/whale, wycofane
//                                 z rotacji 2026-08-26; MINIBOSS_duck.png, zastąpiony
//                                 customowym mb_ropucha 2026-09-23).
//   assets/bossy/eventy-rajdy/  — sezonowe eventy (wakacje/wiosna/jesien/zima) I raid
//                                 (kraken/golem/phantom + ich warianty MAD) razem,
//                                 tak jak user zgrupował w jednej zakładce.
//   assets/bossy/umiejetnosci/  — ikony ataku bossów (BOSSATTACK_*, użyte w
//                                 boss-fight.tsx jako pocisk kontrataku) + 1 martwa
//                                 (BOSSATTACK_bomb.png, po usuniętym efekcie z 2026-08-18).
//   assets/lokalizacje/         — tła areny (LOKACJA_*.png), patrz `arenaBgFor()` niżej.
// ─────────────────────────────────────────────────────────────────────────────
export const BOSS_PNG: Record<string, ImageSourcePropType> = {
  sloth:     require('../../assets/bossy/kampania/BOSS_atakpazury_frog.png'),
  sugar:     require('../../assets/bossy/kampania/BOSS_handattack_pumpkin.png'),
  snake:     require('../../assets/bossy/kampania/BOSS_atakukąszenie_snake.png'),
  dragon:    require('../../assets/bossy/kampania/BOSS_fireattack_dragon.png'),
  scroll:    require('../../assets/bossy/kampania/BOSS_atakreka_thief.png'),
  stress:    require('../../assets/bossy/kampania/BOSS_atakukaszenie_tarantula.png'),
  junk:      require('../../assets/bossy/kampania/BOSS_maczukaatack_cyclops.png'),
  // Custom art (2026-09-23, user #7: "wrzuciłem Ci nowe bossy, zamieniamy te stare...
  // moje są customowe") — pierwsze 2 z 22 kampanijnych bossów dostają własny art zamiast
  // pożyczonego stockowego; dawne `BOSS_reaperatack_reaper.png`/`BOSS_pazurattack_
  // cerberus.png` zostają na dysku nieużywane, ten sam wzorzec co pozostałe "martwe"
  // pliki w tym folderze (patrz komentarz przy definicji `BOSS_PNG` wyżej). Oba źródłowe
  // pliki (i `MINIBOSS_ROPUCHA.png` niżej) przeskalowane 1536×1024/~2MB → 600×400/~290KB
  // (Pillow LANCZOS, alfa zachowana) — ten sam próg co `mb_lodowykrolik` (§94).
  burnout:   require('../../assets/bossy/kampania/BOSS_DYMNYNIEDZWIEDZ.png'),
  insomnia:  require('../../assets/bossy/kampania/BOSS_atakbone_skeleton.png'),
  compare:   require('../../assets/bossy/kampania/BOSS_atakmagicrod_magician.png'),
  drought:   require('../../assets/bossy/kampania/BOSS_ataksoundwave_mermaid.png'),
  procrast:  require('../../assets/bossy/kampania/BOSS_BOLTATTACK_zeus.png'),
  doubt:     require('../../assets/bossy/kampania/BOSS_MROCZNYKRUK.png'),
  devourer:  require('../../assets/bossy/kampania/BOSS_axeattack_executioner.png'),
  // ── prestiż (2026-08-09) ──
  samurai:       require('../../assets/bossy/kampania/BOSS_atakkatana_samurai.png'),
  jaguar:        require('../../assets/bossy/kampania/BOSS_atakpazurty_jaguar.png'),
  dinosaur:      require('../../assets/bossy/kampania/BOSS_atakpazury_dinosaur.png'),
  piratecapitan: require('../../assets/bossy/kampania/BOSS_attaksword_piratecapitan.png'),
  hades:         require('../../assets/bossy/kampania/BOSS_fireattack_hades.png'),
  clown:         require('../../assets/bossy/kampania/BOSS_handattack_clown.png'),
  princess:      require('../../assets/bossy/kampania/BOSS_handattack_princess.png'),
  wizard:        require('../../assets/bossy/kampania/BOSS_magicattack_wizard.png'),
  // ── sezonowe wydarzenia (seasonalEvents.ts) — TEN SAM plik/mapa co kampania,
  // id-e się nie kolidują, więc BossArt działa 1:1 bez osobnego komponentu (2026-08-10) ──
  wakacje:       require('../../assets/bossy/eventy-rajdy/BOSS_WAKACYJNYSŁONECZNYBOSS_pegasus.png'),
  wiosna:        require('../../assets/bossy/eventy-rajdy/BOSS_WIOSENNYBOSS_nike.png'),
  jesien:        require('../../assets/bossy/eventy-rajdy/BOSS_JESIENNYBOSS_demeter.png'),
  zima:          require('../../assets/bossy/eventy-rajdy/BOSS_ZIOMOWYBOSS_hera.png'),
  // ── minibossy questowe (minibosses.ts, 2026-08-14) — TA SAMA mapa/BossArt co reszta,
  // id-e (mb_*) się nie kolidują z kampanią/wydarzeniami, więc bez osobnego komponentu ──
  mb_capybara: require('../../assets/bossy/questy/MINIBOSS_capybara.png'),
  // mb_duck USUNIĘTY z minibosses.ts (2026-09-23, user #7: "możesz wywalić kaczkę") —
  // wpis tu też skasowany (ten sam wzorzec co mb_goat/mb_whale niżej), zastąpiony nowym
  // customowym mb_ropucha. `MINIBOSS_duck.png` zostaje na dysku nieużywany.
  mb_ropucha:  require('../../assets/bossy/questy/MINIBOSS_ROPUCHA.png'),
  mb_shark:    require('../../assets/bossy/questy/MINIBOSS_shark.png'),
  mb_harpy:    require('../../assets/bossy/questy/MINIBOSS_harpy-eagle.png'),
  mb_macaws:   require('../../assets/bossy/questy/MINIBOSS_macaws.png'),
  mb_snake:    require('../../assets/bossy/questy/MINIBOSS_snake.png'),
  // mb_goat/mb_whale USUNIĘTE z minibosses.ts (2026-08-26, user chciał świeżości w rotacji) —
  // wpisy tu też skasowane, żeby nie zostawić martwych require() do plików, które nic już nie
  // czyta (pliki same zostały, patrz komentarz przy folderach wyżej). Zastąpione
  // wilkiem/grizzly/osą — user dostarczył WŁASNY art (`osa_BOSSYuntitled.png` zostaje pod
  // DOKŁADNIE tą nazwą, tak jak user go wrzucił).
  mb_wilk:     require('../../assets/bossy/questy/BOSS_atakpazury_wilk.png'),
  mb_grizzly:  require('../../assets/bossy/questy/BOSS_atakpazury_grizly.png'),
  mb_osa:      require('../../assets/bossy/questy/osa_BOSSYuntitled.png'),
  // Lodowy Królik (2026-09-14) — user dostarczył WŁASNY art razem z tłem lokacji, patrz
  // `MISSION_LOCATION_BG` niżej. Źródłowy plik przeskalowany 1536×1024/2MB → 600×400/290KB
  // (Pillow LANCZOS, alfa zachowana) — ten sam próg co reszta folderu `bossy/` (§13).
  mb_lodowykrolik: require('../../assets/bossy/questy/MBOSS_LODOWYKROLIK.png'),
  // ── raid (2026-08-15) — 6 rajdowych bossów zaczynały bez własnego artu (placeholder/
  // emoji), tymczasowo pożyczały PNG z kampanii + programowa czerwona aura (`powered` prop
  // w BossArt). User dorysował WŁASNY dedykowany art dla 3 z nich (golem/kraken/upior=
  // phantom) tego samego dnia — te trzy mają teraz PRAWDZIWY plik zamiast pożyczonego.
  // behemoth/wyrm/siren wciąż pożyczają Z FOLDERU KAMPANII (wyrm/dragon = ten sam gatunek
  // smoka, siren/drought dzielą motyw wody+pragnienia i `weakness`, behemoth/sugar dzielą
  // TĘ SAMĄ słabość sweetless) — do podmiany gdy dostaną własny art w `eventy-rajdy/`.
  kraken:   require('../../assets/bossy/eventy-rajdy/BOSS_KRAKEN.png'),
  golem:    require('../../assets/bossy/eventy-rajdy/BOSS_GOLEM.png'),
  phantom:  require('../../assets/bossy/eventy-rajdy/BOSS_UPIOR.png'),
  behemoth: require('../../assets/bossy/kampania/BOSS_handattack_pumpkin.png'),
  wyrm:     require('../../assets/bossy/kampania/BOSS_fireattack_dragon.png'),
  siren:    require('../../assets/bossy/kampania/BOSS_ataksoundwave_mermaid.png'),
};

// Dedykowany art WARIANTU "powered" (czerwona aura) — narysowany osobno przez usera
// (`MADBOSS_*.png`, 2026-08-15), na razie tylko dla golem/kraken/phantom(upior). Reszta
// rajdowych bossów (behemoth/wyrm/siren) i bossy MAD z madBosses.ts nadal dostają
// PROGRAMOWĄ czerwoną aurę w BossArt (tint + glow) — to jest fallback dla wszystkiego bez
// wpisu tutaj, nie osobny system. Nazwa celowo INNA niż `mad_<id>` (madBosses.ts) — to dwa
// niepowiązane pojęcia "mad/powered": tam druga fala kampanii, tu wizualny wariant raidu.
export const POWERED_BOSS_PNG: Record<string, ImageSourcePropType> = {
  golem:   require('../../assets/bossy/eventy-rajdy/MADBOSS_GOLEM.png'),
  kraken:  require('../../assets/bossy/eventy-rajdy/MADBOSS_KRAKEN.png'),
  phantom: require('../../assets/bossy/eventy-rajdy/MADBOSS_UPIOR.png'),
};
export function poweredBossPng(id: string): ImageSourcePropType | undefined {
  return POWERED_BOSS_PNG[id];
}

// `mad_<id>` (madBosses.ts, 2026-08-15) reuses the base boss's OWN art (same "powered" red
// aura trick as raid above) — strip the prefix instead of duplicating all 22 require() lines.
export function bossPng(id: string): ImageSourcePropType | undefined {
  return BOSS_PNG[id] ?? (id.startsWith('mad_') ? BOSS_PNG[id.slice(4)] : undefined);
}

// ─────────────────────────────────────────────────────────────────────────────
// Ikony KONTRATAKU bossa w boss-fight.tsx (pocisk lecący między kafelkami + burst pazurów NA
// portrecie kotka) — 2026-08-26, user: "ta pięść jest zdecydowanie za często... atak pięścią
// nie rób własnej masz tam w BOSSATTACK... tak jak inne [magicspell]... to te pazury co masz
// zrobić bo nie wiem czy to wykorzystujesz... tutaj masz customowe typowo pod pirata". Te
// pliki (`BOSSATTACK_*.png`) leżały w `assets/ikonybosów/` od 13.08 NIEUŻYWANE — boss-fight.tsx
// renderował zamiast nich generyczne, kolorowane ikony lucide (HandFist/HandGrab/Sparkles/
// Sword). Teraz KAŻDY `AttackKind` (i fallbackowa pięść) ma swój prawdziwy PNG zamiast
// wektorowej ikony.
export const ATTACK_PNG: Record<AttackKind, ImageSourcePropType> = {
  claw:  require('../../assets/bossy/umiejetnosci/BOSSATTACK_zadrapaniepazury_claw-marks.png'),
  magic: require('../../assets/bossy/umiejetnosci/BOSSATTACK_magicspell.png'),
  // "customowe typowo pod pirata, ale można też pod samuraja" — jedyni dwaj bossy ze
  // sword (piratecapitan/samurai) dzielą TEN SAM plik, tak jak user zasugerował.
  sword: require('../../assets/bossy/umiejetnosci/BOSSATTACK_priateattack_blade.png'),
  fire:  require('../../assets/bossy/umiejetnosci/BOSSATTACK_FIRE.png'),
};
export const FIST_PNG: ImageSourcePropType = require('../../assets/bossy/umiejetnosci/BOSSATTACK_handattack_fist.png');
export function attackPng(kind: AttackKind | undefined): ImageSourcePropType {
  return kind ? ATTACK_PNG[kind] : FIST_PNG;
}

// Dawne dedykowane tło areny kampanii (2026-09-02, `arena-template.svg` → własny art usera).
// ODPIĘTE z rotacji 2026-09-14 (user ze zrzutem starej dungeon-owej areny: "wywal tę starą
// arenę i daj ten las górski, te [stare tło] usuniemy wgle pewnie") — kampania teraz też
// pożycza `DEFAULT_ARENA_BG` przez fallback w `arenaBgFor()` (`ARENA_BG_BY_KIND` niżej nie ma
// już wpisu `campaign`). Eksport i plik ZOSTAJĄ na razie (user: "usuniemy pewnie" — niepewne,
// nie stanowcze), ten sam wzorzec co dawne `mb_goat`/`mb_whale` w minibosses.ts — nic już tego
// nie czyta, ale nie kasuj dopóki user wprost nie potwierdzi.
export const CAMPAIGN_ARENA_BG: ImageSourcePropType = require('../../assets/lokalizacje/LOKACJA_KAMPANIA.png');

// Domyślne/fallbackowe tło areny (2026-09-14, user dostarczył `LOKALIZACJA_GORKISLAS.png` +
// "będę robił w trakcie kolejne grafiki pod inne kampanie, na razie możesz zostawić ten
// GORSKILAS jako domyślną [lokację]") — TERAZ dla WSZYSTKICH trybów bez własnego, dedykowanego
// tła, kampanię włącznie (patrz komentarz przy `CAMPAIGN_ARENA_BG` wyżej).
export const DEFAULT_ARENA_BG: ImageSourcePropType = require('../../assets/lokalizacje/LOKALIZACJA_GORKISLAS.png');

// Tła areny PER TYP WALKI (2026-09-02, user: "questy będą miały oddzielne tło... a eventowe
// będą miały osobne, a MAD bossy będą miały jeszcze inne" — ale bez gotowej grafiki jeszcze,
// więc na razie tylko przygotowanie: WSZYSTKIE tryby pożyczają `DEFAULT_ARENA_BG` przez
// `arenaBgFor()`, dopóki user nie dostarczy własnych plików per-kind (kampania też, od
// 2026-09-14 — patrz komentarz przy `CAMPAIGN_ARENA_BG`). Dodanie nowego dedykowanego tła =
// jedna nowa linia w tej mapie (`require()` na plik w `assets/lokalizacje/`) + WPIS DO TEJ
// MAPY, zero zmian w boss-fight.tsx — `arenaBgFor`/`fightArenaBg` już tam są podpięte.
type ArenaKind = 'campaign' | 'raid' | 'event' | 'quest' | 'mad' | 'mission';
const ARENA_BG_BY_KIND: Partial<Record<ArenaKind, ImageSourcePropType>> = {
  // campaign: require('../../assets/lokalizacje/LOKACJA_KAMPANIA.png'), // odpięte 2026-09-14
  // raid:   require('../../assets/lokalizacje/LOKACJA_RAID.png'),
  // event:  require('../../assets/lokalizacje/LOKACJA_EVENT.png'),
  // mad:    require('../../assets/lokalizacje/LOKACJA_MAD.png'),
};
export function arenaBgFor(kind: ArenaKind): ImageSourcePropType {
  return ARENA_BG_BY_KIND[kind] ?? DEFAULT_ARENA_BG;
}

// Tła LOKACJI misji/questów (`MiniBoss.destination` w minibosses.ts) — per KONKRETNY miniboss,
// nie per fight-`kind` jak `ARENA_BG_BY_KIND` wyżej (quest/misja dzielą JEDEN `kind`, ale 10
// różnych zwierząt z 10 różnymi lokacjami). 2026-09-14: `mb_lodowykrolik` (pierwsze dedykowane
// tło), `mb_osa` (Gęstwina Dżungli) i `mb_wilk` (Głąb Puszczy) dostały własne pliki w tej samej
// sesji co retematyzacja ich destynacji (patrz minibosses.ts); `mb_grizzly` (Polana nad
// Strumieniem) jeszcze CZEKA na plik — user zapowiedział, że dorysuje resztę stopniowo.
// Dokładnie ten sam wzorzec fallbacku co `bossPng`/`arenaBgFor`: miniboss BEZ wpisu tutaj po
// prostu nie dostaje dedykowanego tła (przez `fightArenaBg`/pet.tsx spada na `DEFAULT_ARENA_BG`)
// — nic się nie psuje, dodanie nowego pliku = jedna linia tu. Źródłowe pliki przeskalowane
// (Pillow LANCZOS) do tego samego progu co `LOKALIZACJA_LODOWA.png` (§94): max 1200px dłuższy
// bok, ~1-1,2MB.
export const MISSION_LOCATION_BG: Partial<Record<string, ImageSourcePropType>> = {
  mb_lodowykrolik: require('../../assets/lokalizacje/LOKALIZACJA_LODOWA.png'),
  mb_osa:          require('../../assets/lokalizacje/LOKALIZACJA_JUNGLA.png'),
  mb_wilk:         require('../../assets/lokalizacje/LOKALIZACJA_GORKISLAS.png'),
};
export function missionLocationBg(minibossId: string | undefined): ImageSourcePropType | undefined {
  return minibossId ? MISSION_LOCATION_BG[minibossId] : undefined;
}

// Tło CAŁEGO ekranu walki (2026-09-14, user: "dodałem Ci całoekranowe lokacje GORSKILAS oraz
// JUNGLA, one są na cały ekran... trzeba je ładnie zrobić" — boss-fight.tsx). Quest/misja mają
// PER-MINIBOSS lokację (`MISSION_LOCATION_BG`, ta sama scena co pet.tsx dla spójności — user
// widzi to samo miejsce w drodze I w walce); pozostałe tryby (kampania/raid/event/MAD) trzymają
// się PER-KIND `arenaBgFor`. Jedna funkcja zamiast duplikowania fallback-chain w boss-fight.tsx.
export function fightArenaBg(kind: ArenaKind, targetId: string | undefined): ImageSourcePropType {
  if ((kind === 'quest' || kind === 'mission') && targetId) {
    const loc = missionLocationBg(targetId);
    if (loc) return loc;
  }
  return arenaBgFor(kind);
}
