import { useFrame } from '@react-three/fiber';
import { moveWithCollision } from '../lib/collision';
import { joystickToWorld } from '../lib/coords';
import { useGame } from '../state/game';

/** World units per second. The real park is large, so the visitor moves at a brisk game pace rather than a true walk. */
export const WALK_SPEED = 9;
const DEAD_ZONE = 0.12;
/** In GPS Mode: beyond this many units the character jumps to the new position instead of gliding. */
const GPS_SNAP_DISTANCE = 30;
const GPS_MAX_SPEED = 14;
/** How long the character keeps walking on its last known speed when no new reading has arrived. */
const GPS_COAST_SECONDS = 1.6;
const compassFresh = (gps: { facing: unknown; facingAt: number }) => !!gps.facing && performance.now() - gps.facingAt < 3000;

/** Shortest signed difference between two angles. */
function angleDelta(from: number, to: number) {
  return ((to - from + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
}

/**
 * Movement logic only — no rendering. The player's position has two possible
 * sources. In Virtual Mode it reads the joystick, keyboard and tilt inputs (in
 * that order of priority), or follows the guided route, through the collision
 * system. In GPS Mode it follows the visitor's real position instead.
 */
export function PlayerController() {
  const game = useGame();

  useFrame((_, delta) => {
    // Cap the step so a dropped frame can never tunnel through a thin obstacle.
    const dt = Math.min(delta, 0.1);
    const { player, input, nav, gps } = game;

    // GPS Mode: the visitor's real position drives the character. The joystick,
    // keys, tilt and guided walking are all ignored, and there is no collision:
    // the character goes wherever the visitor really is.
    if (gps.mode === 'gps') {
      let speed = 0;
      let turned = false;
      player.moveX = 0;
      player.moveZ = 0;
      if (gps.target) {
        // Between readings (about one a second) carry on at the visitor's last known
        // speed, so the character walks continuously instead of in one-second hops.
        const age = Math.min((performance.now() - gps.targetAt) / 1000, GPS_COAST_SECONDS);
        const tx = gps.target.x + gps.velocity.x * age;
        const tz = gps.target.z + gps.velocity.z * age;
        const dx = tx - player.x;
        const dz = tz - player.z;
        const d = Math.hypot(dx, dz);
        if (d > GPS_SNAP_DISTANCE) {
          // First fix, or a confirmed jump: appear there rather than sprint across the park.
          player.x = tx;
          player.z = tz;
        } else if (d > 0.02) {
          // Close the gap briskly when behind, ease in when near. Never overshoot.
          speed = Math.min(Math.max(d * 3.5, 1.2), GPS_MAX_SPEED);
          const step = Math.min(d, speed * dt);
          player.x += (dx / d) * step;
          player.z += (dz / d) * step;
          player.moveX = (dx / d) * speed;
          player.moveZ = (dz / d) * speed;
          if (d > 0.4 && !compassFresh(gps)) {
            player.heading += angleDelta(player.heading, Math.atan2(dx, dz)) * Math.min(1, dt * 8);
            turned = true;
          }
        }
      }
      // Face the way the phone is pointing when it has a compass; otherwise the direction of travel (above).
      if (!turned && gps.facing && compassFresh(gps)) {
        player.heading += angleDelta(player.heading, Math.atan2(gps.facing.x, gps.facing.z)) * Math.min(1, dt * 6);
      }
      const pace = speed > 0.3 ? Math.max(0.45, Math.min(1, speed / WALK_SPEED)) : 0;
      player.pace += (pace - player.pace) * Math.min(1, dt * 10);
      return;
    }

    // 1. Manual input, in screen axes: x = right on the screen, y = down the screen.
    let ix = 0;
    let iy = 0;
    if (input.joyActive) {
      ix = input.joyX;
      iy = input.joyY;
    } else if (input.keyX || input.keyY) {
      ix = input.keyX;
      iy = input.keyY;
    } else if (input.tiltOn) {
      ix = input.tiltX;
      iy = input.tiltY;
    }
    let mag = Math.hypot(ix, iy);
    if (mag < DEAD_ZONE) {
      ix = iy = mag = 0;
    } else if (mag > 1) {
      // Normalise so diagonals are never faster than straight lines.
      ix /= mag;
      iy /= mag;
      mag = 1;
    }

    let vx = 0;
    let vz = 0;

    if (mag > 0) {
      if (nav.active) {
        nav.active = false;
        game.events.onGuideInterrupted?.();
      }
      // Screen input means nothing until it is read against the camera: "up" on the stick is
      // away from the camera, wherever the camera has been swung to.
      const dir = joystickToWorld(ix, iy, game.view.yawNow);
      vx = dir.x * WALK_SPEED;
      vz = dir.z * WALK_SPEED;
    } else if (nav.active && nav.route) {
      // 2. Guided walking along the highlighted route.
      let target = nav.route[nav.index];
      while (target && Math.hypot(target.x - player.x, target.z - player.z) < 0.2) {
        nav.index += 1;
        target = nav.route[nav.index];
      }
      if (!target) {
        nav.active = false;
        game.events.onArrive?.();
      } else {
        const dx = target.x - player.x;
        const dz = target.z - player.z;
        const d = Math.hypot(dx, dz);
        const speed = Math.min(WALK_SPEED * 0.92, d / dt);
        vx = (dx / d) * speed;
        vz = (dz / d) * speed;
      }
    }

    const moving = vx !== 0 || vz !== 0;
    player.moveX = vx;
    player.moveZ = vz;
    if (moving) {
      const next = moveWithCollision(player, vx * dt, vz * dt);
      const moved = Math.hypot(next.x - player.x, next.z - player.z);
      player.x = next.x;
      player.z = next.z;

      const targetHeading = Math.atan2(vx, vz);
      player.heading += angleDelta(player.heading, targetHeading) * Math.min(1, dt * 12);

      // If guided walking gets wedged against something, hand control back.
      if (nav.active) {
        nav.stalled = moved < 0.2 * WALK_SPEED * dt ? nav.stalled + dt : 0;
        if (nav.stalled > 0.8) {
          nav.active = false;
          nav.stalled = 0;
          game.events.onGuideInterrupted?.();
        }
      }
    }

    const targetPace = moving ? Math.max(0.45, Math.min(1, Math.hypot(vx, vz) / WALK_SPEED)) : 0;
    player.pace += (targetPace - player.pace) * Math.min(1, dt * 10);
  });

  return null;
}
