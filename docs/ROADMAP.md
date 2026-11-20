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
5. **More circuits** (night race under lights, a high-speed oval-ish track) and a track editor.
6. **AR table race** on phones.
7. **Better car models and sound samples**; replays and photo mode.

## Platform path
- Keep the web build for fast testing and sharing.
- When the feel is proven, port the core to Unity (or keep web + wrap it with Capacitor for app stores and Tauri/Electron for Steam).
- Licensing: stay original-brand until there is traction; then approach circuits, teams or F1's licensing team.
