import { describe, it, expect } from "vitest";
import {
  ALL_PRESETS,
  getPreset,
  filterPresets,
  searchPresets,
  categoryToLayerType,
} from "../src/presets/index.js";

describe("presets", () => {
  it("ALL_PRESETS has 37 presets (5 fog + 4 mist + 22 clouds + 6 haze)", () => {
    expect(ALL_PRESETS).toHaveLength(37);
  });

  it("each preset has required fields", () => {
    for (const p of ALL_PRESETS) {
      expect(p.id).toBeTruthy();
      expect(p.name).toBeTruthy();
      expect(p.description).toBeTruthy();
      expect(p.category).toBeTruthy();
      expect(Array.isArray(p.tags)).toBe(true);
      expect(p.tags.length).toBeGreaterThan(0);
    }
  });

  it("preset ids are unique", () => {
    const ids = ALL_PRESETS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("getPreset returns correct preset", () => {
    const p = getPreset("morning-valley-fog");
    expect(p).toBeDefined();
    expect(p!.name).toBe("Morning Valley Fog");
    expect(p!.category).toBe("fog");
  });

  it("getPreset returns undefined for unknown id", () => {
    expect(getPreset("nonexistent")).toBeUndefined();
  });

  it("filterPresets returns correct counts", () => {
    expect(filterPresets("fog")).toHaveLength(5);
    expect(filterPresets("mist")).toHaveLength(4);
    expect(filterPresets("clouds")).toHaveLength(22);
    expect(filterPresets("haze")).toHaveLength(6);
  });

  it("searchPresets finds by tag", () => {
    const results = searchPresets("morning");
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((p) => p.id === "morning-valley-fog")).toBe(true);
  });

  it("searchPresets finds by name", () => {
    const results = searchPresets("cumulus");
    expect(results.length).toBeGreaterThan(0);
  });

  it("searchPresets is case insensitive", () => {
    const results = searchPresets("STORM");
    expect(results.some((p) => p.id === "storm-clouds")).toBe(true);
  });

  it("categoryToLayerType maps correctly", () => {
    expect(categoryToLayerType("fog")).toBe("atmosphere:fog");
    expect(categoryToLayerType("mist")).toBe("atmosphere:mist");
    expect(categoryToLayerType("clouds")).toBe("atmosphere:clouds");
    expect(categoryToLayerType("haze")).toBe("atmosphere:haze");
  });

  // Fog preset detail checks
  it("fog presets have fog-specific fields", () => {
    const fogPresets = filterPresets("fog");
    for (const p of fogPresets) {
      if (p.category !== "fog") continue;
      expect(p.fogType).toBeTruthy();
      expect(typeof p.density).toBe("number");
      expect(typeof p.patchiness).toBe("number");
      expect(typeof p.warpStrength).toBe("number");
    }
  });

  // Mist preset detail checks
  it("mist presets have mist-specific fields", () => {
    const mistPresets = filterPresets("mist");
    for (const p of mistPresets) {
      if (p.category !== "mist") continue;
      expect(typeof p.layerCount).toBe("number");
      expect(typeof p.depthSpread).toBe("number");
      expect(typeof p.driftX).toBe("number");
    }
  });

  // Cloud preset detail checks
  it("cloud presets have cloud-specific fields", () => {
    const cloudPresets = filterPresets("clouds");
    for (const p of cloudPresets) {
      if (p.category !== "clouds") continue;
      expect(p.cloudType).toBeTruthy();
      expect(p.algorithm).toBeTruthy();
      expect(typeof p.coverage).toBe("number");
      expect(typeof p.sunAngle).toBe("number");
      expect(typeof p.sunElevation).toBe("number");
    }
  });
});
