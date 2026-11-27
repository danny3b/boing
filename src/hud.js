import { CFG } from './config.js';

const $ = (id) => document.getElementById(id);

export function fmtTime(t) {
  const m = Math.floor(t / 60), s = t - m * 60;
  return `${m}:${s < 10 ? '0' : ''}${s.toFixed(1)}`;
}

export class Hud {
  constructor() {
    this.el = $('hud');
    this.name = $('hud-name');
    this.plasters = $('hud-plasters');
    this.bruise = $('hud-bruise');
    this.energy = $('hud-energy');
    this.energyWrap = $('hud-energy-wrap');
    this.momentum = $('hud-momentum');
    this.combo = $('hud-combo');
    this.time = $('hud-time');
    this.candies = $('hud-candies');
    this.candiesTotal = $('hud-candies-total');
    this.pkey = '';
  }
  show(v) { this.el.classList.toggle('hidden', !v); }
  setName(n) { this.name.textContent = n; }

  update(p, time, total) {
    const key = p.plasters + '/' + p.maxPlasters;
    if (key !== this.pkey) {
      this.pkey = key;
      const n = Math.max(p.plasters, p.maxPlasters);
      let html = '';
      for (let i = 0; i < n; i++) {
        const cls = i >= p.plasters ? 'empty' : i >= p.maxPlasters ? 'extra' : '';
        html += `<span class="plaster ${cls}"></span>`;
      }
      this.plasters.innerHTML = html;
      this.plasters.classList.remove('hit'); void this.plasters.offsetWidth; this.plasters.classList.add('hit');
    }
    this.bruise.style.width = (p.bruise / CFG.bruiseMax) * 100 + '%';
    const e = p.energy / CFG.energyMax;
    this.energy.style.width = e * 100 + '%';
    this.energyWrap.classList.toggle('low', e < CFG.energyLowWarn / 100);
    this.momentum.style.width = p.momentum * 100 + '%';
    this.combo.textContent = p.combo >= 2 ? `COMBO x${p.combo}` : '';
    this.time.textContent = fmtTime(time);
    this.candies.textContent = p.candies;
    this.candiesTotal.textContent = total;
  }
}
