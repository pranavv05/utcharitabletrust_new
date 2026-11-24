/** Opening the phone's or computer's camera, and explaining in plain words why it could not be opened. */
export type CameraProblem = {
  kind: 'denied' | 'none' | 'busy' | 'insecure' | 'unsupported' | 'other';
  message: string;
};

/** What the page is running on: a secure page is needed for the camera, and the browser must offer it. */
export type CameraEnvironment = {secure: boolean; hasApi: boolean};

export const cameraEnvironment = (): CameraEnvironment => ({
  secure: typeof window !== 'undefined' && window.isSecureContext,
  hasApi: typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia,
});

/** Turns whatever the browser threw into a short message a person can act on. */
export function describeCameraError(
  error: unknown,
  env: CameraEnvironment = cameraEnvironment(),
): CameraProblem {
  if (!env.secure)
    return {
      kind: 'insecure',
      message: 'The camera only works on a secure (https) page. Use “Take a photo” instead.',
    };
  if (!env.hasApi)
    return {
      kind: 'unsupported',
      message: 'This browser cannot open the camera from here. Use “Take a photo” instead.',
    };
  const name = (error as {name?: string} | null)?.name || '';
  if (['NotAllowedError', 'PermissionDeniedError', 'SecurityError'].includes(name))
    return {
      kind: 'denied',
      message:
        'The camera is blocked. Allow the camera for this website (tap the lock or camera icon next to the address), then press “Start camera”. Or use “Take a photo”.',
    };
  if (['NotFoundError', 'DevicesNotFoundError', 'OverconstrainedError'].includes(name))
    return {
      kind: 'none',
      message: 'No camera was found on this device. Use “Take a photo” or type the ISBN.',
    };
  if (['NotReadableError', 'TrackStartError', 'AbortError'].includes(name))
    return {
      kind: 'busy',
      message:
        'The camera could not start. Another app or browser tab may be using it. Close that and try again.',
    };
  return {kind: 'other', message: 'The camera could not be started. Use “Take a photo” or type the ISBN.'};
}

/**
 * Asks for the back camera at a good resolution, and quietly settles for less when a device cannot do that.
 * A refusal by the person (permission denied) stops straight away; it is never retried behind their back.
 */
export async function openCamera(): Promise<MediaStream> {
  const attempts: MediaStreamConstraints[] = [
    {video: {facingMode: {ideal: 'environment'}, width: {ideal: 1920}, height: {ideal: 1080}}, audio: false},
    {video: {facingMode: {ideal: 'environment'}}, audio: false},
    {video: true, audio: false},
  ];
  let last: unknown;
  for (const constraints of attempts) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      const [track] = stream.getVideoTracks();
      // Keep the picture sharp as the book moves, where the device supports it.
      await track
        ?.applyConstraints({advanced: [{focusMode: 'continuous'} as MediaTrackConstraintSet]})
        .catch(() => {});
      return stream;
    } catch (error) {
      last = error;
      const name = (error as {name?: string})?.name;
      if (
        ['NotAllowedError', 'PermissionDeniedError', 'SecurityError', 'NotReadableError'].includes(name || '')
      )
        break;
    }
  }
  throw last;
}

export function stopCamera(stream: MediaStream | null | undefined) {
  stream?.getTracks().forEach((track) => track.stop());
}

/** The light (torch) on the back of a phone, when the device has one. */
export function canUseTorch(track: MediaStreamTrack | undefined) {
  return !!(track?.getCapabilities?.() as {torch?: boolean} | undefined)?.torch;
}
export async function setTorch(track: MediaStreamTrack | undefined, on: boolean) {
  await track?.applyConstraints({advanced: [{torch: on} as MediaTrackConstraintSet]});
}
