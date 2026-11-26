export type Language = 'pl' | 'en';

export type GameMode = 'campaign' | 'survival' | 'sandbox' | 'training' | 'assessment' | 'challenge';

export type ScreenId =
  | 'main_menu'
  | 'campaign_map'
  | 'gameplay'
  | 'training_academy'
  | 'challenges'
  | 'survival_setup'
  | 'sandbox_setup'
  | 'statistics'
  | 'family_dashboard'
  | 'achievements'
  | 'profiles'
  | 'settings';

export type FingerId =
  | 'L_PINKY'
  | 'L_RING'
  | 'L_MIDDLE'
  | 'L_INDEX'
  | 'THUMBS'
  | 'R_INDEX'
  | 'R_MIDDLE'
  | 'R_RING'
  | 'R_PINKY';

export type HandId = 'left' | 'right' | 'both';

export interface KeyDefinition {
  code: string;
  baseChar: string;
  shiftChar?: string;
  altGrChar?: string;
  altGrShiftChar?: string;
  row: 0 | 1 | 2 | 3 | 4; // 0: numbers, 1: top, 2: home, 3: bottom, 4: space/modifiers
  col: number;
  width?: number; // relative to 1u key
  finger: FingerId;
  hand: HandId;
  isHomeAnchor?: boolean;
  label?: string;
}

export type ExerciseCategory =
  | 'drill'
  | 'alternation'
  | 'coordination'
  | 'bigrams'
  | 'syllables'
  | 'words'
  | 'diacritics'
  | 'numbers_symbols'
  | 'sentences';

export interface TypingPromptItem {
  id: string;
  text: string;
  category: ExerciseCategory;
  isDrill: boolean; // Clearly distinguishes intentional drill sequences from real words
  targetKeys: string[];
  difficulty: number; // 1..5
  hintPl?: string;
  hintEn?: string;
}

export type MasteryStatus = 'locked' | 'learning' | 'practicing' | 'mastered';

export interface CharacterStats {
  char: string;
  attempts: number;
  correct: number;
  errors: number;
  avgReactionMs: number;
  bestReactionMs: number;
  lastPracticedAt: number;
  nextReviewAt: number;
  consecutiveCorrect: number;
  confusedWith: Record<string, number>;
  masteryScore: number; // 0..100
  status: MasteryStatus;
}

export interface BigramStats {
  bigram: string;
  attempts: number;
  correct: number;
  errors: number;
  avgTransitionMs: number;
}

export type SessionCompletionStatus = 'completed' | 'victory' | 'defeat' | 'abandoned';

export type DifficultyLevel = 'relaxed' | 'standard' | 'tactical';

export interface SessionHistoryEntry {
  sessionId?: string;
  profileId?: string;
  unrestrictedResources?: boolean;
  timestamp: number;
  missionId: string;
  mode: GameMode;
  difficulty?: DifficultyLevel;
  status?: SessionCompletionStatus;
  tacticalVictory?: boolean;
  educationalCompleted?: boolean;
  wpm: number;
  qualifyingWpm?: number | null;
  accuracy: number;
  durationSec: number;
  charsTyped: number;
  errors: number;
  maxCombo: number;
  score?: number;
  stars?: 0 | 1 | 2 | 3;
  wavesCompleted?: number;
}

export interface DailyPracticeAggregate {
  date: string; // YYYY-MM-DD
  practiceTimeSec: number;
  correctChars: number;
  errorChars: number;
  sessionsCount: number;
  missionsCompleted: number;
  masteredCountSnapshot: number | null;
}

export interface DifficultyMissionRecord {
  difficulty: DifficultyLevel;
  completed: boolean;
  stars: 0 | 1 | 2 | 3;
  bestAccuracy: number;
  bestWpm: number;
  bestQualifyingWpm: number | null;
  bestScore: number;
  maxCombo: number;
  timesCompleted: number;
}

export type TowerType =
  | 'gun'
  | 'cannon'
  | 'frost'
  | 'tesla'
  | 'sniper'
  | 'reactor'
  | 'flame'
  | 'drone'
  | 'laser'
  | 'command';

export type HeroId = 'guardian' | 'engineer' | 'ranger' | 'arcanist';

export interface HeroAbilityDefinition {
  id: string;
  namePl: string;
  nameEn: string;
  descPl: string;
  descEn: string;
  energyCost: number;
  cooldownSec: number;
}

export interface HeroDefinition {
  id: HeroId;
  namePl: string;
  nameEn: string;
  titlePl: string;
  titleEn: string;
  descPl: string;
  descEn: string;
  passivePl: string;
  passiveEn: string;
  unlockWorld: number;
  color: string;
  accentColor: string;
  baseDamage: number;
  baseRange: number;
  fireRate: number;
  abilities: [HeroAbilityDefinition, HeroAbilityDefinition];
}

export interface ActiveHero {
  id: HeroId;
  x: number;
  y: number;
  level: number;
  xp: number;
  cooldownRemaining: number;
  abilityCooldowns: [number, number];
  angle: number;
  muzzleFlashTimer: number;
  activeBuffTimer: number;
}

export type TargetingPriority = 'first' | 'last' | 'strongest' | 'nearest';

export type UpgradeBranch = 'damage' | 'speed' | 'special';

export interface UpgradeTierDefinition {
  branch: UpgradeBranch;
  tier: 1 | 2 | 3;
  id: string;
  namePl: string;
  nameEn: string;
  descPl: string;
  descEn: string;
  cost: number;
  effects: {
    damageMultiplier?: number;
    fireRateMultiplier?: number;
    rangeBonus?: number;
    energyEfficiencyBonus?: number;
    splashRadiusBonus?: number;
    slowPercentBonus?: number;
    slowDurationBonus?: number;
    chainCountBonus?: number;
    armorShredPercent?: number;
    shieldDamageMultiplier?: number;
    detectGhosts?: boolean;
    grantNearbyGhostDetection?: boolean;
    ricochetCount?: number;
    burnDps?: number;
    burnDuration?: number;
    clusterCount?: number;
    stunDuration?: number;
    brittleMultiplier?: number;
    suppressSplitters?: boolean;
    disableRegen?: boolean;
    energyRefundOnHit?: number;
    spotterDamageBonus?: number;
    pierceCount?: number;
    orbitalStrikeOnCombo?: boolean;
    auraDamageBuff?: number;
    maxEnergyBonus?: number;
    passiveEnergyPerSec?: number;
    goldPerWave?: number;
    keystrokeEnergyMultiplier?: number;
    wordCompletionShockwaveDamage?: number;
  };
}

export interface TowerDefinition {
  type: TowerType;
  namePl: string;
  nameEn: string;
  rolePl: string;
  roleEn: string;
  descPl: string;
  descEn: string;
  cost: number;
  range: number; // in pixels on 960x560 canvas
  fireRate: number; // attacks per second at 100% efficiency
  damage: number;
  energyPerShot: number;
  splashRadius: number;
  chainCount: number;
  slowPercent: number;
  slowDuration: number;
  detectsGhostsBase: boolean;
  color: string;
  accentColor: string;
  unlockWorld: number;
  upgrades: Record<UpgradeBranch, [UpgradeTierDefinition, UpgradeTierDefinition, UpgradeTierDefinition]>;
}

export interface ActiveTower {
  id: string;
  type: TowerType;
  padIndex: number;
  x: number;
  y: number;
  targeting: TargetingPriority;
  upgrades: {
    damage: 0 | 1 | 2 | 3;
    speed: 0 | 1 | 2 | 3;
    special: 0 | 1 | 2 | 3;
  };
  totalInvestedGold: number;
  cooldownRemaining: number;
  angle: number;
  lastTargetId: string | null;
  consecutiveHitsOnTarget: number;
  totalDamageDealt: number;
  kills: number;
  energyConsumed?: number;
  muzzleFlashTimer: number;
}

export type EnemyType =
  | 'scout'
  | 'tank'
  | 'shield'
  | 'swarm'
  | 'ghost'
  | 'splitter'
  | 'regenerator'
  | 'armored_elite'
  | 'evasive'
  | 'hover'
  | 'support'
  | 'boss';

export interface EnemyDefinition {
  type: EnemyType;
  namePl: string;
  nameEn: string;
  descPl: string;
  descEn: string;
  baseHp: number;
  baseShield: number;
  speed: number; // pixels per second
  armor: number; // 0..0.75 damage reduction
  goldReward: number;
  baseDamage: number; // lives lost if reaches base
  radius: number;
  color: string;
  isGhost: boolean;
  regenPerSec: number;
  splitCount: number;
  isBoss: boolean;
  isFlying?: boolean;
  evadeChance?: number;
  supportAuraRadius?: number;
}

export interface ActiveEnemy {
  id: string;
  type: EnemyType;
  namePl: string;
  nameEn: string;
  hp: number;
  maxHp: number;
  shield: number;
  maxShield: number;
  speed: number;
  baseSpeed: number;
  armor: number;
  goldReward: number;
  baseDamage: number;
  radius: number;
  color: string;
  isGhost: boolean;
  isRevealed: boolean;
  regenPerSec: number;
  regenDisabledTimer: number;
  splitCount: number;
  splitterSuppressed: boolean;
  isBoss: boolean;
  bossPhase: 1 | 2 | 3;
  bossAbilityCooldown: number;
  bossWorldId?: number;
  pathProgress: number; // distance in pixels along path
  waypointIndex: number;
  x: number;
  y: number;
  slowFactor: number; // 0..0.8
  slowTimer: number;
  stunTimer: number;
  burnDps: number;
  burnTimer: number;
  brittleBonus: number; // extra damage multiplier
  brittleTimer: number;
  spotterBonus: number;
  spotterTimer: number;
  isFlying?: boolean;
  hitFlashTimer?: number;
  facingAngle?: number;
  thermalShockCooldown?: number;
  evadeTimer?: number;
}

export interface WaveSpawnGroup {
  enemyType: EnemyType;
  count: number;
  intervalSec: number;
  delayBeforeSec: number;
  hpScale?: number;
  bossWorldId?: number;
}

export interface WaveDefinition {
  waveNumber: number;
  groups: WaveSpawnGroup[];
  bonusGold: number;
  isBossWave?: boolean;
}

export interface Point2D {
  x: number;
  y: number;
}

export interface TowerPad {
  index: number;
  x: number;
  y: number;
}

export type WorldThemeId =
  | 'green_valley'
  | 'dark_forest'
  | 'mountain_pass'
  | 'desert_outpost'
  | 'frozen_islands'
  | 'ancient_ruins'
  | 'industrial_city'
  | 'final_fortress';

export interface MapDefinition {
  id: string;
  namePl: string;
  nameEn: string;
  theme: WorldThemeId;
  waypoints: Point2D[];
  pads: TowerPad[];
  decorations: Array<{
    x: number;
    y: number;
    kind: 'tree' | 'rock' | 'crystal' | 'ruin' | 'factory' | 'iceberg' | 'cactus' | 'fortress_pillar';
    scale: number;
  }>;
}

export interface WorldDefinition {
  id: number; // 1..8
  theme: WorldThemeId;
  namePl: string;
  nameEn: string;
  focusPl: string;
  focusEn: string;
  descriptionPl: string;
  descriptionEn: string;
  primaryColor: string;
  secondaryColor: string;
  introducedKeys: string[];
  unlockedTower?: TowerType;
  bossNamePl: string;
  bossNameEn: string;
}

export interface MissionDefinition {
  id: string; // e.g., 'w1_m1'
  worldId: number; // 1..8
  missionIndex: number; // 1..6 within world
  globalIndex: number; // 1..48
  namePl: string;
  nameEn: string;
  subtitlePl: string;
  subtitleEn: string;
  lessonIntroPl: string;
  lessonIntroEn: string;
  mapId: string;
  newKeys: string[];
  allowedKeys: string[];
  focusCategories: ExerciseCategory[];
  requiredTypedChars: number;
  targetAccuracy: number; // e.g. 0.85
  startingGold: number;
  startingLives: number;
  waves: WaveDefinition[];
  isBossMission: boolean;
}

export interface ProjectileEffect {
  id: string;
  kind: 'bullet' | 'shell' | 'frost_pulse' | 'lightning' | 'sniper_beam' | 'shockwave' | 'orbital' | 'flame' | 'laser_beam' | 'drone_bolt';
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  chainPoints?: Point2D[];
  color: string;
  radius?: number;
  progress: number; // 0..1
  duration: number;
}

export interface FloatingTextEffect {
  id: string;
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
  maxLife: number;
}

export interface GroundHazard {
  id: string;
  x: number;
  y: number;
  radius: number;
  dps: number;
  remainingSec: number;
  kind: 'napalm' | 'permafrost';
}

export interface AchievementDefinition {
  id: string;
  namePl: string;
  nameEn: string;
  descPl: string;
  descEn: string;
  icon: string;
  xpReward: number;
  cosmeticRewardId?: string;
}

export interface CosmeticItem {
  id: string;
  namePl: string;
  nameEn: string;
  category: 'tower_skin' | 'laser_color' | 'base_emblem';
  previewColor: string;
}

export interface SessionKeyStats {
  key: string;
  attempts: number;
  correct: number;
  errors: number;
}

export interface KeyLessonObjective {
  key: string;
  requiredCorrect: number;
  correct: number;
  attempts: number;
  targetAccuracy: number;
  accuracy: number;
  completed: boolean;
}

export interface MissionProgressRecord {
  missionId: string;
  completed: boolean;
  stars: 0 | 1 | 2 | 3;
  bestAccuracy: number;
  bestWpm: number;
  bestQualifyingWpm?: number | null;
  bestScore: number;
  maxCombo?: number;
  timesCompleted: number;
  byDifficulty?: Partial<Record<DifficultyLevel, DifficultyMissionRecord>>;
}

export interface AppSettings {
  language: Language;
  musicVolume: number; // 0..1
  sfxVolume: number; // 0..1
  animationIntensity: 'low' | 'normal' | 'high';
  reducedMotion: boolean;
  typingAssistance: 'full' | 'adaptive' | 'minimal';
  difficulty: DifficultyLevel;
  textSize: 'normal' | 'large' | 'xlarge';
  defaultGameSpeed: 1 | 1.5 | 2;
  showFingerColors: boolean;
  showHandHints: boolean;
  showWpmStat: boolean;
}

export interface ChallengeBestRecord {
  challengeId: string;
  rulesetVersion: number;
  difficulty: DifficultyLevel;
  score: number;
  accuracy: number;
  wpm: number;
  correctChars: number;
  baseDamage: number;
  wavesCompleted: number;
  towerTypesUsed: TowerType[];
  timestamp: number;
}

export interface ChallengeCompletionRecord {

  challengeId: string;
  rulesetVersion: number;
  profileId: string;
  timestamp: number;
  difficulty: DifficultyLevel;
  score: number;
  accuracy: number;
  correctChars: number;
  errors: number;
  durationSec: number;
  wpm: number;
  baseDamage: number;
  wavesCompleted: number;
  towerTypesUsed: TowerType[];
  heroId: HeroId | null;
  status: 'completed' | 'failed';
}

export interface PlayerProfile {
  id: string;
  name: string;
  avatarIcon: string;
  createdAt: number;
  lastActiveAt: number;
  level: number;
  xp: number;
  unlockedTowers: TowerType[];
  unlockedUpgradeTiers: number; // 1..3
  completedMissions: Record<string, MissionProgressRecord>;
  achievements: string[];
  unlockedCosmetics: string[];
  equippedCosmetics: {
    tower_skin: string;
    laser_color: string;
    base_emblem: string;
  };
  survivalBestWave: number;
  survivalBestScore: number;
  totalPracticeTimeSec: number;
  totalCharsTyped: number;
  totalCorrectChars: number;
  bestCombo: number;
  bestWpm: number;
  bestQualifyingWpm?: number | null;
  characterMastery: Record<string, CharacterStats>;
  bigramMastery: Record<string, BigramStats>;
  sessionHistory: SessionHistoryEntry[];
  dailyStats: Record<string, DailyPracticeAggregate>;
  settings: AppSettings;
  selectedHeroId?: HeroId | null;
  explicitNoHero?: boolean;
  unlockedHeroes?: HeroId[];
  heroXp?: Partial<Record<HeroId, number>>;
  techPoints?: number;
  unlockedTechs?: string[];
  completedChallenges?: Record<
    string,
    {
      score: number;
      accuracy: number;
      timestamp: number;
      rulesetVersion?: number;
      difficulty?: DifficultyLevel;
      wpm?: number;
      baseDamage?: number;
      wavesCompleted?: number;
      towerTypesUsed?: TowerType[];
    }
  >;
  challengeBestByKey?: Record<string, ChallengeBestRecord>;
  awardedChallengeIds?: string[];
  awardedChallengeCutoffDate?: string;
  challengeHistory?: ChallengeCompletionRecord[];
  standardizedTestRecords?: Array<{
    rulesVersion?: number;
    durationSec: 30 | 60 | 120 | 0;
    pool: 'beginner' | 'full';
    language: Language;
    wpm: number;
    accuracy: number;
    consistency: number | null;
    timestamp: number;
  }>;
  skillAssessmentDone?: boolean;
  skillLevelChoice?: 'beginner' | 'intermediate' | 'advanced';
}

export interface SaveDataSchema {
  version: number;
  updatedAt?: number;
  activeProfileId: string;
  profiles: Record<string, PlayerProfile>;
}
