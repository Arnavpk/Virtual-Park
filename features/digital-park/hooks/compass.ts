/**
 * Which way the phone is pointing, as a compass bearing (0 = north, 90 = east).
 *
 * Used in GPS Mode so the character faces the way the visitor is facing, even
 * while standing still. It is optional: if the phone has no compass, or the
 * visitor declines the motion permission iPhones ask for, the character
 * simply faces its direction of travel instead.
 *
 * `start` must be called from a tap, because iOS only shows its permission
 * prompt in response to one.
 */
export function startCompass(onBearing: (bearing: number) => void): () => void {
  if (typeof window === 'undefined' || !('DeviceOrientationEvent' in window)) return () => {};
  let stopped = false;
  let detach = () => {};

  const screenAngle = () => (window.screen.orientation?.angle ?? (window as any).orientation ?? 0) as number;
  const report = (bearing: number) => onBearing((((bearing + screenAngle()) % 360) + 360) % 360);

  const onOrientation = (e: DeviceOrientationEvent) => {
    // iOS gives a ready-made, tilt-corrected compass bearing.
    const ios = (e as any).webkitCompassHeading;
    if (typeof ios === 'number' && !Number.isNaN(ios)) return report(ios);
    // Elsewhere only "absolute" readings are tied to north; relative ones drift and are ignored.
    if (!e.absolute || e.alpha === null || e.beta === null || e.gamma === null) return;
    report(bearingFromAngles(e.alpha, e.beta, e.gamma));
  };

  const listen = () => {
    if (stopped) return;
    const absolute = 'ondeviceorientationabsolute' in window;
    const name = absolute ? 'deviceorientationabsolute' : 'deviceorientation';
    window.addEventListener(name, onOrientation as EventListener);
    detach = () => window.removeEventListener(name, onOrientation as EventListener);
  };

  const Orientation = (window as any).DeviceOrientationEvent;
  if (typeof Orientation.requestPermission === 'function') {
    Orientation.requestPermission()
      .then((answer: string) => {
        if (answer === 'granted') listen();
      })
      .catch(() => {});
  } else listen();

  return () => {
    stopped = true;
    detach();
  };
}

/**
 * Compass bearing from the three device-orientation angles.
 * Held flat, a phone points where its top edge points (360 − alpha). Held up
 * at an angle, as people do when looking at a map, the direction that matters
 * is where the back of the phone faces; that formula is from the W3C
 * DeviceOrientation specification.
 */
export function bearingFromAngles(alpha: number, beta: number, gamma: number): number {
  if (Math.abs(beta) < 25 && Math.abs(gamma) < 25) return (360 - alpha + 360) % 360;
  const rad = Math.PI / 180;
  const x = beta * rad;
  const y = gamma * rad;
  const z = alpha * rad;
  const vx = -Math.cos(z) * Math.sin(y) - Math.sin(z) * Math.sin(x) * Math.cos(y);
  const vy = -Math.sin(z) * Math.sin(y) + Math.cos(z) * Math.sin(x) * Math.cos(y);
  let heading = Math.atan(vx / vy);
  if (vy < 0) heading += Math.PI;
  else if (vx < 0) heading += 2 * Math.PI;
  return heading / rad;
}
