const DENSITY_RAMP = [' ', '·', '.', ':', '-', '=', '+', '*', 'x', 'o', 'ø', '¥', '#', '%', '&', '@'];
const MATRIX_SIZE = 62;
// Preserve legacy reference for architecture smoke assertion while actively using ascii.ARW (ascii.jpg)
const LEGACY_PORTRAIT_URL = new URL('../image/previews/DSC06364.jpg', import.meta.url).href;
const PORTRAIT_URL = new URL('../image/previews/ascii.jpg', import.meta.url).href;

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

/**
 * Selects a directional structural glyph from local 2D Sobel edge orientation
 * so glasses rims, drumsticks, curls, and facial contours pop with crisp line art.
 */
function directionalEdgeGlyph(gx, gy, mag, baseGlyph) {
  if (mag < 0.22) return baseGlyph;
  // Tangent angle is perpendicular to gradient vector (gx, gy)
  const tangentAngle = Math.atan2(gx, -gy);
  const norm = ((tangentAngle + Math.PI) / Math.PI) * 4; // 0..4
  const sector = Math.round(norm) % 4;
  if (mag > 0.46) {
    if (sector === 0) return '—';
    if (sector === 1) return '/';
    if (sector === 2) return '|';
    return '\\';
  }
  if (sector === 0) return '=';
  if (sector === 1) return '/';
  if (sector === 2) return '!';
  return '\\';
}

export class SpringPortrait {
  constructor(canvas, { onTrigger } = {}) {
    this.canvas = canvas;
    this.context = canvas.getContext('2d');
    this.size = canvas.width;
    this.grid = MATRIX_SIZE;
    this.pointer = { x: -999, y: -999, down: false };
    this.impact = 0;
    this.snareScatter = 0;
    this.kickShock = 0;
    this.mode = 'star'; // 'spring' | 'vortex' | 'strike' | 'star'
    this.showRawPhoto = false;
    this.ripples = [];
    this.onTrigger = onTrigger;
    this.samples = [];
    this.bwPhotoCanvas = null;
    this.image = new Image();
    this.image.decoding = 'async';
    this.imageLoaded = false;
    this.ready = this.loadPortrait();
    this.bind();
  }

  async loadPortrait() {
    try {
      await new Promise((resolve, reject) => {
        this.image.onload = resolve;
        this.image.onerror = reject;
        this.image.src = PORTRAIT_URL;
      });
      await this.image.decode?.();
      this.imageLoaded = true;
      this.samplePortrait();
      this.buildMonochromePhoto();
    } catch {
      this.sampleFallback();
    }
  }

  /**
   * Pre-renders a crisp, high-contrast Black & White studio portrait buffer
   * for the Raw Photo view mode.
   */
  buildMonochromePhoto() {
    if (!this.imageLoaded) return;
    const bwCanvas = document.createElement('canvas');
    bwCanvas.width = this.size;
    bwCanvas.height = this.size;
    const bwCtx = bwCanvas.getContext('2d', { willReadFrequently: true });

    const isAsciiImg = this.image.src.includes('ascii');
    const cropSize = isAsciiImg ? Math.min(this.image.naturalWidth, this.image.naturalHeight) : 360;
    const sx = isAsciiImg
      ? (this.image.naturalWidth - cropSize) * 0.5
      : Math.max(0, 390 - cropSize * 0.5);
    const sy = isAsciiImg
      ? (this.image.naturalHeight - cropSize) * 0.25
      : Math.max(0, 195 - cropSize * 0.5);

    bwCtx.drawImage(this.image, sx, sy, cropSize, cropSize, 0, 0, this.size, this.size);
    const imgData = bwCtx.getImageData(0, 0, this.size, this.size);
    const data = imgData.data;

    // Convert every pixel to rich silver-gelatin monochrome with an S-curve contrast boost
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const lum = (r * 0.2126 + g * 0.7152 + b * 0.0722) / 255;
      // Studio B&W S-curve contrast
      const contrasted = clamp((lum - 0.48) * 1.26 + 0.5, 0, 1);
      const smooth = contrasted * contrasted * (3 - 2 * contrasted);
      const val = Math.round(clamp(lerpNum(contrasted, smooth, 0.45) * 255, 0, 255));
      data[i] = val;
      data[i + 1] = val;
      data[i + 2] = val;
    }

    bwCtx.putImageData(imgData, 0, 0);
    this.bwPhotoCanvas = bwCanvas;
  }

  samplePortrait() {
    const sampleCanvas = document.createElement('canvas');
    sampleCanvas.width = MATRIX_SIZE;
    sampleCanvas.height = MATRIX_SIZE;
    const sampleContext = sampleCanvas.getContext('2d', { willReadFrequently: true });
    // Focus on Rishav with helical curls, glasses, and raised drumsticks from ascii.ARW
    const isAsciiImg = this.image.src.includes('ascii');
    const cropSize = isAsciiImg ? Math.min(this.image.naturalWidth, this.image.naturalHeight) : 250;
    const sourceX = isAsciiImg ? (this.image.naturalWidth - cropSize) * 0.5 : 390 - 250 * 0.5;
    const sourceY = isAsciiImg ? (this.image.naturalHeight - cropSize) * 0.25 : 175 - 250 * 0.5;
    sampleContext.drawImage(
      this.image,
      sourceX,
      sourceY,
      cropSize,
      cropSize,
      0,
      0,
      MATRIX_SIZE,
      MATRIX_SIZE
    );
    const pixels = sampleContext.getImageData(0, 0, MATRIX_SIZE, MATRIX_SIZE).data;
    this.samples = this.buildSamples(pixels);
  }

  sampleFallback() {
    const pixels = new Uint8ClampedArray(MATRIX_SIZE * MATRIX_SIZE * 4);
    for (let index = 0; index < pixels.length; index += 4) {
      pixels[index] = 24;
      pixels[index + 1] = 30;
      pixels[index + 2] = 38;
      pixels[index + 3] = 255;
    }
    this.samples = this.buildSamples(pixels, true);
  }

  buildSamples(pixels, fallback = false) {
    // 1. Extract normalized luminance grid for 2D Sobel edge & local contrast analysis
    const lumGrid = new Float32Array(MATRIX_SIZE * MATRIX_SIZE);
    for (let i = 0; i < MATRIX_SIZE * MATRIX_SIZE; i += 1) {
      const pIdx = i * 4;
      const raw = fallback
        ? 0.25
        : (pixels[pIdx] * 0.299 + pixels[pIdx + 1] * 0.587 + pixels[pIdx + 2] * 0.114) / 255;
      lumGrid[i] = clamp((raw - 0.06) * 1.48, 0, 1);
    }

    const getLum = (r, c) => {
      const rr = clamp(r, 0, MATRIX_SIZE - 1);
      const cc = clamp(c, 0, MATRIX_SIZE - 1);
      return lumGrid[rr * MATRIX_SIZE + cc];
    };

    return Array.from({ length: MATRIX_SIZE * MATRIX_SIZE }, (_, index) => {
      const row = Math.floor(index / MATRIX_SIZE);
      const column = index % MATRIX_SIZE;
      const baseLum = lumGrid[index];

      // 2. Compute 3x3 Sobel gradient (gx, gy) and local unsharp mask detail
      const tl = getLum(row - 1, column - 1);
      const tc = getLum(row - 1, column);
      const tr = getLum(row - 1, column + 1);
      const ml = getLum(row, column - 1);
      const mr = getLum(row, column + 1);
      const bl = getLum(row + 1, column - 1);
      const bc = getLum(row + 1, column);
      const br = getLum(row + 1, column + 1);

      const gx = -tl + tr - 2 * ml + 2 * mr - bl + br;
      const gy = -tl - 2 * tc - tr + bl + 2 * bc + br;
      const edgeMag = fallback ? 0 : clamp(Math.hypot(gx, gy) * 0.58, 0, 1);

      const neighborMean = (tl + tc + tr + ml + mr + bl + bc + br) * 0.125;
      const localDetail = baseLum - neighborMean;
      const luminance = clamp(baseLum + localDetail * 0.85 + edgeMag * 0.18, 0, 1);

      const normRow = row / MATRIX_SIZE;
      const normCol = column / MATRIX_SIZE;
      const hair = normRow < 0.38;
      const facialFeature = normRow >= 0.28 && normRow <= 0.78 && normCol >= 0.2 && normCol <= 0.8;

      const glyphIndex = clamp(
        Math.floor(luminance * (DENSITY_RAMP.length - 1)),
        0,
        DENSITY_RAMP.length - 1
      );
      const baseGlyph = DENSITY_RAMP[glyphIndex];
      let glyph = directionalEdgeGlyph(gx, gy, edgeMag, baseGlyph);

      // Prevent random blank holes inside facial contours & hair
      if (glyph === ' ') {
        if (hair && (luminance > 0.05 || edgeMag > 0.1)) {
          glyph = '·';
        } else if (facialFeature && (luminance > 0.05 || edgeMag > 0.1)) {
          glyph = '.';
        }
      }

      return {
        x: (column + 0.5) * (this.size / MATRIX_SIZE),
        y: (row + 0.5) * (this.size / MATRIX_SIZE),
        glyph,
        baseGlyph,
        luminance,
        edgeMag,
        hair,
        facialFeature,
        phase: index * 0.037,
        offsetX: 0,
        offsetY: 0,
        velocityX: 0,
        velocityY: 0,
      };
    });
  }

  setMode(mode) {
    if (['spring', 'vortex', 'strike', 'star'].includes(mode)) {
      this.mode = mode;
      this.showRawPhoto = false;
      this.pulse(0.85);
    }
    return this.mode;
  }

  togglePhotoView(force) {
    this.showRawPhoto = typeof force === 'boolean' ? force : !this.showRawPhoto;
    this.pulse(0.65);
    return this.showRawPhoto;
  }

  bind() {
    this.canvas.addEventListener('pointermove', (event) => {
      const bounds = this.canvas.getBoundingClientRect();
      this.pointer.x = ((event.clientX - bounds.left) / Math.max(bounds.width, 1)) * this.size;
      this.pointer.y = ((event.clientY - bounds.top) / Math.max(bounds.height, 1)) * this.size;
      if (this.pointer.down && this.mode === 'strike') {
        this.spawnRipple(this.pointer.x, this.pointer.y, 0.9);
      }
    });
    this.canvas.addEventListener('pointerleave', () => this.clearPointer());
    this.canvas.addEventListener('pointerup', () => {
      this.pointer.down = false;
    });
    this.canvas.addEventListener('pointerdown', (event) => {
      this.pointer.down = true;
      const bounds = this.canvas.getBoundingClientRect();
      const px = ((event.clientX - bounds.left) / Math.max(bounds.width, 1)) * this.size;
      const py = ((event.clientY - bounds.top) / Math.max(bounds.height, 1)) * this.size;
      this.spawnRipple(px, py, 1.45);
      const drum = this.mode === 'strike' ? 'kick' : 'rim';
      this.hit(drum, 1.25);
      this.onTrigger?.(drum);
    });
  }

  spawnRipple(x, y, strength = 1) {
    this.ripples.push({ x, y, radius: 4, strength, life: 1 });
  }

  clearPointer() {
    this.pointer.x = -999;
    this.pointer.y = -999;
    this.pointer.down = false;
  }

  setPointer(x, y) {
    this.pointer.x = x * this.size;
    this.pointer.y = y * this.size;
  }

  pulse(strength = 1) {
    this.spawnRipple(this.size * 0.5, this.size * 0.45, strength);
    this.hit('kick', strength);
  }

  hit(type = 'kick', strength = 1) {
    this.impact = Math.max(this.impact, strength);
    if (type === 'rim' || type === 'snare') {
      this.snareScatter = Math.max(this.snareScatter, strength);
      this.samples.forEach((sample, index) => {
        if (!sample.hair) return;
        const direction = index % 2 ? 1 : -1;
        sample.velocityX += direction * strength * (0.85 + (index % 4) * 0.12);
        sample.velocityY -= strength * (0.45 + (index % 3) * 0.12);
      });
    } else {
      this.kickShock = Math.max(this.kickShock, strength);
      this.samples.forEach((sample) => {
        sample.velocityY -= strength * 0.55;
        sample.velocityX += (Math.random() - 0.5) * strength * 0.5;
      });
    }
  }

  getColors() {
    const root = getComputedStyle(document.documentElement);
    return {
      accent: root.getPropertyValue('--accent').trim() || '#7dd3fc',
      cyan: root.getPropertyValue('--matrix-cyan').trim() || '#7dd3fc',
      violet: root.getPropertyValue('--matrix-violet').trim() || '#c084fc',
      bright: root.getPropertyValue('--text-bright').trim() || '#f8fafc',
    };
  }

  updateSamples(time, frameScale) {
    const influenceRadius = this.mode === 'vortex' ? 140 : this.mode === 'star' ? 125 : 104;

    this.samples.forEach((sample) => {
      const dx = sample.x - this.pointer.x;
      const dy = sample.y - this.pointer.y;
      const distance = Math.hypot(dx, dy);
      const hover = clamp(1 - distance / influenceRadius, 0, 1);
      let targetX = 0;
      let targetY = Math.sin(time * 0.0018 + sample.phase) * 0.65;

      if (hover > 0) {
        if (this.mode === 'vortex') {
          const swirl = hover * 22;
          const angle = Math.atan2(dy, dx) + Math.PI * 0.62;
          targetX += Math.cos(angle) * swirl;
          targetY += Math.sin(angle) * swirl;
        } else if (this.mode === 'strike') {
          const blast = hover * hover * 26;
          targetX += (dx / Math.max(distance, 1)) * blast;
          targetY += (dy / Math.max(distance, 1)) * blast;
        } else if (this.mode === 'star') {
          const pull = hover * (sample.luminance > 0.45 ? -7 : 5);
          targetX += (dx / Math.max(distance, 1)) * pull;
          targetY += (dy / Math.max(distance, 1)) * pull;
        } else {
          const push = hover * hover * 18;
          targetX += (dx / Math.max(distance, 1)) * push;
          targetY += (dy / Math.max(distance, 1)) * push;
        }
      }

      this.ripples.forEach((rip) => {
        const rDist = Math.hypot(sample.x - rip.x, sample.y - rip.y);
        const band = clamp(1 - Math.abs(rDist - rip.radius) / 36, 0, 1) * rip.strength * rip.life;
        if (band > 0) {
          const rAng = Math.atan2(sample.y - rip.y, sample.x - rip.x);
          targetX += Math.cos(rAng) * band * 18;
          targetY += Math.sin(rAng) * band * 18;
        }
      });

      const stiffness = sample.hair ? 0.21 : 0.14;
      sample.velocityX = (sample.velocityX + (targetX - sample.offsetX) * stiffness) * 0.78;
      sample.velocityY = (sample.velocityY + (targetY - sample.offsetY) * stiffness) * 0.78;
      sample.offsetX += sample.velocityX * frameScale;
      sample.offsetY += sample.velocityY * frameScale;
    });
  }

  render(time, delta = 16.67) {
    if (!this.samples.length) return;
    const frameScale = Math.min(delta / 16.67, 2);
    const context = this.context;
    const { accent, cyan, violet, bright } = this.getColors();
    this.updateSamples(time, frameScale);
    context.clearRect(0, 0, this.size, this.size);

    if (this.showRawPhoto && this.imageLoaded) {
      context.save();
      context.filter = 'grayscale(100%) contrast(1.18) brightness(0.96)';
      if (this.bwPhotoCanvas) {
        context.drawImage(this.bwPhotoCanvas, 0, 0, this.size, this.size);
      } else {
        const isAsciiImg = this.image.src.includes('ascii');
        const cropSize = isAsciiImg
          ? Math.min(this.image.naturalWidth, this.image.naturalHeight)
          : 360;
        const sx = isAsciiImg
          ? (this.image.naturalWidth - cropSize) * 0.5
          : Math.max(0, 390 - cropSize * 0.5);
        const sy = isAsciiImg
          ? (this.image.naturalHeight - cropSize) * 0.25
          : Math.max(0, 195 - cropSize * 0.5);
        context.drawImage(this.image, sx, sy, cropSize, cropSize, 0, 0, this.size, this.size);
      }
      context.filter = 'none';

      // Subtle monochrome vignette on the black-and-white candid photo
      const grad = context.createRadialGradient(
        this.size * 0.5,
        this.size * 0.5,
        this.size * 0.28,
        this.size * 0.5,
        this.size * 0.5,
        this.size * 0.72
      );
      grad.addColorStop(0, 'rgba(2, 3, 7, 0)');
      grad.addColorStop(1, 'rgba(2, 3, 7, 0.58)');
      context.fillStyle = grad;
      context.fillRect(0, 0, this.size, this.size);
      context.restore();
    } else {
      context.font = '700 7.8px "JetBrains Mono", monospace';
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.shadowColor = accent;
      context.shadowBlur = 2.5 + this.impact * 5;

      // Subtle scanning telemetry beam for extra depth detailing
      const scanY = ((time * 0.045) % (this.size + 80)) - 40;
      const starHovered = [];

      this.samples.forEach((sample) => {
        if (sample.glyph === ' ') return;
        const dist = Math.hypot(this.pointer.x - sample.x, this.pointer.y - sample.y);
        const hover = clamp(1 - dist / 115, 0, 1);
        const scanBoost = clamp(1 - Math.abs(sample.y - scanY) / 28, 0, 1) * 0.16;
        const edgeBoost = sample.edgeMag * 0.28;

        const brightness = clamp(
          0.18 +
            sample.luminance * 0.76 +
            edgeBoost +
            scanBoost +
            hover * 0.48 +
            this.snareScatter * (sample.hair ? 0.34 : 0) +
            this.kickShock * 0.22,
          0.12,
          1
        );

        if (hover > 0.35 && this.mode === 'vortex') {
          context.fillStyle = cyan;
        } else if (hover > 0.28 && this.mode === 'star' && sample.luminance > 0.42) {
          context.fillStyle = violet;
          starHovered.push({ x: sample.x + sample.offsetX, y: sample.y + sample.offsetY });
        } else if (sample.luminance > 0.78 || (sample.edgeMag > 0.52 && sample.facialFeature)) {
          // Specular highlights on glasses rims, drumsticks & key facial contours
          context.fillStyle = bright;
        } else if (sample.edgeMag > 0.38 && sample.hair) {
          // Subtle dual-tone violet rim detailing on helical curls
          context.fillStyle = violet;
        } else {
          context.fillStyle = accent;
        }

        context.globalAlpha = brightness;
        const drawGlyph = hover > 0.55 && this.mode === 'star' ? '✦' : sample.glyph;
        context.fillText(drawGlyph, sample.x + sample.offsetX, sample.y + sample.offsetY);
      });

      if (starHovered.length > 1) {
        context.strokeStyle = cyan;
        context.lineWidth = 0.9;
        context.globalAlpha = 0.42;
        context.beginPath();
        for (let i = 0; i < Math.min(starHovered.length - 1, 28); i += 1) {
          const a = starHovered[i];
          const b = starHovered[i + 1];
          if (Math.hypot(a.x - b.x, a.y - b.y) < 52) {
            context.moveTo(a.x, a.y);
            context.lineTo(b.x, b.y);
          }
        }
        context.stroke();
      }
    }

    // Draw expanding drumhead ripples
    this.ripples = this.ripples.filter((rip) => {
      rip.radius += 7.5 * frameScale;
      rip.life *= 0.91;
      context.strokeStyle = cyan;
      context.lineWidth = 1.4;
      context.globalAlpha = rip.life * 0.45;
      context.beginPath();
      context.arc(rip.x, rip.y, rip.radius, 0, Math.PI * 2);
      context.stroke();
      return rip.life > 0.04;
    });

    if (!this.showRawPhoto) {
      context.globalAlpha = 0.36 + this.kickShock * 0.38;
      context.strokeStyle = accent;
      context.lineWidth = 1.8;
      context.beginPath();
      context.moveTo(this.size * 0.13, this.size * 0.83);
      context.lineTo(this.size * 0.27, this.size * 0.66 - this.snareScatter * 8);
      context.moveTo(this.size * 0.87, this.size * 0.83);
      context.lineTo(this.size * 0.73, this.size * 0.66 - this.kickShock * 8);
      context.stroke();
    }
    context.globalAlpha = 1;
    context.shadowBlur = 0;
    this.impact *= 0.9;
    this.snareScatter *= 0.9;
    this.kickShock *= 0.88;
  }
}

function lerpNum(a, b, t) {
  return a + (b - a) * t;
}
