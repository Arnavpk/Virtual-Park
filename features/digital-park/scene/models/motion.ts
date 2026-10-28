/**
 * Ride cycles. A real ride doesn't run flat out forever: it stands still while
 * riders board, builds up, runs, winds down and stops. `cycleIntensity` turns
 * a ride's own running time into how hard it is working (0 to 1), so a model
 * can scale its motion by it. Pure functions: call them inside `useFrame`,
 * never from React state.
 */

/** Phase lengths in seconds, in order: loading, building up, running, winding down. */
export interface RideCycle {
    load: number;
    build: number;
    run: number;
    ease: number;
}

export const cycleLength = (c: RideCycle) => c.load + c.build + c.run + c.ease;

/** Smooth 0 → 1 with no jolt at either end. */
const smooth = (u: number) => u * u * (3 - 2 * u);

/** 0 while loading, rises smoothly to 1, holds, falls smoothly back to 0, then repeats. */
export function cycleIntensity(t: number, c: RideCycle): number {
    const L = cycleLength(c);
    let u = ((t % L) + L) % L;
    if (u < c.load) return 0;
    u -= c.load;
    if (u < c.build) return smooth(u / c.build);
    u -= c.build;
    if (u < c.run) return 1;
    u -= c.run;
    return 1 - smooth(Math.min(1, u / c.ease));
}

/**
 * A start offset in seconds, fixed for a ride (worked out from its position),
 * so rides of the same kind don't all load and launch at the same moment.
 */
export function cycleOffset(x: number, z: number, span = 60): number {
    const f = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453;
    return (f - Math.floor(f)) * span;
}
