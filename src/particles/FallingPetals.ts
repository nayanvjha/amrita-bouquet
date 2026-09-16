import * as THREE from 'three';
import { createRandom } from '../utils/random';
import { createPetalGeometry, updatePetalGeometry } from '../flowers/Petal';
import { PALETTE } from '../config/constants';

interface FallingPetal {
  mesh: THREE.Mesh;
  material: THREE.MeshStandardMaterial;
  velocity: THREE.Vector3;
  spin: THREE.Vector3;
  phase: number;
  age: number;
  life: number;
  delay: number;
}

/**
 * When the bouquet is complete, a few petals let go and drift down. Once.
 */
export class FallingPetals {
  readonly group = new THREE.Group();
  private petals: FallingPetal[] = [];
  private released = false;
  private random = createRandom(77);

  constructor(count = 6) {
    const geometry = createPetalGeometry(8, 5, { base: [0.9, 0.78, 0.75], edge: [1.03, 1.0, 0.98], baseReach: 0.4, veins: 0.02 });
    updatePetalGeometry(geometry, {
      length: 0.22, width: 0.19, widthPeak: 0.55, tipPoint: 0.05,
      cup: 0.55, curl: 0.6, curlExponent: 2.2, ripple: 0.004, rippleFrequency: 2, twist: 0.1,
    });
    geometry.center();
    const colors = [PALETTE.petals.blush, PALETTE.petals.dustyRose, PALETTE.petals.paleRose, PALETTE.petals.cream];
    for (let i = 0; i < count; i++) {
      const material = new THREE.MeshStandardMaterial({
        color: colors[i % colors.length], roughness: 0.7, side: THREE.DoubleSide, vertexColors: true,
        transparent: true, opacity: 0,
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.visible = false;
      this.group.add(mesh);
      this.petals.push({
        mesh, material, velocity: new THREE.Vector3(), spin: new THREE.Vector3(),
        phase: this.random.range(0, Math.PI * 2), age: 0, life: this.random.range(5.5, 8), delay: this.random.range(0, 2.4),
      });
    }
  }

  get hasReleased() { return this.released; }

  /** Let the petals go from the given head positions (world space). */
  release(origins: THREE.Vector3[]) {
    if (this.released || origins.length === 0) return;
    this.released = true;
    this.petals.forEach((p, i) => {
      const origin = origins[i % origins.length];
      p.mesh.position.copy(origin).add(new THREE.Vector3(this.random.range(-0.15, 0.15), this.random.range(-0.05, 0.05), this.random.range(0.05, 0.25)));
      p.mesh.rotation.set(this.random.range(0, Math.PI), this.random.range(0, Math.PI), this.random.range(0, Math.PI));
      p.mesh.scale.setScalar(this.random.range(0.7, 1.05));
      p.velocity.set(this.random.range(-0.04, 0.04), this.random.range(-0.16, -0.1), this.random.range(0.02, 0.08));
      p.spin.set(this.random.range(-0.9, 0.9), this.random.range(-0.6, 0.6), this.random.range(-0.9, 0.9));
      p.age = 0;
    });
  }

  reset() {
    this.released = false;
    for (const p of this.petals) { p.mesh.visible = false; p.material.opacity = 0; }
  }

  update(dt: number) {
    if (!this.released) return;
    for (const p of this.petals) {
      p.age += dt;
      const t = p.age - p.delay;
      if (t < 0) continue;
      p.mesh.visible = true;
      const life = t / p.life;
      if (life >= 1) { p.mesh.visible = false; continue; }
      // a petal falls like paper: it rocks side to side as it descends
      const rock = Math.sin(t * 1.6 + p.phase);
      p.mesh.position.x += (p.velocity.x + rock * 0.07) * dt;
      p.mesh.position.y += p.velocity.y * dt * (0.7 + 0.3 * Math.abs(rock));
      p.mesh.position.z += p.velocity.z * dt;
      p.mesh.rotation.x += p.spin.x * dt;
      p.mesh.rotation.y += p.spin.y * dt;
      p.mesh.rotation.z += (p.spin.z + rock * 0.6) * dt;
      p.material.opacity = Math.min(1, t * 2.5) * (1 - Math.pow(life, 3));
    }
  }
}
