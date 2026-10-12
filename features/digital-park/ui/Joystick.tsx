import { useEffect, useRef } from 'react';
import { useGame } from '../state/game';

const TRAVEL = 42; // px the knob can move from centre

/**
 * Touch joystick. Writes straight into the game input (no React state), so
 * dragging it never re-renders anything.
 */
export function Joystick({ hidden }: { hidden?: boolean }) {
  const game = useGame();
  const base = useRef<HTMLDivElement>(null);
  const knob = useRef<HTMLDivElement>(null);
  const pointer = useRef<number | null>(null);

  const release = () => {
    pointer.current = null;
    game.input.joyActive = false;
    game.input.joyX = 0;
    game.input.joyY = 0;
    if (knob.current) knob.current.style.transform = 'translate3d(0,0,0)';
    base.current?.classList.remove('is-active');
  };

  const update = (clientX: number, clientY: number) => {
    const el = base.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    let dx = clientX - (r.left + r.width / 2);
    let dy = clientY - (r.top + r.height / 2);
    const len = Math.hypot(dx, dy);
    if (len > TRAVEL) {
      dx = (dx / len) * TRAVEL;
      dy = (dy / len) * TRAVEL;
    }
    game.input.joyActive = true;
    game.input.joyX = dx / TRAVEL;
    game.input.joyY = dy / TRAVEL;
    if (knob.current) knob.current.style.transform = `translate3d(${dx}px,${dy}px,0)`;
  };

  // Let go if the stick is hidden or the page loses focus mid-drag.
  useEffect(() => {
    if (hidden) release();
    const onBlur = () => release();
    window.addEventListener('blur', onBlur);
    return () => window.removeEventListener('blur', onBlur);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hidden]);

  return (
    <div
      ref={base}
      className={`dp-joystick${hidden ? ' is-hidden' : ''}`}
      role="application"
      aria-label="Joystick. Drag to walk."
      onPointerDown={(e) => {
        if (pointer.current !== null) return;
        pointer.current = e.pointerId;
        e.currentTarget.setPointerCapture(e.pointerId);
        base.current?.classList.add('is-active');
        update(e.clientX, e.clientY);
      }}
      onPointerMove={(e) => {
        if (e.pointerId === pointer.current) update(e.clientX, e.clientY);
      }}
      onPointerUp={(e) => {
        if (e.pointerId === pointer.current) release();
      }}
      onPointerCancel={(e) => {
        if (e.pointerId === pointer.current) release();
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="dp-joystick__ring" />
      <div ref={knob} className="dp-joystick__knob" />
    </div>
  );
}
