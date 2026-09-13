"use client"
import { useEffect, useRef, useState } from "react"
import { Globe, Check } from "lucide-react"
import { useTranslate } from "@/lib/language-context"
import t, { type Lang } from "@/lib/translations"

const LANGS: Lang[] = Object.keys(t) as Lang[]

export default function LanguageToggle({ className = "", align = "right" }: { className?: string; align?: "left" | "right" }) {
  const { lang, setLang } = useTranslate()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onClick)
    return () => document.removeEventListener("mousedown", onClick)
  }, [open])

  return (
    <div ref={ref} className={`inline-block ${className}`}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-label="Change language"
        className="p-2.5 rounded-lg border border-[rgba(246,199,68,.28)] bg-[#0d1f3c]/70 backdrop-blur-md text-[#f6c744] hover:text-[#0c1f3d] hover:bg-[#f6c744] hover:border-[#f6c744] hover:shadow-[0_0_16px_rgba(246,199,68,.25)] transition-all fc-keep"
      >
        <Globe size={18} />
      </button>
      {open && (
        <div className={`absolute top-full mt-1.5 ${align === "right" ? "right-0" : "left-0"} z-[150] min-w-[172px] rounded-xl border border-white/15 bg-[#0d1f3c]/95 backdrop-blur-md shadow-2xl py-1.5 flex flex-col max-h-[calc(100dvh-6rem)] overflow-y-auto`}>
          {LANGS.map(l => (
            <button
              key={l}
              type="button"
              onClick={() => {
                setLang(l)
                setOpen(false)
              }}
              className={`w-full flex items-center justify-between gap-3 px-3.5 py-2.5 text-left text-[10px] font-black uppercase tracking-widest transition-all hover:bg-white/10 ${lang === l ? "text-[#f6c744]" : "text-[#edeff4]"}`}
            >
              <span>{t[l].lang.flag} {t[l].lang.name}</span>
              {lang === l && <Check size={14} className="text-[#f6c744]" />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}