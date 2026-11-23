import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateAverageDimensionPercentages, DIMENSION_KEYS, DimensionKey } from './AdkotmDistributionView.tsx';

const distribution = (total: number, values: Partial<Record<DimensionKey, number>>) => ({
  total,
  percentages: Object.fromEntries(DIMENSION_KEYS.map((key) => [key, values[key] || 0])) as Record<DimensionKey, number>,
});

test('averages recording distributions equally instead of pooling signal counts', () => {
  const result = calculateAverageDimensionPercentages([
    distribution(9, { O: 100 }),
    distribution(1, { A: 100 }),
  ]);

  assert.equal(result.recordingCount, 2);
  assert.equal(result.percentages.O, 50);
  assert.equal(result.percentages.A, 50);
});

test('excludes recordings with no signals and keeps the average normalized', () => {
  const result = calculateAverageDimensionPercentages([
    distribution(1, { O: 33.3, A: 33.3, K: 33.4 }),
    distribution(1, { O: 33.3, A: 33.3, K: 33.4 }),
    distribution(0, {}),
  ]);

  assert.equal(result.recordingCount, 2);
  assert.equal(DIMENSION_KEYS.reduce((sum, key) => sum + result.percentages[key], 0), 100);
});
