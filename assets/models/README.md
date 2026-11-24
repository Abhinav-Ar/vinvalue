# AutoIQ hero car

The interactive hero loads `public/models/concept.glb`, adapted from [Car Concept](https://github.com/KhronosGroup/glTF-Sample-Assets/tree/7d4ba189827916452eeadc82d4b712dbc6280a6f/Models/CarConcept). Eric Chadwick created the model and textures for Darmstadt Graphics Group GmbH using Unity Fan’s public-domain concept. The [source credits](https://github.com/KhronosGroup/glTF-Sample-Assets/tree/7d4ba189827916452eeadc82d4b712dbc6280a6f/Models/CarConcept#legal) release the model and textures under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). The footer credits the adaptation.

The GLB omits the steering emblem, licence plate, shared logo atlas and embossed tyre lettering. Geometry is batched by material within each moving assembly. The authored door pivots, wheel centres, cabin, engine, axles, brake discs and calipers are retained. glTF Transform packs the geometry with meshopt and converts the retained textures to WebP at up to 1024 pixels. The shipped file contains 213,195 triangles in 14 assemblies and weighs 3,038,772 bytes.

`views/components/car3d/model.ts` assigns finishes, feature lines and assembly motions. The canvas loads on demand over the SVG drawing, renders with an orthographic camera and projects the scroll callouts onto the moving assemblies. Reduced motion uses the SVG stills.

Run the dev server with `DATABASE_URL=pglite:./.data/pglite npm run dev`, then run `npx tsx scripts/qa-car3d.ts` to exercise the controls and capture the desktop and mobile views.
