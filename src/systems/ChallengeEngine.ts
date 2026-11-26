import { MISSIONS_DATA } from '../data/curriculumData';
import {
  ChallengeCompletionRecord,
  DifficultyLevel,
  MissionDefinition,
  PlayerProfile,
  TowerType,
  WaveDefinition,
} from '../types';

export const CHALLENGE_RULESET_VERSION = 1;

export type ChallengeTier = 'home_anchors' | 'beginner' | 'intermediate' | 'full';
export type ChallengeKind = 'no_leak' | 'precision' | 'limited_gold' | 'two_towers' | 'boss_rush';

export interface DeterministicChallenge {
  id: string;
  rulesetVersion: number;
  seed: number;
  frequency: 'daily' | 'weekly';
  dateKey: string;
  tier: ChallengeTier;
  kind: ChallengeKind;
  titlePl: string;
  titleEn: string;
  descPl: string;
  descEn: string;
  missionId: string;
  targetAccuracy: number;
  minTypedChars: number;
  maxLeaksAllowed: number;
  goldMultiplier: number;
  maxTowerTypes: number | null;
  techPointReward: number;
  bossHpMultiplier: number;
}

export interface ChallengeSessionConfig {
  challengeId: string;
  rulesetVersion: number;
  seed: number;
  frequency: 'daily' | 'weekly';
  dateKey: string;
  tier: ChallengeTier;
  kind: ChallengeKind;
  sourceMissionId: string;
  mapId: string;
  allowedKeys: string[];
  waves: WaveDefinition[];
  startingGold: number;
  startingEnergy: number;
  startingLives: number;
  allowedTowers: TowerType[];
  maxUpgradeTier: number;
  heroAllowed: boolean;
  techAllowed: boolean;
  difficulty: DifficultyLevel;
  techPointReward: number;
  completionCriteria: {
    targetAccuracy: number;
    minTypedChars: number;
    maxLeaksAllowed: number;
    maxTowerTypes: number | null;
  };
}

export interface ChallengeLeaderboardEntry {
  profileId: string;
  playerName: string;
  avatarIcon: string;
  score: number;
  accuracy: number;
  wpm: number;
  difficulty: DifficultyLevel;
  timestamp: number;
}

export interface TechNodeDefinition {
  id: string;
  branch: 'kinetic' | 'energy' | 'control' | 'defense' | 'hero';
  namePl: string;
  nameEn: string;
  descPl: string;
  descEn: string;
  cost: number;
}

export const TECH_TREE_DATA: TechNodeDefinition[] = [
  {
    id: 'tech_kinetic_1',
    branch: 'kinetic',
    namePl: 'Utwardzone Lufy',
    nameEn: 'Hardened Barrels',
    descPl: '+6% obrażeń wież kinetycznych (CKM, Działo, Snajper, Drony) w kampanii i przetrwaniu.',
    descEn: '+6% kinetic tower damage (Gun, Cannon, Sniper, Drone) in Campaign & Survival.',
    cost: 1,
  },
  {
    id: 'tech_energy_1',
    branch: 'energy',
    namePl: 'Ogniwa Rezonansowe',
    nameEn: 'Resonant Cells',
    descPl: '+10 początkowej energii na starcie misji.',
    descEn: '+10 starting energy at mission launch.',
    cost: 1,
  },
  {
    id: 'tech_control_1',
    branch: 'control',
    namePl: 'Katalizator Mrozu',
    nameEn: 'Cryo Catalyst',
    descPl: '+10% czasu działania spowolnienia i podpalenia.',
    descEn: '+10% slow and burn effect duration.',
    cost: 1,
  },
  {
    id: 'tech_defense_1',
    branch: 'defense',
    namePl: 'Wzmocnione Mury',
    nameEn: 'Reinforced Bastion',
    descPl: '+2 HP twierdzy na starcie misji (wyłączone w wyzwaniach Bez Skazy).',
    descEn: '+2 starting fortress HP (disabled in No-Leak challenges).',
    cost: 1,
  },
  {
    id: 'tech_hero_1',
    branch: 'hero',
    namePl: 'Taktyczne Dowodzenie',
    nameEn: 'Tactical Command',
    descPl: 'Bohater zdobywa +20% więcej doświadczenia z fal.',
    descEn: 'Hero earns +20% bonus XP from waves.',
    cost: 1,
  },
];

function fnv1aHash(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const TIER_ORDER: ChallengeTier[] = ['home_anchors', 'beginner', 'intermediate', 'full'];

export class ChallengeEngine {
  /**
   * Uses UTC calendar date (YYYY-MM-DD) so all players/locales rotate on the same deterministic boundary.
   */
  public static getTodayKey(now = new Date()): string {
    return now.toISOString().slice(0, 10);
  }

  /**
   * Uses ISO-8601 UTC week (YYYY-Www) so week boundaries are deterministic across timezones and year transitions.
   */
  public static getWeekKey(now = new Date()): string {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
    return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
  }

  public static getPlayerEligibleTier(profile: PlayerProfile): ChallengeTier {
    const completed = Object.values(profile.completedMissions).filter((m) => m.completed).length;
    if (completed >= 36) return 'full';
    if (completed >= 18) return 'intermediate';
    if (completed >= 6) return 'beginner';
    return 'home_anchors';
  }

  public static getSelectableTiersForPlayer(profile: PlayerProfile): ChallengeTier[] {
    const maxTier = ChallengeEngine.getPlayerEligibleTier(profile);
    const maxIdx = TIER_ORDER.indexOf(maxTier);
    return TIER_ORDER.slice(0, maxIdx + 1);
  }

  public static isTierEligible(profile: PlayerProfile, tier: ChallengeTier): boolean {
    const maxTier = ChallengeEngine.getPlayerEligibleTier(profile);
    return TIER_ORDER.indexOf(tier) <= TIER_ORDER.indexOf(maxTier);
  }

  public static getDailyChallenge(tier: ChallengeTier, now = new Date()): DeterministicChallenge {
    const dateKey = ChallengeEngine.getTodayKey(now);
    return ChallengeEngine.buildChallenge('daily', dateKey, tier);
  }

  public static getWeeklyChallenge(tier: ChallengeTier, now = new Date()): DeterministicChallenge {
    const dateKey = ChallengeEngine.getWeekKey(now);
    return ChallengeEngine.buildChallenge('weekly', dateKey, tier);
  }

  private static getEligibleMissionsForTier(tier: ChallengeTier, bossOnly: boolean): MissionDefinition[] {
    const pool = MISSIONS_DATA.filter((m) => {
      if (tier === 'home_anchors') return m.worldId === 1 && m.missionIndex <= 2;
      if (tier === 'beginner') return m.worldId <= 2;
      if (tier === 'intermediate') return m.worldId <= 5;
      return true;
    });
    if (!bossOnly) return pool;
    const bossPool = pool.filter((m) => m.isBossMission);
    if (bossPool.length > 0) return bossPool;
    // Fallback for home_anchors where no boss mission exists in w1_m1..w1_m2: use w1_m6 only when beginner+, else non-boss
    return pool;
  }

  private static buildChallenge(
    frequency: 'daily' | 'weekly',
    dateKey: string,
    tier: ChallengeTier
  ): DeterministicChallenge {
    const seed = fnv1aHash(`v${CHALLENGE_RULESET_VERSION}_${frequency}_${dateKey}_${tier}`);

    // home_anchors has no boss missions, so exclude boss_rush there to preserve curriculum safety
    const kinds: ChallengeKind[] =
      tier === 'home_anchors'
        ? ['precision', 'no_leak', 'limited_gold', 'two_towers']
        : frequency === 'weekly'
        ? ['boss_rush', 'no_leak', 'two_towers', 'precision']
        : ['precision', 'no_leak', 'limited_gold', 'two_towers'];

    const kind = kinds[(seed >>> 4) % kinds.length];
    const eligibleMissions = ChallengeEngine.getEligibleMissionsForTier(tier, kind === 'boss_rush');
    const chosenMission = eligibleMissions[seed % eligibleMissions.length] ?? MISSIONS_DATA[0];

    const metaMap: Record<
      ChallengeKind,
      {
        titlePl: string;
        titleEn: string;
        descPl: string;
        descEn: string;
        acc: number;
        leaks: number;
        goldMult: number;
        maxTowers: number | null;
        bossMult: number;
      }
    > = {
      no_leak: {
        titlePl: 'Twierdza Bez Skazy',
        titleEn: 'Flawless Bastion',
        descPl: 'Ukończ misję nie tracąc ani jednego punktu HP bazy.',
        descEn: 'Complete the mission without taking any Base HP damage.',
        acc: Math.max(0.85, chosenMission.targetAccuracy),
        leaks: 0,
        goldMult: 1.0,
        maxTowers: null,
        bossMult: 1.0,
      },
      precision: {
        titlePl: 'Mistrzostwo Precyzji',
        titleEn: 'Precision Mastery',
        descPl: 'Utrzymaj minimum 93% celności pisania i wpisz wymaganą liczbę znaków.',
        descEn: 'Maintain at least 93% typing accuracy and type the required characters.',
        acc: 0.93,
        leaks: 99,
        goldMult: 1.0,
        maxTowers: null,
        bossMult: 1.0,
      },
      limited_gold: {
        titlePl: 'Oszczędny Strateg',
        titleEn: 'Frugal Tactician',
        descPl: 'Zbuduj obronę dysponując 75% standardowego złota startowego.',
        descEn: 'Hold the line starting with 75% of standard starting gold.',
        acc: Math.max(0.85, chosenMission.targetAccuracy),
        leaks: 99,
        goldMult: 0.75,
        maxTowers: null,
        bossMult: 1.0,
      },
      two_towers: {
        titlePl: 'Duet Taktyczny',
        titleEn: 'Tactical Duo',
        descPl: 'Wykorzystaj maksymalnie 2 różne typy wież podczas całej misji.',
        descEn: 'Use at most 2 distinct tower types across the entire mission.',
        acc: Math.max(0.85, chosenMission.targetAccuracy),
        leaks: 99,
        goldMult: 1.0,
        maxTowers: 2,
        bossMult: 1.0,
      },
      boss_rush: {
        titlePl: 'Polowanie na Bossa',
        titleEn: 'Boss Hunt',
        descPl: 'Pokonaj wzmocnionego Bossa (+25% HP) używając wyłącznie poznanych klawiszy.',
        descEn: 'Defeat an empowered Boss (+25% HP) using only learned keys.',
        acc: Math.max(0.88, chosenMission.targetAccuracy),
        leaks: 99,
        goldMult: 1.0,
        maxTowers: null,
        bossMult: 1.25,
      },
    };

    const meta = metaMap[kind];
    return {
      id: `${frequency}_${dateKey}_${tier}_v${CHALLENGE_RULESET_VERSION}`,
      rulesetVersion: CHALLENGE_RULESET_VERSION,
      seed,
      frequency,
      dateKey,
      tier,
      kind,
      titlePl: meta.titlePl,
      titleEn: meta.titleEn,
      descPl: meta.descPl,
      descEn: meta.descEn,
      missionId: chosenMission.id,
      targetAccuracy: meta.acc,
      minTypedChars: chosenMission.requiredTypedChars,
      maxLeaksAllowed: meta.leaks,
      goldMultiplier: meta.goldMult,
      maxTowerTypes: meta.maxTowers,
      techPointReward: frequency === 'weekly' ? 2 : 1,
      bossHpMultiplier: meta.bossMult,
    };
  }

  public static buildChallengeSessionConfig(
    challenge: DeterministicChallenge,
    difficulty: DifficultyLevel = 'standard'
  ): ChallengeSessionConfig {
    const mission = MISSIONS_DATA.find((m) => m.id === challenge.missionId) ?? MISSIONS_DATA[0];
    const allowedTowersByTier: Record<ChallengeTier, TowerType[]> = {
      home_anchors: ['gun', 'cannon'],
      beginner: ['gun', 'cannon', 'frost', 'reactor', 'flame'],
      intermediate: ['gun', 'cannon', 'frost', 'reactor', 'flame', 'tesla', 'drone', 'command', 'sniper'],
      full: ['gun', 'cannon', 'frost', 'reactor', 'flame', 'tesla', 'drone', 'command', 'sniper', 'laser'],
    };

    const waves: WaveDefinition[] = mission.waves.map((w) => ({
      ...w,
      groups: w.groups.map((g) => ({
        ...g,
        hpScale:
          g.enemyType === 'boss'
            ? (g.hpScale ?? 1) * challenge.bossHpMultiplier
            : g.hpScale,
      })),
    }));

    return {
      challengeId: challenge.id,
      rulesetVersion: challenge.rulesetVersion,
      seed: challenge.seed,
      frequency: challenge.frequency,
      dateKey: challenge.dateKey,
      tier: challenge.tier,
      kind: challenge.kind,
      sourceMissionId: mission.id,
      mapId: mission.mapId,
      allowedKeys: [...mission.allowedKeys],
      waves,
      startingGold: Math.max(80, Math.round(mission.startingGold * challenge.goldMultiplier)),
      startingEnergy: 50,
      startingLives: mission.startingLives,
      allowedTowers: allowedTowersByTier[challenge.tier],
      maxUpgradeTier: challenge.tier === 'home_anchors' ? 1 : challenge.tier === 'beginner' ? 2 : 3,
      heroAllowed: false,
      techAllowed: false,
      difficulty,
      techPointReward: challenge.techPointReward,
      completionCriteria: {
        targetAccuracy: challenge.targetAccuracy,
        minTypedChars: challenge.minTypedChars,
        maxLeaksAllowed: challenge.maxLeaksAllowed,
        maxTowerTypes: challenge.maxTowerTypes,
      },
    };
  }

  public static evaluateChallengeCompletion(
    config: ChallengeSessionConfig,
    metrics: {
      remainingLives: number;
      cumulativeBaseDamage: number;
      correctChars: number;
      accuracy: number;
      usedTowerTypes: TowerType[];
    }
  ): { passed: boolean; reasonPl?: string; reasonEn?: string } {
    if (metrics.remainingLives <= 0) {
      return {
        passed: false,
        reasonPl: 'Twierdza została zniszczona.',
        reasonEn: 'Your bastion was destroyed.',
      };
    }
    if (metrics.cumulativeBaseDamage > config.completionCriteria.maxLeaksAllowed) {
      return {
        passed: false,
        reasonPl: `Baza otrzymała obrażenia (${metrics.cumulativeBaseDamage} HP) w wyzwaniu Bez Skazy.`,
        reasonEn: `Base took ${metrics.cumulativeBaseDamage} damage in a Flawless Bastion challenge.`,
      };
    }
    if (
      config.completionCriteria.maxTowerTypes !== null &&
      metrics.usedTowerTypes.length > config.completionCriteria.maxTowerTypes
    ) {
      return {
        passed: false,
        reasonPl: `Użyto zbyt wielu typów wież (${metrics.usedTowerTypes.length}/${config.completionCriteria.maxTowerTypes}).`,
        reasonEn: `Used too many tower types (${metrics.usedTowerTypes.length}/${config.completionCriteria.maxTowerTypes}).`,
      };
    }
    if (metrics.correctChars < config.completionCriteria.minTypedChars) {
      return {
        passed: false,
        reasonPl: `Za mało poprawnych znaków (${metrics.correctChars}/${config.completionCriteria.minTypedChars}).`,
        reasonEn: `Insufficient typed characters (${metrics.correctChars}/${config.completionCriteria.minTypedChars}).`,
      };
    }
    if (metrics.accuracy < config.completionCriteria.targetAccuracy) {
      return {
        passed: false,
        reasonPl: `Celność (${Math.round(metrics.accuracy * 100)}%) poniżej progu (${Math.round(config.completionCriteria.targetAccuracy * 100)}%).`,
        reasonEn: `Accuracy (${Math.round(metrics.accuracy * 100)}%) below threshold (${Math.round(config.completionCriteria.targetAccuracy * 100)}%).`,
      };
    }
    return { passed: true };
  }

  public static recordChallengeCompletion(
    profile: PlayerProfile,
    config: ChallengeSessionConfig,
    record: ChallengeCompletionRecord
  ): { awardedTechPoints: number } {
    if (!profile.challengeHistory) profile.challengeHistory = [];
    profile.challengeHistory.unshift(record);
    profile.challengeHistory = profile.challengeHistory.slice(0, 60);

    if (record.status !== 'completed') {
      return { awardedTechPoints: 0 };
    }

    if (!profile.completedChallenges) profile.completedChallenges = {};
    const prev = profile.completedChallenges[config.challengeId];
    let awardedTechPoints = 0;
    if (!prev) {
      awardedTechPoints = config.techPointReward;
      profile.techPoints = (profile.techPoints ?? 0) + awardedTechPoints;
    }

    if (!prev || record.score > prev.score) {
      profile.completedChallenges[config.challengeId] = {
        score: record.score,
        accuracy: record.accuracy,
        timestamp: record.timestamp,
        rulesetVersion: config.rulesetVersion,
        difficulty: config.difficulty,
        wpm: record.wpm,
        baseDamage: record.baseDamage,
        wavesCompleted: record.wavesCompleted,
        towerTypesUsed: [...record.towerTypesUsed],
      };
    }

    return { awardedTechPoints };
  }

  public static getChallengeLeaderboard(
    allProfiles: PlayerProfile[],
    challengeId: string,
    rulesetVersion: number = CHALLENGE_RULESET_VERSION
  ): ChallengeLeaderboardEntry[] {
    const entries: ChallengeLeaderboardEntry[] = [];
    for (const p of allProfiles) {
      const rec = p.completedChallenges?.[challengeId];
      if (!rec) continue;
      if ((rec.rulesetVersion ?? 1) !== rulesetVersion) continue;
      entries.push({
        profileId: p.id,
        playerName: p.name,
        avatarIcon: p.avatarIcon,
        score: rec.score,
        accuracy: rec.accuracy,
        wpm: rec.wpm ?? 0,
        difficulty: rec.difficulty ?? 'standard',
        timestamp: rec.timestamp,
      });
    }
    return entries.sort((a, b) => b.score - a.score || b.accuracy - a.accuracy);
  }
}
