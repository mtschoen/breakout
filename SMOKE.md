# Smoke Test

How to verify a change works in this project before declaring it done.

## Floor - does it build and run?

```bash
npm run build
npm run preview
```

Open `http://127.0.0.1:4175/` and confirm the cabinet, HUD, and title overlay render cleanly.

## Bar - does it do what was asked?

```bash
npm run lint
npm run format:check
npm run coverage
```

Verify: ESLint and Prettier report `0` findings, and all Vitest unit tests pass with full coverage.

In the browser:

1. Press `Enter` or click **Launch Run** to start Stage 1.
2. Steer the paddle with `ArrowLeft`/`ArrowRight` (or `A`/`D` or mouse drag) and press `Space` to launch the ball.
3. Confirm bricks shatter with particles, floating score text, ascending combo audio tones, and trauma screen shake.
4. Press `Space` right as the ball reaches the paddle to trigger a **Parry Boost** (`PARRY!` popup and charged ball trail).
5. Collect falling power-up capsules (`M`, `W`, `L`, `F`, `C`, `S`) and verify their effects activate.
6. Press `P` or `Escape` to pause and resume; press `M` to toggle audio mute.

## Setup

None. Node.js 22+ and `npm install` only.

## Cleanup

Stop the preview server (`Ctrl+C` or terminate the preview process).

## Needs manual testing

Web Audio synthesis unlocks on the first user gesture per browser autoplay policy. Confirm music layers intensify as combo and stage progress.
