/**
 * Checks location records, QR resolution, facilities and the new Summer Garden walk.
 * Run with: npm run test:locations
 */
import { ATTRACTION_GEO, LOCATIONS, locationById, locationUrl, resolveLocation } from '../features/digital-park/data/locations';
import { ATTRACTIONS } from '../features/digital-park/data/park';
import { parkGeoConfig } from '../features/digital-park/data/parkGeoConfig';
import { isBlocked } from '../features/digital-park/lib/collision';
import { DOORS } from '../features/digital-park/lib/layout';
import { findRoute } from '../features/digital-park/lib/pathfinding';
import { FACILITIES, nearestFacility, searchPlaces } from '../features/digital-park/lib/places';
import { isWalkable } from '../features/digital-park/lib/walkgrid';

let failed = 0;
const check = (name: string, ok: boolean, detail = '') => {
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? '  ' + detail : ''}`);
};

// ---- Location records
const ids = LOCATIONS.map((l) => l.id);
check('location ids are unique', new Set(ids).size === ids.length, `${ids.length} locations`);
check('location codes are unique', new Set(LOCATIONS.map((l) => l.code.toUpperCase())).size === ids.length);
check('every id is URL-safe', ids.every((id) => /^[a-z0-9-]{1,40}$/.test(id)));
check('every location is on walkable ground', LOCATIONS.every((l) => isWalkable(l.world.x, l.world.z)), LOCATIONS.filter((l) => !isWalkable(l.world.x, l.world.z)).map((l) => l.id).join(' '));
check('the entrance, all 12 junctions and every place have a location', !!locationById('gate') && parkGeoConfig.referencePoints.every((r) => locationById(r.id!)) && ATTRACTIONS.every((a) => locationById(`place-${a.id.toLowerCase()}`)));

// ---- QR resolution
const p3 = locationById('p3')!;
check('id resolves', resolveLocation('p3') === p3);
check('printed code resolves, any case', resolveLocation(' P3 ') === p3 && resolveLocation('17')?.placeId === '17' && resolveLocation('gate')?.kind === 'entrance');
check('a park URL resolves by its loc id', resolveLocation('https://park.example/?loc=place-17')?.placeId === '17');
const spoof = resolveLocation('https://park.example/?loc=place-17&lat=18.1&lon=73.1&x=999&z=999')!;
check('coordinates in a URL are ignored; the known record is used', spoof.placeId === '17' && spoof.world === DOORS['17']);
check('a URL without a known id is rejected', resolveLocation('https://park.example/?lat=18.76&lon=73.51') === null && resolveLocation('https://park.example/?loc=nowhere') === null);
check('junk is rejected', ['', '   ', 'javascript:alert(1)', '<script>', 'p3; drop', 'P99', '../p3', 'x'.repeat(500)].every((s) => resolveLocation(s) === null));
check('locationUrl carries only the id', locationUrl(p3, 'https://park.example/somewhere?x=1#y') === 'https://park.example/somewhere?loc=p3');
check('round trip: URL → location', resolveLocation(locationUrl(locationById('place-e')!, 'https://park.example/')) === locationById('place-e'));

// ---- Attraction geo records
const r = ATTRACTION_GEO['2'];
check('R-surveyed rides keep "coordinate" and "entranceFace" separately', !!r.surveyed && r.surveyed.coordinate.longitude !== r.surveyed.entranceFace.longitude && r.status === 'survey-unconfirmed');
check('rides without a survey reading are marked derived, not surveyed', ATTRACTION_GEO['22'].status === 'derived' && ATTRACTION_GEO['22'].surveyed === null);

// ---- Facilities
const restrooms = FACILITIES.restroom.map((a) => a.id).sort().join('');
const water = FACILITIES.water.map((a) => a.id).sort().join('');
check('restrooms are at A, B, D and H', restrooms === 'ABDH', restrooms);
check('drinking water is at A, B and E', water === 'ABE', water);
check('no duplicate places were created for facilities', ATTRACTIONS.length === 47);
check('"toilet" finds the restrooms', searchPlaces(ATTRACTIONS, 'toilet').map((a) => a.id).sort().join('') === 'ABDH');
check('"washroom" and "restroom" find them too', searchPlaces(ATTRACTIONS, 'washroom').length === 4 && searchPlaces(ATTRACTIONS, 'restroom').length === 4);
check('"water" finds the drinking water points', ['A', 'B', 'E'].every((id) => searchPlaces(ATTRACTIONS, 'drinking water').some((a) => a.id === id)));
const near = nearestFacility('restroom', DOORS['2']);
check('nearest restroom from Turbo Force is found with a walking distance', !!near && Number.isFinite(near.metres), near ? `${near.place.id} ${near.place.name}, ${Math.round(near.metres)} m` : '');
const nearW = nearestFacility('water', DOORS['17']);
check('nearest drinking water from Sky Screamer is found', !!nearW, nearW ? `${nearW.place.id} ${nearW.place.name}, ${Math.round(nearW.metres)} m` : '');

// ---- The Summer Garden walk (between Giant Frisbee / Z Force, in front of Summer Garden)
const walkCells = [
  { x: 34.5, z: -45 },
  { x: 34.5, z: -40 },
  { x: 34, z: -36 },
  { x: 29, z: -32 },
];
check('the new walk is walkable along its length', walkCells.every((p) => isWalkable(p.x, p.z) && !isBlocked(p.x, p.z)));
const viaWalk = findRoute(DOORS['22'], DOORS['24'])!;
check('Giant Frisbee → Z Force uses the new walk', viaWalk.metres < 150 && viaWalk.points.some((p) => p.x > 30 && p.x < 37 && p.z > -48 && p.z < -34), `${Math.round(viaWalk.metres)} m`);
const sg = findRoute(DOORS['E'], DOORS['24'])!;
check('Summer Garden → Z Force is a short walk now', sg.metres < 80, `${Math.round(sg.metres)} m`);

// ---- Walkable ground confirmed on site: under the Summer Garden parasols, and the path under the
//      trees between Space Trainer and Turbo Force.
check('the parasol terrace is walkable under the umbrellas', [{ x: 12.8, z: -31.7 }, { x: 8, z: -34 }, { x: 17, z: -29 }].every((p) => isWalkable(p.x, p.z) && !isBlocked(p.x, p.z)));
const terrace = findRoute(DOORS['E'], { x: 12.8, z: -31.7 });
check('...and a route reaches its middle from Summer Garden', !!terrace && terrace.metres < 60, terrace ? `${Math.round(terrace.metres)} m` : 'no route');
check('the path under the trees between Space Trainer and Turbo Force is walkable', [{ x: -25, z: 47 }, { x: -23, z: 52 }, { x: -19, z: 54.5 }].every((p) => isWalkable(p.x, p.z) && !isBlocked(p.x, p.z)));
const treeLine = findRoute({ x: -33, z: 36 }, DOORS['2'])!;
check('the road along the tree line now joins the Turbo Force road directly', !!treeLine && treeLine.points.some((p) => p.x > -27 && p.x < -17 && p.z > 47 && p.z < 57), `${Math.round(treeLine.metres)} m`);
check('the road up the east side of the Z Force lawn is continuous', [{ x: 60.5, z: -46 }, { x: 61, z: -52 }, { x: 61, z: -57 }].every((p) => isWalkable(p.x, p.z) && !isBlocked(p.x, p.z)));
const eastSide = findRoute({ x: 54, z: -38 }, { x: 61, z: -62 })!;
check('...and a route uses it instead of going round', !!eastSide && eastSide.metres < 45, eastSide ? `${Math.round(eastSide.metres)} m` : 'no route');

if (failed) {
  console.error(`\n${failed} check(s) failed`);
  process.exit(1);
}
console.log('\nAll location checks passed.');