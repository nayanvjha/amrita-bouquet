/** Deterministic PRNG (mulberry32) so the arrangement is the same every visit. */
export function createRandom(seed: number) {
  let state = seed >>> 0;
  const next = () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    range: (min: number, max: number) => min + (max - min) * next(),
    sign: () => (next() < 0.5 ? -1 : 1),
    pick: <T>(items: readonly T[]) => items[Math.floor(next() * items.length)],
  };
}
export type Random = ReturnType<typeof createRandom>;
