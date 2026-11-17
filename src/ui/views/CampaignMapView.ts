import { getMissionsByWorld, WORLDS_DATA } from '../../data/curriculumData';
import { TOWERS_DATA } from '../../data/towersData';
import { LocalizationService } from '../../i18n/LocalizationService';
import { ProgressionEngine } from '../../systems/ProgressionEngine';
import { PlayerProfile } from '../../types';
import { escapeHtml } from '../../utils/escapeHtml';

export class CampaignMapView {
  public static renderHtml(
    selectedWorldId: number,
    profile: PlayerProfile,
    i18n: LocalizationService
  ): string {
    const currentWorld = WORLDS_DATA.find((w) => w.id === selectedWorldId) ?? WORLDS_DATA[0];
    const worldMissions = getMissionsByWorld(currentWorld.id);

    const worldTabsHtml = WORLDS_DATA.map((w) => {
      const mList = getMissionsByWorld(w.id);
      const done = mList.filter((m) => profile.completedMissions[m.id]?.completed).length;
      const isSelected = w.id === currentWorld.id;
      return `
        <button
          class="world-tab ${isSelected ? 'active' : ''}"
          data-world-id="${w.id}"
          data-testid="world-tab-${w.id}"
          style="border-top: 3px solid ${w.primaryColor};"
        >
          <div class="world-tab-title">${w.id}. ${escapeHtml(i18n.pick(w.namePl, w.nameEn))}</div>
          <div class="world-tab-sub">${done}/6 ⭐</div>
        </button>
      `;
    }).join('');

    const missionsHtml = worldMissions
      .map((m) => {
        const unlocked = ProgressionEngine.isMissionUnlocked(m, profile);
        const rec = profile.completedMissions[m.id];
        const stars = rec?.stars ?? 0;
        const starsStr = '⭐'.repeat(stars) + '☆'.repeat(3 - stars);
        const newKeysChips =
          m.newKeys.length > 0
            ? m.newKeys
                .slice(0, 8)
                .map((k) => `<span class="key-chip">${escapeHtml(k === ' ' ? 'Spacja' : k)}</span>`)
                .join('') + (m.newKeys.length > 8 ? `<span class="key-chip">+${m.newKeys.length - 8}</span>` : '')
            : `<span style="font-size:0.76rem; color:#94a3b8;">${i18n.pick('Konsolidacja poznanych klawiszy', 'Key consolidation')}</span>`;

        return `
          <div class="mission-card ${unlocked ? 'unlocked' : 'locked'} ${m.isBossMission ? 'boss-mission' : ''}" data-testid="mission-card-${m.id}">
            <div>
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.25rem;">
                <span style="font-size:0.75rem; font-weight:800; color:${m.isBossMission ? '#fda4af' : '#38bdf8'};">
                  ${i18n.pick('ETAP', 'STAGE')} ${m.worldId}.${m.missionIndex} ${m.isBossMission ? '👑 BOSS' : ''}
                </span>
                <span style="font-size:0.86rem;">${starsStr}</span>
              </div>
              <h3 style="font-size:0.98rem; margin-bottom:0.15rem;">${escapeHtml(i18n.pick(m.namePl, m.nameEn))}</h3>
              <p style="font-size:0.77rem; color:#94a3b8; line-height:1.35; margin-bottom:0.45rem;">
                ${escapeHtml(i18n.pick(m.lessonIntroPl, m.lessonIntroEn))}
              </p>
              <div style="margin-bottom:0.35rem; display:flex; align-items:center; gap:0.25rem; flex-wrap:wrap;">
                <span style="font-size:0.73rem; color:#cbd5e1;">${i18n.t('mission.newKeys')}:</span>
                ${newKeysChips}
              </div>
              <div style="font-size:0.73rem; color:#94a3b8;">
                ⌨️ ${m.requiredTypedChars} zn. | 🎯 ${Math.round(m.targetAccuracy * 100)}% | 🌊 ${m.waves.length} ${i18n.pick('fale', 'waves')}
              </div>
            </div>

            <div style="display:flex; justify-content:space-between; align-items:center; margin-top:0.45rem; padding-top:0.4rem; border-top:1px solid rgba(148,163,184,0.12);">
              <span style="font-size:0.73rem; color:#4ade80;">
                ${rec?.completed ? `✓ ${Math.round(rec.bestAccuracy * 100)}% • ${rec.bestWpm} WPM` : ''}
              </span>
              <button
                class="primary-cta-btn"
                style="padding:0.4rem 0.9rem; font-size:0.82rem;"
                data-action="launch-mission"
                data-mission-id="${m.id}"
                data-testid="launch-mission-${m.id}"
                ${unlocked ? '' : 'disabled'}
              >
                ${unlocked ? `▶ ${i18n.t('mission.start')}` : `🔒 ${i18n.pick('Zablokowana', 'Locked')}`}
              </button>
            </div>
          </div>
        `;
      })
      .join('');

    return `
      <section data-testid="campaign-map-screen">
        <div class="worlds-tabs">${worldTabsHtml}</div>
        <div class="world-header-banner" style="border-left: 5px solid ${currentWorld.primaryColor}; padding:0.75rem 1.15rem; margin-bottom:0.75rem;">
          <div>
            <div style="display:flex; align-items:center; gap:0.75rem; flex-wrap:wrap;">
              <h2 style="font-size:1.22rem;">${currentWorld.id}. ${escapeHtml(i18n.pick(currentWorld.namePl, currentWorld.nameEn))}</h2>
              <span style="color:#38bdf8; font-weight:700; font-size:0.84rem;">
                🎯 ${escapeHtml(i18n.pick(currentWorld.focusPl, currentWorld.focusEn))}
              </span>
            </div>
            <p style="color:#94a3b8; font-size:0.81rem; margin-top:0.2rem; max-width:860px;">
              ${escapeHtml(i18n.pick(currentWorld.descriptionPl, currentWorld.descriptionEn))}
            </p>
          </div>
          <div style="text-align:right; font-size:0.82rem;">
            <div>👑 Boss: <strong style="color:#fda4af;">${escapeHtml(i18n.pick(currentWorld.bossNamePl, currentWorld.bossNameEn))}</strong></div>
            ${
              currentWorld.unlockedTower
                ? `<div style="margin-top:0.2rem; color:#facc15;">🏗️ ${i18n.pick('Odblokowuje wieżę:', 'Unlocks Tower:')} <strong>${escapeHtml(i18n.pick(TOWERS_DATA[currentWorld.unlockedTower].namePl, TOWERS_DATA[currentWorld.unlockedTower].nameEn))}</strong></div>`
                : ''
            }
          </div>
        </div>
        <div class="missions-grid">${missionsHtml}</div>
      </section>
    `;
  }
}
