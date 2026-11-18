import { MISSIONS_DATA } from '../data/curriculumData';
import { MissionDefinition, PlayerProfile } from '../types';

export type ChallengeTier = 'beginner' | 'intermediate' | 'full';
export type ChallengeKind = 'no_leak' | 'precision' | 'limited_gold' | 'two_towers' | 'boss_rush';

export interface DeterministicChallenge {
  id: string;
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
  maxLeaksAllowed: number;
  goldMultiplier: number;
  maxTowerTypes: number | null;
  techPointReward: number;
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
    descPl: '+6% obrażeń wież kinetycznych w kampanii (wyłączone w testach standaryzowanych).',
    descEn: '+6% kinetic tower damage in campaign (excluded from standardized tests).',
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
    descPl: '+2 HP twierdzy na starcie misji (wyłączone w wyzwaniach bez strat).',
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

function simpleSeedHash(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export class ChallengeEngine {
  public static getTodayKey(now = new Date()): string {
    return now.toISOString().slice(0, 10);
  }

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
    if (completed >= 24) return 'full';
    if (completed >= 8) return 'intermediate';
    return 'beginner';
  }

  public static getDailyChallenge(tier: ChallengeTier, now = new Date()): DeterministicChallenge {
    const dateKey = ChallengeEngine.getTodayKey(now);
    return ChallengeEngine.buildChallenge('daily', dateKey, tier);
  }

  public static getWeeklyChallenge(tier: ChallengeTier, now = new Date()): DeterministicChallenge {
    const dateKey = ChallengeEngine.getWeekKey(now);
    return ChallengeEngine.buildChallenge('weekly', dateKey, tier);
  }

  private static buildChallenge(
    frequency: 'daily' | 'weekly',
    dateKey: string,
    tier: ChallengeTier
  ): DeterministicChallenge {
    const seed = simpleSeedHash(`v2_${frequency}_${dateKey}_${tier}`);
    const eligibleMissions = MISSIONS_DATA.filter((m) => {
      if (tier === 'beginner') return m.worldId <= 2;
      if (tier === 'intermediate') return m.worldId <= 5;
      return true;
    });
    let chosenMission: MissionDefinition =
      eligibleMissions[seed % eligibleMissions.length] ?? MISSIONS_DATA[0];

    const kinds: ChallengeKind[] =
      frequency === 'weekly'
        ? ['boss_rush', 'no_leak', 'two_towers', 'precision']
        : ['precision', 'no_leak', 'limited_gold', 'two_towers'];
    const kind = kinds[(seed >>> 4) % kinds.length];
    if (kind === 'boss_rush') {
      const bosses = eligibleMissions.filter((m) => m.isBossMission);
      chosenMission = bosses[seed % bosses.length] ?? chosenMission;
    }

    const metaMap: Record<
      ChallengeKind,
      { titlePl: string; titleEn: string; descPl: string; descEn: string; acc: number; leaks: number; goldMult: number; maxTowers: number | null }
    > = {
      no_leak: {
        titlePl: 'Twierdza Bez Skazy',
        titleEn: 'Flawless Bastion',
        descPl: 'Ukończ misję nie tracąc ani jednego punktu HP bazy.',
        descEn: 'Complete the mission without losing a single Base HP.',
        acc: 0.85,
        leaks: 0,
        goldMult: 1.0,
        maxTowers: null,
      },
      precision: {
        titlePl: 'Mistrzostwo Precyzji',
        titleEn: 'Precision Mastery',
        descPl: 'Utrzymaj minimum 93% celności pisania przez całą bitwę.',
        descEn: 'Maintain at least 93% typing accuracy throughout the battle.',
        acc: 0.93,
        leaks: 99,
        goldMult: 1.0,
        maxTowers: null,
      },
      limited_gold: {
        titlePl: 'Oszczędny Strateg',
        titleEn: 'Frugal Tactician',
        descPl: 'Zbuduj obronę dysponując 75% standardowego złota startowego.',
        descEn: 'Hold the line starting with 75% of standard gold.',
        acc: 0.85,
        leaks: 99,
        goldMult: 0.75,
        maxTowers: null,
      },
      two_towers: {
        titlePl: 'Duet Taktyczny',
        titleEn: 'Tactical Duo',
        descPl: 'Wykorzystaj maksymalnie 2 różne typy wież podczas tej misji.',
        descEn: 'Use at most 2 distinct tower types in this mission.',
        acc: 0.85,
        leaks: 99,
        goldMult: 1.0,
        maxTowers: 2,
      },
      boss_rush: {
        titlePl: 'Polowanie na Bossa',
        titleEn: 'Boss Hunt',
        descPl: 'Pokonaj wzmocnioną falę z bossem używając tylko poznanych klawiszy.',
        descEn: 'Defeat an empowered boss mission using your learned keys.',
        acc: 0.88,
        leaks: 99,
        goldMult: 1.0,
        maxTowers: null,
      },
    };

    const meta = metaMap[kind];
    return {
      id: `${frequency}_${dateKey}_${tier}`,
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
      maxLeaksAllowed: meta.leaks,
      goldMultiplier: meta.goldMult,
      maxTowerTypes: meta.maxTowers,
      techPointReward: frequency === 'weekly' ? 2 : 1,
    };
  }
}
