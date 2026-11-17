import { BigramStats, CharacterStats, TypingPromptItem } from '../types';
import { MasteryEngine } from './MasteryEngine';

export const IGNORED_MODIFIER_KEYS = new Set([
  'Shift',
  'ShiftLeft',
  'ShiftRight',
  'Control',
  'ControlLeft',
  'ControlRight',
  'Alt',
  'AltLeft',
  'AltRight',
  'AltGraph',
  'Meta',
  'OS',
  'CapsLock',
  'Tab',
  'Escape',
  'Dead',
  'Unidentified',
  'F1',
  'F2',
  'F3',
  'F4',
  'F5',
  'F6',
  'F7',
  'F8',
  'F9',
  'F10',
  'F11',
  'F12',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
]);

export interface KeystrokeResult {
  ignored: boolean;
  isCorrect: boolean;
  expectedChar: string;
  typedChar: string;
  energyGenerated: number;
  combo: number;
  maxCombo: number;
  sequenceCompleted: boolean;
  completedPrompt?: TypingPromptItem;
  reactionMs: number;
}

export class TypingEngine {
  private queue: TypingPromptItem[] = [];
  private currentPrompt: TypingPromptItem | null = null;
  private cursorIndex: number = 0;
  private combo: number = 0;
  private maxCombo: number = 0;
  private totalAttempts: number = 0;
  private totalCorrect: number = 0;
  private totalErrors: number = 0;
  private lastKeystrokeTimestamp: number = 0;
  private activeTypingDurationMs: number = 0;
  private isPaused: boolean = false;
  private pauseStartedAt: number = 0;
  private lastWrongKey: string | null = null;
  private lastErrorTimestamp: number = 0;

  constructor(initialPrompts: TypingPromptItem[] = []) {
    this.setPrompts(initialPrompts);
  }

  public setPrompts(prompts: TypingPromptItem[], now: number = Date.now()): void {
    this.queue = [...prompts];
    this.advanceToNextPrompt(now);
  }

  public appendPrompts(prompts: TypingPromptItem[]): void {
    this.queue.push(...prompts);
    if (!this.currentPrompt) {
      this.advanceToNextPrompt(Date.now());
    }
  }

  private advanceToNextPrompt(now: number): void {
    const next = this.queue.shift() ?? null;
    this.currentPrompt = next;
    this.cursorIndex = 0;
    this.lastKeystrokeTimestamp = now;
  }

  public pause(now: number = Date.now()): void {
    if (this.isPaused) return;
    this.isPaused = true;
    this.pauseStartedAt = now;
  }

  public resume(now: number = Date.now()): void {
    if (!this.isPaused) return;
    const pausedDelta = Math.max(0, now - this.pauseStartedAt);
    if (this.lastKeystrokeTimestamp > 0) {
      this.lastKeystrokeTimestamp += pausedDelta;
    }
    this.isPaused = false;
    this.pauseStartedAt = 0;
  }

  public getIsPaused(): boolean {
    return this.isPaused;
  }

  public getCurrentPrompt(): TypingPromptItem | null {
    return this.currentPrompt;
  }

  public getCursorIndex(): number {
    return this.cursorIndex;
  }

  public getExpectedChar(): string | null {
    if (!this.currentPrompt) return null;
    return this.currentPrompt.text[this.cursorIndex] ?? null;
  }

  public getEnteredText(): string {
    if (!this.currentPrompt) return '';
    return this.currentPrompt.text.slice(0, this.cursorIndex);
  }

  public getRemainingText(): string {
    if (!this.currentPrompt) return '';
    return this.currentPrompt.text.slice(this.cursorIndex + 1);
  }

  public getCombo(): number {
    return this.combo;
  }

  public getMaxCombo(): number {
    return this.maxCombo;
  }

  public getTotalAttempts(): number {
    return this.totalAttempts;
  }

  public getTotalCorrect(): number {
    return this.totalCorrect;
  }

  public getTotalErrors(): number {
    return this.totalErrors;
  }

  public getAccuracy(): number {
    if (this.totalAttempts === 0) return 1.0;
    return this.totalCorrect / this.totalAttempts;
  }

  public getWpm(): number {
    if (this.activeTypingDurationMs < 1500 || this.totalCorrect === 0) return 0;
    const minutes = this.activeTypingDurationMs / 60000;
    const standardWords = this.totalCorrect / 5;
    return Math.min(220, Math.round(standardWords / minutes));
  }

  public getActiveDurationSec(): number {
    return Math.round(this.activeTypingDurationMs / 1000);
  }

  public getLastWrongKey(now: number = Date.now()): string | null {
    if (this.lastWrongKey && now - this.lastErrorTimestamp < 450) {
      return this.lastWrongKey;
    }
    return null;
  }

  public getRemainingQueueLength(): number {
    return this.queue.length;
  }

  /**
   * Processes a single character or keyboard event key.
   */
  public processKeyInput(
    key: string,
    masteryMap: Record<string, CharacterStats>,
    bigramMap: Record<string, BigramStats>,
    reactorKeystrokeBonus: number = 0,
    now: number = Date.now(),
    isRepeat: boolean = false
  ): KeystrokeResult {
    const expectedChar = this.getExpectedChar() ?? '';
    if (
      this.isPaused ||
      isRepeat ||
      !this.currentPrompt ||
      !expectedChar ||
      IGNORED_MODIFIER_KEYS.has(key) ||
      key.length !== 1
    ) {
      return {
        ignored: true,
        isCorrect: false,
        expectedChar,
        typedChar: key,
        energyGenerated: 0,
        combo: this.combo,
        maxCombo: this.maxCombo,
        sequenceCompleted: false,
        reactionMs: 0,
      };
    }

    const rawReaction = this.lastKeystrokeTimestamp > 0 ? now - this.lastKeystrokeTimestamp : 450;
    const reactionMs = Math.max(60, Math.min(3500, rawReaction));
    this.activeTypingDurationMs += reactionMs;
    this.lastKeystrokeTimestamp = now;

    const prevChar = this.cursorIndex > 0 ? this.currentPrompt.text[this.cursorIndex - 1] : null;
    const { isCorrect } = MasteryEngine.recordKeystroke(
      masteryMap,
      bigramMap,
      expectedChar,
      key,
      reactionMs,
      prevChar,
      now
    );

    this.totalAttempts += 1;

    if (isCorrect) {
      this.totalCorrect += 1;
      this.combo += 1;
      if (this.combo > this.maxCombo) {
        this.maxCombo = this.combo;
      }
      this.lastWrongKey = null;

      // Energy generated scales with combo and Reactor upgrades
      const comboMultiplier = 1 + Math.min(0.85, Math.floor(this.combo / 10) * 0.12);
      const baseEnergy = 2.6;
      let energyGenerated = baseEnergy * comboMultiplier * (1 + reactorKeystrokeBonus);

      this.cursorIndex += 1;
      let sequenceCompleted = false;
      let completedPrompt: TypingPromptItem | undefined;

      if (this.cursorIndex >= this.currentPrompt.text.length) {
        sequenceCompleted = true;
        completedPrompt = this.currentPrompt;
        // Completion bonus energy
        energyGenerated += 6.0 * (1 + reactorKeystrokeBonus);
        this.advanceToNextPrompt(now);
      }

      return {
        ignored: false,
        isCorrect: true,
        expectedChar,
        typedChar: key,
        energyGenerated: Number(energyGenerated.toFixed(2)),
        combo: this.combo,
        maxCombo: this.maxCombo,
        sequenceCompleted,
        completedPrompt,
        reactionMs,
      };
    } else {
      this.totalErrors += 1;
      this.combo = 0;
      this.lastWrongKey = key;
      this.lastErrorTimestamp = now;

      return {
        ignored: false,
        isCorrect: false,
        expectedChar,
        typedChar: key,
        energyGenerated: 0,
        combo: 0,
        maxCombo: this.maxCombo,
        sequenceCompleted: false,
        reactionMs,
      };
    }
  }
}
