import type { BiomePreset } from "./biomeConfig";

export interface MoonDef {
  id: string;
  name: string;
  mass: number;
  radiusPx: number;
  orbitRadius: number;
  orbitPeriod: number; // seconds
}

export interface PlanetDef {
  id: string;
  name: string;
  mass: number;
  radiusPx: number;
  orbitRadius: number;
  orbitPeriod: number; // seconds
  biomeId?: BiomePreset;
  moons: MoonDef[];
}

export interface StarDef {
  mass: number;
  radiusPx: number;
  heatDamageRadius?: number;
  heatDamagePerSecond?: number;
}

export interface AsteroidBeltDef {
  innerRadius: number;
  outerRadius: number;
  count: number;
  sizeMin: number;
  sizeMax: number;
}

export interface SolarSystemConfig {
  id: string;
  star: StarDef;
  planets: PlanetDef[];
  asteroidBelt?: AsteroidBeltDef;
}

/** Gravity constant for a = G*M/r^2. Tune so orbits and flight feel good. */
export const SPACE_GRAVITY_G = 50;

/** Extra radius beyond planet radiusPx to allow landing. */
export const LANDING_MARGIN_PX = 25;

/** Damage to ship when an asteroid collides. */
export const ASTEROID_DAMAGE = 3;

const AU = 5000; // Astronomical unit
const EM = 1e4; // Earth mass
const ER = 63.7; // Earth radius
const OP = 300; // Earth orbit period

/** Default solar system for interplanetary mode. */
export const DEFAULT_SOLAR_SYSTEM: SolarSystemConfig = {
  id: "default",
  star: {
    mass: 1e6,
    radiusPx: 100,
    heatDamageRadius: 80,
    heatDamagePerSecond: 0,
  },
  planets: [
    {
      id: "mercury",
      name: "Mercury",
      mass: 0.055 * EM,
      radiusPx: 0.38 * ER,
      orbitRadius: 0.39 * AU,
      orbitPeriod: 0.24 * OP,
      biomeId: "barren",
      moons: [],
    },
    {
      id: "venus",
      name: "Venus",
      mass: 0.815 * EM,
      radiusPx: 0.95 * ER,
      orbitRadius: 0.72 * AU,
      orbitPeriod: 0.62 * OP,
      biomeId: "volcanic",
      moons: [],
    },
    {
      id: "earth",
      name: "Earth",
      mass: EM,
      radiusPx: ER,
      orbitRadius: AU,
      orbitPeriod: OP,
      biomeId: "mixed",
      moons: [
        {
          id: "moon",
          name: "Moon",
          mass: 0.0123 * EM,
          radiusPx: 0.2724 * ER,
          orbitRadius: 0.0257 * AU,
          orbitPeriod: 0.0748 * OP,
        },
      ],
    },
    {
      id: "mars",
      name: "Mars",
      mass: 0.107 * EM,
      radiusPx: 0.53 * ER,
      orbitRadius: 1.52 * AU,
      orbitPeriod: 0.32 * OP,
      biomeId: "desert",
      moons: [
        {
          id: "phobos",
          name: "Phobos",
          mass: 1e-8 * EM,
          radiusPx: 0.17 * ER,
          orbitRadius: 0.03 * AU,
          orbitPeriod: 0.085 * OP,
        },
        {
          id: "deimos",
          name: "Deimos",
          mass: 1e-8 * EM,
          radiusPx: 0.09 * ER,
          orbitRadius: 0.046 * AU,
          orbitPeriod: 0.034 * OP,
        },
      ],
    },
    {
      id: "jupiter",
      name: "Jupiter",
      mass: 317.8 * EM,
      radiusPx: 11.2 * ER,
      orbitRadius: 5.2 * AU,
      orbitPeriod: 11.86 * OP,
      biomeId: "ice",
      moons: [
        {
          id: "io",
          name: "Io",
          mass: 0.015 * EM,
          radiusPx: 0.286 * ER,
          orbitRadius: 0.28 * AU,
          orbitPeriod: 0.048 * OP,
        },
        {
          id: "europa",
          name: "Europa",
          mass: 0.008 * EM,
          radiusPx: 0.245 * ER,
          orbitRadius: 0.45 * AU,
          orbitPeriod: 0.097 * OP,
        },
        {
          id: "ganymede",
          name: "Ganymede",
          mass: 0.025 * EM,
          radiusPx: 0.413 * ER,
          orbitRadius: 0.71 * AU,
          orbitPeriod: 0.196 * OP,
        },
        {
          id: "callisto",
          name: "Callisto",
          mass: 0.018 * EM,
          radiusPx: 0.378 * ER,
          orbitRadius: 1.26 * AU,
          orbitPeriod: 0.456 * OP,
        },
      ],
    },
    {
      id: "saturn",
      name: "Saturn",
      mass: 95.159 * EM,
      radiusPx: 9.2 * ER,
      orbitRadius: 9.54 * AU,
      orbitPeriod: 29.46 * OP,
      biomeId: "ice",
      moons: [
        {
          id: "titan",
          name: "Titan",
          mass: 0.0225 * EM,
          radiusPx: 0.456 * ER,
          orbitRadius: 0.297 * AU,
          orbitPeriod: 0.152 * OP,
        },
        {
          id: "enceladus",
          name: "Enceladus",
          mass: 0.006 * EM,
          radiusPx: 0.135 * ER,
          orbitRadius: 0.327 * AU,
          orbitPeriod: 0.255 * OP,
        },
        {
          id: "mimas",
          name: "Mimas",
          mass: 0.0004 * EM,
          radiusPx: 0.078 * ER,
          orbitRadius: 0.345 * AU,
          orbitPeriod: 0.313 * OP,
        },
        {
          id: "dione",
          name: "Dione",
          mass: 0.0005 * EM,
          radiusPx: 0.076 * ER,
          orbitRadius: 0.59 * AU,
          orbitPeriod: 0.558 * OP,
        },
        {
          id: "rhea",
          name: "Rhea",
          mass: 0.003 * EM,
          radiusPx: 0.12 * ER,
          orbitRadius: 0.73 * AU,
          orbitPeriod: 0.8107 * OP,
        },
        {
          id: "tethys",
          name: "Tethys",
          mass: 0.001 * EM,
          radiusPx: 0.1 * ER,
          orbitRadius: 0.861 * AU,
          orbitPeriod: 1.31 * OP,
        },
        {
          id: "iapetus",
          name: "Iapetus",
          mass: 0.001 * EM,
          radiusPx: 0.001 * ER,
          orbitRadius: 1.2 * AU,
          orbitPeriod: 2.02 * OP,
        },
      ],
    },
    {
      id: "uranus",
      name: "Uranus",
      mass: 14.536 * EM,
      radiusPx: 4.0 * ER,
      orbitRadius: 19.2 * AU,
      orbitPeriod: 84.01 * OP,
      biomeId: "ice",
      moons: [
        {
          id: "miranda",
          name: "Miranda",
          mass: 0.000075 * EM,
          radiusPx: 0.035 * ER,
          orbitRadius: 0.24 * AU,
          orbitPeriod: 0.31 * OP,
        },
        {
          id: "ariel",
          name: "Ariel",
          mass: 0.000138 * EM,
          radiusPx: 0.058 * ER,
          orbitRadius: 0.32 * AU,
          orbitPeriod: 0.58 * OP,
        },
        {
          id: "umbriel",
          name: "Umbriel",
          mass: 0.00016 * EM,
          radiusPx: 0.058 * ER,
          orbitRadius: 0.47 * AU,
          orbitPeriod: 0.877 * OP,
        },
        {
          id: "titania",
          name: "Titania",
          mass: 0.00077 * EM,
          radiusPx: 0.086 * ER,
          orbitRadius: 0.55 * AU,
          orbitPeriod: 1.393 * OP,
        },
        {
          id: "oberon",
          name: "Oberon",
          mass: 0.00077 * EM,
          radiusPx: 0.086 * ER,
          orbitRadius: 0.635 * AU,
          orbitPeriod: 2.193 * OP,
        },
      ],
    },
    {
      id: "neptune",
      name: "Neptune",
      mass: 17.147 * EM,
      radiusPx: 3.86 * ER,
      orbitRadius: 30.1 * AU,
      orbitPeriod: 164.79 * OP,
      biomeId: "ice",
      moons: [
        {
          id: "triton",
          name: "Triton",
          mass: 0.021 * EM,
          radiusPx: 0.0382 * ER,
          orbitRadius: 0.213 * AU,
          orbitPeriod: 0.1 * OP,
        },
        {
          id: "nereid",
          name: "Nereid",
          mass: 0.00000001 * EM,
          radiusPx: 0.01 * ER,
          orbitRadius: 0.26 * AU,
          orbitPeriod: 0.15 * OP,
        },
        {
          id: "halimede",
          name: "Halimede",
          mass: 0.00000001 * EM,
          radiusPx: 0.01 * ER,
          orbitRadius: 0.37 * AU,
          orbitPeriod: 0.2 * OP,
        },
      ],
    },
  ],
  asteroidBelt: {
    innerRadius: 5 * AU,
    outerRadius: 10 * AU,
    count: 200,
    sizeMin: 4,
    sizeMax: 12,
  },
};

export const HOME_PLANET_ID = "earth";

export function getPlanetById(
  config: SolarSystemConfig,
  planetId: string
): PlanetDef | undefined {
  return config.planets.find((p) => p.id === planetId);
}

export function getHomePlanetId(_: SolarSystemConfig): string {
  return HOME_PLANET_ID;
}
