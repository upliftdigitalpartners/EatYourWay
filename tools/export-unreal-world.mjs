/**
 * Bake the procedural Queens world into flat instance transforms for Unreal.
 *
 * All the geometry maths happens here, in Node, where it can be checked. The
 * Unreal side then does nothing cleverer than "add an instance at this
 * transform", which keeps the part I cannot test as dumb as possible.
 *
 * Units out are centimetres, Unreal's convention. Axis mapping: the web build
 * uses +X east and -Z north; Unreal uses +X east and +Y south, so the web z
 * becomes the Unreal y unchanged.
 */

import { generateQueens } from '../dist-worldgen/world/procedural.js';
import { writeFileSync, mkdirSync } from 'node:fs';

const M = 100;                    // metres -> centimetres
const CUBE = 100;                 // the engine cube is 100 cm, so scale = cm/100

const world = generateQueens();
const out = { buildings: [], roads: [], rails: [], water: [], parks: [], runways: [] };

/** location [x,y,z] cm, yaw degrees, scale [x,y,z] as cube multiples. */
const inst = (loc, yaw, scale) => ({
  l: loc.map(v => Math.round(v * 10) / 10),
  r: Math.round(yaw * 100) / 100,
  s: scale.map(v => Math.round(v * 1000) / 1000),
});

// ---- buildings: axis-aligned boxes, so centre + extent is exact -----------
for (const b of world.buildings) {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const [x, z] of b.footprint) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (z < minY) minY = z;
    if (z > maxY) maxY = z;
  }
  const w = (maxX - minX) * M;
  const d = (maxY - minY) * M;
  const h = b.height * M;
  if (w < 100 || d < 100 || h < 100) continue;
  out.buildings.push(inst(
    [((minX + maxX) / 2) * M, ((minY + maxY) / 2) * M, h / 2],
    0,
    [w / CUBE, d / CUBE, h / CUBE],
  ));
}

// ---- roads: one slab per polyline segment --------------------------------
function ribbon(points, widthM, elevationM, target, thicknessM = 0.3) {
  for (let i = 0; i < points.length - 1; i++) {
    const [x0, y0] = points[i];
    const [x1, y1] = points[i + 1];
    const dx = x1 - x0, dy = y1 - y0;
    const len = Math.hypot(dx, dy);
    if (len < 1) continue;
    target.push(inst(
      [((x0 + x1) / 2) * M, ((y0 + y1) / 2) * M, elevationM * M],
      (Math.atan2(dy, dx) * 180) / Math.PI,
      [(len * M) / CUBE, (widthM * M) / CUBE, (thicknessM * M) / CUBE],
    ));
  }
}

for (const road of world.roads) {
  if (road.cls === 'rail') ribbon(road.points, road.width, road.elevation, out.rails, 1.2);
  else ribbon(road.points, road.width, road.elevation + 0.05, out.roads);
}

for (const rw of world.runways) {
  ribbon(rw.points, rw.width, 0.1, out.runways);
}

// ---- water and parks: tile-fill the polygons ------------------------------
// A bounding box would put Flushing Bay on top of Flushing, so fill properly.
function pointInPolygon(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function fillArea(areas, tileM, zM, target) {
  for (const area of areas) {
    const xs = area.polygon.map(p => p[0]);
    const ys = area.polygon.map(p => p[1]);
    const x0 = Math.min(...xs), x1 = Math.max(...xs);
    const y0 = Math.min(...ys), y1 = Math.max(...ys);
    for (let x = x0; x < x1; x += tileM) {
      for (let y = y0; y < y1; y += tileM) {
        const cx = x + tileM / 2, cy = y + tileM / 2;
        if (!pointInPolygon(cx, cy, area.polygon)) continue;
        target.push(inst(
          [cx * M, cy * M, zM * M],
          0,
          [(tileM * M) / CUBE, (tileM * M) / CUBE, (0.4 * M) / CUBE],
        ));
      }
    }
  }
}

fillArea(world.water, 55, -0.6, out.water);
fillArea(world.parks, 55, 0.08, out.parks);

mkdirSync('unreal/Data', { recursive: true });
writeFileSync('unreal/Data/world_instances.json', JSON.stringify(out));

const total = Object.values(out).reduce((n, a) => n + a.length, 0);
for (const [k, v] of Object.entries(out)) console.log(`  ${k.padEnd(10)} ${v.length}`);
console.log(`  ${'TOTAL'.padEnd(10)} ${total} instances`);
console.log(`  size       ${(JSON.stringify(out).length / 1024 / 1024).toFixed(2)} MB`);
