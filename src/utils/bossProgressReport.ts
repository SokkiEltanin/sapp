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
  resetGeneration?: number;   // 2026-08-17 — patrz komentarz w petStore.ts. Opcjonalne, żeby
  lastResetAt?: string | null; // istniejące wywołania/testy bez tych pól dalej działały.
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
  // Numer rundy testowej (2026-08-17, user: "niech reset pupila tworzy nowy log danych
  // żeby było wiadomo które od czego") — bez tego dwa eksporty po dwóch różnych resetach
  // wyglądają identycznie ("Poziom 1, log pusty"), nie dało się ich odróżnić w rozmowie.
  if (s.resetGeneration != null) {
    const resetInfo = s.lastResetAt ? ` (ostatni reset: ${new Date(s.lastResetAt).toLocaleString('pl-PL')})` : ' (jeszcze bez resetu)';
    lines.push(`Runda testowa: #${s.resetGeneration}${resetInfo}`);
  }
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
  const current = BOSSES.find(b => !defeatedSet.has(b.id));
  lines.push(`BOSSOWIE KAMPANII: ${s.defeatedBosses.length}/${BOSSES.length} pokonanych`);
  for (const b of BOSSES) {
    // Status ikony (2026-08-17, po usunięciu progu poziomu z odblokowania kampanii —
    // patrz NEXT_STEPS.md "Odblokowanie kampanii bez progu poziomu") — odblokowanie jest
    // TERAZ czysto sekwencyjne (pokonaj poprzedniego), więc 🔒/Lv-próg nie ma już sensu;
    // jedyne stany to pokonany / aktualny cel / jeszcze nie w kolejce.
    const status = defeatedSet.has(b.id) ? '✓' : current?.id === b.id ? '▶' : '·';
    // Szacunek ciosów potrzebnych PRZY AKTUALNYCH statach gracza (nie zerowej mocy jak
    // sam `b.hp` zakłada w danych) — dokładnie ta liczba, którą ręcznie liczyłem throwaway-
    // symulacjami przy balansowaniu; user (2026-08-17): "zebrać dane pod eksport... oparte
    // na poziomie ulepszenia" — to bezpośrednio to. `guard` (×0.5 dmg gracza) wliczone,
    // wariancja/kryt/dodge pominięte (środek zakresu, nie dokładna symulacja rundy po rundzie).
    const effPower = power * (b.guard ? 0.5 : 1);
    const hitsAtCurrentStats = effPower > 0 ? Math.ceil(b.hp / effPower) : Infinity;
    lines.push(`  ${status} ${b.emoji} ${b.name} — Lv${b.unlockLevel}, ${b.hp} HP${b.guard ? ', guard' : ''}${b.regenPct ? `, regen ${Math.round(b.regenPct * 100)}%` : ''} · ~${hitsAtCurrentStats} ciosów przy Twoich statach`);
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
