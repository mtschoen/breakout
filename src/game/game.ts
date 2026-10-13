// Coordinates the deterministic Breakout simulation, entity lifecycles, combos, power-ups, and stage progression.
import {
  circleIntersectsRectangle,
  computePaddleBounceVelocity,
  rectanglesOverlap,
  reflectVelocity,
} from '../engine/collision';
import type { InputState } from '../engine/input';
import { createRandom } from '../engine/random';
import { FloatingTextPool } from '../effects/floating-text';
import { ParticlePool } from '../effects/particles';
import { ScreenShake } from '../effects/screen-shake';
import { Starfield } from '../effects/starfield';
import { buildStageDefinition, countDestructibleBricks, instantiateStageBricks } from './levels';
import {
  createPowerUpCapsule,
  getPowerUpSpecification,
  pickWeightedPowerUpKind,
} from './power-ups';
import {
  PLAY_FIELD_HEIGHT,
  PLAY_FIELD_WIDTH,
  type AudioSink,
  type BallEntity,
  type BrickEntity,
  type GameSnapshot,
  type GameState,
  type LaserProjectile,
  type PaddleEntity,
  type PowerUpCapsule,
  type PowerUpKind,
  type RenderView,
  type ShockwaveRing,
  type StageDefinition,
} from './types';

export const INITIAL_LIVES = 3;
export const PADDLE_DEFAULT_WIDTH = 86;
export const PADDLE_WIDE_WIDTH = 128;
export const PADDLE_HEIGHT = 14;
export const PADDLE_Y = 584;
export const PADDLE_SPEED_PIXELS_PER_SECOND = 440;
export const PADDLE_HORIZONTAL_MARGIN = 8;

export const BALL_RADIUS = 7;
export const BASE_BALL_SPEED_PIXELS_PER_SECOND = 320;
export const MAXIMUM_BALL_SPEED_PIXELS_PER_SECOND = 560;

export const PARRY_WINDOW_SECONDS = 0.16;
export const PARRY_COOLDOWN_SECONDS = 0.36;
export const PARRY_SPEED_MULTIPLIER = 1.22;

export const LASER_FIRE_COOLDOWN_SECONDS = 0.32;
export const LASER_SPEED_Y = -520;
export const SPLITTER_SHARD_SPEED = 420;

export const FEVER_DURATION_SECONDS = 10;
export const FEVER_CHARGE_PER_BRICK = 0.08;
export const NOVA_EXPLOSION_RADIUS_PIXELS = 74;
export const BARRIER_LINE_Y = PLAY_FIELD_HEIGHT - 16;

const NOOP_AUDIO_SINK: AudioSink = {
  paddleHit: () => {},
  wallHit: () => {},
  brickHit: () => {},
  explosion: () => {},
  laserShoot: () => {},
  powerUpCollect: () => {},
  stageClear: () => {},
  ballLost: () => {},
  barrierSave: () => {},
  feverStart: () => {},
  startMusic: () => {},
  stopMusic: () => {},
  setIntensity: () => {},
};

export interface GameOptions {
  audio?: AudioSink;
  random?: () => number;
  seed?: number;
  initialHighScore?: number;
  onHighScoreChange?: (highScore: number) => void;
  reducedMotion?: boolean;
}

export class Game {
  private readonly audio: AudioSink;
  private readonly random: () => number;
  private readonly onHighScoreChange?: (highScore: number) => void;

  private readonly screenShake: ScreenShake;
  private readonly particles: ParticlePool;
  private readonly floatingTexts: FloatingTextPool;
  private readonly starfield: Starfield;

  private state: GameState = 'ready';
  private score = 0;
  private highScore = 0;
  private lives = INITIAL_LIVES;
  private stageNumber = 1;
  private currentStageDefinition: StageDefinition;

  private combo = 0;
  private multiplier = 1;
  private feverMeter = 0;
  private feverActive = false;
  private feverRemainingSeconds = 0;
  private barrierActive = false;
  private activePowerUpLabel = 'NONE';
  private stageBannerTimerSeconds = 0;

  private nextEntityIdentifier = 1;
  private paddle: PaddleEntity;
  private balls: BallEntity[] = [];
  private bricks: BrickEntity[] = [];
  private capsules: PowerUpCapsule[] = [];
  private lasers: LaserProjectile[] = [];
  private shockwaves: ShockwaveRing[] = [];

  public constructor(options: GameOptions = {}) {
    this.audio = options.audio ?? NOOP_AUDIO_SINK;
    const seededGenerator = createRandom(options.seed ?? 0x53484154);
    this.random = options.random ?? (() => seededGenerator.next());
    this.highScore = Math.max(0, Math.floor(options.initialHighScore ?? 0));
    this.onHighScoreChange = options.onHighScoreChange;

    this.screenShake = new ScreenShake({
      reducedMotion: options.reducedMotion ?? false,
      random: this.random,
    });
    this.particles = new ParticlePool(360, this.random);
    this.floatingTexts = new FloatingTextPool(48);
    this.starfield = new Starfield({ count: 64 });

    this.paddle = this.createInitialPaddle();
    this.currentStageDefinition = buildStageDefinition(1);
    this.loadStage(1, false);
  }

  public start(startingStage = 1): void {
    this.score = 0;
    this.lives = INITIAL_LIVES;
    this.combo = 0;
    this.multiplier = 1;
    this.feverMeter = 0;
    this.feverActive = false;
    this.feverRemainingSeconds = 0;
    this.barrierActive = false;
    this.activePowerUpLabel = 'NONE';
    this.particles.clear();
    this.floatingTexts.clear();
    this.screenShake.clear();
    this.shockwaves = [];

    this.loadStage(Math.max(1, Math.floor(startingStage)), true);
    this.state = 'playing';
    this.audio.startMusic();
    this.syncAudioIntensity();
  }

  public pause(): void {
    if (this.state === 'playing') {
      this.state = 'paused';
      this.audio.stopMusic();
    }
  }

  public resume(): void {
    if (this.state === 'paused') {
      this.state = 'playing';
      this.audio.startMusic();
    }
  }

  public togglePause(): void {
    if (this.state === 'playing') {
      this.pause();
    } else if (this.state === 'paused') {
      this.resume();
    }
  }

  public setReducedMotion(reducedMotion: boolean): void {
    this.screenShake.setReducedMotion(reducedMotion);
  }

  public update(deltaSeconds: number, input: InputState): void {
    if (deltaSeconds <= 0) {
      return;
    }

    if (input.consumePausePressed() && (this.state === 'playing' || this.state === 'paused')) {
      this.togglePause();
    }

    const starSpeedMultiplier = this.feverActive ? 2.4 : this.state === 'playing' ? 1.15 : 0.65;
    this.starfield.update(deltaSeconds, starSpeedMultiplier);
    this.particles.update(deltaSeconds);
    this.floatingTexts.update(deltaSeconds);
    this.screenShake.update(deltaSeconds);
    this.updateShockwaves(deltaSeconds);

    if (this.state !== 'playing') {
      return;
    }

    if (this.stageBannerTimerSeconds > 0) {
      this.stageBannerTimerSeconds = Math.max(0, this.stageBannerTimerSeconds - deltaSeconds);
    }

    this.updateBrickFlashes(deltaSeconds);
    this.updateFeverTimer(deltaSeconds);
    this.updatePaddle(deltaSeconds, input);
    this.handleActionInput(input);
    this.updateBalls(deltaSeconds);
    this.updateLasers(deltaSeconds);
    this.updateCapsules(deltaSeconds);
    this.refreshActivePowerUpLabel();
    this.syncAudioIntensity();

    if (countDestructibleBricks(this.bricks) === 0) {
      this.advanceStage();
    }
  }

  public getSnapshot(): GameSnapshot {
    return {
      state: this.state,
      score: this.score,
      highScore: this.highScore,
      lives: this.lives,
      stage: this.stageNumber,
      stageName: this.currentStageDefinition.name,
      combo: this.combo,
      multiplier: this.multiplier,
      feverActive: this.feverActive,
      feverMeter: this.feverMeter,
      feverRemainingSeconds: this.feverRemainingSeconds,
      activePowerUpLabel: this.activePowerUpLabel,
      barrierActive: this.barrierActive,
      remainingDestructibleBricks: countDestructibleBricks(this.bricks),
    };
  }

  public getRenderView(): RenderView {
    return {
      state: this.state,
      score: this.score,
      highScore: this.highScore,
      lives: this.lives,
      stage: this.stageNumber,
      stageName: this.currentStageDefinition.name,
      stageSubtitle: this.currentStageDefinition.subtitle,
      stageBannerTimerSeconds: this.stageBannerTimerSeconds,
      combo: this.combo,
      multiplier: this.multiplier,
      feverActive: this.feverActive,
      feverMeter: this.feverMeter,
      barrierActive: this.barrierActive,
      shakeOffsetX: this.screenShake.offsetX,
      shakeOffsetY: this.screenShake.offsetY,
      paddle: this.paddle,
      balls: this.balls,
      bricks: this.bricks,
      capsules: this.capsules,
      lasers: this.lasers,
      shockwaves: this.shockwaves,
      stars: this.starfield.getStars(),
      particles: this.particles.toRenderViews(),
      floatingTexts: this.floatingTexts.toRenderViews(),
    };
  }

  public getBricks(): readonly Readonly<BrickEntity>[] {
    return this.bricks;
  }

  public getBalls(): readonly Readonly<BallEntity>[] {
    return this.balls;
  }

  public getPaddle(): Readonly<PaddleEntity> {
    return this.paddle;
  }

  public spawnCapsuleForTesting(x: number, y: number, kind: PowerUpKind): void {
    this.capsules.push(createPowerUpCapsule(this.allocateIdentifier(), x, y, kind));
  }

  private allocateIdentifier(): number {
    const identifier = this.nextEntityIdentifier;
    this.nextEntityIdentifier += 1;
    return identifier;
  }

  private createInitialPaddle(): PaddleEntity {
    return {
      x: (PLAY_FIELD_WIDTH - PADDLE_DEFAULT_WIDTH) / 2,
      y: PADDLE_Y,
      width: PADDLE_DEFAULT_WIDTH,
      baseWidth: PADDLE_DEFAULT_WIDTH,
      height: PADDLE_HEIGHT,
      velocityX: 0,
      speedPixelsPerSecond: PADDLE_SPEED_PIXELS_PER_SECOND,
      scaleX: 1,
      scaleY: 1,
      parryWindowRemainingSeconds: 0,
      parryCooldownRemainingSeconds: 0,
      parryCharged: false,
      wideRemainingSeconds: 0,
      laserRemainingSeconds: 0,
      laserCooldownRemainingSeconds: 0,
      magnetRemainingSeconds: 0,
    };
  }

  private loadStage(stageNumber: number, showBanner: boolean): void {
    this.stageNumber = stageNumber;
    this.currentStageDefinition = buildStageDefinition(stageNumber);
    this.bricks = instantiateStageBricks(this.currentStageDefinition);
    this.capsules = [];
    this.lasers = [];
    this.paddle = this.createInitialPaddle();
    this.balls = [this.createAttachedBall(0)];
    this.stageBannerTimerSeconds = showBanner ? 2.2 : 0;
  }

  private createAttachedBall(attachmentOffsetX: number): BallEntity {
    const baseSpeed =
      BASE_BALL_SPEED_PIXELS_PER_SECOND * this.currentStageDefinition.ballSpeedMultiplier;
    const clampedSpeed = Math.min(MAXIMUM_BALL_SPEED_PIXELS_PER_SECOND, baseSpeed);
    const paddleCenterX = this.paddle.x + this.paddle.width / 2;
    return {
      identifier: this.allocateIdentifier(),
      x: paddleCenterX + attachmentOffsetX,
      y: this.paddle.y - BALL_RADIUS - 1,
      velocityX: 0,
      velocityY: 0,
      speedPixelsPerSecond: clampedSpeed,
      radius: BALL_RADIUS,
      attachedToPaddle: true,
      attachmentOffsetX,
      launchAngleRadians: -Math.PI / 2 + (this.random() - 0.5) * 0.35,
      pierceRemainingSeconds: 0,
      parryBoostActive: false,
      trail: [],
      alive: true,
    };
  }

  private updateBrickFlashes(deltaSeconds: number): void {
    for (const brick of this.bricks) {
      if (brick.alive && brick.flashTimerSeconds > 0) {
        brick.flashTimerSeconds = Math.max(0, brick.flashTimerSeconds - deltaSeconds);
      }
    }
  }

  private updateFeverTimer(deltaSeconds: number): void {
    if (!this.feverActive) {
      return;
    }
    this.feverRemainingSeconds = Math.max(0, this.feverRemainingSeconds - deltaSeconds);
    this.feverMeter = this.feverRemainingSeconds / FEVER_DURATION_SECONDS;
    if (this.feverRemainingSeconds <= 0) {
      this.feverActive = false;
      this.feverMeter = 0;
      this.recalculateMultiplier();
    }
  }

  private updatePaddle(deltaSeconds: number, input: InputState): void {
    const previousX = this.paddle.x;

    this.paddle.parryWindowRemainingSeconds = Math.max(
      0,
      this.paddle.parryWindowRemainingSeconds - deltaSeconds,
    );
    this.paddle.parryCooldownRemainingSeconds = Math.max(
      0,
      this.paddle.parryCooldownRemainingSeconds - deltaSeconds,
    );
    this.paddle.wideRemainingSeconds = Math.max(0, this.paddle.wideRemainingSeconds - deltaSeconds);
    this.paddle.laserRemainingSeconds = Math.max(
      0,
      this.paddle.laserRemainingSeconds - deltaSeconds,
    );
    this.paddle.laserCooldownRemainingSeconds = Math.max(
      0,
      this.paddle.laserCooldownRemainingSeconds - deltaSeconds,
    );
    this.paddle.magnetRemainingSeconds = Math.max(
      0,
      this.paddle.magnetRemainingSeconds - deltaSeconds,
    );

    const targetWidth =
      this.paddle.wideRemainingSeconds > 0 ? PADDLE_WIDE_WIDTH : this.paddle.baseWidth;
    if (this.paddle.width !== targetWidth) {
      const centerX = this.paddle.x + this.paddle.width / 2;
      this.paddle.width = targetWidth;
      this.paddle.x = centerX - targetWidth / 2;
    }

    const axisX = input.axisX;
    if (axisX !== 0) {
      this.paddle.x += axisX * this.paddle.speedPixelsPerSecond * deltaSeconds;
    } else if (input.pointerPlayfieldX !== null) {
      const desiredX = input.pointerPlayfieldX - this.paddle.width / 2;
      const maximumStep = this.paddle.speedPixelsPerSecond * 1.85 * deltaSeconds;
      const difference = desiredX - this.paddle.x;
      if (Math.abs(difference) <= maximumStep) {
        this.paddle.x = desiredX;
      } else {
        this.paddle.x += Math.sign(difference) * maximumStep;
      }
    }

    const minimumX = PADDLE_HORIZONTAL_MARGIN;
    const maximumX = PLAY_FIELD_WIDTH - PADDLE_HORIZONTAL_MARGIN - this.paddle.width;
    this.paddle.x = Math.max(minimumX, Math.min(maximumX, this.paddle.x));
    this.paddle.velocityX = (this.paddle.x - previousX) / deltaSeconds;

    const recoveryFactor = Math.min(1, deltaSeconds * 14);
    this.paddle.scaleX += (1 - this.paddle.scaleX) * recoveryFactor;
    this.paddle.scaleY += (1 - this.paddle.scaleY) * recoveryFactor;
  }

  private handleActionInput(input: InputState): void {
    const launchPressed = input.consumeLaunchPressed();
    const hasAttachedBall = this.balls.some((ball) => ball.alive && ball.attachedToPaddle);

    if (launchPressed) {
      if (hasAttachedBall) {
        this.launchAttachedBalls();
      } else if (this.paddle.parryCooldownRemainingSeconds <= 0) {
        this.paddle.parryWindowRemainingSeconds = PARRY_WINDOW_SECONDS;
        this.paddle.parryCooldownRemainingSeconds = PARRY_COOLDOWN_SECONDS;
        this.paddle.scaleX = 1.12;
        this.paddle.scaleY = 0.86;
      }
    }

    const hasInFlightBall = this.balls.some((ball) => ball.alive && !ball.attachedToPaddle);
    if (
      hasInFlightBall &&
      this.paddle.laserRemainingSeconds > 0 &&
      this.paddle.laserCooldownRemainingSeconds <= 0 &&
      (launchPressed || input.launchHeld)
    ) {
      this.fireTwinLasers();
      this.paddle.laserCooldownRemainingSeconds = LASER_FIRE_COOLDOWN_SECONDS;
    }
  }

  private launchAttachedBalls(): void {
    for (const ball of this.balls) {
      if (!ball.attachedToPaddle) {
        continue;
      }
      ball.attachedToPaddle = false;
      const offsetRatio = Math.max(
        -0.65,
        Math.min(0.65, ball.attachmentOffsetX / Math.max(1, this.paddle.width / 2)),
      );
      const launchAngle = offsetRatio * 0.65;
      ball.velocityX = Math.sin(launchAngle) * ball.speedPixelsPerSecond;
      ball.velocityY = -Math.cos(launchAngle) * ball.speedPixelsPerSecond;
    }
    this.paddle.scaleX = 1.14;
    this.paddle.scaleY = 0.84;
    this.audio.paddleHit(false);
  }

  private fireTwinLasers(): void {
    for (const offsetX of [8, this.paddle.width - 12]) {
      this.lasers.push({
        identifier: this.allocateIdentifier(),
        x: this.paddle.x + offsetX,
        y: this.paddle.y - 12,
        velocityX: 0,
        velocityY: LASER_SPEED_Y,
        width: 4,
        height: 14,
        damage: 1,
        color: '#f87171',
        fromSplitter: false,
        alive: true,
      });
    }
    this.audio.laserShoot();
  }

  private updateBalls(deltaSeconds: number): void {
    for (const ball of this.balls) {
      if (ball.pierceRemainingSeconds > 0) {
        ball.pierceRemainingSeconds = Math.max(0, ball.pierceRemainingSeconds - deltaSeconds);
      }

      if (ball.attachedToPaddle) {
        const halfWidth = this.paddle.width / 2 - ball.radius;
        const clampedOffset = Math.max(-halfWidth, Math.min(halfWidth, ball.attachmentOffsetX));
        ball.x = this.paddle.x + this.paddle.width / 2 + clampedOffset;
        ball.y = this.paddle.y - ball.radius - 1;
        continue;
      }

      this.recordBallTrail(ball);

      ball.x += ball.velocityX * deltaSeconds;
      ball.y += ball.velocityY * deltaSeconds;

      this.handleBallWallCollisions(ball);
      this.handleBallBarrierCollision(ball);
      this.handleBallPaddleCollision(ball);
      this.handleBallBrickCollisions(ball);

      if (ball.y - ball.radius > PLAY_FIELD_HEIGHT) {
        ball.alive = false;
      }
    }

    this.balls = this.balls.filter((ball) => ball.alive);
    if (this.balls.length === 0) {
      this.handleAllBallsLost();
    }
  }

  private recordBallTrail(ball: BallEntity): void {
    const color = ball.parryBoostActive
      ? '#fde047'
      : ball.pierceRemainingSeconds > 0
        ? '#fb923c'
        : '#38bdf8';
    ball.trail.unshift({
      x: ball.x,
      y: ball.y,
      radius: ball.radius * 0.85,
      alpha: 0.55,
      color,
    });
    if (ball.trail.length > 9) {
      ball.trail.length = 9;
    }
    for (let index = 0; index < ball.trail.length; index += 1) {
      ball.trail[index].alpha = Math.max(0.05, 0.55 * (1 - index / 9));
      ball.trail[index].radius = Math.max(2, ball.radius * (0.85 - index * 0.07));
    }
  }

  private handleBallWallCollisions(ball: BallEntity): void {
    if (ball.x - ball.radius < 0) {
      ball.x = ball.radius;
      ball.velocityX = Math.abs(ball.velocityX);
      this.audio.wallHit();
    } else if (ball.x + ball.radius > PLAY_FIELD_WIDTH) {
      ball.x = PLAY_FIELD_WIDTH - ball.radius;
      ball.velocityX = -Math.abs(ball.velocityX);
      this.audio.wallHit();
    }

    if (ball.y - ball.radius < 0) {
      ball.y = ball.radius;
      ball.velocityY = Math.abs(ball.velocityY);
      this.audio.wallHit();
    }
  }

  private handleBallBarrierCollision(ball: BallEntity): void {
    if (!this.barrierActive || ball.velocityY <= 0) {
      return;
    }
    if (ball.y + ball.radius >= BARRIER_LINE_Y) {
      ball.y = BARRIER_LINE_Y - ball.radius;
      ball.velocityY = -Math.abs(ball.velocityY);
      this.barrierActive = false;
      this.audio.barrierSave();
      this.spawnShockwave(ball.x, BARRIER_LINE_Y, 64, '#facc15', 3.5);
      this.floatingTexts.spawn(ball.x, BARRIER_LINE_Y - 12, 'BARRIER SAVE!', '#facc15');
    }
  }

  private handleBallPaddleCollision(ball: BallEntity): void {
    if (ball.velocityY <= 0) {
      return;
    }

    const collision = circleIntersectsRectangle(ball.x, ball.y, ball.radius, this.paddle);
    if (!collision.hit) {
      return;
    }

    const parryTriggered = this.paddle.parryWindowRemainingSeconds > 0 || this.paddle.parryCharged;

    if (this.paddle.magnetRemainingSeconds > 0 && !parryTriggered) {
      ball.attachedToPaddle = true;
      ball.attachmentOffsetX = ball.x - (this.paddle.x + this.paddle.width / 2);
      ball.velocityX = 0;
      ball.velocityY = 0;
      ball.y = this.paddle.y - ball.radius - 1;
      this.combo = 0;
      this.recalculateMultiplier();
      this.audio.paddleHit(false);
      return;
    }

    if (parryTriggered) {
      ball.parryBoostActive = true;
      ball.speedPixelsPerSecond = Math.min(
        MAXIMUM_BALL_SPEED_PIXELS_PER_SECOND,
        ball.speedPixelsPerSecond * PARRY_SPEED_MULTIPLIER,
      );
      this.paddle.parryWindowRemainingSeconds = 0;
      this.paddle.parryCharged = false;
      this.paddle.scaleX = 1.24;
      this.paddle.scaleY = 0.72;
      this.screenShake.addTrauma(0.32);
      this.spawnShockwave(ball.x, this.paddle.y, 58, '#fde047', 3.5);
      this.particles.burst(ball.x, this.paddle.y, {
        count: 16,
        speed: 180,
        color: '#fde047',
        lifeSeconds: 0.45,
      });
      this.floatingTexts.spawn(ball.x, this.paddle.y - 16, 'PRISM SMASH!', '#fde047');
    } else {
      this.combo = 0;
      this.recalculateMultiplier();
      this.paddle.scaleX = 1.12;
      this.paddle.scaleY = 0.86;
    }

    const bounceVelocity = computePaddleBounceVelocity(
      ball.x,
      this.paddle.x,
      this.paddle.width,
      this.paddle.velocityX,
      ball.speedPixelsPerSecond,
    );
    ball.velocityX = bounceVelocity.x;
    ball.velocityY = bounceVelocity.y;
    ball.y = this.paddle.y - ball.radius - 1;
    this.audio.paddleHit(parryTriggered);
  }

  private handleBallBrickCollisions(ball: BallEntity): void {
    for (const brick of this.bricks) {
      if (!brick.alive) {
        continue;
      }

      const collision = circleIntersectsRectangle(ball.x, ball.y, ball.radius, brick);
      if (!collision.hit) {
        continue;
      }

      if (brick.kind === 'indestructible') {
        this.deflectBallFromBrick(
          ball,
          collision.normalX,
          collision.normalY,
          collision.penetration,
        );
        brick.flashTimerSeconds = 0.12;
        ball.speedPixelsPerSecond = Math.min(
          MAXIMUM_BALL_SPEED_PIXELS_PER_SECOND,
          ball.speedPixelsPerSecond * 1.03,
        );
        this.audio.brickHit(this.combo, false, brick.kind);
        this.particles.burst(collision.contactX, collision.contactY, {
          count: 6,
          speed: 110,
          color: '#eab308',
          lifeSeconds: 0.3,
        });
        break;
      }

      const damage = ball.parryBoostActive ? 2 : 1;
      const canPierceThrough =
        ball.pierceRemainingSeconds > 0 && brick.hitPoints <= damage && brick.kind !== 'core';

      if (!canPierceThrough) {
        this.deflectBallFromBrick(
          ball,
          collision.normalX,
          collision.normalY,
          collision.penetration,
        );
      }

      if (ball.parryBoostActive) {
        ball.parryBoostActive = false;
        this.spawnShockwave(collision.contactX, collision.contactY, 44, '#fde047', 3);
      }

      this.applyDamageToBrick(brick, damage);
      break;
    }
  }

  private deflectBallFromBrick(
    ball: BallEntity,
    normalX: number,
    normalY: number,
    penetration: number,
  ): void {
    ball.x += normalX * penetration;
    ball.y += normalY * penetration;
    const reflected = reflectVelocity(ball.velocityX, ball.velocityY, normalX, normalY);
    ball.velocityX = reflected.x;
    ball.velocityY = reflected.y;
  }

  private applyDamageToBrick(brick: BrickEntity, damage: number): void {
    brick.hitPoints = Math.max(0, brick.hitPoints - damage);
    brick.flashTimerSeconds = 0.14;
    this.combo += 1;
    this.recalculateMultiplier();

    const brickCenterX = brick.x + brick.width / 2;
    const brickCenterY = brick.y + brick.height / 2;

    if (brick.hitPoints > 0) {
      this.audio.brickHit(this.combo, false, brick.kind);
      this.screenShake.addTrauma(0.12);
      this.particles.burst(brickCenterX, brickCenterY, {
        count: 8,
        speed: 120,
        color: brick.color,
        lifeSeconds: 0.35,
      });
      return;
    }

    this.destroyBrick(brick);
  }

  private destroyBrick(brick: BrickEntity): void {
    brick.alive = false;

    const brickCenterX = brick.x + brick.width / 2;
    const brickCenterY = brick.y + brick.height / 2;

    const awardedPoints = brick.points * this.multiplier;
    this.addScore(awardedPoints);
    this.chargeFever(FEVER_CHARGE_PER_BRICK);

    this.audio.brickHit(this.combo, true, brick.kind);
    this.screenShake.addTrauma(brick.kind === 'core' ? 0.45 : 0.2);

    this.particles.burst(brickCenterX, brickCenterY, {
      count: brick.kind === 'core' ? 28 : 14,
      speed: brick.kind === 'core' ? 210 : 150,
      color: brick.color,
      lifeSeconds: 0.55,
      gravity: 140,
    });

    const calloutText =
      this.combo >= 4 ? `+${awardedPoints} (${this.combo}x)` : `+${awardedPoints}`;
    this.floatingTexts.spawn(brickCenterX, brickCenterY, calloutText, brick.color);

    if (this.random() < this.currentStageDefinition.powerUpDropChance) {
      const powerUpKind = pickWeightedPowerUpKind(this.random());
      this.capsules.push(
        createPowerUpCapsule(this.allocateIdentifier(), brickCenterX, brickCenterY, powerUpKind),
      );
    }

    if (brick.kind === 'explosive') {
      this.triggerNovaExplosion(brickCenterX, brickCenterY);
    } else if (brick.kind === 'splitter') {
      this.spawnSplitterShards(brickCenterX, brickCenterY);
    } else if (brick.kind === 'core') {
      this.spawnShockwave(brickCenterX, brickCenterY, 84, '#f472b6', 4);
    }
  }

  private triggerNovaExplosion(originX: number, originY: number): void {
    this.audio.explosion();
    this.screenShake.addTrauma(0.55);
    this.spawnShockwave(originX, originY, NOVA_EXPLOSION_RADIUS_PIXELS, '#fb923c', 4);
    this.particles.burst(originX, originY, {
      count: 26,
      speed: 220,
      color: '#fb923c',
      lifeSeconds: 0.65,
    });
    this.floatingTexts.spawn(originX, originY - 10, 'NOVA BLAST!', '#fb923c');

    for (const neighbor of this.bricks) {
      if (!neighbor.alive || neighbor.kind === 'indestructible') {
        continue;
      }
      const neighborCenterX = neighbor.x + neighbor.width / 2;
      const neighborCenterY = neighbor.y + neighbor.height / 2;
      const distance = Math.hypot(neighborCenterX - originX, neighborCenterY - originY);
      if (distance <= NOVA_EXPLOSION_RADIUS_PIXELS) {
        this.applyDamageToBrick(neighbor, 2);
      }
    }
  }

  private spawnSplitterShards(originX: number, originY: number): void {
    const angles = [-Math.PI / 2 - 0.38, -Math.PI / 2 + 0.38];
    for (const angle of angles) {
      this.lasers.push({
        identifier: this.allocateIdentifier(),
        x: originX - 3,
        y: originY - 8,
        velocityX: Math.cos(angle) * SPLITTER_SHARD_SPEED,
        velocityY: Math.sin(angle) * SPLITTER_SHARD_SPEED,
        width: 6,
        height: 14,
        damage: 1,
        color: '#2dd4bf',
        fromSplitter: true,
        alive: true,
      });
    }
    this.spawnShockwave(originX, originY, 46, '#2dd4bf', 2.5);
  }

  private updateLasers(deltaSeconds: number): void {
    for (const laser of this.lasers) {
      laser.x += laser.velocityX * deltaSeconds;
      laser.y += laser.velocityY * deltaSeconds;

      if (laser.y + laser.height < 0 || laser.x + laser.width < 0 || laser.x > PLAY_FIELD_WIDTH) {
        laser.alive = false;
        continue;
      }

      for (const brick of this.bricks) {
        if (!brick.alive) {
          continue;
        }
        if (rectanglesOverlap(laser, brick)) {
          laser.alive = false;
          if (brick.kind !== 'indestructible') {
            this.applyDamageToBrick(brick, laser.damage);
          } else {
            brick.flashTimerSeconds = 0.1;
            this.audio.wallHit();
          }
          break;
        }
      }
    }

    this.lasers = this.lasers.filter((laser) => laser.alive);
  }

  private updateCapsules(deltaSeconds: number): void {
    for (const capsule of this.capsules) {
      capsule.y += capsule.velocityY * deltaSeconds;

      if (capsule.y > PLAY_FIELD_HEIGHT) {
        capsule.alive = false;
        continue;
      }

      if (rectanglesOverlap(capsule, this.paddle)) {
        capsule.alive = false;
        this.activatePowerUp(capsule);
      }
    }

    this.capsules = this.capsules.filter((capsule) => capsule.alive);
  }

  private activatePowerUp(capsule: PowerUpCapsule): void {
    const specification = getPowerUpSpecification(capsule.kind);
    this.audio.powerUpCollect(capsule.kind);
    this.addScore(150 * this.multiplier);
    this.floatingTexts.spawn(
      capsule.x + capsule.width / 2,
      this.paddle.y - 18,
      specification.displayName.toUpperCase(),
      specification.color,
    );
    this.particles.burst(capsule.x + capsule.width / 2, this.paddle.y, {
      count: 14,
      speed: 150,
      color: specification.color,
      lifeSeconds: 0.45,
    });

    switch (capsule.kind) {
      case 'multiball':
        this.spawnMultiBalls();
        break;
      case 'wide':
        this.paddle.wideRemainingSeconds = specification.durationSeconds;
        break;
      case 'laser':
        this.paddle.laserRemainingSeconds = specification.durationSeconds;
        break;
      case 'pierce':
        for (const ball of this.balls) {
          ball.pierceRemainingSeconds = specification.durationSeconds;
        }
        break;
      case 'magnet':
        this.paddle.magnetRemainingSeconds = specification.durationSeconds;
        break;
      case 'barrier':
        this.barrierActive = true;
        break;
    }
  }

  private spawnMultiBalls(): void {
    const referenceBall = this.balls[0];
    if (referenceBall.attachedToPaddle) {
      this.launchAttachedBalls();
    }

    const baseSpeed = referenceBall.speedPixelsPerSecond;
    const spreadAngles = [-0.42, 0.42];
    for (const offsetAngle of spreadAngles) {
      if (this.balls.length >= 6) {
        break;
      }
      const currentAngle = Math.atan2(referenceBall.velocityY, referenceBall.velocityX);
      const nextAngle = currentAngle + offsetAngle;
      this.balls.push({
        identifier: this.allocateIdentifier(),
        x: referenceBall.x,
        y: referenceBall.y,
        velocityX: Math.cos(nextAngle) * baseSpeed,
        velocityY: -Math.abs(Math.sin(nextAngle) * baseSpeed),
        speedPixelsPerSecond: baseSpeed,
        radius: BALL_RADIUS,
        attachedToPaddle: false,
        attachmentOffsetX: 0,
        launchAngleRadians: nextAngle,
        pierceRemainingSeconds: referenceBall.pierceRemainingSeconds,
        parryBoostActive: false,
        trail: [],
        alive: true,
      });
    }
  }

  private handleAllBallsLost(): void {
    this.lives -= 1;
    this.combo = 0;
    this.recalculateMultiplier();
    this.audio.ballLost();
    this.screenShake.addTrauma(0.5);

    if (this.lives <= 0) {
      this.lives = 0;
      this.state = 'over';
      this.audio.stopMusic();
      return;
    }

    this.balls = [this.createAttachedBall(0)];
  }

  private advanceStage(): void {
    this.audio.stageClear();
    this.addScore(500 * this.stageNumber);
    const nextStageNumber = this.stageNumber + 1;
    this.loadStage(nextStageNumber, true);
    this.floatingTexts.spawn(
      PLAY_FIELD_WIDTH / 2,
      PLAY_FIELD_HEIGHT / 2,
      'STAGE CLEAR!',
      '#38bdf8',
      { lifeSeconds: 1.2 },
    );
  }

  private addScore(points: number): void {
    this.score += Math.max(0, Math.floor(points));
    if (this.score > this.highScore) {
      this.highScore = this.score;
      this.onHighScoreChange?.(this.highScore);
    }
  }

  private chargeFever(amount: number): void {
    if (this.feverActive) {
      this.feverRemainingSeconds = Math.min(
        FEVER_DURATION_SECONDS,
        this.feverRemainingSeconds + amount * 2.5,
      );
      this.feverMeter = this.feverRemainingSeconds / FEVER_DURATION_SECONDS;
      return;
    }

    this.feverMeter = Math.min(1, this.feverMeter + amount);
    if (this.feverMeter >= 1) {
      this.feverActive = true;
      this.feverRemainingSeconds = FEVER_DURATION_SECONDS;
      this.recalculateMultiplier();
      this.audio.feverStart();
      this.spawnShockwave(PLAY_FIELD_WIDTH / 2, PLAY_FIELD_HEIGHT / 2, 180, '#f472b6', 4);
      this.floatingTexts.spawn(
        PLAY_FIELD_WIDTH / 2,
        PLAY_FIELD_HEIGHT / 2 - 20,
        'SHATTER FEVER! 2X SCORE',
        '#f472b6',
        { lifeSeconds: 1.3 },
      );
    }
  }

  private recalculateMultiplier(): void {
    const comboTier = 1 + Math.min(4, Math.floor(this.combo / 4));
    this.multiplier = this.feverActive ? comboTier * 2 : comboTier;
  }

  private refreshActivePowerUpLabel(): void {
    const activeLabels: string[] = [];
    if (this.paddle.wideRemainingSeconds > 0) {
      activeLabels.push('WIDE');
    }
    if (this.paddle.laserRemainingSeconds > 0) {
      activeLabels.push('LASER');
    }
    if (this.paddle.magnetRemainingSeconds > 0) {
      activeLabels.push('MAGNET');
    }
    if (this.balls.some((ball) => ball.pierceRemainingSeconds > 0)) {
      activeLabels.push('PIERCE');
    }
    if (this.barrierActive) {
      activeLabels.push('BARRIER');
    }
    if (this.balls.length > 1) {
      activeLabels.push(`${this.balls.length}X BALL`);
    }
    this.activePowerUpLabel = activeLabels.length > 0 ? activeLabels.join(' + ') : 'NONE';
  }

  private syncAudioIntensity(): void {
    const comboFactor = Math.min(0.6, this.combo * 0.05);
    const feverFactor = this.feverActive ? 0.4 : 0;
    const multiBallFactor = this.balls.length > 1 ? 0.2 : 0;
    const intensity = Math.min(1, comboFactor + feverFactor + multiBallFactor);
    this.audio.setIntensity(intensity);
  }

  private spawnShockwave(
    x: number,
    y: number,
    maximumRadius: number,
    color: string,
    lineWidth: number,
  ): void {
    this.shockwaves.push({
      x,
      y,
      currentRadius: 6,
      maximumRadius,
      alpha: 0.9,
      color,
      lineWidth,
    });
  }

  private updateShockwaves(deltaSeconds: number): void {
    for (const wave of this.shockwaves) {
      wave.currentRadius +=
        (wave.maximumRadius - wave.currentRadius) * Math.min(1, deltaSeconds * 9);
      wave.alpha = Math.max(0, wave.alpha - deltaSeconds * 2.1);
    }
    this.shockwaves = this.shockwaves.filter((wave) => wave.alpha > 0.02);
  }
}
