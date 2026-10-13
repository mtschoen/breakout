export interface ScreenShakeOptions {
  maximumOffsetPixels?: number;
  decayPerSecond?: number;
  intensityMultiplier?: number;
  reducedMotion?: boolean;
  random?: () => number;
}

export class ScreenShake {
  public readonly maximumOffsetPixels: number;
  public readonly decayPerSecond: number;

  private isReducedMotion: boolean;
  private currentIntensityMultiplier: number;
  private traumaValue: number = 0;
  private currentOffsetX: number = 0;
  private currentOffsetY: number = 0;
  private readonly random: () => number;

  constructor(options?: ScreenShakeOptions) {
    this.maximumOffsetPixels = options?.maximumOffsetPixels ?? 6;
    this.decayPerSecond = options?.decayPerSecond ?? 2.4;
    this.currentIntensityMultiplier = Math.max(0, options?.intensityMultiplier ?? 1);
    this.isReducedMotion = options?.reducedMotion ?? false;
    this.random = options?.random ?? Math.random;
  }

  public get trauma(): number {
    return this.traumaValue;
  }

  public get offsetX(): number {
    return this.currentOffsetX;
  }

  public get offsetY(): number {
    return this.currentOffsetY;
  }

  public get intensityMultiplier(): number {
    return this.currentIntensityMultiplier;
  }

  public set intensityMultiplier(value: number) {
    this.currentIntensityMultiplier = Math.max(0, value);
    this.computeOffsets();
  }

  public get reducedMotion(): boolean {
    return this.isReducedMotion;
  }

  public set reducedMotion(value: boolean) {
    this.isReducedMotion = value;
    if (value) {
      this.currentOffsetX = 0;
      this.currentOffsetY = 0;
    } else if (this.traumaValue > 0) {
      this.computeOffsets();
    }
  }

  public setReducedMotion(reducedMotion: boolean): void {
    this.reducedMotion = reducedMotion;
  }

  public addTrauma(amount: number): void {
    if (amount <= 0) {
      return;
    }
    const clampedAmount = Math.min(1, amount);
    const dominant = Math.max(this.traumaValue, clampedAmount);
    const secondary = Math.min(this.traumaValue, clampedAmount);
    this.traumaValue = Math.min(1, dominant + secondary * 0.35 * (1 - dominant));
    this.computeOffsets();
  }

  public update(deltaSeconds: number): void {
    if (deltaSeconds <= 0) {
      return;
    }
    this.traumaValue = Math.max(0, this.traumaValue - this.decayPerSecond * deltaSeconds);
    this.computeOffsets();
  }

  public clear(): void {
    this.traumaValue = 0;
    this.currentOffsetX = 0;
    this.currentOffsetY = 0;
  }

  private computeOffsets(): void {
    if (this.isReducedMotion || this.traumaValue <= 0 || this.currentIntensityMultiplier <= 0) {
      this.currentOffsetX = 0;
      this.currentOffsetY = 0;
      return;
    }
    const shakeIntensity = this.traumaValue * this.traumaValue * this.currentIntensityMultiplier;
    this.currentOffsetX = (this.random() * 2 - 1) * this.maximumOffsetPixels * shakeIntensity;
    this.currentOffsetY = (this.random() * 2 - 1) * this.maximumOffsetPixels * shakeIntensity;
  }
}
