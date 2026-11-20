// Unified input: keyboard (PC, remappable), gamepad (PC/console controllers), and touch (phones/tablets:
// drag pad, tilt or buttons).
import { codeMap, bindings, setDevice } from './controls.js';
export class Input {
  constructor() {
    this.keys = new Set();
    this.pressed = new Set();   // edge-triggered actions this frame
    this.touch = { steer: 0, throttle: 0, brake: 0, steerActive: false };
    this.steer = 0; this.throttle = 0; this.brake = 0;
    this.padIndex = null; this.padPrev = [];
    this.touchMode = false;
    this.settings = { autoThrottle: false, steerSens: 1.0, steerMode: 'pad' };
    this.tilt = null; // phone roll angle (degrees) when tilt steering is on
    window.addEventListener('keydown', e => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT')) return;
      if (!this.keys.has(e.code)) this.onKey(e.code);
      this.keys.add(e.code); setDevice('kb');
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Tab'].includes(e.code) && this.inGame) e.preventDefault();
    });
    window.addEventListener('keyup', e => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
    window.addEventListener('gamepadconnected', e => { this.padIndex = e.gamepad.index; });
  }
  onKey(code) {
    if (!this.map) this.map = codeMap();
    const a = this.map[code];
    if (a && !['throttle', 'brake', 'left', 'right'].includes(a)) this.pressed.add(a === 'boost' ? 'action' : a);
    if (code === 'Enter') this.pressed.add('action');
  }
  rebind() { this.map = codeMap(); this.bind = bindings(); }
  held(a) { if (!this.bind) this.bind = bindings(); for (const c of this.bind[a]) if (this.keys.has(c)) return true; return false; }
  // tilt steering: needs a user gesture on iOS
  async enableTilt() {
    try { if (typeof DeviceOrientationEvent !== 'undefined' && DeviceOrientationEvent.requestPermission) { const r = await DeviceOrientationEvent.requestPermission(); if (r !== 'granted') return false; } } catch (e) { return false; }
    if (!this._tiltOn) {
      this._tiltOn = true;
      window.addEventListener('deviceorientation', e => {
        if (e.beta == null) return;
        // landscape: the wheel-like roll is beta; flip with the screen orientation
        const ang = (screen.orientation && screen.orientation.angle) || window.orientation || 0;
        this.tilt = ang === 90 ? e.beta : ang === -90 || ang === 270 ? -e.beta : e.gamma;
      });
    }
    return true;
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
    const tb = this.touch;
    const left = this.held('left') || tb.left, right = this.held('right') || tb.right;
    const up = this.held('throttle'), down = this.held('brake');
    const kbSteer = (left ? 1 : 0) - (right ? 1 : 0);
    if (this.held('boost')) boost = true;
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
      if (Math.abs(st) > 0.01) { steerT = -Math.sign(st) * Math.pow(Math.abs(st), 1.4); setDevice('pad'); }
      const rt = p.buttons[7]?.value || 0, lt = p.buttons[6]?.value || 0;
      if (rt > 0.02) { thr = rt; setDevice('pad'); } if (lt > 0.02) brk = lt;
      const btn = i => p.buttons[i]?.pressed;
      const edge = (i, a) => { if (btn(i) && !this.padPrev[i]) this.pressed.add(a); };
      edge(0, 'action'); edge(2, 'ot'); edge(1, 'box'); edge(3, 'cam'); edge(9, 'pause'); edge(4, 'shiftDown'); edge(5, 'shiftUp'); edge(8, 'recharge'); edge(15, 'page'); edge(13, 'line'); edge(12, 'help');
      if (btn(0) && thr > 0) boost = true;
      this.padPrev = p.buttons.map(b => b.pressed);
    }

    // touch
    const t = this.touch;
    if (this.touchMode) {
      if (this.settings.steerMode === 'tilt' && this.tilt != null) {
        // 30 degrees of tilt = full lock at sensitivity 1
        const a = -this.tilt / 30 * this.settings.steerSens; const dz = 0.04;
        steerT = Math.abs(a) < dz ? 0 : Math.max(-1, Math.min(1, a - Math.sign(a) * dz));
      } else if (this.settings.steerMode !== 'buttons' && (t.steerActive || Math.abs(t.steer) > 0.001)) steerT = Math.max(-1, Math.min(1, t.steer * this.settings.steerSens));
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
