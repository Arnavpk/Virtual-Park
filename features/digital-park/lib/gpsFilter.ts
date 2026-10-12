import type { Vec2 } from '../data/types';

/**
 * Steadies raw GPS readings without making the character lag behind.
 *
 * The filter keeps two things: where the visitor is and how fast they are
 * going. Between readings it carries the position forward at that speed, so a
 * visitor walking in a straight line is followed closely instead of trailing
 * a few seconds behind. Working in metres:
 *
 *  - every reading comes with its own accuracy; less accurate readings pull
 *    the estimate less;
 *  - while the visitor is walking, readings are trusted more and every change
 *    is passed on; while they stand still, small wobbles are suppressed;
 *  - "walking" is taken from the speed the phone reports when it gives one,
 *    and otherwise from readings that keep pulling the same way;
 *  - readings worse than `ignoreAboveMetres` are dropped;
 *  - a reading far from the estimate is treated as a glitch at first, and as
 *    a real move if the next few readings agree with it;
 *  - a reading older than the last one used (out of order) is dropped;
 *  - `anchor()` pins the estimate to a known spot (a scanned QR code), with
 *    its own small uncertainty, so later readings pull it away only as far
 *    and as fast as their accuracy justifies.
 */

export interface GpsFilterOptions {
  ignoreAboveMetres: number;
  minMoveMetres: number;
  walkingMetresPerSecond: number;
}

/** Extra facts some phones report with a reading. Both are optional. */
export interface MotionHint {
  /** Ground speed in metres per second, if the phone reports it. */
  speed?: number | null;
  /** Unit vector of the direction of travel on the same plane as the positions, if known. */
  course?: Vec2 | null;
}

export type FilterResult =
  | { status: 'moved'; position: Vec2; velocity: Vec2; accuracy: number; jumped: boolean }
  | { status: 'steady'; position: Vec2; velocity: Vec2; accuracy: number }
  | { status: 'ignored'; reason: 'poor-accuracy' | 'glitch' | 'stale'; accuracy: number };

const JUMP_METRES = 60;
const JUMP_CONFIRMATIONS = 3;
const MAX_SPEED = 3.5; // m/s: a run. Faster than this is noise, not a visitor.
const ZERO: Vec2 = { x: 0, z: 0 };

/** Positions in and out are in metres on a flat local plane (x east, z south, or any rotation of it). */
export function createGpsFilter(options: GpsFilterOptions) {
  let estimate: Vec2 | null = null;
  let velocity: Vec2 = { ...ZERO };
  let variance = 0; // metres²
  let lastTime = 0;
  let published: Vec2 | null = null;
  let jumps = 0;
  let lastPull: Vec2 = { ...ZERO };
  let pulls = 0; // readings in a row that pulled the estimate the same way

  const restart = (measured: Vec2, acc: number, time: number) => {
    estimate = { ...measured };
    velocity = { ...ZERO };
    variance = acc * acc;
    lastTime = time;
    published = { ...measured };
    jumps = 0;
    pulls = 0;
  };

  return {
    reset() {
      estimate = null;
      published = null;
    },

    /**
     * Pins the estimate to a known position (metres), e.g. from a QR code at a
     * surveyed spot. `accuracy` is how sure that position is, in metres. The
     * visitor is assumed to be standing still while scanning.
     */
    anchor(position: Vec2, accuracy: number, time: number) {
      restart(position, Math.max(accuracy, 1), time);
      velocity = { ...ZERO };
      lastPull = { ...ZERO };
    },

    /** The current estimate in metres, or null before the first reading. */
    get estimate(): Vec2 | null {
      return estimate ? { ...estimate } : null;
    },

    /** `time` in milliseconds. */
    push(measured: Vec2, accuracy: number, time: number, hint: MotionHint = {}): FilterResult {
      const acc = Math.max(accuracy, 1);
      if (!Number.isFinite(accuracy) || accuracy > options.ignoreAboveMetres) {
        return { status: 'ignored', reason: 'poor-accuracy', accuracy };
      }
      if (!Number.isFinite(measured.x) || !Number.isFinite(measured.z) || !Number.isFinite(time)) {
        return { status: 'ignored', reason: 'stale', accuracy };
      }
      if (estimate && time < lastTime) return { status: 'ignored', reason: 'stale', accuracy };
      if (!estimate || !published) {
        restart(measured, acc, time);
        return { status: 'moved', position: { ...measured }, velocity: { ...ZERO }, accuracy, jumped: true };
      }

      const dt = Math.min(Math.max(0, (time - lastTime) / 1000), 10);

      // A reading far beyond what walking and the stated accuracy allow.
      const gap = Math.hypot(measured.x - estimate.x, measured.z - estimate.z);
      if (gap > JUMP_METRES + acc + dt * options.walkingMetresPerSecond * 3) {
        jumps += 1;
        if (jumps < JUMP_CONFIRMATIONS) return { status: 'ignored', reason: 'glitch', accuracy };
        // Several readings in a row agree: the visitor really is over there (e.g. the phone woke from sleep).
        restart(measured, acc, time);
        return { status: 'moved', position: { ...measured }, velocity: { ...ZERO }, accuracy, jumped: true };
      }
      jumps = 0;

      // 1. Carry the estimate forward at the current speed.
      const predicted = { x: estimate.x + velocity.x * dt, z: estimate.z + velocity.z * dt };
      const pull = { x: measured.x - predicted.x, z: measured.z - predicted.z };
      const pullLength = Math.hypot(pull.x, pull.z);

      // 2. Is the visitor walking?
      const sameWay = pull.x * lastPull.x + pull.z * lastPull.z > 0;
      pulls = pullLength > acc * 0.35 && sameWay ? pulls + 1 : 0;
      lastPull = pull;
      const reported = typeof hint.speed === 'number' && Number.isFinite(hint.speed) ? hint.speed : null;
      const walking = reported !== null ? reported > 0.4 : pulls >= 2 || Math.hypot(velocity.x, velocity.z) > 0.6;

      // 3. Blend the reading in. Uncertainty grows with time, and faster when walking.
      const drift = options.walkingMetresPerSecond * (walking ? 2 : 0.6);
      variance += dt * drift * drift * Math.max(dt, 1);
      let gain = variance / (variance + acc * acc);
      if (walking) gain = Math.max(gain, 0.4);
      estimate = { x: predicted.x + gain * pull.x, z: predicted.z + gain * pull.z };
      variance = (1 - gain) * variance;
      lastTime = time;

      // 4. Update the speed. A reading that pulls against the direction of travel means the
      //    visitor has slowed, stopped or turned: shed speed at once so the character doesn't overshoot.
      if (pull.x * velocity.x + pull.z * velocity.z < 0 && pullLength > acc * 0.25) {
        velocity = { x: velocity.x * 0.3, z: velocity.z * 0.3 };
      }
      if (reported !== null && hint.course && reported > 0.4) {
        // The phone knows its own speed and direction better than differences between noisy positions.
        const want = { x: hint.course.x * reported, z: hint.course.z * reported };
        velocity = { x: velocity.x + 0.7 * (want.x - velocity.x), z: velocity.z + 0.7 * (want.z - velocity.z) };
      } else if (walking && dt > 0) {
        const k = (0.45 * gain) / dt;
        velocity = { x: velocity.x + k * pull.x, z: velocity.z + k * pull.z };
      } else {
        // Standing still: let any leftover speed die away quickly.
        velocity = { x: velocity.x * 0.4, z: velocity.z * 0.4 };
      }
      const speed = Math.hypot(velocity.x, velocity.z);
      if (speed > MAX_SPEED) velocity = { x: (velocity.x / speed) * MAX_SPEED, z: (velocity.z / speed) * MAX_SPEED };
      if (speed < 0.15) velocity = { ...ZERO };

      // 5. Pass it on. While walking, always; while standing, only past the noise threshold.
      const moved = Math.hypot(estimate.x - published.x, estimate.z - published.z);
      if (!walking && moved < Math.max(options.minMoveMetres, acc * 0.2)) {
        return { status: 'steady', position: { ...published }, velocity: { ...ZERO }, accuracy };
      }
      published = { ...estimate };
      return { status: 'moved', position: { ...published }, velocity: { ...velocity }, accuracy, jumped: false };
    },
  };
}
