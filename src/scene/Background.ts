import * as THREE from 'three';

/**
 * A large backdrop plane with a warm radial gradient — the "expensive and
 * quiet" dark room. It brightens very slightly behind the bouquet as it blooms.
 */
export class Background {
  readonly mesh: THREE.Mesh;
  private material: THREE.ShaderMaterial;

  constructor() {
    this.material = new THREE.ShaderMaterial({
      depthWrite: false,
      fog: false,
      uniforms: {
        uWarmth: { value: 0 },
        uTime: { value: 0 },
        uAspect: { value: 1 },
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        precision highp float;
        varying vec2 vUv;
        uniform float uWarmth;
        uniform float uTime;
        float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        void main() {
          vec2 c = vUv - vec2(0.5, 0.46);
          float d = length(c * vec2(1.0, 1.25));
          vec3 edge   = vec3(0.047, 0.043, 0.039);   // #0C0B0A
          vec3 mid    = vec3(0.075, 0.063, 0.059);   // #13100F
          vec3 center = vec3(0.105, 0.082, 0.071);   // warm halo
          vec3 col = mix(center, mid, smoothstep(0.0, 0.42, d));
          col = mix(col, edge, smoothstep(0.35, 0.95, d));
          // a soft halo that grows with the bloom
          float halo = exp(-d * d * 7.0) * (0.035 + 0.075 * uWarmth);
          col += vec3(0.32, 0.22, 0.17) * halo;
          // dither to kill banding
          col += (hash(vUv * 1200.0 + uTime) - 0.5) * 0.008;
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });
    const geo = new THREE.PlaneGeometry(1, 1);
    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.renderOrder = -10;
    this.mesh.frustumCulled = false;
  }

  /** Keep the backdrop filling the frame behind the bouquet regardless of camera. */
  update(camera: THREE.PerspectiveCamera, dt: number, warmth: number) {
    this.material.uniforms.uWarmth.value += (warmth - this.material.uniforms.uWarmth.value) * Math.min(1, dt * 1.5);
    this.material.uniforms.uTime.value += dt;
    const distance = 22;
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    this.mesh.position.copy(camera.position).addScaledVector(dir, distance);
    this.mesh.quaternion.copy(camera.quaternion);
    const h = 2 * distance * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * 1.25;
    this.mesh.scale.set(h * camera.aspect, h, 1);
  }
}
