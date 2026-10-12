import { useEffect, useRef } from 'react';

/** Explains tilt-to-walk before any permission prompt appears. */
export function TiltDialog({
  busy,
  error,
  onConfirm,
  onCancel,
}: {
  busy: boolean;
  error: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const confirm = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    confirm.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCancel();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  return (
    <div className="dp-dialog-wrap">
      <div className="dp-scrim is-open" onClick={onCancel} aria-hidden="true" />
      <div className="dp-dialog" role="dialog" aria-modal="true" aria-labelledby="dp-tilt-title">
        <h2 id="dp-tilt-title" className="dp-dialog__title">
          Walk by tilting your phone
        </h2>
        <p>
          Hold your phone the way you usually do, then turn tilt on. That position counts as standing still.
        </p>
        <p>
          Tip the top edge away from you to walk forward and towards you to walk back. Lean the phone left or right to
          steer.
        </p>
        <p className="dp-dialog__note">
          Tilt only reads the angle of your phone. It doesn't use GPS or your real location, and the joystick keeps
          working the whole time.
        </p>
        {error && (
          <p className="dp-dialog__error" role="alert">
            {error}
          </p>
        )}
        <div className="dp-dialog__actions">
          <button type="button" className="dp-button dp-button--quiet" onClick={onCancel}>
            Not now
          </button>
          <button ref={confirm} type="button" className="dp-button" onClick={onConfirm} disabled={busy}>
            {busy ? 'Checking…' : 'Turn on tilt'}
          </button>
        </div>
      </div>
    </div>
  );
}
