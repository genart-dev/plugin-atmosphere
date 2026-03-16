/** Parse a hex color (#RGB or #RRGGBB) to [r, g, b]. */
export function parseHex(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  if (h.length === 3) {
    return [
      parseInt(h[0]! + h[0]!, 16),
      parseInt(h[1]! + h[1]!, 16),
      parseInt(h[2]! + h[2]!, 16),
    ];
  }
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

/** Convert [r,g,b] to hex string. */
export function toHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((c) => Math.max(0, Math.min(255, Math.round(c))).toString(16).padStart(2, "0")).join("")}`;
}

/** Linearly interpolate between two hex colors. t in [0,1]. */
export function lerpColor(a: string, b: string, t: number): string {
  const [ar, ag, ab] = parseHex(a);
  const [br, bg, bb] = parseHex(b);
  return toHex(
    Math.round(ar + (br - ar) * t),
    Math.round(ag + (bg - ag) * t),
    Math.round(ab + (bb - ab) * t),
  );
}

/** Vary a hex color by mixing a random amount toward white or black. */
export function varyColor(hex: string, variation: number, rng: () => number): string {
  const [r, g, b] = parseHex(hex);
  const shift = (rng() - 0.5) * 2 * variation * 255;
  return toHex(r + shift, g + shift, b + shift);
}
