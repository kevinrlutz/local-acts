/**
 * Minimal token-spacing rate limiter.
 *
 * Schedules tasks so that no more than `maxPerSecond` start per second,
 * regardless of how many are enqueued concurrently (e.g. during bbox
 * subdivision fan-out). This is process-local — sufficient for a
 * client-only app where each device is its own isolated process; there is
 * no shared/global limiter across devices without a backend proxy.
 */
export type RateLimiter = {
  schedule<T>(task: () => Promise<T>): Promise<T>;
};

export const createRateLimiter = (maxPerSecond: number): RateLimiter => {
  const intervalMs = 1000 / maxPerSecond;
  const queue: Array<() => void> = [];
  let lastRunAt = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const processQueue = () => {
    if (queue.length === 0) {
      timer = null;
      return;
    }
    const now = Date.now();
    const wait = Math.max(0, lastRunAt + intervalMs - now);
    timer = setTimeout(() => {
      const runNext = queue.shift();
      lastRunAt = Date.now();
      runNext?.();
      processQueue();
    }, wait);
  };

  return {
    schedule<T>(task: () => Promise<T>): Promise<T> {
      return new Promise<T>((resolve, reject) => {
        queue.push(() => {
          task().then(resolve, reject);
        });
        if (!timer) {
          processQueue();
        }
      });
    },
  };
};
