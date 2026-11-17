import { beforeEach, describe, expect, it } from 'vitest';
import { MISSIONS_DATA } from '../../src/data/curriculumData';
import { PersistenceService } from '../../src/services/PersistenceService';
import { AchievementSystem } from '../../src/systems/AchievementSystem';
import { ProgressionEngine } from '../../src/systems/ProgressionEngine';

describe('PersistenceService, Migration, ProgressionEngine, and AchievementSystem', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('migrates legacy v0 single-profile save data and recovers from corrupted JSON', () => {
    const legacyV0 = {
      name: 'Kamil_Legacy',
      level: 4,
      xp: 120,
      unlockedTowers: ['gun', 'cannon', 'frost'],
    };

    const migrated = PersistenceService.migrateAndValidateSaveData(legacyV0);
    expect(migrated.version).toBe(2);
    const active = migrated.profiles[migrated.activeProfileId];
    expect(active.name).toBe('Kamil_Legacy');
    expect(active.level).toBe(4);
    expect(active.unlockedTowers).toContain('frost');

    const service = new PersistenceService();
    const badImport = service.importSaveJson('{corrupted_json!!');
    expect(badImport.success).toBe(false);
    expect(service.getActiveProfile().name).toBeDefined();
  });

  it('supports multiple local family profiles and JSON export/import roundtrip', () => {
    const service = new PersistenceService();
    const p1 = service.getActiveProfile();
    p1.bestCombo = 77;
    service.saveToStorage();

    const p2 = service.createProfile('Brat_Tomek', '🐉');
    expect(service.getActiveProfile().id).toBe(p2.id);
    expect(service.getAllProfiles().length).toBe(2);

    service.switchProfile(p1.id);
    expect(service.getActiveProfile().bestCombo).toBe(77);

    const exported = service.exportSaveJson();
    localStorage.clear();

    const freshService = new PersistenceService();
    expect(freshService.getAllProfiles().length).toBe(1);

    const impRes = freshService.importSaveJson(exported);
    expect(impRes.success).toBe(true);
    expect(freshService.getAllProfiles().length).toBe(2);
  });

  it('prevents completing an educational mission without sufficient typing practice', () => {
    const profile = PersistenceService.createDefaultProfile();
    const m1 = MISSIONS_DATA[0]; // requires 55 chars

    // Survive waves with 20/20 lives, but only typed 10 chars -> must NOT win!
    const failOutcome = ProgressionEngine.evaluateMissionResult(m1, profile, 20, 20, 10, 1.0, 25, 10);
    expect(failOutcome.victory).toBe(false);
    expect(ProgressionEngine.isMissionUnlocked(MISSIONS_DATA[1], profile)).toBe(false);

    // Now type required characters with good accuracy -> wins and unlocks Mission 2!
    const winOutcome = ProgressionEngine.evaluateMissionResult(m1, profile, 20, 20, 60, 0.96, 22, 35);
    expect(winOutcome.victory).toBe(true);
    expect(winOutcome.stars).toBe(3);
    expect(ProgressionEngine.isMissionUnlocked(MISSIONS_DATA[1], profile)).toBe(true);

    const unlockedAch = AchievementSystem.evaluateAndUnlock(profile, {
      missionWon: true,
      remainingLives: 20,
      startingLives: 20,
      typingAccuracy: 0.96,
      maxCombo: 105,
    });
    expect(unlockedAch.some((a) => a.id === 'first_defense')).toBe(true);
    expect(unlockedAch.some((a) => a.id === 'perfect_wave')).toBe(true);
    expect(unlockedAch.some((a) => a.id === 'combo_100')).toBe(true);
  });
});
