import { ATTRACTIONS } from '../data/park';
import { matchesFilter, type Filter } from '../lib/places';
import { useGame } from '../state/game';
import { useUserPark } from '../state/userPark';

/** Key used for the "You" tag in the overlay registry. */
export const YOU = '__you';

/**
 * Map pins above every place, carrying the same number or letter as the
 * printed park map. Close up they also show the name; in the whole-park view
 * they shrink to just the code so 47 of them fit.
 *
 * This is plain DOM layered over the canvas. Each element registers itself in
 * game.overlay, and <PinProjector> (inside the canvas) moves it every frame.
 */
export function PinLayer({
  selectedId,
  compact,
  filter,
  you,
  onSelect,
}: {
  selectedId: string | null;
  /** Pins shrink to just their code when the view is zoomed out. */
  compact: boolean;
  /** Pins outside this category are hidden. The chosen place always shows. */
  filter: Filter;
  /** The tag over the character: the visitor's real (GPS) position, their virtual one, or no tag. */
  you: 'gps' | 'virtual' | null;
  onSelect: (id: string) => void;
}) {
  const game = useGame();
  const { visited } = useUserPark();
  const register = (key: string) => (el: HTMLElement | null) => {
    if (el) game.overlay.set(key, el);
    else game.overlay.delete(key);
  };

  return (
    <div className="dp-pins">
      {ATTRACTIONS.map((a) => {
        const selected = a.id === selectedId;
        const filtered = !selected && !matchesFilter(a, filter);
        return (
          <button
            key={a.id}
            ref={register(a.id)}
            type="button"
            className={`dp-pin dp-pin--${a.category}${selected ? ' is-selected' : ''}${compact ? ' is-compact' : ''}${filtered ? ' is-filtered' : ''}${visited.includes(a.id) ? ' is-visited' : ''}`}
            onClick={() => onSelect(a.id)}
            aria-label={`${a.id}. ${a.name}${a.kind ? `, ${a.kind}` : ''}${visited.includes(a.id) ? ', visited' : ''}`}
            aria-pressed={selected}
            tabIndex={filtered ? -1 : undefined}
          >
            <span className="dp-pin__code">{a.id}</span>
            {(!compact || selected) && <span className="dp-pin__name">{a.name}</span>}
          </button>
        );
      })}
      {you && (
        <span ref={register(YOU)} className={`dp-you${you === 'gps' ? ' dp-you--gps' : ''}`} aria-hidden="true">
          {you === 'gps' ? 'You are here' : 'Virtual position'}
        </span>
      )}
    </div>
  );
}
