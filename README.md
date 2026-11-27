# BOING!

Akrobatyczna platformówka w three.js. Bohaterka nie umie chodzić — biega, skacze, robi gwiazdy, salta i fikołki, a otoczenie (kanty stołów, klocki LEGO, wypastowane panele) jest dla niej torem przeszkód. Pasek ENERGII ciągle spada, więc spokojnym spacerkiem poziomu nie przejdziesz.

## Uruchomienie lokalne

Moduły ES nie działają z `file://`, potrzebny jest serwer:

```bash
npm run dev        # http://localhost:8765
```

## Sterowanie

| Klawisz | Akcja |
| --- | --- |
| ← → / A D | bieg |
| Spacja | skok (trzymaj = wyżej), w powietrzu salto |
| Shift | gwiazda — zryw, szeroki hitbox |
| S / ↓ | fikołek; przy lądowaniu = przewrót; w powietrzu = szybciej w dół |
| ` / F2 | panel strojenia fizyki |
| R / Esc / M / V | restart / pauza / dźwięk / głos |

## Deploy

```bash
npm install
npx wrangler login     # jednorazowo
npm run deploy -- "opis zmian"
```

`npm run deploy` commituje zmiany, wypycha na GitHuba i publikuje `dist/` na Cloudflare Pages (projekt `boing`).

## Struktura

- `src/config.js` — wszystkie liczby do strojenia rozgrywki
- `src/player.js` — fizyka, akrobacje, zdrowie, energia
- `src/character.js` — model i animacja bohaterki, ręka Mamy
- `src/level.js` — poziom 1 (salon)
- `src/main.js` — pętla gry, kamera, zdarzenia, ekrany
