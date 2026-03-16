/**
 * @genart-dev/plugin-atmosphere — Atmospheric effects for generative landscapes
 *
 * 4 layer types (fog, mist, clouds, haze), 37 presets, 7 MCP tools.
 * v0.2.0: 22 cloud types with multi-lobe formations, Worley noise, bilinear upscale,
 * fog stacking + wisps, mist color shift, haze layer, improved lighting.
 */

import type { DesignPlugin, PluginContext } from "@genart-dev/core";
import { atmosphereMcpTools } from "./atmosphere-tools.js";
import {
  fogLayerType,
  mistLayerType,
  cloudsLayerType,
  hazeLayerType,
} from "./layers/index.js";

const atmospherePlugin: DesignPlugin = {
  id: "atmosphere",
  name: "Atmosphere",
  version: "0.2.0",
  description:
    "Atmospheric effects for generative landscapes: fog (ground-level, terrain-masked, multi-layer stacking, wisps), " +
    "mist (parallax haze bands with atmospheric color shift), " +
    "clouds (22 meteorological types with multi-lobe formations and Worley noise), " +
    "and haze (distance-based atmospheric perspective). " +
    "4 layer types, 37 presets, 7 MCP tools.",

  layerTypes: [
    fogLayerType,
    mistLayerType,
    cloudsLayerType,
    hazeLayerType,
  ],
  tools: [],
  exportHandlers: [],
  mcpTools: atmosphereMcpTools,

  async initialize(_context: PluginContext): Promise<void> {},
  dispose(): void {},
};

export default atmospherePlugin;

// Re-export layer types
export {
  fogLayerType,
  mistLayerType,
  cloudsLayerType,
  hazeLayerType,
} from "./layers/index.js";

// Re-export presets
export { ALL_PRESETS, getPreset, filterPresets, searchPresets, categoryToLayerType } from "./presets/index.js";
export type {
  AtmospherePreset,
  FogPreset,
  MistPreset,
  CloudPreset,
  HazePreset,
  CloudType,
  PresetCategory,
} from "./presets/types.js";

// Re-export tools
export { atmosphereMcpTools } from "./atmosphere-tools.js";

// Re-export shared utilities
export { mulberry32 } from "./shared/prng.js";
export { createValueNoise, createFractalNoise, createWarpedNoise, createWorleyNoise } from "./shared/noise.js";
export { parseHex, toHex, lerpColor, varyColor } from "./shared/color-utils.js";
