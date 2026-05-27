import { en, type TranslationKey } from './en';
import { sw } from './sw';

export type Language = 'en' | 'sw';
export type { TranslationKey };

const dictionaries: Record<Language, Record<TranslationKey, string>> = { en, sw };

/**
 * Look up a translation by key.
 *
 * Falls back to returning the key itself if missing — by design, so the omission
 * is visible in the UI rather than silently swallowed (SRS NFR-031).
 *
 * @example
 *   t('en', 'nav.dashboard') // → 'Zen Dashboard'
 *   t('sw', 'nav.dashboard') // → 'Dashibodi ya Zen'
 */
export function t(lang: Language, key: TranslationKey): string {
  return dictionaries[lang][key] ?? key;
}

export { en, sw };
