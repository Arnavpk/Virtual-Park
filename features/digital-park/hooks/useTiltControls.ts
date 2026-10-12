import { useCallback, useEffect, useRef, useState } from 'react';
import type { Game } from '../state/game';

export type TiltResult = 'on' | 'denied' | 'unavailable';

const DEAD_ZONE = 5; // degrees of tilt ignored around the resting position
const FULL_TILT = 22; // degrees of tilt for full walking speed

const scale = (deg: number) => {
  const a = Math.abs(deg);
  if (a < DEAD_ZONE) return 0;
  return Math.sign(deg) * Math.min(1, (a - DEAD_ZONE) / (FULL_TILT - DEAD_ZONE));
};

/**
 * Optional walk-by-tilting. This reads how the phone is angled (device
 * orientation) — it has nothing to do with GPS or where the visitor really is.
 *
 * The angle the phone is held at when tilt is switched on becomes "standing
 * still", so people can hold it however is comfortable.
 */
export function useTiltControls(game: Game) {
  const [enabled, setEnabled] = useState(false);
  const [supported, setSupported] = useState(false);
  const cleanup = useRef<(() => void) | null>(null);

  useEffect(() => {
    setSupported(typeof window !== 'undefined' && 'DeviceOrientationEvent' in window);
    return () => cleanup.current?.();
  }, []);

  const disable = useCallback(() => {
    cleanup.current?.();
    cleanup.current = null;
    game.input.tiltOn = false;
    game.input.tiltX = 0;
    game.input.tiltY = 0;
    setEnabled(false);
  }, [game]);

  /** Must be called from a tap: iOS only shows its permission prompt inside a user gesture. */
  const enable = useCallback(async (): Promise<TiltResult> => {
    const Orientation = (window as any).DeviceOrientationEvent;
    if (!Orientation) return 'unavailable';
    if (typeof Orientation.requestPermission === 'function') {
      try {
        if ((await Orientation.requestPermission()) !== 'granted') return 'denied';
      } catch {
        return 'denied';
      }
    }

    return new Promise<TiltResult>((resolve) => {
      let rest: { beta: number; gamma: number } | null = null;
      let settled = false;

      const onOrientation = (e: DeviceOrientationEvent) => {
        if (e.beta == null || e.gamma == null) return;
        if (!rest) {
          rest = { beta: e.beta, gamma: e.gamma };
          if (!settled) {
            settled = true;
            game.input.tiltOn = true;
            setEnabled(true);
            resolve('on');
          }
        }
        // Direction the phone slopes towards, in the phone's own axes.
        const right = e.gamma - rest.gamma; // + = right edge down
        const away = -(e.beta - rest.beta); // + = top edge tipped away from the visitor
        // Rotate into screen axes when the page is shown in landscape.
        const angle = (window.screen.orientation?.angle ?? (window as any).orientation ?? 0) as number;
        let sx = right;
        let sy = away;
        if (angle === 90) [sx, sy] = [-away, right];
        else if (angle === 270 || angle === -90) [sx, sy] = [away, -right];
        else if (angle === 180) [sx, sy] = [-right, -away];
        game.input.tiltX = scale(sx);
        game.input.tiltY = -scale(sy); // tipping away = walk north = negative z
      };

      window.addEventListener('deviceorientation', onOrientation);
      cleanup.current = () => window.removeEventListener('deviceorientation', onOrientation);

      // Desktop browsers expose the API but never send readings.
      window.setTimeout(() => {
        if (settled) return;
        settled = true;
        cleanup.current?.();
        cleanup.current = null;
        resolve('unavailable');
      }, 1500);
    });
  }, [game]);

  return { supported, enabled, enable, disable };
}
