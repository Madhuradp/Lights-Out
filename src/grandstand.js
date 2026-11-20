// Grandstand mode: watch the race from a seat in the crowd. Look around, zoom like binoculars,
// follow the cars as they scream past, watch the big screen, and make predictions.
import * as THREE from 'three';
import { $, html, txt, hex, clamp } from './util.js';
import { S, sound, input } from './ctx.js';
import { COMPOUNDS } from './data.js';

export function buildGrandstandHTML(g) {
  return `<div class="gs-bar pe">
      <button class="hbtn" id="gsFollow">FOLLOW: ON</button>
      <button class="hbtn" id="gsZoomIn">ZOOM +</button><button class="hbtn" id="gsZoomOut">ZOOM −</button>
      <button class="hbtn" id="gsSeat">CHANGE SEAT</button><button class="hbtn" id="gsRow">TOP ROW</button>
      <button class="hbtn" id="gsTV">TV FEED</button><button class="hbtn" id="gsSpeed">1x</button><button class="hbtn" id="gsPause">II</button>
    </div>
    <div class="gs-seat" id="gsSeatLbl"></div>
    <div class="gs-comm" id="gsComm"></div>
    <div class="gs-pred" id="gsPred"></div>
    <div class="hint" id="gsHint">Drag to look around · scroll or pinch to zoom</div>`;
}

export function setupGrandstand(g) {
  const T = g.T;
  g.seats = T.stands.map((st, i) => ({ ...st, i }));
  g.seatIdx = 0; g.row = 2; g.zoom = 1; g.follow = true; g.yaw = 0; g.pitch = -0.05; g.holdFollow = 0;
  placeSeat(g);
  const cv = $('#gl');
  let drag = null, pinch = null;
  const onDown = e => { if (e.target !== cv) return; drag = { x: e.clientX, y: e.clientY, yaw: g.yaw, pitch: g.pitch }; };
  const onMove = e => {
    if (!drag || pinch) return;
    const k = (S.camera.fov / 70) * 0.005;
    g.yaw = drag.yaw + (e.clientX - drag.x) * k; g.pitch = clamp(drag.pitch + (e.clientY - drag.y) * k, -0.6, 0.5);
    if (Math.abs(e.clientX - drag.x) + Math.abs(e.clientY - drag.y) > 6) g.holdFollow = performance.now() + 3500;
  };
  const onUp = () => { drag = null; };
  const onWheel = e => { if (S.G !== g) return; g.zoom = clamp(g.zoom * (e.deltaY > 0 ? 0.9 : 1.1), 1, 6); };
  const onTouch = e => {
    if (e.touches.length === 2) { const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY); if (!pinch) pinch = { d, z: g.zoom }; else g.zoom = clamp(pinch.z * d / pinch.d, 1, 6); }
    else pinch = null;
  };
  addEventListener('pointerdown', onDown); addEventListener('pointermove', onMove); addEventListener('pointerup', onUp);
  addEventListener('wheel', onWheel, { passive: true }); addEventListener('touchmove', onTouch, { passive: true }); addEventListener('touchend', () => pinch = null);
  g.cleanup = () => { removeEventListener('pointerdown', onDown); removeEventListener('pointermove', onMove); removeEventListener('pointerup', onUp); removeEventListener('wheel', onWheel); removeEventListener('touchmove', onTouch); };
  $('#gsFollow').onclick = () => { g.follow = !g.follow; txt($('#gsFollow'), 'FOLLOW: ' + (g.follow ? 'ON' : 'OFF')); };
  $('#gsZoomIn').onclick = () => g.zoom = clamp(g.zoom * 1.4, 1, 6);
  $('#gsZoomOut').onclick = () => g.zoom = clamp(g.zoom / 1.4, 1, 6);
  $('#gsSeat').onclick = () => { g.seatIdx = (g.seatIdx + 1) % g.seats.length; placeSeat(g); };
  $('#gsRow').onclick = () => { g.row = g.row > 3 ? 1 : 7; txt($('#gsRow'), g.row > 3 ? 'FRONT ROW' : 'TOP ROW'); placeSeat(g); };
  $('#gsTV').onclick = () => { g.camMode = g.camMode === 'tv' ? 'seat' : 'tv'; txt($('#gsTV'), g.camMode === 'tv' ? 'BACK TO SEAT' : 'TV FEED'); };
  $('#gsSpeed').onclick = () => { g.simSpeed = g.simSpeed === 1 ? 2 : g.simSpeed === 2 ? 4 : 1; txt($('#gsSpeed'), g.simSpeed + 'x'); };
  $('#gsPause').onclick = () => input.press('pause');
  buildBigScreen(g);
  showPredictions(g);
}

function placeSeat(g) {
  const T = g.T, st = g.seats[g.seatIdx];
  const mid = st.s0 < st.s1 ? (st.s0 + st.s1) / 2 : T.wrap((st.s0 + st.s1 + T.L) / 2);
  const o = {}; T.at(mid, o);
  const k = g.row;
  const d = st.side * (st.d0 + k * 1.1 + 0.55);
  g.seatPos = new THREE.Vector3(o.x + o.nx * d, o.y + 0.8 + k * 0.75 + 1.15, o.z + o.nz * d);
  g.seatS = mid;
  // default view: across the track
  g.baseYaw = Math.atan2(-o.nx * st.side, -o.nz * st.side);
  g.yaw = 0; g.pitch = -0.08;
  txt($('#gsSeatLbl'), `${st.name} · ${g.row > 3 ? 'top row' : 'front row'}`);
  if (g.bigScreen) positionBigScreen(g);
}

// ---------------- big screen with a live TV feed ----------------
function buildBigScreen(g) {
  const rt = new THREE.WebGLRenderTarget(640, 360);
  const frame = new THREE.Mesh(new THREE.BoxGeometry(17, 10, 0.6), new THREE.MeshLambertMaterial({ color: 0x111215 }));
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(16, 9), new THREE.MeshBasicMaterial({ map: rt.texture, toneMapped: false }));
  screen.position.z = 0.31; frame.add(screen);
  const leg = new THREE.Mesh(new THREE.BoxGeometry(0.8, 9, 0.8), new THREE.MeshLambertMaterial({ color: 0x2b2f36 })); leg.position.y = -9.5; frame.add(leg);
  S.scene.add(frame);
  g.bigScreen = { rt, frame, cam: new THREE.PerspectiveCamera(30, 16 / 9, 0.5, 4000), tvCam: null, t: 0 };
  positionBigScreen(g);
}
function positionBigScreen(g) {
  const T = g.T, st = g.seats[g.seatIdx];
  const s = T.wrap(g.seatS + 70);
  const o = {}; T.at(s, o);
  const side = -st.side;
  const w = side > 0 ? T.wallL[o.i] : T.wallR[o.i];
  const d = side * (w + 16);
  const f = g.bigScreen.frame;
  f.position.set(o.x + o.nx * d, o.y + 14, o.z + o.nz * d);
  f.lookAt(g.seatPos.x, f.position.y - 2, g.seatPos.z);
}
export function renderBigScreen(g) {
  const B = g.bigScreen; if (!B) return;
  B.t++; if (B.t % 2) return; // every other frame
  // follow the closest battle near the front, else the leader
  const st = g.race.standings || [];
  let target = st[0];
  for (let i = 1; i < Math.min(st.length, 8); i++) if (!st[i].pit && !st[i].retired && st[i].interval < 0.8) { target = st[i]; break; }
  if (!target) return;
  const T = g.T, o = {};
  T.at(target.s, o);
  const tp = new THREE.Vector3(o.x + o.nx * target.d, o.y + 0.6, o.z + o.nz * target.d);
  const ahead = c => { let d = c.s - target.s; if (d < -T.L / 2) d += T.L; if (d > T.L / 2) d -= T.L; return d; };
  if (!B.tvCam || ahead(B.tvCam) < -35 || B.target !== target) {
    let best = null, bd = 1e9; for (const c of g.tvCams) { const d = ahead(c); if (d > 10 && d < bd) { bd = d; best = c; } }
    B.tvCam = best; B.target = target;
  }
  B.cam.position.copy(B.tvCam.pos); B.cam.lookAt(tp);
  B.cam.fov = clamp(2 * Math.atan(9 / B.cam.position.distanceTo(tp)) * 180 / Math.PI, 7, 50); B.cam.updateProjectionMatrix();
  const R = S.renderer;
  B.frame.visible = false;
  R.setRenderTarget(B.rt); R.render(S.scene, B.cam); R.setRenderTarget(null);
  B.frame.visible = true;
}

// ---------------- seat camera ----------------
const tmp = new THREE.Vector3();
export function seatCamera(g, dt) {
  const cam = S.camera;
  cam.position.copy(g.seatPos);
  // auto-follow: aim at the nearest car within range
  let near = null, nd = 1e9;
  for (const [c, v] of g.cars) { const d = v.root.position.distanceTo(g.seatPos); if (d < nd && !c.retired) { nd = d; near = c; } }
  g.gsFocus = near;
  // compute a look direction from yaw/pitch relative to the base direction
  let yaw = g.baseYaw + g.yaw, pitch = g.pitch;
  if (g.follow && near && nd < 320 && performance.now() > g.holdFollow) {
    const p = g.cars.get(near).root.position;
    tmp.copy(p).sub(g.seatPos);
    const ty = Math.atan2(tmp.x, tmp.z), tpch = Math.atan2(tmp.y, Math.hypot(tmp.x, tmp.z));
    let dy = ty - yaw; while (dy > Math.PI) dy -= 2 * Math.PI; while (dy < -Math.PI) dy += 2 * Math.PI;
    g.yaw += dy * Math.min(1, dt * 5); g.pitch += (tpch - g.pitch) * Math.min(1, dt * 5);
    yaw = g.baseYaw + g.yaw; pitch = g.pitch;
  }
  const dir = new THREE.Vector3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
  cam.lookAt(tmp.copy(g.seatPos).add(dir));
  return 68 / g.zoom;
}

// ---------------- HUD ----------------
export function updateGrandstand(g, dt) {
  const race = g.race;
  // commentary ticker
  const items = race.commentary.slice(0, 3);
  html($('#gsComm'), items.length ? `<div class="gs-live">LIVE</div>${items.map((c, i) => `<div style="opacity:${1 - i * 0.28}">${c.text}</div>`).join('')}` : '<div class="gs-live">LIVE</div><div>Welcome to the grandstand. Cars approaching!</div>');
  // crowd reacts to passes near the front and to anything passing our seat
  for (const e of race.events) if (e.type === 'pass' && e.pos <= 5) sound.cheer();
  // predictions summary
  const pr = g.predictions;
  html($('#gsPred'), pr ? `<b>YOUR CALLS</b><span>Winner: ${pr.winner || '—'}</span><span>Fastest lap: ${pr.fastest || '—'}</span><span>Safety car: ${pr.sc == null ? '—' : pr.sc ? 'Yes' : 'No'}</span>` : '');
  const hint = $('#gsHint'); if (hint) hint.style.display = race.time > 20 ? 'none' : '';
}

function showPredictions(g) {
  const race = g.race;
  g.paused = true;
  const grid = race.standings.slice();
  const host = $('#overlayHost');
  const pick = { winner: null, fastest: null, sc: null };
  const chip = (c, key) => `<button class="pchip" data-k="${key}" data-c="${c.code}"><span class="tc" style="background:${hex(c.team.color)}"></span>P${c.pos} ${c.code}<small>${COMPOUNDS[c.tyre.c].name}</small></button>`;
  host.innerHTML = `<div class="overlay"><div class="card"><h2>Make your calls</h2>
    <p style="color:#9aa3ad;margin-top:-6px">Before the lights go out: who wins, who sets the fastest lap, and will we see a safety car? Correct calls earn XP.</p>
    <h4 class="ph">Race winner</h4><div class="pchips">${grid.map(c => chip(c, 'winner')).join('')}</div>
    <h4 class="ph">Fastest lap</h4><div class="pchips">${grid.slice(0, 10).map(c => chip(c, 'fastest')).join('')}</div>
    <h4 class="ph">Safety car or VSC?</h4><div class="pchips"><button class="pchip" data-k="sc" data-c="yes">Yes</button><button class="pchip" data-k="sc" data-c="no">No</button></div>
    <div class="go"><button class="btn" id="pLock">Lock in and watch</button><button class="btn ghost" id="pSkip">Skip</button></div></div></div>`;
  host.querySelectorAll('.pchip').forEach(b => b.onclick = () => {
    const k = b.dataset.k; pick[k] = k === 'sc' ? b.dataset.c === 'yes' : b.dataset.c;
    host.querySelectorAll(`.pchip[data-k="${k}"]`).forEach(x => x.classList.toggle('sel', x === b));
  });
  const go = save => { if (save) g.predictions = pick; host.innerHTML = ''; g.paused = false; };
  $('#pLock').onclick = () => go(true); $('#pSkip').onclick = () => go(false);
}
