export type RGB = [number, number, number];

export function parseColor(input: unknown): RGB | null {
  if (typeof input !== "string") return null;
  const hex = /^#([0-9a-f]{6})$/i.exec(input.trim());
  if (hex) {
    const n = Number.parseInt(hex[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const rgb = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i.exec(input.trim());
  if (!rgb) return null;
  return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])];
}

export function rgbCss(c: RGB): string {
  return `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;
}

export function mix(a: RGB, b: RGB, t: number): RGB {
  const u = t < 0 ? 0 : t > 1 ? 1 : t;
  return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u];
}

export function lighten(c: RGB, amount: number): RGB {
  return [
    c[0] + (255 - c[0]) * amount,
    c[1] + (255 - c[1]) * amount,
    c[2] + (255 - c[2]) * amount,
  ];
}

export function scaleLightness(c: RGB, factor: number): RGB {
  return [c[0] * factor, c[1] * factor, c[2] * factor];
}
