// Przenoszenie animacji z dowolnego humanoidalnego szkieletu (Mixamo, Meshy) na szkielet Domi.
// Zamiast kopiować surowe obroty (które zależą od osi kości i pozy spoczynkowej),
// w każdej klatce odczytujemy KIERUNKI kości źródła w przestrzeni modelu i kierujemy
// w te same strony kości celu. Biodra dostają pełną orientację (salta, fikołki).
import * as THREE from 'three';

// nazwa kości Domi → nazwa „znormalizowana" (Mixamo bez prefiksu, małe litery)
const MAP = {
  Hips: 'hips', Spine02: 'spine', Spine01: 'spine1', Spine: 'spine2', neck: 'neck', Head: 'head', head_end: 'headtop_end',
  LeftShoulder: 'leftshoulder', LeftArm: 'leftarm', LeftForeArm: 'leftforearm', LeftHand: 'lefthand',
  RightShoulder: 'rightshoulder', RightArm: 'rightarm', RightForeArm: 'rightforearm', RightHand: 'righthand',
  LeftUpLeg: 'leftupleg', LeftLeg: 'leftleg', LeftFoot: 'leftfoot', LeftToeBase: 'lefttoebase',
  RightUpLeg: 'rightupleg', RightLeg: 'rightleg', RightFoot: 'rightfoot', RightToeBase: 'righttoebase',
};
// gdy źródło ma nazwy jak Meshy, mapowanie jest 1:1
const norm = (n) => n.replace(/^mixamorig\d*[:_]?/i, '').toLowerCase();

// kość → jej „dziecko" wyznaczające kierunek (kolejność: rodzic przed dzieckiem)
const CHAIN = [
  ['Spine02', 'Spine01'], ['Spine01', 'Spine'], ['Spine', 'neck'], ['neck', 'Head'], ['Head', 'head_end'],
  ['LeftShoulder', 'LeftArm'], ['LeftArm', 'LeftForeArm'], ['LeftForeArm', 'LeftHand'],
  ['RightShoulder', 'RightArm'], ['RightArm', 'RightForeArm'], ['RightForeArm', 'RightHand'],
  ['LeftUpLeg', 'LeftLeg'], ['LeftLeg', 'LeftFoot'], ['LeftFoot', 'LeftToeBase'],
  ['RightUpLeg', 'RightLeg'], ['RightLeg', 'RightFoot'], ['RightFoot', 'RightToeBase'],
];

function bonesByName(root) {
  const out = {};
  root.traverse((o) => { if (o.isBone) out[o.name] = o; });
  return out;
}

function findSource(srcBones, tgtName) {
  if (srcBones[tgtName]) return srcBones[tgtName];
  const want = MAP[tgtName];
  for (const [n, b] of Object.entries(srcBones)) if (norm(n) === want) return b;
  return null;
}

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion();
const _a = new THREE.Vector3(), _b = new THREE.Vector3();

// rama bioder z dwóch wektorów: góra (biodra→kręgosłup) i bok (prawe→lewe udo)
function hipsFrame(up, side, out) {
  const y = up.clone().normalize();
  const x = side.clone().sub(y.clone().multiplyScalar(side.dot(y))).normalize();
  const z = new THREE.Vector3().crossVectors(x, y);
  return out.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
}

function modelQuat(bone, root, out) {
  out.identity();
  for (let o = bone; o && o !== root; o = o.parent) out.premultiply(o.quaternion);
  return out;
}

/**
 * @param target  wczytany model Domi (FBX z siatką), w pozie spoczynkowej
 * @param source  wczytany plik animacji (FBX, może być bez siatki)
 * @param clip    klip ze źródła
 * @returns AnimationClip dla kości Domi
 */
export function retargetClip(target, source, clip, { name, fps = 30, inPlace = true } = {}) {
  const T = bonesByName(target), S = bonesByName(source);
  const missing = Object.keys(MAP).filter((n) => T[n] && !findSource(S, n));
  const srcOf = (n) => findSource(S, n);

  // spoczynek celu
  const rest = {};
  for (const [n, b] of Object.entries(T)) rest[n] = { q: b.quaternion.clone(), p: b.position.clone() };

  const posIn = (root, bone, out) => {
    root.updateMatrixWorld(true);
    _m.copy(root.matrixWorld).invert();
    return out.setFromMatrixPosition(bone.matrixWorld).applyMatrix4(_m);
  };

  // wysokości bioder (do skalowania przysiadów) — źródło w pozie spoczynkowej (zanim ruszy animacja)
  const srcHip0 = posIn(source, srcOf('Hips'), new THREE.Vector3());
  const srcFoot0 = Math.min(posIn(source, srcOf('LeftFoot'), _a).y, posIn(source, srcOf('RightFoot'), _b).y);
  const tgtHip0 = posIn(target, T.Hips, new THREE.Vector3());
  const tgtFoot0 = Math.min(posIn(target, T.LeftFoot, _a).y, posIn(target, T.RightFoot, _b).y);
  const srcLeg = srcHip0.y - srcFoot0, tgtLeg = tgtHip0.y - tgtFoot0;
  const mixer = new THREE.AnimationMixer(source);
  mixer.clipAction(clip).play();

  // rama bioder celu w spoczynku
  const tgtFrameRest = hipsFrame(
    posIn(target, T.Spine02, new THREE.Vector3()).sub(posIn(target, T.Hips, new THREE.Vector3())),
    posIn(target, T.LeftUpLeg, new THREE.Vector3()).sub(posIn(target, T.RightUpLeg, new THREE.Vector3())),
    new THREE.Quaternion());
  const hipsRestModel = modelQuat(T.Hips, target, new THREE.Quaternion());

  const frames = Math.max(2, Math.round(clip.duration * fps) + 1);
  const times = new Float32Array(frames);
  const qTracks = {};
  for (const n of Object.keys(T)) if (MAP[n] !== undefined) qTracks[n] = new Float32Array(frames * 4);
  const hipPos = new Float32Array(frames * 3);
  const sp = {};

  for (let f = 0; f < frames; f++) {
    const t = Math.min(clip.duration, f / fps);
    times[f] = t;
    mixer.setTime(t);
    source.updateMatrixWorld(true);
    for (const n of Object.keys(MAP)) { const b = srcOf(n); if (b) sp[n] = posIn(source, b, sp[n] || new THREE.Vector3()); }

    // 1) poza spoczynkowa celu
    for (const [n, r] of Object.entries(rest)) { T[n].quaternion.copy(r.q); T[n].position.copy(r.p); }

    // 2) biodra: orientacja jak w źródle
    const srcFrame = hipsFrame(_a.copy(sp.Spine02).sub(sp.Hips), _b.copy(sp.LeftUpLeg).sub(sp.RightUpLeg), _q);
    const R = _q2.copy(srcFrame).multiply(tgtFrameRest.clone().invert());
    const newModel = R.clone().multiply(hipsRestModel);
    const parentModel = modelQuat(T.Hips.parent, target, new THREE.Quaternion());
    T.Hips.quaternion.copy(parentModel.clone().invert().multiply(newModel));

    // wysokość bioder (przysiad, przewrót), przesunięcie w poziomie wycinamy
    const k = tgtLeg / srcLeg;
    const wantY = tgtFoot0 + (sp.Hips.y - srcFoot0) * k;
    const wantModel = new THREE.Vector3(inPlace ? tgtHip0.x : tgtHip0.x + (sp.Hips.x - srcHip0.x) * k, wantY,
      inPlace ? tgtHip0.z : tgtHip0.z + (sp.Hips.z - srcHip0.z) * k);
    T.Hips.parent.updateMatrixWorld(true);
    const toParent = new THREE.Matrix4().copy(T.Hips.parent.matrixWorld).invert().multiply(target.matrixWorld);
    T.Hips.position.copy(wantModel.applyMatrix4(toParent));

    // 3) reszta: kierunki kości
    for (const [bn, cn] of CHAIN) {
      if (!sp[bn] || !sp[cn] || !T[bn] || !T[cn]) continue;
      const dir = _a.copy(sp[cn]).sub(sp[bn]).normalize();
      const bone = T[bn];
      const pq = modelQuat(bone.parent, target, new THREE.Quaternion());
      const cur = pq.clone().multiply(bone.quaternion);
      const d0 = T[cn].position.clone().normalize().applyQuaternion(cur);
      const dq = new THREE.Quaternion().setFromUnitVectors(d0, dir);
      bone.quaternion.copy(pq.clone().invert().multiply(dq).multiply(pq).multiply(bone.quaternion));
    }

    for (const [n, arr] of Object.entries(qTracks)) T[n].quaternion.toArray(arr, f * 4);
    T.Hips.position.toArray(hipPos, f * 3);
  }

  // przywróć spoczynek
  for (const [n, r] of Object.entries(rest)) { T[n].quaternion.copy(r.q); T[n].position.copy(r.p); }
  mixer.stopAllAction();

  const tracks = Object.entries(qTracks).map(([n, arr]) => new THREE.QuaternionKeyframeTrack(`${n}.quaternion`, times, arr));
  tracks.push(new THREE.VectorKeyframeTrack('Hips.position', times, hipPos));
  const out = new THREE.AnimationClip(name || clip.name, clip.duration, tracks);
  out.userData = { missing };
  return out;
}

// rola animacji w grze na podstawie nazwy pliku
export function roleFromFile(file) {
  const f = file.toLowerCase();
  const rules = [
    ['cartwheel', /cartwheel/], ['flip', /flip|salto|somersault/], ['roll', /roll/],
    ['idle', /idle/], ['stun', /dizzy|stun|knock|hit/], ['cry', /cry|sad|tantrum/],
    ['bored', /sit|bored/], ['win', /victory|cheer|celebrat|happy|joy/],
    ['skid', /stop|skid|slide|brake/], ['jump', /jump/], ['fall', /fall/],
    ['run', /run|sprint/], ['walk', /walk/],
  ];
  for (const [role, re] of rules) if (re.test(f)) return role;
  return f.replace(/\.fbx$/, '').replace(/[^a-z0-9]+/g, '_');
}
