import { createContext, useContext } from 'react';
import { ORBIT } from '../lib/coords';
import { START } from '../lib/layout';
import type { Vec2 } from '../data/types';

/**
 * Per-frame state lives here, outside React, so walking around never causes a
 * re-render. Scene components read and write it inside useFrame; the UI only
 * hears about it through the two callbacks in `events`.
 */
export interface Game {
  player: {
    x: number;
    z: number;
    heading: number;
    pace: number;
    /** The world-space direction the player last moved in (zero when still). For the debug view. */
    moveX: number;
    moveZ: number;
  };
  input: {
    joyX: number;
    joyY: number;
    joyActive: boolean;
    keyX: number;
    keyY: number;
    tiltX: number;
    tiltY: number;
    tiltOn: boolean;
  };
  /** Guided walking: the character follows `route` point by point. */
  nav: { route: Vec2[] | null; index: number; active: boolean; stalled: number };
  events: { onArrive?: () => void; onGuideInterrupted?: () => void };
  /** DOM labels (map pins, the "You" tag) that the scene positions every frame. */
  overlay: Map<string, HTMLElement>;
  /**
   * Camera adjustments on top of the follow view. `zoom` multiplies the
   * default magnification (see ZOOM). `focus` is a place the camera looks at
   * for a moment after it is chosen, until `focusUntil` (a performance.now() time).
   */
  view: {
    zoom: number;
    focus: Vec2 | null;
    focusUntil: number;
    /** Orbit the visitor asked for (drag, reset button): swing round the player and tilt, in radians. */
    yaw: number;
    pitch: number;
    /** The orbit actually on screen this frame, eased towards the above. Movement uses this one, so the stick always matches what is seen. */
    yawNow: number;
    pitchNow: number;
    /** Development only: draw direction arrows in the scene. */
    debug: boolean;
  };
  /**
   * Where the player's position comes from. In 'virtual' mode the joystick
   * (or guided walking) moves the player. In 'gps' mode the player glides
   * towards `target`, the visitor's real position mapped into the park.
   * GPS readings land here without touching React; the few components that
   * show them subscribe with `listeners`.
   */
  gps: {
    mode: 'virtual' | 'gps';
    target: Vec2 | null;
    /** How fast the visitor is moving, in world units per second, so the character can keep going between readings. */
    velocity: Vec2;
    /** When `target` was set (performance.now()). */
    targetAt: number;
    /** The way the phone is pointing as a direction in the park, from its compass, or null if unknown. */
    facing: Vec2 | null;
    facingAt: number;
    /** Radius of the accuracy circle drawn under the character, in world units. 0 hides it. */
    accuracyUnits: number;
    reading: GpsReading | null;
    listeners: Set<() => void>;
  };
}

/** The latest GPS reading and what was done with it. Shown in the status chip and the development panel. */
export interface GpsReading {
  latitude: number;
  longitude: number;
  /** As reported by the device, in metres. */
  accuracy: number;
  /** Where the raw reading maps to in the park, before any correction or smoothing. NaN for an invalid reading. */
  x: number;
  z: number;
  /** After the QR correction (if any) and smoothing; null if the reading wasn't used. */
  filtered: Vec2 | null;
  /** Where the character is sent: the filtered position, pulled onto the path if it was within a few metres of it. */
  displayed: Vec2 | null;
  /** How far `displayed` was pulled from `filtered`, in metres (0 = not moved). */
  snappedMetres: number;
  /** Size of the local correction learnt from a QR scan, in metres, or null if none applies. */
  qrCorrectionMetres: number | null;
  outcome: 'moved' | 'steady' | 'held-qr' | 'ignored-poor' | 'ignored-glitch' | 'ignored-invalid' | 'ignored-stale' | 'outside';
  updates: number;
  moves: number;
  ignored: number;
  /** Speed in m/s and direction of travel as a compass bearing, when the device reports them. */
  speed: number | null;
  course: number | null;
  /** Compass bearing the phone is pointing, when it has a compass. */
  compass: number | null;
}

/** Zoom limits for the follow camera, as multiples of its default magnification. */
export const ZOOM = { min: 0.4, max: 2.2, step: 1.4 };
export const clampZoom = (z: number) => Math.max(ZOOM.min, Math.min(ZOOM.max, z));

export function createGame(): Game {
  return {
    player: { x: START.x, z: START.z, heading: -Math.PI / 2, pace: 0, moveX: 0, moveZ: 0 },
    input: { joyX: 0, joyY: 0, joyActive: false, keyX: 0, keyY: 0, tiltX: 0, tiltY: 0, tiltOn: false },
    nav: { route: null, index: 0, active: false, stalled: 0 },
    events: {},
    overlay: new Map(),
    view: { zoom: 1, focus: null, focusUntil: 0, yaw: 0, pitch: ORBIT.pitch, yawNow: 0, pitchNow: ORBIT.pitch, debug: false },
    gps: {
      mode: 'virtual',
      target: null,
      velocity: { x: 0, z: 0 },
      targetAt: 0,
      facing: null,
      facingAt: 0,
      accuracyUnits: 0,
      reading: null,
      listeners: new Set(),
    },
  };
}

export const GameContext = createContext<Game | null>(null);

export function useGame(): Game {
  const game = useContext(GameContext);
  if (!game) throw new Error('useGame must be used inside <DigitalPark>');
  return game;
}
