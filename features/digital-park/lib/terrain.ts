/**
 * Ground height at a point. The park is modelled as flat, so this is always 0;
 * it stays as a single hook in case slopes or raised decks are added later.
 */
export function heightAt(_x: number, _z: number): number {
  return 0;
}
