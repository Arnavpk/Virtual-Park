import { useMemo } from 'react';
import { GRID, PAVEMENT, WALLS, WATER } from '../data/park.generated';
import { C } from './palette';
import { groundGeometry } from './shapes';

const MARGIN = 30; // lawn beyond the mapped area, so the park doesn't end at a cliff
const WIDTH = GRID.cols * GRID.cell + MARGIN * 2;
const DEPTH = GRID.rows * GRID.cell + MARGIN * 2;
const CX = GRID.originX + (GRID.cols * GRID.cell) / 2;
const CZ = GRID.originZ + (GRID.rows * GRID.cell) / 2;

/** Lawn, the paved path network traced from the real park, water and the boundary wall. */
export function Ground() {
  const paving = useMemo(() => PAVEMENT.map((o) => groundGeometry(o, 0.12)), []);
  const water = useMemo(() => WATER.map((o) => groundGeometry(o, 0.1)), []);

  return (
    <group>
      {/* Lawn slab with soil sides */}
      <mesh position={[CX, -0.2, CZ]}>
        <boxGeometry args={[WIDTH, 0.4, DEPTH]} />
        <meshLambertMaterial color={C.lawn} />
      </mesh>
      <mesh position={[CX, -1.9, CZ]}>
        <boxGeometry args={[WIDTH, 3, DEPTH]} />
        <meshLambertMaterial color={C.soil} />
      </mesh>

      {/* Paths: one continuous paved surface with the planted islands cut out of it */}
      {paving.map((g, i) => (
        <mesh key={i} geometry={g} position={[0, -0.04, 0]}>
          <meshLambertMaterial color={C.path} />
        </mesh>
      ))}

      {/* Pools and the lake */}
      {water.map((g, i) => (
        <mesh key={i} geometry={g} position={[0, 0, 0]}>
          <meshLambertMaterial color={C.water} />
        </mesh>
      ))}

      <Walls />
    </group>
  );
}

function Walls() {
  const pieces = useMemo(() => {
    const out: { x: number; z: number; len: number; rot: number }[] = [];
    for (const line of WALLS)
      for (let i = 0; i < line.length - 1; i++) {
        const [x0, z0] = line[i];
        const [x1, z1] = line[i + 1];
        out.push({ x: (x0 + x1) / 2, z: (z0 + z1) / 2, len: Math.hypot(x1 - x0, z1 - z0), rot: -Math.atan2(z1 - z0, x1 - x0) });
      }
    return out;
  }, []);
  return (
    <group>
      {pieces.map((p, i) => (
        <mesh key={i} position={[p.x, 0.9, p.z]} rotation={[0, p.rot, 0]}>
          <boxGeometry args={[p.len + 0.6, 1.8, 0.6]} />
          <meshLambertMaterial color={C.wall} />
        </mesh>
      ))}
    </group>
  );
}
