/**
 * GPS calibration for the park: how real-world latitude/longitude lines up
 * with the 3D park.
 *
 * ┌──────────────────────────────────────────────────────────────────────┐
 * │  PROVISIONAL. Fitted from the on-site survey of P1–P12 (three phone  │
 * │  readings each, no accuracy figures recorded). Checked against the   │
 * │  separate ride readings R1–R8: typical error ~10–15 m, worst ~30–40  │
 * │  m near the south and east edges. Not verified on site yet, so the   │
 * │  app calls GPS positions "approximate". Run `npm run test:geo` for   │
 * │  the full per-point report.                                          │
 * └──────────────────────────────────────────────────────────────────────┘
 *
 * What is here
 * - `referencePoints` (P1–P12): spots in the 3D park whose x/z are known
 *   (picked on the map before the survey), with the RAW readings taken
 *   standing there. The representative coordinate (the average, after an
 *   outlier check) is worked out in lib/geo.ts, so the raw readings are never
 *   edited by hand. These are the calibration's control points.
 * - `ridePoints` (R1–R8): readings taken at rides. Each has an `entranceFace`
 *   and a `coordinate` reading, kept separate because what each one marks on
 *   the ground hasn't been confirmed. Which ride each R is comes from the GPS
 *   survey sheet (park-gps-survey-sheet.pdf), not from the readings, so the
 *   mapping is marked 'survey-sheet' until confirmed. They are used only to
 *   CHECK the calibration, never to fit it, unless `use` is set to 'control'.
 *
 * How to improve or redo the calibration
 * 1. Add readings to an existing point's `readings` (raw, as recorded), or add
 *    a new point with an id, label, x/z (or `at`: an attraction/landmark id)
 *    and its readings. Several readings per point, taken a minute or two
 *    apart, average out the wobble.
 * 2. Spread points out. The south tip (entrance plaza, Turbo Force, Rush
 *    Hour) and the east edge have the fewest points and the largest errors.
 * 3. Run `npm run test:geo`: it prints every point's spread, fit error and
 *    leave-one-out error in metres and world units, plus the R checks.
 * 4. Only set `calibrationStatus` to 'verified' after walking the park with
 *    GPS Mode on and confirming the character sits where you stand.
 *
 * `latitude`/`longitude` on a reference point, when set, override the
 * computed representative (used by tests and for points measured once with a
 * survey-grade receiver). Leave them null to use the readings.
 */

/** [latitude, longitude] in decimal degrees, as recorded. */
export type LatLonPair = readonly [number, number];

export interface GeoReferencePoint {
  /** Survey id, e.g. 'P1'. */
  id?: string;
  /** For humans: where to stand or what to click on the satellite map. */
  label: string;
  /** Raw readings exactly as recorded on site. Never edit these to "fix" the fit. */
  readings?: readonly LatLonPair[];
  /** Explicit representative coordinate; overrides the readings when set. Null = use the readings. */
  latitude: number | null;
  longitude: number | null;
  /** Id of an attraction ('17') or landmark ('gate-house') in park.ts ... */
  at?: string;
  /** ... or explicit world coordinates. */
  x?: number;
  z?: number;
  /** 'control' (default) fits the calibration; 'check' only measures its error. */
  use?: 'control' | 'check';
}

export interface SurveyedRidePoint {
  /** Survey identifier, e.g. 'R1'. Not a ride name. */
  id: string;
  /** Map code of the ride this R was assigned to on the GPS survey sheet. */
  surveySheetPlace: string;
  /** 'survey-sheet' = taken from the sheet, not yet confirmed on site; 'confirmed' = the surveyor confirmed it. */
  mappingStatus: 'survey-sheet' | 'confirmed';
  /** Reading recorded as "entrance face". What it marks on the ground isn't confirmed. */
  entranceFace: LatLonPair;
  /** Reading recorded as "coordinate". What it marks on the ground isn't confirmed. */
  coordinate: LatLonPair;
  /** 'check' (default) = only measures calibration error. 'control' = also fits it (only once the mapping is confirmed). */
  use: 'check' | 'control';
  note?: string;
}

export interface ParkGeoConfig {
  referencePoints: GeoReferencePoint[];
  ridePoints?: SurveyedRidePoint[];
  /**
   * 'provisional' = fitted but not walked and confirmed on site. GPS Mode works,
   * but positions are described as approximate. 'verified' = confirmed on site.
   */
  calibrationStatus?: 'provisional' | 'verified';
  /**
   * Optional smooth local correction (thin-plate spline) on top of the
   * scale/rotation/shift fit, to soak up distortion in the 3D map. Off by
   * default: with only P1–P12 it made the independent R checks worse. Worth
   * re-testing once more points are surveyed. `smoothing` is in square metres
   * (bigger = gentler).
   */
  localCorrection?: { enabled: boolean; smoothing: number };
  /**
   * Fine adjustment in degrees on top of the rotation worked out from the
   * reference points. A positive value turns every GPS position clockwise on
   * the map (seen from above) about the middle of the reference points.
   * Leave at 0 unless on-site testing shows a consistent twist.
   */
  rotationOffsetDeg: number;
  /**
   * Only used when exactly one reference point is filled in: the scale and
   * compass direction can't be worked out from a single point, so they must
   * be stated. `northUpDeg` is the compass bearing that "up" on the map
   * (towards the top of the screen) points to; 0 means the map is north-up.
   */
  singlePointFallback: { metresPerUnit: number; northUpDeg: number };
  /** How far outside the paved park (in metres) a reading may be and still count as "in the park". */
  boundaryMarginMetres: number;
  /** Readings less accurate than this are shown as a weak signal (the character still follows). */
  weakAboveMetres: number;
  /** Readings less accurate than this are too unreliable to move the character at all. */
  ignoreAboveMetres: number;
  /** Movements smaller than this are treated as GPS noise. */
  minMoveMetres: number;
  /** Assumed walking speed, used to decide how quickly to trust a changing position. */
  walkingMetresPerSecond: number;
  /** Readings older than this (by the phone's own timestamp) are ignored as stale. */
  staleAfterSeconds?: number;
  /**
   * GPS positions within this distance of the paving are pulled onto it so the
   * character walks on the path; anything further stays where GPS put it.
   * Never snaps onto a path further away than this. 0 turns it off.
   */
  snapToPathMetres?: number;
}

export const parkGeoConfig: ParkGeoConfig = {
  // P1–P12 from the GPS survey sheet (park-gps-survey-sheet.pdf): the middles of open paved areas,
  // spread round the park. x and z are where each one sits in the 3D park (fixed before the survey).
  // Readings: three per point, phone GPS, recorded on site. P1's third reading is the corrected one.
  referencePoints: [
    { id: 'P1', label: 'P1: just inside the entrance gate, between D Santa Maria, 29 Carnival Carousel and 28 Galleon', x: 47.3, z: 42.9, latitude: null, longitude: null,
      readings: [[18.765199, 73.515651], [18.765187, 73.515683], [18.765225, 73.515622]] },
    { id: 'P2', label: 'P2: open paving between 2 Turbo Force, 3 Samba Balloon and 1 Rush Hour', x: -0.7, z: 60.9, latitude: null, longitude: null,
      readings: [[18.765131, 73.515121], [18.765185, 73.515122], [18.765102, 73.515127]] },
    { id: 'P3', label: 'P3: open paving between A Windmill Cafe, 5 Space Trainer and 10 Junior Jet', x: -47.5, z: 27.3, latitude: null, longitude: null,
      readings: [[18.765304, 73.514525], [18.765345, 73.514571], [18.7654, 73.514629]] },
    { id: 'P4', label: 'P4: open paving between 11 Crazy Surf, 12 Wave Blaster and 10 Junior Jet', x: -85.9, z: -4.5, latitude: null, longitude: null,
      readings: [[18.765956, 73.513888], [18.765905, 73.513945], [18.765833, 73.513982]] },
    { id: 'P5', label: 'P5: open paving between 8 Kite Flyer, 9 Sky Race and 15 Water Mania', x: -48.1, z: -29.1, latitude: null, longitude: null,
      readings: [[18.76606, 73.514319], [18.766097, 73.514397], [18.766115, 73.514302]] },
    { id: 'P6', label: 'P6: open paving between 33 Kids Play Area, 16 Truck n Trail and H Platform 93%', x: -78.1, z: -57.3, latitude: null, longitude: null,
      readings: [[18.766502, 73.513796], [18.766447, 73.513763], [18.766445, 73.513715]] },
    { id: 'P7', label: 'P7: open paving between B Zen Forest, 17 Sky Screamer and I The Chatery', x: -49.3, z: -83.7, latitude: null, longitude: null,
      readings: [[18.766856, 73.514427], [18.766844, 73.514492], [18.766814, 73.514524]] },
    { id: 'P8', label: 'P8: open paving between 32 Dynamic Fountain, 18 Top Spin Suspended and 23 Flying Carousel', x: -13.9, z: -53.1, latitude: null, longitude: null,
      readings: [[18.766292, 73.514925], [18.766329, 73.514909], [18.766313, 73.514883]] },
    { id: 'P9', label: 'P9: open paving between N Maze Garden, K The Smoothie Life and 20 Mega Disco', x: 13.1, z: -89.7, latitude: null, longitude: null,
      readings: [[18.766889, 73.515359], [18.76685, 73.515359], [18.766907, 73.515377]] },
    { id: 'P10', label: 'P10: open paving between 25 Flipping Arm, C The Deck and 21 Super Splash', x: 49.1, z: -69.9, latitude: null, longitude: null,
      readings: [[18.766434, 73.51572], [18.766373, 73.515791], [18.766379, 73.5157]] },
    { id: 'P11', label: 'P11: open paving between 27 Demolition Derby, M Refuel and 26 Air Race', x: 65.3, z: -5.7, latitude: null, longitude: null,
      readings: [[18.765622, 73.515976], [18.765586, 73.515972], [18.765627, 73.51597]] },
    { id: 'P12', label: 'P12: open paving between 4 Delta Hoppla, 31 Musical Fountain and 29 Carnival Carousel', x: 14.9, z: 4.5, latitude: null, longitude: null,
      readings: [[18.765453, 73.51531], [18.765522, 73.515302], [18.76552, 73.515352]] },
  ],
  // R1–R8 as recorded. `surveySheetPlace` is the ride printed against each R on the survey sheet.
  ridePoints: [
    { id: 'R1', surveySheetPlace: '2', mappingStatus: 'survey-sheet', use: 'check', entranceFace: [18.76479, 73.514904], coordinate: [18.764768, 73.514815],
      note: 'South tip, outside the area covered by P1–P12: the largest calibration error is expected here.' },
    { id: 'R2', surveySheetPlace: '12', mappingStatus: 'survey-sheet', use: 'check', entranceFace: [18.766078, 73.51359], coordinate: [18.76608, 73.513682] },
    { id: 'R3', surveySheetPlace: '16', mappingStatus: 'survey-sheet', use: 'check', entranceFace: [18.766572, 73.513767], coordinate: [18.766742, 73.513775],
      note: 'The two readings are ~19 m apart, more than for any other ride.' },
    { id: 'R4', surveySheetPlace: '17', mappingStatus: 'survey-sheet', use: 'check', entranceFace: [18.766574, 73.514259], coordinate: [18.766627, 73.514387] },
    { id: 'R5', surveySheetPlace: '20', mappingStatus: 'survey-sheet', use: 'check', entranceFace: [18.767123, 73.515203], coordinate: [18.767041, 73.515284] },
    { id: 'R6', surveySheetPlace: '25', mappingStatus: 'survey-sheet', use: 'check', entranceFace: [18.766417, 73.516141], coordinate: [18.766489, 73.51618],
      note: 'Lands nearer 30 You Are The Star than 25 Flipping Arm on the 3D map; confirm which ride this is.' },
    { id: 'R7', surveySheetPlace: '26', mappingStatus: 'survey-sheet', use: 'check', entranceFace: [18.766004, 73.51623], coordinate: [18.765937, 73.516123] },
    { id: 'R8', surveySheetPlace: '28', mappingStatus: 'survey-sheet', use: 'check', entranceFace: [18.765242, 73.516082], coordinate: [18.765242, 73.516082],
      note: 'entranceFace and coordinate are identical; one may have been copied from the other.' },
  ],
  calibrationStatus: 'provisional',
  localCorrection: { enabled: false, smoothing: 3000 },
  rotationOffsetDeg: 0,
  singlePointFallback: { metresPerUnit: 1.6, northUpDeg: 0 },
  // Wider than the typical error because the provisional calibration can be ~30–40 m out at the edges.
  boundaryMarginMetres: 40,
  weakAboveMetres: 25,
  ignoreAboveMetres: 60,
  minMoveMetres: 1.5,
  walkingMetresPerSecond: 1.5,
  staleAfterSeconds: 30,
  snapToPathMetres: 4,
};
