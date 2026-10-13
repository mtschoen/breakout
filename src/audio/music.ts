const TEMPO_BEATS_PER_MINUTE = 128;
const STEPS_PER_BEAT = 4;
const SECONDS_PER_STEP = 60 / TEMPO_BEATS_PER_MINUTE / STEPS_PER_BEAT;
const STEPS_PER_BAR = 16;
const BAR_COUNT = 4;
const TOTAL_STEP_COUNT = STEPS_PER_BAR * BAR_COUNT;
const SCHEDULER_INTERVAL_MILLISECONDS = 25;
const SCHEDULE_AHEAD_SECONDS = 0.12;

const BAR_CHORD_ROOT_MIDI_NOTES: readonly number[] = [33, 29, 36, 31];

const BAR_CHORD_TRIAD_MIDI_NOTES: readonly (readonly number[])[] = [
  [57, 60, 64], // A minor (A3, C4, E4)
  [53, 57, 60], // F major (F3, A3, C4)
  [60, 64, 67], // C major (C4, E4, G4)
  [55, 59, 62], // G major (G3, B3, D4)
];

const LEAD_MELODY_MIDI_NOTES: readonly (number | null)[] = [
  // Bar 0: A minor
  69,
  null,
  null,
  72,
  76,
  null,
  null,
  null,
  79,
  null,
  76,
  null,
  74,
  null,
  72,
  null,
  // Bar 1: F major
  69,
  null,
  null,
  72,
  77,
  null,
  null,
  null,
  76,
  null,
  74,
  null,
  72,
  null,
  74,
  null,
  // Bar 2: C major
  76,
  null,
  null,
  79,
  81,
  null,
  null,
  null,
  79,
  null,
  76,
  null,
  74,
  null,
  76,
  null,
  // Bar 3: G major
  74,
  null,
  null,
  71,
  67,
  null,
  null,
  null,
  71,
  null,
  74,
  null,
  76,
  null,
  79,
  null,
];

export function midiNoteToFrequency(midiNote: number): number {
  return 440 * Math.pow(2, (midiNote - 69) / 12);
}

function clampIntensity(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.min(1, Math.max(0, value));
}

export class MusicEngine {
  private audioContext: AudioContext | null;
  private outputNode: AudioNode | null;
  private musicGainNode: GainNode | null = null;
  private compressorNode: DynamicsCompressorNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private schedulerTimer: ReturnType<typeof setInterval> | null = null;
  private nextNoteTimeSeconds = 0;
  private currentStepIndex = 0;
  private intensityValue = 0.35;
  private playing = false;

  public constructor(audioContext: AudioContext | null, outputNode?: AudioNode) {
    this.audioContext = audioContext;
    this.outputNode = outputNode ?? null;
    this.rebuildAudioGraph();
  }

  public attachAudioContext(audioContext: AudioContext, outputNode: AudioNode): void {
    const wasPlaying = this.playing;
    this.stopScheduler();
    this.audioContext = audioContext;
    this.outputNode = outputNode;
    this.rebuildAudioGraph();
    if (wasPlaying) {
      this.beginScheduling();
    }
  }

  public get isPlaying(): boolean {
    return this.playing;
  }

  public get intensity(): number {
    return this.intensityValue;
  }

  public get currentIntensity(): number {
    return this.intensityValue;
  }

  public setIntensity(value: number): void {
    this.intensityValue = clampIntensity(value);
    if (this.musicGainNode !== null && this.audioContext !== null) {
      const targetVolume = 0.24 + this.intensityValue * 0.08;
      this.musicGainNode.gain.setTargetAtTime(targetVolume, this.audioContext.currentTime, 0.05);
    }
  }

  public start(): void {
    if (this.audioContext === null || this.playing) {
      return;
    }
    if (this.audioContext.state === 'suspended') {
      void this.audioContext.resume().catch(() => undefined);
    }
    this.playing = true;
    this.beginScheduling();
  }

  public stop(): void {
    this.playing = false;
    this.stopScheduler();
    if (this.musicGainNode !== null && this.audioContext !== null) {
      this.musicGainNode.gain.setTargetAtTime(0.0001, this.audioContext.currentTime, 0.03);
    }
  }

  public scheduleStep(stepIndex: number, stepTimeSeconds: number): void {
    const normalizedStep = ((stepIndex % TOTAL_STEP_COUNT) + TOTAL_STEP_COUNT) % TOTAL_STEP_COUNT;
    const stepWithinBar = normalizedStep % STEPS_PER_BAR;
    const barIndex = Math.floor(normalizedStep / STEPS_PER_BAR) % BAR_COUNT;
    const chordRootMidiNote = BAR_CHORD_ROOT_MIDI_NOTES[barIndex] ?? 33;

    // Driving 16th-note arpeggio bassline: plays every step across the 64-step loop
    this.playBass(chordRootMidiNote, stepWithinBar, stepTimeSeconds);

    // Four-on-the-floor punchy synth kick: beats 1, 2, 3, 4
    if (stepWithinBar % 4 === 0) {
      this.playKick(stepTimeSeconds, 0.45);
    }

    // Gated snare on beats 2 and 4 (steps 4 and 12)
    if (stepWithinBar === 4 || stepWithinBar === 12) {
      this.playSnare(stepTimeSeconds);
    }

    // Crisp hi-hats: on 8th notes, with 16th-note fills at higher intensity
    if (stepWithinBar % 2 === 0) {
      this.playHiHat(stepTimeSeconds, 0.035, 0.06);
    } else if (this.intensityValue >= 0.5) {
      this.playHiHat(stepTimeSeconds, 0.025, 0.04);
    }

    // Warm chord stabs at medium intensity >= 0.3
    if (this.intensityValue >= 0.3) {
      const isChordStabStep = stepWithinBar === 0 || stepWithinBar === 6 || stepWithinBar === 10;
      if (isChordStabStep) {
        const chordTriad = BAR_CHORD_TRIAD_MIDI_NOTES[barIndex] ?? [57, 60, 64];
        const durationSeconds =
          stepWithinBar === 0 ? SECONDS_PER_STEP * 2.5 : SECONDS_PER_STEP * 1.5;
        this.playChordStab(chordTriad, stepTimeSeconds, durationSeconds);
      }
    }

    // Soaring synthwave lead melody at higher intensity >= 0.55
    if (this.intensityValue >= 0.55) {
      const leadMidiNote = LEAD_MELODY_MIDI_NOTES[normalizedStep] ?? null;
      if (leadMidiNote !== null) {
        this.playLeadNote(leadMidiNote, stepTimeSeconds, SECONDS_PER_STEP * 1.8);
      }
    }
  }

  private rebuildAudioGraph(): void {
    this.musicGainNode = null;
    this.compressorNode = null;
    this.noiseBuffer = null;
    if (this.audioContext === null) {
      return;
    }
    const destinationNode = this.outputNode ?? this.audioContext.destination;

    this.compressorNode = this.audioContext.createDynamicsCompressor();
    this.compressorNode.threshold.value = -14;
    this.compressorNode.knee.value = 16;
    this.compressorNode.ratio.value = 6;
    this.compressorNode.attack.value = 0.003;
    this.compressorNode.release.value = 0.16;
    this.compressorNode.connect(destinationNode);

    this.musicGainNode = this.audioContext.createGain();
    this.musicGainNode.gain.value = 0.24 + this.intensityValue * 0.08;
    this.musicGainNode.connect(this.compressorNode);

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

  private beginScheduling(): void {
    if (this.audioContext === null || this.musicGainNode === null) {
      this.playing = false;
      return;
    }
    this.musicGainNode.gain.setTargetAtTime(
      0.24 + this.intensityValue * 0.08,
      this.audioContext.currentTime,
      0.05,
    );
    this.currentStepIndex = 0;
    this.nextNoteTimeSeconds = this.audioContext.currentTime + 0.05;
    this.scheduleAhead();
    this.schedulerTimer = setInterval(() => {
      this.scheduleAhead();
    }, SCHEDULER_INTERVAL_MILLISECONDS);
  }

  private stopScheduler(): void {
    if (this.schedulerTimer !== null) {
      clearInterval(this.schedulerTimer);
      this.schedulerTimer = null;
    }
  }

  private scheduleAhead(): void {
    if (!this.playing || this.audioContext === null) {
      return;
    }
    while (this.nextNoteTimeSeconds < this.audioContext.currentTime + SCHEDULE_AHEAD_SECONDS) {
      this.scheduleStep(this.currentStepIndex, this.nextNoteTimeSeconds);
      this.nextNoteTimeSeconds += SECONDS_PER_STEP;
      this.currentStepIndex = (this.currentStepIndex + 1) % TOTAL_STEP_COUNT;
    }
  }

  private playKick(stepTimeSeconds: number, volume: number): void {
    if (this.audioContext === null || this.musicGainNode === null) {
      return;
    }
    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(150, stepTimeSeconds);
    oscillator.frequency.exponentialRampToValueAtTime(42, stepTimeSeconds + 0.09);

    gainNode.gain.setValueAtTime(volume, stepTimeSeconds);
    gainNode.gain.exponentialRampToValueAtTime(0.001, stepTimeSeconds + 0.12);

    oscillator.connect(gainNode);
    gainNode.connect(this.musicGainNode);

    oscillator.start(stepTimeSeconds);
    oscillator.stop(stepTimeSeconds + 0.13);
  }

  private playSnare(stepTimeSeconds: number): void {
    this.playNoise({
      stepTimeSeconds,
      durationSeconds: 0.12,
      filterType: 'bandpass',
      filterFrequency: 1800,
      filterQuality: 0.8,
      volume: 0.28,
    });
    if (this.audioContext === null || this.musicGainNode === null) {
      return;
    }
    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();
    oscillator.type = 'triangle';
    oscillator.frequency.setValueAtTime(180, stepTimeSeconds);
    oscillator.frequency.exponentialRampToValueAtTime(80, stepTimeSeconds + 0.07);

    gainNode.gain.setValueAtTime(0.16, stepTimeSeconds);
    gainNode.gain.exponentialRampToValueAtTime(0.001, stepTimeSeconds + 0.08);

    oscillator.connect(gainNode);
    gainNode.connect(this.musicGainNode);

    oscillator.start(stepTimeSeconds);
    oscillator.stop(stepTimeSeconds + 0.09);
  }

  private playHiHat(stepTimeSeconds: number, durationSeconds: number, volume: number): void {
    this.playNoise({
      stepTimeSeconds,
      durationSeconds,
      filterType: 'highpass',
      filterFrequency: 8000,
      filterQuality: 0.7,
      volume,
    });
  }

  private playNoise(parameters: {
    stepTimeSeconds: number;
    durationSeconds: number;
    filterType: BiquadFilterType;
    filterFrequency: number;
    filterQuality: number;
    volume: number;
  }): void {
    if (this.audioContext === null || this.musicGainNode === null || this.noiseBuffer === null) {
      return;
    }
    const sourceNode = this.audioContext.createBufferSource();
    sourceNode.buffer = this.noiseBuffer;
    sourceNode.loop = true;

    const filterNode = this.audioContext.createBiquadFilter();
    filterNode.type = parameters.filterType;
    filterNode.frequency.value = parameters.filterFrequency;
    filterNode.Q.value = parameters.filterQuality;

    const gainNode = this.audioContext.createGain();
    gainNode.gain.setValueAtTime(parameters.volume, parameters.stepTimeSeconds);
    gainNode.gain.exponentialRampToValueAtTime(
      0.001,
      parameters.stepTimeSeconds + parameters.durationSeconds,
    );

    sourceNode.connect(filterNode);
    filterNode.connect(gainNode);
    gainNode.connect(this.musicGainNode);

    sourceNode.start(parameters.stepTimeSeconds, Math.random() * 0.5);
    sourceNode.stop(parameters.stepTimeSeconds + parameters.durationSeconds + 0.02);
  }

  private playBass(rootMidiNote: number, stepWithinBar: number, stepTimeSeconds: number): void {
    if (this.audioContext === null || this.musicGainNode === null) {
      return;
    }
    const isOctaveStep = stepWithinBar % 2 === 1;
    const bassMidiNote = isOctaveStep ? rootMidiNote + 12 : rootMidiNote;
    const bassFrequency = midiNoteToFrequency(bassMidiNote);

    const oscillator = this.audioContext.createOscillator();
    oscillator.type = 'sawtooth';
    oscillator.frequency.setValueAtTime(bassFrequency, stepTimeSeconds);

    const filterNode = this.audioContext.createBiquadFilter();
    filterNode.type = 'lowpass';
    filterNode.frequency.setValueAtTime(700, stepTimeSeconds);
    filterNode.frequency.exponentialRampToValueAtTime(180, stepTimeSeconds + 0.09);

    const gainNode = this.audioContext.createGain();
    const durationSeconds = SECONDS_PER_STEP * 0.85;
    gainNode.gain.setValueAtTime(0.22, stepTimeSeconds);
    gainNode.gain.exponentialRampToValueAtTime(0.001, stepTimeSeconds + durationSeconds);

    oscillator.connect(filterNode);
    filterNode.connect(gainNode);
    gainNode.connect(this.musicGainNode);

    oscillator.start(stepTimeSeconds);
    oscillator.stop(stepTimeSeconds + durationSeconds + 0.02);
  }

  private playChordStab(
    chordTriad: readonly number[],
    stepTimeSeconds: number,
    durationSeconds: number,
  ): void {
    if (this.audioContext === null || this.musicGainNode === null) {
      return;
    }
    for (const midiNote of chordTriad) {
      const frequency = midiNoteToFrequency(midiNote);

      const filterNode = this.audioContext.createBiquadFilter();
      filterNode.type = 'lowpass';
      filterNode.frequency.setValueAtTime(2200, stepTimeSeconds);

      const gainNode = this.audioContext.createGain();
      gainNode.gain.setValueAtTime(0.08, stepTimeSeconds);
      gainNode.gain.exponentialRampToValueAtTime(0.001, stepTimeSeconds + durationSeconds);

      filterNode.connect(gainNode);
      gainNode.connect(this.musicGainNode);

      for (const detuneCents of [-6, 6]) {
        const oscillator = this.audioContext.createOscillator();
        oscillator.type = 'sawtooth';
        oscillator.frequency.setValueAtTime(frequency, stepTimeSeconds);
        oscillator.detune.value = detuneCents;

        oscillator.connect(filterNode);
        oscillator.start(stepTimeSeconds);
        oscillator.stop(stepTimeSeconds + durationSeconds + 0.02);
      }
    }
  }

  private playLeadNote(midiNote: number, stepTimeSeconds: number, durationSeconds: number): void {
    if (this.audioContext === null || this.musicGainNode === null) {
      return;
    }
    const frequency = midiNoteToFrequency(midiNote);

    const filterNode = this.audioContext.createBiquadFilter();
    filterNode.type = 'lowpass';
    filterNode.frequency.setValueAtTime(4500, stepTimeSeconds);

    const gainNode = this.audioContext.createGain();
    gainNode.gain.setValueAtTime(0.065, stepTimeSeconds);
    gainNode.gain.exponentialRampToValueAtTime(0.001, stepTimeSeconds + durationSeconds);

    filterNode.connect(gainNode);
    gainNode.connect(this.musicGainNode);

    const oscillator = this.audioContext.createOscillator();
    oscillator.type = 'square';
    oscillator.frequency.setValueAtTime(frequency, stepTimeSeconds);

    oscillator.connect(filterNode);
    oscillator.start(stepTimeSeconds);
    oscillator.stop(stepTimeSeconds + durationSeconds + 0.02);
  }
}
