import { FingerId, KeyDefinition } from '../types';

export const FINGER_META: Record<
  FingerId,
  {
    color: string;
    bgColor: string;
    borderColor: string;
    namePl: string;
    nameEn: string;
    shortPl: string;
    shortEn: string;
  }
> = {
  L_PINKY: {
    color: '#f43f5e',
    bgColor: 'rgba(244, 63, 94, 0.22)',
    borderColor: '#fb7185',
    namePl: 'Lewy mały palec',
    nameEn: 'Left pinky finger',
    shortPl: 'L5 Mały',
    shortEn: 'L-Pinky',
  },
  L_RING: {
    color: '#fb923c',
    bgColor: 'rgba(251, 146, 60, 0.22)',
    borderColor: '#fdba74',
    namePl: 'Lewy palec serdeczny',
    nameEn: 'Left ring finger',
    shortPl: 'L4 Serdeczny',
    shortEn: 'L-Ring',
  },
  L_MIDDLE: {
    color: '#facc15',
    bgColor: 'rgba(250, 204, 21, 0.22)',
    borderColor: '#fde047',
    namePl: 'Lewy palec środkowy',
    nameEn: 'Left middle finger',
    shortPl: 'L3 Środkowy',
    shortEn: 'L-Middle',
  },
  L_INDEX: {
    color: '#4ade80',
    bgColor: 'rgba(74, 222, 128, 0.22)',
    borderColor: '#86efac',
    namePl: 'Lewy palec wskazujący',
    nameEn: 'Left index finger',
    shortPl: 'L2 Wskazujący',
    shortEn: 'L-Index',
  },
  THUMBS: {
    color: '#38bdf8',
    bgColor: 'rgba(56, 189, 248, 0.22)',
    borderColor: '#7dd3fc',
    namePl: 'Kciuk (Spacja / Prawy Alt)',
    nameEn: 'Thumb (Space / Right Alt)',
    shortPl: 'Kciuk',
    shortEn: 'Thumb',
  },
  R_INDEX: {
    color: '#2dd4bf',
    bgColor: 'rgba(45, 212, 191, 0.22)',
    borderColor: '#5eead4',
    namePl: 'Prawy palec wskazujący',
    nameEn: 'Right index finger',
    shortPl: 'P2 Wskazujący',
    shortEn: 'R-Index',
  },
  R_MIDDLE: {
    color: '#818cf8',
    bgColor: 'rgba(129, 140, 248, 0.22)',
    borderColor: '#a5b4fc',
    namePl: 'Prawy palec środkowy',
    nameEn: 'Right middle finger',
    shortPl: 'P3 Środkowy',
    shortEn: 'R-Middle',
  },
  R_RING: {
    color: '#c084fc',
    bgColor: 'rgba(192, 132, 252, 0.22)',
    borderColor: '#d8b4fe',
    namePl: 'Prawy palec serdeczny',
    nameEn: 'Right ring finger',
    shortPl: 'P4 Serdeczny',
    shortEn: 'R-Ring',
  },
  R_PINKY: {
    color: '#f472b6',
    bgColor: 'rgba(244, 114, 182, 0.22)',
    borderColor: '#f9a8d4',
    namePl: 'Prawy mały palec',
    nameEn: 'Right pinky finger',
    shortPl: 'P5 Mały',
    shortEn: 'R-Pinky',
  },
};

export const POLISH_QWERTY_KEYS: KeyDefinition[] = [
  // Row 0: Number row
  { code: 'Backquote', baseChar: '`', shiftChar: '~', row: 0, col: 0, finger: 'L_PINKY', hand: 'left' },
  { code: 'Digit1', baseChar: '1', shiftChar: '!', row: 0, col: 1, finger: 'L_PINKY', hand: 'left' },
  { code: 'Digit2', baseChar: '2', shiftChar: '@', row: 0, col: 2, finger: 'L_RING', hand: 'left' },
  { code: 'Digit3', baseChar: '3', shiftChar: '#', row: 0, col: 3, finger: 'L_MIDDLE', hand: 'left' },
  { code: 'Digit4', baseChar: '4', shiftChar: '$', row: 0, col: 4, finger: 'L_INDEX', hand: 'left' },
  { code: 'Digit5', baseChar: '5', shiftChar: '%', row: 0, col: 5, finger: 'L_INDEX', hand: 'left' },
  { code: 'Digit6', baseChar: '6', shiftChar: '^', row: 0, col: 6, finger: 'R_INDEX', hand: 'right' },
  { code: 'Digit7', baseChar: '7', shiftChar: '&', row: 0, col: 7, finger: 'R_INDEX', hand: 'right' },
  { code: 'Digit8', baseChar: '8', shiftChar: '*', row: 0, col: 8, finger: 'R_MIDDLE', hand: 'right' },
  { code: 'Digit9', baseChar: '9', shiftChar: '(', row: 0, col: 9, finger: 'R_RING', hand: 'right' },
  { code: 'Digit0', baseChar: '0', shiftChar: ')', row: 0, col: 10, finger: 'R_PINKY', hand: 'right' },
  { code: 'Minus', baseChar: '-', shiftChar: '_', row: 0, col: 11, finger: 'R_PINKY', hand: 'right' },
  { code: 'Equal', baseChar: '=', shiftChar: '+', row: 0, col: 12, finger: 'R_PINKY', hand: 'right' },

  // Row 1: Top row
  { code: 'Tab', baseChar: 'Tab', row: 1, col: 0, width: 1.4, finger: 'L_PINKY', hand: 'left', label: 'Tab' },
  { code: 'KeyQ', baseChar: 'q', shiftChar: 'Q', row: 1, col: 1, finger: 'L_PINKY', hand: 'left' },
  { code: 'KeyW', baseChar: 'w', shiftChar: 'W', row: 1, col: 2, finger: 'L_RING', hand: 'left' },
  { code: 'KeyE', baseChar: 'e', shiftChar: 'E', altGrChar: 'ę', altGrShiftChar: 'Ę', row: 1, col: 3, finger: 'L_MIDDLE', hand: 'left' },
  { code: 'KeyR', baseChar: 'r', shiftChar: 'R', row: 1, col: 4, finger: 'L_INDEX', hand: 'left' },
  { code: 'KeyT', baseChar: 't', shiftChar: 'T', row: 1, col: 5, finger: 'L_INDEX', hand: 'left' },
  { code: 'KeyY', baseChar: 'y', shiftChar: 'Y', row: 1, col: 6, finger: 'R_INDEX', hand: 'right' },
  { code: 'KeyU', baseChar: 'u', shiftChar: 'U', row: 1, col: 7, finger: 'R_INDEX', hand: 'right' },
  { code: 'KeyI', baseChar: 'i', shiftChar: 'I', row: 1, col: 8, finger: 'R_MIDDLE', hand: 'right' },
  { code: 'KeyO', baseChar: 'o', shiftChar: 'O', altGrChar: 'ó', altGrShiftChar: 'Ó', row: 1, col: 9, finger: 'R_RING', hand: 'right' },
  { code: 'KeyP', baseChar: 'p', shiftChar: 'P', row: 1, col: 10, finger: 'R_PINKY', hand: 'right' },
  { code: 'BracketLeft', baseChar: '[', shiftChar: '{', row: 1, col: 11, finger: 'R_PINKY', hand: 'right' },
  { code: 'BracketRight', baseChar: ']', shiftChar: '}', row: 1, col: 12, finger: 'R_PINKY', hand: 'right' },

  // Row 2: Home row
  { code: 'CapsLock', baseChar: 'Caps', row: 2, col: 0, width: 1.7, finger: 'L_PINKY', hand: 'left', label: 'Caps' },
  { code: 'KeyA', baseChar: 'a', shiftChar: 'A', altGrChar: 'ą', altGrShiftChar: 'Ą', row: 2, col: 1, finger: 'L_PINKY', hand: 'left', isHomeAnchor: true },
  { code: 'KeyS', baseChar: 's', shiftChar: 'S', altGrChar: 'ś', altGrShiftChar: 'Ś', row: 2, col: 2, finger: 'L_RING', hand: 'left', isHomeAnchor: true },
  { code: 'KeyD', baseChar: 'd', shiftChar: 'D', row: 2, col: 3, finger: 'L_MIDDLE', hand: 'left', isHomeAnchor: true },
  { code: 'KeyF', baseChar: 'f', shiftChar: 'F', row: 2, col: 4, finger: 'L_INDEX', hand: 'left', isHomeAnchor: true },
  { code: 'KeyG', baseChar: 'g', shiftChar: 'G', row: 2, col: 5, finger: 'L_INDEX', hand: 'left' },
  { code: 'KeyH', baseChar: 'h', shiftChar: 'H', row: 2, col: 6, finger: 'R_INDEX', hand: 'right' },
  { code: 'KeyJ', baseChar: 'j', shiftChar: 'J', row: 2, col: 7, finger: 'R_INDEX', hand: 'right', isHomeAnchor: true },
  { code: 'KeyK', baseChar: 'k', shiftChar: 'K', row: 2, col: 8, finger: 'R_MIDDLE', hand: 'right', isHomeAnchor: true },
  { code: 'KeyL', baseChar: 'l', shiftChar: 'L', altGrChar: 'ł', altGrShiftChar: 'Ł', row: 2, col: 9, finger: 'R_RING', hand: 'right', isHomeAnchor: true },
  { code: 'Semicolon', baseChar: ';', shiftChar: ':', row: 2, col: 10, finger: 'R_PINKY', hand: 'right', isHomeAnchor: true },
  { code: 'Quote', baseChar: "'", shiftChar: '"', row: 2, col: 11, finger: 'R_PINKY', hand: 'right' },

  // Row 3: Bottom row
  { code: 'ShiftLeft', baseChar: 'ShiftLeft', row: 3, col: 0, width: 2.1, finger: 'L_PINKY', hand: 'left', label: 'Shift' },
  { code: 'KeyZ', baseChar: 'z', shiftChar: 'Z', altGrChar: 'ż', altGrShiftChar: 'Ż', row: 3, col: 1, finger: 'L_PINKY', hand: 'left' },
  { code: 'KeyX', baseChar: 'x', shiftChar: 'X', altGrChar: 'ź', altGrShiftChar: 'Ź', row: 3, col: 2, finger: 'L_RING', hand: 'left' },
  { code: 'KeyC', baseChar: 'c', shiftChar: 'C', altGrChar: 'ć', altGrShiftChar: 'Ć', row: 3, col: 3, finger: 'L_MIDDLE', hand: 'left' },
  { code: 'KeyV', baseChar: 'v', shiftChar: 'V', row: 3, col: 4, finger: 'L_INDEX', hand: 'left' },
  { code: 'KeyB', baseChar: 'b', shiftChar: 'B', row: 3, col: 5, finger: 'L_INDEX', hand: 'left' },
  { code: 'KeyN', baseChar: 'n', shiftChar: 'N', altGrChar: 'ń', altGrShiftChar: 'Ń', row: 3, col: 6, finger: 'R_INDEX', hand: 'right' },
  { code: 'KeyM', baseChar: 'm', shiftChar: 'M', row: 3, col: 7, finger: 'R_INDEX', hand: 'right' },
  { code: 'Comma', baseChar: ',', shiftChar: '<', row: 3, col: 8, finger: 'R_MIDDLE', hand: 'right' },
  { code: 'Period', baseChar: '.', shiftChar: '>', row: 3, col: 9, finger: 'R_RING', hand: 'right' },
  { code: 'Slash', baseChar: '/', shiftChar: '?', row: 3, col: 10, finger: 'R_PINKY', hand: 'right' },
  { code: 'ShiftRight', baseChar: 'ShiftRight', row: 3, col: 11, width: 2.2, finger: 'R_PINKY', hand: 'right', label: 'Shift' },

  // Row 4: Space and modifiers
  { code: 'ControlLeft', baseChar: 'Ctrl', row: 4, col: 0, width: 1.5, finger: 'L_PINKY', hand: 'left', label: 'Ctrl' },
  { code: 'AltLeft', baseChar: 'Alt', row: 4, col: 1, width: 1.5, finger: 'THUMBS', hand: 'left', label: 'Alt' },
  { code: 'Space', baseChar: ' ', row: 4, col: 2, width: 6.2, finger: 'THUMBS', hand: 'both', label: 'Spacja / Space' },
  { code: 'AltRight', baseChar: 'AltGr', row: 4, col: 3, width: 1.8, finger: 'THUMBS', hand: 'right', label: 'AltGr' },
  { code: 'ControlRight', baseChar: 'CtrlR', row: 4, col: 4, width: 1.5, finger: 'R_PINKY', hand: 'right', label: 'Ctrl' },
];

export interface KeyLookupResult {
  keyDef: KeyDefinition;
  requiresShift: boolean;
  recommendedShiftCode?: 'ShiftLeft' | 'ShiftRight';
  requiresAltGr: boolean;
  finger: FingerId;
}

const CHAR_TO_KEY_MAP = new Map<string, KeyLookupResult>();

for (const keyDef of POLISH_QWERTY_KEYS) {
  if (keyDef.baseChar.length === 1) {
    CHAR_TO_KEY_MAP.set(keyDef.baseChar, {
      keyDef,
      requiresShift: false,
      requiresAltGr: false,
      finger: keyDef.finger,
    });
  }
  if (keyDef.shiftChar && keyDef.shiftChar.length === 1) {
    const oppositeShift = keyDef.hand === 'left' ? 'ShiftRight' : 'ShiftLeft';
    CHAR_TO_KEY_MAP.set(keyDef.shiftChar, {
      keyDef,
      requiresShift: true,
      recommendedShiftCode: oppositeShift,
      requiresAltGr: false,
      finger: keyDef.finger,
    });
  }
  if (keyDef.altGrChar && keyDef.altGrChar.length === 1) {
    CHAR_TO_KEY_MAP.set(keyDef.altGrChar, {
      keyDef,
      requiresShift: false,
      requiresAltGr: true,
      finger: keyDef.finger,
    });
  }
  if (keyDef.altGrShiftChar && keyDef.altGrShiftChar.length === 1) {
    const oppositeShift = keyDef.hand === 'left' ? 'ShiftRight' : 'ShiftLeft';
    CHAR_TO_KEY_MAP.set(keyDef.altGrShiftChar, {
      keyDef,
      requiresShift: true,
      recommendedShiftCode: oppositeShift,
      requiresAltGr: true,
      finger: keyDef.finger,
    });
  }
}

export function lookupCharKey(char: string): KeyLookupResult | undefined {
  return CHAR_TO_KEY_MAP.get(char);
}

export const POLISH_DIACRITICS = ['ą', 'ć', 'ę', 'ł', 'ń', 'ó', 'ś', 'ź', 'ż'] as const;

export const HOME_ROW_KEYS = ['f', 'j', 'd', 'k', 's', 'l', 'a', ';', 'g', 'h'] as const;
export const TOP_ROW_KEYS = ['r', 'u', 'e', 'i', 'w', 'o', 'q', 'p', 't', 'y'] as const;
export const BOTTOM_ROW_KEYS = ['v', 'm', 'c', ',', 'x', '.', 'z', '/', 'b', 'n'] as const;
export const NUMBER_PUNCTUATION_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '!', '?'] as const;
