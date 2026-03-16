import type { AtmospherePreset, PresetCategory } from "./types.js";
import { FOG_PRESETS } from "./fog.js";
import { MIST_PRESETS } from "./mist.js";
import { CLOUD_PRESETS } from "./clouds.js";
import { HAZE_PRESETS } from "./haze.js";

/** All atmosphere presets. */
export const ALL_PRESETS: AtmospherePreset[] = [
  ...FOG_PRESETS,
  ...MIST_PRESETS,
  ...CLOUD_PRESETS,
  ...HAZE_PRESETS,
];

const PRESET_MAP = new Map<string, AtmospherePreset>(
  ALL_PRESETS.map((p) => [p.id, p]),
);

/** Look up a preset by id. */
export function getPreset(id: string): AtmospherePreset | undefined {
  return PRESET_MAP.get(id);
}

/** Filter presets by category. */
export function filterPresets(category: PresetCategory): AtmospherePreset[] {
  return ALL_PRESETS.filter((p) => p.category === category);
}

/** Search presets by tag or name substring. */
export function searchPresets(query: string): AtmospherePreset[] {
  const q = query.toLowerCase();
  return ALL_PRESETS.filter(
    (p) =>
      p.name.toLowerCase().includes(q) ||
      p.description.toLowerCase().includes(q) ||
      p.tags.some((t) => t.includes(q)),
  );
}

/** Map category to layer typeId. */
export function categoryToLayerType(category: PresetCategory): string {
  switch (category) {
    case "fog": return "atmosphere:fog";
    case "mist": return "atmosphere:mist";
    case "clouds": return "atmosphere:clouds";
    case "haze": return "atmosphere:haze";
  }
}
