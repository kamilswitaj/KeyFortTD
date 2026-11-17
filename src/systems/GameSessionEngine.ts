import { MAPS_DATA } from '../data/mapsData';
import { TOWERS_DATA } from '../data/towersData';
import {
  ActiveEnemy,
  ActiveTower,
  EnemyType,
  FloatingTextEffect,
  GameMode,
  MapDefinition,
  MissionDefinition,
  PlayerProfile,
  ProjectileEffect,
  TargetingPriority,
  TowerType,
  UpgradeBranch,
} from '../types';
import { AdaptiveLearningEngine } from './AdaptiveLearningEngine';
import { CombatSystem } from './CombatSystem';
import { EnemySystem } from './EnemySystem';
import { PathSystem } from './PathSystem';
import { PowerState, ResourceEconomy } from './ResourceEconomy';
import { TowerSystem } from './TowerSystem';
import { KeystrokeResult, TypingEngine } from './TypingEngine';
import { WaveSystem } from './WaveSystem';

export interface GameSessionConfig {
  mode: GameMode;
  mission: MissionDefinition;
  profile: PlayerProfile;
  unlimitedGold?: boolean;
  unlimitedEnergy?: boolean;
  initialGameSpeed?: number;
}

export class GameSessionEngine {
  public readonly mode: GameMode;
  public readonly mission: MissionDefinition;
  public readonly map: MapDefinition;
  public readonly path: PathSystem;
  public readonly economy: ResourceEconomy;
  public readonly waveSystem: WaveSystem;
  public readonly typingEngine: TypingEngine;

  private profile: PlayerProfile;
  private towers: ActiveTower[] = [];
  private enemies: ActiveEnemy[] = [];
  private projectiles: ProjectileEffect[] = [];
  private floatingTexts: FloatingTextEffect[] = [];
  private lives: number;
  private maxLives: number;
  private score: number = 0;
  private isPaused: boolean = false;
  private gameSpeed: number = 1;
  private sessionOver: boolean = false;
  private victory: boolean = false;
  private allWavesCleared: boolean = false;
  private selectedPadIndex: number | null = null;
  private selectedTowerId: string | null = null;
  private bossAlertMessage: string | null = null;
  private bossAlertTimer: number = 0;

  constructor(config: GameSessionConfig) {
    this.mode = config.mode;
    this.mission = config.mission;
    this.profile = config.profile;
    this.map = MAPS_DATA[config.mission.mapId] ?? MAPS_DATA.green_valley_1;
    this.path = new PathSystem(this.map.waypoints);

    this.lives = config.mission.startingLives;
    this.maxLives = config.mission.startingLives;

    this.economy = new ResourceEconomy(config.mission.startingGold, 50);
    if (config.unlimitedGold || config.unlimitedEnergy) {
      this.economy.setUnlimitedResources(Boolean(config.unlimitedGold), Boolean(config.unlimitedEnergy));
    }

    this.waveSystem = new WaveSystem(config.mission.waves, config.mode === 'survival');
    this.gameSpeed = config.initialGameSpeed ?? config.profile.settings.defaultGameSpeed ?? 1;

    const initialPrompts = AdaptiveLearningEngine.generateExerciseBatch(
      this.mission,
      this.profile.characterMastery,
      this.profile.settings.language,
      16,
      `${this.mission.id}_${Date.now()}`
    );
    this.typingEngine = new TypingEngine(initialPrompts);
  }

  public getLives(): number {
    return this.lives;
  }

  public getMaxLives(): number {
    return this.maxLives;
  }

  public getScore(): number {
    return this.score;
  }

  public getTowers(): ActiveTower[] {
    return this.towers;
  }

  public getEnemies(): ActiveEnemy[] {
    return this.enemies;
  }

  public getProjectiles(): ProjectileEffect[] {
    return this.projectiles;
  }

  public getFloatingTexts(): FloatingTextEffect[] {
    return this.floatingTexts;
  }

  public isSessionOver(): boolean {
    return this.sessionOver;
  }

  public isVictory(): boolean {
    return this.victory;
  }

  public areAllWavesCleared(): boolean {
    return this.allWavesCleared;
  }

  public getIsPaused(): boolean {
    return this.isPaused;
  }

  public setPaused(paused: boolean, now: number = Date.now()): void {
    this.isPaused = paused;
    if (paused) {
      this.typingEngine.pause(now);
    } else {
      this.typingEngine.resume(now);
    }
  }

  public getGameSpeed(): number {
    return this.gameSpeed;
  }

  public setGameSpeed(speed: number): void {
    this.gameSpeed = Math.max(0.5, Math.min(4, speed));
  }

  public getSelectedPadIndex(): number | null {
    return this.selectedPadIndex;
  }

  public setSelectedPadIndex(padIndex: number | null): void {
    this.selectedPadIndex = padIndex;
    if (padIndex !== null) {
      const existing = this.towers.find((t) => t.padIndex === padIndex);
      this.selectedTowerId = existing ? existing.id : null;
    } else {
      this.selectedTowerId = null;
    }
  }

  public getSelectedTower(): ActiveTower | null {
    if (!this.selectedTowerId) return null;
    return this.towers.find((t) => t.id === this.selectedTowerId) ?? null;
  }

  public getBossAlert(): string | null {
    return this.bossAlertTimer > 0 ? this.bossAlertMessage : null;
  }

  public getPowerState(): PowerState {
    return this.economy.getPowerState(this.typingEngine.getCombo());
  }

  /**
   * Builds a tower on `padIndex` if unoccupied and affordable.
   */
  public buildTower(type: TowerType, padIndex: number): ActiveTower | null {
    if (this.sessionOver) return null;
    const pad = this.map.pads.find((p) => p.index === padIndex);
    if (!pad) return null;
    if (this.towers.some((t) => t.padIndex === padIndex)) return null;

    if (this.mode === 'campaign' && !this.profile.unlockedTowers.includes(type)) {
      return null;
    }

    const def = TOWERS_DATA[type];
    if (!this.economy.spendGold(def.cost)) return null;

    const tower = TowerSystem.createTower(type, pad, `${this.towers.length + 1}`);
    this.towers.push(tower);
    this.recalculateReactorBonuses();
    this.selectedPadIndex = padIndex;
    this.selectedTowerId = tower.id;
    return tower;
  }

  public upgradeTower(towerId: string, branch: UpgradeBranch): boolean {
    if (this.sessionOver) return false;
    const tower = this.towers.find((t) => t.id === towerId);
    if (!tower) return false;
    const maxTier = this.mode === 'sandbox' ? 3 : this.profile.unlockedUpgradeTiers;
    const ok = TowerSystem.upgradeTower(tower, branch, this.economy, maxTier);
    if (ok) {
      this.recalculateReactorBonuses();
    }
    return ok;
  }

  public sellTower(towerId: string): number {
    if (this.sessionOver) return 0;
    const idx = this.towers.findIndex((t) => t.id === towerId);
    if (idx === -1) return 0;
    const [removed] = this.towers.splice(idx, 1);
    const refund = TowerSystem.getSellValue(removed);
    this.economy.addGold(refund);
    if (this.selectedTowerId === towerId) {
      this.selectedTowerId = null;
    }
    this.recalculateReactorBonuses();
    return refund;
  }

  public setTowerTargeting(towerId: string, priority: TargetingPriority): void {
    const tower = this.towers.find((t) => t.id === towerId);
    if (tower) {
      tower.targeting = priority;
    }
  }

  private recalculateReactorBonuses(): void {
    let bonusMaxEnergy = 0;
    for (const tower of this.towers) {
      const stats = TowerSystem.computeBaseAndUpgradeStats(tower);
      bonusMaxEnergy += stats.maxEnergyBonus;
    }
    this.economy.setBonusMaxEnergy(bonusMaxEnergy);
  }

  public getReactorPassiveStats(): {
    passiveEnergyPerSec: number;
    goldPerWave: number;
    keystrokeEnergyMultiplier: number;
  } {
    let passiveEnergyPerSec = 0;
    let goldPerWave = 0;
    let keystrokeEnergyMultiplier = 0;
    for (const tower of this.towers) {
      const stats = TowerSystem.computeBaseAndUpgradeStats(tower);
      passiveEnergyPerSec += stats.passiveEnergyPerSec;
      goldPerWave += stats.goldPerWave;
      keystrokeEnergyMultiplier += stats.keystrokeEnergyMultiplier;
    }
    return { passiveEnergyPerSec, goldPerWave, keystrokeEnergyMultiplier };
  }

  public startNextWave(): boolean {
    if (this.sessionOver || this.waveSystem.isWaveActive() || !this.waveSystem.hasMoreWaves()) return false;
    const waveDef = this.waveSystem.startNextWave();
    if (!waveDef) return false;
    if (waveDef.isBossWave) {
      this.bossAlertMessage =
        this.profile.settings.language === 'pl'
          ? '⚠️ UWAGA: FALA BOSSA NADCIĄGA!'
          : '⚠️ WARNING: BOSS WAVE APPROACHING!';
      this.bossAlertTimer = 4.0;
    }
    return true;
  }

  public spawnCustomEnemyInSandbox(type: EnemyType, count: number = 1): void {
    if (this.mode !== 'sandbox') return;
    for (let i = 0; i < count; i++) {
      const enemy = EnemySystem.createEnemy(type, this.path, 1.0, i * 18);
      this.enemies.push(enemy);
    }
  }

  /**
   * Activates one of the 3 special energy abilities:
   * - emp (35 Energy): destroys 60% of shields, reveals Ghosts, stuns all enemies for 1.8s
   * - overdrive (45 Energy): forces 140% Overcharged state for 9 seconds
   * - orbital (65 Energy): strikes all enemies for heavy damage (220 AoE)
   */
  public triggerTacticalAbility(ability: 'emp' | 'overdrive' | 'orbital'): boolean {
    if (this.sessionOver || this.isPaused) return false;

    if (ability === 'emp') {
      if (!this.economy.consumeEnergy(35)) return false;
      for (const e of this.enemies) {
        e.shield = Math.max(0, Math.round(e.shield * 0.35));
        e.isRevealed = true;
        e.stunTimer = Math.max(e.stunTimer, 1.8);
        e.regenDisabledTimer = Math.max(e.regenDisabledTimer, 8.0);
      }
      this.projectiles.push({
        id: `emp_${Date.now()}`,
        kind: 'shockwave',
        fromX: 480,
        fromY: 260,
        toX: 480,
        toY: 260,
        color: '#38bdf8',
        radius: 480,
        progress: 0,
        duration: 0.55,
      });
      return true;
    }

    if (ability === 'overdrive') {
      if (!this.economy.consumeEnergy(45)) return false;
      this.economy.activateOverdrive(9.0);
      return true;
    }

    if (ability === 'orbital') {
      if (!this.economy.consumeEnergy(65)) return false;
      for (const e of this.enemies) {
        CombatSystem.applyHitToEnemy(e, 220, { armorShredPercent: 0.8, shieldDamageMultiplier: 2.0 });
        this.projectiles.push({
          id: `orb_${e.id}_${Date.now()}`,
          kind: 'orbital',
          fromX: e.x,
          fromY: 0,
          toX: e.x,
          toY: e.y,
          color: '#f43f5e',
          radius: 45,
          progress: 0,
          duration: 0.45,
        });
      }
      const res = CombatSystem.resolveDefeatedEnemies(this.enemies, this.path, this.economy);
      this.enemies = res.survivingEnemies;
      return true;
    }

    return false;
  }

  /**
   * Handles a keystroke in the typing console, generating energy and triggering sequence effects.
   */
  public handleKeyInput(key: string, now: number = Date.now(), isRepeat: boolean = false): KeystrokeResult {
    const { keystrokeEnergyMultiplier } = this.getReactorPassiveStats();
    const result = this.typingEngine.processKeyInput(
      key,
      this.profile.characterMastery,
      this.profile.bigramMastery,
      keystrokeEnergyMultiplier,
      now,
      isRepeat
    );

    if (!result.ignored && result.isCorrect) {
      this.economy.addEnergy(result.energyGenerated);
      this.score += Math.round(10 * (1 + result.combo * 0.05));

      if (result.sequenceCompleted) {
        const effects = CombatSystem.triggerSequenceCompletionEffects(this.towers, this.enemies);
        this.projectiles.push(...effects);
        const resolved = CombatSystem.resolveDefeatedEnemies(this.enemies, this.path, this.economy);
        this.enemies = resolved.survivingEnemies;
      }

      // Replenish prompt queue if running low
      if (this.typingEngine.getRemainingQueueLength() < 4) {
        const more = AdaptiveLearningEngine.generateExerciseBatch(
          this.mission,
          this.profile.characterMastery,
          this.profile.settings.language,
          10,
          `${this.mission.id}_more_${now}`,
          now
        );
        this.typingEngine.appendPrompts(more);
      }

      this.checkVictoryCondition();
    }

    return result;
  }

  /**
   * Advances the battlefield simulation by `rawDtSec` seconds.
   */
  public update(rawDtSec: number): {
    shotsFiredByType: Record<string, number>;
    waveCompleted: boolean;
  } {
    if (this.isPaused || this.sessionOver) {
      return { shotsFiredByType: {}, waveCompleted: false };
    }

    const dtSec = Math.min(0.1, rawDtSec) * this.gameSpeed;

    if (this.bossAlertTimer > 0) {
      this.bossAlertTimer = Math.max(0, this.bossAlertTimer - rawDtSec);
    }

    const { passiveEnergyPerSec, goldPerWave } = this.getReactorPassiveStats();
    // Base passive trickle of 0.35 energy/sec + reactor passive
    this.economy.update(dtSec, 0.35 + passiveEnergyPerSec);

    // 1. Update wave spawner
    const waveTick = this.waveSystem.update(dtSec, this.path, this.enemies.length);
    if (waveTick.spawnedEnemies.length > 0) {
      this.enemies.push(...waveTick.spawnedEnemies);
    }

    // 2. Update enemies movement & DoT
    const newlySpawnedMinions: ActiveEnemy[] = [];
    const remainingAfterMove: ActiveEnemy[] = [];

    for (const enemy of this.enemies) {
      const step = EnemySystem.updateEnemy(enemy, dtSec, this.path);
      if (step.spawnedMinions.length > 0) {
        newlySpawnedMinions.push(...step.spawnedMinions);
      }
      if (step.reachedBase) {
        this.lives = Math.max(0, this.lives - enemy.baseDamage);
        this.floatingTexts.push({
          id: `base_hit_${Date.now()}_${Math.random()}`,
          x: enemy.x - 20,
          y: enemy.y - 15,
          text: `-${enemy.baseDamage} ❤️`,
          color: '#f43f5e',
          life: 0.9,
          maxLife: 0.9,
        });
      } else {
        remainingAfterMove.push(enemy);
      }
    }

    this.enemies = [...remainingAfterMove, ...newlySpawnedMinions];

    if (this.lives <= 0) {
      this.sessionOver = true;
      this.victory = false;
      return { shotsFiredByType: {}, waveCompleted: false };
    }

    // 3. Towers attack
    const combatEvents = CombatSystem.updateTowers(
      dtSec,
      this.towers,
      this.enemies,
      this.economy,
      this.typingEngine.getCombo()
    );
    this.projectiles.push(...combatEvents.projectilesCreated);
    this.floatingTexts.push(...combatEvents.floatingTextsCreated);

    // 4. Resolve enemy deaths & splitter fragments
    const resolved = CombatSystem.resolveDefeatedEnemies(this.enemies, this.path, this.economy);
    this.enemies = resolved.survivingEnemies;
    if (resolved.defeatedEnemies.length > 0) {
      this.score += resolved.defeatedEnemies.length * 25 + resolved.bossesDefeated * 500;
    }

    // 5. Check wave completion
    let waveCompleted = false;
    if (waveTick.waveJustCompleted && waveTick.completedWaveDef) {
      waveCompleted = true;
      this.economy.addGold(waveTick.completedWaveDef.bonusGold + goldPerWave);
      this.score += 150;

      if (!this.waveSystem.hasMoreWaves() && this.enemies.length === 0) {
        this.allWavesCleared = true;
        this.checkVictoryCondition();
      }
    } else if (
      !this.waveSystem.isWaveActive() &&
      !this.waveSystem.hasMoreWaves() &&
      this.waveSystem.getCurrentWaveNumber() >= this.mission.waves.length &&
      this.enemies.length === 0 &&
      this.waveSystem.getPendingSpawnCount() === 0
    ) {
      this.allWavesCleared = true;
      this.checkVictoryCondition();
    }

    // 6. Update visual projectile & floating text lifetimes
    this.projectiles = this.projectiles
      .map((p) => ({ ...p, progress: p.progress + rawDtSec / Math.max(0.05, p.duration) }))
      .filter((p) => p.progress < 1.0);

    this.floatingTexts = this.floatingTexts
      .map((f) => ({ ...f, y: f.y - 18 * rawDtSec, life: f.life - rawDtSec }))
      .filter((f) => f.life > 0);

    return {
      shotsFiredByType: combatEvents.shotsFiredByType,
      waveCompleted,
    };
  }

  public getRequiredCharsForVictory(): number {
    if (this.mode !== 'campaign') return 0;
    return this.profile.settings.difficulty === 'relaxed'
      ? Math.floor(this.mission.requiredTypedChars * 0.7)
      : this.mission.requiredTypedChars;
  }

  private checkVictoryCondition(): void {
    if (this.sessionOver || this.mode === 'survival' || this.mode === 'sandbox') return;
    if (!this.allWavesCleared) return;

    const reqChars = this.getRequiredCharsForVictory();
    if (this.typingEngine.getTotalCorrect() >= reqChars && this.lives > 0) {
      this.sessionOver = true;
      this.victory = true;
    }
  }
}
