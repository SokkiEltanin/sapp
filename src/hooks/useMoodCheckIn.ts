import { useEffect, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useMoodStore } from '@/store/moodStore';
import { moodService } from '@/services/moodService';
import { notificationsService } from '@/services/notificationsService';

export function useMoodCheckIn() {
  // useShallow (audyt optymalizacji, 2026-10-11) — gołe `useMoodStore()` subskrybowało cały
  // store (`entries`/`pendingSync` też), a ten hook jest wołany WYŁĄCZNIE na dashboardzie
  // (zawsze zamontowany) — każdy zapis nastroju GDZIEKOLWIEK w appce (ekran Nastrój, modal po
  // ukończeniu zadania) re-renderował cały dashboard, mimo że tu czytane jest tylko `todayEntry`.
  const { todayEntry, setEntries, setLoading } = useMoodStore(useShallow((s) => ({
    todayEntry: s.todayEntry, setEntries: s.setEntries, setLoading: s.setLoading,
  })));
  const [modalVisible, setModalVisible] = useState(false);

  useEffect(() => {
    loadTodayMood();
    notificationsService.requestPermissions().then((granted) => {
      if (granted) notificationsService.scheduleDailyMoodReminder(20, 0);
    });
  }, []);

  const loadTodayMood = async () => {
    try {
      setLoading(true);
      const entries = await moodService.getAll();
      setEntries(entries);
    } finally {
      setLoading(false);
    }
  };

  const needsCheckIn = !todayEntry;

  return {
    todayEntry,
    needsCheckIn,
    openCheckIn: () => setModalVisible(true),
    modalVisible,
    closeCheckIn: () => setModalVisible(false),
  };
}
