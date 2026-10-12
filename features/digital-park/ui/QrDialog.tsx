import { useEffect, useRef, useState } from 'react';
import { resolveLocation, type ParkLocation } from '../data/locations';

/** The bits of the browser's BarcodeDetector used here (not in TypeScript's DOM types yet). */
interface Detector {
  detect(source: HTMLVideoElement): Promise<{ rawValue: string }[]>;
}
type DetectorCtor = (new (opts: { formats: string[] }) => Detector) & { getSupportedFormats?: () => Promise<string[]> };

type CameraState = 'idle' | 'starting' | 'scanning' | 'unsupported' | 'denied' | 'no-camera' | 'insecure' | 'failed';

const CAMERA_COPY: Partial<Record<CameraState, string>> = {
  unsupported: "This browser can't read QR codes inside the app. Scan the code with your phone's camera app instead, or type the code printed under it.",
  denied: 'Camera access was blocked. Allow the camera for this site in your browser settings, or type the code printed under the QR code.',
  'no-camera': "No camera was found. Type the code printed under the QR code instead.",
  insecure: 'The camera only works on a secure (https) page. Type the code printed under the QR code instead.',
  failed: "The camera couldn't start. Type the code printed under the QR code instead.",
};

async function qrDetector(): Promise<Detector | null> {
  const Ctor = (globalThis as unknown as { BarcodeDetector?: DetectorCtor }).BarcodeDetector;
  if (!Ctor) return null;
  try {
    const formats = (await Ctor.getSupportedFormats?.()) ?? ['qr_code'];
    return formats.includes('qr_code') ? new Ctor({ formats: ['qr_code'] }) : null;
  } catch {
    return null;
  }
}

/**
 * Finds out where the visitor is from a park location QR code: by scanning it
 * with the camera (where the browser can read QR codes) or by typing the
 * short code printed under it. Only ids from the park's own list are
 * accepted; a code can't place anyone at arbitrary coordinates.
 *
 * The camera is opened only after the visitor taps "Scan with camera", and
 * is switched off as soon as a code is read or the dialog closes. Nothing
 * from the camera leaves the phone.
 */
export function QrDialog({ onResolved, onCancel }: { onResolved: (loc: ParkLocation) => void; onCancel: () => void }) {
  const [camera, setCamera] = useState<CameraState>('idle');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const done = useRef(false);

  const stopCamera = () => {
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCancel();
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      done.current = true;
      stopCamera();
    };
  }, [onCancel]);

  const finish = (loc: ParkLocation) => {
    if (done.current) return;
    done.current = true;
    stopCamera();
    onResolved(loc);
  };

  const startCamera = async () => {
    setError(null);
    if (typeof window !== 'undefined' && window.isSecureContext === false) return setCamera('insecure');
    const detector = await qrDetector();
    if (!detector || !navigator.mediaDevices?.getUserMedia) {
      setCamera('unsupported');
      input.current?.focus();
      return;
    }
    setCamera('starting');
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
      if (done.current) {
        s.getTracks().forEach((t) => t.stop());
        return;
      }
      stream.current = s;
      const v = video.current;
      if (!v) return;
      v.srcObject = s;
      await v.play().catch(() => undefined);
      setCamera('scanning');
      let lastBad = '';
      const tick = async () => {
        if (done.current || !stream.current) return;
        try {
          const codes = await detector.detect(v);
          for (const c of codes) {
            const loc = resolveLocation(c.rawValue);
            if (loc) return finish(loc);
            if (c.rawValue !== lastBad) {
              lastBad = c.rawValue;
              setError("That QR code isn't a Digital Park location code. Look for the park's location signs.");
            }
          }
        } catch {
          // A frame that couldn't be read; try the next one.
        }
        window.setTimeout(tick, 250);
      };
      tick();
    } catch (e) {
      const name = (e as { name?: string })?.name;
      setCamera(name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : name === 'NotFoundError' || name === 'OverconstrainedError' ? 'no-camera' : 'failed');
      stopCamera();
    }
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const loc = resolveLocation(code);
    if (loc) finish(loc);
    else setError(code.trim() ? `"${code.trim().slice(0, 24)}" isn't a park location code. Check the code printed under the QR code.` : 'Type the code printed under the QR code.');
  };

  const cameraMessage = CAMERA_COPY[camera];

  return (
    <div className="dp-dialog-wrap">
      <div className="dp-scrim is-open" onClick={onCancel} aria-hidden="true" />
      <div className="dp-dialog dp-qr" role="dialog" aria-modal="true" aria-labelledby="dp-qr-title">
        <h2 id="dp-qr-title" className="dp-dialog__title">
          Where are you?
        </h2>
        <p>Scan a park location QR code to put your character exactly where you're standing.</p>

        {(camera === 'starting' || camera === 'scanning') && (
          <div className="dp-qr__viewer">
            <video ref={video} className="dp-qr__video" playsInline muted aria-label="Camera view" />
            <span className="dp-qr__frame" aria-hidden="true" />
            <p className="dp-qr__hint" role="status">
              {camera === 'starting' ? 'Starting the camera…' : 'Point the camera at the QR code'}
            </p>
          </div>
        )}
        {camera === 'idle' && (
          <button type="button" className="dp-button dp-qr__scan" onClick={startCamera}>
            Scan with camera
          </button>
        )}
        {cameraMessage && <p className="dp-dialog__note">{cameraMessage}</p>}

        <form className="dp-qr__form" onSubmit={submit}>
          <label htmlFor="dp-qr-code" className="dp-qr__label">
            Or type the code under the QR code
          </label>
          <div className="dp-qr__row">
            <input
              ref={input}
              id="dp-qr-code"
              className="dp-qr__input"
              value={code}
              onChange={(e) => {
                setCode(e.target.value);
                setError(null);
              }}
              placeholder="e.g. P3 or 17"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              maxLength={60}
              enterKeyHint="go"
            />
            <button type="submit" className="dp-button">
              Go
            </button>
          </div>
        </form>

        {error && (
          <p className="dp-dialog__error" role="alert">
            {error}
          </p>
        )}
        <div className="dp-dialog__actions">
          <button type="button" className="dp-button dp-button--quiet" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
