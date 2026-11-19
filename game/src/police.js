// The wanted level and the police that answer it: cruisers that drive at you,
// a helicopter with a searchlight, and patrols on foot. Heat decays when you
// break line of sight, so the chase has a beginning, a middle and an end.

const T = window.THREE;

export const HEAT = { calm: 0, seen: 1, chase: 2, hard: 3, manhunt: 4 };

export class Police {
  constructor(scene, city, makeCar, makePerson) {
    this.scene = scene;
    this.city = city;
    this.makeCar = makeCar;
    this.makePerson = makePerson;
    this.units = [];
    this.heat = 0;
    this.sighted = 0;
    this.searchAt = new T.Vector3();
    this.chopper = null;
    this.lightBarPhase = 0;
  }

  setHeat(n) {
    const before = this.heat;
    this.heat = Math.max(0, Math.min(5, n));
    if (this.heat > before) this.sighted = 6;
  }

  spawnCop(pos, kind = 'car') {
    if (kind === 'car') {
      const g = this.makeCar(0, 'cop', true);
      g.position.copy(pos);
      g.rotation.y = Math.random() * Math.PI * 2;
      g.userData.cop = true;
      g.userData.v = new T.Vector3();
      g.userData.orders = 'chase';
      this.scene.add(g);
      this.units.push(g);
      return g;
    }
    const p = this.makePerson(1, true);
    p.position.copy(pos);
    p.position.y = 0;
    p.userData.cop = true;
    p.userData.orders = 'foot';
    p.userData.phase = Math.random() * 6.28;
    this.scene.add(p);
    this.units.push(p);
    return p;
  }

  ensureChopper() {
    if (this.chopper) return this.chopper;
    const g = new T.Group();
    const hull = new T.Mesh(new T.BoxGeometry(3.4, 1.5, 5.2),
      new T.MeshLambertMaterial({ color: 0x141a26 }));
    g.add(hull);
    const canopy = new T.Mesh(new T.SphereGeometry(1.15, 10, 8),
      new T.MeshPhongMaterial({ color: 0x2b3340, shininess: 120, specular: 0xffffff }));
    canopy.position.set(0, 0.55, -1.9);
    g.add(canopy);
    const tail = new T.Mesh(new T.BoxGeometry(0.5, 0.5, 4.2),
      new T.MeshLambertMaterial({ color: 0x141a26 }));
    tail.position.set(0, 0.2, 4.2);
    g.add(tail);
    const rotor = new T.Mesh(new T.BoxGeometry(11, 0.09, 0.5),
      new T.MeshLambertMaterial({ color: 0x2b2b30 }));
    rotor.position.y = 1.2;
    g.add(rotor);
    const beam = new T.Mesh(new T.ConeGeometry(6.5, 26, 16, 1, true),
      new T.MeshBasicMaterial({ color: 0xfff3c8, transparent: true, opacity: 0.13, side: T.DoubleSide }));
    beam.position.y = -13;
    g.add(beam);
    const lamp = new T.Mesh(new T.SphereGeometry(0.4, 8, 6),
      new T.MeshBasicMaterial({ color: 0xfff3c8 }));
    lamp.position.y = -0.4;
    g.add(lamp);
    g.userData.rotor = rotor;
    g.position.set(0, 44, 0);
    this.scene.add(g);
    this.chopper = g;
    return g;
  }

  // Heat rises from what the player does in the open; falls when nothing sees them.
  tick(dt, playerPos, playerInCar, hunterVisible) {
    if (this.sighted > 0) this.sighted -= dt;
    if (hunterVisible) {
      this.searchAt.copy(playerPos);
      if (this.heat === 0) this.setHeat(HEAT.seen);
      if (this.sighted <= 0 && this.heat > HEAT.seen) this.setHeat(this.heat - 1);
    } else if (this.heat > 0) {
      if (this.heat >= HEAT.chase) {
        // they lose the trail slowly instead of instantly
        this.sighted -= dt * 0.5;
        if (this.sighted < -6) this.setHeat(this.heat - 1);
      } else if (this.sighted < -10) this.setHeat(0);
    }

    const wantCars = [0, 1, 2, 3, 4, 5][this.heat] || 0;
    const cars = this.units.filter(u => u.userData.cop && u.userData.spec).length;
    if (cars < wantCars) {
      const a = Math.random() * Math.PI * 2;
      const at = new T.Vector3(playerPos.x + Math.cos(a) * 150, 0, playerPos.z + Math.sin(a) * 150);
      this.spawnCop(at, 'car');
    }
    if (this.heat >= HEAT.hard && !this.chopper) this.ensureChopper();
    if (this.heat < HEAT.chase && this.chopper) {
      this.scene.remove(this.chopper);
      this.chopper = null;
    }
  }

  // Drive each cruiser at the player, crude but readable steering.
  update(dt, playerPos, playerInCar) {
    this.lightBarPhase += dt * 9;
    for (const u of this.units) {
      if (u.userData.cop && u.userData.spec) {
        const to = new T.Vector3().subVectors(playerPos, u.position);
        to.y = 0;
        const dist = to.length();
        const want = Math.atan2(to.x, to.z);
        let d = want - u.rotation.y;
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        const turnRate = 1.9;
        u.rotation.y += Math.max(-turnRate * dt, Math.min(turnRate * dt, d));

        const top = u.userData.spec.top;
        const speed = dist > 26 ? top * 0.62 : dist > 10 ? top * 0.4 : top * 0.16;
        const v = u.userData.v;
        v.set(Math.sin(u.rotation.y) * speed, 0, Math.cos(u.rotation.y) * speed);
        u.position.addScaledVector(v, dt);
        u.position.y = 0;

        if (!playerInCar && dist < 2.6) {
          // a cruiser stops a runner: the old-fashioned way
          u.userData.orders = 'bust';
        }
        if (u.userData.lightBar) {
          const on = Math.sin(this.lightBarPhase) > 0;
          u.userData.lightBar.children[0].material.color.setHex(on ? 0xff2a2a : 0x331518);
          u.userData.lightBar.children[1].material.color.setHex(on ? 0x161833 : 0x2a6cff);
        }
      } else if (u.userData.cop) {
        // foot patrol: walk toward the player, arms swinging
        const to = new T.Vector3().subVectors(playerPos, u.position);
        to.y = 0;
        const dist = to.length();
        if (dist > 1.4 && dist < 60) {
          to.normalize();
          u.position.addScaledVector(to, dt * 4.1);
          u.rotation.y = Math.atan2(to.x, to.z);
          u.userData.phase = (u.userData.phase || 0) + dt * 11;
          const s = Math.sin(u.userData.phase || 0);
          const L = u.userData.limbs;
          if (L) {
            L.lLeg.position.z = s * 0.22;
            L.rLeg.position.z = -s * 0.22;
            L.lArm.position.z = -s * 0.2;
            L.rArm.position.z = s * 0.2;
          }
        }
      }
    }

    if (this.chopper) {
      const c = this.chopper;
      const target = new T.Vector3(playerPos.x, 40 + Math.sin(performance.now() / 2200) * 4, playerPos.z);
      c.position.lerp(target, Math.min(1, dt * 0.62));
      c.rotation.y = Math.atan2(playerPos.x - c.position.x, playerPos.z - c.position.z);
      if (c.userData.rotor) c.userData.rotor.rotation.y += dt * 26;
    }
  }

  clear() {
    for (const u of this.units) this.scene.remove(u);
    this.units.length = 0;
    if (this.chopper) { this.scene.remove(this.chopper); this.chopper = null; }
    this.heat = 0;
    this.sighted = 0;
  }

  // What the HUD lists as the response: nearest units, with a mode each.
  dispatch(playerPos) {
    const rows = [];
    for (const u of this.units) {
      if (!u.userData.cop) continue;
      const d = u.position.distanceTo(playerPos);
      const car = !!u.userData.spec;
      const mode = car ? (d < 12 ? 'RAMMING' : d < 40 ? 'PURSUIT' : 'EN ROUTE') : (d < 6 ? 'ON FOOT' : 'SWEEP');
      rows.push({ name: car ? 'PELICAN-' + (10 + (rows.length * 7) % 80) : 'OFFICER-' + (20 + rows.length), d, mode });
    }
    if (this.chopper) {
      rows.push({ name: 'AIR-1', d: this.chopper.position.distanceTo(playerPos), mode: 'SPOTLIGHT' });
    }
    rows.sort((a, b) => a.d - b.d);
    return rows;
  }
}
