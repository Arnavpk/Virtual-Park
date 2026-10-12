import { ATTRACTIONS, SPAWN } from '../data/park';
import { PAVEMENT } from '../data/park.generated';
import type { Attraction, Vec2 } from '../data/types';
import { ROOMY } from './collision';
import { WALK, cellCentre, nearestCell } from './walkgrid';

/** Things worked out once from the park data. */

/** The nearest spot on the paving with room to stand. */
export const snapToPaving = (x: number, z: number): Vec2 => {
  let i = nearestCell(x, z, (k) => ROOMY[k] === 1, 60);
  if (i < 0) i = nearestCell(x, z, (k) => WALK[k] === 1, 200);
  return i >= 0 ? cellCentre(i) : { x, z };
};

/** Where the visitor starts, snapped onto the paving. */
export const START: Vec2 = snapToPaving(SPAWN.x, SPAWN.z);

/** The spot on the paving nearest each attraction: where a route to it ends. */
export const DOORS: Record<string, Vec2> = Object.fromEntries(
  ATTRACTIONS.map((a) => [a.id, snapToPaving(a.position[0], a.position[2])]),
);

/** How high above the ground an attraction's map pin floats. */
export function pinHeight(a: Attraction): number {
  const tall = a.opts.h ?? (a.model === 'spinner' || a.model === 'ferris' ? 6 : 3);
  return Math.min(tall + 2, 9);
}

/** Extent of the paved park, used to frame the whole-park camera. */
export const PARK_BOUNDS = (() => {
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const p of PAVEMENT)
    for (const [x, z] of p.outer) {
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minZ = Math.min(minZ, z);
      maxZ = Math.max(maxZ, z);
    }
  return { minX, maxX, minZ, maxZ };
})();
