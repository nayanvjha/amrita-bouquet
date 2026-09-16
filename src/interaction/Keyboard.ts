/**
 * Keyboard fallback and shortcuts.
 *   G / B  hold to grow / bloom      R reset      Space auto presentation
 *   Enter  reveal the message        H hide UI    D debug     S swap hands
 */
export interface KeyboardHandlers {
  onReset: () => void;
  onAuto: () => void;
  onReveal: () => void;
  onToggleUI: () => void;
  onToggleDebug: () => void;
  onSwapHands: () => void;
}

export class Keyboard {
  growHeld = false;
  bloomHeld = false;

  constructor(private handlers: KeyboardHandlers) {
    window.addEventListener('keydown', this.onDown);
    window.addEventListener('keyup', this.onUp);
    window.addEventListener('blur', () => { this.growHeld = false; this.bloomHeld = false; });
  }

  private onDown = (e: KeyboardEvent) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    switch (e.key.toLowerCase()) {
      case 'g': this.growHeld = true; break;
      case 'b': this.bloomHeld = true; break;
      case 'r': this.handlers.onReset(); break;
      case ' ': e.preventDefault(); this.handlers.onAuto(); break;
      case 'enter': this.handlers.onReveal(); break;
      case 'h': this.handlers.onToggleUI(); break;
      case 'd': this.handlers.onToggleDebug(); break;
      case 's': this.handlers.onSwapHands(); break;
    }
  };
  private onUp = (e: KeyboardEvent) => {
    const k = e.key.toLowerCase();
    if (k === 'g') this.growHeld = false;
    if (k === 'b') this.bloomHeld = false;
  };
}
