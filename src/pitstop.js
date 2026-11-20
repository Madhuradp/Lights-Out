import { COMPOUNDS } from './data.js';
import { $, txt, tyreBadge } from './util';
import { sound, haptics, input } from './ctx';

// ------------------------------------------------------------------ pit menu (cockpit)
export function openPitMenu(g) {
  const p = g.race.player, race = g.race;
  if (p.pit) return;
  if (p.pitRequest) { p.pitRequest = null; race.radioMsg('eng', 'Understood, stay out.'); return; }
  const lapNo = Math.floor(p.dist / g.T.L) + 1;
  const rec = race.weather.wet > 0.75 ? 'W' : race.weather.wet > 0.25 ? 'I' : race.pickDry(p, Math.max(1, race.laps - lapNo));
  const host = $('#pitmenuHost');
  host.innerHTML = `<div class="pitmenu"><h3>Box this lap?</h3><p>Pick tyres. You'll be put on the pit limiter at pit entry, then it's your crew's job.</p>
    <div class="cmpds">${Object.keys(COMPOUNDS).map(c => `<button class="cmpd ${c === rec ? 'sel' : ''}" data-c="${c}">${c === rec ? '<span class="rec">REC</span>' : ''}${tyreBadge(c)}<span>${COMPOUNDS[c].name}</span></button>`).join('')}</div>
    <div style="display:flex;gap:8px;margin-top:12px"><button class="hbtn" id="pmCancel" style="flex:1">STAY OUT</button></div></div>`;
  g.pitMenuOpen = true;
  host.querySelectorAll('[data-c]').forEach(b => b.onclick = () => { p.pitRequest = b.dataset.c; race.radioMsg('eng', `Box, box. ${COMPOUNDS[b.dataset.c].name}s are ready.`); closePitMenu(g); });
  $('#pmCancel').onclick = () => closePitMenu(g);
  g.pitMenuT = 0;
}
export function closePitMenu(g) { $('#pitmenuHost').innerHTML = ''; g.pitMenuOpen = false; }

// ------------------------------------------------------------------ pit crew mini-game
export function startPitGame(g, car) {
  const host = $('#pitgameHost');
  const pg = g.pg = { car, wheel: 0, phase: 'guns', m: 0, dir: 1, speed: 1.9, lock: 0, results: [], t0: performance.now(), greenAt: 0, auto: 0 };
  host.innerHTML = `<div class="pitgame" id="pgRoot"><div class="card"><h3>PIT STOP</h3><div class="sub">Tap (or press Space / A) when the marker is in the green. Four wheels, then wait for the green light to release the car.</div>
    <div class="pg-wheels">${['FL', 'FR', 'RL', 'RR'].map((w, i) => `<div id="pgw${i}">${w}</div>`).join('')}</div>
    <div class="pg-track"><div class="pg-zone" style="left:58%;width:28%"></div><div class="pg-zone perfect" style="left:66%;width:10%"></div><div class="pg-mark" id="pgMark"></div></div>
    <div class="pg-msg" id="pgMsg"></div><div class="pg-light" id="pgLight"></div><div class="pg-timer" id="pgTimer">0.00</div></div></div>`;
  $('#pgRoot').addEventListener('pointerdown', e => { e.preventDefault(); pitPress(g); });
  sound.pitGun();
}
export function pitPress(g) {
  const pg = g.pg; if (!pg) return;
  if (pg.phase === 'guns') {
    if (pg.lock > 0) return;
    const m = pg.m;
    const el = $('#pgw' + pg.wheel);
    if (m >= 0.58 && m <= 0.86) {
      const perfect = m >= 0.66 && m <= 0.76;
      el.classList.add('done'); txt($('#pgMsg'), perfect ? 'PERFECT!' : 'Good'); sound.pitGun(); haptics.pulse(30);
      pg.wheel++; pg.m = 0;
      if (pg.wheel >= 4) { pg.phase = 'release'; pg.greenAt = performance.now() + 350 + Math.random() * 650; txt($('#pgMsg'), 'Wait for the green light...'); }
      else $('#pgw' + pg.wheel).classList.add('cur');
    } else { el.classList.add('bad'); txt($('#pgMsg'), 'Wheel gun slipped! Go again'); pg.lock = 0.45; haptics.pulse(80, 0.8); }
  } else if (pg.phase === 'release') {
    if (performance.now() < pg.greenAt) { txt($('#pgMsg'), 'Not yet! Wait for green'); return; }
    finishPitGame(g);
  }
}
export function finishPitGame(g) {
  const pg = g.pg; if (!pg) return;
  const car = pg.car;
  const t = car.pit ? car.pit.timer : 0;
  if (car.pit && car.pit.phase === 'stop') car.releaseFromBox();
  txt($('#pgTimer'), t.toFixed(2) + 's');
  const verdict = t < 2.3 ? 'Mega stop!' : t < 2.9 ? 'Good stop' : t < 4 ? 'A bit slow' : 'Slow stop';
  txt($('#pgMsg'), verdict + ' · GO GO GO!');
  haptics.pattern([40, 30, 80]);
  g.pg = null;
  setTimeout(() => { if (!g.pg) $('#pitgameHost').innerHTML = ''; }, 900);
}
export function updatePitGame(g, dt) {
  const pg = g.pg; if (!pg) return;
  if (input.consume('action')) pitPress(g);
  pg.lock = Math.max(0, pg.lock - dt);
  if (pg.phase === 'guns') {
    pg.m += pg.dir * dt * pg.speed; if (pg.m > 1) { pg.m = 1; pg.dir = -1; } if (pg.m < 0) { pg.m = 0; pg.dir = 1; }
    const mk = $('#pgMark'); if (mk) mk.style.left = (pg.m * 100) + '%';
    if (pg.wheel === 0) $('#pgw0')?.classList.add('cur');
  } else if (pg.phase === 'release') {
    $('#pgLight')?.classList.toggle('green', performance.now() >= pg.greenAt);
  }
  if (pg.car.pit) txt($('#pgTimer'), pg.car.pit.timer.toFixed(2));
  // safety net: if nobody plays, the crew finishes the job
  if (pg.car.pit && pg.car.pit.timer > 9) finishPitGame(g);
}

