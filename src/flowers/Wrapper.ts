import * as THREE from 'three';
import { PALETTE } from '../config/constants';
import { window01 } from '../utils/math';
import { easeOutCubic } from '../animation/easing';
import { createPetalGeometry, updatePetalGeometry } from './Petal';
import { leafMaterial } from './Stem';
import { createRandom } from '../utils/random';

/**
 * Ivory paper folded around the stems, tied with a thin gold ribbon. It is
 * deliberately plain — the flowers are the gift, the paper just holds them.
 */
export class Wrapper {
  readonly group = new THREE.Group();
  private paper: THREE.Mesh;
  private ribbon: THREE.Group;
  private foliage: Array<{ pivot: THREE.Group; at: number }> = [];

  constructor() {
    // paper cone: lathe of a flared profile with soft vertical folds
    const profile: THREE.Vector2[] = [];
    const steps = 22;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const y = -0.68 + t * 1.18;
      // narrow at the tie, flaring open at the top
      const r = 0.1 + Math.pow(t, 1.55) * 0.86 + Math.sin(t * Math.PI) * 0.02;
      profile.push(new THREE.Vector2(r, y));
    }
    const geo = new THREE.LatheGeometry(profile, 56);
    const pos = geo.attributes.position;
    const v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      const theta = Math.atan2(v.z, v.x);
      const t = (v.y + 0.68) / 1.18;
      // folds deepen toward the open rim; the rim itself dips and rises
      const fold = 1 + Math.sin(theta * 7 + 0.4) * 0.045 * t + Math.sin(theta * 3 - 1.1) * 0.03 * t;
      v.x *= fold; v.z *= fold;
      v.y += Math.sin(theta * 5 + 0.7) * 0.05 * t * t;
      pos.setXYZ(i, v.x, v.y, v.z);
    }
    geo.computeVertexNormals();
    const paperTexture = createPaperTexture();
    const paperMat = new THREE.MeshStandardMaterial({
      color: PALETTE.paper, roughness: 0.92, metalness: 0, side: THREE.DoubleSide, map: paperTexture,
    });
    this.paper = new THREE.Mesh(geo, paperMat);
    this.group.add(this.paper);

    // a second, inner sheet a touch darker so the rim reads as folded paper
    const innerGeo = geo.clone();
    innerGeo.scale(0.965, 0.985, 0.965);
    const innerMat = new THREE.MeshStandardMaterial({ color: PALETTE.paperShadow, roughness: 0.95, side: THREE.BackSide, map: paperTexture });
    const inner = new THREE.Mesh(innerGeo, innerMat);
    inner.position.y = 0.01;
    this.group.add(inner);

    // ribbon: a thin gold band with a small knot
    this.ribbon = new THREE.Group();
    const goldMat = new THREE.MeshStandardMaterial({ color: PALETTE.gold, roughness: 0.42, metalness: 0.7 });
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.014, 8, 56), goldMat);
    band.rotation.x = Math.PI / 2;
    band.scale.set(1, 1, 1);
    band.position.y = -0.42;
    this.ribbon.add(band);
    const knot = new THREE.Mesh(new THREE.SphereGeometry(0.026, 10, 8), goldMat);
    knot.position.set(0.02, -0.42, 0.2);
    this.ribbon.add(knot);
    // two short ribbon tails
    for (const side of [-1, 1]) {
      const tail = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.28, 0.006), goldMat);
      tail.position.set(0.02 + side * 0.03, -0.56, 0.19);
      tail.rotation.z = side * 0.32;
      tail.rotation.y = side * 0.2;
      this.ribbon.add(tail);
    }
    this.group.add(this.ribbon);
    this.group.rotation.y = -0.25;

    // broad leaves tucked around the rim — they hide the stems' bases and
    // give the bouquet its green shoulders
    const leafGeo = createPetalGeometry(12, 6, { base: [0.72, 0.8, 0.7], edge: [1.05, 1.1, 1.0], baseReach: 0.3, veins: 0.14 });
    updatePetalGeometry(leafGeo, { length: 0.62, width: 0.22, widthPeak: 0.4, tipPoint: 0.7, cup: 0.4, curl: 0.75, curlExponent: 1.7, ripple: 0.006, rippleFrequency: 2.5, twist: 0.3 });
    const random = createRandom(5);
    const leafCount = 7;
    for (let i = 0; i < leafCount; i++) {
      const az = (i / leafCount) * Math.PI * 2 + random.range(-0.3, 0.3) + 0.4;
      const pivot = new THREE.Group();
      pivot.position.set(Math.sin(az) * 0.52, 0.28 + random.range(-0.08, 0.08), Math.cos(az) * 0.52);
      pivot.rotation.set(random.range(0.55, 0.9), az, random.range(-0.15, 0.15), 'YXZ');
      const leaf = new THREE.Mesh(leafGeo, leafMaterial);
      leaf.scale.setScalar(random.range(0.85, 1.2));
      pivot.add(leaf);
      pivot.scale.setScalar(0.0001);
      this.group.add(pivot);
      this.foliage.push({ pivot, at: 0.18 + random.next() * 0.35 });
    }
  }

  /** The paper opens with the first growth; before that it's a closed cone. */
  update(growth: number) {
    const open = window01(growth, 0, 0.35, easeOutCubic);
    const s = 0.72 + 0.28 * open;
    this.paper.scale.set(s, 0.9 + 0.1 * open, s);
    for (const leaf of this.foliage) {
      const g = window01(growth, leaf.at, leaf.at + 0.22, easeOutCubic);
      leaf.pivot.scale.setScalar(Math.max(0.0001, g));
      leaf.pivot.visible = g > 0.001;
    }
  }
}

/** Soft fibrous paper: mottling plus faint fibres, drawn once to a small canvas. */
function createPaperTexture() {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size; canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, size, size);
  const random = createRandom(101);
  // mottle
  for (let i = 0; i < 900; i++) {
    const r = random.range(6, 26);
    ctx.fillStyle = `rgba(${random.next() < 0.5 ? '150,130,110' : '255,252,246'},${random.range(0.015, 0.035)})`;
    ctx.beginPath(); ctx.arc(random.range(0, size), random.range(0, size), r, 0, Math.PI * 2); ctx.fill();
  }
  // fibres
  ctx.lineWidth = 0.6;
  for (let i = 0; i < 500; i++) {
    const x = random.range(0, size), y = random.range(0, size);
    const a = random.range(0, Math.PI), l = random.range(4, 18);
    ctx.strokeStyle = `rgba(110,90,70,${random.range(0.025, 0.06)})`;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); ctx.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(3, 2);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
