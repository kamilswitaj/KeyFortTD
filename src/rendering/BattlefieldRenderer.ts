import { HEROES_DATA } from '../data/heroesData';
import { WORLD_THEME_PALETTES } from '../data/mapsData';
import { TOWERS_DATA } from '../data/towersData';
import { GameSessionEngine } from '../systems/GameSessionEngine';
import { HERO_AURA_RADIUS } from '../systems/HeroSystem';
import { SynergySystem } from '../systems/SynergySystem';
import { TowerSystem } from '../systems/TowerSystem';
import { ActiveEnemy, ActiveHero, ActiveTower, PlayerProfile, ProjectileEffect, TowerType, WorldThemeId } from '../types';

const LOGICAL_W = 930;
const LOGICAL_H = 400;

export class BattlefieldRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private animTime: number = 0;
  private hoveredPadIndex: number | null = null;
  private previewTowerType: TowerType | null = null;
  private terrainCache: HTMLCanvasElement | null = null;
  private terrainCacheKey: string = '';

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
    if (rect.width <= 0 || rect.height <= 0) return null;
    const scaleX = LOGICAL_W / rect.width;
    const scaleY = LOGICAL_H / rect.height;
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

  private ensureTerrainCache(session: GameSessionEngine, dpr: number): HTMLCanvasElement {
    const key = `${session.map.id}_${dpr}`;
    if (this.terrainCache && this.terrainCacheKey === key) {
      return this.terrainCache;
    }

    const cache = document.createElement('canvas');
    cache.width = Math.round(LOGICAL_W * dpr);
    cache.height = Math.round(LOGICAL_H * dpr);
    const cctx = cache.getContext('2d')!;
    cctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const theme = session.map.theme;
    const palette = WORLD_THEME_PALETTES[theme] ?? WORLD_THEME_PALETTES.green_valley;

    // 1. Base gradient
    const grad = cctx.createLinearGradient(0, 0, 0, LOGICAL_H);
    grad.addColorStop(0, palette.bgTop);
    grad.addColorStop(1, palette.bgBottom);
    cctx.fillStyle = grad;
    cctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);

    // 2. World-specific static terrain features
    this.drawStaticTerrainDetail(cctx, LOGICAL_W, LOGICAL_H, theme, palette.accent);

    // 3. Subtle tactical grid
    cctx.strokeStyle = palette.gridColor;
    cctx.lineWidth = 1;
    for (let gx = 0; gx < LOGICAL_W; gx += 46) {
      cctx.beginPath();
      cctx.moveTo(gx, 0);
      cctx.lineTo(gx, LOGICAL_H);
      cctx.stroke();
    }
    for (let gy = 0; gy < LOGICAL_H; gy += 46) {
      cctx.beginPath();
      cctx.moveTo(0, gy);
      cctx.lineTo(LOGICAL_W, gy);
      cctx.stroke();
    }

    // 4. Static road shadow, curb & asphalt/stone surface
    const pts = session.map.waypoints;
    if (pts.length >= 2) {
      cctx.save();
      cctx.lineCap = 'round';
      cctx.lineJoin = 'round';
      cctx.beginPath();
      cctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) {
        cctx.lineTo(pts[i].x, pts[i].y);
      }
      cctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
      cctx.lineWidth = 48;
      cctx.stroke();

      cctx.strokeStyle = palette.pathOuter;
      cctx.lineWidth = 40;
      cctx.stroke();

      cctx.strokeStyle = palette.pathInner;
      cctx.lineWidth = 31;
      cctx.stroke();
      cctx.restore();
    }

    // 5. Environmental props & landmarks
    for (const dec of session.map.decorations) {
      this.drawDecoration(cctx, dec.x, dec.y, dec.kind, dec.scale, palette.accent, theme);
    }

    // 6. Soft vignette
    const vig = cctx.createRadialGradient(
      LOGICAL_W / 2,
      LOGICAL_H / 2,
      LOGICAL_W * 0.28,
      LOGICAL_W / 2,
      LOGICAL_H / 2,
      LOGICAL_W * 0.65
    );
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(0,0,0,0.32)');
    cctx.fillStyle = vig;
    cctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);

    this.terrainCache = cache;
    this.terrainCacheKey = key;
    return cache;
  }

  public render(session: GameSessionEngine, profile: PlayerProfile, dtSec: number): void {
    const reducedMotion = profile.settings.reducedMotion;
    const animIntensity = profile.settings.animationIntensity ?? 'normal';
    if (!reducedMotion) {
      this.animTime += dtSec;
    }

    const dpr = typeof window !== 'undefined' ? Math.min(2, Math.max(1, window.devicePixelRatio || 1)) : 1;
    const targetW = Math.round(LOGICAL_W * dpr);
    const targetH = Math.round(LOGICAL_H * dpr);
    if (this.canvas.width !== targetW || this.canvas.height !== targetH) {
      this.canvas.width = targetW;
      this.canvas.height = targetH;
    }

    const ctx = this.ctx;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const shake = session.renderEffects.getShakeOffset(reducedMotion, animIntensity);
    ctx.save();
    ctx.translate(shake.dx, shake.dy);

    const theme = session.map.theme;
    const palette = WORLD_THEME_PALETTES[theme] ?? WORLD_THEME_PALETTES.green_valley;

    // 1. Blit cached static terrain layer
    const cachedTerrain = this.ensureTerrainCache(session, dpr);
    ctx.drawImage(cachedTerrain, 0, 0, LOGICAL_W, LOGICAL_H);

    // 2. Animated environmental ambience (fireflies, snow, energy sparks)
    if (!reducedMotion && animIntensity !== 'low') {
      this.drawAnimatedAmbience(ctx, theme, palette.accent);
    }

    // 3. Animated directional path chevrons, Spawn Portal & KeyFort Bastion Core
    this.drawDynamicPathAndNodes(ctx, session, palette, profile);

    // 4. Tower Pads, Range Previews & Synergy Links
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

          // Draw synergy connection lines to active partners
          const synergies = SynergySystem.getActiveSynergiesForTower(occupiedTower, towers);
          for (const syn of synergies) {
            for (const pid of syn.partnerTowerIds) {
              const partner = towers.find((t) => t.id === pid);
              if (partner) {
                ctx.save();
                ctx.strokeStyle = syn.color;
                ctx.lineWidth = 2;
                ctx.setLineDash([5, 5]);
                ctx.lineDashOffset = -this.animTime * 22;
                ctx.beginPath();
                ctx.moveTo(occupiedTower.x, occupiedTower.y);
                ctx.lineTo(partner.x, partner.y);
                ctx.stroke();
                ctx.restore();
              }
            }
          }
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
          ctx.fillStyle = `${rangeColor}18`;
          ctx.fill();
          ctx.strokeStyle = `${rangeColor}aa`;
          ctx.lineWidth = 1.8;
          ctx.setLineDash([7, 5]);
          ctx.stroke();
          ctx.restore();
        }
      }

      // Octagonal pedestal base
      ctx.save();
      ctx.beginPath();
      ctx.arc(pad.x, pad.y, 22, 0, Math.PI * 2);
      ctx.fillStyle = isSelected ? '#172554' : palette.padFill;
      ctx.fill();
      ctx.lineWidth = isSelected || isHovered ? 2.8 : 1.6;
      ctx.strokeStyle = isSelected ? '#38bdf8' : isHovered ? '#facc15' : palette.padStroke;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(pad.x, pad.y, 16, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255,255,255,0.14)';
      ctx.lineWidth = 1;
      ctx.stroke();

      if (!occupiedTower) {
        if (isHovered && this.previewTowerType) {
          ctx.globalAlpha = 0.55;
          ctx.fillStyle = TOWERS_DATA[this.previewTowerType].color;
          ctx.beginPath();
          ctx.arc(pad.x, pad.y, 12, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1;
        }
        ctx.fillStyle = isSelected ? '#7dd3fc' : 'rgba(255,255,255,0.52)';
        ctx.font = 'bold 10px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`#${pad.index + 1}`, pad.x, pad.y + 3.5);
      }
      ctx.restore();
    }

    // 5. Draw Towers
    const powerState = session.getPowerState();
    for (const tower of towers) {
      this.drawTower(ctx, tower, powerState, profile);
    }

    // 6. Draw Active Hero (if present)
    const hero = session.getHero();
    if (hero) {
      this.drawHero(ctx, hero);
    }

    // 7. Draw Ground Enemies, then Flying Enemies
    const enemies = session.getEnemies();
    for (const enemy of enemies) {
      if (!enemy.isFlying) this.drawEnemy(ctx, enemy, session);
    }
    for (const enemy of enemies) {
      if (enemy.isFlying) this.drawEnemy(ctx, enemy, session);
    }

    // 8. Projectiles & RenderEffects
    if (animIntensity !== 'low') {
      for (const proj of session.getProjectiles()) {
        this.drawProjectile(ctx, proj);
      }
    }
    session.renderEffects.render(ctx, reducedMotion, animIntensity);

    // 9. Floating Combat Text
    for (const ft of session.getFloatingTexts()) {
      ctx.save();
      ctx.font = 'bold 12px Inter, system-ui, sans-serif';
      ctx.fillStyle = ft.color;
      ctx.globalAlpha = Math.max(0, ft.life / ft.maxLife);
      ctx.textAlign = 'center';
      ctx.shadowColor = 'rgba(0,0,0,0.9)';
      ctx.shadowBlur = 4;
      ctx.fillText(ft.text, ft.x, ft.y);
      ctx.restore();
    }

    // 10. Boss Health Bar / Alert
    const activeBoss = enemies.find((e) => e.isBoss && e.hp > 0);
    if (activeBoss) {
      this.drawBossHealthBar(ctx, activeBoss);
    } else {
      const bossAlert = session.getBossAlert();
      if (bossAlert) {
        ctx.save();
        ctx.fillStyle = 'rgba(159, 18, 57, 0.92)';
        ctx.beginPath();
        ctx.roundRect(LOGICAL_W / 2 - 220, 10, 440, 32, 8);
        ctx.fill();
        ctx.strokeStyle = '#fda4af';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 13px Inter, system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(bossAlert, LOGICAL_W / 2, 31);
        ctx.restore();
      }
    }

    ctx.restore();
  }

  private drawStaticTerrainDetail(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    theme: WorldThemeId,
    accent: string
  ): void {
    ctx.save();
    if (theme === 'green_valley') {
      ctx.strokeStyle = 'rgba(14, 165, 233, 0.2)';
      ctx.lineWidth = 46;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(310, 0);
      ctx.bezierCurveTo(290, h * 0.4, 410, h * 0.6, 380, h);
      ctx.stroke();
      // Grass patches
      ctx.fillStyle = 'rgba(74, 222, 128, 0.08)';
      for (let i = 0; i < 16; i++) {
        ctx.beginPath();
        ctx.ellipse((i * 173) % w, (i * 97) % h, 28, 14, i * 0.4, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (theme === 'dark_forest') {
      ctx.fillStyle = 'rgba(99, 102, 241, 0.07)';
      for (let i = 0; i < 10; i++) {
        ctx.beginPath();
        ctx.arc((i * 197) % w, (i * 113) % h, 42, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (theme === 'mountain_pass') {
      ctx.strokeStyle = 'rgba(251, 146, 60, 0.14)';
      ctx.lineWidth = 3;
      for (let c = 0; c < 4; c++) {
        ctx.beginPath();
        ctx.moveTo(0, 50 + c * 95);
        ctx.lineTo(w, 85 + c * 95);
        ctx.stroke();
      }
    } else if (theme === 'desert_outpost') {
      ctx.strokeStyle = 'rgba(250, 204, 21, 0.1)';
      ctx.lineWidth = 26;
      ctx.beginPath();
      ctx.arc(w * 0.35, h * 0.85, 210, Math.PI * 1.1, Math.PI * 1.9);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(w * 0.78, h * 0.25, 160, Math.PI * 0.1, Math.PI * 0.85);
      ctx.stroke();
    } else if (theme === 'frozen_islands') {
      ctx.fillStyle = 'rgba(125, 211, 252, 0.09)';
      ctx.beginPath();
      ctx.moveTo(60, 30);
      ctx.lineTo(240, 20);
      ctx.lineTo(185, 115);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(720, 280);
      ctx.lineTo(890, 250);
      ctx.lineTo(840, 380);
      ctx.closePath();
      ctx.fill();
    } else if (theme === 'ancient_ruins') {
      ctx.strokeStyle = 'rgba(232, 121, 249, 0.14)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(w * 0.5, h * 0.5, 145, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(w * 0.5, h * 0.5, 115, 0, Math.PI * 2);
      ctx.stroke();
    } else if (theme === 'industrial_city' || theme === 'final_fortress') {
      ctx.strokeStyle = `${accent}26`;
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.moveTo(0, h * 0.5);
      ctx.lineTo(w, h * 0.5);
      ctx.stroke();
      ctx.lineWidth = 2;
      ctx.strokeRect(18, 18, w - 36, h - 36);
    }
    ctx.restore();
  }

  private drawAnimatedAmbience(ctx: CanvasRenderingContext2D, theme: WorldThemeId, accent: string): void {
    ctx.save();
    if (theme === 'dark_forest' || theme === 'ancient_ruins') {
      for (let i = 0; i < 8; i++) {
        const fx = ((i * 137) % (LOGICAL_W - 80)) + 40;
        const fy = ((i * 89) % (LOGICAL_H - 60)) + 30 + Math.sin(this.animTime * 1.4 + i) * 5;
        const r = 2.4 + Math.sin(this.animTime * 2.5 + i) * 1.2;
        ctx.fillStyle = accent;
        ctx.globalAlpha = 0.25 + Math.sin(this.animTime * 2 + i) * 0.12;
        ctx.beginPath();
        ctx.arc(fx, fy, r, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (theme === 'frozen_islands') {
      ctx.fillStyle = 'rgba(224, 242, 254, 0.45)';
      for (let i = 0; i < 14; i++) {
        const sx = (i * 83 + this.animTime * 16) % LOGICAL_W;
        const sy = (i * 59 + this.animTime * 24) % LOGICAL_H;
        ctx.beginPath();
        ctx.arc(sx, sy, 1.8, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  private drawDynamicPathAndNodes(
    ctx: CanvasRenderingContext2D,
    session: GameSessionEngine,
    palette: (typeof WORLD_THEME_PALETTES)['green_valley'],
    profile: PlayerProfile
  ): void {
    const pts = session.map.waypoints;
    if (pts.length < 2) return;

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) {
      ctx.lineTo(pts[i].x, pts[i].y);
    }
    ctx.strokeStyle = palette.pathLine;
    ctx.globalAlpha = 0.48;
    ctx.lineWidth = 2.2;
    ctx.setLineDash([8, 14]);
    ctx.lineDashOffset = -this.animTime * 28;
    ctx.stroke();
    ctx.restore();

    // Spawn Portal
    const start = pts[0];
    const portalX = Math.max(34, Math.min(LOGICAL_W - 34, start.x + 28));
    ctx.save();
    ctx.beginPath();
    ctx.arc(portalX, start.y, 22, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(239, 68, 68, 0.28)';
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#ef4444';
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(portalX, start.y, 13, this.animTime * 3.2, this.animTime * 3.2 + Math.PI * 1.4);
    ctx.strokeStyle = '#fca5a5';
    ctx.lineWidth = 2.2;
    ctx.stroke();

    ctx.fillStyle = '#fecaca';
    ctx.font = 'bold 9.5px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('PORTAL', portalX, start.y - 26);
    ctx.restore();

    // KeyFort Bastion Citadel
    const end = pts[pts.length - 1];
    const baseX = Math.max(40, Math.min(LOGICAL_W - 40, end.x - 32));
    const emblem = profile.equippedCosmetics.base_emblem;
    const baseColor = emblem === 'emblem_emerald' ? '#22c55e' : emblem === 'emblem_crimson' ? '#f43f5e' : '#38bdf8';

    ctx.save();
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const ang = (i * Math.PI) / 4 + Math.PI / 8;
      const vx = baseX + Math.cos(ang) * 26;
      const vy = end.y + Math.sin(ang) * 26;
      if (i === 0) ctx.moveTo(vx, vy);
      else ctx.lineTo(vx, vy);
    }
    ctx.closePath();
    ctx.fillStyle = '#0f172a';
    ctx.fill();
    ctx.lineWidth = 3.2;
    ctx.strokeStyle = baseColor;
    ctx.stroke();

    const pulse = 9.5 + Math.sin(this.animTime * 4) * 2;
    ctx.beginPath();
    ctx.arc(baseX, end.y, pulse, 0, Math.PI * 2);
    ctx.fillStyle = baseColor;
    ctx.fill();

    ctx.fillStyle = '#e0f2fe';
    ctx.font = 'bold 9.5px Inter, sans-serif';
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
    accent: string,
    theme: WorldThemeId
  ): void {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);

    if (kind === 'tree') {
      ctx.fillStyle = 'rgba(0,0,0,0.34)';
      ctx.beginPath();
      ctx.arc(4, 5, 18, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = theme === 'dark_forest' ? '#1e1b4b' : '#14532d';
      ctx.beginPath();
      ctx.arc(0, 0, 18, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = theme === 'dark_forest' ? '#312e81' : '#166534';
      ctx.beginPath();
      ctx.arc(-4, -4, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = theme === 'dark_forest' ? '#6366f1' : '#22c55e';
      ctx.beginPath();
      ctx.arc(-6, -6, 5.5, 0, Math.PI * 2);
      ctx.fill();
    } else if (kind === 'crystal' || kind === 'iceberg') {
      ctx.fillStyle = accent;
      ctx.globalAlpha = 0.7;
      ctx.beginPath();
      ctx.moveTo(0, -18);
      ctx.lineTo(13, 3);
      ctx.lineTo(0, 16);
      ctx.lineTo(-13, 3);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.2;
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
      ctx.lineWidth = 1.6;
      ctx.strokeRect(-10, -10, 20, 20);
    } else if (kind === 'factory') {
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(-15, -12, 30, 24);
      ctx.strokeStyle = accent;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(-15, -12, 30, 24);
      ctx.fillStyle = '#f97316';
      ctx.beginPath();
      ctx.arc(-6, 0, 4, 0, Math.PI * 2);
      ctx.arc(6, 0, 4, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = 'rgba(148, 163, 184, 0.3)';
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

    if (powerState === 'overcharged') {
      ctx.beginPath();
      ctx.arc(0, 0, 22 + Math.sin(this.animTime * 7) * 2, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(250, 204, 21, 0.18)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(250, 204, 21, 0.9)';
      ctx.lineWidth = 2;
      ctx.stroke();
    } else if (powerState === 'powered') {
      ctx.beginPath();
      ctx.arc(0, 0, 20, 0, Math.PI * 2);
      ctx.strokeStyle = `${def.color}55`;
      ctx.lineWidth = 1.4;
      ctx.stroke();
    } else {
      ctx.globalAlpha = 0.82;
    }

    // Armored base chassis
    ctx.beginPath();
    ctx.arc(0, 0, 16 + Math.min(3.5, totalTiers * 0.45), 0, Math.PI * 2);
    ctx.fillStyle = skinId === 'skin_cyber_gold' ? '#422006' : skinId === 'skin_neon_plasma' ? '#2e1065' : '#0f172a';
    ctx.fill();
    ctx.lineWidth = 2.4;
    ctx.strokeStyle = def.color;
    ctx.stroke();

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
      if (tower.upgrades.damage >= 2) {
        ctx.fillRect(1, -8, 17, 6);
        ctx.fillRect(1, 2, 17, 6);
      } else {
        ctx.fillRect(1, -7, 17, 14);
      }
      ctx.fillStyle = '#fb923c';
      ctx.fillRect(13, -8, 5, 16);
      ctx.beginPath();
      ctx.arc(0, 0, 11.5, 0, Math.PI * 2);
      ctx.fillStyle = def.color;
      ctx.fill();
    } else if (tower.type === 'frost') {
      const spikes = tower.upgrades.special >= 2 ? 8 : 6;
      for (let i = 0; i < spikes; i++) {
        ctx.save();
        ctx.rotate((i * Math.PI * 2) / spikes + this.animTime * 1.3);
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
      ctx.strokeStyle = 'rgba(16, 185, 129, 0.35)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(22, 0);
      ctx.lineTo(62, 0);
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
    } else if (tower.type === 'flame') {
      ctx.fillStyle = '#7c2d12';
      ctx.fillRect(-6, -8, 14, 16);
      ctx.fillStyle = '#fb923c';
      ctx.fillRect(6, -5, 13, 4);
      ctx.fillRect(6, 1, 13, 4);
      ctx.beginPath();
      ctx.arc(0, 0, 8.5, 0, Math.PI * 2);
      ctx.fillStyle = def.accentColor;
      ctx.fill();
    } else if (tower.type === 'drone') {
      ctx.strokeStyle = '#5eead4';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-10, -10);
      ctx.lineTo(10, 10);
      ctx.moveTo(10, -10);
      ctx.lineTo(-10, 10);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, 8, 0, Math.PI * 2);
      ctx.fillStyle = def.color;
      ctx.fill();
      // Orbiting mini drone
      const dx = Math.cos(this.animTime * 3.5) * 14;
      const dy = Math.sin(this.animTime * 3.5) * 14;
      ctx.beginPath();
      ctx.arc(dx, dy, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = '#ccfbf1';
      ctx.fill();
    } else if (tower.type === 'laser') {
      ctx.fillStyle = '#854d0e';
      ctx.beginPath();
      ctx.moveTo(-6, -9);
      ctx.lineTo(16, -3);
      ctx.lineTo(16, 3);
      ctx.lineTo(-6, 9);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.arc(4, 0, 6, 0, Math.PI * 2);
      ctx.fillStyle = def.color;
      ctx.fill();
    } else if (tower.type === 'command') {
      ctx.rotate(this.animTime * 1.4);
      ctx.strokeStyle = '#c7d2fe';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, 11, -0.8, 0.8);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, 7, 0, Math.PI * 2);
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

  private drawHero(ctx: CanvasRenderingContext2D, hero: ActiveHero): void {
    const def = HEROES_DATA[hero.id];
    ctx.save();
    ctx.translate(hero.x, hero.y);

    // Guardian Hero tower-rally aura radius
    if (hero.id === 'guardian') {
      ctx.save();
      ctx.beginPath();
      ctx.arc(0, 0, HERO_AURA_RADIUS, 0, Math.PI * 2);
      ctx.strokeStyle = hero.activeBuffTimer > 0 ? 'rgba(250, 204, 21, 0.55)' : 'rgba(56, 189, 248, 0.22)';
      ctx.lineWidth = hero.activeBuffTimer > 0 ? 2 : 1.2;
      ctx.setLineDash([6, 6]);
      ctx.stroke();
      ctx.restore();
    }

    // Hero aura ring
    ctx.beginPath();
    ctx.arc(0, 0, 20 + Math.sin(this.animTime * 4) * 2, 0, Math.PI * 2);
    ctx.fillStyle = `${def.color}22`;
    ctx.fill();
    ctx.strokeStyle = def.color;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Diamond emblem
    ctx.rotate(hero.angle);
    ctx.beginPath();
    ctx.moveTo(15, 0);
    ctx.lineTo(0, -12);
    ctx.lineTo(-12, 0);
    ctx.lineTo(0, 12);
    ctx.closePath();
    ctx.fillStyle = def.color;
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.6;
    ctx.stroke();

    ctx.rotate(-hero.angle);
    ctx.fillStyle = '#facc15';
    ctx.font = 'bold 9px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`★Lv${hero.level}`, 0, -23);
    ctx.restore();
  }

  private drawEnemy(ctx: CanvasRenderingContext2D, enemy: ActiveEnemy, session: GameSessionEngine): void {
    const waypoints = session.map.waypoints;
    const nextWp = waypoints[Math.min(waypoints.length - 1, enemy.waypointIndex + 1)] ?? waypoints[0];
    const dirAngle = Math.atan2(nextWp.y - enemy.y, nextWp.x - enemy.x);

    ctx.save();
    const hoverBob = enemy.isFlying ? Math.sin(this.animTime * 6 + enemy.pathProgress * 0.05) * 3 - 5 : 0;
    if (enemy.isFlying) {
      // Ground shadow for flying enemy
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.beginPath();
      ctx.ellipse(enemy.x, enemy.y + 10, enemy.radius * 0.85, enemy.radius * 0.4, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.translate(enemy.x, enemy.y + hoverBob);

    if (enemy.isGhost && !enemy.isRevealed) {
      ctx.globalAlpha = 0.42;
    }

    if (enemy.type === 'support' && enemy.stunTimer <= 0 && enemy.regenDisabledTimer <= 0) {
      ctx.beginPath();
      ctx.arc(0, 0, 95, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(52, 211, 153, 0.28)';
      ctx.lineWidth = 1.4;
      ctx.setLineDash([4, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    if (enemy.slowTimer > 0) {
      ctx.beginPath();
      ctx.arc(0, 0, enemy.radius + 5, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(34, 211, 238, 0.35)';
      ctx.fill();
    }
    if (enemy.burnTimer > 0) {
      ctx.beginPath();
      ctx.arc(0, 0, enemy.radius + 5, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(249, 115, 22, 0.45)';
      ctx.fill();
    }
    if (enemy.spotterTimer > 0) {
      ctx.beginPath();
      ctx.arc(0, 0, enemy.radius + 6, 0, Math.PI * 2);
      ctx.strokeStyle = '#818cf8';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    if (enemy.isBoss) {
      ctx.beginPath();
      ctx.arc(0, 0, enemy.radius + 8 + Math.sin(this.animTime * 5) * 2, 0, Math.PI * 2);
      ctx.strokeStyle = enemy.bossPhase === 3 ? '#f43f5e' : enemy.bossPhase === 2 ? '#facc15' : '#fda4af';
      ctx.lineWidth = 2.4;
      ctx.stroke();
    }

    ctx.save();
    ctx.rotate(dirAngle);
    const r = enemy.radius;
    const bodyFill = (enemy.hitFlashTimer ?? 0) > 0 ? '#ffffff' : enemy.color;

    if (enemy.type === 'scout' || enemy.type === 'swarm' || enemy.type === 'evasive') {
      ctx.beginPath();
      ctx.moveTo(r * 1.25, 0);
      ctx.lineTo(-r * 0.9, -r * 0.95);
      ctx.lineTo(-r * 0.4, 0);
      ctx.lineTo(-r * 0.9, r * 0.95);
      ctx.closePath();
      ctx.fillStyle = bodyFill;
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = '#0f172a';
      ctx.stroke();
    } else if (enemy.type === 'tank' || enemy.type === 'armored_elite') {
      ctx.fillStyle = '#334155';
      ctx.fillRect(-r, -r, r * 2, 4);
      ctx.fillRect(-r, r - 4, r * 2, 4);
      ctx.beginPath();
      ctx.roundRect(-r * 0.85, -r * 0.72, r * 1.7, r * 1.44, 4);
      ctx.fillStyle = bodyFill;
      ctx.fill();
      ctx.strokeStyle = enemy.type === 'armored_elite' ? '#e2e8f0' : '#0f172a';
      ctx.lineWidth = 2.2;
      ctx.stroke();
      ctx.fillStyle = '#fca5a5';
      ctx.fillRect(0, -2.5, r * 1.1, 5);
    } else if (enemy.isBoss) {
      ctx.beginPath();
      ctx.roundRect(-r, -r * 0.85, r * 2, r * 1.7, 6);
      ctx.fillStyle = bodyFill;
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#fef08a';
      ctx.stroke();
      ctx.fillStyle = '#fef08a';
      ctx.fillRect(2, -6, r * 1.15, 4);
      ctx.fillRect(2, 2, r * 1.15, 4);
    } else if (enemy.type === 'hover') {
      ctx.beginPath();
      ctx.moveTo(r, 0);
      ctx.lineTo(0, -r * 0.9);
      ctx.lineTo(-r, 0);
      ctx.lineTo(0, r * 0.9);
      ctx.closePath();
      ctx.fillStyle = bodyFill;
      ctx.fill();
      ctx.strokeStyle = '#ccfbf1';
      ctx.lineWidth = 1.6;
      ctx.stroke();
    } else if (enemy.type === 'support') {
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fillStyle = bodyFill;
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-2, -6, 4, 12);
      ctx.fillRect(-6, -2, 12, 4);
    } else {
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fillStyle = bodyFill;
      ctx.fill();
      ctx.lineWidth = 1.8;
      ctx.strokeStyle = '#0f172a';
      ctx.stroke();
    }
    ctx.restore();

    if (enemy.shield > 0) {
      ctx.beginPath();
      ctx.arc(0, 0, r + 3.5, 0, Math.PI * 2);
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Health bar above enemy
    const barW = Math.max(20, r * 2);
    const hpRatio = Math.max(0, Math.min(1, enemy.hp / enemy.maxHp));
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.fillRect(-barW / 2, -r - 9, barW, 4);
    ctx.fillStyle = hpRatio > 0.5 ? '#22c55e' : hpRatio > 0.25 ? '#facc15' : '#ef4444';
    ctx.fillRect(-barW / 2, -r - 9, barW * hpRatio, 4);

    ctx.restore();
  }

  private drawBossHealthBar(ctx: CanvasRenderingContext2D, boss: ActiveEnemy): void {
    ctx.save();
    const w = 360;
    const h = 24;
    const x = LOGICAL_W / 2 - w / 2;
    const y = 8;
    ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 6);
    ctx.fill();
    ctx.strokeStyle = '#f43f5e';
    ctx.lineWidth = 1.6;
    ctx.stroke();

    const ratio = Math.max(0, Math.min(1, boss.hp / boss.maxHp));
    ctx.fillStyle = '#e11d48';
    ctx.beginPath();
    ctx.roundRect(x + 4, y + 14, (w - 8) * ratio, 6, 3);
    ctx.fill();

    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 10px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`👑 ${boss.namePl} • Faza ${boss.bossPhase}/3 (${Math.round(boss.hp)}/${boss.maxHp})`, LOGICAL_W / 2, y + 11);
    ctx.restore();
  }

  private drawProjectile(ctx: CanvasRenderingContext2D, proj: ProjectileEffect): void {
    ctx.save();
    const alpha = Math.max(0, 1 - proj.progress);
    ctx.globalAlpha = alpha;

    if (proj.kind === 'frost_pulse' || proj.kind === 'shockwave') {
      const r = (proj.radius ?? 80) * proj.progress;
      ctx.beginPath();
      ctx.arc(proj.fromX, proj.fromY, r, 0, Math.PI * 2);
      ctx.strokeStyle = proj.color;
      ctx.lineWidth = 3;
      ctx.stroke();
    } else if (proj.kind === 'orbital') {
      ctx.beginPath();
      ctx.arc(proj.toX, proj.toY, 65 * proj.progress, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(244, 63, 94, 0.25)';
      ctx.fill();
      ctx.strokeStyle = '#fda4af';
      ctx.lineWidth = 3;
      ctx.stroke();
    } else if (proj.kind === 'lightning' && proj.chainPoints && proj.chainPoints.length > 1) {
      ctx.strokeStyle = proj.color;
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.moveTo(proj.chainPoints[0].x, proj.chainPoints[0].y);
      for (let i = 1; i < proj.chainPoints.length; i++) {
        ctx.lineTo(proj.chainPoints[i].x, proj.chainPoints[i].y);
      }
      ctx.stroke();
    } else if (proj.kind === 'sniper_beam' || proj.kind === 'laser_beam') {
      ctx.strokeStyle = proj.color;
      ctx.lineWidth = proj.kind === 'laser_beam' ? 3.5 : 2.5;
      ctx.beginPath();
      ctx.moveTo(proj.fromX, proj.fromY);
      ctx.lineTo(proj.toX, proj.toY);
      ctx.stroke();
    } else if (proj.kind === 'flame') {
      const px = proj.fromX + (proj.toX - proj.fromX) * proj.progress;
      const py = proj.fromY + (proj.toY - proj.fromY) * proj.progress;
      ctx.beginPath();
      ctx.arc(px, py, 7 + proj.progress * 14, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(251, 146, 60, 0.55)';
      ctx.fill();
    } else {
      const px = proj.fromX + (proj.toX - proj.fromX) * proj.progress;
      const py = proj.fromY + (proj.toY - proj.fromY) * proj.progress;
      ctx.beginPath();
      ctx.arc(px, py, proj.kind === 'shell' ? 5.5 : 3.5, 0, Math.PI * 2);
      ctx.fillStyle = proj.color;
      ctx.fill();
      if (proj.kind === 'shell' && proj.progress > 0.7) {
        ctx.beginPath();
        ctx.arc(proj.toX, proj.toY, (proj.radius ?? 45) * (proj.progress - 0.65) * 2.5, 0, Math.PI * 2);
        ctx.strokeStyle = '#fb923c';
        ctx.lineWidth = 2.2;
        ctx.stroke();
      }
    }
    ctx.restore();
  }
}
