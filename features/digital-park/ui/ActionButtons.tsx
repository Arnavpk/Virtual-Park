import type { CameraMode } from '../scene/CameraRig';
import { Icon } from './icons';

/** Compact stack on the right edge: camera, back to entrance, tilt, scan a location code. */
export function ActionButtons({
  cameraMode,
  onToggleCamera,
  onReset,
  showReset,
  tiltSupported,
  tiltOn,
  onToggleTilt,
  onScan,
}: {
  cameraMode: CameraMode;
  onToggleCamera: () => void;
  onReset: () => void;
  /** Hidden in GPS Mode, where the character is wherever the visitor is. */
  showReset: boolean;
  tiltSupported: boolean;
  tiltOn: boolean;
  onToggleTilt: () => void;
  /** Opens the location QR code scanner. */
  onScan: () => void;
}) {
  const showingAll = cameraMode === 'overview';
  return (
    <div className="dp-actions">
      <button
        type="button"
        className="dp-action"
        onClick={onToggleCamera}
        aria-label={showingAll ? 'Follow me' : 'Show the whole park'}
      >
        <span className="dp-action__disc">
          <Icon name={showingAll ? 'follow' : 'map'} />
        </span>
        <span className="dp-action__label">{showingAll ? 'Follow me' : 'Whole park'}</span>
      </button>
      {showReset && (
        <button type="button" className="dp-action" onClick={onReset} aria-label="Go back to the entrance">
          <span className="dp-action__disc">
            <Icon name="gate" />
          </span>
          <span className="dp-action__label">Entrance</span>
        </button>
      )}
      <button type="button" className="dp-action" onClick={onScan} aria-label="Scan a location QR code">
        <span className="dp-action__disc">
          <Icon name="qr" />
        </span>
        <span className="dp-action__label">Scan</span>
      </button>
      {tiltSupported && (
        <button
          type="button"
          className={`dp-action${tiltOn ? ' is-on' : ''}`}
          onClick={onToggleTilt}
          aria-pressed={tiltOn}
          aria-label={tiltOn ? 'Turn off tilt to walk' : 'Turn on tilt to walk'}
        >
          <span className="dp-action__disc">
            <Icon name="tilt" />
          </span>
          <span className="dp-action__label">{tiltOn ? 'Tilt on' : 'Tilt'}</span>
        </button>
      )}
    </div>
  );
}
