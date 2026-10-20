interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  phase: number;
  color: string;
}

export class SeasonalEffectsEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private mode: string | undefined;
  private particles: Particle[] = [];
  private rafId: number | null = null;
  private paused = false;
  private tick = 0;

  constructor(host: HTMLElement) {
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'seasonal-canvas';
    this.canvas.width = 960;
    this.canvas.height = 150;
    host.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d')!;
  }

  public setMode(mode: string | undefined, width: number): void {
    const targetW = Math.max(420, Math.min(1400, width + 80));
    if (this.canvas.width !== targetW) {
      this.canvas.width = targetW;
    }

    if (this.mode === mode) return;
    this.mode = mode;

    if (!mode) {
      if (this.rafId !== null) {
        cancelAnimationFrame(this.rafId);
        this.rafId = null;
      }
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      this.canvas.style.display = 'none';
      return;
    }

    this.canvas.style.display = this.paused ? 'none' : 'block';
    this.initParticles();
    if (!this.paused && this.rafId === null) {
      this.loop();
    }
  }

  public setPaused(paused: boolean): void {
    if (this.paused === paused) return;
    this.paused = paused;
    if (paused) {
      if (this.rafId !== null) {
        cancelAnimationFrame(this.rafId);
        this.rafId = null;
      }
      this.canvas.style.display = 'none';
    } else if (this.mode) {
      this.canvas.style.display = 'block';
      if (this.rafId === null) {
        this.loop();
      }
    }
  }

  private initParticles(): void {
    this.particles = [];
    const count = 32;
    const w = this.canvas.width;
    const h = this.canvas.height;

    for (let i = 0; i < count; i++) {
      let color = '#ffffff';
      if (this.mode === 'halloween') {
        color = i % 2 === 0 ? '#ff7b00' : '#a855f7';
      } else if (this.mode === 'haunted') {
        color = '#4ade80';
      } else if (this.mode === 'leaves') {
        color = i % 2 === 0 ? '#fbbf24' : '#f97316';
      }

      this.particles.push({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.6,
        vy: this.mode === 'haunted' ? -(0.3 + Math.random() * 0.5) : 0.45 + Math.random() * 0.85,
        size: 2 + Math.random() * 3.2,
        alpha: 0.45 + Math.random() * 0.5,
        phase: Math.random() * Math.PI * 2,
        color,
      });
    }
  }

  private loop = (): void => {
    if (!this.mode) return;
    this.tick += 0.04;
    const w = this.canvas.width;
    const h = this.canvas.height;
    const ctx = this.ctx;

    ctx.clearRect(0, 0, w, h);

    // Draw festive string lights along the top rim for Christmas / Snowy / Candy-cane / Halloween
    if (
      this.mode === 'christmas' ||
      this.mode === 'snow' ||
      this.mode === 'candycane' ||
      this.mode === 'halloween'
    ) {
      const bulbColors =
        this.mode === 'christmas'
          ? ['#ef4444', '#22c55e', '#eab308', '#3b82f6']
          : this.mode === 'snow'
          ? ['#fef08a', '#ffffff', '#bae6fd']
          : this.mode === 'candycane'
          ? ['#ef4444', '#22c55e', '#ffffff']
          : ['#ff7b00', '#a855f7', '#facc15'];

      const step = 36;
      for (let x = 44; x < w - 44; x += step) {
        const idx = Math.floor(x / step);
        const pulse = 0.55 + 0.45 * Math.sin(this.tick * 2.2 + idx * 1.1);
        const col = bulbColors[idx % bulbColors.length];
        ctx.save();
        ctx.globalAlpha = pulse;
        ctx.fillStyle = col;
        ctx.shadowColor = col;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(x, 62, 3.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }

    // Draw particles
    for (const p of this.particles) {
      p.x += p.vx + Math.sin(this.tick + p.phase) * 0.25;
      p.y += p.vy;

      if (p.y > h) {
        p.y = 4;
        p.x = Math.random() * w;
      } else if (p.y < 0) {
        p.y = h - 6;
        p.x = Math.random() * w;
      }

      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;

      if (this.mode === 'halloween') {
        // Mini flying bat silhouettes
        const wing = Math.sin(this.tick * 5 + p.phase) * 3;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - 5, p.y - wing);
        ctx.lineTo(p.x - 2, p.y + 2);
        ctx.lineTo(p.x + 2, p.y + 2);
        ctx.lineTo(p.x + 5, p.y - wing);
        ctx.closePath();
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    if (!this.paused) {
      this.rafId = requestAnimationFrame(this.loop);
    } else {
      this.rafId = null;
    }
  };
}
