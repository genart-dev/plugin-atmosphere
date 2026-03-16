/**
 * atmosphere:clouds — Sky-level cloud formations.
 *
 * 3 rendering algorithms:
 * - "discrete": Multi-lobe cloud formations with billow system (cumulus, cumulonimbus)
 * - "threshold": Noise field with optional Worley blending (stratus, stratocumulus)
 * - "streak": Continuous tapered wispy strokes (cirrus)
 *
 * 22 cloud type configs mapping meteorological types to algorithm + generation params.
 * Lighting model: sunAngle, sunElevation, thickness-based self-shadowing, rim lighting.
 */

import type {
  LayerTypeDefinition,
  LayerPropertySchema,
  LayerProperties,
  ValidationError,
} from "@genart-dev/core";
import { createFractalNoise, createWarpedNoise, createWorleyNoise } from "../shared/noise.js";
import { mulberry32 } from "../shared/prng.js";
import { parseHex } from "../shared/color-utils.js";
import { createDefaultProps, smoothstep, smootherstep, bilinearUpscale } from "./shared.js";
import { getPreset } from "../presets/index.js";
import type { CloudPreset } from "../presets/types.js";

// --- Cloud type configuration ---

interface CloudTypeConfig {
  algorithm: "discrete" | "threshold" | "streak";
  /** Whether to blend Worley noise into threshold (for cellular patterns). */
  useWorley: boolean;
  /** Worley cell count (if useWorley). */
  worleyCells: number;
  /** Worley influence 0-1 (if useWorley). */
  worleyInfluence: number;
  /** Number of billows per formation (discrete). */
  billowCount: [number, number]; // [min, max]
  /** Aspect ratio: width / height of formation. */
  aspectRatio: number;
  /** How flat the cloud base is 0-1 (1 = perfectly flat base clip). */
  baseFlatness: number;
  /** Asymmetry: how much one shoulder extends over the other 0-1. */
  asymmetry: number;
  /** Default coverage for this cloud type. */
  defaultCoverage: number;
  /** Altitude band (meteorological). */
  altitudeBand: "high" | "mid" | "low" | "vertical" | "special";
}

const CLOUD_TYPE_CONFIGS: Record<string, CloudTypeConfig> = {
  // High (>6km)
  "cirrus": {
    algorithm: "streak", useWorley: false, worleyCells: 0, worleyInfluence: 0,
    billowCount: [1, 1], aspectRatio: 8, baseFlatness: 0, asymmetry: 0.3,
    defaultCoverage: 0.2, altitudeBand: "high",
  },
  "cirrostratus": {
    algorithm: "threshold", useWorley: false, worleyCells: 0, worleyInfluence: 0,
    billowCount: [1, 1], aspectRatio: 5, baseFlatness: 0, asymmetry: 0,
    defaultCoverage: 0.7, altitudeBand: "high",
  },
  "cirrocumulus": {
    algorithm: "threshold", useWorley: true, worleyCells: 30, worleyInfluence: 0.7,
    billowCount: [1, 1], aspectRatio: 1, baseFlatness: 0, asymmetry: 0,
    defaultCoverage: 0.5, altitudeBand: "high",
  },
  // Mid (2-6km)
  "altocumulus": {
    algorithm: "threshold", useWorley: true, worleyCells: 18, worleyInfluence: 0.6,
    billowCount: [1, 1], aspectRatio: 1.2, baseFlatness: 0, asymmetry: 0,
    defaultCoverage: 0.5, altitudeBand: "mid",
  },
  "altostratus": {
    algorithm: "threshold", useWorley: false, worleyCells: 0, worleyInfluence: 0,
    billowCount: [1, 1], aspectRatio: 4, baseFlatness: 0, asymmetry: 0,
    defaultCoverage: 0.75, altitudeBand: "mid",
  },
  "altocumulus-castellanus": {
    algorithm: "discrete", useWorley: false, worleyCells: 0, worleyInfluence: 0,
    billowCount: [3, 5], aspectRatio: 0.7, baseFlatness: 0.6, asymmetry: 0.2,
    defaultCoverage: 0.3, altitudeBand: "mid",
  },
  // Low (<2km)
  "cumulus": {
    algorithm: "discrete", useWorley: false, worleyCells: 0, worleyInfluence: 0,
    billowCount: [4, 6], aspectRatio: 1.3, baseFlatness: 0.8, asymmetry: 0.3,
    defaultCoverage: 0.3, altitudeBand: "low",
  },
  "cumulus-congestus": {
    algorithm: "discrete", useWorley: false, worleyCells: 0, worleyInfluence: 0,
    billowCount: [8, 12], aspectRatio: 0.8, baseFlatness: 0.9, asymmetry: 0.2,
    defaultCoverage: 0.4, altitudeBand: "low",
  },
  "stratocumulus": {
    algorithm: "threshold", useWorley: true, worleyCells: 12, worleyInfluence: 0.5,
    billowCount: [1, 1], aspectRatio: 2, baseFlatness: 0, asymmetry: 0,
    defaultCoverage: 0.6, altitudeBand: "low",
  },
  "stratus": {
    algorithm: "threshold", useWorley: false, worleyCells: 0, worleyInfluence: 0,
    billowCount: [1, 1], aspectRatio: 6, baseFlatness: 0, asymmetry: 0,
    defaultCoverage: 0.85, altitudeBand: "low",
  },
  "nimbostratus": {
    algorithm: "threshold", useWorley: false, worleyCells: 0, worleyInfluence: 0,
    billowCount: [1, 1], aspectRatio: 5, baseFlatness: 0, asymmetry: 0,
    defaultCoverage: 0.9, altitudeBand: "low",
  },
  // Vertical development
  "cumulonimbus": {
    algorithm: "discrete", useWorley: false, worleyCells: 0, worleyInfluence: 0,
    billowCount: [15, 20], aspectRatio: 0.7, baseFlatness: 0.9, asymmetry: 0.15,
    defaultCoverage: 0.7, altitudeBand: "vertical",
  },
  "cumulonimbus-incus": {
    algorithm: "discrete", useWorley: false, worleyCells: 0, worleyInfluence: 0,
    billowCount: [15, 20], aspectRatio: 0.6, baseFlatness: 0.9, asymmetry: 0.1,
    defaultCoverage: 0.7, altitudeBand: "vertical",
  },
  // Special
  "lenticular": {
    algorithm: "discrete", useWorley: false, worleyCells: 0, worleyInfluence: 0,
    billowCount: [1, 2], aspectRatio: 3.0, baseFlatness: 0, asymmetry: 0,
    defaultCoverage: 0.2, altitudeBand: "special",
  },
  "mammatus": {
    algorithm: "threshold", useWorley: true, worleyCells: 15, worleyInfluence: 0.8,
    billowCount: [1, 1], aspectRatio: 1, baseFlatness: 0, asymmetry: 0,
    defaultCoverage: 0.6, altitudeBand: "special",
  },
  "pileus": {
    algorithm: "streak", useWorley: false, worleyCells: 0, worleyInfluence: 0,
    billowCount: [1, 1], aspectRatio: 5, baseFlatness: 0, asymmetry: 0,
    defaultCoverage: 0.15, altitudeBand: "special",
  },
  "fog-bank": {
    algorithm: "threshold", useWorley: false, worleyCells: 0, worleyInfluence: 0,
    billowCount: [1, 1], aspectRatio: 4, baseFlatness: 0, asymmetry: 0,
    defaultCoverage: 0.7, altitudeBand: "special",
  },
  "banner-cloud": {
    algorithm: "discrete", useWorley: false, worleyCells: 0, worleyInfluence: 0,
    billowCount: [3, 5], aspectRatio: 2.5, baseFlatness: 0.5, asymmetry: 0.6,
    defaultCoverage: 0.25, altitudeBand: "special",
  },
  "contrail": {
    algorithm: "streak", useWorley: false, worleyCells: 0, worleyInfluence: 0,
    billowCount: [1, 1], aspectRatio: 20, baseFlatness: 0, asymmetry: 0,
    defaultCoverage: 0.1, altitudeBand: "special",
  },
  "pyrocumulus": {
    algorithm: "discrete", useWorley: false, worleyCells: 0, worleyInfluence: 0,
    billowCount: [10, 15], aspectRatio: 0.65, baseFlatness: 0.85, asymmetry: 0.3,
    defaultCoverage: 0.5, altitudeBand: "special",
  },
};

/** Get config for a cloud type, falling back to cumulus. */
function getCloudTypeConfig(cloudType: string): CloudTypeConfig {
  return CLOUD_TYPE_CONFIGS[cloudType] ?? CLOUD_TYPE_CONFIGS["cumulus"]!;
}

// All 22 cloud type values for the select dropdown
const CLOUD_TYPE_OPTIONS = Object.keys(CLOUD_TYPE_CONFIGS).map((key) => ({
  value: key,
  label: key
    .split("-")
    .map((w) => w[0]!.toUpperCase() + w.slice(1))
    .join(" "),
}));

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
      // v0.2.0 new presets
      { value: "mackerel-sky", label: "Mackerel Sky" },
      { value: "cirrostratus-veil", label: "Cirrostratus Veil" },
      { value: "altocumulus-field", label: "Altocumulus Field" },
      { value: "altostratus-sheet", label: "Altostratus Sheet" },
      { value: "castellanus-turrets", label: "Castellanus Turrets" },
      { value: "cumulus-congestus", label: "Cumulus Congestus" },
      { value: "nimbostratus-overcast", label: "Nimbostratus Overcast" },
      { value: "cumulonimbus-anvil", label: "Cumulonimbus Anvil" },
      { value: "lenticular-lens", label: "Lenticular Lens" },
      { value: "mammatus-pouches", label: "Mammatus Pouches" },
      { value: "fog-bank-low", label: "Fog Bank Low" },
      { value: "contrail-thin", label: "Contrail Thin" },
      { value: "pyrocumulus-dark", label: "Pyrocumulus Dark" },
      { value: "banner-peak", label: "Banner Peak" },
      { value: "pileus-cap", label: "Pileus Cap" },
    ],
  },
  { key: "seed", label: "Seed", type: "number", default: 42, min: 0, max: 99999, step: 1, group: "generation" },
  {
    key: "cloudType",
    label: "Cloud Type",
    type: "select",
    default: "cumulus",
    group: "type",
    options: CLOUD_TYPE_OPTIONS,
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

// --- Multi-lobe CloudFormation system ---

interface Billow {
  cx: number; // center X relative to formation center
  cy: number; // center Y relative to formation center
  r: number;  // radius in normalized coords
}

interface CloudFormation {
  cx: number;       // formation center X (0-1)
  cy: number;       // formation center Y (0-1)
  baseY: number;    // flat base clip line (0-1)
  billows: Billow[];
  width: number;    // formation width for bounds check
  height: number;   // formation height for bounds check
}

/** Generate a multi-lobe cloud formation with crown and shoulder billows. */
function generateCloudFormation(
  rng: () => number,
  scale: number,
  config: CloudTypeConfig,
): CloudFormation {
  const formW = (0.08 + rng() * 0.12) * scale * config.aspectRatio;
  const formH = (0.08 + rng() * 0.12) * scale;
  const cx = 0.05 + rng() * 0.9;
  const cy = 0.2 + rng() * 0.5;

  const billows: Billow[] = [];
  const billowCount = config.billowCount[0] +
    Math.floor(rng() * (config.billowCount[1] - config.billowCount[0] + 1));

  if (billowCount <= 2) {
    // Simple: single or double billow (lenticular, pileus, contrail)
    billows.push({ cx: 0, cy: 0, r: Math.max(formW, formH) * 0.5 });
    if (billowCount === 2) {
      const offset = formW * 0.2 * (rng() > 0.5 ? 1 : -1);
      billows.push({ cx: offset, cy: -formH * 0.15, r: formH * 0.35 });
    }
  } else {
    // Core billow at center
    const coreR = Math.max(formW, formH) * 0.35;
    billows.push({ cx: 0, cy: 0, r: coreR });

    // Crown billows above core in an arc
    const crownCount = Math.min(billowCount - 1, Math.ceil(billowCount * 0.5));
    for (let i = 0; i < crownCount; i++) {
      const angle = (-0.7 + (i / Math.max(1, crownCount - 1)) * 1.4) + (rng() - 0.5) * 0.2;
      const dist = coreR * (0.6 + rng() * 0.4);
      const bx = Math.sin(angle) * dist;
      const by = -Math.cos(angle) * dist * 0.8;
      const br = coreR * (0.4 + rng() * 0.4);
      billows.push({ cx: bx, cy: by, r: br });
    }

    // Shoulder billows at sides
    const shoulderCount = billowCount - 1 - crownCount;
    for (let i = 0; i < shoulderCount; i++) {
      const side = (i % 2 === 0 ? -1 : 1) * (1 + config.asymmetry * (rng() - 0.3));
      const bx = side * coreR * (0.8 + rng() * 0.5);
      const by = coreR * (rng() * 0.3);
      const br = coreR * (0.3 + rng() * 0.3);
      billows.push({ cx: bx, cy: by, r: br });
    }
  }

  // Compute base clip line
  let maxBillowBottom = 0;
  for (const b of billows) {
    maxBillowBottom = Math.max(maxBillowBottom, b.cy + b.r);
  }
  const baseY = cy + maxBillowBottom * config.baseFlatness;

  // Compute bounding dimensions for early-exit
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const b of billows) {
    minX = Math.min(minX, b.cx - b.r);
    maxX = Math.max(maxX, b.cx + b.r);
    minY = Math.min(minY, b.cy - b.r);
    maxY = Math.max(maxY, b.cy + b.r);
  }

  return {
    cx, cy, baseY,
    billows,
    width: maxX - minX,
    height: maxY - minY,
  };
}

/** Generate multiple cloud formations. */
function generateFormations(
  seed: number,
  count: number,
  scale: number,
  config: CloudTypeConfig,
): CloudFormation[] {
  const rng = mulberry32(seed);
  const formations: CloudFormation[] = [];
  for (let i = 0; i < count; i++) {
    formations.push(generateCloudFormation(rng, scale, config));
  }
  return formations;
}

/** Composite a pixel into the RGBA buffer with alpha blending. */
function compositePixel(
  data: Uint8ClampedArray,
  idx: number,
  r: number,
  g: number,
  b: number,
  alpha: number,
): void {
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

/**
 * Compute cloud density at a point for a set of formations.
 * Returns density 0-1 at the given normalized coordinate.
 */
function sampleFormationDensity(
  nx: number,
  ny: number,
  formations: CloudFormation[],
  config: CloudTypeConfig,
  edgeNoise: (x: number, y: number) => number,
  edgeComplexity: number,
  isAnvil: boolean,
): number {
  let maxDensity = 0;

  for (const formation of formations) {
    const halfW = formation.width * 0.6;
    const halfH = formation.height * 0.6;
    if (Math.abs(nx - formation.cx) > halfW || Math.abs(ny - formation.cy) > halfH) continue;
    if (config.baseFlatness > 0 && ny > formation.baseY) continue;

    for (const billow of formation.billows) {
      let effBx = billow.cx;
      let effR = billow.r;
      if (isAnvil && billow.cy < -billow.r * 0.5) {
        effR *= 1.8;
        effBx *= 1.4;
      }

      const dx = nx - (formation.cx + effBx);
      const dy = ny - (formation.cy + billow.cy);
      const dist = Math.sqrt((dx * dx) / (effR * effR) + (dy * dy) / (billow.r * billow.r));

      if (dist < 1.3) {
        const edgeDisp = edgeNoise(nx * 8, ny * 8) * edgeComplexity * 0.3;
        const effectiveDist = dist - edgeDisp;

        if (effectiveDist < 1) {
          const density = smootherstep(1 - effectiveDist);
          if (density > maxDensity) maxDensity = density;
        }
      }
    }
  }

  return maxDensity;
}

/**
 * Render discrete cloud formations using layered tint passes.
 *
 * Instead of computing shadow/highlight per-pixel with math, we render
 * 3 separate passes with different colors and offsets that naturally
 * overlap to create depth:
 *
 * Pass 1 (back/shadow): Shadow color, offset away from light, slightly larger
 * Pass 2 (body): Cloud color, at actual position
 * Pass 3 (front/highlight): Highlight color, offset toward light, slightly smaller
 *
 * The overlapping semi-transparent layers produce natural depth transitions.
 */
function renderDiscrete(
  data: Uint8ClampedArray,
  rw: number,
  rh: number,
  p: ResolvedCloudProps,
): void {
  const config = getCloudTypeConfig(p.cloudType);
  const formations = generateFormations(p.seed, p.cloudCount, p.scale, config);
  const edgeNoise = createWarpedNoise(p.seed + 2003, 3, p.edgeComplexity * 0.5);
  const sunRad = (p.sunAngle * Math.PI) / 180;
  const lightDx = Math.cos(sunRad);
  const lightDy = Math.sin(sunRad);
  const isAnvil = p.cloudType === "cumulonimbus-incus";

  const [cloudR, cloudG, cloudB] = parseHex(p.cloudColor);
  const [shadR, shadG, shadB] = parseHex(p.shadowColor);
  const [hiR, hiG, hiB] = parseHex(p.highlightColor);

  // Light direction offset in normalized coords (scaled by formation size)
  const avgFormSize = formations.length > 0
    ? formations.reduce((s, f) => s + f.width, 0) / formations.length
    : 0.1;
  const shadowOffset = avgFormSize * 0.15 * (1 - p.sunElevation * 0.5);
  const highlightOffset = avgFormSize * 0.08 * p.sunElevation;

  // Pass 1: Shadow layer (offset away from light, softer edges)
  for (let ry = 0; ry < rh; ry++) {
    const ny = ry / rh;
    for (let rx = 0; rx < rw; rx++) {
      const nx = rx / rw;
      // Sample at position offset away from light (shadow falls opposite to light)
      const density = sampleFormationDensity(
        nx + lightDx * shadowOffset,
        ny + lightDy * shadowOffset,
        formations, config, edgeNoise, p.edgeComplexity, isAnvil,
      );
      if (density > 0.01) {
        // Shadow is softer and more spread: lower opacity, gentler falloff
        const alpha = density * p.opacity * 0.45;
        compositePixel(data, (ry * rw + rx) * 4, shadR, shadG, shadB, alpha);
      }
    }
  }

  // Pass 2: Body layer (main cloud color at actual position)
  for (let ry = 0; ry < rh; ry++) {
    const ny = ry / rh;
    for (let rx = 0; rx < rw; rx++) {
      const nx = rx / rw;
      const density = sampleFormationDensity(
        nx, ny,
        formations, config, edgeNoise, p.edgeComplexity, isAnvil,
      );
      if (density > 0.01) {
        const alpha = density * p.opacity * 0.7;
        compositePixel(data, (ry * rw + rx) * 4, cloudR, cloudG, cloudB, alpha);
      }
    }
  }

  // Pass 3: Highlight layer (offset toward light, tighter/brighter)
  if (p.sunElevation > 0.1) {
    for (let ry = 0; ry < rh; ry++) {
      const ny = ry / rh;
      for (let rx = 0; rx < rw; rx++) {
        const nx = rx / rw;
        // Sample at position offset toward light (highlight on sun-facing side)
        const density = sampleFormationDensity(
          nx - lightDx * highlightOffset,
          ny - lightDy * highlightOffset,
          formations, config, edgeNoise, p.edgeComplexity, isAnvil,
        );
        if (density > 0.3) {
          // Highlight only on denser parts, with elevation-dependent intensity
          const alpha = (density - 0.3) * p.opacity * p.sunElevation * 0.5;
          compositePixel(data, (ry * rw + rx) * 4, hiR, hiG, hiB, alpha);
        }
      }
    }
  }
}

/**
 * Render threshold-based clouds with optional Worley noise blending.
 * Uses layered tint passes: shadow layer offset in light direction,
 * body layer at actual position, highlight layer offset toward light.
 */
function renderThreshold(
  data: Uint8ClampedArray,
  rw: number,
  rh: number,
  p: ResolvedCloudProps,
): void {
  const config = getCloudTypeConfig(p.cloudType);
  const noise = createWarpedNoise(p.seed, 4, p.turbulence * 0.6);
  const threshold = 1 - p.coverage;
  const sunRad = (p.sunAngle * Math.PI) / 180;
  const lightDx = Math.cos(sunRad);
  const lightDy = Math.sin(sunRad);

  const worley = config.useWorley
    ? createWorleyNoise(p.seed + 6007, config.worleyCells)
    : null;
  const worleyInf = config.worleyInfluence;

  const [cloudR, cloudG, cloudB] = parseHex(p.cloudColor);
  const [shadR, shadG, shadB] = parseHex(p.shadowColor);
  const [hiR, hiG, hiB] = parseHex(p.highlightColor);

  const isMammatus = p.cloudType === "mammatus";

  // Pre-sample noise grid
  const noiseGrid = new Float32Array(rw * rh);
  for (let ry = 0; ry < rh; ry++) {
    for (let rx = 0; rx < rw; rx++) {
      const nx = (rx / rw) * 4 * p.scale;
      const ny = (ry / rh) * 4 * p.scale;
      let n = noise(nx, ny);
      if (worley) {
        const w = 1 - worley(rx / rw, ry / rh);
        n = n * (1 - worleyInf) + w * worleyInf;
      }
      noiseGrid[ry * rw + rx] = n;
    }
  }

  /** Sample noise at a pixel position with bounds clamping. */
  function sampleNoise(rx: number, ry: number): number {
    const cx = Math.max(0, Math.min(rw - 1, Math.round(rx)));
    const cy = Math.max(0, Math.min(rh - 1, Math.round(ry)));
    return noiseGrid[cy * rw + cx]!;
  }

  /** Compute density and vertical alpha at a position. */
  function densityAt(rx: number, ry: number): number {
    const ny = Math.max(0, Math.min(rh - 1, Math.round(ry))) / rh;
    let vertAlpha = 1;
    if (isMammatus) {
      if (ny < 0.3) vertAlpha = smoothstep(ny / 0.3);
    } else {
      if (ny < 0.15) vertAlpha = smoothstep(ny / 0.15);
      else if (ny > 0.85) vertAlpha = smoothstep((1 - ny) / 0.15);
    }
    const n = sampleNoise(rx, ry);
    if (n <= threshold) return 0;
    const aboveThreshold = (n - threshold) / (1 - threshold);
    return Math.min(1, aboveThreshold * 1.5) * vertAlpha;
  }

  // Shadow offset in pixels
  const shadowOffPx = Math.max(2, Math.round(rw * 0.02));
  const highlightOffPx = Math.max(1, Math.round(rw * 0.01));

  // Pass 1: Shadow layer (offset away from light)
  for (let ry = 0; ry < rh; ry++) {
    for (let rx = 0; rx < rw; rx++) {
      const density = densityAt(rx + lightDx * shadowOffPx, ry + lightDy * shadowOffPx);
      if (density > 0.01) {
        const alpha = density * p.opacity * 0.4;
        compositePixel(data, (ry * rw + rx) * 4, shadR, shadG, shadB, alpha);
      }
    }
  }

  // Pass 2: Body layer (at actual position)
  for (let ry = 0; ry < rh; ry++) {
    for (let rx = 0; rx < rw; rx++) {
      const density = densityAt(rx, ry);
      if (density > 0.01) {
        const alpha = density * p.opacity * 0.65;
        compositePixel(data, (ry * rw + rx) * 4, cloudR, cloudG, cloudB, alpha);
      }
    }
  }

  // Pass 3: Highlight layer (offset toward light)
  if (p.sunElevation > 0.1) {
    for (let ry = 0; ry < rh; ry++) {
      for (let rx = 0; rx < rw; rx++) {
        const density = densityAt(rx - lightDx * highlightOffPx, ry - lightDy * highlightOffPx);
        if (density > 0.3) {
          const alpha = (density - 0.3) * p.opacity * p.sunElevation * 0.4;
          compositePixel(data, (ry * rw + rx) * 4, hiR, hiG, hiB, alpha);
        }
      }
    }
  }
}

/** Render streak-based clouds as continuous tapered strokes. */
function renderStreak(
  data: Uint8ClampedArray,
  rw: number,
  rh: number,
  p: ResolvedCloudProps,
): void {
  const rng = mulberry32(p.seed);
  const noise = createFractalNoise(p.seed + 3001, 2);
  const [cr, cg, cb] = parseHex(p.cloudColor);

  const isContrail = p.cloudType === "contrail";
  const streakCount = p.cloudCount;

  for (let s = 0; s < streakCount; s++) {
    const startX = rng() * rw;
    const startY = 0.15 * rh + rng() * 0.5 * rh;
    const length = (80 + rng() * 120) * p.scale;
    const angle = isContrail ? (rng() - 0.5) * 0.05 : -0.1 + rng() * 0.2;
    const maxWidth = (2 + rng() * 4) * p.scale;

    // Generate control points for the path
    const numSegments = Math.ceil(length / 3);
    const pathX = new Float32Array(numSegments + 1);
    const pathY = new Float32Array(numSegments + 1);

    // Pre-compute a seeded wave offset per-streak
    const wavePhase = rng() * 6;
    const waveAmp = isContrail ? maxWidth * 0.3 : maxWidth * 2;

    for (let i = 0; i <= numSegments; i++) {
      const t = i / numSegments;
      pathX[i] = startX + t * length * Math.cos(angle);
      const wave = Math.sin(t * Math.PI * 2 + wavePhase) * waveAmp;
      pathY[i] = startY + t * length * Math.sin(angle) + wave;
    }

    // For each pixel in bounding region, compute perpendicular distance to nearest segment
    const minPx = Math.max(0, Math.floor(Math.min(startX, pathX[numSegments]!) - maxWidth * 3));
    const maxPx = Math.min(rw - 1, Math.ceil(Math.max(startX, pathX[numSegments]!) + maxWidth * 3));
    const minPy = Math.max(0, Math.floor(Math.min(startY, pathY[numSegments]!) - maxWidth * 4));
    const maxPy = Math.min(rh - 1, Math.ceil(Math.max(startY, pathY[numSegments]!) + maxWidth * 4));

    for (let iy = minPy; iy <= maxPy; iy++) {
      for (let ix = minPx; ix <= maxPx; ix++) {
        let minDist = Infinity;
        let bestT = 0;

        // Find nearest path segment
        for (let i = 0; i < numSegments; i++) {
          const ax = pathX[i]!;
          const ay = pathY[i]!;
          const bx = pathX[i + 1]!;
          const by = pathY[i + 1]!;
          const abx = bx - ax;
          const aby = by - ay;
          const abLen2 = abx * abx + aby * aby;
          if (abLen2 < 0.001) continue;

          let proj = ((ix - ax) * abx + (iy - ay) * aby) / abLen2;
          proj = Math.max(0, Math.min(1, proj));
          const closestX = ax + proj * abx;
          const closestY = ay + proj * aby;
          const dx = ix - closestX;
          const dy = iy - closestY;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < minDist) {
            minDist = dist;
            bestT = (i + proj) / numSegments;
          }
        }

        // Tapered width: sin(pi*t) for soft start/end
        const halfWidth = maxWidth * Math.sin(Math.PI * bestT);
        if (halfWidth < 0.5 || minDist > halfWidth) continue;

        const falloff = smootherstep(1 - minDist / halfWidth);
        const noiseVal = noise((ix / rw) * 5, (iy / rh) * 5);
        const streakAlpha = p.opacity * falloff * noiseVal * 0.6;

        if (streakAlpha > 0.01) {
          compositePixel(data, (iy * rw + ix) * 4, cr, cg, cb, streakAlpha);
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
    const config = getCloudTypeConfig(p.cloudType);
    // Use cloud type config to determine algorithm if not explicitly overridden
    const effectiveAlgorithm = p.algorithm || config.algorithm;
    const { width, height, x: bx, y: by } = bounds;

    // Cloud band occupies upper portion based on altitude
    const cloudTop = Math.round(by + height * p.altitude);
    const cloudBottom = Math.round(by + height * Math.min(0.65, p.altitude + 0.5 * p.scale));
    const cloudHeight = cloudBottom - cloudTop;

    if (cloudHeight <= 0) return;

    const renderScale = effectiveAlgorithm === "streak" ? 0.5 : 0.35;
    const rw = Math.max(1, Math.round(width * renderScale));
    const rh = Math.max(1, Math.round(cloudHeight * renderScale));

    const imageData = ctx.createImageData(rw, rh);
    const data = imageData.data;

    switch (effectiveAlgorithm) {
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

    // Bilinear upscale to full resolution
    const fullImageData = ctx.createImageData(width, cloudHeight);
    bilinearUpscale(data, rw, rh, fullImageData.data, width, cloudHeight);
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

/** Exported for testing. */
export { CLOUD_TYPE_CONFIGS, getCloudTypeConfig, generateFormations };
