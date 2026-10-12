import { WALK_METRES_PER_MIN } from '../data/park';
import type { Vec2 } from '../data/types';
import { ROOMY, segmentClear } from './collision';
import { EFFECTIVE_METRES_PER_UNIT as METRES_PER_UNIT } from './geo';
import { CELL, COLS, ROWS, WALK, cellCentre, nearestCell } from './walkgrid';

export interface Route {
  points: Vec2[];
  /** Length in world units. */
  length: number;
  metres: number;
  minutes: number;
}

const N = COLS * ROWS;
const SQRT2 = Math.SQRT2;
// Neighbour offsets: 4 straight, then 4 diagonal.
const DC = [1, -1, 0, 0, 1, 1, -1, -1];
const DR = [0, 0, 1, -1, 1, -1, 1, -1];

// Scratch buffers reused between searches. `stamp` marks which entries belong to the current search.
const gScore = new Float32Array(N);
const came = new Int32Array(N);
const seen = new Uint32Array(N);
const closed = new Uint32Array(N);
let stamp = 0;

/** Minimal binary heap of cell indices ordered by a score array. */
class Heap {
  private items: number[] = [];
  private score: number[] = [];
  get size() {
    return this.items.length;
  }
  push(i: number, s: number) {
    const a = this.items;
    const sc = this.score;
    let k = a.length;
    a.push(i);
    sc.push(s);
    while (k > 0) {
      const p = (k - 1) >> 1;
      if (sc[p] <= sc[k]) break;
      [a[p], a[k]] = [a[k], a[p]];
      [sc[p], sc[k]] = [sc[k], sc[p]];
      k = p;
    }
  }
  pop(): number {
    const a = this.items;
    const sc = this.score;
    const top = a[0];
    const li = a.pop()!;
    const ls = sc.pop()!;
    if (a.length) {
      a[0] = li;
      sc[0] = ls;
      let k = 0;
      for (;;) {
        const l = 2 * k + 1;
        const r = l + 1;
        let m = k;
        if (l < a.length && sc[l] < sc[m]) m = l;
        if (r < a.length && sc[r] < sc[m]) m = r;
        if (m === k) break;
        [a[m], a[k]] = [a[k], a[m]];
        [sc[m], sc[k]] = [sc[k], sc[m]];
        k = m;
      }
    }
    return top;
  }
}

const roomy = (i: number) => ROOMY[i] === 1;
const walkable = (i: number) => WALK[i] === 1;

/**
 * The cell a point should start or end its route on: the nearest one with room
 * to stand. The search reaches a long way, because in GPS Mode the visitor can
 * be well off the paving (on a lawn, inside a building, just outside the wall)
 * and still needs distances and a route from wherever they are.
 */
function anchorCell(p: Vec2): number {
  const a = nearestCell(p.x, p.z, roomy, 200);
  return a >= 0 ? a : nearestCell(p.x, p.z, walkable, 200);
}

function expand(i: number, visit: (n: number, cost: number) => void) {
  const c = i % COLS;
  const r = (i - c) / COLS;
  for (let k = 0; k < 8; k++) {
    const nc = c + DC[k];
    const nr = r + DR[k];
    if (nc < 0 || nr < 0 || nc >= COLS || nr >= ROWS) continue;
    const n = nr * COLS + nc;
    if (!ROOMY[n]) continue;
    // Never cut a corner diagonally past a blocked cell.
    if (k >= 4 && (!ROOMY[r * COLS + nc] || !ROOMY[nr * COLS + c])) continue;
    visit(n, k < 4 ? CELL : CELL * SQRT2);
  }
}

/** Removes needless zig-zags: keeps a point only where the straight line from the last kept point would leave the paving. */
function straighten(points: Vec2[]): Vec2[] {
  if (points.length <= 2) return points;
  const out = [points[0]];
  let anchor = 0;
  for (let i = 2; i < points.length; i++) {
    if (!segmentClear(points[anchor], points[i], 0.45)) {
      out.push(points[i - 1]);
      anchor = i - 1;
    }
  }
  out.push(points[points.length - 1]);
  return out;
}

function finish(points: Vec2[]): Route {
  let length = 0;
  for (let i = 1; i < points.length; i++) length += Math.hypot(points[i].x - points[i - 1].x, points[i].z - points[i - 1].z);
  const metres = length * METRES_PER_UNIT;
  return { points, length, metres, minutes: Math.max(1, Math.round(metres / WALK_METRES_PER_MIN)) };
}

/** A* over the walk grid, from wherever the visitor is standing to a destination point. */
export function findRoute(from: Vec2, to: Vec2): Route | null {
  const start = anchorCell(from);
  const goal = anchorCell(to);
  if (start < 0 || goal < 0) return null;

  stamp++;
  const goalC = goal % COLS;
  const goalR = (goal - goalC) / COLS;
  const h = (i: number) => {
    const dc = Math.abs((i % COLS) - goalC);
    const dr = Math.abs(Math.floor(i / COLS) - goalR);
    return CELL * (Math.max(dc, dr) + (SQRT2 - 1) * Math.min(dc, dr));
  };

  const open = new Heap();
  gScore[start] = 0;
  seen[start] = stamp;
  came[start] = -1;
  open.push(start, h(start));

  let found = start === goal;
  while (!found && open.size) {
    const current = open.pop();
    if (closed[current] === stamp) continue;
    closed[current] = stamp;
    if (current === goal) {
      found = true;
      break;
    }
    const base = gScore[current];
    expand(current, (n, cost) => {
      if (closed[n] === stamp) return;
      const g = base + cost;
      if (seen[n] !== stamp || g < gScore[n]) {
        seen[n] = stamp;
        gScore[n] = g;
        came[n] = current;
        open.push(n, g + h(n));
      }
    });
  }
  if (!found) return null;

  const cells: Vec2[] = [];
  for (let i = goal; i !== -1; i = came[i]) cells.unshift(cellCentre(i));
  const raw = [{ x: from.x, z: from.z }, ...cells, { x: to.x, z: to.z }];
  const points = straighten(raw).filter((p, i, a) => i === 0 || Math.hypot(p.x - a[i - 1].x, p.z - a[i - 1].z) > 0.05);
  return finish(points);
}

/**
 * Walking distance in metres from one point to many, in a single sweep of the
 * grid. Used by the places list, where running a full route per place would be wasteful.
 */
export function walkingMetres(from: Vec2, targets: Vec2[]): number[] {
  const start = anchorCell(from);
  if (start < 0) return targets.map(() => Infinity);
  const goals = targets.map(anchorCell);
  const pending = new Set(goals.filter((g) => g >= 0));

  stamp++;
  const open = new Heap();
  gScore[start] = 0;
  seen[start] = stamp;
  open.push(start, 0);
  while (open.size && pending.size) {
    const current = open.pop();
    if (closed[current] === stamp) continue;
    closed[current] = stamp;
    pending.delete(current);
    const base = gScore[current];
    expand(current, (n, cost) => {
      if (closed[n] === stamp) return;
      const g = base + cost;
      if (seen[n] !== stamp || g < gScore[n]) {
        seen[n] = stamp;
        gScore[n] = g;
        open.push(n, g);
      }
    });
  }
  return goals.map((g) => (g >= 0 && closed[g] === stamp ? gScore[g] * METRES_PER_UNIT : Infinity));
}

/**
 * Rounds to a friendly figure: 10 m steps below 200 m, 50 m steps above.
 * Pass `fine` for a countdown, where 50 m steps would look frozen.
 */
export function formatMetres(m: number, fine = false): string {
  if (m < 15) return 'a few steps';
  const step = m < 200 || fine ? 10 : 50;
  return `${Math.round(m / step) * step} m`;
}
