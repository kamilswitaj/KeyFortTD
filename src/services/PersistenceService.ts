import { AppSettings, PlayerProfile, SaveDataSchema } from '../types';

export const STORAGE_KEY = 'keyfort_td_save_data';
export const CURRENT_SAVE_VERSION = 2;

export class PersistenceService {
  private data: SaveDataSchema;

  constructor() {
    this.data = this.loadFromStorage();
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
    return {
      id,
      name,
      avatarIcon,
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
      characterMastery: {},
      bigramMastery: {},
      sessionHistory: [],
      settings: PersistenceService.createDefaultSettings(),
    };
  }

  public static createDefaultSaveData(): SaveDataSchema {
    const defaultProfile = PersistenceService.createDefaultProfile();
    return {
      version: CURRENT_SAVE_VERSION,
      activeProfileId: defaultProfile.id,
      profiles: {
        [defaultProfile.id]: defaultProfile,
      },
    };
  }

  /**
   * Migrates older or partial save objects to CURRENT_SAVE_VERSION safely.
   */
  public static migrateAndValidateSaveData(raw: unknown): SaveDataSchema {
    if (!raw || typeof raw !== 'object') {
      return PersistenceService.createDefaultSaveData();
    }

    const obj = raw as Record<string, unknown>;

    // Legacy v0: single profile stored at root
    if (!obj.profiles && typeof obj.name === 'string') {
      const migratedProfile = PersistenceService.sanitizeProfile(obj, 'profile_migrated');
      return {
        version: CURRENT_SAVE_VERSION,
        activeProfileId: migratedProfile.id,
        profiles: {
          [migratedProfile.id]: migratedProfile,
        },
      };
    }

    // v1 or v2 multi-profile structure
    if (obj.profiles && typeof obj.profiles === 'object') {
      const rawProfiles = obj.profiles as Record<string, unknown>;
      const validProfiles: Record<string, PlayerProfile> = {};

      for (const [id, pData] of Object.entries(rawProfiles)) {
        if (pData && typeof pData === 'object') {
          validProfiles[id] = PersistenceService.sanitizeProfile(pData as Record<string, unknown>, id);
        }
      }

      const ids = Object.keys(validProfiles);
      if (ids.length === 0) {
        return PersistenceService.createDefaultSaveData();
      }

      const activeId =
        typeof obj.activeProfileId === 'string' && validProfiles[obj.activeProfileId]
          ? obj.activeProfileId
          : ids[0];

      return {
        version: CURRENT_SAVE_VERSION,
        activeProfileId: activeId,
        profiles: validProfiles,
      };
    }

    return PersistenceService.createDefaultSaveData();
  }

  private static sanitizeProfile(raw: Record<string, unknown>, fallbackId: string): PlayerProfile {
    const def = PersistenceService.createDefaultProfile(
      typeof raw.id === 'string' && raw.id ? raw.id : fallbackId,
      typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim() : 'Obrońca',
      typeof raw.avatarIcon === 'string' ? raw.avatarIcon : '🛡️'
    );

    const rawSettings = (raw.settings && typeof raw.settings === 'object' ? raw.settings : {}) as Partial<AppSettings>;
    const settings: AppSettings = {
      ...def.settings,
      ...rawSettings,
      language: rawSettings.language === 'en' ? 'en' : 'pl',
    };

    const unlockedTowers = Array.isArray(raw.unlockedTowers)
      ? (raw.unlockedTowers.filter((t) => typeof t === 'string') as PlayerProfile['unlockedTowers'])
      : def.unlockedTowers;
    if (!unlockedTowers.includes('gun')) unlockedTowers.push('gun');
    if (!unlockedTowers.includes('cannon')) unlockedTowers.push('cannon');

    return {
      ...def,
      level: typeof raw.level === 'number' && raw.level >= 1 ? Math.floor(raw.level) : 1,
      xp: typeof raw.xp === 'number' && raw.xp >= 0 ? Math.floor(raw.xp) : 0,
      unlockedTowers,
      unlockedUpgradeTiers:
        typeof raw.unlockedUpgradeTiers === 'number'
          ? Math.max(1, Math.min(3, Math.floor(raw.unlockedUpgradeTiers)))
          : 1,
      completedMissions:
        raw.completedMissions && typeof raw.completedMissions === 'object'
          ? (raw.completedMissions as PlayerProfile['completedMissions'])
          : {},
      achievements: Array.isArray(raw.achievements)
        ? raw.achievements.filter((a) => typeof a === 'string')
        : [],
      unlockedCosmetics: Array.isArray(raw.unlockedCosmetics)
        ? raw.unlockedCosmetics.filter((c) => typeof c === 'string')
        : def.unlockedCosmetics,
      equippedCosmetics:
        raw.equippedCosmetics && typeof raw.equippedCosmetics === 'object'
          ? { ...def.equippedCosmetics, ...(raw.equippedCosmetics as PlayerProfile['equippedCosmetics']) }
          : def.equippedCosmetics,
      survivalBestWave: typeof raw.survivalBestWave === 'number' ? raw.survivalBestWave : 0,
      survivalBestScore: typeof raw.survivalBestScore === 'number' ? raw.survivalBestScore : 0,
      totalPracticeTimeSec: typeof raw.totalPracticeTimeSec === 'number' ? raw.totalPracticeTimeSec : 0,
      totalCharsTyped: typeof raw.totalCharsTyped === 'number' ? raw.totalCharsTyped : 0,
      totalCorrectChars: typeof raw.totalCorrectChars === 'number' ? raw.totalCorrectChars : 0,
      bestCombo: typeof raw.bestCombo === 'number' ? raw.bestCombo : 0,
      bestWpm: typeof raw.bestWpm === 'number' ? raw.bestWpm : 0,
      characterMastery:
        raw.characterMastery && typeof raw.characterMastery === 'object'
          ? (raw.characterMastery as PlayerProfile['characterMastery'])
          : {},
      bigramMastery:
        raw.bigramMastery && typeof raw.bigramMastery === 'object'
          ? (raw.bigramMastery as PlayerProfile['bigramMastery'])
          : {},
      sessionHistory: Array.isArray(raw.sessionHistory)
        ? (raw.sessionHistory.slice(-60) as PlayerProfile['sessionHistory'])
        : [],
      settings,
    };
  }

  public loadFromStorage(): SaveDataSchema {
    try {
      if (typeof localStorage === 'undefined') {
        return PersistenceService.createDefaultSaveData();
      }
      const rawJson = localStorage.getItem(STORAGE_KEY);
      if (!rawJson) {
        const fresh = PersistenceService.createDefaultSaveData();
        this.saveToStorage(fresh);
        return fresh;
      }
      const parsed = JSON.parse(rawJson);
      const migrated = PersistenceService.migrateAndValidateSaveData(parsed);
      return migrated;
    } catch {
      return PersistenceService.createDefaultSaveData();
    }
  }

  public saveToStorage(customData?: SaveDataSchema): void {
    const target = customData ?? this.data;
    this.data = target;
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(target));
      }
    } catch {
      // Ignore quota errors in restricted environments
    }
  }

  public getActiveProfile(): PlayerProfile {
    const profile = this.data.profiles[this.data.activeProfileId];
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
    if (this.data.profiles[profileId]) {
      this.data.activeProfileId = profileId;
      this.data.profiles[profileId].lastActiveAt = Date.now();
      this.saveToStorage();
    }
    return this.getActiveProfile();
  }

  public createProfile(name: string, avatarIcon: string = '🚀'): PlayerProfile {
    const id = `profile_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const currentLang = this.getActiveProfile().settings.language;
    const newProfile = PersistenceService.createDefaultProfile(id, name.trim() || 'Nowy Gracz', avatarIcon);
    newProfile.settings.language = currentLang;
    this.data.profiles[id] = newProfile;
    this.data.activeProfileId = id;
    this.saveToStorage();
    return newProfile;
  }

  public deleteProfile(profileId: string): boolean {
    const allIds = Object.keys(this.data.profiles);
    if (allIds.length <= 1 || !this.data.profiles[profileId]) {
      return false;
    }
    delete this.data.profiles[profileId];
    if (this.data.activeProfileId === profileId) {
      this.data.activeProfileId = Object.keys(this.data.profiles)[0];
    }
    this.saveToStorage();
    return true;
  }

  public resetActiveProfile(): PlayerProfile {
    const current = this.getActiveProfile();
    const fresh = PersistenceService.createDefaultProfile(current.id, current.name, current.avatarIcon);
    fresh.settings = { ...current.settings };
    this.data.profiles[current.id] = fresh;
    this.saveToStorage();
    return fresh;
  }

  public exportSaveJson(): string {
    return JSON.stringify(this.data, null, 2);
  }

  public importSaveJson(jsonString: string): { success: boolean; error?: string } {
    try {
      const parsed = JSON.parse(jsonString);
      if (!parsed || typeof parsed !== 'object') {
        return { success: false, error: 'Invalid JSON structure' };
      }
      if (!parsed.profiles && !parsed.name) {
        return { success: false, error: 'Missing profile data in JSON' };
      }
      this.data = PersistenceService.migrateAndValidateSaveData(parsed);
      this.saveToStorage();
      return { success: true };
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : 'Invalid JSON' };
    }
  }
}
