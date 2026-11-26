import { getMissionById, WORLDS_DATA } from '../data/curriculumData';
import { TOWER_ORDER } from '../data/towersData';
import { PersistenceService } from '../services/PersistenceService';
import { DifficultyLevel, HeroId, MissionDefinition, TowerType, UpgradeBranch } from '../types';
import { SeededRandom } from '../utils/rng';
import { ChallengeEngine, ChallengeSessionConfig, DeterministicChallenge } from './ChallengeEngine';
import { GameSessionEngine } from './GameSessionEngine';
import { ProgressionEngine } from './ProgressionEngine';

export type SimulatedPersonaId =
  | 'beginner'
  | 'learning'
  | 'intermediate'
  | 'advanced'
  | 'slow_accurate'
  | 'fast_inaccurate'
  | 'non_typer'
  | 'poor_tactician';

export interface PersonaConfig {
  id: SimulatedPersonaId;
  wpm: number; // target WPM (0 for non_typer)
  accuracy: number; // 0..1 probability of hitting the right key
  tacticalSkill: 'poor' | 'basic' | 'counter_aware' | 'optimal';
  useAbilities: boolean;
}

export const PERSONA_CONFIGS: Record<SimulatedPersonaId, PersonaConfig> = {
  beginner: {
    id: 'beginner',
    wpm: 8, // ~7.5 chars/sec -> 1.5s per char
    accuracy: 0.82,
    tacticalSkill: 'basic',
    useAbilities: false,
  },
  learning: {
    id: 'learning',
    wpm: 16,
    accuracy: 0.87,
    tacticalSkill: 'counter_aware',
    useAbilities: false,
  },
  intermediate: {
    id: 'intermediate',
    wpm: 32,
    accuracy: 0.91,
    tacticalSkill: 'counter_aware',
    useAbilities: true,
  },
  advanced: {
    id: 'advanced',
    wpm: 52,
    accuracy: 0.96,
    tacticalSkill: 'optimal',
    useAbilities: true,
  },
  slow_accurate: {
    id: 'slow_accurate',
    wpm: 14,
    accuracy: 0.98,
    tacticalSkill: 'counter_aware',
    useAbilities: true,
  },
  fast_inaccurate: {
    id: 'fast_inaccurate',
    wpm: 45,
    accuracy: 0.72,
    tacticalSkill: 'counter_aware',
    useAbilities: false,
  },
  non_typer: {
    id: 'non_typer',
    wpm: 0,
    accuracy: 1.0,
    tacticalSkill: 'counter_aware',
    useAbilities: false,
  },
  poor_tactician: {
    id: 'poor_tactician',
    wpm: 25,
    accuracy: 0.9,
    tacticalSkill: 'poor',
    useAbilities: false,
  },
};

export interface MissionSimulationResult {
  missionId: string;
  worldId: number;
  globalIndex: number;
  persona: SimulatedPersonaId;
  tacticalVictory: boolean;
  educationalCompleted: boolean;
  followUpTriggered: boolean;
  victory: boolean;
  stars: 0 | 1 | 2 | 3;
  remainingLives: number;
  startingLives: number;
  typedCorrect: number;
  typingAccuracy: number;
  enemiesDefeated: number;
  towersBuilt: number;
  simDurationSec: number;
}

export interface MissionSimulationOptions {
  difficulty?: DifficultyLevel;
  heroId?: HeroId | null;
  unlockedTechs?: string[];
  unlockedTowers?: TowerType[];
}

export interface ChallengeSimulationResult {
  challengeId: string;
  kind: DeterministicChallenge['kind'];
  difficulty: DifficultyLevel;
  persona: SimulatedPersonaId;
  passed: boolean;
  reason?: string;
  awardedTechPoints: number;
  score: number;
  baseDamage: number;
  wavesCompleted: number;
  towerTypesUsed: TowerType[];
  accuracy: number;
  wpm: number;
}

export class CampaignSimulator {
  public static simulateMission(
    missionOrId: MissionDefinition | string,
    personaId: SimulatedPersonaId,
    customTowerLoadout?: TowerType[],
    options: MissionSimulationOptions = {}
  ): MissionSimulationResult {
    const mission =
      typeof missionOrId === 'string' ? getMissionById(missionOrId)! : missionOrId;
    const persona = PERSONA_CONFIGS[personaId];
    const difficulty = options.difficulty ?? 'standard';
    const rng = new SeededRandom(`${mission.id}_${personaId}_${difficulty}`);

    const profile = PersistenceService.createDefaultProfile(`sim_${personaId}`, personaId);
    profile.settings.difficulty = difficulty;
    if (options.heroId === null) {
      profile.explicitNoHero = true;
      profile.selectedHeroId = null;
    } else if (options.heroId) {
      profile.explicitNoHero = false;
      profile.selectedHeroId = options.heroId;
      profile.unlockedHeroes = [options.heroId];
    }
    if (options.unlockedTechs) {
      profile.unlockedTechs = [...options.unlockedTechs];
    }
    if (options.unlockedTowers) {
      profile.unlockedTowers = [...options.unlockedTowers];
    } else {
      // Unlock towers appropriate for the mission's world
      for (const w of WORLDS_DATA) {
        if (w.id <= mission.worldId && w.unlockedTower) {
          if (!profile.unlockedTowers.includes(w.unlockedTower)) {
            profile.unlockedTowers.push(w.unlockedTower);
          }
        }
      }
      if (mission.worldId >= 2 && !profile.unlockedTowers.includes('reactor')) {
        profile.unlockedTowers.push('reactor');
      }
    }
    profile.unlockedUpgradeTiers = mission.worldId >= 3 ? 3 : mission.worldId >= 2 ? 2 : 1;

    const session = new GameSessionEngine({
      mode: 'campaign',
      mission,
      profile,
    });

    const secPerChar = persona.wpm > 0 ? 60 / (persona.wpm * 5) : 999999;
    let charTimerSec = 0;
    let simTimeMs = 1000;
    let followUpTriggered = false;

    // Initial pre-wave planning: type a few characters if beginner/learning, and place initial towers
    CampaignSimulator.applyTacticalDecisions(session, persona, profile.unlockedTowers, customTowerLoadout);

    const maxSimSteps = 6500; // up to 650s simulated time
    for (let step = 0; step < maxSimSteps; step++) {
      if (session.isSessionOver()) break;

      if (session.isFollowUpPracticeActive()) {
        followUpTriggered = true;
      }

      // Start next wave when ready (unless in follow-up practice after all waves cleared)
      if (!session.waveSystem.isWaveActive() && session.waveSystem.hasMoreWaves()) {
        CampaignSimulator.applyTacticalDecisions(session, persona, profile.unlockedTowers, customTowerLoadout);
        session.startNextWave();
      }

      const dtSec = 0.1;
      simTimeMs += 100;

      // Simulate typing
      if (persona.wpm > 0) {
        charTimerSec += dtSec;
        while (charTimerSec >= secPerChar && !session.isSessionOver()) {
          charTimerSec -= secPerChar;
          const expected = session.typingEngine.getExpectedChar();
          if (!expected) break;

          const isHit = rng.next() <= persona.accuracy;
          if (isHit) {
            session.handleKeyInput(expected, simTimeMs, false);
          } else {
            // Simulate a typo followed by correction on next stroke
            const wrongChar = expected === 'f' ? 'j' : 'f';
            session.handleKeyInput(wrongChar, simTimeMs, false);
          }
        }
      }

      // Spend gold earned mid-wave
      if (step % 25 === 0 && !session.isFollowUpPracticeActive()) {
        CampaignSimulator.applyTacticalDecisions(session, persona, profile.unlockedTowers, customTowerLoadout);
      }

      // Trigger tactical abilities if persona uses them
      if (persona.useAbilities && session.getEnemies().length >= 3) {
        if (session.canUseAbility('overdrive')) {
          session.triggerTacticalAbility('overdrive');
        } else if (session.canUseAbility('emp')) {
          session.triggerTacticalAbility('emp');
        }
      }

      session.update(dtSec);

      // If non_typer cleared all waves, they are stuck in follow-up practice because they never type
      if (persona.wpm === 0 && session.areAllWavesCleared()) {
        break;
      }
    }

    const outcome = ProgressionEngine.evaluateMissionResult(
      mission,
      profile,
      session.getLives(),
      session.getMaxLives(),
      session.typingEngine.getTotalCorrect(),
      session.typingEngine.getAccuracy(),
      session.typingEngine.getWpm(),
      session.typingEngine.getMaxCombo(),
      session.typingEngine.getSessionKeyStats()
    );

    return {
      missionId: mission.id,
      worldId: mission.worldId,
      globalIndex: mission.globalIndex,
      persona: personaId,
      tacticalVictory: session.getLives() > 0 && session.areAllWavesCleared(),
      educationalCompleted: outcome.educationalCompleted,
      followUpTriggered,
      victory: outcome.victory && session.getLives() > 0 && session.areAllWavesCleared(),
      stars: session.areAllWavesCleared() ? outcome.stars : 0,
      remainingLives: session.getLives(),
      startingLives: session.getMaxLives(),
      typedCorrect: session.typingEngine.getTotalCorrect(),
      typingAccuracy: Number(session.typingEngine.getAccuracy().toFixed(2)),
      enemiesDefeated: session.getEnemiesDefeatedCount(),
      towersBuilt: session.getTowers().length,
      simDurationSec: Math.round((simTimeMs - 1000) / 1000),
    };
  }

  public static simulateChallenge(
    challenge: DeterministicChallenge,
    difficulty: DifficultyLevel,
    personaId: SimulatedPersonaId,
    options: Omit<MissionSimulationOptions, 'difficulty'> & { customTowerLoadout?: TowerType[] } = {}
  ): ChallengeSimulationResult {
    const persona = PERSONA_CONFIGS[personaId];
    const rng = new SeededRandom(`${challenge.id}_${personaId}_${difficulty}`);
    const challengeConfig: ChallengeSessionConfig = ChallengeEngine.buildChallengeSessionConfig(challenge, difficulty);
    const baseMission = getMissionById(challenge.missionId)!;
    const profile = PersistenceService.createDefaultProfile(`sim_${personaId}`, personaId);
    profile.settings.difficulty = difficulty;
    profile.unlockedTowers = options.unlockedTowers
      ? [...options.unlockedTowers]
      : [...TOWER_ORDER];
    profile.unlockedUpgradeTiers = 3;
    if (options.heroId === null) {
      profile.explicitNoHero = true;
      profile.selectedHeroId = null;
    } else if (options.heroId) {
      profile.explicitNoHero = false;
      profile.selectedHeroId = options.heroId;
      profile.unlockedHeroes = [options.heroId];
    }
    if (options.unlockedTechs) {
      profile.unlockedTechs = [...options.unlockedTechs];
    }

    const session = new GameSessionEngine({
      mode: 'challenge',
      mission: baseMission,
      profile,
      challengeConfig,
    });

    const maxTypes = challengeConfig.completionCriteria.maxTowerTypes;
    const effectiveLoadout = maxTypes
      ? (options.customTowerLoadout ?? ['gun', 'tesla']).slice(0, maxTypes)
      : options.customTowerLoadout;

    const secPerChar = persona.wpm > 0 ? 60 / (persona.wpm * 5) : 999999;
    let charTimerSec = 0;
    let simTimeMs = 1000;

    CampaignSimulator.applyTacticalDecisions(session, persona, profile.unlockedTowers, effectiveLoadout);

    const maxSimSteps = 6500;
    for (let step = 0; step < maxSimSteps; step++) {
      if (session.isSessionOver()) break;
      if (!session.waveSystem.isWaveActive() && session.waveSystem.hasMoreWaves()) {
        CampaignSimulator.applyTacticalDecisions(session, persona, profile.unlockedTowers, effectiveLoadout);
        session.startNextWave();
      }
      const dtSec = 0.1;
      simTimeMs += 100;

      if (persona.wpm > 0) {
        charTimerSec += dtSec;
        while (charTimerSec >= secPerChar && !session.isSessionOver()) {
          charTimerSec -= secPerChar;
          const expected = session.typingEngine.getExpectedChar();
          if (!expected) break;
          if (rng.next() <= persona.accuracy) {
            session.handleKeyInput(expected, simTimeMs, false);
          } else {
            session.handleKeyInput(expected === 'f' ? 'j' : 'f', simTimeMs, false);
          }
        }
      }

      if (step % 25 === 0 && !session.isFollowUpPracticeActive()) {
        CampaignSimulator.applyTacticalDecisions(session, persona, profile.unlockedTowers, effectiveLoadout);
      }

      if (persona.useAbilities && session.getEnemies().length >= 3) {
        if (session.canUseAbility('overdrive')) {
          session.triggerTacticalAbility('overdrive');
        } else if (session.canUseAbility('emp')) {
          session.triggerTacticalAbility('emp');
        }
      }

      session.update(dtSec);
      if (persona.wpm === 0 && session.areAllWavesCleared()) break;
    }

    // Use the same authoritative counters as the real challenge finalization.
    // HP can be healed, an active wave is not a completed wave, and sold
    // towers must still count toward "distinct tower types used".
    const baseDamage = session.getCumulativeBaseDamage();
    const wavesCompleted = session.waveSystem.getCompletedWavesCount();
    const towerTypesUsed = session.getUsedTowerTypes();
    const accuracy = session.typingEngine.getAccuracy();
    const correctChars = session.typingEngine.getTotalCorrect();
    const wpm = session.typingEngine.getWpm();

    const remainingLives = session.getLives();
    const evalRes = ChallengeEngine.evaluateChallengeCompletion(challengeConfig, {
      remainingLives: session.areAllWavesCleared() ? remainingLives : 0,
      cumulativeBaseDamage: baseDamage,
      correctChars,
      accuracy,
      usedTowerTypes: towerTypesUsed,
    });

    const score = Math.round(
      correctChars * 10 * (0.5 + accuracy * 0.5) + wavesCompleted * 100 - baseDamage * 50
    );
    const reward = ChallengeEngine.recordChallengeCompletion(profile, challengeConfig, {
      challengeId: challenge.id,
      rulesetVersion: challenge.rulesetVersion,
      profileId: profile.id,
      timestamp: simTimeMs,
      difficulty,
      score,
      accuracy,
      correctChars,
      errors: session.typingEngine.getTotalErrors(),
      durationSec: Math.round((simTimeMs - 1000) / 1000),
      wpm,
      baseDamage,
      wavesCompleted,
      towerTypesUsed,
      heroId: profile.selectedHeroId ?? null,
      status: evalRes.passed ? 'completed' : 'failed',
    });

    return {
      challengeId: challenge.id,
      kind: challenge.kind,
      difficulty,
      persona: personaId,
      passed: evalRes.passed,
      reason: evalRes.reasonPl,
      awardedTechPoints: reward.awardedTechPoints,
      score,
      baseDamage,
      wavesCompleted,
      towerTypesUsed,
      accuracy: Number(accuracy.toFixed(2)),
      wpm,
    };
  }

  private static applyTacticalDecisions(
    session: GameSessionEngine,
    persona: PersonaConfig,
    unlockedTowers: TowerType[],
    customLoadout?: TowerType[]
  ): void {
    if (persona.tacticalSkill === 'poor') {
      // Poor tactician only ever builds 1 un-upgraded gun tower on the last pad (pad 9)
      if (session.getTowers().length === 0) {
        session.buildTower('gun', 9);
      }
      return;
    }

    const allowed = customLoadout
      ? customLoadout.filter((t) => unlockedTowers.includes(t))
      : unlockedTowers;
    if (allowed.length === 0) return;

    // Strategic pad order (central choke pads 1..7 first)
    const padPriority = [1, 2, 3, 4, 5, 6, 7, 0, 8, 9];
    const existingTowers = session.getTowers();

    // Build up to 3 base towers first, then alternate upgrading and building
    if (existingTowers.length < 3 || (existingTowers.length < 8 && session.economy.getGold() >= 145)) {
      for (const padIdx of padPriority) {
        if (existingTowers.some((t) => t.padIndex === padIdx)) continue;
        const nextType = CampaignSimulator.chooseNextTowerType(
          session,
          existingTowers.length,
          persona.tacticalSkill,
          allowed
        );
        if (session.buildTower(nextType, padIdx)) {
          break;
        }
      }
    }

    // Upgrade existing towers
    for (const tower of session.getTowers()) {
      const branches: UpgradeBranch[] =
        tower.type === 'gun' || tower.type === 'sniper'
          ? ['damage', 'speed', 'special']
          : ['special', 'damage', 'speed'];
      for (const branch of branches) {
        session.upgradeTower(tower.id, branch);
      }
    }
  }

  private static chooseNextTowerType(
    session: GameSessionEngine,
    index: number,
    skill: PersonaConfig['tacticalSkill'],
    allowed: TowerType[]
  ): TowerType {
    if (allowed.length <= 4) {
      return allowed[index % allowed.length];
    }
    if (skill === 'basic') {
      return index % 2 === 0 ? 'gun' : allowed.includes('cannon') ? 'cannon' : 'gun';
    }
    // Check if the mission contains Ghosts or Shields and ensure a detector/shield-breaker is built early
    const hasGhostsOrShields = session.mission.waves.some((w) =>
      w.groups.some((g) => g.enemyType === 'ghost' || g.enemyType === 'shield')
    );
    const preferredOrder: TowerType[] = hasGhostsOrShields
      ? ['tesla', 'gun', 'laser', 'frost', 'drone', 'cannon', 'flame', 'sniper', 'reactor', 'command']
      : ['gun', 'cannon', 'frost', 'sniper', 'tesla', 'laser', 'flame', 'drone', 'reactor', 'command'];
    for (let offset = 0; offset < preferredOrder.length; offset++) {
      const candidate = preferredOrder[(index + offset) % preferredOrder.length];
      if (allowed.includes(candidate)) {
        return candidate;
      }
    }
    return allowed[0];
  }
}
