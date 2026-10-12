import { Icon } from './icons';

export type Mode = 'virtual' | 'gps';

/** Chooses what moves the character: the joystick (Virtual) or the visitor's real location (GPS). */
export function ModeSwitch({ mode, onChange }: { mode: Mode; onChange: (m: Mode) => void }) {
  return (
    <div className="dp-mode" role="group" aria-label="What moves your character">
      <button type="button" className={`dp-mode__option${mode === 'virtual' ? ' is-on' : ''}`} aria-pressed={mode === 'virtual'} onClick={() => onChange('virtual')}>
        <Icon name="joystick" size={18} />
        Virtual
      </button>
      <button type="button" className={`dp-mode__option${mode === 'gps' ? ' is-on' : ''}`} aria-pressed={mode === 'gps'} onClick={() => onChange('gps')}>
        <Icon name="near" size={18} />
        GPS
      </button>
    </div>
  );
}
