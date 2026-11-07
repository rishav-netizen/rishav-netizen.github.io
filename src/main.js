import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { ProceduralAudio } from './audio.js';
import { AsciiBackground, HeroDrumKitStage } from './ascii-background.js';
import { LedMatrix } from './led-matrix.js';
import { Sequencer, TRACKS, STEP_COUNT } from './sequencer.js';
import { SpringPortrait } from './spring-portrait.js';
import { ThemeController } from './theme-controller.js';
import { CadenceTerminal } from './terminal.js';
import { initProjectPreviews } from './project-previews.js';
import { VenomSymbioteEffect } from './venom-button.js';
import { MarioRunnerTrack, ElevationPaceTrace } from './mario-runner.js';
import { CadenceArcade } from './game-mode.js';
import './style.css';

gsap.registerPlugin(ScrollTrigger);

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const audio = new ProceduralAudio();
let beatCount = 0;
let lenis = null;
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const readPreference = (key, fallback) => {
  try {
    const value = window.localStorage.getItem(key);
    return value === null ? fallback : value === 'true';
  } catch {
    return fallback;
  }
};
let soundEnabled = readPreference('rhythm-dev-sound', true);
let motionEnabled = readPreference('rhythm-dev-motion', !prefersReducedMotion);
let staticFrameDrawn = false;
let scrollState = { scroll: 0, velocity: 0, progress: 0 };
audio.enabled = soundEnabled;

function setBeatCount(amount = 1) {
  beatCount += amount;
  const counterEl = $('#beats-counter');
  if (counterEl) counterEl.textContent = String(beatCount);
}

function updateAge() {
  // Exact Birthdate: May 4, 2007 at 12:01 AM
  const birthDate = new Date('2007-05-04T00:01:00');
  const millisecondsPerYear = 365.2425 * 24 * 60 * 60 * 1000;
  const ageEl = $('#age-counter');
  if (ageEl) ageEl.textContent = ((Date.now() - birthDate.getTime()) / millisecondsPerYear).toFixed(9);
}

// Custom Magnetic Cursor Halo + Context-Aware Reticle Label
const cursorHalo = $('#cursor-halo');
const cursorHaloLabel = $('#cursor-halo-label');
const hudScrollDepth = $('#hud-scroll-depth');
const cursorState = { x: -100, y: -100, tx: -100, ty: -100, hovered: false, label: '' };

function resolveCursorLabel(target) {
  if (!(target instanceof Element)) return '';
  if (target.closest('#runner-track-canvas')) return 'SCRUB 10K RUN // CLICK JUMP';
  if (target.closest('#runner-elevation-canvas')) return 'SCRUB ELEVATION // 2,276M → 45M';
  if (target.closest('#hero-kit-canvas')) return 'STRIKE 3D KIT // ORBIT';
  if (target.closest('#ascii-canvas')) return 'BRUSH PORTRAIT // PHYSICS';
  if (target.closest('#canvas-preview-c-image-filters')) return 'SWEEP C99 KERNEL';
  if (target.closest('#canvas-preview-doppler-hil')) return 'CLICK // TOGGLE MACH';
  if (target.closest('#canvas-preview-karen-ai')) return '3D DISPATCH RADAR';
  if (target.closest('#canvas-preview-cpp-arduino')) return '115.2K UART SCOPE';
  if (target.closest('#canvas-preview-3d-snail')) return 'TILT 3D HELIX';
  if (target.closest('#led-canvas, .sequencer-cell')) return 'STEP SYNTH // 128 BPM';
  if (target.closest('#game-mode-btn, #warp-trigger')) return 'LAUNCH ARCADE // 176 SPM';
  if (target.closest('#hero-morph-btn')) return 'MORPH 3D SCULPTURE';
  if (target.closest('#hero-connect-btn')) return 'SYMBIOTE // DROP GROOVE';
  if (target.closest('#arcade-canvas')) return 'ARCADE STAGE // LIVE';
  if (target.closest('[data-venom-btn]')) return 'SYMBIOTE // CONNECT';
  if (target.closest('.kit-map-node')) return 'SELECT PROJECT NODE';
  return '';
}

window.addEventListener(
  'pointermove',
  (e) => {
    if (e.pointerType === 'touch') return;
    cursorState.tx = e.clientX;
    cursorState.ty = e.clientY;
    const interactive = e.target instanceof Element && Boolean(e.target.closest('a, button, input, canvas, .hw-card'));
    if (interactive !== cursorState.hovered) {
      cursorState.hovered = interactive;
      cursorHalo?.classList.toggle('is-Interactive', interactive);
    }
    const nextLabel = resolveCursorLabel(e.target);
    if (nextLabel !== cursorState.label) {
      cursorState.label = nextLabel;
      if (cursorHaloLabel) cursorHaloLabel.textContent = nextLabel;
      cursorHalo?.classList.toggle('has-label', Boolean(nextLabel));
    }
  },
  { passive: true }
);

function renderCursorHalo() {
  if (!cursorHalo || !motionEnabled) return;
  cursorState.x += (cursorState.tx - cursorState.x) * 0.22;
  cursorState.y += (cursorState.ty - cursorState.y) * 0.22;
  cursorHalo.style.transform = `translate3d(${cursorState.x.toFixed(1)}px, ${cursorState.y.toFixed(1)}px, 0)`;
}

const background = new AsciiBackground($('#bg-canvas'));
const marioRunner = new MarioRunnerTrack($('#runner-track-canvas'), {
  readoutEl: $('#runner-hud-readout'),
  onScrub: (ratio) => {
    unlockHeroRevealImmediately();
    const maxScroll = Math.max(document.documentElement.scrollHeight - window.innerHeight, 1);
    const targetY = ratio * maxScroll;
    if (lenis) lenis.scrollTo(targetY, { duration: 0.7 });
    else window.scrollTo({ top: targetY, behavior: 'smooth' });
  },
});
const elevationTrace = new ElevationPaceTrace($('#runner-elevation-canvas'));

function triggerDrum(type, { count = true, strength: strengthOverride } = {}) {
  setSoundEnabled(true);
  audio.unlock();
  audio.hit(type);
  if (count) setBeatCount();
  const strength = strengthOverride ?? (type === 'kick' ? 1.4 : type === 'rim' ? 1.1 : 0.75);
  background.shockwave(strength);
  heroKitStage?.triggerHit(type, strength);
  matrix.triggerShockwave(type === 'kick' ? 0.22 : type === 'rim' ? 0.55 : 0.8, strength);
  portrait.hit(type, strength);
  venomSymbiote?.pulse(strength);
  marioRunner?.triggerBeat(type, strength);
  if (runnerHudStripEl) {
    runnerHudStripEl.style.visibility = 'visible';
    runnerHudStripEl.style.opacity = '1';
    runnerHudStripEl.style.transform = 'translateX(-50%) translateY(0px)';
    runnerHudStripEl.style.pointerEvents = 'auto';
  }
}

const heroKitStage = new HeroDrumKitStage($('#hero-kit-canvas'), {
  onPieceClick: (drumType) => {
    triggerDrum(drumType);
  },
});

const matrix = new LedMatrix($('#led-canvas'), { onTrigger: (type) => triggerDrum(type) });
const portrait = new SpringPortrait($('#ascii-canvas'), { onTrigger: (type) => triggerDrum(type) });

function setAsciiPortraitMode(mode) {
  const activeMode = portrait.setMode(mode);
  $$('[data-ascii-mode]').forEach((btn) => {
    btn.classList.toggle('is-active', btn.dataset.asciiMode === activeMode);
  });
  $('#portrait-photo-toggle')?.classList.remove('active');
  const readout = $('#ascii-mode-readout');
  const labels = {
    spring: 'MODE: CURL SPRINGS',
    vortex: 'MODE: VORTEX SWIRL',
    strike: 'MODE: IMPULSE WAVE',
    star: 'MODE: CONSTELLATION',
  };
  if (readout) readout.textContent = labels[activeMode] || 'MODE: CONSTELLATION';
}

$$('[data-ascii-mode]').forEach((btn) => {
  btn.addEventListener('click', () => {
    setAsciiPortraitMode(btn.dataset.asciiMode);
    triggerDrum('hat', { count: false, strength: 0.5 });
  });
});

$('#portrait-photo-toggle')?.addEventListener('click', (e) => {
  const showingPhoto = portrait.togglePhotoView();
  e.currentTarget.classList.toggle('active', showingPhoto);
  e.currentTarget.textContent = showingPhoto ? '✦ ASCII Matrix' : '📷 Raw Photo';
  const readout = $('#ascii-mode-readout');
  if (readout) {
    readout.textContent = showingPhoto ? 'VIEW: CANDID PHOTO' : `MODE: ${portrait.mode.toUpperCase()}`;
  }
  triggerDrum('rim', { count: false, strength: 0.6 });
});

$$('[data-kit-target]').forEach((node) => {
  node.addEventListener('click', () => {
    const targetId = node.dataset.kitTarget;
    const sound = node.dataset.kitSound || 'kick';
    triggerDrum(sound);

    $$('[data-kit-target]').forEach((n) => n.classList.toggle('is-selected', n === node));
    $$('.drum-piece-pod').forEach((pod) => pod.classList.toggle('is-highlighted', pod.id === targetId));

    const targetEl = document.getElementById(targetId);
    if (targetEl) {
      scrollToElement(targetEl);
    }
  });
});

const TRACK_INFO = {
  kick: { name: 'KICK', spec: '155→46 HZ', tone: 'cyan' },
  rim:  { name: 'SNARE', spec: '260 HZ',    tone: 'white' },
  hat:  { name: 'HI-HAT', spec: '6.4 KHZ',  tone: 'violet' },
};

function updateSequencerGrid(sequencer) {
  $$('.sequencer-cell').forEach((cell) => {
    const track = cell.dataset.track;
    const step = Number(cell.dataset.step);
    const isOn = Boolean(sequencer.pattern[track]?.[step]);
    cell.classList.toggle('is-on', isOn);
    cell.setAttribute('aria-pressed', String(isOn));
  });

  $$('[data-mute-track]').forEach((btn) => {
    const track = btn.dataset.muteTrack;
    const isMuted = Boolean(sequencer.trackMute[track]);
    btn.classList.toggle('is-active', isMuted);
    btn.setAttribute('aria-pressed', String(isMuted));
  });

  $$('[data-solo-track]').forEach((btn) => {
    const track = btn.dataset.soloTrack;
    const isSoloed = Boolean(sequencer.trackSolo[track]);
    btn.classList.toggle('is-active', isSoloed);
    btn.setAttribute('aria-pressed', String(isSoloed));
  });
}

function buildSequencerGrid(sequencer) {
  const grid = $('#sequencer-track');
  if (!grid) return;
  grid.innerHTML = '';

  TRACKS.forEach((track) => {
    const info = TRACK_INFO[track] || { name: track.toUpperCase(), spec: '' };

    const lane = document.createElement('div');
    lane.className = `sequencer-lane sequencer-lane--${track}`;
    lane.dataset.trackLane = track;

    // Track Control Header
    const header = document.createElement('div');
    header.className = 'lane-header';

    const titleWrap = document.createElement('div');
    titleWrap.className = 'lane-title-wrap';

    const name = document.createElement('span');
    name.className = 'lane-name';
    name.textContent = info.name;

    const spec = document.createElement('span');
    spec.className = 'lane-spec';
    spec.textContent = info.spec;

    titleWrap.appendChild(name);
    titleWrap.appendChild(spec);

    const controls = document.createElement('div');
    controls.className = 'lane-controls';

    const muteBtn = document.createElement('button');
    muteBtn.type = 'button';
    muteBtn.className = 'lane-action-btn lane-action-btn--mute';
    muteBtn.dataset.muteTrack = track;
    muteBtn.textContent = 'M';
    muteBtn.title = `Mute ${info.name}`;
    muteBtn.addEventListener('pointerdown', (e) => e.preventDefault());
    muteBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      sequencer.toggleTrackMute(track);
      updateSequencerGrid(sequencer);
    });

    const soloBtn = document.createElement('button');
    soloBtn.type = 'button';
    soloBtn.className = 'lane-action-btn lane-action-btn--solo';
    soloBtn.dataset.soloTrack = track;
    soloBtn.textContent = 'S';
    soloBtn.title = `Solo ${info.name}`;
    soloBtn.addEventListener('pointerdown', (e) => e.preventDefault());
    soloBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      sequencer.toggleTrackSolo(track);
      updateSequencerGrid(sequencer);
    });

    controls.appendChild(muteBtn);
    controls.appendChild(soloBtn);

    header.appendChild(titleWrap);
    header.appendChild(controls);
    lane.appendChild(header);

    // 16 Step Cells
    const stepsRow = document.createElement('div');
    stepsRow.className = 'lane-steps-grid';

    for (let step = 0; step < STEP_COUNT; step += 1) {
      const button = document.createElement('button');
      button.className = `sequencer-cell sequencer-cell--${track}`;
      if (step % 4 === 0) button.classList.add('step-beat-start');
      button.type = 'button';
      button.dataset.track = track;
      button.dataset.step = String(step);
      button.setAttribute('role', 'gridcell');
      button.setAttribute('aria-label', `${info.name} step ${step + 1}`);

      button.addEventListener('pointerdown', (e) => {
        e.preventDefault();
      });

      button.addEventListener('click', (e) => {
        e.preventDefault();
        setSoundEnabled(true);
        audio.unlock();
        const isOn = sequencer.setStep(track, step);
        if (isOn) {
          audio.hit(track);
          matrix.triggerShockwave(track === 'kick' ? 0.22 : track === 'rim' ? 0.55 : 0.8, 1.0);
        }
        updateSequencerGrid(sequencer);
        matrix.setPattern(sequencer.getPattern());
      });

      stepsRow.appendChild(button);
    }

    lane.appendChild(stepsRow);
    grid.appendChild(lane);
  });

  updateSequencerGrid(sequencer);
}

function markSequencerStep(step) {
  $$('.sequencer-cell').forEach((cell) => cell.classList.toggle('is-current', Number(cell.dataset.step) === step));
  matrix.setActiveStep(step);
  const readout = $('#sequencer-step-readout');
  if (readout) readout.textContent = step < 0 ? 'STEP 00 / 16' : `STEP ${String(step + 1).padStart(2, '0')} / 16`;
}

function updateSequencerState(isPlaying) {
  const statusEl = $('#sequencer-status');
  const loopBtn = $('#loop-toggle');
  const playBtn = $('#player-play-btn');
  const grooveBtn = $('#groove-btn');
  const heroGrooveBtn = $('#hero-connect-btn');
  const heroGrooveLabel = $('#hero-groove-label');

  if (statusEl) statusEl.textContent = isPlaying ? 'RUNNING' : 'STOPPED';
  if (loopBtn) {
    loopBtn.textContent = isPlaying ? '⏸ PAUSE' : '▶ LOOP';
    loopBtn.classList.toggle('active', isPlaying);
    loopBtn.setAttribute('aria-pressed', String(isPlaying));
  }
  if (playBtn) playBtn.textContent = isPlaying ? '⏸' : '▶';
  if (grooveBtn) grooveBtn.classList.toggle('active', isPlaying);
  if (heroGrooveBtn) {
    heroGrooveBtn.classList.toggle('active', isPlaying);
    heroGrooveBtn.setAttribute('aria-pressed', String(isPlaying));
  }
  if (heroGrooveLabel) {
    heroGrooveLabel.textContent = isPlaying ? '⏸ GROOVE' : '🥁 GROOVE';
  }
  marioRunner?.setGrooveState(isPlaying);
  if (isPlaying && runnerHudStripEl) {
    runnerHudStripEl.style.visibility = 'visible';
    runnerHudStripEl.style.opacity = '1';
    runnerHudStripEl.style.transform = 'translateX(-50%) translateY(0px)';
    runnerHudStripEl.style.pointerEvents = 'auto';
  }
}

const sequencer = new Sequencer(audio, {
  bpm: 128,
  onStep: (step, tracks) => {
    markSequencerStep(step);
    if (step < 0) return;
    if (tracks.length) setBeatCount();
    if (tracks.includes('kick')) {
      background.shockwave(1.1);
      heroKitStage?.triggerHit('kick', 1.1);
      matrix.triggerShockwave(0.22, 1.25);
      portrait.hit('kick', 0.68);
      venomSymbiote?.pulse(1.15);
      marioRunner?.triggerBeat('kick', 0.95);
    }
    if (tracks.includes('rim')) {
      background.shockwave(0.78);
      heroKitStage?.triggerHit('rim', 0.85);
      matrix.triggerShockwave(0.55, 0.75);
      portrait.hit('rim', 0.4);
      venomSymbiote?.pulse(0.85);
      marioRunner?.triggerBeat('rim', 0.85);
    }
    if (tracks.includes('hat')) {
      background.shockwave(0.34);
      heroKitStage?.triggerHit('hat', 0.5);
      matrix.triggerShockwave(0.8, 0.32);
      venomSymbiote?.pulse(0.45);
      if (!tracks.includes('kick') && !tracks.includes('rim')) {
        marioRunner?.triggerBeat('hat', 0.55);
      }
    }
    if (tracks.length && runnerHudStripEl) {
      runnerHudStripEl.style.visibility = 'visible';
      runnerHudStripEl.style.opacity = '1';
      runnerHudStripEl.style.transform = 'translateX(-50%) translateY(0px)';
      runnerHudStripEl.style.pointerEvents = 'auto';
    }
  },
  onStateChange: updateSequencerState,
});

buildSequencerGrid(sequencer);
matrix.setPattern(sequencer.getPattern());

const themes = new ThemeController({
  button: $('#theme-btn'),
  menu: $('#theme-menu'),
  quickButtons: $$('[data-quick-theme]'),
  onChange: () => {
    if (soundEnabled) audio.hit('hat', { count: false, strength: 0.25 });
  },
});

function persistPreference(key, value) {
  try {
    window.localStorage.setItem(key, String(value));
  } catch {
    /* no-op */
  }
}

function updateSensoryControls() {
  const soundButton = $('#sound-btn');
  const motionButton = $('#motion-btn');
  const mobileSoundButton = $('#mobile-sound-btn');
  const mobileMotionButton = $('#mobile-motion-btn');

  soundButton?.classList.toggle('active', soundEnabled);
  soundButton?.setAttribute('aria-pressed', String(soundEnabled));
  soundButton?.setAttribute('aria-label', `Sound ${soundEnabled ? 'on' : 'off'}`);
  if (soundButton) soundButton.textContent = soundEnabled ? 'SND' : 'MUTE';

  motionButton?.classList.toggle('active', motionEnabled);
  motionButton?.setAttribute('aria-pressed', String(motionEnabled));
  motionButton?.setAttribute('aria-label', `Motion ${motionEnabled ? 'on' : 'off'}`);
  if (motionButton) motionButton.textContent = motionEnabled ? 'MOT' : 'STILL';

  if (mobileSoundButton) {
    mobileSoundButton.classList.toggle('active', soundEnabled);
    mobileSoundButton.textContent = soundEnabled ? 'SOUND: ON' : 'SOUND: MUTED';
  }
  if (mobileMotionButton) {
    mobileMotionButton.classList.toggle('active', motionEnabled);
    mobileMotionButton.textContent = motionEnabled ? 'MOTION: ON' : 'MOTION: STILL';
  }

  document.documentElement.dataset.motion = motionEnabled ? 'on' : 'off';
}

function setSoundEnabled(enabled) {
  soundEnabled = enabled;
  audio.enabled = enabled;
  persistPreference('rhythm-dev-sound', enabled);
  updateSensoryControls();
}

function setMotionEnabled(enabled) {
  motionEnabled = enabled;
  persistPreference('rhythm-dev-motion', enabled);
  staticFrameDrawn = false;
  ScrollTrigger.getAll().forEach((trigger) => (enabled ? trigger.enable() : trigger.disable(false)));
  if (!enabled) {
    gsap.set('#bg-canvas', { clearProps: 'transform' });
    gsap.set('.section-counter, [data-parallax-depth]', { clearProps: 'transform' });
    gsap.set('.hw-card, .terminal-chassis, .matrix-banner', {
      '--parallax-y': '0px',
      '--scroll-rx': '0deg',
      '--scroll-ry': '0deg',
      '--scroll-z': '0px',
    });
    if (navbarEl) {
      navbarEl.style.visibility = 'visible';
      navbarEl.style.opacity = '1';
      navbarEl.style.transform = 'none';
      navbarEl.style.pointerEvents = 'auto';
    }
    if (monumentalText) {
      monumentalText.style.visibility = 'visible';
      monumentalText.style.opacity = '1';
      monumentalText.style.transform = 'none';
      monumentalText.style.pointerEvents = 'auto';
    }
  } else {
    applyHeroKitProgress(getHeroScrollProgress());
  }
  resetCardTilt(enabled);
  if (enabled) lenis?.start();
  else lenis?.stop();
  if (enabled) ScrollTrigger.update();
  updateSensoryControls();
}

updateSensoryControls();
$('#sound-btn')?.addEventListener('click', () => setSoundEnabled(!soundEnabled));
$('#motion-btn')?.addEventListener('click', () => setMotionEnabled(!motionEnabled));
$('#mobile-sound-btn')?.addEventListener('click', () => setSoundEnabled(!soundEnabled));
$('#mobile-motion-btn')?.addEventListener('click', () => setMotionEnabled(!motionEnabled));

const mobileMenuButton = $('#mobile-menu-btn');
const primaryLinks = $('#primary-links');
function closeMobileMenu() {
  primaryLinks?.classList.remove('is-open');
  mobileMenuButton?.setAttribute('aria-expanded', 'false');
}
mobileMenuButton?.addEventListener('click', () => {
  const open = !primaryLinks?.classList.contains('is-open');
  primaryLinks?.classList.toggle('is-open', open);
  mobileMenuButton.setAttribute('aria-expanded', String(open));
});
primaryLinks?.querySelectorAll('a').forEach((link) => link.addEventListener('click', closeMobileMenu));

// Interactive Top-Bar Game Mode (Cadence Arcade Suite)
const arcade = new CadenceArcade({
  soundEngine: {
    playKick: () => {
      if (soundEnabled) {
        audio.unlock();
        audio.hit('kick', { count: false, strength: 0.85 });
      }
    },
    playRim: () => {
      if (soundEnabled) {
        audio.unlock();
        audio.hit('rim', { count: false, strength: 0.8 });
      }
    },
    playHat: () => {
      if (soundEnabled) {
        audio.unlock();
        audio.hit('hat', { count: false, strength: 0.5 });
      }
    },
  },
});

function openGameMode(mode) {
  if (terminalModalOpen) closeTerminalModal();
  closeMobileMenu();
  // Stop the background pocket groove so background beats never clash with Game Mode audio
  if (sequencer.isPlaying) {
    sequencer.stop();
  }
  if (mode) arcade.setMode(mode);
  arcade.open();
  lenis?.stop();
  document.body.style.overflow = 'hidden';
}

function closeGameMode() {
  if (!arcade.isOpen) return;
  arcade.close();
  document.body.style.overflow = '';
  if (motionEnabled) lenis?.start();
}

function toggleGameMode() {
  if (arcade.isOpen) closeGameMode();
  else openGameMode();
}

$('#game-mode-btn')?.addEventListener('click', () => {
  if (soundEnabled) audio.hit('kick', { count: false, strength: 0.65 });
  toggleGameMode();
});
$('#mobile-game-btn')?.addEventListener('click', () => {
  if (soundEnabled) audio.hit('kick', { count: false, strength: 0.65 });
  openGameMode();
});
$('#game-mode-close-btn')?.addEventListener('click', () => {
  if (soundEnabled) audio.hit('hat', { count: false, strength: 0.35 });
  closeGameMode();
});
$('#game-mode-backdrop')?.addEventListener('click', closeGameMode);

// Slide-Over Aerospace HUD Terminal Drawer (⌘K or ` or Floating Dock Pill)
const terminalSection = $('#terminal-section');
const terminalBackdrop = $('#terminal-backdrop');
const floatingTerminalBtn = $('#floating-terminal-btn');
let terminalModalOpen = false;

function openTerminalModal(cmdToRun) {
  terminalModalOpen = true;
  document.documentElement.dataset.terminalDrawer = 'open';
  terminalSection?.setAttribute('aria-hidden', 'false');
  floatingTerminalBtn?.setAttribute('aria-expanded', 'true');
  lenis?.stop();
  document.body.style.overflow = 'hidden';
  if (cmdToRun && terminal) {
    terminal.execute(cmdToRun);
    terminal.scrollBottom();
  }
  window.setTimeout(() => {
    $('#terminal-input')?.focus();
  }, 60);
}

function closeTerminalModal() {
  terminalModalOpen = false;
  delete document.documentElement.dataset.terminalDrawer;
  terminalSection?.setAttribute('aria-hidden', 'true');
  floatingTerminalBtn?.setAttribute('aria-expanded', 'false');
  document.body.style.overflow = '';
  if (motionEnabled) lenis?.start();
}

function toggleTerminalModal() {
  if (terminalModalOpen) closeTerminalModal();
  else openTerminalModal();
}

floatingTerminalBtn?.addEventListener('click', () => {
  if (soundEnabled) audio.hit('hat', { count: false, strength: 0.3 });
  toggleTerminalModal();
});
$('#terminal-close-btn')?.addEventListener('click', () => {
  if (soundEnabled) audio.hit('hat', { count: false, strength: 0.3 });
  closeTerminalModal();
});
terminalBackdrop?.addEventListener('click', closeTerminalModal);
terminalSection?.addEventListener('click', (e) => {
  if (e.target === terminalSection) {
    closeTerminalModal();
  }
});

// Isolate terminal scroll & touch gestures so background page never moves while shell is open
terminalSection?.addEventListener(
  'wheel',
  (e) => {
    e.stopPropagation();
  },
  { passive: true }
);

terminalSection?.addEventListener(
  'touchmove',
  (e) => {
    e.stopPropagation();
  },
  { passive: true }
);

$$('.term-deep-link').forEach((btn) => {
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (soundEnabled) audio.hit('hat', { count: false, strength: 0.35 });
    const cmd = btn.dataset.openCmd;
    openTerminalModal(cmd);
  });
});

function toggleSequencer() {
  setSoundEnabled(true);
  audio.unlock();
  void audio.start();
  sequencer.toggle();
}

const unlockAudio = () => {
  audio.unlock();
};
window.addEventListener('pointerdown', unlockAudio, { passive: true, capture: true });
window.addEventListener('touchstart', unlockAudio, { passive: true, capture: true });
window.addEventListener('keydown', unlockAudio, { passive: true, capture: true });
window.addEventListener('click', unlockAudio, { passive: true, capture: true });

const bpmDial = $('#bpm-dial');
const bpmReadout = $('#sequencer-bpm');
const bpmMoodBadge = $('#bpm-mood-badge');
const MIN_BPM = 60;
const MAX_BPM = 220;
const MIN_ANGLE = -135;
const MAX_ANGLE = 135;
let currentBpm = 128;

function getBpmMood(bpm) {
  if (bpm < 95) return 'DOWNTEMPO';
  if (bpm < 120) return 'MID-TEMPO';
  if (bpm <= 135) return bpm === 128 ? '128 BPM // LOCKED' : 'PULSE';
  if (bpm < 165) return 'HIGH DRIVE';
  if (bpm <= 185) return bpm === 176 ? '176 SPM // CADENCE' : 'TURNOVER';
  return 'SUPERSONIC';
}

function updateBpm(newBpm) {
  currentBpm = Math.min(Math.max(Math.round(newBpm), MIN_BPM), MAX_BPM);
  sequencer.setBpm(currentBpm);

  if (bpmReadout) bpmReadout.textContent = `${currentBpm} BPM`;
  if (bpmMoodBadge) bpmMoodBadge.textContent = getBpmMood(currentBpm);

  if (bpmDial) {
    const ratio = (currentBpm - MIN_BPM) / (MAX_BPM - MIN_BPM);
    const angle = MIN_ANGLE + ratio * (MAX_ANGLE - MIN_ANGLE);
    bpmDial.style.transform = `rotate(${angle.toFixed(1)}deg)`;
    bpmDial.setAttribute('aria-valuenow', String(currentBpm));
    bpmDial.setAttribute('aria-valuetext', `${currentBpm} BPM`);
  }

  const notches = $$('.amp-notch');
  const closestNotch = notches.reduce((closest, notch) => {
    const val = Number(notch.dataset.bpm);
    if (!closest) return notch;
    return Math.abs(val - currentBpm) < Math.abs(Number(closest.dataset.bpm) - currentBpm) ? notch : closest;
  }, null);

  notches.forEach((notch) => {
    const isActive = notch === closestNotch && Math.abs(Number(notch.dataset.bpm) - currentBpm) <= 5;
    notch.classList.toggle('is-active', isActive);
  });
}

updateBpm(128);

if (bpmDial) {
  let isDragging = false;
  let startY = 0;
  let startBpm = 128;

  bpmDial.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    audio.unlock();
    isDragging = true;
    startY = e.clientY;
    startBpm = currentBpm;
    bpmDial.classList.add('is-dragging');
    bpmDial.setPointerCapture(e.pointerId);
  });

  bpmDial.addEventListener('pointermove', (e) => {
    if (!isDragging) return;
    const deltaY = startY - e.clientY;
    const deltaBpm = Math.round(deltaY * 0.7);
    updateBpm(startBpm + deltaBpm);
  });

  const endDrag = (e) => {
    if (isDragging) {
      isDragging = false;
      bpmDial.classList.remove('is-dragging');
      try {
        bpmDial.releasePointerCapture(e.pointerId);
      } catch {}
    }
  };

  bpmDial.addEventListener('pointerup', endDrag);
  bpmDial.addEventListener('pointercancel', endDrag);

  bpmDial.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      const step = e.deltaY < 0 ? 1 : -1;
      updateBpm(currentBpm + step);
    },
    { passive: false }
  );

  bpmDial.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowUp' || e.key === 'ArrowRight') {
      e.preventDefault();
      updateBpm(currentBpm + 1);
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') {
      e.preventDefault();
      updateBpm(currentBpm - 1);
    } else if (e.key === 'PageUp') {
      e.preventDefault();
      updateBpm(currentBpm + 5);
    } else if (e.key === 'PageDown') {
      e.preventDefault();
      updateBpm(currentBpm - 5);
    } else if (e.key === 'Home') {
      e.preventDefault();
      updateBpm(MIN_BPM);
    } else if (e.key === 'End') {
      e.preventDefault();
      updateBpm(MAX_BPM);
    }
  });
}

$('#bpm-minus-btn')?.addEventListener('click', () => {
  audio.unlock();
  updateBpm(currentBpm - 2);
});
$('#bpm-plus-btn')?.addEventListener('click', () => {
  audio.unlock();
  updateBpm(currentBpm + 2);
});

$$('.amp-notch:not(.vol-notch)').forEach((notch) => {
  notch.addEventListener('click', () => {
    audio.unlock();
    updateBpm(Number(notch.dataset.bpm));
  });
});

let currentVolume = 0.85;
const volumeSlider = $('#volume-slider');
const volumeBadge = $('#volume-badge');

function updateVolume(val) {
  audio.unlock();
  currentVolume = Math.min(Math.max(Number(val) || 0, 0), 1);
  audio.setMasterVolume(currentVolume);
  const percent = Math.round(currentVolume * 100);
  if (volumeSlider) {
    volumeSlider.value = String(percent);
    volumeSlider.setAttribute('aria-valuenow', String(percent));
  }
  if (volumeBadge) {
    volumeBadge.textContent = percent === 0 ? 'MUTED' : percent >= 98 ? 'MAX GAIN' : `${percent}% VOL`;
  }
  $$('.vol-notch').forEach((notch) => {
    const notchVal = Number(notch.dataset.vol);
    notch.classList.toggle('is-active', Math.abs(notchVal - percent) <= 5);
  });
}

volumeSlider?.addEventListener('input', (e) => {
  updateVolume(Number(e.target.value) / 100);
});

$('#vol-minus-btn')?.addEventListener('click', () => {
  updateVolume(currentVolume - 0.1);
});

$('#vol-plus-btn')?.addEventListener('click', () => {
  updateVolume(currentVolume + 0.1);
});

$$('.vol-notch').forEach((notch) => {
  notch.addEventListener('click', () => {
    updateVolume(Number(notch.dataset.vol) / 100);
  });
});

updateVolume(0.85);

const preventSelection = (e) => e.preventDefault();
[
  $('#bpm-minus-btn'),
  $('#bpm-plus-btn'),
  $('#vol-minus-btn'),
  $('#vol-plus-btn'),
  $('#loop-toggle'),
  $('#player-play-btn'),
].forEach((el) => el?.addEventListener('pointerdown', preventSelection));

$$('.amp-notch, .vol-notch, [data-preset], [data-hit], [data-solo]').forEach((btn) => {
  btn.addEventListener('pointerdown', preventSelection);
});

$('#loop-toggle')?.addEventListener('click', toggleSequencer);
$('#player-play-btn')?.addEventListener('click', toggleSequencer);
$('#groove-btn')?.addEventListener('click', toggleSequencer);

$$('[data-preset]').forEach((btn) => {
  btn.addEventListener('click', () => {
    setSoundEnabled(true);
    audio.unlock();
    const preset = btn.dataset.preset;
    sequencer.setPreset(preset);
    updateSequencerGrid(sequencer);
    matrix.setPattern(sequencer.getPattern());
    updateBpm(sequencer.bpm);
    audio.hit('rim');
    matrix.triggerShockwave(0.55, 1.2);
  });
});
$('#portrait-pulse')?.addEventListener('click', () => {
  portrait.pulse(1.3);
  background.shockwave(1.15);
  setBeatCount();
});

$$('[data-hit]').forEach((button) => button.addEventListener('click', () => triggerDrum(button.dataset.hit)));
$$('[data-solo]').forEach((button) =>
  button.addEventListener('click', () => {
    const type = button.dataset.solo;
    triggerDrum(type, { count: false });
    matrix.triggerShockwave(type === 'kick' ? 0.22 : type === 'rim' ? 0.55 : 0.8, 1.25);
  })
);

const warpTrigger = $('#warp-trigger');
const warpStatus = $('#warp-status');
const projects = $('#projects');
const mainContent = $('main');
let warpHeld = false;
let warpBusy = false;
let warpStartedAt = 0;
let warpScrollDistance = 0;
const WARP_HOLD_MS = 140;
const WARP_SCROLL_THRESHOLD = 28;

function scrollToElement(target, onComplete = () => {}) {
  unlockHeroRevealImmediately();
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (lenis && !reducedMotion) {
    lenis.start();
    lenis.scrollTo(target, {
      offset: -88,
      duration: 1.15,
      easing: (time) => 1 - Math.pow(1 - time, 4),
      onComplete,
    });
    return;
  }
  target.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' });
  window.setTimeout(onComplete, reducedMotion ? 0 : 1050);
}

function armWarp() {
  if (warpBusy) return;
  warpHeld = true;
  warpStartedAt = performance.now();
  warpScrollDistance = 0;
  warpTrigger?.classList.add('is-armed');
  void audio.start();
}

function releaseWarp() {
  warpHeld = false;
  warpScrollDistance = 0;
  warpTrigger?.classList.remove('is-armed');
}

function registerWarpScroll(deltaY) {
  if (!warpHeld || deltaY <= 0) return;
  warpScrollDistance += deltaY;
  const heldLongEnough = performance.now() - warpStartedAt >= WARP_HOLD_MS;
  if (heldLongEnough && warpScrollDistance >= WARP_SCROLL_THRESHOLD) launchWarp();
}

function launchWarp() {
  if (warpBusy) return;
  warpBusy = true;
  releaseWarp();
  closeTerminalModal();
  document.documentElement.dataset.warp = 'takeoff';
  mainContent?.setAttribute('aria-busy', 'true');
  if (warpStatus) warpStatus.textContent = '3D Warp engaged. Gliding to Selected Works.';
  background.setWarp(1);
  void audio.warpSweep();
  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    delete document.documentElement.dataset.warp;
    background.setWarp(0);
    mainContent?.removeAttribute('aria-busy');
    if (warpStatus) warpStatus.textContent = 'Selected works are now in view.';
    warpBusy = false;
    projects?.focus({ preventScroll: true });
  };
  if (projects) scrollToElement(projects, finish);
  window.setTimeout(finish, 1300);
}

$('#hero-morph-btn')?.addEventListener('click', (e) => {
  e.preventDefault();
  const next = heroKitStage?.cycleStageMode?.();
  if (next) {
    e.currentTarget.textContent = next.label;
    triggerDrum(next.sound, { strength: 1.25 });
  }
});

$('#hero-connect-btn')?.addEventListener('click', (e) => {
  e.preventDefault();
  if (!sequencer.isPlaying) {
    sequencer.setPreset('pocket');
    updateSequencerGrid(sequencer);
    matrix.setPattern(sequencer.getPattern());
    updateBpm(sequencer.bpm);
  }
  toggleSequencer();
});

warpTrigger?.addEventListener('click', (e) => {
  e.preventDefault();
  if (soundEnabled) audio.hit('kick', { count: false, strength: 0.75 });
  openGameMode('runner');
});
window.addEventListener('blur', releaseWarp);
window.addEventListener(
  'wheel',
  (event) => {
    if (event.deltaY > Math.abs(event.deltaX)) registerWarpScroll(event.deltaY);
  },
  { passive: true }
);

window.addEventListener('keydown', (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault();
    if (arcade.isOpen) closeGameMode();
    toggleTerminalModal();
    return;
  }

  if (event.key === 'Escape') {
    closeMobileMenu();
    if (arcade.isOpen) closeGameMode();
    if (terminalModalOpen) closeTerminalModal();
    return;
  }

  if (arcade.isOpen) {
    arcade.handleKeyDown(event);
    return;
  }

  const target = event.target;
  const isInput =
    target instanceof HTMLElement &&
    (target.isContentEditable || target.matches('input, textarea, select') || Boolean(target.closest('input, textarea, select, [contenteditable="true"]')));
  if (isInput || event.repeat) return;

  if (event.key === '`' || event.key === '~') {
    event.preventDefault();
    toggleTerminalModal();
    return;
  }

  if (event.code === 'Space') {
    event.preventDefault();
    triggerDrum('kick');
  } else if (event.code === 'KeyJ') {
    event.preventDefault();
    triggerDrum('rim');
  } else if (event.code === 'KeyK') {
    event.preventDefault();
    triggerDrum('hat');
  }
});

window.addEventListener('keyup', (event) => {
  if (arcade.isOpen) {
    arcade.handleKeyUp(event);
  }
});

$$('[data-scroll-to]').forEach((link) =>
  link.addEventListener('click', (event) => {
    event.preventDefault();
    const target = document.getElementById(link.dataset.scrollTo);
    if (target) scrollToElement(target);
  })
);

const sectionLinks = $$('.nav-links a');
const morphSections = $$('[data-morph-stop]');
const sectionObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      sectionLinks.forEach((link) => link.classList.toggle('active', link.dataset.scrollTo === entry.target.id));
      const idx = morphSections.indexOf(entry.target);
      if (idx >= 0) background.setSection(idx);
    });
  },
  { rootMargin: '-20% 0px -65% 0px', threshold: 0 }
);
morphSections.forEach((section) => sectionObserver.observe(section));

try {
  lenis = new Lenis({ autoRaf: false, lerp: 0.09, smoothWheel: true });
  window.__lenis = lenis;
  lenis.on('scroll', ({ scroll, velocity, progress }) => {
    scrollState = { scroll, velocity, progress };
    background.setScroll(scrollState);
    marioRunner?.setScroll({ progress, velocity });
    if (hudScrollDepth) {
      const meters = String(Math.round(scroll)).padStart(4, '0');
      hudScrollDepth.textContent = `Z-DEPTH // ${meters}M · ${currentBpm} BPM`;
    }
    if (scroll > 12 && heroRevealTarget < 1) {
      unlockHeroRevealImmediately();
    }
    ScrollTrigger.update();
    applyHeroKitProgress(getHeroScrollProgress(scroll));
  });
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);
} catch {
  // Native scroll fallback
}

window.addEventListener(
  'scroll',
  () => {
    if (window.scrollY > 12 && heroRevealTarget < 1) {
      unlockHeroRevealImmediately();
    }
    if (!lenis) {
      const maxScroll = Math.max(document.documentElement.scrollHeight - window.innerHeight, 1);
      marioRunner?.setScroll({ progress: window.scrollY / maxScroll, velocity: 0 });
      applyHeroKitProgress(getHeroScrollProgress(window.scrollY));
    }
  },
  { passive: true }
);

const cardTiltStates = new Map();
let cardTiltFrame = 0;

function renderCardTilt() {
  let settling = false;
  cardTiltStates.forEach((state, card) => {
    state.currentX += (state.targetX - state.currentX) * 0.16;
    state.currentY += (state.targetY - state.currentY) * 0.16;
    card.style.setProperty('--tilt-x', `${state.currentX.toFixed(3)}deg`);
    card.style.setProperty('--tilt-y', `${state.currentY.toFixed(3)}deg`);
    settling ||=
      Math.abs(state.targetX - state.currentX) > 0.01 || Math.abs(state.targetY - state.currentY) > 0.01;
  });
  cardTiltFrame = settling ? window.requestAnimationFrame(renderCardTilt) : 0;
}

function requestCardTiltFrame() {
  if (!cardTiltFrame) cardTiltFrame = window.requestAnimationFrame(renderCardTilt);
}

function resetCardTilt(enabled = motionEnabled) {
  cardTiltStates.forEach((state, card) => {
    state.targetX = 0;
    state.targetY = 0;
    if (!enabled) {
      state.currentX = 0;
      state.currentY = 0;
      card.style.setProperty('--tilt-x', '0deg');
      card.style.setProperty('--tilt-y', '0deg');
    }
  });
  if (enabled) requestCardTiltFrame();
}

function initializeCardTilt() {
  $$('.hw-card:not(.matrix-banner)').forEach((card) => {
    if (cardTiltStates.has(card)) return;
    const state = { targetX: 0, targetY: 0, currentX: 0, currentY: 0 };
    cardTiltStates.set(card, state);
    card.addEventListener(
      'pointermove',
      (event) => {
        if (!motionEnabled) return;
        const rect = card.getBoundingClientRect();
        const x = (event.clientX - rect.left) / Math.max(rect.width, 1) - 0.5;
        const y = (event.clientY - rect.top) / Math.max(rect.height, 1) - 0.5;
        state.targetY = x * 7;
        state.targetX = -y * 7;
        card.style.setProperty('--glow-x', `${((x + 0.5) * 100).toFixed(1)}%`);
        card.style.setProperty('--glow-y', `${((y + 0.5) * 100).toFixed(1)}%`);
        requestCardTiltFrame();
      },
      { passive: true }
    );
    const reset = () => {
      state.targetX = 0;
      state.targetY = 0;
      requestCardTiltFrame();
    };
    card.addEventListener('pointerleave', reset, { passive: true });
    card.addEventListener('pointercancel', reset, { passive: true });
  });
  requestCardTiltFrame();
}

const monumentalText = $('#hero-monumental-text');
const heroScanlineEl = $('#hero-reveal-scanline');
const navbarEl = $('.navbar');
const runnerHudStripEl = $('#runner-hud-strip');
const heroCoordsEl = $('.hero-top-coordinates');
const heroFooterEl = $('.hero-minimal-footer');
const heroConnectBtn = $('#hero-connect-btn');
const floatingDockEl = $('.floating-dock');
const heroScrollCueEl = $('#hero-scroll-cue');
const HERO_CIPHER_GLYPHS = 'ΩΨΦΔΛΘΞΠΣ017689#%&*';

// Interactive 3D Per-Letter Magnetic & Scroll-Reveal Physics on #hero-name ("RISHAV" / "KUMAR")
const heroCharStates = [];
(function initHeroMagneticLetters() {
  const wordEls = $$('#hero-name .hero-word');
  if (!wordEls.length) return;
  let globalIdx = 0;
  wordEls.forEach((wordEl, lineIdx) => {
    const text = (wordEl.textContent || '').trim();
    wordEl.textContent = '';
    const len = text.length;
    [...text].forEach((ch, charIdx) => {
      const span = document.createElement('span');
      span.className = 'hero-char';
      span.dataset.char = ch;
      span.style.setProperty('--char-idx', String(charIdx));
      span.textContent = ch;
      wordEl.appendChild(span);
      heroCharStates.push({
        el: span,
        targetChar: ch,
        lineIdx,
        charIdx,
        globalIdx,
        normOffset: (charIdx - (len - 1) * 0.5) / Math.max(len * 0.5, 1),
        x: 0,
        y: 0,
        z: 0,
        rx: 0,
        ry: 0,
        glow: 0,
        tx: 0,
        ty: 0,
        tz: 0,
        trx: 0,
        try: 0,
        tglow: 0,
        revX: 0,
        revY: 0,
        revZ: 0,
        revRx: 0,
        revRy: 0,
        revScale: 1,
      });
      globalIdx += 1;
    });
  });
})();

let smoothScrollWarp = 0;
let stageTiltRx = 0;
let stageTiltRy = 0;
const heroMonumentalNameEl = $('#hero-name');

function renderKineticTypography() {
  // 1. Scroll-velocity chromatic warp on section headings
  const rawVelocity = lenis ? scrollState.velocity : 0;
  const targetWarp = Math.min(Math.max(rawVelocity / 42, -1), 1);
  smoothScrollWarp += (targetWarp - smoothScrollWarp) * 0.18;
  if (Math.abs(smoothScrollWarp) < 0.002) smoothScrollWarp = 0;
  document.documentElement.style.setProperty('--scroll-warp', smoothScrollWarp.toFixed(3));
  document.documentElement.style.setProperty('--scroll-warp-abs', Math.abs(smoothScrollWarp).toFixed(3));

  // 2. Whole-Monument 3D Parallax Tilt + Smooth Magnetic Wave on RISHAV / KUMAR
  if (!canvasVisibility.heroKit || heroRevealCurrent < 0.15) return;
  const px = cursorState.tx;
  const py = cursorState.ty;

  if (heroMonumentalNameEl) {
    let targetRx = 0;
    let targetRy = 0;
    if (px > 0 && py > 0) {
      const nx = (px / Math.max(window.innerWidth, 1) - 0.5) * 2;
      const ny = (py / Math.max(window.innerHeight, 1) - 0.5) * 2;
      targetRx = -ny * 5.5;
      targetRy = nx * 6.5;
    }
    stageTiltRx += (targetRx - stageTiltRx) * 0.12;
    stageTiltRy += (targetRy - stageTiltRy) * 0.12;
    heroMonumentalNameEl.style.setProperty('--stage-rx', `${stageTiltRx.toFixed(2)}deg`);
    heroMonumentalNameEl.style.setProperty('--stage-ry', `${stageTiltRy.toFixed(2)}deg`);
  }

  heroCharStates.forEach((st) => {
    if (px > 0 && py > 0) {
      const r = st.el.getBoundingClientRect();
      const cx = r.left + r.width * 0.5;
      const cy = r.top + r.height * 0.5;
      const dx = px - cx;
      const dy = py - cy;
      const dist = Math.hypot(dx, dy);
      const radius = 190;
      if (dist < radius) {
        const t = 1 - dist / radius;
        const inf = t * t * (3 - 2 * t);
        st.tx = (-dx / radius) * 5 * inf;
        st.ty = -13 * inf;
        st.tglow = inf;
      } else {
        st.tx = 0;
        st.ty = 0;
        st.tglow = 0;
      }
    } else {
      st.tx = 0;
      st.ty = 0;
      st.tglow = 0;
    }
    st.x += (st.tx - st.x) * 0.16;
    st.y += (st.ty - st.y) * 0.16;
    st.glow += (st.tglow - st.glow) * 0.16;
    const charScale = 1 + st.glow * 0.065;
    st.el.style.setProperty('--char-x', `${st.x.toFixed(1)}px`);
    st.el.style.setProperty('--char-y', `${st.y.toFixed(1)}px`);
    st.el.style.setProperty('--char-scale', charScale.toFixed(3));
  });
}

// In-place Hero Stage Reveal Lock:
// At scrollY = 0, scrolling first drives heroRevealTarget (0 -> 1) to reveal the monumental name
// letter-by-letter with 3D depth, cipher decoding, and laser scanline before scrolling the page down.
let heroRevealTarget = 0;
let heroRevealCurrent = 0;
let heroLockShockwaveFired = false;
const HERO_REVEAL_SCROLL_BUDGET = 680;

function unlockHeroRevealImmediately() {
  heroRevealTarget = 1;
  heroRevealCurrent = 1;
  applyHeroKitProgress(1);
  if (motionEnabled) lenis?.start();
}

function updateHeroScrollCue(revealProgress, scrollY) {
  if (!heroScrollCueEl) return;
  if (revealProgress > 0.04 || scrollY > 15) {
    heroScrollCueEl.style.opacity = '0';
    heroScrollCueEl.style.transform = 'translate(-50%, 12px)';
  } else {
    heroScrollCueEl.style.opacity = '1';
    heroScrollCueEl.style.transform = 'translate(-50%, 0)';
  }
}

function smoothstep(min, max, value) {
  const x = Math.min(Math.max((value - min) / Math.max(max - min, 0.0001), 0), 1);
  return x * x * (3 - 2 * x);
}

function getHeroScrollProgress(scrollYOverride) {
  const scrollY = typeof scrollYOverride === 'number' ? scrollYOverride : (lenis ? scrollState.scroll : window.scrollY);
  if (scrollY > 12) return 1;
  return heroRevealCurrent;
}

function applyHeroKitProgress(progress) {
  const p = Math.min(Math.max(progress, 0), 1);
  heroKitStage?.setProgress(p);
  const currentScrollY = lenis ? scrollState.scroll : window.scrollY;
  updateHeroScrollCue(p, currentScrollY);

  // Stage 1 (p: 0.02 -> 0.68): Staggered 3D Per-Character Kinetic Assembly + Cipher Decode + Laser Scanline
  const nameT = smoothstep(0.01, 0.68, p);
  const totalChars = Math.max(heroCharStates.length, 1);

  if (monumentalText) {
    monumentalText.style.visibility = nameT > 0.002 ? 'visible' : 'hidden';
    monumentalText.style.opacity = Math.min(1, nameT * 1.35).toFixed(3);
    monumentalText.style.pointerEvents = 'none';
    monumentalText.style.transform = 'none';
    monumentalText.style.filter = 'none';

    heroCharStates.forEach((st, idx) => {
      const charStart = 0.02 + (idx / totalChars) * 0.36;
      const charEnd = charStart + 0.28;
      const ct = smoothstep(charStart, charEnd, p);
      const inv = 1 - ct;

      const dirY = st.lineIdx === 0 ? -1 : 1;
      const revX = st.normOffset * 115 * inv;
      const revY = dirY * 72 * inv;
      const revZ = -280 * inv;
      const revRx = dirY * 82 * inv;
      const revRy = st.normOffset * -54 * inv;
      const revScale = 0.38 + ct * 0.62;

      st.el.style.setProperty('--char-alpha', Math.min(1, ct * 1.4).toFixed(3));
      st.el.style.setProperty('--reveal-x', `${revX.toFixed(1)}px`);
      st.el.style.setProperty('--reveal-y', `${revY.toFixed(1)}px`);
      st.el.style.setProperty('--reveal-z', `${revZ.toFixed(1)}px`);
      st.el.style.setProperty('--reveal-rx', `${revRx.toFixed(1)}deg`);
      st.el.style.setProperty('--reveal-ry', `${revRy.toFixed(1)}deg`);
      st.el.style.setProperty('--reveal-scale', revScale.toFixed(3));

      if (ct > 0.08 && ct < 0.84) {
        const glyphIdx = Math.floor(p * 48 + idx * 7) % HERO_CIPHER_GLYPHS.length;
        const nextGlyph = HERO_CIPHER_GLYPHS[glyphIdx];
        if (st.el.textContent !== nextGlyph) st.el.textContent = nextGlyph;
        st.el.classList.add('is-decoding');
      } else {
        if (st.el.textContent !== st.targetChar) st.el.textContent = st.targetChar;
        st.el.classList.remove('is-decoding');
      }
    });

    if (heroScanlineEl) {
      const scanActive = p > 0.03 && p < 0.68;
      const scanPos = smoothstep(0.03, 0.66, p) * 104;
      const scanAlpha = scanActive ? Math.sin(smoothstep(0.03, 0.66, p) * Math.PI) : 0;
      heroScanlineEl.style.top = `${scanPos.toFixed(1)}%`;
      heroScanlineEl.style.opacity = scanAlpha.toFixed(3);
      heroScanlineEl.style.transform = `scaleX(${(0.35 + scanAlpha * 0.65).toFixed(3)})`;
    }

    if (p >= 0.64 && !heroLockShockwaveFired) {
      heroLockShockwaveFired = true;
      background.shockwave(1.35);
      heroKitStage?.triggerHit('kick', 1.25);
    } else if (p < 0.35) {
      heroLockShockwaveFired = false;
    }

    const kicker = monumentalText.querySelector('.monumental-greek-kicker');
    if (kicker) {
      const kickerT = smoothstep(0.35, 0.68, p);
      kicker.style.transform = `translate3d(0, ${((1 - kickerT) * -18).toFixed(1)}px, 0)`;
      kicker.style.opacity = kickerT.toFixed(2);
    }
  }

  // Stage 2 (p: 0.58 -> 0.94): Reveal fixed navbar, coordinates, hero CTAs, and floating dock.
  const navT = smoothstep(0.58, 0.94, p);
  const isInteractive = navT > 0.25;

  if (navbarEl) {
    const navY = (1 - navT) * -28;
    navbarEl.style.visibility = navT > 0.005 ? 'visible' : 'hidden';
    navbarEl.style.opacity = navT.toFixed(3);
    navbarEl.style.transform = `translateY(${navY.toFixed(1)}px)`;
    navbarEl.style.pointerEvents = isInteractive ? 'auto' : 'none';
  }

  if (runnerHudStripEl) {
    const beatActive = Boolean(marioRunner?.isBeatActive?.());
    const effectiveT = beatActive ? 1 : navT;
    const stripY = (1 - effectiveT) * 32;
    runnerHudStripEl.style.visibility = effectiveT > 0.005 ? 'visible' : 'hidden';
    runnerHudStripEl.style.opacity = effectiveT.toFixed(3);
    runnerHudStripEl.style.transform = `translateX(-50%) translateY(${stripY.toFixed(1)}px)`;
    runnerHudStripEl.style.pointerEvents = isInteractive || beatActive ? 'auto' : 'none';
  }

  if (heroCoordsEl) {
    heroCoordsEl.style.visibility = navT > 0.005 ? 'visible' : 'hidden';
    heroCoordsEl.style.opacity = navT.toFixed(3);
    heroCoordsEl.style.transform = `translateY(${((1 - navT) * 14).toFixed(1)}px)`;
  }

  if (heroFooterEl) {
    heroFooterEl.style.visibility = navT > 0.005 ? 'visible' : 'hidden';
    heroFooterEl.style.opacity = navT.toFixed(3);
    heroFooterEl.style.transform = `translateY(${((1 - navT) * 14).toFixed(1)}px)`;
    heroFooterEl.style.pointerEvents = navT > 0.1 ? 'auto' : 'none';
  }

  if (floatingDockEl) {
    floatingDockEl.style.visibility = navT > 0.005 ? 'visible' : 'hidden';
    floatingDockEl.style.opacity = navT.toFixed(3);
    floatingDockEl.style.pointerEvents = isInteractive ? 'auto' : 'none';
  }
}

// Intercept wheel & touch scroll at the top of the page (scrollY <= 4) so scrolling
// FIRST completes the Hero Name & Navbar reveal in place before scrolling the page down!
window.addEventListener(
  'wheel',
  (event) => {
    if (document.documentElement.dataset.soundcheck === 'pending' || terminalModalOpen || arcade.isOpen || !motionEnabled) return;
    const scrollY = lenis ? scrollState.scroll : window.scrollY;

    if (event.deltaY > 0 && scrollY <= 6 && heroRevealCurrent < 0.985) {
      event.preventDefault();
      event.stopImmediatePropagation();
      lenis?.stop();
      const step = Math.min(Math.max(event.deltaY, 14), 95) / HERO_REVEAL_SCROLL_BUDGET;
      heroRevealTarget = Math.min(1, heroRevealTarget + step);
      return;
    }

    if (event.deltaY < 0 && scrollY <= 2 && heroRevealTarget > 0) {
      event.preventDefault();
      event.stopImmediatePropagation();
      lenis?.stop();
      const step = Math.min(Math.max(Math.abs(event.deltaY), 14), 95) / HERO_REVEAL_SCROLL_BUDGET;
      heroRevealTarget = Math.max(0, heroRevealTarget - step);
    }
  },
  { passive: false, capture: true }
);

let touchStartY = 0;
window.addEventListener(
  'touchstart',
  (event) => {
    if (event.touches.length === 1) {
      touchStartY = event.touches[0].clientY;
    }
  },
  { passive: true, capture: true }
);

window.addEventListener(
  'touchmove',
  (event) => {
    if (document.documentElement.dataset.soundcheck === 'pending' || terminalModalOpen || arcade.isOpen || !motionEnabled) return;
    if (event.touches.length !== 1) return;
    const currentY = event.touches[0].clientY;
    const deltaY = touchStartY - currentY;
    touchStartY = currentY;
    const scrollY = lenis ? scrollState.scroll : window.scrollY;

    if (deltaY > 0 && scrollY <= 6 && heroRevealCurrent < 0.985) {
      event.preventDefault();
      event.stopImmediatePropagation();
      lenis?.stop();
      heroRevealTarget = Math.min(1, heroRevealTarget + (deltaY * 1.6) / HERO_REVEAL_SCROLL_BUDGET);
    } else if (deltaY < 0 && scrollY <= 2 && heroRevealTarget > 0) {
      event.preventDefault();
      event.stopImmediatePropagation();
      lenis?.stop();
      heroRevealTarget = Math.max(0, heroRevealTarget + (deltaY * 1.6) / HERO_REVEAL_SCROLL_BUDGET);
    }
  },
  { passive: false, capture: true }
);

function initializeScrollEffects() {
  // 1. Differential 3D parallax on the fixed canvas
  gsap.to('#bg-canvas', {
    yPercent: -18,
    scale: 1.04,
    ease: 'none',
    scrollTrigger: {
      trigger: document.body,
      start: 'top top',
      end: 'bottom bottom',
      scrub: true,
      invalidateOnRefresh: true,
    },
  });

  // 2. Hero ScrollTrigger observer
  ScrollTrigger.create({
    trigger: '#hero-scroll-track',
    start: 'top top',
    end: 'bottom top',
    scrub: true,
    onUpdate: (self) => {
      if (self.progress > 0.05 && heroRevealTarget < 1) {
        unlockHeroRevealImmediately();
      }
    },
  });

  // 3. Multi-Layer 3D Depth Parallax
  gsap.utils.toArray('[data-parallax-depth]').forEach((layer) => {
    if (layer.id === 'hero-monumental-text') return;
    const depth = parseFloat(layer.dataset.parallaxDepth || '0.15');
    gsap.fromTo(
      layer,
      { y: depth * -75 },
      {
        y: depth * 85,
        ease: 'none',
        scrollTrigger: {
          trigger: layer.closest('.scene-3d') || layer,
          start: 'top bottom',
          end: 'bottom top',
          scrub: 0.75,
          invalidateOnRefresh: true,
        },
      }
    );
  });

  // 4. Section Counters 3D Float
  gsap.utils.toArray('.section-counter').forEach((counter, i) => {
    gsap.fromTo(
      counter,
      { y: i % 2 === 0 ? 35 : -35 },
      {
        y: i % 2 === 0 ? -45 : 45,
        ease: 'none',
        scrollTrigger: {
          trigger: counter.closest('.section-block') || counter,
          start: 'top bottom',
          end: 'bottom top',
          scrub: true,
          invalidateOnRefresh: true,
        },
      }
    );
  });

  // 5. 3D Spatial Card Scroll Entrances
  gsap.utils.toArray('.hw-card:not(.matrix-banner)').forEach((card, index) => {
    const mode = card.dataset.scroll3d || (index % 2 === 0 ? 'left' : 'right');
    const startRy = mode === 'left' ? -6 : mode === 'right' ? 6 : 0;
    const dir = index % 2 === 0 ? 1 : -1;

    gsap.fromTo(
      card,
      {
        '--parallax-y': `${44 + (index % 3) * 12}px`,
        '--scroll-rx': '8deg',
        '--scroll-ry': `${startRy}deg`,
        '--scroll-z': '-42px',
      },
      {
        '--parallax-y': `${-dir * 14}px`,
        '--scroll-rx': '0deg',
        '--scroll-ry': '0deg',
        '--scroll-z': '0px',
        ease: 'power2.out',
        scrollTrigger: {
          trigger: card,
          start: 'top 96%',
          end: 'center 52%',
          scrub: 0.65,
          invalidateOnRefresh: true,
        },
      }
    );
  });

  initializeCardTilt();
  initProjectPreviews({ audio });

  gsap.utils.toArray('.timeline-row').forEach((row, index) => {
    const rail = row.querySelector('.elevation-bar span');
    if (rail) {
      gsap.fromTo(
        rail,
        { scaleY: 0.55, y: 12 },
        {
          scaleY: 1 + index * 0.08,
          y: 0,
          ease: 'none',
          scrollTrigger: { trigger: row, start: 'top 92%', end: 'bottom 30%', scrub: 0.7 },
        }
      );
    }
  });

  gsap.utils.toArray('.waveform').forEach((waveform, index) => {
    gsap.fromTo(
      waveform,
      { scaleX: 0.84, y: 8 },
      {
        scaleX: 1.06 + (index % 2) * 0.04,
        y: 0,
        ease: 'sine.inOut',
        scrollTrigger: { trigger: waveform, start: 'top 94%', end: 'bottom 38%', scrub: 0.8 },
      }
    );
  });

  ScrollTrigger.refresh();
  if (!motionEnabled) ScrollTrigger.getAll().forEach((trigger) => trigger.disable(false));
}

applyHeroKitProgress(0);
initializeScrollEffects();

const terminal = new CadenceTerminal({
  container: $('#terminal-body'),
  input: $('#terminal-input'),
  form: $('#terminal-form'),
  audio,
  sequencer,
  updateBpm,
  launchWarp,
  setTheme: (themeName) => themes.apply(themeName),
  onDrum: triggerDrum,
  onGlobeAction: (mode) => background.pulseGlobe(mode),
  onAsciiMode: (mode) => setAsciiPortraitMode(mode),
  onOpenGame: (mode) => openGameMode(mode),
  onCloseDrawer: closeTerminalModal,
});
void terminal;

const soundcheckPreloader = $('#soundcheck-preloader');
const soundcheckKey = 'cadence-soundcheck-v1';
const hasSoundcheck = (() => {
  try {
    return sessionStorage.getItem(soundcheckKey) === 'complete';
  } catch {
    return false;
  }
})();

function setSoundcheckLine(index, complete) {
  const line = $(`#soundcheck-line-${index}`);
  if (!line) return;
  line.classList.toggle('is-complete', complete);
  const status = line.querySelector('b');
  if (status) status.textContent = complete ? '[OK]' : '[...]';
}

function setSoundcheckFinalState() {
  document.documentElement.dataset.soundcheck = 'complete';
  soundcheckPreloader?.remove();
  document.body.style.overflow = '';
  if (mainContent) {
    mainContent.inert = false;
    mainContent.removeAttribute('inert');
  }
  gsap.set('.ascii-wrap, .matrix-banner', {
    clearProps: 'all',
    autoAlpha: 1,
    x: 0,
    y: 0,
  });
  if (window.scrollY > 12 || !motionEnabled) {
    unlockHeroRevealImmediately();
  } else {
    lenis?.stop();
    applyHeroKitProgress(heroRevealCurrent);
  }
}

function revealStage() {
  try {
    sessionStorage.setItem(soundcheckKey, 'complete');
  } catch {}
  setSoundcheckFinalState();
}

// ---------------------------------------------------------------------------
// Cinematic Name-Reveal Preloader
// ---------------------------------------------------------------------------
const SCRAMBLE_GLYPHS = 'ΩΨΦΔΛΘΞΠΣΥabcdefghijklmnopqrstuvwxyz0123456789#@!?%&';
const NAME_FIRST = 'RISHAV';
const NAME_LAST  = 'KUMAR';

/** Build letter <span> elements for one word and inject into container */
function buildNameRow(containerId, word) {
  const container = document.getElementById(containerId);
  if (!container) return [];
  container.innerHTML = '';
  return [...word].map((letter) => {
    const span = document.createElement('span');
    span.className = 'sc-char';
    span.textContent = letter === ' ' ? '\u00A0' : letter;
    if (letter === ' ') span.style.width = '0.28em';
    container.appendChild(span);
    return { span, target: letter };
  });
}

/** Scramble-then-resolve a single character span */
function scrambleChar(span, targetLetter, duration, onDone) {
  const startTime = performance.now();
  span.classList.add('is-scrambling');
  let raf;
  function tick(now) {
    const elapsed = now - startTime;
    const t = Math.min(elapsed / duration, 1);
    if (t < 0.85) {
      // Random glyph phase
      span.textContent = SCRAMBLE_GLYPHS[Math.floor(Math.random() * SCRAMBLE_GLYPHS.length)];
      raf = requestAnimationFrame(tick);
    } else {
      // Snap to real letter
      span.textContent = targetLetter;
      span.classList.remove('is-scrambling');
      span.classList.add('is-solved');
      onDone?.();
    }
  }
  raf = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(raf);
}

async function runSoundcheck() {
  if (!soundcheckPreloader || hasSoundcheck) {
    document.documentElement.dataset.soundcheck = 'skip';
    background.explode?.(1.5);
    revealStage();
    return;
  }

  // Lock scroll immediately
  document.body.style.overflow = 'hidden';
  if (mainContent) {
    mainContent.inert = false;
    mainContent.removeAttribute('inert');
  }
  lenis?.stop();
  gsap.set('.navbar', { autoAlpha: 0, y: -28, pointerEvents: 'none' });
  gsap.set('.hero-top-coordinates, .hero-minimal-footer, .floating-dock', { autoAlpha: 0, y: 20 });

  // Wait for portrait asset or max 450ms
  await Promise.race([portrait.ready, new Promise((resolve) => window.setTimeout(resolve, 450))]);

  // Build character spans
  const firstChars = buildNameRow('sc-name-first', NAME_FIRST);
  const lastChars  = buildNameRow('sc-name-last',  NAME_LAST);
  const allChars   = [...firstChars, ...lastChars];

  // Add the horizontal sweep line
  const sweepLine = document.createElement('div');
  sweepLine.className = 'sc-sweep-line';
  soundcheckPreloader.appendChild(sweepLine);

  const separator = $('.sc-name-separator');

  // Phase 1: Fade in chars (staggered, still showing scrambled glyphs)
  const STAGGER_MS   = 52;   // gap between each letter appearing
  const SCRAMBLE_MS  = 340;  // how long each char scrambles before resolving
  const HOLD_MS      = 320;  // pause after all chars resolve before exit

  // Fade each char in (opacity + y) before scrambling
  allChars.forEach(({ span }, i) => {
    gsap.to(span, {
      opacity: 1,
      y: 0,
      duration: 0.28,
      delay: i * (STAGGER_MS / 1000),
      ease: 'power2.out',
    });
  });

  // Progress bar counter runs in parallel
  const totalFadeIn  = allChars.length * STAGGER_MS;
  const totalScramble = SCRAMBLE_MS;
  const totalDiag    = totalFadeIn + totalScramble;

  const progress = { value: 0 };
  gsap.to(progress, {
    value: 100,
    duration: (totalDiag + HOLD_MS) / 1000,
    ease: 'none',
    onUpdate: () => {
      const v = Math.round(progress.value);
      const progressEl = $('#soundcheck-progress');
      const meterEl    = $('#soundcheck-meter-fill');
      const statusEl   = $('#soundcheck-status');
      if (progressEl) progressEl.textContent = String(v).padStart(2, '0');
      if (meterEl)    meterEl.style.width = `${v}%`;
      if (statusEl) {
        statusEl.textContent =
          v < 30  ? '> CALIBRATING 2,200-NODE POINT CLOUD'
          : v < 60 ? '> ASSEMBLING NAME HOLOGRAM'
          : v < 85 ? '> LOCKING 3D DEPTH FIELD'
          :          '> OPENING STAGE';
      }
      setSoundcheckLine(1, v >= 22);
      setSoundcheckLine(2, v >= 44);
      setSoundcheckLine(3, v >= 66);
      setSoundcheckLine(4, v >= 85);
    },
  });

  // Phase 2: After all chars are visible, start scramble-resolve cascade
  await new Promise((resolve) => window.setTimeout(resolve, totalFadeIn + 60));

  let resolvedCount = 0;
  const totalChars = allChars.length;

  await new Promise((resolveAll) => {
    allChars.forEach(({ span, target }, i) => {
      const delay = i * 38; // slight cascade from left to right
      window.setTimeout(() => {
        scrambleChar(span, target, SCRAMBLE_MS, () => {
          resolvedCount += 1;
          if (resolvedCount === totalChars) resolveAll(undefined);
        });
      }, delay);
    });
  });

  // Phase 3: Separator line appears + shockwave sound hit
  if (separator) separator.classList.add('is-visible');
  heroKitStage?.triggerHit('kick', 1.0);
  background.shockwave(1.4, { x: window.innerWidth * 0.5, y: window.innerHeight * 0.52 });

  // Phase 4: Horizontal cyan scanline sweeps across the full name
  gsap.timeline()
    .set(sweepLine, { opacity: 1, x: '-100%' })
    .to(sweepLine, {
      x: '100%',
      duration: 0.48,
      ease: 'power2.inOut',
    })
    .to(sweepLine, { opacity: 0, duration: 0.12 });

  // Phase 5: Brief hold so the name sits fully resolved
  await new Promise((resolve) => window.setTimeout(resolve, HOLD_MS));

  // Phase 6: Final kick + explosion on background canvas
  heroKitStage?.triggerHit('kick', 1.8);
  background.shockwave(1.9, { x: window.innerWidth * 0.5, y: window.innerHeight * 0.52 });
  background.explode?.(1.9);

  // Phase 7: All chars pulse to full white briefly
  allChars.forEach(({ span }, i) => {
    gsap.to(span, {
      textShadow: '0 0 60px rgba(125,211,252,0.9), 0 0 120px rgba(125,211,252,0.4)',
      duration: 0.14,
      delay: i * 0.018,
      yoyo: true,
      repeat: 1,
    });
  });

  // Phase 8: Baffles slide apart revealing the site (no card, no box — full screen opens)
  await new Promise((resolve) => window.setTimeout(resolve, 180));

  gsap
    .timeline({ onComplete: () => revealStage() })
    .to('.soundcheck-baffle--left',  { xPercent: -100, duration: 0.52, ease: 'power3.inOut' })
    .to('.soundcheck-baffle--right', { xPercent: 100,  duration: 0.52, ease: 'power3.inOut' }, '<')
    .to('.sc-name-stage, .sc-hud-corner, .sc-sweep-line', { autoAlpha: 0, duration: 0.22 }, '<0.16');
}

const venomSymbiote = new VenomSymbioteEffect();

// Viewport visibility gating so offscreen heavy canvases pause their render loops completely
const canvasVisibility = {
  heroKit: true,
  portrait: false,
  elevation: false,
  matrix: false,
  venomHero: true,
  venomContact: false,
};

if ('IntersectionObserver' in window) {
  const viewportGate = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        const id = entry.target.id;
        if (id === 'hero-kit-canvas') canvasVisibility.heroKit = entry.isIntersecting;
        else if (id === 'ascii-canvas') canvasVisibility.portrait = entry.isIntersecting;
        else if (id === 'runner-elevation-canvas') canvasVisibility.elevation = entry.isIntersecting;
        else if (id === 'led-canvas') canvasVisibility.matrix = entry.isIntersecting;
        else if (id === 'hero-connect-btn') canvasVisibility.venomHero = entry.isIntersecting;
        else if (id === 'lets-connect-btn') canvasVisibility.venomContact = entry.isIntersecting;
      });
    },
    { rootMargin: '80px 0px', threshold: 0 }
  );
  [
    'hero-kit-canvas',
    'ascii-canvas',
    'runner-elevation-canvas',
    'led-canvas',
    'hero-connect-btn',
    'lets-connect-btn',
  ].forEach((id) => {
    const el = document.getElementById(id);
    if (el) viewportGate.observe(el);
  });
}

// Interactive Project Euler Mathematical Proof & Reduction Switcher (#euler-proof-switcher)
const EULER_PROOFS = {
  '1': {
    title: '#001 // MULTIPLES OF 3 OR 5',
    math: 'S(3) + S(5) − S(15) via Gauss’s identity S(k) = k · m(m + 1) / 2.',
    reduction: '999 checks → 3 ops',
    time: 'O(1)',
    space: 'O(1)',
  },
  '2': {
    title: '#002 // EVEN FIBONACCI',
    math: 'Pisano period 3 parity recurrence: E(n) = 4·E(n − 1) + E(n − 2).',
    reduction: '33 terms → 11 jumps',
    time: 'O(log_φ N)',
    space: 'O(1)',
  },
  '10': {
    title: '#010 // SUMMATION OF PRIMES',
    math: 'Odd-only Sieve of Eratosthenes crossing composites from p² with stride 2p.',
    reduction: '2×10⁶ ints → √N odd primes',
    time: 'O(N log log N)',
    space: 'O(N / 2)',
  },
  '14': {
    title: '#014 // COLLATZ SEQUENCE',
    math: 'Shortcut step T(n) = (3n + 1) / 2 with lower-half pruning and DAG memoization.',
    reduction: '10⁶ chains → Memoized DAG',
    time: 'O(N)',
    space: 'O(N)',
  },
  '67': {
    title: '#067 // MAXIMUM PATH SUM II',
    math: 'Bottom-up DP folding rows via T[r − 1][c] += max(T[r][c], T[r][c + 1]).',
    reduction: '2⁹⁹ paths → 4,950 ops',
    time: 'O(R²)',
    space: 'O(R)',
  },
};

function selectEulerProof(problemId) {
  const proof = EULER_PROOFS[String(problemId)];
  if (!proof) return;

  $$('[data-euler-problem]').forEach((btn) => {
    const active = btn.dataset.eulerProblem === String(problemId);
    btn.classList.toggle('is-active', active);
    btn.setAttribute('aria-selected', String(active));
  });

  const titleEl = $('#euler-proof-title');
  const mathEl = $('#euler-proof-math');
  const reductionEl = $('#euler-proof-reduction');
  const timeEl = $('#euler-proof-time');
  const spaceEl = $('#euler-proof-space');

  if (titleEl) titleEl.textContent = proof.title;
  if (mathEl) mathEl.textContent = proof.math;
  if (reductionEl) reductionEl.textContent = proof.reduction;
  if (timeEl) timeEl.textContent = proof.time;
  if (spaceEl) spaceEl.textContent = proof.space;
}

$$('[data-euler-problem]').forEach((btn) => {
  btn.addEventListener('click', () => {
    selectEulerProof(btn.dataset.eulerProblem);
    if (soundEnabled) audio.hit('hat', { count: false, strength: 0.35 });
  });
});

gsap.ticker.add((time) => {
  if (document.hidden) return;
  const milliseconds = time * 1000;
  const modalCoveringPage = arcade.isOpen || terminalModalOpen;

  if (motionEnabled) {
    if (Math.abs(heroRevealTarget - heroRevealCurrent) > 0.0005) {
      heroRevealCurrent += (heroRevealTarget - heroRevealCurrent) * 0.16;
      if (heroRevealTarget === 1 && heroRevealCurrent > 0.992) heroRevealCurrent = 1;
      if (heroRevealTarget === 0 && heroRevealCurrent < 0.008) heroRevealCurrent = 0;
      applyHeroKitProgress(heroRevealCurrent);
      if (heroRevealCurrent >= 0.985 && !terminalModalOpen && !arcade.isOpen) {
        lenis?.start();
      }
    }
    if (!modalCoveringPage) {
      background.render(milliseconds);
      const runnerVisible =
        runnerHudStripEl &&
        runnerHudStripEl.style.visibility !== 'hidden' &&
        runnerHudStripEl.style.opacity !== '0';
      if (runnerVisible) {
        marioRunner?.render(milliseconds);
      }
      if (canvasVisibility.heroKit) heroKitStage?.render(milliseconds);
      if (canvasVisibility.matrix) matrix.render(milliseconds);
      if (canvasVisibility.portrait) portrait.render(milliseconds);
      if (canvasVisibility.elevation) elevationTrace?.render(milliseconds);
      if (canvasVisibility.venomHero || canvasVisibility.venomContact || venomSymbiote.droplets?.length) {
        venomSymbiote.render(milliseconds);
      }
      renderKineticTypography();
    }
    renderCursorHalo();
    staticFrameDrawn = false;
  } else if (!staticFrameDrawn) {
    background.render(0);
    marioRunner?.render(0);
    heroKitStage?.render(0);
    matrix.render(0);
    portrait.render(0);
    elevationTrace?.render(0);
    staticFrameDrawn = true;
  }
  updateAge();
});

// ============================================================================
// LIVE LEETCODE STATS SYNCHRONIZATION (@rishav_leet)
// Automatically updates problems solved, difficulty distributions & acceptance
// ============================================================================
const LEETCODE_CACHE_KEY = 'cadence_leetcode_cache_v2';
const LEETCODE_API_PRIMARY = 'https://alfa-leetcode-api.onrender.com/userProfile/rishav_leet';
const LEETCODE_API_FALLBACK = 'https://alfa-leetcode-api.onrender.com/rishav_leet/solved';

function renderLeetCodeStats(stats, sourceLabel) {
  if (!stats) return;
  window.__LEETCODE_STATS = stats;

  const totalEl = $('#leetcode-total-solved');
  const subTelEl = $('#leetcode-sub-telemetry');
  const easyCountEl = $('#leetcode-easy-count');
  const easyFillEl = $('#leetcode-easy-fill');
  const medCountEl = $('#leetcode-medium-count');
  const medFillEl = $('#leetcode-medium-fill');
  const hardCountEl = $('#leetcode-hard-count');
  const hardFillEl = $('#leetcode-hard-fill');
  const statusEl = $('#leetcode-sync-status');

  if (totalEl) totalEl.textContent = String(stats.totalSolved);
  if (subTelEl) {
    subTelEl.textContent = `ACCEPTANCE ${stats.acceptanceRate} · WRITTEN IN C, C++ & PYTHON`;
  }

  const total = stats.totalSolved || 1;
  const easyPct = ((stats.easySolved / total) * 100).toFixed(1);
  const medPct = ((stats.mediumSolved / total) * 100).toFixed(1);
  const hardPct = ((stats.hardSolved / total) * 100).toFixed(1);

  if (easyCountEl) easyCountEl.textContent = `${stats.easySolved} SOLVED`;
  if (easyFillEl) easyFillEl.style.width = `${easyPct}%`;

  if (medCountEl) medCountEl.textContent = `${stats.mediumSolved} SOLVED`;
  if (medFillEl) medFillEl.style.width = `${medPct}%`;

  if (hardCountEl) hardCountEl.textContent = `${stats.hardSolved} SOLVED`;
  if (hardFillEl) hardFillEl.style.width = `${hardPct}%`;

  if (statusEl && sourceLabel) {
    statusEl.textContent = sourceLabel;
  }
}

async function initLeetCodeSync() {
  const defaultStats = {
    totalSolved: 149,
    easySolved: 95,
    mediumSolved: 49,
    hardSolved: 5,
    acceptanceRate: '57.3%',
  };

  // Immediate cached render from localStorage
  try {
    const cached = window.localStorage.getItem(LEETCODE_CACHE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed?.stats?.totalSolved) {
        renderLeetCodeStats(parsed.stats, '● LIVE SYNC (CACHED)');
      }
    }
  } catch {}

  // Set initial fallback if cache was absent
  if (!window.__LEETCODE_STATS) {
    renderLeetCodeStats(defaultStats, '● LIVE SYNC');
  }

  // Live profile fetch
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 7000);

    let data = null;
    try {
      const res = await fetch(LEETCODE_API_PRIMARY, { signal: controller.signal });
      if (res.ok) data = await res.json();
    } catch {
      try {
        const fbRes = await fetch(LEETCODE_API_FALLBACK, { signal: controller.signal });
        if (fbRes.ok) data = await fbRes.json();
      } catch {}
    } finally {
      clearTimeout(timeout);
    }

    if (data && (data.totalSolved || data.solvedProblem)) {
      const totalSolved = Number(data.totalSolved || data.solvedProblem || defaultStats.totalSolved);
      const easySolved = Number(data.easySolved ?? defaultStats.easySolved);
      const mediumSolved = Number(data.mediumSolved ?? defaultStats.mediumSolved);
      const hardSolved = Number(data.hardSolved ?? defaultStats.hardSolved);

      let acceptanceRate = defaultStats.acceptanceRate;
      const acNum = data.matchedUserStats?.acSubmissionNum?.[0]?.submissions ?? data.acSubmissionNum?.[0]?.submissions;
      const totalNum = data.matchedUserStats?.totalSubmissionNum?.[0]?.submissions ?? data.totalSubmissionNum?.[0]?.submissions;
      if (acNum && totalNum && totalNum > 0) {
        acceptanceRate = `${((acNum / totalNum) * 100).toFixed(1)}%`;
      }

      const freshStats = {
        totalSolved,
        easySolved,
        mediumSolved,
        hardSolved,
        acceptanceRate,
      };

      const now = new Date();
      const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      renderLeetCodeStats(freshStats, `● LIVE SYNC (${timeStr})`);

      try {
        window.localStorage.setItem(
          LEETCODE_CACHE_KEY,
          JSON.stringify({ stats: freshStats, timestamp: Date.now() })
        );
      } catch {}
    }
  } catch {
    // Keep cached / default stats silently on offline or network blocker
  }
}

updateAge();
void initLeetCodeSync();
void runSoundcheck();
