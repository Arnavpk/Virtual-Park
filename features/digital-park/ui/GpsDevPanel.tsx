import { useState } from 'react';
import { type GpsSimulator, type GpsStatus, useGpsReading } from '../hooks/useGps';
import { PARK_CALIBRATION, type Calibration } from '../lib/geo';
import { useGame } from '../state/game';

const STEP = 5; // metres per tap
const xz = (p: { x: number; z: number }) => `${p.x.toFixed(1)}, ${p.z.toFixed(1)}`;

/**
 * DEVELOPMENT ONLY. Never rendered for visitors (see `devTools` in DigitalPark).
 *
 * Shows what the GPS pipeline is doing and, when the simulator is the source,
 * lets a developer walk a pretend visitor around to check that a change in
 * latitude/longitude moves the character.
 */
export function GpsDevPanel({
  status,
  source,
  calibrationKind,
  simulator,
}: {
  status: GpsStatus;
  source: 'device' | 'simulator' | null;
  calibrationKind: Calibration['kind'] | null;
  simulator: GpsSimulator | null;
}) {
  const game = useGame();
  const reading = useGpsReading(game);
  // The readout starts closed so the panel doesn't sit on top of the character.
  const [open, setOpen] = useState(false);
  const [, refresh] = useState(0);
  const cal = PARK_CALIBRATION;

  const row = (label: string, value: string) => (
    <>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </>
  );

  return (
    <section className={`dp-dev${open ? ' is-open' : ''}`} aria-label="GPS development tools">
      <button type="button" className="dp-dev__toggle" onClick={() => setOpen(!open)} aria-expanded={open}>
        GPS debug {open ? '▾' : '▸'}
      </button>
      {open && (
          <dl className="dp-dev__list">
            {row('Mode', game.gps.mode === 'gps' ? `GPS (${source ?? '-'})` : 'Virtual')}
            {row('Status', status)}
            {row('Latitude', reading ? reading.latitude.toFixed(6) : '-')}
            {row('Longitude', reading ? reading.longitude.toFixed(6) : '-')}
            {row('Accuracy', reading ? `${reading.accuracy.toFixed(1)} m` : '-')}
            {row('Raw (map)', reading && Number.isFinite(reading.x) ? xz(reading) : '-')}
            {row('QR correction', reading?.qrCorrectionMetres != null ? `${reading.qrCorrectionMetres.toFixed(1)} m` : 'none')}
            {row('Filtered', reading?.filtered ? xz(reading.filtered) : '-')}
            {row('Displayed', reading?.displayed ? `${xz(reading.displayed)}${reading.snappedMetres > 0.05 ? ` (onto path ${reading.snappedMetres.toFixed(1)} m)` : ''}` : '-')}
            {row('Player', xz(game.player))}
            {row('Speed', reading && reading.speed !== null ? `${reading.speed.toFixed(1)} m/s` : 'not reported')}
            {row('Course', reading && reading.course !== null ? `${reading.course.toFixed(0)}°` : 'not reported')}
            {row('Compass', reading && reading.compass !== null ? `${reading.compass.toFixed(0)}°` : 'none')}
            {row('Last reading', reading ? reading.outcome : '-')}
            {row('GPS updates', reading ? `${reading.updates} (${reading.moves} moved, ${reading.ignored} ignored)` : '0')}
            {row(
              'Calibration',
              calibrationKind === 'test'
                ? 'TEST (not the real park)'
                : cal
                  ? `${cal.status}, ${cal.pointCount} pt, ${cal.metresPerUnit.toFixed(3)} m/unit, up=${cal.northUpDeg.toFixed(1)}°, fit ${cal.fitErrorMetres.toFixed(1)} m, LOO ${cal.looErrorMetres?.toFixed(1) ?? '-'} m, checks ${cal.checkErrorMetres?.toFixed(1) ?? '-'} m`
                  : 'none: fill in parkGeoConfig',
            )}
          </dl>
      )}

      {simulator && (
            <div className="dp-dev__sim">
              <p className="dp-dev__heading">Simulator, {STEP} m a tap</p>
              <div className="dp-dev__pad">
                <button type="button" style={{ gridArea: 'n' }} onClick={() => simulator.nudge(STEP, 0)} aria-label="Walk north">
                  N
                </button>
                <button type="button" style={{ gridArea: 'w' }} onClick={() => simulator.nudge(0, -STEP)} aria-label="Walk west">
                  W
                </button>
                <button type="button" style={{ gridArea: 'e' }} onClick={() => simulator.nudge(0, STEP)} aria-label="Walk east">
                  E
                </button>
                <button type="button" style={{ gridArea: 's' }} onClick={() => simulator.nudge(-STEP, 0)} aria-label="Walk south">
                  S
                </button>
              </div>
              <div className="dp-dev__row">
                {[6, 35, 90].map((m) => (
                  <button
                    key={m}
                    type="button"
                    className={simulator.accuracy === m ? 'is-on' : ''}
                    onClick={() => {
                      simulator.setAccuracy(m);
                      refresh((n) => n + 1);
                    }}
                  >
                    ±{m} m
                  </button>
                ))}
                <button
                  type="button"
                  className={simulator.jitter ? 'is-on' : ''}
                  onClick={() => {
                    simulator.setJitter(!simulator.jitter);
                    refresh((n) => n + 1);
                  }}
                >
                  Noise {simulator.jitter ? 'on' : 'off'}
                </button>
                {[
                  ['Walk N', 0],
                  ['Walk E', 90],
                  ['Walk S', 180],
                  ['Walk W', 270],
                ].map(([label, bearing]) => (
                  <button
                    key={label}
                    type="button"
                    className={simulator.walking === bearing ? 'is-on' : ''}
                    onClick={() => {
                      simulator.walk(simulator.walking === bearing ? null : (bearing as number));
                      refresh((n) => n + 1);
                    }}
                  >
                    {label}
                  </button>
                ))}
                <button type="button" onClick={() => simulator.nudge(0, 800)}>
                  Leave park
                </button>
                <button type="button" onClick={() => simulator.nudge(0, -800)}>
                  Come back
                </button>
              </div>
            </div>
      )}
    </section>
  );
}
