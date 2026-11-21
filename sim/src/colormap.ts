const STOPS: ReadonlyArray<readonly [number, number, number, number]> = [
  [0, 4, 7, 12],
  [0.14, 12, 32, 84],
  [0.32, 8, 110, 142],
  [0.5, 18, 168, 112],
  [0.68, 214, 196, 46],
  [0.84, 244, 132, 40],
  [1, 255, 246, 232],
];

function ramp(t: number): [number, number, number] {
  const x = Math.min(1, Math.max(0, t));
  let upper = STOPS[STOPS.length - 1] ?? [1, 255, 255, 255];
  let lower = STOPS[0] ?? [0, 0, 0, 0];
  for (let i = 1; i < STOPS.length; i += 1) {
    const stop = STOPS[i];
    if (!stop) continue;
    if (x <= stop[0]) {
      upper = stop;
      lower = STOPS[i - 1] ?? stop;
      break;
    }
  }
  const span = upper[0] - lower[0] || 1;
  const mix = (x - lower[0]) / span;
  return [
    Math.round(lower[1] + (upper[1] - lower[1]) * mix),
    Math.round(lower[2] + (upper[2] - lower[2]) * mix),
    Math.round(lower[3] + (upper[3] - lower[3]) * mix),
  ];
}

const LUT = new Uint8ClampedArray(256 * 3);
for (let i = 0; i < 256; i += 1) {
  const [r, g, b] = ramp(i / 255);
  LUT[i * 3] = r;
  LUT[i * 3 + 1] = g;
  LUT[i * 3 + 2] = b;
}

export function colorAt(value: number): [number, number, number] {
  const shown = Math.pow(Math.min(1.4, Math.max(0, value)) / 1.4, 0.7);
  const index = Math.max(0, Math.min(255, Math.round(shown * 255)));
  return [LUT[index * 3] ?? 0, LUT[index * 3 + 1] ?? 0, LUT[index * 3 + 2] ?? 0];
}

export const COLORMAP_CSS = `linear-gradient(90deg, ${STOPS.map(
  (stop) => `rgb(${stop[1]}, ${stop[2]}, ${stop[3]}) ${Math.round(stop[0] * 100)}%`,
).join(", ")})`;
