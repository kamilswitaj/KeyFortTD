import { beforeEach, describe, expect, it } from 'vitest';
import { MISSIONS_DATA } from '../../src/data/curriculumData';
import { PersistenceService } from '../../src/services/PersistenceService';
import { AchievementSystem } from '../../src/systems/AchievementSystem';
import { GameSessionEngine } from '../../src/systems/GameSessionEngine';
import { ProgressionEngine } from '../../src/systems/ProgressionEngine';
import { StatisticsEngine } from '../../src/systems/StatisticsEngine';

describe('PersistenceService, Migration, ProgressionEngine, StatisticsEngine, and AchievementSystem', () => {
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
    expect(migrated.version).toBe(3);
    const active = migrated.profiles[migrated.activeProfileId];
    expect(active.name).toBe('Kamil_Legacy');
    expect(active.level).toBe(4);
    expect(active.unlockedTowers).toContain('frost');

    const service = new PersistenceService();
    const badImport = service.importSaveJson('{corrupted_json!!');
    expect(badImport.success).toBe(false);
    expect(service.getActiveProfile().name).toBeDefined();
  });

  it('migrates v2 saves to v3 while preserving progress and reconstructing dailyStats from sessionHistory', () => {
    const v2Save = {
      version: 2,
      activeProfileId: 'profile_default',
      profiles: {
        profile_default: {
          id: 'profile_default',
          name: 'Obrońca',
          avatarIcon: '🛡️',
          createdAt: 1700000000000,
          lastActiveAt: 1700000500000,
          level: 5,
          xp: 450,
          totalPracticeTimeSec: 180,
          totalCharsTyped: 240,
          totalCorrectChars: 228,
          totalErrors: 12,
          bestWpm: 38,
          bestCombo: 45,
          unlockedTowers: ['gun', 'cannon', 'frost'],
          completedMissions: {
            w1_m1: {
              missionId: 'w1_m1',
              completed: true,
              stars: 3,
              bestScore: 2800,
              bestAccuracy: 0.96,
              bestWpm: 34,
              timesCompleted: 2,
            },
          },
          characterMastery: {},
          bigramStats: {},
          achievements: ['first_defense'],
          dailyStreak: 2,
          lastPlayedDate: '2026-11-16',
          sessionHistory: [
            {
              timestamp: new Date('2026-11-16T14:00:00Z').getTime(),
              missionId: 'w1_m1',
              mode: 'campaign',
              victory: true,
              charsTyped: 120,
              errors: 5,
              durationSec: 60,
              accuracy: 120 / 125,
              wpm: 24,
              maxCombo: 45,
              score: 2800,
            },
          ],
          settings: {
            language: 'pl',
            musicVolume: 0.5,
            sfxVolume: 0.7,
            highContrast: false,
            textSize: 'normal',
            showFingerHints: true,
            showVirtualKeyboard: true,
            difficulty: 'standard',
            typingAssistance: 'standard',
          },
        },
      },
    };

    const migrated = PersistenceService.migrateAndValidateSaveData(v2Save);
    expect(migrated.version).toBe(3);
    const prof = migrated.profiles.profile_default;
    expect(prof.level).toBe(5);
    expect(prof.completedMissions.w1_m1.completed).toBe(true);
    expect(prof.completedMissions.w1_m1.stars).toBe(3);
    expect(prof.achievements).toEqual(['first_defense']);
    expect(prof.sessionHistory.length).toBe(1);
    expect(prof.sessionHistory[0].status).toBe('completed');
    expect(Object.keys(prof.dailyStats).length).toBe(1);
    const dayEntry = Object.values(prof.dailyStats)[0];
    expect(dayEntry.correctChars).toBe(120);
    expect(dayEntry.errorChars).toBe(5);
    expect(dayEntry.practiceTimeSec).toBe(60);
    expect(dayEntry.missionsCompleted).toBe(1);
  });

  it('supports quick 3-player family setup and assigns existing progress to Player 1 without duplication or loss', () => {
    const service = new PersistenceService();
    const defaultProf = service.getActiveProfile();
    defaultProf.level = 6;
    defaultProf.completedMissions.w1_m1 = {
      missionId: 'w1_m1',
      completed: true,
      stars: 3,
      bestScore: 2200,
      bestAccuracy: 0.98,
      bestWpm: 30,
      timesCompleted: 1,
    };
    defaultProf.bestCombo = 88;
    service.saveToStorage();

    const created = service.setupFamilyProfiles(
      [
        { name: 'Gracz Pierwszy', avatarIcon: '🛡️' },
        { name: 'Gracz Drugi', avatarIcon: '⚡' },
        { name: 'Gracz Trzeci', avatarIcon: '🐉' },
      ],
      true
    );

    expect(created.length).toBe(3);
    expect(service.getAllProfiles().length).toBe(3);

    const p1 = service.getProfileById(defaultProf.id)!;
    expect(p1.name).toBe('Gracz Pierwszy');
    expect(p1.level).toBe(6);
    expect(p1.completedMissions.w1_m1?.completed).toBe(true);
    expect(p1.bestCombo).toBe(88);

    const p2 = created[1];
    expect(p2.name).toBe('Gracz Drugi');
    expect(p2.level).toBe(1);
    expect(Object.keys(p2.completedMissions)).toEqual([]);
  });

  it('validates profile identity and rejects mismatched profile-map keys and reserved property names', () => {
    const service = new PersistenceService();
    const active = service.getActiveProfile();
    active.name = 'ChronionyProfil';
    service.saveToStorage();

    const mismatchedKeyPayload = JSON.stringify({
      version: 3,
      activeProfileId: 'key_one',
      profiles: {
        key_one: { id: 'different_id', name: 'Mismatch' },
      },
    });
    expect(service.importSaveJson(mismatchedKeyPayload).success).toBe(false);

    const reservedKeyPayload = JSON.stringify({
      version: 3,
      activeProfileId: 'constructor',
      profiles: {
        constructor: { id: 'constructor', name: 'Exploit' },
      },
    });
    expect(service.importSaveJson(reservedKeyPayload).success).toBe(false);
    expect(service.getActiveProfile().name).toBe('ChronionyProfil');
  });

  it('tracks immutable session ownerProfileId, enforces exactly-once finalization, and isolates profile progress', () => {
    const service = new PersistenceService();
    const p1 = service.getActiveProfile();
    const p2 = service.createProfile('Siostra', '❄️');
    service.switchProfile(p1.id);

    const session = new GameSessionEngine({
      mode: 'campaign',
      mission: MISSIONS_DATA[0],
      profile: p1,
    });

    expect(session.ownerProfileId).toBe(p1.id);
    expect(session.isFinalized()).toBe(false);

    // Even if active profile switches in PersistenceService, session.ownerProfileId remains p1.id
    service.switchProfile(p2.id);
    expect(session.ownerProfileId).toBe(p1.id);

    expect(session.markFinalized()).toBe(true);
    expect(session.isFinalized()).toBe(true);
    // Second finalization attempt must return false
    expect(session.markFinalized()).toBe(false);
  });

  it('calculates honest statistics without inflating unplayed profiles or tiny samples, and ranks mission leaderboards fairly', () => {
    const unplayed = PersistenceService.createDefaultProfile('p_new', 'Nowy', '🛡️');
    expect(StatisticsEngine.getOverallAccuracy(unplayed)).toBeNull();
    expect(StatisticsEngine.getRecentWeightedWpm(unplayed)).toBeNull();
    expect(StatisticsEngine.computeQualifyingWpm(10, 2)).toBeNull(); // below 20 chars / 4 sec threshold
    expect(StatisticsEngine.computeQualifyingWpm(40, 16)).toBe(30); // 40 chars = 8 words in 16s = 30 WPM

    const pA = PersistenceService.createDefaultProfile('p_a', 'Alfa', '🛡️');
    const pB = PersistenceService.createDefaultProfile('p_b', 'Beta', '⚡');

    // Record legitimate completed run on w1_m1 for pA (standard) and pB (standard)
    ProgressionEngine.evaluateMissionResult(
      MISSIONS_DATA[0],
      pA,
      20,
      20,
      65,
      0.97,
      28,
      30,
      undefined,
      { difficulty: 'standard', durationSec: 30, unrestrictedResources: false }
    );
    ProgressionEngine.evaluateMissionResult(
      MISSIONS_DATA[0],
      pB,
      19,
      20,
      60,
      0.92,
      24,
      20,
      undefined,
      { difficulty: 'standard', durationSec: 30, unrestrictedResources: false }
    );

    // Unrestricted sandbox-like run on w1_m1 should NOT pollute competitive per-difficulty records
    const pCheat = PersistenceService.createDefaultProfile('p_c', 'SandboxRunner', '🐉');
    ProgressionEngine.evaluateMissionResult(
      MISSIONS_DATA[0],
      pCheat,
      20,
      20,
      90,
      1.0,
      60,
      90,
      undefined,
      { difficulty: 'standard', durationSec: 15, unrestrictedResources: true }
    );

    const board = StatisticsEngine.getMissionLeaderboard([pA, pB, pCheat], 'w1_m1', 'standard');
    expect(board.length).toBe(2);
    expect(board[0].profileId).toBe('p_a');
    expect(board[1].profileId).toBe('p_b');

    const familyRows = StatisticsEngine.buildFamilyComparisonRows([pA, pB, unplayed]);
    expect(familyRows.length).toBe(3);
    const unplayedRow = familyRows.find((r) => r.profileId === 'p_new')!;
    expect(unplayedRow.overallAccuracy).toBeNull();
    expect(unplayedRow.practiceTimeSec).toBe(0);
  });

  it('updates wave preview immediately when a wave completes', () => {
    const profile = PersistenceService.createDefaultProfile();
    const session = new GameSessionEngine({
      mode: 'campaign',
      mission: MISSIONS_DATA[0], // w1_m1 has 3 waves
      profile,
      unlimitedGold: true,
    });

    expect(session.getUpcomingWavePreview().waveNumber).toBe(1);
    session.buildTower('gun', 1);
    session.buildTower('cannon', 2);
    session.buildTower('gun', 3);

    session.startNextWave();
    let guard = 0;
    while (session.waveSystem.isWaveActive() && guard < 1500) {
      session.update(0.1);
      guard++;
    }

    // As soon as Wave 1 finishes, upcoming wave preview must show Wave 2
    expect(session.waveSystem.isWaveActive()).toBe(false);
    expect(session.getUpcomingWavePreview().waveNumber).toBe(2);
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
