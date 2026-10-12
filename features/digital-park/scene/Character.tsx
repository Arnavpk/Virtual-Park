import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { heightAt } from '../lib/terrain';
import { useGame } from '../state/game';
import { C } from './palette';

const GPS_BLUE = '#2A6CF0';
/** Width of the facing beam, in radians. */
const BEAM = (58 * Math.PI) / 180;
/** An arrowhead drawn flat, pointing "forward" once laid on the ground. */
const ARROW = (() => {
  const s = new THREE.Shape();
  s.moveTo(0, -0.95);
  s.lineTo(0.85, 0.45);
  s.lineTo(0, 0.1);
  s.lineTo(-0.85, 0.45);
  s.closePath();
  return s;
})();

/** The visitor: a small figure wearing a swim ring, so it stays easy to spot. */
export function Character() {
  const game = useGame();
  const root = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const legL = useRef<THREE.Mesh>(null);
  const legR = useRef<THREE.Mesh>(null);
  const armL = useRef<THREE.Mesh>(null);
  const armR = useRef<THREE.Mesh>(null);
  const halo = useRef<THREE.Mesh>(null);
  const accuracy = useRef<THREE.Mesh>(null);
  const pointer = useRef<THREE.Group>(null);
  const pointerMaterial = useRef<THREE.MeshBasicMaterial>(null);
  const beamMaterial = useRef<THREE.MeshBasicMaterial>(null);
  const stride = useRef(0);

  useFrame(({ clock }, delta) => {
    const p = game.player;
    const g = root.current;
    if (!g || !body.current) return;
    g.position.set(p.x, heightAt(p.x, p.z) + 0.06, p.z);
    body.current.rotation.y = p.heading;
    // The pointer turns with the character but stays flat on the ground (it doesn't bob).
    if (pointer.current) pointer.current.rotation.y = p.heading;
    const tint = game.gps.mode === 'gps' ? GPS_BLUE : C.route;
    if (pointerMaterial.current) pointerMaterial.current.color.set(tint);
    if (beamMaterial.current) beamMaterial.current.color.set(tint);

    stride.current += delta * 11 * p.pace;
    const swing = Math.sin(stride.current) * 0.75 * p.pace;
    if (legL.current) legL.current.rotation.x = swing;
    if (legR.current) legR.current.rotation.x = -swing;
    if (armL.current) armL.current.rotation.x = -swing * 0.8;
    if (armR.current) armR.current.rotation.x = swing * 0.8;
    body.current.position.y = Math.abs(Math.sin(stride.current)) * 0.07 * p.pace;

    // GPS Mode: a soft blue disc shows how far off the reading could be.
    if (accuracy.current) {
      const r = game.gps.mode === 'gps' && game.gps.target ? Math.min(game.gps.accuracyUnits, 45) : 0;
      accuracy.current.visible = r > 0.9;
      if (r > 0.9) accuracy.current.scale.setScalar(r);
    }

    if (halo.current) {
      const k = (clock.elapsedTime * 0.7) % 1;
      halo.current.scale.setScalar(1 + k * 1.6);
      (halo.current.material as THREE.MeshBasicMaterial).opacity = (1 - k) * 0.45;
    }
  });

  return (
    <group ref={root}>
      {/* Contact shadow and a soft pulse so the visitor is easy to find */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <circleGeometry args={[0.6, 16]} />
        <meshBasicMaterial color="#0B2B3A" transparent opacity={0.25} depthWrite={false} />
      </mesh>
      <mesh ref={accuracy} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]} visible={false}>
        <circleGeometry args={[1, 40]} />
        <meshBasicMaterial color={GPS_BLUE} transparent opacity={0.16} depthWrite={false} />
      </mesh>
      <mesh ref={halo} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
        <ringGeometry args={[0.7, 0.86, 24]} />
        <meshBasicMaterial color={C.route} transparent opacity={0.4} depthWrite={false} />
      </mesh>

      {/* Which way the character is facing: a soft beam with an arrowhead, like the "facing" cone in map apps. */}
      <group ref={pointer}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.045, 0]}>
          {/* Drawn pointing "down" the flat shape, which becomes forward once it is laid on the ground. */}
          <circleGeometry args={[4.4, 12, -Math.PI / 2 - BEAM / 2, BEAM]} />
          <meshBasicMaterial ref={beamMaterial} color={C.route} transparent opacity={0.22} depthWrite={false} />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.06, 3.1]}>
          <shapeGeometry args={[ARROW]} />
          <meshBasicMaterial ref={pointerMaterial} color={C.route} transparent opacity={0.95} depthWrite={false} side={THREE.DoubleSide} />
        </mesh>
      </group>

      <group ref={body} scale={1.2}>
        {/* Legs pivot at the hip */}
        <mesh ref={legL} position={[-0.14, 0.55, 0]}>
          <boxGeometry args={[0.17, 0.55, 0.17]} />
          <meshLambertMaterial color={C.ink} />
        </mesh>
        <mesh ref={legR} position={[0.14, 0.55, 0]}>
          <boxGeometry args={[0.17, 0.55, 0.17]} />
          <meshLambertMaterial color={C.ink} />
        </mesh>
        {/* Torso */}
        <mesh position={[0, 1.05, 0]}>
          <capsuleGeometry args={[0.27, 0.36, 3, 8]} />
          <meshLambertMaterial color={C.teal} flatShading />
        </mesh>
        {/* Swim ring */}
        <mesh position={[0, 0.9, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.42, 0.17, 6, 12]} />
          <meshLambertMaterial color={C.sun} flatShading />
        </mesh>
        {/* Arms */}
        <mesh ref={armL} position={[-0.38, 1.22, 0]}>
          <boxGeometry args={[0.13, 0.46, 0.13]} />
          <meshLambertMaterial color={C.skin} />
        </mesh>
        <mesh ref={armR} position={[0.38, 1.22, 0]}>
          <boxGeometry args={[0.13, 0.46, 0.13]} />
          <meshLambertMaterial color={C.skin} />
        </mesh>
        {/* Head, cap and visor (the visor shows which way the visitor faces) */}
        <mesh position={[0, 1.72, 0]}>
          <sphereGeometry args={[0.3, 10, 8]} />
          <meshLambertMaterial color={C.skin} flatShading />
        </mesh>
        <mesh position={[0, 1.83, 0]}>
          <sphereGeometry args={[0.32, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshLambertMaterial color={C.coral} flatShading />
        </mesh>
        <mesh position={[0, 1.84, 0.3]}>
          <boxGeometry args={[0.36, 0.05, 0.26]} />
          <meshLambertMaterial color={C.coral} />
        </mesh>
      </group>
    </group>
  );
}
