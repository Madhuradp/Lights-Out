# Lights Out: F1 Fan Experience (prototype)

Feel a 2026-style Grand Prix from three seats: the **cockpit**, the **pit wall** and the **grandstand**.
All teams, drivers and circuits are original (no official F1 branding), so it can be shared freely.

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

| | Keyboard | Gamepad | Touch |
| --- | --- | --- | --- |
| Throttle / brake | ↑ W / ↓ S | RT / LT | Right pedals |
| Steer | ← → / A D | Left stick | Left pad |
| Boost (hold) | Space or Shift | A + throttle | BOOST |
| Overtake Mode | O | X | OT |
| Recharge mode | R | Back | RECHG |
| Box this lap | P | B | BOX |
| Camera | C | Y | CAM |
| Racing line | L | | LINE |
| Pause | Esc | Start | II |
| Manual gears | Q / E | LB / RB | |

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
  track.js        circuit model: spline sampling, racing line, speed profile, zones, corners, pit lane
  scenery.js      3D circuit: road, kerbs, walls, pits, stands, gantry, terrain, trees, sky
  cars.js         car models and the safety car
  particles.js    spray, smoke, sparks, debris
  audio.js        synthesised sound + haptics
  input.js        keyboard, gamepad and touch
  data.js         teams, drivers, circuits, tyre compounds
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
