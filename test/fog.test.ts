import { describe, it, expect, vi } from "vitest";
import { fogLayerType } from "../src/layers/fog.js";

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

describe("atmosphere:fog", () => {
  it("has correct typeId", () => {
    expect(fogLayerType.typeId).toBe("atmosphere:fog");
  });

  it("has category draw", () => {
    expect(fogLayerType.category).toBe("draw");
  });

  it("createDefault returns valid properties", () => {
    const defaults = fogLayerType.createDefault();
    expect(defaults.preset).toBe("morning-valley-fog");
    expect(defaults.density).toBe(0.6);
    expect(defaults.fogType).toBe("radiation");
    expect(defaults.fogTop).toBe(0.4);
    expect(defaults.fogBottom).toBe(0.85);
  });

  it("render executes without error", () => {
    const ctx = createMockCtx();
    const props = fogLayerType.createDefault();
    expect(() => fogLayerType.render(props, ctx, BOUNDS, {} as any)).not.toThrow();
  });

  it("render uses createImageData and putImageData", () => {
    const ctx = createMockCtx();
    fogLayerType.render(fogLayerType.createDefault(), ctx, BOUNDS, {} as any);
    expect(ctx.createImageData).toHaveBeenCalledTimes(2); // low-res + full-res
    expect(ctx.putImageData).toHaveBeenCalledTimes(1);
    expect(ctx.drawImage).not.toHaveBeenCalled();
  });

  it("render with each fog type executes without error", () => {
    for (const fogType of ["radiation", "advection", "upslope", "valley"]) {
      const ctx = createMockCtx();
      const props = { ...fogLayerType.createDefault(), fogType };
      expect(() => fogLayerType.render(props, ctx, BOUNDS, {} as any)).not.toThrow();
    }
  });

  it("render skips when fogTop >= fogBottom", () => {
    const ctx = createMockCtx();
    const props = { ...fogLayerType.createDefault(), fogTop: 0.9, fogBottom: 0.1 };
    fogLayerType.render(props, ctx, BOUNDS, {} as any);
    expect(ctx.createImageData).not.toHaveBeenCalled();
  });

  it("render with patchiness=0 executes without error", () => {
    const ctx = createMockCtx();
    const props = { ...fogLayerType.createDefault(), patchiness: 0 };
    expect(() => fogLayerType.render(props, ctx, BOUNDS, {} as any)).not.toThrow();
  });

  it("render with high patchiness executes without error", () => {
    const ctx = createMockCtx();
    const props = { ...fogLayerType.createDefault(), patchiness: 0.9 };
    expect(() => fogLayerType.render(props, ctx, BOUNDS, {} as any)).not.toThrow();
  });

  it("render with warpStrength=0 uses fractal noise (no warping)", () => {
    const ctx = createMockCtx();
    const props = { ...fogLayerType.createDefault(), warpStrength: 0 };
    expect(() => fogLayerType.render(props, ctx, BOUNDS, {} as any)).not.toThrow();
  });

  it("validate passes for valid preset", () => {
    expect(fogLayerType.validate({ preset: "morning-valley-fog" })).toBeNull();
  });

  it("validate passes for all fog presets", () => {
    for (const id of ["morning-valley-fog", "sea-fog", "mountain-fog", "dense-fog", "patchy-fog"]) {
      expect(fogLayerType.validate({ preset: id })).toBeNull();
    }
  });

  it("validate fails for unknown preset", () => {
    const errors = fogLayerType.validate({ preset: "unknown-fog" });
    expect(errors).toHaveLength(1);
    expect(errors![0]!.property).toBe("preset");
  });

  it("validate fails when fogTop >= fogBottom", () => {
    const errors = fogLayerType.validate({ preset: "morning-valley-fog", fogTop: 0.9, fogBottom: 0.2 });
    expect(errors).toHaveLength(1);
    expect(errors![0]!.property).toBe("fogTop");
  });

  it("properties include expected schemas", () => {
    const keys = fogLayerType.properties.map((p) => p.key);
    expect(keys).toContain("density");
    expect(keys).toContain("fogTop");
    expect(keys).toContain("fogBottom");
    expect(keys).toContain("fogType");
    expect(keys).toContain("patchiness");
    expect(keys).toContain("warpStrength");
    expect(keys).toContain("edgeSoftness");
    expect(keys).toContain("noiseScale");
    expect(keys).toContain("depthSlot");
    expect(keys).toContain("colorBottom");
  });

  it("createDefault has depthSlot", () => {
    expect(fogLayerType.createDefault().depthSlot).toBe(0.2);
  });
});
