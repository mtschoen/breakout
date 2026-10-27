# Prism Breakout: Shatterwave

A high-juice synthwave brick-breaker arcade game built with TypeScript, HTML5 Canvas 2D, and procedural Web Audio synthesis.

**[Play Prism Breakout: Shatterwave](https://mtschoen.github.io/breakout/)** in your browser. No installation or account required.

## Highlights

- **Paddle Parry Boost**: Tap **Space** (or the **Action** button) right before the ball strikes the paddle to charge a **Prism Smash** that accelerates the ball, spawns a golden shockwave, and deals double damage on the next brick impact.
- **Harmonic Combo Scale & Shatter Fever**: Consecutive brick hits without touching the paddle climb a pentatonic synth scale and charge the **Fever Meter**. At 100% charge, **Shatter Fever** doubles all points and kicks in the high-intensity synth lead!
- **6 Distinct Brick Types**:
  - **Standard Prism Bricks**: Neon gem bricks with row-based scoring.
  - **Armored Bricks**: Multi-hit metallic bricks that crack and spark as armor chips away.
  - **Explosive Nova Bricks**: Unstable cores that detonate on destruction, blasting adjacent bricks with radial shockwaves and screen shake.
  - **Prism Splitter Bricks**: Crystalline bricks that fire twin upward laser shards when shattered.
  - **Indestructible Bumpers**: Gold deflectors that accelerate balls for bonus ricochet chains.
  - **Prism Core Bricks**: High-value stage boss cores in milestone stages.
- **6 Power-Up Capsules**:
  - **M (Multi-Ball)**: Triples active balls in play.
  - **W (Wide Paddle)**: Expands the paddle by 50%.
  - **L (Twin Laser)**: Mounts rapid-fire pulse cannons on the paddle.
  - **F (Fireball Pierce)**: Turns balls into plasma comets that slice straight through 1-HP bricks.
  - **C (Magnet Catch)**: Catches the ball on paddle contact for aimed re-launches.
  - **S (Safety Barrier)**: Deploys a bottom energy shield that saves one missed ball.
- **100% Synthesized Web Audio**: Driving 128 BPM synthwave soundtrack (bass arpeggio, punchy drums, chord pads, and dynamic lead) plus synthesized sound effects with zero external audio files.
- **Juice Lab Settings Menu**: Customize **Particle density** (`0%` to `300%`), **Particle size** (`0%` to `300%`), **Screen shake** (`0%` to `300%`), and **Reduced Motion**, with a live **Test Mix** impact preview and automatic `localStorage` persistence.

## Play

- **Move Paddle**: `ArrowLeft` / `ArrowRight`, `A` / `D`, mouse/pointer tracking anywhere in the window, or the on-screen touch steering buttons.
- **Launch / Parry / Fire Lasers**: `Space`, `ArrowUp`, `W`, canvas click, or the on-screen **LAUNCH / PARRY** button.
- **Pause**: `P` or `Escape`.
- **Mute**: `M`.
- **Settings (Juice Lab)**: Click **Settings** in the top bar (or press `Escape` to close).
- **Start / Restart**: `Enter` or the overlay button.

## Develop

```bash
npm install
npm run dev          # http://127.0.0.1:5175
npm run lint         # ESLint (0 findings expected)
npm run format:check # Prettier check
npm test             # Vitest unit tests
npm run coverage     # Vitest coverage gate
npm run build        # TypeScript check + production build in dist/
npm run build:pages  # Production build with /breakout/ GitHub Pages base
npm run preview      # Serve production build on http://127.0.0.1:4175
```

## How it was made

Prism Breakout: Shatterwave was made 2026-10-13 with the Antigravity CLI (`agy`), model Gemini 4 Argon at high effort. Development took about six hours (first prompt 11:59, exit 18:04 PDT), driven across 16 prompts and 4 subagents. The session wrapped with 19 commits and about 165 passing tests, locking in the procedural synth audio, particle juice, and brick mechanics.
