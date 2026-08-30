/** Vehicle definitions.
 *
 *  Everything the physics and render layers need to know about a vehicle lives
 *  here, so adding a new one is a data change rather than a code change.
 *  Units are SI: metres, kilograms, seconds, radians.
 */

export type Domain = 'ground' | 'water' | 'air';

/** Which controller drives this vehicle. */
export type Drive = 'foot' | 'wheeled' | 'boat' | 'heli' | 'plane';

export interface VehicleSpec {
  id: string;
  name: string;
  emoji: string;
  domain: Domain;
  drive: Drive;
  /** Bounding box: [width, height, length] in metres. */
  size: [number, number, number];
  mass: number;
  color: number;
  accentColor: number;
  /** Top speed in m/s. */
  maxSpeed: number;
  /** Forward acceleration force scale. */
  accel: number;
  brake: number;

  // ---- wheeled ----
  steerAngle?: number;
  wheelRadius?: number;
  /** Longitudinal axle separation. */
  wheelBase?: number;
  /** Lateral wheel separation. */
  track?: number;
  suspensionRest?: number;
  suspensionStiff?: number;
  grip?: number;

  // ---- air ----
  /** Vertical thrust available, in multiples of gravity. */
  lift?: number;
  maxClimb?: number;
  yawRate?: number;
  pitchRate?: number;
  rollRate?: number;
  /** Below this airspeed a fixed-wing loses lift. */
  stallSpeed?: number;
  /** Ground roll needed before rotation, metres. Planes only. */
  takeoffRoll?: number;

  // ---- water ----
  buoyancy?: number;
  waterDrag?: number;

  seats: number;
  description: string;
}

const wheeled = (o: Partial<VehicleSpec> & Pick<VehicleSpec,
  'id' | 'name' | 'emoji' | 'size' | 'mass' | 'color' | 'maxSpeed' | 'accel' | 'description'>): VehicleSpec => ({
  domain: 'ground',
  drive: 'wheeled',
  accentColor: 0x1a1a22,
  brake: 26,
  steerAngle: 0.55,
  wheelRadius: 0.34,
  wheelBase: o.size[2] * 0.62,
  track: o.size[0] * 0.82,
  suspensionRest: 0.36,
  suspensionStiff: 26,
  grip: 1.0,
  seats: 4,
  ...o,
});

export const VEHICLES: Record<string, VehicleSpec> = {
  foot: {
    id: 'foot', name: 'On Foot', emoji: 'W', domain: 'ground', drive: 'foot',
    size: [0.6, 1.8, 0.4], mass: 80, color: 0xffcc66, accentColor: 0xff3d8b,
    maxSpeed: 5.2, accel: 42, brake: 30, seats: 1,
    description: 'Sidewalks, stairs and alleys. The only way into a basement stall.',
  },

  bicycle: wheeled({
    id: 'bicycle', name: 'Bicycle', emoji: 'B', size: [0.6, 1.1, 1.75], mass: 16,
    color: 0x2bd4d9, maxSpeed: 9.5, accel: 30,
    wheelRadius: 0.34, grip: 0.85, seats: 1,
    description: 'Weaves through gridlock. No parking problem, ever.',
  }),
  motorcycle: wheeled({
    id: 'motorcycle', name: 'Motorcycle', emoji: 'M', size: [0.8, 1.2, 2.1], mass: 210,
    color: 0xff3d8b, maxSpeed: 58, accel: 120,
    wheelRadius: 0.32, grip: 1.05, seats: 2,
    description: 'Fast and twitchy. Lane-splits the BQE at rush hour.',
  }),
  sedan: wheeled({
    id: 'sedan', name: 'Sedan', emoji: 'C', size: [1.85, 1.45, 4.6], mass: 1500,
    color: 0x8899bb, maxSpeed: 46, accel: 78,
    description: 'The default. Trunk space for leftovers.',
  }),
  taxi: wheeled({
    id: 'taxi', name: 'Yellow Cab', emoji: 'T', size: [1.9, 1.55, 4.9], mass: 1750,
    color: 0xffc72c, accentColor: 0x222222, maxSpeed: 43, accel: 74,
    description: 'Handles like a sofa. Somehow always faster than you expect.',
  }),
  sports: wheeled({
    id: 'sports', name: 'Sports Car', emoji: 'S', size: [1.95, 1.18, 4.4], mass: 1320,
    color: 0xe62b2b, maxSpeed: 82, accel: 165,
    grip: 1.25, suspensionRest: 0.28, steerAngle: 0.5,
    seats: 2,
    description: 'Wildly impractical for a food crawl. Take it anyway.',
  }),
  van: wheeled({
    id: 'van', name: 'Cargo Van', emoji: 'V', size: [2.0, 2.3, 5.4], mass: 2300,
    color: 0xf2f2f2, maxSpeed: 39, accel: 62,
    suspensionRest: 0.42, grip: 0.92,
    description: 'Double-parked outside every commissary in Queens.',
  }),
  boxTruck: wheeled({
    id: 'boxTruck', name: 'Box Truck', emoji: 'K', size: [2.4, 3.2, 7.6], mass: 7200,
    color: 0xdedede, maxSpeed: 32, accel: 54,
    wheelRadius: 0.46, suspensionRest: 0.5, grip: 0.82, steerAngle: 0.42,
    seats: 3,
    description: 'Slow, tall, and it will not fit under the 7 train.',
  }),
  bus: wheeled({
    id: 'bus', name: 'City Bus', emoji: 'U', size: [2.6, 3.2, 12.0], mass: 12500,
    color: 0x2f6fb5, maxSpeed: 29, accel: 48,
    wheelRadius: 0.52, suspensionRest: 0.5, grip: 0.8, steerAngle: 0.36,
    seats: 40,
    description: 'The Q47 does not care about your combo timer.',
  }),
  foodTruck: wheeled({
    id: 'foodTruck', name: 'Food Truck', emoji: 'F', size: [2.3, 3.0, 6.4], mass: 5200,
    color: 0xff7a3d, accentColor: 0xffd23f, maxSpeed: 30, accel: 52,
    wheelRadius: 0.44, suspensionRest: 0.46, grip: 0.85, steerAngle: 0.44,
    seats: 2,
    description: 'A vendor you can drive. Park it and it serves a crowd.',
  }),

  jetski: {
    id: 'jetski', name: 'Jet Ski', emoji: 'J', domain: 'water', drive: 'boat',
    size: [1.2, 1.1, 3.1], mass: 360, color: 0x2bd4d9, accentColor: 0x111827,
    maxSpeed: 27, accel: 95, brake: 14,
    buoyancy: 1.9, waterDrag: 1.5, yawRate: 1.5, seats: 2,
    description: 'Flushing Bay at full throttle. Loud. Very loud.',
  },
  speedboat: {
    id: 'speedboat', name: 'Speedboat', emoji: 'P', domain: 'water', drive: 'boat',
    size: [2.6, 1.7, 7.4], mass: 1300, color: 0xf5f5f5, accentColor: 0x1e3a5f,
    maxSpeed: 32, accel: 70, brake: 16,
    buoyancy: 1.7, waterDrag: 1.2, yawRate: 0.9, seats: 6,
    description: 'The East River is a highway if you know how to read it.',
  },
  ferry: {
    id: 'ferry', name: 'Ferry', emoji: 'Y', domain: 'water', drive: 'boat',
    size: [8.0, 6.0, 26.0], mass: 42000, color: 0xffffff, accentColor: 0x0b3d91,
    maxSpeed: 13, accel: 30, brake: 8,
    buoyancy: 1.5, waterDrag: 0.9, yawRate: 0.3, seats: 150,
    description: 'Slow, steady, and it can carry a whole crawl worth of passengers.',
  },

  helicopter: {
    id: 'helicopter', name: 'Helicopter', emoji: 'H', domain: 'air', drive: 'heli',
    size: [2.6, 3.2, 12.0], mass: 2400, color: 0x1f2937, accentColor: 0xffd23f,
    maxSpeed: 72, accel: 46, brake: 20,
    lift: 2.1, maxClimb: 14, yawRate: 1.1, pitchRate: 0.9, rollRate: 1.2,
    seats: 5,
    description: 'Vertical takeoff from any rooftop. The fastest way across the boroughs.',
  },
  cessna: {
    id: 'cessna', name: 'Light Plane', emoji: 'A', domain: 'air', drive: 'plane',
    size: [11.0, 2.7, 8.2], mass: 1150, color: 0xf8fafc, accentColor: 0xe62b2b,
    maxSpeed: 92, accel: 34, brake: 16,
    lift: 1.35, maxClimb: 9, yawRate: 0.5, pitchRate: 0.85, rollRate: 1.5,
    stallSpeed: 24, takeoffRoll: 240, seats: 4,
    description: 'Needs a runway both ways. LaGuardia is right there.',
  },
  jet: {
    id: 'jet', name: 'Private Jet', emoji: 'X', domain: 'air', drive: 'plane',
    size: [17.0, 4.4, 20.0], mass: 32000, color: 0xf1f5f9, accentColor: 0x0b3d91,
    maxSpeed: 210, accel: 60, brake: 26,
    lift: 1.25, maxClimb: 22, yawRate: 0.28, pitchRate: 0.5, rollRate: 0.9,
    stallSpeed: 58, takeoffRoll: 900, seats: 10,
    description: 'Absurd for lunch. Gets you to JFK in ninety seconds.',
  },
};

export const VEHICLE_IDS = Object.keys(VEHICLES);

export function spec(id: string): VehicleSpec {
  const v = VEHICLES[id];
  if (!v) throw new Error(`unknown vehicle: ${id}`);
  return v;
}

export function byDomain(domain: Domain): VehicleSpec[] {
  return Object.values(VEHICLES).filter(v => v.domain === domain && v.drive !== 'foot');
}
