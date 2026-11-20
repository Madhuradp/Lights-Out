// Synthesised sound: V6 hybrid engine, MGU-K whine, turbo, tyres, wind, kerbs,
// opponents passing (with Doppler and panning), crowd, rain, radio beeps.
export class Sound {
  constructor() { this.ctx = null; this.enabled = true; this.volume = 0.8; }

  start() {
    if (this.ctx) { this.ctx.resume?.(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    const ctx = this.ctx = new AC();
    const master = this.master = ctx.createGain(); master.gain.value = this.volume;
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4;
    master.connect(comp); comp.connect(ctx.destination);
    this.noiseBuf = this.makeNoise(2);

    // reverb for the tunnel
    this.verb = ctx.createConvolver(); this.verb.buffer = this.makeImpulse(1.6);
    this.verbGain = ctx.createGain(); this.verbGain.gain.value = 0; this.verb.connect(this.verbGain); this.verbGain.connect(master);

    // engine
    const eng = this.eng = {};
    eng.out = ctx.createGain(); eng.out.gain.value = 0; eng.out.connect(master); eng.out.connect(this.verb);
    eng.filter = ctx.createBiquadFilter(); eng.filter.type = 'lowpass'; eng.filter.frequency.value = 1500; eng.filter.Q.value = 1.4;
    eng.shaper = ctx.createWaveShaper(); eng.shaper.curve = this.distCurve(18);
    eng.shaper.connect(eng.filter); eng.filter.connect(eng.out);
    eng.o1 = this.osc('sawtooth', 200, 0.5, eng.shaper);
    eng.o2 = this.osc('sawtooth', 100, 0.35, eng.shaper);
    eng.o3 = this.osc('square', 400, 0.08, eng.shaper);
    eng.whine = this.osc('sine', 1500, 0, master);
    eng.turbo = this.osc('sine', 3000, 0, master);
    // noises
    this.wind = this.noise('lowpass', 900, 0, master);
    this.squeal = this.noise('bandpass', 1100, 0, master, 6);
    this.rumble = this.noise('lowpass', 120, 0, master);
    this.gravel = this.noise('bandpass', 500, 0, master, 0.8);
    this.rain = this.noise('highpass', 3500, 0, master);
    this.crowd = this.noise('bandpass', 650, 0, master, 0.6);
    // opponent voice
    const opp = this.opp = {};
    opp.pan = ctx.createStereoPanner(); opp.gain = ctx.createGain(); opp.gain.gain.value = 0;
    opp.filter = ctx.createBiquadFilter(); opp.filter.type = 'lowpass'; opp.filter.frequency.value = 2200;
    opp.shaper = ctx.createWaveShaper(); opp.shaper.curve = this.distCurve(10);
    opp.shaper.connect(opp.filter); opp.filter.connect(opp.gain); opp.gain.connect(opp.pan); opp.pan.connect(master); opp.gain.connect(this.verb);
    opp.o1 = this.osc('sawtooth', 300, 0.5, opp.shaper); opp.o2 = this.osc('sawtooth', 150, 0.3, opp.shaper);
    this.ready = true;
  }
  setVolume(v) { this.volume = v; if (this.master) this.master.gain.value = v; }

  osc(type, f, g, dest) {
    const o = this.ctx.createOscillator(); o.type = type; o.frequency.value = f;
    const gn = this.ctx.createGain(); gn.gain.value = g; o.connect(gn); gn.connect(dest); o.start();
    return { o, g: gn };
  }
  noise(type, f, g, dest, q = 1) {
    const src = this.ctx.createBufferSource(); src.buffer = this.noiseBuf; src.loop = true;
    const fl = this.ctx.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q;
    const gn = this.ctx.createGain(); gn.gain.value = g;
    src.connect(fl); fl.connect(gn); gn.connect(dest); src.start();
    return { src, f: fl, g: gn };
  }
  makeNoise(sec) {
    const b = this.ctx.createBuffer(1, this.ctx.sampleRate * sec, this.ctx.sampleRate);
    const d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; return b;
  }
  makeImpulse(sec) {
    const n = this.ctx.sampleRate * sec; const b = this.ctx.createBuffer(2, n, this.ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3); }
    return b;
  }
  distCurve(k) { const n = 1024, c = new Float32Array(n); for (let i = 0; i < n; i++) { const x = i * 2 / n - 1; c[i] = (1 + k) * x / (1 + k * Math.abs(x)); } return c; }
  set(param, v, t = 0.05) { param.setTargetAtTime(v, this.ctx.currentTime, t); }

  // called every frame
  update(st) {
    if (!this.ready || !this.enabled) return;
    const { rpm, throttle, v, ers, slip, kerb, grass, rain, inTunnel, crowd, opp, paused, onboard } = st;
    const on = paused ? 0 : 1;
    const sc = st.scale ?? 1;
    const f = rpm / 20; // V6 firing frequency
    const e = this.eng;
    this.set(e.o1.o.frequency, f, 0.02); this.set(e.o2.o.frequency, f / 2, 0.02); this.set(e.o3.o.frequency, f * 2, 0.02);
    this.set(e.filter.frequency, 500 + throttle * 3200 + rpm * 0.12, 0.04);
    const eg = (0.07 + 0.2 * throttle + 0.05 * (rpm / 12000)) * (onboard ? 1 : 0.75) * on * sc;
    this.set(e.out.gain, eg, 0.03);
    this.set(e.whine.o.frequency, 900 + v * 32, 0.05); this.set(e.whine.g.gain, 0.035 * ers * on * sc, 0.08);
    this.set(e.turbo.o.frequency, 2200 + rpm * 0.25, 0.08); this.set(e.turbo.g.gain, 0.006 * throttle * on, 0.1);
    this.set(this.wind.g.gain, Math.min(0.25, Math.pow(v / 90, 2) * 0.16) * on * (onboard ? 1 : 0.3), 0.1);
    this.set(this.wind.f.frequency, 400 + v * 12, 0.1);
    this.set(this.squeal.g.gain, Math.min(0.22, slip * 0.3) * on * sc, 0.04);
    this.set(this.squeal.f.frequency, 900 + v * 6, 0.1);
    this.set(this.rumble.g.gain, (kerb ? 0.55 : 0) * Math.min(1, v / 30) * on * sc, 0.02);
    this.set(this.gravel.g.gain, (grass ? 0.3 : 0) * Math.min(1, v / 20) * on, 0.05);
    this.set(this.rain.g.gain, rain * 0.09 * on, 0.3);
    this.set(this.crowd.g.gain, crowd * 0.12 * on, 0.4);
    this.set(this.verbGain.gain, inTunnel ? 0.9 : 0.0, 0.2);
    // nearest opponent
    const o = this.opp;
    if (opp && on) {
      const g = Math.min(0.35, 9 / Math.max(6, opp.dist)) * (0.4 + 0.6 * opp.throttle);
      const ofq = (opp.rpm / 20) * opp.doppler;
      this.set(o.o1.o.frequency, ofq, 0.03); this.set(o.o2.o.frequency, ofq / 2, 0.03);
      this.set(o.gain.gain, g, 0.05); this.set(o.pan.pan, Math.max(-1, Math.min(1, opp.pan)), 0.05);
    } else this.set(o.gain.gain, 0, 0.1);
  }

  blip(freq, dur, vol = 0.12, type = 'sine') {
    if (!this.ready) return; const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator(); o.type = type; o.frequency.value = freq;
    const g = this.ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + dur + 0.02);
  }
  burst(dur, vol, freq = 800) {
    if (!this.ready) return; const t = this.ctx.currentTime;
    const s = this.ctx.createBufferSource(); s.buffer = this.noiseBuf;
    const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq;
    const g = this.ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(this.master); s.start(t); s.stop(t + dur + 0.05);
  }
  radio() { this.blip(1350, 0.07, 0.08, 'square'); setTimeout(() => this.blip(1050, 0.08, 0.07, 'square'), 90); this.burst(0.25, 0.04, 3000); }
  shift() { this.burst(0.05, 0.12, 2400); }
  crash(p) { this.burst(0.5 + p * 0.4, 0.4 + p * 0.5, 900); this.blip(60, 0.4, 0.4 * p, 'sine'); }
  light() { this.blip(880, 0.12, 0.08); }
  heartbeat() { this.blip(55, 0.12, 0.25); setTimeout(() => this.blip(48, 0.12, 0.18), 160); }
  cheer() { if (!this.ready) return; this.set(this.crowd.g.gain, 0.3, 0.05); setTimeout(() => this.ready && this.set(this.crowd.g.gain, 0.05, 1.2), 1200); }
  pitGun() { this.burst(0.18, 0.35, 5000); this.blip(220, 0.15, 0.1, 'sawtooth'); }
}

// Haptics: phone vibration (Android browsers) and gamepad rumble (PC)
export class Haptics {
  constructor() { this.enabled = true; this.last = 0; this.pad = null; }
  can() { return 'vibrate' in navigator; }
  pulse(ms, strong = 0.6, weak = 0.3) {
    if (!this.enabled) return;
    const now = performance.now();
    try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) { }
    const pad = this.pad;
    try { if (pad && pad.vibrationActuator) pad.vibrationActuator.playEffect('dual-rumble', { duration: ms, strongMagnitude: strong, weakMagnitude: weak }); } catch (e) { }
    this.last = now;
  }
  pattern(p) { if (!this.enabled) return; try { if (navigator.vibrate) navigator.vibrate(p); } catch (e) { } if (this.pad?.vibrationActuator) try { this.pad.vibrationActuator.playEffect('dual-rumble', { duration: p.reduce((a, b) => a + b, 0), strongMagnitude: 0.7, weakMagnitude: 0.5 }); } catch (e) { } }
}
