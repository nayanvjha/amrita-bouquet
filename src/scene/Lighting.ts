import * as THREE from 'three';

/** Soft botanical lighting: warm key, weak cool rim, a warm point near the bouquet. */
export class Lighting {
  readonly group = new THREE.Group();
  private pointLight: THREE.PointLight;
  private keyLight: THREE.DirectionalLight;
  private baseKey = 2.1;
  private basePoint = 3.4;
  private time = 0;

  constructor() {
    const ambient = new THREE.AmbientLight(0xfff1e2, 0.28);
    const hemi = new THREE.HemisphereLight(0x3a2f2a, 0x0d0b0a, 0.5);

    this.keyLight = new THREE.DirectionalLight(0xffe4cc, this.baseKey);
    this.keyLight.position.set(2.4, 5.2, 4.2);

    const rim = new THREE.DirectionalLight(0x9fb4c8, 0.55);
    rim.position.set(-3.5, 3.2, -4.5);

    const fill = new THREE.DirectionalLight(0xffd7c2, 0.35);
    fill.position.set(-2.5, 1.2, 3.5);

    this.pointLight = new THREE.PointLight(0xffc9a0, this.basePoint, 9, 1.8);
    this.pointLight.position.set(0.6, 2.6, 2.2);

    this.group.add(ambient, hemi, this.keyLight, rim, fill, this.pointLight);
  }

  /** `warmth` 0..1 rises with bloom — the bouquet gets a soft halo as it opens. */
  update(dt: number, warmth: number) {
    this.time += dt;
    const flicker = 1 + Math.sin(this.time * 0.9) * 0.03 + Math.sin(this.time * 2.3 + 1) * 0.015;
    this.pointLight.intensity = this.basePoint * (0.55 + 0.45 * warmth) * flicker;
    this.keyLight.intensity = this.baseKey * (0.85 + 0.15 * warmth);
  }
}
