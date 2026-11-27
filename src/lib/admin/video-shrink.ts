'use client';
/**
 * Makes a too-large video small enough to upload, in the browser, before it is sent. Storage on the Free
 * plan refuses any file over 50 MB. The picture size and quality are lowered just enough to fit, and the
 * result is a standard MP4 that plays everywhere.
 */
export const VIDEO_LIMIT = 50 * 1024 * 1024;
const TARGET = 45 * 1024 * 1024;
const AUDIO_BITRATE = 96_000;
const MIN_VIDEO_BITRATE = 250_000;

export type ShrinkPlan = {ok: true; videoBitrate: number; height: number} | {ok: false; message: string};

/** Decides the video quality that fits the size budget for a clip of this length. Pure, so it can be tested. */
export function planShrink(durationSeconds: number, sourceHeight: number, target = TARGET): ShrinkPlan {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0)
    return {ok: false, message: 'Could not read that video. Try another file.'};
  const bits = target * 8 * 0.92 - AUDIO_BITRATE * durationSeconds;
  const videoBitrate = Math.min(6_000_000, Math.floor(bits / durationSeconds));
  if (videoBitrate < MIN_VIDEO_BITRATE)
    return {
      ok: false,
      message:
        'This video is too long to shrink to 50 MB without ruining it. Paste a YouTube or Vimeo link instead, or trim the video.',
    };
  const wanted = videoBitrate >= 1_500_000 ? 720 : videoBitrate >= 700_000 ? 480 : 360;
  // Never enlarge a video: keep its own height when that is already smaller.
  return {ok: true, videoBitrate, height: Math.min(wanted, sourceHeight || wanted)};
}

let busy: Promise<unknown> = Promise.resolve();

/**
 * Returns the file itself when it already fits, otherwise a smaller MP4 copy. `onProgress` gets 0 to 1.
 * Only one video is shrunk at a time, because the work uses the computer's video hardware.
 */
export function prepareVideo(file: File, onProgress?: (fraction: number) => void): Promise<File> {
  if (file.size <= VIDEO_LIMIT) return Promise.resolve(file);
  const run = busy.then(
    () => shrink(file, onProgress),
    () => shrink(file, onProgress),
  );
  busy = run.catch(() => {});
  return run;
}

async function shrink(file: File, onProgress?: (fraction: number) => void): Promise<File> {
  if (typeof VideoEncoder === 'undefined')
    throw Error(
      'This browser cannot shrink videos. Use Chrome or Edge on a computer, or paste a YouTube or Vimeo link.',
    );
  const {ALL_FORMATS, BlobSource, BufferTarget, Conversion, Input, Mp4OutputFormat, Output} =
    await import('mediabunny');
  let scale = 1;
  for (let attempt = 0; attempt < 2; attempt++) {
    const input = new Input({source: new BlobSource(file), formats: ALL_FORMATS});
    try {
      const track = await input.getPrimaryVideoTrack().catch(() => null);
      if (!track) throw Error('That file does not look like a video this browser can open.');
      const plan = planShrink(await input.computeDuration(), track.displayHeight, TARGET * scale);
      if (!plan.ok) throw Error(plan.message);
      const target = new BufferTarget();
      const output = new Output({format: new Mp4OutputFormat({fastStart: 'in-memory'}), target});
      const conversion = await Conversion.init({
        input,
        output,
        video: {height: plan.height, codec: 'avc', bitrate: plan.videoBitrate},
        audio: {codec: 'aac', bitrate: AUDIO_BITRATE},
      });
      if (!conversion.isValid)
        throw Error(
          'This browser cannot convert that video. Use Chrome or Edge on a computer, or paste a YouTube or Vimeo link.',
        );
      conversion.onProgress = (fraction) => onProgress?.(Math.min(1, fraction));
      await conversion.execute();
      const buffer = target.buffer;
      if (!buffer) throw Error('Shrinking the video failed. Try another file.');
      if (buffer.byteLength > VIDEO_LIMIT) {
        // Rare: the encoder used more than asked. Try once more, smaller.
        scale *= 0.65;
        continue;
      }
      const name = file.name.replace(/\.[^.]+$/, '') + '.mp4';
      return new File([buffer], name, {type: 'video/mp4'});
    } finally {
      input.dispose?.();
    }
  }
  throw Error('Could not shrink that video enough. Paste a YouTube or Vimeo link instead.');
}
