import { useState, useEffect } from 'react';
import { getTodaySessions } from '@/utils/pomodoroHistory';
import { usePomodoroStore } from '@/store/pomodoroStore';

export function usePomodoroToday() {
  const [savedMins, setSavedMins] = useState(0);
  const [savedRounds, setSavedRounds] = useState(0);
  const completedRounds = usePomodoroStore(s => s.completedRounds);

  useEffect(() => {
    getTodaySessions().then(sessions => {
      setSavedMins(sessions.reduce((s, p) => s + p.durationMins, 0));
      setSavedRounds(sessions.length);
    });
  }, [completedRounds]); // re-read when a new round completes

  return { totalMins: savedMins, totalRounds: savedRounds };
}
