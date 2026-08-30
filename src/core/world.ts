/** The baked world format.
 *
 *  This is the contract between `tools/worldgen` (which turns OpenStreetMap +
 *  NYC Open Data into a world) and the client (which turns a world into
 *  geometry and colliders). The procedural generator emits the same shape, so
 *  the client cannot tell a generated city from an imported one.
 *
 *  Coordinate frame: metres, right-handed, Y-up.
 *    +X = east, -Z = north, Y = altitude above sea level.
 *  The origin is a fixed lon/lat so imported and generated worlds line up.
 */

import type { Vendor } from './types';

export interface GeoOrigin {
  lon: number;
  lat: number;
}

/** A ground-plane point: [x, z] in metres. */
export type Vec2 = [number, number];

export type RoadClass =
  | 'motorway' | 'trunk' | 'primary' | 'secondary' | 'tertiary'
  | 'residential' | 'service' | 'footway' | 'cycleway' | 'rail';

export interface Road {
  id: string;
  cls: RoadClass;
  /** Total carriageway width in metres. */
  width: number;
  lanes: number;
  oneway: boolean;
  /** Height above ground in metres — bridges, and the elevated 7 train. */
  elevation: number;
  points: Vec2[];
}

export type BuildingKind =
  | 'residential' | 'commercial' | 'industrial' | 'civic' | 'tower';

export interface BuildingDef {
  id: string;
  /** Roof height above ground in metres (NYC Open Data `heightroof`). */
  height: number;
  /** Base height for parts that start above ground. Defaults to 0. */
  minHeight?: number;
  /** Outer ring, metres, no repeated closing point. */
  footprint: Vec2[];
  kind: BuildingKind;
}

export interface AreaDef {
  id: string;
  polygon: Vec2[];
}

export interface RunwayDef {
  id: string;
  name: string;
  /** Centreline endpoints. */
  points: [Vec2, Vec2];
  width: number;
  /** True heading in degrees, for the HUD compass. */
  heading: number;
}

/** Where a vehicle sits in the world at load time. */
export interface SpawnDef {
  id: string;
  vehicle: string;
  position: Vec2;
  /** Yaw in radians, 0 = facing north. */
  heading: number;
}

export interface WorldData {
  version: 1;
  name: string;
  origin: GeoOrigin;
  bounds: { min: Vec2; max: Vec2 };
  roads: Road[];
  buildings: BuildingDef[];
  water: AreaDef[];
  parks: AreaDef[];
  runways: RunwayDef[];
  vendors: Vendor[];
  spawns: SpawnDef[];
  /** Licence lines that must be shown in-game. ODbL requires attribution for
   *  produced works, so the renderer surfaces these on the title screen. */
  attribution: string[];
}

export function worldSize(w: WorldData): { width: number; depth: number } {
  return {
    width: w.bounds.max[0] - w.bounds.min[0],
    depth: w.bounds.max[1] - w.bounds.min[1],
  };
}

/** Default carriageway width for a road class, in metres. */
export function defaultWidth(cls: RoadClass, lanes: number): number {
  const perLane: Record<RoadClass, number> = {
    motorway: 3.7, trunk: 3.7, primary: 3.4, secondary: 3.3, tertiary: 3.2,
    residential: 3.0, service: 2.8, footway: 1.8, cycleway: 2.0, rail: 4.4,
  };
  return Math.max(2, perLane[cls] * Math.max(1, lanes));
}

export function isWaterAt(w: WorldData, x: number, z: number): boolean {
  for (const area of w.water) if (pointInPolygon(x, z, area.polygon)) return true;
  return false;
}

export function pointInPolygon(x: number, z: number, poly: Vec2[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i]!;
    const [xj, zj] = poly[j]!;
    const intersects = (zi > z) !== (zj > z)
      && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}
