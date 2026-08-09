import { ImageSourcePropType } from 'react-native';

// ─────────────────────────────────────────────────────────────────────────────
// Custom hit-VFX bursts (assets/ikonybosów/BOSSATTACK_*, 6 generic images user
// added alongside the boss portraits — "dodałem jako ATTACKBOSS"). Maps campaign
// Boss.id → which burst plays on YOUR hit in app/boss-fight.tsx. Mirrors
// bossIcons.ts/badgeIcons.ts exactly: one require() per line, static literals.
// Each boss's art filename in bossIcons.ts already names its attack verb
// (atakpazury=claw, handattack=hand, fireattack=fire, axeattack=axe…) — matched
// against the 6 available bursts by that verb, reused across several bosses
// where the exact verb has no dedicated asset (bite/soundwave/bolt/bone/club all
// read as "claw"/"blade"/"magicspell"/"fist" family, same as S&F's own small
// shared VFX pool reused across a much larger monster roster).
// ─────────────────────────────────────────────────────────────────────────────
export const BOSS_ATTACK_FX: Record<string, ImageSourcePropType> = {
  sloth:    require('../../assets/ikonybosów/BOSSATTACK_zadrapaniepazury_claw-marks.png'),   // atakpazury = claw
  sugar:    require('../../assets/ikonybosów/BOSSATTACK_bomb.png'),                          // candy-monster burst
  snake:    require('../../assets/ikonybosów/BOSSATTACK_zadrapaniepazury_claw-marks.png'),   // ukąszenie = bite
  dragon:   require('../../assets/ikonybosów/BOSSATTACK_FIRE.png'),                          // fireattack
  scroll:   require('../../assets/ikonybosów/BOSSATTACK_handattack_fist.png'),               // atakreka = hand
  stress:   require('../../assets/ikonybosów/BOSSATTACK_zadrapaniepazury_claw-marks.png'),   // ukąszenie = bite
  junk:     require('../../assets/ikonybosów/BOSSATTACK_priateattack_blade.png'),            // maczuka = heavy melee
  burnout:  require('../../assets/ikonybosów/BOSSATTACK_priateattack_blade.png'),            // reaperatack = scythe
  insomnia: require('../../assets/ikonybosów/BOSSATTACK_handattack_fist.png'),                // atakbone = blunt strike
  compare:  require('../../assets/ikonybosów/BOSSATTACK_magicspell.png'),                     // atakmagicrod
  drought:  require('../../assets/ikonybosów/BOSSATTACK_magicspell.png'),                     // ataksoundwave
  procrast: require('../../assets/ikonybosów/BOSSATTACK_magicspell.png'),                     // BOLTATTACK = lightning
  doubt:    require('../../assets/ikonybosów/BOSSATTACK_zadrapaniepazury_claw-marks.png'),   // pazurattack = claw
  devourer: require('../../assets/ikonybosów/BOSSATTACK_priateattack_blade.png'),            // axeattack
};

export function bossAttackFx(id: string): ImageSourcePropType | undefined {
  return BOSS_ATTACK_FX[id];
}
