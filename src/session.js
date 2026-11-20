// Sessions: what is being played and what happens next (qualifying -> race, championship rounds,
// scenarios, grandstand predictions), plus XP awards after each session.
import { CIRCUITS, DRIVERS, TEAMS, DIFFICULTY } from './data.js';
import { TEAM_PACE, fmt } from './race.js';
import { profileLapTime } from './scenarios.js';
import { cfg, S, getTrack } from './ctx.js';
import { $, hex } from './util.js';
import { profile, saveProfile, award, recordRace, levelInfo } from './profile.js';
import { startGame } from './game.js';

export const POINTS = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];

// ---------------- launching with temporary overrides ----------------
export function launch(overrides, session) {
  restore();
  S.backup = {};
  for (const k of Object.keys(overrides)) { S.backup[k] = cfg[k]; cfg[k] = overrides[k]; }
  S.session = session || { kind: 'quick' };
  startGame();
}
export function restore() {
  if (S.backup) { for (const k of Object.keys(S.backup)) cfg[k] = S.backup[k]; S.backup = null; }
}
export function endSession() { restore(); S.session = null; }

// AI field for a session (same rule as the race uses)
export function pickField(teamId, count) {
  const mate = DRIVERS.find(d => d.team === teamId);
  const pool = DRIVERS.filter(d => d !== mate).sort((a, b) => TEAM_PACE[b.team] - TEAM_PACE[a.team] + (Math.random() - 0.5) * 0.012);
  return pool.slice(0, count).map(d => d.code);
}

// ---------------- quick race ----------------
export function startQuick() {
  if (cfg.mode === 'race' && cfg.quali) {
    const field = pickField(cfg.team, Math.min(19, cfg.opponents));
    launch({ mode: 'quali', fieldCodes: field }, { kind: 'quick', stage: 'quali', field, circuit: cfg.circuit });
  } else launch({}, { kind: 'quick' });
}

// ---------------- qualifying ----------------
export function qualiTimes(circuitId, fieldCodes, difficulty, wet) {
  const T = getTrack(circuitId);
  const base = profileLapTime(T) * 1.012 * (wet ? 1.12 : 1);
  const sk = DIFFICULTY[difficulty || 'pro'].skill;
  return fieldCodes.map(code => {
    const d = DRIVERS.find(x => x.code === code);
    const skill = sk * TEAM_PACE[d.team] * (1 + (Math.random() - 0.5) * 0.008);
    return { code, name: d.name, team: TEAMS.find(t => t.id === d.team), time: base / skill * (1 + Math.random() * 0.006) };
  });
}

export function onQualiDone(g, time, valid) {
  const sess = S.session; if (!sess) return;
  const wet = g.race.weather.wet > 0.3;
  const field = sess.field;
  const rows = qualiTimes(cfg.circuit, field, cfg.difficulty, wet);
  const team = TEAMS.find(t => t.id === cfg.team);
  rows.push({ code: 'ME', name: cfg.name, team, time: valid ? time : Infinity, me: true });
  rows.sort((a, b) => a.time - b.time);
  const pole = rows[0].me;
  if (pole) { profile.stats.poles++; saveProfile(); }
  const gridOrder = rows.map(r => r.code);
  sess.gridOrder = gridOrder; sess.qualiRows = rows;
  const myPos = rows.findIndex(r => r.me) + 1;
  const host = $('#overlayHost');
  host.innerHTML = `<div class="overlay"><div class="card"><h2>Qualifying result</h2>
    <div class="stats"><div class="stat"><small>Grid</small><b>P${myPos}</b></div><div class="stat"><small>Your lap</small><b>${valid ? fmt(time) : 'Deleted'}</b></div><div class="stat"><small>Pole</small><b>${rows[0].me ? cfg.code : rows[0].code} ${fmt(rows[0].time)}</b></div></div>
    ${!valid ? '<p style="color:#ffd400">Lap deleted for track limits. You start from the back.</p>' : pole ? '<p style="color:#19d35a;font-weight:800">POLE POSITION!</p>' : ''}
    <div style="max-height:44vh;overflow:auto"><table class="res"><tr><th>Pos</th><th>Driver</th><th>Team</th><th>Time</th><th>Gap</th></tr>
    ${rows.map((r, i) => `<tr class="${r.me ? 'me' : ''}"><td>${i + 1}</td><td><span class="tc" style="background:${hex(r.team.color)}"></span>${r.me ? cfg.code : r.code} <span style="color:#9aa3ad">${r.name}</span></td><td>${r.team.name}</td><td>${isFinite(r.time) ? fmt(r.time) : '—'}</td><td>${i && isFinite(r.time) ? '+' + (r.time - rows[0].time).toFixed(3) : ''}</td></tr>`).join('')}</table></div>
    <div class="go" style="margin-top:14px"><button class="btn" id="qRace">Start the race</button><button class="btn ghost" id="qRetry">Retry qualifying</button></div></div></div>`;
  $('#qRace').onclick = () => {
    host.innerHTML = '';
    const ov = { mode: 'race', fieldCodes: field, gridOrder };
    if (sess.kind === 'champ') Object.assign(ov, champOverrides());
    launch(ov, Object.assign(sess, { stage: 'race' }));
  };
  $('#qRetry').onclick = () => { host.innerHTML = ''; startGame(); };
}

// ---------------- championship ----------------
const ROUNDS_SHORT = ['parco', 'riviera', 'sakura'];
const ROUNDS_FULL = ['parco', 'riviera', 'sakura', 'riviera', 'sakura', 'parco'];
export function newSeason(opts) {
  const list = opts.length === 'full' ? ROUNDS_FULL : ROUNDS_SHORT;
  const rounds = list.map((c, i) => ({ circuit: c, weather: opts.weather === 'dry' ? 'dry' : (Math.random() < 0.65 ? 'dry' : Math.random() < 0.7 ? 'changeable' : 'wet'), name: CIRCUITS.find(x => x.id === c).name + (list.indexOf(c) !== i ? ' II' : '') }));
  const field = pickField(cfg.team, Math.min(19, opts.opponents || 11));
  profile.champ = { started: Date.now(), rounds, round: 0, team: cfg.team, difficulty: cfg.difficulty, laps: opts.laps || 5, qualify: opts.qualify !== false, field, points: {}, teamPts: {}, results: [], done: false };
  for (const c of field.concat(['ME'])) profile.champ.points[c] = 0;
  saveProfile();
}
export function champOverrides() {
  const ch = profile.champ, r = ch.rounds[ch.round];
  return { circuit: r.circuit, weather: r.weather, laps: ch.laps, team: ch.team, difficulty: ch.difficulty, opponents: ch.field.length, incidents: 'normal' };
}
export function startRound() {
  const ch = profile.champ; if (!ch || ch.done) return;
  const ov = champOverrides();
  const sess = { kind: 'champ', round: ch.round, field: ch.field };
  if (ch.qualify) launch(Object.assign(ov, { mode: 'quali', fieldCodes: ch.field }), Object.assign(sess, { stage: 'quali' }));
  else launch(Object.assign(ov, { mode: 'race', fieldCodes: ch.field }), Object.assign(sess, { stage: 'race' }));
}
export function standings(ch = profile.champ) {
  const rows = Object.entries(ch.points).map(([code, pts]) => {
    if (code === 'ME') return { code: cfg.code, name: cfg.name, team: TEAMS.find(t => t.id === ch.team), pts, me: true };
    const d = DRIVERS.find(x => x.code === code); return { code, name: d.name, team: TEAMS.find(t => t.id === d.team), pts };
  });
  const wins = code => ch.results.filter(r => r[0] && r[0].code === code).length;
  rows.sort((a, b) => b.pts - a.pts || wins(b.me ? 'ME' : b.code) - wins(a.me ? 'ME' : a.code));
  const teams = {};
  for (const r of rows) { teams[r.team.id] = teams[r.team.id] || { team: r.team, pts: 0 }; teams[r.team.id].pts += r.pts; }
  return { drivers: rows, teams: Object.values(teams).sort((a, b) => b.pts - a.pts) };
}
function champAfterRace(g, rows) {
  const ch = profile.champ; if (!ch || ch.done) return '';
  const res = rows.map(r => ({ code: r.car === g.race.player ? 'ME' : r.code, pos: r.pos, pts: r.retired ? 0 : (POINTS[r.pos - 1] || 0) }));
  for (const r of res) ch.points[r.code] = (ch.points[r.code] || 0) + r.pts;
  ch.results.push(res);
  ch.round++;
  let title = '';
  if (ch.round >= ch.rounds.length) {
    ch.done = true;
    const st = standings(ch);
    if (st.drivers[0].me) { profile.titles++; title = '<p style="color:#ffd400;font-size:22px;font-weight:900;font-style:italic">WORLD CHAMPION!</p>'; }
    else title = `<p style="font-weight:800">Season over. Champion: ${st.drivers[0].code}. You finished P${st.drivers.findIndex(d => d.me) + 1}.</p>`;
  }
  saveProfile();
  return title + champTable();
}
export function champTable(compact) {
  const ch = profile.champ; if (!ch) return '';
  const st = standings(ch);
  return `<h4 style="margin:14px 0 6px;color:#9aa3ad;letter-spacing:2px;font-size:12px">DRIVERS' STANDINGS · ${ch.done ? 'FINAL' : 'AFTER ROUND ' + ch.round + ' OF ' + ch.rounds.length}</h4>
  <table class="res">${st.drivers.slice(0, compact ? 6 : 20).map((d, i) => `<tr class="${d.me ? 'me' : ''}"><td>${i + 1}</td><td><span class="tc" style="background:${hex(d.team.color)}"></span>${d.code} <span style="color:#9aa3ad">${d.name}</span></td><td>${d.team.name}</td><td style="text-align:right"><b>${d.pts}</b> pts</td></tr>`).join('')}</table>`;
}

// ---------------- results: XP + session extras ----------------
export function afterSession(g, rows) {
  const race = g.race, sess = S.session || { kind: 'quick' };
  const lines = []; let extra = '';
  const meRow = rows ? rows.find(r => r.car === race.player) : null;
  if (cfg.mode === 'race' && meRow) {
    const pos = meRow.pos, n = rows.length;
    lines.push(['Race finish P' + pos, meRow.retired ? 20 : 40 + (n - pos) * 12]);
    const gained = (meRow.grid || pos) - pos; if (gained > 0) lines.push([`${gained} positions gained`, gained * 15]);
    if (pos === 1 && !meRow.retired) lines.push(['Victory', 200]); else if (pos <= 3 && !meRow.retired) lines.push(['Podium', 80]);
    const fast = race.fastest && race.fastest.code === race.player.code; if (fast) lines.push(['Fastest lap', 50]);
    if (race.player.lastStop && race.player.lastStop < 2.5) lines.push([`Crew mega stop ${race.player.lastStop.toFixed(2)}s`, 30]);
    if (!meRow.pen) lines.push(['Clean race, no penalties', 25]);
    recordRace({ circuit: cfg.circuit, pos, dnf: meRow.retired, fastest: fast, stops: race.player.stops, bestStop: race.player.lastStop || null, kind: sess.kind });
  }
  if (cfg.mode === 'pitwall' && meRow) { lines.push([`Your driver finished P${meRow.pos}`, 30 + (rows.length - meRow.pos) * 8]); if (meRow.pos <= 3) lines.push(['Strategy podium', 60]); }
  if (cfg.mode === 'grandstand' && g.predictions) {
    const pr = g.predictions, win = rows[0];
    const sc = race.control.some(m => /SAFETY CAR DEPLOYED|VIRTUAL SAFETY CAR DEPLOYED/.test(m.text));
    lines.push(['Watched the race', 30]);
    if (pr.winner) lines.push([pr.winner === win.code ? `Called the winner (${win.code})` : `Winner pick ${pr.winner} (it was ${win.code})`, pr.winner === win.code ? 100 : 0]);
    if (pr.fastest) lines.push([race.fastest && pr.fastest === race.fastest.code ? `Called the fastest lap (${pr.fastest})` : `Fastest lap pick ${pr.fastest}`, race.fastest && pr.fastest === race.fastest.code ? 60 : 0]);
    if (pr.sc != null) lines.push([pr.sc === sc ? 'Safety car call correct' : 'Safety car call wrong', pr.sc === sc ? 40 : 0]);
    profile.stats.predictions++;
  }
  if (sess.kind === 'champ' && rows && cfg.mode === 'race') { extra += champAfterRace(g, rows); lines.push(['Championship round', 40]); }
  if (race.scenarioResult) {
    const sr = race.scenarioResult, id = sess.scenario;
    const rank = { gold: 3, silver: 2, bronze: 1 };
    if (sr.medal) { lines.push([`${sr.medal[0].toUpperCase() + sr.medal.slice(1)} medal`, { gold: 250, silver: 150, bronze: 80 }[sr.medal]]); if (!profile.medals[id] || rank[sr.medal] > rank[profile.medals[id]]) profile.medals[id] = sr.medal; }
    else lines.push(['Scenario attempted', 20]);
    profile.stats.scenarios++;
  }
  if (cfg.mode === 'hotlap') {
    const best = race.player.best, prev = profile.bests[cfg.circuit] ?? Infinity;
    if (best < prev) { profile.bests[cfg.circuit] = best; lines.push(['New personal best ' + fmt(best), isFinite(prev) ? 60 : 30]); }
    lines.push(['Laps completed: ' + race.player.lapTimes.length, race.player.lapTimes.length * 5]);
  }
  saveProfile();
  const res = award(lines);
  const li = levelInfo();
  const xpHtml = `<div class="xpbox"><div class="xprow"><b>+${res.xp} XP</b><span>Level ${li.level}</span></div><div class="xpbar"><i style="width:${(li.pct * 100).toFixed(0)}%"></i></div>
    ${res.lines.filter(l => l[1] > 0 || l[0].includes('pick') || l[0].includes('wrong')).map(l => `<div class="xpl"><span>${l[0]}</span><span>${l[1] ? '+' + l[1] : '—'}</span></div>`).join('')}
    ${res.levelUp ? `<div class="lvlup">LEVEL UP! Level ${res.levelUp}${res.unlocked.length ? ' · Unlocked helmet design: ' + res.unlocked.join(', ') : ''}</div>` : ''}</div>`;
  return { xpHtml, extra };
}
