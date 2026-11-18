// A small seeded random number generator (mulberry32): the same seed gives the same city,
// the same traffic and the same game, which is what makes the screenshot scenes repeatable.

export function createRandom(seed) {
  let a = seed | 0;
  return function random() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Pick one element of an array with the seeded random. */
export function pick(random, array) {
  return array[Math.floor(random() * array.length)];
}

/** A number between min (inclusive) and max (exclusive). */
export function range(random, min, max) {
  return min + random() * (max - min);
}

/** True with probability p (0..1): a seeded coin flip for chance events. */
export function chance(random, p) {
  return random() < p;
}

/** A shuffled copy of an array (Fisher-Yates), leaving the original untouched.
 * Useful when a scene needs its pick-up spots in a fresh order every seed. */
export function shuffle(random, array) {
  const out = array.slice();
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    const tmp = out[i];
    out[i] = out[j];
    out[j] = tmp;
  }
  return out;
}

/** A whole number between min and max, both inclusive. */
export function int(random, min, max) {
  return min + Math.floor(random() * (max - min + 1));
}

/** One entry from a weighted table: entries are [value, weight] pairs, and the
 * pick is proportional to weight. A seeded way to say "usually a car, sometimes
 * a bike" without hard-coding the odds at every call site. */
export function weightedPick(random, entries) {
  let total = 0;
  for (const [, weight] of entries) total += weight;
  let roll = random() * total;
  for (const [value, weight] of entries) {
    roll -= weight;
    if (roll <= 0) return value;
  }
  return entries[entries.length - 1][0];
}
