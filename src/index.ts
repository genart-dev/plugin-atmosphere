/**
 * @genart-dev/plugin-atmosphere — Atmospheric effects for generative landscapes
 *
 * 3 layer types (fog, mist, clouds), 16 presets, 6 MCP tools.
 * First plugin to leverage ADR 083 compositor layer masking for terrain-atmosphere interaction.
 */

import type { DesignPlugin, PluginContext } from "@genart-dev/core";
import { atmosphereMcpTools } from "./atmosphere-tools.js";
import {
  fogLayerType,
  mistLayerType,
  cloudsLayerType,
} from "./layers/index.js";

const atmospherePlugin: DesignPlugin = {
  id: "atmosphere",
  name: "Atmosphere",
  version: "0.1.0",
  description:
    "Atmospheric effects for generative landscapes: fog (ground-level, terrain-masked), " +
    "mist (parallax haze bands), and clouds (cumulus, stratus, cirrus with lighting). " +
    "3 layer types, 16 presets, 6 MCP tools.",

  layerTypes: [
    fogLayerType,
    mistLayerType,
    cloudsLayerType,
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
} from "./layers/index.js";

// Re-export presets
export { ALL_PRESETS, getPreset, filterPresets, searchPresets, categoryToLayerType } from "./presets/index.js";
export type {
  AtmospherePreset,
  FogPreset,
  MistPreset,
  CloudPreset,
  PresetCategory,
} from "./presets/types.js";

// Re-export tools
export { atmosphereMcpTools } from "./atmosphere-tools.js";

// Re-export shared utilities
export { mulberry32 } from "./shared/prng.js";
export { createValueNoise, createFractalNoise, createWarpedNoise } from "./shared/noise.js";
export { parseHex, toHex, lerpColor, varyColor } from "./shared/color-utils.js";
