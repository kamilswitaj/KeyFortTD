import { BigramStats, CharacterStats, MasteryStatus } from '../types';

export const MIN_ATTEMPTS_FOR_MASTERY = 20;
export const MIN_ACCURACY_FOR_MASTERY = 0.9;
export const MAX_REACTION_MS_FOR_MASTERY = 950;

export class MasteryEngine {
  public static createEmptyCharacterStats(char: string): CharacterStats {
    return {
      char,
      attempts: 0,
      correct: 0,
      errors: 0,
      avgReactionMs: 650,
      bestReactionMs: 9999,
      lastPracticedAt: 0,
      nextReviewAt: 0,
      consecutiveCorrect: 0,
      confusedWith: {},
      masteryScore: 0,
      status: 'learning',
    };
  }

  public static recordKeystroke(
    masteryMap: Record<string, CharacterStats>,
    bigramMap: Record<string, BigramStats>,
    expectedChar: string,
    typedChar: string,
    reactionMs: number,
    previousChar: string | null,
    timestamp: number = Date.now()
  ): {
    updatedCharStats: CharacterStats;
    isCorrect: boolean;
  } {
    const clampedReaction = Math.max(60, Math.min(4000, reactionMs));
    const existing = masteryMap[expectedChar] ?? MasteryEngine.createEmptyCharacterStats(expectedChar);
    const isCorrect = expectedChar === typedChar;

    const attempts = existing.attempts + 1;
    const correct = existing.correct + (isCorrect ? 1 : 0);
    const errors = existing.errors + (isCorrect ? 0 : 1);
    const consecutiveCorrect = isCorrect ? existing.consecutiveCorrect + 1 : 0;

    // Exponential moving average for reaction time
    const alpha = existing.attempts === 0 ? 1 : 0.22;
    const avgReactionMs = isCorrect
      ? Math.round(existing.avgReactionMs * (1 - alpha) + clampedReaction * alpha)
      : Math.round(existing.avgReactionMs * 1.05);

    const bestReactionMs = isCorrect ? Math.min(existing.bestReactionMs, clampedReaction) : existing.bestReactionMs;

    const confusedWith = { ...existing.confusedWith };
    if (!isCorrect && typedChar.length === 1) {
      confusedWith[typedChar] = (confusedWith[typedChar] ?? 0) + 1;
    }

    const masteryScore = MasteryEngine.computeMasteryScore(attempts, correct, avgReactionMs, consecutiveCorrect);
    const status = MasteryEngine.computeMasteryStatus(attempts, correct, avgReactionMs, masteryScore);

    // Spaced repetition interval: grows with masteryScore & consecutiveCorrect, shrinks on error
    const reviewIntervalMs = isCorrect
      ? Math.min(1000 * 60 * 60 * 48, 1000 * 30 * Math.pow(1.45, Math.min(12, Math.floor(masteryScore / 10))))
      : 1000 * 15;

    const updated: CharacterStats = {
      char: expectedChar,
      attempts,
      correct,
      errors,
      avgReactionMs,
      bestReactionMs,
      lastPracticedAt: timestamp,
      nextReviewAt: timestamp + reviewIntervalMs,
      consecutiveCorrect,
      confusedWith,
      masteryScore,
      status,
    };

    masteryMap[expectedChar] = updated;

    // Track bigram transition if applicable
    if (previousChar && previousChar !== ' ' && expectedChar !== ' ') {
      const bigramKey = `${previousChar}${expectedChar}`;
      const prevBigram = bigramMap[bigramKey] ?? {
        bigram: bigramKey,
        attempts: 0,
        correct: 0,
        errors: 0,
        avgTransitionMs: 500,
      };
      const bAttempts = prevBigram.attempts + 1;
      const bCorrect = prevBigram.correct + (isCorrect ? 1 : 0);
      const bErrors = prevBigram.errors + (isCorrect ? 0 : 1);
      const bAvg =
        prevBigram.attempts === 0
          ? clampedReaction
          : Math.round(prevBigram.avgTransitionMs * 0.8 + clampedReaction * 0.2);

      bigramMap[bigramKey] = {
        bigram: bigramKey,
        attempts: bAttempts,
        correct: bCorrect,
        errors: bErrors,
        avgTransitionMs: bAvg,
      };
    }

    return { updatedCharStats: updated, isCorrect };
  }

  public static computeMasteryScore(
    attempts: number,
    correct: number,
    avgReactionMs: number,
    consecutiveCorrect: number
  ): number {
    if (attempts === 0) return 0;
    const accuracy = correct / attempts;
    // Experience factor prevents high score after only 1-5 attempts
    const volumeFactor = Math.min(1, attempts / MIN_ATTEMPTS_FOR_MASTERY);
    const accuracyComponent = Math.max(0, (accuracy - 0.5) * 2) * 65; // up to 65 pts
    // Speed component: 250ms -> 25 pts, 1000ms -> 5 pts
    const speedFactor = Math.max(0, Math.min(1, (1150 - avgReactionMs) / 900));
    const speedComponent = speedFactor * 25;
    const streakComponent = Math.min(10, consecutiveCorrect * 0.5);

    const rawScore = (accuracyComponent + speedComponent + streakComponent) * volumeFactor;
    return Math.max(0, Math.min(100, Math.round(rawScore)));
  }

  public static computeMasteryStatus(
    attempts: number,
    correct: number,
    avgReactionMs: number,
    masteryScore: number
  ): MasteryStatus {
    if (attempts === 0) return 'locked';
    const accuracy = correct / attempts;
    if (
      attempts >= MIN_ATTEMPTS_FOR_MASTERY &&
      accuracy >= MIN_ACCURACY_FOR_MASTERY &&
      avgReactionMs <= MAX_REACTION_MS_FOR_MASTERY &&
      masteryScore >= 78
    ) {
      return 'mastered';
    }
    if (attempts >= 8 && accuracy >= 0.78) {
      return 'practicing';
    }
    return 'learning';
  }

  public static getProblematicCharacters(
    masteryMap: Record<string, CharacterStats>,
    allowedKeys: string[]
  ): CharacterStats[] {
    const allowedSet = new Set(allowedKeys);
    return Object.values(masteryMap)
      .filter((stat) => allowedSet.has(stat.char) && stat.char !== ' ' && stat.attempts >= 3)
      .filter((stat) => {
        const acc = stat.correct / stat.attempts;
        return acc < 0.88 || stat.avgReactionMs > 780 || stat.status !== 'mastered';
      })
      .sort((a, b) => a.masteryScore - b.masteryScore);
  }

  public static getMasteredCharacters(masteryMap: Record<string, CharacterStats>): CharacterStats[] {
    return Object.values(masteryMap)
      .filter((stat) => stat.char !== ' ' && stat.status === 'mastered')
      .sort((a, b) => b.masteryScore - a.masteryScore);
  }
}
