function clamp(val, min, max) {
  return Math.min(Math.max(val, min), max);
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

/**
 * Closest point on a rounded pill rectangle perimeter to (px, py),
 * plus parametric perimeter coordinate for full-carapace wrapping.
 */
function closestPointOnPill(rect, px, py) {
  const r = Math.min(rect.width, rect.height) * 0.5;
  const minX = rect.left + r;
  const maxX = rect.right - r;
  const cy = rect.top + rect.height * 0.5;

  const spineX = clamp(px, minX, maxX);
  const dx = px - spineX;
  const dy = py - cy;
  const distFromSpine = Math.hypot(dx, dy);

  const nx = distFromSpine > 0.001 ? dx / distFromSpine : 0;
  const ny = distFromSpine > 0.001 ? dy / distFromSpine : dy >= 0 ? 1 : -1;

  const edgeX = spineX + nx * r;
  const edgeY = cy + ny * r;
  const inside = distFromSpine < r;
  const dist = Math.max(0, distFromSpine - r);

  return { x: edgeX, y: edgeY, nx, ny, inside, dist, r, spineX, cy };
}

/**
 * Samples a point and outward normal anywhere along the pill perimeter by angletheta
 */
function samplePillPerimeter(rect, angle) {
  const cx = rect.left + rect.width * 0.5;
  const cy = rect.top + rect.height * 0.5;
  const rx = rect.width * 0.5;
  const ry = rect.height * 0.5;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);

  // Superellipse / Stadium parametric approximation
  const r = Math.min(rx, ry);
  const halfStraight = Math.max(0, rx - r);
  const spineOffset = clamp(cos * rx, -halfStraight, halfStraight);
  const capX = cx + spineOffset + cos * r;
  const capY = cy + sin * r;

  const nx = cos;
  const ny = sin;
  return { x: capX, y: capY, nx, ny };
}

/**
 * Draws a smooth closed path through a ring of points using midpoint quadratic curves
 */
function traceSmoothClosedLoop(ctx, pts) {
  const len = pts.length;
  if (len < 3) return;
  const firstMidX = (pts[len - 1].x + pts[0].x) * 0.5;
  const firstMidY = (pts[len - 1].y + pts[0].y) * 0.5;
  ctx.moveTo(firstMidX, firstMidY);
  for (let i = 0; i < len; i += 1) {
    const next = pts[(i + 1) % len];
    const midX = (pts[i].x + next.x) * 0.5;
    const midY = (pts[i].y + next.y) * 0.5;
    ctx.quadraticCurveTo(pts[i].x, pts[i].y, midX, midY);
  }
  ctx.closePath();
}

/**
 * VenomSymbioteEffect — OVERDRIVE EDITION
 * Hyper-visceral, multi-pass ferrofluid / symbiote organism connecting [data-venom-btn]
 * ("Let's Connect") buttons to the cursor with:
 * - 16 multi-tiered arterial & whip-lash hunter tendrils
 * - Full-perimeter ferrofluid carapace spikes that bristle on proximity & drum hits
 * - Procedural Y-branching parasite offshoots & torn liquid webbing membranes
 * - Predatory cursor vortex maw with orbiting symbiote satellites
 * - Homing viscoelastic splatter droplets that arc out and get magnetically recalled into the button
 */
export class VenomSymbioteEffect {
  constructor() {
    this.canvas = document.getElementById('venom-canvas');
    if (!this.canvas) {
      this.canvas = document.createElement('canvas');
      this.canvas.id = 'venom-canvas';
      this.canvas.className = 'venom-canvas';
      this.canvas.setAttribute('aria-hidden', 'true');
      document.body.appendChild(this.canvas);
    }
    this.ctx = this.canvas.getContext('2d');
    this.buttons = [...document.querySelectorAll('[data-venom-btn]')];
    this.otherInteractives = [
      ...document.querySelectorAll(
        'a:not([data-venom-btn]), button:not([data-venom-btn]), input, select'
      ),
    ];
    this.pointer = {
      x: -9999,
      y: -9999,
      vx: 0,
      vy: 0,
      smoothVx: 0,
      smoothVy: 0,
      speed: 0,
      prevX: -9999,
      prevY: -9999,
      overSibling: false,
      down: false,
    };
    this.pixelRatio = 1;
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    // Natural hunting & scent range for silky fluid attraction
    this.maxProximity = 110;
    this.scentProximity = 160;
    this.beatShock = 0;
    this.states = new Map();
    this.droplets = [];

    this.initButtonStates();
    this.resize();
    this.bind();
  }

  initButtonStates() {
    const STRAND_COUNT = 16;
    const SPIKE_COUNT = 28;
    this.buttons.forEach((btn) => {
      const strands = [];
      for (let i = 0; i < STRAND_COUNT; i += 1) {
        const norm = (i / (STRAND_COUNT - 1)) * 2 - 1; // -1 .. +1
        const isHunter = i % 3 === 1;
        const isArterial = i % 3 === 0;
        strands.push({
          index: i,
          spread: norm,
          isHunter,
          isArterial,
          phase: i * 0.83 + Math.random() * Math.PI * 2,
          freq: isHunter ? 3.1 + (i % 4) * 0.55 : 1.7 + (i % 3) * 0.5,
          thickness:
            (1 - Math.abs(norm) * 0.42) *
            (isArterial ? 1.42 : isHunter ? 0.78 : 1.05),
          reachThreshold: isHunter
            ? 1 - Math.abs(norm) * 0.18
            : 1 - Math.abs(norm) * 0.36,
          whipBias: (i % 2 === 0 ? 1 : -1) * (0.65 + (i % 5) * 0.18),
          c1x: 0,
          c1y: 0,
          v1x: 0,
          v1y: 0,
          c2x: 0,
          c2y: 0,
          v2x: 0,
          v2y: 0,
          tipX: 0,
          tipY: 0,
          tipVx: 0,
          tipVy: 0,
          initialized: false,
        });
      }

      const spikes = [];
      for (let s = 0; s < SPIKE_COUNT; s += 1) {
        spikes.push({
          angle: (s / SPIKE_COUNT) * Math.PI * 2,
          phase: s * 1.17 + Math.random() * Math.PI,
          freq: 2.4 + (s % 5) * 0.65,
          lenMult: 0.55 + ((s * 7) % 11) / 11 * 0.9,
          height: 0,
          vel: 0,
        });
      }

      this.states.set(btn, {
        strands,
        spikes,
        engagement: 0,
        scent: 0,
        peakEngagement: 0,
        pullX: 0,
        pullY: 0,
        scale: 1,
        snapCooldown: 0,
      });
    });
  }

  bind() {
    window.addEventListener('resize', () => this.resize(), { passive: true });
    window.addEventListener(
      'pointermove',
      (e) => {
        if (e.pointerType === 'touch') return;
        this.pointer.x = e.clientX;
        this.pointer.y = e.clientY;

        const target = e.target;
        if (target && typeof target.closest === 'function') {
          const interactive = target.closest('a, button, input, select, [role="button"]');
          this.pointer.overSibling = Boolean(
            interactive && !interactive.hasAttribute('data-venom-btn')
          );
        } else {
          this.pointer.overSibling = false;
        }
      },
      { passive: true }
    );

    window.addEventListener(
      'pointerdown',
      (e) => {
        this.pointer.down = true;
        this.buttons.forEach((btn) => {
          const state = this.states.get(btn);
          if (state && state.engagement > 0.25) {
            const rect = btn.getBoundingClientRect();
            const nearest = closestPointOnPill(rect, e.clientX, e.clientY);
            this.spawnSnapDroplets(
              e.clientX,
              e.clientY,
              nearest.nx,
              nearest.ny,
              22,
              btn
            );
            this.beatShock = Math.max(this.beatShock, 1.4);
          }
        });
      },
      { passive: true }
    );

    window.addEventListener(
      'pointerup',
      () => {
        this.pointer.down = false;
      },
      { passive: true }
    );

    window.addEventListener('pointerleave', () => {
      this.pointer.x = -9999;
      this.pointer.y = -9999;
      this.pointer.overSibling = false;
      this.pointer.down = false;
    });
  }

  /**
   * Triggers a rhythmic convulsion across all active symbiote carapaces & tendrils
   */
  pulse(strength = 1) {
    this.beatShock = Math.min(Math.max(this.beatShock, strength), 2.0);
  }

  resize() {
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(this.width * this.pixelRatio);
    this.canvas.height = Math.round(this.height * this.pixelRatio);
  }

  isNearSiblingButton(activeBtn, nearestDist = 999) {
    // Never cut off the symbiote when the cursor is over or within 64px of the host button itself
    if (nearestDist <= 64) return false;
    const px = this.pointer.x;
    const py = this.pointer.y;
    if (px < -100 || py < -100) return false;

    const parent = activeBtn.closest('.cta-row, .contact-actions, .hero-minimal-footer');
    if (parent) {
      const siblings = parent.querySelectorAll('a, button');
      for (let i = 0; i < siblings.length; i += 1) {
        const sib = siblings[i];
        if (sib === activeBtn || activeBtn.contains(sib)) continue;
        const r = sib.getBoundingClientRect();
        if (r.width === 0) continue;
        if (px >= r.left && px <= r.right && py >= r.top && py <= r.bottom) {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Spawns viscoelastic symbiote droplets that explode outward and then
   * magnetically home back into the host button!
   */
  spawnSnapDroplets(x, y, nx, ny, count = 12, hostBtn = null) {
    for (let i = 0; i < count; i += 1) {
      const spreadAngle = Math.atan2(ny, nx) + (Math.random() - 0.5) * 1.6;
      const speed = 2.4 + Math.random() * 6.5;
      this.droplets.push({
        x,
        y,
        prevX: x,
        prevY: y,
        vx: Math.cos(spreadAngle) * speed,
        vy: Math.sin(spreadAngle) * speed,
        radius: 1.2 + Math.random() * 2.2,
        stretch: 1.2 + Math.random() * 1.0,
        life: 1,
        age: 0,
        decay: 0.02 + Math.random() * 0.016,
        hostBtn,
        isViolet: i % 3 === 0,
      });
    }
  }

  getPalette() {
    const root = getComputedStyle(document.documentElement);
    const theme = document.documentElement.getAttribute('data-theme') || 'sunset';
    const accent = root.getPropertyValue('--accent').trim() || '#7dd3fc';
    const violet = root.getPropertyValue('--matrix-violet').trim() || '#c084fc';
    const bright = root.getPropertyValue('--text-bright').trim() || '#f8fafc';
    return {
      coreDark: theme === 'light' ? '#03060c' : '#02040a',
      coreMid: theme === 'light' ? '#0a1622' : '#081122',
      accent,
      violet,
      bright,
    };
  }

  /**
   * Computes smooth cubic-bezier strand geometry with chaotic peristaltic globules & spikes
   */
  buildStrandGeometry(ax, ay, c1x, c1y, c2x, c2y, tx, ty, opts) {
    const {
      timeSec,
      phase,
      freq,
      baseWidth,
      waistWidth,
      tipWidth,
      latched,
      isHunter,
      chaosBoost,
    } = opts;
    const STEPS = 28;
    const leftPts = [];
    const rightPts = [];
    const spinePts = [];

    for (let s = 0; s <= STEPS; s += 1) {
      const t = s / STEPS;
      const inv = 1 - t;

      const b0 = inv * inv * inv;
      const b1 = 3 * inv * inv * t;
      const b2 = 3 * inv * t * t;
      const b3 = t * t * t;

      let x = b0 * ax + b1 * c1x + b2 * c2x + b3 * tx;
      let y = b0 * ay + b1 * c1y + b2 * c2y + b3 * ty;

      const dxdt =
        3 * inv * inv * (c1x - ax) + 6 * inv * t * (c2x - c1x) + 3 * t * t * (tx - c2x);
      const dydt =
        3 * inv * inv * (c1y - ay) + 6 * inv * t * (c2y - c1y) + 3 * t * t * (ty - c2y);
      const len = Math.hypot(dxdt, dydt) || 1;
      const nx = -dydt / len;
      const ny = dxdt / len;

      // Smooth organic fluid ripple perpendicular to spine
      const envelope = Math.sin(t * Math.PI);
      const whipAmp = (isHunter ? 2.4 : 1.6) * (1 + chaosBoost * 0.25);
      const fluidWave =
        (Math.sin(t * freq * Math.PI * 2 - timeSec * 4.6 + phase) * whipAmp +
          Math.cos(t * 6.5 + timeSec * 3.4 - phase * 0.7) * (whipAmp * 0.35)) *
        envelope;

      x += nx * fluidWave;
      y += ny * fluidWave;

      // Silky capillary surface tension waves (smooth, thin, never spiky)
      const pulse1 = Math.sin(t * Math.PI * 3.2 - timeSec * 5.2 + phase) * 0.5 + 0.5;
      const peristalsis = pulse1 * envelope * (baseWidth * 0.22);

      const baseFlare = Math.pow(inv, 1.8) * baseWidth;
      const midWaist = 4 * t * inv * waistWidth;
      const tipFlare = latched
        ? Math.pow(t, 1.6) * tipWidth
        : Math.pow(inv, 0.65) * tipWidth * 0.3;
      const halfW = Math.max(0.45, baseFlare + midWaist + tipFlare + peristalsis);

      spinePts.push({ x, y, nx, ny, halfW, t });
      leftPts.push({ x: x + nx * halfW, y: y + ny * halfW });
      rightPts.push({ x: x - nx * halfW, y: y - ny * halfW });
    }

    const contour = [...leftPts];
    for (let i = rightPts.length - 1; i >= 0; i -= 1) {
      contour.push(rightPts[i]);
    }

    return { contour, spinePts };
  }

  render(timeMs) {
    if (!this.ctx) return;
    const timeSec = timeMs * 0.001;
    const ctx = this.ctx;

    if (this.pointer.x > -1000 && this.pointer.prevX > -1000) {
      this.pointer.vx = clamp(this.pointer.x - this.pointer.prevX, -52, 52);
      this.pointer.vy = clamp(this.pointer.y - this.pointer.prevY, -52, 52);
    } else {
      this.pointer.vx = 0;
      this.pointer.vy = 0;
    }
    this.pointer.prevX = this.pointer.x;
    this.pointer.prevY = this.pointer.y;
    this.pointer.smoothVx = lerp(this.pointer.smoothVx, this.pointer.vx, 0.32);
    this.pointer.smoothVy = lerp(this.pointer.smoothVy, this.pointer.vy, 0.32);
    this.pointer.speed = Math.hypot(this.pointer.smoothVx, this.pointer.smoothVy);
    this.beatShock *= 0.88;

    ctx.setTransform(this.pixelRatio, 0, 0, this.pixelRatio, 0, 0);
    ctx.clearRect(0, 0, this.width, this.height);

    const palette = this.getPalette();
    const chaosBoost = clamp(this.pointer.speed / 18 + this.beatShock, 0, 2.2);

    this.buttons.forEach((btn) => {
      const rect = btn.getBoundingClientRect();
      if (rect.bottom < -120 || rect.top > this.height + 120 || rect.width === 0) return;

      const state = this.states.get(btn);
      if (!state) return;

      if (state.snapCooldown > 0) state.snapCooldown -= 1;

      const footerParent = btn.closest('.hero-minimal-footer');
      const parentOpacity = footerParent ? parseFloat(footerParent.style.opacity || '1') : 1;
      const btnStyle = getComputedStyle(btn);
      const isHiddenOrUnrevealed =
        btn.dataset.venomReady === 'false' ||
        parentOpacity < 0.85 ||
        btnStyle.visibility === 'hidden' ||
        btnStyle.pointerEvents === 'none' ||
        parseFloat(btnStyle.opacity || '1') < 0.85;

      if (isHiddenOrUnrevealed) {
        state.engagement = 0;
        state.scent = 0;
        state.peakEngagement = 0;
        state.strands.forEach((s) => {
          s.initialized = false;
        });
        if (btn.classList.contains('is-venom-active')) {
          btn.style.setProperty('--venom-pull-x', '0px');
          btn.style.setProperty('--venom-pull-y', '0px');
          btn.style.setProperty('--venom-scale', '1');
          btn.style.setProperty('--venom-intensity', '0');
          btn.classList.remove('is-venom-active');
        }
        return;
      }

      const nearest = closestPointOnPill(rect, this.pointer.x, this.pointer.y);
      const isOnButton =
        nearest.inside ||
        (this.pointer.x >= rect.left &&
          this.pointer.x <= rect.right &&
          this.pointer.y >= rect.top &&
          this.pointer.y <= rect.bottom);
      const isHeroBtn = btn.classList.contains('venom-connect-btn--hero');
      const isCenterpiece = btn.classList.contains('venom-connect-btn--centerpiece');
      const maxRange = isHeroBtn || isCenterpiece ? this.maxProximity + 45 : this.maxProximity;
      const scentRange = isHeroBtn || isCenterpiece ? this.scentProximity + 55 : this.scentProximity;

      const blockedBySibling = this.isNearSiblingButton(btn, nearest.dist);
      const rawProximity =
        isOnButton || blockedBySibling ? 0 : clamp(1 - nearest.dist / maxRange, 0, 1);
      const rawScent =
        isOnButton || blockedBySibling ? 0 : clamp(1 - nearest.dist / scentRange, 0, 1);

      if (isOnButton) {
        state.peakEngagement = 0;
        state.edgeInitialized = false;
      }

      const targetEngagement = rawProximity > 0 ? Math.pow(rawProximity, 0.68) : 0;
      const rate = isOnButton
        ? 0.42
        : blockedBySibling
          ? 0.28
          : targetEngagement > state.engagement
            ? 0.22
            : 0.18;
      state.engagement += (targetEngagement - state.engagement) * rate;
      state.scent += (rawScent - state.scent) * (isOnButton ? 0.42 : 0.15);
      if (state.engagement < 0.008) state.engagement = 0;
      if (state.scent < 0.008) state.scent = 0;

      // Violent snap-off splatter when cursor rips free from the symbiote outside the button
      if (state.engagement > 0.48 && !isOnButton) {
        state.peakEngagement = Math.max(state.peakEngagement, state.engagement);
      }
      if (
        state.peakEngagement > 0.52 &&
        rawProximity === 0 &&
        !isOnButton &&
        state.snapCooldown === 0 &&
        !blockedBySibling
      ) {
        this.spawnSnapDroplets(
          lerp(nearest.x, this.pointer.x, 0.62),
          lerp(nearest.y, this.pointer.y, 0.62),
          -nearest.nx,
          -nearest.ny,
          18,
          btn
        );
        state.peakEngagement = 0;
        state.snapCooldown = 22;
      }
      if (state.engagement < 0.08) {
        state.peakEngagement = 0;
      }

      // Continuous micro-spatter while whipping cursor at high speed during latch
      if (!isOnButton && state.engagement > 0.55 && this.pointer.speed > 16 && Math.random() < 0.42) {
        this.spawnSnapDroplets(
          this.pointer.x + (Math.random() - 0.5) * 14,
          this.pointer.y + (Math.random() - 0.5) * 14,
          this.pointer.smoothVx,
          this.pointer.smoothVy,
          2,
          btn
        );
      }

      // Stronger magnetic button pull & liquid swell toward cursor (stops cleanly when on button)
      const cx = rect.left + rect.width * 0.5;
      const cy = rect.top + rect.height * 0.5;
      const toCursorX = this.pointer.x - cx;
      const toCursorY = this.pointer.y - cy;
      const targetPullX = rawProximity > 0 ? clamp(toCursorX * 0.14, -18, 18) * rawProximity : 0;
      const targetPullY = rawProximity > 0 ? clamp(toCursorY * 0.18, -14, 14) * rawProximity : 0;
      const targetScale = 1 + state.engagement * 0.075 + this.beatShock * 0.03;

      state.pullX = lerp(state.pullX, targetPullX, isOnButton ? 0.32 : 0.16);
      state.pullY = lerp(state.pullY, targetPullY, isOnButton ? 0.32 : 0.16);
      state.scale = lerp(state.scale, targetScale, isOnButton ? 0.32 : 0.16);

      if (state.engagement > 0.01 || state.scent > 0.02 || Math.abs(state.pullX) > 0.05) {
        btn.style.setProperty('--venom-pull-x', `${state.pullX.toFixed(2)}px`);
        btn.style.setProperty('--venom-pull-y', `${state.pullY.toFixed(2)}px`);
        btn.style.setProperty('--venom-scale', state.scale.toFixed(3));
        btn.style.setProperty('--venom-intensity', state.engagement.toFixed(3));
        btn.classList.toggle('is-venom-active', state.engagement > 0.03);
      } else if (btn.classList.contains('is-venom-active')) {
        btn.style.setProperty('--venom-pull-x', '0px');
        btn.style.setProperty('--venom-pull-y', '0px');
        btn.style.setProperty('--venom-scale', '1');
        btn.style.setProperty('--venom-intensity', '0');
        btn.classList.remove('is-venom-active');
      }

      const ambientAwake = isOnButton
        ? state.engagement
        : Math.max(state.scent * 0.45, state.engagement, this.beatShock * 0.65);
      if (ambientAwake < 0.015 || (isOnButton && state.engagement < 0.04)) {
        state.strands.forEach((s) => {
          s.initialized = false;
        });
        return;
      }

      // ====================================================================
      // 0. FULL-PERIMETER LIVING FERROFLUID CARAPACE & WRITHING SPIKES
      // ====================================================================
      const carapacePts = [];
      const cursorAngleFromCenter = Math.atan2(this.pointer.y - cy, this.pointer.x - cx);

      state.spikes.forEach((sp) => {
        const perim = samplePillPerimeter(rect, sp.angle);
        const angleDiff = Math.atan2(
          Math.sin(sp.angle - cursorAngleFromCenter),
          Math.cos(sp.angle - cursorAngleFromCenter)
        );
        const facingCursor = Math.pow(Math.max(0, Math.cos(angleDiff * 0.65)), 1.6);

        const wave1 = Math.sin(timeSec * sp.freq * 2.4 + sp.phase);
        const wave2 = Math.cos(timeSec * 5.8 - sp.phase * 1.3);
        const spikePulse = Math.max(0, wave1 * 0.65 + wave2 * 0.35);

        const targetHeight =
          (2.2 +
            state.scent * 7.5 * facingCursor +
            state.engagement * (10 + 18 * facingCursor) * sp.lenMult +
            this.beatShock * 11 * sp.lenMult) *
          (0.35 + 0.85 * spikePulse);

        sp.vel = (sp.vel + (targetHeight - sp.height) * 0.24) * 0.76;
        sp.height = Math.max(0, sp.height + sp.vel);

        // Tangential shear so spikes bend toward the cursor
        const tx = -perim.ny;
        const ty = perim.nx;
        const shear = Math.sin(angleDiff) * state.engagement * 6.5;

        carapacePts.push({
          x: perim.x + perim.nx * sp.height + tx * shear,
          y: perim.y + perim.ny * sp.height + ty * shear,
          baseX: perim.x,
          baseY: perim.y,
          nx: perim.nx,
          ny: perim.ny,
          height: sp.height,
        });
      });

      if (state.engagement < 0.015) {
        return;
      }

      // Smoothly interpolate edge point and normal so crossing top -> over button -> bottom never teleports
      if (!state.edgeInitialized) {
        state.smoothEdgeX = nearest.x;
        state.smoothEdgeY = nearest.y;
        state.smoothNx = nearest.nx;
        state.smoothNy = nearest.ny;
        state.edgeInitialized = true;
      } else {
        state.smoothEdgeX = lerp(state.smoothEdgeX, nearest.x, 0.36);
        state.smoothEdgeY = lerp(state.smoothEdgeY, nearest.y, 0.36);
        state.smoothNx = lerp(state.smoothNx, nearest.nx, 0.32);
        state.smoothNy = lerp(state.smoothNy, nearest.ny, 0.32);
        const nLen = Math.hypot(state.smoothNx, state.smoothNy) || 1;
        state.smoothNx /= nLen;
        state.smoothNy /= nLen;
      }

      const edgeX = state.smoothEdgeX;
      const edgeY = state.smoothEdgeY;
      const enx = state.smoothNx;
      const eny = state.smoothNy;

      // Tangent vector along pill boundary at smoothed point
      const tx = -eny;
      const ty = enx;
      const spreadSpan = Math.min(Math.max(rect.width * 0.42, 48), 110);

      const effPointerX = this.pointer.x;
      const effPointerY = this.pointer.y;

      // 1. Build smooth ferrofluid meniscus along the button outer edge (never invading inside the button)
      const meniscusPts = [];
      const MENISCUS_STEPS = 20;
      const puddleSpan = spreadSpan * (0.35 + state.engagement * 0.35);
      for (let m = 0; m <= MENISCUS_STEPS; m += 1) {
        const u = (m / MENISCUS_STEPS) * 2 - 1;
        const bell = Math.cos(u * Math.PI * 0.5);
        const ripple = Math.sin(u * 5 - timeSec * 5.2) * 1.2 * bell;
        const bulge =
          (1.8 + state.engagement * 6.5 + this.beatShock * 3.5) * Math.pow(bell, 1.6) +
          ripple * state.engagement;

        const baseX = clamp(edgeX + tx * u * puddleSpan, rect.left + 2, rect.right - 2);
        const baseY = clamp(edgeY + ty * u * puddleSpan, rect.top + 2, rect.bottom - 2);
        meniscusPts.push({
          x: baseX + enx * bulge,
          y: baseY + eny * bulge,
        });
      }
      // Close along the outer boundary of the button edge so the button face remains 100% uncovered
      meniscusPts.push({
        x: clamp(edgeX + tx * puddleSpan, rect.left + 2, rect.right - 2),
        y: clamp(edgeY + ty * puddleSpan, rect.top + 2, rect.bottom - 2),
      });
      meniscusPts.push({
        x: clamp(edgeX - tx * puddleSpan, rect.left + 2, rect.right - 2),
        y: clamp(edgeY - ty * puddleSpan, rect.top + 2, rect.bottom - 2),
      });

      // 2. Simulate and build all 16 cubic-bezier symbiote tendrils
      const builtStrands = [];
      state.strands.forEach((strand, idx) => {
        const drift = Math.sin(timeSec * 3.8 + strand.phase) * 9.5;
        const anchorX = clamp(
          edgeX + tx * (strand.spread * spreadSpan + drift) - enx * 2,
          rect.left + 6,
          rect.right - 6
        );
        const anchorY = clamp(
          edgeY + ty * (strand.spread * spreadSpan * 0.55 + drift * 0.45) - eny * 2,
          rect.top + 5,
          rect.bottom - 5
        );

        const isLatched = rawProximity >= 1 - strand.reachThreshold * 0.92;
        const orbitSpeed = strand.isHunter ? 5.6 : 3.8;
        const clawAngle =
          strand.spread * 1.15 +
          Math.sin(timeSec * orbitSpeed + strand.phase) * (strand.isHunter ? 0.65 : 0.32);
        const clawRadius = nearest.inside
          ? 12 + Math.abs(strand.spread) * 8
          : (strand.isHunter ? 10 : 5) + Math.abs(strand.spread) * 11;
        const reachFraction = isLatched
          ? 1
          : clamp(state.engagement * 1.28 * strand.reachThreshold, 0.18, 0.92);

        // Hunter tendrils lash out ahead of the cursor's velocity vector
        const leadX = strand.isHunter ? this.pointer.smoothVx * 0.85 : 0;
        const leadY = strand.isHunter ? this.pointer.smoothVy * 0.85 : 0;

        const targetTipX = lerp(
          anchorX + enx * (22 + Math.abs(strand.spread) * 14),
          effPointerX + Math.cos(clawAngle) * clawRadius + leadX,
          reachFraction
        );
        const targetTipY = lerp(
          anchorY + eny * (22 + Math.abs(strand.spread) * 14),
          effPointerY + Math.sin(clawAngle) * clawRadius + leadY,
          reachFraction
        );

        if (!strand.initialized) {
          strand.tipX = anchorX;
          strand.tipY = anchorY;
          strand.c1x = anchorX;
          strand.c1y = anchorY;
          strand.c2x = anchorX;
          strand.c2y = anchorY;
          strand.v1x = 0;
          strand.v1y = 0;
          strand.v2x = 0;
          strand.v2y = 0;
          strand.tipVx = 0;
          strand.tipVy = 0;
          strand.initialized = true;
        }

        const tipSpring = isLatched ? (strand.isHunter ? 0.26 : 0.21) : 0.16;
        const tipDamp = strand.isHunter ? 0.85 : 0.81;
        strand.tipVx = (strand.tipVx + (targetTipX - strand.tipX) * tipSpring) * tipDamp;
        strand.tipVy = (strand.tipVy + (targetTipY - strand.tipY) * tipSpring) * tipDamp;
        strand.tipX += strand.tipVx;
        strand.tipY += strand.tipVy;

        const spanDx = strand.tipX - anchorX;
        const spanDy = strand.tipY - anchorY;
        const spanLen = Math.hypot(spanDx, spanDy) || 1;
        const perpX = -spanDy / spanLen;
        const perpY = spanDx / spanLen;

        // Wide dramatic S-curve bowing & velocity whip
        const arch1 =
          strand.spread * Math.min(spanLen * 0.42, 62) +
          Math.sin(timeSec * 4.2 + strand.phase) * Math.min(spanLen * 0.22, 26) * strand.whipBias;
        const targetC1x =
          lerp(anchorX, strand.tipX, 0.32) +
          nearest.nx * Math.min(spanLen * 0.28, 34) +
          perpX * arch1 -
          this.pointer.smoothVx * 0.95;
        const targetC1y =
          lerp(anchorY, strand.tipY, 0.32) +
          nearest.ny * Math.min(spanLen * 0.28, 34) +
          perpY * arch1 -
          this.pointer.smoothVy * 0.95;

        const arch2 =
          -strand.spread * Math.min(spanLen * 0.28, 42) -
          Math.cos(timeSec * 5.1 + strand.phase) * Math.min(spanLen * 0.22, 28) * strand.whipBias;
        const targetC2x =
          lerp(anchorX, strand.tipX, 0.68) + perpX * arch2 - this.pointer.smoothVx * 1.95;
        const targetC2y =
          lerp(anchorY, strand.tipY, 0.68) + perpY * arch2 - this.pointer.smoothVy * 1.95;

        strand.v1x = (strand.v1x + (targetC1x - strand.c1x) * 0.17) * 0.83;
        strand.v1y = (strand.v1y + (targetC1y - strand.c1y) * 0.17) * 0.83;
        strand.c1x += strand.v1x;
        strand.c1y += strand.v1y;

        strand.v2x = (strand.v2x + (targetC2x - strand.c2x) * 0.16) * 0.84;
        strand.v2y = (strand.v2y + (targetC2y - strand.c2y) * 0.16) * 0.84;
        strand.c2x += strand.v2x;
        strand.c2y += strand.v2y;

        const tensionStretch = clamp(1 - nearest.dist / (maxRange * 1.2), 0.2, 1);
        const baseW = (1.8 + strand.thickness * 1.8) * state.engagement;
        const waistW = (0.5 + strand.thickness * 0.65) * tensionStretch * state.engagement;
        const tipW = (1.1 + strand.thickness * 1.2) * state.engagement;

        const geom = this.buildStrandGeometry(
          anchorX,
          anchorY,
          strand.c1x,
          strand.c1y,
          strand.c2x,
          strand.c2y,
          strand.tipX,
          strand.tipY,
          {
            timeSec,
            phase: strand.phase,
            freq: strand.freq,
            baseWidth: baseW,
            waistWidth: waistW,
            tipWidth: tipW,
            latched: isLatched,
            isHunter: strand.isHunter,
            chaosBoost,
          }
        );

        builtStrands.push({
          ...geom,
          isPrimary: idx % 2 === 0,
          isArterial: strand.isArterial,
          isHunter: strand.isHunter,
          isLatched,
          phase: strand.phase,
        });
      });

      // 3. Build smooth ferrofluid droplet bead around cursor when latched
      const cursorPoolPts = [];
      const orbitingSatellites = [];
      if (rawProximity > 0.08) {
        const poolAlpha = clamp((rawProximity - 0.08) * 1.2, 0, 1);
        const baseRadius = (5.5 + Math.sin(timeSec * 4.2) * 1.0 + chaosBoost * 1.2) * poolAlpha;
        const NODES = 24;
        for (let n = 0; n < NODES; n += 1) {
          const ang = (n / NODES) * Math.PI * 2;
          const wave =
            Math.sin(ang * 3 - timeSec * 4.8) * 1.1 * poolAlpha +
            Math.cos(ang * 5 + timeSec * 3.6) * 0.7 * poolAlpha;
          const velDot =
            Math.cos(ang) * -this.pointer.smoothVx + Math.sin(ang) * -this.pointer.smoothVy;
          const velStretch = clamp(velDot * 0.22, -1.2, 4.5) * poolAlpha;
          const r = Math.max(2.2, baseRadius + wave + velStretch);
          cursorPoolPts.push({
            x: this.pointer.x + Math.cos(ang) * r,
            y: this.pointer.y + Math.sin(ang) * r,
          });
        }

        // Orbiting micro satellite droplets swirling around cursor
        for (let s = 0; s < 3; s += 1) {
          const satAng = timeSec * (3.6 + s * 0.6) * (s % 2 === 0 ? 1 : -1) + s * (Math.PI * 0.66);
          const satDist = baseRadius + (5 + Math.sin(timeSec * 4.5 + s * 2) * 2.5) * poolAlpha;
          orbitingSatellites.push({
            x: this.pointer.x + Math.cos(satAng) * satDist,
            y: this.pointer.y + Math.sin(satAng) * satDist,
            r: (1.1 + (s % 2) * 0.6) * poolAlpha,
            isViolet: s % 2 === 1,
          });
        }
      }

      ctx.save();
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';

      // ====================================================================
      // PASS 1: BIOLUMINESCENT FLUID MEMBRANE (THIN SILKY OUTER RIM)
      // ====================================================================
      ctx.shadowColor = palette.accent;
      ctx.shadowBlur = (10 + chaosBoost * 3) * state.engagement;

      // 1A. Meniscus outer rim (smooth & subtle)
      ctx.beginPath();
      traceSmoothClosedLoop(ctx, meniscusPts);
      ctx.strokeStyle = palette.accent;
      ctx.lineWidth = 1.2;
      ctx.globalAlpha = 0.8 * state.engagement;
      ctx.stroke();

      // 1B. Thin fluid strands outer rim
      builtStrands.forEach((st) => {
        ctx.beginPath();
        traceSmoothClosedLoop(ctx, st.contour);
        ctx.strokeStyle = st.isArterial
          ? palette.bright
          : st.isPrimary
            ? palette.accent
            : palette.violet;
        ctx.lineWidth = st.isArterial ? 1.4 : st.isPrimary ? 1.1 : 0.8;
        ctx.globalAlpha = (st.isArterial ? 0.92 : st.isPrimary ? 0.82 : 0.65) * state.engagement;
        ctx.stroke();
      });

      // 1C. Delicate gossamer fluid webbing between strands
      const webRungs = [4, 9, 14, 19, 23];
      for (let i = 0; i < builtStrands.length - 1; i += 1) {
        const a = builtStrands[i].spinePts;
        const b = builtStrands[i + 1].spinePts;
        webRungs.forEach((wIdx, k) => {
          const ptA = a[wIdx];
          const ptB = b[clamp(wIdx + (k % 2 === 0 ? 2 : -2), 2, a.length - 2)];
          if (!ptA || !ptB) return;
          const dist = Math.hypot(ptB.x - ptA.x, ptB.y - ptA.y);
          const maxWeb = 60 * state.engagement;
          if (dist < maxWeb) {
            const tension = 1 - dist / maxWeb;
            const midX = (ptA.x + ptB.x) * 0.5 + Math.sin(timeSec * 4.2 + i + k) * 2.5;
            const midY = (ptA.y + ptB.y) * 0.5 + Math.cos(timeSec * 4.2 + i + k) * 2.5;
            ctx.beginPath();
            ctx.moveTo(ptA.x, ptA.y);
            ctx.quadraticCurveTo(midX, midY, ptB.x, ptB.y);
            ctx.strokeStyle = k % 2 === 0 ? palette.accent : palette.violet;
            ctx.lineWidth = tension * 1.5 * state.engagement;
            ctx.globalAlpha = 0.75 * tension * state.engagement;
            ctx.stroke();
          }
        });
      }

      // 1D. Fine capillary offshoots
      builtStrands.forEach((st, idx) => {
        if (!st.isHunter || state.engagement < 0.3) return;
        const branchNode = st.spinePts[12 + (idx % 6)];
        if (!branchNode) return;
        const side = idx % 2 === 0 ? 1 : -1;
        const branchLen = (12 + Math.sin(timeSec * 6.0 + st.phase) * 6) * state.engagement;
        const bx = branchNode.x + branchNode.nx * side * branchLen;
        const by = branchNode.y + branchNode.ny * side * branchLen;
        const ctrlX = (branchNode.x + bx) * 0.5 - branchNode.ny * side * 4;
        const ctrlY = (branchNode.y + by) * 0.5 + branchNode.nx * side * 4;

        ctx.beginPath();
        ctx.moveTo(branchNode.x, branchNode.y);
        ctx.quadraticCurveTo(ctrlX, ctrlY, bx, by);
        ctx.strokeStyle = palette.accent;
        ctx.lineWidth = 1.0 * state.engagement;
        ctx.globalAlpha = 0.75 * state.engagement;
        ctx.stroke();
      });

      // 1E. Cursor tip droplet outer rim & satellites
      if (cursorPoolPts.length > 0) {
        ctx.beginPath();
        traceSmoothClosedLoop(ctx, cursorPoolPts);
        ctx.strokeStyle = palette.accent;
        ctx.lineWidth = 1.4;
        ctx.globalAlpha = 0.88 * state.engagement;
        ctx.stroke();

        orbitingSatellites.forEach((sat) => {
          ctx.beginPath();
          ctx.arc(sat.x, sat.y, sat.r, 0, Math.PI * 2);
          ctx.fillStyle = palette.coreDark;
          ctx.fill();
          ctx.lineWidth = 0.9;
          ctx.strokeStyle = sat.isViolet ? palette.violet : palette.accent;
          ctx.stroke();
        });
      }

      // ====================================================================
      // PASS 2: DEEP OBSIDIAN FLUID CORE (SEAMLESS LIQUID MERGE)
      // ====================================================================
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 0.96;
      ctx.fillStyle = palette.coreDark;

      ctx.beginPath();
      traceSmoothClosedLoop(ctx, meniscusPts);
      ctx.fill();

      builtStrands.forEach((st) => {
        ctx.beginPath();
        traceSmoothClosedLoop(ctx, st.contour);
        ctx.fill();
      });

      for (let i = 0; i < builtStrands.length - 1; i += 1) {
        const a = builtStrands[i].spinePts;
        const b = builtStrands[i + 1].spinePts;
        webRungs.forEach((wIdx, k) => {
          const ptA = a[wIdx];
          const ptB = b[clamp(wIdx + (k % 2 === 0 ? 2 : -2), 2, a.length - 2)];
          if (!ptA || !ptB) return;
          const dist = Math.hypot(ptB.x - ptA.x, ptB.y - ptA.y);
          const maxWeb = 60 * state.engagement;
          if (dist < maxWeb) {
            const tension = 1 - dist / maxWeb;
            const midX = (ptA.x + ptB.x) * 0.5 + Math.sin(timeSec * 4.2 + i + k) * 2.5;
            const midY = (ptA.y + ptB.y) * 0.5 + Math.cos(timeSec * 4.2 + i + k) * 2.5;
            ctx.beginPath();
            ctx.moveTo(ptA.x, ptA.y);
            ctx.quadraticCurveTo(midX, midY, ptB.x, ptB.y);
            ctx.strokeStyle = palette.coreDark;
            ctx.lineWidth = Math.max(0.6, tension * 1.8 * state.engagement);
            ctx.stroke();
          }
        });
      }

      if (cursorPoolPts.length > 0) {
        ctx.beginPath();
        traceSmoothClosedLoop(ctx, cursorPoolPts);
        ctx.fill();
      }

      // ====================================================================
      // PASS 3: BIOLUMINESCENT ARTERIAL PULSE NODES & GLOSSY SPECULAR VEINS
      // ====================================================================
      builtStrands.forEach((st, idx) => {
        const sp = st.spinePts;
        if (st.isPrimary || st.isArterial) {
          ctx.beginPath();
          for (let i = 2; i < sp.length - 2; i += 1) {
            const pt = sp[i];
            const vx = pt.x + pt.nx * (pt.halfW * 0.25);
            const vy = pt.y + pt.ny * (pt.halfW * 0.25);
            if (i === 2) ctx.moveTo(vx, vy);
            else ctx.lineTo(vx, vy);
          }
          ctx.strokeStyle = st.isArterial ? palette.bright : palette.accent;
          ctx.lineWidth = st.isArterial ? 0.85 : 0.6;
          ctx.globalAlpha = (st.isArterial ? 0.75 : 0.48) * state.engagement;
          ctx.stroke();
        }

        // Traveling synaptic plasma globules shooting smoothly from button toward cursor
        if (st.isArterial && st.isLatched) {
          const pulseIdx = Math.floor(((timeSec * 18 + idx * 4) % (sp.length - 4)) + 2);
          const node = sp[pulseIdx];
          if (node) {
            ctx.beginPath();
            ctx.arc(node.x, node.y, Math.max(0.9, node.halfW * 0.3), 0, Math.PI * 2);
            ctx.fillStyle = idx % 2 === 0 ? palette.accent : palette.violet;
            ctx.globalAlpha = 0.85 * state.engagement;
            ctx.fill();
          }
        }
      });

      ctx.restore();
    });

    // ====================================================================
    // 4. VISCOELASTIC SPLATTER DROPLETS WITH MAGNETIC HOMING RECALL
    // ====================================================================
    if (this.droplets.length > 0) {
      ctx.save();
      this.droplets = this.droplets.filter((d) => {
        d.prevX = d.x;
        d.prevY = d.y;
        d.age += 1;

        // After initial blast (age > 9), droplets get magnetically sucked back toward their host button
        if (d.hostBtn && d.age > 9) {
          const r = d.hostBtn.getBoundingClientRect();
          const targetX = r.left + r.width * 0.5;
          const targetY = r.top + r.height * 0.5;
          const dx = targetX - d.x;
          const dy = targetY - d.y;
          const dist = Math.hypot(dx, dy) || 1;
          if (dist < 18) return false; // Absorbed back into the symbiote core!
          const pull = Math.min(1.4, 24 / dist);
          d.vx += (dx / dist) * pull;
          d.vy += (dy / dist) * pull;
        } else {
          d.vy += 0.14; // Brief gravity arc on initial splatter
        }

        d.x += d.vx;
        d.y += d.vy;
        d.vx *= 0.92;
        d.vy *= 0.92;
        d.life -= d.decay;
        if (d.life <= 0.02) return false;

        const r = d.radius * d.life;
        const speed = Math.hypot(d.vx, d.vy);
        const ang = Math.atan2(d.vy, d.vx);

        // Thin viscoelastic capillary tail streak
        ctx.beginPath();
        ctx.moveTo(d.prevX - Math.cos(ang) * speed * 1.2, d.prevY - Math.sin(ang) * speed * 1.2);
        ctx.lineTo(d.x, d.y);
        ctx.strokeStyle = d.isViolet ? palette.violet : palette.accent;
        ctx.lineWidth = Math.max(0.6, r * 0.45);
        ctx.globalAlpha = d.life * 0.55;
        ctx.stroke();

        ctx.save();
        ctx.translate(d.x, d.y);
        ctx.rotate(ang);
        ctx.beginPath();
        ctx.ellipse(
          0,
          0,
          r * (d.stretch + Math.min(speed * 0.1, 1.1)),
          r * 0.65,
          0,
          0,
          Math.PI * 2
        );
        ctx.fillStyle = palette.coreDark;
        ctx.globalAlpha = d.life * 0.95;
        ctx.fill();
        ctx.lineWidth = 0.85;
        ctx.strokeStyle = d.isViolet ? palette.violet : palette.accent;
        ctx.stroke();
        ctx.restore();
        return true;
      });
      ctx.restore();
    }
  }
}
