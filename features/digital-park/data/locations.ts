import { DOORS, START } from '../lib/layout';
import { PARK_CALIBRATION, distanceMetres, referenceGps, referenceWorld, worldToGps, type LatLon } from '../lib/geo';
import { ATTRACTIONS } from './park';
import { parkGeoConfig } from './parkGeoConfig';
import type { Vec2 } from './types';

/**
 * Known spots in the park, each with a stable id. They are what a QR code
 * resolves to: a code carries only an id, never coordinates, and an id that
 * isn't listed here is rejected. To add a spot (a new junction, a facility),
 * add a record below with a fresh id; existing ids must never be reused for a
 * different spot, because printed codes point at them.
 *
 * `world` is where the character is placed. It comes from the park data
 * (survey reference points, or the spot on the paving in front of a place)
 * and is never invented here.
 */

export type LocationKind = 'entrance' | 'junction' | 'place';

export interface ParkLocation {
  /** Stable, URL-safe id, used in QR codes: `?loc=<id>`. */
  id: string;
  /** Short code printed under the QR code, for typing in by hand. */
  code: string;
  name: string;
  kind: LocationKind;
  /** Where the character is placed, in world coordinates. */
  world: Vec2;
  /** The attraction this spot belongs to, if any. */
  placeId?: string;
  /**
   * 'surveyed' = GPS readings were taken at this exact spot (P points).
   * 'map' = position comes from the 3D map only; no reading was taken here.
   */
  verification: 'surveyed' | 'map';
  /** How sure the world position is, in metres; used to weigh it against GPS. */
  accuracyMetres: number;
  /** Where it is, in words, for places that have no name of their own. */
  note?: string;
}

const ID_PATTERN = /^[a-z0-9-]{1,40}$/;

function build(): ParkLocation[] {
  const list: ParkLocation[] = [
    { id: 'gate', code: 'GATE', name: 'Main entrance', kind: 'entrance', world: START, verification: 'map', accuracyMetres: 8 },
  ];
  for (const ref of parkGeoConfig.referencePoints) {
    const world = referenceWorld(ref);
    if (!ref.id || !world) continue;
    const between = ref.label.replace(/^P\d+:\s*/, '');
    list.push({
      id: ref.id.toLowerCase(),
      code: ref.id,
      name: `Junction ${ref.id}`,
      kind: 'junction',
      world,
      verification: referenceGps(ref) ? 'surveyed' : 'map',
      accuracyMetres: 5,
      note: between, // "open paving between ..."
    });
  }
  for (const a of ATTRACTIONS) {
    list.push({
      id: `place-${a.id.toLowerCase()}`,
      code: a.id,
      name: a.name,
      kind: 'place',
      world: DOORS[a.id],
      placeId: a.id,
      verification: 'map',
      accuracyMetres: 8,
    });
  }
  return list;
}

export const LOCATIONS: readonly ParkLocation[] = build();
const BY_ID = new Map(LOCATIONS.map((l) => [l.id, l]));
const BY_CODE = new Map(LOCATIONS.map((l) => [l.code.toUpperCase(), l]));

/** Looks up an id from a QR code. Anything malformed or unknown gives null. */
export function locationById(id: unknown): ParkLocation | null {
  if (typeof id !== 'string') return null;
  const clean = id.trim().toLowerCase();
  return ID_PATTERN.test(clean) ? (BY_ID.get(clean) ?? null) : null;
}

/**
 * Resolves whatever a visitor scanned or typed: a full park URL with
 * `?loc=<id>`, a bare id ('place-17'), or the short printed code ('17', 'P3',
 * 'GATE'). Coordinates in the input are never used.
 */
export function resolveLocation(input: string): ParkLocation | null {
  const text = input.trim();
  if (!text || text.length > 300) return null;
  let id: string | null = null;
  if (/^https?:\/\//i.test(text)) {
    try {
      const url = new URL(text);
      if (typeof window !== 'undefined' && url.host !== window.location.host) return null; // someone else's code
      id = url.searchParams.get('loc');
    } catch {
      return null;
    }
  } else {
    id = text;
  }
  if (!id) return null;
  return locationById(id) ?? BY_CODE.get(id.trim().toUpperCase()) ?? null;
}

/** The URL a QR code for `location` should carry. */
export function locationUrl(location: ParkLocation, base: string): string {
  const url = new URL(base);
  url.search = '';
  url.hash = '';
  url.searchParams.set('loc', location.id);
  return url.toString();
}

// ---------------------------------------------------------------- attraction geo records

export interface AttractionGeo {
  placeId: string;
  /** Centre of the model in the 3D park. */
  world: Vec2;
  /** Spot on the paving in front of it (where routes end). */
  door: Vec2;
  /** A GPS reading taken at the ride, if one exists ("coordinate" on the survey). */
  surveyed: { surveyId: string; coordinate: LatLon; entranceFace: LatLon; mapping: 'survey-sheet' | 'confirmed' } | null;
  /** Where the current calibration puts the model centre on Earth. Derived, not measured. */
  derived: LatLon | null;
  /**
   * 'surveyed' = has a reading and its ride mapping is confirmed;
   * 'survey-unconfirmed' = has a reading, mapping from the survey sheet only;
   * 'derived' = no reading, coordinate comes from the calibration;
   * 'none' = no calibration yet.
   */
  status: 'surveyed' | 'survey-unconfirmed' | 'derived' | 'none';
}

export const ATTRACTION_GEO: Record<string, AttractionGeo> = Object.fromEntries(
  ATTRACTIONS.map((a) => {
    const world = { x: a.position[0], z: a.position[2] };
    const r = parkGeoConfig.ridePoints?.find((p) => p.surveySheetPlace === a.id);
    const surveyed = r
      ? {
          surveyId: r.id,
          coordinate: { latitude: r.coordinate[0], longitude: r.coordinate[1] },
          entranceFace: { latitude: r.entranceFace[0], longitude: r.entranceFace[1] },
          mapping: r.mappingStatus,
        }
      : null;
    const derived = PARK_CALIBRATION ? worldToGps(world, PARK_CALIBRATION) : null;
    const status: AttractionGeo['status'] = surveyed
      ? surveyed.mapping === 'confirmed'
        ? 'surveyed'
        : 'survey-unconfirmed'
      : derived
        ? 'derived'
        : 'none';
    return [a.id, { placeId: a.id, world, door: DOORS[a.id], surveyed, derived, status }];
  }),
);

/** Straight-line distance in metres between a GPS fix and a place, using its best available coordinate. */
export function metresToPlace(from: LatLon, placeId: string): number | null {
  const g = ATTRACTION_GEO[placeId];
  if (!g) return null;
  const to = g.surveyed && g.status === 'surveyed' ? g.surveyed.coordinate : g.derived;
  return to ? distanceMetres(from, to) : null;
}
