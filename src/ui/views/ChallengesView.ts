import { SvgArtwork } from '../../assets/SvgArtwork';
import { HERO_ORDER, HEROES_DATA } from '../../data/heroesData';
import { LocalizationService } from '../../i18n/LocalizationService';
import {
  CHALLENGE_RULESET_VERSION,
  ChallengeEngine,
  ChallengeTier,
  TECH_TREE_DATA,
} from '../../systems/ChallengeEngine';
import { PlayerProfile } from '../../types';
import { escapeHtml } from '../../utils/escapeHtml';

export class ChallengesView {
  public static renderHtml(
    profile: PlayerProfile,
    allProfiles: PlayerProfile[],
    selectedTier: ChallengeTier | null,
    i18n: LocalizationService
  ): string {
    const selectableTiers = ChallengeEngine.getSelectableTiersForPlayer(profile);
    const activeTier: ChallengeTier =
      selectedTier && selectableTiers.includes(selectedTier)
        ? selectedTier
        : selectableTiers[selectableTiers.length - 1] ?? 'home_anchors';

    const daily = ChallengeEngine.getDailyChallenge(activeTier);
    const weekly = ChallengeEngine.getWeeklyChallenge(activeTier);
    const completedMap = profile.completedChallenges ?? {};
    const unlockedTechs = profile.unlockedTechs ?? [];
    const techPoints = profile.techPoints ?? 0;
    const unlockedHeroes = profile.unlockedHeroes ?? [];

    const tierLabels: Record<ChallengeTier, { pl: string; en: string }> = {
      home_anchors: { pl: 'Startowy (F i J)', en: 'Starter (F & J)' },
      beginner: { pl: 'Początkujący (Św. 1-2)', en: 'Beginner (W1-2)' },
      intermediate: { pl: 'Średni (Św. 1-5)', en: 'Intermediate (W1-5)' },
      full: { pl: 'Zaawansowany (Pełny)', en: 'Advanced (Full)' },
    };

    const tierSelectorHtml = selectableTiers
      .map(
        (t) => `
      <button
        class="nav-btn ${t === activeTier ? 'active' : ''}"
        data-challenge-tier="${t}"
        data-testid="challenge-tier-${t}"
      >
        ${escapeHtml(i18n.pick(tierLabels[t].pl, tierLabels[t].en))}
      </button>`
      )
      .join('');

    const renderChallengeCard = (ch: typeof daily) => {
      const done = completedMap[ch.id];
      const board = ChallengeEngine.getChallengeLeaderboard(allProfiles, ch.id, CHALLENGE_RULESET_VERSION).slice(0, 5);
      const boardHtml =
        board.length > 0
          ? `<div style="margin-top:0.55rem; background:#090d16; padding:0.45rem 0.6rem; border-radius:6px; font-size:0.74rem;" data-testid="challenge-leaderboard-${ch.frequency}">
              <div style="color:#94a3b8; font-weight:700; margin-bottom:0.25rem;">🏆 ${i18n.pick('Ranking Rodzinny Wyzwania:', 'Family Challenge Leaderboard:')}</div>
              ${board
                .map(
                  (e, idx) => `<div style="display:flex; justify-content:space-between; padding:0.12rem 0;">
                    <span>#${idx + 1} ${escapeHtml(e.avatarIcon)} <strong>${escapeHtml(e.playerName)}</strong></span>
                    <span style="color:#facc15;">${e.score} pkt • ${Math.round(e.accuracy * 100)}% • ${e.wpm} WPM</span>
                  </div>`
                )
                .join('')}
            </div>`
          : '';

      return `
        <div class="mode-card" style="border-color:${done ? '#22c55e' : '#38bdf8'};" data-testid="challenge-card-${ch.frequency}">
          <div>
            <div style="display:flex; justify-content:space-between; align-items:center; gap:0.4rem; flex-wrap:wrap;">
              <span class="key-obj-pill" style="background:rgba(56,189,248,0.16); color:#38bdf8;">
                ${ch.frequency === 'daily' ? i18n.pick('📅 Wyzwanie Dnia', '📅 Daily Challenge') : i18n.pick('🗓️ Wyzwanie Tygodnia', '🗓️ Weekly Challenge')} (${ch.dateKey} UTC)
              </span>
              <span class="key-obj-pill">${escapeHtml(i18n.pick(tierLabels[ch.tier].pl, tierLabels[ch.tier].en))}</span>
            </div>
            <h3 style="margin-top:0.4rem;">${escapeHtml(i18n.pick(ch.titlePl, ch.titleEn))}</h3>
            <p style="font-size:0.82rem; color:#cbd5e1; margin-top:0.2rem;">${escapeHtml(i18n.pick(ch.descPl, ch.descEn))}</p>
            <div style="display:flex; gap:0.5rem; flex-wrap:wrap; font-size:0.75rem; color:#94a3b8; margin-top:0.35rem;">
              <span>🎯 ${i18n.pick('Min. celność:', 'Min accuracy:')} ${Math.round(ch.targetAccuracy * 100)}%</span>
              <span>⌨️ ${ch.minTypedChars} ${i18n.pick('zn.', 'chars')}</span>
              <span>⚡ +${ch.techPointReward} ${i18n.pick('Pkt Tech (1. raz)', 'Tech Pt (1st clear)')}</span>
            </div>
            ${
              done
                ? `<div style="color:#4ade80; font-size:0.8rem; font-weight:700; margin-top:0.4rem;">✓ ${i18n.pick('Twój rekord:', 'Your Best:')} ${done.score} pkt (${Math.round(done.accuracy * 100)}%)</div>`
                : ''
            }
            ${boardHtml}
          </div>
          <button
            class="primary-cta-btn"
            style="margin-top:0.65rem; padding:0.48rem 0.9rem; font-size:0.82rem;"
            data-start-challenge="${ch.frequency}"
            data-challenge-tier="${ch.tier}"
            data-testid="start-challenge-${ch.frequency}"
          >
            ▶ ${done ? i18n.pick('Popraw rekord wyzwania', 'Replay Challenge') : i18n.pick('Rozpocznij wyzwanie', 'Launch Challenge')}
          </button>
        </div>
      `;
    };

    const heroesHtml = HERO_ORDER.map((hId) => {
      const hero = HEROES_DATA[hId];
      const isUnlocked = unlockedHeroes.includes(hId);
      const isSelected = profile.selectedHeroId === hId;
      const persistentXp = profile.heroXp?.[hId] ?? 0;
      return `
        <div class="mode-card" style="border-color:${isSelected ? hero.color : 'rgba(148,163,184,0.2)'}; opacity:${isUnlocked ? 1 : 0.72};" data-testid="hero-card-${hId}">
          <div>
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
                ? `<div style="font-size:0.7rem; color:#facc15; margin-top:0.25rem;">★ ${i18n.pick('Doświadczenie bohatera:', 'Hero Mastery XP:')} ${persistentXp}</div>`
                : ''
            }
          </div>
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
          <div>
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <strong>${escapeHtml(i18n.pick(node.namePl, node.nameEn))}</strong>
              <span class="key-obj-pill">${owned ? '✓' : `${node.cost} Tech`}</span>
            </div>
            <p style="font-size:0.78rem; color:#94a3b8; margin-top:0.25rem;">${escapeHtml(i18n.pick(node.descPl, node.descEn))}</p>
          </div>
          ${
            owned
              ? `<div style="color:#4ade80; font-size:0.76rem; font-weight:700; margin-top:0.4rem;">✓ ${i18n.pick('Aktywna specjalizacja', 'Unlocked')}</div>`
              : `<button class="nav-btn" style="margin-top:0.45rem;" data-unlock-tech="${node.id}" data-testid="unlock-tech-${node.id}" ${canBuy ? '' : 'disabled'}>
                  🔬 ${i18n.pick(`Odblokuj (${node.cost} Pkt Tech)`, `Unlock (${node.cost} Tech Pt)`)}
                </button>`
          }
        </div>
      `;
    }).join('');

    return `
      <section style="display:flex; flex-direction:column; gap:1rem;" data-testid="challenges-screen">
        <div class="sidebar-panel">
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem;">
            <div>
              <h2 style="font-size:1.3rem;">⚔️ ${i18n.pick('Wyzwania, Bohaterowie i Technologia', 'Challenges, Heroes & Tech')}</h2>
              <p style="font-size:0.82rem; color:#94a3b8;">
                ${i18n.pick(
                  'Wyzwania dzienne i tygodniowe używają identycznych, sprawiedliwych reguł (bez bonusów technologii i bohaterów), dzięki czemu dorośli i dzieci mogą rywalizować na równych zasadach.',
                  'Daily & weekly challenges use standardized fair rules (no hero/tech bonuses) so parents and children can compete on equal footing.'
                )}
              </p>
            </div>
            <div style="display:flex; gap:0.3rem; flex-wrap:wrap;" data-testid="challenge-tier-selector">
              ${tierSelectorHtml}
            </div>
          </div>
        </div>

        <div class="mode-grid" style="grid-template-columns:repeat(auto-fit, minmax(320px, 1fr));">
          ${renderChallengeCard(daily)}
          ${renderChallengeCard(weekly)}
        </div>

        <div class="sidebar-panel">
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem;">
            <h3 style="font-size:1.05rem; border:none; padding:0;">🦸 ${i18n.pick('Bohaterowie Bastionu KeyFort', 'KeyFort Heroes')}</h3>
            <button class="nav-btn" data-action="clear-hero" data-testid="clear-hero" ${profile.selectedHeroId ? '' : 'disabled'}>
              ${i18n.pick('Graj bez bohatera', 'Play without a hero')}
            </button>
          </div>
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
