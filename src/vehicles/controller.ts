/** Vehicle controllers.
 *
 *  Handling is arcade, not simulation: the goal is that a bus feels like a bus
 *  and a jet feels like a jet within a few seconds of driving one, not that
 *  either is accurate.
 *
 *  Convention: vehicle-local forward is +Z, up is +Y, right is +X.
 */

import RAPIER from '@dimforge/rapier3d-compat';
import type { Physics } from '../physics/world';
import { createChassis, quatFromYaw, yawFromQuat } from '../physics/world';
import type { VehicleSpec } from './specs';

export interface ControlInput {
  /** -1 reverse .. 1 forward */
  throttle: number;
  /** -1 left .. 1 right */
  steer: number;
  brake: number;
  /** Nose down (-1) .. nose up (1) */
  pitch: number;
  roll: number;
  /** Rudder / tail rotor. */
  yaw: number;
  /** Helicopter collective: -1 descend .. 1 climb */
  lift: number;
}

export const NO_INPUT: ControlInput = {
  throttle: 0, steer: 0, brake: 0, pitch: 0, roll: 0, yaw: 0, lift: 0,
};

type V3 = { x: number; y: number; z: number };
type Quat = { x: number; y: number; z: number; w: number };

/** Rotate a vector by a quaternion. */
function rot(q: Quat, v: V3): V3 {
  const { x, y, z } = v;
  const ix = q.w * x + q.y * z - q.z * y;
  const iy = q.w * y + q.z * x - q.x * z;
  const iz = q.w * z + q.x * y - q.y * x;
  const iw = -q.x * x - q.y * y - q.z * z;
  return {
    x: ix * q.w + iw * -q.x + iy * -q.z - iz * -q.y,
    y: iy * q.w + iw * -q.y + iz * -q.x - ix * -q.z,
    z: iz * q.w + iw * -q.z + ix * -q.y - iy * -q.x,
  };
}

const scale = (v: V3, s: number): V3 => ({ x: v.x * s, y: v.y * s, z: v.z * s });
const len = (v: V3): number => Math.hypot(v.x, v.y, v.z);

export class Vehicle {
  readonly spec: VehicleSpec;
  readonly body: RAPIER.RigidBody;
  private wheels?: RAPIER.DynamicRayCastVehicleController;
  /** Ground roll accumulated by a fixed-wing, used to gate rotation. */
  private roll = 0;
  private airborne = false;

  constructor(
    private physics: Physics,
    spec: VehicleSpec,
    position: V3,
    heading: number,
    private isWater: (x: number, z: number) => boolean,
  ) {
    this.spec = spec;
    this.body = createChassis(physics, spec.size, spec.mass, position, heading);
    if (spec.drive === 'wheeled') this.initWheels();
  }

  private initWheels(): void {
    const s = this.spec;
    const vc = this.physics.world.createVehicleController(this.body);
    vc.setIndexForwardAxis = 2;

    const halfTrack = (s.track ?? s.size[0] * 0.82) / 2;
    const halfBase = (s.wheelBase ?? s.size[2] * 0.62) / 2;
    const yOff = -s.size[1] * 0.34;
    const radius = s.wheelRadius ?? 0.34;
    const rest = s.suspensionRest ?? 0.36;

    // front-left, front-right, rear-left, rear-right
    const positions: V3[] = [
      { x: -halfTrack, y: yOff, z: halfBase },
      { x: halfTrack, y: yOff, z: halfBase },
      { x: -halfTrack, y: yOff, z: -halfBase },
      { x: halfTrack, y: yOff, z: -halfBase },
    ];
    for (const p of positions) {
      vc.addWheel(p, { x: 0, y: -1, z: 0 }, { x: -1, y: 0, z: 0 }, rest, radius);
    }
    for (let i = 0; i < 4; i++) {
      vc.setWheelSuspensionStiffness(i, s.suspensionStiff ?? 26);
      vc.setWheelFrictionSlip(i, (s.grip ?? 1) * 2.2);
      vc.setWheelMaxSuspensionTravel(i, rest * 0.8);
      vc.setWheelSideFrictionStiffness(i, 0.9);
      vc.setWheelMaxSuspensionForce(i, s.mass * 42);
    }
    this.wheels = vc;
  }

  get position(): V3 { return this.body.translation(); }
  get rotation(): Quat { return this.body.rotation(); }
  get speed(): number { return len(this.body.linvel()); }
  get yaw(): number { return yawFromQuat(this.body.rotation()); }

  /** Signed forward speed in m/s. */
  get forwardSpeed(): number {
    const f = rot(this.body.rotation(), { x: 0, y: 0, z: 1 });
    const v = this.body.linvel();
    return f.x * v.x + f.y * v.y + f.z * v.z;
  }

  get altitude(): number {
    return this.body.translation().y;
  }

  /** Wheel transforms for rendering, or null for non-wheeled vehicles. */
  wheelState(i: number): { pos: V3; steer: number; spin: number } | null {
    if (!this.wheels) return null;
    const hp = this.wheels.wheelChassisConnectionPointCs(i);
    const susp = this.wheels.wheelSuspensionLength(i) ?? 0;
    if (!hp) return null;
    return {
      pos: { x: hp.x, y: hp.y - susp, z: hp.z },
      steer: this.wheels.wheelSteering(i) ?? 0,
      spin: this.wheels.wheelRotation(i) ?? 0,
    };
  }

  update(dt: number, input: ControlInput): void {
    switch (this.spec.drive) {
      case 'wheeled': this.updateWheeled(dt, input); break;
      case 'heli': this.updateHeli(dt, input); break;
      case 'plane': this.updatePlane(dt, input); break;
      case 'boat': this.updateBoat(dt, input); break;
    }
  }

  private updateWheeled(dt: number, input: ControlInput): void {
    const vc = this.wheels;
    if (!vc) return;
    const s = this.spec;

    const fwd = this.forwardSpeed;
    const overSpeed = Math.abs(fwd) >= s.maxSpeed;
    const engine = overSpeed && Math.sign(input.throttle) === Math.sign(fwd)
      ? 0
      : input.throttle * s.accel * s.mass * 0.045;

    // Rear-wheel drive for everything; the front wheels steer.
    vc.setWheelEngineForce(2, engine);
    vc.setWheelEngineForce(3, engine);

    // Steering tightens at low speed and calms down at motorway speeds.
    const speedFactor = 1 / (1 + Math.abs(fwd) * 0.055);
    const target = input.steer * (s.steerAngle ?? 0.55) * speedFactor;
    for (const i of [0, 1]) {
      const cur = vc.wheelSteering(i) ?? 0;
      vc.setWheelSteering(i, cur + (target - cur) * Math.min(1, dt * 9));
    }

    const brake = input.brake * s.brake * s.mass * 0.01;
    for (let i = 0; i < 4; i++) vc.setWheelBrake(i, brake);

    vc.updateVehicle(dt);

    // A boat-less car in deep water sinks; nudge it back to shore-ish drag.
    const p = this.body.translation();
    if (this.isWater(p.x, p.z) && p.y < 1.2) {
      this.body.setLinearDamping(2.6);
    } else {
      this.body.setLinearDamping(0.06);
    }
  }

  private updateHeli(dt: number, input: ControlInput): void {
    const s = this.spec;
    const q = this.body.rotation();
    const up = rot(q, { x: 0, y: 1, z: 0 });
    const mass = s.mass;

    // Collective: hover at neutral, climb or sink from there.
    const hover = 9.81 * mass;
    const collective = hover * (1 + input.lift * ((s.lift ?? 2) - 1));
    // Only push along the rotor axis, the way a real rotor does — tilting the
    // airframe is what moves you forward.
    this.body.addForce(scale(up, collective), true);

    // Cyclic and tail rotor.
    const t = mass * 0.55;
    const pitchT = rot(q, { x: input.pitch * (s.pitchRate ?? 0.9) * t, y: 0, z: 0 });
    const rollT = rot(q, { x: 0, y: 0, z: -input.roll * (s.rollRate ?? 1.2) * t });
    const yawT = rot(q, { x: 0, y: -input.yaw * (s.yawRate ?? 1.1) * t, z: 0 });
    this.body.addTorque(pitchT, true);
    this.body.addTorque(rollT, true);
    this.body.addTorque(yawT, true);

    // Auto-level so a helicopter is flyable without a stick.
    this.levelOut(dt, 0.55);

    // Cap top speed with drag rather than a hard clamp.
    const v = this.body.linvel();
    const sp = len(v);
    if (sp > s.maxSpeed) {
      this.body.addForce(scale(v, -(sp - s.maxSpeed) * mass * 0.6), true);
    }
    this.body.setAngularDamping(2.2);
    this.body.setLinearDamping(0.35);
  }

  private updatePlane(dt: number, input: ControlInput): void {
    const s = this.spec;
    const q = this.body.rotation();
    const fwd = rot(q, { x: 0, y: 0, z: 1 });
    const up = rot(q, { x: 0, y: 1, z: 0 });
    const mass = s.mass;
    const v = this.body.linvel();
    const airspeed = Math.max(0, fwd.x * v.x + fwd.y * v.y + fwd.z * v.z);
    const stall = s.stallSpeed ?? 24;
    const onGround = this.body.translation().y < s.size[1] * 0.9 + 0.6;

    // Thrust.
    const throttle = Math.max(0, input.throttle);
    this.body.addForce(scale(fwd, throttle * s.accel * mass * 0.06), true);

    // Track ground roll so a jet cannot leap off the apron.
    if (onGround) this.roll += airspeed * dt;
    else this.roll = Math.max(this.roll, s.takeoffRoll ?? 0);
    const rotated = this.roll >= (s.takeoffRoll ?? 0) * 0.55 || !onGround;

    // Lift grows with the square of airspeed, and vanishes below stall.
    if (airspeed > stall * 0.4 && rotated) {
      const q2 = (airspeed * airspeed) / (stall * stall);
      const liftForce = Math.min(q2, 2.4) * mass * 9.81 * (s.lift ?? 1.3) * 0.45;
      this.body.addForce(scale(up, liftForce), true);
      this.airborne = !onGround;
    }

    // Control authority scales with airspeed — mushy when slow, sharp when fast.
    const authority = Math.min(1.4, airspeed / Math.max(1, stall));
    const t = mass * 0.5 * authority;
    this.body.addTorque(rot(q, { x: input.pitch * (s.pitchRate ?? 0.85) * t, y: 0, z: 0 }), true);
    this.body.addTorque(rot(q, { x: 0, y: 0, z: -input.roll * (s.rollRate ?? 1.5) * t }), true);
    this.body.addTorque(rot(q, { x: 0, y: -input.yaw * (s.yawRate ?? 0.5) * t, z: 0 }), true);

    // Steer on the ground with the nosewheel.
    if (onGround && airspeed < stall) {
      this.body.addTorque(rot(q, { x: 0, y: -input.steer * mass * 0.35, z: 0 }), true);
    }

    // Drag, plus a hard cap at the spec top speed.
    const sp = len(v);
    if (sp > s.maxSpeed) this.body.addForce(scale(v, -(sp - s.maxSpeed) * mass * 0.5), true);
    this.body.setAngularDamping(this.airborne ? 1.4 : 3.0);
    this.body.setLinearDamping(0.05);
    if (input.brake > 0 && onGround) this.body.setLinearDamping(0.05 + input.brake * 1.6);
  }

  private updateBoat(dt: number, input: ControlInput): void {
    const s = this.spec;
    const q = this.body.rotation();
    const p = this.body.translation();
    const fwd = rot(q, { x: 0, y: 0, z: 1 });
    const right = rot(q, { x: 1, y: 0, z: 0 });
    const mass = s.mass;
    const v = this.body.linvel();

    const wet = this.isWater(p.x, p.z);
    const draft = s.size[1] * 0.32;
    const submersion = Math.max(0, (0 - (p.y - draft)));

    if (wet && submersion > 0) {
      // Archimedes, damped so it does not pogo on the surface.
      const b = submersion * mass * 9.81 * (s.buoyancy ?? 1.7);
      this.body.addForce({ x: 0, y: Math.min(b, mass * 9.81 * 3), z: 0 }, true);
      this.body.addForce({ x: 0, y: -v.y * mass * 1.4, z: 0 }, true);

      // Thrust and rudder only bite in the water.
      this.body.addForce(scale(fwd, input.throttle * s.accel * mass * 0.05), true);
      const speedish = Math.min(1, Math.abs(this.forwardSpeed) / 4);
      this.body.addTorque(
        rot(q, { x: 0, y: -input.steer * (s.yawRate ?? 0.9) * mass * 0.5 * speedish, z: 0 }),
        true,
      );

      // Hulls resist sideways motion hard — that is what makes a boat turn.
      const lateral = right.x * v.x + right.y * v.y + right.z * v.z;
      this.body.addForce(scale(right, -lateral * mass * (s.waterDrag ?? 1.2)), true);

      this.levelOut(dt, 0.9);
      this.body.setLinearDamping(0.5 + input.brake * 1.8);
      this.body.setAngularDamping(2.6);
    } else {
      // Out of the water it is just a heavy box.
      this.body.setLinearDamping(0.1);
      this.body.setAngularDamping(0.6);
    }
  }

  /** Torque the body back toward level flight/trim.
   *  The body's up axis tipping toward +X means it has rolled right, which a
   *  positive torque about +Z undoes; tipping toward +Z is pitch, undone by a
   *  negative torque about +X. */
  private levelOut(_dt: number, strength: number): void {
    const up = rot(this.body.rotation(), { x: 0, y: 1, z: 0 });
    const m = this.spec.mass * strength * 0.5;
    this.body.addTorque({ x: -up.z * m, y: 0, z: up.x * m }, true);
  }

  teleport(pos: V3, heading = 0): void {
    this.body.setTranslation(pos, true);
    this.body.setRotation(quatFromYaw(heading), true);
    this.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    this.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    this.roll = 0;
    this.airborne = false;
  }

  dispose(): void {
    if (this.wheels) this.physics.world.removeVehicleController(this.wheels);
    this.physics.world.removeRigidBody(this.body);
  }
}
