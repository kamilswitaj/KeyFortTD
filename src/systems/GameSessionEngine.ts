import { ENEMIES_DATA } from '../data/enemiesData';
import { MAPS_DATA } from '../data/mapsData';
import { TOWERS_DATA } from '../data/towersData';
import {
  ActiveEnemy,
  ActiveHero,
  ActiveTower,
  DifficultyLevel,
  EnemyType,
  FloatingTextEffect,
  GameMode,
  HeroId,
  KeyLessonObjective,
  MapDefinition,
  MissionDefinition,
  PlayerProfile,
  ProjectileEffect,
  TargetingPriority,
  TowerType,
  UpgradeBranch,
  WaveDefinition,
} from '../types';
import { AdaptiveLearningEngine } from './AdaptiveLearningEngine';
import { CombatSystem } from './CombatSystem';
import { EnemySystem } from './EnemySystem';
import { HeroSystem } from './HeroSystem';
import { PathSystem } from './PathSystem';
import { ProgressionEngine } from './ProgressionEngine';
import { RenderEffectSystem } from './RenderEffectSystem';
import { PowerState, ResourceEconomy } from './ResourceEconomy';
import { TowerSystem } from './TowerSystem';
import { KeystrokeResult, TypingEngine } from './TypingEngine';
import { WaveSystem } from './WaveSystem';

export interface GameSessionConfig {
  mode: GameMode;
  mission: MissionDefinition;
  sourceMissionId?: string;
  profile: PlayerProfile;
  unlimitedGold?: boolean;
  unlimitedEnergy?: boolean;
  customAllowedKeys?: string[];
  initialGameSpeed?: number;
}

export interface WaveEnemyPreviewItem {
  enemyType: EnemyType;
  count: number;
  namePl: string;
  nameEn: string;
  traitPl: string;
  traitEn: string;
  counterTower: TowerType;
  color: string;
}

const ENEMY_COUNTER_META: Record<
  EnemyType,
  { traitPl: string; traitEn: string; counterTower: TowerType }
> = {
  scout: { traitPl: 'Szybki', traitEn: 'Fast', counterTower: 'gun' },
  tank: { traitPl: 'Ciężki Pancerz', traitEn: 'Heavy Armor', counterTower: 'sniper' },
  shield: { traitPl: 'Tarcza Energetyczna', traitEn: 'Energy Shield', counterTower: 'tesla' },
  swarm: { traitPl: 'Liczny Rój', traitEn: 'Dense Swarm', counterTower: 'cannon' },
  ghost: { traitPl: 'Widmo (wymaga detekcji)', traitEn: 'Stealth Ghost', counterTower: 'tesla' },
  splitter: { traitPl: 'Dzieli się po zniszczeniu', traitEn: 'Splits on Death', counterTower: 'frost' },
  regenerator: { traitPl: 'Regeneruje HP', traitEn: 'Regenerates HP', counterTower: 'flame' },
  armored_elite: { traitPl: 'Ciężki Pancerz', traitEn: 'Heavy Armor', counterTower: 'laser' },
  evasive: { traitPl: 'Unika pocisków', traitEn: 'Projectile Dodge', counterTower: 'tesla' },
  hover: { traitPl: 'Jednostka Latająca', traitEn: 'Flying Hover', counterTower: 'drone' },
  support: { traitPl: 'Leczy Sojuszników', traitEn: 'Heals Allies', counterTower: 'sniper' },
  boss: { traitPl: 'Wielofazowy Boss', traitEn: 'Multi-Phase Boss', counterTower: 'sniper' },
};

export class GameSessionEngine {
  private static sessionSeq = 1;

  public readonly sessionId: string;
  public readonly ownerProfileId: string;
  public readonly sourceMissionId: string;
  public readonly difficulty: DifficultyLevel;
  public readonly launchOptions: {
    unlimitedGold?: boolean;
    unlimitedEnergy?: boolean;
    customAllowedKeys?: string[];
  };
  public readonly mode: GameMode;
  public readonly mission: MissionDefinition;
  public readonly map: MapDefinition;
  public readonly path: PathSystem;
  public readonly economy: ResourceEconomy;
  public readonly waveSystem: WaveSystem;
  public readonly typingEngine: TypingEngine;
  public readonly renderEffects: RenderEffectSystem = new RenderEffectSystem();

  private profile: PlayerProfile;
  private finalized: boolean = false;
  private hero: ActiveHero | null = null;
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
  private inFollowUpPractice: boolean = false;
  private enemiesDefeatedCount: number = 0;
  private selectedPadIndex: number | null = null;
  private selectedTowerId: string | null = null;
  private bossAlertMessage: string | null = null;
  private bossAlertTimer: number = 0;
  private abilityCooldowns: Record<'emp' | 'overdrive' | 'orbital', number> = {
    emp: 0,
    overdrive: 0,
    orbital: 0,
  };

  constructor(config: GameSessionConfig) {
    this.sessionId = `sess_${Date.now()}_${GameSessionEngine.sessionSeq++}`;
    this.ownerProfileId = config.profile.id;
    this.sourceMissionId = config.sourceMissionId ?? config.mission.id;
    this.difficulty = config.profile.settings.difficulty ?? 'standard';
    this.launchOptions = {
      unlimitedGold: config.unlimitedGold,
      unlimitedEnergy: config.unlimitedEnergy,
      customAllowedKeys: config.customAllowedKeys,
    };
    this.mode = config.mode;
    this.mission = config.mission;
    this.profile = config.mode === 'sandbox' ? structuredClone(config.profile) : config.profile;
    this.map = MAPS_DATA[config.mission.mapId] ?? MAPS_DATA.green_valley_1;
    this.path = new PathSystem(this.map.waypoints);

    this.lives = config.mission.startingLives;
    this.maxLives = config.mission.startingLives;

    const chosenHeroId = config.profile.selectedHeroId ?? null;
    if (chosenHeroId && (config.mode === 'sandbox' || (config.profile.unlockedHeroes ?? []).includes(chosenHeroId)) && (config.mode !== 'campaign' || config.mission.globalIndex >= 4)) {
      const endWp = this.map.waypoints[this.map.waypoints.length - 1] ?? { x: 820, y: 200 };
      const anchor = {
        x: Math.max(80, Math.min(860, endWp.x - 95)),
        y: Math.max(60, Math.min(340, endWp.y + (endWp.y > 200 ? -55 : 55))),
      };
      this.hero = HeroSystem.createActiveHero(chosenHeroId, anchor);
      if (chosenHeroId === 'guardian') {
        this.lives += 2;
        this.maxLives += 2;
      }
    }

    this.economy = new ResourceEconomy(config.mission.startingGold, 50);
    if (this.hero?.id === 'engineer') {
      this.economy.setBonusMaxEnergy(15);
    }
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
      `${this.mission.id}_${Date.now()}`,
      Date.now(),
      this.profile.bigramMastery
    );
    this.typingEngine = new TypingEngine(initialPrompts);
  }

  public getLives(): number {
    return this.lives;
  }

  public getOwnerProfile(): PlayerProfile {
    return this.profile;
  }

  public isFinalized(): boolean {
    return this.finalized;
  }

  public markFinalized(): boolean {
    if (this.finalized) return false;
    this.finalized = true;
    return true;
  }

  public isUnrestrictedResources(): boolean {
    return (
      this.mode === 'sandbox' ||
      this.economy.isUnlimitedGold() ||
      this.economy.isUnlimitedEnergy() ||
      Boolean(this.launchOptions.unlimitedGold) ||
      Boolean(this.launchOptions.unlimitedEnergy)
    );
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

  public isTacticalVictory(): boolean {
    return this.allWavesCleared && this.lives > 0;
  }

  public isEducationalCompleted(): boolean {
    if (this.mode !== 'campaign') return true;
    return ProgressionEngine.checkEducationalCompletion(
      this.mission,
      this.profile,
      this.typingEngine.getTotalCorrect(),
      this.typingEngine.getAccuracy(),
      this.typingEngine.getSessionKeyStats()
    ).educationalCompleted;
  }

  public getKeyObjectives(): KeyLessonObjective[] {
    if (this.mode !== 'campaign') return [];
    const isRelaxed = this.profile.settings.difficulty === 'relaxed';
    return ProgressionEngine.evaluateKeyObjectives(
      this.mission,
      isRelaxed,
      this.typingEngine.getSessionKeyStats()
    );
  }

  public isFollowUpPracticeActive(): boolean {
    return this.inFollowUpPractice && !this.sessionOver;
  }

  public getEnemiesDefeatedCount(): number {
    return this.enemiesDefeatedCount;
  }

  public getTotalDamageDealt(): number {
    return this.towers.reduce((sum, t) => sum + t.totalDamageDealt, 0);
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
    this.typingEngine.markIdleBreak();
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

  public getAbilityCooldown(ability: 'emp' | 'overdrive' | 'orbital'): number {
    return Math.ceil(this.abilityCooldowns[ability]);
  }

  public canUseAbility(ability: 'emp' | 'overdrive' | 'orbital'): boolean {
    if (this.sessionOver || this.isPaused) return false;
    if (this.abilityCooldowns[ability] > 0) return false;
    const cost = ability === 'emp' ? 35 : ability === 'overdrive' ? 45 : 65;
    if (this.economy.getEnergy() < cost) return false;
    if ((ability === 'emp' || ability === 'orbital') && this.enemies.length === 0) {
      return false;
    }
    return true;
  }

  /**
   * Returns a preview of the current or upcoming wave's enemy groups and their counters.
   */
  public getUpcomingWavePreview(): { waveNumber: number; isBossWave: boolean; items: WaveEnemyPreviewItem[] } {
    const rawUpcoming = this.waveSystem.getUpcomingOrActiveWaveNumber();
    const waveNum =
      this.mode === 'survival'
        ? rawUpcoming
        : Math.max(1, Math.min(this.mission.waves.length, rawUpcoming));
    const waveDef: WaveDefinition | undefined =
      this.mission.waves[waveNum - 1] ??
      (this.mode === 'survival' ? WaveSystem.generateSurvivalWave(waveNum) : this.mission.waves[0]);

    if (!waveDef) {
      return { waveNumber: waveNum, isBossWave: false, items: [] };
    }

    const merged = new Map<EnemyType, number>();
    for (const g of waveDef.groups) {
      merged.set(g.enemyType, (merged.get(g.enemyType) ?? 0) + g.count);
    }

    const items: WaveEnemyPreviewItem[] = [];
    for (const [eType, count] of merged.entries()) {
      const def = ENEMIES_DATA[eType];
      const meta = ENEMY_COUNTER_META[eType];
      items.push({
        enemyType: eType,
        count,
        namePl: def.namePl,
        nameEn: def.nameEn,
        traitPl: meta.traitPl,
        traitEn: meta.traitEn,
        counterTower: meta.counterTower,
        color: def.color,
      });
    }

    return {
      waveNumber: waveDef.waveNumber,
      isBossWave: Boolean(waveDef.isBossWave),
      items,
    };
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

    this.typingEngine.markIdleBreak();
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
      this.typingEngine.markIdleBreak();
      this.recalculateReactorBonuses();
    }
    return ok;
  }

  public sellTower(towerId: string): number {
    if (this.sessionOver) return 0;
    const idx = this.towers.findIndex((t) => t.id === towerId);
    if (idx === -1) return 0;
    this.typingEngine.markIdleBreak();
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
      this.typingEngine.markIdleBreak();
      tower.targeting = priority;
    }
  }

  private recalculateReactorBonuses(): void {
    let bonusMaxEnergy = this.hero?.id === 'engineer' ? 15 : 0;
    for (const tower of this.towers) {
      const stats = TowerSystem.computeBaseAndUpgradeStats(tower);
      bonusMaxEnergy += stats.maxEnergyBonus;
    }
    this.economy.setBonusMaxEnergy(bonusMaxEnergy);
  }

  public getHero(): ActiveHero | null {
    return this.hero;
  }

  public triggerHeroAbility(slotIndex: 0 | 1): boolean {
    if (!this.hero || this.sessionOver || this.isPaused) return false;
    const result = HeroSystem.triggerHeroAbility(
      this.hero,
      slotIndex,
      this.enemies,
      this.economy,
      (healAmt) => {
        this.lives = Math.min(this.maxLives, this.lives + healAmt);
      }
    );
    if (!result.triggered) return false;
    this.projectiles.push(...result.projectiles);
    this.floatingTexts.push(...result.floatingTexts);
    this.renderEffects.spawnShockwave(this.hero.x, this.hero.y, 160, '#38bdf8', 0.45, 3);
    this.renderEffects.triggerShake(4, 0.22);
    return true;
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
    this.typingEngine.markIdleBreak();
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
   * - emp (35 Energy, 14s cooldown): requires active enemies; strips 60% of shields, reveals Ghosts, stuns for 1.8s
   * - overdrive (45 Energy, 16s cooldown): forces 140% Overcharged state for 8 seconds
   * - orbital (65 Energy, 22s cooldown): requires active enemies; strikes enemies for 165 AoE damage
   */
  public triggerTacticalAbility(ability: 'emp' | 'overdrive' | 'orbital'): boolean {
    if (!this.canUseAbility(ability)) return false;

    if (ability === 'emp') {
      if (!this.economy.consumeEnergy(35)) return false;
      this.abilityCooldowns.emp = 14;
      for (const e of this.enemies) {
        e.shield = Math.max(0, Math.round(e.shield * 0.35));
        e.isRevealed = true;
        e.stunTimer = Math.max(e.stunTimer, 1.8);
        e.regenDisabledTimer = Math.max(e.regenDisabledTimer, 8.0);
      }
      this.projectiles.push({
        id: `emp_${Date.now()}`,
        kind: 'shockwave',
        fromX: 465,
        fromY: 240,
        toX: 465,
        toY: 240,
        color: '#38bdf8',
        radius: 460,
        progress: 0,
        duration: 0.55,
      });
      return true;
    }

    if (ability === 'overdrive') {
      if (!this.economy.consumeEnergy(45)) return false;
      this.abilityCooldowns.overdrive = 16;
      this.economy.activateOverdrive(8.0);
      return true;
    }

    if (ability === 'orbital') {
      if (!this.economy.consumeEnergy(65)) return false;
      this.abilityCooldowns.orbital = 22;
      for (const e of this.enemies) {
        CombatSystem.applyHitToEnemy(e, 165, { armorShredPercent: 0.75, shieldDamageMultiplier: 1.8 });
        this.projectiles.push({
          id: `orb_${e.id}_${Date.now()}`,
          kind: 'orbital',
          fromX: e.x,
          fromY: 0,
          toX: e.x,
          toY: e.y,
          color: '#f43f5e',
          radius: 42,
          progress: 0,
          duration: 0.45,
        });
      }
      const res = CombatSystem.resolveDefeatedEnemies(this.enemies, this.path, this.economy);
      this.enemies = res.survivingEnemies;
      this.enemiesDefeatedCount += res.defeatedEnemies.length;
      return true;
    }

    return false;
  }

  /**
   * Handles a keystroke in the typing console, generating energy and triggering sequence effects.
   */
  public handleKeyInput(key: string, now: number = Date.now(), isRepeat: boolean = false): KeystrokeResult {
    const { keystrokeEnergyMultiplier } = this.getReactorPassiveStats();
    const heroBonus = this.hero?.id === 'engineer' ? 0.12 : 0;
    const result = this.typingEngine.processKeyInput(
      key,
      this.profile.characterMastery,
      this.profile.bigramMastery,
      keystrokeEnergyMultiplier + heroBonus,
      now,
      isRepeat
    );

    if (!result.ignored && result.isCorrect) {
      this.economy.addEnergy(result.energyGenerated);
      this.score += Math.round(10 * (1 + result.combo * 0.05));

      const targetTower = this.towers[this.typingEngine.getTotalCorrect() % Math.max(1, this.towers.length)];
      const endWp = this.map.waypoints[this.map.waypoints.length - 1] ?? { x: 860, y: 200 };
      const orbToX = targetTower ? targetTower.x : endWp.x - 32;
      const orbToY = targetTower ? targetTower.y : endWp.y;
      this.renderEffects.spawnEnergyOrb(465, 395, orbToX, orbToY, result.sequenceCompleted ? '#facc15' : '#38bdf8');

      if (result.sequenceCompleted) {
        const effects = CombatSystem.triggerSequenceCompletionEffects(this.towers, this.enemies);
        this.projectiles.push(...effects);
        const resolved = CombatSystem.resolveDefeatedEnemies(this.enemies, this.path, this.economy);
        this.enemies = resolved.survivingEnemies;
        this.enemiesDefeatedCount += resolved.defeatedEnemies.length;
      }

      // Replenish prompt queue if running low
      if (this.typingEngine.getRemainingQueueLength() < 4) {
        if (this.inFollowUpPractice) {
          const edu = ProgressionEngine.checkEducationalCompletion(
            this.mission,
            this.profile,
            this.typingEngine.getTotalCorrect(),
            this.typingEngine.getAccuracy(),
            this.typingEngine.getSessionKeyStats()
          );
          const followUpMore = AdaptiveLearningEngine.generateFollowUpPracticeBatch(
            edu.unmetKeys,
            this.mission.allowedKeys,
            this.profile.characterMastery,
            this.profile.bigramMastery,
            this.profile.settings.language,
            6,
            `${this.mission.id}_followup_${now}`
          );
          this.typingEngine.appendPrompts(followUpMore);
        } else {
          const more = AdaptiveLearningEngine.generateExerciseBatch(
            this.mission,
            this.profile.characterMastery,
            this.profile.settings.language,
            10,
            `${this.mission.id}_more_${now}`,
            now,
            this.profile.bigramMastery,
            this.typingEngine.getRecentPromptTexts()
          );
          this.typingEngine.appendPrompts(more);
        }
      }

      this.checkVictoryOrFollowUpCondition();
    }

    return result;
  }

  /**
   * Advances the battlefield simulation by `rawDtSec` seconds.
   */
  public update(rawDtSec: number): {
    shotsFiredByType: Record<string, number>;
    waveCompleted: boolean;
    goldChanged: boolean;
  } {
    if (this.isPaused || this.sessionOver) {
      return { shotsFiredByType: {}, waveCompleted: false, goldChanged: false };
    }

    const dtSec = Math.min(0.1, rawDtSec) * this.gameSpeed;
    const prevGold = this.economy.getGold();

    if (this.bossAlertTimer > 0) {
      this.bossAlertTimer = Math.max(0, this.bossAlertTimer - rawDtSec);
    }

    for (const k of ['emp', 'overdrive', 'orbital'] as const) {
      if (this.abilityCooldowns[k] > 0) {
        this.abilityCooldowns[k] = Math.max(0, this.abilityCooldowns[k] - dtSec);
      }
    }

    const { passiveEnergyPerSec, goldPerWave } = this.getReactorPassiveStats();
    // Gentle passive trickle (0.20/s) + reactor passive
    this.economy.update(dtSec, 0.2 + passiveEnergyPerSec);

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
      if (step.bossPhaseTriggered) {
        this.floatingTexts.push({
          id: `boss_phase_${Date.now()}_${Math.random()}`,
          x: enemy.x,
          y: enemy.y - 26,
          text: `⚡ FAZA ${step.bossPhaseTriggered}!`,
          color: '#facc15',
          life: 1.2,
          maxLife: 1.2,
        });
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
      this.inFollowUpPractice = false;
      return { shotsFiredByType: {}, waveCompleted: false, goldChanged: this.economy.getGold() !== prevGold };
    }

    // 3. Towers & Hero attack
    const combatEvents = CombatSystem.updateTowers(
      dtSec,
      this.towers,
      this.enemies,
      this.economy,
      this.typingEngine.getCombo()
    );
    this.projectiles.push(...combatEvents.projectilesCreated);
    this.floatingTexts.push(...combatEvents.floatingTextsCreated);

    if (this.hero) {
      const heroEvents = HeroSystem.updateHero(this.hero, dtSec, this.enemies, this.economy);
      this.projectiles.push(...heroEvents.projectilesCreated);
      this.floatingTexts.push(...heroEvents.floatingTextsCreated);
    }

    // 4. Resolve enemy deaths & splitter fragments
    const resolved = CombatSystem.resolveDefeatedEnemies(this.enemies, this.path, this.economy);
    this.enemies = resolved.survivingEnemies;
    if (resolved.defeatedEnemies.length > 0) {
      this.enemiesDefeatedCount += resolved.defeatedEnemies.length;
      this.score += resolved.defeatedEnemies.length * 25 + resolved.bossesDefeated * 500;
      for (const dead of resolved.defeatedEnemies) {
        this.renderEffects.spawnBurst(dead.x, dead.y, dead.color, dead.isBoss ? 28 : 8, 'spark', dead.isBoss ? 140 : 85);
        if (dead.isBoss) {
          this.renderEffects.spawnShockwave(dead.x, dead.y, 120, '#f43f5e', 0.55, 4);
          this.renderEffects.triggerShake(7, 0.35);
        }
      }
      for (const dead of resolved.defeatedEnemies.slice(0, 3)) {
        this.floatingTexts.push({
          id: `gold_${dead.id}`,
          x: dead.x,
          y: dead.y - 10,
          text: `+${dead.goldReward}🪙`,
          color: '#facc15',
          life: 0.7,
          maxLife: 0.7,
        });
      }
    }

    // 5. Check wave completion
    let waveCompleted = false;
    if (waveTick.waveJustCompleted && waveTick.completedWaveDef) {
      waveCompleted = true;
      this.economy.addGold(waveTick.completedWaveDef.bonusGold + goldPerWave);
      this.score += 150;
      if (this.hero) {
        HeroSystem.addHeroXp(this.hero, 45);
      }

      if (!this.waveSystem.hasMoreWaves() && this.enemies.length === 0) {
        this.allWavesCleared = true;
        this.checkVictoryOrFollowUpCondition();
      }
    } else if (
      !this.waveSystem.isWaveActive() &&
      !this.waveSystem.hasMoreWaves() &&
      this.waveSystem.getCurrentWaveNumber() >= this.mission.waves.length &&
      this.enemies.length === 0 &&
      this.waveSystem.getPendingSpawnCount() === 0
    ) {
      this.allWavesCleared = true;
      this.checkVictoryOrFollowUpCondition();
    }

    // 6. Update visual projectile & floating text lifetimes
    this.projectiles = this.projectiles
      .map((p) => ({ ...p, progress: p.progress + rawDtSec / Math.max(0.05, p.duration) }))
      .filter((p) => p.progress < 1.0);

    this.floatingTexts = this.floatingTexts
      .map((f) => ({ ...f, y: f.y - 18 * rawDtSec, life: f.life - rawDtSec }))
      .filter((f) => f.life > 0);

    this.renderEffects.update(rawDtSec);

    return {
      shotsFiredByType: combatEvents.shotsFiredByType,
      waveCompleted,
      goldChanged: this.economy.getGold() !== prevGold,
    };
  }

  public getRequiredCharsForVictory(): number {
    if (this.mode !== 'campaign') return 0;
    return this.profile.settings.difficulty === 'relaxed'
      ? Math.floor(this.mission.requiredTypedChars * 0.7)
      : this.mission.requiredTypedChars;
  }

  private checkVictoryOrFollowUpCondition(): void {
    if (this.sessionOver || this.mode === 'survival' || this.mode === 'sandbox') return;
    if (!this.allWavesCleared || this.lives <= 0) return;

    const edu = ProgressionEngine.checkEducationalCompletion(
      this.mission,
      this.profile,
      this.typingEngine.getTotalCorrect(),
      this.typingEngine.getAccuracy(),
      this.typingEngine.getSessionKeyStats()
    );

    if (edu.educationalCompleted) {
      this.inFollowUpPractice = false;
      this.sessionOver = true;
      this.victory = true;
      return;
    }

    // Tactical victory achieved, but educational objectives are not yet complete:
    // Enter Follow-Up Practice mode with a short targeted drill on unmet keys!
    if (!this.inFollowUpPractice) {
      this.inFollowUpPractice = true;
      const followUpPrompts = AdaptiveLearningEngine.generateFollowUpPracticeBatch(
        edu.unmetKeys,
        this.mission.allowedKeys,
        this.profile.characterMastery,
        this.profile.bigramMastery,
        this.profile.settings.language,
        6,
        `${this.mission.id}_followup_start`
      );
      if (followUpPrompts.length > 0) {
        this.typingEngine.setPrompts(followUpPrompts);
      }
    }
  }
}
