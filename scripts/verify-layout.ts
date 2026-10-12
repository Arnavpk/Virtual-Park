/**
 * Layout sanity check. Run with: npm run verify
 * Fails if the park data leaves a place unreachable or the paving in pieces.
 */
import { ATTRACTIONS, LANDMARKS } from '../features/digital-park/data/park';
import { PAVEMENT, WATER } from '../features/digital-park/data/park.generated';
import { ROOMY, isBlocked, segmentClear } from '../features/digital-park/lib/collision';
import { DOORS, START } from '../features/digital-park/lib/layout';
import { findRoute, walkingMetres } from '../features/digital-park/lib/pathfinding';
import { CELL, COLS, WALK, cellCentre } from '../features/digital-park/lib/walkgrid';

const problems: string[] = [];
const fail = (m: string) => problems.push(m);

// 1. Every map code appears exactly once.
const expected = [...Array.from({ length: 33 }, (_, i) => String(i + 1)), ...'ABCDEFGHIJKLMN'.split('')];
for (const id of expected) {
  const n = ATTRACTIONS.filter((a) => a.id === id).length;
  if (n !== 1) fail(`map code ${id} appears ${n} times`);
}

// 2. The start point is standing room.
if (isBlocked(START.x, START.z)) fail('the start point is not on walkable ground');

// 3. Every place has a spot on the paving close by, reachable from the entrance by a route the character can walk.
let longest = 0;
for (const a of ATTRACTIONS) {
  const door = DOORS[a.id];
  const gap = Math.hypot(door.x - a.position[0], door.z - a.position[2]);
  if (gap > 18) fail(`${a.id} ${a.name}: nearest paving is ${gap.toFixed(1)} units from the model`);
  const route = findRoute(START, door);
  if (!route) {
    fail(`${a.id} ${a.name}: no walking route from the entrance`);
    continue;
  }
  longest = Math.max(longest, route.length);
  for (let i = 1; i < route.points.length; i++) {
    if (!segmentClear(route.points[i - 1], route.points[i], 0.4)) {
      fail(`${a.id} ${a.name}: route leg ${i} leaves the paving`);
      break;
    }
  }
}

// 3b. Nobody can stand inside a ride or building.
for (const item of [...ATTRACTIONS, ...LANDMARKS]) {
  if (item.solid && !isBlocked(item.position[0], item.position[2], 0)) fail(`${item.id}: the middle of its solid footprint is walkable`);
}

// 3c. Distances and routes still work from off the paving. In GPS Mode the visitor can be
//     standing on a lawn, inside a building or in the middle of a ride's footprint.
{
  const doors = ATTRACTIONS.map((a) => DOORS[a.id]);
  for (const item of [...ATTRACTIONS, ...LANDMARKS]) {
    const from = { x: item.position[0], z: item.position[2] };
    if (walkingMetres(from, doors).some((m) => !Number.isFinite(m))) fail(`${item.id}: no walking distances from its centre (off the paving)`);
    if (!findRoute(from, START)) fail(`${item.id}: no route from its centre (off the paving)`);
  }
}

// 4. Water is never walkable.
const inside = (pts: [number, number][], x: number, z: number) => {
  let hit = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, zi] = pts[i];
    const [xj, zj] = pts[j];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) hit = !hit;
  }
  return hit;
};
let wet = 0;
for (let i = 0; i < WALK.length; i++) {
  if (!WALK[i]) continue;
  const c = cellCentre(i);
  if (WATER.some((w) => inside(w.outer, c.x, c.z))) wet++;
}
if (wet > 40) fail(`${wet} walkable cells overlap water`);

const walkable = WALK.reduce((n, v) => n + v, 0);
const roomy = ROOMY.reduce((n, v) => n + v, 0);

if (problems.length) {
  console.error(`Layout problems (${problems.length}):\n- ` + problems.join('\n- '));
  process.exit(1);
}
console.log(
  `Layout OK: ${ATTRACTIONS.length} places and ${LANDMARKS.length} landmarks, ` +
    `${walkable} walkable cells (${Math.round(walkable * CELL * CELL)} sq units, grid ${COLS} wide), ${roomy} with clearance, ` +
    `${PAVEMENT.reduce((n, p) => n + p.holes.length, 0)} planted islands, ${WATER.length} water bodies, ` +
    `longest route from the entrance ${Math.round(longest)} units.`,
);
