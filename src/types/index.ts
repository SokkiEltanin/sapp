// ─── Expenses & Income ────────────────────────────────────────────────────────

export type TransactionType = 'expense' | 'income';

export type ExpenseCategory =
  | 'groceries'
  | 'transport'
  | 'entertainment'
  | 'health'
  | 'clothing'
  | 'housing'
  | 'subscriptions'
  | 'other';

export type IncomeCategory =
  | 'salary'
  | 'freelance'
  | 'gift'
  | 'transfer'
  | 'investment'
  | 'other_income';

export interface ReceiptItem {
  name: string;
  price: number;        // final price after discounts
  category: ExpenseCategory;
  quantity: number;
  unitPrice: number;
  discount?: number;
  tags: string[];       // food sub-tags: 'mięso', 'nabiał', 'słodycze', etc.
}

export interface Expense {
  id: string;
  type?: TransactionType; // undefined treated as 'expense' for backward compat
  amount: number;
  currency: string;
  category: ExpenseCategory | IncomeCategory;
  tags: string[];
  note: string;
  date: string; // ISO string
  receiptImageUrl?: string;
  storeName?: string;       // for receipt expenses
  receiptItems?: ReceiptItem[];  // products when saved as single receipt
  createdAt: string;
  updatedAt: string;
}

export interface ExpenseTemplate {
  id: string;
  name: string;
  type: TransactionType;
  amount: number;
  currency: string;
  category: ExpenseCategory | IncomeCategory;
  tags: string[];
  note: string;
  icon?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ExpenseFilters {
  dateFrom?: string;
  dateTo?: string;
  categories?: ExpenseCategory[];
  tags?: string[];
  minAmount?: number;
  maxAmount?: number;
}

// ─── Subscriptions ────────────────────────────────────────────────────────────

export type BillingCycle = 'weekly' | 'monthly' | 'quarterly' | 'yearly';

export interface Subscription {
  id: string;
  name: string;
  amount: number;
  currency: string;
  category: ExpenseCategory;
  billingCycle: BillingCycle;
  nextBillingDate: string; // ISO date YYYY-MM-DD
  reminderDaysBefore: number; // 0 = off
  active: boolean;
  note?: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Calendar / Tasks ─────────────────────────────────────────────────────────

export type EventPriority = 'high' | 'normal' | 'low';
export type TaskStatus = 'pending' | 'done' | 'snoozed';
export type TaskDifficulty = 1 | 2 | 3 | 4 | 5;
export type TaskRecurring = 'none' | 'daily' | 'weekly' | 'monthly';

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  date: string;        // ISO date
  startTime?: string;  // HH:mm
  endTime?: string;
  allDay: boolean;
  priority: EventPriority;
  color?: string;
  createdAt: string;
}

export interface Subtask {
  id: string;
  title: string;
  done: boolean;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  deadline?: string;        // ISO date
  scheduledDate?: string;   // YYYY-MM-DD — day it's planned for
  scheduledTime?: string;   // HH:MM — optional time slot
  status: TaskStatus;
  priority: EventPriority;
  difficulty?: TaskDifficulty;
  estimatedPomodoros?: number;
  completedPomodoros?: number;
  tags: string[];
  snoozedUntil?: string;
  recurring?: TaskRecurring;
  postCompletionMood?: MoodLevel;
  subtasks?: Subtask[];
  createdAt: string;
  updatedAt: string;
}

// ─── Mood Tracking ────────────────────────────────────────────────────────────

export type MoodLevel = 1 | 2 | 3 | 4 | 5;

export interface MoodEntry {
  id: string;
  date: string;        // YYYY-MM-DD
  mood: MoodLevel;     // 1=awful, 2=bad, 3=okay, 4=good, 5=great
  energy: MoodLevel;   // 1=drained, 5=energized
  note?: string;
  tags: string[];      // e.g. 'anxious', 'focused', 'social', 'tired'
  createdAt: string;
  updatedAt: string;
}

export const MOOD_LABELS: Record<MoodLevel, string> = {
  1: 'Fatalnie',
  2: 'Słabo',
  3: 'Tak sobie',
  4: 'Dobrze',
  5: 'Świetnie',
};

export const MOOD_COLORS: Record<MoodLevel, string> = {
  1: '#FF5A5F',
  2: '#FF9F43',
  3: '#FFBE55',
  4: '#43D98F',
  5: '#6C63FF',
};

export const ENERGY_LABELS: Record<MoodLevel, string> = {
  1: 'Bez energii',
  2: 'Niska',
  3: 'Średnia',
  4: 'Dobra',
  5: 'Pełna energia',
};

// ─── Health ───────────────────────────────────────────────────────────────────

export interface DailySteps {
  date: string; // YYYY-MM-DD
  count: number;
  goal: number;
}

export interface SleepSession {
  id: string;
  startTime: string; // ISO
  endTime: string;
  durationMinutes: number;
  quality?: 'poor' | 'fair' | 'good' | 'excellent';
}

export interface HealthDay {
  date: string;
  steps: number;
  stepGoal: number;
  sleep?: SleepSession;
}

// ─── Habits ───────────────────────────────────────────────────────────────────

export const HABIT_COLORS = [
  '#60A5FA', '#34D399', '#C084FC', '#F472B6',
  '#FBBF24', '#F87171', '#FB923C', '#A78BFA',
] as const;

export const HABIT_ICONS = [
  'droplets', 'dumbbell', 'book-open', 'moon',
  'zap', 'heart', 'sun', 'bike',
] as const;

export type HabitIcon = typeof HABIT_ICONS[number];

export interface Habit {
  id: string;
  title: string;
  color: string;
  icon: HabitIcon | string;
  reminderTime?: string; // HH:mm or undefined = no reminder
  createdAt: string;
}
