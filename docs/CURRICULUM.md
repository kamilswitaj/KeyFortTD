# KeyFort TD — Touch-Typing Curriculum & Adaptive Engine (V2.3)

## 1. Pedagogical Foundation

The curriculum follows established touch-typing methodology tailored specifically for the **Polish Programmer QWERTY** keyboard layout (`Polski programisty`):
- **Tactile Home Row Anchors First**: Players begin with index fingers on `F` and `J` (feeling the physical ridges), followed by the thumb on `Space`, middle fingers on `D` and `K`, ring fingers on `S` and `L`, pinkies on `A` and `;`, and lateral index reaches to `G` and `H`.
- **Interactive Contextual Onboarding (Missions 1.1–1.3)**: New players are guided step-by-step through placing their first tower, feeling the `F`/`J` ridges, generating Energy through typing, reading the incoming wave preview, and purchasing upgrades without intrusive modal popups.
- **Symmetric Finger-Pair Progression**: Upper and lower rows are introduced in ergonomic finger pairs (`E, I` -> `R, U` -> `W, O` -> `T, Y` -> `Q, P`).
- **Strict Character Gatekeeping**: Every mission defines `newKeys` and cumulative `allowedKeys`. `AdaptiveLearningEngine` validates both candidate selection and final output strings so an unlearned character can **never** appear in `campaign`, `survival`, or `challenge` modes. `ChallengeEngine.getPlayerEligibleTier` and `TrainingAcademyEngine` derive eligible keys from actually introduced keys in completed missions (never solely from mission count). Voluntary ahead-of-curriculum drills (`diacritics`, `uppercase`) are explicitly labeled and never unlock campaign progression.
- **Natural Polish Vocabulary & Sentences**: When playing in Polish (`pl`), exercises draw exclusively from curated natural Polish words (`REAL_WORDS_PL`) and grammatically meaningful Polish sentences (`SENTENCES_PL`) matched to each world's exact character set.

## 2. Separated Progression Semantics

KeyFort TD separates four distinct educational and gameplay concepts throughout `GameSessionEngine`, `ProgressionEngine`, and the UI:
1. **Tactical Victory (`tacticalVictory`)**: Defending the KeyFort (`remainingLives > 0`) through all enemy waves.
2. **Educational Completion (`educationalCompleted`)**:
   - Typing at least `minRequiredChars` with at least `minAccuracy`.
   - Completing individual **Key Lesson Objectives (`KeyLessonObjective`)** for each newly introduced key (`newKeys`), requiring sufficient accurate presses on every new key before the lesson is complete.
3. **Follow-Up Practice Activity (`inFollowUpPractice`)**:
   - If the player wins the tactical battle (`tacticalVictory === true`) but has not yet completed all educational key objectives, the game offers an immediate, short **Follow-Up Key Practice** drill targeting the exact unmet keys rather than forcing a replay of the entire battle.
4. **Long-Term Mastery (`MasteryStatus`) & Mission Rating (`stars: 1..3`)**:
   - **Mastery** (`locked | learning | practicing | mastered`) tracks long-term proficiency across sessions and requires `>= 20` lifetime attempts, `>= 90%` accuracy, and `<= 950ms` reaction time.
   - **Mission Rating** (`1–3 ⭐`) rewards combined tactical defense (`remainingLives / startingLives`) and typing precision.

## 3. Adaptive Learning with Character & Bigram Statistics

`AdaptiveLearningEngine` selects drills, syllables, words, and sentences deterministically using:
- **Character Accuracy & Reaction Time**: Boosts keys with accuracy `< 90%` or slow reaction times (`> 620ms`).
- **Bigram Accuracy & Transition Time (`computeBigramWeights`)**: Boosts character pairs (`ab`) with high error rates or slow finger transitions (`avgTransitionMs > 520ms`).
- **Recently Introduced Keys & Spaced Repetition**: Prioritizes newly unlocked keys and mastered keys whose `nextReviewAt` timestamp has elapsed.
- **Anti-Monotony History Filter**: Penalizes recently displayed prompts (`recentPromptTexts`) so consecutive sequences remain varied and engaging.
- **Idle-Break Timing Protection**: `TypingEngine` treats any pause `> 2500ms` (or `window` `blur` / tower management interaction) as a planning break so tower placement never distorts reaction time or WPM statistics.
