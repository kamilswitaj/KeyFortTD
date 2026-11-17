export type PowerState = 'baseline' | 'powered' | 'overcharged';

export class ResourceEconomy {
  private gold: number;
  private energy: number;
  private baseMaxEnergy: number = 100;
  private bonusMaxEnergy: number = 0;
  private unlimitedGold: boolean = false;
  private unlimitedEnergy: boolean = false;
  private overdriveTimerSec: number = 0;

  constructor(startingGold: number = 250, startingEnergy: number = 45) {
    this.gold = startingGold;
    this.energy = startingEnergy;
  }

  public getGold(): number {
    return this.unlimitedGold ? 99999 : Math.floor(this.gold);
  }

  public addGold(amount: number): void {
    if (amount <= 0) return;
    this.gold += amount;
  }

  public spendGold(amount: number): boolean {
    if (this.unlimitedGold) return true;
    if (this.gold < amount) return false;
    this.gold -= amount;
    return true;
  }

  public getEnergy(): number {
    return this.unlimitedEnergy ? this.getMaxEnergy() : Number(this.energy.toFixed(1));
  }

  public getMaxEnergy(): number {
    return this.baseMaxEnergy + this.bonusMaxEnergy;
  }

  public setBonusMaxEnergy(bonus: number): void {
    this.bonusMaxEnergy = Math.max(0, bonus);
    if (this.energy > this.getMaxEnergy()) {
      this.energy = this.getMaxEnergy();
    }
  }

  public addEnergy(amount: number): void {
    if (amount <= 0) return;
    this.energy = Math.min(this.getMaxEnergy(), this.energy + amount);
  }

  public consumeEnergy(amount: number): boolean {
    if (this.unlimitedEnergy) return true;
    if (amount <= 0) return true;
    if (this.energy >= amount) {
      this.energy = Math.max(0, this.energy - amount);
      return true;
    }
    this.energy = 0;
    return false;
  }

  public setUnlimitedResources(gold: boolean, energy: boolean): void {
    this.unlimitedGold = gold;
    this.unlimitedEnergy = energy;
    if (energy) {
      this.energy = this.getMaxEnergy();
    }
  }

  public isUnlimitedGold(): boolean {
    return this.unlimitedGold;
  }

  public isUnlimitedEnergy(): boolean {
    return this.unlimitedEnergy;
  }

  public activateOverdrive(durationSec: number = 8): void {
    this.overdriveTimerSec = Math.max(this.overdriveTimerSec, durationSec);
  }

  public update(dtSec: number, passiveEnergyPerSec: number = 0): void {
    if (this.overdriveTimerSec > 0) {
      this.overdriveTimerSec = Math.max(0, this.overdriveTimerSec - dtSec);
    }
    if (passiveEnergyPerSec > 0) {
      this.addEnergy(passiveEnergyPerSec * dtSec);
    }
  }

  public getPowerState(currentCombo: number = 0): PowerState {
    if (this.unlimitedEnergy || this.overdriveTimerSec > 0) {
      return 'overcharged';
    }
    const ratio = this.energy / this.getMaxEnergy();
    if (ratio >= 0.72 || (this.energy >= 20 && currentCombo >= 20)) {
      return 'overcharged';
    }
    if (this.energy > 0.5) {
      return 'powered';
    }
    return 'baseline';
  }

  /**
   * Towers retain 55% baseline efficiency even when energy is 0 so beginners are never
   * soft-locked, reach 100% when powered, and surge to 140% when overcharged!
   */
  public getEfficiencyMultiplier(currentCombo: number = 0): number {
    const state = this.getPowerState(currentCombo);
    if (state === 'overcharged') return 1.4;
    if (state === 'powered') return 1.0;
    return 0.55;
  }
}
