import { Race, fmt } from './race.js';
import { Haptics } from './audio.js';
import { $, store, hex } from './util';
import { cfg, saveCfg, sound, haptics, input, S } from './ctx';
import { seg, renderMenu } from './menu';
import { startGame } from './game';
import { afterSession, endSession, startQuick, startRound, POINTS } from './session';
import { SCENARIOS } from './scenarios';
import { profile } from './profile';
import { guideHTML, bindGuide } from './controls.js';
import { resetTips } from './coach.js';

// ------------------------------------------------------------------ pause / results
export function showPause(g, view, dev) {
  g.paused = true;
  const drv = cfg.mode !== 'pitwall' && cfg.mode !== 'grandstand';
  if (view === 'controls') {
    $('#overlayHost').innerHTML = `<div class="overlay"><div class="card" style="max-width:860px;max-height:88vh;overflow:auto"><h2>Controls</h2>${guideHTML({ device: dev, compact: false })}
      <div style="display:flex;gap:8px;margin-top:14px"><button class="btn" id="cRes">Resume</button><button class="btn ghost" id="cBack">Back</button></div></div></div>`;
    bindGuide($('#overlayHost'), d => { input.rebind(); showPause(g, 'controls', d); });
    $('#cRes').onclick = () => { input.rebind(); hidePause(g); };
    $('#cBack').onclick = () => { input.rebind(); showPause(g); };
    return;
  }
  $('#overlayHost').innerHTML = `<div class="overlay"><div class="card" style="max-width:460px;max-height:90vh;overflow:auto"><h2>Paused</h2>
    <div style="display:grid;gap:8px">
      <button class="btn" id="pRes">Resume</button>
      ${drv ? '<button class="btn ghost" id="pCtl">Controls &amp; how to drive</button>' : ''}
      <button class="btn ghost" id="pRst">Restart</button>
      <div class="opt" style="margin-top:6px"><label>Volume</label><input type="range" id="pVol" min="0" max="1" step="0.05" value="${cfg.volume}"></div>
      <div class="opt"><label>Haptics (vibration / gamepad rumble)</label>${seg('haptics', [[true, 'On'], [false, 'Off']])}</div>
      <div class="opt"><label>Team radio voice</label>${seg('voice', [[true, 'On'], [false, 'Off']])}</div>
      ${drv ? `<div class="opt"><label>Coach tips</label>${seg('coach', [[true, 'On'], [false, 'Off']])}</div>
      <div class="opt"><label>Braking assist</label>${seg('brake', [[true, 'On'], [false, 'Off']], 'assist')}</div><div class="opt"><label>Steering assist</label>${seg('steer', [[true, 'On'], [false, 'Off']], 'assist')}</div>
      <div class="opt"><label>Halo pillar (cockpit)</label>${seg('halo', [['real', 'As drivers see it'], ['solid', 'Solid'], ['off', 'Hidden']])}</div>
      <div class="opt"><label>Wing mirrors</label>${seg('mirrorSize', [['real', 'Real size'], ['large', 'Large']])}</div>` : ''}
      ${cfg.mode === 'hotlap' ? '<button class="btn ghost" id="pEnd">End session (collect XP)</button>' : ''}
      <button class="btn ghost" id="pQuit">Quit to menu</button>
    </div></div></div>`;
  $('#pRes').onclick = () => hidePause(g);
  const pc = $('#pCtl'); if (pc) pc.onclick = () => showPause(g, 'controls');
  $('#pRst').onclick = () => { $('#overlayHost').innerHTML = ''; startGame(); };
  $('#pQuit').onclick = () => quitToMenu();
  const pe = $('#pEnd'); if (pe) pe.onclick = () => { $('#overlayHost').innerHTML = ''; showResults(g); };
  $('#pVol').oninput = e => { cfg.volume = +e.target.value; sound.setVolume(cfg.volume); saveCfg(); };
  $('#overlayHost').querySelectorAll('.seg').forEach(sg => sg.querySelectorAll('button').forEach(b => b.onclick = () => {
    let v = b.dataset.v; v = v === 'true' ? true : v === 'false' ? false : v;
    if (sg.dataset.sub) cfg[sg.dataset.sub][sg.dataset.key] = v; else cfg[sg.dataset.key] = v;
    saveCfg(); haptics.enabled = cfg.haptics; sg.querySelectorAll('button').forEach(x => x.classList.toggle('sel', x === b));
  }));
}
export function hidePause(g) { g.paused = false; $('#overlayHost').innerHTML = ''; }
export function quitToMenu(tab) {
  if (S.G) { S.G.dead = true; }
  input.inGame = false;
  endSession();
  try { speechSynthesis.cancel(); } catch (e) { }
  sound.update({ rpm: 0, throttle: 0, v: 0, ers: 0, slip: 0, kerb: 0, grass: 0, rain: 0, crowd: 0, paused: true });
  $('#overlayHost').innerHTML = ''; $('#hud').classList.add('hidden'); $('#hud').innerHTML = ''; $('#fx').innerHTML = '';
  $('#menu').classList.remove('hidden'); renderMenu(tab);
}

export function showResults(g) {
  if (g.resultsShown) return; g.resultsShown = true;
  const race = g.race, sess = S.session || { kind: 'quick' };
  const solo = cfg.mode === 'hotlap';
  const rows = solo ? null : race.results();
  const me = rows ? rows.find(r => r.car === race.player) : null;
  const pos = me ? me.pos : '-';
  const gained = me ? ((me.grid || me.pos) - me.pos) : 0;
  if (race.player.best < store.get('best_' + cfg.circuit, Infinity)) store.set('best_' + cfg.circuit, race.player.best);
  const { xpHtml, extra } = afterSession(g, rows);
  const sr = race.scenarioResult;
  const medalHtml = sr ? `<div class="medal ${sr.medal || 'none'}"><div class="disc">${sr.medal ? sr.medal[0].toUpperCase() : '–'}</div><div><b>${sr.medal ? sr.medal.toUpperCase() + ' MEDAL' : 'NO MEDAL THIS TIME'}</b><div>${sr.text}</div></div></div>` : '';
  const title = sr ? (SCENARIOS.find(x => x.id === sess.scenario)?.title || 'Scenario') : cfg.mode === 'grandstand' ? 'Race result · from the grandstand' : cfg.mode === 'pitwall' ? 'Race result · ' + race.player.name : sess.kind === 'champ' ? `Round ${sess.round + 1} result` : solo ? 'Hot lap session' : 'Race result';
  const statsHtml = solo ? `<div class="stats"><div class="stat"><small>Best lap</small><b>${fmt(race.player.best)}</b></div><div class="stat"><small>Laps</small><b>${race.player.lapTimes.length}</b></div></div>`
    : cfg.mode === 'grandstand' ? '' : `<div class="stats"><div class="stat"><small>Finish</small><b>P${pos}</b></div><div class="stat"><small>Positions</small><b style="color:${gained >= 0 ? '#19d35a' : '#ff4d4d'}">${gained >= 0 ? '+' : ''}${gained}</b></div><div class="stat"><small>Best lap</small><b>${fmt(race.player.best)}</b></div><div class="stat"><small>Pit stops</small><b>${race.player.stops || 0}</b></div><div class="stat"><small>Penalties</small><b>${me ? me.pen : 0}s</b></div>${race.fastest ? `<div class="stat"><small>Fastest lap</small><b>${race.fastest.code} ${fmt(race.fastest.t)}</b></div>` : ''}</div>`;
  const table = rows ? `<div style="max-height:${sess.kind === 'champ' ? 26 : 40}vh;overflow:auto"><table class="res"><tr><th>Pos</th><th>Driver</th><th>Team</th><th>Time / gap</th><th>Best</th><th>Stops</th>${sess.kind === 'champ' ? '<th>Pts</th>' : ''}</tr>
    ${rows.map(r => `<tr class="${r.car === race.player && cfg.mode !== 'grandstand' ? 'me' : ''}"><td>${r.pos}</td><td><span class="tc" style="background:${hex(r.color)}"></span>${r.code} <span style="color:#9aa3ad">${r.name || ''}</span></td><td>${r.team}</td><td>${r.gap}${r.pen ? ` <span style="color:#ff8080">(+${r.pen}s)</span>` : ''}</td><td>${fmt(r.best)}</td><td>${r.stops}</td>${sess.kind === 'champ' ? `<td>${r.retired ? 0 : (POINTS[r.pos - 1] || 0)}</td>` : ''}</tr>`).join('')}</table></div>` : '';
  const ch = profile.champ;
  const btns = sess.kind === 'champ' ? (ch && !ch.done ? `<button class="btn" id="rNext">Next: Round ${ch.round + 1} · ${ch.rounds[ch.round].name}</button>` : '') + '<button class="btn ghost" id="rMenu">Career menu</button>'
    : sr ? '<button class="btn" id="rAgain">Try again</button><button class="btn ghost" id="rMenu">All scenarios</button>'
    : `<button class="btn" id="rAgain">${cfg.mode === 'grandstand' ? 'Watch another race' : solo ? 'Keep lapping' : 'Race again'}</button><button class="btn ghost" id="rMenu">Menu</button>`;
  $('#overlayHost').innerHTML = `<div class="overlay"><div class="card"><h2>${title}</h2>${medalHtml}${statsHtml}
    ${me && me.note ? `<p style="color:#ffd400">${me.note}</p>` : ''}${xpHtml}${table}${extra}
    <div class="go" style="margin-top:14px">${btns}</div></div></div>`;
  const again = $('#rAgain'), next = $('#rNext'), menu = $('#rMenu');
  if (again) again.onclick = () => { $('#overlayHost').innerHTML = ''; if (sess.kind === 'quick' && sess.stage === 'race' && sess.field) { endSession(); startQuick(); } else if (solo) { g.resultsShown = false; hidePause(g); } else startGame(); };
  if (next) next.onclick = () => { $('#overlayHost').innerHTML = ''; startRound(); };
  if (menu) menu.onclick = () => quitToMenu(sess.kind === 'champ' || sr ? 'career' : 'play');
}

// ------------------------------------------------------------------ voice
export function speak(text, from) {
  if (!cfg.voice || !('speechSynthesis' in window)) return;
  try {
    if (speechSynthesis.pending) speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    const vs = speechSynthesis.getVoices();
    const v = vs.find(v => /en-GB/i.test(v.lang)) || vs.find(v => /^en/i.test(v.lang));
    if (v) u.voice = v;
    u.rate = from === 'drv' ? 1.15 : 1.08; u.pitch = from === 'drv' ? 1.1 : 0.85;
    u.volume = cfg.muted ? 0 : Math.min(1, 0.9 * (cfg.mix?.radio ?? 1) * Math.min(1, cfg.volume * 1.4));
    if (u.volume <= 0.01) return;
    speechSynthesis.speak(u);
  } catch (e) { }
}

