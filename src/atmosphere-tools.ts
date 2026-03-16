/**
 * MCP tool definitions for plugin-atmosphere.
 *
 * 7 tools: add_fog, add_mist, add_clouds, add_haze, list_atmosphere_presets,
 * set_atmosphere_lighting, create_atmosphere.
 */

import type {
  McpToolDefinition,
  McpToolContext,
  McpToolResult,
  DesignLayer,
  LayerTransform,
} from "@genart-dev/core";
import { ALL_PRESETS, getPreset, filterPresets, categoryToLayerType } from "./presets/index.js";
import type { PresetCategory, AtmospherePreset, CloudPreset, FogPreset, MistPreset, HazePreset } from "./presets/types.js";


function textResult(text: string): McpToolResult {
  return { content: [{ type: "text", text }] };
}

function errorResult(text: string): McpToolResult {
  return { content: [{ type: "text", text }], isError: true };
}

function generateLayerId(): string {
  return `layer-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function fullCanvasTransform(ctx: McpToolContext): LayerTransform {
  return {
    x: 0,
    y: 0,
    width: ctx.canvasWidth,
    height: ctx.canvasHeight,
    rotation: 0,
    scaleX: 1,
    scaleY: 1,
    anchorX: 0,
    anchorY: 0,
  };
}

function createLayer(
  typeId: string,
  name: string,
  ctx: McpToolContext,
  properties: Record<string, unknown>,
): DesignLayer {
  return {
    id: generateLayerId(),
    type: typeId,
    name,
    visible: true,
    locked: false,
    opacity: 1,
    blendMode: "normal",
    transform: fullCanvasTransform(ctx),
    properties: properties as Record<string, string | number | boolean | null>,
  };
}

function fogPropsFromPreset(preset: FogPreset, seed: number, overrides: Record<string, unknown>): Record<string, unknown> {
  return {
    preset: preset.id,
    seed,
    fogType: preset.fogType,
    density: preset.density,
    color: preset.color,
    colorBottom: preset.colorBottom,
    opacity: preset.opacity,
    fogTop: preset.fogTop,
    fogBottom: preset.fogBottom,
    edgeSoftness: preset.edgeSoftness,
    noiseScale: preset.noiseScale,
    noiseOctaves: preset.noiseOctaves,
    patchiness: preset.patchiness,
    warpStrength: preset.warpStrength,
    fogLayers: preset.fogLayers ?? 1,
    wispDensity: preset.wispDensity ?? 0,
    ...overrides,
  };
}

function mistPropsFromPreset(preset: MistPreset, seed: number, overrides: Record<string, unknown>): Record<string, unknown> {
  return {
    preset: preset.id,
    seed,
    density: preset.density,
    color: preset.color,
    opacity: preset.opacity,
    bandTop: preset.bandTop,
    bandBottom: preset.bandBottom,
    edgeSoftness: preset.edgeSoftness,
    noiseScale: preset.noiseScale,
    noiseOctaves: preset.noiseOctaves,
    layerCount: preset.layerCount,
    depthSpread: preset.depthSpread,
    driftX: preset.driftX,
    driftPhase: preset.driftPhase,
    skyColor: preset.skyColor ?? "#C0D0E8",
    colorShift: preset.colorShift ?? 0,
    ...overrides,
  };
}

function cloudPropsFromPreset(preset: CloudPreset, seed: number, overrides: Record<string, unknown>): Record<string, unknown> {
  return {
    preset: preset.id,
    seed,
    cloudType: preset.cloudType,
    algorithm: preset.algorithm,
    coverage: preset.coverage,
    altitude: preset.altitude,
    scale: preset.scale,
    cloudCount: preset.cloudCount,
    edgeComplexity: preset.edgeComplexity,
    turbulence: preset.turbulence,
    cloudColor: preset.cloudColor,
    shadowColor: preset.shadowColor,
    highlightColor: preset.highlightColor,
    opacity: preset.opacity,
    sunAngle: preset.sunAngle,
    sunElevation: preset.sunElevation,
    ...overrides,
  };
}

function hazePropsFromPreset(preset: HazePreset, seed: number, overrides: Record<string, unknown>): Record<string, unknown> {
  return {
    preset: preset.id,
    seed,
    color: preset.color,
    opacity: preset.opacity,
    yPosition: preset.yPosition,
    height: preset.height,
    gradientDirection: preset.gradientDirection,
    noiseAmount: preset.noiseAmount,
    depthSlot: preset.depthSlot,
    ...overrides,
  };
}

// Collect all cloud preset ids for the enum
const CLOUD_PRESET_IDS = ALL_PRESETS
  .filter((p) => p.category === "clouds")
  .map((p) => p.id);

const CLOUD_TYPE_VALUES = [
  "cirrus", "cirrostratus", "cirrocumulus",
  "altocumulus", "altostratus", "altocumulus-castellanus",
  "cumulus", "cumulus-congestus", "stratocumulus", "stratus", "nimbostratus",
  "cumulonimbus", "cumulonimbus-incus",
  "lenticular", "mammatus", "pileus", "fog-bank", "banner-cloud", "contrail",
  "pyrocumulus",
];

const addFogTool: McpToolDefinition = {
  name: "add_fog",
  description:
    "Add a fog layer to the design. Ground-level fog with terrain masking support. " +
    "Types: radiation (calm morning), advection (sea fog), upslope (mountain), valley. " +
    "Presets: morning-valley-fog, sea-fog, mountain-fog, dense-fog, patchy-fog. " +
    "v0.2.0: fogLayers (1-5) for depth stacking, wispDensity (0-1) for edge tendrils.",
  inputSchema: {
    type: "object" as const,
    properties: {
      preset: {
        type: "string",
        description: "Fog preset id",
        enum: ["morning-valley-fog", "sea-fog", "mountain-fog", "dense-fog", "patchy-fog"],
      },
      seed: { type: "number", description: "Random seed" },
      fogType: { type: "string", enum: ["radiation", "advection", "upslope", "valley"] },
      density: { type: "number", description: "Fog density 0-1" },
      color: { type: "string", description: "Fog color hex" },
      opacity: { type: "number", description: "Fog opacity 0-1" },
      fogLayers: { type: "number", description: "Number of fog sub-layers 1-5 for depth stacking" },
      wispDensity: { type: "number", description: "Wisp tendril density at fog edges 0-1" },
      depthSlot: { type: "number", description: "Depth slot 0-1 for layering" },
    },
  },
  async handler(args: Record<string, unknown>, ctx: McpToolContext): Promise<McpToolResult> {
    const presetId = (args.preset as string) || "morning-valley-fog";
    const preset = getPreset(presetId);
    if (!preset || preset.category !== "fog") {
      return errorResult(`Unknown fog preset "${presetId}". Available: morning-valley-fog, sea-fog, mountain-fog, dense-fog, patchy-fog`);
    }
    const seed = (args.seed as number) ?? Math.floor(Math.random() * 99999);
    const overrides: Record<string, unknown> = {};
    if (args.fogType !== undefined) overrides.fogType = args.fogType;
    if (args.density !== undefined) overrides.density = args.density;
    if (args.color !== undefined) overrides.color = args.color;
    if (args.opacity !== undefined) overrides.opacity = args.opacity;
    if (args.fogLayers !== undefined) overrides.fogLayers = args.fogLayers;
    if (args.wispDensity !== undefined) overrides.wispDensity = args.wispDensity;
    if (args.depthSlot !== undefined) overrides.depthSlot = args.depthSlot;

    const props = fogPropsFromPreset(preset as FogPreset, seed, overrides);
    const layer = createLayer("atmosphere:fog", `Fog – ${preset.name}`, ctx, props);
    ctx.layers.add(layer);

    return textResult(JSON.stringify({
      layerId: layer.id,
      preset: presetId,
      fogType: props.fogType,
      density: props.density,
      fogLayers: props.fogLayers,
      wispDensity: props.wispDensity,
    }));
  },
};

const addMistTool: McpToolDefinition = {
  name: "add_mist",
  description:
    "Add a mist layer to the design. Mid-level haze bands with parallax stacking. " +
    "Multiple semi-transparent noise layers create depth separation between terrain ridges. " +
    "Presets: morning-mist, mountain-haze, thick-mist, layered-mist. " +
    "v0.2.0: skyColor + colorShift for atmospheric color tint on back layers.",
  inputSchema: {
    type: "object" as const,
    properties: {
      preset: {
        type: "string",
        description: "Mist preset id",
        enum: ["morning-mist", "mountain-haze", "thick-mist", "layered-mist"],
      },
      seed: { type: "number", description: "Random seed" },
      density: { type: "number", description: "Mist density 0-1" },
      color: { type: "string", description: "Mist color hex" },
      opacity: { type: "number", description: "Mist opacity 0-1" },
      layerCount: { type: "number", description: "Number of parallax layers 1-8" },
      skyColor: { type: "string", description: "Sky color hex for back-layer atmospheric tint" },
      colorShift: { type: "number", description: "Color shift intensity 0-1 toward sky color on back layers" },
      depthSlot: { type: "number", description: "Depth slot 0-1 for layering" },
    },
  },
  async handler(args: Record<string, unknown>, ctx: McpToolContext): Promise<McpToolResult> {
    const presetId = (args.preset as string) || "morning-mist";
    const preset = getPreset(presetId);
    if (!preset || preset.category !== "mist") {
      return errorResult(`Unknown mist preset "${presetId}". Available: morning-mist, mountain-haze, thick-mist, layered-mist`);
    }
    const seed = (args.seed as number) ?? Math.floor(Math.random() * 99999);
    const overrides: Record<string, unknown> = {};
    if (args.density !== undefined) overrides.density = args.density;
    if (args.color !== undefined) overrides.color = args.color;
    if (args.opacity !== undefined) overrides.opacity = args.opacity;
    if (args.layerCount !== undefined) overrides.layerCount = args.layerCount;
    if (args.skyColor !== undefined) overrides.skyColor = args.skyColor;
    if (args.colorShift !== undefined) overrides.colorShift = args.colorShift;
    if (args.depthSlot !== undefined) overrides.depthSlot = args.depthSlot;

    const props = mistPropsFromPreset(preset as MistPreset, seed, overrides);
    const layer = createLayer("atmosphere:mist", `Mist – ${preset.name}`, ctx, props);
    ctx.layers.add(layer);

    return textResult(JSON.stringify({
      layerId: layer.id,
      preset: presetId,
      density: props.density,
      layerCount: props.layerCount,
    }));
  },
};

const addCloudsTool: McpToolDefinition = {
  name: "add_clouds",
  description:
    "Add a cloud layer to the design. Sky-level cloud formations with lighting. " +
    "22 cloud types across all altitude bands. " +
    "Algorithms: discrete (multi-lobe formations), threshold (noise + optional Worley), streak (tapered strokes). " +
    `Presets: ${CLOUD_PRESET_IDS.join(", ")}.`,
  inputSchema: {
    type: "object" as const,
    properties: {
      preset: {
        type: "string",
        description: "Cloud preset id",
        enum: CLOUD_PRESET_IDS,
      },
      seed: { type: "number", description: "Random seed" },
      cloudType: { type: "string", enum: CLOUD_TYPE_VALUES },
      coverage: { type: "number", description: "Cloud coverage 0-1" },
      sunAngle: { type: "number", description: "Sun angle 0-360 degrees" },
      sunElevation: { type: "number", description: "Sun elevation 0-1" },
      opacity: { type: "number", description: "Cloud opacity 0-1" },
    },
  },
  async handler(args: Record<string, unknown>, ctx: McpToolContext): Promise<McpToolResult> {
    const presetId = (args.preset as string) || "fair-weather-cumulus";
    const preset = getPreset(presetId);
    if (!preset || preset.category !== "clouds") {
      return errorResult(`Unknown cloud preset "${presetId}". Use list_atmosphere_presets to see available presets.`);
    }
    const seed = (args.seed as number) ?? Math.floor(Math.random() * 99999);
    const overrides: Record<string, unknown> = {};
    if (args.cloudType !== undefined) overrides.cloudType = args.cloudType;
    if (args.coverage !== undefined) overrides.coverage = args.coverage;
    if (args.sunAngle !== undefined) overrides.sunAngle = args.sunAngle;
    if (args.sunElevation !== undefined) overrides.sunElevation = args.sunElevation;
    if (args.opacity !== undefined) overrides.opacity = args.opacity;

    const props = cloudPropsFromPreset(preset as CloudPreset, seed, overrides);
    const layer = createLayer("atmosphere:clouds", `Clouds – ${preset.name}`, ctx, props);
    ctx.layers.add(layer);

    return textResult(JSON.stringify({
      layerId: layer.id,
      preset: presetId,
      cloudType: props.cloudType,
      coverage: props.coverage,
    }));
  },
};

const HAZE_PRESET_IDS = ALL_PRESETS
  .filter((p) => p.category === "haze")
  .map((p) => p.id);

const addHazeTool: McpToolDefinition = {
  name: "add_haze",
  description:
    "Add a haze layer to the design. Distance-based atmospheric perspective that desaturates " +
    "and lightens distant elements. 4 gradient directions: bottom-up, top-down, center-out, uniform. " +
    `Presets: ${HAZE_PRESET_IDS.join(", ")}.`,
  inputSchema: {
    type: "object" as const,
    properties: {
      preset: {
        type: "string",
        description: "Haze preset id",
        enum: HAZE_PRESET_IDS,
      },
      seed: { type: "number", description: "Random seed" },
      color: { type: "string", description: "Haze color hex" },
      opacity: { type: "number", description: "Haze opacity 0-1" },
      gradientDirection: { type: "string", enum: ["bottom-up", "top-down", "center-out", "uniform"] },
      noiseAmount: { type: "number", description: "Noise modulation 0-1" },
      depthSlot: { type: "number", description: "Depth slot 0-1 for layering" },
    },
  },
  async handler(args: Record<string, unknown>, ctx: McpToolContext): Promise<McpToolResult> {
    const presetId = (args.preset as string) || "light-haze";
    const preset = getPreset(presetId);
    if (!preset || preset.category !== "haze") {
      return errorResult(`Unknown haze preset "${presetId}". Available: ${HAZE_PRESET_IDS.join(", ")}`);
    }
    const seed = (args.seed as number) ?? Math.floor(Math.random() * 99999);
    const overrides: Record<string, unknown> = {};
    if (args.color !== undefined) overrides.color = args.color;
    if (args.opacity !== undefined) overrides.opacity = args.opacity;
    if (args.gradientDirection !== undefined) overrides.gradientDirection = args.gradientDirection;
    if (args.noiseAmount !== undefined) overrides.noiseAmount = args.noiseAmount;
    if (args.depthSlot !== undefined) overrides.depthSlot = args.depthSlot;

    const props = hazePropsFromPreset(preset as HazePreset, seed, overrides);
    const layer = createLayer("atmosphere:haze", `Haze – ${preset.name}`, ctx, props);
    ctx.layers.add(layer);

    return textResult(JSON.stringify({
      layerId: layer.id,
      preset: presetId,
      gradientDirection: props.gradientDirection,
      opacity: props.opacity,
    }));
  },
};

const listAtmospherePresetsTool: McpToolDefinition = {
  name: "list_atmosphere_presets",
  description: "List available atmosphere presets. Filter by category (fog, mist, clouds, haze) or search by keyword.",
  inputSchema: {
    type: "object" as const,
    properties: {
      category: { type: "string", enum: ["fog", "mist", "clouds", "haze"], description: "Filter by category" },
      search: { type: "string", description: "Search presets by name, description, or tags" },
    },
  },
  async handler(args: Record<string, unknown>): Promise<McpToolResult> {
    let results: AtmospherePreset[];
    const category = args.category as PresetCategory | undefined;
    const search = args.search as string | undefined;

    if (category) {
      results = filterPresets(category);
    } else if (search) {
      const q = search.toLowerCase();
      results = ALL_PRESETS.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          p.tags.some((t) => t.includes(q)),
      );
    } else {
      results = ALL_PRESETS;
    }

    const summary = results.map((p) => ({
      id: p.id,
      name: p.name,
      category: p.category,
      description: p.description,
      layerType: categoryToLayerType(p.category),
    }));

    return textResult(JSON.stringify({ count: summary.length, presets: summary }));
  },
};

const setAtmosphereLightingTool: McpToolDefinition = {
  name: "set_atmosphere_lighting",
  description: "Set sun angle and elevation across all atmosphere:clouds layers in the design for consistent lighting.",
  inputSchema: {
    type: "object" as const,
    properties: {
      sunAngle: { type: "number", description: "Sun angle 0-360 degrees" },
      sunElevation: { type: "number", description: "Sun elevation 0-1 (0=horizon, 1=overhead)" },
    },
    required: ["sunAngle", "sunElevation"],
  },
  async handler(args: Record<string, unknown>, ctx: McpToolContext): Promise<McpToolResult> {
    const sunAngle = args.sunAngle as number;
    const sunElevation = args.sunElevation as number;
    const allLayers = ctx.layers.getAll();
    let updated = 0;

    for (const layer of allLayers) {
      if (layer.type === "atmosphere:clouds") {
        ctx.layers.updateProperties(layer.id, { sunAngle, sunElevation });
        updated++;
      }
    }

    return textResult(JSON.stringify({ updated, sunAngle, sunElevation }));
  },
};

const createAtmosphereTool: McpToolDefinition = {
  name: "create_atmosphere",
  description:
    "Auto-generate a coordinated atmospheric scene with fog + mist + clouds + haze. " +
    "Mood options: calm-morning, dramatic-storm, misty-mountain, clear-day, golden-sunset. " +
    "Creates 2-4 layers with coordinated settings.",
  inputSchema: {
    type: "object" as const,
    properties: {
      mood: {
        type: "string",
        description: "Atmospheric mood",
        enum: ["calm-morning", "dramatic-storm", "misty-mountain", "clear-day", "golden-sunset"],
      },
      seed: { type: "number", description: "Random seed" },
    },
    required: ["mood"],
  },
  async handler(args: Record<string, unknown>, ctx: McpToolContext): Promise<McpToolResult> {
    const mood = args.mood as string;
    const seed = (args.seed as number) ?? Math.floor(Math.random() * 99999);
    const layers: string[] = [];

    switch (mood) {
      case "calm-morning": {
        const fogPreset = getPreset("morning-valley-fog") as FogPreset;
        const mistPreset = getPreset("morning-mist") as MistPreset;
        const cloudPreset = getPreset("fair-weather-cumulus") as CloudPreset;
        const fogLayer = createLayer("atmosphere:fog", "Fog – Morning Valley", ctx,
          fogPropsFromPreset(fogPreset, seed, { depthSlot: 0.2, fogLayers: 2, wispDensity: 0.3 }));
        const mistLayer = createLayer("atmosphere:mist", "Mist – Morning", ctx,
          mistPropsFromPreset(mistPreset, seed + 100, { depthSlot: 0.5, colorShift: 0.2 }));
        const cloudLayer = createLayer("atmosphere:clouds", "Clouds – Fair Weather", ctx,
          cloudPropsFromPreset(cloudPreset, seed + 200, {}));
        ctx.layers.add(fogLayer);
        ctx.layers.add(mistLayer);
        ctx.layers.add(cloudLayer);
        layers.push(fogLayer.id, mistLayer.id, cloudLayer.id);
        break;
      }
      case "dramatic-storm": {
        const fogPreset = getPreset("dense-fog") as FogPreset;
        const cloudPreset = getPreset("storm-clouds") as CloudPreset;
        const fogLayer = createLayer("atmosphere:fog", "Fog – Dense Storm", ctx,
          fogPropsFromPreset(fogPreset, seed, { depthSlot: 0.3, opacity: 0.5, fogLayers: 3 }));
        const cloudLayer = createLayer("atmosphere:clouds", "Clouds – Storm", ctx,
          cloudPropsFromPreset(cloudPreset, seed + 200, {}));
        ctx.layers.add(fogLayer);
        ctx.layers.add(cloudLayer);
        layers.push(fogLayer.id, cloudLayer.id);
        break;
      }
      case "misty-mountain": {
        const fogPreset = getPreset("mountain-fog") as FogPreset;
        const mistPreset = getPreset("mountain-haze") as MistPreset;
        const hazePreset = getPreset("cool-mist-haze") as HazePreset;
        const fogLayer = createLayer("atmosphere:fog", "Fog – Mountain", ctx,
          fogPropsFromPreset(fogPreset, seed, { depthSlot: 0.2, fogLayers: 2, wispDensity: 0.4 }));
        const mistLayer = createLayer("atmosphere:mist", "Mist – Mountain Haze", ctx,
          mistPropsFromPreset(mistPreset, seed + 100, { depthSlot: 0.5, colorShift: 0.3, skyColor: "#B0C0D8" }));
        const hazeLayer = createLayer("atmosphere:haze", "Haze – Cool Mountain", ctx,
          hazePropsFromPreset(hazePreset, seed + 300, {}));
        ctx.layers.add(fogLayer);
        ctx.layers.add(mistLayer);
        ctx.layers.add(hazeLayer);
        layers.push(fogLayer.id, mistLayer.id, hazeLayer.id);
        break;
      }
      case "clear-day": {
        const cloudPreset = getPreset("fair-weather-cumulus") as CloudPreset;
        const cloudLayer = createLayer("atmosphere:clouds", "Clouds – Clear Day", ctx,
          cloudPropsFromPreset(cloudPreset, seed, { coverage: 0.2 }));
        ctx.layers.add(cloudLayer);
        layers.push(cloudLayer.id);
        break;
      }
      case "golden-sunset": {
        const mistPreset = getPreset("mountain-haze") as MistPreset;
        const cloudPreset = getPreset("sunset-cumulus") as CloudPreset;
        const hazePreset = getPreset("golden-haze") as HazePreset;
        const hazeLayer = createLayer("atmosphere:haze", "Haze – Golden", ctx,
          hazePropsFromPreset(hazePreset, seed + 300, {}));
        const mistLayer = createLayer("atmosphere:mist", "Mist – Golden Haze", ctx,
          mistPropsFromPreset(mistPreset, seed + 100, { color: "#F0E0C8", depthSlot: 0.4, colorShift: 0.3 }));
        const cloudLayer = createLayer("atmosphere:clouds", "Clouds – Sunset", ctx,
          cloudPropsFromPreset(cloudPreset, seed + 200, {}));
        ctx.layers.add(hazeLayer);
        ctx.layers.add(mistLayer);
        ctx.layers.add(cloudLayer);
        layers.push(hazeLayer.id, mistLayer.id, cloudLayer.id);
        break;
      }
      default:
        return errorResult(`Unknown mood "${mood}". Available: calm-morning, dramatic-storm, misty-mountain, clear-day, golden-sunset`);
    }

    return textResult(JSON.stringify({ mood, layerIds: layers, count: layers.length }));
  },
};

export const atmosphereMcpTools: McpToolDefinition[] = [
  addFogTool,
  addMistTool,
  addCloudsTool,
  addHazeTool,
  listAtmospherePresetsTool,
  setAtmosphereLightingTool,
  createAtmosphereTool,
];
