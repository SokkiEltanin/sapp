import { ExpenseCategory, IncomeCategory } from '@/types';

export const CATEGORY_META: Record<ExpenseCategory, {
  label: string; icon: string; color: string; gradient: readonly [string, string];
}> = {
  food:          { label: 'Jedzenie',    icon: 'UtensilsCrossed', color: '#FF6584', gradient: ['#FF6584', '#FF9FAF'] },
  groceries:     { label: 'Zakupy',      icon: 'ShoppingCart',    color: '#43D98F', gradient: ['#43D98F', '#7AEDB5'] },
  transport:     { label: 'Transport',   icon: 'Car',             color: '#55B4FF', gradient: ['#55B4FF', '#8ACEFF'] },
  entertainment: { label: 'Rozrywka',    icon: 'Gamepad2',        color: '#6C63FF', gradient: ['#6C63FF', '#9B8FFF'] },
  health:        { label: 'Zdrowie',     icon: 'HeartPulse',      color: '#FF5A5F', gradient: ['#FF5A5F', '#FF8A8E'] },
  clothing:      { label: 'Ubrania',     icon: 'Shirt',           color: '#FFBE55', gradient: ['#FFBE55', '#FFD488'] },
  housing:       { label: 'Dom',         icon: 'Home',            color: '#A78BFA', gradient: ['#A78BFA', '#C4B5FD'] },
  subscriptions: { label: 'Subskrypcje', icon: 'CreditCard',      color: '#34D399', gradient: ['#34D399', '#6EE7B7'] },
  other:         { label: 'Inne',        icon: 'MoreHorizontal',  color: '#6B7280', gradient: ['#6B7280', '#9CA3AF'] },
};

export const INCOME_CATEGORY_META: Record<IncomeCategory, {
  label: string; icon: string; color: string; gradient: readonly [string, string];
}> = {
  salary:       { label: 'Wynagrodzenie', icon: 'Briefcase',       color: '#43D98F', gradient: ['#43D98F', '#7AEDB5'] },
  freelance:    { label: 'Freelance',     icon: 'Laptop',          color: '#6C63FF', gradient: ['#6C63FF', '#9B8FFF'] },
  gift:         { label: 'Prezent',       icon: 'Gift',            color: '#FF6584', gradient: ['#FF6584', '#FF9FAF'] },
  transfer:     { label: 'Przelew',       icon: 'ArrowLeftRight',  color: '#55B4FF', gradient: ['#55B4FF', '#8ACEFF'] },
  investment:   { label: 'Inwestycje',    icon: 'TrendingUp',      color: '#FFBE55', gradient: ['#FFBE55', '#FFD488'] },
  other_income: { label: 'Inne',          icon: 'PlusCircle',      color: '#A78BFA', gradient: ['#A78BFA', '#C4B5FD'] },
};

export function getCategoryMeta(category: ExpenseCategory | IncomeCategory) {
  return (CATEGORY_META as any)[category]
    ?? (INCOME_CATEGORY_META as any)[category]
    ?? CATEGORY_META.other;
}
