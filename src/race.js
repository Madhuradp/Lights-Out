// Race simulation: grid, start lights, timing, pit stops, strategy, weather,
// safety car, penalties, radio messages and results. No rendering here.
import { PlayerCar, PHYS } from './physics.js';
import { AICar } from './ai.js';
import { TEAMS, DRIVERS, COMPOUNDS, DIFFICULTY } from './data.js';

const CP = 48; // timing checkpoints per lap
export const TEAM_PACE = { aurora: 1.0, falcon: 0.997, nightfall: 0.995, solaris: 0.993, kestrel: 0.991, verdant: 0.988, ion: 0.986, monarch: 0.984, titan: 0.982, blaze: 0.98 };

export class Race {
  constructor(T, cfg) {
    this.T = T; this.cfg = cfg;
    this.mode = cfg.mode; // 'race' | 'pitwall' | 'hotlap' | 'quali' | 'grandstand'
    this.solo = cfg.mode === 'hotlap' || cfg.mode === 'quali';      // one car on track
    this.aiPlayer = cfg.mode === 'pitwall' || cfg.mode === 'grandstand'; // the focus car is driven by the AI
    this.laps = cfg.mode === 'hotlap' ? 999 : cfg.mode === 'quali' ? 1 : cfg.laps;
    this.commentary = [];
    this.time = 0; this.raceTime = 0; this.startTime = 0;
    this.phase = 'grid';
    this.lightsT = 0; this.lightsOn = 0;
    this.wearScale = this.solo ? 1 : Math.max(1, Math.min(7, 36 / cfg.laps));
    this.radio = []; this.control = []; this.banners = []; this.events = [];
    this.fastest = null;
    this.sc = false; this.vsc = false; this.scCar = null; this.scEndLap = 0; this.vscEnd = 0; this.scEnding = false;
    this.finishedOrder = []; this.leaderFinished = false;
    this.overall = { s: [Infinity, Infinity, Infinity] };
    this.trackLimits = 0; this.penalty = 0; this.jumpStart = false;
    this.otAvailable = false;
    this.incidentRate = { off: 0, low: 0.5, normal: 1, high: 2.5 }[cfg.incidents || 'normal'];
    this.setupWeather();
    this.setupCars();
    if (cfg.scenario) { this.scenario = cfg.scenario; this.scenario.setup(this); }
  }

  // ---------------- setup ----------------
  setupCars() {
    const T = this.T, cfg = this.cfg;
    const skill = DIFFICULTY[cfg.difficulty || 'pro'].skill;
    this.cars = [];
    const playerTeam = cfg.team || 'aurora';
    const startC = this.weather.wet > 0.5 ? 'W' : this.weather.wet > 0.2 ? 'I' : null;

    if (this.solo) {
      const p = this.makePlayerCar(playerTeam, 'S');
      p.tyre.temp = 1;
      p.placeAt(T.L - 420, T.lerpArr(T.line, T.L - 420)); p.v = 62; p.gear = 6; p.dist = -420;
      this.player = p; this.cars.push(p);
      this.phase = 'racing'; this.startTime = 0;
      this.ghost = null; this.ghostRec = []; this.bestTrace = null; this.curTrace = [];
      p.lapStart = 0;
      return;
    }

    const field = Math.max(6, Math.min(20, cfg.opponents + 1));
    let pool = DRIVERS.slice();
    // the player's team-mate seat is taken by the player (race) or the player's driver (pitwall)
    const mate = pool.find(d => d.team === playerTeam);
    pool = pool.filter(d => d !== mate);
    pool.sort((a, b) => TEAM_PACE[b.team] - TEAM_PACE[a.team] + (Math.random() - 0.5) * 0.012);
    if (cfg.fieldCodes) pool = cfg.fieldCodes.map(c => DRIVERS.find(d => d.code === c)).filter(d => d && d !== mate);
    const ais = pool.slice(0, cfg.fieldCodes ? pool.length : field - 1).map(drv => {
      const team = TEAMS.find(t => t.id === drv.team);
      const a = new AICar(T, drv, team, { skill: skill * TEAM_PACE[drv.team] * (1 + (Math.random() - 0.5) * 0.008) });
      const c = startC || (Math.random() < 0.6 ? 'S' : 'M');
      a.tyre = { c, wear: 0, temp: 0.75, age: 0 }; a.usedCompounds.add(c);
      return a;
    });

    let me;
    if (cfg.mode === 'race') {
      me = this.makePlayerCar(playerTeam, startC || cfg.startTyre || 'M');
    } else {
      const team = TEAMS.find(t => t.id === playerTeam);
      me = new AICar(T, mate, team, { skill: skill * TEAM_PACE[playerTeam] });
      me.isPlayerTeam = cfg.mode === 'pitwall'; me.isPlayer = cfg.mode === 'pitwall';
      const c = startC || cfg.startTyre || 'M';
      me.tyre = { c, wear: 0, temp: 0.75, age: 0 }; me.usedCompounds.add(c);
    }
    this.player = me;

    // grid order
    let grid = ais.slice();
    if (cfg.gridOrder) {
      // qualifying result: codes in grid order ('ME' = the player's car)
      const all = ais.concat([me]);
      grid = cfg.gridOrder.map(code => code === 'ME' ? me : all.find(a => a.code === code)).filter(Boolean);
      for (const a of all) if (!grid.includes(a)) grid.push(a);
    } else {
      const slot = cfg.mode === 'grandstand' ? Math.floor(Math.random() * grid.length) : Math.max(0, Math.min(grid.length, (cfg.gridPos || 8) - 1));
      grid.splice(slot, 0, me);
    }
    grid.forEach((c, i) => {
      const s = T.L - 18 - i * 8.5;
      const d = (i % 2 === 0 ? 1 : -1) * 2.6;
      c.dist = s - T.L; c.s = T.wrap(s); c.d = d; c.v = 0; c.grid = i + 1;
      if (c instanceof PlayerCar) { c.placeAt(s, d); c.dist = s - T.L; }
      c.startDist = c.dist;
    });
    this.cars = grid;
    this.cars.forEach(c => { c.cp = []; c.cpIdx = 0; c.lapTimes = []; c.sectors = []; c.best = Infinity; c.finished = false; c.penalty = 0; c.stops = c.stops || 0; c.prevRel = c.dist; c.lapsDone = 0; c.bestS = [Infinity, Infinity, Infinity]; c.curS = [null, null, null]; });
    this.phase = 'grid'; this.lightsT = 0;
    this.updatePositions();
  }

  makePlayerCar(teamId, c) {
    const p = new PlayerCar(this.T);
    const team = TEAMS.find(t => t.id === teamId);
    p.team = team; p.code = (this.cfg.code || 'YOU').toUpperCase().slice(0, 3); p.name = this.cfg.name || 'You';
    p.driver = { num: this.cfg.num || 1 };
    p.isPlayer = true; p.pit = null; p.stops = 0; p.retired = false; p.pitRequest = null;
    p.tyre = { c, wear: 0, temp: 0.75, age: 0 }; p.usedCompounds.add(c);
    p.cp = []; p.cpIdx = 0; p.lapTimes = []; p.best = Infinity; p.penalty = 0; p.lapCp = [];
    return p;
  }

  setupWeather() {
    const w = this.cfg.weather || 'dry';
    const est = (this.cfg.laps || 5) * (this.T.circ.refLapTime || 80);
    this.weather = { rain: 0, wet: 0, plan: [] };
    if (w === 'wet') { this.weather.rain = 0.75; this.weather.wet = 0.8; this.weather.plan = [{ t: 0, rain: 0.75 }]; }
    if (w === 'changeable') {
      const t0 = est * (0.22 + Math.random() * 0.25);
      const peak = 0.55 + Math.random() * 0.35;
      const t1 = t0 + est * (0.25 + Math.random() * 0.2);
      this.weather.plan = [{ t: t0, rain: peak * 0.5 }, { t: t0 + 40, rain: peak }, { t: t1, rain: 0.15 }, { t: t1 + 30, rain: 0 }];
    }
  }

  // ---------------- per-frame ----------------
  env() {
    return {
      wet: this.weather.wet, wearScale: this.wearScale, sc: this.sc, vsc: this.vsc, scCar: this.scCar,
      mistakeRate: { off: 0.3, low: 0.6, normal: 1, high: 1.6 }[this.cfg.incidents || 'normal'],
      aeroAllowed: !this.sc && !this.vsc && this.weather.wet < 0.35 && this.phase !== 'grid' && this.phase !== 'lights',
    };
  }

  update(dt, input) {
    this.time += dt;
    this.events.length = 0;
    this.updateWeather(dt);
    const env = this.env();

    if (this.phase === 'grid') {
      this.lightsT += dt;
      if (this.lightsT > 2.2) { this.phase = 'lights'; this.lightsT = 0; this.lightsOn = 0; this.lightsOutAt = 4.2 + Math.random() * 1.6; }
      this.holdCars(dt, input, env);
      return;
    }
    if (this.phase === 'lights') {
      this.lightsT += dt;
      const on = Math.min(5, Math.floor(this.lightsT / 0.9) + 1);
      if (on !== this.lightsOn) { this.lightsOn = on; this.events.push({ type: 'light', n: on }); }
      if (this.lightsT >= this.lightsOutAt) {
        this.lightsOn = 0; this.phase = 'racing'; this.startTime = this.time; this.events.push({ type: 'lightsout' });
        this.cars.forEach(c => { c.lapStart = this.time; c.reaction = 0.15 + Math.random() * 0.25; });
        if (this.jumpStart) { this.player.penalty += 5; this.rc('Jump start: 5 second time penalty for ' + this.player.code, 'pen'); }
      }
      this.holdCars(dt, input, env);
      return;
    }

    this.raceTime = this.time - this.startTime;
    // ---- cars ----
    const order = this.cars.slice().sort((a, b) => b.dist - a.dist);
    // physical order around the lap (lapped cars are next to the cars lapping them)
    this.phys = this.cars.slice().sort((a, b) => a.s - b.s);
    this.phys.forEach((c, i) => c.physIdx = i);
    const lapsLeftLeader = this.laps - Math.floor(order[0].dist / this.T.L) - 1;
    for (let i = 0; i < order.length; i++) {
      const c = order[i];
      if (c === this.player && !this.aiPlayer) continue;
      if (c.reaction > 0) { c.reaction -= dt; continue; }
      const ahead = this.findAhead(c), behind = this.findBehind(c);
      c.blue = !!(behind && behind.ref && behind.ref.dist > c.dist + this.T.L * 0.5 && c.dist - behind.dist < 60);
      if (c.finished && !c.pit) { c.skill = 0.6; }
      // late-race push when the tyres allow it
      if (!c.isPlayer && !c.finished && lapsLeftLeader <= 1 && c.tyre.wear < 0.8 && c.push === 'balanced') c.push = 'push';
      c.update(dt, env, ahead, behind);
      if (c.lastMistake) this.onMistake(c);
      if (c.retired) c.d += (Math.sign(c.d || 1) * (this.T.hw + 4) - c.d) * Math.min(1, dt * 0.8);
    }
    if (!this.aiPlayer) this.updatePlayer(dt, input, env, order);
    if (this.scCar) this.updateSafetyCar(dt);

    this.phys = this.cars.slice().sort((a, b) => a.s - b.s); this.phys.forEach((c, i) => c.physIdx = i);
    this.collisions();
    this.timing();
    if (!this.solo) { this.strategy(env); this.incidents(dt); this.raceControl(dt); }
    if (this.scenario && this.scenario.tick) this.scenario.tick(this, dt);
    this.updatePositions();
    this.commentate();
  }

  holdCars(dt, input, env) {
    // cars wait on the grid; the player can rev but must not move
    const p = this.player;
    if (p instanceof PlayerCar) {
      const inp = Object.assign({}, input, { steer: 0 });
      p.rpm += ((input.throttle > 0.1 ? 4000 + input.throttle * 7500 : 4200) - p.rpm) * Math.min(1, dt * 8);
      if (input.throttle > 0.5 && this.phase === 'lights' && this.lightsT > 0.3) this.creep = (this.creep || 0) + dt;
      if ((this.creep || 0) > 0.35 && !this.jumpStart) { this.jumpStart = true; }
      p.v = 0;
    }
  }

  onMistake(c) {
    const kind = c.lastMistake; c.lastMistake = null;
    const corner = this.cornerAt(c.s + 60);
    const near = Math.abs(c.dist - this.player.dist) < 400 || c === this.player || c.isPlayerTeam;
    if (this.T.street && kind === 'wide' && Math.random() < 0.3 && this.incidentRate > 0) { this.retire(c, 'crash'); return; }
    if (near && this.time - (this.lastMistakeMsg || 0) > 8) {
      this.lastMistakeMsg = this.time;
      this.rc(kind === 'lockup' ? `${c.code} locks up into ${corner ? corner.name : 'the corner'}` : `${c.code} runs wide at ${corner ? corner.name : 'the corner'}`, 'info');
      if (c.isPlayerTeam) this.radioMsg('drv', kind === 'lockup' ? 'Sorry, locked the fronts. I flat-spotted the tyre.' : 'I ran wide, lost some time there.');
    }
    if (kind === 'lockup') c.tyre.wear = Math.min(1, c.tyre.wear + 0.03);
  }

  // nearest car physically in front (wraps around the lap); returns a proxy in this car's distance frame
  findAhead(me) {
    const P = this.phys, n = P.length, L = this.T.L;
    if (!P || me.physIdx === undefined) return null;
    for (let k = 1; k < n; k++) {
      const o = P[(me.physIdx + k) % n];
      const gap = (o.s - me.s + L) % L;
      if (gap > 80) return null;
      if (!!o.pit === !!me.pit && !o.retired) return { dist: me.dist + gap, d: o.d, v: o.v, pit: o.pit, retired: false, ref: o };
    }
    return null;
  }
  findBehind(me) {
    const P = this.phys, n = P.length, L = this.T.L;
    if (!P || me.physIdx === undefined) return null;
    for (let k = 1; k < n; k++) {
      const o = P[(me.physIdx - k + n) % n];
      const gap = (me.s - o.s + L) % L;
      if (gap > 60) return null;
      if (!!o.pit === !!me.pit && !o.retired) return { dist: me.dist - gap, d: o.d, v: o.v, pit: o.pit, retired: false, ref: o };
    }
    return null;
  }

  // ---------------- player ----------------
  updatePlayer(dt, input, env, order) {
    const p = this.player, T = this.T;
    if (p.pit || p.finished && this.mode === 'race' || p.autopilot) {
      // run the pit lane / cool-down lap on autopilot
      if (!p.auto) {
        p.auto = new AICar(T, { code: p.code, name: p.name, num: 1 }, p.team, { skill: p.finished ? 0.6 : 0.97 });
        p.auto.s = p.s; p.auto.d = p.d; p.auto.v = p.v; p.auto.dist = p.dist; p.auto.tyre = p.tyre; p.auto.usedCompounds = p.usedCompounds;
        p.auto.pit = p.pit; p.auto.pitRequest = p.pitRequest; p.auto.damage = p.damage;
      }
      const a = p.auto;
      a.physIdx = p.physIdx; a.update(dt, env, this.findAhead(p), null);
      p.s = a.s; p.d = a.d; p.v = a.v; p.dist = a.dist; p.pit = a.pit; p.tyre = a.tyre; p.damage = a.damage;
      const o = {}; T.at(p.s, o);
      p.x = o.x + o.nx * p.d; p.z = o.z + o.nz * p.d; p.y = o.y; p.h = Math.atan2(o.tz, o.tx);
      p.idx = o.i; p.yaw = 0; p.vy = 0;
      p.gear = Math.max(1, Math.min(8, Math.round(p.v / 12) + 1));
      p.rpm += ((p.v < 0.5 ? 4500 : 9000 + (p.v % 12) * 200) - p.rpm) * Math.min(1, dt * 6);
      p.throttle = 0.3; p.brake = 0; p.straightMode = false;
      if (!p.pit && !p.finished) {
        // hand control back
        p.auto = null; p.autopilot = false;
        p.placeAt(p.s, p.d); p.v = a.v;
        this.radioMsg('eng', 'Pit exit. Watch the white line. Tyres are cold, build them up.');
      }
      return;
    }
    // player-driven
    const inp = Object.assign({}, input);
    // VSC / SC limits shown as delta; we don't override the player's throttle
    const sub = 2;
    for (let k = 0; k < sub; k++) p.step(dt / sub, inp, env);
    // blue flags: a car lapping the player is close behind
    const bh = this.findBehind(p);
    const blue = !!(bh && bh.ref && bh.ref.dist > p.dist + T.L * 0.5 && p.dist - bh.dist < 70);
    if (blue && !p.blue) { this.rc(`Blue flag for ${p.code}: let ${bh.ref.code} through`, 'blue'); this.events.push({ type: 'blue' }); }
    p.blue = blue;
    // pit entry
    const rel = p.s > T.L / 2 ? p.s - T.L : p.s;
    if (p.pitRequest && p.prevRel !== undefined && p.prevRel < T.pit.sIn && rel >= T.pit.sIn && rel < T.pit.sIn + 60 && !p.finished) {
      this.enterPit(p);
    }
    p.prevRel = rel;

    // track limits
    const c = this.cornerAt(p.s);
    if (c && Math.abs(p.d) > T.hw + 2.2 && !T.street && p.surface !== 'track') {
      if (this.lastTLCorner !== c.num + '-' + Math.floor(p.dist / T.L)) {
        this.lastTLCorner = c.num + '-' + Math.floor(p.dist / T.L);
        if (this.solo) { if (!this.lapInvalid) { this.lapInvalid = true; this.events.push({ type: 'invalid' }); } }
        else {
        this.trackLimits++;
        if (this.trackLimits === 3) this.rc(`Car ${p.driver.num} (${p.code}): black and white flag, track limits`, 'warn');
        else if (this.trackLimits > 3 && this.cfg.assist && this.cfg.assist.steer) this.rc(`Track limits: ${p.code} at ${c.name} (warning only with steering assist)`, 'warn');
        else if (this.trackLimits > 3) { p.penalty += 5; this.rc(`5 second time penalty for ${p.code}: track limits`, 'pen'); this.radioMsg('eng', 'Five second penalty, track limits. Keep it inside the white lines.'); }
        else this.rc(`Track limits: ${p.code} at ${c.name}. Warning ${this.trackLimits}`, 'warn');
        }
      }
    }
    // overtaking under SC / VSC
    if (!this.lastRel) this.lastRel = new Map();
    for (const o of this.cars) {
      if (o === p) continue;
      const gap = o.dist - p.dist;
      const prev = this.lastRel.get(o);
      if (Math.abs(gap) < 40 && prev !== undefined) {
        if (prev > 0 && gap < -1 && !o.pit && !p.pit) {
          if ((this.sc || this.vsc) && !o.retired) {
            p.penalty += 5; this.rc(`${p.code} overtook ${o.code} under ${this.sc ? 'safety car' : 'VSC'}: 5 second penalty`, 'pen');
            this.radioMsg('eng', 'You passed under the safety car. That is a five second penalty.');
          } else if (!o.retired) this.events.push({ type: 'overtake', who: o.code });
        }
        if (prev < 0 && gap > 1 && !o.pit && !p.pit && !o.retired && !this.sc) this.events.push({ type: 'overtaken', who: o.code });
      }
      this.lastRel.set(o, gap);
    }
    if (this.vsc) {
      const cap = T.lerpArr(T.profile, p.s) * 0.62;
      if (p.v > cap * 1.08) { this.vscOver = (this.vscOver || 0) + dt; if (this.vscOver > 2.5) { this.vscOver = 0; this.vscWarn = (this.vscWarn || 0) + 1; if (this.vscWarn >= 2) { p.penalty += 5; this.rc(`${p.code}: 5 second penalty, exceeding VSC delta`, 'pen'); } else this.radioMsg('eng', 'You are over the VSC delta. Slow down.'); } }
    }
  }

  cornerAt(s) {
    for (const c of this.T.corners) {
      const a = c.sStart - 10, b = c.sEnd + 25;
      if (a <= b ? (s >= a && s <= b) : (s >= a || s <= b)) return c;
    }
    return null;
  }

  enterPit(car) {
    const T = this.T;
    const ti = Math.max(0, require_teamIndex(car.team.id));
    const boxS = T.pit.boxes[ti];
    if (car instanceof PlayerCar) {
      car.auto = new AICar(T, { code: car.code, name: car.name, num: 1 }, car.team, { skill: 0.97 });
      Object.assign(car.auto, { s: car.s, d: car.d, v: car.v, dist: car.dist, tyre: car.tyre, usedCompounds: car.usedCompounds, pitRequest: car.pitRequest, damage: car.damage, stops: car.stops || 0 });
      car.auto.startPit(boxS, 0, a => this.onPlayerBox(car, a));
      car.auto.pit.manual = !!this.cfg.pitGame;
      car.auto.pit.repair = car.damage > 0.15;
      car.auto.pit.stopTime = 2.2 + (car.damage > 0.15 ? 6 : 0);
      car.auto.pit.onRelease = a => this.onRelease(car, a);
      car.pit = car.auto.pit;
      this.radioMsg('eng', 'Pit limiter on. We are ready for you.');
    } else {
      const slow = Math.random() < 0.05 ? 2.5 + Math.random() * 2 : 0;
      const repair = car.damage > 0.3;
      const t = 2.0 + Math.random() * 0.8 + slow + (repair ? 6 : 0);
      car.startPit(boxS, t, a => { if (car.isPlayerTeam && this.cfg.pitGame) { a.pit.manual = true; this.events.push({ type: 'pitgame', car: a }); } });
      car.pit.repair = repair;
      car.pit.onRelease = a => this.onRelease(car, a, slow);
    }
  }

  onPlayerBox(car, a) {
    if (a.pit.manual) this.events.push({ type: 'pitgame', car: a });
  }
  onRelease(car, a, slow) {
    const t = a.pit.manual ? a.pit.timer : a.pit.stopTime;
    car.lastStop = t;
    car.stops = a.stops;
    if (car.tyre !== a.tyre) car.tyre = a.tyre;
    if (a !== car) { car.usedCompounds = a.usedCompounds; car.damage = a.damage; }
    car.pitRequest = null;
    if (car.isPlayer || car.isPlayerTeam) this.rc(`${car.code} pit stop: ${t.toFixed(2)}s, ${COMPOUNDS[car.tyre.c].name} tyres`, 'info');
    else if (slow) this.rc(`Slow stop for ${car.code}: ${t.toFixed(1)}s`, 'info');
  }

  // ---------------- collisions ----------------
  collisions() {
    const T = this.T, P = this.phys || [], n = P.length;
    for (let i = 0; i < n; i++) {
      const a = P[i];
      for (let k = 1; k < n; k++) {
        const b = P[(i - k + n) % n]; // physically behind a
        const ds = (a.s - b.s + T.L) % T.L;
        if (ds > 5.6) break;
        if (a.retired && b.retired) continue;
        if (!!a.pit !== !!b.pit) continue;
        const dd = a.d - b.d;
        if (Math.abs(dd) < 1.95 && ds < 5.5) {
          const overS = 5.5 - ds, overD = 1.95 - Math.abs(dd);
          const rel = Math.abs(a.v - b.v);
          if (overS < overD * 1.6) {
            // nose-to-tail: behind car loses speed
            const push = overS * 0.5;
            this.nudge(a, push, 0); this.nudge(b, -push, 0);
            const vAvg = (a.v + b.v) / 2;
            if (b.v > a.v) { b.v = vAvg - 0.5; a.v = vAvg + 0.3; }
          } else {
            const side = Math.sign(dd) || 1;
            this.nudge(a, 0, side * overD * 0.5); this.nudge(b, 0, -side * overD * 0.5);
          }
          if (rel > 9 || overD > 1) this.contact(a, b, rel);
        }
      }
    }
  }
  nudge(c, dsA, dd) {
    const T = this.T;
    if (c instanceof PlayerCar && !c.auto) {
      const o = {}; T.at(c.s, o);
      c.x += o.tx * dsA + o.nx * dd; c.z += o.tz * dsA + o.nz * dd;
      c.d += dd; c.dist += dsA;
    } else {
      c.dist += dsA; c.s = T.wrap(c.s + dsA); c.d = Math.max(-(T.hw + T.runoff - 1), Math.min(T.hw + T.runoff - 1, c.d + dd));
    }
  }
  contact(a, b, rel) {
    const now = this.time;
    if (this.lastContact && now - this.lastContact < 0.6) return;
    this.lastContact = now;
    for (const c of [a, b]) {
      if (c.isPlayer && c instanceof PlayerCar) {
        c.events.push({ type: 'contact', power: Math.min(1, rel / 15) });
        if (rel > 11) { c.damage = Math.min(1, c.damage + rel / 60); if (c.damage > 0.2 && !this.dmgMsg) { this.dmgMsg = true; this.radioMsg('eng', 'We can see front wing damage. Box if it gets worse.'); } }
      } else if (rel > 14 && Math.random() < 0.25 && !this.solo && !c.retired && this.phase === 'racing') {
        this.retire(c, 'collision');
      } else if (rel > 10) c.damage = Math.min(1, (c.damage || 0) + rel / 70);
    }
  }

  // ---------------- timing ----------------
  timing() {
    const T = this.T, now = this.time, S3 = CP / 3;
    for (const c of this.cars) {
      while (c.dist >= c.cpIdx * T.L / CP) {
        const j = c.cpIdx;
        c.cp[j] = now;
        c.cpIdx++;
        if (j === 0) {
          if (this.solo) { c.lapStart = now; c.lapCp = []; this.curTrace = []; }
          continue;
        }
        const m = j % CP;
        if (c.lapCp) c.lapCp[m === 0 ? CP : m] = now - c.lapStart;
        if (m % S3 === 0) {
          const secIdx = m === 0 ? 2 : m / S3 - 1;
          const secStart = (j - S3 === 0 && !this.solo) ? this.startTime : c.cp[j - S3];
          const st = now - secStart;
          c.curS = c.curS || [null, null, null];
          c.bestS = c.bestS || [Infinity, Infinity, Infinity];
          let color = 'yellow';
          if (st < this.overall.s[secIdx]) { this.overall.s[secIdx] = st; color = 'purple'; }
          else if (st < c.bestS[secIdx]) color = 'green';
          if (st < c.bestS[secIdx]) c.bestS[secIdx] = st;
          if (secIdx === 0) { c.curS[1] = null; c.curS[2] = null; }
          c.curS[secIdx] = { t: st, color };
          if (c === this.player) this.events.push({ type: 'sector', idx: secIdx, color, t: st });
        }
        if (m === 0) this.lapComplete(c, j / CP, now);
      }
    }
    if (this.solo) {
      const p = this.player;
      if (this.curTrace && p.lapStart !== undefined) {
        const t = now - p.lapStart;
        const last = this.curTrace[this.curTrace.length - 1];
        if (!last || t - last.t >= 0.05) this.curTrace.push({ t, x: p.x, y: p.y, z: p.z, h: p.h });
      }
    }
  }

  lapComplete(c, lap, now) {
    const lt = now - (c.lapStart ?? this.startTime);
    c.lapStart = now;
    c.lapTimes.push(lt); c.lapsDone = lap;
    if (c.tyre) c.tyre.age++;
    const valid = !(c.isPlayer && this.lapInvalid);
    if (c.isPlayer) this.lapInvalid = false;
    if (lt < c.best && valid) {
      const hadBest = isFinite(c.best);
      c.best = lt;
      if (c.lapCp) c.bestCp = c.lapCp.slice();
      if (this.solo) { this.bestTrace = this.curTrace; if (hadBest) this.banner('PERSONAL BEST', fmt(lt), 'green'); }
    }
    if (c.lapCp) c.lapCp = [];
    if (this.solo) { if (!valid) this.rc('Lap ' + lap + ' deleted: track limits', 'warn'); this.curTrace = []; }
    if (c instanceof PlayerCar) { c.harvestLap = 0; c.deployLap = 0; }
    if ((!this.fastest || lt < this.fastest.t) && valid && !this.solo && lap > 1) {
      const first = !this.fastest;
      this.fastest = { t: lt, code: c.code, lap };
      if (!first) { this.rc(`Fastest lap: ${c.code} ${fmt(lt)}`, 'purple'); if (c.isPlayer) this.banner('FASTEST LAP', fmt(lt), 'purple'); }
    }
    // overtake mode detection at the line: within 1s of the car ahead
    if (!this.solo) {
      const ahead = this.cars.filter(o => o !== c && o.cp[c.cpIdx - 1] !== undefined && o.cp[c.cpIdx - 1] < now).sort((a, b) => b.cp[c.cpIdx - 1] - a.cp[c.cpIdx - 1])[0];
      const gap = ahead ? now - ahead.cp[c.cpIdx - 1] : 99;
      const ok = gap < 1.0 && !this.sc && !this.vsc && lap >= 1 && this.weather.wet < 0.35;
      if (c === this.player && this.mode === 'race') {
        c.otActive = false;
        this.otAvailable = ok;
        if (ok) this.radioMsg('eng', `Overtake available. Gap ${gap.toFixed(1)}.`);
      } else c.otActive = ok;
    }
    if (this.mode === 'quali' && c === this.player && lap >= 1) { c.finished = true; this.events.push({ type: 'qualiDone', t: lt, valid }); }
    if (this.solo) return;
    // finish
    if (lap >= this.laps && !c.finished) {
      if (!this.leaderFinished) { this.leaderFinished = true; this.banner('CHEQUERED FLAG', `${c.code} wins`, 'flag'); this.events.push({ type: 'chequered' }); }
      c.finished = true; c.finishTime = now - this.startTime; this.finishedOrder.push(c);
      if (c === this.player) { this.events.push({ type: 'playerFinished' }); this.playerFinishedAt = this.time; }
    } else if (this.leaderFinished && !c.finished) {
      c.finished = true; c.finishTime = now - this.startTime; this.finishedOrder.push(c);
      if (c === this.player) { this.events.push({ type: 'playerFinished' }); this.playerFinishedAt = this.time; }
    }
    if (c === this.player && !c.finished) {
      const left = this.laps - lap;
      if (left === 1) { this.banner('FINAL LAP', '', 'white'); this.radioMsg('eng', 'Final lap. Everything you have got.'); }
      if (this.mode === 'race' && this.laps >= 5 && this.weather.wet < 0.2 && left <= 3 && left > 0 && c.usedCompounds.size < 2 && ![...c.usedCompounds].some(x => x === 'I' || x === 'W') && !this.tyreRuleMsg) {
        this.tyreRuleMsg = true; this.radioMsg('eng', 'Reminder: you must use two dry compounds. We need to pit before the end.');
      }
    }
  }

  // ---------------- strategy (AI + player team suggestions) ----------------
  strategy(env) {
    const T = this.T;
    for (const c of this.cars) {
      if (c.finished || c.retired || c.pit) continue;
      const rel = c.s > T.L / 2 ? c.s - T.L : c.s;
      // AI pit entry crossing
      if (!(c instanceof PlayerCar)) {
        if (c.pitRequest && c.prevRel < T.pit.sIn && rel >= T.pit.sIn && rel < T.pit.sIn + 60) this.enterPit(c);
      }
      // decide once per lap, at mid-lap
      const half = T.L * 0.5;
      const lapNow = Math.floor(c.dist / T.L) + 1;
      if (c.decidedLap !== lapNow && c.s > half && c.s < half + 200) {
        c.decidedLap = lapNow;
        if (!c.isPlayer || (this.mode === 'pitwall' && this.cfg.autoStrategy)) this.aiDecide(c, lapNow, env);
        if (c === this.player && this.mode !== 'grandstand') this.engineerAdvice(c, lapNow);
      }
      c.prevRel = rel;
    }
  }

  aiDecide(c, lapNow, env) {
    const remaining = this.laps - lapNow;
    if (remaining < 1) return;
    const wet = this.weather.wet;
    const slick = c.tyre.c !== 'I' && c.tyre.c !== 'W';
    let want = null;
    if (slick && wet > 0.28 + Math.random() * 0.08) want = wet > 0.75 ? 'W' : 'I';
    else if (c.tyre.c === 'I' && wet > 0.8) want = 'W';
    else if (c.tyre.c === 'W' && wet < 0.55) want = 'I';
    else if (!slick && wet < 0.15) want = this.pickDry(c, remaining);
    else if (slick) {
      const needRule = this.laps >= 5 && wet < 0.2 && c.usedCompounds.size < 2 && ![...c.usedCompounds].some(x => x === 'I' || x === 'W');
      if (c.tyre.wear > 0.66 + Math.random() * 0.1 && remaining > 1) want = this.pickDry(c, remaining);
      else if (this.sc && c.tyre.wear > 0.3 && remaining > 2 && Math.random() < 0.7) want = this.pickDry(c, remaining);
      else if (needRule && remaining <= 2 + Math.floor(Math.random() * 2)) want = this.pickDry(c, remaining);
    }
    if (c.damage > 0.35 && !want) want = slick ? this.pickDry(c, remaining) : c.tyre.c;
    if (want) c.pitRequest = want;
  }

  pickDry(c, remaining) {
    const T = this.T;
    const lapT = T.circ.refLapTime || 80;
    const life = id => 0.75 / (0.00042 * COMPOUNDS[id].wear * this.wearScale * 0.75 * lapT);
    const opts = ['S', 'M', 'H'];
    let pick = opts.find(id => life(id) >= remaining) || 'H';
    const dryUsed = [...c.usedCompounds].filter(x => x !== 'I' && x !== 'W');
    if (dryUsed.length === 1 && dryUsed[0] === pick && this.laps >= 5) pick = opts.find(id => id !== pick && life(id) >= remaining) || (pick === 'H' ? 'M' : 'H');
    return pick;
  }

  engineerAdvice(c, lapNow) {
    const remaining = this.laps - lapNow;
    const wet = this.weather.wet;
    const slick = c.tyre.c !== 'I' && c.tyre.c !== 'W';
    if (this.mode === 'race') {
      if (slick && wet > 0.3 && !c.pitRequest) this.radioMsg('eng', `Track is getting wet. Inters are the tyre. Box when ready.`);
      else if (!slick && wet < 0.15 && !c.pitRequest) this.radioMsg('eng', 'Track is drying. Slicks are faster now.');
      else if (c.tyre.wear > 0.62 && remaining > 1 && !c.pitRequest) this.radioMsg('eng', `Tyres at ${Math.round((1 - c.tyre.wear) * 100)} percent. Consider boxing this lap.`);
    } else {
      // pit wall: the driver talks to you
      if (c.tyre.wear > 0.65 && remaining > 1 && !c.pitRequest) this.radioMsg('drv', 'These tyres are going off. I am losing the rear.');
      else if (slick && wet > 0.25 && !c.pitRequest) this.radioMsg('drv', 'It is raining here! I have no grip on these slicks.');
      else if (!slick && wet < 0.15 && !c.pitRequest) this.radioMsg('drv', 'Track is drying, these tyres are overheating.');
      else if (c.damage > 0.25) this.radioMsg('drv', 'I have damage, the car is understeering.');
    }
  }

  // ---------------- weather ----------------
  updateWeather(dt) {
    const W = this.weather;
    if (W.plan.length && this.cfg.weather === 'changeable') {
      const t = this.raceTime;
      let target = 0;
      for (const p of W.plan) if (t >= p.t) target = p.rain;
      const before = W.rain;
      W.rain += (target - W.rain) * Math.min(1, dt * 0.08);
      if (before < 0.05 && W.rain >= 0.05) { this.rc('Rain reported at ' + (this.T.corners[Math.floor(this.T.corners.length / 2)]?.name || 'the circuit'), 'info'); this.events.push({ type: 'rain' }); }
      // radar forecast
      const next = W.plan.find(p => p.t > t && p.rain > 0.3);
      W.forecast = next ? Math.max(0, next.t - t) : null;
      const before2 = this.rainWarned;
      if (next && next.t - t < 120 && !before2) { this.rainWarned = true; if (!this.solo) this.radioMsg('eng', `Rain expected in about ${Math.max(1, Math.round((next.t - t) / 60))} minute${(next.t - t) > 90 ? 's' : ''}.`); }
    }
    const dry = (1 - W.rain) * 0.0045 * (W.rain < 0.1 ? 1 : 0.3);
    W.wet = Math.max(0, Math.min(1, W.wet + (W.rain * 0.014 - dry) * dt));
  }

  // ---------------- incidents & safety car ----------------
  incidents(dt) {
    if (this.phase !== 'racing' || this.incidentRate === 0) return;
    const lapsT = (this.T.circ.refLapTime || 80);
    for (const c of this.cars) {
      if (c.isPlayer || c.retired || c.finished || c.pit) continue;
      if (this.raceTime < 8) continue;
      const p = 0.0045 * this.incidentRate * (1 + this.weather.wet * 3 + (c.damage || 0) * 4) / lapsT;
      if (Math.random() < p * dt) this.retire(c, Math.random() < 0.5 ? 'spin' : 'mechanical');
    }
  }

  retire(c, why) {
    if (c.retired) return;
    c.retired = true; c.retireReason = why; c.pit = null;
    const corner = this.cornerAt(c.s);
    const where = corner ? corner.name : 'on track';
    this.rc(`Car ${c.driver?.num ?? ''} (${c.code}) stopped ${corner ? 'at ' + where : where}`, 'yellow');
    this.events.push({ type: 'incident', code: c.code });
    if (this.sc || this.vsc) return;
    const leaderLap = Math.floor(Math.max(...this.cars.map(x => x.dist)) / this.T.L) + 1;
    if (leaderLap >= this.laps) return;
    if (Math.random() < 0.55) this.deploySC(); else this.deployVSC();
  }

  deploySC() {
    const leader = this.cars.filter(c => !c.retired).sort((a, b) => b.dist - a.dist)[0];
    this.sc = true; this.scEnding = false;
    this.scCar = { dist: leader.dist + 140, s: this.T.wrap(leader.s + 140), d: 0, v: 40, isSC: true, code: 'SC' };
    this.scEndLap = Math.floor(leader.dist / this.T.L) + 2 + (Math.random() < 0.5 ? 1 : 0);
    this.rc('SAFETY CAR DEPLOYED', 'sc'); this.banner('SAFETY CAR', 'No overtaking', 'sc');
    this.radioMsg('eng', 'Safety car, safety car. Stay above the delta, no overtaking.');
    this.events.push({ type: 'sc' });
  }
  deployVSC() {
    this.vsc = true; this.vscEnd = this.raceTime + 25 + Math.random() * 20;
    this.rc('VIRTUAL SAFETY CAR DEPLOYED', 'sc'); this.banner('VIRTUAL SAFETY CAR', 'Keep to the delta', 'sc');
    this.radioMsg('eng', 'VSC, VSC. Slow down and keep to the delta.');
    this.events.push({ type: 'sc' });
  }

  updateSafetyCar(dt) {
    const T = this.T, sc = this.scCar;
    const vt = T.lerpArr(T.profile, sc.s) * 0.5;
    sc.v += (vt - sc.v) * Math.min(1, dt * 1.5);
    sc.s = T.wrap(sc.s + sc.v * dt); sc.dist += sc.v * dt;
    sc.d += (T.lerpArr(T.line, sc.s) * 0.6 - sc.d) * Math.min(1, dt);
    const leader = this.cars.filter(c => !c.retired && !c.pit).sort((a, b) => b.dist - a.dist)[0];
    if (!leader) return;
    const leaderLap = Math.floor(leader.dist / T.L) + 1;
    if (!this.scEnding && leaderLap >= this.scEndLap) {
      this.scEnding = true; this.rc('SAFETY CAR IN THIS LAP', 'sc'); this.radioMsg('eng', 'Safety car in this lap. Get ready for the restart.');
    }
    const rel = sc.s > T.L / 2 ? sc.s - T.L : sc.s;
    if (this.scEnding && rel > T.pit.sIn && rel < T.pit.sIn + 40) {
      this.scCar = null; this.scRestartLapDist = Math.ceil(leader.dist / T.L) * T.L;
    }
  }

  raceControl(dt) {
    if (this.vsc && this.raceTime >= this.vscEnd) {
      this.vsc = false; this.rc('VSC ENDING. Track clear.', 'green'); this.banner('GREEN FLAG', 'Racing resumes', 'green'); this.events.push({ type: 'green' });
      this.radioMsg('eng', 'VSC ending. Go, go, go!');
    }
    if (this.sc && !this.scCar) {
      const leader = this.cars.filter(c => !c.retired).sort((a, b) => b.dist - a.dist)[0];
      if (leader.dist >= this.scRestartLapDist) {
        this.sc = false; this.rc('GREEN FLAG. Racing resumes.', 'green'); this.banner('GREEN FLAG', 'Racing resumes', 'green'); this.events.push({ type: 'green' });
      }
    }
  }

  // ---------------- positions & info ----------------
  commentate() {
    if (!this.standings || this.solo || this.phase !== 'racing') return;
    if (this.time - (this.lastComm || 0) < 0.5) return;
    this.lastComm = this.time;
    const prev = this.prevPos || new Map();
    for (const c of this.standings) {
      const was = prev.get(c);
      if (was && c.pos < was && !c.pit && !c.retired && !c.finished) {
        const passed = this.standings[c.pos]; // the car now right behind
        if (passed && !passed.pit && !passed.retired && prev.get(passed) === c.pos) {
          const p = c.pos;
          const lines = p === 1 ? [`${c.code} takes the lead from ${passed.code}!`, `Into the lead goes ${c.code}!`] : p <= 3 ? [`${c.code} passes ${passed.code} for P${p}, onto the podium places`, `Great move by ${c.code} on ${passed.code} for P${p}`] : [`${c.code} gets by ${passed.code} for P${p}`, `${c.code} up to P${p}, past ${passed.code}`];
          this.commentary.unshift({ text: lines[Math.floor(Math.random() * lines.length)], t: this.time, pos: p, codes: [c.code, passed.code] });
          this.events.push({ type: 'pass', who: c, passed, pos: p });
        }
      }
    }
    this.prevPos = new Map(this.standings.map(c => [c, c.pos]));
    if (this.commentary.length > 40) this.commentary.length = 40;
  }

  updatePositions() {
    const fin = this.finishedOrder;
    const rest = this.cars.filter(c => !fin.includes(c)).sort((a, b) => (a.retired - b.retired) || (b.dist - a.dist));
    this.standings = fin.concat(rest);
    this.standings.forEach((c, i) => c.pos = i + 1);
    // gaps
    const leader = this.standings[0];
    for (let i = 0; i < this.standings.length; i++) {
      const c = this.standings[i];
      if (c.retired) { c.gapText = 'OUT'; c.intText = 'OUT'; c.gap = 1e9; c.interval = 1e9; continue; }
      const j = c.cpIdx - 1;
      if (i === 0) { c.gap = 0; c.interval = 0; c.gapText = this.solo ? '' : 'LEADER'; c.intText = c.gapText; continue; }
      const lapsDown = Math.floor((leader.cpIdx - c.cpIdx) / CP);
      const lt = leader.cp[j];
      c.gap = lt !== undefined && j >= 0 ? Math.max(0, c.cp[j] - lt) : 0;
      const prev = this.standings[i - 1];
      const pt = prev.cp[j];
      c.interval = pt !== undefined && j >= 0 ? Math.max(0, c.cp[j] - pt) : 0;
      c.gapText = lapsDown >= 1 && !leader.finished ? `+${lapsDown} LAP${lapsDown > 1 ? 'S' : ''}` : '+' + c.gap.toFixed(1);
      c.intText = '+' + c.interval.toFixed(1);
    }
  }

  // ---------------- messages ----------------
  rc(text, kind) { this.control.unshift({ text, kind, t: this.time }); if (this.control.length > 30) this.control.pop(); }
  radioMsg(from, text) {
    const last = this.radio[0];
    if (last && last.text === text && this.time - last.t < 20) return;
    this.radio.unshift({ from, text, t: this.time, shown: false }); if (this.radio.length > 40) this.radio.pop();
  }
  banner(title, sub, kind) { this.banners.push({ title, sub, kind, t: this.time }); }

  results() {
    const T = this.T;
    const rows = this.standings.map(c => {
      const total = c.finished ? c.finishTime + (c.penalty || 0) : null;
      return { car: c, code: c.code, name: c.name || c.driver?.name, team: c.team.name, color: c.team.color, laps: c.lapTimes.length, total, best: c.best, stops: c.stops || 0, pen: c.penalty || 0, retired: c.retired, grid: c.grid };
    });
    const p = this.player;
    const rule = this.mode === 'race' && this.laps >= 5 && p.finished && p.usedCompounds.size < 2 && ![...p.usedCompounds].some(x => x === 'I' || x === 'W');
    if (rule) { const r = rows.find(r => r.car === p); if (r) { r.total += 30; r.pen += 30; r.note = 'Tyre rule: did not use two dry compounds (+30s)'; } }
    // penalties can change finishing order among finishers on the same lap count
    const effLaps = r => (!r.car.finished && !r.car.retired && this.leaderFinished && r.car.gap < 60) ? r.laps + 1 : r.laps;
    const effT = r => r.total ?? (r.car.gap != null ? 1e6 + r.car.gap : 1e9);
    rows.sort((a, b) => (a.retired - b.retired) || (effLaps(b) - effLaps(a)) || (effT(a) - effT(b)));
    const lead = rows[0];
    rows.forEach((r, i) => {
      r.pos = i + 1;
      const c = r.car;
      // still on the final lap: estimate the gap from the last timing point
      const running = !c.finished && !c.retired && this.leaderFinished && r.laps === lead.laps - 1 && c.gap < 60;
      r.gap = i === 0 ? fmtRace(r.total) : r.retired ? 'DNF' : running ? '+' + (c.gap + (c.penalty || 0)).toFixed(1) + ' (running)' : r.laps < lead.laps ? `+${lead.laps - r.laps} lap${lead.laps - r.laps > 1 ? 's' : ''}` : r.total != null ? '+' + (r.total - lead.total).toFixed(3) : '—';
    });
    return rows;
  }
}

function require_teamIndex(id) { return TEAMS.findIndex(t => t.id === id); }

export function fmt(t) {
  if (!isFinite(t)) return '--:--.---';
  const m = Math.floor(t / 60), s = t - m * 60;
  return `${m}:${s.toFixed(3).padStart(6, '0')}`;
}
export function fmtRace(t) {
  if (t == null) return '';
  const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
  return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + s.toFixed(3).padStart(6, '0');
}
export { CP };
