import { expect, test } from '@playwright/test';

test.describe('KeyFort TD — Complete E2E Suite', () => {
  test('starts campaign, verifies onboarding & wave preview, fits 1440x900, builds & upgrades towers, and wins Mission 1', async ({
    page,
  }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => consoleErrors.push(err.message));

    await page.goto('/');

    // Default language should be Polish ('pl')
    await expect(page.getByTestId('main-menu-screen')).toBeVisible();
    await expect(page.getByTestId('lang-toggle-btn')).toContainText('PL');

    // Open Campaign Map and verify 8 world tabs
    await page.getByTestId('open-campaign-map-btn').click();
    await expect(page.getByTestId('campaign-map-screen')).toBeVisible();
    await expect(page.getByTestId('world-tab-1')).toBeVisible();
    await expect(page.getByTestId('world-tab-8')).toBeVisible();

    // Launch Mission 1 (w1_m1)
    await page.getByTestId('launch-mission-w1_m1').click();
    await expect(page.getByTestId('gameplay-screen')).toBeVisible();
    await expect(page.getByTestId('battlefield-canvas')).toBeVisible();
    await expect(page.getByTestId('typing-console')).toBeVisible();
    await expect(page.getByTestId('virtual-keyboard')).toBeVisible();
    await expect(page.getByTestId('onboarding-banner')).toBeVisible();
    await expect(page.getByTestId('wave-preview-bar')).toBeVisible();
    await expect(page.getByTestId('key-objectives-bar')).toBeVisible();

    // Verify both Battlefield Canvas and Virtual Keyboard are simultaneously visible inside 1440x900
    const vkBox = await page.getByTestId('virtual-keyboard').boundingBox();
    expect(vkBox).not.toBeNull();
    expect(vkBox!.y + vkBox!.height).toBeLessThanOrEqual(900);

    // Build a Gun Tower on Pad #1
    await page.getByTestId('build-tower-gun').click();
    await expect(page.getByTestId('tower-inspector-panel')).toBeVisible();

    // Upgrade Damage branch to Tier 1
    await page.getByTestId('upgrade-btn-damage').click();
    await expect(page.getByTestId('upgrade-card-damage')).toContainText('T1/3');

    // Change targeting priority to Strongest
    await page.getByTestId('target-priority-strongest').click();

    // Type 10 characters in the typing console and verify energy increases
    const initialEnergy = Number(await page.locator('#hud-energy-value').textContent());
    for (let i = 0; i < 10; i++) {
      const expectedChar = await page.getByTestId('console-sequence-box').getAttribute('data-expected-char');
      if (expectedChar) {
        await page.keyboard.press(expectedChar === ' ' ? 'Space' : expectedChar);
      }
    }
    const afterEnergy = Number(await page.locator('#hud-energy-value').textContent());
    expect(afterEnergy).toBeGreaterThan(initialEnergy);

    // Complete Mission 1 via fast simulation & typing remaining required characters
    await page.evaluate(() => {
      const app = window.__keyfortApp!;
      const session = app.getActiveSession()!;
      session.buildTower('cannon', 2);
      session.buildTower('gun', 3);

      // Type until required chars and per-key objectives are met
      let now = Date.now();
      while (!session.isEducationalCompleted()) {
        const ch = session.typingEngine.getExpectedChar();
        if (!ch) break;
        session.handleKeyInput(ch, (now += 280), false);
      }

      // Fast-forward waves to completion
      let safety = 0;
      while (!session.isSessionOver() && safety < 5000) {
        if (!session.waveSystem.isWaveActive() && session.waveSystem.hasMoreWaves()) {
          session.startNextWave();
        }
        session.update(0.1);
        safety++;
      }
    });

    await expect(page.getByTestId('mission-results-modal')).toBeVisible();
    await expect(page.getByTestId('results-title')).toContainText('ZWYCIĘSTWO');
    expect(consoleErrors).toEqual([]);
  });

  test('does not launch a locked campaign mission or count browser shortcuts as typing', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => window.__keyfortApp!.startMission('w1_m6'));
    await expect(page.getByTestId('main-menu-screen')).toBeVisible();
    await page.getByTestId('quick-start-campaign-btn').click();
    const attempts = () =>
      page.evaluate(() => window.__keyfortApp!.getActiveSession()!.typingEngine.getTotalAttempts());
    const before = await attempts();
    await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', ctrlKey: true })));
    await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'f', isComposing: true })));
    expect(await attempts()).toBe(before);
  });

  test('renders a profile name as text and preserves it in exported JSON', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('nav-profiles').click();
    const name = '<img id="injected-profile" src="x"> & "name"';
    await page.getByTestId('new-profile-name-input').fill(name);
    await page.getByTestId('create-profile-btn').click();
    await expect(page.getByTestId('active-profile-name')).toHaveText(name);
    await expect(page.locator('#injected-profile')).toHaveCount(0);
    const save = JSON.parse(await page.getByTestId('save-json-textarea').inputValue());
    expect(save.profiles[save.activeProfileId].name).toBe(name);
  });

  test('triggers follow-up practice activity when waves are cleared before educational objectives complete', async ({
    page,
  }) => {
    await page.goto('/');
    await page.getByTestId('quick-start-campaign-btn').click();
    await expect(page.getByTestId('gameplay-screen')).toBeVisible();

    // Clear all waves while typing only 6 chars -> should enter follow-up practice mode!
    await page.evaluate(() => {
      const session = window.__keyfortApp!.getActiveSession()!;
      session.economy.addGold(500);
      session.buildTower('gun', 1);
      session.buildTower('cannon', 2);
      session.buildTower('gun', 3);

      let now = Date.now();
      for (let i = 0; i < 6; i++) {
        const ch = session.typingEngine.getExpectedChar();
        if (ch) session.handleKeyInput(ch, (now += 280), false);
      }

      let safety = 0;
      while (!session.areAllWavesCleared() && safety < 4000) {
        if (!session.waveSystem.isWaveActive() && session.waveSystem.hasMoreWaves()) {
          session.startNextWave();
        }
        session.update(0.1);
        safety++;
      }
    });

    await expect(page.getByTestId('followup-practice-banner')).toBeVisible();
  });

  test('handles losing a mission when base HP reaches 0', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('quick-start-campaign-btn').click();
    await expect(page.getByTestId('gameplay-screen')).toBeVisible();

    // Simulate enemies reaching the base without building any towers
    await page.evaluate(() => {
      const session = window.__keyfortApp!.getActiveSession()!;
      let safety = 0;
      while (!session.isSessionOver() && safety < 4000) {
        if (!session.waveSystem.isWaveActive() && session.waveSystem.hasMoreWaves()) {
          session.startNextWave();
        }
        session.update(0.1);
        safety++;
      }
    });

    await expect(page.getByTestId('mission-results-modal')).toBeVisible();
    await expect(page.getByTestId('results-title')).toContainText('BAZA ZNISZCZONA');
  });

  test('supports switching languages, managing profiles, exporting/importing saves, and completing a Boss encounter', async ({
    page,
  }) => {
    await page.goto('/');

    // Switch language PL -> EN
    await page.getByTestId('lang-toggle-btn').click();
    await expect(page.getByTestId('lang-toggle-btn')).toContainText('EN');
    await expect(page.getByTestId('nav-campaign')).toContainText('Educational Campaign');

    // Open Profiles screen, create a second profile, and switch back and forth
    await page.getByTestId('nav-profiles').click();
    await expect(page.getByTestId('profiles-screen')).toBeVisible();
    await page.getByTestId('new-profile-name-input').fill('PlayerTwo');
    await page.getByTestId('create-profile-btn').click();
    await expect(page.getByTestId('active-profile-name')).toHaveText('PlayerTwo');

    // Test JSON Export & Import
    const exportedJson = await page.getByTestId('save-json-textarea').inputValue();
    expect(exportedJson).toContain('PlayerTwo');
    await page.getByTestId('import-save-btn').click();
    await expect(page.getByTestId('import-status-msg')).toBeVisible();

    // Launch Boss Mission w1_m6 and defeat the Boss
    await page.evaluate(() => {
      const app = window.__keyfortApp!;
      const profile = app.persistence.getActiveProfile();
      // Seed prerequisite completions explicitly: campaign launch must enforce unlocks.
      for (let i = 1; i <= 5; i++) {
        const missionId = `w1_m${i}`;
        profile.completedMissions[missionId] = {
          missionId,
          completed: true,
          stars: 3,
          bestAccuracy: 1,
          bestWpm: 25,
          bestScore: 1000,
          timesCompleted: 1,
        };
      }
      app.startMission('w1_m6', 'campaign', { unlimitedGold: true });
    });
    await expect(page.getByTestId('gameplay-screen')).toBeVisible();

    await page.evaluate(() => {
      const session = window.__keyfortApp!.getActiveSession()!;
      for (let padIdx = 0; padIdx < 8; padIdx++) {
        const t = session.buildTower(padIdx % 2 === 0 ? 'gun' : 'cannon', padIdx);
        if (t) {
          session.upgradeTower(t.id, 'damage');
          session.upgradeTower(t.id, 'speed');
        }
      }

      let now = Date.now();
      while (!session.isEducationalCompleted()) {
        const ch = session.typingEngine.getExpectedChar();
        if (!ch) break;
        session.handleKeyInput(ch, (now += 250), false);
      }

      let ticks = 0;
      while (!session.isSessionOver() && ticks < 8000) {
        if (!session.waveSystem.isWaveActive() && session.waveSystem.hasMoreWaves()) {
          session.startNextWave();
        }
        session.update(0.1);
        ticks++;
      }
    });

    await expect(page.getByTestId('mission-results-modal')).toBeVisible();
    await expect(page.getByTestId('results-title')).toContainText('TACTICAL VICTORY');
  });
});
