import * as THREE from 'three';
import { CFG } from './config.js';
import { initTextures, paperOverlayDataURL } from './textures.js';
import { buildLevel } from './level.js';
import { Player } from './player.js';
import { MomHand } from './character.js';
import { Character } from './character3d.js';
import { Sfx } from './audio.js';
import { Fx } from './fx.js';
import { Hud, fmtTime } from './hud.js';
import { Input } from './input.js';
import { Q, pick } from './quips.js';
import { loadTuning, initTuner } from './tuner.js';

loadTuning();
const tuner = initTuner();

const $ = (id) => document.getElementById(id);

// ---------- czcionki muszą być gotowe przed rysowaniem karteczek ----------
try {
  await Promise.race([
    Promise.all([document.fonts.load('46px "Patrick Hand"'), document.fonts.load('40px "Titan One"')]),
    new Promise((r) => setTimeout(r, 2500)),
  ]);
} catch { /* trudno — użyjemy zapasowej */ }

initTextures();
$('paper').style.backgroundImage = `url(${paperOverlayDataURL()})`;

// ---------- scena ----------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
$('game').appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf7e8d0);
const camera = new THREE.PerspectiveCamera(42, innerWidth / innerHeight, 0.1, 200);

scene.add(new THREE.HemisphereLight(0xfff6ea, 0xc9a88a, 1.6));
const sun = new THREE.DirectionalLight(0xfff0d8, 2.2);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 12, bottom: -6, near: 1, far: 40 });
sun.shadow.bias = -0.0005;
scene.add(sun, sun.target);

const level = buildLevel(scene);
const player = new Player(level);
const domi = new Character(scene);
const hand = new MomHand(scene);
const sfx = new Sfx();
const fx = new Fx(scene, camera);
const hud = new Hud();
const input = new Input();

const game = {
  mode: 'menu', // menu | playing | paused | failing | over | won
  name: 'Domi',
  time: 0, t: 0, hitstop: 0,
  failT: 0, failKind: null, failShown: false,
  camX: 0, camY: 1.6, look: 0, fov: 42,
  lastSay: 0,
};

const head = new THREE.Vector3();

// ---------- mowa ----------
function say(text, force = false) {
  if (!force && game.t - game.lastSay < 0.9) return;
  game.lastSay = game.t;
  fx.say(text);
  sfx.say(text);
}

// ---------- przebieg gry ----------
function startGame() {
  const n = $('name-input').value.trim();
  game.name = n ? n.slice(0, 14) : 'Domi';
  hud.setName(game.name);
  document.querySelectorAll('.pname').forEach((el) => (el.textContent = game.name));
  sfx.init();
  restartLevel();
}

function restartLevel() {
  level.reset();
  player.resetLevel();
  domi.reset();
  fx.clear();
  hand.g.visible = false;
  Object.assign(game, { mode: 'playing', time: 0, hitstop: 0, failT: 0, failKind: null, failShown: false });
  game.camX = player.x; game.camY = 1.6;
  showScreen(null);
  hud.show(true);
  setTimeout(() => game.mode === 'playing' && say(pick(Q.start), true), 300);
}

function showScreen(id) {
  for (const s of document.querySelectorAll('.screen')) s.classList.toggle('show', s.id === id);
  $('overlay').classList.toggle('show', !!id);
}

function startFail(kind) {
  game.mode = 'failing';
  game.failKind = kind;
  game.failT = 0;
  if (kind === 'cry') { say(pick(['Buuuuuu!', 'Maaaamooo!']), true); sfx.cry(); }
  else { say(`Nuuudaaa... ${game.name} się nudzi...`, true); }
}

function updateFail(dt) {
  game.failT += dt;
  const t = game.failT;
  const px = player.x, py = player.y;
  if (game.failKind === 'cry' && Math.random() < dt * 12) {
    domi.headWorld(head); fx.tear(head.x + (Math.random() - 0.5) * 0.06, head.y - 0.02);
  }
  if (game.failKind === 'bored' && Math.random() < dt * 1.5) {
    domi.headWorld(head); fx.popup('Z', head.clone().add(new THREE.Vector3(0.3, 0.2, 0)), 'zzz', 1.4);
  }
  const A = 1.8, B = 3.0, C = 3.5, D = 5.2;
  if (t > A) {
    hand.g.visible = true;
    hand.g.position.x = px;
    let hy, curl = 0;
    const grab = py + 1.25;
    if (t < B) { const k = (t - A) / (B - A); hy = grab + 9 * Math.pow(1 - k, 3); }
    else if (t < C) { hy = grab; curl = ((t - B) / (C - B)) * 0.9; }
    else { const k = Math.min(1, (t - C) / (D - C)); hy = grab + 10 * k * k; curl = 0.9; domi.carry = hy - grab + 0.0001; }
    hand.g.position.y = hy;
    hand.curl(curl);
    if (t >= B && t - dt < B) { sfx.squeak(); say(game.failKind === 'cry' ? 'Chodź, kochanie, do pokoju...' : 'Skoro się nudzisz, to sprzątamy pokój!', true); }
  }
  if (t > D && !game.failShown) {
    game.failShown = true;
    game.mode = 'over';
    sfx.sadTrombone();
    $('fail-title').textContent = game.failKind === 'cry' ? 'Buuuu! Za dużo guzów!' : 'Nuuuda...';
    $('fail-text').innerHTML = game.failKind === 'cry'
      ? `<b>${game.name}</b> zalała się łzami i Mama zabrała ją do pokoju.<br>Skończyły się plasterki — uważaj na kanty!`
      : `<b>${game.name}</b> się znudziła i Mama zarządziła sprzątanie pokoju.<br>Pasek <b>ENERGII</b> spadł do zera — rób więcej akrobacji!`;
    showScreen('screen-fail');
  }
}

function win() {
  game.mode = 'won';
  sfx.fanfare();
  say(pick(Q.win), true);
  const p = player;
  let stars = 1;
  if (p.plasters >= p.maxPlasters - 1) stars++;
  if (p.candies >= level.candyTotal * 0.7 && game.time < 75) stars++;
  $('win-stats').innerHTML = `
    <div><span>Czas</span><b>${fmtTime(game.time)}</b></div>
    <div><span>Cukierki</span><b>${p.candies} / ${level.candyTotal}</b></div>
    <div><span>Plasterki</span><b>${p.plasters}</b></div>
    <div><span>Najlepsze combo</span><b>x${p.maxCombo}</b></div>
    <div><span>Akrobacje</span><b>${p.tricks}</b></div>`;
  $('win-stars').textContent = '★'.repeat(stars) + '☆'.repeat(3 - stars);
  setTimeout(() => game.mode === 'won' && showScreen('screen-win'), 1400);
}

// ---------- zdarzenia od gracza ----------
const TRICK_NAMES = { fikolek: 'FIKOŁEK!', przewrot: 'PRZEWRÓT!', gwiazda: 'GWIAZDA!', salto: 'SALTO!', boing: 'BOING!' };
const CAUSE_QUIPS = { edge: Q.edge, lego: Q.lego, wall: Q.wall, robot: Q.robot, lava: Q.lava, plant: Q.plant, trip: Q.trip, head: Q.head, badLanding: Q.badLanding };

function handle(e) {
  domi.headWorld(head);
  const px = player.x, py = player.y;
  switch (e.type) {
    case 'jump': sfx.jump(); fx.dust(px, py, 4, 0.6); break;
    case 'land': if (e.speed > 6) { sfx.land(e.speed); fx.dust(px, py, Math.min(10, e.speed | 0), 0.8); } break;
    case 'roll': sfx.roll(); fx.dust(px, py, 5); break;
    case 'skid': sfx.skid(); break;
    case 'cart': sfx.whoosh(); fx.dust(px, py, 6, 1.4); break;
    case 'trick':
      if (e.name === 'salto') sfx.squeak();
      if (e.name === 'boing') sfx.boing(1.2);
      fx.popup(TRICK_NAMES[e.name] + (e.combo > 1 ? ` x${e.combo}` : ''), head, e.weak ? 'trick weak' : 'trick');
      if (e.combo >= 4 && e.combo % 3 === 1) say(pick(Q.combo));
      break;
    case 'bonk': sfx.bonk(); break;
    case 'wallBump': sfx.boing(0.6); fx.popup('BOING!', head, 'boing'); fx.dust(px, py + 0.6, 5); break;
    case 'bounce': fx.dust(px, py, 8, 1.2); break;
    case 'squeak': sfx.squeak(); break;
    case 'pickup':
      if (e.what === 'candy') { sfx.pickup(); fx.sparkle(e.t.x + 0.3, e.t.y + 0.3); }
      else { sfx.gum(); fx.sparkle(e.t.x + 0.3, e.t.y + 0.3, 0xff8fc8); fx.popup('+1 plasterek', head, 'good'); say(pick(Q.gum), true); }
      break;
    case 'checkpoint': sfx.kiss(); fx.sparkle(e.t.cx, 1.4, 0xff4f7b); fx.popup('BUZIAK! ♥', head, 'good'); say(pick(Q.kiss), true); break;
    case 'lava': sfx.sizzle(); fx.flash('lava'); fx.emit(e.x, -0.3, 0, { count: 14, color: 0xffa040, speed: 3, up: 3, life: 0.7, size: 0.3, gravity: 8 }); break;
    case 'energyLow': say(pick(Q.low)); break;
    case 'bruiseFull': fx.popup('-1 plasterek (siniaki)', head, 'bad'); break;
    case 'standUp': say(pick(Q.stand)); break;
    case 'fail': startFail(e.kind); break;
    case 'won': win(); break;
    case 'hurt': onHurt(e); break;
  }
}

function onHurt(e) {
  const quips = CAUSE_QUIPS[e.cause] || Q.minor;
  if (e.level === 'minor') {
    sfx.ow();
    fx.popup('Ał!', head, 'small');
    if (Math.random() < 0.5) say(Math.random() < 0.5 ? pick(Q.minor) : pick(quips));
  } else if (e.level === 'medium') {
    sfx.bonk(); sfx.boing(0.8);
    fx.popup('AŁA!', head, 'hurt');
    fx.popup('-1 plasterek', head.clone().add(new THREE.Vector3(0, -0.4, 0)), 'bad');
    fx.shake(0.18, 0.25);
    fx.flash('hurt');
    domi.starT = 1.2;
    say(pick(quips), true);
  } else {
    sfx.drum(); sfx.slide();
    fx.popup(e.cause === 'edge' ? 'KANT!!' : 'BUM!!', head, 'crit');
    fx.popup(`-${e.n} plasterki`, head.clone().add(new THREE.Vector3(0, -0.5, 0)), 'bad');
    fx.shake(0.6, 0.5);
    fx.flash('crit');
    game.hitstop = 0.12;
    say(pick(e.cause === 'edge' ? Q.edgeCrit : quips), true);
  }
}

// ---------- kamera ----------
function updateCamera(dt, snap = false, rx = player.x, ry = player.y) {
  const k = snap ? 1 : 1 - Math.exp(-5 * dt);
  const lookT = THREE.MathUtils.clamp(player.vx * 0.35, -3, 3);
  game.look += (lookT - game.look) * (snap ? 1 : 1 - Math.exp(-2.5 * dt));
  game.camX += (rx + game.look - game.camX) * k;
  const ty = Math.max(0, ry) * 0.55 + 1.7;
  game.camY += (ty - game.camY) * (snap ? 1 : 1 - Math.exp(-3 * dt));
  const fovT = 42 + player.momentum * 7;
  game.fov += (fovT - game.fov) * (1 - Math.exp(-3 * dt));
  if (Math.abs(camera.fov - game.fov) > 0.01) { camera.fov = game.fov; camera.updateProjectionMatrix(); }
  const s = fx.shake2;
  camera.position.set(game.camX + s.x, game.camY + 0.9 + s.y, 10);
  camera.lookAt(game.camX + s.x * 0.5, game.camY + s.y * 0.5, 0);
  sun.position.set(player.x + 6, 14, 9);
  sun.target.position.set(player.x, 0, 0);
}

// ---------- pętla ----------
const clock = new THREE.Clock();
let acc = 0;

function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.05);
  game.t += dt;
  level.animate(game.t);

  const sim = game.mode === 'playing' || game.mode === 'failing' || game.mode === 'won' || game.mode === 'over';
  if (sim) {
    if (game.hitstop > 0) { game.hitstop -= dt; }
    else {
      acc += dt;
      while (acc >= CFG.step) {
        acc -= CFG.step;
        const inp = input.snapshot();
        input.clearEdges();
        if (game.mode !== 'playing') { inp.dir = 0; inp.jump = inp.roll = inp.cart = false; }
        level.update(CFG.step);
        if (game.mode === 'playing') game.time += CFG.step;
        player.step(CFG.step, inp);
        for (const e of player.drain()) handle(e);
      }
    }
    if (game.mode === 'failing') updateFail(dt);
    if (player.momentum > 0.55 && Math.abs(player.vx) > 7 && game.mode === 'playing') {
      fx.trail(player.x - Math.sign(player.vx) * 0.3, player.y + 0.6, player.momentum > 0.85 ? 0xff9ad5 : 0xffe08a);
    }
    if (game.mode === 'playing' || game.mode === 'failing') hud.update(player, game.time, level.candyTotal);
  } else {
    input.clearEdges();
  }

  // interpolacja między krokami fizyki = płynny obraz przy każdym odświeżaniu ekranu
  const a = sim && game.hitstop <= 0 ? acc / CFG.step : 1;
  const rx = player.prevX + (player.x - player.prevX) * a;
  const ry = player.prevY + (player.y - player.prevY) * a;
  if (player.skid && Math.random() < dt * 30) fx.dust(rx + Math.sign(player.vx) * 0.25, ry, 1, 0.7);

  domi.update(dt, player, rx, ry);
  domi.headWorld(head);
  fx.update(dt, head.clone().add(new THREE.Vector3(0, 0.40, 0)));
  updateCamera(dt, false, rx, ry);
  renderer.render(scene, camera);
}

// ---------- UI ----------
$('btn-start').addEventListener('click', startGame);
$('name-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') startGame(); });
$('btn-retry').addEventListener('click', restartLevel);
$('btn-again').addEventListener('click', restartLevel);
$('btn-resume').addEventListener('click', () => { game.mode = 'playing'; showScreen(null); });

input.onKey = (e) => {
  if (e.code === 'Backquote' || e.code === 'F2' || e.code === 'IntlBackslash') { e.preventDefault(); tuner.toggle(); }
  if (e.code === 'Escape' || e.code === 'KeyP') {
    if (game.mode === 'playing') { game.mode = 'paused'; showScreen('screen-pause'); }
    else if (game.mode === 'paused') { game.mode = 'playing'; showScreen(null); clock.getDelta(); }
  }
  if (e.code === 'KeyR' && (game.mode === 'playing' || game.mode === 'paused' || game.mode === 'over' || game.mode === 'won')) restartLevel();
  if (e.code === 'Enter' && (game.mode === 'over' || game.mode === 'won')) restartLevel();
  if (e.code === 'KeyM') { sfx.muted = !sfx.muted; if (sfx.muted && 'speechSynthesis' in window) speechSynthesis.cancel(); }
  if (e.code === 'KeyV') { sfx.voice = !sfx.voice; if (!sfx.voice && 'speechSynthesis' in window) speechSynthesis.cancel(); fx.say(sfx.voice ? 'Głos: włączony' : 'Głos: wyłączony', 1.2); }
};

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

updateCamera(0, true);
showScreen('screen-start');
$('name-input').focus();
frame();

// do debugowania z konsoli
window.BOING = { game, player, level, CFG, renderer, scene, camera, domi, fx, updateCamera, startGame, restartLevel };
