import { describe, it, expect } from "vitest";
import { createValueNoise, createFractalNoise, createWarpedNoise } from "../src/shared/noise.js";
import { mulberry32 } from "../src/shared/prng.js";

describe("noise", () => {
  it("createValueNoise returns values in [0, 1]", () => {
    const noise = createValueNoise(42);
    for (let i = 0; i < 100; i++) {
      const v = noise(i * 0.1, i * 0.13);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  it("createValueNoise is deterministic for same seed", () => {
    const a = createValueNoise(42);
    const b = createValueNoise(42);
    expect(a(1.5, 2.3)).toBe(b(1.5, 2.3));
  });

  it("createValueNoise differs for different seeds", () => {
    const a = createValueNoise(42);
    const b = createValueNoise(43);
    expect(a(1.5, 2.3)).not.toBe(b(1.5, 2.3));
  });

  it("createFractalNoise returns values in [0, 1]", () => {
    const noise = createFractalNoise(42, 4);
    for (let i = 0; i < 100; i++) {
      const v = noise(i * 0.1, i * 0.13);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  it("createFractalNoise with 1 octave equals value noise", () => {
    const fractal = createFractalNoise(42, 1);
    const value = createValueNoise(42);
    expect(fractal(1.5, 2.3)).toBeCloseTo(value(1.5, 2.3), 10);
  });

  it("createWarpedNoise returns values in [0, 1]", () => {
    const noise = createWarpedNoise(42, 3, 0.5);
    for (let i = 0; i < 100; i++) {
      const v = noise(i * 0.1, i * 0.13);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  it("createWarpedNoise with warpStrength=0 matches fractal noise", () => {
    const warped = createWarpedNoise(42, 4, 0);
    const fractal = createFractalNoise(42, 4);
    expect(warped(1.5, 2.3)).toBeCloseTo(fractal(1.5, 2.3), 10);
  });
});

describe("mulberry32", () => {
  it("is deterministic", () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    for (let i = 0; i < 10; i++) {
      expect(a()).toBe(b());
    }
  });

  it("returns values in [0, 1)", () => {
    const rng = mulberry32(42);
    for (let i = 0; i < 1000; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("differs for different seeds", () => {
    const a = mulberry32(42);
    const b = mulberry32(43);
    expect(a()).not.toBe(b());
  });
});
