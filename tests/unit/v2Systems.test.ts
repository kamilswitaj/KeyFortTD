import { describe, expect, it } from 'vitest';
import { MISSIONS_DATA } from '../../src/data/curriculumData';
import { ENEMIES_DATA } from '../../src/data/enemiesData';
import { HERO_ORDER, HEROES_DATA } from '../../src/data/heroesData';
import { MAPS_DATA } from '../../src/data/mapsData';
import { TOWER_ORDER, TOWERS_DATA } from '../../src/data/towersData';
import { PersistenceService } from '../../src/services/PersistenceService';
import { ChallengeEngine, TECH_TREE_DATA } from '../../src/systems/ChallengeEngine';
import { CombatSystem } from '../../src/systems/CombatSystem';
import { EnemySystem } from '../../src/systems/EnemySystem';
import { HeroSystem } from '../../src/systems/HeroSystem';
import { PathSystem } from '../../src/systems/PathSystem';
import { ResourceEconomy } from '../../src/systems/ResourceEconomy';
import { SynergySystem } from '../../src/systems/SynergySystem';
import { TowerSystem } from '../../src/systems/TowerSystem';
import { TRAINING_ACTIVITIES, TrainingAcademyEngine } from '../../src/systems/TrainingAcademyEngine';

describe('V2.0 Systems, Content Validation, Heroes, Synergies, Challenges & Training Academy', () => {
  it('validates all 10 towers, 4 heroes, 12 enemies, 48 missions, and tech tree references', () => {
    expect(TOWER_ORDER.length).toBe(10);
    expect(HERO_ORDER.length).toBe(4);
    expect(Object.keys(ENEMIES_DATA).length).toBe(12);
    expect(MISSIONS_DATA.length).toBe(48);
    expect(TRAINING_ACTIVITIES.length).toBe(7);
    expect(TECH_TREE_DATA.length).toBe(5);

    const missionIds = new Set<string>();
    for (const m of MISSIONS_DATA) {
      expect(missionIds.has(m.id)).toBe(false);
      missionIds.add(m.id);
      expect(MAPS_DATA[m.mapId]).toBeDefined();
    }

    for (const hId of HERO_ORDER) {
      const h = HEROES_DATA[hId];
      expect(h.abilities.length).toBe(2);
    }
  });

  it('computes non-stacking Command aura and deterministic tower synergies', () => {
    const cmd1 = TowerSystem.createTower('command', { index: 0, x: 100, y: 100 }, 'c1');
    const cmd2 = TowerSystem.createTower('command', { index: 1, x: 130, y: 100 }, 'c2');
    const gun = TowerSystem.createTower('gun', { index: 2, x: 120, y: 130 }, 'g1');
    const sniper = TowerSystem.createTower('sniper', { index: 3, x: 140, y: 130 }, 's1');
    const drone = TowerSystem.createTower('drone', { index: 4, x: 110, y: 140 }, 'd1');

    const statsOneCmd = TowerSystem.computeEffectiveStats(gun, [cmd1, gun]);
    const statsTwoCmd = TowerSystem.computeEffectiveStats(gun, [cmd1, cmd2, gun]);
    expect(statsTwoCmd.damage).toBe(statsOneCmd.damage);

    const sniperSyn = SynergySystem.getActiveSynergiesForTower(sniper, [cmd1, sniper]);
    expect(sniperSyn.some((s) => s.id === 'marked_precision')).toBe(true);

    const droneSyn = SynergySystem.getActiveSynergiesForTower(drone, [cmd1, drone]);
    expect(droneSyn.some((s) => s.id === 'squadron_link')).toBe(true);
    const droneBoosted = TowerSystem.computeEffectiveStats(drone, [cmd1, drone]);
    expect(droneBoosted.fireRate).toBeGreaterThan(TOWERS_DATA.drone.fireRate);
  });

  it('enforces anti-air targeting rules for flying hover enemies', () => {
    const path = new PathSystem(MAPS_DATA.green_valley_1.waypoints);
    const hoverEnemy = EnemySystem.createEnemy('hover', path, 1, 100);
    const cannon = TowerSystem.createTower('cannon', { index: 0, x: hoverEnemy.x, y: hoverEnemy.y + 30 }, 'can');
    const drone = TowerSystem.createTower('drone', { index: 1, x: hoverEnemy.x, y: hoverEnemy.y + 30 }, 'drn');

    expect(TowerSystem.selectTarget(cannon, TowerSystem.computeBaseAndUpgradeStats(cannon), [hoverEnemy])).toBeNull();
    expect(TowerSystem.selectTarget(drone, TowerSystem.computeBaseAndUpgradeStats(drone), [hoverEnemy])).not.toBeNull();
  });

  it('triggers Thermal Shock between Frost and Flame with internal cooldown preventing infinite loops', () => {
    const path = new PathSystem(MAPS_DATA.green_valley_1.waypoints);
    const tank = EnemySystem.createEnemy('tank', path, 1, 150);
    const frost = TowerSystem.createTower('frost', { index: 0, x: tank.x, y: tank.y + 20 }, 'fr');
    const flame = TowerSystem.createTower('flame', { index: 1, x: tank.x + 20, y: tank.y + 20 }, 'fl');
    const economy = new ResourceEconomy(500, 100);

    const ev1 = CombatSystem.updateTowers(0.1, [frost, flame], [tank], economy, 5);
    expect(ev1.floatingTextsCreated.some((f) => f.text === 'THERMAL!')).toBe(true);
    expect(tank.thermalShockCooldown).toBeGreaterThan(0);

    // Immediate second tick should NOT re-trigger Thermal Shock due to 2.5s cooldown
    flame.cooldownRemaining = 0;
    frost.cooldownRemaining = 0;
    const ev2 = CombatSystem.updateTowers(0.1, [frost, flame], [tank], economy, 5);
    expect(ev2.floatingTextsCreated.some((f) => f.text === 'THERMAL!')).toBe(false);
  });

  it('executes Hero abilities and awards Hero XP', () => {
    const path = new PathSystem(MAPS_DATA.green_valley_1.waypoints);
    const enemy = EnemySystem.createEnemy('tank', path, 1, 150);
    const hero = HeroSystem.createActiveHero('guardian', { x: enemy.x, y: enemy.y });
    const economy = new ResourceEconomy(500, 100);

    let healed = 0;
    const res0 = HeroSystem.triggerHeroAbility(hero, 0, [enemy], economy, (amt) => {
      healed += amt;
    });
    expect(res0.triggered).toBe(true);
    expect(healed).toBe(2);

    const hpBefore = enemy.hp;
    const res1 = HeroSystem.triggerHeroAbility(hero, 1, [enemy], economy, () => {});
    expect(res1.triggered).toBe(true);
    expect(enemy.hp).toBeLessThan(hpBefore);
    expect(enemy.stunTimer).toBeGreaterThan(0);

    expect(HeroSystem.addHeroXp(hero, 150)).toBe(true);
    expect(hero.level).toBe(2);
  });

  it('generates deterministic daily/weekly challenges aligned with player curriculum tier', () => {
    const fixedDate = new Date('2026-11-18T12:00:00Z');
    const c1 = ChallengeEngine.getDailyChallenge('beginner', fixedDate);
    const c2 = ChallengeEngine.getDailyChallenge('beginner', fixedDate);
    expect(c1.id).toBe(c2.id);
    expect(c1.missionId).toBe(c2.missionId);
    const mission = MISSIONS_DATA.find((m) => m.id === c1.missionId)!;
    expect(mission.worldId).toBeLessThanOrEqual(2);
  });

  it('runs Training Academy and Standardized Tests without altering campaign unlocks', () => {
    const profile = PersistenceService.createDefaultProfile('p1', 'Tester');
    const engine = new TrainingAcademyEngine({
      profile,
      mode: 'assessment',
      durationSec: 60,
      pool: 'beginner',
      language: 'pl',
    });

    let now = 1000;
    for (let i = 0; i < 20; i++) {
      const ch = engine.typingEngine.getExpectedChar();
      if (ch) engine.handleKey(ch, (now += 200), false);
    }
    engine.tick(10);
    const summary = engine.finishAndRecord();
    expect(summary.correct).toBe(20);
    expect(profile.standardizedTestRecords?.length).toBe(1);
    expect(Object.keys(profile.completedMissions).length).toBe(0);
  });
});
