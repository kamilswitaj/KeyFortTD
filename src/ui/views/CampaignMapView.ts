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

    const worldMapNodesSvg = WORLDS_DATA.map((w, idx) => {
      const mList = getMissionsByWorld(w.id);
      const done = mList.filter((m) => profile.completedMissions[m.id]?.completed).length;
      const isSelected = w.id === currentWorld.id;
      const cx = 65 + idx * 124;
      const cy = idx % 2 === 0 ? 44 : 74;
      const nextCx = idx < 7 ? 65 + (idx + 1) * 124 : cx;
      const nextCy = (idx + 1) % 2 === 0 ? 44 : 74;
      return `
        ${
          idx < 7
            ? `<line x1="${cx}" y1="${cy}" x2="${nextCx}" y2="${nextCy}" stroke="${done === 6 ? '#22c55e' : 'rgba(148,163,184,0.35)'}" stroke-width="3" stroke-dasharray="${done === 6 ? 'none' : '5 5'}" />`
            : ''
        }
        <g style="cursor:pointer;" data-world-id="${w.id}" data-testid="world-map-node-${w.id}">
          <circle cx="${cx}" cy="${cy}" r="${isSelected ? 21 : 16}" fill="${isSelected ? '#0f172a' : '#1e293b'}" stroke="${w.primaryColor}" stroke-width="${isSelected ? 3.5 : 2}" />
          <text x="${cx}" y="${cy + 4}" fill="#f8fafc" font-size="12" font-weight="800" text-anchor="middle">${w.id}</text>
          <text x="${cx}" y="${cy + 30}" fill="${isSelected ? '#38bdf8' : '#cbd5e1'}" font-size="8.8" font-weight="700" text-anchor="middle">${escapeHtml(i18n.pick(w.namePl, w.nameEn))}</text>
          <text x="${cx}" y="${cy + 41}" fill="#94a3b8" font-size="8" text-anchor="middle">${done}/6 ★</text>
        </g>
      `;
    }).join('');

    const WORLD_STORY: Record<number, { pl: string; en: string }> = {
      1: {
        pl: 'Skażone portale otworzyły się w Zielonej Dolinie. Odtwórz rytm rzędu bazowego (F/J) i zasil pierwsze wieże.',
        en: 'Corrupted portals opened in Green Valley. Restore the home-row rhythm (F/J) to power the first bastions.',
      },
      2: {
        pl: 'Cienie Mrocznego Lasu tłumią sygnały. Opanuj górny rząd klawiszy i odblokuj Mroźne oraz Płomienne wieże.',
        en: 'Dark Forest shadows jam our signals. Master the top row and unlock Frost & Flame towers.',
      },
      3: {
        pl: 'Przełęcz Górska wymaga koordynacji obu dłoni. Hangar Dronów i Wieża Tesli powstrzymają szybkie oddziały.',
        en: 'Mountain Pass demands two-hand coordination. Drone Hangars and Tesla Coils counter swift raiders.',
      },
      4: {
        pl: 'Na Pustynnej Placówce wrogowie używają tarcz i wsparcia. Dowodzenie i polskie znaki wzmocnią obronę.',
        en: 'Desert Outpost foes deploy shields and medics. Command Towers and diacritics sharpen your defense.',
      },
      5: {
        pl: 'Lodowe Wyspy strzegą starożytnych kryształów energii. Skupiona Wieża Laserowa przebije najgrubszy pancerz.',
        en: 'Frozen Islands guard crystal conduits. The Laser Tower pierces the heaviest armor.',
      },
      6: {
        pl: 'W Starożytnych Ruinach budzą się Widma. Użyj Shift i pełnych słów, by rozświetlić pole bitwy.',
        en: 'Ghosts awaken inside Ancient Ruins. Use Shift and full words to illuminate the battlefield.',
      },
      7: {
        pl: 'Przemysłowe Miasto zalewają zmechanizowane fale. Cyfry i interpunkcja zasilą pełną sieć obronną.',
        en: 'Mechanized waves surge through Industrial City. Numbers and punctuation power the full grid.',
      },
      8: {
        pl: 'Finałowa Twierdza KeyFort — połącz strategię wież, bohatera i mistrzostwo klawiatury przeciw Imperatorowi Omega!',
        en: 'Final Fortress — unite tower synergies, your Hero, and keyboard mastery against Emperor Omega!',
      },
    };

    return `
      <section data-testid="campaign-map-screen">
        <div class="sidebar-panel" style="padding:0.5rem 0.75rem; margin-bottom:0.65rem; background:linear-gradient(180deg, rgba(15,23,42,0.95), rgba(7,11,20,0.95));" data-testid="interactive-world-map">
          <svg viewBox="0 0 1000 118" style="width:100%; height:auto; display:block;" aria-label="${escapeHtml(i18n.pick('Mapa Światów KeyFort', 'KeyFort World Map'))}">
            ${worldMapNodesSvg}
          </svg>
        </div>
        <div class="worlds-tabs">${worldTabsHtml}</div>
        <div class="world-header-banner" style="border-left: 5px solid ${currentWorld.primaryColor}; padding:0.75rem 1.15rem; margin-bottom:0.75rem;">
          <div>
            <div style="display:flex; align-items:center; gap:0.75rem; flex-wrap:wrap;">
              <h2 style="font-size:1.22rem;">${currentWorld.id}. ${escapeHtml(i18n.pick(currentWorld.namePl, currentWorld.nameEn))}</h2>
              <span style="color:#38bdf8; font-weight:700; font-size:0.84rem;">
                🎯 ${escapeHtml(i18n.pick(currentWorld.focusPl, currentWorld.focusEn))}
              </span>
            </div>
            <p style="color:#cbd5e1; font-size:0.81rem; margin-top:0.2rem; max-width:860px;">
              📜 ${escapeHtml(i18n.pick(WORLD_STORY[currentWorld.id]?.pl ?? currentWorld.descriptionPl, WORLD_STORY[currentWorld.id]?.en ?? currentWorld.descriptionEn))}
            </p>
          </div>
          <div style="text-align:right; font-size:0.82rem; flex-shrink:0;">
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
