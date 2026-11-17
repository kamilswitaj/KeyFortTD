import { beforeEach, describe, expect, it } from 'vitest';
import { MISSIONS_DATA } from '../../src/data/curriculumData';
import { PersistenceService } from '../../src/services/PersistenceService';
import { AchievementSystem } from '../../src/systems/AchievementSystem';
import { GameSessionEngine } from '../../src/systems/GameSessionEngine';
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

    const impRes = service.importSaveJson(exported);
    expect(impRes.success).toBe(true);
    expect(service.getAllProfiles().length).toBe(2);
  });

  it('rejects malformed, out-of-range, or malicious imports without overwriting valid saves', () => {
    const service = new PersistenceService();
    const active = service.getActiveProfile();
    active.name = 'BezpiecznyGracz';
    active.level = 7;
    service.saveToStorage();

    const invalidPayloads = [
      JSON.stringify({ version: 99, activeProfileId: 'p1', profiles: {} }),
      JSON.stringify({ version: 2, activeProfileId: 'missing', profiles: {} }),
      JSON.stringify({
        version: 2,
        activeProfileId: '<script>alert(1)</script>',
        profiles: { '<script>alert(1)</script>': { name: 'BadId' } },
      }),
      JSON.stringify({
        version: 2,
        activeProfileId: 'p1',
        profiles: { p1: { id: 'p1', name: 'Test', level: -5 } },
      }),
      JSON.stringify({
        version: 2,
        activeProfileId: 'p1',
        profiles: { p1: { id: 'p1', name: 'Test', unlockedTowers: ['laser_shark'] } },
      }),
      JSON.stringify({
        version: 2,
        activeProfileId: 'p1',
        profiles: { p1: { id: 'p1', name: 'Test', settings: { language: 'de' } } },
      }),
      JSON.stringify({
        version: 2,
        activeProfileId: 'p1',
        profiles: {
          p1: {
            id: 'p1',
            name: 'Test',
            characterMastery: { f: { char: 'f', attempts: 10, correct: 5, errors: 5, status: 'godlike' } },
          },
        },
      }),
    ];

    for (const payload of invalidPayloads) {
      const res = service.importSaveJson(payload);
      expect(res.success).toBe(false);
      // Verify existing save was never overwritten
      expect(service.getActiveProfile().name).toBe('BezpiecznyGracz');
      expect(service.getActiveProfile().level).toBe(7);
    }
  });

  it('throttles frequent save requests and flushes immediately on demand', () => {
    const service = new PersistenceService();
    const profile = service.getActiveProfile();
    profile.bestCombo = 42;
    service.requestThrottledSave(5000);

    // Before flush, force immediate flushSave and verify storage
    service.flushSave();
    const reloaded = new PersistenceService();
    expect(reloaded.getActiveProfile().bestCombo).toBe(42);
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

  it('enforces per-key objectives for new keys and offers a follow-up practice activity on tactical victory', () => {
    const profile = PersistenceService.createDefaultProfile();
    const m3 = MISSIONS_DATA.find((m) => m.id === 'w1_m3')!; // introduces 'd'

    // If total chars are met (70) with 95% accuracy, but new key 'd' was only practiced twice -> educationalCompleted is false!
    const incompleteKeyOutcome = ProgressionEngine.evaluateMissionResult(
      m3,
      profile,
      20,
      20,
      70,
      0.95,
      25,
      30,
      {
        f: { key: 'f', attempts: 35, correct: 34, errors: 1 },
        j: { key: 'j', attempts: 35, correct: 34, errors: 1 },
        d: { key: 'd', attempts: 2, correct: 2, errors: 0 },
      }
    );
    expect(incompleteKeyOutcome.tacticalVictory).toBe(true);
    expect(incompleteKeyOutcome.educationalCompleted).toBe(false);
    expect(incompleteKeyOutcome.victory).toBe(false);

    // Verify Follow-Up Practice flow in GameSessionEngine
    const session = new GameSessionEngine({
      mode: 'campaign',
      mission: MISSIONS_DATA[0], // w1_m1
      profile,
      unlimitedGold: true,
    });
    session.buildTower('gun', 1);
    session.buildTower('cannon', 2);
    session.buildTower('gun', 3);

    // Type only 12 chars before waves finish
    let now = 1000;
    for (let i = 0; i < 12; i++) {
      const ch = session.typingEngine.getExpectedChar();
      if (ch) session.handleKeyInput(ch, (now += 300), false);
    }

    let ticks = 0;
    while (!session.areAllWavesCleared() && ticks < 4000) {
      if (!session.waveSystem.isWaveActive() && session.waveSystem.hasMoreWaves()) {
        session.startNextWave();
      }
      session.update(0.1);
      ticks++;
    }

    expect(session.isTacticalVictory()).toBe(true);
    expect(session.isEducationalCompleted()).toBe(false);
    expect(session.isFollowUpPracticeActive()).toBe(true);
    expect(session.isSessionOver()).toBe(false);

    // Complete the short follow-up practice without replaying the battle
    while (!session.isSessionOver() && now < 200000) {
      const ch = session.typingEngine.getExpectedChar();
      if (!ch) break;
      session.handleKeyInput(ch, (now += 300), false);
    }

    expect(session.isEducationalCompleted()).toBe(true);
    expect(session.isVictory()).toBe(true);
    expect(session.isSessionOver()).toBe(true);
  });
});
