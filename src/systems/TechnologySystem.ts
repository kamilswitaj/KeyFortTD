import { PlayerProfile, TowerType } from '../types';
import { TECH_TREE_DATA, TechNodeDefinition } from './ChallengeEngine';

export interface TechModifiers {
  kineticDamageMultiplier: number; // e.g., 1.0 or 1.06
  startingEnergyBonus: number; // e.g., 0 or 10
  controlDurationMultiplier: number; // e.g., 1.0 or 1.10
  startingLivesBonus: number; // e.g., 0 or 2
  heroXpMultiplier: number; // e.g., 1.0 or 1.20
  activeTechIds: string[];
}

const KINETIC_TOWERS = new Set<TowerType>(['gun', 'cannon', 'sniper', 'drone']);

export class TechnologySystem {
  public static getTechNode(techId: string): TechNodeDefinition | undefined {
    return TECH_TREE_DATA.find((n) => n.id === techId);
  }

  public static computeTechModifiers(
    unlockedTechs: string[] = [],
    options: { disabled?: boolean; disableDefenseInNoLeak?: boolean } = {}
  ): TechModifiers {
    if (options.disabled) {
      return {
        kineticDamageMultiplier: 1.0,
        startingEnergyBonus: 0,
        controlDurationMultiplier: 1.0,
        startingLivesBonus: 0,
        heroXpMultiplier: 1.0,
        activeTechIds: [],
      };
    }

    const validSet = new Set(unlockedTechs.filter((id) => Boolean(TechnologySystem.getTechNode(id))));
    const activeTechIds = Array.from(validSet);

    return {
      kineticDamageMultiplier: validSet.has('tech_kinetic_1') ? 1.06 : 1.0,
      startingEnergyBonus: validSet.has('tech_energy_1') ? 10 : 0,
      controlDurationMultiplier: validSet.has('tech_control_1') ? 1.1 : 1.0,
      startingLivesBonus:
        validSet.has('tech_defense_1') && !options.disableDefenseInNoLeak ? 2 : 0,
      heroXpMultiplier: validSet.has('tech_hero_1') ? 1.2 : 1.0,
      activeTechIds,
    };
  }

  public static isKineticTower(type: TowerType): boolean {
    return KINETIC_TOWERS.has(type);
  }

  public static purchaseTechnology(
    profile: PlayerProfile,
    techId: string
  ): { success: boolean; error?: string } {
    const node = TechnologySystem.getTechNode(techId);
    if (!node) {
      return { success: false, error: 'Unknown technology identifier' };
    }
    if (!profile.unlockedTechs) {
      profile.unlockedTechs = [];
    }
    if (profile.unlockedTechs.includes(techId)) {
      return { success: false, error: 'Technology already unlocked' };
    }
    const currentPoints = profile.techPoints ?? 0;
    if (currentPoints < node.cost) {
      return { success: false, error: 'Insufficient technology points' };
    }

    profile.techPoints = currentPoints - node.cost;
    profile.unlockedTechs.push(techId);
    return { success: true };
  }
}
