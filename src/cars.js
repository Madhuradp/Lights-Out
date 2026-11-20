// 2026-style single-seater, sculpted from lofted cross-sections. Forward = +X, left = -Z, up = +Y.
// Painted parts carry the team livery as vertex colours (two-tone), so each team shares one geometry.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { COMPOUNDS } from './data.js';

const box = (lx, ly, lz, x, y, z) => new THREE.BoxGeometry(lx, ly, lz).translate(x, y, z);

// ---------------- geometry helpers ----------------
// Loft a closed body through superellipse cross-sections.
// sec: { x, w (half width), ht (height above centre), hb (depth below centre), y (centre), z (centre offset), n (squareness: 2 = ellipse, 4+ = boxy) }
export function loft(sections, M = 20, capEnds = true) {
  const pos = [], idx = [];
  const ring = s => {
    for (let k = 0; k < M; k++) {
      const t = (k / M) * Math.PI * 2, c = Math.cos(t), sn = Math.sin(t);
      const e = 2 / (s.n || 2.5);
      const z = (s.z || 0) + s.w * Math.sign(c) * Math.pow(Math.abs(c), e);
      const y = s.y + (sn >= 0 ? s.ht : s.hb) * Math.sign(sn) * Math.pow(Math.abs(sn), e);
      pos.push(s.x, y, z);
    }
  };
  sections.forEach(ring);
  const S = sections.length;
  for (let i = 0; i < S - 1; i++) for (let k = 0; k < M; k++) {
    const a = i * M + k, b = (i + 1) * M + k, c = i * M + (k + 1) % M, d = (i + 1) * M + (k + 1) % M;
    idx.push(a, c, b, c, d, b);
  }
  if (capEnds) {
    for (const [i, flip] of [[0, false], [S - 1, true]]) {
      const s = sections[i]; const ci = pos.length / 3; pos.push(s.x, s.y + (s.ht - s.hb) * 0.0, s.z || 0);
      for (let k = 0; k < M; k++) { const a = i * M + k, b = i * M + (k + 1) % M; flip ? idx.push(ci, b, a) : idx.push(ci, a, b); }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}
// a thin aerofoil-ish plate spanning z0..z1 at chord c, thickness t, with an angle of attack
function plate(x, y, z0, z1, chord, thick, aoa = 0, sweepY = 0) {
  const g = new THREE.BoxGeometry(chord, thick, Math.abs(z1 - z0), 1, 1, 6);
  // round the leading edge a little by squashing the top front corners
  g.rotateZ(aoa);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const z = p.getZ(i); p.setY(i, p.getY(i) + sweepY * Math.pow(Math.abs(z) / (Math.abs(z1 - z0) / 2), 2)); }
  g.translate(x, y, (z0 + z1) / 2);
  g.computeVertexNormals();
  return g;
}
function tubeBetween(a, b, r) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b);
  const len = A.distanceTo(B);
  const g = new THREE.CylinderGeometry(r, r, len, 5, 1);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.clone().sub(A).normalize());
  g.applyQuaternion(q); const m = A.clone().add(B).multiplyScalar(0.5); g.translate(m.x, m.y, m.z);
  return g;
}
const prep = g => { const n = g.index ? g.toNonIndexed() : g; if (!n.attributes.uv) n.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(n.attributes.position.count * 2), 2)); return n; };
function paint(g, fn) {
  const p = g.attributes.position, col = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) { const c = fn(p.getX(i), p.getY(i), p.getZ(i)); col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}

// ---------------- shared geometry ----------------
const G = {};
function shared() {
  if (G.carbon) return G;
  // floor (top-view outline, extruded thin)
  const fl = new THREE.Shape();
  const pts = [[1.45, 0.24], [1.05, 0.62], [0.6, 0.8], [-1.2, 0.8], [-1.5, 0.56], [-2.35, 0.48]];
  fl.moveTo(pts[0][0], pts[0][1]); pts.slice(1).forEach(p => fl.lineTo(p[0], p[1]));
  [...pts].reverse().forEach(p => fl.lineTo(p[0], -p[1]));
  const floor = new THREE.ExtrudeGeometry(fl, { depth: 0.035, bevelEnabled: false }); floor.rotateX(Math.PI / 2); floor.translate(0, 0.085, 0);
  // diffuser ramp
  const diff = box(0.55, 0.02, 1.0, -2.3, 0.15, 0).rotateZ(0.32);
  // front wing: main plane with outward rise + endplates + nose pylons
  const fwMain = plate(2.86, 0.11, -0.98, 0.98, 0.42, 0.025, -0.06, 0.06);
  const fwEndL = box(0.45, 0.2, 0.018, 2.84, 0.18, 0.99), fwEndR = box(0.45, 0.2, 0.018, 2.84, 0.18, -0.99);
  const pylons = [box(0.3, 0.14, 0.03, 2.72, 0.2, 0.09), box(0.3, 0.14, 0.03, 2.72, 0.2, -0.09)];
  // rear wing (main plane) + endplates + swan neck + beam wing
  const rwMain = plate(-2.52, 0.94, -0.52, 0.52, 0.34, 0.03, 0.1);
  const rwEndL = box(0.58, 0.5, 0.02, -2.56, 0.9, 0.53), rwEndR = box(0.58, 0.5, 0.02, -2.56, 0.9, -0.53);
  const swan = box(0.08, 0.5, 0.04, -2.42, 0.72, 0).rotateZ(0.0);
  const beam = plate(-2.5, 0.42, -0.4, 0.4, 0.22, 0.025, 0.2);
  // suspension (wishbones and push rods) to the wheel centres
  const sus = [];
  for (const [x, zs] of [[1.75, 1], [1.75, -1], [-1.75, 1], [-1.75, -1]]) {
    const cx = x > 0 ? x - 0.25 : x + 0.35;
    sus.push(tubeBetween([cx + 0.18, 0.42, 0.22 * zs], [x, 0.44, 0.62 * zs], 0.018));
    sus.push(tubeBetween([cx - 0.18, 0.42, 0.22 * zs], [x, 0.44, 0.62 * zs], 0.018));
    sus.push(tubeBetween([cx + 0.18, 0.26, 0.2 * zs], [x, 0.26, 0.62 * zs], 0.018));
    sus.push(tubeBetween([cx - 0.18, 0.26, 0.2 * zs], [x, 0.26, 0.62 * zs], 0.018));
  }
  // mirrors on stalks
  const mirrors = [];
  for (const zs of [1, -1]) { mirrors.push(box(0.05, 0.055, 0.15, 0.78, 0.8, 0.6 * zs)); mirrors.push(tubeBetween([0.72, 0.7, 0.38 * zs], [0.78, 0.78, 0.55 * zs], 0.01)); }
  // halo: hoop + front pillar
  const hoopCurve = new THREE.CatmullRomCurve3([new THREE.Vector3(-0.15, 0.74, 0.36), new THREE.Vector3(0.1, 1.0, 0.34), new THREE.Vector3(0.45, 1.06, 0.2), new THREE.Vector3(0.62, 1.04, 0), new THREE.Vector3(0.45, 1.06, -0.2), new THREE.Vector3(0.1, 1.0, -0.34), new THREE.Vector3(-0.15, 0.74, -0.36)]);
  const hoop = new THREE.TubeGeometry(hoopCurve, 24, 0.024, 6, false);
  const pillar = tubeBetween([0.98, 0.72, 0], [0.62, 1.04, 0], 0.02);
  G.halo = mergeGeometries([hoop, pillar].map(prep));
  // airbox intake mouth + sidepod inlets (dark)
  const inlets = [];
  for (const zs of [1, -1]) inlets.push(new THREE.PlaneGeometry(0.15, 0.2).rotateY(Math.PI / 2).translate(0.705, 0.5, 0.56 * zs));
  inlets.push(new THREE.CircleGeometry(0.11, 12).scale(1, 0.8, 1.15).rotateY(Math.PI / 2).translate(0.01, 0.98, 0));
  G.inlets = mergeGeometries(inlets.map(prep));
  G.carbon = mergeGeometries([floor, diff, fwMain, fwEndL, fwEndR, ...pylons, rwMain, swan, beam, ...sus, ...mirrors].map(prep));
  G.endplates = mergeGeometries([rwEndL, rwEndR].map(prep));
  // tyre with rounded shoulders (lathe), rim + wheel cover
  const prof = [];
  const R = 0.36, W = 0.19, sh = 0.05;
  prof.push(new THREE.Vector2(0.23, -W));
  for (let k = 0; k <= 6; k++) { const a = -Math.PI / 2 + (k / 6) * Math.PI / 2; prof.push(new THREE.Vector2(R - sh + Math.cos(a) * sh, -W + sh + Math.sin(a) * sh)); }
  for (let k = 0; k <= 6; k++) { const a = (k / 6) * Math.PI / 2; prof.push(new THREE.Vector2(R - sh + Math.cos(a) * sh, W - sh + Math.sin(a) * sh)); }
  prof.push(new THREE.Vector2(0.23, W));
  G.tyre = new THREE.LatheGeometry(prof, 24).rotateX(Math.PI / 2);
  G.cover = new THREE.CylinderGeometry(0.235, 0.235, 0.36, 20).rotateX(Math.PI / 2);
  G.stripe = new THREE.TorusGeometry(0.3, 0.012, 4, 28);
  G.helmet = new THREE.SphereGeometry(0.135, 14, 10).scale(1.1, 1, 1).translate(0.16, 0.9, 0);
  G.visor = new THREE.SphereGeometry(0.137, 10, 6, -0.9, 1.8, 1.2, 0.55).scale(1.1, 1, 1).rotateY(Math.PI / 2).translate(0.16, 0.9, 0);
  G.flap = plate(0, 0, -0.5, 0.5, 0.24, 0.025, 0.25);
  G.fwing = plate(0, 0, -0.44, 0.44, 0.16, 0.022, -0.35);
  G.light = box(0.03, 0.06, 0.12, -2.86, 0.62, 0);
  return G;
}

// painted body per team (two-tone livery baked into vertex colours)
const bodyCache = {};
function bodyGeo(team) {
  if (bodyCache[team.id]) return bodyCache[team.id];
  const A = new THREE.Color(team.color), B = new THREE.Color(team.accent);
  const nose = loft([
    { x: 3.02, w: 0.06, ht: 0.04, hb: 0.04, y: 0.27, n: 2.4 },
    { x: 2.7, w: 0.11, ht: 0.075, hb: 0.07, y: 0.31, n: 2.6 },
    { x: 2.2, w: 0.17, ht: 0.11, hb: 0.1, y: 0.37, n: 2.8 },
    { x: 1.7, w: 0.23, ht: 0.15, hb: 0.13, y: 0.43, n: 3 },
    { x: 1.2, w: 0.29, ht: 0.18, hb: 0.17, y: 0.47, n: 3.2 },
    { x: 0.7, w: 0.35, ht: 0.22, hb: 0.2, y: 0.5, n: 3.5 },
    { x: 0.2, w: 0.39, ht: 0.22, hb: 0.22, y: 0.5, n: 3.5 },
    { x: -0.35, w: 0.39, ht: 0.26, hb: 0.22, y: 0.5, n: 3.5 },
    { x: -0.6, w: 0.3, ht: 0.22, hb: 0.2, y: 0.5, n: 3 },
  ]);
  const cover = loft([
    { x: 0.02, w: 0.15, ht: 0.12, hb: 0.12, y: 0.96, n: 2.6 },
    { x: -0.3, w: 0.2, ht: 0.16, hb: 0.3, y: 0.86, n: 2.6 },
    { x: -0.9, w: 0.23, ht: 0.13, hb: 0.3, y: 0.75, n: 2.6 },
    { x: -1.5, w: 0.18, ht: 0.11, hb: 0.25, y: 0.64, n: 2.4 },
    { x: -2.1, w: 0.1, ht: 0.08, hb: 0.18, y: 0.53, n: 2.2 },
    { x: -2.6, w: 0.05, ht: 0.05, hb: 0.1, y: 0.45, n: 2 },
  ]);
  const fin = loft([
    { x: -0.45, w: 0.012, ht: 0.015, hb: 0.02, y: 1.04, n: 2 },
    { x: -1.1, w: 0.012, ht: 0.07, hb: 0.12, y: 0.95, n: 4 },
    { x: -1.8, w: 0.012, ht: 0.1, hb: 0.16, y: 0.86, n: 6 },
    { x: -2.15, w: 0.012, ht: 0.08, hb: 0.14, y: 0.84, n: 6 },
  ], 8);
  const pods = [];
  for (const zs of [1, -1]) {
    pods.push(loft([
      { x: 0.7, w: 0.14, ht: 0.13, hb: 0.1, y: 0.49, z: 0.56 * zs, n: 5 },
      { x: 0.5, w: 0.23, ht: 0.16, hb: 0.12, y: 0.48, z: 0.56 * zs, n: 4.5 },
      { x: 0.0, w: 0.24, ht: 0.15, hb: 0.15, y: 0.45, z: 0.56 * zs, n: 4 },
      { x: -0.6, w: 0.21, ht: 0.11, hb: 0.15, y: 0.4, z: 0.53 * zs, n: 3.4 },
      { x: -1.2, w: 0.14, ht: 0.09, hb: 0.13, y: 0.35, z: 0.46 * zs, n: 2.6 },
      { x: -1.75, w: 0.06, ht: 0.05, hb: 0.08, y: 0.3, z: 0.36 * zs, n: 2.2 },
    ], 18));
  }
  const parts = [nose, cover, fin, ...pods].map(prep);
  const g = mergeGeometries(parts);
  paint(g, (x, y, z) => {
    if (x > 2.55) return B;                               // nose tip
    if (x > 1.25 && x < 1.45 && y > 0.5) return B;        // nose band
    if (y > 0.62 && x < -0.5 && x > -1.25 && (x + 0.5) > -(y - 0.62) * 3 - 0.75 && (x + 0.5) < -(y - 0.62) * 3 - 0.45) return B; // cover flash
    if (Math.abs(z) > 0.34 && y < 0.38 && x < 0.65) return B; // lower sidepods
    if (Math.abs(z) < 0.06 && y > 0.86 && x < -0.2) return B; // spine stripe
    if (Math.abs(z) < 0.02 && y > 0.7 && x < -1.6) return B;  // fin trailing edge
    return A;
  });
  return (bodyCache[team.id] = g);
}

// number and team-name decals
const decalCache = {};
function decalTex(text, w, h, fg, bg, bold = 900) {
  const key = text + w + h + fg + bg; if (decalCache[key]) return decalCache[key];
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d');
  if (bg) { g.fillStyle = bg; g.fillRect(0, 0, w, h); } else g.clearRect(0, 0, w, h);
  g.fillStyle = fg; g.font = `italic ${bold} ${Math.round(h * 0.72)}px Arial`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, w / 2, h / 2 + 2);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return (decalCache[key] = t);
}
const hexs = c => '#' + c.toString(16).padStart(6, '0');
const lum = c => { const k = new THREE.Color(c); return 0.3 * k.r + 0.59 * k.g + 0.11 * k.b; };

// soft contact shadow under each car (grounds the car even without shadow maps)
let blobTex = null;
function blob() {
  if (blobTex) return blobTex;
  const cv = document.createElement('canvas'); cv.width = 128; cv.height = 64; const g = cv.getContext('2d');
  g.setTransform(2, 0, 0, 1, 0, 0);
  const gr = g.createRadialGradient(32, 32, 2, 32, 32, 31); gr.addColorStop(0, 'rgba(0,0,0,0.7)'); gr.addColorStop(0.6, 'rgba(0,0,0,0.42)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  blobTex = new THREE.CanvasTexture(cv); return blobTex;
}

const mats = {};
function mat(key, make) { return mats[key] || (mats[key] = make()); }
let QUALITY = 'medium';
export function setCarQuality(q) { QUALITY = q; }

export function makeCar(team, opts = {}) {
  const S = shared();
  const root = new THREE.Group();
  const hi = QUALITY !== 'low';
  const paintMat = mat('paint' + hi, () => hi
    ? new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.38, metalness: 0.1, clearcoat: 0.8, clearcoatRoughness: 0.18, envMapIntensity: 0.7 })
    : new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.35, metalness: 0.3 }));
  const bodyMat = mat('flat' + team.color + hi, () => hi ? new THREE.MeshPhysicalMaterial({ color: team.color, roughness: 0.38, metalness: 0.1, clearcoat: 0.8, clearcoatRoughness: 0.18, envMapIntensity: 0.7 }) : new THREE.MeshStandardMaterial({ color: team.color, roughness: 0.35, metalness: 0.3 }));
  const accentMat = mat('acc' + team.accent, () => new THREE.MeshStandardMaterial({ color: team.accent, roughness: 0.4, metalness: 0.3 }));
  const carbon = mat('carbon', () => new THREE.MeshStandardMaterial({ color: 0x141518, roughness: 0.45, metalness: 0.2, envMapIntensity: 0.6 }));
  const dark = mat('dark', () => new THREE.MeshBasicMaterial({ color: 0x050506 }));
  const helmetMat = opts.helmetTex ? new THREE.MeshStandardMaterial({ map: opts.helmetTex, roughness: 0.25, metalness: 0.2 }) : accentMat;
  const visorMat = mat('visor', () => new THREE.MeshStandardMaterial({ color: 0x0a0d18, roughness: 0.05, metalness: 0.9 }));
  const tyreMat = mat('tyre', () => new THREE.MeshStandardMaterial({ color: 0x17171a, roughness: 0.85 }));
  const coverMat = mat('cover', () => new THREE.MeshStandardMaterial({ color: 0x24262b, roughness: 0.35, metalness: 0.6 }));

  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(6.2, 2.4).rotateX(-Math.PI / 2), mat('blob', () => new THREE.MeshBasicMaterial({ map: blob(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 })));
  shadow.position.y = 0.03; shadow.renderOrder = 1; root.add(shadow);
  const body = new THREE.Mesh(bodyGeo(team), paintMat); root.add(body);
  root.add(new THREE.Mesh(S.carbon, carbon));
  root.add(new THREE.Mesh(S.inlets, dark));
  root.add(new THREE.Mesh(S.endplates, accentMat));
  const halo = new THREE.Mesh(S.halo, carbon); root.add(halo);
  const helmet = new THREE.Mesh(S.helmet, helmetMat); root.add(helmet);
  const visor = new THREE.Mesh(S.visor, visorMat); root.add(visor);
  const flap = new THREE.Mesh(S.flap, bodyMat); flap.position.set(-2.58, 1.07, 0); root.add(flap);
  const fwL = new THREE.Mesh(S.fwing, bodyMat); fwL.position.set(2.8, 0.2, 0.52); root.add(fwL);
  const fwR = new THREE.Mesh(S.fwing, bodyMat); fwR.position.set(2.8, 0.2, -0.52); root.add(fwR);
  const lightMat = new THREE.MeshBasicMaterial({ color: 0x330000 });
  const light = new THREE.Mesh(S.light, lightMat); root.add(light);

  // decals: race number on the nose and fin, team name on the sidepods
  const num = String(opts.num ?? '');
  const light2 = lum(team.color) > 0.55;
  if (num) {
    const nt = decalTex(num, 128, 96, light2 ? '#111' : '#fff', null);
    const nm = new THREE.MeshBasicMaterial({ map: nt, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
    const n1 = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.25), nm); n1.rotation.set(-Math.PI / 2, 0, Math.PI / 2); n1.position.set(2.25, 0.483, 0); root.add(n1);
    for (const zs of [1, -1]) { const n2 = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.22), nm); n2.position.set(-1.75, 0.86, 0.014 * zs); n2.rotation.y = zs > 0 ? 0 : Math.PI; root.add(n2); }
  }
  const tn = decalTex(team.name.split(' ')[0].toUpperCase(), 512, 96, light2 ? '#111' : '#fff', null);
  const tm = new THREE.MeshBasicMaterial({ map: tn, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
  for (const zs of [1, -1]) { const d = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.17), tm); d.position.set(-0.25, 0.5, (0.56 + 0.245) * zs); d.rotation.y = zs > 0 ? 0 : Math.PI; root.add(d); }

  const wheels = [];
  const stripeMats = {};
  for (const [x, z, front] of [[1.75, 0.8, true], [1.75, -0.8, true], [-1.75, 0.8, false], [-1.75, -0.8, false]]) {
    const pivot = new THREE.Group(); pivot.position.set(x, 0.36, z);
    const spin = new THREE.Group(); pivot.add(spin);
    spin.add(new THREE.Mesh(S.tyre, tyreMat));
    const cov = new THREE.Mesh(S.cover, coverMat); spin.add(cov);
    const st = new THREE.Mesh(S.stripe, null); st.position.z = Math.sign(z) * 0.19; spin.add(st);
    // a spoke mark so the wheel visibly turns
    const mark = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.025, 0.005), accentMat); mark.position.set(0, 0.06, Math.sign(z) * 0.182); spin.add(mark);
    root.add(pivot);
    wheels.push({ pivot, spin, stripe: st, front });
  }
  const setCompound = c => {
    const col = COMPOUNDS[c]?.color || '#ffffff';
    const m = stripeMats[col] || (stripeMats[col] = new THREE.MeshBasicMaterial({ color: new THREE.Color(col) }));
    wheels.forEach(w => w.stripe.material = m);
  };
  setCompound('M');
  if (opts.shadows) root.traverse(o => { if (o.isMesh && !o.material?.transparent) o.castShadow = true; });
  root.rotation.order = 'YZX';
  let dmgShown = 0;
  const setDamage = d => {
    const lvl = d > 0.5 ? 2 : d > 0.2 ? 1 : 0;
    if (lvl === dmgShown) return; dmgShown = lvl;
    fwL.visible = lvl < 2;
    fwR.rotation.set(lvl ? 0.5 : 0, 0, lvl ? -0.25 : 0); fwR.position.y = lvl ? 0.09 : 0.2;
  };
  return { root, wheels, flap, helmet, visor, halo, body, light, lightMat, setCompound, setDamage, compound: 'M' };
}

export function makeSafetyCar() {
  const root = new THREE.Group();
  const silver = new THREE.MeshPhysicalMaterial({ color: 0xd0d4da, roughness: 0.25, metalness: 0.8, clearcoat: 1 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x0c0f14, roughness: 0.05, metalness: 0.8 });
  const bodyG = loft([
    { x: 2.35, w: 0.7, ht: 0.12, hb: 0.12, y: 0.42, n: 3 },
    { x: 1.9, w: 0.93, ht: 0.25, hb: 0.2, y: 0.5, n: 4 },
    { x: 0.6, w: 0.97, ht: 0.3, hb: 0.25, y: 0.55, n: 5 },
    { x: -1.4, w: 0.97, ht: 0.34, hb: 0.25, y: 0.55, n: 5 },
    { x: -2.25, w: 0.85, ht: 0.22, hb: 0.2, y: 0.55, n: 4 },
  ]);
  root.add(new THREE.Mesh(bodyG, silver));
  const cabin = loft([
    { x: 0.9, w: 0.62, ht: 0.02, hb: 0.02, y: 0.86, n: 4 },
    { x: 0.2, w: 0.72, ht: 0.25, hb: 0.05, y: 0.92, n: 4 },
    { x: -0.9, w: 0.7, ht: 0.25, hb: 0.05, y: 0.92, n: 4 },
    { x: -1.6, w: 0.6, ht: 0.02, hb: 0.02, y: 0.88, n: 4 },
  ]);
  root.add(new THREE.Mesh(cabin, glass));
  const bar = new THREE.Mesh(box(0.25, 0.1, 1.1, -0.3, 1.23, 0), new THREE.MeshBasicMaterial({ color: 0xff9900 }));
  root.add(bar);
  const tyre = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.8 });
  for (const [x, z] of [[1.45, 0.86], [1.45, -0.86], [-1.45, 0.86], [-1.45, -0.86]]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.28, 16).rotateX(Math.PI / 2), tyre); w.position.set(x, 0.34, z); root.add(w); }
  root.rotation.order = 'YZX';
  return { root, bar };
}
