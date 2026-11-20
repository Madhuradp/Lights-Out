// AI drivers move in track coordinates (s along the lap, d sideways from the centre line).
// The same controller also runs the player's car through the pit lane (autopilot).
import { PHYS, accelLimit, brakeLimit, tyreGrip } from './physics.js';
import { COMPOUNDS, PUSH_LEVELS } from './data.js';

export class AICar {
  constructor(T, driver, team, opts) {
    this.T = T; this.driver = driver; this.team = team;
    this.code = driver.code; this.name = driver.name;
    this.s = 0; this.d = 0; this.dist = 0; this.v = 0; this.offset = 0;
    this.skill = opts.skill; this.push = 'balanced'; this.energyMode = 'balanced';
    this.tyre = { c: 'M', wear: 0, temp: 0.75, age: 0 };
    this.usedCompounds = new Set();
    this.battery = 3.0; this.otActive = false; this.straightMode = false;
    this.damage = 0; this.retired = false;
    this.pit = null;           // pit state machine
    this.pitRequest = null;    // compound to fit at the next stop
    this.stops = 0;
    this.yawVis = 0; this.prevD = 0;
    this.braking = false; this.harvesting = false;
    this.wheelSpin = 0;
    this.lastPassCheck = 0;
    this.isPlayerTeam = false;
    this.jitter = (Math.random() - 0.5) * 0.006;
  }

  gripFactor(env) { return tyreGrip(this.tyre, env.wet, this.damage); }

  // target speed at this point of the lap
  targetSpeed(env) {
    const T = this.T;
    const look = this.s + this.v * 0.08;
    let vt = T.lerpArr(T.profile, look);
    const gf = this.gripFactor(env);
    const push = PUSH_LEVELS[this.push];
    let k = Math.sqrt(gf) * (this.skill + this.jitter) * push.speed;
    if (this.energyMode === 'deploy' && this.battery > 0.4) k *= 1.012;
    if (this.energyMode === 'harvest') k *= 0.988;
    if (this.otActive && this.straightMode) k *= 1.025;
    if (env.wet > 0.05) k *= 1 - 0.03 * env.wet; // drivers are more careful in the wet
    vt *= k;
    if (env.vsc) vt = Math.min(vt, T.lerpArr(T.profile, this.s) * 0.6);
    return vt;
  }

  update(dt, env, ahead, behind) {
    if (this.retired) { this.v = Math.max(0, this.v - 25 * dt); this.s = this.T.wrap(this.s + this.v * dt); this.dist += this.v * dt; return; }
    const T = this.T;
    if (this.pit) { this.updatePit(dt, env); return; }

    let vt = this.targetSpeed(env);
    const lineD = T.lerpArr(T.line, this.s);
    let wantOffset = 0;
    let offLimit = T.hw - 1.1;

    // ---- driver mistakes: lock-ups and running wide (more likely in the wet, on old tyres, under pressure) ----
    const kAhead = T.lerpArr(T.lk, this.s + 40);
    const enteringBrake = this.braking && !this.wasBraking;
    if (enteringBrake && !this.mistake && !env.sc && !env.vsc && this.v > 30) {
      const pressure = behind && (this.dist - behind.dist) < 10 ? 1.8 : 1;
      const p = 0.006 * (1 + 7 * env.wet) * (1 + (this.tyre.wear > 0.7 ? 2 : 0)) * (0.4 + (1 - this.skill) * 14) * pressure * (env.mistakeRate ?? 1);
      if (Math.random() < p) {
        const type = Math.random() < 0.55 ? 'lockup' : 'wide';
        this.mistake = { type, t: type === 'lockup' ? 1.8 : 1.4, dir: -Math.sign(kAhead || 1) };
        this.lastMistake = type;
      }
    }
    this.wasBraking = this.braking;
    if (this.mistake) {
      const m = this.mistake;
      m.t -= dt;
      vt *= m.type === 'lockup' ? 0.82 : 0.9;
      wantOffset = m.dir * (T.hw + 1.5) - lineD;
      offLimit = T.street ? T.hw + 0.8 : T.hw + 2.5;
      this.smoking = m.type === 'lockup' && m.t > 1.0;
      if (m.t <= 0) { this.mistake = null; this.smoking = false; }
    }

    // ---- traffic ----
    if (ahead && !ahead.retired) {
      const gap = ahead.dist - this.dist - 5.6;
      const dd = ahead.d - this.d;
      if (gap < 45 && gap > -4) {
        // slipstream
        if (gap < 35 && Math.abs(dd) < 2.2 && T.zone[T.idx(this.s)]) vt *= 1.018;
        const faster = vt > ahead.v + 0.4;
        if (env.sc) {
          vt = Math.min(vt, ahead.v + (gap - 10) * 0.5);
        } else if (gap < 18 && faster && !ahead.pit) {
          // pick the side with more room
          const room = T.hw - 1.3;
          const left = ahead.d + 3.0, right = ahead.d - 3.0;
          const canL = left < room, canR = right > -room;
          let side = this.passSide || 0;
          if (!side) side = (canL && (!canR || lineD > ahead.d)) ? 1 : (canR ? -1 : 0);
          this.passSide = side;
          if (side) wantOffset = (side > 0 ? left : right) - lineD;
          if (!side || Math.abs(dd) < 2.1) vt = Math.min(vt, ahead.v + Math.max(0, gap - 2) * 0.8);
        } else if (Math.abs(dd) < 2.2) {
          vt = Math.min(vt, ahead.v + Math.max(0, gap - 3) * 0.9);
          this.passSide = 0;
        }
      } else this.passSide = 0;
    }
    // blue flag: lift and move off the racing line for the car lapping us
    if (this.blue && !env.sc) {
      vt *= 0.96;
      wantOffset = (behind && behind.d > lineD ? -1 : 1) * 3.2;
    }
    // defend lightly: move toward the car behind's side before braking zones
    else if (behind && !env.sc && !this.passSide && !this.mistake) {
      const gapB = this.dist - behind.dist - 5.6;
      if (gapB < 12 && gapB > 0 && Math.abs(T.lerpArr(T.lk, this.s + 80)) > 0.01) wantOffset = Math.max(-2.5, Math.min(2.5, (behind.d - this.d) * 0.5));
    }
    if (env.sc && env.scCar) {
      // queue behind the safety car
      const lead = env.scCar;
      const gap = lead.dist - this.dist - 6;
      if (gap > -20 && gap < 200) vt = Math.min(vt, lead.v + (gap - 14) * 0.5);
      vt = Math.min(vt, T.lerpArr(T.profile, this.s) * 0.62 + (env.scGapCatch ? 10 : 0));
      wantOffset = 0;
    }

    // ---- longitudinal ----
    const mu = PHYS.mu0 * this.gripFactor(env);
    const zone = T.zone[T.idx(this.s)] === 1 && !env.sc && !env.vsc;
    this.straightMode = zone && this.v > 40;
    if (this.v < vt) {
      const ers = this.energyMode === 'harvest' ? 0.25 : (this.battery > 0.2 ? 0.42 : 0.15);
      const a = accelLimit(this.v, mu, zone, ers);
      this.v = Math.min(vt, this.v + Math.max(0.5, a) * dt);
      this.braking = false;
      this.battery = Math.max(0, this.battery - (this.v > 50 ? 0.06 : 0.02) * dt * (this.energyMode === 'deploy' ? 1.6 : 1));
    } else {
      const b = brakeLimit(this.v, mu);
      this.braking = this.v - vt > 2;
      this.v = Math.max(vt, this.v - b * dt);
      if (this.braking) this.battery = Math.min(PHYS.battery, this.battery + 0.22 * dt);
    }
    this.harvesting = this.braking || this.energyMode === 'harvest';

    // ---- lateral ----
    this.offset += (wantOffset - this.offset) * Math.min(1, dt * 1.6);
    const target = Math.max(-offLimit, Math.min(offLimit, lineD + this.offset));
    const maxRate = 3.2 * Math.min(1, this.v / 15);
    const dd = Math.max(-maxRate * dt, Math.min(maxRate * dt, (target - this.d) * Math.min(1, dt * 2.5)));
    this.d += dd;
    this.yawVis = this.v > 1 ? Math.atan2(dd / dt, this.v) : 0;

    this.s = T.wrap(this.s + this.v * dt);
    this.dist += this.v * dt;

    // ---- tyres ----
    const comp = COMPOUNDS[this.tyre.c];
    const k = Math.abs(T.lerpArr(T.lk, this.s));
    const load = 0.35 + 0.65 * Math.min(1.5, (this.v * this.v * k / 9.81 + (this.braking ? 4 : 0.5)) / 4);
    let wr = 0.00042 * comp.wear * env.wearScale * load * PUSH_LEVELS[this.push].wear;
    if ((this.tyre.c === 'I' || this.tyre.c === 'W') && env.wet < 0.2) wr *= 3;
    if (this.v > 1) this.tyre.wear = Math.min(1, this.tyre.wear + wr * dt);
    const warmTarget = (this.tyre.c === 'I' || this.tyre.c === 'W') ? 1 : 1 - env.wet * 0.6;
    this.tyre.temp += (warmTarget - this.tyre.temp) * dt * 0.04 * comp.warm;
  }

  // ---------------- pit lane ----------------
  startPit(boxS, stopTime, onArrive) {
    this.pit = { phase: 'in', boxS, stopTime, timer: 0, onArrive, startD: this.d };
  }

  // relative s (negative before the line)
  relS() { const L = this.T.L; return this.s > L / 2 ? this.s - L : this.s; }

  updatePit(dt, env) {
    const T = this.T, P = T.pit, p = this.pit;
    const rs = this.relS();
    let vt;
    const mu = PHYS.mu0 * this.gripFactor(env);
    if (p.phase === 'in') {
      // lateral move into the pit lane over the first 90 m
      const u = Math.min(1, Math.max(0, (rs - P.sIn) / 90));
      this.d = p.startD + (P.d - p.startD) * smooth(u);
      vt = rs < P.sLimitA ? Math.max(P.limit, T.lerpArr(T.profile, this.s) * 0.8 - (P.sLimitA - rs < 160 ? 0 : 0)) : P.limit;
      // brake to the limit before the line
      const distTo = P.sLimitA - rs;
      if (distTo > 0) vt = Math.min(vt, Math.sqrt(P.limit * P.limit + 2 * 30 * distTo));
      if (rs >= P.sLimitA) p.phase = 'lane';
    } else if (p.phase === 'lane') {
      this.d += (P.d - this.d) * Math.min(1, dt * 3);
      const distBox = p.boxS - rs;
      vt = Math.min(P.limit, Math.sqrt(Math.max(0, 2 * 9 * Math.max(0, distBox - 0.5))));
      if (distBox < 0.6 && this.v < 1.5) { this.v = 0; p.phase = 'stop'; p.timer = 0; if (p.onArrive) p.onArrive(this); }
    } else if (p.phase === 'stop') {
      this.v = 0;
      p.timer += dt;
      if (!p.manual && p.timer >= p.stopTime) this.releaseFromBox();
      return;
    } else if (p.phase === 'go') {
      vt = P.limit;
      if (rs >= P.sLimitB) p.phase = 'out';
    } else if (p.phase === 'out') {
      const u = Math.min(1, Math.max(0, (rs - P.sLimitB) / Math.max(30, P.sOut - P.sLimitB)));
      const endD = -(T.hw - 2.2);
      this.d = P.d + (endD - P.d) * smooth(u);
      vt = T.lerpArr(T.profile, this.s) * 0.9;
      if (u >= 1) { this.pit = null; this.offset = this.d - T.lerpArr(T.line, this.s); if (p.onExit) p.onExit(this); }
    }
    if (vt !== undefined) {
      if (this.v < vt) this.v = Math.min(vt, this.v + Math.max(1, accelLimit(this.v, mu, false, 0.4)) * dt);
      else this.v = Math.max(vt, this.v - brakeLimit(this.v, mu) * dt);
    }
    this.s = T.wrap(this.s + this.v * dt);
    this.dist += this.v * dt;
    this.yawVis = 0;
  }

  releaseFromBox() {
    const p = this.pit; if (!p) return;
    p.phase = 'go';
    if (this.pitRequest) {
      this.tyre = { c: this.pitRequest, wear: 0, temp: 0.2, age: 0 };
      this.usedCompounds.add(this.pitRequest);
    }
    if (p.repair) this.damage = 0;
    this.pitRequest = null; this.stops++;
    if (p.onRelease) p.onRelease(this);
  }
}

function smooth(u) { return u * u * (3 - 2 * u); }
