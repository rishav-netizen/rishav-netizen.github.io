/**
 * MINI ARCADE // NIGHT RUN & STUDIO DRUM PAD
 * ------------------------------------------
 * Full 3-layer Himalayan mountain & pine parallax runner (with Jump/Double-Jump,
 * Duck under high drones, and J Snare Shockwave for drone removal) plus 3-lane
 * Studio Drum Pad, styled with a clean visual theme and mobile-friendly touch UX.
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
    this.isMobile = false;

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

    this.setupHighDPI();
    this.runner = this.createRunnerState();
    this.rhythm = this.createRhythmState();

    this.bindUI();
    this.updateHUD();
  }

  createRunnerState() {
    const px = this.isMobile ? 96 : 138;
    const groundY = 308;
    return {
      state: 'tutorial', // 'tutorial' | 'playing' | 'gameover'
      score: 0,
      distanceKm: 0,
      combo: 1,
      speed: 360,
      groundY,
      player: {
        x: px,
        y: groundY,
        vy: 0,
        jumpsUsed: 0,
        maxJumps: 2,
        crouching: false,
        phase: 0,
        flipAngle: 0,
        shockwaveCooldown: 0,
        invulnerable: 0,
        scarfPts: Array.from({ length: 7 }, (_, i) => ({ x: px - i * 6, y: 274 })),
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
    const mobile = window.innerWidth <= 640;
    const targetW = mobile ? 540 : 820;
    const targetH = 360;
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    if (this.W !== targetW || this.H !== targetH || this.dpr !== dpr || this.canvas.width !== Math.round(targetW * dpr)) {
      this.isMobile = mobile;
      this.W = targetW;
      this.H = targetH;
      this.dpr = dpr;
      this.canvas.width = Math.round(this.W * dpr);
      this.canvas.height = Math.round(this.H * dpr);
      if (this.runner?.player) {
        this.runner.player.x = mobile ? 96 : 138;
      }
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
        btn.classList.add('is-active');
        this.handleAction(action, true);
      };
      btn.addEventListener('mousedown', trigger);
      btn.addEventListener('touchstart', trigger, { passive: false });

      const release = () => {
        const action = btn.dataset.arcadeAction;
        btn.classList.remove('is-active');
        if (action === 'crouch') {
          this.handleAction('crouch', false);
        }
      };
      btn.addEventListener('mouseup', release);
      btn.addEventListener('mouseleave', release);
      btn.addEventListener('touchend', release);
      btn.addEventListener('touchcancel', release);
    });

    if (this.canvas) {
      let touchStartY = null;
      this.canvas.addEventListener('pointerdown', (e) => {
        const rect = this.canvas.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / Math.max(rect.width, 1)) * this.W;
        const y = ((e.clientY - rect.top) / Math.max(rect.height, 1)) * this.H;
        touchStartY = e.clientY;

        if (this.mode === 'runner') {
          if (this.runner.state !== 'playing') {
            this.startGame();
          } else if (x > this.W * 0.7) {
            this.handleAction('shockwave', true);
          } else if (y > this.H * 0.74) {
            this.handleAction('crouch', true);
            setTimeout(() => this.handleAction('crouch', false), 360);
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

      this.canvas.addEventListener('pointermove', (e) => {
        if (touchStartY !== null && this.mode === 'runner' && this.runner.state === 'playing') {
          if (e.clientY - touchStartY > 28) {
            this.handleAction('crouch', true);
          }
        }
      });

      const endCanvasTouch = () => {
        if (touchStartY !== null && this.mode === 'runner') {
          this.handleAction('crouch', false);
        }
        touchStartY = null;
      };
      this.canvas.addEventListener('pointerup', endCanvasTouch);
      this.canvas.addEventListener('pointercancel', endCanvasTouch);
    }

    window.addEventListener('keydown', (e) => this.handleKeyDown(e));
    window.addEventListener('keyup', (e) => this.handleKeyUp(e));
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
    this.setupHighDPI();
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
      if (e.code === 'KeyJ' || e.code === 'KeyF' || e.code === 'ArrowDown' || e.code === 'ArrowUp') {
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
          p.shockwaveCooldown = 0.55;
          this.soundEngine?.playRim?.();
          r.shockwaves.push({
            x: p.x + 22,
            y: p.y - (p.crouching ? 18 : 32),
            radius: 14,
            maxRadius: 210,
            alpha: 1,
          });
          r.obstacles.forEach((obs) => {
            if (
              !obs.destroyed &&
              obs.type === 'drone' &&
              obs.x > p.x - 24 &&
              obs.x < p.x + 280
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
      const spawnX = this.W + 30;
      if (roll < 0.36) {
        r.obstacles.push({
          type: 'hurdle',
          x: spawnX,
          y: r.groundY - 38,
          w: 34,
          h: 38,
          color: '#f97316',
        });
      } else if (roll < 0.68) {
        const tall = Math.random() > 0.45;
        r.obstacles.push({
          type: 'pillar',
          x: spawnX,
          y: r.groundY - (tall ? 66 : 48),
          w: 28,
          h: tall ? 66 : 48,
          color: '#fb7185',
        });
      } else {
        const highAlt = Math.random() > 0.35;
        r.obstacles.push({
          type: 'drone',
          x: spawnX,
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
        x: this.W + 30,
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
    const root = getComputedStyle(document.documentElement);
    const theme = document.documentElement.getAttribute('data-theme') || 'sunset';
    const isLight = theme === 'light';
    const accent = root.getPropertyValue('--accent').trim() || (isLight ? '#0096a4' : '#7dd3fc');
    const secondary = root.getPropertyValue('--matrix-violet').trim() || (isLight ? '#3a0f34' : '#c084fc');

    return {
      isLight,
      sky: isLight
        ? ['#f7f5ee', '#ede8d8', '#e2dcc8', '#d6ceb8']
        : ['#020307', '#080e1e', '#11182d', '#192138'],
      bloom: isLight
        ? ['rgba(0, 150, 164, 0.14)', 'rgba(58, 15, 52, 0.06)']
        : [`${accent}22`, `${secondary}12`],
      moon: isLight ? '#f59e0b' : '#fef3c7',
      moonCutout: isLight ? null : '#080e1e',
      mtn: isLight
        ? ['rgba(0, 150, 164, 0.14)', 'rgba(3, 18, 17, 0.18)', 'rgba(3, 18, 17, 0.28)']
        : ['rgba(24, 34, 62, 0.78)', 'rgba(15, 22, 42, 0.92)', '#080d1a'],
      road: isLight ? ['#e2ddd0', '#d5cebe'] : ['#0f1626', '#050811'],
      roadLine: accent,
      stud: isLight ? 'rgba(3, 18, 17, 0.25)' : 'rgba(148, 163, 184, 0.45)',
      accent,
      secondary,
      warm: '#f59e0b',
      hurdle: '#f97316',
      pillar: '#fb7185',
      drone: accent,
      scarf: accent,
      torso: isLight ? '#031211' : '#f8fafc',
      limbBack: isLight ? '#627271' : '#64748b',
      shoe: accent,
      hair: isLight ? '#031211' : '#0f172a',
      cardBg: isLight ? ['rgba(255, 255, 255, 0.95)', 'rgba(247, 245, 238, 0.95)'] : ['rgba(8, 12, 22, 0.92)', 'rgba(5, 8, 16, 0.95)'],
      cardBorder: isLight ? 'rgba(3, 18, 17, 0.14)' : 'rgba(255, 255, 255, 0.12)',
      boxBg: isLight ? 'rgba(3, 18, 17, 0.04)' : 'rgba(255, 255, 255, 0.04)',
      boxBorder: isLight ? 'rgba(3, 18, 17, 0.1)' : 'rgba(255, 255, 255, 0.08)',
      textBright: isLight ? '#031211' : '#f8fafc',
      textMuted: isLight ? '#627271' : '#94a3b8',
      ctaText: isLight ? '#ffffff' : '#020307',
      laneColors: [accent, secondary, '#f59e0b'],
    };
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

    // 1. Sky Gradient
    const skyGrad = ctx.createLinearGradient(0, 0, 0, r.groundY);
    skyGrad.addColorStop(0, pal.sky[0]);
    skyGrad.addColorStop(0.45, pal.sky[1]);
    skyGrad.addColorStop(0.78, pal.sky[2]);
    skyGrad.addColorStop(1, pal.sky[3]);
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, W, H);

    // Horizon bloom
    const sunGrad = ctx.createRadialGradient(
      W * 0.72,
      r.groundY - 30,
      8,
      W * 0.72,
      r.groundY - 30,
      220
    );
    sunGrad.addColorStop(0, pal.bloom[0]);
    sunGrad.addColorStop(0.5, pal.bloom[1]);
    sunGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = sunGrad;
    ctx.fillRect(0, 0, W, r.groundY);

    // 2. Starfield & Crescent Moon
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
    const moonX = W * 0.82;
    const moonY = 58;
    ctx.fillStyle = pal.moon;
    ctx.beginPath();
    ctx.arc(moonX, moonY, 14, 0, Math.PI * 2);
    ctx.fill();
    if (pal.moonCutout) {
      ctx.fillStyle = pal.moonCutout;
      ctx.beginPath();
      ctx.arc(moonX - 5, moonY - 3, 12.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // 3. Three Parallax Himalayan Mountain Ridges + Pine Silhouettes
    this.drawMountainLayer(ctx, W, r.groundY, r.bgScroll, 0.14, 110, 32, 16, pal.mtn[0], false);
    this.drawMountainLayer(ctx, W, r.groundY, r.bgScroll, 0.28, 70, 22, 12, pal.mtn[1], true);
    this.drawMountainLayer(ctx, W, r.groundY, r.bgScroll, 0.48, 34, 13, 7, pal.mtn[2], true);

    // 4. Road Deck & Reflective Track Markers
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
    }

    // 5. Collectible Vinyl / Rhythm Medallions
    r.orbs.forEach((orb) => {
      const bobY = orb.y + Math.sin(orb.phase) * 3.5;
      ctx.save();
      ctx.fillStyle = pal.isLight ? '#ffffff' : '#1e293b';
      ctx.strokeStyle = pal.accent;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(orb.x, bobY, orb.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = pal.warm;
      ctx.beginPath();
      ctx.arc(orb.x, bobY, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    // 6. Obstacles (Track Hurdles, Pillars, Rotary Drones)
    r.obstacles.forEach((obs) => {
      ctx.save();
      if (obs.type === 'hurdle') {
        ctx.strokeStyle = pal.textMuted;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(obs.x + 6, obs.y + 8);
        ctx.lineTo(obs.x + 4, obs.y + obs.h);
        ctx.moveTo(obs.x + obs.w - 6, obs.y + 8);
        ctx.lineTo(obs.x + obs.w - 4, obs.y + obs.h);
        ctx.stroke();

        ctx.fillStyle = pal.hurdle;
        ctx.beginPath();
        ctx.roundRect(obs.x, obs.y, obs.w, 11, 4);
        ctx.fill();
      } else if (obs.type === 'pillar') {
        ctx.fillStyle = pal.isLight ? '#d5cebe' : '#1e293b';
        ctx.strokeStyle = pal.pillar;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.roundRect(obs.x, obs.y, obs.w, obs.h, 6);
        ctx.fill();
        ctx.stroke();
      } else {
        const cx = obs.x + obs.w * 0.5;
        const cy = obs.y + obs.h * 0.5;
        const hoverBob = Math.sin(this.visualTime * 9 + obs.x * 0.03) * 2.5;

        const beamGrad = ctx.createLinearGradient(cx, cy + hoverBob, cx - 16, r.groundY);
        beamGrad.addColorStop(0, pal.isLight ? 'rgba(0, 150, 164, 0.16)' : 'rgba(125, 211, 252, 0.18)');
        beamGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = beamGrad;
        ctx.beginPath();
        ctx.moveTo(cx - 5, cy + hoverBob + 6);
        ctx.lineTo(cx + 5, cy + hoverBob + 6);
        ctx.lineTo(cx + 20, r.groundY);
        ctx.lineTo(cx - 30, r.groundY);
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

        ctx.fillStyle = pal.isLight ? '#ffffff' : '#0f172a';
        ctx.strokeStyle = pal.drone;
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.roundRect(obs.x + 3, cy + hoverBob - 6, obs.w - 6, 13, 6);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = pal.warm;
        ctx.beginPath();
        ctx.arc(cx - 4, cy + hoverBob, 3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    });

    // 7. Expanding Rings & J-Key Acoustic Shockwave
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

    // 8. Articulated Runner
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
      this.drawMinimalOverlay(ctx, W, H, pal, {
        title: 'Night Run',
        chips: ['Jump', 'Duck', 'J · Pulse Drone'],
        cta: 'Start Run →',
      });
    } else if (r.state === 'gameover') {
      this.drawMinimalOverlay(ctx, W, H, pal, {
        title: `${Math.floor(r.score)} pts · ${r.distanceKm.toFixed(2)} km`,
        chips: [`Best ${this.hiScores.runner} pts`],
        cta: 'Play Again ↻',
      });
    }
  }

  drawMinimalOverlay(ctx, W, H, pal, { title, chips = [], cta }) {
    ctx.save();
    ctx.fillStyle = pal.isLight ? 'rgba(247, 245, 238, 0.62)' : 'rgba(2, 4, 10, 0.62)';
    ctx.fillRect(0, 0, W, H);

    const cardW = Math.min(W - 32, 360);
    const cardH = 164;
    const cardX = Math.round((W - cardW) / 2);
    const cardY = Math.round((H - cardH) / 2);

    ctx.fillStyle = pal.cardBg[0];
    ctx.strokeStyle = pal.cardBorder;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.roundRect(cardX, cardY, cardW, cardH, 16);
    ctx.fill();
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.fillStyle = pal.textBright;
    ctx.font = '700 22px "Space Grotesk", -apple-system, sans-serif';
    ctx.fillText(title, W / 2, cardY + 42);

    // Minimal control chips row
    if (chips.length > 0) {
      ctx.font = '600 11px "JetBrains Mono", monospace';
      const chipText = chips.join('   ·   ');
      ctx.fillStyle = pal.textMuted;
      ctx.fillText(chipText, W / 2, cardY + 76);
    }

    const pillW = 164;
    const pillH = 36;
    const pillX = Math.round((W - pillW) / 2);
    const pillY = cardY + cardH - 52;

    ctx.fillStyle = pal.accent;
    ctx.beginPath();
    ctx.roundRect(pillX, pillY, pillW, pillH, 999);
    ctx.fill();

    ctx.fillStyle = pal.ctaText;
    ctx.font = '700 12.5px "Space Grotesk", -apple-system, sans-serif';
    ctx.fillText(cta, W / 2, pillY + 23);
    ctx.restore();
  }

  drawArticulatedRunner(ctx, p, groundY, pal = this.getThemePalette()) {
    ctx.save();
    const x = p.x;
    const y = p.y;
    const airborne = y < groundY - 2;
    const crouch = p.crouching;
    const phase = p.phase;

    if (p.flipAngle > 0) {
      ctx.translate(x, y - 24);
      ctx.rotate(p.flipAngle);
      ctx.translate(-x, -(y - 24));
    }

    const heightRatio = Math.max(0.2, 1 - (groundY - y) / 160);
    ctx.fillStyle = pal.isLight
      ? `rgba(3, 18, 17, ${0.22 * heightRatio})`
      : `rgba(2, 4, 10, ${0.55 * heightRatio})`;
    ctx.beginPath();
    ctx.ellipse(x, groundY + 3, 17 * heightRatio, 3.8 * heightRatio, 0, 0, Math.PI * 2);
    ctx.fill();

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

  getLaneX(lane) {
    const span = Math.min(this.W - 110, 420);
    const startX = (this.W - span) / 2;
    return startX + lane * (span / 2);
  }

  updateRhythm(dt) {
    const rh = this.rhythm;
    for (let i = 0; i < 3; i += 1) {
      rh.laneFlashes[i] = Math.max(0, rh.laneFlashes[i] - dt * 4.5);
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

    const laneX = this.getLaneX(lane);
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

    // Subtle EQ spectrum along top
    const bars = 28;
    const barSpan = Math.min(W - 60, 460);
    const startBarX = (W - barSpan) / 2;
    for (let b = 0; b < bars; b += 1) {
      const bx = startBarX + b * (barSpan / bars);
      const wave =
        Math.sin(this.visualTime * 6 + b * 0.45) * 0.5 +
        0.5 +
        (rh.laneFlashes[b % 3] || 0) * 0.8;
      const bh = 5 + wave * 16;
      ctx.fillStyle = pal.accent;
      ctx.globalAlpha = 0.15;
      ctx.fillRect(bx, 34 - bh, 6, bh);
    }
    ctx.globalAlpha = 1;

    const laneColors = pal.laneColors;
    const laneLabels = ['Kick', 'Snare', 'Hat'];
    const hitY = 308;
    const topY = 44;
    const travelTime = 1.18;

    for (let i = 0; i < 3; i += 1) {
      const lx = this.getLaneX(i);
      const flash = rh.laneFlashes[i];

      ctx.fillStyle = pal.isLight ? 'rgba(3, 18, 17, 0.05)' : 'rgba(15, 23, 42, 0.42)';
      ctx.strokeStyle = pal.boxBorder;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(lx - 46, topY, 92, hitY - topY + 18, 12);
      ctx.fill();
      ctx.stroke();

      const padPressOffset = flash * 3;
      ctx.save();
      ctx.fillStyle = flash > 0.05 ? laneColors[i] : pal.isLight ? '#ffffff' : '#1e293b';
      ctx.strokeStyle = laneColors[i];
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(lx - 38, hitY - 12 + padPressOffset, 76, 24, 8);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = pal.textMuted;
      ctx.font = '600 11px "Space Grotesk", -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(laneLabels[i], lx, hitY + 30);
      ctx.restore();
    }

    rh.notes.forEach((note) => {
      if (note.hit) return;
      const timeRemaining = note.targetTime - rh.songTime;
      const progress = 1 - timeRemaining / travelTime;
      if (progress < -0.05 || progress > 1.12) return;

      const lx = this.getLaneX(note.lane);
      const ny = topY + progress * (hitY - topY);
      const color = laneColors[note.lane];

      ctx.save();
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.roundRect(lx - 28, ny - 7, 56, 14, 6);
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
      ctx.fillText(rh.feedback.text, W / 2, 24);
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
      this.drawMinimalOverlay(ctx, W, H, pal, {
        title: 'Drum Pad',
        chips: ['Kick', 'Snare', 'Hat'],
        cta: 'Start Jam →',
      });
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
