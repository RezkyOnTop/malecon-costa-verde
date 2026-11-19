// Everything that moves: the player on foot, drivable cars, pedestrians, and the
// police who chase a wanted level. All meshes are built from three.js primitives
// so the game ships with no model files at all.

import { PALETTE } from './world-data.js';

const T = window.THREE;

// ---------------------------------------------------------------- vehicles ---
const CAR_SPEC = {
  coupe: { w: 2.0, h: 1.05, l: 4.3, roof: 0.42, mass: 1.0, top: 44 },
  sedan: { w: 2.0, h: 1.15, l: 4.7, roof: 0.52, mass: 1.15, top: 38 },
  van:   { w: 2.2, h: 1.85, l: 5.6, roof: 1.30, mass: 1.55, top: 30 },
  cop:   { w: 2.05, h: 1.2, l: 4.8, roof: 0.5, mass: 1.2, top: 48 },
};

export function makeCar(colourIndex, kind = 'sedan', cop = false) {
  const spec = CAR_SPEC[cop ? 'cop' : kind] || CAR_SPEC.sedan;
  const g = new T.Group();
  const body = cop ? 0x1b2230 : (PALETTE.car[colourIndex % PALETTE.car.length]);

  const shellMat = new T.MeshPhongMaterial({ color: body, shininess: 70, specular: 0x9aa8bb });
  const shell = new T.Mesh(new T.BoxGeometry(spec.w, spec.h * 0.62, spec.l), shellMat);
  shell.position.y = spec.h * 0.55;
  shell.castShadow = true;
  shell.receiveShadow = true;
  g.add(shell);

  // cabin / roof
  const cabMat = new T.MeshPhongMaterial({ color: 0x22262e, shininess: 120, specular: 0xffffff });
  const cab = new T.Mesh(new T.BoxGeometry(spec.w * 0.86, spec.roof, spec.l * 0.46), cabMat);
  cab.position.set(0, spec.h * 0.55 + spec.h * 0.31 + spec.roof * 0.5, -spec.l * 0.06);
  g.add(cab);

  // wheels
  const wheelMat = new T.MeshLambertMaterial({ color: 0x14161a });
  const rimMat = new T.MeshLambertMaterial({ color: 0xc8c8c0 });
  const wr = spec.h * 0.34;
  const wheels = [];
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const w = new T.Mesh(new T.CylinderGeometry(wr, wr, 0.34, 10), wheelMat);
      w.rotation.z = Math.PI / 2;
      w.position.set(sx * spec.w * 0.5, wr, sz * spec.l * 0.32);
      g.add(w);
      const rim = new T.Mesh(new T.CylinderGeometry(wr * 0.52, wr * 0.52, 0.36, 8), rimMat);
      rim.rotation.z = Math.PI / 2;
      rim.position.copy(w.position);
      g.add(rim);
      wheels.push(w);
    }
  }

  // lights
  const head = new T.MeshBasicMaterial({ color: 0xfff3c8 });
  const tail = new T.MeshBasicMaterial({ color: 0xff3b30 });
  for (const sx of [-1, 1]) {
    const hl = new T.Mesh(new T.BoxGeometry(0.42, 0.2, 0.12), head);
    hl.position.set(sx * spec.w * 0.32, spec.h * 0.52, -spec.l * 0.5);
    g.add(hl);
    const tl = new T.Mesh(new T.BoxGeometry(0.38, 0.16, 0.1), tail);
    tl.position.set(sx * spec.w * 0.33, spec.h * 0.55, spec.l * 0.5);
    g.add(tl);
  }

  if (cop) {
    // light bar and livery stripe
    const bar = new T.Group();
    const red = new T.Mesh(new T.BoxGeometry(0.5, 0.14, 0.3), new T.MeshBasicMaterial({ color: 0xff2a2a }));
    red.position.x = -0.32;
    const blu = new T.Mesh(new T.BoxGeometry(0.5, 0.14, 0.3), new T.MeshBasicMaterial({ color: 0x2a6cff }));
    blu.position.x = 0.32;
    bar.add(red, blu);
    bar.position.set(0, spec.h * 0.55 + spec.h * 0.31 + spec.roof + 0.16, -spec.l * 0.04);
    g.add(bar);
    g.userData.lightBar = bar;

    const stripe = new T.Mesh(new T.BoxGeometry(spec.w * 1.01, 0.2, spec.l * 0.62),
      new T.MeshBasicMaterial({ color: 0xf0f0ea }));
    stripe.position.set(0, spec.h * 0.42, 0);
    g.add(stripe);
  }

  g.userData.spec = spec;
  g.userData.wheels = wheels;
  return g;
}

// ------------------------------------------------------------- pedestrians ---
export function makePerson(seed = 0, cop = false) {
  const g = new T.Group();
  const skin = PALETTE.skin[seed % PALETTE.skin.length];
  const shirt = cop ? 0x22304a : [0xf2c14e, 0xd9696b, 0x4fe0c0, 0xe4e0d4, 0x8a4f9e, 0x2f7a5a][seed % 6];
  const legs = cop ? 0x1b2230 : [0x2b3340, 0x4a4a52, 0x7d6a52][seed % 3];

  const torso = new T.Mesh(new T.BoxGeometry(0.52, 0.66, 0.3),
    new T.MeshLambertMaterial({ color: shirt }));
  torso.position.y = 1.16;
  torso.castShadow = true;
  g.add(torso);

  const head = new T.Mesh(new T.SphereGeometry(0.17, 9, 7),
    new T.MeshLambertMaterial({ color: skin }));
  head.position.y = 1.66;
  g.add(head);

  const hairMat = new T.MeshLambertMaterial({ color: [0x1a1410, 0x3a2418, 0x7a5a3a][seed % 3] });
  const hair = new T.Mesh(new T.SphereGeometry(0.175, 9, 6, 0, Math.PI * 2, 0, Math.PI * 0.55), hairMat);
  hair.position.y = 1.68;
  g.add(hair);

  const limbMat = new T.MeshLambertMaterial({ color: legs });
  const armMat = new T.MeshLambertMaterial({ color: shirt });
  const limbs = {};
  for (const [k, sx] of [['l', -1], ['r', 1]]) {
    const leg = new T.Mesh(new T.BoxGeometry(0.19, 0.84, 0.21), limbMat);
    leg.position.set(sx * 0.14, 0.42, 0);
    g.add(leg);
    limbs[k + 'Leg'] = leg;
    const arm = new T.Mesh(new T.BoxGeometry(0.14, 0.62, 0.16), armMat);
    arm.position.set(sx * 0.35, 1.14, 0);
    g.add(arm);
    limbs[k + 'Arm'] = arm;
  }
  g.userData.limbs = limbs;

  if (cop) {
    const cap = new T.Mesh(new T.CylinderGeometry(0.19, 0.19, 0.12, 8),
      new T.MeshLambertMaterial({ color: 0x101826 }));
    cap.position.y = 1.80;
    g.add(cap);
    const badge = new T.Mesh(new T.BoxGeometry(0.1, 0.1, 0.03),
      new T.MeshBasicMaterial({ color: 0xf2b544 }));
    badge.position.set(0.14, 1.28, 0.16);
    g.add(badge);
  }
  return g;
}

// ------------------------------------------------------------------ player ---
export function makePlayer() {
  const g = makePerson(4, false);
  // give the player a jacket so they read as the protagonist at any distance
  const jacket = new T.Mesh(new T.BoxGeometry(0.58, 0.44, 0.36),
    new T.MeshLambertMaterial({ color: 0xe8dcc0 }));
  jacket.position.y = 1.34;
  g.add(jacket);
  const backpack = new T.Mesh(new T.BoxGeometry(0.34, 0.38, 0.16),
    new T.MeshLambertMaterial({ color: 0x6b4f34 }));
  backpack.position.set(0, 1.18, 0.22);
  g.add(backpack);
  return g;
}

// ------------------------------------------------------------------ update ---
export function walkCycle(person, phase, speed) {
  const L = person.userData.limbs;
  if (!L) return;
  const amp = Math.min(0.85, speed * 0.16);
  const s = Math.sin(phase);
  L.lLeg.rotation.x = s * amp;
  L.rLeg.rotation.x = -s * amp;
  L.lArm.rotation.x = -s * amp * 0.8;
  L.rArm.rotation.x = s * amp * 0.8;
}

export function spinWheels(car, distance) {
  const r = car.userData.spec.h * 0.34;
  for (const w of car.userData.wheels) w.rotation.x = distance / r;
}
