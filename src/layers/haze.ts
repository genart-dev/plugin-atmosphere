/**
 * atmosphere:haze — Distance-based atmospheric perspective.
 *
 * Desaturates and lightens toward a haze color, simulating atmospheric depth.
 * 4 gradient directions: bottom-up, top-down, center-out, uniform.
 * Noise-modulated gradient for organic edges.
 * Ported from terrain:haze concept.
 */

import type {
  LayerTypeDefinition,
  LayerPropertySchema,
  LayerProperties,
  ValidationError,
} from "@genart-dev/core";
import { createFractalNoise } from "../shared/noise.js";
import { parseHex } from "../shared/color-utils.js";
import { createDefaultProps, smoothstep, bilinearUpscale } from "./shared.js";
import { getPreset } from "../presets/index.js";
import type { HazePreset } from "../presets/types.js";

const HAZE_PROPERTIES: LayerPropertySchema[] = [
  {
    key: "preset",
    label: "Preset",
    type: "select",
    default: "light-haze",
    group: "preset",
    options: [
      { value: "light-haze", label: "Light Haze" },
      { value: "golden-haze", label: "Golden Haze" },
      { value: "cool-mist-haze", label: "Cool Mist Haze" },
      { value: "heat-haze", label: "Heat Haze" },
      { value: "ink-wash-haze", label: "Ink Wash Haze" },
      { value: "twilight-haze", label: "Twilight Haze" },
    ],
  },
  { key: "seed", label: "Seed", type: "number", default: 42, min: 0, max: 99999, step: 1, group: "generation" },
  { key: "color", label: "Haze Color", type: "color", default: "#D8E0EC", group: "style" },
  { key: "opacity", label: "Opacity", type: "number", default: 0.25, min: 0, max: 1, step: 0.05, group: "style" },
  { key: "yPosition", label: "Y Position", type: "number", default: 0.3, min: 0, max: 1, step: 0.05, group: "layout" },
  { key: "height", label: "Height", type: "number", default: 0.5, min: 0.1, max: 1, step: 0.05, group: "layout" },
  {
    key: "gradientDirection",
    label: "Gradient Direction",
    type: "select",
    default: "bottom-up",
    group: "shape",
    options: [
      { value: "bottom-up", label: "Bottom Up" },
      { value: "top-down", label: "Top Down" },
      { value: "center-out", label: "Center Out" },
      { value: "uniform", label: "Uniform" },
    ],
  },
  { key: "noiseAmount", label: "Noise Amount", type: "number", default: 0.2, min: 0, max: 1, step: 0.05, group: "shape" },
  { key: "depthSlot", label: "Depth Slot", type: "number", default: 0.4, min: 0, max: 1, step: 0.05, group: "depth" },
];

interface ResolvedHazeProps {
  seed: number;
  color: string;
  opacity: number;
  yPosition: number;
  height: number;
  gradientDirection: string;
  noiseAmount: number;
  depthSlot: number;
}

function resolveProps(properties: LayerProperties): ResolvedHazeProps {
  const presetId = properties.preset as string | undefined;
  const preset = presetId ? getPreset(presetId) : undefined;
  const hp = preset?.category === "haze" ? (preset as HazePreset) : undefined;

  return {
    seed: (properties.seed as number) ?? 42,
    color: (properties.color as string) || hp?.color || "#D8E0EC",
    opacity: (properties.opacity as number) ?? hp?.opacity ?? 0.25,
    yPosition: (properties.yPosition as number) ?? hp?.yPosition ?? 0.3,
    height: (properties.height as number) ?? hp?.height ?? 0.5,
    gradientDirection: (properties.gradientDirection as string) ?? hp?.gradientDirection ?? "bottom-up",
    noiseAmount: (properties.noiseAmount as number) ?? hp?.noiseAmount ?? 0.2,
    depthSlot: (properties.depthSlot as number) ?? 0.4,
  };
}

/** Compute gradient intensity 0-1 based on direction. */
function gradientAt(ny: number, direction: string): number {
  switch (direction) {
    case "bottom-up": return ny; // stronger toward bottom
    case "top-down": return 1 - ny; // stronger toward top
    case "center-out": return 1 - Math.abs(ny - 0.5) * 2; // strongest in middle
    case "uniform": return 1;
    default: return ny;
  }
}

export const hazeLayerType: LayerTypeDefinition = {
  typeId: "atmosphere:haze",
  displayName: "Haze",
  icon: "haze",
  category: "draw",
  properties: HAZE_PROPERTIES,
  propertyEditorId: "atmosphere:haze-editor",

  createDefault(): LayerProperties {
    return createDefaultProps(HAZE_PROPERTIES);
  },

  render(properties, ctx, bounds): void {
    const p = resolveProps(properties);
    const { width, height, x: bx, y: by } = bounds;

    const hazeTopPx = Math.round(by + height * p.yPosition);
    const hazeH = Math.round(height * p.height);
    if (hazeH <= 0) return;

    const [hr, hg, hb] = parseHex(p.color);

    const noise = p.noiseAmount > 0
      ? createFractalNoise(p.seed, 3, 2.0, 0.5)
      : null;

    // Render at 1/4 resolution
    const renderScale = 0.25;
    const rw = Math.max(1, Math.round(width * renderScale));
    const rh = Math.max(1, Math.round(hazeH * renderScale));

    const imageData = ctx.createImageData(rw, rh);
    const data = imageData.data;

    for (let ry = 0; ry < rh; ry++) {
      const ny = ry / rh;
      // Edge fade at top and bottom of haze band
      let edgeFade = 1;
      if (ny < 0.15) edgeFade = smoothstep(ny / 0.15);
      else if (ny > 0.85) edgeFade = smoothstep((1 - ny) / 0.15);

      const grad = gradientAt(ny, p.gradientDirection);

      for (let rx = 0; rx < rw; rx++) {
        const nx = rx / rw;

        let intensity = grad;

        // Noise modulation for organic edges
        if (noise && p.noiseAmount > 0) {
          const n = noise(nx * 3, ny * 3);
          intensity *= 1 - p.noiseAmount + n * p.noiseAmount;
        }

        const alpha = intensity * edgeFade * p.opacity;
        if (alpha > 0.01) {
          const idx = (ry * rw + rx) * 4;
          data[idx] = hr;
          data[idx + 1] = hg;
          data[idx + 2] = hb;
          data[idx + 3] = Math.round(alpha * 255);
        }
      }
    }

    // Bilinear upscale to full resolution
    const fullImageData = ctx.createImageData(width, hazeH);
    bilinearUpscale(data, rw, rh, fullImageData.data, width, hazeH);
    ctx.putImageData(fullImageData, bx, hazeTopPx);
  },

  validate(properties): ValidationError[] | null {
    const errors: ValidationError[] = [];
    const presetId = properties.preset as string;
    if (presetId && !getPreset(presetId)) {
      errors.push({ property: "preset", message: `Unknown haze preset "${presetId}"` });
    }
    return errors.length > 0 ? errors : null;
  },
};
