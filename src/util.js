import { COMPOUNDS } from './data.js';

// ------------------------------------------------------------------ utils
export const $ = (s, r = document) => r.querySelector(s);
export const html = (el, h) => { if (el && el._h !== h) { el.innerHTML = h; el._h = h; } };
export const txt = (el, t) => { if (el && el._t !== t) { el.textContent = t; el._t = t; } };
export const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
export const store = {
  get(k, d) { try { const v = localStorage.getItem('lo_' + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('lo_' + k, JSON.stringify(v)); } catch (e) { } },
};
export const hex = c => '#' + c.toString(16).padStart(6, '0');
export const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
export const wrapA = a => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
export const tyreBadge = (c, size) => `<span class="tbadge" style="border-color:${COMPOUNDS[c].color};color:${COMPOUNDS[c].color}${size ? ';width:' + size + 'px;height:' + size + 'px' : ''}">${c}</span>`;

