# Circuits

Seven circuits, each modelled on a real Formula 1 venue, under original names. The layouts are the
real track outlines (open data, see "Where the shapes come from"), scaled to the official lap length.
Elevation, corner names and the look of each venue are added in `src/circuits.js`.

| Game circuit | Inspired by | Lap | Turns | Elevation | Signature | Time | Ideal lap* |
|---|---|---|---|---|---|---|---|
| Parco Veloce | Monza (Italy) | 5.793 km | 11 | ~10 m | Flat out ~80% of the lap, three chicanes, Parabolica | Afternoon | 81 s |
| Riviera Harbour | Monaco | 3.337 km | 19 | ~42 m | Climb to Casino, 48 km/h hairpin, tunnel, pool chicanes | Midday | 70 s |
| Sakura Hills | Suzuka (Japan) | 5.807 km | 18 | ~24 m | Figure-eight with a real bridge, S-curves, Spoon, 130R, ferris wheel | Golden hour | 92 s |
| Ardennes Forest | Spa-Francorchamps (Belgium) | 7.004 km | 19 | ~100 m | Eau Rouge/Raidillon (22% grade), Kemmel, Pouhon, Blanchimont | Afternoon, 55% rain | 105 s |
| Wolds Airfield | Silverstone (GB) | 5.891 km | 18 | ~10 m | Copse, Maggotts-Becketts-Chapel, hangars and runways | Afternoon, 45% rain | 92 s |
| Serra Verde | Interlagos (Brazil) | 4.309 km | 15 | ~40 m | Anticlockwise bowl, Senna S, uphill run to the line | Golden hour, 50% rain | 73 s |
| Neon Bay | Marina Bay (Singapore) | 4.927 km | 19 | ~3 m | Night race: floodlights, lit skyline, observation wheel, bay | Night | 91 s |

*Ideal lap = the speed profile on the racing line at reference grip (`node tools/trackstats.mjs`).
AI and human laps are slower; race estimates use about 1.16x this figure.

## Why these seven
- Fan surveys by F1 and Motorsport Network (167,000 fans, 187 countries) keep naming Monza, Spa,
  Silverstone and Monaco as the favourite circuits. Japan and Brazil follow.
- Fans' favourite landmarks in a Sky Sports survey were the COTA observation tower and Suzuka's ferris
  wheel. That's why Sakura Hills and Neon Bay have a big wheel.
- Each one adds a different kind of challenge: top speed (Monza), walls and precision (Monaco), rhythm
  and a crossover (Suzuka), elevation and changeable weather (Spa), high-speed flow (Silverstone),
  anticlockwise and a bowl (Interlagos), and a night street race (Singapore).
- 2026 calendar context: 24 races were planned, with Madrid's new Madring (and its 24% banked
  La Monumental) replacing Imola. Bahrain and Saudi Arabia were cancelled in March 2026, leaving 22.

## Next circuits worth adding
1. **Madring (Madrid)**: new for 2026, with a 550 m banked corner. Needs banking support in physics
   (camber adds grip in proportion to the bank angle).
2. **Las Vegas or Baku**: very long straights for slipstream battles. Vegas is a second night race.
3. **Zandvoort-style banking**, now that the Dutch GP has left the calendar.
4. **A desert night race (Yas Marina/Qatar)**: the night lighting already exists.
5. **Kyalami**: fans' top pick for a circuit to bring back (RacingNews365 poll).
6. **Circuit variants**: reverse direction or short "club" loops are cheap to add and give quick races on phones.

## How the physics uses the circuit
- **Gradient**: uphill slows acceleration and helps braking; downhill does the opposite (Raidillon, Beau Rivage).
- **Vertical load**: compressions push the car into the road (more grip at Eau Rouge); crests unload it.
- **Racing line**: minimum-curvature line inside the track limits (start wide, clip the apex, use the exit kerb).
- **Bridges**: if the lap crosses itself (Suzuka), the upper road becomes a narrow bridge with parapets and
  piers, and the terrain follows the lower road underneath.

## Where the shapes come from
`tools/circuitgen.py` reads GeoJSON outlines from **github.com/bacinger/f1-circuits** (MIT licence,
copy in `tools/geo/`). It then:
1. converts them to metres;
2. puts them in racing direction (Marina Bay is reversed);
3. moves the start to the start/finish line (Monaco and Silverstone);
4. smooths away the polygon corners;
5. scales to the official length;
6. writes `src/geo.js` with the licence notice, which the build keeps.

Re-run it after changing the start offsets or smoothing: `python3 -I tools/circuitgen.py`.
It also prints every detected corner with its distance, angle and radius, for naming corners.

## References
- F1.com circuit guides (Monza, Spa, Silverstone, Marina Bay): lengths, turns, laps
- Spa: 102 m elevation range, Eau Rouge/Raidillon ~17% gradient, ~35-40 m climb
- Suzuka: 5.807 km figure-eight, crossover after Degner and before 130R
- Monaco: 3.337 km, 19 corners, tunnel exit ~280 km/h, ~42 m elevation
- Interlagos: 4.309 km, anticlockwise, ~43 m elevation, 15 corners
- Marina Bay: 4.927 km, 19 corners since 2023, ~1,600 floodlights
- Madring: 5.416 km (5.474 km in some sources), 22 corners, La Monumental 550 m with 24% banking
