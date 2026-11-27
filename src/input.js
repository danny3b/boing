const MAP = {
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
  Space: 'jump', ArrowUp: 'jump', KeyW: 'jump',
  ArrowDown: 'roll', KeyS: 'roll',
  ShiftLeft: 'cart', ShiftRight: 'cart', KeyK: 'cart',
};

export class Input {
  constructor() {
    this.held = new Set();
    this.pressed = new Set();
    this.onKey = null;
    addEventListener('keydown', (e) => {
      if (e.target && e.target.tagName === 'INPUT') return;
      if (this.onKey) this.onKey(e);
      const a = MAP[e.code];
      if (!a) return;
      e.preventDefault();
      if (!e.repeat && !this.held.has(a)) this.pressed.add(a);
      this.held.add(a);
    });
    addEventListener('keyup', (e) => {
      const a = MAP[e.code];
      if (a) this.held.delete(a);
    });
    addEventListener('blur', () => this.held.clear());
  }

  snapshot() {
    const h = this.held, p = this.pressed;
    return {
      dir: (h.has('right') ? 1 : 0) - (h.has('left') ? 1 : 0),
      jump: p.has('jump'),
      jumpHeld: h.has('jump'),
      roll: p.has('roll'),
      down: h.has('roll'),
      cart: p.has('cart'),
    };
  }

  clearEdges() { this.pressed.clear(); }
}
