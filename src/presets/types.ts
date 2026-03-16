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
  /** v0.2.0: Number of fog sub-layers for depth stacking. */
  fogLayers?: number;
  /** v0.2.0: Wisp tendril density at fog edges 0-1. */
  wispDensity?: number;
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
  /** v0.2.0: Sky color for back-layer atmospheric tint. */
  skyColor?: string;
  /** v0.2.0: Color shift intensity 0-1 toward skyColor on back layers. */
  colorShift?: number;
}

/** All supported cloud type values (22 meteorological types). */
export type CloudType =
  | "cirrus" | "cirrostratus" | "cirrocumulus"
  | "altocumulus" | "altostratus" | "altocumulus-castellanus"
  | "cumulus" | "cumulus-congestus" | "stratocumulus" | "stratus" | "nimbostratus"
  | "cumulonimbus" | "cumulonimbus-incus"
  | "lenticular" | "mammatus" | "pileus" | "fog-bank" | "banner-cloud" | "contrail"
  | "pyrocumulus";

/** Cloud preset — sky-level cloud formations. */
export interface CloudPreset extends BasePreset {
  category: "clouds";
  cloudType: CloudType;
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

/** Haze preset — distance-based atmospheric perspective. */
export interface HazePreset extends BasePreset {
  category: "haze";
  color: string;
  opacity: number;
  yPosition: number;
  height: number;
  gradientDirection: "bottom-up" | "top-down" | "center-out" | "uniform";
  noiseAmount: number;
  depthSlot: number;
}

/** Discriminated union of all atmosphere presets. */
export type AtmospherePreset = FogPreset | MistPreset | CloudPreset | HazePreset;

export type PresetCategory = "fog" | "mist" | "clouds" | "haze";
