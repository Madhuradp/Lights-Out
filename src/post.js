// Post-processing by quality tier: bloom (medium/high), speed blur + vignette (high), sun lens flare.
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { Lensflare, LensflareElement } from 'three/examples/jsm/objects/Lensflare.js';

const SpeedShader = {
  uniforms: { tDiffuse: { value: null }, amount: { value: 0 }, vig: { value: 0.25 }, center: { value: new THREE.Vector2(0.5, 0.45) } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float amount; uniform float vig; uniform vec2 center; varying vec2 vUv;
    void main(){
      vec2 d = vUv - center; float r = length(d);
      vec4 c = texture2D(tDiffuse, vUv);
      if (amount > 0.001) {
        // radial blur, stronger toward the edges of the screen (the centre stays sharp)
        float k = amount * smoothstep(0.12, 0.7, r);
        vec4 acc = c;
        for (int i = 1; i <= 6; i++) acc += texture2D(tDiffuse, vUv - d * k * float(i) * 0.012);
        c = acc / 7.0;
      }
      c.rgb *= 1.0 - vig * smoothstep(0.35, 0.95, r);
      gl_FragColor = c;
    }`,
};

export function makePost(renderer, scene, camera, quality) {
  if (quality === 'low') return null;
  const size = renderer.getSize(new THREE.Vector2());
  const rt = new THREE.WebGLRenderTarget(size.x * renderer.getPixelRatio(), size.y * renderer.getPixelRatio(), { type: THREE.HalfFloatType, samples: quality === 'high' ? 4 : 2 });
  const composer = new EffectComposer(renderer, rt);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(size.x / 2, size.y / 2), quality === 'high' ? 0.28 : 0.2, 0.45, 0.96);
  composer.addPass(bloom);
  let speed = null;
  if (quality === 'high') { speed = new ShaderPass(SpeedShader); composer.addPass(speed); }
  composer.addPass(new OutputPass());
  const onResize = () => composer.setSize(innerWidth, innerHeight);
  addEventListener('resize', onResize);
  return { composer, bloom, speed, dispose: () => { removeEventListener('resize', onResize); composer.dispose?.(); } };
}

function flareTex(size, draw) { const c = document.createElement('canvas'); c.width = c.height = size; draw(c.getContext('2d'), size); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; }
export function addLensflare(sun, quality) {
  if (quality === 'low') return null;
  const main = flareTex(256, (g, s) => { const gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2); gr.addColorStop(0, 'rgba(255,255,240,1)'); gr.addColorStop(0.1, 'rgba(255,240,200,0.8)'); gr.addColorStop(0.4, 'rgba(255,200,140,0.15)'); gr.addColorStop(1, 'rgba(255,200,140,0)'); g.fillStyle = gr; g.fillRect(0, 0, s, s); });
  const ring = flareTex(128, (g, s) => { const gr = g.createRadialGradient(s / 2, s / 2, s * 0.3, s / 2, s / 2, s / 2); gr.addColorStop(0, 'rgba(160,200,255,0)'); gr.addColorStop(0.8, 'rgba(160,200,255,0.35)'); gr.addColorStop(1, 'rgba(160,200,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, s, s); });
  const dot = flareTex(64, (g, s) => { const gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2); gr.addColorStop(0, 'rgba(255,230,180,0.5)'); gr.addColorStop(1, 'rgba(255,230,180,0)'); g.fillStyle = gr; g.fillRect(0, 0, s, s); });
  const lf = new Lensflare();
  lf.addElement(new LensflareElement(main, 420, 0, sun.color));
  lf.addElement(new LensflareElement(dot, 60, 0.4));
  lf.addElement(new LensflareElement(ring, 140, 0.65));
  lf.addElement(new LensflareElement(dot, 90, 0.85));
  lf.addElement(new LensflareElement(ring, 220, 1.0));
  return lf;
}
