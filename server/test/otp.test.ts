import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { Otp } from '../otp.ts';
import { LocalStore } from '../store.ts';

test('email codes: one use, case-insensitive email, a minute between sends, 5 wrong tries end the code', async () => {
  const otp = new Otp(new LocalStore(await mkdtemp(join(tmpdir(), 'lb-'))));
  const r = await otp.issue('Co.Lan@School.edu', 'register', '1.2.3.4');
  assert.ok('code' in r && /^\d{6}$/.test(r.code));
  const code = (r as { code: string }).code;
  assert.deepEqual(await otp.issue('co.lan@school.edu', 'register', '1.2.3.4'), { refused: 'wait', retryIn: 60 });
  assert.equal(await otp.check('co.lan@school.edu', 'reset', code), 'expired');      // codes are per purpose
  assert.equal(await otp.check('co.lan@school.edu', 'register', code === '000000' ? '111111' : '000000'), 'wrong');
  assert.equal(await otp.check('co.lan@school.edu', 'register', code), 'ok');
  assert.equal(await otp.check('co.lan@school.edu', 'register', code), 'expired');   // used up

  const r2 = await otp.issue('b@school.edu', 'reset', '1.2.3.4') as { code: string };
  const wrong = r2.code === '000000' ? '111111' : '000000';
  for (let i = 0; i < 4; i++) assert.equal(await otp.check('b@school.edu', 'reset', wrong), 'wrong');
  assert.equal(await otp.check('b@school.edu', 'reset', wrong), 'expired');
  assert.equal(await otp.check('b@school.edu', 'reset', r2.code), 'expired');      // even the right code is dead now
});
