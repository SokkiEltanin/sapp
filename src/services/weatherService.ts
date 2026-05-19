import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';

export type WeatherIcon = 'sun' | 'cloud-sun' | 'cloud' | 'cloud-drizzle' | 'cloud-rain' | 'snowflake' | 'zap';

export interface DayWeather {
  date: string;       // YYYY-MM-DD
  tempMax: number;
  tempMin: number;
  tempAvg: number;
  weatherCode: number;
  icon: WeatherIcon;
}

const CACHE_KEY = 'weather_cache_v1';
const CACHE_TTL = 6 * 60 * 60 * 1000; // 6 hours

interface CacheEntry {
  fetchedAt: number;
  data: DayWeather[];
}

function codeToIcon(code: number): WeatherIcon {
  if (code === 0) return 'sun';
  if (code <= 3) return 'cloud-sun';
  if (code <= 48) return 'cloud';
  if (code <= 67) return 'cloud-drizzle';
  if (code <= 77) return 'snowflake';
  if (code <= 82) return 'cloud-rain';
  if (code <= 86) return 'snowflake';
  return 'zap';
}

export const weatherService = {
  async getWeather(): Promise<DayWeather[]> {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (raw) {
      const cache: CacheEntry = JSON.parse(raw);
      if (Date.now() - cache.fetchedAt < CACHE_TTL) return cache.data;
    }

    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return [];

    const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low });
    const { latitude, longitude } = loc.coords;

    const url =
      `https://api.open-meteo.com/v1/forecast` +
      `?latitude=${latitude.toFixed(4)}&longitude=${longitude.toFixed(4)}` +
      `&daily=weathercode,temperature_2m_max,temperature_2m_min` +
      `&past_days=60&forecast_days=1&timezone=auto`;

    const res  = await fetch(url);
    const json = await res.json();

    const dates: string[]    = json.daily.time;
    const codes: number[]    = json.daily.weathercode;
    const maxT:  number[]    = json.daily.temperature_2m_max;
    const minT:  number[]    = json.daily.temperature_2m_min;

    const data: DayWeather[] = dates.map((date, i) => ({
      date,
      tempMax: Math.round(maxT[i]),
      tempMin: Math.round(minT[i]),
      tempAvg: Math.round((maxT[i] + minT[i]) / 2),
      weatherCode: codes[i],
      icon: codeToIcon(codes[i]),
    }));

    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify({ fetchedAt: Date.now(), data } as CacheEntry));
    return data;
  },

  // Aggregate daily data into weekly summary
  weekSummary(data: DayWeather[], dates: string[]): { avgTemp: number; icon: WeatherIcon } | null {
    const set   = new Set(dates);
    const days  = data.filter((d) => set.has(d.date));
    if (days.length === 0) return null;
    const avgTemp = Math.round(days.reduce((s, d) => s + d.tempAvg, 0) / days.length);
    // Most frequent icon
    const freq: Record<string, number> = {};
    for (const d of days) freq[d.icon] = (freq[d.icon] ?? 0) + 1;
    const icon = Object.entries(freq).sort(([, a], [, b]) => b - a)[0][0] as WeatherIcon;
    return { avgTemp, icon };
  },
};
