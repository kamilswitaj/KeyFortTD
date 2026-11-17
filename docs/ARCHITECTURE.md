# KeyFort TD — Technical Architecture (V1.1)

## 1. Architectural Principles

KeyFort TD is a 100% client-side TypeScript application built with Vite, HTML5 Canvas 2D, Web Audio API synthesis, Vitest, and Playwright.

Core design principles:
1. **Strict Separation of Simulation/Pedagogy from Rendering & DOM**:
   - Pure game rules (`GameSessionEngine`, `CombatSystem`, `WaveSystem`, `TowerSystem`, `EnemySystem`, `PathSystem`, `ResourceEconomy`, `CampaignSimulator`) and educational algorithms (`TypingEngine`, `MasteryEngine`, `AdaptiveLearningEngine`, `ProgressionEngine`) have zero dependency on DOM elements or rendering contexts.
   - This allows the exact same `GameSessionEngine` to run at 60 FPS in the browser and at 10,000 ticks/second in headless Vitest balance simulations across all 48 campaign missions.
2. **Data-Driven Content**:
   - All 8 worlds, 48 missions, 16 maps, 6 towers (54 upgrades), 8 enemy archetypes, 8 multi-phase bosses, keyboard mappings, and achievements are defined declaratively in `src/data/`.
3. **Hardened Persistence & Safe HTML Rendering**:
   - `PersistenceService` performs strict runtime validation (checking plain objects, finite numerical bounds, safe profile identifiers, and allowed enum values) with zero unsafe `as` casts on untrusted data. Invalid imports never overwrite an existing valid save.
   - Frequent keystroke updates use throttled persistence (`requestThrottledSave`) with immediate lifecycle flushing (`flushSave` on `blur`, `visibilitychange`, `pagehide`, `beforeunload`, navigation, and session completion).
   - All dynamic text and attribute interpolations pass through `escapeHtml`.

## 2. Module Overview

```
src/
├── types/index.ts                # Core domain interfaces and data contracts
├── utils/
│   ├── rng.ts                    # Seeded Mulberry32 PRNG
│   └── escapeHtml.ts             # HTML & attribute encoding helper
├── i18n/
│   ├── translations.ts           # Bilingual dictionary (Polish default, English)
│   └── LocalizationService.ts    # Runtime translation and language switching
├── data/
│   ├── keyboardData.ts           # Polish Programmer QWERTY layout, fingers, AltGr & Shift maps
│   ├── curriculumData.ts         # 8 worlds, 48 missions, curated PL/EN vocabulary & sentence banks
│   ├── towersData.ts             # 6 towers × 3 branches × 3 tiers (54 upgrades)
│   ├── enemiesData.ts            # 8 enemy types + 8 multi-phase World Bosses
│   ├── mapsData.ts               # 16 maps across 8 visual world themes
│   └── achievementsData.ts       # Achievements and unlockable cosmetics
├── systems/
│   ├── MasteryEngine.ts          # Per-char & bigram mastery scores, confusion matrix, spaced repetition
│   ├── AdaptiveLearningEngine.ts # Character + Bigram adaptive exercise & follow-up drill generator
│   ├── TypingEngine.ts           # Console state machine, idle-break compensation, per-key session stats
│   ├── PathSystem.ts             # Waypoint distance interpolation
│   ├── ResourceEconomy.ts        # Gold, Energy, 3-state power curve, atomic vs fractional energy drain
│   ├── TowerSystem.ts            # Effective stat calculation, aura buffs, targeting priorities
│   ├── EnemySystem.ts            # Status effects, DoT, regeneration, Splitter & Boss phases
│   ├── WaveSystem.ts             # Campaign & endless Survival wave spawner
│   ├── CombatSystem.ts           # Projectile & AoE resolution, armor/shield math, combo triggers
│   ├── ProgressionEngine.ts      # Separated Tactical Victory, Educational Completion, Mastery & Stars
│   ├── AchievementSystem.ts      # Achievement & cosmetic unlock evaluation
│   ├── GameSessionEngine.ts      # Unified session coordinator + Follow-Up Practice flow
│   └── CampaignSimulator.ts      # Deterministic headless 48-mission simulator for 6 player personas
├── services/
│   ├── PersistenceService.ts     # Runtime-validated versioned localStorage, migration, throttled saves
│   └── AudioSystem.ts            # Web Audio API procedural sound synthesis
├── rendering/
│   └── BattlefieldRenderer.ts    # 2D top-down battlefield, themed backdrops, directional enemy/tower sprites
└── ui/
    ├── VirtualKeyboardView.ts    # Interactive finger-colored Polish QWERTY keyboard & ergonomic hints
    ├── AppController.ts          # Event orchestration, focus/blur handling, 60 FPS loop
    └── views/
        ├── OnboardingView.ts     # Contextual step-by-step onboarding for Missions 1.1–1.3
        ├── MainMenuView.ts       # Main Menu with SVG Fortress preview & 3×2 mode grid
        ├── CampaignMapView.ts    # 8-World selector strip & 3×2 stage path cards
        ├── GameplayView.ts       # Zero-scroll 1440x900 HUD, Wave Preview, Console, Sidebar & Results Modal
        └── DashboardViews.ts     # Statistics/Heatmap, Achievements, Profiles, Survival/Sandbox & Settings
```
