import { describe, it, expect } from "vitest";
import { parseHex, toHex, lerpColor, varyColor } from "../src/shared/color-utils.js";
import { mulberry32 } from "../src/shared/prng.js";

describe("color-utils", () => {
  describe("parseHex", () => {
    it("parses 6-digit hex", () => {
      expect(parseHex("#FF0000")).toEqual([255, 0, 0]);
      expect(parseHex("#00FF00")).toEqual([0, 255, 0]);
      expect(parseHex("#0000FF")).toEqual([0, 0, 255]);
    });

    it("parses 3-digit hex", () => {
      expect(parseHex("#F00")).toEqual([255, 0, 0]);
      expect(parseHex("#0F0")).toEqual([0, 255, 0]);
    });

    it("parses without hash", () => {
      expect(parseHex("FF8800")).toEqual([255, 136, 0]);
    });
  });

  describe("toHex", () => {
    it("converts RGB to hex", () => {
      expect(toHex(255, 0, 0)).toBe("#ff0000");
      expect(toHex(0, 255, 0)).toBe("#00ff00");
    });

    it("clamps values to 0-255", () => {
      expect(toHex(300, -10, 128)).toBe("#ff0080");
    });
  });

  describe("lerpColor", () => {
    it("returns first color at t=0", () => {
      expect(lerpColor("#000000", "#FFFFFF", 0)).toBe("#000000");
    });

    it("returns second color at t=1", () => {
      expect(lerpColor("#000000", "#FFFFFF", 1)).toBe("#ffffff");
    });

    it("returns midpoint at t=0.5", () => {
      expect(lerpColor("#000000", "#FFFFFF", 0.5)).toBe("#808080");
    });
  });

  describe("varyColor", () => {
    it("returns original color with variation=0", () => {
      const rng = mulberry32(42);
      const result = varyColor("#808080", 0, rng);
      expect(result).toBe("#808080");
    });

    it("returns varied color", () => {
      const rng = mulberry32(42);
      const result = varyColor("#808080", 0.2, rng);
      expect(result).not.toBe("#808080");
    });
  });
});
