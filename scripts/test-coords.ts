/** Checks the camera-relative movement maths. Run with: npm run test:coords */
import { cameraForward, cameraRight, clampPitch, joystickToWorld, ORBIT, worldBearing } from '../features/digital-park/lib/coords';

let failed = 0;
const check = (name: string, ok: boolean, detail = '') => {
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? '  ' + detail : ''}`);
};
const near = (a: number, b: number, tol = 1e-9) => Math.abs(a - b) <= tol;
const rad = (d: number) => (d * Math.PI) / 180;
const dot = (a: { x: number; z: number }, b: { x: number; z: number }) => a.x * b.x + a.z * b.z;

// The camera's default view looks up the map, which in this project is -z.
check('at 0° the camera looks up the map (-z), with +x on its right', near(cameraForward(0).z, -1) && near(cameraForward(0).x, 0) && near(cameraRight(0).x, 1) && near(cameraRight(0).z, 0));
const up0 = joystickToWorld(0, -1, 0);
check('at 0° stick up moves up the map, exactly as before orbit existed', near(up0.x, 0) && near(up0.z, -1));
const right0 = joystickToWorld(1, 0, 0);
check('at 0° stick right moves to +x, exactly as before', near(right0.x, 1) && near(right0.z, 0));

const STICK: [string, number, number][] = [
  ['up', 0, -1], ['down', 0, 1], ['left', -1, 0], ['right', 1, 0],
  ['up-right', Math.SQRT1_2, -Math.SQRT1_2], ['up-left', -Math.SQRT1_2, -Math.SQRT1_2],
  ['down-right', Math.SQRT1_2, Math.SQRT1_2], ['down-left', -Math.SQRT1_2, Math.SQRT1_2],
];
let worst = 0;
let lengths = true;
for (let a = 0; a < 360; a += 45) {
  const yaw = rad(a);
  const f = cameraForward(yaw);
  const r = cameraRight(yaw);
  for (const [, ix, iy] of STICK) {
    const w = joystickToWorld(ix, iy, yaw);
    // Seen from the camera, the movement must be exactly what the stick shows: right = ix, forward = -iy.
    worst = Math.max(worst, Math.abs(dot(w, r) - ix), Math.abs(dot(w, f) - -iy));
    lengths = lengths && near(Math.hypot(w.x, w.z), Math.hypot(ix, iy), 1e-9);
  }
}
check('at 0°, 45°, ... 315°, all 8 stick directions move exactly that way on screen', worst < 1e-9, `largest error ${worst.toExponential(1)}`);
check('diagonals are no faster than straight lines at any camera angle', lengths);

const up180 = joystickToWorld(0, -1, rad(180));
check('camera turned 180°: stick up now moves DOWN the map in world terms (forward on screen, not backward)', near(up180.z, 1) && near(up180.x, 0, 1e-9));
const up90 = joystickToWorld(0, -1, rad(90));
check('camera swung 90° round to +x: stick up moves towards -x (away from the camera)', near(up90.x, -1) && near(up90.z, 0, 1e-9));
check('forward and right stay perpendicular unit vectors', [0, 37, 123, 250].every((a) => near(dot(cameraForward(rad(a)), cameraRight(rad(a))), 0) && near(Math.hypot(cameraForward(rad(a)).x, cameraForward(rad(a)).z), 1)));
check('full turns change nothing', near(joystickToWorld(0.3, -0.8, rad(33)).x, joystickToWorld(0.3, -0.8, rad(33 + 720)).x, 1e-9));

check('bearings: up the map 0°, right 90°, down 180°, left 270°', near(worldBearing(0, -1), 0) && near(worldBearing(1, 0), 90) && near(worldBearing(0, 1), 180) && near(worldBearing(-1, 0), 270));
check('tilt is limited: never below the low limit, never overhead', clampPitch(-5) === ORBIT.minPitch && clampPitch(5) === ORBIT.maxPitch && ORBIT.minPitch > rad(15) && ORBIT.maxPitch < rad(85));

if (failed) {
  console.error(`\n${failed} check(s) failed`);
  process.exit(1);
}
console.log('\nAll coordinate checks passed.');
