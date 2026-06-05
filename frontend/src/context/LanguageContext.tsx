import { createContext, useContext, useState, ReactNode } from 'react'
import type { Lang } from '../i18n/translations'
import t from '../i18n/translations'

interface LanguageContextValue {
  lang: Lang
  setLang: (l: Lang) => void
  T: typeof t['de']
}

const LanguageContext = createContext<LanguageContextValue>({
  lang: 'de',
  setLang: () => {},
  T: t.de,
})

export function LanguageProvider({ children }: { children: ReactNode }) {
  const stored = (localStorage.getItem('echo_lang') as Lang) || 'de'
  const [lang, setLangState] = useState<Lang>(stored)

  function setLang(l: Lang) {
    setLangState(l)
    localStorage.setItem('echo_lang', l)
  }

  return (
    <LanguageContext.Provider value={{ lang, setLang, T: t[lang] }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLang() {
  return useContext(LanguageContext)
}
