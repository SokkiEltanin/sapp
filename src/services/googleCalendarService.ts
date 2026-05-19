import AsyncStorage from '@react-native-async-storage/async-storage';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { CalendarEvent } from '@/types';

const TOKEN_KEY = 'gcal_access_token';

interface GCalEvent {
  id: string;
  summary?: string;
  description?: string;
  start: { dateTime?: string; date?: string };
  end:   { dateTime?: string; date?: string };
  colorId?: string;
  status?: string;
}

const GCAL_COLORS: Record<string, string> = {
  '1': '#7986CB', '2': '#33B679', '3': '#8E24AA', '4': '#E67C73',
  '5': '#F6BF26', '6': '#F4511E', '7': '#039BE5', '8': '#616161',
  '9': '#3F51B5', '10': '#0B8043', '11': '#D50000',
};

function mapEvent(e: GCalEvent): CalendarEvent {
  const allDay = !e.start.dateTime;
  const startIso = e.start.dateTime ?? (e.start.date! + 'T00:00:00');
  const endIso   = e.end.dateTime   ?? (e.end.date!   + 'T00:00:00');

  return {
    id: `gcal-${e.id}`,
    title: e.summary ?? '(bez tytułu)',
    description: e.description,
    date: startIso.slice(0, 10),
    startTime: allDay ? undefined : startIso.slice(11, 16),
    endTime:   allDay ? undefined : endIso.slice(11, 16),
    allDay,
    priority: 'normal',
    color: e.colorId ? GCAL_COLORS[e.colorId] : '#039BE5',
    createdAt: new Date().toISOString(),
  };
}

async function doFetch(token: string, params: URLSearchParams): Promise<Response> {
  return fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
}

export const googleCalendarService = {
  async storeToken(token: string): Promise<void> {
    await AsyncStorage.setItem(TOKEN_KEY, token);
  },

  async getStoredToken(): Promise<string | null> {
    return AsyncStorage.getItem(TOKEN_KEY);
  },

  async clearToken(): Promise<void> {
    await AsyncStorage.removeItem(TOKEN_KEY);
  },

  async refreshToken(): Promise<string | null> {
    try {
      const tokens = await GoogleSignin.getTokens();
      await AsyncStorage.setItem(TOKEN_KEY, tokens.accessToken);
      return tokens.accessToken;
    } catch {
      return null;
    }
  },

  async fetchEvents(daysBack = 7, daysForward = 60): Promise<CalendarEvent[]> {
    let token = await this.getStoredToken();
    if (!token) {
      token = await this.refreshToken();
      if (!token) return [];
    }

    const past = new Date(); past.setDate(past.getDate() - daysBack);
    const future = new Date(); future.setDate(future.getDate() + daysForward);

    const params = new URLSearchParams({
      timeMin: past.toISOString(),
      timeMax: future.toISOString(),
      singleEvents: 'true',
      orderBy: 'startTime',
      maxResults: '200',
    });

    let resp = await doFetch(token, params);

    if (resp.status === 401) {
      const fresh = await this.refreshToken();
      if (!fresh) { await this.clearToken(); return []; }
      resp = await doFetch(fresh, params);
    }

    if (!resp.ok) return [];

    const data = await resp.json();
    return ((data.items ?? []) as GCalEvent[])
      .filter(e => e.status !== 'cancelled')
      .map(mapEvent);
  },
};
