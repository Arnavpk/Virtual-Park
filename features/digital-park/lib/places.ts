import { ATTRACTIONS } from '../data/park';
import type { Amenity, Attraction, Vec2 } from '../data/types';
import { DOORS } from './layout';
import { walkingMetres } from './pathfinding';

/**
 * Searching and filtering the places in data/park.ts. There is no second
 * list: everything here reads the same ATTRACTIONS table the 3D scene uses.
 */

export type Filter = 'all' | 'near' | 'ride' | 'high' | 'mid' | 'family' | 'kids' | 'food' | 'attraction' | 'service' | Amenity;

/** In display order. 'near' is a way of sorting rather than a category, so it sits right after All. */
export const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'near', label: 'Near me' },
  { id: 'ride', label: 'Rides' },
  { id: 'high', label: 'High thrill' },
  { id: 'mid', label: 'Mid thrill' },
  { id: 'family', label: 'Family' },
  { id: 'kids', label: 'Kids' },
  { id: 'food', label: 'Food' },
  { id: 'attraction', label: 'Attractions' },
  { id: 'service', label: 'Services' },
  { id: 'restroom', label: 'Restrooms' },
  { id: 'water', label: 'Drinking water' },
];

export const AMENITY_LABEL: Record<Amenity, string> = { restroom: 'Restrooms', water: 'Drinking water' };
/** Extra words each facility can be searched by. */
const AMENITY_WORDS: Record<Amenity, string> = {
  restroom: 'restroom restrooms toilet toilets washroom washrooms wc loo bathroom',
  water: 'drinking water fountain water point refill',
};

/** Places with each facility, from the same ATTRACTIONS table (no separate records). */
export const FACILITIES: Record<Amenity, Attraction[]> = {
  restroom: ATTRACTIONS.filter((a) => a.amenities?.includes('restroom')),
  water: ATTRACTIONS.filter((a) => a.amenities?.includes('water')),
};

/** The facility of this kind with the shortest walk from `from`, or null if none can be reached. */
export function nearestFacility(kind: Amenity, from: Vec2): { place: Attraction; metres: number } | null {
  const places = FACILITIES[kind];
  const metres = walkingMetres(
    from,
    places.map((a) => DOORS[a.id]),
  );
  let best = -1;
  metres.forEach((m, i) => {
    if (Number.isFinite(m) && (best < 0 || m < metres[best])) best = i;
  });
  return best < 0 ? null : { place: places[best], metres: metres[best] };
}

export function matchesFilter(a: Attraction, f: Filter): boolean {
  switch (f) {
    case 'all':
    case 'near':
      return true;
    case 'high':
    case 'mid':
    case 'family':
    case 'kids':
      return a.type === f;
    case 'restroom':
    case 'water':
      return !!a.amenities?.includes(f);
    default:
      return a.category === f;
  }
}

const CATEGORY_LABEL = { ride: 'Ride', attraction: 'Attraction', food: 'Food', service: 'Service' } as const;

/** One line saying what a place is: "Mid thrill ride", "Food: Mini meals", "Attraction". */
export function categoryLine(a: Attraction): string {
  if (a.category === 'ride') return /ride$/i.test(a.kind) ? a.kind : `${a.kind} ride`;
  const label = CATEGORY_LABEL[a.category];
  return a.kind ? `${label}: ${a.kind}` : label;
}

const fold = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9% ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** Text each place can be found by: its name, map code and what it is. Built once. */
const HAYSTACK = new Map(
  ATTRACTIONS.map((a) => [
    a.id,
    { name: fold(a.name), all: fold(`${a.name} ${categoryLine(a)} ${a.id} ${(a.amenities ?? []).map((m) => AMENITY_WORDS[m]).join(' ')}`) },
  ]),
);

/**
 * Case-insensitive search. Every word typed must appear somewhere in the
 * place's name or description line; names that start with the query come first.
 */
export function searchPlaces(list: Attraction[], query: string): Attraction[] {
  const q = fold(query);
  if (!q) return list;
  const words = q.split(' ');
  const hits: { a: Attraction; rank: number }[] = [];
  for (const a of list) {
    const h = HAYSTACK.get(a.id)!;
    if (a.id.toLowerCase() === q) hits.push({ a, rank: 0 });
    else if (words.every((w) => h.all.includes(w))) hits.push({ a, rank: h.name.startsWith(q) ? 1 : h.name.includes(q) ? 2 : 3 });
  }
  return hits.sort((x, y) => x.rank - y.rank).map((h) => h.a);
}
