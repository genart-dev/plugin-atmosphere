import type { LayerPropertySchema, LayerProperties } from "@genart-dev/core";

/** Create default properties from a schema array. */
export function createDefaultProps(properties: LayerPropertySchema[]): LayerProperties {
  const props: LayerProperties = {};
  for (const schema of properties) {
    props[schema.key] = schema.default;
  }
  return props;
}

/** Smoothstep interpolation t in [0,1]. */
export function smoothstep(t: number): number {
  const c = Math.max(0, Math.min(1, t));
  return c * c * (3 - 2 * c);
}

/** Smootherstep (C2 continuous) interpolation t in [0,1]. */
export function smootherstep(t: number): number {
  const c = Math.max(0, Math.min(1, t));
  return c * c * c * (c * (c * 6 - 15) + 10);
}

/**
 * Bilinear upscale from src buffer to dst buffer.
 * Both are RGBA Uint8ClampedArrays. Replaces nearest-neighbor scaling.
 */
export function bilinearUpscale(
  src: Uint8ClampedArray,
  srcW: number,
  srcH: number,
  dst: Uint8ClampedArray,
  dstW: number,
  dstH: number,
): void {
  for (let fy = 0; fy < dstH; fy++) {
    const srcYf = (fy / dstH) * srcH - 0.5;
    const sy0 = Math.max(0, Math.floor(srcYf));
    const sy1 = Math.min(srcH - 1, sy0 + 1);
    const yt = srcYf - sy0;

    for (let fx = 0; fx < dstW; fx++) {
      const srcXf = (fx / dstW) * srcW - 0.5;
      const sx0 = Math.max(0, Math.floor(srcXf));
      const sx1 = Math.min(srcW - 1, sx0 + 1);
      const xt = srcXf - sx0;

      const i00 = (sy0 * srcW + sx0) * 4;
      const i10 = (sy0 * srcW + sx1) * 4;
      const i01 = (sy1 * srcW + sx0) * 4;
      const i11 = (sy1 * srcW + sx1) * 4;
      const dstIdx = (fy * dstW + fx) * 4;

      for (let c = 0; c < 4; c++) {
        const top = src[i00 + c]! * (1 - xt) + src[i10 + c]! * xt;
        const bot = src[i01 + c]! * (1 - xt) + src[i11 + c]! * xt;
        dst[dstIdx + c] = Math.round(top * (1 - yt) + bot * yt);
      }
    }
  }
}
