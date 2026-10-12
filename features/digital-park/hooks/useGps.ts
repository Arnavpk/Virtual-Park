import { useCallback, useEffect, useRef, useState } from 'react';
import { METRES_PER_UNIT } from '../data/park';
import { parkGeoConfig } from '../data/parkGeoConfig';
import type { ParkLocation } from '../data/locations';
import type { Vec2 } from '../data/types';
import { PARK_CALIBRATION, anchorCalibration, bearingToWorld, gpsToWorld, isValidLatLon, worldToGps, type Calibration, type LatLon } from '../lib/geo';
import { createGpsFilter } from '../lib/gpsFilter';
import { distanceToPaving, nearestPaving } from '../lib/walkgrid';
import type { Game } from '../state/game';
import { startCompass } from './compass';

/**
 * GPS Mode: watches the device's location and feeds it to the player.
 *
 *   device (or the development simulator)
 *     → latitude / longitude / accuracy
 *     → validity and staleness checks
 *     → gpsToWorld()           (lib/geo.ts, using parkGeoConfig)          = raw position
 *     → QR correction          (only near a QR code scanned in GPS Mode)
 *     → createGpsFilter()      (lib/gpsFilter.ts: drops bad readings, steadies the rest) = filtered
 *     → park boundary check
 *     → onto the path          (only if within snapToPathMetres of it)     = displayed
 *     → game.gps.target        (the player glides there in PlayerController)
 *
 * The raw, filtered and displayed positions are all kept on game.gps.reading
 * so the development panel can show each one. Turning the camera never
 * touches any of them.
 *
 * QR codes: `anchor()` places the character at a known spot. In GPS Mode that
 * spot also measures how far off GPS is right there (the calibration error is
 * similar for nearby spots), and the difference is applied to readings within
 * a short walk of the code, fading out with distance and time. A scan is a
 * one-off fix, not tracking: after it, GPS alone moves the character.
 *
 * Privacy: readings stay in memory in this tab. Nothing is sent anywhere or
 * saved, and the watch is cleared when GPS Mode is switched off or the park
 * is closed.
 */

export type GpsStatus =
  | 'off'
  | 'locating' // watching, no usable reading yet
  | 'active' // following the visitor
  | 'weak' // following, but the reading is imprecise
  | 'poor' // readings too imprecise to use
  | 'outside' // the visitor is outside the mapped park
  | 'denied' // permission refused
  | 'unavailable' // the device can't work out a position right now
  | 'timeout'; // no reading arrived in time (still trying)

/** Reasons GPS Mode can't even start. */
export type GpsStartProblem = 'unsupported' | 'insecure' | 'uncalibrated';

export interface GpsSimulator {
  /** Walk the simulated visitor by this many metres. */
  nudge(northMetres: number, eastMetres: number): void;
  setAccuracy(metres: number): void;
  setJitter(on: boolean): void;
  /** Keep walking on this compass bearing at a normal pace, or null to stand still. */
  walk(bearing: number | null): void;
  readonly walking: number | null;
  readonly accuracy: number;
  readonly jitter: boolean;
}

// Ask for the best fix the phone can give, and never accept a stale cached one.
const WATCH_OPTIONS: PositionOptions = { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 };
const METRES_PER_DEGREE = 111194.93;
/** A QR correction applies in full this close to the code, fading to nothing at QR_FADE_METRES. */
const QR_FULL_METRES = 40;
const QR_FADE_METRES = 200;
const QR_LIFETIME_MS = 30 * 60 * 1000;
/** A GPS-vs-QR difference larger than this means something is wrong (wrong code, bad fix): don't learn from it. */
const QR_MAX_CORRECTION_METRES = 80;
/** With no recent reading at scan time, hold the character at the code while the next few readings arrive. */
const QR_LEARN_MS = 20000;
const QR_LEARN_SAMPLES = 3;

export type GpsAnchorResult = 'placed' | 'placed-corrected';

export function useGps(game: Game, devTools: boolean) {
  const [status, setStatusState] = useState<GpsStatus>('off');
  const [source, setSource] = useState<'device' | 'simulator' | null>(null);
  const [calibrationKind, setCalibrationKind] = useState<Calibration['kind'] | null>(PARK_CALIBRATION?.kind ?? null);
  const [simulator, setSimulator] = useState<GpsSimulator | null>(null);

  const statusRef = useRef<GpsStatus>('off');
  const stopRef = useRef<(() => void) | null>(null);
  const anchorRef = useRef<((loc: ParkLocation) => GpsAnchorResult) | null>(null);

  /** Only tell React when the status actually changes, not on every reading. */
  const setStatus = useCallback((s: GpsStatus) => {
    if (statusRef.current === s) return;
    statusRef.current = s;
    setStatusState(s);
  }, []);

  const stop = useCallback(() => {
    stopRef.current?.();
    stopRef.current = null;
    anchorRef.current = null;
    game.gps.mode = 'virtual';
    game.gps.target = null;
    game.gps.velocity = { x: 0, z: 0 };
    game.gps.facing = null;
    game.gps.accuracyUnits = 0;
    game.gps.reading = null;
    game.gps.listeners.forEach((l) => l());
    setSimulator(null);
    setSource(null);
    setCalibrationKind(PARK_CALIBRATION?.kind ?? null);
    setStatus('off');
  }, [game, setStatus]);

  // Stop watching if the park is closed while GPS Mode is on.
  useEffect(() => () => stopRef.current?.(), []);

  /**
   * Starts GPS Mode. Must be called from a tap, so the browser's permission
   * prompt is tied to something the visitor did. Returns a problem if it
   * can't start; otherwise the status moves to 'locating'.
   */
  const start = useCallback(
    (opts: { simulate?: boolean } = {}): GpsStartProblem | null => {
      const simulate = !!opts.simulate && devTools;
      if (!simulate) {
        if (typeof navigator === 'undefined' || !('geolocation' in navigator)) return 'unsupported';
        if (typeof window !== 'undefined' && window.isSecureContext === false) return 'insecure';
      }
      // Without real reference points there is nothing to map onto. In development a
      // temporary calibration is allowed, so the pipeline can be tried anywhere.
      if (!PARK_CALIBRATION && !devTools) return 'uncalibrated';

      stopRef.current?.();
      let calibration: Calibration | null = PARK_CALIBRATION;
      const filter = createGpsFilter(parkGeoConfig);
      let counts = { updates: 0, moves: 0, ignored: 0 };
      const notify = () => game.gps.listeners.forEach((l) => l());

      let compass: number | null = null;
      const isNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
      const usable = (accuracy: number) => accuracy <= parkGeoConfig.weakAboveMetres;
      let lastFixTime: number | null = null;
      /** Recent usable raw positions (world units), for measuring the GPS error when a QR code is scanned. */
      const recent: { x: number; z: number; at: number }[] = [];
      let qr: { world: Vec2; at: number; offset: Vec2 | null; learnUntil: number; samples: Vec2[] } | null = null;

      const qrCorrection = (raw: Vec2, mpu: number): Vec2 | null => {
        if (!qr || !qr.offset || performance.now() - qr.at > QR_LIFETIME_MS) return null;
        const away = Math.hypot(raw.x - qr.world.x, raw.z - qr.world.z) * mpu;
        const w = Math.min(1, Math.max(0, 1 - (away - QR_FULL_METRES) / (QR_FADE_METRES - QR_FULL_METRES)));
        return w > 0 ? { x: qr.offset.x * w, z: qr.offset.z * w } : null;
      };
      const learnFrom = (samples: Vec2[], mpu: number) => {
        if (!qr || !samples.length) return false;
        const mx = samples.reduce((a, p) => a + p.x, 0) / samples.length;
        const mz = samples.reduce((a, p) => a + p.z, 0) / samples.length;
        const offset = { x: qr.world.x - mx, z: qr.world.z - mz };
        if (Math.hypot(offset.x, offset.z) * mpu > QR_MAX_CORRECTION_METRES) return false;
        qr.offset = offset;
        return true;
      };

      const publish = (reading: Omit<NonNullable<Game['gps']['reading']>, 'updates' | 'moves' | 'ignored' | 'compass'>) => {
        game.gps.reading = { ...reading, ...counts, compass };
        notify();
      };

      /** `speed` in m/s and `course` as a compass bearing, when the device reports them (it often does only while moving). */
      const onFix = (fix: LatLon, accuracy: number, time: number, speed: number | null = null, course: number | null = null) => {
        counts.updates += 1;
        const base = { latitude: fix.latitude, longitude: fix.longitude, accuracy, speed: isNumber(speed) ? speed : null, course: isNumber(course) ? course : null };
        if (!isValidLatLon(fix) || !isNumber(accuracy) || accuracy <= 0) {
          // A broken reading (NaN, 0°/0°, no accuracy). Never shown as a position.
          counts.ignored += 1;
          publish({ ...base, x: NaN, z: NaN, filtered: null, displayed: null, snappedMetres: 0, qrCorrectionMetres: null, outcome: 'ignored-invalid' });
          return;
        }
        if (!calibration) {
          // Development only: pin this first real reading to where the character is standing,
          // map north-up at the estimated scale. NOT the park's real calibration.
          calibration = anchorCalibration(fix, { x: game.player.x, z: game.player.z }, METRES_PER_UNIT, 0, 'test');
          setCalibrationKind('test');
        }
        const mpu = calibration.metresPerUnit;
        const raw = gpsToWorld(fix, calibration);
        const now = performance.now();
        if (usable(accuracy)) {
          recent.push({ x: raw.x, z: raw.z, at: now });
          while (recent.length && now - recent[0].at > 10000) recent.shift();
        }

        // Just after a QR scan with no reading to compare against: keep the character at the
        // code while a few readings arrive, then learn how far off GPS is here.
        if (qr && !qr.offset && now < qr.learnUntil) {
          if (usable(accuracy)) qr.samples.push(raw);
          if (qr.samples.length >= QR_LEARN_SAMPLES) {
            learnFrom(qr.samples, mpu);
            qr.learnUntil = 0;
          } else {
            lastFixTime = time;
            publish({ ...base, x: raw.x, z: raw.z, filtered: null, displayed: qr.world, snappedMetres: 0, qrCorrectionMetres: null, outcome: 'held-qr' });
            return;
          }
        }

        const corr = qrCorrection(raw, mpu);
        const corrected = corr ? { x: raw.x + corr.x, z: raw.z + corr.z } : raw;
        // The filter works in metres, so its thresholds mean the same thing whatever the park's scale.
        const result = filter.push({ x: corrected.x * mpu, z: corrected.z * mpu }, accuracy, time, {
          speed: isNumber(speed) ? speed : null,
          course: isNumber(course) && isNumber(speed) && speed > 0.4 ? bearingToWorld(course, calibration) : null,
        });
        if (result.status !== 'ignored') lastFixTime = time;

        let outcome: NonNullable<Game['gps']['reading']>['outcome'];
        let filtered: Vec2 | null = null;
        let displayed: Vec2 | null = null;
        let snappedMetres = 0;
        if (result.status === 'ignored') {
          counts.ignored += 1;
          outcome = result.reason === 'poor-accuracy' ? 'ignored-poor' : result.reason === 'stale' ? 'ignored-stale' : 'ignored-glitch';
          if (result.reason === 'poor-accuracy') {
            game.gps.velocity = { x: 0, z: 0 };
            setStatus('poor');
          }
        } else {
          filtered = { x: result.position.x / mpu, z: result.position.z / mpu };
          if (distanceToPaving(filtered.x, filtered.z) * mpu > parkGeoConfig.boundaryMarginMetres) {
            // Outside the park: leave the character at the last valid spot.
            outcome = 'outside';
            game.gps.velocity = { x: 0, z: 0 };
            setStatus('outside');
          } else {
            // Within a few metres of a path: walk on it. Further away: stay exactly where GPS says.
            const snap = parkGeoConfig.snapToPathMetres ?? 0;
            const onPath = snap > 0 ? nearestPaving(filtered.x, filtered.z, snap / mpu) : null;
            displayed = onPath ?? filtered;
            snappedMetres = Math.hypot(displayed.x - filtered.x, displayed.z - filtered.z) * mpu;
            outcome = result.status;
            if (result.status === 'moved') counts.moves += 1;
            game.gps.target = displayed;
            game.gps.velocity = { x: result.velocity.x / mpu, z: result.velocity.z / mpu };
            game.gps.targetAt = performance.now();
            game.gps.accuracyUnits = accuracy / mpu;
            setStatus(accuracy > parkGeoConfig.weakAboveMetres ? 'weak' : 'active');
          }
        }
        publish({
          ...base,
          x: raw.x,
          z: raw.z,
          filtered,
          displayed,
          snappedMetres,
          qrCorrectionMetres: corr ? Math.hypot(corr.x, corr.z) * mpu : null,
          outcome,
        });
      };

      /** A reading the phone reports as taken long ago (e.g. cached from before the screen locked). */
      const onStale = (fix: LatLon, accuracy: number) => {
        counts.updates += 1;
        counts.ignored += 1;
        const raw = calibration && isValidLatLon(fix) ? gpsToWorld(fix, calibration) : { x: NaN, z: NaN };
        publish({ latitude: fix.latitude, longitude: fix.longitude, accuracy, speed: null, course: null, x: raw.x, z: raw.z, filtered: null, displayed: null, snappedMetres: 0, qrCorrectionMetres: null, outcome: 'ignored-stale' });
      };

      /** Places the character at a scanned QR code's spot (see the note at the top). */
      anchorRef.current = (loc: ParkLocation) => {
        const now = performance.now();
        qr = { world: { ...loc.world }, at: now, offset: null, learnUntil: 0, samples: [] };
        const mpu = calibration?.metresPerUnit ?? METRES_PER_UNIT;
        // The last few readings only: the visitor is standing at the code now, but may have been walking up to it.
        const fresh = recent.filter((r) => now - r.at < 5000).slice(-3);
        let corrected = false;
        if (fresh.length) corrected = learnFrom(fresh, mpu);
        else qr.learnUntil = now + QR_LEARN_MS;
        filter.anchor({ x: loc.world.x * mpu, z: loc.world.z * mpu }, loc.accuracyMetres, lastFixTime ?? 0);
        game.gps.target = { ...loc.world };
        game.gps.velocity = { x: 0, z: 0 };
        game.gps.targetAt = now;
        // Jump straight there rather than gliding across the park.
        game.player.x = loc.world.x;
        game.player.z = loc.world.z;
        notify();
        return corrected ? 'placed-corrected' : 'placed';
      };

      /** The phone's compass: lets the character face the way the visitor is facing. */
      const onCompass = (bearing: number) => {
        compass = bearing;
        if (!calibration) return;
        game.gps.facing = bearingToWorld(bearing, calibration);
        game.gps.facingAt = performance.now();
      };

      game.gps.mode = 'gps';
      game.gps.target = null;
      game.gps.velocity = { x: 0, z: 0 };
      game.gps.facing = null;
      game.nav.active = false;
      setStatus('locating');

      if (simulate) {
        if (!calibration) {
          // The simulator needs coordinates to report. These are synthetic (0°, 0°), not the park's.
          calibration = anchorCalibration({ latitude: 0, longitude: 0 }, { x: game.player.x, z: game.player.z }, METRES_PER_UNIT, 0, 'test');
        }
        setCalibrationKind(calibration.kind);
        const here = worldToGps({ x: game.player.x, z: game.player.z }, calibration);
        const sim = { latitude: here.latitude, longitude: here.longitude, accuracy: 6, jitter: false, tick: 0, walking: null as number | null };
        const WALK = 1.4; // metres per second
        const step = (northMetres: number, eastMetres: number) => {
          sim.latitude += northMetres / METRES_PER_DEGREE;
          sim.longitude += eastMetres / (METRES_PER_DEGREE * Math.cos((sim.latitude * Math.PI) / 180));
        };
        const emit = () => {
          sim.tick += 1;
          if (sim.walking !== null) step(Math.cos((sim.walking * Math.PI) / 180) * WALK, Math.sin((sim.walking * Math.PI) / 180) * WALK);
          // Deterministic wobble so tests are repeatable.
          const wobble = sim.jitter ? sim.accuracy * 0.5 : 0;
          const north = Math.sin(sim.tick * 1.7) * wobble;
          const east = Math.cos(sim.tick * 2.3) * wobble;
          onFix(
            {
              latitude: sim.latitude + north / METRES_PER_DEGREE,
              longitude: sim.longitude + east / (METRES_PER_DEGREE * Math.cos((sim.latitude * Math.PI) / 180)),
            },
            sim.accuracy,
            performance.now(),
            // Like a real phone: speed and direction are reported while walking, not for one-off steps.
            sim.walking !== null ? WALK : null,
            sim.walking,
          );
          if (sim.walking !== null) onCompass(sim.walking);
        };
        const timer = window.setInterval(emit, 1000);
        window.setTimeout(emit, 300);
        stopRef.current = () => window.clearInterval(timer);
        setSimulator({
          nudge(northMetres, eastMetres) {
            step(northMetres, eastMetres);
          },
          walk(bearing) {
            sim.walking = bearing;
          },
          get walking() {
            return sim.walking;
          },
          setAccuracy(metres) {
            sim.accuracy = metres;
          },
          setJitter(on) {
            sim.jitter = on;
          },
          get accuracy() {
            return sim.accuracy;
          },
          get jitter() {
            return sim.jitter;
          },
        });
        setSource('simulator');
        return null;
      }

      // ---- The real thing: continuous updates from the device.
      let watchId: number | null = null;
      let staleInARow = 0;
      const staleMs = (parkGeoConfig.staleAfterSeconds ?? 30) * 1000;
      const watch = () => {
        if (watchId !== null) navigator.geolocation.clearWatch(watchId);
        watchId = navigator.geolocation.watchPosition(
          (pos) => {
            const fix = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
            // Only judge age when the timestamp is a normal clock time, and never reject more than a
            // few in a row: if the phone's clock is off, a "stale" stream is better than none.
            const age = Date.now() - pos.timestamp;
            if (pos.timestamp > 1e12 && age > staleMs && staleInARow < 3) {
              staleInARow += 1;
              onStale(fix, pos.coords.accuracy);
              return;
            }
            staleInARow = 0;
            onFix(fix, pos.coords.accuracy, pos.timestamp, pos.coords.speed, pos.coords.heading);
          },
          (err) => {
            if (err.code === err.PERMISSION_DENIED) {
              // No point watching further; the visitor has to change a setting first.
              if (watchId !== null) navigator.geolocation.clearWatch(watchId);
              watchId = null;
              setStatus('denied');
            } else if (err.code === err.TIMEOUT) setStatus('timeout');
            else setStatus('unavailable');
          },
          WATCH_OPTIONS,
        );
      };
      // Phones pause location updates while the screen is locked or the tab is hidden.
      // Start a fresh watch when the visitor comes back, so the position catches up at once.
      const onVisible = () => {
        if (document.visibilityState === 'visible' && statusRef.current !== 'denied') watch();
      };
      document.addEventListener('visibilitychange', onVisible);
      watch();
      // Asked for in the same tap as the location, so iPhones can show their motion prompt.
      const stopCompass = startCompass(onCompass);
      stopRef.current = () => {
        stopCompass();
        document.removeEventListener('visibilitychange', onVisible);
        if (watchId !== null) navigator.geolocation.clearWatch(watchId);
        watchId = null;
      };
      setSource('device');
      return null;
    },
    [devTools, game, setStatus],
  );

  /** Places the character at a scanned location in GPS Mode. Returns null when GPS Mode isn't running. */
  const anchor = useCallback((loc: ParkLocation): GpsAnchorResult | null => anchorRef.current?.(loc) ?? null, []);

  return { status, source, calibrationKind, simulator, start, stop, anchor };
}

/** Re-renders the calling component whenever a new GPS reading arrives (about once a second in GPS Mode). */
export function useGpsReading(game: Game) {
  const [, bump] = useState(0);
  useEffect(() => {
    const listener = () => bump((n) => n + 1);
    game.gps.listeners.add(listener);
    return () => {
      game.gps.listeners.delete(listener);
    };
  }, [game]);
  return game.gps.reading;
}
