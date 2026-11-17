import { WORLD_THEME_PALETTES } from '../data/mapsData';
import { TOWERS_DATA } from '../data/towersData';
import { GameSessionEngine } from '../systems/GameSessionEngine';
import { TowerSystem } from '../systems/TowerSystem';
import { ActiveEnemy, ActiveTower, PlayerProfile, TowerType } from '../types';

export class BattlefieldRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private animTime: number = 0;
  private hoveredPadIndex: number | null = null;
  private previewTowerType: TowerType | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Could not initialize 2D canvas context');
    }
    this.ctx = context;
  }

  public setHoveredPad(padIndex: number | null): void {
    this.hoveredPadIndex = padIndex;
  }

  public setPreviewTowerType(type: TowerType | null): void {
    this.previewTowerType = type;
  }

  public getPadAtCanvasCoords(clientX: number, clientY: number, session: GameSessionEngine): number | null {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;
    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;

    for (const pad of session.map.pads) {
      const dist = Math.hypot(pad.x - x, pad.y - y);
      if (dist <= 28) {
        return pad.index;
      }
    }
    return null;
  }

  public render(session: GameSessionEngine, profile: PlayerProfile, dtSec: number): void {
    if (!profile.settings.reducedMotion) {
      this.animTime += dtSec;
    }

    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    const palette = WORLD_THEME_PALETTES[session.map.theme] ?? WORLD_THEME_PALETTES.green_valley;

    // 1. Background gradient
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, palette.bgTop);
    grad.addColorStop(1, palette.bgBottom);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // 2. Tactical grid
    ctx.strokeStyle = palette.gridColor;
    ctx.lineWidth = 1;
    for (let gx = 0; gx < w; gx += 40) {
      ctx.beginPath();
      ctx.moveTo(gx, 0);
      ctx.lineTo(gx, h);
      ctx.stroke();
    }
    for (let gy = 0; gy < h; gy += 40) {
      ctx.beginPath();
      ctx.moveTo(0, gy);
      ctx.lineTo(w, gy);
      ctx.stroke();
    }

    // 3. Environmental decorations
    for (const dec of session.map.decorations) {
      this.drawDecoration(ctx, dec.x, dec.y, dec.kind, dec.scale, palette.accent);
    }

    // 4. Enemy Road Path
    this.drawPath(ctx, session, palette);

    // 5. Buildable Pads & Range Preview
    const selectedPadIndex = session.getSelectedPadIndex();
    const towers = session.getTowers();

    for (const pad of session.map.pads) {
      const occupiedTower = towers.find((t) => t.padIndex === pad.index);
      const isSelected = selectedPadIndex === pad.index;
      const isHovered = this.hoveredPadIndex === pad.index;

      // Range circle if selected or hovered
      if (isSelected || isHovered) {
        let rangeRadius = 0;
        let rangeColor = palette.accent;
        if (occupiedTower) {
          const stats = TowerSystem.computeEffectiveStats(occupiedTower, towers);
          rangeRadius = stats.range;
          rangeColor = TOWERS_DATA[occupiedTower.type].color;
        } else if (this.previewTowerType) {
          rangeRadius = TOWERS_DATA[this.previewTowerType].range;
          rangeColor = TOWERS_DATA[this.previewTowerType].color;
        }
        if (rangeRadius > 0) {
          ctx.save();
          ctx.beginPath();
          ctx.arc(pad.x, pad.y, rangeRadius, 0, Math.PI * 2);
          ctx.fillStyle = `${rangeColor}18`;
          ctx.fill();
          ctx.strokeStyle = `${rangeColor}88`;
          ctx.lineWidth = 1.5;
          ctx.setLineDash([6, 4]);
          ctx.stroke();
          ctx.restore();
        }
      }

      // Draw Pad base
      ctx.save();
      ctx.beginPath();
      ctx.arc(pad.x, pad.y, 23, 0, Math.PI * 2);
      ctx.fillStyle = isSelected ? '#1e3a8a' : palette.padFill;
      ctx.fill();
      ctx.lineWidth = isSelected || isHovered ? 3 : 1.8;
      ctx.strokeStyle = isSelected ? '#38bdf8' : isHovered ? '#facc15' : palette.padStroke;
      ctx.stroke();

      if (!occupiedTower) {
        // Plus icon on empty pad
        ctx.strokeStyle = isSelected ? '#7dd3fc' : 'rgba(255,255,255,0.28)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(pad.x - 6, pad.y);
        ctx.lineTo(pad.x + 6, pad.y);
        ctx.moveTo(pad.x, pad.y - 6);
        ctx.lineTo(pad.x, pad.y + 6);
        ctx.stroke();
      }
      ctx.restore();
    }

    // 6. Draw Towers
    const powerState = session.getPowerState();
    for (const tower of towers) {
      this.drawTower(ctx, tower, powerState, profile);
    }

    // 7. Draw Enemies
    for (const enemy of session.getEnemies()) {
      this.drawEnemy(ctx, enemy);
    }

    // 8. Draw Projectiles & Effects
    if (profile.settings.animationIntensity !== 'low') {
      for (const proj of session.getProjectiles()) {
        this.drawProjectile(ctx, proj);
      }
    }

    // 9. Draw Floating Texts
    for (const ft of session.getFloatingTexts()) {
      ctx.save();
      ctx.font = 'bold 14px Inter, system-ui, sans-serif';
      ctx.fillStyle = ft.color;
      ctx.globalAlpha = Math.max(0, ft.life / ft.maxLife);
      ctx.textAlign = 'center';
      ctx.fillText(ft.text, ft.x, ft.y);
      ctx.restore();
    }

    // 10. Boss Alert Banner if active
    const bossAlert = session.getBossAlert();
    if (bossAlert) {
      ctx.save();
      ctx.fillStyle = 'rgba(159, 18, 57, 0.88)';
      ctx.fillRect(w / 2 - 230, 14, 460, 36);
      ctx.strokeStyle = '#fda4af';
      ctx.lineWidth = 2;
      ctx.strokeRect(w / 2 - 230, 14, 460, 36);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 15px Inter, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(bossAlert, w / 2, 37);
      ctx.restore();
    }
  }

  private drawPath(
    ctx: CanvasRenderingContext2D,
    session: GameSessionEngine,
    palette: (typeof WORLD_THEME_PALETTES)['green_valley']
  ): void {
    const pts = session.map.waypoints;
    if (pts.length < 2) return;

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Outer road border
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) {
      ctx.lineTo(pts[i].x, pts[i].y);
    }
    ctx.strokeStyle = palette.pathOuter;
    ctx.lineWidth = 42;
    ctx.stroke();

    // Inner road surface
    ctx.strokeStyle = palette.pathInner;
    ctx.lineWidth = 34;
    ctx.stroke();

    // Center tactical guide line
    ctx.strokeStyle = palette.pathLine;
    ctx.globalAlpha = 0.45;
    ctx.lineWidth = 2;
    ctx.setLineDash([10, 12]);
    ctx.lineDashOffset = -this.animTime * 28;
    ctx.stroke();
    ctx.restore();

    // Spawn Portal at start
    const start = pts[0];
    const portalX = Math.max(32, Math.min(this.canvas.width - 32, start.x + 28));
    ctx.save();
    ctx.beginPath();
    ctx.arc(portalX, start.y, 20, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(239, 68, 68, 0.25)';
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#ef4444';
    ctx.stroke();
    ctx.fillStyle = '#fca5a5';
    ctx.font = 'bold 10px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('PORTAL', portalX, start.y - 25);
    ctx.restore();

    // KeyFort Core Base at end
    const end = pts[pts.length - 1];
    const baseX = Math.max(38, Math.min(this.canvas.width - 38, end.x - 32));
    ctx.save();
    ctx.beginPath();
    ctx.arc(baseX, end.y, 25, 0, Math.PI * 2);
    ctx.fillStyle = '#0f172a';
    ctx.fill();
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = '#38bdf8';
    ctx.stroke();

    // Pulsing inner core
    const pulse = 11 + Math.sin(this.animTime * 4) * 2.5;
    ctx.beginPath();
    ctx.arc(baseX, end.y, pulse, 0, Math.PI * 2);
    ctx.fillStyle = '#38bdf8';
    ctx.fill();

    ctx.fillStyle = '#bae6fd';
    ctx.font = 'bold 11px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('KEYFORT', baseX, end.y - 31);
    ctx.restore();
  }

  private drawDecoration(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    kind: string,
    scale: number,
    accent: string
  ): void {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);

    if (kind === 'tree') {
      ctx.fillStyle = '#14532d';
      ctx.beginPath();
      ctx.arc(0, 0, 18, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#166534';
      ctx.beginPath();
      ctx.arc(-4, -4, 12, 0, Math.PI * 2);
      ctx.fill();
    } else if (kind === 'crystal' || kind === 'iceberg') {
      ctx.fillStyle = accent;
      ctx.globalAlpha = 0.55;
      ctx.beginPath();
      ctx.moveTo(0, -18);
      ctx.lineTo(14, 4);
      ctx.lineTo(0, 16);
      ctx.lineTo(-14, 4);
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.fillStyle = 'rgba(148, 163, 184, 0.22)';
      ctx.beginPath();
      ctx.roundRect(-16, -12, 32, 24, 6);
      ctx.fill();
    }
    ctx.restore();
  }

  private drawTower(
    ctx: CanvasRenderingContext2D,
    tower: ActiveTower,
    powerState: 'baseline' | 'powered' | 'overcharged',
    profile: PlayerProfile
  ): void {
    const def = TOWERS_DATA[tower.type];
    const totalTiers = tower.upgrades.damage + tower.upgrades.speed + tower.upgrades.special;
    const skinId = profile.equippedCosmetics.tower_skin;

    ctx.save();
    ctx.translate(tower.x, tower.y);

    // Overcharge or fallback aura ring
    if (powerState === 'overcharged') {
      ctx.beginPath();
      ctx.arc(0, 0, 21 + Math.sin(this.animTime * 6) * 2, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(250, 204, 21, 0.75)';
      ctx.lineWidth = 2;
      ctx.stroke();
    } else if (powerState === 'baseline') {
      ctx.globalAlpha = 0.82;
    }

    // Base chassis
    ctx.beginPath();
    ctx.arc(0, 0, 16 + Math.min(4, totalTiers * 0.6), 0, Math.PI * 2);
    ctx.fillStyle = skinId === 'skin_cyber_gold' ? '#422006' : skinId === 'skin_neon_plasma' ? '#2e1065' : '#0f172a';
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = def.color;
    ctx.stroke();

    // Rotate turret head
    ctx.save();
    ctx.rotate(tower.angle);

    if (tower.type === 'gun') {
      ctx.fillStyle = def.accentColor;
      if (tower.upgrades.speed >= 2) {
        ctx.fillRect(4, -6, 16, 4);
        ctx.fillRect(4, 2, 16, 4);
      } else {
        ctx.fillRect(4, -3, 17, 6);
      }
      ctx.beginPath();
      ctx.arc(0, 0, 10, 0, Math.PI * 2);
      ctx.fillStyle = def.color;
      ctx.fill();
    } else if (tower.type === 'cannon') {
      ctx.fillStyle = '#fb923c';
      ctx.fillRect(2, -6, 15, 12);
      ctx.beginPath();
      ctx.arc(0, 0, 11, 0, Math.PI * 2);
      ctx.fillStyle = def.color;
      ctx.fill();
    } else if (tower.type === 'frost') {
      for (let i = 0; i < 6; i++) {
        ctx.save();
        ctx.rotate((i * Math.PI) / 3 + this.animTime * 1.2);
        ctx.fillStyle = def.accentColor;
        ctx.fillRect(-2, -13, 4, 26);
        ctx.restore();
      }
      ctx.beginPath();
      ctx.arc(0, 0, 8, 0, Math.PI * 2);
      ctx.fillStyle = def.color;
      ctx.fill();
    } else if (tower.type === 'tesla') {
      ctx.beginPath();
      ctx.arc(0, 0, 12, 0, Math.PI * 2);
      ctx.strokeStyle = def.accentColor;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, 6, 0, Math.PI * 2);
      ctx.fillStyle = def.color;
      ctx.fill();
    } else if (tower.type === 'sniper') {
      ctx.fillStyle = def.accentColor;
      ctx.fillRect(2, -2.5, 23, 5);
      ctx.beginPath();
      ctx.arc(0, 0, 9, 0, Math.PI * 2);
      ctx.fillStyle = def.color;
      ctx.fill();
    } else if (tower.type === 'reactor') {
      ctx.rotate(this.animTime * 1.8);
      ctx.strokeStyle = def.accentColor;
      ctx.lineWidth = 2;
      ctx.strokeRect(-10, -10, 20, 20);
      ctx.beginPath();
      ctx.arc(0, 0, 7, 0, Math.PI * 2);
      ctx.fillStyle = def.color;
      ctx.fill();
    }

    if (tower.muzzleFlashTimer > 0) {
      ctx.beginPath();
      ctx.arc(19, 0, 6, 0, Math.PI * 2);
      ctx.fillStyle = '#fef08a';
      ctx.fill();
    }
    ctx.restore();

    // Draw upgrade tier pips below tower
    if (totalTiers > 0) {
      const pipCount = Math.min(9, totalTiers);
      const startX = -((pipCount - 1) * 4) / 2;
      for (let p = 0; p < pipCount; p++) {
        ctx.beginPath();
        ctx.arc(startX + p * 4, 20, 1.8, 0, Math.PI * 2);
        ctx.fillStyle = '#facc15';
        ctx.fill();
      }
    }

    ctx.restore();
  }

  private drawEnemy(ctx: CanvasRenderingContext2D, enemy: ActiveEnemy): void {
    ctx.save();
    ctx.translate(enemy.x, enemy.y);

    if (enemy.isGhost && !enemy.isRevealed) {
      ctx.globalAlpha = 0.42;
    }

    // Status aura (Frozen / Burning / Boss)
    if (enemy.slowTimer > 0) {
      ctx.beginPath();
      ctx.arc(0, 0, enemy.radius + 4, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(34, 211, 238, 0.32)';
      ctx.fill();
    }
    if (enemy.burnTimer > 0) {
      ctx.beginPath();
      ctx.arc(0, 0, enemy.radius + 4, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(249, 115, 22, 0.38)';
      ctx.fill();
    }

    // Enemy Body
    ctx.beginPath();
    if (enemy.type === 'tank' || enemy.isBoss) {
      const r = enemy.radius;
      ctx.roundRect(-r, -r, r * 2, r * 2, 5);
    } else if (enemy.type === 'scout' || enemy.type === 'swarm') {
      const r = enemy.radius;
      ctx.moveTo(r, 0);
      ctx.lineTo(-r, -r * 0.85);
      ctx.lineTo(-r * 0.5, 0);
      ctx.lineTo(-r, r * 0.85);
      ctx.closePath();
    } else {
      ctx.arc(0, 0, enemy.radius, 0, Math.PI * 2);
    }
    ctx.fillStyle = enemy.color;
    ctx.fill();
    ctx.lineWidth = enemy.isBoss ? 3 : 1.8;
    ctx.strokeStyle = enemy.isBoss ? '#fef08a' : '#0f172a';
    ctx.stroke();

    // Shield bubble if shield > 0
    if (enemy.shield > 0) {
      ctx.beginPath();
      ctx.arc(0, 0, enemy.radius + 3, 0, Math.PI * 2);
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Health bar above enemy
    const barW = enemy.isBoss ? 48 : 26;
    const barH = enemy.isBoss ? 6 : 4;
    const barY = -enemy.radius - 11;
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.fillRect(-barW / 2, barY, barW, barH);

    const hpRatio = Math.max(0, Math.min(1, enemy.hp / enemy.maxHp));
    ctx.fillStyle = hpRatio > 0.5 ? '#22c55e' : hpRatio > 0.25 ? '#facc15' : '#ef4444';
    ctx.fillRect(-barW / 2, barY, barW * hpRatio, barH);

    if (enemy.maxShield > 0 && enemy.shield > 0) {
      const shRatio = Math.max(0, Math.min(1, enemy.shield / enemy.maxShield));
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(-barW / 2, barY - 3, barW * shRatio, 2.5);
    }

    ctx.restore();
  }

  private drawProjectile(
    ctx: CanvasRenderingContext2D,
    proj: GameSessionEngine['projectiles'][number]
  ): void {
    ctx.save();
    const alpha = Math.max(0.1, 1 - proj.progress);
    ctx.globalAlpha = alpha;

    if (proj.kind === 'frost_pulse' || proj.kind === 'shockwave') {
      const currentR = (proj.radius ?? 100) * proj.progress;
      ctx.beginPath();
      ctx.arc(proj.fromX, proj.fromY, currentR, 0, Math.PI * 2);
      ctx.strokeStyle = proj.color;
      ctx.lineWidth = 3;
      ctx.stroke();
    } else if (proj.kind === 'lightning' && proj.chainPoints && proj.chainPoints.length >= 2) {
      ctx.beginPath();
      ctx.moveTo(proj.chainPoints[0].x, proj.chainPoints[0].y);
      for (let i = 1; i < proj.chainPoints.length; i++) {
        const pt = proj.chainPoints[i];
        ctx.lineTo(pt.x, pt.y);
      }
      ctx.strokeStyle = '#e9d5ff';
      ctx.lineWidth = 3;
      ctx.stroke();
    } else if (proj.kind === 'sniper_beam' || proj.kind === 'orbital') {
      ctx.beginPath();
      ctx.moveTo(proj.fromX, proj.fromY);
      ctx.lineTo(proj.toX, proj.toY);
      ctx.strokeStyle = proj.color;
      ctx.lineWidth = proj.kind === 'orbital' ? 6 : 3;
      ctx.stroke();
    } else if (proj.kind === 'shell') {
      const cx = proj.fromX + (proj.toX - proj.fromX) * proj.progress;
      const cy = proj.fromY + (proj.toY - proj.fromY) * proj.progress;
      ctx.beginPath();
      ctx.arc(cx, cy, 5, 0, Math.PI * 2);
      ctx.fillStyle = proj.color;
      ctx.fill();
      if (proj.progress > 0.7) {
        ctx.beginPath();
        ctx.arc(proj.toX, proj.toY, (proj.radius ?? 50) * ((proj.progress - 0.7) / 0.3), 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(249, 115, 22, 0.35)';
        ctx.fill();
      }
    } else {
      const cx = proj.fromX + (proj.toX - proj.fromX) * proj.progress;
      const cy = proj.fromY + (proj.toY - proj.fromY) * proj.progress;
      ctx.beginPath();
      ctx.arc(cx, cy, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = proj.color;
      ctx.fill();
    }

    ctx.restore();
  }
}
