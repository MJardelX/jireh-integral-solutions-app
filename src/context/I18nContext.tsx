'use client';

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { en } from '@/lib/i18n/en';
import { es } from '@/lib/i18n/es';
import type { Translations } from '@/lib/i18n/en';

export type Lang = 'en' | 'es';

const LANG_KEY = 'jireh_lang';
const LOCALES: Record<Lang, Translations> = { en, es };

interface I18nContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: Translations;
}

const I18nContext = createContext<I18nContextValue>({
  lang: 'en',
  setLang: () => {},
  t: en,
});

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>('en');

  // Hydrate from localStorage after mount (avoids SSR mismatch)
  useEffect(() => {
    try {
      const stored = localStorage.getItem(LANG_KEY) as Lang | null;
      if (stored && stored in LOCALES) setLangState(stored);
    } catch { /* ignore */ }
  }, []);

  const setLang = useCallback((newLang: Lang) => {
    setLangState(newLang);
    try { localStorage.setItem(LANG_KEY, newLang); } catch { /* ignore */ }
  }, []);

  return (
    <I18nContext.Provider value={{ lang, setLang, t: LOCALES[lang] }}>
      {children}
    </I18nContext.Provider>
  );
}

/** Returns the full translations object for the current language. */
export function useT(): Translations {
  return useContext(I18nContext).t;
}

/** Returns lang + setLang — use when you need to read or change the language. */
export function useI18n() {
  return useContext(I18nContext);
}
