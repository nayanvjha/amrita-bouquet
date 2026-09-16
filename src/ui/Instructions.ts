import { TIMING } from '../config/constants';

/**
 * The whisper ("Amrita Ma'am…"), the gesture hint, and the fallback note.
 * They appear once, early, and get out of the way.
 */
export class Instructions {
  private whisper = document.getElementById('whisper')!;
  private hint = document.getElementById('instructions')!;
  private note = document.getElementById('fallback-note')!;
  private camWrap = document.getElementById('cam-wrap')!;
  private hintDismissed = false;

  setFallbackNote(text: string) { this.note.textContent = text; }
  setHintLabels(left: string, right: string) {
    const rows = this.hint.querySelectorAll('.instr-row');
    rows[0].innerHTML = `<span class="instr-key">${left}</span>`;
    rows[1].innerHTML = `<span class="instr-key">${right}</span>`;
  }
  showCamera(visible: boolean) { this.camWrap.classList.toggle('is-visible', visible); }
  dimCamera(dim: boolean) { this.camWrap.classList.toggle('is-dim', dim); }

  /** `elapsed` = seconds since the experience started; `progress` = how far the user has got. */
  update(elapsed: number, progress: number, useHands: boolean) {
    this.whisper.classList.toggle('is-visible', elapsed > TIMING.whisperInSeconds && elapsed < TIMING.whisperOutSeconds);
    // the hint fades out once the user clearly understands, or after a while
    if (progress > 0.35) this.hintDismissed = true;
    const showHint = !this.hintDismissed && elapsed > TIMING.instructionsInSeconds && elapsed < TIMING.instructionsOutSeconds;
    this.hint.classList.toggle('is-visible', showHint && useHands);
    this.note.classList.toggle('is-visible', showHint && !useHands);
  }

  reset() {
    this.hintDismissed = false;
    this.whisper.classList.remove('is-visible');
    this.hint.classList.remove('is-visible');
    this.note.classList.remove('is-visible');
  }
}
