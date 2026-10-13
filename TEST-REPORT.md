# breakout - Test Report

`2026-10-13T20:46:30Z`

| Field        | Value                                                                                                   |
| ------------ | ------------------------------------------------------------------------------------------------------- |
| **Status**   | PASS                                                                                                    |
| **Mode**     | maintain                                                                                                |
| **Tests**    | `162` total (`162` passed, `0` failed, `0` skipped)                                                     |
| **Git**      | `cb75545` (`main`)                                                                                      |
| **Coverage** | `1919/1919` statements (`100%`), `0` uncovered, `0` exclusion annotations                               |
| **Lint**     | `eslint`: `0` findings (`0` errors, `0` warnings); `0` per-case suppressions, `0` documented exceptions |

## Lint

| Tool     | Findings | Errors | Warnings |
| -------- | -------- | ------ | -------- |
| eslint   | 0        | 0      | 0        |
| prettier | 0        | 0      | 0        |

## Coverage

| Module                         | Statements | Covered | Percent | Lines | Covered Lines | Line Percent |
| ------------------------------ | ---------- | ------- | ------- | ----- | ------------- | ------------ |
| `src/main.ts`                  | 234        | 234     | 100%    | 231   | 231           | 100%         |
| `src/audio/audio-engine.ts`    | 79         | 79      | 100%    | 79    | 79            | 100%         |
| `src/audio/music.ts`           | 215        | 215     | 100%    | 213   | 213           | 100%         |
| `src/audio/sound-effects.ts`   | 108        | 108     | 100%    | 107   | 107           | 100%         |
| `src/effects/floating-text.ts` | 64         | 64      | 100%    | 58    | 58            | 100%         |
| `src/effects/particles.ts`     | 97         | 97      | 100%    | 90    | 90            | 100%         |
| `src/effects/screen-shake.ts`  | 36         | 36      | 100%    | 36    | 36            | 100%         |
| `src/effects/starfield.ts`     | 31         | 31      | 100%    | 29    | 29            | 100%         |
| `src/engine/collision.ts`      | 46         | 46      | 100%    | 46    | 46            | 100%         |
| `src/engine/input.ts`          | 102        | 102     | 100%    | 102   | 102           | 100%         |
| `src/engine/loop.ts`           | 35         | 35      | 100%    | 35    | 35            | 100%         |
| `src/engine/random.ts`         | 23         | 23      | 100%    | 23    | 23            | 100%         |
| `src/game/game.ts`             | 479        | 479     | 100%    | 470   | 470           | 100%         |
| `src/game/levels.ts`           | 34         | 34      | 100%    | 31    | 31            | 100%         |
| `src/game/power-ups.ts`        | 18         | 18      | 100%    | 18    | 18            | 100%         |
| `src/game/types.ts`            | 9          | 9       | 100%    | 9     | 9             | 100%         |
| `src/render/renderer.ts`       | 309        | 309     | 100%    | 307   | 307           | 100%         |

## Commands

```bash
npm run coverage
npm run lint
npm run format:check
npm run build:pages
```
