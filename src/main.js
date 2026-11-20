import { cfg, input, S } from './ctx';
import { renderMenu } from './menu';
import { playerControls, applyAssists, handleEvents } from './game';
import { updatePitGame } from './pitstop';

// ------------------------------------------------------------------ boot
renderMenu();
if ('speechSynthesis' in window) try { speechSynthesis.getVoices(); } catch (e) { }
window.__lo = {
  get G() { return S.G; }, cfg, input,
  // test hook: run the simulation quickly without rendering
  sim(sec, drive) {
    const g = S.G; const dt = 1 / 60;
    for (let i = 0; i < sec * 60; i++) {
      const d = typeof drive === 'function' ? drive(g) : (drive || { steer: 0, throttle: 0, brake: 0, boost: false });
      if (cfg.mode !== 'pitwall' && cfg.mode !== 'grandstand') playerControls(g, d, dt);
      g.race.update(dt, applyAssists(g, d)); handleEvents(g); updatePitGame(g, dt);
    }
  },
};

