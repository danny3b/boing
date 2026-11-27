// Ilustrowana bohaterka w przestrzeni planszy 3D.
import * as THREE from 'three';
import { toon, outlineMat } from './textures.js';
import { CFG } from './config.js';
import { DomiArt, FOOT_OFFSET } from './character-art.js';

const TAU = Math.PI * 2;
const RUN = ['runA', 'runB', 'runC', 'runD', 'runE', 'runF'];
const CART = [
  { time: 0, pose: 'star' }, { time: 0.20, pose: 'cartEntry' },
  { time: 0.50, pose: 'handstand' }, { time: 0.80, pose: 'cartExit' }, { time: 1, pose: 'star' },
];

function starGeometry() {
  const s = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? 0.04 : 0.095, a = (i / 10) * TAU + Math.PI / 2;
    i ? s.lineTo(Math.cos(a) * r, Math.sin(a) * r) : s.moveTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.03, bevelEnabled: false });
  g.center();
  return g;
}

export class Character {
  constructor(scene) {
    this.root = new THREE.Group();
    this.facer = new THREE.Group();
    this.art = new DomiArt();
    this.facer.add(this.art);
    this.root.add(this.facer);
    scene.add(this.root);
    this.stars = new THREE.Group();
    const sg = starGeometry();
    const sm = new THREE.MeshBasicMaterial({ color: 0xffe14d });
    for (let i = 0; i < 5; i++) {
      const s = new THREE.Mesh(sg, sm);
      const o = new THREE.Mesh(sg, outlineMat); o.scale.setScalar(1.25); s.add(o);
      this.stars.add(s);
    }
    this.stars.visible = false;
    this.root.add(this.stars);
    this.reset();
  }

  reset() {
    this.t = 0;
    this.phase = 0;
    this.rollAngle = 0;
    this.squash = 0;
    this.hairDy = 0;
    this.starT = 0;
    this.carry = 0;
    this.prevState = 'normal';
    this.root.visible = true;
    this.stars.visible = false;
    this.facer.scale.x = 1;
    this.art.setPose('idle');
    this.art.rotation.z = 0;
    this.art.scale.set(1, 1, 1);
    this.art.position.set(0, FOOT_OFFSET, 0);
    this.art.swayHair(0, 0);
  }

  update(dt, p, rx = p.x, ry = p.y) {
    this.t += dt;
    const st = p.state, speed = Math.abs(p.vx);
    this.root.position.set(rx, ry + this.carry, 0);
    this.facer.scale.x = p.facing;

    let pose = 'idle', angle = 0, scale = 1, stretch = 0, lift = 0;
    let hair = 0.012 * Math.sin(this.t * 4);
    if (this.carry > 0) {
      pose = 'carried';
      angle = 0.045 * Math.sin(this.t * 6);
    } else if (st === 'roll') {
      if (this.prevState !== 'roll') this.rollAngle = 0;
      this.rollAngle = (this.rollAngle - dt * Math.max(speed, 3) / 0.32) % TAU;
      pose = 'tuck'; angle = this.rollAngle; scale = 0.50;
    } else if (st === 'cart') {
      const progress = THREE.MathUtils.clamp(1 - p.cartT / CFG.cartTime, 0, 1);
      const key = CART.reduce((best, k) => Math.abs(k.time - progress) < Math.abs(best.time - progress) ? k : best);
      pose = key.pose;
      angle = (key.time - progress) * TAU;
    } else if (st === 'stun' || st === 'cry' || st === 'bored') {
      pose = st;
      if (st === 'stun') angle = 0.024 * Math.sin(this.t * 6);
      stretch = st === 'cry' ? 0.021 * Math.sin(this.t * 15) : 0.006 * Math.sin(this.t * 4);
    } else if (st === 'won') {
      pose = 'won';
      lift = Math.abs(Math.sin(this.t * 5)) * 0.17;
      hair = 0.035 * Math.cos(this.t * 10);
    } else if (!p.onGround) {
      if (p.saltoT > 0) {
        const progress = THREE.MathUtils.clamp(1 - p.saltoT / CFG.saltoTime, 0, 1);
        pose = 'tuck'; angle = -TAU * THREE.MathUtils.smoothstep(progress, 0, 1); scale = 0.71;
      } else {
        pose = p.vy > 0 ? 'rise' : 'fall';
        hair = THREE.MathUtils.clamp(-p.vy * 0.007, -0.06, 0.065);
      }
    } else if (p.skid) {
      pose = 'skid';
      hair = -0.05;
    } else if (speed > 0.30) {
      // Jeden cykl = sześć rysunków, ze zmianą nogi podporowej w połowie.
      this.phase = (this.phase + dt * Math.min(21, 4.5 + speed * 1.7)) % RUN.length;
      pose = RUN[Math.floor(this.phase)];
      const step = this.phase * TAU / 3;
      lift = Math.max(0, -Math.sin(step)) * 0.045;
      hair = 0.035 * Math.cos(step);
    } else {
      this.phase = 0;
      pose = this.t % 3.7 > 3.56 ? 'blink' : 'idle';
      stretch = 0.008 * Math.sin(this.t * 4);
    }
    this.prevState = st;
    this.art.setPose(pose);
    this.squash = Math.max(this.squash - 4.6 * dt, p.landSquash, 0);
    p.landSquash = 0;
    const squash = this.squash * 0.13 - stretch;
    const sx = scale * (1 + squash * 0.6), sy = scale * (1 - squash);
    this.art.scale.set(sx, sy, 1);
    this.art.rotation.z = angle;
    let offset = FOOT_OFFSET * sy;
    if (p.onGround || this.carry > 0) {
      offset = this.art.groundOffset(angle, sx, sy);
    } else if (st === 'roll') {
      offset = 0.32;
    } else if (pose === 'tuck' || st === 'cart') {
      offset = 0.62;
    }
    this.art.position.y = offset + lift;
    this.hairDy = THREE.MathUtils.damp(this.hairDy, hair, 18, dt);
    this.art.swayHair(-Math.abs(this.hairDy) * 0.30, this.hairDy);

    // gwiazdki nad głową
    this.starT = Math.max(0, this.starT - dt);
    const showStars = st === 'stun' || this.starT > 0;
    this.stars.visible = showStars;
    if (showStars) {
      this.stars.position.set(0, (st === 'stun' ? 1.02 : 1.42), 0);
      this.stars.children.forEach((s, i) => {
        const a = this.t * 4 + (i / 5) * TAU;
        s.position.set(Math.cos(a) * 0.32, Math.sin(a * 2) * 0.03, Math.sin(a) * 0.32);
        s.rotation.z = this.t * 6;
      });
    }

    // mruganie przy nietykalności
    const blink = p.invuln > 0 && st !== 'stun' && !p.failKind && Math.floor(this.t * 14) % 2 === 0;
    this.root.visible = !blink;
  }

  headWorld(v) {
    return this.art.localToWorld(v.copy(this.art.eye));
  }
}

function mesh(geo, color, ol) {
  const m = new THREE.Mesh(geo, toon(color));
  m.castShadow = true;
  if (ol) {
    const o = new THREE.Mesh(geo, outlineMat);
    o.scale.set(ol[0], ol[1], ol[2]);
    m.add(o);
  }
  return m;
}

// Ręka Mamy, która zabiera bohaterkę z planszy.
export class MomHand {
  constructor(scene) {
    this.g = new THREE.Group();
    const skin = 0xffc9a0;
    const sleeve = mesh(new THREE.CylinderGeometry(0.34, 0.3, 9, 16), 0xb59ae6, [1.05, 1, 1.05]);
    sleeve.position.y = 4.9; this.g.add(sleeve);
    const cuff = mesh(new THREE.TorusGeometry(0.33, 0.07, 8, 20), 0xffffff, null);
    cuff.rotation.x = Math.PI / 2; cuff.position.y = 0.45; this.g.add(cuff);
    const palm = mesh(new THREE.SphereGeometry(0.42, 16, 12), skin, [1.06, 1.06, 1.06]);
    palm.scale.set(1.1, 0.75, 0.55); palm.position.y = 0.05; this.g.add(palm);
    const wrist = mesh(new THREE.CylinderGeometry(0.26, 0.3, 0.5, 12), skin, null);
    wrist.position.y = 0.4; this.g.add(wrist);
    this.fingers = [];
    [-0.27, -0.09, 0.09, 0.27].forEach((x, i) => {
      const fg = new THREE.Group(); fg.position.set(x, -0.2, 0); this.g.add(fg);
      const len = i === 0 || i === 3 ? 0.36 : 0.44;
      const f = mesh(new THREE.CapsuleGeometry(0.075, len, 4, 8), skin, [1.2, 1.08, 1.2]);
      f.position.y = -len / 2 - 0.05; fg.add(f);
      this.fingers.push(fg);
    });
    const tg = new THREE.Group(); tg.position.set(-0.4, 0.05, 0.1); tg.rotation.z = -0.8; this.g.add(tg);
    const th = mesh(new THREE.CapsuleGeometry(0.08, 0.3, 4, 8), skin, [1.2, 1.08, 1.2]);
    th.position.y = -0.2; tg.add(th);
    this.g.visible = false;
    scene.add(this.g);
  }
  curl(a) { this.fingers.forEach((f) => (f.rotation.x = a)); }
}
