/** Rapier physics, built from the same WorldData the renderer consumes so the
 *  collision shapes can never drift from what you see. */

import RAPIER from '@dimforge/rapier3d-compat';
import type { BuildingDef, WorldData } from '../core/world';

export interface Physics {
  world: RAPIER.World;
  /** Static handles, kept so the world can be rebuilt without a page reload. */
  statics: RAPIER.RigidBody[];
}

let ready = false;

export async function initRapier(): Promise<void> {
  if (ready) return;
  await RAPIER.init();
  ready = true;
}

function footprintAABB(b: BuildingDef): { cx: number; cz: number; hx: number; hz: number } {
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const [x, z] of b.footprint) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (z < minZ) minZ = z;
    if (z > maxZ) maxZ = z;
  }
  return {
    cx: (minX + maxX) / 2,
    cz: (minZ + maxZ) / 2,
    hx: Math.max(0.5, (maxX - minX) / 2),
    hz: Math.max(0.5, (maxZ - minZ) / 2),
  };
}

export function createPhysics(data: WorldData): Physics {
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  // A larger step keeps 3000+ static colliders cheap without losing stability
  // for vehicle-sized bodies.
  world.integrationParameters.numSolverIterations = 4;

  const statics: RAPIER.RigidBody[] = [];

  // Ground: one big slab. Queens is flat enough that a heightfield buys nothing.
  const { min, max } = data.bounds;
  const gw = (max[0] - min[0]) / 2 + 1200;
  const gd = (max[1] - min[1]) / 2 + 1200;
  const groundBody = world.createRigidBody(
    RAPIER.RigidBodyDesc.fixed().setTranslation((min[0] + max[0]) / 2, -1, (min[1] + max[1]) / 2),
  );
  world.createCollider(
    RAPIER.ColliderDesc.cuboid(gw, 1, gd).setFriction(1.1).setRestitution(0.05),
    groundBody,
  );
  statics.push(groundBody);

  // Buildings as axis-aligned boxes. Precise hulls would cost far more than
  // they add — you bounce off a wall either way.
  for (const b of data.buildings) {
    const { cx, cz, hx, hz } = footprintAABB(b);
    const base = b.minHeight ?? 0;
    const h = b.height / 2;
    const body = world.createRigidBody(
      RAPIER.RigidBodyDesc.fixed().setTranslation(cx, base + h, cz),
    );
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(hx, h, hz).setFriction(0.7),
      body,
    );
    statics.push(body);
  }

  return { world, statics };
}

/** Rapier's raycast vehicle needs the chassis to be a dynamic body whose
 *  centre of mass sits low, or it rolls at the first corner. */
export function createChassis(
  physics: Physics,
  size: [number, number, number],
  mass: number,
  position: { x: number; y: number; z: number },
  heading: number,
): RAPIER.RigidBody {
  const [w, h, l] = size;
  const q = quatFromYaw(heading);
  const body = physics.world.createRigidBody(
    RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(position.x, position.y, position.z)
      .setRotation(q)
      .setLinearDamping(0.06)
      .setAngularDamping(0.7)
      .setCanSleep(true),
  );
  const collider = RAPIER.ColliderDesc.cuboid(w / 2, h / 2, l / 2)
    .setDensity(0)
    .setMass(mass)
    .setFriction(0.55)
    .setRestitution(0.05);
  physics.world.createCollider(collider, body);
  // Drop the centre of mass below the box centre for roll stability.
  body.setAdditionalMassProperties(
    mass,
    { x: 0, y: -h * 0.32, z: 0 },
    { x: mass * 0.32, y: mass * 0.36, z: mass * 0.22 },
    { w: 1, x: 0, y: 0, z: 0 },
    true,
  );
  return body;
}

export function quatFromYaw(yaw: number): { x: number; y: number; z: number; w: number } {
  return { x: 0, y: Math.sin(yaw / 2), z: 0, w: Math.cos(yaw / 2) };
}

export function yawFromQuat(q: { x: number; y: number; z: number; w: number }): number {
  return Math.atan2(2 * (q.w * q.y + q.x * q.z), 1 - 2 * (q.y * q.y + q.z * q.z));
}

export { RAPIER };
