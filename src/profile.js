// Driver profile: XP, levels, stats, helmet design, medals and the championship save.
import { store } from './util.js';

export const PATTERNS = [
  { id: 'solid', name: 'Solid', level: 1 },
  { id: 'stripe', name: 'Racing stripe', level: 1 },
  { id: 'halves', name: 'Halves', level: 2 },
  { id: 'chevron', name: 'Chevron', level: 3 },
  { id: 'stars', name: 'Stars', level: 4 },
  { id: 'flames', name: 'Flames', level: 5 },
  { id: 'checker', name: 'Checkered', level: 6 },
  { id: 'lightning', name: 'Lightning', level: 8 },
];

const DEFAULT = {
  xp: 0,
  stats: { races: 0, wins: 0, podiums: 0, poles: 0, fastestLaps: 0, dnfs: 0, bestFinish: null, stops: 0, bestStop: null, scenarios: 0, predictions: 0 },
  helmet: { base: '#e10600', second: '#ffffff', third: '#111111', pattern: 'stripe' },
  medals: {},          // scenario id -> 'gold' | 'silver' | 'bronze'
  bests: {},           // circuit id -> best lap (s)
  history: [],         // recent results
  champ: null,         // active championship save
  titles: 0,
};

export const profile = Object.assign({}, structuredClone(DEFAULT), store.get('profile', {}));
profile.stats = Object.assign({}, DEFAULT.stats, profile.stats || {});
profile.helmet = Object.assign({}, DEFAULT.helmet, profile.helmet || {});
export const saveProfile = () => store.set('profile', profile);

// level n needs 150 * n * (n - 1) XP in total: 0, 300, 900, 1800, 3000...
export function levelInfo(xp = profile.xp) {
  let n = 1; while (150 * (n + 1) * n <= xp) n++;
  const cur = 150 * n * (n - 1), next = 150 * (n + 1) * n;
  return { level: n, cur, next, into: xp - cur, need: next - cur, pct: (xp - cur) / (next - cur) };
}
export const isUnlocked = p => levelInfo().level >= (PATTERNS.find(x => x.id === p)?.level || 1);

// returns { xp, lines, levelUp, unlocked }
export function award(lines) {
  const before = levelInfo().level;
  const xp = lines.reduce((a, l) => a + l[1], 0);
  profile.xp += Math.max(0, Math.round(xp));
  const after = levelInfo().level;
  const unlocked = PATTERNS.filter(p => p.level > before && p.level <= after).map(p => p.name);
  saveProfile();
  return { xp, lines, levelUp: after > before ? after : null, unlocked };
}

export function recordRace(r) {
  const s = profile.stats;
  s.races++;
  if (r.dnf) s.dnfs++;
  else {
    if (r.pos === 1) s.wins++;
    if (r.pos <= 3) s.podiums++;
    if (s.bestFinish == null || r.pos < s.bestFinish) s.bestFinish = r.pos;
  }
  if (r.fastest) s.fastestLaps++;
  s.stops += r.stops || 0;
  if (r.bestStop && (s.bestStop == null || r.bestStop < s.bestStop)) s.bestStop = r.bestStop;
  profile.history.unshift({ t: Date.now(), ...r }); profile.history = profile.history.slice(0, 20);
  saveProfile();
}

// ---------------- helmet texture ----------------
// Draws the helmet livery on an equirectangular canvas (wraps around the helmet sphere).
export function drawHelmet(ctx, w, h, d, num) {
  ctx.fillStyle = d.base; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = d.second;
  const p = d.pattern;
  if (p === 'stripe') { ctx.fillRect(0, h * 0.18, w, h * 0.12); ctx.fillStyle = d.third; ctx.fillRect(0, h * 0.3, w, h * 0.04); }
  if (p === 'halves') { ctx.fillRect(0, 0, w, h * 0.45); ctx.fillStyle = d.third; ctx.fillRect(0, h * 0.43, w, h * 0.05); }
  if (p === 'chevron') { for (let k = 0; k < 4; k++) { const x = (k / 4) * w; ctx.beginPath(); ctx.moveTo(x, h * 0.15); ctx.lineTo(x + w / 8, h * 0.4); ctx.lineTo(x + w / 4, h * 0.15); ctx.lineTo(x + w / 4, h * 0.27); ctx.lineTo(x + w / 8, h * 0.52); ctx.lineTo(x, h * 0.27); ctx.closePath(); ctx.fill(); } }
  if (p === 'stars') { for (let k = 0; k < 14; k++) star(ctx, (k * 0.0731 % 1) * w, h * (0.12 + (k * 0.37 % 1) * 0.5), 7 + (k % 3) * 4); ctx.fillStyle = d.third; ctx.fillRect(0, h * 0.62, w, h * 0.05); }
  if (p === 'flames') { ctx.fillStyle = d.second; for (let k = 0; k < 10; k++) { const x = (k / 10) * w; ctx.beginPath(); ctx.moveTo(x, h * 0.75); ctx.quadraticCurveTo(x + w * 0.02, h * 0.45, x + w * 0.05, h * 0.25); ctx.quadraticCurveTo(x + w * 0.06, h * 0.5, x + w * 0.1, h * 0.75); ctx.fill(); } ctx.fillStyle = d.third; for (let k = 0; k < 10; k++) { const x = (k / 10) * w + w * 0.02; ctx.beginPath(); ctx.moveTo(x, h * 0.75); ctx.quadraticCurveTo(x + w * 0.015, h * 0.55, x + w * 0.03, h * 0.42); ctx.quadraticCurveTo(x + w * 0.04, h * 0.6, x + w * 0.06, h * 0.75); ctx.fill(); } }
  if (p === 'checker') { const s = w / 32; for (let y = 0; y < 3; y++) for (let x = 0; x < 32; x++) if ((x + y) % 2) ctx.fillRect(x * s, h * 0.16 + y * s, s, s); ctx.fillStyle = d.third; ctx.fillRect(0, h * 0.16 + 3 * s, w, h * 0.03); }
  if (p === 'lightning') { ctx.lineWidth = h * 0.05; ctx.strokeStyle = d.second; ctx.beginPath(); for (let x = 0; x <= w; x += w / 16) ctx.lineTo(x, h * ((x / (w / 16)) % 2 ? 0.2 : 0.38)); ctx.stroke(); ctx.lineWidth = h * 0.02; ctx.strokeStyle = d.third; ctx.beginPath(); for (let x = 0; x <= w; x += w / 16) ctx.lineTo(x, h * ((x / (w / 16)) % 2 ? 0.27 : 0.45)); ctx.stroke(); }
  // chin band and number on both sides
  ctx.fillStyle = d.third; ctx.fillRect(0, h * 0.86, w, h * 0.14);
  if (num != null) {
    ctx.fillStyle = d.second; ctx.font = `900 ${Math.round(h * 0.2)}px Arial`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.strokeStyle = d.third; ctx.lineWidth = 3;
    for (const x of [w * 0.25, w * 0.75]) { ctx.strokeText(String(num), x, h * 0.7); ctx.fillText(String(num), x, h * 0.7); }
  }
}
function star(ctx, x, y, r) { ctx.beginPath(); for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2 - Math.PI / 2; const rr = i % 2 ? r * 0.45 : r; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } ctx.closePath(); ctx.fill(); }

// A side-on helmet preview as an SVG-clipped canvas for the menu
export function helmetPreview(canvas, d, num) {
  const ctx = canvas.getContext('2d'); const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  ctx.save();
  ctx.beginPath();
  // helmet silhouette
  ctx.moveTo(W * 0.12, H * 0.62); ctx.bezierCurveTo(W * 0.1, H * 0.15, W * 0.5, H * 0.02, W * 0.75, H * 0.12);
  ctx.bezierCurveTo(W * 0.95, H * 0.22, W * 0.98, H * 0.55, W * 0.92, H * 0.78); ctx.lineTo(W * 0.55, H * 0.92); ctx.lineTo(W * 0.2, H * 0.88); ctx.closePath();
  ctx.clip();
  const tex = document.createElement('canvas'); tex.width = 512; tex.height = 256;
  drawHelmet(tex.getContext('2d'), 512, 256, d, num);
  ctx.drawImage(tex, 0, 0, 256, 256, -W * 0.05, -H * 0.05, W * 1.1, H * 1.1);
  // shading
  const gr = ctx.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, 'rgba(255,255,255,0.25)'); gr.addColorStop(0.5, 'rgba(255,255,255,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.35)');
  ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H);
  ctx.restore();
  // visor
  ctx.fillStyle = '#0d1220'; ctx.beginPath(); ctx.moveTo(W * 0.5, H * 0.38); ctx.bezierCurveTo(W * 0.7, H * 0.3, W * 0.9, H * 0.33, W * 0.94, H * 0.45); ctx.lineTo(W * 0.92, H * 0.58); ctx.bezierCurveTo(W * 0.8, H * 0.6, W * 0.62, H * 0.6, W * 0.5, H * 0.56); ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(120,180,255,0.25)'; ctx.fillRect(W * 0.6, H * 0.38, W * 0.25, H * 0.04);
}
