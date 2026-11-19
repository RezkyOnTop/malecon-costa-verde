// MALECÓN — the game itself. One loop: read input, move the player or the car,
// run the police, step the jobs, then draw the HUD and the minimap from state.

import { CITY, PALETTE, JOBS, PLACES, SPAWNS } from './world-data.js';
import { buildCity, buildSky, buildLights } from './city.js';
import { makeCar, makePlayer, makePerson, walkCycle, spinWheels } from './actors.js';
import { Police, HEAT } from './police.js';
import { initInput, held, once, consumeMouse, clearPressed, isMouseDown } from './input.js';

const T = window.THREE;
const SAVE_KEY = 'malecon.save.v1';

// -------------------------------------------------------------------- setup ---
const canvas = document.getElementById('view');
const renderer = new T.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
renderer.setSize(innerWidth, innerHeight, false);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = T.PCFSoftShadowMap;
renderer.toneMapping = T.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new T.Scene();
const camera = new T.PerspectiveCamera(62, innerWidth / innerHeight, 0.4, 2400);

addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
});

initInput(canvas);
buildSky(scene, renderer);
buildLights(scene);
const city = buildCity(scene);
const police = new Police(scene, city, makeCar, makePerson);

// ------------------------------------------------------------------- state ---
const state = {
  day: 1, cash: 0, respect: 0, jobIndex: 0,
  step: 'title',           // title | play | pause
  inCar: null,
  clock: 18 * 60 + 40,     // minutes
  missionLeft: 0,
  message: null,
  messageT: 0,
  saved: null,
};

// Streets run on the lattice x,z = -HALF + k*B. Anything that must stand on a road
// gets snapped to the nearest centreline; inside a block there is only a building.
function onRoad(v) {
  const B = CITY.block, HALF = city.HALF;
  const k = Math.round((v + HALF) / B);
  return Math.max(-HALF, Math.min(HALF, -HALF + k * B));
}
// Both axes snapped = a crossroads, which is the only spot guaranteed to be open
// asphalt with sightlines down four streets.
function snapToStreet(x, z) {
  return { x: onRoad(x), z: onRoad(z) };
}

const start = snapToStreet(SPAWNS.player.x, SPAWNS.player.z);
const player = makePlayer();
player.position.set(start.x, 0, start.z);
scene.add(player);

const playerBody = {
  pos: player.position,
  vel: new T.Vector3(),
  facing: Math.PI,
  speed: 0,
  phase: 0,
  health: 100,
};

const startPoint = start;
const cars = [];
function spawnCars() {
  for (const c of SPAWNS.cars) {
    const g = makeCar(c.colour, c.kind);
    const at = snapToStreet(c.x, c.z);
    if (Math.hypot(at.x - startPoint.x, at.z - startPoint.z) < 14) {
      at.x += at.x >= 0 ? CITY.block : -CITY.block;
    }
    g.position.set(at.x, 0, at.z);
    g.rotation.y = Math.random() * Math.PI * 2;
    g.userData.v = new T.Vector3();
    g.userData.driverless = true;
    g.userData.wheelsRoll = 0;
    scene.add(g);
    cars.push(g);
  }
}
spawnCars();

// traffic: a few cars that drive the avenues forever
const traffic = [];
for (let i = 0; i < 7; i++) {
  const g = makeCar(i % PALETTE.car.length, i % 3 === 0 ? 'van' : 'sedan');
  const lane = (i % 3) - 1;
  g.position.set(-260 + i * 74, 0, lane * CITY.block * 3);
  g.rotation.y = Math.PI / 2;
  g.userData.v = new T.Vector3();
  g.userData.traffic = { axis: i % 2 ? 'x' : 'z', dir: i % 2 ? 1 : -1, speed: 9 + i % 4 };
  scene.add(g);
  traffic.push(g);
}

// pedestrians: they walk the pavements and scatter when a car comes
const peds = [];
const PED_COUNT = 46;
for (let i = 0; i < PED_COUNT; i++) {
  const g = makePerson(i);
  const px = (Math.random() - 0.5) * city.SPAN * 0.9;
  const pz = (Math.random() - 0.5) * city.SPAN * 0.9;
  const road = Math.random() < 0.5
    ? { x: onRoad(px) + (Math.random() < 0.5 ? -9 : 9), z: pz }
    : { x: px, z: onRoad(pz) + (Math.random() < 0.5 ? -9 : 9) };
  g.position.set(road.x, 0, road.z);
  g.rotation.y = Math.random() * 6.28;
  g.userData.ped = { phase: Math.random() * 6.28, dir: Math.random() * 6.28, speed: 1.1 + Math.random() * 0.6 };
  scene.add(g);
  peds.push(g);
}

// ---------------------------------------------------------------- the jobs ---
const marker = new T.Group();
{
  const ring = new T.Mesh(new T.RingGeometry(3.4, 4.6, 24),
    new T.MeshBasicMaterial({ color: 0xf2b544, side: T.DoubleSide, transparent: true, opacity: 0.9 }));
  ring.rotation.x = -Math.PI / 2;
  marker.add(ring);
  const beam = new T.Mesh(new T.CylinderGeometry(1.5, 2.4, 34, 12, 1, true),
    new T.MeshBasicMaterial({ color: 0xf2b544, transparent: true, opacity: 0.10, side: T.DoubleSide }));
  beam.position.y = 17;
  marker.add(beam);
  const lamp = new T.Mesh(new T.SphereGeometry(0.7, 8, 6),
    new T.MeshBasicMaterial({ color: 0xfff3c8 }));
  lamp.position.y = 1.2;
  marker.add(lamp);
  scene.add(marker);
}

function placeAt(id) {
  return PLACES.find(p => p.id === id) || PLACES[0];
}

function currentJob() { return JOBS[Math.min(state.jobIndex, JOBS.length - 1)]; }

function startJob(index) {
  state.jobIndex = index;
  const job = currentJob();
  const spot = placeAt(job.at);
  marker.position.set(spot.x, 0, spot.z);
  marker.visible = true;
  state.missionLeft = job.id === 'observatory' ? 220 : 168;
  say(job.who, job.line);
  hud.missionJob.textContent = `JOB ${index + 1}/${JOBS.length}`;
  hud.missionTitle.textContent = job.title;
  hud.missionObjective.textContent = job.brief;
  hud.missionNext.textContent = `NEXT · ${spot.name}`;
  hud.street.textContent = spot.name;
  paintStage(index);
}

function paintStage(index) {
  const segs = hud.stage.children;
  for (let i = 0; i < segs.length; i++) segs[i].classList.toggle('on', i <= Math.floor(index / 2));
}

function completeJob() {
  const job = currentJob();
  state.cash += job.cash;
  state.respect += 55 + state.jobIndex * 12;
  flash(`${job.title.toUpperCase()} · +$${job.cash.toLocaleString()}`);
  if (state.jobIndex + 1 < JOBS.length) {
    setTimeout(() => startJob(state.jobIndex + 1), 2600);
    state.missionLeft = 0;
    hud.missionObjective.textContent = 'Job closed. Next call coming in.';
  } else {
    hud.missionObjective.textContent = 'The week is over. The island is yours.';
    hud.missionNext.textContent = 'NEXT · nothing. enjoy the sun.';
    state.missionLeft = 0;
  }
}

// ------------------------------------------------------------------- hud refs ---
const hud = {
  root: document.getElementById('hud'),
  missionJob: document.getElementById('mission-job'),
  missionTitle: document.getElementById('mission-title'),
  missionObjective: document.getElementById('mission-objective'),
  missionNext: document.getElementById('mission-next'),
  missionTimer: document.getElementById('mission-timer'),
  stage: document.getElementById('mission-stage'),
  wantedRack: document.getElementById('wanted-rack'),
  wantedStars: document.getElementById('wanted-stars'),
  wantedNote: document.getElementById('wanted-note'),
  copRadio: document.getElementById('cop-radio'),
  copHead: document.getElementById('cop-units'),
  copList: document.getElementById('cop-list'),
  cash: document.getElementById('cash'),
  clock: document.getElementById('clock'),
  respect: document.getElementById('respect'),
  rideName: document.getElementById('ride-name'),
  rideBar: document.getElementById('ride-bar').firstElementChild,
  speed: document.getElementById('speed-num'),
  gear: document.getElementById('gear'),
  ammo: document.getElementById('ammo'),
  street: document.getElementById('street-name'),
  subtitle: document.getElementById('subtitle'),
  subWho: document.getElementById('sub-who'),
  subWhat: document.getElementById('sub-what'),
  toast: document.getElementById('toast'),
  title: document.getElementById('title-screen'),
  pause: document.getElementById('pause-screen'),
  saveDay: document.getElementById('save-day'),
  minimap: document.getElementById('minimap'),
  bigmap: document.getElementById('big-map'),
  mapcanvas: document.getElementById('mapcanvas'),
};

for (let i = 0; i < 5; i++) hud.wantedStars.appendChild(document.createElement('i'));

function say(who, what) {
  hud.subWho.textContent = who;
  hud.subWhat.textContent = what;
  hud.subtitle.classList.remove('hidden');
  state.message = { who, what };
  state.messageT = 6.5;
}

function flash(text) {
  hud.toast.textContent = text;
  hud.toast.classList.remove('hidden');
  state.messageT = Math.max(state.messageT, 3.2);
}

// ------------------------------------------------------------------- camera ---
const camState = { yaw: Math.PI * 0.5, pitch: 0.17, dist: 12.5, target: new T.Vector3(), frozen: false };

function updateCamera(dt) {
  if (camState.frozen) return;
  const m = consumeMouse();
  camState.yaw -= m.dx * 0.0032;
  camState.pitch = Math.max(-0.35, Math.min(0.95, camState.pitch + m.dy * 0.0026));

  const focus = new T.Vector3();
  let wantDist = 7.4, wantHeight = 2.9;

  if (state.inCar) {
    const car = state.inCar;
    const back = new T.Vector3(-Math.sin(car.rotation.y), 0, -Math.cos(car.rotation.y));
    focus.copy(car.position).addScaledVector(back, 6.4);
    focus.y += 1.15;
    wantDist = 9.0 + Math.min(5.0, playerBody.speed * 0.10);
    wantHeight = 2.35;
    // the camera trails the car's heading, not the mouse, while driving fast
    const blend = Math.min(1, 0.35 + playerBody.speed / 26);
    let carYaw = state.inCar.rotation.y + Math.PI;
    let d = carYaw - camState.yaw;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    camState.yaw += d * blend * dt * 5.5;
  } else {
    focus.copy(player.position);
    focus.y += 1.62;
  }

  camState.dist += (wantDist - camState.dist) * Math.min(1, dt * 3.2);
  const back = new T.Vector3(
    Math.sin(camState.yaw) * Math.cos(camState.pitch),
    Math.sin(camState.pitch) + 0.16,
    Math.cos(camState.yaw) * Math.cos(camState.pitch),
  ).normalize().multiplyScalar(camState.dist);

  camState.target.lerp(new T.Vector3(focus.x + back.x, focus.y + back.y * 0.62 + wantHeight * 0.28, focus.z + back.z),
    Math.min(1, dt * 7));
  camState.target.y = Math.max(0.9, camState.target.y);
  camera.position.copy(camState.target);
  camera.lookAt(focus.x, focus.y + 0.5, focus.z);
}

// ------------------------------------------------------------------- moving ---
const PLAYER_WALK = 4.4, PLAYER_RUN = 8.2;

function updatePlayer(dt) {
  const fwd = new T.Vector3(-Math.sin(camState.yaw), 0, -Math.cos(camState.yaw));
  const right = new T.Vector3(fwd.z, 0, -fwd.x);
  const move = new T.Vector3();
  if (held('KeyW', 'ArrowUp')) move.add(fwd);
  if (held('KeyS', 'ArrowDown')) move.sub(fwd);
  if (held('KeyD', 'ArrowRight')) move.add(right);
  if (held('KeyA', 'ArrowLeft')) move.sub(right);

  const running = held('ShiftLeft', 'ShiftRight');
  const targetSpeed = move.lengthSq() > 0 ? (running ? PLAYER_RUN : PLAYER_WALK) : 0;
  playerBody.speed += (targetSpeed - playerBody.speed) * Math.min(1, dt * 9);

  if (move.lengthSq() > 0) {
    move.normalize();
    const want = Math.atan2(move.x, move.z);
    let d = want - playerBody.facing;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    playerBody.facing += d * Math.min(1, dt * 11);
  }

  const step = new T.Vector3(Math.sin(playerBody.facing), 0, Math.cos(playerBody.facing))
    .multiplyScalar(playerBody.speed * dt);
  player.position.add(step);
  player.position.y = 0;
  player.rotation.y = playerBody.facing;

  // keep the player on the island
  const lim = city.SPAN * 0.62;
  player.position.x = Math.max(-lim, Math.min(lim, player.position.x));
  player.position.z = Math.max(-lim, Math.min(lim, player.position.z));

  playerBody.phase += playerBody.speed * dt * 1.9;
  walkCycle(player, playerBody.phase, playerBody.speed);

  // enter the nearest car
  if (once('KeyE')) {
    let best = null, bestD = 5.4;
    for (const c of cars.concat(traffic)) {
      const d = c.position.distanceTo(player.position);
      if (d < bestD) { best = c; bestD = d; }
    }
    if (best) enterCar(best);
  }
  if (once('KeyF') && playerBody.speed > 2 && state.inCar === null) {
    // a shove: the nearest pedestrian goes down and the heat comes up
    for (const p of peds) {
      if (p.position.distanceTo(player.position) < 2.4) {
        p.userData.ped.down = 2.2;
        police.setHeat(Math.max(police.heat, HEAT.seen));
        flash('ASSAULT · WITNESSED');
        break;
      }
    }
  }
}

function enterCar(car) {
  if (state.inCar) exitCar();
  state.inCar = car;
  car.userData.driverless = false;
  car.userData.wasTraffic = !!car.userData.traffic;
  car.userData.thief = true;
  car.userData.speed = 0;
  camState.yaw = car.rotation.y + Math.PI;
  camState.pitch = 0.12;
  car.userData.steer = 0;
  player.visible = false;
  hud.rideName.textContent = carName(car);
  if (car.userData.traffic) {
    police.setHeat(Math.max(police.heat, HEAT.chase));
    flash('GRAND THEFT AUTO');
  }
  say('NICO', 'Plates are wrong, but so is everyone\'s.');
}

function exitCar() {
  const car = state.inCar;
  if (!car) return;
  state.inCar = null;
  player.visible = true;
  const side = new T.Vector3(Math.cos(car.rotation.y), 0, -Math.sin(car.rotation.y));
  player.position.copy(car.position).addScaledVector(side, 2.6);
  player.position.y = 0;
  playerBody.facing = car.rotation.y;
  hud.rideName.textContent = 'ON FOOT';
}

function carName(car) {
  const names = {
    coupe: ['VELOZ COMET RS', 'CANGREJO GT'], sedan: ['MAREA 4P', 'ISLA 200'],
    van: ['CAMELLO VAN', 'TORTUGA CARGO'], cop: 'CVPD PATROL',
  };
  const s = car.userData.spec;
  const kind = s.l > 5 ? 'van' : s.top > 42 ? 'coupe' : 'sedan';
  const list = names[kind];
  return Array.isArray(list) ? list[(car.id || 0) % list.length] : list;
}

function updateCar(dt) {
  const car = state.inCar;
  if (!car) return;
  const s = car.userData.spec;
  const throttle = held('KeyW', 'ArrowUp') ? 1 : 0;
  const brake = held('KeyS', 'ArrowDown') ? 1 : 0;
  const steerIn = (held('KeyA', 'ArrowLeft') ? 1 : 0) - (held('KeyD', 'ArrowRight') ? 1 : 0);

  const maxSpeed = s.top;
  let speed = car.userData.speed || 0;
  if (throttle) speed += (maxSpeed - speed) * dt * 1.15;
  if (brake) speed -= (speed > 0 ? 26 : -8) * dt;
  if (!throttle && !brake) speed *= 1 - Math.min(0.9, dt * 0.55);
  speed = Math.max(-8, Math.min(maxSpeed, speed));
  car.userData.speed = speed;

  const steer = car.userData.steer || 0;
  car.userData.steer = steer + (steerIn - steer) * Math.min(1, dt * 7);

  const grip = Math.min(1, Math.abs(speed) / 9);
  car.rotation.y += car.userData.steer * dt * 1.9 * Math.sign(speed || 1) * grip;

  const fwd = new T.Vector3(Math.sin(car.rotation.y), 0, Math.cos(car.rotation.y));
  car.position.addScaledVector(fwd, speed * dt);
  car.position.y = 0;
  car.userData.wheelsRoll = (car.userData.wheelsRoll || 0) + Math.abs(speed * dt);
  spinWheels(car, car.userData.wheelsRoll);

  // body roll + a little squat, the cheapest way to make a box feel heavy
  car.rotation.z = -car.userData.steer * 0.045 * grip;
  car.rotation.x = Math.max(-0.03, Math.min(0.03, (throttle ? -0.022 : 0) + (brake ? 0.03 : 0)));

  playerBody.speed = Math.abs(speed);

  const lim = city.SPAN * 0.7;
  car.position.x = Math.max(-lim, Math.min(lim, car.position.x));
  car.position.z = Math.max(-lim, Math.min(lim, car.position.z));

  // hitting something: buildings slow you to nothing
  for (const b of city.buildingBoxes) {
    if (Math.abs(car.position.x - b.x) < b.w / 2 + 1.4 &&
        Math.abs(car.position.z - b.z) < b.d / 2 + 2.2) {
      car.userData.speed = -Math.abs(speed) * 0.24;
      if (Math.abs(speed) > 16) {
        flash('THE PAINT IS NOT YOURS ANYWAY');
        police.setHeat(police.heat + 1);
      }
      break;
    }
  }
  // running down a pedestrian
  for (const p of peds) {
    if (Math.abs(speed) > 6 && p.position.distanceTo(car.position) < 2.6) {
      p.userData.ped.down = 2.6;
      p.userData.ped.x = car.position.x;
      police.setHeat(Math.max(police.heat, HEAT.hard));
      flash('HIT AND RUN');
      break;
    }
  }

  if (once('KeyE') || once('KeyQ')) exitCar();
  hud.rideBar.style.width = Math.max(4, 100 - Math.abs(speed) * 1.1) + '%';
  hud.speed.textContent = Math.round(Math.abs(speed) * 3.6);
  hud.gear.textContent = speed < -0.5 ? 'R' : speed < 0.6 ? 'N' : String(Math.min(6, 1 + Math.floor(Math.abs(speed) / 8)));
}

// --------------------------------------------------------------------- misc ---
function updateTraffic(dt) {
  for (const t of traffic) {
    if (t === state.inCar) continue;
    const tr = t.userData.traffic;
    if (tr.axis === 'x') {
      t.position.x += tr.speed * tr.dir * dt;
      t.rotation.y = tr.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      if (t.position.x > 300) t.position.x = -300;
      if (t.position.x < -300) t.position.x = 300;
    } else {
      t.position.z += tr.speed * tr.dir * dt;
      t.rotation.y = tr.dir > 0 ? 0 : Math.PI;
      if (t.position.z > 300) t.position.z = -300;
      if (t.position.z < -300) t.position.z = 300;
    }
    spinWheels(t, (t.userData.wheelsRoll = (t.userData.wheelsRoll || 0) + tr.speed * dt));
  }
}

function updatePeds(dt) {
  for (const p of peds) {
    const d = p.userData.ped;
    if (d.down > 0) {
      d.down -= dt;
      p.rotation.z = Math.PI / 2 * Math.min(1, (2.6 - d.down) * 3);
      continue;
    }
    p.rotation.z = 0;
    const near = state.inCar ? state.inCar.position.distanceTo(p.position) < 14 : false;
    d.phase += dt * (near ? 7.5 : 2.2);
    if (near) {
      // scatter away from the car
      const away = new T.Vector3().subVectors(p.position, state.inCar.position).setY(0).normalize();
      p.position.addScaledVector(away, dt * 5.2);
      p.rotation.y = Math.atan2(away.x, away.z);
      walkCycle(p, d.phase, 9);
    } else {
      p.position.x += Math.sin(d.dir) * d.speed * dt;
      p.position.z += Math.cos(d.dir) * d.speed * dt;
      if (Math.random() < dt * 0.22) d.dir = Math.random() * 6.28;
      if (Math.abs(p.position.x) > city.SPAN * 0.6) d.dir = -d.dir;
      if (Math.abs(p.position.z) > city.SPAN * 0.6) d.dir = Math.PI - d.dir;
      p.rotation.y = d.dir;
      walkCycle(p, d.phase, d.speed);
    }
  }
}

function updateMissions(dt) {
  if (state.step !== 'play') return;
  if (state.missionLeft > 0) {
    state.missionLeft -= dt;
    const m = Math.max(0, Math.floor(state.missionLeft / 60));
    const s = Math.max(0, Math.floor(state.missionLeft % 60));
    hud.missionTimer.textContent = `${m}:${String(s).padStart(2, '0')}`;
    if (state.missionLeft <= 0) {
      flash('TOO LATE · the boat sailed');
      police.setHeat(police.heat + 1);
      state.missionLeft = 25;
    }
  }
  if (marker.visible) {
    const d = Math.hypot(player.position.x - marker.position.x, player.position.z - marker.position.z);
    if (d < 6.5 && state.missionLeft > 0) completeJob();
  }
  hud.missionTimer.textContent = state.missionLeft > 0
    ? (() => { const m = Math.floor(state.missionLeft / 60), s = Math.floor(state.missionLeft % 60);
      return `${m}:${String(s).padStart(2, '0')}`; })()
    : '--:--';
}

function updateHud(dt) {
  hud.cash.textContent = '$' + state.cash.toLocaleString();
  state.clock += dt * 0.42;
  const mins = Math.floor(state.clock) % 1440;
  hud.clock.textContent = `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
  hud.respect.textContent = `${state.respect} RESPECT`;

  const stars = hud.wantedStars.children;
  const heat = police.heat;
  hud.wantedRack.classList.toggle('live', heat > 0);
  hud.wantedRack.classList.toggle('hunted', police.sighted > 0);
  for (let i = 0; i < stars.length; i++) stars[i].classList.toggle('on', i < heat);

  const rows = police.heat > 0 ? police.dispatch(player.position).slice(0, 5) : [];
  hud.copRadio.style.opacity = rows.length ? 1 : 0;
  hud.copHead.textContent = rows.length;
  hud.copList.replaceChildren(...rows.map(r => {
    const el = document.createElement('div');
    el.className = 'row';
    el.innerHTML = `<b>${r.name}</b><s>${Math.round(r.d)} m</s><u>${r.mode}</u>`;
    return el;
  }));

  if (state.messageT > 0) {
    state.messageT -= dt;
    if (state.messageT <= 0) {
      hud.subtitle.classList.add('hidden');
      hud.toast.classList.add('hidden');
    }
  }
  if (!state.inCar) {
    hud.speed.textContent = Math.round(playerBody.speed * 3.6);
    hud.gear.textContent = playerBody.speed > 5.6 ? 'RUN' : 'WALK';
    hud.rideBar.style.width = Math.round(Math.min(100, playerBody.speed / PLAYER_RUN * 100)) + '%';
  }
  hud.ammo.textContent = '72';
}

// ------------------------------------------------------------------ minimap ---
const mm = hud.minimap.getContext('2d');
let mmT = 0;

function drawMinimap() {
  const W = hud.minimap.width, H = hud.minimap.height;
  const r = W / 2;
  const span = 176;                    // metres across the dial
  const pos = state.inCar ? state.inCar.position : player.position;
  const yaw = state.inCar ? state.inCar.rotation.y : playerBody.facing;
  const cx = pos.x, cz = pos.z;

  mm.save();
  mm.clearRect(0, 0, W, H);
  mm.beginPath(); mm.arc(r, r, r - 2, 0, 6.2832);
  mm.fillStyle = '#0d1218'; mm.fill();
  mm.clip();

  const k = (r - 4) / (span / 2);
  const toPx = (x, z) => {
    const dx = x - cx, dz = z - cz;
    // rotate so the heading is up
    const s = Math.sin(-yaw), c = Math.cos(-yaw);
    return [r + (dx * c - dz * s) * k, r + (dx * s + dz * c) * k];
  };

  // blocks
  mm.fillStyle = 'rgba(255,240,205,.10)';
  const B = CITY.block, N = city.N;
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      const bx = -city.HALF + i * B + B / 2;
      const bz = -city.HALF + j * B + B / 2;
      const [px, py] = toPx(bx - B * 0.38, bz - B * 0.38);
      const [qx, qy] = toPx(bx + B * 0.38, bz + B * 0.38);
      mm.fillRect(Math.min(px, qx), Math.min(py, qy), Math.abs(qx - px), Math.abs(qy - py));
    }
  }
  // sea outside the island ring
  mm.fillStyle = 'rgba(30,110,150,.30)';
  const [ox, oy] = toPx(0, 0);
  mm.beginPath();
  mm.arc(ox, oy, city.SPAN * 0.66 * k, 0, 6.2832);
  mm.lineWidth = 999; mm.strokeStyle = 'rgba(30,110,150,.36)';
  mm.stroke();
  mm.fillStyle = 'rgba(0,0,0,0)';

  // mission spot
  if (marker.visible) {
    const [mx2, my2] = toPx(marker.position.x, marker.position.z);
    mm.fillStyle = '#f2b544';
    mm.beginPath(); mm.arc(mx2, my2, 4.5, 0, 6.2832); mm.fill();
    mm.strokeStyle = 'rgba(242,181,68,.55)'; mm.lineWidth = 2;
    mm.beginPath(); mm.arc(mx2, my2, 8.5, 0, 6.2832); mm.stroke();
  }
  // police on the dial
  for (const u of police.units) {
    if (!u.userData.cop) continue;
    const [ux, uy] = toPx(u.position.x, u.position.z);
    mm.fillStyle = '#ff4438';
    mm.beginPath(); mm.arc(ux, uy, 3, 0, 6.2832); mm.fill();
  }
  // the search radius
  if (police.heat > 0) {
    const [sx, sy] = toPx(police.searchAt.x, police.searchAt.z);
    mm.strokeStyle = 'rgba(255,68,56,.55)';
    mm.setLineDash([4, 4]); mm.lineWidth = 1.6;
    mm.beginPath(); mm.arc(sx, sy, 46, 0, 6.2832); mm.stroke();
    mm.setLineDash([]);
  }
  // the player, as an arrow
  mm.save();
  mm.translate(r, r);
  mm.fillStyle = '#f6efdc';
  mm.beginPath();
  mm.moveTo(0, -7); mm.lineTo(5, 6); mm.lineTo(0, 3); mm.lineTo(-5, 6);
  mm.closePath(); mm.fill();
  mm.restore();

  mm.restore();

  // grade ring
  mm.beginPath(); mm.arc(r, r, r - 1.5, 0, 6.2832);
  mm.strokeStyle = 'rgba(246,239,220,.42)'; mm.lineWidth = 2; mm.stroke();
}

// ------------------------------------------------------------------- saving ---
function saveGame() {
  const data = {
    day: state.day, cash: state.cash, respect: state.respect, jobIndex: state.jobIndex,
    clock: state.clock,
    player: { x: player.position.x, z: player.position.z, facing: playerBody.facing },
  };
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); } catch (e) { /* private mode */ }
  state.saved = data;
  hud.saveDay.textContent = String(state.day);
  flash('WEEK SAVED');
}

function loadGame() {
  let raw = null;
  try { raw = localStorage.getItem(SAVE_KEY); } catch (e) { raw = null; }
  if (!raw) return null;
  try { return JSON.parse(raw); } catch (e) { return null; }
}

// --------------------------------------------------------------------- flow ---
function startPlay(fresh, save) {
  state.step = 'play';
  hud.title.classList.add('hidden');
  hud.root.classList.remove('hidden');
  clearPressed();
  if (fresh) {
    state.cash = 0; state.respect = 0; state.jobIndex = 0; state.clock = 18 * 60 + 40;
    const fresh0 = snapToStreet(SPAWNS.player.x, SPAWNS.player.z);
    player.position.set(fresh0.x, 0, fresh0.z);
    playerBody.facing = Math.PI * 0.5;
    police.clear();
    startJob(0);
  } else if (save) {
    state.cash = save.cash || 0;
    state.respect = save.respect || 0;
    state.jobIndex = save.jobIndex || 0;
    state.clock = save.clock || 18 * 60 + 40;
    const at = snapToStreet(save.player.x, save.player.z);
    player.position.set(at.x, 0, at.z);
    playerBody.facing = save.player.facing;
    police.clear();
    startJob(state.jobIndex);
  }
}

function pauseGame() {
  if (state.step !== 'play') return;
  state.step = 'pause';
  hud.pause.classList.remove('hidden');
}

function resumeGame() {
  state.step = 'play';
  hud.pause.classList.add('hidden');
  clearPressed();
}

hud.title.addEventListener('click', (e) => {
  const item = e.target.closest('.item');
  if (!item) return;
  const act = item.dataset.act;
  if (act === 'play') startPlay(true, null);
  if (act === 'continue') {
    const save = loadGame();
    if (save) startPlay(false, save); else startPlay(true, null);
  }
  if (act === 'controls') flash('WASD move · SHIFT run · E grab a car · M map · F1 save · ESC pause');
});

hud.pause.addEventListener('click', (e) => {
  const item = e.target.closest('.item');
  if (!item) return;
  const act = item.dataset.act;
  if (act === 'resume') resumeGame();
  if (act === 'save') { saveGame(); resumeGame(); }
  if (act === 'quit') {
    state.step = 'title';
    hud.pause.classList.add('hidden');
    hud.title.classList.remove('hidden');
    hud.root.classList.add('hidden');
  }
});

// --------------------------------------------------------------------- loop ---
let last = performance.now();
let acc = 0;

function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;

  if (state.step === 'play') {
    if (state.inCar) updateCar(dt); else updatePlayer(dt);
    const pos = state.inCar ? state.inCar.position : player.position;

    const seen = police.heat > 0 && pos.distanceTo(police.searchAt) < 90;
    police.tick(dt, pos, !!state.inCar, seen);
    police.update(dt, pos, !!state.inCar);

    updateTraffic(dt);
    updatePeds(dt);
    updateMissions(dt);
    updateHud(dt);
    marker.rotation.y += dt * 0.9;
    marker.children[1].material.opacity = 0.07 + Math.sin(now / 420) * 0.04;

    mmT += dt;
    if (mmT > 0.06) { drawMinimap(); mmT = 0; }

    if (once('Escape')) pauseGame();
    if (once('F1')) saveGame();
    if (once('KeyM')) {
      drawBigMap();
      hud.bigmap.classList.toggle('hidden');
    }
  } else if (state.step === 'title') {
    // a slow drift around the city behind the title card
    camState.yaw += dt * 0.045;
  }

  updateCamera(dt);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

// ------------------------------------------------------------------ big map ---
function drawBigMap() {
  const c = hud.mapcanvas.getContext('2d');
  const W = hud.mapcanvas.width, H = hud.mapcanvas.height;
  c.fillStyle = '#0d1218'; c.fillRect(0, 0, W, H);
  const k = W / (city.SPAN * 1.5);
  const toPx = (x, z) => [W / 2 + x * k, H / 2 + z * k];

  c.strokeStyle = 'rgba(30,110,150,.55)'; c.lineWidth = 2;
  c.beginPath(); c.arc(W / 2, H / 2, city.SPAN * 0.66 * k, 0, 6.2832); c.stroke();

  const B = CITY.block, N = city.n || city.N;
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      const bx = -city.HALF + i * B + B / 2;
      const bz = -city.HALF + j * B + B / 2;
      const [px, py] = toPx(bx - B * 0.38, bz - B * 0.38);
      c.fillStyle = 'rgba(255,240,205,.13)';
      c.fillRect(px, py, B * 0.76 * k, B * 0.76 * k);
    }
  }
  c.fillStyle = '#d8d2c4'; c.font = '600 13px "Archivo Narrow", sans-serif';
  for (const p of PLACES) {
    const [px, py] = toPx(p.x, p.z);
    c.fillStyle = 'rgba(242,181,68,.9)';
    c.beginPath(); c.arc(px, py, 4.5, 0, 6.2832); c.fill();
    c.fillStyle = '#f6efdc';
    c.fillText(p.name, px + 8, py + 4);
  }
  if (marker.visible) {
    const [mx2, my2] = toPx(marker.position.x, marker.position.z);
    c.strokeStyle = '#f2b544'; c.lineWidth = 3;
    c.beginPath(); c.arc(mx2, my2, 12, 0, 6.2832); c.stroke();
    c.fillStyle = '#f2b544';
    c.beginPath(); c.arc(mx2, my2, 5, 0, 6.2832); c.fill();
  }
  const pos = state.inCar ? state.inCar.position : player.position;
  const [px, py] = toPx(pos.x, pos.z);
  c.save(); c.translate(px, py);
  c.fillStyle = '#f6efdc';
  c.beginPath(); c.moveTo(0, -9); c.lineTo(6, 7); c.lineTo(0, 4); c.lineTo(-6, 7);
  c.closePath(); c.fill(); c.restore();
}

// ------------------------------------------------------------------- boot ---
const existing = loadGame();
if (existing) hud.saveDay.textContent = String(existing.day || 1);
hud.missionJob.textContent = `JOB 1/${JOBS.length}`;
marker.visible = false;
requestAnimationFrame(frame);

// expose a tiny hook so screenshots can be taken deterministically
window.MALECON = {
  camera, scene, renderer,
  // deterministic framing for screenshots: park the camera anywhere and look at a point
  look: (from, at) => {
    camState.frozen = true;
    camera.position.set(from[0], from[1], from[2]);
    camera.lookAt(at[0], at[1], at[2]);
    camera.updateMatrixWorld();
    renderer.render(scene, camera);
  },
  unfreeze: () => { camState.frozen = false; },
  // heat without spawning: used to shoot the HUD in a calm state
  heat: (n) => police.setHeat(n),

  // Stage a chase: put the player in a moving car with cruisers close behind
  // and the helicopter overhead, so one screenshot carries four systems at once.
  stageChase: () => {
    const car = cars.find(c => !c.userData.traffic) || cars[0];
    car.position.set(26, 0, 30);
    car.rotation.y = 0;
    player.position.set(26, 0, 33);
    enterCar(car);
    car.userData.speed = 26;
    police.clear();
    police.setHeat(4);
    // cruisers behind and beside, not 140 m away
    for (let i = 0; i < 3; i++) {
      const u = police.spawnCop(new T.Vector3(26 + (i - 1) * 7, 0, 30 + 26 + i * 9), 'car');
      u.rotation.y = 0;
      u.userData.v = new T.Vector3(0, 0, 22);
    }
    police.ensureChopper();
    police.chopper.position.set(18, 22, 6);
    camState.yaw = Math.PI; camState.pitch = 0.16; camState.dist = 11;
    return 'chase staged at ' + Math.round(car.position.x) + ',' + Math.round(car.position.z);
  },
  stageFoot: () => {
    if (state.inCar) exitCar();
    police.clear();
    const spot = PLACES[0];
    marker.position.set(spot.x, 0, spot.z);
    marker.visible = true;
    player.position.set(spot.x + 7, 0, spot.z + 8);
    playerBody.facing = Math.atan2(-7, -8);
    camState.yaw = playerBody.facing + Math.PI;
    camState.pitch = 0.14; camState.dist = 9;
    return 'foot staged at ' + spot.name;
  },
  start: () => startPlay(true, null),
  skipTo: (i) => { startPlay(true, null); startJob(i); },
  set: (o) => { Object.assign(state, o); },
  player, police, state, cars, city,
  save: saveGame,
};
