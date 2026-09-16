export const clamp = (v: number, min = 0, max = 1) => Math.min(max, Math.max(min, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const inverseLerp = (a: number, b: number, v: number) => (a === b ? 0 : clamp((v - a) / (b - a)));
export const remap = (v: number, a: number, b: number, c: number, d: number) => lerp(c, d, inverseLerp(a, b, v));
export const smoothstep = (t: number) => { const x = clamp(t); return x * x * (3 - 2 * x); };
export const degToRad = (d: number) => (d * Math.PI) / 180;

/** A window inside 0..1: returns 0 before `start`, 1 after `end`, eased in between. */
export const window01 = (v: number, start: number, end: number, ease: (t: number) => number = smoothstep) =>
  ease(inverseLerp(start, end, v));

/** Frame-rate independent exponential approach. */
export const damp = (current: number, target: number, seconds: number, dt: number) =>
  current + (target - current) * (1 - Math.exp(-dt / Math.max(1e-4, seconds)));
