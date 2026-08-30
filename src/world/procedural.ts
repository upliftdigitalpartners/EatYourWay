/** Procedural Queens.
 *
 *  Emits exactly the same `WorldData` the OSM/NYC importer produces, so the
 *  client cannot tell the two apart. This exists for two reasons: the game is
 *  playable before you download a 400 MB extract, and it gives `tools/worldgen`
 *  a reference target to diff against.
 *
 *  The layout follows the real geography loosely: Roosevelt Avenue runs
 *  east-west with the 7 train elevated above it, LaGuardia sits north on the
 *  bay, and Flushing Meadows splits Corona from downtown Flushing.
 */

import type {
  AreaDef, BuildingDef, BuildingKind, RoadClass, Road, RunwayDef, SpawnDef, Vec2, WorldData,
} from '../core/world';
import { defaultWidth, pointInPolygon } from '../core/world';
import { VENDORS } from './vendors';

/** Deterministic PRNG so a given seed always produces the same city. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const BOUNDS = { min: [-200, -2200] as Vec2, max: [6400, 1000] as Vec2 };

/** East-west arterials: [z, class, lanes, name]. */
const AVENUES: Array<[number, RoadClass, number, string]> = [
  [-1050, 'motorway',    6, 'Grand Central Pkwy'],
  [-420,  'primary',     4, 'Northern Blvd'],
  [0,     'primary',     4, 'Roosevelt Ave'],
  [300,   'secondary',   3, '37th Ave'],
  [640,   'primary',     4, 'Queens Blvd'],
];

const CROSS_SPACING = 132;
const CROSS_MIN_X = 120;
const CROSS_MAX_X = 6200;

const WATER: AreaDef[] = [
  {
    id: 'flushing-bay',
    polygon: [[3280, -2200], [4360, -2200], [4290, -560], [3860, -430], [3410, -700], [3240, -1400]],
  },
  {
    id: 'flushing-creek',
    polygon: [[3860, -430], [4060, -430], [4020, 340], [3900, 340]],
  },
  { id: 'east-river', polygon: [[-200, -2200], [90, -2200], [90, 1000], [-200, 1000]] },
];

const PARKS: AreaDef[] = [
  {
    id: 'flushing-meadows',
    polygon: [[3180, -380], [3900, -380], [3960, 900], [3200, 900]],
  },
  { id: 'travers-park', polygon: [[820, -300], [960, -300], [960, -190], [820, -190]] },
  { id: 'kissena-park', polygon: [[5180, 640], [5720, 640], [5720, 940], [5180, 940]] },
];

const RUNWAYS: RunwayDef[] = [
  {
    id: 'lga-04-22', name: 'LGA 4/22',
    points: [[1700, -1420], [2980, -1760]], width: 46, heading: 43,
  },
  {
    id: 'lga-13-31', name: 'LGA 13/31',
    points: [[1780, -1810], [2900, -1380]], width: 46, heading: 133,
  },
];

/** Rectangles kept clear of buildings: the airport apron and its approaches. */
const NO_BUILD: AreaDef[] = [
  { id: 'lga-field', polygon: [[1560, -1900], [3120, -1900], [3120, -1280], [1560, -1280]] },
];

function inAny(x: number, z: number, areas: AreaDef[], pad = 0): boolean {
  for (const a of areas) {
    if (pad === 0) {
      if (pointInPolygon(x, z, a.polygon)) return true;
    } else {
      // Cheap padded test: check the point and four offsets.
      if (pointInPolygon(x, z, a.polygon)) return true;
      if (pointInPolygon(x + pad, z, a.polygon)) return true;
      if (pointInPolygon(x - pad, z, a.polygon)) return true;
      if (pointInPolygon(x, z + pad, a.polygon)) return true;
      if (pointInPolygon(x, z - pad, a.polygon)) return true;
    }
  }
  return false;
}

function buildRoads(): Road[] {
  const roads: Road[] = [];

  for (const [z, cls, lanes, name] of AVENUES) {
    // Arterials stop at the bay rather than running through it.
    const segments: Array<[number, number]> = [];
    let start = BOUNDS.min[0] + 40;
    let cursor = start;
    const step = 40;
    let wet = inAny(cursor, z, WATER);
    while (cursor <= CROSS_MAX_X) {
      const nowWet = inAny(cursor, z, WATER);
      if (nowWet !== wet) {
        if (!wet && cursor - start > 120) segments.push([start, cursor - step]);
        if (nowWet === false) start = cursor;
        wet = nowWet;
      }
      cursor += step;
    }
    if (!wet && cursor - start > 120) segments.push([start, CROSS_MAX_X]);

    segments.forEach(([x0, x1], i) => {
      roads.push({
        id: `${name.replace(/\s+/g, '-').toLowerCase()}-${i}`,
        cls, lanes, oneway: false,
        width: defaultWidth(cls, lanes),
        elevation: 0,
        points: [[x0, z], [x1, z]],
      });
    });
  }

  // The 7 train, elevated above Roosevelt Avenue.
  roads.push({
    id: 'irt-flushing-line', cls: 'rail', lanes: 2, oneway: false,
    width: 10, elevation: 9.5,
    points: [[300, -14], [3180, -14], [3400, -60], [4300, -60], [5900, -14]],
  });

  // North-south cross streets.
  const zTop = -1160;
  const zBottom = 820;
  for (let x = CROSS_MIN_X, i = 0; x <= CROSS_MAX_X; x += CROSS_SPACING, i++) {
    const segments: Array<[number, number]> = [];
    let start = zTop;
    let cursor = zTop;
    const step = 40;
    let blocked = inAny(cursor, 0, WATER) || inAny(x, cursor, WATER) || inAny(x, cursor, PARKS);
    while (cursor <= zBottom) {
      const nowBlocked = inAny(x, cursor, WATER) || inAny(x, cursor, PARKS) || inAny(x, cursor, NO_BUILD);
      if (nowBlocked !== blocked) {
        if (!blocked && cursor - start > 90) segments.push([start, cursor - step]);
        if (!nowBlocked) start = cursor;
        blocked = nowBlocked;
      }
      cursor += step;
    }
    if (!blocked && cursor - start > 90) segments.push([start, zBottom]);

    const major = i % 6 === 0;
    segments.forEach(([z0, z1], s) => {
      roads.push({
        id: `cross-${i}-${s}`,
        cls: major ? 'tertiary' : 'residential',
        lanes: major ? 2 : 2,
        oneway: !major && i % 2 === 1,
        width: defaultWidth(major ? 'tertiary' : 'residential', 2),
        elevation: 0,
        points: [[x, z0], [x, z1]],
      });
    });
  }

  // Airport service loop.
  roads.push({
    id: 'lga-loop', cls: 'secondary', lanes: 2, oneway: true,
    width: defaultWidth('secondary', 2), elevation: 0,
    points: [[1620, -1240], [3060, -1240], [3080, -1500], [3060, -1860], [1620, -1860], [1600, -1500], [1620, -1240]],
  });

  return roads;
}

interface Block { x0: number; z0: number; x1: number; z1: number; }

function buildBlocks(): Block[] {
  const blocks: Block[] = [];
  const zLines = [-1160, -820, -420, 0, 300, 640, 820];
  for (let i = 0; i < zLines.length - 1; i++) {
    const z0 = zLines[i]! + 14;
    const z1 = zLines[i + 1]! - 14;
    if (z1 - z0 < 40) continue;
    for (let x = CROSS_MIN_X; x + CROSS_SPACING <= CROSS_MAX_X; x += CROSS_SPACING) {
      blocks.push({ x0: x + 9, z0, x1: x + CROSS_SPACING - 9, z1 });
    }
  }
  return blocks;
}

/** Height profile by easting — low-rise Jackson Heights through downtown
 *  Flushing towers — with a jitter so blocks are not uniform. */
function heightFor(x: number, z: number, rnd: () => number): { h: number; kind: BuildingKind } {
  if (z < -1150) return { h: 6 + rnd() * 8, kind: 'industrial' };

  let base: number;
  let kind: BuildingKind = 'residential';
  if (x < 1900) {
    base = 11 + rnd() * 14;                       // Jackson Heights co-ops
  } else if (x < 3150) {
    base = 8 + rnd() * 11;                        // Corona two- and three-families
  } else if (x < 4400) {
    base = 7 + rnd() * 9;                         // park fringe
  } else {
    const core = Math.max(0, 1 - Math.abs(x - 5060) / 620);
    base = 14 + rnd() * 16 + core * (40 + rnd() * 46);
    if (base > 55) kind = 'tower';
  }

  // Commercial frontage hugs the avenues.
  const nearAvenue = AVENUES.some(([az]) => Math.abs(z - az) < 46);
  if (nearAvenue) {
    kind = base > 55 ? 'tower' : 'commercial';
    base *= 1.12;
  }
  return { h: Math.round(base * 10) / 10, kind };
}

function buildBuildings(rnd: () => number): BuildingDef[] {
  const out: BuildingDef[] = [];
  let id = 0;

  for (const b of buildBlocks()) {
    const blockW = b.x1 - b.x0;
    const blockD = b.z1 - b.z0;
    if (blockW < 24 || blockD < 24) continue;

    // Split the block into lots along its long axis.
    const alongX = blockW >= blockD;
    const span = alongX ? blockW : blockD;
    const lotTarget = 17 + rnd() * 11;
    const lots = Math.max(1, Math.round(span / lotTarget));
    const lotSize = span / lots;

    for (let i = 0; i < lots; i++) {
      if (rnd() < 0.06) continue; // vacant lot / driveway

      const gap = 1.1 + rnd() * 1.6;
      let x0: number, x1: number, z0: number, z1: number;
      if (alongX) {
        x0 = b.x0 + i * lotSize + gap;
        x1 = b.x0 + (i + 1) * lotSize - gap;
        const depth = blockD * (0.52 + rnd() * 0.34);
        const front = rnd() < 0.5;
        z0 = front ? b.z0 + 2 : b.z1 - depth - 2;
        z1 = z0 + depth;
      } else {
        z0 = b.z0 + i * lotSize + gap;
        z1 = b.z0 + (i + 1) * lotSize - gap;
        const depth = blockW * (0.52 + rnd() * 0.34);
        const front = rnd() < 0.5;
        x0 = front ? b.x0 + 2 : b.x1 - depth - 2;
        x1 = x0 + depth;
      }

      if (x1 - x0 < 6 || z1 - z0 < 6) continue;

      const cx = (x0 + x1) / 2;
      const cz = (z0 + z1) / 2;
      if (inAny(cx, cz, WATER) || inAny(cx, cz, PARKS) || inAny(cx, cz, NO_BUILD)) continue;

      const { h, kind } = heightFor(cx, cz, rnd);
      out.push({
        id: `b${id++}`,
        height: h,
        footprint: [[x0, z0], [x1, z0], [x1, z1], [x0, z1]],
        kind,
      });
    }
  }

  // Airport terminals and hangars.
  const hangars: Array<[number, number, number, number, number]> = [
    [1640, -1230, 260, 70, 16],
    [1960, -1230, 300, 70, 19],
    [2340, -1230, 240, 70, 15],
    [2660, -1230, 300, 70, 21],
  ];
  for (const [x, z, w, d, h] of hangars) {
    out.push({
      id: `b${id++}`, height: h, kind: 'civic',
      footprint: [[x, z], [x + w, z], [x + w, z + d], [x, z + d]],
    });
  }

  return out;
}

function buildSpawns(rnd: () => number): SpawnDef[] {
  const spawns: SpawnDef[] = [];
  let n = 0;
  const add = (vehicle: string, position: Vec2, heading = 0) =>
    spawns.push({ id: `s${n++}`, vehicle, position, heading });

  // Street traffic along Roosevelt Ave and the cross streets.
  const streetCars = ['sedan', 'taxi', 'taxi', 'sedan', 'van', 'motorcycle', 'bicycle', 'sports', 'boxTruck'];
  for (let x = 380; x < 6000; x += 190) {
    if (inAny(x, 0, WATER) || inAny(x, 0, PARKS)) continue;
    const v = streetCars[Math.floor(rnd() * streetCars.length)]!;
    const side = rnd() < 0.5 ? -8.5 : 8.5;
    add(v, [x + rnd() * 40 - 20, side], side < 0 ? Math.PI / 2 : -Math.PI / 2);
  }

  // Buses on Northern Blvd, trucks on the parkway.
  for (let x = 600; x < 5800; x += 900) add('bus', [x, -428], Math.PI / 2);
  for (let x = 500; x < 3100; x += 700) add('boxTruck', [x, -1042], Math.PI / 2);

  // Food trucks parked near the districts.
  add('foodTruck', [640, 24], -Math.PI / 2);
  add('foodTruck', [2560, 24], -Math.PI / 2);
  add('foodTruck', [4980, 24], -Math.PI / 2);

  // Boats on Flushing Bay.
  add('speedboat', [3720, -1180], 0);
  add('speedboat', [3900, -1520], Math.PI);
  add('jetski', [3640, -980], 0);
  add('jetski', [3800, -900], Math.PI / 4);
  add('ferry', [3980, -1860], Math.PI);

  // Aircraft: helipads and the LaGuardia apron.
  add('helicopter', [1180, 180], 0);
  add('helicopter', [5060, -300], 0);
  add('helicopter', [2860, -1180], Math.PI);
  add('cessna', [1720, -1400], (43 * Math.PI) / 180);
  add('cessna', [1820, -1460], (43 * Math.PI) / 180);
  add('jet', [1880, -1330], (43 * Math.PI) / 180);

  return spawns;
}

export function generateQueens(seed = 20240817): WorldData {
  const rnd = mulberry32(seed);
  return {
    version: 1,
    name: 'Queens, New York',
    origin: { lon: -73.8896, lat: 40.7466 },
    bounds: BOUNDS,
    roads: buildRoads(),
    buildings: buildBuildings(rnd),
    water: WATER,
    parks: PARKS,
    runways: RUNWAYS,
    vendors: VENDORS,
    spawns: buildSpawns(rnd),
    attribution: ['Procedurally generated. Layout inspired by Queens, New York.'],
  };
}
