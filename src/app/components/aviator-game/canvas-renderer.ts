import { GameState } from '../../models/game.models';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  color: string;
  life: number;
  maxLife: number;
}

export class AviatorCanvasRenderer {
  private canvas!: HTMLCanvasElement;
  private ctx!: CanvasRenderingContext2D;
  private animFrameId: number | null = null;

  // Visual dimensions
  private width: number = 800;
  private height: number = 450;
  private dpr: number = 1;

  // State caches
  private currentState: GameState = GameState.WaitingForBets;
  private currentMultiplier: number = 1.00;
  private flightSeconds: number = 0;
  private countdownRemaining: number = 10.0;
  private maxCountdown: number = 10.0;

  // Plane & Physics Simulation
  private planeX: number = 60;
  private planeY: number = 380;
  private planeAngle: number = 0;
  private targetPlaneX: number = 60;
  private targetPlaneY: number = 380;

  // Crash Exit Sequence
  private isCrashedExiting: boolean = false;
  private crashVelocityX: number = 0;
  private crashVelocityY: number = 0;
  private crashAlpha: number = 1.0;

  // Particles
  private particles: Particle[] = [];

  // Theme Colors
  private readonly COLOR_BG = '#0A0D12';
  private readonly COLOR_GRID = 'rgba(255, 255, 255, 0.04)';
  private readonly COLOR_AXIS = 'rgba(255, 255, 255, 0.15)';
  private readonly COLOR_CRIMSON = '#E61C5A';
  private readonly COLOR_AMBER = '#FFB300';
  private readonly COLOR_CYAN = '#00D2FF';
  private readonly COLOR_EMERALD = '#28C04D';

  public init(canvas: HTMLCanvasElement): void {
    this.canvas = canvas;
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) throw new Error('2D context not supported');
    this.ctx = context;

    this.handleResize();
    this.startRenderLoop();
  }

  public handleResize(): void {
    if (!this.canvas) return;
    const rect = this.canvas.getBoundingClientRect();
    this.dpr = window.devicePixelRatio || 1;
    this.width = rect.width || 800;
    this.height = rect.height || 450;

    this.canvas.width = this.width * this.dpr;
    this.canvas.height = this.height * this.dpr;
    this.ctx.scale(this.dpr, this.dpr);
  }

  public updateState(
    state: GameState, 
    multiplier: number, 
    flightSeconds: number, 
    countdown: number
  ): void {
    if (this.currentState !== GameState.Crashed && state === GameState.Crashed) {
      // Trigger Crash Fly-away physics
      this.isCrashedExiting = true;
      this.crashVelocityX = 14 + Math.random() * 6;
      this.crashVelocityY = -12 - Math.random() * 6;
      this.crashAlpha = 1.0;
      this.spawnCrashExplosion(this.planeX, this.planeY);
    } else if (state === GameState.WaitingForBets) {
      this.isCrashedExiting = false;
      this.planeX = 60;
      this.planeY = this.height - 70;
      this.planeAngle = 0;
    }

    this.currentState = state;
    this.currentMultiplier = multiplier;
    this.flightSeconds = flightSeconds;
    this.countdownRemaining = countdown;
    if (state === GameState.WaitingForBets && countdown > this.maxCountdown) {
      this.maxCountdown = countdown;
    }
  }

  private startRenderLoop(): void {
    const loop = () => {
      this.render();
      this.animFrameId = requestAnimationFrame(loop);
    };
    this.animFrameId = requestAnimationFrame(loop);
  }

  public destroy(): void {
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
    }
  }

  private render(): void {
    const { ctx, width, height } = this;

    // 1. Clear & Background
    ctx.fillStyle = this.COLOR_BG;
    ctx.fillRect(0, 0, width, height);

    // 2. Draw Dynamic Coordinate Grid & Compression
    this.drawCoordinateGrid();

    // 3. Render state-dependent elements
    if (this.currentState === GameState.WaitingForBets) {
      this.renderWaitingState();
    } else {
      this.renderFlightState();
    }

    // 4. Render Active Particles
    this.updateAndDrawParticles();
  }

  private drawCoordinateGrid(): void {
    const { ctx, width, height } = this;
    const originX = 50;
    const originY = height - 50;

    ctx.save();
    ctx.strokeStyle = this.COLOR_GRID;
    ctx.lineWidth = 1;

    // Dynamic grid compression based on multiplier / flight time
    const numHorizontalLines = 6;
    for (let i = 0; i <= numHorizontalLines; i++) {
      const y = originY - (i * (originY - 40) / numHorizontalLines);
      ctx.beginPath();
      ctx.moveTo(originX, y);
      ctx.lineTo(width - 20, y);
      ctx.stroke();

      // Multiplier axis labels
      if (i > 0) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.font = '10px JetBrains Mono, monospace';
        ctx.textAlign = 'right';
        const labelMult = (1 + (i * Math.max(1, (this.currentMultiplier - 1) / 3))).toFixed(1);
        ctx.fillText(`${labelMult}x`, originX - 10, y + 3);
      }
    }

    const numVerticalLines = 8;
    for (let j = 0; j <= numVerticalLines; j++) {
      const x = originX + (j * (width - originX - 30) / numVerticalLines);
      ctx.beginPath();
      ctx.moveTo(x, 30);
      ctx.lineTo(x, originY);
      ctx.stroke();

      // Time axis labels
      if (j > 0 && this.currentState === GameState.Flying) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.font = '10px JetBrains Mono, monospace';
        ctx.textAlign = 'center';
        const labelSec = (j * Math.max(1, this.flightSeconds / 4)).toFixed(0);
        ctx.fillText(`${labelSec}s`, x, originY + 18);
      }
    }

    // Main Axes
    ctx.strokeStyle = this.COLOR_AXIS;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(originX, 20);
    ctx.lineTo(originX, originY);
    ctx.lineTo(width - 20, originY);
    ctx.stroke();

    ctx.restore();
  }

  private renderWaitingState(): void {
    const { ctx, width, height } = this;
    const centerX = width / 2;
    const centerY = height / 2 - 20;

    // Grounded resting plane
    this.planeX = 70;
    this.planeY = height - 70;
    this.drawJetFighter(this.planeX, this.planeY, 0, 1.0);

    // Waiting radar pulse and countdown text
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Outer pulsating radar ring
    const pulseScale = 1 + (Math.sin(Date.now() / 200) * 0.08);
    const radius = 65 * pulseScale;
    
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255, 42, 77, 0.3)';
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(centerX, centerY, 55, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(22, 27, 34, 0.85)';
    ctx.fill();
    ctx.strokeStyle = this.COLOR_CRIMSON;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Countdown Time
    ctx.font = '800 28px JetBrains Mono, monospace';
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(`${Math.max(0, this.countdownRemaining).toFixed(1)}s`, centerX, centerY - 4);

    ctx.font = '600 12px Inter, sans-serif';
    ctx.fillStyle = 'var(--neon-crimson, #FF2A4D)';
    ctx.fillText('WAITING FOR NEXT ROUND', centerX, centerY + 80);

    // Progress ring around radar
    const progress = 1 - (this.countdownRemaining / Math.max(1, this.maxCountdown));
    ctx.beginPath();
    ctx.arc(centerX, centerY, 55, -Math.PI / 2, (-Math.PI / 2) + (Math.PI * 2 * Math.min(1, Math.max(0, progress))));
    ctx.strokeStyle = this.COLOR_AMBER;
    ctx.lineWidth = 4;
    ctx.stroke();

    ctx.restore();
  }

  private renderFlightState(): void {
    const { ctx, width, height } = this;
    const originX = 50;
    const originY = height - 50;

    if (!this.isCrashedExiting) {
      // Dynamic curve calculation based on multiplier & time
      const maxW = width - 120;
      const maxH = height - 120;

      // Normalization curves with dampening for high multipliers
      const progressT = Math.min(1.0, this.flightSeconds / 10.0);
      const multFactor = Math.min(1.0, Math.log10(this.currentMultiplier) / 2.0);

      this.targetPlaneX = originX + (progressT * 0.4 + multFactor * 0.6) * maxW;
      this.targetPlaneY = originY - (progressT * 0.3 + multFactor * 0.7) * maxH;

      // Smooth interpolation (Lerp)
      this.planeX += (this.targetPlaneX - this.planeX) * 0.2;
      this.planeY += (this.targetPlaneY - this.planeY) * 0.2;

      // Control points for quadratic bezier
      const cpX = originX + (this.planeX - originX) * 0.55;
      const cpY = originY;

      // 1. Draw Gradient Under-curve Red Fill
      const gradient = ctx.createLinearGradient(0, this.planeY, 0, originY);
      gradient.addColorStop(0, 'rgba(230, 28, 90, 0.55)');
      gradient.addColorStop(0.7, 'rgba(230, 28, 90, 0.12)');
      gradient.addColorStop(1, 'rgba(230, 28, 90, 0.0)');

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(originX, originY);
      ctx.quadraticCurveTo(cpX, cpY, this.planeX, this.planeY);
      ctx.lineTo(this.planeX, originY);
      ctx.closePath();
      ctx.fillStyle = gradient;
      ctx.fill();

      // 2. Draw Glowing Flight Path Line in Red
      ctx.beginPath();
      ctx.moveTo(originX, originY);
      ctx.quadraticCurveTo(cpX, cpY, this.planeX, this.planeY);
      ctx.strokeStyle = this.COLOR_CRIMSON;
      ctx.lineWidth = 4;
      ctx.shadowColor = this.COLOR_CRIMSON;
      ctx.shadowBlur = 16;
      ctx.stroke();
      ctx.restore();

      // Calculate tangent angle for plane banking
      const t = 1.0;
      const dx = 2 * (1 - t) * (cpX - originX) + 2 * t * (this.planeX - cpX);
      const dy = 2 * (1 - t) * (cpY - originY) + 2 * t * (this.planeY - cpY);
      this.planeAngle = Math.atan2(dy, dx);

      // Emit exhaust thrust particles
      this.emitThrustParticles(this.planeX, this.planeY, this.planeAngle);

      // Draw vector plane
      this.drawJetFighter(this.planeX, this.planeY, this.planeAngle, 1.0);

      // Draw Center Flight Multiplier Text HUD
      this.drawMultiplierHUD(this.currentMultiplier);
    } else {
      // Crashed Exit Physics: Accelerate plane off-screen
      this.planeX += this.crashVelocityX;
      this.planeY += this.crashVelocityY;
      this.crashVelocityX *= 1.05;
      this.crashVelocityY *= 1.05;
      this.crashAlpha = Math.max(0, this.crashAlpha - 0.03);

      if (this.crashAlpha > 0.05) {
        this.emitThrustParticles(this.planeX, this.planeY, this.planeAngle);
        this.drawJetFighter(this.planeX, this.planeY, this.planeAngle, this.crashAlpha);
      }

      // Draw Crashed Banner HUD
      this.drawCrashedHUD(this.currentMultiplier);
    }
  }

  private drawMultiplierHUD(multiplier: number): void {
    const { ctx, width, height } = this;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const multText = `${multiplier.toFixed(2)}x`;
    ctx.font = '900 64px Outfit, Inter, sans-serif';
    
    if (multiplier >= 10.0) {
      ctx.fillStyle = this.COLOR_AMBER;
      ctx.shadowColor = this.COLOR_AMBER;
    } else if (multiplier >= 2.0) {
      ctx.fillStyle = '#C084FC'; // Royal Purple
      ctx.shadowColor = '#C084FC';
    } else {
      ctx.fillStyle = '#FFFFFF';
      ctx.shadowColor = this.COLOR_CRIMSON;
    }

    ctx.shadowBlur = 20;
    ctx.fillText(multText, width / 2, height / 2 - 20);
    ctx.restore();
  }

  private drawCrashedHUD(multiplier: number): void {
    const { ctx, width, height } = this;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // FLEW AWAY banner
    ctx.font = '800 22px Inter, sans-serif';
    ctx.fillStyle = this.COLOR_CRIMSON;
    ctx.fillText('FLEW AWAY!', width / 2, height / 2 - 50);

    // Final crash multiplier
    ctx.font = '900 64px Outfit, Inter, sans-serif';
    ctx.fillStyle = this.COLOR_CRIMSON;
    ctx.shadowColor = this.COLOR_CRIMSON;
    ctx.shadowBlur = 30;
    ctx.fillText(`${multiplier.toFixed(2)}x`, width / 2, height / 2 + 10);
    ctx.restore();
  }

  private drawJetFighter(x: number, y: number, angle: number, alpha: number): void {
    const { ctx } = this;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.globalAlpha = alpha;

    // Vector Jet Sprite
    ctx.scale(1.2, 1.2);

    // Afterburner Flame
    const flicker = Math.random() * 6;
    ctx.beginPath();
    ctx.moveTo(-16, -3);
    ctx.lineTo(-30 - flicker, 0);
    ctx.lineTo(-16, 3);
    ctx.closePath();
    ctx.fillStyle = '#FF9100';
    ctx.shadowColor = '#FF2A4D';
    ctx.shadowBlur = 12;
    ctx.fill();

    // Inner blue core flame
    ctx.beginPath();
    ctx.moveTo(-16, -1.5);
    ctx.lineTo(-24 - (flicker * 0.5), 0);
    ctx.lineTo(-16, 1.5);
    ctx.closePath();
    ctx.fillStyle = '#00F0FF';
    ctx.fill();

    // Main Jet Fuselage
    ctx.beginPath();
    ctx.moveTo(24, 0); // Nose tip
    ctx.lineTo(8, -6);
    ctx.lineTo(-12, -7);
    ctx.lineTo(-16, -4);
    ctx.lineTo(-16, 4);
    ctx.lineTo(-12, 7);
    ctx.lineTo(8, 6);
    ctx.closePath();
    ctx.fillStyle = '#E6EDF3';
    ctx.fill();

    // Red Racing Accent Stripes
    ctx.beginPath();
    ctx.moveTo(14, 0);
    ctx.lineTo(2, -5);
    ctx.lineTo(-6, -5);
    ctx.lineTo(6, 0);
    ctx.closePath();
    ctx.fillStyle = this.COLOR_CRIMSON;
    ctx.fill();

    // Wings
    ctx.beginPath();
    ctx.moveTo(4, -5);
    ctx.lineTo(-8, -20);
    ctx.lineTo(-14, -18);
    ctx.lineTo(-8, -5);
    ctx.closePath();
    ctx.fillStyle = '#8B949E';
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(4, 5);
    ctx.lineTo(-8, 20);
    ctx.lineTo(-14, 18);
    ctx.lineTo(-8, 5);
    ctx.closePath();
    ctx.fillStyle = '#6E7681';
    ctx.fill();

    // Cockpit Glass
    ctx.beginPath();
    ctx.ellipse(6, 0, 7, 3.5, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#00F0FF';
    ctx.shadowColor = '#00F0FF';
    ctx.shadowBlur = 8;
    ctx.fill();

    ctx.restore();
  }

  private emitThrustParticles(x: number, y: number, angle: number): void {
    const tailOffset = 18;
    const tailX = x - Math.cos(angle) * tailOffset;
    const tailY = y - Math.sin(angle) * tailOffset;

    for (let i = 0; i < 3; i++) {
      const spread = (Math.random() - 0.5) * 0.6;
      const speed = 3 + Math.random() * 4;
      const pAngle = angle + Math.PI + spread;

      this.particles.push({
        x: tailX,
        y: tailY,
        vx: Math.cos(pAngle) * speed,
        vy: Math.sin(pAngle) * speed,
        size: 2 + Math.random() * 3.5,
        alpha: 0.85,
        color: Math.random() > 0.4 ? this.COLOR_CRIMSON : this.COLOR_AMBER,
        life: 0,
        maxLife: 20 + Math.random() * 15
      });
    }
  }

  private spawnCrashExplosion(x: number, y: number): void {
    for (let i = 0; i < 35; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2 + Math.random() * 8;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 3 + Math.random() * 5,
        alpha: 1.0,
        color: Math.random() > 0.5 ? this.COLOR_CRIMSON : '#FFFFFF',
        life: 0,
        maxLife: 35 + Math.random() * 20
      });
    }
  }

  private updateAndDrawParticles(): void {
    const { ctx } = this;
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life++;
      p.alpha = Math.max(0, 1 - (p.life / p.maxLife));
      p.size *= 0.96;

      if (p.alpha <= 0.01 || p.life >= p.maxLife) {
        this.particles.splice(i, 1);
        continue;
      }

      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
}
