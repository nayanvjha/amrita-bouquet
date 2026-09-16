import { clamp, lerp } from '../utils/math';
import { easeInOutSine, type Ease } from './easing';

/**
 * A tiny scrubbable keyframe timeline. Hand input seeks it, so stages always
 * play in order whether the user moves forward or back. Each track holds a
 * list of {at, value, ease} keys sorted by `at` (0..1).
 */
export interface Key { at: number; value: number; ease?: Ease }

export class Track {
  constructor(public keys: Key[]) { keys.sort((a, b) => a.at - b.at); }
  sample(t: number): number {
    const keys = this.keys;
    if (t <= keys[0].at) return keys[0].value;
    const last = keys[keys.length - 1];
    if (t >= last.at) return last.value;
    for (let i = 0; i < keys.length - 1; i++) {
      const a = keys[i], b = keys[i + 1];
      if (t >= a.at && t <= b.at) {
        const local = (t - a.at) / Math.max(1e-6, b.at - a.at);
        return lerp(a.value, b.value, (b.ease ?? easeInOutSine)(local));
      }
    }
    return last.value;
  }
}

export class Timeline<TName extends string> {
  private tracks = new Map<TName, Track>();
  add(name: TName, keys: Key[]) { this.tracks.set(name, new Track(keys)); return this; }
  sample(name: TName, t: number) { return this.tracks.get(name)!.sample(clamp(t)); }
  sampleAll(t: number, out: Record<TName, number>) {
    const c = clamp(t);
    for (const [name, track] of this.tracks) out[name] = track.sample(c);
    return out;
  }
}

/** One-shot value tween driven by the frame loop (no library needed). */
export class Tween {
  private elapsed = 0;
  private active = false;
  private from = 0;
  private to = 0;
  private duration = 1;
  private ease: Ease = easeInOutSine;
  private onDone?: () => void;
  value = 0;

  start(from: number, to: number, duration: number, ease: Ease = easeInOutSine, onDone?: () => void) {
    this.from = from; this.to = to; this.duration = Math.max(1e-3, duration);
    this.ease = ease; this.onDone = onDone; this.elapsed = 0; this.active = true; this.value = from;
  }
  update(dt: number) {
    if (!this.active) return this.value;
    this.elapsed += dt;
    const t = clamp(this.elapsed / this.duration);
    this.value = lerp(this.from, this.to, this.ease(t));
    if (t >= 1) { this.active = false; this.onDone?.(); }
    return this.value;
  }
  get running() { return this.active; }
  stop() { this.active = false; }
}
