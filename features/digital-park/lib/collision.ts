import type { Vec2 } from '../data/types';
import { cellIndex, isWalkable } from './walkgrid';

export const PLAYER_RADIUS = 0.5;

const RING: [number, number][] = [0, 1, 2, 3, 4, 5, 6, 7].map((k) => [Math.cos((k * Math.PI) / 4), Math.sin((k * Math.PI) / 4)]);

/** True when a circle of radius r centred on (x, z) pokes outside the walkable ground. */
export function isBlocked(x: number, z: number, r = PLAYER_RADIUS): boolean {
  if (!isWalkable(x, z)) return true;
  for (let k = 0; k < 8; k++) if (!isWalkable(x + RING[k][0] * r, z + RING[k][1] * r)) return true;
  return false;
}

/**
 * Moves by (dx, dz) and slides along whatever is in the way: if the full step
 * is blocked, each axis is tried on its own so the character glides along
 * edges instead of sticking to them.
 */
export function moveWithCollision(pos: Vec2, dx: number, dz: number, r = PLAYER_RADIUS): Vec2 {
  const nx = pos.x + dx;
  const nz = pos.z + dz;
  if (!isBlocked(nx, nz, r)) return { x: nx, z: nz };
  if (dx !== 0 && !isBlocked(nx, pos.z, r)) return { x: nx, z: pos.z };
  if (dz !== 0 && !isBlocked(pos.x, nz, r)) return { x: pos.x, z: nz };
  return { x: pos.x, z: pos.z };
}

/** Samples a straight line to see whether the character could walk it. */
export function segmentClear(a: Vec2, b: Vec2, r = PLAYER_RADIUS, step = 0.3): boolean {
  const len = Math.hypot(b.x - a.x, b.z - a.z);
  const n = Math.max(1, Math.ceil(len / step));
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    if (isBlocked(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t, r)) return false;
  }
  return true;
}

export { ROOMY } from './walkgrid';
export { cellIndex };
