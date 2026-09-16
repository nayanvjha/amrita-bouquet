export interface DebugActions {
  autoGrow: () => void;
  autoBloom: () => void;
  reset: () => void;
  toggleCamera: () => void;
  toggleTracking: () => void;
  toggleLandmarks: () => void;
}

/** Developer panel (D). Never shown to normal viewers. */
export class DebugPanel {
  private root = document.getElementById('debug')!;
  private readout = document.createElement('div');
  visible = false;
  showLandmarks = false;
  private frames = 0;
  private fpsTime = 0;
  fps = 0;

  constructor(actions: DebugActions) {
    const bar = document.createElement('div');
    const button = (label: string, fn: () => void) => {
      const b = document.createElement('button');
      b.type = 'button'; b.textContent = label; b.addEventListener('click', fn); bar.appendChild(b);
    };
    button('auto grow', actions.autoGrow);
    button('auto bloom', actions.autoBloom);
    button('reset', actions.reset);
    button('camera', actions.toggleCamera);
    button('tracking', actions.toggleTracking);
    button('landmarks', () => { this.showLandmarks = !this.showLandmarks; actions.toggleLandmarks(); });
    this.root.appendChild(bar);
    this.root.appendChild(this.readout);
  }

  toggle() { this.visible = !this.visible; this.root.hidden = !this.visible; }

  update(dt: number, lines: string[]) {
    this.frames++; this.fpsTime += dt;
    if (this.fpsTime >= 0.5) { this.fps = Math.round(this.frames / this.fpsTime); this.frames = 0; this.fpsTime = 0; }
    if (!this.visible) return;
    this.readout.textContent = [`fps ${this.fps}`, ...lines].join('\n');
  }
}
