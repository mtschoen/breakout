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
  type JuiceSettings,
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

const DEFAULT_BURST_SPEED_VARIANCE = 0.55;
const DEFAULT_BURST_SIZE_VARIANCE = 0.4;

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
    const baseSeed = options.seed ?? 0x53484154;
    const seededGenerator = createRandom(baseSeed);
    const effectsGenerator = createRandom(baseSeed ^ 0x9e3779b9);
    this.random = options.random ?? (() => seededGenerator.next());
    const effectsRandom = options.random ?? (() => effectsGenerator.next());
    this.highScore = Math.max(0, Math.floor(options.initialHighScore ?? 0));
    this.onHighScoreChange = options.onHighScoreChange;

    this.screenShake = new ScreenShake({
      maximumOffsetPixels: 4.5,
      decayPerSecond: 2.6,
      reducedMotion: options.reducedMotion ?? false,
      random: effectsRandom,
    });
    this.particles = new ParticlePool(960, effectsRandom);
    this.particles.reducedMotion = options.reducedMotion ?? false;
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
    this.particles.reducedMotion = reducedMotion;
  }

  public setJuiceSettings(settings: Partial<JuiceSettings>): void {
    if (typeof settings.particleDensity === 'number') {
      this.particles.densityMultiplier = settings.particleDensity;
    }
    if (typeof settings.particleSize === 'number') {
      this.particles.sizeMultiplier = settings.particleSize;
    }
    if (typeof settings.screenShake === 'number') {
      this.screenShake.intensityMultiplier = settings.screenShake;
    }
    if (typeof settings.reducedMotion === 'boolean') {
      this.setReducedMotion(settings.reducedMotion);
    }
  }

  public previewJuiceImpact(): void {
    const centerX = PLAY_FIELD_WIDTH / 2;
    const centerY = PLAY_FIELD_HEIGHT * 0.44;
    this.audio.brickHit(4, true, 'core');
    this.screenShake.addTrauma(0.65);
    this.spawnShockwave(centerX, centerY, 72, '#f472b6', 3.5);
    this.spawnShockwave(centerX, centerY, 44, '#38bdf8', 2.2);
    this.particles.burst(centerX, centerY, {
      count: 34,
      speed: 255,
      speedVariance: DEFAULT_BURST_SPEED_VARIANCE,
      size: 5.8,
      sizeVariance: DEFAULT_BURST_SIZE_VARIANCE,
      spreadRadius: 14,
      palette: ['#f472b6', '#38bdf8', '#fde047', '#ffffff'],
      lifeSeconds: 0.65,
      gravity: 165,
      drag: 1.3,
    });
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
      const maximumStep = this.paddle.speedPixelsPerSecond * 2.6 * deltaSeconds;
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
        : this.feverActive
          ? '#f472b6'
          : '#38bdf8';
    ball.trail.unshift({
      x: ball.x,
      y: ball.y,
      radius: ball.radius * 0.92,
      alpha: 0.68,
      color,
    });
    if (ball.trail.length > 12) {
      ball.trail.length = 12;
    }
    for (let index = 0; index < ball.trail.length; index += 1) {
      ball.trail[index].alpha = Math.max(0.06, 0.68 * (1 - index / 12));
      ball.trail[index].radius = Math.max(2, ball.radius * (0.92 - index * 0.06));
    }

    const reverseAngle = Math.atan2(-ball.velocityY, -ball.velocityX);
    const trailPalette = ball.parryBoostActive
      ? ['#fde047', '#ffffff', '#38bdf8']
      : ball.pierceRemainingSeconds > 0
        ? ['#fb923c', '#fef08a', '#ef4444']
        : this.feverActive
          ? ['#f472b6', '#67e8f9', '#fde047']
          : ['#38bdf8', '#67e8f9', '#c084fc'];
    this.particles.burst(ball.x, ball.y, {
      count: ball.parryBoostActive || ball.pierceRemainingSeconds > 0 ? 2 : 1,
      speed: 55,
      speedVariance: DEFAULT_BURST_SPEED_VARIANCE,
      size: ball.parryBoostActive ? 4.2 : 3.2,
      sizeVariance: DEFAULT_BURST_SIZE_VARIANCE,
      lifeSeconds: 0.22,
      spreadRadius: 3,
      directionRadians: reverseAngle,
      spreadRadians: 0.9,
      palette: trailPalette,
      drag: 1.5,
    });
  }

  private emitWallBounceSparks(x: number, y: number, directionRadians: number): void {
    this.audio.wallHit();
    this.screenShake.addTrauma(0.16);
    this.particles.burst(x, y, {
      count: 10,
      speed: 170,
      speedVariance: DEFAULT_BURST_SPEED_VARIANCE,
      size: 4.5,
      sizeVariance: DEFAULT_BURST_SIZE_VARIANCE,
      directionRadians,
      spreadRadians: Math.PI * 0.65,
      palette: ['#38bdf8', '#ffffff', '#c084fc'],
      lifeSeconds: 0.35,
      drag: 1.4,
    });
  }

  private handleBallWallCollisions(ball: BallEntity): void {
    if (ball.x - ball.radius < 0) {
      ball.x = ball.radius;
      ball.velocityX = Math.abs(ball.velocityX);
      this.emitWallBounceSparks(ball.x, ball.y, 0);
    } else if (ball.x + ball.radius > PLAY_FIELD_WIDTH) {
      ball.x = PLAY_FIELD_WIDTH - ball.radius;
      ball.velocityX = -Math.abs(ball.velocityX);
      this.emitWallBounceSparks(ball.x, ball.y, Math.PI);
    }

    if (ball.y - ball.radius < 0) {
      ball.y = ball.radius;
      ball.velocityY = Math.abs(ball.velocityY);
      this.emitWallBounceSparks(ball.x, ball.y, Math.PI / 2);
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
      this.screenShake.addTrauma(0.46);
      this.spawnShockwave(ball.x, BARRIER_LINE_Y, 76, '#facc15', 4);
      this.particles.burst(ball.x, BARRIER_LINE_Y, {
        count: 26,
        speed: 220,
        speedVariance: 0.6,
        size: 5.5,
        sizeVariance: DEFAULT_BURST_SIZE_VARIANCE,
        directionRadians: -Math.PI / 2,
        spreadRadians: Math.PI * 0.85,
        palette: ['#facc15', '#ffffff', '#67e8f9'],
        lifeSeconds: 0.55,
        gravity: 140,
        drag: 1.2,
      });
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
      this.screenShake.addTrauma(0.18);
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
      this.paddle.scaleX = 1.28;
      this.paddle.scaleY = 0.68;
      this.screenShake.addTrauma(0.55);
      this.spawnShockwave(ball.x, this.paddle.y, 74, '#fde047', 4);
      this.spawnShockwave(ball.x, this.paddle.y, 46, '#38bdf8', 2.5);
      this.particles.burst(ball.x, this.paddle.y, {
        count: 34,
        speed: 260,
        speedVariance: 0.6,
        size: 6,
        sizeVariance: DEFAULT_BURST_SIZE_VARIANCE,
        spreadRadius: 12,
        palette: ['#fde047', '#ffffff', '#38bdf8', '#f472b6'],
        lifeSeconds: 0.58,
        lifeVariance: 0.3,
        gravity: 130,
        drag: 1.2,
      });
      this.floatingTexts.spawn(ball.x, this.paddle.y - 16, 'PRISM SMASH!', '#fde047');
    } else {
      this.combo = 0;
      this.recalculateMultiplier();
      this.paddle.scaleX = 1.15;
      this.paddle.scaleY = 0.84;
      this.screenShake.addTrauma(0.26);
      this.particles.burst(ball.x, this.paddle.y, {
        count: 12,
        speed: 175,
        speedVariance: DEFAULT_BURST_SPEED_VARIANCE,
        size: 4.6,
        sizeVariance: DEFAULT_BURST_SIZE_VARIANCE,
        directionRadians: -Math.PI / 2,
        spreadRadians: Math.PI * 0.7,
        palette: ['#38bdf8', '#ffffff', '#67e8f9'],
        lifeSeconds: 0.38,
        drag: 1.35,
      });
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
        this.screenShake.addTrauma(0.28);
        this.spawnShockwave(collision.contactX, collision.contactY, 32, '#eab308', 2.5);
        this.particles.burst(collision.contactX, collision.contactY, {
          count: 16,
          speed: 185,
          speedVariance: DEFAULT_BURST_SPEED_VARIANCE,
          size: 5,
          sizeVariance: DEFAULT_BURST_SIZE_VARIANCE,
          palette: ['#eab308', '#fef08a', '#ffffff'],
          lifeSeconds: 0.42,
          gravity: 140,
          drag: 1.3,
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
        this.screenShake.addTrauma(0.32);
        this.spawnShockwave(collision.contactX, collision.contactY, 56, '#fde047', 3.5);
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
      this.screenShake.addTrauma(0.34);
      this.spawnShockwave(brickCenterX, brickCenterY, 30, brick.color, 2.2);
      this.particles.burst(brickCenterX, brickCenterY, {
        count: 18,
        speed: 195,
        speedVariance: DEFAULT_BURST_SPEED_VARIANCE,
        size: 5,
        sizeVariance: DEFAULT_BURST_SIZE_VARIANCE,
        spreadRadius: 12,
        palette: [brick.color, '#ffffff', '#e2e8f0'],
        lifeSeconds: 0.45,
        lifeVariance: 0.3,
        gravity: 170,
        drag: 1.3,
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
    const comboTrauma = Math.min(0.58, 0.44 + this.combo * 0.012);
    this.screenShake.addTrauma(brick.kind === 'core' ? 0.68 : comboTrauma);

    this.emitBrickShatterParticles(brick, brickCenterX, brickCenterY);
    this.spawnShockwave(
      brickCenterX,
      brickCenterY,
      brick.kind === 'core' ? 92 : 42,
      brick.kind === 'core' ? '#f472b6' : brick.color,
      brick.kind === 'core' ? 4.5 : 2.5,
    );

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
    }
  }

  private emitBrickShatterParticles(
    brick: BrickEntity,
    brickCenterX: number,
    brickCenterY: number,
  ): void {
    const isCore = brick.kind === 'core';
    // Layer 1: High-velocity neon laser streaks across the brick footprint
    this.particles.burst(brickCenterX, brickCenterY, {
      count: isCore ? 42 : 24,
      speed: isCore ? 320 : 245,
      speedVariance: 0.65,
      size: isCore ? 6.5 : 5.5,
      sizeVariance: DEFAULT_BURST_SIZE_VARIANCE,
      lifeSeconds: 0.65,
      lifeVariance: 0.35,
      spreadRadius: 18,
      palette: [brick.color, brick.color, '#ffffff', '#67e8f9'],
      gravity: 165,
      drag: 1.35,
    });

    // Layer 2: White-hot core starburst flash
    this.particles.burst(brickCenterX, brickCenterY, {
      count: isCore ? 18 : 10,
      speed: 155,
      speedVariance: DEFAULT_BURST_SPEED_VARIANCE,
      size: 6.5,
      sizeVariance: DEFAULT_BURST_SIZE_VARIANCE,
      lifeSeconds: 0.36,
      spreadRadius: 10,
      palette: ['#ffffff', '#fef08a'],
      drag: 2.1,
    });

    // Layer 3: Heavy tumbling synthwave prism embers
    this.particles.burst(brickCenterX, brickCenterY, {
      count: isCore ? 20 : 12,
      speed: 115,
      speedVariance: DEFAULT_BURST_SPEED_VARIANCE,
      size: 4.8,
      sizeVariance: DEFAULT_BURST_SIZE_VARIANCE,
      lifeSeconds: 0.85,
      lifeVariance: 0.3,
      spreadRadius: 16,
      palette: [brick.color, '#f472b6', '#fde047', '#38bdf8'],
      gravity: 340,
      drag: 0.55,
    });
  }

  private triggerNovaExplosion(originX: number, originY: number): void {
    this.audio.explosion();
    this.screenShake.addTrauma(0.76);
    this.spawnShockwave(originX, originY, NOVA_EXPLOSION_RADIUS_PIXELS, '#fb923c', 4.5);
    this.spawnShockwave(originX, originY, NOVA_EXPLOSION_RADIUS_PIXELS * 0.65, '#fef08a', 3);
    this.particles.burst(originX, originY, {
      count: 52,
      speed: 295,
      speedVariance: 0.7,
      size: 6.5,
      sizeVariance: 0.5,
      spreadRadius: 16,
      palette: ['#fb923c', '#fef08a', '#ef4444', '#ffffff'],
      lifeSeconds: 0.75,
      lifeVariance: 0.35,
      gravity: 150,
      drag: 1.25,
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
            this.screenShake.addTrauma(0.16);
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
    this.screenShake.addTrauma(0.3);
    this.addScore(150 * this.multiplier);
    this.floatingTexts.spawn(
      capsule.x + capsule.width / 2,
      this.paddle.y - 18,
      specification.displayName.toUpperCase(),
      specification.color,
    );
    this.spawnShockwave(capsule.x + capsule.width / 2, this.paddle.y, 48, specification.color, 3);
    this.particles.burst(capsule.x + capsule.width / 2, this.paddle.y, {
      count: 24,
      speed: 210,
      speedVariance: 0.55,
      size: 5.5,
      sizeVariance: 0.4,
      spreadRadius: 10,
      palette: [specification.color, '#ffffff', '#fde047'],
      lifeSeconds: 0.55,
      gravity: 130,
      drag: 1.2,
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
    this.screenShake.addTrauma(0.74);

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
    this.screenShake.addTrauma(0.68);
    this.addScore(500 * this.stageNumber);
    const nextStageNumber = this.stageNumber + 1;
    this.loadStage(nextStageNumber, true);
    this.particles.burst(PLAY_FIELD_WIDTH / 2, PLAY_FIELD_HEIGHT / 2, {
      count: 44,
      speed: 260,
      speedVariance: 0.65,
      size: 6,
      sizeVariance: 0.45,
      spreadRadius: 24,
      palette: ['#38bdf8', '#f472b6', '#fde047', '#c084fc', '#ffffff'],
      lifeSeconds: 0.8,
      gravity: 120,
      drag: 1.1,
    });
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
      this.screenShake.addTrauma(0.7);
      this.spawnShockwave(PLAY_FIELD_WIDTH / 2, PLAY_FIELD_HEIGHT / 2, 180, '#f472b6', 4.5);
      this.particles.burst(PLAY_FIELD_WIDTH / 2, PLAY_FIELD_HEIGHT / 2, {
        count: 40,
        speed: 250,
        speedVariance: 0.65,
        size: 6,
        sizeVariance: 0.45,
        spreadRadius: 20,
        palette: ['#f472b6', '#fde047', '#38bdf8', '#ffffff'],
        lifeSeconds: 0.75,
        gravity: 110,
        drag: 1.1,
      });
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
