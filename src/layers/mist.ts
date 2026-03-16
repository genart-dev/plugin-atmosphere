/**
 * atmosphere:mist — Mid-level haze bands with parallax stacking.
 *
 * Multiple semi-transparent noise layers at different depth bands.
 * Each band shifts slightly with drift for parallax depth effect.
 * Key difference from fog: mist is horizontal band, fog is terrain-conforming.
 */

import type {
  LayerTypeDefinition,
  LayerPropertySchema,
  LayerProperties,
  ValidationError,
} from "@genart-dev/core";
import { createFractalNoise } from "../shared/noise.js";
import { parseHex } from "../shared/color-utils.js";
import { createDefaultProps, smoothstep } from "./shared.js";
import { getPreset } from "../presets/index.js";
import type { MistPreset } from "../presets/types.js";

const MIST_PROPERTIES: LayerPropertySchema[] = [
  {
    key: "preset",
    label: "Preset",
    type: "select",
    default: "morning-mist",
    group: "preset",
    options: [
      { value: "morning-mist", label: "Morning Mist" },
      { value: "mountain-haze", label: "Mountain Haze" },
      { value: "thick-mist", label: "Thick Mist" },
      { value: "layered-mist", label: "Layered Mist" },
    ],
  },
  { key: "seed", label: "Seed", type: "number", default: 42, min: 0, max: 99999, step: 1, group: "generation" },
  { key: "density", label: "Density", type: "number", default: 0.4, min: 0, max: 1, step: 0.05, group: "shape" },
  { key: "color", label: "Color", type: "color", default: "#E8E8F0", group: "style" },
  { key: "opacity", label: "Opacity", type: "number", default: 0.35, min: 0, max: 1, step: 0.05, group: "style" },
  { key: "bandTop", label: "Band Top", type: "number", default: 0.5, min: 0, max: 1, step: 0.05, group: "layout" },
  { key: "bandBottom", label: "Band Bottom", type: "number", default: 0.8, min: 0, max: 1, step: 0.05, group: "layout" },
  { key: "edgeSoftness", label: "Edge Softness", type: "number", default: 0.3, min: 0.05, max: 0.8, step: 0.05, group: "shape" },
  { key: "noiseScale", label: "Noise Scale", type: "number", default: 3.0, min: 0.5, max: 10, step: 0.5, group: "shape" },
  { key: "noiseOctaves", label: "Noise Octaves", type: "number", default: 3, min: 1, max: 6, step: 1, group: "shape" },
  { key: "driftX", label: "Drift X", type: "number", default: 0.1, min: 0, max: 1, step: 0.05, group: "motion" },
  { key: "driftPhase", label: "Drift Phase", type: "number", default: 0, min: 0, max: 6.28, step: 0.1, group: "motion" },
  { key: "layerCount", label: "Layer Count", type: "number", default: 3, min: 1, max: 8, step: 1, group: "depth" },
  { key: "depthSpread", label: "Depth Spread", type: "number", default: 0.2, min: 0, max: 0.5, step: 0.05, group: "depth" },
  { key: "depthSlot", label: "Depth Slot", type: "number", default: 0.6, min: 0, max: 1, step: 0.05, group: "depth" },
];

interface ResolvedMistProps {
  seed: number;
  density: number;
  color: string;
  opacity: number;
  bandTop: number;
  bandBottom: number;
  edgeSoftness: number;
  noiseScale: number;
  noiseOctaves: number;
  driftX: number;
  driftPhase: number;
  layerCount: number;
  depthSpread: number;
  depthSlot: number;
}

function resolveProps(properties: LayerProperties): ResolvedMistProps {
  const presetId = properties.preset as string | undefined;
  const preset = presetId ? getPreset(presetId) : undefined;
  const mp = preset?.category === "mist" ? (preset as MistPreset) : undefined;

  return {
    seed: (properties.seed as number) ?? 42,
    density: (properties.density as number) ?? mp?.density ?? 0.4,
    color: (properties.color as string) || mp?.color || "#E8E8F0",
    opacity: (properties.opacity as number) ?? mp?.opacity ?? 0.35,
    bandTop: (properties.bandTop as number) ?? mp?.bandTop ?? 0.5,
    bandBottom: (properties.bandBottom as number) ?? mp?.bandBottom ?? 0.8,
    edgeSoftness: (properties.edgeSoftness as number) ?? mp?.edgeSoftness ?? 0.3,
    noiseScale: (properties.noiseScale as number) ?? mp?.noiseScale ?? 3.0,
    noiseOctaves: (properties.noiseOctaves as number) ?? mp?.noiseOctaves ?? 3,
    driftX: (properties.driftX as number) ?? mp?.driftX ?? 0.1,
    driftPhase: (properties.driftPhase as number) ?? mp?.driftPhase ?? 0,
    layerCount: (properties.layerCount as number) ?? mp?.layerCount ?? 3,
    depthSpread: (properties.depthSpread as number) ?? mp?.depthSpread ?? 0.2,
    depthSlot: (properties.depthSlot as number) ?? 0.6,
  };
}

export const mistLayerType: LayerTypeDefinition = {
  typeId: "atmosphere:mist",
  displayName: "Mist",
  icon: "mist",
  category: "draw",
  properties: MIST_PROPERTIES,
  propertyEditorId: "atmosphere:mist-editor",

  createDefault(): LayerProperties {
    return createDefaultProps(MIST_PROPERTIES);
  },

  render(properties, ctx, bounds): void {
    const p = resolveProps(properties);
    const { width, height, x: bx, y: by } = bounds;

    const bandTopPx = Math.round(by + height * p.bandTop);
    const bandBottomPx = Math.round(by + height * p.bandBottom);
    const bandHeight = bandBottomPx - bandTopPx;

    if (bandHeight <= 0) return;

    const [cr, cg, cb] = parseHex(p.color);
    const threshold = 1 - p.density;

    // Render at 1/4 resolution for performance
    const renderScale = 0.25;
    const rw = Math.max(1, Math.round(width * renderScale));
    const rh = Math.max(1, Math.round(bandHeight * renderScale));

    const imageData = ctx.createImageData(rw, rh);
    const data = imageData.data;

    for (let layer = 0; layer < p.layerCount; layer++) {
      const layerSeed = p.seed + layer * 4231;
      const noise = createFractalNoise(layerSeed, p.noiseOctaves, 2.0, 0.5);
      const layerOffset = (layer - p.layerCount / 2) * p.depthSpread;
      const layerOpacity = p.opacity / p.layerCount;

      // Vary noise scale per layer for distinct feature sizes (front = finer, back = coarser)
      const layerT = p.layerCount > 1 ? layer / (p.layerCount - 1) : 0.5;
      const effectiveNoiseScale = p.noiseScale * (0.85 + layerT * 0.3);

      for (let ry = 0; ry < rh; ry++) {
        const normalizedY = ry / rh;

        // Smoothstep edge falloff
        let edgeAlpha = 1;
        if (normalizedY < p.edgeSoftness) {
          edgeAlpha = smoothstep(normalizedY / p.edgeSoftness);
        } else if (normalizedY > 1 - p.edgeSoftness) {
          edgeAlpha = smoothstep((1 - normalizedY) / p.edgeSoftness);
        }

        for (let rx = 0; rx < rw; rx++) {
          const normalizedX = rx / rw;

          const nx = (normalizedX + p.driftX * Math.sin(p.driftPhase + layer) + layerOffset) * effectiveNoiseScale;
          const ny = normalizedY * effectiveNoiseScale + layer * 5;

          const n = noise(nx, ny);

          if (n > threshold) {
            const aboveThreshold = (n - threshold) / (1 - threshold);
            const alpha = Math.min(1, aboveThreshold * 2) * edgeAlpha * layerOpacity;

            if (alpha > 0.01) {
              const idx = (ry * rw + rx) * 4;
              const existingA = data[idx + 3]! / 255;
              const newA = alpha * (1 - existingA);
              const totalA = existingA + newA;

              if (totalA > 0) {
                data[idx] = Math.round((data[idx]! * existingA + cr * newA) / totalA);
                data[idx + 1] = Math.round((data[idx + 1]! * existingA + cg * newA) / totalA);
                data[idx + 2] = Math.round((data[idx + 2]! * existingA + cb * newA) / totalA);
                data[idx + 3] = Math.round(totalA * 255);
              }
            }
          }
        }
      }
    }

    // Scale up to full resolution
    const fullImageData = ctx.createImageData(width, bandHeight);
    const fullData = fullImageData.data;
    for (let fy = 0; fy < bandHeight; fy++) {
      const ry = Math.min(Math.floor((fy / bandHeight) * rh), rh - 1);
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
    ctx.putImageData(fullImageData, bx, bandTopPx);
  },

  validate(properties): ValidationError[] | null {
    const errors: ValidationError[] = [];
    const presetId = properties.preset as string;
    if (presetId && !getPreset(presetId)) {
      errors.push({ property: "preset", message: `Unknown mist preset "${presetId}"` });
    }
    const bandTop = properties.bandTop as number | undefined;
    const bandBottom = properties.bandBottom as number | undefined;
    if (bandTop !== undefined && bandBottom !== undefined && bandTop >= bandBottom) {
      errors.push({ property: "bandTop", message: "bandTop must be less than bandBottom" });
    }
    return errors.length > 0 ? errors : null;
  },
};
