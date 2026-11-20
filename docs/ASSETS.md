# Free and open-source assets

What's in the game now, what's worth adding next, and the licence rules to follow.

## Used in the game

| Asset | Source | Licence | Where |
|---|---|---|---|
| Real track outlines (7 circuits) | github.com/bacinger/f1-circuits | MIT (notice ships in the build) | `tools/geo/` → `src/geo.js` |
| Sky HDRIs: park, venice, sunrise, forest | Poly Haven, via github.com/pmndrs/assets (resized) | CC0 | `tools/env/` → `src/envmaps.js` (reflections and ambient light) |
| Tyre skid and impact sounds | Kenney Starter Kit Racing (skid by Landeplage) | CC0 (kit code is MIT) | `tools/sfx/` → `src/samples.js` |
| 3D engine | three.js | MIT (notice ships in the build) | npm |
| Everything else (cars, scenery, textures, engine sound) | Made in code for this project | Ours | `src/` |

Rebuild the generated files with `python3 -I tools/envgen.py` and `python3 -I tools/circuitgen.py`.
The samples module is a one-off conversion (MP3, mono, 56 kbps) of the files in `tools/sfx/`.

## Researched, worth adding later
- **Poly Haven** (polyhaven.com): CC0 HDRIs, 8K PBR textures (asphalt, grass, gravel, concrete) and
  photoscanned models. Next step: real asphalt and kerb textures, resized to 512 px, with normal and
  roughness maps. Not downloadable from this workspace, but anyone can download them.
- **ambientCG** (ambientcg.com): CC0 PBR materials, e.g. asphalt, tarmac and gravel sets.
- **Kenney** (kenney.nl): CC0 Racing Kit with 70+ low-poly track pieces (pit stop, flags, billboards,
  fences, tents), Car Kit and UI packs. Stylised: good for UI icons and props, less so for the F1 car.
- **Quaternius** (quaternius.com): CC0 nature packs (Ultimate Nature, Stylized Nature MegaKit,
  Textured LowPoly Trees) in glTF. These would replace the cone and ball trees for a big visual jump,
  with instancing to keep phones fast.
- **OpenGameArt / Freesound**: some CC0 engine loops and real race recordings (check each file: many
  are CC-BY and need credit, and some are non-commercial). A CC0 F1 or V6 hybrid onboard loop would
  be the single biggest sound upgrade.

## Rules
- Prefer **CC0** (no credit required, but we credit anyway). **CC-BY** is fine with credit in the game.
  Avoid **NC** (non-commercial) and **ND** (no derivatives), and don't use anything without a stated licence.
- Don't use real F1 team liveries, logos, driver likenesses or circuit trademarks, even when a model is
  "free": the model's licence doesn't cover the brands in it.
- Keep the single-file build small: resize textures to 256–512 px, keep models low-poly, and convert
  audio to MP3 mono.
