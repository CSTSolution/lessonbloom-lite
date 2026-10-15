// Plans and daily credits: a demo workspace gets 20/day (a lesson costs 10), Pro is unlimited;
// teachers see their own usage; the admin sees every user and can switch plans.
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { MockProvider } from '../ai/mock.ts';
import { createApp } from '../app.ts';
import { LocalStore } from '../store.ts';

const source = await readFile(new URL('../../samples/toan-lop2-cong-co-nho.txt', import.meta.url), 'utf8');

test('daily credits per plan, usage per teacher, admin users and plans', async () => {
  process.env.LB_ADMIN_KEY = 'k'.repeat(32);
  const app = createApp(new MockProvider(), new LocalStore(await mkdtemp(join(tmpdir(), 'lb-'))));
  const call = async (method: string, path: string, body?: unknown, headers: Record<string, string> = {}) => {
    const r = await app.request(path, { method, headers: { 'content-type': 'application/json', ...headers }, body: body ? JSON.stringify(body) : undefined });
    return { status: r.status, json: await r.json() as any };
  };
  const key = (await call('POST', '/api/t/me', {})).json.key, T = { 'x-teacher': key };
  const it = (await call('POST', '/api/t/intake', { source }, T)).json;
  assert.equal((await call('POST', '/api/t/lessons', { source, intake: it }, T)).status, 202);
  assert.equal((await call('POST', '/api/t/lessons', { source, intake: it }, T)).status, 202);
  const third = await call('POST', '/api/t/lessons', { source, intake: it }, T);
  assert.equal(third.status, 429); assert.equal(third.json.limit, 'credits'); assert.equal(third.json.max, 20);

  const u = (await call('GET', '/api/t/usage', undefined, T)).json;
  assert.equal(u.plan, 'demo'); assert.equal(u.usedToday, 20); assert.equal(u.limit, 20);
  assert.equal(u.days[0].actions.lesson, 2);

  const A = { 'x-admin': 'k'.repeat(32) };
  assert.equal((await call('GET', '/api/admin/users')).status, 403);
  const users = (await call('GET', '/api/admin/users', undefined, A)).json;
  const me = users.find((x: any) => x.id === key);
  assert.equal(me.creditsToday, 20); assert.equal(me.lessons, 2);
  assert.equal((await call('POST', `/api/admin/users/${key}/plan`, { plan: 'pro' }, A)).json.plan, 'pro');
  assert.equal((await call('POST', '/api/t/lessons', { source, intake: it }, T)).status, 202, 'pro: no daily credit limit');
  assert.equal((await call('GET', '/api/t/usage', undefined, T)).json.limit, null);
  delete process.env.LB_ADMIN_KEY;
});
