const AudioContextClass = window.AudioContext || window.webkitAudioContext;

export class ProceduralAudio {
  constructor() {
    this.context = null;
    this.master = null;
    this.compressor = null;
    this.enabled = true;
    this.noiseBuffer = null;
    this.unlocked = false;
    this.masterVolume = 0.85;
  }

  init() {
    if (this.context || !AudioContextClass) return this.context;
    try {
      this.context = new AudioContextClass();

      // Master gain node with punchy, warm output
      this.master = this.context.createGain();
      this.master.gain.setValueAtTime(this.masterVolume, this.context.currentTime);

      // Dynamics compressor / limiter to glue the drum & bass pocket together
      this.compressor = this.context.createDynamicsCompressor();
      this.compressor.threshold.setValueAtTime(-14, this.context.currentTime);
      this.compressor.knee.setValueAtTime(6, this.context.currentTime);
      this.compressor.ratio.setValueAtTime(4, this.context.currentTime);
      this.compressor.attack.setValueAtTime(0.003, this.context.currentTime);
      this.compressor.release.setValueAtTime(0.12, this.context.currentTime);

      this.master.connect(this.compressor).connect(this.context.destination);
      this.noiseBuffer = this.createNoiseBuffer();
    } catch (e) {
      console.warn('AudioContext init error:', e);
    }
    return this.context;
  }

  unlock() {
    if (!AudioContextClass) return;
    if (!this.context) this.init();
    if (!this.context) return;

    if (this.context.state === 'suspended') {
      this.context.resume().catch(() => {});
    }

    if (!this.unlocked) {
      try {
        const buffer = this.context.createBuffer(1, 1, this.context.sampleRate || 44100);
        const source = this.context.createBufferSource();
        source.buffer = buffer;
        source.connect(this.context.destination);
        source.start(0);
        if (this.context.state === 'running') {
          this.unlocked = true;
        }
      } catch {}
    }
  }

  async start() {
    this.unlock();
    if (this.context && this.context.state === 'suspended') {
      try {
        await Promise.race([
          this.context.resume(),
          new Promise((resolve) => window.setTimeout(resolve, 80)),
        ]);
      } catch {}
    }
    if (this.context && this.context.state === 'running') {
      this.unlocked = true;
    }
    return Boolean(this.context);
  }

  async setEnabled(enabled) {
    this.enabled = enabled;
    if (enabled) {
      await this.start();
    }
  }

  setMasterVolume(level) {
    if (!this.context) this.init();
    const clamped = Math.min(Math.max(Number(level) || 0, 0), 1);
    this.masterVolume = clamped;
    if (this.master && this.context) {
      try {
        this.master.gain.setValueAtTime(clamped, this.context.currentTime);
      } catch {
        this.master.gain.value = clamped;
      }
    }
    return clamped;
  }

  getMasterVolume() {
    return this.masterVolume ?? 0.85;
  }

  async playEntrySequence() {
    if (!(await this.start())) return;

    this.kick(0, 0.95);
    this.rim(0.24, 0.75);
    this.hat(0.48, 0.45);
    this.sub(0.78, 0.4);
  }

  hit(type) {
    if (!this.enabled) return;
    this.unlock();

    if (type === 'kick') this.kick(0, 0.95);
    if (type === 'rim' || type === 'snare') this.rim(0, 0.85);
    if (type === 'hat') this.hat(0, 0.5);
  }

  schedule(type, time, level = 0.7, options = {}) {
    if (!this.context) this.init();
    if (!this.enabled || !this.context) return;

    const offset = Math.max(0, (time || this.context.currentTime) - this.context.currentTime);
    if (type === 'kick') this.kick(offset, level);
    if (type === 'rim' || type === 'snare') this.rim(offset, level, options);
    if (type === 'hat') this.hat(offset, level, options);
  }

  /**
   * Schedules a funky sub-bass note + warm Rhodes chord stab on specific steps
   * of the 16-step bar so the beat feels like a real musical jam session.
   */
  scheduleGrooveAccompaniment(step, time) {
    if (!this.context) this.init();
    if (!this.enabled || !this.context || !this.master) return;

    const offset = Math.max(0, (time || this.context.currentTime) - this.context.currentTime);

    // Syncopated D-minor / Dorian funk bassline (Hz)
    const BASS_NOTES = {
      0:  { freq: 73.42, dur: 0.28, gain: 0.36 }, // D2 root punch
      3:  { freq: 87.31, dur: 0.16, gain: 0.24 }, // F2 ghost pluck
      6:  { freq: 98.00, dur: 0.22, gain: 0.30 }, // G2 bounce
      7:  { freq: 110.00, dur: 0.16, gain: 0.25 }, // A2 walk-up
      10: { freq: 73.42, dur: 0.28, gain: 0.34 }, // D2 pocket lock
      13: { freq: 65.41, dur: 0.20, gain: 0.28 }, // C2 turnaround
      15: { freq: 87.31, dur: 0.15, gain: 0.22 }, // F2 pickup
    };

    const bass = BASS_NOTES[step];
    if (bass) {
      this.funkBass(offset, bass.freq, bass.dur, bass.gain);
    }

    // Warm electric-piano / synth chord stabs on steps 2, 11, and 14
    if (step === 2) {
      this.chordStab(offset, [293.66, 349.23, 440.0, 523.25], 0.22, 0.09); // Dm7
    } else if (step === 11) {
      this.chordStab(offset, [261.63, 329.63, 392.0, 493.88], 0.26, 0.085); // Cmaj7
    } else if (step === 14) {
      this.chordStab(offset, [349.23, 440.0, 523.25, 659.25], 0.18, 0.075); // Fmaj7
    }
  }

  funkBass(offset = 0, freq = 73.42, duration = 0.24, level = 0.32) {
    if (!this.context || !this.master) return;
    const now = this.context.currentTime + Math.max(offset, 0.005);

    const osc = this.context.createOscillator();
    const subOsc = this.context.createOscillator();
    const filter = this.context.createBiquadFilter();
    const gain = this.context.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq, now);

    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(freq, now);

    // Envelope-filtered plucky low-pass filter for that warm analog bass bounce
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(freq * 6.5, now);
    filter.frequency.exponentialRampToValueAtTime(freq * 1.6, now + duration * 0.75);
    filter.Q.value = 3.2;

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(level, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(filter);
    subOsc.connect(filter);
    filter.connect(gain).connect(this.master);

    osc.start(now);
    subOsc.start(now);
    osc.stop(now + duration + 0.03);
    subOsc.stop(now + duration + 0.03);
  }

  chordStab(offset = 0, freqs = [293.66, 349.23, 440.0], duration = 0.22, level = 0.08) {
    if (!this.context || !this.master) return;
    const now = this.context.currentTime + Math.max(offset, 0.005);

    const filter = this.context.createBiquadFilter();
    const gain = this.context.createGain();

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1850, now);
    filter.frequency.exponentialRampToValueAtTime(620, now + duration);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(level, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    filter.connect(gain).connect(this.master);

    freqs.forEach((f) => {
      const osc = this.context.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(f, now);
      osc.connect(filter);
      osc.start(now);
      osc.stop(now + duration + 0.03);
    });
  }

  async warpSweep({ duration = 0.9, startFrequency = 180, endFrequency = 1760, level = 0.28 } = {}) {
    if (!this.enabled || !(await this.start())) return;

    const now = this.context.currentTime + 0.005;
    const end = now + duration;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = 'triangle';
    oscillator.frequency.setValueAtTime(startFrequency, now);
    oscillator.frequency.exponentialRampToValueAtTime(endFrequency, end);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(level, now + 0.06);
    gain.gain.exponentialRampToValueAtTime(0.0001, end);
    oscillator.connect(gain).connect(this.master);
    oscillator.start(now);
    oscillator.stop(end + 0.05);
  }

  beat(bpm, accent = false) {
    if (!this.enabled || !this.context) return;

    const step = 60 / Math.max(60, bpm);
    this.kick(0, accent ? 0.95 : 0.75);
    this.hat(step * 0.22, accent ? 0.45 : 0.3);

    if (accent) {
      this.rim(step * 0.42, 0.8);
      this.sub(step * 0.7, 0.4);
    }
  }

  kick(offset = 0, level = 0.9) {
    if (!this.context) this.init();
    if (!this.context || !this.master) return;

    const now = this.context.currentTime + Math.max(offset, 0.005);

    // 1. Deep punchy sub-body
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(148, now);
    oscillator.frequency.exponentialRampToValueAtTime(48, now + 0.09);
    oscillator.frequency.exponentialRampToValueAtTime(38, now + 0.28);

    gain.gain.setValueAtTime(Math.max(level, 0.001), now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);

    oscillator.connect(gain).connect(this.master);
    oscillator.start(now);
    oscillator.stop(now + 0.34);

    // 2. Crisp beater click for warm acoustic definition
    const clickOsc = this.context.createOscillator();
    const clickGain = this.context.createGain();
    clickOsc.type = 'triangle';
    clickOsc.frequency.setValueAtTime(680, now);
    clickOsc.frequency.exponentialRampToValueAtTime(110, now + 0.022);
    clickGain.gain.setValueAtTime(Math.max(level * 0.38, 0.001), now);
    clickGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.026);
    clickOsc.connect(clickGain).connect(this.master);
    clickOsc.start(now);
    clickOsc.stop(now + 0.032);
  }

  rim(offset = 0, level = 0.85, { ghost = false } = {}) {
    if (!this.context) this.init();
    if (!this.context || !this.master) return;
    if (!this.noiseBuffer) this.noiseBuffer = this.createNoiseBuffer();

    const now = this.context.currentTime + Math.max(offset, 0.005);
    const effLevel = ghost ? level * 0.36 : level;

    // 1. FAT TONAL BODY (Acoustic Tama snare shell punch)
    const bodyOsc = this.context.createOscillator();
    const bodyGain = this.context.createGain();

    bodyOsc.type = 'triangle';
    bodyOsc.frequency.setValueAtTime(ghost ? 290 : 245, now);
    bodyOsc.frequency.exponentialRampToValueAtTime(138, now + (ghost ? 0.06 : 0.11));

    bodyGain.gain.setValueAtTime(Math.max(effLevel * 1.05, 0.001), now);
    bodyGain.gain.exponentialRampToValueAtTime(0.0001, now + (ghost ? 0.09 : 0.19));

    bodyOsc.connect(bodyGain).connect(this.master);
    bodyOsc.start(now);
    bodyOsc.stop(now + 0.24);

    // 2. CRISP STICK RIMSHOT SNAP
    const attackOsc = this.context.createOscillator();
    const attackGain = this.context.createGain();

    attackOsc.type = 'sine';
    attackOsc.frequency.setValueAtTime(580, now);
    attackOsc.frequency.exponentialRampToValueAtTime(185, now + 0.028);

    attackGain.gain.setValueAtTime(Math.max(effLevel * 0.8, 0.001), now);
    attackGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.038);

    attackOsc.connect(attackGain).connect(this.master);
    attackOsc.start(now);
    attackOsc.stop(now + 0.05);

    // 3. WARM SNARE WIRE SIZZLE
    const noiseSource = this.context.createBufferSource();
    const noiseFilter = this.context.createBiquadFilter();
    const noiseGain = this.context.createGain();

    noiseSource.buffer = this.noiseBuffer;
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.setValueAtTime(2600, now);
    noiseFilter.frequency.exponentialRampToValueAtTime(1300, now + (ghost ? 0.1 : 0.22));
    noiseFilter.Q.value = 1.2;

    noiseGain.gain.setValueAtTime(Math.max(effLevel * 0.92, 0.001), now);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + (ghost ? 0.11 : 0.24));

    noiseSource.connect(noiseFilter).connect(noiseGain).connect(this.master);
    noiseSource.start(now);
    noiseSource.stop(now + 0.28);
  }

  snare(offset = 0, level = 0.85) {
    this.rim(offset, level);
  }

  hat(offset = 0, level = 0.5, { open = false } = {}) {
    if (!this.context) this.init();
    if (!this.context || !this.master) return;
    if (!this.noiseBuffer) this.noiseBuffer = this.createNoiseBuffer();

    const now = this.context.currentTime + Math.max(offset, 0.005);
    const decay = open ? 0.19 : 0.048;
    const source = this.context.createBufferSource();
    const filter = this.context.createBiquadFilter();
    const gain = this.context.createGain();

    source.buffer = this.noiseBuffer;
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(open ? 5400 : 6800, now);

    gain.gain.setValueAtTime(Math.max(level, 0.001), now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + decay);

    source.connect(filter).connect(gain).connect(this.master);
    source.start(now);
    source.stop(now + decay + 0.03);
  }

  sub(offset = 0, level = 0.4) {
    if (!this.context || !this.master) return;

    const now = this.context.currentTime + Math.max(offset, 0.005);
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();

    oscillator.type = 'triangle';
    oscillator.frequency.setValueAtTime(58, now);
    oscillator.frequency.exponentialRampToValueAtTime(40, now + 0.24);

    gain.gain.setValueAtTime(Math.max(level, 0.001), now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);

    oscillator.connect(gain).connect(this.master);
    oscillator.start(now);
    oscillator.stop(now + 0.35);
  }

  createNoiseBuffer() {
    const sampleRate = (this.context && this.context.sampleRate) || 44100;
    const buffer = this.context.createBuffer(1, Math.floor(sampleRate * 0.6), sampleRate);
    const data = buffer.getChannelData(0);

    for (let index = 0; index < data.length; index += 1) {
      data[index] = Math.random() * 2 - 1;
    }

    return buffer;
  }
}
