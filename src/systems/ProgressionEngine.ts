import { MISSIONS_DATA, WORLDS_DATA } from '../data/curriculumData';
import {
  DifficultyLevel,
  KeyLessonObjective,
  MasteryStatus,
  MissionDefinition,
  PlayerProfile,
  SessionKeyStats,
  TowerType,
} from '../types';
import { StatisticsEngine } from './StatisticsEngine';

export interface MissionOutcomeEvaluation {
  victory: boolean;
  tacticalVictory: boolean;
  educationalCompleted: boolean;
  stars: 0 | 1 | 2 | 3;
  xpEarned: number;
  leveledUp: boolean;
  newLevel: number;
  newlyUnlockedTowers: TowerType[];
  keyObjectives: KeyLessonObjective[];
  masterySummary: Array<{ key: string; status: MasteryStatus; score: number }>;
  reasonPl?: string;
  reasonEn?: string;
}

export class ProgressionEngine {
  public static getRequiredXpForLevel(level: number): number {
    return 150 + (level - 1) * 95;
  }

  public static isMissionUnlocked(mission: MissionDefinition, profile: PlayerProfile): boolean {
    if (mission.globalIndex === 1) return true;
    const prevMission = MISSIONS_DATA.find((m) => m.globalIndex === mission.globalIndex - 1);
    if (!prevMission) return true;
    return Boolean(profile.completedMissions[prevMission.id]?.completed);
  }

  /**
   * Computes per-key lesson objectives for the mission's newly introduced keys.
   */
  public static evaluateKeyObjectives(
    mission: MissionDefinition,
    isRelaxed: boolean,
    sessionKeyStats?: Record<string, SessionKeyStats>
  ): KeyLessonObjective[] {
    const nonSpaceNew = mission.newKeys.filter((k) => k !== ' ');
    const targetKeys =
      nonSpaceNew.length > 0
        ? nonSpaceNew.slice(0, 5)
        : mission.newKeys.includes(' ')
        ? [' ']
        : [];

    if (targetKeys.length === 0) return [];

    const baseReq =
       nonSpaceNew.length > 5
        ? 2
        : targetKeys.length <= 2
        ? isRelaxed
          ? 5
          : 6
        : isRelaxed
        ? 3
        : 4;
    const targetAcc = isRelaxed ? 0.7 : Math.max(0.75, mission.targetAccuracy - 0.06);

    return targetKeys.map((key) => {
      if (!sessionKeyStats) {
        return {
          key,
          requiredCorrect: baseReq,
          correct: baseReq,
          attempts: baseReq,
          targetAccuracy: targetAcc,
          accuracy: 1.0,
          completed: true,
        };
      }
      const stat = sessionKeyStats[key] ?? { key, attempts: 0, correct: 0, errors: 0 };
      const accuracy = stat.attempts > 0 ? stat.correct / stat.attempts : 1.0;
      // A learner completes the key objective by either meeting requiredCorrect + targetAccuracy,
      // or by practicing extra correct repetitions (+3) to recover from early mistakes.
      const completed =
        (stat.correct >= baseReq && accuracy >= targetAcc) || stat.correct >= baseReq + 3;

      return {
        key,
        requiredCorrect: baseReq,
        correct: stat.correct,
        attempts: stat.attempts,
        targetAccuracy: targetAcc,
        accuracy,
        completed,
      };
    });
  }

  /**
   * Evaluates whether the educational requirements of a mission have been satisfied.
   */
  public static checkEducationalCompletion(
    mission: MissionDefinition,
    profile: PlayerProfile,
    typedCorrectChars: number,
    typingAccuracy: number,
    sessionKeyStats?: Record<string, SessionKeyStats>
  ): {
    educationalCompleted: boolean;
    minRequiredChars: number;
    minAccuracy: number;
    keyObjectives: KeyLessonObjective[];
    unmetKeys: string[];
  } {
    const isRelaxed = profile.settings.difficulty === 'relaxed';
    const minRequiredChars = isRelaxed
      ? Math.floor(mission.requiredTypedChars * 0.7)
      : mission.requiredTypedChars;
    const minAccuracy = isRelaxed
      ? Math.max(0.68, mission.targetAccuracy - 0.1)
      : mission.targetAccuracy - 0.05;

    const keyObjectives = ProgressionEngine.evaluateKeyObjectives(mission, isRelaxed, sessionKeyStats);
    const unmetKeys = keyObjectives.filter((o) => !o.completed).map((o) => o.key);

    // If overall accuracy was slightly below minAccuracy due to early errors, allow extra correct practice (+20% chars) to compensate
    const accuracyMet =
      typingAccuracy >= minAccuracy ||
      (typingAccuracy >= minAccuracy - 0.07 && typedCorrectChars >= Math.ceil(minRequiredChars * 1.2));

    const educationalCompleted =
      typedCorrectChars >= minRequiredChars && accuracyMet && unmetKeys.length === 0;

    return {
      educationalCompleted,
      minRequiredChars,
      minAccuracy,
      keyObjectives,
      unmetKeys,
    };
  }

  public static evaluateMissionResult(
    mission: MissionDefinition,
    profile: PlayerProfile,
    remainingLives: number,
    startingLives: number,
    typedCorrectChars: number,
    typingAccuracy: number,
    wpm: number,
    maxCombo: number,
    sessionKeyStats?: Record<string, SessionKeyStats>,
    options: {
      durationSec?: number;
      isUnrestrictedResources?: boolean;
      unrestrictedResources?: boolean;
      difficulty?: DifficultyLevel;
    } = {}
  ): MissionOutcomeEvaluation {
    const tacticalVictory = remainingLives > 0;
    const edu = ProgressionEngine.checkEducationalCompletion(
      mission,
      profile,
      typedCorrectChars,
      typingAccuracy,
      sessionKeyStats
    );

    const summaryKeys =
      mission.newKeys.filter((k) => k !== ' ').length > 0
        ? mission.newKeys.filter((k) => k !== ' ').slice(0, 6)
        : mission.allowedKeys.filter((k) => k !== ' ').slice(-4);

    const masterySummary = summaryKeys.map((key) => {
      const m = profile.characterMastery[key];
      return {
        key,
        status: (m?.status ?? 'learning') as MasteryStatus,
        score: m?.masteryScore ?? 0,
      };
    });

    if (!tacticalVictory) {
      return {
        victory: false,
        tacticalVictory: false,
        educationalCompleted: edu.educationalCompleted,
        stars: 0,
        xpEarned: Math.min(40, Math.floor(typedCorrectChars * 0.25)),
        leveledUp: false,
        newLevel: profile.level,
        newlyUnlockedTowers: [],
        keyObjectives: edu.keyObjectives,
        masterySummary,
        reasonPl: 'Baza została zniszczona przez fale wrogów.',
        reasonEn: 'Your base was destroyed by enemy waves.',
      };
    }

    if (!edu.educationalCompleted) {
      let reasonPl = '';
      let reasonEn = '';
      if (typedCorrectChars < edu.minRequiredChars) {
        reasonPl = `Wpisano za mało znaków (${typedCorrectChars}/${edu.minRequiredChars}). Ćwiczenie pisania jest wymagane do zaliczenia misji!`;
        reasonEn = `Insufficient characters typed (${typedCorrectChars}/${edu.minRequiredChars}). Meaningful typing practice is required!`;
      } else if (edu.unmetKeys.length > 0) {
        const keysList = edu.unmetKeys.map((k) => (k === ' ' ? 'Spacja' : k.toUpperCase())).join(', ');
        reasonPl = `Nowe klawisze (${keysList}) wymagają jeszcze kilku poprawnych powtórzeń.`;
        reasonEn = `Newly introduced keys (${keysList}) need a few more accurate repetitions.`;
      } else {
        reasonPl = `Celność pisania (${Math.round(typingAccuracy * 100)}%) poniżej wymaganego progu (${Math.round(edu.minAccuracy * 100)}%). Zwolnij i skup się na bezbłędności!`;
        reasonEn = `Typing accuracy (${Math.round(typingAccuracy * 100)}%) below threshold (${Math.round(edu.minAccuracy * 100)}%). Slow down and focus on accuracy!`;
      }

      return {
        victory: false,
        tacticalVictory: true,
        educationalCompleted: false,
        stars: 0,
        xpEarned: 40,
        leveledUp: false,
        newLevel: profile.level,
        newlyUnlockedTowers: [],
        keyObjectives: edu.keyObjectives,
        masterySummary,
        reasonPl,
        reasonEn,
      };
    }

    // Calculate stars (1..3) combining tactical defense and educational performance
    const lifeRatio = remainingLives / Math.max(1, startingLives);
    const allNewKeysHighAcc = edu.keyObjectives.every((o) => o.accuracy >= 0.85);
    let stars: 1 | 2 | 3 = 1;
    if (lifeRatio >= 0.9 && typingAccuracy >= mission.targetAccuracy + 0.04 && allNewKeysHighAcc) {
      stars = 3;
    } else if (lifeRatio >= 0.65 && typingAccuracy >= mission.targetAccuracy) {
      stars = 2;
    }

    const baseXp = 110 + mission.globalIndex * 8 + stars * 35 + (mission.isBossMission ? 80 : 0);
    const score = Math.round(typedCorrectChars * 12 * typingAccuracy + remainingLives * 50 + maxCombo * 15);
    const durationSec = options.durationSec ?? (wpm > 0 ? Math.round((typedCorrectChars / 5 / wpm) * 60) : 10);
    const qualifyingWpm = StatisticsEngine.computeQualifyingWpm(typedCorrectChars, durationSec);
    const difficulty = options.difficulty ?? profile.settings.difficulty ?? 'standard';

    const prevRecord = profile.completedMissions[mission.id];
    profile.completedMissions[mission.id] = {
      missionId: mission.id,
      completed: true,
      stars: prevRecord ? (Math.max(prevRecord.stars, stars) as 1 | 2 | 3) : stars,
      bestAccuracy: prevRecord ? Math.max(prevRecord.bestAccuracy, typingAccuracy) : typingAccuracy,
      bestWpm: prevRecord ? Math.max(prevRecord.bestWpm, wpm) : wpm,
      bestQualifyingWpm:
        qualifyingWpm !== null
          ? prevRecord?.bestQualifyingWpm !== null && prevRecord?.bestQualifyingWpm !== undefined
            ? Math.max(prevRecord.bestQualifyingWpm, qualifyingWpm)
            : qualifyingWpm
          : prevRecord?.bestQualifyingWpm ?? null,
      bestScore: prevRecord ? Math.max(prevRecord.bestScore, score) : score,
      maxCombo: Math.max(prevRecord?.maxCombo ?? 0, maxCombo),
      timesCompleted: (prevRecord?.timesCompleted ?? 0) + 1,
      byDifficulty: prevRecord?.byDifficulty ? { ...prevRecord.byDifficulty } : {},
    };

    if (!options.isUnrestrictedResources && !options.unrestrictedResources) {
      StatisticsEngine.updateMissionDifficultyRecord(
        profile,
        mission.id,
        difficulty,
        stars,
        typingAccuracy,
        wpm,
        qualifyingWpm,
        score,
        maxCombo
      );
    }

    // Award XP & check level up
    const oldLevel = profile.level;
    ProgressionEngine.awardXp(profile, baseXp);

    // Check tower & upgrade tier unlocks based on highest reached world
    const newlyUnlockedTowers: TowerType[] = [];
    const nextMission = MISSIONS_DATA.find((m) => m.globalIndex === mission.globalIndex + 1);
    const highestWorld = nextMission ? nextMission.worldId : mission.worldId;

    for (const world of WORLDS_DATA) {
      if (world.id <= highestWorld && world.unlockedTower) {
        if (!profile.unlockedTowers.includes(world.unlockedTower)) {
          profile.unlockedTowers.push(world.unlockedTower);
          newlyUnlockedTowers.push(world.unlockedTower);
        }
      }
    }

    // Unlock optional V2.0 towers progressively alongside World unlocks
    const extraTowerUnlocks: Array<{ world: number; type: TowerType }> = [
      { world: 2, type: 'reactor' },
      { world: 2, type: 'flame' },
      { world: 3, type: 'drone' },
      { world: 4, type: 'command' },
      { world: 5, type: 'laser' },
    ];
    for (const item of extraTowerUnlocks) {
      if (highestWorld >= item.world && !profile.unlockedTowers.includes(item.type)) {
        profile.unlockedTowers.push(item.type);
        newlyUnlockedTowers.push(item.type);
      }
    }

    // Unlock heroes progressively after initial onboarding lessons (Mission 1.3+)
    if (!profile.unlockedHeroes) profile.unlockedHeroes = [];
    const heroChecks: Array<{ cond: boolean; hero: 'guardian' | 'engineer' | 'ranger' | 'arcanist' }> = [
      { cond: mission.globalIndex >= 3, hero: 'guardian' },
      { cond: highestWorld >= 2, hero: 'engineer' },
      { cond: highestWorld >= 3, hero: 'ranger' },
      { cond: highestWorld >= 4, hero: 'arcanist' },
    ];
    for (const hc of heroChecks) {
      if (hc.cond && !profile.unlockedHeroes.includes(hc.hero)) {
        profile.unlockedHeroes.push(hc.hero);
        if (!profile.selectedHeroId && !profile.explicitNoHero) {
          profile.selectedHeroId = hc.hero;
        }
      }
    }

    // Award 1 Tech Point on first completion of a Boss mission
    if (mission.isBossMission && !prevRecord?.completed) {
      profile.techPoints = (profile.techPoints ?? 0) + 1;
    }

    if (highestWorld >= 2 && profile.unlockedUpgradeTiers < 2) {
      profile.unlockedUpgradeTiers = 2;
    }
    if (highestWorld >= 3 && profile.unlockedUpgradeTiers < 3) {
      profile.unlockedUpgradeTiers = 3;
    }

    return {
      victory: true,
      tacticalVictory: true,
      educationalCompleted: true,
      stars,
      xpEarned: baseXp,
      leveledUp: profile.level > oldLevel,
      newLevel: profile.level,
      newlyUnlockedTowers,
      keyObjectives: edu.keyObjectives,
      masterySummary,
    };
  }

  public static awardXp(profile: PlayerProfile, xpAmount: number): void {
    profile.xp += Math.max(0, Math.round(xpAmount));
    while (profile.xp >= ProgressionEngine.getRequiredXpForLevel(profile.level)) {
      profile.xp -= ProgressionEngine.getRequiredXpForLevel(profile.level);
      profile.level += 1;
    }
  }
}
