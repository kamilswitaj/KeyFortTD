import { LocalizationService } from '../../i18n/LocalizationService';
import { GameSessionEngine } from '../../systems/GameSessionEngine';

export class OnboardingView {
  /**
   * Renders a contextual, non-blocking interactive onboarding bar for Missions 1–3 (`w1_m1`..`w1_m3`).
   */
  public static renderContextualHintHtml(session: GameSessionEngine, i18n: LocalizationService): string {
    if (session.mode !== 'campaign' || session.mission.worldId !== 1 || session.mission.missionIndex > 3) {
      return '';
    }

    const towers = session.getTowers();
    const typedCorrect = session.typingEngine.getTotalCorrect();
    const waveNum = session.waveSystem.getCurrentWaveNumber();
    const waveActive = session.waveSystem.isWaveActive();
    const hasUpgraded = towers.some(
      (t) => t.upgrades.damage > 0 || t.upgrades.speed > 0 || t.upgrades.special > 0
    );

    let stepBadge = '';
    let messagePl = '';
    let messageEn = '';
    let accentColor = '#38bdf8';

    if (session.mission.missionIndex === 1) {
      if (towers.length === 0) {
        stepBadge = i18n.pick('KROK 1/4: BUDOWA', 'STEP 1/4: BUILD');
        messagePl =
          'Kliknij „CKM 90 🪙” w panelu po prawej, aby postawić pierwszą wieżę przy zakręcie.';
        messageEn =
          'Click "Gun 90 🪙" on the right panel to place your first turret near the road bend.';
        accentColor = '#facc15';
      } else if (typedCorrect < 6) {
        stepBadge = i18n.pick('KROK 2/4: POZYCJA F i J', 'STEP 2/4: F & J');
        messagePl =
          'Palce wskazujące na F i J (poczuj wypustki!). Wpisz podświetlone znaki — ładują Energię (⚡)!';
        messageEn =
          'Index fingers on F & J (feel the bumps!). Type the highlighted keys — each charges Energy (⚡)!';
        accentColor = '#4ade80';
      } else if (!waveActive && waveNum === 1 && session.getEnemiesDefeatedCount() === 0) {
        stepBadge = i18n.pick('KROK 3/4: START FALI', 'STEP 3/4: START WAVE');
        messagePl =
          'Kliknij zielony przycisk „▶ Start Fali” po prawej, a podczas walki pisz spokojnie dalej!';
        messageEn =
          'Click the green "▶ Start Wave" button on the right, then keep typing calmly during battle!';
        accentColor = '#22c55e';
      } else if (!hasUpgraded && session.economy.getGold() >= 60) {
        stepBadge = i18n.pick('KROK 4/4: ULEPSZENIE', 'STEP 4/4: UPGRADE');
        messagePl =
          'Złoto z pokonanych wrogów pozwala ulepszyć wieżę! Kliknij „⬆️ Ulepsz” w Inspektorze Wieży po prawej stronie.';
        messageEn =
          'Gold from defeated enemies lets you upgrade towers! Click "⬆️ Upgrade" in the Tower Inspector on the right.';
        accentColor = '#c084fc';
      } else {
        stepBadge = i18n.pick('WSKAZÓWKA: PRZECIĄŻENIE', 'TIP: OVERCHARGE');
        messagePl =
          'Utrzymuj Energię powyżej 72%, aby włączyć Przeciążenie Bojowe (140% mocy wież!). Celność jest ważniejsza niż pośpiech.';
        messageEn =
          'Keep Energy above 72% to activate Combat Overcharge (140% tower output!). Accuracy matters more than speed.';
        accentColor = '#38bdf8';
      }
    } else if (session.mission.missionIndex === 2) {
      stepBadge = i18n.pick('LEKCJA 1.2: RYTM KCIUKA', 'LESSON 1.2: THUMB RHYTHM');
      messagePl =
        'Kciuki spoczywają nad klawiszem Spacji (␣). Każda ukończona sekwencja daje bonus +6 ⚡ Energii dla Twoich wież!';
      messageEn =
        'Rest your thumbs over the Spacebar (␣). Completing each sequence grants a +6 ⚡ Energy bonus to your towers!';
      accentColor = '#38bdf8';
    } else {
      stepBadge = i18n.pick('LEKCJA 1.3: KLAWISZ D', 'LESSON 1.3: KEY D');
      messagePl =
        'Lewy palec środkowy obsługuje klawisz D (obok F). Obserwuj licznik nowego klawisza D w nagłówku konsoli — każdy nowy klawisz ma swój cel ćwiczeń!';
      messageEn =
        'Your left middle finger presses D (next to F). Watch the key counter for D in the console header — every new key has its own practice goal!';
      accentColor = '#a855f7';
    }

    return `
      <div class="onboarding-banner" data-testid="onboarding-banner" style="border-left: 4px solid ${accentColor};">
        <span class="onboarding-step-badge" style="background:${accentColor}28; color:${accentColor}; border:1px solid ${accentColor};">
          💡 ${stepBadge}
        </span>
        <span class="onboarding-text">${i18n.pick(messagePl, messageEn)}</span>
      </div>
    `;
  }
}
