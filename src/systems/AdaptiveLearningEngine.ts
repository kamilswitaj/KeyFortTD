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
  BigramStats,
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
      if (!allowedSet.has(candidate[i])) {
        return false;
      }
    }
    return true;
  }

  /**
   * Computes adaptive selection weights for each allowed non-space key using:
   * - Recently introduced keys
   * - Character accuracy
   * - Character reaction time
   * - Spaced repetition review schedule
   * - Practice history (unpracticed vs over-practiced keys)
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
        weight += 3.5;
      }

      const stat = masteryMap[key];
      if (!stat || stat.attempts < 5) {
        // Unpracticed or barely practiced key
        weight += 2.4;
      } else {
        const accuracy = stat.correct / stat.attempts;
        if (accuracy < 0.78) {
          weight += 3.8;
        } else if (accuracy < 0.88) {
          weight += 2.0;
        } else if (accuracy < 0.93) {
          weight += 0.8;
        }

        if (stat.avgReactionMs > 850) {
          weight += 2.0;
        } else if (stat.avgReactionMs > 620) {
          weight += 1.0;
        }

        // Spaced repetition reinforcement for mastered keys due for review
        if (stat.status === 'mastered') {
          if (stat.nextReviewAt <= now) {
            weight += 1.5;
          } else {
            weight = Math.max(0.55, weight * 0.6);
          }
        }
      }

      weights.set(key, weight);
    }

    return weights;
  }

  /**
   * Computes adaptive weights for character pairs (bigrams) based on:
   * - Bigram accuracy (error rate)
   * - Bigram transition time (`avgTransitionMs`)
   */
  public static computeBigramWeights(
    allowedSet: ReadonlySet<string>,
    bigramMap: Record<string, BigramStats> = {}
  ): Map<string, number> {
    const bgWeights = new Map<string, number>();

    for (const [bg, stat] of Object.entries(bigramMap)) {
      if (bg.length !== 2) continue;
      if (!allowedSet.has(bg[0]) || !allowedSet.has(bg[1])) continue;
      if (stat.attempts < 2) continue;

      const accuracy = stat.correct / stat.attempts;
      let boost = 0;

      if (accuracy < 0.75) {
        boost += 4.2;
      } else if (accuracy < 0.88) {
        boost += 2.4;
      } else if (accuracy < 0.94) {
        boost += 0.9;
      }

      if (stat.avgTransitionMs > 720) {
        boost += 2.2;
      } else if (stat.avgTransitionMs > 520) {
        boost += 1.1;
      }

      if (boost > 0) {
        bgWeights.set(bg, 1.0 + boost);
      }
    }

    return bgWeights;
  }

  public static pickWeightedKey(weights: Map<string, number>, rng: SeededRandom, excludeKey?: string): string {
    const entries = Array.from(weights.entries());
    if (entries.length === 0) return 'f';
    const filtered = excludeKey && entries.length > 1 ? entries.filter(([k]) => k !== excludeKey) : entries;
    let total = 0;
    for (const [, w] of filtered) total += w;
    let roll = rng.next() * total;
    for (const [k, w] of filtered) {
      roll -= w;
      if (roll <= 0) return k;
    }
    return filtered[filtered.length - 1][0];
  }

  /**
   * Generates a tailored batch of typing exercises for a mission or survival/sandbox run.
   * Uses character accuracy, character reaction time, bigram accuracy, bigram transition time,
   * recently introduced keys, spaced repetition, and practice history.
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
    now: number = Date.now(),
    bigramMap: Record<string, BigramStats> = {},
    recentPromptTexts: string[] = []
  ): TypingPromptItem[] {
    const rng = new SeededRandom(seed);
    const allowedSet = new Set(mission.allowedKeys);
    const newKeys = mission.newKeys.filter((key) => allowedSet.has(key));
    if (!mission.allowedKeys.some((key) => key !== ' ')) return [];

    const hasSpace = allowedSet.has(' ');
    const charWeights = AdaptiveLearningEngine.computeCharacterWeights(
      mission.allowedKeys,
      newKeys,
      masteryMap,
      now
    );
    const bigramWeights = AdaptiveLearningEngine.computeBigramWeights(allowedSet, bigramMap);
    const recentSet = new Set<string>(recentPromptTexts);

    // Filter word and sentence banks strictly by language and allowedSet
    const rawWordPool = language === 'pl' ? REAL_WORDS_PL : REAL_WORDS_EN;
    const primaryWords = rawWordPool
      .map((w) => w.trim())
      .filter((w) => AdaptiveLearningEngine.isStringAllowed(w, allowedSet));

    const allowedSyllables = SYLLABLES_BANK.filter((s) => AdaptiveLearningEngine.isStringAllowed(s, allowedSet));
    const allowedCodes = ALPHANUMERIC_CODES.filter((c) => AdaptiveLearningEngine.isStringAllowed(c, allowedSet));
    const rawSentences = language === 'pl' ? SENTENCES_PL : SENTENCES_EN;
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
        charWeights,
        bigramWeights,
        recentSet,
        primaryWords,
        allowedSyllables,
        allowedCodes,
        allowedSentences,
        rng
      );

      // Post-condition curriculum safety check: strip any character not in allowedSet
      const safeText = Array.from(prompt.text)
        .filter((ch) => allowedSet.has(ch))
        .join('');

      if (safeText.length > 0) {
        prompt.text = safeText;
        recentSet.add(safeText);
        items.push(prompt);
      }
    }

    return items;
  }

  /**
   * Generates a short, targeted follow-up practice sequence when a player wins the tactical
   * battle but still needs a few more accurate presses on newly introduced keys.
   */
  public static generateFollowUpPracticeBatch(
    unmetKeys: string[],
    allowedKeys: string[],
    masteryMap: Record<string, CharacterStats>,
    bigramMap: Record<string, BigramStats>,
    language: Language = 'pl',
    count: number = 4,
    seed: number | string = 'followup'
  ): TypingPromptItem[] {
    const allowedSet = new Set(allowedKeys);
    const validFocusKeys = unmetKeys.filter((k) => k !== ' ' && allowedSet.has(k));
    const focusKeys = validFocusKeys.length > 0 ? validFocusKeys : allowedKeys.filter((k) => k !== ' ').slice(0, 2);

    return AdaptiveLearningEngine.generateExerciseBatch(
      {
        id: 'followup_practice',
        worldId: 1,
        missionIndex: 1,
        newKeys: focusKeys,
        allowedKeys,
        focusCategories: ['drill', 'words', 'coordination'],
      },
      masteryMap,
      language,
      count,
      seed,
      Date.now(),
      bigramMap
    );
  }

  private static buildSinglePrompt(
    index: number,
    category: ExerciseCategory,
    newKeys: string[],
    allowedKeys: string[],
    allowedSet: ReadonlySet<string>,
    hasSpace: boolean,
    charWeights: Map<string, number>,
    bigramWeights: Map<string, number>,
    recentSet: Set<string>,
    allowedWords: string[],
    allowedSyllables: string[],
    allowedCodes: string[],
    allowedSentences: string[],
    rng: SeededRandom
  ): TypingPromptItem {
    const nonSpaceNew = newKeys.filter((k) => k !== ' ');
    const nonSpaceAllowed = allowedKeys.filter((k) => k !== ' ');

    if (category === 'sentences' && hasSpace && (allowedSentences.length > 0 || allowedWords.length >= 3)) {
      if (allowedSentences.length > 0 && (allowedWords.length < 3 || rng.next() < 0.72)) {
        const sentence = AdaptiveLearningEngine.pickWeightedCandidate(
          allowedSentences,
          charWeights,
          bigramWeights,
          recentSet,
          rng
        );
        return {
          id: `prompt_${index}_sentence`,
          text: sentence,
          category: 'sentences',
          isDrill: false,
          targetKeys: nonSpaceNew.length > 0 ? nonSpaceNew : nonSpaceAllowed.slice(0, 4),
          difficulty: 4,
        };
      }
      // Build a multi-word tactical phrase from allowed real words without immediate duplicate words
      const wordCount = rng.nextInt(3, 4);
      const chosenWords: string[] = [];
      const localUsed = new Set<string>(recentSet);
      for (let w = 0; w < wordCount; w++) {
        const picked = AdaptiveLearningEngine.pickWeightedCandidate(
          allowedWords,
          charWeights,
          bigramWeights,
          localUsed,
          rng
        );
        chosenWords.push(picked);
        localUsed.add(picked);
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
      const code1 = AdaptiveLearningEngine.pickWeightedCandidate(
        allowedCodes,
        charWeights,
        bigramWeights,
        recentSet,
        rng
      );
      const localUsed = new Set<string>([...recentSet, code1]);
      const code2 = AdaptiveLearningEngine.pickWeightedCandidate(
        allowedCodes,
        charWeights,
        bigramWeights,
        localUsed,
        rng
      );
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
        const localUsed = new Set<string>(recentSet);
        for (let w = 0; w < countWords; w++) {
          const word = AdaptiveLearningEngine.pickWeightedCandidate(
            pool,
            charWeights,
            bigramWeights,
            localUsed,
            rng
          );
          picked.push(word);
          localUsed.add(word);
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
        const single = AdaptiveLearningEngine.pickWeightedCandidate(
          pool,
          charWeights,
          bigramWeights,
          recentSet,
          rng
        );
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
      const localUsed = new Set<string>();
      for (let g = 0; g < groupCount; g++) {
        const syl1 = AdaptiveLearningEngine.pickWeightedCandidate(
          allowedSyllables,
          charWeights,
          bigramWeights,
          localUsed,
          rng
        );
        localUsed.add(syl1);
        const syl2 = AdaptiveLearningEngine.pickWeightedCandidate(
          allowedSyllables,
          charWeights,
          bigramWeights,
          localUsed,
          rng
        );
        localUsed.add(syl2);
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
      charWeights,
      bigramWeights,
      rng
    );
  }

  /**
   * Scores candidates using both character weights and bigram transition/accuracy weights,
   * while penalizing recently used items to prevent monotony.
   */
  public static pickWeightedCandidate(
    candidates: string[],
    charWeights: Map<string, number>,
    bigramWeights: Map<string, number>,
    recentSet: ReadonlySet<string>,
    rng: SeededRandom
  ): string {
    if (candidates.length === 1) return candidates[0];
    const scored = candidates.map((text) => {
      let score = 1.0;
      for (let i = 0; i < text.length; i++) {
        score += (charWeights.get(text[i]) ?? 1.0) * 0.35;
        if (i < text.length - 1) {
          const bg = text.slice(i, i + 2);
          const bgW = bigramWeights.get(bg);
          if (bgW && bgW > 1) {
            score += (bgW - 1) * 1.45;
          }
        }
      }
      if (recentSet.has(text)) {
        score *= 0.08;
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
    charWeights: Map<string, number>,
    bigramWeights: Map<string, number>,
    rng: SeededRandom
  ): TypingPromptItem {
    const leftKeys = nonSpaceAllowed.filter((k) => lookupCharKey(k)?.keyDef.hand === 'left');
    const rightKeys = nonSpaceAllowed.filter((k) => lookupCharKey(k)?.keyDef.hand === 'right');

    // Collect top weak bigrams if any exist
    const weakBigrams = Array.from(bigramWeights.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([bg]) => bg);

    const groupsCount = hasSpace ? 3 : 2;
    const groupLen = hasSpace ? 4 : 3;
    const groups: string[] = [];

    for (let g = 0; g < groupsCount; g++) {
      let chunk = '';
      if (weakBigrams.length > 0 && (category === 'bigrams' || g === 1)) {
        const bg = weakBigrams[(index + g) % weakBigrams.length];
        const filler = AdaptiveLearningEngine.pickWeightedKey(charWeights, rng, bg[1]);
        chunk = groupLen === 4 ? `${bg}${bg}` : `${bg}${filler}`;
      } else if (category === 'alternation' && leftKeys.length > 0 && rightKeys.length > 0) {
        const lKey = leftKeys[rng.nextInt(0, leftKeys.length - 1)];
        const rKey = rightKeys[rng.nextInt(0, rightKeys.length - 1)];
        const patternIdx = (index + g) % 3;
        if (patternIdx === 0) {
          chunk = `${lKey}${rKey}${lKey}${groupLen === 4 ? rKey : ''}`;
        } else if (patternIdx === 1) {
          chunk = `${rKey}${lKey}${rKey}${groupLen === 4 ? lKey : ''}`;
        } else {
          chunk = `${lKey}${lKey}${rKey}${groupLen === 4 ? rKey : ''}`;
        }
      } else {
        const focusKey =
          nonSpaceNew.length > 0
            ? nonSpaceNew[(index + g) % nonSpaceNew.length]
            : AdaptiveLearningEngine.pickWeightedKey(charWeights, rng);
        const partnerKey = AdaptiveLearningEngine.pickWeightedKey(charWeights, rng, focusKey);
        const patternIdx = (index + g) % 3;
        if (patternIdx === 0) {
          chunk = `${focusKey}${partnerKey}${focusKey}${groupLen === 4 ? partnerKey : ''}`;
        } else if (patternIdx === 1) {
          chunk = `${focusKey}${focusKey}${partnerKey}${groupLen === 4 ? focusKey : ''}`;
        } else {
          chunk = `${partnerKey}${focusKey}${focusKey}${groupLen === 4 ? partnerKey : ''}`;
        }
      }
      groups.push(chunk);
    }

    return {
      id: `prompt_${index}_drill`,
      text: groups.join(hasSpace ? ' ' : ''),
      category: category === 'alternation' || category === 'coordination' || category === 'bigrams' ? category : 'drill',
      isDrill: true,
      targetKeys: nonSpaceNew.length > 0 ? nonSpaceNew : nonSpaceAllowed.slice(0, 2),
      difficulty: 1,
    };
  }
}
