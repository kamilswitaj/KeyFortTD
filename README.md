# KeyFort TD — Pisz. Buduj. Broń. | Type. Build. Defend.

**KeyFort TD** is a complete browser-based educational strategy game combining the tactical depth and replayability of modern 2D Tower Defense games with a comprehensive, adaptive touch-typing course for the standard **Polish Programmer QWERTY** keyboard layout.

---

## Quick Start

```bash
npm install
npm run dev
```

Open the local URL displayed by Vite (typically `http://localhost:5173`) in any desktop browser.

### Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Starts the Vite development server with hot reload |
| `npm run build` | Type-checks with `tsc` and builds the static production bundle in `dist/` |
| `npm run preview` | Serves the production build locally for inspection |
| `npm run test` | Runs the Vitest unit and headless balance simulation test suite |
| `npm run test:e2e` | Runs the Playwright end-to-end browser test suite |

---

## Key Features

- **Dual-Resource Tactical Gameplay**:
  - **Gold (`Złoto`)**: Earned by defeating enemies and clearing waves; used to construct and upgrade towers (75% refund when selling).
  - **Energy (`Energia`)**: Generated primarily by typing sequences in the **Typing Energy Console** (and amplified by Energy Reactors).
  - **3-Tier Power Curve**:
    - **Fallback Power (`55%` efficiency)** when Energy is `0` — towers never shut down completely, so beginner players are never soft-locked for typing slowly.
    - **Powered (`100%` efficiency)** when Energy > `0`.
    - **Combat Overcharge (`140%` efficiency)** when Energy >= `72%` of capacity or during a `20+` typing combo streak.
  - **Tactical Active Abilities**: Spend energy on **EMP Pulse** (shatters shields, reveals Ghosts, stuns), **Combat Overdrive**, or **Orbital Strike**.
- **6 Distinct Towers with 3 Specialization Branches × 3 Tiers Each (54 Upgrades)**:
  1. **Gun Tower (`Wieża Strzelecka`)**: Rapid kinetic defense with Armor-Piercing Rounds, Vulcan Rotary Overdrive, and Spectral Ricochet Bolts.
  2. **Cannon Tower (`Wieża Artyleryjska`)**: AoE siege mortar with Seismic Stun, Artillery Barrage, and Napalm / Cluster Munitions.
  3. **Frost Tower (`Wieża Mrozu`)**: Cryo crowd control with Brittle Fracture (+40% damage taken), Blizzard Field, and Cryo Containment (suppresses Splitter fragmentation & regeneration).
  4. **Tesla Tower (`Wieża Tesli`)**: Chain lightning hitting up to 9 targets, melting Shields (up to 3x bonus damage), and refunding energy via Quantum Conduit.
  5. **Sniper Tower (`Wieża Snajperska`)**: Long-range railgun with 100% armor penetration, Spotter Network target marking, and Orbital Laser Designator triggered on completed typing sequences.
  6. **Energy Reactor (`Reaktor Energii`)**: Tactical support nexus granting damage auras, passive gold/energy generation, keystroke energy multipliers, and map-wide Discharge Supernova shockwaves on every completed word/sequence.
- **8 Diverse Enemy Archetypes & 8 Multi-Phase World Bosses**:
  - **Scout**, **Siege Tank**, **Shield Bearer**, **Swarm Drone**, **Ghost Infiltrator**, **Core Splitter**, **Bio-Regenerator**, and **Multi-Phase Boss Dreadnoughts**.
- **Complete 8-World, 48-Mission Educational Curriculum**:
  - Strictly incremental introduction of keys on the **Polish Programmer QWERTY** layout (`F, J, D, K` -> full Home Row -> Upper Row -> Lower Row -> Consolidation -> Polish Diacritics `ą, ć, ę, ł, ń, ó, ś, ź, ż` with `AltGr` -> Uppercase `Shift`, Numbers `0-9` & Punctuation -> Full Sentences).
  - Zero unlearned characters ever leak into generated exercises.
  - Clear visual distinction between intentional finger coordination drills (`DRILL`) and real Polish/English words & sentences.
- **Deterministic Adaptive Learning & Mastery Engine**:
  - Tracks per-character and per-bigram attempts, accuracy, reaction time EMA, confusion matrix, and spaced repetition intervals.
  - Enforces minimum attempt volume (`>= 20` attempts), accuracy (`>= 90%`), and reaction speed before classifying a key as `Mastered`.
- **Three Playable Game Modes**:
  - **Campaign** (48 missions across 8 themed worlds)
  - **Survival** (Endless waves with personal best tracking using unlocked keys)
  - **Tactical Sandbox** (Configurable unlimited gold/energy, all towers & Tier 3 upgrades, enemy spawner, adjustable game speed)
- **Learning Analytics Dashboard & Multi-Profile Persistence**:
  - Parent-friendly summary, Polish QWERTY Mastery Heatmap, WPM/Accuracy session history, separate local player profiles for family members, versioned save migration, and JSON Export/Import.

---

## Documentation

- [Architecture Documentation](docs/ARCHITECTURE.md)
- [Educational Curriculum & Adaptive Engine Documentation](docs/CURRICULUM.md)
- [Gameplay Balancing Documentation](docs/BALANCING.md)
- [GitHub Pages Deployment Workflow](.github/workflows/deploy.yml)
