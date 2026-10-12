import type { Attraction } from './types';

/**
 * "What do you enjoy?" The choices offered to visitors and which places each
 * one covers.
 *
 * Thrill level, family, kids and food come straight from the map legend. The
 * park data has no field for the other three, so they are listed by map code
 * below. Those three lists are a first pass made from the ride names and the
 * park map: review them and edit freely.
 */

export type Interest = 'thrill' | 'family' | 'kids' | 'water' | 'food' | 'entertainment' | 'relaxing';

export const INTERESTS: { id: Interest; label: string }[] = [
  { id: 'thrill', label: 'High thrill' },
  { id: 'family', label: 'Family' },
  { id: 'kids', label: 'Kids' },
  { id: 'water', label: 'Water rides' },
  { id: 'food', label: 'Food' },
  { id: 'entertainment', label: 'Entertainment' },
  { id: 'relaxing', label: 'Relaxing' },
];

/** First pass, by map code. Edit to match the real park. */
const WATER_RIDES = ['7', '15', '21']; // Surf's Up, Water Mania, Super Splash
const ENTERTAINMENT = ['19', '30', '31', '32']; // 5D Theatre, You Are The Star, Musical Fountain, Dynamic Fountain
const RELAXING = ['N', '31', '32']; // Maze Garden and the two fountains
const KIDS_EXTRA = ['33']; // Kids Play Area (not a ride, so it has no thrill level)

/**
 * How well a place fits an interest: 1 = squarely, 0.5 = partly, 0 = not.
 * Mid-thrill rides count as a partial match for "High thrill".
 */
export function interestMatch(a: Attraction, interest: Interest): number {
  switch (interest) {
    case 'thrill':
      return a.type === 'high' ? 1 : a.type === 'mid' ? 0.5 : 0;
    case 'family':
      return a.type === 'family' ? 1 : 0;
    case 'kids':
      return a.type === 'kids' || KIDS_EXTRA.includes(a.id) ? 1 : 0;
    case 'water':
      return WATER_RIDES.includes(a.id) ? 1 : 0;
    case 'food':
      return a.category === 'food' ? 1 : 0;
    case 'entertainment':
      return ENTERTAINMENT.includes(a.id) ? 1 : 0;
    case 'relaxing':
      return RELAXING.includes(a.id) ? 1 : 0;
  }
}
