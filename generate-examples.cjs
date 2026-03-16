#!/usr/bin/env node
/**
 * Generate .genart example files for all atmosphere presets + mood scenes.
 * Usage: node generate-examples.cjs
 */
const fs = require("fs");
const path = require("path");

const examplesDir = path.join(__dirname, "examples");
const NOW = "2026-03-15T00:00:00.000Z";

// --- All presets with their full layer properties ---
const PRESETS = [
  // ======== FOG (5) ========
  {
    id: "morning-valley-fog",
    name: "Morning Valley Fog",
    category: "fog",
    layerType: "atmosphere:fog",
    bg: "#1a2030",
    properties: {
      preset: "morning-valley-fog",
      seed: 3142,
      fogType: "radiation",
      density: 0.6,
      color: "#E8E8F0",
      colorBottom: "#D8D8E8",
      opacity: 0.45,
      fogTop: 0.4,
      fogBottom: 0.85,
      edgeSoftness: 0.35,
      noiseScale: 2.5,
      noiseOctaves: 3,
      patchiness: 0.3,
      warpStrength: 0.2,
      depthSlot: 0.2,
    },
  },
  {
    id: "sea-fog",
    name: "Sea Fog",
    category: "fog",
    layerType: "atmosphere:fog",
    bg: "#101820",
    properties: {
      preset: "sea-fog",
      seed: 5927,
      fogType: "advection",
      density: 0.8,
      color: "#D0D4DC",
      colorBottom: "#C0C8D4",
      opacity: 0.6,
      fogTop: 0.35,
      fogBottom: 0.95,
      edgeSoftness: 0.2,
      noiseScale: 1.8,
      noiseOctaves: 2,
      patchiness: 0.15,
      warpStrength: 0.3,
      depthSlot: 0.2,
    },
  },
  {
    id: "mountain-fog",
    name: "Mountain Fog",
    category: "fog",
    layerType: "atmosphere:fog",
    bg: "#0e1828",
    properties: {
      preset: "mountain-fog",
      seed: 7841,
      fogType: "upslope",
      density: 0.5,
      color: "#E0E4EC",
      colorBottom: "#D0D8E4",
      opacity: 0.4,
      fogTop: 0.3,
      fogBottom: 0.75,
      edgeSoftness: 0.4,
      noiseScale: 3.0,
      noiseOctaves: 4,
      patchiness: 0.5,
      warpStrength: 0.35,
      depthSlot: 0.2,
    },
  },
  {
    id: "dense-fog",
    name: "Dense Fog",
    category: "fog",
    layerType: "atmosphere:fog",
    bg: "#141820",
    properties: {
      preset: "dense-fog",
      seed: 4219,
      fogType: "valley",
      density: 0.9,
      color: "#D8D8E0",
      colorBottom: "#C8C8D8",
      opacity: 0.75,
      fogTop: 0.2,
      fogBottom: 0.95,
      edgeSoftness: 0.15,
      noiseScale: 1.5,
      noiseOctaves: 2,
      patchiness: 0.1,
      warpStrength: 0.15,
      depthSlot: 0.2,
    },
  },
  {
    id: "patchy-fog",
    name: "Patchy Fog",
    category: "fog",
    layerType: "atmosphere:fog",
    bg: "#162030",
    properties: {
      preset: "patchy-fog",
      seed: 6553,
      fogType: "radiation",
      density: 0.35,
      color: "#E8ECF4",
      colorBottom: "#E0E4EC",
      opacity: 0.3,
      fogTop: 0.45,
      fogBottom: 0.8,
      edgeSoftness: 0.45,
      noiseScale: 4.0,
      noiseOctaves: 4,
      patchiness: 0.7,
      warpStrength: 0.4,
      depthSlot: 0.2,
    },
  },

  // ======== MIST (4) ========
  {
    id: "morning-mist",
    name: "Morning Mist",
    category: "mist",
    layerType: "atmosphere:mist",
    bg: "#0e1828",
    properties: {
      preset: "morning-mist",
      seed: 3142,
      density: 0.4,
      color: "#E8E8F0",
      opacity: 0.35,
      bandTop: 0.5,
      bandBottom: 0.8,
      edgeSoftness: 0.3,
      noiseScale: 3.0,
      noiseOctaves: 3,
      driftX: 0.1,
      driftPhase: 0,
      layerCount: 3,
      depthSpread: 0.2,
      depthSlot: 0.6,
    },
  },
  {
    id: "mountain-haze",
    name: "Mountain Haze",
    category: "mist",
    layerType: "atmosphere:mist",
    bg: "#0a1020",
    properties: {
      preset: "mountain-haze",
      seed: 7841,
      density: 0.5,
      color: "#C8D0E0",
      opacity: 0.4,
      bandTop: 0.35,
      bandBottom: 0.85,
      edgeSoftness: 0.25,
      noiseScale: 2.5,
      noiseOctaves: 3,
      driftX: 0.05,
      driftPhase: 0.5,
      layerCount: 4,
      depthSpread: 0.3,
      depthSlot: 0.6,
    },
  },
  {
    id: "thick-mist",
    name: "Thick Mist",
    category: "mist",
    layerType: "atmosphere:mist",
    bg: "#101420",
    properties: {
      preset: "thick-mist",
      seed: 5927,
      density: 0.7,
      color: "#D8D8E4",
      opacity: 0.55,
      bandTop: 0.3,
      bandBottom: 0.9,
      edgeSoftness: 0.2,
      noiseScale: 2.0,
      noiseOctaves: 3,
      driftX: 0.08,
      driftPhase: 0.3,
      layerCount: 5,
      depthSpread: 0.15,
      depthSlot: 0.6,
    },
  },
  {
    id: "layered-mist",
    name: "Layered Mist",
    category: "mist",
    layerType: "atmosphere:mist",
    bg: "#0c1828",
    properties: {
      preset: "layered-mist",
      seed: 8833,
      density: 0.45,
      color: "#E0E4EC",
      opacity: 0.3,
      bandTop: 0.4,
      bandBottom: 0.85,
      edgeSoftness: 0.35,
      noiseScale: 3.5,
      noiseOctaves: 4,
      driftX: 0.12,
      driftPhase: 1.0,
      layerCount: 6,
      depthSpread: 0.35,
      depthSlot: 0.6,
    },
  },

  // ======== CLOUDS (7) ========
  {
    id: "fair-weather-cumulus",
    name: "Fair Weather Cumulus",
    category: "clouds",
    layerType: "atmosphere:clouds",
    bg: "#3070B8",
    properties: {
      preset: "fair-weather-cumulus",
      seed: 4421,
      cloudType: "cumulus",
      algorithm: "discrete",
      coverage: 0.3,
      altitude: 0.15,
      scale: 1.0,
      cloudCount: 5,
      edgeComplexity: 0.6,
      turbulence: 0.3,
      cloudColor: "#FFFFFF",
      shadowColor: "#B0B8C8",
      highlightColor: "#FFFFFF",
      opacity: 0.9,
      sunAngle: 135,
      sunElevation: 0.6,
      depthSlot: 1.0,
    },
  },
  {
    id: "towering-cumulus",
    name: "Towering Cumulus",
    category: "clouds",
    layerType: "atmosphere:clouds",
    bg: "#2860A0",
    properties: {
      preset: "towering-cumulus",
      seed: 7153,
      cloudType: "cumulus",
      algorithm: "discrete",
      coverage: 0.4,
      altitude: 0.1,
      scale: 1.5,
      cloudCount: 3,
      edgeComplexity: 0.8,
      turbulence: 0.5,
      cloudColor: "#F8F8FF",
      shadowColor: "#8090A8",
      highlightColor: "#FFFFFF",
      opacity: 0.95,
      sunAngle: 150,
      sunElevation: 0.5,
      depthSlot: 1.0,
    },
  },
  {
    id: "overcast-stratus",
    name: "Overcast Stratus",
    category: "clouds",
    layerType: "atmosphere:clouds",
    bg: "#404858",
    properties: {
      preset: "overcast-stratus",
      seed: 2837,
      cloudType: "stratus",
      algorithm: "threshold",
      coverage: 0.85,
      altitude: 0.2,
      scale: 1.0,
      cloudCount: 1,
      edgeComplexity: 0.2,
      turbulence: 0.15,
      cloudColor: "#D0D4DC",
      shadowColor: "#A8B0BC",
      highlightColor: "#E0E4EC",
      opacity: 0.85,
      sunAngle: 135,
      sunElevation: 0.4,
      depthSlot: 1.0,
    },
  },
  {
    id: "stratocumulus-field",
    name: "Stratocumulus Field",
    category: "clouds",
    layerType: "atmosphere:clouds",
    bg: "#3868A0",
    properties: {
      preset: "stratocumulus-field",
      seed: 6614,
      cloudType: "stratocumulus",
      algorithm: "threshold",
      coverage: 0.6,
      altitude: 0.18,
      scale: 0.8,
      cloudCount: 1,
      edgeComplexity: 0.5,
      turbulence: 0.35,
      cloudColor: "#E8ECF0",
      shadowColor: "#A0A8B8",
      highlightColor: "#F8F8FF",
      opacity: 0.9,
      sunAngle: 120,
      sunElevation: 0.55,
      depthSlot: 1.0,
    },
  },
  {
    id: "wispy-cirrus",
    name: "Wispy Cirrus",
    category: "clouds",
    layerType: "atmosphere:clouds",
    bg: "#2868C0",
    properties: {
      preset: "wispy-cirrus",
      seed: 9248,
      cloudType: "cirrus",
      algorithm: "streak",
      coverage: 0.2,
      altitude: 0.05,
      scale: 1.2,
      cloudCount: 8,
      edgeComplexity: 0.3,
      turbulence: 0.2,
      cloudColor: "#F0F4FF",
      shadowColor: "#D0D8E8",
      highlightColor: "#FFFFFF",
      opacity: 0.4,
      sunAngle: 135,
      sunElevation: 0.7,
      depthSlot: 1.0,
    },
  },
  {
    id: "sunset-cumulus",
    name: "Sunset Cumulus",
    category: "clouds",
    layerType: "atmosphere:clouds",
    bg: "#301838",
    properties: {
      preset: "sunset-cumulus",
      seed: 3311,
      cloudType: "cumulus",
      algorithm: "discrete",
      coverage: 0.35,
      altitude: 0.12,
      scale: 1.0,
      cloudCount: 4,
      edgeComplexity: 0.7,
      turbulence: 0.4,
      cloudColor: "#F8E8D8",
      shadowColor: "#7868A0",
      highlightColor: "#FFD8A0",
      opacity: 0.9,
      sunAngle: 180,
      sunElevation: 0.15,
      depthSlot: 1.0,
    },
  },
  {
    id: "storm-clouds",
    name: "Storm Clouds",
    category: "clouds",
    layerType: "atmosphere:clouds",
    bg: "#181C28",
    properties: {
      preset: "storm-clouds",
      seed: 5527,
      cloudType: "cumulonimbus",
      algorithm: "discrete",
      coverage: 0.7,
      altitude: 0.05,
      scale: 2.0,
      cloudCount: 2,
      edgeComplexity: 0.9,
      turbulence: 0.7,
      cloudColor: "#90A0B0",
      shadowColor: "#404858",
      highlightColor: "#C8D0DC",
      opacity: 0.95,
      sunAngle: 160,
      sunElevation: 0.3,
      depthSlot: 1.0,
    },
  },

  // ======== CLOUDS v0.2.0 (15 new) ========
  {
    id: "mackerel-sky", name: "Mackerel Sky", category: "clouds", layerType: "atmosphere:clouds", bg: "#2868C0",
    properties: { preset: "mackerel-sky", seed: 1001, cloudType: "cirrocumulus", algorithm: "threshold", coverage: 0.5, altitude: 0.05, scale: 0.7, cloudCount: 1, edgeComplexity: 0.3, turbulence: 0.2, cloudColor: "#F0F4FF", shadowColor: "#C8D0E0", highlightColor: "#FFFFFF", opacity: 0.5, sunAngle: 135, sunElevation: 0.7, depthSlot: 1.0 },
  },
  {
    id: "cirrostratus-veil", name: "Cirrostratus Veil", category: "clouds", layerType: "atmosphere:clouds", bg: "#4080C8",
    properties: { preset: "cirrostratus-veil", seed: 1002, cloudType: "cirrostratus", algorithm: "threshold", coverage: 0.7, altitude: 0.05, scale: 1.0, cloudCount: 1, edgeComplexity: 0.15, turbulence: 0.1, cloudColor: "#F0F0F8", shadowColor: "#D8D8E4", highlightColor: "#FFFFFF", opacity: 0.35, sunAngle: 135, sunElevation: 0.65, depthSlot: 1.0 },
  },
  {
    id: "altocumulus-field", name: "Altocumulus Field", category: "clouds", layerType: "atmosphere:clouds", bg: "#3070B0",
    properties: { preset: "altocumulus-field", seed: 1003, cloudType: "altocumulus", algorithm: "threshold", coverage: 0.5, altitude: 0.1, scale: 0.8, cloudCount: 1, edgeComplexity: 0.4, turbulence: 0.3, cloudColor: "#E8ECF4", shadowColor: "#A0A8B8", highlightColor: "#F8FAFF", opacity: 0.75, sunAngle: 130, sunElevation: 0.6, depthSlot: 1.0 },
  },
  {
    id: "altostratus-sheet", name: "Altostratus Sheet", category: "clouds", layerType: "atmosphere:clouds", bg: "#506880",
    properties: { preset: "altostratus-sheet", seed: 1004, cloudType: "altostratus", algorithm: "threshold", coverage: 0.75, altitude: 0.1, scale: 1.0, cloudCount: 1, edgeComplexity: 0.2, turbulence: 0.2, cloudColor: "#C8D0DC", shadowColor: "#98A0B0", highlightColor: "#D8E0E8", opacity: 0.7, sunAngle: 135, sunElevation: 0.45, depthSlot: 1.0 },
  },
  {
    id: "castellanus-turrets", name: "Castellanus Turrets", category: "clouds", layerType: "atmosphere:clouds", bg: "#3070A8",
    properties: { preset: "castellanus-turrets", seed: 1005, cloudType: "altocumulus-castellanus", algorithm: "discrete", coverage: 0.3, altitude: 0.1, scale: 0.7, cloudCount: 6, edgeComplexity: 0.6, turbulence: 0.4, cloudColor: "#E8ECF4", shadowColor: "#90A0B0", highlightColor: "#F8FAFF", opacity: 0.8, sunAngle: 140, sunElevation: 0.55, depthSlot: 1.0 },
  },
  {
    id: "cumulus-congestus", name: "Cumulus Congestus", category: "clouds", layerType: "atmosphere:clouds", bg: "#2058A0",
    properties: { preset: "cumulus-congestus", seed: 1006, cloudType: "cumulus-congestus", algorithm: "discrete", coverage: 0.4, altitude: 0.08, scale: 1.8, cloudCount: 2, edgeComplexity: 0.85, turbulence: 0.55, cloudColor: "#F8F8FF", shadowColor: "#7080A0", highlightColor: "#FFFFFF", opacity: 0.95, sunAngle: 145, sunElevation: 0.5, depthSlot: 1.0 },
  },
  {
    id: "nimbostratus-overcast", name: "Nimbostratus Overcast", category: "clouds", layerType: "atmosphere:clouds", bg: "#303840",
    properties: { preset: "nimbostratus-overcast", seed: 1007, cloudType: "nimbostratus", algorithm: "threshold", coverage: 0.9, altitude: 0.15, scale: 1.0, cloudCount: 1, edgeComplexity: 0.25, turbulence: 0.2, cloudColor: "#8890A0", shadowColor: "#606878", highlightColor: "#A0A8B4", opacity: 0.9, sunAngle: 135, sunElevation: 0.3, depthSlot: 1.0 },
  },
  {
    id: "cumulonimbus-anvil", name: "Cumulonimbus Anvil", category: "clouds", layerType: "atmosphere:clouds", bg: "#181C28",
    properties: { preset: "cumulonimbus-anvil", seed: 1008, cloudType: "cumulonimbus-incus", algorithm: "discrete", coverage: 0.7, altitude: 0.03, scale: 2.5, cloudCount: 1, edgeComplexity: 0.9, turbulence: 0.75, cloudColor: "#A0A8B8", shadowColor: "#384050", highlightColor: "#D0D8E0", opacity: 0.95, sunAngle: 155, sunElevation: 0.35, depthSlot: 1.0 },
  },
  {
    id: "lenticular-lens", name: "Lenticular Lens", category: "clouds", layerType: "atmosphere:clouds", bg: "#3870B0",
    properties: { preset: "lenticular-lens", seed: 1009, cloudType: "lenticular", algorithm: "discrete", coverage: 0.2, altitude: 0.1, scale: 1.2, cloudCount: 2, edgeComplexity: 0.15, turbulence: 0.1, cloudColor: "#E8ECF4", shadowColor: "#A0A8BC", highlightColor: "#F8FAFF", opacity: 0.8, sunAngle: 130, sunElevation: 0.6, depthSlot: 1.0 },
  },
  {
    id: "mammatus-pouches", name: "Mammatus Pouches", category: "clouds", layerType: "atmosphere:clouds", bg: "#283040",
    properties: { preset: "mammatus-pouches", seed: 1010, cloudType: "mammatus", algorithm: "threshold", coverage: 0.6, altitude: 0.15, scale: 0.8, cloudCount: 1, edgeComplexity: 0.5, turbulence: 0.4, cloudColor: "#C8D0D8", shadowColor: "#707888", highlightColor: "#E0E4EC", opacity: 0.85, sunAngle: 160, sunElevation: 0.35, depthSlot: 1.0 },
  },
  {
    id: "fog-bank-low", name: "Fog Bank Low", category: "clouds", layerType: "atmosphere:clouds", bg: "#506878",
    properties: { preset: "fog-bank-low", seed: 1011, cloudType: "fog-bank", algorithm: "threshold", coverage: 0.7, altitude: 0.35, scale: 1.0, cloudCount: 1, edgeComplexity: 0.3, turbulence: 0.2, cloudColor: "#D8DCE4", shadowColor: "#B0B8C4", highlightColor: "#E8ECF0", opacity: 0.8, sunAngle: 135, sunElevation: 0.5, depthSlot: 1.0 },
  },
  {
    id: "contrail-thin", name: "Contrail Thin", category: "clouds", layerType: "atmosphere:clouds", bg: "#2868C0",
    properties: { preset: "contrail-thin", seed: 1012, cloudType: "contrail", algorithm: "streak", coverage: 0.1, altitude: 0.05, scale: 1.5, cloudCount: 2, edgeComplexity: 0.1, turbulence: 0.05, cloudColor: "#F0F4FF", shadowColor: "#D8E0EC", highlightColor: "#FFFFFF", opacity: 0.35, sunAngle: 135, sunElevation: 0.7, depthSlot: 1.0 },
  },
  {
    id: "pyrocumulus-dark", name: "Pyrocumulus Dark", category: "clouds", layerType: "atmosphere:clouds", bg: "#201820",
    properties: { preset: "pyrocumulus-dark", seed: 1013, cloudType: "pyrocumulus", algorithm: "discrete", coverage: 0.5, altitude: 0.08, scale: 1.8, cloudCount: 2, edgeComplexity: 0.9, turbulence: 0.8, cloudColor: "#8088A0", shadowColor: "#303840", highlightColor: "#B0B8C8", opacity: 0.9, sunAngle: 145, sunElevation: 0.4, depthSlot: 1.0 },
  },
  {
    id: "banner-peak", name: "Banner Peak", category: "clouds", layerType: "atmosphere:clouds", bg: "#3868A0",
    properties: { preset: "banner-peak", seed: 1014, cloudType: "banner-cloud", algorithm: "discrete", coverage: 0.25, altitude: 0.12, scale: 1.0, cloudCount: 3, edgeComplexity: 0.5, turbulence: 0.35, cloudColor: "#E0E4EC", shadowColor: "#98A0B0", highlightColor: "#F0F4F8", opacity: 0.7, sunAngle: 130, sunElevation: 0.55, depthSlot: 1.0 },
  },
  {
    id: "pileus-cap", name: "Pileus Cap", category: "clouds", layerType: "atmosphere:clouds", bg: "#3070B8",
    properties: { preset: "pileus-cap", seed: 1015, cloudType: "pileus", algorithm: "streak", coverage: 0.15, altitude: 0.08, scale: 1.0, cloudCount: 3, edgeComplexity: 0.2, turbulence: 0.1, cloudColor: "#F0F4FF", shadowColor: "#D0D8E8", highlightColor: "#FFFFFF", opacity: 0.3, sunAngle: 135, sunElevation: 0.65, depthSlot: 1.0 },
  },

  // ======== HAZE (6) ========
  {
    id: "light-haze", name: "Light Haze", category: "haze", layerType: "atmosphere:haze", bg: "#1a2030",
    properties: { preset: "light-haze", seed: 2001, color: "#D8E0EC", opacity: 0.25, yPosition: 0.3, height: 0.5, gradientDirection: "bottom-up", noiseAmount: 0.2, depthSlot: 0.4 },
  },
  {
    id: "golden-haze", name: "Golden Haze", category: "haze", layerType: "atmosphere:haze", bg: "#301838",
    properties: { preset: "golden-haze", seed: 2002, color: "#E8D8C0", opacity: 0.3, yPosition: 0.25, height: 0.55, gradientDirection: "bottom-up", noiseAmount: 0.25, depthSlot: 0.4 },
  },
  {
    id: "cool-mist-haze", name: "Cool Mist Haze", category: "haze", layerType: "atmosphere:haze", bg: "#0e1828",
    properties: { preset: "cool-mist-haze", seed: 2003, color: "#C0C8D8", opacity: 0.35, yPosition: 0.3, height: 0.5, gradientDirection: "bottom-up", noiseAmount: 0.3, depthSlot: 0.5 },
  },
  {
    id: "heat-haze", name: "Heat Haze", category: "haze", layerType: "atmosphere:haze", bg: "#382818",
    properties: { preset: "heat-haze", seed: 2004, color: "#E0D8D0", opacity: 0.2, yPosition: 0.6, height: 0.35, gradientDirection: "top-down", noiseAmount: 0.5, depthSlot: 0.3 },
  },
  {
    id: "ink-wash-haze", name: "Ink Wash Haze", category: "haze", layerType: "atmosphere:haze", bg: "#181818",
    properties: { preset: "ink-wash-haze", seed: 2005, color: "#C8C8D0", opacity: 0.4, yPosition: 0.2, height: 0.6, gradientDirection: "bottom-up", noiseAmount: 0.15, depthSlot: 0.5 },
  },
  {
    id: "twilight-haze", name: "Twilight Haze", category: "haze", layerType: "atmosphere:haze", bg: "#101020",
    properties: { preset: "twilight-haze", seed: 2006, color: "#9898B8", opacity: 0.35, yPosition: 0.2, height: 0.6, gradientDirection: "bottom-up", noiseAmount: 0.2, depthSlot: 0.45 },
  },
];

// --- Mood scene recipes (multi-layer) ---
const MOOD_SCENES = [
  {
    id: "calm-morning",
    name: "Calm Morning",
    bg: "#1a2030",
    layers: [
      { presetId: "morning-valley-fog", seed: 3142 },
      { presetId: "morning-mist", seed: 11061 },
      { presetId: "fair-weather-cumulus", seed: 18980 },
    ],
  },
  {
    id: "dramatic-storm",
    name: "Dramatic Storm",
    bg: "#101418",
    layers: [
      { presetId: "dense-fog", seed: 4219 },
      { presetId: "storm-clouds", seed: 12138 },
    ],
  },
  {
    id: "misty-mountain",
    name: "Misty Mountain",
    bg: "#0e1828",
    layers: [
      { presetId: "mountain-fog", seed: 7841 },
      { presetId: "mountain-haze", seed: 15760 },
    ],
  },
  {
    id: "clear-day",
    name: "Clear Day",
    bg: "#3878C8",
    layers: [
      { presetId: "fair-weather-cumulus", seed: 4421 },
    ],
  },
  {
    id: "golden-sunset",
    name: "Golden Sunset",
    bg: "#301838",
    layers: [
      { presetId: "mountain-haze", seed: 7841 },
      { presetId: "sunset-cumulus", seed: 15760 },
    ],
  },
];

// --- Helpers ---

function makeLayer(id, layerType, name, properties, width, height) {
  return {
    id,
    type: layerType,
    name,
    visible: true,
    locked: false,
    opacity: 1,
    blendMode: "normal",
    transform: {
      x: 0, y: 0, width, height,
      rotation: 0, scaleX: 1, scaleY: 1, anchorX: 0, anchorY: 0,
    },
    properties,
  };
}

function makeBgLayer(color, width, height) {
  return makeLayer("bg-layer", "composite:solid", "Background", { color }, width, height);
}

function makeSketch(id, title, width, height, layers) {
  return {
    genart: "1.3",
    id,
    title,
    created: NOW,
    modified: NOW,
    renderer: { type: "canvas2d" },
    canvas: { width, height },
    parameters: [],
    colors: [],
    state: { seed: 42, params: {}, colorPalette: [] },
    algorithm: "function sketch(ctx, state) {}",
    layers,
  };
}

function findPreset(presetId) {
  return PRESETS.find((p) => p.id === presetId);
}

// Ensure example directories exist
const categories = ["fog", "mist", "clouds", "haze", "scenes"];
for (const cat of categories) {
  fs.mkdirSync(path.join(examplesDir, cat), { recursive: true });
}

// --- Generate individual preset examples ---

let totalFiles = 0;

for (const preset of PRESETS) {
  const dir = path.join(examplesDir, preset.category);
  const filePath = path.join(dir, `${preset.id}.genart`);

  const W = 600, H = 600;
  const layers = [
    makeBgLayer(preset.bg, W, H),
    makeLayer("atmosphere-layer", preset.layerType, preset.name, preset.properties, W, H),
  ];
  const sketch = makeSketch(`atmosphere-${preset.id}`, `${preset.name}`, W, H, layers);

  fs.writeFileSync(filePath, JSON.stringify(sketch, null, 2) + "\n");
  totalFiles++;
}

// --- Generate mood scene examples ---

for (const scene of MOOD_SCENES) {
  const dir = path.join(examplesDir, "scenes");
  const filePath = path.join(dir, `${scene.id}.genart`);

  const W = 600, H = 600;
  const layers = [makeBgLayer(scene.bg, W, H)];

  for (let i = 0; i < scene.layers.length; i++) {
    const layerDef = scene.layers[i];
    const preset = findPreset(layerDef.presetId);
    if (!preset) {
      console.error(`  ERROR: preset "${layerDef.presetId}" not found for scene "${scene.id}"`);
      continue;
    }
    const props = { ...preset.properties, seed: layerDef.seed };
    layers.push(
      makeLayer(`layer-${i}`, preset.layerType, preset.name, props, W, H),
    );
  }

  const sketch = makeSketch(`scene-${scene.id}`, `${scene.name} (Scene)`, W, H, layers);

  fs.writeFileSync(filePath, JSON.stringify(sketch, null, 2) + "\n");
  totalFiles++;
}

console.log(`Generated ${totalFiles} .genart example files.`);
