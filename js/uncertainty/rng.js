export function mulberry32(seed) {
  let a = seed >>> 0;

  return function () {
    a = (a + 0x6d2b79f5) >>> 0;

    let t = a;

    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);

    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function normal(rng, mean, sd) {
  const u = 1 - rng();
  const v = rng();

  return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export function triangular(rng, min, mode, max) {
  const u = rng();
  const c = (mode - min) / (max - min);

  return u < c
    ? min + Math.sqrt(u * (max - min) * (mode - min))
    : max - Math.sqrt((1 - u) * (max - min) * (max - mode));
}
