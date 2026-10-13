export interface ParticleSpawnOptions {
  x: number;
  y: number;
  velocityX: number;
  velocityY: number;
  lifeSeconds: number;
  size: number;
  color?: string;
  gravity?: number;
  drag?: number;
}

export interface BurstOptions {
  count: number;
  speed: number;
  speedVariance?: number;
  lifeSeconds?: number;
  lifeVariance?: number;
  size?: number;
  sizeVariance?: number;
  spreadRadius?: number;
  color?: string;
  palette?: readonly string[];
  gravity?: number;
  drag?: number;
  directionRadians?: number;
  spreadRadians?: number;
  random?: () => number;
}

export interface ParticleView {
  x: number;
  y: number;
  velocityX: number;
  velocityY: number;
  lifeSeconds: number;
  remainingLifeSeconds: number;
  size: number;
  color: string;
  alpha: number;
  gravity: number;
  drag: number;
}

interface PooledParticle extends ParticleView {
  alive: boolean;
}

export class ParticlePool {
  public readonly capacity: number;

  private readonly pool: PooledParticle[];
  private currentAliveCount: number = 0;
  private readonly random: () => number;

  constructor(capacity: number = 320, random: () => number = Math.random) {
    this.capacity = Math.max(1, Math.floor(capacity));
    this.random = random;
    this.pool = Array.from({ length: this.capacity }, () => ({
      x: 0,
      y: 0,
      velocityX: 0,
      velocityY: 0,
      lifeSeconds: 0,
      remainingLifeSeconds: 0,
      size: 0,
      color: '#ffffff',
      alpha: 0,
      gravity: 0,
      drag: 0,
      alive: false,
    }));
  }

  public get aliveCount(): number {
    return this.currentAliveCount;
  }

  public spawn(options: ParticleSpawnOptions): boolean {
    if (options.lifeSeconds <= 0 || options.size <= 0) {
      return false;
    }

    for (let index = 0; index < this.capacity; index++) {
      const particle = this.pool[index];
      if (!particle.alive) {
        particle.x = options.x;
        particle.y = options.y;
        particle.velocityX = options.velocityX;
        particle.velocityY = options.velocityY;
        particle.lifeSeconds = options.lifeSeconds;
        particle.remainingLifeSeconds = options.lifeSeconds;
        particle.size = options.size;
        particle.color = options.color ?? '#ffffff';
        particle.alpha = 1;
        particle.gravity = options.gravity ?? 0;
        particle.drag = options.drag ?? 0;
        particle.alive = true;
        this.currentAliveCount++;
        return true;
      }
    }

    return false;
  }

  public burst(x: number, y: number, options: BurstOptions): number {
    const targetCount = Math.max(0, Math.floor(options.count));
    if (targetCount === 0) {
      return 0;
    }

    const baseSpeed = options.speed;
    const speedVariance = options.speedVariance ?? 0;
    const baseLifeSeconds = options.lifeSeconds ?? 0.6;
    const lifeVariance = options.lifeVariance ?? 0;
    const baseSize = options.size ?? 3;
    const sizeVariance = options.sizeVariance ?? 0;
    const spreadRadius = options.spreadRadius ?? 0;
    const defaultColor = options.color ?? '#ffffff';
    const palette = options.palette;
    const gravity = options.gravity ?? 0;
    const drag = options.drag ?? 0;
    const directionRadians = options.directionRadians;
    const spreadRadians = options.spreadRadians ?? Math.PI * 2;
    const randomSource = options.random ?? this.random;

    let spawnedCount = 0;
    for (let index = 0; index < targetCount; index++) {
      let angle: number;
      if (directionRadians !== undefined) {
        const halfSpread = spreadRadians / 2;
        angle = directionRadians - halfSpread + randomSource() * spreadRadians;
      } else {
        angle = randomSource() * Math.PI * 2;
      }

      const particleSpeed =
        speedVariance > 0
          ? Math.max(12, baseSpeed * (1 + (randomSource() * 2 - 1) * speedVariance))
          : baseSpeed;
      const particleSize =
        sizeVariance > 0
          ? Math.max(1.5, baseSize * (1 + (randomSource() * 2 - 1) * sizeVariance))
          : baseSize;
      const particleLifeSeconds =
        lifeVariance > 0
          ? Math.max(0.12, baseLifeSeconds * (1 + (randomSource() * 2 - 1) * lifeVariance))
          : baseLifeSeconds;
      const spawnX = spreadRadius > 0 ? x + (randomSource() * 2 - 1) * spreadRadius : x;
      const spawnY = spreadRadius > 0 ? y + (randomSource() * 2 - 1) * (spreadRadius * 0.5) : y;
      const particleColor =
        palette && palette.length > 0
          ? palette[Math.floor(randomSource() * palette.length) % palette.length]
          : defaultColor;

      const velocityX = Math.cos(angle) * particleSpeed;
      const velocityY = Math.sin(angle) * particleSpeed;

      const spawned = this.spawn({
        x: spawnX,
        y: spawnY,
        velocityX,
        velocityY,
        lifeSeconds: particleLifeSeconds,
        size: particleSize,
        color: particleColor,
        gravity,
        drag,
      });

      if (!spawned) {
        break;
      }
      spawnedCount++;
    }

    return spawnedCount;
  }

  public update(deltaSeconds: number): void {
    if (deltaSeconds <= 0) {
      return;
    }

    for (let index = 0; index < this.capacity; index++) {
      const particle = this.pool[index];
      if (!particle.alive) {
        continue;
      }

      particle.remainingLifeSeconds -= deltaSeconds;
      if (particle.remainingLifeSeconds <= 0) {
        particle.alive = false;
        particle.remainingLifeSeconds = 0;
        particle.alpha = 0;
        this.currentAliveCount--;
        continue;
      }

      if (particle.gravity !== 0) {
        particle.velocityY += particle.gravity * deltaSeconds;
      }

      if (particle.drag > 0) {
        const dragMultiplier = Math.max(0, 1 - particle.drag * deltaSeconds);
        particle.velocityX *= dragMultiplier;
        particle.velocityY *= dragMultiplier;
      }

      particle.x += particle.velocityX * deltaSeconds;
      particle.y += particle.velocityY * deltaSeconds;
      particle.alpha = Math.max(
        0,
        Math.min(1, particle.remainingLifeSeconds / particle.lifeSeconds),
      );
    }
  }

  public forEachAlive(callback: (particle: Readonly<ParticleView>) => void): void {
    for (let index = 0; index < this.capacity; index++) {
      const particle = this.pool[index];
      if (particle.alive) {
        callback(particle);
      }
    }
  }

  public toRenderViews(): ParticleView[] {
    const views: ParticleView[] = [];
    for (let index = 0; index < this.capacity; index++) {
      const particle = this.pool[index];
      if (particle.alive) {
        views.push({
          x: particle.x,
          y: particle.y,
          velocityX: particle.velocityX,
          velocityY: particle.velocityY,
          lifeSeconds: particle.lifeSeconds,
          remainingLifeSeconds: particle.remainingLifeSeconds,
          size: particle.size,
          color: particle.color,
          alpha: particle.alpha,
          gravity: particle.gravity,
          drag: particle.drag,
        });
      }
    }
    return views;
  }

  public clear(): void {
    for (let index = 0; index < this.capacity; index++) {
      const particle = this.pool[index];
      particle.alive = false;
      particle.remainingLifeSeconds = 0;
      particle.alpha = 0;
    }
    this.currentAliveCount = 0;
  }
}
