import * as THREE from 'three';
import { PALETTE } from '../config/constants';
import { clamp, window01, lerp } from '../utils/math';
import { easeOutCubic } from '../animation/easing';
import type { Random } from '../utils/random';
import { createPetalGeometry, updatePetalGeometry, type PetalShape } from './Petal';

export const stemMaterial = new THREE.MeshStandardMaterial({
  color: PALETTE.stem, roughness: 0.82, metalness: 0,
});
export const leafMaterial = new THREE.MeshStandardMaterial({
  color: PALETTE.foliageLight, roughness: 0.78, metalness: 0, side: THREE.DoubleSide, vertexColors: true,
});

/** A tube whose radius follows `radiusAt(t)`; index layout is ring-major so drawRange reveals it tip-ward. */
export function createTaperedTube(curve: THREE.Curve<THREE.Vector3>, segments: number, radial: number, radiusAt: (t: number) => number) {
  const frames = curve.computeFrenetFrames(segments, false);
  const vertexCount = (segments + 1) * (radial + 1);
  const positions = new Float32Array(vertexCount * 3);
  const normals = new Float32Array(vertexCount * 3);
  const uvs = new Float32Array(vertexCount * 2);
  const p = new THREE.Vector3(), n = new THREE.Vector3();
  let vi = 0, ui = 0;
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    curve.getPointAt(t, p);
    const N = frames.normals[i], B = frames.binormals[i];
    const r = radiusAt(t);
    for (let j = 0; j <= radial; j++) {
      const a = (j / radial) * Math.PI * 2;
      const cos = Math.cos(a), sin = Math.sin(a);
      n.set(cos * N.x + sin * B.x, cos * N.y + sin * B.y, cos * N.z + sin * B.z);
      positions[vi] = p.x + r * n.x; normals[vi++] = n.x;
      positions[vi] = p.y + r * n.y; normals[vi++] = n.y;
      positions[vi] = p.z + r * n.z; normals[vi++] = n.z;
      uvs[ui++] = j / radial; uvs[ui++] = t;
    }
  }
  const indices: number[] = [];
  for (let i = 0; i < segments; i++) {
    for (let j = 0; j < radial; j++) {
      const a = i * (radial + 1) + j, b = (i + 1) * (radial + 1) + j;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.userData.indicesPerRing = radial * 6;
  geometry.userData.segments = segments;
  return geometry;
}

const LEAF_SHAPE: PetalShape = {
  length: 0.36, width: 0.11, widthPeak: 0.42, tipPoint: 0.75,
  cup: 0.35, curl: 0.55, curlExponent: 1.8, ripple: 0.003, rippleFrequency: 2, twist: 0.25,
};
let leafGeometry: THREE.BufferGeometry | null = null;
function getLeafGeometry() {
  if (!leafGeometry) {
    leafGeometry = createPetalGeometry(10, 5, { base: [0.7, 0.8, 0.7], edge: [1.05, 1.08, 1.0], baseReach: 0.3, veins: 0.12 });
    updatePetalGeometry(leafGeometry, LEAF_SHAPE);
  }
  return leafGeometry;
}

interface Leaf { pivot: THREE.Group; t: number; scale: number }

export interface StemOptions {
  base: THREE.Vector3;
  target: THREE.Vector3;
  radius: number;
  /** how much the stem bows outward from the straight line */
  bow: number;
  leafCount: number;
  random: Random;
  segments?: number;
}

/**
 * One stem from the binding point up to where its flower will sit. Growth
 * reveals the tube tip-ward and the flower head rides its tip, so the bud
 * rises with the stem instead of appearing on top of it.
 */
export class Stem {
  readonly group = new THREE.Group();
  readonly curve: THREE.CatmullRomCurve3;
  readonly mesh: THREE.Mesh;
  private leaves: Leaf[] = [];
  private indicesPerRing: number;
  private segments: number;
  private growth = -1;
  private tmpTangent = new THREE.Vector3();

  constructor(opts: StemOptions) {
    const { base, target, bow, random } = opts;
    const dir = target.clone().sub(base);
    const length = dir.length();
    const outward = new THREE.Vector3(target.x, 0, target.z);
    if (outward.lengthSq() < 1e-4) outward.set(random.range(-1, 1), 0, random.range(-1, 1));
    outward.normalize();
    const side = new THREE.Vector3(-outward.z, 0, outward.x);

    // control points: leave the wrap fairly straight, bow outward, arrive at the head
    const p0 = base.clone();
    const p1 = base.clone().addScaledVector(dir, 0.28).addScaledVector(outward, -bow * 0.25 * length).addScaledVector(side, random.range(-0.06, 0.06) * length);
    const p2 = base.clone().addScaledVector(dir, 0.66).addScaledVector(outward, bow * 0.5 * length).addScaledVector(side, random.range(-0.05, 0.05) * length);
    const p3 = target.clone();
    this.curve = new THREE.CatmullRomCurve3([p0, p1, p2, p3], false, 'catmullrom', 0.5);

    this.segments = opts.segments ?? 28;
    const geometry = createTaperedTube(this.curve, this.segments, 7, (t) => opts.radius * lerp(1.15, 0.7, t));
    this.indicesPerRing = geometry.userData.indicesPerRing;
    this.mesh = new THREE.Mesh(geometry, stemMaterial);
    this.mesh.frustumCulled = false;
    this.group.add(this.mesh);

    // leaves along the upper half, alternating sides
    const leafGeo = getLeafGeometry();
    for (let i = 0; i < opts.leafCount; i++) {
      const t = random.range(0.3, 0.7);
      const pivot = new THREE.Group();
      const point = this.curve.getPointAt(t);
      const tangent = this.curve.getTangentAt(t);
      pivot.position.copy(point);
      pivot.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tangent);
      const holder = new THREE.Group();
      holder.rotation.y = random.range(0, Math.PI * 2);
      holder.rotation.x = random.range(0.65, 0.95);   // lean away from the stem
      const leaf = new THREE.Mesh(leafGeo, leafMaterial);
      leaf.position.y = opts.radius * 0.5;
      holder.add(leaf);
      pivot.add(holder);
      pivot.scale.setScalar(0.0001);
      this.group.add(pivot);
      this.leaves.push({ pivot, t, scale: random.range(0.75, 1.15) });
    }
    this.setGrowth(0);
  }

  /** Reveal the stem up to `t` and unfold any leaves it has passed. */
  setGrowth(t: number) {
    const g = clamp(t);
    if (Math.abs(g - this.growth) < 1e-4) return;
    this.growth = g;
    const rings = Math.ceil(g * this.segments);
    this.mesh.geometry.setDrawRange(0, rings * this.indicesPerRing);
    this.mesh.visible = g > 0.003;
    for (const leaf of this.leaves) {
      const s = window01(g, leaf.t, Math.min(1, leaf.t + 0.18), easeOutCubic) * leaf.scale;
      leaf.pivot.scale.setScalar(Math.max(0.0001, s));
      leaf.pivot.visible = s > 0.001;
    }
  }

  tipAt(t: number, out: THREE.Vector3) { return this.curve.getPointAt(clamp(t, 0.001, 1), out); }
  tangentAt(t: number) { return this.curve.getTangentAt(clamp(t, 0.001, 1), this.tmpTangent); }
}
