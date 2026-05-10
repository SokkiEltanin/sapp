import { useEffect, useCallback, useMemo } from 'react';
import { subscriptionsService } from '@/services/subscriptionsService';
import { notificationsService } from '@/services/notificationsService';
import { useSubscriptionsStore } from '@/store/subscriptionsStore';
import { Subscription, BillingCycle } from '@/types';

// Monthly cost multiplier per billing cycle
const MONTHLY_FACTOR: Record<BillingCycle, number> = {
  weekly:    4.33,
  monthly:   1,
  quarterly: 1 / 3,
  yearly:    1 / 12,
};

export function useSubscriptions() {
  const { subscriptions, isLoading, setSubscriptions, addSubscription, updateSubscription, deleteSubscription, setLoading } =
    useSubscriptionsStore();

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const data = await subscriptionsService.getAll();
      setSubscriptions(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (subscriptions.length === 0) reload();
  }, []);

  const add = useCallback(async (sub: Omit<Subscription, 'id' | 'createdAt' | 'updatedAt'>) => {
    const created = await subscriptionsService.add(sub);
    addSubscription(created);
    if (created.reminderDaysBefore > 0) {
      notificationsService.scheduleSubscriptionReminder(created).catch(() => {});
    }
    return created;
  }, []);

  const update = useCallback(async (id: string, updates: Partial<Subscription>) => {
    await subscriptionsService.update(id, updates);
    updateSubscription(id, updates);
    const updated = { ...subscriptions.find((s) => s.id === id)!, ...updates };
    notificationsService.cancelSubscriptionReminder(id).catch(() => {});
    if (updated.active && updated.reminderDaysBefore > 0) {
      notificationsService.scheduleSubscriptionReminder(updated).catch(() => {});
    }
  }, [subscriptions]);

  const remove = useCallback(async (id: string) => {
    await subscriptionsService.remove(id);
    deleteSubscription(id);
    notificationsService.cancelSubscriptionReminder(id).catch(() => {});
  }, []);

  const stats = useMemo(() => {
    const active = subscriptions.filter((s) => s.active);
    const monthlyTotal = active.reduce((sum, s) => sum + s.amount * MONTHLY_FACTOR[s.billingCycle], 0);
    const yearlyTotal  = monthlyTotal * 12;
    return { monthlyTotal, yearlyTotal, activeCount: active.length };
  }, [subscriptions]);

  return { subscriptions, isLoading, reload, add, update, remove, stats };
}

export { MONTHLY_FACTOR };
