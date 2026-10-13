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
  lifeSeconds?: number;
  size?: number;
  color?: string;
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

interface PooledParticle {
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
    this.pool = new Array(this.capacity);
    for (let index = 0; index < this.capacity; index++) {
      this.pool[index] = {
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
      };
    }
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

    const speed = options.speed;
    const lifeSeconds = options.lifeSeconds ?? 0.6;
    const size = options.size ?? 3;
    const color = options.color ?? '#ffffff';
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

      const velocityX = Math.cos(angle) * speed;
      const velocityY = Math.sin(angle) * speed;

      const spawned = this.spawn({
        x,
        y,
        velocityX,
        velocityY,
        lifeSeconds,
        size,
        color,
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
