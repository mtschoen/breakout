import type { BrickKind, PowerUpKind } from '../game/types';

const SYNTHWAVE_PENTATONIC_SCALE: readonly number[] = [
  261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25, 783.99, 880.0, 1046.5, 1174.66,
];

const BRICK_KIND_FREQUENCY_MULTIPLIERS: Readonly<Record<BrickKind, number>> = {
  standard: 1.0,
  armored: 0.85,
  explosive: 0.75,
  splitter: 1.25,
  core: 1.35,
  indestructible: 0.65,
};

export function computeComboBrickFrequency(comboCount: number, kind: BrickKind): number {
  const numericCombo = Number.isFinite(comboCount) ? Math.floor(comboCount) : 0;
  const clampedIndex = Math.max(0, Math.min(SYNTHWAVE_PENTATONIC_SCALE.length - 1, numericCombo));
  const baseFrequency = SYNTHWAVE_PENTATONIC_SCALE[clampedIndex] ?? 261.63;
  const multiplier = BRICK_KIND_FREQUENCY_MULTIPLIERS[kind] ?? 1.0;
  return baseFrequency * multiplier;
}

interface ToneParameters {
  startFrequency: number;
  endFrequency: number;
  durationSeconds: number;
  waveform: OscillatorType;
  volume: number;
  delaySeconds?: number;
}

interface NoiseParameters {
  durationSeconds: number;
  filterFrequency: number;
  volume: number;
  filterType?: BiquadFilterType;
  delaySeconds?: number;
}

export class SoundEffects {
  private audioContext: AudioContext | null;
  private outputNode: AudioNode | null;
  private masterGainNode: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private muted = false;
  private lastLaserShootTimeSeconds = -1;

  public constructor(audioContext: AudioContext | null, outputNode?: AudioNode) {
    this.audioContext = audioContext;
    this.outputNode = outputNode ?? null;
    this.rebuildAudioGraph();
  }

  public attachAudioContext(audioContext: AudioContext, outputNode: AudioNode): void {
    this.audioContext = audioContext;
    this.outputNode = outputNode;
    this.rebuildAudioGraph();
  }

  public get isMuted(): boolean {
    return this.muted;
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.masterGainNode !== null && this.audioContext !== null) {
      this.masterGainNode.gain.setTargetAtTime(
        muted ? 0 : 0.85,
        this.audioContext.currentTime,
        0.01,
      );
    }
  }

  public toggleMuted(): boolean {
    this.setMuted(!this.muted);
    return this.muted;
  }

  public paddleHit(parryTriggered?: boolean): void {
    this.playTone({
      startFrequency: 240,
      endFrequency: 140,
      durationSeconds: 0.08,
      waveform: 'triangle',
      volume: 0.18,
    });
    if (parryTriggered) {
      this.playTone({
        startFrequency: 659.25,
        endFrequency: 659.25,
        durationSeconds: 0.22,
        waveform: 'square',
        volume: 0.18,
      });
      this.playTone({
        startFrequency: 987.77,
        endFrequency: 987.77,
        durationSeconds: 0.22,
        waveform: 'square',
        volume: 0.16,
        delaySeconds: 0.02,
      });
    }
  }

  public wallHit(): void {
    this.playTone({
      startFrequency: 560,
      endFrequency: 420,
      durationSeconds: 0.045,
      waveform: 'triangle',
      volume: 0.12,
    });
  }

  public brickHit(comboCount: number, destroyed: boolean, kind: BrickKind): void {
    const baseFrequency = computeComboBrickFrequency(comboCount, kind);
    this.playTone({
      startFrequency: baseFrequency,
      endFrequency: baseFrequency * 0.98,
      durationSeconds: 0.09,
      waveform: 'square',
      volume: 0.15,
    });
    if (destroyed) {
      this.playTone({
        startFrequency: baseFrequency * 2,
        endFrequency: baseFrequency * 2,
        durationSeconds: 0.14,
        waveform: 'triangle',
        volume: 0.12,
        delaySeconds: 0.02,
      });
    }
  }

  public explosion(): void {
    this.playNoise({
      durationSeconds: 0.4,
      filterFrequency: 500,
      volume: 0.35,
      filterType: 'lowpass',
    });
    this.playTone({
      startFrequency: 140,
      endFrequency: 32,
      durationSeconds: 0.45,
      waveform: 'sine',
      volume: 0.4,
    });
  }

  public laserShoot(): void {
    if (this.audioContext !== null) {
      const currentTimeSeconds = this.audioContext.currentTime;
      if (currentTimeSeconds - this.lastLaserShootTimeSeconds < 0.035) {
        return;
      }
      this.lastLaserShootTimeSeconds = currentTimeSeconds;
    }
    this.playTone({
      startFrequency: 1400,
      endFrequency: 350,
      durationSeconds: 0.065,
      waveform: 'sawtooth',
      volume: 0.14,
    });
  }

  public powerUpCollect(kind: PowerUpKind): void {
    const kindPitchOffset: Record<PowerUpKind, number> = {
      multiball: 0,
      wide: 2,
      laser: 4,
      pierce: 5,
      magnet: 7,
      barrier: 9,
    };
    const semitoneShift = kindPitchOffset[kind] ?? 0;
    const baseMultiplier = Math.pow(2, semitoneShift / 12);
    const firstNoteFrequency = 523.25 * baseMultiplier;
    const secondNoteFrequency = 659.25 * baseMultiplier;
    const thirdNoteFrequency = 783.99 * baseMultiplier;

    this.playTone({
      startFrequency: firstNoteFrequency,
      endFrequency: firstNoteFrequency,
      durationSeconds: 0.08,
      waveform: 'square',
      volume: 0.14,
      delaySeconds: 0.0,
    });
    this.playTone({
      startFrequency: secondNoteFrequency,
      endFrequency: secondNoteFrequency,
      durationSeconds: 0.08,
      waveform: 'square',
      volume: 0.14,
      delaySeconds: 0.07,
    });
    this.playTone({
      startFrequency: thirdNoteFrequency,
      endFrequency: thirdNoteFrequency,
      durationSeconds: 0.16,
      waveform: 'square',
      volume: 0.16,
      delaySeconds: 0.14,
    });
  }

  public stageClear(): void {
    this.playTone({
      startFrequency: 523.25,
      endFrequency: 523.25,
      durationSeconds: 0.12,
      waveform: 'sawtooth',
      volume: 0.18,
      delaySeconds: 0.0,
    });
    this.playTone({
      startFrequency: 659.25,
      endFrequency: 659.25,
      durationSeconds: 0.12,
      waveform: 'sawtooth',
      volume: 0.18,
      delaySeconds: 0.12,
    });
    this.playTone({
      startFrequency: 783.99,
      endFrequency: 783.99,
      durationSeconds: 0.12,
      waveform: 'sawtooth',
      volume: 0.18,
      delaySeconds: 0.24,
    });
    this.playTone({
      startFrequency: 1046.5,
      endFrequency: 1046.5,
      durationSeconds: 0.32,
      waveform: 'sawtooth',
      volume: 0.22,
      delaySeconds: 0.36,
    });
  }

  public ballLost(): void {
    this.playTone({
      startFrequency: 440,
      endFrequency: 65,
      durationSeconds: 0.5,
      waveform: 'sawtooth',
      volume: 0.25,
    });
  }

  public barrierSave(): void {
    this.playTone({
      startFrequency: 180,
      endFrequency: 720,
      durationSeconds: 0.18,
      waveform: 'sine',
      volume: 0.22,
    });
    this.playNoise({
      durationSeconds: 0.12,
      filterFrequency: 1200,
      volume: 0.15,
      filterType: 'bandpass',
    });
  }

  public feverStart(): void {
    this.playTone({
      startFrequency: 330,
      endFrequency: 660,
      durationSeconds: 0.12,
      waveform: 'sawtooth',
      volume: 0.22,
      delaySeconds: 0.0,
    });
    this.playTone({
      startFrequency: 660,
      endFrequency: 1320,
      durationSeconds: 0.16,
      waveform: 'sawtooth',
      volume: 0.24,
      delaySeconds: 0.1,
    });
  }

  public uiClick(): void {
    this.playTone({
      startFrequency: 720,
      endFrequency: 720,
      durationSeconds: 0.035,
      waveform: 'triangle',
      volume: 0.1,
    });
  }

  private rebuildAudioGraph(): void {
    this.masterGainNode = null;
    this.noiseBuffer = null;
    if (this.audioContext === null) {
      return;
    }
    const destinationNode = this.outputNode ?? this.audioContext.destination;
    this.masterGainNode = this.audioContext.createGain();
    this.masterGainNode.gain.value = this.muted ? 0 : 0.85;
    this.masterGainNode.connect(destinationNode);

    const bufferLength = Math.max(1, Math.floor(this.audioContext.sampleRate * 1));
    this.noiseBuffer = this.audioContext.createBuffer(
      1,
      bufferLength,
      this.audioContext.sampleRate,
    );
    const channelData = this.noiseBuffer.getChannelData(0);
    for (let index = 0; index < channelData.length; index += 1) {
      channelData[index] = Math.random() * 2 - 1;
    }
  }

  private isReady(): boolean {
    return this.audioContext !== null && this.masterGainNode !== null && !this.muted;
  }

  private playTone(parameters: ToneParameters): void {
    if (!this.isReady() || this.audioContext === null || this.masterGainNode === null) {
      return;
    }
    const startTimeSeconds = this.audioContext.currentTime + (parameters.delaySeconds ?? 0);
    const endTimeSeconds = startTimeSeconds + parameters.durationSeconds;
    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();

    oscillator.type = parameters.waveform;
    oscillator.frequency.setValueAtTime(Math.max(1, parameters.startFrequency), startTimeSeconds);
    oscillator.frequency.exponentialRampToValueAtTime(
      Math.max(1, parameters.endFrequency),
      endTimeSeconds,
    );

    gainNode.gain.setValueAtTime(parameters.volume, startTimeSeconds);
    gainNode.gain.exponentialRampToValueAtTime(0.001, endTimeSeconds);

    oscillator.connect(gainNode);
    gainNode.connect(this.masterGainNode);

    oscillator.start(startTimeSeconds);
    oscillator.stop(endTimeSeconds + 0.02);
  }

  private playNoise(parameters: NoiseParameters): void {
    if (
      !this.isReady() ||
      this.audioContext === null ||
      this.masterGainNode === null ||
      this.noiseBuffer === null
    ) {
      return;
    }
    const startTimeSeconds = this.audioContext.currentTime + (parameters.delaySeconds ?? 0);
    const endTimeSeconds = startTimeSeconds + parameters.durationSeconds;
    const sourceNode = this.audioContext.createBufferSource();
    sourceNode.buffer = this.noiseBuffer;
    sourceNode.loop = true;

    const filterNode = this.audioContext.createBiquadFilter();
    filterNode.type = parameters.filterType ?? 'lowpass';
    filterNode.frequency.setValueAtTime(parameters.filterFrequency, startTimeSeconds);
    filterNode.frequency.exponentialRampToValueAtTime(
      Math.max(40, parameters.filterFrequency * 0.3),
      endTimeSeconds,
    );

    const gainNode = this.audioContext.createGain();
    gainNode.gain.setValueAtTime(parameters.volume, startTimeSeconds);
    gainNode.gain.exponentialRampToValueAtTime(0.001, endTimeSeconds);

    sourceNode.connect(filterNode);
    filterNode.connect(gainNode);
    gainNode.connect(this.masterGainNode);

    sourceNode.start(startTimeSeconds, Math.random() * 0.5);
    sourceNode.stop(endTimeSeconds + 0.02);
  }
}
