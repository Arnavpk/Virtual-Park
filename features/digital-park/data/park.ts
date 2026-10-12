import type { Attraction, Category, Landmark, Vec2 } from './types';

/**
 * The real park, as data. Positions were measured from the two reference images
 * (aerial render for layout, marked map for which attraction is which) and are
 * in world units: x runs left to right across the map, z runs top to bottom,
 * exactly as the map is drawn. `position` is [x, y, z] with y (height) at 0.
 *
 * To move, rename or restyle something, edit it here. Walkable ground, water
 * outlines and trees are in park.generated.ts. After editing, run `npm run verify`.
 */

/** First estimate of the map scale. Once GPS is calibrated, distances use the measured scale instead (lib/geo.ts EFFECTIVE_METRES_PER_UNIT). */
export const METRES_PER_UNIT = 1.6;
export const WALK_METRES_PER_MIN = 70;

/** Where the visitor starts: just inside the entrance gate (snapped to the nearest walkable spot at load). */
export const SPAWN: Vec2 = { x: 44.2, z: 42.9 };

export const CATEGORIES: { id: Category; label: string }[] = [
  { id: 'ride', label: 'Rides' },
  { id: 'attraction', label: 'Attractions' },
  { id: 'food', label: 'Food' },
  { id: 'service', label: 'Services' },
];

/** Numbered 1-33 and lettered A-N exactly as on the park map legend. */
export const ATTRACTIONS: Attraction[] = [
  { id: '1', name: 'Rush Hour', category: 'ride', kind: 'Family ride', type: 'family', position: [22, 0, 62.1], model: 'hall', opts: { w: 26, d: 11, h: 5, rot: -28, color: '#EDE6D2', accent: '#F2A900' }, solid: { w: 27, d: 12, rot: -28 } },
  { id: '2', name: 'Turbo Force', category: 'ride', kind: 'High thrill', type: 'high', position: [-8.1, 0, 71.7], model: 'arm', opts: { h: 13, color: '#E65AA0', accent: '#FFC53D' }, solid: { r: 4 } },
  { id: '3', name: 'Samba Balloon', category: 'ride', kind: 'Family ride', type: 'family', position: [-2.9, 0, 44], model: 'spinner', opts: { variant: 'balloon', arms: 8, r: 4.5, color: '#FF5D73', accent: '#3D8BFF' }, solid: { r: 5 } },
  { id: '4', name: 'Delta Hoppla', category: 'ride', kind: 'Mid thrill', type: 'mid', position: [6.1, 0, 20.4], model: 'ferris', opts: { r: 4, color: '#FFC53D', accent: '#E5383B' }, solid: { r: 5 } },
  { id: '5', name: 'Space Trainer', category: 'ride', kind: 'Mid thrill', type: 'mid', position: [-21.4, 0, 35.6], model: 'arm', opts: { h: 8, color: '#6B5BD6', accent: '#3DDC97', variant: 'gyro' }, solid: { r: 4.5 } },
  { id: '6', name: 'Magic Bike', category: 'ride', kind: 'Family ride', type: 'family', position: [-14.2, 0, 12.5], model: 'spinner', opts: { variant: 'pod', arms: 6, r: 4, color: '#FF8A3D', accent: '#3D8BFF' }, solid: { r: 4.5 } },
  { id: '7', name: 'Surf\'s Up', category: 'ride', kind: 'Family ride', type: 'family', position: [-20, 0, -15.9], model: 'surf', opts: { len: 18, rot: -78, color: '#FFFFFF', accent: '#FF5D73' } },
  { id: '8', name: 'Kite Flyer', category: 'ride', kind: 'Family ride', type: 'family', position: [-33.3, 0, -29.8], model: 'spinner', opts: { variant: 'kite', arms: 6, r: 4.5, tilt: 0.28, color: '#3D8BFF', accent: '#FFC53D' }, solid: { r: 4.5 } },
  { id: '9', name: 'Sky Race', category: 'ride', kind: 'Family ride', type: 'family', position: [-51.6, 0, -13.5], model: 'spinner', opts: { variant: 'plane', arms: 8, r: 4.5, color: '#E5383B', accent: '#FFC53D' }, solid: { r: 4.5 } },
  { id: '10', name: 'Junior Jet', category: 'ride', kind: 'Kids ride', type: 'kids', position: [-61.8, 0, -0.6], model: 'spinner', opts: { variant: 'plane', arms: 6, r: 3.2, color: '#FFC53D', accent: '#E5383B' }, solid: { r: 3.5 } },
  { id: '11', name: 'Crazy Surf', category: 'ride', kind: 'Family ride', type: 'family', position: [-78.9, 0, -10.1], model: 'halfpipe', opts: { w: 8, d: 4, rot: -25, color: '#3D8BFF', accent: '#FFC53D' }, solid: { r: 4 } },
  { id: '12', name: 'Wave Blaster', category: 'ride', kind: 'Family ride', type: 'family', position: [-94.1, 0, -25.2], model: 'spinner', opts: { variant: 'pod', arms: 8, r: 4.5, color: '#17A398', accent: '#FFC53D' }, solid: { r: 4.5 } },
  { id: '13', name: 'Jump\'in Star', category: 'ride', kind: 'Family ride', type: 'family', position: [-74.6, 0, -34.8], model: 'tower', opts: { h: 7, r: 0.5, color: '#FFC53D', accent: '#E5383B', top: 'ring' }, solid: { r: 3 } },
  { id: '14', name: 'Mini Ferris Wheel', category: 'ride', kind: 'Kids ride', type: 'kids', position: [-62.8, 0, -43], model: 'ferris', opts: { r: 4.5, color: '#E5383B', accent: '#FFC53D' }, solid: { r: 4.5 } },
  { id: '15', name: 'Water Mania', category: 'ride', kind: 'Family ride', type: 'family', position: [-45.4, 0, -45.5], model: 'spinner', opts: { variant: 'pod', arms: 6, r: 4.5, color: '#2FC3DA', accent: '#FFC53D', wet: true }, solid: { r: 4.5 } },
  { id: '16', name: 'Truck n Trail', category: 'ride', kind: 'Kids ride', type: 'kids', position: [-79.7, 0, -72], model: 'track', opts: { rx: 9, rz: 4.2, rot: 12, color: '#8D8F96', accent: '#E5383B' }, solid: { w: 19, d: 8.5, rot: 12 } },
  { id: '17', name: 'Sky Screamer', category: 'ride', kind: 'Mid thrill', type: 'mid', position: [-47.1, 0, -67.5], model: 'tower', opts: { h: 24, r: 0.7, color: '#E9EEF2', accent: '#3D8BFF', top: 'star' }, solid: { r: 3.2 } },
  { id: '18', name: 'Top Spin Suspended', category: 'ride', kind: 'High thrill', type: 'high', position: [-17, 0, -71.5], model: 'topspin', opts: { w: 10, h: 8, rot: 0, color: '#FFC53D', accent: '#3D8BFF' }, solid: { r: 6 } },
  { id: '19', name: '5D Theatre / Lanka Dahan', category: 'attraction', kind: '', position: [-19.2, 0, -104.7], model: 'hall', opts: { w: 13, d: 10, h: 6.5, rot: 0, color: '#DCDDE6', accent: '#1F3A6E', sign: '#E5383B' }, solid: { w: 14, d: 11, rot: 0 } },
  { id: '20', name: 'Mega Disco', category: 'ride', kind: 'Mid thrill', type: 'mid', position: [5.1, 0, -102.4], model: 'disco', opts: { len: 17, rot: 3, color: '#F2C230', accent: '#E5383B' }, solid: { w: 18, d: 6, rot: 3 } },
  { id: '21', name: 'Super Splash', category: 'ride', kind: 'Mid thrill', type: 'mid', position: [30.4, 0, -81.1], model: 'splash', opts: { h: 24, rot: 28, color: '#2A56B8', accent: '#EDE6D2' } },
  { id: '22', name: 'Giant Frisbee', category: 'ride', kind: 'High thrill', type: 'high', position: [11.9, 0, -53.1], model: 'frisbee', opts: { h: 15, rot: -12, color: '#F28A1E', accent: '#2A56B8' }, solid: { r: 6 } },
  { id: '23', name: 'Flying Carousel', category: 'ride', kind: 'Mid thrill', type: 'mid', position: [-3.6, 0, -31.2], model: 'carousel', opts: { variant: 'umbrella', r: 4.5, h: 7, color: '#E5383B', accent: '#FFC53D' }, solid: { r: 5 } },
  { id: '24', name: 'Z Force', category: 'ride', kind: 'Mid thrill', type: 'mid', position: [35.1, 0, -16.7], model: 'tower', opts: { h: 24, r: 0.8, color: '#FF5D73', accent: '#FFC53D', top: 'ring', rainbow: true, base: 3.4 }, solid: { r: 3.6 } },
  { id: '25', name: 'Flipping Arm', category: 'ride', kind: 'High thrill', type: 'high', position: [67.6, 0, -75.4], model: 'arm', opts: { h: 6.5, color: '#E5383B', accent: '#FFFFFF' }, solid: { r: 3.5 } },
  { id: '26', name: 'Air Race', category: 'ride', kind: 'Mid thrill', type: 'mid', position: [69, 0, -34.9], model: 'spinner', opts: { variant: 'plane', arms: 6, r: 5.5, tilt: 0.15, color: '#2A56B8', accent: '#E5383B' }, solid: { r: 5.5 } },
  { id: '27', name: 'Demolition Derby', category: 'ride', kind: 'Family ride', type: 'family', position: [73.6, 0, 5.6], model: 'bumper', opts: { rx: 6.5, rz: 4.5, rot: -18, color: '#E5383B', accent: '#FFC53D' }, solid: { r: 5 } },
  { id: '28', name: 'Galleon', category: 'ride', kind: 'Family ride', type: 'family', position: [70.5, 0, 27], model: 'ship', opts: { h: 8, rot: -30, color: '#8A5A33', accent: '#FFC53D' } },
  { id: '29', name: 'Carnival Carousel', category: 'ride', kind: 'Family ride', type: 'family', position: [30.7, 0, 23], model: 'carousel', opts: { variant: 'tent', r: 6, h: 6, color: '#2A56B8', accent: '#FFFFFF' }, solid: { r: 6.5 } },
  { id: '30', name: 'You Are The Star', category: 'attraction', kind: '', position: [77.4, 0, -60.3], model: 'hall', opts: { w: 28, d: 12, h: 7, rot: -40, color: '#F4F4F0', accent: '#1F3A6E' }, solid: { w: 29, d: 13, rot: -40 } },
  { id: '31', name: 'Musical Fountain', category: 'attraction', kind: '', position: [6.2, 0, -11.7], model: 'fountain', opts: { variant: 'lake', r: 5 } },
  { id: '32', name: 'Dynamic Fountain', category: 'attraction', kind: '', position: [-24.7, 0, -46.3], model: 'fountain', opts: { variant: 'plaza', r: 3.2 }, solid: { r: 3.2 } },
  { id: '33', name: 'Kids Play Area', category: 'attraction', kind: '', position: [-83.1, 0, -48.5], model: 'playground', opts: { r: 6, color: '#FF5D73', accent: '#3D8BFF' }, solid: { r: 4.5 } },
  { id: 'A', name: 'Windmill Cafe', category: 'food', kind: 'Mini meals', position: [-41.5, 0, 7.1], model: 'windmill', opts: { w: 22, d: 14, h: 5, rot: -28, color: '#BFE3F5', accent: '#1F3A6E' }, solid: { w: 23, d: 15, rot: -28 }, amenities: ['restroom', 'water'] },
  { id: 'B', name: 'Zen Forest', category: 'food', kind: 'Multi-cuisine', position: [-47.4, 0, -99.3], model: 'hall', opts: { w: 24, d: 14, h: 5, rot: 0, color: '#9C6634', accent: '#1F3A6E' }, solid: { w: 25, d: 15, rot: 0 }, amenities: ['restroom', 'water'] },
  { id: 'C', name: 'The Deck', category: 'food', kind: 'Oriental', position: [54.1, 0, -90.1], model: 'hall', opts: { w: 16, d: 9, h: 4, rot: -38, color: '#B08C5A', accent: '#7A5C3A' }, solid: { w: 17, d: 10, rot: -38 } },
  { id: 'D', name: 'Santa Maria', category: 'food', kind: 'Snacks', position: [65.2, 0, 48.1], model: 'shipcafe', opts: { w: 12, d: 10, h: 4, rot: -25, color: '#B9552F', accent: '#1F3A6E' }, solid: { w: 13, d: 11, rot: -25 }, amenities: ['restroom'] },
  { id: 'E', name: 'Summer Garden', category: 'food', kind: 'Pizza & burgers', position: [27.6, 0, -41.3], model: 'garden', opts: { w: 10.5, d: 7.5, h: 4.5, rot: -35, color: '#F4F4F0', accent: '#2E7D4F' }, solid: { w: 11.5, d: 8.5, rot: -35 }, amenities: ['water'] },
  { id: 'F', name: 'Swirl Station', category: 'food', kind: 'Cold Stone ice cream', position: [-35.6, 0, -12.3], model: 'kiosk', opts: { w: 4, d: 4, h: 3, rot: -20, color: '#F7C6E0', accent: '#C2408C' }, solid: { w: 5, d: 5, rot: -20 } },
  { id: 'G', name: 'First Aid', category: 'service', kind: '', position: [-66, 0, -22.2], model: 'kiosk', opts: { w: 4.5, d: 4, h: 3, rot: 0, color: '#FFFFFF', accent: '#E5383B', cross: true }, solid: { w: 5.5, d: 5, rot: 0 } },
  { id: 'H', name: 'Platform 93%', category: 'food', kind: 'Kiddie snacks', position: [-96.4, 0, -48.7], model: 'kiosk', opts: { w: 9, d: 3.5, h: 3.2, rot: 62, color: '#F28A1E', accent: '#2A56B8' }, solid: { w: 10, d: 4.5, rot: 62 }, amenities: ['restroom'] },
  { id: 'I', name: 'The Chatery', category: 'food', kind: 'Chaat counter', position: [-31.6, 0, -86.8], model: 'kiosk', opts: { w: 8, d: 3.5, h: 3, rot: -24, color: '#A9713F', accent: '#6E4423' }, solid: { w: 9, d: 4.5, rot: -24 } },
  { id: 'J', name: 'Essentials', category: 'service', kind: 'Merchandise', position: [-6.5, 0, -87.3], model: 'kiosk', opts: { w: 4.5, d: 4, h: 3, rot: 0, color: '#FFF1D6', accent: '#E5383B' }, solid: { w: 5.5, d: 5, rot: 0 } },
  { id: 'K', name: 'The Smoothie Life', category: 'food', kind: 'Shakes & smoothies', position: [13.5, 0, -75.6], model: 'kiosk', opts: { w: 4, d: 4, h: 3, rot: 0, color: '#FFE9A8', accent: '#3DAA5C' }, solid: { w: 5, d: 5, rot: 0 } },
  { id: 'L', name: 'Cream Scream', category: 'food', kind: 'Cakes & bakes', position: [44.6, 0, -38.5], model: 'kiosk', opts: { w: 5, d: 4.5, h: 3.2, rot: -30, color: '#FFF1D6', accent: '#C2408C' }, solid: { w: 6, d: 5.5, rot: -30 } },
  { id: 'M', name: 'Refuel', category: 'food', kind: 'Snacks & beverages', position: [52, 0, 2.7], model: 'kiosk', opts: { w: 5, d: 4, h: 3, rot: -20, color: '#DDEBFF', accent: '#2A56B8' }, solid: { w: 6, d: 5, rot: -20 } },
  { id: 'N', name: 'Maze Garden', category: 'attraction', kind: '', position: [4.6, 0, -85.5], model: 'maze', opts: { w: 11, d: 8, rot: -10, color: '#2E7D4F' } },
];

/** Unnumbered structures that help people get their bearings. */
export const LANDMARKS: Landmark[] = [
  { id: 'service-building', kind: 'hall', position: [-76.9, 0, -96.2], opts: { w: 20, d: 18, h: 8, rot: -3, color: '#F4F4F0', accent: '#1F3A6E' }, solid: { w: 21, d: 19, rot: -3 } },
  { id: 'gate-house', kind: 'gate', position: [48.7, 0, 57.2], opts: { w: 15, d: 7, h: 5, rot: -40, color: '#DCE6EC', accent: '#5B7C99' }, solid: { w: 16, d: 8, rot: -40 } },
  { id: 'entrance-plaza', kind: 'plaza', position: [60.4, 0, 80.2], opts: { r: 19 } },
  { id: 'east-building', kind: 'hall', position: [98.7, 0, -5], opts: { w: 13, d: 10, h: 10, rot: -35, color: '#D9DBD6', accent: '#B9BDB6' }, solid: { w: 14, d: 11, rot: -35 } },
  { id: 'summer-garden-parasols', kind: 'parasols', position: [12.8, 0, -31.7], opts: { r: 8 } },
  { id: 'round-pool', kind: 'pool', position: [54.8, 0, -14.7], opts: { r: 3.6 }, solid: { r: 4 } },
];

export const getAttraction = (id: string | null | undefined) => ATTRACTIONS.find((a) => a.id === id) ?? null;