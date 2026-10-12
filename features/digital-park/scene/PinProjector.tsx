import { useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { ATTRACTIONS } from '../data/park';
import { ORBIT } from '../lib/coords';
import { pinHeight } from '../lib/layout';
import { heightAt } from '../lib/terrain';
import { useGame } from '../state/game';
import { COMPASS } from '../ui/CompassButton';
import { YOU } from '../ui/PinLayer';

const PINS = ATTRACTIONS.map((a) => ({ id: a.id, x: a.position[0], y: pinHeight(a), z: a.position[2] }));

const MARGIN = 140; // px beyond the screen edge before a pin is hidden

/**
 * Projects each place (and the visitor) to screen coordinates and writes the
 * result straight to the DOM pins. No React state, so it costs nothing to
 * re-render, and pins that haven't moved aren't touched.
 */
export function PinProjector() {
  const game = useGame();
  const { camera, size } = useThree();
  const v = useMemo(() => new THREE.Vector3(), []);
  const last = useMemo(() => new Map<HTMLElement, string>(), []);
  const widths = useMemo(() => new Map<HTMLElement, { key: string; half: number }>(), []);

  /** Half the pin's width, re-measured only when its label or style changes. */
  const halfWidth = (el: HTMLElement) => {
    const key = el.className;
    const cached = widths.get(el);
    if (cached && cached.key === key) return cached.half;
    const half = el.offsetWidth / 2;
    widths.set(el, { key, half });
    return half;
  };

  const place = (el: HTMLElement | undefined, x: number, y: number, z: number) => {
    if (!el) return;
    v.set(x, y, z).project(camera);
    let sx = (v.x * 0.5 + 0.5) * size.width;
    const sy = (-v.y * 0.5 + 0.5) * size.height;
    const visible = sx > -MARGIN && sx < size.width + MARGIN && sy > -MARGIN && sy < size.height + MARGIN;
    if (visible && sx > 0 && sx < size.width) {
      // The place itself is on screen: keep its whole label on screen too.
      const half = halfWidth(el) + 6;
      if (half * 2 < size.width) sx = Math.max(half, Math.min(size.width - half, sx));
    }
    const next = visible ? `translate3d(${sx.toFixed(1)}px,${sy.toFixed(1)}px,0) translate(-50%,-50%)` : 'hidden';
    if (last.get(el) === next) return;
    last.set(el, next);
    if (visible) {
      el.style.transform = next;
      el.style.visibility = 'visible';
    } else {
      el.style.visibility = 'hidden';
    }
  };

  // Runs after the camera rig (which mounts earlier), so pins never lag a frame behind.
  useFrame(() => {
    for (const pin of PINS) place(game.overlay.get(pin.id), pin.x, pin.y, pin.z);
    const p = game.player;
    place(game.overlay.get(YOU), p.x, heightAt(p.x, p.z) + 6.4, p.z);

    // Compass: "up the map" sits yaw degrees clockwise of screen-up once the camera has swung by yaw.
    const needle = game.overlay.get(COMPASS);
    if (needle) {
      const { yawNow, pitchNow } = game.view;
      const turn = `rotate(${((yawNow * 180) / Math.PI).toFixed(1)}deg)`;
      if (last.get(needle) !== turn) {
        last.set(needle, turn);
        needle.style.transform = turn;
        const atRest = Math.abs(Math.sin(yawNow / 2)) < 0.01 && Math.abs(pitchNow - ORBIT.pitch) < 0.01;
        needle.parentElement?.classList.toggle('is-turned', !atRest);
      }
    }
  });

  return null;
}
