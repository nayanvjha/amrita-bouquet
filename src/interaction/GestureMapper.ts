import * as THREE from 'three';
import { INTERACTION } from '../config/constants';
import { clamp } from '../utils/math';
import type { HandReading } from './HandTracking';

/**
 * Turns hand readings into growth / bloom targets.
 *
 *   left hand opens  -> the bouquet grows
 *   right hand opens -> the flowers bloom
 *
 * Values hold when a hand leaves the frame (the bouquet doesn't collapse
 * because you scratched your nose). If only one hand is ever shown, that hand
 * drives both in sequence: half open = fully grown, fully open = fully bloomed.
 */
export class GestureMapper {
  growth = 0;
  bloom = 0;
  leftSeen = false;
  rightSeen = false;
  singleHandMode = false;
  /** world-space point for the most prominent hand, or null */
  handWorld: THREE.Vector3 | null = null;
  private secondsSinceTwoHands = 0;
  private secondsWithOneHand = 0;
  private everSawTwo = false;
  private tmp = new THREE.Vector3();

  update(hands: HandReading[], dt: number, camera: THREE.Camera) {
    this.leftSeen = false; this.rightSeen = false;
    let left: HandReading | null = null, right: HandReading | null = null;
    for (const h of hands) { if (h.isLeft) left ??= h; else right ??= h; }

    if (left && right) { this.everSawTwo = true; this.secondsSinceTwoHands = 0; this.secondsWithOneHand = 0; }
    else { this.secondsSinceTwoHands += dt; if (hands.length === 1) this.secondsWithOneHand += dt; else this.secondsWithOneHand = 0; }

    // single-hand fallback kicks in only if we've never seen both hands together
    this.singleHandMode = !this.everSawTwo && this.secondsWithOneHand > INTERACTION.singleHandAfterSeconds;

    if (this.singleHandMode && hands.length === 1) {
      const p = hands[0].pinch;
      this.growth = clamp(p / 0.5);
      this.bloom = clamp((p - 0.5) / 0.45);
      this.leftSeen = this.rightSeen = true;
    } else {
      if (left) { this.growth = clamp(left.pinch / INTERACTION.growFullAt); this.leftSeen = true; }
      if (right) { this.bloom = clamp(right.pinch / INTERACTION.bloomFullAt); this.rightSeen = true; }
    }

    // hand presence for the particles: project the palm onto a plane in front of the bouquet
    const lead = right ?? left ?? null;
    if (lead) {
      const x = (0.5 - lead.palmX) * 2;     // mirrored to match what you see
      const y = (0.5 - lead.palmY) * 2;
      // cast from the camera through the palm and stop on a plane just in front of the bouquet
      this.tmp.set(x, y, 0.5).unproject(camera).sub(camera.position);
      const planeZ = 1.4;
      const t = (planeZ - camera.position.z) / (this.tmp.z || -1e-6);
      this.tmp.multiplyScalar(t).add(camera.position);
      this.handWorld = this.tmp;
    } else {
      this.handWorld = null;
    }
  }

  reset() {
    this.growth = 0; this.bloom = 0; this.everSawTwo = false;
    this.secondsWithOneHand = 0; this.singleHandMode = false;
  }
}
