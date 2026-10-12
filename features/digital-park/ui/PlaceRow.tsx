import type { ReactNode } from 'react';
import type { Attraction } from '../data/types';
import { formatMetres } from '../lib/pathfinding';
import { categoryLine } from '../lib/places';
import { Icon } from './icons';

/**
 * One place in a list: code, name, what it is, distance, and optional buttons.
 * Tapping the main part opens the place; the buttons on the right act on it.
 * Shared by My Park's lists so favorites, My Day, visited and recommendations
 * all read the same way.
 */
export function PlaceRow({
  place,
  metres,
  note,
  rank,
  visited,
  favorite,
  onOpen,
  extra,
  children,
}: {
  place: Attraction;
  metres?: number;
  /** Replaces the category line, e.g. the reason for a recommendation. */
  note?: string;
  rank?: number;
  visited?: boolean;
  favorite?: boolean;
  onOpen: () => void;
  /** A second line of small buttons under the place (used by My Day for reorder and remove). */
  extra?: ReactNode;
  /** Buttons shown at the right of the row. */
  children?: ReactNode;
}) {
  return (
    <div className={`dp-row${extra ? ' dp-row--stacked' : ''}`}>
      <button type="button" className="dp-row__main" onClick={onOpen}>
        {rank !== undefined && <span className="dp-place__rank">{rank}</span>}
        <span className={`dp-place__icon dp-tint--${place.category}`}>{place.id}</span>
        <span className="dp-place__text">
          <span className="dp-place__name">
            {place.name}
            {favorite && (
              <span className="dp-mark dp-mark--fav" aria-label="Favorite">
                <Icon name="heartFilled" size={13} />
              </span>
            )}
          </span>
          <span className="dp-place__kind">{note ?? categoryLine(place)}</span>
          <span className="dp-row__meta">
            {metres !== undefined && Number.isFinite(metres) && <span>{formatMetres(metres)}</span>}
            {visited && (
              <span className="dp-mark dp-mark--visited">
                <Icon name="check" size={13} />
                Visited
              </span>
            )}
          </span>
        </span>
      </button>
      {children && <div className="dp-row__actions">{children}</div>}
      {extra && <div className="dp-row__extra">{extra}</div>}
    </div>
  );
}

/** A small round button for the right side of a row. */
export function RowButton({
  icon,
  label,
  onClick,
  disabled,
  primary,
}: {
  icon: Parameters<typeof Icon>[0]['name'];
  label: string;
  onClick: () => void;
  disabled?: boolean;
  primary?: boolean;
}) {
  return (
    <button type="button" className={`dp-rowbtn${primary ? ' dp-rowbtn--primary' : ''}`} onClick={onClick} disabled={disabled} aria-label={label} title={label}>
      <Icon name={icon} size={18} />
    </button>
  );
}

/** A small labelled button for the second line of a row. */
export function MiniButton({
  icon,
  label,
  hint,
  onClick,
  disabled,
}: {
  icon: Parameters<typeof Icon>[0]['name'];
  label: string;
  /** Fuller description for screen readers. */
  hint: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button type="button" className="dp-minibtn" onClick={onClick} disabled={disabled} aria-label={hint}>
      <Icon name={icon} size={15} />
      {label}
    </button>
  );
}
