// Bohaterka jako model 3D (Meshy + szkielet, animacja chodu).
// Bieg = klip chodu przyspieszony do prędkości. Pozostałe pozy ustawiamy proceduralnie,
// kierując kości w zadanych kierunkach (przestrzeń modelu: +Z przód, +Y góra, +X lewa strona).
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { toon } from './textures.js';
import { CFG } from './config.js';

const TAU = Math.PI * 2;
const HEIGHT = 1.36;                 // wysokość postaci w świecie (hitbox stojący = 1.3)
const FACE_R = 0.85, FACE_L = -0.85;   // obrót wokół Y: przodem w bok i trochę do kamery
const OUTLINE_CM = 1.1;              // grubość konturu w jednostkach modelu (cm)
// kolor postaci: tekstura z Meshy w jasnym świetle salonu wychodzi blada (CFG.charSaturation/charBrightness)
const LOOK_UNIFORMS = { uSat: { value: 1 }, uBright: { value: 1 } };
const BALL_R = 0.34;                 // promień kulki (fikołek) w świecie przy skali 1

const gltf = await new GLTFLoader().loadAsync(new URL('./art/girl.glb', import.meta.url).href);

// ---------- pozy (kierunki kości lewej strony; prawa = lustro po X) ----------
const v = (x, y, z) => new THREE.Vector3(x, y, z).normalize();
const BASE = {
  low: v(0, 1, 0.03), mid: v(0, 1, 0.03), top: v(0, 1, 0.03), neck: v(0, 1, 0.08), head: v(0.05, 1, 0.14),
  arm: v(0.28, -0.96, 0.05), fore: v(0.12, -0.97, 0.2),
  thigh: v(0.06, -1, 0.02), shin: v(0.02, -1, -0.03),
};
const pose = (o) => ({ ...BASE, ...Object.fromEntries(Object.entries(o).map(([k, a]) => [k, v(...a)])) });
const POSES = {
  idle: pose({}),
  rise: pose({ low: [0, 1, 0.12], arm: [0.45, 0.85, 0.25], fore: [0.3, 0.9, 0.3], thigh: [0.05, -0.35, 0.95], shin: [0.02, -0.95, -0.3], thighR: [-0.06, -0.95, -0.25], shinR: [-0.02, -0.8, -0.6] }),
  fall: pose({ arm: [0.9, 0.35, 0.1], fore: [0.95, 0.15, 0.25], thigh: [0.12, -0.85, 0.5], shin: [0.05, -0.95, -0.2], thighR: [-0.12, -0.95, 0.15] }),
  tuck: pose({ low: [0, 0.75, 0.65], mid: [0, 0.3, 0.95], top: [0, -0.2, 1], neck: [0, -0.55, 0.85], head: [0, -0.8, 0.6], thigh: [0.14, 0.55, 0.83], shin: [0.06, -0.85, -0.5], arm: [0.25, -0.35, 0.9], fore: [0.05, -0.95, 0.2] }),
  star: pose({ arm: [0.75, 0.65, 0], fore: [0.75, 0.65, 0], thigh: [0.55, -0.83, 0], shin: [0.55, -0.83, 0], head: [0, 1, 0] }),
  skid: pose({ low: [0, 0.8, -0.6], mid: [0, 0.9, -0.4], top: [0, 1, -0.2], head: [0, 1, -0.15], arm: [0.6, 0.75, 0.3], fore: [0.7, 0.6, 0.3], thigh: [0.08, -0.75, 0.65], shin: [0.05, -0.9, 0.45], thighR: [-0.08, -0.95, -0.15], shinR: [-0.03, -0.85, -0.5] }),
  stun: pose({ low: [0, 1, -0.1], thigh: [0.15, 0.05, 1], shin: [0.1, -0.15, 1], arm: [0.2, -0.9, 0.3], fore: [0.1, -0.9, 0.4], armR: [-0.5, 0.6, 0.6], foreR: [0.5, 0.75, -0.2], head: [0.15, 1, 0.1] }),
  cry: pose({ low: [0, 1, 0.25], head: [0, 0.9, 0.45], thigh: [0.15, 0.05, 1], shin: [0.1, -0.15, 1], arm: [0.25, -0.2, 0.95], fore: [-0.45, 0.85, 0.2] }),
  bored: pose({ low: [0, 0.9, 0.45], neck: [0, 0.85, 0.5], head: [0, 0.6, 0.8], thigh: [0.15, 0.05, 1], shin: [0.1, -0.15, 1], arm: [0.15, -0.9, 0.4], fore: [0.05, -0.6, 0.8] }),
  won: pose({ arm: [0.3, 0.95, 0.05], fore: [0.3, 0.95, 0.05], head: [0, 1, 0.3] }),
  carried: pose({ arm: [0.35, -0.9, 0.2], fore: [0.2, -0.9, 0.3], thigh: [0.05, -1, 0.15], shin: [0.02, -1, 0.1] }),
};

// klucz pozy → kość (L/R)
const SLOTS = [
  ['low', 'Spine02'], ['mid', 'Spine01'], ['top', 'Spine'], ['neck', 'neck'], ['head', 'Head'],
  ['arm', 'LeftArm', 'RightArm'], ['fore', 'LeftForeArm', 'RightForeArm'],
  ['thigh', 'LeftUpLeg', 'RightUpLeg'], ['shin', 'LeftLeg', 'RightLeg'],
];
const AIM_CHILD = {
  Spine02: 'Spine01', Spine01: 'Spine', Spine: 'neck', neck: 'Head', Head: 'head_end',
  LeftArm: 'LeftForeArm', LeftForeArm: 'LeftHand', RightArm: 'RightForeArm', RightForeArm: 'RightHand',
  LeftUpLeg: 'LeftLeg', LeftLeg: 'LeftFoot', RightUpLeg: 'RightLeg', RightLeg: 'RightFoot',
};

// toon z podbitym nasyceniem i lekko przyciemniony (uniformy można zmieniać na żywo)
function vividToon(map) {
  const m = toon(0xffffff, map);
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, LOOK_UNIFORMS);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uSat;\nuniform float uBright;')
      .replace('#include <map_fragment>', `#include <map_fragment>
  {
    float l = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));
    diffuseColor.rgb = max(mix(vec3(l), diffuseColor.rgb, uSat), 0.0) * uBright;
  }`);
  };
  return m;
}

function skinnedOutline() {
  const m = new THREE.MeshBasicMaterial({ color: 0x3d2c3a, side: THREE.BackSide });
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>',
      `#include <begin_vertex>\n  transformed += normalize(normal) * ${OUTLINE_CM.toFixed(2)};`);
  };
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

// które fragmenty klipów Mixamo grają w których stanach (ułamki długości klipu)
const CLIP = {
  roll: [0.14, 0.85], rollLoop: [0.3, 0.72], rollScale: 0.9,
  cart: [0.28, 0.72],
  flip: [0.35, 0.8],
  rise: [0.3, 0.43], fall: [0.45, 0.6],
};
const LOW_PTS = [['LeftToeBase', 0.03], ['RightToeBase', 0.03], ['LeftFoot', 0.05], ['RightFoot', 0.05], ['Hips', 0.12],
  ['Spine01', 0.13], ['Spine', 0.13], ['Head', 0.2], ['head_end', 0.08], ['LeftHand', 0.04], ['RightHand', 0.04],
  ['LeftLeg', 0.06], ['RightLeg', 0.06]];
const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _q3 = new THREE.Quaternion();
const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _m = new THREE.Matrix4();
const lerp = (a, b, k) => a + (b - a) * k;

export class Character {
  constructor(scene) {
    this.root = new THREE.Group();
    this.spinner = new THREE.Group();
    this.facer = new THREE.Group();
    this.inner = new THREE.Group();
    this.root.add(this.spinner);
    this.spinner.add(this.facer);
    this.facer.add(this.inner);
    scene.add(this.root);

    // model
    this.model = gltf.scene;
    const box = new THREE.Box3().setFromObject(this.model);
    this.s = HEIGHT / (box.max.y - Math.max(0, box.min.y));
    this.model.scale.setScalar(this.s);
    this.inner.add(this.model);
    this.model.traverse((o) => {
      if (!o.isMesh) return;
      const map = o.material.map;
      o.material = vividToon(map);
      o.castShadow = true;
      o.frustumCulled = false;
      const ol = new THREE.SkinnedMesh(o.geometry, skinnedOutline());
      ol.bind(o.skeleton, o.bindMatrix);
      ol.frustumCulled = false;
      o.parent.add(ol);
    });
    this.bones = {};
    this.model.traverse((o) => { if (o.isBone) this.bones[o.name] = o; });
    this.childDir = {};
    for (const [b, c] of Object.entries(AIM_CHILD)) this.childDir[b] = this.bones[c].position.clone().normalize();

    // klipy z konwertera (tools/convert-model.html): walk, run, jump, fall, roll, cartwheel,
    // flip, idle, stun, cry, bored, win, skid. Brakujące zastępują pozy z kości.
    this.mixer = new THREE.AnimationMixer(this.model);
    this.actions = {};
    this.weights = {};
    for (const src of gltf.animations) {
      const clip = src.clone();
      for (const t of clip.tracks) {
        if (/^(Hips|Armature)\.position$/.test(t.name)) { // bez przesuwania się (in place)
          const vals = t.values;
          for (let i = 3; i < vals.length; i += 3) { vals[i] = vals[0]; vals[i + 2] = vals[2]; }
        }
      }
      const a = this.mixer.clipAction(clip);
      a.play();
      a.setEffectiveWeight(0);
      this.actions[clip.name] = a;
      this.weights[clip.name] = 0;
    }
    this.role = null;

    // aktualne (wygładzone) kierunki kości
    this.dirs = {};
    for (const [key, l, r] of SLOTS) {
      this.dirs[l] = BASE[key].clone();
      if (r) this.dirs[r] = BASE[key].clone().multiply(_v.set(-1, 1, 1));
    }

    this.stars = new THREE.Group();
    const sg = starGeometry(), sm = new THREE.MeshBasicMaterial({ color: 0xffe14d });
    const om = new THREE.MeshBasicMaterial({ color: 0x3d2c3a, side: THREE.BackSide });
    for (let i = 0; i < 5; i++) {
      const st = new THREE.Mesh(sg, sm);
      const o = new THREE.Mesh(sg, om); o.scale.setScalar(1.25); st.add(o);
      this.stars.add(st);
    }
    this.root.add(this.stars);
    this.reset();

    // spoczynkowa wysokość stóp (do stawiania stóp na podłodze)
    this.applyPose(POSES.idle, 1, true);
    this.root.updateMatrixWorld(true);
    const rest = this.measure();
    // wysokość najniższej kości stopy nad podeszwą (podeszwa = dół siatki)
    this.footRest = rest.foot - Math.max(0, box.min.y) * this.s;
    this.hipsRest = rest.hips;
  }

  reset() {
    this.t = 0; this.spin = 0; this.spinBase = 0; this.prevState = 'normal'; this.prevSalto = 0;
    this.faceAngle = FACE_R; this.procW = 1; this.squash = 0; this.starT = 0; this.carry = 0;
    this.scale = 1; this.pivotY = 0; this.mode = 'feet';
    this.inner.position.set(0, 0, 0);
    this.root.visible = true; this.stars.visible = false;
  }

  // kość w przestrzeni modelu (gltf.scene)
  modelQuat(bone, out) {
    out.identity();
    for (let o = bone; o && o !== this.model; o = o.parent) out.premultiply(o.quaternion);
    return out;
  }

  // skieruj kość tak, by jej dziecko leżało w kierunku dir (przestrzeń modelu)
  aim(name, dir, w) {
    const bone = this.bones[name];
    const parentQ = this.modelQuat(bone.parent, _q);
    const cur = _q2.copy(parentQ).multiply(bone.quaternion);
    const d0 = _v.copy(this.childDir[name]).applyQuaternion(cur);
    const dq = _q3.setFromUnitVectors(d0, _v2.copy(dir).normalize());
    // nowy lokalny = parent^-1 * dq * parent * lokalny
    const target = parentQ.clone().invert().multiply(dq).multiply(parentQ).multiply(bone.quaternion);
    bone.quaternion.slerp(target, w);
  }

  applyPose(P, w, snap = false, dt = 0, wobble = 0) {
    const k = snap ? 1 : 1 - Math.exp(-16 * dt);
    for (const [key, l, r] of SLOTS) {
      const tl = P[key];
      const tr = P[key + 'R'] || _v.set(-tl.x, tl.y, tl.z);
      this.dirs[l].lerp(tl, k).normalize();
      if (r) this.dirs[r].lerp(tr, k).normalize();
    }
    if (wobble) { // machanie rękami (poślizg, płacz)
      this.dirs.LeftForeArm.y += Math.sin(this.t * 22) * wobble;
      this.dirs.RightForeArm.y -= Math.sin(this.t * 22) * wobble;
    }
    if (w <= 0.001) return;
    for (const [, l, r] of SLOTS) {
      this.aim(l, this.dirs[l], w);
      if (r) this.aim(r, this.dirs[r], w);
    }
  }

  // pozycje kluczowych kości w przestrzeni `inner` (bez obrotów postaci)
  measure() {
    this.inner.updateMatrixWorld(true);
    _m.copy(this.inner.matrixWorld).invert();
    const p = (n) => _v.setFromMatrixPosition(this.bones[n].matrixWorld).applyMatrix4(_m).clone();
    const lt = p('LeftToeBase'), rt = p('RightToeBase'), lf = p('LeftFoot'), rf = p('RightFoot');
    const hips = p('Hips'), head = p('Head'), top = p('head_end'), lk = p('LeftLeg'), rk = p('RightLeg');
    const foot = Math.min(lt.y, rt.y, lf.y, rf.y);
    const pts = [hips, head, top, lk, rk, lf, rf];
    const c = pts.reduce((a, b) => a.add(b), new THREE.Vector3()).multiplyScalar(1 / pts.length);
    let r = 0; for (const q of pts) r = Math.max(r, q.distanceTo(c));
    // najniższa powierzchnia ciała: kość minus przybliżona grubość w tym miejscu
    let lowest = Infinity;
    for (const [n, th] of LOW_PTS) lowest = Math.min(lowest, p(n).y - th);
    return { foot, hips, center: c, radius: r, lowest };
  }

  update(dt, p, rx = p.x, ry = p.y) {
    this.t += dt;
    LOOK_UNIFORMS.uSat.value = CFG.charSaturation;
    LOOK_UNIFORMS.uBright.value = CFG.charBrightness;
    const st = p.state, speed = Math.abs(p.vx);
    this.rollT = st === 'roll' ? (this.prevState === 'roll' ? this.rollT + dt : 0) : 0;
    if (st !== this.prevState) {
      if (st === 'cart') this.spinBase = Math.round(this.spin / TAU) * TAU;
      if (st === 'roll' || this.prevState === 'roll') this.squash = st === 'roll' ? 0.6 : -0.6;
      this.prevState = st;
    }
    if (p.saltoT > this.prevSalto + 0.01) this.spinBase = Math.round(this.spin / TAU) * TAU;
    this.prevSalto = p.saltoT;

    let P = POSES.idle, run = false, mode = 'feet', scale = 1, face = p.facing > 0 ? FACE_R : FACE_L;
    let lift = 0, wobble = 0, pivotY = 0;
    // klip animacji dla stanu: role = nazwa klipu, scrub = 0..1 (czas sterowany fizyką), ts = tempo
    const has = (r) => !!this.actions[r];
    let role = null, scrub = null, ts = 1, clipSpin = false;
    if (this.carry > 0) { P = POSES.carried; mode = 'air'; }
    else if (st === 'roll') { P = POSES.tuck; mode = 'ball'; scale = 0.9; }
    else if (st === 'cart') { P = POSES.star; mode = 'cart'; face = 0; pivotY = 0.72; }
    else if (st === 'stun' || st === 'cry' || st === 'bored') { P = POSES[st]; mode = 'sit'; wobble = st === 'cry' ? 0.15 : 0; }
    else if (st === 'won') { P = POSES.won; lift = Math.abs(Math.sin(this.t * 9)) * 0.22; }
    else if (!p.onGround) {
      if (p.saltoT > 0) { P = POSES.tuck; mode = 'ball'; pivotY = 0.65; }
      else { P = p.vy > 0 ? POSES.rise : POSES.fall; mode = 'air'; }
    } else if (p.skid) { P = POSES.skid; wobble = 0.35; }
    else if (speed > 0.3) { run = true; }

    if (this.carry > 0) role = has('carried') ? 'carried' : null;
    else if (st === 'roll' && has('roll')) {
      // fikołek: właściwy przewrót to środek klipu; przedłużony (pod meblem) zapętla jego rdzeń
      const k = this.rollT / CFG.rollTime;
      scrub = k < 1 ? CLIP.roll[0] + (CLIP.roll[1] - CLIP.roll[0]) * k
        : CLIP.rollLoop[0] + ((k - 1) % 0.6) / 0.6 * (CLIP.rollLoop[1] - CLIP.rollLoop[0]);
      role = 'roll'; clipSpin = true; mode = 'lowest'; scale = CLIP.rollScale;
    }
    else if (st === 'cart' && has('cartwheel')) {
      const k = 1 - Math.max(0, p.cartT) / CFG.cartTime;
      role = 'cartwheel'; scrub = CLIP.cart[0] + (CLIP.cart[1] - CLIP.cart[0]) * k;
      clipSpin = true; mode = 'lowest'; pivotY = 0;
      face = p.facing > 0 ? Math.PI / 2 : -Math.PI / 2; // koło w płaszczyźnie ekranu
    }
    else if (st === 'normal' && p.saltoT > 0 && has('flip')) {
      const k = 1 - p.saltoT / CFG.saltoTime;
      role = 'flip'; scrub = CLIP.flip[0] + (CLIP.flip[1] - CLIP.flip[0]) * k;
      clipSpin = true; mode = 'hips'; pivotY = 0;
    }
    else if ((st === 'stun' || st === 'cry' || st === 'bored') && has(st)) { role = st; mode = 'feet'; } // klipy Mixamo są na stojąco
    else if (st === 'won' && has('win')) { role = 'win'; lift = 0; }
    else if (st === 'normal' && !p.onGround && p.saltoT <= 0) {
      if (p.vy > 0 && has('jump')) { role = 'jump'; scrub = CLIP.rise[0] + (CLIP.rise[1] - CLIP.rise[0]) * THREE.MathUtils.clamp(1 - p.vy / CFG.jumpVel, 0, 1); }
      else if (has('fall')) role = 'fall';
      else if (has('jump')) { role = 'jump'; scrub = CLIP.fall[0] + (CLIP.fall[1] - CLIP.fall[0]) * THREE.MathUtils.clamp(-p.vy / 12, 0, 1); }
    }
    else if (st === 'normal' && p.onGround && p.skid && has('skid')) role = 'skid';
    else if (run) {
      if (has('run')) { role = 'run'; ts = THREE.MathUtils.clamp(speed / CFG.baseMaxSpeed, 0.6, 2.2); }
      else if (has('walk')) { role = 'walk'; ts = Math.min(3.4, 0.9 + speed * 0.3); }
    }
    else if (st === 'normal' && p.onGround && has('idle')) role = 'idle';

    // wagi klipów (płynne przejścia)
    if (role !== this.role) {
      if (role && scrub === null && role !== 'run' && role !== 'walk') this.actions[role].reset().play();
      this.role = role;
    }
    const kw = 1 - Math.exp(-12 * dt);
    for (const [name, a] of Object.entries(this.actions)) {
      this.weights[name] = lerp(this.weights[name], name === role ? 1 : 0, kw);
      a.setEffectiveWeight(this.weights[name]);
      if (name === role) {
        if (scrub !== null) { a.timeScale = 0; a.time = THREE.MathUtils.clamp(scrub, 0, 0.999) * a.getClip().duration; }
        else a.timeScale = ts;
      }
    }
    this.mixer.update(dt);
    this.procW = lerp(this.procW, role ? 0 : 1, 1 - Math.exp(-14 * dt));
    this.applyPose(P, this.procW, false, dt, wobble);
    if (run && (role === 'walk' || role === 'run')) { // pochylenie w biegu
      const lean = 0.12 + 0.25 * Math.min(1, speed / 10);
      const b = this.bones.Spine02;
      const pq = this.modelQuat(b.parent, _q);
      const axis = _v.set(1, 0, 0).applyQuaternion(pq.clone().invert());
      b.quaternion.premultiply(_q2.setFromAxisAngle(axis, lean));
    }

    // obroty całego ciała
    if (clipSpin) {
      this.spin = lerp(this.spin, Math.round(this.spin / TAU) * TAU, 1 - Math.exp(-14 * dt));
    } else if (st === 'roll') {
      this.spin += -p.facing * (Math.max(speed, 3) / (BALL_R * this.scale)) * dt;
    } else if (st === 'cart') {
      this.spin = this.spinBase - p.facing * TAU * (1 - Math.max(0, p.cartT) / CFG.cartTime);
    } else if (st === 'normal' && p.saltoT > 0) {
      const k = 1 - p.saltoT / CFG.saltoTime;
      this.spin = this.spinBase - p.facing * TAU * (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2);
    } else {
      this.spin = lerp(this.spin, Math.round(this.spin / TAU) * TAU, 1 - Math.exp(-14 * dt));
    }

    const ks = 1 - Math.exp(-18 * dt);
    this.faceAngle = lerp(this.faceAngle, face, 1 - Math.exp(-14 * dt));
    this.facer.rotation.y = this.faceAngle;
    this.scale = lerp(this.scale, scale, ks);
    this.squash *= Math.exp(-9 * dt);
    if (p.landSquash > 0) { this.squash = Math.max(this.squash, p.landSquash * 0.8); p.landSquash = 0; }
    const sq = this.squash * 0.18;
    this.spinner.scale.set(this.scale * (1 + sq * 0.5), this.scale * (1 - sq), this.scale * (1 + sq * 0.5));
    this.spinner.rotation.z = this.spin;

    // ustawienie modelu względem punktu obrotu
    // (pozycje z measure() są w układzie `inner`, więc inner.position = -punkt kładzie ten punkt w osi obrotu)
    const m = this.measure();
    const tgt = _v2;
    if (mode === 'ball') {
      tgt.copy(m.center).negate();
      pivotY = pivotY || BALL_R * this.scale;
    } else if (mode === 'cart') {
      tgt.copy(m.hips).negate();
    } else if (mode === 'hips') {
      // salto z klipu: biodra zostają na swojej wysokości, ciało kręci się wokół nich
      tgt.set(-this.hipsRest.x, this.hipsRest.y - m.hips.y, -this.hipsRest.z);
    } else if (mode === 'lowest') {
      // klip sam obraca ciało: kładziemy najniższy punkt na podłodze
      tgt.set(-this.hipsRest.x, -m.lowest, -this.hipsRest.z);
    } else {
      // stopy (albo pupa przy siedzeniu) na wysokości punktu fizyki
      tgt.set(-this.hipsRest.x, mode === 'sit' ? 0.1 - m.hips.y : this.footRest - m.foot, -this.hipsRest.z);
    }
    this.inner.position.lerp(tgt, mode === 'ball' || mode === 'cart' ? ks : 1 - Math.exp(-30 * dt));
    this.pivotY = lerp(this.pivotY, pivotY, ks);
    this.spinner.position.y = this.pivotY + lift;

    this.root.position.set(rx, ry + this.carry, 0);

    // gwiazdki
    this.starT = Math.max(0, this.starT - dt);
    const showStars = st === 'stun' || this.starT > 0;
    this.stars.visible = showStars;
    if (showStars) {
      this.headWorld(_v);
      this.stars.position.set(0, _v.y - this.root.position.y + 0.2, 0);
      this.stars.children.forEach((s, i) => {
        const a = this.t * 4 + (i / 5) * TAU;
        s.position.set(Math.cos(a) * 0.32, Math.sin(a * 2) * 0.03, Math.sin(a) * 0.32);
        s.rotation.z = this.t * 6;
      });
    }

    const blink = p.invuln > 0 && st !== 'stun' && !p.failKind && Math.floor(this.t * 14) % 2 === 0;
    this.root.visible = !blink;
  }

  headWorld(out) {
    this.root.updateMatrixWorld(true);
    return out.setFromMatrixPosition(this.bones.Head.matrixWorld).add(_v.set(0, 0.12, 0));
  }
}
