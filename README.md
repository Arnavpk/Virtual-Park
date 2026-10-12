# Digital Park

A mobile-first, walkable 3D map of the park. A visitor steers a character along
the park's real paths with an on-screen joystick, picks a ride, restaurant or
facility, and gets a highlighted walking route to it.

Next.js (App Router), TypeScript, Tailwind, three.js, React Three Fiber, drei.

## Run it

You need Node.js 20.9 or newer.

```
npm install
npm run dev
```

Open http://localhost:3000. On a desktop, use WASD or the arrow keys, or drag
the joystick with the mouse.

### Try it on a phone

Phone and computer on the same Wi-Fi:

```
npm run dev:phone
```

Then open `https://<your computer's IP address>:3000` on the phone and accept
the certificate warning (it is a self-signed certificate made for local
testing). HTTPS matters here: phones only share tilt readings with secure pages,
so the Tilt button won't work over plain http.

If the phone stays on "Loading the park…", restart the dev server. The list of
addresses allowed to load the page is read from this computer's network
addresses when the server starts (see `next.config.ts`), so it goes stale if
the computer changes Wi-Fi or gets a new IP.

### Other commands

```
npm run build     production build
npm run start     serve the production build
npm run verify    check the park layout (see below)
npm run test:geo  check the GPS mapping maths and print the survey/calibration report
npm run test:locations  check QR location codes, facilities and the Summer Garden walk
npm run test:recommend  check the recommendation and progress rules
npm run test:coords     check the camera-relative movement maths
npm run qr -- --base https://your-site   make printable location QR codes (developer tool)
```

## The park

The 3D park is a simplified recreation of the real one, built from the two
reference images: the aerial render for the layout and the numbered map for
which attraction is which.

- `features/digital-park/data/park.ts` is the table of all 47 places (rides
  1-33, food and services A-N) plus the unnumbered landmarks: name, category,
  position, which simplified model to draw, its size and colours, and the
  ground it blocks. Edit this file to rename, move or restyle anything.
- `features/digital-park/data/park.generated.ts` holds what was traced from
  the aerial image: the paved path network, the water, the trees, and the
  grid of walkable ground. Don't edit it by hand; see
  `tools/park-from-images/` if the reference images ever change.

The visitor can walk anywhere on the paving and nowhere else. After editing
`park.ts`, run `npm run verify`: it fails if a place can't be reached from the
entrance, a route leaves the paving, or a map code is missing or duplicated.

Walking distances use the scale measured by the GPS calibration (about 1.45 m
per world unit, see GPS Mode below). `METRES_PER_UNIT` in `park.ts` is only
the first estimate, used if the calibration is ever removed.

Restrooms (A Windmill Cafe, B Zen Forest, D Santa Maria, H Platform 93%) and
drinking water (A, B, E Summer Garden) are recorded as `amenities` on those
places in `park.ts` (set in `tools/park-from-images/gen.py` so they survive a
regeneration). They are searchable ("toilet", "washroom", "water"), have their
own filter chips, show on the place card, and My Park → Facilities lists the
nearest of each.

The walkway between the Giant Frisbee / Z Force road and Z Force, running down
the right of the Summer Garden building and along its front, sat in the
building's shadow in the aerial render and was missed by the tracer. It is now
traced by hand (`FORCED_PAVEMENT` in gen.py), and Summer Garden's footprint was
trimmed slightly so the walk is wide enough for routes. Giant Frisbee to Z Force
went from a ~250 m detour to ~95 m.

3D scene colours are in `features/digital-park/scene/palette.ts`. UI colours
are CSS variables at the top of `features/digital-park/digital-park.css`. The
font is set in `app/layout.tsx`.

## Where things are

```
app/
  layout.tsx, page.tsx     the page shell; the park fills the screen
features/digital-park/
  data/      park.ts (places), copy.ts (descriptions), interests.ts (what
             each interest covers), parkGeoConfig.ts (GPS reference points),
             park.generated.ts (traced ground), types.ts
  lib/       coords.ts (coordinate systems, camera-relative input),
             walkgrid.ts (walkable ground), collision.ts, pathfinding.ts (A*),
             places.ts (search and filters), geo.ts (GPS to park mapping),
             gpsFilter.ts (GPS smoothing), recommend.ts (suggestions and
             progress), layout.ts, terrain.ts
  state/     game.ts: per-frame state kept outside React
             userPark.ts: the visitor's favorites, My Day, visited, interests
  hooks/     useKeyboard.ts, useTiltControls.ts, useCameraGestures.ts (orbit
             and pinch), useGps.ts,
             compass.ts, usePlaceDistances.ts
  scene/     Ground (lawn, paving, water, wall), Scenery (trees),
             Attractions (picks a model per place), models/ (rides, buildings),
             Character, PlayerController, CameraRig (follow, whole park,
             orbit), RouteLine, PinProjector, DirectionDebug (development)
  ui/        Joystick, ZoomControls, CompassButton, ActionButtons, TopBar,
             FilterChips, CameraDebug (development only),
             ExploreSheet (search, filters, Near me), PlaceCard, MyParkSheet,
             PlaceRow, TiltDialog,
             ModeSwitch, GpsDialog, GpsStatus, GpsDevPanel (development only),
             PinLayer, icons
  DigitalPark.tsx          canvas + HUD + selection and route state
  DigitalParkLoader.tsx    client-only wrapper (three.js needs the browser)
scripts/verify-layout.ts   layout checker
scripts/test-geo.ts        GPS mapping and smoothing checks
scripts/test-recommend.ts  recommendation and progress checks
scripts/test-coords.ts     camera-relative movement checks
tools/park-from-images/    the script that traced the park from the images
```

Walking never re-renders React: the joystick writes to `game.input`, the
controller moves `game.player` inside the frame loop, and the UI is told only
when something it shows changes.

## Orbital view

Drag one finger (or the mouse) on the park to swing the camera round the
character and tilt it. The whole-park view orbits about the middle of the park
in the same way. Pinch or use + / − to zoom as before. The compass button
beside the Virtual / GPS switch shows which way is "up the map" and, tapped,
returns the camera to its normal view.

- **The joystick is camera-relative.** Pushing the stick up always moves the
  character away from the camera, wherever the camera has been swung to. The
  conversion is one function, `joystickToWorld` in `lib/coords.ts`, used for
  the joystick, the arrow keys and tilt. The character turns to face the
  direction it actually moves in.
- **GPS is not camera-relative.** In GPS Mode the character goes where the
  phone's location maps to, whatever the camera is doing.
- **The camera only changes the view.** Places, routes, distances and GPS
  mapping are world coordinates and never depend on it.
- **Limits:** tilt is held between 24° and 74° above the horizon, so the camera
  can't dip under the ground or flip overhead. Limits and drag sensitivity are
  in `ORBIT` in `lib/coords.ts`.
- Camera gestures only start on the 3D canvas. The joystick, pins, buttons and
  sheets are separate elements, so steering never orbits and orbiting never
  steers.

`lib/coords.ts` documents the three coordinate systems (world, screen input,
GPS) and holds the only conversions between screen input and world. In
development builds, "Camera debug" (Virtual Mode) draws arrows for camera
forward, camera right, the character's facing and its movement, with the
angles alongside. `npm run test:coords` checks the maths.

## My Park: the visitor's own side of the app

The heart button beside the search bar opens **My Park**, and the "What next?"
chip opens it straight on a suggestion. It is a bottom sheet, so the 3D park
stays in view above it.

- **For you**: progress through the park, "What should I do next?" (one
  suggestion with its distance and the reason for it), a short "Recommended
  for you" list, and "What do you enjoy?" where the visitor picks interests.
- **My Day**: the visitor's plan, in order. Items can be moved earlier or
  later, removed, and navigated to.
- **Favorites** and **Visited**: saved places and where the visitor has been.
- **Facilities**: the services the park data contains (First Aid, Essentials)
  and the nearest place to eat. Nothing is listed that isn't on the park map.

The place card has Favorite, My Day and Visited buttons. On arrival it offers
Mark as visited and one suggestion for where to go next; it never starts
navigating by itself. Near me can be viewed as Closest, For you, Favorites,
Rides, Food or Services.

### How it is put together

- **Park data and visitor state are separate.** `data/park.ts` never changes
  per visitor. Favorites, My Day, visited places and interests live in
  `state/userPark.ts` and are saved in the browser's localStorage on that
  device only (key `digital-park:visitor:v1`). Nothing is sent anywhere. A
  future account system would replace the `load` and `save` functions there.
- **One position for everything.** Distances come from the character's
  position, whichever of the joystick or GPS put it there, so recommendations
  and Near me behave the same in Virtual Mode and GPS Mode.
- **Recommendations are a plain scoring rule** in `lib/recommend.ts`: points
  for matching interests, being a favorite or being on My Day, minus points
  for distance; visited places sink to the bottom. The weights are in one
  `WEIGHTS` object. There is no AI, no network call and no live data: the park
  has no wait-time or opening feed, so none is shown.
- **Progress** counts rides and attractions (not cafes or services) and is
  worked out from the data, so it follows the dataset if places are added or
  removed.
- **Interests** are defined in `data/interests.ts`. Thrill level, family, kids
  and food come from the map legend. Water rides, entertainment and relaxing
  are lists of map codes there: a first pass that should be reviewed.

`npm run test:recommend` checks the recommendation and progress rules.

## GPS Mode

The switch at the bottom left chooses what moves the character:

- **Virtual**: the joystick, as before.
- **GPS**: the visitor's real position. The phone's location is mapped into
  the park and the character glides to it. The joystick is replaced by a
  status panel showing the signal and the accuracy the phone reports.

Location permission is only requested after the visitor chooses GPS and taps
Enable GPS. Readings stay in memory in the browser tab: nothing is sent
anywhere or saved, and the location watch is cleared when the visitor switches
back to Virtual.

### Calibration: provisional

`features/digital-park/data/parkGeoConfig.ts` holds the on-site survey:

- **P1–P12** (control points): spots whose place in the 3D park was fixed
  before the survey, each with its **raw readings exactly as recorded** (three
  phone readings each). The representative coordinate is computed from them in
  `lib/geo.ts` (the average, after dropping any reading that stands far apart
  from the others; none did). Points whose readings spread more than 12 m are
  flagged for re-survey: currently P3 (15 m) and P4 (17 m), both steady drift
  rather than one bad reading.
- **R1–R8** (check points): ride readings with `entranceFace` and `coordinate`
  kept separate, because what each marks on the ground isn't confirmed. Which
  ride each R is comes from the survey sheet, so they are marked
  `mappingStatus: 'survey-sheet'` and only used to *check* the calibration,
  never to fit it.

The fit is a least-squares similarity transform (one scale, one rotation, one
shift; latitude is never copied onto an axis). From the 12 P points: **1.447 m
per world unit**, map-up points to compass bearing **2.5°**. Honest error
figures, all in metres on the ground:

| measure | error |
| --- | --- |
| RMS at the 12 control points | 16.6 m |
| leave-one-out (each point predicted without itself) | 20.3 m |
| at the 8 independent ride checks | 16.2 m |
| worst points | P6 29 m, P2 29 m (south tip), R3 27 m |

So positions are typically 10–20 m out, up to ~35 m near the south and west
edges. Most of the error comes from the 3D map itself (it was traced from an
artist's render, which is not a true plan), not from GPS. The app therefore
labels GPS positions as **approximate** (`calibrationStatus: 'provisional'`).
Run `npm run test:geo` for the per-point table in metres and world units.

To improve it: re-survey P2, P3, P4, P6; add points at the south tip (entrance
plaza, Turbo Force, Rush Hour) and the east edge; confirm which ride each R is
and what `entranceFace`/`coordinate` mark. A smoothed local correction
(`localCorrection` in the config) is implemented but off, because with today's
points it did not improve the independent checks; re-test it once more points
exist. Only set `calibrationStatus: 'verified'` after walking the park with
GPS Mode on.

### Location QR codes

A QR code names a known spot by id: `https://<site>/?loc=<id>`. Scanning it
with the phone's camera opens the park with the character there; inside the app,
**Scan** (right-hand buttons) reads it with the camera where the browser
supports it (Chrome on Android) or takes the short code printed under it
(e.g. `P3`, `17`, `GATE`). Codes never carry coordinates, and ids not in
`data/locations.ts` are refused. Locations: the entrance, the 12 survey
junctions P1–P12, and the path in front of each of the 47 places. Add a spot by
adding a record with a new id; never reuse an id.

- Virtual Mode: the character is placed at the spot and the joystick carries on.
- GPS Mode: the character is placed at the spot, and the difference between
  GPS and the spot is applied to readings within a short walk of it (fading
  out by 200 m and after 30 minutes), so GPS lines up locally. A wildly
  different or very imprecise reading can't drag the character away. A scan is
  a one-off fix, not tracking.

`npm run qr -- --base https://your-site` writes `qr-codes/index.html`, a
printable sheet, plus one SVG per location (`--only gate,p1,place-17` for a
subset). The camera is opened only when the visitor taps "Scan with camera"
and is switched off as soon as a code is read.

### How it works

```
phone GPS (watchPosition)            hooks/useGps.ts
  → latitude, longitude, accuracy
  → reject invalid / stale readings
  → metres → park x/z  (raw)         lib/geo.ts  (from parkGeoConfig)
  → QR correction, if one is near
  → drop bad readings, steady rest   lib/gpsFilter.ts  (filtered)
  → inside the park?                 lib/walkgrid.ts (distanceToPaving)
  → onto the path if within 4 m      lib/walkgrid.ts (nearestPaving)  (displayed)
  → game.gps.target                  state/game.ts
  → character glides there           scene/PlayerController.tsx
```

Thresholds (weak signal, readings to ignore, noise dead-band, park boundary
margin) are in `parkGeoConfig.ts`. Search, Near me, distances and the route
all read the same player position, so they follow GPS automatically. In GPS
Mode, Navigate highlights the route and counts down the distance while the
visitor walks; it does not move the character for them.

### Direction and responsiveness

- A beam and arrowhead on the ground show which way the character faces. In
  GPS Mode that is the phone's compass direction when it has one (iPhones ask
  for a second "motion" permission for this), otherwise the direction of
  travel.
- When the phone reports its speed and direction of travel, they are used to
  keep the character walking between readings, so it doesn't trail behind or
  move in one-second hops.
- GPS itself is only good to about 3 to 10 m outdoors, and worse indoors or
  next to tall structures. For the best results: test under open sky, turn on
  precise or high-accuracy location for the browser, and wait until the
  accuracy shown in the status panel settles before walking.

### Testing without being in the park (development only)

`npm run dev` and `npm run dev:phone` are development builds, so the GPS
dialog offers two extra things that visitors never see:

- **Use simulator**: a pretend GPS. A small panel lets you walk north, south,
  east and west in 5 m steps, change the reported accuracy, add noise, and
  walk continuously in one direction, and step outside the park. "GPS debug"
  opens a readout of latitude, longitude, accuracy, the raw, filtered and
  displayed positions (and how far it was pulled onto the path), any QR
  correction, speed, course, compass, the outcome of the last reading, update
  counts and the calibration's errors.
- **Enable GPS with no calibration**: your first real reading is pinned to
  where the character is standing (map north-up, estimated scale). Walk
  around your office or street and the character should follow. This is
  labelled "test calibration" and is not the park's real mapping.

Real GPS needs a secure page, so use `npm run dev:phone` (https) on a phone.
Production builds (`npm run build`) hide all of this. To test on a deployed
site (Vercel, for example) with the simulator and debug panel, set the environment
variable `NEXT_PUBLIC_DP_DEV_TOOLS=1` and redeploy. Remove it before real
visitors use the site.

## Controls

- Joystick (bottom left), or WASD / arrow keys on desktop. Directions are
  relative to the screen: up is away from the camera.
- Orbit: drag one finger (or the mouse) on the park. The compass button resets it.
- Zoom: the + and − buttons (bottom right), a two-finger pinch on the map, or
  the mouse wheel. Zooming out past the widest close view carries on to the
  whole park; + from there drops back to the close view. Limits are in
  `state/game.ts` (`ZOOM`).
- Whole park / Follow me: switches the camera without moving the visitor.
- Entrance: puts the visitor back at the gate (Virtual Mode only).
- Tilt: optional walk-by-tilting (Virtual Mode only). It reads the phone's
  angle and is separate from GPS.
- Search (top): finds rides, food and facilities by name, map number, thrill
  level or what is served. Not case-sensitive.
- Category chips (top): All, Rides, High thrill, Mid thrill, Family, Kids,
  Food, Attractions, Services. On the map they hide the pins outside the
  category; in the search sheet they filter the list. The 3D park itself never
  changes.
- Near me: the twelve closest places by walking distance from the character,
  wherever it is: the virtual position, or the real one in GPS Mode.
- Tapping a pin or a search result opens the information card: what it is, a
  short description where one exists, how far, and Navigate. Navigate walks
  the route and shows the distance remaining with a Cancel button; touching the
  joystick also takes over.

Descriptions on the card come from `features/digital-park/data/copy.ts`. They
are first drafts for 17 places and should be replaced with the park's own
wording; a place with no entry shows no description.
