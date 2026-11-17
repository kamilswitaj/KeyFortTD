# KeyFort TD — Touch-Typing Curriculum & Adaptive Engine

## 1. Pedagogical Foundation

The curriculum follows established touch-typing methodology tailored specifically for the **Polish Programmer QWERTY** keyboard layout (`Polski programisty`):
- **Tactile Home Row Anchors First**: Players begin with index fingers on `F` and `J` (feeling the physical ridges), followed by the thumb on `Space`, middle fingers on `D` and `K`, ring fingers on `S` and `L`, pinkies on `A` and `;`, and lateral index reaches to `G` and `H`.
- **Symmetric Finger-Pair Progression**: Upper and lower rows are never dumped all at once. Instead, keys are introduced in ergonomic finger pairs (e.g., middle fingers `E, I` -> index fingers `R, U` -> ring fingers `W, O` -> inner index `T, Y` -> pinkies `Q, P`).
- **Strict Character Gatekeeping**: Every mission defines `newKeys` and cumulative `allowedKeys`. `AdaptiveLearningEngine.isStringAllowed()` verifies every single character of every candidate drill, syllable, word, or sentence so an unlearned character can **never** appear prematurely.
- **Drill vs. Real Word Distinction**: Intentional finger-coordination drills are explicitly tagged (`isDrill: true`, badge `ĆWICZENIE PALCÓW (DRILL)`) to distinguish them from authentic Polish and English vocabulary (`SŁOWO / FRAZA BOJOWA`) and full sentences (`TRANSMISJA TAKTYCZNA`).

## 2. World-by-World Curriculum Map (48 Missions)

| World | Missions | New Keys Introduced | Pedagogical Focus |
|---|---|---|---|
| **1. Green Valley** | 1.1 – 1.6 | `f, j, Space, d, k` | Home-row index & middle finger anchors, thumb rhythm |
| **2. Dark Forest** | 2.1 – 2.6 | `s, l, a, ;, g, h` | Complete home row, lateral reaches, first real words (`las, fala, sala, skala`) |
| **3. Mountain Pass** | 3.1 – 3.6 | `e, i, r, u, w, o, t, y, q, p` | Upper row finger-pair ascents and return-to-home discipline |
| **4. Desert Outpost** | 4.1 – 4.6 | `v, m, c, ,, b, n, x, ., z, /` | Lower row finger-pair descents; completion of all 26 base letters |
| **5. Frozen Islands** | 5.1 – 5.6 | *(Consolidation)* | High-frequency bigrams (`cz, sz, rz, pr, st`), alternating hands, multi-word phrases |
| **6. Ancient Ruins** | 6.1 – 6.6 | `ą, ę, ł, ó, ś, ć, ń, ż, ź` | Polish diacritical characters using Right Alt (`AltGr`) |
| **7. Industrial City** | 7.1 – 7.6 | `A–Z, Ł, Ś, Ż, 1–0, -, :, !, ?` | Opposite-hand `Shift` rule, number row (`1–5` left, `6–0` right), tactical punctuation |
| **8. Final Fortress** | 8.1 – 8.6 | *(Full Fluency)* | Complete sentences, proverbs, telemetry reports, error recovery, and high accuracy |

## 3. Adaptive Learning & Mastery Model

`MasteryEngine` tracks for each character:
- Total attempts, correct keystrokes, errors, consecutive streak, and confusion matrix (`confusedWith`).
- Exponential Moving Average (EMA) reaction time (`avgReactionMs`).
- Mastery Score (`0..100`) combining accuracy, reaction speed, streak, and an attempt volume factor (`min(1, attempts / 20)`).
- A character is only classified as **`mastered`** when:
  - `attempts >= 20`
  - `accuracy >= 90%`
  - `avgReactionMs <= 950ms`
  - `masteryScore >= 78`
- `AdaptiveLearningEngine` dynamically increases selection weights for newly introduced keys, keys with accuracy `< 90%`, keys with slow reaction times, and mastered keys whose spaced-repetition review timestamp (`nextReviewAt`) has elapsed.
