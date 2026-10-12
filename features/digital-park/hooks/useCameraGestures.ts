import { useEffect, type RefObject } from 'react';
import { ORBIT, clampPitch } from '../lib/coords';
import { clampZoom, type Game } from '../state/game';

/**
 * Touch and mouse control of the camera:
 *
 *   one finger (or the mouse) dragged on the park   → orbit
 *   two fingers pinched, or the mouse wheel         → zoom
 *
 * Only pointers that land on the 3D canvas count. The joystick, pins, buttons
 * and sheets are separate elements, so steering can never be mistaken for a
 * camera gesture or the other way round. Everything is written straight to
 * game.view (no re-render); `onZoomSettle` reports the final zoom so the
 * + / − buttons can update.
 */
export function useCameraGestures(
  root: RefObject<HTMLElement | null>,
  game: Game,
  onZoomSettle: (zoom: number) => void,
  /** Called when a zoom-in gesture starts while the whole park is showing. */
  onZoomInFromOverview: () => boolean,
) {
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const fingers = new Map<number, { x: number; y: number }>();
    let startGap = 0;
    let startZoom = 1;
    let pinching = false;
    let wheelTimer = 0;

    const gap = () => {
      const [a, b] = [...fingers.values()];
      return Math.hypot(a.x - b.x, a.y - b.y);
    };
    const onCanvas = (e: Event) => e.target instanceof HTMLCanvasElement;

    const down = (e: PointerEvent) => {
      if (!onCanvas(e) || (e.pointerType === 'mouse' && e.button !== 0)) return;
      fingers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (fingers.size === 2) {
        startGap = gap();
        startZoom = game.view.zoom;
        pinching = startGap > 10;
      }
    };
    const move = (e: PointerEvent) => {
      const f = fingers.get(e.pointerId);
      if (!f) return;
      const dx = e.clientX - f.x;
      const dy = e.clientY - f.y;
      f.x = e.clientX;
      f.y = e.clientY;

      if (fingers.size === 1) {
        // Orbit. Dragging right swings the park round to the right (the camera goes left);
        // dragging down lifts the camera for a more overhead view.
        game.view.yaw -= dx * ORBIT.yawPerPixel;
        game.view.pitch = clampPitch(game.view.pitch + dy * ORBIT.pitchPerPixel);
        return;
      }
      if (!pinching || fingers.size !== 2) return;
      const ratio = gap() / startGap;
      if (ratio > 1.12 && onZoomInFromOverview()) {
        // Switched from the whole-park view to the close view: carry on from its widest zoom.
        startGap = gap();
        startZoom = game.view.zoom;
        return;
      }
      game.view.zoom = clampZoom(startZoom * ratio);
    };
    const up = (e: PointerEvent) => {
      if (!fingers.delete(e.pointerId)) return;
      if (pinching && fingers.size < 2) {
        pinching = false;
        onZoomSettle(game.view.zoom);
      }
    };
    const wheel = (e: WheelEvent) => {
      if (!onCanvas(e)) return;
      e.preventDefault();
      if (e.deltaY < 0) onZoomInFromOverview();
      game.view.zoom = clampZoom(game.view.zoom * Math.exp(-e.deltaY * 0.0015));
      window.clearTimeout(wheelTimer);
      wheelTimer = window.setTimeout(() => onZoomSettle(game.view.zoom), 150);
    };

    el.addEventListener('pointerdown', down);
    // Listen on the window for the rest, so a drag that leaves the canvas still ends cleanly.
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    el.addEventListener('wheel', wheel, { passive: false });
    return () => {
      el.removeEventListener('pointerdown', down);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      el.removeEventListener('wheel', wheel);
      window.clearTimeout(wheelTimer);
    };
  }, [root, game, onZoomSettle, onZoomInFromOverview]);
}
