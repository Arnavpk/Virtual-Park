import { ATTRACTIONS, LANDMARKS, SPAWN } from '../data/park';
import { GRID, GRID_BITS } from '../data/park.generated';
import type { Solid, Vec2 } from '../data/types';

/**
 * Where the visitor can stand.
 *
 * The park's paving was traced from the aerial image into a grid of small
 * cells (see data/park.generated.ts). On top of that, every attraction and
 * landmark stamps its solid footprint as not walkable, and anything that ends
 * up cut off from the entrance is dropped, so every walkable cell is reachable.
 */

export const { cell: CELL, cols: COLS, rows: ROWS, originX: ORIGIN_X, originZ: ORIGIN_Z } = GRID;

function decode(): Uint8Array {
  const raw = atob(GRID_BITS);
  const cells = new Uint8Array(COLS * ROWS);
  for (let i = 0; i < cells.length; i++) cells[i] = (raw.charCodeAt(i >> 3) >> (7 - (i & 7))) & 1;
  return cells;
}

function stamp(cells: Uint8Array, x: number, z: number, solid: Solid) {
  const reach = 'r' in solid ? solid.r : Math.hypot(solid.w, solid.d) / 2;
  const c0 = Math.max(0, Math.floor((x - reach - ORIGIN_X) / CELL));
  const c1 = Math.min(COLS - 1, Math.ceil((x + reach - ORIGIN_X) / CELL));
  const r0 = Math.max(0, Math.floor((z - reach - ORIGIN_Z) / CELL));
  const r1 = Math.min(ROWS - 1, Math.ceil((z + reach - ORIGIN_Z) / CELL));
  const t = 'r' in solid ? 0 : (solid.rot * Math.PI) / 180;
  const cos = Math.cos(t);
  const sin = Math.sin(t);
  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      const dx = ORIGIN_X + (c + 0.5) * CELL - x;
      const dz = ORIGIN_Z + (r + 0.5) * CELL - z;
      let inside: boolean;
      if ('r' in solid) inside = dx * dx + dz * dz <= solid.r * solid.r;
      else inside = Math.abs(dx * cos - dz * sin) <= solid.w / 2 && Math.abs(dx * sin + dz * cos) <= solid.d / 2;
      if (inside) cells[r * COLS + c] = 0;
    }
  }
}

export const cellIndex = (x: number, z: number) => {
  const c = Math.floor((x - ORIGIN_X) / CELL);
  const r = Math.floor((z - ORIGIN_Z) / CELL);
  return c < 0 || r < 0 || c >= COLS || r >= ROWS ? -1 : r * COLS + c;
};
export const cellCentre = (i: number): Vec2 => ({
  x: ORIGIN_X + ((i % COLS) + 0.5) * CELL,
  z: ORIGIN_Z + (Math.floor(i / COLS) + 0.5) * CELL,
});

/** Nearest cell to (x, z) for which `ok` is true, searching outwards ring by ring. */
export function nearestCell(x: number, z: number, ok: (i: number) => boolean, maxRings = 80): number {
  const c0 = Math.floor((x - ORIGIN_X) / CELL);
  const r0 = Math.floor((z - ORIGIN_Z) / CELL);
  let best = -1;
  let bestD = Infinity;
  for (let ring = 0; ring <= maxRings; ring++) {
    // A hit in ring n can be beaten by a diagonal-closer hit up to ring n*1.42, so look a little further.
    if (best >= 0 && ring * CELL > bestD + CELL) break;
    for (let dr = -ring; dr <= ring; dr++) {
      for (let dc = -ring; dc <= ring; dc++) {
        if (Math.max(Math.abs(dr), Math.abs(dc)) !== ring) continue;
        const r = r0 + dr;
        const c = c0 + dc;
        if (r < 0 || c < 0 || r >= ROWS || c >= COLS) continue;
        const i = r * COLS + c;
        if (!ok(i)) continue;
        const d = Math.hypot(ORIGIN_X + (c + 0.5) * CELL - x, ORIGIN_Z + (r + 0.5) * CELL - z);
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      }
    }
  }
  return best;
}

/** Keeps only the cells of `cells` connected (edge to edge) to the one nearest the entrance. */
function reachable(cells: Uint8Array): Uint8Array {
  const start = nearestCell(SPAWN.x, SPAWN.z, (i) => cells[i] === 1, 200);
  const reached = new Uint8Array(cells.length);
  if (start < 0) return reached;
  const queue = new Int32Array(cells.length);
  let head = 0;
  let tail = 0;
  queue[tail++] = start;
  reached[start] = 1;
  while (head < tail) {
    const i = queue[head++];
    const c = i % COLS;
    const next = [c > 0 ? i - 1 : -1, c < COLS - 1 ? i + 1 : -1, i - COLS, i + COLS];
    for (const n of next) {
      if (n < 0 || n >= cells.length || reached[n] || !cells[n]) continue;
      reached[n] = 1;
      queue[tail++] = n;
    }
  }
  return reached;
}

function build(): Uint8Array {
  const cells = decode();
  for (const a of ATTRACTIONS) if (a.solid) stamp(cells, a.position[0], a.position[2], a.solid);
  for (const l of LANDMARKS) if (l.solid) stamp(cells, l.position[0], l.position[2], l.solid);
  return reachable(cells);
}

/** 1 = walkable, 0 = not. Indexed row * COLS + col. */
export const WALK = build();

export const isWalkable = (x: number, z: number) => {
  const i = cellIndex(x, z);
  return i >= 0 && WALK[i] === 1;
};

/**
 * Cells with a full cell of clear paving on every side, connected to the
 * entrance. Routes are planned over these so they keep off the kerbs; the
 * visitor can still squeeze through narrower gaps by hand.
 */
export const ROOMY: Uint8Array = (() => {
  const wide = new Uint8Array(WALK.length);
  for (let i = 0; i < WALK.length; i++) {
    if (!WALK[i]) continue;
    const c = i % COLS;
    if (c === 0 || c === COLS - 1 || i < COLS || i >= WALK.length - COLS) continue;
    wide[i] =
      WALK[i - 1] && WALK[i + 1] && WALK[i - COLS] && WALK[i + COLS] &&
      WALK[i - COLS - 1] && WALK[i - COLS + 1] && WALK[i + COLS - 1] && WALK[i + COLS + 1]
        ? 1
        : 0;
  }
  return reachable(wide);
})();

/**
 * The nearest walkable spot to (x, z), but only if it is within `maxUnits`;
 * otherwise null. Used to keep a GPS position on a path it is clearly on,
 * without ever pulling it onto a path further away.
 */
export function nearestPaving(x: number, z: number, maxUnits: number): Vec2 | null {
  if (isWalkable(x, z)) return { x, z };
  const i = nearestCell(x, z, (k) => WALK[k] === 1, Math.ceil(maxUnits / CELL) + 1);
  if (i < 0) return null;
  const c = cellCentre(i);
  return Math.hypot(c.x - x, c.z - z) <= maxUnits ? c : null;
}

let pavingField: Uint8Array | null = null;
const FIELD_MAX = 120; // cells; beyond this everything counts as "far"

/**
 * Roughly how far (in world units) a point is from the nearest walkable
 * paving: 0 on the paving itself. Used to decide whether a GPS position is
 * inside the park. The lookup table is built the first time it is needed.
 */
export function distanceToPaving(x: number, z: number): number {
  if (!pavingField) {
    const field = new Uint8Array(WALK.length).fill(FIELD_MAX);
    const queue = new Int32Array(WALK.length);
    let head = 0;
    let tail = 0;
    for (let i = 0; i < WALK.length; i++) {
      if (WALK[i]) {
        field[i] = 0;
        queue[tail++] = i;
      }
    }
    while (head < tail) {
      const i = queue[head++];
      const d = field[i] + 1;
      if (d >= FIELD_MAX) continue;
      const c = i % COLS;
      const next = [c > 0 ? i - 1 : -1, c < COLS - 1 ? i + 1 : -1, i - COLS, i + COLS];
      for (const n of next) {
        if (n < 0 || n >= field.length || field[n] <= d) continue;
        field[n] = d;
        queue[tail++] = n;
      }
    }
    pavingField = field;
  }
  const i = cellIndex(x, z);
  return i < 0 ? Infinity : pavingField[i] >= FIELD_MAX ? Infinity : pavingField[i] * CELL;
}
