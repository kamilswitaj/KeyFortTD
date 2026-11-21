import { TOWERS_DATA } from '../data/towersData';
import {
  ActiveEnemy,
  ActiveHero,
  ActiveTower,
  FloatingTextEffect,
  Point2D,
  ProjectileEffect,
} from '../types';
import { EnemySystem } from './EnemySystem';
import { PathSystem } from './PathSystem';
import { ResourceEconomy } from './ResourceEconomy';
import { TechModifiers } from './TechnologySystem';
import { ComputedTowerStats, TowerSystem } from './TowerSystem';

export interface CombatTickEvents {
  projectilesCreated: ProjectileEffect[];
  floatingTextsCreated: FloatingTextEffect[];
  enemiesKilled: ActiveEnemy[];
  bossesKilled: number;
  shotsFiredByType: Record<string, number>;
}

export class CombatSystem {
  private static effectIdCounter = 1;

  /**
   * Applies damage and debuffs to a single enemy, handling shields, armor, brittle, and spotter modifiers.
   */
  public static applyHitToEnemy(
    enemy: ActiveEnemy,
    rawDamage: number,
    stats: Partial<ComputedTowerStats>,
    sourceTower?: ActiveTower,
    events?: CombatTickEvents
  ): number {
    if (enemy.hp <= 0) return 0;

    // Evasive units dodge every 4th single-target kinetic/projectile hit unless slowed or stunned
    const isDodgeable =
      sourceTower &&
      (sourceTower.type === 'gun' ||
        sourceTower.type === 'sniper' ||
        sourceTower.type === 'drone' ||
        sourceTower.type === 'command');
    if (enemy.type === 'evasive' && isDodgeable && enemy.slowTimer <= 0 && enemy.stunTimer <= 0) {
      enemy.evadeTimer = (enemy.evadeTimer ?? 0) + 1;
      if (enemy.evadeTimer % 4 === 0) {
        events?.floatingTextsCreated.push({
          id: `dodge_${CombatSystem.effectIdCounter++}`,
          x: enemy.x,
          y: enemy.y - 12,
          text: 'UNIK!',
          color: '#e879f9',
          life: 0.55,
          maxLife: 0.55,
        });
        return 0;
      }
    }

    if (stats.detectsGhosts && enemy.isGhost) {
      enemy.isRevealed = true;
    }

    const bonusMultiplier = 1 + enemy.brittleBonus + enemy.spotterBonus;
    let remainingDamage = rawDamage * bonusMultiplier;
    let totalApplied = 0;

    // 1. Shield absorption
    if (enemy.shield > 0) {
      const shieldMult = stats.shieldDamageMultiplier ?? 1.0;
      const effectiveShieldDmg = remainingDamage * shieldMult;
      if (effectiveShieldDmg <= enemy.shield) {
        enemy.shield -= effectiveShieldDmg;
        totalApplied += effectiveShieldDmg;
        remainingDamage = 0;
      } else {
        const usedFraction = enemy.shield / effectiveShieldDmg;
        totalApplied += enemy.shield;
        enemy.shield = 0;
        remainingDamage = remainingDamage * (1 - usedFraction);
      }
    }

    // 2. Hull damage mitigated by armor (reduced by armorShredPercent)
    if (remainingDamage > 0) {
      const shred = Math.min(1, stats.armorShredPercent ?? 0);
      const effectiveArmor = enemy.armor * (1 - shred);
      const hullDamage = Math.max(1, remainingDamage * (1 - effectiveArmor));
      enemy.hp -= hullDamage;
      totalApplied += hullDamage;
    }

    // 3. Apply status effects
    if (stats.slowPercent && stats.slowPercent > 0) {
      const resist = enemy.isBoss ? 0.5 : 1.0;
      const appliedSlow = stats.slowPercent * resist;
      if (appliedSlow >= enemy.slowFactor) {
        enemy.slowFactor = appliedSlow;
      }
      enemy.slowTimer = Math.max(enemy.slowTimer, stats.slowDuration ?? 2.5);
    }

    if (stats.stunDuration && stats.stunDuration > 0) {
      const stun = enemy.isBoss ? stats.stunDuration * 0.45 : stats.stunDuration;
      enemy.stunTimer = Math.max(enemy.stunTimer, stun);
    }

    if (stats.burnDps && stats.burnDps > 0) {
      enemy.burnDps = Math.max(enemy.burnDps, stats.burnDps);
      enemy.burnTimer = Math.max(enemy.burnTimer, stats.burnDuration ?? 3.0);
    }

    if (stats.brittleMultiplier && stats.brittleMultiplier > 0) {
      enemy.brittleBonus = Math.max(enemy.brittleBonus, stats.brittleMultiplier);
      enemy.brittleTimer = Math.max(enemy.brittleTimer, 4.0);
    }

    if (stats.spotterDamageBonus && stats.spotterDamageBonus > 0) {
      enemy.spotterBonus = Math.max(enemy.spotterBonus, stats.spotterDamageBonus);
      enemy.spotterTimer = Math.max(enemy.spotterTimer, 5.0);
    }

    if (stats.suppressSplitters) {
      enemy.splitterSuppressed = true;
    }

    if (stats.disableRegen) {
      enemy.regenDisabledTimer = Math.max(enemy.regenDisabledTimer, 5.0);
    }

    enemy.hitFlashTimer = 0.12;

    const rounded = Math.round(totalApplied);
    if (sourceTower) {
      sourceTower.totalDamageDealt += rounded;
      if (enemy.hp <= 0) {
        sourceTower.kills += 1;
      }
    }

    return rounded;
  }

  /**
   * Executes one simulation step for all towers against active enemies.
   */
  public static updateTowers(
    dtSec: number,
    towers: ActiveTower[],
    enemies: ActiveEnemy[],
    economy: ResourceEconomy,
    currentCombo: number,
    context?: { hero?: ActiveHero | null; techModifiers?: TechModifiers }
  ): CombatTickEvents {
    const events: CombatTickEvents = {
      projectilesCreated: [],
      floatingTextsCreated: [],
      enemiesKilled: [],
      bossesKilled: 0,
      shotsFiredByType: {},
    };

    const efficiency = economy.getEfficiencyMultiplier(currentCombo);

    for (const tower of towers) {
      if (tower.muzzleFlashTimer > 0) {
        tower.muzzleFlashTimer = Math.max(0, tower.muzzleFlashTimer - dtSec);
      }

      if (tower.type === 'reactor') {
        continue;
      }

      const stats = TowerSystem.computeEffectiveStats(tower, towers, context);

      if (tower.cooldownRemaining > 0) {
        tower.cooldownRemaining = Math.max(0, tower.cooldownRemaining - dtSec * efficiency);
      }

      if (tower.cooldownRemaining > 0) continue;

      const target = TowerSystem.selectTarget(tower, stats, enemies);
      if (!target) continue;

      // Rotate barrel toward target
      tower.angle = Math.atan2(target.y - tower.y, target.x - tower.x);

      // Consume energy if available; if energy is 0, tower still fires at baseline efficiency!
      const hadEnergy = economy.drainTowerShotEnergy(stats.energyPerShot);
      if (hadEnergy) {
        tower.energyConsumed = Number(((tower.energyConsumed ?? 0) + stats.energyPerShot).toFixed(2));
      }
      const shotDamageMultiplier = hadEnergy
        ? efficiency >= 1.3
          ? 1.22
          : 1.0
        : 0.65;

      const effectiveDamage = Math.max(1, Math.round(stats.damage * shotDamageMultiplier));
      tower.cooldownRemaining = 1 / Math.max(0.15, stats.fireRate);
      tower.muzzleFlashTimer = 0.14;
      events.shotsFiredByType[tower.type] = (events.shotsFiredByType[tower.type] ?? 0) + 1;

      if (stats.energyRefundOnHit > 0) {
        economy.addEnergy(stats.energyRefundOnHit);
      }

      const def = TOWERS_DATA[tower.type];

      if (tower.type === 'frost') {
        // AoE Frost Pulse around the tower
        for (const enemy of enemies) {
          if (enemy.hp <= 0) continue;
          if (enemy.isGhost && !enemy.isRevealed && !stats.detectsGhosts) continue;
          const dist = Math.hypot(enemy.x - tower.x, enemy.y - tower.y);
          if (dist <= stats.range + enemy.radius) {
            CombatSystem.applyHitToEnemy(enemy, effectiveDamage, stats, tower);
            if (enemy.burnTimer > 0 && (enemy.thermalShockCooldown ?? 0) <= 0) {
              enemy.thermalShockCooldown = 2.5;
              CombatSystem.applyHitToEnemy(enemy, 35, { armorShredPercent: 0.5 }, tower);
              events.floatingTextsCreated.push({
                id: `ft_${CombatSystem.effectIdCounter++}`,
                x: enemy.x,
                y: enemy.y - 16,
                text: 'THERMAL!',
                color: '#fb923c',
                life: 0.65,
                maxLife: 0.65,
              });
            }
          }
        }
        events.projectilesCreated.push({
          id: `proj_${CombatSystem.effectIdCounter++}`,
          kind: 'frost_pulse',
          fromX: tower.x,
          fromY: tower.y,
          toX: tower.x,
          toY: tower.y,
          color: def.color,
          radius: stats.range,
          progress: 0,
          duration: 0.32,
        });
      } else if (tower.type === 'cannon') {
        // Splash explosion around target (+ Shatter Blast synergy vs slowed enemies)
        for (const enemy of enemies) {
          if (enemy.hp <= 0 || enemy.isFlying) continue;
          if (enemy.isGhost && !enemy.isRevealed && !stats.detectsGhosts) continue;
          const dist = Math.hypot(enemy.x - target.x, enemy.y - target.y);
          if (dist <= stats.splashRadius + enemy.radius) {
            const falloff = dist <= 18 ? 1.0 : 0.8;
            const shatterMult = enemy.slowTimer > 0 ? 1.25 : 1.0;
            CombatSystem.applyHitToEnemy(
              enemy,
              Math.round(effectiveDamage * falloff * shatterMult),
              stats,
              tower
            );
          }
        }
        events.projectilesCreated.push({
          id: `proj_${CombatSystem.effectIdCounter++}`,
          kind: 'shell',
          fromX: tower.x,
          fromY: tower.y,
          toX: target.x,
          toY: target.y,
          color: def.color,
          radius: stats.splashRadius,
          progress: 0,
          duration: 0.25,
        });
      } else if (tower.type === 'flame') {
        // Continuous fire cone/splash around target; applies base burn + stops regen + Thermal Shock
        const flameStats = {
          ...stats,
          burnDps: Math.max(10, stats.burnDps),
          burnDuration: Math.max(2.5, stats.burnDuration),
          disableRegen: true,
        };
        for (const enemy of enemies) {
          if (enemy.hp <= 0 || enemy.isFlying) continue;
          if (enemy.isGhost && !enemy.isRevealed && !stats.detectsGhosts) continue;
          const dist = Math.hypot(enemy.x - target.x, enemy.y - target.y);
          if (dist <= stats.splashRadius + enemy.radius) {
            CombatSystem.applyHitToEnemy(enemy, effectiveDamage, flameStats, tower);
            if (enemy.slowTimer > 0 && (enemy.thermalShockCooldown ?? 0) <= 0) {
              enemy.thermalShockCooldown = 2.5;
              CombatSystem.applyHitToEnemy(enemy, 35, { armorShredPercent: 0.5 }, tower);
              events.floatingTextsCreated.push({
                id: `ft_${CombatSystem.effectIdCounter++}`,
                x: enemy.x,
                y: enemy.y - 16,
                text: 'THERMAL!',
                color: '#67e8f9',
                life: 0.65,
                maxLife: 0.65,
              });
            }
          }
        }
        events.projectilesCreated.push({
          id: `proj_${CombatSystem.effectIdCounter++}`,
          kind: 'flame',
          fromX: tower.x,
          fromY: tower.y,
          toX: target.x,
          toY: target.y,
          color: def.color,
          radius: stats.splashRadius,
          progress: 0,
          duration: 0.18,
        });
      } else if (tower.type === 'drone') {
        // Long-range drone strikes (primary + optional chainCount bonus target)
        const targetsHit: ActiveEnemy[] = [target];
        if (stats.chainCount > 1) {
          for (const candidate of enemies) {
            if (targetsHit.length >= stats.chainCount) break;
            if (candidate.id === target.id || candidate.hp <= 0) continue;
            if (candidate.isGhost && !candidate.isRevealed && !stats.detectsGhosts) continue;
            if (Math.hypot(candidate.x - tower.x, candidate.y - tower.y) <= stats.range + candidate.radius) {
              targetsHit.push(candidate);
            }
          }
        }
        for (const tHit of targetsHit) {
          CombatSystem.applyHitToEnemy(tHit, effectiveDamage, stats, tower, events);
          if (stats.splashRadius > 0) {
            for (const extra of enemies) {
              if (extra.id === tHit.id || extra.hp <= 0) continue;
              if (Math.hypot(extra.x - tHit.x, extra.y - tHit.y) <= stats.splashRadius) {
                CombatSystem.applyHitToEnemy(extra, Math.round(effectiveDamage * 0.65), stats, tower);
              }
            }
          }
          events.projectilesCreated.push({
            id: `proj_${CombatSystem.effectIdCounter++}`,
            kind: 'drone_bolt',
            fromX: tower.x,
            fromY: tower.y,
            toX: tHit.x,
            toY: tHit.y,
            color: def.color,
            progress: 0,
            duration: 0.2,
          });
        }
      } else if (tower.type === 'laser') {
        // Focusing beam: ramps +18% per consecutive hit on the same target (capped at +110%)
        if (tower.lastTargetId === target.id) {
          tower.consecutiveHitsOnTarget = Math.min(6, tower.consecutiveHitsOnTarget + 1);
        } else {
          tower.lastTargetId = target.id;
          tower.consecutiveHitsOnTarget = 0;
        }
        const rampMult = 1 + tower.consecutiveHitsOnTarget * 0.18;
        const beamDmg = Math.round(effectiveDamage * rampMult);
        CombatSystem.applyHitToEnemy(target, beamDmg, stats, tower);
        if (stats.chainCount > 1) {
          for (const candidate of enemies) {
            if (candidate.id === target.id || candidate.hp <= 0) continue;
            if (Math.hypot(candidate.x - target.x, candidate.y - target.y) <= 95) {
              CombatSystem.applyHitToEnemy(candidate, Math.round(beamDmg * 0.6), stats, tower);
              break;
            }
          }
        }
        events.projectilesCreated.push({
          id: `proj_${CombatSystem.effectIdCounter++}`,
          kind: 'laser_beam',
          fromX: tower.x,
          fromY: tower.y,
          toX: target.x,
          toY: target.y,
          color: def.color,
          progress: 0,
          duration: 0.16,
        });
      } else if (tower.type === 'command') {
        // Marks target with spotter vulnerability + fires tactical bolt
        const cmdStats = {
          ...stats,
          spotterDamageBonus: Math.max(0.2, stats.spotterDamageBonus),
        };
        CombatSystem.applyHitToEnemy(target, effectiveDamage, cmdStats, tower, events);
        events.projectilesCreated.push({
          id: `proj_${CombatSystem.effectIdCounter++}`,
          kind: 'bullet',
          fromX: tower.x,
          fromY: tower.y,
          toX: target.x,
          toY: target.y,
          color: def.color,
          progress: 0,
          duration: 0.16,
        });
      } else if (tower.type === 'tesla') {
        // Chain lightning across up to stats.chainCount targets
        const hitIds = new Set<string>([target.id]);
        const chainPoints: Point2D[] = [
          { x: tower.x, y: tower.y },
          { x: target.x, y: target.y },
        ];
        CombatSystem.applyHitToEnemy(target, effectiveDamage, stats, tower);

        let lastPos: Point2D = { x: target.x, y: target.y };
        for (let c = 1; c < stats.chainCount; c++) {
          let bestNext: ActiveEnemy | null = null;
          let bestDist = 135;
          for (const candidate of enemies) {
            if (candidate.hp <= 0 || hitIds.has(candidate.id)) continue;
            if (candidate.isGhost && !candidate.isRevealed && !stats.detectsGhosts) continue;
            const d = Math.hypot(candidate.x - lastPos.x, candidate.y - lastPos.y);
            if (d <= bestDist) {
              bestDist = d;
              bestNext = candidate;
            }
          }
          if (!bestNext) break;
          hitIds.add(bestNext.id);
          chainPoints.push({ x: bestNext.x, y: bestNext.y });
          CombatSystem.applyHitToEnemy(bestNext, Math.round(effectiveDamage * 0.82), stats, tower);
          lastPos = { x: bestNext.x, y: bestNext.y };
        }

        events.projectilesCreated.push({
          id: `proj_${CombatSystem.effectIdCounter++}`,
          kind: 'lightning',
          fromX: tower.x,
          fromY: tower.y,
          toX: target.x,
          toY: target.y,
          chainPoints,
          color: def.color,
          progress: 0,
          duration: 0.22,
        });
      } else if (tower.type === 'sniper') {
        const dmgApplied = CombatSystem.applyHitToEnemy(target, effectiveDamage, stats, tower, events);
        if (dmgApplied >= 85) {
          events.floatingTextsCreated.push({
            id: `ft_${CombatSystem.effectIdCounter++}`,
            x: target.x,
            y: target.y - 14,
            text: `-${dmgApplied}!`,
            color: '#34d399',
            life: 0.65,
            maxLife: 0.65,
          });
        }
        // Pierce nearby enemies if upgraded
        if (stats.pierceCount > 0) {
          let pierced = 0;
          for (const other of enemies) {
            if (other.id === target.id || other.hp <= 0) continue;
            const d = Math.hypot(other.x - target.x, other.y - target.y);
            if (d <= 65) {
              CombatSystem.applyHitToEnemy(other, Math.round(effectiveDamage * 0.75), stats, tower);
              pierced++;
              if (pierced >= stats.pierceCount) break;
            }
          }
        }
        events.projectilesCreated.push({
          id: `proj_${CombatSystem.effectIdCounter++}`,
          kind: 'sniper_beam',
          fromX: tower.x,
          fromY: tower.y,
          toX: target.x,
          toY: target.y,
          color: def.color,
          progress: 0,
          duration: 0.22,
        });
      } else {
        // Gun tower (+ optional ricochets)
        CombatSystem.applyHitToEnemy(target, effectiveDamage, stats, tower, events);
        if (stats.ricochetCount > 0) {
          let bounced = 0;
          for (const other of enemies) {
            if (other.id === target.id || other.hp <= 0) continue;
            if (other.isGhost && !other.isRevealed && !stats.detectsGhosts) continue;
            const d = Math.hypot(other.x - target.x, other.y - target.y);
            if (d <= 85) {
              CombatSystem.applyHitToEnemy(other, Math.round(effectiveDamage * 0.7), stats, tower);
              bounced++;
              if (bounced >= stats.ricochetCount) break;
            }
          }
        }
        events.projectilesCreated.push({
          id: `proj_${CombatSystem.effectIdCounter++}`,
          kind: 'bullet',
          fromX: tower.x,
          fromY: tower.y,
          toX: target.x,
          toY: target.y,
          color: def.color,
          progress: 0,
          duration: 0.14,
        });
      }
    }

    return events;
  }

  /**
   * Resolves defeated enemies, awards gold, and spawns Splitter fragments when applicable.
   */
  public static resolveDefeatedEnemies(
    enemies: ActiveEnemy[],
    path: PathSystem,
    economy: ResourceEconomy
  ): {
    survivingEnemies: ActiveEnemy[];
    defeatedEnemies: ActiveEnemy[];
    bossesDefeated: number;
  } {
    const surviving: ActiveEnemy[] = [];
    const defeated: ActiveEnemy[] = [];
    let bossesDefeated = 0;

    for (const enemy of enemies) {
      if (enemy.hp > 0) {
        surviving.push(enemy);
      } else {
        defeated.push(enemy);
        economy.addGold(enemy.goldReward);
        if (enemy.isBoss) {
          bossesDefeated += 1;
        }
        if (enemy.splitCount > 0 && !enemy.splitterSuppressed) {
          surviving.push(
            EnemySystem.createSplitterMiniCore(enemy, path, -12),
            EnemySystem.createSplitterMiniCore(enemy, path, 12)
          );
        }
      }
    }

    return {
      survivingEnemies: surviving,
      defeatedEnemies: defeated,
      bossesDefeated,
    };
  }

  /**
   * Triggered when the player finishes typing a full sequence/word in the console.
   * Activates Reactor Discharge Shockwaves and Sniper Orbital Laser Designators!
   */
  public static triggerSequenceCompletionEffects(
    towers: ActiveTower[],
    enemies: ActiveEnemy[]
  ): ProjectileEffect[] {
    const effects: ProjectileEffect[] = [];
    if (enemies.length === 0) return effects;

    for (const tower of towers) {
      const stats = TowerSystem.computeBaseAndUpgradeStats(tower);
      if (stats.wordCompletionShockwaveDamage > 0) {
        for (const enemy of enemies) {
          if (enemy.hp <= 0) continue;
          const dist = Math.hypot(enemy.x - tower.x, enemy.y - tower.y);
          if (stats.wordCompletionShockwaveDamage >= 100 || dist <= stats.range + 90) {
            CombatSystem.applyHitToEnemy(enemy, stats.wordCompletionShockwaveDamage, stats, tower);
          }
        }
        effects.push({
          id: `proj_${CombatSystem.effectIdCounter++}`,
          kind: 'shockwave',
          fromX: tower.x,
          fromY: tower.y,
          toX: tower.x,
          toY: tower.y,
          color: '#facc15',
          radius: stats.range + 80,
          progress: 0,
          duration: 0.45,
        });
      }

      if (stats.orbitalStrikeOnCombo) {
        // Strike strongest alive enemy
        const sorted = [...enemies].filter((e) => e.hp > 0).sort((a, b) => b.hp + b.shield - (a.hp + a.shield));
        const strongest = sorted[0];
        if (strongest) {
          CombatSystem.applyHitToEnemy(strongest, Math.round(stats.damage * 1.45), stats, tower);
          effects.push({
            id: `proj_${CombatSystem.effectIdCounter++}`,
            kind: 'orbital',
            fromX: strongest.x,
            fromY: 0,
            toX: strongest.x,
            toY: strongest.y,
            color: '#10b981',
            radius: 42,
            progress: 0,
            duration: 0.4,
          });
        }
      }
    }

    return effects;
  }
}
