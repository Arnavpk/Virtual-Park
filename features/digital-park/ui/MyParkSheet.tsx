import { useEffect, useMemo, useRef, useState } from 'react';
import { INTERESTS } from '../data/interests';
import { ATTRACTIONS, getAttraction } from '../data/park';
import type { Attraction, Vec2 } from '../data/types';
import { usePlaceDistances } from '../hooks/usePlaceDistances';
import { formatMetres } from '../lib/pathfinding';
import { AMENITY_LABEL, FACILITIES, categoryLine } from '../lib/places';
import { progress, recommend, whatNext } from '../lib/recommend';
import { userPark, useUserPark } from '../state/userPark';
import { Icon } from './icons';
import { MiniButton, PlaceRow, RowButton } from './PlaceRow';

export type MyParkTab = 'foryou' | 'myday' | 'favorites' | 'visited' | 'facilities';

const TABS: { id: MyParkTab; label: string }[] = [
  { id: 'foryou', label: 'For you' },
  { id: 'myday', label: 'My Day' },
  { id: 'favorites', label: 'Favorites' },
  { id: 'visited', label: 'Visited' },
  { id: 'facilities', label: 'Facilities' },
];

const places = (ids: string[]) => ids.map((id) => getAttraction(id)).filter((a): a is Attraction => !!a);

/**
 * My Park: the visitor's personal side of the app, in a bottom sheet so the
 * 3D park stays in view above it.
 *
 * Everything here is worked out from three things that already exist: the park
 * data, the visitor's saved state (state/userPark.ts) and the character's
 * position (`getHere`), so it behaves the same in Virtual Mode and GPS Mode.
 */
export function MyParkSheet({
  open,
  tab,
  onTab,
  getHere,
  onOpenPlace,
  onNavigate,
  onClose,
}: {
  open: boolean;
  tab: MyParkTab;
  onTab: (t: MyParkTab) => void;
  getHere: () => Vec2;
  /** Show a place's card on the map. */
  onOpenPlace: (id: string) => void;
  /** Start navigating to a place. */
  onNavigate: (id: string) => void;
  onClose: () => void;
}) {
  const user = useUserPark();
  const metres = usePlaceDistances(open, getHere);
  const closeButton = useRef<HTMLButtonElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const [showAllVisited, setShowAllVisited] = useState(false);

  useEffect(() => {
    if (!open) return;
    closeButton.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useEffect(() => {
    body.current?.scrollTo({ top: 0 });
  }, [tab]);

  // Recomputed only when the sheet is open and the distances or the visitor's choices change.
  const suggestions = useMemo(
    () => (open && metres.size ? recommend({ places: ATTRACTIONS, metres, user }) : []),
    [open, metres, user],
  );
  const next = useMemo(() => (open && metres.size ? whatNext({ places: ATTRACTIONS, metres, user }) : null), [open, metres, user]);
  const more = suggestions.filter((s) => !s.visited && s.place.id !== next?.place.id).slice(0, 4);
  const done = progress(ATTRACTIONS, user);

  const facilities = useMemo(() => {
    // Only what the park data actually contains: its services, plus the nearest place to eat.
    const services = ATTRACTIONS.filter((a) => a.category === 'service');
    const nearest = (list: Attraction[]) => [...list].sort((a, b) => (metres.get(a.id) ?? Infinity) - (metres.get(b.id) ?? Infinity))[0];
    const food = nearest(ATTRACTIONS.filter((a) => a.category === 'food'));
    const restroom = nearest(FACILITIES.restroom);
    const water = nearest(FACILITIES.water);
    return { services, food, restroom, water };
  }, [metres]);

  const is = {
    fav: (id: string) => user.favorites.includes(id),
    visited: (id: string) => user.visited.includes(id),
  };

  const Progress = (
    <div className="dp-progress" aria-label="Park progress">
      <p className="dp-progress__text">
        <strong>
          {done.done} of {done.total}
        </strong>{' '}
        rides and attractions explored
      </p>
      <div className="dp-progress__bar" role="progressbar" aria-valuemin={0} aria-valuemax={done.total} aria-valuenow={done.done}>
        <span style={{ width: `${done.percent}%` }} />
      </div>
    </div>
  );

  return (
    <>
      <div className={`dp-scrim dp-scrim--light${open ? ' is-open' : ''}`} onClick={onClose} aria-hidden="true" />
      <section className={`dp-sheet dp-sheet--mypark${open ? ' is-open' : ''}`} role="dialog" aria-modal="true" aria-label="My Park" aria-hidden={!open}>
        <header className="dp-sheet__head dp-sheet__head--title">
          <h2 className="dp-sheet__title">My Park</h2>
          <button ref={closeButton} type="button" className="dp-icon-button" onClick={onClose} aria-label="Close My Park">
            <Icon name="close" size={20} />
          </button>
        </header>

        <div className="dp-chips" role="tablist" aria-label="My Park sections">
          {TABS.map((t) => (
            <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className={`dp-chip${tab === t.id ? ' is-on' : ''}`} onClick={() => onTab(t.id)}>
              {t.label}
              {t.id === 'myday' && user.myDay.length > 0 && <span className="dp-chip__count">{user.myDay.length}</span>}
              {t.id === 'favorites' && user.favorites.length > 0 && <span className="dp-chip__count">{user.favorites.length}</span>}
            </button>
          ))}
        </div>

        <div ref={body} className="dp-sheet__body">
          {tab === 'foryou' && (
            <>
              {Progress}

              <h3 className="dp-section">What should I do next?</h3>
              {next ? (
                <div className="dp-next">
                  <div className="dp-next__top">
                    <span className={`dp-place__icon dp-tint--${next.place.category}`}>{next.place.id}</span>
                    <div className="dp-place__text">
                      <span className="dp-next__name">{next.place.name}</span>
                      <span className="dp-place__kind">{categoryLine(next.place)}</span>
                    </div>
                  </div>
                  <p className="dp-next__why">
                    {Number.isFinite(next.metres) ? `${formatMetres(next.metres)} away. ` : ''}
                    {next.reason}.
                  </p>
                  <div className="dp-next__actions">
                    <button type="button" className="dp-button dp-button--quiet" onClick={() => onOpenPlace(next.place.id)}>
                      Details
                    </button>
                    <button type="button" className="dp-button" onClick={() => onNavigate(next.place.id)}>
                      <Icon name="navigate" size={17} />
                      Navigate
                    </button>
                  </div>
                </div>
              ) : (
                <p className="dp-empty">
                  {metres.size ? "You've explored everything nearby. Try exploring another area of the park." : 'Working out what is near you…'}
                </p>
              )}

              {more.length > 0 && (
                <>
                  <h3 className="dp-section">Recommended for you</h3>
                  {more.map((s) => (
                    <PlaceRow key={s.place.id} place={s.place} metres={s.metres} note={s.reason} favorite={is.fav(s.place.id)} onOpen={() => onOpenPlace(s.place.id)}>
                      <RowButton icon="navigate" label={`Navigate to ${s.place.name}`} onClick={() => onNavigate(s.place.id)} primary />
                    </PlaceRow>
                  ))}
                </>
              )}

              <h3 className="dp-section">What do you enjoy?</h3>
              <p className="dp-hint">Pick as many as you like. Recommendations lean towards them.</p>
              <div className="dp-interests" role="group" aria-label="What do you enjoy?">
                {INTERESTS.map((i) => {
                  const on = user.interests.includes(i.id);
                  return (
                    <button key={i.id} type="button" className={`dp-chip${on ? ' is-on' : ''}`} aria-pressed={on} onClick={() => userPark.toggleInterest(i.id)}>
                      {on && <Icon name="check" size={15} />}
                      {i.label}
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {tab === 'myday' && (
            <>
              {user.myDay.length === 0 ? (
                <p className="dp-empty">Nothing planned yet. Open any place and tap My Day to add it to your plan.</p>
              ) : (
                places(user.myDay).map((a, i, all) => (
                  <PlaceRow
                    key={a.id}
                    place={a}
                    rank={i + 1}
                    metres={metres.get(a.id)}
                    visited={is.visited(a.id)}
                    favorite={is.fav(a.id)}
                    onOpen={() => onOpenPlace(a.id)}
                    extra={
                      <>
                        <MiniButton icon="up" label="Earlier" hint={`Move ${a.name} earlier`} onClick={() => userPark.moveInMyDay(a.id, -1)} disabled={i === 0} />
                        <MiniButton icon="down" label="Later" hint={`Move ${a.name} later`} onClick={() => userPark.moveInMyDay(a.id, 1)} disabled={i === all.length - 1} />
                        <MiniButton icon="trash" label="Remove" hint={`Remove ${a.name} from My Day`} onClick={() => userPark.toggleMyDay(a.id)} />
                      </>
                    }
                  >
                    <RowButton icon="navigate" label={`Navigate to ${a.name}`} onClick={() => onNavigate(a.id)} primary />
                  </PlaceRow>
                ))
              )}
            </>
          )}

          {tab === 'favorites' && (
            <>
              {user.favorites.length === 0 ? (
                <p className="dp-empty">No favorites yet. Open any place and tap Favorite to save it here.</p>
              ) : (
                places(user.favorites)
                  .sort((a, b) => (metres.get(a.id) ?? Infinity) - (metres.get(b.id) ?? Infinity))
                  .map((a) => (
                    <PlaceRow key={a.id} place={a} metres={metres.get(a.id)} visited={is.visited(a.id)} onOpen={() => onOpenPlace(a.id)}>
                      <RowButton icon="heartFilled" label={`Remove ${a.name} from favorites`} onClick={() => userPark.toggleFavorite(a.id)} />
                      <RowButton icon="navigate" label={`Navigate to ${a.name}`} onClick={() => onNavigate(a.id)} primary />
                    </PlaceRow>
                  ))
              )}
            </>
          )}

          {tab === 'visited' && (
            <>
              {Progress}
              {user.visited.length === 0 ? (
                <p className="dp-empty">Nothing marked as visited yet. When you reach a place, tap Mark as visited.</p>
              ) : (
                <>
                  {places([...user.visited].reverse())
                    .slice(0, showAllVisited ? undefined : 8)
                    .map((a) => (
                      <PlaceRow key={a.id} place={a} visited favorite={is.fav(a.id)} onOpen={() => onOpenPlace(a.id)}>
                        <RowButton icon="close" label={`Mark ${a.name} as not visited`} onClick={() => userPark.toggleVisited(a.id)} />
                      </PlaceRow>
                    ))}
                  {user.visited.length > 8 && !showAllVisited && (
                    <button type="button" className="dp-link" onClick={() => setShowAllVisited(true)}>
                      Show all {user.visited.length}
                    </button>
                  )}
                </>
              )}
            </>
          )}

          {tab === 'facilities' && (
            <>
              {facilities.restroom && (
                <PlaceRow
                  place={facilities.restroom}
                  metres={metres.get(facilities.restroom.id)}
                  note={`Nearest restrooms. Others at ${FACILITIES.restroom.filter((a) => a !== facilities.restroom).map((a) => a.name).join(', ')}`}
                  onOpen={() => onOpenPlace(facilities.restroom.id)}
                >
                  <RowButton icon="navigate" label={`Navigate to the restrooms at ${facilities.restroom.name}`} onClick={() => onNavigate(facilities.restroom.id)} primary />
                </PlaceRow>
              )}
              {facilities.water && (
                <PlaceRow
                  place={facilities.water}
                  metres={metres.get(facilities.water.id)}
                  note={`Nearest ${AMENITY_LABEL.water.toLowerCase()}. Others at ${FACILITIES.water.filter((a) => a !== facilities.water).map((a) => a.name).join(', ')}`}
                  onOpen={() => onOpenPlace(facilities.water.id)}
                >
                  <RowButton icon="navigate" label={`Navigate to the drinking water at ${facilities.water.name}`} onClick={() => onNavigate(facilities.water.id)} primary />
                </PlaceRow>
              )}
              {facilities.services.map((a) => (
                <PlaceRow key={a.id} place={a} metres={metres.get(a.id)} onOpen={() => onOpenPlace(a.id)}>
                  <RowButton icon="navigate" label={`Navigate to ${a.name}`} onClick={() => onNavigate(a.id)} primary />
                </PlaceRow>
              ))}
              {facilities.food && (
                <PlaceRow place={facilities.food} metres={metres.get(facilities.food.id)} note={`Nearest food. ${categoryLine(facilities.food)}`} onOpen={() => onOpenPlace(facilities.food.id)}>
                  <RowButton icon="navigate" label={`Navigate to ${facilities.food.name}`} onClick={() => onNavigate(facilities.food.id)} primary />
                </PlaceRow>
              )}
              <p className="dp-hint">Only facilities marked on the park map are listed.</p>
            </>
          )}
        </div>
      </section>
    </>
  );
}
