import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { ModelOptions } from '../../data/types';
import { C } from '../palette';
import { Box, StripedCone, Strut } from './parts';

type P = { o: ModelOptions };

/** A plain building: walls, a roof slab in the accent colour, a door on the front (+z) side. */
export function Hall({ o }: P) {
  const { w = 12, d = 8, h = 5, color = C.rim, accent = C.ink, sign } = o;
  return (
    <group>
      <Box size={[w, h, d]} position={[0, h / 2, 0]} color={color} />
      <Box size={[w + 0.6, 0.5, d + 0.6]} position={[0, h + 0.25, 0]} color={accent} />
      <Box size={[Math.min(2.4, w * 0.2), Math.min(2.6, h * 0.6), 0.12]} position={[0, Math.min(1.3, h * 0.3), d / 2 + 0.05]} color={C.ink} />
      {sign && <Box size={[w * 0.7, h * 0.28, 0.2]} position={[0, h * 0.72, d / 2 + 0.1]} color={sign} />}
    </group>
  );
}

/** Small stalls: a counter under a pyramid roof. `cross` adds the first-aid cross. */
export function Kiosk({ o }: P) {
  const { w = 4, d = 4, h = 3, color = C.rim, accent = C.coral, cross } = o;
  return (
    <group>
      <Box size={[w, h, d]} position={[0, h / 2, 0]} color={color} />
      <group position={[0, h + 0.7, 0]} scale={[(w / 2 + 0.4) * Math.SQRT2, 1, (d / 2 + 0.4) * Math.SQRT2]}>
        <mesh rotation={[0, Math.PI / 4, 0]}>
          <coneGeometry args={[1, 1.4, 4]} />
          <meshLambertMaterial color={accent} flatShading />
        </mesh>
      </group>
      <Box size={[w * 0.7, h * 0.4, 0.1]} position={[0, h * 0.62, d / 2 + 0.04]} color={C.ink} />
      <Box size={[w * 0.8, 0.16, 0.7]} position={[0, h * 0.36, d / 2 + 0.35]} color={C.foam} />
      {cross && (
        <group position={[0, h + 1.9, 0]}>
          <Box size={[1.6, 0.5, 0.3]} color={C.foam} />
          <Box size={[0.5, 1.6, 0.3]} color={C.foam} />
        </group>
      )}
    </group>
  );
}

/** Windmill Cafe: a pastel building with a windmill on one corner. */
export function Windmill({ o }: P) {
  const { w = 22, d = 14, h = 5 } = o;
  const sails = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (sails.current) sails.current.rotation.z += dt * 0.6;
  });
  return (
    <group>
      <Hall o={o} />
      <Box size={[w * 0.4, h * 0.8, d * 0.4]} position={[-w * 0.3, h * 0.4, d * 0.42]} color="#F7C6E0" />
      <Box size={[w * 0.3, h * 0.7, d * 0.3]} position={[w * 0.1, h * 0.35, d * 0.5]} color="#CDEFD2" />
      <group position={[w * 0.42, 0, d * 0.4]}>
        <mesh position={[0, 3.6, 0]}>
          <cylinderGeometry args={[1.4, 2, 7.2, 8]} />
          <meshLambertMaterial color={C.rim} flatShading />
        </mesh>
        <mesh position={[0, 8, 0]}>
          <coneGeometry args={[1.8, 1.8, 8]} />
          <meshLambertMaterial color={C.coral} flatShading />
        </mesh>
        <group ref={sails} position={[0, 6.6, 1.7]}>
          {[0, 1, 2, 3].map((i) => (
            <Box key={i} size={[0.7, 4.4, 0.12]} position={[Math.sin((i * Math.PI) / 2) * 2.2, Math.cos((i * Math.PI) / 2) * 2.2, 0]} rotation={[0, 0, (-i * Math.PI) / 2]} color={C.coral} />
          ))}
        </group>
      </group>
    </group>
  );
}

/** Santa Maria: a snack bar dressed as a sailing ship. */
export function ShipCafe({ o }: P) {
  const { w = 12, d = 10, h = 4 } = o;
  return (
    <group>
      <Hall o={o} />
      <Box size={[0.3, 8, 0.3]} position={[w * 0.2, h + 4, 0]} color={C.woodDark} />
      {[0, 1, 2].map((i) => (
        <Box key={i} size={[3.4 - i * 0.7, 1.8, 0.2]} position={[w * 0.2, h + 1.6 + i * 2.2, 0.2]} color={C.foam} />
      ))}
    </group>
  );
}

/** Summer Garden's kitchen. Its white parasols are a separate landmark beside the lake. */
export function Garden({ o }: P) {
  return (
    <group>
      <Hall o={o} />
      <Box size={[(o.w ?? 12) * 0.5, 0.3, (o.d ?? 8) * 0.9]} position={[-(o.w ?? 12) * 0.1, (o.h ?? 4.5) + 0.7, 0]} color={o.accent ?? C.hedge} />
    </group>
  );
}

/** The cluster of white parasols on the lake terrace. */
export function Parasols({ o }: P) {
  const { r = 8 } = o;
  const spots: [number, number][] = [[0, 0], [-3.6, -2.2], [3.4, -2.6], [-4.4, 2.6], [0.2, 3.8], [4.2, 2], [-0.6, -5], [-6.6, -0.4], [6.4, -0.6], [3, 5.4], [-3.4, 6]];
  return (
    <group>
      <mesh position={[0, 0.07, 0]}>
        <cylinderGeometry args={[r, r, 0.14, 20]} />
        <meshLambertMaterial color={C.sand} />
      </mesh>
      {spots.map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <Box size={[0.14, 3, 0.14]} position={[0, 1.5, 0]} color={C.steel} />
          <mesh position={[0, 3.2, 0]}>
            <coneGeometry args={[2, 0.9, 8]} />
            <meshLambertMaterial color={C.foam} flatShading />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/** Entrance gate house: two pillars and a canopy the path runs under. */
export function Gate({ o }: P) {
  const { w = 15, d = 7, h = 5, color = C.steel, accent = C.ink } = o;
  return (
    <group>
      {[-1, 1].map((s) => (
        <Box key={s} size={[2, h, d]} position={[(s * (w - 2)) / 2, h / 2, 0]} color={color} />
      ))}
      <Box size={[w + 1, 0.8, d + 1]} position={[0, h + 0.4, 0]} color={accent} />
      <Box size={[w * 0.5, 1.2, 0.3]} position={[0, h + 1.4, d / 2]} color={C.coral} />
    </group>
  );
}

/** The flower-shaped entrance plaza outside the gate, with its centre fountain. */
export function Plaza({ o }: P) {
  const { r = 19 } = o;
  return (
    <group>
      <mesh position={[0, 0.05, 0]}>
        <cylinderGeometry args={[r, r, 0.1, 36]} />
        <meshLambertMaterial color="#B9A27C" />
      </mesh>
      {Array.from({ length: 8 }, (_, i) => {
        const t = (i / 8) * Math.PI * 2;
        return (
          <mesh key={i} position={[Math.cos(t) * r * 0.56, 0.11, Math.sin(t) * r * 0.56]} rotation={[0, -t, 0]} scale={[1, 1, 0.5]}>
            <cylinderGeometry args={[r * 0.36, r * 0.36, 0.06, 20]} />
            <meshLambertMaterial color="#9E8963" />
          </mesh>
        );
      })}
      <mesh position={[0, 0.2, 0]}>
        <cylinderGeometry args={[r * 0.26, r * 0.26, 0.3, 20]} />
        <meshLambertMaterial color={C.lawnDark} />
      </mesh>
      <mesh position={[0, 0.4, 0]}>
        <cylinderGeometry args={[r * 0.2, r * 0.2, 0.5, 20]} />
        <meshLambertMaterial color="#3A3F4A" />
      </mesh>
      <mesh position={[0, 1.6, 0]}>
        <coneGeometry args={[0.8, 2.4, 6]} />
        <meshLambertMaterial color="#DFF6FB" transparent opacity={0.85} flatShading />
      </mesh>
      {/* Low curved fence on the park side */}
      {Array.from({ length: 12 }, (_, i) => {
        const t = Math.PI * (0.95 + (i / 11) * 1.0);
        return (
          <group key={i} position={[Math.cos(t) * (r + 0.6), 0, Math.sin(t) * (r + 0.6)]}>
            <Strut from={[0, 0, 0]} to={[0, 2.2, 0]} thickness={0.5} color={i % 2 ? C.coral : C.sun} />
          </group>
        );
      })}
    </group>
  );
}

/** A small round pool. */
export function RoundPool({ o }: P) {
  const { r = 3.6 } = o;
  return (
    <group>
      <mesh position={[0, 0.2, 0]}>
        <cylinderGeometry args={[r + 0.5, r + 0.5, 0.4, 20]} />
        <meshLambertMaterial color={C.rim} />
      </mesh>
      <mesh position={[0, 0.41, 0]}>
        <cylinderGeometry args={[r, r, 0.04, 20]} />
        <meshLambertMaterial color={C.water} />
      </mesh>
      <StripedCone r={0.9} h={1.4} colors={[C.coral, C.sun]} position={[0, 1.2, 0]} segments={8} />
    </group>
  );
}
