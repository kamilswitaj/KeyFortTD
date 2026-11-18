import { HEROES_DATA } from '../data/heroesData';
import { ActiveEnemy, ActiveHero, FloatingTextEffect, HeroId, Point2D, ProjectileEffect } from '../types';
import { CombatSystem } from './CombatSystem';
import { ResourceEconomy } from './ResourceEconomy';

export interface HeroTickResult {
  projectilesCreated: ProjectileEffect[];
  floatingTextsCreated: FloatingTextEffect[];
  enemiesKilled: ActiveEnemy[];
}

export class HeroSystem {
  private static idCounter = 1;

  public static createActiveHero(heroId: HeroId, anchor: Point2D): ActiveHero {
    return {
      id: heroId,
      x: anchor.x,
      y: anchor.y,
      level: 1,
      xp: 0,
      cooldownRemaining: 0,
      abilityCooldowns: [0, 0],
      angle: 0,
      muzzleFlashTimer: 0,
      activeBuffTimer: 0,
    };
  }

  public static addHeroXp(hero: ActiveHero, xpGain: number): boolean {
    hero.xp += xpGain;
    let leveledUp = false;
    while (hero.xp >= hero.level * 120 && hero.level < 10) {
      hero.xp -= hero.level * 120;
      hero.level += 1;
      leveledUp = true;
    }
    return leveledUp;
  }

  public static getEffectiveDamage(hero: ActiveHero): number {
    const def = HEROES_DATA[hero.id];
    return Math.round(def.baseDamage * (1 + (hero.level - 1) * 0.14));
  }

  public static updateHero(
    hero: ActiveHero,
    dtSec: number,
    enemies: ActiveEnemy[],
    economy: ResourceEconomy
  ): HeroTickResult {
    const res: HeroTickResult = {
      projectilesCreated: [],
      floatingTextsCreated: [],
      enemiesKilled: [],
    };

    const def = HEROES_DATA[hero.id];
    if (hero.muzzleFlashTimer > 0) hero.muzzleFlashTimer = Math.max(0, hero.muzzleFlashTimer - dtSec);
    if (hero.activeBuffTimer > 0) hero.activeBuffTimer = Math.max(0, hero.activeBuffTimer - dtSec);
    hero.abilityCooldowns[0] = Math.max(0, hero.abilityCooldowns[0] - dtSec);
    hero.abilityCooldowns[1] = Math.max(0, hero.abilityCooldowns[1] - dtSec);

    if (hero.cooldownRemaining > 0) {
      hero.cooldownRemaining = Math.max(0, hero.cooldownRemaining - dtSec);
      return res;
    }

    const detectsGhosts = hero.id === 'ranger' || hero.id === 'arcanist';
    const target = enemies
      .filter((e) => {
        if (e.hp <= 0) return false;
        if (e.isGhost && !e.isRevealed && !detectsGhosts) return false;
        return Math.hypot(e.x - hero.x, e.y - hero.y) <= def.baseRange + e.radius;
      })
      .sort((a, b) => b.pathProgress - a.pathProgress)[0];

    if (!target) return res;

    hero.angle = Math.atan2(target.y - hero.y, target.x - hero.x);
    hero.cooldownRemaining = 1 / def.fireRate;
    hero.muzzleFlashTimer = 0.14;

    const dmg = HeroSystem.getEffectiveDamage(hero);
    const stats = {
      detectsGhosts,
      armorShredPercent: hero.id === 'ranger' ? 0.5 : 0,
      slowPercent: hero.id === 'arcanist' ? 0.2 : 0,
      slowDuration: hero.id === 'arcanist' ? 2.0 : 0,
    };

    CombatSystem.applyHitToEnemy(target, dmg, stats);
    if (hero.id === 'arcanist') {
      economy.addEnergy(0.4);
    }

    res.projectilesCreated.push({
      id: `hproj_${HeroSystem.idCounter++}`,
      kind: hero.id === 'ranger' ? 'sniper_beam' : hero.id === 'arcanist' ? 'frost_pulse' : 'bullet',
      fromX: hero.x,
      fromY: hero.y,
      toX: target.x,
      toY: target.y,
      color: def.color,
      radius: hero.id === 'arcanist' ? 22 : undefined,
      progress: 0,
      duration: 0.18,
    });

    return res;
  }

  public static triggerHeroAbility(
    hero: ActiveHero,
    slotIndex: 0 | 1,
    enemies: ActiveEnemy[],
    economy: ResourceEconomy,
    healBaseCallback: (amount: number) => void
  ): { triggered: boolean; projectiles: ProjectileEffect[]; floatingTexts: FloatingTextEffect[] } {
    const def = HEROES_DATA[hero.id];
    const ability = def.abilities[slotIndex];
    if (hero.abilityCooldowns[slotIndex] > 0 || economy.getEnergy() < ability.energyCost) {
      return { triggered: false, projectiles: [], floatingTexts: [] };
    }

    if (!economy.consumeEnergy(ability.energyCost)) {
      return { triggered: false, projectiles: [], floatingTexts: [] };
    }

    hero.abilityCooldowns[slotIndex] = ability.cooldownSec;
    const projectiles: ProjectileEffect[] = [];
    const floatingTexts: FloatingTextEffect[] = [];
    const lvlScale = 1 + (hero.level - 1) * 0.12;

    if (hero.id === 'guardian') {
      if (slotIndex === 0) {
        // Bastion Shield: heal +2 Base HP + 5s rally buff
        healBaseCallback(2);
        hero.activeBuffTimer = 5.0;
        floatingTexts.push({
          id: `hft_${HeroSystem.idCounter++}`,
          x: hero.x,
          y: hero.y - 24,
          text: '+2 HP & RALLY!',
          color: '#38bdf8',
          life: 1.0,
          maxLife: 1.0,
        });
      } else {
        // Hammer Slam: 140 AoE + 2.2s stun
        for (const e of enemies) {
          if (e.hp <= 0) continue;
          if (Math.hypot(e.x - hero.x, e.y - hero.y) <= 175) {
            CombatSystem.applyHitToEnemy(e, Math.round(140 * lvlScale), { stunDuration: 2.2, detectsGhosts: true });
          }
        }
        projectiles.push({
          id: `hproj_${HeroSystem.idCounter++}`,
          kind: 'shockwave',
          fromX: hero.x,
          fromY: hero.y,
          toX: hero.x,
          toY: hero.y,
          color: '#38bdf8',
          radius: 175,
          progress: 0,
          duration: 0.4,
        });
      }
    } else if (hero.id === 'engineer') {
      if (slotIndex === 0) {
        // Power Surge: +55 energy + 4s overcharge
        economy.addEnergy(55);
        economy.activateOverdrive(4);
        floatingTexts.push({
          id: `hft_${HeroSystem.idCounter++}`,
          x: hero.x,
          y: hero.y - 24,
          text: '+55⚡ OVERCHARGE!',
          color: '#4ade80',
          life: 1.0,
          maxLife: 1.0,
        });
      } else {
        // Support Drone Volley: 6 homing bolts at strongest enemies
        const targets = [...enemies].filter((e) => e.hp > 0).sort((a, b) => b.hp - a.hp).slice(0, 6);
        for (const t of targets) {
          CombatSystem.applyHitToEnemy(t, Math.round(48 * lvlScale), { detectsGhosts: true });
          projectiles.push({
            id: `hproj_${HeroSystem.idCounter++}`,
            kind: 'drone_bolt',
            fromX: hero.x,
            fromY: hero.y,
            toX: t.x,
            toY: t.y,
            color: '#4ade80',
            progress: 0,
            duration: 0.25,
          });
        }
      }
    } else if (hero.id === 'ranger') {
      if (slotIndex === 0) {
        // Priority Mark: top 3 strongest enemies take +30% damage for 7s
        const targets = [...enemies].filter((e) => e.hp > 0).sort((a, b) => b.hp - a.hp).slice(0, 3);
        for (const t of targets) {
          t.spotterBonus = Math.max(t.spotterBonus, 0.3);
          t.spotterTimer = Math.max(t.spotterTimer, 7.0);
          t.isRevealed = true;
        }
      } else {
        // Piercing Volley: 5 armor-piercing shots
        const targets = [...enemies].filter((e) => e.hp > 0).sort((a, b) => b.pathProgress - a.pathProgress).slice(0, 5);
        for (const t of targets) {
          CombatSystem.applyHitToEnemy(t, Math.round(110 * lvlScale), { armorShredPercent: 0.85, detectsGhosts: true });
          projectiles.push({
            id: `hproj_${HeroSystem.idCounter++}`,
            kind: 'sniper_beam',
            fromX: hero.x,
            fromY: hero.y,
            toX: t.x,
            toY: t.y,
            color: '#f43f5e',
            progress: 0,
            duration: 0.25,
          });
        }
      }
    } else if (hero.id === 'arcanist') {
      if (slotIndex === 0) {
        // Arcane Nova
        for (const e of enemies) {
          if (e.hp <= 0) continue;
          if (Math.hypot(e.x - hero.x, e.y - hero.y) <= 185) {
            CombatSystem.applyHitToEnemy(e, Math.round(125 * lvlScale), {
              slowPercent: 0.45,
              slowDuration: 4.0,
              detectsGhosts: true,
            });
          }
        }
        projectiles.push({
          id: `hproj_${HeroSystem.idCounter++}`,
          kind: 'shockwave',
          fromX: hero.x,
          fromY: hero.y,
          toX: hero.x,
          toY: hero.y,
          color: '#c084fc',
          radius: 185,
          progress: 0,
          duration: 0.4,
        });
      } else {
        // Energy Siphon
        const targets = [...enemies].filter((e) => e.hp > 0).slice(0, 6);
        let restored = 0;
        for (const t of targets) {
          CombatSystem.applyHitToEnemy(t, Math.round(55 * lvlScale), { detectsGhosts: true });
          restored += 8;
          projectiles.push({
            id: `hproj_${HeroSystem.idCounter++}`,
            kind: 'lightning',
            fromX: hero.x,
            fromY: hero.y,
            toX: t.x,
            toY: t.y,
            chainPoints: [
              { x: hero.x, y: hero.y },
              { x: t.x, y: t.y },
            ],
            color: '#c084fc',
            progress: 0,
            duration: 0.24,
          });
        }
        economy.addEnergy(restored);
      }
    }

    return { triggered: true, projectiles, floatingTexts };
  }
}
