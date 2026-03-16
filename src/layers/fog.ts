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
import { mulberry32 } from "../shared/prng.js";
import { parseHex } from "../shared/color-utils.js";
import { createDefaultProps, smoothstep, bilinearUpscale } from "./shared.js";
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
  { key: "fogLayers", label: "Fog Layers", type: "number", default: 1, min: 1, max: 5, step: 1, group: "depth" },
  { key: "wispDensity", label: "Wisp Density", type: "number", default: 0, min: 0, max: 1, step: 0.05, group: "shape" },
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
  fogLayers: number;
  wispDensity: number;
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
    fogLayers: (properties.fogLayers as number) ?? fp?.fogLayers ?? 1,
    wispDensity: (properties.wispDensity as number) ?? fp?.wispDensity ?? 0,
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

    // Density threshold — lower = more fog
    const threshold = 1 - p.density;

    // Render at 1/4 resolution for performance
    const renderScale = 0.25;
    const rw = Math.max(1, Math.round(width * renderScale));
    const rh = Math.max(1, Math.round(fogHeight * renderScale));

    const imageData = ctx.createImageData(rw, rh);
    const data = imageData.data;

    // Multi-layer fog stacking
    const numLayers = Math.max(1, Math.min(5, p.fogLayers));
    for (let li = 0; li < numLayers; li++) {
      const layerSeed = p.seed + li * 7919;
      // Progressive noise scale: front layers finer, back layers coarser
      const layerT = numLayers > 1 ? li / (numLayers - 1) : 0;
      const effectiveNoiseScale = p.noiseScale * (0.85 + layerT * 0.3);
      // Progressive opacity: deeper layers denser
      const layerOpacity = numLayers > 1
        ? p.opacity * (0.5 + 0.5 * li / (numLayers - 1)) / numLayers
        : p.opacity;
      // Sub-layers distributed vertically within the band
      const layerYOffset = numLayers > 1 ? (li - (numLayers - 1) / 2) * 0.1 : 0;

      const noise = p.warpStrength > 0
        ? createWarpedNoise(layerSeed, p.noiseOctaves, p.warpStrength)
        : createFractalNoise(layerSeed, p.noiseOctaves);

      const patchNoise = p.patchiness > 0
        ? createFractalNoise(layerSeed + 5003, 2, 2.0, 0.5)
        : null;

      for (let ry = 0; ry < rh; ry++) {
        const normalizedY = Math.max(0, Math.min(1, ry / rh + layerYOffset));

        let edgeAlpha = 1;
        if (normalizedY < p.edgeSoftness) {
          edgeAlpha = smoothstep(normalizedY / p.edgeSoftness);
        } else if (normalizedY > 1 - p.edgeSoftness) {
          edgeAlpha = smoothstep((1 - normalizedY) / p.edgeSoftness);
        }

        let typeMult = 1;
        if (p.fogType === "valley") {
          typeMult = 0.6 + 0.4 * normalizedY;
        } else if (p.fogType === "upslope") {
          typeMult = 0.7 + 0.3 * (1 - normalizedY);
        }

        const gr = Math.round(topR + (botR - topR) * normalizedY);
        const gg = Math.round(topG + (botG - topG) * normalizedY);
        const gb = Math.round(topB + (botB - topB) * normalizedY);

        for (let rx = 0; rx < rw; rx++) {
          const normalizedX = rx / rw;
          const nx = normalizedX * effectiveNoiseScale;
          const ny = normalizedY * effectiveNoiseScale;

          let n = noise(nx, ny);

          if (patchNoise && p.patchiness > 0) {
            const patchVal = patchNoise(normalizedX * 1.5, normalizedY * 1.5);
            if (patchVal < p.patchiness * 0.5) {
              n *= patchVal / (p.patchiness * 0.5);
            }
          }

          if (n > threshold) {
            const aboveThreshold = (n - threshold) / (1 - threshold);
            const alpha = Math.min(1, aboveThreshold * 2) * edgeAlpha * layerOpacity * typeMult;

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
    }

    // Bilinear upscale to full resolution
    const fullImageData = ctx.createImageData(width, fogHeight);
    bilinearUpscale(data, rw, rh, fullImageData.data, width, fogHeight);
    ctx.putImageData(fullImageData, bx, fogTopPx);

    // Fog wisps: elliptical tendrils at top/bottom edges of fog band
    if (p.wispDensity > 0) {
      const rng = mulberry32(p.seed + 8819);
      const wispCount = Math.floor(p.wispDensity * 25);
      const bandH = fogHeight;
      const [wr, wg, wb] = [
        Math.round((topR + botR) / 2),
        Math.round((topG + botG) / 2),
        Math.round((topB + botB) / 2),
      ];

      for (let w = 0; w < wispCount; w++) {
        const atTop = rng() > 0.5;
        const anchorX = rng() * width;
        const anchorY = atTop ? fogTopPx : fogBottomPx;
        const extendDir = atTop ? -1 : 1;
        const extendDist = bandH * (0.1 + rng() * 0.2);
        const wispW = 15 + rng() * 40;
        const wispH = extendDist;
        const wispAlpha = p.opacity * (0.15 + rng() * 0.25);

        // Draw elliptical wisp tendril
        ctx.save();
        ctx.globalAlpha = wispAlpha;
        ctx.beginPath();
        ctx.ellipse(
          bx + anchorX,
          anchorY + extendDir * extendDist * 0.5,
          wispW,
          wispH * 0.5,
          0, 0, Math.PI * 2,
        );
        ctx.fillStyle = `rgb(${wr},${wg},${wb})`;
        ctx.fill();
        ctx.restore();
      }
    }
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
