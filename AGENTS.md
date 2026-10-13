# Prism Breakout: Shatterwave

A high-juice synthwave brick-breaker arcade game with paddle parry boosts, ascending musical combo scales, explosive nova bricks, prism splitters, and procedural Web Audio soundtrack and sound effects.

## Development

- Node.js 22 or newer. Run `npm install`, then `npm run dev` (serves on `http://127.0.0.1:5175`).
- `npm run build`: TypeScript validation and production bundle in `dist/`.
- `npm run build:pages`: production bundle with the `/breakout/` GitHub Pages prefix. Preview with `npm run preview -- --base=/breakout/`.
- `npm test`: run Vitest unit tests.
- `npm run coverage`: run full Vitest source coverage report (`TEST-REPORT.md` tracks the latest gate output).
- `npm run lint`: run ESLint (`0` findings required).
- `npm run format:check`: run Prettier check (`npm run format` to format).
- `npm run preview`: serve the production build on `http://127.0.0.1:4175`.
- See `SMOKE.md` for smoke test procedures and `TEST-REPORT.md` for the latest verification report.

## Architecture

- `src/engine/`: clamped-delta game loop (`loop.ts`), keyboard/pointer/touch input (`input.ts`), seeded Mulberry32 PRNG (`random.ts`), and circle/AABB collision & reflection physics (`collision.ts`).
- `src/effects/`: pooled shatter particles (`particles.ts`), trauma-based screen shake with reduced-motion support (`screen-shake.ts`), rising floating score/combo callouts (`floating-text.ts`), and reactive synthwave star/grid backdrop (`starfield.ts`).
- `src/audio/`: lazy `AudioContext` facade (`audio-engine.ts`), lookahead-scheduled synthwave music engine that layers up with combo and stage intensity (`music.ts`), and procedural Web Audio sound effects with harmonic combo pitch escalation (`sound-effects.ts`).
- `src/game/`: shared state and entity types (`types.ts`), 10 hand-crafted stage layouts plus endless procedural loop (`levels.ts`), power-up definitions and capsule mechanics (`power-ups.ts`), and the deterministic `Game` state machine (`game.ts`).
- `src/render/`: Canvas 2D renderer (`renderer.ts`) with neon bevel bricks, armor crack overlays, comet ball trails, shockwave rings, paddle squash-and-stretch, parry aura, and laser beams.
- `src/main.ts`, `src/style.css`: responsive arcade cabinet UI, HUD telemetry, overlays, and coarse-pointer touch control deck.

## Conventions

- Keep game logic independent of DOM, Web Audio nodes, and Canvas 2D contexts so all rules and systems are deterministically testable.
- Inject seeded random sources and advance simulation time explicitly in tests; never assert on real wall-clock time.
- Avoid abbreviations in identifiers (`maximum` not `max`, `configuration` not `config`, `deltaSeconds` not `dt`).
- Never use em-dashes in prose, comments, or code; use ASCII `-`, colons, or parentheses.
- Dispatched writing lanes must use sibling git worktrees (`~/breakout-worktrees/<task>`), leaving the primary checkout on `main`.

## Cleaning the working tree

`git clean -ffxd` is always safe to run in this repository. Nothing unrecoverable lives in the working tree: every file is either tracked in git or reproducible by running the initialization script. Git offers no mechanism to protect untracked files from a full clean, and maintaining an exclusion list would defeat the purpose of returning a checkout to a known-clean state.

| Removed by `git clean -ffxd`             | Restored by                                         |
| ---------------------------------------- | --------------------------------------------------- |
| `node_modules/`                          | `npm install` (via `init`)                          |
| `dist/`, `coverage/`                     | `npm run build` / `npm run coverage`                |
| `.claude/AISLOP.md`, `.claude/CLAUDE.md` | `aislop hook install claude --project` (via `init`) |

To restore a freshly cleaned checkout:

- **PowerShell:** `./init.ps1` (pass `-Build` to also run `npm run build`)
- **cmd.exe:** `init.bat` (or `.\init.bat` when `NoDefaultCurrentDirectoryInExePath=1` is set)
- **bash:** `./init.sh` (pass `--build` to also run `npm run build`)

Each init script optionally invokes `claude-provision apply-project` when `claude-provision` is on `PATH` to re-apply project-scope settings removed by a clean, and skips that step silently when the tool is absent. The scripts check for `npm` (Node.js 22+) and `aislop` on `PATH` and report any missing prerequisites without installing software automatically.
