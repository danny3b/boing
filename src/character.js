// Model bohaterki z prymitywów + proceduralna animacja. Twarz patrzy w +X.
import * as THREE from 'three';
import { toon, outlineMat } from './textures.js';
import { CFG } from './config.js';
import { faceMap, hairMap, dressMap } from './character-art.js';

const COL = {
  skin: 0xffd6b4, hair: 0xf5d382, hairLight: 0xffe6a2, hairShade: 0xe8bf6c,
  ribbon: 0xb84054, cream: 0xffebce, sock: 0xf9e2b9, shoe: 0x994954, sole: 0x673d42,
};
const TAU = Math.PI * 2;
const FACE_R = -0.95, FACE_L = -Math.PI + 0.95; // twarz w trzech czwartych do kamery

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

// Zaokrąglone części dzielą siatkę bazową, a obrys skaluje się razem z nimi.
const ball = new THREE.SphereGeometry(1, 24, 18);
const softColors = new Map();
function softMaterial(color) {
  if (!softColors.has(color)) {
    softColors.set(color, new THREE.MeshLambertMaterial({ color, emissive: color, emissiveIntensity: 0.18 }));
  }
  return softColors.get(color);
}

function oval(parent, color, x, y, z, rx, ry, rz, edge = 0) {
  const part = mesh(ball, color, edge ? [edge, edge, edge] : null, softMaterial(color));
  part.position.set(x, y, z);
  part.scale.set(rx, ry, rz);
  parent.add(part);
  return part;
}

// Zaokrąglone końce na osi stawu zachodzą na siebie również przy zgięciu.
function limb(parent, profile) {
  const geo = new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), 16);
  parent.add(mesh(geo, COL.skin, null, softMaterial(COL.skin)));
}

function joint(parent, x, y, z) {
  const group = new THREE.Group();
  group.position.set(x, y, z);
  parent.add(group);
  return group;
}

function hairGeometry() {
  // Krótsze włosy nad brwią, boczny przedziałek i miękkie pasma przy uszach.
  const pos = [], uv = [], indices = [];
  const slices = 72, rows = 20;
  for (let j = 0; j <= rows + 1; j++) {
    const t = Math.min(1, j / rows);
    for (let i = 0; i <= slices; i++) {
      const a = (i / slices - 0.5) * TAU;
      const bump = (center, width) => Math.exp(-(((a - center) / width) ** 2));
      const edge = 1.56 - 0.65 * Math.cos(a) - 0.29 * bump(-0.51, 0.26)
        + 0.32 * bump(0.24, 0.48) + 0.40 * bump(1.26, 0.34) + 0.49 * bump(-1.20, 0.34);
      const polar = t * edge;
      const ridge = 0.025 * Math.cos(9 * a - 2.2 * Math.sin(t * 2.4)) * Math.sin(polar);
      const radius = (1 + ridge) * (j > rows ? 0.90 : 1);
      pos.push(-0.012 + radius * 0.231 * Math.sin(polar) * Math.cos(a),
        0.012 + radius * 0.234 * Math.cos(polar),
        radius * 0.246 * Math.sin(polar) * Math.sin(a));
      uv.push(i / slices, 1 - t);
      if (i < slices && j <= rows) {
        const n = j * (slices + 1) + i, below = n + slices + 1;
        indices.push(n, n + 1, below, n + 1, below + 1, below);
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setIndex(indices);
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.computeVertexNormals();
  return geo;
}

function forelock() {
  // Kosmyk podniesiony nad przedziałkiem, szeroki u nasady i skręcony na czubku.
  const geo = ball.clone(), v = geo.attributes.position;
  for (let i = 0; i < v.count; i++) {
    const t = (v.getX(i) + 1) / 2;
    v.setXYZ(i, -0.081 + 0.206 * t,
      0.211 + 0.046 * Math.sin(t * Math.PI) + 0.039 * t ** 4 + v.getY(i) * 0.033 * (1 - t),
      -0.035 + 0.030 * Math.sin(t * Math.PI) + v.getZ(i) * 0.060 * (1 - t));
  }
  geo.computeVertexNormals();
  return mesh(geo, COL.hair, null, softMaterial(COL.hair));
}

function braid(parent, side) {
  const root = joint(parent, -0.098, 0.016, side * 0.179);
  // Trzy pasma przeplatają się wzdłuż łuku od ucha do wstążki.
  const end = new THREE.Vector3(-0.006, -0.207, side * 0.146);
  const colors = [COL.hair, COL.hairLight, COL.hairShade];
  colors.forEach((color, strand) => {
    const points = [];
    for (let i = 0; i <= 32; i++) {
      const t = i / 32, wave = t * TAU * 1.35 + strand * TAU / 3;
      const width = 0.032 * (1 - 0.55 * t);
      points.push(new THREE.Vector3(end.x * t - 0.035 * Math.sin(t * Math.PI) + width * Math.cos(wave),
        end.y * t - 0.012 * Math.sin(wave) * (1 - t),
        end.z * t + side * (0.046 * Math.sin(t * Math.PI) + width * Math.sin(wave))));
    }
    const path = new THREE.CatmullRomCurve3(points);
    const geo = new THREE.TubeGeometry(path, 32, 0.035, 9, false);
    const verts = geo.attributes.position, v = new THREE.Vector3();
    for (let i = 0; i <= 32; i++) {
      const center = path.getPointAt(i / 32);
      for (let j = 0; j <= 9; j++) {
        const n = i * 10 + j;
        v.fromBufferAttribute(verts, n).sub(center).multiplyScalar(1 - 0.48 * i / 32).add(center);
        verts.setXYZ(n, v.x, v.y, v.z);
      }
    }
    root.add(mesh(geo, color, null));
  });
  const tip = oval(root, COL.hair, end.x - 0.011, end.y - 0.034, end.z,
    0.028, 0.051, 0.025, 1.045);
  tip.rotation.z = -0.42;

  const bow = joint(root, end.x, end.y, end.z + side * 0.015);
  bow.rotation.set(0, side > 0 ? 0.43 : Math.PI - 0.43, side * 0.26);
  bow.scale.setScalar(1.12);
  const loop = new THREE.Shape();
  loop.moveTo(0, 0);
  loop.bezierCurveTo(0.024, 0.031, 0.065, 0.050, 0.067, 0.029);
  loop.bezierCurveTo(0.074, 0.004, 0.069, -0.021, 0.057, -0.022);
  loop.quadraticCurveTo(0.033, -0.025, 0, 0);
  const loops = new THREE.ExtrudeGeometry(loop, { depth: 0.008, bevelEnabled: true,
    bevelSegments: 2, bevelThickness: 0.004, bevelSize: 0.004, curveSegments: 7 });
  for (const sign of [-1, 1]) {
    const wing = mesh(loops, COL.ribbon, null);
    wing.scale.x = sign;
    bow.add(wing);
  }
  oval(bow, 0xcf5663, 0, 0, 0.006, 0.016, 0.019, 0.012);
  return { g: root, side };
}

function makeDress(upper) {
  // Profil od podszewki do szyi. Zwężenie w talii i fałdy nadają spódnicy kształt w obrocie.
  const profile = [[0.01, 0.424], [0.176, 0.421], [0.215, 0.433], [0.223, 0.451],
    [0.215, 0.481], [0.170, 0.59], [0.137, 0.657], [0.143, 0.696],
    [0.159, 0.779], [0.148, 0.837], [0.084, 0.866], [0.04, 0.862]];
  const geo = new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y - 0.65)), 40);
  const vertices = geo.attributes.position;
  for (let i = 0; i < vertices.count; i++) {
    const x = vertices.getX(i), y = vertices.getY(i), z = vertices.getZ(i);
    const fold = Math.max(0, -y / 0.23) * 0.045 * Math.cos(8 * Math.atan2(x, z));
    vertices.setXYZ(i, x * (1 + fold), y, z * (1 + fold));
  }
  geo.computeVertexNormals();
  const dress = mesh(geo, 0xffffff, [1.04, 1.024, 1.04], toon(0xffffff, dressMap()));
  dress.scale.x = 0.82;
  dress.position.y = 0.65;
  upper.add(dress);
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
    this.legs = {};
    for (const side of [1, -1]) {
      const hip = joint(this.body, 0, 0.50, side * 0.077);
      limb(hip, [[0, -0.282], [0.028, -0.272], [0.041, -0.253], [0.044, -0.231],
        [0.049, -0.176], [0.056, -0.114], [0.059, -0.055], [0.048, -0.019], [0, 0.005]]);
      oval(hip, 0x27686d, 0, -0.045, 0, 0.075, 0.086, 0.067);
      const knee = joint(hip, 0, -0.24, 0);
      limb(knee, [[0, -0.187], [0.032, -0.165], [0.040, -0.128], [0.047, -0.080],
        [0.046, -0.048], [0.044, -0.016], [0.043, 0.002], [0.037, 0.022], [0.022, 0.036], [0, 0.042]]);
      oval(knee, COL.sock, -0.002, -0.158, 0, 0.05, 0.074, 0.048);
      oval(knee, COL.cream, 0, -0.118, 0, 0.054, 0.022, 0.051, 1.035);
      oval(knee, COL.sole, 0.034, -0.239, 0, 0.100, 0.021, 0.061, 1.05);
      oval(knee, COL.shoe, 0.032, -0.219, 0, 0.099, 0.035, 0.060);
      const strap = oval(knee, 0xc66964, 0.026, -0.191, 0, 0.022, 0.014, 0.052);
      strap.rotation.z = -0.18;
      this.legs[side] = { hip, knee };
    }

    this.spine = joint(this.body, 0, 0.5, 0);
    const upper = joint(this.spine, 0, -0.5, 0);
    makeDress(upper);
    oval(upper, COL.skin, 0, 0.867, 0, 0.060, 0.070, 0.064);

    this.arms = {};
    for (const side of [1, -1]) {
      const sh = joint(upper, 0, 0.809, side * 0.144);
      limb(sh, [[0, -0.198], [0.024, -0.19], [0.034, -0.171], [0.035, -0.15],
        [0.043, -0.083], [0.046, -0.052], [0.04, -0.026], [0, -0.008]]);
      const sleeve = oval(sh, COL.cream, 0, -0.019, side * 0.014, 0.074, 0.080, 0.070, 1.045);
      sleeve.rotation.x = -side * 0.22;
      oval(sh, 0xefd2a3, 0, -0.069, side * 0.021, 0.051, 0.019, 0.051);
      const el = joint(sh, 0, -0.167, 0);
      limb(el, [[0, -0.155], [0.031, -0.143], [0.032, -0.119], [0.037, -0.074],
        [0.039, -0.049], [0.034, -0.004], [0.029, 0.016], [0.018, 0.029], [0, 0.034]]);
      oval(el, COL.skin, 0.006, -0.148, 0, 0.047, 0.053, 0.041, 1.05);
      oval(el, COL.skin, 0.032, -0.142, side * 0.010, 0.021, 0.027, 0.022);
      this.arms[side] = { sh, el };
    }

    const head = this.head = joint(upper, 0.015, 1.018, 0);
    this.faces = Object.fromEntries(['smile', 'blink', 'sad', 'surprise'].map(mood => [mood, faceMap(mood)]));
    this.faceMaterial = new THREE.MeshLambertMaterial({ map: this.faces.smile,
      emissive: 0xffffff, emissiveMap: this.faces.smile, emissiveIntensity: 0.18 });
    const geo = new THREE.SphereGeometry(1, 48, 36);
    const vertices = geo.attributes.position;
    for (let i = 0; i < vertices.count; i++) {
      const y = vertices.getY(i), z = vertices.getZ(i);
      // Pełne policzki, łagodnie zwężający się podbródek.
      const jaw = 1 - 0.19 * Math.max(0, -y);
      vertices.setXYZ(i, vertices.getX(i) * 0.207 * jaw, y * 0.208, z * 0.228 * jaw);
    }
    geo.computeVertexNormals();
    head.add(mesh(geo, 0xffffff, [1.03, 1.03, 1.03], this.faceMaterial));
    oval(head, 0xf9bda2, 0.204, -0.023, 0, 0.028, 0.025, 0.033);
    for (const side of [1, -1]) {
      oval(head, COL.skin, -0.015, -0.025, side * 0.215, 0.040, 0.054, 0.029, 1.045);
      oval(head, 0xf0b097, -0.013, -0.025, side * 0.238, 0.021, 0.030, 0.009);
    }
    head.add(mesh(hairGeometry(), 0xffffff, [1.025, 1.025, 1.025], toon(0xffffff, hairMap())));
    head.add(forelock());
    this.pigtails = [braid(head, 1), braid(head, -1)];
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
          T.armL = 2.7; T.armR = 2.3; T.elbowL = T.elbowR = 0.2; T.armLx = 0.68; T.armRx = -0.65;
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
        T.armL = T.armR = 2.9; T.armLx = 0.86; T.armRx = -0.86; T.hipL = 0.3; T.kneeL = -0.6;
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
    const blinkTime = this.t % 3.9;
    const eyesClosed = blinkTime > 3.72 || st === 'bored';
    let face = eyesClosed ? this.faces.blink : this.faces.smile;
    if (st === 'cry') face = this.faces.sad;
    if (st === 'stun') face = this.faces.surprise;
    this.faceMaterial.map = this.faceMaterial.emissiveMap = face;
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

    // Warkocze podążają z opóźnieniem za skokiem i odbiciem od podłogi.
    const force = -p.vy * 0.04 + (st === 'normal' && p.onGround ? Math.sin(this.phase * 2) * speed * 0.03 : 0);
    this.pigV += (force - this.pig) * 120 * dt - this.pigV * 8 * dt;
    this.pig += this.pigV * dt;
    for (const { g, side } of this.pigtails) {
      g.rotation.z = -THREE.MathUtils.clamp(this.pig, -0.68, 0.68);
      g.rotation.x = -side * (0.08 + Math.abs(this.pig) * 0.32);
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
