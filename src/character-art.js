// Atlas ilustracji Domi. Współrzędne oczu i końca kucyka liczymy od lewego górnego rogu klatki.
import * as THREE from 'three';

const TILE = 336, COLS = 6, ROWS = 4;
const SIZE = 1.65, UNIT = SIZE / TILE;
export const FOOT_OFFSET = (315 - TILE / 2) * UNIT;
const atlas = await new THREE.TextureLoader().loadAsync(new URL('./art/domi.webp', import.meta.url).href);
atlas.colorSpace = THREE.SRGBColorSpace;

const frames = {
  // numer pola, oko (x, y), kucyk (x, y)
  runA: [0, 223, 134, 102, 116],
  runB: [1, 223, 149, 118, 120],
  runC: [2, 230, 130, 115, 123],
  runD: [3, 225, 133, 110, 121],
  runE: [4, 221, 137, 116, 125],
  runF: [5, 226, 133, 116, 121],
  idle: [6, 185, 109, 82, 108],
  blink: [7, 184, 110, 82, 107],
  rise: [8, 197, 107, 86, 112],
  fall: [9, 214, 173, 127, 130],
  skid: [10, 162, 140, 58, 131],
  won: [11, 171, 101, 68, 109],
  tuck: [12, 226, 177, 112, 118],
  star: [13, 173, 97, 69, 82],
  stun: [14, 188, 190, 112, 184],
  cry: [15, 197, 207, 120, 187],
  bored: [16, 207, 195, 126, 185],
  carried: [17, 183, 111, 86, 99],
  cartEntry: [18, 244, 168, 171, 71],
  handstand: [19, 168, 209, 168, 281],
  cartExit: [20, 145, 133, 69, 135],
};

// Obwiednie tuszu w klatkach obrotu. Na podłodze opierają się dłonie, podeszwy lub plecy.
const outlines = {
  tuck: [[76, 105], [102, 69], [122, 53], [134, 49], [156, 49], [174, 53], [239, 99], [270, 139], [245, 215], [208, 273], [192, 285], [180, 285], [134, 257], [122, 243], [74, 127]],
  star: [[46, 73], [82, 37], [100, 29], [134, 29], [246, 63], [255, 71], [258, 79], [280, 299], [55, 299]],
  cartEntry: [[56, 136], [157, 56], [174, 50], [204, 52], [216, 60], [283, 142], [285, 270], [279, 278], [113, 284], [99, 280], [53, 146]],
  handstand: [[55, 57], [66, 45], [79, 37], [256, 35], [273, 45], [284, 59], [240, 299], [225, 303], [97, 299], [54, 63]],
  cartExit: [[39, 140], [53, 102], [67, 90], [89, 82], [195, 58], [278, 126], [292, 142], [297, 156], [250, 258], [226, 268], [93, 260], [40, 148]],
};

export class DomiArt extends THREE.Mesh {
  constructor() {
    const geometry = new THREE.PlaneGeometry(SIZE, SIZE, 20, 20);
    super(geometry, new THREE.MeshBasicMaterial({
      map: atlas, side: THREE.DoubleSide, alphaTest: 0.32, alphaToCoverage: true, toneMapped: false,
    }));
    this.castShadow = true;
    this.original = geometry.attributes.position.clone();
    this.weights = new Float32Array(this.original.count);
    this.eye = new THREE.Vector3();
    geometry.attributes.position.setUsage(THREE.DynamicDrawUsage);
    this.setPose('idle');
  }

  setPose(name) {
    if (this.pose === name) return;
    this.pose = name;
    const [index, eyeX, eyeY, hairX, hairY] = frames[name];
    const col = index % COLS, row = Math.floor(index / COLS);
    this.eye.set((eyeX - TILE / 2) * UNIT, (TILE / 2 - eyeY) * UNIT, 0);
    const uv = this.geometry.attributes.uv;
    const hairRadius = Math.min(65, Math.hypot(eyeX - hairX, eyeY - hairY) * 0.62);
    for (let i = 0; i < uv.count; i++) {
      const x = this.original.getX(i) / SIZE + 0.5;
      const y = 0.5 - this.original.getY(i) / SIZE;
      uv.setXY(i, (col + x) / COLS, 1 - (row + y) / ROWS);
      const d = Math.hypot(x * TILE - hairX, y * TILE - hairY) / hairRadius;
      this.weights[i] = 1 - THREE.MathUtils.smoothstep(d, 0.1, 1);
    }
    uv.needsUpdate = true;
  }

  swayHair(dx, dy) {
    const pos = this.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const w = this.weights[i];
      pos.setXY(i, this.original.getX(i) + w * dx, this.original.getY(i) + w * dy);
    }
    pos.needsUpdate = true;
  }

  groundOffset(angle, sx, sy) {
    const shape = outlines[this.pose];
    if (!shape) return FOOT_OFFSET * sy;
    const sin = Math.sin(angle) * sx, cos = Math.cos(angle) * sy;
    let bottom = 0;
    for (const [x, y] of shape) {
      bottom = Math.max(bottom, ((TILE / 2 - x) * sin + (y - TILE / 2) * cos) * UNIT);
    }
    return bottom;
  }
}
