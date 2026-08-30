import * as THREE from 'three';

/** Procedural window grid. One texture serves every building: wall UVs are
 *  scaled by real dimensions, so a 40 m tower and a 8 m rowhouse get windows
 *  of the same physical size. */
export function makeWindowTexture(lit: boolean): THREE.Texture {
  const S = 128;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d')!;

  g.fillStyle = lit ? '#0d0b16' : '#8d8b96';
  g.fillRect(0, 0, S, S);

  // Two windows per tile, per axis.
  const pad = S * 0.16;
  const w = (S - pad * 3) / 2;
  const h = (S - pad * 3) / 2;
  for (let iy = 0; iy < 2; iy++) {
    for (let ix = 0; ix < 2; ix++) {
      const x = pad + ix * (w + pad);
      const y = pad + iy * (h + pad);
      if (lit) {
        // Roughly a third of windows are on after dark.
        const on = Math.random() < 0.34;
        g.fillStyle = on
          ? `hsl(${38 + Math.random() * 14}, ${70 + Math.random() * 20}%, ${58 + Math.random() * 18}%)`
          : '#141221';
      } else {
        g.fillStyle = '#5f6675';
      }
      g.fillRect(x, y, w, h);
    }
  }

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/** Asphalt with a faint lane stripe down the middle of the tile. */
export function makeRoadTexture(): THREE.Texture {
  const W = 64, H = 128;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d')!;
  g.fillStyle = '#3a3a42';
  g.fillRect(0, 0, W, H);
  for (let i = 0; i < 900; i++) {
    g.fillStyle = `rgba(255,255,255,${Math.random() * 0.035})`;
    g.fillRect(Math.random() * W, Math.random() * H, 1.5, 1.5);
  }
  g.fillStyle = 'rgba(226,206,120,0.75)';
  g.fillRect(W / 2 - 1.4, 8, 2.8, H * 0.42);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}
