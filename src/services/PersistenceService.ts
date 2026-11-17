import { ACHIEVEMENTS_DATA, COSMETICS_DATA } from '../data/achievementsData';
import { MISSIONS_DATA } from '../data/curriculumData';
import { TOWER_ORDER } from '../data/towersData';
import { MasteryEngine } from '../systems/MasteryEngine';
import { StatisticsEngine } from '../systems/StatisticsEngine';
import {
  AppSettings,
  BigramStats,
  CharacterStats,
  DailyPracticeAggregate,
  DifficultyLevel,
  DifficultyMissionRecord,
  GameMode,
  Language,
  MasteryStatus,
  MissionProgressRecord,
  PlayerProfile,
  SaveDataSchema,
  SessionCompletionStatus,
  SessionHistoryEntry,
  TowerType,
} from '../types';

export const STORAGE_KEY = 'keyfort_td_save_data';
export const CURRENT_SAVE_VERSION = 3;

const VALID_TOWERS = new Set<TowerType>(TOWER_ORDER);
const VALID_ACHIEVEMENTS = new Set<string>(ACHIEVEMENTS_DATA.map((a) => a.id));
const VALID_COSMETICS = new Set<string>(COSMETICS_DATA.map((c) => c.id));
const VALID_MISSIONS = new Set<string>(MISSIONS_DATA.map((m) => m.id));
const VALID_MASTERY_STATUS = new Set<MasteryStatus>(['locked', 'learning', 'practicing', 'mastered']);
const VALID_GAME_MODES = new Set<GameMode>(['campaign', 'survival', 'sandbox']);
const VALID_SESSION_STATUS = new Set<SessionCompletionStatus>([
  'completed',
  'victory',
  'defeat',
  'abandoned',
]);
const VALID_ANIM_INTENSITY = new Set<AppSettings['animationIntensity']>(['low', 'normal', 'high']);
const VALID_ASSISTANCE = new Set<AppSettings['typingAssistance']>(['full', 'adaptive', 'minimal']);
const VALID_DIFFICULTY = new Set<DifficultyLevel>(['relaxed', 'standard', 'tactical']);
const VALID_TEXT_SIZE = new Set<AppSettings['textSize']>(['normal', 'large', 'xlarge']);
const VALID_GAME_SPEED = new Set<AppSettings['defaultGameSpeed']>([1, 1.5, 2]);

const RESERVED_OBJECT_KEYS = new Set<string>([
  '__proto__',
  'constructor',
  'prototype',
  'toString',
  'valueOf',
  'hasOwnProperty',
  'isPrototypeOf',
  'propertyIsEnumerable',
  'toLocaleString',
]);

function isPlainObject(val: unknown): val is Record<string, unknown> {
  if (!val || typeof val !== 'object' || Array.isArray(val)) return false;
  const proto = Object.getPrototypeOf(val);
  return proto === null || proto === Object.prototype;
}

function isFiniteNumber(val: unknown): val is number {
  return typeof val === 'number' && Number.isFinite(val);
}

function clampFinite(val: unknown, min: number, max: number, fallback: number): number {
  if (!isFiniteNumber(val)) return fallback;
  return Math.max(min, Math.min(max, val));
}

export function isSafeProfileId(id: string): boolean {
  if (RESERVED_OBJECT_KEYS.has(id)) return false;
  return id.length >= 1 && id.length <= 80 && /^[a-zA-Z0-9_-]+$/.test(id);
}

export class PersistenceService {
  private data: SaveDataSchema;
  private throttleTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingFlush: boolean = false;
  private lastStorageError: string | null = null;
  private onExternalSyncCallback: (() => void) | null = null;

  constructor() {
    this.data = this.loadFromStorage();
    this.bindLifecycleAndMultiTabSync();
  }

  public setOnExternalSync(cb: () => void): void {
    this.onExternalSyncCallback = cb;
  }

  public getLastStorageError(): string | null {
    return this.lastStorageError;
  }

  public clearStorageError(): void {
    this.lastStorageError = null;
  }

  private bindLifecycleAndMultiTabSync(): void {
    if (typeof window === 'undefined') return;
    const flush = () => this.flushSave();
    window.addEventListener('pagehide', flush);
    window.addEventListener('beforeunload', flush);
    window.addEventListener('storage', (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        try {
          const incoming = PersistenceService.parseAndValidateSaveData(JSON.parse(e.newValue), false);
          const incomingTs = incoming.updatedAt ?? 0;
          const localTs = this.data.updatedAt ?? 0;
          if (incomingTs >= localTs) {
            this.data = incoming;
            this.onExternalSyncCallback?.();
          }
        } catch {
          // Ignore malformed external storage event
        }
      }
    });
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
          this.flushSave();
        }
      });
    }
  }

  public static createDefaultSettings(): AppSettings {
    return {
      language: 'pl',
      musicVolume: 0.35,
      sfxVolume: 0.65,
      animationIntensity: 'high',
      reducedMotion: false,
      typingAssistance: 'adaptive',
      difficulty: 'standard',
      textSize: 'normal',
      defaultGameSpeed: 1,
      showFingerColors: true,
      showHandHints: true,
      showWpmStat: true,
    };
  }

  public static createDefaultProfile(
    id: string = 'profile_default',
    name: string = 'Obrońca #1',
    avatarIcon: string = '🛡️'
  ): PlayerProfile {
    const now = Date.now();
    const safeId = isSafeProfileId(id) ? id : 'profile_default';
    return {
      id: safeId,
      name: name.slice(0, 48) || 'Obrońca #1',
      avatarIcon: avatarIcon.slice(0, 8) || '🛡️',
      createdAt: now,
      lastActiveAt: now,
      level: 1,
      xp: 0,
      unlockedTowers: ['gun', 'cannon'],
      unlockedUpgradeTiers: 1,
      completedMissions: {},
      achievements: [],
      unlockedCosmetics: ['skin_standard', 'laser_cyan', 'emblem_shield'],
      equippedCosmetics: {
        tower_skin: 'skin_standard',
        laser_color: 'laser_cyan',
        base_emblem: 'emblem_shield',
      },
      survivalBestWave: 0,
      survivalBestScore: 0,
      totalPracticeTimeSec: 0,
      totalCharsTyped: 0,
      totalCorrectChars: 0,
      bestCombo: 0,
      bestWpm: 0,
      bestQualifyingWpm: null,
      characterMastery: {},
      bigramMastery: {},
      sessionHistory: [],
      dailyStats: {},
      settings: PersistenceService.createDefaultSettings(),
    };
  }

  public static createDefaultSaveData(): SaveDataSchema {
    const defaultProfile = PersistenceService.createDefaultProfile();
    return {
      version: CURRENT_SAVE_VERSION,
      updatedAt: Date.now(),
      activeProfileId: defaultProfile.id,
      profiles: {
        [defaultProfile.id]: defaultProfile,
      },
    };
  }

  /**
   * Strictly validates and migrates untrusted input (v0, v1, v2, v3).
   * In strict mode (used by importSaveJson), throws an error if the schema, profile keys, or critical fields are malformed.
   */
  public static parseAndValidateSaveData(raw: unknown, strict: boolean = false): SaveDataSchema {
    if (!isPlainObject(raw)) {
      if (strict) throw new Error('Save data must be a plain JSON object');
      return PersistenceService.createDefaultSaveData();
    }

    // Legacy v0 single-profile object at root (no `profiles` map, has string `name`)
    if (!('profiles' in raw) && typeof raw.name === 'string') {
      if ('version' in raw && raw.version !== 0 && raw.version !== 1) {
        if (strict) throw new Error('Unsupported legacy save version');
      }
      const migratedProfile = PersistenceService.validateProfile(raw, 'profile_migrated', strict);
      return {
        version: CURRENT_SAVE_VERSION,
        updatedAt: Date.now(),
        activeProfileId: migratedProfile.id,
        profiles: {
          [migratedProfile.id]: migratedProfile,
        },
      };
    }

    // Version check for v1 / v2 / v3 multi-profile schema
    if ('version' in raw) {
      if (
        !isFiniteNumber(raw.version) ||
        !Number.isInteger(raw.version) ||
        raw.version < 1 ||
        raw.version > CURRENT_SAVE_VERSION
      ) {
        if (strict) throw new Error(`Unsupported save version: ${String(raw.version)}`);
        return PersistenceService.createDefaultSaveData();
      }
    } else if (strict) {
      throw new Error('Missing save version field');
    }

    if (!isPlainObject(raw.profiles)) {
      if (strict) throw new Error('Missing or invalid profiles map');
      return PersistenceService.createDefaultSaveData();
    }

    const validProfiles: Record<string, PlayerProfile> = Object.create(null);
    const seenIds = new Set<string>();

    for (const [key, pVal] of Object.entries(raw.profiles)) {
      if (RESERVED_OBJECT_KEYS.has(key)) {
        if (strict) throw new Error(`Reserved object property name not allowed as profile key: ${key}`);
        continue;
      }
      if (!isSafeProfileId(key)) {
        if (strict) throw new Error(`Invalid profile identifier: ${key}`);
        continue;
      }
      if (!isPlainObject(pVal)) {
        if (strict) throw new Error(`Profile "${key}" must be an object`);
        continue;
      }
      if (strict && 'id' in pVal && typeof pVal.id === 'string' && pVal.id !== key) {
        throw new Error(`Mismatched profile key "${key}" and profile.id "${pVal.id}"`);
      }
      const profile = PersistenceService.validateProfile(pVal, key, strict);
      // Canonicalize profile.id to match its verified map key unless strict mode already verified equality
      profile.id = key;
      if (seenIds.has(profile.id)) {
        if (strict) throw new Error(`Duplicate profile identifier: ${profile.id}`);
        continue;
      }
      seenIds.add(profile.id);
      validProfiles[profile.id] = profile;
    }

    const ids = Object.keys(validProfiles);
    if (ids.length === 0) {
      if (strict) throw new Error('Save contains no valid player profiles');
      return PersistenceService.createDefaultSaveData();
    }

    let activeId = ids[0];
    if (typeof raw.activeProfileId === 'string') {
      if (!RESERVED_OBJECT_KEYS.has(raw.activeProfileId) && validProfiles[raw.activeProfileId]) {
        activeId = raw.activeProfileId;
      } else if (strict) {
        throw new Error(`activeProfileId "${raw.activeProfileId}" does not exist in profiles`);
      }
    } else if (strict) {
      throw new Error('activeProfileId must be a string');
    }

    const normalizedProfiles: Record<string, PlayerProfile> = {};
    for (const id of ids) {
      normalizedProfiles[id] = validProfiles[id];
    }

    return {
      version: CURRENT_SAVE_VERSION,
      updatedAt: isFiniteNumber(raw.updatedAt) ? Math.floor(raw.updatedAt) : Date.now(),
      activeProfileId: activeId,
      profiles: normalizedProfiles,
    };
  }

  public static migrateAndValidateSaveData(raw: unknown): SaveDataSchema {
    try {
      return PersistenceService.parseAndValidateSaveData(raw, false);
    } catch {
      return PersistenceService.createDefaultSaveData();
    }
  }

  private static validateProfile(
    raw: Record<string, unknown>,
    fallbackId: string,
    strict: boolean
  ): PlayerProfile {
    const rawId = typeof raw.id === 'string' && raw.id.length > 0 ? raw.id : fallbackId;
    if (!isSafeProfileId(rawId)) {
      if (strict) throw new Error(`Invalid profile id: ${rawId}`);
    }
    const safeId = isSafeProfileId(rawId) ? rawId : fallbackId;

    if (strict && (typeof raw.name !== 'string' || raw.name.trim().length === 0)) {
      throw new Error(`Profile "${safeId}" has an invalid name`);
    }
    const name =
      typeof raw.name === 'string' && raw.name.trim().length > 0
        ? raw.name.trim().slice(0, 48)
        : 'Obrońca';
    const avatarIcon =
      typeof raw.avatarIcon === 'string' && raw.avatarIcon.trim().length > 0
        ? raw.avatarIcon.trim().slice(0, 8)
        : '🛡️';

    const def = PersistenceService.createDefaultProfile(safeId, name, avatarIcon);

    if (strict) {
      const numericFields = [
        'level',
        'xp',
        'unlockedUpgradeTiers',
        'survivalBestWave',
        'survivalBestScore',
        'totalPracticeTimeSec',
        'totalCharsTyped',
        'totalCorrectChars',
        'bestCombo',
        'bestWpm',
      ] as const;
      for (const field of numericFields) {
        if (field in raw && (!isFiniteNumber(raw[field]) || (raw[field] as number) < 0)) {
          throw new Error(`Invalid numeric value for profile.${field}`);
        }
      }
    }

    // Validate settings first so default difficulty is known when migrating v2 mission records
    const settings = PersistenceService.validateSettings(raw.settings, def.settings, strict);

    const level = Math.floor(clampFinite(raw.level, 1, 999, 1));
    const xp = Math.floor(clampFinite(raw.xp, 0, 10000000, 0));
    const unlockedUpgradeTiers = Math.floor(clampFinite(raw.unlockedUpgradeTiers, 1, 3, 1));

    // Validate unlockedTowers
    const unlockedTowers: TowerType[] = ['gun', 'cannon'];
    if (Array.isArray(raw.unlockedTowers)) {
      for (const item of raw.unlockedTowers) {
        if (typeof item === 'string' && VALID_TOWERS.has(item as TowerType)) {
          if (!unlockedTowers.includes(item as TowerType)) {
            unlockedTowers.push(item as TowerType);
          }
        } else if (strict) {
          throw new Error(`Invalid tower type in unlockedTowers: ${String(item)}`);
        }
      }
    } else if ('unlockedTowers' in raw && strict) {
      throw new Error('unlockedTowers must be an array');
    }

    // Validate completedMissions (with v2 -> v3 difficulty record migration)
    const completedMissions: Record<string, MissionProgressRecord> = {};
    if (isPlainObject(raw.completedMissions)) {
      for (const [mId, mVal] of Object.entries(raw.completedMissions)) {
        if (!VALID_MISSIONS.has(mId)) {
          if (strict) throw new Error(`Unknown mission ID in completedMissions: ${mId}`);
          continue;
        }
        if (!isPlainObject(mVal)) {
          if (strict) throw new Error(`Invalid mission record for ${mId}`);
          continue;
        }
        if (
          strict &&
          ((mVal.stars !== undefined && (!isFiniteNumber(mVal.stars) || mVal.stars < 0 || mVal.stars > 3)) ||
            (mVal.bestAccuracy !== undefined &&
              (!isFiniteNumber(mVal.bestAccuracy) || mVal.bestAccuracy < 0 || mVal.bestAccuracy > 1)))
        ) {
          throw new Error(`Invalid mission stats in ${mId}`);
        }
        const starsRaw = Math.round(clampFinite(mVal.stars, 0, 3, 0)) as 0 | 1 | 2 | 3;
        const bestAccuracy = clampFinite(mVal.bestAccuracy, 0, 1, 0);
        const bestWpm = Math.round(clampFinite(mVal.bestWpm, 0, 400, 0));
        const bestQualifyingWpm =
          mVal.bestQualifyingWpm === null
            ? null
            : isFiniteNumber(mVal.bestQualifyingWpm)
            ? Math.round(clampFinite(mVal.bestQualifyingWpm, 0, 400, 0))
            : bestWpm > 0
            ? bestWpm
            : null;
        const bestScore = Math.round(clampFinite(mVal.bestScore, 0, 10000000, 0));
        const maxCombo = Math.floor(clampFinite(mVal.maxCombo, 0, 100000, 0));
        const timesCompleted = Math.floor(
          clampFinite(mVal.timesCompleted, 0, 100000, mVal.completed ? 1 : 0)
        );

        const byDifficulty: Partial<Record<DifficultyLevel, DifficultyMissionRecord>> = {};
        if (isPlainObject(mVal.byDifficulty)) {
          for (const [dKey, dVal] of Object.entries(mVal.byDifficulty)) {
            if (!VALID_DIFFICULTY.has(dKey as DifficultyLevel) || !isPlainObject(dVal)) {
              if (strict) throw new Error(`Invalid byDifficulty entry "${dKey}" in ${mId}`);
              continue;
            }
            const diff = dKey as DifficultyLevel;
            byDifficulty[diff] = {
              difficulty: diff,
              completed: Boolean(dVal.completed),
              stars: Math.round(clampFinite(dVal.stars, 0, 3, 0)) as 0 | 1 | 2 | 3,
              bestAccuracy: clampFinite(dVal.bestAccuracy, 0, 1, 0),
              bestWpm: Math.round(clampFinite(dVal.bestWpm, 0, 400, 0)),
              bestQualifyingWpm:
                dVal.bestQualifyingWpm === null
                  ? null
                  : isFiniteNumber(dVal.bestQualifyingWpm)
                  ? Math.round(clampFinite(dVal.bestQualifyingWpm, 0, 400, 0))
                  : null,
              bestScore: Math.round(clampFinite(dVal.bestScore, 0, 10000000, 0)),
              maxCombo: Math.floor(clampFinite(dVal.maxCombo, 0, 100000, 0)),
              timesCompleted: Math.floor(clampFinite(dVal.timesCompleted, 0, 100000, 1)),
            };
          }
        } else if (Boolean(mVal.completed)) {
          // Migrate v2 completed mission record into profile's difficulty bucket
          byDifficulty[settings.difficulty] = {
            difficulty: settings.difficulty,
            completed: true,
            stars: starsRaw,
            bestAccuracy,
            bestWpm,
            bestQualifyingWpm,
            bestScore,
            maxCombo,
            timesCompleted,
          };
        }

        completedMissions[mId] = {
          missionId: mId,
          completed: Boolean(mVal.completed),
          stars: starsRaw,
          bestAccuracy,
          bestWpm,
          bestQualifyingWpm,
          bestScore,
          maxCombo,
          timesCompleted,
          byDifficulty,
        };
      }
    } else if ('completedMissions' in raw && strict) {
      throw new Error('completedMissions must be an object');
    }

    // Validate achievements
    const achievements: string[] = [];
    if (Array.isArray(raw.achievements)) {
      for (const ach of raw.achievements) {
        if (typeof ach === 'string' && VALID_ACHIEVEMENTS.has(ach)) {
          if (!achievements.includes(ach)) achievements.push(ach);
        } else if (strict) {
          throw new Error(`Invalid achievement ID: ${String(ach)}`);
        }
      }
    } else if ('achievements' in raw && strict) {
      throw new Error('achievements must be an array');
    }

    // Validate cosmetics
    const unlockedCosmetics = [...def.unlockedCosmetics];
    if (Array.isArray(raw.unlockedCosmetics)) {
      for (const cos of raw.unlockedCosmetics) {
        if (typeof cos === 'string' && VALID_COSMETICS.has(cos)) {
          if (!unlockedCosmetics.includes(cos)) unlockedCosmetics.push(cos);
        } else if (strict) {
          throw new Error(`Invalid cosmetic ID: ${String(cos)}`);
        }
      }
    }

    const equippedCosmetics = { ...def.equippedCosmetics };
    if (isPlainObject(raw.equippedCosmetics)) {
      const eq = raw.equippedCosmetics;
      if (typeof eq.tower_skin === 'string' && VALID_COSMETICS.has(eq.tower_skin)) {
        equippedCosmetics.tower_skin = eq.tower_skin;
      }
      if (typeof eq.laser_color === 'string' && VALID_COSMETICS.has(eq.laser_color)) {
        equippedCosmetics.laser_color = eq.laser_color;
      }
      if (typeof eq.base_emblem === 'string' && VALID_COSMETICS.has(eq.base_emblem)) {
        equippedCosmetics.base_emblem = eq.base_emblem;
      }
    }

    // Validate characterMastery
    const characterMastery: Record<string, CharacterStats> = {};
    if (isPlainObject(raw.characterMastery)) {
      for (const [ch, statVal] of Object.entries(raw.characterMastery)) {
        if (RESERVED_OBJECT_KEYS.has(ch)) continue;
        if (ch.length !== 1 || !isPlainObject(statVal)) {
          if (strict) throw new Error(`Invalid characterMastery entry for "${ch}"`);
          continue;
        }
        if (strict && statVal.status !== undefined && !VALID_MASTERY_STATUS.has(statVal.status as MasteryStatus)) {
          throw new Error(`Invalid mastery status for "${ch}": ${String(statVal.status)}`);
        }
        const status: MasteryStatus = VALID_MASTERY_STATUS.has(statVal.status as MasteryStatus)
          ? (statVal.status as MasteryStatus)
          : 'learning';
        const attempts = Math.floor(clampFinite(statVal.attempts, 0, 1000000, 0));
        const correct = Math.floor(clampFinite(statVal.correct, 0, attempts, 0));
        const errors = Math.floor(clampFinite(statVal.errors, 0, 1000000, Math.max(0, attempts - correct)));

        const confusedWith: Record<string, number> = {};
        if (isPlainObject(statVal.confusedWith)) {
          for (const [cKey, cCount] of Object.entries(statVal.confusedWith)) {
            if (cKey.length === 1 && isFiniteNumber(cCount) && cCount > 0) {
              confusedWith[cKey] = Math.floor(cCount);
            }
          }
        }

        characterMastery[ch] = {
          char: ch,
          attempts,
          correct,
          errors,
          avgReactionMs: Math.round(clampFinite(statVal.avgReactionMs, 60, 5000, 650)),
          bestReactionMs: Math.round(clampFinite(statVal.bestReactionMs, 60, 9999, 9999)),
          lastPracticedAt: Math.floor(clampFinite(statVal.lastPracticedAt, 0, Number.MAX_SAFE_INTEGER, 0)),
          nextReviewAt: Math.floor(clampFinite(statVal.nextReviewAt, 0, Number.MAX_SAFE_INTEGER, 0)),
          consecutiveCorrect: Math.floor(clampFinite(statVal.consecutiveCorrect, 0, 100000, 0)),
          confusedWith,
          masteryScore: Math.round(clampFinite(statVal.masteryScore, 0, 100, 0)),
          status,
        };
      }
    } else if ('characterMastery' in raw && strict) {
      throw new Error('characterMastery must be an object');
    }

    // Validate bigramMastery
    const bigramMastery: Record<string, BigramStats> = {};
    if (isPlainObject(raw.bigramMastery)) {
      for (const [bg, bVal] of Object.entries(raw.bigramMastery)) {
        if (RESERVED_OBJECT_KEYS.has(bg)) continue;
        if (bg.length !== 2 || !isPlainObject(bVal)) {
          if (strict) throw new Error(`Invalid bigramMastery entry for "${bg}"`);
          continue;
        }
        const attempts = Math.floor(clampFinite(bVal.attempts, 0, 1000000, 0));
        const correct = Math.floor(clampFinite(bVal.correct, 0, attempts, 0));
        const errors = Math.floor(clampFinite(bVal.errors, 0, 1000000, Math.max(0, attempts - correct)));
        bigramMastery[bg] = {
          bigram: bg,
          attempts,
          correct,
          errors,
          avgTransitionMs: Math.round(clampFinite(bVal.avgTransitionMs, 60, 5000, 500)),
        };
      }
    } else if ('bigramMastery' in raw && strict) {
      throw new Error('bigramMastery must be an object');
    }

    // Validate sessionHistory
    const sessionHistory: SessionHistoryEntry[] = [];
    if (Array.isArray(raw.sessionHistory)) {
      for (const entry of raw.sessionHistory.slice(-60)) {
        if (!isPlainObject(entry)) {
          if (strict) throw new Error('Invalid sessionHistory entry');
          continue;
        }
        const mode: GameMode = VALID_GAME_MODES.has(entry.mode as GameMode)
          ? (entry.mode as GameMode)
          : 'campaign';
        const difficulty: DifficultyLevel = VALID_DIFFICULTY.has(entry.difficulty as DifficultyLevel)
          ? (entry.difficulty as DifficultyLevel)
          : settings.difficulty;
        const status: SessionCompletionStatus | undefined = VALID_SESSION_STATUS.has(
          entry.status as SessionCompletionStatus
        )
          ? (entry.status as SessionCompletionStatus)
          : entry.victory === false
          ? 'defeat'
          : 'completed';

        const charsTyped = Math.floor(clampFinite(entry.charsTyped, 0, 100000, 0));
        const durationSec = Math.round(clampFinite(entry.durationSec, 0, 86400, 0));
        const qualifyingWpm =
          entry.qualifyingWpm === null
            ? null
            : isFiniteNumber(entry.qualifyingWpm)
            ? Math.round(clampFinite(entry.qualifyingWpm, 0, 300, 0))
            : StatisticsEngine.computeQualifyingWpm(charsTyped, durationSec);

        sessionHistory.push({
          sessionId: typeof entry.sessionId === 'string' ? entry.sessionId.slice(0, 64) : undefined,
          profileId: typeof entry.profileId === 'string' ? entry.profileId.slice(0, 80) : safeId,
          timestamp: Math.floor(clampFinite(entry.timestamp, 0, Number.MAX_SAFE_INTEGER, Date.now())),
          missionId: typeof entry.missionId === 'string' ? entry.missionId.slice(0, 40) : 'w1_m1',
          mode,
          difficulty,
          status,
          tacticalVictory: typeof entry.tacticalVictory === 'boolean' ? entry.tacticalVictory : undefined,
          educationalCompleted:
            typeof entry.educationalCompleted === 'boolean' ? entry.educationalCompleted : undefined,
          wpm: Math.round(clampFinite(entry.wpm, 0, 300, 0)),
          qualifyingWpm,
          accuracy: clampFinite(entry.accuracy, 0, 1, 0),
          durationSec,
          charsTyped,
          errors: Math.floor(clampFinite(entry.errors, 0, 100000, 0)),
          maxCombo: Math.floor(clampFinite(entry.maxCombo, 0, 100000, 0)),
          score: isFiniteNumber(entry.score) ? Math.round(clampFinite(entry.score, 0, 10000000, 0)) : undefined,
          stars: isFiniteNumber(entry.stars)
            ? (Math.round(clampFinite(entry.stars, 0, 3, 0)) as 0 | 1 | 2 | 3)
            : undefined,
          wavesCompleted: isFiniteNumber(entry.wavesCompleted)
            ? Math.floor(clampFinite(entry.wavesCompleted, 0, 9999, 0))
            : undefined,
        });
      }
    } else if ('sessionHistory' in raw && strict) {
      throw new Error('sessionHistory must be an array');
    }

    // Validate or reconstruct dailyStats
    const masteredCount = MasteryEngine.getMasteredCharacters(characterMastery).length;
    let dailyStats: Record<string, DailyPracticeAggregate> = {};
    if (isPlainObject(raw.dailyStats)) {
      for (const [dKey, dVal] of Object.entries(raw.dailyStats)) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(dKey) || !isPlainObject(dVal)) {
          if (strict) throw new Error(`Invalid dailyStats entry "${dKey}"`);
          continue;
        }
        dailyStats[dKey] = {
          date: dKey,
          practiceTimeSec: Math.floor(clampFinite(dVal.practiceTimeSec, 0, 864000, 0)),
          correctChars: Math.floor(clampFinite(dVal.correctChars, 0, 10000000, 0)),
          errorChars: Math.floor(clampFinite(dVal.errorChars, 0, 10000000, 0)),
          sessionsCount: Math.floor(clampFinite(dVal.sessionsCount, 0, 100000, 0)),
          missionsCompleted: Math.floor(clampFinite(dVal.missionsCompleted, 0, 100000, 0)),
          masteredCountSnapshot: Math.floor(clampFinite(dVal.masteredCountSnapshot, 0, 500, masteredCount)),
        };
      }
    } else if (sessionHistory.length > 0) {
      dailyStats = StatisticsEngine.reconstructDailyStatsFromHistory(sessionHistory, masteredCount);
    }

    const totalCorrectChars = Math.floor(clampFinite(raw.totalCorrectChars, 0, 100000000, 0));
    const bestWpm = Math.floor(clampFinite(raw.bestWpm, 0, 400, 0));
    const bestQualifyingWpm =
      raw.bestQualifyingWpm === null
        ? null
        : isFiniteNumber(raw.bestQualifyingWpm)
        ? Math.floor(clampFinite(raw.bestQualifyingWpm, 0, 400, 0))
        : totalCorrectChars >= 20 && bestWpm > 0
        ? bestWpm
        : null;

    return {
      ...def,
      createdAt: Math.floor(clampFinite(raw.createdAt, 0, Number.MAX_SAFE_INTEGER, def.createdAt)),
      lastActiveAt: Math.floor(clampFinite(raw.lastActiveAt, 0, Number.MAX_SAFE_INTEGER, def.lastActiveAt)),
      level,
      xp,
      unlockedTowers,
      unlockedUpgradeTiers,
      completedMissions,
      achievements,
      unlockedCosmetics,
      equippedCosmetics,
      survivalBestWave: Math.floor(clampFinite(raw.survivalBestWave, 0, 10000, 0)),
      survivalBestScore: Math.floor(clampFinite(raw.survivalBestScore, 0, 100000000, 0)),
      totalPracticeTimeSec: Math.floor(clampFinite(raw.totalPracticeTimeSec, 0, 100000000, 0)),
      totalCharsTyped: Math.floor(clampFinite(raw.totalCharsTyped, 0, 100000000, 0)),
      totalCorrectChars,
      bestCombo: Math.floor(clampFinite(raw.bestCombo, 0, 1000000, 0)),
      bestWpm,
      bestQualifyingWpm,
      characterMastery,
      bigramMastery,
      sessionHistory,
      dailyStats,
      settings,
    };
  }

  private static validateSettings(
    raw: unknown,
    fallback: AppSettings,
    strict: boolean
  ): AppSettings {
    if (raw === undefined) return { ...fallback };
    if (!isPlainObject(raw)) {
      if (strict) throw new Error('settings must be an object');
      return { ...fallback };
    }

    if (strict) {
      if ('language' in raw && raw.language !== 'pl' && raw.language !== 'en') {
        throw new Error(`Invalid settings.language: ${String(raw.language)}`);
      }
      if ('difficulty' in raw && !VALID_DIFFICULTY.has(raw.difficulty as DifficultyLevel)) {
        throw new Error(`Invalid settings.difficulty: ${String(raw.difficulty)}`);
      }
      if ('typingAssistance' in raw && !VALID_ASSISTANCE.has(raw.typingAssistance as AppSettings['typingAssistance'])) {
        throw new Error(`Invalid settings.typingAssistance: ${String(raw.typingAssistance)}`);
      }
      if ('animationIntensity' in raw && !VALID_ANIM_INTENSITY.has(raw.animationIntensity as AppSettings['animationIntensity'])) {
        throw new Error(`Invalid settings.animationIntensity: ${String(raw.animationIntensity)}`);
      }
      if ('textSize' in raw && !VALID_TEXT_SIZE.has(raw.textSize as AppSettings['textSize'])) {
        throw new Error(`Invalid settings.textSize: ${String(raw.textSize)}`);
      }
      if ('defaultGameSpeed' in raw && !VALID_GAME_SPEED.has(raw.defaultGameSpeed as AppSettings['defaultGameSpeed'])) {
        throw new Error(`Invalid settings.defaultGameSpeed: ${String(raw.defaultGameSpeed)}`);
      }
      if ('musicVolume' in raw && (!isFiniteNumber(raw.musicVolume) || raw.musicVolume < 0 || raw.musicVolume > 1)) {
        throw new Error('Invalid settings.musicVolume');
      }
      if ('sfxVolume' in raw && (!isFiniteNumber(raw.sfxVolume) || raw.sfxVolume < 0 || raw.sfxVolume > 1)) {
        throw new Error('Invalid settings.sfxVolume');
      }
    }

    const language: Language = raw.language === 'en' ? 'en' : 'pl';
    const animationIntensity = VALID_ANIM_INTENSITY.has(raw.animationIntensity as AppSettings['animationIntensity'])
      ? (raw.animationIntensity as AppSettings['animationIntensity'])
      : fallback.animationIntensity;
    const typingAssistance = VALID_ASSISTANCE.has(raw.typingAssistance as AppSettings['typingAssistance'])
      ? (raw.typingAssistance as AppSettings['typingAssistance'])
      : fallback.typingAssistance;
    const difficulty = VALID_DIFFICULTY.has(raw.difficulty as DifficultyLevel)
      ? (raw.difficulty as DifficultyLevel)
      : fallback.difficulty;
    const textSize = VALID_TEXT_SIZE.has(raw.textSize as AppSettings['textSize'])
      ? (raw.textSize as AppSettings['textSize'])
      : fallback.textSize;
    const defaultGameSpeed = VALID_GAME_SPEED.has(raw.defaultGameSpeed as AppSettings['defaultGameSpeed'])
      ? (raw.defaultGameSpeed as AppSettings['defaultGameSpeed'])
      : fallback.defaultGameSpeed;

    return {
      language,
      musicVolume: clampFinite(raw.musicVolume, 0, 1, fallback.musicVolume),
      sfxVolume: clampFinite(raw.sfxVolume, 0, 1, fallback.sfxVolume),
      animationIntensity,
      reducedMotion: typeof raw.reducedMotion === 'boolean' ? raw.reducedMotion : fallback.reducedMotion,
      typingAssistance,
      difficulty,
      textSize,
      defaultGameSpeed,
      showFingerColors: typeof raw.showFingerColors === 'boolean' ? raw.showFingerColors : fallback.showFingerColors,
      showHandHints: typeof raw.showHandHints === 'boolean' ? raw.showHandHints : fallback.showHandHints,
      showWpmStat: typeof raw.showWpmStat === 'boolean' ? raw.showWpmStat : fallback.showWpmStat,
    };
  }

  public loadFromStorage(): SaveDataSchema {
    try {
      if (typeof localStorage === 'undefined') {
        this.lastStorageError = 'localStorage is unavailable in this environment.';
        return PersistenceService.createDefaultSaveData();
      }
      const rawJson = localStorage.getItem(STORAGE_KEY);
      if (!rawJson) {
        const fresh = PersistenceService.createDefaultSaveData();
        this.saveToStorage(fresh);
        return fresh;
      }
      const parsed = JSON.parse(rawJson);
      return PersistenceService.migrateAndValidateSaveData(parsed);
    } catch (e) {
      this.lastStorageError = e instanceof Error ? e.message : 'Storage read failure';
      return PersistenceService.createDefaultSaveData();
    }
  }

  /**
   * Immediately writes save state to localStorage and cancels any pending throttled write.
   * Returns true if persisted to localStorage, or false if storage failed (recording lastStorageError).
   */
  public saveToStorage(customData?: SaveDataSchema): boolean {
    if (this.throttleTimer !== null) {
      clearTimeout(this.throttleTimer);
      this.throttleTimer = null;
    }
    this.pendingFlush = false;
    const target = customData ?? this.data;
    target.version = CURRENT_SAVE_VERSION;
    target.updatedAt = Date.now();
    this.data = target;
    try {
      if (typeof localStorage === 'undefined') {
        this.lastStorageError = 'Pamięć przeglądarki (localStorage) jest niedostępna.';
        return false;
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(target));
      this.lastStorageError = null;
      return true;
    } catch (e) {
      this.lastStorageError =
        e instanceof Error
          ? `Błąd zapisu danych (${e.name}): ${e.message}`
          : 'Przekroczono limit pamięci przeglądarki (localStorage).';
      return false;
    }
  }

  public requestThrottledSave(delayMs: number = 2000): void {
    this.pendingFlush = true;
    if (this.throttleTimer !== null) return;
    this.throttleTimer = setTimeout(() => {
      this.throttleTimer = null;
      if (this.pendingFlush) {
        this.saveToStorage();
      }
    }, delayMs);
  }

  public flushSave(): void {
    if (this.pendingFlush || this.throttleTimer !== null) {
      this.saveToStorage();
    }
  }

  public getProfileById(profileId: string): PlayerProfile | undefined {
    if (RESERVED_OBJECT_KEYS.has(profileId)) return undefined;
    return Object.prototype.hasOwnProperty.call(this.data.profiles, profileId)
      ? this.data.profiles[profileId]
      : undefined;
  }

  public getActiveProfile(): PlayerProfile {
    const profile = this.getProfileById(this.data.activeProfileId);
    if (profile) return profile;
    const firstId = Object.keys(this.data.profiles)[0];
    if (firstId) {
      this.data.activeProfileId = firstId;
      return this.data.profiles[firstId];
    }
    const def = PersistenceService.createDefaultProfile();
    this.data.profiles[def.id] = def;
    this.data.activeProfileId = def.id;
    return def;
  }

  public getAllProfiles(): PlayerProfile[] {
    return Object.values(this.data.profiles);
  }

  public switchProfile(profileId: string): PlayerProfile {
    const target = this.getProfileById(profileId);
    if (target) {
      this.data.activeProfileId = profileId;
      target.lastActiveAt = Date.now();
      this.saveToStorage();
    }
    return this.getActiveProfile();
  }

  public createProfile(name: string, avatarIcon: string = '🚀'): PlayerProfile {
    const id = `profile_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    const currentLang = this.getActiveProfile().settings.language;
    const newProfile = PersistenceService.createDefaultProfile(id, name.trim() || 'Nowy Gracz', avatarIcon);
    newProfile.settings.language = currentLang;
    this.data.profiles[id] = newProfile;
    this.data.activeProfileId = id;
    this.saveToStorage();
    return newProfile;
  }

  /**
   * Renames and updates the avatar of an existing profile (e.g. assigning an existing
   * anonymous default/migrated profile to a named family member while preserving all progress).
   */
  public assignOrRenameProfile(profileId: string, newName: string, newAvatarIcon?: string): PlayerProfile | null {
    const target = this.getProfileById(profileId);
    if (!target) return null;
    const trimmed = newName.trim().slice(0, 48);
    if (!trimmed) return null;
    target.name = trimmed;
    if (newAvatarIcon && newAvatarIcon.trim()) {
      target.avatarIcon = newAvatarIcon.trim().slice(0, 8);
    }
    target.lastActiveAt = Date.now();
    this.saveToStorage();
    return target;
  }

  /**
   * Creates up to 3 (or more) local family profiles in one atomic operation.
   * If `assignExistingProfileId` is provided (or if only an anonymous default profile exists
   * and `assignExistingToFirst` is true), assigns that existing profile to the first entry
   * so existing progress is preserved without duplication or loss.
   */
  public setupFamilyProfiles(
    entries: Array<{ name: string; avatarIcon?: string; avatar?: string }>,
    options: boolean | { assignExistingToFirst?: boolean; assignExistingProfileId?: string } = {
      assignExistingToFirst: true,
    }
  ): PlayerProfile[] {
    const normalizedOptions =
      typeof options === 'boolean' ? { assignExistingToFirst: options } : options;
    const validEntries = entries
      .map((e, idx) => ({
        name: e.name.trim().slice(0, 48),
        avatarIcon: (
          (e.avatarIcon ?? e.avatar)?.trim() || ['🦊', '🦄', '🐉', '🚀', '🛡️'][idx % 5]
        ).slice(0, 8),
      }))
      .filter((e) => e.name.length > 0);

    if (validEntries.length === 0) return this.getAllProfiles();

    const currentLang = this.getActiveProfile().settings.language;
    const createdOrUpdated: PlayerProfile[] = [];
    const existingIds = Object.keys(this.data.profiles);

    let targetAssignId = normalizedOptions.assignExistingProfileId;
    if (!targetAssignId && normalizedOptions.assignExistingToFirst) {
      if (this.data.profiles.profile_default) {
        targetAssignId = 'profile_default';
      } else if (this.data.profiles.profile_migrated) {
        targetAssignId = 'profile_migrated';
      } else if (existingIds.length === 1) {
        targetAssignId = existingIds[0];
      }
    }

    validEntries.forEach((entry, index) => {
      if (index === 0 && targetAssignId && this.getProfileById(targetAssignId)) {
        const assigned = this.assignOrRenameProfile(targetAssignId, entry.name, entry.avatarIcon)!;
        createdOrUpdated.push(assigned);
      } else {
        const id = `profile_${Date.now()}_${index + 1}_${Math.floor(Math.random() * 10000)}`;
        const fresh = PersistenceService.createDefaultProfile(id, entry.name, entry.avatarIcon);
        fresh.settings.language = currentLang;
        this.data.profiles[id] = fresh;
        createdOrUpdated.push(fresh);
      }
    });

    if (createdOrUpdated.length > 0) {
      this.data.activeProfileId = createdOrUpdated[0].id;
    }
    this.saveToStorage();
    return createdOrUpdated;
  }

  public deleteProfile(profileId: string): boolean {
    const allIds = Object.keys(this.data.profiles);
    if (allIds.length <= 1 || !this.getProfileById(profileId)) {
      return false;
    }
    delete this.data.profiles[profileId];
    if (this.data.activeProfileId === profileId) {
      this.data.activeProfileId = Object.keys(this.data.profiles)[0];
    }
    this.saveToStorage();
    return true;
  }

  public resetProfile(profileId?: string): PlayerProfile {
    const targetId = profileId ?? this.data.activeProfileId;
    const current = this.getProfileById(targetId) ?? this.getActiveProfile();
    const fresh = PersistenceService.createDefaultProfile(current.id, current.name, current.avatarIcon);
    fresh.settings = { ...current.settings };
    this.data.profiles[current.id] = fresh;
    this.saveToStorage();
    return fresh;
  }

  public resetActiveProfile(): PlayerProfile {
    return this.resetProfile(this.data.activeProfileId);
  }

  public exportSaveJson(): string {
    this.flushSave();
    return JSON.stringify(this.data, null, 2);
  }

  public importSaveJson(jsonString: string): { success: boolean; error?: string } {
    try {
      const parsed = JSON.parse(jsonString);
      const validated = PersistenceService.parseAndValidateSaveData(parsed, true);
      this.data = validated;
      this.saveToStorage();
      return { success: true };
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : 'Invalid JSON save data' };
    }
  }
}
