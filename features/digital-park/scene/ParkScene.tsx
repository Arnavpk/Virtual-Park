import type { Vec2 } from '../data/types';
import { Attractions } from './Attractions';
import { CameraRig, type CameraMode } from './CameraRig';
import { Character } from './Character';
import { DirectionDebug } from './DirectionDebug';
import { Ground } from './Ground';
import { C } from './palette';
import { PinProjector } from './PinProjector';
import { PlayerController } from './PlayerController';
import { RouteLine } from './RouteLine';
import { Trees } from './Scenery';

export function ParkScene({
  cameraMode,
  routePoints,
  devTools,
  onSelect,
}: {
  cameraMode: CameraMode;
  routePoints: Vec2[] | null;
  devTools: boolean;
  onSelect: (id: string) => void;
}) {
  return (
    <>
      <color attach="background" args={[C.sky]} />
      <ambientLight intensity={1.5} />
      <directionalLight position={[-30, 60, 40]} intensity={1.9} />

      <PlayerController />
      <CameraRig mode={cameraMode} />

      <Ground />
      <Trees />
      <Attractions onSelect={onSelect} />

      <Character />
      {routePoints && <RouteLine points={routePoints} />}
      {devTools && <DirectionDebug />}
      <PinProjector />
    </>
  );
}
