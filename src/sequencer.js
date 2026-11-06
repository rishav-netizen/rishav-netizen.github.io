const TRACKS = ['kick', 'rim', 'hat'];
const STEP_COUNT = 16;

export class Sequencer {
  constructor(audio, { bpm = 128, onStep, onStateChange } = {}) {
    this.audio = audio;
    this.bpm = bpm;
    this.onStep = onStep;
    this.onStateChange = onStateChange;
    this.stepDuration = 60 / bpm / 4;
    // Pocket swing factor (delays odd 16th notes slightly for a human head-nodding groove)
    this.swing = 0.17;
    // Default pattern: Syncopated Neo-Soul / Funk Pocket (with ghost snares & open hi-hat)
    this.pattern = {
      kick: [1, 0, 0, 1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 0, 0],
      rim:  [0, 0, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1],
      hat:  [1, 0, 1, 1, 1, 0, 1, 0, 1, 0, 1, 1, 1, 0, 1, 0],
    };
    this.trackMute = { kick: false, rim: false, hat: false };
    this.trackSolo = { kick: false, rim: false, hat: false };
    this.playing = false;
    this.currentStep = -1;
    this.stepIndex = 0;
    this.nextStepTime = 0;
    this.scheduler = null;
    this.lastClockTime = 0;
    this.wasAudioRunning = false;
    this.visualTimers = new Set();
  }

  get isPlaying() {
    return this.playing;
  }

  getPattern() {
    return this.pattern;
  }

  setBpm(bpm) {
    this.bpm = Math.min(Math.max(Math.round(bpm), 60), 220);
    this.stepDuration = 60 / this.bpm / 4;
    return this.bpm;
  }

  toggleTrackMute(track) {
    if (this.trackMute[track] !== undefined) {
      this.trackMute[track] = !this.trackMute[track];
    }
    return this.trackMute[track];
  }

  toggleTrackSolo(track) {
    if (this.trackSolo[track] !== undefined) {
      this.trackSolo[track] = !this.trackSolo[track];
    }
    return this.trackSolo[track];
  }

  setPreset(name) {
    if (name === 'pocket' || name === 'groovy') {
      // Laid-back 98 BPM Neo-Soul / Funk Pocket with ghost notes & syncopated kick
      this.pattern = {
        kick: [1, 0, 0, 1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 0, 0],
        rim:  [0, 0, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1],
        hat:  [1, 0, 1, 1, 1, 0, 1, 0, 1, 0, 1, 1, 1, 0, 1, 0],
      };
      this.swing = 0.18;
      this.setBpm(98);
    } else if (name === 'polyrhythm' || name === '7/8' || name === 'cadence') {
      this.pattern = {
        kick: [1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 0],
        rim:  [0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0],
        hat:  [1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1],
      };
      this.swing = 0.08;
      this.setBpm(116);
    } else if (name === 'polyphia' || name === 'playing-god') {
      // Syncopated Polyphia "Playing God" pocket (108 BPM laid-back bounce)
      this.pattern = {
        kick: [1, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0],
        rim:  [0, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1],
        hat:  [1, 1, 1, 0, 1, 1, 0, 1, 1, 1, 1, 0, 1, 0, 1, 1],
      };
      this.swing = 0.12;
      this.setBpm(108);
    } else if (name === 'porcaro' || name === 'beat-it') {
      // Jeff Porcaro half-time shuffle / rock pocket (104 BPM)
      this.pattern = {
        kick: [1, 0, 0, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0, 0, 1, 0],
        rim:  [0, 0, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1],
        hat:  [1, 0, 1, 1, 1, 0, 1, 0, 1, 0, 1, 1, 1, 0, 1, 1],
      };
      this.swing = 0.16;
      this.setBpm(104);
    } else if (name === 'techno' || name === 'four' || name === '128') {
      this.pattern = {
        kick: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
        rim:  [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
        hat:  [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0],
      };
      this.swing = 0.05;
      this.setBpm(112);
    } else if (name === 'funk' || name === 'breakbeat') {
      this.pattern = {
        kick: [1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 0, 1, 0, 0],
        rim:  [0, 0, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1],
        hat:  [1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0],
      };
      this.swing = 0.18;
      this.setBpm(102);
    } else if (name === 'clear') {
      this.pattern = {
        kick: Array(STEP_COUNT).fill(0),
        rim:  Array(STEP_COUNT).fill(0),
        hat:  Array(STEP_COUNT).fill(0),
      };
    }
    return this.pattern;
  }

  async toggle() {
    if (this.playing) this.stop();
    else await this.start();
  }

  async start() {
    if (this.playing) return;
    this.playing = true;
    this.stepIndex = 0;
    this.currentStep = -1;

    if (this.audio) {
      this.audio.unlock();
      void this.audio.start();
    }

    const ctx = this.audio?.context;
    const isAudioRunning = Boolean(ctx && ctx.state === 'running' && ctx.currentTime > 0);
    this.wasAudioRunning = isAudioRunning;
    this.nextStepTime = isAudioRunning ? ctx.currentTime + 0.005 : 0;
    this.lastClockTime = performance.now() - this.stepDuration * 1000;

    this.onStateChange?.(true);
    this.scheduleAhead();
    this.scheduler = window.setInterval(() => this.scheduleAhead(), 25);
  }

  stop() {
    this.playing = false;
    if (this.scheduler) window.clearInterval(this.scheduler);
    this.scheduler = null;
    this.visualTimers.forEach((timer) => window.clearTimeout(timer));
    this.visualTimers.clear();
    this.currentStep = -1;
    this.wasAudioRunning = false;
    this.onStep?.(-1, []);
    this.onStateChange?.(false);
  }

  setStep(track, step, enabled = !this.pattern[track][step]) {
    if (!TRACKS.includes(track) || step < 0 || step >= STEP_COUNT) return;
    this.pattern[track][step] = enabled ? 1 : 0;
    return this.pattern[track][step];
  }

  scheduleAhead() {
    if (!this.playing) return;

    const ctx = this.audio?.context;
    const isAudioRunning = Boolean(ctx && ctx.state === 'running' && ctx.currentTime > 0);

    if (isAudioRunning) {
      if (!this.wasAudioRunning) {
        const elapsedSinceLast = (performance.now() - this.lastClockTime) / 1000;
        const remaining = Math.max(0.005, this.stepDuration - elapsedSinceLast);
        this.nextStepTime = ctx.currentTime + remaining;
        this.wasAudioRunning = true;
      }
      const scheduleUntil = ctx.currentTime + 0.1;
      if (this.nextStepTime < ctx.currentTime - 0.05) {
        this.nextStepTime = ctx.currentTime + 0.005;
      }
      while (this.nextStepTime < scheduleUntil) {
        const step = this.stepIndex % STEP_COUNT;
        this.stepIndex += 1;
        this.scheduleStep(step, this.nextStepTime);
        this.nextStepTime += this.stepDuration;
        this.lastClockTime = performance.now();
      }
    } else {
      this.wasAudioRunning = false;
      const now = performance.now();
      const elapsed = (now - this.lastClockTime) / 1000;
      if (elapsed >= this.stepDuration) {
        this.lastClockTime = now;
        const step = this.stepIndex % STEP_COUNT;
        this.stepIndex += 1;
        this.scheduleStep(step, 0);
      }
    }
  }

  scheduleStep(step, time) {
    const currentStep = ((step % STEP_COUNT) + STEP_COUNT) % STEP_COUNT;
    this.currentStep = currentStep;

    const anySolo = Object.values(this.trackSolo).some(Boolean);
    const activeTracks = TRACKS.filter((track) => {
      if (!this.pattern[track][currentStep]) return false;
      if (this.trackMute[track]) return false;
      if (anySolo && !this.trackSolo[track]) return false;
      return true;
    });

    // Apply human pocket swing to odd 16th-note subdivisions
    const swingDelay = currentStep % 2 === 1 ? this.stepDuration * (this.swing || 0.15) : 0;
    const swungTime = time > 0 ? time + swingDelay : 0;

    // Ghost-note snare on off-beat steps (anything other than backbeats 4 and 12)
    const isBackbeatSnare = currentStep === 4 || currentStep === 12;
    // Open hi-hat bark on step 14 (just before the bar loops)
    const isOpenHat = currentStep === 14;
    const hatAccent = currentStep % 4 === 0 ? 0.56 : currentStep % 2 === 0 ? 0.42 : 0.28;

    const ctx = this.audio?.context;
    if (swungTime > 0 && ctx && ctx.state === 'running') {
      activeTracks.forEach((track) => {
        if (track === 'kick') {
          this.audio.schedule('kick', swungTime, currentStep === 0 ? 1.0 : 0.88);
        } else if (track === 'rim') {
          this.audio.schedule('rim', swungTime, 0.9, { ghost: !isBackbeatSnare });
        } else if (track === 'hat') {
          this.audio.schedule('hat', swungTime, isOpenHat ? 0.58 : hatAccent, { open: isOpenHat });
        }
      });
      if (!anySolo) {
        this.audio.scheduleGrooveAccompaniment?.(currentStep, swungTime);
      }
      const delay = Math.max(0, (swungTime - ctx.currentTime) * 1000);
      if (delay <= 8) {
        if (this.playing) this.onStep?.(currentStep, activeTracks);
      } else {
        const timer = window.setTimeout(() => {
          this.visualTimers.delete(timer);
          if (this.playing) this.onStep?.(currentStep, activeTracks);
        }, delay);
        this.visualTimers.add(timer);
      }
    } else {
      activeTracks.forEach((track) => {
        if (track === 'kick') {
          this.audio?.schedule('kick', 0, currentStep === 0 ? 1.0 : 0.88);
        } else if (track === 'rim') {
          this.audio?.schedule('rim', 0, 0.9, { ghost: !isBackbeatSnare });
        } else if (track === 'hat') {
          this.audio?.schedule('hat', 0, isOpenHat ? 0.58 : hatAccent, { open: isOpenHat });
        }
      });
      if (!anySolo) {
        this.audio?.scheduleGrooveAccompaniment?.(currentStep, 0);
      }
      if (this.playing) this.onStep?.(currentStep, activeTracks);
    }
  }
}

export { TRACKS, STEP_COUNT };
