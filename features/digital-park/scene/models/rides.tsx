import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { Attraction } from '../../data/types';
import { C } from '../palette';
import { Box, Pad, RAINBOW, StripedCone, Strut, Tube, rad } from './parts';

type P = { a: Attraction };
const col = (a: Attraction) => a.opts.color ?? C.coral;
const acc = (a: Attraction) => a.opts.accent ?? C.sun;

/** Flat rides: a hub with arms and cars that goes round. Covers most family and kids rides. */
export function Spinner({ a }: P) {
  const { arms = 6, r = 4.5, tilt = 0, variant = 'pod', wet } = a.opts;
  const spin = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (spin.current) spin.current.rotation.y += dt * 0.7;
  });
  const hub = variant === 'balloon' ? 3.4 : 2.4;
  return (
    <group>
      <Pad r={r + 0.6} inner={wet ? C.water : C.sand} />
      <mesh position={[0, hub / 2, 0]}>
        <cylinderGeometry args={[0.45, 0.7, hub, 8]} />
        <meshLambertMaterial color={acc(a)} flatShading />
      </mesh>
      <group position={[0, hub, 0]} rotation={[tilt, 0, 0]}>
        <group ref={spin}>
          <mesh position={[0, 0.3, 0]}>
            <sphereGeometry args={[0.8, 8, 6]} />
            <meshLambertMaterial color={col(a)} flatShading />
          </mesh>
          {Array.from({ length: arms }, (_, i) => {
            const t = (i / arms) * Math.PI * 2;
            return (
              <group key={i} rotation={[0, t, 0]}>
                <Box size={[r - 0.6, 0.16, 0.16]} position={[(r - 0.6) / 2, 0, 0]} color={C.steel} />
                <group position={[r - 0.6, variant === 'balloon' ? -1.2 : -0.5, 0]}>
                  {variant === 'plane' && (
                    <>
                      <Box size={[0.7, 0.5, 1.5]} color={i % 2 ? col(a) : acc(a)} />
                      <Box size={[2, 0.1, 0.5]} position={[0, 0.2, 0]} color={C.foam} />
                    </>
                  )}
                  {variant === 'kite' && (
                    <>
                      <Box size={[0.7, 0.4, 1.1]} color={acc(a)} />
                      <Box size={[1.9, 0.08, 1.9]} position={[0, 0.9, 0]} rotation={[0, Math.PI / 4, 0]} color={RAINBOW[i % RAINBOW.length]} />
                    </>
                  )}
                  {variant === 'pod' && (
                    <mesh>
                      <sphereGeometry args={[0.75, 8, 6]} />
                      <meshLambertMaterial color={i % 2 ? col(a) : acc(a)} flatShading />
                    </mesh>
                  )}
                  {variant === 'balloon' && (
                    <>
                      <Box size={[0.8, 0.6, 0.8]} color={C.wood} />
                      <mesh position={[0, 1.7, 0]}>
                        <sphereGeometry args={[0.9, 8, 6]} />
                        <meshLambertMaterial color={RAINBOW[i % RAINBOW.length]} flatShading />
                      </mesh>
                    </>
                  )}
                </group>
              </group>
            );
          })}
        </group>
      </group>
    </group>
  );
}

export function Ferris({ a }: P) {
  const { r = 4.5 } = a.opts;
  const wheel = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (wheel.current) wheel.current.rotation.z += dt * 0.35;
  });
  const axle = r + 1.2;
  return (
    <group>
      <Pad r={r + 0.4} />
      {[-0.7, 0.7].map((z) => (
        <group key={z}>
          <Strut from={[-r * 0.6, 0, z]} to={[0, axle, z]} color={acc(a)} />
          <Strut from={[r * 0.6, 0, z]} to={[0, axle, z]} color={acc(a)} />
        </group>
      ))}
      <group ref={wheel} position={[0, axle, 0]}>
        <mesh>
          <torusGeometry args={[r, 0.14, 5, 20]} />
          <meshLambertMaterial color={col(a)} flatShading />
        </mesh>
        {Array.from({ length: 8 }, (_, i) => {
          const t = (i / 8) * Math.PI * 2;
          return (
            <group key={i}>
              <Strut from={[0, 0, 0]} to={[Math.cos(t) * r, Math.sin(t) * r, 0]} thickness={0.1} color={C.steel} />
              <Box size={[0.9, 0.9, 0.9]} position={[Math.cos(t) * r, Math.sin(t) * r, 0]} color={RAINBOW[i]} />
            </group>
          );
        })}
      </group>
    </group>
  );
}

/** Tall towers: Sky Screamer (swing star at the top), Z Force and Jump'in Star (a ring of seats riding up and down). */
export function Tower({ a }: P) {
  const { h = 20, r = 0.7, top = 'ring', rainbow, base } = a.opts;
  const car = useRef<THREE.Group>(null);
  const phase = useMemo(() => a.position[0], [a]);
  useFrame(({ clock }, dt) => {
    if (!car.current) return;
    if (top === 'star') car.current.rotation.y += dt * 0.9;
    else car.current.position.y = h * (0.5 + 0.38 * Math.sin(clock.elapsedTime * 0.6 + phase));
  });
  const bands = rainbow ? 8 : 1;
  return (
    <group>
      {base ? (
        <mesh position={[0, 0.5, 0]}>
          <cylinderGeometry args={[base, base + 0.4, 1, 16]} />
          <meshLambertMaterial color={C.rim} />
        </mesh>
      ) : (
        <Pad r={Math.max(3, h * 0.28)} inner={C.lawn} />
      )}
      {Array.from({ length: bands }, (_, i) => (
        <mesh key={i} position={[0, (h / bands) * (i + 0.5), 0]}>
          <cylinderGeometry args={[r, r * 1.15, h / bands, 8]} />
          <meshLambertMaterial color={rainbow ? RAINBOW[i % RAINBOW.length] : col(a)} flatShading />
        </mesh>
      ))}
      <mesh position={[0, h + 0.6, 0]}>
        <sphereGeometry args={[r * 1.6, 8, 6]} />
        <meshLambertMaterial color={acc(a)} flatShading />
      </mesh>
      <group ref={car} position={[0, top === 'star' ? h - 1.5 : h * 0.5, 0]}>
        {top === 'star' ? (
          Array.from({ length: 10 }, (_, i) => {
            const t = (i / 10) * Math.PI * 2;
            const reach = h * 0.2;
            return (
              <group key={i} rotation={[0, t, 0]}>
                <Strut from={[0, 0, 0]} to={[reach, 0.6, 0]} thickness={0.12} color={acc(a)} />
                <Strut from={[reach, 0.6, 0]} to={[reach + 0.8, -2.2, 0]} thickness={0.06} color={C.steel} />
                <Box size={[0.5, 0.5, 0.5]} position={[reach + 0.8, -2.4, 0]} color={RAINBOW[i % RAINBOW.length]} />
              </group>
            );
          })
        ) : (
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[r + 1.1, 0.45, 6, 12]} />
            <meshLambertMaterial color={acc(a)} flatShading />
          </mesh>
        )}
      </group>
    </group>
  );
}

/** Giant Frisbee: an A-frame with a big disc swinging underneath. */
export function Frisbee({ a }: P) {
  const { h = 15 } = a.opts;
  const arm = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (arm.current) arm.current.rotation.z = Math.sin(clock.elapsedTime * 0.9) * 0.95;
  });
  const foot = h * 0.55;
  return (
    <group>
      <mesh position={[0, 0.06, 0]} scale={[1.55, 1, 1]}>
        <cylinderGeometry args={[h * 0.62, h * 0.62, 0.12, 28]} />
        <meshLambertMaterial color={C.lawnDark} />
      </mesh>
      <mesh position={[0, 0.2, 0]}>
        <cylinderGeometry args={[4.2, 4.2, 0.3, 8]} />
        <meshLambertMaterial color="#3A3F4A" flatShading />
      </mesh>
      {[-1, 1].map((s) => (
        <group key={s}>
          <Strut from={[-foot, 0, s * 4]} to={[0, h, s * 0.8]} thickness={0.55} color={s > 0 ? col(a) : acc(a)} />
          <Strut from={[foot, 0, s * 4]} to={[0, h, s * 0.8]} thickness={0.55} color={s > 0 ? col(a) : acc(a)} />
        </group>
      ))}
      <group ref={arm} position={[0, h, 0]}>
        <Box size={[0.6, h - 2.6, 0.6]} position={[0, -(h - 2.6) / 2, 0]} color={C.coral} />
        <mesh position={[0, -(h - 2.4), 0]}>
          <cylinderGeometry args={[3.2, 3.2, 0.6, 14]} />
          <meshLambertMaterial color={acc(a)} flatShading />
        </mesh>
        <mesh position={[0, -(h - 2.9), 0]}>
          <torusGeometry args={[3.2, 0.35, 5, 14]} />
          <meshLambertMaterial color={C.sun} flatShading />
        </mesh>
      </group>
    </group>
  );
}

/** Top Spin: two towers with a gondola carried round between them on a pair of arms. */
export function TopSpin({ a }: P) {
  const { w = 10, h = 8 } = a.opts;
  const arms = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (arms.current) arms.current.rotation.x += dt * 0.8;
  });
  return (
    <group>
      <Pad r={w * 0.75} />
      {[-1, 1].map((s) => (
        <Box key={s} size={[1.2, h, 1.6]} position={[(s * w) / 2, h / 2, 0]} color={col(a)} />
      ))}
      <Box size={[w + 3, 0.5, 6]} position={[0, 0.4, 0]} color={C.steel} />
      <group ref={arms} position={[0, h - 1, 0]}>
        {[-1, 1].map((s) => (
          <Box key={s} size={[0.4, h * 0.95, 0.5]} position={[s * (w / 2 - 0.9), -h * 0.2, 0]} color={acc(a)} />
        ))}
        <Box size={[w - 2.2, 1.1, 1.6]} position={[0, -h * 0.62, 0]} color={C.coral} />
      </group>
    </group>
  );
}

/** A long arm turning on a pylon, cabins at the ends: Turbo Force, Flipping Arm, Space Trainer. */
export function Arm({ a }: P) {
  const { h = 10, variant } = a.opts;
  const arm = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (arm.current) arm.current.rotation.z += dt * (variant === 'gyro' ? 0.9 : 0.6);
  });
  const pivot = h * 0.58;
  return (
    <group>
      <Pad r={Math.max(3.2, h * 0.42)} />
      <Strut from={[-1.4, 0, 0.9]} to={[0, pivot, 0.5]} thickness={0.5} color={C.steel} />
      <Strut from={[1.4, 0, 0.9]} to={[0, pivot, 0.5]} thickness={0.5} color={C.steel} />
      <group ref={arm} position={[0, pivot, 0]}>
        {variant === 'gyro' ? (
          <>
            <mesh>
              <torusGeometry args={[h * 0.36, 0.3, 6, 16]} />
              <meshLambertMaterial color={col(a)} flatShading />
            </mesh>
            <Box size={[h * 0.72, 0.3, 0.3]} color={acc(a)} />
            <Box size={[1.6, 1.2, 1.2]} color={acc(a)} />
          </>
        ) : (
          <>
            <Box size={[0.6, h * 0.95, 0.6]} color={col(a)} />
            {[-1, 1].map((s) => (
              <Box key={s} size={[2.2, 1.1, 1.3]} position={[0, s * h * 0.47, 0]} color={acc(a)} />
            ))}
          </>
        )}
      </group>
    </group>
  );
}

/** Mega Disco: a spinning disc that rides back and forth along a dipped track. */
export function Disco({ a }: P) {
  const { len = 16 } = a.opts;
  const disc = useRef<THREE.Group>(null);
  const half = len / 2;
  const yAt = (x: number) => 0.8 + 3.2 * Math.pow(Math.abs(x) / half, 2) + 0.9 * Math.exp(-(x * x) / 3);
  const pts = useMemo<[number, number, number][]>(() => Array.from({ length: 13 }, (_, i) => {
    const x = -half + (i / 12) * len;
    return [x, yAt(x), 0];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [len]);
  useFrame(({ clock }, dt) => {
    if (!disc.current) return;
    const x = Math.sin(clock.elapsedTime * 0.8) * (half - 1.5);
    disc.current.position.set(x, yAt(x) + 0.7, 0);
    disc.current.rotation.y += dt * 2;
  });
  return (
    <group>
      <mesh position={[0, 0.05, 0]} scale={[1, 1, 0.42]}>
        <cylinderGeometry args={[half + 1.5, half + 1.5, 0.1, 24]} />
        <meshLambertMaterial color={C.mulch} />
      </mesh>
      {[-0.7, 0.7].map((z) => (
        <group key={z} position={[0, 0, z]}>
          <Tube points={pts} color={col(a)} radius={0.2} segments={30} />
        </group>
      ))}
      {[-half, -half / 2, half / 2, half].map((x) => (
        <Box key={x} size={[0.3, yAt(x), 0.3]} position={[x, yAt(x) / 2, 0]} color={C.steel} />
      ))}
      <group ref={disc}>
        <mesh>
          <cylinderGeometry args={[2, 2, 0.5, 12]} />
          <meshLambertMaterial color={acc(a)} flatShading />
        </mesh>
        <mesh position={[0, 0.5, 0]}>
          <torusGeometry args={[1.7, 0.3, 5, 12]} />
          <meshLambertMaterial color={C.sun} flatShading />
        </mesh>
      </group>
    </group>
  );
}

/** Super Splash: the tall blue arch with a chute dropping into the pool. The pool itself is drawn with the water. */
export function Splash({ a }: P) {
  const { h = 24 } = a.opts;
  const arch = useMemo<[number, number, number][]>(
    () => [[-5, 0, -17], [-5, h * 0.7, -17], [-3, h * 0.97, -17], [0, h, -17], [3, h * 0.97, -17], [5, h * 0.7, -17], [5, 0, -17]],
    [h],
  );
  const chute = useMemo<[number, number, number][]>(
    () => [[0, h * 0.86, -17.5], [0, h * 0.8, -15], [0, h * 0.42, -9], [0, 1.4, -4], [0, 0.6, -1]],
    [h],
  );
  return (
    <group>
      <Tube points={arch} color={col(a)} radius={0.7} segments={36} />
      {[-1, 0, 1].map((k) => (
        <Strut key={k} from={[k * 1.6, 0, -20]} to={[k * 1.2, h * 0.8, -17.4]} thickness={0.4} color={C.foam} />
      ))}
      <Tube points={chute} color={col(a)} radius={1.1} segments={24} />
      {/* Station and the thatched queue shelter beside the pool */}
      <Box size={[7, 3, 5]} position={[-9, 1.5, -6]} color={acc(a)} />
      <Box size={[8, 0.4, 6]} position={[-9, 3.2, -6]} color="#8A6B45" />
    </group>
  );
}

/** Galleon: a pirate ship swinging from a frame, standing in its round pool. */
export function Ship({ a }: P) {
  const { h = 8 } = a.opts;
  const swing = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (swing.current) swing.current.rotation.z = Math.sin(clock.elapsedTime * 1.1) * 0.6;
  });
  return (
    <group>
      {[-1, 1].map((s) => (
        <group key={s}>
          <Strut from={[-3.4, 0, s * 2.2]} to={[0, h, s * 1.3]} thickness={0.4} color={acc(a)} />
          <Strut from={[3.4, 0, s * 2.2]} to={[0, h, s * 1.3]} thickness={0.4} color={acc(a)} />
        </group>
      ))}
      <group ref={swing} position={[0, h, 0]}>
        <Strut from={[0, 0, 0]} to={[-2, -h + 2.4, 0]} thickness={0.2} color={C.steel} />
        <Strut from={[0, 0, 0]} to={[2, -h + 2.4, 0]} thickness={0.2} color={C.steel} />
        <Box size={[7, 1.3, 2]} position={[0, -h + 2, 0]} color={col(a)} />
        <Box size={[1.4, 1.6, 2]} position={[-3.6, -h + 3, 0]} rotation={[0, 0, 0.5]} color={col(a)} />
        <Box size={[1.4, 1.6, 2]} position={[3.6, -h + 3, 0]} rotation={[0, 0, -0.5]} color={col(a)} />
      </group>
    </group>
  );
}

/** Carnival Carousel (striped tent) and Flying Carousel (rainbow umbrella with hanging seats). */
export function Carousel({ a }: P) {
  const { r = 5, h = 6, variant = 'tent' } = a.opts;
  const spin = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (spin.current) spin.current.rotation.y += dt * 0.5;
  });
  const tent = variant === 'tent';
  const stripes = useMemo(() => (tent ? [col(a), acc(a)] : RAINBOW), [tent, a]);
  return (
    <group>
      <Pad r={r + 0.8} />
      <mesh position={[0, 0.4, 0]}>
        <cylinderGeometry args={[r, r, 0.5, 20]} />
        <meshLambertMaterial color={tent ? C.coral : C.sand} />
      </mesh>
      <mesh position={[0, h / 2, 0]}>
        <cylinderGeometry args={[0.5, 0.7, h, 8]} />
        <meshLambertMaterial color={tent ? C.foam : C.coral} flatShading />
      </mesh>
      <group ref={spin}>
        <StripedCone r={tent ? r + 0.4 : r} h={tent ? h * 0.45 : h * 0.3} colors={stripes} position={[0, tent ? h * 0.85 : h + 0.4, 0]} />
        {Array.from({ length: tent ? 8 : 10 }, (_, i) => {
          const t = (i / (tent ? 8 : 10)) * Math.PI * 2;
          const rr = r * 0.78;
          return tent ? (
            <group key={i} position={[Math.cos(t) * rr, 0, Math.sin(t) * rr]}>
              <Box size={[0.12, h * 0.62, 0.12]} position={[0, h * 0.31 + 0.6, 0]} color={C.sun} />
              <Box size={[0.5, 0.8, 1.1]} position={[0, 1.5, 0]} color={RAINBOW[i]} />
            </group>
          ) : (
            <group key={i} position={[Math.cos(t) * rr, 0, Math.sin(t) * rr]}>
              <Box size={[0.06, h * 0.55, 0.06]} position={[0, h * 0.7, 0]} color={C.steel} />
              <Box size={[0.5, 0.5, 0.5]} position={[0, h * 0.42, 0]} color={RAINBOW[i % RAINBOW.length]} />
            </group>
          );
        })}
      </group>
    </group>
  );
}

/** Demolition Derby: an oval floor of bumper cars under a canopy. */
export function Bumper({ a }: P) {
  const { rx = 6, rz = 4.5 } = a.opts;
  const cars = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (cars.current) cars.current.rotation.y += dt * 0.4;
  });
  return (
    <group scale={[1, 1, rz / rx]}>
      <mesh position={[0, 0.15, 0]}>
        <cylinderGeometry args={[rx, rx, 0.3, 24]} />
        <meshLambertMaterial color="#3A3F4A" />
      </mesh>
      <mesh position={[0, 0.5, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[rx, 0.35, 5, 24]} />
        <meshLambertMaterial color={col(a)} flatShading />
      </mesh>
      <group ref={cars}>
        {Array.from({ length: 7 }, (_, i) => {
          const t = (i / 7) * Math.PI * 2;
          const rr = rx * (i % 2 ? 0.35 : 0.7);
          return <Box key={i} size={[1.1, 0.7, 1.5]} position={[Math.cos(t) * rr, 0.65, Math.sin(t) * rr]} rotation={[0, t, 0]} color={RAINBOW[i]} />;
        })}
      </group>
      <mesh position={[rx * 0.75, 2.2, 0]} rotation={[0, 0, Math.PI / 2]} scale={[1, 1, 1.6]}>
        <cylinderGeometry args={[2.4, 2.4, 3, 10, 1, true, 0, Math.PI]} />
        <meshLambertMaterial color={acc(a)} flatShading side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

/** Truck n Trail: little trucks following a winding track. */
export function Track({ a }: P) {
  const { rx = 9, rz = 4.5 } = a.opts;
  const curve = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i < 16; i++) {
      const t = (i / 16) * Math.PI * 2;
      const wob = 1 + 0.22 * Math.sin(t * 3);
      pts.push(new THREE.Vector3(Math.cos(t) * rx * wob, 0.15, Math.sin(t) * rz * wob));
    }
    return new THREE.CatmullRomCurve3(pts, true);
  }, [rx, rz]);
  const geometry = useMemo(() => new THREE.TubeGeometry(curve, 80, 0.55, 4, true), [curve]);
  const trucks = useRef<(THREE.Mesh | null)[]>([]);
  useFrame(({ clock }) => {
    trucks.current.forEach((m, i) => {
      if (!m) return;
      const u = (clock.elapsedTime * 0.035 + i / 4) % 1;
      const p = curve.getPointAt(u);
      const d = curve.getTangentAt(u);
      m.position.set(p.x, 0.75, p.z);
      m.rotation.y = Math.atan2(d.x, d.z);
    });
  });
  return (
    <group>
      <mesh geometry={geometry} scale={[1, 0.25, 1]}>
        <meshLambertMaterial color={col(a)} flatShading />
      </mesh>
      {[0, 1, 2, 3].map((i) => (
        <mesh
          key={i}
          ref={(m) => {
            trucks.current[i] = m;
          }}
        >
          <boxGeometry args={[0.9, 0.8, 1.5]} />
          <meshLambertMaterial color={i % 2 ? acc(a) : C.sun} />
        </mesh>
      ))}
      <Box size={[4, 0.3, 2.4]} position={[-rx * 0.5, 2.4, rz * 0.9]} color={C.sun} />
      {[-1.7, 1.7].map((x) => (
        <Box key={x} size={[0.2, 2.4, 0.2]} position={[-rx * 0.5 + x, 1.2, rz * 0.9]} color={C.steel} />
      ))}
    </group>
  );
}

/** Surf's Up: a board gliding along a rail across the oval pool (the pool is drawn with the water). */
export function Surf({ a }: P) {
  const { len = 18 } = a.opts;
  const board = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!board.current) return;
    const t = clock.elapsedTime * 0.7;
    board.current.position.x = Math.sin(t) * (len / 2 - 2.5);
    board.current.rotation.y = t * 1.5;
  });
  return (
    <group>
      <Box size={[len, 0.35, 0.8]} position={[0, 0.5, 0]} color={C.steel} />
      {[-1, 1].map((s) => (
        <Box key={s} size={[1.4, 1.2, 2.2]} position={[(s * len) / 2, 0.6, 0]} color={col(a)} />
      ))}
      <group ref={board} position={[0, 1.1, 0]}>
        <Box size={[4.2, 0.35, 1.6]} color={acc(a)} />
        <Box size={[3.2, 0.5, 0.2]} position={[0, 0.5, 0]} color={C.sun} />
      </group>
    </group>
  );
}

/** Crazy Surf: a small half-pipe with a board rocking in it. */
export function HalfPipe({ a }: P) {
  const { w = 8, d = 4 } = a.opts;
  const board = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (!board.current) return;
    const s = Math.sin(clock.elapsedTime * 1.4);
    board.current.position.set(s * (w / 2 - 1), 0.7 + s * s * 1.6, 0);
    board.current.rotation.z = -s * 0.7;
  });
  return (
    <group>
      <Pad r={w * 0.62} />
      <Box size={[w * 0.4, 0.4, d]} position={[0, 0.35, 0]} color={col(a)} />
      {[-1, 1].map((s) => (
        <Box key={s} size={[w * 0.36, 0.4, d]} position={[s * w * 0.34, 1.25, 0]} rotation={[0, 0, s * 0.75]} color={col(a)} />
      ))}
      <mesh ref={board}>
        <boxGeometry args={[2.2, 0.3, 1.4]} />
        <meshLambertMaterial color={acc(a)} />
      </mesh>
    </group>
  );
}

/** Water jets. 'lake' is the Musical Fountain out on the water; 'plaza' is the Dynamic Fountain in its paved circle. */
export function Fountain({ a }: P) {
  const { r = 4, variant = 'lake' } = a.opts;
  const jets = useRef<(THREE.Mesh | null)[]>([]);
  const count = variant === 'lake' ? 7 : 5;
  useFrame(({ clock }) => {
    jets.current.forEach((m, i) => {
      if (!m) return;
      const k = 0.55 + 0.45 * Math.sin(clock.elapsedTime * 2 + i * 1.3);
      m.scale.y = k;
      m.position.y = (variant === 'lake' ? 0.2 : 0.7) + (m.userData.h * k) / 2;
    });
  });
  return (
    <group>
      {variant === 'plaza' && (
        <>
          <mesh position={[0, 0.08, 0]}>
            <cylinderGeometry args={[r + 2, r + 2, 0.14, 20]} />
            <meshLambertMaterial color={C.sand} />
          </mesh>
          <mesh position={[0, 0.35, 0]}>
            <cylinderGeometry args={[r * 0.75, r * 0.85, 0.7, 14]} />
            <meshLambertMaterial color={C.rim} flatShading />
          </mesh>
          <mesh position={[0, 0.72, 0]}>
            <cylinderGeometry args={[r * 0.62, r * 0.62, 0.06, 14]} />
            <meshLambertMaterial color={C.water} />
          </mesh>
        </>
      )}
      {Array.from({ length: count }, (_, i) => {
        const centre = i === 0;
        const t = (i / (count - 1)) * Math.PI * 2;
        const rr = centre ? 0 : variant === 'lake' ? r * 0.7 : r * 0.38;
        const h = centre ? (variant === 'lake' ? 6 : 3.2) : variant === 'lake' ? 3.6 : 1.8;
        return (
          <mesh
            key={i}
            ref={(m) => {
              jets.current[i] = m;
            }}
            userData={{ h }}
            position={[Math.cos(t) * rr, h / 2, Math.sin(t) * rr * (variant === 'lake' ? 0.5 : 1)]}
          >
            <coneGeometry args={[centre ? 0.5 : 0.35, h, 6]} />
            <meshLambertMaterial color="#DFF6FB" transparent opacity={0.85} flatShading />
          </mesh>
        );
      })}
    </group>
  );
}

export function Playground({ a }: P) {
  const { r = 6 } = a.opts;
  return (
    <group>
      <mesh position={[0, 0.06, 0]}>
        <cylinderGeometry args={[r, r, 0.12, 20]} />
        <meshLambertMaterial color={C.sand} />
      </mesh>
      {/* Play tower with a slide */}
      <Box size={[2, 2.4, 2]} position={[-1.5, 1.2, -0.5]} color={acc(a)} />
      <mesh position={[-1.5, 3.2, -0.5]} rotation={[0, Math.PI / 4, 0]}>
        <coneGeometry args={[1.9, 1.5, 4]} />
        <meshLambertMaterial color={col(a)} flatShading />
      </mesh>
      <Box size={[3.4, 0.2, 1]} position={[1, 1.2, -0.5]} rotation={[0, 0, -0.55]} color={C.sun} />
      {/* Swings */}
      <Strut from={[-3, 0, 2.5]} to={[-2, 2.6, 2.5]} thickness={0.16} color={C.coral} />
      <Strut from={[1, 0, 2.5]} to={[0, 2.6, 2.5]} thickness={0.16} color={C.coral} />
      <Box size={[2.2, 0.16, 0.16]} position={[-1, 2.6, 2.5]} color={C.coral} />
      <Box size={[0.6, 0.1, 0.4]} position={[-1, 0.8, 2.5]} color={C.ink} />
      {/* Climbing dome */}
      <mesh position={[2.8, 0.1, 2]}>
        <sphereGeometry args={[1.4, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshLambertMaterial color={C.mint} flatShading wireframe />
      </mesh>
    </group>
  );
}

/** Maze Garden: clipped hedges in nested rectangles with gaps. */
export function Maze({ a }: P) {
  const { w = 11, d = 8 } = a.opts;
  const hedges = useMemo(() => {
    const out: { x: number; z: number; sx: number; sz: number }[] = [];
    for (let k = 0; k < 3; k++) {
      const hw = w / 2 - k * 1.5;
      const hd = d / 2 - k * 1.2;
      const gap = k % 2 ? -1 : 1;
      out.push({ x: 0, z: -hd, sx: hw * 2, sz: 0.5 });
      out.push({ x: gap * 0.9, z: hd, sx: hw * 2 - 1.8, sz: 0.5 });
      out.push({ x: -hw, z: 0, sx: 0.5, sz: hd * 2 });
      out.push({ x: hw, z: gap * 0.7, sx: 0.5, sz: hd * 2 - 1.4 });
    }
    return out;
  }, [w, d]);
  return (
    <group>
      {hedges.map((h, i) => (
        <Box key={i} size={[h.sx, 1.1, h.sz]} position={[h.x, 0.55, h.z]} color={a.opts.color ?? C.hedge} />
      ))}
      <mesh position={[0, 0.6, 0]}>
        <cylinderGeometry args={[0.7, 0.7, 1.2, 8]} />
        <meshLambertMaterial color={C.sun} flatShading />
      </mesh>
    </group>
  );
}
