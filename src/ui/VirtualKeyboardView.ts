import { FINGER_META, lookupCharKey, POLISH_QWERTY_KEYS } from '../data/keyboardData';
import { CharacterStats, Language } from '../types';
import { escapeHtml } from '../utils/escapeHtml';

export interface VirtualKeyboardRenderProps {
  expectedChar: string | null;
  lastWrongChar: string | null;
  language: Language;
  assistanceMode: 'full' | 'adaptive' | 'minimal';
  showFingerColors: boolean;
  showHandHints: boolean;
  characterMastery: Record<string, CharacterStats>;
}

export class VirtualKeyboardView {
  public static renderHtml(props: VirtualKeyboardRenderProps): string {
    const {
      expectedChar,
      lastWrongChar,
      language,
      assistanceMode,
      showFingerColors,
      showHandHints,
      characterMastery,
    } = props;

    const lookup = expectedChar ? lookupCharKey(expectedChar) : undefined;
    const wrongLookup = lastWrongChar ? lookupCharKey(lastWrongChar) : undefined;

    // In adaptive assistance mode, if a character is already mastered, we tone down finger color hints
    const isExpectedMastered =
      expectedChar && characterMastery[expectedChar]?.status === 'mastered';
    const highlightExpected =
      assistanceMode === 'full' || (assistanceMode === 'adaptive' && !isExpectedMastered);

    const rows = [0, 1, 2, 3, 4];
    const rowsHtml = rows
      .map((rowIndex) => {
        const keysInRow = POLISH_QWERTY_KEYS.filter((k) => k.row === rowIndex);
        const keysHtml = keysInRow
          .map((k) => {
            const isTargetMain = lookup?.keyDef.code === k.code;
            const isTargetShift =
              lookup?.requiresShift && lookup.recommendedShiftCode === k.code;
            const isTargetAltGr = lookup?.requiresAltGr && k.code === 'AltRight';
            const isWrong = wrongLookup?.keyDef.code === k.code;

            const fingerMeta = FINGER_META[k.finger];
            const cappedUnits = k.code === 'Space' ? 5.0 : Math.min(1.7, k.width ?? 1);
            const widthEm = cappedUnits * 1.98;

            const classes = ['vk-key'];
            if (isTargetMain && highlightExpected) classes.push('vk-key-expected');
            if (isTargetShift || isTargetAltGr) classes.push('vk-key-modifier');
            if (isWrong) classes.push('vk-key-wrong');
            if (k.isHomeAnchor) classes.push('vk-key-anchor');

            const bgStyle =
              showFingerColors && assistanceMode !== 'minimal'
                ? `background:${fingerMeta.bgColor}; border-color:${fingerMeta.borderColor};`
                : '';

            const mainLabel = k.label ?? k.baseChar.toUpperCase();
            const altLabel = k.altGrChar ? `<span class="vk-altgr">${k.altGrChar}</span>` : '';
            const bumpHtml =
              k.code === 'KeyF' || k.code === 'KeyJ' ? '<span class="vk-bump"></span>' : '';

            return `<div class="${classes.join(' ')}" data-code="${k.code}" style="width:${widthEm.toFixed(2)}rem; ${bgStyle}">
              <span class="vk-main">${escapeHtml(mainLabel)}</span>
              ${altLabel}
              ${bumpHtml}
            </div>`;
          })
          .join('');

        return `<div class="vk-row">${keysHtml}</div>`;
      })
      .join('');

    let hintBarHtml = '';
    if (showHandHints && lookup) {
      const fMeta = FINGER_META[lookup.finger];
      const fingerLabel = language === 'pl' ? fMeta.namePl : fMeta.nameEn;
      const modifiers: string[] = [];
      if (lookup.requiresAltGr) {
        modifiers.push(language === 'pl' ? 'Prawy Alt (AltGr)' : 'Right Alt (AltGr)');
      }
      if (lookup.requiresShift) {
        const shiftSide =
          lookup.recommendedShiftCode === 'ShiftLeft'
            ? language === 'pl'
              ? 'Lewy Shift'
              : 'Left Shift'
            : language === 'pl'
            ? 'Prawy Shift'
            : 'Right Shift';
        modifiers.push(shiftSide);
      }

      const modText =
        modifiers.length > 0
          ? `<span class="vk-mod-badge">+ ${modifiers.join(' + ')}</span>`
          : '';

      const displayChar =
        expectedChar === ' ' ? (language === 'pl' ? '[SPACJA]' : '[SPACE]') : expectedChar;

      hintBarHtml = `
        <div class="vk-hint-bar">
          <div class="vk-hint-pill" style="border-color:${fMeta.color}">
            <span class="vk-dot" style="background:${fMeta.color}"></span>
            <strong>${escapeHtml(displayChar)}</strong> → ${fingerLabel} ${modText}
          </div>
          <span class="vk-ergo-disclaimer">
            ${
              language === 'pl'
                ? 'Zalecany palec (przeglądarka rejestruje klawisz, nie fizyczny palec)'
                : 'Recommended finger (browser events detect keys, not physical fingers)'
            }
          </span>
        </div>
      `;
    } else if (showHandHints) {
      hintBarHtml = `
        <div class="vk-hint-bar">
          <div class="vk-hint-pill">
            <span>✓</span>
          </div>
        </div>
      `;
    }

    return `
      <div class="virtual-keyboard-wrapper" data-testid="virtual-keyboard">
        ${hintBarHtml}
        <div class="vk-board">
          ${rowsHtml}
        </div>
      </div>
    `;
  }
}
