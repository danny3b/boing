// Proceduralne tekstury "rysowane kredkami" + materiały toon.
import * as THREE from 'three';

export const TEX = {};
export const outlineMat = new THREE.MeshBasicMaterial({ color: 0x3d2c3a, side: THREE.BackSide });
let gradientMap = null;

function rng(seed) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

function makeCanvas(w, h = w) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}

// Kreskowanie kredką, kafelkowane (kreski przechodzące przez krawędź rysujemy z przesunięciem).
function hatch(g, W, H, r, { count, colors, alpha = 0.3, angle = -0.8, jitter = 0.3, len = [6, 26], width = [1, 3] }) {
  g.lineCap = 'round';
  for (let i = 0; i < count; i++) {
    const x = r() * W, y = r() * H;
    const l = len[0] + r() * (len[1] - len[0]);
    const a = angle + (r() - 0.5) * jitter * 2;
    const dx = Math.cos(a) * l, dy = Math.sin(a) * l;
    g.strokeStyle = colors[Math.floor(r() * colors.length)];
    g.globalAlpha = alpha * (0.4 + r() * 0.8);
    g.lineWidth = width[0] + r() * (width[1] - width[0]);
    const inside = Math.min(x, x + dx) > 0 && Math.max(x, x + dx) < W && Math.min(y, y + dy) > 0 && Math.max(y, y + dy) < H;
    const offs = inside ? [[0, 0]] : [[-W, -H], [0, -H], [W, -H], [-W, 0], [0, 0], [W, 0], [-W, H], [0, H], [W, H]];
    for (const [ox, oy] of offs) {
      g.beginPath();
      g.moveTo(x + ox, y + oy);
      g.lineTo(x + ox + dx, y + oy + dy);
      g.stroke();
    }
  }
  g.globalAlpha = 1;
}

function grain(g, W, H, amt, r) {
  const img = g.getImageData(0, 0, W, H);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (r() - 0.5) * amt;
    d[i] += n; d[i + 1] += n; d[i + 2] += n;
  }
  g.putImageData(img, 0, 0);
}

// Linia "drżącej ręki".
function wobblyLine(g, x0, y0, x1, y1, r, amp = 2) {
  const steps = 12;
  g.beginPath();
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = x0 + (x1 - x0) * t + (r() - 0.5) * amp;
    const y = y0 + (y1 - y0) * t + (r() - 0.5) * amp;
    i ? g.lineTo(x, y) : g.moveTo(x, y);
  }
  g.stroke();
}

function toTexture(c) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

export function initTextures() {
  // gradient dla cieniowania toon (3 tony)
  gradientMap = new THREE.DataTexture(new Uint8Array([110, 190, 255]), 3, 1, THREE.RedFormat);
  gradientMap.minFilter = gradientMap.magFilter = THREE.NearestFilter;
  gradientMap.needsUpdate = true;

  // uniwersalna "kredka" — biała baza, którą barwimy kolorem materiału
  {
    const S = 256, [c, g] = makeCanvas(S), r = rng(7);
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, S, S);
    hatch(g, S, S, r, { count: 1500, colors: ['#bdb2a8', '#d9cfc6', '#ffffff'], alpha: 0.42 });
    grain(g, S, S, 16, r);
    TEX.crayon = toTexture(c);
  }

  // tapeta
  {
    const W = 512, [c, g] = makeCanvas(W), r = rng(11);
    g.fillStyle = '#fdf0d6'; g.fillRect(0, 0, W, W);
    hatch(g, W, W, r, { count: 2500, colors: ['#f3dfbd', '#fff8e8'], alpha: 0.5, len: [8, 30] });
    g.lineCap = 'round';
    for (let x = 32; x < W; x += 128) {
      g.strokeStyle = '#f5b3c0'; g.globalAlpha = 0.55; g.lineWidth = 14;
      wobblyLine(g, x, -10, x + (r() - 0.5) * 6, W + 10, r, 3);
      g.strokeStyle = '#f9cfd7'; g.lineWidth = 4;
      wobblyLine(g, x + 16, -10, x + 16, W + 10, r, 2);
    }
    g.globalAlpha = 0.75;
    for (let i = 0; i < 10; i++) {
      const fx = 96 + Math.floor(r() * 4) * 128 + (r() - 0.5) * 20, fy = r() * W;
      const col = ['#a8d5e2', '#c6b5f0', '#ffd27a'][i % 3];
      for (let p = 0; p < 5; p++) {
        const a = (p / 5) * Math.PI * 2;
        g.fillStyle = col;
        g.beginPath(); g.arc(fx + Math.cos(a) * 9, fy + Math.sin(a) * 9, 7, 0, Math.PI * 2); g.fill();
      }
      g.fillStyle = '#ffb35c'; g.beginPath(); g.arc(fx, fy, 5, 0, Math.PI * 2); g.fill();
    }
    g.globalAlpha = 1;
    grain(g, W, W, 12, r);
    TEX.wall = toTexture(c);
  }

  // panele
  const wood = (base, line, grainCol, shiny, seed) => {
    const W = 512, H = 256, [c, g] = makeCanvas(W, H), r = rng(seed);
    g.fillStyle = base; g.fillRect(0, 0, W, H);
    hatch(g, W, H, r, { count: 1600, colors: [grainCol, base], alpha: 0.5, angle: 0, jitter: 0.04, len: [20, 70], width: [1, 2.5] });
    g.strokeStyle = line; g.lineWidth = 3; g.globalAlpha = 0.8;
    for (let y = 0; y <= H; y += 64) {
      wobblyLine(g, -5, y, W + 5, y, r, 1.5);
      const jx = r() * W;
      wobblyLine(g, jx, y, jx, y + 64, r, 1);
    }
    g.globalAlpha = 1;
    if (shiny) {
      g.strokeStyle = '#ffffff'; g.lineCap = 'round';
      for (let i = 0; i < 26; i++) {
        const x = r() * W, y = r() * H;
        g.globalAlpha = 0.35 + r() * 0.4; g.lineWidth = 2 + r() * 5;
        g.beginPath(); g.moveTo(x, y); g.lineTo(x + 30 + r() * 40, y - 12 - r() * 20); g.stroke();
      }
      g.globalAlpha = 1;
    }
    grain(g, W, H, 14, r);
    return toTexture(c);
  };
  TEX.wood = wood('#e4b47c', '#a8703f', '#c99359', false, 21);
  TEX.woodShiny = wood('#f6dcaa', '#c89a62', '#e6c48c', true, 22);

  // lawa
  {
    const S = 256, [c, g] = makeCanvas(S), r = rng(31);
    g.fillStyle = '#ff7a2f'; g.fillRect(0, 0, S, S);
    g.lineCap = 'round';
    for (let i = 0; i < 70; i++) {
      g.strokeStyle = r() < 0.55 ? '#ffd23f' : '#e5332a';
      g.globalAlpha = 0.6; g.lineWidth = 3 + r() * 5;
      const x = r() * S, y = r() * S, rad = 6 + r() * 18;
      g.beginPath(); g.arc(x, y, rad, r() * 6, r() * 6 + 3 + r() * 3); g.stroke();
    }
    g.globalAlpha = 1;
    grain(g, S, S, 20, r);
    TEX.lava = toTexture(c);
  }

  // dywan w paski
  {
    const S = 256, [c, g] = makeCanvas(S), r = rng(41);
    const cols = ['#e86f6f', '#ffd27a', '#7fb7e8', '#9ad49a'];
    for (let i = 0; i < 8; i++) { g.fillStyle = cols[i % 4]; g.fillRect(i * 32, 0, 32, S); }
    g.strokeStyle = '#ffffff'; g.lineWidth = 4; g.globalAlpha = 0.7;
    for (let x = 16; x < S; x += 32) for (let y = 0; y < S; y += 24) {
      g.beginPath(); g.moveTo(x - 8, y); g.lineTo(x, y + 12); g.lineTo(x + 8, y); g.stroke();
    }
    g.globalAlpha = 1;
    hatch(g, S, S, r, { count: 900, colors: ['#ffffff', '#000000'], alpha: 0.12 });
    TEX.rug = toTexture(c);
  }

  // dziecięce rysunki w ramkach
  TEX.drawings = [0, 1, 2].map((k) => {
    const S = 256, [c, g] = makeCanvas(S), r = rng(50 + k);
    g.fillStyle = '#fffdf6'; g.fillRect(0, 0, S, S);
    g.lineCap = 'round'; g.lineJoin = 'round';
    g.lineWidth = 6;
    // słońce
    g.strokeStyle = '#ffb000';
    g.beginPath(); g.arc(200, 55, 26, 0, Math.PI * 2); g.stroke();
    for (let i = 0; i < 9; i++) { const a = i * 0.7; wobblyLine(g, 200 + Math.cos(a) * 34, 55 + Math.sin(a) * 34, 200 + Math.cos(a) * 50, 55 + Math.sin(a) * 50, r, 2); }
    g.strokeStyle = '#4caf50';
    wobblyLine(g, 0, 220, S, 215, r, 4);
    if (k === 0) { // dom
      g.strokeStyle = '#e53935'; g.strokeRect(60, 130, 90, 85);
      wobblyLine(g, 50, 132, 105, 80, r, 2); wobblyLine(g, 105, 80, 160, 132, r, 2);
      g.strokeStyle = '#1e88e5'; g.strokeRect(90, 170, 28, 45);
    } else { // ludziki
      const people = k === 1 ? [[80, 150, 1], [150, 160, 0.7]] : [[70, 140, 1], [130, 160, 0.6], [180, 165, 0.5]];
      people.forEach(([x, y, s], i) => {
        g.strokeStyle = ['#8e24aa', '#e53935', '#1e88e5'][i];
        g.beginPath(); g.arc(x, y - 40 * s, 16 * s, 0, Math.PI * 2); g.stroke();
        wobblyLine(g, x, y - 24 * s, x, y + 30 * s, r, 2);
        wobblyLine(g, x - 28 * s, y, x + 28 * s, y - 6 * s, r, 2);
        wobblyLine(g, x, y + 30 * s, x - 18 * s, y + 60 * s, r, 2);
        wobblyLine(g, x, y + 30 * s, x + 18 * s, y + 60 * s, r, 2);
      });
    }
    grain(g, S, S, 12, r);
    const t = toTexture(c);
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
    return t;
  });

  // kółko dla cząsteczek
  {
    const S = 64, [c, g] = makeCanvas(S);
    const grd = g.createRadialGradient(32, 32, 4, 32, 32, 30);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.6, 'rgba(255,255,255,0.85)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd; g.fillRect(0, 0, S, S);
    TEX.dot = new THREE.CanvasTexture(c);
  }
}

export function toon(color, map = TEX.crayon, extra = {}) {
  return new THREE.MeshToonMaterial({ color, map, gradientMap, ...extra });
}

// Karteczka z odręcznym napisem (do tutoriala na ścianie).
export function noteTexture(lines, { bg = '#fff59d', ink = '#4a3b5c', w = 512, h = 300, size = 46 } = {}) {
  const [c, g] = makeCanvas(w, h), r = rng(lines.join('').length * 13 + 3);
  g.fillStyle = bg;
  g.beginPath();
  g.moveTo(8, 10); g.lineTo(w - 6, 4); g.lineTo(w - 10, h - 8); g.lineTo(4, h - 4); g.closePath();
  g.fill();
  hatch(g, w, h, r, { count: 500, colors: ['#ffffff', '#00000022'], alpha: 0.15 });
  g.fillStyle = 'rgba(255,255,255,0.55)';
  g.save(); g.translate(w / 2, 8); g.rotate(-0.04); g.fillRect(-60, -10, 120, 30); g.restore();
  g.fillStyle = ink;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = `${size}px "Patrick Hand", "Comic Sans MS", cursive`;
  const lh = size * 1.12, y0 = h / 2 - ((lines.length - 1) * lh) / 2 + 6;
  lines.forEach((l, i) => g.fillText(l, w / 2 + (r() - 0.5) * 6, y0 + i * lh));
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

export function paperOverlayDataURL() {
  const S = 256, [c, g] = makeCanvas(S), r = rng(99);
  const img = g.createImageData(S, S);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 128 + (r() - 0.5) * 90;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  hatch(g, S, S, r, { count: 400, colors: ['#ffffff', '#000000'], alpha: 0.12 });
  return c.toDataURL();
}
