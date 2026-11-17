# KeyFort TD — Gameplay Balancing & 48-Mission Simulation Report

## 1. Dual-Resource Economy (Gold & Energy)

### Gold (`Złoto`)
- Earned from starting mission reserves (`275–555` gold depending on world and boss status), defeating enemies (`7–150` base gold scaled by `1 + (hpScale - 1) * 0.35`), and wave completion bonuses (`50 + w * 14 + worldId * 8` gold per wave, extendable via Energy Reactor *Gold Synthesizer*).
- Spent on constructing towers (`90–160` gold) and purchasing specialization upgrades (`55–270` gold).
- Selling a tower refunds **75%** of total invested gold, encouraging tactical repositioning without harsh punishment.

### Energy (`Energia`)
- Generated primarily by typing in the **Typing Energy Console**:
  - Each correct keystroke generates `2.6 * comboMultiplier * (1 + reactorBonus)` Energy.
  - Completing an entire sequence grants a `+6.0` Energy completion bonus and triggers special tower effects (*Reactor Discharge Shockwaves* and *Sniper Orbital Laser Strikes*).
- **Three-State Power Curve**:
  - **Fallback Power (`55%` output, Energy = `0`)**: Towers continue firing at reduced rate (`55%`) and damage (`65%`) even if the player stops typing or pauses to think. Beginners are never punished with disabled defenses or health loss on typos.
  - **Powered (`100%` output, Energy `> 0.5`)**: Standard full combat effectiveness (`drainTowerShotEnergy` drains fractional remaining energy when reserves run low so towers transition cleanly to Fallback Power when exhausted).
  - **Combat Overcharge (`140%` output, Energy `>= 72%` of max OR Energy `>= 50%` with Combo `>= 25`)**: Rewards accurate, rhythmic typing with a 40% surge in attack speed and +22% shot damage.
- **Active Tactical Abilities & Cooldowns**:
  - **EMP Pulse** (`35` Energy, `14s` cooldown, requires active enemies): Strips 65% of shields, reveals Ghosts, and stuns enemies for `1.8s`.
  - **Combat Overdrive** (`45` Energy, `16s` cooldown): Forces `140%` Overcharged output for `8s`.
  - **Orbital Strike** (`65` Energy, `22s` cooldown, requires active enemies): Deals `165` armor-piercing AoE damage across active threats.

## 2. Enemy Countermeasure Matrix

| Enemy | Primary Strength | Optimal Tower Countermeasures |
|---|---|---|
| **Scout** | High speed (`74 px/s`) | **Gun Tower** (rapid fire) + **Frost Tower** (slow) |
| **Siege Tank** | Heavy HP & `35%` Armor | **Sniper Tower** (Tungsten/Railgun 100% armor shred) + **Gun Tower** (AP rounds) |
| **Shield Bearer** | Rechargeable energy shield | **Tesla Tower** (`2x–3x` shield damage) + **EMP Pulse** ability |
| **Swarm Drone** | Large dense packs | **Cannon Tower** (AoE splash + Napalm) + **Frost Tower** (Cryo pulse) |
| **Ghost Infiltrator** | Phased stealth | **Tesla Tower**, **Sniper Tower**, or **Frost Spectral Frost / Gun Tracker** upgrades |
| **Core Splitter** | Spawns 2 fast mini-cores on death | **Frost Tower** (*Cryo Containment* suppresses split) + **Cannon Tower** |
| **Bio-Regenerator** | Heals `18+` HP/sec | **Cannon Tower** (*Napalm/Cluster*), **Tesla** (*EMP Overload*), or **Frost** (*Cryo Containment*) |
| **World Bosses** | Multi-phase shields, summons & armor | Combined arms: **Sniper** (Spotter mark) + **Tesla** (shield break) + **Reactor** (damage aura & shockwaves) |

## 3. Educational Completion Gates & Follow-Up Practice

Every campaign mission separates four distinct concepts:
1. **Tactical Victory (`tacticalVictory`)**: Surviving all waves with `Base HP > 0`.
2. **Educational Completion (`educationalCompleted`)**:
   - Meeting the mission's `requiredTypedChars` and `targetAccuracy` threshold.
   - Meeting per-key practice & accuracy objectives (`KeyLessonObjective`) for every newly introduced key in `mission.newKeys`.
3. **Follow-Up Practice Activity (`inFollowUpPractice`)**:
   - If the player wins the tactical battle (`tacticalVictory === true`) but has not yet completed all educational key objectives, the session transitions into a short, focused **Follow-Up Key Practice** drill targeting the exact unmet keys rather than forcing a replay of the entire battle.
4. **Mastery & Mission Rating (`stars: 1..3`)**:
   - Long-term character/bigram mastery (`MasteryStatus`) requires `>= 20` attempts, `>= 90%` accuracy, and `<= 950ms` reaction time.
   - Mission star rating (`1–3 ⭐`) combines remaining Base HP ratio and typing accuracy.

## 4. Full 48-Mission Headless Simulation Results

Deterministic simulations (`src/systems/CampaignSimulator.ts` & `tests/unit/balanceSimulation.test.ts`) were executed across all 48 missions (`w1_m1`–`w8_m6`) using six player personas:

| Persona | Typing Speed & Accuracy | Tactical Strategy | Simulation Outcome |
|---|---|---|---|
| **Complete Beginner** | `~8 WPM`, `82%` accuracy (frequent errors) | Basic 2-tower placement (`Gun` + `Cannon`) | **100% pass rate on introductory lessons (`w1_m1`–`w1_m3`)**; completes follow-up practice when needed without losing Base HP (`20/20 HP`). |
| **Learning Player** | `~16 WPM`, `87%` accuracy | Counter-aware placement + Tier 1–2 upgrades | **100% pass rate across Worlds 1–2 (`w1_m1`–`w2_m6`)** including Bosses `Valley Warden MK-I` and `Shadowwood Colossus`. |
| **Intermediate Player** | `~32 WPM`, `91%` accuracy | Counter-aware placement + Tier 2–3 upgrades | **100% pass rate across all 48 missions (`w1_m1`–`w8_m6`)** (`48 / 48` tactical & educational victories). |
| **Advanced Player** | `~52 WPM`, `96%` accuracy | Optimal combined arms + Tier 3 + abilities | **100% pass rate across all Boss encounters (`w1_m6`–`w8_m6`)** with `2–3 ⭐` ratings and high combo overcharge. |
| **Non-Typer** | `0 WPM` (never types) | Counter-aware towers with starting gold | **0% campaign completion (`0 / 48` victories)** — educational completion gate blocks progression on every mission. |
| **Poor Tactician** | `~25 WPM`, `90%` accuracy | 1 un-upgraded Gun Tower on far corner pad (`#10`) | **0% survival on benchmark & Boss missions (`w1_m4`, `w1_m6`, `w3_m6`, `w6_m6`, `w8_m6`)** — Base HP reaches `0/20`, confirming strategic placement and upgrades matter. |
| **Alternative Loadouts** | `~32 WPM`, `91%` accuracy | Loadout A (`Gun + Frost + Sniper`) vs. Loadout B (`Cannon + Tesla + Reactor`) on `w4_m4` | **Both distinct loadouts achieve full victory**, confirming multiple tactical builds are viable. |
