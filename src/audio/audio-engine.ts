import type { AudioSink, BrickKind, PowerUpKind } from '../game/types';
import { MusicEngine } from './music';
import { SoundEffects } from './sound-effects';

interface AudioContextConstructorHolder {
  AudioContext?: typeof AudioContext;
  webkitAudioContext?: typeof AudioContext;
}

function resolveAudioContextConstructor(): typeof AudioContext | null {
  if (typeof globalThis === 'undefined') {
    return null;
  }
  const holder = globalThis as unknown as AudioContextConstructorHolder;
  return holder.AudioContext ?? holder.webkitAudioContext ?? null;
}

export class AudioEngine implements AudioSink {
  public readonly music: MusicEngine;
  public readonly effects: SoundEffects;
  public readonly soundEffects: SoundEffects;

  private audioContext: AudioContext | null = null;
  private masterGainNode: GainNode | null = null;
  private contextCreationFailed = false;
  private muted = false;
  private gestureListenerAttached = false;

  private readonly handleFirstGesture = (): void => {
    void this.resume();
  };

  public constructor() {
    this.music = new MusicEngine(null);
    this.effects = new SoundEffects(null);
    this.soundEffects = this.effects;
  }

  public get isMuted(): boolean {
    return this.muted;
  }

  public get isAvailable(): boolean {
    return (
      this.audioContext !== null ||
      (!this.contextCreationFailed && resolveAudioContextConstructor() !== null)
    );
  }

  public get hasContext(): boolean {
    return this.audioContext !== null;
  }

  public unlock(): void {
    void this.resume();
  }

  public handleUserGesture(): void {
    void this.resume();
  }

  public async resume(): Promise<void> {
    const audioContext = this.ensureContext();
    if (audioContext === null) {
      return;
    }
    if (audioContext.state === 'suspended') {
      try {
        await audioContext.resume();
      } catch {
        // A resume can only succeed during a real user gesture.
      }
    }
  }

  public attachGestureListeners(target: EventTarget): void {
    if (this.gestureListenerAttached) {
      return;
    }
    this.gestureListenerAttached = true;
    const options: AddEventListenerOptions = { once: true, passive: true };
    target.addEventListener('pointerdown', this.handleFirstGesture, options);
    target.addEventListener('keydown', this.handleFirstGesture, options);
    target.addEventListener('touchstart', this.handleFirstGesture, options);
  }

  public startMusic(): void {
    void this.resume().then(() => {
      this.music.start();
    });
  }

  public stopMusic(): void {
    this.music.stop();
  }

  public setIntensity(intensity: number): void {
    this.music.setIntensity(intensity);
  }

  public paddleHit(parryTriggered?: boolean): void {
    this.effects.paddleHit(parryTriggered);
  }

  public wallHit(): void {
    this.effects.wallHit();
  }

  public brickHit(comboCount: number, destroyed: boolean, kind: BrickKind): void {
    this.effects.brickHit(comboCount, destroyed, kind);
  }

  public explosion(): void {
    this.effects.explosion();
  }

  public laserShoot(): void {
    this.effects.laserShoot();
  }

  public powerUpCollect(kind: PowerUpKind): void {
    this.effects.powerUpCollect(kind);
  }

  public stageClear(): void {
    this.effects.stageClear();
  }

  public ballLost(): void {
    this.effects.ballLost();
  }

  public barrierSave(): void {
    this.effects.barrierSave();
  }

  public feverStart(): void {
    this.effects.feverStart();
  }

  public uiClick(): void {
    this.effects.uiClick();
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
    this.effects.setMuted(muted);
    if (this.masterGainNode !== null && this.audioContext !== null) {
      this.masterGainNode.gain.setTargetAtTime(muted ? 0 : 1, this.audioContext.currentTime, 0.01);
    }
  }

  public toggleMuted(): boolean {
    this.setMuted(!this.muted);
    return this.muted;
  }

  public async dispose(): Promise<void> {
    this.music.stop();
    if (this.audioContext !== null) {
      try {
        await this.audioContext.close();
      } catch {
        // Closing an already closed context is harmless.
      }
      this.audioContext = null;
      this.masterGainNode = null;
    }
  }

  private ensureContext(): AudioContext | null {
    if (this.audioContext !== null) {
      return this.audioContext;
    }
    if (this.contextCreationFailed) {
      return null;
    }
    const constructorFunction = resolveAudioContextConstructor();
    if (constructorFunction === null) {
      this.contextCreationFailed = true;
      return null;
    }
    try {
      this.audioContext = new constructorFunction();
    } catch {
      this.contextCreationFailed = true;
      this.audioContext = null;
      return null;
    }
    try {
      this.masterGainNode = this.audioContext.createGain();
      this.masterGainNode.gain.value = this.muted ? 0 : 1;
      this.masterGainNode.connect(this.audioContext.destination);
      this.music.attachAudioContext(this.audioContext, this.masterGainNode);
      this.effects.attachAudioContext(this.audioContext, this.masterGainNode);
      this.effects.setMuted(this.muted);
    } catch {
      this.masterGainNode = null;
    }
    return this.audioContext;
  }
}
