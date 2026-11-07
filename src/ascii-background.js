const GLYPHS = ['Ω', 'Ψ', 'Φ', 'Δ', '0', '1', 'λ', '∫', '⚡', '*'];
const SECTION_GLYPH_SETS = [
  GLYPHS, // 00: Hero Stage
  ['Ω', 'Ψ', '∿', '✦', '1', '7', '6', '·', 'Φ', 'Δ'], // 01: Identity & Curls
  ['0x', '*p', '&', '>>', 'C9', '[]', '{}', '01', 'FF', 'Δ'], // 02: Selected Projects (C99/C++)
  ['♫', '♪', '∿', 'Hz', 'dB', '7/8', '4/4', '⚡', '◈', '·'], // 03: Drum Synth & Sequencer
  ['▲', '5K', '10K', '→', '✦', 'Ω', '∿', '·', 'PR', '★'], // 04: Journey (Shimla -> IIIT-Bh)
  ['O(n)', 'DP', '>>', '⊕', '0', '1', 'λ', 'log', '[]', '✦'], // 05: LeetCode DSA
  ['git', 'C++', 'C99', '↗', '✦', '0x', '{}', '::', '⚡', '*'], // 06: GitHub Open Source
  ['∑', '∏', '∫', 'λ', '√', 'π', '∞', '≡', 'mod', 'Δ'], // 07: Project Euler Math
  ['TX', 'RX', '↗', '✦', 'Ω', '01', '05', '::', '⚡', '·'], // 08: Quick Archive
  ['✉', '↗', '✦', 'Ω', 'Ψ', '∿', '⚡', '*', '·', '+'], // 09: Contact Finale
];
const HERO_PORTRAIT_URL = new URL('../image/previews/ascii.jpg', import.meta.url).href;
const CURSOR_CURL_RADIUS = 180;

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function smoothstep(min, max, value) {
  const x = clamp((value - min) / Math.max(max - min, 0.0001), 0, 1);
  return x * x * (3 - 2 * x);
}

function seeded(index) {
  const value = Math.sin(index * 12.9898 + 78.233) * 43758.5453;
  return value - Math.floor(value);
}

/**
 * Lightweight 3-octave trigonometric 2D Curl-Noise field:
 * Computes divergence-free fluid velocity (dPsi/dy, -dPsi/dx) from a scalar potential Psi(x, y, t)
 * so particles swirl in organic eddies at a locked 60 FPS with zero external library overhead.
 */
function sampleCurlNoise2D(x, y, timeSec) {
  const k1 = 0.014;
  const k2 = 0.029;
  const k3 = 0.053;

  const t1 = timeSec * 1.15;
  const t2 = timeSec * 1.85;
  const t3 = timeSec * 2.6;

  // Octave 1 (broad eddy currents)
  const sx1 = Math.sin(x * k1 + t1);
  const cx1 = Math.cos(x * k1 + t1);
  const sy1 = Math.sin(y * k1 - t1 * 0.8);
  const cy1 = Math.cos(y * k1 - t1 * 0.8);

  // Octave 2 (medium turbulent vortices)
  const u2 = (x + y * 0.6) * k2 - t2;
  const v2 = (y - x * 0.6) * k2 + t2 * 0.7;
  const su2 = Math.sin(u2);
  const cu2 = Math.cos(u2);
  const sv2 = Math.sin(v2);
  const cv2 = Math.cos(v2);

  // Octave 3 (fine harmonic curl filaments)
  const u3 = x * k3 + Math.sin(y * k2 + t3);
  const v3 = y * k3 + Math.cos(x * k2 - t3);

  // Analytical partial derivatives of scalar stream function Psi:
  // vx = +dPsi/dy, vy = -dPsi/dx
  const dPsiDy =
    sx1 * cy1 * 0.58 +
    (cu2 * sv2 * 0.6 + su2 * cv2) * 0.3 +
    Math.cos(v3) * 0.18;
  const dPsiDx =
    cx1 * sy1 * 0.58 +
    (cu2 * sv2 - su2 * cv2 * 0.6) * 0.3 +
    Math.cos(u3) * 0.18;

  return {
    vx: dPsiDy,
    vy: -dPsiDx,
  };
}

/**
 * Clean Full-Viewport Interactive Glyph Field (#bg-canvas)
 * Features a subtle, motion-driven 2D Curl-Noise velocity & rotational vorticity field within 180px of the cursor
 * (settling calmly when the cursor is stationary), paired with a 3D depth tilt and ice-cyan (#7DD3FC),
 * star-white (#F8FAFC), and ethereal violet (#C084FC) palette.
 */
export class AsciiBackground {
  constructor(canvas) {
    this.canvas = canvas;
    this.context = canvas.getContext('2d');
    this.cells = [];
    this.pointer = { x: -9999, y: -9999, vx: 0, vy: 0, speed: 0 };
    this.pointerTarget = { x: -9999, y: -9999 };
    this.tilt = { x: 0, y: 0, targetX: 0, targetY: 0 };
    this.shockwaves = [];
    this.warpStrength = 0;
    this.scrollOffset = 0;
    this.scrollProgress = 0;
    this.scrollVelocity = 0;
    this.sectionIndex = 0;
    this.pixelRatio = 1;
    this.lastTime = 0;
    this.hoverEnabled = false;
    this.hoverAlpha = 0;
    this._hoverTimer = null;
    this.resize();
    this.bind();
    window.addEventListener('resize', () => this.resize(), { passive: true });
  }

  bind() {
    window.addEventListener(
      'pointermove',
      (event) => {
        if (event.pointerType === 'touch') return;
        this.pointerTarget.x = event.clientX;
        this.pointerTarget.y = event.clientY;
        this.tilt.targetX = (event.clientX / Math.max(this.width, 1) - 0.5) * 2;
        this.tilt.targetY = (event.clientY / Math.max(this.height, 1) - 0.5) * 2;
      },
      { passive: true }
    );

    window.addEventListener('pointerleave', () => this.clearPointer());
    window.addEventListener('blur', () => this.clearPointer());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.clearPointer();
    });
  }

  clearPointer() {
    this.pointerTarget.x = -9999;
    this.pointerTarget.y = -9999;
    this.pointer.speed = 0;
    this.tilt.targetX = 0;
    this.tilt.targetY = 0;
  }

  resize() {
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.pixelRatio = Math.min(window.devicePixelRatio || 1, 1.6);
    this.canvas.width = Math.round(this.width * this.pixelRatio);
    this.canvas.height = Math.round(this.height * this.pixelRatio);
    this.spacing = clamp(Math.round(Math.min(this.width, this.height) / 22), 24, 36);
    this.columns = Math.ceil(this.width / this.spacing) + 2;
    this.rows = Math.ceil(this.height / this.spacing) + 2;
    this.cells = [];

    for (let row = 0; row < this.rows; row += 1) {
      for (let column = 0; column < this.columns; column += 1) {
        const index = row * this.columns + column;
        const zDepth = 0.65 + seeded(index + 11) * 0.7; // 3D depth layer factor
        this.cells.push({
          x: column * this.spacing - this.spacing,
          y: row * this.spacing - this.spacing,
          z: zDepth,
          glyph: GLYPHS[Math.floor(seeded(index) * GLYPHS.length)],
          phase: seeded(index + 3) * Math.PI * 2,
          spinSign: seeded(index + 9) > 0.28 ? 1 : -1,
          alpha: 0.08 + seeded(index + 6) * 0.11,
          offsetX: 0,
          offsetY: 0,
          velocityX: 0,
          velocityY: 0,
        });
      }
    }
  }

  getThemeColors() {
    const root = getComputedStyle(document.documentElement);
    const isLight = document.documentElement.dataset.theme === 'light';
    return {
      accent: root.getPropertyValue('--accent').trim() || (isLight ? '#0284c7' : '#7dd3fc'),
      cyan: root.getPropertyValue('--matrix-cyan').trim() || (isLight ? '#0284c7' : '#7dd3fc'),
      violet: root.getPropertyValue('--matrix-violet').trim() || '#c084fc',
      starWhite: isLight ? '#090d16' : (root.getPropertyValue('--text-bright').trim() || '#f8fafc'),
      text: root.getPropertyValue('--text').trim() || (isLight ? '#334155' : '#cbd5e1'),
      isLight,
    };
  }

  shockwave(strength = 1, origin = null) {
    this.shockwaves.push({
      x: origin?.x ?? (this.pointer.x > 0 ? this.pointer.x : this.width * (0.28 + Math.random() * 0.44)),
      y: origin?.y ?? (this.pointer.y > 0 ? this.pointer.y : this.height * (0.32 + Math.random() * 0.36)),
      radius: 0,
      strength: clamp(strength, 0.2, 2.2),
      life: 1,
    });
  }

  explode(power = 1.6) {
    const centerX = this.width * 0.5;
    const centerY = this.height * 0.5;
    this.hoverEnabled = false;
    this.hoverAlpha = 0;

    // High energy central shockwave
    this.shockwave(2.5 * power, { x: centerX, y: centerY });

    this.cells.forEach((cell, index) => {
      const dx = cell.x - centerX;
      const dy = cell.y - centerY;
      const angle = Math.atan2(dy, dx) + (seeded(index * 3 + 1) - 0.5) * 0.85;
      const blastPower = power * (1 + seeded(index * 7 + 2) * 1.3);
      const blastSpeed = 42 + seeded(index * 11 + 3) * 58;
      const initialOffset = 140 + seeded(index * 13 + 5) * 280;

      // Disperse violently outward from center
      cell.offsetX = Math.cos(angle) * initialOffset;
      cell.offsetY = Math.sin(angle) * initialOffset;
      cell.velocityX = Math.cos(angle) * blastSpeed * blastPower;
      cell.velocityY = Math.sin(angle) * blastSpeed * blastPower;
    });

    // Settle into grid, then smoothly engage hover effect
    window.clearTimeout(this._hoverTimer);
    this._hoverTimer = window.setTimeout(() => {
      this.hoverEnabled = true;
    }, 1100);
  }

  pulseGlobe() {
    this.shockwave(1.6, { x: this.width * 0.5, y: this.height * 0.5 });
  }

  setWarp(strength) {
    this.warpStrength = clamp(strength, 0, 1);
  }

  setSection(index) {
    this.sectionIndex = clamp(index, 0, SECTION_GLYPH_SETS.length - 1);
  }

  setScroll({ scroll = 0, velocity = 0, progress = 0 } = {}) {
    this.scrollOffset = scroll * 0.15;
    this.scrollVelocity = velocity;
    this.scrollProgress = progress;
  }

  render(time) {
    const delta = this.lastTime ? clamp((time - this.lastTime) / 16.67, 0.3, 2.4) : 1;
    this.lastTime = time;
    const timeSec = time * 0.001;
    const context = this.context;
    const colors = this.getThemeColors();
    const fontSize = clamp(this.spacing * 0.46, 10, 14);
    const pointerEase = this.warpStrength > 0 ? 0.28 : 0.16;

    const prevX = this.pointer.x;
    const prevY = this.pointer.y;
    this.pointer.x += (this.pointerTarget.x - this.pointer.x) * pointerEase;
    this.pointer.y += (this.pointerTarget.y - this.pointer.y) * pointerEase;
    const rawVx = this.pointerTarget.x < -1000 ? 0 : clamp(this.pointer.x - prevX, -28, 28);
    const rawVy = this.pointerTarget.y < -1000 ? 0 : clamp(this.pointer.y - prevY, -28, 28);
    this.pointer.vx = rawVx;
    this.pointer.vy = rawVy;
    const instSpeed = Math.hypot(rawVx, rawVy);
    this.pointer.speed = this.pointer.speed * 0.8 + instSpeed * 0.2;
    // Motion gate: curl eddy wakes only activate while the cursor moves; stationary cursor settles peacefully
    const motionFactor = clamp((this.pointer.speed - 0.18) * 0.1, 0, 1);

    // Smooth 3D depth tilt interpolation
    this.tilt.x += (this.tilt.targetX - this.tilt.x) * 0.08;
    this.tilt.y += (this.tilt.targetY - this.tilt.y) * 0.08;

    context.setTransform(this.pixelRatio, 0, 0, this.pixelRatio, 0, 0);
    context.clearRect(0, 0, this.width, this.height);
    context.font = `600 ${fontSize}px "JetBrains Mono", monospace`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.globalCompositeOperation = colors.isLight ? 'source-over' : 'lighter';

    // Smooth transition for hover effect
    this.hoverAlpha += ((this.hoverEnabled ? 1 : 0) - this.hoverAlpha) * 0.08;

    // Subtle Radial Cursor Spotlight Glow
    if (this.hoverAlpha > 0.005) {
      context.save();
      context.globalAlpha = this.hoverAlpha;
      const trail = context.createRadialGradient(
        this.pointer.x,
        this.pointer.y,
        0,
        this.pointer.x,
        this.pointer.y,
        195 + this.warpStrength * 65
      );
      trail.addColorStop(0, `${colors.cyan}1c`);
      trail.addColorStop(0.45, `${colors.violet}0e`);
      trail.addColorStop(0.78, `${colors.accent}05`);
      trail.addColorStop(1, `${colors.violet}00`);
      context.fillStyle = trail;
      context.fillRect(this.pointer.x - 260, this.pointer.y - 260, 520, 520);
      context.restore();
    }

    const centerX = this.width * 0.5;
    const centerY = this.height * 0.5;

    // Subtle Motion-Coupled 2D Curl-Noise Velocity Field & Vorticity Physics
    this.cells.forEach((cell, index) => {
      const currentX = cell.x + cell.offsetX;
      const currentY = cell.y + cell.offsetY;
      const dx = currentX - this.pointer.x;
      const dy = currentY - this.pointer.y;
      const distance = Math.hypot(dx, dy);

      // Strictly 180px cursor vorticity radius
      const rawInfluence = clamp(1 - distance / CURSOR_CURL_RADIUS, 0, 1);
      const cursorInfluence = rawInfluence * this.hoverAlpha;

      let shockInfluence = 0;
      this.shockwaves.forEach((wave) => {
        const waveDistance = Math.hypot(cell.x - wave.x, cell.y - wave.y);
        shockInfluence += clamp(1 - Math.abs(waveDistance - wave.radius) / 48, 0, 1) * wave.strength * wave.life;
      });

      if (cursorInfluence > 0 && motionFactor > 0.004) {
        // Smooth bell-curve envelope peaking inside the 180px zone, gated by pointer motion so stationary cursor never churns
        const falloff = cursorInfluence * cursorInfluence * (3 - 2 * cursorInfluence);
        const invDist = 1 / Math.max(distance, 1);
        const nx = dx * invDist;
        const ny = dy * invDist;

        // 1. Subtle rotational tangential vortex vector (-ny, nx)
        const tangentX = -ny * cell.spinSign;
        const tangentY = nx * cell.spinSign;

        // 2. Multi-octave 2D trigonometric Curl-Noise field at particle position
        const curl = sampleCurlNoise2D(currentX, currentY, timeSec + cell.phase * 0.2);

        // 3. Couple pointer motion into a gentle fluid wake swirl
        const wakeX = this.pointer.vx * 0.022;
        const wakeY = this.pointer.vy * 0.022;

        const vortexForce = falloff * motionFactor * 0.68 * cell.z;

        const forceX = (tangentX * 0.5 + curl.vx * 0.7) * vortexForce + wakeX * falloff;
        const forceY = (tangentY * 0.5 + curl.vy * 0.7) * vortexForce + wakeY * falloff;

        cell.velocityX += forceX * delta;
        cell.velocityY += forceY * delta;
      }

      // Acoustic shockwave curl ripple
      if (shockInfluence > 0) {
        const ripple = shockInfluence * 1.35;
        cell.velocityX += Math.sin(cell.phase + time * 0.008) * ripple;
        cell.velocityY += Math.cos(cell.phase + time * 0.008) * ripple;
      }

      // Elastic Hooke spring smoothly returns particles to their resting cadence position
      const springStiffness = 0.098;
      const fluidDamping = 0.83;
      cell.velocityX = (cell.velocityX - cell.offsetX * springStiffness) * fluidDamping;
      cell.velocityY = (cell.velocityY - cell.offsetY * springStiffness) * fluidDamping;
      cell.offsetX += cell.velocityX * delta;
      cell.offsetY += cell.velocityY * delta;

      const swirlSpeed = Math.hypot(cell.velocityX, cell.velocityY);
      const brightness = clamp(
        cell.alpha + cursorInfluence * 0.34 + swirlSpeed * 0.045 + shockInfluence * 0.42 + this.warpStrength * 0.18,
        0.04,
        0.72
      );
      const activeSet = SECTION_GLYPH_SETS[this.sectionIndex] || GLYPHS;
      const sectionGlyph = activeSet[index % activeSet.length];
      const glyph =
        (cursorInfluence > 0.6 && motionFactor > 0.4) || shockInfluence > 0.5
          ? activeSet[(index + Math.floor(time * 0.008)) % activeSet.length]
          : this.sectionIndex === 0
            ? cell.glyph
            : sectionGlyph;

      // Preserve exact palette: ice-cyan (#7DD3FC), deep star white (#F8FAFC), ethereal violet (#C084FC)
      const color =
        cursorInfluence > 0.66
          ? colors.starWhite
          : cursorInfluence > 0.28
            ? colors.cyan
            : shockInfluence > 0.35 || swirlSpeed > 0.85
              ? colors.violet
              : colors.text;

      // Preserve 3D depth tilt parallax across cells
      const depthParallaxX = this.tilt.x * (cell.z - 1) * 14;
      const depthParallaxY = this.tilt.y * (cell.z - 1) * 14;
      const warpOffset = this.warpStrength * (Math.sin(cell.phase) * 28 + this.width * 0.22);
      const baseDrawX = cell.x + cell.offsetX + depthParallaxX - warpOffset - (this.scrollOffset % this.spacing);
      const compression = 1 - Math.min(this.scrollProgress * 0.08, 0.08);
      const baseDrawY = (cell.y + cell.offsetY + depthParallaxY - this.scrollOffset * 0.04) * compression;

      // Subtle 3D perspective foreshortening from pointer tilt
      const normX = (baseDrawX - centerX) / Math.max(this.width, 1);
      const normY = (baseDrawY - centerY) / Math.max(this.height, 1);
      const perspectiveScale = 1 + (normX * this.tilt.x + normY * this.tilt.y) * 0.035 * cell.z;
      const drawX = centerX + (baseDrawX - centerX) * perspectiveScale;
      const drawY = centerY + (baseDrawY - centerY) * perspectiveScale;

      if (this.warpStrength > 0.02) {
        context.fillStyle = colors.accent;
        context.globalAlpha = brightness * this.warpStrength * 0.24;
        context.fillText(glyph, drawX - 36, drawY);
      }
      context.fillStyle = color;
      context.globalAlpha = brightness * (cursorInfluence > 0.06 ? 0.52 : 0.32);
      context.fillText(glyph, drawX, drawY);
    });

    this.shockwaves = this.shockwaves.filter((wave) => {
      wave.radius += (16 + wave.strength * 8) * delta;
      wave.life *= 0.94;
      context.beginPath();
      context.arc(wave.x, wave.y, wave.radius, 0, Math.PI * 2);
      context.strokeStyle = colors.cyan;
      context.globalAlpha = wave.life * 0.22;
      context.lineWidth = 2 + wave.strength;
      context.stroke();
      return wave.life > 0.035;
    });
    context.globalAlpha = 1;
    context.globalCompositeOperation = 'source-over';
  }
}

/**
 * 3-Phase Relativistic Black Hole Singularity -> Lorenz Strange Attractor -> 3D LiDAR Hologram Engine (#hero-kit-canvas)
 * Replaces the static cylinder blocks with:
 *  - Phase 0 (scroll = 0): Relativistic Black Hole Singularity, Event Horizon Photon Ring & Doppler Accretion Vortex with gravitational cursor lensing
 *  - Phase 1 (scroll reveal): 3D Twin-Wing Lorenz Strange Attractor & Chladni Cymatics Resonance Ribbon weaving around RISHAV KUMAR
 *  - Phase 2 (reveal lock): High-Density 3D Topographic LiDAR Scanlines sampled from Rishav's portrait with chromatic cursor waves
 */
export class HeroDrumKitStage {
  constructor(canvas, { onPieceClick } = {}) {
    this.canvas = canvas;
    if (!canvas) return;
    this.context = canvas.getContext('2d');
    this.onPieceClick = onPieceClick;
    this.progress = 0;
    this.targetProgress = 0;
    this.manualModeIndex = null; // null | 0 (Singularity) | 1 (Attractor) | 2 (Hologram)
    this.pointer = { x: 0, y: 0, rawX: -9999, rawY: -9999, prevRawX: -9999, prevRawY: -9999, speed: 0 };
    this.hitPulse = { kick: 0, rim: 0, hat: 0 };
    this.chladniMode = 0;
    this.shockRings = [];
    this.particles = [];
    this.lidarRows = [];
    this.buildVolumetricParticles();
    this.loadPhotoDepthCloud();
    this.resize();
    this.bind();
    window.addEventListener('resize', () => this.resize(), { passive: true });
  }

  buildVolumetricParticles() {
    const TOTAL = 2400;
    this.particles = [];

    // Integrate a continuous 3D Lorenz Strange Attractor trajectory for Phase 1
    const lorenzPts = [];
    let lx = 0.1;
    let ly = 0.0;
    let lz = 0.0;
    const sigma = 10;
    const rho = 28;
    const beta = 8 / 3;
    const dt = 0.0055;
    // Warm-up attractor
    for (let w = 0; w < 200; w += 1) {
      const dx = sigma * (ly - lx);
      const dy = lx * (rho - lz) - ly;
      const dz = lx * ly - beta * lz;
      lx += dx * dt;
      ly += dy * dt;
      lz += dz * dt;
    }
    for (let i = 0; i < TOTAL; i += 1) {
      const dx = sigma * (ly - lx);
      const dy = lx * (rho - lz) - ly;
      const dz = lx * ly - beta * lz;
      lx += dx * dt;
      ly += dy * dt;
      lz += dz * dt;
      lorenzPts.push({
        x: lx * 10.5,
        y: (lz - 25) * 6.8,
        z: ly * 8.2,
      });
    }

    const drumTypes = ['kick', 'rim', 'hat'];
    const tones = ['accent', 'cyan', 'violet'];

    for (let i = 0; i < TOTAL; i += 1) {
      const s1 = seeded(i * 3 + 1);
      const s2 = seeded(i * 7 + 2);
      const s3 = seeded(i * 11 + 3);
      const s4 = seeded(i * 17 + 5);

      // Phase 0: Gargantua-style Relativistic Accretion Disk + Lensed Einstein Ring
      const isPhotonRing = i < 480;
      const isLensedArch = !isPhotonRing && i < 880;
      const orbitAngle = s1 * Math.PI * 2;
      let diskR;
      let sx;
      let sy;
      let sz;
      let orbitSpeed;

      if (isPhotonRing) {
        diskR = 58 + (s2 - 0.5) * 7;
        orbitSpeed = 2.4 + s3 * 0.7;
        sx = Math.cos(orbitAngle) * diskR;
        sy = Math.sin(orbitAngle) * diskR * 0.92;
        sz = Math.sin(orbitAngle * 2) * 14;
      } else if (isLensedArch) {
        // Gravitationally lensed upper & lower photon arches bending around the shadow
        const archSign = i % 2 === 0 ? 1 : -1;
        diskR = 64 + Math.pow(s2, 1.3) * 125;
        orbitSpeed = 1.9 + s3 * 0.5;
        sx = Math.cos(orbitAngle) * diskR;
        sy = archSign * Math.abs(Math.sin(orbitAngle)) * (56 + s3 * 42) + (s4 - 0.5) * 8;
        sz = Math.sin(orbitAngle) * diskR * 0.35;
      } else {
        // Thin, luminous Keplerian spiral accretion disk tilted at 15 degrees
        diskR = 66 + Math.pow(s2, 1.5) * 260;
        orbitSpeed = 135 / Math.pow(diskR, 0.72);
        const armSpiral = (i % 2) * Math.PI + Math.log(diskR / 58) * 1.65;
        const thickness = (s3 - 0.5) * (3.5 + diskR * 0.032);
        const rawX = Math.cos(orbitAngle + armSpiral) * diskR;
        const rawZ = Math.sin(orbitAngle + armSpiral) * diskR;
        const tilt = 0.27;
        sx = rawX;
        sy = thickness * Math.cos(tilt) - rawZ * Math.sin(tilt);
        sz = rawZ * Math.cos(tilt) + thickness * Math.sin(tilt);
      }

      // Phase 1: Lorenz Strange Attractor
      const lor = lorenzPts[i];

      // Phase 2: Radial Fibonacci Cymatics Harmonic Mandala (frames RISHAV KUMAR cleanly without a rectangular box)
      const goldenAngle = i * 2.399963229728653;
      const radialNorm = Math.sqrt((i + 0.5) / TOTAL);
      const mandalaR = 36 + radialNorm * 235;
      const harmonicWave =
        Math.cos(6 * goldenAngle) * Math.sin(radialNorm * Math.PI * 3) * 28 +
        Math.cos(radialNorm * Math.PI * 5) * 18;
      const px = Math.cos(goldenAngle) * mandalaR;
      const py = Math.sin(goldenAngle) * (mandalaR * 0.72);
      const pz = harmonicWave;
      const lum = clamp(0.45 + 0.55 * Math.cos(radialNorm * Math.PI * 4 + Math.cos(3 * goldenAngle)), 0.25, 1);

      this.particles.push({
        index: i,
        drumType: drumTypes[i % 3],
        tone: tones[i % 3],
        isPhotonRing,
        isPolarJet: false,
        orbitAngle,
        diskR: diskR || 64,
        orbitSpeed,
        scattered: { x: sx, y: sy, z: sz },
        kit: { x: lor.x, y: lor.y, z: lor.z },
        portrait: { x: px, y: py, z: pz, lum, row: Math.floor(i / 60), col: i % 60 },
        isPortraitNode: true,
        size: isPhotonRing ? 1.45 + s4 * 1.25 : 1.05 + s4 * 1.65,
        phase: s1 * Math.PI * 2,
        spinSign: s2 > 0.3 ? 1 : -1,
        curlX: 0,
        curlY: 0,
        velX: 0,
        velY: 0,
        screenX: 0,
        screenY: 0,
        visible: false,
      });
    }
  }

  async loadPhotoDepthCloud() {
    try {
      const img = new Image();
      img.decoding = 'async';
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = HERO_PORTRAIT_URL;
      });
      await img.decode?.();

      const gridW = 60;
      const gridH = 40;
      const offscreen = document.createElement('canvas');
      offscreen.width = gridW;
      offscreen.height = gridH;
      const ctx = offscreen.getContext('2d', { willReadFrequently: true });
      const size = Math.min(img.naturalWidth, img.naturalHeight);
      const isAscii = img.src.includes('ascii');
      const sx = (img.naturalWidth - size) * 0.5;
      const sy = isAscii ? (img.naturalHeight - size) * 0.18 : (img.naturalHeight - size) * 0.24;
      ctx.drawImage(img, sx, sy, size, size, 0, 0, gridW, gridH);
      const data = ctx.getImageData(0, 0, gridW, gridH).data;

      this.particles.forEach((pt, i) => {
        const r = Math.floor(i / gridW) % gridH;
        const c = i % gridW;
        const idx = (r * gridW + c) * 4;
        const rawLum = (data[idx] * 0.2126 + data[idx + 1] * 0.7152 + data[idx + 2] * 0.0722) / 255;
        const contrasted = clamp((rawLum - 0.12) * 1.35, 0.22, 1);
        pt.portrait.z = pt.portrait.z * 0.65 + (contrasted - 0.5) * 54;
        pt.portrait.lum = clamp(pt.portrait.lum * 0.5 + contrasted * 0.5, 0.28, 1);
        pt.isPortraitNode = true;
      });
    } catch {
      // Procedural fallback remains active
    }
  }

  bind() {
    this.canvas.addEventListener(
      'pointermove',
      (e) => {
        const rect = this.canvas.getBoundingClientRect();
        this.pointer.rawX = e.clientX - rect.left;
        this.pointer.rawY = e.clientY - rect.top;
        this.pointer.x = (this.pointer.rawX / Math.max(rect.width, 1) - 0.5) * 2;
        this.pointer.y = (this.pointer.rawY / Math.max(rect.height, 1) - 0.5) * 2;
      },
      { passive: true }
    );

    this.canvas.addEventListener('pointerleave', () => {
      this.pointer.rawX = -9999;
      this.pointer.rawY = -9999;
      this.pointer.prevRawX = -9999;
      this.pointer.prevRawY = -9999;
      this.pointer.speed = 0;
    });

    this.canvas.addEventListener('click', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const ratioX = (e.clientX - rect.left) / Math.max(rect.width, 1);
      const drumType = ratioX < 0.35 ? 'hat' : ratioX > 0.65 ? 'rim' : 'kick';
      this.triggerHit(drumType, 1.45);
      this.onPieceClick?.(drumType);
    });
  }

  resize() {
    if (!this.canvas) return;
    const rect = this.canvas.getBoundingClientRect();
    this.width = Math.max(rect.width, 320);
    this.height = Math.max(rect.height, 360);
    this.pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(this.width * this.pixelRatio);
    this.canvas.height = Math.round(this.height * this.pixelRatio);
  }

  setProgress(progress) {
    if (this.manualModeIndex !== null) return;
    this.targetProgress = clamp(progress, 0, 1);
  }

  cycleStageMode() {
    const modes = [
      { index: 0, progress: 0.0, label: '◈ SINGULARITY ↻', sound: 'kick' },
      { index: 1, progress: 0.45, label: '◈ ATTRACTOR ↻', sound: 'rim' },
      { index: 2, progress: 1.0, label: '◈ HOLOGRAM ↻', sound: 'hat' },
    ];
    const currentIdx =
      this.manualModeIndex !== null
        ? this.manualModeIndex
        : this.progress < 0.22
          ? 0
          : this.progress < 0.72
            ? 1
            : 2;
    const next = modes[(currentIdx + 1) % modes.length];
    this.manualModeIndex = next.index;
    this.targetProgress = next.progress;
    for (let i = 0; i < this.particles.length; i += 1) {
      const pt = this.particles[i];
      const angle = pt.phase + i * 0.13;
      pt.velX += Math.cos(angle) * 7.5;
      pt.velY += Math.sin(angle) * 7.5;
    }
    this.triggerHit(next.sound, 1.65);
    return next;
  }

  triggerHit(type = 'kick', strength = 1) {
    if (type === 'kick') {
      this.hitPulse.kick = Math.max(this.hitPulse.kick, strength);
      this.chladniMode = (this.chladniMode + 1) % 4;
    } else if (type === 'rim') {
      this.hitPulse.rim = Math.max(this.hitPulse.rim, strength);
    } else {
      this.hitPulse.hat = Math.max(this.hitPulse.hat, strength);
    }
    this.shockRings.push({ radius: 18, strength: clamp(strength, 0.5, 1.8), life: 1, type });
  }

  getColors() {
    const root = getComputedStyle(document.documentElement);
    const theme = document.documentElement.getAttribute('data-theme') || 'dark';
    const isLight = theme === 'light';
    return {
      isLight,
      accent: root.getPropertyValue('--accent').trim() || (isLight ? '#0284c7' : '#7dd3fc'),
      cyan: root.getPropertyValue('--matrix-cyan').trim() || (isLight ? '#0369a1' : '#7dd3fc'),
      violet: root.getPropertyValue('--matrix-violet').trim() || (isLight ? '#7c3aed' : '#c084fc'),
      text: root.getPropertyValue('--text-bright').trim() || (isLight ? '#090d16' : '#f8fafc'),
    };
  }

  render(time) {
    if (!this.canvas) return;
    const ctx = this.context;
    const timeSec = time * 0.001;
    this.progress += (this.targetProgress - this.progress) * 0.12;

    if (this.pointer.rawX > -1000 && this.pointer.prevRawX > -1000) {
      const stepDist = Math.hypot(this.pointer.rawX - this.pointer.prevRawX, this.pointer.rawY - this.pointer.prevRawY);
      this.pointer.speed = this.pointer.speed * 0.8 + clamp(stepDist, 0, 32) * 0.2;
    } else {
      this.pointer.speed *= 0.8;
    }
    this.pointer.prevRawX = this.pointer.rawX;
    this.pointer.prevRawY = this.pointer.rawY;
    const heroMotion = clamp((this.pointer.speed - 0.15) * 0.1, 0, 1);

    const p = this.progress;
    // Morph 1 (p: 0 -> 0.40): Black Hole Singularity -> Pure 3D Lorenz Strange Attractor
    const assembleT = smoothstep(0.0, 0.40, p);
    // Morph 2 (p: 0.54 -> 0.92): Lorenz Attractor -> 3D Topographic LiDAR Hologram
    const flipT = smoothstep(0.54, 0.92, p);
    const singularityPresence = Math.max(0, 1 - assembleT * 1.15);

    const colors = this.getColors();
    ctx.setTransform(this.pixelRatio, 0, 0, this.pixelRatio, 0, 0);
    ctx.clearRect(0, 0, this.width, this.height);
    ctx.globalCompositeOperation = colors.isLight ? 'source-over' : 'lighter';

    const centerX = this.width * 0.5;
    const centerY = this.height * 0.51;
    const scaleBase = Math.min(this.width, this.height) / 380;

    // Ambient Corona + Relativistic Singularity Core
    const coreGlow = ctx.createRadialGradient(
      centerX,
      centerY,
      0,
      centerX,
      centerY,
      Math.min(this.width, this.height) * 0.46
    );
    coreGlow.addColorStop(0, `${colors.accent}24`);
    coreGlow.addColorStop(0.45, `${colors.violet}12`);
    coreGlow.addColorStop(1, `${colors.violet}00`);
    ctx.fillStyle = coreGlow;
    ctx.fillRect(0, 0, this.width, this.height);

    // Draw Black Hole Event Horizon & Lensed Photon Ring during Phase 0
    if (singularityPresence > 0.02) {
      const bhRadius = (46 + this.hitPulse.kick * 8) * scaleBase * (0.4 + singularityPresence * 0.6);
      ctx.save();
      ctx.globalCompositeOperation = 'source-over';
      // Outer photon halo
      const photonGrad = ctx.createRadialGradient(centerX, centerY, bhRadius * 0.78, centerX, centerY, bhRadius * 1.9);
      photonGrad.addColorStop(0, colors.text);
      photonGrad.addColorStop(0.28, colors.cyan);
      photonGrad.addColorStop(0.62, `${colors.violet}66`);
      photonGrad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.globalAlpha = singularityPresence * 0.85;
      ctx.fillStyle = photonGrad;
      ctx.beginPath();
      ctx.arc(centerX, centerY, bhRadius * 1.9, 0, Math.PI * 2);
      ctx.fill();

      // Abyssal Event Horizon shadow core
      ctx.fillStyle = colors.isLight ? '#031211' : '#010206';
      ctx.globalAlpha = singularityPresence * 0.96;
      ctx.beginPath();
      ctx.arc(centerX, centerY, bhRadius, 0, Math.PI * 2);
      ctx.fill();

      // Razor-thin Einstein photon ring
      ctx.strokeStyle = colors.text;
      ctx.lineWidth = 1.6;
      ctx.globalAlpha = singularityPresence * 0.92;
      ctx.beginPath();
      ctx.arc(centerX, centerY, bhRadius * 1.03, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    const rotY =
      lerp(-0.28, 0.12, flipT) +
      this.pointer.x * 0.34 +
      Math.sin(timeSec * 0.42) * 0.08 * (1 - flipT * 0.6);
    const rotX = lerp(0.26, 0.08, flipT) - this.pointer.y * 0.24;

    const cosY = Math.cos(rotY);
    const sinY = Math.sin(rotY);
    const cosX = Math.cos(rotX);
    const sinX = Math.sin(rotX);

    const fov = 540;
    const camZ = 440;

    // Chladni Cymatics harmonic numbers (m, n) excited by drum hits
    const chladniEnergy = clamp(this.hitPulse.kick + this.hitPulse.rim * 0.8 + this.hitPulse.hat * 0.5, 0, 2.2);
    const cm = 2 + (this.chladniMode % 3);
    const cn = 3 + ((this.chladniMode + 1) % 4);

    for (let i = 0; i < this.particles.length; i += 1) {
      const pt = this.particles[i];

      // Live Keplerian differential rotation in Singularity state
      const liveAngle = pt.orbitAngle + timeSec * pt.orbitSpeed * (1 - assembleT * 0.75);
      let sx0 = pt.scattered.x;
      let sy0 = pt.scattered.y;
      let sz0 = pt.scattered.z;

      if (!pt.isPolarJet) {
        const ca = Math.cos(liveAngle - pt.orbitAngle);
        const sa = Math.sin(liveAngle - pt.orbitAngle);
        sx0 = pt.scattered.x * ca - pt.scattered.z * sa;
        sz0 = pt.scattered.z * ca + pt.scattered.x * sa;
      }

      const midX = lerp(sx0, pt.kit.x, assembleT);
      const midY = lerp(sy0, pt.kit.y, assembleT);
      const midZ = lerp(sz0, pt.kit.z, assembleT);

      let x = lerp(midX, pt.portrait.x, flipT);
      let y = lerp(midY, pt.portrait.y, flipT);
      let z = lerp(midZ, pt.portrait.z, flipT);

      // Chladni standing-wave displacement when drums/clicks fire
      if (chladniEnergy > 0.02) {
        const nx = x * 0.018;
        const ny = y * 0.018;
        const chladniVal = Math.cos(cn * nx) * Math.cos(cm * ny) - Math.cos(cm * nx) * Math.cos(cn * ny);
        z += chladniVal * chladniEnergy * 24;
        x += Math.sin(ny * 4 + timeSec * 8) * chladniEnergy * 6;
      }

      const wave = Math.sin(timeSec * 2.4 + pt.phase) * (2.2 + (1 - flipT) * 4.5);
      x += Math.cos(pt.phase) * wave;
      y += Math.sin(pt.phase) * wave;

      const sx = x * scaleBase;
      const sy = y * scaleBase;
      const sz = z * scaleBase;

      const x1 = sx * cosY - sz * sinY;
      const z1 = sz * cosY + sx * sinY;
      const y2 = sy * cosX - z1 * sinX;
      const z2 = z1 * cosX + sy * sinX;

      const depth = camZ - z2;
      if (depth <= 80) {
        pt.visible = false;
        continue;
      }

      const scale = fov / depth;
      const restScreenX = centerX + x1 * scale;
      const restScreenY = centerY + y2 * scale;

      const curX = restScreenX + pt.curlX;
      const curY = restScreenY + pt.curlY;
      const dx = curX - this.pointer.rawX;
      const dy = curY - this.pointer.rawY;
      const pDist = Math.hypot(dx, dy);

      // Gravitational Lensing & Curl-Noise Vorticity around Cursor (210px radius)
      const lensRadius = 210;
      if (pDist < lensRadius && this.pointer.rawX > -1000) {
        const influence = 1 - pDist / lensRadius;
        const falloff = influence * influence * (3 - 2 * influence);
        const invD = 1 / Math.max(pDist, 1);
        const nx = dx * invD;
        const ny = dy * invD;
        const curl = sampleCurlNoise2D(curX, curY, timeSec + pt.phase * 0.15);

        // Tangential Einstein lensing + fluid swirl
        const lensSpin = (0.35 + heroMotion * 0.85) * falloff;
        const swirlX = (-ny * pt.spinSign * 0.9 + nx * 0.35 + curl.vx * 0.65) * lensSpin;
        const swirlY = (nx * pt.spinSign * 0.9 + ny * 0.35 + curl.vy * 0.65) * lensSpin;

        pt.velX += swirlX;
        pt.velY += swirlY;
      }

      pt.velX = (pt.velX - pt.curlX * 0.11) * 0.84;
      pt.velY = (pt.velY - pt.curlY * 0.11) * 0.84;
      pt.curlX += pt.velX;
      pt.curlY += pt.velY;

      const screenX = restScreenX + pt.curlX;
      const screenY = restScreenY + pt.curlY;
      pt.screenX = screenX;
      pt.screenY = screenY;
      pt.visible = true;

      // Relativistic Doppler beaming: approaching side (x1 < 0) glows bright cyan/white, receding side glows violet
      const dopplerShift = clamp(-x1 / 140, -1, 1);
      const lumBoost = lerp(0.78, pt.portrait.lum, flipT);
      const alpha = clamp(scale * 0.68 * lumBoost + chladniEnergy * 0.18, 0.1, 0.96);
      const radius = clamp(pt.size * scale * (pt.isPhotonRing ? 0.95 : 0.76), 0.8, 4.2);

      let color;
      if (pt.isPhotonRing && singularityPresence > 0.3) {
        color = colors.text;
      } else if (flipT > 0.45 && pt.isPortraitNode) {
        color = pt.portrait.lum > 0.62 ? colors.text : pt.portrait.lum > 0.36 ? colors.cyan : colors.violet;
      } else if (dopplerShift > 0.25) {
        color = dopplerShift > 0.65 ? colors.text : colors.cyan;
      } else if (dopplerShift < -0.25) {
        color = colors.violet;
      } else {
        color = pt.tone === 'accent' ? colors.accent : pt.tone === 'cyan' ? colors.cyan : colors.violet;
      }

      ctx.fillStyle = color;
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.arc(screenX, screenY, radius * 0.55, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw Topographic LiDAR Scanline Filaments (Phase 2) & Lorenz Attractor Streamlines (Phase 1)
    if (assembleT > 0.15) {
      ctx.lineWidth = flipT > 0.5 ? 0.95 : 0.75;
      const gridW = 60;
      const stepStride = flipT > 0.45 ? 1 : 2;
      for (let i = 0; i < this.particles.length - 1; i += stepStride) {
        const a = this.particles[i];
        const b = this.particles[i + 1];
        if (!a.visible || !b.visible) continue;
        if (flipT > 0.45 && (i % gridW === gridW - 1 || !a.isPortraitNode || !b.isPortraitNode)) continue;
        const dist = Math.hypot(b.screenX - a.screenX, b.screenY - a.screenY);
        const maxSeg = flipT > 0.45 ? 24 : 34;
        if (dist < maxSeg) {
          ctx.strokeStyle = i % 2 === 0 ? colors.cyan : colors.violet;
          ctx.globalAlpha = (1 - dist / maxSeg) * (flipT > 0.45 ? a.portrait.lum * 0.42 : 0.26 * assembleT);
          ctx.beginPath();
          ctx.moveTo(a.screenX, a.screenY);
          ctx.lineTo(b.screenX, b.screenY);
          ctx.stroke();
        }
      }
    }

    // Draw Expanding Relativistic Shockwave Rings on Drum Hits / Clicks
    this.shockRings = this.shockRings.filter((ring) => {
      ring.radius += 14 * scaleBase;
      ring.life *= 0.92;
      ctx.strokeStyle = ring.type === 'kick' ? colors.cyan : ring.type === 'rim' ? colors.text : colors.violet;
      ctx.lineWidth = 1.8 * ring.strength;
      ctx.globalAlpha = ring.life * 0.55;
      ctx.beginPath();
      ctx.ellipse(centerX, centerY, ring.radius, ring.radius * 0.62, -0.18, 0, Math.PI * 2);
      ctx.stroke();
      return ring.life > 0.04;
    });

    this.hitPulse.kick *= 0.88;
    this.hitPulse.rim *= 0.88;
    this.hitPulse.hat *= 0.88;
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }
}
