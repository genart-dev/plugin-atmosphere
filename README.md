# @genart-dev/plugin-atmosphere

Atmospheric effects for [genart.dev](https://genart.dev) — fog, mist, and cloud layers with terrain masking and depth stacking. 16 presets across 3 categories, with 6 MCP tools for AI-agent control.

Part of [genart.dev](https://genart.dev) — a generative art platform with an MCP server, desktop app, and IDE extensions.

## Install

```bash
npm install @genart-dev/plugin-atmosphere
```

## Usage

```typescript
import atmospherePlugin from "@genart-dev/plugin-atmosphere";
import { createDefaultRegistry } from "@genart-dev/core";

const registry = createDefaultRegistry();
registry.registerPlugin(atmospherePlugin);

// Or access individual exports
import {
  ALL_PRESETS,
  getPreset,
  filterPresets,
  searchPresets,
  fogLayerType,
  mistLayerType,
  cloudsLayerType,
} from "@genart-dev/plugin-atmosphere";
```

## Layer Types (3)

| Layer Type | Category | Default Preset | Description |
|---|---|---|---|
| `atmosphere:fog` | Fog (5) | `morning-valley-fog` | Ground-level fog with terrain masking support, 4 fog types |
| `atmosphere:mist` | Mist (4) | `morning-mist` | Mid-level haze bands with parallax stacking and drift |
| `atmosphere:clouds` | Clouds (7) | `fair-weather-cumulus` | Sky-level formations with 3 algorithms and lighting model |

## Presets (16)

### Fog (5)

| Preview | ID | Name | Description |
|---|---|---|---|
| [![](examples/fog/morning-valley-fog.png)](examples/fog/morning-valley-fog.png) | `morning-valley-fog` | Morning Valley Fog | Calm radiation fog settling in valleys at dawn |
| [![](examples/fog/sea-fog.png)](examples/fog/sea-fog.png) | `sea-fog` | Sea Fog | Dense advection fog rolling in from the coast |
| [![](examples/fog/mountain-fog.png)](examples/fog/mountain-fog.png) | `mountain-fog` | Mountain Fog | Upslope fog clinging to mountain ridges, patchy and layered |
| [![](examples/fog/dense-fog.png)](examples/fog/dense-fog.png) | `dense-fog` | Dense Fog | Thick valley fog reducing visibility to near zero |
| [![](examples/fog/patchy-fog.png)](examples/fog/patchy-fog.png) | `patchy-fog` | Patchy Fog | Scattered fog patches with terrain features visible between gaps |

### Mist (4)

| Preview | ID | Name | Description |
|---|---|---|---|
| [![](examples/mist/morning-mist.png)](examples/mist/morning-mist.png) | `morning-mist` | Morning Mist | Light haze bands creating gentle depth separation at dawn |
| [![](examples/mist/mountain-haze.png)](examples/mist/mountain-haze.png) | `mountain-haze` | Mountain Haze | Layered blue-gray haze between mountain ridges |
| [![](examples/mist/thick-mist.png)](examples/mist/thick-mist.png) | `thick-mist` | Thick Mist | Heavy mist reducing visibility, strong atmospheric presence |
| [![](examples/mist/layered-mist.png)](examples/mist/layered-mist.png) | `layered-mist` | Layered Mist | Multiple distinct mist bands with strong parallax depth |

### Clouds (7)

| Preview | ID | Name | Description |
|---|---|---|---|
| [![](examples/clouds/fair-weather-cumulus.png)](examples/clouds/fair-weather-cumulus.png) | `fair-weather-cumulus` | Fair Weather Cumulus | Scattered puffy cumulus on a clear day, flat bases and rounded tops |
| [![](examples/clouds/towering-cumulus.png)](examples/clouds/towering-cumulus.png) | `towering-cumulus` | Towering Cumulus | Large vertical cumulus with dramatic light and shadow |
| [![](examples/clouds/overcast-stratus.png)](examples/clouds/overcast-stratus.png) | `overcast-stratus` | Overcast Stratus | Flat uniform cloud layer covering most of the sky |
| [![](examples/clouds/stratocumulus-field.png)](examples/clouds/stratocumulus-field.png) | `stratocumulus-field` | Stratocumulus Field | Regular field of rounded cloud patches with gaps |
| [![](examples/clouds/wispy-cirrus.png)](examples/clouds/wispy-cirrus.png) | `wispy-cirrus` | Wispy Cirrus | High-altitude ice crystal streaks, thin and translucent |
| [![](examples/clouds/sunset-cumulus.png)](examples/clouds/sunset-cumulus.png) | `sunset-cumulus` | Sunset Cumulus | Cumulus clouds lit from below by warm sunset light |
| [![](examples/clouds/storm-clouds.png)](examples/clouds/storm-clouds.png) | `storm-clouds` | Storm Clouds | Dark heavy cumulonimbus with dramatic light contrast |

## Mood Scenes (5)

The `create_atmosphere` MCP tool composes multi-layer scenes from curated preset combinations:

| Preview | Mood | Layers | Description |
|---|---|---|---|
| [![](examples/scenes/calm-morning.png)](examples/scenes/calm-morning.png) | `calm-morning` | fog + mist + cumulus | Valley fog, morning mist bands, and fair-weather clouds |
| [![](examples/scenes/dramatic-storm.png)](examples/scenes/dramatic-storm.png) | `dramatic-storm` | dense fog + storm clouds | Heavy fog with towering dark cumulonimbus |
| [![](examples/scenes/misty-mountain.png)](examples/scenes/misty-mountain.png) | `misty-mountain` | mountain fog + haze | Upslope fog with blue-gray mountain haze |
| [![](examples/scenes/clear-day.png)](examples/scenes/clear-day.png) | `clear-day` | cumulus only | Scattered fair-weather cumulus on a blue sky |
| [![](examples/scenes/golden-sunset.png)](examples/scenes/golden-sunset.png) | `golden-sunset` | haze + sunset cumulus | Warm mountain haze with sunset-lit cumulus |

## Rendering

Each layer type renders via canvas2d at reduced resolution for performance:

- **Fog** — Domain-warped fractal noise with patchiness control, vertical color gradient, fog-type modifiers (valley = denser at bottom, upslope = denser at top). 1/4 resolution.
- **Mist** — Multi-layer parallax noise bands with per-layer noise scale variation and drift offset. 1/4 resolution.
- **Clouds** — Three algorithms:
  - *Discrete*: Poisson-placed cloud bodies with noise-displaced edges and sun-angle lighting
  - *Threshold*: Warped noise field with coverage threshold and self-shadowing
  - *Streak*: Semi-transparent dots along curved paths for wispy cirrus

## Terrain Masking (ADR 083)

Atmosphere layers are designed to work with the compositor masking system:

```typescript
// Fog masked by terrain:profile — fog is occluded by foreground terrain
layers.setMask(fogLayerId, terrainProfileId, "alpha");

// Mist behind terrain — mist only shows behind terrain ridges
layers.setMask(mistLayerId, terrainProfileId, "inverted-alpha");
```

The masking is handled by the compositor in `@genart-dev/core@^0.7.0`, not by the plugin itself.

## Depth Slot System

Every atmosphere layer has a `depthSlot` property (0-1) for front-to-back ordering:

- `0` = closest to viewer (foreground)
- `1` = farthest background (sky level)

Default values: fog = 0.2, mist = 0.6, clouds = 1.0.

## MCP Tools (6)

Exposed to AI agents through the MCP server when this plugin is registered:

| Tool | Description |
|---|---|
| `add_fog` | Add a fog layer by preset with optional overrides (fogType, density, color, opacity) |
| `add_mist` | Add a mist layer by preset with optional overrides (density, layerCount, color) |
| `add_clouds` | Add a cloud layer by preset with optional overrides (cloudType, coverage, sunAngle) |
| `list_atmosphere_presets` | List all presets, optionally filtered by category or search keyword |
| `set_atmosphere_lighting` | Set sunAngle and sunElevation across all cloud layers for consistent lighting |
| `create_atmosphere` | Compose a multi-layer atmospheric scene from 5 mood presets |

## Utilities

Shared utilities exported for advanced use:

```typescript
import {
  mulberry32,                                          // Deterministic PRNG
  createValueNoise, createFractalNoise, createWarpedNoise, // Procedural noise
  parseHex, toHex, lerpColor, varyColor,               // Color utils
} from "@genart-dev/plugin-atmosphere";
```

## Preset Discovery

```typescript
import { ALL_PRESETS, filterPresets, searchPresets, getPreset } from "@genart-dev/plugin-atmosphere";

// All 16 presets
console.log(ALL_PRESETS.length); // 16

// Filter by category
const fog = filterPresets("fog");       // 5 presets
const clouds = filterPresets("clouds"); // 7 presets

// Full-text search
const results = searchPresets("storm"); // storm-clouds

// Look up by ID
const preset = getPreset("sunset-cumulus");
```

## Examples

The `examples/` directory contains 21 `.genart` files (16 individual presets + 5 mood scenes) with rendered PNG thumbnails.

```bash
# Generate .genart example files
node generate-examples.cjs

# Render all examples to PNG (requires @genart-dev/cli)
node render-examples.cjs
```

## Related Packages

| Package | Purpose |
|---|---|
| [`@genart-dev/core`](https://github.com/genart-dev/core) | Plugin host, layer system, compositor masking (dependency) |
| [`@genart-dev/mcp-server`](https://github.com/genart-dev/mcp-server) | MCP server that surfaces plugin tools to AI agents |
| [`@genart-dev/plugin-terrain`](https://github.com/genart-dev/plugin-terrain) | Sky, terrain profiles — provides masking sources for fog/mist |
| [`@genart-dev/plugin-particles`](https://github.com/genart-dev/plugin-particles) | Particle effects (snow, rain, fireflies) — pairs with atmosphere layers |
| [`@genart-dev/plugin-painting`](https://github.com/genart-dev/plugin-painting) | Vector-field-driven painting layers |
| [`@genart-dev/plugin-plants`](https://github.com/genart-dev/plugin-plants) | Algorithmic plant generation (110 presets) |
| [`@genart-dev/plugin-patterns`](https://github.com/genart-dev/plugin-patterns) | Geometric and cultural pattern fills (153 presets) |
| [`@genart-dev/plugin-compositing`](https://github.com/genart-dev/plugin-compositing) | Compositing tools including mask set/clear |

## Support

Questions, bugs, or feedback — [support@genart.dev](mailto:support@genart.dev) or [open an issue](https://github.com/genart-dev/plugin-atmosphere/issues).

## License

MIT
