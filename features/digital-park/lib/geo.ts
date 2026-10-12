import { ATTRACTIONS, LANDMARKS, METRES_PER_UNIT } from '../data/park';
import { parkGeoConfig, type GeoReferencePoint, type LatLonPair, type ParkGeoConfig } from '../data/parkGeoConfig';
import type { Vec2 } from '../data/types';

/**
 * GPS  →  metres on the ground  →  3D world coordinates.
 *
 * Step 1. Latitude/longitude become flat metres east and south of an origin
 *         (an equirectangular projection; over a park-sized area the error
 *         is millimetres).
 * Step 2. A "similarity transform" (one scale, one rotation, one shift) takes
 *         those metres to the park's x/z. It is fitted by least squares from
 *         the control points in parkGeoConfig, so nothing about the park's
 *         orientation or size is assumed here (latitude is never simply
 *         copied onto an axis).
 * Step 3. Optionally, a smooth local correction (thin-plate spline) bends
 *         the result towards the control points, for when the 3D map itself
 *         is a little distorted. Off unless parkGeoConfig turns it on.
 *
 * The world's axes: x runs to the right of the map, z runs down it. South is
 * used rather than north in step 1 so that both systems are "right, then
 * down" and the fit is a plain rotation with no mirror flip.
 *
 * Three kinds of position are kept apart throughout: the raw readings in the
 * config, the representative coordinate worked out from them, and the world
 * position the calibration maps it to.
 */

const EARTH_RADIUS = 6371008.8; // metres
const RAD = Math.PI / 180;
/** A point whose readings spread wider than this is flagged for re-checking. */
export const SPREAD_FLAG_METRES = 12;

export interface LatLon {
  latitude: number;
  longitude: number;
}

interface Tps {
  /** Control points in local metres (east, south). */
  pts: { e: number; s: number }[];
  /** Kernel weights and affine terms for x and z residuals (world units). */
  wx: number[];
  wz: number[];
  ax: [number, number, number];
  az: [number, number, number];
}

export interface Calibration {
  /** 'points' = fitted from 2+ reference points. 'single' = one point plus stated scale/direction. 'test' = temporary, for development. */
  kind: 'points' | 'single' | 'test';
  /** 'provisional' = fitted but not confirmed on site; 'verified' = confirmed on site; 'test' = development only. */
  status: 'provisional' | 'verified' | 'test';
  origin: LatLon;
  /** The transform as a complex number a = ar + i·ai and shift b: world = a · metres + b. */
  ar: number;
  ai: number;
  bx: number;
  bz: number;
  metresPerUnit: number;
  /** Compass bearing that "up" on the map points to. 0 = north-up. */
  northUpDeg: number;
  /** Root-mean-square distance between the control points and where the fit puts them, in metres. 0 for an exact fit. */
  fitErrorMetres: number;
  /** Leave-one-out RMS error over the control points, in metres: each point predicted by a fit made without it. Null with fewer than 3 points. */
  looErrorMetres: number | null;
  /** RMS error at the check points (never used for fitting), in metres. Null if there are none. */
  checkErrorMetres: number | null;
  checkCount: number;
  pointCount: number;
  /** Local correction on top of the similarity, if enabled. */
  tps?: Tps;
}

/** Flat metres east and south of `origin`. */
export function toLocalMetres(p: LatLon, origin: LatLon) {
  return {
    east: (p.longitude - origin.longitude) * RAD * EARTH_RADIUS * Math.cos(origin.latitude * RAD),
    south: -(p.latitude - origin.latitude) * RAD * EARTH_RADIUS,
  };
}

function fromLocalMetres(east: number, south: number, origin: LatLon): LatLon {
  return {
    latitude: origin.latitude - south / EARTH_RADIUS / RAD,
    longitude: origin.longitude + east / (EARTH_RADIUS * Math.cos(origin.latitude * RAD)) / RAD,
  };
}

/** Great-circle distance between two coordinates, in metres. */
export function distanceMetres(a: LatLon, b: LatLon): number {
  const dLat = (b.latitude - a.latitude) * RAD;
  const dLon = (b.longitude - a.longitude) * RAD;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.latitude * RAD) * Math.cos(b.latitude * RAD) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** A plausible coordinate: finite numbers in range, and not the 0,0 a broken receiver sometimes reports. */
export function isValidLatLon(p: { latitude: unknown; longitude: unknown } | null | undefined): p is LatLon {
  if (!p) return false;
  const { latitude, longitude } = p;
  return (
    typeof latitude === 'number' &&
    typeof longitude === 'number' &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    Math.abs(latitude) <= 90 &&
    Math.abs(longitude) <= 180 &&
    !(latitude === 0 && longitude === 0)
  );
}

const pair = ([latitude, longitude]: LatLonPair): LatLon => ({ latitude, longitude });

// ---------------------------------------------------------------- representative coordinates

export interface Representative extends LatLon {
  /** How it was obtained. */
  source: 'explicit' | 'readings';
  /** Number of readings recorded, and which (by index) were left out as outliers. */
  readingCount: number;
  dropped: number[];
  /** Largest distance between any two readings that were kept, in metres. */
  spreadMetres: number;
  /** False when the readings disagree by more than SPREAD_FLAG_METRES: worth re-surveying. */
  consistent: boolean;
}

/**
 * The single coordinate that stands for a set of raw readings: their average,
 * after leaving out any reading that sits far away from all the others (more
 * than 20 m, and more than three times the spread of the rest). With phone GPS
 * a wide spread is usually drift rather than one bad reading, so nothing is
 * dropped unless it clearly stands alone; wide spreads are flagged instead.
 */
export function representativeOf(readings: readonly LatLonPair[]): Representative | null {
  const all = readings.map(pair).filter(isValidLatLon);
  if (all.length === 0) return null;
  const mean = (ps: LatLon[]) => ({
    latitude: ps.reduce((s, p) => s + p.latitude, 0) / ps.length,
    longitude: ps.reduce((s, p) => s + p.longitude, 0) / ps.length,
  });
  const spread = (ps: LatLon[]) => {
    let m = 0;
    for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) m = Math.max(m, distanceMetres(ps[i], ps[j]));
    return m;
  };
  const dropped: number[] = [];
  if (all.length >= 3) {
    all.forEach((p, i) => {
      const rest = all.filter((_, j) => j !== i);
      const gap = distanceMetres(p, mean(rest));
      if (gap > 20 && gap > 3 * spread(rest)) dropped.push(i);
    });
    if (dropped.length > 1) dropped.length = 0; // two "outliers" out of a handful means there's no clear majority: keep them all
  }
  const kept = all.filter((_, i) => !dropped.includes(i));
  const m = mean(kept);
  const s = spread(kept);
  return { ...m, source: 'readings', readingCount: all.length, dropped, spreadMetres: s, consistent: s <= SPREAD_FLAG_METRES };
}

/** The representative coordinate of a reference point: its explicit lat/lon if given, else from its readings. */
export function referenceGps(ref: GeoReferencePoint): Representative | null {
  if (isValidLatLon(ref)) {
    return { latitude: ref.latitude, longitude: ref.longitude, source: 'explicit', readingCount: 0, dropped: [], spreadMetres: 0, consistent: true };
  }
  return ref.readings ? representativeOf(ref.readings) : null;
}

// ---------------------------------------------------------------- transform

function similarityPart(p: LatLon, c: Calibration): Vec2 {
  const { east, south } = toLocalMetres(p, c.origin);
  return { x: c.ar * east - c.ai * south + c.bx, z: c.ai * east + c.ar * south + c.bz };
}

const kernel = (r2: number) => (r2 > 1e-12 ? 0.5 * r2 * Math.log(r2) : 0); // r² log r, written with r²

function tpsAt(t: Tps, e: number, s: number): Vec2 {
  let x = t.ax[0] + t.ax[1] * e + t.ax[2] * s;
  let z = t.az[0] + t.az[1] * e + t.az[2] * s;
  for (let i = 0; i < t.pts.length; i++) {
    const k = kernel((e - t.pts[i].e) ** 2 + (s - t.pts[i].s) ** 2);
    x += t.wx[i] * k;
    z += t.wz[i] * k;
  }
  return { x, z };
}

export function gpsToWorld(p: LatLon, c: Calibration): Vec2 {
  const w = similarityPart(p, c);
  if (!c.tps) return w;
  const { east, south } = toLocalMetres(p, c.origin);
  const d = tpsAt(c.tps, east, south);
  return { x: w.x + d.x, z: w.z + d.z };
}

export function worldToGps(w: Vec2, c: Calibration): LatLon {
  const k = c.ar * c.ar + c.ai * c.ai;
  const invert = (x: number, z: number) => {
    const dx = x - c.bx;
    const dz = z - c.bz;
    return { east: (c.ar * dx + c.ai * dz) / k, south: (-c.ai * dx + c.ar * dz) / k };
  };
  let m = invert(w.x, w.z);
  // With a local correction, refine: find the metres whose corrected position lands on w.
  if (c.tps) {
    for (let i = 0; i < 8; i++) {
      const d = tpsAt(c.tps, m.east, m.south);
      m = invert(w.x - d.x, w.z - d.z);
    }
  }
  return fromLocalMetres(m.east, m.south, c.origin);
}

function describe(ar: number, ai: number) {
  const scale = Math.hypot(ar, ai); // world units per metre
  // The fit turns compass directions clockwise on the map by atan2(ai, ar): north lands that far
  // clockwise of map-up. So map-up itself points to the opposite of that as a compass bearing.
  const northUpDeg = (((-Math.atan2(ai, ar) / RAD) % 360) + 360) % 360;
  return { metresPerUnit: 1 / scale, northUpDeg };
}

function rotated(c: Calibration, deg: number, pivot: Vec2): Calibration {
  if (!deg) return c;
  const t = deg * RAD;
  const cos = Math.cos(t);
  const sin = Math.sin(t);
  const ar = c.ar * cos - c.ai * sin;
  const ai = c.ar * sin + c.ai * cos;
  const bx = pivot.x + (c.bx - pivot.x) * cos - (c.bz - pivot.z) * sin;
  const bz = pivot.z + (c.bx - pivot.x) * sin + (c.bz - pivot.z) * cos;
  return { ...c, ar, ai, bx, bz, ...describe(ar, ai) };
}

/**
 * A compass bearing (0 = north, 90 = east) as a unit direction in the park's
 * x/z plane. Used for the direction of travel and for the compass.
 */
export function bearingToWorld(bearingDeg: number, c: Calibration): Vec2 {
  const east = Math.sin(bearingDeg * RAD);
  const south = -Math.cos(bearingDeg * RAD);
  const x = c.ar * east - c.ai * south;
  const z = c.ai * east + c.ar * south;
  const len = Math.hypot(x, z) || 1;
  return { x: x / len, z: z / len };
}

/** Where a reference point sits in the 3D park. */
export function referenceWorld(ref: Pick<GeoReferencePoint, 'x' | 'z' | 'at'>): Vec2 | null {
  if (typeof ref.x === 'number' && typeof ref.z === 'number') return { x: ref.x, z: ref.z };
  const place = ATTRACTIONS.find((a) => a.id === ref.at) ?? LANDMARKS.find((l) => l.id === ref.at);
  return place ? { x: place.position[0], z: place.position[2] } : null;
}

interface Pair {
  id: string;
  gps: LatLon;
  world: Vec2;
}

/** Control and check pairs from the config. */
export function calibrationPairs(config: ParkGeoConfig = parkGeoConfig): { control: Pair[]; check: Pair[] } {
  const control: Pair[] = [];
  const check: Pair[] = [];
  config.referencePoints.forEach((ref, i) => {
    const world = referenceWorld(ref);
    const gps = referenceGps(ref);
    if (!world || !gps) return;
    (ref.use === 'check' ? check : control).push({ id: ref.id ?? `#${i + 1}`, gps, world });
  });
  for (const r of config.ridePoints ?? []) {
    const world = referenceWorld({ at: r.surveySheetPlace });
    if (!world || !isValidLatLon(pair(r.coordinate))) continue;
    // A ride only ever fits the calibration once its identity is confirmed.
    const useAsControl = r.use === 'control' && r.mappingStatus === 'confirmed';
    (useAsControl ? control : check).push({ id: r.id, gps: pair(r.coordinate), world });
  }
  return { control, check };
}

function fitSimilarity(pairs: Pair[], origin: LatLon) {
  const local = pairs.map((p) => toLocalMetres(p.gps, origin));
  const n = pairs.length;
  const me = local.reduce((s, p) => s + p.east, 0) / n;
  const ms = local.reduce((s, p) => s + p.south, 0) / n;
  const mx = pairs.reduce((s, p) => s + p.world.x, 0) / n;
  const mz = pairs.reduce((s, p) => s + p.world.z, 0) / n;
  // a = Σ (q − q̄)·conj(p − p̄) / Σ |p − p̄|², with p = east + i·south and q = x + i·z.
  let numR = 0;
  let numI = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    const pe = local[i].east - me;
    const ps = local[i].south - ms;
    const qx = pairs[i].world.x - mx;
    const qz = pairs[i].world.z - mz;
    numR += qx * pe + qz * ps;
    numI += qz * pe - qx * ps;
    den += pe * pe + ps * ps;
  }
  if (den < 1) throw new Error('GPS reference points are (almost) the same place. Pick points that are far apart.');
  const ar = numR / den;
  const ai = numI / den;
  return { ar, ai, bx: mx - (ar * me - ai * ms), bz: mz - (ai * me + ar * ms), pivot: { x: mx, z: mz } };
}

/** Solves A·x = b (small, dense) by Gaussian elimination with partial pivoting. */
function solve(A: number[][], b: number[]): number[] {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    [M[c], M[p]] = [M[p], M[c]];
    const d = M[c][c] || 1e-12;
    for (let r = c + 1; r < n; r++) {
      const f = M[r][c] / d;
      if (f) for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
    }
  }
  const x = new Array<number>(n).fill(0);
  for (let r = n - 1; r >= 0; r--) {
    let s = M[r][n];
    for (let k = r + 1; k < n; k++) s -= M[r][k] * x[k];
    x[r] = s / (M[r][r] || 1e-12);
  }
  return x;
}

/** Smoothing thin-plate spline through the residuals left by the similarity fit. */
function fitTps(pairs: Pair[], c: Calibration, smoothing: number): Tps | undefined {
  const n = pairs.length;
  if (n < 4) return undefined;
  const pts = pairs.map((p) => {
    const m = toLocalMetres(p.gps, c.origin);
    return { e: m.east, s: m.south };
  });
  const res = pairs.map((p) => {
    const w = similarityPart(p.gps, c);
    return { x: p.world.x - w.x, z: p.world.z - w.z };
  });
  const N = n + 3;
  const A: number[][] = Array.from({ length: N }, () => new Array<number>(N).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) A[i][j] = kernel((pts[i].e - pts[j].e) ** 2 + (pts[i].s - pts[j].s) ** 2);
    A[i][i] += smoothing;
    A[i][n] = A[n][i] = 1;
    A[i][n + 1] = A[n + 1][i] = pts[i].e;
    A[i][n + 2] = A[n + 2][i] = pts[i].s;
  }
  const bx = [...res.map((r) => r.x), 0, 0, 0];
  const bz = [...res.map((r) => r.z), 0, 0, 0];
  const sx = solve(A, bx);
  const sz = solve(A, bz);
  return { pts, wx: sx.slice(0, n), wz: sz.slice(0, n), ax: [sx[n], sx[n + 1], sx[n + 2]], az: [sz[n], sz[n + 1], sz[n + 2]] };
}

const rmsMetres = (pairs: Pair[], c: Calibration) => {
  if (!pairs.length) return 0;
  let sq = 0;
  for (const p of pairs) {
    const w = gpsToWorld(p.gps, c);
    sq += (w.x - p.world.x) ** 2 + (w.z - p.world.z) ** 2;
  }
  return Math.sqrt(sq / pairs.length) * c.metresPerUnit;
};

function fitPairs(control: Pair[], config: ParkGeoConfig): Calibration {
  const n = control.length;
  const origin: LatLon = {
    latitude: control.reduce((s, p) => s + p.gps.latitude, 0) / n,
    longitude: control.reduce((s, p) => s + p.gps.longitude, 0) / n,
  };
  const s = fitSimilarity(control, origin);
  const base: Calibration = {
    kind: 'points',
    status: config.calibrationStatus ?? 'provisional',
    origin,
    ar: s.ar,
    ai: s.ai,
    bx: s.bx,
    bz: s.bz,
    ...describe(s.ar, s.ai),
    fitErrorMetres: 0,
    looErrorMetres: null,
    checkErrorMetres: null,
    checkCount: 0,
    pointCount: n,
  };
  const c = rotated(base, config.rotationOffsetDeg, s.pivot);
  if (config.localCorrection?.enabled) c.tps = fitTps(control, c, config.localCorrection.smoothing);
  c.fitErrorMetres = rmsMetres(control, c);
  return c;
}

/**
 * Builds the calibration from the config, or returns null when no reference
 * point has been measured yet. With two or more points this is the
 * least-squares best fit of scale, rotation and shift (plus the optional local
 * correction), with its error measured three ways: at the control points, by
 * leaving each control point out in turn, and at the independent check points.
 */
export function buildCalibration(config: ParkGeoConfig = parkGeoConfig): Calibration | null {
  const { control, check } = calibrationPairs(config);
  if (control.length === 0) return null;

  if (control.length === 1) {
    const c = anchorCalibration(
      control[0].gps,
      control[0].world,
      config.singlePointFallback.metresPerUnit,
      config.singlePointFallback.northUpDeg + config.rotationOffsetDeg,
      'single',
    );
    return { ...c, status: config.calibrationStatus ?? 'provisional' };
  }

  const c = fitPairs(control, config);
  if (control.length >= 3) {
    let sq = 0;
    for (let i = 0; i < control.length; i++) {
      const without = fitPairs(control.filter((_, j) => j !== i), config);
      const w = gpsToWorld(control[i].gps, without);
      sq += ((w.x - control[i].world.x) ** 2 + (w.z - control[i].world.z) ** 2) * without.metresPerUnit ** 2;
    }
    c.looErrorMetres = Math.sqrt(sq / control.length);
  }
  if (check.length) {
    c.checkErrorMetres = rmsMetres(check, c);
    c.checkCount = check.length;
  }
  return c;
}

/** A calibration pinned at one known spot, with the scale and compass direction stated rather than measured. */
export function anchorCalibration(
  gps: LatLon,
  world: Vec2,
  metresPerUnit: number,
  northUpDeg: number,
  kind: Calibration['kind'] = 'test',
): Calibration {
  const scale = 1 / metresPerUnit;
  const ar = scale * Math.cos(-northUpDeg * RAD);
  const ai = scale * Math.sin(-northUpDeg * RAD);
  return {
    kind,
    status: 'test',
    origin: gps,
    ar,
    ai,
    bx: world.x,
    bz: world.z,
    ...describe(ar, ai),
    fitErrorMetres: 0,
    looErrorMetres: null,
    checkErrorMetres: null,
    checkCount: 0,
    pointCount: 1,
  };
}

/** The park's real calibration, or null while parkGeoConfig still holds placeholders. */
export const PARK_CALIBRATION: Calibration | null = buildCalibration();

/**
 * The calibration's honest expected error in metres, for wording in the app:
 * the larger of the leave-one-out and check-point errors.
 */
export const CALIBRATION_ERROR_METRES: number | null = PARK_CALIBRATION
  ? Math.max(PARK_CALIBRATION.looErrorMetres ?? 0, PARK_CALIBRATION.checkErrorMetres ?? 0, PARK_CALIBRATION.fitErrorMetres) || null
  : null;

/**
 * Metres per world unit for distances shown to visitors. Once the park is
 * calibrated this is measured; until then it is the estimate in park.ts.
 */
export const EFFECTIVE_METRES_PER_UNIT =
  PARK_CALIBRATION && PARK_CALIBRATION.kind === 'points' ? PARK_CALIBRATION.metresPerUnit : METRES_PER_UNIT;
