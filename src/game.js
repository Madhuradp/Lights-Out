import * as THREE from 'three';
import { buildScenery } from './scenery.js';
import { makeCar, makeSafetyCar } from './cars.js';
import { Race } from './race.js';
import { Particles } from './particles.js';
import { PlayerCar, PHYS } from './physics.js';
import { $, isTouch, clamp, wrapA } from './util';
import { cfg, saveCfg, sound, haptics, input, getTrack, S, isSolo, isAI } from './ctx';
import { buildHUD, updateHUD } from './hud';
import { openPitMenu, closePitMenu, startPitGame, updatePitGame } from './pitstop';
import { showPause, hidePause } from './screens';
import { seatCamera, renderBigScreen } from './grandstand';
import { onQualiDone } from './session';
import { profile, drawHelmet } from './profile';

// ------------------------------------------------------------------ renderer

export function ensureRenderer(quality) {
  if (S.renderer) { S.renderer.setPixelRatio(pixelRatioFor(quality)); S.renderer.shadowMap.enabled = quality === 'high'; return; }
  const canvas = $('#gl');
  S.renderer = new THREE.WebGLRenderer({ canvas, antialias: quality !== 'low', powerPreference: 'high-performance' });
  S.renderer.setPixelRatio(pixelRatioFor(quality));
  S.renderer.toneMapping = THREE.ACESFilmicToneMapping; S.renderer.toneMappingExposure = 1.0;
  S.renderer.outputColorSpace = THREE.SRGBColorSpace;
  S.renderer.shadowMap.enabled = quality === 'high'; S.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  S.camera = new THREE.PerspectiveCamera(70, 1, 0.05, 9000);
  const resize = () => { S.renderer.setSize(innerWidth, innerHeight, false); S.camera.aspect = innerWidth / innerHeight; S.camera.updateProjectionMatrix(); };
  addEventListener('resize', resize); resize();
}
export function pixelRatioFor(q) { const dpr = devicePixelRatio || 1; return Math.min(dpr, q === 'high' ? 2 : q === 'medium' ? 1.5 : q === 'low' ? 1 : (isTouch ? 1.25 : 1.5)); }
export function resolvedQuality() { if (cfg.quality !== 'auto') return cfg.quality; return isTouch ? 'low' : 'medium'; }

// ------------------------------------------------------------------ game setup
export function startGame() {
  $('#menu').classList.add('hidden');
  $('#loading').classList.remove('hidden');
  setTimeout(() => {
    try { buildGame(); } catch (e) { console.error(e); $('#loading').innerHTML = '<div style="padding:20px">Could not start: ' + e.message + '</div>'; return; }
    $('#loading').classList.add('hidden');
    $('#hud').classList.remove('hidden');
  }, 60);
}

export function buildGame() {
  if (S.G) teardown();
  const quality = resolvedQuality();
  ensureRenderer(quality);
  S.scene = new THREE.Scene();
  const T = getTrack(cfg.circuit);
  const scen = buildScenery(T, S.scene, quality);
  const race = new Race(T, { ...cfg, team: cfg.team });
  const g = S.G = { T, scen, race, quality, cars: new Map(), paused: false, camMode: cfg.mode === 'pitwall' ? 'tv' : cfg.mode === 'grandstand' ? 'seat' : cfg.camera, simSpeed: 1, t: 0, lastTower: 0, lastMap: 0, bannerQ: [], radioShown: 0, hud: {}, ghost: null, tvCam: null, kerbT: 0, lockT: 0, hb: 0, prevOpp: new Map(), lineMode: cfg.assist.line };
  // cars
  if (!isAI()) {
    const hc = document.createElement('canvas'); hc.width = 512; hc.height = 256;
    drawHelmet(hc.getContext('2d'), 512, 256, profile.helmet, cfg.num || 1);
    g.helmetTex = new THREE.CanvasTexture(hc); g.helmetTex.colorSpace = THREE.SRGBColorSpace;
  }
  g.particles = new Particles(S.scene, quality);
  g.crew = makeCrew(S.scene);
  g.mirror = cfg.mirror !== false && !isTouch;
  for (const c of race.cars) {
    const v = makeCar(c.team, { shadows: quality === 'high', helmetTex: c.isPlayer && g.helmetTex ? g.helmetTex : null });
    v.setCompound(c.tyre.c); v.compound = c.tyre.c;
    S.scene.add(v.root); g.cars.set(c, v);
  }
  g.sc = makeSafetyCar(); g.sc.root.visible = false; S.scene.add(g.sc.root);
  if (cfg.mode === 'hotlap') {
    const gv = makeCar(race.player.team, {});
    const gm = new THREE.MeshBasicMaterial({ color: 0x6fd3ff, transparent: true, opacity: 0.28, depthWrite: false });
    gv.root.traverse(o => { if (o.isMesh) o.material = gm; });
    gv.root.visible = false; S.scene.add(gv.root); g.ghost = gv;
  }
  buildRacingLine(g);
  buildRain(g);
  buildTVCams(g);
  buildHUD(g);
  haptics.enabled = cfg.haptics;
  g.last = performance.now();
  requestAnimationFrame(loop);
}

export function teardown() {
  if (!S.G) return;
  S.G.dead = true;
  if (S.G.cleanup) S.G.cleanup();
  S.scene.traverse(o => { if (o.geometry) o.geometry.dispose?.(); });
  S.G = null;
}

// racing line ribbons (full and corners-only)
export function buildRacingLine(g) {
  const T = g.T;
  const mk = (onlyCorners) => {
    const pos = [], col = [], idx = [];
    let n = 0;
    for (let i = 0; i <= T.N; i++) {
      const k = i % T.N, k2 = (k + 3) % T.N;
      const dv = T.profile[k2] - T.profile[k];
      let c;
      if (dv < -0.9) c = [0.95, 0.12, 0.1]; else if (dv < -0.15) c = [1, 0.8, 0.1]; else c = [0.15, 0.85, 0.3];
      const a = onlyCorners ? (dv < -0.15 ? 0.95 : 0) : 0.85;
      const d = T.line[k];
      for (const off of [-0.35, 0.35]) {
        pos.push(T.cx[k] + T.nx[k] * (d + off), T.cy[k] + 0.05, T.cz[k] + T.nz[k] * (d + off));
        col.push(c[0] * a, c[1] * a, c[2] * a);
      }
      if (i > 0) { const b = n - 2; idx.push(b, b + 1, n, b + 1, n + 1, n); }
      n += 2;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    geo.setIndex(idx);
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending, depthWrite: false }));
    m.renderOrder = 2; S.scene.add(m); return m;
  };
  g.lineFull = mk(false); g.lineBrake = mk(true);
  setLineMode(g, g.lineMode);
}
export function setLineMode(g, mode) {
  g.lineMode = mode;
  const show = !isAI();
  g.lineFull.visible = show && mode === 'full'; g.lineBrake.visible = show && mode === 'brake';
}

export function buildRain(g) {
  const n = g.quality === 'low' ? 900 : 1800;
  const pos = new Float32Array(n * 6);
  for (let i = 0; i < n; i++) { const x = (Math.random() - 0.5) * 60, y = Math.random() * 30, z = (Math.random() - 0.5) * 60; pos.set([x, y, z, x, y - 0.9, z], i * 6); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.LineBasicMaterial({ color: 0xc8d4e0, transparent: true, opacity: 0.0, depthWrite: false });
  const rain = new THREE.LineSegments(geo, mat); rain.frustumCulled = false; S.scene.add(rain);
  g.rain = rain; g.rainN = n;
  g.drops = [];
}

export function buildTVCams(g) {
  const T = g.T; g.tvCams = [];
  for (let s = 0; s < T.L; s += 110) {
    const o = {}; T.at(s, o);
    const k = T.lerpArr(T.kc, s + 60);
    const side = k > 0.002 ? -1 : k < -0.002 ? 1 : (g.tvCams.length % 2 ? 1 : -1);
    const wall = side > 0 ? T.wallL[o.i] : T.wallR[o.i];
    const d = side * (wall + 7 + Math.random() * 6);
    const x = o.x + o.nx * d, z = o.z + o.nz * d;
    g.tvCams.push({ s, pos: new THREE.Vector3(x, o.y + 4 + Math.random() * 5, z) });
  }
}

// ------------------------------------------------------------------ main loop
export const tmpV = new THREE.Vector3(), tmpQ = new THREE.Quaternion(), qYaw = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -Math.PI / 2);
export const eul = new THREE.Euler();

export function loop(now) {
  const g = S.G; if (!g || g.dead) return;
  requestAnimationFrame(loop);
  let dt = Math.min(0.05, (now - g.last) / 1000); g.last = now;
  const race = g.race;

  // global actions
  if (input.consume('pause')) { if (g.paused) hidePause(g); else if (!g.resultsShown) showPause(g); }
  if (input.consume('mute')) { sound.enabled = !sound.enabled; if (!sound.enabled) sound.setVolume(0); else sound.setVolume(cfg.volume); }
  if (input.consume('cam')) {
    const modes = cfg.mode === 'pitwall' ? ['tv', 'onboard', 'heli', 'chase'] : cfg.mode === 'grandstand' ? ['seat', 'tv'] : ['cockpit', 'tcam', 'chase'];
    g.camMode = modes[(modes.indexOf(g.camMode) + 1) % modes.length];
    if (!isAI()) { cfg.camera = g.camMode; saveCfg(); }
  }
  if (input.consume('line')) { const ms = ['off', 'brake', 'full']; setLineMode(g, ms[(ms.indexOf(g.lineMode) + 1) % 3]); }

  const p = race.player;
  const drive = input.read(dt, p.v);
  haptics.pad = input.gamepad;

  if (!g.paused) {
    if (!isAI()) playerControls(g, drive, dt);
    const steps = isAI() ? g.simSpeed : 1;
    const inp = applyAssists(g, drive);
    for (let k = 0; k < steps; k++) {
      race.update(dt, inp);
      handleEvents(g);
    }
    updatePitGame(g, dt);
  } else input.clearEdges();

  g.focus = cfg.mode === 'grandstand' ? (g.camMode === 'tv' ? (race.standings[0] || race.player) : (g.gsFocus || race.player)) : race.player;
  placeCars(g, dt);
  updateCamera(g, dt);
  updateEffects(g, dt);
  updateHUD(g, dt);
  updateAudio(g, dt);
  g.particles.update(g.paused ? 0 : dt);
  updateCrew(g);
  if (g.bigScreen && !g.paused) renderBigScreen(g);
  S.renderer.render(S.scene, S.camera);
  renderMirror(g);
  input.clearEdges();
}

export function playerControls(g, drive, dt) {
  const race = g.race, p = race.player;
  if (!(p instanceof PlayerCar)) return;
  if (input.consume('ot')) {
    if (race.otAvailable && !p.otActive) {
      p.otActive = true; race.otAvailable = false; p.battery = Math.min(PHYS.battery, p.battery + 0.5);
      haptics.pattern([30, 40, 30]); sound.blip(1600, 0.15, 0.1); flash(0.25);
    } else if (!race.otAvailable && cfg.mode === 'race') race.rc('Overtake mode not available: you must be within 1.0s of the car ahead at the line', 'info');
  }
  if (input.consume('recharge')) { p.recharge = !p.recharge; haptics.pulse(20); }
  if (input.consume('box') && cfg.mode === 'race') { if (g.pitMenuOpen) closePitMenu(g); else openPitMenu(g); }
  p.boost = drive.boost && p.battery > 0.05 && !p.recharge;
}

export function applyAssists(g, drive) {
  const race = g.race, p = race.player, T = g.T;
  const inp = { steer: drive.steer, throttle: drive.throttle, brake: drive.brake, tc: cfg.assist.tc, abs: cfg.assist.abs, autoGear: cfg.assist.autoGear, shiftUp: input.consume('shiftUp'), shiftDown: input.consume('shiftDown') };
  if (!(p instanceof PlayerCar) || p.auto) return inp;
  if (race.phase === 'grid' || race.phase === 'lights') return inp;
  const gripK = Math.sqrt(Math.max(0.3, p.mu / PHYS.mu0));
  if (cfg.assist.brake) {
    const tgt = Math.min(T.lerpArr(T.profile, p.s + p.v * 0.12), T.lerpArr(T.profile, p.s + p.v * 0.35) + 6) * gripK * 0.965;
    if (p.v > tgt + 0.8) { inp.brake = Math.max(inp.brake, clamp((p.v - tgt) / 7, 0.15, 1)); inp.throttle = Math.min(inp.throttle, 0.0); }
  }
  if (cfg.assist.steer) {
    const o = {}; T.at(p.s, o);
    const herr = wrapA(Math.atan2(o.tz, o.tx) - p.h); // + = car points left of the track
    const look = p.s + Math.max(6, p.v * 0.22);
    const ff = p.steerFor(T.lerpArr(T.lk, look));
    const e = T.lerpArr(T.line, look) - p.d;
    const corr = ff + clamp(e * 0.045, -0.4, 0.4) - herr * 1.3;
    const u = inp.steer;
    inp.steer = clamp(u * 0.65 + corr * (1 - Math.abs(u) * 0.6), -1, 1);
  }
  if (race.phase === 'racing' && race.time - race.startTime < 0.05 && inp.throttle < 0.1) { /* nothing */ }
  return inp;
}

export function flash(a) { const f = $('#flash'); if (!f) return; f.style.transition = 'none'; f.style.opacity = a; requestAnimationFrame(() => { f.style.transition = 'opacity .4s'; f.style.opacity = 0; }); }

export function handleEvents(g) {
  const race = g.race;
  for (const e of race.events) {
    if (e.type === 'light') { sound.light(); haptics.pulse(25); }
    if (e.type === 'lightsout') { haptics.pattern([60, 40, 120]); sound.cheer(); }
    if (e.type === 'pitgame') startPitGame(g, e.car);
    if (e.type === 'overtake') { sound.cheer(); haptics.pulse(40); if (Math.random() < 0.5) race.radioMsg('eng', `Great move on ${e.who}! Keep it going.`); }
    if (e.type === 'overtaken' && Math.random() < 0.4) race.radioMsg('eng', `${e.who} got past. Stay with him, use the energy on the straight.`);
    if (e.type === 'sc') haptics.pattern([80, 60, 80]);
    if (e.type === 'chequered') { sound.cheer(); }
    if (e.type === 'playerFinished') { g.finishAt = performance.now(); const pos = race.player.pos; race.radioMsg('eng', pos === 1 ? 'Yes! Yes! You won it! Get in there!' : pos <= 3 ? `P${pos}! Podium! Fantastic job.` : `P${pos}. Good job, we'll take that.`); }
    if (e.type === 'invalid') { flash(0.15); }
    if (e.type === 'qualiDone') { race.banner(e.valid ? 'LAP COMPLETE' : 'LAP DELETED', e.valid ? fmtLap(e.t) : 'Track limits', e.valid ? 'green' : 'white'); setTimeout(() => { if (S.G === g) onQualiDone(g, e.t, e.valid); }, 2200); }
    if (e.type === 'sector' && e.color === 'purple' && isSolo()) sound.blip(1200, 0.1, 0.06);
  }
  const p = race.player;
  if (p.events) {
    for (const e of p.events) {
      if (e.type === 'shift') { if (e.up) { sound.shift(); haptics.pulse(10, 0.2, 0.4); } }
      if (e.type === 'wall' || e.type === 'contact') { const pr = g.cars.get(p)?.root; if (pr) { g.particles.burstSparks(pr.position.x, pr.position.y, pr.position.z, Math.cos(p.h) * p.v, Math.sin(p.h) * p.v, 20 + e.power * 60); if (e.power > 0.4) g.particles.debris(pr.position.x, pr.position.y, pr.position.z, Math.cos(p.h) * p.v, Math.sin(p.h) * p.v); } }
      if (e.type === 'wall') { sound.crash(e.power); haptics.pulse(80 + e.power * 200, 1, 1); flash(0.2 + e.power * 0.4); g.shake = 0.4 + e.power; }
      if (e.type === 'contact') { sound.crash(e.power * 0.6); haptics.pulse(60 + e.power * 120, 0.9, 0.7); g.shake = 0.3 + e.power; }
    }
    p.events.length = 0;
  }
}

// ------------------------------------------------------------------ cars
export const tmpO = {};
export function placeCars(g, dt) {
  const T = g.T, race = g.race;
  for (const [c, v] of g.cars) {
    const r = v.root;
    let h, pitch, roll = 0, steerA = 0;
    if (c instanceof PlayerCar) {
      r.position.set(c.x, c.y, c.z); h = c.h;
      const y1 = T.lerpArr(T.cy, c.s + 2), y0 = T.lerpArr(T.cy, c.s - 2);
      pitch = Math.atan2(y1 - y0, 4) + c.lonG * 0.004;
      roll = clamp(c.latG * 0.004, -0.03, 0.03);
      steerA = c.steer * 0.32 / (1 + c.v / 40);
      // slide angle: body yaw relative to path
      if (c.v > 3) h += Math.atan2(-c.vy, c.v) * 0.0;
    } else {
      T.at(c.s, tmpO);
      r.position.set(tmpO.x + tmpO.nx * c.d, tmpO.y, tmpO.z + tmpO.nz * c.d);
      h = Math.atan2(tmpO.tz, tmpO.tx) - (c.yawVis || 0);
      const y1 = T.lerpArr(T.cy, c.s + 2), y0 = T.lerpArr(T.cy, c.s - 2);
      pitch = Math.atan2(y1 - y0, 4) + (c.braking ? -0.008 : 0);
      steerA = clamp(T.lerpArr(T.lk, c.s) * 3.6 * 1.2 + (c.yawVis || 0) * 2, -0.4, 0.4);
      if (c.retired) { pitch += 0.0; h += 0.6; }
    }
    r.rotation.set(roll, -h, pitch);
    const spin = (c.v * dt) / 0.36;
    for (const w of v.wheels) { w.spin.rotation.z -= spin; if (w.front) w.pivot.rotation.y = steerA; }
    const sm = c.straightMode ? 1 : 0;
    v.flapA = (v.flapA || 0) + (sm - (v.flapA || 0)) * Math.min(1, dt * 10);
    v.flap.rotation.z = -v.flapA * 0.85; v.flap.position.y = 1.06 + v.flapA * 0.05;
    const harvesting = c instanceof PlayerCar ? (c.harvestPower > 60e3 || c.recharge) : c.harvesting;
    const blink = (harvesting || race.weather.rain > 0.1) && Math.floor(g.t * 4) % 2 === 0;
    v.lightMat.color.setHex(blink ? 0xff2020 : 0x330000);
    if (v.compound !== c.tyre.c) { v.setCompound(c.tyre.c); v.compound = c.tyre.c; }
    v.setDamage(c.damage || 0);
    if (!g.paused && dt > 0) {
      const fx = Math.cos(h), fz = Math.sin(h);
      const isPC = c instanceof PlayerCar;
      const smoke = isPC ? (c.lock > 0 || c.slip > 0.6 || c.spin > 0.4) && c.v > 8 : !!c.smoking;
      const dust = isPC ? c.surface === 'grass' && c.v > 10 : (c.mistake && Math.abs(c.d) > T.hw + 0.5);
      const near = r.position.distanceToSquared(S.camera.position) < 250000;
      const selfView = c === g.focus && ['cockpit', 'tcam', 'onboard'].includes(g.camMode);
      if (near) g.particles.car(r.position.x, r.position.y, r.position.z, fx, fz, c.v, race.weather.wet, { dt, smoke: smoke && !selfView, dust: dust && !selfView });
      // sparks from the plank on heavy compression at speed (dips on hilly tracks) or a damaged wing scraping
      if (near && c.v > 70 && (c.damage > 0.5 || (Math.abs(pitch) > 0.012 && Math.random() < 0.3))) g.particles.trailSparks(r.position.x, r.position.y, r.position.z, fx, fz, c.v);
    }
    const hideHead = c === race.player && !isAI() && (g.camMode === 'cockpit');
    v.helmet.visible = !hideHead; v.visor.visible = !hideHead;
  }
  // safety car
  const sc = race.scCar;
  g.sc.root.visible = !!sc;
  if (sc) {
    T.at(sc.s, tmpO);
    g.sc.root.position.set(tmpO.x + tmpO.nx * sc.d, tmpO.y, tmpO.z + tmpO.nz * sc.d);
    g.sc.root.rotation.set(0, -Math.atan2(tmpO.tz, tmpO.tx), 0);
    g.sc.bar.material.color.setHex(Math.floor(g.t * 6) % 2 ? 0xff9900 : 0x442200);
  }
  // ghost
  if (g.ghost) {
    const tr = race.bestTrace; const p = race.player;
    if (tr && tr.length > 2 && p.lapStart !== undefined) {
      const t = race.time - p.lapStart;
      let lo = 0, hi = tr.length - 1;
      while (hi - lo > 1) { const m = (lo + hi) >> 1; if (tr[m].t < t) lo = m; else hi = m; }
      const a = tr[lo], b = tr[hi]; const f = clamp((t - a.t) / Math.max(1e-3, b.t - a.t), 0, 1);
      if (t <= tr[tr.length - 1].t) {
        g.ghost.root.visible = true;
        g.ghost.root.position.set(a.x + (b.x - a.x) * f, a.y + (b.y - a.y) * f, a.z + (b.z - a.z) * f);
        g.ghost.root.rotation.set(0, -(a.h + wrapA(b.h - a.h) * f), 0);
      } else g.ghost.root.visible = false;
    } else g.ghost.root.visible = false;
  }
}

// ------------------------------------------------------------------ S.camera
export function updateCamera(g, dt) {
  const race = g.race; const focus = g.focus; const v = g.cars.get(focus); const T = g.T;
  const r = v.root;
  r.updateMatrixWorld();
  const speed = focus.v;
  const portrait = innerHeight > innerWidth;
  let fov = portrait ? 78 : 62;
  g.shake = Math.max(0, (g.shake || 0) - dt * 2.5);
  const isP = focus instanceof PlayerCar;
  const mode = g.camMode;
  if (mode === 'cockpit' || mode === 'tcam' || mode === 'onboard') {
    const eye = mode === 'cockpit' ? new THREE.Vector3(0.14, 0.9, 0) : new THREE.Vector3(-0.38, 1.33, 0);
    // head movement from g-forces
    const latG = isP ? focus.latG : (focus.v * focus.v * T.lerpArr(T.lk, focus.s)) / 9.81;
    const lonG = isP ? focus.lonG : (focus.braking ? -4 : 0.6);
    g.headLat = (g.headLat || 0) + ((clamp(latG, -5, 5) * 0.012) - (g.headLat || 0)) * Math.min(1, dt * 6);
    g.headLon = (g.headLon || 0) + ((clamp(lonG, -6, 3) * 0.008) - (g.headLon || 0)) * Math.min(1, dt * 6);
    if (mode === 'cockpit') { eye.z += g.headLat; eye.x += g.headLon; }
    const kerb = isP ? focus.kerb : 0, grass = isP && focus.surface === 'grass' ? 1 : 0;
    const amp = Math.pow(speed / 90, 2) * 0.006 + kerb * 0.02 + grass * 0.03 + g.shake * 0.05;
    eye.x += (Math.random() - 0.5) * amp; eye.y += (Math.random() - 0.5) * amp * 1.4; eye.z += (Math.random() - 0.5) * amp;
    r.localToWorld(eye);
    S.camera.position.copy(eye);
    r.getWorldQuaternion(tmpQ);
    const pitch = (mode === 'cockpit' ? -0.035 : -0.07) + (g.headLon || 0) * 0.6;
    const roll = mode === 'cockpit' ? -(g.headLat || 0) * 0.9 : 0;
    eul.set(pitch, 0, roll, 'YXZ');
    S.camera.quaternion.copy(tmpQ).multiply(qYaw).multiply(new THREE.Quaternion().setFromEuler(eul));
    fov = (portrait ? 82 : 66) + (speed / 90) * 7;
  } else if (mode === 'chase') {
    // no positional lag: smooth only the viewing direction
    const fwd = new THREE.Vector3(1, 0, 0).applyQuaternion(r.quaternion); fwd.y = 0; fwd.normalize();
    if (!g.chaseFwd) g.chaseFwd = fwd.clone();
    g.chaseFwd.lerp(fwd, Math.min(1, dt * 7)).normalize();
    const pos = r.position.clone().addScaledVector(g.chaseFwd, -6.6); pos.y = Math.max(r.position.y + 2.1, T.lerpArr(T.cy, focus.s) + 1.2);
    S.camera.position.copy(pos);
    S.camera.lookAt(r.position.x + g.chaseFwd.x * 4, r.position.y + 0.9, r.position.z + g.chaseFwd.z * 4);
    fov = (portrait ? 80 : 64) + (speed / 90) * 6;
  } else if (mode === 'heli') {
    const pos = new THREE.Vector3(-45, 60, 20); r.localToWorld(pos);
    if (!g.heliPos) g.heliPos = pos.clone(); g.heliPos.lerp(pos, Math.min(1, dt * 1.5));
    S.camera.position.copy(g.heliPos); S.camera.lookAt(r.position); fov = 40;
  } else if (mode === 'seat') {
    fov = seatCamera(g, dt);
  } else if (mode === 'tv') {
    // trackside cameras that follow and zoom on the car
    const s = focus.s;
    let cam = g.tvCam;
    const ahead = c => { let d = c.s - s; if (d < -T.L / 2) d += T.L; if (d > T.L / 2) d -= T.L; return d; };
    if (!cam || ahead(cam) < -35) {
      let best = null, bd = 1e9;
      for (const c of g.tvCams) { const d = ahead(c); if (d > 10 && d < bd) { bd = d; best = c; } }
      g.tvCam = cam = best;
    }
    S.camera.position.copy(cam.pos);
    S.camera.lookAt(r.position.x, r.position.y + 0.6, r.position.z);
    const dist = S.camera.position.distanceTo(r.position);
    fov = clamp(2 * Math.atan(9 / dist) * 180 / Math.PI, 7, 55);
  }
  if (Math.abs(S.camera.fov - fov) > 0.01) { S.camera.fov += (fov - S.camera.fov) * Math.min(1, dt * 6); S.camera.updateProjectionMatrix(); }
}

// ------------------------------------------------------------------ effects
export const dryRoad = new THREE.Color(0xc8c8c8), wetRoad = new THREE.Color(0x9a9ea6);
export function updateEffects(g, dt) {
  g.t += dt;
  const race = g.race, W = race.weather, T = g.T, sc = g.scen;
  // wet track and sky
  const wet = W.wet, rain = W.rain;
  T.roadMat.color.copy(dryRoad).lerp(wetRoad, wet);
  T.roadMat.roughness = 0.92 - wet * 0.3; T.roadMat.metalness = wet * 0.05;
  sc.skyMat.uniforms.dark.value = rain * 0.75;
  const fogFar = 4200 - rain * 3300; S.scene.fog.far = fogFar; S.scene.fog.near = 450 - rain * 380;
  S.scene.fog.color.setHex(sc.tod.fog).lerp(new THREE.Color(0x8d939b), rain * 0.8);
  // tunnel
  let inTunnel = false;
  if (T.tunnel) { const s = g.focus.s; inTunnel = s > T.tunnel[0] && s < T.tunnel[1] && (g.camMode === 'cockpit' || g.camMode === 'tcam' || g.camMode === 'chase' || g.camMode === 'onboard'); }
  g.inTunnel = inTunnel;
  const lightK = (inTunnel ? 0.18 : 1) * (1 - rain * 0.45);
  g.lightK = (g.lightK ?? 1) + (lightK - (g.lightK ?? 1)) * Math.min(1, dt * 5);
  sc.sun.intensity = sc.tod.sunI * g.lightK; sc.hemi.intensity = sc.tod.hemiI * (0.35 + 0.65 * g.lightK);
  // shadow camera follows the focus car
  if (sc.sun.castShadow) { const fp = g.cars.get(g.focus).root.position; sc.sun.target.position.copy(fp); sc.sun.position.copy(fp).add(new THREE.Vector3(...sc.tod.sunPos).multiplyScalar(300)); }
  // rain streaks
  const rm = g.rain;
  rm.material.opacity = Math.min(0.55, rain * 0.7);
  rm.visible = rain > 0.02;
  if (rm.visible) {
    const pos = rm.geometry.attributes.position; const cp = S.camera.position;
    rm.position.set(cp.x, cp.y - 8, cp.z);
    const arr = pos.array, fall = dt * 32;
    for (let i = 0; i < g.rainN; i++) { const k = i * 6; arr[k + 1] -= fall; arr[k + 4] -= fall; if (arr[k + 1] < 0) { const x = (Math.random() - 0.5) * 60, z = (Math.random() - 0.5) * 60, y = 25 + Math.random() * 5; arr[k] = x; arr[k + 1] = y; arr[k + 2] = z; arr[k + 3] = x; arr[k + 4] = y - 0.9; arr[k + 5] = z; } }
    pos.needsUpdate = true;
  }
  // visor drops (cockpit only)
  const vc = g.visorCtx, cv = g.visor;
  const showVisor = (g.camMode === 'cockpit' || g.camMode === 'tcam' || g.camMode === 'onboard') && rain > 0.03 && !inTunnel;
  if (vc) {
    vc.clearRect(0, 0, cv.width, cv.height);
    if (showVisor) {
      const sp = g.focus.v;
      const spawn = rain * (6 + sp * 0.25) * dt * 6;
      for (let k = 0; k < spawn; k++) if (g.drops.length < 160) g.drops.push({ x: Math.random() * cv.width, y: Math.random() * cv.height * 0.85, r: 1.5 + Math.random() * 4, life: 1 + Math.random() * 1.5 });
      for (let i = g.drops.length - 1; i >= 0; i--) {
        const d = g.drops[i];
        // air flow pushes drops up and outward at speed
        const cx = cv.width / 2; d.x += (d.x - cx) * 0.0004 * sp * dt * 60 * 0.05; d.y -= sp * 0.02 * dt * 60 * 0.2;
        d.life -= dt * (0.5 + sp / 60);
        if (d.life <= 0 || d.y < -10) { g.drops.splice(i, 1); continue; }
        const a = Math.min(0.6, d.life * 0.5);
        const gr = vc.createRadialGradient(d.x - d.r * 0.3, d.y - d.r * 0.3, 0.5, d.x, d.y, d.r);
        gr.addColorStop(0, `rgba(255,255,255,${a})`); gr.addColorStop(1, `rgba(180,200,220,${a * 0.25})`);
        vc.fillStyle = gr; vc.beginPath(); vc.arc(d.x, d.y, d.r, 0, 7); vc.fill();
      }
    } else g.drops.length = 0;
  }
  // g-force vignette
  const gf = $('#gforce');
  if (gf) {
    const p = g.focus; let gl = 0;
    if (p instanceof PlayerCar && (g.camMode === 'cockpit' || g.camMode === 'tcam')) gl = clamp((Math.abs(p.latG) + Math.max(0, -p.lonG) * 0.8 - 3.2) * 0.13, 0, 0.5);
    g.gv = (g.gv || 0) + (gl - (g.gv || 0)) * Math.min(1, dt * 5);
    gf.style.opacity = g.gv.toFixed(3);
  }
  // gantry lights
  const on = race.phase === 'lights' ? race.lightsOn : 0;
  sc.lights.forEach((col, k) => col.forEach(m => m.material.color.setHex(k < on ? 0xff1010 : 0x220000)));
}

// ------------------------------------------------------------------ audio per frame
export function updateAudio(g, dt) {
  const race = g.race, f = g.focus, T = g.T;
  const isP = f instanceof PlayerCar;
  const onboard = ['cockpit', 'tcam', 'onboard'].includes(g.camMode);
  let scale = 1;
  if (!onboard) { const d = S.camera.position.distanceTo(g.cars.get(f).root.position); scale = clamp(14 / Math.max(6, d), 0.08, 1); }
  // nearest other car
  let best = null, bd = 1e9; const fp = g.cars.get(f).root.position;
  for (const [c, v] of g.cars) { if (c === f) continue; const d = v.root.position.distanceTo(S.camera.position); if (d < bd) { bd = d; best = c; } }
  let opp = null;
  if (best && bd < 120) {
    const v = g.cars.get(best).root.position;
    const prev = g.prevOpp.get(best) ?? bd; g.prevOpp.set(best, bd);
    const closing = (prev - bd) / Math.max(dt, 1e-3);
    tmpV.copy(v).sub(S.camera.position).normalize();
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(S.camera.quaternion);
    opp = { dist: bd, pan: tmpV.dot(right), doppler: clamp(343 / (343 - clamp(closing, -120, 120)), 0.6, 1.6), rpm: 9000 + Math.min(3000, best.v * 30), throttle: best.braking ? 0.2 : 1 };
  }
  const near = T.stands && T.stands.some(st => { const s = f.s; return st.s0 < st.s1 ? s > st.s0 && s < st.s1 : s > st.s0 || s < st.s1; });
  sound.update({
    rpm: isP ? f.rpm : (f.pit && f.v < 1 ? 4500 : 8500 + Math.min(3500, f.v * 35)),
    throttle: isP ? f.throttle : (f.braking ? 0.1 : 0.9), v: f.v,
    ers: isP ? f.ersPower / PHYS.ERS : 0.5, slip: isP ? Math.max(f.slip, f.lock * 0.8, f.spin) : 0,
    kerb: isP ? f.kerb : 0, grass: isP && f.surface === 'grass' ? 1 : 0, rain: race.weather.rain, inTunnel: g.inTunnel,
    crowd: near ? 1 : 0.15, opp, paused: g.paused, onboard, scale,
  });
  // haptics: kerbs & lock-ups (continuous)
  if (isP && race.phase === 'racing') {
    g.kerbT -= dt; g.lockT -= dt;
    if (f.kerb && f.v > 10 && g.kerbT <= 0) { g.kerbT = 0.08; haptics.pulse(22, 0.5, 0.8); }
    if ((f.lock > 0 || f.slip > 0.5) && g.lockT <= 0) { g.lockT = 0.12; haptics.pulse(18, 0.3, 0.6); }
  }
}


// ------------------------------------------------------------------ pit crews
export function makeCrew(scene) {
  const geo = new THREE.CapsuleGeometry(0.22, 1.1, 3, 6).translate(0, 0.78, 0);
  const mesh = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial({ color: 0xffffff }), 200);
  mesh.count = 0; mesh.frustumCulled = false; scene.add(mesh);
  return { mesh, m: new THREE.Matrix4(), c: new THREE.Color() };
}
// crew positions around the car (car frame: +x forward, -z left)
const CREW = [[1.75, 1.35], [1.75, -1.35], [-1.75, 1.35], [-1.75, -1.35], [1.75, 1.9], [1.75, -1.9], [-1.75, 1.9], [-1.75, -1.9], [3.6, 0], [-3.3, 0], [0.2, 1.6], [0.2, -1.6]];
export function updateCrew(g) {
  const { mesh, m, c } = g.crew; let n = 0;
  const T = g.T, P = T.pit;
  for (const [car, v] of g.cars) {
    const p = car.pit || (car.auto && car.auto.pit);
    if (!p || (p.phase !== 'stop' && !(p.phase === 'lane' && Math.abs((car.s > T.L / 2 ? car.s - T.L : car.s) - p.boxS) < 40))) continue;
    const ti = Math.max(0, ['aurora', 'falcon', 'nightfall', 'solaris', 'kestrel', 'verdant', 'ion', 'monarch', 'titan', 'blaze'].indexOf(car.team.id));
    const o = {}; T.at(p.boxS, o);
    const h = Math.atan2(o.tz, o.tx);
    const cx = o.x + o.nx * P.d, cz = o.z + o.nz * P.d;
    c.setHex(car.team.color);
    for (const [ax, az] of CREW) {
      const lift = p.phase === 'stop' ? 0 : 0;
      const wx = cx + Math.cos(h) * ax - Math.sin(h) * 0 + (o.nx) * -az;
      const wz = cz + Math.sin(h) * ax + (o.nz) * -az;
      m.makeRotationY(-h); m.setPosition(wx, o.y + lift, wz);
      mesh.setMatrixAt(n, m); mesh.setColorAt(n, c); n++;
      if (n >= 200) break;
    }
  }
  mesh.count = n; mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
}

// ------------------------------------------------------------------ rear-view mirror (PC)
// The rear view is rendered into a texture and drawn flipped, like a real mirror.
const mirrorCam = new THREE.PerspectiveCamera(40, 4.2, 0.3, 1500);
let mirrorRT = null, mirrorScene = null, mirrorOrtho = null;
export function renderMirror(g) {
  const p = g.race.player;
  const el = document.getElementById('mirror');
  const on = g.mirror && (p instanceof PlayerCar) && !p.auto && ['cockpit', 'tcam'].includes(g.camMode) && innerWidth >= 900;
  if (el) el.style.display = on ? '' : 'none';
  const W = innerWidth, H = innerHeight;
  const w = Math.round(Math.min(420, W * 0.3)), h = Math.round(w / 4.2);
  document.documentElement.style.setProperty('--mirrorH', on ? (h + 8) + 'px' : '0px');
  if (!on) return;
  if (!mirrorRT) {
    mirrorRT = new THREE.WebGLRenderTarget(512, 122);
    mirrorScene = new THREE.Scene();
    mirrorOrtho = new THREE.OrthographicCamera(-0.5, 0.5, 0.5, -0.5, 0, 1);
    const tex = mirrorRT.texture; tex.repeat.x = -1; tex.offset.x = 1;
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: tex, depthTest: false, depthWrite: false }));
    quad.position.z = -0.5; mirrorScene.add(quad);
  }
  const r = g.cars.get(p).root;
  const eye = new THREE.Vector3(0.1, 1.2, 0); r.localToWorld(eye);
  const back = new THREE.Vector3(-25, 0.8, 0); r.localToWorld(back);
  mirrorCam.position.copy(eye); mirrorCam.lookAt(back);
  const R = S.renderer;
  R.setRenderTarget(mirrorRT); R.render(S.scene, mirrorCam); R.setRenderTarget(null);
  const x = Math.round((W - w) / 2), yTop = 58;
  R.autoClear = false;
  R.setScissorTest(true); R.setViewport(x, H - yTop - h, w, h); R.setScissor(x, H - yTop - h, w, h);
  R.render(mirrorScene, mirrorOrtho);
  R.setScissorTest(false); R.setViewport(0, 0, W, H); R.autoClear = true;
  if (el) { el.style.left = x + 'px'; el.style.top = yTop + 'px'; el.style.width = w + 'px'; el.style.height = h + 'px'; }
}

function fmtLap(t) { const m = Math.floor(t / 60); return m + ':' + (t - m * 60).toFixed(3).padStart(6, '0'); }
