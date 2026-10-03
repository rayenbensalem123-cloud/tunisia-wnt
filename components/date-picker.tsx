"use client"
import React, { useEffect, useMemo, useRef, useState } from "react"
import { ChevronLeft, ChevronRight, ChevronDown, CalendarDays, X } from "lucide-react"

// ─────────────────────────────────────────────────────────────
// DATE PICKER — calendrier maison, aucun <input type="date">.
// Point demande explicitement : le navigateur ne laisse pas choisir
// l'annee. Ici l'annee est un select + un slider sur 1900-2100,
// donc n'importe quelle annee est atteignable sans faire defiler
// 120 ans avec les fleches.
// ─────────────────────────────────────────────────────────────

export const YEAR_MIN = 1900
export const YEAR_MAX = 2100

// Noms de mois et journes en 3 langues. fr/en/ar : l'app triche deja
// en anglais pour "vs", on reste sur les 3 slangs reellement utilises.
const MONTHS: Record<string, string[]> = {
  en: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
  fr: ["Janvier", "Fevrier", "Mars", "Avril", "Mai", "Juin", "Juillet", "Aout", "Septembre", "Octobre", "Novembre", "Decembre"],
  ar: ["جانفي", "فيفري", "مارس", "أفريل", "ماي", "جوان", "جويلية", "أوت", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"],
}
// Lundi = 0 : l'app est francophone, la semaine commence lundi.
const DOW: Record<string, string[]> = {
  en: ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"],
  fr: ["Lu", "Ma", "Me", "Je", "Ve", "Sa", "Di"],
  ar: ["ن", "ث", "ر", "خ", "ج", "س", "ح"],
}

const pad = (n: number) => String(n).padStart(2, "0")

// toISOString -> "YYYY-MM-DD". On travaille en heure locale, pas UTC :
// new Date().toISOString().slice(0,10) décale d'un jour selon le fuseau.
export const toYMD = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

// Parse "YYYY-MM-DD" en Date locale. new Date("2026-03-01") est interprete
// en UTC et peut retomber sur le 28 fevrier en fuseau negatif.
export const parseYMD = (s: string): Date | null => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || "")
  if (!m) return null
  const [, y, mo, da] = m
  const d = new Date(Number(y), Number(mo) - 1, Number(da))
  return Number.isFinite(d.getTime()) ? d : null
}

// Grille de 6 semaines x 7 jours, lundi en tete, avec les jours voisins
// pour que la premiere et la derniere semaine ne soient pas des trous.
export function monthGrid(year: number, month: number) {
  const first = new Date(year, month, 1)
  const lead = (first.getDay() + 6) % 7
  const start = new Date(year, month, 1 - lead)
  return Array.from({ length: 42 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i))
}

const Chevron = ({ dir, onClick, label }: { dir: "l" | "r"; onClick: () => void; label: string }) => (
  <button
    type="button"
    onClick={onClick}
    aria-label={label}
    className="w-8 h-8 rounded-lg grid place-items-center text-[var(--c-textDim)] hover:text-[#E30613] hover:bg-[#E30613]/10 transition-all shrink-0"
  >
    {dir === "l" ? <ChevronLeft size={15} /> : <ChevronRight size={15} />}
  </button>
)

export default function DatePicker({
  value, onChange, lang = "en", placeholder = "YYYY-MM-DD", className = "", ariaLabel,
}: {
  value: string
  onChange: (v: string) => void
  lang?: string
  placeholder?: string
  className?: string
  ariaLabel?: string
}) {
  const [open, setOpen] = useState(false)
  const [yearMode, setYearMode] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const today = useMemo(() => new Date(), [])

  const sel = parseYMD(value)
  // Sans valeur, on affiche le mois courant pour ne pas demarrer ailleurs.
  const [view, setView] = useState(() => ({ y: sel?.getFullYear() ?? today.getFullYear(), m: sel?.getMonth() ?? today.getMonth() }))

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return
      if (yearMode) setYearMode(false); else setOpen(false)
    }
    document.addEventListener("mousedown", onDown)
    document.addEventListener("keydown", onKey)
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey) }
  }, [open, yearMode])

  // Re-synchronise le mois affiche quand la valeur change de l'exterieur.
  useEffect(() => {
    const d = parseYMD(value)
    if (d) setView({ y: d.getFullYear(), m: d.getMonth() })
  }, [value])

  const months = MONTHS[lang] || MONTHS.en
  const dow = DOW[lang] || DOW.en
  const grid = useMemo(() => monthGrid(view.y, view.m), [view])
  const todayYMD = toYMD(today)

  const shift = (dy: number, dm: number) => {
    const d = new Date(view.y, view.m + dm, 1)
    setView({ y: d.getFullYear(), m: d.getMonth() })
    void dy
  }

  // Navigation par annee : boutons -/+ par 12 ans, plus un slider et
  // une grille de decades. C'est ce qui manquait au navigateur.
  const yearGrid = useMemo(() => {
    const out: number[] = []
    const start = Math.floor(view.y / 20) * 20
    for (let y = start; y < start + 60; y++) out.push(y)
    return out
  }, [view.y])

  const label = sel ? `${pad(sel.getDate())} ${months[sel.getMonth()]} ${sel.getFullYear()}` : placeholder

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-haspopup="dialog"
        data-od-picker="date"
        className="w-full flex items-center justify-between gap-2 px-4 py-3 rounded-xl bg-[var(--c-panel3)] border border-[rgba(var(--line-rgb),.22)] text-[var(--c-text)] text-[12px] font-bold outline-none hover:border-[rgba(var(--line-rgb),.4)] focus:border-[#E30613]/50 transition-all text-left"
      >
        <span className={`flex items-center gap-2 min-w-0 ${value ? "" : "text-[var(--c-textFaint)]"}`}>
          <CalendarDays size={13} className="text-[#E30613] shrink-0" />
          <span className="truncate tabular-nums">{label}</span>
        </span>
        <span className="flex items-center gap-1 shrink-0">
          {value && (
            <span
              role="button"
              tabIndex={0}
              aria-label="Effacer la date"
              onClick={e => { e.stopPropagation(); onChange("") }}
              onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); onChange("") } }}
              className="w-5 h-5 grid place-items-center rounded text-[var(--c-textFaint)] hover:text-[#E30613] hover:bg-[#E30613]/10 transition-all cursor-pointer"
            >
              <X size={11} />
            </span>
          )}
          <ChevronDown size={13} className={`text-[var(--c-textDim)] transition-transform ${open ? "rotate-180" : ""}`} />
        </span>
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Calendrier"
          data-od-picker="calendar"
          className="absolute z-[400] top-full mt-1.5 left-0 w-[19rem] max-w-[calc(100vw-2rem)] rounded-2xl bg-[var(--c-raised)] border border-[rgba(var(--line-rgb),.2)] shadow-2xl p-3"
        >
          {yearMode ? (
            /* ── Selecteur d'annee ── */
            <div>
              <div className="flex items-center justify-between gap-1 mb-2">
                <Chevron dir="l" onClick={() => setView(v => ({ ...v, y: Math.max(YEAR_MIN, v.y - 12) }))} label="12 ans precedents" />
                <span className="text-[16px] font-black tabular-nums text-[var(--c-text)]">{view.y}</span>
                <Chevron dir="r" onClick={() => setView(v => ({ ...v, y: Math.min(YEAR_MAX, v.y + 12) }))} label="12 ans suivants" />
              </div>

              <input
                type="range"
                min={YEAR_MIN}
                max={YEAR_MAX}
                step={1}
                value={Math.min(YEAR_MAX, Math.max(YEAR_MIN, view.y))}
                onChange={e => setView(v => ({ ...v, y: Number(e.target.value) }))}
                aria-label="Annee"
                className="w-full accent-[#E30613] mb-3"
              />

              <div className="grid grid-cols-4 gap-1">
                {yearGrid.map(y => (
                  <button
                    key={y}
                    type="button"
                    onClick={() => { setView(v => ({ ...v, y })); setYearMode(false) }}
                    className={`py-1.5 rounded-lg text-[11px] font-black tabular-nums transition-all ${
                      y === view.y ? "bg-[#E30613] text-white" : y === today.getFullYear() ? "bg-[#E30613]/12 text-[#E30613]" : "bg-[var(--c-panel3)] text-[var(--c-textMid)] hover:text-[var(--c-text)]"
                    }`}
                  >
                    {y}
                  </button>
                ))}
              </div>

              <div className="mt-3 flex items-center gap-1.5">
                {[5, 10, 25].map(step => (
                  <button
                    key={step}
                    type="button"
                    onClick={() => setView(v => ({ ...v, y: Math.min(YEAR_MAX, Math.max(YEAR_MIN, v.y + step)) }))}
                    className="px-2 py-1 rounded-md bg-[var(--c-panel3)] text-[10px] font-black uppercase tracking-wider text-[var(--c-textMid)] hover:text-[#E30613] transition-all"
                  >
                    {step} ans
                  </button>
                ))}
                <button type="button" onClick={() => { setView({ y: today.getFullYear(), m: today.getMonth() }); setYearMode(false) }} className="ms-auto px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-wider text-[#E30613] hover:bg-[#E30613]/10 transition-all">
                  Aujourd'hui
                </button>
              </div>
            </div>
          ) : (
            /* ── Mois ── */
            <>
              <div className="flex items-center justify-between gap-1 mb-2">
                <Chevron dir="l" onClick={() => shift(-1, -1)} label="Mois precedent" />
                <button
                  type="button"
                  onClick={() => setYearMode(true)}
                  aria-label="Choisir l annee"
                  className="flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-[#E30613]/10 transition-all"
                >
                  <span className="text-[13px] font-black text-[var(--c-text)]">{months[view.m]}</span>
                  <span className="text-[13px] font-black text-[#E30613] tabular-nums">{view.y}</span>
                  <ChevronDown size={11} className="text-[#E30613]" />
                </button>
                <Chevron dir="r" onClick={() => shift(1, 1)} label="Mois suivant" />
              </div>

              <div className="grid grid-cols-7 gap-0.5 mb-1">
                {dow.map(d => (
                  <span key={d} className="text-center text-[9px] font-black uppercase tracking-wider text-[var(--c-textFaint)] py-1">{d}</span>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-0.5">
                {grid.map(d => {
                  const ymd = toYMD(d)
                  const outside = d.getMonth() !== view.m
                  const isSel = ymd === value
                  const isToday = ymd === todayYMD
                  return (
                    <button
                      key={ymd}
                      type="button"
                      onClick={() => { onChange(ymd); setOpen(false) }}
                      aria-label={ymd}
                      aria-pressed={isSel}
                      className={`aspect-square rounded-lg text-[11px] font-black tabular-nums transition-all ${
                        isSel
                          ? "bg-[#E30613] text-white"
                          : outside
                            ? "text-[var(--c-textFaint)] hover:text-[var(--c-textMid)]"
                            : isToday
                              ? "bg-[#E30613]/12 text-[#E30613] hover:bg-[#E30613]/20"
                              : "text-[var(--c-text)] hover:bg-[var(--c-panel3)]"
                      }`}
                    >
                      {d.getDate()}
                    </button>
                  )
                })}
              </div>

              <div className="mt-2 pt-2 border-t border-[rgba(var(--line-rgb),.14)] flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => { onChange(todayYMD); setOpen(false) }}
                  className="px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-wider text-[#E30613] hover:bg-[#E30613]/10 transition-all"
                >
                  Aujourd'hui
                </button>
                <button
                  type="button"
                  onClick={() => { onChange(""); setOpen(false) }}
                  className="ms-auto px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-wider text-[var(--c-textFaint)] hover:text-[var(--c-text)] transition-all"
                >
                  Effacer
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}