import {
  DailyPracticeAggregate,
  DifficultyLevel,
  DifficultyMissionRecord,
  PlayerProfile,
  SessionHistoryEntry,
} from '../types';
import { MasteryEngine } from './MasteryEngine';

/**
 * Documented minimum sample size for competitive WPM records:
 * A session must include at least 20 correct characters and 4 seconds of active typing
 * to qualify for competitive WPM leaderboards and personal records.
 */
export const MIN_QUALIFYING_CHARS_FOR_WPM = 20;
export const MIN_QUALIFYING_DURATION_SEC = 4;
export const MAX_DAILY_AGGREGATE_DAYS = 365;

export interface FamilyComparisonRow {
  profileId: string;
  name: string;
  avatarIcon: string;
  level: number;
  completedMissions: number;
  totalStars: number;
  practiceTimeSec: number;
  totalCorrectChars: number;
  overallAccuracy: number | null; // null when 0 attempts
  recentWpm: number | null; // weighted across recent qualifying sessions
  bestQualifyingWpm: number | null;
  masteredChars: number;
  bestCombo: number;
  survivalBestWave: number;
  lastActiveAt: number;
  accuracyDelta: number | null; // recent accuracy minus earlier accuracy
  wpmDelta: number | null; // recent WPM minus earlier WPM
  defenderScore: number; // balanced family score (not speed-dominated)
}

export type FamilySortMetric =
  | 'defenderScore'
  | 'level'
  | 'completedMissions'
  | 'totalStars'
  | 'practiceTimeSec'
  | 'totalCorrectChars'
  | 'overallAccuracy'
  | 'recentWpm'
  | 'bestQualifyingWpm'
  | 'masteredChars'
  | 'bestCombo'
  | 'survivalBestWave'
  | 'lastActiveAt';

export type ComparisonDateRange = '7d' | '30d' | 'all';

export interface DailySeriesPoint {
  date: string;
  wpm: number | null;
  accuracy: number | null;
  practiceTimeSec: number;
  correctChars: number;
  missionsCompletedCumulative: number;
  masteredCount: number | null;
}

export interface MissionLeaderboardEntry {
  profileId: string;
  playerName: string;
  avatarIcon: string;
  difficulty: DifficultyLevel;
  bestScore: number;
  bestAccuracy: number;
  bestQualifyingWpm: number | null;
  stars: 0 | 1 | 2 | 3;
  maxCombo: number;
  timesCompleted: number;
  isFamilyRecord: boolean;
}

export class StatisticsEngine {
  public static formatDateKey(timestamp: number): string {
    const d = new Date(timestamp);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Computes weighted WPM from total correct characters and active typing duration in seconds.
   * Returns 0 if duration is below 1.2s or charsTyped is 0.
   */
  public static computeWeightedWpm(correctChars: number, durationSec: number): number {
    if (correctChars <= 0 || durationSec < 1.2) return 0;
    const minutes = durationSec / 60;
    const words = correctChars / 5;
    return Math.min(220, Math.round(words / minutes));
  }

  /**
   * Returns a qualifying competitive WPM only if the sample meets MIN_QUALIFYING_CHARS_FOR_WPM
   * and MIN_QUALIFYING_DURATION_SEC. Otherwise returns null.
   */
  public static computeQualifyingWpm(correctChars: number, durationSec: number): number | null {
    if (correctChars < MIN_QUALIFYING_CHARS_FOR_WPM || durationSec < MIN_QUALIFYING_DURATION_SEC) {
      return null;
    }
    return StatisticsEngine.computeWeightedWpm(correctChars, durationSec);
  }

  /**
   * Computes weighted accuracy from correct and error counts.
   * Returns null when total attempts === 0 (never falsely returns 100% for unplayed profiles).
   */
  public static computeWeightedAccuracy(correctChars: number, errorChars: number): number | null {
    const total = correctChars + errorChars;
    if (total <= 0) return null;
    return correctChars / total;
  }

  public static getOverallAccuracy(profile: PlayerProfile): number | null {
    if (profile.totalCharsTyped <= 0) return null;
    return Math.max(0, Math.min(1, profile.totalCorrectChars / profile.totalCharsTyped));
  }

  public static getTotalStars(profile: PlayerProfile): number {
    return Object.values(profile.completedMissions).reduce(
      (sum, rec) => sum + (rec.completed ? rec.stars : 0),
      0
    );
  }

  public static getBestQualifyingWpm(profile: PlayerProfile): number | null {
    let best: number | null =
      typeof profile.bestQualifyingWpm === 'number' && profile.bestQualifyingWpm > 0
        ? profile.bestQualifyingWpm
        : null;

    for (const s of profile.sessionHistory) {
      if (s.mode === 'sandbox' || s.unrestrictedResources) continue;
      const qWpm =
        s.qualifyingWpm !== undefined
          ? s.qualifyingWpm
          : StatisticsEngine.computeQualifyingWpm(s.charsTyped, s.durationSec);
      if (qWpm !== null && (best === null || qWpm > best)) {
        best = qWpm;
      }
    }

    return best;
  }

  /**
   * Computes weighted WPM across the most recent `limit` non-sandbox sessions with active typing.
   */
  public static getRecentWeightedWpm(profile: PlayerProfile, limit: number = 5): number | null {
    const validSessions = profile.sessionHistory
      .filter((s) => s.mode !== 'sandbox' && s.charsTyped > 0 && s.durationSec >= 2)
      .slice(-limit);
    if (validSessions.length === 0) return null;

    const totalChars = validSessions.reduce((acc, s) => acc + s.charsTyped, 0);
    const totalSec = validSessions.reduce((acc, s) => acc + s.durationSec, 0);
    if (totalChars < MIN_QUALIFYING_CHARS_FOR_WPM || totalSec < MIN_QUALIFYING_DURATION_SEC) {
      return null;
    }
    return StatisticsEngine.computeWeightedWpm(totalChars, totalSec);
  }

  /**
   * Computes improvement deltas between the player's earlier sessions and recent sessions.
   */
  public static getImprovementTrends(profile: PlayerProfile): {
    accuracyDelta: number | null;
    wpmDelta: number | null;
  } {
    const valid = profile.sessionHistory.filter(
      (s) => s.mode !== 'sandbox' && s.charsTyped + s.errors >= 10 && s.durationSec >= 2
    );
    if (valid.length < 2) {
      return { accuracyDelta: null, wpmDelta: null };
    }

    const mid = Math.floor(valid.length / 2);
    const earlier = valid.slice(0, mid);
    const recent = valid.slice(mid);

    const earlyCorrect = earlier.reduce((a, s) => a + s.charsTyped, 0);
    const earlyErrors = earlier.reduce((a, s) => a + s.errors, 0);
    const earlySec = earlier.reduce((a, s) => a + s.durationSec, 0);

    const recCorrect = recent.reduce((a, s) => a + s.charsTyped, 0);
    const recErrors = recent.reduce((a, s) => a + s.errors, 0);
    const recSec = recent.reduce((a, s) => a + s.durationSec, 0);

    const earlyAcc = StatisticsEngine.computeWeightedAccuracy(earlyCorrect, earlyErrors);
    const recAcc = StatisticsEngine.computeWeightedAccuracy(recCorrect, recErrors);
    const accuracyDelta =
      earlyAcc !== null && recAcc !== null ? Number(((recAcc - earlyAcc) * 100).toFixed(1)) : null;

    const earlyWpm = StatisticsEngine.computeQualifyingWpm(earlyCorrect, earlySec);
    const recWpm = StatisticsEngine.computeQualifyingWpm(recCorrect, recSec);
    const wpmDelta = earlyWpm !== null && recWpm !== null ? recWpm - earlyWpm : null;

    return { accuracyDelta, wpmDelta };
  }

  /**
   * Updates the player's compact daily aggregate (`dailyStats`) for a finalized non-sandbox session.
   */
  public static recordSessionIntoDailyStats(
    profile: PlayerProfile,
    entry: SessionHistoryEntry
  ): void {
    if (entry.mode === 'sandbox') return;
    if (entry.charsTyped <= 0 && entry.errors <= 0 && entry.durationSec <= 0) return;

    if (!profile.dailyStats) {
      profile.dailyStats = {};
    }

    const dateKey = StatisticsEngine.formatDateKey(entry.timestamp);
    const masteredNow = MasteryEngine.getMasteredCharacters(profile.characterMastery).length;
    const existing = profile.dailyStats[dateKey] ?? {
      date: dateKey,
      practiceTimeSec: 0,
      correctChars: 0,
      errorChars: 0,
      sessionsCount: 0,
      missionsCompleted: 0,
      masteredCountSnapshot: masteredNow,
    };

    existing.practiceTimeSec += Math.max(0, Math.round(entry.durationSec));
    existing.correctChars += Math.max(0, entry.charsTyped);
    existing.errorChars += Math.max(0, entry.errors);
    existing.sessionsCount += 1;
    if ((entry.status === 'victory' || entry.status === 'completed') && entry.mode === 'campaign') {
      existing.missionsCompleted += 1;
    }
    existing.masteredCountSnapshot = masteredNow;

    profile.dailyStats[dateKey] = existing;

    // Bound dailyStats to MAX_DAILY_AGGREGATE_DAYS most recent dates
    const sortedDates = Object.keys(profile.dailyStats).sort();
    if (sortedDates.length > MAX_DAILY_AGGREGATE_DAYS) {
      const toRemove = sortedDates.slice(0, sortedDates.length - MAX_DAILY_AGGREGATE_DAYS);
      for (const oldKey of toRemove) {
        delete profile.dailyStats[oldKey];
      }
    }
  }

  /**
   * Reconstructs dailyStats from existing sessionHistory during v2 -> v3 save migration
   * without inventing any fake historical data.
   */
  public static reconstructDailyStatsFromHistory(
    sessionHistory: SessionHistoryEntry[],
    masteredCount: number
  ): Record<string, DailyPracticeAggregate> {
    const map: Record<string, DailyPracticeAggregate> = {};
    for (const s of sessionHistory) {
      if (s.mode === 'sandbox') continue;
      if (s.charsTyped <= 0 && s.errors <= 0 && s.durationSec <= 0) continue;
      const dateKey = StatisticsEngine.formatDateKey(s.timestamp);
      const cur = map[dateKey] ?? {
        date: dateKey,
        practiceTimeSec: 0,
        correctChars: 0,
        errorChars: 0,
        sessionsCount: 0,
        missionsCompleted: 0,
        masteredCountSnapshot: null,
      };
      cur.practiceTimeSec += Math.max(0, Math.round(s.durationSec));
      cur.correctChars += Math.max(0, s.charsTyped);
      cur.errorChars += Math.max(0, s.errors);
      cur.sessionsCount += 1;
      if (s.mode === 'campaign' && (s.status === 'victory' || s.status === 'completed')) {
        cur.missionsCompleted += 1;
      }
      map[dateKey] = cur;
    }
    return map;
  }

  /**
   * Updates fair per-difficulty mission records for a completed campaign mission
   * (excluding sandbox and unlimited resource runs).
   */
  public static updateMissionDifficultyRecord(
    profile: PlayerProfile,
    missionId: string,
    difficulty: DifficultyLevel,
    stars: 1 | 2 | 3,
    accuracy: number,
    wpm: number,
    qualifyingWpm: number | null,
    score: number,
    maxCombo: number
  ): void {
    const rec = profile.completedMissions[missionId];
    if (!rec) return;
    if (!rec.byDifficulty) {
      rec.byDifficulty = {};
    }

    const prev = rec.byDifficulty[difficulty];
    const updated: DifficultyMissionRecord = {
      difficulty,
      completed: true,
      stars: prev ? (Math.max(prev.stars, stars) as 1 | 2 | 3) : stars,
      bestAccuracy: prev ? Math.max(prev.bestAccuracy, accuracy) : accuracy,
      bestWpm: prev ? Math.max(prev.bestWpm, wpm) : wpm,
      bestQualifyingWpm:
        qualifyingWpm !== null
          ? prev?.bestQualifyingWpm !== null && prev?.bestQualifyingWpm !== undefined
            ? Math.max(prev.bestQualifyingWpm, qualifyingWpm)
            : qualifyingWpm
          : prev?.bestQualifyingWpm ?? null,
      bestScore: prev ? Math.max(prev.bestScore, score) : score,
      maxCombo: prev ? Math.max(prev.maxCombo, maxCombo) : maxCombo,
      timesCompleted: (prev?.timesCompleted ?? 0) + 1,
    };

    rec.byDifficulty[difficulty] = updated;
    rec.maxCombo = Math.max(rec.maxCombo ?? 0, maxCombo);
    if (qualifyingWpm !== null) {
      rec.bestQualifyingWpm =
        rec.bestQualifyingWpm !== null && rec.bestQualifyingWpm !== undefined
          ? Math.max(rec.bestQualifyingWpm, qualifyingWpm)
          : qualifyingWpm;
    }
  }

  /**
   * Builds the Family Comparison Table rows for all local profiles.
   */
  public static buildFamilyComparisonRows(
    profiles: PlayerProfile[],
    sortBy: FamilySortMetric = 'defenderScore',
    descending: boolean = true
  ): FamilyComparisonRow[] {
    const rows: FamilyComparisonRow[] = profiles.map((p) => {
      const completedMissions = Object.values(p.completedMissions).filter((m) => m.completed).length;
      const totalStars = StatisticsEngine.getTotalStars(p);
      const overallAccuracy = StatisticsEngine.getOverallAccuracy(p);
      const recentWpm = StatisticsEngine.getRecentWeightedWpm(p, 5);
      const bestQualifyingWpm = StatisticsEngine.getBestQualifyingWpm(p);
      const masteredChars = MasteryEngine.getMasteredCharacters(p.characterMastery).length;
      const trends = StatisticsEngine.getImprovementTrends(p);

      const hasTypedInSessions = p.sessionHistory.some((s) => s.charsTyped > 0 || s.errors > 0);
      const lastSessionTs =
        p.sessionHistory.length > 0
          ? Math.max(...p.sessionHistory.map((s) => s.timestamp))
          : 0;
      const lastActiveAt =
        hasTypedInSessions || completedMissions > 0 || p.totalCharsTyped > 0
          ? Math.max(p.lastActiveAt, lastSessionTs)
          : 0;

      // Balanced Defender Score: rewards missions, stars, accuracy, mastered keys, and practice time (NOT raw speed)
      const accuracyBonus = overallAccuracy !== null ? Math.round(overallAccuracy * 300) : 0;
      const defenderScore =
        completedMissions * 50 +
        totalStars * 25 +
        masteredChars * 20 +
        accuracyBonus +
        Math.min(250, Math.floor(p.totalPracticeTimeSec / 30));

      return {
        profileId: p.id,
        name: p.name,
        avatarIcon: p.avatarIcon,
        level: p.level,
        completedMissions,
        totalStars,
        practiceTimeSec: p.totalPracticeTimeSec,
        totalCorrectChars: p.totalCorrectChars,
        overallAccuracy,
        recentWpm,
        bestQualifyingWpm,
        masteredChars,
        bestCombo: p.bestCombo,
        survivalBestWave: p.survivalBestWave,
        lastActiveAt,
        accuracyDelta: trends.accuracyDelta,
        wpmDelta: trends.wpmDelta,
        defenderScore,
      };
    });

    rows.sort((a, b) => {
      const valA = a[sortBy] ?? -1;
      const valB = b[sortBy] ?? -1;
      if (valA === valB) return b.defenderScore - a.defenderScore;
      return descending ? Number(valB) - Number(valA) : Number(valA) - Number(valB);
    });

    return rows;
  }

  /**
   * Builds time-series points for a player over the specified date range ('7d' | '30d' | 'all').
   */
  public static getPlayerDailySeries(
    profile: PlayerProfile,
    range: ComparisonDateRange = '30d',
    now: number = Date.now()
  ): DailySeriesPoint[] {
    const dailyMap =
      profile.dailyStats && Object.keys(profile.dailyStats).length > 0
        ? profile.dailyStats
        : StatisticsEngine.reconstructDailyStatsFromHistory(
            profile.sessionHistory,
            MasteryEngine.getMasteredCharacters(profile.characterMastery).length
          );

    const cutoffMs =
      range === '7d'
        ? now - 7 * 86400000
        : range === '30d'
        ? now - 30 * 86400000
        : 0;
    const cutoffKey = cutoffMs > 0 ? StatisticsEngine.formatDateKey(cutoffMs) : '0000-00-00';

    const dates = Object.keys(dailyMap).sort();

    let cumulativeMissions = 0;
    return dates.map((date) => {
      const item = dailyMap[date];
      cumulativeMissions += item.missionsCompleted;
      const wpm = StatisticsEngine.computeQualifyingWpm(item.correctChars, item.practiceTimeSec);
      const accuracy = StatisticsEngine.computeWeightedAccuracy(item.correctChars, item.errorChars);
      return {
        date,
        wpm,
        accuracy,
        practiceTimeSec: item.practiceTimeSec,
        correctChars: item.correctChars,
        missionsCompletedCumulative: cumulativeMissions,
        masteredCount: item.masteredCountSnapshot,
      };
    }).filter((point) => point.date >= cutoffKey);
  }

  /**
   * Builds a fair per-mission leaderboard comparing players under comparable difficulty conditions.
   */
  public static getMissionLeaderboard(
    profiles: PlayerProfile[],
    missionId: string,
    difficultyFilter: DifficultyLevel | 'all' = 'standard'
  ): MissionLeaderboardEntry[] {
    const entries: MissionLeaderboardEntry[] = [];

    for (const p of profiles) {
      const mRec = p.completedMissions[missionId];
      if (!mRec || !mRec.completed) continue;

      if (difficultyFilter !== 'all') {
        const diffRec = mRec.byDifficulty?.[difficultyFilter];
        if (diffRec && diffRec.completed) {
          entries.push({
            profileId: p.id,
            playerName: p.name,
            avatarIcon: p.avatarIcon,
            difficulty: difficultyFilter,
            bestScore: diffRec.bestScore,
            bestAccuracy: diffRec.bestAccuracy,
            bestQualifyingWpm: diffRec.bestQualifyingWpm,
            stars: diffRec.stars,
            maxCombo: diffRec.maxCombo,
            timesCompleted: diffRec.timesCompleted,
            isFamilyRecord: false,
          });
        }
      } else {
        // 'all' difficulties: pick the player's highest-scoring difficulty record or overall record
        const diffEntries = mRec.byDifficulty ? Object.values(mRec.byDifficulty).filter(Boolean) : [];
        if (diffEntries.length > 0) {
          const bestDiff = diffEntries.sort((a, b) => b!.bestScore - a!.bestScore)[0]!;
          entries.push({
            profileId: p.id,
            playerName: p.name,
            avatarIcon: p.avatarIcon,
            difficulty: bestDiff.difficulty,
            bestScore: bestDiff.bestScore,
            bestAccuracy: bestDiff.bestAccuracy,
            bestQualifyingWpm: bestDiff.bestQualifyingWpm,
            stars: bestDiff.stars,
            maxCombo: bestDiff.maxCombo,
            timesCompleted: mRec.timesCompleted,
            isFamilyRecord: false,
          });
        }
      }
    }

    entries.sort((a, b) => {
      if (b.bestScore !== a.bestScore) return b.bestScore - a.bestScore;
      return b.bestAccuracy - a.bestAccuracy;
    });

    if (entries.length > 0 && difficultyFilter !== 'all') {
      entries[0].isFamilyRecord = true;
    }

    return entries;
  }
}
