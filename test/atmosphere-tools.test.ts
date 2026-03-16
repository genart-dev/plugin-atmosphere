import { describe, it, expect, vi } from "vitest";
import { atmosphereMcpTools } from "../src/atmosphere-tools.js";
import type { McpToolContext, DesignLayer, LayerProperties } from "@genart-dev/core";

function createMockContext(): McpToolContext {
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

function findTool(name: string) {
  return atmosphereMcpTools.find((t) => t.name === name)!;
}

describe("atmosphere MCP tools", () => {
  it("has 7 tools", () => {
    expect(atmosphereMcpTools).toHaveLength(7);
  });

  it("all tools have name, description, inputSchema, handler", () => {
    for (const tool of atmosphereMcpTools) {
      expect(tool.name).toBeTruthy();
      expect(tool.description).toBeTruthy();
      expect(tool.inputSchema).toBeDefined();
      expect(typeof tool.handler).toBe("function");
    }
  });

  describe("add_fog", () => {
    it("adds a fog layer with default preset", async () => {
      const ctx = createMockContext();
      const result = await findTool("add_fog").handler({}, ctx);
      expect(result.isError).toBeUndefined();
      expect(ctx.layers.add).toHaveBeenCalledTimes(1);
      const layer = (ctx.layers.add as any).mock.calls[0][0] as DesignLayer;
      expect(layer.type).toBe("atmosphere:fog");
      expect(layer.properties.preset).toBe("morning-valley-fog");
    });

    it("adds a fog layer with specific preset", async () => {
      const ctx = createMockContext();
      await findTool("add_fog").handler({ preset: "sea-fog" }, ctx);
      const layer = (ctx.layers.add as any).mock.calls[0][0] as DesignLayer;
      expect(layer.properties.preset).toBe("sea-fog");
    });

    it("applies overrides", async () => {
      const ctx = createMockContext();
      await findTool("add_fog").handler({ preset: "dense-fog", density: 0.5, opacity: 0.3 }, ctx);
      const layer = (ctx.layers.add as any).mock.calls[0][0] as DesignLayer;
      expect(layer.properties.density).toBe(0.5);
      expect(layer.properties.opacity).toBe(0.3);
    });

    it("returns error for unknown preset", async () => {
      const ctx = createMockContext();
      const result = await findTool("add_fog").handler({ preset: "nonexistent" }, ctx);
      expect(result.isError).toBe(true);
    });
  });

  describe("add_mist", () => {
    it("adds a mist layer with default preset", async () => {
      const ctx = createMockContext();
      const result = await findTool("add_mist").handler({}, ctx);
      expect(result.isError).toBeUndefined();
      expect(ctx.layers.add).toHaveBeenCalledTimes(1);
      const layer = (ctx.layers.add as any).mock.calls[0][0] as DesignLayer;
      expect(layer.type).toBe("atmosphere:mist");
    });

    it("applies layerCount override", async () => {
      const ctx = createMockContext();
      await findTool("add_mist").handler({ preset: "thick-mist", layerCount: 6 }, ctx);
      const layer = (ctx.layers.add as any).mock.calls[0][0] as DesignLayer;
      expect(layer.properties.layerCount).toBe(6);
    });

    it("returns error for unknown preset", async () => {
      const ctx = createMockContext();
      const result = await findTool("add_mist").handler({ preset: "nonexistent" }, ctx);
      expect(result.isError).toBe(true);
    });
  });

  describe("add_clouds", () => {
    it("adds a cloud layer with default preset", async () => {
      const ctx = createMockContext();
      const result = await findTool("add_clouds").handler({}, ctx);
      expect(result.isError).toBeUndefined();
      const layer = (ctx.layers.add as any).mock.calls[0][0] as DesignLayer;
      expect(layer.type).toBe("atmosphere:clouds");
      expect(layer.properties.preset).toBe("fair-weather-cumulus");
    });

    it("applies sunAngle and sunElevation overrides", async () => {
      const ctx = createMockContext();
      await findTool("add_clouds").handler({ preset: "sunset-cumulus", sunAngle: 200, sunElevation: 0.1 }, ctx);
      const layer = (ctx.layers.add as any).mock.calls[0][0] as DesignLayer;
      expect(layer.properties.sunAngle).toBe(200);
      expect(layer.properties.sunElevation).toBe(0.1);
    });

    it("returns error for unknown preset", async () => {
      const ctx = createMockContext();
      const result = await findTool("add_clouds").handler({ preset: "nonexistent" }, ctx);
      expect(result.isError).toBe(true);
    });
  });

  describe("list_atmosphere_presets", () => {
    it("returns all presets when no filter", async () => {
      const ctx = createMockContext();
      const result = await findTool("list_atmosphere_presets").handler({}, ctx);
      const parsed = JSON.parse(result.content[0]!.text as string);
      expect(parsed.count).toBe(37);
    });

    it("filters by category", async () => {
      const ctx = createMockContext();
      const result = await findTool("list_atmosphere_presets").handler({ category: "fog" }, ctx);
      const parsed = JSON.parse(result.content[0]!.text as string);
      expect(parsed.count).toBe(5);
    });

    it("searches by keyword", async () => {
      const ctx = createMockContext();
      const result = await findTool("list_atmosphere_presets").handler({ search: "storm" }, ctx);
      const parsed = JSON.parse(result.content[0]!.text as string);
      expect(parsed.count).toBeGreaterThan(0);
    });
  });

  describe("set_atmosphere_lighting", () => {
    it("updates sunAngle and sunElevation on cloud layers", async () => {
      const ctx = createMockContext();
      await findTool("add_clouds").handler({ preset: "fair-weather-cumulus" }, ctx);
      await findTool("add_clouds").handler({ preset: "sunset-cumulus" }, ctx);

      const result = await findTool("set_atmosphere_lighting").handler({ sunAngle: 90, sunElevation: 0.8 }, ctx);
      const parsed = JSON.parse(result.content[0]!.text as string);
      expect(parsed.updated).toBe(2);
      expect(ctx.layers.updateProperties).toHaveBeenCalledTimes(2);
    });

    it("returns 0 updated when no cloud layers", async () => {
      const ctx = createMockContext();
      const result = await findTool("set_atmosphere_lighting").handler({ sunAngle: 90, sunElevation: 0.8 }, ctx);
      const parsed = JSON.parse(result.content[0]!.text as string);
      expect(parsed.updated).toBe(0);
    });
  });

  describe("create_atmosphere", () => {
    it("creates calm-morning scene with 3 layers", async () => {
      const ctx = createMockContext();
      const result = await findTool("create_atmosphere").handler({ mood: "calm-morning" }, ctx);
      const parsed = JSON.parse(result.content[0]!.text as string);
      expect(parsed.mood).toBe("calm-morning");
      expect(parsed.count).toBe(3);
      expect(ctx.layers.add).toHaveBeenCalledTimes(3);
    });

    it("creates dramatic-storm scene with 2 layers", async () => {
      const ctx = createMockContext();
      const result = await findTool("create_atmosphere").handler({ mood: "dramatic-storm" }, ctx);
      const parsed = JSON.parse(result.content[0]!.text as string);
      expect(parsed.count).toBe(2);
    });

    it("creates misty-mountain scene with 3 layers", async () => {
      const ctx = createMockContext();
      const result = await findTool("create_atmosphere").handler({ mood: "misty-mountain" }, ctx);
      const parsed = JSON.parse(result.content[0]!.text as string);
      expect(parsed.count).toBe(3);
    });

    it("creates clear-day scene with 1 layer", async () => {
      const ctx = createMockContext();
      const result = await findTool("create_atmosphere").handler({ mood: "clear-day" }, ctx);
      const parsed = JSON.parse(result.content[0]!.text as string);
      expect(parsed.count).toBe(1);
    });

    it("creates golden-sunset scene with 3 layers", async () => {
      const ctx = createMockContext();
      const result = await findTool("create_atmosphere").handler({ mood: "golden-sunset" }, ctx);
      const parsed = JSON.parse(result.content[0]!.text as string);
      expect(parsed.count).toBe(3);
    });

    it("returns error for unknown mood", async () => {
      const ctx = createMockContext();
      const result = await findTool("create_atmosphere").handler({ mood: "unknown" }, ctx);
      expect(result.isError).toBe(true);
    });
  });
});
