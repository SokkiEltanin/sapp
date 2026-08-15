// Czytelny tekstowy raport postępu pupila/walk bossów — do wklejenia w rozmowie z Claude
// przy testowaniu balansu nowej krzywej bossów (2026-08-14, patrz NEXT_STEPS.md). Czysta
// funkcja (state → string), żeby dało się testować bez odpalania całego Zustand store.
import { BOSSES, bossBonuses, atkPower, atkMultiplier, dailyAttempts, BASE_ATK, combatItemSlotsFor } from '@/utils/bosses';
import { COMBAT_ITEMS, CombatItemId } from '@/utils/combatItems';
import { levelFromXp, catMaxHp, CAT_BASE_MAX_HP, type BossLogEntry } from '@/store/petStore';

export interface ProgressReportInput {
  xp: number;
  coins: number;
  atkStatBonus: number;
  catMaxHpBonus: number;
  ownedItems: string[];
  defeatedBosses: string[];
  ownedCombatItems: Partial<Record<CombatItemId, number>>;
  equippedCombatItems: CombatItemId[];
  raidWon: string[];
  eventWon: string[];
  bossLog: BossLogEntry[];
}

const KIND_LABEL: Record<BossLogEntry['kind'], string> = {
  campaign: 'kampania', raid: 'raid', event: 'wydarzenie', quest: 'quest', mad: 'MAD', mission: 'misja',
};

export function buildBossProgressReport(s: ProgressReportInput, logLimit = 30): string {
  const lvl = levelFromXp(s.xp);
  const bonuses = bossBonuses(s.ownedItems);
  const power = atkPower(s.atkStatBonus, lvl.level, bonuses);
  const mult = atkMultiplier(lvl.level, bonuses);
  const maxHp = catMaxHp(s.catMaxHpBonus);
  const attempts = dailyAttempts(bonuses.energyMult);
  const slots = combatItemSlotsFor(lvl.level);

  const lines: string[] = [];
  lines.push(`STAN PUPILA — ${new Date().toLocaleString('pl-PL')}`);
  lines.push('');
  lines.push(`Poziom: ${lvl.level} (${lvl.inLevel}/${lvl.needed} XP w poziomie, ${s.xp} XP total)`);
  lines.push(`Monety: ${s.coins}`);
  lines.push(`ATK: baza ${BASE_ATK} + kupione ${s.atkStatBonus} = ${Math.round(power)} realnej mocy (×${mult.toFixed(2)} mnożnik z poziomu+łupu)`);
  lines.push(`HP kotka: ${maxHp} (baza ${CAT_BASE_MAX_HP} + kupione ${s.catMaxHpBonus})`);
  lines.push(`Próby ataku/dzień: ${attempts}${bonuses.energyMult > 0 ? ` (+${Math.round(bonuses.energyMult * 100)}% z łupu)` : ''}`);
  lines.push(`Sloty na itemy bojowe: ${slots}`);
  if (bonuses.dodge > 0 || bonuses.crit > 0) {
    lines.push(`Bonusy z łupu bossów: +${Math.round(bonuses.dodge * 100)}% unik, +${Math.round(bonuses.crit * 100)}% kryt`);
  }
  lines.push('');

  const defeatedSet = new Set(s.defeatedBosses);
  lines.push(`BOSSOWIE KAMPANII: ${s.defeatedBosses.length}/${BOSSES.length} pokonanych`);
  for (const b of BOSSES) {
    const status = defeatedSet.has(b.id) ? '✓' : (lvl.level >= b.unlockLevel ? '·' : '🔒');
    lines.push(`  ${status} ${b.emoji} ${b.name} — Lv${b.unlockLevel}, ${b.hp} HP${b.guard ? ', guard' : ''}${b.regenPct ? `, regen ${Math.round(b.regenPct * 100)}%` : ''}`);
  }
  lines.push('');

  lines.push(`RAID: ${s.raidWon.length} tygodni pokonanych`);
  lines.push(`WYDARZENIA: ${s.eventWon.length} pokonanych`);
  lines.push('');

  const ownedCombatIds = (Object.keys(s.ownedCombatItems) as CombatItemId[]).filter(id => s.ownedCombatItems[id]);
  lines.push(`ITEMY BOJOWE (${ownedCombatIds.length} posiadanych):`);
  if (ownedCombatIds.length === 0) lines.push('  (brak)');
  for (const id of ownedCombatIds) {
    const def = COMBAT_ITEMS[id];
    const itemLevel = s.ownedCombatItems[id];
    const equipped = s.equippedCombatItems.includes(id) ? ' [ZAŁOŻONY]' : '';
    lines.push(`  ${def.name} — poziom ${itemLevel}/${def.maxLevel}${equipped}`);
  }
  lines.push('');

  const log = [...s.bossLog].sort((a, b) => b.at.localeCompare(a.at)).slice(0, logLimit);
  lines.push(`LOG WALK (ostatnie ${log.length} z ${s.bossLog.length}):`);
  if (log.length === 0) lines.push('  (brak zapisanych walk)');
  for (const e of log) {
    const when = new Date(e.at).toLocaleString('pl-PL');
    lines.push(`  ${when} · ${KIND_LABEL[e.kind]} · ${e.name} · Lv${e.level} · +${e.coins} monet, +${e.xp} XP`);
  }

  return lines.join('\n');
}
