export type Vec2 = { x: number; z: number };

export type Category = 'ride' | 'attraction' | 'food' | 'service';

/** Facilities a place has on site, as confirmed by the park team. */
export type Amenity = 'restroom' | 'water';

/** Thrill level from the map legend. Only rides have one. */
export type RideType = 'family' | 'high' | 'mid' | 'kids';

export type ModelName =
  | 'spinner'
  | 'ferris'
  | 'tower'
  | 'frisbee'
  | 'topspin'
  | 'arm'
  | 'hall'
  | 'windmill'
  | 'shipcafe'
  | 'garden'
  | 'kiosk'
  | 'disco'
  | 'splash'
  | 'ship'
  | 'carousel'
  | 'bumper'
  | 'track'
  | 'surf'
  | 'fountain'
  | 'playground'
  | 'maze'
  | 'halfpipe';

/** Size and styling hints for a model. Lengths are world units; `rot` is degrees, anticlockwise seen from above. */
export interface ModelOptions {
  w?: number;
  d?: number;
  h?: number;
  r?: number;
  rx?: number;
  rz?: number;
  len?: number;
  rot?: number;
  color?: string;
  accent?: string;
  sign?: string;
  variant?: string;
  arms?: number;
  tilt?: number;
  top?: string;
  base?: number;
  rainbow?: boolean;
  wet?: boolean;
  cross?: boolean;
}

/** Ground the character cannot enter: a circle, or a rectangle turned by `rot` degrees. */
export type Solid = { r: number } | { w: number; d: number; rot: number };

export interface Attraction {
  /** Map code: '1'-'33' for rides and attractions, 'A'-'N' for food and services. */
  id: string;
  name: string;
  category: Category;
  /** Short line under the name, straight from the legend (thrill level or what's served). */
  kind: string;
  type?: RideType;
  /** [x, y, z] in world units. */
  position: [number, number, number];
  model: ModelName;
  opts: ModelOptions;
  solid?: Solid;
  /** Restrooms and/or drinking water at this place. */
  amenities?: Amenity[];
}

export interface Landmark {
  id: string;
  kind: 'hall' | 'gate' | 'plaza' | 'parasols' | 'pool';
  position: [number, number, number];
  opts: ModelOptions;
  solid?: Solid;
}

/** A closed outline with optional holes. Points are [x, z]. */
export interface Outline {
  outer: [number, number][];
  holes: [number, number][][];
}
