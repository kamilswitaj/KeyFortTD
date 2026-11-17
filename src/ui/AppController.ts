import { ACHIEVEMENTS_DATA, COSMETICS_DATA } from '../data/achievementsData';
import { getMissionById, getMissionsByWorld, MISSIONS_DATA, WORLDS_DATA } from '../data/curriculumData';
import { ENEMIES_DATA } from '../data/enemiesData';
import { POLISH_QWERTY_KEYS } from '../data/keyboardData';
import { MAPS_DATA } from '../data/mapsData';
import { TOWER_ORDER, TOWERS_DATA } from '../data/towersData';
import { LocalizationService } from '../i18n/LocalizationService';
import { BattlefieldRenderer } from '../rendering/BattlefieldRenderer';
import { AudioSystem } from '../services/AudioSystem';
import { PersistenceService } from '../services/PersistenceService';
import { AchievementSystem } from '../systems/AchievementSystem';
import { GameSessionEngine } from '../systems/GameSessionEngine';
import { MasteryEngine } from '../systems/MasteryEngine';
import { MissionOutcomeEvaluation, ProgressionEngine } from '../systems/ProgressionEngine';
import { TowerSystem } from '../systems/TowerSystem';
import { WaveSystem } from '../systems/WaveSystem';
import {
  AchievementDefinition,
  EnemyType,
  GameMode,
  MissionDefinition,
  ScreenId,
  TargetingPriority,
  TowerType,
  UpgradeBranch,
} from '../types';
import { VirtualKeyboardView } from './VirtualKeyboardView';
import { escapeHtml } from '../utils/escapeHtml';

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

    this.bindGlobalKeyboard();
    this.renderCurrentScreen();
  }

  public getActiveSession(): GameSessionEngine | null {
    return this.activeSession;
  }

  public navigateTo(screen: ScreenId): void {
    if (screen !== 'gameplay') {
      this.stopGameLoop();
    }
    this.currentScreen = screen;
    this.renderCurrentScreen();
  }

  public startMission(
    missionId: string,
    mode: GameMode = 'campaign',
    options: { unlimitedGold?: boolean; unlimitedEnergy?: boolean; customAllowedKeys?: string[] } = {}
  ): void {
    const profile = this.persistence.getActiveProfile();
    let mission = getMissionById(missionId) ?? MISSIONS_DATA[0];
    if (mode === 'campaign' && (!getMissionById(missionId) || !ProgressionEngine.isMissionUnlocked(mission, profile))) return;
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

    // Auto-select Pad 0 for instant convenience
    this.activeSession.setSelectedPadIndex(0);
    this.sessionOutcomeProcessed = false;
    this.lastOutcome = null;
    this.newlyUnlockedAchievements = [];
    this.currentScreen = 'gameplay';
    this.renderCurrentScreen();
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

    // Update lifetime typing stats
    profile.totalPracticeTimeSec += Math.max(5, typing.getActiveDurationSec());
    profile.bestCombo = Math.max(profile.bestCombo, typing.getMaxCombo());
    profile.bestWpm = Math.max(profile.bestWpm, typing.getWpm());

    profile.sessionHistory.push({
      timestamp: Date.now(),
      missionId: session.mission.id,
      mode: session.mode,
      wpm: typing.getWpm(),
      accuracy: typing.getAccuracy(),
      durationSec: Math.max(5, typing.getActiveDurationSec()),
      charsTyped: typing.getTotalCorrect(),
      errors: typing.getTotalErrors(),
      maxCombo: typing.getMaxCombo(),
    });

    if (session.mode === 'campaign') {
      this.lastOutcome = ProgressionEngine.evaluateMissionResult(
        session.mission,
        profile,
        session.getLives(),
        session.getMaxLives(),
        typing.getTotalCorrect(),
        typing.getAccuracy(),
        typing.getWpm(),
        typing.getMaxCombo()
      );
      if (this.lastOutcome.victory) {
        this.audio.playVictory();
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

  private bindGlobalKeyboard(): void {
    window.addEventListener('keydown', (e: KeyboardEvent) => {
      if (this.currentScreen !== 'gameplay' || !this.activeSession) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) {
        return;
      }

      if (e.isComposing || e.metaKey || (e.ctrlKey && !e.getModifierState('AltGraph') && !e.altKey) ||
          (e.altKey && !e.getModifierState('AltGraph') && !e.ctrlKey) || target?.isContentEditable) {
        return;
      }

      if (this.activeSession.isSessionOver() || this.activeSession.getIsPaused()) {
        return;
      }

      // Suppress native button activation/page scrolling only during active typing.
      if (e.key === ' ' || e.key === '/' || e.key === "'") e.preventDefault();

      const res = this.activeSession.handleKeyInput(e.key, Date.now(), e.repeat);
      if (!res.ignored) {
        const profile = this.persistence.getActiveProfile();
        profile.totalCharsTyped += 1;
        if (res.isCorrect) {
          profile.totalCorrectChars += 1;
        }
        profile.bestCombo = Math.max(profile.bestCombo, res.maxCombo);
        profile.bestWpm = Math.max(profile.bestWpm, this.activeSession.typingEngine.getWpm());

        this.audio.playKeystroke(res.isCorrect, res.combo);
        if (res.sequenceCompleted) {
          this.audio.playSequenceComplete();
        }
        this.persistence.saveToStorage();
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
      <div class="app-shell" data-screen="${this.currentScreen}">
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

        <div style="display:flex; align-items:center; gap:0.5rem;">
          <div class="profile-pill" data-nav="profiles" data-testid="nav-profiles">
            <span>${escapeHtml(profile.avatarIcon)}</span>
            <strong data-testid="active-profile-name">${escapeHtml(profile.name)}</strong>
            <span style="color:#38bdf8;">Poz./Lv ${profile.level} (${profile.xp}/${xpReq} XP)</span>
          </div>
          <button class="lang-toggle-btn" data-action="toggle-lang" data-testid="lang-toggle-btn">
            🌐 ${lang.toUpperCase()}
          </button>
        </div>
      </header>
    `;
  }

  private renderScreenBodyHtml(): string {
    switch (this.currentScreen) {
      case 'main_menu':
        return this.renderMainMenuHtml();
      case 'campaign_map':
        return this.renderCampaignMapHtml();
      case 'gameplay':
        return this.renderGameplayHtml();
      case 'survival_setup':
        return this.renderSurvivalSetupHtml();
      case 'sandbox_setup':
        return this.renderSandboxSetupHtml();
      case 'statistics':
        return this.renderStatisticsHtml();
      case 'achievements':
        return this.renderAchievementsHtml();
      case 'profiles':
        return this.renderProfilesHtml();
      case 'settings':
        return this.renderSettingsHtml();
      default:
        return this.renderMainMenuHtml();
    }
  }

  private renderMainMenuHtml(): string {
    const profile = this.persistence.getActiveProfile();
    const completedCount = Object.values(profile.completedMissions).filter((m) => m.completed).length;
    const nextMission =
      MISSIONS_DATA.find((m) => !profile.completedMissions[m.id]?.completed) ?? MISSIONS_DATA[0];

    return `
      <section class="menu-screen" data-testid="main-menu-screen">
        <div class="hero-banner">
          <div class="hero-text">
            <h1>${this.i18n.t('app.title')} — ${this.i18n.t('app.tagline')}</h1>
            <p>${this.i18n.t('app.subtitle')}</p>
            <div class="hero-cta-group">
              <button class="primary-cta-btn" data-action="quick-start-campaign" data-mission-id="${nextMission.id}" data-testid="quick-start-campaign-btn">
                ⚔️ ${this.i18n.pick('Graj Teraz:', 'Play Now:')} ${this.i18n.pick(nextMission.namePl, nextMission.nameEn)}
              </button>
              <button class="nav-btn" data-nav="campaign_map" data-testid="open-campaign-map-btn" style="padding:0.75rem 1.25rem; font-size:0.95rem;">
                🗺️ ${this.i18n.t('menu.campaign')} (${completedCount}/48)
              </button>
            </div>
          </div>
          <div style="background:rgba(15,23,42,0.85); border:1px solid rgba(56,189,248,0.35); border-radius:12px; padding:1rem 1.35rem; min-width:250px;">
            <div style="font-size:0.8rem; color:#94a3b8;">${this.i18n.pick('Status Obrońcy', 'Defender Status')}</div>
            <div style="font-size:1.25rem; font-weight:800; margin:0.25rem 0;">${escapeHtml(profile.avatarIcon)} ${escapeHtml(profile.name)}</div>
            <div style="font-size:0.85rem; color:#38bdf8;">
              ${this.i18n.pick('Ukończone misje:', 'Completed missions:')} <strong>${completedCount} / 48</strong>
            </div>
            <div style="font-size:0.85rem; color:#4ade80; margin-top:0.2rem;">
              ${this.i18n.pick('Opanowane klawisze:', 'Mastered keys:')} <strong>${MasteryEngine.getMasteredCharacters(profile.characterMastery).length}</strong>
            </div>
            <div style="font-size:0.85rem; color:#facc15; margin-top:0.2rem;">
              ${this.i18n.pick('Najwyższe kombo:', 'Best combo:')} <strong>${profile.bestCombo} 🔥</strong>
            </div>
          </div>
        </div>

        <div class="menu-cards-grid">
          <div class="menu-card" data-nav="campaign_map" data-testid="card-campaign">
            <div>
              <h3>🗺️ ${this.i18n.t('menu.campaign')}</h3>
              <p style="margin-top:0.4rem;">${this.i18n.t('menu.campaignDesc')}</p>
            </div>
            <span style="color:#38bdf8; font-weight:700; font-size:0.85rem;">→ 8 ${this.i18n.pick('Światów / 48 Misji', 'Worlds / 48 Missions')}</span>
          </div>

          <div class="menu-card" data-nav="survival_setup" data-testid="card-survival">
            <div>
              <h3>♾️ ${this.i18n.t('menu.survival')}</h3>
              <p style="margin-top:0.4rem;">${this.i18n.t('menu.survivalDesc')}</p>
            </div>
            <span style="color:#4ade80; font-weight:700; font-size:0.85rem;">
              ${this.i18n.pick('Rekord fali:', 'Best wave:')} ${profile.survivalBestWave}
            </span>
          </div>

          <div class="menu-card" data-nav="sandbox_setup" data-testid="card-sandbox">
            <div>
              <h3>🧪 ${this.i18n.t('menu.sandbox')}</h3>
              <p style="margin-top:0.4rem;">${this.i18n.t('menu.sandboxDesc')}</p>
            </div>
            <span style="color:#facc15; font-weight:700; font-size:0.85rem;">→ ${this.i18n.pick('Pełna swoboda eksperymentów', 'Full tactical freedom')}</span>
          </div>

          <div class="menu-card" data-nav="statistics" data-testid="card-statistics">
            <div>
              <h3>📊 ${this.i18n.t('menu.statistics')}</h3>
              <p style="margin-top:0.4rem;">${this.i18n.pick('Mapa cieplna klawiatury, wykresy WPM i celności oraz przegląd dla rodzica.', 'Keyboard mastery heatmap, WPM/accuracy history, and parent overview.')}</p>
            </div>
            <span style="color:#c084fc; font-weight:700; font-size:0.85rem;">→ ${this.i18n.pick('Analiza postępów', 'View Analytics')}</span>
          </div>

          <div class="menu-card" data-nav="achievements" data-testid="card-achievements">
            <div>
              <h3>🏆 ${this.i18n.t('menu.achievements')}</h3>
              <p style="margin-top:0.4rem;">${this.i18n.pick('Odblokuj osiągnięcia taktyczne oraz skórki wież i kolory wiązek laserowych.', 'Unlock tactical achievements, tower skins, and laser colors.')}</p>
            </div>
            <span style="color:#fb923c; font-weight:700; font-size:0.85rem;">
              ${profile.achievements.length} / ${ACHIEVEMENTS_DATA.length} ${this.i18n.pick('odblokowanych', 'unlocked')}
            </span>
          </div>

          <div class="menu-card" data-nav="profiles" data-testid="card-profiles">
            <div>
              <h3>👥 ${this.i18n.t('menu.profiles')}</h3>
              <p style="margin-top:0.4rem;">${this.i18n.pick('Osobne profile lokalne dla rodzeństwa i rodziny oraz eksport/import JSON.', 'Separate local family profiles plus JSON save export & import.')}</p>
            </div>
            <span style="color:#38bdf8; font-weight:700; font-size:0.85rem;">→ ${(() => {
              const cnt = this.persistence.getAllProfiles().length;
              if (this.i18n.getLanguage() === 'en') return `${cnt} ${cnt === 1 ? 'profile' : 'profiles'}`;
              return `${cnt} ${cnt === 1 ? 'profil' : cnt >= 2 && cnt <= 4 ? 'profile' : 'profili'}`;
            })()}</span>
          </div>
        </div>
      </section>
    `;
  }

  private renderCampaignMapHtml(): string {
    const profile = this.persistence.getActiveProfile();
    const currentWorld = WORLDS_DATA.find((w) => w.id === this.selectedWorldId) ?? WORLDS_DATA[0];
    const worldMissions = getMissionsByWorld(currentWorld.id);

    const worldTabsHtml = WORLDS_DATA.map((w) => {
      const mList = getMissionsByWorld(w.id);
      const done = mList.filter((m) => profile.completedMissions[m.id]?.completed).length;
      const isSelected = w.id === currentWorld.id;
      return `
        <button class="world-tab ${isSelected ? 'active' : ''}" data-world-id="${w.id}" data-testid="world-tab-${w.id}">
          <div class="world-tab-title">${w.id}. ${this.i18n.pick(w.namePl, w.nameEn)}</div>
          <div class="world-tab-sub">${done}/6 ⭐ | ${this.i18n.pick(w.focusPl, w.focusEn).slice(0, 28)}...</div>
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
                .map((k) => `<span class="key-chip">${k === ' ' ? 'Spacja' : k}</span>`)
                .join('')
            : `<span style="font-size:0.8rem; color:#94a3b8;">${this.i18n.pick('Konsolidacja poznanych klawiszy', 'Key consolidation')}</span>`;

        return `
          <div class="mission-card ${unlocked ? 'unlocked' : 'locked'} ${m.isBossMission ? 'boss-mission' : ''}" data-testid="mission-card-${m.id}">
            <div>
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.35rem;">
                <span style="font-size:0.78rem; font-weight:800; color:${m.isBossMission ? '#fda4af' : '#38bdf8'};">
                  ${this.i18n.pick('MISJA', 'MISSION')} ${m.worldId}.${m.missionIndex} (#${m.globalIndex}) ${m.isBossMission ? '👑 BOSS' : ''}
                </span>
                <span style="font-size:0.9rem;">${starsStr}</span>
              </div>
              <h3 style="font-size:1.05rem; margin-bottom:0.2rem;">${this.i18n.pick(m.namePl, m.nameEn)}</h3>
              <div style="font-size:0.8rem; color:#cbd5e1; margin-bottom:0.5rem;">${this.i18n.pick(m.subtitlePl, m.subtitleEn)}</div>
              <p style="font-size:0.8rem; color:#94a3b8; line-height:1.4; margin-bottom:0.65rem;">
                ${this.i18n.pick(m.lessonIntroPl, m.lessonIntroEn)}
              </p>
              <div style="margin-bottom:0.4rem;">
                <span style="font-size:0.75rem; color:#94a3b8; display:block; margin-bottom:0.2rem;">${this.i18n.t('mission.newKeys')}:</span>
                ${newKeysChips}
              </div>
              <div style="font-size:0.76rem; color:#94a3b8;">
                ${this.i18n.t('mission.targetChars')}: <strong>${m.requiredTypedChars}</strong> |
                ${this.i18n.t('mission.targetAcc')}: <strong>${Math.round(m.targetAccuracy * 100)}%</strong> |
                ${this.i18n.pick('Fale:', 'Waves:')} <strong>${m.waves.length}</strong>
              </div>
            </div>

            <div style="display:flex; justify-content:space-between; align-items:center; margin-top:0.5rem;">
              <span style="font-size:0.75rem; color:#4ade80;">
                ${rec?.completed ? `✓ ${Math.round(rec.bestAccuracy * 100)}% | ${rec.bestWpm} WPM` : ''}
              </span>
              <button
                class="primary-cta-btn"
                style="padding:0.45rem 1rem; font-size:0.85rem;"
                data-action="launch-mission"
                data-mission-id="${m.id}"
                data-testid="launch-mission-${m.id}"
                ${unlocked ? '' : 'disabled'}
              >
                ${unlocked ? `▶ ${this.i18n.t('mission.start')}` : `🔒 ${this.i18n.t('mission.locked')}`}
              </button>
            </div>
          </div>
        `;
      })
      .join('');

    return `
      <section data-testid="campaign-map-screen">
        <div class="worlds-tabs">${worldTabsHtml}</div>
        <div class="world-header-banner" style="border-left: 5px solid ${currentWorld.primaryColor};">
          <div>
            <h2 style="font-size:1.35rem;">${currentWorld.id}. ${this.i18n.pick(currentWorld.namePl, currentWorld.nameEn)}</h2>
            <div style="color:#38bdf8; font-weight:600; font-size:0.9rem; margin:0.2rem 0;">
              🎯 ${this.i18n.pick(currentWorld.focusPl, currentWorld.focusEn)}
            </div>
            <p style="color:#94a3b8; font-size:0.86rem; max-width:780px;">
              ${this.i18n.pick(currentWorld.descriptionPl, currentWorld.descriptionEn)}
            </p>
          </div>
          <div style="text-align:right; font-size:0.85rem;">
            <div>👑 Boss: <strong style="color:#fda4af;">${this.i18n.pick(currentWorld.bossNamePl, currentWorld.bossNameEn)}</strong></div>
            ${
              currentWorld.unlockedTower
                ? `<div style="margin-top:0.25rem; color:#facc15;">🏗️ ${this.i18n.pick('Wieża świata:', 'World Tower:')} <strong>${this.i18n.pick(TOWERS_DATA[currentWorld.unlockedTower].namePl, TOWERS_DATA[currentWorld.unlockedTower].nameEn)}</strong></div>`
                : ''
            }
          </div>
        </div>
        <div class="missions-grid">${missionsHtml}</div>
      </section>
    `;
  }

  private renderGameplayHtml(): string {
    const session = this.activeSession;
    if (!session) return '';

    return `
      <section class="gameplay-layout" data-testid="gameplay-screen">
        <div class="battlefield-column">
          <div id="gameplay-hud-container">
            ${this.buildGameplayHudHtml()}
          </div>

          <div class="canvas-container">
            <canvas id="battlefield-canvas" width="930" height="480" data-testid="battlefield-canvas"></canvas>
          </div>

          <div id="typing-console-container">
            ${this.buildTypingConsoleHtml()}
          </div>
        </div>

        <aside class="tactical-sidebar" id="tactical-sidebar-container">
          ${this.buildTacticalSidebarHtml()}
        </aside>
      </section>
    `;
  }

  private buildGameplayHudHtml(): string {
    const session = this.activeSession;
    if (!session) return '';
    const economy = session.economy;
    const typing = session.typingEngine;
    const powerState = session.getPowerState();
    const energyPct = Math.min(100, Math.round((economy.getEnergy() / economy.getMaxEnergy()) * 100));
    const reqChars = session.getRequiredCharsForVictory();

    return `
      <div class="tactical-hud">
        <div class="hud-metrics">
          <div class="hud-stat" title="Base HP" data-testid="hud-lives">
            ❤️ ${this.i18n.t('hud.lives')}: <span style="color:#f43f5e;" id="hud-lives-value">${session.getLives()}/${session.getMaxLives()}</span>
          </div>
          <div class="hud-stat" title="Gold" data-testid="hud-gold">
            🪙 ${this.i18n.t('hud.gold')}: <span style="color:#facc15;" id="hud-gold-value">${economy.getGold()}</span>
          </div>
          <div class="energy-meter-wrap" data-testid="hud-energy">
            <span>⚡ ${this.i18n.t('hud.energy')}: <strong id="hud-energy-value">${economy.getEnergy()}</strong>/<span id="hud-energy-max">${economy.getMaxEnergy()}</span></span>
            <div class="energy-bar-outer">
              <div class="energy-bar-inner" id="hud-energy-bar" style="width:${energyPct}%;"></div>
            </div>
            <span class="power-badge ${powerState}" id="hud-power-state" data-testid="hud-power-state">
              ${this.i18n.t(`hud.powerState.${powerState}`)}
            </span>
          </div>
          <div class="hud-stat" data-testid="hud-wave">
            🌊 ${this.i18n.t('hud.wave')}: <span id="hud-wave-value">${session.waveSystem.getCurrentWaveNumber()}/${session.mode === 'survival' ? '∞' : session.mission.waves.length}</span>
          </div>
          ${
            reqChars > 0
              ? `<div class="hud-stat" data-testid="hud-typing-goal">
                  ⌨️ ${this.i18n.t('console.progress')}: <span id="hud-typing-goal-value" style="color:${typing.getTotalCorrect() >= reqChars ? '#4ade80' : '#38bdf8'};">${typing.getTotalCorrect()}/${reqChars}</span>
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
            ▶ ${this.i18n.t('hud.startWave')}
          </button>
          <button class="nav-btn" id="hud-speed-btn" data-action="cycle-speed" data-testid="speed-btn">
            ⏩ ${session.getGameSpeed()}x
          </button>
          <button class="nav-btn" id="hud-pause-btn" data-action="toggle-pause" data-testid="pause-btn">
            ${session.getIsPaused() ? `▶ ${this.i18n.t('hud.resume')}` : `⏸ ${this.i18n.t('hud.pause')}`}
          </button>
        </div>

        <div class="ability-bar" style="width:100%; justify-content:space-between; padding-top:0.25rem; border-top:1px solid rgba(148,163,184,0.12);">
          <div style="display:flex; gap:0.4rem; flex-wrap:wrap;">
            <button class="ability-btn" id="hud-ability-emp" data-ability="emp" data-testid="ability-emp" ${economy.getEnergy() < 35 ? 'disabled' : ''}>
              🌩️ ${this.i18n.t('hud.ability.emp')}
            </button>
            <button class="ability-btn" id="hud-ability-overdrive" data-ability="overdrive" data-testid="ability-overdrive" ${economy.getEnergy() < 45 ? 'disabled' : ''}>
              ⚡ ${this.i18n.t('hud.ability.overdrive')}
            </button>
            <button class="ability-btn" id="hud-ability-orbital" data-ability="orbital" data-testid="ability-orbital" ${economy.getEnergy() < 65 ? 'disabled' : ''}>
              ☄️ ${this.i18n.t('hud.ability.orbital')}
            </button>
          </div>
          <div style="display:flex; gap:0.85rem; font-size:0.8rem; align-items:center;">
            <span data-testid="hud-combo">🔥 ${this.i18n.t('hud.combo')}: <strong id="hud-combo-value">${typing.getCombo()}</strong></span>
            <span data-testid="hud-accuracy">🎯 ${this.i18n.t('hud.accuracy')}: <strong id="hud-accuracy-value">${Math.round(typing.getAccuracy() * 100)}%</strong></span>
            ${
              this.persistence.getActiveProfile().settings.showWpmStat
                ? `<span data-testid="hud-wpm">⚡ WPM: <strong id="hud-wpm-value">${typing.getWpm()}</strong></span>`
                : ''
            }
          </div>
        </div>
      </div>
    `;
  }

  private buildTypingConsoleHtml(): string {
    const session = this.activeSession;
    if (!session) return '';
    const profile = this.persistence.getActiveProfile();
    const typing = session.typingEngine;
    const prompt = typing.getCurrentPrompt();
    const entered = typing.getEnteredText();
    const expected = typing.getExpectedChar() ?? '';
    const remaining = typing.getRemainingText();
    const wrongKey = typing.getLastWrongKey();

    const isDrill = prompt?.isDrill ?? true;
    const badgeLabel = isDrill
      ? this.i18n.t('console.mode.drill')
      : prompt?.category === 'sentences'
      ? this.i18n.t('console.mode.sentence')
      : this.i18n.t('console.mode.word');

    const sizeClass =
      profile.settings.textSize === 'xlarge'
        ? 'text-xlarge'
        : profile.settings.textSize === 'large'
        ? 'text-large'
        : '';

    const displayExpected = expected === ' ' ? '␣' : expected;

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
        <div class="console-header">
          <div style="display:flex; align-items:center; gap:0.5rem;">
            <strong>⌨️ ${this.i18n.t('console.title')}</strong>
            <span class="mode-badge ${isDrill ? 'drill' : 'word'}" data-testid="console-exercise-badge">
              ${badgeLabel}
            </span>
          </div>
          <div style="color:#94a3b8;">
            ${this.i18n.pick(session.mission.namePl, session.mission.nameEn)}
          </div>
        </div>

        <div class="console-sequence-box ${sizeClass}" data-testid="console-sequence-box" data-expected-char="${escapeHtml(expected)}">
          <span class="char-done" data-testid="console-entered">${escapeHtml(entered)}</span><span class="char-current ${wrongKey ? 'char-error' : ''}" data-testid="console-expected">${escapeHtml(displayExpected)}${wrongKey ? '!' : ''}</span><span class="char-pending" data-testid="console-remaining">${escapeHtml(remaining)}</span>
        </div>

        ${vkHtml}
      </div>
    `;
  }

  private buildTacticalSidebarHtml(): string {
    const session = this.activeSession;
    if (!session) return '';
    const profile = this.persistence.getActiveProfile();
    const selectedPad = session.getSelectedPadIndex();
    const selectedTower = session.getSelectedTower();

    const towerButtonsHtml = TOWER_ORDER.map((type) => {
      const def = TOWERS_DATA[type];
      const isUnlocked = session.mode !== 'campaign' || profile.unlockedTowers.includes(type);
      const canAfford = session.economy.getGold() >= def.cost;
      const canBuild = isUnlocked && canAfford && selectedPad !== null && !selectedTower;

      return `
        <button
          class="tower-shop-btn"
          data-build-tower="${type}"
          data-testid="build-tower-${type}"
          ${canBuild ? '' : !isUnlocked ? 'disabled' : ''}
          style="border-left: 4px solid ${def.color};"
        >
          <div style="display:flex; justify-content:space-between; align-items:center; gap:0.25rem; width:100%; font-weight:800; font-size:0.82rem;">
            <span>${this.i18n.pick(def.namePl, def.nameEn)}</span>
            <span style="color:#facc15; white-space:nowrap; flex-shrink:0;">${def.cost} 🪙</span>
          </div>
          <div style="font-size:0.72rem; color:#94a3b8;">
            ${isUnlocked ? this.i18n.pick(def.rolePl, def.roleEn) : `🔒 ${this.i18n.pick('Świat', 'World')} ${def.unlockWorld}`}
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
            style="padding:0.25rem 0.45rem; font-size:0.74rem;"
            data-target-priority="${p}"
            data-testid="target-priority-${p}"
          >
            ${this.i18n.t(`tower.target.${p}`)}
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
          const canBuy =
            nextUpg && !isLockedByCampaign && session.economy.getGold() >= nextUpg.cost;

          return `
            <div class="upgrade-branch-card" data-testid="upgrade-card-${branch}">
              <div style="display:flex; justify-content:space-between; font-size:0.78rem; font-weight:700;">
                <span>${this.i18n.t(`tower.branch.${branch}`)} (T${currentTier}/3)</span>
                <span style="color:#facc15;">${'★'.repeat(currentTier)}${'☆'.repeat(3 - currentTier)}</span>
              </div>
              ${
                nextUpg
                  ? `<div style="font-size:0.74rem; color:#cbd5e1;">
                      <strong>${this.i18n.pick(nextUpg.namePl, nextUpg.nameEn)}</strong>: ${this.i18n.pick(nextUpg.descPl, nextUpg.descEn)}
                    </div>
                    <button
                      class="upgrade-btn"
                      data-upgrade-branch="${branch}"
                      data-testid="upgrade-btn-${branch}"
                      ${canBuy ? '' : 'disabled'}
                    >
                      ${
                        isLockedByCampaign
                          ? `🔒 ${this.i18n.pick('Odblokuj w wyższym świecie', 'Unlock in later world')}`
                          : `⬆️ ${this.i18n.pick('Ulepsz', 'Upgrade')} (${nextUpg.cost}🪙)`
                      }
                    </button>`
                  : `<div style="font-size:0.75rem; color:#4ade80; font-weight:700;">✓ ${this.i18n.t('tower.maxTier')}</div>`
              }
            </div>
          `;
        })
        .join('');

      inspectorHtml = `
        <div class="sidebar-panel" data-testid="tower-inspector-panel">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <h3 style="border:none; padding:0; color:${def.color};">
              ${this.i18n.pick(def.namePl, def.nameEn)} (#${selectedTower.padIndex + 1})
            </h3>
            <button class="nav-btn" style="border-color:#f43f5e; color:#fda4af; padding:0.25rem 0.55rem; font-size:0.75rem;" data-action="sell-tower" data-testid="sell-tower-btn">
              💰 ${this.i18n.t('tower.sell')} (+${sellValue}🪙)
            </button>
          </div>

          <div style="display:grid; grid-template-columns:repeat(3,1fr); gap:0.35rem; font-size:0.75rem; background:#090d16; padding:0.45rem; border-radius:6px;">
            <div>⚔️ Obr/Dmg: <strong>${stats.damage}</strong></div>
            <div>⚡ Szybk/Spd: <strong>${stats.fireRate}/s</strong></div>
            <div>🎯 Zasięg: <strong>${stats.range}</strong></div>
          </div>

          <div>
            <div style="font-size:0.74rem; color:#94a3b8; margin-bottom:0.25rem;">${this.i18n.t('tower.targeting')}:</div>
            <div style="display:flex; gap:0.25rem; flex-wrap:wrap;">${priorityBtns}</div>
          </div>

          <div style="display:flex; flex-direction:column; gap:0.45rem;">
            ${branchesHtml}
          </div>
        </div>
      `;
    } else {
      inspectorHtml = `
        <div class="sidebar-panel">
          <h3>ℹ️ ${this.i18n.t('tower.upgradeTitle')}</h3>
          <p style="font-size:0.8rem; color:#94a3b8;">
            ${
              selectedPad !== null
                ? `${this.i18n.pick('Wybrany postument:', 'Selected pad:')} #${selectedPad + 1}. ${this.i18n.pick('Wybierz wieżę powyżej, aby ją zbudować.', 'Click a tower above to build it here.')}`
                : this.i18n.t('tower.selectPadPrompt')
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
          <h3>🧪 ${this.i18n.pick('Narzędzia Poligonu (Sandbox)', 'Sandbox Controls')}</h3>
          <div style="display:flex; gap:0.4rem; flex-wrap:wrap;">
            <button class="nav-btn ${session.economy.isUnlimitedGold() ? 'active' : ''}" data-action="sandbox-toggle-gold" data-testid="sandbox-toggle-gold">
              🪙 ∞ ${this.i18n.t('hud.gold')}
            </button>
            <button class="nav-btn ${session.economy.isUnlimitedEnergy() ? 'active' : ''}" data-action="sandbox-toggle-energy" data-testid="sandbox-toggle-energy">
              ⚡ ∞ ${this.i18n.t('hud.energy')}
            </button>
          </div>
          <div style="font-size:0.75rem; color:#94a3b8;">${this.i18n.pick('Przywołaj jednostkę wroga:', 'Spawn enemy unit:')}</div>
          <div style="display:grid; grid-template-columns:repeat(2,1fr); gap:0.35rem;">
            ${enemyTypes
              .map(
                (eType) => `
              <button class="nav-btn" style="font-size:0.74rem; padding:0.3rem;" data-spawn-enemy="${eType}" data-testid="sandbox-spawn-${eType}">
                + ${this.i18n.pick(ENEMIES_DATA[eType].namePl, ENEMIES_DATA[eType].nameEn)}
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
          <h3 style="border:none; padding:0;">🏗️ ${this.i18n.t('tower.buildTitle')}</h3>
          <select id="pad-selector-dropdown" data-testid="pad-selector-dropdown" style="background:#090d16; border:1px solid #38bdf8; border-radius:6px; padding:0.2rem 0.4rem; font-size:0.76rem;">
            ${session.map.pads
              .map((pad) => {
                const occ = session.getTowers().find((t) => t.padIndex === pad.index);
                return `<option value="${pad.index}" ${selectedPad === pad.index ? 'selected' : ''}>
                  Postument #${pad.index + 1} ${occ ? `(${this.i18n.pick(TOWERS_DATA[occ.type].namePl, TOWERS_DATA[occ.type].nameEn)})` : `(${this.i18n.pick('Wolny', 'Empty')})`}
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

  private renderSurvivalSetupHtml(): string {
    const profile = this.persistence.getActiveProfile();
    const mapEntries = Object.values(MAPS_DATA);

    return `
      <section class="sidebar-panel" style="max-width:760px; margin:1rem auto; padding:1.5rem;" data-testid="survival-setup-screen">
        <h2 style="font-size:1.5rem;">♾️ ${this.i18n.t('menu.survival')}</h2>
        <p style="color:#94a3b8; font-size:0.92rem;">${this.i18n.t('menu.survivalDesc')}</p>
        <div style="display:flex; gap:1.5rem; margin:0.75rem 0; background:#090d16; padding:1rem; border-radius:10px;">
          <div>🏆 ${this.i18n.pick('Najlepsza fala:', 'Personal Best Wave:')} <strong style="color:#4ade80; font-size:1.2rem;">${profile.survivalBestWave}</strong></div>
          <div>⭐ ${this.i18n.pick('Rekord punktów:', 'Best Score:')} <strong style="color:#facc15; font-size:1.2rem;">${profile.survivalBestScore}</strong></div>
        </div>

        <label style="font-size:0.88rem; font-weight:700;">${this.i18n.pick('Wybierz Mapę:', 'Select Map:')}</label>
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:0.6rem; margin-top:0.4rem;">
          ${mapEntries
            .slice(0, 8)
            .map(
              (m, idx) => `
            <button class="primary-cta-btn" style="padding:0.65rem; font-size:0.85rem;" data-action="start-survival" data-mission-id="w${idx + 1}_m1" data-testid="start-survival-btn-${idx + 1}">
              ▶ ${this.i18n.pick(m.namePl, m.nameEn)}
            </button>
          `
            )
            .join('')}
        </div>
      </section>
    `;
  }

  private renderSandboxSetupHtml(): string {
    return `
      <section class="sidebar-panel" style="max-width:760px; margin:1rem auto; padding:1.5rem;" data-testid="sandbox-setup-screen">
        <h2 style="font-size:1.5rem;">🧪 ${this.i18n.t('menu.sandbox')}</h2>
        <p style="color:#94a3b8; font-size:0.92rem;">${this.i18n.t('menu.sandboxDesc')}</p>
        <div style="display:flex; flex-direction:column; gap:0.8rem; margin:1rem 0; background:#090d16; padding:1rem; border-radius:10px;">
          <label style="display:flex; align-items:center; gap:0.6rem; cursor:pointer;">
            <input type="checkbox" id="sandbox-opt-gold" checked />
            <span>🪙 ${this.i18n.pick('Nielimitowane Złoto (Unlimited Gold)', 'Unlimited Gold')}</span>
          </label>
          <label style="display:flex; align-items:center; gap:0.6rem; cursor:pointer;">
            <input type="checkbox" id="sandbox-opt-energy" checked />
            <span>⚡ ${this.i18n.pick('Nielimitowana Energia (Unlimited Energy)', 'Unlimited Energy')}</span>
          </label>
          <label style="display:flex; flex-direction:column; gap:0.35rem;">
            <span>${this.i18n.pick('Zakres klawiszy w konsoli:', 'Typing Console Key Scope:')}</span>
            <select id="sandbox-opt-mission" style="background:#1e293b; border:1px solid #38bdf8; padding:0.45rem; border-radius:6px;">
              ${WORLDS_DATA.map(
                (w) =>
                  `<option value="w${w.id}_m6">${w.id}. ${this.i18n.pick(w.namePl, w.nameEn)} (${this.i18n.pick(w.focusPl, w.focusEn)})</option>`
              ).join('')}
            </select>
          </label>
        </div>
        <button class="primary-cta-btn" data-action="launch-sandbox" data-testid="launch-sandbox-btn">
          🚀 ${this.i18n.pick('Uruchom Poligon Taktyczny', 'Launch Tactical Sandbox')}
        </button>
      </section>
    `;
  }

  private renderStatisticsHtml(): string {
    const profile = this.persistence.getActiveProfile();
    const overallAcc =
      profile.totalCharsTyped > 0
        ? Math.round((profile.totalCorrectChars / profile.totalCharsTyped) * 100)
        : 100;
    const practiceMinutes = Math.max(1, Math.round(profile.totalPracticeTimeSec / 60));
    const masteredList = MasteryEngine.getMasteredCharacters(profile.characterMastery);
    const allAllowed = MISSIONS_DATA[MISSIONS_DATA.length - 1].allowedKeys;
    const problematicList = MasteryEngine.getProblematicCharacters(profile.characterMastery, allAllowed);
    const completedMissionsCount = Object.values(profile.completedMissions).filter((m) => m.completed).length;

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
      <section style="display:flex; flex-direction:column; gap:1rem;" data-testid="statistics-screen">
        <div class="sidebar-panel">
          <h2 style="font-size:1.35rem;">📊 ${this.i18n.t('stats.title')}</h2>
          <p style="color:#94a3b8; font-size:0.88rem;">
            <strong>👨‍👩‍👦 ${this.i18n.t('stats.parentOverview')}:</strong>
            ${this.i18n.pick(
              `Gracz ${escapeHtml(profile.name)} ukończył ${completedMissionsCount}/48 misji edukacyjnych, ćwiczył łącznie przez ok. ${practiceMinutes} min i wpisał poprawnie ${profile.totalCorrectChars} znaków ze średnią celnością ${overallAcc}%.`,
              `Player ${escapeHtml(profile.name)} has completed ${completedMissionsCount}/48 educational missions, practiced for ${practiceMinutes} min, and typed ${profile.totalCorrectChars} correct characters with ${overallAcc}% accuracy.`
            )}
          </p>
        </div>

        <div class="stats-grid">
          <div class="stat-kpi-card">
            <div style="font-size:0.8rem; color:#94a3b8;">${this.i18n.t('stats.overallAccuracy')}</div>
            <div class="stat-kpi-value" data-testid="stat-overall-accuracy">${overallAcc}%</div>
          </div>
          <div class="stat-kpi-card">
            <div style="font-size:0.8rem; color:#94a3b8;">${this.i18n.t('stats.bestWpm')}</div>
            <div class="stat-kpi-value" style="color:#4ade80;">${profile.bestWpm} WPM</div>
          </div>
          <div class="stat-kpi-card">
            <div style="font-size:0.8rem; color:#94a3b8;">${this.i18n.t('stats.practiceTime')}</div>
            <div class="stat-kpi-value" style="color:#facc15;">${practiceMinutes} min</div>
          </div>
          <div class="stat-kpi-card">
            <div style="font-size:0.8rem; color:#94a3b8;">${this.i18n.t('stats.masteredKeys')}</div>
            <div class="stat-kpi-value" style="color:#c084fc;">${masteredList.length}</div>
          </div>
        </div>

        <div class="sidebar-panel" data-testid="keyboard-heatmap-panel">
          <h3>⌨️ ${this.i18n.t('stats.heatmapTitle')}</h3>
          <div style="display:flex; flex-direction:column; gap:0.2rem; align-items:center;">${heatmapRowsHtml}</div>
          <div style="margin-top:0.5rem; font-size:0.8rem; color:#cbd5e1; text-align:center;">Polskie znaki diakrytyczne (AltGr):</div>
          <div style="display:flex; flex-wrap:wrap; gap:0.2rem; justify-content:center;">${diacriticsHeatmapHtml}</div>
        </div>

        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(320px, 1fr)); gap:1rem;">
          <div class="sidebar-panel">
            <h3>⚠️ ${this.i18n.t('stats.problematicKeys')} & ${this.i18n.t('stats.recommendations')}</h3>
            ${
              problematicList.length > 0
                ? `<div style="display:flex; flex-wrap:wrap; gap:0.35rem;">
                    ${problematicList
                      .slice(0, 10)
                      .map(
                        (s) =>
                          `<span class="key-chip" style="border-color:#facc15;">${escapeHtml(s.char)} (${Math.round((s.correct / s.attempts) * 100)}%, ${escapeHtml(s.avgReactionMs)}ms)</span>`
                      )
                      .join('')}
                  </div>`
                : `<p style="font-size:0.84rem; color:#94a3b8;">${this.i18n.pick('Brak problematycznych klawiszy — kontynuuj kampanię!', 'No problematic keys detected yet — keep advancing in the campaign!')}</p>`
            }
          </div>

          <div class="sidebar-panel">
            <h3>🕒 ${this.i18n.t('stats.historyTitle')}</h3>
            ${
              recentHistory.length > 0
                ? `<div style="display:flex; flex-direction:column; gap:0.35rem; font-size:0.8rem;">
                    ${recentHistory
                      .map(
                        (h) =>
                          `<div style="display:flex; justify-content:space-between; background:#090d16; padding:0.4rem 0.65rem; border-radius:6px;">
                            <span><strong>${escapeHtml(h.missionId)}</strong> (${escapeHtml(h.mode)})</span>
                            <span>🎯 ${Math.round(h.accuracy * 100)}% | ⚡ ${escapeHtml(h.wpm)} WPM | 🔥 ${escapeHtml(h.maxCombo)}</span>
                          </div>`
                      )
                      .join('')}
                  </div>`
                : `<p style="font-size:0.84rem; color:#94a3b8;">${this.i18n.pick('Brak zapisanych sesji.', 'No completed sessions yet.')}</p>`
            }
          </div>
        </div>
      </section>
    `;
  }

  private renderAchievementsHtml(): string {
    const profile = this.persistence.getActiveProfile();
    const unlockedSet = new Set(profile.achievements);

    return `
      <section style="display:flex; flex-direction:column; gap:1rem;" data-testid="achievements-screen">
        <div class="sidebar-panel">
          <h2 style="font-size:1.35rem;">🏆 ${this.i18n.t('menu.achievements')} (${profile.achievements.length}/${ACHIEVEMENTS_DATA.length})</h2>
          <div class="missions-grid" style="margin-top:0.5rem;">
            ${ACHIEVEMENTS_DATA.map((ach) => {
              const unlocked = unlockedSet.has(ach.id);
              return `
                <div class="mission-card ${unlocked ? 'unlocked' : 'locked'}" data-testid="achievement-${ach.id}">
                  <div style="display:flex; align-items:center; gap:0.75rem;">
                    <div style="font-size:2rem;">${ach.icon}</div>
                    <div>
                      <h3 style="font-size:0.98rem;">${this.i18n.pick(ach.namePl, ach.nameEn)}</h3>
                      <p style="font-size:0.8rem; color:#94a3b8; margin-top:0.2rem;">${this.i18n.pick(ach.descPl, ach.descEn)}</p>
                      <span style="font-size:0.75rem; color:${unlocked ? '#4ade80' : '#facc15'};">
                        ${unlocked ? '✓ Odblokowane / Unlocked' : `+${ach.xpReward} XP`}
                      </span>
                    </div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>

        <div class="sidebar-panel">
          <h3>🎨 ${this.i18n.pick('Nagrody Kosmetyczne (Skórki Wież i Lasery)', 'Cosmetic Rewards (Tower Skins & Lasers)')}</h3>
          <div style="display:flex; gap:0.65rem; flex-wrap:wrap;">
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
                  ${owned ? (equipped ? '✓ ' : '') : '🔒 '}${this.i18n.pick(cos.namePl, cos.nameEn)}
                </button>
              `;
            }).join('')}
          </div>
        </div>
      </section>
    `;
  }

  private renderProfilesHtml(): string {
    const profiles = this.persistence.getAllProfiles();
    const active = this.persistence.getActiveProfile();

    return `
      <section class="sidebar-panel" style="max-width:820px; margin:0.5rem auto; padding:1.5rem;" data-testid="profiles-screen">
        <h2 style="font-size:1.4rem;">👥 ${this.i18n.t('profile.title')}</h2>
        <div style="display:flex; flex-direction:column; gap:0.6rem; margin:0.75rem 0;">
          ${profiles
            .map((p) => {
              const isCurrent = p.id === active.id;
              const completed = Object.values(p.completedMissions).filter((m) => m.completed).length;
              return `
                <div style="display:flex; justify-content:space-between; align-items:center; background:#090d16; border:1px solid ${isCurrent ? '#38bdf8' : 'rgba(148,163,184,0.2)'}; padding:0.75rem 1rem; border-radius:10px;" data-testid="profile-row-${escapeHtml(p.id)}">
                  <div>
                    <strong style="font-size:1.05rem;">${escapeHtml(p.avatarIcon)} ${escapeHtml(p.name)}</strong>
                    ${isCurrent ? `<span style="color:#4ade80; font-size:0.78rem; margin-left:0.5rem;">(Aktywny / Active)</span>` : ''}
                    <div style="font-size:0.78rem; color:#94a3b8;">
                      Poz./Lv ${p.level} | Misje: ${completed}/48
                    </div>
                  </div>
                  <div style="display:flex; gap:0.4rem;">
                    ${
                      !isCurrent
                        ? `<button class="primary-cta-btn" style="padding:0.35rem 0.85rem; font-size:0.8rem;" data-switch-profile="${escapeHtml(p.id)}" data-testid="switch-profile-${escapeHtml(p.id)}">
                            ${this.i18n.pick('Przełącz', 'Switch')}
                          </button>`
                        : ''
                    }
                  </div>
                </div>
              `;
            })
            .join('')}
        </div>

        <div style="display:flex; gap:0.5rem; align-items:center; flex-wrap:wrap; background:#090d16; padding:0.85rem; border-radius:10px;">
          <input
            type="text"
            id="new-profile-name-input"
            data-testid="new-profile-name-input"
            placeholder="${this.i18n.pick('Imię nowego gracza...', 'New player name...')}"
            style="background:#1e293b; border:1px solid #38bdf8; padding:0.45rem 0.75rem; border-radius:6px; flex:1;"
          />
          <button class="primary-cta-btn" style="padding:0.45rem 1rem; font-size:0.85rem;" data-action="create-profile" data-testid="create-profile-btn">
            ➕ ${this.i18n.t('profile.create')}
          </button>
        </div>

        <div style="margin-top:1rem; border-top:1px solid rgba(148,163,184,0.2); padding-top:1rem; display:flex; flex-direction:column; gap:0.6rem;">
          <h3>💾 ${this.i18n.t('profile.export')} / ${this.i18n.t('profile.import')}</h3>
          <textarea
            id="save-json-textarea"
            data-testid="save-json-textarea"
            rows="5"
            style="width:100%; background:#050811; border:1px solid rgba(148,163,184,0.3); border-radius:8px; padding:0.6rem; font-family:monospace; font-size:0.75rem;"
          >${escapeHtml(this.persistence.exportSaveJson())}</textarea>
          <div style="display:flex; gap:0.6rem; flex-wrap:wrap;">
            <button class="nav-btn" data-action="import-save-json" data-testid="import-save-btn">
              📥 ${this.i18n.t('profile.import')}
            </button>
            <button class="nav-btn" style="border-color:#f43f5e; color:#fda4af;" data-action="reset-profile" data-testid="reset-profile-btn">
              🗑️ ${this.i18n.t('profile.reset')}
            </button>
          </div>
          ${this.importStatusMessage ? `<div data-testid="import-status-msg" style="color:#4ade80; font-size:0.82rem;">${escapeHtml(this.importStatusMessage)}</div>` : ''}
        </div>
      </section>
    `;
  }

  private renderSettingsHtml(): string {
    const s = this.persistence.getActiveProfile().settings;

    return `
      <section class="sidebar-panel" style="max-width:740px; margin:0.5rem auto; padding:1.5rem;" data-testid="settings-screen">
        <h2 style="font-size:1.4rem;">⚙️ ${this.i18n.t('settings.title')}</h2>
        <div style="display:flex; flex-direction:column; gap:0.9rem; margin-top:0.5rem;">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <label>${this.i18n.t('settings.language')}</label>
            <select id="setting-language" data-testid="setting-language" style="background:#1e293b; border:1px solid #38bdf8; padding:0.4rem; border-radius:6px;">
              <option value="pl" ${s.language === 'pl' ? 'selected' : ''}>Polski (Domyślny)</option>
              <option value="en" ${s.language === 'en' ? 'selected' : ''}>English</option>
            </select>
          </div>

          <div style="display:flex; justify-content:space-between; align-items:center;">
            <label>${this.i18n.t('settings.difficulty')}</label>
            <select id="setting-difficulty" data-testid="setting-difficulty" style="background:#1e293b; border:1px solid #38bdf8; padding:0.4rem; border-radius:6px;">
              <option value="relaxed" ${s.difficulty === 'relaxed' ? 'selected' : ''}>Relaksacyjny (Relaxed - bez presji)</option>
              <option value="standard" ${s.difficulty === 'standard' ? 'selected' : ''}>Standardowy (Standard)</option>
              <option value="tactical" ${s.difficulty === 'tactical' ? 'selected' : ''}>Taktyczny (Tactical)</option>
            </select>
          </div>

          <div style="display:flex; justify-content:space-between; align-items:center;">
            <label>${this.i18n.t('settings.typingAssistance')}</label>
            <select id="setting-assistance" data-testid="setting-assistance" style="background:#1e293b; border:1px solid #38bdf8; padding:0.4rem; border-radius:6px;">
              <option value="full" ${s.typingAssistance === 'full' ? 'selected' : ''}>Pełne podpowiedzi (Full)</option>
              <option value="adaptive" ${s.typingAssistance === 'adaptive' ? 'selected' : ''}>Adaptacyjne (Adaptive)</option>
              <option value="minimal" ${s.typingAssistance === 'minimal' ? 'selected' : ''}>Minimalne (Minimal)</option>
            </select>
          </div>

          <div style="display:flex; justify-content:space-between; align-items:center;">
            <label>${this.i18n.t('settings.textSize')}</label>
            <select id="setting-textsize" data-testid="setting-textsize" style="background:#1e293b; border:1px solid #38bdf8; padding:0.4rem; border-radius:6px;">
              <option value="normal" ${s.textSize === 'normal' ? 'selected' : ''}>Standardowy (Normal)</option>
              <option value="large" ${s.textSize === 'large' ? 'selected' : ''}>Duży (Large)</option>
              <option value="xlarge" ${s.textSize === 'xlarge' ? 'selected' : ''}>Bardzo Duży (Extra Large)</option>
            </select>
          </div>

          <div style="display:flex; justify-content:space-between; align-items:center;">
            <label>${this.i18n.t('settings.sfxVolume')} (${Math.round(s.sfxVolume * 100)}%)</label>
            <input type="range" id="setting-sfx" min="0" max="1" step="0.05" value="${s.sfxVolume}" />
          </div>

          <div style="display:flex; justify-content:space-between; align-items:center;">
            <label>${this.i18n.t('settings.reducedMotion')}</label>
            <input type="checkbox" id="setting-reduced-motion" data-testid="setting-reduced-motion" ${s.reducedMotion ? 'checked' : ''} />
          </div>
        </div>
      </section>
    `;
  }

  private renderSessionEndModal(): void {
    const modalContainer = document.getElementById('modal-container');
    if (!modalContainer || !this.activeSession) return;

    const session = this.activeSession;
    const typing = session.typingEngine;
    const isVictory = this.lastOutcome?.victory ?? session.isVictory();
    const stars = this.lastOutcome?.stars ?? (isVictory ? 3 : 0);
    const nextMission = MISSIONS_DATA.find((m) => m.globalIndex === session.mission.globalIndex + 1);

    modalContainer.innerHTML = `
      <div class="modal-overlay" data-testid="mission-results-modal">
        <div class="modal-card">
          <h2 style="font-size:1.65rem; color:${isVictory ? '#4ade80' : '#f43f5e'};" data-testid="results-title">
            ${isVictory ? `🏆 ${this.i18n.t('mission.victory')}` : `💥 ${this.i18n.t('mission.defeat')}`}
          </h2>
          ${
            isVictory
              ? `<div style="font-size:2rem; text-align:center;" data-testid="results-stars">
                  ${'⭐'.repeat(stars)}${'☆'.repeat(3 - stars)}
                </div>`
              : `<p style="color:#fda4af; font-size:0.9rem;">
                  ${this.i18n.pick(this.lastOutcome?.reasonPl ?? 'Spróbuj ponownie!', this.lastOutcome?.reasonEn ?? 'Try again!')}
                </p>`
          }

          <div style="background:#090d16; padding:1rem; border-radius:10px; display:grid; grid-template-columns:repeat(2,1fr); gap:0.6rem; font-size:0.88rem;">
            <div>🎯 ${this.i18n.t('hud.accuracy')}: <strong>${Math.round(typing.getAccuracy() * 100)}%</strong></div>
            <div>⚡ ${this.i18n.t('hud.wpm')}: <strong>${typing.getWpm()} WPM</strong></div>
            <div>⌨️ Wpisane znaki: <strong>${typing.getTotalCorrect()}</strong></div>
            <div>🔥 Maks. Kombo: <strong>${typing.getMaxCombo()}</strong></div>
            <div>✨ Zdobyte XP: <strong style="color:#38bdf8;">+${this.lastOutcome?.xpEarned ?? 50} XP</strong></div>
            <div>❤️ Baza HP: <strong>${session.getLives()}/${session.getMaxLives()}</strong></div>
          </div>

          ${
            this.newlyUnlockedAchievements.length > 0
              ? `<div style="background:rgba(250,204,21,0.15); border:1px solid #facc15; padding:0.65rem; border-radius:8px; font-size:0.82rem;">
                  🏅 Nowe osiągnięcia: ${this.newlyUnlockedAchievements.map((a) => `${a.icon} ${this.i18n.pick(a.namePl, a.nameEn)}`).join(', ')}
                </div>`
              : ''
          }

          <div style="display:flex; justify-content:flex-end; gap:0.6rem; flex-wrap:wrap;">
            <button class="nav-btn" data-action="modal-back-map" data-testid="results-back-map-btn">
              🗺️ ${this.i18n.t('nav.backToMap')}
            </button>
            <button class="nav-btn" data-action="modal-retry" data-testid="results-retry-btn">
              🔄 ${this.i18n.t('mission.retry')}
            </button>
            ${
              isVictory && nextMission && session.mode === 'campaign'
                ? `<button class="primary-cta-btn" data-action="modal-next-mission" data-next-id="${nextMission.id}" data-testid="results-next-mission-btn">
                    ▶ ${this.i18n.t('mission.nextMission')}
                  </button>`
                : ''
            }
          </div>
        </div>
      </div>
    `;

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
        hudContainer.innerHTML = this.buildGameplayHudHtml();
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
      powerEl.textContent = this.i18n.t(`hud.powerState.${powerState}`);
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
    if (empBtn) empBtn.disabled = economy.getEnergy() < 35;

    const overBtn = document.getElementById('hud-ability-overdrive') as HTMLButtonElement | null;
    if (overBtn) overBtn.disabled = economy.getEnergy() < 45;

    const orbBtn = document.getElementById('hud-ability-orbital') as HTMLButtonElement | null;
    if (orbBtn) orbBtn.disabled = economy.getEnergy() < 65;

    const comboEl = document.getElementById('hud-combo-value');
    if (comboEl) comboEl.textContent = `${typing.getCombo()}`;

    const accEl = document.getElementById('hud-accuracy-value');
    if (accEl) accEl.textContent = `${Math.round(typing.getAccuracy() * 100)}%`;

    const wpmEl = document.getElementById('hud-wpm-value');
    if (wpmEl) wpmEl.textContent = `${typing.getWpm()}`;
  }

  private updateTypingConsoleInPlace(): void {
    const consoleContainer = document.getElementById('typing-console-container');
    if (consoleContainer && this.activeSession) {
      consoleContainer.innerHTML = this.buildTypingConsoleHtml();
    }
  }

  private updateSidebarInPlace(): void {
    const sidebar = document.getElementById('tactical-sidebar-container');
    if (sidebar && this.activeSession) {
      sidebar.innerHTML = this.buildTacticalSidebarHtml();
      this.attachSidebarListeners(sidebar);
    }
  }

  private attachHudListeners(root: HTMLElement): void {
    root.querySelector('[data-action="start-wave"]')?.addEventListener('click', () => {
      this.activeSession?.startNextWave();
      this.updateGameplayHudInPlace();
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
        const ability = (e.currentTarget as HTMLElement).getAttribute('data-ability') as 'emp' | 'overdrive' | 'orbital';
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
      btn.addEventListener('click', (e) => {
        if (!this.activeSession) return;
        const type = (e.currentTarget as HTMLElement).getAttribute('data-build-tower') as TowerType;
        let padIndex = this.activeSession.getSelectedPadIndex();
        // If current pad is occupied or null, pick first empty pad
        if (padIndex === null || this.activeSession.getTowers().some((t) => t.padIndex === padIndex)) {
          const emptyPad = this.activeSession.map.pads.find(
            (p) => !this.activeSession!.getTowers().some((t) => t.padIndex === p.index)
          );
          if (emptyPad) padIndex = emptyPad.index;
        }
        if (padIndex !== null) {
          const built = this.activeSession.buildTower(type, padIndex);
          if (built) {
            this.updateSidebarInPlace();
            this.updateGameplayHudInPlace();
          }
        }
      });
    });

    root.querySelectorAll('[data-upgrade-branch]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const branch = (e.currentTarget as HTMLElement).getAttribute('data-upgrade-branch') as UpgradeBranch;
        const selectedTower = this.activeSession?.getSelectedTower();
        if (selectedTower && this.activeSession?.upgradeTower(selectedTower.id, branch)) {
          AchievementSystem.evaluateAndUnlock(this.persistence.getActiveProfile(), {
            activeTowers: this.activeSession.getTowers(),
          });
          this.persistence.saveToStorage();
          this.updateSidebarInPlace();
          this.updateGameplayHudInPlace();
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
        const priority = (e.currentTarget as HTMLElement).getAttribute('data-target-priority') as TargetingPriority;
        const selectedTower = this.activeSession?.getSelectedTower();
        if (selectedTower && this.activeSession) {
          this.activeSession.setTowerTargeting(selectedTower.id, priority);
          this.updateSidebarInPlace();
        }
      });
    });

    // Sandbox controls
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
      });
    });
  }

  private attachScreenListeners(): void {
    // Top Header Nav
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

    // Main Menu
    this.container.querySelector('[data-action="quick-start-campaign"]')?.addEventListener('click', (e) => {
      const mId = (e.currentTarget as HTMLElement).getAttribute('data-mission-id') ?? 'w1_m1';
      this.startMission(mId, 'campaign');
    });

    // Campaign Map
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

    // Gameplay Canvas & Controls
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

    // Survival Setup
    this.container.querySelectorAll('[data-action="start-survival"]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const mId = (e.currentTarget as HTMLElement).getAttribute('data-mission-id') ?? 'w1_m1';
        this.startMission(mId, 'survival');
      });
    });

    // Sandbox Setup
    this.container.querySelector('[data-action="launch-sandbox"]')?.addEventListener('click', () => {
      const unlimGold = (document.getElementById('sandbox-opt-gold') as HTMLInputElement | null)?.checked ?? true;
      const unlimEnergy = (document.getElementById('sandbox-opt-energy') as HTMLInputElement | null)?.checked ?? true;
      const mId = (document.getElementById('sandbox-opt-mission') as HTMLSelectElement | null)?.value ?? 'w8_m6';
      this.startMission(mId, 'sandbox', { unlimitedGold: unlimGold, unlimitedEnergy: unlimEnergy });
    });

    // Achievements Cosmetics
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

    // Profiles
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

    // Settings
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
