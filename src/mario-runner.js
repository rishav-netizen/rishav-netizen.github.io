function clamp(val, min, max) {
  return Math.min(Math.max(val, min), max);
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

const MUSICAL_GLYPHS = ['♪', '♫', '♬', '♩'];

/**
 * MarioRunnerTrack — Biomechanical Human Runner & Groove Dancer Edition
 * Renders an articulated, human-proportioned Rishav (with bouncing curly hair,
 * glasses glint, athletic singlet/shorts, and 2-segment IK/FK arms & legs)
 * who runs along the scroll track, busts out a drum-groove dance when the beat
 * plays, and leaves a trail of miniature musical notes & harmonic ripples at his footsteps.
 */
export class MarioRunnerTrack {
  constructor(canvas, { readoutEl, onScrub } = {}) {
    this.canvas = canvas;
    this.readoutEl = readoutEl;
    this.onScrub = onScrub;
    if (!this.canvas) return;

    this.ctx = this.canvas.getContext('2d');
    this.progress = 0;
    this.targetProgress = 0;
    this.velocity = 0;
    this.direction = 1; // 1 = right, -1 = left
    this.stridePhase = 0;
    this.dancePhase = 0;
    this.runBlend = 0; // 0 = idle/dance, 1 = running stride
    this.danceEnergy = 0; // 0 -> 1 smoothly decays after beats or stays 1 while sequencer grooves
    this.beatFlash = 0; // 0 -> 1 transient flash on kick/snare/hat
    this.lastBeatType = 'kick';
    this.jumpY = 0;
    this.jumpVy = 0;
    this.hairBounce = 0;
    this.hairVel = 0;
    this.isGrooving = false;
    this.musicTrail = [];
    this.footRipples = [];
    this.lastStepIndex = -1;
    this.width = 320;
    this.height = 86;
    this.dpr = 1;
    this.isDragging = false;
    this.lastTime = 0;

    this.resize();
    this.bind();
    window.addEventListener('resize', () => this.resize(), { passive: true });
  }

  bind() {
    if (!this.canvas) return;

    const scrubFromEvent = (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const pad = 34;
      const usableW = Math.max(rect.width - pad * 2, 1);
      const ratio = clamp((e.clientX - rect.left - pad) / usableW, 0, 1);
      this.onScrub?.(ratio);
    };

    this.canvas.addEventListener('pointerdown', (e) => {
      this.isDragging = true;
      this.triggerBeat('kick', 1.1);
      scrubFromEvent(e);
      try {
        this.canvas.setPointerCapture(e.pointerId);
      } catch {}
    });

    this.canvas.addEventListener('pointermove', (e) => {
      if (!this.isDragging) return;
      scrubFromEvent(e);
    });

    const stopDrag = (e) => {
      if (!this.isDragging) return;
      this.isDragging = false;
      try {
        this.canvas.releasePointerCapture(e.pointerId);
      } catch {}
    };

    this.canvas.addEventListener('pointerup', stopDrag);
    this.canvas.addEventListener('pointercancel', stopDrag);
  }

  resize() {
    if (!this.canvas) return;
    const rect = this.canvas.getBoundingClientRect();
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.width = Math.max(Math.floor(rect.width), 240);
    this.height = Math.max(Math.floor(rect.height), 86);
    this.canvas.width = Math.round(this.width * this.dpr);
    this.canvas.height = Math.round(this.height * this.dpr);
  }

  setScroll({ progress = 0, velocity = 0 } = {}) {
    const clamped = clamp(progress, 0, 1);
    const delta = clamped - this.targetProgress;
    if (Math.abs(delta) > 0.0006) {
      this.direction = delta >= 0 ? 1 : -1;
    }
    this.targetProgress = clamped;
    this.velocity = velocity;

    if (this.readoutEl) {
      const km = (clamped * 10).toFixed(1);
      this.readoutEl.textContent = `${km} KM`;
    }
  }

  setGrooveState(playing) {
    this.isGrooving = Boolean(playing);
    if (this.isGrooving) {
      this.danceEnergy = 1;
    }
  }

  isBeatActive() {
    return this.isGrooving || this.danceEnergy > 0.08 || this.jumpY > 0.5;
  }

  spawnMusicalFootstep(x, y, count = 1, isBeat = false) {
    for (let i = 0; i < count; i += 1) {
      const glyph = MUSICAL_GLYPHS[Math.floor(Math.random() * MUSICAL_GLYPHS.length)];
      this.musicTrail.push({
        x: x - this.direction * (3 + Math.random() * 5) + (Math.random() - 0.5) * 4,
        y: y - 2 - Math.random() * 4,
        vx: -this.direction * (0.45 + Math.random() * 0.75) + (Math.random() - 0.5) * 0.25,
        vy: -0.42 - Math.random() * 0.55 - (isBeat ? 0.25 : 0),
        glyph,
        size: isBeat ? 9.5 + Math.random() * 2.5 : 7.5 + Math.random() * 2,
        phase: Math.random() * Math.PI * 2,
        colorType: (this.musicTrail.length + i) % 3, // 0 = cyan, 1 = violet, 2 = amber
        life: 1,
        decay: isBeat ? 0.022 : 0.03,
      });
    }

    // Add a subtle harmonic ground ring at the foot strike point
    this.footRipples.push({
      x,
      y,
      rx: 2.5,
      maxRx: isBeat ? 14 : 9,
      life: 1,
      colorType: isBeat ? 1 : 0,
    });

    if (this.musicTrail.length > 36) {
      this.musicTrail.splice(0, this.musicTrail.length - 36);
    }
    if (this.footRipples.length > 18) {
      this.footRipples.splice(0, this.footRipples.length - 18);
    }
  }

  triggerBeat(type = 'kick', strength = 1) {
    this.lastBeatType = type;
    this.danceEnergy = 1;
    this.beatFlash = clamp(strength, 0.6, 1.4);
    this.dancePhase += type === 'rim' ? 1.35 : type === 'kick' ? 0.95 : 0.55;

    const pad = 34;
    const roadW = Math.max(this.width - pad * 2, 10);
    const runnerX = pad + this.progress * roadW;
    const groundY = this.height - 12;

    if (type === 'kick') {
      // Controlled hop that never exceeds the top of the canvas
      if (this.jumpY <= 4) {
        this.jumpVy = 2.65 * clamp(strength, 0.75, 1.25);
        this.hairVel -= 2.1;
      }
      this.spawnMusicalFootstep(runnerX, groundY - this.jumpY, 2, true);
    } else if (type === 'rim') {
      // Snare hit: energetic groove pop + twirling drumstick flare
      if (this.jumpY <= 2) {
        this.jumpVy = 1.65 * clamp(strength, 0.7, 1.15);
      }
      this.hairVel -= 1.7;
      this.spawnMusicalFootstep(runnerX, groundY - this.jumpY, 2, true);
    } else {
      // Hi-hat: crisp head nod + single musical note
      this.hairVel -= 0.95;
      this.spawnMusicalFootstep(runnerX, groundY - this.jumpY, 1, true);
    }
  }

  jump(strength = 1, label = '') {
    const type = label.includes('SNARE') ? 'rim' : label.includes('HI-HAT') ? 'hat' : 'kick';
    this.triggerBeat(type, strength);
  }

  getPalette() {
    const root = getComputedStyle(document.documentElement);
    const isLight = document.documentElement.dataset.theme === 'light';
    return {
      isLight,
      accent: root.getPropertyValue('--accent').trim() || '#7dd3fc',
      violet: root.getPropertyValue('--matrix-violet').trim() || '#c084fc',
      bright: root.getPropertyValue('--text-bright').trim() || (isLight ? '#031211' : '#f8fafc'),
      muted: root.getPropertyValue('--muted').trim() || '#64748b',
      amber: '#fbbf24',
    };
  }

  /**
   * Draws an articulated, human-proportioned vector runner & groove dancer of Rishav
   * with 2-segment limb kinematics, beat-synced dance moves, virtual ProMark drumsticks,
   * glasses glint, and spring-bouncing curly hair—always framed inside the canvas.
   */
  drawHumanRunner(ctx, centerX, groundY, phase, runBlend, danceMix, airborne, dir, palette, timeSec) {
    ctx.save();
    ctx.translate(centerX, groundY);

    // Subtle rhythmic hip/body flip or sway when dancing in place
    const danceSwayX = danceMix * (1 - runBlend) * Math.sin(this.dancePhase * 1.5) * 2.2;
    ctx.translate(danceSwayX, 0);
    ctx.scale(dir, 1);

    // High-visibility spotlight aura behind Rishav when beat/groove is active
    if (danceMix > 0.05 || this.beatFlash > 0.05) {
      const auraAlpha = clamp(danceMix * 0.28 + this.beatFlash * 0.25, 0, 0.48);
      const auraGrad = ctx.createRadialGradient(0, -17, 2, 0, -17, 22 + this.beatFlash * 6);
      auraGrad.addColorStop(0, palette.accent);
      auraGrad.addColorStop(0.55, palette.violet);
      auraGrad.addColorStop(1, 'transparent');
      ctx.save();
      ctx.globalAlpha = auraAlpha;
      ctx.fillStyle = auraGrad;
      ctx.beginPath();
      ctx.arc(0, -17, 24 + this.beatFlash * 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Vertical center-of-mass oscillation (running bounce + funky groove knee-drop)
    const grooveBounce = danceMix * Math.abs(Math.sin(this.dancePhase * 2)) * 2.6;
    const verticalBob = airborne
      ? 0
      : Math.abs(Math.sin(phase)) * 2.0 * runBlend +
        Math.sin(timeSec * 3.2) * 0.4 * (1 - runBlend) +
        grooveBounce;

    // Torso lean: forward when sprinting, rhythmic groove rock back-and-forth when dancing
    const danceRock = danceMix * Math.sin(this.dancePhase) * 0.18;
    const torsoLean = lerp(0.05, 0.23, runBlend) + (airborne ? 0.06 : 0) + danceRock;

    // Hip & Shoulder joints in local runner coordinates (ground = y: 0)
    const hipX = 0;
    const hipY = -13.5 - verticalBob;
    const torsoLen = 8.8;
    const shoulderX = hipX + Math.sin(torsoLean) * torsoLen;
    const shoulderY = hipY - Math.cos(torsoLean) * torsoLen;

    // Head center with beat-synced head-nod
    const headNod = danceMix * Math.sin(this.dancePhase * 2) * 1.1;
    const neckX = shoulderX + Math.sin(torsoLean * 0.7) * 2.2 + headNod * 0.45;
    const neckY = shoulderY - 2.2 + Math.abs(headNod) * 0.25;
    const headX = neckX + 0.6;
    const headY = neckY - 3.0;

    const skinColor = '#f1b286';
    const backSkinColor = '#cfa882';
    const singletColor = palette.accent;
    const shortsColor = palette.isLight ? '#0f172a' : '#1e293b';
    const hairDark = palette.isLight ? '#090d16' : '#050811';

    // Helper to compute 2-segment leg kinematics (blends running stride & two-step groove dance)
    const computeLeg = (legPhase, isFront) => {
      const thighLen = 6.6;
      const shinLen = 6.6;

      let thighAngle;
      let kneeBend;

      if (airborne) {
        const isLead = Math.sin(legPhase) >= 0;
        thighAngle = isLead ? 0.82 : -0.52;
        kneeBend = isLead ? 0.7 : 1.25;
      } else {
        const s = Math.sin(legPhase);
        const c = Math.cos(legPhase);
        const runThigh = s * 0.72 + 0.08;
        const recovery = Math.max(0, -c);
        const stanceFlex = Math.max(0, c) * 0.18;
        const runKnee = 0.2 + Math.pow(recovery, 1.25) * 1.45 + stanceFlex;

        // Groove dance two-step: high knee pop + rhythmic heel tap
        const dSin = Math.sin(this.dancePhase + (isFront ? 0 : Math.PI));
        const danceThigh = dSin > 0 ? dSin * 0.68 : dSin * 0.28;
        const danceKnee = dSin > 0 ? dSin * 1.15 + 0.15 : 0.18;

        const activeBlend = Math.max(runBlend, danceMix);
        const baseThigh = lerp(danceThigh, runThigh, runBlend);
        const baseKnee = lerp(danceKnee, runKnee, runBlend);

        thighAngle = lerp(isFront ? 0.06 : -0.04, baseThigh, activeBlend);
        kneeBend = lerp(0.08, baseKnee, activeBlend);
      }

      const kneeX = hipX + Math.sin(thighAngle) * thighLen;
      const kneeY = hipY + Math.cos(thighAngle) * thighLen;

      const shinAngle = thighAngle - kneeBend;
      const ankleX = kneeX + Math.sin(shinAngle) * shinLen;
      const ankleY = Math.min(-0.8, kneeY + Math.cos(shinAngle) * shinLen);

      const footAngle = shinAngle + 0.25 + danceMix * Math.sin(this.dancePhase * 2) * 0.15;
      return { kneeX, kneeY, ankleX, ankleY, footAngle, thighAngle };
    };

    // Helper to compute 2-segment arm kinematics (blends running pump & air-drumming groove dance)
    const computeArm = (armPhase, isFront) => {
      const upperLen = 4.8;
      const foreLen = 4.6;
      const s = Math.sin(armPhase);

      const runUpper = airborne ? (s >= 0 ? 1.1 : -0.6) : s * 0.78 + 0.05;
      const runElbow = 1.35 + s * 0.28;

      // Dance / Air-Drum arm choreography: arms raise up and strike on the beat!
      const dWave = Math.sin(this.dancePhase * 2 + (isFront ? 0 : Math.PI * 0.65));
      const danceUpper = 0.55 + dWave * 0.65;
      const danceElbow = 1.45 + Math.cos(this.dancePhase * 2 + (isFront ? 0.4 : -0.4)) * 0.55;

      const activeBlend = Math.max(runBlend, danceMix);
      const targetUpper = lerp(danceUpper, runUpper, runBlend * 0.65);
      const targetElbow = lerp(danceElbow, runElbow, runBlend * 0.65);

      const upperAngle = lerp(isFront ? 0.04 : -0.06, targetUpper, activeBlend);
      const elbowBend = lerp(0.35, targetElbow, activeBlend);

      const elbowX = shoulderX + Math.sin(upperAngle) * upperLen;
      const elbowY = shoulderY + Math.cos(upperAngle) * upperLen;

      const foreAngle = upperAngle + elbowBend;
      const handX = elbowX + Math.sin(foreAngle) * foreLen;
      const handY = elbowY + Math.cos(foreAngle) * foreLen;

      return { elbowX, elbowY, handX, handY, foreAngle };
    };

    const backLeg = computeLeg(phase + Math.PI, false);
    const frontLeg = computeLeg(phase, true);
    const backArm = computeArm(phase, false);
    const frontArm = computeArm(phase + Math.PI, true);

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Subtle dark halo under-stroke so Rishav pops crisply on both dark and light themes
    ctx.shadowColor = palette.isLight ? 'rgba(3, 18, 17, 0.25)' : 'rgba(0, 240, 255, 0.45)';
    ctx.shadowBlur = danceMix > 0.1 ? 6 : 3;

    // ========================================================================
    // 1. BACK ARM (Behind torso)
    // ========================================================================
    ctx.strokeStyle = backSkinColor;
    ctx.lineWidth = 2.1;
    ctx.beginPath();
    ctx.moveTo(shoulderX, shoulderY + 0.5);
    ctx.lineTo(backArm.elbowX, backArm.elbowY);
    ctx.lineTo(backArm.handX, backArm.handY);
    ctx.stroke();

    // ========================================================================
    // 2. BACK LEG & RUNNING SHOE
    // ========================================================================
    ctx.strokeStyle = backSkinColor;
    ctx.lineWidth = 2.3;
    ctx.beginPath();
    ctx.moveTo(backLeg.kneeX, backLeg.kneeY);
    ctx.lineTo(backLeg.ankleX, backLeg.ankleY);
    ctx.stroke();

    ctx.strokeStyle = backSkinColor;
    ctx.lineWidth = 2.9;
    ctx.beginPath();
    ctx.moveTo(hipX, hipY);
    ctx.lineTo(backLeg.kneeX, backLeg.kneeY);
    ctx.stroke();

    ctx.save();
    ctx.translate(backLeg.ankleX, backLeg.ankleY);
    ctx.rotate(clamp(backLeg.footAngle * 0.4, -0.5, 0.5));
    ctx.fillStyle = palette.violet;
    ctx.beginPath();
    ctx.roundRect(-1.5, -1.1, 4.6, 2.3, 1);
    ctx.fill();
    ctx.restore();

    // ========================================================================
    // 3. TORSO & RUNNING SHORTS
    // ========================================================================
    ctx.strokeStyle = singletColor;
    ctx.lineWidth = 4.6;
    ctx.beginPath();
    ctx.moveTo(hipX, hipY);
    ctx.lineTo(shoulderX, shoulderY);
    ctx.stroke();

    ctx.strokeStyle = palette.violet;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(lerp(hipX, shoulderX, 0.28), lerp(hipY, shoulderY, 0.28));
    ctx.lineTo(lerp(hipX, shoulderX, 0.74), lerp(hipY, shoulderY, 0.74));
    ctx.stroke();

    ctx.strokeStyle = shortsColor;
    ctx.lineWidth = 4.7;
    ctx.beginPath();
    ctx.moveTo(hipX, hipY - 0.5);
    ctx.lineTo(lerp(hipX, frontLeg.kneeX, 0.48), lerp(hipY, frontLeg.kneeY, 0.48));
    ctx.moveTo(hipX, hipY - 0.5);
    ctx.lineTo(lerp(hipX, backLeg.kneeX, 0.45), lerp(hipY, backLeg.kneeY, 0.45));
    ctx.stroke();

    // ========================================================================
    // 4. FRONT LEG & RUNNING SHOE
    // ========================================================================
    ctx.strokeStyle = skinColor;
    ctx.lineWidth = 3.0;
    ctx.beginPath();
    ctx.moveTo(lerp(hipX, frontLeg.kneeX, 0.42), lerp(hipY, frontLeg.kneeY, 0.42));
    ctx.lineTo(frontLeg.kneeX, frontLeg.kneeY);
    ctx.stroke();

    ctx.strokeStyle = skinColor;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(frontLeg.kneeX, frontLeg.kneeY);
    ctx.lineTo(frontLeg.ankleX, frontLeg.ankleY);
    ctx.stroke();

    ctx.save();
    ctx.translate(frontLeg.ankleX, frontLeg.ankleY);
    ctx.rotate(clamp(frontLeg.footAngle * 0.45, -0.55, 0.55));
    ctx.fillStyle = '#f8fafc';
    ctx.beginPath();
    ctx.roundRect(-1.5, -1.1, 4.9, 2.4, 1.1);
    ctx.fill();
    ctx.fillStyle = palette.accent;
    ctx.fillRect(-1.4, 0.6, 4.7, 0.85);
    ctx.restore();

    // ========================================================================
    // 5. HEAD, GLASSES & BOUNCING CURLY HAIR (Rishav's signature silhouette)
    // ========================================================================
    ctx.strokeStyle = skinColor;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(shoulderX, shoulderY);
    ctx.lineTo(headX - 0.4, headY + 1.5);
    ctx.stroke();

    ctx.fillStyle = skinColor;
    ctx.beginPath();
    ctx.arc(headX, headY, 3.2, 0, Math.PI * 2);
    ctx.fill();

    // Glasses frame & beat-reactive cyan/amber lens glint
    ctx.strokeStyle = '#f8fafc';
    ctx.lineWidth = 1.0;
    ctx.beginPath();
    ctx.moveTo(headX + 0.2, headY - 0.5);
    ctx.lineTo(headX + 3.4, headY - 0.4);
    ctx.stroke();
    ctx.fillStyle = this.beatFlash > 0.35 ? palette.amber : palette.accent;
    ctx.fillRect(headX + 1.7, headY - 1.1, 1.7, 1.45);

    // Bouncing helical curly hair locks with spring physics (clamped so it never clips)
    const curlLift = clamp(this.hairBounce, -1.8, 1.8);
    const curlPuffs = [
      { ox: -2.2, oy: -1.8 + curlLift * 0.65, r: 2.15 },
      { ox: -0.8, oy: -2.9 + curlLift * 0.85, r: 2.35 },
      { ox: 1.0, oy: -2.8 + curlLift * 0.55, r: 2.15 },
      { ox: 2.3, oy: -1.9 + curlLift * 0.4, r: 1.75 },
      { ox: -2.8, oy: -0.2 + curlLift * 0.75, r: 1.85 },
    ];

    ctx.fillStyle = this.beatFlash > 0.3 ? palette.accent : palette.violet;
    curlPuffs.forEach((c) => {
      ctx.beginPath();
      ctx.arc(headX + c.ox - 0.3, headY + c.oy - 0.3, c.r + 0.5, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.fillStyle = hairDark;
    curlPuffs.forEach((c) => {
      ctx.beginPath();
      ctx.arc(headX + c.ox, headY + c.oy, c.r, 0, Math.PI * 2);
      ctx.fill();
    });

    // ========================================================================
    // 6. FRONT ARM & VIRTUAL PROMARK DRUMSTICKS WHEN GROOVING
    // ========================================================================
    ctx.strokeStyle = skinColor;
    ctx.lineWidth = 2.3;
    ctx.beginPath();
    ctx.moveTo(shoulderX, shoulderY + 0.4);
    ctx.lineTo(frontArm.elbowX, frontArm.elbowY);
    ctx.lineTo(frontArm.handX, frontArm.handY);
    ctx.stroke();

    // When dancing to the beat, draw glowing ProMark drumsticks in Rishav's hands!
    if (danceMix > 0.15) {
      ctx.save();
      ctx.globalAlpha = clamp(danceMix * 1.1, 0, 1);
      ctx.strokeStyle = palette.amber;
      ctx.lineWidth = 1.25;

      const stickAngle1 = frontArm.foreAngle - 0.35 + Math.sin(this.dancePhase * 4) * 0.45;
      ctx.beginPath();
      ctx.moveTo(frontArm.handX, frontArm.handY);
      ctx.lineTo(
        frontArm.handX + Math.sin(stickAngle1) * 5.2,
        frontArm.handY + Math.cos(stickAngle1) * 5.2
      );
      ctx.stroke();

      const stickAngle2 = backArm.foreAngle - 0.25 - Math.sin(this.dancePhase * 4) * 0.45;
      ctx.strokeStyle = palette.accent;
      ctx.beginPath();
      ctx.moveTo(backArm.handX, backArm.handY);
      ctx.lineTo(
        backArm.handX + Math.sin(stickAngle2) * 4.8,
        backArm.handY + Math.cos(stickAngle2) * 4.8
      );
      ctx.stroke();
      ctx.restore();
    }

    ctx.restore();
  }

  render(timeMs) {
    if (!this.ctx || !this.canvas) return;
    if (Math.abs(this.canvas.clientWidth - this.width) > 4 && this.canvas.clientWidth > 0) {
      this.resize();
    }

    const dt = this.lastTime ? clamp((timeMs - this.lastTime) / 16.67, 0.4, 2.2) : 1;
    this.lastTime = timeMs;

    const ctx = this.ctx;
    const palette = this.getPalette();
    const timeSec = timeMs * 0.001;

    const prevProgress = this.progress;
    this.progress += (this.targetProgress - this.progress) * 0.16;
    const progressDelta = Math.abs(this.progress - prevProgress);
    const speed = progressDelta * 1400 + Math.abs(this.velocity) * 0.14;

    // Smooth blend for running vs beat-dancing
    const targetRunBlend = speed > 0.12 ? 1 : 0;
    this.runBlend += (targetRunBlend - this.runBlend) * 0.18;

    if (this.isGrooving) {
      this.danceEnergy = lerp(this.danceEnergy, 1, 0.15);
      this.dancePhase += 0.18 * dt;
    } else {
      this.danceEnergy = Math.max(0, this.danceEnergy - 0.018 * dt);
      if (this.danceEnergy > 0.02) {
        this.dancePhase += 0.14 * dt * this.danceEnergy;
      }
    }
    this.beatFlash = Math.max(0, this.beatFlash - 0.06 * dt);

    const pad = 34;
    const roadLeft = pad;
    const roadRight = this.width - pad;
    const roadW = Math.max(roadRight - roadLeft, 10);
    const groundY = this.height - 12;
    const runnerX = roadLeft + this.progress * roadW;

    // Advance biomechanical stride cycle & spawn musical notes on every footstep!
    if (speed > 0.08 || this.isGrooving) {
      const stepIncrement = speed > 0.08 ? clamp(progressDelta * 260 + 0.16, 0.15, 0.42) : 0.21;
      this.stridePhase += stepIncrement * dt;

      // Each half-cycle (Math.PI) is one foot strike on the road
      const currentStepIndex = Math.floor(this.stridePhase / Math.PI);
      if (currentStepIndex !== this.lastStepIndex) {
        this.lastStepIndex = currentStepIndex;
        if (this.jumpY < 3) {
          this.spawnMusicalFootstep(runnerX, groundY, 1, false);
        }
      }
    }

    // Update jump & curly hair spring physics — strictly clamped so head/curls never clip top of canvas!
    const maxSafeJump = Math.max(10, groundY - 44);
    if (this.jumpY > 0 || this.jumpVy !== 0) {
      this.jumpY = clamp(this.jumpY + this.jumpVy * dt, 0, maxSafeJump);
      this.jumpVy -= 0.32 * dt;
      if (this.jumpY <= 0) {
        this.jumpY = 0;
        this.jumpVy = 0;
        this.hairVel += 1.3;
      }
    }

    const strideImpulse =
      Math.sin(this.stridePhase * 2) * 0.32 * this.runBlend +
      this.danceEnergy * Math.sin(this.dancePhase * 2) * 0.45;
    this.hairVel = (this.hairVel + (strideImpulse - this.hairBounce) * 0.28) * 0.76;
    this.hairBounce = clamp(this.hairBounce + this.hairVel, -1.8, 1.8);

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.width, this.height);

    // 1. Clean Open Road Track & Completed Trail Glow
    ctx.strokeStyle = palette.isLight ? 'rgba(3, 18, 17, 0.18)' : 'rgba(255, 255, 255, 0.16)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(roadLeft, groundY);
    ctx.lineTo(roadRight, groundY);
    ctx.stroke();

    // Subtle distance tick marks along the track
    [0, 0.25, 0.5, 0.75, 1].forEach((tick) => {
      const tx = roadLeft + tick * roadW;
      const passed = this.progress >= tick - 0.005;
      ctx.fillStyle = passed ? palette.accent : palette.muted;
      ctx.globalAlpha = passed ? 0.85 : 0.3;
      ctx.fillRect(Math.round(tx - 0.5), groundY - 3, 1.5, 4);
    });
    ctx.globalAlpha = 1;

    // Glowing completed distance trail behind Rishav
    if (runnerX > roadLeft + 1) {
      const grad = ctx.createLinearGradient(roadLeft, 0, runnerX, 0);
      grad.addColorStop(0, palette.violet);
      grad.addColorStop(1, palette.accent);
      ctx.strokeStyle = grad;
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.moveTo(roadLeft, groundY);
      ctx.lineTo(runnerX, groundY);
      ctx.stroke();
    }

    // 2. Acoustic Footstep Ground Ripples
    for (let i = this.footRipples.length - 1; i >= 0; i -= 1) {
      const rp = this.footRipples[i];
      rp.rx = lerp(rp.rx, rp.maxRx, 0.14 * dt);
      rp.life -= 0.055 * dt;
      if (rp.life <= 0) {
        this.footRipples.splice(i, 1);
        continue;
      }
      ctx.save();
      ctx.strokeStyle = rp.colorType === 1 ? palette.violet : palette.accent;
      ctx.globalAlpha = rp.life * 0.55;
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.ellipse(rp.x, rp.y + 0.5, rp.rx, Math.max(1, rp.rx * 0.24), 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // 3. Little Musical Footstep Note Trail (♪ ♫ ♬ ♩)
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let i = this.musicTrail.length - 1; i >= 0; i -= 1) {
      const m = this.musicTrail[i];
      m.x += m.vx * dt + Math.sin(timeSec * 5 + m.phase) * 0.18;
      m.y += m.vy * dt;
      m.life -= m.decay * dt;
      if (m.life <= 0 || m.y < 6) {
        this.musicTrail.splice(i, 1);
        continue;
      }
      const noteColor =
        m.colorType === 0 ? palette.accent : m.colorType === 1 ? palette.violet : palette.amber;
      ctx.fillStyle = noteColor;
      ctx.shadowColor = noteColor;
      ctx.shadowBlur = 6;
      ctx.globalAlpha = clamp(m.life * 1.15, 0, 0.92);
      ctx.font = `700 ${m.size.toFixed(1)}px "JetBrains Mono", sans-serif`;
      ctx.fillText(m.glyph, m.x, m.y);
    }
    ctx.restore();

    // 4. Beat-Reactive Ground Equalizer Shadow directly under Rishav
    const shadowScale = clamp(1 - this.jumpY / 24, 0.35, 1) * (1 + this.beatFlash * 0.35);
    ctx.fillStyle = this.beatFlash > 0.25 ? palette.violet : palette.accent;
    ctx.globalAlpha = 0.34 * shadowScale;
    ctx.beginPath();
    ctx.ellipse(runnerX, groundY + 0.5, 7.5 * shadowScale, 1.7 * shadowScale, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // 5. Draw Human-Proportioned Running & Dancing Rishav
    this.drawHumanRunner(
      ctx,
      runnerX,
      groundY - this.jumpY,
      this.stridePhase,
      this.runBlend,
      this.danceEnergy,
      this.jumpY > 2,
      this.direction,
      palette,
      timeSec
    );
  }
}

/**
 * Interactive Shimla (2,276m) -> IIIT-Bh (45m) & 5K/10K Pace Telemetry Trace
 */
export class ElevationPaceTrace {
  constructor(canvas) {
    this.canvas = canvas;
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');
    this.hoverRatio = 0.5;
    this.isHovered = false;
    this.width = 320;
    this.height = 96;
    this.dpr = 1;

    this.resize();
    this.bind();
    window.addEventListener('resize', () => this.resize(), { passive: true });
  }

  bind() {
    if (!this.canvas) return;
    this.canvas.addEventListener('pointermove', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      this.hoverRatio = clamp((e.clientX - rect.left) / Math.max(rect.width, 1), 0, 1);
      this.isHovered = true;
    });
    this.canvas.addEventListener('pointerleave', () => {
      this.isHovered = false;
    });
  }

  resize() {
    if (!this.canvas) return;
    const rect = this.canvas.getBoundingClientRect();
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.width = Math.max(Math.floor(rect.width), 240);
    this.height = Math.max(Math.floor(rect.height), 88);
    this.canvas.width = Math.round(this.width * this.dpr);
    this.canvas.height = Math.round(this.height * this.dpr);
  }

  sampleElevation(t) {
    const decay = Math.pow(1 - t, 1.65);
    const ridges = Math.sin(t * Math.PI * 5) * 0.11 * (1 - t * 0.7) + Math.cos(t * Math.PI * 11) * 0.04;
    return clamp(0.14 + decay * 0.72 + ridges, 0.1, 0.92);
  }

  render(timeMs) {
    if (!this.ctx || !this.canvas) return;
    if (Math.abs(this.canvas.clientWidth - this.width) > 4 && this.canvas.clientWidth > 0) {
      this.resize();
    }

    const ctx = this.ctx;
    const timeSec = timeMs * 0.001;
    const root = getComputedStyle(document.documentElement);
    const isLight = document.documentElement.dataset.theme === 'light';
    const accent = root.getPropertyValue('--accent').trim() || '#7dd3fc';
    const violet = root.getPropertyValue('--matrix-violet').trim() || '#c084fc';
    const bright = root.getPropertyValue('--text-bright').trim() || (isLight ? '#031211' : '#f8fafc');

    if (!this.isHovered) {
      this.hoverRatio = 0.5 + Math.sin(timeSec * 0.85) * 0.38;
    }

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.width, this.height);

    const padX = 10;
    const topY = 22;
    const botY = this.height - 16;
    const usableW = this.width - padX * 2;
    const usableH = botY - topY;

    ctx.beginPath();
    const steps = 64;
    for (let i = 0; i <= steps; i += 1) {
      const t = i / steps;
      const x = padX + t * usableW;
      const elev = this.sampleElevation(t);
      const y = botY - elev * usableH;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = accent;
    ctx.lineWidth = 1.8;
    ctx.stroke();

    ctx.lineTo(padX + usableW, botY);
    ctx.lineTo(padX, botY);
    ctx.closePath();
    const fillGrad = ctx.createLinearGradient(0, topY, 0, botY);
    fillGrad.addColorStop(0, `${accent}33`);
    fillGrad.addColorStop(1, `${violet}05`);
    ctx.fillStyle = fillGrad;
    ctx.fill();

    [
      { t: 0.0, label: 'SHIMLA 2,276M' },
      { t: 0.5, label: '5K PR · 27:58' },
      { t: 1.0, label: '10K PR · 1:02' },
    ].forEach((cp) => {
      const cx = padX + cp.t * usableW;
      const cy = botY - this.sampleElevation(cp.t) * usableH;
      ctx.fillStyle = cp.t === 0.5 ? violet : accent;
      ctx.beginPath();
      ctx.arc(cx, cy, 3, 0, Math.PI * 2);
      ctx.fill();
    });

    const scrubX = padX + this.hoverRatio * usableW;
    const scrubY = botY - this.sampleElevation(this.hoverRatio) * usableH;

    ctx.strokeStyle = violet;
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 3]);
    ctx.beginPath();
    ctx.moveTo(scrubX, topY - 4);
    ctx.lineTo(scrubX, botY);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = bright;
    ctx.beginPath();
    ctx.arc(scrubX, scrubY, 4, 0, Math.PI * 2);
    ctx.fill();

    const km = (this.hoverRatio * 10).toFixed(1);
    const elevMeters = Math.round(lerp(2276, 45, Math.pow(this.hoverRatio, 0.75)));
    const paceStr = this.hoverRatio <= 0.52 ? '5:35 /KM (5K PR)' : '6:12 /KM (10K PR)';

    ctx.font = '600 8.5px "JetBrains Mono", monospace';
    ctx.fillStyle = accent;
    ctx.textAlign = 'left';
    ctx.fillText(`DIST: ${km} KM // ELEV: ${elevMeters}M`, padX, 12);
    ctx.fillStyle = bright;
    ctx.textAlign = 'right';
    ctx.fillText(`${paceStr} · 176 SPM`, this.width - padX, 12);
  }
}
