import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { SpendGuard } from '../spend.ts';
import { LocalStore } from '../store.ts';

test('spending guard stops AI work past the day and month limits', async () => {
  const store = new LocalStore(await mkdtemp(join(tmpdir(), 'lb-')));
  const day = new SpendGuard(store, 40, 0.75);
  assert.equal(await day.charge('lesson'), null);
  assert.equal(await day.charge('lesson'), null);
  assert.equal(await day.charge('lesson'), 'day');            // 3 x 0.35 > 0.75
  const month = new SpendGuard(store, 0.75, 8);
  assert.equal(await month.charge('lesson'), 'month');          // 0.7 already spent this month
  assert.equal((await day.status()).usd, 0.7);
});
