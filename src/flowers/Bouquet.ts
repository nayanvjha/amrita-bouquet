import * as THREE from 'three';
import { PALETTE } from '../config/constants';
import { createRandom } from '../utils/random';
import { Flower, type FlowerSpec } from './Flower';
import { FillerCluster } from './Filler';
import { FLOWER_TYPES, type FlowerKind } from './FlowerTypes';
import { Wrapper } from './Wrapper';

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const P = PALETTE.petals;

/**
 * The arrangement. Positions are authored by hand (then lightly jittered by
 * a fixed seed) so the bouquet reads as gathered, not generated:
 *
 *   - three large roses frame the centre, where the message will sit below
 *   - tulips lean out to either side, one rises behind
 *   - two daisies sit low in front, toward the viewer
 *   - baby's breath fills the gaps
 *
 * growWindow orders the rise (centre first, edges last);
 * bloomDelay orders the opening wave.
 */
const ARRANGEMENT: Array<Omit<FlowerSpec, 'id' | 'base'>> = [
  // ---- central roses ---------------------------------------------------
  { kind: 'rose',  target: V( 0.04, 1.34,  0.34), color: P.blush,       scale: 1.00, growWindow: [0.00, 0.40], bloomDelay: 0.00, stemBow: 0.06, leafCount: 1 },
  { kind: 'rose',  target: V(-0.58, 1.16,  0.22), color: P.dustyRose,   scale: 0.95, growWindow: [0.16, 0.58], bloomDelay: 0.22, stemBow: 0.12, leafCount: 1 },
  { kind: 'rose',  target: V( 0.62, 1.20,  0.02), color: P.cream,       scale: 0.92, growWindow: [0.22, 0.64], bloomDelay: 0.38, stemBow: 0.12, leafCount: 1 },
  // ---- tulips ----------------------------------------------------------
  { kind: 'tulip', target: V( 0.26, 1.56, -0.44), color: P.mutedCoral,  scale: 0.95, growWindow: [0.28, 0.70], bloomDelay: 0.52, stemBow: 0.08, leafCount: 1, facing: V(0.15, 0.9, -0.3) },
  { kind: 'tulip', target: V(-0.96, 1.00, -0.26), color: P.paleRose,    scale: 0.90, growWindow: [0.38, 0.78], bloomDelay: 0.68, stemBow: 0.18, leafCount: 0, facing: V(-0.75, 0.75, 0.2) },
  { kind: 'tulip', target: V( 0.98, 0.96, -0.24), color: P.cream,       scale: 0.88, growWindow: [0.42, 0.82], bloomDelay: 0.80, stemBow: 0.18, leafCount: 0, facing: V(0.75, 0.75, 0.2) },
  // ---- daisies low in front --------------------------------------------
  { kind: 'daisy', target: V(-0.46, 0.86,  0.66), color: P.warmWhite,   scale: 1.00, growWindow: [0.48, 0.86], bloomDelay: 0.58, stemBow: 0.16, leafCount: 1 },
  { kind: 'daisy', target: V( 0.52, 0.80,  0.64), color: P.warmWhite,   scale: 0.94, growWindow: [0.52, 0.90], bloomDelay: 0.88, stemBow: 0.16, leafCount: 1 },
  // ---- a small rose rising behind --------------------------------------
  { kind: 'rose',  target: V(-0.30, 1.62, -0.72), color: P.paleRose,    scale: 0.76, growWindow: [0.34, 0.76], bloomDelay: 1.00, stemBow: 0.06, leafCount: 1 },
  // ---- baby's breath ---------------------------------------------------
  { kind: 'babysbreath', target: V(-0.10, 1.16,  0.84), color: P.warmWhite, scale: 1.0, growWindow: [0.58, 0.94], bloomDelay: 0.50, stemBow: 0.1, leafCount: 0 },
  { kind: 'babysbreath', target: V( 0.92, 1.36,  0.36), color: P.warmWhite, scale: 0.9, growWindow: [0.62, 0.96], bloomDelay: 0.72, stemBow: 0.12, leafCount: 0 },
  { kind: 'babysbreath', target: V(-0.92, 1.42,  0.22), color: P.warmWhite, scale: 0.9, growWindow: [0.64, 1.00], bloomDelay: 0.92, stemBow: 0.12, leafCount: 0 },
];

export type BouquetItem = Flower | FillerCluster;

export class Bouquet {
  readonly group = new THREE.Group();
  readonly flowers: Flower[] = [];
  readonly fillers: FillerCluster[] = [];
  readonly items: BouquetItem[] = [];
  readonly wrapper = new Wrapper();
  /** how open the bouquet is, 0..1 — the average local bloom weighted by size */
  openness = 0;

  constructor(seed = 11) {
    const random = createRandom(seed);
    // the bouquet is tilted toward the viewer, as if held out
    this.group.rotation.x = 0.26;
    this.group.position.y = 0.05;
    this.group.add(this.wrapper.group);

    ARRANGEMENT.forEach((entry, index) => {
      // gentle jitter so nothing is perfectly where a grid would put it
      const target = entry.target.clone().add(V(random.range(-0.05, 0.05), random.range(-0.05, 0.05), random.range(-0.05, 0.05)));
      const base = V(target.x * 0.14 + random.range(-0.03, 0.03), -0.36, target.z * 0.14 + random.range(-0.03, 0.03));
      const spec: FlowerSpec = { ...entry, id: index, target, base };
      if (entry.kind === 'babysbreath') {
        const filler = new FillerCluster(spec, random);
        this.fillers.push(filler);
        this.items.push(filler);
        this.group.add(filler.group);
      } else {
        const flower = new Flower(spec, FLOWER_TYPES[entry.kind as Exclude<FlowerKind, 'babysbreath'>], random);
        this.flowers.push(flower);
        this.items.push(flower);
        this.group.add(flower.group);
      }
    });
  }

  update(growth: number, bloom: number, time: number) {
    this.wrapper.update(growth);
    let sum = 0, weight = 0;
    for (const item of this.items) {
      item.update(growth, bloom, time);
      const w = item.spec.scale;
      sum += item.localBloom * item.localGrowth * w;
      weight += w;
    }
    this.openness = weight > 0 ? sum / weight : 0;
  }

  get flowerCount() { return this.items.length; }
}
