import { type GpsStatus as Status, useGpsReading } from '../hooks/useGps';
import { CALIBRATION_ERROR_METRES, PARK_CALIBRATION, type Calibration } from '../lib/geo';
import { useGame } from '../state/game';
import { Icon } from './icons';

const COPY: Record<Exclude<Status, 'off'>, { title: string; detail?: string; tone: 'ok' | 'warn' | 'bad' | 'busy' }> = {
  locating: { title: 'Finding your location…', detail: 'This can take a few seconds. Open sky helps.', tone: 'busy' },
  active: { title: 'GPS active', tone: 'ok' },
  weak: { title: 'Weak GPS signal', detail: 'Your position on the map may be off.', tone: 'warn' },
  poor: { title: 'GPS signal too weak', detail: "Your character stays put until it improves.", tone: 'warn' },
  outside: { title: 'You appear to be outside the mapped park area', detail: 'Your character stays at its last spot inside the park.', tone: 'warn' },
  denied: { title: "Can't access your location", detail: 'Allow location for this site in your browser or phone settings, then try again.', tone: 'bad' },
  unavailable: { title: 'GPS unavailable', detail: "Your phone can't work out its position right now. Still trying.", tone: 'bad' },
  timeout: { title: 'No GPS signal yet', detail: 'Still trying. Moving into the open usually helps.', tone: 'busy' },
};

const roundTo5 = (m: number) => Math.max(5, Math.round(m / 5) * 5);

/**
 * The GPS status panel. It takes the joystick's place in GPS Mode, which also
 * makes it plain that the joystick is not in use. The accuracy shown is the
 * figure the device reports, never an invented one.
 */
export function GpsStatus({
  status,
  source,
  calibrationKind,
  onRetry,
}: {
  status: Status;
  source: 'device' | 'simulator' | null;
  calibrationKind: Calibration['kind'] | null;
  onRetry: () => void;
}) {
  const game = useGame();
  const reading = useGpsReading(game);
  if (status === 'off') return null;
  const copy = COPY[status];
  const showAccuracy = reading && (status === 'active' || status === 'weak' || status === 'poor' || status === 'outside');

  return (
    <section className={`dp-gps dp-gps--${copy.tone}`} aria-label="GPS status" role="status" aria-live="polite">
      <p className="dp-gps__title">
        <Icon name="near" size={18} />
        {copy.title}
      </p>
      {showAccuracy && <p className="dp-gps__accuracy">Accuracy about {Math.round(reading.accuracy)} m</p>}
      {showAccuracy && calibrationKind === 'points' && PARK_CALIBRATION?.status === 'provisional' && CALIBRATION_ERROR_METRES && (
        <p className="dp-gps__detail">Map placement is approximate (usually within {roundTo5(CALIBRATION_ERROR_METRES)} m).</p>
      )}
      {copy.detail && <p className="dp-gps__detail">{copy.detail}</p>}
      {(source === 'simulator' || calibrationKind === 'test') && (
        <p className="dp-gps__badge">
          {source === 'simulator' ? 'Simulated GPS' : 'Real GPS'}
          {calibrationKind === 'test' ? ', test calibration' : ''}
        </p>
      )}
      {status === 'denied' && (
        <button type="button" className="dp-button dp-button--quiet dp-gps__retry" onClick={onRetry}>
          Try again
        </button>
      )}
    </section>
  );
}
