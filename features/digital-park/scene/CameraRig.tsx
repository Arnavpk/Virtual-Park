import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { clampPitch } from '../lib/coords';
import { PARK_BOUNDS as BOUNDS } from '../lib/layout';
import { clampZoom, useGame } from '../state/game';

export type CameraMode = 'follow' | 'overview';

const DISTANCE = 300;
const PARK_W = BOUNDS.maxX - BOUNDS.minX + 22; // the big halls sit just outside the paving
const PARK_D = BOUNDS.maxZ - BOUNDS.minZ + 4;
const MID_X = (BOUNDS.minX + BOUNDS.maxX) / 2;
const MID_Z = (BOUNDS.minZ + BOUNDS.maxZ) / 2;

/**
 * One orthographic camera with two behaviours: a view of the whole park, or a
 * closer view that trails the visitor. In both, the visitor can orbit: swing
 * the camera round its target (yaw) and tilt it (pitch).
 *
 * The camera only decides how the park is seen. It never moves the player and
 * never changes a world coordinate. Its swing is published as `view.yawNow`,
 * which is how the joystick knows which way "up" is.
 */
export function CameraRig({ mode }: { mode: CameraMode }) {
  const game = useGame();
  const { camera, size } = useThree();
  const target = useRef(new THREE.Vector3(game.player.x, 0, game.player.z));
  const first = useRef(true);

  useFrame((_, delta) => {
    const cam = camera as THREE.OrthographicCamera;
    const { view } = game;

    // Frame-rate independent easing, so slow devices settle just as quickly.
    const k = first.current ? 1 : 1 - Math.exp(-6 * Math.min(delta, 0.25));
    // Orbit eases a little faster than position, so a drag feels attached to the finger.
    const kOrbit = first.current ? 1 : 1 - Math.exp(-14 * Math.min(delta, 0.25));
    first.current = false;

    view.yawNow += (view.yaw - view.yawNow) * kOrbit;
    view.pitchNow += (clampPitch(view.pitch) - view.pitchNow) * kOrbit;
    const yaw = view.yawNow;
    const pitch = view.pitchNow;
    const sinP = Math.sin(pitch);
    const cosP = Math.cos(pitch);
    const sinY = Math.sin(yaw);
    const cosY = Math.cos(yaw);

    let zoom: number;
    let tx: number;
    let tz: number;
    if (mode === 'overview') {
      // On phones, keep the park clear of the destination card (top) and the
      // joystick and buttons (bottom). Wide screens have room either side.
      const narrow = size.width < 700;
      const top = narrow ? 136 : size.height < 500 ? 16 : 120;
      const bottom = narrow ? Math.min(330, size.height * 0.4) : 24;
      // The park's footprint as seen from the current swing: its width across the screen and its depth away from the camera.
      const across = PARK_W * Math.abs(cosY) + PARK_D * Math.abs(sinY);
      const away = PARK_W * Math.abs(sinY) + PARK_D * Math.abs(cosY);
      const reachUp = (away / 2) * sinP + 14 * cosP; // room for the tall rides
      const reachDown = (away / 2) * sinP + 2.4 * cosP; // soil edge of the island
      zoom = Math.min(size.width / (across + 2), (size.height - top - bottom) / (reachUp + reachDown));
      // Slide the park up the screen, away from the bottom controls: move the target towards the camera.
      const shift = ((bottom - top) / 2 / zoom - (reachUp - reachDown) / 2) / sinP;
      tx = MID_X + sinY * shift;
      tz = MID_Z + cosY * shift;
    } else {
      // Default magnification for this screen, scaled by the visitor's zoom setting (+ / − buttons, pinch, wheel).
      zoom = Math.max(12, Math.min(size.width / 27, size.height / 28, 32)) * clampZoom(view.zoom);
      // Normally the camera trails the visitor. Just after a place is chosen it
      // looks at that place for a moment, unless the visitor is already on the move.
      const { input, nav } = game;
      const moving = input.joyActive || input.keyX !== 0 || input.keyY !== 0 || nav.active;
      const focus = view.focus && !moving && performance.now() < view.focusUntil ? view.focus : null;
      const lookX = focus ? focus.x : game.player.x;
      const lookZ = focus ? focus.z : game.player.z;
      // Looking up the map (no swing), stop short of the park edges so the screen shows park
      // rather than empty sky. That only makes sense square-on, so it fades out as the camera swings.
      const halfW = size.width / 2 / zoom;
      const halfD = size.height / 2 / zoom / sinP;
      const padX = Math.min(halfW * 0.6, (BOUNDS.maxX - BOUNDS.minX) / 2);
      const padS = Math.min(halfD * 0.55, (BOUNDS.maxZ - BOUNDS.minZ) / 2);
      const padN = Math.min(halfD * 0.3, (BOUNDS.maxZ - BOUNDS.minZ) / 2);
      const squareOn = Math.max(0, 1 - Math.abs(Math.atan2(sinY, cosY)) / 0.4);
      const clampedX = Math.max(BOUNDS.minX + padX, Math.min(BOUNDS.maxX - padX, lookX));
      const clampedZ = Math.max(BOUNDS.minZ + padN, Math.min(BOUNDS.maxZ - padS, lookZ));
      tx = lookX + (clampedX - lookX) * squareOn;
      tz = lookZ + (clampedZ - lookZ) * squareOn;
    }

    target.current.x += (tx - target.current.x) * k;
    target.current.z += (tz - target.current.z) * k;
    cam.zoom += (zoom - cam.zoom) * k;
    // Stand back from the target along the orbit, then look at it. The tilt limits keep the
    // camera well above the ground and short of straight overhead, so it can never flip.
    cam.position.set(target.current.x + sinY * cosP * DISTANCE, sinP * DISTANCE, target.current.z + cosY * cosP * DISTANCE);
    cam.lookAt(target.current);
    cam.updateProjectionMatrix();
  });

  return null;
}
