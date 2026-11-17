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
  TowerType,
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

        <aside class="tactical-sidebar" id="tactical-sidebar-container" data-testid="tactical-sidebar">
          ${GameplayView.buildTacticalSidebarHtml(session, profile, i18n)}
        </aside>
      </section>
    `;
  }

  public static buildWavePreviewInnerHtml(
    session: GameSessionEngine,
    i18n: LocalizationService
  ): string {
    const wavePreview = session.getUpcomingWavePreview();
    const isWaveActive = session.waveSystem.isWaveActive();
    const allCleared = session.areAllWavesCleared();

    if (allCleared) {
      return `
        <span class="wave-preview-label">✓ ${i18n.pick('Wszystkie fale odparte!', 'All waves cleared!')}</span>
      `;
    }

    const wavePreviewItemsHtml = wavePreview.items
      .map((item) => {
        const counterDef = TOWERS_DATA[item.counterTower];
        const counterName = i18n.pick(counterDef.namePl, counterDef.nameEn);
        const shortCounter = counterName.replace(/^Wieża\s+/i, '').replace(/\s+Tower$/i, '');
        return `
          <span class="wave-preview-chip" title="${escapeHtml(i18n.pick(item.traitPl, item.traitEn))} — ${escapeHtml(i18n.pick('Zalecana kontra:', 'Recommended counter:'))} ${escapeHtml(counterName)}">
            <span class="vk-dot" style="background:${item.color};"></span>
            <strong>${item.count}×</strong> ${escapeHtml(i18n.pick(item.namePl, item.nameEn))}
            <span class="wave-counter-tag">⚡${escapeHtml(shortCounter)}</span>
          </span>
        `;
      })
      .join('');

    const statusLabel = isWaveActive
      ? `${i18n.pick('Aktywna fala', 'Active wave')} #${wavePreview.waveNumber}:`
      : `${i18n.pick('Nadchodząca fala', 'Incoming wave')} #${wavePreview.waveNumber}:`;

    return `
      <span class="wave-preview-label">${escapeHtml(statusLabel)}</span>
      <div class="wave-preview-chips-track">${wavePreviewItemsHtml}</div>
    `;
  }

  public static formatPowerStateLabel(
    session: GameSessionEngine,
    i18n: LocalizationService
  ): string {
    const powerState = session.getPowerState();
    const overSec = session.economy.getOverdriveRemainingSec();
    let pct = '100%';
    if (powerState === 'baseline') pct = '55%';
    else if (powerState === 'overcharged') pct = '140%';
    const label = i18n.pick(`${pct} Mocy`, `${pct} Power`);
    if (overSec > 0) {
      return `${label} (${overSec.toFixed(0)}s)`;
    }
    return label;
  }

  public static buildGameplayHudHtml(
    session: GameSessionEngine,
    profile: PlayerProfile,
    i18n: LocalizationService
  ): string {
    const economy = session.economy;
    const typing = session.typingEngine;
    const powerState = session.getPowerState();
    const energyVal = economy.getEnergy().toFixed(1);
    const energyMax = economy.getMaxEnergy();
    const energyPct = Math.min(100, Math.round((economy.getEnergy() / energyMax) * 100));
    const reqChars = session.getRequiredCharsForVictory();
    const totalWavesLabel = session.mode === 'survival' ? '∞' : `${session.mission.waves.length}`;

    return `
      <div class="tactical-hud" data-testid="tactical-hud">
        <div class="hud-top-row">
          <div class="hud-stat hud-cell-lives" title="${escapeHtml(i18n.t('hud.lives'))}" data-testid="hud-lives">
            <span>❤️</span>
            <span style="color:#f43f5e;" id="hud-lives-value">${session.getLives()}/${session.getMaxLives()}</span>
          </div>

          <div class="hud-stat hud-cell-gold" title="${escapeHtml(i18n.t('hud.gold'))}" data-testid="hud-gold">
            <span>🪙</span>
            <span style="color:#facc15;" id="hud-gold-value">${economy.getGold()}</span>
          </div>

          <div class="energy-meter-wrap hud-cell-energy" data-testid="hud-energy" title="${escapeHtml(i18n.t('hud.energy'))}">
            <span class="energy-num-slot">⚡ <strong id="hud-energy-value">${energyVal}</strong>/<span id="hud-energy-max">${energyMax}</span></span>
            <div class="energy-bar-outer">
              <div class="energy-bar-inner" id="hud-energy-bar" style="width:${energyPct}%;"></div>
            </div>
            <span class="power-badge ${powerState}" id="hud-power-state" data-testid="hud-power-state">
              ${escapeHtml(GameplayView.formatPowerStateLabel(session, i18n))}
            </span>
          </div>

          <div class="hud-stat hud-cell-wave" data-testid="hud-wave" title="${escapeHtml(i18n.t('hud.wave'))}">
            <span>🌊</span>
            <span id="hud-wave-value">${session.waveSystem.getCurrentWaveNumber()}/${totalWavesLabel}</span>
          </div>

          <div class="hud-stat hud-cell-goal" data-testid="hud-typing-goal" title="${escapeHtml(i18n.t('console.progress'))}">
            <span>⌨️</span>
            <span id="hud-typing-goal-value" style="color:${reqChars > 0 && typing.getTotalCorrect() >= reqChars ? '#4ade80' : '#38bdf8'};">
              ${reqChars > 0 ? `${typing.getTotalCorrect()}/${reqChars}` : `${typing.getTotalCorrect()}`}
            </span>
          </div>

          <div class="hud-stat hud-mini-stat" data-testid="hud-accuracy" title="${escapeHtml(i18n.t('hud.accuracy'))}">
            <span>🎯</span>
            <span id="hud-accuracy-value">${Math.round(typing.getAccuracy() * 100)}%</span>
          </div>

          <div class="hud-stat hud-mini-stat" data-testid="hud-combo" title="${escapeHtml(i18n.t('hud.combo'))}">
            <span>🔥</span>
            <span id="hud-combo-value">${typing.getCombo()}</span>
          </div>

          <div class="hud-stat hud-mini-stat" data-testid="hud-wpm" title="${escapeHtml(i18n.t('hud.wpm'))}" style="${profile.settings.showWpmStat ? '' : 'display:none;'}">
            <span>⚡</span>
            <span id="hud-wpm-value">${typing.getWpm()}</span>
          </div>
        </div>
      </div>
    `;
  }

  public static buildTypingConsoleHtml(
    session: GameSessionEngine,
    profile: PlayerProfile,
    i18n: LocalizationService,
    now: number = Date.now()
  ): string {
    const typing = session.typingEngine;
    const prompt = typing.getCurrentPrompt();
    const entered = typing.getEnteredText();
    const expected = typing.getExpectedChar() ?? '';
    const remaining = typing.getRemainingText();
    const wrongKey = typing.getLastWrongKey(now);

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

    const displayExpected = expected === ' ' ? '␣' : expected || '✓';

    const keyObjectives = session.getKeyObjectives();
    const keyObjHtml =
      keyObjectives.length > 0
        ? `<div class="key-objectives-bar" data-testid="key-objectives-bar">
            <span style="font-size:0.71rem; color:#94a3b8;">${i18n.pick('Cele klawiszy:', 'Key goals:')}</span>
            ${keyObjectives
              .map((obj) => {
                const label = obj.key === ' ' ? '␣' : obj.key.toUpperCase();
                return `<span class="key-obj-pill ${obj.completed ? 'completed' : ''}" data-testid="key-obj-${escapeHtml(obj.key)}">
                  <strong>${escapeHtml(label)}</strong>:${obj.correct}/${obj.requiredCorrect}${obj.completed ? '✓' : ''}
                </span>`;
              })
              .join('')}
          </div>`
        : '';

    let guidanceSlotInnerHtml = '';
    if (session.isFollowUpPracticeActive()) {
      guidanceSlotInnerHtml = `
        <div class="followup-banner" data-testid="followup-practice-banner">
          ⚔️ <strong>${i18n.pick('Fale obronione!', 'Waves cleared!')}</strong>
          ${i18n.pick(
            'Dokończ krótkie ćwiczenie docelowych klawiszy poniżej, aby zaliczyć lekcję bez powtarzania bitwy!',
            'Complete the short follow-up key drill below to finish the lesson without replaying the battle!'
          )}
        </div>
      `;
    } else {
      const onboardingHtml = OnboardingView.renderContextualHintHtml(session, i18n);
      if (onboardingHtml) {
        guidanceSlotInnerHtml = onboardingHtml;
      } else {
        guidanceSlotInnerHtml = `
          <div class="onboarding-banner" style="border-left: 4px solid #38bdf8;">
            <span class="onboarding-step-badge" style="background:rgba(56,189,248,0.18); color:#38bdf8; border:1px solid #38bdf8;">
              ⚡ ${i18n.pick('WSKAZÓWKA', 'TACTICAL TIP')}
            </span>
            <span class="onboarding-text">
              ${escapeHtml(i18n.pick(session.mission.lessonIntroPl, session.mission.lessonIntroEn))}
            </span>
          </div>
        `;
      }
    }

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
        <div class="console-guidance-slot">
          ${guidanceSlotInnerHtml}
        </div>

        <div class="console-header">
          <div style="display:flex; align-items:center; gap:0.45rem; flex-wrap:nowrap; overflow:hidden;">
            <strong>⌨️ ${i18n.t('console.title')}</strong>
            <span class="mode-badge ${isDrill ? 'drill' : 'word'}" data-testid="console-exercise-badge">
              ${badgeLabel}
            </span>
            ${keyObjHtml}
          </div>
          <div style="color:#94a3b8; font-size:0.74rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
            ${escapeHtml(i18n.pick(session.mission.namePl, session.mission.nameEn))}
          </div>
        </div>

        <div class="console-sequence-box ${sizeClass} ${wrongKey ? 'sequence-box-error' : ''}" data-testid="console-sequence-box" data-expected-char="${escapeHtml(expected)}">
          <span class="char-done" data-testid="console-entered">${escapeHtml(entered)}</span><span class="char-current ${wrongKey ? 'char-error' : ''}" data-testid="console-expected" data-has-error="${wrongKey ? '1' : '0'}">${escapeHtml(displayExpected)}</span><span class="char-pending" data-testid="console-remaining">${escapeHtml(remaining)}</span>
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
    const empCd = session.getAbilityCooldown('emp');
    const overCd = session.getAbilityCooldown('overdrive');
    const orbCd = session.getAbilityCooldown('orbital');

    const TOWER_SHORT_META: Record<TowerType, { icon: string; shortPl: string; shortEn: string }> = {
      gun: { icon: '🔫', shortPl: 'CKM', shortEn: 'Gun' },
      cannon: { icon: '💣', shortPl: 'Działo', shortEn: 'Cannon' },
      frost: { icon: '❄️', shortPl: 'Mróz', shortEn: 'Frost' },
      tesla: { icon: '⚡', shortPl: 'Tesla', shortEn: 'Tesla' },
      sniper: { icon: '🎯', shortPl: 'Snajper', shortEn: 'Sniper' },
      reactor: { icon: '⚛️', shortPl: 'Reaktor', shortEn: 'Reactor' },
    };

    const towerButtonsHtml = TOWER_ORDER.map((type) => {
      const def = TOWERS_DATA[type];
      const meta = TOWER_SHORT_META[type];
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
          title="${escapeHtml(i18n.pick(def.namePl, def.nameEn))} (${def.cost} 🪙) — ${escapeHtml(i18n.pick(def.rolePl, def.roleEn))}. ${escapeHtml(i18n.pick(def.descPl, def.descEn))}"
          ${canBuild ? '' : 'disabled'}
          style="border-left: 3px solid ${def.color};"
        >
          <div style="display:flex; align-items:center; gap:0.35rem; width:100%;">
            <span style="font-size:1.15rem; flex-shrink:0;">${meta.icon}</span>
            <div style="display:flex; flex-direction:column; min-width:0; flex:1;">
              <div style="font-weight:800; font-size:0.75rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                ${escapeHtml(i18n.pick(meta.shortPl, meta.shortEn))}
              </div>
              <div style="font-size:0.65rem; color:#facc15; font-weight:700;">${def.cost} 🪙</div>
            </div>
            ${!isUnlocked ? `<span style="font-size:0.6rem; color:#94a3b8; flex-shrink:0;">🔒Św.${def.unlockWorld}</span>` : ''}
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
            style="padding:0.18rem 0.35rem; font-size:0.68rem;"
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
              statDeltaBadge = `<span style="color:#4ade80; font-size:0.68rem;">(${stats.damage}→${nextDmg})</span>`;
            } else if (nextUpg.effects.fireRateMultiplier) {
              const nextSpd = (stats.fireRate * nextUpg.effects.fireRateMultiplier).toFixed(2);
              statDeltaBadge = `<span style="color:#38bdf8; font-size:0.68rem;">(${stats.fireRate}→${nextSpd}/s)</span>`;
            }
          }

          return `
            <div class="upgrade-branch-card" data-testid="upgrade-card-${branch}">
              <div style="display:flex; justify-content:space-between; font-size:0.72rem; font-weight:700;">
                <span>${i18n.t(`tower.branch.${branch}`)} (T${currentTier}/3) ${statDeltaBadge}</span>
                <span style="color:#facc15;">${'★'.repeat(currentTier)}${'☆'.repeat(3 - currentTier)}</span>
              </div>
              ${
                nextUpg
                  ? `<div style="font-size:0.68rem; color:#cbd5e1; line-height:1.25;">
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
                  : `<div style="font-size:0.7rem; color:#4ade80; font-weight:700;">✓ ${i18n.t('tower.maxTier')}</div>`
              }
            </div>
          `;
        })
        .join('');

      inspectorHtml = `
        <div class="sidebar-panel" data-testid="tower-inspector-panel">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <h3 style="border:none; padding:0; color:${def.color}; font-size:0.84rem;">
              ${escapeHtml(i18n.pick(def.namePl, def.nameEn))} (#${selectedTower.padIndex + 1})
            </h3>
            <button class="nav-btn" style="border-color:#f43f5e; color:#fda4af; padding:0.16rem 0.44rem; font-size:0.68rem;" data-action="sell-tower" data-testid="sell-tower-btn">
              💰 ${i18n.t('tower.sell')} (+${sellValue} 🪙)
            </button>
          </div>

          <div style="display:grid; grid-template-columns:repeat(3,1fr); gap:0.2rem; font-size:0.68rem; background:#090d16; padding:0.28rem 0.38rem; border-radius:6px; white-space:nowrap;">
            <div>⚔️ <strong>${stats.damage}</strong></div>
            <div>⚡ <strong>${stats.fireRate}/s</strong></div>
            <div>🎯 <strong>${stats.range}</strong></div>
          </div>

          <div style="display:flex; align-items:center; justify-content:space-between; gap:0.2rem; flex-wrap:nowrap;">
            <span style="font-size:0.68rem; color:#94a3b8;">${i18n.t('tower.targeting')}:</span>
            <div style="display:flex; gap:0.16rem; flex-wrap:nowrap;">${priorityBtns}</div>
          </div>

          <div style="display:flex; flex-direction:column; gap:0.28rem;">
            ${branchesHtml}
          </div>
        </div>
      `;
    } else {
      inspectorHtml = `
        <div class="sidebar-panel" style="padding:0.45rem 0.6rem;">
          <h3 style="font-size:0.78rem;">ℹ️ ${i18n.t('tower.upgradeTitle')}</h3>
          <p style="font-size:0.72rem; color:#94a3b8; line-height:1.3;">
            ${
              selectedPad !== null
                ? `${i18n.pick('Wybrany postument:', 'Selected pad:')} #${selectedPad + 1}. ${i18n.pick('Wybierz wieżę, aby ją zbudować.', 'Click a tower to build it here.')}`
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
          <h3 style="font-size:0.8rem;">🧪 ${i18n.pick('Narzędzia Poligonu (Sandbox)', 'Sandbox Controls')}</h3>
          <div style="display:flex; gap:0.3rem; flex-wrap:wrap;">
            <button class="nav-btn ${session.economy.isUnlimitedGold() ? 'active' : ''}" style="font-size:0.7rem; padding:0.2rem 0.4rem;" data-action="sandbox-toggle-gold" data-testid="sandbox-toggle-gold">
              🪙 ∞ ${i18n.t('hud.gold')}
            </button>
            <button class="nav-btn ${session.economy.isUnlimitedEnergy() ? 'active' : ''}" style="font-size:0.7rem; padding:0.2rem 0.4rem;" data-action="sandbox-toggle-energy" data-testid="sandbox-toggle-energy">
              ⚡ ∞ ${i18n.t('hud.energy')}
            </button>
          </div>
          <div style="display:grid; grid-template-columns:repeat(2,1fr); gap:0.24rem;">
            ${enemyTypes
              .map(
                (eType) => `
              <button class="nav-btn" style="font-size:0.68rem; padding:0.2rem 0.35rem;" data-spawn-enemy="${eType}" data-testid="sandbox-spawn-${eType}">
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
      <div class="sidebar-panel" style="padding:0.42rem 0.55rem; gap:0.35rem;">
        <div class="hud-controls" style="display:grid; grid-template-columns:minmax(0,1fr) 46px 72px; gap:4px; height:26px;">
          <button
            class="wave-start-btn"
            id="hud-start-wave-btn"
            data-action="start-wave"
            data-testid="start-wave-btn"
            title="${escapeHtml(i18n.t('hud.startWave'))}"
            ${session.waveSystem.isWaveActive() || !session.waveSystem.hasMoreWaves() ? 'disabled' : ''}
          >
            ▶ ${i18n.pick('Start Fali', 'Start Wave')}
          </button>
          <button class="nav-btn hud-fixed-speed-btn" id="hud-speed-btn" data-action="cycle-speed" data-testid="speed-btn" title="${escapeHtml(i18n.t('hud.speed'))}">
            ${session.getGameSpeed()}x
          </button>
          <button class="nav-btn hud-fixed-pause-btn" id="hud-pause-btn" data-action="toggle-pause" data-testid="pause-btn">
            ${session.getIsPaused() ? `▶ ${i18n.t('hud.resume')}` : `⏸ ${i18n.t('hud.pause')}`}
          </button>
        </div>

        <div class="ability-bar" style="display:grid; grid-template-columns:repeat(3, 1fr); gap:4px; height:24px;">
          <button
            class="ability-btn"
            id="hud-ability-emp"
            data-ability="emp"
            data-testid="ability-emp"
            title="${escapeHtml(i18n.t('hud.ability.emp'))} — ${escapeHtml(i18n.pick('Niszczy 65% tarcz, ujawnia Duchy i ogłusza wrogów na 1.8 s (wymaga aktywnych wrogów)', 'Strips 65% shields, reveals Ghosts, and stuns enemies for 1.8s (requires active enemies)'))}"
            ${session.canUseAbility('emp') ? '' : 'disabled'}
          >
            <span class="ability-btn-label">🌩️ EMP</span>
            <span class="ability-btn-meta" id="hud-ability-emp-meta">${empCd > 0 ? `${empCd}s` : '35⚡'}</span>
          </button>
          <button
            class="ability-btn"
            id="hud-ability-overdrive"
            data-ability="overdrive"
            data-testid="ability-overdrive"
            title="${escapeHtml(i18n.t('hud.ability.overdrive'))} — ${escapeHtml(i18n.pick('Wymusza Przeciążenie Bojowe (140% szybkostrzelności wież) przez 8 s', 'Forces Combat Overcharge (140% tower output) for 8s'))}"
            ${session.canUseAbility('overdrive') ? '' : 'disabled'}
          >
            <span class="ability-btn-label">⚡ ${i18n.pick('Moc+', 'Boost')}</span>
            <span class="ability-btn-meta" id="hud-ability-overdrive-meta">${overCd > 0 ? `${overCd}s` : '45⚡'}</span>
          </button>
          <button
            class="ability-btn"
            id="hud-ability-orbital"
            data-ability="orbital"
            data-testid="ability-orbital"
            title="${escapeHtml(i18n.t('hud.ability.orbital'))} — ${escapeHtml(i18n.pick('Uderza wszystkich wrogów na mapie za 165 obrażeń przebijających pancerz (wymaga aktywnych wrogów)', 'Strikes all active enemies for 165 armor-piercing damage (requires active enemies)'))}"
            ${session.canUseAbility('orbital') ? '' : 'disabled'}
          >
            <span class="ability-btn-label">☄️ Orbit</span>
            <span class="ability-btn-meta" id="hud-ability-orbital-meta">${orbCd > 0 ? `${orbCd}s` : '65⚡'}</span>
          </button>
        </div>
      </div>

      <div class="sidebar-panel" data-testid="tower-build-panel" style="padding:0.42rem 0.55rem; gap:0.32rem;">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <h3 style="border:none; padding:0; font-size:0.8rem;">🏗️ ${i18n.t('tower.buildTitle')}</h3>
          <select id="pad-selector-dropdown" data-testid="pad-selector-dropdown" style="background:#090d16; border:1px solid #38bdf8; border-radius:5px; padding:0.12rem 0.3rem; font-size:0.7rem;">
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

      <div class="sidebar-panel" style="padding:0.35rem 0.55rem; gap:0.25rem;">
        <div class="wave-preview-bar" id="hud-wave-preview-bar" data-testid="wave-preview-bar">
          ${GameplayView.buildWavePreviewInnerHtml(session, i18n)}
        </div>
      </div>

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

    const hasAttempts = typing.getTotalAttempts() > 0;
    const accLabel = hasAttempts ? `${Math.round(typing.getAccuracy() * 100)}%` : '—';

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
            <div>🎯 ${i18n.t('hud.accuracy')}: <strong>${accLabel}</strong></div>
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
