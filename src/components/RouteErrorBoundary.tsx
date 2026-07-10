import { useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable } from 'react-native';
import { router, ErrorBoundaryProps } from 'expo-router';
import * as Updates from 'expo-updates';
import { persistCrash } from '@/utils/crashLog';

// Exported as `ErrorBoundary` from app/(tabs)/_layout.tsx so expo-router uses it for
// the tab screens. WHY THIS EXISTS: expo-router wraps each route in its own error
// boundary; a screen's render crash was being caught there and shown as a blank
// (black) screen in production — never reaching the root ErrorBoundary, and never
// persisted (so "Ostatni błąd" said "brak zapisanego crasha"). This catches it,
// SAVES it (surfaced on next launch), and lets you recover without a force-restart.
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  useEffect(() => { persistCrash(error, (error as any)?.componentStack); }, [error]);
  return (
    <View style={eb.wrap}>
      <Text style={eb.title}>Coś się wykrzaczyło</Text>
      <View style={eb.btnRow}>
        <Pressable
          style={[eb.btn, eb.btnPrimary]}
          onPress={() => { retry().catch(() => { try { router.replace('/(tabs)' as any); } catch {} }); }}
        >
          <Text style={eb.btnPrimaryTxt}>Spróbuj ponownie</Text>
        </Pressable>
        <Pressable style={eb.btn} onPress={() => { Updates.reloadAsync().catch(() => {}); }}>
          <Text style={eb.btnTxt}>Przeładuj</Text>
        </Pressable>
      </View>
      <Text style={eb.hint}>Dane są bezpieczne — zapis wykonał się przed błędem. Skopiuj to i wyślij, żebym naprawił:</Text>
      <ScrollView style={eb.scroll}>
        <Text style={eb.msg}>{error?.message}</Text>
        <Text style={eb.stack}>{error?.stack}</Text>
      </ScrollView>
    </View>
  );
}

const eb = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#0D0D0D', padding: 20, paddingTop: 60 },
  title: { color: '#FF5A5F', fontSize: 18, fontWeight: '800', marginBottom: 14 },
  btnRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  btn: { paddingHorizontal: 16, paddingVertical: 11, borderRadius: 12, borderWidth: 1, borderColor: '#333', backgroundColor: '#1A1A1A' },
  btnPrimary: { backgroundColor: '#2AC68F', borderColor: '#2AC68F' },
  btnPrimaryTxt: { color: '#07160F', fontSize: 14, fontWeight: '800' },
  btnTxt: { color: '#ddd', fontSize: 14, fontWeight: '700' },
  hint: { color: '#8A93A8', fontSize: 12, lineHeight: 17, marginBottom: 10 },
  scroll: { flex: 1 },
  msg: { color: '#fff', fontSize: 14, fontWeight: '600', marginBottom: 8 },
  stack: { color: '#aaa', fontSize: 11, lineHeight: 16 },
});
