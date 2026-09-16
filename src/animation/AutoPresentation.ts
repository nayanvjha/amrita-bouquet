import { TIMING } from '../config/constants';
import { easeInOutSine } from './easing';
import { clamp } from '../utils/math';

/** Space: the bouquet gives itself — grows, then blooms, on a cinematic clock. */
export class AutoPresentation {
  active = false;
  growth = 0;
  bloom = 0;
  private time = 0;

  start(fromGrowth = 0, fromBloom = 0) {
    this.active = true;
    const a = TIMING.autoPresentation;
    // resume from wherever the user got to
    this.time = fromGrowth * a.growSeconds;
    if (fromGrowth >= 0.99) this.time = a.growSeconds - a.overlapSeconds + fromBloom * a.bloomSeconds;
  }
  stop() { this.active = false; }

  update(dt: number) {
    if (!this.active) return;
    const a = TIMING.autoPresentation;
    this.time += dt;
    this.growth = easeInOutSine(clamp(this.time / a.growSeconds));
    const bloomStart = a.growSeconds - a.overlapSeconds;
    this.bloom = easeInOutSine(clamp((this.time - bloomStart) / a.bloomSeconds));
    if (this.bloom >= 1) this.active = false;
  }
}
