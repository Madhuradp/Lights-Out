// Unified input: keyboard (PC), gamepad (PC/console controllers), and touch (phones/tablets).
export class Input {
  constructor() {
    this.keys = new Set();
    this.pressed = new Set();   // edge-triggered actions this frame
    this.touch = { steer: 0, throttle: 0, brake: 0, steerActive: false };
    this.steer = 0; this.throttle = 0; this.brake = 0;
    this.padIndex = null; this.padPrev = [];
    this.touchMode = false;
    this.settings = { autoThrottle: false, steerSens: 1.0 };
    window.addEventListener('keydown', e => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT')) return;
      if (!this.keys.has(e.code)) this.onKey(e.code);
      this.keys.add(e.code);
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
    });
    window.addEventListener('keyup', e => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
    window.addEventListener('gamepadconnected', e => { this.padIndex = e.gamepad.index; });
  }
  onKey(code) {
    const map = { KeyO: 'ot', KeyF: 'ot', KeyR: 'recharge', KeyP: 'box', KeyB: 'box', KeyC: 'cam', KeyV: 'cam', Escape: 'pause', KeyQ: 'shiftDown', KeyE: 'shiftUp', Enter: 'action', Space: 'action', KeyM: 'mute', KeyL: 'line' };
    if (map[code]) this.pressed.add(map[code]);
  }
  press(a) { this.pressed.add(a); }
  consume(a) { if (this.pressed.has(a)) { this.pressed.delete(a); return true; } return false; }
  clearEdges() { this.pressed.clear(); }

  pad() {
    let pads = [];
    try { pads = navigator.getGamepads ? navigator.getGamepads() : []; } catch (e) { return null; }
    if (this.padIndex == null) for (const p of pads) if (p) { this.padIndex = p.index; break; }
    return this.padIndex != null ? pads[this.padIndex] : null;
  }

  // returns the per-frame driving input
  read(dt, v) {
    const k = this.keys;
    let steerT = 0, thr = 0, brk = 0, boost = false;
    const left = k.has('ArrowLeft') || k.has('KeyA'), right = k.has('ArrowRight') || k.has('KeyD');
    const up = k.has('ArrowUp') || k.has('KeyW'), down = k.has('ArrowDown') || k.has('KeyS');
    const kbSteer = (left ? 1 : 0) - (right ? 1 : 0);
    if (k.has('ShiftLeft') || k.has('ShiftRight') || k.has('Space')) boost = true;
    // keyboard steering ramps like a real wheel being turned
    if (kbSteer !== 0) { const rate = 2.6 + (Math.sign(kbSteer) !== Math.sign(this.steer) ? 4 : 0); this.steer += Math.sign(kbSteer - this.steer) * Math.min(Math.abs(kbSteer - this.steer), rate * dt); }
    else this.steer -= Math.sign(this.steer) * Math.min(Math.abs(this.steer), 5 * dt);
    steerT = this.steer;
    thr = up ? 1 : 0; brk = down ? 1 : 0;

    // gamepad
    const p = this.pad(); this.gamepad = p;
    if (p) {
      const ax = p.axes[0] || 0; const dz = 0.08;
      const st = Math.abs(ax) < dz ? 0 : (ax - Math.sign(ax) * dz) / (1 - dz);
      if (Math.abs(st) > 0.01) steerT = -Math.sign(st) * Math.pow(Math.abs(st), 1.4);
      const rt = p.buttons[7]?.value || 0, lt = p.buttons[6]?.value || 0;
      if (rt > 0.02) thr = rt; if (lt > 0.02) brk = lt;
      const btn = i => p.buttons[i]?.pressed;
      const edge = (i, a) => { if (btn(i) && !this.padPrev[i]) this.pressed.add(a); };
      edge(0, 'action'); edge(2, 'ot'); edge(1, 'box'); edge(3, 'cam'); edge(9, 'pause'); edge(4, 'shiftDown'); edge(5, 'shiftUp'); edge(8, 'recharge');
      if (btn(0) && thr > 0) boost = true;
      this.padPrev = p.buttons.map(b => b.pressed);
    }

    // touch
    const t = this.touch;
    if (this.touchMode) {
      if (t.steerActive || Math.abs(t.steer) > 0.001) steerT = t.steer * this.settings.steerSens;
      if (t.throttle > 0) thr = Math.max(thr, t.throttle);
      if (t.brake > 0) brk = Math.max(brk, t.brake);
      if (t.boost) boost = true;
      if (this.settings.autoThrottle && brk < 0.05) thr = Math.max(thr, 1);
    }
    // smooth pedals slightly
    this.throttle += (thr - this.throttle) * Math.min(1, dt * 14);
    this.brake += (brk - this.brake) * Math.min(1, dt * 20);
    return { steer: Math.max(-1, Math.min(1, steerT)), throttle: this.throttle, brake: this.brake, boost };
  }
}
