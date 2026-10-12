import { Icon } from './icons';

/** The + / − pair. Sits bottom right, well clear of the joystick on the left. */
export function ZoomControls({
  canZoomIn,
  canZoomOut,
  onZoomIn,
  onZoomOut,
}: {
  canZoomIn: boolean;
  canZoomOut: boolean;
  onZoomIn: () => void;
  onZoomOut: () => void;
}) {
  return (
    <div className="dp-zoom" role="group" aria-label="Zoom">
      <button type="button" className="dp-zoom__button" onClick={onZoomIn} disabled={!canZoomIn} aria-label="Zoom in">
        <Icon name="plus" />
      </button>
      <button type="button" className="dp-zoom__button" onClick={onZoomOut} disabled={!canZoomOut} aria-label="Zoom out">
        <Icon name="minus" />
      </button>
    </div>
  );
}
