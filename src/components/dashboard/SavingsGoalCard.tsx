import { useState } from 'react';
import { View, Text, StyleSheet, Modal, TextInput, TouchableOpacity, Pressable } from 'react-native';
import { PiggyBank, Plus, Pencil, Trash2, X, PartyPopper, Minus } from 'lucide-react-native';
import { useSavingsGoals, SavingsGoal } from '@/store/savingsGoalStore';
import PressableScale from '@/components/ui/PressableScale';
import { useColors } from '@/theme/useColors';
import { themedStyles } from '@/theme/themedStyles';
import { spacing, radius } from '@/theme';
import { haptic } from '@/utils/haptics';
import { toast } from '@/store/toastStore';

const fmt = (n: number) => Math.round(n).toLocaleString('pl-PL');
const ACCENT = '#46B0DE';
const GOOD = '#2AC68F';

// Skarbonka — a motivational savings jar (see savingsGoalStore). Self-contained: it owns
// its create / deposit / edit modals so the dashboard just renders <SavingsGoalCard/>.
export default function SavingsGoalCard({ cardBg }: { cardBg: string }) {
  const c = useColors();
  const s = makeS(c);
  const { goals, addGoal, editGoal, deposit, withdraw, removeGoal } = useSavingsGoals();
  const goal = goals[0];   // one goal for now (store supports more)

  const [createOpen, setCreateOpen] = useState(false);
  const [amtOpen, setAmtOpen] = useState<null | 'add' | 'sub'>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [name, setName] = useState('');
  const [target, setTarget] = useState('');
  const [amt, setAmt] = useState('');

  const openCreate = () => { setName(''); setTarget(''); setCreateOpen(true); };
  const openEdit = () => { if (!goal) return; setName(goal.name); setTarget(String(goal.target)); setEditOpen(true); };

  const doCreate = () => {
    const t = parseFloat(target.replace(',', '.'));
    if (!name.trim() || !(t > 0)) { haptic.error(); return; }
    addGoal(name, t); haptic.success(); setCreateOpen(false);
  };
  const doEdit = () => {
    if (!goal) return;
    const t = parseFloat(target.replace(',', '.'));
    editGoal(goal.id, { name: name.trim() || goal.name, ...(t > 0 ? { target: t } : {}) });
    haptic.success(); setEditOpen(false);
  };
  const doAmount = () => {
    if (!goal) return;
    const a = parseFloat(amt.replace(',', '.'));
    if (!(a > 0)) { haptic.error(); return; }
    if (amtOpen === 'add') {
      const reached = deposit(goal.id, a);
      haptic.success();
      toast.success(reached ? `🎉 Cel osiągnięty: ${goal.name}!` : `+${fmt(a)} zł do skarbonki`);
    } else {
      withdraw(goal.id, a); haptic.tap();
    }
    setAmt(''); setAmtOpen(null);
  };
  const del = () => { if (goal) { haptic.medium(); removeGoal(goal.id); } };

  // ── empty state — invites setting a goal ──
  if (!goal) {
    return (
      <>
        <PressableScale onPress={openCreate}>
          <View style={[s.card, { backgroundColor: cardBg }]}>
            <View style={s.emptyRow}>
              <View style={s.iconChip}><PiggyBank size={20} color={ACCENT} /></View>
              <View style={{ flex: 1 }}>
                <Text style={s.emptyTitle}>Skarbonka</Text>
                <Text style={s.emptySub}>Ustaw cel oszczędności — np. „Wyjazd nad morze"</Text>
              </View>
              <Plus size={20} color={ACCENT} />
            </View>
          </View>
        </PressableScale>
        <GoalModal
          visible={createOpen} title="Nowy cel" c={c} s={s}
          name={name} setName={setName} target={target} setTarget={setTarget}
          onClose={() => setCreateOpen(false)} onSave={doCreate}
        />
      </>
    );
  }

  const pct = Math.min(1, goal.saved / goal.target);
  const done = goal.saved >= goal.target;
  const left = Math.max(0, goal.target - goal.saved);

  return (
    <>
      <View style={[s.card, { backgroundColor: cardBg }]}>
        <View style={s.head}>
          <View style={[s.iconChip, done && { backgroundColor: GOOD + '22' }]}>
            {done ? <PartyPopper size={18} color={GOOD} /> : <PiggyBank size={18} color={ACCENT} />}
          </View>
          <Text style={s.name} numberOfLines={1}>{goal.name}</Text>
          <TouchableOpacity onPress={openEdit} hitSlop={8} style={s.iconBtn}><Pencil size={15} color={c.text.muted} /></TouchableOpacity>
          <TouchableOpacity onPress={del} hitSlop={8} style={s.iconBtn}><Trash2 size={15} color={c.accent.red} /></TouchableOpacity>
        </View>

        <View style={s.amountRow}>
          <Text style={[s.saved, { color: done ? GOOD : c.text.primary }]}>{fmt(goal.saved)}</Text>
          <Text style={s.target}> / {fmt(goal.target)} zł</Text>
          <Text style={[s.pct, { color: done ? GOOD : ACCENT }]}>{Math.round(pct * 100)}%</Text>
        </View>

        <View style={s.track}>
          <View style={[s.fill, { width: `${pct * 100}%`, backgroundColor: done ? GOOD : ACCENT }]} />
        </View>

        <View style={s.footer}>
          <Text style={s.left}>{done ? 'Cel osiągnięty! 🎉' : `Brakuje ${fmt(left)} zł`}</Text>
          <View style={s.btnRow}>
            {goal.saved > 0 && (
              <PressableScale onPress={() => { setAmt(''); setAmtOpen('sub'); }}>
                <View style={[s.smallBtn, { borderColor: c.border.default }]}><Minus size={15} color={c.text.muted} /></View>
              </PressableScale>
            )}
            <PressableScale onPress={() => { setAmt(''); setAmtOpen('add'); }}>
              <View style={[s.addBtn, { backgroundColor: ACCENT + '18', borderColor: ACCENT + '55' }]}>
                <Plus size={15} color={ACCENT} />
                <Text style={[s.addTxt, { color: ACCENT }]}>Dorzuć</Text>
              </View>
            </PressableScale>
          </View>
        </View>
      </View>

      <GoalModal
        visible={editOpen} title="Edytuj cel" c={c} s={s}
        name={name} setName={setName} target={target} setTarget={setTarget}
        onClose={() => setEditOpen(false)} onSave={doEdit}
      />
      <AmountModal
        visible={amtOpen !== null} mode={amtOpen} c={c} s={s} amt={amt} setAmt={setAmt}
        onClose={() => setAmtOpen(null)} onSave={doAmount}
      />
    </>
  );
}

function GoalModal({ visible, title, c, s, name, setName, target, setTarget, onClose, onSave }: any) {
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <View style={s.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[s.sheet, { backgroundColor: c.bg.card }]}>
          <View style={s.sheetHead}>
            <Text style={s.sheetTitle}>{title}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={10}><X size={20} color={c.text.muted} /></TouchableOpacity>
          </View>
          <Text style={s.fieldLabel}>Na co odkładasz?</Text>
          <TextInput
            style={s.input} value={name} onChangeText={setName} placeholder="np. Wyjazd nad morze"
            placeholderTextColor={c.text.muted} maxLength={40}
          />
          <Text style={[s.fieldLabel, { marginTop: spacing[3] }]}>Kwota celu (zł)</Text>
          <TextInput
            style={s.input} value={target} onChangeText={setTarget} placeholder="1500"
            placeholderTextColor={c.text.muted} keyboardType="numeric"
          />
          <TouchableOpacity style={[s.saveBtn, { backgroundColor: ACCENT }]} onPress={onSave} activeOpacity={0.85}>
            <Text style={s.saveTxt}>Zapisz</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function AmountModal({ visible, mode, c, s, amt, setAmt, onClose, onSave }: any) {
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <View style={s.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[s.sheet, { backgroundColor: c.bg.card }]}>
          <View style={s.sheetHead}>
            <Text style={s.sheetTitle}>{mode === 'sub' ? 'Wypłać ze skarbonki' : 'Dorzuć do skarbonki'}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={10}><X size={20} color={c.text.muted} /></TouchableOpacity>
          </View>
          <TextInput
            style={s.input} value={amt} onChangeText={setAmt} placeholder="Kwota (zł)"
            placeholderTextColor={c.text.muted} keyboardType="numeric" autoFocus
          />
          <TouchableOpacity style={[s.saveBtn, { backgroundColor: mode === 'sub' ? c.accent.red : GOOD }]} onPress={onSave} activeOpacity={0.85}>
            <Text style={s.saveTxt}>{mode === 'sub' ? 'Wypłać' : 'Dorzuć'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const makeS = themedStyles((c: any) => StyleSheet.create({
  card: { borderRadius: radius.xl, padding: spacing[4], borderWidth: 1, borderColor: c.border.card, gap: spacing[2] },
  iconChip: { width: 38, height: 38, borderRadius: 12, backgroundColor: ACCENT + '18', alignItems: 'center', justifyContent: 'center' },
  emptyRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  emptyTitle: { fontSize: 14, fontWeight: '800', color: c.text.primary },
  emptySub: { fontSize: 11.5, color: c.text.muted, marginTop: 1 },

  head: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  name: { flex: 1, fontSize: 14, fontWeight: '800', color: c.text.primary },
  iconBtn: { padding: 3 },
  amountRow: { flexDirection: 'row', alignItems: 'baseline', gap: 3, marginTop: 2 },
  saved: { fontSize: 26, fontWeight: '900', letterSpacing: -0.5, fontVariant: ['tabular-nums'] },
  target: { fontSize: 14, fontWeight: '700', color: c.text.muted },
  pct: { marginLeft: 'auto', fontSize: 15, fontWeight: '900' },
  track: { height: 10, borderRadius: 5, backgroundColor: c.fill.subtle, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 5 },
  footer: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  left: { flex: 1, fontSize: 12, fontWeight: '600', color: c.text.muted },
  btnRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  smallBtn: { width: 34, height: 34, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, height: 34, borderRadius: 10, borderWidth: 1 },
  addTxt: { fontSize: 13, fontWeight: '800' },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', paddingHorizontal: spacing[4] },
  sheet: { borderRadius: radius.xl, padding: spacing[4], gap: spacing[2] },
  sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing[1] },
  sheetTitle: { fontSize: 16, fontWeight: '800', color: c.text.primary },
  fieldLabel: { fontSize: 11, fontWeight: '700', color: c.text.muted, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { backgroundColor: c.fill.subtle, borderRadius: radius.md, paddingHorizontal: spacing[3], paddingVertical: spacing[3], fontSize: 15, color: c.text.primary, borderWidth: 1, borderColor: c.border.default },
  saveBtn: { marginTop: spacing[3], borderRadius: radius.md, paddingVertical: spacing[3], alignItems: 'center' },
  saveTxt: { fontSize: 15, fontWeight: '800', color: '#fff' },
}));
