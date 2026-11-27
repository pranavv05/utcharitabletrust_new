import test from 'node:test';
import assert from 'node:assert/strict';
import {planShrink, VIDEO_LIMIT} from '../src/lib/admin/video-shrink';

test('a short clip keeps a high quality and a long one is lowered to fit', () => {
  const short = planShrink(60, 1080);
  assert.ok(short.ok && short.height === 720 && short.videoBitrate > 4_000_000);
  const medium = planShrink(150, 1080);
  assert.ok(medium.ok && medium.height === 720);
  const long = planShrink(300, 1080);
  assert.ok(long.ok && long.height === 480);
  const longer = planShrink(900, 1080);
  assert.ok(longer.ok && longer.height === 360);
});

test('the planned size always stays under the upload limit', () => {
  for (const seconds of [10, 60, 300, 600, 900]) {
    const plan = planShrink(seconds, 1080);
    assert.ok(plan.ok, seconds + ' s');
    if (plan.ok) assert.ok(((plan.videoBitrate + 96_000) * seconds) / 8 < VIDEO_LIMIT, seconds + ' s');
  }
  assert.ok(!planShrink(1500, 1080).ok);
});

test('small videos are never enlarged, and absurdly long or unreadable ones are refused clearly', () => {
  const small = planShrink(60, 360);
  assert.ok(small.ok && small.height === 360);
  const tooLong = planShrink(3 * 3600, 1080);
  assert.ok(!tooLong.ok && /YouTube/.test(tooLong.message));
  assert.ok(!planShrink(0, 720).ok);
  assert.ok(!planShrink(NaN, 720).ok);
});
