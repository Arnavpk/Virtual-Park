import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { cameraForward, cameraRight } from '../lib/coords';
import { useGame } from '../state/game';

/** Colours shared with the legend in ui/CameraDebug.tsx. */
export const DEBUG_COLORS = { forward: '#ffffff', right: '#9aa7b4', facing: '#2a6cf0', movement: '#2e9e5b' };

function Arrow({ color, length, lift }: { color: string; length: number; lift: number }) {
  return (
    <group position={[0, lift, 0]}>
      <mesh position={[0, 0, length / 2]}>
        <boxGeometry args={[0.22, 0.08, length]} />
        <meshBasicMaterial color={color} depthTest={false} transparent />
      </mesh>
      <mesh position={[0, 0, length + 0.35]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.5, 0.9, 4]} />
        <meshBasicMaterial color={color} depthTest={false} transparent />
      </mesh>
    </group>
  );
}

/**
 * DEVELOPMENT ONLY. Four arrows on the ground at the player, for checking
 * directions by eye: where the camera looks, the camera's right, where the
 * character faces, and where it is actually moving. Hidden unless the camera
 * debug panel is open.
 */
export function DirectionDebug() {
  const game = useGame();
  const root = useRef<THREE.Group>(null);
  const forward = useRef<THREE.Group>(null);
  const right = useRef<THREE.Group>(null);
  const facing = useRef<THREE.Group>(null);
  const movement = useRef<THREE.Group>(null);

  useFrame(() => {
    const g = root.current;
    if (!g) return;
    g.visible = game.view.debug;
    if (!g.visible) return;
    const { player, view } = game;
    g.position.set(player.x, 0, player.z);
    // Each arrow is modelled pointing along +z; turning it by atan2(x, z) points it along (x, z).
    const f = cameraForward(view.yawNow);
    const r = cameraRight(view.yawNow);
    if (forward.current) forward.current.rotation.y = Math.atan2(f.x, f.z);
    if (right.current) right.current.rotation.y = Math.atan2(r.x, r.z);
    if (facing.current) facing.current.rotation.y = player.heading;
    if (movement.current) {
      const moving = Math.hypot(player.moveX, player.moveZ) > 0.05;
      movement.current.visible = moving;
      if (moving) movement.current.rotation.y = Math.atan2(player.moveX, player.moveZ);
    }
  });

  return (
    <group ref={root} visible={false} renderOrder={20}>
      <group ref={forward}>
        <Arrow color={DEBUG_COLORS.forward} length={6} lift={0.3} />
      </group>
      <group ref={right}>
        <Arrow color={DEBUG_COLORS.right} length={4} lift={0.3} />
      </group>
      <group ref={facing}>
        <Arrow color={DEBUG_COLORS.facing} length={4.6} lift={0.5} />
      </group>
      <group ref={movement}>
        <Arrow color={DEBUG_COLORS.movement} length={3.4} lift={0.7} />
      </group>
    </group>
  );
}
