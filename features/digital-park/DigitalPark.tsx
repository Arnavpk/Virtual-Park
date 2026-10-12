'use client';

import { Component, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Canvas } from '@react-three/fiber';
import { locationById, type ParkLocation } from './data/locations';
import { getAttraction } from './data/park';
import type { Vec2 } from './data/types';
import { useGps, type GpsStartProblem } from './hooks/useGps';
import { useKeyboard } from './hooks/useKeyboard';
import { useCameraGestures } from './hooks/useCameraGestures';
import { useTiltControls } from './hooks/useTiltControls';
import { EFFECTIVE_METRES_PER_UNIT, PARK_CALIBRATION } from './lib/geo';
import { DOORS, START, snapToPaving } from './lib/layout';
import { findRoute, type Route } from './lib/pathfinding';
import type { Filter } from './lib/places';
import type { CameraMode } from './scene/CameraRig';
import { ParkScene } from './scene/ParkScene';
import { GameContext, ZOOM, clampZoom, createGame, type Game } from './state/game';
import { ActionButtons } from './ui/ActionButtons';
import { CameraDebug } from './ui/CameraDebug';
import { CompassButton } from './ui/CompassButton';
import { ExploreSheet } from './ui/ExploreSheet';
import { GpsDevPanel } from './ui/GpsDevPanel';
import { GpsDialog } from './ui/GpsDialog';
import { GpsStatus } from './ui/GpsStatus';
import { Joystick } from './ui/Joystick';
import { ModeSwitch, type Mode } from './ui/ModeSwitch';
import { MyParkSheet, type MyParkTab } from './ui/MyParkSheet';
import { PinLayer } from './ui/PinLayer';
import { PlaceCard } from './ui/PlaceCard';
import { QrDialog } from './ui/QrDialog';
import { TiltDialog } from './ui/TiltDialog';
import { TopBar } from './ui/TopBar';
import { ZoomControls } from './ui/ZoomControls';
import './digital-park.css';

const ARRIVE_DISTANCE = 1.6;
/** GPS can't place anyone to within a step, so in GPS Mode "arrived" means within about 8 m. */
const GPS_ARRIVE_DISTANCE = 8 / EFFECTIVE_METRES_PER_UNIT;
/** How long the camera looks at a newly chosen place before returning to the visitor. */
const FOCUS_MS = 3200;
const dist = (a: Vec2, b: Vec2) => Math.hypot(a.x - b.x, a.z - b.z);

/** Shows a plain message instead of a blank screen if 3D fails to start. */
class SceneBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="dp-fallback" role="alert">
        <p>
          The 3D park couldn't start in this browser. Update the browser or open this page in Chrome or Safari, then
          reload.
        </p>
      </div>
    );
  }
}

export interface DigitalParkProps {
  className?: string;
  /**
   * Optional external store. Pass one made with createGame() if the host app
   * needs to read (or drive) the visitor's position from outside the park.
   */
  game?: Game;
  /**
   * Shows developer-only tools: the GPS simulator and the GPS debug panel.
   * Defaults to on in development builds and off in production builds, so
   * visitors never see them. A deployed test site can switch them on by
   * setting the environment variable NEXT_PUBLIC_DP_DEV_TOOLS=1 at build time.
   */
  devTools?: boolean;
}

export default function DigitalPark({
  className,
  game: externalGame,
  devTools = process.env.NODE_ENV !== 'production' || process.env.NEXT_PUBLIC_DP_DEV_TOOLS === '1',
}: DigitalParkProps) {
  const ownGame = useMemo(createGame, []);
  const game = externalGame ?? ownGame;
  const [cameraMode, setCameraMode] = useState<CameraMode>('follow');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [route, setRoute] = useState<Route | null>(null);
  const [walking, setWalking] = useState(false);
  const [arrived, setArrived] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetFocus, setSheetFocus] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');
  const [zoom, setZoomState] = useState(game.view.zoom);
  const root = useRef<HTMLDivElement>(null);
  const [tiltDialog, setTiltDialog] = useState(false);
  const [tiltBusy, setTiltBusy] = useState(false);
  const [tiltError, setTiltError] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>('virtual');
  const [gpsDialog, setGpsDialog] = useState(false);
  const [gpsProblem, setGpsProblem] = useState<GpsStartProblem | null>(null);
  const [myParkOpen, setMyParkOpen] = useState(false);
  const [myParkTab, setMyParkTab] = useState<MyParkTab>('foryou');
  const [qrDialog, setQrDialog] = useState(false);
  const [toast, setToast] = useState<{ text: string; detail?: string; bad?: boolean } | null>(null);
  const lastRouted = useRef<Vec2>({ x: START.x, z: START.z });

  const tilt = useTiltControls(game);
  const gps = useGps(game, devTools);
  useKeyboard(game);

  const selected = getAttraction(selectedId);
  /** Where a route to the selected place ends: the nearest spot on the paving. */
  const door = selected ? DOORS[selected.id] : null;
  const here = useCallback((): Vec2 => ({ x: game.player.x, z: game.player.z }), [game]);

  const stopWalking = useCallback(() => {
    game.nav.active = false;
    setWalking(false);
  }, [game]);

  const clearSelection = useCallback(() => {
    stopWalking();
    game.view.focusUntil = 0;
    setSelectedId(null);
    setRoute(null);
    setArrived(false);
  }, [game, stopWalking]);

  const select = useCallback(
    (id: string) => {
      const target = DOORS[id];
      if (!target) return;
      stopWalking();
      const from = here();
      lastRouted.current = from;
      setSelectedId(id);
      setArrived(dist(from, target) < ARRIVE_DISTANCE);
      setRoute(findRoute(from, target));
      // Let the camera look at the place for a moment so it is clear which one was chosen.
      const place = getAttraction(id);
      if (place) {
        game.view.focus = { x: place.position[0], z: place.position[2] };
        game.view.focusUntil = performance.now() + FOCUS_MS;
      }
      // Drop focus before the sheet slides away so nothing tries to keep it in view.
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      setSheetOpen(false);
    },
    [game, here, stopWalking],
  );

  /** Starts navigation to the selected place, or straight to another place by id. */
  const startWalking = useCallback((toId?: string) => {
    const target = toId ? DOORS[toId] : door;
    if (!target) return;
    const fresh = findRoute(here(), target);
    if (!fresh) return;
    setRoute(fresh);
    // In Virtual Mode the character walks the route itself. In GPS Mode the visitor
    // does the walking: the route stays highlighted and the distance counts down.
    if (game.gps.mode !== 'gps') {
      game.nav.route = fresh.points;
      game.nav.index = 1;
      game.nav.stalled = 0;
      game.nav.active = true;
    }
    setWalking(true);
    setCameraMode('follow');
  }, [door, game, here]);

  /** Choose a place and start navigating to it in one go (from My Park or the arrival suggestion). */
  const navigateTo = useCallback(
    (id: string) => {
      select(id);
      startWalking(id);
      setMyParkOpen(false);
    },
    [select, startWalking],
  );
  const openPlace = useCallback(
    (id: string) => {
      select(id);
      setMyParkOpen(false);
    },
    [select],
  );
  const closeMyPark = useCallback(() => setMyParkOpen(false), []);
  const openMyPark = (tab: MyParkTab) => {
    setMyParkTab(tab);
    setMyParkOpen(true);
  };

  const reset = useCallback(() => {
    stopWalking();
    game.player.x = START.x;
    game.player.z = START.z;
    game.player.heading = -Math.PI / 2;
    if (door) {
      lastRouted.current = { ...START };
      setArrived(false);
      setRoute(findRoute(START, door));
    }
  }, [door, game, stopWalking]);

  // The frame loop reports back through these two callbacks.
  useEffect(() => {
    game.events.onArrive = () => {
      setWalking(false);
      setArrived(true);
      setRoute(null);
    };
    game.events.onGuideInterrupted = () => setWalking(false);
    return () => {
      game.events = {};
    };
  }, [game]);

  // Keep the highlighted route anchored to the visitor as they move. This runs
  // a few times a second, not per frame, so walking stays cheap.
  useEffect(() => {
    if (!door || arrived) return;
    const timer = window.setInterval(() => {
      const now = here();
      // Guided walking reports its own arrival; this covers walking there by hand.
      if (!game.nav.active && dist(now, door) < (game.gps.mode === 'gps' ? GPS_ARRIVE_DISTANCE : ARRIVE_DISTANCE)) {
        setWalking(false);
        setArrived(true);
        setRoute(null);
        return;
      }
      if (dist(now, lastRouted.current) < 0.6) return;
      lastRouted.current = now;
      setRoute(findRoute(now, door));
    }, 300);
    return () => window.clearInterval(timer);
  }, [arrived, door, game, here]);

  // ----- Location QR codes. A code names a known spot by id; the character is placed there once.
  // It is not tracking: in Virtual Mode the joystick carries on from there, in GPS Mode GPS does.
  const placeAt = useCallback(
    (loc: ParkLocation) => {
      stopWalking();
      let detail: string | undefined;
      if (game.gps.mode === 'gps') {
        const result = gps.anchor(loc);
        detail =
          result === 'placed-corrected'
            ? 'GPS near here is now lined up with this spot. GPS keeps following you as you walk.'
            : 'GPS keeps following you as you walk.';
      } else {
        game.player.x = loc.world.x;
        game.player.z = loc.world.z;
        detail = 'Walk on from here with the joystick.';
      }
      game.view.focusUntil = 0;
      setCameraMode('follow');
      if (door) {
        lastRouted.current = { ...loc.world };
        setArrived(dist(loc.world, door) < ARRIVE_DISTANCE);
        setRoute(findRoute(loc.world, door));
      }
      setQrDialog(false);
      setToast({ text: `You're at ${loc.name}`, detail: loc.note ? `${loc.note[0].toUpperCase()}${loc.note.slice(1)}. ${detail}` : detail });
    },
    [door, game, gps, stopWalking],
  );

  // Opened from a QR code scanned with the phone's own camera: https://<site>/?loc=<id>.
  // Read once, then dropped from the address so a reload doesn't move the character again.
  const placeAtRef = useRef(placeAt);
  placeAtRef.current = placeAt;
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('loc');
    if (id === null) return;
    params.delete('loc');
    const rest = params.toString();
    window.history.replaceState(window.history.state, '', `${window.location.pathname}${rest ? `?${rest}` : ''}${window.location.hash}`);
    const loc = locationById(id);
    if (loc) placeAtRef.current(loc);
    else setToast({ text: "That location code isn't recognised", detail: 'You start at the entrance instead.', bad: true });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 7000);
    return () => window.clearTimeout(t);
  }, [toast]);

  // ----- Zoom. The value lives in game.view (read by the camera every frame);
  // React only mirrors it so the + / − buttons know when they hit a limit.
  const setZoom = useCallback(
    (value: number) => {
      const z = clampZoom(value);
      game.view.zoom = z;
      setZoomState(z);
    },
    [game],
  );
  const atMin = zoom <= ZOOM.min * 1.02;
  const atMax = zoom >= ZOOM.max * 0.98;
  const zoomIn = () => {
    // From the whole-park view, + drops into the close view at its widest.
    if (cameraMode === 'overview') {
      setCameraMode('follow');
      setZoom(ZOOM.min);
    } else setZoom(zoom * ZOOM.step);
  };
  const zoomOut = () => {
    // Past the widest close view, − carries on out to the whole park.
    if (atMin) setCameraMode('overview');
    else setZoom(zoom / ZOOM.step);
  };
  const modeRef = useRef(cameraMode);
  modeRef.current = cameraMode;
  const leaveOverview = useCallback(() => {
    if (modeRef.current !== 'overview') return false;
    game.view.zoom = ZOOM.min;
    setCameraMode('follow');
    return true;
  }, [game]);
  useCameraGestures(root, game, setZoom, leaveOverview);

  // ----- Search sheet and category filter
  const openSheet = (focusSearch: boolean) => {
    setSheetFocus(focusSearch);
    setSheetOpen(true);
  };
  const closeSheet = useCallback(() => setSheetOpen(false), []);
  const pickFilter = (f: Filter) => {
    setFilter(f);
    // "Near me" is a list, so it opens the sheet. Other chips just filter the pins on the map.
    if (f === 'near' && !sheetOpen) openSheet(false);
  };

  // ----- Virtual Mode / GPS Mode
  const leaveGps = useCallback(() => {
    gps.stop();
    // GPS can leave the character on a lawn or inside a building; put it back on the paving for the joystick.
    const p = snapToPaving(game.player.x, game.player.z);
    game.player.x = p.x;
    game.player.z = p.z;
    setWalking(false);
    setMode('virtual');
  }, [game, gps]);
  const enableGps = (simulate: boolean) => {
    const problem = gps.start({ simulate });
    setGpsProblem(problem);
    if (problem) return;
    stopWalking();
    if (tilt.enabled) tilt.disable();
    // The joystick is removed in GPS Mode; make sure a half-finished drag can't linger.
    game.input.joyActive = false;
    game.input.joyX = 0;
    game.input.joyY = 0;
    setGpsDialog(false);
    setCameraMode('follow');
    setMode('gps');
  };
  const changeMode = (next: Mode) => {
    if (next === mode) return;
    if (next === 'virtual') leaveGps();
    else {
      // Location permission is only ever asked for from here, after the visitor chooses GPS.
      // If the park has no GPS reference points yet, say so straight away instead of asking for anything.
      setGpsProblem(!PARK_CALIBRATION && !devTools ? 'uncalibrated' : null);
      setGpsDialog(true);
    }
  };
  const closeGpsDialog = useCallback(() => setGpsDialog(false), []);
  const closeQrDialog = useCallback(() => setQrDialog(false), []);

  const toggleTilt = () => {
    if (tilt.enabled) tilt.disable();
    else {
      setTiltError(null);
      setTiltDialog(true);
    }
  };

  const confirmTilt = async () => {
    setTiltBusy(true);
    const result = await tilt.enable();
    setTiltBusy(false);
    if (result === 'on') setTiltDialog(false);
    else if (result === 'denied')
      setTiltError("Motion access was blocked. Allow motion and orientation access for this site in your browser settings, then try again.");
    else setTiltError("This device or browser isn't sending tilt readings. Keep using the joystick.");
  };

  const overlayOpen = sheetOpen || tiltDialog || gpsDialog || myParkOpen || qrDialog;
  const compactPins = cameraMode === 'overview' || zoom < 0.8;

  return (
    <GameContext.Provider value={game}>
      <div
        ref={root}
        className={`dp-root${className ? ` ${className}` : ''}`}
        // Older browsers without overflow: clip can still scroll this box; snap it back.
        onScroll={(e) => {
          e.currentTarget.scrollTop = 0;
          e.currentTarget.scrollLeft = 0;
        }}
      >
        <SceneBoundary>
          <Canvas
            orthographic
            flat
            dpr={[1, 1.75]}
            camera={{ position: [0, 200, 220], zoom: 16, near: 1, far: 900 }}
            gl={{ antialias: true, powerPreference: 'high-performance' }}
            className="dp-canvas"
          >
            <ParkScene
              cameraMode={cameraMode}
              routePoints={!arrived && route ? route.points : null}
              devTools={devTools}
              onSelect={select}
            />
          </Canvas>
        </SceneBoundary>

        <PinLayer
          selectedId={selectedId}
          compact={compactPins}
          filter={filter}
          you={mode === 'gps' ? 'gps' : compactPins ? 'virtual' : null}
          onSelect={select}
        />

        <div className="dp-hud">
          <TopBar
            filter={filter}
            onFilter={pickFilter}
            onSearch={() => openSheet(true)}
            onMyPark={() => openMyPark(myParkTab)}
            onWhatNext={() => openMyPark('foryou')}
            hidden={!!selected || overlayOpen}
          />

          {selected && !overlayOpen && (
            <PlaceCard
              place={selected}
              route={route}
              navigating={walking}
              arrived={arrived}
              getHere={here}
              onNavigate={() => startWalking()}
              onNavigateTo={navigateTo}
              onCancel={stopWalking}
              onClear={clearSelection}
            />
          )}

          {/* Bottom left: the Virtual / GPS switch, with the joystick (Virtual) or the GPS status (GPS) beneath it. */}
          <div className={`dp-left${overlayOpen ? ' is-hidden' : ''}`}>
            <div className="dp-left__row">
              <ModeSwitch mode={mode} onChange={changeMode} />
              <CompassButton />
            </div>
            {mode === 'virtual' ? (
              <Joystick hidden={overlayOpen} />
            ) : (
              <GpsStatus
                status={gps.status}
                source={gps.source}
                calibrationKind={gps.calibrationKind}
                onRetry={() => gps.start({ simulate: gps.source === 'simulator' })}
              />
            )}
          </div>
          {devTools && mode === 'virtual' && !overlayOpen && <CameraDebug />}
          {devTools && mode === 'gps' && !overlayOpen && (
            <GpsDevPanel status={gps.status} source={gps.source} calibrationKind={gps.calibrationKind} simulator={gps.simulator} />
          )}

          <div className={`dp-right${overlayOpen ? ' is-hidden' : ''}`}>
            <ActionButtons
              cameraMode={cameraMode}
              onToggleCamera={() => setCameraMode((m) => (m === 'follow' ? 'overview' : 'follow'))}
              onReset={reset}
              showReset={mode === 'virtual'}
              tiltSupported={tilt.supported && mode === 'virtual'}
              tiltOn={tilt.enabled}
              onToggleTilt={toggleTilt}
              onScan={() => setQrDialog(true)}
            />
            <ZoomControls
              canZoomIn={cameraMode === 'overview' || !atMax}
              canZoomOut={cameraMode === 'follow'}
              onZoomIn={zoomIn}
              onZoomOut={zoomOut}
            />
          </div>

          <ExploreSheet
            open={sheetOpen}
            focusSearch={sheetFocus}
            getHere={here}
            filter={filter}
            onFilter={setFilter}
            selectedId={selectedId}
            onSelect={select}
            onClose={closeSheet}
          />

          <MyParkSheet
            open={myParkOpen}
            tab={myParkTab}
            onTab={setMyParkTab}
            getHere={here}
            onOpenPlace={openPlace}
            onNavigate={navigateTo}
            onClose={closeMyPark}
          />

          {gpsDialog && (
            <GpsDialog problem={gpsProblem} calibrated={!!PARK_CALIBRATION} devTools={devTools} onEnable={enableGps} onCancel={closeGpsDialog} />
          )}

          {qrDialog && <QrDialog onResolved={placeAt} onCancel={closeQrDialog} />}

          {toast && !overlayOpen && (
            <div className={`dp-toast${toast.bad ? ' is-bad' : ''}`} role="status" aria-live="polite">
              <p className="dp-toast__text">{toast.text}</p>
              {toast.detail && <p className="dp-toast__detail">{toast.detail}</p>}
              <button type="button" className="dp-icon-button dp-toast__close" onClick={() => setToast(null)} aria-label="Dismiss">
                ×
              </button>
            </div>
          )}

          {tiltDialog && (
            <TiltDialog busy={tiltBusy} error={tiltError} onConfirm={confirmTilt} onCancel={() => setTiltDialog(false)} />
          )}
        </div>
      </div>
    </GameContext.Provider>
  );
}
