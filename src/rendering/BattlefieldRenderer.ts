import { WORLD_THEME_PALETTES } from '../data/mapsData';
import { TOWERS_DATA } from '../data/towersData';
import { GameSessionEngine } from '../systems/GameSessionEngine';
import { TowerSystem } from '../systems/TowerSystem';
import { ActiveEnemy, ActiveTower, PlayerProfile, TowerType, WorldThemeId } from '../types';

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
    const theme = session.map.theme;
    const palette = WORLD_THEME_PALETTES[theme] ?? WORLD_THEME_PALETTES.green_valley;

    // 1. Rich themed background gradient
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, palette.bgTop);
    grad.addColorStop(1, palette.bgBottom);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // 2. World-specific environmental backdrop features (rivers, lava conduits, ice floes, ruins)
    this.drawThemeBackdrop(ctx, w, h, theme, palette.accent);

    // 3. Subtle tactical terrain grid
    ctx.strokeStyle = palette.gridColor;
    ctx.lineWidth = 1;
    for (let gx = 0; gx < w; gx += 46) {
      ctx.beginPath();
      ctx.moveTo(gx, 0);
      ctx.lineTo(gx, h);
      ctx.stroke();
    }
    for (let gy = 0; gy < h; gy += 46) {
      ctx.beginPath();
      ctx.moveTo(0, gy);
      ctx.lineTo(w, gy);
      ctx.stroke();
    }

    // 4. Environmental props & landmarks
    for (const dec of session.map.decorations) {
      this.drawDecoration(ctx, dec.x, dec.y, dec.kind, dec.scale, palette.accent);
    }

    // 5. Stylized Enemy Road Path, Spawn Portal & KeyFort Command Core
    this.drawPath(ctx, session, palette);

    // 6. Buildable Tower Pedestals & Range Preview Rings
    const selectedPadIndex = session.getSelectedPadIndex();
    const towers = session.getTowers();

    for (const pad of session.map.pads) {
      const occupiedTower = towers.find((t) => t.padIndex === pad.index);
      const isSelected = selectedPadIndex === pad.index;
      const isHovered = this.hoveredPadIndex === pad.index;

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
        } else if (isSelected) {
          rangeRadius = TOWERS_DATA.gun.range;
          rangeColor = '#38bdf8';
        }
        if (rangeRadius > 0) {
          ctx.save();
          ctx.beginPath();
          ctx.arc(pad.x, pad.y, rangeRadius, 0, Math.PI * 2);
          ctx.fillStyle = `${rangeColor}1a`;
          ctx.fill();
          ctx.strokeStyle = `${rangeColor}aa`;
          ctx.lineWidth = 1.8;
          ctx.setLineDash([7, 5]);
          ctx.stroke();
          ctx.restore();
        }
      }

      // Draw octagonal/armored pedestal base
      ctx.save();
      ctx.beginPath();
      ctx.arc(pad.x, pad.y, 22, 0, Math.PI * 2);
      ctx.fillStyle = isSelected ? '#172554' : palette.padFill;
      ctx.fill();
      ctx.lineWidth = isSelected || isHovered ? 3 : 1.8;
      ctx.strokeStyle = isSelected ? '#38bdf8' : isHovered ? '#facc15' : palette.padStroke;
      ctx.stroke();

      // Inner metallic rim
      ctx.beginPath();
      ctx.arc(pad.x, pad.y, 16, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255,255,255,0.12)';
      ctx.lineWidth = 1;
      ctx.stroke();

      if (!occupiedTower) {
        ctx.fillStyle = isSelected ? '#7dd3fc' : 'rgba(255,255,255,0.45)';
        ctx.font = 'bold 10px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`#${pad.index + 1}`, pad.x, pad.y + 4);
      }
      ctx.restore();
    }

    // 7. Draw Towers with rotating turrets, upgrade visuals, and power-state auras
    const powerState = session.getPowerState();
    for (const tower of towers) {
      this.drawTower(ctx, tower, powerState, profile);
    }

    // 8. Draw Enemies with distinct silhouettes, directional orientation, and status bars
    for (const enemy of session.getEnemies()) {
      this.drawEnemy(ctx, enemy, session);
    }

    // 9. Draw Projectiles, Explosions, Lightning Chains & Beams
    if (profile.settings.animationIntensity !== 'low') {
      for (const proj of session.getProjectiles()) {
        this.drawProjectile(ctx, proj);
      }
    }

    // 10. Draw Floating Combat Numbers & Gold Popups
    for (const ft of session.getFloatingTexts()) {
      ctx.save();
      ctx.font = 'bold 13px Inter, system-ui, sans-serif';
      ctx.fillStyle = ft.color;
      ctx.globalAlpha = Math.max(0, ft.life / ft.maxLife);
      ctx.textAlign = 'center';
      ctx.shadowColor = 'rgba(0,0,0,0.85)';
      ctx.shadowBlur = 4;
      ctx.fillText(ft.text, ft.x, ft.y);
      ctx.restore();
    }

    // 11. Boss Alert Banner if active
    const bossAlert = session.getBossAlert();
    if (bossAlert) {
      ctx.save();
      ctx.fillStyle = 'rgba(159, 18, 57, 0.92)';
      ctx.beginPath();
      ctx.roundRect(w / 2 - 220, 12, 440, 34, 8);
      ctx.fill();
      ctx.strokeStyle = '#fda4af';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 14px Inter, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(bossAlert, w / 2, 34);
      ctx.restore();
    }
  }

  private drawThemeBackdrop(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    theme: WorldThemeId,
    accent: string
  ): void {
    ctx.save();
    if (theme === 'green_valley') {
      // Winding river stream across the valley
      ctx.strokeStyle = 'rgba(14, 165, 233, 0.16)';
      ctx.lineWidth = 48;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(310, 0);
      ctx.bezierCurveTo(290, h * 0.4, 410, h * 0.6, 380, h);
      ctx.stroke();
    } else if (theme === 'dark_forest') {
      // Glowing forest mist & firefly spores
      for (let i = 0; i < 8; i++) {
        const fx = ((i * 137) % (w - 80)) + 40;
        const fy = ((i * 89) % (h - 60)) + 30;
        const r = 3 + Math.sin(this.animTime * 2 + i) * 1.5;
        ctx.fillStyle = 'rgba(165, 180, 252, 0.25)';
        ctx.beginPath();
        ctx.arc(fx, fy, r, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (theme === 'mountain_pass') {
      // Layered cliff contour lines
      ctx.strokeStyle = 'rgba(251, 146, 60, 0.1)';
      ctx.lineWidth = 3;
      for (let c = 0; c < 3; c++) {
        ctx.beginPath();
        ctx.moveTo(0, 60 + c * 140);
        ctx.lineTo(w, 95 + c * 140);
        ctx.stroke();
      }
    } else if (theme === 'desert_outpost') {
      // Sand dune arcs
      ctx.strokeStyle = 'rgba(250, 204, 21, 0.09)';
      ctx.lineWidth = 22;
      ctx.beginPath();
      ctx.arc(w * 0.35, h * 0.85, 180, Math.PI * 1.1, Math.PI * 1.9);
      ctx.stroke();
    } else if (theme === 'frozen_islands') {
      // Shimmering glacier plates
      ctx.fillStyle = 'rgba(56, 189, 248, 0.08)';
      ctx.beginPath();
      ctx.moveTo(80, 40);
      ctx.lineTo(220, 25);
      ctx.lineTo(190, 110);
      ctx.closePath();
      ctx.fill();
    } else if (theme === 'ancient_ruins') {
      // Arcane runic circle in background
      ctx.strokeStyle = 'rgba(232, 121, 249, 0.12)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(w * 0.5, h * 0.5, 135, 0, Math.PI * 2);
      ctx.stroke();
    } else if (theme === 'industrial_city' || theme === 'final_fortress') {
      // Energy conduit channels
      ctx.strokeStyle = `${accent}1f`;
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(0, h * 0.5);
      ctx.lineTo(w, h * 0.5);
      ctx.stroke();
    }
    ctx.restore();
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

    // Outer road curb shadow
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) {
      ctx.lineTo(pts[i].x, pts[i].y);
    }
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.lineWidth = 46;
    ctx.stroke();

    // Outer road border
    ctx.strokeStyle = palette.pathOuter;
    ctx.lineWidth = 40;
    ctx.stroke();

    // Inner road surface
    ctx.strokeStyle = palette.pathInner;
    ctx.lineWidth = 32;
    ctx.stroke();

    // Animated directional energy chevrons along path
    ctx.strokeStyle = palette.pathLine;
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = 2.2;
    ctx.setLineDash([8, 14]);
    ctx.lineDashOffset = -this.animTime * 28;
    ctx.stroke();
    ctx.restore();

    // Spawn Portal at start
    const start = pts[0];
    const portalX = Math.max(34, Math.min(this.canvas.width - 34, start.x + 28));
    ctx.save();
    ctx.beginPath();
    ctx.arc(portalX, start.y, 20, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(239, 68, 68, 0.28)';
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#ef4444';
    ctx.stroke();

    // Rotating inner vortex ring
    ctx.beginPath();
    ctx.arc(portalX, start.y, 12, this.animTime * 3, this.animTime * 3 + Math.PI * 1.3);
    ctx.strokeStyle = '#fca5a5';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#fecaca';
    ctx.font = 'bold 10px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('PORTAL', portalX, start.y - 25);
    ctx.restore();

    // KeyFort Core Base at end
    const end = pts[pts.length - 1];
    const baseX = Math.max(40, Math.min(this.canvas.width - 40, end.x - 32));
    ctx.save();
    // Octagonal bastion base
    ctx.beginPath();
    ctx.arc(baseX, end.y, 25, 0, Math.PI * 2);
    ctx.fillStyle = '#0f172a';
    ctx.fill();
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = '#38bdf8';
    ctx.stroke();

    // Pulsing inner crystal core
    const pulse = 10 + Math.sin(this.animTime * 4) * 2;
    ctx.beginPath();
    ctx.arc(baseX, end.y, pulse, 0, Math.PI * 2);
    ctx.fillStyle = '#38bdf8';
    ctx.fill();

    ctx.fillStyle = '#bae6fd';
    ctx.font = 'bold 10px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('KEYFORT', baseX, end.y - 30);
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
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath();
      ctx.arc(3, 4, 18, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#14532d';
      ctx.beginPath();
      ctx.arc(0, 0, 18, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#166534';
      ctx.beginPath();
      ctx.arc(-4, -4, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#22c55e';
      ctx.beginPath();
      ctx.arc(-6, -6, 6, 0, Math.PI * 2);
      ctx.fill();
    } else if (kind === 'crystal' || kind === 'iceberg') {
      ctx.fillStyle = accent;
      ctx.globalAlpha = 0.65;
      ctx.beginPath();
      ctx.moveTo(0, -18);
      ctx.lineTo(13, 3);
      ctx.lineTo(0, 16);
      ctx.lineTo(-13, 3);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.stroke();
    } else if (kind === 'cactus') {
      ctx.fillStyle = '#15803d';
      ctx.beginPath();
      ctx.roundRect(-4, -16, 8, 30, 4);
      ctx.roundRect(-12, -8, 8, 5, 2);
      ctx.roundRect(4, -11, 8, 5, 2);
      ctx.fill();
    } else if (kind === 'ruin' || kind === 'fortress_pillar') {
      ctx.fillStyle = '#334155';
      ctx.beginPath();
      ctx.roundRect(-14, -14, 28, 28, 5);
      ctx.fill();
      ctx.strokeStyle = accent;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(-10, -10, 20, 20);
    } else {
      ctx.fillStyle = 'rgba(148, 163, 184, 0.25)';
      ctx.beginPath();
      ctx.moveTo(-14, 8);
      ctx.lineTo(-8, -10);
      ctx.lineTo(6, -12);
      ctx.lineTo(15, 6);
      ctx.closePath();
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

    // Power-state visual aura ring
    if (powerState === 'overcharged') {
      ctx.beginPath();
      ctx.arc(0, 0, 22 + Math.sin(this.animTime * 7) * 2, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(250, 204, 21, 0.16)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(250, 204, 21, 0.85)';
      ctx.lineWidth = 2;
      ctx.stroke();
    } else if (powerState === 'powered') {
      ctx.beginPath();
      ctx.arc(0, 0, 20, 0, Math.PI * 2);
      ctx.strokeStyle = `${def.color}55`;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    } else {
      ctx.globalAlpha = 0.84;
    }

    // Armored base chassis
    ctx.beginPath();
    ctx.arc(0, 0, 16 + Math.min(3.5, totalTiers * 0.5), 0, Math.PI * 2);
    ctx.fillStyle = skinId === 'skin_cyber_gold' ? '#422006' : skinId === 'skin_neon_plasma' ? '#2e1065' : '#0f172a';
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = def.color;
    ctx.stroke();

    // Rotate turret head with subtle recoil kick
    const recoilOffset = tower.muzzleFlashTimer > 0 ? -2.2 : 0;
    ctx.save();
    ctx.rotate(tower.angle);
    ctx.translate(recoilOffset, 0);

    if (tower.type === 'gun') {
      ctx.fillStyle = '#94a3b8';
      if (tower.upgrades.speed >= 2) {
        ctx.fillRect(4, -7, 17, 4);
        ctx.fillRect(4, 3, 17, 4);
      } else {
        ctx.fillRect(4, -3.5, 18, 7);
      }
      ctx.fillStyle = def.accentColor;
      ctx.fillRect(16, -2.5, 5, 5);
      ctx.beginPath();
      ctx.arc(0, 0, 10, 0, Math.PI * 2);
      ctx.fillStyle = def.color;
      ctx.fill();
    } else if (tower.type === 'cannon') {
      ctx.fillStyle = '#475569';
      ctx.fillRect(1, -7, 17, 14);
      ctx.fillStyle = '#fb923c';
      ctx.fillRect(13, -8, 5, 16);
      ctx.beginPath();
      ctx.arc(0, 0, 11.5, 0, Math.PI * 2);
      ctx.fillStyle = def.color;
      ctx.fill();
    } else if (tower.type === 'frost') {
      for (let i = 0; i < 6; i++) {
        ctx.save();
        ctx.rotate((i * Math.PI) / 3 + this.animTime * 1.3);
        ctx.fillStyle = def.accentColor;
        ctx.beginPath();
        ctx.moveTo(0, -14);
        ctx.lineTo(3, 0);
        ctx.lineTo(0, 14);
        ctx.lineTo(-3, 0);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
      ctx.beginPath();
      ctx.arc(0, 0, 8, 0, Math.PI * 2);
      ctx.fillStyle = def.color;
      ctx.fill();
    } else if (tower.type === 'tesla') {
      ctx.beginPath();
      ctx.arc(0, 0, 12.5, 0, Math.PI * 2);
      ctx.strokeStyle = def.accentColor;
      ctx.lineWidth = 2.2;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, 8.5, 0, Math.PI * 2);
      ctx.strokeStyle = def.color;
      ctx.lineWidth = 1.8;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, 5, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
    } else if (tower.type === 'sniper') {
      // Laser sight line
      ctx.strokeStyle = 'rgba(16, 185, 129, 0.28)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(22, 0);
      ctx.lineTo(58, 0);
      ctx.stroke();

      ctx.fillStyle = def.accentColor;
      ctx.fillRect(2, -2.5, 24, 5);
      ctx.beginPath();
      ctx.arc(0, 0, 9.5, 0, Math.PI * 2);
      ctx.fillStyle = def.color;
      ctx.fill();
    } else if (tower.type === 'reactor') {
      ctx.rotate(this.animTime * 1.8);
      ctx.strokeStyle = def.accentColor;
      ctx.lineWidth = 2.2;
      ctx.strokeRect(-10, -10, 20, 20);
      ctx.rotate(Math.PI / 4);
      ctx.strokeRect(-9, -9, 18, 18);
      ctx.beginPath();
      ctx.arc(0, 0, 6.5, 0, Math.PI * 2);
      ctx.fillStyle = def.color;
      ctx.fill();
    }

    if (tower.muzzleFlashTimer > 0) {
      ctx.beginPath();
      ctx.arc(20, 0, 6.5, 0, Math.PI * 2);
      ctx.fillStyle = '#fef08a';
      ctx.fill();
    }
    ctx.restore();

    // Draw upgrade tier pips below tower
    if (totalTiers > 0) {
      const pipCount = Math.min(9, totalTiers);
      const startX = -((pipCount - 1) * 4.2) / 2;
      for (let p = 0; p < pipCount; p++) {
        ctx.beginPath();
        ctx.arc(startX + p * 4.2, 20, 2.0, 0, Math.PI * 2);
        ctx.fillStyle = '#facc15';
        ctx.fill();
      }
    }

    ctx.restore();
  }

  private drawEnemy(ctx: CanvasRenderingContext2D, enemy: ActiveEnemy, session: GameSessionEngine): void {
    const waypoints = session.map.waypoints;
    const nextWp = waypoints[Math.min(waypoints.length - 1, enemy.waypointIndex + 1)] ?? waypoints[0];
    const dirAngle = Math.atan2(nextWp.y - enemy.y, nextWp.x - enemy.x);

    ctx.save();
    ctx.translate(enemy.x, enemy.y);

    if (enemy.isGhost && !enemy.isRevealed) {
      ctx.globalAlpha = 0.45;
    }

    // Status aura (Frozen / Burning / Spotter / Boss Phase)
    if (enemy.slowTimer > 0) {
      ctx.beginPath();
      ctx.arc(0, 0, enemy.radius + 5, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(34, 211, 238, 0.35)';
      ctx.fill();
    }
    if (enemy.burnTimer > 0) {
      ctx.beginPath();
      ctx.arc(0, 0, enemy.radius + 5, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(249, 115, 22, 0.42)';
      ctx.fill();
    }
    if (enemy.isBoss) {
      ctx.beginPath();
      ctx.arc(0, 0, enemy.radius + 8 + Math.sin(this.animTime * 5) * 2, 0, Math.PI * 2);
      ctx.strokeStyle = enemy.bossPhase === 3 ? '#f43f5e' : enemy.bossPhase === 2 ? '#facc15' : '#fda4af';
      ctx.lineWidth = 2.2;
      ctx.stroke();
    }

    // Directional enemy body silhouette
    ctx.save();
    ctx.rotate(dirAngle);
    const r = enemy.radius;

    if (enemy.type === 'scout' || enemy.type === 'swarm') {
      // Sleek delta-wing recon drone
      ctx.beginPath();
      ctx.moveTo(r * 1.2, 0);
      ctx.lineTo(-r * 0.9, -r * 0.95);
      ctx.lineTo(-r * 0.4, 0);
      ctx.lineTo(-r * 0.9, r * 0.95);
      ctx.closePath();
      ctx.fillStyle = enemy.color;
      ctx.fill();
      ctx.lineWidth = 1.6;
      ctx.strokeStyle = '#0f172a';
      ctx.stroke();
    } else if (enemy.type === 'tank') {
      // Tracked heavy siege vehicle with turret
      ctx.fillStyle = '#334155';
      ctx.fillRect(-r, -r, r * 2, 4);
      ctx.fillRect(-r, r - 4, r * 2, 4);
      ctx.beginPath();
      ctx.roundRect(-r * 0.85, -r * 0.72, r * 1.7, r * 1.44, 4);
      ctx.fillStyle = enemy.color;
      ctx.fill();
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = '#fca5a5';
      ctx.fillRect(0, -2.5, r * 1.1, 5);
    } else if (enemy.isBoss) {
      // Multi-segmented Boss Dreadnought
      ctx.beginPath();
      ctx.roundRect(-r, -r * 0.85, r * 2, r * 1.7, 6);
      ctx.fillStyle = enemy.color;
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#fef08a';
      ctx.stroke();
      ctx.fillStyle = '#fef08a';
      ctx.fillRect(2, -6, r * 1.15, 4);
      ctx.fillRect(2, 2, r * 1.15, 4);
    } else if (enemy.type === 'splitter') {
      // Dual-core orb with glowing seam
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fillStyle = enemy.color;
      ctx.fill();
      ctx.strokeStyle = '#fff7ed';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-r, 0);
      ctx.lineTo(r, 0);
      ctx.stroke();
    } else {
      // Shield / Ghost / Regenerator chassis
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fillStyle = enemy.color;
      ctx.fill();
      ctx.lineWidth = 1.8;
      ctx.strokeStyle = '#0f172a';
      ctx.stroke();

      if (enemy.type === 'regenerator') {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(-5, -1.5, 10, 3);
        ctx.fillRect(-1.5, -5, 3, 10);
      }
    }
    ctx.restore();

    // Shield energy bubble if shield > 0
    if (enemy.shield > 0) {
      ctx.beginPath();
      ctx.arc(0, 0, enemy.radius + 3.5, 0, Math.PI * 2);
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2.2;
      ctx.stroke();
    }

    // Spotter target lock crosshair
    if (enemy.spotterTimer > 0) {
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(-enemy.radius - 2, -enemy.radius - 2, enemy.radius * 2 + 4, enemy.radius * 2 + 4);
    }

    // Health & Shield bar above enemy
    const barW = enemy.isBoss ? 52 : 28;
    const barH = enemy.isBoss ? 6 : 4;
    const barY = -enemy.radius - 11;
    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.fillRect(-barW / 2, barY, barW, barH);

    const hpRatio = Math.max(0, Math.min(1, enemy.hp / enemy.maxHp));
    ctx.fillStyle = hpRatio > 0.5 ? '#22c55e' : hpRatio > 0.25 ? '#facc15' : '#ef4444';
    ctx.fillRect(-barW / 2, barY, barW * hpRatio, barH);

    if (enemy.maxShield > 0 && enemy.shield > 0) {
      const shRatio = Math.max(0, Math.min(1, enemy.shield / enemy.maxShield));
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(-barW / 2, barY - 3.5, barW * shRatio, 2.5);
    }

    if (enemy.isBoss) {
      ctx.fillStyle = '#fef08a';
      ctx.font = 'bold 9px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`BOSS F${enemy.bossPhase}`, 0, barY - 5);
    }

    ctx.restore();
  }

  private drawProjectile(
    ctx: CanvasRenderingContext2D,
    proj: ReturnType<GameSessionEngine['getProjectiles']>[number]
  ): void {
    ctx.save();
    const alpha = Math.max(0.12, 1 - proj.progress);
    ctx.globalAlpha = alpha;

    if (proj.kind === 'frost_pulse' || proj.kind === 'shockwave') {
      const currentR = (proj.radius ?? 100) * proj.progress;
      ctx.beginPath();
      ctx.arc(proj.fromX, proj.fromY, currentR, 0, Math.PI * 2);
      ctx.fillStyle = `${proj.color}22`;
      ctx.fill();
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
      ctx.lineWidth = 3.2;
      ctx.shadowColor = '#a855f7';
      ctx.shadowBlur = 8;
      ctx.stroke();
    } else if (proj.kind === 'sniper_beam' || proj.kind === 'orbital') {
      ctx.beginPath();
      ctx.moveTo(proj.fromX, proj.fromY);
      ctx.lineTo(proj.toX, proj.toY);
      ctx.strokeStyle = proj.color;
      ctx.lineWidth = proj.kind === 'orbital' ? 7 : 3.5;
      ctx.stroke();
      if (proj.kind === 'orbital') {
        ctx.beginPath();
        ctx.arc(proj.toX, proj.toY, (proj.radius ?? 40) * proj.progress, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(244, 63, 94, 0.35)';
        ctx.fill();
      }
    } else if (proj.kind === 'shell') {
      const cx = proj.fromX + (proj.toX - proj.fromX) * proj.progress;
      const cy = proj.fromY + (proj.toY - proj.fromY) * proj.progress;
      ctx.beginPath();
      ctx.arc(cx, cy, 5.5, 0, Math.PI * 2);
      ctx.fillStyle = proj.color;
      ctx.fill();
      if (proj.progress > 0.65) {
        const blastR = (proj.radius ?? 52) * ((proj.progress - 0.65) / 0.35);
        ctx.beginPath();
        ctx.arc(proj.toX, proj.toY, blastR, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(249, 115, 22, 0.38)';
        ctx.fill();
        ctx.strokeStyle = '#fed7aa';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    } else {
      const cx = proj.fromX + (proj.toX - proj.fromX) * proj.progress;
      const cy = proj.fromY + (proj.toY - proj.fromY) * proj.progress;
      ctx.beginPath();
      ctx.arc(cx, cy, 4, 0, Math.PI * 2);
      ctx.fillStyle = proj.color;
      ctx.fill();
    }

    ctx.restore();
  }
}
