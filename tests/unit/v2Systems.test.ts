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
import { STANDARDIZED_POOLS, TRAINING_ACTIVITIES, TrainingAcademyEngine } from '../../src/systems/TrainingAcademyEngine';

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

  it('compares only equivalent challenge difficulty and preserves separate best results from bounded history', () => {
    const challenge = ChallengeEngine.getDailyChallenge('home_anchors', new Date('2026-11-26T12:00:00Z'));
    const standard = ChallengeEngine.buildChallengeSessionConfig(challenge, 'standard');
    const relaxed = ChallengeEngine.buildChallengeSessionConfig(challenge, 'relaxed');
    const a = PersistenceService.createDefaultProfile('a', 'A');
    const b = PersistenceService.createDefaultProfile('b', 'B');
    const result = (profileId: string, difficulty: 'standard' | 'relaxed', score: number) => ({
      challengeId: challenge.id, rulesetVersion: challenge.rulesetVersion, profileId, timestamp: 12345,
      difficulty, score, accuracy: 0.95, correctChars: 80, errors: 4, durationSec: 60,
      wpm: 16, baseDamage: 0, wavesCompleted: 3, towerTypesUsed: ['gun'] as const,
      heroId: null, status: 'completed' as const
    });
    const r1 = ChallengeEngine.recordChallengeCompletion(a, standard, {...result('a', 'standard', 400), towerTypesUsed: ['gun']});
    const r2 = ChallengeEngine.recordChallengeCompletion(a, relaxed, {...result('a', 'relaxed', 1500), towerTypesUsed: ['gun']});
    expect(r1.awardedTechPoints).toBe(standard.techPointReward);
    expect(r2.awardedTechPoints).toBe(0);
    ChallengeEngine.recordChallengeCompletion(b, standard, {...result('b', 'standard', 600), towerTypesUsed: ['gun']});
    expect(ChallengeEngine.getChallengeLeaderboard([a,b],challenge.id,challenge.rulesetVersion,'standard')
      .map(x => [x.profileId,x.score,x.difficulty])).toEqual([['b',600,'standard'],['a',400,'standard']]);
    expect(ChallengeEngine.getChallengeLeaderboard([a,b],challenge.id,challenge.rulesetVersion,'relaxed')
      .map(x => [x.profileId,x.score])).toEqual([['a',1500]]);
    // Even after challengeHistory overflows 60 entries / is cleared, per-difficulty bests persist!
    a.challengeHistory = [];
    expect(ChallengeEngine.getChallengeLeaderboard([a,b],challenge.id,challenge.rulesetVersion,'relaxed')
      .map(x => [x.profileId,x.score])).toEqual([['a',1500]]);
    expect(ChallengeEngine.getChallengeLeaderboard([a,b],challenge.id,challenge.rulesetVersion,'standard')
      .map(x => [x.profileId, x.score])).toEqual([['b', 600], ['a', 400]]);
    expect(ChallengeEngine.getChallengeLeaderboard([a,b],challenge.id,challenge.rulesetVersion+1,'standard')).toEqual([]);

    // Verify bounded retention (max 240 keys in challengeBestByKey)
    const many: Record<string, any> = {};
    for (let i = 0; i < 260; i++) {
      many[`c_${i}::v1::standard`] = {
        challengeId: `c_${i}`, rulesetVersion: 1, difficulty: 'standard', score: 100,
        accuracy: 0.9, wpm: 20, correctChars: 50, baseDamage: 0, wavesCompleted: 1,
        towerTypesUsed: ['gun'], timestamp: 1000 + i
      };
    }
    const pruned = ChallengeEngine.pruneChallengeBestByKey(many);
    expect(Object.keys(pruned).length).toBe(240);
    expect(pruned['c_259::v1::standard']).toBeDefined();
    expect(pruned['c_0::v1::standard']).toBeUndefined();
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

  it('validates STANDARDIZED_POOLS characters, ahead-of-curriculum drills, null rhythm consistency on tiny samples, and academy regressions', () => {
    // 1. Beginner standardized pool strictly uses home row + g/h/;/space
    const beginnerAllowed = new Set(['f', 'j', 'd', 'k', 's', 'l', 'a', 'g', 'h', ';', ' ']);
    for (const lang of ['pl', 'en'] as const) {
      for (const text of STANDARDIZED_POOLS.beginner[lang]) {
        for (const ch of text) {
          expect(beginnerAllowed.has(ch), `Unexpected char '${ch}' in beginner ${lang} pool: "${text}"`).toBe(true);
        }
      }
    }

    // 2. Ahead-of-curriculum drills are explicitly marked and never unlock campaign missions/keys
    const diacriticsDef = TRAINING_ACTIVITIES.find((a) => a.id === 'diacritics')!;
    const uppercaseDef = TRAINING_ACTIVITIES.find((a) => a.id === 'uppercase')!;
    expect(diacriticsDef.isAheadOfCurriculum).toBe(true);
    expect(uppercaseDef.isAheadOfCurriculum).toBe(true);

    const svc = new PersistenceService();
    const p1 = svc.getActiveProfile();
    const completedBefore = Object.keys(p1.completedMissions).length;
    const drill = new TrainingAcademyEngine({ profile: p1, mode: 'training', activityKind: 'diacritics', language: 'pl' });
    for (let i = 0; i < 4; i++) {
      const ch = drill.typingEngine.getExpectedChar();
      if (ch) drill.handleKey(ch, 1000 + i * 250, false);
    }
    const tinyDrillResult = drill.finishAndRecord(false);
    // Tiny sample (< 8 intervals) must return null consistency instead of fake 100%
    expect(tinyDrillResult.consistency).toBeNull();
    expect(Object.keys(p1.completedMissions).length).toBe(completedBefore);

    // 3. Aborted timed test is never qualified
    const abortedTest = new TrainingAcademyEngine({
      profile: p1,
      mode: 'assessment',
      durationSec: 30,
      pool: 'beginner',
      language: 'pl',
    });
    let t = 2000;
    for (let i = 0; i < 25; i++) {
      const ch = abortedTest.typingEngine.getExpectedChar();
      if (ch) abortedTest.handleKey(ch, (t += 220), false);
    }
    abortedTest.tick(15);
    const abortRes = abortedTest.finishAndRecord(true);
    expect(abortRes.qualified).toBe(false);
    expect(abortRes.consistency).not.toBeNull();
    expect((p1.standardizedTestRecords ?? []).length).toBe(0);

    // 4. Focus loss invalidates timed test qualification
    const focusLostTest = new TrainingAcademyEngine({
      profile: p1,
      mode: 'assessment',
      durationSec: 30,
      pool: 'beginner',
      language: 'pl',
    });
    for (let i = 0; i < 25; i++) {
      const ch = focusLostTest.typingEngine.getExpectedChar();
      if (ch) focusLostTest.handleKey(ch, (t += 200), false);
    }
    focusLostTest.markFocusLost();
    focusLostTest.tick(30);
    const focusRes = focusLostTest.finishAndRecord(false);
    expect(focusRes.focusLostInvalidated).toBe(true);
    expect(focusRes.qualified).toBe(false);

    // 5. Valid timed test qualifies, persists across JSON export/import, and stays isolated to ownerProfileId
    const p2 = svc.createProfile('Ola', '🦉');
    const validTest = new TrainingAcademyEngine({
      profile: p1,
      mode: 'assessment',
      durationSec: 30,
      pool: 'beginner',
      language: 'pl',
    });
    for (let i = 0; i < 30; i++) {
      const ch = validTest.typingEngine.getExpectedChar();
      if (ch) validTest.handleKey(ch, (t += 200), false);
    }
    validTest.tick(30);
    // Simulate switching active profile before finishing
    svc.switchProfile(p2.id);
    const validRes = validTest.finishAndRecord(false);
    expect(validRes.qualified).toBe(true);
    expect((p1.standardizedTestRecords ?? []).length).toBe(1);
    expect((p2.standardizedTestRecords ?? []).length).toBe(0);

    // Export -> fresh PersistenceService import preserves standardizedTestRecords
    const exported = svc.exportSaveJson();
    localStorage.clear();
    const svc2 = new PersistenceService();
    expect(svc2.importSaveJson(exported).success).toBe(true);
    const reloadedP1 = svc2.getAllProfiles().find((p) => p.id === p1.id)!;
    expect(reloadedP1.standardizedTestRecords?.length).toBe(1);
    expect(reloadedP1.standardizedTestRecords?.[0].wpm).toBe(validRes.wpm);
  });

  it('determines challenge tier eligibility from actual introduced keys and mission progress, never exposing unknown characters on partial/imported profiles', () => {
    const fresh = PersistenceService.createDefaultProfile('p_fresh', 'Nowy');
    expect(ChallengeEngine.getPlayerEligibleTier(fresh)).toBe('home_anchors');

    // After 3 missions (w1_m1..w1_m3): still home_anchors
    const after3 = PersistenceService.createDefaultProfile('p_3', 'Po3');
    for (const id of ['w1_m1', 'w1_m2', 'w1_m3']) {
      after3.completedMissions[id] = {
        missionId: id, completed: true, stars: 3, bestAccuracy: 0.95, bestWpm: 20, bestScore: 1000, timesCompleted: 1,
      };
    }
    expect(ChallengeEngine.getPlayerEligibleTier(after3)).toBe('home_anchors');

    // After 6 missions of World 1 only (w1_m1..w1_m6): does NOT know World 2 keys yet -> still home_anchors!
    const afterW1 = PersistenceService.createDefaultProfile('p_w1', 'PoW1');
    for (let i = 1; i <= 6; i++) {
      const id = `w1_m${i}`;
      afterW1.completedMissions[id] = {
        missionId: id, completed: true, stars: 3, bestAccuracy: 0.95, bestWpm: 20, bestScore: 1000, timesCompleted: 1,
      };
    }
    expect(ChallengeEngine.getPlayerEligibleTier(afterW1)).toBe('home_anchors');

    // Non-sequential/imported profile with 10 missions that lacks World 2 keys (e.g. w1 + 4 random w1/w2 without w2_m5/m6)
    const partial = PersistenceService.createDefaultProfile('p_partial', 'Czesciowy');
    for (let i = 1; i <= 6; i++) {
      partial.completedMissions[`w1_m${i}`] = {
        missionId: `w1_m${i}`, completed: true, stars: 2, bestAccuracy: 0.9, bestWpm: 20, bestScore: 800, timesCompleted: 1,
      };
    }
    for (let i = 1; i <= 3; i++) {
      partial.completedMissions[`w2_m${i}`] = {
        missionId: `w2_m${i}`, completed: true, stars: 2, bestAccuracy: 0.9, bestWpm: 20, bestScore: 800, timesCompleted: 1,
      };
    }
    expect(ChallengeEngine.getPlayerEligibleTier(partial)).toBe('home_anchors');

    // Completing World 1 + World 2 (12 missions, all World 2 keys introduced) unlocks beginner
    for (let i = 4; i <= 6; i++) {
      partial.completedMissions[`w2_m${i}`] = {
        missionId: `w2_m${i}`, completed: true, stars: 3, bestAccuracy: 0.95, bestWpm: 25, bestScore: 1000, timesCompleted: 1,
      };
    }
    expect(ChallengeEngine.getPlayerEligibleTier(partial)).toBe('beginner');

    // Voluntary ahead-of-curriculum drill (diacritics/uppercase) never unlocks campaign keys or challenge tiers
    const aheadEngine = new TrainingAcademyEngine({
      profile: after3,
      mode: 'training',
      activityKind: 'diacritics',
      language: 'pl',
    });
    for (let i = 0; i < 12; i++) {
      const ch = aheadEngine.typingEngine.getExpectedChar();
      if (ch) aheadEngine.handleKey(ch, 5000 + i * 180, false);
    }
    aheadEngine.finishAndRecord(false);
    expect(ChallengeEngine.getPlayerEligibleTier(after3)).toBe('home_anchors');
    expect(ChallengeEngine.getIntroducedKeysForPlayer(after3).has('ą')).toBe(false);
  });
});
