import { MISSIONS_DATA } from '../../data/curriculumData';
import { LocalizationService } from '../../i18n/LocalizationService';
import {
  ComparisonDateRange,
  DailySeriesPoint,
  FamilySortMetric,
  MIN_QUALIFYING_CHARS_FOR_WPM,
  StatisticsEngine,
} from '../../systems/StatisticsEngine';
import { DifficultyLevel, PlayerProfile } from '../../types';
import { escapeHtml } from '../../utils/escapeHtml';

export const PLAYER_COMPARISON_COLORS = [
  '#38bdf8',
  '#4ade80',
  '#facc15',
  '#f43f5e',
  '#a855f7',
  '#2dd4bf',
];

export interface FamilyDashboardState {
  sortBy: FamilySortMetric;
  sortDesc: boolean;
  selectedProfileIds: string[];
  dateRange: ComparisonDateRange;
  leaderboardMissionId: string;
  leaderboardDifficulty: DifficultyLevel | 'all';
}

export class FamilyDashboardView {
  public static formatDuration(sec: number, i18n: LocalizationService): string {
    if (sec <= 0) return '0 s';
    if (sec < 60) return `${sec} s`;
    const mins = Math.floor(sec / 60);
    const remSec = sec % 60;
    return remSec > 0 ? `${mins} min ${remSec} s` : `${mins} min`;
  }

  public static formatLastActive(ts: number, i18n: LocalizationService): string {
    if (!ts || ts <= 0) return i18n.pick('Brak aktywności', 'No activity');
    const d = new Date(ts);
    return d.toLocaleDateString(i18n.getLanguage() === 'pl' ? 'pl-PL' : 'en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  public static renderHtml(
    profiles: PlayerProfile[],
    state: FamilyDashboardState,
    i18n: LocalizationService
  ): string {
    const rows = StatisticsEngine.buildFamilyComparisonRows(profiles, state.sortBy, state.sortDesc);
    const colorByProfileId = new Map<string, string>();
    profiles.forEach((p, idx) => {
      colorByProfileId.set(p.id, PLAYER_COMPARISON_COLORS[idx % PLAYER_COMPARISON_COLORS.length]);
    });

    const sortHeader = (metric: FamilySortMetric, labelPl: string, labelEn: string) => {
      const isCurrent = state.sortBy === metric;
      const arrow = isCurrent ? (state.sortDesc ? ' ▼' : ' ▲') : '';
      return `<th class="family-th ${isCurrent ? 'active-sort' : ''}" data-sort-metric="${metric}" data-testid="family-sort-${metric}">
        ${escapeHtml(i18n.pick(labelPl, labelEn))}${arrow}
      </th>`;
    };

    const tableRowsHtml = rows
      .map((r, rankIdx) => {
        const pColor = colorByProfileId.get(r.profileId) ?? '#38bdf8';
        const accText =
          r.overallAccuracy !== null ? `${Math.round(r.overallAccuracy * 100)}%` : '—';
        const recWpmText = r.recentWpm !== null ? `${r.recentWpm} WPM` : '—';
        const bestQWpmText = r.bestQualifyingWpm !== null ? `${r.bestQualifyingWpm} WPM` : '—';

        const deltaBadges: string[] = [];
        if (r.accuracyDelta !== null && r.accuracyDelta !== 0) {
          const sign = r.accuracyDelta > 0 ? '+' : '';
          deltaBadges.push(
            `<span class="trend-pill ${r.accuracyDelta > 0 ? 'trend-up' : 'trend-neutral'}">${sign}${r.accuracyDelta}% 🎯</span>`
          );
        }
        if (r.wpmDelta !== null && r.wpmDelta !== 0) {
          const sign = r.wpmDelta > 0 ? '+' : '';
          deltaBadges.push(
            `<span class="trend-pill ${r.wpmDelta > 0 ? 'trend-up' : 'trend-neutral'}">${sign}${r.wpmDelta} WPM</span>`
          );
        }

        return `
          <tr data-testid="family-row-${escapeHtml(r.profileId)}">
            <td><strong>#${rankIdx + 1}</strong></td>
            <td>
              <div style="display:flex; align-items:center; gap:0.45rem;">
                <span class="vk-dot" style="background:${pColor}; width:10px; height:10px;"></span>
                <span>${escapeHtml(r.avatarIcon)}</span>
                <strong>${escapeHtml(r.name)}</strong>
                ${deltaBadges.join(' ')}
              </div>
            </td>
            <td>Lv ${r.level}</td>
            <td><strong>${r.completedMissions}</strong>/48</td>
            <td style="color:#facc15;">⭐ <strong>${r.totalStars}</strong></td>
            <td>${FamilyDashboardView.formatDuration(r.practiceTimeSec, i18n)}</td>
            <td>${r.totalCorrectChars}</td>
            <td data-testid="family-acc-${escapeHtml(r.profileId)}"><strong>${accText}</strong></td>
            <td>${recWpmText}</td>
            <td data-testid="family-qwpm-${escapeHtml(r.profileId)}">${bestQWpmText}</td>
            <td style="color:#c084fc;"><strong>${r.masteredChars}</strong></td>
            <td style="color:#fb923c;">🔥 ${r.bestCombo}</td>
            <td style="color:#4ade80;">🌊 ${r.survivalBestWave}</td>
            <td style="font-size:0.73rem; color:#94a3b8;">${escapeHtml(FamilyDashboardView.formatLastActive(r.lastActiveAt, i18n))}</td>
          </tr>
        `;
      })
      .join('');

    // Multi-player comparison selector & charts
    const selectedProfiles = profiles.filter((p) => state.selectedProfileIds.includes(p.id));
    const playerCheckboxesHtml = profiles
      .map((p) => {
        const checked = state.selectedProfileIds.includes(p.id);
        const pColor = colorByProfileId.get(p.id) ?? '#38bdf8';
        return `
          <label class="compare-player-chip ${checked ? 'checked' : ''}" style="border-color:${pColor};" data-testid="compare-toggle-${escapeHtml(p.id)}">
            <input type="checkbox" data-compare-profile="${escapeHtml(p.id)}" ${checked ? 'checked' : ''} />
            <span class="vk-dot" style="background:${pColor};"></span>
            <span>${escapeHtml(p.avatarIcon)} ${escapeHtml(p.name)}</span>
          </label>
        `;
      })
      .join('');

    const seriesByProfile = new Map<string, DailySeriesPoint[]>();
    for (const p of selectedProfiles) {
      seriesByProfile.set(p.id, StatisticsEngine.getPlayerDailySeries(p, state.dateRange));
    }

    const chartsHtml = FamilyDashboardView.renderComparisonChartsGrid(
      selectedProfiles,
      seriesByProfile,
      colorByProfileId,
      i18n
    );

    // Fair Mission Leaderboard
    const leaderboardEntries = StatisticsEngine.getMissionLeaderboard(
      profiles,
      state.leaderboardMissionId,
      state.leaderboardDifficulty
    );

    const leaderboardRowsHtml =
      leaderboardEntries.length > 0
        ? leaderboardEntries
            .map((entry, idx) => {
              const pColor = colorByProfileId.get(entry.profileId) ?? '#38bdf8';
              const qWpm = entry.bestQualifyingWpm !== null ? `${entry.bestQualifyingWpm} WPM` : '—';
              return `
                <tr data-testid="leaderboard-row-${escapeHtml(entry.profileId)}">
                  <td>
                    ${entry.isFamilyRecord ? '👑 <strong>#1 Rekord Rodziny</strong>' : `#${idx + 1}`}
                  </td>
                  <td>
                    <span class="vk-dot" style="background:${pColor};"></span>
                    ${escapeHtml(entry.avatarIcon)} <strong>${escapeHtml(entry.playerName)}</strong>
                  </td>
                  <td><span class="key-obj-pill">${escapeHtml(entry.difficulty)}</span></td>
                  <td style="color:#facc15; font-weight:800;">${entry.bestScore} pkt</td>
                  <td>🎯 ${Math.round(entry.bestAccuracy * 100)}%</td>
                  <td>⚡ ${qWpm}</td>
                  <td>${'⭐'.repeat(entry.stars)}${'☆'.repeat(3 - entry.stars)}</td>
                  <td>🔥 ${entry.maxCombo}</td>
                  <td>${entry.timesCompleted}×</td>
                </tr>
              `;
            })
            .join('')
        : `<tr><td colspan="9" style="text-align:center; color:#94a3b8; padding:1rem;">
            ${i18n.pick(
              'Brak ukończonych wyników dla wybranej misji i poziomu trudności. Ukończ misję w Kampanii, aby ustanowić Rekord Rodziny!',
              'No completed records for this mission and difficulty yet. Complete the mission in Campaign mode to set a Family Record!'
            )}
          </td></tr>`;

    return `
      <section style="display:flex; flex-direction:column; gap:1rem;" data-testid="family-dashboard-screen">
        <!-- 1. Family Comparison Table -->
        <div class="sidebar-panel">
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem;">
            <div>
              <h2 style="font-size:1.35rem;">👨‍👩‍👧 ${i18n.pick('Ranking rodzinny', 'Family Dashboard')}</h2>
              <p style="font-size:0.82rem; color:#94a3b8;">
                ${i18n.pick(
                  `Kliknij dowolną kolumnę, aby posortować. Kwalifikowany rekord WPM wymaga próby min. ${MIN_QUALIFYING_CHARS_FOR_WPM} poprawnych znaków.`,
                  `Click any column header to sort. Qualifying WPM records require at least ${MIN_QUALIFYING_CHARS_FOR_WPM} correct characters.`
                )}
              </p>
            </div>
            <button class="nav-btn" data-nav="profiles" data-testid="family-go-profiles-btn">
              👥 ${i18n.pick('Zarządzaj Graczami', 'Manage Players')}
            </button>
          </div>

          <div style="overflow-x:auto;">
            <table class="family-table" data-testid="family-comparison-table">
              <thead>
                <tr>
                  <th>#</th>
                  ${sortHeader('defenderScore', 'Gracz (Wynik Obrońcy)', 'Player (Defender Score)')}
                  ${sortHeader('level', 'Poz.', 'Lv')}
                  ${sortHeader('completedMissions', 'Misje', 'Missions')}
                  ${sortHeader('totalStars', 'Gwiazdki', 'Stars')}
                  ${sortHeader('practiceTimeSec', 'Czas pisania', 'Practice Time')}
                  ${sortHeader('totalCorrectChars', 'Poprawne zn.', 'Correct Chars')}
                  ${sortHeader('overallAccuracy', 'Celność', 'Accuracy')}
                  ${sortHeader('recentWpm', 'Ostatnie WPM', 'Recent WPM')}
                  ${sortHeader('bestQualifyingWpm', 'Rekord WPM', 'Best WPM')}
                  ${sortHeader('masteredChars', 'Opanowane', 'Mastered')}
                  ${sortHeader('bestCombo', 'Kombo', 'Combo')}
                  ${sortHeader('survivalBestWave', 'Przetrwanie', 'Survival')}
                  ${sortHeader('lastActiveAt', 'Aktywność', 'Last Active')}
                </tr>
              </thead>
              <tbody>
                ${tableRowsHtml}
              </tbody>
            </table>
          </div>
        </div>

        <!-- 2. Multi-Player Comparison & Charts -->
        <div class="sidebar-panel" data-testid="player-comparison-section">
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.65rem;">
            <h3>📈 ${i18n.pick('Porównanie Graczy i Wykresy Postępów', 'Player Comparison & Progress Charts')}</h3>
            <div style="display:flex; gap:0.35rem;" data-testid="comparison-date-range-filters">
              <button class="nav-btn ${state.dateRange === '7d' ? 'active' : ''}" data-date-range="7d" data-testid="range-7d">
                ${i18n.pick('Ostatnie 7 dni', 'Last 7 days')}
              </button>
              <button class="nav-btn ${state.dateRange === '30d' ? 'active' : ''}" data-date-range="30d" data-testid="range-30d">
                ${i18n.pick('Ostatnie 30 dni', 'Last 30 days')}
              </button>
              <button class="nav-btn ${state.dateRange === 'all' ? 'active' : ''}" data-date-range="all" data-testid="range-all">
                ${i18n.pick('Cały okres', 'All time')}
              </button>
            </div>
          </div>

          <div style="display:flex; gap:0.5rem; flex-wrap:wrap; align-items:center;">
            <span style="font-size:0.78rem; color:#94a3b8;">${i18n.pick('Wybierz graczy do porównania:', 'Select players to compare:')}</span>
            ${playerCheckboxesHtml}
          </div>

          ${chartsHtml}
        </div>

        <!-- 3. Fair Per-Mission Leaderboards -->
        <div class="sidebar-panel" data-testid="mission-leaderboard-section">
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.65rem;">
            <h3>🏆 ${i18n.pick('Lokalny Ranking Misji (Porównywalne Warunki)', 'Fair Mission Leaderboard')}</h3>
            <div style="display:flex; gap:0.5rem; flex-wrap:wrap; align-items:center;">
              <select id="leaderboard-mission-select" data-testid="leaderboard-mission-select" style="background:#090d16; border:1px solid #38bdf8; border-radius:6px; padding:0.3rem 0.55rem; font-size:0.78rem;">
                ${MISSIONS_DATA.map(
                  (m) =>
                    `<option value="${m.id}" ${state.leaderboardMissionId === m.id ? 'selected' : ''}>
                      ${m.worldId}.${m.missionIndex} — ${escapeHtml(i18n.pick(m.namePl, m.nameEn))}
                    </option>`
                ).join('')}
              </select>

              <div style="display:flex; gap:0.25rem;" data-testid="leaderboard-difficulty-filters">
                ${(['standard', 'relaxed', 'tactical', 'all'] as const)
                  .map((diff) => {
                    const labels: Record<string, [string, string]> = {
                      standard: ['Standardowy', 'Standard'],
                      relaxed: ['Relaksacyjny', 'Relaxed'],
                      tactical: ['Taktyczny', 'Tactical'],
                      all: ['Wszystkie', 'All'],
                    };
                    const [pl, en] = labels[diff];
                    return `<button class="nav-btn ${state.leaderboardDifficulty === diff ? 'active' : ''}" data-leaderboard-diff="${diff}" data-testid="leaderboard-diff-${diff}">
                      ${i18n.pick(pl, en)}
                    </button>`;
                  })
                  .join('')}
              </div>
            </div>
          </div>

          <div style="overflow-x:auto;">
            <table class="family-table" data-testid="mission-leaderboard-table">
              <thead>
                <tr>
                  <th>${i18n.pick('Miejsce', 'Rank')}</th>
                  <th>${i18n.pick('Gracz', 'Player')}</th>
                  <th>${i18n.pick('Poziom trudności', 'Difficulty')}</th>
                  <th>${i18n.pick('Najlepszy wynik', 'Best Score')}</th>
                  <th>${i18n.pick('Najlepsza celność', 'Best Accuracy')}</th>
                  <th>${i18n.pick('Kwalifikowane WPM', 'Qualifying WPM')}</th>
                  <th>${i18n.pick('Gwiazdki', 'Stars')}</th>
                  <th>${i18n.pick('Maks. Kombo', 'Max Combo')}</th>
                  <th>${i18n.pick('Ukończenia', 'Completions')}</th>
                </tr>
              </thead>
              <tbody>
                ${leaderboardRowsHtml}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    `;
  }

  private static renderComparisonChartsGrid(
    selectedProfiles: PlayerProfile[],
    seriesByProfile: Map<string, DailySeriesPoint[]>,
    colorByProfileId: Map<string, string>,
    i18n: LocalizationService
  ): string {
    if (selectedProfiles.length === 0) {
      return `<p style="color:#94a3b8; font-size:0.84rem; padding:0.75rem 0;">
        ${i18n.pick('Zaznacz co najmniej jednego gracza powyżej, aby wyświetlić wykresy porównawcze.', 'Select at least one player above to display comparison charts.')}
      </p>`;
    }

    const chartSpecs: Array<{
      id: string;
      titlePl: string;
      titleEn: string;
      unit: string;
      getValue: (pt: DailySeriesPoint) => number | null;
    }> = [
      {
        id: 'wpm',
        titlePl: 'Tempo pisania (WPM w czasie)',
        titleEn: 'Typing Speed (WPM over time)',
        unit: 'WPM',
        getValue: (pt) => pt.wpm,
      },
      {
        id: 'accuracy',
        titlePl: 'Celność w czasie (%)',
        titleEn: 'Accuracy over time (%)',
        unit: '%',
        getValue: (pt) => (pt.accuracy !== null ? Math.round(pt.accuracy * 100) : null),
      },
      {
        id: 'practice_time',
        titlePl: 'Dzienny czas aktywnego pisania (s)',
        titleEn: 'Daily Active Practice Time (s)',
        unit: 's',
        getValue: (pt) => pt.practiceTimeSec,
      },
      {
        id: 'correct_chars',
        titlePl: 'Poprawne znaki dziennie',
        titleEn: 'Correct Characters Typed per Day',
        unit: '',
        getValue: (pt) => pt.correctChars,
      },
      {
        id: 'campaign_prog',
        titlePl: 'Postęp kampanii (ukończone misje)',
        titleEn: 'Campaign Progression (Missions)',
        unit: '',
        getValue: (pt) => pt.missionsCompletedCumulative,
      },
      {
        id: 'mastered_chars',
        titlePl: 'Opanowane znaki w czasie',
        titleEn: 'Mastered Characters over Time',
        unit: '',
        getValue: (pt) => pt.masteredCount,
      },
    ];

    const cardsHtml = chartSpecs
      .map((spec) => {
        const svgHtml = FamilyDashboardView.buildMultiSeriesSvg(
          selectedProfiles,
          seriesByProfile,
          colorByProfileId,
          spec.getValue,
          spec.unit,
          i18n
        );
        return `
          <div class="chart-card" data-testid="chart-card-${spec.id}">
            <div style="font-size:0.8rem; font-weight:700; color:#e2e8f0; margin-bottom:0.35rem;">
              ${escapeHtml(i18n.pick(spec.titlePl, spec.titleEn))}
            </div>
            ${svgHtml}
          </div>
        `;
      })
      .join('');

    return `<div class="charts-grid" data-testid="comparison-charts-grid">${cardsHtml}</div>`;
  }

  private static buildMultiSeriesSvg(
    selectedProfiles: PlayerProfile[],
    seriesByProfile: Map<string, DailySeriesPoint[]>,
    colorByProfileId: Map<string, string>,
    getValue: (pt: DailySeriesPoint) => number | null,
    unit: string,
    i18n: LocalizationService
  ): string {
    // Collect all dates that have valid values across selected profiles
    const dateSet = new Set<string>();
    let maxVal = 10;

    for (const p of selectedProfiles) {
      const pts = seriesByProfile.get(p.id) ?? [];
      for (const pt of pts) {
        const v = getValue(pt);
        if (v !== null && v >= 0) {
          dateSet.add(pt.date);
          if (v > maxVal) maxVal = v;
        }
      }
    }

    const dates = Array.from(dateSet).sort();
    if (dates.length === 0) {
      return `
        <div class="chart-empty-state">
          ${i18n.pick('Brak danych prób w wybranym okresie', 'No qualifying data in selected range')}
        </div>
      `;
    }

    const w = 320;
    const h = 115;
    const padL = 32;
    const padR = 14;
    const padT = 12;
    const padB = 22;
    const plotW = w - padL - padR;
    const plotH = h - padT - padB;

    const xForIndex = (idx: number) =>
      dates.length === 1 ? padL + plotW / 2 : padL + (idx / (dates.length - 1)) * plotW;
    const yForValue = (val: number) => padT + plotH - (Math.min(maxVal, Math.max(0, val)) / maxVal) * plotH;

    let seriesPathsHtml = '';
    for (const p of selectedProfiles) {
      const color = colorByProfileId.get(p.id) ?? '#38bdf8';
      const pts = seriesByProfile.get(p.id) ?? [];
      const byDate = new Map<string, DailySeriesPoint>(pts.map((pt) => [pt.date, pt]));

      const coords: Array<{ x: number; y: number; val: number; date: string }> = [];
      dates.forEach((d, idx) => {
        const pt = byDate.get(d);
        if (!pt) return;
        const v = getValue(pt);
        if (v === null) return;
        coords.push({ x: xForIndex(idx), y: yForValue(v), val: v, date: d });
      });

      if (coords.length >= 2) {
        const polyPts = coords.map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ');
        seriesPathsHtml += `<polyline fill="none" stroke="${color}" stroke-width="2.2" points="${polyPts}" />`;
      }
      for (const c of coords) {
        seriesPathsHtml += `<circle cx="${c.x.toFixed(1)}" cy="${c.y.toFixed(1)}" r="3.5" fill="${color}">
          <title>${escapeHtml(p.name)} (${c.date}): ${c.val}${unit}</title>
        </circle>`;
      }
    }

    const firstDate = dates[0].slice(5);
    const lastDate = dates[dates.length - 1].slice(5);

    return `
      <svg viewBox="0 0 ${w} ${h}" class="comparison-chart-svg">
        <line x1="${padL}" y1="${padT}" x2="${padL}" y2="${padT + plotH}" stroke="rgba(148,163,184,0.25)" />
        <line x1="${padL}" y1="${padT + plotH}" x2="${padL + plotW}" y2="${padT + plotH}" stroke="rgba(148,163,184,0.25)" />
        <text x="${padL - 4}" y="${padT + 8}" fill="#94a3b8" font-size="9" text-anchor="end">${maxVal}${unit}</text>
        <text x="${padL - 4}" y="${padT + plotH}" fill="#94a3b8" font-size="9" text-anchor="end">0</text>
        <text x="${padL}" y="${h - 5}" fill="#94a3b8" font-size="9">${escapeHtml(firstDate)}</text>
        ${
          dates.length > 1
            ? `<text x="${padL + plotW}" y="${h - 5}" fill="#94a3b8" font-size="9" text-anchor="end">${escapeHtml(lastDate)}</text>`
            : ''
        }
        ${seriesPathsHtml}
      </svg>
    `;
  }
}
