import { describe, it, expect, vi } from "vitest";
import { mistLayerType } from "../src/layers/mist.js";

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

describe("atmosphere:mist", () => {
  it("has correct typeId", () => {
    expect(mistLayerType.typeId).toBe("atmosphere:mist");
  });

  it("has category draw", () => {
    expect(mistLayerType.category).toBe("draw");
  });

  it("createDefault returns valid properties", () => {
    const defaults = mistLayerType.createDefault();
    expect(defaults.preset).toBe("morning-mist");
    expect(defaults.density).toBe(0.4);
    expect(defaults.layerCount).toBe(3);
    expect(defaults.bandTop).toBe(0.5);
    expect(defaults.bandBottom).toBe(0.8);
  });

  it("render executes without error", () => {
    const ctx = createMockCtx();
    const props = { ...mistLayerType.createDefault(), layerCount: 1 };
    expect(() => mistLayerType.render(props, ctx, BOUNDS, {} as any)).not.toThrow();
  });

  it("render uses createImageData and putImageData", () => {
    const ctx = createMockCtx();
    mistLayerType.render({ ...mistLayerType.createDefault(), layerCount: 1 }, ctx, BOUNDS, {} as any);
    expect(ctx.createImageData).toHaveBeenCalledTimes(2);
    expect(ctx.putImageData).toHaveBeenCalledTimes(1);
    expect(ctx.drawImage).not.toHaveBeenCalled();
  });

  it("render with multiple layers executes without error", () => {
    const ctx = createMockCtx();
    const props = { ...mistLayerType.createDefault(), layerCount: 5 };
    expect(() => mistLayerType.render(props, ctx, BOUNDS, {} as any)).not.toThrow();
  });

  it("render skips when bandTop >= bandBottom", () => {
    const ctx = createMockCtx();
    const props = { ...mistLayerType.createDefault(), bandTop: 0.9, bandBottom: 0.1 };
    mistLayerType.render(props, ctx, BOUNDS, {} as any);
    expect(ctx.createImageData).not.toHaveBeenCalled();
  });

  it("render with single layer uses distinct noise scale (no divide-by-zero)", () => {
    const ctx = createMockCtx();
    const props = { ...mistLayerType.createDefault(), layerCount: 1 };
    expect(() => mistLayerType.render(props, ctx, BOUNDS, {} as any)).not.toThrow();
  });

  it("validate passes for valid preset", () => {
    expect(mistLayerType.validate({ preset: "morning-mist" })).toBeNull();
  });

  it("validate passes for all mist presets", () => {
    for (const id of ["morning-mist", "mountain-haze", "thick-mist", "layered-mist"]) {
      expect(mistLayerType.validate({ preset: id })).toBeNull();
    }
  });

  it("validate fails for unknown preset", () => {
    const errors = mistLayerType.validate({ preset: "unknown-mist" });
    expect(errors).toHaveLength(1);
  });

  it("validate fails when bandTop >= bandBottom", () => {
    const errors = mistLayerType.validate({ preset: "morning-mist", bandTop: 0.9, bandBottom: 0.2 });
    expect(errors).toHaveLength(1);
    expect(errors![0]!.property).toBe("bandTop");
  });

  it("properties include expected schemas", () => {
    const keys = mistLayerType.properties.map((p) => p.key);
    expect(keys).toContain("density");
    expect(keys).toContain("bandTop");
    expect(keys).toContain("bandBottom");
    expect(keys).toContain("edgeSoftness");
    expect(keys).toContain("noiseScale");
    expect(keys).toContain("layerCount");
    expect(keys).toContain("driftX");
    expect(keys).toContain("depthSlot");
  });

  it("createDefault has depthSlot", () => {
    expect(mistLayerType.createDefault().depthSlot).toBe(0.6);
  });
});
