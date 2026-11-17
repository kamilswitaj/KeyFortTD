import { ACHIEVEMENTS_DATA } from '../../data/achievementsData';
import { MISSIONS_DATA } from '../../data/curriculumData';
import { LocalizationService } from '../../i18n/LocalizationService';
import { MasteryEngine } from '../../systems/MasteryEngine';
import { PlayerProfile } from '../../types';
import { escapeHtml } from '../../utils/escapeHtml';

export class MainMenuView {
  public static renderHtml(
    profile: PlayerProfile,
    allProfiles: PlayerProfile[],
    i18n: LocalizationService
  ): string {
    const completedCount = Object.values(profile.completedMissions).filter((m) => m.completed).length;
    const nextMission =
      MISSIONS_DATA.find((m) => !profile.completedMissions[m.id]?.completed) ?? MISSIONS_DATA[0];
    const masteredCount = MasteryEngine.getMasteredCharacters(profile.characterMastery).length;
    const allProfilesCount = allProfiles.length;

    const profilesCountText =
      i18n.getLanguage() === 'en'
        ? `${allProfilesCount} ${allProfilesCount === 1 ? 'profile' : 'profiles'}`
        : `${allProfilesCount} ${allProfilesCount === 1 ? 'profil' : allProfilesCount >= 2 && allProfilesCount <= 4 ? 'profile' : 'profili'}`;

    const quickProfilePillsHtml = allProfiles
      .map((p) => {
        const isCurrent = p.id === profile.id;
        return `
          <button
            class="nav-btn ${isCurrent ? 'active' : ''}"
            data-switch-profile="${escapeHtml(p.id)}"
            data-testid="menu-quick-switch-${escapeHtml(p.id)}"
            title="${escapeHtml(i18n.pick('Przełącz gracza:', 'Switch player:'))} ${escapeHtml(p.name)}"
          >
            ${escapeHtml(p.avatarIcon)} ${escapeHtml(p.name)}
          </button>
        `;
      })
      .join('');

    return `
      <section class="menu-screen" data-testid="main-menu-screen">
        <div class="hero-banner">
          <div class="hero-text">
            <div class="hero-kicker">⚔️ TAKTYCZNA OBRONA TWIERDZY • TOUCH-TYPING</div>
            <h1>${i18n.t('app.title')} — ${i18n.t('app.tagline')}</h1>
            <p>${i18n.t('app.subtitle')}</p>
            <div class="hero-cta-group">
              <button class="primary-cta-btn" data-action="quick-start-campaign" data-mission-id="${nextMission.id}" data-testid="quick-start-campaign-btn">
                ▶ ${i18n.pick('Kontynuuj Misję', 'Continue Mission')} ${nextMission.worldId}.${nextMission.missionIndex}: ${escapeHtml(i18n.pick(nextMission.namePl, nextMission.nameEn))}
              </button>
              <button class="nav-btn" data-nav="campaign_map" data-testid="open-campaign-map-btn" style="padding:0.68rem 1.15rem; font-size:0.9rem;">
                🗺️ ${i18n.t('menu.campaign')} (${completedCount}/48)
              </button>
              <button class="nav-btn" data-nav="family_dashboard" data-testid="open-family-dashboard-btn" style="padding:0.68rem 1.15rem; font-size:0.9rem; border-color:#facc15; color:#fef08a;">
                👨‍👩‍👧 ${i18n.pick('Ranking rodzinny', 'Family Dashboard')}
              </button>
            </div>
            <div style="display:flex; align-items:center; gap:0.4rem; margin-top:0.75rem; flex-wrap:wrap;" data-testid="menu-quick-player-bar">
              <span style="font-size:0.76rem; color:#94a3b8;">👥 ${i18n.pick('Aktywny gracz:', 'Active player:')}</span>
              ${quickProfilePillsHtml}
              <button class="nav-btn" data-nav="profiles" data-testid="menu-manage-profiles-btn">
                ⚙️ ${i18n.pick('Wybór Gracza', 'Select Player')}
              </button>
            </div>
          </div>

          <div class="hero-art-card">
            <svg viewBox="0 0 260 130" class="hero-fortress-svg" aria-hidden="true">
              <defs>
                <linearGradient id="fortGlow" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stop-color="#38bdf8" stop-opacity="0.35" />
                  <stop offset="100%" stop-color="#a855f7" stop-opacity="0.15" />
                </linearGradient>
              </defs>
              <rect x="8" y="8" width="244" height="114" rx="12" fill="url(#fortGlow)" stroke="#38bdf8" stroke-opacity="0.4" />
              <path d="M 18 92 Q 70 92 95 62 T 175 62 T 242 42" fill="none" stroke="#334155" stroke-width="14" stroke-linecap="round" />
              <path d="M 18 92 Q 70 92 95 62 T 175 62 T 242 42" fill="none" stroke="#4ade80" stroke-width="2" stroke-dasharray="5 6" />
              <circle cx="62" cy="54" r="13" fill="#0f172a" stroke="#38bdf8" stroke-width="2.5" />
              <line x1="62" y1="54" x2="82" y2="66" stroke="#bae6fd" stroke-width="3.5" />
              <circle cx="138" cy="86" r="14" fill="#0f172a" stroke="#a855f7" stroke-width="2.5" />
              <polyline points="138,86 122,64 106,70" fill="none" stroke="#e9d5ff" stroke-width="2.5" />
              <circle cx="222" cy="44" r="18" fill="#0f172a" stroke="#38bdf8" stroke-width="3" />
              <circle cx="222" cy="44" r="8" fill="#38bdf8" />
              <polygon points="104,70 94,65 97,70 94,75" fill="#fbbf24" />
              <rect x="148" y="52" width="16" height="16" rx="3" fill="#ef4444" stroke="#fef08a" stroke-width="1.5" />
            </svg>
            <div class="hero-stats-strip">
              <span>${escapeHtml(profile.avatarIcon)} <strong>${escapeHtml(profile.name)}</strong></span>
              <span style="color:#38bdf8;">★ ${completedCount}/48</span>
              <span style="color:#4ade80;">⌨️ ${masteredCount}</span>
              <span style="color:#facc15;">🔥 ${profile.bestCombo}</span>
            </div>
          </div>
        </div>

        <div class="menu-cards-grid">
          <div class="menu-card" data-nav="campaign_map" data-testid="card-campaign" style="border-top: 3px solid #38bdf8;">
            <div>
              <h3>🗺️ ${i18n.t('menu.campaign')}</h3>
              <p style="margin-top:0.35rem;">${i18n.t('menu.campaignDesc')}</p>
            </div>
            <span style="color:#38bdf8; font-weight:700; font-size:0.84rem;">→ 8 ${i18n.pick('Światów • 48 Misji • 8 Bossów', 'Worlds • 48 Missions • 8 Bosses')}</span>
          </div>

          <div class="menu-card" data-nav="survival_setup" data-testid="card-survival" style="border-top: 3px solid #22c55e;">
            <div>
              <h3>♾️ ${i18n.t('menu.survival')}</h3>
              <p style="margin-top:0.35rem;">${i18n.t('menu.survivalDesc')}</p>
            </div>
            <span style="color:#4ade80; font-weight:700; font-size:0.84rem;">
              🏆 ${i18n.pick('Rekord fali:', 'Best wave:')} ${profile.survivalBestWave}
            </span>
          </div>

          <div class="menu-card" data-nav="sandbox_setup" data-testid="card-sandbox" style="border-top: 3px solid #facc15;">
            <div>
              <h3>🧪 ${i18n.t('menu.sandbox')}</h3>
              <p style="margin-top:0.35rem;">${i18n.t('menu.sandboxDesc')}</p>
            </div>
            <span style="color:#facc15; font-weight:700; font-size:0.84rem;">→ ${i18n.pick('Wszystkie 6 wież i ulepszenia T3', 'All 6 towers & Tier 3 upgrades')}</span>
          </div>

          <div class="menu-card" data-nav="family_dashboard" data-testid="card-family-dashboard" style="border-top: 3px solid #f43f5e;">
            <div>
              <h3>👨‍👩‍👧 ${i18n.pick('Ranking rodzinny', 'Family Dashboard')}</h3>
              <p style="margin-top:0.35rem;">${i18n.pick('Porównaj postępy graczy, wykresy WPM i celności oraz rekordy poszczególnych misji.', 'Compare family players, WPM/accuracy charts, and fair mission leaderboards.')}</p>
            </div>
            <span style="color:#fda4af; font-weight:700; font-size:0.84rem;">→ ${i18n.pick('Tabele, wykresy i rekordy misji', 'Tables, charts & mission records')}</span>
          </div>

          <div class="menu-card" data-nav="statistics" data-testid="card-statistics" style="border-top: 3px solid #a855f7;">
            <div>
              <h3>📊 ${i18n.t('menu.statistics')}</h3>
              <p style="margin-top:0.35rem;">${i18n.pick('Interaktywna mapa opanowania klawiatury, statystyki szybkości (WPM) i celności.', 'Interactive keyboard mastery heatmap, WPM speed trends, and accuracy analytics.')}</p>
            </div>
            <span style="color:#c084fc; font-weight:700; font-size:0.84rem;">→ ${i18n.pick('Mapa cieplna klawiszy', 'Keyboard Mastery Heatmap')}</span>
          </div>

          <div class="menu-card" data-nav="profiles" data-testid="card-profiles" style="border-top: 3px solid #06b6d4;">
            <div>
              <h3>👥 ${i18n.t('menu.profiles')}</h3>
              <p style="margin-top:0.35rem;">${i18n.pick('Konsolowy wybór gracza, szybka konfiguracja rodziny oraz kopie zapasowe JSON.', 'Console-style player select, quick family setup, and JSON backups.')}</p>
            </div>
            <span style="color:#38bdf8; font-weight:700; font-size:0.84rem;">→ ${profilesCountText}</span>
          </div>
        </div>
      </section>
    `;
  }
}
