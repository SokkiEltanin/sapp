import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getHealthGoals } from '@/utils/healthGoals';

interface HealthToday {
  steps: number;
  water: number;
  sleepH: number;
  sleepM: number;
  weight: number;
  sleepQuality?: string;
  stepGoal: number;
  waterGoal: number;
}

function pad(n: number) { return String(n).padStart(2, '0'); }
function todayKey() {
  const d = new Date();
  return `health_${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function useHealthToday() {
  const [data, setData] = useState<HealthToday>({ steps: 0, water: 0, sleepH: 0, sleepM: 0, weight: 0, stepGoal: 10000, waterGoal: 8 });

  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem(todayKey()),
      getHealthGoals(),
    ]).then(([raw, goals]) => {
      const d = raw ? (() => { try { return JSON.parse(raw); } catch { return {}; } })() : {};
      setData({
        steps: d.steps ?? 0,
        water: d.water ?? 0,
        sleepH: d.sleepH ?? 0,
        sleepM: d.sleepM ?? 0,
        weight: d.weight ?? 0,
        sleepQuality: d.sleepQuality,
        stepGoal: goals.stepGoal,
        waterGoal: goals.waterGoal,
      });
    }).catch(() => {});
  }, []);

  return data;
}
