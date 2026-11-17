import { describe, expect, it } from 'vitest';
import { MISSIONS_DATA, WORLDS_DATA } from '../../src/data/curriculumData';
import { lookupCharKey, POLISH_DIACRITICS } from '../../src/data/keyboardData';
import { AdaptiveLearningEngine } from '../../src/systems/AdaptiveLearningEngine';
import { MasteryEngine, MIN_ATTEMPTS_FOR_MASTERY } from '../../src/systems/MasteryEngine';
import { TypingEngine } from '../../src/systems/TypingEngine';
import { BigramStats, CharacterStats } from '../../src/types';

describe('Curriculum, Polish Keyboard, TypingEngine, and AdaptiveLearningEngine', () => {
  it('defines 8 worlds and 48 progressive educational missions', () => {
    expect(WORLDS_DATA.length).toBe(8);
    expect(MISSIONS_DATA.length).toBe(48);

    for (let w = 1; w <= 8; w++) {
      const worldMissions = MISSIONS_DATA.filter((m) => m.worldId === w);
      expect(worldMissions.length).toBe(6);
      expect(worldMissions[5].isBossMission).toBe(true);
    }
  });

  it('correctly maps all Polish diacritical characters to AltGr combinations', () => {
    for (const diacritic of POLISH_DIACRITICS) {
      const lookup = lookupCharKey(diacritic);
      expect(lookup).toBeDefined();
      expect(lookup?.requiresAltGr).toBe(true);
      expect(lookup?.requiresShift).toBe(false);
    }

    const upperLookup = lookupCharKey('Ł');
    expect(upperLookup).toBeDefined();
    expect(upperLookup?.requiresAltGr).toBe(true);
    expect(upperLookup?.requiresShift).toBe(true);
  });

  it('never generates unlearned characters in any of the 48 campaign missions', () => {
    const masteryMap: Record<string, CharacterStats> = {};

    for (const mission of MISSIONS_DATA) {
      const allowedSet = new Set(mission.allowedKeys);
      const batchPl = AdaptiveLearningEngine.generateExerciseBatch(
        mission,
        masteryMap,
        'pl',
        15,
        `test_pl_${mission.id}`
      );
      const batchEn = AdaptiveLearningEngine.generateExerciseBatch(
        mission,
        masteryMap,
        'en',
        15,
        `test_en_${mission.id}`
      );

      for (const item of [...batchPl, ...batchEn]) {
        expect(item.text.length).toBeGreaterThan(0);
        for (const ch of item.text) {
          expect(
            allowedSet.has(ch),
            `Mission ${mission.id} generated forbidden char "${ch}" in "${item.text}"`
          ).toBe(true);
        }
      }
    }
  });

  it('does not introduce out-of-scope new keys in custom or survival exercises', () => {
    const mission = { ...MISSIONS_DATA[47], allowedKeys: ['f', 'j'], newKeys: ['x', 'z'] };
    const batch = AdaptiveLearningEngine.generateExerciseBatch(mission, {}, 'pl', 30, 'restricted');
    expect(batch).toHaveLength(30);
    expect(batch.every((item) => /^[fj]+$/.test(item.text))).toBe(true);
  });

  it('clearly distinguishes intentional drills from real words', () => {
    const masteryMap: Record<string, CharacterStats> = {};
    const m1 = MISSIONS_DATA[0]; // F and J only -> drills
    const batch1 = AdaptiveLearningEngine.generateExerciseBatch(m1, masteryMap, 'pl', 6, 'm1_seed');
    expect(batch1.every((item) => item.isDrill)).toBe(true);

    const m8 = MISSIONS_DATA.find((m) => m.id === 'w2_m2')!; // introduces 'a', has words
    const batch8 = AdaptiveLearningEngine.generateExerciseBatch(m8, masteryMap, 'pl', 10, 'm8_seed');
    expect(batch8.some((item) => !item.isDrill && item.category === 'words')).toBe(true);
  });

  it('does not classify a character as mastered before reaching minimum attempts', () => {
    const masteryMap: Record<string, CharacterStats> = {};
    const bigramMap: Record<string, BigramStats> = {};

    for (let i = 0; i < MIN_ATTEMPTS_FOR_MASTERY - 1; i++) {
      MasteryEngine.recordKeystroke(masteryMap, bigramMap, 'f', 'f', 300, 'j', 1000 + i * 400);
    }
    expect(masteryMap['f'].status).not.toBe('mastered');

    // Reach MIN_ATTEMPTS_FOR_MASTERY with 100% accuracy and fast reaction
    MasteryEngine.recordKeystroke(masteryMap, bigramMap, 'f', 'f', 300, 'j', 20000);
    expect(masteryMap['f'].attempts).toBe(MIN_ATTEMPTS_FOR_MASTERY);
    expect(masteryMap['f'].status).toBe('mastered');
    expect(masteryMap['f'].masteryScore).toBeGreaterThanOrEqual(78);
  });

  it('prioritizes weak/low-accuracy characters in adaptive weighting', () => {
    const masteryMap: Record<string, CharacterStats> = {
      f: {
        ...MasteryEngine.createEmptyCharacterStats('f'),
        attempts: 30,
        correct: 29,
        errors: 1,
        avgReactionMs: 320,
        masteryScore: 92,
        status: 'mastered',
        nextReviewAt: Date.now() + 999999,
      },
      d: {
        ...MasteryEngine.createEmptyCharacterStats('d'),
        attempts: 20,
        correct: 11,
        errors: 9,
        avgReactionMs: 920,
        masteryScore: 30,
        status: 'learning',
        nextReviewAt: 0,
      },
    };

    const weights = AdaptiveLearningEngine.computeCharacterWeights(['f', 'd', 'j', 'k'], [], masteryMap, Date.now());
    expect(weights.get('d')!).toBeGreaterThan(weights.get('f')! * 2);
  });

  it('handles TypingEngine keystrokes, Polish characters, modifiers, repeats, and pause compensation', () => {
    const masteryMap: Record<string, CharacterStats> = {};
    const bigramMap: Record<string, BigramStats> = {};
    const engine = new TypingEngine([
      {
        id: 'p1',
        text: 'żółw',
        category: 'diacritics',
        isDrill: false,
        targetKeys: ['ż', 'ó', 'ł'],
        difficulty: 2,
      },
    ]);

    // Modifier keys should be ignored without affecting combo or errors
    const modRes = engine.processKeyInput('AltGraph', masteryMap, bigramMap, 0, 1000, false);
    expect(modRes.ignored).toBe(true);
    expect(engine.getTotalErrors()).toBe(0);

    // Repeat keystrokes should be ignored
    const repRes = engine.processKeyInput('ż', masteryMap, bigramMap, 0, 1100, true);
    expect(repRes.ignored).toBe(true);

    // Correct Polish char 'ż'
    const r1 = engine.processKeyInput('ż', masteryMap, bigramMap, 0, 1200, false);
    expect(r1.isCorrect).toBe(true);
    expect(r1.energyGenerated).toBeGreaterThan(0);

    // Pause for 10 seconds and resume — reaction time should NOT include the 10-second pause
    engine.pause(1500);
    engine.resume(11500);
    const r2 = engine.processKeyInput('ó', masteryMap, bigramMap, 0, 11700, false);
    expect(r2.isCorrect).toBe(true);
    expect(r2.reactionMs).toBeLessThanOrEqual(600);

    // Wrong keystroke resets combo but does not advance cursor
    const rErr = engine.processKeyInput('l', masteryMap, bigramMap, 0, 12000, false);
    expect(rErr.isCorrect).toBe(false);
    expect(engine.getCombo()).toBe(0);
    expect(engine.getExpectedChar()).toBe('ł');

    // Finish sequence
    engine.processKeyInput('ł', masteryMap, bigramMap, 0, 12300, false);
    const rFinal = engine.processKeyInput('w', masteryMap, bigramMap, 0, 12600, false);
    expect(rFinal.sequenceCompleted).toBe(true);
  });

  it('uses bigram accuracy and transition time to prioritize weak bigrams without monotony', () => {
    const allowedSet = new Set(['f', 'j', 'd', 'k', 's', 'l', 'a', ' ']);
    const bigramMap: Record<string, BigramStats> = {
      kl: { bigram: 'kl', attempts: 12, correct: 5, errors: 7, avgTransitionMs: 880 },
      la: { bigram: 'la', attempts: 20, correct: 20, errors: 0, avgTransitionMs: 240 },
    };

    const bgWeights = AdaptiveLearningEngine.computeBigramWeights(allowedSet, bigramMap);
    expect(bgWeights.get('kl')!).toBeGreaterThan(4.0);
    expect(bgWeights.has('la')).toBe(false);

    const mission = MISSIONS_DATA.find((m) => m.id === 'w2_m2')!;
    const batch = AdaptiveLearningEngine.generateExerciseBatch(
      mission,
      {},
      'pl',
      12,
      'bigram_test',
      Date.now(),
      bigramMap
    );
    expect(batch.some((item) => item.text.includes('kl'))).toBe(true);
  });

  it('does not distort reaction time or WPM after a long planning break or window blur', () => {
    const masteryMap: Record<string, CharacterStats> = {};
    const bigramMap: Record<string, BigramStats> = {};
    const engine = new TypingEngine([
      {
        id: 'p_break',
        text: 'fjdk fjdk',
        category: 'drill',
        isDrill: true,
        targetKeys: ['f', 'j', 'd', 'k'],
        difficulty: 1,
      },
    ]);

    engine.processKeyInput('f', masteryMap, bigramMap, 0, 1000, false);
    engine.processKeyInput('j', masteryMap, bigramMap, 0, 1300, false);
    // Simulate a 25-second tower-building break before typing 'd'
    const afterBreak = engine.processKeyInput('d', masteryMap, bigramMap, 0, 26300, false);
    expect(afterBreak.reactionMs).toBeLessThanOrEqual(450);
    expect(masteryMap['d'].avgReactionMs).toBeLessThanOrEqual(700);
  });

  it('ensures Polish lessons use natural Polish words and do not mix English-only vocabulary', () => {
    const m12 = MISSIONS_DATA.find((m) => m.id === 'w2_m6')!;
    const batchPl = AdaptiveLearningEngine.generateExerciseBatch(m12, {}, 'pl', 20, 'pl_only');
    const englishOnlyWords = ['flask', 'shall', 'glad', 'jagged'];
    for (const item of batchPl) {
      for (const eng of englishOnlyWords) {
        expect(item.text.includes(eng)).toBe(false);
      }
    }
  });
});
