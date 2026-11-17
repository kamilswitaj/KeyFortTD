# KeyFort TD — Technical Architecture

## 1. Architectural Principles

KeyFort TD is a 100% client-side TypeScript application built with Vite, HTML5 Canvas 2D, Web Audio API synthesis, Vitest, and Playwright.

Core design principles:
1. **Strict Separation of Simulation/Pedagogy from Rendering & DOM**:
   - Pure game rules (`GameSessionEngine`, `CombatSystem`, `WaveSystem`, `TowerSystem`, `EnemySystem`, `PathSystem`, `ResourceEconomy`) and educational algorithms (`TypingEngine`, `MasteryEngine`, `AdaptiveLearningEngine`, `ProgressionEngine`) have zero dependency on DOM elements or rendering contexts.
   - This allows the exact same `GameSessionEngine` to run at 60 FPS in the browser and at 10,000 ticks/second in headless Vitest balance simulations.
2. **Data-Driven Content**:
   - All 8 worlds, 48 missions, 16 maps, 6 towers (54 upgrades), 8 enemy archetypes, 8 multi-phase bosses, keyboard mappings, and achievements are defined declaratively in `src/data/`. Adding or adjusting a mission requires no changes to engine code.
3. **Deterministic Seeded Randomness**:
   - `src/utils/rng.ts` implements the `Mulberry32` PRNG so exercise batches and simulations are reproducible and testable.

## 2. Module Overview

```
src/
├── types/index.ts                # Core domain interfaces and data contracts
├── utils/rng.ts                  # Seeded Mulberry32 PRNG
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
│   ├── AdaptiveLearningEngine.ts # Strictly filtered adaptive exercise generator
│   ├── TypingEngine.ts           # Console state machine, modifier/repeat filtering, pause compensation
│   ├── PathSystem.ts             # Waypoint distance interpolation
│   ├── ResourceEconomy.ts        # Gold, Energy, 3-state power curve, active abilities
│   ├── TowerSystem.ts            # Effective stat calculation, aura buffs, targeting priorities
│   ├── EnemySystem.ts            # Status effects, DoT, regeneration, Splitter & Boss phases
│   ├── WaveSystem.ts             # Campaign & endless Survival wave spawner
│   ├── CombatSystem.ts           # Projectile & AoE resolution, armor/shield math, combo triggers
│   ├── ProgressionEngine.ts      # Stars, XP, levels, educational completion gates
│   ├── AchievementSystem.ts      # Achievement & cosmetic unlock evaluation
│   └── GameSessionEngine.ts      # Unified session coordinator
├── services/
│   ├── PersistenceService.ts     # Versioned localStorage, migration, multi-profile, JSON export/import
│   └── AudioSystem.ts            # Web Audio API procedural sound synthesis
├── rendering/
│   └── BattlefieldRenderer.ts    # 2D top-down battlefield, towers, enemies, particles, HUD overlays
└── ui/
    ├── VirtualKeyboardView.ts    # Interactive finger-colored Polish QWERTY keyboard & ergonomic hints
    └── AppController.ts          # Screen routing, DOM event binding, 60 FPS loop
```
