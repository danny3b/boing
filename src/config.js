// Wszystkie liczby do strojenia rozgrywki w jednym miejscu.
export const CFG = {
  step: 1 / 120,

  // --- ruch ---
  gravity: 26,
  maxFall: 22,
  baseMaxSpeed: 5.4,      // prędkość "spokojnego" biegu
  bonusMaxSpeed: 6.2,     // dodatkowa prędkość przy pełnym PĘDZIE
  groundAccel: 30,
  brakeAccel: 34,
  groundFriction: 22,
  overspeedDecay: 5,      // jak szybko wytraca się prędkość ponad limit
  airAccel: 16,
  slipperyFactor: 0.12,   // mnożnik tarcia na wypastowanych panelach
  controlLoss: 0.75,      // przy pełnym pędzie kontrola spada o 75%

  jumpVel: 9.5,
  bonusJump: 3.2,
  jumpBuffer: 0.12,
  coyote: 0.1,
  fallGravity: 1.35,      // spadanie szybsze niż wznoszenie = "ciężki", czytelny łuk
  apexGravity: 0.55,      // zawis w szczycie skoku, gdy trzymasz skok
  apexThreshold: 1.6,
  fastFallGravity: 1.8,   // S/↓ w powietrzu = szybsze opadanie
  inputBuffer: 0.13,      // fikołek/gwiazda wciśnięte chwilę za wcześnie i tak wejdą
  stepUp: 0.22,           // wybaczanie: stopy zahaczą o krawędź → wskakujesz na górę
  skidMin: 2.5,           // od tej prędkości hamowanie to poślizg

  // --- akrobacje ---
  saltoVel: 6.5,
  saltoTime: 0.5,
  rollTime: 0.55,
  rollBoost: 2.2,
  rollMinSpeed: 5,
  rollFriction: 2.5,      // fikołka trudno wyhamować
  cartTime: 0.42,
  cartSpeed: 9.5,
  cartBonus: 3.5,
  cartGravity: 0.35,

  // --- hitboxy [szerokość, wysokość] ---
  sizeNormal: [0.5, 1.3],   // wysokość rysunku Domi (~1.32)
  sizeRoll: [0.6, 0.65],  // musi być < 0.95 (prześwit pod szafką)
  sizeCart: [1.3, 1.45],  // gwiazda = szeroki i wysoki hitbox (rysunek ~1.41)
  sizeSit: [0.7, 0.7],

  // --- wygląd postaci 3D ---
  charSaturation: 1.55,   // 1 = kolory jak w teksturze
  charBrightness: 0.9,

  // --- pasek ENERGII (spada, gdy nie robisz akrobacji) ---
  energyMax: 100,
  energyDecay: 6.5,       // na sekundę
  trickEnergy: 17,
  comboEnergyBonus: 3,
  repeatPenalty: 0.5,     // ta sama sztuczka pod rząd daje mniej
  kissEnergy: 70,
  energyLowWarn: 30,

  // --- combo / PĘD ---
  comboWindow: 1.8,
  momentumPerTrick: 0.2,
  momentumDecay: 0.18,

  // --- zdrowie ---
  plasters: 4,
  bruiseMax: 100,
  stunTime: 3,
  hurtInvuln: 1.3,

  // progi prędkości uderzeń
  edgeMinor: 1.5,
  edgeMedium: 4.5,
  edgeCritical: 8.5,
  edgeCritical3: 11.5,
  wallMinor: 7,
  wallMedium: 10,
  tripSpeed: 6.5,
  legoBounce: 6.5,
};
