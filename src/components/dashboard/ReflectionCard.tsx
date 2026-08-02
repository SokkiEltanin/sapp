import { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Modal, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { Quote, Plus, X, Trash2, PenLine } from 'lucide-react-native';
import { useReflections, reflectionDate } from '@/store/reflectionsStore';
import { useColors } from '@/theme/useColors';
import { themedStyles } from '@/theme/themedStyles';
import { spacing, radius, fonts } from '@/theme';
import { haptic } from '@/utils/haptics';

// Dashboardowy „dziennik myśli": ostatnia refleksja jak wpis w notesie (cytat + podpis
// „— autor · data"), przycisk „Nowa myśl" → modal z polem tekstowym i historią. Jedno
// źródło = reflectionsStore (backup-proof). MONO, bez emoji.
export default function ReflectionCard({ cardBg }: { cardBg: string }) {
  const c = useColors();
  const s = useMemo(() => makeS(c), [c]);
  const reflections = useReflections(st => st.reflections);
  const author = useReflections(st => st.author);
  const add = useReflections(st => st.add);
  const remove = useReflections(st => st.remove);

  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const latest = reflections[0];

  const save = () => {
    if (!draft.trim()) return;
    haptic.success();
    add(draft);
    setDraft('');
  };

  return (
    <View style={[s.card, { backgroundColor: cardBg }]}>
      <View style={s.head}>
        <PenLine size={13} color={c.text.secondary} />
        <Text style={s.title}>Zapiski</Text>
        {reflections.length > 0 && <Text style={s.count}>{reflections.length}</Text>}
      </View>

      {latest ? (
        <View style={s.quoteWrap}>
          <Quote size={16} color={c.text.muted} style={{ opacity: 0.5 }} />
          <Text style={s.quote}>{latest.text}</Text>
          <Text style={s.sign}>— {author} · {reflectionDate(latest.ts)}</Text>
        </View>
      ) : (
        <Text style={s.empty}>Zapisz myśl — co czułeś, co zrobiłeś, czego żałujesz. Podpisze się sama datą.</Text>
      )}

      <TouchableOpacity style={s.addBtn} onPress={() => { haptic.tap(); setOpen(true); }} activeOpacity={0.85}>
        <Plus size={15} color={c.bg.primary} />
        <Text style={s.addTxt}>Nowa myśl</Text>
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setOpen(false)}>
        <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={() => setOpen(false)}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <TouchableOpacity activeOpacity={1} style={[s.sheet, { backgroundColor: c.bg.card }]} onPress={() => {}}>
              <View style={s.sheetHead}>
                <Text style={s.sheetTitle}>Zapiski</Text>
                <TouchableOpacity onPress={() => setOpen(false)} hitSlop={10}><X size={20} color={c.text.muted} /></TouchableOpacity>
              </View>

              <TextInput
                style={s.input}
                value={draft}
                onChangeText={setDraft}
                placeholder={'np. Czułem znudzenie, chciałem słodyczy, kupiłem, zjadłem i żałuję…'}
                placeholderTextColor={c.text.muted}
                multiline
                textAlignVertical="top"
              />
              <TouchableOpacity style={[s.saveBtn, { backgroundColor: draft.trim() ? c.text.primary : c.fill.subtle }]} disabled={!draft.trim()} onPress={save}>
                <Text style={[s.saveTxt, { color: draft.trim() ? c.bg.primary : c.text.muted }]}>Zapisz myśl</Text>
              </TouchableOpacity>

              {reflections.length > 0 && (
                <ScrollView style={{ maxHeight: 300, marginTop: spacing[2] }} keyboardShouldPersistTaps="handled">
                  {reflections.map((r, i) => (
                    <View key={r.id} style={[s.histRow, i > 0 && s.histBorder]}>
                      <View style={{ flex: 1 }}>
                        <Text style={s.histText}>{r.text}</Text>
                        <Text style={s.histDate}>— {author} · {reflectionDate(r.ts)}</Text>
                      </View>
                      <TouchableOpacity hitSlop={8} onPress={() => { haptic.tap(); remove(r.id); }}><Trash2 size={15} color={c.text.muted} /></TouchableOpacity>
                    </View>
                  ))}
                </ScrollView>
              )}
            </TouchableOpacity>
          </KeyboardAvoidingView>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const makeS = themedStyles((c: any) => StyleSheet.create({
  card: { borderRadius: radius.xl, padding: spacing[4], borderWidth: 1, borderColor: c.border.card, gap: spacing[3] },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  title: { flex: 1, fontFamily: fonts.label, fontSize: 11, color: c.text.primary, textTransform: 'uppercase', letterSpacing: 1 },
  count: { fontSize: 11, fontWeight: '700', color: c.text.muted },

  quoteWrap: { gap: 6 },
  quote: { fontSize: 15.5, lineHeight: 22, color: c.text.primary, fontStyle: 'italic', fontWeight: '500' },
  sign: { fontFamily: fonts.label, fontSize: 10.5, color: c.text.muted, textTransform: 'uppercase', letterSpacing: 0.6 },
  empty: { fontSize: 13.5, lineHeight: 19, color: c.text.muted },

  addBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, height: 44, borderRadius: radius.full, backgroundColor: c.text.primary },
  addTxt: { fontSize: 14, fontWeight: '800', color: c.bg.primary },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: spacing[4] },
  sheet: { borderRadius: radius.xl, padding: spacing[4], gap: spacing[3], borderWidth: 1, borderColor: c.border.default },
  sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sheetTitle: { fontSize: 17, fontWeight: '900', color: c.text.primary, letterSpacing: -0.3 },
  input: { minHeight: 96, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border.default, backgroundColor: c.fill.subtle, padding: spacing[3], fontSize: 15, lineHeight: 21, color: c.text.primary },
  saveBtn: { height: 48, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  saveTxt: { fontSize: 14.5, fontWeight: '900' },

  histRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing[3], paddingVertical: spacing[3] },
  histBorder: { borderTopWidth: 1, borderTopColor: c.border.subtle },
  histText: { fontSize: 13.5, lineHeight: 19, color: c.text.secondary },
  histDate: { fontFamily: fonts.label, fontSize: 9.5, color: c.text.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 3 },
}));
