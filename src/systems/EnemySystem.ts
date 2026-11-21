import { ENEMIES_DATA, WORLD_BOSS_META } from '../data/enemiesData';
import { ActiveEnemy, EnemyType } from '../types';
import { PathSystem } from './PathSystem';

const BOSS_PHASE_CONFIGS: Record<
  number,
  {
    phase2Minions: EnemyType[];
    phase3Minions: EnemyType[];
    phase2ShieldRatio: number;
    phase3ShieldRatio: number;
    phase2SpeedMult: number;
    phase3SpeedMult: number;
    armorBonusPhase3?: number;
    spectralPhase3?: boolean;
    regenBoostPhase2?: number;
  }
> = {
  1: { phase2Minions: ['scout', 'scout'], phase3Minions: ['shield'], phase2ShieldRatio: 0.6, phase3ShieldRatio: 0.75, phase2SpeedMult: 1.12, phase3SpeedMult: 1.25 },
  2: { phase2Minions: ['ghost', 'scout'], phase3Minions: ['ghost', 'ghost'], phase2ShieldRatio: 0.55, phase3ShieldRatio: 0.7, phase2SpeedMult: 1.15, phase3SpeedMult: 1.25, regenBoostPhase2: 6 },
  3: { phase2Minions: ['evasive', 'scout'], phase3Minions: ['hover', 'shield'], phase2ShieldRatio: 0.65, phase3ShieldRatio: 0.85, phase2SpeedMult: 1.18, phase3SpeedMult: 1.38 },
  4: { phase2Minions: ['swarm', 'swarm', 'swarm'], phase3Minions: ['armored_elite', 'swarm'], phase2ShieldRatio: 0.55, phase3ShieldRatio: 0.75, phase2SpeedMult: 1.15, phase3SpeedMult: 1.32, armorBonusPhase3: 0.1 },
  5: { phase2Minions: ['shield', 'hover'], phase3Minions: ['armored_elite', 'shield'], phase2ShieldRatio: 0.8, phase3ShieldRatio: 0.95, phase2SpeedMult: 1.1, phase3SpeedMult: 1.22 },
  6: { phase2Minions: ['splitter', 'ghost'], phase3Minions: ['splitter', 'splitter'], phase2ShieldRatio: 0.6, phase3ShieldRatio: 0.8, phase2SpeedMult: 1.14, phase3SpeedMult: 1.28, spectralPhase3: true },
  7: { phase2Minions: ['support', 'armored_elite'], phase3Minions: ['support', 'tank'], phase2ShieldRatio: 0.65, phase3ShieldRatio: 0.85, phase2SpeedMult: 1.12, phase3SpeedMult: 1.26, armorBonusPhase3: 0.12 },
  8: { phase2Minions: ['armored_elite', 'hover', 'support'], phase3Minions: ['armored_elite', 'splitter', 'ghost'], phase2ShieldRatio: 0.75, phase3ShieldRatio: 0.95, phase2SpeedMult: 1.18, phase3SpeedMult: 1.35 },
};

export class EnemySystem {
  private static nextIdCounter = 1;

  public static createEnemy(
    type: EnemyType,
    path: PathSystem,
    hpScale: number = 1.0,
    startDistance: number = 0,
    bossWorldId?: number
  ): ActiveEnemy {
    const def = ENEMIES_DATA[type];
    const pos = path.getPositionAtDistance(startDistance);
    const id = `enemy_${type}_${EnemySystem.nextIdCounter++}`;

    let namePl = def.namePl;
    let nameEn = def.nameEn;
    let color = def.color;

    if (type === 'boss' && bossWorldId && WORLD_BOSS_META[bossWorldId]) {
      namePl = WORLD_BOSS_META[bossWorldId].namePl;
      nameEn = WORLD_BOSS_META[bossWorldId].nameEn;
      color = WORLD_BOSS_META[bossWorldId].color;
    }

    const maxHp = Math.max(10, Math.round(def.baseHp * hpScale));
    const maxShield = Math.round(def.baseShield * hpScale);
    const goldReward = Math.max(
      def.goldReward,
      Math.round(def.goldReward * (1 + Math.max(0, hpScale - 1) * 0.35))
    );

    return {
      id,
      type,
      namePl,
      nameEn,
      hp: maxHp,
      maxHp,
      shield: maxShield,
      maxShield,
      speed: def.speed,
      baseSpeed: def.speed,
      armor: def.armor,
      goldReward,
      baseDamage: def.baseDamage,
      radius: def.radius,
      color,
      isGhost: def.isGhost,
      isRevealed: false,
      regenPerSec: def.regenPerSec > 0 ? Math.round(def.regenPerSec * Math.sqrt(hpScale)) : 0,
      regenDisabledTimer: 0,
      splitCount: def.splitCount,
      splitterSuppressed: false,
      isBoss: def.isBoss,
      bossPhase: 1,
      bossAbilityCooldown: 6.0,
      bossWorldId,
      pathProgress: startDistance,
      waypointIndex: pos.waypointIndex,
      x: pos.x,
      y: pos.y,
      slowFactor: 0,
      slowTimer: 0,
      stunTimer: 0,
      burnDps: 0,
      burnTimer: 0,
      brittleBonus: 0,
      brittleTimer: 0,
      spotterBonus: 0,
      spotterTimer: 0,
      isFlying: Boolean(def.isFlying),
      hitFlashTimer: 0,
      thermalShockCooldown: 0,
      evadeTimer: 0,
    };
  }

  public static createSplitterMiniCore(parent: ActiveEnemy, path: PathSystem, offsetDist: number): ActiveEnemy {
    const mini = EnemySystem.createEnemy('scout', path, 0.55, Math.max(0, parent.pathProgress + offsetDist));
    mini.namePl = 'Mini-Rdzeń';
    mini.nameEn = 'Mini-Core';
    mini.maxHp = Math.max(20, Math.round(parent.maxHp * 0.28));
    mini.hp = mini.maxHp;
    mini.goldReward = 6;
    mini.radius = 9;
    mini.color = '#fdba74';
    return mini;
  }

  /**
   * Updates enemy status timers, regeneration, burn damage, boss phase transitions, and movement.
   */
  public static updateEnemy(
    enemy: ActiveEnemy,
    dtSec: number,
    path: PathSystem
  ): { reachedBase: boolean; spawnedMinions: ActiveEnemy[]; bossPhaseTriggered: number | null } {
    const spawnedMinions: ActiveEnemy[] = [];
    let bossPhaseTriggered: number | null = null;

    if (enemy.hp <= 0) {
      return { reachedBase: false, spawnedMinions, bossPhaseTriggered };
    }

    // Burn DoT
    if (enemy.burnTimer > 0) {
      enemy.burnTimer = Math.max(0, enemy.burnTimer - dtSec);
      enemy.hp -= enemy.burnDps * dtSec;
      if (enemy.burnTimer === 0) {
        enemy.burnDps = 0;
      }
    }

    if (enemy.hp <= 0) {
      return { reachedBase: false, spawnedMinions, bossPhaseTriggered };
    }

    // Regen timer & healing
    if (enemy.regenDisabledTimer > 0) {
      enemy.regenDisabledTimer = Math.max(0, enemy.regenDisabledTimer - dtSec);
    } else if (enemy.regenPerSec > 0 && enemy.burnTimer <= 0 && enemy.hp < enemy.maxHp) {
      enemy.hp = Math.min(enemy.maxHp, enemy.hp + enemy.regenPerSec * dtSec);
    }

    // Debuff timers
    if (enemy.slowTimer > 0) {
      enemy.slowTimer = Math.max(0, enemy.slowTimer - dtSec);
      if (enemy.slowTimer === 0) enemy.slowFactor = 0;
    }
    if (enemy.stunTimer > 0) {
      enemy.stunTimer = Math.max(0, enemy.stunTimer - dtSec);
    }
    if (enemy.brittleTimer > 0) {
      enemy.brittleTimer = Math.max(0, enemy.brittleTimer - dtSec);
      if (enemy.brittleTimer === 0) enemy.brittleBonus = 0;
    }
    if (enemy.spotterTimer > 0) {
      enemy.spotterTimer = Math.max(0, enemy.spotterTimer - dtSec);
      if (enemy.spotterTimer === 0) enemy.spotterBonus = 0;
    }
    if (enemy.hitFlashTimer && enemy.hitFlashTimer > 0) {
      enemy.hitFlashTimer = Math.max(0, enemy.hitFlashTimer - dtSec);
    }
    if (enemy.thermalShockCooldown && enemy.thermalShockCooldown > 0) {
      enemy.thermalShockCooldown = Math.max(0, enemy.thermalShockCooldown - dtSec);
    }

    // Multi-phase data-driven Boss mechanics
    if (enemy.isBoss) {
      const cfg = BOSS_PHASE_CONFIGS[enemy.bossWorldId ?? 1] ?? BOSS_PHASE_CONFIGS[1];
      const hpRatio = enemy.hp / enemy.maxHp;
      if (enemy.bossPhase === 1 && hpRatio <= 0.66) {
        enemy.bossPhase = 2;
        bossPhaseTriggered = 2;
        enemy.shield = Math.max(enemy.shield, Math.round(enemy.maxShield * cfg.phase2ShieldRatio));
        enemy.speed = enemy.baseSpeed * cfg.phase2SpeedMult;
        if (cfg.regenBoostPhase2) {
          enemy.regenPerSec += cfg.regenBoostPhase2;
        }
        cfg.phase2Minions.forEach((mType, idx) => {
          const offset = (idx - 0.5) * 24;
          const dist = Math.max(0, Math.min(path.getTotalLength() - 15, enemy.pathProgress + offset));
          spawnedMinions.push(EnemySystem.createEnemy(mType, path, Math.max(1, enemy.maxHp / 850), dist));
        });
      } else if (enemy.bossPhase === 2 && hpRatio <= 0.33) {
        enemy.bossPhase = 3;
        bossPhaseTriggered = 3;
        enemy.shield = Math.max(enemy.shield, Math.round(enemy.maxShield * cfg.phase3ShieldRatio));
        enemy.speed = enemy.baseSpeed * cfg.phase3SpeedMult;
        if (cfg.armorBonusPhase3) {
          enemy.armor = Math.min(0.75, enemy.armor + cfg.armorBonusPhase3);
        }
        if (cfg.spectralPhase3) {
          enemy.isGhost = true;
          enemy.isRevealed = false;
        }
        cfg.phase3Minions.forEach((mType, idx) => {
          const offset = (idx - 0.5) * 26;
          const dist = Math.max(0, Math.min(path.getTotalLength() - 15, enemy.pathProgress + offset));
          spawnedMinions.push(EnemySystem.createEnemy(mType, path, Math.max(1, enemy.maxHp / 900), dist));
        });
      }
    }

    // Movement
    let effectiveSpeed = enemy.speed * (1 - enemy.slowFactor);
    if (enemy.stunTimer > 0) {
      effectiveSpeed = 0;
    }

    enemy.pathProgress += effectiveSpeed * dtSec;
    const pos = path.getPositionAtDistance(enemy.pathProgress);
    enemy.x = pos.x;
    enemy.y = pos.y;
    enemy.waypointIndex = pos.waypointIndex;

    return {
      reachedBase: pos.reachedEnd,
      spawnedMinions,
      bossPhaseTriggered,
    };
  }

  /**
   * Applies non-stacking, capped healing aura from active Field Catalyst (`support`) enemies.
   * Never resurrects dead enemies and stops when stunned or regen-disabled.
   */
  public static applySupportAuras(enemies: ActiveEnemy[], dtSec: number): void {
    const auraRadius = 95;
    const healPerSec = 9;
    const healedIds = new Set<string>();

    for (const sup of enemies) {
      if (sup.type !== 'support' || sup.hp <= 0 || sup.stunTimer > 0 || sup.regenDisabledTimer > 0) {
        continue;
      }
      for (const ally of enemies) {
        if (ally.id === sup.id || ally.hp <= 0 || ally.hp >= ally.maxHp || healedIds.has(ally.id)) {
          continue;
        }
        if (ally.regenDisabledTimer > 0) continue;
        if (Math.hypot(ally.x - sup.x, ally.y - sup.y) <= auraRadius) {
          ally.hp = Math.min(ally.maxHp, ally.hp + healPerSec * dtSec);
          healedIds.add(ally.id);
        }
      }
    }
  }
}
