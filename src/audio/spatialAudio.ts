const PENTATONIC_CHAMBER_HZ = [220, 246.94, 293.66, 329.63, 392];
const TAB_CHIME_HZ = [392.0, 440.0, 493.88, 587.33];
const FOCUS_HARMONIC_HZ = [
  196.0,  // Hero Astrolabe
  220.0,  // Systems Spire
  246.94, // Monolith 01
  293.66, // Monolith 02
  329.63, // Monolith 03
  392.0,  // Monolith 04
  440.0,  // Shader Dyson Array
  493.88, // Horizon Orrery
];

// 5-chamber lush harmonic pad voicings [subHz, fifthHz, ninthHz, shimmerHz]
const CHAMBER_VOICINGS: readonly [number, number, number, number][] = [
  [55.0, 82.41, 123.47, 164.81],   // 0.00 Am9 (Hero Astrolabe)
  [49.0, 73.42, 110.0, 146.83],    // 0.25 Gm9 (Compute Spire)
  [43.65, 65.41, 110.0, 130.81],   // 0.50 Fmaj9 (Vault Monoliths)
  [46.25, 69.3, 103.83, 138.59],   // 0.75 F#m9 (Shader Dyson)
  [55.0, 82.41, 123.47, 174.61],   // 1.00 Aadd9 (Celestial Orrery)
];

function sampleVoicing(progress: number): [number, number, number, number] {
  const clamped = Math.min(1, Math.max(0, progress));
  const scaled = clamped * (CHAMBER_VOICINGS.length - 1);
  const idx = Math.min(Math.floor(scaled), CHAMBER_VOICINGS.length - 2);
  const frac = scaled - idx;
  const a = CHAMBER_VOICINGS[idx];
  const b = CHAMBER_VOICINGS[idx + 1];
  return [
    a[0] + (b[0] - a[0]) * frac,
    a[1] + (b[1] - a[1]) * frac,
    a[2] + (b[2] - a[2]) * frac,
    a[3] + (b[3] - a[3]) * frac,
  ];
}

function createStereoReverbIR(ctx: AudioContext, durationSec = 2.6, decay = 2.8): AudioBuffer {
  const rate = ctx.sampleRate;
  const length = Math.floor(rate * durationSec);
  const ir = ctx.createBuffer(2, length, rate);

  for (let ch = 0; ch < 2; ch++) {
    const channelData = ir.getChannelData(ch);
    let lp = 0;
    for (let i = 0; i < length; i++) {
      const t = i / length;
      const env = Math.pow(1 - t, decay) * (1 - Math.exp(-i / (rate * 0.015)));
      const white = Math.random() * 2 - 1;
      // Gentle one-pole lowpass damping for dark obsidian hall warmth
      lp = lp * 0.68 + white * 0.32;
      channelData[i] = lp * env;
    }
  }
  return ir;
}

/**
 * Procedural Web Audio Studio Synthesizer for the 3D Spatial Portfolio.
 * Features a 2.6s stereo dark-hall convolution reverb, warm stereo ping-pong delay,
 * chorused detuned low-frequency analog pad voices, and tactile felt/mechanical SFX.
 */
export class SpatialAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private ambientBus: GainNode | null = null;
  private fxBus: GainNode | null = null;
  private reverbSend: GainNode | null = null;
  private delaySend: GainNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;

  private padFilterA: BiquadFilterNode | null = null;
  private padFilterB: BiquadFilterNode | null = null;
  private lowNoiseFilter: BiquadFilterNode | null = null;
  private lowNoiseGain: GainNode | null = null;
  private shimmerGain: GainNode | null = null;
  private scrollAirFilter: BiquadFilterNode | null = null;
  private scrollAirGain: GainNode | null = null;

  private subOsc: OscillatorNode | null = null;
  private fifthPairs: OscillatorNode[] = [];
  private bodyPairs: OscillatorNode[] = [];
  private shimmerOsc: OscillatorNode | null = null;
  private lfoOscs: OscillatorNode[] = [];
  private noiseSources: AudioBufferSourceNode[] = [];
  private noiseBuffer: AudioBuffer | null = null;

  private muted = false;
  private unlocked = false;
  private disposed = false;

  private lastHoverMs = 0;
  private lastChamberIdx = 0;
  private lastChamberChimeMs = 0;
  private lastFocusChimeMs = 0;

  public isMuted(): boolean {
    return this.muted;
  }

  public isUnlocked(): boolean {
    return this.unlocked;
  }

  public toggleMute(): boolean {
    this.muted = !this.muted;
    if (!this.muted && !this.unlocked) {
      this.unlock();
    }
    this.applyMasterGain();
    if (!this.muted) {
      this.playFeltPluck(440, 0.055, 0.25);
    }
    return this.muted;
  }

  public unlock(): void {
    if (this.disposed) return;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      try {
        this.ctx = new AudioCtx();
      } catch {
        return;
      }
      this.setupGraph(this.ctx);
    }

    if (this.ctx.state === 'suspended') {
      this.ctx
        .resume()
        .then(() => {
          if (!this.disposed) {
            this.unlocked = true;
            this.applyMasterGain();
          }
        })
        .catch(() => {});
    } else if (this.ctx.state === 'running') {
      this.unlocked = true;
      this.applyMasterGain();
    }
  }

  private applyMasterGain(): void {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const target = this.muted || !this.unlocked ? 0.0 : 0.65;
    this.masterGain.gain.cancelScheduledValues(now);
    this.masterGain.gain.setTargetAtTime(target, now, 0.22);

    if (this.ambientBus) {
      const ambientTarget = this.muted || !this.unlocked ? 0.0 : 0.85;
      this.ambientBus.gain.cancelScheduledValues(now);
      this.ambientBus.gain.setTargetAtTime(ambientTarget, now, 0.7);
    }
  }

  private setupGraph(ctx: AudioContext): void {
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -16;
    compressor.knee.value = 18;
    compressor.ratio.value = 3.5;
    compressor.attack.value = 0.008;
    compressor.release.value = 0.25;
    compressor.connect(ctx.destination);
    this.compressor = compressor;

    const masterGain = ctx.createGain();
    masterGain.gain.value = 0;
    masterGain.connect(compressor);
    this.masterGain = masterGain;

    // Stereo Dark-Hall Convolution Reverb
    const convolver = ctx.createConvolver();
    convolver.buffer = createStereoReverbIR(ctx, 2.6, 2.7);
    const reverbReturn = ctx.createGain();
    reverbReturn.gain.value = 0.42;
    convolver.connect(reverbReturn);
    reverbReturn.connect(masterGain);

    const reverbSend = ctx.createGain();
    reverbSend.gain.value = 0.65;
    reverbSend.connect(convolver);
    this.reverbSend = reverbSend;

    // Warm Stereo Ping-Pong Delay for chimes & plucks
    const delayL = ctx.createDelay(1.0);
    const delayR = ctx.createDelay(1.0);
    delayL.delayTime.value = 0.31;
    delayR.delayTime.value = 0.44;

    const fbFilter = ctx.createBiquadFilter();
    fbFilter.type = 'lowpass';
    fbFilter.frequency.value = 1350;

    const fbGain = ctx.createGain();
    fbGain.gain.value = 0.32;

    const panL = typeof ctx.createStereoPanner === 'function' ? ctx.createStereoPanner() : null;
    const panR = typeof ctx.createStereoPanner === 'function' ? ctx.createStereoPanner() : null;
    if (panL && panR) {
      panL.pan.value = -0.45;
      panR.pan.value = 0.45;
      delayL.connect(panL);
      delayR.connect(panR);
      panL.connect(masterGain);
      panR.connect(masterGain);
      panL.connect(reverbSend);
      panR.connect(reverbSend);
    } else {
      delayL.connect(masterGain);
      delayR.connect(masterGain);
    }

    delayL.connect(delayR);
    delayR.connect(fbFilter);
    fbFilter.connect(fbGain);
    fbGain.connect(delayL);

    const delaySend = ctx.createGain();
    delaySend.gain.value = 0.35;
    delaySend.connect(delayL);
    this.delaySend = delaySend;

    // FX Bus (routes dry + reverb + subtle stereo delay)
    const fxBus = ctx.createGain();
    fxBus.gain.value = 0.9;
    fxBus.connect(masterGain);
    fxBus.connect(reverbSend);
    fxBus.connect(delaySend);
    this.fxBus = fxBus;

    // Ambient Bus with sub-rumble highpass (< 36 Hz)
    const highpass = ctx.createBiquadFilter();
    highpass.type = 'highpass';
    highpass.frequency.value = 36;
    highpass.Q.value = 0.7;
    highpass.connect(masterGain);
    highpass.connect(reverbSend);

    const ambientBus = ctx.createGain();
    ambientBus.gain.value = 0;
    ambientBus.connect(highpass);
    this.ambientBus = ambientBus;

    // 1. Dual Cascaded 24dB/oct Warm Analog Lowpass Filter for Evolving Pad
    const padFilterA = ctx.createBiquadFilter();
    padFilterA.type = 'lowpass';
    padFilterA.frequency.value = 210;
    padFilterA.Q.value = 0.85;

    const padFilterB = ctx.createBiquadFilter();
    padFilterB.type = 'lowpass';
    padFilterB.frequency.value = 240;
    padFilterB.Q.value = 0.7;

    padFilterA.connect(padFilterB);
    padFilterB.connect(ambientBus);
    this.padFilterA = padFilterA;
    this.padFilterB = padFilterB;

    const createVoice = (
      freq: number,
      type: OscillatorType,
      gainAmt: number,
      pan = 0,
      detuneCents = 0,
      dest: AudioNode = padFilterA
    ): OscillatorNode => {
      const osc = ctx.createOscillator();
      osc.type = type;
      osc.frequency.value = freq;
      osc.detune.value = detuneCents;

      const g = ctx.createGain();
      g.gain.value = gainAmt;

      if (typeof ctx.createStereoPanner === 'function' && pan !== 0) {
        const panner = ctx.createStereoPanner();
        panner.pan.value = pan;
        osc.connect(g);
        g.connect(panner);
        panner.connect(dest);
      } else {
        osc.connect(g);
        g.connect(dest);
      }

      osc.start();
      return osc;
    };

    // Sub anchor + Chorused warm fifth + Chorused triangle/saw body
    this.subOsc = createVoice(55.0, 'sine', 0.13, 0, 0);
    this.fifthPairs = [
      createVoice(82.41, 'triangle', 0.042, -0.32, -7),
      createVoice(82.41, 'triangle', 0.042, 0.32, 7),
    ];
    this.bodyPairs = [
      createVoice(123.47, 'sawtooth', 0.016, -0.4, -9),
      createVoice(123.47, 'sawtooth', 0.016, 0.4, 9),
    ];

    const shimmerGain = ctx.createGain();
    shimmerGain.gain.value = 0.018;
    shimmerGain.connect(padFilterA);
    this.shimmerGain = shimmerGain;
    this.shimmerOsc = createVoice(164.81, 'triangle', 1.0, 0, 3, shimmerGain);

    // Slow asynchronous LFOs breathing across filter & stereo field
    const lfoCutoff = ctx.createOscillator();
    lfoCutoff.type = 'sine';
    lfoCutoff.frequency.value = 0.052;
    const lfoCutoffGain = ctx.createGain();
    lfoCutoffGain.gain.value = 46;
    lfoCutoff.connect(lfoCutoffGain);
    lfoCutoffGain.connect(padFilterA.frequency);
    lfoCutoff.start();
    this.lfoOscs.push(lfoCutoff);

    // 2. Shared Velvet Pink Noise Buffer
    const bufferLen = Math.floor(ctx.sampleRate * 2.5);
    const noiseBuffer = ctx.createBuffer(1, bufferLen, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    let b0 = 0;
    let b1 = 0;
    let b2 = 0;
    for (let i = 0; i < bufferLen; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99765 * b0 + white * 0.099046;
      b1 = 0.963 * b1 + white * 0.2965164;
      b2 = 0.57 * b2 + white * 1.0526913;
      data[i] = (b0 + b1 + b2 + white * 0.1848) * 0.085;
    }
    this.noiseBuffer = noiseBuffer;

    // 2a. Warm Sub-Atmospheric Wind Bed
    const lowNoiseSource = ctx.createBufferSource();
    lowNoiseSource.buffer = noiseBuffer;
    lowNoiseSource.loop = true;

    const lowNoiseFilter = ctx.createBiquadFilter();
    lowNoiseFilter.type = 'lowpass';
    lowNoiseFilter.frequency.value = 140;
    lowNoiseFilter.Q.value = 1.8;

    const lowNoiseGain = ctx.createGain();
    lowNoiseGain.gain.value = 0.045;

    lowNoiseSource.connect(lowNoiseFilter);
    lowNoiseFilter.connect(lowNoiseGain);
    lowNoiseGain.connect(ambientBus);
    lowNoiseSource.start();
    this.noiseSources.push(lowNoiseSource);
    this.lowNoiseFilter = lowNoiseFilter;
    this.lowNoiseGain = lowNoiseGain;

    // 2b. Scroll-Velocity Spatial Air Swell
    const airNoiseSource = ctx.createBufferSource();
    airNoiseSource.buffer = noiseBuffer;
    airNoiseSource.loop = true;

    const scrollAirFilter = ctx.createBiquadFilter();
    scrollAirFilter.type = 'bandpass';
    scrollAirFilter.frequency.value = 340;
    scrollAirFilter.Q.value = 1.3;

    const scrollAirGain = ctx.createGain();
    scrollAirGain.gain.value = 0;

    airNoiseSource.connect(scrollAirFilter);
    scrollAirFilter.connect(scrollAirGain);
    scrollAirGain.connect(ambientBus);
    airNoiseSource.start();
    this.noiseSources.push(airNoiseSource);
    this.scrollAirFilter = scrollAirFilter;
    this.scrollAirGain = scrollAirGain;
  }

  public updateSpatialMotion(scrollProgress: number, scrollVelocity: number): void {
    if (!this.ctx || !this.unlocked || this.muted || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;
    const speed = Math.min(Math.abs(scrollVelocity), 0.14);

    const [subHz, fifthHz, bodyHz, shimmerHz] = sampleVoicing(scrollProgress);
    if (this.subOsc) this.subOsc.frequency.setTargetAtTime(subHz, now, 0.45);
    this.fifthPairs.forEach((osc) => osc.frequency.setTargetAtTime(fifthHz, now, 0.45));
    this.bodyPairs.forEach((osc) => osc.frequency.setTargetAtTime(bodyHz, now, 0.45));
    if (this.shimmerOsc) this.shimmerOsc.frequency.setTargetAtTime(shimmerHz, now, 0.45);

    if (this.padFilterA && this.padFilterB) {
      const cutoff = 165 + Math.sin(scrollProgress * Math.PI) * 90 + scrollProgress * 80 + speed * 420;
      const clamped = Math.min(cutoff, 370);
      this.padFilterA.frequency.setTargetAtTime(clamped, now, 0.22);
      this.padFilterB.frequency.setTargetAtTime(clamped * 1.15, now, 0.22);
    }

    if (this.lowNoiseFilter && this.lowNoiseGain) {
      this.lowNoiseFilter.frequency.setTargetAtTime(115 + scrollProgress * 85 + speed * 260, now, 0.25);
      this.lowNoiseGain.gain.setTargetAtTime(0.038 + Math.sin(scrollProgress * Math.PI) * 0.015, now, 0.25);
    }

    if (this.shimmerGain) {
      this.shimmerGain.gain.setTargetAtTime(0.012 + scrollProgress * 0.02, now, 0.25);
    }

    if (this.scrollAirGain && this.scrollAirFilter) {
      const airVol = speed > 0.0005 ? Math.min(speed * 0.34, 0.042) : 0;
      const airFreq = 290 + scrollProgress * 260 + speed * 1600;
      this.scrollAirGain.gain.setTargetAtTime(airVol, now, 0.1);
      this.scrollAirFilter.frequency.setTargetAtTime(airFreq, now, 0.1);
    }

    const chamberIdx =
      scrollProgress < 0.14
        ? 0
        : scrollProgress < 0.3
          ? 1
          : scrollProgress < 0.7
            ? 2
            : scrollProgress < 0.9
              ? 3
              : 4;

    if (chamberIdx !== this.lastChamberIdx) {
      this.lastChamberIdx = chamberIdx;
      const nowMs = performance.now();
      if (nowMs - this.lastChamberChimeMs > 900) {
        this.lastChamberChimeMs = nowMs;
        this.playFeltPluck(PENTATONIC_CHAMBER_HZ[chamberIdx], 0.042, 0.75);
      }
    }
  }

  /**
   * Warm felt-bell / damped Rhodes voice routed into stereo reverb + ping-pong delay.
   */
  private playFeltPluck(freq: number, peakGain: number, duration: number): void {
    if (!this.ctx || !this.fxBus || !this.unlocked || this.muted) return;
    const now = this.ctx.currentTime;

    const carrier = this.ctx.createOscillator();
    carrier.type = 'sine';
    carrier.frequency.setValueAtTime(freq, now);

    const warmth = this.ctx.createOscillator();
    warmth.type = 'triangle';
    warmth.frequency.setValueAtTime(freq * 2.0, now);
    warmth.detune.value = 4;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(freq * 4.5, now);
    filter.frequency.exponentialRampToValueAtTime(Math.max(freq * 1.2, 180), now + duration * 0.7);

    const env = this.ctx.createGain();
    env.gain.setValueAtTime(0.0001, now);
    env.gain.linearRampToValueAtTime(peakGain, now + 0.014);
    env.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    const warmGain = this.ctx.createGain();
    warmGain.gain.value = 0.25;

    carrier.connect(filter);
    warmth.connect(warmGain);
    warmGain.connect(filter);
    filter.connect(env);
    env.connect(this.fxBus);

    carrier.start(now);
    warmth.start(now);
    carrier.stop(now + duration + 0.05);
    warmth.stop(now + duration + 0.05);
  }

  public playHover(): void {
    if (!this.ctx || !this.fxBus || !this.unlocked || this.muted || !this.noiseBuffer) return;
    const nowMs = performance.now();
    if (nowMs - this.lastHoverMs < 110) return;
    this.lastHoverMs = nowMs;

    const now = this.ctx.currentTime;
    // Ultra-soft brushed air click + quiet felt harmonic
    const puff = this.ctx.createBufferSource();
    puff.buffer = this.noiseBuffer;

    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1800;
    bp.Q.value = 2.4;

    const env = this.ctx.createGain();
    env.gain.setValueAtTime(0.0001, now);
    env.gain.linearRampToValueAtTime(0.018, now + 0.005);
    env.gain.exponentialRampToValueAtTime(0.0001, now + 0.045);

    puff.connect(bp);
    bp.connect(env);
    env.connect(this.fxBus);
    puff.start(now, Math.random() * 1.2, 0.06);

    this.playFeltPluck(783.99, 0.014, 0.14);
  }

  public playTabSwitch(index: number): void {
    this.unlock();
    const base = TAB_CHIME_HZ[index % TAB_CHIME_HZ.length];
    this.playFeltPluck(base, 0.055, 0.38);
    setTimeout(() => {
      if (!this.disposed) {
        this.playFeltPluck(base * 1.5, 0.028, 0.42);
      }
    }, 55);
  }

  public playMonolithFlip(flipped: boolean): void {
    this.unlock();
    if (!this.ctx || !this.fxBus || !this.unlocked || this.muted) return;
    const now = this.ctx.currentTime;

    // Tactile magnetic sub-thud
    const thump = this.ctx.createOscillator();
    thump.type = 'sine';
    thump.frequency.setValueAtTime(flipped ? 115 : 92, now);
    thump.frequency.exponentialRampToValueAtTime(38, now + 0.17);

    const thumpEnv = this.ctx.createGain();
    thumpEnv.gain.setValueAtTime(0.001, now);
    thumpEnv.gain.linearRampToValueAtTime(0.11, now + 0.01);
    thumpEnv.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);

    thump.connect(thumpEnv);
    thumpEnv.connect(this.fxBus);
    thump.start(now);
    thump.stop(now + 0.24);

    // Warm obsidian bell resonance
    this.playFeltPluck(flipped ? 440 : 329.63, 0.05, 0.52);
  }

  public playShaderAdjust(freq: number, amp: number): void {
    this.unlock();
    const pitch = 220 + freq * 52 + amp * 150;
    this.playFeltPluck(pitch, 0.048, 0.28);
  }

  public playFocusLock(focusSlot: number, isMonolith = false): void {
    if (!this.ctx || !this.fxBus || !this.unlocked || this.muted) return;
    const nowMs = performance.now();
    if (nowMs - this.lastFocusChimeMs < 460) return;
    this.lastFocusChimeMs = nowMs;

    const baseHz = FOCUS_HARMONIC_HZ[focusSlot % FOCUS_HARMONIC_HZ.length];
    this.playFeltPluck(baseHz, isMonolith ? 0.042 : 0.048, 0.65);
    setTimeout(() => {
      if (!this.disposed) {
        this.playFeltPluck(baseHz * 1.5, 0.022, 0.7);
      }
    }, 70);
  }

  public playConfirm(): void {
    this.unlock();
    this.playFeltPluck(440, 0.05, 0.32);
    setTimeout(() => {
      if (!this.disposed) {
        this.playFeltPluck(659.25, 0.052, 0.45);
      }
    }, 75);
  }

  public dispose(): void {
    this.disposed = true;
    const oscs = [
      this.subOsc,
      ...this.fifthPairs,
      ...this.bodyPairs,
      this.shimmerOsc,
      ...this.lfoOscs,
    ];
    for (const osc of oscs) {
      if (!osc) continue;
      try {
        osc.stop();
      } catch {
        // ignore if already stopped
      }
    }
    this.subOsc = null;
    this.fifthPairs = [];
    this.bodyPairs = [];
    this.shimmerOsc = null;
    this.lfoOscs = [];

    for (const src of this.noiseSources) {
      try {
        src.stop();
      } catch {
        // ignore
      }
    }
    this.noiseSources = [];

    if (this.ctx) {
      this.ctx.close().catch(() => {});
      this.ctx = null;
    }
    this.compressor = null;
    this.masterGain = null;
    this.ambientBus = null;
    this.fxBus = null;
    this.reverbSend = null;
    this.delaySend = null;
  }
}
