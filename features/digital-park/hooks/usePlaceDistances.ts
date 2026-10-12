import { useEffect, useMemo, useState } from 'react';
import { ATTRACTIONS } from '../data/park';
import type { Vec2 } from '../data/types';
import { DOORS } from '../lib/layout';
import { walkingMetres } from '../lib/pathfinding';

const DOOR_LIST = ATTRACTIONS.map((a) => DOORS[a.id]);
const NONE = new Map<string, number>();

/**
 * Walking distance in metres from the visitor to every place, by id.
 *
 * `getHere` is the one shared notion of "where the visitor is": the character's
 * position, whether the joystick or GPS put it there. Distances are worked out
 * in a single sweep of the walk grid when `active` turns on, and again only
 * after the visitor has moved a few steps; never per frame.
 */
export function usePlaceDistances(active: boolean, getHere: () => Vec2): Map<string, number> {
  const [from, setFrom] = useState<Vec2 | null>(null);

  useEffect(() => {
    if (!active) return;
    setFrom(getHere());
    const timer = window.setInterval(() => {
      const now = getHere();
      setFrom((prev) => (prev && Math.hypot(now.x - prev.x, now.z - prev.z) < 3 ? prev : now));
    }, 700);
    return () => window.clearInterval(timer);
  }, [active, getHere]);

  return useMemo(() => {
    if (!active || !from) return NONE;
    const out = new Map<string, number>();
    walkingMetres(from, DOOR_LIST).forEach((m, i) => out.set(ATTRACTIONS[i].id, m));
    return out;
  }, [active, from]);
}
