import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PowerUpKind } from '../src/game/types';
import { AudioEngine } from '../src/audio/audio-engine';
import { MusicEngine, midiNoteToFrequency } from '../src/audio/music';
import { SoundEffects, computeComboBrickFrequency } from '../src/audio/sound-effects';

class FakeAudioParam {
  public value: number;
  public readonly scheduledValues: Array<{
    targetValue: number;
    startTimeSeconds: number;
  }> = [];

  public constructor(initialValue: number = 0) {
    this.value = initialValue;
  }

  public setValueAtTime(targetValue: number, startTimeSeconds: number): FakeAudioParam {
    this.value = targetValue;
    this.scheduledValues.push({ targetValue, startTimeSeconds });
    return this;
  }

  public exponentialRampToValueAtTime(targetValue: number, endTimeSeconds: number): FakeAudioParam {
    this.value = targetValue;
    this.scheduledValues.push({ targetValue, startTimeSeconds: endTimeSeconds });
    return this;
  }

  public linearRampToValueAtTime(targetValue: number, endTimeSeconds: number): FakeAudioParam {
    this.value = targetValue;
    this.scheduledValues.push({ targetValue, startTimeSeconds: endTimeSeconds });
    return this;
  }

  public setTargetAtTime(
    targetValue: number,
    startTimeSeconds: number,
    timeConstant: number,
  ): FakeAudioParam {
    void timeConstant;
    this.value = targetValue;
    this.scheduledValues.push({ targetValue, startTimeSeconds });
    return this;
  }
}

class FakeAudioNode {
  public readonly connectedNodes: Array<AudioNode | FakeAudioNode> = [];

  public connect(destination: AudioNode | FakeAudioNode): AudioNode {
    this.connectedNodes.push(destination);
    return destination as unknown as AudioNode;
  }

  public disconnect(): void {
    this.connectedNodes.length = 0;
  }
}

class FakeGainNode extends FakeAudioNode {
  public readonly gain: FakeAudioParam;

  public constructor(initialGain: number = 1) {
    super();
    this.gain = new FakeAudioParam(initialGain);
  }
}

class FakeOscillatorNode extends FakeAudioNode {
  public type: OscillatorType = 'sine';
  public readonly frequency: FakeAudioParam = new FakeAudioParam(440);
  public readonly detune: FakeAudioParam = new FakeAudioParam(0);
  public startedTimeSeconds: number | null = null;
  public stoppedTimeSeconds: number | null = null;

  public start(startTimeSeconds: number = 0): void {
    this.startedTimeSeconds = startTimeSeconds;
  }

  public stop(stopTimeSeconds: number = 0): void {
    this.stoppedTimeSeconds = stopTimeSeconds;
  }
}

class FakeBiquadFilterNode extends FakeAudioNode {
  public type: BiquadFilterType = 'lowpass';
  public readonly frequency: FakeAudioParam = new FakeAudioParam(350);
  public readonly Q: FakeAudioParam = new FakeAudioParam(1);
}

class FakeDynamicsCompressorNode extends FakeAudioNode {
  public readonly threshold: FakeAudioParam = new FakeAudioParam(-24);
  public readonly knee: FakeAudioParam = new FakeAudioParam(30);
  public readonly ratio: FakeAudioParam = new FakeAudioParam(12);
  public readonly attack: FakeAudioParam = new FakeAudioParam(0.003);
  public readonly release: FakeAudioParam = new FakeAudioParam(0.25);
}

class FakeAudioBuffer {
  public readonly numberOfChannels: number;
  public readonly length: number;
  public readonly sampleRate: number;
  public readonly duration: number;
  private readonly channelDataArrays: Float32Array[];

  public constructor(numberOfChannels: number, bufferLength: number, sampleRate: number) {
    this.numberOfChannels = numberOfChannels;
    this.length = bufferLength;
    this.sampleRate = sampleRate;
    this.duration = bufferLength / sampleRate;
    this.channelDataArrays = Array.from(
      { length: numberOfChannels },
      () => new Float32Array(bufferLength),
    );
  }

  public getChannelData(channelIndex: number): Float32Array {
    const channelData = this.channelDataArrays[channelIndex];
    if (!channelData) {
      throw new Error(`Channel index out of bounds: ${channelIndex}`);
    }
    return channelData;
  }
}

class FakeAudioBufferSourceNode extends FakeAudioNode {
  public buffer: FakeAudioBuffer | AudioBuffer | null = null;
  public loop: boolean = false;
  public startedTimeSeconds: number | null = null;
  public stoppedTimeSeconds: number | null = null;

  public start(startTimeSeconds: number = 0): void {
    this.startedTimeSeconds = startTimeSeconds;
  }

  public stop(stopTimeSeconds: number = 0): void {
    this.stoppedTimeSeconds = stopTimeSeconds;
  }
}

class FakeAudioContext {
  public currentTime: number = 0;
  public sampleRate: number = 44100;
  public state: AudioContextState = 'suspended';
  public readonly destination: FakeAudioNode = new FakeAudioNode();

  public readonly createdGainNodes: FakeGainNode[] = [];
  public readonly createdOscillators: FakeOscillatorNode[] = [];
  public readonly createdBiquadFilters: FakeBiquadFilterNode[] = [];
  public readonly createdBufferSources: FakeAudioBufferSourceNode[] = [];
  public readonly createdCompressors: FakeDynamicsCompressorNode[] = [];
  public readonly createdBuffers: FakeAudioBuffer[] = [];

  public createGain(): FakeGainNode {
    const gainNode = new FakeGainNode(1);
    this.createdGainNodes.push(gainNode);
    return gainNode;
  }

  public createOscillator(): FakeOscillatorNode {
    const oscillatorNode = new FakeOscillatorNode();
    this.createdOscillators.push(oscillatorNode);
    return oscillatorNode;
  }

  public createBiquadFilter(): FakeBiquadFilterNode {
    const filterNode = new FakeBiquadFilterNode();
    this.createdBiquadFilters.push(filterNode);
    return filterNode;
  }

  public createDynamicsCompressor(): FakeDynamicsCompressorNode {
    const compressorNode = new FakeDynamicsCompressorNode();
    this.createdCompressors.push(compressorNode);
    return compressorNode;
  }

  public createBuffer(
    numberOfChannels: number,
    bufferLength: number,
    sampleRate: number,
  ): FakeAudioBuffer {
    const buffer = new FakeAudioBuffer(numberOfChannels, bufferLength, sampleRate);
    this.createdBuffers.push(buffer);
    return buffer;
  }

  public createBufferSource(): FakeAudioBufferSourceNode {
    const sourceNode = new FakeAudioBufferSourceNode();
    this.createdBufferSources.push(sourceNode);
    return sourceNode;
  }

  public async resume(): Promise<void> {
    this.state = 'running';
  }

  public async close(): Promise<void> {
    this.state = 'closed';
  }
}

describe('sound-effects helpers', () => {
  it('computes ascending combo brick frequencies across the synthwave scale', () => {
    const baseFirstFrequency = computeComboBrickFrequency(0, 'standard');
    const baseSecondFrequency = computeComboBrickFrequency(1, 'standard');
    const baseTenthFrequency = computeComboBrickFrequency(9, 'standard');

    expect(baseFirstFrequency).toBeCloseTo(261.63, 2);
    expect(baseSecondFrequency).toBeCloseTo(293.66, 2);
    expect(baseTenthFrequency).toBeCloseTo(880.0, 2);
    expect(baseSecondFrequency).toBeGreaterThan(baseFirstFrequency);
    expect(baseTenthFrequency).toBeGreaterThan(baseSecondFrequency);
  });

  it('clamps combo count when below zero or above the scale length', () => {
    const negativeComboFrequency = computeComboBrickFrequency(-5, 'standard');
    const excessiveComboFrequency = computeComboBrickFrequency(99, 'standard');

    expect(negativeComboFrequency).toBeCloseTo(261.63, 2);
    expect(excessiveComboFrequency).toBeCloseTo(1174.66, 2);
  });

  it('handles non-finite combo count safely', () => {
    const notANumberFrequency = computeComboBrickFrequency(NaN, 'standard');
    expect(notANumberFrequency).toBeCloseTo(261.63, 2);
  });

  it('adjusts frequency multiplier according to BrickKind', () => {
    const comboIndex = 4;
    const standardFrequency = computeComboBrickFrequency(comboIndex, 'standard');
    const armoredFrequency = computeComboBrickFrequency(comboIndex, 'armored');
    const explosiveFrequency = computeComboBrickFrequency(comboIndex, 'explosive');
    const splitterFrequency = computeComboBrickFrequency(comboIndex, 'splitter');
    const coreFrequency = computeComboBrickFrequency(comboIndex, 'core');
    const indestructibleFrequency = computeComboBrickFrequency(comboIndex, 'indestructible');

    expect(armoredFrequency).toBeCloseTo(standardFrequency * 0.85, 2);
    expect(explosiveFrequency).toBeCloseTo(standardFrequency * 0.75, 2);
    expect(splitterFrequency).toBeCloseTo(standardFrequency * 1.25, 2);
    expect(coreFrequency).toBeCloseTo(standardFrequency * 1.35, 2);
    expect(indestructibleFrequency).toBeCloseTo(standardFrequency * 0.65, 2);
  });
});

describe('music helpers', () => {
  it('converts MIDI note numbers to expected frequencies', () => {
    expect(midiNoteToFrequency(69)).toBeCloseTo(440, 2);
    expect(midiNoteToFrequency(57)).toBeCloseTo(220, 2);
    expect(midiNoteToFrequency(81)).toBeCloseTo(880, 2);
    expect(midiNoteToFrequency(60)).toBeCloseTo(261.63, 2);
  });
});

describe('SoundEffects', () => {
  let fakeAudioContext: FakeAudioContext;
  let soundEffects: SoundEffects;

  beforeEach(() => {
    fakeAudioContext = new FakeAudioContext();
    soundEffects = new SoundEffects(fakeAudioContext as unknown as AudioContext);
  });

  it('gracefully handles null AudioContext', () => {
    const silentEffects = new SoundEffects(null);
    expect(silentEffects.isMuted).toBe(false);
    silentEffects.setMuted(true);
    expect(silentEffects.isMuted).toBe(true);
    expect(silentEffects.toggleMuted()).toBe(false);

    expect(() => {
      silentEffects.paddleHit();
      silentEffects.paddleHit(true);
      silentEffects.wallHit();
      silentEffects.brickHit(0, false, 'standard');
      silentEffects.brickHit(3, true, 'explosive');
      silentEffects.explosion();
      silentEffects.laserShoot();
      silentEffects.powerUpCollect('multiball');
      silentEffects.stageClear();
      silentEffects.ballLost();
      silentEffects.barrierSave();
      silentEffects.feverStart();
      silentEffects.uiClick();
    }).not.toThrow();
  });

  it('initializes master gain and noise buffer upon creation', () => {
    expect(fakeAudioContext.createdGainNodes.length).toBeGreaterThan(0);
    expect(fakeAudioContext.createdBuffers.length).toBe(1);
    expect(soundEffects.isMuted).toBe(false);
  });

  it('toggles muted state and adjusts master gain', () => {
    expect(soundEffects.isMuted).toBe(false);
    const newMutedState = soundEffects.toggleMuted();
    expect(newMutedState).toBe(true);
    expect(soundEffects.isMuted).toBe(true);

    const masterGainNode = fakeAudioContext.createdGainNodes[0];
    expect(masterGainNode?.gain.value).toBe(0);

    soundEffects.setMuted(false);
    expect(soundEffects.isMuted).toBe(false);
    expect(masterGainNode?.gain.value).toBe(0.85);
  });

  it('plays paddle hit and parry chime', () => {
    const initialOscillatorCount = fakeAudioContext.createdOscillators.length;
    soundEffects.paddleHit(false);
    expect(fakeAudioContext.createdOscillators.length).toBe(initialOscillatorCount + 1);

    const beforeParryCount = fakeAudioContext.createdOscillators.length;
    soundEffects.paddleHit(true);
    expect(fakeAudioContext.createdOscillators.length).toBe(beforeParryCount + 3);
  });

  it('plays wall hit blip', () => {
    const beforeCount = fakeAudioContext.createdOscillators.length;
    soundEffects.wallHit();
    expect(fakeAudioContext.createdOscillators.length).toBe(beforeCount + 1);
    const blipOscillator = fakeAudioContext.createdOscillators.at(-1);
    expect(blipOscillator?.type).toBe('triangle');
  });

  it('plays brick hit tone with sparkle overtone when destroyed', () => {
    const beforeCount = fakeAudioContext.createdOscillators.length;
    soundEffects.brickHit(2, false, 'armored');
    expect(fakeAudioContext.createdOscillators.length).toBe(beforeCount + 1);

    soundEffects.brickHit(2, true, 'splitter');
    expect(fakeAudioContext.createdOscillators.length).toBe(beforeCount + 3);
  });

  it('plays explosion noise burst and sub-bass drop', () => {
    const beforeOscillators = fakeAudioContext.createdOscillators.length;
    const beforeBufferSources = fakeAudioContext.createdBufferSources.length;

    soundEffects.explosion();

    expect(fakeAudioContext.createdOscillators.length).toBe(beforeOscillators + 1);
    expect(fakeAudioContext.createdBufferSources.length).toBe(beforeBufferSources + 1);
  });

  it('throttles rapid laser shoot calls', () => {
    fakeAudioContext.currentTime = 1.0;
    const beforeCount = fakeAudioContext.createdOscillators.length;

    soundEffects.laserShoot();
    expect(fakeAudioContext.createdOscillators.length).toBe(beforeCount + 1);

    // Call immediately within throttle threshold
    fakeAudioContext.currentTime = 1.01;
    soundEffects.laserShoot();
    expect(fakeAudioContext.createdOscillators.length).toBe(beforeCount + 1);

    // Advance beyond throttle threshold
    fakeAudioContext.currentTime = 1.05;
    soundEffects.laserShoot();
    expect(fakeAudioContext.createdOscillators.length).toBe(beforeCount + 2);
  });

  it('plays power-up collect arpeggio for various kinds', () => {
    const powerUpKinds: PowerUpKind[] = [
      'multiball',
      'wide',
      'laser',
      'pierce',
      'magnet',
      'barrier',
    ];
    for (const kind of powerUpKinds) {
      const beforeCount = fakeAudioContext.createdOscillators.length;
      soundEffects.powerUpCollect(kind);
      expect(fakeAudioContext.createdOscillators.length).toBe(beforeCount + 3);
    }
  });

  it('plays victory fanfare on stage clear', () => {
    const beforeCount = fakeAudioContext.createdOscillators.length;
    soundEffects.stageClear();
    expect(fakeAudioContext.createdOscillators.length).toBe(beforeCount + 4);
  });

  it('plays descending sweep on ball lost', () => {
    const beforeCount = fakeAudioContext.createdOscillators.length;
    soundEffects.ballLost();
    expect(fakeAudioContext.createdOscillators.length).toBe(beforeCount + 1);
    const lostOscillator = fakeAudioContext.createdOscillators.at(-1);
    expect(lostOscillator?.type).toBe('sawtooth');
  });

  it('plays resonant shield rebound on barrier save', () => {
    const beforeOscillators = fakeAudioContext.createdOscillators.length;
    const beforeSources = fakeAudioContext.createdBufferSources.length;
    soundEffects.barrierSave();
    expect(fakeAudioContext.createdOscillators.length).toBe(beforeOscillators + 1);
    expect(fakeAudioContext.createdBufferSources.length).toBe(beforeSources + 1);
  });

  it('plays ascending octave synth stinger on fever start', () => {
    const beforeCount = fakeAudioContext.createdOscillators.length;
    soundEffects.feverStart();
    expect(fakeAudioContext.createdOscillators.length).toBe(beforeCount + 2);
  });

  it('plays ui click blip', () => {
    const beforeCount = fakeAudioContext.createdOscillators.length;
    soundEffects.uiClick();
    expect(fakeAudioContext.createdOscillators.length).toBe(beforeCount + 1);
  });

  it('re-attaches to a new AudioContext cleanly', () => {
    const secondContext = new FakeAudioContext();
    const destinationNode = secondContext.createGain();

    soundEffects.attachAudioContext(
      secondContext as unknown as AudioContext,
      destinationNode as unknown as AudioNode,
    );

    const beforeCount = secondContext.createdOscillators.length;
    soundEffects.wallHit();
    expect(secondContext.createdOscillators.length).toBe(beforeCount + 1);
  });
});

describe('MusicEngine', () => {
  let fakeAudioContext: FakeAudioContext;
  let musicEngine: MusicEngine;

  beforeEach(() => {
    vi.useFakeTimers();
    fakeAudioContext = new FakeAudioContext();
    musicEngine = new MusicEngine(fakeAudioContext as unknown as AudioContext);
  });

  afterEach(() => {
    musicEngine.stop();
    vi.useRealTimers();
  });

  it('handles null AudioContext gracefully', () => {
    const silentMusic = new MusicEngine(null);
    expect(silentMusic.isPlaying).toBe(false);
    expect(silentMusic.intensity).toBeCloseTo(0.35, 2);
    expect(silentMusic.currentIntensity).toBeCloseTo(0.35, 2);

    silentMusic.setIntensity(0.8);
    expect(silentMusic.intensity).toBeCloseTo(0.8, 2);

    expect(() => {
      silentMusic.start();
      silentMusic.scheduleStep(0, 0);
      silentMusic.stop();
    }).not.toThrow();
  });

  it('clamps intensity between 0 and 1', () => {
    musicEngine.setIntensity(-0.5);
    expect(musicEngine.intensity).toBe(0);

    musicEngine.setIntensity(1.5);
    expect(musicEngine.intensity).toBe(1);

    musicEngine.setIntensity(NaN);
    expect(musicEngine.intensity).toBe(0);
  });

  it('starts and stops playing state and resumes suspended context', () => {
    expect(fakeAudioContext.state).toBe('suspended');
    expect(musicEngine.isPlaying).toBe(false);

    musicEngine.start();
    expect(musicEngine.isPlaying).toBe(true);
    expect(fakeAudioContext.state).toBe('running');

    musicEngine.stop();
    expect(musicEngine.isPlaying).toBe(false);
  });

  it('schedules low intensity steps with bass, kick, and hi-hats', () => {
    musicEngine.setIntensity(0.2);

    const beforeOscillators = fakeAudioContext.createdOscillators.length;
    // Step 0 is beat 1: kick, bass, hi-hat
    musicEngine.scheduleStep(0, 1.0);

    expect(fakeAudioContext.createdOscillators.length).toBeGreaterThan(beforeOscillators);
  });

  it('schedules gated snare on beats 2 and 4 (steps 4 and 12)', () => {
    musicEngine.setIntensity(0.2);

    const beforeOscillators = fakeAudioContext.createdOscillators.length;
    const beforeSources = fakeAudioContext.createdBufferSources.length;

    musicEngine.scheduleStep(4, 1.5);

    expect(fakeAudioContext.createdOscillators.length).toBeGreaterThan(beforeOscillators);
    expect(fakeAudioContext.createdBufferSources.length).toBeGreaterThan(beforeSources);
  });

  it('schedules warm chord stabs at medium intensity >= 0.3', () => {
    musicEngine.setIntensity(0.4);

    const stepZeroBeforeCount = fakeAudioContext.createdOscillators.length;
    musicEngine.scheduleStep(0, 2.0);
    const stepZeroAfterCount = fakeAudioContext.createdOscillators.length;
    // Step 0 triggers chord stab (3 notes with 2 detuned oscillators each = 6 oscillators) + kick + bass
    expect(stepZeroAfterCount - stepZeroBeforeCount).toBeGreaterThanOrEqual(7);

    // Non-chord step within bar (e.g. step 2) should not schedule chord stabs
    const stepTwoBeforeCount = fakeAudioContext.createdOscillators.length;
    musicEngine.scheduleStep(2, 2.2);
    const stepTwoAfterCount = fakeAudioContext.createdOscillators.length;
    expect(stepTwoAfterCount - stepTwoBeforeCount).toBeLessThan(
      stepZeroAfterCount - stepZeroBeforeCount,
    );
  });

  it('schedules soaring lead melody at high intensity >= 0.55', () => {
    musicEngine.setIntensity(0.7);

    // Step 0 has lead melody note (MIDI 69)
    const beforeCount = fakeAudioContext.createdOscillators.length;
    musicEngine.scheduleStep(0, 3.0);
    const afterCount = fakeAudioContext.createdOscillators.length;

    // Must include lead oscillator in addition to kick, bass, and chord stab
    expect(afterCount).toBeGreaterThan(beforeCount + 7);
  });

  it('handles negative and wrapping step indexes correctly', () => {
    expect(() => {
      musicEngine.scheduleStep(-1, 0.5);
      musicEngine.scheduleStep(64, 1.0);
      musicEngine.scheduleStep(128, 1.5);
    }).not.toThrow();
  });

  it('re-attaches context and resumes scheduling if playing', () => {
    musicEngine.start();
    expect(musicEngine.isPlaying).toBe(true);

    const secondContext = new FakeAudioContext();
    const destinationNode = secondContext.createGain();

    musicEngine.attachAudioContext(
      secondContext as unknown as AudioContext,
      destinationNode as unknown as AudioNode,
    );

    expect(musicEngine.isPlaying).toBe(true);
    musicEngine.stop();
  });
});

describe('AudioEngine', () => {
  let originalGlobalAudioContext: typeof AudioContext | undefined;

  beforeEach(() => {
    const globalHolder = globalThis as unknown as {
      AudioContext?: typeof AudioContext;
    };
    originalGlobalAudioContext = globalHolder.AudioContext;
  });

  afterEach(() => {
    const globalHolder = globalThis as unknown as {
      AudioContext?: typeof AudioContext;
    };
    globalHolder.AudioContext = originalGlobalAudioContext;
  });

  it('behaves gracefully when AudioContext is unavailable', async () => {
    const globalHolder = globalThis as unknown as {
      AudioContext?: typeof AudioContext;
    };
    delete globalHolder.AudioContext;

    const audioEngine = new AudioEngine();
    expect(audioEngine.isAvailable).toBe(false);
    expect(audioEngine.hasContext).toBe(false);
    expect(audioEngine.isMuted).toBe(false);

    expect(() => {
      audioEngine.unlock();
      audioEngine.handleUserGesture();
      audioEngine.startMusic();
      audioEngine.stopMusic();
      audioEngine.setIntensity(0.5);
      audioEngine.paddleHit();
      audioEngine.wallHit();
      audioEngine.brickHit(1, false, 'standard');
      audioEngine.explosion();
      audioEngine.laserShoot();
      audioEngine.powerUpCollect('laser');
      audioEngine.stageClear();
      audioEngine.ballLost();
      audioEngine.barrierSave();
      audioEngine.feverStart();
      audioEngine.uiClick();
      audioEngine.setMuted(true);
      audioEngine.toggleMuted();
    }).not.toThrow();

    await expect(audioEngine.resume()).resolves.toBeUndefined();
    await expect(audioEngine.dispose()).resolves.toBeUndefined();
  });

  it('lazily instantiates AudioContext on unlock or user gesture', async () => {
    let contextConstructorCallCount = 0;
    const fakeContextConstructor = class extends FakeAudioContext {
      public constructor() {
        super();
        contextConstructorCallCount += 1;
      }
    };

    const globalHolder = globalThis as unknown as {
      AudioContext?: unknown;
    };
    globalHolder.AudioContext = fakeContextConstructor;

    const audioEngine = new AudioEngine();
    expect(audioEngine.isAvailable).toBe(true);
    expect(audioEngine.hasContext).toBe(false);

    audioEngine.unlock();
    await audioEngine.resume();

    expect(audioEngine.hasContext).toBe(true);
    expect(contextConstructorCallCount).toBe(1);

    // Verify alias
    expect(audioEngine.soundEffects).toBe(audioEngine.effects);

    await audioEngine.dispose();
    expect(audioEngine.hasContext).toBe(false);
  });

  it('attaches gesture listeners and triggers resume on user event', async () => {
    const fakeContextConstructor = class extends FakeAudioContext {};
    const globalHolder = globalThis as unknown as {
      AudioContext?: unknown;
    };
    globalHolder.AudioContext = fakeContextConstructor;

    const audioEngine = new AudioEngine();
    const eventTarget = new EventTarget();

    audioEngine.attachGestureListeners(eventTarget);
    // Attaching twice should be safe and idempotent
    audioEngine.attachGestureListeners(eventTarget);

    expect(audioEngine.hasContext).toBe(false);

    eventTarget.dispatchEvent(new Event('pointerdown'));
    await Promise.resolve();

    expect(audioEngine.hasContext).toBe(true);
    await audioEngine.dispose();
  });

  it('delegates all AudioSink methods correctly to sound effects and music', async () => {
    const fakeContextConstructor = class extends FakeAudioContext {};
    const globalHolder = globalThis as unknown as {
      AudioContext?: unknown;
    };
    globalHolder.AudioContext = fakeContextConstructor;

    const audioEngine = new AudioEngine();
    await audioEngine.resume();

    const paddleSpy = vi.spyOn(audioEngine.effects, 'paddleHit');
    const wallSpy = vi.spyOn(audioEngine.effects, 'wallHit');
    const brickSpy = vi.spyOn(audioEngine.effects, 'brickHit');
    const explosionSpy = vi.spyOn(audioEngine.effects, 'explosion');
    const laserSpy = vi.spyOn(audioEngine.effects, 'laserShoot');
    const powerUpSpy = vi.spyOn(audioEngine.effects, 'powerUpCollect');
    const clearSpy = vi.spyOn(audioEngine.effects, 'stageClear');
    const ballLostSpy = vi.spyOn(audioEngine.effects, 'ballLost');
    const barrierSpy = vi.spyOn(audioEngine.effects, 'barrierSave');
    const feverSpy = vi.spyOn(audioEngine.effects, 'feverStart');
    const uiSpy = vi.spyOn(audioEngine.effects, 'uiClick');
    const musicStartSpy = vi.spyOn(audioEngine.music, 'start');
    const musicStopSpy = vi.spyOn(audioEngine.music, 'stop');
    const musicIntensitySpy = vi.spyOn(audioEngine.music, 'setIntensity');

    audioEngine.paddleHit(true);
    expect(paddleSpy).toHaveBeenCalledWith(true);

    audioEngine.wallHit();
    expect(wallSpy).toHaveBeenCalled();

    audioEngine.brickHit(3, true, 'splitter');
    expect(brickSpy).toHaveBeenCalledWith(3, true, 'splitter');

    audioEngine.explosion();
    expect(explosionSpy).toHaveBeenCalled();

    audioEngine.laserShoot();
    expect(laserSpy).toHaveBeenCalled();

    audioEngine.powerUpCollect('pierce');
    expect(powerUpSpy).toHaveBeenCalledWith('pierce');

    audioEngine.stageClear();
    expect(clearSpy).toHaveBeenCalled();

    audioEngine.ballLost();
    expect(ballLostSpy).toHaveBeenCalled();

    audioEngine.barrierSave();
    expect(barrierSpy).toHaveBeenCalled();

    audioEngine.feverStart();
    expect(feverSpy).toHaveBeenCalled();

    audioEngine.uiClick();
    expect(uiSpy).toHaveBeenCalled();

    audioEngine.startMusic();
    await Promise.resolve();
    expect(musicStartSpy).toHaveBeenCalled();

    audioEngine.stopMusic();
    expect(musicStopSpy).toHaveBeenCalled();

    audioEngine.setIntensity(0.75);
    expect(musicIntensitySpy).toHaveBeenCalledWith(0.75);

    // Mute controls
    audioEngine.setMuted(true);
    expect(audioEngine.isMuted).toBe(true);
    expect(audioEngine.effects.isMuted).toBe(true);

    const toggledResult = audioEngine.toggleMuted();
    expect(toggledResult).toBe(false);
    expect(audioEngine.isMuted).toBe(false);

    await audioEngine.dispose();
  });
});
