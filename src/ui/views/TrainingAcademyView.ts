import { SvgArtwork } from '../../assets/SvgArtwork';
import { LocalizationService } from '../../i18n/LocalizationService';
import {
  TRAINING_ACTIVITIES,
  STANDARDIZED_RULES_VERSION,
  TrainingAcademyEngine,
  TrainingActivityKind,
} from '../../systems/TrainingAcademyEngine';
import { PlayerProfile } from '../../types';
import { escapeHtml } from '../../utils/escapeHtml';
import { VirtualKeyboardView } from '../VirtualKeyboardView';

export interface TrainingViewState {
  tab: 'drills' | 'standardized';
  selectedActivity: TrainingActivityKind;
  stdDuration: 30 | 60 | 120 | 0;
  stdPool: 'beginner' | 'full';
  activeEngine: TrainingAcademyEngine | null;
  lastResult: {
    wpm: number;
    accuracy: number;
    correct: number;
    errors: number;
    consistency: number | null;
    qualified: boolean;
  } | null;
}

export class TrainingAcademyView {
  public static renderHtml(
    profile: PlayerProfile,
    allProfiles: PlayerProfile[],
    state: TrainingViewState,
    i18n: LocalizationService
  ): string {
    if (state.activeEngine && !state.activeEngine.completed) {
      return TrainingAcademyView.renderActiveSessionHtml(profile, state, i18n);
    }

    const resultBannerHtml = state.lastResult
      ? `<div class="sidebar-panel" style="border-color:#22c55e; background:rgba(22,163,74,0.12);" data-testid="training-result-banner">
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem;">
            <strong style="color:#4ade80;">✓ ${state.lastResult.qualified ? i18n.pick('Wynik zakwalifikowany do rankingu', 'Qualifying test result') : i18n.pick('Zapisano ćwiczenie (bez rekordu testu)', 'Practice saved (no test record)')}</strong>
            <div style="display:flex; gap:1rem; font-size:0.85rem;">
              <span>⚡ <strong>${state.lastResult.wpm} WPM</strong></span>
              <span>🎯 <strong>${state.lastResult.correct + state.lastResult.errors > 0 ? `${Math.round(state.lastResult.accuracy * 100)}%` : '—'}</strong></span>
              <span>⌨️ <strong>${state.lastResult.correct}</strong> ${i18n.pick('znaków', 'chars')}</span>
              <span>📈 ${i18n.pick('Spójność:', 'Consistency:')} <strong>${state.lastResult.consistency !== null ? `${state.lastResult.consistency}%` : '—'}</strong></span>
            </div>
          </div>
        </div>`
      : '';

    const activitiesHtml = TRAINING_ACTIVITIES.map((act) => {
      const isSelected = state.selectedActivity === act.id;
      const aheadBadgeHtml = act.isAheadOfCurriculum
        ? `<div style="margin-top:0.3rem; font-size:0.72rem; color:#fbbf24;">✦ ${i18n.pick(
            'Dobrowolny trening z wyprzedzeniem (nie odblokowuje klawiszy kampanii)',
            'Voluntary ahead-of-curriculum drill (does not unlock campaign keys)'
          )}</div>`
        : '';
      return `
        <div class="mode-card" style="border-color:${isSelected ? '#38bdf8' : 'rgba(148,163,184,0.2)'}; cursor:pointer;" data-select-activity="${act.id}" data-testid="training-card-${act.id}">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <strong style="font-size:0.95rem;">${act.icon} ${escapeHtml(i18n.pick(act.namePl, act.nameEn))}</strong>
            <span class="key-obj-pill">${escapeHtml(i18n.pick(act.themePl, act.themeEn))}</span>
          </div>
          <p style="font-size:0.8rem; color:#94a3b8; margin-top:0.3rem;">${escapeHtml(i18n.pick(act.descPl, act.descEn))}</p>
          ${aheadBadgeHtml}
          <button class="primary-cta-btn" style="margin-top:0.6rem; padding:0.4rem 0.8rem; font-size:0.78rem;" data-start-training="${act.id}" data-testid="start-training-${act.id}">
            ▶ ${i18n.pick('Rozpocznij ćwiczenie', 'Start Drill')}
          </button>
        </div>
      `;
    }).join('');

    const stdRecords = allProfiles
      .flatMap((p) =>
        (p.standardizedTestRecords ?? [])
          .filter(
            (r) =>
              r.rulesVersion === STANDARDIZED_RULES_VERSION && state.stdDuration > 0 &&
              r.durationSec === state.stdDuration &&
              r.pool === state.stdPool &&
              r.language === profile.settings.language
          )
          .map((r) => ({ profile: p, record: r }))
      )
      .sort((a, b) => b.record.wpm - a.record.wpm || b.record.accuracy - a.record.accuracy)
      .slice(0, 8);

    const stdRowsHtml =
      stdRecords.length > 0
        ? stdRecords
            .map(
              (item, idx) => `
          <tr>
            <td>#${idx + 1}</td>
            <td>${escapeHtml(item.profile.avatarIcon)} <strong>${escapeHtml(item.profile.name)}</strong></td>
            <td style="color:#38bdf8; font-weight:800;">${item.record.wpm} WPM</td>
            <td>🎯 ${Math.round(item.record.accuracy * 100)}%</td>
            <td>${item.record.consistency !== null ? `${item.record.consistency}%` : '—'}</td>
            <td style="color:#94a3b8;">${new Date(item.record.timestamp).toLocaleDateString()}</td>
          </tr>`
            )
            .join('')
        : `<tr><td colspan="6" style="text-align:center; color:#94a3b8; padding:0.75rem;">${i18n.pick('Brak wyników dla tej konfiguracji testu.', 'No standardized test records for this preset yet.')}</td></tr>`;

    return `
      <section style="display:flex; flex-direction:column; gap:0.9rem;" data-testid="training-academy-screen">
        <div class="sidebar-panel" style="flex-direction:row; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.6rem;">
          <div>
            <h2 style="font-size:1.3rem;">🎓 ${i18n.pick('Akademia Pisania', 'Training Academy')}</h2>
            <p style="font-size:0.82rem; color:#94a3b8;">
              ${i18n.pick(
                'Krótkie treningi bez bitwy oraz standaryzowane testy porównawcze dla całej rodziny. Trening rozwija opanowanie klawiszy bez automatycznego zaliczania kampanii.',
                'Focused drills without combat plus fair standardized typing tests for the whole family.'
              )}
            </p>
          </div>
          <div style="display:flex; gap:0.4rem;">
            <button class="nav-btn ${state.tab === 'drills' ? 'active' : ''}" data-academy-tab="drills" data-testid="academy-tab-drills">
              ⚡ ${i18n.pick('Ćwiczenia i Mini-gry', 'Drills & Calibration')}
            </button>
            <button class="nav-btn ${state.tab === 'standardized' ? 'active' : ''}" data-academy-tab="standardized" data-testid="academy-tab-standardized">
              ⏱️ ${i18n.pick('Testy Standaryzowane', 'Standardized Tests')}
            </button>
          </div>
        </div>

        ${resultBannerHtml}

        ${
          state.tab === 'drills'
            ? `<div class="sidebar-panel" style="background:rgba(15,23,42,0.85);">
                <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:0.6rem;">
                  <div>
                    <strong>${i18n.pick('Pozycja bazowa dłoni (F i J)', 'Home Row Hand Position (F & J)')}</strong>
                    <p style="font-size:0.76rem; color:#94a3b8;">${i18n.pick('Palce wskazujące spoczywają na wypustkach F oraz J. Kciuki obsługują Spację.', 'Rest index fingers on the F and J tactile bumps. Use thumbs for Space.')}</p>
                  </div>
                  ${SvgArtwork.homeRowGuideSvg()}
                </div>
              </div>
              <div class="mode-grid">${activitiesHtml}</div>`
            : `<div class="sidebar-panel" data-testid="standardized-test-panel">
                <h3 style="font-size:1rem;">⏱️ ${i18n.pick('Standaryzowany Test Szybkości i Celności', 'Standardized Speed & Accuracy Test')}</h3>
                <p style="font-size:0.78rem; color:#94a3b8;">
                  ${i18n.pick(
                    'Porównuj wyniki członków rodziny wyłącznie w ramach identycznego czasu, języka oraz puli klawiszy.',
                    'Compare family results fairly under identical duration, language, and key-set conditions.'
                  )}
                </p>
                <div style="display:flex; gap:0.5rem; flex-wrap:wrap; align-items:center;">
                  <span style="font-size:0.78rem; color:#94a3b8;">${i18n.pick('Czas:', 'Duration:')}</span>
                  ${([30, 60, 120, 0] as const)
                    .map(
                      (dur) => `
                    <button class="nav-btn ${state.stdDuration === dur ? 'active' : ''}" data-std-dur="${dur}" data-testid="std-dur-${dur}">
                      ${dur === 0 ? i18n.pick('Bez limitu (Celność)', 'Untimed (Accuracy)') : `${dur}s`}
                    </button>`
                    )
                    .join('')}
                  <span style="font-size:0.78rem; color:#94a3b8; margin-left:0.6rem;">${i18n.pick('Zakres:', 'Pool:')}</span>
                  <button class="nav-btn ${state.stdPool === 'beginner' ? 'active' : ''}" data-std-pool="beginner" data-testid="std-pool-beginner">
                    🌱 ${i18n.pick('Początkujący (Rząd bazowy)', 'Beginner (Home Row)')}
                  </button>
                  <button class="nav-btn ${state.stdPool === 'full' ? 'active' : ''}" data-std-pool="full" data-testid="std-pool-full">
                    ⌨️ ${i18n.pick('Pełna klawiatura', 'Full Keyboard')}
                  </button>
                </div>
                <div style="margin-top:0.5rem;">
                  <button class="primary-cta-btn" data-action="start-standardized-test" data-testid="start-standardized-test-btn">
                    ▶ ${i18n.pick('Rozpocznij test standaryzowany', 'Start Standardized Test')}
                  </button>
                </div>

                <h4 style="font-size:0.88rem; margin-top:0.8rem;">🏆 ${i18n.pick('Porównanie Rodziny dla tego testu', 'Family Comparison for this Preset')}</h4>
                <table class="family-table" data-testid="standardized-leaderboard-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>${i18n.pick('Gracz', 'Player')}</th>
                      <th>WPM</th>
                      <th>${i18n.pick('Celność', 'Accuracy')}</th>
                      <th>${i18n.pick('Spójność', 'Consistency')}</th>
                      <th>${i18n.pick('Data', 'Date')}</th>
                    </tr>
                  </thead>
                  <tbody>${stdRowsHtml}</tbody>
                </table>
              </div>`
        }
      </section>
    `;
  }

  private static renderActiveSessionHtml(
    profile: PlayerProfile,
    state: TrainingViewState,
    i18n: LocalizationService
  ): string {
    const engine = state.activeEngine!;
    const typing = engine.typingEngine;
    const expected = typing.getExpectedChar() ?? '';
    const entered = typing.getEnteredText();
    const remaining = typing.getRemainingText();
    const wrongKey = typing.getLastWrongKey(Date.now());
    const displayExpected = expected === ' ' ? '␣' : expected || '✓';

    const timeLeft =
      engine.durationSec > 0 ? Math.max(0, Math.ceil(engine.durationSec - engine.elapsedSec)) : null;

    const vkHtml = VirtualKeyboardView.renderHtml({
      expectedChar: expected,
      lastWrongChar: wrongKey,
      language: profile.settings.language,
      assistanceMode: profile.settings.typingAssistance,
      showFingerColors: profile.settings.showFingerColors,
      showHandHints: profile.settings.showHandHints,
      characterMastery: profile.characterMastery,
    });

    return `
      <section style="display:flex; flex-direction:column; gap:0.75rem;" data-testid="training-active-screen">
        <div class="sidebar-panel" style="flex-direction:row; justify-content:space-between; align-items:center;">
          <div style="display:flex; gap:1rem; align-items:center;">
            <strong>${engine.mode === 'assessment' ? i18n.pick('⏱️ Test standaryzowany', '⏱️ Standardized test') : i18n.pick('🎓 Akademia Pisania', '🎓 Training Academy')}</strong>
            <span class="key-obj-pill">⚡ <strong id="training-wpm">${typing.getWpm()}</strong> WPM</span>
            <span class="key-obj-pill">🎯 <strong id="training-acc">${typing.getTotalAttempts() > 0 ? `${Math.round(typing.getAccuracy() * 100)}%` : '—'}</strong></span>
            <span class="key-obj-pill">⌨️ <strong id="training-chars">${typing.getTotalCorrect()}</strong></span>
            ${timeLeft !== null ? `<span class="key-obj-pill" style="border-color:#facc15; color:#facc15;">⏱️ <strong id="training-timer">${timeLeft}s</strong></span>` : ''}
          </div>
          <button class="nav-btn" style="border-color:#4ade80; color:#4ade80;" data-action="finish-training" data-testid="finish-training-btn">
            ✓ ${engine.mode === 'assessment' && engine.durationSec > 0 ? i18n.pick('Przerwij test i zapisz ćwiczenie', 'End test & save practice') : i18n.pick('Zakończ i zapisz', 'Finish & Save')}
          </button>
        </div>

        <div class="typing-console" style="padding:1rem;">
          <div class="console-sequence-box text-large ${wrongKey ? 'sequence-box-error' : ''}" data-testid="training-sequence-box">
            <span class="char-done">${escapeHtml(entered)}</span><span class="char-current ${wrongKey ? 'char-error' : ''}">${escapeHtml(displayExpected)}</span><span class="char-pending">${escapeHtml(remaining)}</span>
          </div>
          ${engine.mode === 'assessment' && engine.durationSec > 0 ? '' : vkHtml}
        </div>
      </section>
    `;
  }
}
