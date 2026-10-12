# GPS integration, live positioning, QR locations and map corrections — report

Status: **implemented, calibration provisional (not verified on site).**
All checks pass: `npx tsc`, `npm run verify`, `test:geo` (39 checks), `test:locations` (26),
`test:recommend`, `test:coords`, a production build, and a browser suite run against the
production build on a 390×844 phone viewport (QR links, scan dialog, manual codes, live GPS
through the browser's geolocation, QR in GPS Mode, poor/invalid readings, permission denied,
facilities, the new walk), plus layout checks at 375×667 and 360×640.

## 1. Survey data

Raw readings are stored exactly as supplied in `features/digital-park/data/parkGeoConfig.ts`
(P1's third reading is the corrected `[18.765225, 73.515622]`). The representative coordinate
is computed in code (`representativeOf` in `lib/geo.ts`): the mean, after dropping any reading
more than 20 m and 3× the others' spread away from the rest. No reading met that bar, so every
point uses the mean of all three.

| P | representative lat, lon | spread (max pair) | 3D world x, z | fit error | leave-one-out |
| --- | --- | --- | --- | --- | --- |
| P1 | 18.765204, 73.515652 | 7.7 m | 47.3, 42.9 | 11.9 m (8.3 u) | 15.1 m |
| P2 | 18.765139, 73.515123 | 9.2 m | −0.7, 60.9 | 28.8 m (19.9 u) | 35.3 m |
| P3 | 18.765350, 73.514575 | **15.3 m** | −47.5, 27.3 | 18.2 m (12.6 u) | 21.2 m |
| P4 | 18.765898, 73.513938 | **16.9 m** | −85.9, −4.5 | 12.3 m (8.5 u) | 15.0 m |
| P5 | 18.766091, 73.514339 | 10.2 m | −48.1, −29.1 | 9.4 m (6.5 u) | 10.6 m |
| P6 | 18.766465, 73.513758 | 10.6 m | −78.1, −57.3 | 29.0 m (20.1 u) | 36.8 m |
| P7 | 18.766838, 73.514481 | 11.2 m | −49.3, −83.7 | 5.4 m (3.7 u) | 6.6 m |
| P8 | 18.766311, 73.514906 | 5.0 m | −13.9, −53.1 | 8.4 m (5.8 u) | 9.3 m |
| P9 | 18.766882, 73.515365 | 6.6 m | 13.1, −89.7 | 7.5 m (5.2 u) | 9.2 m |
| P10 | 18.766395, 73.515737 | 10.1 m | 49.1, −69.9 | 20.0 m (13.8 u) | 24.3 m |
| P11 | 18.765612, 73.515973 | 4.6 m | 65.3, −5.7 | 12.6 m (8.7 u) | 15.8 m |
| P12 | 18.765498, 73.515321 | 8.7 m | 14.9, 4.5 | 14.6 m (10.1 u) | 16.5 m |

Readings needing verification:
- **P3, P4**: readings drift 15–17 m end to end (a steady drift, not one bad reading). Re-survey.
- **P2, P6**: tight readings but the largest misfit (29 m). Either the reading spot or the 3D map
  is off there; re-survey and check where P2/P6 sit on the ground.
- **R8**: `entranceFace` and `coordinate` are identical; one was probably copied.
- **R3**: its two readings are 19 m apart, the most of any ride.
- **R6**: the survey sheet assigns it to 25 Flipping Arm, but the reading lands nearest
  30 You Are The Star. Confirm which ride it is.

R1–R8 keep `entranceFace` and `coordinate` as separate fields, with the ride taken from the
survey sheet and marked `mappingStatus: 'survey-sheet'` (unconfirmed). They are used only to
check the calibration. Which reading sits closer to the ride's 3D position varies (R1 entrance
3.5 m vs coordinate 10.7 m; R4 21.8 vs 9.1), so neither has been assumed to mean "entrance".

## 2. GPS → world transform

Equirectangular local metres (east, south) → least-squares similarity transform (scale,
rotation, translation, no mirror), fitted from P1–P12 at load time, so editing the config
recalibrates. Result: **1.447 m per world unit** (the old guess was 1.6), map-up = compass
bearing **2.5°**.

| error measure | metres |
| --- | --- |
| RMS at the 12 control points | 16.6 |
| leave-one-out RMS (held-out P points) | 20.3 |
| RMS at the 8 independent R checks (`coordinate`) | 16.2 |
| median / worst leave-one-out | ~15 / 36.8 (P6) |

Alternatives tried and rejected for now (numbers in the session's analysis): a homography
fitted to the render's perspective was better inside the surveyed area but 64 m wrong at
Turbo Force (outside it); a thin-plate-spline correction did not improve the independent
checks with only 12 points. It is implemented (`localCorrection`, off) for re-testing once
more points exist. The dominant error is distortion in the 3D map itself (traced from an
artist's render), plus thin coverage at the south tip and east edge.

The app labels GPS placement as approximate ("usually within 20 m") while
`calibrationStatus` is `'provisional'`.

## 3. Live GPS (main feature, no QR needed)

`hooks/useGps.ts`: `watchPosition`, high accuracy, `maximumAge: 0`; permission is asked only
when the visitor taps Enable GPS. States: Finding your location (waiting), GPS active, Weak GPS
signal, GPS signal too weak, outside the mapped area, Can't access your location (denied), GPS
unavailable, No GPS signal yet (timeout). Active only after a valid fix. React state changes
only when the status changes; readings flow through `game.gps` without re-rendering.

Pipeline: invalid readings (NaN, 0°/0°, no accuracy) rejected → readings the phone stamps as
older than 30 s rejected as stale (at most 3 in a row, in case the phone clock is off) →
raw world position → QR correction (if near a scanned code) → Kalman-style filter (accuracy
weighting, velocity, glitch rejection, out-of-order rejection) = filtered → boundary check →
pulled onto the path only if within 4 m (never further, never onto a ride) = displayed. Raw,
filtered and displayed positions are all on `game.gps.reading` and in the dev panel. Camera
rotation never touches them. Everything stays in memory on the device.

## 4. QR locations

`data/locations.ts`: 60 records with stable ids: `gate`, `p1`–`p12` (surveyed junctions),
`place-<code>` for all 47 places (the path in front of each). QR codes carry
`https://<site>/?loc=<id>` only; coordinates in a URL are ignored, unknown ids are refused.
Entry points: phone camera → link; in-app Scan (BarcodeDetector where supported) with a manual
code fallback (`P3`, `17`, `GATE`); errors for invalid codes, camera denied, no camera,
insecure page, unsupported browser. Virtual Mode: placed there. GPS Mode: placed there, and
the local GPS offset is learnt from the last few readings (fades out by 200 m and 30 min;
ignored if over 80 m), so a poor reading can't drag the character away. A scan is a one-off
fix, not tracking. `npm run qr -- --base https://your-site` makes a printable sheet.

## 5. Facilities

Restrooms on A Windmill Cafe, B Zen Forest, D Santa Maria, H Platform 93%; drinking water on
A, B, E Summer Garden, as `amenities` on the existing records (no new places). Searchable
(toilet, washroom, restroom, wc, water…), Restrooms / Drinking water filter chips, badges on
the place card, nearest of each (by walking distance) in My Park → Facilities, with Navigate.

## 6. Missing pathway

Between the Giant Frisbee / Z Force road and Z Force, down the right of the Summer Garden
building and along its front. It was in the building's shadow in the render, so the colour
rule missed it and a "not pavement" box for the kitchen roof covered part of it. Traced by hand
(`FORCED_PAVEMENT` in `tools/park-from-images/gen.py`), adding 431 walk cells and removing none.
Summer Garden's model and footprint were trimmed from 12×8 to 10.5×7.5 units (same centre and
rotation) so the walk is wide enough for routes; no other placement changed. Giant Frisbee →
Z Force: ~250 m detour → ~95 m; Summer Garden → Z Force: ~290 m → ~37 m (both at the new scale).

Uncertain: the walk's exact width and where it ends at the bottom come from the render, not a
survey. A reading at the bottom of the walk would confirm it.

## 7. Files changed

New: `data/locations.ts`, `ui/QrDialog.tsx`, `scripts/test-locations.ts`,
`scripts/make-qr-codes.ts`, this report.
Changed: `data/parkGeoConfig.ts`, `lib/geo.ts`, `lib/gpsFilter.ts`, `lib/walkgrid.ts`,
`lib/places.ts`, `hooks/useGps.ts`, `state/game.ts`, `data/types.ts`, `data/park.ts`,
`data/park.generated.ts`, `DigitalPark.tsx`, `ui/ActionButtons.tsx`, `ui/GpsDialog.tsx`,
`ui/GpsStatus.tsx`, `ui/GpsDevPanel.tsx`, `ui/MyParkSheet.tsx`, `ui/PlaceCard.tsx`,
`ui/icons.tsx`, `digital-park.css`, `scripts/test-geo.ts`, `tools/park-from-images/gen.py`,
`package.json` (scripts; `qrcode` as a dev dependency only), `README.md`, `.gitignore`.

## 8. Next steps on site

1. Re-survey P2, P3, P4, P6 (several readings a minute apart, phone held still).
2. Add points at the south tip (entrance plaza, Turbo Force, Rush Hour) and the east edge.
3. Confirm R1–R8's rides and what `entranceFace` / `coordinate` mark.
4. Walk the park in GPS Mode; if positions hold, set `calibrationStatus: 'verified'`.
5. Print QR codes for the entrance and the P junctions first; they are the best-known spots.
