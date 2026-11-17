import { Language } from '../types';
import { TRANSLATIONS } from './translations';

export class LocalizationService {
  private currentLanguage: Language = 'pl';

  constructor(initialLanguage: Language = 'pl') {
    this.currentLanguage = initialLanguage;
  }

  public getLanguage(): Language {
    return this.currentLanguage;
  }

  public setLanguage(lang: Language): void {
    this.currentLanguage = lang;
    if (typeof document !== 'undefined') {
      document.documentElement.lang = lang;
    }
  }

  public t(key: string): string {
    const table = TRANSLATIONS[this.currentLanguage] ?? TRANSLATIONS.pl;
    return table[key] ?? TRANSLATIONS.pl[key] ?? key;
  }

  public pick(plText: string, enText: string): string {
    return this.currentLanguage === 'pl' ? plText : enText;
  }
}
