import { describe, it, expect, vi } from "vitest";
import { cloudsLayerType } from "../src/layers/clouds.js";

function createMockCtx() {
  return {
    beginPath: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    fillRect: vi.fn(),
    createImageData: vi.fn((w: number, h: number) => ({
      data: new Uint8ClampedArray(w * h * 4),
      width: w,
      height: h,
    })),
    putImageData: vi.fn(),
    drawImage: vi.fn(),
    fillStyle: "",
    globalAlpha: 1,
  } as unknown as CanvasRenderingContext2D;
}

const BOUNDS = { x: 0, y: 0, width: 800, height: 600, rotation: 0, scaleX: 1, scaleY: 1 };

describe("atmosphere:clouds", () => {
  it("has correct typeId", () => {
    expect(cloudsLayerType.typeId).toBe("atmosphere:clouds");
  });

  it("has category draw", () => {
    expect(cloudsLayerType.category).toBe("draw");
  });

  it("createDefault returns valid properties", () => {
    const defaults = cloudsLayerType.createDefault();
    expect(defaults.preset).toBe("fair-weather-cumulus");
    expect(defaults.cloudType).toBe("cumulus");
    expect(defaults.algorithm).toBe("discrete");
    expect(defaults.coverage).toBe(0.3);
    expect(defaults.sunAngle).toBe(135);
    expect(defaults.sunElevation).toBe(0.6);
  });

  it("render with discrete algorithm executes without error", () => {
    const ctx = createMockCtx();
    const props = { ...cloudsLayerType.createDefault(), algorithm: "discrete", cloudCount: 2 };
    expect(() => cloudsLayerType.render(props, ctx, BOUNDS, {} as any)).not.toThrow();
  });

  it("render with threshold algorithm executes without error", () => {
    const ctx = createMockCtx();
    const props = { ...cloudsLayerType.createDefault(), algorithm: "threshold" };
    expect(() => cloudsLayerType.render(props, ctx, BOUNDS, {} as any)).not.toThrow();
  });

  it("render with streak algorithm executes without error", () => {
    const ctx = createMockCtx();
    const props = { ...cloudsLayerType.createDefault(), algorithm: "streak", cloudCount: 3 };
    expect(() => cloudsLayerType.render(props, ctx, BOUNDS, {} as any)).not.toThrow();
  });

  it("render uses createImageData and putImageData", () => {
    const ctx = createMockCtx();
    cloudsLayerType.render({ ...cloudsLayerType.createDefault(), cloudCount: 1 }, ctx, BOUNDS, {} as any);
    expect(ctx.createImageData).toHaveBeenCalledTimes(2);
    expect(ctx.putImageData).toHaveBeenCalledTimes(1);
  });

  it("render with sunset preset (low sunElevation) executes without error", () => {
    const ctx = createMockCtx();
    const props = { ...cloudsLayerType.createDefault(), preset: "sunset-cumulus", sunElevation: 0.15, cloudCount: 2 };
    expect(() => cloudsLayerType.render(props, ctx, BOUNDS, {} as any)).not.toThrow();
  });

  it("render with storm preset executes without error", () => {
    const ctx = createMockCtx();
    const props = { ...cloudsLayerType.createDefault(), preset: "storm-clouds", algorithm: "discrete", cloudCount: 2 };
    expect(() => cloudsLayerType.render(props, ctx, BOUNDS, {} as any)).not.toThrow();
  });

  it("validate passes for valid preset", () => {
    expect(cloudsLayerType.validate({ preset: "fair-weather-cumulus" })).toBeNull();
  });

  it("validate passes for all cloud presets", () => {
    for (const id of [
      "fair-weather-cumulus", "towering-cumulus", "overcast-stratus",
      "stratocumulus-field", "wispy-cirrus", "sunset-cumulus", "storm-clouds",
    ]) {
      expect(cloudsLayerType.validate({ preset: id })).toBeNull();
    }
  });

  it("validate fails for unknown preset", () => {
    const errors = cloudsLayerType.validate({ preset: "unknown-cloud" });
    expect(errors).toHaveLength(1);
  });

  it("properties include expected schemas", () => {
    const keys = cloudsLayerType.properties.map((p) => p.key);
    expect(keys).toContain("cloudType");
    expect(keys).toContain("algorithm");
    expect(keys).toContain("coverage");
    expect(keys).toContain("altitude");
    expect(keys).toContain("scale");
    expect(keys).toContain("cloudCount");
    expect(keys).toContain("edgeComplexity");
    expect(keys).toContain("turbulence");
    expect(keys).toContain("cloudColor");
    expect(keys).toContain("shadowColor");
    expect(keys).toContain("highlightColor");
    expect(keys).toContain("sunAngle");
    expect(keys).toContain("sunElevation");
    expect(keys).toContain("depthSlot");
  });

  it("createDefault has depthSlot 1.0 (sky level)", () => {
    expect(cloudsLayerType.createDefault().depthSlot).toBe(1.0);
  });
});
