// Builds the 3D circuit: road, kerbs, lines, run-off, walls with ad boards, pit lane,
// garages, start gantry, grandstands, marker boards, terrain, trees/buildings and sky.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { TEAMS, SPONSORS } from './data.js';
import { S } from './ctx.js';
import { addTrackside } from './trackside.js';

const TIMES = {
  afternoon: { skyTop: 0x2f6fc0, skyBot: 0xbcd6ee, fog: 0xc4d8ea, sun: 0xfff2dd, sunI: 2.6, hemiS: 0xbfd8ff, hemiG: 0x56683c, hemiI: 1.05, sunPos: [0.5, 0.75, 0.35], exposure: 1.0 },
  midday:    { skyTop: 0x1f6fd6, skyBot: 0xcfe6fa, fog: 0xd4e7f6, sun: 0xffffff, sunI: 2.9, hemiS: 0xcfe4ff, hemiG: 0x6a6f63, hemiI: 1.1, sunPos: [0.2, 0.92, 0.3], exposure: 1.0 },
  golden:    { skyTop: 0x3c5d9a, skyBot: 0xf3c48c, fog: 0xe8c39b, sun: 0xffc27a, sunI: 2.5, hemiS: 0xffd7a8, hemiG: 0x4c5a32, hemiI: 0.9, sunPos: [-0.75, 0.32, 0.4], exposure: 1.05 },
  // night race: the 'sun' is the floodlight rig (straight down, cool white); the sky shows a moon
  night:     { skyTop: 0x03050c, skyBot: 0x1c2438, fog: 0x0e1322, sun: 0xeef3ff, sunI: 2.1, hemiS: 0x8094c0, hemiG: 0x3a3430, hemiI: 1.15, sunPos: [0.12, 1, 0.18], moonPos: [-0.5, 0.35, 0.6], exposure: 1.0, night: true },
};

// Look of each venue type.
const THEMES = {
  park:     { hills: 6,  edge: 40,  trees: 'cone',  treeK: 1,   treeHue: [0.26, 0.08], treeL: [0.22, 0.12], mount: 250 },
  hills:    { hills: 26, edge: 120, trees: 'round', treeK: 1,   sakura: true, mount: 500, wheel: true },
  forest:   { hills: 42, edge: 170, trees: 'cone',  treeK: 2.1, treeHue: [0.30, 0.06], treeL: [0.15, 0.09], treeScale: 1.45, treeNear: 3, mount: 480, mountCol: 0x5d6f63 },
  airfield: { hills: 2,  edge: 12,  trees: 'round', treeK: 0.3, treeHue: [0.24, 0.07], treeL: [0.22, 0.1], mount: 110, runways: true, hangars: true },
  bowl:     { hills: 30, edge: 150, trees: 'round', treeK: 0.9, treeHue: [0.21, 0.1], treeL: [0.2, 0.14], mount: 360, cityRing: true },
  harbour:  { hills: 6,  edge: 40,  paved: true, buildings: true, water: true, mount: 250 },
  city:     { hills: 0,  edge: 0,   paved: true, buildings: true, tall: true, water: true, mount: 0, wheel: true },
};

function canvasTex(w, h, draw, repeat = true) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'); draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  t.anisotropy = 8; t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function rnd(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

// Asphalt from one height field: aggregate stones in binder. Gives matching colour, surface
// relief (normal map) and roughness (polished stones shine, binder is matte), all tileable.
function asphaltMaps(size) {
  const R = rnd(11), N = size, h = new Float32Array(N * N), tone = new Float32Array(N * N), pol = new Float32Array(N * N);
  // stones
  const nStones = Math.round(N * N / 7);
  for (let k = 0; k < nStones; k++) {
    const cx = R() * N, cy = R() * N, r = 0.55 + Math.pow(R(), 2.6) * 1.9, ht = 0.35 + R() * 0.65, tn = 0.8 + R() * 0.35, pl = R() < 0.25 ? 1 : 0.3;
    const x0 = Math.floor(cx - r - 1), x1 = Math.ceil(cx + r + 1), y0 = Math.floor(cy - r - 1), y1 = Math.ceil(cy + r + 1);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const dx = x - cx, dy = y - cy, d = Math.sqrt(dx * dx + dy * dy) / r; if (d > 1) continue;
      const i = ((y + N) % N) * N + ((x + N) % N); const v = ht * Math.sqrt(1 - d * d);
      if (v > h[i]) { h[i] = v; tone[i] = tn; pol[i] = pl; }
    }
  }
  // binder noise + low-frequency tone (tileable sine sums)
  const lf = (x, y) => 0.5 + 0.25 * Math.sin(x / N * 6.283 * 2 + 1.3) * Math.cos(y / N * 6.283 * 3 + 0.4) + 0.25 * Math.sin((x + y) / N * 6.283 * 3 + 2.1);
  const alb = document.createElement('canvas'); alb.width = alb.height = N; const ga = alb.getContext('2d'); const ia = ga.createImageData(N, N);
  const nrm = document.createElement('canvas'); nrm.width = nrm.height = N; const gn = nrm.getContext('2d'); const inn = gn.createImageData(N, N);
  const rgh = document.createElement('canvas'); rgh.width = rgh.height = N; const gr = rgh.getContext('2d'); const ir = gr.createImageData(N, N);
  for (let i = 0; i < N * N; i++) if (h[i] === 0) { h[i] = R() * 0.12; tone[i] = 0.55 + R() * 0.1; }
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const i = y * N + x, j = i * 4;
    const l = lf(x, y);
    const base = h[i] > 0.15 ? 84 * tone[i] : 66 * tone[i] / 0.6;
    const v = Math.max(20, Math.min(200, base * (0.9 + 0.2 * l)));
    ia.data[j] = v; ia.data[j + 1] = v; ia.data[j + 2] = v * 1.03; ia.data[j + 3] = 255;
    const hl = h[y * N + (x - 1 + N) % N], hr = h[y * N + (x + 1) % N], hu = h[((y - 1 + N) % N) * N + x], hd = h[((y + 1) % N) * N + x];
    let nx = (hl - hr) * 1.4, ny = (hu - hd) * 1.4, nz = 1; const ln = Math.hypot(nx, ny, nz); nx /= ln; ny /= ln; nz /= ln;
    inn.data[j] = (nx * 0.5 + 0.5) * 255; inn.data[j + 1] = (ny * 0.5 + 0.5) * 255; inn.data[j + 2] = (nz * 0.5 + 0.5) * 255; inn.data[j + 3] = 255;
    const rv = h[i] > 0.15 ? (pol[i] > 0.5 ? 0.55 : 0.8) : 0.97; ir.data[j] = ir.data[j + 1] = ir.data[j + 2] = rv * 255; ir.data[j + 3] = 255;
  }
  ga.putImageData(ia, 0, 0); gn.putImageData(inn, 0, 0); gr.putImageData(ir, 0, 0);
  const mk = (c, srgb) => { const tx = new THREE.CanvasTexture(c); tx.wrapS = tx.wrapT = THREE.RepeatWrapping; tx.anisotropy = 8; if (srgb) tx.colorSpace = THREE.SRGBColorSpace; return tx; };
  return { map: mk(alb, true), normal: mk(nrm), rough: mk(rgh) };
}

// Decode an RGBE PNG sky (see tools/envgen.py) into a half-float equirect texture, rotated so
// the photo's sun sits where the game's sun is.
async function loadHDRIEnv(name, sunDir) {
  try {
    const { ENVMAPS } = await import('./envmaps.js');
    const e = ENVMAPS[name]; if (!e) return null;
    const img = new Image(); img.src = e.uri; await img.decode();
    const W = img.width, H = img.height; const c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0); const px = g.getImageData(0, 0, W, H).data;
    // three's equirect: u = atan2(dir.z, dir.x) / 2pi + 0.5. Shift columns so the photo sun lands on ours.
    const phiPhoto = e.sunAz - Math.PI, phiGame = Math.atan2(sunDir.z, sunDir.x);
    const shift = Math.round(((phiGame - phiPhoto) / (2 * Math.PI)) * W);
    const data = new Uint16Array(W * H * 4); const toH = THREE.DataUtils.toHalfFloat;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const si = (y * W + x) * 4; const ex = px[si + 3]; const f = ex ? Math.pow(2, ex - 128) / 255 : 0;
      const dx = ((x + shift) % W + W) % W, dy = H - 1 - y; const di = (dy * W + dx) * 4;
      data[di] = toH(px[si] * f); data[di + 1] = toH(px[si + 1] * f); data[di + 2] = toH(px[si + 2] * f); data[di + 3] = toH(1);
    }
    const tx = new THREE.DataTexture(data, W, H, THREE.RGBAFormat, THREE.HalfFloatType);
    tx.mapping = THREE.EquirectangularReflectionMapping; tx.colorSpace = THREE.LinearSRGBColorSpace;
    tx.magFilter = tx.minFilter = THREE.LinearFilter; tx.needsUpdate = true;
    return tx;
  } catch (err) { return null; }
}

export function makeTextures(quality) {
  const R = rnd(7);
  const asphalt = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#5b5d61'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 14000; i++) { const v = 78 + R() * 40; g.fillStyle = `rgb(${v},${v},${v + 3})`; g.fillRect(R() * w, R() * h, 1, 1); }
    for (let i = 0; i < 25; i++) { g.fillStyle = 'rgba(40,40,44,0.12)'; g.beginPath(); g.arc(R() * w, R() * h, 4 + R() * 10, 0, 7); g.fill(); }
  });
  const grass = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#3f7a2c'; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(255,255,255,0.05)'; g.fillRect(0, 0, w / 2, h);
    for (let i = 0; i < 9000; i++) { const v = R(); g.fillStyle = `rgba(${40 + v * 40},${90 + v * 60},${30 + v * 20},0.5)`; g.fillRect(R() * w, R() * h, 1, 2 + R() * 2); }
  });
  const kerb = canvasTex(64, 16, (g) => { g.fillStyle = '#d81e1e'; g.fillRect(0, 0, 32, 16); g.fillStyle = '#f4f4f4'; g.fillRect(32, 0, 32, 16); g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(0, 13, 64, 3); });
  const gravel = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#b9a47e'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 12000; i++) { const v = 140 + R() * 80; g.fillStyle = `rgb(${v},${v * 0.88},${v * 0.66})`; g.fillRect(R() * w, R() * h, 1.5, 1.5); }
  });
  const checker = canvasTex(64, 64, (g) => { for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { g.fillStyle = (x + y) % 2 ? '#111' : '#f5f5f5'; g.fillRect(x * 8, y * 8, 8, 8); } });
  const ads = canvasTex(2048, 64, (g, w, h) => {
    const cols = ['#0d1b2a', '#e63946', '#1d3557', '#f1faee', '#ffb703', '#023047', '#2a9d8f', '#111111'];
    const per = w / 8;
    for (let i = 0; i < 8; i++) {
      const bg = cols[i % cols.length]; g.fillStyle = bg; g.fillRect(i * per, 0, per, h);
      g.fillStyle = (bg === '#f1faee' || bg === '#ffb703') ? '#111' : '#fff';
      g.font = 'bold 38px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(SPONSORS[(i * 3) % SPONSORS.length], i * per + per / 2, h / 2 + 2);
    }
  });
  const fence = canvasTex(64, 64, (g, w, h) => {
    g.clearRect(0, 0, w, h); g.strokeStyle = 'rgba(200,205,210,0.75)'; g.lineWidth = 2;
    for (let i = -64; i < 128; i += 12) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 64, 64); g.stroke(); g.beginPath(); g.moveTo(i + 64, 0); g.lineTo(i, 64); g.stroke(); }
  });
  const crowd = canvasTex(256, 64, (g, w, h) => {
    g.fillStyle = '#2a2e36'; g.fillRect(0, 0, w, h);
    const pal = ['#e63946', '#f1faee', '#ffb703', '#219ebc', '#ff7a00', '#10b9a8', '#6a2bd6', '#d3132b', '#222', '#f5c400'];
    for (let i = 0; i < 1400; i++) { g.fillStyle = pal[Math.floor(R() * pal.length)]; g.fillRect(R() * w, R() * h, 2.5, 3.5); }
  });
  const windows = canvasTex(64, 128, (g, w, h) => {
    g.fillStyle = '#d9cfbf'; g.fillRect(0, 0, w, h);
    for (let y = 6; y < h; y += 16) for (let x = 6; x < w; x += 14) { g.fillStyle = R() < 0.3 ? '#38506b' : '#5b7896'; g.fillRect(x, y, 8, 10); }
  });
  const nightWindows = canvasTex(64, 128, (g, w, h) => {
    g.fillStyle = '#141820'; g.fillRect(0, 0, w, h);
    for (let y = 6; y < h; y += 16) for (let x = 6; x < w; x += 14) { const r = R(); g.fillStyle = r < 0.45 ? '#ffd890' : r < 0.6 ? '#bfe3ff' : '#20262f'; g.fillRect(x, y, 8, 10); }
  });
  const asph = quality && quality !== 'low' ? asphaltMaps(quality === 'high' ? 512 : 384) : null;
  return { asphalt: asph ? asph.map : asphalt, asphaltN: asph && asph.normal, asphaltR: asph && asph.rough, grass, kerb, gravel, checker, ads, fence, crowd, windows, nightWindows };
}

// ---------- geometry helpers along the track ----------
function idxRange(T, s0, s1) {
  const i0 = Math.floor(T.wrap(s0) / T.ds); let i1 = Math.ceil(T.wrap(s1) / T.ds);
  if (i1 <= i0) i1 += T.N;
  return [i0, i1];
}
// horizontal strip between lateral offsets dA..dB (numbers or fn(i)) from s-index i0..i1
function stripGeo(T, i0, i1, dA, dB, cols, yOff, uvLen, uScale, colorFn) {
  const pos = [], uv = [], col = [], idx = [];
  const n = i1 - i0 + 1;
  let acc = 0;
  for (let k = 0; k < n; k++) {
    const i = (i0 + k) % T.N;
    const a = typeof dA === 'function' ? dA(i) : dA, b = typeof dB === 'function' ? dB(i) : dB;
    for (let j = 0; j <= cols; j++) {
      const d = a + (b - a) * (j / cols);
      pos.push(T.cx[i] + T.nx[i] * d, T.cy[i] + yOff, T.cz[i] + T.nz[i] * d);
      uv.push((j / cols) * uScale, acc / uvLen);
      if (colorFn) { const c = colorFn(i, d); col.push(c, c, c); }
    }
    acc += T.ds;
  }
  for (let k = 0; k < n - 1; k++) for (let j = 0; j < cols; j++) {
    const a = k * (cols + 1) + j, b = a + cols + 1;
    idx.push(a, b, a + 1, a + 1, b, b + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  if (colorFn) g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}
// vertical wall at lateral offset d (fn or number), from y0 to y0+h
function wallGeo(T, i0, i1, d, y0, h, uvLen, flip) {
  const pos = [], uv = [], idx = [];
  const n = i1 - i0 + 1; let acc = 0;
  for (let k = 0; k < n; k++) {
    const i = (i0 + k) % T.N; const dd = typeof d === 'function' ? d(i) : d;
    const x = T.cx[i] + T.nx[i] * dd, z = T.cz[i] + T.nz[i] * dd, y = T.cy[i] + y0;
    const u = (flip ? -acc : acc) / uvLen; pos.push(x, y, z, x, y + h, z); uv.push(u, 0, u, 1); acc += T.ds;
  }
  // front faces point to the right of the lap direction; flip=true walls face left (toward the track from the right side)
  for (let k = 0; k < n - 1; k++) { const a = k * 2; if (flip) idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); else idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}
// ranges of indices where flag(i) is true
function flagRanges(T, flag) {
  const out = []; let st = -1;
  let base = 0; while (flag(base) && base < T.N - 1) base++;
  if (base === T.N - 1 && flag(base)) return [[0, T.N]]; // the whole lap
  for (let n = 1; n <= T.N; n++) { const i = (base + n) % T.N; if (flag(i) && st < 0) st = base + n; if (!flag(i) && st >= 0) { out.push([st, base + n]); st = -1; } }
  return out;
}

export function buildScenery(T, scene, quality) {
  const tex = makeTextures(quality);
  const circ = T.circ;
  const tod = TIMES[circ.time] || TIMES.afternoon;
  const TH = THEMES[circ.theme] || THEMES.park;
  const night = !!tod.night;
  const group = new THREE.Group(); scene.add(group);
  const hw = T.hw, P = T.pit, L = T.L;

  // physical walls per side (pit lane widens the right side)
  T.wallL = new Float32Array(T.N).fill(hw + T.runoff);
  T.wallR = new Float32Array(T.N).fill(hw + T.runoff);
  {
    const [a, b] = idxRange(T, L + P.sIn, P.sOut);
    for (let k = a; k <= b; k++) T.wallR[k % T.N] = Math.max(T.wallR[k % T.N], -P.wallD - 0.3);
  }
  // bridges are only as wide as the road plus a parapet
  if (T.hasBridge) for (let i = 0; i < T.N; i++) if (T.bridge[i]) { T.wallL[i] = hw + 1.4; T.wallR[i] = hw + 1.4; }

  // ---- sky ----
  const skyGeo = new THREE.SphereGeometry(6000, 32, 16);
  const sunDir = new THREE.Vector3(...tod.sunPos).normalize();
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color(tod.skyTop) }, bot: { value: new THREE.Color(tod.skyBot) }, sun: { value: night ? new THREE.Vector3(...tod.moonPos).normalize() : sunDir }, sunCol: { value: new THREE.Color(night ? 0xcfd8ff : tod.sun) }, dark: { value: 0 }, time: { value: 0 }, cover: { value: circ.time === 'golden' ? 0.35 : 0.2 }, night: { value: night ? 1 : 0 } },
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: `uniform vec3 top; uniform vec3 bot; uniform vec3 sun; uniform vec3 sunCol; uniform float dark; uniform float time; uniform float cover; uniform float night; varying vec3 vP;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y); }
      float fbm(vec2 p){ float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; } return v; }
      void main(){
        float h = clamp(vP.y * 1.6 + 0.08, 0.0, 1.0); vec3 c = mix(bot, top, pow(h, 0.7));
        float s = max(dot(vP, sun), 0.0);
        if (vP.y > 0.0) {
          vec2 uv = vP.xz / (vP.y + 0.12) * 1.3 + vec2(time * 0.006, time * 0.003);
          float n = fbm(uv);
          float cv = mix(0.62, 0.28, clamp(cover + dark, 0.0, 1.0));
          float cl = smoothstep(cv, cv + 0.22, n) * smoothstep(0.0, 0.1, vP.y);
          vec3 cc = mix(vec3(1.0), vec3(0.5, 0.53, 0.57), dark) * (0.78 + 0.25 * n) + sunCol * pow(s, 4.0) * 0.35;
          cc = mix(cc, vec3(0.10, 0.10, 0.14) + vec3(0.22, 0.12, 0.05) * (1.0 - smoothstep(0.0, 0.35, vP.y)), night);
          if (night > 0.5) { vec2 g = floor(vP.xz / max(vP.y, 0.05) * 220.0); float st = step(0.9965, hash(g)) * smoothstep(0.08, 0.4, vP.y); c += vec3(st) * (1.0 - cl) * 0.9; }
          c = mix(c, cc, cl * 0.9);
          s *= 1.0 - cl * 0.85;
        }
        c += sunCol * pow(s, 600.0) * 2.0 + sunCol * pow(s, 8.0) * 0.18 * (1.0 - night * 0.8);
        c += vec3(0.30, 0.17, 0.08) * night * (1.0 - smoothstep(0.0, 0.25, vP.y)) * 0.6; // city glow
        c = mix(c, vec3(0.42, 0.45, 0.5), dark * 0.85);
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  const sky = new THREE.Mesh(skyGeo, skyMat); sky.renderOrder = -1; scene.add(sky);
  scene.fog = new THREE.Fog(tod.fog, night ? 600 : 450, night ? 3200 : 4200);
  scene.background = new THREE.Color(tod.fog);

  // ---- lights ----
  const hemi = new THREE.HemisphereLight(tod.hemiS, tod.hemiG, tod.hemiI); scene.add(hemi);
  const sun = new THREE.DirectionalLight(tod.sun, tod.sunI); sun.position.copy(sunDir).multiplyScalar(500); scene.add(sun); scene.add(sun.target);
  if (quality !== 'low') {
    sun.castShadow = true; const ms = quality === 'high' ? 2048 : 1024; sun.shadow.mapSize.set(ms, ms);
    const sc = sun.shadow.camera; const e = quality === 'high' ? 55 : 38; sc.left = -e; sc.right = e; sc.top = e; sc.bottom = -e; sc.near = 10; sc.far = 900;
    sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03;
  }
  // image-based lighting: a blurred copy of this sky gives cars and wet tarmac believable reflections
  if (S.renderer) {
    const envScene = new THREE.Scene();
    const envSky = new THREE.Mesh(new THREE.SphereGeometry(50, 32, 16), skyMat.clone()); envSky.material.uniforms = THREE.UniformsUtils.clone(skyMat.uniforms);
    envScene.add(envSky);
    const groundCol = TH.paved ? (night ? 0x22242a : 0x6e6c66) : 0x3d5a2c;
    if (night) for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2; const b = new THREE.Mesh(new THREE.SphereGeometry(2.2, 8, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xfff4e0).multiplyScalar(6) })); b.position.set(Math.cos(a) * 30, 14, Math.sin(a) * 30); envScene.add(b); }
    const gnd = new THREE.Mesh(new THREE.CircleGeometry(48, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: groundCol })); gnd.position.y = -2; envScene.add(gnd);
    const asph = new THREE.Mesh(new THREE.CircleGeometry(14, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x3a3b3e })); asph.position.y = -1.9; envScene.add(asph);
    const pm = new THREE.PMREMGenerator(S.renderer);
    const rt = pm.fromScene(envScene, 0.02);
    scene.environment = rt.texture; scene.environmentIntensity = 0.75;
    pm.dispose();
    // real sky photo (Poly Haven HDRI, CC0) for reflections and ambient light, when the venue has one
    const envName = { park: 'park', airfield: 'park', harbour: 'venice', hills: 'sunrise', bowl: 'sunrise', forest: 'forest' }[circ.theme];
    if (envName && !night && quality !== 'low' && !window.__noHDRI) loadHDRIEnv(envName, sunDir).then(tx => {
      if (!tx || !S.renderer || S.scene !== scene) return;
      const pm2 = new THREE.PMREMGenerator(S.renderer); const rt2 = pm2.fromEquirectangular(tx); pm2.dispose(); tx.dispose();
      const old = scene.environment; scene.environment = rt2.texture; scene.environmentIntensity = 0.32; if (old) old.dispose();
    });
    hemi.intensity = tod.hemiI * 0.55;
  }

  // ---- terrain ----
  let minX = 1e9, maxX = -1e9, minZ = 1e9, maxZ = -1e9;
  for (let i = 0; i < T.N; i++) { minX = Math.min(minX, T.cx[i]); maxX = Math.max(maxX, T.cx[i]); minZ = Math.min(minZ, T.cz[i]); maxZ = Math.max(maxZ, T.cz[i]); }
  const pad = 1400;
  const gx0 = minX - pad, gx1 = maxX + pad, gz0 = minZ - pad, gz1 = maxZ + pad;
  const res = quality === 'low' ? 90 : 140;
  const tg = new THREE.PlaneGeometry(gx1 - gx0, gz1 - gz0, res, res); tg.rotateX(-Math.PI / 2);
  tg.translate((gx0 + gx1) / 2, 0, (gz0 + gz1) / 2);
  const tp = tg.attributes.position;
  const R = rnd(11);
  const heightAt = (x, z) => {
    let best = 1e18, by = 0;
    for (let i = 0; i < T.N; i += 3) { const dx = x - T.cx[i], dz = z - T.cz[i]; const q = dx * dx + dz * dz; if (q < best) { best = q; by = T.cy[i]; } }
    const dist = Math.sqrt(best);
    if (T.hasBridge) { // under a bridge the ground follows the lower road
      const lim = (dist + 25) * (dist + 25);
      for (let i = 0; i < T.N; i += 3) { const dx = x - T.cx[i], dz = z - T.cz[i]; if (dx * dx + dz * dz < lim && T.cy[i] < by) by = T.cy[i]; }
    }
    const far = Math.min(1, Math.max(0, (dist - 60) / 500));
    const noise = (Math.sin(x * 0.004) * Math.cos(z * 0.0035) + 0.5 * Math.sin(x * 0.011 + z * 0.007)) * TH.hills;
    const edge = Math.min(1, Math.max(0, (dist - 700) / 700));
    return by * (1 - far * 0.5) - 0.35 + noise * far + edge * TH.edge * (0.6 + 0.4 * Math.sin(x * 0.002 + z * 0.003));
  };
  for (let i = 0; i < tp.count; i++) tp.setY(i, heightAt(tp.getX(i), tp.getZ(i)));
  tg.computeVertexNormals();
  const grassTex = tex.grass; grassTex.repeat.set((gx1 - gx0) / 24, (gz1 - gz0) / 24);
  const groundCol = TH.paved ? (night ? 0x3a3c42 : 0x8b8f86) : 0xffffff;
  const groundMat = new THREE.MeshLambertMaterial({ map: TH.paved ? null : grassTex, color: groundCol });
  if (!TH.paved && quality !== 'low') groundMat.onBeforeCompile = sh => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWp;').replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWp = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vWp;\nfloat hsh(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}\nfloat vn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hsh(i),hsh(i+vec2(1,0)),f.x),mix(hsh(i+vec2(0,1)),hsh(i+vec2(1,1)),f.x),f.y);}')
      .replace('#include <map_fragment>', '#include <map_fragment>\n{ float m = vn(vWp.xz * 0.012) * 0.6 + vn(vWp.xz * 0.05) * 0.4; diffuseColor.rgb *= mix(vec3(0.78, 0.86, 0.72), vec3(1.12, 1.06, 0.92), m); }');
  };
  const ground = new THREE.Mesh(tg, groundMat);
  ground.receiveShadow = true; group.add(ground);
  T.heightAt = heightAt;

  if (circ.theme === 'harbour') {
    const water = new THREE.Mesh(new THREE.PlaneGeometry(9000, 3000), new THREE.MeshStandardMaterial({ color: 0x1b6f9c, roughness: 0.15, metalness: 0.3 }));
    water.rotation.x = -Math.PI / 2; water.position.set((minX + maxX) / 2, 0.05, maxZ + 70 + 1500); group.add(water);
    // yachts
    const yg = mergeGeometries([new THREE.BoxGeometry(18, 3, 5).translate(0, 1.5, 0), new THREE.BoxGeometry(9, 3, 4).translate(-2, 4.5, 0)]);
    const yachts = new THREE.InstancedMesh(yg, new THREE.MeshLambertMaterial({ color: 0xf4f4f0 }), 40);
    const m = new THREE.Matrix4();
    for (let i = 0; i < 40; i++) { m.makeRotationY(R() * 0.4 - 0.2); m.setPosition(minX + R() * (maxX - minX), 0, maxZ + 90 + R() * 260); yachts.setMatrixAt(i, m); }
    group.add(yachts);
  }

  // ---- road ----
  const asphalt = tex.asphalt; asphalt.repeat.set(1, 1);
  const roadMat = new THREE.MeshStandardMaterial({ map: asphalt, vertexColors: true, roughness: 0.92, metalness: 0.0, color: 0xc8c8c8, envMapIntensity: 0.45 });
  if (tex.asphaltN) { roadMat.normalMap = tex.asphaltN; roadMat.normalScale.set(0.6, 0.6); roadMat.roughnessMap = tex.asphaltR; roadMat.roughness = 1; }
  T.roadMat = roadMat;
  const lineAt = i => T.line[i];
  const road = new THREE.Mesh(stripGeo(T, 0, T.N, -hw - 0.2, hw + 0.2, 12, 0.02, 5, 3.2, (i, d) => {
    const dl = d - lineAt(i); const rub = Math.exp(-(dl * dl) / (2 * 1.4 * 1.4));
    return 0.95 - 0.22 * rub + (Math.abs(d) > hw - 0.6 ? 0.06 : 0);
  }), roadMat);
  road.receiveShadow = true; group.add(road);

  // white edge lines
  const white = new THREE.MeshLambertMaterial({ color: 0xf2f2f2 });
  group.add(new THREE.Mesh(mergeGeometries([stripGeo(T, 0, T.N, hw - 0.32, hw - 0.08, 1, 0.035, 10, 1), stripGeo(T, 0, T.N, -hw + 0.08, -hw + 0.32, 1, 0.035, 10, 1)]), white));

  // gravel traps on corner exits (non-street)
  if (!T.street) {
    const gm = new THREE.MeshLambertMaterial({ map: tex.gravel }); tex.gravel.repeat.set(1, 1);
    const gg = [];
    for (const c of T.corners) {
      if (c.peak < 0.012) continue;
      const a = c.i0 - 4, b = c.i1 + Math.round(60 / T.ds);
      if (T.hasBridge && [a, b, (a + b) >> 1].some(i => T.bridge[(i + T.N) % T.N])) continue;
      const out = -c.dir; // outside of the corner
      const d0 = hw + 4.2, d1 = hw + T.runoff - 1.5;
      if (d1 - d0 < 3) continue;
      if (out > 0) gg.push(stripGeo(T, a, b, d0, d1, 2, 0.03, 12, 4)); else gg.push(stripGeo(T, a, b, -d1, -d0, 2, 0.03, 12, 4));
    }
    if (gg.length) group.add(new THREE.Mesh(mergeGeometries(gg), gm));
    // tarmac run-off apron beside the track
    const apron = new THREE.MeshLambertMaterial({ color: 0x55585c });
    const ap = [];
    for (const [a, b] of flagRanges(T, i => !T.bridge || !T.bridge[i])) ap.push(stripGeo(T, a, b, hw + 0.2, hw + 2.2, 1, 0.012, 10, 1), stripGeo(T, a, b, -hw - 2.2, -hw - 0.2, 1, 0.012, 10, 1));
    group.add(new THREE.Mesh(mergeGeometries(ap), apron));
  } else {
    // pavement beyond walls on street circuits
    const pave = new THREE.MeshLambertMaterial({ color: 0xa9a59c });
    group.add(new THREE.Mesh(mergeGeometries([stripGeo(T, 0, T.N, hw + 0.2, hw + T.runoff + 8, 1, 0.01, 10, 1), stripGeo(T, 0, T.N, -hw - T.runoff - 8, -hw - 0.2, 1, 0.01, 10, 1)]), pave));
  }

  // start/finish line + grid boxes
  {
    const [a] = idxRange(T, 0, 2);
    const g = stripGeo(T, a, a + 1, -hw, hw, 1, 0.04, 4, 8);
    group.add(new THREE.Mesh(g, new THREE.MeshLambertMaterial({ map: tex.checker })));
    const gl = [];
    for (let k = 0; k < 20; k++) {
      const s = L - 18 - k * 8.5; const d = (k % 2 === 0 ? 1 : -1) * 2.6;
      const [i0] = idxRange(T, s + 2.2, s + 3);
      gl.push(stripGeo(T, i0, i0 + 1, d - 1.1, d + 1.1, 1, 0.04, 4, 1).scale(1, 1, 1));
    }
    const glMesh = new THREE.Mesh(mergeGeometries(gl.map(g => { const p = g.attributes.position; return g; })), white);
    group.add(glMesh);
  }

  // ---- walls / barriers ----
  const adsMat = new THREE.MeshLambertMaterial({ map: tex.ads, side: THREE.DoubleSide });
  // the back of an advertising board is plain grey (no mirrored text when seen from the stands)
  adsMat.onBeforeCompile = sh => { sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>', '#include <map_fragment>\n if (!gl_FrontFacing) diffuseColor.rgb = vec3(0.3, 0.31, 0.33);'); };
  const fenceMat = new THREE.MeshLambertMaterial({ map: tex.fence, transparent: true, alphaTest: 0.3, side: THREE.DoubleSide, depthWrite: false });
  tex.fence.repeat.set(1, 1);
  const wallH = T.street ? 1.2 : 1.0;
  const pitA = Math.floor(T.wrap(L + P.sIn) / T.ds), pitB = Math.ceil(P.sOut / T.ds);
  const inPit = i => (i >= pitA || i <= pitB);
  const wl = [wallGeo(T, 0, T.N, i => T.wallL[i] + 0.2, 0, wallH, 26)];
  for (const [a, b] of flagRanges(T, i => !inPit(i))) wl.push(wallGeo(T, a, b, i => -T.wallR[i] - 0.2, 0, wallH, 26, true));
  group.add(new THREE.Mesh(mergeGeometries(wl), adsMat));
  if (T.street) {
    const tun = i => T.tunnel && i * T.ds > T.tunnel[0] - 4 && i * T.ds < T.tunnel[1] + 4;
    const fl = [];
    for (const [a, b] of flagRanges(T, i => !tun(i))) fl.push(wallGeo(T, a, b, i => T.wallL[i] + 0.25, wallH, 3.2, 3.5));
    for (const [a, b] of flagRanges(T, i => !inPit(i) && !tun(i))) fl.push(wallGeo(T, a, b, i => -T.wallR[i] - 0.25, wallH, 3.2, 3.5));
    group.add(new THREE.Mesh(mergeGeometries(fl), fenceMat));
  }

  // ---- pit lane, pit wall, garages ----
  {
    const [a, b] = idxRange(T, L + P.sIn, P.sOut);
    const laneMat = new THREE.MeshStandardMaterial({ map: tex.asphalt, color: 0x9a9a9a, roughness: 0.95 });
    group.add(new THREE.Mesh(stripGeo(T, a, b, P.d - 5, -hw - 0.2, 4, 0.015, 14, 2), laneMat));
    const [wa, wb] = idxRange(T, L + P.sIn + 90, P.sOut - 90);
    const pw = new THREE.Mesh(mergeGeometries([wallGeo(T, wa, wb, P.wallD, 0, 1.1, 26, true), wallGeo(T, wa, wb, P.wallD - 0.6, 0, 1.1, 26), stripGeo(T, wa, wb, P.wallD - 0.6, P.wallD, 1, 1.1, 10, 1)]), adsMat);
    group.add(pw);
    // pit lane line markings (white line on entry)
    group.add(new THREE.Mesh(stripGeo(T, a, a + Math.round(90 / T.ds), -hw - 0.35, -hw - 0.15, 1, 0.03, 10, 1), white));
    // garages: one block per team
    const [ga, gb] = idxRange(T, P.boxes[0] - 10 + L, P.boxes[9] + 10 + L);
    const bld = new THREE.Mesh(mergeGeometries([wallGeo(T, ga, gb, P.d - 6, 0, 7, 40), stripGeo(T, ga, gb, P.d - 22, P.d - 6, 1, 7, 40, 1), wallGeo(T, ga, gb, P.d - 22, 0, 7, 40)]), new THREE.MeshLambertMaterial({ color: 0xdfe3e8, side: THREE.DoubleSide }));
    group.add(bld);
    P.boxes.forEach((bs, t) => {
      const team = TEAMS[t];
      const [i0, i1] = idxRange(T, bs - 5 + L, bs + 5 + L);
      const door = new THREE.Mesh(wallGeo(T, i0, i1, P.d - 5.95, 0.2, 4.5, 10), new THREE.MeshLambertMaterial({ color: team.color, side: THREE.DoubleSide }));
      group.add(door);
      const box = new THREE.Mesh(stripGeo(T, i0, i1, P.d - 4.6, P.d - 0.5, 1, 0.03, 10, 1), new THREE.MeshLambertMaterial({ color: team.color, transparent: true, opacity: 0.55 }));
      group.add(box);
    });
  }

  const ts = addTrackside(T, group, { quality, inPit, fenceMat });

  // ---- start gantry with lights ----
  const lights = [];
  {
    const o = {}; T.at(6, o);
    const g = new THREE.Group();
    const steel = new THREE.MeshLambertMaterial({ color: 0x2b2f36 });
    const span = hw * 2 + 4;
    const beam = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.6, span), steel); beam.position.set(0, 7.2, 0); g.add(beam);
    for (const sd of [-1, 1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.6, 8, 0.6), steel); p.position.set(0, 4, sd * span / 2); g.add(p); }
    const panel = new THREE.Mesh(new THREE.BoxGeometry(0.3, 1.3, 4.6), new THREE.MeshLambertMaterial({ color: 0x0a0a0a })); panel.position.set(-0.5, 7.2, 0); g.add(panel);
    for (let k = 0; k < 5; k++) {
      const col = [];
      for (let r = 0; r < 2; r++) {
        const m = new THREE.Mesh(new THREE.CircleGeometry(0.22, 16), new THREE.MeshBasicMaterial({ color: 0x220000 }));
        m.rotation.y = -Math.PI / 2; m.position.set(-0.66, 7.45 - r * 0.5, -1.8 + k * 0.9); g.add(m); col.push(m);
      }
      lights.push(col);
    }
    g.position.set(o.x, o.y, o.z); g.rotation.y = -Math.atan2(o.tz, o.tx);
    group.add(g);
  }

  // ---- grandstands ----
  const stands = [];
  const standMat = new THREE.MeshLambertMaterial({ map: tex.crowd, side: THREE.DoubleSide });
  const roofMat = new THREE.MeshLambertMaterial({ color: 0xe9edf1, side: THREE.DoubleSide });
  const addStand = (s0, s1, side, d0, name) => {
    const [a, b] = idxRange(T, s0, s1);
    const geos = [], roofs = [];
    for (let k = 0; k < 8; k++) {
      const dIn = side * (d0 + k * 1.1), dOut = side * (d0 + (k + 1) * 1.1);
      geos.push(stripGeo(T, a, b, Math.min(dIn, dOut), Math.max(dIn, dOut), 1, 0.8 + k * 0.75, 18, 1));
      geos.push(wallGeo(T, a, b, dIn, 0.05 + k * 0.75, 0.75, 18));
    }
    roofs.push(stripGeo(T, a, b, Math.min(side * (d0 - 1), side * (d0 + 10)), Math.max(side * (d0 - 1), side * (d0 + 10)), 1, 9.5, 20, 1));
    roofs.push(wallGeo(T, a, b, side * (d0 + 9.3), 0, 9.5, 20));
    group.add(new THREE.Mesh(mergeGeometries(geos), standMat));
    group.add(new THREE.Mesh(mergeGeometries(roofs), roofMat));
    stands.push({ s0: T.wrap(s0), s1: T.wrap(s1), side, d0, name });
  };
  addStand(L - 260, 240, 1, T.wallL[0] + 3, 'Main Straight Grandstand');
  const bigCorners = T.corners.filter(c => c.peak > 0.02).slice(0, 3);
  for (const c of bigCorners) addStand(c.sStart - 60, c.sEnd + 40, -c.dir, hw + T.runoff + 4, c.name + ' Grandstand');
  T.stands = stands;

  // ---- braking marker boards ----
  {
    const boards = [];
    const boardTex = n => canvasTex(64, 64, g => { g.fillStyle = '#fff'; g.fillRect(0, 0, 64, 64); g.fillStyle = '#111'; g.font = 'bold 50px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(n), 32, 35); }, false);
    const mats = [1, 2, 3].map(n => new THREE.MeshBasicMaterial({ map: boardTex(n) }));
    for (const c of T.corners) {
      const vBefore = T.lerpArr(T.profile, c.sStart - 250), vMin = T.profile[c.apex % T.N];
      if (vBefore - vMin < 25) continue;
      // find braking start
      let sb = c.sStart; for (let k = 0; k < 120; k++) { const s = c.sStart - k * 4; if (T.lerpArr(T.profile, s - 4) <= T.lerpArr(T.profile, s) + 0.05) { sb = s; break; } }
      const side = -c.dir || 1;
      [1, 2, 3].forEach(n => {
        const o = {}; T.at(sb - n * 100, o);
        const d = side * (T.hw + 3.0);
        const m = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 1.3), mats[n - 1]);
        m.position.set(o.x + o.nx * d, o.y + 1.4, o.z + o.nz * d);
        m.rotation.y = -Math.atan2(o.tz, o.tx) - Math.PI / 2;
        group.add(m);
      });
    }
  }

  // ---- tunnel (street circuit) ----
  if (T.tunnel) {
    const [a, b] = idxRange(T, T.tunnel[0], T.tunnel[1]);
    const tm = new THREE.MeshLambertMaterial({ color: 0x3a3c40, side: THREE.DoubleSide });
    const geos = [wallGeo(T, a, b, hw + 2.5, 0, 7, 20), wallGeo(T, a, b, -hw - 2.5, 0, 7, 20), stripGeo(T, a, b, -hw - 2.5, hw + 2.5, 1, 7, 20, 1)];
    group.add(new THREE.Mesh(mergeGeometries(geos), tm));
    // light strips on the ceiling
    const lg = [];
    for (let k = a; k < b; k += 4) lg.push(stripGeo(T, k, k + 1, -1.2, 1.2, 1, 6.9, 4, 1));
    group.add(new THREE.Mesh(mergeGeometries(lg), new THREE.MeshBasicMaterial({ color: 0xfff2c8 })));
    // outer shell: a hillside / building above the tunnel
    group.add(new THREE.Mesh(mergeGeometries([stripGeo(T, a - 2, b + 2, -hw - 30, hw + 30, 2, 12, 20, 1)]), new THREE.MeshLambertMaterial({ color: 0xc9b99a, side: THREE.DoubleSide })));
  }

  // ---- trees / buildings ----
  const clearOf = (x, z, r) => { const n = T.nearest(x, z, -1); const side = Math.sign(n.d); const w = side > 0 ? T.wallL[n.idx] : T.wallR[n.idx]; return Math.abs(n.d) > w + r; };
  const nearStand = (s, d) => d > 0 && T.stands.some(st => (st.s0 < st.s1 ? s > st.s0 - 20 && s < st.s1 + 20 : s > st.s0 - 20 || s < st.s1 + 20));
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), pv = new THREE.Vector3();
  const yAxis = new THREE.Vector3(0, 1, 0);
  if (TH.buildings) {
    const count = (quality === 'low' ? 160 : 320) * (TH.tall ? 1.3 : 1) | 0;
    const bg = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
    const wt = night ? tex.nightWindows : tex.windows; wt.repeat.set(1, 1);
    const bmat = night ? new THREE.MeshLambertMaterial({ map: wt, emissiveMap: wt, emissive: 0xffffff, emissiveIntensity: 1.1 }) : new THREE.MeshLambertMaterial({ map: wt });
    const bm = new THREE.InstancedMesh(bg, bmat, count);
    let n = 0, tries = 0;
    while (n < count && tries < count * 20) {
      tries++;
      const s = R() * L; const side = R() < 0.5 ? 1 : -1; const o = {}; T.at(s, o);
      const dOff = side * (T.hw + T.runoff + 10 + R() * (TH.tall ? 160 : 70));
      const x = o.x + o.nx * dOff, z = o.z + o.nz * dOff;
      if (circ.theme === 'harbour' && z > maxZ + 40) continue; // harbour water side
      if (!clearOf(x, z, 9)) continue;
      const rel = s > L / 2 ? s - L : s; if (side < 0 && rel > P.sIn - 20 && rel < P.sOut + 20) continue;
      if (T.tunnel && s > T.tunnel[0] - 20 && s < T.tunnel[1] + 20) continue;
      if (nearStand(s, side) && Math.abs(dOff) < 60) continue;
      const far = Math.abs(dOff) / 180;
      const h = TH.tall ? 14 + R() * (30 + 120 * far) : 10 + R() * 28, w = 14 + R() * 16, dpt = 12 + R() * 14;
      q.setFromAxisAngle(yAxis, -Math.atan2(o.tz, o.tx));
      pv.set(x, o.y - 0.5, z); sc.set(w, h, dpt); m4.compose(pv, q, sc); bm.setMatrixAt(n, m4);
      bm.setColorAt(n, night ? new THREE.Color().setHSL(0.6, 0.1, 0.55 + R() * 0.3) : new THREE.Color().setHSL(0.08 + R() * 0.06, 0.35, 0.65 + R() * 0.2)); n++;
    }
    bm.count = n; group.add(bm);
  }
  if (TH.trees) {
    const count = Math.round((quality === 'low' ? 700 : quality === 'high' ? 2600 : 1600) * TH.treeK * (quality === 'low' ? 0.8 : 1));
    const trunk = new THREE.CylinderGeometry(0.25, 0.35, 3, 5).translate(0, 1.5, 0);
    const crown = TH.trees === 'round' ? new THREE.IcosahedronGeometry(3.2, 0).scale(1, 0.85, 1).translate(0, 5.2, 0) : new THREE.ConeGeometry(2.8, 8, 6).translate(0, 6.5, 0);
    const colorGeo = (g, c) => { const col = new Float32Array(g.attributes.position.count * 3); const cc = new THREE.Color(c); for (let i = 0; i < col.length; i += 3) { col[i] = cc.r; col[i + 1] = cc.g; col[i + 2] = cc.b; } g.setAttribute('color', new THREE.BufferAttribute(col, 3)); return g; };
    const tgeo = mergeGeometries([colorGeo(trunk.toNonIndexed(), 0x5a3b22), colorGeo(crown.toNonIndexed(), 0xffffff)]);
    const tm = new THREE.InstancedMesh(tgeo, new THREE.MeshLambertMaterial({ vertexColors: true }), count);
    const hue = TH.treeHue || [0.26, 0.08], lig = TH.treeL || [0.22, 0.12];
    let n = 0, tries = 0;
    while (n < count && tries < count * 12) {
      tries++;
      const s = R() * L; const side = R() < 0.5 ? 1 : -1; const o = {}; T.at(s, o);
      const dOff = side * (T.hw + T.runoff + (TH.treeNear || 6) + Math.pow(R(), 1.6) * 260);
      const x = o.x + o.nx * dOff, z = o.z + o.nz * dOff;
      if (!clearOf(x, z, 5)) continue;
      const rel = s > L / 2 ? s - L : s; if (side < 0 && rel > P.sIn - 30 && rel < P.sOut + 30 && Math.abs(dOff) < 70) continue;
      if (nearStand(s, side) && Math.abs(dOff) < 50) continue;
      const k = (0.8 + R() * 0.8) * (TH.treeScale || 1);
      q.setFromAxisAngle(yAxis, R() * 6.28); pv.set(x, heightAt(x, z), z); sc.set(k, k * (0.85 + R() * 0.4), k);
      m4.compose(pv, q, sc); tm.setMatrixAt(n, m4);
      const c = TH.sakura && R() < 0.45 ? new THREE.Color().setHSL(0.94 + R() * 0.03, 0.75, 0.86) : new THREE.Color().setHSL(hue[0] + R() * hue[1], 0.45 + R() * 0.1, lig[0] + R() * lig[1]);
      tm.setColorAt(n, c); n++;
    }
    tm.count = n; group.add(tm);
  }

  // ---- venue landmarks ----
  const cxm = (minX + maxX) / 2, czm = (minZ + maxZ) / 2;
  const findSpot = (r, dMin, dMax, tries = 300) => {
    for (let k = 0; k < tries; k++) {
      const s = R() * L, side = R() < 0.5 ? 1 : -1, o = {}; T.at(s, o);
      const d = side * (T.hw + T.runoff + dMin + R() * (dMax - dMin));
      const x = o.x + o.nx * d, z = o.z + o.nz * d;
      const rel = s > L / 2 ? s - L : s; if (Math.abs(rel) < 320) continue;
      if (clearOf(x, z, r) && !nearStand(s, side)) return { x, z, y: heightAt(x, z), h: Math.atan2(o.tz, o.tx) };
    }
    return null;
  };
  let wheel = null;
  if (TH.wheel) { // a big wheel: Suzuka's funfair, Singapore's observation wheel
    const spot = findSpot(70, 60, 220);
    if (spot) {
      const big = TH.tall ? 75 : 40;
      const gW = new THREE.Group();
      const frame = new THREE.MeshLambertMaterial({ color: 0xf2f2f2, emissive: night ? 0x8fd8ff : 0x000000, emissiveIntensity: night ? 2.2 : 0 });
      const rot = new THREE.Group();
      rot.add(new THREE.Mesh(new THREE.TorusGeometry(big, 0.7, 6, 64), frame));
      for (let k = 0; k < 16; k++) { const sp = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, big * 2, 4), frame); sp.rotation.z = k / 16 * Math.PI; rot.add(sp); }
      const cabMat = new THREE.MeshLambertMaterial({ color: 0xff4d6d, emissive: night ? 0xff8fb0 : 0, emissiveIntensity: night ? 1.5 : 0 });
      for (let k = 0; k < 24; k++) { const a = k / 24 * Math.PI * 2; const cab = new THREE.Mesh(new THREE.BoxGeometry(2.6, 2.6, 2.6), cabMat); cab.position.set(Math.cos(a) * big, Math.sin(a) * big, 0); rot.add(cab); }
      rot.position.y = big + 6; gW.add(rot);
      const legM = new THREE.MeshLambertMaterial({ color: 0xcfd3d8 });
      for (const sx of [-1, 1]) { const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1.2, big + 8, 6), legM); leg.position.set(sx * big * 0.35, (big + 6) / 2, 0); leg.rotation.z = -sx * 0.33; gW.add(leg); }
      gW.position.set(spot.x, spot.y, spot.z); gW.rotation.y = -spot.h + Math.PI / 2;
      group.add(gW); wheel = rot;
    }
  }
  if (TH.hangars) { // wartime hangars and runways on the airfield
    const hm = new THREE.MeshLambertMaterial({ color: 0x8a9096 });
    for (let k = 0; k < 5; k++) {
      const spot = findSpot(45, 40, 260); if (!spot) continue;
      const hg = new THREE.CylinderGeometry(16, 16, 50, 16, 1, false, 0, Math.PI).rotateZ(Math.PI / 2).rotateY(Math.PI / 2);
      const m = new THREE.Mesh(hg, hm); m.position.set(spot.x, spot.y, spot.z); m.rotation.y = -spot.h; group.add(m);
    }
  }
  if (TH.runways) {
    const rm = new THREE.MeshLambertMaterial({ color: 0x9a9890 });
    const rg = [];
    for (const ang of [0.35, 1.45, 2.6]) {
      const dx = Math.cos(ang), dz = Math.sin(ang), wid = 45, len = Math.max(maxX - minX, maxZ - minZ) * 1.1;
      const pos = [], idx = [];
      const n = 60;
      for (let j = 0; j <= n; j++) {
        const u = -len / 2 + len * j / n;
        for (const sd of [-1, 1]) { const x = cxm + dx * u - dz * sd * wid / 2, z = czm + dz * u + dx * sd * wid / 2; pos.push(x, heightAt(x, z) + 0.06, z); }
        if (j < n) { const a2 = j * 2; idx.push(a2, a2 + 1, a2 + 2, a2 + 1, a2 + 3, a2 + 2); }
      }
      const g2 = new THREE.BufferGeometry(); g2.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g2.setIndex(idx); g2.computeVertexNormals();
      rg.push(g2);
    }
    const rw = new THREE.Mesh(mergeGeometries(rg), rm); rw.material.side = THREE.DoubleSide; rw.receiveShadow = true; group.add(rw);
  }
  if (TH.cityRing) { // the city climbing the hills around the bowl
    const count = quality === 'low' ? 260 : 700;
    const bg = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
    const bm = new THREE.InstancedMesh(bg, new THREE.MeshLambertMaterial({ map: tex.windows }), count);
    let n = 0;
    for (let k = 0; k < count * 4 && n < count; k++) {
      const a = R() * Math.PI * 2, r = Math.max(maxX - minX, maxZ - minZ) * 0.55 + 250 + R() * 900;
      const x = cxm + Math.cos(a) * r, z = czm + Math.sin(a) * r;
      if (!clearOf(x, z, 30)) continue;
      const tall = R() < 0.12; const h = tall ? 40 + R() * 70 : 6 + R() * 10, w = tall ? 20 + R() * 10 : 8 + R() * 10;
      q.setFromAxisAngle(yAxis, R() * 6.28); pv.set(x, heightAt(x, z) - 1, z); sc.set(w, h, w * (0.7 + R() * 0.6)); m4.compose(pv, q, sc); bm.setMatrixAt(n, m4);
      bm.setColorAt(n, tall ? new THREE.Color().setHSL(0.58, 0.08, 0.75) : new THREE.Color().setHSL(R(), 0.45, 0.6 + R() * 0.15)); n++;
    }
    bm.count = n; group.add(bm);
  }
  if (TH.water && circ.theme === 'city') { // the bay, beyond the lap
    const water = new THREE.Mesh(new THREE.PlaneGeometry(8000, 8000), new THREE.MeshStandardMaterial({ color: night ? 0x0a1626 : 0x1b6f9c, roughness: 0.08, metalness: 0.6 }));
    water.rotation.x = -Math.PI / 2; water.position.set(cxm, -1.2, czm); group.add(water);
  }

  // ---- floodlights (night races) ----
  if (night) {
    const posts = [];
    for (let s = 0; s < L; s += 34) { const o = {}; T.at(s, o); const side = (Math.floor(s / 34) % 2) ? 1 : -1; if (T.tunnel && s > T.tunnel[0] - 10 && s < T.tunnel[1] + 10) continue; const i = o.i; if (side < 0 && inPit(i)) continue; const d = side * ((side > 0 ? T.wallL[i] : T.wallR[i]) + 1.6); posts.push({ x: o.x + o.nx * d, y: o.y, z: o.z + o.nz * d, h: Math.atan2(o.tz, o.tx), side }); }
    const pole = new THREE.CylinderGeometry(0.12, 0.16, 11, 5).translate(0, 5.5, 0);
    const arm = new THREE.BoxGeometry(0.15, 0.15, 3.2).translate(0, 10.9, -1.5);
    const lamp = new THREE.BoxGeometry(0.7, 0.25, 2.6).translate(0, 10.7, -2.4);
    const mk = (geo, mat) => { const im = new THREE.InstancedMesh(geo, mat, posts.length); const m = new THREE.Matrix4(), qq = new THREE.Quaternion(), e = new THREE.Euler(); posts.forEach((p, n) => { e.set(0, -p.h + (p.side > 0 ? 0 : Math.PI), 0); qq.setFromEuler(e); m.compose(new THREE.Vector3(p.x, p.y, p.z), qq, new THREE.Vector3(1, 1, 1)); im.setMatrixAt(n, m); }); group.add(im); };
    mk(mergeGeometries([pole, arm]), new THREE.MeshLambertMaterial({ color: 0x3b4048 }));
    mk(lamp, new THREE.MeshBasicMaterial({ color: new THREE.Color(0xfff6e6).multiplyScalar(4) }));
  }

  // ---- bridge (figure-eight crossover) ----
  if (T.hasBridge) {
    const deckMat = new THREE.MeshLambertMaterial({ color: 0x8d9198, side: THREE.DoubleSide });
    const geos = [];
    for (const [a, b] of flagRanges(T, i => T.bridge[i] === 1)) {
      geos.push(stripGeo(T, a, b, -hw - 1.6, hw + 1.6, 2, -1.4, 10, 1));
      geos.push(wallGeo(T, a, b, hw + 1.6, -1.4, 1.4, 10), wallGeo(T, a, b, -hw - 1.6, -1.4, 1.4, 10, true));
      // piers either side of the road underneath
      const mid = Math.floor((a + b) / 2) % T.N;
      let lo = -1, bd = 1e18;
      for (let j = 0; j < T.N; j++) { if (T.bridge[j]) continue; const dx = T.cx[j] - T.cx[mid], dz = T.cz[j] - T.cz[mid]; const q2 = dx * dx + dz * dz; if (q2 < bd && T.cy[j] < T.cy[mid] - 4) { bd = q2; lo = j; } }
      if (lo >= 0) for (const sd of [-1, 1]) {
        const d = sd * (T.wallL[lo] + 2);
        const px = T.cx[lo] + T.nx[lo] * d, pz = T.cz[lo] + T.nz[lo] * d;
        const ht = T.cy[mid] - 1.4 - T.cy[lo] + 0.5;
        const sinA = Math.abs(T.tx[lo] * T.tz[mid] - T.tz[lo] * T.tx[mid]);
        const pier = new THREE.BoxGeometry((hw + 2) * 2 / Math.max(0.35, sinA), ht, 2.2).translate(0, ht / 2, 0);
        const mesh = new THREE.Mesh(pier, deckMat); mesh.position.set(px, T.cy[lo] - 0.5, pz); mesh.rotation.y = -Math.atan2(T.tz[lo], T.tx[lo]); group.add(mesh);
      }
    }
    if (geos.length) { const bm = new THREE.Mesh(mergeGeometries(geos), deckMat); bm.castShadow = quality === 'high'; group.add(bm); }
  }

  // distant mountains
  {
    const mg = [];
    for (let k = 0; k < (TH.mount ? 28 : 0); k++) {
      const a = (k / 28) * Math.PI * 2 + R() * 0.2; const r = 2900 + R() * 600;
      const h = TH.mount + R() * 350;
      mg.push(new THREE.ConeGeometry(600 + R() * 500, h, 5).translate(cxm + Math.cos(a) * r, h / 2 - 20, czm + Math.sin(a) * r));
    }
    if (mg.length) group.add(new THREE.Mesh(mergeGeometries(mg), new THREE.MeshLambertMaterial({ color: TH.mountCol || (circ.time === 'golden' ? 0x8a8faa : 0x7f93a8), fog: true })));
  }

  return { group, lights, sun, hemi, sky, skyMat, wheel, night, tod: Object.assign({}, tod, { hemiI: S.renderer ? tod.hemiI * 0.55 : tod.hemiI }), tex };
}
