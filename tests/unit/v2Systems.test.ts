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
import { GameSessionEngine } from '../../src/systems/GameSessionEngine';
import { HeroSystem } from '../../src/systems/HeroSystem';
import { PathSystem } from '../../src/systems/PathSystem';
import { ProgressionEngine } from '../../src/systems/ProgressionEngine';
import { ResourceEconomy } from '../../src/systems/ResourceEconomy';
import { SynergySystem } from '../../src/systems/SynergySystem';
import { TechnologySystem } from '../../src/systems/TechnologySystem';
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

  it('handles every challenge date without a signed seed index error and picks actual boss missions', () => {
    for (let day = 0; day < 365; day++) {
      const date = new Date(Date.UTC(2027, 0, day + 1));
      for (const tier of ['beginner', 'intermediate', 'full'] as const) {
        const daily = ChallengeEngine.getDailyChallenge(tier, date);
        const weekly = ChallengeEngine.getWeeklyChallenge(tier, date);
        expect(daily.kind).toBeTruthy();
        expect(weekly.kind).toBeTruthy();
        if (weekly.kind === 'boss_rush') expect(MISSIONS_DATA.find(m => m.id === weekly.missionId)?.isBossMission).toBe(true);
      }
    }
  });

  it('does not qualify short, aborted or empty assessments and counts practice only once', () => {
    const p = PersistenceService.createDefaultProfile('p2', 'Tester');
    const engine = new TrainingAcademyEngine({profile:p, mode:'assessment',durationSec:60});
    engine.handleKey('Shift', 1000);
    expect(engine.started).toBe(false);
    for(let i=0;i<25;i++) engine.handleKey(engine.typingEngine.getExpectedChar()!, 2000+i*250);
    engine.tick(7);
    expect(engine.finishAndRecord().qualified).toBe(false);
    engine.finishAndRecord();
    expect(p.totalCharsTyped).toBe(25);
    expect(p.sessionHistory[0].status).toBe('abandoned');
    expect(p.standardizedTestRecords ?? []).toHaveLength(0);
    const empty = new TrainingAcademyEngine({profile:p,mode:'training'});
    empty.finishAndRecord();
    expect(p.sessionHistory).toHaveLength(1);
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
    engine.tick(60);
    const summary = engine.finishAndRecord();
    expect(summary.correct).toBe(20);
    expect(summary.wpm).toBe(4);
    expect(profile.standardizedTestRecords?.length).toBe(1);
    expect(profile.sessionHistory).toHaveLength(1);
    expect(Object.values(profile.dailyStats)[0].correctChars).toBe(20);
    engine.finishAndRecord();
    expect(profile.totalCorrectChars).toBe(20);
    expect(profile.standardizedTestRecords?.length).toBe(1);
    expect(Object.keys(profile.completedMissions).length).toBe(0);
  });

  it('enforces curriculum-safe ChallengeEngine tiers, UTC week boundaries, Two Towers, No Leak, and exactly-once rewards', () => {
    const freshProfile = PersistenceService.createDefaultProfile('p_fresh', 'Novice');
    expect(ChallengeEngine.getPlayerEligibleTier(freshProfile)).toBe('home_anchors');
    const safeDaily = ChallengeEngine.getDailyChallenge('home_anchors', new Date('2025-12-31T23:50:00Z'));
    expect(['w1_m1', 'w1_m2']).toContain(safeDaily.missionId);

    // ISO week boundary determinism across year boundary
    expect(ChallengeEngine.getWeekKey(new Date('2025-12-31T12:00:00Z'))).toBe('2026-W01');
    expect(ChallengeEngine.getWeekKey(new Date('2026-01-01T12:00:00Z'))).toBe('2026-W01');
    expect(ChallengeEngine.getWeekKey(new Date('2026-01-05T12:00:00Z'))).toBe('2026-W02');

    // Two Towers restriction persists even after selling a tower
    const advProfile = PersistenceService.createDefaultProfile('p_adv', 'Pro');
    const twoTowersConfig = ChallengeEngine.buildChallengeSessionConfig(
      {
        ...safeDaily,
        kind: 'two_towers',
        tier: 'beginner',
        maxTowerTypes: 2,
      },
      'standard'
    );
    const session = new GameSessionEngine({
      mode: 'challenge',
      mission: MISSIONS_DATA[0],
      profile: advProfile,
      challengeConfig: twoTowersConfig,
    });
    session.economy.addGold(1000);
    const t1 = session.buildTower('gun', 0)!;
    expect(t1).not.toBeNull();
    const t2 = session.buildTower('cannon', 1)!;
    expect(t2).not.toBeNull();
    session.sellTower(t1.id);
    // Selling gun does NOT allow building a 3rd distinct type (frost)
    expect(session.canBuildTowerType('frost')).toBe(false);
    expect(session.buildTower('frost', 2)).toBeNull();

    // Exactly-once Tech Point reward & campaign mission stays untouched
    const rec1 = ChallengeEngine.recordChallengeCompletion(advProfile, twoTowersConfig, {
      challengeId: twoTowersConfig.challengeId,
      rulesetVersion: 1,
      profileId: advProfile.id,
      timestamp: 1000,
      difficulty: 'standard',
      score: 1200,
      accuracy: 0.95,
      correctChars: 50,
      errors: 2,
      durationSec: 40,
      wpm: 25,
      baseDamage: 0,
      wavesCompleted: 3,
      towerTypesUsed: ['gun', 'cannon'],
      heroId: null,
      status: 'completed',
    });
    expect(rec1.awardedTechPoints).toBe(twoTowersConfig.techPointReward);
    const rec2 = ChallengeEngine.recordChallengeCompletion(advProfile, twoTowersConfig, {
      challengeId: twoTowersConfig.challengeId,
      rulesetVersion: 1,
      profileId: advProfile.id,
      timestamp: 2000,
      difficulty: 'standard',
      score: 1400,
      accuracy: 0.96,
      correctChars: 50,
      errors: 2,
      durationSec: 38,
      wpm: 26,
      baseDamage: 0,
      wavesCompleted: 3,
      towerTypesUsed: ['gun', 'cannon'],
      heroId: null,
      status: 'completed',
    });
    expect(rec2.awardedTechPoints).toBe(0);
    expect(advProfile.completedMissions[twoTowersConfig.sourceMissionId]).toBeUndefined();
  });

  it('applies all 5 TechnologySystem modifiers, validates purchases, and applies Guardian aura & explicitNoHero', () => {
    const profile = PersistenceService.createDefaultProfile('p_tech', 'TechUser');
    profile.techPoints = 3;
    expect(TechnologySystem.purchaseTechnology(profile, 'invalid_id').success).toBe(false);
    expect(TechnologySystem.purchaseTechnology(profile, 'tech_kinetic_1').success).toBe(true);
    expect(TechnologySystem.purchaseTechnology(profile, 'tech_kinetic_1').success).toBe(false);
    expect(TechnologySystem.purchaseTechnology(profile, 'tech_energy_1').success).toBe(true);
    expect(TechnologySystem.purchaseTechnology(profile, 'tech_defense_1').success).toBe(true);
    expect(profile.techPoints).toBe(0);

    const mods = TechnologySystem.computeTechModifiers(profile.unlockedTechs);
    expect(mods.kineticDamageMultiplier).toBe(1.06);
    expect(mods.startingEnergyBonus).toBe(10);
    expect(mods.startingLivesBonus).toBe(2);

    const gun = TowerSystem.createTower('gun', { index: 0, x: 100, y: 100 }, 'g');
    const guardian = HeroSystem.createActiveHero('guardian', { x: 130, y: 100 });
    guardian.activeBuffTimer = 5.0; // Rally active!
    const boosted = TowerSystem.computeEffectiveStats(gun, [gun], { hero: guardian, techModifiers: mods });
    expect(boosted.damage).toBeGreaterThan(TOWERS_DATA.gun.damage);
    expect(boosted.fireRate).toBeCloseTo(TOWERS_DATA.gun.fireRate * 1.35, 1);

    // explicitNoHero must not be overwritten on mission win
    profile.explicitNoHero = true;
    profile.selectedHeroId = null;
    ProgressionEngine.evaluateMissionResult(
      MISSIONS_DATA[2],
      profile,
      20,
      20,
      100,
      0.95,
      28,
      15,
      { d: { key: 'd', attempts: 12, correct: 12, errors: 0 } }
    );
    expect(profile.unlockedHeroes).toContain('guardian');
    expect(profile.selectedHeroId).toBeNull();
  });

  it('executes Support healing aura, Evasive dodge, and distinct World Boss phase transitions', () => {
    const path = new PathSystem(MAPS_DATA.green_valley_1.waypoints);
    const ally = EnemySystem.createEnemy('tank', path, 1, 100);
    ally.hp = 100;
    const sup = EnemySystem.createEnemy('support', path, 1, 120);
    EnemySystem.applySupportAuras([ally, sup], 1.0);
    expect(ally.hp).toBeCloseTo(109, 1);

    // Dead ally must never be resurrected
    const dead = EnemySystem.createEnemy('scout', path, 1, 110);
    dead.hp = 0;
    EnemySystem.applySupportAuras([dead, sup], 1.0);
    expect(dead.hp).toBe(0);

    // Evasive dodges every 4th single-target kinetic hit when not slowed
    const ev = EnemySystem.createEnemy('evasive', path, 1, 140);
    const gun = TowerSystem.createTower('gun', { index: 0, x: 100, y: 100 }, 'g');
    const hits = [1, 2, 3, 4].map(() => CombatSystem.applyHitToEnemy(ev, 10, {}, gun));
    expect(hits[3]).toBe(0);

    // World 2 boss summons ghost in phase 2
    const boss2 = EnemySystem.createEnemy('boss', path, 1, 100, 2);
    boss2.hp = Math.round(boss2.maxHp * 0.5);
    const step = EnemySystem.updateEnemy(boss2, 0.1, path);
    expect(step.bossPhaseTriggered).toBe(2);
    expect(step.spawnedMinions.some((m) => m.type === 'ghost')).toBe(true);
  });
});
