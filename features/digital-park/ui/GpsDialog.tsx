import { useEffect, useRef } from 'react';
import type { GpsStartProblem } from '../hooks/useGps';
import { CALIBRATION_ERROR_METRES, PARK_CALIBRATION } from '../lib/geo';

const PROBLEMS: Record<GpsStartProblem, string> = {
  unsupported: "This browser can't share your location. Keep using Virtual Mode, or try Chrome or Safari.",
  insecure: 'Location only works on a secure page. Open the https address of this site, then try again.',
  uncalibrated:
    "GPS isn't set up for this park yet. The park's reference coordinates haven't been added, so your location can't be placed on the map.",
};

/** Explains GPS Mode before the browser's permission prompt appears. */
export function GpsDialog({
  problem,
  calibrated,
  devTools,
  onEnable,
  onCancel,
}: {
  problem: GpsStartProblem | null;
  /** Whether the park has real GPS reference points. */
  calibrated: boolean;
  devTools: boolean;
  onEnable: (simulate: boolean) => void;
  onCancel: () => void;
}) {
  const confirm = useRef<HTMLButtonElement>(null);
  // Nothing the visitor can do will change these, so there is no point offering to try again.
  const deadEnd = !devTools && (problem === 'uncalibrated' || problem === 'unsupported');
  useEffect(() => {
    confirm.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCancel();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  return (
    <div className="dp-dialog-wrap">
      <div className="dp-scrim is-open" onClick={onCancel} aria-hidden="true" />
      <div className="dp-dialog" role="dialog" aria-modal="true" aria-labelledby="dp-gps-title">
        <h2 id="dp-gps-title" className="dp-dialog__title">
          Use your real location
        </h2>
        {!deadEnd && (
          <>
            <p>In GPS Mode your character follows where you really are in the park. Your browser will ask for permission to use your location.</p>
            {PARK_CALIBRATION?.status === 'provisional' && CALIBRATION_ERROR_METRES && (
              <p className="dp-dialog__note">
                The park's GPS setup is still being fine-tuned, so your spot on the map is approximate: usually within
                about {Math.max(5, Math.round(CALIBRATION_ERROR_METRES / 5) * 5)} m, sometimes more near the edges of the
                park. If you see a park location QR code, scanning it puts you exactly in place.
              </p>
            )}
            <p className="dp-dialog__note">
              Your location stays on this phone. It isn't sent anywhere or saved, and tracking stops when you switch back
              to Virtual Mode.
            </p>
          </>
        )}
        {problem && (
          <p className="dp-dialog__error" role="alert">
            {PROBLEMS[problem]}
          </p>
        )}
        {devTools && (
          <p className="dp-dialog__dev">
            <strong>Development build.</strong>{' '}
            {calibrated
              ? 'The simulator lets you walk a pretend visitor around without leaving your desk.'
              : 'The park has no GPS reference points yet. Enable GPS will pin your first real reading to where the character is standing now (north-up, estimated scale) so you can test walking anywhere. The simulator needs no GPS at all.'}
          </p>
        )}
        <div className="dp-dialog__actions">
          {deadEnd ? (
            <button ref={confirm} type="button" className="dp-button" onClick={onCancel}>
              OK
            </button>
          ) : (
            <>
              <button type="button" className="dp-button dp-button--quiet" onClick={onCancel}>
                Not now
              </button>
              {devTools && (
                <button type="button" className="dp-button dp-button--quiet" onClick={() => onEnable(true)}>
                  Use simulator
                </button>
              )}
              <button ref={confirm} type="button" className="dp-button" onClick={() => onEnable(false)}>
                {problem ? 'Try again' : 'Enable GPS'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
