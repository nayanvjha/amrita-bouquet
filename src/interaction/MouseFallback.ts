import { clamp, remap } from '../utils/math';

export type FallbackKind = 'pointer' | 'touch';

/**
 * No camera? The bouquet still answers.
 *
 *   desktop pointer: move up   -> grow,   move right -> bloom
 *   touch:           press and hold anywhere -> it grows, then blooms
 *
 * Dragging orbits the camera as usual; a hold that doesn't move is a "give".
 */
export class MouseFallback {
  growth = 0;
  bloom = 0;
  enabled = false;
  readonly kind: FallbackKind;
  private dragging = false;
  private holding = false;
  private moved = false;
  private startX = 0;
  private startY = 0;
  private pointerX = 0.5;
  private pointerY = 0.5;
  private hasPointer = false;

  constructor(private element: HTMLElement) {
    this.kind = window.matchMedia('(pointer: coarse)').matches ? 'touch' : 'pointer';
    element.addEventListener('pointermove', this.onMove, { passive: true });
    element.addEventListener('pointerdown', this.onDown, { passive: true });
    window.addEventListener('pointerup', this.onUp, { passive: true });
    window.addEventListener('pointercancel', this.onUp, { passive: true });
  }

  private onMove = (e: PointerEvent) => {
    this.pointerX = e.clientX / window.innerWidth;
    this.pointerY = e.clientY / window.innerHeight;
    this.hasPointer = true;
    if (this.holding && Math.hypot(e.clientX - this.startX, e.clientY - this.startY) > 14) this.moved = true;
  };
  private onDown = (e: PointerEvent) => {
    this.dragging = true; this.holding = true; this.moved = false;
    this.startX = e.clientX; this.startY = e.clientY;
  };
  private onUp = () => { this.dragging = false; this.holding = false; };

  update(dt: number) {
    if (!this.enabled) return;
    if (this.kind === 'pointer') {
      // ignore while dragging so orbiting doesn't also yank the flowers
      if (this.dragging || !this.hasPointer) return;
      const g = remap(this.pointerY, 0.88, 0.12, 0, 1);
      const b = remap(this.pointerX, 0.12, 0.88, 0, 1);
      this.growth = clamp(g);
      this.bloom = clamp(b);
    } else {
      // hold to give: growth fills first, then bloom
      if (this.holding && !this.moved) {
        if (this.growth < 1) this.growth = clamp(this.growth + dt / 4.5);
        else this.bloom = clamp(this.bloom + dt / 4.5);
      }
    }
  }

  reset() { this.growth = 0; this.bloom = 0; }
  dispose() {
    this.element.removeEventListener('pointermove', this.onMove);
    this.element.removeEventListener('pointerdown', this.onDown);
    window.removeEventListener('pointerup', this.onUp);
    window.removeEventListener('pointercancel', this.onUp);
  }
}
