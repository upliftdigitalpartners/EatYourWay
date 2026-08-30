/** Turns a `WorldData` into renderable geometry.
 *
 *  Everything static is merged into a handful of BufferGeometries — a few
 *  thousand buildings as individual meshes would spend the whole frame budget
 *  on draw calls. Wall UVs are scaled by real-world size so the shared window
 *  texture reads at a consistent scale on every building.
 */

import * as THREE from 'three';
import type { AreaDef, BuildingDef, Road, WorldData } from '../core/world';

const FLOOR_HEIGHT = 3.4;
const WINDOW_SPACING = 4.2;

interface Buffers {
  pos: number[];
  norm: number[];
  uv: number[];
  color: number[];
}

const newBuffers = (): Buffers => ({ pos: [], norm: [], uv: [], color: [] });

function pushTri(
  b: Buffers,
  a: THREE.Vector3, c: THREE.Vector3, d: THREE.Vector3,
  n: THREE.Vector3,
  uvA: [number, number], uvC: [number, number], uvD: [number, number],
  col: THREE.Color,
): void {
  b.pos.push(a.x, a.y, a.z, c.x, c.y, c.z, d.x, d.y, d.z);
  for (let i = 0; i < 3; i++) b.norm.push(n.x, n.y, n.z);
  b.uv.push(uvA[0], uvA[1], uvC[0], uvC[1], uvD[0], uvD[1]);
  for (let i = 0; i < 3; i++) b.color.push(col.r, col.g, col.b);
}

function toGeometry(b: Buffers): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(b.pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(b.norm, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(b.uv, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(b.color, 3));
  g.computeBoundingSphere();
  return g;
}

const KIND_TINT: Record<string, [number, number]> = {
  // [hue degrees, lightness]
  residential: [24, 0.46],
  commercial: [212, 0.50],
  industrial: [200, 0.38],
  civic: [40, 0.55],
  tower: [216, 0.58],
};

function buildingColor(b: BuildingDef, rnd: () => number): THREE.Color {
  const [hue, light] = KIND_TINT[b.kind] ?? KIND_TINT.residential!;
  const h = (hue + (rnd() - 0.5) * 26) / 360;
  const s = 0.10 + rnd() * 0.16;
  const l = light + (rnd() - 0.5) * 0.16;
  return new THREE.Color().setHSL(h, s, THREE.MathUtils.clamp(l, 0.12, 0.78));
}

/** Extrude one footprint into walls plus a roof cap. */
function extrude(b: Buffers, def: BuildingDef, col: THREE.Color): void {
  const base = def.minHeight ?? 0;
  const top = base + def.height;
  const ring = def.footprint;
  const n = ring.length;

  // Walls.
  for (let i = 0; i < n; i++) {
    const [x0, z0] = ring[i]!;
    const [x1, z1] = ring[(i + 1) % n]!;
    const dx = x1 - x0;
    const dz = z1 - z0;
    const len = Math.hypot(dx, dz);
    if (len < 0.01) continue;

    // Outward normal for a clockwise ring in XZ.
    const nx = dz / len;
    const nz = -dx / len;
    const normal = new THREE.Vector3(nx, 0, nz);

    const u1 = len / WINDOW_SPACING;
    const v1 = def.height / FLOOR_HEIGHT;

    const p00 = new THREE.Vector3(x0, base, z0);
    const p10 = new THREE.Vector3(x1, base, z1);
    const p11 = new THREE.Vector3(x1, top, z1);
    const p01 = new THREE.Vector3(x0, top, z0);

    pushTri(b, p00, p10, p11, normal, [0, 0], [u1, 0], [u1, v1], col);
    pushTri(b, p00, p11, p01, normal, [0, 0], [u1, v1], [0, v1], col);
  }

  // Roof, triangulated so non-rectangular imported footprints work.
  const contour = ring.map(([x, z]) => new THREE.Vector2(x, z));
  const tris = THREE.ShapeUtils.triangulateShape(contour, []);
  const up = new THREE.Vector3(0, 1, 0);
  const roofCol = col.clone().multiplyScalar(0.82);
  for (const [ia, ib, ic] of tris) {
    const a = contour[ia]!, c = contour[ib]!, d = contour[ic]!;
    pushTri(
      b,
      new THREE.Vector3(a.x, top, a.y),
      new THREE.Vector3(c.x, top, c.y),
      new THREE.Vector3(d.x, top, d.y),
      up,
      [a.x / 8, a.y / 8], [c.x / 8, c.y / 8], [d.x / 8, d.y / 8],
      roofCol,
    );
  }
}

/** Flat ribbon along a polyline, laid at `y`. */
function ribbon(b: Buffers, road: Road, col: THREE.Color): void {
  const half = road.width / 2;
  const y = road.elevation + 0.02;
  let travelled = 0;

  for (let i = 0; i < road.points.length - 1; i++) {
    const [x0, z0] = road.points[i]!;
    const [x1, z1] = road.points[i + 1]!;
    const dx = x1 - x0, dz = z1 - z0;
    const len = Math.hypot(dx, dz);
    if (len < 0.01) continue;
    const px = (-dz / len) * half;
    const pz = (dx / len) * half;

    const a = new THREE.Vector3(x0 + px, y, z0 + pz);
    const c = new THREE.Vector3(x1 + px, y, z1 + pz);
    const d = new THREE.Vector3(x1 - px, y, z1 - pz);
    const e = new THREE.Vector3(x0 - px, y, z0 - pz);

    const v0 = travelled / road.width;
    const v1 = (travelled + len) / road.width;
    const up = new THREE.Vector3(0, 1, 0);
    pushTri(b, a, c, d, up, [0, v0], [0, v1], [1, v1], col);
    pushTri(b, a, d, e, up, [0, v0], [1, v1], [1, v0], col);
    travelled += len;
  }
}

function flatArea(b: Buffers, area: AreaDef, y: number, col: THREE.Color, uvScale: number): void {
  const contour = area.polygon.map(([x, z]) => new THREE.Vector2(x, z));
  const tris = THREE.ShapeUtils.triangulateShape(contour, []);
  const up = new THREE.Vector3(0, 1, 0);
  for (const [ia, ib, ic] of tris) {
    const a = contour[ia]!, c = contour[ib]!, d = contour[ic]!;
    pushTri(
      b,
      new THREE.Vector3(a.x, y, a.y),
      new THREE.Vector3(c.x, y, c.y),
      new THREE.Vector3(d.x, y, d.y),
      up,
      [a.x / uvScale, a.y / uvScale], [c.x / uvScale, c.y / uvScale], [d.x / uvScale, d.y / uvScale],
      col,
    );
  }
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface CityMeshes {
  group: THREE.Group;
  buildings: THREE.Mesh;
  roads: THREE.Mesh;
  rails: THREE.Mesh;
  water: THREE.Mesh;
  parks: THREE.Mesh;
  ground: THREE.Mesh;
  /** Swapped when night falls. */
  setNight(night: boolean): void;
}

export function buildCity(
  world: WorldData,
  windowDay: THREE.Texture,
  windowNight: THREE.Texture,
  roadTex: THREE.Texture,
): CityMeshes {
  const rnd = mulberry32(1337);
  const group = new THREE.Group();

  // ---- buildings ----
  const bb = newBuffers();
  for (const def of world.buildings) extrude(bb, def, buildingColor(def, rnd));
  const buildingMat = new THREE.MeshStandardMaterial({
    map: windowDay,
    vertexColors: true,
    roughness: 0.86,
    metalness: 0.02,
  });
  const buildings = new THREE.Mesh(toGeometry(bb), buildingMat);
  buildings.castShadow = true;
  buildings.receiveShadow = true;
  group.add(buildings);

  // ---- roads and rail ----
  const rb = newBuffers();
  const railB = newBuffers();
  const asphalt = new THREE.Color(0xffffff);
  const railCol = new THREE.Color(0x4a4a52);
  for (const road of world.roads) {
    if (road.cls === 'rail') ribbon(railB, road, railCol);
    else ribbon(rb, road, asphalt);
  }
  const roads = new THREE.Mesh(
    toGeometry(rb),
    new THREE.MeshStandardMaterial({ map: roadTex, vertexColors: true, roughness: 0.95 }),
  );
  roads.receiveShadow = true;
  group.add(roads);

  const rails = new THREE.Mesh(
    toGeometry(railB),
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.5 }),
  );
  rails.castShadow = true;
  group.add(rails);

  // ---- runways ----
  for (const rw of world.runways) {
    const [[x0, z0], [x1, z1]] = rw.points;
    ribbon(rb, {
      id: rw.id, cls: 'service', width: rw.width, lanes: 2, oneway: false,
      elevation: 0.03, points: [[x0, z0], [x1, z1]],
    }, new THREE.Color(0xdddddd));
  }
  roads.geometry.dispose();
  roads.geometry = toGeometry(rb);

  // ---- water ----
  const wb = newBuffers();
  for (const area of world.water) flatArea(wb, area, -0.4, new THREE.Color(0x14324e), 40);
  const water = new THREE.Mesh(
    toGeometry(wb),
    new THREE.MeshStandardMaterial({
      vertexColors: true, roughness: 0.14, metalness: 0.65,
      transparent: true, opacity: 0.94,
    }),
  );
  group.add(water);

  // ---- parks ----
  const pb = newBuffers();
  for (const area of world.parks) flatArea(pb, area, 0.05, new THREE.Color(0x2f6b3a), 24);
  const parks = new THREE.Mesh(
    toGeometry(pb),
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.98 }),
  );
  parks.receiveShadow = true;
  group.add(parks);

  // ---- ground plane ----
  const { min, max } = world.bounds;
  const gw = max[0] - min[0] + 2400;
  const gd = max[1] - min[1] + 2400;
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(gw, gd),
    new THREE.MeshStandardMaterial({ color: 0x40404a, roughness: 1 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set((min[0] + max[0]) / 2, -0.05, (min[1] + max[1]) / 2);
  ground.receiveShadow = true;
  group.add(ground);

  return {
    group, buildings, roads, rails, water, parks, ground,
    setNight(night: boolean) {
      buildingMat.map = night ? windowNight : windowDay;
      buildingMat.emissiveMap = night ? windowNight : null;
      buildingMat.emissive = new THREE.Color(night ? 0xffffff : 0x000000);
      buildingMat.emissiveIntensity = night ? 0.85 : 0;
      buildingMat.needsUpdate = true;
    },
  };
}
