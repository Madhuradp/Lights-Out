// In-race coach: short tips the first time each situation comes up, worded for the device in use.
// Each tip shows once per player (stored), and only when the coach is on.
import { cfg } from './ctx';
import { store, $ } from './util';
import { label } from './controls.js';
import { PHYS } from './physics.js';

const seen = new Set(store.get('tips', []));
const remember = id => { seen.add(id); store.set('tips', [...seen]); };
export const resetTips = () => { seen.clear(); store.set('tips', []); };

// [id, condition(g, p, race, T), text()]
const K = a => `<kbd>${label(a)}</kbd>`;
const TIPS = [
  ['lights', (g, p, r) => r.phase === 'lights' || r.phase === 'grid', () => `Five red lights come on. When they all go out, hold ${K('throttle')}. Too early is a jump start.`],
  ['steer', (g, p, r) => r.phase === 'racing' && r.time - r.startTime > 1.5, () => `Steer with ${K('left')} ${K('right')}. The line on the road turns red where you should brake and green where you can accelerate.`],
  ['brake', (g, p, r, T) => r.phase === 'racing' && p.v > 45 && T.lerpArr(T.profile, p.s + 110) < p.v - 18, () => `Corner ahead: brake with ${K('brake')} in a straight line now, then turn in.`],
  ['aero', (g, p) => p.straightMode, () => `Straight mode: your wings have opened for top speed. They close by themselves when you brake or turn.`],
  ['boost', (g, p, r, T) => r.phase === 'racing' && p.battery > 2.4 && T.zone[p.idx] === 1 && p.v > 40 && r.time - r.startTime > 20, () => `Battery is charged. Hold ${K('boost')} for Boost: extra electric power. Watch the blue bar on the left of the wheel.`],
  ['ot', (g, p, r) => r.otAvailable && !p.otActive, () => `You're within 1 second of the car ahead. Press ${K('ot')} for Overtake mode: extra energy to make the pass.`],
  ['lowbatt', (g, p, r) => r.phase === 'racing' && p.battery < 0.7 && r.time - r.startTime > 30, () => `Battery low. Lift off a little before the braking zones (lift and coast) or press ${K('recharge')} to recharge on the straights.`],
  ['yellow', (g, p) => g.flagLocal === 'yellow', () => `Yellow flag (see the lights on your wheel): slow down and don't overtake until you pass the incident.`],
  ['blue', (g, p) => p.blue, () => `Blue flag: a faster car is lapping you. Hold your line and let it through.`],
  ['sc', (g, p, r) => r.sc || r.vsc, () => `Safety car: no overtaking. Keep the gap and your tyres warm, and get ready for the restart.`],
  ['limits', (g, p, r) => r.trackLimits > 0, () => `Track limits: keep at least two wheels inside the white lines. Three warnings and you get a penalty.`],
  ['sectors', (g, p) => p.lapTimes && p.lapTimes.length >= 1, () => `Lap complete. Sector colours: purple = fastest of anyone, green = your personal best, yellow = slower.`],
  ['tyres', (g, p, r) => cfg.mode === 'race' && p.tyre.wear > 0.55 && !p.pitRequest, () => `Your tyres are wearing out (the squares on the wheel turn yellow, then red). Press ${K('box')} to pit at the end of this lap.`],
  ['rain', (g, p, r) => r.weather.wet > 0.3 && (p.tyre.c === 'S' || p.tyre.c === 'M' || p.tyre.c === 'H'), () => `It's raining and you're on slicks. Box (${K('box')}) for Intermediates (green) or full Wets (blue) when it's heavy.`],
  ['cold', (g, p) => p.tyre.temp < 0.6 && p.v > 20 && (p.tyre.age || 0) === 0 && p.lapTimes && p.lapTimes.length > 0, () => `New tyres are cold (blue squares on the wheel). Take it easy for a few corners until they turn green.`],
  ['gears', (g, p) => !cfg.assist.autoGear && p.v > 10, () => `Manual gears: ${K('shiftUp')} up, ${K('shiftDown')} down. Shift up when the top lights turn blue.`],
  ['page', (g, p, r) => r.phase === 'racing' && r.time - r.startTime > 60 && g.camMode === 'cockpit', () => `The wheel has pages: press ${K('page')} for ENERGY (battery use per lap) and TYRES (temperature and wear).`],
];

export function updateCoach(g, dt) {
  const el = $('#coach'); if (!el) return;
  const race = g.race, p = race.player;
  if (!cfg.coach || !p || p.auto || g.paused || cfg.mode === 'pitwall' || cfg.mode === 'grandstand') { el.classList.add('hidden'); return; }
  g.coachT = (g.coachT || 0) - dt;
  if (g.coachT > 0) return;
  if (g.coachOn) { g.coachOn = false; el.classList.add('hidden'); g.coachT = 2.5; return; }
  for (const [id, cond, text] of TIPS) {
    if (seen.has(id)) continue;
    let ok = false; try { ok = cond(g, p, race, g.T); } catch (e) { ok = false; }
    if (!ok) continue;
    remember(id);
    el.innerHTML = `<span class="ctag">COACH</span><span>${text()}</span>`;
    el.classList.remove('hidden');
    g.coachOn = true; g.coachT = id === 'brake' ? 3.5 : 6.5;
    return;
  }
}
// battery as a fraction, for UI
export const battPct = p => p.battery / PHYS.battery;
