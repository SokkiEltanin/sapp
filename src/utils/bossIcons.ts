import { ImageSourcePropType } from 'react-native';
import { AttackKind } from '@/utils/bosses';

// ─────────────────────────────────────────────────────────────────────────────
// Custom boss artwork (assets/ikonybosów, flat-vector PNG, each already drawn
// mid-attack). Maps campaign Boss.id → file. require() paths must be static
// literals, so one line per boss (mirrors src/utils/badgeIcons.ts exactly —
// same pattern, same reasoning). Ids without an entry fall back to the boss's
// `emoji` field in the UI (see BossArt) — nothing breaks if art is missing.
// ─────────────────────────────────────────────────────────────────────────────
export const BOSS_PNG: Record<string, ImageSourcePropType> = {
  sloth:     require('../../assets/ikonybosów/BOSS_atakpazury_frog.png'),
  sugar:     require('../../assets/ikonybosów/BOSS_handattack_pumpkin.png'),
  snake:     require('../../assets/ikonybosów/BOSS_atakukąszenie_snake.png'),
  dragon:    require('../../assets/ikonybosów/BOSS_fireattack_dragon.png'),
  scroll:    require('../../assets/ikonybosów/BOSS_atakreka_thief.png'),
  stress:    require('../../assets/ikonybosów/BOSS_atakukaszenie_tarantula.png'),
  junk:      require('../../assets/ikonybosów/BOSS_maczukaatack_cyclops.png'),
  burnout:   require('../../assets/ikonybosów/BOSS_reaperatack_reaper.png'),
  insomnia:  require('../../assets/ikonybosów/BOSS_atakbone_skeleton.png'),
  compare:   require('../../assets/ikonybosów/BOSS_atakmagicrod_magician.png'),
  drought:   require('../../assets/ikonybosów/BOSS_ataksoundwave_mermaid.png'),
  procrast:  require('../../assets/ikonybosów/BOSS_BOLTATTACK_zeus.png'),
  doubt:     require('../../assets/ikonybosów/BOSS_pazurattack_cerberus.png'),
  devourer:  require('../../assets/ikonybosów/BOSS_axeattack_executioner.png'),
  // ── prestiż (2026-08-09) ──
  samurai:       require('../../assets/ikonybosów/BOSS_atakkatana_samurai.png'),
  jaguar:        require('../../assets/ikonybosów/BOSS_atakpazurty_jaguar.png'),
  dinosaur:      require('../../assets/ikonybosów/BOSS_atakpazury_dinosaur.png'),
  piratecapitan: require('../../assets/ikonybosów/BOSS_attaksword_piratecapitan.png'),
  hades:         require('../../assets/ikonybosów/BOSS_fireattack_hades.png'),
  clown:         require('../../assets/ikonybosów/BOSS_handattack_clown.png'),
  princess:      require('../../assets/ikonybosów/BOSS_handattack_princess.png'),
  wizard:        require('../../assets/ikonybosów/BOSS_magicattack_wizard.png'),
  // ── sezonowe wydarzenia (seasonalEvents.ts) — TEN SAM plik/mapa co kampania,
  // id-e się nie kolidują, więc BossArt działa 1:1 bez osobnego komponentu (2026-08-10) ──
  wakacje:       require('../../assets/ikonybosów/BOSS_WAKACYJNYSŁONECZNYBOSS_pegasus.png'),
  wiosna:        require('../../assets/ikonybosów/BOSS_WIOSENNYBOSS_nike.png'),
  jesien:        require('../../assets/ikonybosów/BOSS_JESIENNYBOSS_demeter.png'),
  zima:          require('../../assets/ikonybosów/BOSS_ZIOMOWYBOSS_hera.png'),
  // ── minibossy questowe (minibosses.ts, 2026-08-14) — TA SAMA mapa/BossArt co reszta,
  // id-e (mb_*) się nie kolidują z kampanią/wydarzeniami, więc bez osobnego komponentu ──
  mb_capybara: require('../../assets/minibosses/MINIBOSS_capybara.png'),
  mb_duck:     require('../../assets/minibosses/MINIBOSS_duck.png'),
  mb_shark:    require('../../assets/minibosses/MINIBOSS_shark.png'),
  mb_harpy:    require('../../assets/minibosses/MINIBOSS_harpy-eagle.png'),
  mb_macaws:   require('../../assets/minibosses/MINIBOSS_macaws.png'),
  mb_snake:    require('../../assets/minibosses/MINIBOSS_snake.png'),
  // mb_goat/mb_whale USUNIĘTE z minibosses.ts (2026-08-26, user chciał świeżości w rotacji) —
  // wpisy tu też skasowane, żeby nie zostawić martwych require() do plików, które nic już nie
  // czyta. Zastąpione wilkiem/grizzly/osą — user dostarczył WŁASNY art i wrzucił go do
  // `assets/ikonybosów/` (nie `assets/minibosses/` jak reszta minibossów — require() nie
  // wymaga jednolitego folderu/konwencji nazw, wystarczy że plik istnieje pod tą ścieżką;
  // `osa_BOSSYuntitled.png` zostaje pod DOKŁADNIE tą nazwą, tak jak user go wrzucił).
  mb_wilk:     require('../../assets/ikonybosów/BOSS_atakpazury_wilk.png'),
  mb_grizzly:  require('../../assets/ikonybosów/BOSS_atakpazury_grizly.png'),
  mb_osa:      require('../../assets/ikonybosów/osa_BOSSYuntitled.png'),
  // ── raid (2026-08-15) — 6 rajdowych bossów zaczynały bez własnego artu (placeholder/
  // emoji), tymczasowo pożyczały PNG z kampanii + programowa czerwona aura (`powered` prop
  // w BossArt). User dorysował WŁASNY dedykowany art dla 3 z nich (golem/kraken/upior=
  // phantom) tego samego dnia — te trzy mają teraz PRAWDZIWY plik zamiast pożyczonego.
  // behemoth/wyrm/siren wciąż pożyczają (wyrm/dragon = ten sam gatunek smoka, siren/drought
  // dzielą motyw wody+pragnienia i `weakness`, behemoth/sugar dzielą TĘ SAMĄ słabość
  // sweetless) — do podmiany gdy dostaną własny art.
  kraken:   require('../../assets/ikonybosów/BOSS_KRAKEN.png'),
  golem:    require('../../assets/ikonybosów/BOSS_GOLEM.png'),
  phantom:  require('../../assets/ikonybosów/BOSS_UPIOR.png'),
  behemoth: require('../../assets/ikonybosów/BOSS_handattack_pumpkin.png'),
  wyrm:     require('../../assets/ikonybosów/BOSS_fireattack_dragon.png'),
  siren:    require('../../assets/ikonybosów/BOSS_ataksoundwave_mermaid.png'),
};

// Dedykowany art WARIANTU "powered" (czerwona aura) — narysowany osobno przez usera
// (`MADBOSS_*.png`, 2026-08-15), na razie tylko dla golem/kraken/phantom(upior). Reszta
// rajdowych bossów (behemoth/wyrm/siren) i bossy MAD z madBosses.ts nadal dostają
// PROGRAMOWĄ czerwoną aurę w BossArt (tint + glow) — to jest fallback dla wszystkiego bez
// wpisu tutaj, nie osobny system. Nazwa celowo INNA niż `mad_<id>` (madBosses.ts) — to dwa
// niepowiązane pojęcia "mad/powered": tam druga fala kampanii, tu wizualny wariant raidu.
export const POWERED_BOSS_PNG: Record<string, ImageSourcePropType> = {
  golem:   require('../../assets/ikonybosów/MADBOSS_GOLEM.png'),
  kraken:  require('../../assets/ikonybosów/MADBOSS_KRAKEN.png'),
  phantom: require('../../assets/ikonybosów/MADBOSS_UPIOR.png'),
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
  claw:  require('../../assets/ikonybosów/BOSSATTACK_zadrapaniepazury_claw-marks.png'),
  magic: require('../../assets/ikonybosów/BOSSATTACK_magicspell.png'),
  // "customowe typowo pod pirata, ale można też pod samuraja" — jedyni dwaj bossy ze
  // sword (piratecapitan/samurai) dzielą TEN SAM plik, tak jak user zasugerował.
  sword: require('../../assets/ikonybosów/BOSSATTACK_priateattack_blade.png'),
  fire:  require('../../assets/ikonybosów/BOSSATTACK_FIRE.png'),
};
export const FIST_PNG: ImageSourcePropType = require('../../assets/ikonybosów/BOSSATTACK_handattack_fist.png');
export function attackPng(kind: AttackKind | undefined): ImageSourcePropType {
  return kind ? ATTACK_PNG[kind] : FIST_PNG;
}
