import * as THREE from 'three';
import { BOUQUET } from '../config/constants';
import { clamp, lerp, window01 } from '../utils/math';
import { easeOutCubic, easeOutBack } from '../animation/easing';
import type { Random } from '../utils/random';
import { Stem, stemMaterial } from './Stem';
import type { FlowerSpec } from './Flower';

const _dummy = new THREE.Object3D();
const _v = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);

/**
 * Baby's breath: a thin stem that ends in a loose cloud of tiny white
 * blossoms on hair-thin twigs. Fills the gaps between the main flowers.
 */
export class FillerCluster {
  readonly group = new THREE.Group();
  readonly head = new THREE.Group();
  readonly spec: FlowerSpec;
  private stem: Stem;
  private blossoms: THREE.InstancedMesh;
  private twigs: THREE.InstancedMesh;
  private offsets: THREE.Vector3[] = [];
  private delays: number[] = [];
  private swayOffset: number;
  private lastGrowth = -1;
  private lastBloom = -1;
  private tmpPos = new THREE.Vector3();
  localGrowth = 0;
  localBloom = 0;

  constructor(spec: FlowerSpec, random: Random) {
    this.spec = spec;
    this.swayOffset = random.range(0, Math.PI * 2);
    this.stem = new Stem({ base: spec.base, target: spec.target, radius: 0.009, bow: spec.stemBow, leafCount: 0, random, segments: 20 });
    this.group.add(this.stem.group);

    const count = 16 + Math.floor(random.next() * 8);
    const blossomGeo = new THREE.SphereGeometry(0.02, 8, 6);
    const blossomMat = new THREE.MeshStandardMaterial({ color: 0xf6efe4, roughness: 0.9, emissive: 0x2a2421, emissiveIntensity: 0.4 });
    this.blossoms = new THREE.InstancedMesh(blossomGeo, blossomMat, count);
    this.blossoms.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.blossoms.frustumCulled = false;

    const twigGeo = new THREE.CylinderGeometry(0.003, 0.005, 1, 4, 1);
    twigGeo.translate(0, 0.5, 0);
    this.twigs = new THREE.InstancedMesh(twigGeo, stemMaterial, count);
    this.twigs.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.twigs.frustumCulled = false;

    for (let i = 0; i < count; i++) {
      const theta = random.range(0, Math.PI * 2);
      const phi = random.range(0.15, 1.35);
      const r = random.range(0.1, 0.26) * spec.scale;
      this.offsets.push(new THREE.Vector3(Math.sin(phi) * Math.cos(theta) * r, Math.cos(phi) * r + 0.03, Math.sin(phi) * Math.sin(theta) * r));
      this.delays.push(random.next() * 0.5);
    }
    this.head.add(this.blossoms, this.twigs);
    this.group.add(this.head);
    this.head.visible = false;
  }

  update(globalGrowth: number, globalBloom: number, time: number) {
    const [gs, ge] = this.spec.growWindow;
    const growth = window01(globalGrowth, gs, ge, easeOutCubic);
    const bloom = clamp(globalBloom * (1 + BOUQUET.bloomStagger) - BOUQUET.bloomStagger * this.spec.bloomDelay);
    this.localGrowth = growth;
    this.localBloom = bloom;
    const growthChanged = Math.abs(growth - this.lastGrowth) > 1e-4;
    if (growthChanged) {
      this.lastGrowth = growth;
      this.stem.setGrowth(growth);
      this.stem.tipAt(growth, this.tmpPos);
      this.head.position.copy(this.tmpPos);
      this.head.quaternion.setFromUnitVectors(_up, _v.copy(this.stem.tangentAt(growth)).lerp(_up, 0.5).normalize());
      this.head.visible = growth > 0.05;
    }
    if (growthChanged || Math.abs(bloom - this.lastBloom) > 1e-4) {
      this.lastBloom = bloom;
      const emerge = window01(growth, 0.3, 1, easeOutCubic);
      for (let i = 0; i < this.offsets.length; i++) {
        const o = this.offsets[i];
        const open = window01(bloom, this.delays[i] * 0.6, this.delays[i] * 0.6 + 0.4, easeOutBack);
        const spread = lerp(0.35, 1, open) * emerge;
        _dummy.position.copy(o).multiplyScalar(spread);
        _dummy.rotation.set(0, 0, 0);
        _dummy.scale.setScalar(Math.max(0.0001, lerp(0.35, 1, open) * emerge));
        _dummy.updateMatrix();
        this.blossoms.setMatrixAt(i, _dummy.matrix);
        // twig from the cluster centre to the blossom
        const len = _dummy.position.length();
        _dummy.position.set(0, 0, 0);
        _dummy.quaternion.setFromUnitVectors(_up, _v.copy(o).normalize());
        _dummy.scale.set(1, Math.max(0.0001, len), 1);
        _dummy.updateMatrix();
        this.twigs.setMatrixAt(i, _dummy.matrix);
      }
      this.blossoms.instanceMatrix.needsUpdate = true;
      this.twigs.instanceMatrix.needsUpdate = true;
    }
    const sway = BOUQUET.swayAmplitude * 1.3 * growth;
    this.group.rotation.z = Math.sin(time * 0.5 + this.swayOffset) * sway;
    this.group.rotation.x = Math.sin(time * 0.41 + this.swayOffset * 2.1) * sway * 0.7;
  }

  headWorldPosition(out: THREE.Vector3) { return this.head.getWorldPosition(out); }
}
