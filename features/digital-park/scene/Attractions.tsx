import type { ThreeEvent } from '@react-three/fiber';
import { ATTRACTIONS, LANDMARKS } from '../data/park';
import type { Attraction, Landmark } from '../data/types';
import { Garden, Gate, Hall, Kiosk, Parasols, Plaza, RoundPool, ShipCafe, Windmill } from './models/buildings';
import { rad } from './models/parts';
import {
  Arm, Bumper, Carousel, Disco, Ferris, Fountain, Frisbee, HalfPipe, Maze, Playground, Ship, Spinner, Splash,
  Surf, TopSpin, Tower, Track,
} from './models/rides';

/** Picks the simplified model for an attraction from its `model` field in data/park.ts. */
function Model({ a }: { a: Attraction }) {
  switch (a.model) {
    case 'spinner': return <Spinner a={a} />;
    case 'ferris': return <Ferris a={a} />;
    case 'tower': return <Tower a={a} />;
    case 'frisbee': return <Frisbee a={a} />;
    case 'topspin': return <TopSpin a={a} />;
    case 'arm': return <Arm a={a} />;
    case 'disco': return <Disco a={a} />;
    case 'splash': return <Splash a={a} />;
    case 'ship': return <Ship a={a} />;
    case 'carousel': return <Carousel a={a} />;
    case 'bumper': return <Bumper a={a} />;
    case 'track': return <Track a={a} />;
    case 'surf': return <Surf a={a} />;
    case 'halfpipe': return <HalfPipe a={a} />;
    case 'fountain': return <Fountain a={a} />;
    case 'playground': return <Playground a={a} />;
    case 'maze': return <Maze a={a} />;
    case 'windmill': return <Windmill o={a.opts} />;
    case 'shipcafe': return <ShipCafe o={a.opts} />;
    case 'garden': return <Garden o={a.opts} />;
    case 'kiosk': return <Kiosk o={a.opts} />;
    default: return <Hall o={a.opts} />;
  }
}

function LandmarkModel({ l }: { l: Landmark }) {
  switch (l.kind) {
    case 'gate': return <Gate o={l.opts} />;
    case 'plaza': return <Plaza o={l.opts} />;
    case 'parasols': return <Parasols o={l.opts} />;
    case 'pool': return <RoundPool o={l.opts} />;
    default: return <Hall o={l.opts} />;
  }
}

/** Every numbered and lettered place on the map, plus the unnumbered landmarks. */
export function Attractions({ onSelect }: { onSelect: (id: string) => void }) {
  return (
    <>
      {ATTRACTIONS.map((a) => (
        <group
          key={a.id}
          position={[a.position[0], a.position[1], a.position[2]]}
          rotation={[0, rad(a.opts.rot), 0]}
          onClick={(e: ThreeEvent<MouseEvent>) => {
            e.stopPropagation();
            // A drag that happens to end on a model was an orbit, not a tap.
            if (e.delta > 6) return;
            onSelect(a.id);
          }}
        >
          <Model a={a} />
        </group>
      ))}
      {LANDMARKS.map((l) => (
        <group key={l.id} position={[l.position[0], l.position[1], l.position[2]]} rotation={[0, rad(l.opts.rot), 0]}>
          <LandmarkModel l={l} />
        </group>
      ))}
    </>
  );
}
