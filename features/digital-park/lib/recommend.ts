import { INTERESTS, interestMatch } from '../data/interests';
import type { Attraction } from '../data/types';
import type { UserPark } from '../state/userPark';

/**
 * "Recommended for you" and "What should I do next?".
 *
 * A plain, deterministic scoring rule: no AI, no network, no live data (the
 * park has no wait-time or opening feed, so none is pretended). Each place
 * gets points for fitting the visitor and loses points for distance; the
 * highest score wins. The weights are all in WEIGHTS so the behaviour is easy
 * to tune, and a future live-data factor would be one more line in `score`.
 *
 * It only needs a distance per place, so it works the same whether the
 * visitor's position came from the joystick or from GPS.
 */

export const WEIGHTS = {
  /** Per interest the place fits squarely (half for a partial fit). */
  interest: 3,
  favorite: 2,
  /** On the My Day list. */
  planned: 4,
  /** Extra for the first not-yet-visited item on My Day: "what's next on my plan". */
  nextPlanned: 3,
  /** Points lost per 100 m of walking. */
  per100m: 1.6,
  /** Food is only pushed forward when the visitor asked for it, saved it or planned it. */
  unpromptedFood: -3,
  /** Already-visited places sink to the bottom rather than vanish. */
  visited: -12,
};

export interface Suggestion {
  place: Attraction;
  /** Walking distance in metres; Infinity if unknown. */
  metres: number;
  score: number;
  /** One short line saying why it was suggested. */
  reason: string;
  visited: boolean;
}

/** Rides, attractions and food can be recommended. Services (First Aid, shops) are reached through Facilities instead. */
export const isRecommendable = (a: Attraction) => a.category !== 'service';

/** Places that count towards "explored": rides and attractions. Worked out from the data, never a fixed number. */
export const isExplorable = (a: Attraction) => a.category === 'ride' || a.category === 'attraction';

export function recommend(input: {
  places: Attraction[];
  /** Walking distance in metres from the visitor to each place, by id. */
  metres: Map<string, number>;
  user: UserPark;
  /** Places to leave out, e.g. the one the visitor has just arrived at. */
  exclude?: string[];
  limit?: number;
}): Suggestion[] {
  const { places, metres, user, exclude = [], limit } = input;
  const nextPlanned = user.myDay.find((id) => !user.visited.includes(id) && !exclude.includes(id));
  const out: Suggestion[] = [];

  for (const place of places) {
    if (!isRecommendable(place) || exclude.includes(place.id)) continue;
    const m = metres.get(place.id) ?? Infinity;
    const visited = user.visited.includes(place.id);
    const favorite = user.favorites.includes(place.id);
    const planned = user.myDay.includes(place.id);

    const fits = INTERESTS.filter((i) => user.interests.includes(i.id) && interestMatch(place, i.id) > 0);
    const fit = fits.reduce((s, i) => s + interestMatch(place, i.id), 0);

    let score = 0;
    score += Math.min(fit, 2) * WEIGHTS.interest;
    if (favorite) score += WEIGHTS.favorite;
    if (planned) score += WEIGHTS.planned;
    if (place.id === nextPlanned) score += WEIGHTS.nextPlanned;
    if (place.category === 'food' && !favorite && !planned && !user.interests.includes('food')) score += WEIGHTS.unpromptedFood;
    if (visited) score += WEIGHTS.visited;
    score -= (Number.isFinite(m) ? m / 100 : 20) * WEIGHTS.per100m;

    let reason: string;
    if (place.id === nextPlanned) reason = 'Next on your My Day list';
    else if (planned) reason = 'On your My Day list';
    else if (favorite) reason = 'One of your favorites';
    else if (fits.length) reason = `Matches your interests: ${fits.map((i) => i.label.toLowerCase()).join(', ')}`;
    else if (m < 120) reason = 'Close to you';
    else reason = visited ? 'You have been here' : "You haven't been here yet";

    out.push({ place, metres: m, score, reason, visited });
  }

  // Highest score first; ties go to the nearer place, then to map order, so the result never flickers.
  out.sort((a, b) => b.score - a.score || a.metres - b.metres || places.indexOf(a.place) - places.indexOf(b.place));
  return limit ? out.slice(0, limit) : out;
}

/** The single best thing to do next, or null when everything recommendable has been visited. */
export function whatNext(input: Parameters<typeof recommend>[0]): Suggestion | null {
  return recommend(input).find((s) => !s.visited) ?? null;
}

/** How much of the park has been explored. */
export function progress(places: Attraction[], user: UserPark) {
  const explorable = places.filter(isExplorable);
  const done = explorable.filter((a) => user.visited.includes(a.id)).length;
  return { done, total: explorable.length, percent: explorable.length ? Math.round((done / explorable.length) * 100) : 0 };
}
