import { ImageSourcePropType } from 'react-native';

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
};

export function bossPng(id: string): ImageSourcePropType | undefined {
  return BOSS_PNG[id];
}
