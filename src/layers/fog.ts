/**
 * atmosphere:fog — Ground-level fog with terrain masking support.
 *
 * Fills valleys, wraps around ridges based on terrain:profile mask (via ADR 083 maskLayerId).
 * Fog types: radiation (calm morning), advection (sea fog), upslope, valley.
 * Renders noise-based density field with vertical falloff and domain warping.
 */

import type {
  LayerTypeDefinition,
  LayerPropertySchema,
  LayerProperties,
  ValidationError,
} from "@genart-dev/core";
import { createFractalNoise, createWarpedNoise } from "../shared/noise.js";
import { parseHex } from "../shared/color-utils.js";
import { createDefaultProps, smoothstep } from "./shared.js";
import { getPreset } from "../presets/index.js";
import type { FogPreset } from "../presets/types.js";

const FOG_PROPERTIES: LayerPropertySchema[] = [
  {
    key: "preset",
    label: "Preset",
    type: "select",
    default: "morning-valley-fog",
    group: "preset",
    options: [
      { value: "morning-valley-fog", label: "Morning Valley Fog" },
      { value: "sea-fog", label: "Sea Fog" },
      { value: "mountain-fog", label: "Mountain Fog" },
      { value: "dense-fog", label: "Dense Fog" },
      { value: "patchy-fog", label: "Patchy Fog" },
    ],
  },
  { key: "seed", label: "Seed", type: "number", default: 42, min: 0, max: 99999, step: 1, group: "generation" },
  {
    key: "fogType",
    label: "Fog Type",
    type: "select",
    default: "radiation",
    group: "type",
    options: [
      { value: "radiation", label: "Radiation (Calm)" },
      { value: "advection", label: "Advection (Sea)" },
      { value: "upslope", label: "Upslope (Mountain)" },
      { value: "valley", label: "Valley" },
    ],
  },
  { key: "density", label: "Density", type: "number", default: 0.6, min: 0, max: 1, step: 0.05, group: "shape" },
  { key: "color", label: "Color", type: "color", default: "#E8E8F0", group: "style" },
  { key: "colorBottom", label: "Color Bottom", type: "color", default: "#D8D8E8", group: "style" },
  { key: "opacity", label: "Opacity", type: "number", default: 0.45, min: 0, max: 1, step: 0.05, group: "style" },
  { key: "fogTop", label: "Fog Top", type: "number", default: 0.4, min: 0, max: 1, step: 0.05, group: "layout" },
  { key: "fogBottom", label: "Fog Bottom", type: "number", default: 0.85, min: 0, max: 1, step: 0.05, group: "layout" },
  { key: "edgeSoftness", label: "Edge Softness", type: "number", default: 0.35, min: 0.05, max: 0.8, step: 0.05, group: "shape" },
  { key: "noiseScale", label: "Noise Scale", type: "number", default: 2.5, min: 0.5, max: 10, step: 0.5, group: "shape" },
  { key: "noiseOctaves", label: "Noise Octaves", type: "number", default: 3, min: 1, max: 6, step: 1, group: "shape" },
  { key: "patchiness", label: "Patchiness", type: "number", default: 0.3, min: 0, max: 1, step: 0.05, group: "shape" },
  { key: "warpStrength", label: "Warp Strength", type: "number", default: 0.2, min: 0, max: 1, step: 0.05, group: "shape" },
  { key: "depthSlot", label: "Depth Slot", type: "number", default: 0.2, min: 0, max: 1, step: 0.05, group: "depth" },
];

interface ResolvedFogProps {
  seed: number;
  fogType: string;
  density: number;
  color: string;
  colorBottom: string;
  opacity: number;
  fogTop: number;
  fogBottom: number;
  edgeSoftness: number;
  noiseScale: number;
  noiseOctaves: number;
  patchiness: number;
  warpStrength: number;
  depthSlot: number;
}

function resolveProps(properties: LayerProperties): ResolvedFogProps {
  const presetId = properties.preset as string | undefined;
  const preset = presetId ? getPreset(presetId) : undefined;
  const fp = preset?.category === "fog" ? (preset as FogPreset) : undefined;

  return {
    seed: (properties.seed as number) ?? 42,
    fogType: (properties.fogType as string) ?? fp?.fogType ?? "radiation",
    density: (properties.density as number) ?? fp?.density ?? 0.6,
    color: (properties.color as string) || fp?.color || "#E8E8F0",
    colorBottom: (properties.colorBottom as string) || fp?.colorBottom || "#D8D8E8",
    opacity: (properties.opacity as number) ?? fp?.opacity ?? 0.45,
    fogTop: (properties.fogTop as number) ?? fp?.fogTop ?? 0.4,
    fogBottom: (properties.fogBottom as number) ?? fp?.fogBottom ?? 0.85,
    edgeSoftness: (properties.edgeSoftness as number) ?? fp?.edgeSoftness ?? 0.35,
    noiseScale: (properties.noiseScale as number) ?? fp?.noiseScale ?? 2.5,
    noiseOctaves: (properties.noiseOctaves as number) ?? fp?.noiseOctaves ?? 3,
    patchiness: (properties.patchiness as number) ?? fp?.patchiness ?? 0.3,
    warpStrength: (properties.warpStrength as number) ?? fp?.warpStrength ?? 0.2,
    depthSlot: (properties.depthSlot as number) ?? 0.2,
  };
}

export const fogLayerType: LayerTypeDefinition = {
  typeId: "atmosphere:fog",
  displayName: "Fog",
  icon: "fog",
  category: "draw",
  properties: FOG_PROPERTIES,
  propertyEditorId: "atmosphere:fog-editor",

  createDefault(): LayerProperties {
    return createDefaultProps(FOG_PROPERTIES);
  },

  render(properties, ctx, bounds): void {
    const p = resolveProps(properties);
    const { width, height, x: bx, y: by } = bounds;

    const fogTopPx = Math.round(by + height * p.fogTop);
    const fogBottomPx = Math.round(by + height * p.fogBottom);
    const fogHeight = fogBottomPx - fogTopPx;

    if (fogHeight <= 0) return;

    const [topR, topG, topB] = parseHex(p.color);
    const [botR, botG, botB] = parseHex(p.colorBottom);

    // Use warped noise for organic fog shapes
    const noise = p.warpStrength > 0
      ? createWarpedNoise(p.seed, p.noiseOctaves, p.warpStrength)
      : createFractalNoise(p.seed, p.noiseOctaves);

    // Patchiness: secondary large-scale noise for gaps
    const patchNoise = p.patchiness > 0
      ? createFractalNoise(p.seed + 5003, 2, 2.0, 0.5)
      : null;

    // Density threshold — lower = more fog
    const threshold = 1 - p.density;

    // Render at 1/4 resolution for performance
    const renderScale = 0.25;
    const rw = Math.max(1, Math.round(width * renderScale));
    const rh = Math.max(1, Math.round(fogHeight * renderScale));

    const imageData = ctx.createImageData(rw, rh);
    const data = imageData.data;

    for (let ry = 0; ry < rh; ry++) {
      const normalizedY = ry / rh;

      // Vertical edge softness (top and bottom fade)
      let edgeAlpha = 1;
      if (normalizedY < p.edgeSoftness) {
        edgeAlpha = smoothstep(normalizedY / p.edgeSoftness);
      } else if (normalizedY > 1 - p.edgeSoftness) {
        edgeAlpha = smoothstep((1 - normalizedY) / p.edgeSoftness);
      }

      // Fog type modifiers: valley fog is denser at bottom, upslope has gradient
      let typeMult = 1;
      if (p.fogType === "valley") {
        typeMult = 0.6 + 0.4 * normalizedY; // denser at bottom
      } else if (p.fogType === "upslope") {
        typeMult = 0.7 + 0.3 * (1 - normalizedY); // denser at top
      }

      // Vertical color gradient
      const gr = Math.round(topR + (botR - topR) * normalizedY);
      const gg = Math.round(topG + (botG - topG) * normalizedY);
      const gb = Math.round(topB + (botB - topB) * normalizedY);

      for (let rx = 0; rx < rw; rx++) {
        const normalizedX = rx / rw;

        const nx = normalizedX * p.noiseScale;
        const ny = normalizedY * p.noiseScale;

        let n = noise(nx, ny);

        // Apply patchiness — large-scale noise gaps
        if (patchNoise && p.patchiness > 0) {
          const patchVal = patchNoise(normalizedX * 1.5, normalizedY * 1.5);
          // patchiness = 1 means large clear gaps; patchVal < patchiness threshold = gap
          if (patchVal < p.patchiness * 0.5) {
            n *= patchVal / (p.patchiness * 0.5); // fade out in patch gaps
          }
        }

        if (n > threshold) {
          const aboveThreshold = (n - threshold) / (1 - threshold);
          const alpha = Math.min(1, aboveThreshold * 2) * edgeAlpha * p.opacity * typeMult;

          if (alpha > 0.01) {
            const idx = (ry * rw + rx) * 4;
            const existingA = data[idx + 3]! / 255;
            const newA = alpha * (1 - existingA);
            const totalA = existingA + newA;

            if (totalA > 0) {
              data[idx] = Math.round((data[idx]! * existingA + gr * newA) / totalA);
              data[idx + 1] = Math.round((data[idx + 1]! * existingA + gg * newA) / totalA);
              data[idx + 2] = Math.round((data[idx + 2]! * existingA + gb * newA) / totalA);
              data[idx + 3] = Math.round(totalA * 255);
            }
          }
        }
      }
    }

    // Scale up to full resolution
    const fullImageData = ctx.createImageData(width, fogHeight);
    const fullData = fullImageData.data;
    for (let fy = 0; fy < fogHeight; fy++) {
      const ry = Math.min(Math.floor((fy / fogHeight) * rh), rh - 1);
      for (let fx = 0; fx < width; fx++) {
        const rx = Math.min(Math.floor((fx / width) * rw), rw - 1);
        const src = (ry * rw + rx) * 4;
        const dst = (fy * width + fx) * 4;
        fullData[dst] = data[src]!;
        fullData[dst + 1] = data[src + 1]!;
        fullData[dst + 2] = data[src + 2]!;
        fullData[dst + 3] = data[src + 3]!;
      }
    }
    ctx.putImageData(fullImageData, bx, fogTopPx);
  },

  validate(properties): ValidationError[] | null {
    const errors: ValidationError[] = [];
    const presetId = properties.preset as string;
    if (presetId && !getPreset(presetId)) {
      errors.push({ property: "preset", message: `Unknown fog preset "${presetId}"` });
    }
    const fogTop = properties.fogTop as number | undefined;
    const fogBottom = properties.fogBottom as number | undefined;
    if (fogTop !== undefined && fogBottom !== undefined && fogTop >= fogBottom) {
      errors.push({ property: "fogTop", message: "fogTop must be less than fogBottom" });
    }
    return errors.length > 0 ? errors : null;
  },
};
