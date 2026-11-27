// Ilustracje na siatkach bohaterki. Front głowy leży w połowie mapy sferycznej.
import * as THREE from 'three';

const TAU = Math.PI * 2;

function painted(width, height, draw) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const g = canvas.getContext('2d');
  g.lineJoin = g.lineCap = 'round';
  draw(g);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.anisotropy = 4;
  return texture;
}

function fill(g, color, path) {
  g.fillStyle = color;
  g.fill(new Path2D(path));
}

function oval(g, color, x, y, rx, ry, angle = 0) {
  g.fillStyle = color;
  g.beginPath();
  g.ellipse(x, y, rx, ry, angle, 0, TAU);
  g.fill();
}

function eye(g, mood) {
  const ink = '#483236';
  if (mood === 'blink' || mood === 'sad') {
    fill(g, ink, 'M-31 5 Q-3 -14 30 2 Q11 -1 -4 2 Q-21 7 -31 5Z');
  } else {
    // Powieka obejmuje białko i tęczówkę, łącznie ze spłaszczonym dołem oka.
    const shape = new Path2D('M-30 -2 C-29 -40 21 -46 30 -9 C36 17 18 31 -2 30 C-21 29 -32 18 -30 -2Z');
    g.save();
    g.clip(shape);
    g.fillStyle = '#fff8e9';
    g.fillRect(-36, -44, 76, 83);
    oval(g, '#4e4234', -3, -1, 22, 29);
    oval(g, '#638875', -3, 3, 18, 23);
    oval(g, '#302c32', -5, -6, 13, 19);
    oval(g, '#fffdf3', -11, -15, 7, 8);
    oval(g, '#e9e8ab', 5, 12, 3, 3);
    g.restore();
    fill(g, ink, 'M-31 3 C-34 -35 8 -54 29 -22 Q33 -18 37 -20 Q34 -14 30 -13 C13 -42 -21 -34 -31 3Z');
    fill(g, '#946453', 'M-16 26 Q3 34 21 23 Q10 36 -8 31Z');
  }
  const brow = mood === 'sad'
    ? 'M-26 -53 Q-24 -64 -16 -63 Q4 -51 23 -49 Q26 -42 19 -43 Q-2 -42 -26 -53Z'
    : 'M-27 -54 Q-10 -71 17 -64 Q24 -62 25 -58 Q24 -54 17 -56 Q-3 -60 -24 -50 Q-28 -49 -27 -54Z';
  if (mood === 'surprise') g.translate(0, -8);
  fill(g, '#936031', brow);
}

export function faceMap(mood) {
  return painted(512, 256, (g) => {
    g.scale(0.5, 0.5);
    g.fillStyle = '#ffd6b4';
    g.fillRect(0, 0, 1024, 512);
    for (const side of [-1, 1]) {
      g.save();
      g.translate(512 + side * 113, 288);
      g.scale(1.5, 0.80);
      const blush = g.createRadialGradient(0, 0, 2, 0, 0, 38);
      blush.addColorStop(0, '#f29a87');
      blush.addColorStop(0.62, '#f7af98');
      blush.addColorStop(1, '#ffd6b4');
      oval(g, blush, 0, 0, 38, 38);
      g.restore();
      for (const [x, y, r] of [[77, 287, 3], [94, 280, 3.1], [110, 289, 3.3], [124, 280, 2.2], [90, 295, 2]]) {
        oval(g, '#ba775c', 512 + side * x, y + side * 1.5, r, r);
      }
      g.save();
      g.translate(512 + side * 73, 245);
      g.scale(side, 1);
      g.rotate(side * 0.035);
      eye(g, mood);
      g.restore();
    }
    g.translate(512, 307);
    if (mood === 'sad') {
      fill(g, '#89484a', 'M-27 18 Q-5 -8 26 11 Q30 17 23 16 Q0 9 -23 21 Q-27 22 -27 18Z');
    } else if (mood === 'surprise') {
      oval(g, '#88494b', 0, 9, 14, 15, 0.08);
      oval(g, '#e78776', 0, 16, 9, 5);
    } else {
      fill(g, '#89464b', 'M-36 -2 Q-11 10 20 0 Q29 -2 35 -7 C36 12 21 31 4 30 Q-21 31 -36 -2Z');
      fill(g, '#ffebd1', 'M-26 2 Q-11 7 -2 5 L-1 12 Q-14 14 -21 10Z M4 5 Q18 4 27 0 L23 8 Q16 11 4 12Z');
      fill(g, '#ee8a7f', 'M-10 25 Q1 15 17 21 Q4 32 -10 25Z');
    }
  });
}

// Refleksy biegną od przedziałka wzdłuż grzywki.
export function hairMap() {
  return painted(512, 256, (g) => {
    const base = g.createLinearGradient(0, 0, 0, 256);
    base.addColorStop(0, '#ffe298');
    base.addColorStop(0.55, '#f7d481');
    base.addColorStop(1, '#e9b760');
    g.fillStyle = base;
    g.fillRect(0, 0, 512, 256);
    for (let i = -3; i < 33; i++) {
      const end = i * 18;
      const fromPart = (end - 215) / 512 * TAU;
      const sweep = 62 * Math.tanh(5 * Math.sin(fromPart)) * Math.cos(fromPart / 2) ** 2;
      g.save();
      g.translate(end, 0);
      fill(g, '#ecc375', `M${-sweep} 0 Q${18 - sweep} 84 4 156 Q14 220 0 256 Q8 207 -2 160 Q${12 - sweep} 82 ${-sweep} 0Z`);
      fill(g, '#fff0b6', `M${7 - sweep} 26 Q${22 - sweep} 90 8 148 Q12 173 12 193 Q15 133 ${7 - sweep} 26Z`);
      g.restore();
    }
    g.fillStyle = '#d49f53';
    g.fillRect(0, 252, 512, 4);
  });
}

// UV siatki obrotowej: przód sukienki przy u = 1/4, dół przy v = 0.
export function dressMap() {
  return painted(512, 256, (g) => {
    g.fillStyle = '#277f80';
    g.fillRect(0, 0, 512, 256);
    g.fillStyle = '#20686d';
    g.fillRect(0, 0, 512, 70);
    g.fillStyle = '#36918b';
    g.fillRect(0, 103, 512, 12);
    g.fillStyle = '#e5bc71';
    g.fillRect(0, 198, 512, 4);
    // Dwie połówki kołnierzyka leżą na tkaninie i stykają się pod szyją.
    const collar = 'M0 0 H512 V44 Q337 40 197 43 C170 47 175 64 151 65 Q135 66 128 49 Q117 67 102 65 C82 64 81 47 60 44 Q32 42 0 44Z';
    g.save();
    g.translate(0, 2);
    fill(g, '#b0a98a', collar);
    g.restore();
    fill(g, '#fff0d5', collar);
    oval(g, '#e7b45d', 128, 57, 2.8, 3.2);
    // Ścieg wokół rąbka.
    for (let x = 2; x < 512; x += 8) oval(g, '#afd5b0', x, 192, 1.8, 1, -0.35);

    // Naszywana kieszeń z haftowaną stokrotką.
    g.translate(128, 143);
    g.scale(1.25, 0.81);
    fill(g, '#1c666c', 'M-22 -18 L21 -15 L19 12 Q13 26 -4 23 Q-21 21 -22 9Z');
    fill(g, '#4d9d92', 'M-21 -20 L22 -17 L19 9 Q12 23 -3 20 Q-21 19 -21 7Z');
    fill(g, '#b4d7b7', 'M-21 -19 L22 -16 L21 -13 L-21 -16Z');
    for (let i = 0; i < 6; i++) {
      g.save();
      g.rotate(i * TAU / 6 + 0.18);
      oval(g, '#fff0cc', 0, -6, 3.3, 6);
      g.restore();
    }
    oval(g, '#efae43', 0, 0, 4.2, 4.2);
  });
}
