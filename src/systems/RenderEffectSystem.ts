export interface VisualParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  alpha: number;
  life: number;
  maxLife: number;
  kind: 'spark' | 'shard' | 'ember' | 'smoke' | 'energy_orb';
  targetX?: number;
  targetY?: number;
}

export interface ShockwaveRing {
  x: number;
  y: number;
  maxRadius: number;
  color: string;
  life: number;
  maxLife: number;
  lineWidth: number;
}

const MAX_PARTICLES = 260;
const MAX_RINGS = 40;

export class RenderEffectSystem {
  private particles: VisualParticle[] = [];
  private rings: ShockwaveRing[] = [];
  private shakeIntensity: number = 0;
  private shakeTimer: number = 0;

  public clear(): void {
    this.particles = [];
    this.rings = [];
    this.shakeIntensity = 0;
    this.shakeTimer = 0;
  }

  public spawnBurst(
    x: number,
    y: number,
    color: string,
    count: number,
    kind: VisualParticle['kind'] = 'spark',
    speed = 90
  ): void {
    const allowed = Math.min(count, MAX_PARTICLES - this.particles.length);
    for (let i = 0; i < allowed; i++) {
      const angle = (Math.PI * 2 * i) / Math.max(1, count) + (Math.random() - 0.5) * 0.6;
      const spd = speed * (0.45 + Math.random() * 0.85);
      const maxLife = 0.28 + Math.random() * 0.35;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd,
        size: kind === 'smoke' ? 4 + Math.random() * 4 : 2 + Math.random() * 2.5,
        color,
        alpha: 1,
        life: maxLife,
        maxLife,
        kind,
      });
    }
  }

  public spawnEnergyOrb(fromX: number, fromY: number, toX: number, toY: number, color = '#38bdf8'): void {
    if (this.particles.length >= MAX_PARTICLES) return;
    this.particles.push({
      x: fromX,
      y: fromY,
      vx: 0,
      vy: 0,
      size: 4.5,
      color,
      alpha: 1,
      life: 0.42,
      maxLife: 0.42,
      kind: 'energy_orb',
      targetX: toX,
      targetY: toY,
    });
  }

  public spawnShockwave(x: number, y: number, maxRadius: number, color: string, duration = 0.35, lineWidth = 2.5): void {
    if (this.rings.length >= MAX_RINGS) {
      this.rings.shift();
    }
    this.rings.push({
      x,
      y,
      maxRadius,
      color,
      life: duration,
      maxLife: duration,
      lineWidth,
    });
  }

  public triggerShake(intensity: number, duration = 0.2): void {
    this.shakeIntensity = Math.max(this.shakeIntensity, intensity);
    this.shakeTimer = Math.max(this.shakeTimer, duration);
  }

  public update(dtSec: number): void {
    if (this.shakeTimer > 0) {
      this.shakeTimer = Math.max(0, this.shakeTimer - dtSec);
      if (this.shakeTimer === 0) {
        this.shakeIntensity = 0;
      }
    }

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dtSec;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }
      const ratio = 1 - p.life / p.maxLife;
      p.alpha = Math.max(0, p.life / p.maxLife);
      if (p.kind === 'energy_orb' && p.targetX !== undefined && p.targetY !== undefined) {
        p.x += (p.targetX - p.x) * Math.min(1, dtSec * 9);
        p.y += (p.targetY - p.y) * Math.min(1, dtSec * 9) - Math.sin(ratio * Math.PI) * 1.2;
      } else {
        p.x += p.vx * dtSec;
        p.y += p.vy * dtSec;
        p.vx *= 0.94;
        p.vy *= 0.94;
      }
    }

    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.life -= dtSec;
      if (r.life <= 0) {
        this.rings.splice(i, 1);
      }
    }
  }

  public getShakeOffset(reducedMotion: boolean, intensitySetting: 'low' | 'normal' | 'high'): { dx: number; dy: number } {
    if (reducedMotion || intensitySetting === 'low' || this.shakeTimer <= 0) {
      return { dx: 0, dy: 0 };
    }
    const mult = intensitySetting === 'high' ? 1.25 : 0.85;
    const mag = this.shakeIntensity * mult * (this.shakeTimer / 0.25);
    return {
      dx: (Math.random() - 0.5) * mag * 2,
      dy: (Math.random() - 0.5) * mag * 2,
    };
  }

  public render(ctx: CanvasRenderingContext2D, reducedMotion: boolean, intensitySetting: 'low' | 'normal' | 'high'): void {
    if (reducedMotion && intensitySetting === 'low') return;

    // Render shockwave rings
    for (const r of this.rings) {
      const progress = 1 - r.life / r.maxLife;
      const radius = Math.max(2, r.maxRadius * progress);
      ctx.save();
      ctx.globalAlpha = Math.max(0, (1 - progress) * 0.85);
      ctx.strokeStyle = r.color;
      ctx.lineWidth = Math.max(0.8, r.lineWidth * (1 - progress * 0.5));
      ctx.beginPath();
      ctx.arc(r.x, r.y, radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Render particles
    const skipFactor = intensitySetting === 'low' ? 2 : 1;
    for (let i = 0; i < this.particles.length; i += skipFactor) {
      const p = this.particles[i];
      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      if (p.kind === 'shard') {
        ctx.translate(p.x, p.y);
        ctx.rotate(p.life * 8);
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
      } else if (p.kind === 'energy_orb') {
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }
}
