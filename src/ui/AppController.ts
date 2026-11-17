import { getMissionById, MISSIONS_DATA } from '../data/curriculumData';
import { LocalizationService } from '../i18n/LocalizationService';
import { BattlefieldRenderer } from '../rendering/BattlefieldRenderer';
import { AudioSystem } from '../services/AudioSystem';
import { PersistenceService } from '../services/PersistenceService';
import { AchievementSystem } from '../systems/AchievementSystem';
import { GameSessionEngine } from '../systems/GameSessionEngine';
import { MissionOutcomeEvaluation, ProgressionEngine } from '../systems/ProgressionEngine';
import { WaveSystem } from '../systems/WaveSystem';
import {
  AchievementDefinition,
  EnemyType,
  GameMode,
  ScreenId,
  TargetingPriority,
  TowerType,
  UpgradeBranch,
} from '../types';
import { escapeHtml } from '../utils/escapeHtml';
import { CampaignMapView } from './views/CampaignMapView';
import { DashboardViews } from './views/DashboardViews';
import { GameplayView } from './views/GameplayView';
import { MainMenuView } from './views/MainMenuView';

export class AppController {
  private container: HTMLElement;
  public readonly persistence: PersistenceService;
  public readonly i18n: LocalizationService;
  public readonly audio: AudioSystem;

  private currentScreen: ScreenId = 'main_menu';
  private selectedWorldId: number = 1;
  private activeSession: GameSessionEngine | null = null;
  private renderer: BattlefieldRenderer | null = null;
  private rafId: number | null = null;
  private lastFrameTime: number = 0;
  private sessionOutcomeProcessed: boolean = false;
  private lastFollowUpState: boolean = false;
  private lastOutcome: MissionOutcomeEvaluation | null = null;
  private newlyUnlockedAchievements: AchievementDefinition[] = [];
  private importStatusMessage: string = '';

  constructor(container: HTMLElement) {
    this.container = container;
    this.persistence = new PersistenceService();
    const profile = this.persistence.getActiveProfile();
    this.i18n = new LocalizationService(profile.settings.language);
    this.audio = new AudioSystem();
    this.audio.setVolumes(profile.settings.musicVolume, profile.settings.sfxVolume);

    this.bindGlobalKeyboardAndFocus();
    this.renderCurrentScreen();
  }

  public getActiveSession(): GameSessionEngine | null {
    return this.activeSession;
  }

  public navigateTo(screen: ScreenId): void {
    this.persistence.flushSave();
    if (screen !== 'gameplay') {
      this.stopGameLoop();
    }
    this.currentScreen = screen;
    this.renderCurrentScreen();
    if (typeof window !== 'undefined' && typeof window.scrollTo === 'function') {
      window.scrollTo(0, 0);
    }
  }

  public startMission(
    missionId: string,
    mode: GameMode = 'campaign',
    options: { unlimitedGold?: boolean; unlimitedEnergy?: boolean; customAllowedKeys?: string[] } = {}
  ): void {
    const profile = this.persistence.getActiveProfile();
    let mission = getMissionById(missionId) ?? MISSIONS_DATA[0];
    if (mode === 'campaign' && (!getMissionById(missionId) || !ProgressionEngine.isMissionUnlocked(mission, profile))) {
      return;
    }
    this.persistence.flushSave();
    this.stopGameLoop();

    if (mode === 'survival') {
      const unlockedKeysSet = new Set<string>(MISSIONS_DATA[0].allowedKeys);
      for (const m of MISSIONS_DATA) {
        if (profile.completedMissions[m.id]?.completed) {
          m.allowedKeys.forEach((k) => unlockedKeysSet.add(k));
        }
      }
      mission = {
        ...mission,
        id: 'survival_run',
        namePl: 'Tryb Przetrwania',
        nameEn: 'Survival Mode',
        allowedKeys: Array.from(unlockedKeysSet),
        newKeys: [],
        requiredTypedChars: 0,
        startingGold: 320,
        startingLives: 25,
        waves: [WaveSystem.generateSurvivalWave(1)],
      };
    } else if (mode === 'sandbox') {
      mission = {
        ...mission,
        id: 'sandbox_session',
        namePl: 'Poligon Taktyczny (Sandbox)',
        nameEn: 'Tactical Sandbox',
        allowedKeys: options.customAllowedKeys ?? mission.allowedKeys,
        newKeys: mission.newKeys.filter((key) => (options.customAllowedKeys ?? mission.allowedKeys).includes(key)),
        requiredTypedChars: 0,
        startingGold: 1500,
        startingLives: 99,
      };
    }

    this.activeSession = new GameSessionEngine({
      mode,
      mission,
      profile,
      unlimitedGold: options.unlimitedGold,
      unlimitedEnergy: options.unlimitedEnergy,
      initialGameSpeed: profile.settings.defaultGameSpeed,
    });

    this.activeSession.setSelectedPadIndex(0);
    this.sessionOutcomeProcessed = false;
    this.lastFollowUpState = false;
    this.lastOutcome = null;
    this.newlyUnlockedAchievements = [];
    this.currentScreen = 'gameplay';
    this.renderCurrentScreen();
    if (typeof window !== 'undefined' && typeof window.scrollTo === 'function') {
      window.scrollTo(0, 0);
    }
    this.startGameLoop();
  }

  private startGameLoop(): void {
    this.stopGameLoop();
    this.lastFrameTime = performance.now();
    const loop = (now: number) => {
      const dtSec = Math.min(0.1, Math.max(0.001, (now - this.lastFrameTime) / 1000));
      this.lastFrameTime = now;

      if (this.activeSession && this.currentScreen === 'gameplay') {
        const tick = this.activeSession.update(dtSec);
        for (const [tType, count] of Object.entries(tick.shotsFiredByType)) {
          if (count > 0) {
            this.audio.playTowerShot(tType as TowerType);
          }
        }

        if (this.renderer) {
          this.renderer.render(this.activeSession, this.persistence.getActiveProfile(), dtSec);
        }

        this.updateGameplayHudInPlace();
        if (tick.goldChanged || tick.waveCompleted) {
          this.updateSidebarAffordabilityInPlace();
        }

        const currentFollowUp = this.activeSession.isFollowUpPracticeActive();
        if (currentFollowUp !== this.lastFollowUpState) {
          this.lastFollowUpState = currentFollowUp;
          this.updateTypingConsoleInPlace();
        }

        if (this.activeSession.isSessionOver() && !this.sessionOutcomeProcessed) {
          this.handleSessionCompleted();
        }
      }

      this.rafId = requestAnimationFrame(loop);
    };
    this.rafId = requestAnimationFrame(loop);
  }

  private stopGameLoop(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  private handleSessionCompleted(): void {
    if (!this.activeSession || this.sessionOutcomeProcessed) return;
    this.sessionOutcomeProcessed = true;

    const session = this.activeSession;
    const profile = this.persistence.getActiveProfile();
    const typing = session.typingEngine;

    if (session.mode === 'sandbox') {
      this.renderSessionEndModal();
      return;
    }

    profile.totalPracticeTimeSec += typing.getActiveDurationSec();
    profile.bestCombo = Math.max(profile.bestCombo, typing.getMaxCombo());
    profile.bestWpm = Math.max(profile.bestWpm, typing.getWpm());

    profile.sessionHistory.push({
      timestamp: Date.now(),
      missionId: session.mission.id,
      mode: session.mode,
      wpm: typing.getWpm(),
      accuracy: typing.getAccuracy(),
      durationSec: typing.getActiveDurationSec(),
      charsTyped: typing.getTotalCorrect(),
      errors: typing.getTotalErrors(),
      maxCombo: typing.getMaxCombo(),
    });
    profile.sessionHistory = profile.sessionHistory.slice(-60);

    if (session.mode === 'campaign') {
      this.lastOutcome = ProgressionEngine.evaluateMissionResult(
        session.mission,
        profile,
        session.getLives(),
        session.getMaxLives(),
        typing.getTotalCorrect(),
        typing.getAccuracy(),
        typing.getWpm(),
        typing.getMaxCombo(),
        typing.getSessionKeyStats()
      );
      if (this.lastOutcome.victory) {
        this.audio.playVictory();
      } else {
        ProgressionEngine.awardXp(profile, this.lastOutcome.xpEarned);
      }
      this.newlyUnlockedAchievements = AchievementSystem.evaluateAndUnlock(profile, {
        missionWon: this.lastOutcome.victory,
        isBossMission: session.mission.isBossMission,
        remainingLives: session.getLives(),
        startingLives: session.getMaxLives(),
        typingAccuracy: typing.getAccuracy(),
        maxCombo: typing.getMaxCombo(),
        activeTowers: session.getTowers(),
      });
    } else if (session.mode === 'survival') {
      const waveReached = session.waveSystem.getCurrentWaveNumber();
      profile.survivalBestWave = Math.max(profile.survivalBestWave, waveReached);
      profile.survivalBestScore = Math.max(profile.survivalBestScore, session.getScore());
      this.newlyUnlockedAchievements = AchievementSystem.evaluateAndUnlock(profile, {
        survivalWaveReached: waveReached,
        maxCombo: typing.getMaxCombo(),
        activeTowers: session.getTowers(),
      });
    }

    this.persistence.saveToStorage();
    this.renderSessionEndModal();
  }

  private bindGlobalKeyboardAndFocus(): void {
    window.addEventListener('blur', () => {
      this.activeSession?.typingEngine.markIdleBreak();
      this.persistence.flushSave();
    });

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        this.activeSession?.typingEngine.markIdleBreak();
        this.persistence.flushSave();
      }
    });

    window.addEventListener('keydown', (e: KeyboardEvent) => {
      if (this.currentScreen !== 'gameplay' || !this.activeSession) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) {
        return;
      }

      if (e.key === 'Escape' && !this.activeSession.isSessionOver()) {
        this.activeSession.setPaused(!this.activeSession.getIsPaused());
        this.updateGameplayHudInPlace();
        return;
      }

      if (
        e.isComposing ||
        e.metaKey ||
        (e.ctrlKey && !e.getModifierState('AltGraph') && !e.altKey) ||
        (e.altKey && !e.getModifierState('AltGraph') && !e.ctrlKey) ||
        target?.isContentEditable
      ) {
        return;
      }

      if (this.activeSession.isSessionOver() || this.activeSession.getIsPaused()) {
        return;
      }

      if (e.key === ' ' || e.key === '/' || e.key === "'") {
        e.preventDefault();
      }

      const res = this.activeSession.handleKeyInput(e.key, Date.now(), e.repeat);
      if (!res.ignored) {
        const profile = this.persistence.getActiveProfile();
        if (this.activeSession.mode !== 'sandbox') {
          profile.totalCharsTyped += 1;
          if (res.isCorrect) profile.totalCorrectChars += 1;
          profile.bestCombo = Math.max(profile.bestCombo, res.maxCombo);
          profile.bestWpm = Math.max(profile.bestWpm, this.activeSession.typingEngine.getWpm());
          this.persistence.requestThrottledSave(2000);
        }

        this.audio.playKeystroke(res.isCorrect, res.combo);
        if (res.sequenceCompleted) {
          this.audio.playSequenceComplete();
        }
        this.updateTypingConsoleInPlace();
        this.updateGameplayHudInPlace();
        if (this.activeSession.isSessionOver() && !this.sessionOutcomeProcessed) {
          this.handleSessionCompleted();
        }
      }
    });
  }

  public renderCurrentScreen(): void {
    const profile = this.persistence.getActiveProfile();
    this.i18n.setLanguage(profile.settings.language);

    this.container.innerHTML = `
      <div class="app-shell ${this.currentScreen === 'gameplay' ? 'app-shell-gameplay' : ''}" data-screen="${this.currentScreen}">
        ${this.renderTopHeaderHtml()}
        <main id="screen-content">
          ${this.renderScreenBodyHtml()}
        </main>
        <div id="modal-container"></div>
      </div>
    `;

    this.attachScreenListeners();
  }

  private renderTopHeaderHtml(): string {
    const profile = this.persistence.getActiveProfile();
    const lang = this.i18n.getLanguage();
    const xpReq = ProgressionEngine.getRequiredXpForLevel(profile.level);

    return `
      <header class="top-header">
        <div class="brand-group" data-action="go-menu" data-testid="brand-home">
          <div class="brand-logo">🏰</div>
          <div>
            <div class="brand-title">${this.i18n.t('app.title')}</div>
            <div class="brand-tagline">${this.i18n.t('app.tagline')}</div>
          </div>
        </div>

        <nav class="top-nav-links">
          <button class="nav-btn ${this.currentScreen === 'main_menu' ? 'active' : ''}" data-nav="main_menu" data-testid="nav-menu">
            🏠 ${this.i18n.t('nav.backToMenu')}
          </button>
          <button class="nav-btn ${this.currentScreen === 'campaign_map' ? 'active' : ''}" data-nav="campaign_map" data-testid="nav-campaign">
            🗺️ ${this.i18n.t('menu.campaign')}
          </button>
          <button class="nav-btn ${this.currentScreen === 'survival_setup' ? 'active' : ''}" data-nav="survival_setup" data-testid="nav-survival">
            ♾️ ${this.i18n.t('menu.survival')}
          </button>
          <button class="nav-btn ${this.currentScreen === 'sandbox_setup' ? 'active' : ''}" data-nav="sandbox_setup" data-testid="nav-sandbox">
            🧪 ${this.i18n.t('menu.sandbox')}
          </button>
          <button class="nav-btn ${this.currentScreen === 'statistics' ? 'active' : ''}" data-nav="statistics" data-testid="nav-statistics">
            📊 ${this.i18n.t('menu.statistics')}
          </button>
          <button class="nav-btn ${this.currentScreen === 'achievements' ? 'active' : ''}" data-nav="achievements" data-testid="nav-achievements">
            🏆 ${this.i18n.t('menu.achievements')}
          </button>
          <button class="nav-btn ${this.currentScreen === 'settings' ? 'active' : ''}" data-nav="settings" data-testid="nav-settings">
            ⚙️ ${this.i18n.t('menu.settings')}
          </button>
        </nav>

        <div style="display:flex; align-items:center; gap:0.45rem;">
          <div class="profile-pill" data-nav="profiles" data-testid="nav-profiles">
            <span>${escapeHtml(profile.avatarIcon)}</span>
            <strong data-testid="active-profile-name">${escapeHtml(profile.name)}</strong>
            <span style="color:#38bdf8;">Lv ${profile.level} (${profile.xp}/${xpReq} XP)</span>
          </div>
          <button class="lang-toggle-btn" data-action="toggle-lang" data-testid="lang-toggle-btn">
            🌐 ${lang.toUpperCase()}
          </button>
        </div>
      </header>
    `;
  }

  private renderScreenBodyHtml(): string {
    const profile = this.persistence.getActiveProfile();
    switch (this.currentScreen) {
      case 'main_menu':
        return MainMenuView.renderHtml(profile, this.persistence.getAllProfiles().length, this.i18n);
      case 'campaign_map':
        return CampaignMapView.renderHtml(this.selectedWorldId, profile, this.i18n);
      case 'gameplay':
        return this.activeSession
          ? GameplayView.renderGameplayLayoutHtml(this.activeSession, profile, this.i18n)
          : '';
      case 'survival_setup':
        return DashboardViews.renderSurvivalSetupHtml(profile, this.i18n);
      case 'sandbox_setup':
        return DashboardViews.renderSandboxSetupHtml(this.i18n);
      case 'statistics':
        return DashboardViews.renderStatisticsHtml(profile, this.i18n);
      case 'achievements':
        return DashboardViews.renderAchievementsHtml(profile, this.i18n);
      case 'profiles':
        return DashboardViews.renderProfilesHtml(this.persistence, this.importStatusMessage, this.i18n);
      case 'settings':
        return DashboardViews.renderSettingsHtml(profile, this.i18n);
      default:
        return MainMenuView.renderHtml(profile, this.persistence.getAllProfiles().length, this.i18n);
    }
  }

  private renderSessionEndModal(): void {
    const modalContainer = document.getElementById('modal-container');
    if (!modalContainer || !this.activeSession) return;

    const session = this.activeSession;
    modalContainer.innerHTML = GameplayView.buildSessionEndModalHtml(
      session,
      this.lastOutcome,
      this.newlyUnlockedAchievements,
      this.i18n
    );

    modalContainer.querySelector('[data-action="modal-back-map"]')?.addEventListener('click', () => {
      this.navigateTo('campaign_map');
    });
    modalContainer.querySelector('[data-action="modal-retry"]')?.addEventListener('click', () => {
      this.startMission(session.mission.id, session.mode);
    });
    modalContainer.querySelector('[data-action="modal-next-mission"]')?.addEventListener('click', (e) => {
      const nextId = (e.currentTarget as HTMLElement).getAttribute('data-next-id');
      if (nextId) {
        this.startMission(nextId, 'campaign');
      }
    });
  }

  private updateGameplayHudInPlace(): void {
    const session = this.activeSession;
    if (!session) return;

    const livesEl = document.getElementById('hud-lives-value');
    if (!livesEl) {
      const hudContainer = document.getElementById('gameplay-hud-container');
      if (hudContainer) {
        hudContainer.innerHTML = GameplayView.buildGameplayHudHtml(
          session,
          this.persistence.getActiveProfile(),
          this.i18n
        );
        this.attachHudListeners(hudContainer);
      }
      return;
    }

    const economy = session.economy;
    const typing = session.typingEngine;
    const powerState = session.getPowerState();
    const energyPct = Math.min(100, Math.round((economy.getEnergy() / economy.getMaxEnergy()) * 100));
    const reqChars = session.getRequiredCharsForVictory();

    livesEl.textContent = `${session.getLives()}/${session.getMaxLives()}`;

    const goldEl = document.getElementById('hud-gold-value');
    if (goldEl) goldEl.textContent = `${economy.getGold()}`;

    const energyEl = document.getElementById('hud-energy-value');
    if (energyEl) energyEl.textContent = `${economy.getEnergy()}`;

    const energyMaxEl = document.getElementById('hud-energy-max');
    if (energyMaxEl) energyMaxEl.textContent = `${economy.getMaxEnergy()}`;

    const energyBarEl = document.getElementById('hud-energy-bar') as HTMLElement | null;
    if (energyBarEl) energyBarEl.style.width = `${energyPct}%`;

    const powerEl = document.getElementById('hud-power-state');
    if (powerEl) {
      powerEl.className = `power-badge ${powerState}`;
      const overSec = economy.getOverdriveRemainingSec();
      powerEl.textContent =
        overSec > 0
          ? `${this.i18n.t(`hud.powerState.${powerState}`)} (${overSec}s)`
          : this.i18n.t(`hud.powerState.${powerState}`);
    }

    const waveEl = document.getElementById('hud-wave-value');
    if (waveEl) {
      waveEl.textContent = `${session.waveSystem.getCurrentWaveNumber()}/${session.mode === 'survival' ? '∞' : session.mission.waves.length}`;
    }

    const goalEl = document.getElementById('hud-typing-goal-value') as HTMLElement | null;
    if (goalEl && reqChars > 0) {
      goalEl.textContent = `${typing.getTotalCorrect()}/${reqChars}`;
      goalEl.style.color = typing.getTotalCorrect() >= reqChars ? '#4ade80' : '#38bdf8';
    }

    const startWaveBtn = document.getElementById('hud-start-wave-btn') as HTMLButtonElement | null;
    if (startWaveBtn) {
      startWaveBtn.disabled = session.waveSystem.isWaveActive() || !session.waveSystem.hasMoreWaves();
    }

    const speedBtn = document.getElementById('hud-speed-btn');
    if (speedBtn) speedBtn.textContent = `⏩ ${session.getGameSpeed()}x`;

    const pauseBtn = document.getElementById('hud-pause-btn');
    if (pauseBtn) {
      pauseBtn.textContent = session.getIsPaused()
        ? `▶ ${this.i18n.t('hud.resume')}`
        : `⏸ ${this.i18n.t('hud.pause')}`;
    }

    const empBtn = document.getElementById('hud-ability-emp') as HTMLButtonElement | null;
    if (empBtn) {
      empBtn.disabled = !session.canUseAbility('emp');
      const cd = session.getAbilityCooldown('emp');
      empBtn.textContent = `🌩️ ${this.i18n.t('hud.ability.emp')}${cd > 0 ? ` (${cd}s)` : ''}`;
    }

    const overBtn = document.getElementById('hud-ability-overdrive') as HTMLButtonElement | null;
    if (overBtn) {
      overBtn.disabled = !session.canUseAbility('overdrive');
      const cd = session.getAbilityCooldown('overdrive');
      overBtn.textContent = `⚡ ${this.i18n.t('hud.ability.overdrive')}${cd > 0 ? ` (${cd}s)` : ''}`;
    }

    const orbBtn = document.getElementById('hud-ability-orbital') as HTMLButtonElement | null;
    if (orbBtn) {
      orbBtn.disabled = !session.canUseAbility('orbital');
      const cd = session.getAbilityCooldown('orbital');
      orbBtn.textContent = `☄️ ${this.i18n.t('hud.ability.orbital')}${cd > 0 ? ` (${cd}s)` : ''}`;
    }

    const comboEl = document.getElementById('hud-combo-value');
    if (comboEl) comboEl.textContent = `${typing.getCombo()}`;

    const accEl = document.getElementById('hud-accuracy-value');
    if (accEl) accEl.textContent = `${Math.round(typing.getAccuracy() * 100)}%`;

    const wpmEl = document.getElementById('hud-wpm-value');
    if (wpmEl) wpmEl.textContent = `${typing.getWpm()}`;
  }

  /**
   * Updates the `disabled` state of Tower Build and Tower Upgrade buttons in-place
   * whenever Gold changes during wave combat so buttons immediately enable as soon as affordable.
   */
  private updateSidebarAffordabilityInPlace(): void {
    const session = this.activeSession;
    const sidebar = document.getElementById('tactical-sidebar-container');
    if (!session || !sidebar) return;

    const currentGold = session.economy.getGold();
    const hasEmptyPad = session.map.pads.some(
      (p) => !session.getTowers().some((t) => t.padIndex === p.index)
    );

    sidebar.querySelectorAll<HTMLButtonElement>('[data-build-tower]').forEach((btn) => {
      const cost = Number(btn.getAttribute('data-tower-cost') ?? 9999);
      const unlocked = btn.getAttribute('data-tower-unlocked') === '1';
      btn.disabled = !(unlocked && hasEmptyPad && currentGold >= cost);
    });

    sidebar.querySelectorAll<HTMLButtonElement>('[data-upgrade-branch]').forEach((btn) => {
      const cost = Number(btn.getAttribute('data-upgrade-cost') ?? 9999);
      const locked = btn.getAttribute('data-upgrade-locked') === '1';
      btn.disabled = locked || currentGold < cost;
    });
  }

  private updateTypingConsoleInPlace(): void {
    const consoleContainer = document.getElementById('typing-console-container');
    if (consoleContainer && this.activeSession) {
      consoleContainer.innerHTML = GameplayView.buildTypingConsoleHtml(
        this.activeSession,
        this.persistence.getActiveProfile(),
        this.i18n
      );
    }
  }

  private updateSidebarInPlace(): void {
    const sidebar = document.getElementById('tactical-sidebar-container');
    if (sidebar && this.activeSession) {
      sidebar.innerHTML = GameplayView.buildTacticalSidebarHtml(
        this.activeSession,
        this.persistence.getActiveProfile(),
        this.i18n
      );
      this.attachSidebarListeners(sidebar);
    }
  }

  private attachHudListeners(root: HTMLElement): void {
    root.querySelector('[data-action="start-wave"]')?.addEventListener('click', () => {
      this.activeSession?.startNextWave();
      const hudContainer = document.getElementById('gameplay-hud-container');
      if (hudContainer && this.activeSession) {
        hudContainer.innerHTML = GameplayView.buildGameplayHudHtml(
          this.activeSession,
          this.persistence.getActiveProfile(),
          this.i18n
        );
        this.attachHudListeners(hudContainer);
      }
      this.updateTypingConsoleInPlace();
    });
    root.querySelector('[data-action="cycle-speed"]')?.addEventListener('click', () => {
      if (!this.activeSession) return;
      const cur = this.activeSession.getGameSpeed();
      const next = cur === 1 ? 1.5 : cur === 1.5 ? 2 : 1;
      this.activeSession.setGameSpeed(next);
      this.updateGameplayHudInPlace();
    });
    root.querySelector('[data-action="toggle-pause"]')?.addEventListener('click', () => {
      if (!this.activeSession) return;
      this.activeSession.setPaused(!this.activeSession.getIsPaused());
      this.updateGameplayHudInPlace();
    });
    root.querySelectorAll('[data-ability]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const ability = (e.currentTarget as HTMLElement).getAttribute('data-ability') as
          | 'emp'
          | 'overdrive'
          | 'orbital';
        if (this.activeSession?.triggerTacticalAbility(ability)) {
          this.updateGameplayHudInPlace();
        }
      });
    });
  }

  private attachSidebarListeners(root: HTMLElement): void {
    const padDropdown = root.querySelector('#pad-selector-dropdown') as HTMLSelectElement | null;
    padDropdown?.addEventListener('change', () => {
      const idx = Number(padDropdown.value);
      this.activeSession?.setSelectedPadIndex(idx);
      this.updateSidebarInPlace();
    });

    root.querySelectorAll('[data-build-tower]').forEach((btn) => {
      btn.addEventListener('mouseenter', (e) => {
        const type = (e.currentTarget as HTMLElement).getAttribute('data-build-tower') as TowerType;
        this.renderer?.setPreviewTowerType(type);
      });
      btn.addEventListener('mouseleave', () => {
        this.renderer?.setPreviewTowerType(null);
      });
      btn.addEventListener('click', (e) => {
        if (!this.activeSession) return;
        const type = (e.currentTarget as HTMLElement).getAttribute('data-build-tower') as TowerType;
        let padIndex = this.activeSession.getSelectedPadIndex();
        if (padIndex === null || this.activeSession.getTowers().some((t) => t.padIndex === padIndex)) {
          // Prefer central tactical bends (pads 1, 2, 3, 4) for first placement
          const preferredOrder = [1, 2, 3, 4, 5, 0, 6, 7, 8, 9, 10, 11];
          for (const candidateIdx of preferredOrder) {
            const padExists = this.activeSession.map.pads.some((p) => p.index === candidateIdx);
            const occupied = this.activeSession.getTowers().some((t) => t.padIndex === candidateIdx);
            if (padExists && !occupied) {
              padIndex = candidateIdx;
              break;
            }
          }
        }
        if (padIndex !== null) {
          const built = this.activeSession.buildTower(type, padIndex);
          if (built) {
            this.updateSidebarInPlace();
            this.updateGameplayHudInPlace();
            this.updateTypingConsoleInPlace();
          }
        }
      });
    });

    root.querySelectorAll('[data-upgrade-branch]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const branch = (e.currentTarget as HTMLElement).getAttribute('data-upgrade-branch') as UpgradeBranch;
        const selectedTower = this.activeSession?.getSelectedTower();
        if (selectedTower && this.activeSession?.upgradeTower(selectedTower.id, branch)) {
          if (this.activeSession.mode !== 'sandbox') {
            AchievementSystem.evaluateAndUnlock(this.persistence.getActiveProfile(), {
              activeTowers: this.activeSession.getTowers(),
            });
          }
          this.persistence.saveToStorage();
          this.updateSidebarInPlace();
          this.updateGameplayHudInPlace();
          this.updateTypingConsoleInPlace();
        }
      });
    });

    root.querySelector('[data-action="sell-tower"]')?.addEventListener('click', () => {
      const selectedTower = this.activeSession?.getSelectedTower();
      if (selectedTower && this.activeSession) {
        this.activeSession.sellTower(selectedTower.id);
        this.updateSidebarInPlace();
        this.updateGameplayHudInPlace();
      }
    });

    root.querySelectorAll('[data-target-priority]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const priority = (e.currentTarget as HTMLElement).getAttribute(
          'data-target-priority'
        ) as TargetingPriority;
        const selectedTower = this.activeSession?.getSelectedTower();
        if (selectedTower && this.activeSession) {
          this.activeSession.setTowerTargeting(selectedTower.id, priority);
          this.updateSidebarInPlace();
        }
      });
    });

    root.querySelector('[data-action="sandbox-toggle-gold"]')?.addEventListener('click', () => {
      if (!this.activeSession) return;
      this.activeSession.economy.setUnlimitedResources(
        !this.activeSession.economy.isUnlimitedGold(),
        this.activeSession.economy.isUnlimitedEnergy()
      );
      this.updateSidebarInPlace();
      this.updateGameplayHudInPlace();
    });
    root.querySelector('[data-action="sandbox-toggle-energy"]')?.addEventListener('click', () => {
      if (!this.activeSession) return;
      this.activeSession.economy.setUnlimitedResources(
        this.activeSession.economy.isUnlimitedGold(),
        !this.activeSession.economy.isUnlimitedEnergy()
      );
      this.updateSidebarInPlace();
      this.updateGameplayHudInPlace();
    });
    root.querySelectorAll('[data-spawn-enemy]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const eType = (e.currentTarget as HTMLElement).getAttribute('data-spawn-enemy') as EnemyType;
        this.activeSession?.spawnCustomEnemyInSandbox(eType, 1);
        this.updateGameplayHudInPlace();
      });
    });
  }

  private attachScreenListeners(): void {
    this.container.querySelector('[data-action="go-menu"]')?.addEventListener('click', () => {
      this.navigateTo('main_menu');
    });

    this.container.querySelectorAll('[data-nav]').forEach((el) => {
      el.addEventListener('click', (e) => {
        const screen = (e.currentTarget as HTMLElement).getAttribute('data-nav') as ScreenId;
        if (screen) this.navigateTo(screen);
      });
    });

    this.container.querySelector('[data-action="toggle-lang"]')?.addEventListener('click', () => {
      const profile = this.persistence.getActiveProfile();
      const nextLang = profile.settings.language === 'pl' ? 'en' : 'pl';
      profile.settings.language = nextLang;
      this.i18n.setLanguage(nextLang);
      this.persistence.saveToStorage();
      this.renderCurrentScreen();
    });

    this.container.querySelector('[data-action="quick-start-campaign"]')?.addEventListener('click', (e) => {
      const mId = (e.currentTarget as HTMLElement).getAttribute('data-mission-id') ?? 'w1_m1';
      this.startMission(mId, 'campaign');
    });

    this.container.querySelectorAll('[data-world-id]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        this.selectedWorldId = Number((e.currentTarget as HTMLElement).getAttribute('data-world-id'));
        this.renderCurrentScreen();
      });
    });

    this.container.querySelectorAll('[data-action="launch-mission"]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const mId = (e.currentTarget as HTMLElement).getAttribute('data-mission-id');
        if (mId) this.startMission(mId, 'campaign');
      });
    });

    if (this.currentScreen === 'gameplay' && this.activeSession) {
      const canvas = document.getElementById('battlefield-canvas') as HTMLCanvasElement | null;
      if (canvas) {
        this.renderer = new BattlefieldRenderer(canvas);
        this.renderer.render(this.activeSession, this.persistence.getActiveProfile(), 0.016);

        canvas.addEventListener('mousemove', (e) => {
          if (!this.activeSession || !this.renderer) return;
          const padIdx = this.renderer.getPadAtCanvasCoords(e.clientX, e.clientY, this.activeSession);
          this.renderer.setHoveredPad(padIdx);
        });

        canvas.addEventListener('click', (e) => {
          if (!this.activeSession || !this.renderer) return;
          const padIdx = this.renderer.getPadAtCanvasCoords(e.clientX, e.clientY, this.activeSession);
          if (padIdx !== null) {
            this.activeSession.setSelectedPadIndex(padIdx);
            this.updateSidebarInPlace();
          }
        });
      }

      const hudContainer = document.getElementById('gameplay-hud-container');
      if (hudContainer) this.attachHudListeners(hudContainer);

      const sidebar = document.getElementById('tactical-sidebar-container');
      if (sidebar) this.attachSidebarListeners(sidebar);
    }

    this.container.querySelectorAll('[data-action="start-survival"]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const mId = (e.currentTarget as HTMLElement).getAttribute('data-mission-id') ?? 'w1_m1';
        this.startMission(mId, 'survival');
      });
    });

    this.container.querySelector('[data-action="launch-sandbox"]')?.addEventListener('click', () => {
      const unlimGold =
        (document.getElementById('sandbox-opt-gold') as HTMLInputElement | null)?.checked ?? true;
      const unlimEnergy =
        (document.getElementById('sandbox-opt-energy') as HTMLInputElement | null)?.checked ?? true;
      const mId =
        (document.getElementById('sandbox-opt-mission') as HTMLSelectElement | null)?.value ?? 'w8_m6';
      this.startMission(mId, 'sandbox', { unlimitedGold: unlimGold, unlimitedEnergy: unlimEnergy });
    });

    this.container.querySelectorAll('[data-equip-cosmetic]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const id = (e.currentTarget as HTMLElement).getAttribute('data-equip-cosmetic')!;
        const cat = (e.currentTarget as HTMLElement).getAttribute('data-cosmetic-cat') as
          | 'tower_skin'
          | 'laser_color'
          | 'base_emblem';
        const profile = this.persistence.getActiveProfile();
        profile.equippedCosmetics[cat] = id;
        this.persistence.saveToStorage();
        this.renderCurrentScreen();
      });
    });

    this.container.querySelector('[data-action="create-profile"]')?.addEventListener('click', () => {
      const input = document.getElementById('new-profile-name-input') as HTMLInputElement | null;
      const name = input?.value.trim();
      if (name) {
        this.persistence.createProfile(name);
        this.renderCurrentScreen();
      }
    });

    this.container.querySelectorAll('[data-switch-profile]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const pId = (e.currentTarget as HTMLElement).getAttribute('data-switch-profile');
        if (pId) {
          this.persistence.switchProfile(pId);
          this.renderCurrentScreen();
        }
      });
    });

    this.container.querySelector('[data-action="import-save-json"]')?.addEventListener('click', () => {
      const area = document.getElementById('save-json-textarea') as HTMLTextAreaElement | null;
      if (!area) return;
      const res = this.persistence.importSaveJson(area.value);
      this.importStatusMessage = res.success
        ? this.i18n.pick('✓ Zapis zaimportowany pomyślnie!', '✓ Save data imported successfully!')
        : `❌ ${res.error}`;
      this.renderCurrentScreen();
    });

    this.container.querySelector('[data-action="reset-profile"]')?.addEventListener('click', () => {
      this.persistence.resetActiveProfile();
      this.renderCurrentScreen();
    });

    const langSel = document.getElementById('setting-language') as HTMLSelectElement | null;
    langSel?.addEventListener('change', () => {
      const profile = this.persistence.getActiveProfile();
      profile.settings.language = langSel.value === 'en' ? 'en' : 'pl';
      this.i18n.setLanguage(profile.settings.language);
      this.persistence.saveToStorage();
      this.renderCurrentScreen();
    });

    const diffSel = document.getElementById('setting-difficulty') as HTMLSelectElement | null;
    diffSel?.addEventListener('change', () => {
      const profile = this.persistence.getActiveProfile();
      profile.settings.difficulty = diffSel.value as 'relaxed' | 'standard' | 'tactical';
      this.persistence.saveToStorage();
    });

    const assistSel = document.getElementById('setting-assistance') as HTMLSelectElement | null;
    assistSel?.addEventListener('change', () => {
      const profile = this.persistence.getActiveProfile();
      profile.settings.typingAssistance = assistSel.value as 'full' | 'adaptive' | 'minimal';
      this.persistence.saveToStorage();
    });

    const textSel = document.getElementById('setting-textsize') as HTMLSelectElement | null;
    textSel?.addEventListener('change', () => {
      const profile = this.persistence.getActiveProfile();
      profile.settings.textSize = textSel.value as 'normal' | 'large' | 'xlarge';
      this.persistence.saveToStorage();
    });

    const sfxRange = document.getElementById('setting-sfx') as HTMLInputElement | null;
    sfxRange?.addEventListener('input', () => {
      const profile = this.persistence.getActiveProfile();
      profile.settings.sfxVolume = Number(sfxRange.value);
      this.audio.setVolumes(profile.settings.musicVolume, profile.settings.sfxVolume);
      this.persistence.saveToStorage();
    });

    const rmCheck = document.getElementById('setting-reduced-motion') as HTMLInputElement | null;
    rmCheck?.addEventListener('change', () => {
      const profile = this.persistence.getActiveProfile();
      profile.settings.reducedMotion = rmCheck.checked;
      this.persistence.saveToStorage();
    });
  }
}
