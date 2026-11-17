import { ACHIEVEMENTS_DATA } from '../data/achievementsData';
import { MISSIONS_DATA } from '../data/curriculumData';
import { HOME_ROW_KEYS, POLISH_DIACRITICS } from '../data/keyboardData';
import { AchievementDefinition, ActiveTower, PlayerProfile } from '../types';
import { ProgressionEngine } from './ProgressionEngine';

export interface AchievementCheckContext {
  missionWon?: boolean;
  isBossMission?: boolean;
  remainingLives?: number;
  startingLives?: number;
  typingAccuracy?: number;
  maxCombo?: number;
  activeTowers?: ActiveTower[];
  survivalWaveReached?: number;
}

export class AchievementSystem {
  public static evaluateAndUnlock(
    profile: PlayerProfile,
    ctx: AchievementCheckContext = {}
  ): AchievementDefinition[] {
    const newlyUnlocked: AchievementDefinition[] = [];
    const unlockedSet = new Set(profile.achievements);

    const grant = (id: string) => {
      if (unlockedSet.has(id)) return;
      const def = ACHIEVEMENTS_DATA.find((a) => a.id === id);
      if (!def) return;
      unlockedSet.add(id);
      profile.achievements.push(id);
      ProgressionEngine.awardXp(profile, def.xpReward);
      if (def.cosmeticRewardId && !profile.unlockedCosmetics.includes(def.cosmeticRewardId)) {
        profile.unlockedCosmetics.push(def.cosmeticRewardId);
      }
      newlyUnlocked.push(def);
    };

    const completedCount = Object.values(profile.completedMissions).filter((m) => m.completed).length;

    // 1. First Defense
    if (completedCount >= 1 || ctx.missionWon) {
      grant('first_defense');
    }

    // 2. Perfect Wave
    if (
      ctx.missionWon &&
      ctx.remainingLives !== undefined &&
      ctx.startingLives !== undefined &&
      ctx.remainingLives >= ctx.startingLives &&
      (ctx.typingAccuracy ?? 0) >= 0.96
    ) {
      grant('perfect_wave');
    }

    // 3. Home Row Master
    const world2Completed = MISSIONS_DATA.filter((m) => m.worldId <= 2).every(
      (m) => profile.completedMissions[m.id]?.completed
    );
    const homeRowMastered = HOME_ROW_KEYS.every((k) => profile.characterMastery[k]?.status === 'mastered');
    if (world2Completed || homeRowMastered) {
      grant('home_row_master');
    }

    // 4. Polish Keyboard Master
    const world6Completed = MISSIONS_DATA.filter((m) => m.worldId === 6).every(
      (m) => profile.completedMissions[m.id]?.completed
    );
    const diacriticsMastered = POLISH_DIACRITICS.every((k) => profile.characterMastery[k]?.status === 'mastered');
    if (world6Completed || diacriticsMastered) {
      grant('polish_keyboard_master');
    }

    // 5. Combo 50 & Combo 100
    const bestCombo = Math.max(profile.bestCombo, ctx.maxCombo ?? 0);
    if (bestCombo >= 50) {
      grant('combo_50');
    }
    if (bestCombo >= 100) {
      grant('combo_100');
    }

    // 6. Tactical Genius (4+ distinct tower types on map on victory)
    if (ctx.missionWon && ctx.activeTowers) {
      const distinctTypes = new Set(ctx.activeTowers.map((t) => t.type));
      if (distinctTypes.size >= 4) {
        grant('tactical_genius');
      }
    }

    // 7. Tier 3 Specialist
    if (ctx.activeTowers) {
      const hasTier3 = ctx.activeTowers.some(
        (t) => t.upgrades.damage === 3 || t.upgrades.speed === 3 || t.upgrades.special === 3
      );
      if (hasTier3) {
        grant('tier3_specialist');
      }
    }

    // 8. Boss Destroyer
    if (ctx.missionWon && ctx.isBossMission) {
      grant('boss_destroyer');
    }

    // 9. Survival Veteran
    if (Math.max(profile.survivalBestWave, ctx.survivalWaveReached ?? 0) >= 10) {
      grant('survival_10');
    }

    // 10. Campaign Complete
    if (completedCount >= 48) {
      grant('campaign_complete');
    }

    return newlyUnlocked;
  }
}
