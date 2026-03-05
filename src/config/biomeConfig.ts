import type { HazardKind } from "../state/GameState";

export type BiomeId =
  | "volcanic"
  | "ice"
  | "desert"
  | "toxic"
  | "storm"
  | "barren";

export type BiomePreset = "mixed" | BiomeId;

export interface BiomeHazardProfile {
  lavaDensityMultiplier: number;
  rockDensityMultiplier: number;
  resourceDensityMultiplier: number;
  stormRegionMultiplier: number;
  windRegionMultiplier: number;
  sandstormRegionMultiplier: number;
}

export interface BiomeGoalProfile {
  hazardFocus: HazardKind[];
}

export interface BiomeConfig {
  id: BiomeId;
  label: string;
  hazard: BiomeHazardProfile;
  goals: BiomeGoalProfile;
}

export const BIOME_CONFIGS: Record<BiomeId, BiomeConfig> = {
  volcanic: {
    id: "volcanic",
    label: "Volcanic",
    hazard: {
      lavaDensityMultiplier: 1.35,
      rockDensityMultiplier: 1.2,
      resourceDensityMultiplier: 0.95,
      stormRegionMultiplier: 0.85,
      windRegionMultiplier: 0.9,
      sandstormRegionMultiplier: 0,
    },
    goals: {
      hazardFocus: ["lava", "lightning"],
    },
  },
  ice: {
    id: "ice",
    label: "Ice",
    hazard: {
      lavaDensityMultiplier: 0.5,
      rockDensityMultiplier: 0.9,
      resourceDensityMultiplier: 1.1,
      stormRegionMultiplier: 1,
      windRegionMultiplier: 1.25,
      sandstormRegionMultiplier: 0,
    },
    goals: {
      hazardFocus: ["wind", "lightning"],
    },
  },
  desert: {
    id: "desert",
    label: "Desert",
    hazard: {
      lavaDensityMultiplier: 0.75,
      rockDensityMultiplier: 1.05,
      resourceDensityMultiplier: 0.9,
      stormRegionMultiplier: 0.95,
      windRegionMultiplier: 1.4,
      sandstormRegionMultiplier: 1.4,
    },
    goals: {
      hazardFocus: ["sandstorm", "wind"],
    },
  },
  toxic: {
    id: "toxic",
    label: "Toxic",
    hazard: {
      lavaDensityMultiplier: 1.05,
      rockDensityMultiplier: 0.95,
      resourceDensityMultiplier: 1,
      stormRegionMultiplier: 1.2,
      windRegionMultiplier: 1.15,
      sandstormRegionMultiplier: 0,
    },
    goals: {
      hazardFocus: ["lightning", "lava"],
    },
  },
  storm: {
    id: "storm",
    label: "Storm",
    hazard: {
      lavaDensityMultiplier: 0.6,
      rockDensityMultiplier: 0.8,
      resourceDensityMultiplier: 1,
      stormRegionMultiplier: 1.6,
      windRegionMultiplier: 1.5,
      sandstormRegionMultiplier: 0,
    },
    goals: {
      hazardFocus: ["lightning", "wind"],
    },
  },
  barren: {
    id: "barren",
    label: "Barren",
    hazard: {
      lavaDensityMultiplier: 0.4,
      rockDensityMultiplier: 1.3,
      resourceDensityMultiplier: 0.85,
      stormRegionMultiplier: 0.7,
      windRegionMultiplier: 0.65,
      sandstormRegionMultiplier: 0,
    },
    goals: {
      hazardFocus: ["wind"],
    },
  },
};

export const BIOME_IDS = Object.keys(BIOME_CONFIGS) as BiomeId[];

export function biomeLabel(id: BiomeId): string {
  return BIOME_CONFIGS[id].label;
}
