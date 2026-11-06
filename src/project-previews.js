/**
 * Live Interactive Technical Previews for Selected Works
 * Replaces static photos with real-time computational simulators:
 * 1. c-image-filters: Live 3x3 Sobel Spatial Convolution & Split-Screen Kernel Filter
 * 2. embedded-doppler-visualizer: Real-time Supersonic Mach Cone Wave Mechanics & 115.2k UART telemetry
 * 3. karen-emergency-ai: Tactical 3D Geospatial PyDeck City Dispatch Grid & Incident Radar
 * 4. cpp-arduino-control: POSIX 115200-Baud Digital Oscilloscope & Rolling Packet Stream
 * 5. 3D-Snail: Kinetic 3D Logarithmic Spiral Helix with Spring Damping
 */

const DRUM_PHOTO_URL = new URL('../image/previews/drumming-session.jpg', import.meta.url).href;

function setupHiDpiCanvas(canvas) {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.max(Math.floor(rect.width), 320);
  const height = Math.max(Math.floor(rect.height), 160);
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, width, height, dpr };
}

// =============================================================================
// PREVIEW 01: C99 2D SPATIAL CONVOLUTION (FULL IMAGE + DROPDOWN KERNEL SELECTOR)
// =============================================================================
function initImageFiltersPreview(canvas, { audio } = {}) {
  let ctx, width, height, dpr;
  let splitX = 0.5;
  let targetSplitX = 0.5;
  let isHovered = false;
  let activeKernel = 'sobel';
  let viewMode = 'split'; // 'split' | 'full'
  let cachedImg = null;
  let rawImageData = null;
  let rawCanvas = null;
  let processedCanvas = null;
  const filterCache = new Map();

  const FILTER_NAMES = {
    sobel: 'SOBEL 3×3',
    gaussian: 'GAUSSIAN BLUR',
    sharpen: 'SHARPEN 3×3',
    laplacian: 'LAPLACIAN 2ND-DERIV',
    emboss: '3D EMBOSS',
    sepia: 'SEPIA PHOSPHOR',
    grayscale: 'GRAYSCALE REC.601',
    invert: 'INVERT NEGATIVE',
    threshold: 'BINARY THRESHOLD',
    edge_color: 'CHROMATIC RGB EDGES',
    original: 'RAW RGB (ORIGINAL)',
  };

  const selectEl = document.getElementById('c-filter-select');
  const modeBtn = document.getElementById('c-filter-mode-btn');
  const modeLabel = document.getElementById('c-filter-mode-label');
  const statusText = document.getElementById('c-filter-status-text');

  function updateStatusUi() {
    const dispName = FILTER_NAMES[activeKernel] || activeKernel.toUpperCase();
    if (modeLabel) modeLabel.textContent = viewMode.toUpperCase();
    if (statusText) {
      statusText.textContent =
        viewMode === 'split'
          ? `C99 ${dispName} // HOVER TO SWEEP`
          : `C99 ${dispName} // FULL FRAME KERNEL`;
    }
  }

  function resize() {
    const res = setupHiDpiCanvas(canvas);
    ctx = res.ctx;
    width = res.width;
    height = res.height;
    dpr = res.dpr;
    filterCache.clear();
    if (cachedImg) processImage();
  }

  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    cachedImg = img;
    processImage();
  };
  img.src = DRUM_PHOTO_URL;

  function processImage() {
    if (!cachedImg || !width || !height) return;
    filterCache.clear();

    const offscreen = document.createElement('canvas');
    offscreen.width = width;
    offscreen.height = height;
    const octx = offscreen.getContext('2d', { willReadFrequently: true });

    // Deep abyssal background
    octx.fillStyle = '#020307';
    octx.fillRect(0, 0, width, height);

    // Subtle darkened atmospheric backdrop so letterbox wings are never empty black
    const coverScale = Math.max(width / cachedImg.naturalWidth, height / cachedImg.naturalHeight);
    const bgW = Math.floor(cachedImg.naturalWidth * coverScale);
    const bgH = Math.floor(cachedImg.naturalHeight * coverScale);
    const bgX = Math.floor((width - bgW) * 0.5);
    const bgY = Math.floor((height - bgH) * 0.35);
    octx.save();
    octx.globalAlpha = 0.22;
    octx.drawImage(cachedImg, bgX, bgY, bgW, bgH);
    octx.restore();

    // Subtle CRT matrix grid across the full stage
    octx.strokeStyle = 'rgba(125, 211, 252, 0.05)';
    octx.lineWidth = 1;
    for (let x = 0; x < width; x += 22) {
      octx.beginPath();
      octx.moveTo(x, 0);
      octx.lineTo(x, height);
      octx.stroke();
    }
    for (let y = 0; y < height; y += 22) {
      octx.beginPath();
      octx.moveTo(0, y);
      octx.lineTo(width, y);
      octx.stroke();
    }

    // Show the main image fully top-to-bottom in the center without cropping
    const scale = Math.min(width / cachedImg.naturalWidth, height / cachedImg.naturalHeight);
    const sw = Math.floor(cachedImg.naturalWidth * scale);
    const sh = Math.floor(cachedImg.naturalHeight * scale);
    const ox = Math.floor((width - sw) * 0.5);
    const oy = Math.floor((height - sh) * 0.5);

    octx.drawImage(cachedImg, ox, oy, sw, sh);

    rawCanvas = offscreen;
    rawImageData = octx.getImageData(0, 0, width, height);
    updateActiveFilter();
  }

  function computeFilter(kernel) {
    if (!rawImageData) return null;
    if (filterCache.has(kernel)) return filterCache.get(kernel);

    const src = rawImageData.data;
    const output = new ImageData(width, height);
    const dst = output.data;

    if (kernel === 'original') {
      dst.set(src);
    } else if (kernel === 'grayscale') {
      for (let i = 0; i < src.length; i += 4) {
        const y = 0.299 * src[i] + 0.587 * src[i + 1] + 0.114 * src[i + 2];
        dst[i] = y;
        dst[i + 1] = y;
        dst[i + 2] = y;
        dst[i + 3] = src[i + 3];
      }
    } else if (kernel === 'invert') {
      for (let i = 0; i < src.length; i += 4) {
        dst[i] = 255 - src[i];
        dst[i + 1] = 255 - src[i + 1];
        dst[i + 2] = 255 - src[i + 2];
        dst[i + 3] = src[i + 3];
      }
    } else if (kernel === 'threshold') {
      for (let i = 0; i < src.length; i += 4) {
        const y = 0.299 * src[i] + 0.587 * src[i + 1] + 0.114 * src[i + 2];
        const v = y > 105 ? 255 : 0;
        dst[i] = v ? 125 : 3;
        dst[i + 1] = v ? 211 : 5;
        dst[i + 2] = v ? 252 : 12;
        dst[i + 3] = 255;
      }
    } else if (kernel === 'sepia') {
      for (let i = 0; i < src.length; i += 4) {
        const r = src[i], g = src[i + 1], b = src[i + 2];
        dst[i] = Math.min(255, 0.393 * r + 0.769 * g + 0.189 * b);
        dst[i + 1] = Math.min(255, 0.349 * r + 0.686 * g + 0.168 * b);
        dst[i + 2] = Math.min(255, 0.272 * r + 0.534 * g + 0.131 * b);
        dst[i + 3] = src[i + 3];
      }
    } else if (kernel === 'sobel') {
      for (let y = 1; y < height - 1; y += 1) {
        for (let x = 1; x < width - 1; x += 1) {
          const i = (y * width + x) * 4;
          const getLum = (ox, oy) => {
            const idx = ((y + oy) * width + (x + ox)) * 4;
            return src[idx] * 0.299 + src[idx + 1] * 0.587 + src[idx + 2] * 0.114;
          };
          const tl = getLum(-1, -1), tc = getLum(0, -1), tr = getLum(1, -1);
          const ml = getLum(-1, 0), mr = getLum(1, 0);
          const bl = getLum(-1, 1), bc = getLum(0, 1), br = getLum(1, 1);
          const gx = -tl + tr - 2 * ml + 2 * mr - bl + br;
          const gy = -tl - 2 * tc - tr + bl + 2 * bc + br;
          const mag = Math.min(Math.sqrt(gx * gx + gy * gy) * 1.5, 255);
          if (mag > 26) {
            dst[i] = Math.min(mag * 0.48, 125);
            dst[i + 1] = Math.min(mag * 1.2, 211);
            dst[i + 2] = Math.min(mag * 1.6, 252);
          } else {
            dst[i] = 3;
            dst[i + 1] = 5;
            dst[i + 2] = 10;
          }
          dst[i + 3] = 255;
        }
      }
    } else if (kernel === 'edge_color') {
      for (let y = 1; y < height - 1; y += 1) {
        for (let x = 1; x < width - 1; x += 1) {
          const i = (y * width + x) * 4;
          for (let c = 0; c < 3; c += 1) {
            const getC = (ox, oy) => src[((y + oy) * width + (x + ox)) * 4 + c];
            const tl = getC(-1, -1), tc = getC(0, -1), tr = getC(1, -1);
            const ml = getC(-1, 0), mr = getC(1, 0);
            const bl = getC(-1, 1), bc = getC(0, 1), br = getC(1, 1);
            const gx = -tl + tr - 2 * ml + 2 * mr - bl + br;
            const gy = -tl - 2 * tc - tr + bl + 2 * bc + br;
            const mag = Math.min(Math.sqrt(gx * gx + gy * gy) * 1.35, 255);
            dst[i + c] = mag > 22 ? mag : 4;
          }
          dst[i + 3] = 255;
        }
      }
    } else if (kernel === 'gaussian') {
      for (let y = 1; y < height - 1; y += 1) {
        for (let x = 1; x < width - 1; x += 1) {
          const i = (y * width + x) * 4;
          for (let c = 0; c < 3; c += 1) {
            let acc = 0;
            acc += src[((y - 1) * width + (x - 1)) * 4 + c] * 1;
            acc += src[((y - 1) * width + x) * 4 + c] * 2;
            acc += src[((y - 1) * width + (x + 1)) * 4 + c] * 1;
            acc += src[(y * width + (x - 1)) * 4 + c] * 2;
            acc += src[(y * width + x) * 4 + c] * 4;
            acc += src[(y * width + (x + 1)) * 4 + c] * 2;
            acc += src[((y + 1) * width + (x - 1)) * 4 + c] * 1;
            acc += src[((y + 1) * width + x) * 4 + c] * 2;
            acc += src[((y + 1) * width + (x + 1)) * 4 + c] * 1;
            dst[i + c] = acc >> 4;
          }
          dst[i + 3] = 255;
        }
      }
    } else if (kernel === 'sharpen') {
      for (let y = 1; y < height - 1; y += 1) {
        for (let x = 1; x < width - 1; x += 1) {
          const i = (y * width + x) * 4;
          for (let c = 0; c < 3; c += 1) {
            const center = src[(y * width + x) * 4 + c];
            const top = src[((y - 1) * width + x) * 4 + c];
            const bottom = src[((y + 1) * width + x) * 4 + c];
            const left = src[(y * width + (x - 1)) * 4 + c];
            const right = src[(y * width + (x + 1)) * 4 + c];
            const val = center * 5 - top - bottom - left - right;
            dst[i + c] = Math.min(255, Math.max(0, val));
          }
          dst[i + 3] = 255;
        }
      }
    } else if (kernel === 'laplacian') {
      for (let y = 1; y < height - 1; y += 1) {
        for (let x = 1; x < width - 1; x += 1) {
          const i = (y * width + x) * 4;
          const getLum = (ox, oy) => {
            const idx = ((y + oy) * width + (x + ox)) * 4;
            return src[idx] * 0.299 + src[idx + 1] * 0.587 + src[idx + 2] * 0.114;
          };
          const c = getLum(0, 0);
          const t = getLum(0, -1);
          const b = getLum(0, 1);
          const l = getLum(-1, 0);
          const r = getLum(1, 0);
          const lap = Math.abs(t + b + l + r - 4 * c) * 3.5;
          dst[i] = Math.min(lap * 1.1, 192);
          dst[i + 1] = Math.min(lap * 0.8, 132);
          dst[i + 2] = Math.min(lap * 1.6, 252);
          dst[i + 3] = 255;
        }
      }
    } else if (kernel === 'emboss') {
      for (let y = 1; y < height - 1; y += 1) {
        for (let x = 1; x < width - 1; x += 1) {
          const i = (y * width + x) * 4;
          const getLum = (ox, oy) => {
            const idx = ((y + oy) * width + (x + ox)) * 4;
            return src[idx] * 0.299 + src[idx + 1] * 0.587 + src[idx + 2] * 0.114;
          };
          const tl = getLum(-1, -1), tc = getLum(0, -1);
          const ml = getLum(-1, 0), mc = getLum(0, 0), mr = getLum(1, 0);
          const bc = getLum(0, 1), br = getLum(1, 1);
          const val = 128 + (-2 * tl - tc - ml + mc + mr + bc + 2 * br);
          const cl = Math.min(255, Math.max(0, val));
          dst[i] = Math.min(cl * 0.72 + 18, 255);
          dst[i + 1] = Math.min(cl * 0.92 + 28, 255);
          dst[i + 2] = Math.min(cl * 1.1 + 42, 255);
          dst[i + 3] = 255;
        }
      }
    }

    const outCanvas = document.createElement('canvas');
    outCanvas.width = width;
    outCanvas.height = height;
    outCanvas.getContext('2d').putImageData(output, 0, 0);

    filterCache.set(kernel, outCanvas);
    return outCanvas;
  }

  function updateActiveFilter() {
    processedCanvas = computeFilter(activeKernel);
    updateStatusUi();
  }

  if (selectEl) {
    selectEl.addEventListener('change', (e) => {
      activeKernel = e.target.value;
      updateActiveFilter();
      if (audio?.enabled) audio.hit('hat', { count: false, strength: 0.3 });
    });
  }

  if (modeBtn) {
    modeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      viewMode = viewMode === 'split' ? 'full' : 'split';
      updateStatusUi();
      if (audio?.enabled) audio.hit('hat', { count: false, strength: 0.38 });
    });
  }

  canvas.addEventListener('pointermove', (e) => {
    if (viewMode !== 'split') return;
    const rect = canvas.getBoundingClientRect();
    targetSplitX = Math.min(Math.max((e.clientX - rect.left) / Math.max(rect.width, 1), 0.05), 0.95);
    isHovered = true;
  });

  canvas.addEventListener('pointerleave', () => {
    isHovered = false;
  });

  resize();
  window.addEventListener('resize', resize, { passive: true });

  return {
    render: (time) => {
      if (!ctx || !width || !height) return;
      const clientW = Math.floor(canvas.clientWidth);
      const clientH = Math.floor(canvas.clientHeight);
      if (clientW > 0 && clientH > 0 && (Math.abs(clientW - width) > 2 || Math.abs(clientH - height) > 2)) {
        resize();
      }

      const timeSec = time * 0.001;
      ctx.setTransform(dpr || 1, 0, 0, dpr || 1, 0, 0);
      ctx.clearRect(0, 0, width, height);

      if (rawCanvas && processedCanvas) {
        if (viewMode === 'full') {
          // Draw full-stage processed canvas (respects HiDPI transform)
          ctx.drawImage(processedCanvas, 0, 0, width, height);
        } else {
          // Split-screen comparison mode
          if (!isHovered) {
            targetSplitX = 0.5 + Math.sin(timeSec * 1.1) * 0.28;
          }
          splitX += (targetSplitX - splitX) * 0.12;

          const splitPx = Math.max(1, Math.min(width - 1, Math.round(splitX * width)));

          // Draw raw RGB on left (scaled accurately across full HiDPI height & width)
          ctx.drawImage(rawCanvas, 0, 0, splitPx, height, 0, 0, splitPx, height);
          // Draw filtered kernel on right
          ctx.drawImage(processedCanvas, splitPx, 0, width - splitPx, height, splitPx, 0, width - splitPx, height);

          // 1.5px Glowing hairline divider aligned with the exact split boundary
          ctx.strokeStyle = '#7dd3fc';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(splitPx, 0);
          ctx.lineTo(splitPx, height);
          ctx.stroke();

          // Compact center split handle pill (avoids overlapping bottom-left status badge)
          const cy = Math.round(height * 0.52);
          ctx.fillStyle = 'rgba(3, 5, 12, 0.9)';
          ctx.strokeStyle = '#7dd3fc';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(splitPx, cy, 11, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = '#f8fafc';
          ctx.font = '700 8.5px "JetBrains Mono", monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('◄►', splitPx, cy + 0.5);
          ctx.textBaseline = 'alphabetic';
        }
      } else {
        ctx.fillStyle = '#020307';
        ctx.fillRect(0, 0, width, height);
      }
    },
  };
}

// =============================================================================
// PREVIEW 02: SUPERSONIC MACH WAVE CONE (RAYLIB / C++17 HIL SIMULATION)
// =============================================================================
function initMachDopplerPreview(canvas) {
  let ctx, width, height;
  let mach = 1.35;
  let targetMach = 1.35;
  let emitterX = 60;
  const soundSpeed = 1.8;
  const wavefronts = [];
  let lastEmit = 0;

  function resize() {
    const res = setupHiDpiCanvas(canvas);
    ctx = res.ctx;
    width = res.width;
    height = res.height;
  }

  canvas.addEventListener('click', () => {
    // Toggle subsonic / supersonic
    targetMach = targetMach > 1.0 ? 0.75 : 1.45;
  });

  canvas.addEventListener('pointermove', (e) => {
    const rect = canvas.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    targetMach = 0.5 + ratio * 1.3; // 0.5 -> 1.8
  });

  resize();
  window.addEventListener('resize', resize, { passive: true });

  return {
    render: (time) => {
      if (!ctx || !width || !height) return;
      mach += (targetMach - mach) * 0.08;
      const emitterSpeed = soundSpeed * mach;
      const cy = height * 0.5;

      emitterX += emitterSpeed;
      if (emitterX > width + 40) {
        emitterX = -30;
        wavefronts.length = 0;
      }

      if (time - lastEmit > 45) {
        wavefronts.push({ x: emitterX, y: cy, radius: 2, alpha: 0.9 });
        lastEmit = time;
      }

      ctx.fillStyle = '#03050a';
      ctx.fillRect(0, 0, width, height);

      // Acoustic pressure wavefront circles
      for (let i = wavefronts.length - 1; i >= 0; i -= 1) {
        const wf = wavefronts[i];
        wf.radius += soundSpeed;
        wf.alpha *= 0.985;

        if (wf.alpha <= 0.04 || wf.radius > width * 1.2) {
          wavefronts.splice(i, 1);
          continue;
        }

        ctx.strokeStyle = mach >= 1.0 ? 'rgba(125, 211, 252, ' + wf.alpha.toFixed(3) + ')' : 'rgba(192, 132, 252, ' + wf.alpha.toFixed(3) + ')';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(wf.x, wf.y, wf.radius, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Draw Mach Shockwave Cone Envelope (when M >= 1.0)
      if (mach >= 1.0) {
        const mu = Math.asin(1 / mach); // Mach angle
        const coneLength = 320;
        const dx = Math.cos(mu) * coneLength;
        const dy = Math.sin(mu) * coneLength;

        // Shockwave cone boundaries
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(emitterX, cy);
        ctx.lineTo(emitterX - dx, cy - dy);
        ctx.moveTo(emitterX, cy);
        ctx.lineTo(emitterX - dx, cy + dy);
        ctx.stroke();

        // Shaded supersonic shockwave wake
        ctx.fillStyle = 'rgba(56, 189, 248, 0.08)';
        ctx.beginPath();
        ctx.moveTo(emitterX, cy);
        ctx.lineTo(emitterX - dx, cy - dy);
        ctx.lineTo(emitterX - dx, cy + dy);
        ctx.closePath();
        ctx.fill();

        // Mach angle arc indicator
        ctx.strokeStyle = 'rgba(248, 250, 252, 0.4)';
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 4]);
        ctx.beginPath();
        ctx.arc(emitterX, cy, 38, Math.PI - mu, Math.PI + mu);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Emitter supersonic projectile
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(emitterX, cy, 4.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.arc(emitterX, cy, 8, 0, Math.PI * 2);
      ctx.globalAlpha = 0.45;
      ctx.fill();
      ctx.globalAlpha = 1;

      // Telemetry readouts
      ctx.fillStyle = '#7dd3fc';
      ctx.font = '700 11px "JetBrains Mono", monospace';
      ctx.textAlign = 'left';
      ctx.fillText(`M ${mach.toFixed(2)} // ${mach >= 1.0 ? 'SUPERSONIC SHOCK CONE' : 'SUBSONIC DOPPLER'}`, 12, 20);

      ctx.fillStyle = 'rgba(148, 163, 184, 0.85)';
      ctx.font = '600 9px "JetBrains Mono", monospace';
      const angleDeg = mach >= 1 ? (Math.asin(1 / mach) * 180 / Math.PI).toFixed(1) + '°' : 'N/A';
      ctx.fillText(`MACH ANGLE: ${angleDeg} · UART 115200 BAUD [RX: 0x4D 0x31]`, 12, 34);
    },
  };
}

// =============================================================================
// PREVIEW 03: KAREN EMERGENCY AI (TACTICAL 3D GEOSPATIAL CITY DISPATCH)
// =============================================================================
function initEmergencyAiPreview(canvas) {
  let ctx, width, height;
  const incidents = [
    { x: -50, y: -25, z: 20, priority: 1, label: 'SECTOR 4 · 3-CAR CRASH', pulse: 0 },
    { x: 45, y: 30, z: -10, priority: 2, label: 'SECTOR 8 · STRUCTURAL FIRE', pulse: 1.2 },
    { x: -20, y: 55, z: 35, priority: 1, label: 'SECTOR 2 · CARDIAC CODE', pulse: 2.5 },
  ];

  function resize() {
    const res = setupHiDpiCanvas(canvas);
    ctx = res.ctx;
    width = res.width;
    height = res.height;
  }

  resize();
  window.addEventListener('resize', resize, { passive: true });

  return {
    render: (time) => {
      if (!ctx || !width || !height) return;
      const timeSec = time * 0.001;
      const cx = width * 0.5;
      const cy = height * 0.55;

      ctx.fillStyle = '#030509';
      ctx.fillRect(0, 0, width, height);

      // 3D Isometric Grid Transform
      const project = (x, y, z) => {
        const isoX = (x - y) * 1.4;
        const isoY = (x + y) * 0.7 - z;
        return { x: cx + isoX, y: cy + isoY };
      };

      // Draw City Grid Blocks
      ctx.strokeStyle = 'rgba(30, 41, 59, 0.5)';
      ctx.lineWidth = 1;
      const gridSize = 5;
      const step = 28;
      for (let i = -gridSize; i <= gridSize; i += 1) {
        const p1 = project(i * step, -gridSize * step, 0);
        const p2 = project(i * step, gridSize * step, 0);
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();

        const q1 = project(-gridSize * step, i * step, 0);
        const q2 = project(gridSize * step, i * step, 0);
        ctx.beginPath();
        ctx.moveTo(q1.x, q1.y);
        ctx.lineTo(q2.x, q2.y);
        ctx.stroke();
      }

      // Radar Sweep Line
      const sweepAngle = timeSec * 1.5;
      const sweepR = 140;
      const sweepPt = project(Math.cos(sweepAngle) * sweepR, Math.sin(sweepAngle) * sweepR, 0);
      const hubPt = project(0, 0, 0);

      ctx.strokeStyle = 'rgba(125, 211, 252, 0.4)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(hubPt.x, hubPt.y);
      ctx.lineTo(sweepPt.x, sweepPt.y);
      ctx.stroke();

      // Dispatch Hub (Central Command)
      ctx.fillStyle = '#7dd3fc';
      ctx.beginPath();
      ctx.arc(hubPt.x, hubPt.y, 4, 0, Math.PI * 2);
      ctx.fill();

      // Incident Beacons & Autonomous Vector Routes
      incidents.forEach((inc, idx) => {
        inc.pulse += 0.04;
        const pt = project(inc.x, inc.y, 0);

        // Vector line from hub to incident
        ctx.strokeStyle = 'rgba(192, 132, 252, 0.45)';
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 4]);
        ctx.beginPath();
        ctx.moveTo(hubPt.x, hubPt.y);
        ctx.lineTo(pt.x, pt.y);
        ctx.stroke();
        ctx.setLineDash([]);

        // Animated traveling ambulance pulse
        const travelT = (timeSec * 0.6 + idx * 0.33) % 1;
        const ambX = hubPt.x + (pt.x - hubPt.x) * travelT;
        const ambY = hubPt.y + (pt.y - hubPt.y) * travelT;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(ambX, ambY, 2.5, 0, Math.PI * 2);
        ctx.fill();

        // Expanding beacon waves
        const waveR = 8 + (inc.pulse % 2.5) * 8;
        const waveAlpha = Math.max(0, 1 - (inc.pulse % 2.5) / 2.5);
        ctx.strokeStyle = inc.priority === 1 ? `rgba(224, 79, 51, ${waveAlpha})` : `rgba(125, 211, 252, ${waveAlpha})`;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, waveR, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = inc.priority === 1 ? '#e04f33' : '#7dd3fc';
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 3.5, 0, Math.PI * 2);
        ctx.fill();

        // Label
        ctx.fillStyle = 'rgba(248, 250, 252, 0.85)';
        ctx.font = '600 8.5px "JetBrains Mono", monospace';
        ctx.textAlign = 'left';
        ctx.fillText(inc.label, pt.x + 8, pt.y + 3);
      });

      // HUD Badge
      ctx.fillStyle = '#c084fc';
      ctx.font = '700 10.5px "JetBrains Mono", monospace';
      ctx.textAlign = 'left';
      ctx.fillText('PYDECK 3D // 6-PHASE AUTONOMOUS DISPATCH', 12, 20);
      ctx.fillStyle = 'rgba(148, 163, 184, 0.85)';
      ctx.font = '600 8.5px "JetBrains Mono", monospace';
      ctx.fillText('8,735 INCIDENTS · REAL-TIME TRIAGE CLUSTER', 12, 33);
    },
  };
}


// =============================================================================
// PREVIEW 05: CPP ARDUINO CONTROL (POSIX 115200-BAUD SERIAL SCOPE & UART STREAM)
// =============================================================================
function initCppSerialPreview(canvas) {
  let ctx, width, height;
  const packets = [
    { dir: 'TX', hex: '0xAA 0x55 0x01 0x2A [CADENCE: 176 SPM]', ok: true },
    { dir: 'RX', hex: '0x55 0xAA 0x06 0xFF [ACK // 60HZ SYNC]', ok: true },
    { dir: 'TX', hex: '0xAA 0x55 0x02 0x7E [DRUM: KICK 155HZ]', ok: true },
    { dir: 'RX', hex: '0x55 0xAA 0x01 0x00 [STATUS: 0x00 NO_ERR]', ok: true },
  ];
  let packetOffset = 0;

  function resize() {
    const res = setupHiDpiCanvas(canvas);
    ctx = res.ctx;
    width = res.width;
    height = res.height;
  }

  resize();
  window.addEventListener('resize', resize, { passive: true });

  return {
    render: (time) => {
      if (!ctx || !width || !height) return;
      const timeSec = time * 0.001;

      ctx.fillStyle = '#020409';
      ctx.fillRect(0, 0, width, height);

      // Top Half: Oscilloscope UART Signal Trace (Square Wave)
      const scopeY = 48;
      ctx.strokeStyle = 'rgba(30, 41, 59, 0.4)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(10, scopeY - 20);
      ctx.lineTo(width - 10, scopeY - 20);
      ctx.moveTo(10, scopeY + 16);
      ctx.lineTo(width - 10, scopeY + 16);
      ctx.stroke();

      // Oscilloscope phosphor pulse trace
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1.6;
      ctx.shadowColor = '#38bdf8';
      ctx.shadowBlur = 6;
      ctx.beginPath();

      const period = 28;
      for (let x = 10; x < width - 10; x += 1) {
        const bit = Math.floor((x + timeSec * 160) / period) % 2;
        const y = bit ? scopeY - 16 : scopeY + 14;
        if (x === 10) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Hardware LED indicators (TX / RX)
      const txActive = Math.sin(timeSec * 18) > 0.2;
      const rxActive = Math.cos(timeSec * 14) > 0.3;

      ctx.fillStyle = txActive ? '#38bdf8' : 'rgba(56, 189, 248, 0.2)';
      ctx.beginPath();
      ctx.arc(width - 64, 18, 3.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = rxActive ? '#c084fc' : 'rgba(192, 132, 252, 0.2)';
      ctx.beginPath();
      ctx.arc(width - 24, 18, 3.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#f8fafc';
      ctx.font = '600 8.5px "JetBrains Mono", monospace';
      ctx.textAlign = 'right';
      ctx.fillText('TX', width - 72, 21);
      ctx.fillText('RX', width - 32, 21);

      // Bottom Half: Rolling Hex UART Byte Stream
      ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.fillRect(10, 78, width - 20, 1);

      packetOffset = Math.floor(timeSec * 1.8) % packets.length;
      ctx.font = '600 9px "JetBrains Mono", monospace';
      ctx.textAlign = 'left';

      for (let i = 0; i < 3; i += 1) {
        const p = packets[(packetOffset + i) % packets.length];
        const lineY = 100 + i * 22;
        if (lineY > height - 6) break;

        ctx.fillStyle = p.dir === 'TX' ? '#38bdf8' : '#c084fc';
        ctx.fillText(`[${p.dir}]`, 14, lineY);

        ctx.fillStyle = 'rgba(248, 250, 252, 0.85)';
        ctx.fillText(p.hex, 44, lineY);
      }

      ctx.fillStyle = '#38bdf8';
      ctx.font = '700 10.5px "JetBrains Mono", monospace';
      ctx.fillText('POSIX TERMIOS // 115200 BAUD UART BUS', 12, 20);
    },
  };
}

// =============================================================================
// PREVIEW 06: 3D-SNAIL (KINETIC 3D LOGARITHMIC SPIRAL HELIX)
// =============================================================================
function init3DSnailPreview(canvas) {
  let ctx, width, height;
  let pointerX = 0;
  let pointerY = 0;
  let targetPointerX = 0;
  let targetPointerY = 0;

  function resize() {
    const res = setupHiDpiCanvas(canvas);
    ctx = res.ctx;
    width = res.width;
    height = res.height;
  }

  canvas.addEventListener('pointermove', (e) => {
    const rect = canvas.getBoundingClientRect();
    targetPointerX = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
    targetPointerY = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
  });

  canvas.addEventListener('pointerleave', () => {
    targetPointerX = 0;
    targetPointerY = 0;
  });

  resize();
  window.addEventListener('resize', resize, { passive: true });

  return {
    render: (time) => {
      if (!ctx || !width || !height) return;
      const timeSec = time * 0.001;
      pointerX += (targetPointerX - pointerX) * 0.1;
      pointerY += (targetPointerY - pointerY) * 0.1;

      ctx.fillStyle = '#030509';
      ctx.fillRect(0, 0, width, height);

      const cx = width * 0.5;
      const cy = height * 0.5;
      const rotY = timeSec * 0.9 + pointerX * 1.2;
      const rotX = 0.35 + pointerY * 0.8;

      const cosY = Math.cos(rotY);
      const sinY = Math.sin(rotY);
      const cosX = Math.cos(rotX);
      const sinX = Math.sin(rotX);

      const project3D = (x, y, z) => {
        const x1 = x * cosY - z * sinY;
        const z1 = z * cosY + x * sinY;
        const y2 = y * cosX - z1 * sinX;
        const z2 = z1 * cosX + y * sinX;
        const fov = 320;
        const scale = fov / (fov + z2);
        return {
          sx: cx + x1 * scale,
          sy: cy + y2 * scale,
          z: z2,
          scale,
        };
      };

      // Generate 3D Logarithmic Spiral Helix Nodes
      const nodes = [];
      const totalPoints = 64;
      for (let i = 0; i < totalPoints; i += 1) {
        const theta = (i / totalPoints) * Math.PI * 4;
        const r = 10 + Math.pow(i / totalPoints, 1.3) * 68;
        const x = Math.cos(theta) * r;
        const y = Math.sin(theta) * r * 0.7;
        const z = (i - totalPoints * 0.5) * 1.8 + Math.sin(timeSec * 3 + i * 0.2) * 5;
        nodes.push(project3D(x, y, z));
      }

      // Draw structural interconnecting ribs
      ctx.strokeStyle = 'rgba(125, 211, 252, 0.4)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      for (let i = 0; i < nodes.length; i += 1) {
        const n = nodes[i];
        if (i === 0) ctx.moveTo(n.sx, n.sy);
        else ctx.lineTo(n.sx, n.sy);
      }
      ctx.stroke();

      // Draw kinetic spring nodes
      nodes.forEach((n, i) => {
        if (i % 3 !== 0) return;
        const alpha = Math.min(Math.max((n.z + 60) / 120, 0.25), 1);
        ctx.fillStyle = i % 6 === 0 ? `rgba(192, 132, 252, ${alpha})` : `rgba(125, 211, 252, ${alpha})`;
        ctx.beginPath();
        ctx.arc(n.sx, n.sy, 2.5 * n.scale, 0, Math.PI * 2);
        ctx.fill();
      });

      ctx.fillStyle = '#c084fc';
      ctx.font = '700 10.5px "JetBrains Mono", monospace';
      ctx.textAlign = 'left';
      ctx.fillText('GSAP SPRINGS // 3D LOGARITHMIC SPIRAL', 12, 20);
      ctx.fillStyle = 'rgba(148, 163, 184, 0.85)';
      ctx.font = '600 8.5px "JetBrains Mono", monospace';
      ctx.fillText('POINTER-DRIVEN PERSPECTIVE & INERTIA', 12, 33);
    },
  };
}

// =============================================================================
// MASTER INITIALIZER & INTERSECTION OBSERVER MANAGER
// =============================================================================
export function initProjectPreviews({ audio } = {}) {
  const instances = [];

  const canvas1 = document.getElementById('canvas-preview-c-image-filters');
  if (canvas1) instances.push({ canvas: canvas1, runner: initImageFiltersPreview(canvas1, { audio }) });

  const canvas2 = document.getElementById('canvas-preview-doppler-hil');
  if (canvas2) instances.push({ canvas: canvas2, runner: initMachDopplerPreview(canvas2) });

  const canvas3 = document.getElementById('canvas-preview-karen-ai');
  if (canvas3) instances.push({ canvas: canvas3, runner: initEmergencyAiPreview(canvas3) });


  const canvas5 = document.getElementById('canvas-preview-cpp-arduino');
  if (canvas5) instances.push({ canvas: canvas5, runner: initCppSerialPreview(canvas5) });

  const canvas6 = document.getElementById('canvas-preview-3d-snail');
  if (canvas6) instances.push({ canvas: canvas6, runner: init3DSnailPreview(canvas6) });

  // Strictly pause RAF when all project preview canvases are offscreen or tab is hidden
  const visibleSet = new Set();
  let rafId = null;

  function loop(time) {
    if (visibleSet.size === 0 || document.hidden) {
      rafId = null;
      return;
    }
    instances.forEach((item) => {
      if (visibleSet.has(item.canvas)) {
        item.runner.render(time);
      }
    });
    rafId = requestAnimationFrame(loop);
  }

  function ensureLoopRunning() {
    if (!rafId && visibleSet.size > 0 && !document.hidden) {
      rafId = requestAnimationFrame(loop);
    }
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          visibleSet.add(entry.target);
        } else {
          visibleSet.delete(entry.target);
        }
      });
      ensureLoopRunning();
    },
    { rootMargin: '80px 0px', threshold: 0.05 }
  );

  instances.forEach((item) => observer.observe(item.canvas));

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
    } else {
      ensureLoopRunning();
    }
  });

  return instances;
}
