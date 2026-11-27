// Fizyka, akrobacje, zdrowie (siniaki + plasterki) i pasek ENERGII.
// Pozycja (x, y) = środek stóp. Świat 2D w płaszczyźnie XY.
import { CFG } from './config.js';

const approach = (v, t, d) => (v < t ? Math.min(v + d, t) : Math.max(v - d, t));
const overlap = (b, s) => b.x0 < s.x + s.w && b.x1 > s.x && b.y0 < s.y + s.h && b.y1 > s.y;

export class Player {
  constructor(level) {
    this.level = level;
    this.events = [];
    this.resetLevel();
  }

  resetLevel() {
    const s = this.level.start;
    Object.assign(this, {
      x: s.x, y: s.y, vx: 0, vy: 0, facing: 1,
      state: 'normal', onGround: true, ground: null,
      maxPlasters: CFG.plasters, plasters: CFG.plasters, bruise: 0,
      energy: CFG.energyMax, momentum: 0,
      combo: 0, comboT: 0, maxCombo: 0, lastTrick: null, repeat: 0, tricks: 0,
      candies: 0, checkpoint: { x: s.x, y: s.y },
      invuln: 0, minorCd: 0, stunT: 0, rollT: 0, cartT: 0, cartCd: 0, saltoT: 0,
      saltoUsed: false, airCartUsed: false, coyote: 0, jumpBuf: 0, jumpCut: false,
      tripCd: 0, scratchCd: 0, lowWarned: false, failKind: null, landSquash: 0,
      rollBuf: 0, cartBuf: 0, lastDir: 0, skid: false, prevX: s.x, prevY: s.y,
    });
    this.events.length = 0;
  }

  get size() {
    switch (this.state) {
      case 'roll': return CFG.sizeRoll;
      case 'cart': return CFG.sizeCart;
      case 'stun': case 'cry': case 'bored': return CFG.sizeSit;
      default: return CFG.sizeNormal;
    }
  }

  emit(e) { this.events.push(e); }
  drain() { const e = this.events; this.events = []; return e; }
  box(w, h) { return { x0: this.x - w / 2, x1: this.x + w / 2, y0: this.y, y1: this.y + h }; }
  fits([w, h], y = this.y) {
    const b = { x0: this.x - w / 2, x1: this.x + w / 2, y0: y, y1: y + h };
    return !this.level.solids.some((s) => overlap(b, s));
  }

  step(dt, inp) {
    const C = CFG;
    this.prevX = this.x; this.prevY = this.y;
    this.rollBuf -= dt; this.cartBuf -= dt;
    const active = this.state !== 'cry' && this.state !== 'bored' && this.state !== 'won';

    this.invuln = Math.max(0, this.invuln - dt);
    this.minorCd -= dt; this.cartCd -= dt; this.tripCd -= dt; this.scratchCd -= dt;
    this.saltoT = Math.max(0, this.saltoT - dt);
    this.jumpBuf -= dt; this.coyote -= dt;

    if (active) {
      this.comboT -= dt;
      if (this.comboT <= 0) {
        this.combo = 0;
        this.momentum = Math.max(0, this.momentum - C.momentumDecay * dt);
      }
      // pasek ENERGII ciągle spada — tylko akrobacje go napełniają
      this.energy -= C.energyDecay * dt;
      if (this.energy < C.energyLowWarn && !this.lowWarned) { this.lowWarned = true; this.emit({ type: 'energyLow' }); }
      if (this.energy > C.energyLowWarn + 15) this.lowWarned = false;
      if (this.energy <= 0) { this.energy = 0; this.fail('bored'); }
    }

    const canAct = active && this.state !== 'stun' && !this.failKind;
    const dir = canAct ? inp.dir : 0;
    this.lastDir = dir;
    this.downHeld = canAct && inp.down;
    const m = this.momentum;
    const ctrl = 1 - C.controlLoss * m;
    const slip = this.onGround && this.ground && this.ground.slippery ? C.slipperyFactor : 1;
    const maxSpd = C.baseMaxSpeed + C.bonusMaxSpeed * m;

    if (this.state === 'stun') {
      this.stunT -= dt;
      if (this.stunT <= 0 && this.fits(C.sizeNormal)) { this.state = 'normal'; this.emit({ type: 'standUp' }); }
    }

    // --- akcje ---
    if (canAct) {
      if (inp.jump) this.jumpBuf = C.jumpBuffer;
      if (inp.roll) this.rollBuf = C.inputBuffer;
      if (inp.cart) this.cartBuf = C.inputBuffer;
      if (this.rollBuf > 0 && this.state === 'normal' && this.onGround) { this.rollBuf = 0; this.startRoll(dir); }
      if (this.cartBuf > 0 && (this.state === 'normal' || this.state === 'roll') && this.cartCd <= 0 &&
          (this.onGround || !this.airCartUsed) && this.fits(C.sizeCart)) { this.cartBuf = 0; this.startCart(dir); }
      if (this.jumpBuf > 0) {
        const grounded = this.onGround || this.coyote > 0;
        if (grounded && (this.state === 'normal' || (this.state === 'roll' && this.fits(C.sizeNormal)))) this.doJump();
        else if (inp.jump && !grounded && !this.saltoUsed && this.state === 'normal') this.doSalto();
      }
      if (!inp.jumpHeld && this.vy > 0 && !this.jumpCut && this.state === 'normal') { this.vy *= 0.5; this.jumpCut = true; }
    }

    // --- ruch poziomy ---
    const wasSkid = this.skid;
    this.skid = this.state === 'normal' && this.onGround && Math.abs(this.vx) > C.skidMin &&
      (dir === -Math.sign(this.vx) || (dir === 0 && slip < 1 && Math.abs(this.vx) > 4));
    if (this.skid && !wasSkid) this.emit({ type: 'skid' });
    if (this.state === 'normal') {
      if (this.onGround) {
        if (dir !== 0) {
          const same = Math.sign(this.vx) === dir || Math.abs(this.vx) < 0.05;
          if (same) {
            if (Math.abs(this.vx) < maxSpd) {
              const a = C.groundAccel * (0.5 + 0.5 * ctrl) * (slip < 1 ? 0.45 : 1);
              this.vx = dir * Math.min(maxSpd, Math.abs(this.vx) + a * dt);
            }
          } else {
            this.vx += dir * C.brakeAccel * ctrl * slip * dt; // hamowanie: przy pędzie i na śliskim trudne
          }
          if (same || Math.abs(this.vx) < 1.2) this.facing = dir;
        } else {
          this.vx = approach(this.vx, 0, C.groundFriction * ctrl * slip * dt);
        }
        if (Math.abs(this.vx) > maxSpd) this.vx = approach(this.vx, Math.sign(this.vx) * maxSpd, C.overspeedDecay * slip * dt);
      } else if (dir !== 0) {
        const nv = this.vx + dir * C.airAccel * (1 - 0.5 * m) * dt;
        if (Math.abs(nv) <= maxSpd || Math.abs(nv) < Math.abs(this.vx)) this.vx = nv;
        if (Math.sign(this.vx) === dir || Math.abs(this.vx) < 1) this.facing = dir;
      }
    } else if (this.state === 'roll') {
      if (this.onGround) this.vx = approach(this.vx, 0, C.rollFriction * slip * dt);
      this.rollT -= dt;
      if (this.rollT <= 0) {
        if (this.fits(C.sizeNormal)) this.state = 'normal';
        else { // pod meblem — turlamy się dalej
          this.rollT = 0.05;
          if (Math.abs(this.vx) < 3) this.vx = this.facing * 3;
        }
      }
    } else if (this.state === 'cart') {
      this.cartT -= dt;
      if (this.cartT <= 0) { this.state = 'normal'; this.cartCd = 0.15; }
    } else {
      this.vx = approach(this.vx, 0, 14 * slip * dt);
    }

    // --- grawitacja ---
    let g = C.gravity, maxFall = C.maxFall;
    if (!this.onGround) {
      if (this.state === 'cart') g *= C.cartGravity;
      else {
        if (this.vy < 0) g *= C.fallGravity;
        else if (this.vy < C.apexThreshold && inp.jumpHeld && canAct) g *= C.apexGravity;
        if (inp.down && canAct && this.vy < 2 && this.saltoT <= 0) { g *= C.fastFallGravity; maxFall *= 1.4; }
      }
    }
    this.vy = Math.max(-maxFall, this.vy - g * dt);

    // --- kolizje ---
    this.collide(dt);

    // --- wyzwalacze ---
    if (active && !this.failKind) {
      const [w, h] = this.size;
      const b = this.box(w, h);
      for (const t of this.level.triggers) if (!t.off && overlap(b, t)) this.trigger(t);
      for (const r of this.level.robots) if (overlap(b, r)) this.robotHit(r);
      if (this.y < -6) this.lava();
    }
  }

  collide(dt) {
    const wasGround = this.onGround;
    const solids = this.level.solids;
    let [w, h] = this.size;

    this.x += this.vx * dt;
    for (const s of solids) {
      if (!overlap(this.box(w, h), s)) continue;
      // wybaczanie: stopy tuż poniżej krawędzi → wskocz na górę zamiast się odbić
      const rise = s.y + s.h - this.y;
      if (s.kind !== 'edge' && rise > 0 && rise <= CFG.stepUp && this.fits([w, h], s.y + s.h + 1e-4)) {
        this.y = s.y + s.h + 1e-4;
        if (this.vy < 0) this.vy = 0;
        continue;
      }
      const spd = Math.abs(this.vx);
      const d = Math.sign(this.vx) || (this.x < s.x + s.w / 2 ? 1 : -1);
      this.x = d > 0 ? s.x - w / 2 - 1e-4 : s.x + s.w + w / 2 + 1e-4;
      this.wallHit(s, spd, d);
      [w, h] = this.size;
    }

    const vyBefore = this.vy;
    this.y += this.vy * dt;
    this.onGround = false;
    for (const s of solids) {
      if (!overlap(this.box(w, h), s)) continue;
      if (this.vy <= 0) {
        this.y = s.y + s.h;
        this.vy = 0;
        this.onGround = true;
        this.ground = s;
      } else {
        this.y = s.y - h - 1e-4;
        this.ceilHit(s, this.vy);
        this.vy = 0;
      }
    }
    if (this.onGround && !wasGround) this.onLand(vyBefore);
    if (wasGround && !this.onGround && this.vy <= 0) this.coyote = CFG.coyote;
  }

  onLand(vy) {
    this.saltoUsed = false; this.airCartUsed = false; this.jumpCut = false;
    this.landSquash = Math.min(1, -vy / 14);
    this.emit({ type: 'land', speed: -vy });
    // przewrót przy lądowaniu: S wciśnięte tuż przed / trzymane → zachowujesz pęd i ratujesz złe salto
    if (this.state === 'normal' && !this.failKind && (this.rollBuf > 0 || this.downHeld)) {
      this.rollBuf = 0;
      this.saltoT = 0;
      this.startRoll(this.lastDir, true);
      return;
    }
    if (this.saltoT > 0.12 && this.state === 'normal') {
      this.saltoT = 0;
      this.hurt('minor', 'badLanding', { amount: 25 });
    }
  }

  wallHit(s, spd, d) {
    const C = CFG;
    if (this.state === 'cart') { this.cartT = 0; this.state = 'normal'; this.cartCd = 0.2; }
    if (s.kind === 'edge') {
      // KANT — dokładnie na wysokości głowy
      if (spd >= C.edgeCritical) this.hurt('critical', 'edge', { n: spd >= C.edgeCritical3 ? 3 : 2, speed: spd });
      else if (spd >= C.edgeMedium) this.hurt('medium', 'edge', { speed: spd });
      else if (spd >= C.edgeMinor) this.hurt('minor', 'edge', { amount: 15 });
      this.vx = -d * Math.min(spd * 0.45, 5);
      if (spd >= C.edgeMinor) this.emit({ type: 'bonk', speed: spd });
    } else {
      if (spd >= C.wallMedium) this.hurt('medium', 'wall', { speed: spd });
      else if (spd >= C.wallMinor) this.hurt('minor', 'wall', { amount: 18 });
      if (spd > 4) { this.vx = -d * spd * 0.35; this.emit({ type: 'wallBump', speed: spd }); }
      else this.vx = 0;
    }
  }

  ceilHit(s, vy) {
    if (s.kind === 'edge' && vy > 3) {
      this.hurt('minor', 'head', { amount: 15 });
      this.emit({ type: 'bonk', speed: vy });
    }
  }

  startRoll(dir, landing = false) {
    if (dir && (Math.sign(this.vx) === dir || Math.abs(this.vx) < 2)) this.facing = dir;
    this.state = 'roll';
    this.rollT = CFG.rollTime;
    this.vx = this.facing * Math.max(Math.abs(this.vx) + CFG.rollBoost, CFG.rollMinSpeed);
    this.trick(landing ? 'przewrot' : 'fikolek');
    this.emit({ type: 'roll' });
  }

  startCart(dir) {
    if (dir && (Math.sign(this.vx) === dir || Math.abs(this.vx) < 3)) this.facing = dir;
    this.state = 'cart';
    this.rollT = 0;
    this.cartT = CFG.cartTime;
    const keep = Math.sign(this.vx) === this.facing ? Math.abs(this.vx) : 0;
    this.vx = this.facing * Math.max(keep, CFG.cartSpeed + CFG.cartBonus * this.momentum);
    if (!this.onGround) { this.airCartUsed = true; this.vy = Math.max(this.vy, 2.5); }
    this.trick('gwiazda');
    this.emit({ type: 'cart' });
  }

  doJump() {
    if (this.state === 'roll') { this.state = 'normal'; this.rollT = 0; }
    this.vy = CFG.jumpVel + CFG.bonusJump * this.momentum;
    this.onGround = false; this.coyote = 0; this.jumpBuf = 0; this.jumpCut = false;
    this.emit({ type: 'jump' });
  }

  doSalto() {
    this.vy = Math.max(this.vy, CFG.saltoVel + 1.5 * this.momentum);
    this.saltoUsed = true; this.saltoT = CFG.saltoTime; this.jumpBuf = 0; this.jumpCut = true;
    this.trick('salto');
  }

  trick(name) {
    const C = CFG;
    this.combo = this.comboT > 0 ? this.combo + 1 : 1;
    this.comboT = C.comboWindow;
    this.maxCombo = Math.max(this.maxCombo, this.combo);
    this.tricks++;
    this.repeat = name === this.lastTrick ? this.repeat + 1 : 0;
    this.lastTrick = name;
    const k = Math.max(0.15, Math.pow(C.repeatPenalty, this.repeat));
    const e = (C.trickEnergy + C.comboEnergyBonus * Math.min(this.combo - 1, 6)) * k;
    this.energy = Math.min(C.energyMax, this.energy + e);
    this.momentum = Math.min(1, this.momentum + C.momentumPerTrick * k);
    this.emit({ type: 'trick', name, combo: this.combo, weak: this.repeat > 0 });
  }

  trigger(t) {
    const C = CFG;
    switch (t.type) {
      case 'candy':
        t.off = true; this.candies++;
        this.emit({ type: 'pickup', what: 'candy', t });
        break;
      case 'gum':
        t.off = true; this.plasters++;
        this.emit({ type: 'pickup', what: 'gum', t });
        break;
      case 'kiss':
        if (t.used) break;
        t.used = true;
        this.checkpoint = { x: t.cx, y: t.groundY };
        this.bruise = 0;
        this.plasters = Math.max(this.plasters, this.maxPlasters);
        this.energy = Math.max(this.energy, C.kissEnergy);
        this.emit({ type: 'checkpoint', t });
        break;
      case 'lego':
        if (this.invuln <= 0 && this.vy <= 0.1) {
          this.hurt('medium', 'lego');
          this.vy = C.legoBounce; this.onGround = false; this.jumpCut = true;
          if (this.state !== 'normal' && this.state !== 'stun' && this.fits(C.sizeNormal)) this.state = 'normal';
          this.emit({ type: 'squeak' });
        }
        break;
      case 'trip':
        if (this.onGround && Math.abs(this.vx) > C.tripSpeed && this.state === 'normal' && this.tripCd <= 0) {
          this.tripCd = 1.5;
          this.hurt('minor', 'trip', { amount: 12 });
          this.vx *= 0.55; this.vy = 3.2; this.onGround = false; this.jumpCut = true;
        }
        break;
      case 'leaves':
        if (this.scratchCd <= 0) { this.scratchCd = 1.2; this.hurt('minor', 'plant', { amount: 10 }); }
        break;
      case 'lava':
        this.lava();
        break;
      case 'finish':
        this.state = 'won';
        this.vx *= 0.3;
        this.emit({ type: 'won' });
        break;
    }
  }

  robotHit(r) {
    if (this.vy < 0 && this.y > r.y + r.h - 0.3) {
      this.vy = CFG.jumpVel + 2 + 2 * this.momentum;
      this.onGround = false; this.jumpCut = true; this.saltoUsed = false; this.airCartUsed = false;
      if (this.state === 'roll' && this.fits(CFG.sizeNormal)) this.state = 'normal';
      this.trick('boing');
      this.emit({ type: 'bounce' });
    } else if (this.invuln <= 0) {
      this.hurt('medium', 'robot');
      const d = Math.sign(this.x - (r.x + r.w / 2)) || 1;
      this.vx = d * 6; this.vy = 5; this.onGround = false; this.jumpCut = true;
      if ((this.state === 'roll' || this.state === 'cart') && this.fits(CFG.sizeNormal)) this.state = 'normal';
    }
  }

  lava() {
    this.emit({ type: 'lava', x: this.x });
    this.hurt('medium', 'lava', { force: true });
    this.x = this.checkpoint.x; this.y = this.checkpoint.y + 0.01;
    this.prevX = this.x; this.prevY = this.y;
    this.vx = 0; this.vy = 0;
    if (!this.failKind) {
      this.state = 'normal';
      this.invuln = 1.5;
      this.momentum *= 0.5;
    }
  }

  hurt(level, cause, o = {}) {
    if (this.failKind || this.state === 'won') return;
    const C = CFG;
    if (level === 'minor') {
      if (this.minorCd > 0) return;
      this.minorCd = 0.4;
      this.bruise += o.amount ?? 20;
      this.emit({ type: 'hurt', level, cause });
      if (this.bruise >= C.bruiseMax) {
        this.bruise = 0;
        this.plasters--;
        this.emit({ type: 'bruiseFull' });
      }
    } else {
      if (this.invuln > 0 && !o.force) return;
      const n = level === 'critical' ? (o.n || 2) : 1;
      this.plasters -= n;
      this.combo = 0; this.comboT = 0;
      if (level === 'critical') {
        this.state = 'stun';
        this.stunT = C.stunTime;
        this.momentum = 0;
        this.invuln = C.stunTime + 1;
        this.rollT = this.cartT = 0;
      } else {
        this.momentum *= 0.5;
        this.invuln = C.hurtInvuln;
      }
      this.emit({ type: 'hurt', level, cause, n });
    }
    if (this.plasters <= 0) { this.plasters = 0; this.fail('cry'); }
  }

  fail(kind) {
    if (this.failKind) return;
    this.failKind = kind;
    this.state = kind;
    this.vx *= 0.3;
    this.emit({ type: 'fail', kind });
  }
}
