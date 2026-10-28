import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { Attraction } from '../../data/types';
import { C } from '../palette';
import { cycleIntensity, cycleOffset, type RideCycle } from './motion';
import { Box, Pad, RAINBOW, StripedCone, Strut, Tube, rad } from './parts';

type P = { a: Attraction };
const col = (a: Attraction) => a.opts.color ?? C.coral;
const acc = (a: Attraction) => a.opts.accent ?? C.sun;

/**
 * Flat rides: a hub with arms and cars that goes round. Covers most family and
 * kids rides. Rides that have been remodelled from photos get their own model
 * through `variant`: 'jet' is Junior Jet, 'skyrace' is Sky Race, 'balloon' is
 * Samba Balloon, 'tubs' is Water Mania.
 */
export function Spinner({ a }: P) {
  if (a.opts.variant === 'jet') return <JuniorJet a={a} />;
  if (a.opts.variant === 'skyrace') return <SkyRace a={a} />;
  if (a.opts.variant === 'balloon') return <SambaBalloon a={a} />;
  if (a.opts.variant === 'tubs') return <WaterMania a={a} />;
  if (a.opts.variant === 'bike') return <MagicBike a={a} />;
  if (a.opts.variant === 'pod') return <WaveBlaster a={a} />;
  if (a.opts.variant === 'kite') return <KiteFlyer a={a} />;
  return <SpinnerBase a={a} />;
}

/** Deterministic 0..1 noise for per-seat timing, so rides don't all move in step. */
const hash01 = (n: number) => {
  const f = Math.sin(n * 91.345 + 47.853) * 43758.5453;
  return f - Math.floor(f);
};

/**
 * Junior Jet: proportions read off the park's photo, as fractions of `opts.r`.
 * Sized so the planes, at every height, stay inside the ride's footprint: the
 * paving comes to 3.5 units from its centre.
 */
export const JET = {
  planeRadius: 0.77, // centre of each plane from the column
  pivotRadius: 0.17, // where the arms join the column
  pivotHeight: 0.27, // arm pivot height (top of the blue base)
  lift: 32, //          degrees the arms rise above their resting slope (assumed)
  rest: -14, //         resting slope of the arms, degrees (planes sit on the ground)
  turn: 9, //           seconds per turn at full speed (assumed)
  cycle: { load: 10, build: 5, run: 45, ease: 6 } as RideCycle, // seconds (assumed)
};

const JJ = {
  column: '#22252B',
  base: '#2A56B8',
  window: '#7FC8F0',
  checkA: '#111418',
  checkB: '#F4F4F0',
  dome: '#E5383B',
  ball: '#F6C81E',
  arm: '#E5383B',
  strut: '#2A2D33',
  light: ['#E5383B', '#F6C81E', '#3DAA5C', '#2A56B8'],
  planes: [
    { body: '#E5383B', trim: '#FFC53D', wing: '#FFC53D' },
    { body: '#2A56B8', trim: '#F4F4F0', wing: '#7FC8F0' },
    { body: '#FFC53D', trim: '#E5383B', wing: '#E5383B' },
  ],
  roundel: '#2A56B8',
  prop: '#22252B',
  tyre: '#22252B',
};

/** Parts of one little plane, facing +z (its direction of travel), wings out along x. */
function jetPlaneParts(i: number): { boxes: BoxItem[]; discs: BoxItem[] } {
  const c = JJ.planes[i % JJ.planes.length];
  const H: [number, number, number] = [Math.PI / 2, 0, 0]; // disc axis along z
  const S: [number, number, number] = [0, 0, Math.PI / 2]; // disc axis along x
  return {
    boxes: [
      { p: [0, -0.22, 0], r: 0, s: [0.5, 0.12, 1.2], c: C.foam }, //          white belly
      { p: [0, 0, 0.84], r: 0, s: [0.08, 0.7, 0.04], c: JJ.prop }, //         propeller
      { p: [0, 0.27, 0.02], r: 0, s: [0.36, 0.06, 0.55], c: JJ.column }, //    open cockpit
      { p: [0, -0.08, 0.22], r: 0, s: [1.25, 0.07, 0.36], c: c.wing }, //      wings
      { p: [0, 0.1, -0.6], r: 0, s: [0.55, 0.05, 0.2], c: c.wing }, //         tailplane
      { p: [0, 0.3, -0.6], r: 0, s: [0.05, 0.38, 0.25], c: c.trim }, //        fin
    ],
    discs: [
      { p: [0, 0, 0], r: 0, s: [0.56, 1.35, 0.56], c: c.body, e: H }, //      fuselage
      { p: [0, 0, 0.74], r: 0, s: [0.52, 0.16, 0.52], c: c.trim, e: H }, //    nose
      { p: [0.03, 0.34, -0.6], r: 0, s: [0.18, 0.02, 0.18], c: JJ.roundel, e: S }, // roundel on the fin
      { p: [0, -0.36, 0.2], r: 0, s: [0.2, 0.08, 0.2], c: JJ.tyre, e: S }, //  wheel
    ],
  };
}

/**
 * Junior Jet (#10): small planes on red double-beam arms round a black column
 * with a checkered drum, red dome and yellow-ball antenna. The column, drum
 * and arms turn together above a fixed blue base. The double beams keep each
 * plane level, and a black lift cylinder from the drum raises each arm: on the
 * real ride each child lifts their own plane, so here every plane rises and
 * falls on its own timing while the ride turns.
 */
export function JuniorJet({ a }: P) {
  const { r = 3.2, arms = 6 } = a.opts;
  const R = JET.planeRadius * r;
  const r0 = JET.pivotRadius * r;
  const h0 = JET.pivotHeight * r;
  const L = R - r0 - 0.15; // arm length
  const colTop = 0.7 * r; //  where the drum starts
  const sDrum = 0.24 * r; //  drum radius
  const plane = 0.82 * (r / 3.2); // plane scale

  const spin = useRef<THREE.Group>(null);
  const beams = useRef<(THREE.Group | null)[]>([]);
  const planes = useRef<(THREE.Group | null)[]>([]);
  const struts = useRef<(THREE.Mesh | null)[]>([]);
  const time = useRef(cycleOffset(a.position[0], a.position[2]));
  const strutFrom = useMemo(() => new THREE.Vector3(r0 + 0.05, colTop - 0.1, 0), [r0, colTop]);
  const tmp = useMemo(() => ({ to: new THREE.Vector3(), dir: new THREE.Vector3(), up: new THREE.Vector3(0, 1, 0) }), []);

  useFrame((_, dt) => {
    if (!spin.current) return;
    const step = Math.min(dt, 0.1);
    time.current += step;
    const t = time.current;
    const k = cycleIntensity(t, JET.cycle);
    spin.current.rotation.y -= step * k * ((Math.PI * 2) / JET.turn);
    for (let i = 0; i < arms; i++) {
      // Each plane's own up-and-down: mostly holding high or low, moving between.
      const f = 0.18 + 0.12 * hash01(i + 1);
      const u = Math.max(-1, Math.min(1, 1.8 * Math.sin(t * f + hash01(i + 11) * 6.28)));
      const lift = k * (0.5 + 0.5 * u);
      const al = rad(JET.rest + JET.lift * lift);
      beams.current[i]?.rotation.set(0, 0, al);
      planes.current[i]?.position.set(r0 + L * Math.cos(al) + 0.15, h0 + L * Math.sin(al) + 0.12, 0);
      const s = struts.current[i];
      if (s) {
        tmp.to.set(r0 + 0.62 * L * Math.cos(al), h0 + 0.62 * L * Math.sin(al) + 0.08, 0);
        tmp.dir.subVectors(tmp.to, strutFrom);
        const len = tmp.dir.length();
        s.position.copy(strutFrom).addScaledVector(tmp.dir, 0.5);
        s.quaternion.setFromUnitVectors(tmp.up, tmp.dir.normalize());
        s.scale.set(1, len, 1);
      }
    }
  });

  const parts = useMemo(() => {
    const fixed: BoxItem[] = [];
    for (let j = 0; j < 8; j++) {
      const t = (j / 8) * Math.PI * 2 + Math.PI / 8;
      const rr = r0 + 0.31;
      fixed.push({ p: [Math.cos(t) * rr, h0 * 0.5, Math.sin(t) * rr], r: 0, s: [0.02, h0 * 0.55, 0.3], c: JJ.window, e: [0, -t, 0] });
    }
    const top: BoxItem[] = [
      { p: [0, (colTop + h0) / 2, 0], r: 0, s: [0.36, colTop - h0 + 0.1, 0.36], c: JJ.column },
      { p: [0, colTop + 1.2, 0], r: 0, s: [0.04, 0.7, 0.04], c: C.steel },
      { p: [0, colTop + 1.25, 0], r: 0, s: [0.5, 0.03, 0.03], c: C.steel },
      { p: [0, colTop + 1.25, 0], r: 0, s: [0.03, 0.03, 0.5], c: C.steel },
    ];
    for (let side = 0; side < 4; side++)
      for (let j = 0; j < 7; j++) {
        const t = (side / 4) * Math.PI * 2 + Math.PI / 4;
        const y = h0 + 0.35 + j * ((colTop - h0 - 0.45) / 6);
        top.push({ p: [Math.cos(t) * 0.24, y, Math.sin(t) * 0.24], r: 0, s: [0.07, 0.07, 0.07], c: JJ.light[(j + side) % 4] });
      }
    for (let row = 0; row < 3; row++)
      for (let j = 0; j < 16; j++) {
        const t = (j / 16) * Math.PI * 2;
        const rr = sDrum + 0.01;
        top.push({ p: [Math.cos(t) * rr, colTop + 0.15 + row * 0.22, Math.sin(t) * rr], r: 0, s: [0.12, 0.22, 0.12], c: (row + j) % 2 ? JJ.checkA : JJ.checkB });
      }
    const balls: BoxItem[] = [
      [0.25, 0],
      [-0.25, 0],
      [0, 0.25],
      [0, -0.25],
    ].map(([x, z]) => ({ p: [x, colTop + 1.25, z] as [number, number, number], r: 0, s: [0.14, 0.14, 0.14] as [number, number, number], c: JJ.ball }));
    balls.push({ p: [0, colTop + 1.58, 0], r: 0, s: [0.16, 0.16, 0.16], c: JJ.ball });
    const beam: BoxItem[] = [
      { p: [L / 2, 0.14, 0], r: 0, s: [L, 0.09, 0.09], c: JJ.arm },
      { p: [L / 2, -0.06, 0], r: 0, s: [L, 0.09, 0.09], c: JJ.arm },
      { p: [L * 0.5, 0.04, 0], r: 0, s: [0.06, 0.24, 0.06], c: JJ.arm },
    ];
    const planeParts = Array.from({ length: arms }, (_, i) => jetPlaneParts(i));
    return { fixed, top, balls, beam, planeParts };
  }, [r0, h0, colTop, sDrum, L, arms]);

  return (
    <group>
      <mesh position={[0, 0.03, 0]}>
        <cylinderGeometry args={[3.3, 3.3, 0.06, 28]} />
        <meshLambertMaterial color={C.kerb} />
      </mesh>
      {/* Fixed: blue base with light-blue panels */}
      <mesh position={[0, h0 / 2, 0]}>
        <cylinderGeometry args={[r0 + 0.25, r0 + 0.35, h0, 8]} />
        <meshLambertMaterial color={JJ.base} flatShading />
      </mesh>
      <InstancedBoxes items={parts.fixed} />

      {/* Turning: column with lights, checkered drum, dome, antenna, arms, lift cylinders and planes */}
      <group ref={spin}>
        <InstancedBoxes items={parts.top} />
        <mesh position={[0, colTop + 0.37, 0]}>
          <cylinderGeometry args={[sDrum, sDrum * 0.92, 0.74, 8]} />
          <meshLambertMaterial color={JJ.checkB} flatShading />
        </mesh>
        <mesh position={[0, colTop + 0.74, 0]}>
          <sphereGeometry args={[sDrum * 0.62, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshLambertMaterial color={JJ.dome} flatShading />
        </mesh>
        <InstancedBoxes items={parts.balls} shape="ball" />

        {Array.from({ length: arms }, (_, i) => (
          <group key={i} rotation={[0, (i / arms) * Math.PI * 2, 0]}>
            {/* Red double beam: keeps the plane level as it rises */}
            <group
              ref={(g) => {
                beams.current[i] = g;
              }}
              position={[r0, h0, 0]}
              rotation={[0, 0, rad(JET.rest)]}
            >
              <InstancedBoxes items={parts.beam} />
            </group>
            <mesh
              ref={(m) => {
                struts.current[i] = m;
              }}
            >
              <boxGeometry args={[0.07, 1, 0.07]} />
              <meshLambertMaterial color={JJ.strut} />
            </mesh>
            <group
              ref={(g) => {
                planes.current[i] = g;
              }}
              position={[r0 + L * Math.cos(rad(JET.rest)) + 0.15, h0 + L * Math.sin(rad(JET.rest)) + 0.12, 0]}
            >
              <group scale={[plane, plane, plane]}>
                <InstancedBoxes items={parts.planeParts[i].boxes} />
                <InstancedBoxes items={parts.planeParts[i].discs} shape="disc" />
              </group>
            </group>
          </group>
        ))}
      </group>
    </group>
  );
}

/**
 * Sky Race: proportions read off the park's photo, as fractions of `opts.r`.
 * Sized so the seats, swung out at full speed, stay inside the footprint: the
 * paving comes to 4.5 units from the ride's centre.
 */
export const SKY = {
  armRadius: 0.555, // where the hangers pivot
  height: 0.62, //     height of the arms
  hanger: 0.445, //    pivot to seat
  maxSwing: 30, //     degrees the seats swing out at full speed (photo shows ~25-30)
  cycle: { load: 10, build: 8, run: 30, ease: 10 } as RideCycle, // seconds (assumed)
};

const SR = {
  pole: ['#FFC53D', '#F4F4F0', '#E5383B'],
  base: '#FFC53D',
  checkA: '#111418',
  checkB: '#F4F4F0',
  skirt: '#E5383B',
  arms: ['#2A56B8', '#E5383B', '#3DAA5C'],
  rail: '#F4F4F0',
  wheel: ['#E5383B', '#3DAA5C'],
  prop: ['#FFC53D', '#F28A1E', '#1F3A6E'],
  seats: [
    { shell: '#57C75A', trim: '#F4F4F0' },
    { shell: '#F4F4F0', trim: '#FFC53D' },
    { shell: '#F4F4F0', trim: '#E5383B' },
    { shell: '#E5383B', trim: '#F4F4F0' },
  ],
  decal: '#E5383B',
};

/**
 * Sky Race (#9): a striped pole on a yellow, checkered base carries a turning
 * star of truss arms, with a three-disc propeller on top and a spoked wheel at
 * the end of each arm. A white ladder frame hangs from each wheel's axle with
 * a two-seat car at the bottom, riders facing out. As the star speeds up the
 * cars swing outwards; they hang straight down to load.
 */
export function SkyRace({ a }: P) {
  const { r = 4.5, arms = 8 } = a.opts;
  const Ra = SKY.armRadius * r;
  const Ht = SKY.height * r;
  const Lh = SKY.hanger * r;
  const spin = useRef<THREE.Group>(null);
  const hangers = useRef<(THREE.Group | null)[]>([]);
  const swing = useRef(0);
  const time = useRef(cycleOffset(a.position[0], a.position[2]));
  // Full speed is the speed at which a free swing settles at maxSwing (1.45 m per world unit).
  const wMax = useMemo(() => Math.sqrt((Math.tan(rad(SKY.maxSwing)) * 9.81) / ((Ra + Lh * Math.sin(rad(SKY.maxSwing))) * 1.45)), [Ra, Lh]);

  useFrame((_, dt) => {
    if (!spin.current) return;
    const step = Math.min(dt, 0.1);
    time.current += step;
    const k = cycleIntensity(time.current, SKY.cycle);
    const w = k * wMax;
    spin.current.rotation.y -= step * w;
    // The seats lag a little behind the speed, as a real swing does.
    const target = Math.min(rad(SKY.maxSwing), Math.atan((w * w * (Ra + Lh * Math.sin(swing.current)) * 1.45) / 9.81));
    swing.current += (target - swing.current) * (1 - Math.exp(-step / 0.6));
    for (const g of hangers.current) g?.rotation.set(0, 0, swing.current);
  });

  const parts = useMemo(() => {
    const fixed: BoxItem[] = [];
    const rb = 0.26 * r;
    for (let row = 0; row < 2; row++)
      for (let j = 0; j < 20; j++) {
        const t = (j / 20) * Math.PI * 2;
        fixed.push({ p: [Math.cos(t) * rb, 0.12 + row * 0.2, Math.sin(t) * rb], r: 0, s: [0.16, 0.2, 0.16], c: (row + j) % 2 ? SR.checkA : SR.checkB });
      }
    for (let j = 0; j < 9; j++) {
      const y = 0.55 + ((Ht - 0.55) * (j + 0.5)) / 9;
      fixed.push({ p: [0, y, 0], r: 0, s: [0.32, (Ht - 0.55) / 9, 0.32], c: SR.pole[j % SR.pole.length] });
    }
    // Arms, spokes and wheels, in the turning frame: each turned to its arm's angle.
    const armBoxes: BoxItem[] = [];
    const wheels: BoxItem[] = [];
    const at = (t: number, x: number, y: number, z: number): [number, number, number] => [x * Math.cos(t) + z * Math.sin(t), y, -x * Math.sin(t) + z * Math.cos(t)];
    for (let i = 0; i < arms; i++) {
      const t = (i / arms) * Math.PI * 2;
      const wc = SR.wheel[i % 2];
      armBoxes.push({ p: at(t, Ra / 2, Ht + 0.12, 0.12), r: 0, s: [Ra, 0.06, 0.06], c: SR.rail, e: [0, t, 0] });
      armBoxes.push({ p: at(t, Ra / 2, Ht + 0.12, -0.12), r: 0, s: [Ra, 0.06, 0.06], c: SR.rail, e: [0, t, 0] });
      armBoxes.push({ p: at(t, Ra / 2, Ht, 0), r: 0, s: [Ra - 0.3, 0.16, 0.2], c: SR.arms[i % SR.arms.length], e: [0, t, 0] });
      armBoxes.push({ p: at(t, Ra, Ht, 0), r: 0, s: [0.76, 0.03, 0.03], c: wc, e: [0, t, Math.PI / 4] });
      armBoxes.push({ p: at(t, Ra, Ht, 0), r: 0, s: [0.76, 0.03, 0.03], c: wc, e: [0, t, -Math.PI / 4] });
      wheels.push({ p: at(t, Ra, Ht, 0), r: 0, s: [0.76, 0.76, 0.76], c: wc, e: [0, t, 0] });
    }
    const props: BoxItem[] = SR.prop.map((c, j) => {
      const t = (j / 3) * Math.PI * 2 + Math.PI / 2;
      return { p: [0, Ht + 0.9 + Math.sin(t) * 0.42, Math.cos(t) * 0.42], r: 0, s: [0.76, 0.06, 0.76], c, e: [0, 0, Math.PI / 2] };
    });
    // One hanger: ladder frame and two-seat car, riders facing out (+x). Local to its pivot.
    const hanger = (i: number) => {
      const seat = SR.seats[i % SR.seats.length];
      const boxes: BoxItem[] = [
        { p: [0, -Lh / 2, -0.32], r: 0, s: [0.05, Lh, 0.05], c: SR.rail },
        { p: [0, -Lh / 2, 0.32], r: 0, s: [0.05, Lh, 0.05], c: SR.rail },
        { p: [0.05, -Lh, 0], r: 0, s: [0.5, 0.12, 0.9], c: seat.shell },
        { p: [-0.2, -Lh + 0.28, 0], r: 0, s: [0.1, 0.55, 0.9], c: seat.shell },
        { p: [-0.2, -Lh + 0.58, 0], r: 0, s: [0.12, 0.08, 0.9], c: seat.trim },
        { p: [0.02, -Lh + 0.1, -0.46], r: 0, s: [0.5, 0.3, 0.04], c: seat.trim },
        { p: [0.02, -Lh + 0.1, 0.46], r: 0, s: [0.5, 0.3, 0.04], c: seat.trim },
        { p: [0.36, -Lh - 0.22, 0], r: 0, s: [0.08, 0.05, 0.8], c: C.steel },
      ];
      for (let j = 0; j < 5; j++) boxes.push({ p: [0, -Lh * (0.15 + j * 0.15), 0], r: 0, s: [0.04, 0.04, 0.64], c: SR.rail });
      const decals: BoxItem[] = [-0.49, 0.49].map((z) => ({ p: [0.05, -Lh + 0.1, z] as [number, number, number], r: 0, s: [0.2, 0.02, 0.2] as [number, number, number], c: SR.decal, e: [Math.PI / 2, 0, 0] as [number, number, number] }));
      return { boxes, decals };
    };
    return { fixed, armBoxes, wheels, props, hangers: Array.from({ length: arms }, (_, i) => hanger(i)) };
  }, [r, Ra, Ht, Lh, arms]);

  return (
    <group>
      <mesh position={[0, 0.03, 0]}>
        <cylinderGeometry args={[4.3, 4.3, 0.06, 32]} />
        <meshLambertMaterial color={C.kerb} />
      </mesh>
      {/* Fixed: yellow base with a checkered side, red skirt round the pole, striped pole */}
      <mesh position={[0, 0.25, 0]}>
        <cylinderGeometry args={[0.26 * r, 0.26 * r, 0.5, 20]} />
        <meshLambertMaterial color={SR.base} />
      </mesh>
      <mesh position={[0, 0.75, 0]}>
        <cylinderGeometry args={[0.2, 0.6, 0.5, 10]} />
        <meshLambertMaterial color={SR.skirt} flatShading />
      </mesh>
      <InstancedBoxes items={parts.fixed} />

      {/* Turning: hub, propeller, truss arms, wheels, hangers and seats */}
      <group ref={spin}>
        <mesh position={[0, Ht, 0]}>
          <cylinderGeometry args={[0.45, 0.45, 0.35, 8]} />
          <meshLambertMaterial color={SR.skirt} flatShading />
        </mesh>
        <mesh position={[0, Ht + 0.3, 0]}>
          <coneGeometry args={[0.32, 0.35, 8]} />
          <meshLambertMaterial color={SR.skirt} flatShading />
        </mesh>
        <InstancedBoxes items={parts.props} shape="disc" />
        <InstancedBoxes items={parts.armBoxes} />
        <InstancedBoxes items={parts.wheels} shape="ring" />
        {parts.hangers.map((h, i) => (
          <group key={i} rotation={[0, (i / arms) * Math.PI * 2, 0]}>
            {/* Swings out about the wheel's axle */}
            <group
              ref={(g) => {
                hangers.current[i] = g;
              }}
              position={[Ra, Ht, 0]}
            >
              <InstancedBoxes items={h.boxes} />
              <InstancedBoxes items={h.decals} shape="disc" />
            </group>
          </group>
        ))}
      </group>
    </group>
  );
}

/** Colours a geometry's triangles in vertical stripes by their angle round the y axis: balloons, tubs. */
function striped(g: THREE.BufferGeometry, colors: string[], bands: number): THREE.BufferGeometry {
  const ng = g.toNonIndexed();
  g.dispose();
  const pos = ng.getAttribute('position');
  const col = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i += 3) {
    const x = (pos.getX(i) + pos.getX(i + 1) + pos.getX(i + 2)) / 3;
    const z = (pos.getZ(i) + pos.getZ(i + 1) + pos.getZ(i + 2)) / 3;
    const side = Math.floor(((Math.atan2(z, x) + Math.PI) / (Math.PI * 2)) * bands) % bands;
    c.set(colors[side % colors.length]);
    for (let k = 0; k < 3; k++) col.set([c.r, c.g, c.b], (i + k) * 3);
  }
  ng.setAttribute('color', new THREE.BufferAttribute(col, 3));
  ng.computeVertexNormals();
  return ng;
}

/**
 * Samba Balloon: proportions read off the park's photo, as fractions of
 * `opts.r`. Sized so the baskets stay inside the footprint: the paving comes
 * to 5 units from the ride's centre.
 */
export const SAMBA = {
  hub: 0.67, //        height of the arm pivots
  arm: 0.75, //        arm length
  drop: 0.31, //       arm end to basket centre
  rise: 0.31, //       arm end to balloon centre
  rest: -14, //        arm slope while loading, degrees (baskets near the ground)
  waveMid: -2, //      arm slope round which the arms rise and fall
  waveAmp: 12, //      degrees either side (photo shows the baskets at different heights)
  wave: 7, //          seconds per rise and fall (assumed)
  turn: 10, //         seconds per turn at full speed (assumed)
  cycle: { load: 10, build: 6, run: 40, ease: 8 } as RideCycle, // seconds (assumed)
};

const SB = {
  base: '#2A56B8',
  stripe: '#FFC53D',
  column: '#3D6FE0',
  arm: '#E65AA0',
  armUnder: '#7B6CF6',
  pole: '#F4F4F0',
  wicker: '#B9824F',
  crown: ['#E65AA0', '#7B6CF6', '#FFC53D', '#3DAA5C', '#2A56B8'],
  balloons: [
    ['#E5383B', '#2A56B8'],
    ['#FFC53D', '#3DAA5C'],
    ['#F28A1E', '#FFC53D'],
    ['#2A56B8', '#7B6CF6'],
    ['#E5383B', '#FFC53D'],
    ['#7B6CF6', '#E65AA0'],
  ],
};

/**
 * Samba Balloon (#3): a blue column with a coloured crown, carrying decorated
 * arms. From each arm's end a white pole holds a striped hot-air balloon above
 * and a wicker basket below, with a striped band round its rim. The arms turn
 * round the column and rise and fall in a wave, so the baskets ride up and
 * down as they go round; the poles stay upright.
 */
export function SambaBalloon({ a }: P) {
  const { r = 4.5, arms = 6 } = a.opts;
  const Hh = SAMBA.hub * r;
  const La = SAMBA.arm * r;
  const drop = SAMBA.drop * r;
  const rise = SAMBA.rise * r;
  const r0 = 0.45;
  const spin = useRef<THREE.Group>(null);
  const armRefs = useRef<(THREE.Group | null)[]>([]);
  const poleRefs = useRef<(THREE.Group | null)[]>([]);
  const time = useRef(cycleOffset(a.position[0], a.position[2]));

  useFrame((_, dt) => {
    if (!spin.current) return;
    const step = Math.min(dt, 0.1);
    time.current += step;
    const t = time.current;
    const k = cycleIntensity(t, SAMBA.cycle);
    spin.current.rotation.y -= step * k * ((Math.PI * 2) / SAMBA.turn);
    for (let i = 0; i < arms; i++) {
      const wave = SAMBA.waveMid + SAMBA.waveAmp * Math.sin((t / SAMBA.wave) * Math.PI * 2 + (i * 4 * Math.PI) / arms);
      const al = rad(SAMBA.rest * (1 - k) + wave * k);
      armRefs.current[i]?.rotation.set(0, 0, al);
      poleRefs.current[i]?.position.set(r0 + La * Math.cos(al), Hh + La * Math.sin(al), 0);
    }
  });

  const geo = useMemo(
    () => ({
      balloons: Array.from({ length: arms }, (_, i) => striped(new THREE.SphereGeometry(0.8, 16, 10), SB.balloons[i % SB.balloons.length], 8)),
      bands: Array.from({ length: arms }, (_, i) => striped(new THREE.CylinderGeometry(0.62, 0.6, 0.3, 16, 1, true), [SB.balloons[i % SB.balloons.length][0], SB.balloons[i % SB.balloons.length][1]], 8)),
    }),
    [arms],
  );
  const restY = Hh + La * Math.sin(rad(SAMBA.rest));
  const restX = r0 + La * Math.cos(rad(SAMBA.rest));
  const armParts = useMemo<BoxItem[]>(
    () => [
      { p: [La / 2, 0.1, 0], r: 0, s: [La, 0.14, 0.42], c: SB.arm },
      { p: [La / 2, -0.04, 0], r: 0, s: [La, 0.1, 0.16], c: SB.armUnder },
    ],
    [La],
  );

  return (
    <group>
      {/* Fixed: blue base with a yellow stripe, and the column */}
      <Box size={[1.8, 0.5, 1.8]} position={[0, 0.25, 0]} color={SB.base} />
      <Box size={[1.84, 0.08, 1.84]} position={[0, 0.38, 0]} color={SB.stripe} />
      <mesh position={[0, (0.5 + Hh) / 2, 0]}>
        <cylinderGeometry args={[0.28, 0.36, Hh - 0.5, 8]} />
        <meshLambertMaterial color={SB.column} flatShading />
      </mesh>

      {/* Turning: crown, arms, poles, balloons and baskets */}
      <group ref={spin}>
        <StripedCone r={1.1} h={0.55} colors={SB.crown} position={[0, Hh + 0.45, 0]} segments={10} />
        <mesh position={[0, Hh + 0.05, 0]}>
          <cylinderGeometry args={[0.55, 0.55, 0.35, 10]} />
          <meshLambertMaterial color={SB.armUnder} flatShading />
        </mesh>
        {Array.from({ length: arms }, (_, i) => (
          <group key={i} rotation={[0, (i / arms) * Math.PI * 2, 0]}>
            <group
              ref={(g) => {
                armRefs.current[i] = g;
              }}
              position={[r0, Hh, 0]}
              rotation={[0, 0, rad(SAMBA.rest)]}
            >
              <InstancedBoxes items={armParts} />
            </group>
            <group
              ref={(g) => {
                poleRefs.current[i] = g;
              }}
              position={[restX, restY, 0]}
            >
              <Box size={[0.08, drop + rise - 0.9, 0.08]} position={[0, (rise - drop) / 2, 0]} color={SB.pole} />
              <mesh geometry={geo.balloons[i]} position={[0, rise, 0]} scale={[1, 1.15, 1]}>
                <meshLambertMaterial vertexColors flatShading />
              </mesh>
              <mesh position={[0, -drop - 0.12, 0]}>
                <cylinderGeometry args={[0.6, 0.42, 0.5, 14]} />
                <meshLambertMaterial color={SB.wicker} flatShading />
              </mesh>
              <mesh geometry={geo.bands[i]} position={[0, -drop + 0.28, 0]}>
                <meshLambertMaterial vertexColors flatShading side={THREE.DoubleSide} />
              </mesh>
            </group>
          </group>
        ))}
      </group>
    </group>
  );
}

/**
 * Water Mania: proportions read off the park's photo, as fractions of
 * `opts.r`. Sized so the pool and tubs stay inside the footprint: the paving
 * comes to 4.7 units from the ride's centre.
 */
export const MANIA = {
  pool: 0.93, //      pool radius (to the outside of its rim)
  ring: 0.73, //      radius the tubs travel round
  tub: 0.15, //       tub radius
  tower: 0.53, //     height of the tank's base
  turn: 12, //        seconds per turn at full speed (assumed)
  cycle: { load: 10, build: 5, run: 40, ease: 6 } as RideCycle, // seconds (assumed)
};

const WM = {
  frame: '#E5383B',
  tank: '#E5383B',
  band: '#2A56B8',
  rail: '#F4F4F0',
  rim: '#E9EEF2',
  floor: '#2A6FD0',
  water: '#2FC3DA',
  gun: '#FFC53D',
  hoop: '#5B6B7C',
  seat: '#C7CDD4',
  tubs: ['#F28A1E', '#2A56B8', '#E5383B', '#17A398', '#FFC53D', '#3DAA5C'],
};

/**
 * Water Mania (#15): wooden tubs, each with yellow water guns on its rim, go
 * round a round pool past a red tower whose four legs hold a red barrel tank
 * with blue bands and a white railing. Only the tubs move; the turntable that
 * carries them is under the water.
 */
export function WaterMania({ a }: P) {
  const { r = 4.5, arms = 6 } = a.opts;
  const Rp = MANIA.pool * r;
  const Rt = MANIA.ring * r;
  const tr = MANIA.tub * r;
  const Ht = MANIA.tower * r;
  const spin = useRef<THREE.Group>(null);
  const time = useRef(cycleOffset(a.position[0], a.position[2]));
  useFrame((_, dt) => {
    if (!spin.current) return;
    const step = Math.min(dt, 0.1);
    time.current += step;
    spin.current.rotation.y -= step * cycleIntensity(time.current, MANIA.cycle) * ((Math.PI * 2) / MANIA.turn);
  });

  const parts = useMemo(() => {
    const frame: BoxItem[] = [];
    const legs: [number, number][] = [
      [1, 1],
      [1, -1],
      [-1, 1],
      [-1, -1],
    ];
    const b0 = 0.85; // leg spread at the bottom
    const b1 = 0.45; // and at the top
    for (const [sx, sz] of legs) {
      const dx = (b1 - b0) * sx;
      const dz = (b1 - b0) * sz;
      const len = Math.hypot(dx, Ht, dz);
      const tiltX = Math.atan2(-dz, Ht);
      const tiltZ = Math.atan2(dx, Ht);
      frame.push({ p: [((b0 + b1) / 2) * sx, Ht / 2, ((b0 + b1) / 2) * sz], r: 0, s: [0.14, len, 0.14], c: WM.frame, e: [-tiltX, 0, -tiltZ] });
    }
    // Horizontal ties and cross braces on each face
    const yTie = Ht * 0.45;
    const bt = b0 + (b1 - b0) * 0.45;
    for (const [axis, s] of [
      ['x', 1],
      ['x', -1],
      ['z', 1],
      ['z', -1],
    ] as const) {
      const p: [number, number, number] = axis === 'x' ? [s * bt, yTie, 0] : [0, yTie, s * bt];
      const size: [number, number, number] = axis === 'x' ? [0.1, 0.1, 2 * bt] : [2 * bt, 0.1, 0.1];
      frame.push({ p, r: 0, s: size, c: WM.frame });
      const d = Math.hypot(2 * bt, Ht * 0.55);
      const ang = Math.atan2(Ht * 0.55, 2 * bt);
      for (const k of [1, -1]) {
        const pc: [number, number, number] = axis === 'x' ? [s * (b1 + bt) / 2, yTie + Ht * 0.27, 0] : [0, yTie + Ht * 0.27, s * (b1 + bt) / 2];
        frame.push({ p: pc, r: 0, s: [d * 0.85, 0.08, 0.08], c: WM.frame, e: axis === 'x' ? [k * ang, Math.PI / 2, 0] : [0, 0, k * ang] });
      }
    }
    const rails: BoxItem[] = [];
    for (let j = 0; j < 14; j++) {
      const t = (j / 14) * Math.PI * 2;
      rails.push({ p: [Math.cos(t) * 0.8, Ht + 1.15, Math.sin(t) * 0.8], r: 0, s: [0.04, 0.3, 0.04], c: WM.rail });
    }
    // Tubs: guns and grab bars, in the turning frame.
    const guns: BoxItem[] = [];
    for (let i = 0; i < arms; i++) {
      const t = (i / arms) * Math.PI * 2;
      const cx = Math.cos(t) * Rt;
      const cz = -Math.sin(t) * Rt;
      for (let g = 0; g < 3; g++) {
        const u = t + (g / 3) * Math.PI * 2 + 0.4;
        const gx = cx + Math.cos(u) * (tr - 0.05);
        const gz = cz - Math.sin(u) * (tr - 0.05);
        guns.push({ p: [gx, 1.05, gz], r: 0, s: [0.34, 0.12, 0.12], c: WM.gun, e: [0, u, 0] });
        guns.push({ p: [gx, 0.92, gz], r: 0, s: [0.06, 0.2, 0.06], c: WM.hoop });
      }
    }
    return { frame, rails, guns };
  }, [Ht, Rt, tr, arms]);

  const tubGeo = useMemo(() => Array.from({ length: arms }, () => new THREE.CylinderGeometry(tr, tr * 0.88, 0.85, 12, 1, true)), [arms, tr]);

  return (
    <group>
      {/* Fixed: pool with its rim, floor and water */}
      <mesh position={[0, 0.2, 0]}>
        <cylinderGeometry args={[Rp, Rp, 0.4, 32, 1, true]} />
        <meshLambertMaterial color={WM.rim} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, 0.4, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[Rp - 0.25, Rp, 32]} />
        <meshLambertMaterial color={WM.rim} />
      </mesh>
      <mesh position={[0, 0.03, 0]}>
        <cylinderGeometry args={[Rp - 0.05, Rp - 0.05, 0.06, 32]} />
        <meshLambertMaterial color={WM.floor} />
      </mesh>
      <mesh position={[0, 0.3, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[Rp - 0.25, 32]} />
        <meshLambertMaterial color={WM.water} transparent opacity={0.55} />
      </mesh>

      {/* Fixed: red tower and barrel tank with blue bands and a white railing */}
      <InstancedBoxes items={parts.frame} />
      <mesh position={[0, Ht + 0.5, 0]}>
        <cylinderGeometry args={[0.85, 0.75, 1, 14]} />
        <meshLambertMaterial color={WM.tank} flatShading />
      </mesh>
      {[0.25, 0.8].map((y) => (
        <mesh key={y} position={[0, Ht + y, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.85 - (0.8 - y) * 0.1, 0.05, 4, 20]} />
          <meshLambertMaterial color={WM.band} />
        </mesh>
      ))}
      <InstancedBoxes items={parts.rails} />
      <mesh position={[0, Ht + 1.3, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.8, 0.03, 4, 20]} />
        <meshLambertMaterial color={WM.rail} />
      </mesh>

      {/* Turning: the tubs */}
      <group ref={spin}>
        {tubGeo.map((g, i) => {
          const t = (i / arms) * Math.PI * 2;
          return (
            <group key={i} position={[Math.cos(t) * Rt, 0, -Math.sin(t) * Rt]}>
              <mesh geometry={g} position={[0, 0.6, 0]}>
                <meshLambertMaterial color={WM.tubs[i % WM.tubs.length]} flatShading side={THREE.DoubleSide} />
              </mesh>
              <mesh position={[0, 0.2, 0]}>
                <cylinderGeometry args={[tr * 0.88, tr * 0.88, 0.06, 12]} />
                <meshLambertMaterial color={WM.tubs[i % WM.tubs.length]} />
              </mesh>
              {[0.35, 0.82].map((y) => (
                <mesh key={y} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]}>
                  <torusGeometry args={[tr * (y > 0.5 ? 0.99 : 0.92) + 0.01, 0.03, 4, 16]} />
                  <meshLambertMaterial color={WM.hoop} />
                </mesh>
              ))}
              <mesh position={[0, 0.45, 0]}>
                <cylinderGeometry args={[tr * 0.45, tr * 0.5, 0.45, 10]} />
                <meshLambertMaterial color={WM.seat} />
              </mesh>
            </group>
          );
        })}
        <InstancedBoxes items={parts.guns} />
      </group>
    </group>
  );
}

/** A five-pointed star, 1 unit across, lying in the xy plane: Jump'in Star's decoration. */
const STAR_SHAPE = (() => {
  const s = new THREE.Shape();
  for (let k = 0; k < 10; k++) {
    const rr = k % 2 ? 0.2 : 0.5;
    const t = Math.PI / 2 + (k * Math.PI) / 5;
    if (k === 0) s.moveTo(Math.cos(t) * rr, Math.sin(t) * rr);
    else s.lineTo(Math.cos(t) * rr, Math.sin(t) * rr);
  }
  s.closePath();
  return s;
})();

/**
 * Jump'in Star: proportions read off the park's photo, as fractions of the
 * tower height `opts.h`. The paving comes to 3 units from the ride's centre.
 */
export const JUMP = {
  seats: 6, //       riders in the row (photo shows 6)
  top: 0.78, //      highest the seat row goes, as a fraction of the tower height
  floor: 0.12, //    seat height while loading
  rise: 5, //        seconds to climb to the top (assumed)
  hold: 1, //        seconds at the top before the drop (assumed)
  hops: 5, //        bounces on the way down (assumed)
  fall: 8, //        seconds from the top back to the bottom (assumed)
  load: 10, //       seconds standing at the bottom
};

const JS = {
  column: '#FFC53D',
  star: '#FFC53D',
  rainbow: ['#E65AA0', '#7B6CF6', '#2A56B8', '#2FC3DA', '#F28A1E', '#E5383B'],
  seat: '#3A3F4A',
  carriage: '#E5383B',
  wing: '#FFC53D',
  sign: '#E5383B',
  lamp: '#22252B',
};

/** Height of Jump'in Star's seat row (0 = loading height, 1 = top) at time t into its cycle. */
export function jumpHeight(t: number): number {
  const L = JUMP.load + JUMP.rise + JUMP.hold + JUMP.fall;
  let u = ((t % L) + L) % L;
  if (u < JUMP.load) return 0;
  u -= JUMP.load;
  if (u < JUMP.rise) {
    const v = u / JUMP.rise;
    return v * v * (3 - 2 * v);
  }
  u -= JUMP.rise;
  if (u < JUMP.hold) return 1;
  u -= JUMP.hold;
  // Falling in a series of hops: each one drops lower than the last.
  const v = Math.min(1, u / JUMP.fall);
  // |cos| gives smooth tops and sharp bottoms: each hop lands and bounces.
  const hop = Math.abs(Math.cos(Math.PI * JUMP.hops * v));
  return Math.max(0, (1 - v) * (0.65 + 0.35 * hop));
}

/**
 * Jump'in Star (#13): a yellow tower flanked by two wavy rainbow pillars with
 * yellow stars, topped by the "Jumpin' STAR" sign on a big yellow star. A row
 * of seats on the front of the tower, riders facing out, climbs to the top and
 * then drops back down in a series of hops.
 */
export function JumpinStar({ a }: P) {
  const { h = 7 } = a.opts;
  const car = useRef<THREE.Group>(null);
  const time = useRef(cycleOffset(a.position[0], a.position[2]));
  const yLow = JUMP.floor * h;
  const yTop = JUMP.top * h;
  useFrame((_, dt) => {
    if (!car.current) return;
    time.current += Math.min(dt, 0.1);
    car.current.position.y = yLow + (yTop - yLow) * jumpHeight(time.current);
  });

  const parts = useMemo(() => {
    const boxes: BoxItem[] = [];
    const stars: BoxItem[] = [];
    const n = 14;
    for (const sx of [-1, 1]) {
      for (let j = 0; j < n; j++) {
        const y = (h * 0.92 * (j + 0.5)) / n;
        const wob = 0.12 * Math.sin((j / n) * Math.PI * 3);
        boxes.push({ p: [sx * (0.62 + wob), y, 0], r: 0, s: [0.32, (h * 0.92) / n + 0.01, 0.3], c: JS.rainbow[Math.floor((j * JS.rainbow.length) / n) % JS.rainbow.length] });
        if (j % 3 === 1) stars.push({ p: [sx * (0.86 + wob), y, 0.02], r: 0, s: [0.5, 0.5, 0.08], c: JS.star, e: [0, 0, sx * 0.3] });
      }
    }
    // Small red stars on the yellow column front
    for (let j = 0; j < 5; j++) stars.push({ p: [0.1 * (j % 2 ? 1 : -1), h * (0.15 + j * 0.15), 0.3], r: 0, s: [0.16, 0.16, 0.02], c: JS.sign });
    // The sign's big star and red point
    stars.push({ p: [0, h + 0.65, 0], r: 0, s: [1.7, 1.7, 0.12], c: JS.star });
    boxes.push({ p: [0, h + 0.65, 0.12], r: 0, s: [1.5, 0.28, 0.06], c: JS.sign });
    boxes.push({ p: [0, h + 0.3, 0.12], r: 0, s: [1.1, 0.24, 0.06], c: JS.sign });
    boxes.push({ p: [-0.55, h + 1.3, 0], r: 0, s: [0.18, 0.14, 0.14], c: JS.lamp });
    boxes.push({ p: [0.55, h + 1.3, 0], r: 0, s: [0.18, 0.14, 0.14], c: JS.lamp });
    // The seat row: carriage, yellow wings, seats with shoulder bars, red header
    const seatsBoxes: BoxItem[] = [];
    const w = 0.42;
    const row = w * JUMP.seats;
    seatsBoxes.push({ p: [0, 0, 0.55], r: 0, s: [row, 0.16, 0.6], c: JS.carriage });
    for (const sx of [-1, 1]) seatsBoxes.push({ p: [sx * (row / 2 + 0.22), -0.02, 0.55], r: 0, s: [0.44, 0.14, 0.7], c: JS.wing });
    for (let i = 0; i < JUMP.seats; i++) {
      const x = -row / 2 + w * (i + 0.5);
      seatsBoxes.push({ p: [x, 0.3, 0.42], r: 0, s: [w * 0.82, 0.5, 0.12], c: JS.seat });
      seatsBoxes.push({ p: [x, 0.42, 0.55], r: 0, s: [w * 0.5, 0.18, 0.16], c: JS.seat });
    }
    seatsBoxes.push({ p: [0, 0.75, 0.38], r: 0, s: [1.2, 0.35, 0.08], c: JS.sign });
    seatsBoxes.push({ p: [0, 0.2, 0.3], r: 0, s: [0.9, 0.5, 0.14], c: JS.carriage });
    return { boxes, stars, seatsBoxes };
  }, [h]);

  return (
    <group>
      <mesh position={[0, 0.03, 0]}>
        <cylinderGeometry args={[2.6, 2.6, 0.06, 24]} />
        <meshLambertMaterial color={C.kerb} />
      </mesh>
      {/* Fixed: yellow tower, rainbow pillars, stars and the sign */}
      <Box size={[0.6, h, 0.5]} position={[0, h / 2, 0]} color={JS.column} />
      <InstancedBoxes items={parts.boxes} />
      <InstancedBoxes items={parts.stars} shape="star" />
      {/* Moving: the seat row */}
      <group ref={car} position={[0, yLow, 0]}>
        <InstancedBoxes items={parts.seatsBoxes} />
      </group>
    </group>
  );
}

export const BIKE = {
  pivotRadius: 0.13, // where the arms join the tower
  pivotHeight: 0.6, //  arm pivot height
  arm: 0.55, //         arm length
  hang: 0.9, //         arm tip down to the seats, world units
  rest: -20, //         resting slope of the arms, degrees
  lift: 34, //          degrees a bike can rise above that (assumed)
  turn: 10, //          seconds per turn at full speed (assumed)
  cycle: { load: 10, build: 5, run: 45, ease: 6 } as RideCycle, // seconds (assumed)
};

const MB = {
  checkA: '#E5383B',
  checkB: '#F4F4F0',
  column: '#2A56B8',
  window: '#B9E6F5',
  vane: '#FFC53D',
  arm: '#E9F1F8',
  armDot: '#2F8FE0',
  frame: '#3DAA5C',
  seat: '#F28A1E',
  fan: '#7FD3E0',
  fanHub: '#F4F4F0',
  wing: ['#E5383B', '#FFC53D', '#2F8FE0', '#7B6CF6', '#3DAA5C'],
};

/** One flying bike, local to its arm tip: faces +z (direction of travel), out along +x. */
function bikeParts(i: number): { boxes: BoxItem[]; discs: BoxItem[] } {
  const y = -BIKE.hang;
  const boxes: BoxItem[] = [
    { p: [0, -0.45, 0], r: 0, s: [0.06, 0.9, 0.06], c: MB.frame }, //           hanger from the arm tip
    { p: [0, y, 0], r: 0, s: [0.08, 0.08, 1.4], c: MB.frame }, //             frame along the bike
    { p: [0, y - 0.25, 0.1], r: 0, s: [0.06, 0.06, 1.0], c: MB.frame }, //    lower frame
    { p: [0, y - 0.32, 0.15], r: 0, s: [0.4, 0.04, 0.12], c: MB.frame }, //   pedals
    { p: [0, y - 0.32, -0.4], r: 0, s: [0.4, 0.04, 0.12], c: MB.frame },
    { p: [0, y + 0.12, 0.25], r: 0, s: [0.34, 0.12, 0.34], c: MB.seat }, //   front seat
    { p: [0, y + 0.32, 0.12], r: 0, s: [0.3, 0.32, 0.08], c: MB.seat },
    { p: [0, y + 0.12, -0.35], r: 0, s: [0.34, 0.12, 0.34], c: MB.seat }, //  rear seat
    { p: [0, y + 0.32, -0.48], r: 0, s: [0.3, 0.32, 0.08], c: MB.seat },
    { p: [0, y + 0.4, 0.62], r: 0, s: [0.5, 0.05, 0.05], c: MB.frame }, //    handlebar
    { p: [0, y + 0.2, 0.62], r: 0, s: [0.05, 0.4, 0.05], c: MB.frame },
    { p: [0, 0.35, 0], r: 0, s: [0.05, 0.7, 0.05], c: MB.frame }, //          mast up to the wing
  ];
  // Kite wing: a striped delta above the bike
  for (let s = 0; s < 4; s++) {
    const w = 1.8 - s * 0.38;
    boxes.push({ p: [0, 0.72, 0.3 - s * 0.22], r: 0, s: [w, 0.04, 0.22], c: MB.wing[(i + s) % MB.wing.length] });
  }
  const discs: BoxItem[] = [
    { p: [0, y + 0.15, 0.82], r: 0, s: [0.9, 0.04, 0.9], c: MB.fan, e: [Math.PI / 2, 0, 0] }, // propeller disc
    { p: [0, y + 0.15, 0.85], r: 0, s: [0.18, 0.06, 0.18], c: MB.fanHub, e: [Math.PI / 2, 0, 0] },
  ];
  return { boxes, discs };
}

/**
 * Magic Bike (#6): pedal bikes with a propeller disc and a striped kite wing,
 * hung from light double-beam arms round a lighthouse-style tower (a red and
 * white checkered base, blue column with a window, checkered cone roof and a
 * yellow weathervane). The arms and bikes turn round the tower; each rider's
 * pedalling raises their bike, so each one rises and falls on its own, kept
 * level by the double beam.
 */
export function MagicBike({ a }: P) {
  const { r = 4, arms = 6 } = a.opts;
  const r0 = BIKE.pivotRadius * r;
  const Hp = BIKE.pivotHeight * r;
  const L = BIKE.arm * r;
  const spin = useRef<THREE.Group>(null);
  const beams = useRef<(THREE.Group | null)[]>([]);
  const bikes = useRef<(THREE.Group | null)[]>([]);
  const time = useRef(cycleOffset(a.position[0], a.position[2]));
  useFrame((_, dt) => {
    if (!spin.current) return;
    const step = Math.min(dt, 0.1);
    time.current += step;
    const t = time.current;
    const k = cycleIntensity(t, BIKE.cycle);
    spin.current.rotation.y -= step * k * ((Math.PI * 2) / BIKE.turn);
    for (let i = 0; i < arms; i++) {
      const f = 0.16 + 0.12 * hash01(i + 31);
      const u = Math.max(-1, Math.min(1, 1.8 * Math.sin(t * f + hash01(i + 41) * 6.28)));
      const al = rad(BIKE.rest + BIKE.lift * k * (0.5 + 0.5 * u));
      beams.current[i]?.rotation.set(0, 0, al);
      bikes.current[i]?.position.set(r0 + L * Math.cos(al), Hp + L * Math.sin(al), 0);
    }
  });

  const parts = useMemo(() => {
    const fixed: BoxItem[] = [];
    for (let row = 0; row < 2; row++)
      for (let j = 0; j < 4; j++)
        for (const [sx, sz] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ]) {
          const off = -0.6 + j * 0.4 + 0.2;
          const p: [number, number, number] = sx ? [sx * 0.81, 0.18 + row * 0.35, off] : [off, 0.18 + row * 0.35, sz * 0.81];
          fixed.push({ p, r: 0, s: sx ? [0.02, 0.35, 0.4] : [0.4, 0.35, 0.02], c: (row + j) % 2 ? MB.checkA : MB.checkB });
        }
    const top: BoxItem[] = [];
    for (let j = 0; j < 4; j++) top.push({ p: [0, Hp + 0.75 + j * 0.06, 0], r: 0, s: [0.06, 0.06, 0.06], c: MB.vane });
    const beam: BoxItem[] = [
      { p: [L / 2, 0.12, 0], r: 0, s: [L, 0.08, 0.1], c: MB.arm },
      { p: [L / 2, -0.12, 0], r: 0, s: [L, 0.08, 0.1], c: MB.arm },
    ];
    for (let j = 1; j < 7; j++) beam.push({ p: [(L * j) / 7, 0.18, 0], r: 0, s: [0.07, 0.05, 0.07], c: MB.armDot });
    return { fixed, top, beam, bikes: Array.from({ length: arms }, (_, i) => bikeParts(i)) };
  }, [Hp, L, arms]);

  const roof = useMemo(() => striped(new THREE.ConeGeometry(0.62, 0.9, 12, 2), [MB.checkA, MB.checkB], 12), []);
  return (
    <group>
      <mesh position={[0, 0.03, 0]}>
        <cylinderGeometry args={[4.1, 4.1, 0.06, 28]} />
        <meshLambertMaterial color={C.kerb} />
      </mesh>
      {/* Fixed: checkered base */}
      <Box size={[1.6, 0.7, 1.6]} position={[0, 0.35, 0]} color={MB.checkB} />
      <InstancedBoxes items={parts.fixed} />
      {/* Turning: column, roof, weathervane, arms and bikes */}
      <group ref={spin}>
        <mesh position={[0, (0.7 + Hp + 0.2) / 2, 0]}>
          <cylinderGeometry args={[0.42, 0.5, Hp - 0.5, 10]} />
          <meshLambertMaterial color={MB.column} flatShading />
        </mesh>
        <mesh position={[0, Hp - 0.35, 0.3]}>
          <boxGeometry args={[0.45, 0.7, 0.3]} />
          <meshLambertMaterial color={MB.window} />
        </mesh>
        <mesh geometry={roof} position={[0, Hp + 0.6, 0]}>
          <meshLambertMaterial vertexColors flatShading />
        </mesh>
        <InstancedBoxes items={parts.top} />
        <Box size={[0.5, 0.04, 0.04]} position={[0, Hp + 1.02, 0]} color={MB.vane} />
        {Array.from({ length: arms }, (_, i) => (
          <group key={i} rotation={[0, (i / arms) * Math.PI * 2, 0]}>
            <group
              ref={(g) => {
                beams.current[i] = g;
              }}
              position={[r0, Hp, 0]}
              rotation={[0, 0, rad(BIKE.rest)]}
            >
              <InstancedBoxes items={parts.beam} />
            </group>
            <group
              ref={(g) => {
                bikes.current[i] = g;
              }}
              position={[r0 + L * Math.cos(rad(BIKE.rest)), Hp + L * Math.sin(rad(BIKE.rest)), 0]}
            >
              <InstancedBoxes items={parts.bikes[i].boxes} />
              <InstancedBoxes items={parts.bikes[i].discs} shape="disc" />
            </group>
          </group>
        ))}
      </group>
    </group>
  );
}

export const WAVE = {
  pivotRadius: 0.13, // where the arms join the column
  pivotHeight: 0.16, // arm pivot height
  arm: 0.67, //         arm length
  rest: -6, //          arm slope while loading, degrees
  waveMid: 14, //       slope round which the arms rise and fall
  waveAmp: 19, //       degrees either side (photo shows cars high and low at once)
  wave: 6, //           seconds per rise and fall (assumed)
  turn: 8, //           seconds per turn at full speed (assumed)
  cycle: { load: 10, build: 6, run: 40, ease: 8 } as RideCycle, // seconds (assumed)
};

const WB = {
  base: '#FFC53D',
  column: '#B23AB8',
  drum: '#FFE14D',
  dome: ['#E65AA0', '#F28A1E', '#B23AB8'],
  arm: '#E5532A',
  car: '#F28A1E',
  seat: '#E5532A',
  bar: '#3A3F4A',
};

/**
 * Wave Blaster (#12): long orange arms round a yellow base, purple column,
 * yellow drum and striped dome. A car of three seats facing out sits at each
 * arm's end. The ride turns and the arms rise and fall in a wave, tipping the
 * cars up as they climb.
 */
export function WaveBlaster({ a }: P) {
  const { r = 4.5, arms = 8 } = a.opts;
  const r0 = WAVE.pivotRadius * r;
  const h0 = WAVE.pivotHeight * r;
  const L = WAVE.arm * r;
  const spin = useRef<THREE.Group>(null);
  const armRefs = useRef<(THREE.Group | null)[]>([]);
  const time = useRef(cycleOffset(a.position[0], a.position[2]));
  useFrame((_, dt) => {
    if (!spin.current) return;
    const step = Math.min(dt, 0.1);
    time.current += step;
    const t = time.current;
    const k = cycleIntensity(t, WAVE.cycle);
    spin.current.rotation.y -= step * k * ((Math.PI * 2) / WAVE.turn);
    for (let i = 0; i < arms; i++) {
      const wave = WAVE.waveMid + WAVE.waveAmp * Math.sin((t / WAVE.wave) * Math.PI * 2 + (i * 4 * Math.PI) / arms);
      armRefs.current[i]?.rotation.set(0, 0, rad(WAVE.rest * (1 - k) + wave * k));
    }
  });

  const parts = useMemo(() => {
    const armItems: BoxItem[] = [
      { p: [L / 2, 0.06, 0.14], r: 0, s: [L, 0.14, 0.1], c: WB.arm },
      { p: [L / 2, 0.06, -0.14], r: 0, s: [L, 0.14, 0.1], c: WB.arm },
      { p: [L * 0.35, 0.06, 0], r: 0, s: [0.4, 0.2, 0.36], c: WB.arm },
      // Car at the end: base, three seats facing out, shoulder bars
      { p: [L, 0.05, 0], r: 0, s: [0.7, 0.25, 1.5], c: WB.car },
      { p: [L - 0.3, 0.45, 0], r: 0, s: [0.14, 0.75, 1.5], c: WB.car },
    ];
    for (const z of [-0.5, 0, 0.5]) {
      armItems.push({ p: [L - 0.15, 0.55, z], r: 0, s: [0.12, 0.55, 0.36], c: WB.seat });
      armItems.push({ p: [L - 0.02, 0.62, z], r: 0, s: [0.2, 0.08, 0.36], c: WB.bar });
      armItems.push({ p: [L + 0.06, 0.24, z + 0.22], r: 0, s: [0.32, 0.12, 0.04], c: WB.car });
    }
    return armItems;
  }, [L]);
  const dome = useMemo(() => striped(new THREE.SphereGeometry(0.85, 16, 6, 0, Math.PI * 2, 0, Math.PI / 2), WB.dome, 16), []);

  return (
    <group>
      <mesh position={[0, 0.03, 0]}>
        <cylinderGeometry args={[4.1, 4.1, 0.06, 28]} />
        <meshLambertMaterial color={C.kerb} />
      </mesh>
      {/* Fixed: flared yellow base */}
      <mesh position={[0, 0.3, 0]}>
        <cylinderGeometry args={[0.6, 0.9, 0.6, 12]} />
        <meshLambertMaterial color={WB.base} flatShading />
      </mesh>
      {/* Turning: column, drum, dome and the arms */}
      <group ref={spin}>
        <mesh position={[0, 1.05, 0]}>
          <cylinderGeometry args={[0.4, 0.45, 0.9, 10]} />
          <meshLambertMaterial color={WB.column} flatShading />
        </mesh>
        <mesh position={[0, 1.7, 0]}>
          <cylinderGeometry args={[0.75, 0.6, 0.4, 12]} />
          <meshLambertMaterial color={WB.drum} flatShading />
        </mesh>
        <mesh geometry={dome} position={[0, 1.9, 0]} scale={[1, 0.8, 1]}>
          <meshLambertMaterial vertexColors flatShading />
        </mesh>
        {Array.from({ length: arms }, (_, i) => (
          <group key={i} rotation={[0, (i / arms) * Math.PI * 2, 0]}>
            <group
              ref={(g) => {
                armRefs.current[i] = g;
              }}
              position={[r0, h0, 0]}
              rotation={[0, 0, rad(WAVE.rest)]}
            >
              <InstancedBoxes items={parts} />
            </group>
          </group>
        ))}
      </group>
    </group>
  );
}

/**
 * Kite Flyer: proportions read off the park's photo, as fractions of
 * `opts.r`. Sized so the kites, swung out, stay inside the footprint: the
 * paving comes to 4.5 units from the ride's centre.
 */
export const KITE = {
  height: 0.8, //      hub height
  arm: 0.51, //        hub to each hanger
  hanger: 0.51, //     hanger length
  tilt: 16, //         degrees the turning star leans at full speed (park data had 0.28 rad)
  maxSwing: 30, //     degrees the kites swing out at full speed (assumed)
  cycle: { load: 10, build: 8, run: 35, ease: 10 } as RideCycle, // seconds (assumed)
};

const KF = {
  base: '#2A56B8',
  column: '#2F8FE0',
  dot: '#F4F4F0',
  rings: ['#E65AA0', '#F28A1E', '#E5383B'],
  drum: '#2F8FE0',
  arm: '#2A56B8',
  armTrim: '#FFC53D',
  sail: '#FFC53D',
  flag: '#F28A1E',
  rod: '#C7CDD4',
  kite: '#FFC53D',
  kiteEdge: '#2A56B8',
  rider: '#22252B',
};

/**
 * Kite Flyer (#8): a blue polka-dot column with pink, orange and red rings
 * and a blue drum carries a turning star of blue arms with yellow sails and an
 * orange kite flag at each tip. From each tip a hanger holds a flat kite in
 * which two riders lie face down. As it speeds up the star leans over, so the
 * kites rise and fall as they go round, and they swing outwards.
 */
export function KiteFlyer({ a }: P) {
  const { r = 4.5, arms = 6 } = a.opts;
  const H = KITE.height * r;
  const Ra = KITE.arm * r;
  const Lh = KITE.hanger * r;
  const tiltG = useRef<THREE.Group>(null);
  const spin = useRef<THREE.Group>(null);
  const hangers = useRef<(THREE.Group | null)[]>([]);
  const swing = useRef(0);
  const time = useRef(cycleOffset(a.position[0], a.position[2]));
  const v = useMemo(() => new THREE.Vector3(), []);
  const X = useMemo(() => new THREE.Vector3(1, 0, 0), []);
  const Y = useMemo(() => new THREE.Vector3(0, 1, 0), []);
  const wMax = useMemo(() => Math.sqrt((Math.tan(rad(KITE.maxSwing)) * 9.81) / ((Ra + Lh * Math.sin(rad(KITE.maxSwing))) * 1.45)), [Ra, Lh]);

  useFrame((_, dt) => {
    if (!spin.current || !tiltG.current) return;
    const step = Math.min(dt, 0.1);
    time.current += step;
    const k = cycleIntensity(time.current, KITE.cycle);
    const w = k * wMax;
    const tilt = rad(KITE.tilt) * k;
    tiltG.current.rotation.x = tilt;
    spin.current.rotation.y -= step * w;
    const target = Math.min(rad(KITE.maxSwing), Math.atan((w * w * (Ra + Lh * Math.sin(swing.current)) * 1.45) / 9.81));
    swing.current += (target - swing.current) * (1 - Math.exp(-step / 0.6));
    if (target === 0 && swing.current < 1e-4) swing.current = 0;
    // Hangers hang under gravity: placed in the untilted frame at each arm tip's real position.
    for (let i = 0; i < arms; i++) {
      const g = hangers.current[i];
      if (!g) continue;
      v.set(Ra, 0, 0).applyAxisAngle(Y, spin.current.rotation.y + (i / arms) * Math.PI * 2).applyAxisAngle(X, tilt);
      g.position.set(v.x, H + v.y, v.z);
      g.rotation.set(0, Math.atan2(-v.z, v.x), swing.current);
    }
  });

  const parts = useMemo(() => {
    const fixed: BoxItem[] = [];
    for (let row = 0; row < 5; row++)
      for (let j = 0; j < 8; j++) {
        const t = (j / 8) * Math.PI * 2 + row * 0.4;
        fixed.push({ p: [Math.cos(t) * 0.46, 0.9 + row * 0.35, -Math.sin(t) * 0.46], r: 0, s: [0.1, 0.1, 0.03], c: KF.dot, e: [0, t + Math.PI / 2, 0] });
      }
    const star: BoxItem[] = [];
    for (let i = 0; i < arms; i++) {
      const t = (i / arms) * Math.PI * 2;
      const at = (x: number, y: number): [number, number, number] => [Math.cos(t) * x, y, -Math.sin(t) * x];
      star.push({ p: at(Ra / 2, 0), r: 0, s: [Ra, 0.14, 0.18], c: KF.arm, e: [0, t, 0] });
      star.push({ p: at(Ra / 2, 0.1), r: 0, s: [Ra, 0.04, 0.22], c: KF.armTrim, e: [0, t, 0] });
      star.push({ p: at(Ra * 0.45, -0.35), r: 0, s: [Ra * 0.7, 0.55, 0.04], c: KF.sail, e: [0, t, 0] });
      star.push({ p: at(Ra, 0.45), r: 0, s: [0.05, 0.9, 0.05], c: KF.rod, e: [0, t, 0] });
    }
    const flags: BoxItem[] = [];
    for (let i = 0; i < arms; i++) {
      const t = (i / arms) * Math.PI * 2;
      flags.push({ p: [Math.cos(t) * Ra, 0.95, -Math.sin(t) * Ra], r: 0, s: [0.7, 0.04, 0.4], c: KF.flag, e: [0, t, Math.PI / 2] });
    }
    const hanger: BoxItem[] = [
      { p: [0, -Lh / 2, -0.3], r: 0, s: [0.05, Lh, 0.05], c: KF.rod },
      { p: [0, -Lh / 2, 0.3], r: 0, s: [0.05, Lh, 0.05], c: KF.rod },
      { p: [0, -Lh + 0.12, -0.2], r: 0, s: [0.2, 0.16, 0.5], c: KF.rider }, // riders lying face down
      { p: [0, -Lh + 0.12, 0.3], r: 0, s: [0.2, 0.16, 0.5], c: KF.rider },
      { p: [0, -Lh + 0.2, 0.62], r: 0, s: [0.22, 0.12, 0.16], c: KF.kiteEdge },
    ];
    const kite: BoxItem[] = [
      { p: [0, -Lh, 0.05], r: 0, s: [0.9, 0.12, 1.7], c: KF.kite },
      { p: [0, -Lh - 0.08, 0.05], r: 0, s: [0.95, 0.04, 1.8], c: KF.kiteEdge },
    ];
    return { fixed, star, flags, hanger, kite };
  }, [Ra, Lh, arms]);

  return (
    <group>
      <mesh position={[0, 0.03, 0]}>
        <cylinderGeometry args={[4.1, 4.1, 0.06, 28]} />
        <meshLambertMaterial color={C.kerb} />
      </mesh>
      {/* Fixed: blue base, polka-dot column, coloured rings */}
      <Box size={[1.5, 0.6, 1.5]} position={[0, 0.3, 0]} color={KF.base} />
      <mesh position={[0, 0.6 + (H - 1.6) / 2, 0]}>
        <cylinderGeometry args={[0.45, 0.5, H - 1.6, 12]} />
        <meshLambertMaterial color={KF.column} flatShading />
      </mesh>
      <InstancedBoxes items={parts.fixed} />
      {KF.rings.map((c, j) => (
        <mesh key={c} position={[0, H - 0.95 + j * 0.22, 0]}>
          <cylinderGeometry args={[0.55 + j * 0.05, 0.55 + j * 0.05, 0.22, 12]} />
          <meshLambertMaterial color={c} flatShading />
        </mesh>
      ))}

      {/* Turning and leaning: drum, arms, sails and flags */}
      <group position={[0, H, 0]}>
        <group ref={tiltG}>
          <group ref={spin}>
            <mesh position={[0, -0.15, 0]}>
              <cylinderGeometry args={[0.55, 0.65, 0.6, 12]} />
              <meshLambertMaterial color={KF.drum} flatShading />
            </mesh>
            <InstancedBoxes items={parts.star} />
            <InstancedBoxes items={parts.flags} shape="diamond" />
          </group>
        </group>
      </group>

      {/* Hangers and kites, placed each frame under the arm tips */}
      {Array.from({ length: arms }, (_, i) => (
        <group
          key={i}
          ref={(g) => {
            hangers.current[i] = g;
          }}
          position={[Math.cos((i / arms) * Math.PI * 2) * Ra, H, -Math.sin((i / arms) * Math.PI * 2) * Ra]}
          rotation={[0, (i / arms) * Math.PI * 2, 0]}
        >
          <InstancedBoxes items={parts.hanger} />
          <InstancedBoxes items={parts.kite} shape="diamond" />
        </group>
      ))}
    </group>
  );
}


/** The original shared spinner, used by the flat rides not yet remodelled. */
function SpinnerBase({ a }: P) {
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

export const FERRIS = {
  radius: 0.58, //    hub to each car's hanging pin
  hang: 0.35, //      pin down to the car's centre, world units
  cars: 8,
  turn: 16, //        seconds per turn at full speed (assumed)
  cycle: { load: 10, build: 4, run: 40, ease: 6 } as RideCycle, // seconds (assumed)
};

const FW = {
  legs: ['#7B4FC8', '#2F8FE0'],
  column: '#2A2D33',
  hub: '#FFC53D',
  spokes: ['#E5383B', '#F28A1E', '#FFC53D', '#3DAA5C', '#2F8FE0', '#7B4FC8'],
  bulbs: ['#E5383B', '#FFC53D', '#3DAA5C', '#2F8FE0'],
  rail: '#F4F4F0',
  cars: [
    { body: '#E5383B', end: '#2F8FE0' },
    { body: '#2F8FE0', end: '#E5383B' },
    { body: '#FFC53D', end: '#2F8FE0' },
    { body: '#E5383B', end: '#FFC53D' },
  ],
};

/**
 * Mini Ferris Wheel (#14): a single wheel of rainbow spokes with a yellow hub,
 * held up by a purple and blue A-frame and a dark back leg. A car hangs in
 * front of each spoke's tip: a half drum with round end plates and a white
 * rail cage. The wheel turns and the cars hang level.
 */
export function Ferris({ a }: P) {
  const { r = 4.5 } = a.opts;
  const n = FERRIS.cars;
  const R = FERRIS.radius * r;
  const Hc = R + FERRIS.hang + 0.7; // hub height: the lowest car clears the ground by about 0.25
  const zs = -0.35; // spoke plane
  const zc = 0.3; //   car centres, in front of the spokes
  const wheel = useRef<THREE.Group>(null);
  const cars = useRef<(THREE.Group | null)[]>([]);
  const time = useRef(cycleOffset(a.position[0], a.position[2]));
  useFrame((_, dt) => {
    if (!wheel.current) return;
    const step = Math.min(dt, 0.1);
    time.current += step;
    wheel.current.rotation.z += step * cycleIntensity(time.current, FERRIS.cycle) * ((Math.PI * 2) / FERRIS.turn);
    for (const c of cars.current) c?.rotation.set(0, 0, -wheel.current.rotation.z);
  });

  const parts = useMemo(() => {
    const spokes: BoxItem[] = [];
    const bulbs: BoxItem[] = [];
    for (let i = 0; i < n; i++) {
      const t = (i / n) * Math.PI * 2;
      for (let s = 0; s < 3; s++) {
        const d = (R * (s + 0.5)) / 3;
        spokes.push({ p: [Math.cos(t) * d, Math.sin(t) * d, zs], r: t, s: [R / 3 + 0.02, 0.16, 0.12], c: FW.spokes[(i + s) % FW.spokes.length] });
      }
      for (let b = 1; b < 6; b++) {
        const d = (R * b) / 6;
        bulbs.push({ p: [Math.cos(t) * d - Math.sin(t) * 0.11, Math.sin(t) * d + Math.cos(t) * 0.11, zs + 0.05], r: 0, s: [0.09, 0.09, 0.09], c: FW.bulbs[(b + i) % FW.bulbs.length] });
      }
    }
    // One car, local to its pin: half drum, end plates, cage. Long axis along x.
    const car = (i: number) => {
      const c = FW.cars[i % FW.cars.length];
      const discs: BoxItem[] = [
        { p: [-0.62, -FERRIS.hang, 0], r: 0, s: [0.95, 0.06, 0.95], c: c.end, e: [0, 0, Math.PI / 2] },
        { p: [0.62, -FERRIS.hang, 0], r: 0, s: [0.95, 0.06, 0.95], c: c.end, e: [0, 0, Math.PI / 2] },
        { p: [0, 0, zs - zc + 0.12], r: 0, s: [0.08, 0.6, 0.08], c: C.steel, e: [Math.PI / 2, 0, 0] },
      ];
      const boxes: BoxItem[] = [];
      for (const [x, z] of [
        [-0.55, -0.38],
        [-0.55, 0.38],
        [0.55, -0.38],
        [0.55, 0.38],
      ])
        boxes.push({ p: [x, -FERRIS.hang + 0.32, z], r: 0, s: [0.04, 0.42, 0.04], c: FW.rail });
      boxes.push({ p: [0, -FERRIS.hang + 0.53, -0.38], r: 0, s: [1.14, 0.04, 0.04], c: FW.rail });
      boxes.push({ p: [0, -FERRIS.hang + 0.53, 0.38], r: 0, s: [1.14, 0.04, 0.04], c: FW.rail });
      boxes.push({ p: [0, 0, 0], r: 0, s: [0.06, 0.06, 0.8], c: FW.rail }); // top bar to the pin
      boxes.push({ p: [0, -FERRIS.hang / 2 + 0.1, 0], r: 0, s: [0.05, FERRIS.hang - 0.1, 0.05], c: FW.rail });
      return { discs, boxes, body: c.body };
    };
    return { spokes, bulbs, cars: Array.from({ length: n }, (_, i) => car(i)) };
  }, [n, R]);

  // Half drum: the bottom half of a cylinder lying along x.
  const drum = useMemo(() => {
    const g = new THREE.CylinderGeometry(0.46, 0.46, 1.22, 12, 1, true, Math.PI / 2, Math.PI);
    g.rotateZ(Math.PI / 2);
    return g;
  }, []);

  return (
    <group>
      <mesh position={[0, 0.03, 0]}>
        <cylinderGeometry args={[3.9, 3.9, 0.06, 28]} />
        <meshLambertMaterial color={C.kerb} />
      </mesh>
      {/* Fixed: A-frame, back leg and axle */}
      <Strut from={[-2.0, 0, -1.1]} to={[-0.05, Hc - 0.1, -0.7]} thickness={0.2} color={FW.legs[0]} />
      <Strut from={[2.0, 0, -1.1]} to={[0.05, Hc - 0.1, -0.7]} thickness={0.2} color={FW.legs[1]} />
      <Strut from={[0, 0, -2.2]} to={[0, Hc - 0.1, -0.75]} thickness={0.24} color={FW.column} />
      <mesh position={[0, Hc, (zs - 0.75) / 2]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.1, 0.1, 0.75 + zs, 8]} />
        <meshLambertMaterial color={C.steel} />
      </mesh>

      {/* Turning: the wheel, with cars kept level */}
      <group position={[0, Hc, 0]}>
        <group ref={wheel}>
          <InstancedBoxes items={parts.spokes} />
          <InstancedBoxes items={parts.bulbs} shape="ball" />
          <mesh position={[0, 0, zs + 0.05]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.38, 0.38, 0.22, 10]} />
            <meshLambertMaterial color={FW.hub} flatShading />
          </mesh>
          {parts.cars.map((c, i) => {
            const t = (i / n) * Math.PI * 2;
            return (
              <group
                key={i}
                ref={(g) => {
                  cars.current[i] = g;
                }}
                position={[Math.cos(t) * R, Math.sin(t) * R, zc]}
              >
                <mesh geometry={drum} position={[0, -FERRIS.hang, 0]}>
                  <meshLambertMaterial color={c.body} flatShading side={THREE.DoubleSide} />
                </mesh>
                <InstancedBoxes items={c.discs} shape="disc" />
                <InstancedBoxes items={c.boxes} />
              </group>
            );
          })}
        </group>
      </group>
    </group>
  );
}

/**
 * Shapes drawn as one instanced mesh: one draw call however many there are.
 * `r` turns each about the z axis; `e` (x, y, z Euler angles) replaces it when
 * given. `s` scales the unit shape: a 1×1×1 box, a disc/cylinder of diameter
 * 1 and height 1 along y, a ring of diameter 1 in the xy plane, a ball of
 * diameter 1, or a five-pointed star 1 across in the xy plane, 1 deep in z.
 */
type BoxItem = { p: [number, number, number]; r: number; s: [number, number, number]; c: string; e?: [number, number, number] };
function InstancedBoxes({ items, shape = 'box' }: { items: BoxItem[]; shape?: 'box' | 'disc' | 'ring' | 'ball' | 'star' | 'diamond' }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    const o = new THREE.Object3D();
    const c = new THREE.Color();
    items.forEach((it, i) => {
      o.position.set(...it.p);
      if (it.e) o.rotation.set(...it.e);
      else o.rotation.set(0, 0, it.r);
      o.scale.set(...it.s);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
      m.setColorAt(i, c.set(it.c));
    });
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    m.computeBoundingSphere();
  }, [items]);
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, items.length]}>
      {shape === 'box' && <boxGeometry args={[1, 1, 1]} />}
      {shape === 'disc' && <cylinderGeometry args={[0.5, 0.5, 1, 14]} />}
      {shape === 'ring' && <torusGeometry args={[0.5, 0.05, 4, 16]} />}
      {shape === 'ball' && <sphereGeometry args={[0.5, 8, 6]} />}
      {shape === 'star' && <extrudeGeometry args={[STAR_SHAPE, { depth: 1, bevelEnabled: false }]} />}
      {shape === 'diamond' && <cylinderGeometry args={[0.5, 0.5, 1, 4]} />}
      <meshLambertMaterial flatShading={shape !== 'box'} />
    </instancedMesh>
  );
}

/**
 * Delta Hoppla: proportions, as fractions of the pivot height `h`, read off the
 * park's photo of the ride. Angles are degrees either side of the main arm.
 */
export const HOPPLA = {
  ring: 0.57, //          radius of the curved gondola carrier
  ringSpan: 76, //        the carrier runs this far either side of the arm
  counterweight: 0.57, // distance of the counterweight disc from the pivot
  mounts: [20, 37, 53, 74], // gondola mounts, each side of the arm (8 in all)
  spokes: 52, //          the two side spokes that brace the carrier
  crossbar: 0.69, //      radius of the bar each pair of gondolas hangs from
  seat: 0.745, //         radius of the gondola centres
  plane: 0.15, //         how far in front of the tower the swinging parts turn
  maxSwing: 145, //       degrees from hanging straight down (photo shows at least ~140)
  period: 6.5, //         seconds for one full swing there and back (assumed)
  cycle: { load: 10, build: 18, run: 22, ease: 16 } as RideCycle, // seconds (assumed)
};

const HP = {
  pink: '#E8438C',
  pinkLight: '#F079B0',
  yellow: '#F6C81E',
  orange: '#F28A1E',
  gondola: '#D8343A',
  headrest: '#2A56B8',
  fence: '#3157C9',
  deck: '#A2A8B0',
  cabin: '#E9D9B8',
  slab: '#BFC3CB',
};

/**
 * Delta Hoppla (#4): a counterweighted pendulum fan on a blue tower. A magenta
 * main arm turns on a yellow hub at the top; its short end carries a round
 * yellow counterweight, its long end a curved carrier (pink in the middle,
 * orange then yellow towards the ends) braced by two side spokes, with eight
 * mounts of two gondolas each. The whole fan swings as one rigid piece about
 * the hub, in a plane just in front of the tower, and hangs straight down to
 * load.
 */
export function Hoppla({ a }: P) {
  const { h = 6 } = a.opts;
  const arm = col(a);
  const tower = acc(a);
  const swing = useRef<THREE.Group>(null);
  const time = useRef(cycleOffset(a.position[0], a.position[2]));
  useFrame((_, dt) => {
    if (!swing.current) return;
    time.current += Math.min(dt, 0.1); // a hidden tab shouldn't jump the ride on return
    const t = time.current;
    const k = cycleIntensity(t, HOPPLA.cycle);
    swing.current.rotation.z = rad(HOPPLA.maxSwing) * k * Math.sin((t / HOPPLA.period) * Math.PI * 2);
  });

  const R = HOPPLA.ring * h;
  const d = HOPPLA.plane * h;
  // Angle on the swinging group, measured like Math.atan2: the arm hangs along -y.
  const at = (deg: number) => rad(deg - 90);
  const onRing = (deg: number, r: number, z = 0): [number, number, number] => [Math.cos(at(deg)) * r, Math.sin(at(deg)) * r, z];
  const zone = (deg: number) => (Math.abs(deg) < 28 ? HP.pink : Math.abs(deg) < 48 ? HP.orange : HP.yellow);

  // Outriggers, cross bars and gondolas: four instanced meshes in all.
  const fan = useMemo(() => {
    const out: BoxItem[] = [];
    const bars: BoxItem[] = [];
    const seats: BoxItem[] = [];
    const rests: BoxItem[] = [];
    const angles = HOPPLA.mounts.flatMap((m) => [-m, m]);
    for (const m of angles) {
      const t = at(m);
      const radial: [number, number] = [Math.cos(t), Math.sin(t)];
      const tangent: [number, number] = [-Math.sin(t), Math.cos(t)];
      const c = Math.abs(m) < 45 ? HP.orange : HP.yellow;
      const stem = (HOPPLA.ring + HOPPLA.crossbar) / 2;
      out.push({ p: [radial[0] * stem * h, radial[1] * stem * h, 0], r: t, s: [(HOPPLA.crossbar - HOPPLA.ring) * h, 0.035 * h, 0.035 * h], c });
      bars.push({ p: [radial[0] * HOPPLA.crossbar * h, radial[1] * HOPPLA.crossbar * h, 0], r: t, s: [0.025 * h, 0.16 * h, 0.025 * h], c });
      for (const side of [-1, 1]) {
        const off = side * 0.07 * h;
        const at2 = (rr: number): [number, number, number] => [radial[0] * rr * h + tangent[0] * off, radial[1] * rr * h + tangent[1] * off, 0];
        seats.push({ p: at2(HOPPLA.seat), r: t, s: [0.08 * h, 0.05 * h, 0.07 * h], c: HP.gondola });
        rests.push({ p: at2(HOPPLA.seat + 0.05), r: t, s: [0.025 * h, 0.055 * h, 0.075 * h], c: HP.headrest });
      }
    }
    return { out, bars, seats, rests };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [h]);

  const fencePosts = useMemo<BoxItem[]>(() => {
    const fr = 0.77 * h;
    return Array.from({ length: 20 }, (_, i) => {
      const t = (i / 20) * Math.PI * 2;
      return { p: [Math.cos(t) * fr, 0.08 * h, Math.sin(t) * fr], r: 0, s: [0.04, 0.16 * h, 0.04], c: HP.fence };
    });
  }, [h]);

  // The carrier: pink centre, orange then yellow towards each end.
  const arcs: { from: number; to: number; c: string }[] = [
    { from: -28, to: 28, c: HP.pink },
    { from: 28, to: 48, c: HP.orange },
    { from: -48, to: -28, c: HP.orange },
    { from: 48, to: HOPPLA.ringSpan, c: HP.yellow },
    { from: -HOPPLA.ringSpan, to: -48, c: HP.yellow },
  ];
  const cw = HOPPLA.counterweight * h;

  return (
    <group>
      {/* Fixed: paved base inside a blue railing */}
      <Pad r={0.77 * h} inner={HP.slab} />
      <InstancedBoxes items={fencePosts} />
      <mesh position={[0, 0.15 * h, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.77 * h, 0.03, 4, 40]} />
        <meshLambertMaterial color={HP.fence} />
      </mesh>

      {/* Fixed: cream cabin behind the tower */}
      <Box size={[0.5 * h, 0.42 * h, 0.3 * h]} position={[0, 0.21 * h, -0.47 * h]} color={HP.cabin} />

      {/* Fixed: square blue tower, pink just below the hub, and two splayed legs */}
      <mesh position={[0, 0.42 * h, 0]} rotation={[0, Math.PI / 4, 0]}>
        <cylinderGeometry args={[0.05 * h, 0.065 * h, 0.84 * h, 4]} />
        <meshLambertMaterial color={tower} flatShading />
      </mesh>
      <mesh position={[0, 0.91 * h, 0]} rotation={[0, Math.PI / 4, 0]}>
        <cylinderGeometry args={[0.048 * h, 0.05 * h, 0.14 * h, 4]} />
        <meshLambertMaterial color={arm} flatShading />
      </mesh>
      {[-1, 1].map((s) => (
        <Strut key={s} from={[s * 0.6 * h, 0, -0.18 * h]} to={[s * 0.035 * h, 0.74 * h, -0.01 * h]} thickness={0.05 * h} color={tower} />
      ))}

      {/* Fixed: railed service deck at the top of the tower */}
      <Box size={[0.3 * h, 0.025 * h, 0.2 * h]} position={[-0.04 * h, 0.86 * h, -0.04 * h]} color={HP.deck} />
      <Box size={[0.3 * h, 0.012 * h, 0.012 * h]} position={[-0.04 * h, 0.93 * h, -0.14 * h]} color={C.steel} />
      {[-1, 1].map((s) => (
        <Box key={s} size={[0.012 * h, 0.012 * h, 0.2 * h]} position={[-0.04 * h + s * 0.15 * h, 0.93 * h, -0.04 * h]} color={C.steel} />
      ))}

      {/* Fixed: axle from the tower to the swing plane */}
      <mesh position={[0, h, d / 2]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.03 * h, 0.03 * h, d, 8]} />
        <meshLambertMaterial color={C.steel} />
      </mesh>

      {/* Moving: the whole fan swings about the hub */}
      <group position={[0, h, d]}>
        <group ref={swing}>
          {/* Main arm, wide at the hub and narrowing towards the carrier */}
          <mesh position={[0, -R / 2, 0]} rotation={[0, Math.PI / 4, 0]}>
            <cylinderGeometry args={[0.07 * h, 0.05 * h, R, 4]} />
            <meshLambertMaterial color={arm} flatShading />
          </mesh>
          <mesh position={[0, cw / 2, 0]} rotation={[0, Math.PI / 4, 0]}>
            <cylinderGeometry args={[0.06 * h, 0.07 * h, cw, 4]} />
            <meshLambertMaterial color={arm} flatShading />
          </mesh>
          {/* Counterweight: yellow disc in a magenta frame */}
          <Box size={[0.2 * h, 0.2 * h, 0.05 * h]} position={[0, cw, -0.01 * h]} color={arm} />
          <mesh position={[0, cw, 0.035 * h]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.085 * h, 0.085 * h, 0.04 * h, 16]} />
            <meshLambertMaterial color={HP.yellow} flatShading />
          </mesh>
          {/* Yellow hub */}
          <mesh position={[0, 0, 0.06 * h]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.075 * h, 0.075 * h, 0.03 * h, 16]} />
            <meshLambertMaterial color={HP.yellow} flatShading />
          </mesh>
          {/* Curved carrier */}
          {arcs.map((s) => (
            <mesh key={s.from} rotation={[0, 0, at(s.from)]}>
              <torusGeometry args={[R, 0.022 * h, 4, 10, rad(s.to - s.from)]} />
              <meshLambertMaterial color={s.c} flatShading />
            </mesh>
          ))}
          {/* Joint plates where the arm meets the carrier */}
          {[-8, 8].map((deg) => (
            <mesh key={deg} position={onRing(deg, R, 0.03 * h)} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.045 * h, 0.045 * h, 0.02 * h, 12]} />
              <meshLambertMaterial color={HP.pinkLight} flatShading />
            </mesh>
          ))}
          {/* Side spokes, pink at the hub and yellow out to the carrier, with yellow nodes */}
          {[-HOPPLA.spokes, HOPPLA.spokes].map((deg) => (
            <group key={deg}>
              <Strut from={[0, 0, 0]} to={onRing(deg, R * 0.55)} thickness={0.035 * h} color={arm} />
              <Strut from={onRing(deg, R * 0.55)} to={onRing(deg, R)} thickness={0.035 * h} color={HP.yellow} />
              <mesh position={onRing(deg, R, 0.03 * h)} rotation={[Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[0.04 * h, 0.04 * h, 0.02 * h, 12]} />
                <meshLambertMaterial color={HP.yellow} flatShading />
              </mesh>
            </group>
          ))}
          {/* Outriggers, cross bars, gondolas and their blue headrests */}
          <InstancedBoxes items={fan.out} />
          <InstancedBoxes items={fan.bars} />
          <InstancedBoxes items={fan.seats} />
          <InstancedBoxes items={fan.rests} />
        </group>
      </group>
    </group>
  );
}

/** Tall towers: Sky Screamer (swing star at the top), Z Force (a ring of seats riding up and down). `top: 'hop'` is Jump'in Star. */
export function Tower({ a }: P) {
  if (a.opts.top === 'hop') return <JumpinStar a={a} />;
  if (a.opts.top === 'star') return <SkyScreamer a={a} />;
  return <TowerBase a={a} />;
}

function TowerBase({ a }: P) {
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
export const FRISBEE = {
  arm: 0.92, //        pivot to the disc
  disc: 0.24, //       disc radius
  seats: 32,
  footX: 0.55, //      legs' spread along the swing, each side
  footZ: 0.4, //       legs' spread across it, each side
  topZ: 0.08, //       legs' spacing at the top, each side
  maxSwing: 120, //    degrees each way at full swing (assumed)
  period: 11, //       seconds per swing there and back (assumed: a real pendulum this long can't swing faster)
  spin: 10, //         seconds per turn of the disc at full speed (assumed)
  cycle: { load: 12, build: 20, run: 20, ease: 16 } as RideCycle, // seconds (assumed)
};

const GF = {
  legFoot: '#F28A1E',
  armTop: '#F28A1E',
  armLow: '#FFC53D',
  hub: '#F28A1E',
  rim: '#2A56B8',
  seats: ['#FFC53D', '#2A56B8'],
  harness: '#E5383B',
};

/**
 * Giant Frisbee (#22): four tall blue legs with orange feet hold the pivot. A
 * long arm, orange at the top and yellow lower down, carries a disc: an orange
 * five-spoke hub with a blue rim and a ring of seats facing out. The arm hangs
 * still to load, then swings higher and higher while the disc turns.
 */
export function Frisbee({ a }: P) {
  const { h = 15 } = a.opts;
  const legs = a.opts.accent ?? '#2A56B8';
  const L = FRISBEE.arm * h;
  const Rd = FRISBEE.disc * h;
  const arm = useRef<THREE.Group>(null);
  const disc = useRef<THREE.Group>(null);
  const time = useRef(cycleOffset(a.position[0], a.position[2]));
  useFrame((_, dt) => {
    if (!arm.current || !disc.current) return;
    const step = Math.min(dt, 0.1);
    time.current += step;
    const t = time.current;
    const k = cycleIntensity(t, FRISBEE.cycle);
    arm.current.rotation.z = rad(FRISBEE.maxSwing) * k * Math.sin((t / FRISBEE.period) * Math.PI * 2);
    disc.current.rotation.y += step * k * ((Math.PI * 2) / FRISBEE.spin);
  });

  const parts = useMemo(() => {
    const armItems: BoxItem[] = [
      { p: [0, -L * 0.22, 0], r: 0, s: [0.9, L * 0.44, 0.8], c: GF.armTop },
      { p: [0, -L * 0.7, 0], r: 0, s: [0.7, L * 0.52, 0.6], c: GF.armLow },
      { p: [0, 0, 0], r: 0, s: [1.1, 1.1, 1.3], c: legs },
    ];
    const discItems: BoxItem[] = [];
    for (let j = 0; j < 5; j++) {
      const t = (j / 5) * Math.PI * 2;
      discItems.push({ p: [Math.cos(t) * Rd * 0.5, -0.1, -Math.sin(t) * Rd * 0.5], r: 0, s: [Rd, 0.3, 0.4], c: GF.hub, e: [0, t, 0] });
    }
    const n = FRISBEE.seats;
    for (let j = 0; j < n; j++) {
      const t = (j / n) * Math.PI * 2;
      const at = (rr: number, y: number): [number, number, number] => [Math.cos(t) * rr, y, -Math.sin(t) * rr];
      discItems.push({ p: at(Rd - 0.15, 0.45), r: 0, s: [0.12, 0.7, 0.5], c: GF.seats[j % 2], e: [0, t, 0] }); //  seat back
      discItems.push({ p: at(Rd + 0.12, 0.12), r: 0, s: [0.45, 0.1, 0.45], c: GF.seats[j % 2], e: [0, t, 0] }); // seat
      discItems.push({ p: at(Rd + 0.05, 0.6), r: 0, s: [0.2, 0.3, 0.36], c: GF.harness, e: [0, t, 0] }); //       harness
    }
    return { armItems, discItems };
  }, [L, Rd, legs]);

  const fx = FRISBEE.footX * h;
  const fz = FRISBEE.footZ * h;
  const tz = FRISBEE.topZ * h;
  return (
    <group>
      {/* Fixed: four legs, blue with orange feet */}
      {[-1, 1].map((sx) =>
        [-1, 1].map((sz) => {
          const foot: [number, number, number] = [sx * fx, 0, sz * fz];
          const knee: [number, number, number] = [sx * fx * 0.82, h * 0.18, sz * (tz + (fz - tz) * 0.82)];
          const top: [number, number, number] = [sx * 0.4, h, sz * tz];
          return (
            <group key={`${sx}${sz}`}>
              <Strut from={foot} to={knee} thickness={0.6} color={GF.legFoot} />
              <Strut from={knee} to={top} thickness={0.55} color={legs} />
            </group>
          );
        }),
      )}
      <Box size={[1.2, 0.9, 2 * tz + 0.6]} position={[0, h, 0]} color={legs} />

      {/* Moving: the arm swings; the disc turns at its end */}
      <group position={[0, h, 0]}>
        <group ref={arm}>
          <InstancedBoxes items={parts.armItems} />
          <group position={[0, -L, 0]}>
            <group ref={disc}>
              <mesh position={[0, 0, 0]}>
                <cylinderGeometry args={[0.7, 0.9, 0.7, 10]} />
                <meshLambertMaterial color={GF.hub} flatShading />
              </mesh>
              <mesh rotation={[Math.PI / 2, 0, 0]}>
                <torusGeometry args={[Rd, 0.14, 5, 40]} />
                <meshLambertMaterial color={GF.rim} />
              </mesh>
              <InstancedBoxes items={parts.discItems} />
            </group>
          </group>
        </group>
      </group>
    </group>
  );
}


/** Top Spin: two towers with a gondola carried round between them on a pair of arms. */
export const SCREAMER = {
  star: 0.13, //       radius the cables hang from
  cable: 0.21, //      cable length
  low: 0.25, //        star height while loading (seats just off the ground)
  high: 0.93, //       star height at the top
  climb: 14, //        seconds to climb or come down (assumed)
  seats: 12,
  maxSwing: 55, //     degrees the seats swing out at full speed (photo shows ~55)
  cycle: { load: 12, build: 20, run: 25, ease: 20 } as RideCycle, // seconds (assumed)
};

const SS = {
  tower: '#F4F4F0',
  brace: '#D6DBE0',
  finTop: '#24305E',
  finUnder: '#C9CED6',
  hub: '#8D939C',
  ball: '#D9B84A',
  cable: '#C7CDD4',
  seat: '#D7262E',
  rider: '#22252B',
};

/** How high Sky Screamer's star is (0 = loading, 1 = top) at time t: it climbs as the ride starts and comes down as it slows. */
function screamerHeight(t: number): number {
  const c = SCREAMER.cycle;
  const L = c.load + c.build + c.run + c.ease;
  let u = ((t % L) + L) % L;
  const s = (x: number) => {
    const v = Math.max(0, Math.min(1, x));
    return v * v * (3 - 2 * v);
  };
  if (u < c.load) return 0;
  u -= c.load;
  if (u < c.build + c.run) return s(u / SCREAMER.climb);
  u -= c.build + c.run;
  return 1 - s((u - (c.ease - SCREAMER.climb)) / SCREAMER.climb);
}

/**
 * Sky Screamer (#17): a white lattice tower with a wire ball and crown on top.
 * A star of twelve points, navy on top and silver underneath, carries twelve
 * red swing seats on cables. The star climbs the tower as it starts to turn,
 * the seats swing far out at the top, and it comes back down to load.
 */
export function SkyScreamer({ a }: P) {
  const { h = 24 } = a.opts;
  const Rs = SCREAMER.star * h;
  const Lc = SCREAMER.cable * h;
  const yLow = SCREAMER.low * h;
  const yHigh = SCREAMER.high * h;
  const n = SCREAMER.seats;
  const carriage = useRef<THREE.Group>(null);
  const spin = useRef<THREE.Group>(null);
  const hangers = useRef<(THREE.Group | null)[]>([]);
  const swing = useRef(0);
  const time = useRef(cycleOffset(a.position[0], a.position[2]));
  const wMax = useMemo(() => Math.sqrt((Math.tan(rad(SCREAMER.maxSwing)) * 9.81) / ((Rs + Lc * Math.sin(rad(SCREAMER.maxSwing))) * 1.45)), [Rs, Lc]);

  useFrame((_, dt) => {
    if (!carriage.current || !spin.current) return;
    const step = Math.min(dt, 0.1);
    time.current += step;
    const t = time.current;
    const hf = screamerHeight(t);
    carriage.current.position.y = yLow + (yHigh - yLow) * hf;
    // It only turns properly once it is off the ground.
    const w = cycleIntensity(t, SCREAMER.cycle) * wMax * hf * hf;
    spin.current.rotation.y -= step * w;
    const target = Math.min(rad(SCREAMER.maxSwing), Math.atan((w * w * (Rs + Lc * Math.sin(swing.current)) * 1.45) / 9.81));
    swing.current += (target - swing.current) * (1 - Math.exp(-step / 0.8));
    if (target === 0 && swing.current < 1e-4) swing.current = 0;
    for (const g of hangers.current) g?.rotation.set(0, 0, swing.current);
  });

  const parts = useMemo(() => {
    const tower: BoxItem[] = [];
    const tw = 0.42;
    for (const [sx, sz] of [
      [1, 1],
      [1, -1],
      [-1, 1],
      [-1, -1],
    ])
      tower.push({ p: [sx * tw, h / 2, sz * tw], r: 0, s: [0.1, h, 0.1], c: SS.tower });
    const step = 0.9;
    for (let y = step; y < h; y += step) {
      for (const [axis, s] of [
        ['x', 1],
        ['x', -1],
        ['z', 1],
        ['z', -1],
      ] as const) {
        const ang = Math.atan2(step, 2 * tw) * (Math.round(y / step) % 2 ? 1 : -1);
        const len = Math.hypot(step, 2 * tw);
        tower.push(
          axis === 'x'
            ? { p: [0, y - step / 2, s * tw], r: 0, s: [len, 0.05, 0.05], c: SS.brace, e: [0, 0, ang] }
            : { p: [s * tw, y - step / 2, 0], r: 0, s: [0.05, 0.05, len], c: SS.brace, e: [ang, 0, 0] },
        );
      }
    }
    // Star: two-tone fins (top navy, underneath silver) and the cables' anchor points
    const fins: BoxItem[] = [];
    for (let i = 0; i < n; i++) {
      const t = (i / n) * Math.PI * 2;
      const at = (x: number, y: number): [number, number, number] => [Math.cos(t) * x, y, -Math.sin(t) * x];
      fins.push({ p: at(Rs * 0.55, 0.12), r: 0, s: [0.9, 0.12, Rs * 1.15], c: SS.finTop, e: [0, t + Math.PI / 2, 0] });
      fins.push({ p: at(Rs * 0.55, -0.02), r: 0, s: [0.9, 0.12, Rs * 1.15], c: SS.finUnder, e: [0, t + Math.PI / 2, 0] });
    }
    const hanger: BoxItem[] = [
      { p: [0, -Lc / 2, -0.25], r: 0, s: [0.03, Lc, 0.03], c: SS.cable },
      { p: [0, -Lc / 2, 0.25], r: 0, s: [0.03, Lc, 0.03], c: SS.cable },
      { p: [0, -Lc, 0], r: 0, s: [0.45, 0.1, 0.65], c: SS.seat }, //   seat
      { p: [-0.2, -Lc + 0.3, 0], r: 0, s: [0.08, 0.55, 0.65], c: SS.seat }, // back
      { p: [0.15, -Lc + 0.15, -0.15], r: 0, s: [0.2, 0.35, 0.18], c: SS.rider },
      { p: [0.15, -Lc + 0.15, 0.15], r: 0, s: [0.2, 0.35, 0.18], c: SS.rider },
    ];
    return { tower, fins, hanger };
  }, [h, Rs, Lc, n]);

  return (
    <group>
      <mesh position={[0, 0.03, 0]}>
        <cylinderGeometry args={[5.7, 5.7, 0.06, 32]} />
        <meshLambertMaterial color={C.kerb} />
      </mesh>
      {/* Fixed: base, lattice tower, wire ball and crown */}
      <mesh position={[0, 0.4, 0]}>
        <cylinderGeometry args={[1.1, 1.2, 0.8, 12]} />
        <meshLambertMaterial color={SS.tower} flatShading />
      </mesh>
      <InstancedBoxes items={parts.tower} />
      {[0, Math.PI / 3, (2 * Math.PI) / 3].map((t) => (
        <mesh key={t} position={[0, h + 0.9, 0]} rotation={[0, t, 0]}>
          <torusGeometry args={[0.7, 0.04, 4, 20]} />
          <meshLambertMaterial color={SS.ball} />
        </mesh>
      ))}
      <mesh position={[0, h + 1.75, 0]}>
        <coneGeometry args={[0.25, 0.5, 6]} />
        <meshLambertMaterial color={SS.ball} flatShading />
      </mesh>

      {/* Moving: the star climbs the tower and turns; the seats swing out */}
      <group ref={carriage} position={[0, yLow, 0]}>
        <group ref={spin}>
          <mesh>
            <cylinderGeometry args={[0.9, 1.1, 0.6, 12]} />
            <meshLambertMaterial color={SS.hub} flatShading />
          </mesh>
          <InstancedBoxes items={parts.fins} shape="diamond" />
          {Array.from({ length: n }, (_, i) => (
            <group key={i} rotation={[0, (i / n) * Math.PI * 2, 0]}>
              <group
                ref={(g) => {
                  hangers.current[i] = g;
                }}
                position={[Rs, 0, 0]}
              >
                <InstancedBoxes items={parts.hanger} />
              </group>
            </group>
          ))}
        </group>
      </group>
    </group>
  );
}

/**
 * Top Spin Suspended: proportions read off the park's photo, as fractions of
 * `opts.h` (pivot height) and `opts.w` (tower spacing). Sized so the gondola
 * stays inside the footprint: the paving comes to 6 units from the ride's
 * centre.
 */
export const TOPSPIN = {
  pivot: 0.875, //     pivot height (× h)
  arm: 0.55, //        pivot to the gondola's axle (× h)
  counter: 0.5, //     pivot to the counterweight (× h)
  towers: 0.495, //    tower centres, each side (× w)
  gondola: 0.76, //    gondola length (× w)
  seats: 16,
  turns: 4, //         full turns of the arms per ride (assumed)
  flip: 0.5, //        how far the gondola turns with the arms at full speed (0 = always level; assumed)
  cycle: { load: 12, build: 6, run: 20, ease: 8 } as RideCycle, // seconds (assumed)
};

const TS = {
  tower: '#F28A1E',
  brace: '#FFC53D',
  arm: '#F28A1E',
  axle: '#F28A1E',
  counter: '#E9E27A',
  gondola: '#3FB6C8',
  gondolaEdge: '#2A56B8',
  seat: '#E5383B',
  rider: '#22252B',
  hub: '#F28A1E',
  hubFace: '#FFC53D',
};

/**
 * Top Spin Suspended (#18): two orange towers braced with yellow struts. A
 * pair of orange arms, joined by a cross axle, turns on the towers: at one
 * end of each arm a yellow counterweight disc, at the other the gondola, a
 * long teal box with a row of seats facing out, hung on its own axle between
 * the arm tips. It stops with the gondola down to load, then the arms turn
 * right round, faster and faster, while the gondola tips over.
 */
export function TopSpin({ a }: P) {
  const { w = 10, h = 8 } = a.opts;
  const P = TOPSPIN.pivot * h;
  const A = TOPSPIN.arm * h;
  const Cw = TOPSPIN.counter * h;
  const xt = TOPSPIN.towers * w; //       tower centres
  const G = TOPSPIN.gondola * w; //       gondola length
  const xa = G / 2 + 0.4; //              arm planes
  const arms = useRef<THREE.Group>(null);
  const gondola = useRef<THREE.Group>(null);
  const time = useRef(cycleOffset(a.position[0], a.position[2]));
  const per = TOPSPIN.cycle.build / 2 + TOPSPIN.cycle.run + TOPSPIN.cycle.ease / 2;
  useFrame((_, dt) => {
    if (!arms.current || !gondola.current) return;
    time.current += Math.min(dt, 0.1);
    const t = time.current;
    const th = ((Math.PI * 2 * TOPSPIN.turns) / per) * cycleTravel(t, TOPSPIN.cycle);
    arms.current.rotation.x = th;
    gondola.current.rotation.x = -th * (1 - TOPSPIN.flip * cycleIntensity(t, TOPSPIN.cycle));
  });

  const parts = useMemo(() => {
    const fixed: BoxItem[] = [];
    for (const s of [-1, 1]) {
      fixed.push({ p: [s * xt, P / 2 + 0.3, 0], r: 0, s: [0.9, P + 0.6, 1.2], c: TS.tower });
      for (const sz of [-1, 1]) {
        const top: [number, number] = [P * 0.62, sz * 0.5];
        const foot: [number, number] = [0, sz * 2.3];
        const len = Math.hypot(top[0] - foot[0], top[1] - foot[1]);
        const ang = Math.atan2(top[1] - foot[1], top[0] - foot[0]);
        fixed.push({ p: [s * xt, (top[0] + foot[0]) / 2, (top[1] + foot[1]) / 2], r: 0, s: [0.22, len, 0.22], c: TS.brace, e: [ang, 0, 0] });
      }
    }
    const armItems: BoxItem[] = [{ p: [0, 0, 0], r: 0, s: [2 * xa, 0.3, 0.3], c: TS.axle }];
    for (const s of [-1, 1]) {
      armItems.push({ p: [s * xa, (Cw - A) / 2, 0], r: 0, s: [0.4, A + Cw, 0.6], c: TS.arm });
    }
    const counters: BoxItem[] = [-1, 1].map((s) => ({ p: [s * xa, Cw, 0] as [number, number, number], r: 0, s: [1.7, 0.25, 1.7] as [number, number, number], c: TS.counter, e: [0, 0, Math.PI / 2] as [number, number, number] }));
    for (const s of [-1, 1]) counters.push({ p: [s * xa, -A, 0], r: 0, s: [0.9, 0.3, 0.9], c: TS.hub, e: [0, 0, Math.PI / 2] });
    for (const s of [-1, 1]) counters.push({ p: [s * (xa + 0.16), 0, 0], r: 0, s: [1.1, 0.25, 1.1], c: TS.hub, e: [0, 0, Math.PI / 2] });
    // Gondola, local to its axle: hung below it, riders facing out (+z)
    const gon: BoxItem[] = [
      { p: [0, -0.55, 0], r: 0, s: [G, 0.5, 1.2], c: TS.gondola },
      { p: [0, -0.82, 0], r: 0, s: [G, 0.06, 1.25], c: TS.gondolaEdge },
      { p: [0, 0, 0], r: 0, s: [G + 0.6, 0.16, 0.16], c: TS.gondolaEdge },
    ];
    const pitch = G / TOPSPIN.seats;
    for (let i = 0; i < TOPSPIN.seats; i++) {
      const x = -G / 2 + pitch * (i + 0.5);
      gon.push({ p: [x, -0.05, -0.3], r: 0, s: [pitch * 0.8, 0.5, 0.1], c: TS.seat });
      gon.push({ p: [x, -0.22, -0.05], r: 0, s: [pitch * 0.8, 0.08, 0.45], c: TS.seat });
      gon.push({ p: [x, 0.05, 0.0], r: 0, s: [pitch * 0.45, 0.3, 0.2], c: TS.rider });
    }
    return { fixed, armItems, counters, gon };
  }, [P, A, Cw, xt, G, xa]);

  return (
    <group>
      <mesh position={[0, 0.03, 0]}>
        <cylinderGeometry args={[5.7, 5.7, 0.06, 32]} />
        <meshLambertMaterial color={C.kerb} />
      </mesh>
      {/* Fixed: towers and braces, and the axle stubs into the towers */}
      <InstancedBoxes items={parts.fixed} />
      {/* Moving: arms with counterweights and the gondola's hubs; the gondola on its own axle */}
      <group position={[0, P, 0]}>
        <group ref={arms}>
          <InstancedBoxes items={parts.armItems} />
          <InstancedBoxes items={parts.counters} shape="disc" />
          <group position={[0, -A, 0]}>
            <group ref={gondola}>
              <InstancedBoxes items={parts.gon} />
            </group>
          </group>
        </group>
      </group>
    </group>
  );
}

function cycleTravel(t: number, c: RideCycle): number {
  const L = c.load + c.build + c.run + c.ease;
  const per = c.build / 2 + c.run + c.ease / 2;
  const n = Math.floor(t / L);
  let u = t - n * L;
  let d = 0;
  const ramp = (x: number) => x * x * x - (x * x * x * x) / 2; // ∫ smoothstep
  if (u > c.load) {
    u -= c.load;
    if (u < c.build) d = c.build * ramp(u / c.build);
    else {
      d = c.build / 2;
      u -= c.build;
      if (u < c.run) d += u;
      else {
        d += c.run;
        u -= c.run;
        const x = Math.min(1, u / c.ease);
        d += c.ease * (x - ramp(x));
      }
    }
  }
  return n * per + d;
}

/**
 * Space Trainer: proportions read off the park's photo, as fractions of
 * `opts.h`. Sized so the gondola, swung out low, stays inside the footprint:
 * the paving comes to 4.5 units from the ride's centre.
 */
export const TRAINER = {
  axle: 0.39, //      axle height
  arm: 0.26, //       axle down to the gondola
  span: 0.86, //      distance between the towers
  seats: 14,
  maxSwing: 120, //   degrees each way at full swing (assumed)
  period: 5, //       seconds per swing there and back (assumed)
  cycle: { load: 10, build: 15, run: 20, ease: 12 } as RideCycle, // seconds (assumed)
};

const ST = {
  tower: '#EEF1F4',
  rack: '#22252B',
  hub: '#D7262E',
  hubRing: '#F2C230',
  frame: '#EEF1F4',
  rail: '#D7262E',
  gondola: '#2A56B8',
  housing: '#E5383B',
  seat: '#3A3F4A',
};

/**
 * Space Trainer (#5): two white towers, each with a black rack up its side
 * and a red drive housing. A white axle beam spans between the housings and
 * a white frame with red rails hangs from it, carrying a long row of seats
 * facing out. The whole frame turns about the axle: it hangs straight down to
 * load, then swings higher and higher.
 */
export function SpaceTrainer({ a }: P) {
  const { h = 8 } = a.opts;
  const H = TRAINER.axle * h;
  const A = TRAINER.arm * h;
  const sx = (TRAINER.span * h) / 2; // tower centres at ±sx
  const len = 2 * sx - 0.9; //         gondola length
  const swing = useRef<THREE.Group>(null);
  const time = useRef(cycleOffset(a.position[0], a.position[2]));
  useFrame((_, dt) => {
    if (!swing.current) return;
    time.current += Math.min(dt, 0.1);
    const t = time.current;
    swing.current.rotation.x = rad(TRAINER.maxSwing) * cycleIntensity(t, TRAINER.cycle) * Math.sin((t / TRAINER.period) * Math.PI * 2);
  });

  const parts = useMemo(() => {
    const fixed: BoxItem[] = [];
    const tall = H / 0.59;
    for (const [s, top] of [
      [-1, tall],
      [1, tall * 0.85],
    ] as const) {
      fixed.push({ p: [s * sx, top / 2, 0], r: 0, s: [0.6, top, 0.6], c: ST.tower });
      fixed.push({ p: [s * sx - s * 0.33, top * 0.45, 0.2], r: 0, s: [0.1, top * 0.85, 0.16], c: ST.rack });
      fixed.push({ p: [s * (sx - 0.45), H, 0], r: 0, s: [0.4, 0.8, 0.8], c: ST.hub });
      fixed.push({ p: [s * sx, top + 0.15, 0], r: 0, s: [0.7, 0.3, 0.7], c: ST.hub });
    }
    const moving: BoxItem[] = [
      { p: [0, 0, 0], r: 0, s: [2 * sx - 1.3, 0.45, 0.45], c: ST.frame }, // axle beam
      { p: [0, 0.35, 0], r: 0, s: [0.5, 0.3, 0.5], c: ST.hub },
      { p: [0, -A + 0.05, 0], r: 0, s: [len, 0.18, 0.8], c: ST.gondola },
      { p: [0, -A + 0.22, 0.05], r: 0, s: [len, 0.18, 0.6], c: ST.housing },
      { p: [0, -A - 0.45, 0.55], r: 0, s: [len, 0.06, 0.18], c: ST.gondola }, // footrest
    ];
    for (const x of [-0.42, -0.14, 0.14, 0.42]) moving.push({ p: [x * len, -A / 2, -0.15], r: 0, s: [0.22, A, 0.22], c: ST.frame });
    for (const x of [-0.28, 0.28]) {
      moving.push({ p: [x * len, -A * 0.45, 0.12], r: 0, s: [len * 0.26, 0.06, 0.06], c: ST.rail });
      moving.push({ p: [x * len, -A * 0.7, 0.12], r: 0, s: [len * 0.26, 0.06, 0.06], c: ST.rail });
    }
    const pitch = len / TRAINER.seats;
    for (let i = 0; i < TRAINER.seats; i++) {
      const x = -len / 2 + pitch * (i + 0.5);
      moving.push({ p: [x, -A + 0.55, -0.12], r: 0, s: [pitch * 0.75, 0.55, 0.1], c: ST.seat });
      moving.push({ p: [x, -A + 0.6, 0.05], r: 0, s: [pitch * 0.4, 0.2, 0.16], c: ST.seat });
    }
    return { fixed, moving };
  }, [H, A, sx, len]);

  return (
    <group>
      <mesh position={[0, 0.03, 0]}>
        <cylinderGeometry args={[4.2, 4.2, 0.06, 28]} />
        <meshLambertMaterial color={C.kerb} />
      </mesh>
      {/* Fixed: towers with racks and drive housings */}
      <InstancedBoxes items={parts.fixed} />
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * (sx - 0.66), H, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.42, 0.42, 0.08, 14]} />
          <meshLambertMaterial color={ST.hubRing} flatShading />
        </mesh>
      ))}
      {/* Moving: axle, frame and gondola turn about the axle */}
      <group position={[0, H, 0]}>
        <group ref={swing}>
          <InstancedBoxes items={parts.moving} />
        </group>
      </group>
    </group>
  );
}

/**
 * Turbo Force: proportions read off the park's photo, as fractions of the
 * pivot height `opts.h`. The arm swings in a vertical plane: `rot` in the
 * park data aims that plane away from the paths.
 */
export const TURBO = {
  arm: 0.83, //        pivot to each gondola
  offset: 0.9, //      arm plane in front of the tower, world units
  turns: 5, //         full turns of the arm per ride (assumed)
  flip: 0.6, //        how far the gondolas turn with the arm at full speed (0 = always level; assumed)
  cycle: { load: 12, build: 6, run: 24, ease: 8 } as RideCycle, // seconds (assumed)
};

const TF = {
  tower: '#7A1F6A',
  collar: '#5A1550',
  base: '#9FB6C8',
  platform: '#8D939C',
  arm: '#F28A1E',
  rung: '#E5383B',
  hub: '#E5383B',
  hubCentre: '#2A56B8',
  wedge: '#FFC53D',
  gondola: '#FFC53D',
  hoop: '#F4F4F0',
  seat: '#3A3F4A',
};

/**
 * Turbo Force (#2): a tall purple tower with a red hub at the top carrying a
 * long orange lattice arm. A gondola of four seats inside a white hoop hangs
 * at each end. The arm stops upright to load the lower gondola from the
 * platform at the tower's foot, then turns right round, faster and faster,
 * while the gondolas tip over; it always stops upright again.
 */
export function TurboForce({ a }: P) {
  const { h = 13 } = a.opts;
  const A = TURBO.arm * h;
  const zA = TURBO.offset;
  const arm = useRef<THREE.Group>(null);
  const pods = useRef<(THREE.Group | null)[]>([]);
  const time = useRef(cycleOffset(a.position[0], a.position[2]));
  const per = TURBO.cycle.build / 2 + TURBO.cycle.run + TURBO.cycle.ease / 2;
  useFrame((_, dt) => {
    if (!arm.current) return;
    time.current += Math.min(dt, 0.1);
    const t = time.current;
    const th = ((Math.PI * 2 * TURBO.turns) / per) * cycleTravel(t, TURBO.cycle);
    const k = cycleIntensity(t, TURBO.cycle);
    arm.current.rotation.z = th;
    for (const p of pods.current) p?.rotation.set(0, 0, -th * (1 - TURBO.flip * k));
  });

  const parts = useMemo(() => {
    const armItems: BoxItem[] = [];
    for (const s of [-1, 1]) armItems.push({ p: [0, 0, s * 0.22], r: 0, s: [0.12, 2 * A, 0.12], c: TF.arm });
    const n = Math.round((2 * A) / 0.7);
    for (let j = 0; j <= n; j++) armItems.push({ p: [0, -A + (2 * A * j) / n, 0], r: 0, s: [0.08, 0.06, 0.44], c: TF.rung });
    armItems.push({ p: [0, 0.9, 0], r: 0, s: [0.5, 1.2, 0.3], c: TF.wedge });
    armItems.push({ p: [0, -0.9, 0], r: 0, s: [0.5, 1.2, 0.3], c: TF.wedge });
    const pod: BoxItem[] = [
      { p: [0, 0, 0.6], r: 0, s: [0.25, 0.25, 1.2], c: TF.gondola }, // axle out to the gondola
      { p: [0, -0.5, 1.2], r: 0, s: [0.9, 0.12, 1.5], c: TF.gondola },
    ];
    for (let i = 0; i < 4; i++) {
      const z = 0.65 + i * 0.37;
      pod.push({ p: [-0.15, -0.15, z], r: 0, s: [0.12, 0.6, 0.3], c: TF.seat });
      pod.push({ p: [0.02, -0.05, z], r: 0, s: [0.18, 0.2, 0.18], c: TF.seat });
    }
    const hoops: BoxItem[] = [
      { p: [0, -0.15, 0.62], r: 0, s: [1.4, 1.4, 1.4], c: TF.hoop, e: [0, 0, 0] },
      { p: [0, -0.15, 1.8], r: 0, s: [1.4, 1.4, 1.4], c: TF.hoop, e: [0, 0, 0] },
    ];
    return { armItems, pod, hoops };
  }, [A]);

  const deckY = h - A - 1.1; // loading platform top: a step below the lower gondola, clear of it as it swings past
  return (
    <group>
      {/* Fixed: base station, loading platform, tower, pivot platform */}
      <Box size={[1.8, 1.4, 1.4]} position={[0, 0.7, -0.4]} color={TF.base} />
      <Box size={[2.6, deckY, 2.0]} position={[0, deckY / 2, zA + 1.3]} color={TF.platform} />
      <Box size={[0.9, deckY * 0.6, 1.0]} position={[1.75, deckY * 0.3, zA + 1.3]} color={TF.platform} />
      <mesh position={[0, h * 0.35, 0]}>
        <cylinderGeometry args={[0.42, 0.5, h * 0.7, 10]} />
        <meshLambertMaterial color={TF.tower} flatShading />
      </mesh>
      <mesh position={[0, h * 0.85, 0]}>
        <cylinderGeometry args={[0.32, 0.4, h * 0.3, 10]} />
        <meshLambertMaterial color={TF.tower} flatShading />
      </mesh>
      <mesh position={[0, h * 0.7, 0]}>
        <cylinderGeometry args={[0.5, 0.5, 0.3, 10]} />
        <meshLambertMaterial color={TF.collar} />
      </mesh>
      <Box size={[1.1, 0.12, 1.1]} position={[0, h - 0.6, 0]} color={TF.platform} />
      <mesh position={[0, h, zA / 2]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.2, 0.2, zA, 8]} />
        <meshLambertMaterial color={C.steel} />
      </mesh>

      {/* Moving: the arm, and a gondola at each end */}
      <group position={[0, h, zA]}>
        <group ref={arm}>
          <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.15]}>
            <cylinderGeometry args={[0.65, 0.65, 0.2, 16]} />
            <meshLambertMaterial color={TF.hub} flatShading />
          </mesh>
          <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.28]}>
            <cylinderGeometry args={[0.25, 0.25, 0.1, 12]} />
            <meshLambertMaterial color={TF.hubCentre} />
          </mesh>
          <InstancedBoxes items={parts.armItems} />
          {[-1, 1].map((s, i) => (
            <group
              key={s}
              ref={(g) => {
                pods.current[i] = g;
              }}
              position={[0, s * A, 0]}
            >
              <InstancedBoxes items={parts.pod} />
              <InstancedBoxes items={parts.hoops} shape="ring" />
            </group>
          ))}
        </group>
      </group>
    </group>
  );
}

/** Space Trainer and Turbo Force have their own models; Flipping Arm uses the original. */
export function Arm({ a }: P) {
  if (a.opts.variant === 'gyro') return <SpaceTrainer a={a} />;
  if (a.opts.variant === 'turbo') return <TurboForce a={a} />;
  return <ArmBase a={a} />;
}


/** The original arm: a long arm turning on a pylon, cabins at the ends. Used by Flipping Arm. */
function ArmBase({ a }: P) {
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

/**
 * Galleon: proportions read off the park's photo, as fractions of the pivot
 * height `opts.h`. The ship hangs over its pool; the paving comes to about
 * 6.3 units from the ride's centre.
 */
export const GALLEON = {
  hull: 0.86, //      ship length
  beam: 1.8, //       ship width, world units
  spread: 0.7, //     A-frame feet, each side of the pivot
  keel: 0.4, //       keel height above the water while loading
  mast: 0.42, //      mast height above the deck
  maxSwing: 75, //    degrees each way at full swing (assumed; photo shows the ship at rest)
  period: 6.2, //     seconds per swing there and back (assumed, from the pendulum length)
  cycle: { load: 10, build: 20, run: 20, ease: 15 } as RideCycle, // seconds (assumed)
};

const GL = {
  frame: '#D7262E',
  lattice: '#F4F4F0',
  hull: '#3A2E26',
  stripe: '#E3B23C',
  panel: '#C8362D',
  shield: '#E3B23C',
  castle: '#E3B23C',
  bench: '#B5302A',
  mast: '#8A5A33',
  sign: '#D7262E',
  signEdge: '#F4F4F0',
};

/** The ship's side profile (x along the ship, y up), extruded across its width. */
function hullGeometry(L: number, W: number): THREE.BufferGeometry {
  const hl = L / 2;
  const s = new THREE.Shape();
  s.moveTo(-hl - 0.35, 1.75);
  s.lineTo(-hl + 0.9, 1.7);
  s.lineTo(-hl + 1.0, 1.0);
  s.lineTo(hl - 1.0, 1.0);
  s.lineTo(hl - 0.9, 1.6);
  s.lineTo(hl + 0.15, 1.65);
  s.lineTo(hl, 1.0);
  s.bezierCurveTo(hl - 0.3, 0.0, hl * 0.5, -0.25, 0, -0.25);
  s.bezierCurveTo(-hl * 0.5, -0.25, -hl + 0.2, 0.0, -hl - 0.35, 1.75);
  const g = new THREE.ExtrudeGeometry(s, { depth: W, bevelEnabled: false, curveSegments: 10 });
  g.translate(0, 0, -W / 2);
  return g;
}

/**
 * Galleon (#28): a pirate ship hung from two red A-frames by V-shaped arms,
 * with the GALLEON sign above the pivot. The ship has a dark hull with a gold
 * stripe, a red band of round gold shields along each side, raised castles at
 * bow and stern, rows of benches and a mast with a crow's nest. It hangs still
 * to load, then swings higher and higher like a pendulum and winds down.
 */
export function Ship({ a }: P) {
  const { h = 8 } = a.opts;
  const L = GALLEON.hull * h;
  const W = GALLEON.beam;
  const S = GALLEON.spread * h;
  const Rs = h - GALLEON.keel - 0.25; // pivot down to the hull's origin
  const swing = useRef<THREE.Group>(null);
  const time = useRef(cycleOffset(a.position[0], a.position[2]));
  useFrame((_, dt) => {
    if (!swing.current) return;
    time.current += Math.min(dt, 0.1);
    const t = time.current;
    swing.current.rotation.z = rad(GALLEON.maxSwing) * cycleIntensity(t, GALLEON.cycle) * Math.sin((t / GALLEON.period) * Math.PI * 2);
  });

  const hull = useMemo(() => hullGeometry(L, W), [L, W]);
  const parts = useMemo(() => {
    const boxes: BoxItem[] = [];
    const discs: BoxItem[] = [];
    const zs = W / 2 + 0.012;
    for (const sz of [-1, 1]) {
      boxes.push({ p: [0, 0.35, sz * zs], r: 0, s: [L * 0.85, 0.08, 0.02], c: GL.stripe });
      boxes.push({ p: [0, 0.68, sz * zs], r: 0, s: [L * 0.72, 0.42, 0.02], c: GL.panel });
      for (let j = 0; j < 10; j++) {
        const x = -L * 0.33 + (L * 0.66 * j) / 9;
        discs.push({ p: [x, 0.68, sz * (zs + 0.012)], r: 0, s: [0.3, 0.02, 0.3], c: GL.shield, e: [Math.PI / 2, 0, 0] });
      }
    }
    // Castles at bow and stern, benches across the deck
    boxes.push({ p: [-L / 2 + 0.45, 1.85, 0], r: 0, s: [0.9, 0.3, W * 0.9], c: GL.castle });
    boxes.push({ p: [L / 2 - 0.4, 1.8, 0], r: 0, s: [0.85, 0.3, W * 0.9], c: GL.panel });
    for (let j = 0; j < 8; j++) {
      const x = -L * 0.34 + (L * 0.68 * j) / 7;
      boxes.push({ p: [x, 1.15, 0], r: 0, s: [0.32, 0.3, W * 0.85], c: GL.bench });
    }
    // Mast, crow's nest, yard and flag
    const mh = GALLEON.mast * h;
    boxes.push({ p: [0.2, 1.0 + mh * 0.68, 0], r: 0, s: [0.08, 0.08, W * 0.7], c: GL.mast });
    boxes.push({ p: [0.45, 1.0 + mh + 0.15, 0], r: 0, s: [0.45, 0.28, 0.02], c: GL.panel });
    discs.push({ p: [0.2, 1.0 + mh / 2, 0], r: 0, s: [0.12, mh, 0.12], c: GL.mast });
    discs.push({ p: [0.2, 1.0 + mh * 0.8, 0], r: 0, s: [0.4, 0.22, 0.4], c: GL.castle });
    return { boxes, discs, mh };
  }, [L, W, h]);

  const letters = useMemo(() => {
    const items: BoxItem[] = [];
    const n = 7;
    for (let j = 0; j < n; j++) {
      const t = rad(145 - (110 * j) / (n - 1));
      const p: [number, number, number] = [Math.cos(t) * 1.9, h - 0.75 + Math.sin(t) * 1.9, 0];
      items.push({ p: [p[0], p[1], p[2] - 0.03], r: 0, s: [0.58, 0.68, 0.06], c: GL.signEdge, e: [0, 0, t - Math.PI / 2] });
      items.push({ p, r: 0, s: [0.48, 0.58, 0.1], c: GL.sign, e: [0, 0, t - Math.PI / 2] });
    }
    return items;
  }, [h]);

  const zf = W / 2 + 0.75; // A-frames stand this far out each side of the ship
  return (
    <group>
      {/* Fixed: two red A-frames, the axle, and the GALLEON sign */}
      {[-1, 1].map((sz) => (
        <group key={sz}>
          <Strut from={[-S, 0, sz * (zf + 0.4)]} to={[0, h, sz * zf]} thickness={0.32} color={GL.frame} />
          <Strut from={[S, 0, sz * (zf + 0.4)]} to={[0, h, sz * zf]} thickness={0.32} color={GL.frame} />
          <Strut from={[-S * 0.9, 0.2, sz * (zf + 0.36)]} to={[-0.15, h - 0.3, sz * zf]} thickness={0.06} color={GL.lattice} />
          <Strut from={[S * 0.9, 0.2, sz * (zf + 0.36)]} to={[0.15, h - 0.3, sz * zf]} thickness={0.06} color={GL.lattice} />
        </group>
      ))}
      <mesh position={[0, h, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.18, 0.18, 2 * zf + 0.3, 10]} />
        <meshLambertMaterial color={C.steel} />
      </mesh>
      <InstancedBoxes items={letters} />

      {/* Moving: the ship and its arms swing about the axle */}
      <group position={[0, h, 0]}>
        <group ref={swing}>
          {[-1, 1].map((sz) => (
            <group key={sz}>
              <Strut from={[0, 0, sz * (W / 2 + 0.06)]} to={[-L * 0.32, -Rs + 1.0, sz * (W / 2 + 0.06)]} thickness={0.16} color={GL.frame} />
              <Strut from={[0, 0, sz * (W / 2 + 0.06)]} to={[L * 0.32, -Rs + 1.0, sz * (W / 2 + 0.06)]} thickness={0.16} color={GL.lattice} />
            </group>
          ))}
          <group position={[0, -Rs, 0]}>
            <mesh geometry={hull}>
              <meshLambertMaterial color={GL.hull} flatShading />
            </mesh>
            <InstancedBoxes items={parts.boxes} />
            <InstancedBoxes items={parts.discs} shape="disc" />
            <Strut from={[0.2, 1.0 + parts.mh, 0]} to={[-L / 2 - 0.3, 1.75, 0]} thickness={0.025} color={GL.lattice} />
            <Strut from={[0.2, 1.0 + parts.mh, 0]} to={[L / 2 + 0.1, 1.65, 0]} thickness={0.025} color={GL.lattice} />
          </group>
        </group>
      </group>
    </group>
  );
}

export const CARNIVAL = {
  platform: 0.86, //  platform radius
  roof: 0.95, //      roof radius (above head height)
  rows: [0.73, 0.53], // radii of the two rings of horses
  horses: [16, 12],
  canopy: 0.58, //    height of the underside of the roof
  bob: 0.3, //        horses rise and fall this much, world units
  bobTime: 2.4, //    seconds per rise and fall (assumed)
  turn: 14, //        seconds per turn at full speed (assumed)
  cycle: { load: 12, build: 5, run: 45, ease: 6 } as RideCycle, // seconds (assumed)
};

const CC = {
  canvas: ['#C9CED6', '#E9ECF0'],
  finial: '#E3B23C',
  gold: '#E3B23C',
  scene: '#7FAFD6',
  mirror: '#F4F4F0',
  red: '#D7262E',
  ceiling: '#3A2E26',
  pole: '#E3B23C',
  column: ['#D7262E', '#E3B23C'],
  horse: '#F4F1EA',
  saddles: ['#2FB5A8', '#E5383B', '#2A56B8', '#E3B23C', '#7B4FC8'],
  fence: '#D7262E',
};

/** Builds one geometry from boxes (sizes, centres, optional z tilt), so each horse is a single instance. */
function boxesGeometry(parts: { s: [number, number, number]; p: [number, number, number]; rz?: number }[]): THREE.BufferGeometry {
  const pos: number[] = [];
  const nor: number[] = [];
  const m = new THREE.Matrix4();
  for (const b of parts) {
    const g = new THREE.BoxGeometry(...b.s).toNonIndexed();
    m.makeRotationZ(b.rz ?? 0).setPosition(...b.p);
    g.applyMatrix4(m);
    pos.push(...(g.getAttribute('position').array as Float32Array));
    nor.push(...(g.getAttribute('normal').array as Float32Array));
    g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  return out;
}

/** A carousel horse facing +x, standing on its pole at the origin: body (white) and tack (coloured). */
const HORSE_BODY = boxesGeometry([
  { s: [0.9, 0.36, 0.3], p: [0, 0, 0] },
  { s: [0.22, 0.42, 0.18], p: [0.45, 0.25, 0], rz: -0.5 },
  { s: [0.34, 0.16, 0.16], p: [0.62, 0.42, 0], rz: -0.3 },
  { s: [0.08, 0.42, 0.08], p: [0.34, -0.28, 0.08], rz: 0.6 },
  { s: [0.08, 0.42, 0.08], p: [0.3, -0.28, -0.08], rz: 0.4 },
  { s: [0.08, 0.42, 0.08], p: [-0.34, -0.28, 0.08], rz: -0.6 },
  { s: [0.08, 0.42, 0.08], p: [-0.3, -0.28, -0.08], rz: -0.4 },
]);
const HORSE_TACK = boxesGeometry([
  { s: [0.34, 0.08, 0.34], p: [-0.05, 0.21, 0] },
  { s: [0.06, 0.4, 0.2], p: [0.4, 0.3, 0], rz: -0.5 },
  { s: [0.3, 0.06, 0.06], p: [-0.5, 0.0, 0], rz: 0.8 },
]);

/**
 * Carnival Carousel (#29): a classic carousel. A grey and white canvas roof
 * with a gold crown sits over a ring of painted scenic panels and round gold
 * framed mirrors with a red scalloped edge. Under it, white horses with
 * coloured tack ride brass poles on a red platform round a red and gold
 * centre drum, inside a red fence. The whole carousel turns and the horses
 * rise and fall, neighbours out of step.
 */
export function CarnivalCarousel({ a }: P) {
  const { r = 6 } = a.opts;
  const Rp = CARNIVAL.platform * r;
  const Rr = CARNIVAL.roof * r;
  const Hc = CARNIVAL.canopy * r;
  const deck = 0.45;
  const total = CARNIVAL.horses[0] + CARNIVAL.horses[1];
  const spin = useRef<THREE.Group>(null);
  const bodies = useRef<THREE.InstancedMesh>(null);
  const tack = useRef<THREE.InstancedMesh>(null);
  const time = useRef(cycleOffset(a.position[0], a.position[2]));

  const horses = useMemo(() => {
    const list: { x: number; z: number; yaw: number; phase: number }[] = [];
    CARNIVAL.rows.forEach((rf, row) => {
      const n = CARNIVAL.horses[row];
      for (let i = 0; i < n; i++) {
        const t = (i / n) * Math.PI * 2 + row * 0.13;
        list.push({ x: Math.cos(t) * rf * r, z: -Math.sin(t) * rf * r, yaw: t + Math.PI / 2, phase: (i % 2) * Math.PI + row * 1.3 });
      }
    });
    return list;
  }, [r]);
  const o = useMemo(() => new THREE.Object3D(), []);

  useLayoutEffect(() => {
    const c = new THREE.Color();
    horses.forEach((hs, i) => {
      o.position.set(hs.x, deck + 1.05, hs.z);
      o.rotation.set(0, hs.yaw, 0);
      o.updateMatrix();
      bodies.current?.setMatrixAt(i, o.matrix);
      tack.current?.setMatrixAt(i, o.matrix);
      tack.current?.setColorAt(i, c.set(CC.saddles[i % CC.saddles.length]));
    });
    if (bodies.current) bodies.current.instanceMatrix.needsUpdate = true;
    if (tack.current) tack.current.instanceMatrix.needsUpdate = true;
    if (tack.current?.instanceColor) tack.current.instanceColor.needsUpdate = true;
  }, [horses, o]);

  useFrame((_, dt) => {
    if (!spin.current || !bodies.current || !tack.current) return;
    const step = Math.min(dt, 0.1);
    time.current += step;
    const t = time.current;
    const k = cycleIntensity(t, CARNIVAL.cycle);
    spin.current.rotation.y += step * k * ((Math.PI * 2) / CARNIVAL.turn);
    horses.forEach((hs, i) => {
      o.position.set(hs.x, deck + 1.05 + k * CARNIVAL.bob * Math.sin((t / CARNIVAL.bobTime) * Math.PI * 2 + hs.phase), hs.z);
      o.rotation.set(0, hs.yaw, 0);
      o.updateMatrix();
      bodies.current!.setMatrixAt(i, o.matrix);
      tack.current!.setMatrixAt(i, o.matrix);
    });
    bodies.current.instanceMatrix.needsUpdate = true;
    tack.current.instanceMatrix.needsUpdate = true;
  });

  const parts = useMemo(() => {
    const poles: BoxItem[] = horses.map((hs) => ({ p: [hs.x, (deck + Hc) / 2, hs.z], r: 0, s: [0.07, Hc - deck, 0.07], c: CC.pole }));
    const boxes: BoxItem[] = [];
    const discs: BoxItem[] = [];
    const np = 16;
    for (let j = 0; j < np; j++) {
      const t = ((j + 0.5) / np) * Math.PI * 2;
      const e: [number, number, number] = [0, t + Math.PI / 2, 0];
      const at = (rr: number, y: number): [number, number, number] => [Math.cos(t) * rr, y, -Math.sin(t) * rr];
      const w = 2 * Rr * Math.sin(Math.PI / np) + 0.05;
      const scenic = j % 2 === 0;
      boxes.push({ p: at(Rr, Hc + 0.55), r: 0, s: [w, 0.9, 0.06], c: CC.gold, e });
      boxes.push({ p: at(Rr + 0.03, Hc + 0.58), r: 0, s: [w * (scenic ? 0.8 : 0.5), 0.55, 0.04], c: scenic ? CC.scene : CC.red, e });
      boxes.push({ p: at(Rr + 0.02, Hc + 0.08), r: 0, s: [w, 0.16, 0.05], c: CC.red, e });
      if (!scenic) discs.push({ p: at(Rr + 0.07, Hc + 0.58), r: 0, s: [0.36, 0.03, 0.36], c: CC.mirror, e: [0, t, Math.PI / 2] });
    }
    // Centre drum panels
    for (let j = 0; j < 12; j++) {
      const t = (j / 12) * Math.PI * 2;
      boxes.push({ p: [Math.cos(t) * 1.02, (deck + Hc) / 2, -Math.sin(t) * 1.02], r: 0, s: [0.5, Hc - deck - 0.2, 0.05], c: CC.column[j % 2], e: [0, t + Math.PI / 2, 0] });
    }
    return { poles, boxes, discs };
  }, [horses, Rr, Hc]);

  const fence = useMemo<BoxItem[]>(() => {
    const items: BoxItem[] = [];
    const Rf = Rp + 0.5;
    for (let j = 0; j < 48; j++) {
      const t = (j / 48) * Math.PI * 2;
      items.push({ p: [Math.cos(t) * Rf, 0.4, Math.sin(t) * Rf], r: 0, s: [0.05, 0.8, 0.05], c: CC.fence });
    }
    return items;
  }, [Rp]);

  return (
    <group>
      {/* Fixed: red fence */}
      <InstancedBoxes items={fence} />
      <mesh position={[0, 0.8, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[Rp + 0.5, 0.03, 4, 48]} />
        <meshLambertMaterial color={CC.fence} />
      </mesh>

      {/* Turning: platform, centre drum, poles, horses, canopy and roof */}
      <group ref={spin}>
        <mesh position={[0, deck / 2, 0]}>
          <cylinderGeometry args={[Rp, Rp, deck, 32]} />
          <meshLambertMaterial color={CC.red} />
        </mesh>
        <mesh position={[0, (deck + Hc) / 2, 0]}>
          <cylinderGeometry args={[1.0, 1.0, Hc - deck, 12]} />
          <meshLambertMaterial color={CC.red} flatShading />
        </mesh>
        <InstancedBoxes items={parts.poles} shape="disc" />
        <instancedMesh ref={bodies} args={[HORSE_BODY, undefined, total]} frustumCulled={false}>
          <meshLambertMaterial color={CC.horse} />
        </instancedMesh>
        <instancedMesh ref={tack} args={[HORSE_TACK, undefined, total]} frustumCulled={false}>
          <meshLambertMaterial />
        </instancedMesh>
        <mesh position={[0, Hc, 0]}>
          <cylinderGeometry args={[Rr, Rr, 0.12, 32]} />
          <meshLambertMaterial color={CC.ceiling} />
        </mesh>
        <InstancedBoxes items={parts.boxes} />
        <InstancedBoxes items={parts.discs} shape="disc" />
        <StripedCone r={Rr - 0.1} h={0.45 * r} colors={CC.canvas} position={[0, Hc + 1.0 + 0.225 * r, 0]} segments={16} />
        <mesh position={[0, Hc + 1.0 + 0.45 * r + 0.15, 0]}>
          <coneGeometry args={[0.25, 0.5, 6]} />
          <meshLambertMaterial color={CC.finial} flatShading />
        </mesh>
      </group>
    </group>
  );
}

/** Carnival Carousel has its own model; the Flying Carousel uses the original one. */
export function Carousel({ a }: P) {
  if (a.opts.variant === 'tent') return <CarnivalCarousel a={a} />;
  return <CarouselBase a={a} />;
}

/** Carnival Carousel (striped tent) and Flying Carousel (rainbow umbrella with hanging seats). */
function CarouselBase({ a }: P) {
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

/**
 * Crazy Surf: proportions read off the park's photo of the ride, as fractions
 * of the panel height P. The whole ride is sized from `opts.w` so that
 * everything moving below head height stays inside its 4-unit footprint: the
 * paving runs right up to that circle on every side.
 */
export const SURF = {
  panel: 0.4, //          panel height P as a fraction of opts.w
  width: 1.3, //          panel width / P (the panel is wider than it is tall)
  offset: 0.17, //        panel centre sits this far (× panel width) right of the arm pivots
  pivot: 0.6, //          pivot height up the panel
  gap: 0.38, //           distance between the two pivots (× panel width)
  arm: 0.37, //           pivot to bench
  counter: 0.32, //       pivot to the yellow surfboard counterweight
  plate: 0.34, //         length of each surfboard
  bench: 1.2, //          bench length (× panel width)
  seats: 12, //           riders in the row (photo shows about 12)
  maxSwing: 140, //       degrees from hanging straight down (photo shows ~140)
  period: 5, //           seconds for one full swing there and back (assumed)
  cycle: { load: 10, build: 15, run: 20, ease: 12 } as RideCycle, // seconds (assumed)
};

const CS = {
  panel: '#2F6FD6',
  trim: '#2BA3C9',
  cloud: '#D6EAFB',
  lights: '#FFFFFF',
  plate: '#F6D21E',
  bolt: '#2F8FE0',
  axle: '#4FA83A',
  arm: '#6CC04A',
  beam: '#9B4FC4',
  seat: '#E8572A',
  back: '#F07A2E',
  deck: '#9AA6B4',
  slab: '#B7BDC8',
  fence: '#B07CC6',
  pink: '#E65AA0',
  door: '#1F3A6E',
};

/**
 * Crazy Surf (#11): a wide blue panel with two parallel green arms. Each arm
 * turns on an axle part way up the panel: its long end carries the row of
 * seats, its short end a yellow surfboard counterweight. Because the arms are
 * parallel the seat row stays level as it swings (a parallelogram linkage).
 * Riders face out, away from the panel. The seat row hangs at the bottom over
 * the deck to load, then swings higher and higher from side to side. Only the
 * arms (with their surfboards) and the seat row move.
 */
export function HalfPipe({ a }: P) {
  const { w = 8 } = a.opts;
  const Pn = SURF.panel * w; //    panel height
  const W = SURF.width * Pn; //    panel width
  const base = 0.2; //             the panel stands on a low steel frame
  const Hh = base + SURF.pivot * Pn; // pivot height above the ground
  const L = SURF.arm * Pn;
  const Cw = SURF.counter * Pn;
  const gap = (SURF.gap * W) / 2;
  const B = SURF.bench * W;
  const px = SURF.offset * W; //   panel centre, relative to the pivots
  const zPanel = -1; //   centre of the panel's thickness
  const zArm = -0.45; //  plane the arms turn in
  const zPlate = -0.3; // surfboards just in front of the arms
  const zBench = 0.05; // the seat row rides in front of everything
  const panel = a.opts.color ?? CS.panel;
  const plate = a.opts.accent ?? CS.plate;

  const armL = useRef<THREE.Group>(null);
  const armR = useRef<THREE.Group>(null);
  const bench = useRef<THREE.Group>(null);
  const time = useRef(cycleOffset(a.position[0], a.position[2]));
  useFrame((_, dt) => {
    if (!armL.current || !armR.current || !bench.current) return;
    time.current += Math.min(dt, 0.1); // a hidden tab shouldn't jump the ride on return
    const t = time.current;
    const k = cycleIntensity(t, SURF.cycle);
    const th = rad(SURF.maxSwing) * k * Math.sin((t / SURF.period) * Math.PI * 2);
    armL.current.rotation.z = th;
    armR.current.rotation.z = th;
    // Parallel arms: the seat row is carried round without tilting.
    bench.current.position.set(L * Math.sin(th), Hh - L * Math.cos(th), zBench);
  });

  // Fence: a rectangle inside the footprint, low enough for the seat row's ends to pass over.
  const fx = 3.1;
  const fz0 = -1.95;
  const fz1 = 1.6;
  const fence = useMemo<BoxItem[]>(() => {
    const items: BoxItem[] = [];
    const post = (x: number, z: number) => items.push({ p: [x, 0.3, z], r: 0, s: [0.06, 0.6, 0.06], c: CS.fence });
    for (let i = 0; i <= 10; i++) {
      const x = -fx + (2 * fx * i) / 10;
      post(x, fz0);
      post(x, fz1);
    }
    for (let i = 1; i < 6; i++) {
      const z = fz0 + ((fz1 - fz0) * i) / 6;
      post(-fx, z);
      post(fx, z);
    }
    return items;
  }, []);

  // Lights along the panel's right edge and top, as on the real ride.
  const lights = useMemo<BoxItem[]>(() => {
    const items: BoxItem[] = [];
    const zf = zPanel + 0.23;
    for (let i = 0; i <= 12; i++) items.push({ p: [px + W / 2 - 0.08, base + (Pn * i) / 12, zf], r: 0, s: [0.08, 0.08, 0.04], c: CS.lights });
    for (let i = 0; i <= 16; i++) items.push({ p: [px - W / 2 + (W * i) / 16, base + Pn - 0.06, zf], r: 0, s: [0.08, 0.08, 0.04], c: CS.lights });
    return items;
  }, [W, Pn, px]);

  const seats = useMemo<BoxItem[]>(() => {
    const items: BoxItem[] = [];
    const pitch = B / SURF.seats;
    for (let i = 0; i < SURF.seats; i++) {
      const x = -B / 2 + pitch * (i + 0.5);
      items.push({ p: [x, 0.42, -0.12], r: 0, s: [pitch * 0.8, 0.42, 0.08], c: i % 2 ? CS.back : CS.seat });
    }
    return items;
  }, [B]);

  return (
    <group>
      {/* Fixed: paved enclosure, the deck the seat row loads over, and the fence */}
      <Box size={[2 * fx, 0.04, fz1 - fz0]} position={[0, 0.02, (fz0 + fz1) / 2]} color={CS.slab} />
      <Box size={[B + 0.5, 0.2, 2.1]} position={[0, 0.1, 0.25]} color={CS.deck} />
      <Box size={[B + 0.5, 0.06, 0.06]} position={[0, 0.2, 1.3]} color={CS.trim} />
      <InstancedBoxes items={fence} />
      {[fz0, fz1].map((z) => (
        <Box key={z} size={[2 * fx, 0.05, 0.05]} position={[0, 0.6, z]} color={CS.fence} />
      ))}
      {[-fx, fx].map((x) => (
        <Box key={x} size={[0.05, 0.05, fz1 - fz0]} position={[x, 0.6, (fz0 + fz1) / 2]} color={CS.fence} />
      ))}

      {/* Fixed: the panel on its frame, with lights, clouds, the surf sail graphic and two hatches */}
      <Box size={[W + 0.2, base, 0.7]} position={[px, base / 2, zPanel]} color={CS.trim} />
      <Box size={[W, Pn, 0.4]} position={[px, base + Pn / 2, zPanel]} color={panel} />
      <InstancedBoxes items={lights} />
      {[
        [0.22, 0.62, 0.17],
        [0.3, 0.3, 0.14],
        [-0.38, 0.85, 0.1],
        [0.05, 0.12, 0.12],
      ].map(([fxp, fyp, r]) => (
        <group key={`${fxp}-${fyp}`} position={[px + fxp * W, base + fyp * Pn, zPanel + 0.21]} scale={[1.6, 1, 1]}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[r * W, r * W, 0.02, 14]} />
            <meshLambertMaterial color={CS.cloud} />
          </mesh>
        </group>
      ))}
      <mesh position={[px - 0.1 * W, base + 0.62 * Pn, zPanel + 0.22]} rotation={[Math.PI / 2, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.16 * Pn, 0.16 * Pn, 0.02, 3]} />
        <meshLambertMaterial color={plate} />
      </mesh>
      <mesh position={[px - 0.32 * W, base + 0.66 * Pn, zPanel + 0.22]} rotation={[Math.PI / 2, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.11 * Pn, 0.11 * Pn, 0.02, 3]} />
        <meshLambertMaterial color={CS.pink} />
      </mesh>
      {[-0.27, 0.12].map((f) => (
        <Box key={f} size={[0.18, 0.14, 0.02]} position={[px + f * W, base + 0.4 * Pn, zPanel + 0.21]} color={CS.door} />
      ))}
      {[-1, 1].map((s) => (
        <Strut key={s} from={[px + s * W * 0.35, base + Pn * 0.75, zPanel - 0.2]} to={[px + s * W * 0.35, 0, -1.85]} thickness={0.16} color={C.steel} />
      ))}

      {/* Fixed: the two green axles the arms turn on */}
      {[-gap, gap].map((x) => (
        <mesh key={x} position={[x, Hh, (zPanel + 0.2 + zArm) / 2]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.16, 0.16, zArm - zPanel - 0.2, 12]} />
          <meshLambertMaterial color={CS.axle} flatShading />
        </mesh>
      ))}

      {/* Moving: the two parallel arms, each with its surfboard counterweight */}
      {[-gap, gap].map((x, i) => (
        <group key={x} ref={i === 0 ? armL : armR} position={[x, Hh, zArm]}>
          <Box size={[0.24, L + Cw, 0.16]} position={[0, (Cw - L) / 2, 0]} color={CS.arm} />
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.19, 0.19, 0.2, 12]} />
            <meshLambertMaterial color={CS.arm} flatShading />
          </mesh>
          <group position={[0, Cw, zPlate - zArm]} scale={[1, (SURF.plate * Pn) / 0.5, 1]}>
            <mesh rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.25, 0.25, 0.08, 16]} />
              <meshLambertMaterial color={plate} flatShading />
            </mesh>
          </group>
          <Box size={[0.1, SURF.plate * Pn * 0.75, 0.02]} position={[0, Cw, zPlate - zArm + 0.05]} rotation={[0, 0, 0.25]} color={CS.bolt} />
        </group>
      ))}

      {/* Moving: the seat row, kept level. Its origin is the midpoint between the two arm tips. */}
      <group ref={bench} position={[0, Hh - L, zBench]}>
        {[-gap, gap].map((x) => (
          <mesh key={x} position={[x, 0, (zArm - zBench) / 2]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.07, 0.07, zBench - zArm, 8]} />
            <meshLambertMaterial color={C.steel} />
          </mesh>
        ))}
        <Box size={[B, 0.14, 0.5]} position={[0, 0, 0.05]} color={CS.beam} />
        <Box size={[B, 0.22, 0.42]} position={[0, 0.18, 0.05]} color={CS.seat} />
        <InstancedBoxes items={seats} />
        {/* Footrest the riders' legs hang over */}
        <Box size={[B, 0.06, 0.14]} position={[0, -0.3, 0.32]} color={CS.beam} />
        {[-1, 1].map((s) => (
          <Box key={s} size={[0.06, 0.3, 0.06]} position={[s * (B / 2 - 0.1), -0.15, 0.3]} color={CS.beam} />
        ))}
      </group>
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