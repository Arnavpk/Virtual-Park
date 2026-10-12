import { useLayoutEffect, useRef } from 'react';
import * as THREE from 'three';
import { TREES } from '../data/park.generated';
import { C } from './palette';

/** Every tree in the park in two draw calls. Positions follow the tree cover in the aerial image. */
export function Trees() {
  const trunks = useRef<THREE.InstancedMesh>(null);
  const crowns = useRef<THREE.InstancedMesh>(null);

  useLayoutEffect(() => {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const color = new THREE.Color();
    TREES.forEach(([x, z, s], i) => {
      m.compose(new THREE.Vector3(x, 0.9 * s, z), q.identity(), new THREE.Vector3(s, s, s));
      trunks.current!.setMatrixAt(i, m);
      q.setFromEuler(new THREE.Euler(0, i * 1.7, 0));
      m.compose(new THREE.Vector3(x, 3 * s, z), q, new THREE.Vector3(s, s * 1.1, s));
      crowns.current!.setMatrixAt(i, m);
      crowns.current!.setColorAt(i, color.set(i % 3 === 0 ? C.leafB : C.leafA));
    });
    trunks.current!.instanceMatrix.needsUpdate = true;
    crowns.current!.instanceMatrix.needsUpdate = true;
    if (crowns.current!.instanceColor) crowns.current!.instanceColor.needsUpdate = true;
  }, []);

  return (
    <group>
      <instancedMesh ref={trunks} args={[undefined, undefined, TREES.length]} frustumCulled={false}>
        <cylinderGeometry args={[0.2, 0.3, 1.8, 5]} />
        <meshLambertMaterial color={C.trunk} flatShading />
      </instancedMesh>
      <instancedMesh ref={crowns} args={[undefined, undefined, TREES.length]} frustumCulled={false}>
        <icosahedronGeometry args={[1.6, 0]} />
        <meshLambertMaterial flatShading />
      </instancedMesh>
    </group>
  );
}
