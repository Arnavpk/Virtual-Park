import type { Vec2 } from '../data/types';

/**
 * The three coordinate systems, and the only places they meet.
 *
 * 1. WORLD: where things are in the 3D park. x runs to the right of the park
 *    map and z runs down it, so "up the map" is -z. Positions of places, the
 *    player, routes and distances are all world coordinates and never change
 *    when the camera turns.
 *
 * 2. SCREEN INPUT: what the joystick, arrow keys and tilt report. x is right
 *    on the screen and y is DOWN the screen, each from -1 to 1. It only has a
 *    meaning together with the camera: `joystickToWorld` below turns it into a
 *    world direction.
 *
 * 3. GPS: latitude and longitude. They become world coordinates in lib/geo.ts
 *    (`gpsToWorld`, `worldToGps`) using the park's calibration. The camera
 *    plays no part in that.
 *
 * The camera's orbit is one number, `yaw`: how far it has swung round the
 * player, in radians. At yaw 0 it stands south of the player looking up the
 * map. Positive yaw swings it towards +x.
 */

/** The direction the camera looks, flattened onto the ground (its tilt is ignored). */
export function cameraForward(yaw: number): Vec2 {
  return { x: -Math.sin(yaw), z: -Math.cos(yaw) };
}

/** The camera's right-hand direction on the ground. */
export function cameraRight(yaw: number): Vec2 {
  return { x: Math.cos(yaw), z: -Math.sin(yaw) };
}

/**
 * Screen input → world direction: right × inputX + forward × (up on the stick).
 * Pushing the stick up always moves the character away from the camera,
 * whichever way the camera is facing. The length of the input is preserved.
 */
export function joystickToWorld(inputX: number, inputY: number, yaw: number): Vec2 {
  const f = cameraForward(yaw);
  const r = cameraRight(yaw);
  const up = -inputY; // screen y points down
  return { x: r.x * inputX + f.x * up, z: r.z * inputX + f.z * up };
}

/** A world direction as degrees clockwise from "up the map" (0 = up the map, 90 = to its right). */
export function worldBearing(x: number, z: number): number {
  return (((Math.atan2(x, -z) * 180) / Math.PI) % 360 + 360) % 360;
}

export const ORBIT = {
  /** Camera tilt above the horizon, in radians: resting value and the limits a drag can reach. */
  pitch: (42 * Math.PI) / 180,
  minPitch: (24 * Math.PI) / 180,
  maxPitch: (74 * Math.PI) / 180,
  /** Radians of orbit per pixel dragged. */
  yawPerPixel: 0.0085,
  pitchPerPixel: 0.005,
};
export const clampPitch = (p: number) => Math.max(ORBIT.minPitch, Math.min(ORBIT.maxPitch, p));
