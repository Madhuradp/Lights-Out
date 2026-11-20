// Trackside detail: raised kerbs, skid marks, painted run-off, barrier blocks, catch fences,
// marshal posts, overhead sponsor gantries and mowed grass verges.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { SPONSORS } from './data.js';

function canvasTex(w, h, draw, repeat = true) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8; t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function rnd(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

// a strip across lateral stations ds[j] (numbers or fn(i)) with heights hs[j], from sample i0 to i1
function profileStrip(T, i0, i1, ds, hs, uvLen) {
  const pos = [], uv = [], idx = [];
  const n = i1 - i0 + 1, cols = ds.length;
  let acc = 0;
  for (let k = 0; k < n; k++) {
    const i = ((i0 + k) % T.N + T.N) % T.N;
    for (let j = 0; j < cols; j++) {
      const d = typeof ds[j] === 'function' ? ds[j](i) : ds[j];
      pos.push(T.cx[i] + T.nx[i] * d, T.cy[i] + hs[j], T.cz[i] + T.nz[i] * d);
      uv.push(j / (cols - 1), acc / uvLen);
    }
    acc += T.ds;
  }
  for (let k = 0; k < n - 1; k++) for (let j = 0; j < cols - 1; j++) {
    const a = k * cols + j, b = a + cols;
    idx.push(a, b, a + 1, a + 1, b, b + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}
const brakeStart = (T, c) => { let sb = c.sStart; for (let k = 0; k < 120; k++) { const s = c.sStart - k * 4; if (T.lerpArr(T.profile, s - 4) <= T.lerpArr(T.profile, s) + 0.05) { sb = s; break; } } return sb; };
const idxOf = (T, s) => Math.floor(T.wrap(s) / T.ds);

export function addTrackside(T, group, opts) {
  const { quality, inPit, wallMat } = opts;
  const R = rnd(31);
  const hw = T.hw, L = T.L, P = T.pit;
  const lowQ = quality === 'low';
  const br = i => T.hasBridge && T.bridge[((i % T.N) + T.N) % T.N] === 1;
  const nearBr = (i0, i1) => { if (!T.hasBridge) return false; for (let i = i0; i <= i1; i += 2) if (br(i)) return true; return false; };

  // ---- raised kerbs with a saw-tooth outer edge ----
  const kerbTex = canvasTex(128, 32, (g, w, h) => {
    for (let k = 0; k < 2; k++) { g.fillStyle = k ? '#f2f2f2' : '#d71a1a'; g.fillRect(k * w / 2, 0, w / 2, h); }
    g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(0, 0, w, 3); g.fillRect(0, h - 4, w, 4);
    for (let x = 0; x < w; x += 8) { g.fillStyle = 'rgba(0,0,0,0.08)'; g.fillRect(x, 0, 2, h); }
  });
  kerbTex.rotation = Math.PI / 2; kerbTex.center.set(0.5, 0.5);
  const kerbMat = new THREE.MeshLambertMaterial({ map: kerbTex });
  const kg = [];
  const flagRanges = flag => { const out = []; let st = -1; let base = 0; while (flag(base) && base < T.N - 1) base++; if (base === T.N - 1 && flag(base)) return [[0, T.N]]; for (let n = 1; n <= T.N; n++) { const i = (base + n) % T.N; if (flag(i) && st < 0) st = base + n; if (!flag(i) && st >= 0) { out.push([st, base + n]); st = -1; } } return out; };
  for (const [a, b] of flagRanges(i => T.kerbL[i])) kg.push(profileStrip(T, a, b, [hw - 0.05, hw + 0.2, hw + 1.1, hw + 1.35], [0.02, 0.085, 0.085, 0.025], 6));
  for (const [a, b] of flagRanges(i => T.kerbR[i])) kg.push(profileStrip(T, a, b, [-hw - 1.35, -hw - 1.1, -hw - 0.2, -hw + 0.05], [0.025, 0.085, 0.085, 0.02], 6));
  if (kg.length) group.add(new THREE.Mesh(mergeGeometries(kg), kerbMat));

  // ---- skid marks into the heavy braking zones ----
  const skidTex = canvasTex(64, 512, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    for (let k = 0; k < 26; k++) {
      const x = R() * w, wd = 1 + R() * 3, y0 = R() * h * 0.6, len = h * (0.2 + R() * 0.8);
      const gr = g.createLinearGradient(0, y0, 0, y0 + len); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(0.3, `rgba(0,0,0,${0.3 + R() * 0.5})`); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.fillRect(x, y0, wd, len);
    }
  }, false);
  const skidMat = new THREE.MeshBasicMaterial({ map: skidTex, transparent: true, opacity: 0.55, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3 });
  const sg = [];
  for (const c of T.corners) {
    const vB = T.lerpArr(T.profile, c.sStart - 250), vMin = T.profile[c.apex % T.N];
    if (vB - vMin < 20) continue;
    const sb = brakeStart(T, c);
    const i0 = idxOf(T, sb - 10), i1raw = idxOf(T, c.sStart + 15); const i1 = i1raw < i0 ? i1raw + T.N : i1raw;
    if (i1 - i0 < 3 || i1 - i0 > 120) continue;
    for (const off of [-0.82, 0.82]) {
      const len = (i1 - i0) * T.ds;
      sg.push(profileStrip(T, i0, i1, [i => T.line[i] + off - 0.22, i => T.line[i] + off + 0.22], [0.026, 0.026], len));
    }
  }
  if (sg.length) group.add(new THREE.Mesh(mergeGeometries(sg), skidMat));

  // ---- painted run-off and barrier blocks on corner outsides (permanent circuits) ----
  const blocks = [], fences = [];
  if (!T.street) {
    const runTex = canvasTex(128, 128, (g, w, h) => {
      g.fillStyle = '#c42a2a'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#e9e9e9'; for (let k = -2; k < 6; k++) { g.beginPath(); g.moveTo(k * 32, 0); g.lineTo(k * 32 + 16, 0); g.lineTo(k * 32 + 16 + 64, h); g.lineTo(k * 32 + 64, h); g.fill(); }
    });
    const runMat = new THREE.MeshLambertMaterial({ map: runTex });
    const rg = [];
    for (const c of T.corners) {
      if (c.peak < 0.009) continue;
      if (nearBr(c.i0 - 10, c.i1 + 20)) continue;
      const out = -c.dir;
      const i0 = c.i0 - 2, i1 = c.i1 + Math.round(50 / T.ds);
      const d0 = hw + 1.35, d1 = hw + 4.2;
      rg.push(out > 0 ? profileStrip(T, i0, i1, [d0, d1], [0.018, 0.018], 4) : profileStrip(T, i0, i1, [-d1, -d0], [0.018, 0.018], 4));
      // barrier blocks in front of the wall on fast, heavy corners
      if (c.peak > 0.013) {
        const sA = c.sStart - 20, sB = c.sEnd + 50;
        for (let s = sA; s < sB; s += 1.05) {
          const o = {}; T.at(s, o);
          const wall = out > 0 ? T.wallL[o.i] : T.wallR[o.i];
          if (!out || inPit(o.i) || br(o.i)) continue;
          blocks.push({ x: o.x + o.nx * out * (wall - 0.55), y: o.y, z: o.z + o.nz * out * (wall - 0.55), h: Math.atan2(o.tz, o.tx), k: Math.round(s / 1.05) % 2 });
        }
        fences.push([c.i0 - 6, c.i1 + 14, out]);
      }
    }
    if (rg.length) group.add(new THREE.Mesh(mergeGeometries(rg), runMat));
  }
  if (blocks.length) {
    const bg = new THREE.BoxGeometry(1.0, 0.95, 0.95); bg.translate(0, 0.475, 0);
    const im = new THREE.InstancedMesh(bg, new THREE.MeshLambertMaterial({ color: 0xffffff }), blocks.length);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), one = new THREE.Vector3(1, 1, 1);
    const red = new THREE.Color(0xc8202a), blue = new THREE.Color(0x1d4fa8);
    blocks.forEach((b, n) => { q.setFromAxisAngle(up, -b.h); m.compose(new THREE.Vector3(b.x, b.y, b.z), q, one); im.setMatrixAt(n, m); im.setColorAt(n, b.k ? red : blue); });
    im.castShadow = quality === 'high'; group.add(im);
  }
  // catch fences above the walls on those corners
  if (fences.length && opts.fenceMat) {
    const fg = [];
    for (const [a, b, out] of fences) {
      const pos = [], uv = [], idx = [];
      let acc = 0; const n = b - a + 1;
      for (let k = 0; k < n; k++) {
        const i = ((a + k) % T.N + T.N) % T.N; const d = out * ((out > 0 ? T.wallL[i] : T.wallR[i]) + 0.25);
        const x = T.cx[i] + T.nx[i] * d, z = T.cz[i] + T.nz[i] * d, y = T.cy[i] + 1.0;
        pos.push(x, y, z, x, y + 3.2, z); uv.push(acc / 3.5, 0, acc / 3.5, 1); acc += T.ds;
      }
      for (let k = 0; k < n - 1; k++) { const q2 = k * 2; idx.push(q2, q2 + 2, q2 + 1, q2 + 1, q2 + 2, q2 + 3); }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
      fg.push(g);
    }
    group.add(new THREE.Mesh(mergeGeometries(fg), opts.fenceMat));
  }

  // ---- marshal posts every ~280 m ----
  {
    const posts = [];
    let side = 1;
    for (let s = 120; s < L - 60; s += 280) {
      const o = {}; T.at(s, o); side = -side;
      if (inPit(o.i) && side < 0) side = 1;
      if (br(o.i)) continue;
      const wall = side > 0 ? T.wallL[o.i] : T.wallR[o.i];
      const d = side * (wall + 2.2);
      posts.push({ x: o.x + o.nx * d, y: o.y, z: o.z + o.nz * d, h: Math.atan2(o.tz, o.tx) });
    }
    const hut = new THREE.BoxGeometry(1.8, 2.2, 1.6).translate(0, 1.1, 0);
    const roof = new THREE.BoxGeometry(2.1, 0.18, 1.9).translate(0, 2.29, 0);
    const pole = new THREE.CylinderGeometry(0.04, 0.04, 2.6, 5).translate(0.6, 3.5, 0.5);
    const flag = new THREE.BoxGeometry(0.02, 0.5, 0.7).translate(0.6, 4.5, 0.85);
    const mk = (geo, color) => { const im = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial({ color }), posts.length); const m = new THREE.Matrix4(), q = new THREE.Quaternion(); posts.forEach((p, n) => { q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), -p.h); m.compose(new THREE.Vector3(p.x, p.y, p.z), q, new THREE.Vector3(1, 1, 1)); im.setMatrixAt(n, m); }); group.add(im); };
    mk(hut, 0xf2f2ee); mk(roof, 0xff7a00); mk(pole, 0x888888); mk(flag, 0xffd400);
  }

  // ---- overhead sponsor gantries across the straights ----
  const gantries = [];
  {
    const zones = T.zones.map(([a, b]) => { const len = b > a ? b - a : b + L - a; return { mid: T.wrap(a + len * 0.55), len }; }).filter(z => z.len > 300);
    for (const z of zones.slice(0, 2)) {
      const rel = z.mid > L / 2 ? z.mid - L : z.mid; if (Math.abs(rel) < 380) continue;
      const o = {}; T.at(z.mid, o);
      if (nearBr(o.i - 30, o.i + 30)) continue;
      const wl = T.wallL[o.i], wr = T.wallR[o.i];
      const span = wl + wr + 1;
      const gr = new THREE.Group();
      const steel = new THREE.MeshLambertMaterial({ color: 0x3a3e46 });
      for (const sd of [wl + 0.5, -(wr + 0.5)]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.6, 8, 0.6), steel); p.position.set(0, 4, -sd); gr.add(p); }
      const beam = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.5, span), steel); beam.position.set(0, 8.1, -(wl - wr) / 2); gr.add(beam);
      const name = SPONSORS[Math.floor(R() * SPONSORS.length)];
      const bt = canvasTex(1024, 128, (g, w, h) => { const bgc = ['#e10600', '#0d1b2a', '#1d3557', '#ffb703', '#2a9d8f'][Math.floor(R() * 5)]; g.fillStyle = bgc; g.fillRect(0, 0, w, h); g.fillStyle = bgc === '#ffb703' ? '#111' : '#fff'; g.font = 'italic 900 92px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(name, w / 2, h / 2 + 4); }, false);
      const banner = new THREE.Mesh(new THREE.PlaneGeometry(span - 2, 1.6), new THREE.MeshBasicMaterial({ map: bt, side: THREE.DoubleSide }));
      banner.position.set(0.47, 7.0, -(wl - wr) / 2); banner.rotation.y = Math.PI / 2; gr.add(banner);
      const banner2 = banner.clone(); banner2.position.x = -0.47; gr.add(banner2);
      gr.position.set(o.x, o.y, o.z); gr.rotation.y = -Math.atan2(o.tz, o.tx);
      group.add(gr); gantries.push(gr);
    }
  }

  // ---- mowed grass verges (stripes run along the track) ----
  if (!T.street && !lowQ) {
    const mow = canvasTex(256, 64, (g, w, h) => {
      for (let k = 0; k < 8; k++) { g.fillStyle = k % 2 ? '#3f7d2b' : '#4b8f33'; g.fillRect(k * w / 8, 0, w / 8, h); }
      for (let i = 0; i < 3000; i++) { const v = R(); g.fillStyle = `rgba(${30 + v * 40},${80 + v * 60},${20 + v * 20},0.35)`; g.fillRect(R() * w, R() * h, 1, 2); }
    });
    const mm = new THREE.MeshLambertMaterial({ map: mow });
    const vg = [];
    for (const [a, b] of flagRanges(i => !br(i))) vg.push(profileStrip(T, a, b, [i => T.wallL[i] + 0.4, i => T.wallL[i] + 26], [-0.28, -0.3], 18));
    for (const [a, b] of flagRanges(i => !inPit(i) && !br(i))) vg.push(profileStrip(T, a, b, [i => -T.wallR[i] - 26, i => -T.wallR[i] - 0.4], [-0.3, -0.28], 18));
    const verge = new THREE.Mesh(mergeGeometries(vg), mm); verge.receiveShadow = true; group.add(verge);
  }
  return { gantries };
}
