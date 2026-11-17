import { ACHIEVEMENTS_DATA, COSMETICS_DATA } from '../../data/achievementsData';
import { MISSIONS_DATA, WORLDS_DATA } from '../../data/curriculumData';
import { POLISH_QWERTY_KEYS } from '../../data/keyboardData';
import { MAPS_DATA } from '../../data/mapsData';
import { LocalizationService } from '../../i18n/LocalizationService';
import { PersistenceService } from '../../services/PersistenceService';
import { MasteryEngine } from '../../systems/MasteryEngine';
import { ProgressionEngine } from '../../systems/ProgressionEngine';
import { StatisticsEngine } from '../../systems/StatisticsEngine';
import { PlayerProfile } from '../../types';
import { escapeHtml } from '../../utils/escapeHtml';
import { FamilyDashboardView } from './FamilyDashboardView';

export const AVATAR_OPTIONS = ['🛡️', '🦊', '🦄', '🐉', '🚀', '⚔️', '🦅', '⚡'];

export class DashboardViews {
  public static renderSurvivalSetupHtml(profile: PlayerProfile, i18n: LocalizationService): string {
    const mapEntries = Object.values(MAPS_DATA);

    return `
      <section class="sidebar-panel" style="max-width:860px; margin:0.75rem auto; padding:1.4rem;" data-testid="survival-setup-screen">
        <h2 style="font-size:1.45rem;">♾️ ${i18n.t('menu.survival')}</h2>
        <p style="color:#94a3b8; font-size:0.9rem;">${i18n.t('menu.survivalDesc')}</p>
        <div style="display:flex; gap:1.5rem; margin:0.65rem 0; background:#090d16; padding:0.9rem 1.1rem; border-radius:10px;">
          <div>🏆 ${i18n.pick('Najlepsza fala:', 'Personal Best Wave:')} <strong style="color:#4ade80; font-size:1.15rem;">${profile.survivalBestWave}</strong></div>
          <div>⭐ ${i18n.pick('Rekord punktów:', 'Best Score:')} <strong style="color:#facc15; font-size:1.15rem;">${profile.survivalBestScore}</strong></div>
        </div>

        <label style="font-size:0.86rem; font-weight:700;">${i18n.pick('Wybierz Mapę Operacyjną:', 'Select Operational Map:')}</label>
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(195px, 1fr)); gap:0.55rem; margin-top:0.35rem;">
          ${mapEntries
            .slice(0, 8)
            .map(
              (m, idx) => `
            <button class="primary-cta-btn" style="padding:0.6rem; font-size:0.83rem;" data-action="start-survival" data-mission-id="w${idx + 1}_m1" data-testid="start-survival-btn-${idx + 1}">
              ▶ ${escapeHtml(i18n.pick(m.namePl, m.nameEn))}
            </button>
          `
            )
            .join('')}
        </div>
      </section>
    `;
  }

  public static renderSandboxSetupHtml(i18n: LocalizationService): string {
    return `
      <section class="sidebar-panel" style="max-width:760px; margin:0.75rem auto; padding:1.4rem;" data-testid="sandbox-setup-screen">
        <h2 style="font-size:1.45rem;">🧪 ${i18n.t('menu.sandbox')}</h2>
        <p style="color:#94a3b8; font-size:0.9rem;">${i18n.t('menu.sandboxDesc')}</p>
        <div style="display:flex; flex-direction:column; gap:0.75rem; margin:0.85rem 0; background:#090d16; padding:1rem; border-radius:10px;">
          <label style="display:flex; align-items:center; gap:0.6rem; cursor:pointer;">
            <input type="checkbox" id="sandbox-opt-gold" checked />
            <span>🪙 ${i18n.pick('Nielimitowane Złoto (Unlimited Gold)', 'Unlimited Gold')}</span>
          </label>
          <label style="display:flex; align-items:center; gap:0.6rem; cursor:pointer;">
            <input type="checkbox" id="sandbox-opt-energy" checked />
            <span>⚡ ${i18n.pick('Nielimitowana Energia (Unlimited Energy)', 'Unlimited Energy')}</span>
          </label>
          <label style="display:flex; flex-direction:column; gap:0.35rem;">
            <span>${i18n.pick('Zakres klawiszy w konsoli:', 'Typing Console Key Scope:')}</span>
            <select id="sandbox-opt-mission" style="background:#1e293b; border:1px solid #38bdf8; padding:0.45rem; border-radius:6px;">
              ${WORLDS_DATA.map(
                (w) =>
                  `<option value="w${w.id}_m6">${w.id}. ${escapeHtml(i18n.pick(w.namePl, w.nameEn))} (${escapeHtml(i18n.pick(w.focusPl, w.focusEn))})</option>`
              ).join('')}
            </select>
          </label>
        </div>
        <button class="primary-cta-btn" data-action="launch-sandbox" data-testid="launch-sandbox-btn">
          🚀 ${i18n.pick('Uruchom Poligon Taktyczny', 'Launch Tactical Sandbox')}
        </button>
      </section>
    `;
  }

  public static renderStatisticsHtml(profile: PlayerProfile, i18n: LocalizationService): string {
    const overallAccRatio = StatisticsEngine.getOverallAccuracy(profile);
    const overallAccLabel =
      overallAccRatio !== null
        ? `${Math.round(overallAccRatio * 100)}%`
        : '—';
    const practiceTimeFormatted = FamilyDashboardView.formatDuration(profile.totalPracticeTimeSec, i18n);
    const bestQualifyingWpm = StatisticsEngine.getBestQualifyingWpm(profile);
    const bestWpmLabel =
      bestQualifyingWpm !== null
        ? `${bestQualifyingWpm} WPM`
        : profile.bestWpm > 0
        ? `${profile.bestWpm} WPM`
        : '0 WPM';
    const masteredList = MasteryEngine.getMasteredCharacters(profile.characterMastery);
    const allAllowed = MISSIONS_DATA[MISSIONS_DATA.length - 1].allowedKeys;
    const problematicList = MasteryEngine.getProblematicCharacters(profile.characterMastery, allAllowed);
    const completedMissionsCount = Object.values(profile.completedMissions).filter((m) => m.completed).length;

    const weakBigrams = Object.values(profile.bigramMastery)
      .filter((b) => b.attempts >= 2 && (b.correct / b.attempts < 0.9 || b.avgTransitionMs > 550))
      .sort((a, b) => a.correct / a.attempts - b.correct / b.attempts)
      .slice(0, 8);

    const heatmapRowsHtml = [0, 1, 2, 3]
      .map((rowIdx) => {
        const rowKeys = POLISH_QWERTY_KEYS.filter(
          (k) => k.row === rowIdx && k.baseChar.length === 1 && k.baseChar !== ' '
        );
        const rowInner = rowKeys
          .map((k) => {
            const stat = profile.characterMastery[k.baseChar];
            const status = stat?.status ?? 'locked';
            const score = stat?.masteryScore ?? 0;
            const statusIcon =
              status === 'mastered' ? '★' : status === 'practicing' ? '◐' : status === 'learning' ? '◔' : '·';
            return `
              <div class="heatmap-key ${escapeHtml(status)}" title="${k.baseChar.toUpperCase()}: ${escapeHtml(score)}% (${escapeHtml(status)})">
                <span>${k.baseChar.toUpperCase()}</span>
                <span style="font-size:0.62rem;">${statusIcon} ${escapeHtml(score)}%</span>
              </div>
            `;
          })
          .join('');
        return `<div style="display:flex; gap:0.2rem; justify-content:center; flex-wrap:nowrap;">${rowInner}</div>`;
      })
      .join('');

    const diacriticsHeatmapHtml = ['ą', 'ć', 'ę', 'ł', 'ń', 'ó', 'ś', 'ź', 'ż']
      .map((ch) => {
        const stat = profile.characterMastery[ch];
        const status = stat?.status ?? 'locked';
        const score = stat?.masteryScore ?? 0;
        return `
          <div class="heatmap-key ${escapeHtml(status)}" title="${ch}: ${escapeHtml(score)}% (${escapeHtml(status)})">
            <span>${ch}</span>
            <span style="font-size:0.62rem;">${escapeHtml(score)}%</span>
          </div>
        `;
      })
      .join('');

    const recentHistory = [...profile.sessionHistory].reverse().slice(0, 8);
    const parentSummaryText =
      profile.totalCharsTyped > 0
        ? i18n.pick(
            `Gracz ${escapeHtml(profile.name)} ukończył ${completedMissionsCount}/48 misji edukacyjnych, ćwiczył łącznie przez ${practiceTimeFormatted} i wpisał poprawnie ${profile.totalCorrectChars} znaków ze średnią celnością ${overallAccLabel}.`,
            `Player ${escapeHtml(profile.name)} has completed ${completedMissionsCount}/48 educational missions, practiced for ${practiceTimeFormatted}, and typed ${profile.totalCorrectChars} correct characters with ${overallAccLabel} accuracy.`
          )
        : i18n.pick(
            `Gracz ${escapeHtml(profile.name)} nie rozpoczął jeszcze ćwiczeń pisania (0 wpisanych znaków, czas ćwiczeń: 0 s).`,
            `Player ${escapeHtml(profile.name)} has not recorded any typing practice yet (0 characters typed, practice time: 0 s).`
          );

    return `
      <section style="display:flex; flex-direction:column; gap:0.85rem;" data-testid="statistics-screen">
        <div class="sidebar-panel">
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem;">
            <div>
              <h2 style="font-size:1.3rem;">📊 ${i18n.t('stats.title')} — ${escapeHtml(profile.avatarIcon)} ${escapeHtml(profile.name)}</h2>
              <p style="color:#94a3b8; font-size:0.85rem; margin-top:0.2rem;">
                <strong>👨‍👩‍👦 ${i18n.t('stats.parentOverview')}:</strong> ${parentSummaryText}
              </p>
            </div>
            <button class="nav-btn" data-nav="family_dashboard" data-testid="stats-open-family-btn" style="border-color:#facc15; color:#fef08a;">
              👨‍👩‍👧 ${i18n.pick('Ranking rodzinny', 'Family Dashboard')}
            </button>
          </div>
        </div>

        <div class="stats-grid">
          <div class="stat-kpi-card">
            <div style="font-size:0.78rem; color:#94a3b8;">${i18n.t('stats.overallAccuracy')}</div>
            <div class="stat-kpi-value" data-testid="stat-overall-accuracy">${overallAccLabel}</div>
          </div>
          <div class="stat-kpi-card">
            <div style="font-size:0.78rem; color:#94a3b8;">${i18n.t('stats.bestWpm')}</div>
            <div class="stat-kpi-value" style="color:#4ade80;" data-testid="stat-best-wpm">${bestWpmLabel}</div>
          </div>
          <div class="stat-kpi-card">
            <div style="font-size:0.78rem; color:#94a3b8;">${i18n.t('stats.practiceTime')}</div>
            <div class="stat-kpi-value" style="color:#facc15;" data-testid="stat-practice-time">${practiceTimeFormatted}</div>
          </div>
          <div class="stat-kpi-card">
            <div style="font-size:0.78rem; color:#94a3b8;">${i18n.t('stats.masteredKeys')}</div>
            <div class="stat-kpi-value" style="color:#c084fc;" data-testid="stat-mastered-keys">${masteredList.length}</div>
          </div>
        </div>

        <div class="sidebar-panel" data-testid="keyboard-heatmap-panel">
          <h3>⌨️ ${i18n.t('stats.heatmapTitle')}</h3>
          <div style="display:flex; flex-direction:column; gap:0.2rem; align-items:center;">${heatmapRowsHtml}</div>
          <div style="margin-top:0.4rem; font-size:0.78rem; color:#cbd5e1; text-align:center;">Polskie znaki diakrytyczne (AltGr):</div>
          <div style="display:flex; flex-wrap:wrap; gap:0.2rem; justify-content:center;">${diacriticsHeatmapHtml}</div>
        </div>

        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(320px, 1fr)); gap:0.85rem;">
          <div class="sidebar-panel">
            <h3>⚠️ ${i18n.t('stats.problematicKeys')} & ${i18n.pick('Dwuznaki (Bigrams)', 'Bigrams')}</h3>
            ${
              problematicList.length > 0
                ? `<div style="display:flex; flex-wrap:wrap; gap:0.3rem;">
                    ${problematicList
                      .slice(0, 10)
                      .map(
                        (s) =>
                          `<span class="key-chip" style="border-color:#facc15;">${escapeHtml(s.char)} (${Math.round((s.correct / s.attempts) * 100)}%, ${escapeHtml(s.avgReactionMs)}ms)</span>`
                      )
                      .join('')}
                  </div>`
                : `<p style="font-size:0.82rem; color:#94a3b8;">${i18n.pick('Brak problematycznych klawiszy — kontynuuj kampanię!', 'No problematic keys detected yet — keep advancing in the campaign!')}</p>`
            }
            ${
              weakBigrams.length > 0
                ? `<div style="margin-top:0.4rem; font-size:0.76rem; color:#94a3b8;">${i18n.pick('Dwuznaki do wzmocnienia:', 'Bigrams to reinforce:')}</div>
                   <div style="display:flex; flex-wrap:wrap; gap:0.3rem;">
                     ${weakBigrams
                       .map(
                         (b) =>
                           `<span class="key-chip" style="border-color:#c084fc;">${escapeHtml(b.bigram)} (${Math.round((b.correct / b.attempts) * 100)}%, ${escapeHtml(b.avgTransitionMs)}ms)</span>`
                       )
                       .join('')}
                   </div>`
                : ''
            }
          </div>

          <div class="sidebar-panel">
            <h3>🕒 ${i18n.t('stats.historyTitle')}</h3>
            ${
              recentHistory.length > 0
                ? `<div style="display:flex; flex-direction:column; gap:0.3rem; font-size:0.78rem;">
                    ${recentHistory
                      .map((h) => {
                        const statusBadge =
                          h.status === 'abandoned'
                            ? `⚠️ ${i18n.pick('Przerwana', 'Abandoned')}`
                            : h.status === 'defeat'
                            ? `💥 ${i18n.pick('Porażka', 'Defeat')}`
                            : `✓ ${i18n.pick('Ukończona', 'Completed')}`;
                        return `<div style="display:flex; justify-content:space-between; background:#090d16; padding:0.38rem 0.6rem; border-radius:6px;">
                            <span><strong>${escapeHtml(h.missionId)}</strong> (${escapeHtml(h.mode)} • ${statusBadge})</span>
                            <span>🎯 ${h.charsTyped + h.errors > 0 ? `${Math.round(h.accuracy * 100)}%` : "—"} | ⚡ ${escapeHtml(h.wpm)} WPM | 🔥 ${escapeHtml(h.maxCombo)}</span>
                          </div>`;
                      })
                      .join('')}
                  </div>`
                : `<p style="font-size:0.82rem; color:#94a3b8;">${i18n.pick('Brak zapisanych sesji.', 'No completed sessions yet.')}</p>`
            }
          </div>
        </div>
      </section>
    `;
  }

  public static renderAchievementsHtml(profile: PlayerProfile, i18n: LocalizationService): string {
    const unlockedSet = new Set(profile.achievements);

    return `
      <section style="display:flex; flex-direction:column; gap:0.85rem;" data-testid="achievements-screen">
        <div class="sidebar-panel">
          <h2 style="font-size:1.3rem;">🏆 ${i18n.t('menu.achievements')} (${profile.achievements.length}/${ACHIEVEMENTS_DATA.length})</h2>
          <div class="missions-grid" style="margin-top:0.4rem;">
            ${ACHIEVEMENTS_DATA.map((ach) => {
              const unlocked = unlockedSet.has(ach.id);
              return `
                <div class="mission-card ${unlocked ? 'unlocked' : 'locked'}" data-testid="achievement-${ach.id}">
                  <div style="display:flex; align-items:center; gap:0.75rem;">
                    <div style="font-size:1.9rem;">${ach.icon}</div>
                    <div>
                      <h3 style="font-size:0.95rem;">${escapeHtml(i18n.pick(ach.namePl.replace(/ \(.*\)$/, ''), ach.nameEn))}</h3>
                      <p style="font-size:0.78rem; color:#94a3b8; margin-top:0.15rem;">${escapeHtml(i18n.pick(ach.descPl, ach.descEn))}</p>
                      <span style="font-size:0.74rem; color:${unlocked ? '#4ade80' : '#facc15'};">
                        ${unlocked ? `✓ ${i18n.pick('Odblokowane', 'Unlocked')}` : `+${ach.xpReward} XP`}
                      </span>
                    </div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>

        <div class="sidebar-panel">
          <h3>🎨 ${i18n.pick('Nagrody Kosmetyczne (Skórki Wież i Lasery)', 'Cosmetic Rewards (Tower Skins & Lasers)')}</h3>
          <div style="display:flex; gap:0.6rem; flex-wrap:wrap;">
            ${COSMETICS_DATA.map((cos) => {
              const owned = profile.unlockedCosmetics.includes(cos.id);
              const equipped = profile.equippedCosmetics[cos.category] === cos.id;
              return `
                <button
                  class="nav-btn ${equipped ? 'active' : ''}"
                  data-equip-cosmetic="${cos.id}"
                  data-cosmetic-cat="${cos.category}"
                  ${owned ? '' : 'disabled'}
                  style="border-left:4px solid ${cos.previewColor};"
                >
                  ${owned ? (equipped ? '✓ ' : '') : '🔒 '}${escapeHtml(i18n.pick(cos.namePl, cos.nameEn))}
                </button>
              `;
            }).join('')}
          </div>
        </div>
      </section>
    `;
  }

  public static renderProfilesHtml(
    persistence: PersistenceService,
    importStatusMessage: string,
    i18n: LocalizationService
  ): string {
    const profiles = persistence.getAllProfiles();
    const active = persistence.getActiveProfile();

    const playerCardsHtml = profiles
      .map((p) => {
        const isCurrent = p.id === active.id;
        const completed = Object.values(p.completedMissions).filter((m) => m.completed).length;
        const totalStars = StatisticsEngine.getTotalStars(p);
        const xpReq = ProgressionEngine.getRequiredXpForLevel(p.level);
        const hasActivity = p.totalCharsTyped > 0 || completed > 0 || p.sessionHistory.length > 0;
        const lastActiveText = hasActivity
          ? FamilyDashboardView.formatLastActive(p.lastActiveAt, i18n)
          : i18n.pick('Nowy profil', 'New profile');

        return `
          <div class="console-player-card ${isCurrent ? 'active-player-card' : ''}" data-testid="profile-row-${escapeHtml(p.id)}">
            <div style="display:flex; align-items:center; gap:0.85rem;">
              <div class="console-avatar-circle">${escapeHtml(p.avatarIcon)}</div>
              <div style="flex:1; min-width:0;">
                <div style="display:flex; align-items:center; gap:0.4rem; flex-wrap:wrap;">
                  <strong style="font-size:1.1rem; color:#f8fafc;" data-testid="profile-card-name-${escapeHtml(p.id)}">${escapeHtml(p.name)}</strong>
                  ${isCurrent ? `<span class="mode-badge word">${i18n.pick('AKTYWNY', 'ACTIVE')}</span>` : ''}
                </div>
                <div style="font-size:0.78rem; color:#38bdf8; font-weight:700; margin-top:0.15rem;">
                  Poz./Lv ${p.level} (${p.xp}/${xpReq} XP) • ⭐ ${totalStars} • 🗺️ ${completed}/48
                </div>
                <div style="font-size:0.72rem; color:#94a3b8; margin-top:0.15rem;">
                  🕒 ${escapeHtml(lastActiveText)}
                </div>
              </div>
            </div>

            <div style="display:flex; gap:0.35rem; align-items:center; margin-top:0.5rem;">
              <input
                type="text"
                class="profile-rename-input"
                data-rename-input="${escapeHtml(p.id)}"
                data-testid="rename-input-${escapeHtml(p.id)}"
                value="${escapeHtml(p.name)}"
                placeholder="${i18n.pick('Przypisz imię gracza...', 'Assign player name...')}"
                style="background:#090d16; border:1px solid rgba(148,163,184,0.3); border-radius:6px; padding:0.26rem 0.5rem; font-size:0.76rem; flex:1;"
              />
              <button
                class="nav-btn"
                data-assign-profile="${escapeHtml(p.id)}"
                data-testid="assign-profile-${escapeHtml(p.id)}"
                title="${i18n.pick('Przypisz / Zmień imię tego profilu (zachowuje cały postęp)', 'Assign / Rename this profile (preserves all progress)')}"
              >
                ✏️ ${i18n.pick('Zapisz imię', 'Save Name')}
              </button>
            </div>

            <div style="display:flex; justify-content:space-between; align-items:center; gap:0.4rem; margin-top:0.45rem; padding-top:0.45rem; border-top:1px solid rgba(148,163,184,0.14);">
              <div style="display:flex; gap:0.3rem;">
                ${
                  !isCurrent
                    ? `<button class="nav-btn" data-switch-profile="${escapeHtml(p.id)}" data-testid="switch-profile-${escapeHtml(p.id)}">
                        🔄 ${i18n.pick('Przełącz', 'Switch')}
                      </button>`
                    : ''
                }
                <button
                  class="nav-btn"
                  style="border-color:#f43f5e; color:#fda4af;"
                  data-request-reset-profile="${escapeHtml(p.id)}"
                  data-testid="request-reset-${escapeHtml(p.id)}"
                >
                  🗑️ ${i18n.pick('Resetuj', 'Reset')}
                </button>
                ${
                  profiles.length > 1
                    ? `<button
                        class="nav-btn"
                        style="border-color:#f43f5e; color:#fda4af;"
                        data-request-delete-profile="${escapeHtml(p.id)}"
                        data-testid="request-delete-${escapeHtml(p.id)}"
                      >
                        ✕
                      </button>`
                    : ''
                }
              </div>

              <button
                class="primary-cta-btn"
                style="padding:0.4rem 0.95rem; font-size:0.82rem;"
                data-play-profile="${escapeHtml(p.id)}"
                data-testid="play-profile-${escapeHtml(p.id)}"
              >
                ▶ ${i18n.pick('Graj', 'Play')}
              </button>
            </div>
          </div>
        `;
      })
      .join('');

    const avatarSelectHtml = (id: string, defaultAvatar: string) => `
      <select id="${id}" style="background:#1e293b; border:1px solid #38bdf8; border-radius:6px; padding:0.38rem;">
        ${AVATAR_OPTIONS.map((av) => `<option value="${av}" ${av === defaultAvatar ? 'selected' : ''}>${av}</option>`).join('')}
      </select>
    `;

    return `
      <section style="display:flex; flex-direction:column; gap:1rem; max-width:1120px; margin:0.4rem auto;" data-testid="profiles-screen">
        <div class="sidebar-panel">
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem;">
            <div>
              <h2 style="font-size:1.35rem;">🎮 ${i18n.t('profile.title')}</h2>
              <p style="font-size:0.82rem; color:#94a3b8;">
                ${i18n.pick(
                  'Wybierz swój profil gracza, przypisz istniejący postęp lub skonfiguruj lokalne profile rodzinne.',
                  'Choose your player card, assign existing progress, or set up local family profiles.'
                )}
              </p>
            </div>
            <button class="nav-btn" data-nav="family_dashboard" data-testid="profiles-open-family-btn" style="border-color:#facc15; color:#fef08a;">
              👨‍👩‍👧 ${i18n.pick('Ranking rodzinny', 'Family Dashboard')}
            </button>
          </div>

          <div class="console-players-grid" data-testid="console-players-grid">
            ${playerCardsHtml}
          </div>
        </div>

        <!-- Quick Family Setup (3 Players in One Operation) -->
        <div class="sidebar-panel" data-testid="family-quick-setup-panel">
          <h3>👨‍👩‍👧 ${i18n.pick('Szybka Konfiguracja Rodziny (Utwórz 3 Profile Jednocześnie)', 'Quick Family Setup (Create 3 Profiles in One Operation)')}</h3>
          <p style="font-size:0.8rem; color:#94a3b8;">
            ${i18n.pick(
              'Wpisz imiona członków rodziny poniżej. Jeśli zaznaczysz opcję przypisania, obecny profil domyślny wraz z całym postępem zostanie przypisany do Gracza 1.',
              'Enter family player names below. When assignment is checked, the existing default profile and all its progress will be assigned to Player 1.'
            )}
          </p>
          <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(230px, 1fr)); gap:0.6rem;">
            <div style="display:flex; gap:0.35rem;">
              ${avatarSelectHtml('family-setup-avatar-1', '🦊')}
              <input type="text" id="family-setup-name-1" data-testid="family-setup-name-1" placeholder="${i18n.pick('Imię Gracza 1...', 'Player 1 name...')}" style="background:#090d16; border:1px solid #38bdf8; padding:0.42rem 0.65rem; border-radius:6px; flex:1;" />
            </div>
            <div style="display:flex; gap:0.35rem;">
              ${avatarSelectHtml('family-setup-avatar-2', '🦄')}
              <input type="text" id="family-setup-name-2" data-testid="family-setup-name-2" placeholder="${i18n.pick('Imię Gracza 2...', 'Player 2 name...')}" style="background:#090d16; border:1px solid #38bdf8; padding:0.42rem 0.65rem; border-radius:6px; flex:1;" />
            </div>
            <div style="display:flex; gap:0.35rem;">
              ${avatarSelectHtml('family-setup-avatar-3', '🐉')}
              <input type="text" id="family-setup-name-3" data-testid="family-setup-name-3" placeholder="${i18n.pick('Imię Gracza 3...', 'Player 3 name...')}" style="background:#090d16; border:1px solid #38bdf8; padding:0.42rem 0.65rem; border-radius:6px; flex:1;" />
            </div>
          </div>
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.6rem; margin-top:0.25rem;">
            <label style="display:flex; align-items:center; gap:0.45rem; font-size:0.8rem; cursor:pointer;">
              <input type="checkbox" id="family-setup-assign-existing" data-testid="family-setup-assign-existing" checked />
              <span>${i18n.pick('Przypisz istniejący postęp aktywnego profilu do Gracza 1', 'Assign existing active profile progress to Player 1')}</span>
            </label>
            <button class="primary-cta-btn" style="padding:0.45rem 1.1rem; font-size:0.84rem;" data-action="family-batch-setup" data-testid="family-setup-submit-btn">
              👨‍👩‍👧 ${i18n.pick('Utwórz Profile Rodzinne', 'Create Family Profiles')}
            </button>
          </div>
        </div>

        <!-- Single New Profile + Backup Export/Import -->
        <div class="sidebar-panel">
          <h3>➕ ${i18n.t('profile.create')}</h3>
          <div style="display:flex; gap:0.5rem; align-items:center; flex-wrap:wrap;">
            ${avatarSelectHtml('new-profile-avatar-select', '🚀')}
            <input
              type="text"
              id="new-profile-name-input"
              data-testid="new-profile-name-input"
              placeholder="${i18n.pick('Imię nowego gracza...', 'New player name...')}"
              style="background:#090d16; border:1px solid #38bdf8; padding:0.45rem 0.75rem; border-radius:6px; flex:1;"
            />
            <button class="primary-cta-btn" style="padding:0.45rem 1rem; font-size:0.85rem;" data-action="create-profile" data-testid="create-profile-btn">
              ➕ ${i18n.t('profile.create')}
            </button>
          </div>

          <div style="margin-top:0.85rem; border-top:1px solid rgba(148,163,184,0.2); padding-top:0.85rem; display:flex; flex-direction:column; gap:0.55rem;">
            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem;">
              <h3>💾 ${i18n.t('profile.export')} / ${i18n.t('profile.import')}</h3>
              <button class="nav-btn" data-action="download-save-json" data-testid="download-save-json-btn" style="border-color:#4ade80; color:#bbf7d0;">
                ⬇️ ${i18n.pick('Pobierz plik kopii zapasowej (.json)', 'Download Backup File (.json)')}
              </button>
            </div>
            <textarea
              id="save-json-textarea"
              data-testid="save-json-textarea"
              rows="5"
              style="width:100%; background:#050811; border:1px solid rgba(148,163,184,0.3); border-radius:8px; padding:0.6rem; font-family:monospace; font-size:0.75rem;"
            >${escapeHtml(persistence.exportSaveJson())}</textarea>
            <div style="display:flex; gap:0.6rem; flex-wrap:wrap;">
              <button class="nav-btn" data-action="import-save-json" data-testid="import-save-btn">
                📥 ${i18n.t('profile.import')}
              </button>
              <button class="nav-btn" style="border-color:#f43f5e; color:#fda4af;" data-action="reset-profile" data-testid="reset-profile-btn">
                🗑️ ${i18n.t('profile.reset')}
              </button>
            </div>
            ${importStatusMessage ? `<div data-testid="import-status-msg" style="color:#4ade80; font-size:0.82rem;">${escapeHtml(importStatusMessage)}</div>` : ''}
          </div>
        </div>
      </section>
    `;
  }

  public static renderSettingsHtml(profile: PlayerProfile, i18n: LocalizationService): string {
    const s = profile.settings;

    return `
      <section class="sidebar-panel" style="max-width:740px; margin:0.5rem auto; padding:1.4rem;" data-testid="settings-screen">
        <h2 style="font-size:1.35rem;">⚙️ ${i18n.t('settings.title')} — ${escapeHtml(profile.avatarIcon)} ${escapeHtml(profile.name)}</h2>
        <div style="display:flex; flex-direction:column; gap:0.85rem; margin-top:0.4rem;">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <label>${i18n.t('settings.language')}</label>
            <select id="setting-language" data-testid="setting-language" style="background:#1e293b; border:1px solid #38bdf8; padding:0.4rem; border-radius:6px;">
              <option value="pl" ${s.language === 'pl' ? 'selected' : ''}>Polski (Domyślny)</option>
              <option value="en" ${s.language === 'en' ? 'selected' : ''}>English</option>
            </select>
          </div>

          <div style="display:flex; justify-content:space-between; align-items:center;">
            <label>${i18n.t('settings.difficulty')}</label>
            <select id="setting-difficulty" data-testid="setting-difficulty" style="background:#1e293b; border:1px solid #38bdf8; padding:0.4rem; border-radius:6px;">
              <option value="relaxed" ${s.difficulty === 'relaxed' ? 'selected' : ''}>Relaksacyjny (Relaxed - bez presji)</option>
              <option value="standard" ${s.difficulty === 'standard' ? 'selected' : ''}>Standardowy (Standard)</option>
              <option value="tactical" ${s.difficulty === 'tactical' ? 'selected' : ''}>Taktyczny (Tactical)</option>
            </select>
          </div>

          <div style="display:flex; justify-content:space-between; align-items:center;">
            <label>${i18n.t('settings.typingAssistance')}</label>
            <select id="setting-assistance" data-testid="setting-assistance" style="background:#1e293b; border:1px solid #38bdf8; padding:0.4rem; border-radius:6px;">
              <option value="full" ${s.typingAssistance === 'full' ? 'selected' : ''}>Pełne podpowiedzi (Full)</option>
              <option value="adaptive" ${s.typingAssistance === 'adaptive' ? 'selected' : ''}>Adaptacyjne (Adaptive)</option>
              <option value="minimal" ${s.typingAssistance === 'minimal' ? 'selected' : ''}>Minimalne (Minimal)</option>
            </select>
          </div>

          <div style="display:flex; justify-content:space-between; align-items:center;">
            <label>${i18n.t('settings.textSize')}</label>
            <select id="setting-textsize" data-testid="setting-textsize" style="background:#1e293b; border:1px solid #38bdf8; padding:0.4rem; border-radius:6px;">
              <option value="normal" ${s.textSize === 'normal' ? 'selected' : ''}>Standardowy (Normal)</option>
              <option value="large" ${s.textSize === 'large' ? 'selected' : ''}>Duży (Large)</option>
              <option value="xlarge" ${s.textSize === 'xlarge' ? 'selected' : ''}>Bardzo Duży (Extra Large)</option>
            </select>
          </div>

          <div style="display:flex; justify-content:space-between; align-items:center;">
            <label>${i18n.t('settings.sfxVolume')} (${Math.round(s.sfxVolume * 100)}%)</label>
            <input type="range" id="setting-sfx" min="0" max="1" step="0.05" value="${s.sfxVolume}" />
          </div>

          <div style="display:flex; justify-content:space-between; align-items:center;">
            <label>${i18n.t('settings.reducedMotion')}</label>
            <input type="checkbox" id="setting-reduced-motion" data-testid="setting-reduced-motion" ${s.reducedMotion ? 'checked' : ''} />
          </div>
        </div>
      </section>
    `;
  }
}
