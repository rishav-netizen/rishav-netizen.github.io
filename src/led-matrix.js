export class LedMatrix {
  constructor(canvas, { onTrigger } = {}) {
    this.canvas = canvas;
    if (!canvas) return;
    this.context = canvas.getContext('2d');
    this.onTrigger = onTrigger;
    this.columns = 36;
    this.rows = 13;
    this.energy = new Float32Array(this.columns).fill(0.25);
    this.pattern = { kick: Array(16).fill(0), rim: Array(16).fill(0), hat: Array(16).fill(0) };
    this.activeStep = -1;
    this.mouseColumn = -1;
    this.resize();
    this.bind();
    window.addEventListener('resize', () => this.resize(), { passive: true });
  }

  bind() {
    if (!this.canvas) return;
    this.canvas.addEventListener('pointermove', (event) => {
      const bounds = this.canvas.getBoundingClientRect();
      const ratio = Math.min(Math.max((event.clientX - bounds.left) / Math.max(bounds.width, 1), 0), 0.999);
      this.mouseColumn = Math.floor(ratio * this.columns);
      for (let col = 0; col < this.columns; col += 1) {
        const dist = Math.abs(col - this.mouseColumn);
        if (dist <= 4) {
          const boost = (1 - dist / 5) * 0.55;
          this.energy[col] = Math.min(1, this.energy[col] + boost);
        }
      }
    });
    this.canvas.addEventListener('pointerleave', () => {
      this.mouseColumn = -1;
    });
    this.canvas.addEventListener('pointerdown', (event) => {
      const bounds = this.canvas.getBoundingClientRect();
      const ratio = Math.min(Math.max((event.clientX - bounds.left) / Math.max(bounds.width, 1), 0), 1);
      const type = ratio < 0.34 ? 'kick' : ratio < 0.67 ? 'rim' : 'hat';
      this.triggerShockwave(ratio, 1.15);
      this.onTrigger?.(type);
    });
  }

  resize() {
    if (!this.canvas) return;
    const bounds = this.canvas.getBoundingClientRect();
    this.width = Math.max(bounds.width, 300);
    this.height = Math.max(bounds.height, 150);
    this.pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(this.width * this.pixelRatio);
    this.canvas.height = Math.round(this.height * this.pixelRatio);
  }

  setPattern(pattern) {
    this.pattern = pattern;
  }

  setActiveStep(step) {
    this.activeStep = step;
  }

  triggerShockwave(centerRatio = 0.5, power = 1) {
    const center = Math.floor(centerRatio * this.columns);
    for (let column = 0; column < this.columns; column += 1) {
      const distance = Math.abs(column - center);
      this.energy[column] = Math.min(1, this.energy[column] + Math.max(0, power - distance * 0.08));
    }
  }

  getColor() {
    return getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#7dd3fc';
  }

  render(time) {
    if (!this.canvas || !this.context) return;
    const clientW = this.canvas.clientWidth;
    const clientH = this.canvas.clientHeight;
    if (clientW > 0 && clientH > 0 && (Math.abs(clientW - this.width) > 2 || Math.abs(clientH - this.height) > 2)) {
      this.resize();
    }

    const context = this.context;
    const width = this.width;
    const height = this.height;
    const cellWidth = width / this.columns;
    const stepHeight = 24;
    const matrixHeight = height - stepHeight;
    const cellHeight = matrixHeight / this.rows;
    const accent = this.getColor();
    context.setTransform(this.pixelRatio, 0, 0, this.pixelRatio, 0, 0);
    context.clearRect(0, 0, width, height);

    for (let column = 0; column < this.columns; column += 1) {
      const organicWave =
        0.15 +
        0.33 *
          Math.pow(Math.sin((column / this.columns) * Math.PI), 1.6) *
          (0.65 + Math.sin(time * 0.0027 + column * 0.3) * 0.35);
      this.energy[column] += (organicWave - this.energy[column]) * 0.08;
      const activeRows = Math.round(this.energy[column] * this.rows);
      const middle = Math.floor(this.rows / 2);
      for (let row = 0; row < this.rows; row += 1) {
        const distance = Math.abs(row - middle);
        const x = column * cellWidth + cellWidth * 0.5;
        const y = row * cellHeight + cellHeight * 0.5;
        context.fillStyle = accent;
        context.globalAlpha = distance <= activeRows * 0.5 ? Math.max(0.28, 1 - distance / (this.rows * 0.7)) : 0.14;
        const dotSize = distance <= activeRows * 0.5 ? Math.max(3, cellWidth * 0.56) : Math.max(2, cellWidth * 0.2);
        context.fillRect(
          x - dotSize * 0.5,
          y - 1,
          dotSize,
          distance <= activeRows * 0.5 ? Math.max(3, cellHeight * 0.42) : 2
        );
      }
    }

    context.globalAlpha = 1;
    context.strokeStyle =
      getComputedStyle(document.documentElement).getPropertyValue('--card-border').trim() || 'rgba(255,255,255,0.08)';
    context.beginPath();
    context.moveTo(0, matrixHeight + 0.5);
    context.lineTo(width, matrixHeight + 0.5);
    context.stroke();

    const stepWidth = width / 16;
    for (let step = 0; step < 16; step += 1) {
      const active = this.pattern.kick?.[step] || this.pattern.rim?.[step] || this.pattern.hat?.[step];
      context.fillStyle = accent;
      context.globalAlpha = step === this.activeStep ? 1 : active ? 0.65 : 0.15;
      context.fillRect(
        step * stepWidth + 2,
        matrixHeight + 7,
        Math.max(3, stepWidth - 4),
        step === this.activeStep ? 11 : active ? 7 : 3
      );
    }
    context.globalAlpha = 1;
  }
}
