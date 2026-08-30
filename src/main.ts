/** Curbside — entry point.
 *
 *  Boots the world, physics and renderer, then runs one loop that drives
 *  whatever the player currently controls: their own legs, or one of the
 *  vehicles parked around Queens.
 */

import * as THREE from 'three';
import './styles.css';

import { createRun, resetRun, tickRun, checkEnd, eat, addDistance, dayProgress,
  isVendorOpen, timeOfDay, INTERACT_RANGE, VEHICLE_RANGE, DISCOVER_RANGE } from './core/rules';
import type { RunState } from './core/rules';
import type { MenuItem, Vendor } from './core/types';
import { isWaterAt } from './core/world';
import type { WorldData } from './core/world';
import { generateQueens } from './world/procedural';
import { buildCity } from './world/geometry';
import { makeRoadTexture, makeWindowTexture } from './render/textures';
import { createScene } from './render/scene';
import { ChaseCamera } from './render/camera';
import { createPhysics, initRapier, quatFromYaw } from './physics/world';
import type { Physics } from './physics/world';
import { Vehicle, NO_INPUT } from './vehicles/controller';
import { buildVehicleMesh } from './vehicles/mesh';
import type { VehicleMesh } from './vehicles/mesh';
import { spec as vehicleSpec, VEHICLES } from './vehicles/specs';
import type { VehicleSpec } from './vehicles/specs';
import { Player } from './player/onfoot';
import { bindKeyboard, bindTouchStick, consumePress, createInput, readControls } from './input';
import { recordRun } from './storage';
import { sfx, isMuted, setMuted } from './audio';
import * as UI from './ui/index';

const FOOT_SPEC = vehicleSpec('foot');

interface Parked {
  vehicle: Vehicle;
  mesh: VehicleMesh;
  spec: VehicleSpec;
}

async function boot(): Promise<void> {
  const root = document.getElementById('app');
  if (!root) throw new Error('missing #app');
  const refs = UI.buildLayout(root);

  const world: WorldData = generateQueens();
  const isWater = (x: number, z: number) => isWaterAt(world, x, z);

  await initRapier();
  const physics: Physics = createPhysics(world);

  const kit = createScene(refs.canvas);
  const city = buildCity(
    world,
    makeWindowTexture(false),
    makeWindowTexture(true),
    makeRoadTexture(),
  );
  kit.scene.add(city.group);

  // ---- vendors as world markers ----
  const vendorMarkers = new Map<string, THREE.Object3D>();
  const stallGeo = new THREE.BoxGeometry(3.2, 2.6, 3.2);
  for (const v of world.vendors) {
    const g = new THREE.Group();
    const stall = new THREE.Mesh(
      stallGeo,
      new THREE.MeshStandardMaterial({ color: new THREE.Color(v.color), roughness: 0.6 }),
    );
    stall.position.y = 1.3;
    stall.castShadow = true;
    g.add(stall);

    // A glowing pin so vendors are findable from a helicopter.
    const pin = new THREE.Mesh(
      new THREE.ConeGeometry(1.0, 2.4, 6),
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(v.color),
        emissive: new THREE.Color(v.color),
        emissiveIntensity: 1.4,
      }),
    );
    pin.position.y = 7.2;
    pin.rotation.x = Math.PI;
    g.add(pin);

    g.position.set(v.x, 0, v.z);
    g.visible = !v.hidden;
    kit.scene.add(g);
    vendorMarkers.set(v.id, g);
  }

  // ---- parked vehicles ----
  const parked: Parked[] = [];
  for (const s of world.spawns) {
    const sp = VEHICLES[s.vehicle];
    if (!sp) continue;
    const y = sp.domain === 'water' ? 0.4 : sp.size[1] / 2 + 0.6;
    const vehicle = new Vehicle(physics, sp, { x: s.position[0], y, z: s.position[1] }, s.heading, isWater);
    const mesh = buildVehicleMesh(sp);
    kit.scene.add(mesh.group);
    parked.push({ vehicle, mesh, spec: sp });
  }

  // ---- player ----
  const startX = 620, startZ = 9;
  const player = new Player(physics, startX, 3, startZ);
  const playerMesh = buildVehicleMesh(FOOT_SPEC);
  kit.scene.add(playerMesh.group);

  const cam = new ChaseCamera();
  cam.reset(new THREE.Vector3(startX, 2, startZ));

  const input = createInput();
  bindKeyboard(input);
  bindTouchStick(input, refs.stick);

  let run: RunState = createRun();
  let driving: Parked | null = null;
  let nearVendor: Vendor | null = null;
  let nearVehicle: Parked | null = null;
  let night = false;

  refs.mobile.querySelectorAll<HTMLButtonElement>('[data-act]').forEach(b => {
    b.addEventListener('pointerdown', () => {
      if (b.dataset.act === 'interact') input.pressed.add('KeyF');
      if (b.dataset.act === 'brake') input.keys.add('Space');
    });
    b.addEventListener('pointerup', () => {
      if (b.dataset.act === 'brake') input.keys.delete('Space');
    });
  });

  // ---- helpers ----
  const playerPos = new THREE.Vector3();
  const getControlPos = (): THREE.Vector3 => {
    if (driving) {
      const p = driving.vehicle.position;
      return playerPos.set(p.x, p.y, p.z);
    }
    const p = player.position;
    return playerPos.set(p.x, p.y, p.z);
  };

  function enterVehicle(target: Parked): void {
    driving = target;
    player.setEnabled(false);
    playerMesh.group.visible = false;
    target.vehicle.body.wakeUp();
    sfx.click();
    UI.showToast(refs, `${target.spec.name} — ${target.spec.description}`, '#2bd4d9');
  }

  function exitVehicle(): void {
    if (!driving) return;
    const p = driving.vehicle.position;
    const yaw = driving.vehicle.yaw;
    // Step out to the left of the vehicle, clear of its body.
    const off = driving.spec.size[0] * 0.5 + 1.4;
    const x = p.x - Math.cos(yaw) * off;
    const z = p.z + Math.sin(yaw) * off;
    player.teleport(x, Math.max(1.4, p.y), z);
    player.setEnabled(true);
    playerMesh.group.visible = true;
    driving = null;
    sfx.click();
  }

  function order(vendor: Vendor, item: MenuItem): void {
    const before = run.flavor;
    const out = eat(run, vendor, item);
    if (!out.ok) {
      if (out.reason === 'broke') { sfx.broke(); UI.showToast(refs, `Not enough cash for ${item.name}`, '#ff5a5a'); }
      else { sfx.closed(); UI.showToast(refs, `${vendor.name} is closed`, '#ff5a5a'); }
      return;
    }
    if (item.gem) sfx.gem(); else sfx.eat();
    if (out.comboLeveled) {
      sfx.combo();
      UI.showToast(refs, `${run.combo}-cuisine combo — x1.5 flavor`, '#ffd23f');
    } else if (out.newDistrict) {
      sfx.combo();
      UI.showToast(refs, `${vendor.district} unlocked — district bonus up`, '#ffd23f');
    } else {
      UI.showToast(refs, `${item.emoji} +${Math.round(run.flavor - before)} flavor`, item.gem ? '#7cf67c' : '#2bd4d9');
    }
    closeVendor();
    finishIfEnded();
  }

  function openVendor(v: Vendor): void {
    run.status = 'menu';
    run.openVendor = v;
    sfx.click();
    UI.openVendorMenu(refs, v, run, (item) => order(v, item), closeVendor);
  }

  function closeVendor(): void {
    run.openVendor = null;
    if (run.status === 'menu') run.status = 'playing';
    UI.closeModal(refs);
  }

  function finishIfEnded(): boolean {
    const result = checkEnd(run, world.name);
    if (!result) return false;
    sfx.end();
    const { isNewBest, previousBest } = recordRun(result);
    UI.showEnd(refs, result, isNewBest, previousBest, startRun);
    return true;
  }

  function startRun(): void {
    resetRun(run);
    UI.hideTitle(refs);
    UI.hideEnd(refs);
    UI.closeModal(refs);
    refs.hud.classList.add('on');
    refs.mobile.classList.add('on');
    if (driving) exitVehicle();
    player.teleport(startX, 3, startZ);
    for (const v of world.vendors) {
      const m = vendorMarkers.get(v.id);
      if (m) m.visible = !v.hidden;
    }
    cam.reset(new THREE.Vector3(startX, 2, startZ));
  }

  UI.showTitle(refs, world, startRun);

  addEventListener('resize', () => kit.resize());
  addEventListener('keydown', (e) => {
    if (e.code === 'Escape' && run.status === 'menu') closeVendor();
    if (e.code === 'KeyM') { setMuted(!isMuted()); UI.showToast(refs, isMuted() ? 'Muted' : 'Sound on'); }
  });

  // ---- main loop ----
  const fwd = new THREE.Vector3();
  const right = new THREE.Vector3();
  const camQuat = new THREE.Quaternion();
  const bodyQuat = new THREE.Quaternion();
  const bodyPos = new THREE.Vector3();
  let last = performance.now();
  let rotorSpin = 0;

  function frame(now: number): void {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;

    const playing = run.status === 'playing';
    const activeSpec = driving ? driving.spec : FOOT_SPEC;

    // ---- control ----
    let travelled = 0;
    if (playing) {
      if (driving) {
        const ctrl = readControls(input, activeSpec.domain, activeSpec.drive);
        const beforeP = driving.vehicle.position;
        const bx = beforeP.x, bz = beforeP.z;
        driving.vehicle.update(dt, ctrl);
        const afterP = driving.vehicle.position;
        travelled = Math.hypot(afterP.x - bx, afterP.z - bz);
      } else {
        // Movement is relative to the camera's flattened facing.
        kit.camera.getWorldDirection(fwd);
        fwd.y = 0;
        fwd.normalize();
        right.set(fwd.z, 0, -fwd.x);
        const mx = (input.keys.has('KeyD') ? 1 : 0) - (input.keys.has('KeyA') ? 1 : 0) + input.stick.x;
        const mz = (input.keys.has('KeyW') ? 1 : 0) - (input.keys.has('KeyS') ? 1 : 0) + input.stick.y;
        const running = input.keys.has('ShiftLeft') || input.keys.has('ShiftRight');
        travelled = player.update(
          dt,
          { x: Math.max(-1, Math.min(1, mx)), z: Math.max(-1, Math.min(1, mz)) },
          running,
          input.keys.has('Space'),
          { x: fwd.x, z: fwd.z },
          { x: right.x, z: right.z },
        );
      }
      addDistance(run, driving ? driving.spec.id : 'foot', travelled);
    } else if (driving) {
      driving.vehicle.update(dt, NO_INPUT);
    }

    physics.world.step();

    // ---- sync meshes ----
    for (const p of parked) {
      const t = p.vehicle.position;
      const q = p.vehicle.rotation;
      p.mesh.group.position.set(t.x, t.y, t.z);
      p.mesh.group.quaternion.set(q.x, q.y, q.z, q.w);

      if (p === driving) {
        for (let i = 0; i < p.mesh.wheels.length; i++) {
          const ws = p.vehicle.wheelState(i);
          const wm = p.mesh.wheels[i]!;
          if (!ws) continue;
          wm.position.set(ws.pos.x, ws.pos.y, ws.pos.z);
          wm.rotation.set(ws.spin, i < 2 ? ws.steer : 0, 0, 'YXZ');
        }
      }
      if (p.mesh.rotor) {
        const spin = p === driving ? 34 : (p.spec.drive === 'heli' ? 0.6 : 0.3);
        p.mesh.rotor.rotation.y += spin * dt;
      }
    }
    rotorSpin += dt;

    const pp = player.position;
    playerMesh.group.position.set(pp.x, pp.y - 0.75, pp.z);
    playerMesh.group.rotation.y = player.heading;

    // ---- proximity ----
    const pos = getControlPos();
    nearVendor = null;
    nearVehicle = null;
    if (playing) {
      let bestV = Infinity;
      for (const v of world.vendors) {
        const d = Math.hypot(v.x - pos.x, v.z - pos.z);
        if (v.hidden && !run.discovered.has(v.id) && d < DISCOVER_RANGE) {
          run.discovered.add(v.id);
          const m = vendorMarkers.get(v.id);
          if (m) m.visible = true;
          sfx.gem();
          UI.showToast(refs, `Found a hidden gem: ${v.name}`, '#ffd23f');
        }
        if (d < bestV && d < INTERACT_RANGE && (!v.hidden || run.discovered.has(v.id))) {
          bestV = d;
          nearVendor = v;
        }
      }
      if (!driving) {
        let bestC = Infinity;
        for (const p of parked) {
          const t = p.vehicle.position;
          const d = Math.hypot(t.x - pos.x, t.z - pos.z);
          const reach = VEHICLE_RANGE + Math.max(p.spec.size[0], p.spec.size[2]) * 0.5;
          if (d < bestC && d < reach) { bestC = d; nearVehicle = p; }
        }
      }
    }

    // ---- interact ----
    if (consumePress(input, 'KeyF') && playing) {
      if (run.status === 'menu') closeVendor();
      else if (nearVendor) {
        if (isVendorOpen(nearVendor, timeOfDay(run))) openVendor(nearVendor);
        else { sfx.closed(); UI.showToast(refs, `${nearVendor.name} is closed right now`, '#ff5a5a'); }
      } else if (driving) exitVehicle();
      else if (nearVehicle) enterVehicle(nearVehicle);
    }
    if (consumePress(input, 'KeyC')) cam.mode = cam.mode === 0 ? 1 : 0;

    // ---- prompt ----
    if (!playing) UI.showPrompt(refs, null);
    else if (nearVendor) {
      const open = isVendorOpen(nearVendor, timeOfDay(run));
      UI.showPrompt(refs, open
        ? `<b>F</b> order at <span>${nearVendor.name}</span>`
        : `<span class="dim">${nearVendor.name} — closed</span>`);
    } else if (nearVehicle) {
      UI.showPrompt(refs, `<b>F</b> get in the <span>${nearVehicle.spec.name}</span>`);
    } else if (driving) {
      UI.showPrompt(refs, `<b>F</b> get out`);
    } else UI.showPrompt(refs, null);

    // ---- camera ----
    if (driving) {
      const t = driving.vehicle.position;
      const q = driving.vehicle.rotation;
      bodyPos.set(t.x, t.y, t.z);
      bodyQuat.set(q.x, q.y, q.z, q.w);
      cam.update(kit.camera, bodyPos, bodyQuat, driving.spec, driving.vehicle.speed, dt);
    } else {
      bodyPos.set(pp.x, pp.y, pp.z);
      camQuat.setFromAxisAngle(new THREE.Vector3(0, 1, 0), player.heading);
      cam.update(kit.camera, bodyPos, camQuat, FOOT_SPEC, 0, dt);
    }

    // ---- world state ----
    if (playing) {
      tickRun(run, dt);
      finishIfEnded();
    }
    const t = dayProgress(run);
    const { night: isNight } = kit.setTimeOfDay(t);
    if (isNight !== night) { night = isNight; city.setNight(night); }

    // Keep the shadow camera near the player so shadows stay sharp.
    kit.sun.position.set(pos.x + 180, 320, pos.z + 120);
    kit.sun.target.position.set(pos.x, 0, pos.z);
    kit.sun.target.updateMatrixWorld();
    kit.sky.position.copy(kit.camera.position);

    UI.tickToast(refs, dt);
    if (run.status !== 'title') {
      UI.updateHUD(
        refs, run, activeSpec,
        driving ? driving.vehicle.speed : 0,
        driving ? driving.vehicle.altitude : pp.y,
      );
      UI.drawMinimap(refs, world, run, pos.x, pos.z, driving ? driving.vehicle.yaw : player.heading);
    }

    kit.renderer.render(kit.scene, kit.camera);
    requestAnimationFrame(frame);
  }

  void rotorSpin;
  void quatFromYaw;
  requestAnimationFrame(frame);
}

boot().catch((err) => {
  console.error(err);
  const root = document.getElementById('app');
  if (root) root.innerHTML = `<pre class="fatal">Curbside failed to start:\n${String(err)}</pre>`;
});
