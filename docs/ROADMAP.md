# Roadmap

## Done (prototype v0.2)
- Cockpit racing, pit wall strategy, grandstand spectating, hot laps
- Qualifying, championship seasons, 8 scenarios with medals
- Profile, XP, levels, helmet designer
- AI racecraft: mistakes, blue flags, defending, late pushes
- Rain spray, smoke, sparks, wing damage, pit crews, rear-view mirror
- Installable web app (PWA) for phones and PCs

## Next: test with friends
1. Host `dist/web/` and send the link to 5-10 F1 fans.
2. Ask after each session: did driving feel fast and fun? What was confusing? What would make you come back?
3. Watch someone play on a phone: touch controls are the biggest risk.

## Next features (in rough priority order)
1. **Race-weekend sync**: scenarios generated from real Grand Prix results (needs a licensed data feed; OpenF1 for prototyping).
2. **Co-op pit wall**: a second device as the engineer (needs a small realtime server, e.g. WebSocket).
3. **Online ghosts and leagues**: upload hot-lap ghosts, friend leaderboards, private championships.
4. **Driver school**: corner-by-corner lessons with braking targets.
5. **More circuits**: Madring with banking, Las Vegas/Baku, a desert night race; circuit variants; a track editor. (See docs/CIRCUITS.md.)
6. **AR table race** on phones.
7. **Better car models and sound samples**; replays and photo mode.

## Platform path
- Keep the web build for fast testing and sharing.
- When the feel is proven, port the core to Unity (or keep web + wrap it with Capacitor for app stores and Tauri/Electron for Steam).
- Licensing: stay original-brand until there is traction; then approach circuits, teams or F1's licensing team.

## Visual pass (Nov 2026) — done
- New lofted car model with two-tone liveries, race numbers, halo, clear-coat paint, contact shadows
- Post-processing: bloom, speed blur + vignette (high), lens flare, neutral tone mapping, sky reflections
- Trackside: raised kerbs, skid marks, painted run-off, tecpro blocks, catch fences, marshal posts, sponsor gantries, mowed verges
- Procedural moving clouds (thicker in rain)

## Circuits pass (Nov 2026) — done
- 7 circuits on real outlines at official lengths: Monza, Monaco, Suzuka (now a true figure-eight with a bridge), plus new Spa, Silverstone, Interlagos and a Marina Bay night race
- Real corner names, elevation (Spa ~100 m), gradient and compression in the physics
- Minimum-curvature racing line (AI and the LINE overlay); ideal laps close to real pole times
- Venue themes: forest, airfield, bowl with city, night city with floodlights; ferris wheels
- Season calendar uses all seven, with each venue's real rain odds

## Driver's view and controls pass (Nov 2026) — done
- Research: 2026 steering wheel (Boost, Overtake, Recharge, Straight mode), FIA cockpit marshalling lights, halo visibility, mirrors, lift and coast and super clipping
- Two real wing mirrors, see-through halo option, flag lights and three display pages on the wheel
- Remappable keys, gamepad D-pad extras, touch steering modes (drag, tilt, buttons), sensitivity, left-handed layout, button size, touch gear buttons
- How to play tab, controls card (H or ?), in-race coach with device-aware key names
- Next: brake balance and differential settings on the wheel, look-left and look-right for wheel-to-wheel battles, force feedback for wheels
