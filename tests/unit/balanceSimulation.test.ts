import { describe, expect, it } from 'vitest';
import { getMissionById } from '../../src/data/curriculumData';
import { PersistenceService } from '../../src/services/PersistenceService';
import { GameSessionEngine } from '../../src/systems/GameSessionEngine';

describe('Headless Gameplay Balance Simulation', () => {
  it('allows a beginner typing slowly (~14 WPM) with basic towers to complete Mission 1 (w1_m1)', () => {
    const profile = PersistenceService.createDefaultProfile();
    const mission = getMissionById('w1_m1')!;
    const session = new GameSessionEngine({
      mode: 'campaign',
      mission,
      profile,
    });

    // Build 2 Gun Towers on strategic bends
    expect(session.buildTower('gun', 1)).not.toBeNull();
    expect(session.buildTower('gun', 3)).not.toBeNull();

    let simTimeMs = 1000;
    let charTimerSec = 0;

    while (!session.isSessionOver() && simTimeMs < 350000) {
      if (!session.waveSystem.isWaveActive() && session.waveSystem.hasMoreWaves()) {
        session.startNextWave();
        // Spend earned gold on an additional tower or upgrade between waves
        if (session.economy.getGold() >= 90 && session.getTowers().length < 4) {
          session.buildTower('gun', 4);
        }
      }

      const dtSec = 0.1;
      simTimeMs += 100;
      charTimerSec += dtSec;

      // Beginner types 1 character every 0.85s (~14 WPM)
      if (charTimerSec >= 0.85) {
        charTimerSec = 0;
        const expected = session.typingEngine.getExpectedChar();
        if (expected) {
          session.handleKeyInput(expected, simTimeMs, false);
        }
      }

      session.update(dtSec);
    }

    expect(session.getLives()).toBeGreaterThan(0);
    expect(session.isVictory()).toBe(true);
  });

  it('prevents bypassing educational typing objectives through towers alone', () => {
    const profile = PersistenceService.createDefaultProfile();
    const mission = getMissionById('w1_m1')!;
    const session = new GameSessionEngine({
      mode: 'campaign',
      mission,
      profile,
      unlimitedGold: true,
    });

    // Build strong towers on multiple pads, but type 0 characters
    session.buildTower('gun', 1);
    session.buildTower('cannon', 2);
    session.buildTower('gun', 3);
    session.buildTower('cannon', 4);

    let ticks = 0;
    while (!session.areAllWavesCleared() && ticks < 4000) {
      if (!session.waveSystem.isWaveActive() && session.waveSystem.hasMoreWaves()) {
        session.startNextWave();
      }
      session.update(0.1);
      ticks++;
    }

    expect(session.areAllWavesCleared()).toBe(true);
    // Even though all enemy waves are defeated, mission is NOT won because 0 characters were typed!
    expect(session.isVictory()).toBe(false);
    expect(session.isSessionOver()).toBe(false);
  });

  it('verifies that building 0 towers results in base destruction (strategic defense matters)', () => {
    const profile = PersistenceService.createDefaultProfile();
    const mission = getMissionById('w1_m4')!;
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
