# Prism Breakout: Shatterwave - Implementation Plan

## Phase 1: Repository Scaffold & Shared Contracts

- [x] Initialize git repository on `main` and register `C:\Users\mtsch\breakout` in `project-tracker`
- [x] Scaffold project configs (`.editorconfig`, `.gitattributes`, `.gitignore`, `package.json`, `tsconfig.json`, `vite.config.ts`, `eslint.config.js`, `.prettierrc.json`, `.aislop/config.yml`, `init.ps1`/`init.bat`/`init.sh`, `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, `LICENSE`)
- [x] Define core game types, constants, and interfaces in `src/game/types.ts`

## Phase 2: Parallel Subsystem Implementation (Gemini Flash Subagent Lanes in Sibling Worktrees)

- [x] **Lane A (`engine`)**: Implement `src/engine/random.ts`, `src/engine/collision.ts`, `src/engine/loop.ts`, `src/engine/input.ts` and unit tests (`tests/engine.test.ts`)
- [x] **Lane B (`effects`)**: Implement `src/effects/screen-shake.ts`, `src/effects/particles.ts`, `src/effects/floating-text.ts`, `src/effects/starfield.ts` and unit tests (`tests/effects.test.ts`)
- [x] **Lane C (`audio`)**: Implement `src/audio/audio-engine.ts`, `src/audio/sound-effects.ts`, `src/audio/music.ts` and unit tests (`tests/audio.test.ts`)
- [x] **Lane D (`levels-powerups`)**: Implement `src/game/levels.ts` (10 distinct stages + endless loop) and `src/game/power-ups.ts` (Multi-Ball, Wide Paddle, Twin Laser, Fireball Pierce, Magnet Catch, Safety Barrier) and unit tests (`tests/levels-powerups.test.ts`)

## Phase 3: Core Game State Machine, Juicy Renderer, and Responsive Cabinet UI

- [x] Review and integrate all parallel subagent branches (`review-in-parallel-pipelines`)
- [x] Implement `src/game/game.ts` state machine (Parry Boost window, magnetic ball serve, multi-ball, pierce fireball, twin lasers, chain combo musical escalation, Shatter Fever mode, Nova brick chain explosions, Prism Splitter shards, and stage progression) + `tests/game.test.ts`
- [x] Implement `src/render/renderer.ts` Canvas 2D renderer (glossy prism bricks, crack overlays, shockwave rings, ball comet trails, paddle squash-and-stretch, parry flash, fever rainbow border, HUD overlays) + `tests/renderer.test.ts`
- [x] Implement `src/main.ts` and `src/style.css` arcade cabinet, HUD bar, keyboard/mouse/touch controls, and overlays + `tests/main.test.ts`

## Phase 4: Verification, Smoke Test, and GitHub Pages Deployment

- [x] Run `npm run lint`, `npm run format:check`, `npm run coverage`, `aislop`, and `npm run build:pages`
- [x] Smoke test live game in headless/preview server and update `TEST-REPORT.md` and `README.md`
- [x] Create GitHub repository `mtschoen/breakout`, push `main`, enable GitHub Actions Pages workflow, and verify live deployment
