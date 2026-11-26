import { ActiveTower } from '../types';
import { TowerSystem } from './TowerSystem';

export interface ActiveSynergyBadge {
  id: 'shatter_blast' | 'overvolted_grid' | 'thermal_shock' | 'marked_precision' | 'squadron_link';
  namePl: string;
  nameEn: string;
  descPl: string;
  descEn: string;
  partnerTowerIds: string[];
  color: string;
}

export class SynergySystem {
  public static getActiveSynergiesForTower(
    tower: ActiveTower,
    allTowers: ActiveTower[]
  ): ActiveSynergyBadge[] {
    const badges: ActiveSynergyBadge[] = [];
    const stats = TowerSystem.computeEffectiveStats(tower, allTowers);

    const findNearby = (targetType: ActiveTower['type'], maxDist = 210): ActiveTower[] =>
      allTowers.filter((other) => {
        if (other.id === tower.id || other.type !== targetType) return false;
        const otherStats = TowerSystem.computeEffectiveStats(other, allTowers);
        const dist = Math.hypot(other.x - tower.x, other.y - tower.y);
        return dist <= Math.max(maxDist, otherStats.range, stats.range);
      });

    if (tower.type === 'cannon' || tower.type === 'frost') {
      const partnerType = tower.type === 'cannon' ? 'frost' : 'cannon';
      const partners = findNearby(partnerType, 220);
      if (partners.length > 0) {
        badges.push({
          id: 'shatter_blast',
          namePl: 'Roztrzaskanie Mrozem',
          nameEn: 'Shatter Blast',
          descPl: 'Działo zadaje +25% obr. spowolnionym celom',
          descEn: 'Cannon deals +25% damage to slowed enemies',
          partnerTowerIds: partners.map((p) => p.id),
          color: '#67e8f9',
        });
      }
    }

    if (tower.type === 'tesla' || tower.type === 'reactor') {
      const partnerType = tower.type === 'tesla' ? 'reactor' : 'tesla';
      const partners = findNearby(partnerType, 185);
      if (partners.length > 0) {
        badges.push({
          id: 'overvolted_grid',
          namePl: 'Sieć Przeciążenia',
          nameEn: 'Overvolted Grid',
          descPl: 'Tesla zyskuje +1 cel łańcucha i +18% oszczędności energii',
          descEn: 'Tesla gains +1 chain target & +18% energy efficiency',
          partnerTowerIds: partners.map((p) => p.id),
          color: '#c084fc',
        });
      }
    }

    if (tower.type === 'flame' || tower.type === 'frost') {
      const partnerType = tower.type === 'flame' ? 'frost' : 'flame';
      const partners = findNearby(partnerType, 200);
      if (partners.length > 0) {
        badges.push({
          id: 'thermal_shock',
          namePl: 'Szok Termiczny',
          nameEn: 'Thermal Shock',
          descPl: 'Ogień + Mróz wywołuje wybuch 35 obr. (odnowienie 2.5s)',
          descEn: 'Flame + Frost triggers 35 burst damage (2.5s ICD)',
          partnerTowerIds: partners.map((p) => p.id),
          color: '#fb923c',
        });
      }
    }

    if (tower.type === 'sniper' || tower.type === 'command') {
      const partnerType = tower.type === 'sniper' ? 'command' : 'sniper';
      const partners = findNearby(partnerType, 210);
      if (partners.length > 0) {
        badges.push({
          id: 'marked_precision',
          namePl: 'Oznaczona Precyzja',
          nameEn: 'Marked Precision',
          descPl: 'Snajper zadaje +20% obr. celom w zasięgu Dowodzenia',
          descEn: 'Sniper deals +20% bonus damage in Command aura',
          partnerTowerIds: partners.map((p) => p.id),
          color: '#818cf8',
        });
      }
    }

    if (tower.type === 'drone' || tower.type === 'command') {
      const partnerType = tower.type === 'drone' ? 'command' : 'drone';
      const partners = findNearby(partnerType, 210);
      if (partners.length > 0) {
        badges.push({
          id: 'squadron_link',
          namePl: 'Łącze Eskadry',
          nameEn: 'Squadron Link',
          descPl: 'Drony atakują o +18% szybciej dzięki Dowodzeniu',
          descEn: 'Drones fire +18% faster via Command uplink',
          partnerTowerIds: partners.map((p) => p.id),
          color: '#2dd4bf',
        });
      }
    }

    return badges;
  }
}
