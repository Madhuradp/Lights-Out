// Builds the 3D circuit: road, kerbs, lines, run-off, walls with ad boards, pit lane,
// garages, start gantry, grandstands, marker boards, terrain, trees/buildings and sky.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { TEAMS, SPONSORS } from './data.js';

const TIMES = {
  afternoon: { skyTop: 0x2f6fc0, skyBot: 0xbcd6ee, fog: 0xc4d8ea, sun: 0xfff2dd, sunI: 2.6, hemiS: 0xbfd8ff, hemiG: 0x56683c, hemiI: 1.05, sunPos: [0.5, 0.75, 0.35], exposure: 1.0 },
  midday:    { skyTop: 0x1f6fd6, skyBot: 0xcfe6fa, fog: 0xd4e7f6, sun: 0xffffff, sunI: 2.9, hemiS: 0xcfe4ff, hemiG: 0x6a6f63, hemiI: 1.1, sunPos: [0.2, 0.92, 0.3], exposure: 1.0 },
  golden:    { skyTop: 0x3c5d9a, skyBot: 0xf3c48c, fog: 0xe8c39b, sun: 0xffc27a, sunI: 2.5, hemiS: 0xffd7a8, hemiG: 0x4c5a32, hemiI: 0.9, sunPos: [-0.75, 0.32, 0.4], exposure: 1.05 },
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

export function makeTextures() {
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
  return { asphalt, grass, kerb, gravel, checker, ads, fence, crowd, windows };
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
  for (let n = 1; n <= T.N; n++) { const i = (base + n) % T.N; if (flag(i) && st < 0) st = base + n; if (!flag(i) && st >= 0) { out.push([st, base + n]); st = -1; } }
  return out;
}

export function buildScenery(T, scene, quality) {
  const tex = makeTextures();
  const circ = T.circ;
  const tod = TIMES[circ.time] || TIMES.afternoon;
  const group = new THREE.Group(); scene.add(group);
  const hw = T.hw, P = T.pit, L = T.L;

  // physical walls per side (pit lane widens the right side)
  T.wallL = new Float32Array(T.N).fill(hw + T.runoff);
  T.wallR = new Float32Array(T.N).fill(hw + T.runoff);
  {
    const [a, b] = idxRange(T, L + P.sIn, P.sOut);
    for (let k = a; k <= b; k++) T.wallR[k % T.N] = Math.max(T.wallR[k % T.N], -P.wallD - 0.3);
  }

  // ---- sky ----
  const skyGeo = new THREE.SphereGeometry(6000, 32, 16);
  const sunDir = new THREE.Vector3(...tod.sunPos).normalize();
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color(tod.skyTop) }, bot: { value: new THREE.Color(tod.skyBot) }, sun: { value: sunDir }, sunCol: { value: new THREE.Color(tod.sun) }, dark: { value: 0 } },
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: 'uniform vec3 top; uniform vec3 bot; uniform vec3 sun; uniform vec3 sunCol; uniform float dark; varying vec3 vP; void main(){ float h = clamp(vP.y*1.6+0.08,0.0,1.0); vec3 c = mix(bot, top, pow(h,0.7)); float s = max(dot(vP, sun),0.0); c += sunCol*pow(s,600.0)*2.0 + sunCol*pow(s,8.0)*0.18; c = mix(c, vec3(0.42,0.45,0.5), dark); gl_FragColor = vec4(c,1.0); }',
  });
  const sky = new THREE.Mesh(skyGeo, skyMat); sky.renderOrder = -1; scene.add(sky);
  scene.fog = new THREE.Fog(tod.fog, 450, 4200);
  scene.background = new THREE.Color(tod.fog);

  // ---- lights ----
  const hemi = new THREE.HemisphereLight(tod.hemiS, tod.hemiG, tod.hemiI); scene.add(hemi);
  const sun = new THREE.DirectionalLight(tod.sun, tod.sunI); sun.position.copy(sunDir).multiplyScalar(500); scene.add(sun); scene.add(sun.target);
  if (quality === 'high') {
    sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
    const sc = sun.shadow.camera; sc.left = -60; sc.right = 60; sc.top = 60; sc.bottom = -60; sc.near = 10; sc.far = 1200; sun.shadow.bias = -0.0005;
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
  const hilly = circ.theme === 'hills';
  const heightAt = (x, z) => {
    let best = 1e18, by = 0;
    for (let i = 0; i < T.N; i += 3) { const dx = x - T.cx[i], dz = z - T.cz[i]; const q = dx * dx + dz * dz; if (q < best) { best = q; by = T.cy[i]; } }
    const dist = Math.sqrt(best);
    const far = Math.min(1, Math.max(0, (dist - 60) / 500));
    const noise = (Math.sin(x * 0.004) * Math.cos(z * 0.0035) + 0.5 * Math.sin(x * 0.011 + z * 0.007)) * (hilly ? 26 : 6);
    const edge = Math.min(1, Math.max(0, (dist - 700) / 700));
    return by * (1 - far * 0.5) - 0.35 + noise * far + edge * (hilly ? 120 : 40) * (0.6 + 0.4 * Math.sin(x * 0.002 + z * 0.003));
  };
  for (let i = 0; i < tp.count; i++) tp.setY(i, heightAt(tp.getX(i), tp.getZ(i)));
  tg.computeVertexNormals();
  const grassTex = tex.grass; grassTex.repeat.set((gx1 - gx0) / 24, (gz1 - gz0) / 24);
  const groundCol = circ.theme === 'harbour' ? 0x8b8f86 : 0xffffff;
  const ground = new THREE.Mesh(tg, new THREE.MeshLambertMaterial({ map: circ.theme === 'harbour' ? null : grassTex, color: circ.theme === 'harbour' ? groundCol : 0xffffff }));
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
  const roadMat = new THREE.MeshStandardMaterial({ map: asphalt, vertexColors: true, roughness: 0.92, metalness: 0.0, color: 0xc8c8c8 });
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

  // kerbs
  const kerbMat = new THREE.MeshLambertMaterial({ map: tex.kerb });
  const kg = [];
  for (const [a, b] of flagRanges(T, i => T.kerbL[i])) kg.push(stripGeo(T, a, b, hw - 0.05, hw + 1.35, 1, 0.06, 6, 1));
  for (const [a, b] of flagRanges(T, i => T.kerbR[i])) kg.push(stripGeo(T, a, b, -hw - 1.35, -hw + 0.05, 1, 0.06, 6, 1));
  if (kg.length) group.add(new THREE.Mesh(mergeGeometries(kg), kerbMat));

  // gravel traps on corner exits (non-street)
  if (!T.street) {
    const gm = new THREE.MeshLambertMaterial({ map: tex.gravel }); tex.gravel.repeat.set(1, 1);
    const gg = [];
    for (const c of T.corners) {
      if (c.peak < 0.012) continue;
      const a = c.i0 - 4, b = c.i1 + Math.round(60 / T.ds);
      const out = -c.dir; // outside of the corner
      const d0 = hw + 2.2, d1 = hw + T.runoff - 1.5;
      if (d1 - d0 < 3) continue;
      if (out > 0) gg.push(stripGeo(T, a, b, d0, d1, 2, 0.03, 12, 4)); else gg.push(stripGeo(T, a, b, -d1, -d0, 2, 0.03, 12, 4));
    }
    if (gg.length) group.add(new THREE.Mesh(mergeGeometries(gg), gm));
    // tarmac run-off apron beside the track
    const apron = new THREE.MeshLambertMaterial({ color: 0x55585c });
    group.add(new THREE.Mesh(mergeGeometries([stripGeo(T, 0, T.N, hw + 0.2, hw + 2.2, 1, 0.012, 10, 1), stripGeo(T, 0, T.N, -hw - 2.2, -hw - 0.2, 1, 0.012, 10, 1)]), apron));
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
  if (circ.theme === 'harbour') {
    const count = quality === 'low' ? 160 : 320;
    const bg = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
    const bm = new THREE.InstancedMesh(bg, new THREE.MeshLambertMaterial({ map: tex.windows }), count);
    tex.windows.repeat.set(1, 1);
    let n = 0, tries = 0;
    while (n < count && tries < count * 20) {
      tries++;
      const s = R() * L; const side = R() < 0.5 ? 1 : -1; const o = {}; T.at(s, o);
      const dOff = side * (T.hw + T.runoff + 10 + R() * 70);
      const x = o.x + o.nx * dOff, z = o.z + o.nz * dOff;
      if (z > maxZ + 40) continue; // harbour water side
      if (!clearOf(x, z, 9)) continue;
      const rel = s > L / 2 ? s - L : s; if (side < 0 && rel > P.sIn - 20 && rel < P.sOut + 20) continue;
      if (T.tunnel && s > T.tunnel[0] - 20 && s < T.tunnel[1] + 20) continue;
      const h = 10 + R() * 28, w = 14 + R() * 16, dpt = 12 + R() * 14;
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), -Math.atan2(o.tz, o.tx));
      pv.set(x, o.y - 0.5, z); sc.set(w, h, dpt); m4.compose(pv, q, sc); bm.setMatrixAt(n, m4);
      bm.setColorAt(n, new THREE.Color().setHSL(0.08 + R() * 0.06, 0.35, 0.65 + R() * 0.2)); n++;
    }
    bm.count = n; group.add(bm);
  } else {
    const count = quality === 'low' ? 700 : quality === 'high' ? 2600 : 1600;
    const trunk = new THREE.CylinderGeometry(0.25, 0.35, 3, 5).translate(0, 1.5, 0);
    const crown = (circ.theme === 'hills' ? new THREE.IcosahedronGeometry(3.2, 0).scale(1, 0.85, 1).translate(0, 5.2, 0) : new THREE.ConeGeometry(2.8, 8, 6).translate(0, 6.5, 0));
    const colorGeo = (g, c) => { const col = new Float32Array(g.attributes.position.count * 3); const cc = new THREE.Color(c); for (let i = 0; i < col.length; i += 3) { col[i] = cc.r; col[i + 1] = cc.g; col[i + 2] = cc.b; } g.setAttribute('color', new THREE.BufferAttribute(col, 3)); return g; };
    const tgeo = mergeGeometries([colorGeo(trunk.toNonIndexed(), 0x5a3b22), colorGeo(crown.toNonIndexed(), 0xffffff)]);
    const tm = new THREE.InstancedMesh(tgeo, new THREE.MeshLambertMaterial({ vertexColors: true }), count);
    let n = 0, tries = 0;
    while (n < count && tries < count * 12) {
      tries++;
      const s = R() * L; const side = R() < 0.5 ? 1 : -1; const o = {}; T.at(s, o);
      const dOff = side * (T.hw + T.runoff + 6 + Math.pow(R(), 1.6) * 260);
      const x = o.x + o.nx * dOff, z = o.z + o.nz * dOff;
      if (!clearOf(x, z, 5)) continue;
      const rel = s > L / 2 ? s - L : s; if (side < 0 && rel > P.sIn - 30 && rel < P.sOut + 30 && Math.abs(dOff) < 70) continue;
      if (nearStand(s, side) && Math.abs(dOff) < 50) continue;
      const k = 0.8 + R() * 0.8;
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), R() * 6.28); pv.set(x, heightAt(x, z), z); sc.set(k, k * (0.85 + R() * 0.4), k);
      m4.compose(pv, q, sc); tm.setMatrixAt(n, m4);
      const c = circ.theme === 'hills' ? (R() < 0.45 ? new THREE.Color().setHSL(0.94 + R() * 0.03, 0.75, 0.86) : new THREE.Color().setHSL(0.28 + R() * 0.06, 0.45, 0.28 + R() * 0.1)) : new THREE.Color().setHSL(0.26 + R() * 0.08, 0.5, 0.22 + R() * 0.12);
      tm.setColorAt(n, c); n++;
    }
    tm.count = n; group.add(tm);
  }

  // distant mountains
  {
    const mg = []; const cxm = (minX + maxX) / 2, czm = (minZ + maxZ) / 2;
    for (let k = 0; k < 28; k++) {
      const a = (k / 28) * Math.PI * 2 + R() * 0.2; const r = 2900 + R() * 600;
      const h = (circ.theme === 'hills' ? 500 : 250) + R() * 350;
      mg.push(new THREE.ConeGeometry(600 + R() * 500, h, 5).translate(cxm + Math.cos(a) * r, h / 2 - 20, czm + Math.sin(a) * r));
    }
    const mm = new THREE.Mesh(mergeGeometries(mg), new THREE.MeshLambertMaterial({ color: circ.theme === 'golden' || circ.time === 'golden' ? 0x8a8faa : 0x7f93a8, fog: true }));
    group.add(mm);
  }

  return { group, lights, sun, hemi, sky, skyMat, tod, tex };
}
