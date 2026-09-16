export type ExperienceStateName =
  | 'INTRO'
  | 'GROWING'
  | 'BLOOMING'
  | 'FULL_BOUQUET'
  | 'MESSAGE_REVEAL'
  | 'FINAL';

export type InputMode = 'hands' | 'mouse' | 'touch' | 'auto';

type Listener = (next: ExperienceStateName, prev: ExperienceStateName) => void;

/**
 * The single source of truth for where the experience is. Everything else
 * (UI, camera, particles) listens to transitions instead of polling booleans.
 */
export class ExperienceState {
  private current: ExperienceStateName = 'INTRO';
  private listeners = new Set<Listener>();
  /** seconds since the current state began */
  timeInState = 0;
  /** seconds since the experience started (after intro) */
  elapsed = 0;
  inputMode: InputMode = 'mouse';
  cameraAvailable = false;
  uiHidden = false;

  // live control values 0..1 — smoothed, what the scene actually renders
  growth = 0;
  bloom = 0;
  // raw targets the input layer writes into
  targetGrowth = 0;
  targetBloom = 0;
  /** once the message is revealed the controls are locked open */
  locked = false;

  get name() { return this.current; }
  is(...names: ExperienceStateName[]) { return names.includes(this.current); }
  get started() { return this.current !== 'INTRO'; }
  get pastReveal() { return this.current === 'MESSAGE_REVEAL' || this.current === 'FINAL'; }

  onChange(listener: Listener) { this.listeners.add(listener); return () => this.listeners.delete(listener); }

  transition(next: ExperienceStateName) {
    if (next === this.current) return;
    const prev = this.current;
    this.current = next;
    this.timeInState = 0;
    for (const l of this.listeners) l(next, prev);
  }

  tick(dt: number) {
    this.timeInState += dt;
    if (this.started) this.elapsed += dt;
  }

  /** Derive the coarse state from the control values (until the reveal locks it). */
  deriveFromControls() {
    if (this.locked || !this.started || this.pastReveal) return;
    if (this.growth < 0.12) this.transition('GROWING');
    else if (this.bloom < 0.12) this.transition(this.growth > 0.9 ? 'BLOOMING' : 'GROWING');
    else if (this.bloom < 0.85 || this.growth < 0.85) this.transition('BLOOMING');
    else this.transition('FULL_BOUQUET');
  }

  reset() {
    this.growth = 0; this.bloom = 0; this.targetGrowth = 0; this.targetBloom = 0;
    this.locked = false; this.elapsed = 0;
    this.transition('INTRO');
  }
}
