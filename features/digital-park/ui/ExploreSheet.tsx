import { useEffect, useMemo, useRef, useState } from 'react';
import { ATTRACTIONS } from '../data/park';
import type { Attraction, Vec2 } from '../data/types';
import { usePlaceDistances } from '../hooks/usePlaceDistances';
import { formatMetres } from '../lib/pathfinding';
import { categoryLine, matchesFilter, searchPlaces, type Filter } from '../lib/places';
import { recommend } from '../lib/recommend';
import { useUserPark } from '../state/userPark';
import { FilterChips } from './FilterChips';
import { Icon } from './icons';

const NEAR_COUNT = 12;

/** Ways to look at Near me. */
type NearView = 'closest' | 'foryou' | 'favorites' | 'ride' | 'food' | 'service';
const NEAR_VIEWS: { id: NearView; label: string }[] = [
  { id: 'closest', label: 'Closest' },
  { id: 'foryou', label: 'For you' },
  { id: 'favorites', label: 'Favorites' },
  { id: 'ride', label: 'Rides' },
  { id: 'food', label: 'Food' },
  { id: 'service', label: 'Services' },
];

/**
 * Search, category filters and "Near me" in one sheet.
 *
 * Distances are walking distances from the visitor's position in the virtual
 * park (never GPS). They are worked out when the sheet opens and again only
 * when the visitor has moved a meaningful distance, not on every frame.
 */
export function ExploreSheet({
  open,
  focusSearch,
  getHere,
  filter,
  onFilter,
  selectedId,
  onSelect,
  onClose,
}: {
  open: boolean;
  /** Put the cursor in the search box when the sheet opens. */
  focusSearch: boolean;
  /** The visitor's current position in the park. */
  getHere: () => Vec2;
  filter: Filter;
  onFilter: (f: Filter) => void;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const [nearView, setNearView] = useState<NearView>('closest');
  const input = useRef<HTMLInputElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const user = useUserPark();
  // One sweep of the walk grid gives the distance to every place; refreshed as the visitor moves.
  const metres = usePlaceDistances(open, getHere);

  useEffect(() => {
    if (!open) return;
    setQuery(''); // each visit to the sheet starts with a fresh search
    setNearView('closest');
    (focusSearch ? input.current : closeButton.current)?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, focusSearch, onClose]);

  const results = useMemo(() => {
    const near = filter === 'near';
    let items = searchPlaces(ATTRACTIONS.filter((a) => matchesFilter(a, filter)), query);
    // Outside Near me: map order, or search ranking while typing. And typing a
    // search inside Near me looks through everything, not just the current view.
    if (!near || query.trim()) return items;
    const byDistance = (a: Attraction, b: Attraction) => (metres.get(a.id) ?? Infinity) - (metres.get(b.id) ?? Infinity);
    if (nearView === 'foryou') {
      // Same rule as "Recommended for you": interests, favorites and My Day weighed against distance.
      const ok = new Set(items.map((a) => a.id));
      return recommend({ places: ATTRACTIONS, metres, user })
        .filter((s) => ok.has(s.place.id))
        .slice(0, NEAR_COUNT)
        .map((s) => s.place);
    }
    if (nearView === 'favorites') items = items.filter((a) => user.favorites.includes(a.id));
    else if (nearView !== 'closest') items = items.filter((a) => a.category === nearView);
    return [...items].sort(byDistance).slice(0, NEAR_COUNT);
  }, [filter, query, metres, nearView, user]);

  useEffect(() => {
    list.current?.scrollTo({ top: 0 });
  }, [filter, query, nearView]);

  const near = filter === 'near';

  return (
    <>
      <div className={`dp-scrim${open ? ' is-open' : ''}`} onClick={onClose} aria-hidden="true" />
      <section className={`dp-sheet${open ? ' is-open' : ''}`} role="dialog" aria-modal="true" aria-label="Find a place" aria-hidden={!open}>
        <header className="dp-sheet__head">
          <label className="dp-field">
            <Icon name="search" size={20} />
            <input
              ref={input}
              type="search"
              inputMode="search"
              enterKeyHint="search"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              placeholder="Search rides, food and more"
              aria-label="Search places"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {query && (
              <button type="button" className="dp-field__clear" onClick={() => { setQuery(''); input.current?.focus(); }} aria-label="Clear search">
                <Icon name="close" size={18} />
              </button>
            )}
          </label>
          <button ref={closeButton} type="button" className="dp-icon-button" onClick={onClose} aria-label="Close">
            <Icon name="close" size={20} />
          </button>
        </header>

        <FilterChips value={filter} onChange={onFilter} label="Filter places" />

        {near && !query.trim() && (
          <div className="dp-segments" role="group" aria-label="Sort and narrow Near me">
            {NEAR_VIEWS.map((v) => (
              <button key={v.id} type="button" className={`dp-segment${nearView === v.id ? ' is-on' : ''}`} aria-pressed={nearView === v.id} onClick={() => setNearView(v.id)}>
                {v.label}
              </button>
            ))}
          </div>
        )}

        <ul ref={list} className="dp-places">
          {results.map((place, i) => {
            const m = metres.get(place.id);
            return (
              <li key={place.id}>
                <button type="button" className={`dp-place${place.id === selectedId ? ' is-selected' : ''}`} onClick={() => onSelect(place.id)}>
                  {near && !query.trim() && <span className="dp-place__rank">{i + 1}</span>}
                  <span className={`dp-place__icon dp-tint--${place.category}`}>{place.id}</span>
                  <span className="dp-place__text">
                    <span className="dp-place__name">
                      {place.name}
                      {user.favorites.includes(place.id) && (
                        <span className="dp-mark dp-mark--fav" aria-label="Favorite">
                          <Icon name="heartFilled" size={13} />
                        </span>
                      )}
                    </span>
                    <span className="dp-place__kind">
                      {categoryLine(place)}
                      {user.visited.includes(place.id) && (
                        <span className="dp-mark dp-mark--visited">
                          <Icon name="check" size={13} />
                          Visited
                        </span>
                      )}
                    </span>
                  </span>
                  <span className="dp-place__distance">{m !== undefined && Number.isFinite(m) ? formatMetres(m) : ''}</span>
                </button>
              </li>
            );
          })}
          {results.length === 0 && (
            <li className="dp-places__empty">
              {query
                ? `Nothing matches “${query}”${filter !== 'all' && filter !== 'near' ? ' in this category' : ''}. Check the spelling or try a shorter word.`
                : near && nearView === 'favorites'
                  ? 'No favorites yet. Open any place and tap Favorite.'
                  : 'Nothing to show here.'}
            </li>
          )}
        </ul>
      </section>
    </>
  );
}
