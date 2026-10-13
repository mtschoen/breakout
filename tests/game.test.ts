import { describe, expect, it } from 'vitest';
import { InputState } from '../src/engine/input';
import {
  BARRIER_LINE_Y,
  FEVER_DURATION_SECONDS,
  Game,
  INITIAL_LIVES,
  PADDLE_WIDE_WIDTH,
} from '../src/game/game';
import {
  PLAY_FIELD_HEIGHT,
  PLAY_FIELD_WIDTH,
  type AudioSink,
  type BrickEntity,
  type PowerUpKind,
} from '../src/game/types';

function createRecordingAudioSink(): {
  sink: AudioSink;
  events: string[];
} {
  const events: string[] = [];
  const sink: AudioSink = {
    paddleHit: (parryTriggered) => {
      events.push(parryTriggered ? 'paddleHit:parry' : 'paddleHit:normal');
    },
    wallHit: () => {
      events.push('wallHit');
    },
    brickHit: (_comboCount, destroyed, kind) => {
      events.push(`brickHit:${kind}:${destroyed ? 'destroyed' : 'damaged'}`);
    },
    explosion: () => {
      events.push('explosion');
    },
    laserShoot: () => {
      events.push('laserShoot');
    },
    powerUpCollect: (kind) => {
      events.push(`powerUp:${kind}`);
    },
    stageClear: () => {
      events.push('stageClear');
    },
    ballLost: () => {
      events.push('ballLost');
    },
    barrierSave: () => {
      events.push('barrierSave');
    },
    feverStart: () => {
      events.push('feverStart');
    },
    startMusic: () => {
      events.push('startMusic');
    },
    stopMusic: () => {
      events.push('stopMusic');
    },
    setIntensity: () => {},
  };
  return { sink, events };
}

describe('Game simulation and state machine', () => {
  it('initializes in ready state and transitions through start, pause, and resume', () => {
    const { sink, events } = createRecordingAudioSink();
    let recordedHighScore = 0;
    const game = new Game({
      audio: sink,
      seed: 42,
      initialHighScore: 100,
      onHighScoreChange: (highScore) => {
        recordedHighScore = highScore;
      },
      reducedMotion: true,
    });

    expect(game.getSnapshot().state).toBe('ready');
    expect(game.getSnapshot().highScore).toBe(100);
    expect(game.getSnapshot().lives).toBe(INITIAL_LIVES);

    const input = new InputState();
    game.update(0, input);
    game.update(0.016, input);
    expect(game.getSnapshot().state).toBe('ready');

    game.start(1);
    expect(game.getSnapshot().state).toBe('playing');
    expect(events).toContain('startMusic');

    game.togglePause();
    expect(game.getSnapshot().state).toBe('paused');
    expect(events).toContain('stopMusic');

    game.togglePause();
    expect(game.getSnapshot().state).toBe('playing');

    game.setReducedMotion(false);
    expect(recordedHighScore).toBe(0);
  });

  it('toggles pause via keyboard input and steers paddle with keyboard and pointer', () => {
    const game = new Game({ seed: 7 });
    const input = new InputState();
    const fakeWindow = {
      listeners: new Map<string, EventListener>(),
      addEventListener(type: string, listener: EventListener) {
        this.listeners.set(type, listener);
      },
      removeEventListener(type: string) {
        this.listeners.delete(type);
      },
    };
    input.attach(fakeWindow);
    game.start(1);

    const initialPaddleX = game.getPaddle().x;
    input.touchButtonDown('right');
    game.update(0.1, input);
    expect(game.getPaddle().x).toBeGreaterThan(initialPaddleX);
    input.touchButtonUp('right');

    input.setPointerPlayfieldX(60);
    game.update(0.5, input);
    expect(game.getPaddle().x).toBeLessThan(initialPaddleX);

    input.setPointerPlayfieldX(game.getPaddle().x + game.getPaddle().width / 2 + 2);
    game.update(0.1, input);

    fakeWindow.listeners.get('keydown')?.({
      code: 'KeyP',
      preventDefault: () => {},
    } as unknown as Event);
    game.update(0.016, input);
    expect(game.getSnapshot().state).toBe('paused');
  });

  it('launches attached ball, bounces off walls, and triggers Paddle Parry Boost on timed press', () => {
    const { sink, events } = createRecordingAudioSink();
    const game = new Game({ audio: sink, seed: 99 });
    const input = new InputState();
    game.start(1);

    input.touchButtonDown('launch');
    game.update(0.016, input);
    input.touchButtonUp('launch');

    const activeBall = game.getBalls()[0];
    expect(activeBall.attachedToPaddle).toBe(false);
    expect(activeBall.velocityY).toBeLessThan(0);

    // Move ball to left wall, right wall, and ceiling
    const mutableBall = game.getBalls()[0] as {
      x: number;
      y: number;
      velocityX: number;
      velocityY: number;
      speedPixelsPerSecond: number;
      parryBoostActive: boolean;
    };
    mutableBall.x = 2;
    mutableBall.y = 300;
    mutableBall.velocityX = -150;
    mutableBall.velocityY = -100;
    game.update(0.016, input);
    expect(mutableBall.velocityX).toBeGreaterThan(0);

    mutableBall.x = PLAY_FIELD_WIDTH - 2;
    mutableBall.velocityX = 150;
    game.update(0.016, input);
    expect(mutableBall.velocityX).toBeLessThan(0);

    mutableBall.x = 240;
    mutableBall.y = 2;
    mutableBall.velocityY = -150;
    game.update(0.016, input);
    expect(mutableBall.velocityY).toBeGreaterThan(0);
    expect(events).toContain('wallHit');

    // Position ball right above paddle moving downward and trigger Parry window
    const paddle = game.getPaddle();
    mutableBall.x = paddle.x + paddle.width / 2;
    mutableBall.y = paddle.y - 8;
    mutableBall.velocityX = 0;
    mutableBall.velocityY = 250;
    const speedBeforeParry = mutableBall.speedPixelsPerSecond;

    input.touchButtonDown('launch');
    game.update(0.016, input);
    input.touchButtonUp('launch');

    expect(mutableBall.velocityY).toBeLessThan(0);
    expect(mutableBall.parryBoostActive).toBe(true);
    expect(mutableBall.speedPixelsPerSecond).toBeGreaterThan(speedBeforeParry);
    expect(events).toContain('paddleHit:parry');
    expect(game.getRenderView().shockwaves.length).toBeGreaterThan(0);
  });

  it('handles normal paddle bounce and Magnet Catch attachment', () => {
    const game = new Game({ seed: 123 });
    const input = new InputState();
    game.start(1);

    input.touchButtonDown('launch');
    game.update(0.016, input);
    input.touchButtonUp('launch');

    const paddle = game.getPaddle();
    const mutableBall = game.getBalls()[0] as {
      x: number;
      y: number;
      velocityX: number;
      velocityY: number;
      attachedToPaddle: boolean;
    };

    // Normal bounce without parry
    mutableBall.x = paddle.x + paddle.width / 2;
    mutableBall.y = paddle.y - 6;
    mutableBall.velocityY = 220;
    game.update(0.016, input);
    expect(mutableBall.velocityY).toBeLessThan(0);
    expect(mutableBall.attachedToPaddle).toBe(false);

    // Collect magnet capsule and verify ball attaches on next paddle contact
    game.spawnCapsuleForTesting(paddle.x + paddle.width / 2, paddle.y, 'magnet');
    game.update(0.016, input);
    expect(game.getSnapshot().activePowerUpLabel).toContain('MAGNET');

    mutableBall.x = paddle.x + paddle.width / 2;
    mutableBall.y = paddle.y - 6;
    mutableBall.velocityY = 220;
    game.update(0.016, input);
    expect(mutableBall.attachedToPaddle).toBe(true);
  });

  it.each<[PowerUpKind, string]>([
    ['multiball', '3X BALL'],
    ['wide', 'WIDE'],
    ['laser', 'LASER'],
    ['pierce', 'PIERCE'],
    ['magnet', 'MAGNET'],
    ['barrier', 'BARRIER'],
  ])('collects %s capsule and applies its effect (%s)', (kind, expectedLabel) => {
    const game = new Game({ seed: 55 });
    const input = new InputState();
    game.start(1);

    const paddle = game.getPaddle();
    game.spawnCapsuleForTesting(paddle.x + paddle.width / 2, paddle.y, kind);
    game.update(0.016, input);

    expect(game.getSnapshot().activePowerUpLabel).toContain(expectedLabel);
    if (kind === 'wide') {
      game.update(0.016, input);
      expect(game.getPaddle().width).toBe(PADDLE_WIDE_WIDTH);
    }
  });

  it('fires twin lasers when laser power-up is active and damages bricks', () => {
    const { sink, events } = createRecordingAudioSink();
    const game = new Game({ audio: sink, seed: 77 });
    const input = new InputState();
    game.start(1);

    // Launch ball first so ball is in flight
    input.touchButtonDown('launch');
    game.update(0.016, input);
    input.touchButtonUp('launch');

    const paddle = game.getPaddle();
    game.spawnCapsuleForTesting(paddle.x + paddle.width / 2, paddle.y, 'laser');
    game.update(0.016, input);

    input.touchButtonDown('launch');
    game.update(0.016, input);
    input.touchButtonUp('launch');

    expect(events).toContain('laserShoot');
    expect(game.getRenderView().lasers.length).toBeGreaterThanOrEqual(2);

    // Advance simulation so lasers travel upward into the brick grid and also test out-of-bounds cleanup
    for (let step = 0; step < 30; step += 1) {
      game.update(0.03, input);
    }
    expect(game.getSnapshot().score).toBeGreaterThan(0);
  });

  it('handles all 6 brick kinds: standard, armored, explosive nova, splitter shards, indestructible, and core', () => {
    const { sink, events } = createRecordingAudioSink();
    let updatedHighScore = 0;
    const game = new Game({
      audio: sink,
      seed: 1,
      onHighScoreChange: (score) => {
        updatedHighScore = score;
      },
    });
    const input = new InputState();
    game.start(4); // Stage 4 has indestructible bumpers
    input.touchButtonDown('launch');
    game.update(0.016, input);
    input.touchButtonUp('launch');

    const stageFourBricks = game.getBricks();
    const stageFourBall = game.getBalls()[0] as {
      x: number;
      y: number;
      velocityX: number;
      velocityY: number;
    };
    const indestructibleBrick = stageFourBricks.find(
      (brick) => brick.kind === 'indestructible' && brick.alive,
    )!;
    stageFourBall.x = indestructibleBrick.x + indestructibleBrick.width / 2;
    stageFourBall.y = indestructibleBrick.y + indestructibleBrick.height - 2;
    stageFourBall.velocityX = 0;
    stageFourBall.velocityY = -200;
    game.update(0.005, input);
    expect(indestructibleBrick.alive).toBe(true);

    // Also test laser hitting indestructible brick
    game.spawnCapsuleForTesting(game.getPaddle().x + 20, game.getPaddle().y, 'laser');
    game.update(0.016, input);
    input.touchButtonDown('launch');
    game.update(0.016, input);
    input.touchButtonUp('launch');
    const activeLaser = game.getRenderView().lasers[0] as {
      x: number;
      y: number;
      velocityX: number;
      velocityY: number;
    };
    activeLaser.x = indestructibleBrick.x + 4;
    activeLaser.y = indestructibleBrick.y + 4;
    activeLaser.velocityY = -10;
    game.update(0.016, input);
    expect(indestructibleBrick.alive).toBe(true);

    game.start(10); // Stage 10 contains core, explosive, splitter, armored, standard
    input.touchButtonDown('launch');
    game.update(0.016, input);
    input.touchButtonUp('launch');

    const bricks = game.getBricks();
    const mutableBall = game.getBalls()[0] as {
      x: number;
      y: number;
      velocityX: number;
      velocityY: number;
      parryBoostActive: boolean;
      pierceRemainingSeconds: number;
    };

    const hitBrickWithBall = (
      targetBrick: Readonly<BrickEntity>,
      parry = false,
      pierce = false,
    ) => {
      mutableBall.x = targetBrick.x + targetBrick.width / 2;
      mutableBall.y = targetBrick.y + targetBrick.height - 2;
      mutableBall.velocityX = 0;
      mutableBall.velocityY = -200;
      mutableBall.parryBoostActive = parry;
      mutableBall.pierceRemainingSeconds = pierce ? 5 : 0;
      game.update(0.005, input);
    };

    const armoredBrick = bricks.find((brick) => brick.kind === 'armored' && brick.alive)!;
    const initialHitPoints = armoredBrick.hitPoints;
    hitBrickWithBall(armoredBrick);
    expect(armoredBrick.hitPoints).toBe(initialHitPoints - 1);
    expect(armoredBrick.alive).toBe(true);

    const splitterBrick = bricks.find((brick) => brick.kind === 'splitter' && brick.alive)!;
    hitBrickWithBall(splitterBrick, true);
    expect(splitterBrick.alive).toBe(false);
    expect(game.getRenderView().lasers.some((laser) => laser.fromSplitter)).toBe(true);

    const explosiveBrick = bricks.find((brick) => brick.kind === 'explosive' && brick.alive)!;
    hitBrickWithBall(explosiveBrick, true);
    expect(explosiveBrick.alive).toBe(false);
    expect(events).toContain('explosion');

    const coreBrick = bricks.find((brick) => brick.kind === 'core' && brick.alive)!;
    while (coreBrick.alive) {
      hitBrickWithBall(coreBrick, true);
    }
    expect(coreBrick.alive).toBe(false);
    expect(updatedHighScore).toBeGreaterThan(0);

    // Also test pierce ball slicing through a 1-HP standard brick without deflecting downward
    const standardBrick = bricks.find(
      (brick) => brick.kind === 'standard' && brick.alive && brick.hitPoints === 1,
    );
    if (standardBrick) {
      hitBrickWithBall(standardBrick, false, true);
      expect(standardBrick.alive).toBe(false);
      expect(mutableBall.velocityY).toBeLessThan(0);
    }
  });

  it('activates Shatter Fever after consecutive brick destructions, expires after duration, and advances stage when cleared', () => {
    const { sink, events } = createRecordingAudioSink();
    const game = new Game({ audio: sink, seed: 12 });
    const input = new InputState();
    game.start(1);

    input.touchButtonDown('launch');
    game.update(0.016, input);
    input.touchButtonUp('launch');

    const bricks = game.getBricks() as readonly BrickEntity[];
    const mutableBall = game.getBalls()[0] as {
      x: number;
      y: number;
      velocityX: number;
      velocityY: number;
      parryBoostActive: boolean;
    };

    // Destroy 14 bricks to trigger Shatter Fever (14 * 0.08 >= 1.0) and also charge while fever is active
    let destroyedCount = 0;
    for (const brick of bricks) {
      if (!brick.alive || brick.kind === 'indestructible') {
        continue;
      }
      brick.hitPoints = 1;
      mutableBall.x = brick.x + brick.width / 2;
      mutableBall.y = brick.y + brick.height / 2;
      mutableBall.velocityX = 0;
      mutableBall.velocityY = -180;
      game.update(0.005, input);
      destroyedCount += 1;
      if (destroyedCount === 14) {
        break;
      }
    }

    expect(game.getSnapshot().feverActive).toBe(true);
    expect(events).toContain('feverStart');

    // Keep ball safe above paddle while expiring fever timer
    mutableBall.velocityX = 0;
    mutableBall.velocityY = 0;
    mutableBall.y = 300;
    game.update(FEVER_DURATION_SECONDS + 0.5, input);
    expect(game.getSnapshot().feverActive).toBe(false);

    // Clear all remaining destructible bricks except one, then destroy the final brick to trigger stage advance
    const remainingDestructible = bricks.filter(
      (brick) => brick.alive && brick.kind !== 'indestructible',
    );
    for (let index = 0; index < remainingDestructible.length - 1; index += 1) {
      remainingDestructible[index].alive = false;
    }
    const finalBrick = remainingDestructible[remainingDestructible.length - 1];
    finalBrick.hitPoints = 1;
    mutableBall.x = finalBrick.x + finalBrick.width / 2;
    mutableBall.y = finalBrick.y + finalBrick.height / 2;
    mutableBall.velocityY = -150;
    game.update(0.01, input);

    expect(events).toContain('stageClear');
    expect(game.getSnapshot().stage).toBe(2);
  });

  it('saves ball with safety barrier and transitions to game over when all lives are lost', () => {
    const { sink, events } = createRecordingAudioSink();
    const game = new Game({ audio: sink, seed: 88 });
    const input = new InputState();
    game.start(1);

    // Activate barrier
    const paddle = game.getPaddle();
    game.spawnCapsuleForTesting(paddle.x + paddle.width / 2, paddle.y, 'barrier');
    game.update(0.016, input);
    expect(game.getSnapshot().barrierActive).toBe(true);

    input.touchButtonDown('launch');
    game.update(0.016, input);
    input.touchButtonUp('launch');

    const mutableBall = game.getBalls()[0] as {
      x: number;
      y: number;
      velocityX: number;
      velocityY: number;
    };
    mutableBall.x = 240;
    mutableBall.y = BARRIER_LINE_Y - 2;
    mutableBall.velocityY = 300;
    game.update(0.016, input);

    expect(events).toContain('barrierSave');
    expect(game.getSnapshot().barrierActive).toBe(false);
    expect(mutableBall.velocityY).toBeLessThan(0);

    // Lose all 3 lives
    for (let life = 0; life < INITIAL_LIVES; life += 1) {
      const currentBall = game.getBalls()[0] as {
        attachedToPaddle: boolean;
        y: number;
        velocityY: number;
      };
      currentBall.attachedToPaddle = false;
      currentBall.y = PLAY_FIELD_HEIGHT + 20;
      currentBall.velocityY = 300;
      game.update(0.016, input);
    }

    expect(game.getSnapshot().lives).toBe(0);
    expect(game.getSnapshot().state).toBe('over');
    expect(events).toContain('ballLost');

    // Also verify default NOOP audio sink, multiball 6-ball cap, offscreen laser, and missed capsule cleanup
    const defaultAudioGame = new Game();
    defaultAudioGame.start(1);
    input.setPointerPlayfieldX(460);
    defaultAudioGame.update(0.01, input);
    input.setPointerPlayfieldX(null);

    const paddleX = defaultAudioGame.getPaddle().x + 20;
    const paddleY = defaultAudioGame.getPaddle().y;
    for (let index = 0; index < 4; index += 1) {
      defaultAudioGame.spawnCapsuleForTesting(paddleX, paddleY, 'multiball');
      defaultAudioGame.update(0.001, input);
    }
    expect(defaultAudioGame.getBalls().length).toBe(6);

    // Re-attach one ball while others remain in flight, then launch
    (defaultAudioGame.getBalls()[0] as { attachedToPaddle: boolean }).attachedToPaddle = true;
    input.touchButtonDown('launch');
    defaultAudioGame.update(0.001, input);
    input.touchButtonUp('launch');

    defaultAudioGame.spawnCapsuleForTesting(paddleX, paddleY, 'laser');
    defaultAudioGame.update(0.001, input);
    input.touchButtonDown('launch');
    defaultAudioGame.update(0.001, input);
    input.touchButtonUp('launch');
    const firstLaser = defaultAudioGame.getRenderView().lasers[0] as { y: number };
    firstLaser.y = -30;
    defaultAudioGame.update(0.001, input);

    // Missed capsule falls below playfield
    defaultAudioGame.spawnCapsuleForTesting(10, PLAY_FIELD_HEIGHT - 2, 'wide');
    defaultAudioGame.update(0.2, input);
  });
});
