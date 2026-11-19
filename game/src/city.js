// Builds the island of Costa Verde out of three.js primitives and procedural
// canvas textures: one grid city, a causeway, two hills, a beach and a dock.
// Nothing is loaded from the network, so every texture here is drawn at run time.

import { CITY, PALETTE, PLACES } from './world-data.js';

const T = window.THREE;

// ---------------------------------------------------------------- textures ---
function windowTexture(cols, rows, wall, lit) {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#' + wall.toString(16).padStart(6, '0');
  g.fillRect(0, 0, c.width, c.height);
  const cw = c.width / cols, ch = c.height / rows;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const on = Math.random() < lit;
      g.fillStyle = on ? 'rgba(255,236,178,.92)' : 'rgba(24,30,40,.85)';
      g.fillRect(x * cw + cw * 0.18, y * ch + ch * 0.16, cw * 0.64, ch * 0.52);
    }
  }
  const t = new T.CanvasTexture(c);
  t.wrapS = t.wrapT = T.RepeatWrapping;
  t.magFilter = T.NearestFilter;
  return t;
}

function asphaltTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#3b3942'; g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 900; i++) {
    g.fillStyle = Math.random() < 0.5 ? 'rgba(255,255,255,.035)' : 'rgba(0,0,0,.06)';
    g.fillRect(Math.random() * 128, Math.random() * 128, 2, 2);
  }
  // centre line down the tile
  g.fillStyle = 'rgba(238,214,150,.30)';
  g.fillRect(62, 0, 4, 44);
  const t = new T.CanvasTexture(c);
  t.wrapS = t.wrapT = T.RepeatWrapping;
  return t;
}

// ------------------------------------------------------------------- build ---
export function buildCity(scene) {
  const group = new T.Group();
  scene.add(group);

  const N = CITY.streets;            // blocks per side
  const B = CITY.block;              // metres per block
  const SPAN = N * B;                // city side length
  const HALF = SPAN / 2;

  // ---- ground: island plate, sea beyond --------------------------------
  const asph = asphaltTexture();

  // The island plate: exactly the built city, so the edge of the town is the edge
  // of the asphalt and the beach starts where the plate stops.
  const plate = new T.Mesh(new T.PlaneGeometry(SPAN * 1.04, SPAN * 1.04),
    new T.MeshLambertMaterial({ map: asph, color: 0xb0aebb }));
  plate.rotation.x = -Math.PI / 2;
  plate.position.y = -0.02;
  plate.receiveShadow = true;
  group.add(plate);

  // The beach: a wide sand ring from the plate out to the waterline.
  const sand = new T.Mesh(new T.RingGeometry(SPAN * 0.50, SPAN * 0.895, 64, 1),
    new T.MeshLambertMaterial({ color: PALETTE.sand }));
  sand.rotation.x = -Math.PI / 2;
  sand.position.y = -0.012;
  sand.receiveShadow = true;
  group.add(sand);

  // The sea, from the waterline to the horizon.
  const sea = new T.Mesh(new T.RingGeometry(SPAN * 0.885, 3000, 72, 1),
    new T.MeshPhongMaterial({ color: 0x1a6f96, shininess: 150, specular: 0xbfe8ff }));
  sea.rotation.x = -Math.PI / 2;
  sea.position.y = -0.30;
  group.add(sea);

  // a shallow band of surf right at the shore, to soften the seam
  const surf = new T.Mesh(new T.RingGeometry(SPAN * 0.875, SPAN * 0.925, 64, 1),
    new T.MeshBasicMaterial({ color: 0xbfe6ef, transparent: true, opacity: 0.55 }));
  surf.rotation.x = -Math.PI / 2;
  surf.position.y = -0.05;
  group.add(surf);

  // ---- road surface: asphalt strips along each grid line ----------------
  const roadMat = new T.MeshLambertMaterial({ map: asph });
  asph.repeat.set(4, SPAN / 14);
  for (let i = 0; i <= N; i++) {
    const p = -HALF + i * B;
    const arterial = i === 0 || i === N || i === Math.floor(N / 2);
    const w = arterial ? CITY.avenue : CITY.lane;
    const rx = new T.Mesh(new T.PlaneGeometry(w, SPAN * 1.04), roadMat);
    rx.rotation.x = -Math.PI / 2;
    rx.position.set(p, 0.01, 0);
    group.add(rx);
    const rz = new T.Mesh(new T.PlaneGeometry(SPAN * 1.04, w), roadMat);
    rz.rotation.x = -Math.PI / 2;
    rz.position.set(0, 0.012, p);
    group.add(rz);
  }

  // ---- crossings: four bars on each arm of every junction ---------------
  const zebraMat = new T.MeshBasicMaterial({ color: 0xe8e2d0 });
  for (let i = 0; i <= N; i++) {
    for (let j = 0; j <= N; j++) {
      const px = -HALF + i * B;
      const pz = -HALF + j * B;
      for (let k = 0; k < 5; k++) {
        const off = -3.0 + k * 1.5;
        const bar = new T.Mesh(new T.PlaneGeometry(0.55, CITY.lane * 0.66), zebraMat);
        bar.rotation.x = -Math.PI / 2;
        bar.position.set(px + off, 0.035, pz + CITY.lane * 0.72);
        group.add(bar);
        const bar2 = new T.Mesh(new T.PlaneGeometry(CITY.lane * 0.66, 0.55), zebraMat);
        bar2.rotation.x = -Math.PI / 2;
        bar2.position.set(px + CITY.lane * 0.72, 0.035, pz + off);
        group.add(bar2);
      }
    }
  }

  // ---- buildings -------------------------------------------------------
  const winCache = {};
  const buildingBoxes = [];          // for collisions and the minimap
  const wall = PALETTE.wall;

  for (let bx = 0; bx < N; bx++) {
    for (let bz = 0; bz < N; bz++) {
      const cx = -HALF + bx * B + B / 2;
      const cz = -HALF + bz * B + B / 2;
      const distCentre = Math.hypot(cx, cz) / HALF;
      // downtown wants towers; the rim wants low blocks with gardens
      const tall = distCentre < 0.45 ? 1 : 0.42;
      const lots = Math.random() < 0.22 ? 2 : 4;
      const per = B * 0.40;

      for (let k = 0; k < lots; k++) {
        const ox = lots === 2 ? (k === 0 ? -per / 2 : per / 2) : ((k % 2) - 0.5) * per;
        const oz = lots === 2 ? 0 : (Math.floor(k / 2) - 0.5) * per * 0.5;
        const w = lots === 2 ? B * 0.42 : B * 0.34;
        const d = lots === 2 ? B * 0.34 : B * 0.30;
        const h = 9 + Math.random() * 26 * tall + (distCentre < 0.3 ? Math.random() * 34 : 0);
        const col = wall[(Math.random() * wall.length) | 0];
        const key = (Math.random() < 0.5 ? 'a' : 'b') + ((h * 0.5) | 0);
        if (!winCache[key]) winCache[key] = windowTexture(3, 7, col, 0.30);
        const mat = [
          new T.MeshLambertMaterial({ color: col }),
          new T.MeshLambertMaterial({ color: col }),
          new T.MeshLambertMaterial({ color: 0xd8d2c4 }),
          new T.MeshLambertMaterial({ color: 0x8c8478 }),
          new T.MeshLambertMaterial({ map: winCache[key], color: 0xffffff }),
          new T.MeshLambertMaterial({ map: winCache[key], color: 0xffffff }),
        ];
        const box = new T.Mesh(new T.BoxGeometry(w, h, d), mat);
        box.position.set(cx + ox, h / 2, cz + oz);
        box.castShadow = true;
        box.receiveShadow = true;
        group.add(box);
        buildingBoxes.push({ x: box.position.x, z: box.position.z, w, d, h });

        // rooftop plant so the skyline is not a row of slabs
        if (h > 22 && Math.random() < 0.5) {
          const cap = new T.Mesh(new T.BoxGeometry(w * 0.42, 2.4, d * 0.42),
            new T.MeshLambertMaterial({ color: 0xb8b0a0 }));
          cap.position.set(box.position.x, h + 1.2, box.position.z);
          group.add(cap);
        }
      }

      // sidewalk plate under the block
      const walk = new T.Mesh(new T.PlaneGeometry(B * 0.72, B * 0.72),
        new T.MeshLambertMaterial({ color: PALETTE.pavement }));
      walk.rotation.x = -Math.PI / 2;
      walk.position.set(cx, 0.006, cz);
      group.add(walk);
    }
  }

  // ---- palms along the beach boulevard ----------------------------------
  const palmTrunk = new T.MeshLambertMaterial({ color: 0x6b4f34 });
  const palmLeaf = new T.MeshLambertMaterial({ color: PALETTE.palm, side: T.DoubleSide });
  const lathe = [];
  for (let i = 0; i < 6; i++) {
    lathe.push(new T.Vector2(0.26 - i * 0.03, i * 1.05));
  }
  const trunkGeo = new T.LatheGeometry(lathe, 7);
  const leafGeo = new T.ConeGeometry(1.5, 0.5, 6, 1, true);

  function palm(x, z, s = 1) {
    const g = new T.Group();
    const tr = new T.Mesh(trunkGeo, palmTrunk);
    tr.scale.setScalar(s);
    g.add(tr);
    for (let i = 0; i < 6; i++) {
      const lf = new T.Mesh(leafGeo, palmLeaf);
      const a = (i / 6) * Math.PI * 2;
      lf.position.set(Math.cos(a) * 1.1, 5.3 * s, Math.sin(a) * 1.1);
      lf.rotation.set(Math.PI * 0.46, -a, 0);
      lf.scale.setScalar(s);
      g.add(lf);
    }
    g.position.set(x, 0, z);
    group.add(g);
  }
  for (let i = 0; i < N; i++) {
    const p = -HALF + i * B + B / 2;
    for (const s of [1.55, 1.9]) {
      palm(p, HALF + 10 + (s - 1.55) * 18, s);
      palm(p, -HALF - 10 - (s - 1.55) * 18, s * 0.94);
      palm(HALF + 10 + (s - 1.55) * 18, p, s * 0.98);
      palm(-HALF - 10 - (s - 1.55) * 18, p, s * 0.98);
    }
  }
  // a grove along the beach boulevard
  for (let i = 0; i < 22; i++) {
    const a = Math.PI * (0.18 + i * 0.028);
    palm(Math.cos(a) * SPAN * 0.60, Math.sin(a) * SPAN * 0.60, 1.45 + (i % 3) * 0.2);
  }

  // ---- the pier, the docks, the helipad --------------------------------------------------
  function slab(x, z, w, d, col, h = 0.4) {
    const m = new T.Mesh(new T.BoxGeometry(w, h, d), new T.MeshLambertMaterial({ color: col }));
    m.position.set(x, h / 2, z);
    group.add(m);
    return m;
  }
  const pier = PLACES.find(p => p.id === 'pier');
  slab(pier.x, pier.z, 30, 64, 0x8a7358, 0.9);
  for (let i = 0; i < 5; i++) slab(pier.x, pier.z + 26 - i * 12, 22, 1.6, 0x6e5a44, 1.4);

  const docks = PLACES.find(p => p.id === 'docks');
  slab(docks.x, docks.z, 68, 40, 0x7d6a52, 0.6);
  for (let i = 0; i < 4; i++) {
    const c = new T.Mesh(new T.BoxGeometry(5, 5, 10),
      new T.MeshLambertMaterial({ color: [0xb23b32, 0x2f5f8f, 0xd8a63c, 0x2f7a5a][i] }));
    c.position.set(docks.x - 24 + i * 8, 2.6, docks.z + 4);
    group.add(c);
  }

  const pad = PLACES.find(p => p.id === 'helipad');
  slab(pad.x, pad.z, 34, 34, 0x4a4640, 0.7);
  const ring = new T.Mesh(new T.RingGeometry(9, 10.4, 28),
    new T.MeshBasicMaterial({ color: 0xf2b544, side: T.DoubleSide }));
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(pad.x, 0.75, pad.z);
  group.add(ring);

  // ---- the chapel hill and the observatory hill --------------------------
  const hillMat = new T.MeshLambertMaterial({ color: 0x4f6b3c });
  function hill(x, z, r, h) {
    const m = new T.Mesh(new T.ConeGeometry(r, h, 22, 1), hillMat);
    m.position.set(x, h / 2 - 0.6, z);
    group.add(m);
  }
  const chapel = PLACES.find(p => p.id === 'chapel');
  hill(chapel.x, chapel.z, 36, 17);
  const ch = new T.Mesh(new T.BoxGeometry(11, 12, 16), new T.MeshLambertMaterial({ color: 0xf0e6cf }));
  ch.position.set(chapel.x, 17 + 3, chapel.z);
  group.add(ch);
  const spire = new T.Mesh(new T.ConeGeometry(4.4, 11, 4), new T.MeshLambertMaterial({ color: 0xd9696b }));
  spire.position.set(chapel.x, 17 + 13, chapel.z);
  group.add(spire);

  const obs = PLACES.find(p => p.id === 'observatory');
  hill(obs.x, obs.z, 30, 12);
  const dome = new T.Mesh(new T.SphereGeometry(8, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2),
    new T.MeshLambertMaterial({ color: 0xe4e0d4 }));
  dome.position.set(obs.x, 12 + 6, obs.z);
  group.add(dome);

  // ---- the beach: a long crescent of sand with loungers ------------------
  const beach = PLACES.find(p => p.id === 'beach');
  const crescent = new T.Mesh(new T.RingGeometry(96, 148, 30, 1, Math.PI * 0.15, Math.PI * 0.7),
    new T.MeshLambertMaterial({ color: 0xf0dfb4, side: T.DoubleSide }));
  crescent.rotation.x = -Math.PI / 2;
  crescent.position.set(beach.x - 60, 0.05, beach.z - 60);
  group.add(crescent);
  for (let i = 0; i < 9; i++) {
    const a = Math.PI * (0.2 + i * 0.07);
    const lx = beach.x - 60 + Math.cos(a) * 122;
    const lz = beach.z - 60 + Math.sin(a) * 122;
    slab(lx, lz, 2.2, 5, [0xff7a5c, 0x4fe0c0, 0xffffff][i % 3], 0.5);
  }

  // ---- street lamps down the avenues (real lights are too many; emissive heads)
  const lampMat = new T.MeshBasicMaterial({ color: 0xffe0a0 });
  const poleMat = new T.MeshLambertMaterial({ color: 0x2b2b30 });
  for (let i = 0; i < N; i += 1) {
    for (let s = -1; s <= 1; s += 2) {
      const p = -HALF + i * B + B / 2;
      const pole = new T.Mesh(new T.CylinderGeometry(0.18, 0.22, 6.6, 5), poleMat);
      pole.position.set(p, 3.3, s * (HALF - 4));
      group.add(pole);
      const head = new T.Mesh(new T.SphereGeometry(0.55, 7, 5), lampMat);
      head.position.set(p, 6.7, s * (HALF - 4));
      group.add(head);
    }
  }

  return { group, buildingBoxes, SPAN, HALF, N, B };
}

// The sky is a vertical ramp: white hot at the horizon, magenta overhead.
export function buildSky(scene, renderer) {
  const bandCount = PALETTE.sky.length;
  const geo = new T.SphereGeometry(1500, 24, 16);
  const cols = PALETTE.sky.map(h => new T.Color(h));
  const pos = geo.attributes.position;
  const colours = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i) / 1500;                 // -1 .. 1
    const t = Math.min(0.999, Math.max(0, (y + 0.08) / 0.9));
    const f = t * (bandCount - 1);
    const i0 = Math.floor(f), i1 = Math.min(bandCount - 1, i0 + 1);
    const c = cols[i0].clone().lerp(cols[i1], f - i0);
    colours[i * 3] = c.r; colours[i * 3 + 1] = c.g; colours[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new T.BufferAttribute(colours, 3));
  const sky = new T.Mesh(geo, new T.MeshBasicMaterial({ vertexColors: true, side: T.BackSide }));
  scene.add(sky);

  const sun = new T.Mesh(new T.SphereGeometry(46, 20, 12),
    new T.MeshBasicMaterial({ color: PALETTE.sun }));
  sun.position.set(-620, 96, 620);
  scene.add(sun);

  scene.fog = new T.Fog(0xf0a08c, 900, 2600);
  return sky;
}

export function buildLights(scene) {
  scene.add(new T.HemisphereLight(0xffd9a0, 0x2a2244, 1.05));
  const key = new T.DirectionalLight(0xffc07a, 1.5);
  key.position.set(-220, 190, 420);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.near = 10;
  key.shadow.camera.far = 900;
  const sc = key.shadow.camera;
  sc.left = -260; sc.right = 260; sc.top = 260; sc.bottom = -260;
  sc.updateProjectionMatrix();
  key.shadow.bias = -0.0009;
  scene.add(key);
  const rim = new T.DirectionalLight(0x7a5ad0, 0.75);
  rim.position.set(260, 90, -420);
  scene.add(rim);
  return { key, rim };
}
