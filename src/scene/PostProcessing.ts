import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { POST } from '../config/constants';

const FinishShader = {
  uniforms: {
    tDiffuse: { value: null },
    uVignette: { value: POST.vignetteDarkness },
    uGrain: { value: POST.grainAmount },
    uTime: { value: 0 },
    uWarm: { value: 0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  fragmentShader: /* glsl */ `
    precision highp float;
    uniform sampler2D tDiffuse;
    uniform float uVignette;
    uniform float uGrain;
    uniform float uTime;
    uniform float uWarm;
    varying vec2 vUv;
    float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233)) + uTime) * 43758.5453); }
    void main() {
      vec4 color = texture2D(tDiffuse, vUv);
      // soft vignette
      vec2 c = vUv - 0.5;
      float v = 1.0 - smoothstep(0.35, 1.05, length(c * vec2(1.0, 1.15)) * 1.35) * uVignette;
      color.rgb *= v;
      // warm lift toward the final state
      color.rgb = mix(color.rgb, color.rgb * vec3(1.03, 1.0, 0.97), uWarm);
      // fine film grain
      color.rgb += (hash(vUv) - 0.5) * uGrain;
      gl_FragColor = color;
    }
  `,
};

export class PostProcessing {
  readonly composer: EffectComposer;
  private bloomPass: UnrealBloomPass;
  private finishPass: ShaderPass;
  private baseStrength = POST.bloomStrength;

  constructor(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera, mobile: boolean) {
    const size = new THREE.Vector2();
    renderer.getSize(size);
    this.composer = new EffectComposer(renderer);
    this.composer.addPass(new RenderPass(scene, camera));
    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(size.x * (mobile ? 0.5 : 1), size.y * (mobile ? 0.5 : 1)),
      POST.bloomStrength, POST.bloomRadius, POST.bloomThreshold,
    );
    this.composer.addPass(this.bloomPass);
    this.finishPass = new ShaderPass(FinishShader);
    this.composer.addPass(this.finishPass);
    this.composer.addPass(new OutputPass());
  }

  resize(w: number, h: number) {
    this.composer.setSize(w, h);
  }

  update(dt: number, warmth: number) {
    this.finishPass.uniforms.uTime.value = (this.finishPass.uniforms.uTime.value + dt) % 100;
    this.finishPass.uniforms.uWarm.value += (warmth - this.finishPass.uniforms.uWarm.value) * Math.min(1, dt);
    this.bloomPass.strength = this.baseStrength * (0.7 + 0.5 * warmth);
  }

  render() { this.composer.render(); }
}
