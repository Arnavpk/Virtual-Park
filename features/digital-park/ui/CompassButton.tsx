import { ORBIT } from '../lib/coords';
import { useGame } from '../state/game';

/** Key for the compass needle in the overlay registry; the scene turns it every frame. */
export const COMPASS = '__compass';

/**
 * Shows which way is "up the map" as the camera orbits, and puts the camera
 * back to its normal view when tapped. The needle is turned by the scene (no
 * React state), so orbiting never re-renders anything.
 */
export function CompassButton() {
  const game = useGame();
  return (
    <button
      type="button"
      className="dp-compass"
      aria-label="Reset the camera to its normal view"
      title="Reset view"
      onClick={() => {
        // Unwind to the nearest full turn, so it swings back the short way.
        game.view.yaw = Math.round(game.view.yaw / (Math.PI * 2)) * Math.PI * 2;
        game.view.pitch = ORBIT.pitch;
      }}
    >
      <span
        className="dp-compass__needle"
        ref={(el) => {
          if (el) game.overlay.set(COMPASS, el);
          else game.overlay.delete(COMPASS);
        }}
      >
        <svg width="26" height="26" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M12 2.5l4.2 9.5H7.8z" fill="#ff3d68" />
          <path d="M12 21.5L7.8 12h8.4z" fill="currentColor" opacity="0.35" />
          <circle cx="12" cy="12" r="1.6" fill="currentColor" />
        </svg>
      </span>
    </button>
  );
}
