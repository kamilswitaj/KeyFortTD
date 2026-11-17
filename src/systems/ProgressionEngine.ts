import { MISSIONS_DATA, WORLDS_DATA } from '../data/curriculumData';
import { MissionDefinition, PlayerProfile, TowerType } from '../types';

export interface MissionOutcomeEvaluation {
  victory: boolean;
  stars: 0 | 1 | 2 | 3;
  xpEarned: number;
  leveledUp: boolean;
  newLevel: number;
  newlyUnlockedTowers: TowerType[];
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

  public static evaluateMissionResult(
    mission: MissionDefinition,
    profile: PlayerProfile,
    remainingLives: number,
    startingLives: number,
    typedCorrectChars: number,
    typingAccuracy: number,
    wpm: number,
    maxCombo: number
  ): MissionOutcomeEvaluation {
    if (remainingLives <= 0) {
      return {
        victory: false,
        stars: 0,
        xpEarned: Math.min(40, Math.floor(typedCorrectChars * 0.25)),
        leveledUp: false,
        newLevel: profile.level,
        newlyUnlockedTowers: [],
        reasonPl: 'Baza została zniszczona przez fale wrogów.',
        reasonEn: 'Your base was destroyed by enemy waves.',
      };
    }

    const isRelaxed = profile.settings.difficulty === 'relaxed';
    const minRequiredChars = isRelaxed
      ? Math.floor(mission.requiredTypedChars * 0.7)
      : mission.requiredTypedChars;
    const minAccuracy = isRelaxed
      ? Math.max(0.7, mission.targetAccuracy - 0.08)
      : mission.targetAccuracy - 0.05;

    if (typedCorrectChars < minRequiredChars) {
      return {
        victory: false,
        stars: 0,
        xpEarned: 35,
        leveledUp: false,
        newLevel: profile.level,
        newlyUnlockedTowers: [],
        reasonPl: `Wpisano za mało znaków (${typedCorrectChars}/${minRequiredChars}). Ćwiczenie pisania jest wymagane do zaliczenia misji!`,
        reasonEn: `Insufficient characters typed (${typedCorrectChars}/${minRequiredChars}). Meaningful typing practice is required!`,
      };
    }

    if (typingAccuracy < minAccuracy) {
      return {
        victory: false,
        stars: 0,
        xpEarned: 40,
        leveledUp: false,
        newLevel: profile.level,
        newlyUnlockedTowers: [],
        reasonPl: `Celność pisania (${Math.round(typingAccuracy * 100)}%) poniżej wymaganego progu (${Math.round(minAccuracy * 100)}%). Zwolnij i skup się na bezbłędności!`,
        reasonEn: `Typing accuracy (${Math.round(typingAccuracy * 100)}%) below threshold (${Math.round(minAccuracy * 100)}%). Slow down and focus on accuracy!`,
      };
    }

    // Calculate stars (1..3)
    const lifeRatio = remainingLives / Math.max(1, startingLives);
    let stars: 1 | 2 | 3 = 1;
    if (lifeRatio >= 0.9 && typingAccuracy >= mission.targetAccuracy + 0.04) {
      stars = 3;
    } else if (lifeRatio >= 0.65 && typingAccuracy >= mission.targetAccuracy) {
      stars = 2;
    }

    const baseXp = 110 + mission.globalIndex * 8 + stars * 35 + (mission.isBossMission ? 80 : 0);
    const score = Math.round(typedCorrectChars * 12 * typingAccuracy + remainingLives * 50 + maxCombo * 15);

    const prevRecord = profile.completedMissions[mission.id];
    profile.completedMissions[mission.id] = {
      missionId: mission.id,
      completed: true,
      stars: prevRecord ? (Math.max(prevRecord.stars, stars) as 1 | 2 | 3) : stars,
      bestAccuracy: prevRecord ? Math.max(prevRecord.bestAccuracy, typingAccuracy) : typingAccuracy,
      bestWpm: prevRecord ? Math.max(prevRecord.bestWpm, wpm) : wpm,
      bestScore: prevRecord ? Math.max(prevRecord.bestScore, score) : score,
      timesCompleted: (prevRecord?.timesCompleted ?? 0) + 1,
    };

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

    // Unlock reactor in World 2 alongside Frost
    if (highestWorld >= 2 && !profile.unlockedTowers.includes('reactor')) {
      profile.unlockedTowers.push('reactor');
      newlyUnlockedTowers.push('reactor');
    }

    if (highestWorld >= 2 && profile.unlockedUpgradeTiers < 2) {
      profile.unlockedUpgradeTiers = 2;
    }
    if (highestWorld >= 3 && profile.unlockedUpgradeTiers < 3) {
      profile.unlockedUpgradeTiers = 3;
    }

    return {
      victory: true,
      stars,
      xpEarned: baseXp,
      leveledUp: profile.level > oldLevel,
      newLevel: profile.level,
      newlyUnlockedTowers,
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
