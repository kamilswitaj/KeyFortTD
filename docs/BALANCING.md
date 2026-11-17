# KeyFort TD — Gameplay Balancing & Economy Design

## 1. Dual-Resource Economy (Gold & Energy)

### Gold (`Złoto`)
- Earned from starting mission reserves, defeating enemies (`7–150` gold per enemy), and wave completion bonuses (`45+` gold per wave, extendable via Energy Reactor *Gold Synthesizer*).
- Spent on constructing towers (`90–160` gold) and purchasing specialization upgrades (`55–270` gold).
- Selling a tower refunds **75%** of total invested gold, encouraging tactical repositioning without harsh punishment.

### Energy (`Energia`)
- Generated primarily by typing in the **Typing Energy Console**:
  - Each correct keystroke generates `2.6 * comboMultiplier * (1 + reactorBonus)` Energy.
  - Completing an entire sequence grants a `+6.0` Energy completion bonus and triggers special tower effects (*Reactor Discharge Shockwaves* and *Sniper Orbital Laser Strikes*).
- **Three-State Power Curve**:
  - **Fallback Power (`55%` output, Energy = `0`)**: Towers continue firing at reduced rate and damage even if the player stops typing or pauses to think. Beginners are never punished with disabled defenses or health loss on typos.
  - **Powered (`100%` output, Energy `> 0.5`)**: Standard full combat effectiveness.
  - **Combat Overcharge (`140%` output, Energy `>= 72%` of max OR Combo `>= 20`)**: Rewards accurate, rhythmic typing with a 40% surge in attack speed and +22% shot damage.

## 2. Enemy Countermeasure Matrix

| Enemy | Primary Strength | Optimal Tower Countermeasures |
|---|---|---|
| **Scout** | High speed | **Gun Tower** (rapid fire) + **Frost Tower** (slow) |
| **Siege Tank** | Heavy HP & 35% Armor | **Sniper Tower** (Tungsten/Railgun 100% armor shred) + **Gun Tower** (AP rounds) |
| **Shield Bearer** | Rechargeable energy shield | **Tesla Tower** (2x–3x shield damage) + **EMP Pulse** ability |
| **Swarm Drone** | Large dense packs | **Cannon Tower** (AoE splash + Napalm) + **Frost Tower** (Cryo pulse) |
| **Ghost Infiltrator** | Invisible to basic sensors | **Tesla Tower**, **Sniper Tower**, or **Frost Spectral Frost / Gun Tracker** upgrades |
| **Core Splitter** | Spawns 2 fast mini-cores on death | **Frost Tower** (*Cryo Containment* suppresses split) + **Cannon Tower** |
| **Bio-Regenerator** | Heals 18+ HP/sec | **Cannon Tower** (*Napalm/Cluster*), **Tesla** (*EMP Overload*), or **Frost** (*Cryo Containment*) |
| **World Bosses** | Multi-phase shields, summons & armor | Combined arms: **Sniper** (Spotter mark) + **Tesla** (shield break) + **Reactor** (damage aura & shockwaves) |

## 3. Educational Completion Gates

To prevent players from bypassing typing practice by relying solely on autonomous towers:
- Every campaign mission requires both **Base Survival (`Lives > 0`)** AND completing the mission's **`requiredTypedChars`** with at least the minimum **`targetAccuracy`** threshold.
- In **Relaxed Mode**, character count requirements are reduced by 30% and accuracy thresholds are softened by 8% so every learner can progress comfortably at their own pace.
