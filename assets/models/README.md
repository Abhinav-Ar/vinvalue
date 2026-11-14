# 3D car: AIQ-01

The landing page car is an original AutoIQ design built in code. It is not a downloaded asset,
so there is no GLB, no license to track and no build step.

- Geometry: `src/components/car3d/model.ts`. The side outline is the same `gt` drawing used by
  `CarDrawing`, lofted into 3D with a plan-view width curve and a superellipse cross section.
  The wheel centers match the drawing exactly (SVG x 233 and 743, radius 69), so the SVG callouts
  and dimension lines line up over the canvas in the resting view.
- Selectable parts (`src/components/car3d/parts.ts`, no three.js import): body, glass, front and
  rear wheels, engine, drivetrain, interior, fuel and exhaust, VIN plate. Each has a note on what
  it changes in the value.
- Detail: wheel arches cut into the body with trim lips, inner fenders and well walls; headlight
  blades, nose intake and grille slot, side intakes, a full-width taillight bar, door handles,
  mirrors, panel seams, rear diffuser and exhaust tips; tires with tread grooves, twin-spoke rims,
  lug nuts, brake discs and calipers.
- Size: about 69k triangles, no textures. Units: 1 = 100 SVG units (about 20 in); y up, nose at -x.
- Two looks share the meshes (each object keeps both materials in `userData.mat`):
  - X-ray (default): fresnel shells and feature lines in the theme tokens `--ink` and `--blue`, with
    the internals visible.
  - Solid: clear-coated paint in the theme accent (cobalt in light, yellow in dark), dark glass,
    rubber, machined rims, lit by three's built-in `RoomEnvironment` (no image files). Internals hide.
- Rendering: `src/components/car3d/CarCanvas.tsx`, loaded with `next/dynamic` (`ssr: false`), so
  three.js stays out of the landing page's first load.
- Behavior (`src/components/landing/HeroCar.tsx`): the hero pins while the page scrolls and the
  car comes apart in three steps (VIN decode, local listings, mileage/title/history). Drag or arrow
  keys turn it; click a part to select it; "Reset view" returns to the resting view; the X-ray /
  Solid switch picks the look (remembered per browser).
- Fallbacks: no WebGL means the line drawing does the same explode. Reduced motion means no pin,
  the drawing stays assembled, and "How we get to the number" shows three stills instead.

To check it with motion on (`scripts/qa.ts` forces reduced motion, so it only sees the SVG):

    npx tsx scripts/qa-car3d.ts
