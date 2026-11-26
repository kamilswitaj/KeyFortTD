import { MISSIONS_DATA } from '../data/curriculumData';
import { Language, PlayerProfile, SessionHistoryEntry, TypingPromptItem } from '../types';
import { AdaptiveLearningEngine } from './AdaptiveLearningEngine';
import { ChallengeEngine } from './ChallengeEngine';
import { StatisticsEngine } from './StatisticsEngine';
import { TypingEngine } from './TypingEngine';

export type TrainingActivityKind =
  | 'weak_keys'
  | 'bigrams'
  | 'diacritics'
  | 'uppercase'
  | 'words'
  | 'sentences'
  | 'relaxed';

export interface TrainingActivityDefinition {
  id: TrainingActivityKind;
  namePl: string;
  nameEn: string;
  themePl: string;
  themeEn: string;
  descPl: string;
  descEn: string;
  icon: string;
  isAheadOfCurriculum?: boolean;
}

export const TRAINING_ACTIVITIES: TrainingActivityDefinition[] = [
  {
    id: 'weak_keys',
    namePl: 'Kalibracja Słabych Klawiszy',
    nameEn: 'Weak Key Calibration',
    themePl: 'Kalibracja Reaktora',
    themeEn: 'Reactor Calibration',
    descPl: 'Celowane ćwiczenia na najtrudniejszych znakach z Twojej mapy opanowania.',
    descEn: 'Targeted drills focusing on your lowest-mastery keys.',
    icon: '🎯',
  },
  {
    id: 'bigrams',
    namePl: 'Płynne Dwuznaki',
    nameEn: 'Bigram Flow',
    themePl: 'Naprawa Przewodów',
    themeEn: 'Conduit Repair',
    descPl: 'Trening przejść między dwoma klawiszami poprawiający rytm pisania.',
    descEn: 'Two-key transition drills for smoother finger coordination.',
    icon: '🔗',
  },
  {
    id: 'diacritics',
    namePl: 'Polskie Znaki (AltGr)',
    nameEn: 'Polish Diacritics (AltGr)',
    themePl: 'Aktywacja Run',
    themeEn: 'Rune Activation',
    descPl: 'Ćwiczenia ą, ć, ę, ł, ń, ó, ś, ź, ż z prawym klawiszem Alt.',
    descEn: 'Practice Polish letters using Right Alt (AltGr) combinations.',
    icon: '🇵🇱',
    isAheadOfCurriculum: true,
  },
  {
    id: 'uppercase',
    namePl: 'Wielkie Litery (Shift)',
    nameEn: 'Capital Letters (Shift)',
    themePl: 'Ładowanie Bohatera',
    themeEn: 'Hero Charge',
    descPl: 'Pewne używanie klawisza Shift w parach z literami obu rąk.',
    descEn: 'Master Shift key combinations across left and right hands.',
    icon: '⬆️',
    isAheadOfCurriculum: true,
  },
  {
    id: 'words',
    namePl: 'Słowa Tematyczne',
    nameEn: 'Themed Vocabulary',
    themePl: 'Strzelnica Bastionu',
    themeEn: 'Bastion Range',
    descPl: 'Naturalne słowa o grach, kosmosie, nauce i przyrodzie.',
    descEn: 'Natural words about games, space, science, and nature.',
    icon: '📚',
  },
  {
    id: 'sentences',
    namePl: 'Pełne Zdania',
    nameEn: 'Complete Sentences',
    themePl: 'Otwarcie Portalu',
    themeEn: 'Portal Activation',
    descPl: 'Płynne przepisywanie pełnych zdań z interpunkcją.',
    descEn: 'Continuous sentence typing with natural punctuation.',
    icon: '✍️',
  },
  {
    id: 'relaxed',
    namePl: 'Spokojny Trening Bez Presji',
    nameEn: 'Relaxed Free Practice',
    themePl: 'Swobodny Trening',
    themeEn: 'Free Calibration',
    descPl: 'Dowolne tempo bez limitu czasu — skup się wyłącznie na celności.',
    descEn: 'Untimed, zero-pressure practice focused purely on accuracy.',
    icon: '🌿',
  },
];

export const STANDARDIZED_POOLS: Record<'beginner' | 'full', Record<Language, string[]>> = {
  beginner: {
    pl: [
      'f j f j d k d k s l s l a j f k d l s a',
      'las jak dal skala falka sada laska fala',
      'ala da las ja daj skala fala dada',
      'kasa fala lada sala klasa skala daj',
      'hala gala skalf falka lada sala las',
      'jak dla las dal fala skala laska',
      'sad lad glad fal kal hal gal das jas',
      'falka skala lada kasa sala hala fala',
    ],
    en: [
      'f j f j d k d k s l s l a j f k d l s a',
      'fall lad ask sad flask salad all fall',
      'dad had a salad lad asks a lass',
      'ask dad fall flask glad lad sad all',
      'half glad hall fall glass dash flash',
      'jags lag hag ash sash lash gash',
      'sad lad had a glass flask as a lass',
      'all lads ask dad as flags fall',
    ],
  },
  full: {
    pl: [
      'Każdy poprawnie wpisany znak zasila kryształowy reaktor twierdzy KeyFort.',
      'Równy rytm obu dłoni pomaga utrzymać wysoką celność podczas długich fal.',
      'Żółty smok wzleciał nad zieloną doliną i spojrzał na świetliste wieże.',
      'Młody inżynier sprawdził przewody, włączył tarcze i uruchomił główny portal.',
      'Wisła płynie przez Kraków i Warszawę aż do Morza Bałtyckiego na północy.',
      'Planety krążą wokół Słońca po eliptycznych orbitach od miliardów lat.',
      'Dobry strateg łączy wieże mrozu z ciężką artylerią przeciw dużym grupom.',
      'Spokojne i dokładne pisanie bez patrzenia na klawiaturę buduje trwałą szybkość.',
    ],
    en: [
      'Every accurate keystroke powers the crystal reactor inside the KeyFort bastion.',
      'Steady rhythm across both hands builds lasting speed without sacrificing accuracy.',
      'Bright energy towers guard the mountain pass while scouts race down the trail.',
      'Careful placement and smart upgrades defeat armored waves more reliably than haste.',
      'Earth orbits the Sun once every year while the Moon shapes ocean tides.',
      'Frost towers slow fast runners so heavy cannons can shatter entire squads.',
      'Touch typing lets your eyes stay on the battlefield instead of searching keys.',
      'Engineers calibrate crystal conduits before the next wave leaves the portal.',
    ],
  },
};

export const STANDARDIZED_RULES_VERSION = 2;
export interface AcademyResult {
  wpm: number;
  accuracy: number;
  correct: number;
  errors: number;
  consistency: number | null;
  qualified: boolean;
  focusLostInvalidated?: boolean;
}

export class TrainingAcademyEngine {
  public readonly mode: 'training' | 'assessment';
  public readonly activityKind: TrainingActivityKind;
  public readonly durationSec: 0 | 30 | 60 | 120;
  public readonly pool: 'beginner' | 'full';
  public readonly typingEngine: TypingEngine;
  public elapsedSec: number = 0;
  public started: boolean = false;
  public completed: boolean = false;
  public readonly ownerProfileId: string;
  private finalizedResult: AcademyResult | null = null;
  private profile: PlayerProfile;
  private language: Language;
  private allowedKeys: string[];
  private keyIntervalsMs: number[] = [];
  private lastKeyTimestamp: number | null = null;
  private focusLostInvalidated: boolean = false;

  constructor(options: {
    profile: PlayerProfile;
    mode: 'training' | 'assessment';
    activityKind?: TrainingActivityKind;
    durationSec?: 0 | 30 | 60 | 120;
    pool?: 'beginner' | 'full';
    language?: Language;
  }) {
    this.profile = options.profile;
    this.ownerProfileId = options.profile.id;
    this.mode = options.mode;
    this.activityKind = options.activityKind ?? 'weak_keys';
    this.durationSec = options.durationSec ?? 0;
    this.pool = options.pool ?? 'beginner';
    this.language = options.language ?? options.profile.settings.language;

    this.allowedKeys = this.resolveAllowedKeys();
    const prompts = this.buildInitialPrompts(this.allowedKeys);
    this.typingEngine = new TypingEngine(prompts);
  }

  private resolveAllowedKeys(): string[] {
    if (this.mode === 'assessment') {
      return this.pool === 'beginner'
        ? ['f', 'j', 'd', 'k', 's', 'l', 'a', 'g', 'h', ';', ' ']
        : MISSIONS_DATA[MISSIONS_DATA.length - 1].allowedKeys;
    }

    // In Training Academy, use only keys actually introduced in completed campaign missions
    // (plus explicit diacritics/uppercase only when user voluntarily chooses ahead-of-curriculum drills)
    const introduced = Array.from(ChallengeEngine.getIntroducedKeysForPlayer(this.profile));
    if (this.activityKind === 'diacritics') {
      return Array.from(new Set([...introduced, 'ą', 'ć', 'ę', 'ł', 'ń', 'ó', 'ś', 'ź', 'ż', ' ']));
    }
    if (this.activityKind === 'uppercase') {
      return Array.from(new Set([...introduced, 'A', 'S', 'D', 'F', 'J', 'K', 'L', ' ']));
    }
    return introduced;
  }

  private buildInitialPrompts(allowedKeys: string[]): TypingPromptItem[] {
    if (this.mode === 'assessment') {
      const texts = STANDARDIZED_POOLS[this.pool][this.language];
      return texts.map((text, idx) => ({
        id: `std_${this.pool}_${idx}`,
        text,
        category: this.pool === 'beginner' ? 'drill' : 'sentences',
        isDrill: this.pool === 'beginner',
        targetKeys: allowedKeys.slice(0, 4),
        difficulty: this.pool === 'beginner' ? 1 : 3,
      }));
    }

    const focusMap: Record<TrainingActivityKind, TypingPromptItem['category'][]> = {
      weak_keys: ['drill', 'coordination', 'bigrams'],
      bigrams: ['bigrams', 'alternation'],
      diacritics: ['diacritics', 'words'],
      uppercase: ['words', 'sentences'],
      words: ['words', 'syllables'],
      sentences: ['sentences', 'words'],
      relaxed: ['drill', 'words'],
    };

    return AdaptiveLearningEngine.generateExerciseBatch(
      {
        id: `academy_${this.activityKind}`,
        worldId: 1,
        missionIndex: 1,
        newKeys: [],
        allowedKeys,
        focusCategories: focusMap[this.activityKind],
      },
      this.profile.characterMastery,
      this.language,
      10,
      `academy_${this.activityKind}_${Date.now()}`,
      Date.now(),
      this.profile.bigramMastery
    );
  }

  public markFocusLost(): void {
    if (this.mode === 'assessment' && this.durationSec > 0 && this.started && !this.completed) {
      this.focusLostInvalidated = true;
    }
    this.typingEngine.markIdleBreak();
    this.lastKeyTimestamp = null;
  }

  public handleKey(key: string, now: number = Date.now(), isRepeat: boolean = false) {
    if (this.completed) return null;
    const res = this.typingEngine.processKeyInput(
      key,
      this.profile.characterMastery,
      this.profile.bigramMastery,
      0,
      now,
      isRepeat
    );
    if (!res.ignored) {
      this.started = true;
      if (this.lastKeyTimestamp !== null) {
        const delta = now - this.lastKeyTimestamp;
        if (delta > 25 && delta <= 2500) {
          this.keyIntervalsMs.push(delta);
        }
      }
      this.lastKeyTimestamp = now;
    }
    if (this.typingEngine.getRemainingQueueLength() < 3) {
      const more = this.buildInitialPrompts(this.allowedKeys);
      this.typingEngine.appendPrompts(more);
    }
    return res;
  }

  public tick(dtSec: number): boolean {
    if (!this.started || this.completed) return false;
    if (!Number.isFinite(dtSec) || dtSec <= 0) return false;
    this.elapsedSec = this.durationSec > 0 ? Math.min(this.durationSec, this.elapsedSec + dtSec) : this.elapsedSec + dtSec;
    if (this.durationSec > 0 && this.elapsedSec >= this.durationSec) {
      this.completed = true;
      return true;
    }
    return false;
  }

  public finishAndRecord(abandoned = false): AcademyResult {
    if (this.finalizedResult) return this.finalizedResult;
    this.completed = true;
    const correct = this.typingEngine.getTotalCorrect();
    const errors = this.typingEngine.getTotalErrors();
    const duration = this.typingEngine.getActiveDurationSec();
    const accuracy = correct + errors > 0 ? correct / (correct + errors) : 0;
    const isTimedAssessment = this.mode === 'assessment' && this.durationSec > 0;
    const finishedTimedTest = isTimedAssessment && !abandoned && this.elapsedSec >= this.durationSec;
    const qualified = finishedTimedTest && correct >= 20 && !this.focusLostInvalidated;
    // Timed assessment is measured over the whole allotted time, not typing bursts.
    const wpm = isTimedAssessment
      ? StatisticsEngine.computeWeightedWpm(correct, finishedTimedTest ? this.durationSec : this.elapsedSec)
      : this.typingEngine.getWpm();

    // True timing-based rhythm consistency from coefficient of variation of active keystroke intervals
    // Require at least 8 intervals so tiny samples return null (rendered as '—') instead of fake 100%.
    let consistency: number | null = null;
    if (this.keyIntervalsMs.length >= 8) {
      const mean = this.keyIntervalsMs.reduce((s, v) => s + v, 0) / this.keyIntervalsMs.length;
      const variance =
        this.keyIntervalsMs.reduce((s, v) => s + (v - mean) ** 2, 0) / this.keyIntervalsMs.length;
      const cv = mean > 0 ? Math.sqrt(variance) / mean : 0;
      consistency = Math.max(0, Math.min(100, Math.round(100 - cv * 65)));
    }

    this.finalizedResult = {
      wpm,
      accuracy,
      correct,
      errors,
      consistency,
      qualified,
      focusLostInvalidated: this.focusLostInvalidated,
    };
    if (correct + errors > 0) {
      const entry: SessionHistoryEntry = {
        profileId: this.ownerProfileId,
        timestamp: Date.now(),
        missionId: this.mode === 'assessment' ? 'academy_assessment' : 'academy_' + this.activityKind,
        mode: this.mode,
        difficulty: this.profile.settings.difficulty,
        status: abandoned || (isTimedAssessment && !finishedTimedTest) ? 'abandoned' : 'completed',
        wpm: this.typingEngine.getWpm(),
        qualifyingWpm: null,
        accuracy,
        durationSec: duration,
        charsTyped: correct,
        errors,
        maxCombo: this.typingEngine.getMaxCombo(),
      };
      this.profile.totalCharsTyped += correct + errors;
      this.profile.totalCorrectChars += correct;
      this.profile.totalPracticeTimeSec += duration;
      this.profile.lastActiveAt = entry.timestamp;
      this.profile.bestCombo = Math.max(this.profile.bestCombo, entry.maxCombo);
      this.profile.sessionHistory.push(entry);
      this.profile.sessionHistory = this.profile.sessionHistory.slice(-60);
      StatisticsEngine.recordSessionIntoDailyStats(this.profile, entry);
    }
    if (qualified) {
      this.profile.standardizedTestRecords = this.profile.standardizedTestRecords ?? [];
      this.profile.standardizedTestRecords.unshift({
        rulesVersion: STANDARDIZED_RULES_VERSION,
        durationSec: this.durationSec,
        pool: this.pool,
        language: this.language,
        wpm,
        accuracy,
        consistency,
        timestamp: Date.now(),
      });
      this.profile.standardizedTestRecords = this.profile.standardizedTestRecords.slice(0, 30);
    }
    return this.finalizedResult;
  }
}
