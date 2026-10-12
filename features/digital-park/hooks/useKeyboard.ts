import { useEffect } from 'react';
import type { Game } from '../state/game';

const KEYS: Record<string, [number, number]> = {
  ArrowUp: [0, -1],
  KeyW: [0, -1],
  ArrowDown: [0, 1],
  KeyS: [0, 1],
  ArrowLeft: [-1, 0],
  KeyA: [-1, 0],
  ArrowRight: [1, 0],
  KeyD: [1, 0],
};

/** WASD / arrow keys for desktop testing. */
export function useKeyboard(game: Game) {
  useEffect(() => {
    const held = new Set<string>();
    const apply = () => {
      let x = 0;
      let y = 0;
      held.forEach((code) => {
        x += KEYS[code][0];
        y += KEYS[code][1];
      });
      game.input.keyX = Math.sign(x);
      game.input.keyY = Math.sign(y);
    };
    const typing = (t: EventTarget | null) =>
      t instanceof HTMLElement && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
    const down = (e: KeyboardEvent) => {
      if (!(e.code in KEYS) || typing(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
      e.preventDefault();
      held.add(e.code);
      apply();
    };
    const up = (e: KeyboardEvent) => {
      if (held.delete(e.code)) apply();
    };
    const clear = () => {
      held.clear();
      apply();
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', clear);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', clear);
      clear();
    };
  }, [game]);
}
