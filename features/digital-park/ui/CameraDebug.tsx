import { useEffect, useState } from 'react';
import { cameraForward, worldBearing } from '../lib/coords';
import { DEBUG_COLORS } from '../scene/DirectionDebug';
import { useGame } from '../state/game';

const deg = (n: number) => `${Math.round(n)}°`;

/**
 * DEVELOPMENT ONLY. Never rendered for visitors (see `devTools` in DigitalPark).
 *
 * Opening it draws four direction arrows at the player and shows the numbers
 * behind them. Angles are measured clockwise from "up the map", so with the
 * camera at 0° and the stick pushed up, all three read 0°.
 */
export function CameraDebug() {
  const game = useGame();
  const [open, setOpen] = useState(false);
  const [, tick] = useState(0);

  useEffect(() => {
    game.view.debug = open;
    if (!open) return;
    const timer = window.setInterval(() => tick((n) => n + 1), 200);
    return () => {
      window.clearInterval(timer);
      game.view.debug = false;
    };
  }, [game, open]);

  const { player, view } = game;
  const f = cameraForward(view.yawNow);
  const moving = Math.hypot(player.moveX, player.moveZ) > 0.05;
  const swatch = (color: string) => <i className="dp-dev__swatch" style={{ background: color }} />;

  return (
    <section className={`dp-dev${open ? ' is-open' : ''}`} aria-label="Camera development tools">
      <button type="button" className="dp-dev__toggle" onClick={() => setOpen(!open)} aria-expanded={open}>
        Camera debug {open ? '▾' : '▸'}
      </button>
      {open && (
        <dl className="dp-dev__list">
          <dt>{swatch(DEBUG_COLORS.forward)}Camera angle</dt>
          <dd>{deg(worldBearing(f.x, f.z))}</dd>
          <dt>{swatch(DEBUG_COLORS.right)}Camera right</dt>
          <dd>{deg((worldBearing(f.x, f.z) + 90) % 360)}</dd>
          <dt>{swatch(DEBUG_COLORS.facing)}Player direction</dt>
          <dd>{deg(worldBearing(Math.sin(player.heading), Math.cos(player.heading)))}</dd>
          <dt>{swatch(DEBUG_COLORS.movement)}Movement</dt>
          <dd>{moving ? deg(worldBearing(player.moveX, player.moveZ)) : 'still'}</dd>
          <dt>Tilt</dt>
          <dd>{deg((view.pitchNow * 180) / Math.PI)}</dd>
          <dt>Position</dt>
          <dd>
            {player.x.toFixed(1)}, {player.z.toFixed(1)}
          </dd>
          <dt>Source</dt>
          <dd>{game.gps.mode === 'gps' ? 'GPS' : 'joystick'}</dd>
        </dl>
      )}
    </section>
  );
}
