import {
  ALPHANUMERIC_CODES,
  REAL_WORDS_EN,
  REAL_WORDS_PL,
  SENTENCES_EN,
  SENTENCES_PL,
  SYLLABLES_BANK,
} from '../data/curriculumData';
import { lookupCharKey } from '../data/keyboardData';
import {
  CharacterStats,
  ExerciseCategory,
  Language,
  MissionDefinition,
  TypingPromptItem,
} from '../types';
import { SeededRandom } from '../utils/rng';

export class AdaptiveLearningEngine {
  /**
   * Checks whether every character in `candidate` belongs to `allowedSet`.
   */
  public static isStringAllowed(candidate: string, allowedSet: ReadonlySet<string>): boolean {
    if (!candidate || candidate.length === 0) return false;
    for (let i = 0; i < candidate.length; i++) {
      const ch = candidate[i];
      if (!allowedSet.has(ch)) {
        return false;
      }
    }
    return true;
  }

  /**
   * Computes adaptive selection weights for each allowed non-space key.
   */
  public static computeCharacterWeights(
    allowedKeys: string[],
    newKeys: string[],
    masteryMap: Record<string, CharacterStats>,
    now: number = Date.now()
  ): Map<string, number> {
    const weights = new Map<string, number>();
    const newSet = new Set(newKeys);

    for (const key of allowedKeys) {
      if (key === ' ') continue;
      let weight = 1.0;

      // Boost newly introduced keys in the current mission
      if (newSet.has(key)) {
        weight += 3.2;
      }

      const stat = masteryMap[key];
      if (!stat || stat.attempts < 5) {
        // Unpracticed or barely practiced key
        weight += 2.2;
      } else {
        const accuracy = stat.correct / stat.attempts;
        if (accuracy < 0.8) {
          weight += 3.5;
        } else if (accuracy < 0.9) {
          weight += 1.8;
        }

        if (stat.avgReactionMs > 850) {
          weight += 1.8;
        } else if (stat.avgReactionMs > 650) {
          weight += 0.9;
        }

        // Spaced repetition reinforcement for mastered keys due for review
        if (stat.status === 'mastered') {
          if (stat.nextReviewAt <= now) {
            weight += 1.4;
          } else {
            weight = Math.max(0.6, weight * 0.65);
          }
        }
      }

      weights.set(key, weight);
    }

    return weights;
  }

  public static pickWeightedKey(weights: Map<string, number>, rng: SeededRandom): string {
    const entries = Array.from(weights.entries());
    if (entries.length === 0) return 'f';
    let total = 0;
    for (const [, w] of entries) total += w;
    let roll = rng.next() * total;
    for (const [k, w] of entries) {
      roll -= w;
      if (roll <= 0) return k;
    }
    return entries[entries.length - 1][0];
  }

  /**
   * Generates a tailored batch of typing exercises for a mission or survival/sandbox run.
   */
  public static generateExerciseBatch(
    mission: Pick<
      MissionDefinition,
      'id' | 'worldId' | 'missionIndex' | 'newKeys' | 'allowedKeys' | 'focusCategories'
    >,
    masteryMap: Record<string, CharacterStats>,
    language: Language = 'pl',
    count: number = 12,
    seed: number | string = `${mission.id}_batch`,
    now: number = Date.now()
  ): TypingPromptItem[] {
    const rng = new SeededRandom(seed);
    const allowedSet = new Set(mission.allowedKeys);
    const newKeys = mission.newKeys.filter((key) => allowedSet.has(key));
    if (!mission.allowedKeys.some((key) => key !== ' ')) return [];
    const hasSpace = allowedSet.has(' ');
    const weights = AdaptiveLearningEngine.computeCharacterWeights(
      mission.allowedKeys,
      newKeys,
      masteryMap,
      now
    );

    // Filter word and sentence banks strictly by allowedSet
    const primaryWords = (language === 'pl' ? [...REAL_WORDS_PL, ...REAL_WORDS_EN] : [...REAL_WORDS_EN, ...REAL_WORDS_PL])
      .map((w) => w.trim())
      .filter((w) => AdaptiveLearningEngine.isStringAllowed(w, allowedSet));

    const allowedSyllables = SYLLABLES_BANK.filter((s) => AdaptiveLearningEngine.isStringAllowed(s, allowedSet));
    const allowedCodes = ALPHANUMERIC_CODES.filter((c) => AdaptiveLearningEngine.isStringAllowed(c, allowedSet));
    const rawSentences = language === 'pl' ? [...SENTENCES_PL, ...SENTENCES_EN] : [...SENTENCES_EN, ...SENTENCES_PL];
    const allowedSentences = rawSentences.filter((s) => AdaptiveLearningEngine.isStringAllowed(s, allowedSet));

    const items: TypingPromptItem[] = [];

    for (let i = 0; i < count; i++) {
      // First 2 items of a mission with newKeys are always introductory drills on the new keys
      const forceIntroDrill = i < 2 && newKeys.some((k) => k !== ' ');
      const category: ExerciseCategory = forceIntroDrill
        ? 'drill'
        : mission.focusCategories[i % mission.focusCategories.length] ?? 'drill';

      const prompt = AdaptiveLearningEngine.buildSinglePrompt(
        i,
        category,
        newKeys,
        mission.allowedKeys,
        allowedSet,
        hasSpace,
        weights,
        primaryWords,
        allowedSyllables,
        allowedCodes,
        allowedSentences,
        rng
      );

      items.push(prompt);
    }

    return items;
  }

  private static buildSinglePrompt(
    index: number,
    category: ExerciseCategory,
    newKeys: string[],
    allowedKeys: string[],
    allowedSet: ReadonlySet<string>,
    hasSpace: boolean,
    weights: Map<string, number>,
    allowedWords: string[],
    allowedSyllables: string[],
    allowedCodes: string[],
    allowedSentences: string[],
    rng: SeededRandom
  ): TypingPromptItem {
    const nonSpaceNew = newKeys.filter((k) => k !== ' ');
    const nonSpaceAllowed = allowedKeys.filter((k) => k !== ' ');

    if (category === 'sentences' && hasSpace && (allowedSentences.length > 0 || allowedWords.length >= 3)) {
      if (allowedSentences.length > 0 && (allowedWords.length < 3 || rng.next() < 0.65)) {
        const sentence = AdaptiveLearningEngine.pickWeightedCandidate(allowedSentences, weights, rng);
        return {
          id: `prompt_${index}_sentence`,
          text: sentence,
          category: 'sentences',
          isDrill: false,
          targetKeys: nonSpaceNew.length > 0 ? nonSpaceNew : nonSpaceAllowed.slice(0, 4),
          difficulty: 4,
        };
      }
      // Build a multi-word tactical phrase from allowed real words
      const wordCount = rng.nextInt(3, 4);
      const chosenWords: string[] = [];
      for (let w = 0; w < wordCount; w++) {
        chosenWords.push(AdaptiveLearningEngine.pickWeightedCandidate(allowedWords, weights, rng));
      }
      return {
        id: `prompt_${index}_phrase`,
        text: chosenWords.join(' '),
        category: 'sentences',
        isDrill: false,
        targetKeys: nonSpaceNew.length > 0 ? nonSpaceNew : nonSpaceAllowed.slice(0, 4),
        difficulty: 3,
      };
    }

    if (category === 'numbers_symbols' && allowedCodes.length > 0 && hasSpace) {
      const code1 = AdaptiveLearningEngine.pickWeightedCandidate(allowedCodes, weights, rng);
      const code2 = AdaptiveLearningEngine.pickWeightedCandidate(allowedCodes, weights, rng);
      const text = code1 === code2 ? code1 : `${code1} ${code2}`;
      if (AdaptiveLearningEngine.isStringAllowed(text, allowedSet)) {
        return {
          id: `prompt_${index}_numcode`,
          text,
          category: 'numbers_symbols',
          isDrill: false,
          targetKeys: nonSpaceNew,
          difficulty: 4,
        };
      }
    }

    if ((category === 'words' || category === 'diacritics') && allowedWords.length > 0) {
      const candidates =
        category === 'diacritics'
          ? allowedWords.filter((w) => /[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/.test(w))
          : allowedWords;
      const pool = candidates.length > 0 ? candidates : allowedWords;

      if (hasSpace) {
        const countWords = rng.nextInt(2, 3);
        const picked: string[] = [];
        for (let w = 0; w < countWords; w++) {
          picked.push(AdaptiveLearningEngine.pickWeightedCandidate(pool, weights, rng));
        }
        return {
          id: `prompt_${index}_words`,
          text: picked.join(' '),
          category,
          isDrill: false,
          targetKeys: nonSpaceNew,
          difficulty: 2,
        };
      } else {
        const single = AdaptiveLearningEngine.pickWeightedCandidate(pool, weights, rng);
        return {
          id: `prompt_${index}_word`,
          text: single,
          category,
          isDrill: false,
          targetKeys: nonSpaceNew,
          difficulty: 2,
        };
      }
    }

    if ((category === 'syllables' || category === 'bigrams') && allowedSyllables.length >= 2) {
      const groupCount = hasSpace ? 3 : 1;
      const groups: string[] = [];
      for (let g = 0; g < groupCount; g++) {
        const syl1 = AdaptiveLearningEngine.pickWeightedCandidate(allowedSyllables, weights, rng);
        const syl2 = AdaptiveLearningEngine.pickWeightedCandidate(allowedSyllables, weights, rng);
        groups.push(`${syl1}${syl2}`);
      }
      return {
        id: `prompt_${index}_${category}`,
        text: groups.join(hasSpace ? ' ' : ''),
        category,
        isDrill: true,
        targetKeys: nonSpaceNew,
        difficulty: 2,
      };
    }

    // Drill / Alternation / Coordination generator
    return AdaptiveLearningEngine.buildStructuredDrill(
      index,
      category,
      nonSpaceNew,
      nonSpaceAllowed,
      hasSpace,
      weights,
      rng
    );
  }

  private static pickWeightedCandidate(
    candidates: string[],
    weights: Map<string, number>,
    rng: SeededRandom
  ): string {
    if (candidates.length === 1) return candidates[0];
    const scored = candidates.map((text) => {
      let score = 1.0;
      for (let i = 0; i < text.length; i++) {
        score += (weights.get(text[i]) ?? 1.0) * 0.35;
      }
      return { text, score };
    });
    let total = 0;
    for (const s of scored) total += s.score;
    let roll = rng.next() * total;
    for (const s of scored) {
      roll -= s.score;
      if (roll <= 0) return s.text;
    }
    return scored[scored.length - 1].text;
  }

  private static buildStructuredDrill(
    index: number,
    category: ExerciseCategory,
    nonSpaceNew: string[],
    nonSpaceAllowed: string[],
    hasSpace: boolean,
    weights: Map<string, number>,
    rng: SeededRandom
  ): TypingPromptItem {
    const leftKeys = nonSpaceAllowed.filter((k) => lookupCharKey(k)?.keyDef.hand === 'left');
    const rightKeys = nonSpaceAllowed.filter((k) => lookupCharKey(k)?.keyDef.hand === 'right');

    const groupsCount = hasSpace ? 3 : 1;
    const groupLen = hasSpace ? 4 : 8;
    const groups: string[] = [];

    for (let g = 0; g < groupsCount; g++) {
      let chunk = '';
      if (category === 'alternation' && leftKeys.length > 0 && rightKeys.length > 0) {
        const lKey = leftKeys[rng.nextInt(0, leftKeys.length - 1)];
        const rKey = rightKeys[rng.nextInt(0, rightKeys.length - 1)];
        for (let c = 0; c < groupLen; c++) {
          chunk += c % 2 === 0 ? lKey : rKey;
        }
      } else {
        const focusKey =
          nonSpaceNew.length > 0
            ? nonSpaceNew[(index + g) % nonSpaceNew.length]
            : AdaptiveLearningEngine.pickWeightedKey(weights, rng);
        const partnerKey = AdaptiveLearningEngine.pickWeightedKey(weights, rng);
        for (let c = 0; c < groupLen; c++) {
          chunk += c % 2 === 0 ? focusKey : partnerKey;
        }
      }
      groups.push(chunk);
    }

    return {
      id: `prompt_${index}_drill`,
      text: groups.join(hasSpace ? ' ' : ''),
      category: category === 'alternation' || category === 'coordination' ? category : 'drill',
      isDrill: true,
      targetKeys: nonSpaceNew.length > 0 ? nonSpaceNew : nonSpaceAllowed.slice(0, 2),
      difficulty: 1,
    };
  }
}
