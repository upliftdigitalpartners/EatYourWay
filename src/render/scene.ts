/** Renderer, lighting and the sky. The run's time-of-day drives all of it, so
 *  the world visibly slides from afternoon into late night over one crawl. */

import * as THREE from 'three';

const SKY_VERT = `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const SKY_FRAG = `
varying vec3 vDir;
uniform vec3 top;
uniform vec3 horizon;
uniform vec3 bottom;
uniform float sunY;
uniform vec3 sunColor;
void main() {
  float h = normalize(vDir).y;
  vec3 col = h > 0.0
    ? mix(horizon, top, pow(clamp(h, 0.0, 1.0), 0.62))
    : mix(horizon, bottom, pow(clamp(-h, 0.0, 1.0), 0.5));
  // Warm glow banked around the sun's altitude.
  float glow = exp(-abs(h - sunY) * 7.0) * 0.55;
  col += sunColor * glow;
  gl_FragColor = vec4(col, 1.0);
}`;

export interface SceneKit {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  sun: THREE.DirectionalLight;
  hemi: THREE.HemisphereLight;
  sky: THREE.Mesh;
  setTimeOfDay(t: number): { night: boolean };
  resize(): void;
}

/** Palette keyframes across a run: afternoon -> golden -> dusk -> night. */
const KEYS = [
  { t: 0.00, top: 0x2f6fb5, hor: 0x9fc4e8, bot: 0x2a2f38, sun: 0xfff2d0, amb: 2.20, dir: 2.6, sunY: 0.55 },
  { t: 0.40, top: 0x2b5c96, hor: 0xf0a668, bot: 0x2a2530, sun: 0xffb865, amb: 1.70, dir: 2.3, sunY: 0.18 },
  { t: 0.62, top: 0x2d1b4e, hor: 0xd9613f, bot: 0x1c1524, sun: 0xff7a3d, amb: 1.05, dir: 1.4, sunY: 0.02 },
  { t: 0.78, top: 0x160f2b, hor: 0x3b2350, bot: 0x0a0714, sun: 0x6c4bb5, amb: 0.62, dir: 0.45, sunY: -0.10 },
  { t: 1.00, top: 0x070512, hor: 0x1a1330, bot: 0x05040c, sun: 0x2c2450, amb: 0.42, dir: 0.22, sunY: -0.22 },
];

function lerpKeys(t: number) {
  let a = KEYS[0]!, b = KEYS[KEYS.length - 1]!;
  for (let i = 0; i < KEYS.length - 1; i++) {
    if (t >= KEYS[i]!.t && t <= KEYS[i + 1]!.t) { a = KEYS[i]!; b = KEYS[i + 1]!; break; }
  }
  const span = b.t - a.t || 1;
  const k = THREE.MathUtils.clamp((t - a.t) / span, 0, 1);
  const mix = (x: number, y: number) => new THREE.Color(x).lerp(new THREE.Color(y), k);
  return {
    top: mix(a.top, b.top),
    hor: mix(a.hor, b.hor),
    bot: mix(a.bot, b.bot),
    sun: mix(a.sun, b.sun),
    amb: THREE.MathUtils.lerp(a.amb, b.amb, k),
    dir: THREE.MathUtils.lerp(a.dir, b.dir, k),
    sunY: THREE.MathUtils.lerp(a.sunY, b.sunY, k),
  };
}

export function createScene(canvas: HTMLCanvasElement): SceneKit {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.06;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(62, 1, 0.4, 9000);

  // Sky dome, rendered inside-out and pinned to the camera.
  const skyMat = new THREE.ShaderMaterial({
    vertexShader: SKY_VERT,
    fragmentShader: SKY_FRAG,
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      top: { value: new THREE.Color(0x2f6fb5) },
      horizon: { value: new THREE.Color(0x9fc4e8) },
      bottom: { value: new THREE.Color(0x2a2f38) },
      sunY: { value: 0.5 },
      sunColor: { value: new THREE.Color(0xfff2d0) },
    },
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(4000, 24, 16), skyMat);
  sky.frustumCulled = false;
  scene.add(sky);

  const hemi = new THREE.HemisphereLight(0xbcd8ff, 0x6b6358, 2.2);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xfff2d0, 2.3);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 900;
  const s = 260;
  sun.shadow.camera.left = -s;
  sun.shadow.camera.right = s;
  sun.shadow.camera.top = s;
  sun.shadow.camera.bottom = -s;
  sun.shadow.bias = -0.0009;
  scene.add(sun);
  scene.add(sun.target);

  scene.fog = new THREE.Fog(0x9fc4e8, 380, 3400);

  const resize = () => {
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  resize();

  return {
    renderer, scene, camera, sun, hemi, sky, resize,
    setTimeOfDay(t: number) {
      const k = lerpKeys(THREE.MathUtils.clamp(t, 0, 1));
      skyMat.uniforms.top!.value = k.top;
      skyMat.uniforms.horizon!.value = k.hor;
      skyMat.uniforms.bottom!.value = k.bot;
      skyMat.uniforms.sunY!.value = k.sunY;
      skyMat.uniforms.sunColor!.value = k.sun;

      hemi.intensity = k.amb;
      hemi.color = k.top.clone().lerp(new THREE.Color(0xffffff), 0.35);
      sun.intensity = k.dir;
      sun.color = k.sun;

      (scene.fog as THREE.Fog).color = k.hor;
      (scene.fog as THREE.Fog).near = 380;
      (scene.fog as THREE.Fog).far = k.sunY < 0 ? 2200 : 3400;

      return { night: k.sunY < 0.04 };
    },
  };
}
