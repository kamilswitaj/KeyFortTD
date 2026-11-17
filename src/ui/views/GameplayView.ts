import { MISSIONS_DATA } from '../../data/curriculumData';
import { ENEMIES_DATA } from '../../data/enemiesData';
import { TOWER_ORDER, TOWERS_DATA } from '../../data/towersData';
import { LocalizationService } from '../../i18n/LocalizationService';
import { GameSessionEngine } from '../../systems/GameSessionEngine';
import { MissionOutcomeEvaluation } from '../../systems/ProgressionEngine';
import { TowerSystem } from '../../systems/TowerSystem';
import {
  AchievementDefinition,
  EnemyType,
  PlayerProfile,
  TargetingPriority,
  UpgradeBranch,
} from '../../types';
import { escapeHtml } from '../../utils/escapeHtml';
import { VirtualKeyboardView } from '../VirtualKeyboardView';
import { OnboardingView } from './OnboardingView';

export class GameplayView {
  public static renderGameplayLayoutHtml(
    session: GameSessionEngine,
    profile: PlayerProfile,
    i18n: LocalizationService
  ): string {
    return `
      <section class="gameplay-layout" data-testid="gameplay-screen">
        <div class="battlefield-column">
          <div id="gameplay-hud-container">
            ${GameplayView.buildGameplayHudHtml(session, profile, i18n)}
          </div>

          <div class="canvas-container">
            <canvas id="battlefield-canvas" width="930" height="400" data-testid="battlefield-canvas"></canvas>
          </div>

          <div id="typing-console-container">
            ${GameplayView.buildTypingConsoleHtml(session, profile, i18n)}
          </div>
        </div>

        <aside class="tactical-sidebar" id="tactical-sidebar-container">
          ${GameplayView.buildTacticalSidebarHtml(session, profile, i18n)}
        </aside>
      </section>
    `;
  }

  public static buildGameplayHudHtml(
    session: GameSessionEngine,
    profile: PlayerProfile,
    i18n: LocalizationService
  ): string {
    const economy = session.economy;
    const typing = session.typingEngine;
    const powerState = session.getPowerState();
    const energyPct = Math.min(100, Math.round((economy.getEnergy() / economy.getMaxEnergy()) * 100));
    const reqChars = session.getRequiredCharsForVictory();
    const wavePreview = session.getUpcomingWavePreview();

    const wavePreviewItemsHtml = wavePreview.items
      .map((item) => {
        const counterDef = TOWERS_DATA[item.counterTower];
        const counterName = i18n.pick(counterDef.namePl, counterDef.nameEn);
        return `
          <span class="wave-preview-chip" title="${escapeHtml(i18n.pick(item.traitPl, item.traitEn))} — ${escapeHtml(i18n.pick('Kontra:', 'Counter:'))} ${escapeHtml(counterName)}">
            <span class="vk-dot" style="background:${item.color};"></span>
            <strong>${item.count}×</strong> ${escapeHtml(i18n.pick(item.namePl, item.nameEn))}
            <span class="wave-counter-tag">⚡ ${escapeHtml(counterName.replace('Wieża ', ''))}</span>
          </span>
        `;
      })
      .join('');

    const empCd = session.getAbilityCooldown('emp');
    const overCd = session.getAbilityCooldown('overdrive');
    const orbCd = session.getAbilityCooldown('orbital');

    return `
      <div class="tactical-hud">
        <div class="hud-top-row">
          <div class="hud-metrics">
            <div class="hud-stat" title="Base HP" data-testid="hud-lives">
              ❤️ ${i18n.t('hud.lives')}: <span style="color:#f43f5e;" id="hud-lives-value">${session.getLives()}/${session.getMaxLives()}</span>
            </div>
            <div class="hud-stat" title="Gold" data-testid="hud-gold">
              🪙 ${i18n.t('hud.gold')}: <span style="color:#facc15;" id="hud-gold-value">${economy.getGold()}</span>
            </div>
            <div class="energy-meter-wrap" data-testid="hud-energy">
              <span>⚡ ${i18n.t('hud.energy')}: <strong id="hud-energy-value">${economy.getEnergy()}</strong>/<span id="hud-energy-max">${economy.getMaxEnergy()}</span></span>
              <div class="energy-bar-outer">
                <div class="energy-bar-inner" id="hud-energy-bar" style="width:${energyPct}%;"></div>
              </div>
              <span class="power-badge ${powerState}" id="hud-power-state" data-testid="hud-power-state">
                ${i18n.t(`hud.powerState.${powerState}`)}
              </span>
            </div>
            <div class="hud-stat" data-testid="hud-wave">
              🌊 ${i18n.t('hud.wave')}: <span id="hud-wave-value">${session.waveSystem.getCurrentWaveNumber()}/${session.mode === 'survival' ? '∞' : session.mission.waves.length}</span>
            </div>
            ${
              reqChars > 0
                ? `<div class="hud-stat" data-testid="hud-typing-goal">
                    ⌨️ ${i18n.t('console.progress')}: <span id="hud-typing-goal-value" style="color:${typing.getTotalCorrect() >= reqChars ? '#4ade80' : '#38bdf8'};">${typing.getTotalCorrect()}/${reqChars}</span>
                  </div>`
                : ''
            }
          </div>

          <div class="hud-controls">
            <button
              class="wave-start-btn"
              id="hud-start-wave-btn"
              data-action="start-wave"
              data-testid="start-wave-btn"
              ${session.waveSystem.isWaveActive() || !session.waveSystem.hasMoreWaves() ? 'disabled' : ''}
            >
              ▶ ${i18n.t('hud.startWave')}
            </button>
            <button class="nav-btn" id="hud-speed-btn" data-action="cycle-speed" data-testid="speed-btn">
              ⏩ ${session.getGameSpeed()}x
            </button>
            <button class="nav-btn" id="hud-pause-btn" data-action="toggle-pause" data-testid="pause-btn">
              ${session.getIsPaused() ? `▶ ${i18n.t('hud.resume')}` : `⏸ ${i18n.t('hud.pause')}`}
            </button>
          </div>
        </div>

        <div class="hud-bottom-row">
          <div class="wave-preview-bar" data-testid="wave-preview-bar">
            <span style="font-size:0.72rem; color:#94a3b8; font-weight:700;">
              ${session.waveSystem.isWaveActive() ? i18n.pick('Aktywna fala:', 'Active wave:') : i18n.pick('Nadchodząca fala:', 'Incoming wave:')}
            </span>
            ${wavePreviewItemsHtml}
          </div>

          <div class="ability-bar">
            <button
              class="ability-btn"
              id="hud-ability-emp"
              data-ability="emp"
              data-testid="ability-emp"
              title="${i18n.pick('Niszczy 65% tarcz, ujawnia Duchy i ogłusza wrogów na 1.8 s (wymaga aktywnych wrogów)', 'Strips 65% shields, reveals Ghosts, and stuns enemies for 1.8s (requires active enemies)')}"
              ${session.canUseAbility('emp') ? '' : 'disabled'}
            >
              🌩️ ${i18n.t('hud.ability.emp')}${empCd > 0 ? ` (${empCd}s)` : ''}
            </button>
            <button
              class="ability-btn"
              id="hud-ability-overdrive"
              data-ability="overdrive"
              data-testid="ability-overdrive"
              title="${i18n.pick('Wymusza Przeciążenie Bojowe (140% szybkostrzelności wież) przez 8 s', 'Forces Combat Overcharge (140% tower output) for 8s')}"
              ${session.canUseAbility('overdrive') ? '' : 'disabled'}
            >
              ⚡ ${i18n.t('hud.ability.overdrive')}${overCd > 0 ? ` (${overCd}s)` : ''}
            </button>
            <button
              class="ability-btn"
              id="hud-ability-orbital"
              data-ability="orbital"
              data-testid="ability-orbital"
              title="${i18n.pick('Uderza wszystkich wrogów na mapie za 165 obrażeń przebijających pancerz (wymaga aktywnych wrogów)', 'Strikes all active enemies for 165 armor-piercing damage (requires active enemies)')}"
              ${session.canUseAbility('orbital') ? '' : 'disabled'}
            >
              ☄️ ${i18n.t('hud.ability.orbital')}${orbCd > 0 ? ` (${orbCd}s)` : ''}
            </button>

            <span class="hud-mini-stat" data-testid="hud-combo">🔥 ${i18n.t('hud.combo')}: <strong id="hud-combo-value">${typing.getCombo()}</strong></span>
            <span class="hud-mini-stat" data-testid="hud-accuracy">🎯 ${i18n.t('hud.accuracy')}: <strong id="hud-accuracy-value">${Math.round(typing.getAccuracy() * 100)}%</strong></span>
            ${
              profile.settings.showWpmStat
                ? `<span class="hud-mini-stat" data-testid="hud-wpm">⚡ <strong id="hud-wpm-value">${typing.getWpm()}</strong> WPM</span>`
                : ''
            }
          </div>
        </div>
      </div>
    `;
  }

  public static buildTypingConsoleHtml(
    session: GameSessionEngine,
    profile: PlayerProfile,
    i18n: LocalizationService
  ): string {
    const typing = session.typingEngine;
    const prompt = typing.getCurrentPrompt();
    const entered = typing.getEnteredText();
    const expected = typing.getExpectedChar() ?? '';
    const remaining = typing.getRemainingText();
    const wrongKey = typing.getLastWrongKey();

    const isDrill = prompt?.isDrill ?? true;
    const badgeLabel = isDrill
      ? i18n.t('console.mode.drill')
      : prompt?.category === 'sentences'
      ? i18n.t('console.mode.sentence')
      : i18n.t('console.mode.word');

    const sizeClass =
      profile.settings.textSize === 'xlarge'
        ? 'text-xlarge'
        : profile.settings.textSize === 'large'
        ? 'text-large'
        : '';

    const displayExpected = expected === ' ' ? '␣' : expected;

    const keyObjectives = session.getKeyObjectives();
    const keyObjHtml =
      keyObjectives.length > 0
        ? `<div class="key-objectives-bar" data-testid="key-objectives-bar">
            <span style="font-size:0.72rem; color:#94a3b8;">${i18n.pick('Cele klawiszy:', 'Key goals:')}</span>
            ${keyObjectives
              .map((obj) => {
                const label = obj.key === ' ' ? '␣' : obj.key.toUpperCase();
                return `<span class="key-obj-pill ${obj.completed ? 'completed' : ''}" data-testid="key-obj-${escapeHtml(obj.key)}">
                  <strong>${escapeHtml(label)}</strong>: ${obj.correct}/${obj.requiredCorrect} ${obj.completed ? '✓' : ''}
                </span>`;
              })
              .join('')}
          </div>`
        : '';

    const followUpBannerHtml = session.isFollowUpPracticeActive()
      ? `<div class="followup-banner" data-testid="followup-practice-banner">
          ⚔️ <strong>${i18n.pick('Fale obronione!', 'Waves cleared!')}</strong>
          ${i18n.pick(
            'Dokończ krótkie ćwiczenie docelowych klawiszy poniżej, aby zaliczyć lekcję bez powtarzania bitwy!',
            'Complete the short follow-up key drill below to finish the lesson without replaying the battle!'
          )}
        </div>`
      : '';

    const onboardingHtml = OnboardingView.renderContextualHintHtml(session, i18n);

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
      <div class="typing-console" data-testid="typing-console">
        ${followUpBannerHtml || onboardingHtml}
        <div class="console-header">
          <div style="display:flex; align-items:center; gap:0.5rem; flex-wrap:wrap;">
            <strong>⌨️ ${i18n.t('console.title')}</strong>
            <span class="mode-badge ${isDrill ? 'drill' : 'word'}" data-testid="console-exercise-badge">
              ${badgeLabel}
            </span>
            ${keyObjHtml}
          </div>
          <div style="color:#94a3b8; font-size:0.76rem;">
            ${escapeHtml(i18n.pick(session.mission.namePl, session.mission.nameEn))}
          </div>
        </div>

        <div class="console-sequence-box ${sizeClass}" data-testid="console-sequence-box" data-expected-char="${escapeHtml(expected)}">
          <span class="char-done" data-testid="console-entered">${escapeHtml(entered)}</span><span class="char-current ${wrongKey ? 'char-error' : ''}" data-testid="console-expected">${escapeHtml(displayExpected)}${wrongKey ? '!' : ''}</span><span class="char-pending" data-testid="console-remaining">${escapeHtml(remaining)}</span>
        </div>

        ${vkHtml}
      </div>
    `;
  }

  public static buildTacticalSidebarHtml(
    session: GameSessionEngine,
    profile: PlayerProfile,
    i18n: LocalizationService
  ): string {
    const selectedPad = session.getSelectedPadIndex();
    const selectedTower = session.getSelectedTower();

    const towerButtonsHtml = TOWER_ORDER.map((type) => {
      const def = TOWERS_DATA[type];
      const isUnlocked = session.mode !== 'campaign' || profile.unlockedTowers.includes(type);
      const canAfford = session.economy.getGold() >= def.cost;
      const hasEmptyPad = session.map.pads.some(
        (p) => !session.getTowers().some((t) => t.padIndex === p.index)
      );
      const canBuild = isUnlocked && canAfford && hasEmptyPad;

      return `
        <button
          class="tower-shop-btn"
          data-build-tower="${type}"
          data-tower-cost="${def.cost}"
          data-tower-unlocked="${isUnlocked ? '1' : '0'}"
          data-testid="build-tower-${type}"
          ${canBuild ? '' : 'disabled'}
          style="border-left: 4px solid ${def.color};"
        >
          <div style="display:flex; justify-content:space-between; align-items:center; gap:0.25rem; width:100%; font-weight:800; font-size:0.8rem;">
            <span>${escapeHtml(i18n.pick(def.namePl, def.nameEn))}</span>
            <span style="color:#facc15; white-space:nowrap; flex-shrink:0;">${def.cost} 🪙</span>
          </div>
          <div style="font-size:0.7rem; color:#94a3b8;">
            ${isUnlocked ? escapeHtml(i18n.pick(def.rolePl, def.roleEn)) : `🔒 ${i18n.pick('Świat', 'World')} ${def.unlockWorld}`}
          </div>
        </button>
      `;
    }).join('');

    let inspectorHtml = '';
    if (selectedTower) {
      const def = TOWERS_DATA[selectedTower.type];
      const stats = TowerSystem.computeEffectiveStats(selectedTower, session.getTowers());
      const sellValue = TowerSystem.getSellValue(selectedTower);
      const maxAllowedTier = session.mode === 'sandbox' ? 3 : profile.unlockedUpgradeTiers;

      const priorities: TargetingPriority[] = ['first', 'last', 'strongest', 'nearest'];
      const priorityBtns = priorities
        .map(
          (p) => `
          <button
            class="nav-btn ${selectedTower.targeting === p ? 'active' : ''}"
            style="padding:0.22rem 0.42rem; font-size:0.72rem;"
            data-target-priority="${p}"
            data-testid="target-priority-${p}"
          >
            ${i18n.t(`tower.target.${p}`)}
          </button>
        `
        )
        .join('');

      const branches: UpgradeBranch[] = ['damage', 'speed', 'special'];
      const branchesHtml = branches
        .map((branch) => {
          const currentTier = selectedTower.upgrades[branch];
          const nextUpg = TowerSystem.getNextUpgrade(selectedTower, branch);
          const isLockedByCampaign = currentTier >= maxAllowedTier && currentTier < 3;
          const unlockWorldNum = currentTier === 1 ? 2 : 3;
          const canBuy =
            nextUpg && !isLockedByCampaign && session.economy.getGold() >= nextUpg.cost;

          let statDeltaBadge = '';
          if (nextUpg) {
            if (nextUpg.effects.damageMultiplier) {
              const nextDmg = Math.round(stats.damage * nextUpg.effects.damageMultiplier);
              statDeltaBadge = `<span style="color:#4ade80; font-size:0.7rem;">(${stats.damage} → ${nextDmg} obr.)</span>`;
            } else if (nextUpg.effects.fireRateMultiplier) {
              const nextSpd = (stats.fireRate * nextUpg.effects.fireRateMultiplier).toFixed(2);
              statDeltaBadge = `<span style="color:#38bdf8; font-size:0.7rem;">(${stats.fireRate}/s → ${nextSpd}/s)</span>`;
            }
          }

          return `
            <div class="upgrade-branch-card" data-testid="upgrade-card-${branch}">
              <div style="display:flex; justify-content:space-between; font-size:0.76rem; font-weight:700;">
                <span>${i18n.t(`tower.branch.${branch}`)} (T${currentTier}/3) ${statDeltaBadge}</span>
                <span style="color:#facc15;">${'★'.repeat(currentTier)}${'☆'.repeat(3 - currentTier)}</span>
              </div>
              ${
                nextUpg
                  ? `<div style="font-size:0.72rem; color:#cbd5e1;">
                      <strong>${escapeHtml(i18n.pick(nextUpg.namePl, nextUpg.nameEn))}</strong>: ${escapeHtml(i18n.pick(nextUpg.descPl, nextUpg.descEn))}
                    </div>
                    <button
                      class="upgrade-btn"
                      data-upgrade-branch="${branch}"
                      data-upgrade-cost="${nextUpg.cost}"
                      data-upgrade-locked="${isLockedByCampaign ? '1' : '0'}"
                      data-testid="upgrade-btn-${branch}"
                      ${canBuy ? '' : 'disabled'}
                    >
                      ${
                        isLockedByCampaign
                          ? `🔒 ${i18n.pick(`Odblokuj w Świecie ${unlockWorldNum}`, `Unlock in World ${unlockWorldNum}`)}`
                          : `⬆️ ${i18n.pick('Ulepsz', 'Upgrade')} (${nextUpg.cost} 🪙)`
                      }
                    </button>`
                  : `<div style="font-size:0.73rem; color:#4ade80; font-weight:700;">✓ ${i18n.t('tower.maxTier')}</div>`
              }
            </div>
          `;
        })
        .join('');

      inspectorHtml = `
        <div class="sidebar-panel" data-testid="tower-inspector-panel">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <h3 style="border:none; padding:0; color:${def.color}; font-size:0.9rem;">
              ${escapeHtml(i18n.pick(def.namePl, def.nameEn))} (#${selectedTower.padIndex + 1})
            </h3>
            <button class="nav-btn" style="border-color:#f43f5e; color:#fda4af; padding:0.2rem 0.5rem; font-size:0.73rem;" data-action="sell-tower" data-testid="sell-tower-btn">
              💰 ${i18n.t('tower.sell')} (+${sellValue} 🪙)
            </button>
          </div>

          <div style="display:grid; grid-template-columns:repeat(3,1fr); gap:0.25rem; font-size:0.72rem; background:#090d16; padding:0.38rem 0.45rem; border-radius:6px; white-space:nowrap;">
            <div>⚔️ ${i18n.pick('Obr:', 'Dmg:')} <strong>${stats.damage}</strong></div>
            <div>⚡ ${i18n.pick('Tempo:', 'Rate:')} <strong>${stats.fireRate}/s</strong></div>
            <div>🎯 ${i18n.pick('Zasięg:', 'Range:')} <strong>${stats.range}</strong></div>
          </div>

          <div style="display:flex; align-items:center; justify-content:space-between; gap:0.25rem; flex-wrap:wrap;">
            <span style="font-size:0.72rem; color:#94a3b8;">${i18n.t('tower.targeting')}:</span>
            <div style="display:flex; gap:0.2rem; flex-wrap:wrap;">${priorityBtns}</div>
          </div>

          <div style="display:flex; flex-direction:column; gap:0.38rem;">
            ${branchesHtml}
          </div>
        </div>
      `;
    } else {
      inspectorHtml = `
        <div class="sidebar-panel">
          <h3>ℹ️ ${i18n.t('tower.upgradeTitle')}</h3>
          <p style="font-size:0.78rem; color:#94a3b8;">
            ${
              selectedPad !== null
                ? `${i18n.pick('Wybrany postument:', 'Selected pad:')} #${selectedPad + 1}. ${i18n.pick('Wybierz wieżę powyżej, aby ją zbudować.', 'Click a tower above to build it here.')}`
                : i18n.t('tower.selectPadPrompt')
            }
          </p>
        </div>
      `;
    }

    let sandboxControlsHtml = '';
    if (session.mode === 'sandbox') {
      const enemyTypes: EnemyType[] = ['scout', 'tank', 'shield', 'swarm', 'ghost', 'splitter', 'regenerator', 'boss'];
      sandboxControlsHtml = `
        <div class="sidebar-panel" data-testid="sandbox-controls-panel">
          <h3>🧪 ${i18n.pick('Narzędzia Poligonu (Sandbox)', 'Sandbox Controls')}</h3>
          <div style="display:flex; gap:0.4rem; flex-wrap:wrap;">
            <button class="nav-btn ${session.economy.isUnlimitedGold() ? 'active' : ''}" data-action="sandbox-toggle-gold" data-testid="sandbox-toggle-gold">
              🪙 ∞ ${i18n.t('hud.gold')}
            </button>
            <button class="nav-btn ${session.economy.isUnlimitedEnergy() ? 'active' : ''}" data-action="sandbox-toggle-energy" data-testid="sandbox-toggle-energy">
              ⚡ ∞ ${i18n.t('hud.energy')}
            </button>
          </div>
          <div style="display:grid; grid-template-columns:repeat(2,1fr); gap:0.3rem;">
            ${enemyTypes
              .map(
                (eType) => `
              <button class="nav-btn" style="font-size:0.72rem; padding:0.25rem;" data-spawn-enemy="${eType}" data-testid="sandbox-spawn-${eType}">
                + ${escapeHtml(i18n.pick(ENEMIES_DATA[eType].namePl, ENEMIES_DATA[eType].nameEn))}
              </button>
            `
              )
              .join('')}
          </div>
        </div>
      `;
    }

    return `
      <div class="sidebar-panel" data-testid="tower-build-panel">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <h3 style="border:none; padding:0;">🏗️ ${i18n.t('tower.buildTitle')}</h3>
          <select id="pad-selector-dropdown" data-testid="pad-selector-dropdown" style="background:#090d16; border:1px solid #38bdf8; border-radius:6px; padding:0.18rem 0.38rem; font-size:0.74rem;">
            ${session.map.pads
              .map((pad) => {
                const occ = session.getTowers().find((t) => t.padIndex === pad.index);
                return `<option value="${pad.index}" ${selectedPad === pad.index ? 'selected' : ''}>
                  #${pad.index + 1} ${occ ? `(${escapeHtml(i18n.pick(TOWERS_DATA[occ.type].namePl, TOWERS_DATA[occ.type].nameEn))})` : `(${i18n.pick('Wolny', 'Empty')})`}
                </option>`;
              })
              .join('')}
          </select>
        </div>
        <div class="tower-shop-grid">
          ${towerButtonsHtml}
        </div>
      </div>
      ${inspectorHtml}
      ${sandboxControlsHtml}
    `;
  }

  public static buildSessionEndModalHtml(
    session: GameSessionEngine,
    lastOutcome: MissionOutcomeEvaluation | null,
    newlyUnlockedAchievements: AchievementDefinition[],
    i18n: LocalizationService
  ): string {
    const typing = session.typingEngine;
    const isVictory = lastOutcome?.victory ?? session.isVictory();
    const stars = lastOutcome?.stars ?? (isVictory ? 3 : 0);
    const nextMission = MISSIONS_DATA.find((m) => m.globalIndex === session.mission.globalIndex + 1);
    const keyObjectives = lastOutcome?.keyObjectives ?? session.getKeyObjectives();

    const keyObjSummaryHtml =
      keyObjectives.length > 0
        ? `<div style="background:#090d16; padding:0.65rem 0.85rem; border-radius:8px; font-size:0.8rem;">
            <div style="color:#94a3b8; margin-bottom:0.3rem; font-weight:700;">
              ⌨️ ${i18n.pick('Cele Edukacyjne Klawiszy:', 'Educational Key Objectives:')}
            </div>
            <div style="display:flex; gap:0.4rem; flex-wrap:wrap;">
              ${keyObjectives
                .map((o) => {
                  const lbl = o.key === ' ' ? 'Spacja' : o.key.toUpperCase();
                  return `<span class="key-obj-pill ${o.completed ? 'completed' : ''}">
                    <strong>${escapeHtml(lbl)}</strong>: ${o.correct}/${o.requiredCorrect} (${Math.round(o.accuracy * 100)}%) ${o.completed ? '✓' : '✗'}
                  </span>`;
                })
                .join('')}
            </div>
          </div>`
        : '';

    return `
      <div class="modal-overlay" data-testid="mission-results-modal">
        <div class="modal-card">
          <h2 style="font-size:1.55rem; color:${isVictory ? '#4ade80' : '#f43f5e'}; text-align:center;" data-testid="results-title">
            ${isVictory ? `🏆 ${i18n.t('mission.victory')}` : `💥 ${i18n.t('mission.defeat')}`}
          </h2>
          ${
            isVictory
              ? `<div style="font-size:1.85rem; text-align:center;" data-testid="results-stars">
                  ${'⭐'.repeat(stars)}${'☆'.repeat(3 - stars)}
                </div>`
              : `<p style="color:#fda4af; font-size:0.88rem; text-align:center;">
                  ${escapeHtml(i18n.pick(lastOutcome?.reasonPl ?? 'Spróbuj ponownie!', lastOutcome?.reasonEn ?? 'Try again!'))}
                </p>`
          }

          <div style="background:#090d16; padding:0.85rem; border-radius:10px; display:grid; grid-template-columns:repeat(2,1fr); gap:0.5rem; font-size:0.83rem;">
            <div>🎯 ${i18n.t('hud.accuracy')}: <strong>${Math.round(typing.getAccuracy() * 100)}%</strong></div>
            <div>⚡ ${i18n.pick('Tempo pisania:', 'Typing speed:')} <strong>${typing.getWpm()} WPM</strong></div>
            <div>⌨️ ${i18n.pick('Wpisane znaki:', 'Chars typed:')} <strong>${typing.getTotalCorrect()}</strong></div>
            <div>🔥 ${i18n.pick('Maks. Kombo:', 'Max Combo:')} <strong>${typing.getMaxCombo()}</strong></div>
            <div>⚔️ ${i18n.pick('Pokonani wrogowie:', 'Enemies defeated:')} <strong style="color:#4ade80;">${session.getEnemiesDefeatedCount()}</strong></div>
            <div>💥 ${i18n.pick('Zadane obrażenia:', 'Damage dealt:')} <strong style="color:#facc15;">${session.getTotalDamageDealt()}</strong></div>
            <div>✨ ${i18n.pick('Zdobyte XP:', 'XP Earned:')} <strong style="color:#38bdf8;">+${lastOutcome?.xpEarned ?? 50} XP</strong></div>
            <div>❤️ ${i18n.t('hud.lives')}: <strong>${session.getLives()}/${session.getMaxLives()}</strong></div>
          </div>

          ${keyObjSummaryHtml}

          ${
            newlyUnlockedAchievements.length > 0
              ? `<div style="background:rgba(250,204,21,0.15); border:1px solid #facc15; padding:0.6rem; border-radius:8px; font-size:0.81rem;">
                  🏅 ${i18n.pick('Nowe osiągnięcia:', 'New achievements:')} ${newlyUnlockedAchievements
                    .map((a) => `${a.icon} ${escapeHtml(i18n.pick(a.namePl.replace(/ \(.*\)$/, ''), a.nameEn))}`)
                    .join(', ')}
                </div>`
              : ''
          }

          <div style="display:flex; justify-content:space-between; align-items:center; gap:0.5rem; flex-wrap:nowrap;">
            <button class="nav-btn" data-action="modal-back-map" data-testid="results-back-map-btn">
              🗺️ ${i18n.t('nav.backToMap')}
            </button>
            <button class="nav-btn" data-action="modal-retry" data-testid="results-retry-btn">
              🔄 ${i18n.t('mission.retry')}
            </button>
            ${
              isVictory && nextMission && session.mode === 'campaign'
                ? `<button class="primary-cta-btn" style="padding:0.55rem 1.15rem; font-size:0.9rem;" data-action="modal-next-mission" data-next-id="${nextMission.id}" data-testid="results-next-mission-btn">
                    ▶ ${i18n.t('mission.nextMission')}
                  </button>`
                : ''
            }
          </div>
        </div>
      </div>
    `;
  }
}
