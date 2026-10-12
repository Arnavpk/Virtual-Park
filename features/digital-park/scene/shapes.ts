import * as THREE from 'three';
import type { Outline } from '../data/types';

/**
 * Turns a ground outline ([x, z] points, with holes) into flat geometry lying
 * on the ground. Shapes are drawn in 2D as (x, -z) and then tipped over, so
 * the outline ends up exactly where the data says.
 */
export function groundGeometry(outline: Outline, thickness = 0): THREE.BufferGeometry {
  const ring = (pts: [number, number][]) => pts.map(([x, z]) => new THREE.Vector2(x, -z));
  const shape = new THREE.Shape(ring(outline.outer));
  for (const hole of outline.holes) shape.holes.push(new THREE.Path(ring(hole)));
  const geometry =
    thickness > 0
      ? new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false })
      : new THREE.ShapeGeometry(shape);
  geometry.rotateX(-Math.PI / 2);
  return geometry;
}
