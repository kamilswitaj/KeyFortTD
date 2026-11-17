import { ACHIEVEMENTS_DATA, COSMETICS_DATA } from '../../data/achievementsData';
import { MISSIONS_DATA, WORLDS_DATA } from '../../data/curriculumData';
import { POLISH_QWERTY_KEYS } from '../../data/keyboardData';
import { MAPS_DATA } from '../../data/mapsData';
import { LocalizationService } from '../../i18n/LocalizationService';
import { PersistenceService } from '../../services/PersistenceService';
import { MasteryEngine } from '../../systems/MasteryEngine';
import { PlayerProfile } from '../../types';
import { escapeHtml } from '../../utils/escapeHtml';

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
    const overallAcc =
      profile.totalCharsTyped > 0
        ? Math.round((profile.totalCorrectChars / profile.totalCharsTyped) * 100)
        : 100;
    const practiceMinutes = Math.max(1, Math.round(profile.totalPracticeTimeSec / 60));
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

    return `
      <section style="display:flex; flex-direction:column; gap:0.85rem;" data-testid="statistics-screen">
        <div class="sidebar-panel">
          <h2 style="font-size:1.3rem;">📊 ${i18n.t('stats.title')}</h2>
          <p style="color:#94a3b8; font-size:0.85rem;">
            <strong>👨‍👩‍👦 ${i18n.t('stats.parentOverview')}:</strong>
            ${i18n.pick(
              `Gracz ${escapeHtml(profile.name)} ukończył ${completedMissionsCount}/48 misji edukacyjnych, ćwiczył łącznie przez ok. ${practiceMinutes} min i wpisał poprawnie ${profile.totalCorrectChars} znaków ze średnią celnością ${overallAcc}%.`,
              `Player ${escapeHtml(profile.name)} has completed ${completedMissionsCount}/48 educational missions, practiced for ${practiceMinutes} min, and typed ${profile.totalCorrectChars} correct characters with ${overallAcc}% accuracy.`
            )}
          </p>
        </div>

        <div class="stats-grid">
          <div class="stat-kpi-card">
            <div style="font-size:0.78rem; color:#94a3b8;">${i18n.t('stats.overallAccuracy')}</div>
            <div class="stat-kpi-value" data-testid="stat-overall-accuracy">${overallAcc}%</div>
          </div>
          <div class="stat-kpi-card">
            <div style="font-size:0.78rem; color:#94a3b8;">${i18n.t('stats.bestWpm')}</div>
            <div class="stat-kpi-value" style="color:#4ade80;">${profile.bestWpm} WPM</div>
          </div>
          <div class="stat-kpi-card">
            <div style="font-size:0.78rem; color:#94a3b8;">${i18n.t('stats.practiceTime')}</div>
            <div class="stat-kpi-value" style="color:#facc15;">${practiceMinutes} min</div>
          </div>
          <div class="stat-kpi-card">
            <div style="font-size:0.78rem; color:#94a3b8;">${i18n.t('stats.masteredKeys')}</div>
            <div class="stat-kpi-value" style="color:#c084fc;">${masteredList.length}</div>
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
                      .map(
                        (h) =>
                          `<div style="display:flex; justify-content:space-between; background:#090d16; padding:0.38rem 0.6rem; border-radius:6px;">
                            <span><strong>${escapeHtml(h.missionId)}</strong> (${escapeHtml(h.mode)})</span>
                            <span>🎯 ${Math.round(h.accuracy * 100)}% | ⚡ ${escapeHtml(h.wpm)} WPM | 🔥 ${escapeHtml(h.maxCombo)}</span>
                          </div>`
                      )
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

    return `
      <section class="sidebar-panel" style="max-width:820px; margin:0.5rem auto; padding:1.4rem;" data-testid="profiles-screen">
        <h2 style="font-size:1.35rem;">👥 ${i18n.t('profile.title')}</h2>
        <div style="display:flex; flex-direction:column; gap:0.55rem; margin:0.65rem 0;">
          ${profiles
            .map((p) => {
              const isCurrent = p.id === active.id;
              const completed = Object.values(p.completedMissions).filter((m) => m.completed).length;
              return `
                <div style="display:flex; justify-content:space-between; align-items:center; background:#090d16; border:1px solid ${isCurrent ? '#38bdf8' : 'rgba(148,163,184,0.2)'}; padding:0.7rem 1rem; border-radius:10px;" data-testid="profile-row-${escapeHtml(p.id)}">
                  <div>
                    <strong style="font-size:1.02rem;">${escapeHtml(p.avatarIcon)} ${escapeHtml(p.name)}</strong>
                    ${isCurrent ? `<span style="color:#4ade80; font-size:0.76rem; margin-left:0.5rem;">(${i18n.pick('Aktywny', 'Active')})</span>` : ''}
                    <div style="font-size:0.76rem; color:#94a3b8;">
                      Poz./Lv ${p.level} | Misje: ${completed}/48
                    </div>
                  </div>
                  <div style="display:flex; gap:0.4rem;">
                    ${
                      !isCurrent
                        ? `<button class="primary-cta-btn" style="padding:0.35rem 0.85rem; font-size:0.8rem;" data-switch-profile="${escapeHtml(p.id)}" data-testid="switch-profile-${escapeHtml(p.id)}">
                            ${i18n.pick('Przełącz', 'Switch')}
                          </button>`
                        : ''
                    }
                  </div>
                </div>
              `;
            })
            .join('')}
        </div>

        <div style="display:flex; gap:0.5rem; align-items:center; flex-wrap:wrap; background:#090d16; padding:0.8rem; border-radius:10px;">
          <input
            type="text"
            id="new-profile-name-input"
            data-testid="new-profile-name-input"
            placeholder="${i18n.pick('Imię nowego gracza...', 'New player name...')}"
            style="background:#1e293b; border:1px solid #38bdf8; padding:0.45rem 0.75rem; border-radius:6px; flex:1;"
          />
          <button class="primary-cta-btn" style="padding:0.45rem 1rem; font-size:0.85rem;" data-action="create-profile" data-testid="create-profile-btn">
            ➕ ${i18n.t('profile.create')}
          </button>
        </div>

        <div style="margin-top:0.85rem; border-top:1px solid rgba(148,163,184,0.2); padding-top:0.85rem; display:flex; flex-direction:column; gap:0.55rem;">
          <h3>💾 ${i18n.t('profile.export')} / ${i18n.t('profile.import')}</h3>
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
      </section>
    `;
  }

  public static renderSettingsHtml(profile: PlayerProfile, i18n: LocalizationService): string {
    const s = profile.settings;

    return `
      <section class="sidebar-panel" style="max-width:740px; margin:0.5rem auto; padding:1.4rem;" data-testid="settings-screen">
        <h2 style="font-size:1.35rem;">⚙️ ${i18n.t('settings.title')}</h2>
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
