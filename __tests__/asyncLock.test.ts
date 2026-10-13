import { withLock } from '@/utils/asyncLock';

describe('withLock', () => {
  it('serializes two calls sharing the same key', async () => {
    const order: string[] = [];
    const slow = withLock('k', async () => {
      order.push('slow-start');
      await new Promise(res => setTimeout(res, 20));
      order.push('slow-end');
      return 'slow';
    });
    // Started a tick later — must wait for `slow` to release the lock before running.
    const fast = withLock('k', async () => {
      order.push('fast-start');
      order.push('fast-end');
      return 'fast';
    });
    const [a, b] = await Promise.all([slow, fast]);
    expect(a).toBe('slow');
    expect(b).toBe('fast');
    expect(order).toEqual(['slow-start', 'slow-end', 'fast-start', 'fast-end']);
  });

  it('runs calls with different keys concurrently (no cross-key blocking)', async () => {
    const order: string[] = [];
    const a = withLock('a', async () => {
      order.push('a-start');
      await new Promise(res => setTimeout(res, 20));
      order.push('a-end');
    });
    const b = withLock('b', async () => {
      order.push('b-start');
      order.push('b-end');
    });
    await Promise.all([a, b]);
    // b (different key) finishes before a's delay elapses — not blocked by a's lock.
    expect(order.indexOf('b-end')).toBeLessThan(order.indexOf('a-end'));
  });

  it('releases the lock even when the callback throws', async () => {
    await expect(withLock('err', async () => { throw new Error('boom'); })).rejects.toThrow('boom');
    const ran = await withLock('err', async () => 'ok');
    expect(ran).toBe('ok');
  });
});
