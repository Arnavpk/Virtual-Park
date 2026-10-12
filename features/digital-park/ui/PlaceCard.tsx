import { useMemo } from 'react';
import { DESCRIPTIONS } from '../data/copy';
import { ATTRACTIONS } from '../data/park';
import type { Attraction, Vec2 } from '../data/types';
import { usePlaceDistances } from '../hooks/usePlaceDistances';
import { formatMetres, type Route } from '../lib/pathfinding';
import { AMENITY_LABEL, categoryLine } from '../lib/places';
import { isRecommendable, whatNext } from '../lib/recommend';
import { userPark, useUserPark } from '../state/userPark';
import { Icon } from './icons';

/**
 * The card at the top of the screen for the chosen place. It has three states:
 * information (what it is, how far, Navigate, and save/plan/visited buttons),
 * navigating (distance remaining, Cancel) and arrived (mark as visited, and a
 * suggestion for where to go next, which the visitor is free to ignore).
 */
export function PlaceCard({
  place,
  route,
  navigating,
  arrived,
  getHere,
  onNavigate,
  onNavigateTo,
  onCancel,
  onClear,
}: {
  place: Attraction;
  route: Route | null;
  navigating: boolean;
  arrived: boolean;
  /** The visitor's current position (joystick or GPS). */
  getHere: () => Vec2;
  onNavigate: () => void;
  /** Start navigating to a different place (the "next" suggestion). */
  onNavigateTo: (id: string) => void;
  onCancel: () => void;
  onClear: () => void;
}) {
  const user = useUserPark();
  const favorite = user.favorites.includes(place.id);
  const planned = user.myDay.includes(place.id);
  const visited = user.visited.includes(place.id);
  const description = DESCRIPTIONS[place.id];
  const far = route && route.metres >= 15;

  // On arrival, work out one suggestion for what to do next. Only then; never while walking.
  const metres = usePlaceDistances(arrived, getHere);
  const next = useMemo(
    () => (arrived && metres.size ? whatNext({ places: ATTRACTIONS, metres, user, exclude: [place.id] }) : null),
    [arrived, metres, user, place.id],
  );

  let status: string;
  if (arrived) status = "You've arrived!";
  else if (!route) status = 'No walking route from here';
  else if (navigating) status = far ? `${formatMetres(route.metres, true)} to go, about ${route.minutes} min` : 'Almost there';
  else status = far ? `${formatMetres(route.metres)} away, about ${route.minutes} min walk` : 'A few steps away';

  const toggles = (
    <div className="dp-card__toggles">
      <button type="button" className={`dp-toggle${favorite ? ' is-on dp-toggle--fav' : ''}`} aria-pressed={favorite} onClick={() => userPark.toggleFavorite(place.id)}>
        <Icon name={favorite ? 'heartFilled' : 'heart'} size={17} />
        Favorite
      </button>
      <button type="button" className={`dp-toggle${planned ? ' is-on' : ''}`} aria-pressed={planned} onClick={() => userPark.toggleMyDay(place.id)}>
        <Icon name={planned ? 'check' : 'plan'} size={17} />
        My Day
      </button>
      <button type="button" className={`dp-toggle${visited ? ' is-on dp-toggle--visited' : ''}`} aria-pressed={visited} onClick={() => userPark.toggleVisited(place.id)}>
        <Icon name="check" size={17} />
        Visited
      </button>
    </div>
  );

  return (
    <section className={`dp-card${navigating ? ' is-navigating' : ''}${arrived ? ' is-arrived' : ''}`} aria-label={navigating ? 'Navigation' : 'Selected place'}>
      <div className="dp-card__top">
        <span className={`dp-card__icon dp-tint--${place.category}`}>{place.id}</span>
        <div className="dp-card__text">
          {navigating && (
            <p className="dp-card__eyebrow">
              <Icon name="navigate" size={14} />
              Navigating to
            </p>
          )}
          <h2 className="dp-card__name">{place.name}</h2>
          {!navigating && (
            <p className="dp-card__kind">
              {categoryLine(place)}
              {visited && (
                <span className="dp-mark dp-mark--visited">
                  <Icon name="check" size={13} />
                  Visited
                </span>
              )}
            </p>
          )}
          {!navigating && place.amenities && place.amenities.length > 0 && (
            <p className="dp-card__amenities">
              {place.amenities.map((m) => (
                <span key={m} className={`dp-amenity dp-amenity--${m}`}>
                  <Icon name={m} size={14} />
                  {AMENITY_LABEL[m]}
                </span>
              ))}
            </p>
          )}
        </div>
        <button type="button" className="dp-icon-button" onClick={onClear} aria-label="Close and clear the route">
          <Icon name="close" size={20} />
        </button>
      </div>

      {!navigating && !arrived && description && <p className="dp-card__desc">{description}</p>}

      <div className="dp-card__bottom">
        {/* Announced when it changes state, but not on every distance tick while navigating. */}
        <p className="dp-card__status" role="status" aria-live={navigating ? 'off' : 'polite'}>
          {!arrived && <Icon name="pin" size={16} />}
          {status}
          {arrived && isRecommendable(place) && <span className="dp-card__cheer"> Have fun.</span>}
        </p>
        {!arrived && route && (
          <button type="button" className={`dp-button${navigating ? ' dp-button--quiet' : ''}`} onClick={navigating ? onCancel : onNavigate}>
            {!navigating && <Icon name="navigate" size={17} />}
            {navigating ? 'Cancel' : 'Navigate'}
          </button>
        )}
        {arrived && !visited && (
          <button type="button" className="dp-button" onClick={() => userPark.markVisited(place.id)}>
            <Icon name="check" size={17} />
            Mark as visited
          </button>
        )}
      </div>

      {/* On arrival the card already carries Mark as visited and a suggestion; the save buttons would crowd small screens. */}
      {!navigating && !arrived && toggles}

      {arrived && (
        <div className="dp-card__next">
          {next ? (
            <>
              <div className="dp-card__nexttext">
                <p className="dp-card__nextlabel">Next for you</p>
                <p className="dp-card__nextname">{next.place.name}</p>
                <p className="dp-card__kind">
                  {Number.isFinite(next.metres) ? `${formatMetres(next.metres)} away. ` : ''}
                  {next.reason}.
                </p>
              </div>
              <button type="button" className="dp-button dp-button--quiet" onClick={() => onNavigateTo(next.place.id)}>
                <Icon name="navigate" size={17} />
                Navigate
              </button>
            </>
          ) : metres.size ? (
            <p className="dp-card__kind">You've explored everything nearby. Try exploring another area of the park.</p>
          ) : null}
        </div>
      )}
    </section>
  );
}
