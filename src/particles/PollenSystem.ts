import * as THREE from 'three';
import { PARTICLES } from '../config/constants';
import { createRandom } from '../utils/random';
import { damp } from '../utils/math';

/**
 * Pollen / dust motes: slow, sparse, with depth. A hand in the scene nudges
 * them aside; the message reveal lifts them for a moment, then they settle.
 */
export class PollenSystem {
  readonly points: THREE.Points;
  private material: THREE.ShaderMaterial;
  private handTarget = new THREE.Vector3(0, -10, 0);
  private handStrength = 0;
  private handStrengthTarget = 0;
  private burst = 0;
  private burstTarget = 0;
  private visibility = 0;
  private visibilityTarget = 0;

  constructor(mobile: boolean) {
    const count = mobile ? PARTICLES.mobileCount : PARTICLES.desktopCount;
    const random = createRandom(31);
    const positions = new Float32Array(count * 3);
    const seeds = new Float32Array(count * 4);
    const [sx, sy, sz] = PARTICLES.spread;
    const [cx, cy, cz] = PARTICLES.center;
    for (let i = 0; i < count; i++) {
      // denser near the bouquet, thinning outward
      const r = Math.pow(random.next(), 0.6);
      const theta = random.range(0, Math.PI * 2);
      const phi = Math.acos(random.range(-1, 1));
      positions[i * 3 + 0] = cx + Math.sin(phi) * Math.cos(theta) * r * sx;
      positions[i * 3 + 1] = cy + Math.cos(phi) * r * sy;
      positions[i * 3 + 2] = cz + Math.sin(phi) * Math.sin(theta) * r * sz;
      seeds[i * 4 + 0] = random.next();
      seeds[i * 4 + 1] = random.next();
      seeds[i * 4 + 2] = random.next();
      seeds[i * 4 + 3] = random.range(0.5, 1.4);   // size
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 4));

    this.material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uSize: { value: PARTICLES.size * (mobile ? 0.8 : 1) },
        uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
        uHand: { value: new THREE.Vector3(0, -10, 0) },
        uHandStrength: { value: 0 },
        uBurst: { value: 0 },
        uOpacity: { value: 0 },
        uSpeed: { value: PARTICLES.baseSpeed },
      },
      vertexShader: /* glsl */ `
        attribute vec4 aSeed;
        uniform float uTime;
        uniform float uSize;
        uniform float uPixelRatio;
        uniform vec3 uHand;
        uniform float uHandStrength;
        uniform float uBurst;
        uniform float uSpeed;
        varying float vAlpha;
        varying float vDepth;
        void main() {
          vec3 p = position;
          float t = uTime * uSpeed * (0.6 + aSeed.x * 0.8) + aSeed.y * 100.0;
          // slow figure-eight drift, plus a gentle rise during the burst
          p.x += sin(t * 0.9 + aSeed.z * 6.28) * 0.18;
          p.y += sin(t * 0.6 + aSeed.x * 6.28) * 0.12 + uBurst * (0.25 + aSeed.y * 0.35) * sin(uTime * 0.8 + aSeed.z * 6.28);
          p.z += cos(t * 0.7 + aSeed.y * 6.28) * 0.15;
          // the hand pushes nearby motes aside
          vec3 away = p - uHand;
          float d = length(away);
          float push = smoothstep(1.3, 0.0, d) * uHandStrength;
          p += normalize(away + vec3(0.0, 0.001, 0.0)) * push * 0.55;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          float twinkle = 0.55 + 0.45 * sin(uTime * (0.7 + aSeed.z * 1.4) + aSeed.x * 20.0);
          vAlpha = twinkle * (0.35 + 0.65 * aSeed.y);
          vDepth = -mv.z;
          gl_PointSize = uSize * aSeed.w * uPixelRatio * (140.0 / max(1.0, -mv.z)) * (1.0 + uBurst * 0.25);
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */ `
        precision highp float;
        uniform float uOpacity;
        varying float vAlpha;
        varying float vDepth;
        void main() {
          vec2 c = gl_PointCoord - 0.5;
          float d = length(c);
          float a = smoothstep(0.5, 0.05, d);
          a *= a;
          // far motes fade into the dark
          float depthFade = smoothstep(16.0, 6.0, vDepth);
          vec3 col = mix(vec3(1.0, 0.86, 0.72), vec3(1.0, 0.78, 0.8), vAlpha);
          gl_FragColor = vec4(col, a * vAlpha * uOpacity * depthFade * 0.7);
        }
      `,
    });
    this.points = new THREE.Points(geometry, this.material);
    this.points.frustumCulled = false;
  }

  /** Fade the motes in/out (0..1). */
  setVisibility(v: number) { this.visibilityTarget = v; }
  /** World-space hand position and how strongly it's present. */
  setHand(position: THREE.Vector3 | null) {
    if (position) { this.handTarget.copy(position); this.handStrengthTarget = 1; }
    else this.handStrengthTarget = 0;
  }
  /** A brief lift of movement (message reveal), which settles on its own. */
  pulse() { this.burst = 1; this.burstTarget = 0; }

  update(dt: number) {
    const u = this.material.uniforms;
    u.uTime.value += dt;
    this.handStrength = damp(this.handStrength, this.handStrengthTarget, 0.35, dt);
    u.uHand.value.lerp(this.handTarget, 1 - Math.exp(-dt / 0.2));
    u.uHandStrength.value = this.handStrength;
    this.burst = damp(this.burst, this.burstTarget, 1.4, dt);
    u.uBurst.value = this.burst;
    u.uSpeed.value = PARTICLES.baseSpeed * (1 + this.burst * 2.2);
    this.visibility = damp(this.visibility, this.visibilityTarget, 1.2, dt);
    u.uOpacity.value = this.visibility;
  }
}
