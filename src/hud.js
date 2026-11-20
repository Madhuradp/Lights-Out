import { COMPOUNDS, PUSH_LEVELS } from './data.js';
import { fmt } from './race.js';
import { PlayerCar, PHYS } from './physics.js';
import { $, html, txt, isTouch, hex, clamp, tyreBadge } from './util';
import { cfg, sound, input, S, isSolo } from './ctx';
import { buildGrandstandHTML, setupGrandstand, updateGrandstand } from './grandstand';
import { seg } from './menu';
import { flash } from './game';
import { closePitMenu } from './pitstop';
import { showResults, speak } from './screens';
import { label, keyName, bindings } from './controls.js';
import { updateCoach } from './coach.js';

// ------------------------------------------------------------------ HUD
export function buildHUD(g) {
  const hud = $('#hud');
  const race = g.race; const pw = cfg.mode === 'pitwall', gs = cfg.mode === 'grandstand', ai = pw || gs;
  hud.innerHTML = `
    <div class="tower" id="tower"><div class="hd">${pw ? 'TIMING' : 'LAP'} <span id="towerMode">INT</span></div><div id="rows"></div></div>
    <div class="topc"><div class="chip"><small>LAP</small><span id="lapc">1/${race.laps}</span></div>${!isSolo() && !gs ? '<div class="chip"><span class="posbig" id="posc">P1</span></div>' : ''}<div class="chip hidden" id="flagc"></div></div>
    ${ai ? '' : `<div class="lapinfo"><div class="ln"><span>LAP TIME</span><b id="curl">0:00.000</b></div><div class="sectors" id="secs"><div></div><div></div><div></div></div><div class="ln"><span>LAST</span><span id="lastl">--</span></div><div class="ln"><span>BEST</span><span id="bestl">--</span></div><div class="delta" id="delta"></div></div>
    <div class="tyrebox" id="tyrebox"></div>
    <div class="topbtns"><button class="hbtn pe" id="bHelp" title="Controls (${keyName(bindings().help[0] || 'KeyH')})">?</button><button class="hbtn pe" id="bCam">CAM</button><button class="hbtn pe" id="bLine">LINE</button><button class="hbtn pe" id="bPause">II</button></div>`}
    <div id="mirrorL" class="mirror" style="display:none"></div><div id="mirrorR" class="mirror" style="display:none"></div>
    <div id="coach" class="coach hidden"></div>
    <div class="rc" id="rc"></div>
    <div id="bannerHost"></div>
    <div id="radioHost"></div>
    <div class="battle hidden" id="battle"></div>
    <div class="lights hidden" id="lights">${[0, 1, 2, 3, 4].map(() => '<div class="col"><i></i><i></i></div>').join('')}</div>
    ${ai ? '' : `<div class="wheel" id="wheel"><div class="grip l"></div><div class="grip r"></div><div class="body"></div>
      <div class="leds" id="leds">${Array.from({ length: 15 }, () => '<i></i>').join('')}</div>
      <div class="batt"><i id="wbatt"></i></div>
      <div class="flagl" id="flagL"><i></i><i></i><i></i></div><div class="flagr" id="flagR"><i></i><i></i><i></i></div>
      <div class="screen" id="wscreen">
        <div class="pg pg0 on"><div class="spd"><small>KM/H</small><span id="wspd">0</span></div><div class="gear" id="wgear">N</div><div class="dl"><small id="wdlL">DELTA</small><span id="wdl">-</span></div></div>
        <div class="pg pg1"><div class="ptitle">ENERGY</div><div class="erow"><small>BATTERY</small><b id="eBatt">-</b></div><div class="erow"><small>DEPLOY / LAP</small><b id="eDep">-</b></div><div class="erow"><small>HARVEST / LAP</small><b id="eHarv">-</b></div><div class="erow"><small>OVERTAKE</small><b id="eOT">-</b></div></div>
        <div class="pg pg2"><div class="ptitle">TYRES · <span id="tComp">-</span></div><div class="tgrid" id="tGrid"><span></span><span></span><span></span><span></span></div><div class="erow"><small>LIFE</small><b id="tLife">-</b><small>AGE</small><b id="tAge">-</b></div></div>
        <div class="pgdots"><i></i><i></i><i></i></div>
      </div>
      <div class="tyrew" id="wtyre"><i></i><i></i><i></i><i></i></div>
      <div class="modes"><span class="aero" id="mAero">STRAIGHT</span><span class="ot" id="mOT">OVERTAKE</span><span class="boost" id="mBoost">BOOST</span><span class="rech" id="mRech">RECHARGE</span><span class="lim" id="mLim">PIT</span></div></div>
    <canvas class="minimap" id="minimap" width="340" height="300"></canvas>`}
    ${!ai ? `<div id="touch" class="${isTouch ? '' : 'hidden'} ${cfg.controls.lefty ? 'lefty' : ''} steer-${cfg.controls.steerMode}" style="--bs:${cfg.controls.btnScale}">
      <div class="pad steerpad" id="steerpad"><div class="knob" id="knob"></div><div class="lbl">STEER</div></div>
      <div class="pad steerbtns"><button class="sbtn" id="sLeft">◀</button><button class="sbtn" id="sRight">▶</button></div>
      <div class="pad tiltind" id="tiltind"><i id="tiltbar"></i><div class="lbl">TILT TO STEER</div></div>
      <div class="pad pedal brk" id="pBrk">BRAKE</div><div class="pad pedal thr" id="pThr">THROTTLE</div>
      <div class="pad tbtns"><button class="hbtn boost" id="tBoost">BOOST</button><button class="hbtn ot" id="tOT">OT</button><button class="hbtn rech" id="tRech">RECHG</button><button class="hbtn box" id="tBox">BOX</button></div>
      ${!cfg.assist.autoGear ? '<div class="pad gearbtns"><button class="hbtn" id="gUp">▲</button><button class="hbtn" id="gDn">▼</button></div>' : ''}
    </div>
    ${!isTouch ? `<div class="hint" id="kbhint">${kbHint()}</div>` : ''}` : ''}
    ${pw ? buildPitwallHTML(g) : ''}${gs ? buildGrandstandHTML(g) : ''}
    <div id="pitmenuHost"></div><div id="pitgameHost"></div><div id="overlayHost"></div>
    <div class="rotate ${isTouch ? 'need' : ''}"><div><h2 style="font-style:italic">Turn your phone sideways</h2><p style="color:#9aa3ad">The cockpit and pit wall are built for landscape.</p></div></div>`;
  // FX
  $('#fx').innerHTML = `<canvas id="visor"></canvas><div id="gforce"></div><div id="flash"></div>`;
  g.visor = $('#visor'); g.visorCtx = g.visor.getContext('2d');
  const rs = () => { g.visor.width = innerWidth * 0.5; g.visor.height = innerHeight * 0.5; };
  rs(); addEventListener('resize', rs);

  // tower rows
  const rows = $('#rows');
  g.rowEls = new Map();
  for (const c of race.cars) {
    const r = document.createElement('div'); r.className = 'row' + (c === race.player ? ' me' : '');
    r.innerHTML = `<span class="p"></span><span class="tc" style="background:${hex(c.team.color)}"></span><span class="c">${c.code}</span><span class="g"></span><span class="t"></span>`;
    rows.appendChild(r); g.rowEls.set(c, r);
  }
  g.towerMode = 'int';
  $('#tower').classList.add('pe');
  $('#tower').onclick = () => { g.towerMode = g.towerMode === 'int' ? 'gap' : 'int'; $('#towerMode').textContent = g.towerMode === 'int' ? 'INT' : 'LEADER'; };

  if (gs) setupGrandstand(g);
  else if (!pw) {
    $('#bCam').onclick = () => input.press('cam');
    $('#bHelp').onclick = () => input.press('help');
    if (isTouch) $('#wscreen').onclick = () => input.press('page');
    $('#bLine').onclick = () => input.press('line');
    $('#bPause').onclick = () => input.press('pause');
    setupTouch(g);
    // minimap base
    drawMinimapBase(g, $('#minimap'));
  } else setupPitwall(g);
}

function kbHint() {
  const k = a => `<kbd>${label(a, 'kb')}</kbd>`;
  return `${k('throttle')}${k('brake')}${k('left')}${k('right')} drive · ${k('boost')} boost · ${k('ot')} overtake · ${k('recharge')} recharge · ${k('box')} box · ${k('help')} all controls`;
}

export function setupTouch(g) {
  if (!isTouch) return;
  const pad = $('#steerpad'), knob = $('#knob');
  let sid = null, sx = 0;
  const w = () => pad.getBoundingClientRect().width;
  pad.addEventListener('touchstart', e => { const t = e.changedTouches[0]; sid = t.identifier; const r = pad.getBoundingClientRect(); sx = r.left + r.width / 2; move(t); e.preventDefault(); }, { passive: false });
  const move = t => { const dx = t.clientX - sx; const v = clamp(dx / (w() * 0.42), -1, 1); input.touch.steer = -v; input.touch.steerActive = true; knob.style.transform = `translateX(${v * w() * 0.38}px)`; };
  pad.addEventListener('touchmove', e => { for (const t of e.changedTouches) if (t.identifier === sid) move(t); e.preventDefault(); }, { passive: false });
  const end = e => { for (const t of e.changedTouches) if (t.identifier === sid) { sid = null; input.touch.steer = 0; input.touch.steerActive = false; knob.style.transform = ''; } };
  pad.addEventListener('touchend', end); pad.addEventListener('touchcancel', end);
  const pedal = (el, key) => {
    el.addEventListener('touchstart', e => { input.touch[key] = 1; el.classList.add('down'); e.preventDefault(); }, { passive: false });
    const up = e => { input.touch[key] = 0; el.classList.remove('down'); };
    el.addEventListener('touchend', up); el.addEventListener('touchcancel', up);
  };
  pedal($('#pThr'), 'throttle'); pedal($('#pBrk'), 'brake');
  const tb = $('#tBoost');
  tb.addEventListener('touchstart', e => { input.touch.boost = true; e.preventDefault(); }, { passive: false });
  tb.addEventListener('touchend', () => input.touch.boost = false);
  const tap = (id, a) => $(id).addEventListener('touchstart', e => { input.press(a); e.preventDefault(); }, { passive: false });
  tap('#tOT', 'ot'); tap('#tRech', 'recharge'); tap('#tBox', 'box');
  if ($('#gUp')) { tap('#gUp', 'shiftUp'); tap('#gDn', 'shiftDown'); }
  const hold = (el, key) => { el.addEventListener('touchstart', e => { input.touch[key] = true; el.classList.add('down'); e.preventDefault(); }, { passive: false }); const up = () => { input.touch[key] = false; el.classList.remove('down'); }; el.addEventListener('touchend', up); el.addEventListener('touchcancel', up); };
  hold($('#sLeft'), 'left'); hold($('#sRight'), 'right');
  input.settings.autoThrottle = cfg.assist.autoThrottle;
  input.settings.steerSens = cfg.controls.steerSens; input.settings.steerMode = cfg.controls.steerMode;
  if (cfg.controls.steerMode === 'tilt') input.enableTilt();
}

export function drawMinimapBase(g, cv) {
  const T = g.T; const ctx = cv.getContext('2d');
  let minX = 1e9, maxX = -1e9, minZ = 1e9, maxZ = -1e9;
  for (let i = 0; i < T.N; i++) { minX = Math.min(minX, T.cx[i]); maxX = Math.max(maxX, T.cx[i]); minZ = Math.min(minZ, T.cz[i]); maxZ = Math.max(maxZ, T.cz[i]); }
  const W = cv.width, H = cv.height, pad = 22;
  const sc = Math.min((W - pad * 2) / (maxX - minX), (H - pad * 2) / (maxZ - minZ));
  const ox = (W - (maxX - minX) * sc) / 2, oz = (H - (maxZ - minZ) * sc) / 2;
  g.mapXf = (x, z) => [(x - minX) * sc + ox, (z - minZ) * sc + oz];
  const base = document.createElement('canvas'); base.width = W; base.height = H; const b = base.getContext('2d');
  b.lineJoin = 'round'; b.lineCap = 'round';
  b.strokeStyle = 'rgba(255,255,255,0.85)'; b.lineWidth = 7; b.beginPath();
  for (let i = 0; i <= T.N; i += 2) { const [x, y] = g.mapXf(T.cx[i % T.N], T.cz[i % T.N]); i ? b.lineTo(x, y) : b.moveTo(x, y); }
  b.stroke();
  // sectors
  const secCol = ['#e10600', '#2bb8f0', '#f5c400'];
  for (let k = 0; k < 3; k++) { b.strokeStyle = secCol[k]; b.lineWidth = 3; b.beginPath(); const i0 = Math.floor(T.N * k / 3), i1 = Math.floor(T.N * (k + 1) / 3); for (let i = i0; i <= i1; i++) { const [x, y] = g.mapXf(T.cx[i % T.N], T.cz[i % T.N]); i === i0 ? b.moveTo(x, y) : b.lineTo(x, y); } b.stroke(); }
  // straight-mode zones
  b.strokeStyle = '#3aa0ff'; b.lineWidth = 2;
  for (const [a, e] of T.zones) { b.beginPath(); let s = a; const end = e < a ? e + T.L : e; for (; s <= end; s += 8) { const o = {}; T.at(s, o); const [x, y] = g.mapXf(o.x + o.nx * 9, o.z + o.nz * 9); s === a ? b.moveTo(x, y) : b.lineTo(x, y); } b.stroke(); }
  const [sx, sy] = g.mapXf(T.cx[0], T.cz[0]); b.fillStyle = '#fff'; b.fillRect(sx - 2, sy - 7, 4, 14);
  g.mapBase = base; g.mapCanvas = cv; g.mapCtx = ctx;
}
export function drawMinimap(g, cv, ctx) {
  if (!cv || !ctx) return;
  ctx.clearRect(0, 0, cv.width, cv.height); ctx.drawImage(g.mapBase, 0, 0);
  const T = g.T, race = g.race; const o = {};
  const draw = (c, r, col, ring) => { T.at(c.s, o); const [x, y] = g.mapXf(o.x + o.nx * c.d, o.z + o.nz * c.d); ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); if (ring) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke(); } };
  for (const c of race.cars) if (c !== g.focus) draw(c, 5, hex(c.team.color), false);
  if (race.scCar) draw(race.scCar, 6, '#ffb000', true);
  draw(g.focus, 8, hex(g.focus.team.color), true);
}

// ---------------- pit wall UI ----------------
export function buildPitwallHTML(g) {
  return `<div class="pw-panel" id="pwp">
    <button class="hbtn pw-toggle" id="pwToggle">PIT WALL ▾</button>
    <h5>Your driver</h5>
    <div id="pwDrv" style="display:flex;align-items:center;gap:8px;margin-bottom:8px"></div>
    <div class="drvcard" id="pwCard"></div>
    <h5>Driver instructions</h5>
    <div class="pw-seg" id="pwPush">${Object.entries(PUSH_LEVELS).map(([k, v]) => `<button data-v="${k}">${v.name}</button>`).join('')}</div>
    <h5>Energy (ERS)</h5>
    <div class="pw-seg three" id="pwEnergy"><button data-v="harvest">Harvest</button><button data-v="balanced">Balanced</button><button data-v="deploy">Deploy</button></div>
    <h5>Pit stop</h5>
    <div class="pw-box" id="pwBox">${Object.keys(COMPOUNDS).map(c => `<button data-c="${c}">${tyreBadge(c)}<span>${COMPOUNDS[c].name.slice(0, 5)}</span></button>`).join('')}</div>
    <button class="boxbtn" id="pwBoxBtn">BOX THIS LAP</button>
    <div style="font-size:12px;color:#9aa3ad;margin-top:6px" id="pwStrat"></div>
    <h5>Weather radar</h5>
    <div class="radar"><canvas id="pwRadar" width="600" height="140"></canvas></div>
    <h5>Track</h5>
    <canvas class="pw-map" id="pwMap" width="600" height="300"></canvas>
    <h5>Team radio</h5>
    <div class="radiolog" id="pwRadio"></div>
    <h5>Sim speed</h5>
    <div class="pw-seg three" id="pwSpeed"><button data-v="1">1x</button><button data-v="2">2x</button><button data-v="4">4x</button></div>
    <div style="display:flex;gap:6px;margin-top:10px"><button class="hbtn" id="pwPause" style="flex:1">PAUSE</button></div>
  </div>
  <div class="pw-cams"><button class="hbtn" data-cam="tv">TV</button><button class="hbtn" data-cam="onboard">ONBOARD</button><button class="hbtn" data-cam="heli">HELI</button><button class="hbtn" data-cam="chase">CHASE</button></div>`;
}
export function setupPitwall(g) {
  const me = g.race.player;
  g.pwSel = me.tyre.c === 'S' ? 'M' : 'H';
  const segSel = (id, val, cb) => { const el = $(id); el.querySelectorAll('button').forEach(b => { b.classList.toggle('sel', b.dataset.v === String(val)); b.onclick = () => { cb(b.dataset.v); el.querySelectorAll('button').forEach(x => x.classList.toggle('sel', x === b)); }; }); };
  segSel('#pwPush', me.push, v => { me.push = v; g.race.radioMsg('eng', v === 'attack' ? 'Push now, push. Everything you have got.' : v === 'conserve' ? 'Lift and coast, look after the tyres.' : v === 'push' ? 'Good pace, push a bit more.' : 'Back to standard mode.'); });
  segSel('#pwEnergy', me.energyMode, v => { me.energyMode = v; });
  segSel('#pwSpeed', 1, v => { g.simSpeed = +v; });
  const boxEls = $('#pwBox').querySelectorAll('button');
  const upd = () => boxEls.forEach(b => b.classList.toggle('sel', b.dataset.c === g.pwSel));
  boxEls.forEach(b => b.onclick = () => { g.pwSel = b.dataset.c; upd(); if (me.pitRequest) me.pitRequest = g.pwSel; }); upd();
  $('#pwBoxBtn').onclick = () => {
    if (me.pit) return;
    if (me.pitRequest) { me.pitRequest = null; g.race.radioMsg('eng', 'Stay out, stay out.'); }
    else { me.pitRequest = g.pwSel; g.race.radioMsg('eng', `Box, box. ${COMPOUNDS[g.pwSel].name} tyres.`); }
  };
  $('#pwPause').onclick = () => input.press('pause');
  $('#pwToggle').onclick = () => $('#pwp').classList.toggle('collapsed');
  if (innerWidth < 900) $('#pwp').classList.add('collapsed');
  document.querySelectorAll('[data-cam]').forEach(b => b.onclick = () => { g.camMode = b.dataset.cam; });
}

export function updatePitwall(g) {
  const me = g.race.player, race = g.race, T = g.T;
  html($('#pwDrv'), `<span class="tc" style="width:6px;height:26px;border-radius:3px;background:${hex(me.team.color)}"></span><div><b style="font-size:17px">${me.name}</b><div style="font-size:12px;color:#9aa3ad">${me.team.name} · #${me.driver.num}</div></div>`);
  const ahead = race.standings[me.pos - 2], behind = race.standings[me.pos];
  const life = Math.round((1 - me.tyre.wear) * 100);
  const lapNo = Math.min(race.laps, Math.max(1, Math.floor(me.dist / T.L) + 1));
  html($('#pwCard'), `
    <div><small>POSITION</small><b>P${me.pos}</b></div>
    <div><small>GAP AHEAD</small><b>${ahead ? '+' + (me.interval || 0).toFixed(1) : '—'}</b></div>
    <div><small>GAP BEHIND</small><b>${behind && !behind.retired ? '-' + Math.max(0, behind.interval || 0).toFixed(1) : '—'}</b></div>
    <div><small>SPEED</small><b>${Math.round(me.v * 3.6)}</b></div>
    <div><small>TYRE</small><b style="display:flex;align-items:center;gap:5px">${tyreBadge(me.tyre.c, 20)} ${me.tyre.age}L</b></div>
    <div><small>TYRE LIFE</small><b style="color:${life < 30 ? '#ff4d4d' : life < 55 ? '#ffd400' : '#19d35a'}">${life}%</b></div>
    <div><small>BATTERY</small><b>${me.battery.toFixed(1)} MJ</b></div>
    <div><small>LAST LAP</small><b style="font-size:14px">${fmt(me.lapTimes[me.lapTimes.length - 1])}</b></div>
    <div><small>DAMAGE</small><b style="color:${me.damage > 0.2 ? '#ff4d4d' : '#19d35a'}">${me.damage > 0.2 ? 'WING' : 'OK'}</b></div>`);
  const btn = $('#pwBoxBtn');
  if (me.pit) { txt(btn, 'IN THE PIT LANE'); btn.classList.remove('armed'); }
  else if (me.pitRequest) { txt(btn, `BOXING FOR ${COMPOUNDS[me.pitRequest].name.toUpperCase()} · TAP TO CANCEL`); btn.classList.add('armed'); }
  else { txt(btn, 'BOX THIS LAP'); btn.classList.remove('armed'); }
  const remaining = race.laps - lapNo;
  const rule = race.laps >= 5 && race.weather.wet < 0.2 && me.usedCompounds.size < 2 && ![...me.usedCompounds].some(x => x === 'I' || x === 'W');
  html($('#pwStrat'), `${remaining} laps to go · Track ${Math.round(race.weather.wet * 100)}% wet · stops: ${me.stops}${rule ? ' · <b style="color:#ffd400">must still use a second dry compound</b>' : ''}${me.lastStop ? ' · last stop ' + me.lastStop.toFixed(2) + 's' : ''}`);
  // radio log
  html($('#pwRadio'), race.radio.slice(0, 12).map(r => `<div><b>${r.from === 'drv' ? me.code : 'ENG'}</b>${r.text}</div>`).join(''));
  // radar
  const cv = $('#pwRadar'), ctx = cv.getContext('2d');
  ctx.clearRect(0, 0, cv.width, cv.height);
  const W = race.weather, now = race.raceTime;
  ctx.fillStyle = 'rgba(255,255,255,0.06)'; ctx.fillRect(0, 0, cv.width, cv.height);
  for (let x = 0; x < cv.width; x++) {
    const t = now + (x / cv.width) * 600;
    let r = W.rain; if (W.plan.length && cfg.weather === 'changeable') { r = 0; for (const p of W.plan) if (t >= p.t) r = p.rain; }
    if (r > 0.02) { ctx.fillStyle = `rgba(${r > 0.7 ? '31,111,224' : '43,176,74'},${0.25 + r * 0.6})`; const h = r * (cv.height - 30); ctx.fillRect(x, cv.height - 22 - h, 1, h); }
  }
  ctx.fillStyle = '#9aa3ad'; ctx.font = '22px sans-serif'; ctx.fillText('now', 6, cv.height - 2); ctx.fillText('+5 min', cv.width / 2 - 30, cv.height - 2); ctx.fillText('+10', cv.width - 44, cv.height - 2);
  ctx.fillStyle = '#fff'; ctx.font = 'bold 24px sans-serif'; ctx.fillText(W.rain > 0.05 ? `Raining · ${Math.round(W.rain * 100)}%` : (W.forecast != null ? `Rain in ~${Math.max(1, Math.round(W.forecast / 60))} min` : 'Dry'), 8, 28);
}

// ------------------------------------------------------------------ HUD update
export function updateHUD(g, dt) {
  const race = g.race, p = race.player, T = g.T, pw = cfg.mode === 'pitwall', gs = cfg.mode === 'grandstand';
  // lap / position
  const lapNo = clamp(Math.floor(p.dist / T.L) + 1, 1, race.laps);
  txt($('#lapc'), cfg.mode === 'quali' ? 'QUALI' : isSolo() ? String(Math.max(1, p.lapTimes.length + 1)) : `${p.finished ? race.laps : lapNo}/${race.laps}`);
  const pc = $('#posc'); if (pc) txt(pc, 'P' + (p.pos || '-'));
  const fc = $('#flagc');
  const flag = race.sc ? 'SAFETY CAR' : race.vsc ? 'VSC' : (race.control[0] && race.control[0].kind === 'yellow' && race.time - race.control[0].t < 8) ? 'YELLOW' : (race.control[0] && race.control[0].kind === 'green' && race.time - race.control[0].t < 6) ? 'GREEN' : (race.weather.rain > 0.1 ? 'RAIN' : '');
  fc.classList.toggle('hidden', !flag);
  fc.className = 'chip ' + (flag ? '' : 'hidden') + (race.sc ? ' flag-sc' : race.vsc ? ' flag-vsc' : flag === 'YELLOW' ? ' flag-yellow' : flag === 'GREEN' ? ' flag-green' : '');
  txt(fc, flag);

  // tower
  if (race.time - g.lastTower > 0.2 && race.standings) {
    g.lastTower = race.time;
    const rowsEl = $('#rows');
    const rowH = innerWidth < 900 || innerHeight < 520 ? 17 : 22;
    const maxRows = Math.max(5, Math.floor((innerHeight * (pw || gs ? 0.9 : 0.62) - 40) / rowH));
    const st = race.standings;
    let show = st;
    if (st.length > maxRows) {
      const me = st.indexOf(g.focus);
      const top = st.slice(0, 3);
      const half = Math.floor((maxRows - 3) / 2);
      let a = Math.max(3, me - half), b = Math.min(st.length, a + maxRows - 3); a = Math.max(3, b - (maxRows - 3));
      show = top.concat(st.slice(a, b));
    }
    const set = new Set(show);
    for (const [c, r] of g.rowEls) r.style.display = set.has(c) ? '' : 'none';
    show.forEach(c => rowsEl.appendChild(g.rowEls.get(c)));
    for (const c of show) {
      const r = g.rowEls.get(c);
      txt(r.children[0], String(c.pos));
      let gt = isSolo() ? fmt(c.best) : (c.pit ? '' : c.finished ? (c.pos === 1 ? 'WINNER' : g.towerMode === 'int' ? c.intText : c.gapText) : (g.towerMode === 'int' ? c.intText : c.gapText));
      if (c.pit && !c.retired) html(r.children[3], '<span class="pit">PIT</span>'); else txt(r.children[3], gt || '');
      const tc = r.children[4]; const col = COMPOUNDS[c.tyre.c].color;
      if (tc._c !== c.tyre.c) { tc._c = c.tyre.c; tc.style.borderColor = col; tc.style.color = col; tc.textContent = c.tyre.c; }
      r.classList.toggle('out', !!c.retired);
      if (pw && c.team === p.team) r.classList.add('mate');
    }
  }

  // banners
  while (race.banners.length) g.bannerQ.push(race.banners.shift());
  if (g.bannerQ.length && (!g.bannerT || race.time - g.bannerT > 2.6)) {
    const b = g.bannerQ.shift(); g.bannerT = race.time;
    $('#bannerHost').innerHTML = `<div class="banner ${b.kind}"><div class="t">${b.title}</div>${b.sub ? `<div class="s">${b.sub}</div>` : ''}</div>`;
  } else if (g.bannerT && race.time - g.bannerT > 2.6 && !g.bannerQ.length) { $('#bannerHost').innerHTML = ''; g.bannerT = 0; }

  // race control
  const rcs = race.control.filter(m => race.time - m.t < 6).slice(0, 2);
  html($('#rc'), rcs.map(m => `<div class="${m.kind}">${m.text}</div>`).join(''));

  // radio
  const pending = race.radio.filter(r => !r.shown).pop();
  if (gs && pending) race.radio.forEach(r => r.shown = true);
  else if (pending && (!g.radioT || race.time - g.radioT > 3.5)) {
    pending.shown = true; g.radioT = race.time; g.radioMsg = pending;
    sound.radio(); speak(pending.text, pending.from);
    // skip stale ones
    race.radio.forEach(r => { if (!r.shown && race.time - r.t > 6) r.shown = true; });
  }
  const rh = $('#radioHost');
  if (g.radioMsg && race.time - g.radioT < 5) html(rh, `<div class="radio"><div class="who"><i></i>RADIO · ${g.radioMsg.from === 'drv' ? p.code : (pw ? 'YOU → ' + p.code : 'ENGINEER')}</div>${g.radioMsg.text}</div>`);
  else html(rh, '');

  // start lights
  const li = $('#lights');
  const showL = race.phase === 'lights' || race.phase === 'grid';
  li.classList.toggle('hidden', !showL);
  if (showL) li.querySelectorAll('.col').forEach((c, k) => c.querySelectorAll('i').forEach(i => i.classList.toggle('on', k < race.lightsOn)));

  if (gs) {
    updateGrandstand(g, dt);
    if ((race.player.finished && race.finishedOrder.length === race.cars.filter(c => !c.retired).length) || (g.finishAt && performance.now() - g.finishAt > 10000)) showResults(g);
    return;
  }
  if (pw) {
    if (race.time - (g.lastPW || 0) > 0.25) { g.lastPW = race.time; updatePitwall(g); }
    if (race.time - g.lastMap > 0.07) { g.lastMap = race.time; const cv = $('#pwMap'); if (!g.mapBase) drawMinimapBase(g, cv); drawMinimap(g, cv, g.mapCtx); }
    if ((race.player.finished && race.finishedOrder.length === race.cars.filter(c => !c.retired).length) || (g.finishAt && performance.now() - g.finishAt > 12000)) showResults(g);
    return;
  }

  if (race.scenarioResult && cfg.mode === 'hotlap') { g.scenT = g.scenT || performance.now(); if (performance.now() - g.scenT > 2000) showResults(g); }
  // lap info
  if (!(p instanceof PlayerCar)) return;
  const cur = race.phase === 'racing' ? race.time - (p.lapStart ?? race.startTime) : 0;
  txt($('#curl'), fmt(cur));
  txt($('#lastl'), p.lapTimes.length ? fmt(p.lapTimes[p.lapTimes.length - 1]) : '--');
  txt($('#bestl'), fmt(p.best));
  const secs = $('#secs').children;
  for (let k = 0; k < 3; k++) { const s = p.curS && p.curS[k]; const cls = s ? s.color : ''; if (secs[k]._c !== cls) { secs[k]._c = cls; secs[k].className = cls; } }
  // delta to best
  let delta = null;
  if (p.bestCp && p.lapCp) { const k = p.lapCp.length - 1; if (k > 0 && p.bestCp[k] !== undefined && p.lapCp[k] !== undefined) delta = p.lapCp[k] - p.bestCp[k]; }
  const de = $('#delta');
  if (delta != null) { txt(de, (delta > 0 ? '+' : '') + delta.toFixed(3)); de.className = 'delta ' + (delta < 0 ? 'neg' : 'pos'); } else { txt(de, ''); }

  // tyre box
  if (race.time - (g.lastTyre || 0) > 0.3) {
    g.lastTyre = race.time;
    const life = Math.round((1 - p.tyre.wear) * 100);
    const temp = p.tyre.temp < 0.6 ? '<span style="color:#3aa0ff">COLD</span>' : p.tyre.temp < 0.85 ? 'WARMING' : 'OK';
    html($('#tyrebox'), `<div class="tl">${tyreBadge(p.tyre.c)}<div style="flex:1"><b>${COMPOUNDS[p.tyre.c].name}</b> · ${p.tyre.age} laps · ${temp}<div class="bars"><i style="width:${life}%;background:${life < 30 ? '#ff4d4d' : life < 55 ? '#ffd400' : '#19d35a'}"></i></div></div><b>${life}%</b></div>
      <div class="tl" style="margin-top:6px;justify-content:space-between"><span>ERS ${p.battery.toFixed(2)} MJ</span><span>${p.damage > 0.15 ? '<b style="color:#ff4d4d">WING DAMAGE</b>' : 'Car OK'}</span></div>
      ${p.pitRequest ? `<div style="margin-top:6px;color:#fff;background:#e10600;border-radius:5px;padding:2px 6px;font-weight:800">BOX THIS LAP · ${COMPOUNDS[p.pitRequest].name}</div>` : ''}
      ${race.trackLimits ? `<div style="margin-top:4px;color:#ffd400">Track limits: ${race.trackLimits}/3</div>` : ''}${p.penalty ? `<div style="color:#ff6b6b">Penalty: +${p.penalty}s</div>` : ''}`);
  }

  // steering wheel
  const wheel = $('#wheel');
  const showWheel = g.camMode === 'cockpit' || g.camMode === 'tcam';
  wheel.style.display = showWheel ? '' : 'none';
  const sp = Math.round(p.v * 3.6);
  txt($('#wspd'), String(sp));
  txt($('#wgear'), p.v < 0.5 && race.phase !== 'racing' ? 'N' : String(p.gear));
  if (isSolo() || delta != null) { txt($('#wdlL'), 'DELTA'); txt($('#wdl'), delta != null ? (delta > 0 ? '+' : '') + delta.toFixed(2) : '-'); }
  else { txt($('#wdlL'), 'GAP'); txt($('#wdl'), p.interval ? '+' + p.interval.toFixed(1) : '-'); }
  if (showWheel) wheel.style.transform = `rotate(${(-p.steer * 90).toFixed(1)}deg)` + (innerWidth < 900 || innerHeight < 520 ? ' scale(0.62)' : '');
  $('#wbatt').style.height = (p.battery / PHYS.battery * 100).toFixed(0) + '%';
  const leds = $('#leds').children; const rr = (p.rpm - 9500) / 2500;
  for (let i = 0; i < 15; i++) { const on = rr * 15 > i; const cl = !on ? '' : i < 5 ? 'g' : i < 10 ? 'r' : 'b'; if (leds[i]._c !== cl) { leds[i]._c = cl; leds[i].className = cl; } }
  const wt = $('#wtyre').children; const wl = 1 - p.tyre.wear; const wc = wl < 0.3 ? '#ff4d4d' : wl < 0.55 ? '#ffd400' : (p.tyre.temp < 0.6 ? '#3aa0ff' : '#19d35a');
  for (const i of wt) if (i._c !== wc) { i._c = wc; i.style.background = wc; }
  // FIA marshalling lights on the wheel (GPS marshalling: the flag for the sector you're in)
  {
    let fl = '';
    if (race.sc || race.vsc) fl = 'sc';
    else if (p.blue) fl = 'blue';
    else {
      const T = g.T;
      const near = race.cars.some(c => c !== p && (c.retired || c.stopped) && ((c.s - p.s + T.L) % T.L) < 450);
      if (near) fl = 'yellow';
      else if (race.control[0] && race.control[0].kind === 'green' && race.time - race.control[0].t < 6) fl = 'green';
    }
    if (race.phase === 'finished' || p.finished) fl = 'chq';
    g.flagLocal = fl;
    const cls = 'flag ' + fl;
    for (const id of ['#flagL', '#flagR']) { const e = $(id); if (e._c !== cls) { e._c = cls; e.className = (id === '#flagL' ? 'flagl ' : 'flagr ') + cls; } }
  }
  // wheel display pages
  {
    const pg = g.wheelPage || 0;
    if (g._pg !== pg) { g._pg = pg; const ps = $('#wscreen').querySelectorAll('.pg'); ps.forEach((e, k) => e.classList.toggle('on', k === pg)); $('#wscreen').querySelectorAll('.pgdots i').forEach((e, k) => e.classList.toggle('on', k === pg)); }
    if (pg === 1) {
      txt($('#eBatt'), p.battery.toFixed(2) + ' MJ'); txt($('#eDep'), (p.deployLap || 0).toFixed(2) + ' MJ'); txt($('#eHarv'), (p.harvestLap || 0).toFixed(2) + ' / ' + PHYS.harvestPerLap);
      txt($('#eOT'), p.otActive ? 'ACTIVE' : race.otAvailable ? 'READY' : '-');
    } else if (pg === 2) {
      txt($('#tComp'), COMPOUNDS[p.tyre.c].name.toUpperCase());
      const base = 70 + p.tyre.temp * 35; const cells = $('#tGrid').children; const offs = [3, 1, 6, 4];
      for (let k = 0; k < 4; k++) { const tc = Math.round(base + offs[k] + (k % 2 ? -1 : 1) * (p.latG || 0) * 2); txt(cells[k], tc + '°'); cells[k].style.background = tc < 85 ? '#1f5fbf' : tc < 112 ? '#138a3c' : '#b8261a'; }
      txt($('#tLife'), Math.round((1 - p.tyre.wear) * 100) + '%'); txt($('#tAge'), (p.tyre.age || 0) + ' L');
    }
  }
  updateCoach(g, dt);
  $('#mAero').classList.toggle('on', p.straightMode);
  $('#mOT').classList.toggle('on', p.otActive); $('#mOT').classList.toggle('avail', race.otAvailable && !p.otActive);
  $('#mBoost').classList.toggle('on', p.boost);
  $('#mRech').classList.toggle('on', p.recharge);
  $('#mLim').classList.toggle('on', !!p.pit);
  // touch buttons state
  if (isTouch) {
    $('#tOT').classList.toggle('on', p.otActive); $('#tOT').disabled = !(race.otAvailable || p.otActive);
    $('#tBoost').classList.toggle('on', p.boost); $('#tRech').classList.toggle('on', p.recharge); $('#tBox').classList.toggle('on', !!p.pitRequest);
    $('#touch').style.display = p.pit || g.pg ? 'none' : '';
    if (cfg.controls.steerMode === 'tilt') { const tb = $('#tiltbar'); if (tb) tb.style.transform = `translateX(${(-p.steer * 45).toFixed(1)}%)`; }
  }
  const kh = $('#kbhint'); if (kh) kh.style.display = race.time > 25 ? 'none' : '';

  // battle graphic
  const b = $('#battle');
  if (cfg.mode === 'race' && race.standings && !p.pit && race.phase === 'racing' && !p.finished) {
    const ahead = race.standings[p.pos - 2], behind = race.standings[p.pos];
    const ia = Math.max(0, p.interval || 0), ib = behind && !behind.retired && !behind.pit ? Math.max(0, behind.interval || 0) : 99;
    if (ahead && ia < 1.2 && !ahead.pit) { b.classList.remove('hidden'); html(b, `<span>${p.code}</span><span class="gap">+${ia.toFixed(1)}</span><span class="vs">to</span><span style="border-left:4px solid ${hex(ahead.team.color)};padding-left:5px">${ahead.code}</span>${race.otAvailable ? '<span class="ot">OT READY</span>' : p.otActive ? '<span class="ot">OT ON</span>' : ''}`); if (ia < 0.5 && race.time - g.hb > 1.1) { g.hb = race.time; sound.heartbeat(); } }
    else if (behind && ib < 0.8) { b.classList.remove('hidden'); html(b, `<span>DEFEND</span><span style="border-left:4px solid ${hex(behind.team.color)};padding-left:5px">${behind.code}</span><span class="gap">-${ib.toFixed(1)}</span>`); if (ib < 0.4 && race.time - g.hb > 1.1) { g.hb = race.time; sound.heartbeat(); } }
    else b.classList.add('hidden');
  } else b.classList.add('hidden');

  // minimap
  if (race.time - g.lastMap > 0.07) { g.lastMap = race.time; drawMinimap(g, g.mapCanvas, g.mapCtx); }

  // results
  if (cfg.mode === 'race' && p.finished && g.finishAt && ((race.finishedOrder.length >= race.cars.filter(c => !c.retired).length && performance.now() - g.finishAt > 4000) || performance.now() - g.finishAt > 20000)) showResults(g);
  if (g.pitMenuOpen) { g.pitMenuT += dt; if (g.pitMenuT > 8) closePitMenu(g); }
}

