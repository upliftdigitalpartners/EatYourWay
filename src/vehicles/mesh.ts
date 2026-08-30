/** Blocky but readable vehicle models, built from primitives so the game has
 *  no asset pipeline yet. Local forward is +Z, matching the controllers. */

import * as THREE from 'three';
import type { VehicleSpec } from './specs';

export interface VehicleMesh {
  group: THREE.Group;
  wheels: THREE.Object3D[];
  /** Spinning rotor / prop, if any. */
  rotor: THREE.Object3D | null;
}

function box(w: number, h: number, d: number, color: number, rough = 0.55): THREE.Mesh {
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0.25 }),
  );
  m.castShadow = true;
  return m;
}

function wheel(radius: number, width: number): THREE.Mesh {
  const geo = new THREE.CylinderGeometry(radius, radius, width, 14);
  geo.rotateZ(Math.PI / 2);
  const m = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({ color: 0x14141a, roughness: 0.9 }),
  );
  m.castShadow = true;
  return m;
}

function glass(w: number, h: number, d: number): THREE.Mesh {
  return new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({
      color: 0x9fd8ef, roughness: 0.1, metalness: 0.6,
      transparent: true, opacity: 0.62,
    }),
  );
}

export function buildVehicleMesh(spec: VehicleSpec): VehicleMesh {
  const [w, h, l] = spec.size;
  const group = new THREE.Group();
  const wheels: THREE.Object3D[] = [];
  let rotor: THREE.Object3D | null = null;

  if (spec.drive === 'wheeled') {
    const bodyH = h * 0.52;
    const body = box(w, bodyH, l, spec.color);
    body.position.y = 0;
    group.add(body);

    // Cabin, pushed back a little so the vehicle reads as facing forward.
    const cabH = h * 0.44;
    const cab = box(w * 0.88, cabH, l * 0.46, spec.accentColor, 0.4);
    cab.position.set(0, bodyH / 2 + cabH / 2 - 0.02, -l * 0.04);
    group.add(cab);

    const wind = glass(w * 0.9, cabH * 0.62, l * 0.47);
    wind.position.copy(cab.position);
    group.add(wind);

    // Headlights.
    for (const sx of [-1, 1]) {
      const lamp = box(w * 0.15, h * 0.09, 0.12, 0xfff2c0, 0.2);
      (lamp.material as THREE.MeshStandardMaterial).emissive = new THREE.Color(0xffe9a8);
      (lamp.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.9;
      lamp.position.set(sx * w * 0.32, -bodyH * 0.1, l / 2 + 0.02);
      group.add(lamp);
    }

    const r = spec.wheelRadius ?? 0.34;
    for (let i = 0; i < 4; i++) {
      const wh = wheel(r, Math.min(0.34, w * 0.2));
      wheels.push(wh);
      group.add(wh);
    }
  } else if (spec.drive === 'heli') {
    const fuse = box(w, h * 0.6, l * 0.46, spec.color);
    group.add(fuse);
    const cockpit = glass(w * 0.85, h * 0.5, l * 0.2);
    cockpit.position.set(0, h * 0.05, l * 0.2);
    group.add(cockpit);

    const boom = box(w * 0.22, h * 0.16, l * 0.5, spec.color);
    boom.position.set(0, h * 0.12, -l * 0.34);
    group.add(boom);

    const fin = box(w * 0.1, h * 0.42, l * 0.1, spec.accentColor);
    fin.position.set(0, h * 0.36, -l * 0.52);
    group.add(fin);

    // Main rotor.
    rotor = new THREE.Group();
    for (let i = 0; i < 4; i++) {
      const blade = box(0.34, 0.07, l * 0.92, 0x2a2a32, 0.7);
      blade.rotation.y = (i * Math.PI) / 2;
      rotor.add(blade);
    }
    rotor.position.y = h * 0.5;
    group.add(rotor);

    for (const sx of [-1, 1]) {
      const skid = box(0.1, 0.1, l * 0.42, 0x3a3a44);
      skid.position.set(sx * w * 0.38, -h * 0.42, 0);
      group.add(skid);
    }
  } else if (spec.drive === 'plane') {
    const fuse = box(w * 0.16, h * 0.5, l, spec.color);
    group.add(fuse);

    const cockpit = glass(w * 0.15, h * 0.34, l * 0.2);
    cockpit.position.set(0, h * 0.2, l * 0.24);
    group.add(cockpit);

    const wing = box(w, h * 0.1, l * 0.2, spec.color);
    wing.position.set(0, h * 0.06, l * 0.02);
    group.add(wing);

    const tail = box(w * 0.38, h * 0.08, l * 0.12, spec.accentColor);
    tail.position.set(0, h * 0.14, -l * 0.42);
    group.add(tail);

    const fin = box(h * 0.06, h * 0.5, l * 0.12, spec.accentColor);
    fin.position.set(0, h * 0.38, -l * 0.42);
    group.add(fin);

    rotor = new THREE.Group();
    const prop = box(0.08, w * 0.22, 0.06, 0x22222a);
    rotor.add(prop);
    const prop2 = box(w * 0.22, 0.08, 0.06, 0x22222a);
    rotor.add(prop2);
    rotor.position.set(0, 0, l / 2 + 0.1);
    group.add(rotor);

    // Fixed gear.
    for (const [sx, sz] of [[-1, 0.2], [1, 0.2], [0, -0.38]] as const) {
      const strut = box(0.09, h * 0.4, 0.09, 0x2a2a32);
      strut.position.set(sx * w * 0.22, -h * 0.42, sz * l);
      group.add(strut);
    }
  } else if (spec.drive === 'boat') {
    const hull = box(w, h * 0.42, l, spec.color);
    group.add(hull);

    const bow = new THREE.Mesh(
      new THREE.ConeGeometry(w * 0.5, l * 0.28, 4),
      new THREE.MeshStandardMaterial({ color: spec.color, roughness: 0.5 }),
    );
    bow.rotation.x = Math.PI / 2;
    bow.rotation.z = Math.PI / 4;
    bow.position.set(0, 0, l * 0.6);
    bow.castShadow = true;
    group.add(bow);

    const cabin = box(w * 0.62, h * 0.44, l * 0.3, spec.accentColor);
    cabin.position.set(0, h * 0.4, -l * 0.06);
    group.add(cabin);
  } else {
    // On foot: a simple capsule so the player reads at a distance.
    const torso = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.28, 0.8, 4, 10),
      new THREE.MeshStandardMaterial({ color: spec.color, roughness: 0.7 }),
    );
    torso.castShadow = true;
    torso.position.y = 0.15;
    group.add(torso);
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.19, 12, 10),
      new THREE.MeshStandardMaterial({ color: 0xf0c9a0, roughness: 0.8 }),
    );
    head.position.y = 0.82;
    head.castShadow = true;
    group.add(head);
  }

  return { group, wheels, rotor };
}
