import { useMemo } from 'react';
import * as THREE from 'three';
import { C } from '../palette';

export const rad = (deg = 0) => (deg * Math.PI) / 180;

/** The planted ring most rides sit on: mulch outside, sand inside. */
export function Pad({ r, inner = C.sand }: { r: number; inner?: string }) {
  return (
    <group>
      <mesh position={[0, 0.05, 0]}>
        <cylinderGeometry args={[r + 1.4, r + 1.4, 0.1, 24]} />
        <meshLambertMaterial color={C.mulch} />
      </mesh>
      <mesh position={[0, 0.11, 0]}>
        <cylinderGeometry args={[r, r, 0.12, 24]} />
        <meshLambertMaterial color={inner} />
      </mesh>
    </group>
  );
}

export function Box({
  size,
  position = [0, 0, 0],
  rotation,
  color,
}: {
  size: [number, number, number];
  position?: [number, number, number];
  rotation?: [number, number, number];
  color: string;
}) {
  return (
    <mesh position={position} rotation={rotation}>
      <boxGeometry args={size} />
      <meshLambertMaterial color={color} />
    </mesh>
  );
}

/** A straight strut between two points, for frames and supports. */
export function Strut({
  from,
  to,
  thickness = 0.3,
  color = C.steel,
}: {
  from: [number, number, number];
  to: [number, number, number];
  thickness?: number;
  color?: string;
}) {
  const { position, quaternion, length } = useMemo(() => {
    const a = new THREE.Vector3(...from);
    const b = new THREE.Vector3(...to);
    const dir = b.clone().sub(a);
    return {
      position: a.clone().add(b).multiplyScalar(0.5),
      quaternion: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize()),
      length: dir.length(),
    };
  }, [from, to]);
  return (
    <mesh position={position} quaternion={quaternion}>
      <boxGeometry args={[thickness, length, thickness]} />
      <meshLambertMaterial color={color} />
    </mesh>
  );
}

/** A tube following a smooth curve through the given points. */
export function Tube({
  points,
  color,
  radius = 0.4,
  segments = 40,
  closed = false,
}: {
  points: [number, number, number][];
  color: string;
  radius?: number;
  segments?: number;
  closed?: boolean;
}) {
  const geometry = useMemo(() => {
    const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)), closed);
    return new THREE.TubeGeometry(curve, segments, radius, 6, closed);
  }, [points, radius, segments, closed]);
  return (
    <mesh geometry={geometry}>
      <meshLambertMaterial color={color} flatShading />
    </mesh>
  );
}

/** A cone whose sides alternate through a list of colours: tent roofs and umbrella canopies. */
export function StripedCone({
  r,
  h,
  colors,
  position = [0, 0, 0],
  segments = 16,
}: {
  r: number;
  h: number;
  colors: string[];
  position?: [number, number, number];
  segments?: number;
}) {
  const geometry = useMemo(() => {
    const g = new THREE.ConeGeometry(r, h, segments, 1, true).toNonIndexed();
    const pos = g.getAttribute('position');
    const col = new Float32Array(pos.count * 3);
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i += 3) {
      // Colour each triangle by the side it belongs to, found from its centre's angle.
      const x = (pos.getX(i) + pos.getX(i + 1) + pos.getX(i + 2)) / 3;
      const z = (pos.getZ(i) + pos.getZ(i + 1) + pos.getZ(i + 2)) / 3;
      const side = Math.floor(((Math.atan2(z, x) + Math.PI) / (Math.PI * 2)) * segments) % segments;
      c.set(colors[side % colors.length]);
      for (let k = 0; k < 3; k++) col.set([c.r, c.g, c.b], (i + k) * 3);
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.computeVertexNormals();
    return g;
  }, [r, h, colors, segments]);
  return (
    <mesh geometry={geometry} position={position}>
      <meshLambertMaterial vertexColors flatShading side={THREE.DoubleSide} />
    </mesh>
  );
}

export const RAINBOW = ['#E5383B', '#F28A1E', '#FFC53D', '#3DAA5C', '#2FC3DA', '#2A56B8', '#7B6CF6', '#E65AA0'];
