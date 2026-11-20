// "Take the Wheel" scenarios: famous kinds of race moments, dropped straight into the action.
import { PlayerCar } from './physics.js';

const CP = 48;

// lap time implied by the speed profile (fastest possible lap at reference grip)
export function profileLapTime(T) { let t = 0; for (let i = 0; i < T.N; i++) t += T.ds / Math.max(5, T.profile[i]); return t; }

// Place the field mid-race. order: [{ code: 'ME' | driver code, gap: seconds to the car ahead, tyre: [compound, wear] }]
function midRace(R, o) {
  const T = R.T, L = T.L;
  R.laps = o.laps;
  const lapsDone = o.laps - o.lapsLeft;
  const lapT = T.circ.refLapTime || 80;
  const v0 = o.v0 || 60;
  R.phase = 'racing';
  R.startTime = R.time - lapsDone * lapT - o.s0 / v0;
  const me = R.player;
  const used = new Set();
  const cars = [];
  for (const x of o.order) {
    const c = x.code === 'ME' ? me : R.cars.find(k => k.code === x.code && !used.has(k)) || R.cars.find(k => k !== me && !used.has(k) && !o.order.some(y => y.code === k.code));
    if (!c || used.has(c)) continue; used.add(c); cars.push([c, x]);
  }
  for (const c of R.cars) if (!used.has(c)) cars.push([c, { gap: 1 + Math.random() * 1.5 }]);
  // keep the whole field on the same lap: the last car must be past the line
  const totalGap = cars.reduce((a, [c, x], i) => a + (i ? (x.gap ?? 1.2) : 0), 0);
  const s0 = Math.max(o.s0, totalGap * v0 + 30);
  R.startTime = R.time - lapsDone * lapT - s0 / v0;
  let gapT = 0;
  cars.forEach(([c, x], i) => {
    if (i > 0) gapT += x.gap ?? 1.2;
    const dist = lapsDone * L + s0 - gapT * v0;
    const s = T.wrap(dist), d = T.lerpArr(T.line, s) + (x.d || 0);
    const v = T.lerpArr(T.profile, s) * (o.speedK || 0.95);
    if (c instanceof PlayerCar) { c.placeAt(s, d); c.v = v; c.gear = Math.max(1, Math.min(8, Math.round(v / 12) + 1)); c.dist = dist; }
    else { c.s = s; c.d = d; c.v = v; c.dist = dist; }
    const [tc, tw] = x.tyre || ['M', 0.4];
    c.tyre = { c: tc, wear: tw, temp: 1, age: Math.round(tw * 20) };
    c.usedCompounds = new Set([tc]); if (x.second !== false) c.usedCompounds.add(tc === 'H' ? 'M' : 'H');
    c.cp = []; c.cpIdx = Math.floor(dist / (L / CP)) + 1;
    for (let j = 0; j < c.cpIdx; j++) c.cp[j] = R.time - (dist - j * L / CP) / v0;
    c.lapTimes = Array.from({ length: lapsDone }, () => lapT * (1.01 + Math.random() * 0.02)); c.lapsDone = lapsDone;
    c.best = c.lapTimes.length ? Math.min(...c.lapTimes) : Infinity;
    c.lapStart = R.time - (dist - lapsDone * L) / v0;
    c.reaction = 0; c.grid = i + 1; c.prevRel = s > L / 2 ? s - L : s; c.decidedLap = Math.floor(dist / L) + 1;
    if (c.isPlayer) c.lapCp = [];
  });
  R.updatePositions();
  R.prevPos = new Map(R.standings.map(c => [c, c.pos]));
}

const medalBy = (pos, g, s, b) => pos <= g ? 'gold' : pos <= s ? 'silver' : pos <= b ? 'bronze' : null;
const finishCheck = fn => (R) => { const p = R.player; if (p.finished && !R.scenarioResult) R.scenarioResult = fn(R, p); };

export const SCENARIOS = [
  {
    id: 'lastlap', title: 'Last-Lap Lunge', circuit: 'parco', mode: 'race', tag: 'Attack',
    brief: 'Final lap. You are P2, six tenths behind the leader, and his tyres are finished. Overtake Mode is armed. Make it count.',
    goals: ['Gold: win the race', 'Silver: P2 within 0.3s of the winner', 'Bronze: hold P2'],
    settings: { laps: 6, opponents: 9, weather: 'dry', incidents: 'off' },
    setup(R) {
      midRace(R, { laps: 6, lapsLeft: 1, s0: 40, order: [{ code: 'KES', tyre: ['M', 0.86] }, { code: 'ME', gap: 0.6, tyre: ['S', 0.4] }, { code: 'VAR', gap: 1.6, tyre: ['M', 0.6] }, { code: 'HAR', gap: 1.2 }] });
      R.otAvailable = true; R.radioMsg('eng', 'Last lap. Kessler is struggling on old tyres. Overtake is available, use it on the straight.');
      R.banner('FINAL LAP', 'Win it', 'white');
    },
    tick: finishCheck((R, p) => {
      const w = R.finishedOrder[0];
      const gap = p.finishTime - w.finishTime;
      const medal = p.pos === 1 ? 'gold' : p.pos === 2 && gap < 0.3 ? 'silver' : p.pos === 2 ? 'bronze' : null;
      return { medal, text: p.pos === 1 ? 'You won it on the last lap!' : `P${p.pos}, ${gap.toFixed(3)}s behind the winner.` };
    }),
  },
  {
    id: 'holdon', title: 'Hold the Line', circuit: 'riviera', mode: 'race', tag: 'Defend',
    brief: 'Three laps to go around the harbour. You lead, but your tyres are worn and Quinto is half a second behind on fresh softs. On a street circuit, defending is everything.',
    goals: ['Gold: win', 'Silver: P2', 'Bronze: P3'],
    settings: { laps: 10, opponents: 9, weather: 'dry', incidents: 'low' },
    setup(R) {
      midRace(R, { laps: 10, lapsLeft: 3, s0: 60, order: [{ code: 'ME', tyre: ['M', 0.64] }, { code: 'QUI', gap: 0.5, tyre: ['S', 0.08] }, { code: 'IKE', gap: 2.5, tyre: ['M', 0.5] }, { code: 'MEH', gap: 1.5 }] });
      R.radioMsg('eng', 'Quinto is on new softs, half a second back. Defend the inside, three laps.');
    },
    tick: finishCheck((R, p) => ({ medal: medalBy(p.pos, 1, 2, 3), text: p.pos === 1 ? 'You held him off. Brilliant defending!' : `Finished P${p.pos}.` })),
  },
  {
    id: 'raingamble', title: 'The Rain Gamble', circuit: 'sakura', mode: 'race', tag: 'Strategy',
    brief: 'Four laps left, P6 on slicks. The radar says heavy rain in about a minute. Box early for inters, or stay out and hope? Your call.',
    goals: ['Gold: podium', 'Silver: P4 or P5', 'Bronze: hold P6'],
    settings: { laps: 9, opponents: 11, weather: 'changeable', incidents: 'low' },
    setup(R) {
      midRace(R, { laps: 9, lapsLeft: 4, s0: 80, order: [{ code: 'BRA', tyre: ['M', 0.5] }, { code: 'QUI', gap: 1.4 }, { code: 'IKE', gap: 1.2 }, { code: 'MEH', gap: 1.0 }, { code: 'VAR', gap: 0.9 }, { code: 'ME', gap: 0.8, tyre: ['M', 0.45] }] });
      const t = R.raceTime = R.time - R.startTime;
      R.cfg.weather = 'changeable';
      R.weather.plan = [{ t: t + 25, rain: 0.45 }, { t: t + 60, rain: 0.85 }];
      R.weather.wet = 0;
      R.radioMsg('eng', 'Heavy rain expected in about a minute. Inters are ready if you want them.');
    },
    tick: finishCheck((R, p) => ({ medal: medalBy(p.pos, 3, 5, 6), text: p.stops ? `Finished P${p.pos} after pitting for wet tyres.` : `Finished P${p.pos} without stopping.` })),
  },
  {
    id: 'restart', title: 'Safety Car Restart', circuit: 'parco', mode: 'race', tag: 'Racecraft',
    brief: 'Safety car in this lap. You are P4 on fresh softs; the three cars ahead are on old mediums. Three laps to go. Nail the restart.',
    goals: ['Gold: win', 'Silver: podium', 'Bronze: hold P4'],
    settings: { laps: 8, opponents: 11, weather: 'dry', incidents: 'off' },
    setup(R) {
      midRace(R, { laps: 8, lapsLeft: 3, s0: R.T.L * 0.55, v0: 40, speedK: 0.5, order: [{ code: 'IKE', tyre: ['M', 0.7] }, { code: 'KES', gap: 0.35, tyre: ['M', 0.72] }, { code: 'BRA', gap: 0.35, tyre: ['M', 0.68] }, { code: 'ME', gap: 0.35, tyre: ['S', 0.05] }, { code: 'VAR', gap: 0.35 }, { code: 'MON', gap: 0.35 }] });
      R.deploySC(); R.scEnding = true; R.scEndLap = 0;
      R.rc('SAFETY CAR IN THIS LAP', 'sc');
      R.radioMsg('eng', 'Safety car in this lap. Fresh softs, you have the grip. Be ready.');
    },
    tick: finishCheck((R, p) => ({ medal: medalBy(p.pos, 1, 3, 4), text: `Finished P${p.pos} from P4 at the restart.` })),
  },
  {
    id: 'comeback', title: 'Comeback Drive', circuit: 'sakura', mode: 'race', tag: 'Overtaking',
    brief: 'A gearbox penalty puts you last on the grid. Five laps to slice through the field.',
    goals: ['Gold: top 4', 'Silver: top 7', 'Bronze: top 10'],
    settings: { laps: 5, opponents: 11, weather: 'dry', incidents: 'normal', gridPos: 12 },
    setup(R) { R.radioMsg('eng', 'We start from the back. Be patient in the first corners, the race is long.'); },
    tick: finishCheck((R, p) => ({ medal: medalBy(p.pos, 4, 7, 10), text: `From P12 to P${p.pos}. ${12 - p.pos >= 0 ? 'Positions gained: ' + (12 - p.pos) : ''}` })),
  },
  {
    id: 'undercut', title: 'The Undercut', circuit: 'riviera', mode: 'race', tag: 'Strategy',
    brief: 'You are P3, stuck 1.2s behind Mehra and you cannot pass on track. Pit before him, push on fresh tyres, and come out ahead.',
    goals: ['Gold: beat Mehra and finish P2 or better', 'Silver: finish ahead of Mehra', 'Bronze: within 3s of Mehra'],
    settings: { laps: 12, opponents: 9, weather: 'dry', incidents: 'off' },
    setup(R) {
      midRace(R, { laps: 12, lapsLeft: 6, s0: R.T.L * 0.3, order: [{ code: 'LAU', tyre: ['H', 0.4] }, { code: 'MEH', gap: 6, tyre: ['M', 0.7], second: false }, { code: 'ME', gap: 1.2, tyre: ['M', 0.68], second: false }, { code: 'SET', gap: 9 }] });
      this.rival = R.cars.find(c => c.code === 'MEH');
      R.radioMsg('eng', 'We think Mehra pits in two laps. Box this lap for the undercut, then push.');
    },
    tick(R) {
      const T = R.T, riv = this.rival, p = R.player;
      if (riv && !riv.pit && !riv.pitRequest && riv.stops === 0 && R.laps - (Math.floor(riv.dist / T.L) + 1) <= 4) riv.pitRequest = 'H';
      if (p.finished && !R.scenarioResult) {
        const ahead = !riv.finished || p.finishTime < riv.finishTime;
        const gap = riv.finished ? p.finishTime - riv.finishTime : -1;
        const medal = ahead && p.pos <= 2 ? 'gold' : ahead ? 'silver' : gap < 3 ? 'bronze' : null;
        R.scenarioResult = { medal, text: ahead ? 'The undercut worked. You jumped Mehra!' : `Mehra stayed ahead by ${gap.toFixed(1)}s.` };
      }
    },
  },
  {
    id: 'pitwallrain', title: 'Pit Wall: Storm Strategy', circuit: 'parco', mode: 'pitwall', tag: 'Pit wall',
    brief: 'You are the race engineer. Your driver starts P5 and rain is forecast mid-race. Call the tyres, manage the energy, bring home a big result.',
    goals: ['Gold: P1 or P2', 'Silver: P3', 'Bronze: P4 or P5'],
    settings: { laps: 7, opponents: 11, weather: 'changeable', incidents: 'normal', gridPos: 5, pitGame: true },
    setup(R) { R.radioMsg('drv', 'Radio check. Let me know when the rain is coming.'); },
    tick: finishCheck((R, p) => ({ medal: medalBy(p.pos, 2, 3, 5), text: `${p.name} finished P${p.pos}.` })),
  },
  {
    id: 'harbourlap', title: 'Harbour Hot Lap', circuit: 'riviera', mode: 'hotlap', tag: 'Time trial',
    brief: 'Three flying laps around Riviera Harbour. Hit the targets. Brake on the boards, use every kerb you can.',
    goals: [], // filled in at runtime from the track
    settings: { weather: 'dry' },
    targets(T) { const t = profileLapTime(T); return { gold: t / 0.965, silver: t / 0.94, bronze: t / 0.91 }; },
    setup(R) { this.t = this.targets(R.T); },
    tick(R) {
      const p = R.player;
      if (p.lapTimes.length >= 3 && !R.scenarioResult) {
        const b = p.best, t = this.t;
        R.scenarioResult = { medal: b <= t.gold ? 'gold' : b <= t.silver ? 'silver' : b <= t.bronze ? 'bronze' : null, text: 'Best lap ' + fmtT(b) };
      }
    },
  },
];
function fmtT(t) { if (!isFinite(t)) return '--'; const m = Math.floor(t / 60); return m + ':' + (t - m * 60).toFixed(3).padStart(6, '0'); }
export const scenarioGoals = (sc, T) => sc.targets ? (() => { const t = sc.targets(T); return [`Gold: under ${fmtT(t.gold)}`, `Silver: under ${fmtT(t.silver)}`, `Bronze: under ${fmtT(t.bronze)}`]; })() : sc.goals;
