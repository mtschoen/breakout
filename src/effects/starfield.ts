import { PLAY_FIELD_HEIGHT, PLAY_FIELD_WIDTH, type StarView } from '../game/types';

export const SYNTHWAVE_STAR_COLORS: readonly string[] = [
  '#67e8f9',
  '#f472b6',
  '#fde047',
  '#c084fc',
  '#e2e8f0',
] as const;

export interface StarfieldOptions {
  count?: number;
  width?: number;
  height?: number;
}

interface StarSimulationRecord {
  x: number;
  y: number;
  size: number;
  alpha: number;
  color: string;
  speedPixelsPerSecond: number;
}

function computeDeterministicFraction(index: number, salt: number): number {
  let value = (index + 1) * 374761393 + salt * 668265263;
  value = (value ^ (value >> 13)) * 1274126177;
  value = (value ^ (value >> 16)) >>> 0;
  return value / 4294967296;
}

export class Starfield {
  public readonly count: number;
  public readonly width: number;
  public readonly height: number;

  private readonly stars: StarSimulationRecord[];

  constructor(options?: StarfieldOptions) {
    this.count = Math.max(1, Math.floor(options?.count ?? 60));
    this.width = options?.width ?? PLAY_FIELD_WIDTH;
    this.height = options?.height ?? PLAY_FIELD_HEIGHT;
    this.stars = new Array(this.count);

    for (let index = 0; index < this.count; index++) {
      const fractionX = computeDeterministicFraction(index, 1);
      const fractionY = computeDeterministicFraction(index, 2);
      const fractionDepth = computeDeterministicFraction(index, 3);
      const fractionColor = computeDeterministicFraction(index, 4);

      const colorIndex =
        Math.floor(fractionColor * SYNTHWAVE_STAR_COLORS.length) % SYNTHWAVE_STAR_COLORS.length;
      const size = Number((1 + fractionDepth * 1.5).toFixed(2));
      const alpha = Number((0.35 + fractionDepth * 0.55).toFixed(2));
      const speedPixelsPerSecond = 24 + fractionDepth * 48;

      this.stars[index] = {
        x: fractionX * this.width,
        y: fractionY * this.height,
        size,
        alpha,
        color: SYNTHWAVE_STAR_COLORS[colorIndex],
        speedPixelsPerSecond,
      };
    }
  }

  public update(deltaSeconds: number, speedMultiplier: number = 1): void {
    if (deltaSeconds <= 0) {
      return;
    }

    for (let index = 0; index < this.stars.length; index++) {
      const star = this.stars[index];
      star.y += star.speedPixelsPerSecond * speedMultiplier * deltaSeconds;
      if (star.y >= this.height) {
        star.y = star.y % this.height;
      } else if (star.y < 0) {
        star.y = ((star.y % this.height) + this.height) % this.height;
      }
    }
  }

  public getStars(): readonly Readonly<StarView>[] {
    return this.stars;
  }
}
