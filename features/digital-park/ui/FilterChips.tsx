import type { ReactNode } from 'react';
import { FILTERS, type Filter } from '../lib/places';
import { Icon } from './icons';

/** The scrolling row of category chips. Used above the map and inside the search sheet. */
export function FilterChips({
  value,
  onChange,
  label,
  lead,
}: {
  value: Filter;
  onChange: (f: Filter) => void;
  label: string;
  /** An extra chip shown before the filters. */
  lead?: ReactNode;
}) {
  return (
    <div className="dp-chips" role="group" aria-label={label}>
      {lead}
      {FILTERS.map((f) => (
        <button
          key={f.id}
          type="button"
          className={`dp-chip${value === f.id ? ' is-on' : ''}`}
          aria-pressed={value === f.id}
          onClick={() => onChange(f.id)}
        >
          {f.id === 'near' && <Icon name="near" size={16} />}
          {f.label}
        </button>
      ))}
    </div>
  );
}
