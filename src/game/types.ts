export const PLAY_FIELD_WIDTH = 480;
export const PLAY_FIELD_HEIGHT = 640;

export const BRICK_COLUMNS = 10;
export const BRICK_WIDTH = 42;
export const BRICK_HEIGHT = 20;
export const BRICK_GAP_X = 4;
export const BRICK_GAP_Y = 5;
export const BRICK_GRID_OFFSET_X = 12;
export const BRICK_GRID_OFFSET_Y = 68;

export interface Vector2D {
  x: number;
  y: number;
}

export interface RectangleBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type GameState = 'ready' | 'playing' | 'paused' | 'over';

export type BrickKind =
  'standard' | 'armored' | 'explosive' | 'splitter' | 'indestructible' | 'core';

export type PowerUpKind = 'multiball' | 'wide' | 'laser' | 'pierce' | 'magnet' | 'barrier';

export interface BrickBlueprint {
  row: number;
  column: number;
  kind: BrickKind;
  hitPoints: number;
  color: string;
  points: number;
}

export interface BrickEntity {
  identifier: number;
  row: number;
  column: number;
  x: number;
  y: number;
  width: number;
  height: number;
  kind: BrickKind;
  hitPoints: number;
  maximumHitPoints: number;
  color: string;
  points: number;
  flashTimerSeconds: number;
  alive: boolean;
}

export interface PaddleEntity {
  x: number;
  y: number;
  width: number;
  baseWidth: number;
  height: number;
  velocityX: number;
  speedPixelsPerSecond: number;
  scaleX: number;
  scaleY: number;
  parryWindowRemainingSeconds: number;
  parryCooldownRemainingSeconds: number;
  parryCharged: boolean;
  wideRemainingSeconds: number;
  laserRemainingSeconds: number;
  laserCooldownRemainingSeconds: number;
  magnetRemainingSeconds: number;
}

export interface BallTrailPoint {
  x: number;
  y: number;
  radius: number;
  alpha: number;
  color: string;
}

export interface BallEntity {
  identifier: number;
  x: number;
  y: number;
  velocityX: number;
  velocityY: number;
  speedPixelsPerSecond: number;
  radius: number;
  attachedToPaddle: boolean;
  attachmentOffsetX: number;
  launchAngleRadians: number;
  pierceRemainingSeconds: number;
  parryBoostActive: boolean;
  trail: BallTrailPoint[];
  alive: boolean;
}

export interface PowerUpCapsule {
  identifier: number;
  x: number;
  y: number;
  width: number;
  height: number;
  velocityY: number;
  kind: PowerUpKind;
  color: string;
  label: string;
  alive: boolean;
}

export interface LaserProjectile {
  identifier: number;
  x: number;
  y: number;
  velocityX: number;
  velocityY: number;
  width: number;
  height: number;
  damage: number;
  color: string;
  fromSplitter: boolean;
  alive: boolean;
}

export interface ShockwaveRing {
  x: number;
  y: number;
  currentRadius: number;
  maximumRadius: number;
  alpha: number;
  color: string;
  lineWidth: number;
}

export interface StageDefinition {
  stageNumber: number;
  name: string;
  subtitle: string;
  ballSpeedMultiplier: number;
  powerUpDropChance: number;
  bricks: BrickBlueprint[];
}

export interface AudioSink {
  paddleHit(parryTriggered?: boolean): void;
  wallHit(): void;
  brickHit(comboCount: number, destroyed: boolean, kind: BrickKind): void;
  explosion(): void;
  laserShoot(): void;
  powerUpCollect(kind: PowerUpKind): void;
  stageClear(): void;
  ballLost(): void;
  barrierSave(): void;
  feverStart(): void;
  startMusic(): void;
  stopMusic(): void;
  setIntensity(intensity: number): void;
}

export interface GameSnapshot {
  state: GameState;
  score: number;
  highScore: number;
  lives: number;
  stage: number;
  stageName: string;
  combo: number;
  multiplier: number;
  feverActive: boolean;
  feverMeter: number;
  feverRemainingSeconds: number;
  activePowerUpLabel: string;
  barrierActive: boolean;
  remainingDestructibleBricks: number;
}

export interface StarView {
  x: number;
  y: number;
  size: number;
  alpha: number;
  color: string;
}

export interface RenderParticleView {
  x: number;
  y: number;
  velocityX?: number;
  velocityY?: number;
  size: number;
  color: string;
  alpha: number;
}

export interface RenderFloatingTextView {
  x: number;
  y: number;
  text: string;
  color: string;
  alpha: number;
}

export interface RenderView {
  state: GameState;
  score: number;
  highScore: number;
  lives: number;
  stage: number;
  stageName: string;
  stageSubtitle: string;
  stageBannerTimerSeconds: number;
  combo: number;
  multiplier: number;
  feverActive: boolean;
  feverMeter: number;
  barrierActive: boolean;
  shakeOffsetX: number;
  shakeOffsetY: number;
  paddle: Readonly<PaddleEntity>;
  balls: readonly Readonly<BallEntity>[];
  bricks: readonly Readonly<BrickEntity>[];
  capsules: readonly Readonly<PowerUpCapsule>[];
  lasers: readonly Readonly<LaserProjectile>[];
  shockwaves: readonly Readonly<ShockwaveRing>[];
  stars: readonly Readonly<StarView>[];
  particles: readonly Readonly<RenderParticleView>[];
  floatingTexts: readonly Readonly<RenderFloatingTextView>[];
}
