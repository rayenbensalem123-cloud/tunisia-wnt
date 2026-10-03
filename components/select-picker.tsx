"use client"
import React, { useEffect, useMemo, useRef, useState } from "react"
import { ChevronDown, Check, Search, X } from "lucide-react"

// ─────────────────────────────────────────────────────────────
// SELECT PICKER — liste maison, aucun <select> navigateur.
// Le widget natif ignore les couleurs du theme, ne peut pas etre
// recherche, et sur Windows la liste deborde de la fenetre en blanc
// systeme. Ici : themed, filtrable, clavier, groupes.
// ─────────────────────────────────────────────────────────────

export type Option = { value: string; label: string; group?: string; disabled?: boolean }

const normalize = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()

export default function SelectPicker({
  value, onChange, options, placeholder = "Choisir...", className = "", searchable = false,
  lang = "en", disabled = false,
}: {
  value: string
  onChange: (v: string) => void
  options: Option[] | string[]
  placeholder?: string
  className?: string
  searchable?: boolean
  lang?: string
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState("")
  const [active, setActive] = useState(0)
  const ref = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const items: Option[] = useMemo(
    () => (options as any[]).map(o => (typeof o === "string" ? { value: o, label: o } : o)),
    [options],
  )

  const filtered = useMemo(() => {
    const nq = normalize(q.trim())
    if (!nq) return items
    return items.filter(i => normalize(i.label).includes(nq) || normalize(i.value).includes(nq))
  }, [items, q])

  const selected = items.find(i => i.value === value)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener("mousedown", onDown)
    return () => document.removeEventListener("mousedown", onDown)
  }, [open])

  // Reinit le filtre et l'index clavier a chaque ouverture.
  useEffect(() => { if (open) { setQ(""); setActive(Math.max(0, items.findIndex(i => i.value === value))) } }, [open])

  useEffect(() => {
    if (!open) return
    if (searchable) searchRef.current?.focus()
    else setActive(Math.max(0, items.findIndex(i => i.value === value)))
  }, [open, searchable])

  // Garde l'option clavier visible quand on navigue au clavier.
  useEffect(() => {
    if (!open || !listRef.current) return
    const el = listRef.current.querySelector<HTMLElement>(`[data-idx="${active}"]`)
    el?.scrollIntoView({ block: "nearest" })
  }, [active, open])

  const commit = (v: string) => { onChange(v); setOpen(false) }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open) {
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") { e.preventDefault(); setOpen(true) }
      return
    }
    if (e.key === "Escape") { e.preventDefault(); setOpen(false) }
    else if (e.key === "ArrowDown") { e.preventDefault(); setActive(i => Math.min(filtered.length - 1, i + 1)) }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive(i => Math.max(0, i - 1)) }
    else if (e.key === "Home") { e.preventDefault(); setActive(0) }
    else if (e.key === "End") { e.preventDefault(); setActive(Math.max(0, filtered.length - 1)) }
    else if (e.key === "Enter") {
      e.preventDefault()
      const hit = filtered[active]
      if (hit && !hit.disabled) commit(hit.value)
    } else if (e.key === "Tab") setOpen(false)
  }

  // Rendu groupe par groupe : les options qui portent un `group` sont
  // regroupees sous un intertitre, les autres restent en vrac.
  const groups = useMemo(() => {
    const map = new Map<string, Option[]>()
    const order: string[] = []
    filtered.forEach(i => {
      const g = i.group ?? ""
      if (!map.has(g)) { map.set(g, []); order.push(g) }
      map.get(g)!.push(i)
    })
    return order.map(g => ({ g, list: map.get(g)! }))
  }, [filtered])

  const flatIndex = (o: Option) => filtered.indexOf(o)

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen(o => !o)}
        onKeyDown={onKeyDown}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={selected?.label ?? placeholder}
        data-od-picker="select"
        className="w-full flex items-center justify-between gap-2 px-4 py-3 rounded-xl bg-[var(--c-panel3)] border border-[rgba(var(--line-rgb),.22)] text-[var(--c-text)] text-[12px] font-bold outline-none hover:border-[rgba(var(--line-rgb),.4)] focus:border-[#E30613]/50 disabled:opacity-50 transition-all text-left"
      >
        <span className={`truncate ${selected ? "" : "text-[var(--c-textFaint)]"}`}>{selected?.label ?? placeholder}</span>
        <ChevronDown size={13} className={`text-[var(--c-textDim)] shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div
          className="absolute z-[400] top-full mt-1.5 left-0 w-full min-w-[12rem] rounded-2xl bg-[var(--c-raised)] border border-[rgba(var(--line-rgb),.2)] shadow-2xl overflow-hidden"
        >
          {searchable && (
            <div className="flex items-center gap-2 px-3 py-2 border-b border-[rgba(var(--line-rgb),.14)]">
              <Search size={12} className="text-[var(--c-textFaint)] shrink-0" />
              <input
                ref={searchRef}
                value={q}
                onChange={e => { setQ(e.target.value); setActive(0) }}
                onKeyDown={onKeyDown}
                placeholder={lang === "fr" ? "Rechercher..." : lang === "ar" ? "بحث..." : "Search..."}
                aria-label="Filtrer"
                className="flex-1 bg-transparent text-[12px] font-bold text-[var(--c-text)] placeholder-[var(--c-textFaint)] outline-none min-w-0"
              />
              {q && (
                <span role="button" tabIndex={0} aria-label="Effacer" onClick={() => setQ("")} onKeyDown={e => { if (e.key === "Enter") setQ("") }} className="cursor-pointer text-[var(--c-textFaint)] hover:text-[#E30613] transition-colors">
                  <X size={12} />
                </span>
              )}
            </div>
          )}

          <div ref={listRef} role="listbox" className="max-h-56 overflow-y-auto overscroll-contain py-1">
            {filtered.length === 0 && (
              <p className="px-3 py-4 text-center text-[11px] font-bold uppercase tracking-wider text-[var(--c-textFaint)]">
                {lang === "fr" ? "Aucun resultat" : lang === "ar" ? "لا نتائج" : "No results"}
              </p>
            )}
            {groups.map(({ g, list }) => (
              <React.Fragment key={g || "_"}>
                {g !== "" && (
                  <p className="px-3 pt-2 pb-1 text-[9px] font-black uppercase tracking-[0.14em] text-[var(--c-textFaint)] sticky top-0 bg-[var(--c-raised)]">{g}</p>
                )}
                {list.map(o => {
                  const idx = flatIndex(o)
                  const on = o.value === value
                  return (
                    <button
                      key={o.value}
                      type="button"
                      data-idx={idx}
                      role="option"
                      aria-selected={on}
                      disabled={o.disabled}
                      onMouseEnter={() => setActive(idx)}
                      onClick={() => !o.disabled && commit(o.value)}
                      className={`w-full flex items-center gap-2 px-3 py-2 text-left text-[12px] font-bold transition-colors ${
                        o.disabled ? "opacity-35 cursor-not-allowed" : on ? "text-[#E30613]" : "text-[var(--c-textMid)] hover:text-[var(--c-text)]"
                      } ${idx === active && !o.disabled ? "bg-[#E30613]/10" : ""}`}
                    >
                      <span className="truncate flex-1">{o.label}</span>
                      {on && <Check size={12} className="shrink-0" />}
                    </button>
                  )
                })}
              </React.Fragment>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}