/**
 * Checks the GPS mapping and smoothing maths. Run with: npm run test:geo
 *
 * The coordinates used here are synthetic: a made-up origin with reference
 * points generated from the 3D park at a known scale and rotation, so the
 * answers are known in advance. They are not the real park's coordinates.
 */
import { parkGeoConfig, type ParkGeoConfig } from '../features/digital-park/data/parkGeoConfig';
import { ATTRACTIONS } from '../features/digital-park/data/park';
import {
  PARK_CALIBRATION,
  anchorCalibration,
  buildCalibration,
  calibrationPairs,
  distanceMetres,
  gpsToWorld,
  referenceGps,
  referenceWorld,
  representativeOf,
  worldToGps,
} from '../features/digital-park/lib/geo';
import { createGpsFilter } from '../features/digital-park/lib/gpsFilter';

let failed = 0;
const check = (name: string, ok: boolean, detail = '') => {
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? '  ' + detail : ''}`);
};
const near = (a: number, b: number, tol: number) => Math.abs(a - b) <= tol;

// ---- 1. A synthetic "truth": scale 1.37 m per unit, map turned 37° from north-up.
const TRUE_MPU = 1.37;
const TRUE_NORTH_UP = 37;
const truth = anchorCalibration({ latitude: 12.5, longitude: 77.5 }, { x: 10, z: -5 }, TRUE_MPU, TRUE_NORTH_UP);
const synthetic = (noiseMetres = 0): ParkGeoConfig => ({
  ...parkGeoConfig,
  rotationOffsetDeg: 0,
  referencePoints: parkGeoConfig.referencePoints.map((ref, i) => {
    const w = referenceWorld(ref)!;
    // deterministic pseudo-noise so the test is repeatable
    const nx = (Math.sin(i * 12.9898) * noiseMetres) / TRUE_MPU;
    const nz = (Math.cos(i * 78.233) * noiseMetres) / TRUE_MPU;
    const g = worldToGps({ x: w.x + nx, z: w.z + nz }, truth);
    return { ...ref, latitude: g.latitude, longitude: g.longitude };
  }),
});

const exact = buildCalibration(synthetic())!;
check('scale recovered from reference points', near(exact.metresPerUnit, TRUE_MPU, 1e-6), `${exact.metresPerUnit.toFixed(6)} m/unit`);
check('rotation recovered from reference points', near(exact.northUpDeg, TRUE_NORTH_UP, 1e-4), `${exact.northUpDeg.toFixed(6)}°`);
check('exact points give (near) zero fit error', exact.fitErrorMetres < 1e-3, `${exact.fitErrorMetres.toExponential(1)} m`);

let worst = 0;
for (const ref of parkGeoConfig.referencePoints) {
  const w = referenceWorld(ref)!;
  const back = gpsToWorld(worldToGps(w, truth), exact);
  worst = Math.max(worst, Math.hypot(back.x - w.x, back.z - w.z));
}
check('reference points map back onto themselves', worst < 1e-3, `worst ${worst.toExponential(1)} units`);

// A point that was never a reference point: 100 m due north of the gate must move "up" the rotated map by 100 m.
const gate = referenceWorld(parkGeoConfig.referencePoints[0])!;
const gateGps = worldToGps(gate, truth);
const north100 = gpsToWorld({ latitude: gateGps.latitude + 100 / 111194.93, longitude: gateGps.longitude }, exact);
const moved = Math.hypot(north100.x - gate.x, north100.z - gate.z) * TRUE_MPU;
const bearingOnMap = (Math.atan2(north100.x - gate.x, -(north100.z - gate.z)) * 180) / Math.PI; // 0 = straight up the map
check('walking 100 m north moves the character 100 m', near(moved, 100, 0.05), `${moved.toFixed(2)} m`);
check('...in the right direction on the map', near(((bearingOnMap % 360) + 360) % 360, 360 - TRUE_NORTH_UP, 0.01), `${bearingOnMap.toFixed(2)}° from map-up`);
const east50 = gpsToWorld({ latitude: gateGps.latitude, longitude: gateGps.longitude + 50 / (111194.93 * Math.cos((gateGps.latitude * Math.PI) / 180)) }, exact);
check('walking 50 m east moves the character 50 m', near(Math.hypot(east50.x - gate.x, east50.z - gate.z) * TRUE_MPU, 50, 0.05));

const two = buildCalibration({ ...synthetic(), referencePoints: synthetic().referencePoints.slice(0, 2) })!;
check('two points are enough', near(two.metresPerUnit, TRUE_MPU, 1e-5) && near(two.northUpDeg, TRUE_NORTH_UP, 1e-4), `${two.metresPerUnit.toFixed(6)} m/unit, ${two.northUpDeg.toFixed(5)}°`);

const noisy = buildCalibration(synthetic(3))!;
check('3 m of error in the reference points barely changes the fit', near(noisy.metresPerUnit, TRUE_MPU, 0.03) && near(noisy.northUpDeg, TRUE_NORTH_UP, 1.5), `${noisy.metresPerUnit.toFixed(3)} m/unit, ${noisy.northUpDeg.toFixed(2)}°, fit error ${noisy.fitErrorMetres.toFixed(2)} m`);
check('...and the fit error reports it', noisy.fitErrorMetres > 0.5 && noisy.fitErrorMetres < 4);

const offset = buildCalibration({ ...synthetic(), rotationOffsetDeg: 5 })!;
check('rotationOffsetDeg of +5 turns GPS positions 5° clockwise on the map', near(offset.northUpDeg, TRUE_NORTH_UP - 5, 1e-4), `map-up bearing ${offset.northUpDeg.toFixed(3)}°`);

const one = buildCalibration({ ...synthetic(), referencePoints: synthetic().referencePoints.slice(0, 1), singlePointFallback: { metresPerUnit: 2, northUpDeg: 90 } })!;
check('a single point uses the stated scale and direction', one.kind === 'single' && near(one.metresPerUnit, 2, 1e-9) && near(one.northUpDeg, 90, 1e-9));

let threw = false;
try {
  const s = synthetic();
  buildCalibration({ ...s, referencePoints: [s.referencePoints[0], { ...s.referencePoints[0] }] });
} catch {
  threw = true;
}
check('two identical reference points are rejected', threw);

// ---- 2. Smoothing
const opts = { ignoreAboveMetres: 60, minMoveMetres: 1.5, walkingMetresPerSecond: 1.5 };
const wobble = (t: number, size: number) => ({ x: Math.sin(t * 1.7) * size, z: Math.cos(t * 2.3) * size });
{
  const f = createGpsFilter(opts);
  f.push({ x: 0, z: 0 }, 8, 0);
  let moves = 0;
  let maxDrift = 0;
  for (let t = 1; t <= 60; t++) {
    const r = f.push(wobble(t, 4), 8, t * 1000); // standing still, readings wobbling by up to 4 m
    if (r.status === 'moved') moves++;
    if (r.status !== 'ignored') maxDrift = Math.max(maxDrift, Math.hypot(r.position.x, r.position.z));
  }
  check('standing still: the character stays close despite 4 m of GPS wobble', maxDrift < 3.5, `${moves} moves in 60 readings, max drift ${maxDrift.toFixed(2)} m`);
}
/** Walks east at 1.4 m/s for `seconds`, then stands for `rest` seconds. Returns the lag at each second and the final position. */
function walkEast(seconds: number, rest: number, withHints: boolean) {
  const f = createGpsFilter(opts);
  f.push({ x: 0, z: 0 }, 6, 0);
  const lags: number[] = [];
  let last = { x: 0, z: 0 };
  let overshoot = 0;
  for (let t = 1; t <= seconds + rest; t++) {
    const truth = Math.min(t, seconds) * 1.4;
    const n = wobble(t, 2);
    const walking = t <= seconds;
    const hint = withHints ? { speed: walking ? 1.4 : 0, course: walking ? { x: 1, z: 0 } : null } : {};
    const r = f.push({ x: truth + n.x, z: n.z }, 6, t * 1000, hint);
    if (r.status !== 'ignored') last = r.position;
    if (walking && t > 5) lags.push(truth - last.x);
    if (!walking) overshoot = Math.max(overshoot, last.x - truth);
  }
  const mean = lags.reduce((a, b) => a + b, 0) / lags.length;
  return { mean, worst: Math.max(...lags.map(Math.abs)), overshoot, endError: Math.abs(last.x - seconds * 1.4), side: Math.abs(last.z) };
}
{
  const r = walkEast(30, 0, false);
  check('walking, positions only: the character keeps up (average lag under 2 m)', Math.abs(r.mean) < 2 && r.worst < 4.5, `average lag ${r.mean.toFixed(2)} m, worst ${r.worst.toFixed(2)} m, ${r.side.toFixed(1)} m off line`);
  const h = walkEast(30, 0, true);
  check('walking, phone reports speed and direction: lag under 1 m', Math.abs(h.mean) < 1 && h.worst < 3, `average lag ${h.mean.toFixed(2)} m, worst ${h.worst.toFixed(2)} m`);
  const s = walkEast(20, 10, false);
  check('stopping after a walk: little overshoot, settles on the spot', s.overshoot < 3 && s.endError < 2.5, `overshoot ${s.overshoot.toFixed(2)} m, ends ${s.endError.toFixed(2)} m from the truth`);
  const sh = walkEast(20, 10, true);
  check('stopping, with speed reported: settles on the spot', sh.overshoot < 2.5 && sh.endError < 2.5, `overshoot ${sh.overshoot.toFixed(2)} m, ends ${sh.endError.toFixed(2)} m from the truth`);
}
{
  // A right-angle turn: 15 s east then 15 s south.
  const f = createGpsFilter(opts);
  f.push({ x: 0, z: 0 }, 6, 0);
  let last = { x: 0, z: 0 };
  for (let t = 1; t <= 30; t++) {
    const truth = t <= 15 ? { x: t * 1.4, z: 0 } : { x: 21, z: (t - 15) * 1.4 };
    const n = wobble(t, 2);
    const r = f.push({ x: truth.x + n.x, z: truth.z + n.z }, 6, t * 1000);
    if (r.status !== 'ignored') last = r.position;
  }
  check('turning a corner: ends within 3 m of the truth', Math.hypot(last.x - 21, last.z - 21) < 3, `ended ${Math.hypot(last.x - 21, last.z - 21).toFixed(2)} m away`);
}
{
  const f = createGpsFilter(opts);
  f.push({ x: 0, z: 0 }, 8, 0);
  const poor = f.push({ x: 30, z: 0 }, 120, 1000);
  check('a very inaccurate reading is ignored', poor.status === 'ignored' && poor.reason === 'poor-accuracy');
  const glitch = f.push({ x: 400, z: 0 }, 8, 2000);
  check('a single wild reading is ignored', glitch.status === 'ignored' && glitch.reason === 'glitch');
  const after = f.push({ x: 0.5, z: 0 }, 8, 3000);
  check('...and normal tracking resumes', after.status !== 'ignored');
  f.push({ x: 400, z: 0 }, 8, 4000);
  f.push({ x: 401, z: 0 }, 8, 5000);
  const real = f.push({ x: 402, z: 0 }, 8, 6000);
  check('three wild readings in a row are accepted as a real move', real.status === 'moved' && real.jumped && Math.abs(real.position.x - 402) < 0.01);
}

{
  // QR anchor: the estimate is pinned to the code's spot, and later readings can't yank it away.
  const f = createGpsFilter(opts);
  f.push({ x: 0, z: 0 }, 8, 0);
  f.anchor({ x: 50, z: 0 }, 3, 1000);
  let worst = 0;
  for (let t = 2; t <= 20; t++) {
    const n = wobble(t, 4);
    const r = f.push({ x: 50 + n.x, z: n.z }, 10, t * 1000);
    if (r.status !== 'ignored') worst = Math.max(worst, Math.hypot(r.position.x - 50, r.position.z));
  }
  check('after a QR anchor, wobbling readings keep the character near the code', worst < 3, `max ${worst.toFixed(2)} m from the code`);
  const g = createGpsFilter(opts);
  g.push({ x: 0, z: 0 }, 8, 0);
  g.anchor({ x: 50, z: 0 }, 3, 1000);
  const poor = g.push({ x: 90, z: 0 }, 50, 2000);
  const pulled = poor.status === 'ignored' ? 0 : Math.hypot(poor.position.x - 50, poor.position.z);
  check('one imprecise reading 40 m away barely moves an anchored character', pulled < 3, `moved ${pulled.toFixed(2)} m`);
  const late = g.push({ x: 50, z: 0 }, 8, 1500);
  check('a reading older than the last one is dropped as stale', late.status === 'ignored' && late.reason === 'stale');
}

// ---- 3. Representative coordinates and the local correction
{
  const steady = representativeOf([[18.7652, 73.5156], [18.76521, 73.51561], [18.76519, 73.51559]])!;
  check('three close readings: averaged, nothing dropped, consistent', steady.dropped.length === 0 && steady.consistent && near(steady.latitude, 18.7652, 1e-9));
  const drift = representativeOf([[18.7653, 73.5145], [18.76535, 73.51457], [18.7654, 73.51463]])!;
  check('readings drifting in a line: nothing dropped, flagged for re-checking', drift.dropped.length === 0 && !drift.consistent, `spread ${drift.spreadMetres.toFixed(1)} m`);
  const lone = representativeOf([[18.7652, 73.5156], [18.76521, 73.51561], [18.7658, 73.5156]])!;
  check('one reading 65 m from two that agree: left out of the average', lone.dropped.join() === '2' && lone.consistent && near(lone.latitude, 18.765205, 1e-9));
  check('broken readings (NaN, 0,0) are ignored', representativeOf([[NaN, 73.5], [0, 0]]) === null);
  check('distanceMetres: 0.001° of latitude ≈ 111 m', near(distanceMetres({ latitude: 18.765, longitude: 73.515 }, { latitude: 18.766, longitude: 73.515 }), 111.2, 0.2));

  const on = { enabled: true, smoothing: 0 };
  const exactTps = buildCalibration({ ...synthetic(), localCorrection: on })!;
  check('local correction on exact data changes nothing', exactTps.fitErrorMetres < 1e-6);
  // A map that is bent: points further east are drawn progressively further down.
  const bent = (w: { x: number; z: number }) => ({ x: w.x, z: w.z + 0.0015 * w.x * w.x });
  const bentConfig = (lc?: { enabled: boolean; smoothing: number }): ParkGeoConfig => ({
    ...synthetic(),
    localCorrection: lc,
    referencePoints: synthetic().referencePoints.map((r) => ({ ...r, ...bent(referenceWorld(r)!) })),
  });
  const flat = buildCalibration(bentConfig())!;
  const fixed = buildCalibration(bentConfig({ enabled: true, smoothing: 50 }))!;
  check('on a bent map the local correction reduces the error', fixed.fitErrorMetres < flat.fitErrorMetres / 3, `similarity ${flat.fitErrorMetres.toFixed(1)} m → corrected ${fixed.fitErrorMetres.toFixed(1)} m`);
  let worstInv = 0;
  for (const w of [{ x: 0, z: 0 }, { x: 60, z: -70 }, { x: -80, z: 40 }]) {
    const back = gpsToWorld(worldToGps(w, fixed), fixed);
    worstInv = Math.max(worstInv, Math.hypot(back.x - w.x, back.z - w.z));
  }
  check('worldToGps undoes gpsToWorld with the correction on', worstInv < 0.01, `${worstInv.toExponential(1)} units`);
}

// ---- 4. The shipped config: survey report
check('every reference point names a real place in the 3D park', parkGeoConfig.referencePoints.every((r) => referenceWorld(r) !== null));
check('every R point names a real ride from the survey sheet', (parkGeoConfig.ridePoints ?? []).every((r) => referenceWorld({ at: r.surveySheetPlace }) !== null));
check('no R point fits the calibration while its ride is unconfirmed', (parkGeoConfig.ridePoints ?? []).every((r) => r.use === 'check' || r.mappingStatus === 'confirmed'));
const cal = PARK_CALIBRATION;
if (!cal) {
  const filled = parkGeoConfig.referencePoints.filter((r) => referenceGps(r)).length;
  console.log(`\nparkGeoConfig: NOT CALIBRATED (${filled} of ${parkGeoConfig.referencePoints.length} reference points have readings). GPS Mode will say it isn't set up.`);
} else {
  const mpu = cal.metresPerUnit;
  const f1 = (v: number) => v.toFixed(1).padStart(5);
  console.log(`\nparkGeoConfig: ${cal.status.toUpperCase()} calibration from ${cal.pointCount} control points` + (cal.tps ? ' + local correction' : ' (scale, rotation, shift)'));
  console.log(`  scale ${mpu.toFixed(3)} m per world unit (the park.ts estimate was 1.6), map-up points to compass bearing ${cal.northUpDeg.toFixed(1)}°`);
  console.log(`  RMS error at the control points ${cal.fitErrorMetres.toFixed(1)} m; leave-one-out ${cal.looErrorMetres?.toFixed(1) ?? 'n/a'} m; at ${cal.checkCount} independent checks ${cal.checkErrorMetres?.toFixed(1) ?? 'n/a'} m`);

  const { control, check: checks } = calibrationPairs();
  console.log('\n  Control points: representative coordinate (mean of the raw readings), spread, and error.');
  console.log('  id   readings  representative lat, lon    spread m   world x, z       fit err m (units)   leave-one-out m');
  for (const ref of parkGeoConfig.referencePoints) {
    const rep = referenceGps(ref);
    const w = referenceWorld(ref)!;
    if (!rep) {
      console.log(`  ${(ref.id ?? '?').padEnd(4)} no readings`);
      continue;
    }
    const fit = gpsToWorld(rep, cal);
    const err = Math.hypot(fit.x - w.x, fit.z - w.z);
    const others = control.filter((p) => p.id !== ref.id);
    const loo = others.length >= 2 ? buildCalibration({ ...parkGeoConfig, referencePoints: parkGeoConfig.referencePoints.filter((r) => r !== ref) }) : null;
    const lw = loo ? gpsToWorld(rep, loo) : null;
    const looM = lw && loo ? Math.hypot(lw.x - w.x, lw.z - w.z) * loo.metresPerUnit : NaN;
    const flag = rep.consistent ? '' : '  ← readings disagree: re-survey';
    console.log(
      `  ${(ref.id ?? '?').padEnd(4)} ${String(rep.readingCount).padStart(5)}${rep.dropped.length ? ` (-${rep.dropped.length})` : '     '}  ${rep.latitude.toFixed(6)}, ${rep.longitude.toFixed(6)}   ${f1(rep.spreadMetres)}    ${w.x.toFixed(1).padStart(6)}, ${w.z.toFixed(1).padStart(6)}   ${f1(err * mpu)} (${err.toFixed(1).padStart(4)})       ${f1(looM)}${flag}`,
    );
  }
  console.log('\n  R points (checks only; ride from the survey sheet, not yet confirmed). Distance from the ride\'s position on the 3D map:');
  console.log('  id   ride                      "coordinate" m (units)   "entranceFace" m   readings apart m   nearest place to "coordinate"');
  for (const r of parkGeoConfig.ridePoints ?? []) {
    const ride = ATTRACTIONS.find((a) => a.id === r.surveySheetPlace)!;
    const w = { x: ride.position[0], z: ride.position[2] };
    const c = gpsToWorld({ latitude: r.coordinate[0], longitude: r.coordinate[1] }, cal);
    const e = gpsToWorld({ latitude: r.entranceFace[0], longitude: r.entranceFace[1] }, cal);
    const dc = Math.hypot(c.x - w.x, c.z - w.z);
    const de = Math.hypot(e.x - w.x, e.z - w.z) * mpu;
    const apart = distanceMetres({ latitude: r.coordinate[0], longitude: r.coordinate[1] }, { latitude: r.entranceFace[0], longitude: r.entranceFace[1] });
    const nearest = [...ATTRACTIONS].sort((a, b) => Math.hypot(a.position[0] - c.x, a.position[2] - c.z) - Math.hypot(b.position[0] - c.x, b.position[2] - c.z))[0];
    console.log(
      `  ${r.id.padEnd(4)} ${`${ride.id} ${ride.name}`.padEnd(25)} ${f1(dc * mpu)} (${dc.toFixed(1).padStart(4)})          ${f1(de)}             ${f1(apart)}          ${nearest.id} ${nearest.name}${nearest.id === ride.id ? '' : '  ← not the sheet ride'}`,
    );
  }
  void checks;
  const worst = cal.looErrorMetres ?? 0;
  check('the calibration is labelled provisional until verified on site', cal.status === 'provisional' || cal.status === 'verified');
  check('expected error is reported, not hidden', worst > 0 && Number.isFinite(worst));
}

if (failed) {
  console.error(`\n${failed} check(s) failed`);
  process.exit(1);
}
console.log('\nAll geo checks passed.');
