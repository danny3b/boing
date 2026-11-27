// Model bohaterki z prymitywów + proceduralna animacja. Twarz patrzy w +X.
import * as THREE from 'three';
import { toon, outlineMat } from './textures.js';
import { CFG } from './config.js';

const COL = {
  skin: 0xffcfa8, hair: 0x9a5530, dress: 0xff6f86, collar: 0xfff3e0,
  pad: 0x3fa0ff, shoe: 0x7a5cff, sock: 0xffffff, tie: 0x5fe0a0,
  cheek: 0xff8fa0, dark: 0x3a2230, tooth: 0xffffff,
};
const TAU = Math.PI * 2;
const FACE_R = -0.55, FACE_L = -Math.PI + 0.55; // 3/4 do kamery

function mesh(geo, color, ol = [1.1, 1.1, 1.1], mat) {
  const m = new THREE.Mesh(geo, mat || toon(color));
  m.castShadow = true;
  if (ol) {
    const o = new THREE.Mesh(geo, outlineMat);
    o.scale.set(ol[0], ol[1], ol[2]);
    m.add(o);
  }
  return m;
}

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

const lerp = (a, b, k) => a + (b - a) * k;
// zmierzona kulka z pozy fikołka (środek i promień w jednostkach modelu)
const BALL = { cx: 0.33, cy: 0.46, r: 0.46, scale: 0.82 };

export class Character {
  constructor(scene) {
    this.root = new THREE.Group();
    this.spinner = new THREE.Group();
    this.facer = new THREE.Group();
    this.body = new THREE.Group();
    this.root.add(this.spinner);
    this.spinner.add(this.facer);
    this.facer.add(this.body);
    scene.add(this.root);
    this.build();

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
    this.spin = 0; this.spinBase = 0; this.prevState = 'normal'; this.prevSalto = 0;
    this.phase = 0; this.t = 0; this.faceAngle = FACE_R;
    this.squash = 0; this.pig = 0; this.pigV = 0; this.starT = 0; this.carry = 0;
    this.scale = 1; this.pivot = 0.62; this.offX = 0; this.pop = 0; this.drop = 0; this.bob = 0;
    this.pose = { hipL: 0, hipR: 0, hipLx: 0, hipRx: 0, kneeL: 0, kneeR: 0, armL: 0, armR: 0, armLx: 0, armRx: 0, elbowL: 0, elbowR: 0, head: 0, headX: 0, lean: 0, spine: 0 };
    this.root.visible = true;
  }

  build() {
    const b = this.body;
    // nogi (side +1 = bliżej kamery)
    this.legs = {};
    for (const side of [1, -1]) {
      const hip = new THREE.Group(); hip.position.set(0, 0.5, side * 0.085); b.add(hip);
      const thigh = mesh(new THREE.CapsuleGeometry(0.058, 0.16, 4, 8), COL.skin, [1.3, 1.12, 1.3]);
      thigh.position.y = -0.12; hip.add(thigh);
      const knee = new THREE.Group(); knee.position.y = -0.24; hip.add(knee);
      const shin = mesh(new THREE.CapsuleGeometry(0.052, 0.14, 4, 8), COL.skin, [1.3, 1.12, 1.3]);
      shin.position.y = -0.1; knee.add(shin);
      // nakolannik — wiecznie zsunięty na kostkę
      const pad = mesh(new THREE.CylinderGeometry(0.072, 0.078, 0.08, 12), COL.pad, [1.15, 1.15, 1.15]);
      pad.position.set(0.005, -0.165, 0); pad.rotation.z = 0.18; knee.add(pad);
      const shoe = mesh(new THREE.BoxGeometry(0.17, 0.075, 0.11), COL.shoe, [1.12, 1.25, 1.15]);
      shoe.position.set(0.035, -0.235, 0); knee.add(shoe);
      this.legs[side] = { hip, knee };
    }
    // kręgosłup: górna połowa ciała zgina się w biodrach (do zwijania w kulkę)
    this.spine = new THREE.Group(); this.spine.position.y = 0.5; b.add(this.spine);
    const upper = new THREE.Group(); upper.position.y = -0.5; this.spine.add(upper);
    // sukienka
    const dress = mesh(new THREE.CylinderGeometry(0.15, 0.25, 0.42, 16), COL.dress, [1.08, 1.04, 1.08]);
    dress.position.y = 0.66; upper.add(dress);
    const collar = mesh(new THREE.TorusGeometry(0.12, 0.028, 8, 16), COL.collar, null);
    collar.rotation.x = Math.PI / 2; collar.position.y = 0.865; upper.add(collar);
    // kieszonka z cukierkiem
    const pocket = mesh(new THREE.BoxGeometry(0.06, 0.07, 0.02), 0xffe14d, null);
    pocket.position.set(0.05, 0.6, 0.2); pocket.rotation.y = 0.5; upper.add(pocket);

    // ręce
    this.arms = {};
    for (const side of [1, -1]) {
      const sh = new THREE.Group(); sh.position.set(0, 0.83, side * 0.17); upper.add(sh);
      const sleeve = mesh(new THREE.SphereGeometry(0.075, 10, 8), COL.dress, [1.15, 1.15, 1.15]);
      sleeve.position.y = -0.02; sh.add(sleeve);
      const up = mesh(new THREE.CapsuleGeometry(0.042, 0.11, 4, 8), COL.skin, [1.3, 1.1, 1.3]);
      up.position.y = -0.09; sh.add(up);
      const el = new THREE.Group(); el.position.y = -0.17; sh.add(el);
      const fore = mesh(new THREE.CapsuleGeometry(0.038, 0.09, 4, 8), COL.skin, [1.3, 1.1, 1.3]);
      fore.position.y = -0.07; el.add(fore);
      const hand = mesh(new THREE.SphereGeometry(0.052, 10, 8), COL.skin, [1.2, 1.2, 1.2]);
      hand.position.y = -0.155; el.add(hand);
      this.arms[side] = { sh, el };
    }

    // głowa
    const head = this.head = new THREE.Group();
    head.position.set(0.01, 1.0, 0); upper.add(head);
    head.add(mesh(new THREE.SphereGeometry(0.2, 24, 18), COL.skin, [1.06, 1.06, 1.06]));
    const cap = mesh(new THREE.SphereGeometry(0.214, 24, 16, 0, TAU, 0, Math.PI * 0.52), COL.hair, null);
    cap.rotation.z = 0.6; cap.position.y = 0.005; head.add(cap);
    const back = mesh(new THREE.SphereGeometry(0.195, 16, 12), COL.hair, [1.05, 1.05, 1.05]);
    back.position.set(-0.05, 0.02, 0); head.add(back);
    // rozczochrana grzywka
    [-0.11, -0.04, 0.03, 0.1].forEach((z, i) => {
      const bang = mesh(new THREE.SphereGeometry(0.055, 8, 6), COL.hair, null);
      bang.position.set(0.12 + (i % 2) * 0.02, 0.14 - (i % 2) * 0.02, z);
      bang.scale.set(0.7, 1, 1); bang.rotation.z = -0.5 + i * 0.2; head.add(bang);
    });
    // kucyki
    this.pigtails = [];
    for (const side of [1, -1]) {
      const g = new THREE.Group(); g.position.set(-0.06, 0.08, side * 0.17); head.add(g);
      g.add(mesh(new THREE.SphereGeometry(0.04, 8, 6), COL.tie, [1.2, 1.2, 1.2]));
      const tuft = mesh(new THREE.SphereGeometry(0.085, 12, 10), COL.hair, [1.12, 1.12, 1.12]);
      tuft.scale.set(1.5, 0.75, 0.85); tuft.position.set(-0.06, 0.05, side * 0.08); tuft.rotation.z = 0.7;
      tuft.rotation.y = side * 0.5;
      g.add(tuft);
      for (let k = 0; k < 2; k++) {
        const stray = mesh(new THREE.ConeGeometry(0.02, 0.1, 5), COL.hair, null);
        stray.position.set(-0.13 + k * 0.03, 0.1 + k * 0.03, side * (0.1 + k * 0.03));
        stray.rotation.z = 0.6 + k * 0.6; g.add(stray);
      }
      this.pigtails.push({ g, side });
    }
    // twarz
    for (const side of [1, -1]) {
      const eye = mesh(new THREE.SphereGeometry(0.03, 10, 8), COL.dark, null);
      eye.position.set(0.172, 0.035, side * 0.075); eye.scale.set(0.7, 1.15, 1); head.add(eye);
      const hl = mesh(new THREE.SphereGeometry(0.01, 6, 4), 0xffffff, null, new THREE.MeshBasicMaterial({ color: 0xffffff }));
      hl.position.set(0.195, 0.05, side * 0.07); head.add(hl);
      const brow = mesh(new THREE.BoxGeometry(0.012, 0.014, 0.055), COL.hair, null);
      brow.position.set(0.185, 0.1, side * 0.075); brow.rotation.x = side * 0.25; head.add(brow);
      const cheek = mesh(new THREE.SphereGeometry(0.04, 8, 6), COL.cheek, null);
      cheek.position.set(0.158, -0.05, side * 0.12); cheek.scale.set(0.35, 0.6, 1); head.add(cheek);
    }
    const nose = mesh(new THREE.SphereGeometry(0.026, 8, 6), 0xffb48c, null);
    nose.position.set(0.2, -0.01, 0); head.add(nose);
    // uśmiech z dziurą po zębie
    const mg = new THREE.Group(); mg.position.set(0.186, -0.075, 0); mg.rotation.y = Math.PI / 2; head.add(mg);
    const mouth = new THREE.Mesh(new THREE.CircleGeometry(0.055, 16, Math.PI, Math.PI), new THREE.MeshBasicMaterial({ color: 0x7a2030 }));
    mg.add(mouth);
    const toothMat = new THREE.MeshBasicMaterial({ color: COL.tooth });
    for (const x of [-0.038, -0.013, 0.038]) { // brak zęba na +0.013 :)
      const t = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.024, 0.01), toothMat);
      t.position.set(x, -0.012, 0.004); mg.add(t);
    }
  }

  onState(st, prev) {
    if (st === 'cart') this.spinBase = Math.round(this.spin / TAU) * TAU;
    if (st === 'roll') this.pop = -1;                 // wejście w fikołek: zgniecenie
    else if (prev === 'roll') this.pop = 1;           // wyjście: rozciągnięcie
  }

  // p = obiekt Player
  update(dt, p, rx = p.x, ry = p.y) {
    this.t += dt;
    const st = p.state;
    if (st !== this.prevState) { this.onState(st, this.prevState); this.prevState = st; }
    if (p.saltoT > this.prevSalto + 0.01) this.spinBase = Math.round(this.spin / TAU) * TAU;
    this.prevSalto = p.saltoT;

    const T = { hipL: 0, hipR: 0, hipLx: 0, hipRx: 0, kneeL: 0, kneeR: 0, armL: 0.15, armR: 0.15, armLx: -0.15, armRx: 0.15, elbowL: 0.3, elbowR: 0.3, head: 0, headX: 0, lean: 0, spine: 0 };
    const speed = Math.abs(p.vx);
    let scale = 1, pivot = 0.62, offX = 0, drop = 0, bob = 0, k = 18;
    // kulka: plecy zgięte, broda przy piersi, kolana przy klatce, ręce obejmują goleni
    const tuck = () => {
      T.spine = -1.75; T.head = -1.2;
      T.hipL = T.hipR = 2.7; T.kneeL = T.kneeR = -2.75; T.hipLx = -0.08; T.hipRx = 0.08;
      T.armL = T.armR = 0.3; T.elbowL = T.elbowR = 2.1; T.armLx = -0.25; T.armRx = 0.25;
      pivot = BALL.cy; offX = BALL.cx;
    };

    switch (st) {
      case 'normal':
        if (p.onGround) {
          if (p.skid) {
            // poślizg: zaparta, odchylona, macha rękami
            T.hipL = 0.75; T.kneeL = -0.15; T.hipR = -0.25; T.kneeR = -0.7;
            T.armL = 2.3 + Math.sin(this.t * 22) * 0.5; T.armR = 1.7 - Math.sin(this.t * 22) * 0.5;
            T.armLx = -0.6; T.armRx = 0.6; T.elbowL = T.elbowR = 0.3;
            T.lean = 0.32; T.head = -0.15;
            k = 30;
          } else if (speed > 0.3) {
            this.phase += dt * (6 + speed * 1.5);
            const s = Math.sin(this.phase), c = Math.cos(this.phase);
            const A = 0.35 + 0.65 * Math.min(1, speed / 7);
            T.hipL = s * A; T.hipR = -s * A;
            T.kneeL = -(0.2 + 1.1 * Math.max(0, c)) * A * 1.3;
            T.kneeR = -(0.2 + 1.1 * Math.max(0, -c)) * A * 1.3;
            T.armL = -s * A * 1.2; T.armR = s * A * 1.2;
            T.elbowL = T.elbowR = 1.0;
            T.lean = -0.06 - 0.28 * Math.min(1, speed / 10);
            T.head = 0.1 * Math.min(1, speed / 10);
            bob = Math.abs(Math.sin(this.phase)) * 0.06 * A;
            k = 25;
          } else {
            // nie umie stać w miejscu — podskakuje na palcach
            bob = Math.abs(Math.sin(this.t * 7)) * 0.035;
            T.armL = 0.25 + 0.2 * Math.sin(this.t * 7); T.armR = 0.25 - 0.2 * Math.sin(this.t * 7);
            T.elbowL = T.elbowR = 0.7;
            T.head = 0.05 * Math.sin(this.t * 3.5);
          }
        } else if (p.saltoT > 0) {
          tuck(); scale = 0.95; k = 30;
        } else if (p.vy > 0) {
          T.hipL = 0.9; T.kneeL = -1.3; T.hipR = -0.35; T.kneeR = -0.5;
          T.armL = 2.7; T.armR = 2.3; T.elbowL = T.elbowR = 0.2; T.armLx = -0.3; T.armRx = 0.3;
          T.head = 0.15;
        } else {
          T.hipL = 0.4; T.kneeL = -0.6; T.hipR = 0.1; T.kneeR = -0.3;
          T.armL = 1.6; T.armR = 1.3; T.armLx = -0.7; T.armRx = 0.7; T.elbowL = T.elbowR = 0.3;
          T.head = -0.1;
        }
        break;
      case 'roll':
        tuck(); scale = BALL.scale; k = 30;
        break;
      case 'cart':
        // gwiazda: kończyny rozłożone w X
        T.hipLx = -0.75; T.hipRx = 0.75;
        T.armLx = -2.55; T.armRx = 2.55; T.armL = T.armR = 0; T.elbowL = T.elbowR = 0;
        pivot = 0.7; k = 30;
        break;
      case 'stun':
      case 'cry':
      case 'bored':
        drop = 0.42; T.hipL = T.hipR = 1.45; T.kneeL = T.kneeR = -0.15; T.hipLx = -0.2; T.hipRx = 0.2;
        T.lean = 0.12;
        if (st === 'stun') {
          T.armL = 2.9; T.elbowL = 1.6; T.armLx = -0.2; T.armR = 0.5; T.elbowR = 0.3;
          T.head = Math.sin(this.t * 5) * 0.12; T.headX = Math.sin(this.t * 3) * 0.15;
        } else if (st === 'cry') {
          T.armL = T.armR = 2.3; T.elbowL = T.elbowR = 2.1; T.armLx = 0.25; T.armRx = -0.25;
          T.head = -0.25; T.headX = Math.sin(this.t * 14) * 0.06;
          bob = Math.abs(Math.sin(this.t * 9)) * 0.02;
        } else {
          T.armL = T.armR = 0.4; T.lean = 0.3; T.head = -0.35; T.headX = 0.3;
        }
        break;
      case 'won':
        bob = Math.abs(Math.sin(this.t * 9)) * 0.25;
        T.armL = T.armR = 2.9; T.armLx = -0.5; T.armRx = 0.5; T.hipL = 0.3; T.kneeL = -0.6;
        T.head = 0.25;
        break;
    }
    if (this.carry > 0) {
      drop = 0; T.hipL = 0.2 * Math.sin(this.t * 8); T.hipR = -0.2 * Math.sin(this.t * 8);
      T.kneeL = T.kneeR = -0.3; T.armL = T.armR = 0.3; T.lean = 0;
    }

    const kk = 1 - Math.exp(-k * dt);
    for (const key in T) this.pose[key] = lerp(this.pose[key], T[key], kk);
    const P = this.pose;
    this.legs[1].hip.rotation.set(P.hipLx, 0, P.hipL);
    this.legs[-1].hip.rotation.set(P.hipRx, 0, P.hipR);
    this.legs[1].knee.rotation.z = P.kneeL;
    this.legs[-1].knee.rotation.z = P.kneeR;
    this.arms[1].sh.rotation.set(P.armLx, 0, P.armL);
    this.arms[-1].sh.rotation.set(P.armRx, 0, P.armR);
    this.arms[1].el.rotation.z = P.elbowL;
    this.arms[-1].el.rotation.z = P.elbowR;
    this.head.rotation.set(P.headX, 0, P.head);
    this.spine.rotation.z = P.spine;
    this.body.rotation.z = P.lean;

    // obroty całego ciała
    if (st === 'roll') {
      this.spin += -p.facing * (Math.max(speed, 3) / (BALL.r * BALL.scale)) * dt; // toczy się bez poślizgu
    } else if (st === 'cart') {
      const prog = 1 - Math.max(0, p.cartT) / CFG.cartTime;
      this.spin = this.spinBase - p.facing * TAU * prog;
    } else if (st === 'normal' && p.saltoT > 0) {
      const prog = 1 - p.saltoT / CFG.saltoTime;
      const e = prog < 0.5 ? 2 * prog * prog : 1 - Math.pow(-2 * prog + 2, 2) / 2;
      this.spin = this.spinBase - p.facing * TAU * e;
    } else {
      const target = Math.round(this.spin / TAU) * TAU;
      this.spin = lerp(this.spin, target, 1 - Math.exp(-14 * dt));
    }
    this.spinner.rotation.z = this.spin;

    const ks = 1 - Math.exp(-20 * dt);
    this.scale = lerp(this.scale, scale, ks);
    this.pivot = lerp(this.pivot, pivot, ks);
    this.drop = lerp(this.drop, drop, 1 - Math.exp(-12 * dt));
    this.bob = lerp(this.bob, bob, 1 - Math.exp(-30 * dt));

    // zgniecenie po lądowaniu
    if (p.landSquash > this.squash) this.squash = p.landSquash;
    p.landSquash = 0;
    this.squash = Math.max(0, this.squash - dt * 5);
    const sq = this.squash * 0.25 - this.pop * 0.22;
    this.pop *= Math.exp(-11 * dt);
    this.offX = lerp(this.offX, offX, ks);

    this.spinner.position.y = this.pivot * this.scale;
    this.spinner.scale.set(this.scale * (1 + sq * 0.5), this.scale * (1 - sq), this.scale * (1 + sq * 0.5));
    // środek kulki leży przed biodrami — przesuwamy model, żeby kręcił się wokół niego
    this.facer.position.set(-this.offX * Math.cos(this.faceAngle), -this.pivot, this.offX * Math.sin(this.faceAngle));
    this.body.position.y = -this.drop + this.bob;

    const target = p.facing > 0 ? FACE_R : FACE_L;
    this.faceAngle = lerp(this.faceAngle, target, 1 - Math.exp(-14 * dt));
    this.facer.rotation.y = this.faceAngle;

    this.root.position.set(rx, ry + this.carry, 0);

    // kucyki na sprężynce
    const force = -p.vy * 0.04 + (st === 'normal' && p.onGround ? Math.sin(this.phase * 2) * speed * 0.03 : 0);
    this.pigV += (force - this.pig) * 120 * dt - this.pigV * 8 * dt;
    this.pig += this.pigV * dt;
    for (const { g, side } of this.pigtails) {
      g.rotation.z = THREE.MathUtils.clamp(this.pig, -0.9, 0.9);
      g.rotation.x = side * (0.2 + Math.abs(this.pig) * 0.4);
    }

    // gwiazdki nad głową
    this.starT = Math.max(0, this.starT - dt);
    const showStars = st === 'stun' || this.starT > 0;
    this.stars.visible = showStars;
    if (showStars) {
      this.stars.position.set(0, (st === 'stun' ? 0.95 : 1.32), 0);
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
    return v.set(this.root.position.x, this.root.position.y + (this.drop > 0.2 ? 0.85 : 1.35) * this.scale, 0);
  }
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
