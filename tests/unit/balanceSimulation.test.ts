import { describe, expect, it } from 'vitest';
import { getMissionById, MISSIONS_DATA } from '../../src/data/curriculumData';
import { PersistenceService } from '../../src/services/PersistenceService';
import { CampaignSimulator } from '../../src/systems/CampaignSimulator';
import { GameSessionEngine } from '../../src/systems/GameSessionEngine';

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
});
