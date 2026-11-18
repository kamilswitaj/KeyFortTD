import { SvgArtwork } from '../../assets/SvgArtwork';
import { HERO_ORDER, HEROES_DATA } from '../../data/heroesData';
import { LocalizationService } from '../../i18n/LocalizationService';
import { ChallengeEngine, TECH_TREE_DATA } from '../../systems/ChallengeEngine';
import { PlayerProfile } from '../../types';
import { escapeHtml } from '../../utils/escapeHtml';

export class ChallengesView {
  public static renderHtml(profile: PlayerProfile, i18n: LocalizationService): string {
    const tier = ChallengeEngine.getPlayerEligibleTier(profile);
    const daily = ChallengeEngine.getDailyChallenge(tier);
    const weekly = ChallengeEngine.getWeeklyChallenge(tier);
    const completedMap = profile.completedChallenges ?? {};
    const unlockedTechs = profile.unlockedTechs ?? [];
    const techPoints = profile.techPoints ?? 0;
    const unlockedHeroes = profile.unlockedHeroes ?? [];

    const tierLabels: Record<typeof tier, { pl: string; en: string }> = {
      beginner: { pl: 'Początkujący', en: 'Beginner' },
      intermediate: { pl: 'Średni', en: 'Intermediate' },
      full: { pl: 'Zaawansowany', en: 'Full Keyboard' },
    };

    const renderChallengeCard = (ch: typeof daily) => {
      const done = completedMap[ch.id];
      return `
        <div class="mode-card" style="border-color:${done ? '#22c55e' : '#38bdf8'};" data-testid="challenge-card-${ch.frequency}">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <span class="key-obj-pill" style="background:rgba(56,189,248,0.16); color:#38bdf8;">
              ${ch.frequency === 'daily' ? i18n.pick('📅 Wyzwanie Dnia', '📅 Daily Challenge') : i18n.pick('🗓️ Wyzwanie Tygodnia', '🗓️ Weekly Challenge')} (${ch.dateKey})
            </span>
            <span class="key-obj-pill">${i18n.pick('Poziom:', 'Tier:')} ${escapeHtml(i18n.pick(tierLabels[ch.tier].pl, tierLabels[ch.tier].en))}</span>
          </div>
          <h3 style="margin-top:0.4rem;">${escapeHtml(i18n.pick(ch.titlePl, ch.titleEn))}</h3>
          <p style="font-size:0.82rem; color:#cbd5e1;">${escapeHtml(i18n.pick(ch.descPl, ch.descEn))}</p>
          <div style="display:flex; gap:0.5rem; flex-wrap:wrap; font-size:0.75rem; color:#94a3b8; margin-top:0.3rem;">
            <span>🎯 ${i18n.pick('Min. celność:', 'Min accuracy:')} ${Math.round(ch.targetAccuracy * 100)}%</span>
            <span>⚡ +${ch.techPointReward} ${i18n.pick('Pkt Tech', 'Tech Pt')}</span>
          </div>
          ${
            done
              ? `<div style="color:#4ade80; font-size:0.8rem; font-weight:700; margin-top:0.4rem;">✓ ${i18n.pick('Ukończono:', 'Completed:')} ${done.score} pkt (${Math.round(done.accuracy * 100)}%)</div>`
              : ''
          }
          <button class="primary-cta-btn" style="margin-top:0.65rem; padding:0.45rem 0.9rem; font-size:0.8rem;" data-start-challenge="${ch.id}" data-challenge-mission="${ch.missionId}" data-testid="start-challenge-${ch.frequency}" disabled>
            ▶ ${i18n.pick('Podgląd — tryb w przygotowaniu', 'Preview — mode not yet available')}
          </button>
        </div>
      `;
    };

    const heroesHtml = HERO_ORDER.map((hId) => {
      const hero = HEROES_DATA[hId];
      const isUnlocked = unlockedHeroes.includes(hId);
      const isSelected = profile.selectedHeroId === hId;
      return `
        <div class="mode-card" style="border-color:${isSelected ? hero.color : 'rgba(148,163,184,0.2)'}; opacity:${isUnlocked ? 1 : 0.72};" data-testid="hero-card-${hId}">
          <div style="display:flex; align-items:center; gap:0.65rem;">
            ${SvgArtwork.heroPortrait(hId, 44)}
            <div>
              <strong style="color:${hero.color};">${escapeHtml(i18n.pick(hero.namePl, hero.nameEn))}</strong>
              <div style="font-size:0.74rem; color:#94a3b8;">${escapeHtml(i18n.pick(hero.titlePl, hero.titleEn))}</div>
            </div>
          </div>
          <p style="font-size:0.78rem; color:#cbd5e1; margin-top:0.35rem;">${escapeHtml(i18n.pick(hero.descPl, hero.descEn))}</p>
          <div style="font-size:0.72rem; color:#38bdf8; margin-top:0.25rem;">✦ ${escapeHtml(i18n.pick(hero.passivePl, hero.passiveEn))}</div>
          ${
            isUnlocked
              ? `<button class="nav-btn ${isSelected ? 'active' : ''}" style="margin-top:0.55rem;" data-select-hero="${hId}" data-testid="select-hero-${hId}">
                  ${isSelected ? `✓ ${i18n.pick('Wybrany Bohater', 'Active Hero')}` : i18n.pick('Wybierz Bohatera', 'Select Hero')}
                </button>`
              : `<div style="font-size:0.74rem; color:#94a3b8; margin-top:0.5rem;">🔒 ${i18n.pick(`Odblokujesz w Świecie ${hero.unlockWorld}`, `Unlocks in World ${hero.unlockWorld}`)}</div>`
          }
        </div>
      `;
    }).join('');

    const techHtml = TECH_TREE_DATA.map((node) => {
      const owned = unlockedTechs.includes(node.id);
      const canBuy = !owned && techPoints >= node.cost;
      return `
        <div class="mode-card" style="border-color:${owned ? '#22c55e' : 'rgba(148,163,184,0.2)'};" data-testid="tech-node-${node.id}">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <strong>${escapeHtml(i18n.pick(node.namePl, node.nameEn))}</strong>
            <span class="key-obj-pill">${owned ? '✓' : `${node.cost} Tech`}</span>
          </div>
          <p style="font-size:0.78rem; color:#94a3b8; margin-top:0.25rem;">${escapeHtml(i18n.pick(node.descPl, node.descEn))}</p>
          ${
            owned
              ? `<div style="color:#4ade80; font-size:0.76rem; font-weight:700; margin-top:0.4rem;">✓ ${i18n.pick('Aktywna specjalizacja', 'Unlocked')}</div>`
              : `<button class="nav-btn" style="margin-top:0.45rem;" data-unlock-tech="${node.id}" data-testid="unlock-tech-${node.id}" disabled>
                  🔬 ${i18n.pick('W przygotowaniu', 'Coming later')}
                </button>`
          }
        </div>
      `;
    }).join('');

    return `
      <section style="display:flex; flex-direction:column; gap:1rem;" data-testid="challenges-screen">
        <div class="sidebar-panel">
          <h2 style="font-size:1.3rem;">⚔️ ${i18n.pick('Wyzwania, Bohaterowie i Technologia', 'Challenges, Heroes & Tech')}</h2>
          <p style="font-size:0.82rem; color:#94a3b8;">
            ${i18n.pick(
              'Deterministyczne wyzwania dzienne i tygodniowe dostosowane do Twojego etapu nauki (zero kar za pominięte dni), wybór Bohatera oraz specjalizacje technologiczne.',
              'Deterministic daily & weekly challenges tailored to your curriculum tier, Hero selection, and Tech specializations.'
            )}
          </p>
        </div>

        <div class="mode-grid" style="grid-template-columns:repeat(auto-fit, minmax(320px, 1fr));">
          ${renderChallengeCard(daily)}
          ${renderChallengeCard(weekly)}
        </div>

        <div class="sidebar-panel">
          <h3 style="font-size:1.05rem;">🦸 ${i18n.pick('Bohaterowie Bastionu KeyFort', 'KeyFort Heroes')}</h3>
          <button class="nav-btn" data-action="clear-hero" data-testid="clear-hero" ${profile.selectedHeroId ? '' : 'disabled'}>${i18n.pick('Graj bez bohatera', 'Play without a hero')}</button>
          <div class="mode-grid">${heroesHtml}</div>
        </div>

        <div class="sidebar-panel">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <h3 style="font-size:1.05rem; border:none; padding:0;">🔬 ${i18n.pick('Drzewo Specjalizacji Technologicznych', 'Technology Specializations')}</h3>
            <span class="key-obj-pill" style="border-color:#facc15; color:#facc15;">
              ⚙️ ${i18n.pick('Punkty Tech:', 'Tech Points:')} <strong data-testid="tech-points-value">${techPoints}</strong>
            </span>
          </div>
          <div class="mode-grid">${techHtml}</div>
        </div>
      </section>
    `;
  }
}
