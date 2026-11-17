import { describe, expect, it } from 'vitest';
import { MAPS_DATA } from '../../src/data/mapsData';
import { CombatSystem } from '../../src/systems/CombatSystem';
import { EnemySystem } from '../../src/systems/EnemySystem';
import { PathSystem } from '../../src/systems/PathSystem';
import { ResourceEconomy } from '../../src/systems/ResourceEconomy';
import { TowerSystem } from '../../src/systems/TowerSystem';

describe('ResourceEconomy, TowerSystem, EnemySystem, and CombatSystem', () => {
  const path = new PathSystem(MAPS_DATA.green_valley_1.waypoints);

  it('maintains baseline tower functionality when energy is 0 and overcharges at high energy', () => {
    const economy = new ResourceEconomy(300, 0);
    expect(economy.getPowerState(0)).toBe('baseline');
    expect(economy.getEfficiencyMultiplier(0)).toBeCloseTo(0.55, 2);

    economy.addEnergy(30);
    expect(economy.getPowerState(0)).toBe('powered');
    expect(economy.getEfficiencyMultiplier(0)).toBeCloseTo(1.0, 2);

    economy.addEnergy(50); // total 80 / 100
    expect(economy.getPowerState(0)).toBe('overcharged');
    expect(economy.getEfficiencyMultiplier(0)).toBeCloseTo(1.4, 2);
  });

  it('selects targets accurately according to First, Last, Strongest, and Nearest priorities', () => {
    const pad = MAPS_DATA.green_valley_1.pads[0];
    const tower = TowerSystem.createTower('sniper', pad, '1');
    const stats = TowerSystem.computeEffectiveStats(tower, [tower]);

    const eFirst = EnemySystem.createEnemy('scout', path, 1, 200);
    const eLast = EnemySystem.createEnemy('scout', path, 1, 40);
    const eStrong = EnemySystem.createEnemy('tank', path, 2, 120);

    // Ensure all are in range of sniper
    eFirst.x = pad.x + 80;
    eFirst.y = pad.y;
    eLast.x = pad.x + 20;
    eLast.y = pad.y;
    eStrong.x = pad.x + 50;
    eStrong.y = pad.y;

    const enemies = [eLast, eStrong, eFirst];

    tower.targeting = 'first';
    expect(TowerSystem.selectTarget(tower, stats, enemies)?.id).toBe(eFirst.id);

    tower.targeting = 'last';
    expect(TowerSystem.selectTarget(tower, stats, enemies)?.id).toBe(eLast.id);

    tower.targeting = 'strongest';
    expect(TowerSystem.selectTarget(tower, stats, enemies)?.id).toBe(eStrong.id);

    tower.targeting = 'nearest';
    expect(TowerSystem.selectTarget(tower, stats, enemies)?.id).toBe(eLast.id);
  });

  it('requires Ghost detection to target Ghosts unless revealed or upgraded', () => {
    const pad = MAPS_DATA.green_valley_1.pads[0];
    const gunTower = TowerSystem.createTower('gun', pad, 'g1');
    const ghost = EnemySystem.createEnemy('ghost', path, 1, 100);
    ghost.x = pad.x + 30;
    ghost.y = pad.y;

    const baseStats = TowerSystem.computeEffectiveStats(gunTower, [gunTower]);
    expect(TowerSystem.selectTarget(gunTower, baseStats, [ghost])).toBeNull();

    // Upgrade Gun Special to Tier 3 (Spectral Tracker Optics)
    gunTower.upgrades.special = 3;
    const upgStats = TowerSystem.computeEffectiveStats(gunTower, [gunTower]);
    expect(upgStats.detectsGhosts).toBe(true);
    expect(TowerSystem.selectTarget(gunTower, upgStats, [ghost])?.id).toBe(ghost.id);
  });

  it('handles Splitter fragmentation and Cryo Containment suppression', () => {
    const economy = new ResourceEconomy(200, 50);
    const splitter1 = EnemySystem.createEnemy('splitter', path, 1, 120);
    splitter1.hp = 0;

    const res1 = CombatSystem.resolveDefeatedEnemies([splitter1], path, economy);
    expect(res1.survivingEnemies.length).toBe(2); // Spawned 2 mini-cores

    const splitter2 = EnemySystem.createEnemy('splitter', path, 1, 120);
    splitter2.splitterSuppressed = true;
    splitter2.hp = 0;

    const res2 = CombatSystem.resolveDefeatedEnemies([splitter2], path, economy);
    expect(res2.survivingEnemies.length).toBe(0); // Suppressed by Cryo Containment!
  });

  it('transitions Boss through combat phases and summons escorts', () => {
    const boss = EnemySystem.createEnemy('boss', path, 1.0, 50, 1);
    expect(boss.bossPhase).toBe(1);

    boss.hp = Math.floor(boss.maxHp * 0.6);
    const step2 = EnemySystem.updateEnemy(boss, 0.1, path);
    expect(boss.bossPhase).toBe(2);
    expect(step2.bossPhaseTriggered).toBe(2);
    expect(step2.spawnedMinions.length).toBeGreaterThan(0);

    boss.hp = Math.floor(boss.maxHp * 0.25);
    const step3 = EnemySystem.updateEnemy(boss, 0.1, path);
    expect(boss.bossPhase).toBe(3);
    expect(step3.bossPhaseTriggered).toBe(3);
  });
});
