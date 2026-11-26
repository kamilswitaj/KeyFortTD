import { describe, expect, it, vi } from 'vitest';
import { getMissionById, MISSIONS_DATA } from '../../src/data/curriculumData';
import { TOWER_ORDER } from '../../src/data/towersData';
import { PersistenceService } from '../../src/services/PersistenceService';
import { CampaignSimulator } from '../../src/systems/CampaignSimulator';
import { ChallengeEngine, ChallengeKind, TECH_TREE_DATA } from '../../src/systems/ChallengeEngine';
import { GameSessionEngine } from '../../src/systems/GameSessionEngine';
import { WaveSystem } from '../../src/systems/WaveSystem';
import { HeroId } from '../../src/types';

describe('Full 48-Mission Campaign Headless Balance Simulation', () => {
  it('allows a complete beginner (~8 WPM with frequent errors) to complete introductory missions (w1_m1 - w1_m3)', () => {
    for (const mId of ['w1_m1', 'w1_m2', 'w1_m3']) {
      const res = CampaignSimulator.simulateMission(mId, 'beginner');
      expect(res.tacticalVictory, `Beginner failed tactical defense on ${mId}`).toBe(true);
      expect(res.educationalCompleted, `Beginner failed educational objectives on ${mId}`).toBe(true);
      expect(res.victory, `Beginner failed overall victory on ${mId}`).toBe(true);
    }
  });

  it('allows a learning player (~16 WPM) to complete World 1 and World 2 missions (w1_m1 - w2_m6)', () => {
    const earlyMissions = MISSIONS_DATA.filter((m) => m.worldId <= 2);
    for (const mission of earlyMissions) {
      const res = CampaignSimulator.simulateMission(mission, 'learning');
      expect(res.victory, `Learning player failed ${mission.id}`).toBe(true);
    }
  });

  it('validates that all 48 campaign missions are achievable by intermediate (~32 WPM) and advanced (~52 WPM) players', () => {
    for (const mission of MISSIONS_DATA) {
      const interRes = CampaignSimulator.simulateMission(mission, 'intermediate');
      expect(interRes.tacticalVictory, `Intermediate failed tactical defense on ${mission.id}`).toBe(true);
      expect(interRes.educationalCompleted, `Intermediate failed educational goal on ${mission.id}`).toBe(true);
      expect(interRes.victory, `Intermediate failed overall victory on ${mission.id}`).toBe(true);

      if (mission.isBossMission || mission.globalIndex === 48) {
        const advRes = CampaignSimulator.simulateMission(mission, 'advanced');
        expect(advRes.victory, `Advanced failed Boss mission ${mission.id}`).toBe(true);
        expect(advRes.stars).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it('prevents a non-typing player (0 WPM) from completing any of the 48 educational missions', () => {
    for (const mission of MISSIONS_DATA) {
      const res = CampaignSimulator.simulateMission(mission, 'non_typer');
      expect(res.educationalCompleted, `Non-typer bypassed education on ${mission.id}`).toBe(false);
      expect(res.victory, `Non-typer won ${mission.id} without typing`).toBe(false);
    }
  });

  it('verifies that poor tower placement and ineffective strategy fail tactical defense', () => {
    for (const mId of ['w1_m4', 'w1_m6', 'w3_m6', 'w6_m6', 'w8_m6']) {
      const res = CampaignSimulator.simulateMission(mId, 'poor_tactician');
      expect(res.tacticalVictory, `Poor tactician should not survive ${mId} with 1 corner tower`).toBe(false);
      expect(res.remainingLives).toBe(0);
    }
  });

  it('verifies that multiple distinct tower combinations are viable on mid-campaign missions', () => {
    const mission = getMissionById('w4_m4')!;
    // Strategy A: Kinetic + Cryo + Sniper
    const stratA = CampaignSimulator.simulateMission(mission, 'intermediate', ['gun', 'frost', 'sniper']);
    // Strategy B: AoE + Arc + Reactor
    const stratB = CampaignSimulator.simulateMission(mission, 'intermediate', ['cannon', 'tesla', 'reactor']);

    expect(stratA.victory).toBe(true);
    expect(stratB.victory).toBe(true);
  });

  it('verifies that building 0 towers results in base destruction', () => {
    const profile = PersistenceService.createDefaultProfile();
    const mission = getMissionById('w1_m1')!;
    const session = new GameSessionEngine({
      mode: 'campaign',
      mission,
      profile,
    });

    let ticks = 0;
    while (!session.isSessionOver() && ticks < 3000) {
      if (!session.waveSystem.isWaveActive() && session.waveSystem.hasMoreWaves()) {
        session.startNextWave();
      }
      session.update(0.1);
      ticks++;
    }

    expect(session.getLives()).toBe(0);
    expect(session.isVictory()).toBe(false);
  });

  it('verifies V2 towers, all 4 heroes, all 5 tech modifiers, and 3 difficulties without making classic 6 towers obsolete', () => {
    const allTechIds = TECH_TREE_DATA.map((t) => t.id);
    const heroes: HeroId[] = ['guardian', 'engineer', 'ranger', 'arcanist'];
    for (const heroId of heroes) {
      const res = CampaignSimulator.simulateMission('w6_m6', 'intermediate', ['gun', 'cannon', 'frost', 'tesla'], {
        difficulty: 'tactical',
        heroId,
        unlockedTechs: allTechIds,
      });
      expect(res.victory, `Classic 6 towers with hero ${heroId} failed w6_m6 tactical`).toBe(true);
    }

    // V2 towers + synergies remain viable across all 3 difficulties
    for (const difficulty of ['relaxed', 'standard', 'tactical'] as const) {
      const v2Res = CampaignSimulator.simulateMission('w7_m4', 'intermediate', ['flame', 'drone', 'command', 'laser'], {
        difficulty,
        heroId: 'arcanist',
        unlockedTechs: allTechIds,
        unlockedTowers: [...TOWER_ORDER],
      });
      expect(v2Res.victory, `V2 towers failed w7_m4 on ${difficulty}`).toBe(true);
    }
  });

  it('distinguishes slow & accurate vs fast & inaccurate personas on high-accuracy missions', () => {
    const slowAccurate = CampaignSimulator.simulateMission('w4_m2', 'slow_accurate');
    const fastInaccurate = CampaignSimulator.simulateMission('w8_m6', 'fast_inaccurate');
    expect(slowAccurate.victory).toBe(true);
    expect(slowAccurate.typingAccuracy).toBeGreaterThanOrEqual(0.92);
    expect(fastInaccurate.educationalCompleted).toBe(false);
    expect(fastInaccurate.victory).toBe(false);
  });

  it('uses cumulative damage, completed waves and historically used tower types in challenge simulation results', () => {
    const base = ChallengeEngine.getDailyChallenge('intermediate', new Date('2026-11-26T12:00:00Z'));
    const challenge = { ...base, kind: 'no_leak' as const, missionId: 'w3_m3', maxLeaksAllowed: 0 };
    const damageSpy = vi.spyOn(GameSessionEngine.prototype, 'getCumulativeBaseDamage').mockReturnValue(4);
    const wavesSpy = vi.spyOn(WaveSystem.prototype, 'getCompletedWavesCount').mockReturnValue(2);
    const typesSpy = vi.spyOn(GameSessionEngine.prototype, 'getUsedTowerTypes').mockReturnValue(['gun', 'cannon', 'frost']);
    try {
      const result = CampaignSimulator.simulateChallenge(challenge, 'standard', 'advanced');
      expect(result.baseDamage).toBe(4);
      expect(result.wavesCompleted).toBe(2);
      expect(result.towerTypesUsed).toEqual(['gun', 'cannon', 'frost']);
      expect(result.passed).toBe(false);
    } finally {
      damageSpy.mockRestore();
      wavesSpy.mockRestore();
      typesSpy.mockRestore();
    }
  });

  it('simulates all 5 challenge kinds (precision, no_leak, limited_gold, two_towers, boss_rush) verifying restrictions and outcomes', () => {
    const kinds: ChallengeKind[] = ['precision', 'no_leak', 'limited_gold', 'two_towers', 'boss_rush'];
    const baseChallenge = ChallengeEngine.getDailyChallenge('intermediate', new Date('2026-11-26T12:00:00Z'));

    for (const kind of kinds) {
      const ch = {
        ...baseChallenge,
        id: `sim_ch_${kind}`,
        kind,
        missionId: kind === 'boss_rush' ? 'w3_m6' : 'w3_m3',
        targetAccuracy: kind === 'precision' ? 0.94 : 0.85,
        minTypedChars: 40,
      };

      const adv = CampaignSimulator.simulateChallenge(ch, 'standard', 'advanced', {
        heroId: 'guardian',
        unlockedTechs: ['tech_kinetic_1', 'tech_energy_1', 'tech_defense_1'],
      });
      expect(adv.passed, `Advanced failed ${kind} challenge: ${adv.reason ?? ''}`).toBe(true);
      expect(adv.awardedTechPoints).toBeGreaterThan(0);

      if (kind === 'two_towers') {
        expect(adv.towerTypesUsed.length).toBeLessThanOrEqual(2);
      }
      if (kind === 'no_leak') {
        expect(adv.baseDamage).toBe(0);
      }

      const nonTyper = CampaignSimulator.simulateChallenge(ch, 'standard', 'non_typer');
      expect(nonTyper.passed, `Non-typer bypassed ${kind} challenge`).toBe(false);

      if (kind === 'precision') {
        const sloppy = CampaignSimulator.simulateChallenge(ch, 'standard', 'fast_inaccurate');
        expect(sloppy.passed, 'Fast inaccurate should fail precision challenge').toBe(false);
      }
    }
  });
});
