// Świat 1: Domowa Dżungla — Salon.
// Solidy: {x, y, w, h, kind: 'floor'|'wall'|'furniture'|'edge', slippery}
// 'edge' = KANT (stół, szafka) — uderzenie zależy od prędkości.
import * as THREE from 'three';
import { toon, outlineMat, TEX, noteTexture } from './textures.js';

const LEGO_COLORS = [0xe53935, 0xffd600, 0x1e88e5, 0x43a047, 0xffffff];
const CANDY_COLORS = [0xff5fa2, 0x5fd3ff, 0xffd84d, 0x9b7bff, 0x6be08f];

export function buildLevel(scene) {
  const L = {
    name: 'Domowa Dżungla — Salon',
    solids: [], triggers: [], robots: [], pickups: [], anim: [],
    start: { x: 1.5, y: 0 },
    group: new THREE.Group(),
  };
  scene.add(L.group);
  const G = L.group;

  // ---------- pomocnicze ----------
  function box(w, h, d, color, cx, cy, cz, o = {}) {
    const geo = new THREE.BoxGeometry(w, h, d);
    let map = o.map === null ? null : (o.map || TEX.crayon).clone();
    if (map) { map.needsUpdate = true; const rep = o.rep || 1.6; map.repeat.set(Math.max(1, w / rep), Math.max(1, h / rep)); }
    const m = new THREE.Mesh(geo, toon(color, map));
    m.position.set(cx, cy, cz);
    m.castShadow = o.cast !== false;
    m.receiveShadow = true;
    if (o.outline !== false) m.add(new THREE.Mesh(new THREE.BoxGeometry(w + 0.06, h + 0.06, d + 0.06), outlineMat));
    (o.parent || G).add(m);
    return m;
  }
  function cyl(r, h, color, x, y, z, o = {}) {
    const geo = new THREE.CylinderGeometry(o.r2 ?? r, r, h, o.seg || 14);
    const m = new THREE.Mesh(geo, toon(color));
    m.position.set(x, y, z);
    m.castShadow = true; m.receiveShadow = true;
    if (o.outline !== false) { const ol = new THREE.Mesh(geo, outlineMat); ol.scale.set(1 + 0.04 / r, 1 + 0.04 / h, 1 + 0.04 / r); m.add(ol); }
    (o.parent || G).add(m);
    return m;
  }
  const solid = (x, y, w, h, kind = 'furniture', extra = {}) => { const s = { x, y, w, h, kind, ...extra }; L.solids.push(s); return s; };
  const trig = (type, x, y, w, h, extra = {}) => { const t = { type, x, y, w, h, ...extra }; L.triggers.push(t); return t; };

  function sign(lines, x, y, { w = 2.4, rot = (Math.random() - 0.5) * 0.12, bg } = {}) {
    const tex = noteTexture(lines, bg ? { bg } : {});
    const h = w * (300 / 512);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, transparent: true }));
    m.position.set(x, y, -3.93); m.rotation.z = rot;
    G.add(m);
  }

  // ---------- ściana, podłoga, lawa ----------
  const X0 = -12, X1 = 165;
  {
    const tex = TEX.wall.clone(); tex.needsUpdate = true; tex.repeat.set((X1 - X0) / 6, 13 / 6);
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(X1 - X0, 13), toon(0xffffff, tex));
    wall.position.set((X0 + X1) / 2, 3.5, -4); wall.receiveShadow = true;
    G.add(wall);
  }
  function floor(x0, x1, slippery = false) {
    const w = x1 - x0;
    solid(x0, -3, w, 3, 'floor', { slippery });
    box(w, 3, 8, slippery ? 0xb98a58 : 0xa8774a, x0 + w / 2, -1.5, 0, { rep: 3, cast: false });
    const tex = (slippery ? TEX.woodShiny : TEX.wood).clone(); tex.needsUpdate = true; tex.repeat.set(w / 4, 2);
    const top = new THREE.Mesh(new THREE.PlaneGeometry(w, 8), toon(0xffffff, tex));
    top.rotation.x = -Math.PI / 2; top.position.set(x0 + w / 2, 0.002, 0); top.receiveShadow = true;
    G.add(top);
    box(w, 0.25, 0.12, 0xffffff, x0 + w / 2, 0.125, -3.94, { cast: false }); // listwa
    if (slippery) {
      for (let x = x0 + 0.8; x < x1; x += 1.7) {
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.dot, color: 0xffffff, transparent: true, depthWrite: false }));
        sp.position.set(x, 0.08, (Math.random() - 0.5) * 3); sp.scale.setScalar(0.25);
        G.add(sp);
        L.anim.push((t) => { sp.material.opacity = 0.3 + 0.7 * Math.max(0, Math.sin(t * 3 + x)); });
      }
    }
  }
  function lava(x0, x1) {
    const w = x1 - x0;
    const tex = TEX.lava.clone(); tex.needsUpdate = true; tex.repeat.set(w / 3, 8 / 3);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, 8), new THREE.MeshBasicMaterial({ map: tex }));
    m.rotation.x = -Math.PI / 2; m.position.set(x0 + w / 2, -0.35, 0);
    G.add(m);
    L.anim.push((t) => { tex.offset.set(t * 0.05, Math.sin(t * 0.7) * 0.1); });
    // bąble
    for (let i = 0; i < Math.ceil(w / 1.5); i++) {
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffd23f }));
      const bx = x0 + 0.4 + Math.random() * (w - 0.8), bz = (Math.random() - 0.5) * 5, off = Math.random() * 10;
      G.add(b);
      L.anim.push((t) => {
        const p = ((t + off) % 1.6) / 1.6;
        b.position.set(bx, -0.38 + p * 0.25, bz);
        b.scale.setScalar(0.3 + p * 1.2);
        b.visible = p < 0.95;
      });
    }
    trig('lava', x0, -10, w, 9.95);
  }
  function cushion(x, w, top, color) {
    solid(x, -1, w, top + 1, 'furniture');
    box(w, top + 1, 1.8, color, x + w / 2, (top - 1) / 2, 0);
    const btn = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), toon(0xffffff));
    btn.position.set(x + w / 2, top + 0.02, 0.2); btn.scale.y = 0.4; G.add(btn);
  }

  // ---------- meble ----------
  function table(x, w, { top = 1.0, thick = 0.18, color = 0xc08552, d = 2.4, things = true } = {}) {
    solid(x, top, w, thick, 'edge', { name: 'stół' });
    box(w, thick, d, color, x + w / 2, top + thick / 2, 0, { rep: 1.2 });
    for (const lx of [x + 0.25, x + w - 0.25]) for (const lz of [-d / 2 + 0.25, d / 2 - 0.25]) cyl(0.08, top, 0x8d5a34, lx, top / 2, lz, { r2: 0.09 });
    if (things) {
      cyl(0.32, 0.04, 0xffffff, x + w * 0.3, top + thick + 0.02, -0.5, { seg: 20 }); // talerz
      cyl(0.11, 0.24, 0x7fc8f8, x + w * 0.6, top + thick + 0.12, -0.7); // kubek
    }
  }
  function sofa(x, w) {
    const arm = 0.6, seat = 0.85, armH = 1.25, col = 0x8fc9b0, dark = 0x6fae95;
    solid(x, 0, arm, armH); solid(x + w - arm, 0, arm, armH); solid(x + arm, 0, w - 2 * arm, seat);
    box(w - 2 * arm, 0.6, 2, dark, x + w / 2, 0.3, 0);
    const cw = (w - 2 * arm) / 2;
    box(cw - 0.04, 0.25, 2, col, x + arm + cw / 2, 0.725, 0);
    box(cw - 0.04, 0.25, 2, col, x + arm + cw * 1.5, 0.725, 0);
    box(arm, armH, 2.2, col, x + arm / 2, armH / 2, 0);
    box(arm, armH, 2.2, col, x + w - arm / 2, armH / 2, 0);
    box(w, 1.9, 0.6, dark, x + w / 2, 0.95, -1.3);
    box(cw, 0.8, 0.3, col, x + arm + cw / 2, 1.3, -0.9).rotation.x = -0.15;
    box(cw, 0.8, 0.3, col, x + arm + cw * 1.5, 1.3, -0.9).rotation.x = -0.15;
    // pluszowy miś na oparciu
    const bear = new THREE.Group(); bear.position.set(x + w - 1.3, 1.95, -1.2); G.add(bear);
    const bc = 0xc98b5a;
    const s = (r, px, py, pz) => { const m = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 10), toon(bc)); m.position.set(px, py, pz); const o = new THREE.Mesh(m.geometry, outlineMat); o.scale.setScalar(1.1); m.add(o); bear.add(m); };
    s(0.28, 0, 0, 0); s(0.2, 0, 0.38, 0); s(0.08, -0.13, 0.55, 0); s(0.08, 0.13, 0.55, 0);
  }
  function cabinet(x, w, bottom = 0.72, top = 3.2) {
    solid(x, bottom, w, top - bottom, 'edge', { name: 'szafka' });
    box(w, top - bottom, 1.6, 0xa9cde8, x + w / 2, (top + bottom) / 2, -0.2);
    for (const lx of [x + 0.2, x + w - 0.2]) cyl(0.06, bottom, 0x7a9bb5, lx, bottom / 2, 0.45, { r2: 0.05 });
    for (const lx of [x + 0.2, x + w - 0.2]) cyl(0.06, bottom, 0x7a9bb5, lx, bottom / 2, -0.85, { r2: 0.05 });
    const n = Math.round(w / 1.5);
    for (let i = 0; i < n; i++) {
      const dx = x + (i + 0.5) * (w / n);
      box(w / n - 0.12, (top - bottom) / 2 - 0.15, 0.04, 0xc4def0, dx, bottom + (top - bottom) * 0.25, 0.62, { outline: true });
      box(w / n - 0.12, (top - bottom) / 2 - 0.15, 0.04, 0xc4def0, dx, bottom + (top - bottom) * 0.75, 0.62, { outline: true });
      cyl(0.06, 0.06, 0xffd27a, dx, bottom + (top - bottom) * 0.5, 0.68).rotation.x = Math.PI / 2;
    }
    let bx = x + 0.2;
    while (bx < x + w - 0.3) {
      const bw = 0.15 + Math.random() * 0.15, bh = 0.4 + Math.random() * 0.35;
      box(bw, bh, 0.5, [0xe57373, 0x64b5f6, 0xffd54f, 0x81c784, 0xba68c8][Math.floor(Math.random() * 5)], bx + bw / 2, top + bh / 2, -0.5);
      bx += bw + 0.03;
    }
  }
  function legos(x0, x1, count) {
    trig('lego', x0, 0, x1 - x0, 0.2);
    for (let i = 0; i < count; i++) {
      const g = new THREE.Group();
      const col = LEGO_COLORS[i % LEGO_COLORS.length];
      const studs = Math.random() < 0.5 ? 2 : 4;
      const bw = studs === 2 ? 0.16 : 0.3;
      box(bw, 0.1, 0.15, col, 0, 0.05, 0, { parent: g, map: null });
      for (let s = 0; s < studs / 2; s++) for (const z of [-0.035, 0.035]) {
        const st = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.04, 8), toon(col, null));
        st.position.set(-bw / 2 + 0.075 * (s + 0.5) * (studs === 2 ? 2 : 1), 0.12, z); g.add(st);
      }
      g.position.set(x0 + 0.1 + Math.random() * (x1 - x0 - 0.2), 0, (Math.random() - 0.5) * 1.6);
      g.rotation.y = Math.random() * Math.PI;
      if (Math.random() < 0.3) { g.rotation.z = 0.5; g.position.y = 0.04; }
      G.add(g);
    }
  }
  function rug(x0, x1) {
    const tex = TEX.rug.clone(); tex.needsUpdate = true; tex.repeat.set((x1 - x0) / 3, 1);
    box(x1 - x0, 0.05, 3.2, 0xffffff, (x0 + x1) / 2, 0.025, 0, { map: tex, cast: false, outline: false });
    trig('trip', x0 - 0.1, 0, 0.35, 0.3);
    // frędzle
    for (let z = -1.5; z <= 1.5; z += 0.2) box(0.18, 0.02, 0.03, 0xfff3c4, x0 - 0.09, 0.012, z, { outline: false, cast: false });
  }
  function plant(x) {
    solid(x - 0.4, 0, 0.8, 0.6);
    cyl(0.42, 0.6, 0xe07a4f, x, 0.3, 0, { r2: 0.34 });
    trig('leaves', x - 1.2, 0.5, 2.4, 1.7);
    for (let i = 0; i < 9; i++) {
      const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.35, 10, 8), toon(i % 2 ? 0x5cbf6a : 0x4aa85a));
      const a = -1.2 + (i / 8) * 2.4;
      leaf.scale.set(0.35, 1.25, 0.6);
      leaf.position.set(x + Math.sin(a) * 0.6, 0.9 + Math.cos(a) * 0.7, (Math.random() - 0.5) * 0.8);
      leaf.rotation.z = -a;
      const o = new THREE.Mesh(leaf.geometry, outlineMat); o.scale.setScalar(1.1); leaf.add(o);
      leaf.castShadow = true;
      G.add(leaf);
      const ph = Math.random() * 6;
      L.anim.push((t) => { leaf.rotation.z = -a + Math.sin(t * 1.5 + ph) * 0.05; });
    }
  }
  function robot(x0, x1, speed = 1.8) {
    const r = { x: x0 + 1, y: 0, w: 0.85, h: 0.26, x0, x1, speed, dir: 1, turnT: 2 + Math.random() * 3, home: x0 + 1 };
    const g = new THREE.Group(); G.add(g);
    cyl(0.43, 0.2, 0x5a5a6e, 0, 0.1, 0, { parent: g, seg: 24 });
    cyl(0.36, 0.04, 0x8d8da3, 0, 0.22, 0, { parent: g, seg: 24, outline: false });
    const led = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), new THREE.MeshBasicMaterial({ color: 0x55ff88 }));
    led.position.set(0.25, 0.22, 0.1); g.add(led);
    for (const z of [-0.12, 0.12]) { // naklejone oczka
      const e = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), toon(0xffffff, null)); e.scale.y = 0.4; e.position.set(0.05, 0.24, z + 0.1); g.add(e);
      const p = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), toon(0x222222, null)); p.scale.y = 0.4; p.position.set(0.08, 0.26, z + 0.1); g.add(p);
    }
    const brush = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.02, 8), toon(0xffd27a, null));
    brush.position.set(0.32, 0.02, 0.32); g.add(brush);
    r.mesh = g; r.brush = brush; r.led = led;
    L.robots.push(r);
  }
  function pickup(type, x, y) {
    const g = new THREE.Group(); g.position.set(x, y, 0); G.add(g);
    if (type === 'candy') {
      const col = CANDY_COLORS[L.pickups.length % CANDY_COLORS.length];
      const c = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 10), toon(col, null)); c.scale.set(1.35, 1, 1); g.add(c);
      const o = new THREE.Mesh(c.geometry, outlineMat); o.scale.setScalar(1.12); c.add(o);
      for (const s of [-1, 1]) {
        const w = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.16, 8), toon(0xffffff, null));
        w.rotation.z = s * Math.PI / 2; w.position.x = s * 0.24; g.add(w);
      }
    } else if (type === 'gum') {
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.26, 16, 12), toon(0xff8fc8, null, { transparent: true, opacity: 0.9 })); g.add(b);
      const o = new THREE.Mesh(b.geometry, outlineMat); o.scale.setScalar(1.08); b.add(o);
      const w = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.12, 0.05), toon(0x5fd3ff, null)); w.position.set(0, -0.3, 0.05); g.add(w);
    }
    const t = trig(type, x - 0.3, y - 0.3, 0.6, 0.6, { mesh: g });
    L.pickups.push(t);
    const ph = Math.random() * 6;
    L.anim.push((tm) => {
      g.visible = !t.off;
      g.rotation.y = tm * 2 + ph;
      g.position.y = y + Math.sin(tm * 3 + ph) * 0.08;
    });
  }
  function kiss(x) {
    const s = new THREE.Shape();
    s.moveTo(0, 0.5);
    s.bezierCurveTo(0, 0.8, -0.5, 1.0, -0.8, 0.7);
    s.bezierCurveTo(-1.1, 0.4, -0.9, 0, 0, -0.7);
    s.bezierCurveTo(0.9, 0, 1.1, 0.4, 0.8, 0.7);
    s.bezierCurveTo(0.5, 1.0, 0, 0.8, 0, 0.5);
    const geo = new THREE.ExtrudeGeometry(s, { depth: 0.3, bevelEnabled: true, bevelSize: 0.08, bevelThickness: 0.08, bevelSegments: 3 });
    geo.center();
    const mat = toon(0xff4f7b, null, { emissive: 0x661020 });
    const m = new THREE.Mesh(geo, mat); m.scale.setScalar(0.38);
    const o = new THREE.Mesh(geo, outlineMat); o.scale.setScalar(1.08); m.add(o);
    const g = new THREE.Group(); g.add(m); g.position.set(x, 1.4, 0); G.add(g);
    const t = trig('kiss', x - 0.6, 0, 1.2, 2.4, { cx: x, groundY: 0, mesh: g, mat });
    sign(['Buziak od Mamy', '= checkpoint ♥'], x, 4.4, { w: 2, bg: '#ffd0dc' });
    L.anim.push((tm) => {
      g.rotation.y = Math.sin(tm * 2) * 0.6;
      g.position.y = 1.4 + Math.sin(tm * 2.5) * 0.12;
      const sc = t.used ? 0.6 : 1 + Math.sin(tm * 6) * 0.06;
      g.scale.setScalar(sc);
      mat.color.setHex(t.used ? 0xffb3c6 : 0xff4f7b);
    });
  }
  function frame(x, y, idx, w = 1.6, h = 1.6) {
    box(w + 0.2, h + 0.2, 0.08, 0xf2c14e, x, y, -3.93, { cast: false });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: TEX.drawings[idx] }));
    m.position.set(x, y, -3.88); G.add(m);
  }
  function windowDecor(x, y) {
    box(3.2, 2.6, 0.1, 0xffffff, x, y, -3.94, { cast: false });
    const sky = new THREE.Mesh(new THREE.PlaneGeometry(2.9, 2.3), new THREE.MeshBasicMaterial({ color: 0xbfe6ff }));
    sky.position.set(x, y, -3.88); G.add(sky);
    const sun = new THREE.Mesh(new THREE.CircleGeometry(0.35, 16), new THREE.MeshBasicMaterial({ color: 0xffe27a }));
    sun.position.set(x + 0.8, y + 0.6, -3.87); G.add(sun);
    box(0.08, 2.3, 0.06, 0xffffff, x, y, -3.86, { outline: false, cast: false });
    box(2.9, 0.08, 0.06, 0xffffff, x, y, -3.86, { outline: false, cast: false });
    box(0.7, 3.0, 0.08, 0xff9eb5, x - 1.75, y - 0.1, -3.8, { cast: false });
    box(0.7, 3.0, 0.08, 0xff9eb5, x + 1.75, y - 0.1, -3.8, { cast: false });
  }
  function door(x) {
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 3.4), new THREE.MeshBasicMaterial({ color: 0xffe9a8 }));
    glow.position.set(x, 1.7, -3.92); G.add(glow);
    box(0.25, 3.6, 0.3, 0xffffff, x - 1.1, 1.8, -3.85);
    box(0.25, 3.6, 0.3, 0xffffff, x + 1.1, 1.8, -3.85);
    box(2.45, 0.25, 0.3, 0xffffff, x, 3.6, -3.85);
    const d = box(1.9, 3.35, 0.1, 0xf7c873, 0.95, 1.675, 0);
    const pivot = new THREE.Group(); pivot.position.set(x - 0.95, 0, -3.9); pivot.rotation.y = -1.1; G.add(pivot);
    pivot.add(d);
    sign(['KUCHNIA', 'obiad! →'], x, 4.6, { w: 2.4, bg: '#c8f2c2', rot: 0.03 });
    box(2.4, 0.04, 1.8, 0x9ad49a, x, 0.02, -1.5, { cast: false });
    trig('finish', x - 0.6, 0, 1.2, 3);
    // drugi koniec — ściana
  }

  // ---------- UKŁAD POZIOMU ----------
  solid(-3, 0, 1, 12, 'wall');
  box(1, 12, 8, 0xf5e3c8, -2.5, 6, 0, { cast: false });

  floor(-3, 35);
  lava(35, 43);
  floor(43, 58);
  floor(58, 70, true);
  floor(70, 84);
  lava(84, 96);
  floor(96, 160);
  solid(152, 0, 1, 12, 'wall');
  box(1, 12, 8, 0xf5e3c8, 152.5, 6, 0, { cast: false });

  // samouczek na ścianie
  sign(['ENERGIA spada!', 'Rób akrobacje,', 'żeby nie zasnąć z nudów!'], 1.5, 3.4, { w: 2.8, bg: '#ffd27a' });
  sign(['← → / A D', 'bieg'], 5, 3.2);
  sign(['SPACJA = skok', 'w powietrzu: SALTO!'], 8.5, 3.6);
  sign(['SHIFT = gwiazda', '(szybki zryw)'], 12.5, 3.2);
  sign(['S / ↓ = fikołek', 'pod stołem się mieścisz!'], 17, 3.6);
  sign(['LEGO = AŁA!', 'przeskocz!'], 28.8, 3.2, { bg: '#ffc4c4' });
  sign(['PODŁOGA', 'TO LAWA!'], 39, 3.8, { bg: '#ffb08a' });
  sign(['Panele świeżo', 'wypastowane!', '— Mama'], 63, 3.6, { bg: '#d8f0ff' });
  sign(['PODŁOGA TO LAWA', '(znowu)'], 90, 3.9, { bg: '#ffb08a' });
  sign(['Pod szafką tylko', 'FIKOŁKIEM!'], 102.6, 3.3);

  // dekoracje
  frame(9.5, 5.2, 0); windowDecor(26, 5); frame(52, 5.4, 1); frame(66, 5.0, 2, 1.4, 1.4);
  windowDecor(100, 5); frame(122, 5.3, 1); frame(140, 5.4, 0);

  // 1. rozbieg
  rug(10.5, 16);
  pickup('candy', 5, 0.5); pickup('candy', 6.5, 1.6); pickup('candy', 8, 2.3); pickup('candy', 13.5, 1.5);
  // 2. stół nr 1 — kant na wysokości głowy
  table(19, 6);
  pickup('candy', 21.5, 0.35); pickup('candy', 22.7, 0.35); pickup('candy', 22, 1.75);
  // 3. LEGO
  legos(28.4, 30, 7);
  pickup('candy', 29.2, 1.9);
  // 4. buziak + lawa z poduszką
  kiss(32.5);
  cushion(37.6, 2, 0.45, 0xffb3c6);
  pickup('candy', 38.6, 1.5); pickup('candy', 41.2, 2.1);
  // 5. kanapa
  sofa(47, 8);
  pickup('gum', 51, 1.35); pickup('candy', 49, 1.5); pickup('candy', 53, 1.5);
  // 6. śliskie panele + robot + stół nr 2 tuż za nimi
  robot(58.5, 69.5, 2.2);
  pickup('candy', 60, 0.6); pickup('candy', 63, 0.6); pickup('candy', 66, 0.6);
  table(72, 6);
  pickup('candy', 74, 1.6); pickup('candy', 76, 1.6);
  // 7. buziak + długa lawa z dwiema poduszkami
  kiss(81);
  cushion(86.8, 1.6, 0.5, 0xb3d9ff);
  cushion(91.2, 1.6, 0.7, 0xc9f2b3);
  pickup('candy', 87.6, 1.4); pickup('gum', 89.9, 2.7); pickup('candy', 92, 1.7);
  // 8. kwiatek + szafka (tylko fikołkiem)
  plant(100);
  cabinet(105, 6);
  pickup('candy', 107, 0.3); pickup('candy', 109, 0.3);
  kiss(113);
  // 9. pole LEGO + robot
  legos(116, 117, 5); legos(119.6, 120.6, 5); legos(124, 125.2, 6); legos(128.3, 129.3, 5);
  robot(115.5, 131, 2.6);
  pickup('candy', 118.3, 1.8); pickup('candy', 122.3, 1.8); pickup('candy', 126.7, 1.8); pickup('candy', 130.5, 1.4);
  // 10. ława + drzwi do kuchni
  table(134, 6, { top: 0.85, thick: 0.15, color: 0xd9a066, d: 1.8, things: false });
  pickup('candy', 137, 0.3); pickup('candy', 141.5, 0.6);
  door(147);

  L.candyTotal = L.pickups.filter((p) => p.type === 'candy').length;

  // ---------- aktualizacja ----------
  L.update = (dt) => {
    for (const r of L.robots) {
      r.turnT -= dt;
      if (r.turnT <= 0) { r.dir *= -1; r.turnT = 1.5 + Math.random() * 3.5; } // zmienia trasę!
      r.x += r.dir * r.speed * dt;
      if (r.x < r.x0) { r.x = r.x0; r.dir = 1; }
      if (r.x + r.w > r.x1) { r.x = r.x1 - r.w; r.dir = -1; }
    }
  };
  L.animate = (t) => {
    for (const f of L.anim) f(t);
    for (const r of L.robots) {
      r.mesh.position.set(r.x + r.w / 2, 0, 0);
      r.mesh.rotation.y = r.dir > 0 ? 0 : Math.PI;
      r.brush.rotation.y = t * 20;
      r.led.visible = Math.floor(t * 3) % 2 === 0;
    }
  };
  L.reset = () => {
    for (const t of L.triggers) { t.off = false; t.used = false; }
    for (const r of L.robots) { r.x = r.home; r.dir = 1; }
  };
  return L;
}
