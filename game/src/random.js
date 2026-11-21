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

/** n distinct elements from an array, in random order (a partial Fisher-Yates).
 * The VIP job draws one client name this way, so the same client never books
 * twice in a row; roadblocks draw their cone jitter from the same idea. */
export function sample(random, array, n) {
  const out = array.slice();
  const take = Math.min(n, out.length);
  for (let i = 0; i < take; i += 1) {
    const j = i + Math.floor(random() * (out.length - i));
    const tmp = out[i];
    out[i] = out[j];
    out[j] = tmp;
  }
  return out.slice(0, take);
}

/** An approximately normal value (mean 0, spread ~1): the sum of three uniforms,
 * centred. Used for small organic jitter — cone placement, fare variation — where
 * a flat uniform would look too even. */
export function gauss(random) {
  return (random() + random() + random() - 1.5) * 2;
}

/** A seed from any string, so a named seed (?seed=kota-neon) always builds the
 * same city: a tiny FNV-1a hash, folded into the mulberry32 range. */
export function seedFromString(text) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}
