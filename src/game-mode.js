/**
 * MINI ARCADE // NIGHT RUN & STUDIO DRUM PAD
 * ------------------------------------------
 * Rich, atmospheric twilight mountain runner (inspired by Alto's Odyssey)
 * and tactile analog studio drum highway (inspired by Teenage Engineering / Push)
 * with physical 3D keycap tutorials—zero neon cyberpunk slop, zero flat blandness.
 */

export class CadenceArcade {
  constructor({ soundEngine }) {
    this.soundEngine = soundEngine;
    this.modal = document.getElementById('game-mode-modal');
    this.backdrop = document.getElementById('game-mode-backdrop');
    this.canvas = document.getElementById('arcade-canvas');
    this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
    this.W = 820;
    this.H = 360;
    this.dpr = 1;

    this.scoreEl = document.getElementById('arcade-score');
    this.hiScoreEl = document.getElementById('arcade-hiscore');
    this.comboEl = document.getElementById('arcade-combo');
    this.paceEl = document.getElementById('arcade-metric');
    this.statusBannerEl = document.getElementById('arcade-status-banner');

    this.isOpen = false;
    this.mode = 'runner'; // 'runner' | 'rhythm'
    this.rafId = null;
    this.lastTime = 0;
    this.visualTime = 0;

    this.hiScores = {
      runner: Number(localStorage.getItem('cadence-runner-hi') || 0),
      rhythm: Number(localStorage.getItem('cadence-rhythm-hi') || 0),
    };

    this.stars = Array.from({ length: 42 }, (_, i) => ({
      x: (i * 197) % 820,
      y: 16 + ((i * 73) % 165),
      r: 0.8 + (i % 3) * 0.5,
      phase: i * 0.9,
      speed: 6 + (i % 4) * 4,
    }));

    this.runner = this.createRunnerState();
    this.rhythm = this.createRhythmState();

    this.setupHighDPI();
    this.bindUI();
    this.updateHUD();
  }

  createRunnerState() {
    return {
      state: 'tutorial', // 'tutorial' | 'playing' | 'gameover'
      score: 0,
      distanceKm: 0,
      combo: 1,
      speed: 360,
      groundY: 308,
      player: {
        x: 138,
        y: 308,
        vy: 0,
        jumpsUsed: 0,
        maxJumps: 2,
        crouching: false,
        phase: 0,
        flipAngle: 0,
        shockwaveCooldown: 0,
        invulnerable: 0,
        scarfPts: Array.from({ length: 7 }, (_, i) => ({ x: 138 - i * 6, y: 274 })),
      },
      obstacles: [],
      orbs: [],
      particles: [],
      rings: [],
      shockwaves: [],
      spawnTimer: 0.85,
      orbTimer: 1.2,
      bgScroll: 0,
    };
  }

  createRhythmState() {
    return {
      state: 'tutorial', // 'tutorial' | 'playing' | 'gameover'
      score: 0,
      combo: 0,
      maxCombo: 0,
      hits: 0,
      misses: 0,
      bpm: 112,
      songTime: 0,
      nextBeatIndex: 0,
      notes: [],
      laneFlashes: [0, 0, 0],
      hitRipples: [],
      feedback: null,
      particles: [],
    };
  }

  setupHighDPI() {
    if (!this.canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    if (this.dpr !== dpr || this.canvas.width !== Math.round(this.W * dpr)) {
      this.dpr = dpr;
      this.canvas.width = Math.round(this.W * dpr);
      this.canvas.height = Math.round(this.H * dpr);
    }
  }

  bindUI() {
    if (!this.modal) return;

    window.addEventListener('resize', () => this.setupHighDPI(), { passive: true });

    this.modal.querySelectorAll('[data-arcade-mode]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const targetMode = btn.dataset.arcadeMode;
        if (targetMode && targetMode !== this.mode) {
          this.setMode(targetMode);
        }
      });
    });

    this.modal.querySelectorAll('[data-arcade-action]').forEach((btn) => {
      const trigger = (e) => {
        e.preventDefault();
        const action = btn.dataset.arcadeAction;
        this.handleAction(action, true);
      };
      btn.addEventListener('mousedown', trigger);
      btn.addEventListener('touchstart', trigger, { passive: false });

      const release = () => {
        const action = btn.dataset.arcadeAction;
        if (action === 'crouch') {
          this.handleAction('crouch', false);
        }
      };
      btn.addEventListener('mouseup', release);
      btn.addEventListener('mouseleave', release);
      btn.addEventListener('touchend', release);
    });

    if (this.canvas) {
      this.canvas.addEventListener('pointerdown', (e) => {
        const rect = this.canvas.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * this.W;
        const y = ((e.clientY - rect.top) / rect.height) * this.H;

        if (this.mode === 'runner') {
          if (this.runner.state !== 'playing') {
            this.startGame();
          } else if (x > this.W * 0.68) {
            this.handleAction('shockwave', true);
          } else if (y > this.H * 0.72) {
            this.handleAction('crouch', true);
            setTimeout(() => this.handleAction('crouch', false), 340);
          } else {
            this.handleAction('jump', true);
          }
        } else if (this.rhythm.state !== 'playing') {
          this.startGame();
        } else {
          const lane = Math.min(2, Math.max(0, Math.floor((x / this.W) * 3)));
          this.triggerRhythmLane(lane);
        }
      });
    }
  }

  setMode(mode) {
    this.mode = mode;
    this.modal?.querySelectorAll('[data-arcade-mode]').forEach((btn) => {
      const active = btn.dataset.arcadeMode === mode;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-selected', String(active));
    });

    const runnerControls = document.getElementById('arcade-controls-runner');
    const rhythmControls = document.getElementById('arcade-controls-rhythm');
    if (runnerControls && rhythmControls) {
      runnerControls.hidden = mode !== 'runner';
      rhythmControls.hidden = mode !== 'rhythm';
    }

    this.soundEngine?.playHat?.();
    this.showTutorial();
  }

  showTutorial() {
    if (this.mode === 'runner') {
      this.runner = this.createRunnerState();
      this.runner.state = 'tutorial';
    } else {
      this.rhythm = this.createRhythmState();
      this.rhythm.state = 'tutorial';
    }
    this.updateHUD();
  }

  open() {
    if (!this.modal) return;
    this.setupHighDPI();
    this.isOpen = true;
    this.modal.classList.add('is-open');
    this.modal.setAttribute('aria-hidden', 'false');
    this.backdrop?.classList.add('is-open');
    this.backdrop?.setAttribute('aria-hidden', 'false');

    const navBtn = document.getElementById('game-mode-btn');
    navBtn?.setAttribute('aria-expanded', 'true');
    navBtn?.classList.add('active');

    if (
      (this.mode === 'runner' && this.runner.state !== 'playing') ||
      (this.mode === 'rhythm' && this.rhythm.state !== 'playing')
    ) {
      this.showTutorial();
    }

    this.lastTime = performance.now();
    if (!this.rafId) {
      this.loop(this.lastTime);
    }
  }

  close() {
    if (!this.modal) return;
    this.isOpen = false;
    this.modal.classList.remove('is-open');
    this.modal.setAttribute('aria-hidden', 'true');
    this.backdrop?.classList.remove('is-open');
    this.backdrop?.setAttribute('aria-hidden', 'true');

    const navBtn = document.getElementById('game-mode-btn');
    navBtn?.setAttribute('aria-expanded', 'false');
    navBtn?.classList.remove('active');

    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  startGame() {
    if (this.mode === 'runner') {
      this.runner = this.createRunnerState();
      this.runner.state = 'playing';
    } else {
      this.rhythm = this.createRhythmState();
      this.rhythm.state = 'playing';
    }
    this.soundEngine?.playKick?.();
    this.updateHUD();
  }

  handleKeyDown(e) {
    if (!this.isOpen) return false;

    if (e.code === 'KeyR') {
      e.preventDefault();
      this.startGame();
      return true;
    }

    if (e.code === 'Digit1') {
      e.preventDefault();
      this.setMode('runner');
      return true;
    }
    if (e.code === 'Digit2') {
      e.preventDefault();
      this.setMode('rhythm');
      return true;
    }

    if (this.mode === 'runner') {
      if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW' || e.code === 'Enter') {
        e.preventDefault();
        if (this.runner.state !== 'playing') {
          this.startGame();
        } else {
          this.handleAction('jump', true);
        }
        return true;
      }
      if (e.code === 'ArrowDown' || e.code === 'KeyS') {
        e.preventDefault();
        if (this.runner.state === 'playing') {
          this.handleAction('crouch', true);
        }
        return true;
      }
      if (e.code === 'KeyJ' || e.code === 'KeyK' || e.code === 'KeyF') {
        e.preventDefault();
        if (this.runner.state !== 'playing') {
          this.startGame();
        } else {
          this.handleAction('shockwave', true);
        }
        return true;
      }
    } else {
      if (e.code === 'Space' || e.code === 'KeyD' || e.code === 'ArrowLeft' || e.code === 'Enter') {
        e.preventDefault();
        if (this.rhythm.state !== 'playing') this.startGame();
        else this.triggerRhythmLane(0);
        return true;
      }
      if (
        e.code === 'KeyJ' ||
        e.code === 'KeyF' ||
        e.code === 'ArrowDown' ||
        e.code === 'ArrowUp'
      ) {
        e.preventDefault();
        if (this.rhythm.state !== 'playing') this.startGame();
        else this.triggerRhythmLane(1);
        return true;
      }
      if (e.code === 'KeyK' || e.code === 'ArrowRight') {
        e.preventDefault();
        if (this.rhythm.state !== 'playing') this.startGame();
        else this.triggerRhythmLane(2);
        return true;
      }
    }

    return false;
  }

  handleKeyUp(e) {
    if (!this.isOpen) return false;
    if (this.mode === 'runner' && (e.code === 'ArrowDown' || e.code === 'KeyS')) {
      this.handleAction('crouch', false);
      return true;
    }
    return false;
  }

  handleAction(action, pressed = true) {
    if (action === 'restart') {
      this.startGame();
      return;
    }

    if (this.mode === 'runner') {
      const r = this.runner;
      if (r.state !== 'playing') {
        if (pressed) this.startGame();
        return;
      }
      const p = r.player;

      if (action === 'jump' && pressed) {
        if (p.jumpsUsed < p.maxJumps) {
          p.vy = p.jumpsUsed === 0 ? -575 : -500;
          p.jumpsUsed += 1;
          p.crouching = false;
          if (p.jumpsUsed === 1) {
            this.soundEngine?.playKick?.();
            this.spawnParticles(p.x - 4, r.groundY, '#f59e0b', 7);
          } else {
            this.soundEngine?.playHat?.();
            p.flipAngle = 0.01;
            r.rings.push({ x: p.x, y: p.y - 18, r: 6, maxR: 34, color: '#fbbf24', alpha: 0.9 });
            this.spawnParticles(p.x, p.y - 12, '#fde68a', 10);
          }
        }
      } else if (action === 'crouch') {
        p.crouching = pressed;
        if (pressed && p.y < r.groundY) {
          p.vy = Math.max(p.vy, 560);
        }
      } else if (action === 'shockwave' && pressed) {
        if (p.shockwaveCooldown <= 0) {
          p.shockwaveCooldown = 0.6;
          this.soundEngine?.playRim?.();
          r.shockwaves.push({
            x: p.x + 22,
            y: p.y - (p.crouching ? 18 : 32),
            radius: 14,
            maxRadius: 185,
            alpha: 1,
          });
          r.obstacles.forEach((obs) => {
            if (
              !obs.destroyed &&
              obs.type === 'drone' &&
              obs.x > p.x - 24 &&
              obs.x < p.x + 260
            ) {
              obs.destroyed = true;
              r.score += 75 * r.combo;
              r.combo = Math.min(16, r.combo + 1);
              r.rings.push({
                x: obs.x + obs.w / 2,
                y: obs.y + obs.h / 2,
                r: 8,
                maxR: 48,
                color: '#f59e0b',
                alpha: 1,
              });
              this.spawnParticles(obs.x + obs.w / 2, obs.y + obs.h / 2, '#f59e0b', 18);
            }
          });
        }
      }
    } else {
      if (this.rhythm.state !== 'playing') {
        if (pressed) this.startGame();
        return;
      }
      if (!pressed) return;
      if (action === 'lane-0') this.triggerRhythmLane(0);
      if (action === 'lane-1') this.triggerRhythmLane(1);
      if (action === 'lane-2') this.triggerRhythmLane(2);
    }
  }

  spawnParticles(x, y, color, count = 12) {
    const target = this.mode === 'runner' ? this.runner.particles : this.rhythm.particles;
    for (let i = 0; i < count; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 55 + Math.random() * 185;
      target.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 35,
        color,
        size: 2 + Math.random() * 2.5,
        life: 0.42 + Math.random() * 0.32,
      });
    }
  }

  loop(now) {
    if (!this.isOpen) return;
    const dt = Math.min(0.05, Math.max(0.001, (now - this.lastTime) / 1000));
    this.lastTime = now;
    this.visualTime += dt;

    if (this.mode === 'runner') {
      this.updateRunner(dt);
      this.renderRunner();
    } else {
      this.updateRhythm(dt);
      this.renderRhythm();
    }

    this.updateHUD();
    this.rafId = requestAnimationFrame((t) => this.loop(t));
  }

  updateScarf(p, dt, speed) {
    const crouch = p.crouching;
    const hipY = crouch ? p.y - 16 : p.y - 26;
    const shoulderX = p.x + (crouch ? 10 : 6);
    const shoulderY = crouch ? hipY - 12 : hipY - 18;
    const anchorX = shoulderX - 3;
    const anchorY = shoulderY + 2;

    p.scarfPts[0].x = anchorX;
    p.scarfPts[0].y = anchorY;

    for (let i = 1; i < p.scarfPts.length; i += 1) {
      const prev = p.scarfPts[i - 1];
      const cur = p.scarfPts[i];
      const targetX = prev.x - (5.2 + (speed / 360) * 1.4);
      const waveY =
        Math.sin(this.visualTime * 11 - i * 0.85) * (1.8 + i * 0.45) +
        (p.vy < 0 ? 2.2 : p.vy > 80 ? -2.2 : 0);
      const targetY = prev.y + waveY * 0.35;
      cur.x += (targetX - cur.x) * Math.min(1, dt * 22);
      cur.y += (targetY - cur.y) * Math.min(1, dt * 18);
    }
  }

  updateRunner(dt) {
    const r = this.runner;
    if (r.state === 'tutorial') {
      r.bgScroll = (r.bgScroll + 150 * dt) % 1640;
      r.player.phase += dt * 7.8;
      this.updateScarf(r.player, dt, 220);
      return;
    }
    if (r.state !== 'playing') return;

    r.speed = Math.min(680, r.speed + dt * 11);
    r.distanceKm += (r.speed * dt) / 4200;
    r.score += dt * 28 * r.combo;
    r.bgScroll = (r.bgScroll + r.speed * dt) % 1640;

    const p = r.player;
    p.phase += dt * (r.speed / 25);
    if (p.shockwaveCooldown > 0) p.shockwaveCooldown = Math.max(0, p.shockwaveCooldown - dt);
    if (p.invulnerable > 0) p.invulnerable = Math.max(0, p.invulnerable - dt);

    const wasAirborne = p.y < r.groundY;
    p.vy += 1480 * dt;
    p.y += p.vy * dt;

    if (p.flipAngle > 0) {
      p.flipAngle += dt * 14;
      if (p.flipAngle >= Math.PI * 2) p.flipAngle = 0;
    }

    if (p.y >= r.groundY) {
      if (wasAirborne) {
        this.spawnParticles(p.x, r.groundY, 'rgba(248, 250, 252, 0.45)', 5);
      }
      p.y = r.groundY;
      p.vy = 0;
      p.jumpsUsed = 0;
      p.flipAngle = 0;
    }

    this.updateScarf(p, dt, r.speed);

    r.spawnTimer -= dt;
    if (r.spawnTimer <= 0) {
      const roll = Math.random();
      if (roll < 0.36) {
        r.obstacles.push({
          type: 'hurdle',
          x: 850,
          y: r.groundY - 38,
          w: 34,
          h: 38,
          color: '#f97316',
        });
      } else if (roll < 0.68) {
        const tall = Math.random() > 0.45;
        r.obstacles.push({
          type: 'pillar',
          x: 850,
          y: r.groundY - (tall ? 66 : 48),
          w: 28,
          h: tall ? 66 : 48,
          color: '#fb7185',
        });
      } else {
        const highAlt = Math.random() > 0.35;
        r.obstacles.push({
          type: 'drone',
          x: 850,
          y: highAlt ? r.groundY - 76 : r.groundY - 94,
          w: 46,
          h: 26,
          color: '#38bdf8',
          destroyed: false,
        });
      }
      const minGap = Math.max(0.58, 1.32 - (r.speed - 360) / 620);
      r.spawnTimer = minGap + Math.random() * 0.55;
    }

    r.orbTimer -= dt;
    if (r.orbTimer <= 0) {
      r.orbs.push({
        x: 850,
        y: r.groundY - (36 + Math.random() * 94),
        r: 10,
        phase: Math.random() * Math.PI * 2,
        collected: false,
      });
      r.orbTimer = 0.85 + Math.random() * 0.9;
    }

    const playerH = p.crouching ? 30 : 54;
    const playerBox = {
      x: p.x - 10,
      y: p.y - playerH,
      w: 20,
      h: playerH,
    };

    for (let i = r.obstacles.length - 1; i >= 0; i -= 1) {
      const obs = r.obstacles[i];
      obs.x -= r.speed * dt;

      if (!obs.destroyed && p.invulnerable <= 0) {
        const hit =
          playerBox.x < obs.x + obs.w - 4 &&
          playerBox.x + playerBox.w > obs.x + 4 &&
          playerBox.y < obs.y + obs.h - 4 &&
          playerBox.y + playerBox.h > obs.y + 4;

        if (hit) {
          r.state = 'gameover';
          this.soundEngine?.playKick?.();
          this.spawnParticles(p.x, p.y - 25, '#fb7185', 24);
          if (Math.floor(r.score) > this.hiScores.runner) {
            this.hiScores.runner = Math.floor(r.score);
            localStorage.setItem('cadence-runner-hi', String(this.hiScores.runner));
          }
          break;
        }
      }

      if (obs.x + obs.w < -40 || obs.destroyed) {
        r.obstacles.splice(i, 1);
      }
    }

    for (let i = r.orbs.length - 1; i >= 0; i -= 1) {
      const orb = r.orbs[i];
      orb.x -= r.speed * dt;
      orb.phase += dt * 5;
      const dx = p.x - orb.x;
      const dy = p.y - 28 - orb.y;
      if (!orb.collected && Math.hypot(dx, dy) < 32) {
        orb.collected = true;
        r.combo = Math.min(16, r.combo + 1);
        r.score += 50 * r.combo;
        this.soundEngine?.playHat?.();
        r.rings.push({ x: orb.x, y: orb.y, r: 6, maxR: 32, color: '#fbbf24', alpha: 0.95 });
        this.spawnParticles(orb.x, orb.y, '#fbbf24', 12);
      }
      if (orb.x < -30 || orb.collected) {
        r.orbs.splice(i, 1);
      }
    }

    for (let i = r.rings.length - 1; i >= 0; i -= 1) {
      const rg = r.rings[i];
      rg.r += 180 * dt;
      rg.alpha = Math.max(0, 1 - rg.r / rg.maxR);
      if (rg.r >= rg.maxR) r.rings.splice(i, 1);
    }

    for (let i = r.shockwaves.length - 1; i >= 0; i -= 1) {
      const sw = r.shockwaves[i];
      sw.radius += 520 * dt;
      sw.alpha = Math.max(0, 1 - sw.radius / sw.maxRadius);
      if (sw.radius >= sw.maxRadius) r.shockwaves.splice(i, 1);
    }

    for (let i = r.particles.length - 1; i >= 0; i -= 1) {
      const pt = r.particles[i];
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.life -= dt;
      if (pt.life <= 0) r.particles.splice(i, 1);
    }

    if (Math.floor(r.score) > this.hiScores.runner) {
      this.hiScores.runner = Math.floor(r.score);
      localStorage.setItem('cadence-runner-hi', String(this.hiScores.runner));
    }
  }

  drawMountainLayer(
    ctx,
    W,
    groundY,
    scroll,
    speedFactor,
    baseHeight,
    amp1,
    amp2,
    fillStyle,
    drawTrees = false
  ) {
    ctx.save();
    ctx.fillStyle = fillStyle;
    ctx.beginPath();
    ctx.moveTo(0, groundY);

    const step = 16;
    for (let x = 0; x <= W + step; x += step) {
      const wx = x + scroll * speedFactor;
      const h =
        Math.sin(wx * 0.0055) * amp1 +
        Math.cos(wx * 0.013) * amp2 +
        Math.sin(wx * 0.028) * (amp2 * 0.35);
      const y = groundY - baseHeight - h;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(W, groundY);
    ctx.closePath();
    ctx.fill();

    if (drawTrees) {
      ctx.fillStyle = fillStyle;
      const treeSpacing = 58;
      const offset = (scroll * speedFactor) % treeSpacing;
      for (let tx = -offset; tx < W + treeSpacing; tx += treeSpacing) {
        const wx = tx + scroll * speedFactor;
        const h =
          Math.sin(wx * 0.0055) * amp1 +
          Math.cos(wx * 0.013) * amp2 +
          Math.sin(wx * 0.028) * (amp2 * 0.35);
        const by = groundY - baseHeight - h;
        const treeH = 14 + ((Math.abs(Math.floor(wx / treeSpacing)) * 7) % 10);
        ctx.beginPath();
        ctx.moveTo(tx, by - treeH);
        ctx.lineTo(tx - 6, by + 3);
        ctx.lineTo(tx + 6, by + 3);
        ctx.closePath();
        ctx.fill();
      }
    }
    ctx.restore();
  }

  getThemePalette() {
    const theme = document.documentElement.getAttribute('data-theme') || 'sunset';
    const palettes = {
      sunset: {
        isLight: false,
        sky: ['#020307', '#0a1224', '#1e1b38', '#3b2439'],
        bloom: ['rgba(125, 211, 252, 0.22)', 'rgba(192, 132, 252, 0.12)'],
        moon: '#fef3c7',
        moonCutout: '#091020',
        mtn: ['rgba(24, 34, 62, 0.78)', 'rgba(16, 23, 44, 0.92)', '#090e1c'],
        road: ['#111829', '#050811'],
        roadLine: '#7dd3fc',
        stud: 'rgba(192, 132, 252, 0.6)',
        accent: '#7dd3fc',
        secondary: '#c084fc',
        warm: '#f59e0b',
        hurdle: '#f97316',
        pillar: '#c084fc',
        drone: '#7dd3fc',
        scarf: '#c084fc',
        shoe: '#7dd3fc',
        torso: '#f8fafc',
        limbBack: 'rgba(148, 163, 184, 0.78)',
        hair: '#0f172a',
        cardBg: ['#10182b', '#080c17'],
        cardBorder: 'rgba(125, 211, 252, 0.36)',
        boxBg: 'rgba(15, 23, 42, 0.78)',
        boxBorder: 'rgba(255, 255, 255, 0.08)',
        textBright: '#f8fafc',
        textMuted: '#94a3b8',
        ctaText: '#020307',
        laneColors: ['#7dd3fc', '#f8fafc', '#c084fc'],
      },
      dark: {
        isLight: false,
        sky: ['#04060d', '#0b1326', '#152238', '#1e293b'],
        bloom: ['rgba(56, 189, 248, 0.24)', 'rgba(129, 140, 248, 0.12)'],
        moon: '#e0f2fe',
        moonCutout: '#091122',
        mtn: ['rgba(23, 37, 68, 0.78)', 'rgba(15, 25, 48, 0.92)', '#080e1c'],
        road: ['#0f172a', '#060913'],
        roadLine: '#38bdf8',
        stud: 'rgba(129, 140, 248, 0.6)',
        accent: '#38bdf8',
        secondary: '#818cf8',
        warm: '#fbbf24',
        hurdle: '#38bdf8',
        pillar: '#818cf8',
        drone: '#fbbf24',
        scarf: '#38bdf8',
        shoe: '#818cf8',
        torso: '#ffffff',
        limbBack: 'rgba(148, 163, 184, 0.78)',
        hair: '#0f172a',
        cardBg: ['#0f172a', '#080c18'],
        cardBorder: 'rgba(56, 189, 248, 0.38)',
        boxBg: 'rgba(18, 26, 46, 0.8)',
        boxBorder: 'rgba(255, 255, 255, 0.08)',
        textBright: '#ffffff',
        textMuted: '#94a3b8',
        ctaText: '#04060d',
        laneColors: ['#38bdf8', '#ffffff', '#818cf8'],
      },
      ocean: {
        isLight: false,
        sky: ['#031211', '#062120', '#0a3130', '#114240'],
        bloom: ['rgba(0, 174, 187, 0.28)', 'rgba(94, 234, 212, 0.12)'],
        moon: '#ccfbf1',
        moonCutout: '#051c1b',
        mtn: ['rgba(13, 56, 54, 0.78)', 'rgba(9, 40, 38, 0.92)', '#041817'],
        road: ['#072221', '#031211'],
        roadLine: '#00aebb',
        stud: 'rgba(94, 234, 212, 0.6)',
        accent: '#00aebb',
        secondary: '#5eead4',
        warm: '#fbbf24',
        hurdle: '#5eead4',
        pillar: '#00aebb',
        drone: '#fde68a',
        scarf: '#5eead4',
        shoe: '#00aebb',
        torso: '#e8e4d3',
        limbBack: 'rgba(131, 151, 148, 0.8)',
        hair: '#031211',
        cardBg: ['#072221', '#041413'],
        cardBorder: 'rgba(0, 174, 187, 0.42)',
        boxBg: 'rgba(11, 44, 42, 0.8)',
        boxBorder: 'rgba(232, 228, 211, 0.1)',
        textBright: '#ffffff',
        textMuted: '#839794',
        ctaText: '#031211',
        laneColors: ['#00aebb', '#e8e4d3', '#5eead4'],
      },
      midnight: {
        isLight: false,
        sky: ['#140612', '#240c21', '#381332', '#4c1a36'],
        bloom: ['rgba(234, 170, 0, 0.25)', 'rgba(230, 224, 240, 0.12)'],
        moon: '#fef08a',
        moonCutout: '#200a1d',
        mtn: ['rgba(68, 24, 60, 0.78)', 'rgba(48, 16, 42, 0.92)', '#1e091b'],
        road: ['#260d23', '#130511'],
        roadLine: '#eaaa00',
        stud: 'rgba(230, 224, 240, 0.55)',
        accent: '#eaaa00',
        secondary: '#e6e0f0',
        warm: '#eaaa00',
        hurdle: '#eaaa00',
        pillar: '#e6e0f0',
        drone: '#f472b6',
        scarf: '#eaaa00',
        shoe: '#e6e0f0',
        torso: '#ffffff',
        limbBack: 'rgba(168, 156, 181, 0.8)',
        hair: '#140612',
        cardBg: ['#280e24', '#160714'],
        cardBorder: 'rgba(234, 170, 0, 0.4)',
        boxBg: 'rgba(48, 18, 44, 0.82)',
        boxBorder: 'rgba(230, 224, 240, 0.12)',
        textBright: '#ffffff',
        textMuted: '#a89cb5',
        ctaText: '#1a0917',
        laneColors: ['#eaaa00', '#ffffff', '#f472b6'],
      },
      'deep-dark': {
        isLight: false,
        sky: ['#070709', '#101015', '#191820', '#2b2218'],
        bloom: ['rgba(234, 170, 0, 0.26)', 'rgba(221, 227, 232, 0.08)'],
        moon: '#fde68a',
        moonCutout: '#0e0e12',
        mtn: ['rgba(38, 36, 46, 0.8)', 'rgba(24, 23, 30, 0.94)', '#0d0d11'],
        road: ['#14131a', '#070709'],
        roadLine: '#eaaa00',
        stud: 'rgba(234, 170, 0, 0.6)',
        accent: '#eaaa00',
        secondary: '#dde3e8',
        warm: '#eaaa00',
        hurdle: '#eaaa00',
        pillar: '#959ea6',
        drone: '#dde3e8',
        scarf: '#eaaa00',
        shoe: '#eaaa00',
        torso: '#ffffff',
        limbBack: 'rgba(149, 158, 166, 0.78)',
        hair: '#070709',
        cardBg: ['#16151c', '#0b0b0f'],
        cardBorder: 'rgba(234, 170, 0, 0.4)',
        boxBg: 'rgba(26, 25, 32, 0.85)',
        boxBorder: 'rgba(221, 227, 232, 0.1)',
        textBright: '#ffffff',
        textMuted: '#959ea6',
        ctaText: '#070709',
        laneColors: ['#eaaa00', '#ffffff', '#94a3b8'],
      },
      rainforest: {
        isLight: false,
        sky: ['#030a06', '#061810', '#0b291c', '#133b29'],
        bloom: ['rgba(16, 185, 129, 0.26)', 'rgba(45, 212, 191, 0.12)'],
        moon: '#d1fae5',
        moonCutout: '#05140d',
        mtn: ['rgba(16, 56, 38, 0.8)', 'rgba(10, 38, 25, 0.92)', '#04120b'],
        road: ['#081c12', '#030a06'],
        roadLine: '#10b981',
        stud: 'rgba(45, 212, 191, 0.6)',
        accent: '#10b981',
        secondary: '#2dd4bf',
        warm: '#a78bfa',
        hurdle: '#10b981',
        pillar: '#2dd4bf',
        drone: '#a78bfa',
        scarf: '#10b981',
        shoe: '#2dd4bf',
        torso: '#ecfdf5',
        limbBack: 'rgba(134, 239, 172, 0.72)',
        hair: '#030a06',
        cardBg: ['#092015', '#04100a'],
        cardBorder: 'rgba(16, 185, 129, 0.4)',
        boxBg: 'rgba(13, 36, 24, 0.82)',
        boxBorder: 'rgba(52, 211, 153, 0.14)',
        textBright: '#ffffff',
        textMuted: '#86efac',
        ctaText: '#030a06',
        laneColors: ['#10b981', '#ecfdf5', '#a78bfa'],
      },
      'blue-gray': {
        isLight: false,
        sky: ['#0d0c10', '#17151d', '#241f2b', '#382b24'],
        bloom: ['rgba(230, 224, 240, 0.22)', 'rgba(217, 119, 6, 0.14)'],
        moon: '#f5f5f4',
        moonCutout: '#15131a',
        mtn: ['rgba(46, 40, 56, 0.8)', 'rgba(31, 27, 38, 0.92)', '#110f16'],
        road: ['#1a1721', '#0b0a0e'],
        roadLine: '#e6e0f0',
        stud: 'rgba(217, 119, 6, 0.6)',
        accent: '#e6e0f0',
        secondary: '#d97706',
        warm: '#f59e0b',
        hurdle: '#d97706',
        pillar: '#e6e0f0',
        drone: '#a39fa9',
        scarf: '#d97706',
        shoe: '#e6e0f0',
        torso: '#ffffff',
        limbBack: 'rgba(163, 159, 169, 0.8)',
        hair: '#0d0c10',
        cardBg: ['#1b1822', '#0f0d13'],
        cardBorder: 'rgba(230, 224, 240, 0.35)',
        boxBg: 'rgba(34, 30, 42, 0.85)',
        boxBorder: 'rgba(229, 228, 226, 0.12)',
        textBright: '#ffffff',
        textMuted: '#a39fa9',
        ctaText: '#0d0c10',
        laneColors: ['#e6e0f0', '#d97706', '#a39fa9'],
      },
      light: {
        isLight: true,
        sky: ['#e6f2f2', '#f2efe4', '#f7f3e6', '#f5e4c8'],
        bloom: ['rgba(245, 158, 11, 0.28)', 'rgba(0, 150, 164, 0.1)'],
        moon: '#f59e0b',
        moonCutout: null,
        mtn: ['rgba(148, 178, 180, 0.55)', 'rgba(98, 134, 136, 0.72)', '#334e4f'],
        road: ['#d8d2c1', '#c2bba8'],
        roadLine: '#0096a4',
        stud: 'rgba(3, 18, 17, 0.35)',
        accent: '#0096a4',
        secondary: '#3a0f34',
        warm: '#d97706',
        hurdle: '#e07a5f',
        pillar: '#0096a4',
        drone: '#3a0f34',
        scarf: '#0096a4',
        shoe: '#e07a5f',
        torso: '#031211',
        limbBack: 'rgba(36, 48, 48, 0.65)',
        hair: '#031211',
        cardBg: ['#ffffff', '#f7f5ee'],
        cardBorder: 'rgba(0, 150, 164, 0.38)',
        boxBg: '#eae6d8',
        boxBorder: 'rgba(3, 18, 17, 0.1)',
        textBright: '#031211',
        textMuted: '#627271',
        ctaText: '#ffffff',
        laneColors: ['#0096a4', '#3a0f34', '#d97706'],
      },
    };
    return palettes[theme] || palettes.sunset;
  }

  renderRunner() {
    if (!this.ctx || !this.canvas) return;
    this.setupHighDPI();
    const ctx = this.ctx;
    const dpr = this.dpr || 1;
    const W = this.W;
    const H = this.H;
    const r = this.runner;
    const pal = this.getThemePalette();

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    // 1. Theme-Reactive Sky Gradient
    const skyGrad = ctx.createLinearGradient(0, 0, 0, r.groundY);
    skyGrad.addColorStop(0, pal.sky[0]);
    skyGrad.addColorStop(0.45, pal.sky[1]);
    skyGrad.addColorStop(0.78, pal.sky[2]);
    skyGrad.addColorStop(1, pal.sky[3]);
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, W, H);

    // Horizon atmospheric bloom
    const sunGrad = ctx.createRadialGradient(
      W * 0.72,
      r.groundY - 30,
      8,
      W * 0.72,
      r.groundY - 30,
      240
    );
    sunGrad.addColorStop(0, pal.bloom[0]);
    sunGrad.addColorStop(0.5, pal.bloom[1]);
    sunGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = sunGrad;
    ctx.fillRect(0, 0, W, r.groundY);

    // 2. Starfield (in dark themes) & Crescent Moon / Morning Sun (in light theme)
    if (!pal.isLight) {
      this.stars.forEach((st) => {
        const sx = (st.x - r.bgScroll * 0.04 * (st.speed / 10) + W * 4) % W;
        const twinkle = 0.35 + 0.65 * Math.sin(this.visualTime * 2.4 + st.phase);
        ctx.fillStyle = `rgba(248, 250, 252, ${twinkle * 0.75})`;
        ctx.beginPath();
        ctx.arc(sx, st.y, st.r, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    ctx.save();
    const moonX = 670;
    const moonY = 64;
    ctx.fillStyle = pal.moon;
    ctx.beginPath();
    ctx.arc(moonX, moonY, 15, 0, Math.PI * 2);
    ctx.fill();
    if (pal.moonCutout) {
      ctx.fillStyle = pal.moonCutout;
      ctx.beginPath();
      ctx.arc(moonX - 5, moonY - 3, 13.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // 3. Three Parallax Himalayan Mountain Ridges + Pine Silhouettes
    this.drawMountainLayer(ctx, W, r.groundY, r.bgScroll, 0.14, 115, 34, 18, pal.mtn[0], false);
    this.drawMountainLayer(ctx, W, r.groundY, r.bgScroll, 0.28, 74, 24, 14, pal.mtn[1], true);
    this.drawMountainLayer(ctx, W, r.groundY, r.bgScroll, 0.48, 36, 14, 8, pal.mtn[2], true);

    // 4. Theme-Reactive Road Deck & Reflective Track Markers
    const roadGrad = ctx.createLinearGradient(0, r.groundY, 0, H);
    roadGrad.addColorStop(0, pal.road[0]);
    roadGrad.addColorStop(1, pal.road[1]);
    ctx.fillStyle = roadGrad;
    ctx.fillRect(0, r.groundY, W, H - r.groundY);

    ctx.strokeStyle = pal.roadLine;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, r.groundY);
    ctx.lineTo(W, r.groundY);
    ctx.stroke();

    const tickSpacing = 56;
    const offset = r.bgScroll % tickSpacing;
    for (let x = -offset; x < W + tickSpacing; x += tickSpacing) {
      ctx.fillStyle = pal.stud;
      ctx.fillRect(x, r.groundY + 5, 10, 2.5);

      ctx.strokeStyle = pal.isLight ? 'rgba(3, 18, 17, 0.12)' : 'rgba(148, 163, 184, 0.14)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(x, r.groundY + 12);
      ctx.lineTo(x - 22, H);
      ctx.stroke();
    }

    // 5. Collectible Vinyl / Rhythm Medallions
    r.orbs.forEach((orb) => {
      const bobY = orb.y + Math.sin(orb.phase) * 3.5;
      ctx.save();
      ctx.fillStyle = pal.isLight ? 'rgba(0, 150, 164, 0.14)' : 'rgba(251, 191, 36, 0.16)';
      ctx.beginPath();
      ctx.arc(orb.x, bobY, orb.r + 5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = pal.isLight ? '#ffffff' : '#1e293b';
      ctx.strokeStyle = pal.accent;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.arc(orb.x, bobY, orb.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = pal.warm;
      ctx.beginPath();
      ctx.arc(orb.x, bobY, 3.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    // 6. Theme-Reactive Obstacles (Track Hurdles, Pillars, Rotary Drones)
    r.obstacles.forEach((obs) => {
      ctx.save();
      if (obs.type === 'hurdle') {
        ctx.strokeStyle = pal.textMuted;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(obs.x + 6, obs.y + 8);
        ctx.lineTo(obs.x + 4, obs.y + obs.h);
        ctx.moveTo(obs.x + obs.w - 6, obs.y + 8);
        ctx.lineTo(obs.x + obs.w - 4, obs.y + obs.h);
        ctx.stroke();

        ctx.fillStyle = pal.hurdle;
        ctx.strokeStyle = pal.textBright;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.roundRect(obs.x, obs.y, obs.w, 12, 4);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = pal.textBright;
        ctx.fillRect(obs.x + 7, obs.y + 2, 5, 8);
        ctx.fillRect(obs.x + 19, obs.y + 2, 5, 8);
      } else if (obs.type === 'pillar') {
        const pGrad = ctx.createLinearGradient(obs.x, obs.y, obs.x + obs.w, obs.y + obs.h);
        pGrad.addColorStop(0, pal.isLight ? '#e2ddd0' : '#334155');
        pGrad.addColorStop(1, pal.isLight ? '#cbc4b2' : '#0f172a');
        ctx.fillStyle = pGrad;
        ctx.strokeStyle = pal.pillar;
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.roundRect(obs.x, obs.y, obs.w, obs.h, 6);
        ctx.fill();
        ctx.stroke();

        ctx.strokeStyle = pal.pillar;
        ctx.globalAlpha = 0.45;
        ctx.lineWidth = 1.2;
        for (let by = obs.y + 12; by < obs.y + obs.h - 8; by += 14) {
          ctx.beginPath();
          ctx.moveTo(obs.x + 5, by);
          ctx.lineTo(obs.x + obs.w - 5, by);
          ctx.stroke();
        }
      } else {
        const cx = obs.x + obs.w * 0.5;
        const cy = obs.y + obs.h * 0.5;
        const hoverBob = Math.sin(this.visualTime * 9 + obs.x * 0.03) * 2.5;

        const beamGrad = ctx.createLinearGradient(cx, cy + hoverBob, cx - 18, r.groundY);
        beamGrad.addColorStop(
          0,
          pal.isLight ? 'rgba(0, 150, 164, 0.18)' : 'rgba(125, 211, 252, 0.2)'
        );
        beamGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = beamGrad;
        ctx.beginPath();
        ctx.moveTo(cx - 6, cy + hoverBob + 6);
        ctx.lineTo(cx + 6, cy + hoverBob + 6);
        ctx.lineTo(cx + 22, r.groundY);
        ctx.lineTo(cx - 34, r.groundY);
        ctx.closePath();
        ctx.fill();

        const rotorW = 12 + Math.sin(this.visualTime * 38) * 5;
        ctx.strokeStyle = pal.textMuted;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(obs.x + 8 - rotorW * 0.5, cy + hoverBob - 9);
        ctx.lineTo(obs.x + 8 + rotorW * 0.5, cy + hoverBob - 9);
        ctx.moveTo(obs.x + obs.w - 8 - rotorW * 0.5, cy + hoverBob - 9);
        ctx.lineTo(obs.x + obs.w - 8 + rotorW * 0.5, cy + hoverBob - 9);
        ctx.stroke();

        ctx.fillStyle = pal.isLight ? '#ffffff' : '#1e293b';
        ctx.strokeStyle = pal.drone;
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.roundRect(obs.x + 3, cy + hoverBob - 6, obs.w - 6, 13, 6);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = pal.warm;
        ctx.beginPath();
        ctx.arc(cx - 4, cy + hoverBob, 3.2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    });

    // 7. Expanding Rings & Acoustic Pulse Wave
    r.rings.forEach((rg) => {
      ctx.save();
      ctx.strokeStyle = pal.accent;
      ctx.globalAlpha = rg.alpha;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(rg.x, rg.y, rg.r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    });

    r.shockwaves.forEach((sw) => {
      ctx.save();
      ctx.strokeStyle = pal.accent;
      ctx.globalAlpha = sw.alpha;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(sw.x, sw.y, sw.radius, -Math.PI * 0.4, Math.PI * 0.4);
      ctx.stroke();

      ctx.strokeStyle = pal.secondary;
      ctx.globalAlpha = sw.alpha * 0.65;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(sw.x - 8, sw.y, sw.radius * 0.82, -Math.PI * 0.32, Math.PI * 0.32);
      ctx.stroke();
      ctx.restore();
    });

    // 8. Articulated Runner with Theme-Colored Scarf & Shoes
    this.drawArticulatedRunner(ctx, r.player, r.groundY, pal);

    // 9. Particles
    r.particles.forEach((pt) => {
      ctx.fillStyle = pt.color;
      ctx.globalAlpha = Math.max(0, pt.life * 1.4);
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.size * 0.65, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;

    if (r.state === 'tutorial') {
      this.drawRunnerTutorialCard(ctx, W, H, pal);
    }

    if (r.state === 'gameover') {
      this.drawGameOverOverlay(ctx, W, H, pal, {
        badge: pal.isLight ? 'SHIMLA DAYLIGHT RUN' : 'SHIMLA DUSK RUN',
        title: 'Run Complete',
        summary: `${Math.floor(r.score)} pts   ·   ${r.distanceKm.toFixed(2)} km   ·   Best ${this.hiScores.runner}`,
      });
    }
  }

  drawKeycap(ctx, x, y, w, h, label, accent, pal) {
    ctx.save();
    ctx.fillStyle = pal?.isLight ? 'rgba(3, 18, 17, 0.22)' : '#050811';
    ctx.beginPath();
    ctx.roundRect(x, y + 3, w, h, 7);
    ctx.fill();

    const capGrad = ctx.createLinearGradient(x, y, x, y + h);
    capGrad.addColorStop(0, pal?.isLight ? '#ffffff' : '#243046');
    capGrad.addColorStop(1, pal?.isLight ? '#f2efe4' : '#162032');
    ctx.fillStyle = capGrad;
    ctx.strokeStyle = pal?.isLight ? 'rgba(3, 18, 17, 0.18)' : 'rgba(248, 250, 252, 0.22)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 7);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = accent;
    ctx.font = '700 11.5px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x + w / 2, y + h / 2 + 0.5);
    ctx.restore();
  }

  drawRunnerTutorialCard(ctx, W, H, pal = this.getThemePalette()) {
    ctx.save();
    ctx.fillStyle = pal.isLight ? 'rgba(247, 245, 238, 0.68)' : 'rgba(4, 7, 15, 0.68)';
    ctx.fillRect(0, 0, W, H);

    const cardW = 630;
    const cardH = 262;
    const cardX = Math.round((W - cardW) / 2);
    const cardY = Math.round((H - cardH) / 2);

    const cardGrad = ctx.createLinearGradient(cardX, cardY, cardX, cardY + cardH);
    cardGrad.addColorStop(0, pal.cardBg[0]);
    cardGrad.addColorStop(1, pal.cardBg[1]);
    ctx.fillStyle = cardGrad;
    ctx.strokeStyle = pal.cardBorder;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(cardX, cardY, cardW, cardH, 16);
    ctx.fill();
    ctx.stroke();

    ctx.textAlign = 'center';

    ctx.fillStyle = pal.accent;
    ctx.font = '600 10px "JetBrains Mono", monospace';
    ctx.fillText('SHIMLA ROAD TRACK  ·  5K & 10K RUNNER', W / 2, cardY + 28);

    ctx.fillStyle = pal.textBright;
    ctx.font = '700 22px "Space Grotesk", -apple-system, sans-serif';
    ctx.fillText('Night Run Controls', W / 2, cardY + 54);

    const items = [
      {
        key: 'Space / ↑',
        title: 'Jump & Double Jump',
        sub: 'Clear track hurdles & pillars',
        accent: pal.hurdle,
        type: 'hurdle',
      },
      {
        key: '↓ / S',
        title: 'Fast Duck',
        sub: 'Slide underneath high drones',
        accent: pal.drone,
        type: 'duck',
      },
      {
        key: 'J',
        title: 'Snare Pulse',
        sub: 'Shatter drones in your path',
        accent: pal.accent,
        type: 'pulse',
      },
    ];

    const boxW = 182;
    const boxH = 122;
    const gap = 18;
    const startX = cardX + (cardW - (boxW * 3 + gap * 2)) / 2;
    const boxY = cardY + 72;

    items.forEach((it, idx) => {
      const bx = startX + idx * (boxW + gap);

      ctx.fillStyle = pal.boxBg;
      ctx.strokeStyle = pal.boxBorder;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(bx, boxY, boxW, boxH, 12);
      ctx.fill();
      ctx.stroke();

      const cx = bx + boxW / 2;
      const iy = boxY + 26;
      ctx.save();
      if (it.type === 'hurdle') {
        ctx.strokeStyle = pal.hurdle;
        ctx.setLineDash([3, 3]);
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(cx, iy + 8, 16, Math.PI, 0);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = pal.hurdle;
        ctx.beginPath();
        ctx.roundRect(cx - 9, iy - 1, 18, 7, 2);
        ctx.fill();
      } else if (it.type === 'duck') {
        ctx.fillStyle = pal.isLight ? '#ffffff' : '#1e293b';
        ctx.strokeStyle = pal.drone;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.roundRect(cx - 14, iy - 8, 28, 9, 4);
        ctx.fill();
        ctx.stroke();

        ctx.strokeStyle = pal.textBright;
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(cx, iy + 4);
        ctx.lineTo(cx, iy + 13);
        ctx.moveTo(cx - 4, iy + 9);
        ctx.lineTo(cx, iy + 13);
        ctx.lineTo(cx + 4, iy + 9);
        ctx.stroke();
      } else {
        ctx.fillStyle = pal.accent;
        ctx.beginPath();
        ctx.arc(cx - 10, iy + 2, 3.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = pal.accent;
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.arc(cx - 10, iy + 2, 11, -0.65, 0.65);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(cx - 10, iy + 2, 19, -0.55, 0.55);
        ctx.stroke();
      }
      ctx.restore();

      const kw = idx === 2 ? 54 : 88;
      this.drawKeycap(ctx, cx - kw / 2, boxY + 46, kw, 26, it.key, it.accent, pal);

      ctx.fillStyle = pal.textBright;
      ctx.font = '600 12.5px "Space Grotesk", -apple-system, sans-serif';
      ctx.fillText(it.title, cx, boxY + 92);

      ctx.fillStyle = pal.textMuted;
      ctx.font = '400 11px "Space Grotesk", -apple-system, sans-serif';
      ctx.fillText(it.sub, cx, boxY + 109);
    });

    const pillW = 248;
    const pillH = 34;
    const pillX = (W - pillW) / 2;
    const pillY = cardY + cardH - 48;

    ctx.fillStyle = pal.accent;
    ctx.beginPath();
    ctx.roundRect(pillX, pillY, pillW, pillH, 999);
    ctx.fill();

    ctx.fillStyle = pal.ctaText;
    ctx.font = '700 12.5px "Space Grotesk", -apple-system, sans-serif';
    ctx.fillText('Press Space or Click to Run  →', W / 2, pillY + 21);

    ctx.restore();
  }

  drawRhythmTutorialCard(ctx, W, H, pal = this.getThemePalette()) {
    ctx.save();
    ctx.fillStyle = pal.isLight ? 'rgba(247, 245, 238, 0.68)' : 'rgba(4, 7, 15, 0.68)';
    ctx.fillRect(0, 0, W, H);

    const cardW = 630;
    const cardH = 262;
    const cardX = Math.round((W - cardW) / 2);
    const cardY = Math.round((H - cardH) / 2);

    const cardGrad = ctx.createLinearGradient(cardX, cardY, cardX, cardY + cardH);
    cardGrad.addColorStop(0, pal.cardBg[0]);
    cardGrad.addColorStop(1, pal.cardBg[1]);
    ctx.fillStyle = cardGrad;
    ctx.strokeStyle = pal.cardBorder;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(cardX, cardY, cardW, cardH, 16);
    ctx.fill();
    ctx.stroke();

    ctx.textAlign = 'center';

    ctx.fillStyle = pal.accent;
    ctx.font = '600 10px "JetBrains Mono", monospace';
    ctx.fillText('TAMA JAM SESSION  ·  3-LANE STUDIO DECK', W / 2, cardY + 28);

    ctx.fillStyle = pal.textBright;
    ctx.font = '700 22px "Space Grotesk", -apple-system, sans-serif';
    ctx.fillText('Drum Pad Controls', W / 2, cardY + 54);

    const items = [
      {
        key: 'Space',
        title: 'Bass Kick',
        sub: 'Left lane · Low punch',
        accent: pal.laneColors[0],
      },
      {
        key: 'J',
        title: 'Snare / Rim',
        sub: 'Center lane · Crisp crack',
        accent: pal.laneColors[1],
      },
      {
        key: 'K',
        title: 'Hi-Hat',
        sub: 'Right lane · Groove pulse',
        accent: pal.laneColors[2],
      },
    ];

    const boxW = 182;
    const boxH = 122;
    const gap = 18;
    const startX = cardX + (cardW - (boxW * 3 + gap * 2)) / 2;
    const boxY = cardY + 72;

    items.forEach((it, idx) => {
      const bx = startX + idx * (boxW + gap);
      const cx = bx + boxW / 2;

      ctx.fillStyle = pal.boxBg;
      ctx.strokeStyle = pal.boxBorder;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(bx, boxY, boxW, boxH, 12);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = it.accent;
      ctx.beginPath();
      ctx.roundRect(cx - 18, boxY + 20, 36, 10, 4);
      ctx.fill();

      const kw = idx === 0 ? 76 : 54;
      this.drawKeycap(ctx, cx - kw / 2, boxY + 44, kw, 26, it.key, it.accent, pal);

      ctx.fillStyle = pal.textBright;
      ctx.font = '600 12.5px "Space Grotesk", -apple-system, sans-serif';
      ctx.fillText(it.title, cx, boxY + 92);

      ctx.fillStyle = pal.textMuted;
      ctx.font = '400 11px "Space Grotesk", -apple-system, sans-serif';
      ctx.fillText(it.sub, cx, boxY + 109);
    });

    const pillW = 256;
    const pillH = 34;
    const pillX = (W - pillW) / 2;
    const pillY = cardY + cardH - 48;

    ctx.fillStyle = pal.accent;
    ctx.beginPath();
    ctx.roundRect(pillX, pillY, pillW, pillH, 999);
    ctx.fill();

    ctx.fillStyle = pal.ctaText;
    ctx.font = '700 12.5px "Space Grotesk", -apple-system, sans-serif';
    ctx.fillText('Press Space or Click to Jam  →', W / 2, pillY + 21);

    ctx.restore();
  }

  drawGameOverOverlay(ctx, W, H, pal, { badge, title, summary }) {
    ctx.save();
    ctx.fillStyle = pal.isLight ? 'rgba(247, 245, 238, 0.72)' : 'rgba(4, 7, 15, 0.72)';
    ctx.fillRect(0, 0, W, H);

    const cardW = 460;
    const cardH = 188;
    const cardX = Math.round((W - cardW) / 2);
    const cardY = Math.round((H - cardH) / 2);

    ctx.fillStyle = pal.cardBg[0];
    ctx.strokeStyle = pal.cardBorder;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(cardX, cardY, cardW, cardH, 16);
    ctx.fill();
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.fillStyle = pal.accent;
    ctx.font = '600 10px "JetBrains Mono", monospace';
    ctx.fillText(badge, W / 2, cardY + 34);

    ctx.fillStyle = pal.textBright;
    ctx.font = '700 22px "Space Grotesk", -apple-system, sans-serif';
    ctx.fillText(title, W / 2, cardY + 66);

    ctx.fillStyle = pal.textMuted;
    ctx.font = '500 12.5px "JetBrains Mono", monospace';
    ctx.fillText(summary, W / 2, cardY + 98);

    const pillW = 236;
    const pillH = 34;
    ctx.fillStyle = pal.accent;
    ctx.beginPath();
    ctx.roundRect((W - pillW) / 2, cardY + 126, pillW, pillH, 999);
    ctx.fill();

    ctx.fillStyle = pal.ctaText;
    ctx.font = '700 12px "Space Grotesk", -apple-system, sans-serif';
    ctx.fillText('Press Space or Click to Replay', W / 2, cardY + 147);
    ctx.restore();
  }

  drawArticulatedRunner(ctx, p, groundY, pal = this.getThemePalette()) {
    ctx.save();
    const x = p.x;
    const y = p.y;
    const airborne = y < groundY - 2;
    const crouch = p.crouching;
    const phase = p.phase;

    const heightRatio = Math.max(0.2, 1 - (groundY - y) / 160);
    ctx.fillStyle = pal.isLight
      ? `rgba(3, 18, 17, ${0.22 * heightRatio})`
      : `rgba(2, 4, 10, ${0.55 * heightRatio})`;
    ctx.beginPath();
    ctx.ellipse(x, groundY + 3, 17 * heightRatio, 3.8 * heightRatio, 0, 0, Math.PI * 2);
    ctx.fill();

    // Flowing wind scarf behind runner
    if (p.scarfPts && p.scarfPts.length > 1) {
      ctx.save();
      ctx.strokeStyle = pal.scarf;
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(p.scarfPts[0].x, p.scarfPts[0].y);
      for (let i = 1; i < p.scarfPts.length; i += 1) {
        ctx.lineTo(p.scarfPts[i].x, p.scarfPts[i].y);
      }
      ctx.stroke();
      ctx.restore();
    }

    const hipY = crouch ? y - 16 : y - 26;
    const lean = crouch ? 10 : 6;
    const shoulderX = x + lean;
    const shoulderY = crouch ? hipY - 12 : hipY - 18;
    const headX = shoulderX + 3;
    const headY = shoulderY - 9;

    const legSwing = airborne ? 0.58 : Math.sin(phase);
    const oppSwing = airborne ? -0.48 : Math.sin(phase + Math.PI);

    ctx.strokeStyle = pal.limbBack;
    ctx.lineWidth = 3.2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const drawLimb = (sx, sy, swing, len1, len2, isLeg) => {
      const a1 = isLeg ? swing * 0.75 + 0.15 : -swing * 0.7 + 0.2;
      const jx = sx + Math.sin(a1) * len1;
      const jy = sy + Math.cos(a1) * len1;
      const a2 = isLeg ? a1 - Math.abs(swing) * 0.55 - 0.25 : a1 + 0.75;
      const ex = jx + Math.sin(a2) * len2;
      const ey = Math.min(groundY, jy + Math.cos(a2) * len2);
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(jx, jy);
      ctx.lineTo(ex, ey);
      ctx.stroke();
      return { ex, ey };
    };

    const legLen = crouch ? 9 : 13;
    drawLimb(x, hipY, oppSwing, legLen, legLen, true);
    drawLimb(shoulderX, shoulderY, legSwing, 9, 9, false);

    ctx.strokeStyle = pal.torso;
    ctx.lineWidth = 5.5;
    ctx.beginPath();
    ctx.moveTo(x, hipY);
    ctx.lineTo(shoulderX, shoulderY);
    ctx.stroke();

    ctx.strokeStyle = pal.torso;
    ctx.lineWidth = 3.6;
    const frontFoot = drawLimb(x, hipY, legSwing, legLen, legLen, true);
    ctx.strokeStyle = pal.shoe;
    ctx.lineWidth = 3.2;
    ctx.beginPath();
    ctx.moveTo(frontFoot.ex - 2, frontFoot.ey);
    ctx.lineTo(frontFoot.ex + 6.5, frontFoot.ey);
    ctx.stroke();

    ctx.strokeStyle = pal.torso;
    ctx.lineWidth = 3.2;
    drawLimb(shoulderX, shoulderY, oppSwing, 9, 9, false);

    ctx.fillStyle = pal.torso;
    ctx.beginPath();
    ctx.arc(headX, headY, 6.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = pal.hair;
    const curls = [
      [-4, -5, 3.2],
      [0, -6.5, 3.5],
      [4, -5, 3.0],
      [-5.5, -2, 2.8],
    ];
    curls.forEach(([cx, cy, cr]) => {
      ctx.beginPath();
      ctx.arc(headX + cx, headY + cy, cr, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.strokeStyle = pal.accent;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(headX + 2, headY - 1);
    ctx.lineTo(headX + 7.5, headY - 1);
    ctx.stroke();

    ctx.restore();
  }

  updateRhythm(dt) {
    const rh = this.rhythm;
    if (rh.state !== 'playing') return;

    rh.songTime += dt;
    const stepDuration = 60 / rh.bpm / 2;

    const travelTime = 1.18;
    while (rh.nextBeatIndex * stepDuration < rh.songTime + travelTime) {
      const step = rh.nextBeatIndex % 16;
      const targetTime = rh.nextBeatIndex * stepDuration;

      if (step === 0 || step === 6 || step === 10 || (step === 14 && Math.random() > 0.4)) {
        rh.notes.push({ lane: 0, targetTime, hit: false, missed: false });
      }
      if (step === 4 || step === 12 || (step === 9 && Math.random() > 0.35)) {
        rh.notes.push({ lane: 1, targetTime, hit: false, missed: false });
      }
      if (step % 2 === 0 || step === 7 || step === 15) {
        rh.notes.push({ lane: 2, targetTime, hit: false, missed: false });
      }

      rh.nextBeatIndex += 1;
    }

    for (let i = 0; i < 3; i += 1) {
      rh.laneFlashes[i] = Math.max(0, rh.laneFlashes[i] - dt * 4.5);
    }

    for (let i = rh.notes.length - 1; i >= 0; i -= 1) {
      const note = rh.notes[i];
      if (!note.hit && !note.missed && rh.songTime - note.targetTime > 0.16) {
        note.missed = true;
        rh.combo = 0;
        rh.misses += 1;
      }
      if (rh.songTime - note.targetTime > 0.35 || note.hit) {
        rh.notes.splice(i, 1);
      }
    }

    for (let i = rh.hitRipples.length - 1; i >= 0; i -= 1) {
      const rp = rh.hitRipples[i];
      rp.r += 160 * dt;
      rp.alpha = Math.max(0, 1 - rp.r / rp.maxR);
      if (rp.r >= rp.maxR) rh.hitRipples.splice(i, 1);
    }

    if (rh.feedback) {
      rh.feedback.life -= dt;
      if (rh.feedback.life <= 0) rh.feedback = null;
    }

    for (let i = rh.particles.length - 1; i >= 0; i -= 1) {
      const pt = rh.particles[i];
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.life -= dt;
      if (pt.life <= 0) rh.particles.splice(i, 1);
    }
  }

  triggerRhythmLane(lane) {
    const rh = this.rhythm;
    rh.laneFlashes[lane] = 1;

    if (lane === 0) this.soundEngine?.playKick?.();
    if (lane === 1) this.soundEngine?.playRim?.();
    if (lane === 2) this.soundEngine?.playHat?.();

    let bestNote = null;
    let bestDelta = Infinity;
    for (const note of rh.notes) {
      if (note.lane === lane && !note.hit && !note.missed) {
        const delta = Math.abs(note.targetTime - rh.songTime);
        if (delta < bestDelta) {
          bestDelta = delta;
          bestNote = note;
        }
      }
    }

    const laneX = 210 + lane * 200;
    const hitY = 308;
    const pal = this.getThemePalette();
    const laneColors = pal.laneColors;

    if (bestNote && bestDelta <= 0.16) {
      bestNote.hit = true;
      rh.hits += 1;
      rh.combo += 1;
      rh.maxCombo = Math.max(rh.maxCombo, rh.combo);

      const isPerfect = bestDelta <= 0.065;
      const pts = (isPerfect ? 120 : 75) * Math.min(8, 1 + Math.floor(rh.combo / 6));
      rh.score += pts;

      rh.hitRipples.push({
        x: laneX,
        y: hitY,
        r: 12,
        maxR: 52,
        color: laneColors[lane],
        alpha: 0.95,
      });
      rh.feedback = {
        text: isPerfect ? 'PERFECT' : 'GOOD',
        color: laneColors[lane],
        life: 0.45,
      };
      this.spawnParticles(laneX, hitY, laneColors[lane], isPerfect ? 14 : 9);

      if (rh.score > this.hiScores.rhythm) {
        this.hiScores.rhythm = rh.score;
        localStorage.setItem('cadence-rhythm-hi', String(this.hiScores.rhythm));
      }
    } else {
      rh.combo = 0;
    }
  }

  renderRhythm() {
    if (!this.ctx || !this.canvas) return;
    this.setupHighDPI();
    const ctx = this.ctx;
    const dpr = this.dpr || 1;
    const W = this.W;
    const H = this.H;
    const rh = this.rhythm;
    const pal = this.getThemePalette();

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
    bgGrad.addColorStop(0, pal.sky[0]);
    bgGrad.addColorStop(0.6, pal.sky[1]);
    bgGrad.addColorStop(1, pal.sky[2]);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);

    // Theme-reactive studio EQ spectrum along top horizon
    const bars = 36;
    const barSpan = 540;
    const startBarX = (W - barSpan) / 2;
    for (let b = 0; b < bars; b += 1) {
      const bx = startBarX + b * (barSpan / bars);
      const wave =
        Math.sin(this.visualTime * 6 + b * 0.45) * 0.5 +
        0.5 +
        (rh.laneFlashes[b % 3] || 0) * 0.8;
      const bh = 6 + wave * 18;
      ctx.fillStyle = pal.accent;
      ctx.globalAlpha = 0.16;
      ctx.fillRect(bx, 38 - bh, 8, bh);
    }
    ctx.globalAlpha = 1;

    const laneColors = pal.laneColors;
    const laneLabels = ['Space · Kick', 'J · Snare', 'K · Hi-Hat'];
    const hitY = 308;
    const topY = 44;
    const travelTime = 1.18;

    for (let i = 0; i < 3; i += 1) {
      const lx = 210 + i * 200;
      const flash = rh.laneFlashes[i];

      const laneGrad = ctx.createLinearGradient(lx, topY, lx, hitY);
      laneGrad.addColorStop(0, pal.isLight ? 'rgba(3, 18, 17, 0.04)' : 'rgba(15, 23, 42, 0.28)');
      laneGrad.addColorStop(1, pal.isLight ? 'rgba(3, 18, 17, 0.1)' : 'rgba(30, 41, 59, 0.68)');
      ctx.fillStyle = laneGrad;
      ctx.strokeStyle = pal.boxBorder;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(lx - 48, topY, 96, hitY - topY + 18, 12);
      ctx.fill();
      ctx.stroke();

      ctx.strokeStyle = pal.isLight ? 'rgba(3, 18, 17, 0.12)' : 'rgba(148, 163, 184, 0.14)';
      ctx.beginPath();
      ctx.moveTo(lx, topY + 8);
      ctx.lineTo(lx, hitY - 12);
      ctx.stroke();

      const padPressOffset = flash * 3;
      ctx.save();
      ctx.fillStyle = pal.isLight ? 'rgba(3, 18, 17, 0.25)' : '#050811';
      ctx.beginPath();
      ctx.roundRect(lx - 40, hitY - 10, 80, 26, 8);
      ctx.fill();

      ctx.fillStyle = flash > 0.05 ? laneColors[i] : pal.isLight ? '#ffffff' : '#1e293b';
      ctx.strokeStyle = laneColors[i];
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(lx - 40, hitY - 13 + padPressOffset, 80, 24, 8);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = pal.textBright;
      ctx.font = '600 11.5px "Space Grotesk", -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(laneLabels[i], lx, hitY + 32);
      ctx.restore();
    }

    rh.notes.forEach((note) => {
      if (note.hit) return;
      const timeRemaining = note.targetTime - rh.songTime;
      const progress = 1 - timeRemaining / travelTime;
      if (progress < -0.05 || progress > 1.12) return;

      const lx = 210 + note.lane * 200;
      const ny = topY + progress * (hitY - topY);
      const color = laneColors[note.lane];

      ctx.save();
      const trailGrad = ctx.createLinearGradient(lx, ny - 28, lx, ny);
      trailGrad.addColorStop(0, 'rgba(255, 255, 255, 0)');
      trailGrad.addColorStop(
        1,
        pal.isLight ? 'rgba(3, 18, 17, 0.12)' : 'rgba(248, 250, 252, 0.16)'
      );
      ctx.fillStyle = trailGrad;
      ctx.fillRect(lx - 26, ny - 28, 52, 28);

      ctx.fillStyle = pal.isLight ? 'rgba(3, 18, 17, 0.22)' : '#050811';
      ctx.beginPath();
      ctx.roundRect(lx - 30, ny - 5, 60, 15, 6);
      ctx.fill();

      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.roundRect(lx - 30, ny - 8, 60, 14, 6);
      ctx.fill();
      ctx.restore();
    });

    rh.hitRipples.forEach((rp) => {
      ctx.save();
      ctx.strokeStyle = rp.color;
      ctx.globalAlpha = rp.alpha;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.arc(rp.x, rp.y, rp.r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    });

    if (rh.feedback) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, rh.feedback.life * 2.4);
      ctx.fillStyle = rh.feedback.color;
      ctx.font = '700 12px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(rh.feedback.text, W / 2, 26);
      ctx.restore();
    }

    rh.particles.forEach((pt) => {
      ctx.fillStyle = pt.color;
      ctx.globalAlpha = Math.max(0, pt.life * 1.4);
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.size * 0.65, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;

    if (rh.state === 'tutorial') {
      this.drawRhythmTutorialCard(ctx, W, H, pal);
    }
  }

  updateHUD() {
    if (this.mode === 'runner') {
      const r = this.runner;
      if (this.scoreEl) this.scoreEl.textContent = String(Math.floor(r.score));
      if (this.hiScoreEl) this.hiScoreEl.textContent = String(this.hiScores.runner);
      if (this.comboEl) this.comboEl.textContent = `${r.combo}×`;
      if (this.paceEl) this.paceEl.textContent = `${r.distanceKm.toFixed(2)} km`;
    } else {
      const rh = this.rhythm;
      if (this.scoreEl) this.scoreEl.textContent = String(Math.floor(rh.score));
      if (this.hiScoreEl) this.hiScoreEl.textContent = String(this.hiScores.rhythm);
      if (this.comboEl) this.comboEl.textContent = `${rh.combo}×`;
      const total = rh.hits + rh.misses;
      const acc = total > 0 ? Math.round((rh.hits / total) * 100) : 100;
      if (this.paceEl) this.paceEl.textContent = `${acc}% hit`;
    }
  }
}
