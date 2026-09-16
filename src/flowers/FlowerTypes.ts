import { degToRad } from '../utils/math';
import type { PetalShape, PetalColorProfile } from './Petal';

export type FlowerKind = 'rose' | 'tulip' | 'daisy' | 'babysbreath';

/**
 * A whorl is one ring of petals. Each whorl blooms inside its own window of
 * the flower's local bloom (0..1), so a rose opens from the outside in and a
 * daisy unfolds in one gentle wave.
 */
export interface WhorlDefinition {
  count: number;
  /** distance of the petal base from the flower axis */
  radius: number;
  /** vertical offset of the petal base */
  height: number;
  /** petal tilt away from the axis, degrees */
  tiltBud: number;
  tiltOpen: number;
  /** the whole ring rotates slightly as it opens (corolla spin), degrees */
  spinOpen: number;
  /** [start, end] of this whorl's opening inside the flower's local bloom */
  window: [number, number];
  bud: PetalShape;
  open: PetalShape;
  /** petal scale bud -> open */
  scaleBud: number;
  scaleOpen: number;
  /** per-petal randomness (radians / fraction) */
  jitterTilt: number;
  jitterAzimuth: number;
  jitterScale: number;
  lengthSegments: number;
  widthSegments: number;
  colors: PetalColorProfile;
  /** brightness multiplier for the whole whorl (inner whorls sit in shadow) */
  shade: number;
}

export interface CenterDefinition {
  kind: 'disc' | 'bud' | 'none';
  radius: number;
  height: number;
  color: number;
}

export interface FlowerTypeDefinition {
  kind: FlowerKind;
  whorls: WhorlDefinition[];
  center: CenterDefinition;
  /** overall head scale multiplier */
  headScale: number;
  /** head scale at bud -> open (buds are smaller and tighter) */
  swellBud: number;
  /** sepal ring under the head */
  sepals: { count: number; length: number; width: number; tiltOpen: number } | null;
}

const shape = (s: Partial<PetalShape>): PetalShape => ({
  length: 0.3, width: 0.2, widthPeak: 0.55, tipPoint: 0.2,
  cup: 0.5, curl: 0.2, curlExponent: 2.2, ripple: 0.004, rippleFrequency: 2.5, twist: 0,
  ...s,
});

const roseColors: PetalColorProfile = { base: [0.9, 0.72, 0.68], edge: [1.0, 0.985, 0.975], baseReach: 0.42, veins: 0.03 };
const tulipColors: PetalColorProfile = { base: [0.96, 0.86, 0.8], edge: [1.03, 1.0, 0.98], baseReach: 0.3, veins: 0.05 };
const daisyColors: PetalColorProfile = { base: [0.96, 0.9, 0.78], edge: [1.0, 1.0, 1.0], baseReach: 0.25, veins: 0.05 };

/** A garden rose: four whorls, tight cupped centre, outer petals rolling back. */
export const ROSE: FlowerTypeDefinition = {
  kind: 'rose',
  headScale: 1,
  swellBud: 0.62,
  center: { kind: 'bud', radius: 0.05, height: 0.05, color: 0xe6bcb4 },
  sepals: { count: 5, length: 0.2, width: 0.07, tiltOpen: 95 },
  whorls: [
    { // innermost, still furled at full bloom
      count: 5, radius: 0.028, height: 0.02, tiltBud: 2, tiltOpen: 18, spinOpen: 18, window: [0.55, 1.0],
      bud: shape({ length: 0.2, width: 0.17, cup: 1.05, curl: -0.55, curlExponent: 1.6, widthPeak: 0.6, tipPoint: 0.05 }),
      open: shape({ length: 0.24, width: 0.2, cup: 0.9, curl: -0.15, curlExponent: 1.8, widthPeak: 0.6, tipPoint: 0.05, twist: 0.12 }),
      scaleBud: 0.85, scaleOpen: 1, jitterTilt: 0.06, jitterAzimuth: 0.1, jitterScale: 0.06,
      lengthSegments: 12, widthSegments: 8, colors: roseColors, shade: 0.84,
    },
    {
      count: 7, radius: 0.05, height: 0.0, tiltBud: 4, tiltOpen: 38, spinOpen: 14, window: [0.38, 0.86],
      bud: shape({ length: 0.24, width: 0.21, cup: 1.0, curl: -0.5, curlExponent: 1.6, widthPeak: 0.62, tipPoint: 0.05 }),
      open: shape({ length: 0.29, width: 0.26, cup: 0.8, curl: 0.35, curlExponent: 2.4, widthPeak: 0.6, tipPoint: 0.05, twist: -0.1 }),
      scaleBud: 0.9, scaleOpen: 1, jitterTilt: 0.08, jitterAzimuth: 0.12, jitterScale: 0.07,
      lengthSegments: 14, widthSegments: 10, colors: roseColors, shade: 0.86,
    },
    {
      count: 9, radius: 0.07, height: -0.02, tiltBud: 6, tiltOpen: 54, spinOpen: 10, window: [0.2, 0.68],
      bud: shape({ length: 0.27, width: 0.24, cup: 0.95, curl: -0.4, curlExponent: 1.7, widthPeak: 0.6, tipPoint: 0.05 }),
      open: shape({ length: 0.3, width: 0.28, cup: 0.7, curl: 0.85, curlExponent: 2.6, widthPeak: 0.55, tipPoint: 0.05, ripple: 0.006, twist: 0.08 }),
      scaleBud: 0.92, scaleOpen: 1, jitterTilt: 0.09, jitterAzimuth: 0.12, jitterScale: 0.08,
      lengthSegments: 14, widthSegments: 10, colors: roseColors, shade: 0.96,
    },
    {
      count: 11, radius: 0.085, height: -0.045, tiltBud: 8, tiltOpen: 66, spinOpen: 6, window: [0.05, 0.5],
      bud: shape({ length: 0.28, width: 0.26, cup: 0.9, curl: -0.3, curlExponent: 1.8, widthPeak: 0.58, tipPoint: 0.05 }),
      open: shape({ length: 0.31, width: 0.3, cup: 0.55, curl: 1.2, curlExponent: 2.8, widthPeak: 0.5, tipPoint: 0.05, ripple: 0.008, twist: -0.08 }),
      scaleBud: 0.95, scaleOpen: 1, jitterTilt: 0.1, jitterAzimuth: 0.14, jitterScale: 0.08,
      lengthSegments: 14, widthSegments: 10, colors: roseColors, shade: 1.0,
    },
  ],
};

/** A tulip: two whorls of three, cupped, opening to a soft goblet. */
export const TULIP: FlowerTypeDefinition = {
  kind: 'tulip',
  headScale: 1,
  swellBud: 0.7,
  center: { kind: 'none', radius: 0, height: 0, color: 0 },
  sepals: null,
  whorls: [
    {
      count: 3, radius: 0.03, height: 0.0, tiltBud: 3, tiltOpen: 12, spinOpen: 8, window: [0.25, 0.9],
      bud: shape({ length: 0.34, width: 0.2, cup: 1.1, curl: -0.35, curlExponent: 1.5, widthPeak: 0.5, tipPoint: 0.25 }),
      open: shape({ length: 0.38, width: 0.3, cup: 1.25, curl: 0.15, curlExponent: 2.6, widthPeak: 0.5, tipPoint: 0.2, twist: 0.05 }),
      scaleBud: 0.92, scaleOpen: 1, jitterTilt: 0.05, jitterAzimuth: 0.05, jitterScale: 0.04,
      lengthSegments: 16, widthSegments: 10, colors: tulipColors, shade: 0.92,
    },
    {
      count: 3, radius: 0.045, height: -0.02, tiltBud: 5, tiltOpen: 20, spinOpen: 4, window: [0.1, 0.72],
      bud: shape({ length: 0.36, width: 0.22, cup: 1.05, curl: -0.3, curlExponent: 1.5, widthPeak: 0.5, tipPoint: 0.25 }),
      open: shape({ length: 0.4, width: 0.32, cup: 1.2, curl: 0.35, curlExponent: 2.6, widthPeak: 0.48, tipPoint: 0.2, twist: -0.05 }),
      scaleBud: 0.95, scaleOpen: 1, jitterTilt: 0.05, jitterAzimuth: 0.05, jitterScale: 0.04,
      lengthSegments: 16, widthSegments: 10, colors: tulipColors, shade: 1.0,
    },
  ],
};

/** A daisy: many slim petals folding flat around a golden disc. */
export const DAISY: FlowerTypeDefinition = {
  kind: 'daisy',
  headScale: 0.78,
  swellBud: 0.7,
  center: { kind: 'disc', radius: 0.075, height: 0.02, color: 0xd8b25b },
  sepals: { count: 8, length: 0.11, width: 0.045, tiltOpen: 100 },
  whorls: [
    {
      count: 17, radius: 0.06, height: 0.0, tiltBud: 8, tiltOpen: 82, spinOpen: 5, window: [0.1, 0.8],
      bud: shape({ length: 0.2, width: 0.055, cup: 0.7, curl: -0.6, curlExponent: 1.4, widthPeak: 0.5, tipPoint: 0.3 }),
      open: shape({ length: 0.25, width: 0.062, cup: 0.35, curl: 0.22, curlExponent: 2.2, widthPeak: 0.5, tipPoint: 0.3, ripple: 0.002 }),
      scaleBud: 0.9, scaleOpen: 1, jitterTilt: 0.07, jitterAzimuth: 0.06, jitterScale: 0.08,
      lengthSegments: 8, widthSegments: 4, colors: daisyColors, shade: 1.0,
    },
    {
      count: 14, radius: 0.052, height: 0.012, tiltBud: 6, tiltOpen: 72, spinOpen: 12, window: [0.25, 0.95],
      bud: shape({ length: 0.18, width: 0.05, cup: 0.7, curl: -0.6, curlExponent: 1.4, widthPeak: 0.5, tipPoint: 0.3 }),
      open: shape({ length: 0.23, width: 0.058, cup: 0.35, curl: 0.15, curlExponent: 2.2, widthPeak: 0.5, tipPoint: 0.3 }),
      scaleBud: 0.9, scaleOpen: 1, jitterTilt: 0.07, jitterAzimuth: 0.06, jitterScale: 0.08,
      lengthSegments: 8, widthSegments: 4, colors: daisyColors, shade: 0.94,
    },
  ],
};

export const FLOWER_TYPES: Record<Exclude<FlowerKind, 'babysbreath'>, FlowerTypeDefinition> = {
  rose: ROSE, tulip: TULIP, daisy: DAISY,
};

export const tiltRad = (deg: number) => degToRad(deg);
