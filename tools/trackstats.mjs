// node tools/trackstats.mjs -> length, corners, speeds, ideal lap, elevation per circuit
import { CIRCUITS } from '../src/circuits.js';
import { buildTrack } from '../src/track.js';
for (const c of CIRCUITS) {
  const T = buildTrack(c);
  let vmax = 0, vmin = 1e9; for (let i = 0; i < T.N; i++) { vmax = Math.max(vmax, T.profile[i]); vmin = Math.min(vmin, T.profile[i]); }
  let gmax = 0; for (let i = 0; i < T.N; i++) gmax = Math.max(gmax, Math.abs(T.grade[i]));
  const br = T.hasBridge ? T.bridge.reduce((a, b) => a + b, 0) * T.ds : 0;
  console.log(`${c.id.padEnd(9)} L=${(T.L / 1000).toFixed(3)} turns=${String(T.corners.length).padStart(2)} zones=${T.zones.length} vmax=${(vmax * 3.6).toFixed(0)} vmin=${(vmin * 3.6).toFixed(0)} ideal=${T.idealLap.toFixed(1)}s ref=${c.refLapTime} elev=${T.elevRange.toFixed(0)}m grade=${(gmax * 100).toFixed(0)}% pit=${(T.pit.sIn).toFixed(0)}..${T.pit.sOut.toFixed(0)} bridge=${br.toFixed(0)}m`);
  if (process.argv[2] === c.id) for (const k of T.corners) console.log('   ', k.name.padEnd(24), (k.sStart).toFixed(0), (T.profile[k.apex % T.N] * 3.6).toFixed(0) + ' km/h', k.dir > 0 ? 'L' : 'R');
}
