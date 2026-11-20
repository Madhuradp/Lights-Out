// Game data: fictional teams, drivers, circuits and tyre compounds.
// Everything here is original (no real F1 teams, drivers or circuit names).

export const TEAMS = [
  { id: 'aurora',   name: 'Aurora GP',          color: 0x10b9a8, accent: 0x0b2b33 },
  { id: 'falcon',   name: 'Crimson Falcon',     color: 0xd3132b, accent: 0x1a1a1a },
  { id: 'nightfall',name: 'Nightfall Racing',   color: 0x1b2a6b, accent: 0xe8c547 },
  { id: 'solaris',  name: 'Solaris Motorsport', color: 0xf5c400, accent: 0x111111 },
  { id: 'kestrel',  name: 'Kestrel Racing',     color: 0xff7a00, accent: 0x0e2a47 },
  { id: 'verdant',  name: 'Verdant F1 Team',    color: 0x1f8f45, accent: 0xf1f1f1 },
  { id: 'ion',      name: 'Ion Motorsport',     color: 0x2bb8f0, accent: 0xffffff },
  { id: 'monarch',  name: 'Monarch GP',         color: 0x6a2bd6, accent: 0xf0f0f0 },
  { id: 'titan',    name: 'Titan Engineering',  color: 0xb8c0c8, accent: 0x0a0a0a },
  { id: 'blaze',    name: 'Blaze Racing',       color: 0xff3d8b, accent: 0x1a0d1a },
];

// Two drivers per team, fictional.
export const DRIVERS = [
  { name: 'Mateo Arriaga',  code: 'ARR', team: 'aurora',    num: 7 },
  { name: 'Leon Brandt',    code: 'BRA', team: 'aurora',    num: 21 },
  { name: 'Rafael Quinto',  code: 'QUI', team: 'falcon',    num: 16 },
  { name: 'Sora Ikeda',     code: 'IKE', team: 'falcon',    num: 3 },
  { name: 'Arjun Mehra',    code: 'MEH', team: 'nightfall', num: 11 },
  { name: 'Felix Laurent',  code: 'LAU', team: 'nightfall', num: 28 },
  { name: 'Noah Kessler',   code: 'KES', team: 'solaris',   num: 5 },
  { name: 'Emil Varga',     code: 'VAR', team: 'solaris',   num: 19 },
  { name: 'Diego Montes',   code: 'MON', team: 'kestrel',   num: 9 },
  { name: 'Oliver Hart',    code: 'HAR', team: 'kestrel',   num: 44 },
  { name: 'Kabir Sethi',    code: 'SET', team: 'verdant',   num: 23 },
  { name: 'Lucas Moreau',   code: 'MOR', team: 'verdant',   num: 12 },
  { name: 'Yuki Tanabe',    code: 'TAN', team: 'ion',       num: 33 },
  { name: 'Henrik Dahl',    code: 'DAH', team: 'ion',       num: 8 },
  { name: 'Samuel Okafor',  code: 'OKA', team: 'monarch',   num: 14 },
  { name: 'Marco Bellini',  code: 'BEL', team: 'monarch',   num: 27 },
  { name: 'Theo Lindqvist', code: 'LIN', team: 'titan',     num: 2 },
  { name: 'Ravi Kapoor',    code: 'KAP', team: 'titan',     num: 31 },
  { name: 'Caio Ferreira',  code: 'FER', team: 'blaze',     num: 18 },
  { name: 'Jonas Weber',    code: 'WEB', team: 'blaze',     num: 6 },
];

export const COMPOUNDS = {
  S: { id: 'S', name: 'Soft',         color: '#e8202a', grip: 1.0,   wear: 1.75, warm: 1.0 },
  M: { id: 'M', name: 'Medium',       color: '#f5d000', grip: 0.975, wear: 1.0,  warm: 0.85 },
  H: { id: 'H', name: 'Hard',         color: '#eeeeee', grip: 0.955, wear: 0.6,  warm: 0.65 },
  I: { id: 'I', name: 'Intermediate', color: '#2bb04a', grip: 0.88,  wear: 1.1,  warm: 1.2 },
  W: { id: 'W', name: 'Wet',          color: '#1f6fe0', grip: 0.78,  wear: 1.0,  warm: 1.3 },
};

// Grip multiplier for a compound on a track with wetness w (0 dry .. 1 soaked).
export function weatherGrip(cid, w) {
  // intermediates and full wets: absolute grip relative to a dry slick
  if (cid === 'I') return 0.87 - 0.10 * Math.abs(w - 0.4) - (w > 0.75 ? 0.45 * (w - 0.75) : 0) - (w < 0.1 ? 0.04 : 0);
  if (cid === 'W') return 0.8 - 0.06 * Math.abs(w - 0.85) - (w < 0.3 ? 0.06 : 0);
  return 1 - 0.62 * w; // slicks
}

// Circuits live in circuits.js (real outlines + elevation + corner names).
export { CIRCUITS } from './circuits.js';

export const DIFFICULTY = {
  rookie: { name: 'Rookie', skill: 0.915 },
  pro:    { name: 'Pro',    skill: 0.955 },
  legend: { name: 'Legend', skill: 0.985 },
};

export const PUSH_LEVELS = {
  conserve: { name: 'Conserve', speed: 0.975, wear: 0.65 },
  balanced: { name: 'Balanced', speed: 1.0,   wear: 1.0 },
  push:     { name: 'Push',     speed: 1.012, wear: 1.35 },
  attack:   { name: 'Attack',   speed: 1.022, wear: 1.75 },
};

export const SPONSORS = ['VELOXA', 'NORTHWIND', 'QUANTA', 'PRISMA OIL', 'ZEPHYR', 'ORBITEL', 'HALCYON', 'TERRA BANK', 'LUMEN', 'APEX TIME', 'KAIROS', 'MERIDIAN'];
