/**
 * atmosphere:clouds — Sky-level cloud formations.
 *
 * 3 rendering algorithms:
 * - "discrete": Individual cloud bodies with noise-displaced boundaries (cumulus, cumulonimbus)
 * - "threshold": Noise field with threshold for continuous coverage (stratus, stratocumulus)
 * - "streak": Directional wispy streaks (cirrus)
 *
 * Lighting model: sunAngle, sunElevation, self-shadowing, highlight on sun-facing edges.
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
import { createDefaultProps, smoothstep } from "./shared.js";
import { getPreset } from "../presets/index.js";
import type { CloudPreset } from "../presets/types.js";

const CLOUD_PROPERTIES: LayerPropertySchema[] = [
  {
    key: "preset",
    label: "Preset",
    type: "select",
    default: "fair-weather-cumulus",
    group: "preset",
    options: [
      { value: "fair-weather-cumulus", label: "Fair Weather Cumulus" },
      { value: "towering-cumulus", label: "Towering Cumulus" },
      { value: "overcast-stratus", label: "Overcast Stratus" },
      { value: "stratocumulus-field", label: "Stratocumulus Field" },
      { value: "wispy-cirrus", label: "Wispy Cirrus" },
      { value: "sunset-cumulus", label: "Sunset Cumulus" },
      { value: "storm-clouds", label: "Storm Clouds" },
    ],
  },
  { key: "seed", label: "Seed", type: "number", default: 42, min: 0, max: 99999, step: 1, group: "generation" },
  {
    key: "cloudType",
    label: "Cloud Type",
    type: "select",
    default: "cumulus",
    group: "type",
    options: [
      { value: "cumulus", label: "Cumulus" },
      { value: "stratus", label: "Stratus" },
      { value: "cirrus", label: "Cirrus" },
      { value: "stratocumulus", label: "Stratocumulus" },
      { value: "cumulonimbus", label: "Cumulonimbus" },
    ],
  },
  {
    key: "algorithm",
    label: "Algorithm",
    type: "select",
    default: "discrete",
    group: "type",
    options: [
      { value: "discrete", label: "Discrete Placement" },
      { value: "threshold", label: "Noise Threshold" },
      { value: "streak", label: "Streak / Wispy" },
    ],
  },
  { key: "coverage", label: "Coverage", type: "number", default: 0.3, min: 0, max: 1, step: 0.05, group: "shape" },
  { key: "altitude", label: "Altitude", type: "number", default: 0.15, min: 0, max: 0.5, step: 0.05, group: "layout" },
  { key: "scale", label: "Scale", type: "number", default: 1.0, min: 0.3, max: 3.0, step: 0.1, group: "shape" },
  { key: "cloudCount", label: "Cloud Count", type: "number", default: 5, min: 1, max: 20, step: 1, group: "shape" },
  { key: "edgeComplexity", label: "Edge Complexity", type: "number", default: 0.6, min: 0, max: 1, step: 0.05, group: "shape" },
  { key: "turbulence", label: "Turbulence", type: "number", default: 0.3, min: 0, max: 1, step: 0.05, group: "shape" },
  { key: "cloudColor", label: "Cloud Color", type: "color", default: "#FFFFFF", group: "style" },
  { key: "shadowColor", label: "Shadow Color", type: "color", default: "#B0B8C8", group: "style" },
  { key: "highlightColor", label: "Highlight Color", type: "color", default: "#FFFFFF", group: "style" },
  { key: "opacity", label: "Opacity", type: "number", default: 0.9, min: 0, max: 1, step: 0.05, group: "style" },
  { key: "sunAngle", label: "Sun Angle", type: "number", default: 135, min: 0, max: 360, step: 5, group: "lighting" },
  { key: "sunElevation", label: "Sun Elevation", type: "number", default: 0.6, min: 0, max: 1, step: 0.05, group: "lighting" },
  { key: "depthSlot", label: "Depth Slot", type: "number", default: 1.0, min: 0, max: 1, step: 0.05, group: "depth" },
];

interface ResolvedCloudProps {
  seed: number;
  cloudType: string;
  algorithm: string;
  coverage: number;
  altitude: number;
  scale: number;
  cloudCount: number;
  edgeComplexity: number;
  turbulence: number;
  cloudColor: string;
  shadowColor: string;
  highlightColor: string;
  opacity: number;
  sunAngle: number;
  sunElevation: number;
  depthSlot: number;
}

function resolveProps(properties: LayerProperties): ResolvedCloudProps {
  const presetId = properties.preset as string | undefined;
  const preset = presetId ? getPreset(presetId) : undefined;
  const cp = preset?.category === "clouds" ? (preset as CloudPreset) : undefined;

  return {
    seed: (properties.seed as number) ?? 42,
    cloudType: (properties.cloudType as string) ?? cp?.cloudType ?? "cumulus",
    algorithm: (properties.algorithm as string) ?? cp?.algorithm ?? "discrete",
    coverage: (properties.coverage as number) ?? cp?.coverage ?? 0.3,
    altitude: (properties.altitude as number) ?? cp?.altitude ?? 0.15,
    scale: (properties.scale as number) ?? cp?.scale ?? 1.0,
    cloudCount: (properties.cloudCount as number) ?? cp?.cloudCount ?? 5,
    edgeComplexity: (properties.edgeComplexity as number) ?? cp?.edgeComplexity ?? 0.6,
    turbulence: (properties.turbulence as number) ?? cp?.turbulence ?? 0.3,
    cloudColor: (properties.cloudColor as string) || cp?.cloudColor || "#FFFFFF",
    shadowColor: (properties.shadowColor as string) || cp?.shadowColor || "#B0B8C8",
    highlightColor: (properties.highlightColor as string) || cp?.highlightColor || "#FFFFFF",
    opacity: (properties.opacity as number) ?? cp?.opacity ?? 0.9,
    sunAngle: (properties.sunAngle as number) ?? cp?.sunAngle ?? 135,
    sunElevation: (properties.sunElevation as number) ?? cp?.sunElevation ?? 0.6,
    depthSlot: (properties.depthSlot as number) ?? 1.0,
  };
}

/** Cloud body placement for discrete algorithm. */
interface CloudBody {
  cx: number; // center X (0-1)
  cy: number; // center Y (0-1)
  rx: number; // radius X
  ry: number; // radius Y
}

/** Generate cloud body placements using Poisson-like seeded random. */
function generateCloudBodies(seed: number, count: number, scale: number): CloudBody[] {
  const rng = mulberry32(seed);
  const bodies: CloudBody[] = [];
  for (let i = 0; i < count; i++) {
    const baseRx = (0.08 + rng() * 0.12) * scale;
    bodies.push({
      cx: 0.05 + rng() * 0.9,
      cy: 0.2 + rng() * 0.5,
      rx: baseRx,
      ry: baseRx * (0.4 + rng() * 0.3), // flat base, rounded top
    });
  }
  return bodies;
}

/** Render discrete cloud bodies (cumulus, cumulonimbus). */
function renderDiscrete(
  data: Uint8ClampedArray,
  rw: number,
  rh: number,
  p: ResolvedCloudProps,
): void {
  const bodies = generateCloudBodies(p.seed, p.cloudCount, p.scale);
  const edgeNoise = createWarpedNoise(p.seed + 2003, 3, p.edgeComplexity * 0.5);
  const sunRad = (p.sunAngle * Math.PI) / 180;
  const lightDx = Math.cos(sunRad);
  const lightDy = Math.sin(sunRad);

  const [cloudR, cloudG, cloudB] = parseHex(p.cloudColor);
  const [shadR, shadG, shadB] = parseHex(p.shadowColor);
  const [hiR, hiG, hiB] = parseHex(p.highlightColor);

  for (let ry = 0; ry < rh; ry++) {
    const ny = ry / rh;
    for (let rx = 0; rx < rw; rx++) {
      const nx = rx / rw;

      let maxDensity = 0;
      let bestLightFactor = 0;

      for (const body of bodies) {
        const dx = (nx - body.cx) / body.rx;
        // Flat base: distance below center uses smaller radius (flat base effect)
        const dyRaw = ny - body.cy;
        const dyNorm = dyRaw > 0 ? dyRaw / (body.ry * 0.7) : dyRaw / body.ry;
        const dist = Math.sqrt(dx * dx + dyNorm * dyNorm);

        if (dist < 1.3) {
          // Noise displacement on edges
          const edgeDisp = edgeNoise(nx * 8, ny * 8) * p.edgeComplexity * 0.4;
          const effectiveDist = dist - edgeDisp;

          if (effectiveDist < 1) {
            const density = smoothstep(1 - effectiveDist);
            if (density > maxDensity) {
              maxDensity = density;
              // Light factor: dot product of surface normal with light direction
              const surfNx = dx / (dist + 0.001);
              const surfNy = dyNorm / (dist + 0.001);
              bestLightFactor = surfNx * lightDx + surfNy * lightDy;
            }
          }
        }
      }

      if (maxDensity > 0.01) {
        // Lighting: blend between shadow, cloud, and highlight
        let r: number, g: number, b: number;
        if (bestLightFactor > 0) {
          const t = Math.min(1, bestLightFactor * p.sunElevation);
          r = Math.round(cloudR + (hiR - cloudR) * t);
          g = Math.round(cloudG + (hiG - cloudG) * t);
          b = Math.round(cloudB + (hiB - cloudB) * t);
        } else {
          const t = Math.min(1, -bestLightFactor * 0.8);
          r = Math.round(cloudR + (shadR - cloudR) * t);
          g = Math.round(cloudG + (shadG - cloudG) * t);
          b = Math.round(cloudB + (shadB - cloudB) * t);
        }

        const alpha = maxDensity * p.opacity;
        const idx = (ry * rw + rx) * 4;
        const existingA = data[idx + 3]! / 255;
        const newA = alpha * (1 - existingA);
        const totalA = existingA + newA;

        if (totalA > 0) {
          data[idx] = Math.round((data[idx]! * existingA + r * newA) / totalA);
          data[idx + 1] = Math.round((data[idx + 1]! * existingA + g * newA) / totalA);
          data[idx + 2] = Math.round((data[idx + 2]! * existingA + b * newA) / totalA);
          data[idx + 3] = Math.round(totalA * 255);
        }
      }
    }
  }
}

/** Render threshold-based clouds (stratus, stratocumulus). */
function renderThreshold(
  data: Uint8ClampedArray,
  rw: number,
  rh: number,
  p: ResolvedCloudProps,
): void {
  const noise = createWarpedNoise(p.seed, 4, p.turbulence * 0.6);
  const threshold = 1 - p.coverage;
  const sunRad = (p.sunAngle * Math.PI) / 180;
  const lightDx = Math.cos(sunRad);

  const [cloudR, cloudG, cloudB] = parseHex(p.cloudColor);
  const [shadR, shadG, shadB] = parseHex(p.shadowColor);
  const [hiR, hiG, hiB] = parseHex(p.highlightColor);

  // Pre-sample noise for shadow calculation
  const noiseGrid = new Float32Array(rw * rh);
  for (let ry = 0; ry < rh; ry++) {
    for (let rx = 0; rx < rw; rx++) {
      noiseGrid[ry * rw + rx] = noise((rx / rw) * 4 * p.scale, (ry / rh) * 4 * p.scale);
    }
  }

  for (let ry = 0; ry < rh; ry++) {
    const ny = ry / rh;
    // Vertical falloff — clouds concentrated in middle band
    let vertAlpha = 1;
    if (ny < 0.15) vertAlpha = smoothstep(ny / 0.15);
    else if (ny > 0.85) vertAlpha = smoothstep((1 - ny) / 0.15);

    for (let rx = 0; rx < rw; rx++) {
      const n = noiseGrid[ry * rw + rx]!;

      if (n > threshold) {
        const aboveThreshold = (n - threshold) / (1 - threshold);
        const density = Math.min(1, aboveThreshold * 1.5);

        // Simple self-shadowing: sample noise offset in light direction
        const shadowOffset = Math.round(lightDx * 3);
        const shadowRx = Math.max(0, Math.min(rw - 1, rx + shadowOffset));
        const shadowN = noiseGrid[ry * rw + shadowRx]!;
        const shadowFactor = shadowN > n ? 0.3 : 0;

        // Color: blend cloud with shadow/highlight
        const lightBias = (1 - shadowFactor) * p.sunElevation;
        let r: number, g: number, b: number;
        if (lightBias > 0.5) {
          const t = (lightBias - 0.5) * 2;
          r = Math.round(cloudR + (hiR - cloudR) * t * 0.3);
          g = Math.round(cloudG + (hiG - cloudG) * t * 0.3);
          b = Math.round(cloudB + (hiB - cloudB) * t * 0.3);
        } else {
          const t = (0.5 - lightBias) * 2;
          r = Math.round(cloudR + (shadR - cloudR) * t);
          g = Math.round(cloudG + (shadG - cloudG) * t);
          b = Math.round(cloudB + (shadB - cloudB) * t);
        }

        const alpha = density * vertAlpha * p.opacity;
        if (alpha > 0.01) {
          const idx = (ry * rw + rx) * 4;
          const existingA = data[idx + 3]! / 255;
          const newA = alpha * (1 - existingA);
          const totalA = existingA + newA;

          if (totalA > 0) {
            data[idx] = Math.round((data[idx]! * existingA + r * newA) / totalA);
            data[idx + 1] = Math.round((data[idx + 1]! * existingA + g * newA) / totalA);
            data[idx + 2] = Math.round((data[idx + 2]! * existingA + b * newA) / totalA);
            data[idx + 3] = Math.round(totalA * 255);
          }
        }
      }
    }
  }
}

/** Render streak-based clouds (cirrus). */
function renderStreak(
  data: Uint8ClampedArray,
  rw: number,
  rh: number,
  p: ResolvedCloudProps,
): void {
  const rng = mulberry32(p.seed);
  const noise = createFractalNoise(p.seed + 3001, 2);
  const [cr, cg, cb] = parseHex(p.cloudColor);

  // Generate streak paths
  const streakCount = p.cloudCount;
  for (let s = 0; s < streakCount; s++) {
    const startX = rng() * rw;
    const startY = 0.15 * rh + rng() * 0.5 * rh;
    const length = (80 + rng() * 120) * p.scale;
    const angle = -0.1 + rng() * 0.2; // mostly horizontal with slight tilt
    const thickness = (2 + rng() * 4) * p.scale;

    // Draw streak as series of semi-transparent dots along path
    const steps = Math.ceil(length);
    for (let i = 0; i < steps; i++) {
      const t = i / steps;
      const px = startX + i * Math.cos(angle);
      // Add gentle wave to streak path
      const waveOffset = Math.sin(t * Math.PI * 2 + rng() * 6) * thickness * 2;
      const py = startY + i * Math.sin(angle) + waveOffset;

      // Noise-varied opacity along streak
      const noiseVal = noise(px / rw * 5, py / rh * 5);
      const streakAlpha = p.opacity * smoothstep(1 - Math.abs(t - 0.5) * 2) * noiseVal * 0.6;

      if (streakAlpha < 0.01) continue;

      // Draw soft dot at this position
      const dotRadius = Math.ceil(thickness * (0.5 + noiseVal * 0.5));
      for (let dy = -dotRadius; dy <= dotRadius; dy++) {
        for (let dx = -dotRadius; dx <= dotRadius; dx++) {
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > dotRadius) continue;

          const ix = Math.round(px + dx);
          const iy = Math.round(py + dy);
          if (ix < 0 || ix >= rw || iy < 0 || iy >= rh) continue;

          const falloff = smoothstep(1 - dist / dotRadius);
          const alpha = streakAlpha * falloff;

          const idx = (iy * rw + ix) * 4;
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

export const cloudsLayerType: LayerTypeDefinition = {
  typeId: "atmosphere:clouds",
  displayName: "Clouds",
  icon: "cloud",
  category: "draw",
  properties: CLOUD_PROPERTIES,
  propertyEditorId: "atmosphere:clouds-editor",

  createDefault(): LayerProperties {
    return createDefaultProps(CLOUD_PROPERTIES);
  },

  render(properties, ctx, bounds): void {
    const p = resolveProps(properties);
    const { width, height, x: bx, y: by } = bounds;

    // Cloud band occupies upper portion based on altitude
    const cloudTop = Math.round(by + height * p.altitude);
    const cloudBottom = Math.round(by + height * Math.min(0.65, p.altitude + 0.5 * p.scale));
    const cloudHeight = cloudBottom - cloudTop;

    if (cloudHeight <= 0) return;

    // Use half resolution for clouds (more detail needed than fog/mist)
    const renderScale = p.algorithm === "streak" ? 0.5 : 0.35;
    const rw = Math.max(1, Math.round(width * renderScale));
    const rh = Math.max(1, Math.round(cloudHeight * renderScale));

    const imageData = ctx.createImageData(rw, rh);
    const data = imageData.data;

    switch (p.algorithm) {
      case "discrete":
        renderDiscrete(data, rw, rh, p);
        break;
      case "threshold":
        renderThreshold(data, rw, rh, p);
        break;
      case "streak":
        renderStreak(data, rw, rh, p);
        break;
    }

    // Scale up to full resolution
    const fullImageData = ctx.createImageData(width, cloudHeight);
    const fullData = fullImageData.data;
    for (let fy = 0; fy < cloudHeight; fy++) {
      const ry = Math.min(Math.floor((fy / cloudHeight) * rh), rh - 1);
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
    ctx.putImageData(fullImageData, bx, cloudTop);
  },

  validate(properties): ValidationError[] | null {
    const errors: ValidationError[] = [];
    const presetId = properties.preset as string;
    if (presetId && !getPreset(presetId)) {
      errors.push({ property: "preset", message: `Unknown cloud preset "${presetId}"` });
    }
    return errors.length > 0 ? errors : null;
  },
};
