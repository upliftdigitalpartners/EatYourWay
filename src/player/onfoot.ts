/** On-foot movement, using Rapier's kinematic character controller so the
 *  player can climb kerbs and stairs without the jitter a dynamic capsule
 *  gives you at low speed. */

import RAPIER from '@dimforge/rapier3d-compat';
import type { Physics } from '../physics/world';

const WALK = 4.2;
const RUN = 7.4;
const GRAVITY = -22;
const JUMP = 7.2;

export class Player {
  readonly body: RAPIER.RigidBody;
  readonly collider: RAPIER.Collider;
  private controller: RAPIER.KinematicCharacterController;
  private vy = 0;
  private grounded = false;
  /** Facing, radians. Kept separate because a kinematic body has no torque. */
  heading = 0;

  constructor(private physics: Physics, x: number, y: number, z: number) {
    this.body = physics.world.createRigidBody(
      RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(x, y, z),
    );
    this.collider = physics.world.createCollider(
      RAPIER.ColliderDesc.capsule(0.55, 0.32),
      this.body,
    );
    const cc = physics.world.createCharacterController(0.02);
    cc.enableAutostep(0.42, 0.2, true);
    cc.enableSnapToGround(0.4);
    cc.setApplyImpulsesToDynamicBodies(true);
    cc.setCharacterMass(80);
    this.controller = cc;
  }

  get position(): { x: number; y: number; z: number } {
    return this.body.translation();
  }

  get isGrounded(): boolean { return this.grounded; }

  /** `forward` and `right` are the camera's basis flattened to the ground, so
   *  W always means "away from the camera". */
  update(
    dt: number,
    move: { x: number; z: number },
    running: boolean,
    jump: boolean,
    forward: { x: number; z: number },
    right: { x: number; z: number },
  ): number {
    const speed = running ? RUN : WALK;
    let dx = (right.x * move.x + forward.x * move.z);
    let dz = (right.z * move.x + forward.z * move.z);
    const m = Math.hypot(dx, dz);
    if (m > 1) { dx /= m; dz /= m; }

    if (m > 0.01) this.heading = Math.atan2(dx, dz);

    if (this.grounded) {
      this.vy = jump ? JUMP : -1;
    } else {
      this.vy += GRAVITY * dt;
    }

    const desired = { x: dx * speed * dt, y: this.vy * dt, z: dz * speed * dt };
    this.controller.computeColliderMovement(this.collider, desired);
    const corrected = this.controller.computedMovement();
    this.grounded = this.controller.computedGrounded();

    const p = this.body.translation();
    const next = { x: p.x + corrected.x, y: p.y + corrected.y, z: p.z + corrected.z };
    this.body.setNextKinematicTranslation(next);

    // Distance actually covered on the ground, for the run's travel log.
    return Math.hypot(corrected.x, corrected.z);
  }

  teleport(x: number, y: number, z: number): void {
    this.body.setTranslation({ x, y, z }, true);
    this.vy = 0;
  }

  setEnabled(on: boolean): void {
    this.collider.setEnabled(on);
  }

  dispose(): void {
    this.physics.world.removeCharacterController(this.controller);
    this.physics.world.removeRigidBody(this.body);
  }
}
