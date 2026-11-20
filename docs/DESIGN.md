# Design notes

## Car model (2026 regulations, simplified)
- Mass 800 kg with driver. Downforce ClA 4.2 in corner mode, 2.5 in straight mode; drag CdA 1.45 / 0.95.
- Power: 400 kW combustion + up to 350 kW electric. Electric power tapers above 290 km/h (above 337 km/h with Overtake Mode).
- Battery 4 MJ, harvest up to 8.5 MJ per lap (braking, lift-off, Recharge mode "super-clipping").
- Grip: tyre compound x wear x temperature x wetness x damage, friction circle shared between braking and cornering.
- Steering is grip-normalised so keyboard and touch can drive at the limit without constant understeer.

## Tyres
| Compound | Grip | Wear | Notes |
| --- | --- | --- | --- |
| Soft | 1.000 | 1.75x | fastest, short life |
| Medium | 0.975 | 1.0x | |
| Hard | 0.955 | 0.6x | |
| Intermediate | 0.87 peak | 1.1x | best on a damp track; overheats when dry |
| Wet | 0.80 peak | 1.0x | best in heavy rain |
Wear is scaled to race length so short races still need strategy. Grip drops sharply after ~72% wear.
Dry races of 5+ laps require two dry compounds (30 s penalty otherwise).

## AI
- Follows a precomputed minimum-curvature racing line and speed profile (corner speed, braking, power-limited acceleration).
- Skill = difficulty x team pace x small random factor.
- Traffic: slipstream, pass-side choice, following distance, defending into braking zones, blue flags for lapped cars.
- Mistakes: lock-ups and running wide, more likely in the wet, on worn tyres and under pressure. On street circuits a mistake can end in the wall.
- Strategy: pits on worn tyres, for rain (inters/wets) and opportunistically under the safety car; respects the two-compound rule.

## Scoring
- XP per race: finish position, positions gained, win/podium, fastest lap, clean race, mega pit stop.
- Levels: level n needs 150 x n x (n-1) XP in total. Helmet designs unlock at levels 2-8.
- Scenarios: gold 250, silver 150, bronze 80 XP. Grandstand predictions: winner 100, fastest lap 60, safety car call 40.
