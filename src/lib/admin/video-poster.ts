/** A preview picture for an uploaded video, taken in the browser from a frame near the start. */
export async function videoPoster(file: File, max = 640): Promise<File | null> {
  const url = URL.createObjectURL(file);
  try {
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.src = url;
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('timeout')), 15000);
      video.onloadeddata = () => {
        clearTimeout(timer);
        resolve();
      };
      video.onerror = () => {
        clearTimeout(timer);
        reject(new Error('unreadable'));
      };
    });
    const target = Math.min(1, (video.duration || 1) / 3);
    await new Promise<void>((resolve) => {
      video.onseeked = () => resolve();
      video.currentTime = target;
      setTimeout(resolve, 3000);
    });
    const width = video.videoWidth;
    const height = video.videoHeight;
    if (!width || !height) return null;
    const scale = Math.min(1, max / Math.max(width, height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    const context = canvas.getContext('2d');
    if (!context) return null;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', 0.8));
    if (!blob || blob.type !== 'image/webp') return null;
    return new File([blob], 'preview.webp', {type: 'image/webp'});
  } catch {
    // A missing preview is fine: the video still uploads and plays, it just shows a plain play button.
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}
