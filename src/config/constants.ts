/**
 * Every tunable value in one place. Colors are muted on purpose — the bouquet
 * should read as real flowers in warm light, not neon geometry.
 */
export const PALETTE = {
  background: 0x0c0b0a,
  backgroundMid: 0x12100f,
  backgroundWarm: 0x181311,

  petals: {
    blush: 0xe9c0b6,
    dustyRose: 0xd39a95,
    cream: 0xf3e6d3,
    warmWhite: 0xf6efe4,
    mutedCoral: 0xe9b3a0,
    paleRose: 0xedcfc7,
  },
  gold: 0xc9a96e,
  goldDeep: 0xa9884f,
  foliage: 0x2c4235,
  foliageLight: 0x4a6b53,
  stem: 0x3a5443,
  daisyCenter: 0xd8b25b,
  paper: 0xefe4d0,
  paperShadow: 0xd6c8ae,
  ivory: 0xf5efe6,
} as const;

export const CAMERA = {
  fov: 38,
  near: 0.1,
  far: 60,
  // slightly above the bouquet, looking gently down
  introPosition: [0.0, 1.85, 7.2] as const,
  introTarget: [0.0, 0.8, 0.0] as const,
  // the final pose: a touch closer and lower, as if it's being handed over
  finalPosition: [0.0, 1.2, 6.05] as const,
  finalTarget: [0.0, 1.0, 0.0] as const,
  driftAmplitude: 0.08,
  driftSpeed: 0.11,
  orbit: {
    minDistance: 3.8,
    maxDistance: 10.5,
    minPolar: 0.55,
    maxPolar: 1.72,
    minAzimuth: -0.95,
    maxAzimuth: 0.95,
  },
} as const;

export const INTERACTION = {
  // pinch is measured relative to hand size so distance to camera doesn't matter
  pinchRatioMin: 0.32,
  pinchRatioMax: 1.45,
  growFullAt: 0.82,
  bloomFullAt: 0.88,
  smoothingSeconds: 0.16,
  handReadHz: 30,
  swapHands: false,
  // once both values pass this, the bouquet is considered given
  completeThreshold: 0.86,
  // if we only ever see one hand, it drives grow then bloom in sequence
  singleHandAfterSeconds: 1.6,
} as const;

export const TIMING = {
  whisperInSeconds: 1.5,
  whisperOutSeconds: 8.5,
  instructionsInSeconds: 8.0,
  instructionsOutSeconds: 40,
  autoPresentation: {
    growSeconds: 9,
    bloomSeconds: 8,
    overlapSeconds: 2.5,
  },
  reveal: {
    settleSeconds: 1.6,
    nameAt: 1.8,
    sorryAt: 4.0,
    handAt: 6.6,
    finalAt: 9.6,
  },
} as const;

export const BOUQUET = {
  bloomStagger: 0.42,
  swayAmplitude: 0.022,
  swaySpeedMin: 0.35,
  swaySpeedMax: 0.6,
} as const;

export const POST = {
  bloomStrength: 0.2,
  bloomRadius: 0.8,
  bloomThreshold: 0.86,
  vignetteDarkness: 0.55,
  grainAmount: 0.028,
  exposure: 1.02,
} as const;

export const PARTICLES = {
  desktopCount: 420,
  mobileCount: 180,
  spread: [5.5, 4.6, 5.0] as const,
  center: [0, 1.0, 0] as const,
  baseSpeed: 0.07,
  size: 0.15,
} as const;

export const MEDIAPIPE = {
  wasmPath: './mediapipe/wasm',
  modelPath: './models/hand_landmarker.task',
} as const;
