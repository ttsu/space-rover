export const TILE_SIZE = 32;

// Rover spritesheet grid (rover_sprite.png)
export const ROVER_SPRITE_COLUMNS = 1;
export const ROVER_SPRITE_ROWS = 1;
export const ROVER_SPRITE_WIDTH = 32;
export const ROVER_SPRITE_HEIGHT = 32;

export const PLANET_WIDTH_TILES = 50;
export const PLANET_HEIGHT_TILES = 50;
export const CHUNK_TILES = 16;
export const CHUNK_LOAD_RADIUS = 1;
export const CHUNK_UNLOAD_RADIUS = 2;

/** Tile radius around base where no hazards are placed (Chebyshev distance). */
export const BASE_SAFE_RADIUS_TILES = 3;

export const ROVER_BASE_SPEED = 200;
export const ROVER_MAX_CAPACITY = 20;
export const ROVER_BASE_HEALTH = 10;
export const ROVER_BASE_BATTERY = 30; // seconds of operation
export const ROVER_BASE_BATTERY_DRAIN = 1; // per second
export const ROVER_BASE_VISIBILITY_RADIUS_TILES = 7;

export const BLASTER_BASE_DAMAGE = 1;
export const BLASTER_BASE_FIRE_RATE = 2.5; // shots per second
export const BLASTER_BASE_RANGE = 150;

export const ROVER_BASE_ACCELERATION = 400;
export const ROVER_BASE_TURN_SPEED = Math.PI;

/** Capacity per cargo slot per resource type (Gas Canisters, Crystal Crates, Iron Hoppers). */
export const CARGO_CAPACITY_PER_SLOT = 4;

export const RESOURCE_DENSITY = 0.04; // fraction of tiles with resources

export const LAVA_DENSITY = 0.08;
export const ROCK_DENSITY = 0.07;
export const STORM_ZONE_DENSITY = 0.04;

export const LAVA_SLOW_FACTOR = 0.5;

// --- Storm regions (large circular areas: lightning + wind) ---
export const STORM_REGION_COUNT = 3;
export const STORM_REGION_RADIUS_PX = 240;
export const STORM_MOVE_SPEED = 8; // px per second

// Lightning: rate = strikes per minute; higher = more frequent. Mean interval = 60000/rate (ms).
export const LIGHTNING_STRIKES_PER_MINUTE = 10;
export const LIGHTNING_BASE_WARNING_MS = 500;
export const LIGHTNING_STRIKE_RADIUS_PX = 45;
export const LIGHTNING_DAMAGE = 2;
export const LIGHTNING_WARNING_VISUAL_RADIUS_MULTIPLIER = 1.1;
/** Short "charge" phase (ms) before main warning circle. */
export const LIGHTNING_CHARGE_PHASE_MS = 300;

// --- Wind regions (wind-only circles) ---
export const WIND_REGION_COUNT = 4;
export const WIND_REGION_RADIUS_PX = 200;
export const WIND_MOVE_SPEED = 10;
export const WIND_PUSH_STRENGTH = 1000; // base force per second; windResist reduces
/** Cap total wind acceleration per frame (px/s²) so overlapping regions don't stack uncontrollably. */
export const WIND_MAX_ACCEL_PER_FRAME = 900;
