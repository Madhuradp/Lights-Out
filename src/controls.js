// Controls: key bindings (remappable), labels for every device, and the "How to play" guide.
import { cfg, saveCfg } from './ctx';
import { isTouch } from './util';

// action -> default keys (KeyboardEvent.code)
export const ACTIONS = [
  ['throttle', 'Throttle', ['ArrowUp', 'KeyW'], 'drive'],
  ['brake', 'Brake', ['ArrowDown', 'KeyS'], 'drive'],
  ['left', 'Steer left', ['ArrowLeft', 'KeyA'], 'drive'],
  ['right', 'Steer right', ['ArrowRight', 'KeyD'], 'drive'],
  ['boost', 'Boost (hold)', ['Space', 'ShiftLeft'], 'energy'],
  ['ot', 'Overtake mode', ['KeyO', 'KeyF'], 'energy'],
  ['recharge', 'Recharge mode', ['KeyR'], 'energy'],
  ['shiftUp', 'Shift up (manual gears)', ['KeyE'], 'drive'],
  ['shiftDown', 'Shift down (manual gears)', ['KeyQ'], 'drive'],
  ['box', 'Box / pit request', ['KeyP', 'KeyB'], 'race'],
  ['page', 'Wheel display page', ['Tab'], 'race'],
  ['cam', 'Change camera', ['KeyC', 'KeyV'], 'view'],
  ['line', 'Racing line on/off', ['KeyL'], 'view'],
  ['help', 'Controls card', ['KeyH'], 'view'],
  ['mute', 'Mute', ['KeyM'], 'view'],
  ['pause', 'Pause', ['Escape'], 'view'],
];
export const HOLD = new Set(['throttle', 'brake', 'left', 'right', 'boost']);

export function bindings() {
  const out = {};
  for (const [a, , def] of ACTIONS) out[a] = (cfg.keys && cfg.keys[a]) || def;
  return out;
}
// code -> action lookup (first match wins)
export function codeMap() {
  const m = {}; const b = bindings();
  for (const [a] of ACTIONS) for (const c of b[a]) if (!(c in m)) m[c] = a;
  return m;
}

const KEYNAMES = { ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', Space: 'Space', ShiftLeft: 'L-Shift', ShiftRight: 'R-Shift', Escape: 'Esc', Enter: 'Enter', Tab: 'Tab', ControlLeft: 'L-Ctrl', ControlRight: 'R-Ctrl', AltLeft: 'Alt', Backspace: '⌫', BracketLeft: '[', BracketRight: ']', Comma: ',', Period: '.', Slash: '/', Semicolon: ';', Quote: "'" };
export const keyName = c => KEYNAMES[c] || c.replace(/^Key/, '').replace(/^Digit/, '').replace(/^Numpad/, 'Num ');

// gamepad (standard mapping) and touch labels
export const PAD = { throttle: 'RT', brake: 'LT', left: 'Left stick', right: 'Left stick', boost: 'A (hold)', ot: 'X', recharge: 'View / Back', shiftUp: 'RB', shiftDown: 'LB', box: 'B', page: 'D-pad →', cam: 'Y', line: 'D-pad ↓', help: 'D-pad ↑', mute: '-', pause: 'Menu / Start' };
export const TOUCH = { throttle: 'THROTTLE pedal', brake: 'BRAKE pedal', left: 'steer', right: 'steer', boost: 'BOOST (hold)', ot: 'OT', recharge: 'RECHG', shiftUp: '▲', shiftDown: '▼', box: 'BOX', page: 'tap the wheel screen', cam: 'CAM', line: 'LINE', help: '?', mute: '-', pause: 'II' };

// the label to show in tips for the device the player is using
export function label(action, device) {
  const d = device || currentDevice();
  if (d === 'pad') return PAD[action];
  if (d === 'touch') return TOUCH[action];
  const k = bindings()[action];
  return k && k.length ? keyName(k[0]) : '?';
}
let lastDevice = isTouch ? 'touch' : 'kb';
export const setDevice = d => { lastDevice = d; };
export const currentDevice = () => lastDevice;

// ---------------- guide ----------------
const TOOLS = [
  ['STRAIGHT MODE', '#3aa0ff', 'Active aero', 'On marked straights the front and rear wings open to cut drag when you are flat out. It happens automatically; brake or turn and they close again for grip. The lamp on the wheel shows when the wings are open.'],
  ['BOOST', '#ff8a00', 'Hold to deploy', 'Extra electric power from the battery, anywhere on the lap. Great for a straight or for defending, but it drains the blue battery bar fast.'],
  ['OVERTAKE', '#12e0ff', 'Push to pass', 'Within 1 second of the car ahead, the lamp lights up. Press it for extra energy and power at high speed for the lap: the 2026 replacement for DRS.'],
  ['RECHARGE', '#19d35a', 'Harvest energy', 'Charges the battery while you are flat out at the end of straights (super clipping), at the cost of a little top speed. Lifting off early before a corner (lift and coast) also harvests.'],
  ['BOX', '#ffcf00', 'Pit stop', 'Tells the team you are coming in at the end of the lap. The pit limiter comes on automatically in the pit lane; then you play the crew mini-game.'],
];
const FLAGS = [
  ['#ffd400', 'Yellow', 'Danger ahead: slow down, no overtaking.'],
  ['#3aa0ff', 'Blue', 'A faster car is lapping you: let it through.'],
  ['#19d35a', 'Green', 'Track clear: racing resumes.'],
  ['#ffd400', 'SC / VSC (flashing yellow)', 'Safety car: stay in line, keep the delta, no overtaking.'],
  ['#e10600', 'Red', 'Session stopped.'],
];
const TIPS = [
  'Brake in a straight line, then turn. Braking while steering locks the fronts.',
  'Slow in, fast out: a slightly early lift gives a better exit, and the exit decides your speed on the straight.',
  'Follow the racing line colours: red = brake, yellow = lift, green = throttle.',
  'Two wheels must stay inside the white lines. Three track-limit warnings means a penalty.',
  'Cold tyres (blue on the wheel) have less grip for the first lap out of the pits.',
  'In the rain, avoid painted lines and kerbs, and stay off the dry line\'s rubber. Inters are green, wets blue.',
  'Shift lights: green, red, then blue means shift now (manual gears).',
];

export function guideHTML(opts = {}) {
  const dev = opts.device || (isTouch ? 'touch' : 'kb');
  const tabs = [['kb', 'Keyboard'], ['pad', 'Gamepad'], ['touch', 'Touch']];
  return `<div class="guide">
    <div class="seg devtabs">${tabs.map(([k, l]) => `<button data-dev="${k}" class="${k === dev ? 'sel' : ''}">${l}</button>`).join('')}</div>
    <div class="gbody">${dev === 'kb' ? kbHTML(opts.compact) : dev === 'pad' ? padHTML() : touchHTML()}</div>
    ${opts.compact ? '' : `<h4>Your 2026 steering wheel</h4>
    <div class="tools">${TOOLS.map(([n, c, s, d]) => `<div class="tool"><span class="lamp" style="background:${c}">${n}</span><small>${s} · <b>${label(n === 'STRAIGHT MODE' ? 'throttle' : n === 'BOX' ? 'box' : n === 'OVERTAKE' ? 'ot' : n.toLowerCase(), dev)}</b></small><p>${d}</p></div>`).join('')}</div>
    <div class="wheelmap">
      <div><b>Shift lights</b> across the top: green, red, blue. Blue = change up now.</div>
      <div><b>Flag lights</b> either side of the screen repeat the marshals' flags (FIA marshalling system).</div>
      <div><b>Screen pages</b>: RACE (speed, gear, gap), ENERGY (battery, harvest and deploy this lap), TYRES (temperature and wear). Switch with <b>${label('page', dev)}</b>.</div>
      <div><b>Battery bar</b> on the left, <b>tyre squares</b> on the right: green OK, blue cold, yellow and red worn.</div>
    </div>
    <h4>Flags</h4><div class="flags">${FLAGS.map(([c, n, d]) => `<div><i style="background:${c}"></i><b>${n}</b> ${d}</div>`).join('')}</div>
    <h4>Driving like a pro</h4><ul class="tips">${TIPS.map(t => `<li>${t}</li>`).join('')}</ul>`}
  </div>`;
}

function kbHTML(compact) {
  const b = bindings();
  const groups = [['drive', 'Driving'], ['energy', 'Energy'], ['race', 'Race'], ['view', 'View']];
  return `<div class="keys">${groups.map(([gk, gl]) => `<div class="kgroup"><h5>${gl}</h5>${ACTIONS.filter(a => a[3] === gk).map(([a, l]) => `<div class="krow"><span>${l}</span><span>${b[a].map(c => `<kbd>${keyName(c)}</kbd>`).join(' ')}${compact ? '' : ` <button class="rebind" data-act="${a}">Change</button>`}</span></div>`).join('')}</div>`).join('')}</div>
    ${compact ? '' : '<div class="kfoot"><span id="rebindMsg">Click Change, then press the new key. Esc cancels.</span><button class="btn ghost sm" id="resetKeys">Reset to defaults</button></div>'}`;
}
function padHTML() {
  return `<div class="keys"><div class="kgroup"><h5>Any standard controller (Xbox, PlayStation, Switch Pro)</h5>${ACTIONS.filter(a => PAD[a[0]] !== '-' && a[0] !== 'right').map(([a, l]) => `<div class="krow"><span>${a === 'left' ? 'Steer' : l}</span><span><kbd>${PAD[a]}</kbd></span></div>`).join('')}</div>
    <div class="kgroup"><h5>Tips</h5><p class="mute">Triggers are analogue: squeeze gently on the throttle out of slow corners. Rumble shows lock-ups, kerbs and wheelspin. Plug in or press a button once for the browser to see the controller.</p></div></div>`;
}
function touchHTML() {
  const c = cfg.controls;
  return `<div class="keys"><div class="kgroup"><h5>Layout</h5>
      <div class="krow"><span>Steering</span><span>${c.steerMode === 'tilt' ? 'Tilt your phone like a wheel' : c.steerMode === 'buttons' ? '◀ ▶ buttons on the left' : 'Drag the left pad sideways'}</span></div>
      <div class="krow"><span>Throttle and brake</span><span>Pedals on the ${c.lefty ? 'left' : 'right'}</span></div>
      <div class="krow"><span>Boost</span><span>Hold BOOST</span></div>
      <div class="krow"><span>Overtake, Recharge, Box</span><span>OT · RECHG · BOX</span></div>
      <div class="krow"><span>Wheel page</span><span>Tap the wheel screen</span></div>
      <div class="krow"><span>Camera, line, pause</span><span>CAM · LINE · II (top right)</span></div></div>
    <div class="kgroup"><h5>Settings</h5>${touchSettingsHTML()}</div></div>`;
}
export function touchSettingsHTML() {
  const c = cfg.controls;
  const s = (k, opts) => `<div class="seg" data-ckey="${k}">${opts.map(([v, l]) => `<button data-v="${v}" class="${String(c[k]) === String(v) ? 'sel' : ''}">${l}</button>`).join('')}</div>`;
  return `<div class="opt"><label>Steering</label>${s('steerMode', [['pad', 'Drag pad'], ['tilt', 'Tilt'], ['buttons', 'Buttons']])}</div>
    <div class="opt"><label>Steering sensitivity <b>${c.steerSens.toFixed(1)}</b></label><input type="range" min="0.5" max="1.8" step="0.1" value="${c.steerSens}" data-crange="steerSens"></div>
    <div class="opt"><label>Pedals on</label>${s('lefty', [[false, 'Right'], [true, 'Left']])}</div>
    <div class="opt"><label>Button size</label>${s('btnScale', [[0.85, 'Small'], [1, 'Normal'], [1.2, 'Large']])}</div>
    <div class="opt"><label>Auto-throttle</label><div class="seg" data-key="autoThrottle" data-sub="assist">${[[true, 'On'], [false, 'Off']].map(([v, l]) => `<button data-v="${v}" class="${String(cfg.assist.autoThrottle) === String(v) ? 'sel' : ''}">${l}</button>`).join('')}</div></div>`;
}

// wire up a rendered guide (device tabs, rebinding, touch settings). rerender() redraws the host.
export function bindGuide(root, rerender) {
  root.querySelectorAll('[data-dev]').forEach(b => b.onclick = () => rerender(b.dataset.dev));
  root.querySelectorAll('.rebind').forEach(b => b.onclick = () => {
    const act = b.dataset.act; const msg = root.querySelector('#rebindMsg');
    if (msg) msg.textContent = `Press a key for "${ACTIONS.find(a => a[0] === act)[1]}"…`;
    b.textContent = '…';
    const h = e => {
      e.preventDefault(); e.stopPropagation(); window.removeEventListener('keydown', h, true);
      if (e.code !== 'Escape') {
        cfg.keys = cfg.keys || {};
        // a key does one job: remove it from other actions
        for (const [a, , def] of ACTIONS) { const cur = (cfg.keys[a] || def).filter(c => c !== e.code); if (a !== act && cur.length !== (cfg.keys[a] || def).length) cfg.keys[a] = cur; }
        cfg.keys[act] = [e.code];
        saveCfg();
      }
      rerender('kb');
    };
    window.addEventListener('keydown', h, true);
  });
  const rk = root.querySelector('#resetKeys'); if (rk) rk.onclick = () => { cfg.keys = {}; saveCfg(); rerender('kb'); };
  root.querySelectorAll('[data-ckey]').forEach(sg => sg.querySelectorAll('button').forEach(b => b.onclick = () => {
    let v = b.dataset.v; v = v === 'true' ? true : v === 'false' ? false : isNaN(+v) ? v : +v;
    cfg.controls[sg.dataset.ckey] = v; saveCfg(); rerender('touch');
  }));
  root.querySelectorAll('[data-crange]').forEach(r => r.oninput = () => { cfg.controls[r.dataset.crange] = +r.value; saveCfg(); const l = r.parentElement.querySelector('b'); if (l) l.textContent = (+r.value).toFixed(1); });
  root.querySelectorAll('.seg[data-sub]').forEach(sg => sg.querySelectorAll('button').forEach(b => b.onclick = () => { cfg[sg.dataset.sub][sg.dataset.key] = b.dataset.v === 'true'; saveCfg(); sg.querySelectorAll('button').forEach(x => x.classList.toggle('sel', x === b)); }));
}
