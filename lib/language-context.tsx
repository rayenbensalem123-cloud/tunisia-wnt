"use client"
import React, { createContext, useContext, useState, useEffect, useCallback } from "react"
import t, { type Lang } from "./translations"

type LanguageContextType = {
  lang: Lang
  setLang: (l: Lang) => void
  tr: typeof t.en
  dir: "ltr" | "rtl"
}

const LanguageContext = createContext<LanguageContextType>({
  lang: "en",
  setLang: () => {},
  tr: t.en,
  dir: "ltr",
})

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en")
  const [tr, setTr] = useState(t.en)

  useEffect(() => {
    const saved = localStorage.getItem("esq-lang") as Lang | null
    if (saved && saved in t) {
      setLangState(saved)
      setTr(t[saved])
    }
  }, [])

  const setLang = useCallback((l: Lang) => {
    setLangState(l)
    setTr(t[l])
    localStorage.setItem("esq-lang", l)
    document.documentElement.dir = t[l].lang.dir
    document.documentElement.lang = l
  }, [])

  useEffect(() => {
    document.documentElement.dir = tr.lang.dir
    document.documentElement.lang = lang
  }, [lang, tr])

  return (
    <LanguageContext.Provider value={{ lang, setLang, tr, dir: tr.lang.dir }}>
      {children}
    </LanguageContext.Provider>
  )
}

export const useTranslate = () => useContext(LanguageContext)
