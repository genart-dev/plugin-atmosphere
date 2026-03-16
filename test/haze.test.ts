import { describe, it, expect, vi } from "vitest";
import { hazeLayerType } from "../src/layers/haze.js";

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
    save: vi.fn(),
    restore: vi.fn(),
  } as unknown as CanvasRenderingContext2D;
}

const BOUNDS = { x: 0, y: 0, width: 800, height: 600, rotation: 0, scaleX: 1, scaleY: 1 };

describe("atmosphere:haze", () => {
  it("has correct typeId", () => {
    expect(hazeLayerType.typeId).toBe("atmosphere:haze");
  });

  it("has category draw", () => {
    expect(hazeLayerType.category).toBe("draw");
  });

  it("createDefault returns valid properties", () => {
    const defaults = hazeLayerType.createDefault();
    expect(defaults.preset).toBe("light-haze");
    expect(defaults.color).toBe("#D8E0EC");
    expect(defaults.opacity).toBe(0.25);
    expect(defaults.gradientDirection).toBe("bottom-up");
    expect(defaults.noiseAmount).toBe(0.2);
  });

  it("render with default props executes without error", () => {
    const ctx = createMockCtx();
    expect(() => hazeLayerType.render(hazeLayerType.createDefault(), ctx, BOUNDS, {} as any)).not.toThrow();
  });

  it("render uses createImageData and putImageData", () => {
    const ctx = createMockCtx();
    hazeLayerType.render(hazeLayerType.createDefault(), ctx, BOUNDS, {} as any);
    expect(ctx.createImageData).toHaveBeenCalledTimes(2);
    expect(ctx.putImageData).toHaveBeenCalledTimes(1);
  });

  it("render with bottom-up gradient executes", () => {
    const ctx = createMockCtx();
    const props = { ...hazeLayerType.createDefault(), gradientDirection: "bottom-up" };
    expect(() => hazeLayerType.render(props, ctx, BOUNDS, {} as any)).not.toThrow();
  });

  it("render with top-down gradient executes", () => {
    const ctx = createMockCtx();
    const props = { ...hazeLayerType.createDefault(), gradientDirection: "top-down" };
    expect(() => hazeLayerType.render(props, ctx, BOUNDS, {} as any)).not.toThrow();
  });

  it("render with center-out gradient executes", () => {
    const ctx = createMockCtx();
    const props = { ...hazeLayerType.createDefault(), gradientDirection: "center-out" };
    expect(() => hazeLayerType.render(props, ctx, BOUNDS, {} as any)).not.toThrow();
  });

  it("render with uniform gradient executes", () => {
    const ctx = createMockCtx();
    const props = { ...hazeLayerType.createDefault(), gradientDirection: "uniform" };
    expect(() => hazeLayerType.render(props, ctx, BOUNDS, {} as any)).not.toThrow();
  });

  it("render with all haze presets executes without error", () => {
    const ctx = createMockCtx();
    for (const id of ["light-haze", "golden-haze", "cool-mist-haze", "heat-haze", "ink-wash-haze", "twilight-haze"]) {
      expect(() => hazeLayerType.render({ ...hazeLayerType.createDefault(), preset: id }, ctx, BOUNDS, {} as any)).not.toThrow();
    }
  });

  it("validate passes for valid preset", () => {
    expect(hazeLayerType.validate({ preset: "light-haze" })).toBeNull();
  });

  it("validate fails for unknown preset", () => {
    const errors = hazeLayerType.validate({ preset: "unknown-haze" });
    expect(errors).toHaveLength(1);
  });

  it("properties include expected schemas", () => {
    const keys = hazeLayerType.properties.map((p) => p.key);
    expect(keys).toContain("color");
    expect(keys).toContain("opacity");
    expect(keys).toContain("yPosition");
    expect(keys).toContain("height");
    expect(keys).toContain("gradientDirection");
    expect(keys).toContain("noiseAmount");
    expect(keys).toContain("depthSlot");
  });

  it("render with zero noise executes", () => {
    const ctx = createMockCtx();
    const props = { ...hazeLayerType.createDefault(), noiseAmount: 0 };
    expect(() => hazeLayerType.render(props, ctx, BOUNDS, {} as any)).not.toThrow();
  });
});
