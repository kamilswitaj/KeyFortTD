import { TOWERS_DATA } from '../data/towersData';
import {
  ActiveEnemy,
  ActiveHero,
  ActiveTower,
  TargetingPriority,
  TowerPad,
  TowerType,
  UpgradeBranch,
  UpgradeTierDefinition,
} from '../types';
import { HeroSystem } from './HeroSystem';
import { ResourceEconomy } from './ResourceEconomy';
import { TechModifiers, TechnologySystem } from './TechnologySystem';

export interface ComputedTowerStats {
  damage: number;
  fireRate: number;
  range: number;
  energyPerShot: number;
  splashRadius: number;
  chainCount: number;
  slowPercent: number;
  slowDuration: number;
  armorShredPercent: number;
  shieldDamageMultiplier: number;
  detectsGhosts: boolean;
  grantNearbyGhostDetection: boolean;
  ricochetCount: number;
  burnDps: number;
  burnDuration: number;
  clusterCount: number;
  stunDuration: number;
  brittleMultiplier: number;
  suppressSplitters: boolean;
  disableRegen: boolean;
  energyRefundOnHit: number;
  spotterDamageBonus: number;
  pierceCount: number;
  orbitalStrikeOnCombo: boolean;
  auraDamageBuff: number;
  maxEnergyBonus: number;
  passiveEnergyPerSec: number;
  goldPerWave: number;
  keystrokeEnergyMultiplier: number;
  wordCompletionShockwaveDamage: number;
}

export class TowerSystem {
  public static createTower(type: TowerType, pad: TowerPad, idSuffix: string = `${Date.now()}`): ActiveTower {
    const def = TOWERS_DATA[type];
    return {
      id: `tower_${pad.index}_${idSuffix}`,
      type,
      padIndex: pad.index,
      x: pad.x,
      y: pad.y,
      targeting: 'first',
      upgrades: {
        damage: 0,
        speed: 0,
        special: 0,
      },
      totalInvestedGold: def.cost,
      cooldownRemaining: 0,
      angle: 0,
      lastTargetId: null,
      consecutiveHitsOnTarget: 0,
      totalDamageDealt: 0,
      kills: 0,
      energyConsumed: 0,
      muzzleFlashTimer: 0,
    };
  }

  public static getNextUpgrade(tower: ActiveTower, branch: UpgradeBranch): UpgradeTierDefinition | null {
    const currentTier = tower.upgrades[branch];
    if (currentTier === 3) return null;
    const def = TOWERS_DATA[tower.type];
    return def.upgrades[branch][currentTier] ?? null;
  }

  public static upgradeTower(
    tower: ActiveTower,
    branch: UpgradeBranch,
    economy: ResourceEconomy,
    maxAllowedTier: number = 3
  ): boolean {
    const currentTier = tower.upgrades[branch];
    if (currentTier >= maxAllowedTier || currentTier >= 3) return false;
    const nextUpgrade = TowerSystem.getNextUpgrade(tower, branch);
    if (!nextUpgrade) return false;
    if (!economy.spendGold(nextUpgrade.cost)) return false;

    tower.upgrades[branch] = (currentTier + 1) as 1 | 2 | 3;
    tower.totalInvestedGold += nextUpgrade.cost;
    return true;
  }

  public static getSellValue(tower: ActiveTower): number {
    return Math.round(tower.totalInvestedGold * 0.75);
  }

  public static computeBaseAndUpgradeStats(tower: ActiveTower): ComputedTowerStats {
    const def = TOWERS_DATA[tower.type];
    const stats: ComputedTowerStats = {
      damage: def.damage,
      fireRate: def.fireRate,
      range: def.range,
      energyPerShot: def.energyPerShot,
      splashRadius: def.splashRadius,
      chainCount: def.chainCount,
      slowPercent: def.slowPercent,
      slowDuration: def.slowDuration,
      armorShredPercent: 0,
      shieldDamageMultiplier: 1.0,
      detectsGhosts: def.detectsGhostsBase,
      grantNearbyGhostDetection: false,
      ricochetCount: 0,
      burnDps: 0,
      burnDuration: 0,
      clusterCount: 0,
      stunDuration: 0,
      brittleMultiplier: 0,
      suppressSplitters: false,
      disableRegen: false,
      energyRefundOnHit: 0,
      spotterDamageBonus: 0,
      pierceCount: 0,
      orbitalStrikeOnCombo: false,
      auraDamageBuff: 0,
      maxEnergyBonus: 0,
      passiveEnergyPerSec: 0,
      goldPerWave: 0,
      keystrokeEnergyMultiplier: 0,
      wordCompletionShockwaveDamage: 0,
    };

    const branches: UpgradeBranch[] = ['damage', 'speed', 'special'];
    for (const branch of branches) {
      const tierCount = tower.upgrades[branch];
      for (let t = 0; t < tierCount; t++) {
        const upg = def.upgrades[branch][t];
        const eff = upg.effects;
        if (eff.damageMultiplier) stats.damage *= eff.damageMultiplier;
        if (eff.fireRateMultiplier) stats.fireRate *= eff.fireRateMultiplier;
        if (eff.rangeBonus) stats.range += eff.rangeBonus;
        if (eff.energyEfficiencyBonus) {
          stats.energyPerShot *= Math.max(0.15, 1 - eff.energyEfficiencyBonus);
        }
        if (eff.splashRadiusBonus) stats.splashRadius += eff.splashRadiusBonus;
        if (eff.slowPercentBonus) stats.slowPercent = Math.min(0.7, stats.slowPercent + eff.slowPercentBonus);
        if (eff.slowDurationBonus) stats.slowDuration += eff.slowDurationBonus;
        if (eff.chainCountBonus) stats.chainCount += eff.chainCountBonus;
        if (eff.armorShredPercent) stats.armorShredPercent = Math.max(stats.armorShredPercent, eff.armorShredPercent);
        if (eff.shieldDamageMultiplier) {
          stats.shieldDamageMultiplier = Math.max(stats.shieldDamageMultiplier, eff.shieldDamageMultiplier);
        }
        if (eff.detectGhosts) stats.detectsGhosts = true;
        if (eff.grantNearbyGhostDetection) stats.grantNearbyGhostDetection = true;
        if (eff.ricochetCount) stats.ricochetCount = Math.max(stats.ricochetCount, eff.ricochetCount);
        if (eff.burnDps) stats.burnDps = Math.max(stats.burnDps, eff.burnDps);
        if (eff.burnDuration) stats.burnDuration = Math.max(stats.burnDuration, eff.burnDuration);
        if (eff.clusterCount) stats.clusterCount = Math.max(stats.clusterCount, eff.clusterCount);
        if (eff.stunDuration) stats.stunDuration = Math.max(stats.stunDuration, eff.stunDuration);
        if (eff.brittleMultiplier) stats.brittleMultiplier = Math.max(stats.brittleMultiplier, eff.brittleMultiplier);
        if (eff.suppressSplitters) stats.suppressSplitters = true;
        if (eff.disableRegen) stats.disableRegen = true;
        if (eff.energyRefundOnHit) stats.energyRefundOnHit = Math.max(stats.energyRefundOnHit, eff.energyRefundOnHit);
        if (eff.spotterDamageBonus) stats.spotterDamageBonus = Math.max(stats.spotterDamageBonus, eff.spotterDamageBonus);
        if (eff.pierceCount) stats.pierceCount = Math.max(stats.pierceCount, eff.pierceCount);
        if (eff.orbitalStrikeOnCombo) stats.orbitalStrikeOnCombo = true;
        if (eff.auraDamageBuff) stats.auraDamageBuff += eff.auraDamageBuff;
        if (eff.maxEnergyBonus) stats.maxEnergyBonus += eff.maxEnergyBonus;
        if (eff.passiveEnergyPerSec) stats.passiveEnergyPerSec += eff.passiveEnergyPerSec;
        if (eff.goldPerWave) stats.goldPerWave += eff.goldPerWave;
        if (eff.keystrokeEnergyMultiplier) stats.keystrokeEnergyMultiplier += eff.keystrokeEnergyMultiplier;
        if (eff.wordCompletionShockwaveDamage) {
          stats.wordCompletionShockwaveDamage = Math.max(
            stats.wordCompletionShockwaveDamage,
            eff.wordCompletionShockwaveDamage
          );
        }
      }
    }

    stats.damage = Math.round(stats.damage);
    stats.fireRate = Number(stats.fireRate.toFixed(2));
    stats.energyPerShot = Number(stats.energyPerShot.toFixed(2));
    return stats;
  }

  /**
   * Computes effective stats including nearby tower aura buffs (Reactor / Tesla Quantum Conduit / Ghost Spotters).
   */
  public static computeEffectiveStats(
    tower: ActiveTower,
    allTowers: ActiveTower[],
    context?: { hero?: ActiveHero | null; techModifiers?: TechModifiers }
  ): ComputedTowerStats {
    const base = TowerSystem.computeBaseAndUpgradeStats(tower);
    let totalAuraDamageBonus = 0;
    let bestCommandAura = 0;
    let hasNearbyReactor = false;
    let hasNearbyCommand = false;

    for (const other of allTowers) {
      if (other.id === tower.id) continue;
      const otherStats = TowerSystem.computeBaseAndUpgradeStats(other);
      const dist = Math.hypot(other.x - tower.x, other.y - tower.y);
      if (dist <= otherStats.range + 15) {
        if (other.type === 'command') {
          hasNearbyCommand = true;
          const cmdAura = Math.max(0.15, otherStats.auraDamageBuff);
          bestCommandAura = Math.max(bestCommandAura, cmdAura);
        } else if (otherStats.auraDamageBuff > 0) {
          totalAuraDamageBonus += otherStats.auraDamageBuff;
        }
        if (other.type === 'reactor') {
          hasNearbyReactor = true;
        }
        if (otherStats.grantNearbyGhostDetection) {
          base.detectsGhosts = true;
        }
      }
    }

    // Command aura is non-stacking; total aura damage bonus is strictly capped at +85%
    const combinedAura = Math.min(0.85, totalAuraDamageBonus + bestCommandAura);
    if (combinedAura > 0) {
      base.damage = Math.round(base.damage * (1 + combinedAura));
    }

    // Technology modifiers (centralized, capped, disabled in standardized challenges)
    if (context?.techModifiers) {
      if (TechnologySystem.isKineticTower(tower.type) && context.techModifiers.kineticDamageMultiplier !== 1) {
        base.damage = Math.round(base.damage * context.techModifiers.kineticDamageMultiplier);
      }
      if (context.techModifiers.controlDurationMultiplier !== 1) {
        if (base.slowDuration > 0) {
          base.slowDuration = Number((base.slowDuration * context.techModifiers.controlDurationMultiplier).toFixed(2));
        }
        if (base.burnDuration > 0) {
          base.burnDuration = Number((base.burnDuration * context.techModifiers.controlDurationMultiplier).toFixed(2));
        }
      }
    }

    // Guardian Hero passive (+10%) & active Rally (+25%) fire-rate aura
    if (context?.hero) {
      const heroRateMult = HeroSystem.getGuardianAuraFireRateMultiplier(tower, context.hero);
      if (heroRateMult > 1) {
        base.fireRate = Number((base.fireRate * heroRateMult).toFixed(2));
      }
    }

    // Deterministic tower synergies
    if (tower.type === 'tesla' && hasNearbyReactor) {
      base.chainCount += 1;
      base.energyPerShot = Number((base.energyPerShot * 0.82).toFixed(2));
    }
    if (tower.type === 'drone' && hasNearbyCommand) {
      base.fireRate = Number((base.fireRate * 1.18).toFixed(2));
    }

    return base;
  }

  /**
   * Selects a target from `enemies` within range according to `tower.targeting`.
   */
  public static selectTarget(
    tower: ActiveTower,
    stats: ComputedTowerStats,
    enemies: ActiveEnemy[]
  ): ActiveEnemy | null {
    const candidates = enemies.filter((enemy) => {
      if (enemy.hp <= 0) return false;
      if (enemy.isFlying && (tower.type === 'cannon' || tower.type === 'flame')) {
        return false;
      }
      if (enemy.isGhost && !enemy.isRevealed && !stats.detectsGhosts) {
        return false;
      }
      const dist = Math.hypot(enemy.x - tower.x, enemy.y - tower.y);
      return dist <= stats.range + enemy.radius;
    });

    if (candidates.length === 0) return null;

    const priority: TargetingPriority = tower.targeting;
    candidates.sort((a, b) => {
      if (priority === 'first') {
        return b.pathProgress - a.pathProgress;
      }
      if (priority === 'last') {
        return a.pathProgress - b.pathProgress;
      }
      if (priority === 'strongest') {
        const scoreA = a.hp + a.shield * 1.2 + (a.isBoss ? 5000 : 0);
        const scoreB = b.hp + b.shield * 1.2 + (b.isBoss ? 5000 : 0);
        if (scoreB !== scoreA) return scoreB - scoreA;
        return b.pathProgress - a.pathProgress;
      }
      // nearest
      const distA = Math.hypot(a.x - tower.x, a.y - tower.y);
      const distB = Math.hypot(b.x - tower.x, b.y - tower.y);
      return distA - distB;
    });

    return candidates[0];
  }
}
