import { CIRCUITS } from './data.js';
import { buildTrack } from './track.js';
import { Sound, Haptics } from './audio.js';
import { Input } from './input.js';
import { isTouch, store } from './util';

export const S = { renderer: null, scene: null, camera: null, G: null, session: null, backup: null };

export const DEFAULTS = {
  mode: 'race', circuit: 'parco', laps: 6, opponents: 11, difficulty: 'rookie', weather: 'dry', gridPos: 8, startTyre: 'M',
  team: 'aurora', name: 'You', code: 'YOU', num: 1, incidents: 'normal', pitGame: true, quality: 'auto', voice: true,
  assist: { brake: isTouch, line: 'brake', tc: true, abs: true, autoGear: true, autoThrottle: false, steer: false },
  camera: 'cockpit', volume: 0.8, haptics: true, quali: false, mirror: true, seasonLength: 'short', seasonLaps: 5, seasonQuali: true, seasonWeather: 'real',
  keys: {}, controls: { steerMode: 'pad', steerSens: 1, lefty: false, btnScale: 1 }, coach: true, halo: 'real', mirrorSize: 'large', muted: false, mix: { engine: 1, fx: 1, amb: 1, radio: 1 }, mapSize: 'large', mapNames: true,
};
export const cfg = Object.assign({}, DEFAULTS, store.get('cfg', {}));
cfg.assist = Object.assign({}, DEFAULTS.assist, cfg.assist || {});
cfg.controls = Object.assign({}, DEFAULTS.controls, cfg.controls || {});
cfg.mix = Object.assign({}, DEFAULTS.mix, cfg.mix || {});
// session overrides (championship rounds, scenarios...) are applied to cfg temporarily and never saved
export const saveCfg = () => store.set('cfg', S.backup ? Object.assign({}, cfg, S.backup) : cfg);
export const isSolo = () => cfg.mode === 'hotlap' || cfg.mode === 'quali';
export const isAI = () => cfg.mode === 'pitwall' || cfg.mode === 'grandstand';

export const sound = new Sound();
export const haptics = new Haptics();
export const input = new Input();
input.touchMode = isTouch;

// track models are cheap to build; cache them
export const trackCache = {};
export const getTrack = id => trackCache[id] || (trackCache[id] = buildTrack(CIRCUITS.find(c => c.id === id)));



