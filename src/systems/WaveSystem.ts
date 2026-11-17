import { ActiveEnemy, EnemyType, WaveDefinition, WaveSpawnGroup } from '../types';
import { EnemySystem } from './EnemySystem';
import { PathSystem } from './PathSystem';

interface PendingSpawn {
  enemyType: EnemyType;
  spawnAtSec: number;
  hpScale: number;
  bossWorldId?: number;
}

export class WaveSystem {
  private waves: WaveDefinition[];
  private currentWaveIndex: number = -1; // -1 means before wave 1 starts
  private waveElapsedSec: number = 0;
  private pendingSpawns: PendingSpawn[] = [];
  private waveActive: boolean = false;
  private isEndlessSurvival: boolean = false;

  constructor(waves: WaveDefinition[], isEndlessSurvival: boolean = false) {
    this.waves = [...waves];
    this.isEndlessSurvival = isEndlessSurvival;
  }

  public getCurrentWaveNumber(): number {
    return Math.max(1, this.currentWaveIndex + 1);
  }

  /**
   * Returns the active wave number if a wave is in progress, or the next upcoming wave number
   * when waiting between waves.
   */
  public getUpcomingOrActiveWaveNumber(): number {
    if (this.waveActive) {
      return this.currentWaveIndex + 1;
    }
    if (this.currentWaveIndex < 0) {
      return 1;
    }
    if (this.hasMoreWaves()) {
      return this.currentWaveIndex + 2;
    }
    return this.currentWaveIndex + 1;
  }

  public getCompletedWavesCount(): number {
    if (this.currentWaveIndex < 0) return 0;
    return this.waveActive ? this.currentWaveIndex : this.currentWaveIndex + 1;
  }

  public getTotalWaves(): number {
    return this.isEndlessSurvival ? 999 : this.waves.length;
  }

  public isWaveActive(): boolean {
    return this.waveActive;
  }

  public hasMoreWaves(): boolean {
    if (this.isEndlessSurvival) return true;
    return this.currentWaveIndex + 1 < this.waves.length;
  }

  public getPendingSpawnCount(): number {
    return this.pendingSpawns.length;
  }

  public startNextWave(): WaveDefinition | null {
    if (this.waveActive) return null;
    this.currentWaveIndex += 1;

    if (this.isEndlessSurvival && this.currentWaveIndex >= this.waves.length) {
      this.waves.push(WaveSystem.generateSurvivalWave(this.currentWaveIndex + 1));
    }

    const waveDef = this.waves[this.currentWaveIndex];
    if (!waveDef) return null;

    this.waveElapsedSec = 0;
    this.pendingSpawns = [];

    for (const group of waveDef.groups) {
      for (let i = 0; i < group.count; i++) {
        this.pendingSpawns.push({
          enemyType: group.enemyType,
          spawnAtSec: group.delayBeforeSec + i * group.intervalSec,
          hpScale: group.hpScale ?? 1.0,
          bossWorldId: group.bossWorldId,
        });
      }
    }

    this.pendingSpawns.sort((a, b) => a.spawnAtSec - b.spawnAtSec);
    this.waveActive = true;
    return waveDef;
  }

  public update(dtSec: number, path: PathSystem, activeEnemiesCount: number): {
    spawnedEnemies: ActiveEnemy[];
    waveJustCompleted: boolean;
    completedWaveDef?: WaveDefinition;
  } {
    if (!this.waveActive) {
      return { spawnedEnemies: [], waveJustCompleted: false };
    }

    this.waveElapsedSec += dtSec;
    const spawnedEnemies: ActiveEnemy[] = [];

    while (this.pendingSpawns.length > 0 && this.pendingSpawns[0].spawnAtSec <= this.waveElapsedSec) {
      const next = this.pendingSpawns.shift()!;
      const enemy = EnemySystem.createEnemy(next.enemyType, path, next.hpScale, 0, next.bossWorldId);
      spawnedEnemies.push(enemy);
    }

    if (this.pendingSpawns.length === 0 && activeEnemiesCount === 0 && spawnedEnemies.length === 0) {
      this.waveActive = false;
      const completedWaveDef = this.waves[this.currentWaveIndex];
      return {
        spawnedEnemies,
        waveJustCompleted: true,
        completedWaveDef,
      };
    }

    return {
      spawnedEnemies,
      waveJustCompleted: false,
    };
  }

  public static generateSurvivalWave(waveNumber: number): WaveDefinition {
    const isBoss = waveNumber % 5 === 0;
    const hpScale = 0.9 + Math.pow(waveNumber, 1.24) * 0.16;
    const pool: EnemyType[] = ['scout', 'swarm', 'tank', 'shield', 'ghost', 'splitter', 'regenerator'];
    const typeA = pool[waveNumber % pool.length];
    const typeB = pool[(waveNumber + 3) % pool.length];

    const groups: WaveSpawnGroup[] = [
      {
        enemyType: typeA,
        count: typeA === 'swarm' ? 10 + waveNumber * 2 : 5 + Math.floor(waveNumber * 1.4),
        intervalSec: typeA === 'swarm' ? 0.65 : 1.15,
        delayBeforeSec: 0.4,
        hpScale,
      },
      {
        enemyType: typeB,
        count: 4 + Math.floor(waveNumber * 1.1),
        intervalSec: 1.4,
        delayBeforeSec: 2.0,
        hpScale,
      },
    ];

    if (isBoss) {
      groups.push({
        enemyType: 'boss',
        count: 1,
        intervalSec: 4.0,
        delayBeforeSec: 3.5,
        hpScale: hpScale * 0.9,
        bossWorldId: ((waveNumber / 5 - 1) % 8) + 1,
      });
    }

    return {
      waveNumber,
      groups,
      bonusGold: 50 + waveNumber * 12,
      isBossWave: isBoss,
    };
  }
}
