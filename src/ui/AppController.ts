import { SvgArtwork } from '../assets/SvgArtwork';
import { HEROES_DATA } from '../data/heroesData';
import { getMissionById, MISSIONS_DATA } from '../data/curriculumData';
import { LocalizationService } from '../i18n/LocalizationService';
import { BattlefieldRenderer } from '../rendering/BattlefieldRenderer';
import { AudioSystem } from '../services/AudioSystem';
import { PersistenceService } from '../services/PersistenceService';
import { AchievementSystem } from '../systems/AchievementSystem';
import {
  ChallengeEngine,
  ChallengeSessionConfig,
  ChallengeTier,
} from '../systems/ChallengeEngine';
import { GameSessionEngine } from '../systems/GameSessionEngine';
import { MissionOutcomeEvaluation, ProgressionEngine } from '../systems/ProgressionEngine';
import {
  ComparisonDateRange,
  FamilySortMetric,
  StatisticsEngine,
} from '../systems/StatisticsEngine';
import { TechnologySystem } from '../systems/TechnologySystem';
import { TrainingAcademyEngine, TrainingActivityKind } from '../systems/TrainingAcademyEngine';
import { WaveSystem } from '../systems/WaveSystem';
import {
  AchievementDefinition,
  DifficultyLevel,
  EnemyType,
  GameMode,
  HeroId,
  PlayerProfile,
  ScreenId,
  SessionCompletionStatus,
  SessionHistoryEntry,
  TargetingPriority,
  TowerType,
  UpgradeBranch,
} from '../types';
import { escapeHtml } from '../utils/escapeHtml';
import { CampaignMapView } from './views/CampaignMapView';
import { ChallengesView } from './views/ChallengesView';
import { DashboardViews } from './views/DashboardViews';
import {
  FamilyDashboardState,
  FamilyDashboardView,
} from './views/FamilyDashboardView';
import { GameplayView } from './views/GameplayView';
import { MainMenuView } from './views/MainMenuView';
import { TrainingAcademyView, TrainingViewState } from './views/TrainingAcademyView';

interface HudSnapshot {
  lives: string;
  gold: string;
  energy: string;
  energyMax: string;
  energyPct: number;
  powerStateClass: string;
  powerStateText: string;
  wave: string;
  goalText: string;
  goalColor: string;
  startWaveDisabled: boolean;
  speedText: string;
  pauseText: string;
  empDisabled: boolean;
  empMeta: string;
  overDisabled: boolean;
  overMeta: string;
  orbDisabled: boolean;
  orbMeta: string;
  combo: string;
  accuracy: string;
  wpm: string;
}

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
  private hadActiveErrorHighlight: boolean = false;
  private lastHudSnapshot: HudSnapshot | null = null;
  private lastOutcome: MissionOutcomeEvaluation | null = null;
  private newlyUnlockedAchievements: AchievementDefinition[] = [];
  private importStatusMessage: string = '';

  private familyState: FamilyDashboardState = {
    sortBy: 'defenderScore',
    sortDesc: true,
    selectedProfileIds: [],
    dateRange: '30d',
    leaderboardMissionId: 'w1_m1',
    leaderboardDifficulty: 'standard',
  };

  private trainingState: TrainingViewState = {
    tab: 'drills',
    selectedActivity: 'weak_keys',
    stdDuration: 60,
    stdPool: 'beginner',
    activeEngine: null,
    lastResult: null,
  };
  private trainingTickIntervalId: number | null = null;
  private selectedChallengeTier: ChallengeTier | null = null;
  private lastChallengeConfig: ChallengeSessionConfig | null = null;
  private trainingLastTickMs = 0;

  constructor(container: HTMLElement) {
    this.container = container;
    this.persistence = new PersistenceService();
    const initialProfile = this.persistence.getActiveProfile();
    this.i18n = new LocalizationService(initialProfile.settings.language);
    this.audio = new AudioSystem();
    this.persistence.setOnStorageError(() => this.updateStorageWarning());
    this.applyActiveProfileSettings();
    this.ensureFamilyComparisonSelection();

    this.bindGlobalKeyboardAndFocus();
    document.addEventListener('fullscreenchange', () => {
      this.updateFullscreenButtonState();
    });
    this.renderCurrentScreen();
  }

  private applyActiveProfileSettings(): void {
    const profile = this.persistence.getActiveProfile();
    this.i18n.setLanguage(profile.settings.language);
    this.audio.setVolumes(profile.settings.musicVolume, profile.settings.sfxVolume);
  }

  private ensureFamilyComparisonSelection(): void {
    const allIds = this.persistence.getAllProfiles().map((p) => p.id);
    const validSelected = this.familyState.selectedProfileIds.filter((id) => allIds.includes(id));
    if (validSelected.length === 0) {
      this.familyState.selectedProfileIds = allIds.slice(0, 4);
    } else {
      this.familyState.selectedProfileIds = validSelected;
    }
  }

  public toggleFullscreen(): void {
    if (typeof document === 'undefined') return;
    try {
      if (!document.fullscreenElement) {
        if (document.documentElement.requestFullscreen) {
          document.documentElement.requestFullscreen().catch(() => {});
        }
      } else {
        if (document.exitFullscreen) {
          document.exitFullscreen().catch(() => {});
        }
      }
    } catch {
      // Graceful handling for browsers/environments blocking Fullscreen API
    }
  }

  public updateFullscreenButtonState(): void {
    const fsBtn = this.container.querySelector('[data-action="toggle-fullscreen"]');
    if (!fsBtn) return;
    const isFs = typeof document !== 'undefined' && Boolean(document.fullscreenElement);
    fsBtn.textContent = isFs
      ? `↙ ${this.i18n.pick('Okno', 'Exit Fullscreen')}`
      : `⛶ ${this.i18n.pick('Pełny ekran', 'Fullscreen')}`;
  }

  public getActiveSession(): GameSessionEngine | null {
    return this.activeSession;
  }

  public navigateTo(screen: ScreenId): void {
    if (screen !== 'training_academy') this.finishTrainingOrAssessment(true, false);
    if (this.currentScreen === 'gameplay' && screen !== 'gameplay' && this.activeSession) {
      if (!this.activeSession.isFinalized()) {
        this.finalizeSession(this.activeSession, this.activeSession.isSessionOver() ? 'completed' : 'abandoned');
      }
      this.stopGameLoop();
      this.activeSession = null;
    }
    this.persistence.flushSave();
    if (screen === 'family_dashboard') {
      this.ensureFamilyComparisonSelection();
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
    const baseMission = getMissionById(missionId) ?? MISSIONS_DATA[0];
    if (
      mode === 'campaign' &&
      (!getMissionById(missionId) || !ProgressionEngine.isMissionUnlocked(baseMission, profile))
    ) {
      return;
    }

    this.finishTrainingOrAssessment(true, false);
    // Finalize any previous unfinished session before starting a new one
    if (this.activeSession && !this.activeSession.isFinalized()) {
      this.finalizeSession(this.activeSession, this.activeSession.isSessionOver() ? 'completed' : 'abandoned');
    }

    this.persistence.flushSave();
    this.stopGameLoop();

    let mission = baseMission;
    if (mode === 'survival') {
      const unlockedKeysSet = new Set<string>(MISSIONS_DATA[0].allowedKeys);
      for (const m of MISSIONS_DATA) {
        if (profile.completedMissions[m.id]?.completed) {
          m.allowedKeys.forEach((k) => unlockedKeysSet.add(k));
        }
      }
      mission = {
        ...baseMission,
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
        ...baseMission,
        id: 'sandbox_session',
        namePl: 'Poligon Taktyczny (Sandbox)',
        nameEn: 'Tactical Sandbox',
        allowedKeys: options.customAllowedKeys ?? baseMission.allowedKeys,
        newKeys: baseMission.newKeys.filter((key) =>
          (options.customAllowedKeys ?? baseMission.allowedKeys).includes(key)
        ),
        requiredTypedChars: 0,
        startingGold: 1500,
        startingLives: 99,
      };
    }

    this.activeSession = new GameSessionEngine({
      mode,
      mission,
      sourceMissionId: baseMission.id,
      profile,
      unlimitedGold: options.unlimitedGold,
      unlimitedEnergy: options.unlimitedEnergy,
      customAllowedKeys: options.customAllowedKeys,
      initialGameSpeed: profile.settings.defaultGameSpeed,
    });

    this.activeSession.setSelectedPadIndex(0);
    this.sessionOutcomeProcessed = false;
    this.lastFollowUpState = false;
    this.hadActiveErrorHighlight = false;
    this.lastHudSnapshot = null;
    this.lastOutcome = null;
    this.newlyUnlockedAchievements = [];
    this.currentScreen = 'gameplay';
    this.renderCurrentScreen();
    this.audio.startMusic(mission.isBossMission ? 'boss' : 'combat');
    if (typeof window !== 'undefined' && typeof window.scrollTo === 'function') {
      window.scrollTo(0, 0);
    }
    this.startGameLoop();
  }

  public startChallenge(frequency: 'daily' | 'weekly', tier?: ChallengeTier): void {
    const profile = this.persistence.getActiveProfile();
    const chosenTier = tier ?? this.selectedChallengeTier ?? ChallengeEngine.getPlayerEligibleTier(profile);
    if (!ChallengeEngine.isTierEligible(profile, chosenTier)) {
      return;
    }

    const challenge =
      frequency === 'weekly'
        ? ChallengeEngine.getWeeklyChallenge(chosenTier)
        : ChallengeEngine.getDailyChallenge(chosenTier);
    const challengeConfig = ChallengeEngine.buildChallengeSessionConfig(
      challenge,
      profile.settings.difficulty
    );
    this.launchChallengeFromConfig(challengeConfig);
  }

  public launchChallengeFromConfig(challengeConfig: ChallengeSessionConfig): void {
    const profile = this.persistence.getActiveProfile();
    const baseMission = getMissionById(challengeConfig.sourceMissionId) ?? MISSIONS_DATA[0];

    this.finishTrainingOrAssessment(true, false);
    if (this.activeSession && !this.activeSession.isFinalized()) {
      this.finalizeSession(this.activeSession, this.activeSession.isSessionOver() ? 'completed' : 'abandoned');
    }
    this.persistence.flushSave();
    this.stopGameLoop();

    this.lastChallengeConfig = challengeConfig;
    this.activeSession = new GameSessionEngine({
      mode: 'challenge',
      mission: baseMission,
      sourceMissionId: baseMission.id,
      profile,
      challengeConfig,
      initialGameSpeed: profile.settings.defaultGameSpeed,
    });

    this.activeSession.setSelectedPadIndex(0);
    this.sessionOutcomeProcessed = false;
    this.lastFollowUpState = false;
    this.hadActiveErrorHighlight = false;
    this.lastHudSnapshot = null;
    this.lastOutcome = null;
    this.newlyUnlockedAchievements = [];
    this.currentScreen = 'gameplay';
    this.renderCurrentScreen();
    this.audio.startMusic(baseMission.isBossMission ? 'boss' : 'combat');
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
          this.renderer.render(
            this.activeSession,
            this.activeSession.getOwnerProfile(),
            dtSec
          );
        }

        this.updateGameplayHudInPlace();
        if (tick.waveCompleted) {
          this.updateWavePreviewInPlace();
        }
        if (tick.goldChanged || tick.waveCompleted) {
          this.updateSidebarAffordabilityInPlace();
        }

        // Expire temporary wrong-key highlight automatically after 450ms without requiring another keystroke
        if (this.hadActiveErrorHighlight) {
          const stillWrong = this.activeSession.typingEngine.getLastWrongKey(Date.now());
          if (!stillWrong) {
            this.hadActiveErrorHighlight = false;
            this.clearConsoleErrorHighlightInPlace();
          }
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

  /**
   * Finalizes a session at most once, attributing all results and practice strictly
   * to `session.ownerProfileId` (never whichever profile happens to be active later).
   */
  public finalizeSession(
    session: GameSessionEngine,
    reason: 'completed' | 'abandoned'
  ): void {
    if (session.isFinalized()) return;
    session.markFinalized();

    if (session.mode === 'sandbox') {
      return;
    }

    const ownerProfile = this.persistence.getProfileById(session.ownerProfileId);
    if (!ownerProfile) return;
    const typing = session.typingEngine;
    const durationSec = typing.getActiveDurationSec();
    const charsTyped = typing.getTotalCorrect();
    const errors = typing.getTotalErrors();
    const attempts = typing.getTotalAttempts();

    // Update owner profile's active practice time and records
    if (durationSec > 0) {
      ownerProfile.totalPracticeTimeSec += durationSec;
    }
    if (attempts > 0) {
      ownerProfile.bestCombo = Math.max(ownerProfile.bestCombo, typing.getMaxCombo());
      ownerProfile.bestWpm = Math.max(ownerProfile.bestWpm, typing.getWpm());
      const qWpm = session.isUnrestrictedResources() ? null : StatisticsEngine.computeQualifyingWpm(charsTyped, durationSec);
      if (qWpm !== null) {
        ownerProfile.bestQualifyingWpm =
          ownerProfile.bestQualifyingWpm !== null && ownerProfile.bestQualifyingWpm !== undefined
            ? Math.max(ownerProfile.bestQualifyingWpm, qWpm)
            : qWpm;
      }
    }

    let status: SessionCompletionStatus = 'abandoned';
    let stars: 0 | 1 | 2 | 3 = 0;

    if (reason === 'completed') {
      if (session.mode === 'campaign') {
        this.lastOutcome = ProgressionEngine.evaluateMissionResult(
          session.mission,
          ownerProfile,
          session.getLives(),
          session.getMaxLives(),
          charsTyped,
          typing.getAccuracy(),
          typing.getWpm(),
          typing.getMaxCombo(),
          typing.getSessionKeyStats(),
          {
            durationSec,
            isUnrestrictedResources: session.isUnrestrictedResources(),
            difficulty: session.difficulty,
          }
        );
        status = this.lastOutcome.victory ? 'victory' : 'defeat';
        stars = this.lastOutcome.stars;
        if (this.lastOutcome.victory) {
          this.audio.playVictory();
        } else {
          ProgressionEngine.awardXp(ownerProfile, this.lastOutcome.xpEarned);
        }
        this.newlyUnlockedAchievements = AchievementSystem.evaluateAndUnlock(ownerProfile, {
          missionWon: this.lastOutcome.victory,
          isBossMission: session.mission.isBossMission,
          remainingLives: session.getLives(),
          startingLives: session.getMaxLives(),
          typingAccuracy: typing.getAccuracy(),
          maxCombo: typing.getMaxCombo(),
          activeTowers: session.getTowers(),
        });
      } else if (session.mode === 'challenge' && session.challengeConfig) {
        const evalRes = ChallengeEngine.evaluateChallengeCompletion(session.challengeConfig, {
          remainingLives: session.getLives(),
          cumulativeBaseDamage: session.getCumulativeBaseDamage(),
          correctChars: charsTyped,
          accuracy: typing.getAccuracy(),
          usedTowerTypes: session.getUsedTowerTypes(),
        });
        status = evalRes.passed ? 'victory' : 'defeat';
        stars = evalRes.passed ? 3 : 0;
        if (evalRes.passed) {
          this.audio.playVictory();
        } else {
          this.audio.playDefeat();
        }
        const { awardedTechPoints } = ChallengeEngine.recordChallengeCompletion(
          ownerProfile,
          session.challengeConfig,
          {
            challengeId: session.challengeConfig.challengeId,
            rulesetVersion: session.challengeConfig.rulesetVersion,
            profileId: ownerProfile.id,
            timestamp: Date.now(),
            difficulty: session.difficulty,
            score: session.getScore(),
            accuracy: typing.getAccuracy(),
            correctChars: charsTyped,
            errors,
            durationSec,
            wpm: typing.getWpm(),
            baseDamage: session.getCumulativeBaseDamage(),
            wavesCompleted: session.waveSystem.getCompletedWavesCount(),
            towerTypesUsed: session.getUsedTowerTypes(),
            heroId: null,
            status: evalRes.passed ? 'completed' : 'failed',
          }
        );
        const xpEarned = evalRes.passed ? 120 + awardedTechPoints * 50 : 30;
        const oldLevel = ownerProfile.level;
        ProgressionEngine.awardXp(ownerProfile, xpEarned);
        this.lastOutcome = {
          victory: evalRes.passed,
          tacticalVictory: session.getLives() > 0,
          educationalCompleted: evalRes.passed,
          stars: evalRes.passed ? 3 : 0,
          xpEarned,
          leveledUp: ownerProfile.level > oldLevel,
          newLevel: ownerProfile.level,
          newlyUnlockedTowers: [],
          keyObjectives: [],
          masterySummary: [],
          reasonPl: evalRes.reasonPl,
          reasonEn: evalRes.reasonEn,
        };
      } else if (session.mode === 'survival') {
        status = 'defeat';
        const waveReached = session.waveSystem.getCompletedWavesCount();
        if (!session.isUnrestrictedResources()) {
          ownerProfile.survivalBestWave = Math.max(ownerProfile.survivalBestWave, waveReached);
          ownerProfile.survivalBestScore = Math.max(ownerProfile.survivalBestScore, session.getScore());
        }
        this.newlyUnlockedAchievements = AchievementSystem.evaluateAndUnlock(ownerProfile, {
          survivalWaveReached: waveReached,
          maxCombo: typing.getMaxCombo(),
          activeTowers: session.getTowers(),
        });
      }
    }

    const wavesCompleted = session.waveSystem.getCompletedWavesCount();
    const shouldRecordHistory =
      reason === 'completed' || attempts > 0 || wavesCompleted > 0;

    if (shouldRecordHistory) {
      const qualifyingWpm = session.isUnrestrictedResources() ? null : StatisticsEngine.computeQualifyingWpm(charsTyped, durationSec);
      const historyEntry: SessionHistoryEntry = {
        sessionId: session.sessionId,
        profileId: ownerProfile.id,
        unrestrictedResources: session.isUnrestrictedResources(),
        timestamp: Date.now(),
        missionId: session.sourceMissionId,
        mode: session.mode,
        difficulty: session.difficulty,
        status,
        tacticalVictory: session.isTacticalVictory(),
        educationalCompleted: session.isEducationalCompleted(),
        wpm: typing.getWpm(),
        qualifyingWpm,
        accuracy: attempts > 0 ? typing.getAccuracy() : 0,
        durationSec,
        charsTyped,
        errors,
        maxCombo: typing.getMaxCombo(),
        score: session.getScore(),
        stars,
        wavesCompleted,
      };

      ownerProfile.sessionHistory.push(historyEntry);
      ownerProfile.sessionHistory = ownerProfile.sessionHistory.slice(-60);
      ownerProfile.lastActiveAt = Date.now();
      StatisticsEngine.recordSessionIntoDailyStats(ownerProfile, historyEntry);
    }

    this.persistence.saveToStorage();
  }

  private handleSessionCompleted(): void {
    if (!this.activeSession || this.sessionOutcomeProcessed) return;
    this.sessionOutcomeProcessed = true;

    const session = this.activeSession;
    this.finalizeSession(session, 'completed');
    this.renderSessionEndModal();
  }

  /**
   * Requests switching to `targetProfileId`.
   * If an unfinished mission is currently running, prompts the user for confirmation first.
   */
  public requestProfileSwitch(targetProfileId: string, startPlayAfterSwitch: boolean = false): void {
    if (!this.persistence.getProfileById(targetProfileId)) return;
    const currentProfile = this.persistence.getActiveProfile();
    if (targetProfileId === currentProfile.id && !startPlayAfterSwitch) {
      return;
    }

    if (this.currentScreen === 'gameplay' && this.activeSession && !this.activeSession.isSessionOver()) {
      this.renderSwitchProfileConfirmModal(targetProfileId, startPlayAfterSwitch);
      return;
    }

    this.executeProfileSwitch(targetProfileId, startPlayAfterSwitch);
  }

  private executeProfileSwitch(targetProfileId: string, startPlayAfterSwitch: boolean = false): void {
    this.finishTrainingOrAssessment(true, false);
    this.trainingState.lastResult = null;
    if (this.activeSession && !this.activeSession.isFinalized()) {
      this.finalizeSession(this.activeSession, this.activeSession.isSessionOver() ? 'completed' : 'abandoned');
    }
    this.stopGameLoop();
    this.activeSession = null;

    this.persistence.switchProfile(targetProfileId);
    this.applyActiveProfileSettings();
    this.ensureFamilyComparisonSelection();

    if (startPlayAfterSwitch) {
      this.navigateTo('campaign_map');
    } else if (this.currentScreen === 'gameplay') {
      this.navigateTo('main_menu');
    } else {
      this.renderCurrentScreen();
    }
  }

  private renderSwitchProfileConfirmModal(targetProfileId: string, startPlayAfterSwitch: boolean): void {
    const modalContainer = document.getElementById('modal-container');
    const targetProfile = this.persistence.getProfileById(targetProfileId);
    if (!modalContainer || !targetProfile || !this.activeSession) return;
    const session = this.activeSession;
    const wasPaused = session.getIsPaused();
    session.setPaused(true);
    this.updateGameplayHudInPlace();

    modalContainer.innerHTML = `
      <div class="modal-overlay" data-testid="switch-profile-confirm-modal">
        <div class="modal-card">
          <h3 style="font-size:1.25rem; color:#facc15;">
            ⚠️ ${this.i18n.pick('Przełączyć profil w trakcie misji?', 'Switch profile during mission?')}
          </h3>
          <p style="font-size:0.88rem; color:#cbd5e1; line-height:1.45;">
            ${this.i18n.pick(
              `Bieżąca misja zostanie zakończona. Dotychczasowe ćwiczenie pisania zostanie zapisane dla obecnego gracza, ale nieukończona misja nie zostanie zaliczona. Przełączyć na gracza ${escapeHtml(targetProfile.name)}?`,
              `The current mission will end. Your typing practice so far will be saved to the current player, but the unfinished mission will not be marked completed. Switch to ${escapeHtml(targetProfile.name)}?`
            )}
          </p>
          <div style="display:flex; justify-content:flex-end; gap:0.5rem;">
            <button class="nav-btn" data-action="cancel-switch-profile" data-testid="cancel-switch-profile-btn">
              ${this.i18n.pick('Anuluj', 'Cancel')}
            </button>
            <button class="primary-cta-btn" style="padding:0.45rem 1rem; font-size:0.85rem;" data-action="confirm-switch-profile" data-testid="confirm-switch-profile-btn">
              ✓ ${this.i18n.pick('Zakończ misję i przełącz', 'End mission & switch')}
            </button>
          </div>
        </div>
      </div>
    `;

    modalContainer.querySelector('[data-action="cancel-switch-profile"]')?.addEventListener('click', () => {
      modalContainer.innerHTML = '';
      // Sync header select back to active profile
      const headerSel = document.getElementById('header-profile-switcher') as HTMLSelectElement | null;
      if (headerSel) {
        headerSel.value = this.persistence.getActiveProfile().id;
        headerSel.blur();
      }
      if (this.activeSession === session) {
        session.setPaused(wasPaused);
        this.updateGameplayHudInPlace();
      }
    });

    modalContainer.querySelector('[data-action="confirm-switch-profile"]')?.addEventListener('click', () => {
      modalContainer.innerHTML = '';
      this.executeProfileSwitch(targetProfileId, startPlayAfterSwitch);
    });
  }

  private renderDestructiveProfileConfirmModal(
    profileId: string,
    operation: 'reset' | 'delete'
  ): void {
    const modalContainer = document.getElementById('modal-container');
    const target = this.persistence.getProfileById(profileId);
    if (!modalContainer || !target) return;

    const titlePl =
      operation === 'reset'
        ? `Zresetować postępy gracza ${target.name}?`
        : `Usunąć profil gracza ${target.name}?`;
    const titleEn =
      operation === 'reset'
        ? `Reset progress for ${target.name}?`
        : `Delete player profile ${target.name}?`;

    const descPl =
      operation === 'reset'
        ? 'Ta operacja wyzeruje ukończone misje, poziom, osiągnięcia oraz statystyki pisania tego gracza. Zalecamy wcześniejsze pobranie kopii zapasowej JSON.'
        : 'Ta operacja trwale usunie profil tego gracza wraz z całą jego historią i osiągnięciami. Zalecamy wcześniejsze pobranie kopii zapasowej JSON.';
    const descEn =
      operation === 'reset'
        ? 'This will reset all completed missions, level, achievements, and typing statistics for this player. Downloading a JSON backup first is recommended.'
        : 'This will permanently delete this player profile and all of its history and achievements. Downloading a JSON backup first is recommended.';

    modalContainer.innerHTML = `
      <div class="modal-overlay" data-testid="confirm-profile-destructive-modal">
        <div class="modal-card" style="border-color:#f43f5e;">
          <h3 style="font-size:1.25rem; color:#fda4af;">
            ⚠️ ${escapeHtml(this.i18n.pick(titlePl, titleEn))}
          </h3>
          <p style="font-size:0.86rem; color:#cbd5e1; line-height:1.45;">
            ${escapeHtml(this.i18n.pick(descPl, descEn))}
          </p>
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem;">
            <button class="nav-btn" style="border-color:#4ade80; color:#bbf7d0;" data-action="modal-download-backup" data-testid="modal-download-backup-btn">
              ⬇️ ${this.i18n.pick('Pobierz kopię zapasową (.json)', 'Download Backup (.json)')}
            </button>
            <div style="display:flex; gap:0.5rem;">
              <button class="nav-btn" data-action="cancel-destructive-profile" data-testid="cancel-destructive-profile-btn">
                ${this.i18n.pick('Anuluj', 'Cancel')}
              </button>
              <button
                class="primary-cta-btn"
                style="background:#e11d48; border-color:#fda4af; padding:0.45rem 1rem; font-size:0.85rem;"
                data-action="confirm-destructive-profile"
                data-testid="confirm-destructive-profile-btn"
              >
                🗑️ ${this.i18n.pick('Potwierdź', 'Confirm')}
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    modalContainer.querySelector('[data-action="modal-download-backup"]')?.addEventListener('click', () => {
      this.triggerDownloadSaveJson();
    });
    modalContainer.querySelector('[data-action="cancel-destructive-profile"]')?.addEventListener('click', () => {
      modalContainer.innerHTML = '';
    });
    modalContainer.querySelector('[data-action="confirm-destructive-profile"]')?.addEventListener('click', () => {
      modalContainer.innerHTML = '';
      if (operation === 'reset') {
        this.persistence.resetProfile(profileId);
      } else {
        this.persistence.deleteProfile(profileId);
        this.ensureFamilyComparisonSelection();
      }
      this.renderCurrentScreen();
    });
  }

  public triggerDownloadSaveJson(): void {
    const json = this.persistence.exportSaveJson();
    if (typeof document === 'undefined' || typeof Blob === 'undefined') return;
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `keyfort_td_backup_${StatisticsEngine.formatDateKey(Date.now())}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  private bindGlobalKeyboardAndFocus(): void {
    // Reload/close must retain practice just like explicitly leaving a mission.
    window.addEventListener('pagehide', () => {
      this.finishTrainingOrAssessment(true, false);
      const session = this.activeSession;
      if (session && !session.isFinalized()) {
        this.finalizeSession(session, session.isSessionOver() ? 'completed' : 'abandoned');
      }
      this.stopGameLoop();
      this.activeSession = null;
      if (this.currentScreen === 'gameplay') this.currentScreen = 'main_menu';
      this.persistence.flushSave();
    });
    window.addEventListener('pageshow', (event) => {
      if (event.persisted) this.renderCurrentScreen();
    });
    window.addEventListener('blur', () => {
      const training = this.trainingState.activeEngine;
      if (training?.mode === 'assessment' && training.started) {
        training.markFocusLost();
        this.finishTrainingOrAssessment(true);
      } else {
        training?.typingEngine.markIdleBreak();
      }
      if (this.activeSession) {
        this.activeSession.typingEngine.markIdleBreak();
        // Auto-pause active wave combat when window loses focus so the player is not penalized
        if (this.activeSession.waveSystem.isWaveActive() && !this.activeSession.isSessionOver()) {
          this.activeSession.setPaused(true);
          this.updateGameplayHudInPlace();
        }
      }
      this.audio.stopMusic();
      this.persistence.flushSave();
    });

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        const training = this.trainingState.activeEngine;
        if (training?.mode === 'assessment' && training.started) {
          training.markFocusLost();
          this.finishTrainingOrAssessment(true);
        } else {
          training?.typingEngine.markIdleBreak();
        }
        if (this.activeSession) {
          this.activeSession.typingEngine.markIdleBreak();
          if (this.activeSession.waveSystem.isWaveActive() && !this.activeSession.isSessionOver()) {
            this.activeSession.setPaused(true);
            this.updateGameplayHudInPlace();
          }
        }
        this.persistence.flushSave();
      }
    });

    window.addEventListener('keydown', (e: KeyboardEvent) => {
      if (
        this.currentScreen === 'training_academy' &&
        this.trainingState.activeEngine &&
        !this.trainingState.activeEngine.completed
      ) {
        const target = e.target as HTMLElement | null;
        if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) {
          return;
        }
        if (e.isComposing || e.metaKey || target?.isContentEditable || (e.ctrlKey && !e.getModifierState('AltGraph') && !e.altKey) || (e.altKey && !e.getModifierState('AltGraph') && !e.ctrlKey)) {
          return;
        }
        if (e.key === ' ' || e.key === '/' || e.key === "'") {
          e.preventDefault();
        }
        if (this.advanceTrainingClock()) return;
        const tRes = this.trainingState.activeEngine.handleKey(e.key, Date.now(), e.repeat);
        if (tRes && !tRes.ignored) {
          this.audio.playKeystroke(tRes.isCorrect, tRes.combo);
          this.renderCurrentScreen();
        }
        return;
      }

      if (this.currentScreen !== 'gameplay' || !this.activeSession) return;
      if (this.container.querySelector('[data-testid="switch-profile-confirm-modal"]')) return;
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
        if (this.activeSession.mode !== 'sandbox') {
          const ownerProfile =
            this.persistence.getProfileById(this.activeSession.ownerProfileId) ??
            this.activeSession.getOwnerProfile();
          ownerProfile.totalCharsTyped += 1;
          if (res.isCorrect) ownerProfile.totalCorrectChars += 1;
          ownerProfile.bestCombo = Math.max(ownerProfile.bestCombo, res.maxCombo);
          ownerProfile.bestWpm = Math.max(
            ownerProfile.bestWpm,
            this.activeSession.typingEngine.getWpm()
          );
          ownerProfile.lastActiveAt = Date.now();
          this.persistence.requestThrottledSave(2000);
        }

        if (!res.isCorrect) {
          this.hadActiveErrorHighlight = true;
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
    this.lastHudSnapshot = null;

    if (typeof document !== 'undefined') {
      document.body.classList.toggle('in-gameplay', this.currentScreen === 'gameplay');
    }

    const storageBannerHtml = '<div id="storage-warning-slot"></div>';

    this.container.innerHTML = `
      <div class="app-shell ${this.currentScreen === 'gameplay' ? 'app-shell-gameplay' : ''}" data-screen="${this.currentScreen}">
        ${storageBannerHtml}
        ${this.currentScreen === 'gameplay' ? this.renderGameplayHeaderHtml() : this.renderTopHeaderHtml()}
        <main id="screen-content" class="${this.currentScreen === 'gameplay' ? 'screen-content-gameplay' : ''}">
          ${this.renderScreenBodyHtml()}
        </main>
        <div id="modal-container"></div>
      </div>
    `;

    this.attachScreenListeners();
    this.updateStorageWarning();
  }

  private updateStorageWarning(): void {
    const slot = this.container.querySelector('#storage-warning-slot');
    if (!slot) return;
    const error = this.persistence.getLastStorageError();
    if (!error && !slot.hasChildNodes()) return;
    if (error && slot.getAttribute('data-error') === error) return;
    slot.setAttribute('data-error', error ?? '');
    slot.innerHTML = error ? `<div class="storage-warning-banner" role="alert" data-testid="storage-warning-banner">
      <span>⚠️ ${escapeHtml(error)}</span>
      <button class="nav-btn" data-action="backup-storage">${this.i18n.pick('Eksportuj kopię', 'Export backup')}</button>
    </div>` : '';
    slot.querySelector('[data-action="backup-storage"]')?.addEventListener('click', () => {
      const url = URL.createObjectURL(new Blob([this.persistence.exportSaveJson()], { type: 'application/json' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = 'keyfort-backup.json';
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
  }

  private renderGameplayHeaderHtml(): string {
    const profile = this.persistence.getActiveProfile();
    const allProfiles = this.persistence.getAllProfiles();
    const session = this.activeSession;
    const lang = this.i18n.getLanguage();
    const isFs = typeof document !== 'undefined' && Boolean(document.fullscreenElement);
    const missionSubtitle = session
      ? session.mode === 'survival'
        ? this.i18n.pick('♾️ Tryb Przetrwania', '♾️ Survival Mode')
        : session.mode === 'sandbox'
        ? this.i18n.pick('🧪 Poligon Doświadczalny', '🧪 Sandbox Mode')
        : `${session.mission.worldId}.${session.mission.missionIndex} ${escapeHtml(this.i18n.pick(session.mission.namePl, session.mission.nameEn))}`
      : '';
    const diffBadge = session
      ? `<span class="key-obj-pill" style="font-size:0.65rem; padding:0.04rem 0.35rem;">${escapeHtml(session.difficulty)}</span>`
      : '';

    const profileSwitcherHtml =
      allProfiles.length > 1
        ? `<select id="header-profile-switcher" data-testid="header-profile-switcher" class="header-profile-select" style="height:22px; font-size:0.68rem; padding:0.05rem 0.25rem;" title="${escapeHtml(this.i18n.pick('Szybkie przełączanie gracza', 'Quick player switch'))}">
            ${allProfiles
              .map(
                (p) =>
                  `<option value="${escapeHtml(p.id)}" ${p.id === profile.id ? 'selected' : ''}>
                    ${escapeHtml(p.avatarIcon)} ${escapeHtml(p.name)}
                  </option>`
              )
              .join('')}
          </select>`
        : '';

    return `
      <header class="gameplay-header" data-testid="gameplay-header">
        <div class="gameplay-header-left">
          <div class="brand-group" data-action="exit-gameplay" data-testid="gameplay-home-btn" title="${this.i18n.pick('Zakończ misję i wróć do mapy', 'Exit mission to map')}">
            <div class="brand-logo" style="width:24px; height:24px; font-size:0.85rem;">🏰</div>
            <span class="gameplay-player-badge" data-testid="gameplay-player-badge">
              ${escapeHtml(profile.avatarIcon)} <strong data-testid="active-profile-name">${escapeHtml(profile.name)}</strong>
            </span>
          </div>
          ${profileSwitcherHtml}
          <span class="gameplay-mission-tag" data-testid="gameplay-mission-tag">
            ${missionSubtitle} ${diffBadge}
          </span>
        </div>

        <div class="gameplay-header-center" id="gameplay-header-status">
          ${session?.getIsPaused() ? `<span class="mode-badge drill" style="background:#ca8a04; color:#fff;">⏸ ${this.i18n.pick('GRA WSTRZYMANA', 'PAUSED')}</span>` : ''}
        </div>

        <div class="gameplay-header-right">
          <button class="nav-btn hud-fixed-pause-btn" data-action="toggle-pause" data-testid="gameplay-header-pause-btn" style="height:24px; font-size:0.7rem;">
            ${session?.getIsPaused() ? `▶ ${this.i18n.t('hud.resume')}` : `⏸ ${this.i18n.t('hud.pause')}`}
          </button>
          <button class="nav-btn" data-action="toggle-fullscreen" data-testid="toggle-fullscreen-btn" style="height:24px; font-size:0.7rem;" title="${this.i18n.pick('Przełącz tryb pełnoekranowy (F11)', 'Toggle fullscreen mode (F11)')}">
            ${isFs ? `↙ ${this.i18n.pick('Okno', 'Exit Fullscreen')}` : `⛶ ${this.i18n.pick('Pełny ekran', 'Fullscreen')}`}
          </button>
          <button class="lang-toggle-btn" data-action="toggle-lang" data-testid="lang-toggle-btn" style="height:24px; font-size:0.7rem; padding:0.18rem 0.42rem;">
            🌐 ${lang.toUpperCase()}
          </button>
          <button class="nav-btn" style="border-color:#f43f5e; color:#fda4af; height:24px; font-size:0.7rem;" data-action="exit-gameplay" data-testid="exit-gameplay-btn" title="${this.i18n.pick('Zakończ misję', 'Exit mission')}">
            ✕ ${this.i18n.pick('Wyjdź', 'Exit')}
          </button>
        </div>
      </header>
    `;
  }

  private renderTopHeaderHtml(): string {
    const profile = this.persistence.getActiveProfile();
    const allProfiles = this.persistence.getAllProfiles();
    const lang = this.i18n.getLanguage();
    const xpReq = ProgressionEngine.getRequiredXpForLevel(profile.level);

    const profileSwitcherHtml =
      allProfiles.length > 1
        ? `<select id="header-profile-switcher" data-testid="header-profile-switcher" class="header-profile-select" title="${escapeHtml(this.i18n.pick('Szybkie przełączanie gracza', 'Quick player switch'))}">
            ${allProfiles
              .map(
                (p) =>
                  `<option value="${escapeHtml(p.id)}" ${p.id === profile.id ? 'selected' : ''}>
                    ${escapeHtml(p.avatarIcon)} ${escapeHtml(p.name)} (Lv ${p.level})
                  </option>`
              )
              .join('')}
          </select>`
        : '';

    return `
      <header class="top-header">
        <div class="brand-group" data-action="go-menu" data-testid="brand-home">
          ${SvgArtwork.brandLogo(28)}
          <div>
            <div class="brand-title">${this.i18n.t('app.title')}</div>
            <div class="brand-tagline">${this.i18n.t('app.tagline')}</div>
          </div>
        </div>

        <nav class="top-nav-links">
          <button class="nav-btn ${this.currentScreen === 'main_menu' ? 'active' : ''}" data-nav="main_menu" data-testid="nav-menu" title="${escapeHtml(this.i18n.t('nav.backToMenu'))}">
            🏠 ${this.i18n.pick('Menu', 'Menu')}
          </button>
          <button class="nav-btn ${this.currentScreen === 'campaign_map' ? 'active' : ''}" data-nav="campaign_map" data-testid="nav-campaign" title="${escapeHtml(this.i18n.t('menu.campaign'))}">
            🗺️ ${this.i18n.pick('Kampania', 'Campaign')}
          </button>
          <button class="nav-btn ${this.currentScreen === 'training_academy' ? 'active' : ''}" data-nav="training_academy" data-testid="nav-training-academy" title="${escapeHtml(this.i18n.pick('Akademia Pisania i Testy', 'Training Academy & Tests'))}">
            🎓 ${this.i18n.pick('Akademia', 'Academy')}
          </button>
          <button class="nav-btn ${this.currentScreen === 'challenges' ? 'active' : ''}" data-nav="challenges" data-testid="nav-challenges" title="${escapeHtml(this.i18n.pick('Wyzwania, Bohaterowie i Technologia', 'Challenges, Heroes & Tech'))}">
            ⚔️ ${this.i18n.pick('Wyzwania', 'Challenges')}
          </button>
          <button class="nav-btn ${this.currentScreen === 'survival_setup' ? 'active' : ''}" data-nav="survival_setup" data-testid="nav-survival" title="${escapeHtml(this.i18n.t('menu.survival'))}">
            ♾️ ${this.i18n.pick('Przetrwanie', 'Survival')}
          </button>
          <button class="nav-btn ${this.currentScreen === 'sandbox_setup' ? 'active' : ''}" data-nav="sandbox_setup" data-testid="nav-sandbox" title="${escapeHtml(this.i18n.t('menu.sandbox'))}">
            🧪 ${this.i18n.pick('Sandbox', 'Sandbox')}
          </button>
          <button class="nav-btn ${this.currentScreen === 'family_dashboard' ? 'active' : ''}" data-nav="family_dashboard" data-testid="nav-family-dashboard" title="${escapeHtml(this.i18n.pick('Ranking rodzinny', 'Family Dashboard'))}">
            👨‍👩‍👧 ${this.i18n.pick('Rodzina', 'Family')}
          </button>
          <button class="nav-btn ${this.currentScreen === 'statistics' ? 'active' : ''}" data-nav="statistics" data-testid="nav-statistics" title="${escapeHtml(this.i18n.t('menu.statistics'))}">
            📊 ${this.i18n.pick('Statystyki', 'Stats')}
          </button>
          <button class="nav-btn ${this.currentScreen === 'achievements' ? 'active' : ''}" data-nav="achievements" data-testid="nav-achievements" title="${escapeHtml(this.i18n.t('menu.achievements'))}">
            🏆 ${this.i18n.pick('Nagrody', 'Rewards')}
          </button>
          <button class="nav-btn ${this.currentScreen === 'settings' ? 'active' : ''}" data-nav="settings" data-testid="nav-settings" title="${escapeHtml(this.i18n.t('menu.settings'))}">
            ⚙️ ${this.i18n.pick('Opcje', 'Settings')}
          </button>
        </nav>

        <div class="header-right-controls">
          ${profileSwitcherHtml}
          <div class="profile-pill" data-nav="profiles" data-testid="nav-profiles">
            <span>${escapeHtml(profile.avatarIcon)}</span>
            <strong data-testid="active-profile-name">${escapeHtml(profile.name)}</strong>
            <span style="color:#38bdf8;">Lv ${profile.level} (${profile.xp}/${xpReq})</span>
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
    const allProfiles = this.persistence.getAllProfiles();
    switch (this.currentScreen) {
      case 'main_menu':
        return MainMenuView.renderHtml(profile, allProfiles, this.i18n);
      case 'campaign_map':
        return CampaignMapView.renderHtml(this.selectedWorldId, profile, this.i18n);
      case 'training_academy':
        return TrainingAcademyView.renderHtml(profile, allProfiles, this.trainingState, this.i18n);
      case 'challenges':
        return ChallengesView.renderHtml(profile, allProfiles, this.selectedChallengeTier, this.i18n);
      case 'gameplay':
        return this.activeSession
          ? GameplayView.renderGameplayLayoutHtml(
              this.activeSession,
              this.activeSession.getOwnerProfile(),
              this.i18n
            )
          : '';
      case 'survival_setup':
        return DashboardViews.renderSurvivalSetupHtml(profile, this.i18n);
      case 'sandbox_setup':
        return DashboardViews.renderSandboxSetupHtml(this.i18n);
      case 'family_dashboard':
        return FamilyDashboardView.renderHtml(allProfiles, this.familyState, this.i18n);
      case 'statistics':
        return DashboardViews.renderStatisticsHtml(profile, this.i18n);
      case 'achievements':
        return DashboardViews.renderAchievementsHtml(profile, this.i18n);
      case 'profiles':
        return DashboardViews.renderProfilesHtml(
          this.persistence,
          this.importStatusMessage,
          this.i18n
        );
      case 'settings':
        return DashboardViews.renderSettingsHtml(profile, this.i18n);
      default:
        return MainMenuView.renderHtml(profile, allProfiles, this.i18n);
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
      this.audio.stopMusic();
      this.navigateTo('campaign_map');
    });
    modalContainer.querySelector('[data-action="modal-back-challenges"]')?.addEventListener('click', () => {
      this.audio.stopMusic();
      this.navigateTo('challenges');
    });
    modalContainer.querySelector('[data-action="modal-retry"]')?.addEventListener('click', () => {
      if (session.mode === 'challenge' && session.challengeConfig) {
        this.launchChallengeFromConfig(session.challengeConfig);
        return;
      }
      // Preserve original sourceMissionId, mode, and launchOptions for Survival & Sandbox retries!
      this.startMission(session.sourceMissionId, session.mode, session.launchOptions);
    });
    modalContainer.querySelector('[data-action="modal-next-mission"]')?.addEventListener('click', (e) => {
      const nextId = (e.currentTarget as HTMLElement).getAttribute('data-next-id');
      if (nextId) {
        this.startMission(nextId, 'campaign');
      }
    });
  }

  public updateWavePreviewInPlace(): void {
    const session = this.activeSession;
    if (!session) return;
    const bar = document.getElementById('hud-wave-preview-bar');
    if (bar) {
      bar.innerHTML = GameplayView.buildWavePreviewInnerHtml(session, this.i18n);
    }
  }

  /**
   * Diff-checked in-place HUD updater: only mutates DOM text/attributes that actually changed.
   */
  public updateGameplayHudInPlace(): void {
    const session = this.activeSession;
    if (!session) return;

    const livesEl = document.getElementById('hud-lives-value');
    if (!livesEl) {
      const hudContainer = document.getElementById('gameplay-hud-container');
      if (hudContainer) {
        hudContainer.innerHTML = GameplayView.buildGameplayHudHtml(
          session,
          session.getOwnerProfile(),
          this.i18n
        );
        this.attachHudListeners(hudContainer);
      }
      return;
    }

    const economy = session.economy;
    const typing = session.typingEngine;
    const powerState = session.getPowerState();
    const energyMax = economy.getMaxEnergy();
    const energyPct = Math.min(100, Math.round((economy.getEnergy() / energyMax) * 100));
    const reqChars = session.getRequiredCharsForVictory();
    const empCd = session.getAbilityCooldown('emp');
    const overCd = session.getAbilityCooldown('overdrive');
    const orbCd = session.getAbilityCooldown('orbital');

    const nextSnap: HudSnapshot = {
      lives: `${session.getLives()}/${session.getMaxLives()}`,
      gold: `${economy.getGold()}`,
      energy: economy.getEnergy().toFixed(1),
      energyMax: `${energyMax}`,
      energyPct,
      powerStateClass: `power-badge ${powerState}`,
      powerStateText: GameplayView.formatPowerStateLabel(session, this.i18n),
      wave: `${session.waveSystem.getCurrentWaveNumber()}/${session.mode === 'survival' ? '∞' : session.mission.waves.length}`,
      goalText: reqChars > 0 ? `${typing.getTotalCorrect()}/${reqChars}` : `${typing.getTotalCorrect()}`,
      goalColor: reqChars > 0 && typing.getTotalCorrect() >= reqChars ? '#4ade80' : '#38bdf8',
      startWaveDisabled: session.waveSystem.isWaveActive() || !session.waveSystem.hasMoreWaves(),
      speedText: `${session.getGameSpeed()}x`,
      pauseText: session.getIsPaused()
        ? `▶ ${this.i18n.t('hud.resume')}`
        : `⏸ ${this.i18n.t('hud.pause')}`,
      empDisabled: !session.canUseAbility('emp'),
      empMeta: empCd > 0 ? `${empCd}s` : '35⚡',
      overDisabled: !session.canUseAbility('overdrive'),
      overMeta: overCd > 0 ? `${overCd}s` : '45⚡',
      orbDisabled: !session.canUseAbility('orbital'),
      orbMeta: orbCd > 0 ? `${orbCd}s` : '65⚡',
      combo: `${typing.getCombo()}`,
      accuracy: typing.getTotalAttempts() > 0 ? `${Math.round(typing.getAccuracy() * 100)}%` : '—',
      wpm: `${typing.getWpm()}`,
    };

    const prev = this.lastHudSnapshot;
    if (!prev || prev.lives !== nextSnap.lives) {
      livesEl.textContent = nextSnap.lives;
    }
    if (!prev || prev.gold !== nextSnap.gold) {
      const goldEl = document.getElementById('hud-gold-value');
      if (goldEl) goldEl.textContent = nextSnap.gold;
    }
    if (!prev || prev.energy !== nextSnap.energy) {
      const energyEl = document.getElementById('hud-energy-value');
      if (energyEl) energyEl.textContent = nextSnap.energy;
    }
    if (!prev || prev.energyMax !== nextSnap.energyMax) {
      const energyMaxEl = document.getElementById('hud-energy-max');
      if (energyMaxEl) energyMaxEl.textContent = nextSnap.energyMax;
    }
    if (!prev || prev.energyPct !== nextSnap.energyPct) {
      const energyBarEl = document.getElementById('hud-energy-bar') as HTMLElement | null;
      if (energyBarEl) energyBarEl.style.width = `${nextSnap.energyPct}%`;
    }
    if (
      !prev ||
      prev.powerStateClass !== nextSnap.powerStateClass ||
      prev.powerStateText !== nextSnap.powerStateText
    ) {
      const powerEl = document.getElementById('hud-power-state');
      if (powerEl) {
        powerEl.className = nextSnap.powerStateClass;
        powerEl.textContent = nextSnap.powerStateText;
      }
    }
    if (!prev || prev.wave !== nextSnap.wave) {
      const waveEl = document.getElementById('hud-wave-value');
      if (waveEl) waveEl.textContent = nextSnap.wave;
    }
    if (!prev || prev.goalText !== nextSnap.goalText || prev.goalColor !== nextSnap.goalColor) {
      const goalEl = document.getElementById('hud-typing-goal-value') as HTMLElement | null;
      if (goalEl) {
        goalEl.textContent = nextSnap.goalText;
        goalEl.style.color = nextSnap.goalColor;
      }
    }
    if (!prev || prev.startWaveDisabled !== nextSnap.startWaveDisabled) {
      const startWaveBtn = document.getElementById('hud-start-wave-btn') as HTMLButtonElement | null;
      if (startWaveBtn) startWaveBtn.disabled = nextSnap.startWaveDisabled;
    }
    if (!prev || prev.speedText !== nextSnap.speedText) {
      const speedBtn = document.getElementById('hud-speed-btn');
      if (speedBtn) speedBtn.textContent = nextSnap.speedText;
    }
    if (!prev || prev.pauseText !== nextSnap.pauseText) {
      const pauseBtn = document.getElementById('hud-pause-btn');
      if (pauseBtn) pauseBtn.textContent = nextSnap.pauseText;
      const headerPauseBtn = this.container.querySelector('[data-testid="gameplay-header-pause-btn"]');
      if (headerPauseBtn) headerPauseBtn.textContent = nextSnap.pauseText;
      const headerStatus = document.getElementById('gameplay-header-status');
      if (headerStatus) {
        headerStatus.innerHTML = session.getIsPaused()
          ? `<span class="mode-badge drill" style="background:#ca8a04; color:#fff;">⏸ ${this.i18n.pick('GRA WSTRZYMANA', 'PAUSED')}</span>`
          : '';
      }
    }
    if (!prev || prev.empDisabled !== nextSnap.empDisabled || prev.empMeta !== nextSnap.empMeta) {
      const empBtn = document.getElementById('hud-ability-emp') as HTMLButtonElement | null;
      if (empBtn) empBtn.disabled = nextSnap.empDisabled;
      const empMetaEl = document.getElementById('hud-ability-emp-meta');
      if (empMetaEl) empMetaEl.textContent = nextSnap.empMeta;
    }
    if (!prev || prev.overDisabled !== nextSnap.overDisabled || prev.overMeta !== nextSnap.overMeta) {
      const overBtn = document.getElementById('hud-ability-overdrive') as HTMLButtonElement | null;
      if (overBtn) overBtn.disabled = nextSnap.overDisabled;
      const overMetaEl = document.getElementById('hud-ability-overdrive-meta');
      if (overMetaEl) overMetaEl.textContent = nextSnap.overMeta;
    }
    if (!prev || prev.orbDisabled !== nextSnap.orbDisabled || prev.orbMeta !== nextSnap.orbMeta) {
      const orbBtn = document.getElementById('hud-ability-orbital') as HTMLButtonElement | null;
      if (orbBtn) orbBtn.disabled = nextSnap.orbDisabled;
      const orbMetaEl = document.getElementById('hud-ability-orbital-meta');
      if (orbMetaEl) orbMetaEl.textContent = nextSnap.orbMeta;
    }
    if (!prev || prev.combo !== nextSnap.combo) {
      const comboEl = document.getElementById('hud-combo-value');
      if (comboEl) comboEl.textContent = nextSnap.combo;
    }
    if (!prev || prev.accuracy !== nextSnap.accuracy) {
      const accEl = document.getElementById('hud-accuracy-value');
      if (accEl) accEl.textContent = nextSnap.accuracy;
    }
    if (!prev || prev.wpm !== nextSnap.wpm) {
      const wpmEl = document.getElementById('hud-wpm-value');
      if (wpmEl) wpmEl.textContent = nextSnap.wpm;
    }

    this.updateHeroHudInPlace();
    this.lastHudSnapshot = nextSnap;
  }

  private updateHeroHudInPlace(): void {
    const session = this.activeSession;
    const hero = session?.getHero();
    if (!session || !hero) return;
    const def = HEROES_DATA[hero.id];
    const xpText = `Lv ${hero.level} • ${hero.xp}/${hero.level * 120} XP`;
    const xp = this.container.querySelector('[data-testid="hero-xp"]');
    if (xp && xp.textContent !== xpText) xp.textContent = xpText;
    for (const slot of [0, 1] as const) {
      const btn = this.container.querySelector<HTMLButtonElement>(`[data-hero-ability="${slot}"]`);
      if (!btn) continue;
      const cd = Math.ceil(hero.abilityCooldowns[slot]);
      const disabled = !session.canTriggerHeroAbility(slot);
      if (btn.disabled !== disabled) btn.disabled = disabled;
      const meta = btn.querySelector('.ability-btn-meta');
      const text = cd > 0 ? `${cd}s` : `${def.abilities[slot].energyCost}⚡`;
      if (meta && meta.textContent !== text) meta.textContent = text;
    }
  }

  private clearConsoleErrorHighlightInPlace(): void {
    const consoleContainer = document.getElementById('typing-console-container');
    if (!consoleContainer) return;
    consoleContainer.querySelectorAll('.char-error').forEach((el) => {
      el.classList.remove('char-error');
      el.setAttribute('data-has-error', '0');
    });
    consoleContainer.querySelectorAll('.sequence-box-error').forEach((el) => {
      el.classList.remove('sequence-box-error');
    });
    consoleContainer.querySelectorAll('.vk-key-wrong').forEach((el) => {
      el.classList.remove('vk-key-wrong');
    });
  }

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
        this.activeSession.getOwnerProfile(),
        this.i18n
      );
    }
  }

  private updateSidebarInPlace(): void {
    const sidebar = document.getElementById('tactical-sidebar-container');
    if (sidebar && this.activeSession) {
      sidebar.innerHTML = GameplayView.buildTacticalSidebarHtml(
        this.activeSession,
        this.activeSession.getOwnerProfile(),
        this.i18n
      );
      this.attachSidebarListeners(sidebar);
    }
  }

  private attachHudListeners(root: HTMLElement): void {
    root.querySelector('[data-action="start-wave"]')?.addEventListener('click', () => {
      this.activeSession?.startNextWave();
      this.updateWavePreviewInPlace();
      this.updateGameplayHudInPlace();
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

    root.querySelectorAll('[data-hero-ability]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const slot = Number((e.currentTarget as HTMLElement).getAttribute('data-hero-ability')) as 0 | 1;
        if (this.activeSession?.triggerHeroAbility(slot)) {
          this.updateGameplayHudInPlace();
          this.updateSidebarInPlace();
        }
      });
    });
  }

  private attachSidebarListeners(root: HTMLElement): void {
    root.querySelector('[data-action="start-wave"]')?.addEventListener('click', () => {
      this.activeSession?.startNextWave();
      this.updateWavePreviewInPlace();
      this.updateGameplayHudInPlace();
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

    root.querySelectorAll('[data-hero-ability]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const slot = Number((e.currentTarget as HTMLElement).getAttribute('data-hero-ability')) as 0 | 1;
        if (this.activeSession?.triggerHeroAbility(slot)) {
          this.updateGameplayHudInPlace();
          this.updateSidebarInPlace();
        }
      });
    });

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
            const ownerProfile =
              this.persistence.getProfileById(this.activeSession.ownerProfileId) ??
              this.activeSession.getOwnerProfile();
            AchievementSystem.evaluateAndUnlock(ownerProfile, {
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

    const headerSwitcher = document.getElementById('header-profile-switcher') as HTMLSelectElement | null;
    headerSwitcher?.addEventListener('change', () => {
      this.requestProfileSwitch(headerSwitcher.value, false);
    });

    this.container.querySelector('[data-action="toggle-lang"]')?.addEventListener('click', () => {
      const profile = this.persistence.getActiveProfile();
      const nextLang = profile.settings.language === 'pl' ? 'en' : 'pl';
      profile.settings.language = nextLang;
      if (this.activeSession && this.activeSession.ownerProfileId === profile.id) {
        this.activeSession.getOwnerProfile().settings.language = nextLang;
      }
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
        this.renderer.render(
          this.activeSession,
          this.activeSession.getOwnerProfile(),
          0.016
        );

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

      this.container.querySelectorAll('[data-action="exit-gameplay"]').forEach((btn) => {
        btn.addEventListener('click', () => {
          if (this.activeSession) {
            if (!this.activeSession.isFinalized()) {
              this.finalizeSession(this.activeSession, this.activeSession.isSessionOver() ? 'completed' : 'abandoned');
            }
            this.stopGameLoop();
            this.activeSession = null;
          }
          this.navigateTo('campaign_map');
        });
      });

      this.container.querySelectorAll('[data-action="toggle-fullscreen"]').forEach((btn) => {
        btn.addEventListener('click', () => {
          this.toggleFullscreen();
        });
      });

      this.container.querySelectorAll('.gameplay-header [data-action="toggle-pause"]').forEach((btn) => {
        btn.addEventListener('click', () => {
          if (!this.activeSession) return;
          this.activeSession.setPaused(!this.activeSession.getIsPaused());
          this.updateGameplayHudInPlace();
        });
      });
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

    // Training Academy & Standardized Tests listeners
    this.container.querySelectorAll('[data-academy-tab]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const tab = (e.currentTarget as HTMLElement).getAttribute('data-academy-tab') as 'drills' | 'standardized';
        this.trainingState.tab = tab;
        this.renderCurrentScreen();
      });
    });

    this.container.querySelectorAll('[data-start-training]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const kind = (e.currentTarget as HTMLElement).getAttribute('data-start-training') as TrainingActivityKind;
        this.startTrainingOrAssessment('training', kind);
      });
    });

    this.container.querySelectorAll('[data-std-dur]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        this.trainingState.stdDuration = Number((e.currentTarget as HTMLElement).getAttribute('data-std-dur')) as 0 | 30 | 60 | 120;
        this.renderCurrentScreen();
      });
    });

    this.container.querySelectorAll('[data-std-pool]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        this.trainingState.stdPool = (e.currentTarget as HTMLElement).getAttribute('data-std-pool') as 'beginner' | 'full';
        this.renderCurrentScreen();
      });
    });

    this.container.querySelector('[data-action="start-standardized-test"]')?.addEventListener('click', () => {
      this.startTrainingOrAssessment('assessment');
    });

    this.container.querySelector('[data-action="finish-training"]')?.addEventListener('click', () => {
      this.finishTrainingOrAssessment();
    });

    // Challenges, Heroes & Tech Tree listeners
    this.container.querySelectorAll('[data-challenge-tier]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const tier = (e.currentTarget as HTMLElement).getAttribute('data-challenge-tier') as ChallengeTier;
        const profile = this.persistence.getActiveProfile();
        if (ChallengeEngine.isTierEligible(profile, tier)) {
          this.selectedChallengeTier = tier;
          this.renderCurrentScreen();
        }
      });
    });

    this.container.querySelectorAll('[data-start-challenge]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const freq = (e.currentTarget as HTMLElement).getAttribute('data-start-challenge') as 'daily' | 'weekly';
        const tier = (e.currentTarget as HTMLElement).getAttribute('data-challenge-tier') as ChallengeTier;
        this.startChallenge(freq, tier);
      });
    });

    this.container.querySelectorAll('[data-unlock-tech]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const techId = (e.currentTarget as HTMLElement).getAttribute('data-unlock-tech');
        if (!techId) return;
        const profile = this.persistence.getActiveProfile();
        const res = TechnologySystem.purchaseTechnology(profile, techId);
        if (res.success) {
          this.audio.playUpgrade();
          this.persistence.saveToStorage();
          this.renderCurrentScreen();
        }
      });
    });

    this.container.querySelectorAll('[data-select-hero]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const heroId = (e.currentTarget as HTMLElement).getAttribute('data-select-hero') as HeroId;
        const profile = this.persistence.getActiveProfile();
        if ((profile.unlockedHeroes ?? []).includes(heroId)) {
          profile.selectedHeroId = heroId;
          profile.explicitNoHero = false;
          this.persistence.saveToStorage();
          this.renderCurrentScreen();
        }
      });
    });

    this.container.querySelector('[data-action="clear-hero"]')?.addEventListener('click', () => {
      const profile = this.persistence.getActiveProfile();
      profile.selectedHeroId = null;
      profile.explicitNoHero = true;
      this.persistence.saveToStorage();
      this.renderCurrentScreen();
    });

    // Family Dashboard listeners
    this.container.querySelectorAll('[data-sort-metric]').forEach((th) => {
      th.addEventListener('click', (e) => {
        const metric = (e.currentTarget as HTMLElement).getAttribute(
          'data-sort-metric'
        ) as FamilySortMetric;
        if (this.familyState.sortBy === metric) {
          this.familyState.sortDesc = !this.familyState.sortDesc;
        } else {
          this.familyState.sortBy = metric;
          this.familyState.sortDesc = true;
        }
        this.renderCurrentScreen();
      });
    });

    this.container.querySelectorAll('[data-date-range]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        this.familyState.dateRange = (e.currentTarget as HTMLElement).getAttribute(
          'data-date-range'
        ) as ComparisonDateRange;
        this.renderCurrentScreen();
      });
    });

    this.container.querySelectorAll<HTMLInputElement>('[data-compare-profile]').forEach((chk) => {
      chk.addEventListener('change', () => {
        const pId = chk.getAttribute('data-compare-profile')!;
        if (chk.checked) {
          if (!this.familyState.selectedProfileIds.includes(pId)) {
            this.familyState.selectedProfileIds.push(pId);
          }
        } else {
          this.familyState.selectedProfileIds = this.familyState.selectedProfileIds.filter(
            (id) => id !== pId
          );
        }
        this.renderCurrentScreen();
      });
    });

    const lbMissionSel = document.getElementById(
      'leaderboard-mission-select'
    ) as HTMLSelectElement | null;
    lbMissionSel?.addEventListener('change', () => {
      this.familyState.leaderboardMissionId = lbMissionSel.value;
      this.renderCurrentScreen();
    });

    this.container.querySelectorAll('[data-leaderboard-diff]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        this.familyState.leaderboardDifficulty = (e.currentTarget as HTMLElement).getAttribute(
          'data-leaderboard-diff'
        ) as DifficultyLevel | 'all';
        this.renderCurrentScreen();
      });
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

    // Profiles & Family Quick Setup listeners
    this.container.querySelector('[data-action="create-profile"]')?.addEventListener('click', () => {
      const input = document.getElementById('new-profile-name-input') as HTMLInputElement | null;
      const avatarSel = document.getElementById(
        'new-profile-avatar-select'
      ) as HTMLSelectElement | null;
      const name = input?.value.trim();
      if (name) {
        this.persistence.createProfile(name, avatarSel?.value ?? '🚀');
        this.applyActiveProfileSettings();
        this.ensureFamilyComparisonSelection();
        this.renderCurrentScreen();
      }
    });

    this.container.querySelector('[data-action="family-batch-setup"]')?.addEventListener('click', () => {
      const entries: Array<{ name: string; avatarIcon?: string }> = [];
      for (const idx of [1, 2, 3]) {
        const nameEl = document.getElementById(`family-setup-name-${idx}`) as HTMLInputElement | null;
        const avEl = document.getElementById(`family-setup-avatar-${idx}`) as HTMLSelectElement | null;
        const nameVal = nameEl?.value.trim() ?? '';
        if (nameVal) {
          entries.push({ name: nameVal, avatarIcon: avEl?.value });
        }
      }
      const assignExisting =
        (document.getElementById('family-setup-assign-existing') as HTMLInputElement | null)
          ?.checked ?? true;
      if (entries.length > 0) {
        this.persistence.setupFamilyProfiles(entries, {
          assignExistingToFirst: assignExisting,
          assignExistingProfileId: assignExisting ? this.persistence.getActiveProfile().id : undefined,
        });
        this.applyActiveProfileSettings();
        this.ensureFamilyComparisonSelection();
        this.renderCurrentScreen();
      }
    });

    this.container.querySelectorAll('[data-assign-profile]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const pId = (e.currentTarget as HTMLElement).getAttribute('data-assign-profile');
        if (!pId) return;
        const input = this.container.querySelector(
          `[data-rename-input="${CSS.escape(pId)}"]`
        ) as HTMLInputElement | null;
        const newName = input?.value.trim();
        if (newName) {
          this.persistence.assignOrRenameProfile(pId, newName);
          this.renderCurrentScreen();
        }
      });
    });

    this.container.querySelectorAll('[data-switch-profile]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const pId = (e.currentTarget as HTMLElement).getAttribute('data-switch-profile');
        if (pId) {
          this.requestProfileSwitch(pId, false);
        }
      });
    });

    this.container.querySelectorAll('[data-play-profile]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const pId = (e.currentTarget as HTMLElement).getAttribute('data-play-profile');
        if (pId) {
          this.requestProfileSwitch(pId, true);
        }
      });
    });

    this.container.querySelectorAll('[data-request-reset-profile]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const pId = (e.currentTarget as HTMLElement).getAttribute('data-request-reset-profile');
        if (pId) {
          this.renderDestructiveProfileConfirmModal(pId, 'reset');
        }
      });
    });

    this.container.querySelectorAll('[data-request-delete-profile]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const pId = (e.currentTarget as HTMLElement).getAttribute('data-request-delete-profile');
        if (pId) {
          this.renderDestructiveProfileConfirmModal(pId, 'delete');
        }
      });
    });

    this.container.querySelector('[data-action="download-save-json"]')?.addEventListener('click', () => {
      this.triggerDownloadSaveJson();
    });

    this.container.querySelector('[data-action="import-save-json"]')?.addEventListener('click', () => {
      const area = document.getElementById('save-json-textarea') as HTMLTextAreaElement | null;
      if (!area) return;
      const res = this.persistence.importSaveJson(area.value);
      if (res.success) {
        this.applyActiveProfileSettings();
        this.ensureFamilyComparisonSelection();
      }
      this.importStatusMessage = res.success
        ? this.i18n.pick('✓ Zapis zaimportowany pomyślnie!', '✓ Save data imported successfully!')
        : `❌ ${res.error}`;
      this.renderCurrentScreen();
    });

    this.container.querySelector('[data-action="reset-profile"]')?.addEventListener('click', () => {
      this.renderDestructiveProfileConfirmModal(this.persistence.getActiveProfile().id, 'reset');
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
      profile.settings.difficulty = diffSel.value as DifficultyLevel;
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

  private startTrainingOrAssessment(mode: 'training' | 'assessment', activityKind?: TrainingActivityKind): void {
    this.finishTrainingOrAssessment(true, false);
    const profile = this.persistence.getActiveProfile();
    if (this.trainingTickIntervalId !== null) {
      window.clearInterval(this.trainingTickIntervalId);
      this.trainingTickIntervalId = null;
    }
    this.trainingState.lastResult = null;
    if (activityKind) this.trainingState.selectedActivity = activityKind;
    this.trainingState.activeEngine = new TrainingAcademyEngine({
      profile,
      mode,
      activityKind: this.trainingState.selectedActivity,
      durationSec: mode === 'assessment' ? this.trainingState.stdDuration : 0,
      pool: this.trainingState.stdPool,
      language: profile.settings.language,
    });
    this.trainingLastTickMs = performance.now();
    this.trainingTickIntervalId = window.setInterval(() => {
      const eng = this.trainingState.activeEngine;
      if (!eng || this.currentScreen !== 'training_academy') return;
      if (this.advanceTrainingClock()) return;
      if (eng.durationSec > 0) {
        const timerEl = document.getElementById('training-timer');
        if (timerEl) {
          timerEl.textContent = `${Math.max(0, Math.ceil(eng.durationSec - eng.elapsedSec))}s`;
        }
      }
    }, 100);
    this.renderCurrentScreen();
  }

  private advanceTrainingClock(): boolean {
    const now = performance.now();
    const dt = Math.max(0, (now - this.trainingLastTickMs) / 1000);
    this.trainingLastTickMs = now;
    if (this.trainingState.activeEngine?.tick(dt)) {
      this.finishTrainingOrAssessment();
      return true;
    }
    return false;
  }

  private finishTrainingOrAssessment(abandoned = false, render = true): void {
    if (this.trainingTickIntervalId !== null) {
      window.clearInterval(this.trainingTickIntervalId);
      this.trainingTickIntervalId = null;
    }
    const eng = this.trainingState.activeEngine;
    if (eng) {
      this.trainingState.lastResult = eng.finishAndRecord(abandoned);
      this.trainingState.activeEngine = null;
      this.persistence.saveToStorage();
      if (render) this.renderCurrentScreen();
    }
  }
}
