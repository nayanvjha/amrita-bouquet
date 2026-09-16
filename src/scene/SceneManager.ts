import * as THREE from 'three';
import { PALETTE, POST } from '../config/constants';

export const isMobile = () =>
  /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || window.matchMedia('(pointer: coarse)').matches;

export class SceneManager {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly mobile = isMobile();
  private resizeListeners: Array<(w: number, h: number) => void> = [];

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: !this.mobile,
      powerPreference: 'high-performance',
      alpha: false,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, this.mobile ? 1.6 : 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight, false);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = POST.exposure;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.scene.background = new THREE.Color(PALETTE.background);
    // gentle depth falloff: far flowers sink into the dark
    this.scene.fog = new THREE.Fog(PALETTE.background, 9, 18);

    window.addEventListener('resize', this.onResize);
    window.addEventListener('orientationchange', this.onResize);
  }

  onResizeListener(fn: (w: number, h: number) => void) { this.resizeListeners.push(fn); }

  private onResize = () => {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    for (const fn of this.resizeListeners) fn(w, h);
  };

  get size() { return { width: window.innerWidth, height: window.innerHeight }; }
}
