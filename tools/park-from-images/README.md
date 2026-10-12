# Rebuilding the park data from the reference images

`gen.py` is the script that produced `features/digital-park/data/park.ts` and
`park.generated.ts`. You only need it if the reference images change. Day to
day, edit `park.ts` by hand.

What it does:

1. Lines the marked map up with the clean aerial render and finds the yellow
   marker discs, so each number and letter gets a position.
2. Undoes the camera perspective, so distances on the ground are consistent.
3. Picks out the grey paving, the water and the tree cover by colour.
4. Writes the paving and water as outlines, the paving as a walk grid, the
   trees as a list, and the attraction table with positions filled in.

To run it (Python 3 with `opencv-python` and `numpy`):

```
cd tools/park-from-images
# put the two images here as clean.jpg (aerial render) and marked.jpg (numbered map)
python3 gen.py ../../features/digital-park/data
npm run verify
```

Running it overwrites `park.ts`, including any hand edits. Names, models,
colours and sizes live in the table near the middle of `gen.py`; a handful of
positions are corrected by hand in `OVERRIDE` just above it.
