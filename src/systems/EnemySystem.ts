import { ENEMIES_DATA, WORLD_BOSS_META } from '../data/enemiesData';
import { ActiveEnemy, EnemyType } from '../types';
import { PathSystem } from './PathSystem';

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

    // Multi-phase Boss mechanics
    if (enemy.isBoss) {
      const hpRatio = enemy.hp / enemy.maxHp;
      if (enemy.bossPhase === 1 && hpRatio <= 0.66) {
        enemy.bossPhase = 2;
        bossPhaseTriggered = 2;
        enemy.shield = Math.max(enemy.shield, Math.round(enemy.maxShield * 0.65));
        enemy.speed = enemy.baseSpeed * 1.15;
        // Spawn 2 escort scouts
        spawnedMinions.push(
          EnemySystem.createEnemy('scout', path, Math.max(1, enemy.maxHp / 800), Math.max(0, enemy.pathProgress - 22)),
          EnemySystem.createEnemy('scout', path, Math.max(1, enemy.maxHp / 800), Math.min(path.getTotalLength() - 15, enemy.pathProgress + 22))
        );
      } else if (enemy.bossPhase === 2 && hpRatio <= 0.33) {
        enemy.bossPhase = 3;
        bossPhaseTriggered = 3;
        enemy.shield = Math.max(enemy.shield, Math.round(enemy.maxShield * 0.8));
        enemy.speed = enemy.baseSpeed * 1.3;
        if (enemy.bossWorldId === 6) {
          enemy.isGhost = true;
          enemy.isRevealed = false;
        }
        spawnedMinions.push(
          EnemySystem.createEnemy('shield', path, Math.max(1, enemy.maxHp / 900), Math.max(0, enemy.pathProgress - 25))
        );
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
}
