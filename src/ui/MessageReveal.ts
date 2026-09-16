import { TIMING } from '../config/constants';

/**
 * The apology. Three lines, in order, with time between them:
 *   AMRITA MA'AM
 *   I'm sorry, Ma'am.
 *   I wanted to say it properly, so I made you these.
 */
export class MessageReveal {
  private name = document.getElementById('msg-name')!;
  private sorry = document.getElementById('msg-sorry')!;
  private hand = document.getElementById('msg-hand')!;
  private root = document.getElementById('message')!;
  private time = 0;
  private running = false;
  private finished = false;
  onFinal: (() => void) | null = null;

  start() { this.running = true; this.finished = false; this.time = 0; this.root.classList.add('is-active'); }

  update(dt: number) {
    if (!this.running) return;
    this.time += dt;
    const r = TIMING.reveal;
    this.name.classList.toggle('is-visible', this.time > r.nameAt);
    this.sorry.classList.toggle('is-visible', this.time > r.sorryAt);
    this.hand.classList.toggle('is-visible', this.time > r.handAt);
    if (!this.finished && this.time > r.finalAt) { this.finished = true; this.onFinal?.(); }
  }

  get progress() { return this.running ? this.time : 0; }

  reset() {
    this.running = false; this.finished = false; this.time = 0;
    this.root.classList.remove('is-active');
    for (const el of [this.name, this.sorry, this.hand]) el.classList.remove('is-visible');
  }
}
