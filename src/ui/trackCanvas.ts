import { Track, LiveRaceSession, Team, Driver, Point2D } from '../models/types';

export class TrackCanvasRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private animId: number | null = null;
  private visualProgress: Map<string, number> = new Map();

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
  }

  public start(
    getTrack: () => Track,
    getSession: () => LiveRaceSession | null,
    getTeams: () => Team[],
    getDrivers: () => Driver[],
    getMyTeamId: () => string | null
  ) {
    this.stop();

    const loop = () => {
      this.render(getTrack(), getSession(), getTeams(), getDrivers(), getMyTeamId());
      this.animId = requestAnimationFrame(loop);
    };
    this.animId = requestAnimationFrame(loop);
  }

  public stop() {
    if (this.animId !== null) {
      cancelAnimationFrame(this.animId);
      this.animId = null;
    }
  }

  private render(
    track: Track,
    session: LiveRaceSession | null,
    teams: Team[],
    drivers: Driver[],
    myTeamId: string | null
  ) {
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    if (this.canvas.width !== Math.round(rect.width * dpr) || this.canvas.height !== Math.round(rect.height * dpr)) {
      this.canvas.width = Math.round(rect.width * dpr);
      this.canvas.height = Math.round(rect.height * dpr);
    }

    const ctx = this.ctx;
    ctx.save();
    ctx.scale(dpr, dpr);

    const w = rect.width;
    const h = rect.height;

    // 1. Fundo do Autódromo (Noite de Paddock / Asfalto Tecnológico)
    const grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#09101B');
    grad.addColorStop(1, '#0F1B2D');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Grade sutil de telemetria
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.035)';
    ctx.lineWidth = 1;
    const step = 32;
    for (let x = 0; x < w; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y < h; y += step) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // 2. Gera malha densa da pista interpolada por Catmull-Rom fechado
    const denseTrack = this.buildSmoothClosedPath(track.svgPoints, 180, w, h);

    // Se Safety Car na pista, brilho âmbar pulsante nas bordas
    if (session && session.safetyCarLaps > 0) {
      ctx.strokeStyle = 'rgba(251, 191, 36, 0.28)';
      ctx.lineWidth = 26;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      this.strokePolygon(ctx, denseTrack);
    }

    // Zebras / Borda externa do circuito
    ctx.strokeStyle = session && session.weather !== 'DRY' ? 'rgba(56, 189, 248, 0.35)' : 'rgba(255, 255, 255, 0.22)';
    ctx.lineWidth = 16;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    this.strokePolygon(ctx, denseTrack);

    // Leito de asfalto principal
    ctx.strokeStyle = '#1E293B';
    ctx.lineWidth = 12;
    this.strokePolygon(ctx, denseTrack);

    // Linha ideal de corrida (Racing Line)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 6]);
    this.strokePolygon(ctx, denseTrack);
    ctx.setLineDash([]);

    // 3. Linha de Largada / Chegada Quadriculada (no ponto 0)
    if (denseTrack.length > 2) {
      const p0 = denseTrack[0];
      const p1 = denseTrack[1];
      const angle = Math.atan2(p1.y - p0.y, p1.x - p0.x);
      ctx.save();
      ctx.translate(p0.x, p0.y);
      ctx.rotate(angle + Math.PI / 2);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(-9, -3, 18, 6);
      ctx.fillStyle = '#EF4444';
      ctx.fillRect(-9, -3, 6, 3);
      ctx.fillRect(3, 0, 6, 3);
      ctx.restore();
    }

    // 4. Efeito visual de chuva quando úmido
    if (session && session.weather !== 'DRY') {
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.18)';
      ctx.lineWidth = 1;
      const now = performance.now() * 0.08;
      for (let i = 0; i < 28; i++) {
        const rx = ((i * 73 + now) % w);
        const ry = ((i * 47 + now * 2.1) % h);
        ctx.beginPath();
        ctx.moveTo(rx, ry);
        ctx.lineTo(rx - 4, ry + 10);
        ctx.stroke();
      }
    }

    // 5. Desenha os 20 carros na pista em tempo real
    if (session) {
      // Desenha do último para o primeiro para que os líderes fiquem no topo
      const activeCars = [...session.cars]
        .filter((c) => c.status !== 'DNF')
        .sort((a, b) => b.position - a.position);

      for (const car of activeCars) {
        const prev = this.visualProgress.get(car.driverId) ?? car.trackProgress;
        let target = car.trackProgress;
        // Trata passagem pela linha de chegada (wrap-around 0.99 -> 0.02)
        if (target < prev && prev - target > 0.5) {
          target += 1.0;
        }
        const smoothed = (prev + (target - prev) * 0.08) % 1;
        // Avança suavemente entre ticks se a corrida não terminou
        const continuous = session.isFinished ? smoothed : (smoothed + 0.0009) % 1;
        this.visualProgress.set(car.driverId, continuous);

        const pos = this.getPointAtNormalizedProgress(denseTrack, continuous);
        const team = teams.find((t) => t.id === car.teamId);
        const driver = drivers.find((d) => d.id === car.driverId);
        const isMyCar = car.teamId === myTeamId;

        if (!pos || !team || !driver) continue;

        // Halo / Glow para os carros da equipe do jogador
        if (isMyCar) {
          ctx.beginPath();
          ctx.arc(pos.x, pos.y, 12, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(0, 230, 118, 0.28)';
          ctx.fill();
        }

        // Bolinha do carro com a cor oficial da escuderia
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, isMyCar ? 7.5 : 5.8, 0, Math.PI * 2);
        ctx.fillStyle = team.primaryColor;
        ctx.fill();
        ctx.lineWidth = isMyCar ? 2.2 : 1.3;
        ctx.strokeStyle = isMyCar ? '#00E676' : '#FFFFFF';
        ctx.stroke();

        // Etiqueta com código de 3 letras para os 5 primeiros ou carros do jogador
        if (isMyCar || car.position <= 5) {
          ctx.font = isMyCar ? 'bold 10px "Segoe UI", sans-serif' : '600 9px "Segoe UI", sans-serif';
          const label = `P${car.position} ${driver.shortCode}`;
          const tw = ctx.measureText(label).width;
          ctx.fillStyle = isMyCar ? 'rgba(8, 13, 20, 0.92)' : 'rgba(15, 23, 42, 0.82)';
          ctx.fillRect(pos.x - tw / 2 - 4, pos.y - 20, tw + 8, 13);
          ctx.fillStyle = isMyCar ? '#00E676' : '#F8FAFC';
          ctx.fillText(label, pos.x - tw / 2, pos.y - 10);
        }
      }
    }

    ctx.restore();
  }

  private strokePolygon(ctx: CanvasRenderingContext2D, pts: Point2D[]) {
    if (pts.length === 0) return;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) {
      ctx.lineTo(pts[i].x, pts[i].y);
    }
    ctx.closePath();
    ctx.stroke();
  }

  private buildSmoothClosedPath(normPts: Point2D[], totalSamples: number, w: number, h: number): Point2D[] {
    const padX = 36;
    const padY = 30;
    const usableW = Math.max(50, w - padX * 2);
    const usableH = Math.max(50, h - padY * 2);

    const pts = normPts.map((p) => ({
      x: padX + p.x * usableW,
      y: padY + p.y * usableH,
    }));

    const n = pts.length;
    if (n < 3) return pts;

    const result: Point2D[] = [];
    const samplesPerSeg = Math.max(8, Math.floor(totalSamples / n));

    for (let i = 0; i < n; i++) {
      const p0 = pts[(i - 1 + n) % n];
      const p1 = pts[i];
      const p2 = pts[(i + 1) % n];
      const p3 = pts[(i + 2) % n];

      for (let s = 0; s < samplesPerSeg; s++) {
        const t = s / samplesPerSeg;
        const t2 = t * t;
        const t3 = t2 * t;

        const x =
          0.5 *
          (2 * p1.x +
            (-p0.x + p2.x) * t +
            (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
            (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3);

        const y =
          0.5 *
          (2 * p1.y +
            (-p0.y + p2.y) * t +
            (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
            (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3);

        result.push({ x, y });
      }
    }
    return result;
  }

  private getPointAtNormalizedProgress(denseTrack: Point2D[], progress: number): Point2D | null {
    if (denseTrack.length === 0) return null;
    const norm = ((progress % 1) + 1) % 1;
    const exactIdx = norm * denseTrack.length;
    const i0 = Math.floor(exactIdx) % denseTrack.length;
    const i1 = (i0 + 1) % denseTrack.length;
    const frac = exactIdx - Math.floor(exactIdx);

    return {
      x: denseTrack[i0].x + (denseTrack[i1].x - denseTrack[i0].x) * frac,
      y: denseTrack[i0].y + (denseTrack[i1].y - denseTrack[i0].y) * frac,
    };
  }
}
