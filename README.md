# Lights Out: F1 Fan Experience (prototype)

Feel a 2026-style Grand Prix from three seats: the **cockpit**, the **pit wall** and the **grandstand**.
All teams, drivers and circuit names are original (no official F1 branding), so it can be shared freely.
The seven circuits use real track outlines (open data, MIT licence) with real lengths, elevation and corner names;
see docs/CIRCUITS.md.

It runs in any modern browser on PC and mobile. No install needed.

## Play it

- **Offline / quickest:** open `dist/lights-out.html` (double-click). Everything is inside that one file.
- **Share with friends' phones:** upload the `dist/web/` folder to a free host (for example drag it onto
  https://app.netlify.com/drop). That version is installable: on a phone use "Add to Home screen",
  on PC use the install icon in the address bar. It also works offline after the first visit.

## What's in it

| Area | Features |
| --- | --- |
| Cockpit (Quick race) | Helmet cam, T-cam and chase cam; one-lap qualifying or chosen grid slot; five red lights with jump-start penalties; 2026 rules: active aero (Straight/Corner mode), Overtake Mode, Boost and Recharge; tyre wear, warm-up and the late-life cliff; rain with spray and visor drops; safety car and VSC; blue flags; track limits; rear-view mirror on PC |
| Pit stops | Pick compounds, autopilot through the pit lane, pit crew timing mini-game, pit crews at the box, wing-damage repairs |
| Pit wall (Strategy) | Engineer an AI driver: push level, energy mode, box calls, weather radar, team radio, TV/onboard/heli cameras, 1x/2x/4x speed |
| Grandstand | Pick a seat (main straight or corner stands), drag to look around, zoom like binoculars, auto-follow the cars, a live big screen, live commentary, race predictions scored for XP |
| Hot lap | Time trial with ghost car, live delta, purple/green/yellow sectors |
| Career | Championship seasons (3 or 6 rounds, points 25-18-15-12-10-8-6-4-2-1, standings, titles); 8 "Take the Wheel" scenarios with gold/silver/bronze medals |
| Driver | XP and levels, helmet designer (designs unlock by level), career stats, personal bests, race history |
| Feel | Synthesised V6 hybrid engine with MGU-K whine, turbo, tyre squeal, wind, kerbs, crowd, Doppler on passing cars, tunnel reverb; phone vibration (Android) and gamepad rumble; spoken team radio |
| AI | Racing line, braking points, overtaking and defending, slipstream, mistakes (lock-ups, running wide), tyre strategy, rain calls, safety-car opportunism, late-race pushes, letting leaders through |

## Controls

Keyboard keys can be remapped in **How to play** (menu tab) or from the pause screen. Press **H** in a race for the controls card.

| | Keyboard (default) | Gamepad | Touch |
| --- | --- | --- | --- |
| Throttle / brake | ↑ W / ↓ S | RT / LT | Pedals (right, or left in left-handed layout) |
| Steer | ← → / A D | Left stick | Drag pad, tilt the phone, or ◀ ▶ buttons |
| Boost (hold) | Space or Shift | A (hold) | BOOST |
| Overtake mode | O / F | X | OT |
| Recharge mode | R | View / Back | RECHG |
| Box this lap | P / B | B | BOX |
| Wheel display page | Tab | D-pad → | Tap the wheel screen |
| Camera | C / V | Y | CAM |
| Racing line | L | D-pad ↓ | LINE |
| Controls card | H | D-pad ↑ | ? |
| Pause | Esc | Menu / Start | II |
| Manual gears | Q / E | LB / RB | ▲ ▼ |

Touch settings: steering mode, sensitivity, left-handed pedals, button size, auto-throttle.
The **coach** explains each tool the first time it matters in a race (on by default; you can reset it to show the tips again).

### What the cockpit shows (modelled on real 2026 cars)
- Two wing mirrors on their stalks, rendered in place (real size or enlarged)
- A halo centre pillar faded "as drivers see it" (each eye sees around it), or solid or hidden
- Steering wheel: shift lights; FIA marshalling lights (yellow, blue, green, SC flashing, chequered); battery bar and tyre squares;
  mode lamps (Straight, Overtake, Boost, Recharge, Pit); and three screen pages: RACE, ENERGY and TYRES

## Develop

```
npm install
npm run dev     # http://localhost:8080, rebuilds when you save
npm run build   # minified dist/lights-out.html and dist/web/
```

## Project structure

```
src/
  main.js         boot + test hook (window.__lo.sim)
  ctx.js          settings (cfg), shared state (S), sound/input singletons, track cache
  game.js         renderer, game loop, cars on screen, cameras, effects, mirror, pit crews
  hud.js          broadcast HUD: timing tower, wheel display, minimap, pit wall panel
  menu.js         Play / Career / Driver menus
  screens.js      pause and results screens, team radio voice
  session.js      sessions: qualifying -> race, championship, scenario launch, XP awards
  pitstop.js      pit menu and pit crew mini-game
  grandstand.js   spectator seats, look-around camera, big screen, predictions
  scenarios.js    "Take the Wheel" scenario library
  profile.js      XP, levels, stats, medals, helmet designer
  race.js         race rules: timing, gaps, strategy, weather, safety car, penalties, results, commentary
  ai.js           AI drivers (track coordinates), pit lane controller
  physics.js      player car physics: downforce, drag, ERS, friction circle, active aero, tyres
  circuits.js     the 7 circuits: elevation, corner names, theme, weather odds
  geo.js          generated real track outlines (tools/circuitgen.py)
  track.js        circuit model: spline sampling, min-curvature racing line, gradients, bridges, speed profile, zones, corners, pit lane
  scenery.js      3D circuit: road, walls, pits, stands, gantry, terrain, venue themes (forest, airfield, bowl, city at night), landmarks, sky
  trackside.js    kerbs, skid marks, run-off, barriers, marshal posts, sponsor gantries, verges
  cars.js         car models and the safety car
  particles.js    spray, smoke, sparks, debris
  audio.js        synthesised sound + haptics
  input.js        keyboard (remappable), gamepad and touch (drag, tilt, buttons)
  controls.js     key bindings, device labels, How to play guide
  coach.js        in-race tips shown the first time each situation comes up
  data.js         teams, drivers, tyre compounds
assets/           app icons, web manifest, service worker
tools/            automated browser tests (Python + Playwright)
docs/             design notes and roadmap
```

## Tests

The `tools/` scripts drive the game in headless Chrome using the `window.__lo.sim()` hook
(a bot with braking and steering assists). Examples:

```
python3 tools/simtest.py race parco '{}' 200   # race telemetry
python3 tools/scen.py lastlap,holdon           # scenarios to completion
python3 tools/flows2.py quali                  # qualifying -> race -> results
```

They expect Chrome at /usr/bin/google-chrome and `pip install playwright`.

### Graphics quality
Low = no shadows/post FX (phones). Medium = shadows + bloom. High = sharper shadows, speed blur, lens flare.
