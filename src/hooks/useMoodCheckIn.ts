import { useEffect, useState } from 'react';
import { useMoodStore } from '@/store/moodStore';
import { moodService } from '@/services/moodService';
import { notificationsService } from '@/services/notificationsService';

export function useMoodCheckIn() {
  const { todayEntry, setEntries, setLoading } = useMoodStore();
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
