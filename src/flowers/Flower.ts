import * as THREE from 'three';
import { BOUQUET } from '../config/constants';
import { clamp, degToRad, lerp, window01 } from '../utils/math';
import { easeInOutCubic, easeOutCubic, easeOutSine } from '../animation/easing';
import type { Random } from '../utils/random';
import { Stem } from './Stem';
import { cloneShape, createPetalGeometry, lerpShape, updatePetalGeometry, type PetalShape } from './Petal';
import type { FlowerKind, FlowerTypeDefinition, WhorlDefinition } from './FlowerTypes';

export interface FlowerSpec {
  id: number;
  kind: FlowerKind;
  /** where the head sits in bouquet space at full growth */
  target: THREE.Vector3;
  /** where the stem leaves the wrap */
  base: THREE.Vector3;
  color: number;
  scale: number;
  /** [start, end] of this flower's rise inside the global growth 0..1 */
  growWindow: [number, number];
  /** 0..1 — where this flower sits in the bloom wave */
  bloomDelay: number;
  /** optional facing hint: which way the open flower looks */
  facing?: THREE.Vector3;
  stemBow: number;
  leafCount: number;
}

interface PetalInstance { azimuth: number; tilt: number; scale: number; roll: number }

interface Whorl {
  def: WhorlDefinition;
  geometry: THREE.BufferGeometry;
  mesh: THREE.InstancedMesh;
  petals: PetalInstance[];
  shape: PetalShape;
  lastOpen: number;
}

const _dummy = new THREE.Object3D();
const _up = new THREE.Vector3(0, 1, 0);
const _q = new THREE.Quaternion();
const _v = new THREE.Vector3();
const _color = new THREE.Color();

/**
 * A single flower: its stem, a head that rides the stem tip during growth,
 * and whorls of instanced petals that unfurl on their own windows of the
 * bloom. Everything is driven by two numbers — growth and bloom — plus time.
 */
export class Flower {
  readonly group = new THREE.Group();
  readonly head = new THREE.Group();
  readonly spec: FlowerSpec;
  readonly stem: Stem;
  readonly material: THREE.MeshPhysicalMaterial;
  private inner = new THREE.Group();
  private whorls: Whorl[] = [];
  private sepals: THREE.InstancedMesh | null = null;
  private sepalDef: FlowerTypeDefinition['sepals'];
  private center: THREE.Mesh | null = null;
  private def: FlowerTypeDefinition;
  private swayOffset: number;
  private swaySpeed: number;
  private facing: THREE.Vector3;
  localGrowth = 0;
  localBloom = 0;
  private lastGrowth = -1;
  private lastBloom = -1;
  private tmpPos = new THREE.Vector3();

  constructor(spec: FlowerSpec, def: FlowerTypeDefinition, random: Random) {
    this.spec = spec;
    this.def = def;
    this.swayOffset = random.range(0, Math.PI * 2);
    this.swaySpeed = random.range(BOUQUET.swaySpeedMin, BOUQUET.swaySpeedMax);
    this.facing = spec.facing?.clone().normalize() ?? new THREE.Vector3(spec.target.x * 0.22, 1.0, 0.32 + spec.target.z * 0.25).normalize();

    this.stem = new Stem({
      base: spec.base, target: spec.target, radius: 0.02 * Math.sqrt(spec.scale),
      bow: spec.stemBow, leafCount: spec.leafCount, random,
    });
    this.group.add(this.stem.group);

    this.material = new THREE.MeshPhysicalMaterial({
      color: spec.color,
      // petals are translucent: a weak self-glow lifts the shaded faces
      emissive: new THREE.Color(spec.color).multiplyScalar(0.14),
      roughness: 0.68,
      metalness: 0,
      sheen: 0.55,
      sheenRoughness: 0.7,
      sheenColor: new THREE.Color(0xffe9e0),
      side: THREE.DoubleSide,
      vertexColors: true,
      flatShading: false,
    });

    this.head.add(this.inner);
    this.group.add(this.head);

    for (const whorlDef of def.whorls) this.buildWhorl(whorlDef, random);
    this.buildCenter(def, random);
    this.sepalDef = def.sepals;
    if (def.sepals) this.buildSepals(def.sepals, random);

    this.head.visible = false;
  }

  private buildWhorl(def: WhorlDefinition, random: Random) {
    const geometry = createPetalGeometry(def.lengthSegments, def.widthSegments, def.colors);
    const shape = cloneShape(def.bud);
    updatePetalGeometry(geometry, shape);
    const mesh = new THREE.InstancedMesh(geometry, this.material, def.count);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false;
    const petals: PetalInstance[] = [];
    const phase = random.range(0, Math.PI * 2);
    for (let i = 0; i < def.count; i++) {
      petals.push({
        azimuth: phase + (i / def.count) * Math.PI * 2 + random.range(-1, 1) * def.jitterAzimuth,
        tilt: random.range(-1, 1) * def.jitterTilt,
        scale: 1 + random.range(-1, 1) * def.jitterScale,
        roll: random.range(-0.08, 0.08),
      });
      // subtle per-petal tint so the whorl doesn't read as one stamped shape
      _color.setScalar(def.shade * (1 + random.range(-0.03, 0.03)));
      mesh.setColorAt(i, _color);
    }
    this.inner.add(mesh);
    this.whorls.push({ def, geometry, mesh, petals, shape, lastOpen: -1 });
  }

  private buildCenter(def: FlowerTypeDefinition, random: Random) {
    if (def.center.kind === 'none') return;
    const r = def.center.radius;
    if (def.center.kind === 'disc') {
      const geo = new THREE.SphereGeometry(r, 18, 10);
      // dimple the disc with tiny florets
      const pos = geo.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        _v.fromBufferAttribute(pos, i);
        const bump = 1 + 0.06 * Math.sin(_v.x * 90 + random.next()) * Math.sin(_v.z * 90);
        _v.multiplyScalar(bump);
        pos.setXYZ(i, _v.x, _v.y * 0.5, _v.z);
      }
      geo.computeVertexNormals();
      this.center = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: def.center.color, roughness: 0.9 }));
    } else {
      const geo = new THREE.SphereGeometry(r, 12, 10);
      this.center = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: def.center.color, roughness: 0.8 }));
      this.center.scale.y = 1.3;
    }
    this.center.position.y = def.center.height;
    this.inner.add(this.center);
  }

  private buildSepals(sepals: NonNullable<FlowerTypeDefinition['sepals']>, random: Random) {
    const geometry = createPetalGeometry(6, 3, { base: [0.75, 0.85, 0.75], edge: [1, 1.05, 0.95], baseReach: 0.3, veins: 0 });
    updatePetalGeometry(geometry, {
      length: sepals.length, width: sepals.width, widthPeak: 0.35, tipPoint: 0.8,
      cup: 0.4, curl: 0.3, curlExponent: 1.8, ripple: 0, rippleFrequency: 1, twist: 0,
    });
    const material = new THREE.MeshStandardMaterial({ color: 0x3c5544, roughness: 0.85, side: THREE.DoubleSide, vertexColors: true });
    this.sepals = new THREE.InstancedMesh(geometry, material, sepals.count);
    this.sepals.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.sepals.frustumCulled = false;
    this.sepals.userData.phase = random.range(0, Math.PI * 2);
    this.inner.add(this.sepals);
  }

  private writeWhorl(whorl: Whorl, open: number) {
    const { def, petals, mesh } = whorl;
    if (Math.abs(open - whorl.lastOpen) < 0.0015 && whorl.lastOpen >= 0) return;
    whorl.lastOpen = open;
    lerpShape(def.bud, def.open, open, whorl.shape);
    updatePetalGeometry(whorl.geometry, whorl.shape);

    const tilt = degToRad(lerp(def.tiltBud, def.tiltOpen, open));
    const spin = degToRad(def.spinOpen) * open;
    const scale = lerp(def.scaleBud, def.scaleOpen, open);
    for (let i = 0; i < petals.length; i++) {
      const p = petals[i];
      const az = p.azimuth + spin;
      _dummy.position.set(Math.sin(az) * def.radius, def.height, Math.cos(az) * def.radius);
      _dummy.rotation.set(tilt + p.tilt * open, az, p.roll, 'YXZ');
      _dummy.scale.setScalar(scale * p.scale);
      _dummy.updateMatrix();
      mesh.setMatrixAt(i, _dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }

  private writeSepals(open: number) {
    if (!this.sepals || !this.sepalDef) return;
    const tilt = degToRad(lerp(12, this.sepalDef.tiltOpen, open));
    const phase = this.sepals.userData.phase as number;
    for (let i = 0; i < this.sepalDef.count; i++) {
      const az = phase + (i / this.sepalDef.count) * Math.PI * 2;
      _dummy.position.set(Math.sin(az) * 0.03, -0.04, Math.cos(az) * 0.03);
      _dummy.rotation.set(tilt, az, 0, 'YXZ');
      _dummy.scale.setScalar(1);
      _dummy.updateMatrix();
      this.sepals.setMatrixAt(i, _dummy.matrix);
    }
    this.sepals.instanceMatrix.needsUpdate = true;
  }

  /** Global growth/bloom in, this flower's own state out. */
  update(globalGrowth: number, globalBloom: number, time: number) {
    const [gs, ge] = this.spec.growWindow;
    const growth = window01(globalGrowth, gs, ge, easeOutCubic);
    // the bloom wave: early flowers finish around 70%, late ones start around 30%
    const bloom = clamp(globalBloom * (1 + BOUQUET.bloomStagger) - BOUQUET.bloomStagger * this.spec.bloomDelay);
    this.localGrowth = growth;
    this.localBloom = bloom;

    const growthChanged = Math.abs(growth - this.lastGrowth) > 1e-4;
    if (growthChanged) {
      this.lastGrowth = growth;
      this.stem.setGrowth(growth);
      // the head rides the stem tip; it leans along the stem then settles to its facing
      this.stem.tipAt(growth, this.tmpPos);
      this.head.position.copy(this.tmpPos);
      const tangent = this.stem.tangentAt(growth);
      const settle = window01(growth, 0.55, 1, easeOutSine);
      _v.copy(tangent).lerp(this.facing, settle).normalize();
      _q.setFromUnitVectors(_up, _v);
      this.head.quaternion.copy(_q);
      this.head.visible = growth > 0.02;
    }

    if (growthChanged || Math.abs(bloom - this.lastBloom) > 1e-4) {
      this.lastBloom = bloom;
      // the bud swells from a tight knot to full size during the first part of the bloom
      const swell = lerp(this.def.swellBud, 1, window01(bloom, 0, 0.5, easeInOutCubic));
      const emerge = window01(growth, 0.08, 0.7, easeOutCubic);
      const s = this.def.headScale * this.spec.scale * swell * emerge;
      this.inner.scale.setScalar(Math.max(0.0001, s));
      for (const whorl of this.whorls) {
        const open = window01(bloom, whorl.def.window[0], whorl.def.window[1], easeInOutCubic);
        this.writeWhorl(whorl, open);
      }
      this.writeSepals(window01(bloom, 0, 0.4, easeInOutCubic));
    }

    // an almost imperceptible breeze once the flower has opened
    const swayAmount = BOUQUET.swayAmplitude * (0.3 + 0.7 * bloom) * growth;
    this.group.rotation.z = Math.sin(time * this.swaySpeed + this.swayOffset) * swayAmount;
    this.group.rotation.x = Math.sin(time * this.swaySpeed * 0.77 + this.swayOffset * 1.7) * swayAmount * 0.6;
  }

  /** World position of the head, for the petal fall and hand proximity. */
  headWorldPosition(out: THREE.Vector3) { return this.head.getWorldPosition(out); }
}
