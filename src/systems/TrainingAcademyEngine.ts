import { MISSIONS_DATA } from '../data/curriculumData';
import { Language, PlayerProfile, TypingPromptItem } from '../types';
import { AdaptiveLearningEngine } from './AdaptiveLearningEngine';
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

const STANDARDIZED_POOLS: Record<'beginner' | 'full', Record<Language, string[]>> = {
  beginner: {
    pl: [
      'f j f j d k d k s l s l a j f k d l s a',
      'las jak dal skala falka sada laska fala',
      'ala ma psa ola ma kota tata da lasa',
      'kasa fala lada sala klasa skala daj',
    ],
    en: [
      'f j f j d k d k s l s l a j f k d l s a',
      'fall lad ask sad flask salad all fall',
      'dad had a salad lad asks a lass',
      'ask dad fall flask glad lad sad all',
    ],
  },
  full: {
    pl: [
      'Każdy poprawnie wpisany znak zasila kryształowy reaktor twierdzy KeyFort.',
      'Równy rytm obu dłoni pomaga utrzymać wysoką celność podczas długich fal.',
      'Żółty smok wzleciał nad zieloną doliną i spojrzał na świetliste wieże.',
      'Młody inżynier sprawdził przewody, włączył tarcze i uruchomił główny portal.',
    ],
    en: [
      'Every accurate keystroke powers the crystal reactor inside the KeyFort bastion.',
      'Steady rhythm across both hands builds lasting speed without sacrificing accuracy.',
      'Bright energy towers guard the mountain pass while scouts race down the trail.',
      'Careful placement and smart upgrades defeat armored waves more reliably than haste.',
    ],
  },
};

export class TrainingAcademyEngine {
  public readonly mode: 'training' | 'assessment';
  public readonly activityKind: TrainingActivityKind;
  public readonly durationSec: 0 | 30 | 60 | 120;
  public readonly pool: 'beginner' | 'full';
  public readonly typingEngine: TypingEngine;
  public elapsedSec: number = 0;
  public started: boolean = false;
  public completed: boolean = false;
  private profile: PlayerProfile;
  private language: Language;
  private allowedKeys: string[];

  constructor(options: {
    profile: PlayerProfile;
    mode: 'training' | 'assessment';
    activityKind?: TrainingActivityKind;
    durationSec?: 0 | 30 | 60 | 120;
    pool?: 'beginner' | 'full';
    language?: Language;
  }) {
    this.profile = options.profile;
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
        ? ['f', 'j', 'd', 'k', 's', 'l', 'a', ';', ' ']
        : MISSIONS_DATA[MISSIONS_DATA.length - 1].allowedKeys;
    }

    // In Training Academy, use only keys introduced in the player's unlocked campaign progress (plus explicit diacritics/uppercase if chosen)
    const completedCount = Object.values(this.profile.completedMissions).filter((m) => m.completed).length;
    const unlockedMission = MISSIONS_DATA[Math.min(MISSIONS_DATA.length - 1, completedCount)] ?? MISSIONS_DATA[0];
    if (this.activityKind === 'diacritics') {
      return Array.from(new Set([...unlockedMission.allowedKeys, 'ą', 'ć', 'ę', 'ł', 'ń', 'ó', 'ś', 'ź', 'ż', ' ']));
    }
    if (this.activityKind === 'uppercase') {
      return Array.from(new Set([...unlockedMission.allowedKeys, 'A', 'S', 'D', 'F', 'J', 'K', 'L', ' ']));
    }
    return unlockedMission.allowedKeys;
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

  public handleKey(key: string, now: number = Date.now(), isRepeat: boolean = false) {
    if (this.completed) return null;
    if (!this.started) this.started = true;
    const res = this.typingEngine.processKeyInput(
      key,
      this.profile.characterMastery,
      this.profile.bigramMastery,
      0,
      now,
      isRepeat
    );
    if (this.typingEngine.getRemainingQueueLength() < 3) {
      const more = this.buildInitialPrompts(this.allowedKeys);
      this.typingEngine.appendPrompts(more);
    }
    return res;
  }

  public tick(dtSec: number): boolean {
    if (!this.started || this.completed) return false;
    this.elapsedSec += dtSec;
    if (this.durationSec > 0 && this.elapsedSec >= this.durationSec) {
      this.completed = true;
      return true;
    }
    return false;
  }

  public finishAndRecord(): {
    wpm: number;
    accuracy: number;
    correct: number;
    errors: number;
    consistency: number;
  } {
    this.completed = true;
    const wpm = this.typingEngine.getWpm();
    const accuracy = this.typingEngine.getAccuracy();
    const correct = this.typingEngine.getTotalCorrect();
    const errors = this.typingEngine.getTotalErrors();
    const consistency = Math.max(0, Math.min(100, Math.round(accuracy * 100 - Math.min(15, errors * 0.8))));

    // Record legitimate typing practice onto profile
    this.profile.totalCharsTyped += this.typingEngine.getTotalAttempts();
    this.profile.totalCorrectChars += correct;
    this.profile.totalPracticeTimeSec += Math.round(Math.max(5, this.elapsedSec));

    if (this.mode === 'assessment' && correct >= 15) {
      if (!this.profile.standardizedTestRecords) {
        this.profile.standardizedTestRecords = [];
      }
      this.profile.standardizedTestRecords.unshift({
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

    return { wpm, accuracy, correct, errors, consistency };
  }
}
