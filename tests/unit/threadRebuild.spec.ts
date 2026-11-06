import { describe, expect, it } from 'vitest';

import { mapWithConcurrency } from '@/features/messages/services/threadRebuild';

describe('mapWithConcurrency', () => {
  it('runs an empty list without calling the mapper', async () => {
    let calls = 0;
    await mapWithConcurrency([], 5, async () => {
      calls += 1;
    });
    expect(calls).toBe(0);
  });

  it('processes every item at most once with bounded concurrency', async () => {
    const seen: number[] = [];
    let inFlight = 0;
    let maxInFlight = 0;

    await mapWithConcurrency([1, 2, 3, 4, 5], 2, async (value) => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 5));
      seen.push(value);
      inFlight -= 1;
    });

    expect(seen.sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5]);
    expect(maxInFlight).toBeLessThanOrEqual(2);
  });

  it('caps workers to the item count', async () => {
    const seen: string[] = [];
    await mapWithConcurrency(['a'], 8, async (value) => {
      seen.push(value);
    });
    expect(seen).toEqual(['a']);
  });
});
