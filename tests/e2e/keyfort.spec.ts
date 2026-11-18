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
    await expect(page.getByTestId('nav-campaign')).toContainText('Campaign');

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

  test('keeps battlefield bounding rectangle stationary (<= 1px shift) across dynamic HUD/console mutations on 1280x720, 1366x768, 1440x900, and 1920x1080 in PL and EN', async ({
    page,
  }) => {
    const viewports = [
      { width: 1280, height: 720 },
      { width: 1366, height: 768 },
      { width: 1440, height: 900 },
      { width: 1920, height: 1080 },
    ];
    const languages: Array<'pl' | 'en'> = ['pl', 'en'];

    await page.goto('/');

    for (const lang of languages) {
      await page.evaluate((targetLang) => {
        const app = window.__keyfortApp!;
        const profile = app.persistence.getActiveProfile();
        profile.settings.language = targetLang;
        app.i18n.setLanguage(targetLang);
        for (const mId of ['w1_m1', 'w1_m2']) {
          profile.completedMissions[mId] = {
            missionId: mId,
            completed: true,
            stars: 3,
            bestAccuracy: 0.98,
            bestWpm: 30,
            bestScore: 2000,
            timesCompleted: 1,
          };
        }
        app.startMission('w1_m3', 'campaign');
      }, lang);

      await expect(page.getByTestId('gameplay-screen')).toBeVisible();

      for (const vp of viewports) {
        await page.setViewportSize(vp);

        // Reset mission state cleanly for this viewport measurement
        await page.evaluate(() => {
          window.__keyfortApp!.startMission('w1_m3', 'campaign');
        });

        const canvas = page.getByTestId('battlefield-canvas');
        await expect(canvas).toBeVisible();
        const baselineBox = await canvas.boundingBox();
        expect(baselineBox).not.toBeNull();

        if (vp.width === 1440 && vp.height === 900) {
          const vkBox = await page.getByTestId('virtual-keyboard').boundingBox();
          expect(vkBox).not.toBeNull();
          expect(vkBox!.y + vkBox!.height).toBeLessThanOrEqual(900);
        }

        const assertStationary = async (stepLabel: string) => {
          const box = await canvas.boundingBox();
          expect(box, `${lang} ${vp.width}x${vp.height} - ${stepLabel}`).not.toBeNull();
          expect(
            Math.abs(box!.x - baselineBox!.x),
            `${lang} ${vp.width}x${vp.height} x shift on ${stepLabel}`
          ).toBeLessThanOrEqual(1);
          expect(
            Math.abs(box!.y - baselineBox!.y),
            `${lang} ${vp.width}x${vp.height} y shift on ${stepLabel}`
          ).toBeLessThanOrEqual(1);
          expect(
            Math.abs(box!.width - baselineBox!.width),
            `${lang} ${vp.width}x${vp.height} width shift on ${stepLabel}`
          ).toBeLessThanOrEqual(1);
          expect(
            Math.abs(box!.height - baselineBox!.height),
            `${lang} ${vp.width}x${vp.height} height shift on ${stepLabel}`
          ).toBeLessThanOrEqual(1);
        };

        // 1. Gold transitions: 9, 99, 999, 9999
        for (const goldVal of [9, 99, 999, 9999]) {
          await page.evaluate((g) => {
            const app = window.__keyfortApp!;
            const s = app.getActiveSession()!;
            const cur = s.economy.getGold();
            if (g >= cur) s.economy.addGold(g - cur);
            else s.economy.spendGold(cur - g);
            app.updateGameplayHudInPlace();
          }, goldVal);
          await assertStationary(`gold=${goldVal}`);
        }

        // 2. Energy, Max Energy, and Power State transitions (baseline -> powered -> overcharged with countdown)
        await page.evaluate(() => {
          const app = window.__keyfortApp!;
          const s = app.getActiveSession()!;
          s.economy.consumeEnergy(s.economy.getEnergy()); // 0 energy -> baseline
          app.updateGameplayHudInPlace();
        });
        await assertStationary('power=baseline');

        await page.evaluate(() => {
          const app = window.__keyfortApp!;
          const s = app.getActiveSession()!;
          s.economy.addEnergy(65); // powered
          app.updateGameplayHudInPlace();
        });
        await assertStationary('power=powered');

        await page.evaluate(() => {
          const app = window.__keyfortApp!;
          const s = app.getActiveSession()!;
          s.economy.setBonusMaxEnergy(120);
          s.economy.addEnergy(200);
          s.economy.activateOverdrive(8); // overcharged with countdown
          app.updateGameplayHudInPlace();
        });
        await assertStationary('power=overcharged');

        // 3. Combo, Accuracy, WPM, and Ability cooldown countdowns
        await page.evaluate(() => {
          const app = window.__keyfortApp!;
          const s = app.getActiveSession()!;
          let now = Date.now();
          for (let i = 0; i < 25; i++) {
            const ch = s.typingEngine.getExpectedChar();
            if (ch) s.handleKeyInput(ch, (now += 180), false);
          }
          s.handleKeyInput('z', (now += 180), false); // trigger error state too
          s.triggerTacticalAbility('overdrive');
          s.triggerTacticalAbility('emp');
          s.triggerTacticalAbility('orbital');
          s.update(1.2);
          app.updateGameplayHudInPlace();
        });
        await assertStationary('combo-accuracy-wpm-cooldowns');

        // 4. Pause and Resume
        await page.evaluate(() => {
          const app = window.__keyfortApp!;
          const s = app.getActiveSession()!;
          s.setPaused(true);
          app.updateGameplayHudInPlace();
        });
        await assertStationary('paused');

        await page.evaluate(() => {
          const app = window.__keyfortApp!;
          const s = app.getActiveSession()!;
          s.setPaused(false);
          app.updateGameplayHudInPlace();
        });
        await assertStationary('resumed');

        // 5. Wave start, wave completion, upcoming wave composition, and educational objective completion
        await page.evaluate(() => {
          const app = window.__keyfortApp!;
          const s = app.getActiveSession()!;
          s.economy.addGold(2000);
          s.buildTower('gun', 1);
          s.buildTower('cannon', 2);
          s.buildTower('gun', 3);
          s.startNextWave();
          app.updateGameplayHudInPlace();
        });
        await assertStationary('wave-started');

        await page.evaluate(() => {
          const app = window.__keyfortApp!;
          const s = app.getActiveSession()!;
          let guard = 0;
          while (s.waveSystem.isWaveActive() && guard < 1500) {
            s.update(0.1);
            guard++;
          }
          let now = Date.now();
          while (!s.isEducationalCompleted() && guard < 3000) {
            const ch = s.typingEngine.getExpectedChar();
            if (!ch) break;
            s.handleKeyInput(ch, (now += 220), false);
            guard++;
          }
          app.updateGameplayHudInPlace();
        });
        await assertStationary('wave-completed-and-educational-done');
      }
    }
  });

  test('supports 3-player family setup, mid-mission profile switch confirmation & abandoned session recording, reset confirmation modal, Survival/Sandbox retry preservation, and Family Dashboard comparisons', async ({
    page,
  }) => {
    await page.goto('/');

    // 1. Open Profiles screen and configure 3 family profiles in one operation
    await page.getByTestId('nav-profiles').click();
    await expect(page.getByTestId('profiles-screen')).toBeVisible();

    await page.getByTestId('family-setup-name-1').fill('Kondziu');
    await page.getByTestId('family-setup-name-2').fill('Natalka');
    await page.getByTestId('family-setup-name-3').fill('Kamil');
    await page.getByTestId('family-setup-submit-btn').click();

    await expect(page.getByTestId('active-profile-name')).toHaveText('Kondziu');

    const profileIds = await page.evaluate(() =>
      window.__keyfortApp!.persistence.getAllProfiles().map((p) => ({ id: p.id, name: p.name }))
    );
    expect(profileIds.map((p) => p.name)).toEqual(['Kondziu', 'Natalka', 'Kamil']);
    const kondziuId = profileIds[0].id;
    const natalkaId = profileIds[1].id;

    // 2. Test destructive Reset confirmation modal (cancel keeps profile intact)
    await page.getByTestId(`request-reset-${kondziuId}`).click();
    await expect(page.getByTestId('confirm-profile-destructive-modal')).toBeVisible();
    await page.getByTestId('cancel-destructive-profile-btn').click();
    await expect(page.getByTestId('confirm-profile-destructive-modal')).toHaveCount(0);

    // 3. Start a mission as Kondziu, type 15 characters, then attempt to switch to Natalka via header switcher
    await page.getByTestId(`play-profile-${kondziuId}`).click();
    await expect(page.getByTestId('campaign-map-screen')).toBeVisible();
    await page.getByTestId('launch-mission-w1_m1').click();
    await expect(page.getByTestId('gameplay-screen')).toBeVisible();

    await page.evaluate(() => {
      const s = window.__keyfortApp!.getActiveSession()!;
      let now = Date.now();
      for (let i = 0; i < 15; i++) {
        const ch = s.typingEngine.getExpectedChar();
        if (ch) s.handleKeyInput(ch, (now += 250), false);
      }
    });

    // Select Natalka in the header switcher -> must open confirmation modal!
    await page.getByTestId('header-profile-switcher').selectOption(natalkaId);
    await expect(page.getByTestId('switch-profile-confirm-modal')).toBeVisible();
    expect(await page.evaluate(() => window.__keyfortApp!.getActiveSession()!.getIsPaused())).toBe(true);
    const attemptsBeforeModal = await page.evaluate(() => window.__keyfortApp!.getActiveSession()!.typingEngine.getTotalAttempts());
    await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'f' })));
    expect(await page.evaluate(() => window.__keyfortApp!.getActiveSession()!.typingEngine.getTotalAttempts())).toBe(attemptsBeforeModal);

    // Cancel first -> stays in mission as Kondziu
    await page.getByTestId('cancel-switch-profile-btn').click();
    await expect(page.getByTestId('gameplay-screen')).toBeVisible();
    await expect(page.getByTestId('active-profile-name')).toHaveText('Kondziu');

    // Now switch again and confirm -> records abandoned session for Kondziu without marking mission completed, switches to Natalka
    await page.getByTestId('header-profile-switcher').selectOption(natalkaId);
    await page.getByTestId('confirm-switch-profile-btn').click();
    await expect(page.getByTestId('active-profile-name')).toHaveText('Natalka');

    const kondziuData = await page.evaluate(
      (id) => window.__keyfortApp!.persistence.getProfileById(id)!,
      kondziuId
    );
    expect(kondziuData.sessionHistory.length).toBe(1);
    expect(kondziuData.sessionHistory[0].status).toBe('abandoned');
    expect(kondziuData.completedMissions.w1_m1).toBeUndefined();

    // 4. Verify unplayed profile (Natalka) shows '—' accuracy and '0 s' practice time instead of 100% / 1 min
    await page.getByTestId('nav-statistics').click();
    await expect(page.getByTestId('stat-overall-accuracy')).toHaveText('—');
    await expect(page.getByTestId('stat-practice-time')).toHaveText('0 s');

    // 5. Complete w1_m1 as Natalka so Family Dashboard & Mission Leaderboard have competitive records
    await page.evaluate(() => {
      const app = window.__keyfortApp!;
      app.startMission('w1_m1', 'campaign');
      const s = app.getActiveSession()!;
      s.economy.addGold(400);
      s.buildTower('gun', 1);
      s.buildTower('cannon', 2);
      s.buildTower('gun', 3);
      let now = Date.now();
      while (!s.isEducationalCompleted()) {
        const ch = s.typingEngine.getExpectedChar();
        if (!ch) break;
        s.handleKeyInput(ch, (now += 240), false);
      }
      let guard = 0;
      while (!s.isSessionOver() && guard < 4000) {
        if (!s.waveSystem.isWaveActive() && s.waveSystem.hasMoreWaves()) s.startNextWave();
        s.update(0.1);
        guard++;
      }
    });
    await expect(page.getByTestId('mission-results-modal')).toBeVisible();
    await page.getByTestId('results-back-map-btn').click();

    // 6. Open Family Dashboard (Ranking rodzinny) and verify comparison table, sorting, SVG charts, and mission leaderboard
    await page.getByTestId('nav-family-dashboard').click();
    await expect(page.getByTestId('family-dashboard-screen')).toBeVisible();
    await expect(page.getByTestId(`family-row-${kondziuId}`)).toBeVisible();
    await expect(page.getByTestId(`family-row-${natalkaId}`)).toBeVisible();

    // Sort by overallAccuracy
    await page.getByTestId('family-sort-overallAccuracy').click();
    await expect(page.getByTestId('comparison-charts-grid')).toBeVisible();
    await expect(page.getByTestId('mission-leaderboard-table')).toBeVisible();

    // 7. Verify Survival retry preserves selected map missionId
    await page.evaluate(() => {
      const app = window.__keyfortApp!;
      app.startMission('w2_m2', 'survival');
      const s = app.getActiveSession()!;
      let guard = 0;
      while (!s.isSessionOver() && guard < 5000) {
        if (!s.waveSystem.isWaveActive()) s.startNextWave();
        s.update(0.1);
        guard++;
      }
    });
    await expect(page.getByTestId('mission-results-modal')).toBeVisible();
    await page.getByTestId('results-retry-btn').click();
    const retryMissionId = await page.evaluate(
      () => window.__keyfortApp!.getActiveSession()!.sourceMissionId
    );
    expect(retryMissionId).toBe('w2_m2');
  });

  test('reload records interrupted practice exactly once', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('quick-start-campaign-btn').click();
    for (let i = 0; i < 8; i++) {
      const ch = await page.getByTestId('console-sequence-box').getAttribute('data-expected-char');
      if (ch) await page.keyboard.press(ch === ' ' ? 'Space' : ch);
    }
    await page.reload();
    const history = () => page.evaluate(() => window.__keyfortApp!.persistence.getActiveProfile().sessionHistory);
    await expect(page.getByTestId('main-menu-screen')).toBeVisible();
    expect((await history()).length).toBe(1);
    expect((await history())[0].status).toBe('abandoned');
    expect((await history())[0].charsTyped).toBe(8);
    await page.reload();
    expect((await history()).length).toBe(1);
  });

  test('dedicated viewport-aware fullscreen gameplay layout eliminates document scroll, fits battlefield, prompt and full keyboard simultaneously, and provides header controls', async ({
    page,
  }) => {
    const desktopViewports = [
      { width: 1280, height: 720 },
      { width: 1366, height: 768 },
      { width: 1440, height: 900 },
      { width: 1600, height: 900 },
      { width: 1920, height: 1080 },
    ];

    await page.goto('/');

    for (const vp of desktopViewports) {
      await page.setViewportSize(vp);

      await page.evaluate(() => {
        window.__keyfortApp!.startMission('w1_m1', 'campaign');
      });

      await expect(page.getByTestId('gameplay-screen')).toBeVisible();
      await expect(page.getByTestId('gameplay-header')).toBeVisible();

      // Top navigation must be replaced by compact gameplay header
      await expect(page.locator('.top-header')).toHaveCount(0);

      // Verify zero document-level scroll
      const docScroll = await page.evaluate(() => ({
        bodyHasClass: document.body.classList.contains('in-gameplay'),
        scrollHeight: document.documentElement.scrollHeight,
        innerHeight: window.innerHeight,
        scrollWidth: document.documentElement.scrollWidth,
        innerWidth: window.innerWidth,
      }));
      expect(docScroll.bodyHasClass).toBe(true);
      expect(docScroll.scrollHeight, `${vp.width}x${vp.height} vertical overflow`).toBeLessThanOrEqual(docScroll.innerHeight);
      expect(docScroll.scrollWidth, `${vp.width}x${vp.height} horizontal overflow`).toBeLessThanOrEqual(docScroll.innerWidth);

      // Verify simultaneous visibility of battlefield, prompt, and complete keyboard inside viewport
      const canvasBox = await page.getByTestId('battlefield-canvas').boundingBox();
      const promptBox = await page.getByTestId('console-sequence-box').boundingBox();
      const keyboardBox = await page.getByTestId('virtual-keyboard').boundingBox();

      expect(canvasBox).not.toBeNull();
      expect(promptBox).not.toBeNull();
      expect(keyboardBox).not.toBeNull();

      // Keyboard bottom must fit inside viewport
      expect(keyboardBox!.y + keyboardBox!.height, `${vp.width}x${vp.height} keyboard bottom`).toBeLessThanOrEqual(vp.height);

      // Column widths: main column (~70-78%), sidebar (~22-30%)
      const layoutBox = await page.getByTestId('gameplay-screen').boundingBox();
      const sidebarBox = await page.getByTestId('tactical-sidebar').boundingBox();
      expect(layoutBox).not.toBeNull();
      expect(sidebarBox).not.toBeNull();
      const sidebarRatio = sidebarBox!.width / layoutBox!.width;
      expect(sidebarRatio).toBeGreaterThanOrEqual(0.18);
      expect(sidebarRatio).toBeLessThanOrEqual(0.32);

      // In-game fullscreen toggle button and header pause
      await page.getByTestId('toggle-fullscreen-btn').click();
      await expect.poll(() => page.evaluate(() => Boolean(document.fullscreenElement))).toBe(true);
      await page.getByTestId('gameplay-header-pause-btn').click();
      await expect(page.locator('#gameplay-header-status')).toContainText('WSTRZYMANA');
      await page.getByTestId('gameplay-header-pause-btn').click();
      // Restore normal window state before the next viewport resize.
      await page.getByTestId('toggle-fullscreen-btn').click();
      await expect.poll(() => page.evaluate(() => Boolean(document.fullscreenElement))).toBe(false);
    }

    // Exit gameplay via header exit button returns to campaign map
    await page.getByTestId('exit-gameplay-btn').click();
    await expect(page.getByTestId('campaign-map-screen')).toBeVisible();
    await expect(page.locator('.top-header')).toBeVisible();
  });

  test('V2.0 Training Academy, Standardized Typing Test, Challenges/Heroes, Interactive World Map, and full top-nav visibility at 1440x900', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');

    // All top navigation items including Settings must fit inside the 1440px viewport without horizontal clipping
    const settingsNavBox = await page.getByTestId('nav-settings').boundingBox();
    expect(settingsNavBox).not.toBeNull();
    expect(settingsNavBox!.x + settingsNavBox!.width).toBeLessThanOrEqual(1440);

    // 1. Open Interactive World Map & switch world via SVG map node
    await page.getByTestId('nav-campaign').click();
    await expect(page.getByTestId('interactive-world-map')).toBeVisible();
    await page.getByTestId('world-map-node-2').click();
    await expect(page.getByTestId('mission-card-w2_m1')).toBeVisible();

    // 2. Open Training Academy & complete a Standardized Typing Test
    await page.getByTestId('nav-training-academy').click();
    await expect(page.getByTestId('training-academy-screen')).toBeVisible();
    await page.getByTestId('academy-tab-standardized').click();
    await expect(page.getByTestId('standardized-test-panel')).toBeVisible();
    await page.getByTestId('start-standardized-test-btn').click();
    await expect(page.getByTestId('training-active-screen')).toBeVisible();

    for (let i = 0; i < 18; i++) {
      const ch = await page.evaluate(() => {
        const box = document.querySelector('[data-testid="training-sequence-box"] .char-current');
        const txt = box?.textContent ?? '';
        return txt === '␣' ? ' ' : txt;
      });
      if (ch) await page.keyboard.press(ch === ' ' ? 'Space' : ch);
    }

    await page.getByTestId('finish-training-btn').click();
    await expect(page.getByTestId('training-result-banner')).toBeVisible();
    await expect(page.getByTestId('standardized-leaderboard-table')).toBeVisible();

    // 3. Open Challenges, Heroes & Tech Tree screen
    await page.getByTestId('nav-challenges').click();
    await expect(page.getByTestId('challenges-screen')).toBeVisible();
    await expect(page.getByTestId('challenge-card-daily')).toBeVisible();
    await expect(page.getByTestId('challenge-card-weekly')).toBeVisible();
    await expect(page.getByTestId('hero-card-guardian')).toBeVisible();
    await expect(page.getByTestId('tech-node-tech_kinetic_1')).toBeVisible();
  });
});
