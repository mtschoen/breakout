export interface FloatingTextView {
  x: number;
  y: number;
  text: string;
  color: string;
  alpha: number;
  lifeSeconds: number;
  remainingLifeSeconds: number;
  riseSpeed: number;
}

export interface FloatingTextSpawnOptions {
  lifeSeconds?: number;
  riseSpeed?: number;
}

interface PooledFloatingText {
  x: number;
  y: number;
  text: string;
  color: string;
  alpha: number;
  lifeSeconds: number;
  remainingLifeSeconds: number;
  riseSpeed: number;
  alive: boolean;
}

export class FloatingTextPool {
  public readonly capacity: number;

  private readonly pool: PooledFloatingText[];
  private currentAliveCount: number = 0;

  constructor(capacity: number = 40) {
    this.capacity = Math.max(1, Math.floor(capacity));
    this.pool = new Array(this.capacity);
    for (let index = 0; index < this.capacity; index++) {
      this.pool[index] = {
        x: 0,
        y: 0,
        text: '',
        color: '#ffffff',
        alpha: 0,
        lifeSeconds: 0,
        remainingLifeSeconds: 0,
        riseSpeed: 0,
        alive: false,
      };
    }
  }

  public get aliveCount(): number {
    return this.currentAliveCount;
  }

  public spawn(
    x: number,
    y: number,
    text: string,
    color: string = '#ffffff',
    options?: FloatingTextSpawnOptions,
  ): boolean {
    if (text.trim().length === 0) {
      return false;
    }

    const lifeSeconds = options?.lifeSeconds ?? 0.8;
    if (lifeSeconds <= 0) {
      return false;
    }

    const riseSpeed = options?.riseSpeed ?? 42;

    for (let index = 0; index < this.capacity; index++) {
      const entry = this.pool[index];
      if (!entry.alive) {
        entry.x = x;
        entry.y = y;
        entry.text = text;
        entry.color = color;
        entry.alpha = 1;
        entry.lifeSeconds = lifeSeconds;
        entry.remainingLifeSeconds = lifeSeconds;
        entry.riseSpeed = riseSpeed;
        entry.alive = true;
        this.currentAliveCount++;
        return true;
      }
    }

    return false;
  }

  public update(deltaSeconds: number): void {
    if (deltaSeconds <= 0) {
      return;
    }

    for (let index = 0; index < this.capacity; index++) {
      const entry = this.pool[index];
      if (!entry.alive) {
        continue;
      }

      entry.remainingLifeSeconds -= deltaSeconds;
      if (entry.remainingLifeSeconds <= 0) {
        entry.alive = false;
        entry.remainingLifeSeconds = 0;
        entry.alpha = 0;
        this.currentAliveCount--;
        continue;
      }

      entry.y -= entry.riseSpeed * deltaSeconds;
      entry.alpha = Math.max(0, Math.min(1, entry.remainingLifeSeconds / entry.lifeSeconds));
    }
  }

  public forEachAlive(callback: (entry: Readonly<FloatingTextView>) => void): void {
    for (let index = 0; index < this.capacity; index++) {
      const entry = this.pool[index];
      if (entry.alive) {
        callback(entry);
      }
    }
  }

  public toRenderViews(): FloatingTextView[] {
    const views: FloatingTextView[] = [];
    for (let index = 0; index < this.capacity; index++) {
      const entry = this.pool[index];
      if (entry.alive) {
        views.push({
          x: entry.x,
          y: entry.y,
          text: entry.text,
          color: entry.color,
          alpha: entry.alpha,
          lifeSeconds: entry.lifeSeconds,
          remainingLifeSeconds: entry.remainingLifeSeconds,
          riseSpeed: entry.riseSpeed,
        });
      }
    }
    return views;
  }

  public clear(): void {
    for (let index = 0; index < this.capacity; index++) {
      const entry = this.pool[index];
      entry.alive = false;
      entry.remainingLifeSeconds = 0;
      entry.alpha = 0;
    }
    this.currentAliveCount = 0;
  }
}
