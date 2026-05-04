import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface HealthToday {
  steps: number;
  water: number;
  sleepH: number;
  sleepM: number;
  weight: number;
  sleepQuality?: string;
}

function pad(n: number) { return String(n).padStart(2, '0'); }
function todayKey() {
  const d = new Date();
  return `health_${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function useHealthToday() {
  const [data, setData] = useState<HealthToday>({ steps: 0, water: 0, sleepH: 0, sleepM: 0, weight: 0 });

  useEffect(() => {
    AsyncStorage.getItem(todayKey()).then(raw => {
      if (!raw) return;
      try {
        const d = JSON.parse(raw);
        setData({
          steps: d.steps ?? 0,
          water: d.water ?? 0,
          sleepH: d.sleepH ?? 0,
          sleepM: d.sleepM ?? 0,
          weight: d.weight ?? 0,
          sleepQuality: d.sleepQuality,
        });
      } catch {}
    }).catch(() => {});
  }, []);

  return data;
}
