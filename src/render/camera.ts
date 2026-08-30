/** Chase camera. Distance and height scale with the vehicle so a bus and a
 *  motorcycle both stay framed, and the rig eases rather than snapping. */

import * as THREE from 'three';
import type { VehicleSpec } from '../vehicles/specs';

const tmpPos = new THREE.Vector3();
const tmpLook = new THREE.Vector3();
const desired = new THREE.Vector3();
const offset = new THREE.Vector3();

export class ChaseCamera {
  private pos = new THREE.Vector3(0, 20, -40);
  private look = new THREE.Vector3();
  /** 0 = tight chase, 1 = wide. Cycled with C. */
  mode = 0;

  reset(target: THREE.Vector3): void {
    this.pos.copy(target).add(new THREE.Vector3(0, 8, -14));
    this.look.copy(target);
  }

  update(
    camera: THREE.PerspectiveCamera,
    targetPos: THREE.Vector3,
    targetQuat: THREE.Quaternion,
    spec: VehicleSpec,
    speed: number,
    dt: number,
  ): void {
    const size = Math.max(spec.size[0], spec.size[2]);
    const air = spec.domain === 'air';

    // Pull back as you go faster; it sells speed and keeps the road visible.
    const speedPull = Math.min(1, speed / Math.max(8, spec.maxSpeed)) * (air ? 10 : 5);
    const wide = this.mode === 1 ? 1.75 : 1;

    const dist = (size * (air ? 2.1 : 2.4) + 6 + speedPull) * wide;
    const height = (size * (air ? 0.85 : 0.62) + 2.6 + speedPull * 0.35) * wide;

    // Behind is -Z in vehicle space, since vehicles face +Z.
    offset.set(0, height, -dist).applyQuaternion(targetQuat);
    desired.copy(targetPos).add(offset);

    // Aircraft follow attitude more loosely so rolls do not whip the camera.
    const posLerp = 1 - Math.pow(air ? 0.0012 : 0.0004, dt);
    const lookLerp = 1 - Math.pow(0.00008, dt);

    this.pos.lerp(desired, posLerp);

    tmpLook.set(0, size * 0.25 + 1.2, size * 1.4).applyQuaternion(targetQuat).add(targetPos);
    this.look.lerp(tmpLook, lookLerp);

    // Never let the camera sink through the street.
    if (this.pos.y < 1.4) this.pos.y = 1.4;

    camera.position.copy(this.pos);
    tmpPos.copy(this.look);
    camera.lookAt(tmpPos);

    // A touch of FOV stretch at speed.
    const targetFov = 62 + Math.min(16, (speed / Math.max(10, spec.maxSpeed)) * 16);
    camera.fov += (targetFov - camera.fov) * Math.min(1, dt * 3);
    camera.updateProjectionMatrix();
  }
}
