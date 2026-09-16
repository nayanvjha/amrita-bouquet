import { FilesetResolver, HandLandmarker, type NormalizedLandmark } from '@mediapipe/tasks-vision';
import { INTERACTION, MEDIAPIPE } from '../config/constants';
import { clamp } from '../utils/math';

export type TrackerStatus = 'idle' | 'requesting' | 'loading' | 'ready' | 'denied' | 'failed';

export interface HandReading {
  landmarks: NormalizedLandmark[];
  /** the user's physical left hand */
  isLeft: boolean;
  /** 0 = fingers touching, 1 = fully spread (normalised by hand size) */
  pinch: number;
  /** palm centre in normalised video coords (unmirrored) */
  palmX: number;
  palmY: number;
}

const CONNECTIONS: Array<[number, number]> = [
  [0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8], [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16], [13, 17], [17, 18], [18, 19], [19, 20], [0, 17],
];

/**
 * Webcam + MediaPipe HandLandmarker. Nothing here decides what the hands
 * *mean* — it only reports clean readings. The pinch is measured relative to
 * the hand's own size (thumb tip ↔ index tip over wrist ↔ middle knuckle) so
 * distance from the camera doesn't change the feel.
 */
export class HandTracking {
  status: TrackerStatus = 'idle';
  delegate: 'GPU' | 'CPU' | '-' = '-';
  hands: HandReading[] = [];
  lastError = '';
  swapHands: boolean = INTERACTION.swapHands;
  private landmarker: HandLandmarker | null = null;
  private stream: MediaStream | null = null;
  private lastRead = 0;
  private overlayCtx: CanvasRenderingContext2D;

  constructor(private video: HTMLVideoElement, private overlay: HTMLCanvasElement) {
    this.overlayCtx = overlay.getContext('2d')!;
  }

  get active() { return this.status === 'ready'; }

  private landmarkerPromise: Promise<HandLandmarker | null> | null = null;

  /** Load the WASM + model without touching the camera (call while the intro is showing). */
  warmUp() {
    if (this.landmarkerPromise) return this.landmarkerPromise;
    this.landmarkerPromise = (async () => {
      try {
        const fileset = await FilesetResolver.forVisionTasks(MEDIAPIPE.wasmPath);
        const options = {
          baseOptions: { modelAssetPath: MEDIAPIPE.modelPath, delegate: 'GPU' as 'GPU' | 'CPU' },
          numHands: 2,
          runningMode: 'VIDEO' as const,
          minHandDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5,
        };
        try {
          const lm = await HandLandmarker.createFromOptions(fileset, options);
          this.delegate = 'GPU';
          return lm;
        } catch (gpuErr) {
          console.warn('GPU delegate failed, retrying on CPU', gpuErr);
          options.baseOptions.delegate = 'CPU';
          const lm = await HandLandmarker.createFromOptions(fileset, options);
          this.delegate = 'CPU';
          return lm;
        }
      } catch (err) {
        this.lastError = String((err as Error)?.message ?? err).slice(0, 80);
        console.error('hand tracker failed to load', err);
        return null;
      }
    })();
    return this.landmarkerPromise;
  }

  async start(): Promise<boolean> {
    if (this.status === 'ready') return true;
    this.status = 'requesting';
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 960 }, height: { ideal: 540 }, facingMode: 'user' }, audio: false,
      });
      this.video.srcObject = this.stream;
      await this.video.play().catch(() => {});
    } catch (err) {
      this.status = 'denied';
      this.lastError = (err as Error)?.name ?? 'error';
      return false;
    }
    this.status = 'loading';
    this.landmarker = await this.warmUp();
    if (!this.landmarker) {
      this.status = 'failed';
      this.stream?.getTracks().forEach((t) => t.stop());
      this.stream = null;
      return false;
    }
    this.status = 'ready';
    return true;
  }

  stop() {
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.video.srcObject = null;
    this.landmarker = null;
    this.hands = [];
    this.status = 'idle';
  }

  /** Throttled detection; call every frame. */
  read(nowMs: number) {
    if (!this.landmarker || this.video.readyState < 2) { this.hands = []; return; }
    if (nowMs - this.lastRead < 1000 / INTERACTION.handReadHz) return;
    this.lastRead = nowMs;
    let result;
    try {
      result = this.landmarker.detectForVideo(this.video, nowMs);
    } catch (err) {
      this.hands = [];
      return;
    }
    const hands: HandReading[] = [];
    const landmarksList = result.landmarks ?? [];
    const handedness = result.handedness ?? [];
    for (let i = 0; i < landmarksList.length; i++) {
      const lm = landmarksList[i];
      const label = handedness[i]?.[0]?.categoryName ?? '';
      // MediaPipe assumes a mirrored image; we feed it raw, so the label is flipped
      let isLeft = label === 'Right';
      if (this.swapHands) isLeft = !isLeft;
      hands.push({
        landmarks: lm, isLeft, pinch: computePinch(lm),
        palmX: (lm[0].x + lm[9].x) / 2, palmY: (lm[0].y + lm[9].y) / 2,
      });
    }
    this.hands = hands;
  }

  /** Draw fingertips (and optionally the skeleton) over the small camera window. */
  drawOverlay(showSkeleton: boolean) {
    const ctx = this.overlayCtx;
    const w = 320, h = 240;
    if (this.overlay.width !== w) { this.overlay.width = w; this.overlay.height = h; }
    ctx.clearRect(0, 0, w, h);
    if (!this.active) return;
    // the video is object-fit: cover — map normalised coords through the crop
    const vw = this.video.videoWidth || 4, vh = this.video.videoHeight || 3;
    const scale = Math.max(w / vw, h / vh);
    const dw = vw * scale, dh = vh * scale;
    const ox = (w - dw) / 2, oy = (h - dh) / 2;
    const X = (p: NormalizedLandmark) => ox + p.x * dw;
    const Y = (p: NormalizedLandmark) => oy + p.y * dh;
    for (const hand of this.hands) {
      const color = hand.isLeft ? 'rgba(201,169,110,0.9)' : 'rgba(228,183,176,0.9)';
      if (showSkeleton) {
        ctx.strokeStyle = 'rgba(245,239,230,0.35)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (const [a, b] of CONNECTIONS) { ctx.moveTo(X(hand.landmarks[a]), Y(hand.landmarks[a])); ctx.lineTo(X(hand.landmarks[b]), Y(hand.landmarks[b])); }
        ctx.stroke();
      }
      const thumb = hand.landmarks[4], index = hand.landmarks[8];
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(X(thumb), Y(thumb)); ctx.lineTo(X(index), Y(index)); ctx.stroke();
      ctx.fillStyle = color;
      for (const tip of [thumb, index]) { ctx.beginPath(); ctx.arc(X(tip), Y(tip), 3.5, 0, Math.PI * 2); ctx.fill(); }
    }
  }
}

function computePinch(lm: NormalizedLandmark[]) {
  const thumb = lm[4], index = lm[8], wrist = lm[0], knuckle = lm[9];
  const gap = Math.hypot(thumb.x - index.x, thumb.y - index.y);
  const size = Math.hypot(wrist.x - knuckle.x, wrist.y - knuckle.y);
  if (size < 1e-5) return 0;
  const ratio = gap / size;
  return clamp((ratio - INTERACTION.pinchRatioMin) / (INTERACTION.pinchRatioMax - INTERACTION.pinchRatioMin));
}
