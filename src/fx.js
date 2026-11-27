// Cząsteczki, komiksowe napisy, dymki, trzęsienie ekranu.
import * as THREE from 'three';
import { TEX } from './textures.js';

const v = new THREE.Vector3();

export class Fx {
  constructor(scene, camera) {
    this.camera = camera;
    this.layer = document.getElementById('labels');
    this.parts = [];
    for (let i = 0; i < 180; i++) {
      const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.dot, transparent: true, depthWrite: false }));
      m.visible = false;
      scene.add(m);
      this.parts.push({ m, life: 0, max: 1, vx: 0, vy: 0, vz: 0, g: 0, s0: 1, s1: 0 });
    }
    this.idx = 0;
    this.labels = [];
    this.shakeA = 0; this.shakeT = 0; this.shakeD = 1;
    this.shake2 = new THREE.Vector2();
    this.bubble = document.createElement('div');
    this.bubble.className = 'bubble';
    this.layer.appendChild(this.bubble);
    this.bubbleT = 0;
    this.flashEl = document.getElementById('flash');
  }

  emit(x, y, z, { count = 6, color = 0xffffff, speed = 2, up = 0, life = 0.5, size = 0.3, endSize, gravity = 0, spreadZ = 0.3, dir = 0 } = {}) {
    for (let i = 0; i < count; i++) {
      const p = this.parts[this.idx++ % this.parts.length];
      const a = Math.random() * Math.PI * 2;
      p.m.position.set(x, y, z + (Math.random() - 0.5) * spreadZ);
      p.vx = Math.cos(a) * speed * Math.random() + dir;
      p.vy = Math.abs(Math.sin(a)) * speed * Math.random() + up;
      p.vz = (Math.random() - 0.5) * speed * 0.5;
      p.g = gravity; p.life = p.max = life * (0.7 + Math.random() * 0.6);
      p.s0 = size; p.s1 = endSize ?? size * 0.2;
      p.m.material.color.setHex(color);
      p.m.visible = true;
    }
  }
  dust(x, y, n = 6, k = 1) { this.emit(x, y + 0.08, 0.3, { count: n, color: 0xfff3dc, speed: 1.8 * k, up: 0.4, life: 0.45, size: 0.3, endSize: 0.6, gravity: -1 }); }
  sparkle(x, y, color = 0xffe14d) { this.emit(x, y, 0.2, { count: 10, color, speed: 3, up: 1, life: 0.5, size: 0.22, gravity: 4 }); }
  tear(x, y) { this.emit(x, y, 0.4, { count: 1, color: 0x6ec6ff, speed: 1.8, up: 1.5, life: 0.7, size: 0.13, endSize: 0.1, gravity: 9 }); }
  trail(x, y, color) { this.emit(x, y, -0.1, { count: 1, color, speed: 0.2, life: 0.35, size: 0.45, endSize: 0.05, spreadZ: 0 }); }

  popup(text, pos, cls = '', life = 1.1) {
    const el = document.createElement('div');
    el.className = 'popup ' + cls;
    el.textContent = text;
    el.style.setProperty('--rot', ((Math.random() - 0.5) * 16).toFixed(1) + 'deg');
    this.layer.appendChild(el);
    this.labels.push({ el, pos: pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.6, 0.2, 0)), life, max: life });
  }

  say(text, dur = 2) {
    this.bubble.textContent = text;
    this.bubble.classList.remove('show');
    void this.bubble.offsetWidth;
    this.bubble.classList.add('show');
    this.bubbleT = dur;
  }

  shake(a, d = 0.3) { if (a >= this.shakeA * (this.shakeT / this.shakeD || 0)) { this.shakeA = a; this.shakeT = this.shakeD = d; } }
  flash(cls) {
    this.flashEl.className = '';
    void this.flashEl.offsetWidth;
    this.flashEl.className = 'on ' + cls;
  }

  toScreen(p) {
    v.copy(p).project(this.camera);
    return [(v.x + 1) / 2 * innerWidth, (1 - v.y) / 2 * innerHeight];
  }

  update(dt, headPos) {
    for (const p of this.parts) {
      if (!p.m.visible) continue;
      p.life -= dt;
      if (p.life <= 0) { p.m.visible = false; continue; }
      p.vy -= p.g * dt;
      p.m.position.x += p.vx * dt; p.m.position.y += p.vy * dt; p.m.position.z += p.vz * dt;
      const k = 1 - p.life / p.max;
      p.m.scale.setScalar(p.s0 + (p.s1 - p.s0) * k);
      p.m.material.opacity = Math.min(1, (1 - k) * 1.6);
    }
    for (let i = this.labels.length - 1; i >= 0; i--) {
      const l = this.labels[i];
      l.life -= dt;
      if (l.life <= 0) { l.el.remove(); this.labels.splice(i, 1); continue; }
      l.pos.y += dt * 0.8;
      const [x, y] = this.toScreen(l.pos);
      l.el.style.left = x + 'px'; l.el.style.top = y + 'px';
    }
    this.bubbleT -= dt;
    if (this.bubbleT <= 0) this.bubble.classList.remove('show');
    if (headPos) {
      const [x, y] = this.toScreen(headPos);
      this.bubble.style.left = x + 'px'; this.bubble.style.top = y + 'px';
    }
    if (this.shakeT > 0) {
      this.shakeT -= dt;
      const a = this.shakeA * Math.max(0, this.shakeT / this.shakeD);
      this.shake2.set((Math.random() - 0.5) * 2 * a, (Math.random() - 0.5) * 2 * a);
    } else this.shake2.set(0, 0);
  }

  clear() {
    for (const l of this.labels) l.el.remove();
    this.labels.length = 0;
    this.bubble.classList.remove('show');
    for (const p of this.parts) p.m.visible = false;
  }
}
