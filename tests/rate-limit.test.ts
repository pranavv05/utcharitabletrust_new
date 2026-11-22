import test from 'node:test';
import assert from 'node:assert/strict';
import {createLimiter} from '../src/lib/rate-limit';
import {clientIp} from '../src/lib/client-ip';
import {verifyTurnstile} from '../src/lib/turnstile';

test('limiter allows the limit, then blocks until the window passes', () => {
  let t = 0;
  const limiter = createLimiter({limit: 2, windowMs: 1000, now: () => t});
  assert.equal(limiter.hit('a').allowed, true);
  assert.equal(limiter.hit('a').allowed, true);
  const third = limiter.hit('a');
  assert.equal(third.allowed, false);
  assert.ok(third.retryAfter >= 1);
  assert.equal(limiter.hit('b').allowed, true);
  t = 1001;
  assert.equal(limiter.hit('a').allowed, true);
});

test('blocked() only reports once failures reach the limit and reset clears them', () => {
  const limiter = createLimiter({limit: 2, windowMs: 1000, now: () => 0});
  limiter.hit('x');
  assert.equal(limiter.blocked('x').blocked, false);
  limiter.hit('x');
  assert.equal(limiter.blocked('x').blocked, true);
  limiter.reset('x');
  assert.equal(limiter.blocked('x').blocked, false);
});

test('limiter fails closed instead of growing past maxKeys', () => {
  const limiter = createLimiter({limit: 5, windowMs: 1000, maxKeys: 2, now: () => 0});
  assert.equal(limiter.hit('1').allowed, true);
  assert.equal(limiter.hit('2').allowed, true);
  assert.equal(limiter.hit('3').allowed, false);
});

test('clientIp prefers edge headers and never trusts the left-most forwarded address', () => {
  assert.equal(clientIp(new Headers({'x-vercel-forwarded-for': '1.1.1.1', 'x-forwarded-for': '6.6.6.6, 2.2.2.2'})), '1.1.1.1');
  assert.equal(clientIp(new Headers({'x-forwarded-for': '6.6.6.6, 2.2.2.2'})), '2.2.2.2');
  assert.equal(clientIp(new Headers()), 'unknown');
});

test('turnstile is skipped without a secret and enforced with one', async () => {
  delete process.env.TURNSTILE_SECRET_KEY;
  assert.equal(await verifyTurnstile(undefined, '1.1.1.1'), true);
  process.env.TURNSTILE_SECRET_KEY = 'secret';
  try {
    assert.equal(await verifyTurnstile(undefined, '1.1.1.1'), false);
    const ok = (async () => new Response(JSON.stringify({success: true}))) as unknown as typeof fetch;
    const bad = (async () => new Response(JSON.stringify({success: false}))) as unknown as typeof fetch;
    const down = (async () => { throw new Error('offline'); }) as unknown as typeof fetch;
    assert.equal(await verifyTurnstile('token', '1.1.1.1', ok), true);
    assert.equal(await verifyTurnstile('token', '1.1.1.1', bad), false);
    assert.equal(await verifyTurnstile('token', '1.1.1.1', down), false);
  } finally {
    delete process.env.TURNSTILE_SECRET_KEY;
  }
});
