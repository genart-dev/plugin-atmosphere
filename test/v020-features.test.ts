import { describe, it, expect, vi } from "vitest";
import { createWorleyNoise } from "../src/shared/noise.js";
import { smootherstep, bilinearUpscale } from "../src/layers/shared.js";
import { CLOUD_TYPE_CONFIGS, getCloudTypeConfig, generateFormations } from "../src/layers/clouds.js";
import { cloudsLayerType } from "../src/layers/clouds.js";
import { fogLayerType } from "../src/layers/fog.js";
import { mistLayerType } from "../src/layers/mist.js";
import { hazeLayerType } from "../src/layers/haze.js";
import { atmosphereMcpTools } from "../src/atmosphere-tools.js";
import { filterPresets } from "../src/presets/index.js";
import type { McpToolContext, DesignLayer } from "@genart-dev/core";

function createMockCtx() {
  return {
    beginPath: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    fillRect: vi.fn(),
    ellipse: vi.fn(),
    createImageData: vi.fn((w: number, h: number) => ({
      data: new Uint8ClampedArray(w * h * 4),
      width: w,
      height: h,
    })),
    putImageData: vi.fn(),
    drawImage: vi.fn(),
    fillStyle: "",
    globalAlpha: 1,
    save: vi.fn(),
    restore: vi.fn(),
  } as unknown as CanvasRenderingContext2D;
}

function createMockMcpContext(): McpToolContext {
  const layers: DesignLayer[] = [];
  return {
    canvasWidth: 800,
    canvasHeight: 600,
    layers: {
      add: vi.fn((layer: DesignLayer) => { layers.push(layer); }),
      getAll: vi.fn(() => [...layers]),
      updateProperties: vi.fn(),
      removeLayer: vi.fn(),
      getLayer: vi.fn((id: string) => layers.find((l) => l.id === id)),
    },
  } as unknown as McpToolContext;
}

const BOUNDS = { x: 0, y: 0, width: 800, height: 600, rotation: 0, scaleX: 1, scaleY: 1 };

describe("Worley noise", () => {
  it("returns values in [0, 1]", () => {
    const worley = createWorleyNoise(42, 15);
    for (let i = 0; i < 100; i++) {
      const v = worley(Math.random(), Math.random());
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  it("is deterministic with same seed", () => {
    const w1 = createWorleyNoise(123, 20);
    const w2 = createWorleyNoise(123, 20);
    for (let i = 0; i < 20; i++) {
      const x = Math.random();
      const y = Math.random();
      expect(w1(x, y)).toBe(w2(x, y));
    }
  });

  it("produces different patterns with different seeds", () => {
    const w1 = createWorleyNoise(42);
    const w2 = createWorleyNoise(99);
    let different = false;
    for (let i = 0; i < 10; i++) {
      if (w1(0.5 + i * 0.01, 0.5) !== w2(0.5 + i * 0.01, 0.5)) different = true;
    }
    expect(different).toBe(true);
  });

  it("is zero at feature points (approximately)", () => {
    const worley = createWorleyNoise(42, 5);
    // With only 5 points, at least some samples should be near 0
    let minVal = 1;
    for (let x = 0; x < 1; x += 0.01) {
      for (let y = 0; y < 1; y += 0.01) {
        minVal = Math.min(minVal, worley(x, y));
      }
    }
    expect(minVal).toBeLessThan(0.15);
  });

  it("wraps seamlessly", () => {
    const worley = createWorleyNoise(42, 15);
    // Values near edges should be close to values wrapped around
    const val0 = worley(0.01, 0.5);
    const val1 = worley(1.01, 0.5);
    expect(Math.abs(val0 - val1)).toBeLessThan(0.3);
  });
});

describe("smootherstep", () => {
  it("returns 0 for t=0", () => {
    expect(smootherstep(0)).toBe(0);
  });

  it("returns 1 for t=1", () => {
    expect(smootherstep(1)).toBe(1);
  });

  it("returns 0.5 for t=0.5", () => {
    expect(smootherstep(0.5)).toBe(0.5);
  });

  it("clamps below 0", () => {
    expect(smootherstep(-0.5)).toBe(0);
  });

  it("clamps above 1", () => {
    expect(smootherstep(1.5)).toBe(1);
  });

  it("is monotonically increasing", () => {
    let prev = 0;
    for (let t = 0.01; t <= 1; t += 0.01) {
      const v = smootherstep(t);
      expect(v).toBeGreaterThanOrEqual(prev);
      prev = v;
    }
  });
});

describe("bilinearUpscale", () => {
  it("scales a 1x1 image to fill dst", () => {
    const src = new Uint8ClampedArray([100, 150, 200, 255]);
    const dst = new Uint8ClampedArray(4 * 4 * 4);
    bilinearUpscale(src, 1, 1, dst, 4, 4);
    // All pixels should be the same color
    for (let i = 0; i < 16; i++) {
      expect(dst[i * 4]).toBe(100);
      expect(dst[i * 4 + 1]).toBe(150);
      expect(dst[i * 4 + 2]).toBe(200);
      expect(dst[i * 4 + 3]).toBe(255);
    }
  });

  it("interpolates between pixels", () => {
    // 2x1: black on left, white on right
    const src = new Uint8ClampedArray([0, 0, 0, 255, 255, 255, 255, 255]);
    const dst = new Uint8ClampedArray(8 * 1 * 4);
    bilinearUpscale(src, 2, 1, dst, 8, 1);
    // Rightmost pixels should be near white, leftmost near black,
    // middle pixels should be interpolated
    const rightR = dst[7 * 4]!;
    const leftR = dst[0]!;
    expect(rightR).toBeGreaterThan(leftR);
  });
});

describe("22 cloud type configs", () => {
  it("has 20 cloud types", () => {
    expect(Object.keys(CLOUD_TYPE_CONFIGS)).toHaveLength(20);
  });

  it("each config has required fields", () => {
    for (const [name, config] of Object.entries(CLOUD_TYPE_CONFIGS)) {
      expect(["discrete", "threshold", "streak"]).toContain(config.algorithm);
      expect(config.billowCount[0]).toBeLessThanOrEqual(config.billowCount[1]);
      expect(config.aspectRatio).toBeGreaterThan(0);
      expect(config.defaultCoverage).toBeGreaterThanOrEqual(0);
      expect(config.defaultCoverage).toBeLessThanOrEqual(1);
      expect(["high", "mid", "low", "vertical", "special"]).toContain(config.altitudeBand);
    }
  });

  it("getCloudTypeConfig falls back to cumulus for unknown type", () => {
    const config = getCloudTypeConfig("nonexistent");
    expect(config.algorithm).toBe("discrete");
    expect(config.billowCount).toEqual([4, 6]);
  });
});

describe("CloudFormation generation", () => {
  it("generates requested number of formations", () => {
    const formations = generateFormations(42, 3, 1.0, CLOUD_TYPE_CONFIGS["cumulus"]!);
    expect(formations).toHaveLength(3);
  });

  it("cumulus formations have multiple billows", () => {
    const formations = generateFormations(42, 1, 1.0, CLOUD_TYPE_CONFIGS["cumulus"]!);
    expect(formations[0]!.billows.length).toBeGreaterThanOrEqual(4);
  });

  it("lenticular formations have few billows", () => {
    const formations = generateFormations(42, 1, 1.0, CLOUD_TYPE_CONFIGS["lenticular"]!);
    expect(formations[0]!.billows.length).toBeLessThanOrEqual(2);
  });

  it("formations have valid bounds", () => {
    const formations = generateFormations(42, 5, 1.0, CLOUD_TYPE_CONFIGS["cumulonimbus"]!);
    for (const f of formations) {
      expect(f.cx).toBeGreaterThanOrEqual(0);
      expect(f.cx).toBeLessThanOrEqual(1);
      expect(f.width).toBeGreaterThan(0);
      expect(f.height).toBeGreaterThan(0);
    }
  });

  it("is deterministic with same seed", () => {
    const f1 = generateFormations(99, 3, 1.0, CLOUD_TYPE_CONFIGS["cumulus"]!);
    const f2 = generateFormations(99, 3, 1.0, CLOUD_TYPE_CONFIGS["cumulus"]!);
    expect(f1[0]!.cx).toBe(f2[0]!.cx);
    expect(f1[0]!.billows.length).toBe(f2[0]!.billows.length);
  });
});

describe("render all 22 cloud presets", () => {
  const ALL_CLOUD_PRESET_IDS = [
    "fair-weather-cumulus", "towering-cumulus", "overcast-stratus",
    "stratocumulus-field", "wispy-cirrus", "sunset-cumulus", "storm-clouds",
    "mackerel-sky", "cirrostratus-veil", "altocumulus-field",
    "altostratus-sheet", "castellanus-turrets", "cumulus-congestus",
    "nimbostratus-overcast", "cumulonimbus-anvil", "lenticular-lens",
    "mammatus-pouches", "fog-bank-low", "contrail-thin",
    "pyrocumulus-dark", "banner-peak", "pileus-cap",
  ];

  for (const presetId of ALL_CLOUD_PRESET_IDS) {
    it(`renders ${presetId} without error`, () => {
      const ctx = createMockCtx();
      const props = { ...cloudsLayerType.createDefault(), preset: presetId };
      expect(() => cloudsLayerType.render(props, ctx, BOUNDS, {} as any)).not.toThrow();
    });
  }
});

describe("fog stacking + wisps", () => {
  it("fogLayers defaults to 1", () => {
    const defaults = fogLayerType.createDefault();
    expect(defaults.fogLayers).toBe(1);
  });

  it("wispDensity defaults to 0", () => {
    const defaults = fogLayerType.createDefault();
    expect(defaults.wispDensity).toBe(0);
  });

  it("render with fogLayers=3 executes without error", () => {
    const ctx = createMockCtx();
    const props = { ...fogLayerType.createDefault(), fogLayers: 3 };
    expect(() => fogLayerType.render(props, ctx, BOUNDS, {} as any)).not.toThrow();
  });

  it("render with wispDensity=0.5 calls ellipse for wisps", () => {
    const ctx = createMockCtx();
    const props = { ...fogLayerType.createDefault(), wispDensity: 0.5 };
    fogLayerType.render(props, ctx, BOUNDS, {} as any);
    expect(ctx.ellipse).toHaveBeenCalled();
  });

  it("render with wispDensity=0 does not call ellipse", () => {
    const ctx = createMockCtx();
    const props = { ...fogLayerType.createDefault(), wispDensity: 0 };
    fogLayerType.render(props, ctx, BOUNDS, {} as any);
    expect(ctx.ellipse).not.toHaveBeenCalled();
  });

  it("properties include fogLayers and wispDensity", () => {
    const keys = fogLayerType.properties.map((p) => p.key);
    expect(keys).toContain("fogLayers");
    expect(keys).toContain("wispDensity");
  });
});

describe("mist color shift", () => {
  it("skyColor defaults to #C0D0E8", () => {
    const defaults = mistLayerType.createDefault();
    expect(defaults.skyColor).toBe("#C0D0E8");
  });

  it("colorShift defaults to 0", () => {
    const defaults = mistLayerType.createDefault();
    expect(defaults.colorShift).toBe(0);
  });

  it("render with colorShift=0.5 executes without error", () => {
    const ctx = createMockCtx();
    const props = { ...mistLayerType.createDefault(), colorShift: 0.5, layerCount: 4 };
    expect(() => mistLayerType.render(props, ctx, BOUNDS, {} as any)).not.toThrow();
  });

  it("properties include skyColor and colorShift", () => {
    const keys = mistLayerType.properties.map((p) => p.key);
    expect(keys).toContain("skyColor");
    expect(keys).toContain("colorShift");
  });
});

describe("add_haze MCP tool", () => {
  function findTool(name: string) {
    return atmosphereMcpTools.find((t) => t.name === name)!;
  }

  it("adds a haze layer with default preset", async () => {
    const ctx = createMockMcpContext();
    const result = await findTool("add_haze").handler({}, ctx);
    expect(result.isError).toBeUndefined();
    expect(ctx.layers.add).toHaveBeenCalledTimes(1);
    const layer = (ctx.layers.add as any).mock.calls[0][0] as DesignLayer;
    expect(layer.type).toBe("atmosphere:haze");
    expect(layer.properties.preset).toBe("light-haze");
  });

  it("applies overrides", async () => {
    const ctx = createMockMcpContext();
    await findTool("add_haze").handler({ preset: "golden-haze", opacity: 0.5 }, ctx);
    const layer = (ctx.layers.add as any).mock.calls[0][0] as DesignLayer;
    expect(layer.properties.preset).toBe("golden-haze");
    expect(layer.properties.opacity).toBe(0.5);
  });

  it("returns error for unknown preset", async () => {
    const ctx = createMockMcpContext();
    const result = await findTool("add_haze").handler({ preset: "nonexistent" }, ctx);
    expect(result.isError).toBe(true);
  });

  it("filters haze presets via list tool", async () => {
    const ctx = createMockMcpContext();
    const result = await findTool("list_atmosphere_presets").handler({ category: "haze" }, ctx);
    const parsed = JSON.parse(result.content[0]!.text as string);
    expect(parsed.count).toBe(6);
  });
});

describe("haze presets", () => {
  it("haze presets have haze-specific fields", () => {
    const hazePresets = filterPresets("haze");
    for (const p of hazePresets) {
      expect(p.category).toBe("haze");
      expect(typeof p.color).toBe("string");
      expect(typeof p.opacity).toBe("number");
      expect(typeof p.yPosition).toBe("number");
      expect(typeof p.height).toBe("number");
      expect(["bottom-up", "top-down", "center-out", "uniform"]).toContain(p.gradientDirection);
      expect(typeof p.noiseAmount).toBe("number");
    }
  });
});
