import { CIRCUITS, TEAMS, DIFFICULTY } from './data.js';
import { Race, fmt } from './race.js';
import { $, isTouch, store, hex } from './util';
import { cfg, saveCfg, sound, input, getTrack, S } from './ctx';
import { startGame } from './game';
import { profile, saveProfile, levelInfo, PATTERNS, isUnlocked, helmetPreview } from './profile';
import { launch, startQuick, newSeason, startRound, champTable, standings, POINTS } from './session';
import { SCENARIOS, scenarioGoals } from './scenarios';

// ------------------------------------------------------------------ menu
export function circuitSVG(id) {
  const T = getTrack(id);
  let minX = 1e9, maxX = -1e9, minZ = 1e9, maxZ = -1e9;
  for (let i = 0; i < T.N; i++) { minX = Math.min(minX, T.cx[i]); maxX = Math.max(maxX, T.cx[i]); minZ = Math.min(minZ, T.cz[i]); maxZ = Math.max(maxZ, T.cz[i]); }
  const sc = Math.min(88 / (maxX - minX), 62 / (maxZ - minZ));
  const ox = (96 - (maxX - minX) * sc) / 2, oz = (70 - (maxZ - minZ) * sc) / 2;
  let d = '';
  for (let i = 0; i < T.N; i += 4) d += (i ? 'L' : 'M') + ((T.cx[i] - minX) * sc + ox).toFixed(1) + ' ' + ((T.cz[i] - minZ) * sc + oz).toFixed(1);
  const sx = (T.cx[0] - minX) * sc + ox, sz = (T.cz[0] - minZ) * sc + oz;
  return `<svg viewBox="0 0 96 70"><path d="${d}Z" fill="none" stroke="#fff" stroke-width="2.4" stroke-linejoin="round"/><circle cx="${sx}" cy="${sz}" r="3.2" fill="#e10600"/></svg>`;
}

export function seg(key, options, sub) {
  const cur = sub ? cfg[sub][key] : cfg[key];
  return `<div class="seg" data-key="${key}" ${sub ? `data-sub="${sub}"` : ''}>${options.map(([v, l]) => `<button data-v="${v}" class="${String(cur) === String(v) ? 'sel' : ''}">${l}</button>`).join('')}</div>`;
}

let tab = 'play';
const startAudio = () => { sound.start(); sound.setVolume(cfg.volume); try { if (isTouch) document.documentElement.requestFullscreen?.().catch(() => { }); } catch (e) { } };

export function renderMenu(t) {
  if (t) tab = t;
  const m = $('#menu');
  const li = levelInfo();
  m.innerHTML = `<div class="menu-inner">
    <div class="brand"><h1>LIGHTS <span>OUT</span></h1><div class="tag">Cockpit · Pit wall · Grandstand</div></div>
    <div class="topline">
      <div class="tabs">${[['play', 'Play'], ['career', 'Career'], ['driver', 'Driver']].map(([k, l]) => `<button data-tab="${k}" class="${tab === k ? 'sel' : ''}">${l}</button>`).join('')}</div>
      <div class="lvl"><canvas id="miniHelmet" width="64" height="48"></canvas><div><b>${cfg.name}</b> · Level ${li.level}<div class="xpbar sm"><i style="width:${(li.pct * 100).toFixed(0)}%"></i></div><small>${profile.xp} XP · next level at ${li.next}</small></div></div>
    </div>
    <div id="tabBody"></div>
  </div>`;
  m.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => renderMenu(b.dataset.tab));
  helmetPreview($('#miniHelmet'), profile.helmet, cfg.num);
  const body = $('#tabBody');
  if (tab === 'play') renderPlay(body);
  else if (tab === 'career') renderCareer(body);
  else renderDriver(body);
}

function bindSegs(root) {
  root.querySelectorAll('.seg').forEach(sg => sg.querySelectorAll('button').forEach(b => b.onclick = () => {
    let v = b.dataset.v; if (v === 'true') v = true; else if (v === 'false') v = false;
    if (sg.dataset.sub) cfg[sg.dataset.sub][sg.dataset.key] = v; else cfg[sg.dataset.key] = v;
    saveCfg(); sg.querySelectorAll('button').forEach(x => x.classList.toggle('sel', x === b));
    if (sg.dataset.rerender) renderMenu();
  }));
  root.querySelectorAll('[data-range]').forEach(r => r.oninput = () => {
    cfg[r.dataset.range] = +r.value; saveCfg();
    const lbl = r.parentElement.querySelector('b'); if (lbl) lbl.textContent = r.dataset.range === 'gridPos' ? 'P' + r.value : r.value;
  });
}
const circuitCards = () => `<div class="circuits">${CIRCUITS.map(c => { const t = getTrack(c.id); return `<button class="circuit ${cfg.circuit === c.id ? 'sel' : ''}" data-circuit="${c.id}">${circuitSVG(c.id)}<div><b>${c.name}</b><small>${c.country} · ${(t.L / 1000).toFixed(2)} km · ${t.corners.length} turns</small><small>${c.blurb}</small></div></button>`; }).join('')}</div>`;

// ---------------- PLAY ----------------
function renderPlay(body) {
  const modes = [
    ['race', 'Cockpit', 'Quick race', 'Drive from the helmet cam. Optional qualifying, start lights, energy deployment, pit stops, safety cars and rivals who fight back.'],
    ['pitwall', 'Pit wall', 'Strategy', 'Be the race engineer. Call the stops, manage tyres and energy, react to rain, and run the pit crew.'],
    ['grandstand', 'Spectator', 'Grandstand', 'Take a seat in the crowd. Cars screaming past, the big screen, live commentary, and your race predictions.'],
    ['hotlap', 'Time trial', 'Hot lap', 'Just you, the track and your ghost. Learn the braking points and chase purple sectors.'],
  ];
  const mode = cfg.mode === 'quali' ? 'race' : cfg.mode;
  const racing = mode !== 'hotlap';
  body.innerHTML = `<p class="lead">Feel a 2026 Grand Prix from the driver's seat, the pit wall and the grandstand. Original teams and circuits, real race-craft: active aero, Overtake Mode, tyre strategy, rain and safety cars.</p>
    <div class="modes">${modes.map(([id, k, t, p]) => `<button class="mode ${mode === id ? 'sel' : ''}" data-mode="${id}"><div class="k">${k}</div><h3>${t}</h3><p>${p}</p></button>`).join('')}</div>
    <div class="section"><h4>Circuit</h4>${circuitCards()}</div>
    <div class="section"><h4>${mode === 'hotlap' ? 'Session' : 'Race setup'}</h4><div class="opts">
      ${racing ? `<div class="opt"><label>Laps: <b>${cfg.laps}</b> <span style="color:#777">(tyre wear is scaled to race length)</span></label><input type="range" min="3" max="25" value="${cfg.laps}" data-range="laps"></div>
      <div class="opt"><label>Opponents: <b>${cfg.opponents}</b></label><input type="range" min="5" max="19" value="${cfg.opponents}" data-range="opponents"></div>
      <div class="opt"><label>AI difficulty</label>${seg('difficulty', Object.entries(DIFFICULTY).map(([k, v]) => [k, v.name]))}</div>
      <div class="opt"><label>Weather</label>${seg('weather', [['dry', 'Dry'], ['changeable', 'Changeable'], ['wet', 'Wet']])}</div>
      ${mode === 'race' ? `<div class="opt"><label>Qualifying</label>${seg('quali', [[true, 'One-lap qualifying'], [false, 'Pick grid slot']])}</div>
      <div class="opt"><label>Grid position (if not qualifying): <b>P${cfg.gridPos}</b></label><input type="range" min="1" max="20" value="${cfg.gridPos}" data-range="gridPos"></div>` : ''}
      ${mode !== 'grandstand' ? `<div class="opt"><label>Starting tyre</label>${seg('startTyre', [['S', 'Soft'], ['M', 'Medium'], ['H', 'Hard']])}</div>` : ''}
      <div class="opt"><label>Incidents (safety cars)</label>${seg('incidents', [['off', 'Off'], ['low', 'Low'], ['normal', 'Normal'], ['high', 'High']])}</div>
      ${mode !== 'grandstand' ? `<div class="opt"><label>Pit crew mini-game</label>${seg('pitGame', [[true, 'On'], [false, 'Off']])}</div>` : ''}` : ''}
      ${mode !== 'grandstand' ? `<div class="opt"><label>Your team</label>${teamPicker()}</div>` : ''}
    </div></div>
    ${mode === 'race' || mode === 'hotlap' ? assistsHTML() : ''}
    <div class="section"><h4>Display</h4><div class="opts">
      <div class="opt"><label>Graphics</label>${seg('quality', [['auto', 'Auto'], ['low', 'Low'], ['medium', 'Medium'], ['high', 'High']])}</div>
      <div class="opt"><label>Team radio voice</label>${seg('voice', [[true, 'On'], [false, 'Off']])}</div>
      ${!isTouch ? `<div class="opt"><label>Rear-view mirror</label>${seg('mirror', [[true, 'On'], [false, 'Off']])}</div>` : ''}
    </div></div>
    <div class="go"><button class="btn" id="start">${{ pitwall: 'Go to the pit wall', hotlap: 'Start hot lap', grandstand: 'Take your seat', race: cfg.quali ? 'Go to qualifying' : 'Start race' }[mode]}</button><span style="color:#9aa3ad;font-size:14px">${CIRCUITS.find(c => c.id === cfg.circuit).name} · ${mode === 'hotlap' ? 'unlimited laps' : cfg.laps + ' laps'} · your best lap ${fmt(profile.bests[cfg.circuit] ?? store.get('best_' + cfg.circuit, Infinity))}</span></div>
    ${helpHTML()}`;
  body.querySelectorAll('[data-mode]').forEach(b => b.onclick = () => { cfg.mode = b.dataset.mode; saveCfg(); renderMenu(); });
  body.querySelectorAll('[data-circuit]').forEach(b => b.onclick = () => { cfg.circuit = b.dataset.circuit; saveCfg(); renderMenu(); });
  bindTeams(body); bindSegs(body);
  $('#start').onclick = () => {
    startAudio();
    cfg.mode = mode; saveCfg();
    if (mode === 'race') startQuick();
    else launch({}, { kind: mode === 'grandstand' ? 'grandstand' : 'quick' });
  };
}
function teamPicker() { return `<div class="teams">${TEAMS.map(t => `<button data-team="${t.id}" title="${t.name}" class="${cfg.team === t.id ? 'sel' : ''}" style="background:linear-gradient(135deg, ${hex(t.color)} 60%, ${hex(t.accent)} 60%)"></button>`).join('')}</div><small style="color:#9aa3ad">${TEAMS.find(t => t.id === cfg.team).name}</small>`; }
function bindTeams(root) { root.querySelectorAll('[data-team]').forEach(b => b.onclick = () => { cfg.team = b.dataset.team; saveCfg(); renderMenu(); }); }
function assistsHTML() {
  return `<div class="section"><h4>Driving assists</h4><div class="opts">
      <div class="opt"><label>Braking assist</label>${seg('brake', [[true, 'On'], [false, 'Off']], 'assist')}</div>
      <div class="opt"><label>Racing line</label>${seg('line', [['off', 'Off'], ['brake', 'Corners only'], ['full', 'Full']], 'assist')}</div>
      <div class="opt"><label>Steering assist</label>${seg('steer', [[true, 'On'], [false, 'Off']], 'assist')}</div>
      <div class="opt"><label>Traction control</label>${seg('tc', [[true, 'On'], [false, 'Off']], 'assist')}</div>
      <div class="opt"><label>Anti-lock brakes</label>${seg('abs', [[true, 'On'], [false, 'Off']], 'assist')}</div>
      <div class="opt"><label>Gears</label>${seg('autoGear', [[true, 'Automatic'], [false, 'Manual (Q/E)']], 'assist')}</div>
      ${isTouch ? `<div class="opt"><label>Auto-throttle (touch)</label>${seg('autoThrottle', [[true, 'On'], [false, 'Off']], 'assist')}</div>` : ''}
    </div></div>`;
}
function helpHTML() {
  return `<div class="help">${isTouch ? 'Touch: drag the left pad to steer, right pedals for throttle and brake. Buttons for Boost, Overtake, Recharge and Box. Play in landscape.' : `Keyboard: <kbd>↑</kbd>/<kbd>W</kbd> throttle · <kbd>↓</kbd>/<kbd>S</kbd> brake · <kbd>←</kbd><kbd>→</kbd> steer · <kbd>Space</kbd> boost (hold) · <kbd>O</kbd> overtake mode · <kbd>R</kbd> recharge mode · <kbd>P</kbd> box · <kbd>C</kbd> camera · <kbd>L</kbd> racing line · <kbd>Esc</kbd> pause. A gamepad works too (RT/LT, left stick, A boost, X overtake, B box, Y camera).`}</div>`;
}

// ---------------- CAREER ----------------
function renderCareer(body) {
  const ch = profile.champ;
  const active = ch && !ch.done;
  const medals = profile.medals;
  const count = k => Object.values(medals).filter(x => x === k).length;
  body.innerHTML = `
    <div class="section"><h4>Championship</h4><div class="champ">${active ? champActive(ch) : champNew(ch)}</div></div>
    <div class="section"><h4>Take the Wheel · ${count('gold')} gold · ${count('silver')} silver · ${count('bronze')} bronze</h4>
      <p class="lead" style="margin-top:0">Real race moments, dropped straight into the action. Earn medals and XP.</p>
      <div class="scen">${SCENARIOS.map(sc => {
        const md = medals[sc.id];
        return `<div class="scard"><div class="stop"><span class="stag">${sc.tag}</span>${md ? `<span class="smedal ${md}">${md.toUpperCase()}</span>` : ''}</div>
          <h3>${sc.title}</h3><small>${CIRCUITS.find(c => c.id === sc.circuit).name} · ${sc.mode === 'pitwall' ? 'Pit wall' : sc.mode === 'hotlap' ? 'Time trial' : 'Cockpit'}</small>
          <p>${sc.brief}</p><ul>${scenarioGoals(sc, getTrack(sc.circuit)).map(g => `<li>${g}</li>`).join('')}</ul>
          <button class="btn sm" data-scen="${sc.id}">Play</button></div>`;
      }).join('')}</div></div>
    ${assistsHTML()}`;
  bindSegs(body); bindTeams(body);
  body.querySelectorAll('[data-scen]').forEach(b => b.onclick = () => {
    const sc = SCENARIOS.find(x => x.id === b.dataset.scen);
    startAudio();
    launch(Object.assign({ circuit: sc.circuit, mode: sc.mode, scenario: sc, quali: false, opponents: 11, gridPos: 8, incidents: 'normal', weather: 'dry', laps: 5 }, sc.settings), { kind: 'scenario', scenario: sc.id });
  });
  const ns = $('#newSeason');
  if (ns) ns.onclick = () => {
    newSeason({ length: cfg.seasonLength || 'short', laps: cfg.seasonLaps || 5, qualify: cfg.seasonQuali !== false, weather: cfg.seasonWeather || 'real', opponents: cfg.opponents });
    renderMenu('career');
  };
  const go = $('#goRound'); if (go) go.onclick = () => { startAudio(); startRound(); };
  const ab = $('#abandon');
  if (ab) ab.onclick = () => { if (ab.dataset.sure) { profile.champ = null; saveProfile(); renderMenu('career'); } else { ab.dataset.sure = 1; ab.textContent = 'Tap again to abandon'; } };
}
function champNew(ch) {
  return `<div class="champ-new">${ch && ch.done ? `<div class="champ-last"><b>Last season</b>${champTable(true)}</div>` : ''}
    <p class="lead" style="margin:0 0 10px">A season of Grands Prix with qualifying, points (25-18-15-12-10-8-6-4-2-1) and a title to win. Titles won: <b>${profile.titles}</b></p>
    <div class="opts">
      <div class="opt"><label>Season length</label>${seg('seasonLength', [['short', '3 rounds'], ['full', '6 rounds']])}</div>
      <div class="opt"><label>Laps per race: <b>${cfg.seasonLaps || 5}</b></label><input type="range" min="3" max="15" value="${cfg.seasonLaps || 5}" data-range="seasonLaps"></div>
      <div class="opt"><label>Qualifying</label>${seg('seasonQuali', [[true, 'On'], [false, 'Off']])}</div>
      <div class="opt"><label>Weather</label>${seg('seasonWeather', [['real', 'Realistic (rain possible)'], ['dry', 'Always dry']])}</div>
      <div class="opt"><label>AI difficulty</label>${seg('difficulty', Object.entries(DIFFICULTY).map(([k, v]) => [k, v.name]))}</div>
      <div class="opt"><label>Your team</label>${teamPicker()}</div>
    </div>
    <div class="go"><button class="btn" id="newSeason">Start a new season</button></div></div>`;
}
function champActive(ch) {
  const st = standings(ch); const myPos = st.drivers.findIndex(d => d.me) + 1;
  return `<div class="champ-grid"><div><div class="cal">${ch.rounds.map((r, i) => {
      const res = ch.results[i]; const mine = res && res.find(x => x.code === 'ME');
      return `<div class="round ${i === ch.round ? 'next' : i < ch.round ? 'done' : ''}"><span>R${i + 1}</span><b>${r.name}</b><small>${r.weather === 'dry' ? 'Dry' : r.weather === 'wet' ? 'Wet' : 'Changeable'}</small><em>${mine ? 'P' + mine.pos + ' · ' + mine.pts + ' pts' : i === ch.round ? 'NEXT' : ''}</em></div>`;
    }).join('')}</div>
    <div class="go"><button class="btn" id="goRound">Round ${ch.round + 1}: ${ch.qualify ? 'qualifying' : 'race'}</button><button class="btn ghost" id="abandon">Abandon season</button></div>
    <p style="color:#9aa3ad;font-size:13px">${TEAMS.find(t => t.id === ch.team).name} · ${ch.laps} laps per race · ${DIFFICULTY[ch.difficulty].name} AI · You are P${myPos} with ${ch.points.ME} pts</p></div>
    <div>${champTable(true)}</div></div>`;
}

// ---------------- DRIVER ----------------
function renderDriver(body) {
  const h = profile.helmet, s = profile.stats, li = levelInfo();
  body.innerHTML = `<div class="driver-grid">
    <div class="section"><h4>Helmet designer</h4><div class="helm">
      <canvas id="helmPrev" width="360" height="270"></canvas>
      <div class="helm-ctl">
        <div class="opt"><label>Colours</label><div style="display:flex;gap:8px"><input type="color" id="hc1" value="${h.base}"><input type="color" id="hc2" value="${h.second}"><input type="color" id="hc3" value="${h.third}"></div></div>
        <div class="opt"><label>Design</label><div class="seg pats">${PATTERNS.map(p => `<button data-pat="${p.id}" class="${h.pattern === p.id ? 'sel' : ''}" ${isUnlocked(p.id) ? '' : 'disabled'}>${p.name}${isUnlocked(p.id) ? '' : ' · Lv ' + p.level}</button>`).join('')}</div></div>
        <div class="opt"><label>Race number</label><input type="text" id="hnum" value="${cfg.num || 1}" maxlength="2" style="width:70px"></div>
      </div></div></div>
    <div class="section"><h4>Driver</h4><div class="opts">
      <div class="opt"><label>Name and 3-letter code</label><div style="display:flex;gap:6px"><input type="text" id="nm" value="${cfg.name}" maxlength="18" style="flex:1"><input type="text" id="cd" value="${cfg.code}" maxlength="3" style="width:64px;text-transform:uppercase"></div></div>
      <div class="opt"><label>Team</label>${teamPicker()}</div>
    </div>
    <h4 style="margin-top:20px">Career stats</h4>
    <div class="stats">${[['Level', li.level], ['XP', profile.xp], ['Races', s.races], ['Wins', s.wins], ['Podiums', s.podiums], ['Poles', s.poles], ['Fastest laps', s.fastestLaps], ['Best finish', s.bestFinish ? 'P' + s.bestFinish : '—'], ['Titles', profile.titles], ['Best pit stop', s.bestStop ? s.bestStop.toFixed(2) + 's' : '—'], ['Scenarios', s.scenarios], ['Predictions', s.predictions]].map(([k, v]) => `<div class="stat"><small>${k}</small><b>${v}</b></div>`).join('')}</div>
    <h4 style="margin-top:14px">Personal bests</h4>
    <div class="stats">${CIRCUITS.map(c => `<div class="stat"><small>${c.name}</small><b>${fmt(profile.bests[c.id] ?? store.get('best_' + c.id, Infinity))}</b></div>`).join('')}</div>
    ${profile.history.length ? `<h4 style="margin-top:14px">Recent races</h4><div class="hist">${profile.history.slice(0, 8).map(r => `<div><b>${r.dnf ? 'DNF' : 'P' + r.pos}</b> ${CIRCUITS.find(c => c.id === r.circuit)?.name || ''} <small>${r.kind === 'champ' ? 'Championship' : r.kind === 'scenario' ? 'Scenario' : 'Quick race'}${r.fastest ? ' · fastest lap' : ''}</small></div>`).join('')}</div>` : ''}
    </div></div>`;
  const prev = () => { helmetPreview($('#helmPrev'), profile.helmet, cfg.num); helmetPreview($('#miniHelmet'), profile.helmet, cfg.num); };
  prev();
  ['hc1', 'hc2', 'hc3'].forEach((id, i) => $('#' + id).oninput = e => { profile.helmet[['base', 'second', 'third'][i]] = e.target.value; saveProfile(); prev(); });
  body.querySelectorAll('[data-pat]').forEach(b => b.onclick = () => { profile.helmet.pattern = b.dataset.pat; saveProfile(); body.querySelectorAll('[data-pat]').forEach(x => x.classList.toggle('sel', x === b)); prev(); });
  $('#hnum').oninput = e => { const n = parseInt(e.target.value, 10); if (n >= 0 && n < 100) { cfg.num = n; saveCfg(); prev(); } };
  $('#nm').oninput = e => { cfg.name = e.target.value || 'You'; saveCfg(); };
  $('#cd').oninput = e => { cfg.code = (e.target.value || 'YOU').toUpperCase(); saveCfg(); };
  bindTeams(body);
}
