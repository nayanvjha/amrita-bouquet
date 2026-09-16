# For Amrita Ma’am

An interactive 3D flower bouquet — a digital apology. The bouquet grows and
blooms in response to your hands (MediaPipe hand tracking), and only once it is
full does the message appear:

> AMRITA MA’AM
> I’m sorry, Ma’am.
> *I wanted to say it properly, so I made you these.*

Built with Three.js + TypeScript + Vite. No backend, no accounts. MediaPipe’s
WASM and the hand model are self-hosted in `public/`, so nothing loads from a
third-party CDN except the Google Fonts.

## Run it

```bash
npm install
npm run dev
```

Open the printed `http://localhost:5173` URL. The camera needs `localhost` or
`https`. `npm run build` writes a static site to `dist/` (relative asset paths,
so it can be dropped on any static host — Vercel, Netlify, GitHub Pages).

## How it’s given

1. **Intro** — “Something I wanted to give you. Reach out.” Choose *Enable
   camera* or *Continue without camera*. The camera is never forced.
2. **Grow** — hold your **left hand** up, palm to the camera, about an arm's length
   away, and slowly spread your thumb and index finger apart. An animated guide at the
   bottom of the screen shows the motion for the first while (press `?` to see it again). Stems rise
   out of the paper, leaves unfold, buds lift. Centre flowers first, edges last.
3. **Bloom** — open your **right hand**. The flowers open in a wave, outer petals
   first; roses unfurl from the outside in, tulips stay as soft goblets, daisies
   fold flat around their discs.
4. **The message** — when the bouquet is grown and open, the camera drifts
   closer, the motes lift for a moment, a few petals let go, and the three lines
   appear one after another.

The pinch is measured relative to the hand’s own size, so distance from the
camera doesn’t matter. Values hold when a hand leaves the frame. If only one
hand is ever shown, that hand does both: half open = fully grown, fully open =
fully bloomed.

### Without a camera

| Input | Grow | Bloom |
|---|---|---|
| Mouse (desktop) | move the pointer **up** | move it **right** |
| Touch (phone) | **press and hold** anywhere | keeps going after growth completes |
| Keyboard | hold **G** | hold **B** |

Drag to orbit, scroll / pinch to zoom. The camera relaxes back on its own.

### Keys

| Key | |
|---|---|
| `G` / `B` | grow / bloom (hold) |
| `Space` | automatic presentation (grows, then blooms, on a cinematic clock) |
| `Enter` | reveal the message now |
| `R` | reset (animated: flowers close, stems sink, back to the intro) |
| `H` | hide the small UI (camera window, hints) |
| `S` | swap which hand does what |
| `?` | show the gesture guide again |
| `D` | developer panel: auto grow / bloom, reset, camera & tracking toggles, hand landmarks, FPS, draw calls, live values |

## Structure

```
src/
  main.ts                    wires everything around the state machine
  config/constants.ts        every tunable (palette, camera poses, timing, post)
  state/ExperienceState.ts   INTRO → GROWING → BLOOMING → FULL_BOUQUET → MESSAGE_REVEAL → FINAL
  scene/                     renderer, camera rig (drift + orbit + presentation move),
                             lighting, gradient backdrop, post (bloom + vignette + grain)
  flowers/
    Petal.ts                 procedural petal blade: width profile, cup, curl, ripple, twist
    FlowerTypes.ts           rose / tulip / daisy — whorls with bud & open poses and bloom windows
    Flower.ts                stem + head; petals are one InstancedMesh per whorl
    Filler.ts                baby’s breath clusters
    Stem.ts                  tapered tube revealed tip-ward; the head rides its tip
    Wrapper.ts               ivory paper (procedural texture), gold ribbon, foliage
    Bouquet.ts               the hand-authored arrangement
  interaction/               MediaPipe hand tracking, gesture mapping, mouse/touch/keyboard fallbacks
  animation/                 easing, scrubbable timeline/tween, auto presentation
  particles/                 pollen motes (shader Points), one-time petal fall
  ui/                        intro card, hints, message reveal, debug panel
```

Petal geometry is rebuilt on the CPU only when a flower’s bloom value actually
changes; everything else is transforms. The whole bouquet is ~60 draw calls and
holds 60 fps on a laptop; phones get fewer particles, a half-resolution bloom
pass and a capped pixel ratio.

## Tuning

Almost everything lives in `src/config/constants.ts` (camera poses, timings,
palette, bloom strength). The arrangement — which flower goes where, in what
colour, and in what order it rises and opens — is the `ARRANGEMENT` table in
`src/flowers/Bouquet.ts`. Petal shapes and bloom choreography per flower type
are in `src/flowers/FlowerTypes.ts`.

The words are in `index.html`.
