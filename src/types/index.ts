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
  kind?: 'deposit';     // bottle deposit (kaucja) — kept separate from product stats
  excluded?: boolean;   // counts toward the money total, but NOT my consumption
                        // stats (sweets bar, favourites, weight) — e.g. a gift
                        // or something bought for someone else.
  weightKg?: number;    // explicit weight (kg) — receipts rarely list grams, so
                        // the scanner lets you set it (default 1 kg for dairy).
  eaters?: string[];    // who consumed this — drives per-person limit bars.
                        // empty = shared (split among everyone). Stats count all.
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
  payer?: string;           // who paid (e.g. "Ja", "Partnerka") — counts in totals, lets you split by person
  vehicleId?: string;       // manual link to a vehicle (Pojazdy) — overrides tag/category auto-match
  paymentMethod?: PaymentMethod; // cash vs card; undefined treated as 'card'
  createdAt: string;
  updatedAt: string;
}

export type PaymentMethod = 'cash' | 'card';

// ─── Vehicles (Pojazdy) ───────────────────────────────────────────────────────

export type VehicleKind = 'car' | 'bike' | 'motorcycle' | 'scooter' | 'other';

// One service record (oil change, chain lube, tyre swap, custom part/fluid).
export interface VehicleMaintenance {
  id: string;
  label: string;            // "Wymiana oleju", "Smarowanie łańcucha", custom
  date: string;             // ISO date it was done
  intervalMonths?: number;  // reminder interval (optional)
  expenseId?: string;       // linked transaction (optional)
}

export interface Vehicle {
  id: string;
  name: string;             // "Mój rower", "Octavia"
  kind: VehicleKind;
  tag: string;              // normalized tag that auto-links expenses (e.g. "rower")
  color: string;
  isMainCar?: boolean;      // the car that catches fuel expenses
  tireSeason?: 'summer' | 'winter' | 'allseason'; // what's mounted now (drives the weather reminder)
  maintenance?: VehicleMaintenance[]; // service log + reminders
  notes?: string;
  // legacy (pre-maintenance-log) — kept so old docs still read
  oilChangeDate?: string;
  oilIntervalMonths?: number;
  createdAt: string;
  updatedAt: string;
}

// ─── Maintenance items (Przedmioty) ──────────────────────────────────────────
// Things you replace on a schedule: air-purifier filter, vacuum bag, Dafi
// pitcher cartridge, toothbrush head, …

export interface MaintenanceItem {
  id: string;
  name: string;
  icon?: string;            // lucide name
  color: string;
  lastChangedDate: string;  // ISO date of the last replacement
  intervalDays: number;     // how often it should be replaced
  notes?: string;
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
  tags?: string[]; // applied to the expense created when this recurring bill is paid
  note?: string;
  durationMonths?: number; // 0 = forever, N = auto-deactivate after N months
  startDate?: string; // ISO date YYYY-MM-DD, set on creation when durationMonths > 0
  createdAt: string;
  updatedAt: string;
}

// Money someone owes me (a loan/IOU). On `askDate` the dashboard asks whether it
// was returned; confirming logs an income (cash/card) and settles it.
export interface Debt {
  id: string;
  person: string;          // who owes me
  amount: number;
  currency: string;        // PLN
  askDate: string;         // YYYY-MM-DD — when to start asking "did they return it?"
  note?: string;
  settled?: boolean;       // returned + logged
  settledMethod?: PaymentMethod; // cash / card when settled
  settledDate?: string;    // YYYY-MM-DD
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
  reminderTime?: string;    // HH:mm — custom reminder time
  reminderMessage?: string; // custom notification text
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
  1: '#6B7280', // szary    — fatalnie
  2: '#FF6B6B', // czerwony — słabo
  3: '#FBBF24', // bursztyn — tak sobie
  4: '#4ECBA8', // teal     — dobrze
  5: '#6C9EFF', // cobalt   — świetnie
};

export const ENERGY_LABELS: Record<MoodLevel, string> = {
  1: 'Bez energii',
  2: 'Niska',
  3: 'Średnia',
  4: 'Dobra',
  5: 'Pełna energia',
};

export const ENERGY_COLORS: Record<MoodLevel, string> = {
  1: '#374151', // bardzo ciemny — bez energii
  2: '#6B7280', // szary        — niska
  3: '#6C9EFF', // cobalt       — średnia
  4: '#4ECBA8', // teal         — dobra
  5: '#FBBF24', // bursztyn     — pełna energia (złoto = buzzy)
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

// ─── Work Shifts & Earnings ───────────────────────────────────────────────────

export interface WorkShift {
  id: string;
  date: string;       // YYYY-MM-DD
  startTime: string;  // HH:mm
  endTime: string;    // HH:mm
  note?: string;
  monthlySalary: number;
  hoursPerMonth: number; // e.g. 168
  currency: string;
  createdAt: string;
}

export interface WorkSettings {
  monthlySalary: number;
  hoursPerMonth: number;
  currency: string;
  notifyEveryMinutes: number; // 0 = off
  workColor?: string;         // hex color — calendar events with this color count as work
  workPrefix?: string;        // title prefix — events starting with this count as work (e.g. "[JD]")
  rateOverride?: number;      // fixed zł/h, overrides the computed rate PERMANENTLY
  monthRateOverride?: Record<string, number>; // YYYY-MM → fixed zł/h for that month only
  hoursOverride?: number;     // manual override of the previous-month hours used
  salaryOverride?: number;    // manual override of the last-paycheck amount used
  // Months the user has personally CONFIRMED (salary + hours). When any exist, the
  // estimated hourly rate = Σsalary / Σhours over them (averaged across the months
  // you trust), instead of guessing from the last paycheck alone.
  confirmedMonths?: Record<string, { salary: number; hours: number }>; // YYYY-MM
}

export const DEFAULT_WORK_SETTINGS: WorkSettings = {
  monthlySalary: 5000,
  hoursPerMonth: 168,
  currency: 'PLN',
  notifyEveryMinutes: 0,
  workColor: undefined,
};

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
export type HabitType = 'check' | 'count';

export interface Habit {
  id: string;
  title: string;
  color: string;
  icon: HabitIcon | string;
  type?: HabitType;        // default 'check'
  kind?: 'water';          // special habit fed by Health Connect hydration
  dailyGoal?: number;      // for count type (e.g. 8 glasses)
  unit?: string;           // e.g. 'szkl.', 'ml', 'min'
  weeklyTarget?: number;   // 1-7, default 7 = every day
  reminderTime?: string;   // HH:mm or undefined = no reminder
  createdAt: string;
}
