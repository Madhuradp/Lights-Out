// Track model: samples a closed spline into evenly spaced points and precomputes
// everything the game needs (normals, curvature, racing line, speed profile,
// straight-mode zones, corners, pit lane).
import * as THREE from 'three';
import { PHYS, accelLimit, brakeLimit, cornerSpeed } from './physics.js';

export function buildTrack(circ) {
  const pts = circ.points.map(p => new THREE.Vector3(p[0], p[2] || 0, p[1]));
  const curve = new THREE.CatmullRomCurve3(pts, true, 'centripetal');
  curve.arcLengthDivisions = 6000;
  const approxL = curve.getLength();
  const N = Math.round(approxL / 4);
  const sp = curve.getSpacedPoints(N); // N+1 points, last == first
  const cx = new Float32Array(N), cy = new Float32Array(N), cz = new Float32Array(N);
  for (let i = 0; i < N; i++) { cx[i] = sp[i].x; cy[i] = sp[i].y; cz[i] = sp[i].z; }
  let L = 0;
  for (let i = 0; i < N; i++) { const j = (i + 1) % N; L += Math.hypot(cx[j] - cx[i], cz[j] - cz[i]); }
  const ds = L / N;

  const tx = new Float32Array(N), tz = new Float32Array(N), nx = new Float32Array(N), nz = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const a = (i - 1 + N) % N, b = (i + 1) % N;
    let dx = cx[b] - cx[a], dz = cz[b] - cz[a]; const m = Math.hypot(dx, dz) || 1;
    dx /= m; dz /= m; tx[i] = dx; tz[i] = dz;
    // left normal = up x t = (tz, -tx)
    nx[i] = dz; nz[i] = -dx;
  }
  const kc = curvatureOf(cx, cz, N, ds, 3);
  const hw = circ.width / 2;

  const T = {
    circ, N, L, ds, cx, cy, cz, tx, tz, nx, nz, kc, hw,
    runoff: circ.runoff, street: circ.street,
  };

  // ---- Elevation: gradient (rise/run) and vertical curvature (1/m, + = compression) ----
  {
    const ys = Float32Array.from(cy); smooth(ys, N, 4, 3);
    const grade = new Float32Array(N), vk = new Float32Array(N);
    const w = Math.max(2, Math.round(12 / ds));
    for (let i = 0; i < N; i++) grade[i] = (ys[(i + w) % N] - ys[(i - w + N) % N]) / (2 * w * ds);
    for (let i = 0; i < N; i++) vk[i] = (grade[(i + w) % N] - grade[(i - w + N) % N]) / (2 * w * ds);
    smooth(vk, N, 3, 3);
    T.grade = grade; T.vk = vk;
    let lo = 1e9, hi = -1e9; for (let i = 0; i < N; i++) { lo = Math.min(lo, cy[i]); hi = Math.max(hi, cy[i]); }
    T.elevRange = hi - lo;
  }

  // ---- Bridges: where the lap really crosses itself (figure-eight), mark the upper road ----
  {
    const bridge = new Uint8Array(N);
    const gap = Math.round(300 / ds), span = Math.round((hw * 2 + 30) / ds);
    for (let i = 0; i < N; i++) {
      const i2 = (i + 1) % N;
      for (let j = i + gap; j < N; j++) {
        if (N - (j - i) < gap) break;
        const j2 = (j + 1) % N;
        const d1x = cx[i2] - cx[i], d1z = cz[i2] - cz[i], d2x = cx[j2] - cx[j], d2z = cz[j2] - cz[j];
        const den = d1x * d2z - d1z * d2x; if (Math.abs(den) < 1e-9) continue;
        const ex = cx[j] - cx[i], ez = cz[j] - cz[i];
        const u = (ex * d2z - ez * d2x) / den, w = (ex * d1z - ez * d1x) / den;
        if (u < 0 || u > 1 || w < 0 || w > 1) continue;
        const up = cy[i] > cy[j] ? i : j;
        if (Math.abs(cy[i] - cy[j]) < 5) continue; // a level crossing would be a collision course: ignore
        for (let k = -span; k <= span; k++) bridge[(up + k + N) % N] = 1;
      }
    }
    T.bridge = bridge; T.hasBridge = bridge.some(b => b);
  }

  // ---- Racing line: minimum curvature inside the track limits ----
  // Projected gradient descent on sum |p[i-k] - 2p[i] + p[i+k]|^2 (multi-scale k), which is
  // what a driver does: start wide, clip the apex, run out to the edge on exit.
  const lim = hw - 1.4;
  const d = new Float32Array(N);
  const px = new Float32Array(N), pz = new Float32Array(N);
  const Dx = new Float32Array(N), Dz = new Float32Array(N);
  for (let k = Math.max(2, Math.round(60 / ds)); k >= 1; k = k > 2 ? Math.floor(k * 0.75) : k - 1) {
    const iters = k > 4 ? 40 : 80;
    for (let it = 0; it < iters; it++) {
      for (let i = 0; i < N; i++) { px[i] = cx[i] + d[i] * nx[i]; pz[i] = cz[i] + d[i] * nz[i]; }
      for (let i = 0; i < N; i++) {
        const a2 = (i - k + N) % N, b2 = (i + k) % N;
        Dx[i] = px[a2] - 2 * px[i] + px[b2]; Dz[i] = pz[a2] - 2 * pz[i] + pz[b2];
      }
      for (let i = 0; i < N; i++) {
        const a2 = (i - k + N) % N, b2 = (i + k) % N;
        const gx = Dx[a2] - 2 * Dx[i] + Dx[b2], gz = Dz[a2] - 2 * Dz[i] + Dz[b2];
        d[i] = Math.max(-lim, Math.min(lim, d[i] - 0.055 * (gx * nx[i] + gz * nz[i])));
      }
    }
  }
  smooth(d, N, 3, 4);
  T.line = d;
  for (let i = 0; i < N; i++) { px[i] = cx[i] + d[i] * nx[i]; pz[i] = cz[i] + d[i] * nz[i]; }
  T.lk = curvatureOf(px, pz, N, ds, 3);

  // ---- Straight-mode (active aero) zones: long low-curvature stretches ----
  const zone = new Uint8Array(N);
  {
    const low = i => Math.abs(T.lk[i]) < 0.0022;
    let start = 0; while (low(start) && start < N - 1) start++;
    let i = start, count = 0;
    for (let n = 0; n <= N; n++) {
      const idx = (start + n) % N;
      if (low(idx) && n < N) count++;
      else {
        if (count * ds >= 260) {
          // keep a margin before the braking zone (zone closes ~60m before the corner)
          const trim = Math.round(60 / ds);
          for (let m = 0; m < count - trim; m++) zone[(idx - count + m + N * 2) % N] = 1;
        }
        count = 0;
      }
      i = idx;
    }
  }
  T.zone = zone;
  T.zones = rangesOf(zone, N, ds);

  // ---- Corners ----
  T.corners = findCorners(T);
  if (circ.cornerNames) for (const c of T.corners) {
    let best = null, bo = 0;
    const a = c.sStart / L, b = (c.sEnd < c.sStart ? c.sEnd + L : c.sEnd) / L;
    for (const nm of circ.cornerNames) { const o = Math.min(b, nm.f1 + 0.004) - Math.max(a, nm.f0 - 0.004); if (o > bo) { bo = o; best = nm; } }
    if (best) c.name = best.name;
  }

  // ---- Speed profile for the reference grip ----
  T.profile = computeProfile(T, PHYS.mu0, 0.42);
  { let tl = 0; for (let i = 0; i < N; i++) tl += ds / Math.max(5, T.profile[i]); T.idealLap = tl; if (!circ.refLapTime) circ.refLapTime = Math.round(tl * 1.16); }

  // ---- Kerbs ----
  const kerbL = new Uint8Array(N), kerbR = new Uint8Array(N);
  for (const c of T.corners) {
    const pad = Math.round(14 / ds);
    for (let j = c.i0 - pad; j <= c.i1 + pad; j++) {
      const idx = (j + N) % N;
      if (c.dir > 0 || !circ.street) kerbL[idx] = 1;
      if (c.dir < 0 || !circ.street) kerbR[idx] = 1;
    }
  }
  T.kerbL = kerbL; T.kerbR = kerbR;

  // ---- Pit lane along the main straight ----
  {
    const straight = i => Math.abs(kc[(i + N) % N]) < (circ.pitCurv || 0.0035);
    let a = 0; while (straight(a - 1) && a > -N / 3) a--;
    let b = 0; while (straight(b + 1) && b < N / 3) b++;
    const sA = a * ds, sB = b * ds; // sA negative
    const pitIn = Math.max(sA + 20, -420), pitOut = Math.min(sB - 20, 340);
    const pit = {
      sIn: pitIn, sOut: pitOut,                   // relative to the line (sIn < 0)
      d: -(hw + 10),                              // pit lane centre (right of track)
      wallD: -(hw + 4.5),
      limit: 22.2,                                 // 80 km/h
      sLimitA: pitIn + 70, sLimitB: pitOut - 55,
      boxes: [],
    };
    const b0 = pit.sLimitA + 25, b1 = Math.min(pit.sLimitB - 25, b0 + 10 * 15);
    for (let t = 0; t < 10; t++) pit.boxes.push(b0 + (b1 - b0) * (t / 9));
    T.pit = pit;
  }
  T.sectors = [0, L / 3, (2 * L) / 3];
  if (circ.tunnel) T.tunnel = [circ.tunnel[0] * L, circ.tunnel[1] * L];

  // ---- helpers ----
  T.wrap = s => ((s % L) + L) % L;
  T.idx = s => Math.floor(T.wrap(s) / ds) % N;
  T.at = (s, out) => {
    const u = T.wrap(s) / ds; const i = Math.floor(u) % N; const j = (i + 1) % N; const f = u - Math.floor(u);
    out.x = cx[i] + (cx[j] - cx[i]) * f; out.y = cy[i] + (cy[j] - cy[i]) * f; out.z = cz[i] + (cz[j] - cz[i]) * f;
    out.tx = tx[i] + (tx[j] - tx[i]) * f; out.tz = tz[i] + (tz[j] - tz[i]) * f;
    const m = Math.hypot(out.tx, out.tz) || 1; out.tx /= m; out.tz /= m;
    out.nx = out.tz; out.nz = -out.tx; out.i = i; out.f = f;
    return out;
  };
  T.lerpArr = (arr, s) => { const u = T.wrap(s) / ds; const i = Math.floor(u) % N; const f = u - Math.floor(u); return arr[i] + (arr[(i + 1) % N] - arr[i]) * f; };
  T.nearest = (x, z, hint) => {
    let best = 1e18, bi = hint;
    const span = hint < 0 ? N : 45;
    const from = hint < 0 ? 0 : hint - span;
    for (let n = 0; n <= (hint < 0 ? N - 1 : span * 2); n++) {
      const i = ((from + n) % N + N) % N;
      const dx = x - cx[i], dz = z - cz[i]; const q = dx * dx + dz * dz;
      if (q < best) { best = q; bi = i; }
    }
    // project onto segment for a precise s
    const i = bi, j = (bi + 1) % N;
    const dx = x - cx[i], dz = z - cz[i];
    let along = dx * tx[i] + dz * tz[i];
    let ii = i;
    if (along < 0) { ii = (i - 1 + N) % N; along += ds; }
    const s = ii * ds + Math.max(0, Math.min(ds, along));
    const pdx = x - cx[ii], pdz = z - cz[ii];
    const dd = pdx * nx[ii] + pdz * nz[ii];
    return { idx: bi, s, d: dd };
  };
  return T;
}

function curvatureOf(x, z, N, ds, span) {
  const k = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const a = (i - span + N) % N, b = (i + span) % N;
    const a1 = Math.atan2(z[i] - z[a], x[i] - x[a]);
    const a2 = Math.atan2(z[b] - z[i], x[b] - x[i]);
    let da = a2 - a1; while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI;
    // positive = turning left (toward the left normal). In x/z with left=(tz,-tx), a left turn decreases the angle.
    k[i] = -da / (span * ds);
  }
  smooth(k, N, 2, 2);
  return k;
}

function smooth(arr, N, r, passes) {
  const tmp = new Float32Array(N);
  for (let p = 0; p < passes; p++) {
    for (let i = 0; i < N; i++) { let s = 0; for (let k = -r; k <= r; k++) s += arr[(i + k + N) % N]; tmp[i] = s / (2 * r + 1); }
    arr.set(tmp);
  }
}

function rangesOf(flag, N, ds) {
  let base = 0; while (flag[base] && base < N - 1) base++;
  const out = []; let st = -1;
  for (let n = 1; n <= N; n++) {
    const i = (base + n) % N;
    if (flag[i] && st < 0) st = base + n;
    if (!flag[i] && st >= 0) { out.push([(st % N) * ds, i * ds]); st = -1; }
  }
  return out; // a range may wrap (end < start)
}

function findCorners(T) {
  const { N, ds, kc } = T;
  const hot = new Uint8Array(N);
  for (let i = 0; i < N; i++) hot[i] = Math.abs(kc[i]) > 0.0075 ? 1 : 0;
  // merge gaps shorter than 40m with the same direction
  const segs = [];
  let i = 0; while (hot[i] && i < N - 1) i++;
  const start0 = i;
  let cur = null;
  for (let n = 1; n <= N; n++) {
    const idx = (start0 + n) % N;
    if (hot[idx]) {
      const dir = Math.sign(kc[idx]);
      if (!cur) cur = { i0: start0 + n, i1: start0 + n, dir, peak: Math.abs(kc[idx]), apex: start0 + n };
      else if (dir !== cur.dir) { segs.push(cur); cur = { i0: start0 + n, i1: start0 + n, dir, peak: Math.abs(kc[idx]), apex: start0 + n }; }
      else { cur.i1 = start0 + n; if (Math.abs(kc[idx]) > cur.peak) { cur.peak = Math.abs(kc[idx]); cur.apex = start0 + n; } }
    } else if (cur && (start0 + n - cur.i1) * ds > 40) { segs.push(cur); cur = null; }
  }
  if (cur) segs.push(cur);
  const out = segs.filter(c => (c.i1 - c.i0) * ds > 8 || c.peak > 0.02).map(c => ({ ...c, s: ((c.apex % N) * ds), sStart: ((c.i0 % N) * ds), sEnd: ((c.i1 % N) * ds) }));
  out.sort((a, b) => a.sStart - b.sStart);
  out.forEach((c, k) => { c.num = k + 1; c.name = 'Turn ' + (k + 1); });
  return out;
}

// Speed profile along the racing line for a given grip (mu) and average ERS deployment.
export function computeProfile(T, mu, ers) {
  const { N, ds, lk, zone } = T;
  const grade = T.grade || new Float32Array(N), vk = T.vk || new Float32Array(N);
  const v = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    v[i] = cornerSpeed(Math.abs(lk[i]), mu);
    // compressions add load (more grip), crests take it away
    const f = Math.max(0.55, Math.min(1.5, 1 + vk[i] * v[i] * v[i] / 9.81));
    if (f !== 1) v[i] = cornerSpeed(Math.abs(lk[i]), mu * f);
  }
  // forward (acceleration), two laps for closure
  for (let n = 1; n < N * 2; n++) {
    const i = n % N, p = (n - 1) % N;
    const a = accelLimit(v[p], mu, zone[p] === 1, ers) - 9.81 * grade[p];
    const vn = Math.sqrt(Math.max(0, v[p] * v[p] + 2 * a * ds));
    if (vn < v[i]) v[i] = vn;
  }
  // backward (braking)
  for (let n = N * 2; n > 0; n--) {
    const i = n % N, nx = (n + 1) % N;
    const b = Math.max(1, brakeLimit(v[nx], mu) + 9.81 * grade[i]);
    const vb = Math.sqrt(v[nx] * v[nx] + 2 * b * ds);
    if (vb < v[i]) v[i] = vb;
  }
  return v;
}
