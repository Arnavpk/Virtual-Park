import { useMemo, useRef } from 'react';
import { Line } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { Vec2 } from '../data/types';
import { heightAt } from '../lib/terrain';
import { C } from './palette';

const LIFT = 0.22;

/** Breaks the route into short pieces so it hugs the arched bridges. */
function drape(points: Vec2[]): [number, number, number][] {
  const out: [number, number, number][] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 0.6));
    for (let k = i === 0 ? 0 : 1; k <= n; k++) {
      const x = a.x + ((b.x - a.x) * k) / n;
      const z = a.z + ((b.z - a.z) * k) / n;
      out.push([x, heightAt(x, z) + LIFT, z]);
    }
  }
  return out;
}

/** The highlighted walking route plus a bobbing marker at the destination. */
export function RouteLine({ points }: { points: Vec2[] }) {
  const draped = useMemo(() => drape(points), [points]);
  const dashes = useRef<any>(null);
  const marker = useRef<THREE.Group>(null);
  const end = points[points.length - 1];

  useFrame(({ clock }, delta) => {
    if (dashes.current?.material) dashes.current.material.dashOffset -= delta * 2.2;
    if (marker.current) marker.current.position.y = 2.6 + Math.sin(clock.elapsedTime * 3) * 0.25;
  });

  if (draped.length < 2) return null;

  return (
    <group>
      {/* White casing under a moving dashed line: readable on sand, grass and wood. */}
      <Line points={draped} color={C.foam} lineWidth={11} depthTest={false} renderOrder={10} transparent opacity={0.95} />
      <Line
        ref={dashes}
        points={draped}
        color={C.route}
        lineWidth={6}
        dashed
        dashSize={0.9}
        gapSize={0.55}
        depthTest={false}
        renderOrder={11}
        transparent
      />
      <group position={[end.x, 0, end.z]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.12, 0]} renderOrder={12}>
          <ringGeometry args={[0.75, 1.05, 24]} />
          <meshBasicMaterial color={C.route} depthTest={false} transparent />
        </mesh>
        <group ref={marker}>
          <mesh rotation={[Math.PI, 0, 0]} renderOrder={12}>
            <coneGeometry args={[0.5, 1, 4]} />
            <meshBasicMaterial color={C.route} depthTest={false} transparent />
          </mesh>
        </group>
      </group>
    </group>
  );
}
