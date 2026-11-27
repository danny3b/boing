// Panel do strojenia fizyki na żywo (klawisz ` lub F2). Zmiany zapisują się w przeglądarce.
import { CFG } from './config.js';

const KEY = 'boing.cfg.v1';
const DEFAULTS = { ...CFG };

const GROUPS = [
  ['Bieg', [
    ['baseMaxSpeed', 'Prędkość biegu', 2, 10, 0.1],
    ['bonusMaxSpeed', 'Bonus prędkości z pędu', 0, 12, 0.1],
    ['groundAccel', 'Przyspieszenie', 5, 80, 1],
    ['brakeAccel', 'Zawracanie / hamowanie', 5, 80, 1],
    ['groundFriction', 'Tarcie (puszczony klawisz)', 2, 60, 1],
    ['controlLoss', 'Utrata kontroli przy pędzie', 0, 0.95, 0.05],
    ['slipperyFactor', 'Przyczepność paneli', 0.02, 1, 0.02],
  ]],
  ['Skok', [
    ['jumpVel', 'Siła skoku', 5, 15, 0.1],
    ['gravity', 'Grawitacja', 10, 50, 0.5],
    ['fallGravity', 'Mnożnik spadania', 1, 2.5, 0.05],
    ['apexGravity', 'Zawis w szczycie (mniej = dłużej)', 0.2, 1, 0.05],
    ['airAccel', 'Sterowanie w powietrzu', 0, 40, 1],
    ['saltoVel', 'Siła salta', 2, 12, 0.1],
    ['coyote', 'Coyote time (s)', 0, 0.3, 0.01],
    ['jumpBuffer', 'Bufor skoku (s)', 0, 0.3, 0.01],
  ]],
  ['Akrobacje', [
    ['rollTime', 'Czas fikołka', 0.2, 1.2, 0.05],
    ['rollFriction', 'Tarcie fikołka', 0, 15, 0.5],
    ['cartSpeed', 'Prędkość gwiazdy', 4, 18, 0.5],
    ['cartTime', 'Czas gwiazdy', 0.2, 1, 0.02],
    ['inputBuffer', 'Bufor fikołka/gwiazdy (s)', 0, 0.3, 0.01],
    ['momentumPerTrick', 'Pęd za sztuczkę', 0.05, 0.5, 0.01],
    ['momentumDecay', 'Spadek pędu /s', 0, 1, 0.02],
  ]],
  ['Energia', [
    ['energyDecay', 'Spadek energii /s', 0, 20, 0.5],
    ['trickEnergy', 'Energia za sztuczkę', 0, 40, 1],
  ]],
];

export function loadTuning() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || '{}');
    for (const k in s) if (k in CFG && typeof s[k] === 'number') CFG[k] = s[k];
  } catch { /* brak dostępu do localStorage — trudno */ }
}

function diff() {
  const d = {};
  for (const k in CFG) if (typeof CFG[k] === 'number' && CFG[k] !== DEFAULTS[k]) d[k] = CFG[k];
  return d;
}
function save() { try { localStorage.setItem(KEY, JSON.stringify(diff())); } catch { /* */ } }

export function initTuner() {
  const el = document.createElement('div');
  el.id = 'tuner';
  el.innerHTML = `<div class="t-head"><b>Strojenie sterowania</b>
    <button data-a="copy" title="Skopiuj zmienione wartości">Kopiuj</button>
    <button data-a="reset">Reset</button>
    <button data-a="close">✕</button></div><div class="t-body"></div>`;
  const body = el.querySelector('.t-body');
  const rows = [];
  for (const [title, params] of GROUPS) {
    const h = document.createElement('div'); h.className = 't-group'; h.textContent = title; body.appendChild(h);
    for (const [key, label, min, max, step] of params) {
      const row = document.createElement('label'); row.className = 't-row';
      row.innerHTML = `<span class="t-label">${label}</span><input type="range" min="${min}" max="${max}" step="${step}"><span class="t-val"></span>`;
      const input = row.querySelector('input'), val = row.querySelector('.t-val');
      const sync = () => {
        input.value = CFG[key];
        val.textContent = +CFG[key].toFixed(3);
        row.classList.toggle('changed', CFG[key] !== DEFAULTS[key]);
      };
      input.addEventListener('input', () => { CFG[key] = parseFloat(input.value); sync(); save(); });
      input.addEventListener('change', () => input.blur()); // oddaj klawiaturę grze
      row.addEventListener('dblclick', () => { CFG[key] = DEFAULTS[key]; sync(); save(); });
      rows.push(sync);
      body.appendChild(row);
    }
  }
  el.addEventListener('click', (e) => {
    const a = e.target.dataset && e.target.dataset.a;
    if (a === 'reset') { Object.assign(CFG, DEFAULTS); rows.forEach((f) => f()); save(); }
    if (a === 'close') toggle(false);
    if (a === 'copy') {
      const txt = JSON.stringify(diff(), null, 2);
      navigator.clipboard?.writeText(txt).then(
        () => { e.target.textContent = 'Skopiowano!'; setTimeout(() => (e.target.textContent = 'Kopiuj'), 1200); },
        () => prompt('Skopiuj:', txt));
    }
    if (a) e.target.blur();
  });
  document.body.appendChild(el);
  const toggle = (v = !el.classList.contains('show')) => { rows.forEach((f) => f()); el.classList.toggle('show', v); };
  return { toggle };
}
