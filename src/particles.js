// Lightweight pooled particles: rain spray, tyre smoke, sparks and dust.
import * as THREE from 'three';

const VS = `attribute float size; attribute float alpha; attribute vec3 color; varying float vA; varying vec3 vC;
void main(){ vA = alpha; vC = color; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = size * (300.0 / -mv.z); gl_Position = projectionMatrix * mv; }`;
const FS = `varying float vA; varying vec3 vC; uniform float soft;
void main(){ vec2 p = gl_PointCoord - 0.5; float r = length(p); if (r > 0.5) discard; float a = vA * (soft > 0.5 ? smoothstep(0.5, 0.0, r) : 1.0); gl_FragColor = vec4(vC, a); }`;

class Pool {
  constructor(scene, max, soft, blending) {
    this.max = max; this.n = 0;
    this.pos = new Float32Array(max * 3); this.vel = new Float32Array(max * 3);
    this.size = new Float32Array(max); this.alpha = new Float32Array(max); this.col = new Float32Array(max * 3);
    this.life = new Float32Array(max); this.age = new Float32Array(max); this.grow = new Float32Array(max); this.a0 = new Float32Array(max);
    this.drag = new Float32Array(max); this.grav = new Float32Array(max);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('size', new THREE.BufferAttribute(this.size, 1));
    g.setAttribute('alpha', new THREE.BufferAttribute(this.alpha, 1));
    g.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    this.geo = g;
    const m = new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: FS, uniforms: { soft: { value: soft ? 1 : 0 } }, transparent: true, depthWrite: false, blending: blending || THREE.NormalBlending });
    this.points = new THREE.Points(g, m); this.points.frustumCulled = false; this.points.renderOrder = 3;
    scene.add(this.points);
  }
  emit(x, y, z, vx, vy, vz, size, grow, life, alpha, r, g, b, drag = 1.5, grav = 0) {
    let i = this.n < this.max ? this.n++ : Math.floor(Math.random() * this.max);
    const k = i * 3;
    this.pos[k] = x; this.pos[k + 1] = y; this.pos[k + 2] = z;
    this.vel[k] = vx; this.vel[k + 1] = vy; this.vel[k + 2] = vz;
    this.size[i] = size; this.grow[i] = grow; this.life[i] = life; this.age[i] = 0; this.a0[i] = alpha; this.alpha[i] = alpha;
    this.col[k] = r; this.col[k + 1] = g; this.col[k + 2] = b; this.drag[i] = drag; this.grav[i] = grav;
  }
  update(dt) {
    let n = this.n;
    for (let i = 0; i < n; i++) {
      this.age[i] += dt;
      if (this.age[i] >= this.life[i]) {
        // swap-remove
        n--; this.copy(n, i); i--; continue;
      }
      const k = i * 3, f = Math.exp(-this.drag[i] * dt);
      this.vel[k] *= f; this.vel[k + 1] = this.vel[k + 1] * f - this.grav[i] * dt; this.vel[k + 2] *= f;
      this.pos[k] += this.vel[k] * dt; this.pos[k + 1] += this.vel[k + 1] * dt; this.pos[k + 2] += this.vel[k + 2] * dt;
      this.size[i] += this.grow[i] * dt;
      const u = this.age[i] / this.life[i];
      this.alpha[i] = this.a0[i] * (1 - u) * Math.min(1, this.age[i] * 8);
    }
    this.n = n;
    this.geo.setDrawRange(0, n);
    for (const a of ['position', 'size', 'alpha', 'color']) this.geo.attributes[a].needsUpdate = true;
  }
  copy(from, to) {
    const a = from * 3, b = to * 3;
    for (let j = 0; j < 3; j++) { this.pos[b + j] = this.pos[a + j]; this.vel[b + j] = this.vel[a + j]; this.col[b + j] = this.col[a + j]; }
    this.size[to] = this.size[from]; this.alpha[to] = this.alpha[from]; this.life[to] = this.life[from]; this.age[to] = this.age[from];
    this.grow[to] = this.grow[from]; this.a0[to] = this.a0[from]; this.drag[to] = this.drag[from]; this.grav[to] = this.grav[from];
  }
}

export class Particles {
  constructor(scene, quality) {
    const k = quality === 'low' ? 0.5 : 1;
    this.smoke = new Pool(scene, Math.round(1600 * k), true);
    this.sparks = new Pool(scene, Math.round(500 * k), false, THREE.AdditiveBlending);
    this.k = k;
  }
  // per-car effects each frame
  car(x, y, z, fx, fz, v, wet, opts) {
    const dt = opts.dt;
    if (wet > 0.15 && v > 22) {
      const rate = (v / 80) * wet * 70 * this.k * dt;
      for (let n = 0; n < rate; n++) {
        if (Math.random() > rate - n && n >= Math.floor(rate)) break;
        const side = Math.random() < 0.5 ? -0.8 : 0.8;
        const lx = fz, lz = -fx;
        this.smoke.emit(x - fx * 2.6 + lx * side, y + 0.3, z - fz * 2.6 + lz * side,
          fx * v * 0.55 + (Math.random() - 0.5) * 3, 1 + Math.random() * 1.5, fz * v * 0.55 + (Math.random() - 0.5) * 3,
          1.2, 4.5, 0.9 + Math.random() * 0.5, 0.22 * wet + 0.05, 0.82, 0.85, 0.88, 2.2, -0.3);
      }
    }
    if (opts.smoke) {
      for (let n = 0; n < 2; n++) {
        const side = Math.random() < 0.5 ? -0.8 : 0.8; const lx = fz, lz = -fx;
        this.smoke.emit(x + fx * 1.7 + lx * side, y + 0.3, z + fz * 1.7 + lz * side, fx * v * 0.4, 0.8, fz * v * 0.4, 0.8, 3.5, 1.4, 0.45, 0.92, 0.92, 0.92, 1.8, -0.2);
      }
    }
    if (opts.dust) {
      for (let n = 0; n < 3; n++) this.smoke.emit(x - fx * 2 + (Math.random() - 0.5) * 2, y + 0.3, z - fz * 2 + (Math.random() - 0.5) * 2, fx * v * 0.3, 1.5 + Math.random(), fz * v * 0.3, 0.8, 3, 1.2, 0.4, 0.62, 0.52, 0.36, 1.6, 0.5);
    }
  }
  burstSparks(x, y, z, vx, vz, n = 40) {
    for (let i = 0; i < n * this.k; i++) {
      this.sparks.emit(x, y + 0.2, z, vx * 0.6 + (Math.random() - 0.5) * 10, 2 + Math.random() * 5, vz * 0.6 + (Math.random() - 0.5) * 10,
        0.14, 0, 0.4 + Math.random() * 0.5, 1, 1, 0.65 + Math.random() * 0.25, 0.25, 0.8, 9.8);
    }
  }
  trailSparks(x, y, z, fx, fz, v) {
    for (let i = 0; i < 3 * this.k; i++) this.sparks.emit(x - fx * 2.4, y + 0.05, z - fz * 2.4, fx * v * 0.7 + (Math.random() - 0.5) * 4, 1 + Math.random() * 2, fz * v * 0.7 + (Math.random() - 0.5) * 4, 0.1, 0, 0.25, 1, 1, 0.75, 0.3, 0.5, 9.8);
  }
  debris(x, y, z, vx, vz) {
    for (let i = 0; i < 14; i++) this.smoke.emit(x, y + 0.4, z, vx * 0.5 + (Math.random() - 0.5) * 8, 2 + Math.random() * 4, vz * 0.5 + (Math.random() - 0.5) * 8, 0.25, 0, 1.5, 1, 0.08, 0.08, 0.09, 0.6, 9.8);
  }
  update(dt) { this.smoke.update(dt); this.sparks.update(dt); }
}
