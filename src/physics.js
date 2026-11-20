// Vehicle physics for a 2026-regulation car (simplified but physically grounded):
// downforce, drag, power from combustion + electric (ERS), tyre grip with a friction
// circle, active aero (corner/straight mode), and energy harvesting/deployment.
import { COMPOUNDS, weatherGrip } from './data.js';

export const PHYS = {
  M: 800, g: 9.81, rho: 1.225,
  ClA: 4.2, ClAs: 2.5,        // downforce coefficient x area (corner / straight mode)
  CdA: 1.45, CdAs: 0.95,      // drag (corner / straight mode)
  ICE: 400e3, ERS: 350e3,     // watts
  mu0: 1.65, L: 3.6, roll: 0.012,
  battery: 4.0,               // MJ
  harvestPerLap: 8.5,         // MJ
};
const { M, g, rho } = PHYS;

export function ersTaper(v, ot) {
  const a = ot ? 93.6 : 80.6;   // full power to 337 km/h with Overtake, else 290 km/h
  const b = ot ? 99.0 : 96.0;
  if (v <= a) return 1; if (v >= b) return 0; return (b - v) / (b - a);
}
export function cornerSpeed(k, mu) {
  const c = 0.5 * rho * PHYS.ClA / M;
  const den = k - mu * c;
  if (den <= 1e-5) return 100;
  return Math.min(100, Math.sqrt(mu * g / den));
}
export function accelLimit(v, mu, straight, ers) {
  const P = PHYS.ICE + PHYS.ERS * ers * ersTaper(v, false);
  const vv = Math.max(v, 3);
  const df = 0.5 * rho * (straight ? PHYS.ClAs : PHYS.ClA) * v * v;
  const trac = mu * (M * g + df) * 0.62;
  const F = Math.min(P / vv, trac);
  const drag = 0.5 * rho * (straight ? PHYS.CdAs : PHYS.CdA) * v * v;
  return (F - drag - PHYS.roll * M * g) / M;
}
export function brakeLimit(v, mu) {
  const df = 0.5 * rho * PHYS.ClA * v * v;
  const drag = 0.5 * rho * PHYS.CdA * v * v;
  return (mu * 0.97 * (M * g + df) + drag) / M;
}

// Tyre + surface grip multiplier relative to mu0
export function tyreGrip(tyre, wet, damage) {
  const c = COMPOUNDS[tyre.c];
  const wear = tyre.wear;
  const cliff = Math.max(0, wear - 0.72);
  const wearF = 1 - 0.06 * wear - 1.3 * cliff * cliff;
  const tempF = 0.9 + 0.1 * tyre.temp;
  const base = (tyre.c === 'I' || tyre.c === 'W') ? weatherGrip(tyre.c, wet) : c.grip * weatherGrip(tyre.c, wet);
  return base * wearF * tempF * (1 - 0.07 * damage);
}

const GEAR_TOP = [80, 122, 158, 194, 230, 266, 304, 350].map(k => k / 3.6);

// ------------------------------------------------------------------------------------
// Player car: free 2D dynamics in world space, constrained by the track walls.
// heading h: forward = (cos h, sin h) in (x, z); left = (sin h, -cos h)
// ------------------------------------------------------------------------------------
export class PlayerCar {
  constructor(T) {
    this.T = T;
    this.x = 0; this.z = 0; this.y = 0; this.h = 0;
    this.v = 0; this.vy = 0; this.yaw = 0;
    this.idx = 0; this.s = 0; this.d = 0; this.dist = 0;
    this.gear = 1; this.rpm = 4000; this.shiftT = 0;
    this.battery = PHYS.battery; this.harvestLap = 0; this.deployLap = 0;
    this.boost = false; this.otActive = false; this.recharge = false; this.straightMode = false;
    this.ersPower = 0; this.harvestPower = 0;
    this.tyre = { c: 'M', wear: 0, temp: 0.75, age: 0 };
    this.usedCompounds = new Set();
    this.damage = 0;
    this.surface = 'track'; this.kerb = 0; this.slip = 0; this.lock = 0; this.spin = 0;
    this.latG = 0; this.lonG = 0; this.aLon = 0;
    this.events = []; // per-step events for audio/haptics
    this.throttle = 0; this.brake = 0; this.steer = 0;
  }

  // steering input needed to follow a path of curvature k at the current speed
  steerFor(k) {
    const v = Math.max(this.v, 2.5);
    const mu = this.mu || PHYS.mu0;
    const aMax = mu * (g + 0.5 * rho * PHYS.ClA * v * v / M);
    const lim = Math.min(v * Math.tan(0.36) / PHYS.L, aMax * 1.1 / v);
    return (v * k) / lim;
  }

  placeAt(s, d) {
    const T = this.T; const o = {}; T.at(s, o);
    this.x = o.x + o.nx * d; this.z = o.z + o.nz * d; this.y = o.y;
    this.h = Math.atan2(o.tz, o.tx);
    const n = T.nearest(this.x, this.z, -1); this.idx = n.idx; this.s = n.s; this.d = n.d;
  }

  step(dt, inp, env) {
    const T = this.T;
    const fx = Math.cos(this.h), fz = Math.sin(this.h);
    const lx = fz, lz = -fx;
    const v = this.v;

    // --- surface & grip ---
    const absd = Math.abs(this.d);
    const i = this.idx;
    const kerbHere = this.d > 0 ? T.kerbL[i] : T.kerbR[i];
    const wallD = T.wallL ? (this.d > 0 ? T.wallL[i] : T.wallR[i]) : T.hw + T.runoff;
    let surfMu = 1, surfDrag = 0;
    this.kerb = 0;
    if (absd > T.hw + 0.2) {
      if (kerbHere && absd < T.hw + 1.4) { this.kerb = 1; surfMu = 0.93; this.surface = 'kerb'; }
      else if (absd > T.hw + 1.4 || !kerbHere) {
        this.surface = T.street ? 'track' : 'grass';
        if (!T.street) { surfMu = 0.5; surfDrag = 0.22 * g; }
      }
    } else this.surface = 'track';
    const mu = PHYS.mu0 * tyreGrip(this.tyre, env.wet, this.damage) * surfMu;
    this.mu = mu;

    // --- active aero: straight mode ---
    const inZone = T.zone[i] === 1;
    if (inZone && inp.throttle > 0.92 && Math.abs(inp.steer) < 0.3 && inp.brake < 0.05 && env.aeroAllowed) this.straightMode = true;
    if (!inZone || inp.brake > 0.05 || Math.abs(inp.steer) > 0.45 || !env.aeroAllowed) this.straightMode = false;
    const ClA = this.straightMode ? PHYS.ClAs : PHYS.ClA;
    const CdA = (this.straightMode ? PHYS.CdAs : PHYS.CdA) * (1 + 0.04 * this.damage);
    const down = 0.5 * rho * ClA * v * v;
    const Fz = M * g + down;
    const aMax = mu * Fz / M;

    // --- energy / power unit ---
    let ers = 0;
    if (this.recharge) ers = 0;
    else if (this.boost || this.otActive) ers = 1;
    else ers = inp.throttle > 0.85 ? (this.battery > 0.8 ? 0.42 : 0.28) : 0.15 * inp.throttle;
    if (this.battery <= 0.02) ers = 0;
    const taper = ersTaper(v, this.otActive);
    let Pers = PHYS.ERS * ers * taper * inp.throttle;
    let Pharv = 0;
    if (this.recharge && inp.throttle > 0.9 && v > 55) Pharv += 120e3; // super-clipping
    let Pwheel = PHYS.ICE * inp.throttle + Pers - (this.recharge ? Pharv : 0);
    if (this.shiftT > 0) { Pwheel *= 0.25; this.shiftT -= dt; }

    // --- longitudinal ---
    const vv = Math.max(v, 2.5);
    const traction = mu * Fz * 0.62;
    let Fdrive = Pwheel / vv;
    this.spin = 0;
    if (Fdrive > traction) {
      if (inp.tc) Fdrive = traction * 0.99;
      else { this.spin = Math.min(1, (Fdrive - traction) / traction); Fdrive = traction * (1 - 0.25 * this.spin); }
    }
    const Fbrake_req = inp.brake * mu * Fz * 0.97;
    const lockLimit = mu * Fz * 0.97;
    this.lock = inp.brake > 0.98 && v > 15 && !inp.abs ? Math.max(0, (inp.brake - 0.97) * 30) * (v > 8 ? 1 : 0) : 0;
    const Fbrake = v > 0.3 ? Math.min(Fbrake_req, lockLimit) * (this.lock > 0 ? 0.88 : 1) : 0;
    const drag = 0.5 * rho * CdA * v * v;
    const Froll = PHYS.roll * M * g + surfDrag * M;
    const engineBrake = inp.throttle < 0.05 ? 2500 : 0;
    let aLon = (Fdrive - Fbrake - drag - Froll - engineBrake) / M;
    if (v <= 0.3 && aLon < 0) aLon = Math.max(aLon, -v / dt);

    // harvesting under braking / lift
    if (inp.brake > 0.05 && v > 10) Pharv += Math.min(350e3, 120e3 + Fbrake * v * 0.6);
    else if (inp.throttle < 0.3 && v > 20) Pharv += 140e3 * (1 - inp.throttle / 0.3);
    if (this.harvestLap >= PHYS.harvestPerLap) Pharv = 0;
    this.ersPower = Pers; this.harvestPower = Pharv;
    const dE = (Pharv - Pers) * dt / 1e6;
    this.battery = Math.max(0, Math.min(PHYS.battery, this.battery + dE));
    if (dE > 0) this.harvestLap += dE; else this.deployLap -= dE;

    // --- lateral (grip-normalised steering + friction circle) ---
    const lonUse = Math.min(0.98, Math.abs(aLon) / Math.max(aMax, 0.1));
    const aAvail = aMax * Math.sqrt(Math.max(0.04, 1 - lonUse * lonUse));
    const delta = 0.36;
    const kinMax = vv * Math.tan(delta) / PHYS.L;
    const gripYawMax = (aMax * 1.1) / vv;
    let wCmd = inp.steer * Math.min(kinMax, gripYawMax);
    if (this.lock > 0) wCmd *= 0.35;
    let w = wCmd;
    this.slip = 0;
    const demand = Math.abs(wCmd) * vv;
    if (demand > aAvail && v > 4) {
      this.slip = Math.min(1, (demand - aAvail) / (aAvail + 1));
      w = Math.sign(wCmd) * aAvail / vv;
      // understeer scrubs speed and pushes the car wide
      aLon -= (demand - aAvail) * 0.12;
      this.vy -= Math.sign(wCmd) * (demand - aAvail) * 0.25 * dt;
    }
    // power oversteer
    if (this.spin > 0 && v > 3) {
      const dir = Math.abs(inp.steer) > 0.05 ? Math.sign(inp.steer) : Math.sign(this.yaw || 1);
      w += dir * this.spin * 0.9;
      this.vy -= dir * this.spin * 6 * dt;
    }
    // yaw inertia
    this.yaw += (w - this.yaw) * Math.min(1, dt / 0.07);
    this.h -= this.yaw * dt;
    this.vy *= Math.exp(-3.2 * dt);

    this.v = Math.max(0, v + aLon * dt);
    this.aLon = aLon;
    this.latG = (this.v * this.yaw) / g;
    this.lonG = aLon / g;

    // --- integrate position ---
    const nfx = Math.cos(this.h), nfz = Math.sin(this.h);
    const nlx = nfz, nlz = -nfx;
    this.x += (nfx * this.v + nlx * this.vy) * dt;
    this.z += (nfz * this.v + nlz * this.vy) * dt;

    // --- track position ---
    const prevS = this.s;
    const n = T.nearest(this.x, this.z, this.idx);
    this.idx = n.idx; this.s = n.s; this.d = n.d;
    let dsx = this.s - prevS; if (dsx > T.L / 2) dsx -= T.L; if (dsx < -T.L / 2) dsx += T.L;
    this.dist += dsx;
    this.y = T.lerpArr(T.cy, this.s);

    // --- walls ---
    const lim = wallD - 1.05;
    if (Math.abs(this.d) > lim) {
      const side = Math.sign(this.d);
      const pen = Math.abs(this.d) - lim;
      const nX = T.nx[this.idx] * side, nZ = T.nz[this.idx] * side; // outward
      this.x -= nX * pen; this.z -= nZ * pen; this.d = side * lim;
      const Vx = nfx * this.v + nlx * this.vy, Vz = nfz * this.v + nlz * this.vy;
      const into = Vx * nX + Vz * nZ;
      if (into > 0) {
        let rx = Vx - nX * into * 1.25, rz = Vz - nZ * into * 1.25;
        const loss = 1 - 0.35 * Math.min(1, into / 18);
        rx *= loss; rz *= loss;
        const sp = Math.hypot(rx, rz);
        // align heading toward the wall tangent
        const th = Math.atan2(rz, rx);
        let dh = th - this.h; while (dh > Math.PI) dh -= 2 * Math.PI; while (dh < -Math.PI) dh += 2 * Math.PI;
        this.h += dh * Math.min(1, 0.4 + into / 25);
        this.v = sp * Math.cos(dh * 0.5); this.vy = 0; this.yaw *= 0.3;
        if (into > 3) {
          this.damage = Math.min(1, this.damage + into / 70);
          this.events.push({ type: 'wall', power: Math.min(1, into / 25) });
        }
      }
    }

    // --- gears & rpm (automatic or manual) ---
    if (inp.autoGear) {
      const top = GEAR_TOP[this.gear - 1];
      if (this.v > top * 0.985 && this.gear < 8) { this.gear++; this.shiftT = 0.045; this.events.push({ type: 'shift', up: true }); }
      else if (this.gear > 1 && this.v < GEAR_TOP[this.gear - 2] * 0.74) { this.gear--; this.events.push({ type: 'shift', up: false }); }
    } else {
      if (inp.shiftUp && this.gear < 8) { this.gear++; this.shiftT = 0.045; this.events.push({ type: 'shift', up: true }); }
      if (inp.shiftDown && this.gear > 1) { this.gear--; this.events.push({ type: 'shift', up: false }); }
      if (this.v > GEAR_TOP[this.gear - 1] * 1.002) this.v = GEAR_TOP[this.gear - 1] * 1.002; // limiter
    }
    const top = GEAR_TOP[this.gear - 1];
    const targetRpm = Math.max(4200, Math.min(12500, 12000 * this.v / top + (this.spin * 2500)));
    this.rpm += (targetRpm - this.rpm) * Math.min(1, dt * 18);

    // --- tyres ---
    const load = 0.35 + 0.65 * Math.min(1.5, (Math.abs(this.latG) + Math.abs(this.lonG)) / 4);
    const comp = COMPOUNDS[this.tyre.c];
    let wr = 0.00042 * comp.wear * env.wearScale * load * (1 + this.slip * 3 + this.lock * 5 + this.spin * 2);
    if ((this.tyre.c === 'I' || this.tyre.c === 'W') && env.wet < 0.2) wr *= 3.0; // wets overheat on a dry track
    this.tyre.wear = Math.min(1, this.tyre.wear + wr * dt * (this.v > 1 ? 1 : 0));
    const warmTarget = (this.tyre.c === 'I' || this.tyre.c === 'W') ? 1 : (1 - env.wet * 0.6);
    this.tyre.temp += (warmTarget - this.tyre.temp) * dt * (0.012 + 0.03 * load) * comp.warm;

    // gameplay signals
    this.throttle = inp.throttle; this.brake = inp.brake; this.steer = inp.steer;
  }
}

export { GEAR_TOP };
