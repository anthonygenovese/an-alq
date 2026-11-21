export function formatMhz(mhz: number | null): string {
  if (mhz === null || !Number.isFinite(mhz)) return "—";
  if (mhz >= 1000) {
    const ghz = mhz / 1000;
    return `${ghz.toFixed(ghz >= 10 ? 2 : 3)} GHz`;
  }
  const digits = mhz >= 100 ? 1 : mhz >= 10 ? 2 : 3;
  return `${mhz.toFixed(digits)} MHz`;
}

export function formatUs(us: number | null): string {
  if (us === null || !Number.isFinite(us)) return "—";
  if (us >= 1000) return `${(us / 1000).toFixed(2)} ms`;
  return `${us.toFixed(us >= 10 ? 0 : 1)} µs`;
}

export function formatBandwidth(mhz: number | null): string {
  if (mhz === null || !Number.isFinite(mhz)) return "—";
  if (mhz >= 1) return `${mhz.toFixed(mhz >= 10 ? 0 : 1)} MHz`;
  return `${(mhz * 1000).toFixed(0)} kHz`;
}

export function formatClock(ms: number): string {
  const clamped = Math.max(0, ms);
  return (clamped / 1000).toFixed(2);
}

export function titleCaseToken(value: string): string {
  return value.replaceAll("_", " ");
}
