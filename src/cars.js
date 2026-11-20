// Low-poly 2026-style single-seater built from primitives. Forward = +X, left = -Z, up = +Y.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { COMPOUNDS } from './data.js';

const box = (lx, ly, lz, x, y, z) => new THREE.BoxGeometry(lx, ly, lz).translate(x, y, z);
const sharedGeo = {};
function geos() {
  if (sharedGeo.body) return sharedGeo;
  // painted body (team colour)
  const nose = new THREE.CylinderGeometry(0.13, 0.24, 1.6, 8).rotateZ(Math.PI / 2).scale(1, 0.85, 1.25).translate(2.15, 0.36, 0);
  sharedGeo.body = mergeGeometries([
    box(1.25, 0.5, 0.78, -0.08, 0.47, 0),           // cockpit surround
    box(0.95, 0.36, 0.6, 1.02, 0.44, 0),            // front chassis (lower, so the driver sees the road)
    nose,
    box(1.7, 0.42, 0.46, -0.15, 0.38, 0.56),         // sidepods
    box(1.7, 0.42, 0.46, -0.15, 0.38, -0.56),
    box(1.6, 0.42, 0.42, -1.25, 0.62, 0).scale(1, 1, 1), // engine cover
    box(0.9, 0.5, 0.06, -1.3, 0.98, 0),              // fin
  ].map(g => g.toNonIndexed()));
  // carbon parts
  sharedGeo.carbon = mergeGeometries([
    box(4.9, 0.05, 1.5, -0.1, 0.06, 0),               // floor
    box(0.45, 0.04, 1.95, 2.85, 0.12, 0),            // front wing main
    box(0.5, 0.25, 0.03, 2.85, 0.2, 0.97), box(0.5, 0.25, 0.03, 2.85, 0.2, -0.97),
    box(0.36, 0.05, 1.0, -2.5, 0.92, 0),             // rear wing main
    box(0.62, 0.62, 0.03, -2.5, 0.78, 0.52), box(0.62, 0.62, 0.03, -2.5, 0.78, -0.52),
    box(0.25, 0.4, 0.06, -2.35, 0.55, 0),            // pylon
    box(0.6, 0.18, 1.0, -2.25, 0.16, 0),             // diffuser
    box(0.34, 0.32, 0.34, -0.25, 0.92, 0),           // airbox
    box(0.06, 0.05, 1.05, 1.75, 0.38, 0), box(0.06, 0.05, 1.05, -1.75, 0.38, 0), // suspension arms
    box(0.1, 0.07, 0.18, 0.55, 0.78, 0.5), box(0.1, 0.07, 0.18, 0.55, 0.78, -0.5), // mirrors
  ].map(g => g.toNonIndexed()));
  // halo
  const hoop = new THREE.TorusGeometry(0.34, 0.022, 6, 18, Math.PI).rotateX(Math.PI / 2).rotateY(Math.PI / 2).translate(0.28, 1.07, 0);
  const pillar = new THREE.CylinderGeometry(0.016, 0.022, 0.48, 6).rotateZ(-0.8).translate(0.78, 0.89, 0);
  const sideL = new THREE.CylinderGeometry(0.022, 0.022, 0.42, 6).translate(0.28, 0.86, 0.34);
  const sideR = new THREE.CylinderGeometry(0.022, 0.022, 0.42, 6).translate(0.28, 0.86, -0.34);
  sharedGeo.halo = mergeGeometries([hoop, pillar, sideL, sideR].map(g => g.toNonIndexed()));
  sharedGeo.tyre = new THREE.CylinderGeometry(0.36, 0.36, 0.38, 18).rotateX(Math.PI / 2);
  sharedGeo.rim = new THREE.CylinderGeometry(0.235, 0.235, 0.39, 12).rotateX(Math.PI / 2);
  sharedGeo.stripe = new THREE.TorusGeometry(0.29, 0.018, 4, 20);
  sharedGeo.helmet = new THREE.SphereGeometry(0.15, 12, 10).translate(0.18, 0.86, 0);
  sharedGeo.visor = new THREE.BoxGeometry(0.06, 0.06, 0.2).translate(0.32, 0.88, 0);
  sharedGeo.flap = box(0.26, 0.05, 0.98, 0, 0, 0);
  sharedGeo.fwing = box(0.12, 0.05, 0.92, 0, 0, 0);
  sharedGeo.light = box(0.04, 0.08, 0.14, -2.72, 0.55, 0);
  return sharedGeo;
}

const mats = {};
function mat(key, make) { return mats[key] || (mats[key] = make()); }

export function makeCar(team, opts = {}) {
  const G = geos();
  const root = new THREE.Group();
  const bodyMat = mat('body' + team.color, () => new THREE.MeshStandardMaterial({ color: team.color, roughness: 0.35, metalness: 0.35 }));
  const carbon = mat('carbon', () => new THREE.MeshStandardMaterial({ color: 0x15161a, roughness: 0.55, metalness: 0.3 }));
  const accent = opts.helmetTex ? new THREE.MeshStandardMaterial({ map: opts.helmetTex, roughness: 0.3, metalness: 0.2 }) : mat('acc' + team.accent, () => new THREE.MeshStandardMaterial({ color: team.accent, roughness: 0.4, metalness: 0.2 }));
  const tyreMat = mat('tyre', () => new THREE.MeshStandardMaterial({ color: 0x18181a, roughness: 0.9 }));
  const rimMat = mat('rim', () => new THREE.MeshStandardMaterial({ color: 0x2a2c30, roughness: 0.4, metalness: 0.7 }));

  const body = new THREE.Mesh(G.body, bodyMat); root.add(body);
  const carb = new THREE.Mesh(G.carbon, carbon); root.add(carb);
  const halo = new THREE.Mesh(G.halo, carbon); root.add(halo);
  const helmet = new THREE.Mesh(G.helmet, accent); root.add(helmet);
  const visor = new THREE.Mesh(G.visor, carbon); root.add(visor);
  const flap = new THREE.Mesh(G.flap, bodyMat); flap.position.set(-2.55, 1.06, 0); root.add(flap);
  // front wing upper flaps (separate so damage can show)
  const fwL = new THREE.Mesh(G.fwing, bodyMat); fwL.position.set(2.88, 0.2, 0.48); root.add(fwL);
  const fwR = new THREE.Mesh(G.fwing, bodyMat); fwR.position.set(2.88, 0.2, -0.48); root.add(fwR);
  const lightMat = new THREE.MeshBasicMaterial({ color: 0x330000 });
  const light = new THREE.Mesh(G.light, lightMat); root.add(light);

  const wheels = [];
  const stripeMats = {};
  for (const [x, z, front] of [[1.75, 0.8, true], [1.75, -0.8, true], [-1.75, 0.8, false], [-1.75, -0.8, false]]) {
    const pivot = new THREE.Group(); pivot.position.set(x, 0.36, z);
    const spin = new THREE.Group(); pivot.add(spin);
    spin.add(new THREE.Mesh(G.tyre, tyreMat));
    spin.add(new THREE.Mesh(G.rim, rimMat));
    const st = new THREE.Mesh(G.stripe, null); st.position.z = Math.sign(z) * 0.192; spin.add(st);
    root.add(pivot);
    wheels.push({ pivot, spin, stripe: st, front });
  }
  const setCompound = c => {
    const col = COMPOUNDS[c]?.color || '#ffffff';
    const m = stripeMats[col] || (stripeMats[col] = new THREE.MeshBasicMaterial({ color: new THREE.Color(col) }));
    wheels.forEach(w => w.stripe.material = m);
  };
  setCompound('M');
  if (opts.shadows) root.traverse(o => { if (o.isMesh) o.castShadow = true; });
  root.rotation.order = 'YZX';
  let dmgShown = 0;
  const setDamage = d => {
    const lvl = d > 0.5 ? 2 : d > 0.2 ? 1 : 0;
    if (lvl === dmgShown) return; dmgShown = lvl;
    fwL.visible = lvl < 2; fwL.rotation.x = lvl ? 0 : 0;
    fwR.rotation.set(lvl ? 0.5 : 0, 0, lvl ? -0.25 : 0); fwR.position.y = lvl ? 0.09 : 0.2;
  };
  return { root, wheels, flap, helmet, visor, halo, body, light, lightMat, setCompound, setDamage, compound: 'M' };
}

export function makeSafetyCar() {
  const root = new THREE.Group();
  const silver = new THREE.MeshStandardMaterial({ color: 0xcfd3d8, roughness: 0.3, metalness: 0.7 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x111418, roughness: 0.1, metalness: 0.5 });
  root.add(new THREE.Mesh(box(4.6, 0.7, 1.95, 0, 0.6, 0), silver));
  root.add(new THREE.Mesh(box(2.2, 0.55, 1.7, -0.3, 1.2, 0), glass));
  const bar = new THREE.Mesh(box(0.3, 0.12, 1.2, -0.3, 1.55, 0), new THREE.MeshBasicMaterial({ color: 0xff9900 }));
  root.add(bar);
  const tyre = new THREE.MeshStandardMaterial({ color: 0x111111 });
  for (const [x, z] of [[1.45, 0.9], [1.45, -0.9], [-1.45, 0.9], [-1.45, -0.9]]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.28, 14).rotateX(Math.PI / 2), tyre); w.position.set(x, 0.34, z); root.add(w); }
  root.rotation.order = 'YZX';
  return { root, bar };
}
