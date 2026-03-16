/** Base preset fields shared by all atmosphere presets. */
interface BasePreset {
  id: string;
  name: string;
  description: string;
  tags: string[];
}

/** Fog preset — ground-level fog with terrain masking. */
export interface FogPreset extends BasePreset {
  category: "fog";
  fogType: "radiation" | "advection" | "upslope" | "valley";
  density: number;
  color: string;
  colorBottom: string;
  opacity: number;
  fogTop: number;
  fogBottom: number;
  edgeSoftness: number;
  noiseScale: number;
  noiseOctaves: number;
  patchiness: number;
  warpStrength: number;
}

/** Mist preset — mid-level haze bands with parallax stacking. */
export interface MistPreset extends BasePreset {
  category: "mist";
  density: number;
  color: string;
  opacity: number;
  bandTop: number;
  bandBottom: number;
  edgeSoftness: number;
  noiseScale: number;
  noiseOctaves: number;
  layerCount: number;
  depthSpread: number;
  driftX: number;
  driftPhase: number;
}

/** Cloud preset — sky-level cloud formations. */
export interface CloudPreset extends BasePreset {
  category: "clouds";
  cloudType: "cumulus" | "stratus" | "cirrus" | "stratocumulus" | "cumulonimbus";
  algorithm: "discrete" | "threshold" | "streak";
  coverage: number;
  altitude: number;
  scale: number;
  cloudCount: number;
  edgeComplexity: number;
  turbulence: number;
  cloudColor: string;
  shadowColor: string;
  highlightColor: string;
  opacity: number;
  sunAngle: number;
  sunElevation: number;
}

/** Discriminated union of all atmosphere presets. */
export type AtmospherePreset = FogPreset | MistPreset | CloudPreset;

export type PresetCategory = "fog" | "mist" | "clouds";
