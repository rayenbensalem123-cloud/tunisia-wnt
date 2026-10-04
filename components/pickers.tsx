"use client"
import React, { useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo } from "react"
import { createPortal } from "react-dom"
import { Calendar, ChevronDown, ChevronLeft, ChevronRight, Check, Minus, Plus } from "lucide-react"

// ─────────────────────────────────────────────
// Shared, theme-matched pickers (no native browser controls).
//   PopoverPortal  – fixed-position popup rendered into <body> so it never gets
//                    clipped by an overflow:auto form panel.
//   DatePicker     – YYYY-MM-DD, with month / year / decade views.
//   AgeCalendar    – DD/MM/YYYY birthdate, opens on the year grid.
//   Select         – replaces native <select>.
//   NumberStepper  – replaces native <input type="number">.
//   JerseyScale    – 0-99 scrubbable scale.
// ─────────────────────────────────────────────

export type PickerVariant = "field" | "big" | "zinc" | "stage" | "soft" | "mini"

const TRIGGER_CLASS: Record<PickerVariant, string> = {
  field: "pm-field",
  big: "w-full rounded-2xl bg-[var(--c-raised)] border border-[rgba(var(--line-rgb),.14)] px-4 py-4 text-xs font-bold text-[var(--c-text)]",
  zinc: "w-full p-2.5 bg-zinc-50 rounded-lg border border-zinc-200 text-[12px] font-bold",
  stage: "w-full px-4 py-3 rounded-xl bg-[var(--c-panel3)] border border-[rgba(var(--line-rgb),.22)] text-[var(--c-text)] text-[11px] font-bold",
  soft: "w-full bg-zinc-50 border border-zinc-100 p-4 rounded-2xl font-bold text-xs uppercase",
  mini: "px-2.5 py-1.5 rounded-lg bg-[var(--c-surface)] border border-[rgba(var(--line-rgb),.2)] text-[8px] font-bold text-[var(--c-textBlue)]",
}

const POPUP_FONT = "'Oswald','Arial Narrow',Arial,sans-serif"

// ── PopoverPortal ────────────────────────────
// The popup renders into document.body (escapes overflow clipping) and so also
// escapes the .ftf-portal wrapper that applies the app font — hence the inline
// font-family / letter-spacing below.
export const PopoverPortal = ({
  anchorRef, open, onClose, width, align = "left", children,
}: {
  anchorRef: React.RefObject<HTMLElement | null>
  open: boolean
  onClose: () => void
  width: number | "anchor"
  align?: "left" | "right"
  children: React.ReactNode
}) => {
  const popRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  const place = useCallback(() => {
    const el = anchorRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const w = width === "anchor" ? Math.max(r.width, 160) : width
    const h = popRef.current?.offsetHeight || 0
    let left = align === "right" ? r.right - w : r.left
    left = Math.max(8, Math.min(left, window.innerWidth - w - 8))
    const below = window.innerHeight - r.bottom - 8
    const above = r.top - 8
    let top = h && h > below && above > below ? Math.max(8, r.top - h - 6) : r.bottom + 6
    // never let the popup run off the bottom of the screen (it scrolls internally via maxHeight)
    if (h) top = Math.max(8, Math.min(top, window.innerHeight - h - 8))
    setPos(p => (p && p.top === top && p.left === left && p.width === w ? p : { top, left, width: w }))
  }, [anchorRef, width, align])

  // Position before paint, and re-measure after the popup mounts / its content changes size.
  useLayoutEffect(() => {
    if (open) place()
  })

  useEffect(() => {
    if (!open) { setPos(null); return }
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node
      if (anchorRef.current?.contains(t)) return
      if (popRef.current?.contains(t)) return
      onCloseRef.current()
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onCloseRef.current() }
    const onMove = () => place()
    document.addEventListener("pointerdown", onDown)
    document.addEventListener("keydown", onKey)
    window.addEventListener("scroll", onMove, true)
    window.addEventListener("resize", onMove)
    let ro: ResizeObserver | undefined
    if (typeof ResizeObserver !== "undefined" && popRef.current) {
      ro = new ResizeObserver(onMove)
      ro.observe(popRef.current)
    }
    return () => {
      document.removeEventListener("pointerdown", onDown)
      document.removeEventListener("keydown", onKey)
      window.removeEventListener("scroll", onMove, true)
      window.removeEventListener("resize", onMove)
      ro?.disconnect()
    }
  }, [open, place, anchorRef, pos === null])

  if (!open || !pos || typeof document === "undefined") return null
  return createPortal(
    <div
      ref={popRef}
      className="pk-pop pk-scroll rounded-2xl bg-[var(--c-raised)] border border-[rgba(var(--line-rgb),.22)] overflow-y-auto"
      style={{
        position: "fixed", top: pos.top, left: pos.left, width: pos.width, zIndex: 500,
        maxHeight: "calc(100dvh - 16px)",
        fontFamily: POPUP_FONT, letterSpacing: ".02em",
        boxShadow: "0 22px 60px -14px rgba(0,0,0,.6), 0 0 0 1px rgba(227,6,44,.06)",
      }}
    >
      {/* brand accent line */}
      <div className="h-[3px] w-full" style={{ background: "linear-gradient(90deg,#E30613,#f6c744)" }} />
      <div className="p-3">{children}</div>
    </div>,
    document.body
  )
}

// ── Shared trigger button ────────────────────
const PickerTrigger = ({
  open, onClick, variant, icon, label, filled, align = "between", onKeyDown,
}: {
  open: boolean
  onClick: () => void
  variant: PickerVariant
  icon?: React.ReactNode
  label: React.ReactNode
  filled: boolean
  align?: "between" | "center"
  onKeyDown?: (e: React.KeyboardEvent<HTMLButtonElement>) => void
}) => (
  <button
    type="button"
    onClick={onClick}
    onKeyDown={onKeyDown}
    aria-haspopup="listbox"
    aria-expanded={open}
    className={`${TRIGGER_CLASS[variant]} flex items-center ${align === "center" ? "justify-center" : "justify-between"} gap-2 text-left transition-all ${
      // trailing "!" = important: .pm-field's border is unlayered CSS and would otherwise beat these utilities
      open ? "border-[#E30613]/70! shadow-[0_0_0_3px_rgba(227,6,44,.16)]" : "hover:border-[#E30613]/40!"
    }`}
  >
    <span className="flex items-center gap-2 min-w-0">
      {icon}
      <span className={`truncate ${filled ? "text-[var(--c-text)]" : "text-[var(--c-textFaint)]"}`}>{label}</span>
    </span>
    <ChevronDown size={12} className={`shrink-0 transition-transform ${open ? "text-[#E30613] rotate-180" : "text-[var(--c-textDim)]"}`} />
  </button>
)

// ── Date helpers ─────────────────────────────
const pad = (n: number) => String(n).padStart(2, "0")
const fmtISO = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const fmtDMY = (d: Date) => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`
const parseISO = (v: string): Date | null => {
  if (!v) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v)
  if (!m) return null
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  return isNaN(d.getTime()) ? null : d
}
const parseDMY = (v: string): Date | null => {
  if (!v || !v.includes("/")) return null
  const [d, m, y] = v.split("/").map(Number)
  if (!d || !m || !y) return null
  const dt = new Date(y, m - 1, d)
  return isNaN(dt.getTime()) ? null : dt
}
const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())
const ageFrom = (b: Date) => {
  const n = new Date()
  let age = n.getFullYear() - b.getFullYear()
  if (n.getMonth() < b.getMonth() || (n.getMonth() === b.getMonth() && n.getDate() < b.getDate())) age--
  return age
}

// ── Calendar panel (days / months / years) ───
type CalView = "days" | "months" | "years"

const navBtn = "p-1.5 rounded-full text-[var(--c-text)] hover:bg-[var(--c-panel4)] transition-all disabled:opacity-25 disabled:pointer-events-none"
const headPill = "px-2 py-1 rounded-lg text-[11px] font-black uppercase tracking-wider text-[var(--c-text)] hover:bg-[var(--c-panel4)] hover:text-[#E30613] transition-all flex items-center gap-1"

const CalendarPanel = ({
  selected, initial, onPick, minYear, maxYear, maxDate, startView = "days", footer,
}: {
  selected: Date | null
  initial: Date
  onPick: (d: Date) => void
  minYear: number
  maxYear: number
  maxDate?: Date
  startView?: CalView
  footer?: React.ReactNode
}) => {
  const today = useMemo(() => new Date(), [])
  const clampYear = (v: number) => Math.min(maxYear, Math.max(minYear, v))
  const [view, setView] = useState<CalView>(startView)
  const [y, setY] = useState(clampYear(initial.getFullYear()))
  const [m, setM] = useState(initial.getMonth())
  const alignPage = (yr: number) => minYear + 12 * Math.floor((clampYear(yr) - minYear) / 12)
  const [pageStart, setPageStart] = useState(() => alignPage(initial.getFullYear()))

  const monthNames = useMemo(
    () => Array.from({ length: 12 }, (_, i) => new Date(2000, i, 1).toLocaleDateString(undefined, { month: "short" })),
    []
  )
  const monthLong = new Date(y, m, 1).toLocaleDateString(undefined, { month: "long" })

  const stepMonth = (d: number) => {
    let nm = m + d, ny = y
    if (nm < 0) { nm = 11; ny-- }
    if (nm > 11) { nm = 0; ny++ }
    if (ny < minYear || ny > maxYear) return
    setM(nm); setY(ny)
  }

  const cell = "aspect-square rounded-full text-[10px] font-bold transition-all flex items-center justify-center"
  const big = "h-10 rounded-xl text-[11px] font-black uppercase tracking-wide transition-all flex items-center justify-center"
  const on = "text-white shadow-[0_4px_14px_-4px_rgba(227,6,44,.7)]"
  const onBg = { background: "linear-gradient(135deg,#ef183e,#bf0020)" } as React.CSSProperties

  // ----- header -----
  let header: React.ReactNode
  if (view === "days") {
    header = (
      <div className="flex items-center justify-between mb-2">
        <button type="button" className={navBtn} onClick={() => stepMonth(-1)} disabled={y === minYear && m === 0} aria-label="Previous month"><ChevronLeft size={14} /></button>
        <div className="flex items-center gap-0.5">
          <button type="button" className={headPill} onClick={() => setView("months")}>{monthLong}</button>
          <button type="button" className={headPill} onClick={() => { setPageStart(alignPage(y)); setView("years") }}>{y}<ChevronDown size={10} /></button>
        </div>
        <button type="button" className={navBtn} onClick={() => stepMonth(1)} disabled={y === maxYear && m === 11} aria-label="Next month"><ChevronRight size={14} /></button>
      </div>
    )
  } else if (view === "months") {
    header = (
      <div className="flex items-center justify-between mb-2">
        <button type="button" className={navBtn} onClick={() => setY(v => Math.max(minYear, v - 1))} disabled={y <= minYear} aria-label="Previous year"><ChevronLeft size={14} /></button>
        <button type="button" className={headPill} onClick={() => { setPageStart(alignPage(y)); setView("years") }}>{y}<ChevronDown size={10} /></button>
        <button type="button" className={navBtn} onClick={() => setY(v => Math.min(maxYear, v + 1))} disabled={y >= maxYear} aria-label="Next year"><ChevronRight size={14} /></button>
      </div>
    )
  } else {
    const last = Math.min(maxYear, pageStart + 11)
    header = (
      <div className="flex items-center justify-between mb-2">
        <button type="button" className={navBtn} onClick={() => setPageStart(p => Math.max(minYear, p - 12))} disabled={pageStart <= minYear} aria-label="Earlier years"><ChevronLeft size={14} /></button>
        <span className="px-2 py-1 text-[11px] font-black uppercase tracking-wider text-[var(--c-text)]">{pageStart} – {last}</span>
        <button type="button" className={navBtn} onClick={() => setPageStart(p => p + 12)} disabled={pageStart + 12 > maxYear} aria-label="Later years"><ChevronRight size={14} /></button>
      </div>
    )
  }

  // ----- body -----
  let body: React.ReactNode
  if (view === "days") {
    const firstDay = new Date(y, m, 1).getDay()
    const daysInMonth = new Date(y, m + 1, 0).getDate()
    const cells: (number | null)[] = []
    for (let i = 0; i < firstDay; i++) cells.push(null)
    for (let d = 1; d <= daysInMonth; d++) cells.push(d)
    body = (
      <>
        <div className="grid grid-cols-7 gap-0.5 mb-1">
          {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
            <div key={i} className="text-[8px] font-black text-[var(--c-textDim)] text-center py-1">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-0.5">
          {cells.map((d, i) => {
            if (d === null) return <div key={i} />
            const date = new Date(y, m, d)
            const disabled = !!maxDate && startOfDay(date) > startOfDay(maxDate)
            const isSel = !!selected && sameDay(date, selected)
            const isToday = sameDay(date, today)
            return (
              <button
                type="button" key={i} disabled={disabled}
                onClick={() => onPick(date)}
                style={isSel ? onBg : undefined}
                className={`${cell} ${
                  isSel ? on
                    : isToday ? "border border-[#E30613] text-[#E30613] hover:bg-[#E30613]/10"
                    : "text-[var(--c-text)] hover:bg-[var(--c-panel4)]"
                } ${disabled ? "opacity-25 pointer-events-none" : ""}`}
              >
                {d}
              </button>
            )
          })}
        </div>
      </>
    )
  } else if (view === "months") {
    body = (
      <div className="grid grid-cols-3 gap-1.5">
        {monthNames.map((name, i) => {
          const isSel = !!selected && selected.getFullYear() === y && selected.getMonth() === i
          const isNow = today.getFullYear() === y && today.getMonth() === i
          return (
            <button
              type="button" key={i}
              onClick={() => { setM(i); setView("days") }}
              style={isSel ? onBg : undefined}
              className={`${big} ${isSel ? on : isNow ? "border border-[#E30613] text-[#E30613] hover:bg-[#E30613]/10" : "text-[var(--c-text)] bg-[var(--c-panel4)] hover:bg-[var(--c-hover)]"}`}
            >
              {name}
            </button>
          )
        })}
      </div>
    )
  } else {
    body = (
      <div className="grid grid-cols-3 gap-1.5">
        {Array.from({ length: 12 }, (_, i) => pageStart + i).map(yr => {
          const out = yr < minYear || yr > maxYear
          const isSel = !!selected && selected.getFullYear() === yr
          const isNow = today.getFullYear() === yr
          return (
            <button
              type="button" key={yr} disabled={out}
              onClick={() => { setY(yr); setView("months") }}
              style={isSel ? onBg : undefined}
              className={`${big} ${out ? "opacity-20 pointer-events-none" : ""} ${isSel ? on : isNow ? "border border-[#E30613] text-[#E30613] hover:bg-[#E30613]/10" : "text-[var(--c-text)] bg-[var(--c-panel4)] hover:bg-[var(--c-hover)]"}`}
            >
              {yr}
            </button>
          )
        })}
      </div>
    )
  }

  return (
    <div>
      {header}
      {body}
      {footer}
    </div>
  )
}

const footerBtn = "text-[8px] font-black uppercase tracking-widest transition-colors"

// ── DatePicker (value: YYYY-MM-DD) ───────────
export const DatePicker = ({
  value, onChange, placeholder = "Select date", variant = "field", minYear, maxYear, clearable = true,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  variant?: PickerVariant
  minYear?: number
  maxYear?: number
  clearable?: boolean
}) => {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const nowY = new Date().getFullYear()
  const selected = parseISO(value)
  const close = () => setOpen(false)

  return (
    <div ref={ref} className="relative">
      <PickerTrigger
        open={open} onClick={() => setOpen(o => !o)} variant={variant} filled={!!selected}
        icon={<Calendar size={13} className="text-[#f6c744] shrink-0" />}
        label={selected ? selected.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" }) : placeholder}
      />
      <PopoverPortal anchorRef={ref} open={open} onClose={close} width={296}>
        <CalendarPanel
          selected={selected}
          initial={selected || new Date()}
          minYear={minYear ?? nowY - 60}
          maxYear={maxYear ?? nowY + 10}
          onPick={d => { onChange(fmtISO(d)); close() }}
          footer={
            <div className="mt-2 pt-2 border-t border-[rgba(var(--line-rgb),.14)] flex items-center justify-between px-1">
              <button type="button" onClick={() => { onChange(fmtISO(new Date())); close() }} className={`${footerBtn} text-[#f6c744] hover:text-[#E30613]`}>Today</button>
              {clearable && !!value && (
                <button type="button" onClick={() => { onChange(""); close() }} className={`${footerBtn} text-[var(--c-textDim)] hover:text-[#E30613]`}>Clear</button>
              )}
            </div>
          }
        />
      </PopoverPortal>
    </div>
  )
}

// ── AgeCalendar (value: DD/MM/YYYY) ──────────
// Emits DD/MM/YYYY to stay compatible with calculateAge() and the seed format (05/03/1980).
export const AgeCalendar = ({
  value, onChange, placeholder = "Select birthdate", variant = "field",
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  variant?: PickerVariant
}) => {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const today = new Date()
  const selected = parseDMY(value)
  const minYear = 1940
  const maxYear = today.getFullYear()
  // With no birthdate yet, open on the year grid around a typical player age so the year is one tap away.
  const initial = selected || new Date(Math.max(minYear, maxYear - 25), 0, 1)

  return (
    <div ref={ref} className="relative">
      <PickerTrigger
        open={open} onClick={() => setOpen(o => !o)} variant={variant} filled={!!selected}
        icon={<Calendar size={13} className="text-[#f6c744] shrink-0" />}
        label={selected ? fmtDMY(selected) : placeholder}
      />
      <PopoverPortal anchorRef={ref} open={open} onClose={() => setOpen(false)} width={296}>
        <CalendarPanel
          selected={selected}
          initial={initial}
          minYear={minYear}
          maxYear={maxYear}
          maxDate={today}
          startView={selected ? "days" : "years"}
          onPick={d => { onChange(fmtDMY(d)); setOpen(false) }}
          footer={selected ? (
            <div className="mt-2 pt-2 border-t border-[rgba(var(--line-rgb),.14)] flex items-center justify-between px-1">
              <span className="text-[8px] font-black uppercase tracking-widest text-[var(--c-textDim)]">Born {fmtDMY(selected)}</span>
              <span className="px-2 py-1 rounded-lg bg-[#E30613]/10 text-[#E30613] text-[10px] font-black">{ageFrom(selected)} YRS</span>
            </div>
          ) : undefined}
        />
      </PopoverPortal>
    </div>
  )
}

// ── Select (replaces native <select>) ────────
export type SelectOption = { value: string; label: string }

export const Select = ({
  value, onChange, options, placeholder = "Select", variant = "field", className = "",
  required = false, allowEmpty, icon,
}: {
  value: string
  onChange: (v: string) => void
  options: SelectOption[]
  placeholder?: string
  variant?: PickerVariant
  className?: string
  required?: boolean
  /** Show the placeholder as a first, selectable "none" row. Defaults to !required. */
  allowEmpty?: boolean
  icon?: React.ReactNode
}) => {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const showEmpty = allowEmpty ?? !required
  const rows: SelectOption[] = showEmpty ? [{ value: "", label: placeholder }, ...options] : options
  const current = options.find(o => o.value === value)
  const [active, setActive] = useState(0)

  useEffect(() => {
    if (!open) return
    const i = rows.findIndex(r => r.value === value)
    setActive(i >= 0 ? i : 0)
    // focus the list so arrow keys work immediately
    const t = setTimeout(() => listRef.current?.focus({ preventScroll: true }), 0)
    return () => clearTimeout(t)
  }, [open])

  // only auto-scroll for keyboard navigation (hover would make the list jitter)
  const byKeyboard = useRef(false)
  useEffect(() => {
    if (!open || !byKeyboard.current) return
    byKeyboard.current = false
    listRef.current?.querySelector<HTMLElement>(`[data-i="${active}"]`)?.scrollIntoView({ block: "nearest" })
  }, [active, open])

  const pick = (v: string) => { onChange(v); setOpen(false) }

  const onListKey = (e: React.KeyboardEvent) => {
    byKeyboard.current = true
    if (e.key === "ArrowDown") { e.preventDefault(); setActive(a => Math.min(rows.length - 1, a + 1)) }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive(a => Math.max(0, a - 1)) }
    else if (e.key === "Home") { e.preventDefault(); setActive(0) }
    else if (e.key === "End") { e.preventDefault(); setActive(rows.length - 1) }
    else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); if (rows[active]) pick(rows[active].value) }
    else if (e.key === "Tab") setOpen(false)
  }

  return (
    <div ref={ref} className={`relative ${variant === "mini" ? "inline-block" : ""} ${className}`}>
      <div ref={triggerRef}>
        <PickerTrigger
          open={open} onClick={() => setOpen(o => !o)} variant={variant} filled={!!current}
          icon={icon}
          label={current ? current.label : placeholder}
          onKeyDown={e => { if ((e.key === "ArrowDown" || e.key === "ArrowUp") && !open) { e.preventDefault(); setOpen(true) } }}
        />
      </div>
      {/* keeps native "required" form validation working with the custom control */}
      {required && (
        <input
          tabIndex={-1} aria-hidden required value={value} onChange={() => {}}
          className="absolute left-0 bottom-0 w-full h-px opacity-0 pointer-events-none"
        />
      )}
      <PopoverPortal anchorRef={triggerRef} open={open} onClose={() => setOpen(false)} width="anchor">
        <div
          ref={listRef} tabIndex={0} role="listbox" onKeyDown={onListKey}
          className="pk-scroll outline-none max-h-60 overflow-y-auto -m-1 p-1 flex flex-col gap-0.5"
        >
          {rows.map((r, i) => {
            const isSel = r.value === value
            const isEmpty = r.value === ""
            return (
              <button
                type="button" key={`${r.value}-${i}`} role="option" aria-selected={isSel} data-i={i}
                onMouseEnter={() => setActive(i)}
                onClick={() => pick(r.value)}
                className={`flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-left text-[11px] font-bold uppercase tracking-wide transition-colors ${
                  isSel ? "bg-[#E30613]/12 text-[#E30613]"
                    : i === active ? "bg-[var(--c-panel4)] text-[var(--c-text)]"
                    : isEmpty ? "text-[var(--c-textFaint)]" : "text-[var(--c-text)]"
                }`}
              >
                <span className="truncate">{r.label}</span>
                {isSel && <Check size={12} className="shrink-0" />}
              </button>
            )
          })}
          {rows.length === 0 && <div className="px-3 py-2 text-[10px] font-bold text-[var(--c-textDim)]">No options</div>}
        </div>
      </PopoverPortal>
    </div>
  )
}

// ── NumberStepper (replaces <input type="number">) ──
export const NumberStepper = ({
  value, onChange, min = 0, max = 99, accent = "text-[var(--c-text)]",
}: {
  value: string | number
  onChange: (v: string) => void
  min?: number
  max?: number
  accent?: string
}) => {
  // forms store these as either "" / "3" strings or plain numbers
  const raw = String(value ?? "")
  const n = raw === "" ? min : Math.max(min, Math.min(max, parseInt(raw, 10) || 0))
  const set = (v: number) => onChange(String(Math.max(min, Math.min(max, v))))
  const btn = "w-7 h-7 shrink-0 rounded-lg bg-[var(--c-panel4)] hover:bg-[#E30613]/12 text-[var(--c-textDim)] hover:text-[#E30613] flex items-center justify-center transition-all active:scale-90 disabled:opacity-30 disabled:pointer-events-none"
  return (
    <div
      role="spinbutton" aria-valuenow={n} aria-valuemin={min} aria-valuemax={max} tabIndex={0}
      onKeyDown={e => {
        if (e.key === "ArrowUp") { e.preventDefault(); set(n + 1) }
        else if (e.key === "ArrowDown") { e.preventDefault(); set(n - 1) }
      }}
      className="pm-field flex items-center justify-between gap-1 select-none"
      style={{ padding: 4 }}
    >
      <button type="button" tabIndex={-1} className={btn} onClick={() => set(n - 1)} disabled={n <= min} aria-label="Decrease"><Minus size={12} /></button>
      <span className={`text-[13px] font-black tabular-nums ${accent}`}>{n}</span>
      <button type="button" tabIndex={-1} className={btn} onClick={() => set(n + 1)} disabled={n >= max} aria-label="Increase"><Plus size={12} /></button>
    </div>
  )
}

// ── JerseyScale (0-99) ───────────────────────
export const JerseyScale = ({
  value, onChange, placeholder = "Jersey", variant = "field",
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  variant?: PickerVariant
}) => {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const barRef = useRef<HTMLDivElement>(null)
  const num = value === "" ? 0 : (parseInt(value, 10) || 0)
  const idx = Math.max(0, Math.min(99, num))
  const setNum = (n: number) => onChange(String(Math.max(0, Math.min(99, n))))
  const scrub = (clientX: number) => {
    const r = barRef.current?.getBoundingClientRect()
    if (!r || !r.width) return
    setNum(Math.round(Math.min(1, Math.max(0, (clientX - r.left) / r.width)) * 99))
  }
  const marks = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 99]
  const shown = value !== "" ? value : placeholder

  return (
    <div ref={ref} className="relative">
      <PickerTrigger
        open={open} onClick={() => setOpen(o => !o)} variant={variant} filled={value !== ""}
        icon={<span className="text-[7px] font-black uppercase tracking-widest text-[var(--c-textDim)] shrink-0">Nº</span>}
        label={<span className={value !== "" ? "font-black italic text-[#E30613]" : ""}>{shown}</span>}
      />
      <PopoverPortal anchorRef={ref} open={open} onClose={() => setOpen(false)} width={236}>
        <div className="flex items-center justify-between mb-3">
          <button type="button" onClick={() => setNum(idx - 1)} className="w-9 h-9 rounded-xl bg-[var(--c-panel4)] hover:bg-[#E30613]/10 text-[var(--c-textDim)] hover:text-[#E30613] flex items-center justify-center transition-all active:scale-90"><Minus size={14} /></button>
          <span className="text-4xl font-black italic text-[#E30613] leading-none tabular-nums">{idx}</span>
          <button type="button" onClick={() => setNum(idx + 1)} className="w-9 h-9 rounded-xl bg-[var(--c-panel4)] hover:bg-[#E30613]/10 text-[var(--c-textDim)] hover:text-[#E30613] flex items-center justify-center transition-all active:scale-90"><Plus size={14} /></button>
        </div>
        {/* scale bar: tap or drag to set the number */}
        <div
          ref={barRef}
          onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); scrub(e.clientX) }}
          onPointerMove={e => { if (e.buttons) scrub(e.clientX) }}
          className="relative h-9 rounded-xl bg-[var(--c-panel4)] overflow-hidden cursor-pointer touch-none"
        >
          <div className="absolute inset-y-0 left-0" style={{ width: `${(idx / 99) * 100}%`, background: "linear-gradient(90deg,rgba(227,6,44,.25),rgba(227,6,44,.6))" }} />
          <div className="absolute inset-y-0 w-[3px] rounded bg-[#E30613]" style={{ left: `calc(${(idx / 99) * 100}% - 1.5px)` }} />
        </div>
        <div className="relative h-3 mt-1 mb-2">
          {marks.map(mk => (
            <span key={mk} className="absolute -translate-x-1/2 text-[7px] font-black text-[var(--c-textDim)]" style={{ left: `${(mk / 99) * 100}%` }}>{mk}</span>
          ))}
        </div>
        <div className="flex flex-wrap gap-1">
          {[1, 5, 7, 8, 9, 10, 13, 17, 23, 66, 99].map(n => (
            <button key={n} type="button" onClick={() => { setNum(n); setOpen(false) }}
              className={`px-2 py-1 rounded-md text-[9px] font-black transition-all ${idx === n && value !== "" ? "bg-[#E30613] text-white" : "bg-[var(--c-panel4)] text-[var(--c-textDim)] hover:bg-[var(--c-hover)]"}`}>{n}</button>
          ))}
        </div>
      </PopoverPortal>
    </div>
  )
}

// ── MinuteBox: small "min'" input for the exact minute of a match event ──
export const MinuteBox = ({
  value, onChange, label, title = "Minute",
}: {
  value: number | undefined
  onChange: (v: number | undefined) => void
  label?: string
  title?: string
}) => (
  <label
    title={title}
    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-[var(--c-panel4)] border border-[rgba(var(--line-rgb),.18)] focus-within:border-[#E30613]/60 text-[9px] font-black text-[var(--c-textDim)] transition-colors"
  >
    {label && <span className="uppercase tracking-wider">{label}</span>}
    <input
      inputMode="numeric" pattern="[0-9]*" maxLength={3} placeholder="–"
      value={value === undefined ? "" : String(value)}
      onChange={e => {
        const d = e.target.value.replace(/\D/g, "").slice(0, 3)
        onChange(d === "" ? undefined : Math.min(130, parseInt(d, 10)))
      }}
      className="w-7 bg-transparent outline-none text-center text-[var(--c-text)] font-black"
    />
    <span>{"'"}</span>
  </label>
)
