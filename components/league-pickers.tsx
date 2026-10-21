'use client'
// Platform-styled pickers for the Ligue Féminine screens: a calendar, a time wheel, a number
// wheel and a list chooser. They replace the browser's own date, time, number and select
// controls so every screen looks the same on every device.
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight, Clock } from 'lucide-react'
import { useTranslate } from '@/lib/language-context'
import { input } from '@/components/league-ui'

const pad = (n: number) => String(n).padStart(2, '0')
const iso = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`
/** 'YYYY-MM-DD' -> parts (month is 0-based); null if it is not a real date. */
const parse = (v: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v || '')
  if (!m) return null
  const y = +m[1], mo = +m[2] - 1, d = +m[3]
  const t = new Date(y, mo, d)
  return t.getFullYear() === y && t.getMonth() === mo && t.getDate() === d ? { y, m: mo, d } : null
}

const TRIGGER = `${input} flex items-center justify-between gap-2 text-start transition-colors hover:border-[#f6c744]/50`
const GOLD_BTN = 'flex-1 rounded-xl bg-[#f6c744] px-4 py-3 text-[12px] font-black uppercase tracking-widest text-[#0c1f3d] hover:bg-white transition-all'
const GHOST_BTN = 'rounded-xl border border-[rgba(var(--line-rgb),.3)] px-4 py-3 text-[12px] font-black uppercase tracking-widest text-[var(--c-textMid)] hover:text-[var(--c-text)] hover:border-[#f6c744]/60 transition-all'

function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose() } }
    window.addEventListener('keydown', key, true)
    ref.current?.focus()
    return () => window.removeEventListener('keydown', key, true)
  }, [onClose])
  if (typeof document === 'undefined') return null
  return createPortal(
    <div className="fixed inset-0 z-[500] flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center" onClick={e => { e.stopPropagation(); onClose() }}>
      <div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label={title} onClick={e => e.stopPropagation()}
        className="relative max-h-[92vh] w-full overflow-y-auto rounded-t-3xl border border-[rgba(var(--line-rgb),.28)] bg-[var(--c-bg)] text-[var(--c-text)] shadow-[0_-12px_50px_rgba(2,8,23,.6)] outline-none animate-[fadeUp_0.25s_ease-out_both] sm:max-w-[348px] sm:rounded-3xl">
        <span aria-hidden className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-[#ff2747] to-[#a30420]" />
        <p className="px-5 pb-1 pt-5 text-[11px] font-black uppercase tracking-[.25em] text-[#f6c744]">{title}</p>
        {children}
      </div>
    </div>,
    document.body,
  )
}

function Footer({ onClear, onToday, onDone }: { onClear?: () => void; onToday?: () => void; onDone?: () => void }) {
  const { tr } = useTranslate()
  const t = tr.league
  return (
    <div className="flex items-center gap-2 px-5 pb-5 pt-3">
      {onClear && <button type="button" onClick={onClear} className={GHOST_BTN}>{t.clear}</button>}
      {onToday && <button type="button" onClick={onToday} className={GHOST_BTN}>{t.today}</button>}
      {onDone && <button type="button" onClick={onDone} className={GOLD_BTN}>{t.done}</button>}
    </div>
  )
}

/* ───────────── wheel ───────────── */

const ROW = 44
type WheelItem = { v: string; l: string }

function Wheel({ items, value, onChange, label, rows = 5 }: { items: WheelItem[]; value: string; onChange: (v: string) => void; label: string; rows?: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const timer = useRef<number | undefined>(undefined)
  const start = Math.max(0, items.findIndex(i => i.v === value))
  const [live, setLive] = useState(start)
  const pad2 = Math.floor(rows / 2)
  useEffect(() => { ref.current?.scrollTo({ top: start * ROW }); return () => window.clearTimeout(timer.current) }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const go = (i: number) => ref.current?.scrollTo({ top: Math.min(items.length - 1, Math.max(0, i)) * ROW, behavior: 'smooth' })
  const onScroll = () => {
    const i = Math.min(items.length - 1, Math.max(0, Math.round((ref.current?.scrollTop ?? 0) / ROW)))
    setLive(i)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => { const it = items[i]; if (it && it.v !== value) onChange(it.v) }, 80)
  }
  return (
    <div className="relative flex-1" style={{ height: ROW * rows }}>
      <div aria-hidden className="pointer-events-none absolute inset-x-1 rounded-xl bg-[#f6c744]/10 ring-1 ring-inset ring-[#f6c744]/45" style={{ top: ROW * pad2, height: ROW }} />
      <div ref={ref} role="listbox" aria-label={label} tabIndex={0} onScroll={onScroll}
        onKeyDown={e => { if (e.key === 'ArrowDown') { e.preventDefault(); go(live + 1) } else if (e.key === 'ArrowUp') { e.preventDefault(); go(live - 1) } }}
        className="h-full snap-y snap-mandatory overflow-y-auto outline-none [scrollbar-width:none] [&::-webkit-scrollbar]:hidden focus-visible:ring-2 focus-visible:ring-[#f6c744]/50 rounded-xl"
        style={{ overscrollBehavior: 'contain', WebkitMaskImage: 'linear-gradient(transparent, #000 28%, #000 72%, transparent)', maskImage: 'linear-gradient(transparent, #000 28%, #000 72%, transparent)' }}>
        <div style={{ height: ROW * pad2 }} />
        {items.map((it, i) => (
          <button key={it.v} type="button" role="option" aria-selected={i === live} tabIndex={-1} onClick={() => go(i)}
            className={`block w-full snap-center text-center font-black tabular-nums transition-all ${i === live ? 'text-2xl text-[var(--c-text)]' : 'text-lg text-[var(--c-textMid)]'}`} style={{ height: ROW }}>{it.l}</button>
        ))}
        <div style={{ height: ROW * pad2 }} />
      </div>
    </div>
  )
}

/* ───────────── number ───────────── */

type NumberProps = { id?: string; value: string; onChange: (v: string) => void; min: number; max: number; title: string; allowEmpty?: boolean; className?: string; disabled?: boolean }

export function NumberField({ id, value, onChange, min, max, title, allowEmpty, className, disabled }: NumberProps) {
  const [open, setOpen] = useState(false)
  const items = useMemo<WheelItem[]>(() => [
    ...(allowEmpty ? [{ v: '', l: '—' }] : []),
    ...Array.from({ length: max - min + 1 }, (_, i) => ({ v: String(min + i), l: String(min + i) })),
  ], [min, max, allowEmpty])
  const cur = value !== '' && Number(value) >= min && Number(value) <= max ? value : allowEmpty ? '' : String(min)
  return (
    <>
      <button id={id} type="button" disabled={disabled} aria-haspopup="dialog" onClick={() => setOpen(true)} className={`${TRIGGER} ${className || ''} disabled:opacity-50`}>
        <span className={`tabular-nums ${value === '' ? 'text-[var(--c-textMid)]' : ''}`}>{value === '' ? '—' : value}</span>
        <ChevronDown size={14} className="shrink-0 text-[var(--c-textMid)]" />
      </button>
      {open && (
        <Sheet title={title} onClose={() => setOpen(false)}>
          <div className="px-8 pt-2"><Wheel items={items} value={cur} onChange={onChange} label={title} /></div>
          <Footer onClear={allowEmpty && value !== '' ? () => { onChange(''); setOpen(false) } : undefined} onDone={() => setOpen(false)} />
        </Sheet>
      )}
    </>
  )
}

/* ───────────── list chooser ───────────── */

export type Option = { value: string; label: string }
type SelectProps = { id?: string; value: string; onChange: (v: string) => void; options: Option[]; title: string; placeholder?: string; className?: string; disabled?: boolean }

export function SelectField({ id, value, onChange, options, title, placeholder, className, disabled }: SelectProps) {
  const [open, setOpen] = useState(false)
  const cur = options.find(o => o.value === value)
  const sel = useRef<HTMLButtonElement>(null)
  useEffect(() => { if (open) sel.current?.scrollIntoView({ block: 'center' }) }, [open])
  return (
    <>
      <button id={id} type="button" disabled={disabled} aria-haspopup="dialog" onClick={() => setOpen(true)} className={`${TRIGGER} ${className || ''} disabled:opacity-50`}>
        <span className={`min-w-0 truncate ${cur ? '' : 'text-[var(--c-textMid)]'}`}>{cur?.label ?? placeholder ?? '—'}</span>
        <ChevronDown size={14} className="shrink-0 text-[var(--c-textMid)]" />
      </button>
      {open && (
        <Sheet title={title} onClose={() => setOpen(false)}>
          <ul role="listbox" aria-label={title} className="max-h-[56vh] space-y-1 overflow-y-auto px-3 py-2">
            {options.map(o => {
              const on = o.value === value
              return (
                <li key={o.value} role="presentation">
                  <button ref={on ? sel : undefined} type="button" role="option" aria-selected={on} onClick={() => { onChange(o.value); setOpen(false) }}
                    className={`flex w-full items-center justify-between gap-3 rounded-xl px-3.5 py-3 text-start text-sm font-bold transition-all ${on ? 'bg-[#E30613] text-white' : 'hover:bg-white/10'}`}>
                    <span className="min-w-0 truncate">{o.label}</span>
                    {on && <Check size={15} className="shrink-0" />}
                  </button>
                </li>
              )
            })}
          </ul>
          <div className="pb-4" />
        </Sheet>
      )}
    </>
  )
}

/* ───────────── calendar ───────────── */

type View = 'days' | 'months' | 'years'

function MonthGrid({ value, onPick, minYear, maxYear, startYear, minDate, maxDate }: {
  value: string; onPick: (iso: string) => void; minYear: number; maxYear: number; startYear?: number; minDate?: string; maxDate?: string
}) {
  const { tr, lang } = useTranslate()
  const t = tr.league
  const locale = lang === 'ar' ? 'ar-TN' : lang === 'fr' ? 'fr-TN' : 'en-GB'
  const sel = parse(value)
  const now = new Date()
  const todayIso = iso(now.getFullYear(), now.getMonth(), now.getDate())
  const [cursor, setCursor] = useState({ y: sel?.y ?? startYear ?? now.getFullYear(), m: sel?.m ?? (startYear ? 0 : now.getMonth()) })
  const [view, setView] = useState<View>('days')
  const yearRef = useRef<HTMLButtonElement>(null)
  useEffect(() => { if (view === 'years') yearRef.current?.scrollIntoView({ block: 'center' }) }, [view])

  const title = useMemo(() => new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(new Date(cursor.y, cursor.m, 1)), [locale, cursor])
  const weekdays = useMemo(() => { const f = new Intl.DateTimeFormat(locale, { weekday: 'narrow' }); return Array.from({ length: 7 }, (_, i) => f.format(new Date(2024, 0, 1 + i))) }, [locale])
  const months = useMemo(() => { const f = new Intl.DateTimeFormat(locale, { month: 'short' }); return Array.from({ length: 12 }, (_, i) => f.format(new Date(2024, i, 1))) }, [locale])
  const cells = useMemo(() => {
    const lead = (new Date(cursor.y, cursor.m, 1).getDay() + 6) % 7
    const n = new Date(cursor.y, cursor.m + 1, 0).getDate()
    return [...Array.from({ length: lead }, () => 0), ...Array.from({ length: n }, (_, i) => i + 1)]
  }, [cursor])
  const years = useMemo(() => Array.from({ length: Math.max(0, maxYear - minYear + 1) }, (_, i) => minYear + i), [minYear, maxYear])
  const shift = (n: number) => setCursor(c => { const d = new Date(c.y, c.m + n, 1); return d.getFullYear() < minYear || d.getFullYear() > maxYear ? c : { y: d.getFullYear(), m: d.getMonth() } })
  const chev = 'grid h-9 w-9 place-items-center rounded-lg text-[var(--c-textMid)] hover:bg-white/10 hover:text-[var(--c-text)] transition-all'

  return (
    <div className="px-4 pb-1 pt-2">
      <div className="mb-2 flex items-center justify-between">
        <button type="button" onClick={() => shift(-1)} aria-label={t.prevMonth} className={chev}><ChevronLeft size={16} className="rtl:rotate-180" /></button>
        <button type="button" onClick={() => setView(v => (v === 'days' ? 'years' : 'days'))} aria-expanded={view !== 'days'}
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-black capitalize hover:bg-white/10 transition-all">
          {view === 'days' ? title : cursor.y}<ChevronDown size={13} className={`text-[#f6c744] transition-transform ${view === 'days' ? '' : 'rotate-180'}`} />
        </button>
        <button type="button" onClick={() => shift(1)} aria-label={t.nextMonth} className={chev}><ChevronRight size={16} className="rtl:rotate-180" /></button>
      </div>

      {view === 'years' && (
        <div className="grid max-h-[272px] grid-cols-4 gap-1.5 overflow-y-auto py-1 [scrollbar-width:thin]">
          {years.map(y => (
            <button key={y} ref={y === cursor.y ? yearRef : undefined} type="button" onClick={() => { setCursor(c => ({ ...c, y })); setView('months') }}
              className={`rounded-xl py-2.5 text-sm font-black tabular-nums transition-all ${y === cursor.y ? 'bg-[#E30613] text-white' : y === now.getFullYear() ? 'ring-1 ring-inset ring-[#f6c744]/60 hover:bg-white/10' : 'hover:bg-white/10'}`}>{y}</button>
          ))}
        </div>
      )}
      {view === 'months' && (
        <div className="grid grid-cols-3 gap-1.5 py-1">
          {months.map((mm, i) => (
            <button key={i} type="button" onClick={() => { setCursor(c => ({ ...c, m: i })); setView('days') }}
              className={`rounded-xl py-4 text-sm font-black capitalize transition-all ${i === cursor.m ? 'bg-[#E30613] text-white' : 'hover:bg-white/10'}`}>{mm}</button>
          ))}
        </div>
      )}
      {view === 'days' && (
        <>
          <div className="mb-1 grid grid-cols-7 text-center">
            {weekdays.map((w, i) => <span key={i} className="py-1 text-[12px] font-black uppercase text-[var(--c-textMid)]">{w}</span>)}
          </div>
          <div className="grid grid-cols-7 gap-y-1">
            {cells.map((d, i) => {
              if (!d) return <span key={i} />
              const v = iso(cursor.y, cursor.m, d)
              const on = v === value.slice(0, 10)
              const off = (minDate && v < minDate) || (maxDate && v > maxDate)
              return (
                <button key={i} type="button" disabled={!!off} onClick={() => onPick(v)} aria-pressed={on} aria-current={v === todayIso ? 'date' : undefined}
                  className={`mx-auto grid h-10 w-10 place-items-center rounded-full text-sm font-bold tabular-nums transition-all disabled:opacity-25 ${on ? 'bg-[#E30613] text-white shadow-[0_4px_12px_rgba(227,6,19,.45)]' : v === todayIso ? 'ring-1 ring-inset ring-[#f6c744] hover:bg-white/10' : 'hover:bg-white/10'}`}>{d}</button>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

type DateProps = {
  id?: string; value: string; onChange: (v: string) => void; title?: string; className?: string; disabled?: boolean
  /** Year range offered in the year chooser; defaults to last year .. five years ahead. */
  minYear?: number; maxYear?: number
  /** Year to open on when empty (e.g. a typical birth year). */
  startYear?: number
  minDate?: string; maxDate?: string
}

const useFmt = (opts: Intl.DateTimeFormatOptions) => {
  const { lang } = useTranslate()
  return useMemo(() => new Intl.DateTimeFormat(lang === 'ar' ? 'ar-TN' : lang === 'fr' ? 'fr-TN' : 'en-GB', opts), [lang]) // eslint-disable-line react-hooks/exhaustive-deps
}

export function DateField({ id, value, onChange, title, className, disabled, minYear, maxYear, startYear, minDate, maxDate }: DateProps) {
  const { tr } = useTranslate()
  const t = tr.league
  const fmt = useFmt({ weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
  const [open, setOpen] = useState(false)
  const p = parse(value)
  const y0 = new Date().getFullYear()
  return (
    <>
      <button id={id} type="button" disabled={disabled} aria-haspopup="dialog" onClick={() => setOpen(true)} className={`${TRIGGER} ${className || ''} disabled:opacity-50`}>
        <span className={`min-w-0 truncate ${p ? '' : 'text-[var(--c-textMid)]'}`}>{p ? fmt.format(new Date(p.y, p.m, p.d)) : (title ?? t.pickDate)}</span>
        <CalendarDays size={14} className="shrink-0 text-[#f6c744]" />
      </button>
      {open && (
        <Sheet title={title ?? t.pickDate} onClose={() => setOpen(false)}>
          <MonthGrid value={value} minYear={minYear ?? y0 - 1} maxYear={maxYear ?? y0 + 5} startYear={startYear} minDate={minDate} maxDate={maxDate}
            onPick={v => { onChange(v); setOpen(false) }} />
          <Footer onClear={value ? () => { onChange(''); setOpen(false) } : undefined}
            onToday={!startYear ? () => { const n = new Date(); onChange(iso(n.getFullYear(), n.getMonth(), n.getDate())); setOpen(false) } : undefined} />
        </Sheet>
      )}
    </>
  )
}

/* ───────────── time ───────────── */

const hours = Array.from({ length: 24 }, (_, i) => ({ v: pad(i), l: pad(i) }))
const minutesFor = (cur: string, step: number): WheelItem[] => {
  const base = Array.from({ length: Math.ceil(60 / step) }, (_, i) => pad(i * step))
  const all = base.includes(cur) ? base : [...base, cur].sort()
  return all.map(v => ({ v, l: v }))
}

function TimeWheels({ hh, mm, onHour, onMinute, rows }: { hh: string; mm: string; onHour: (v: string) => void; onMinute: (v: string) => void; rows: number }) {
  const { tr } = useTranslate()
  const t = tr.league
  const mins = useMemo(() => minutesFor(mm, 5), []) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="flex items-center gap-2 px-8" dir="ltr">
      <Wheel items={hours} value={hh} onChange={onHour} label={t.hoursWord} rows={rows} />
      <span aria-hidden className="text-2xl font-black text-[#f6c744]">:</span>
      <Wheel items={mins} value={mm} onChange={onMinute} label={t.minutesWord} rows={rows} />
    </div>
  )
}

export function TimeField({ id, value, onChange, title, className, disabled }: { id?: string; value: string; onChange: (v: string) => void; title?: string; className?: string; disabled?: boolean }) {
  const { tr } = useTranslate()
  const t = tr.league
  const [open, setOpen] = useState(false)
  const ok = /^\d{2}:\d{2}$/.test(value)
  const [hh, mm] = ok ? value.split(':') : ['15', '00']
  return (
    <>
      <button id={id} type="button" disabled={disabled} aria-haspopup="dialog" onClick={() => setOpen(true)} className={`${TRIGGER} ${className || ''} disabled:opacity-50`}>
        <span className={`tabular-nums ${ok ? '' : 'text-[var(--c-textMid)]'}`} dir="ltr">{ok ? value : '--:--'}</span>
        <Clock size={14} className="shrink-0 text-[#f6c744]" />
      </button>
      {open && (
        <Sheet title={title ?? t.pickTime} onClose={() => setOpen(false)}>
          <div className="pt-2"><TimeWheels hh={hh} mm={mm} rows={5} onHour={v => onChange(`${v}:${mm}`)} onMinute={v => onChange(`${hh}:${v}`)} /></div>
          <Footer onDone={() => { if (!ok) onChange(`${hh}:${mm}`); setOpen(false) }} />
        </Sheet>
      )}
    </>
  )
}

/* ───────────── date + time ───────────── */

export function DateTimeField({ id, value, onChange, title, className, disabled, minYear, maxYear }: Omit<DateProps, 'startYear' | 'minDate' | 'maxDate'>) {
  const { tr } = useTranslate()
  const t = tr.league
  const fmt = useFmt({ weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
  const [open, setOpen] = useState(false)
  const [day, setDay] = useState('')
  const [hh, setHh] = useState('15')
  const [mm, setMm] = useState('00')
  const p = parse(value)
  const tm = /T(\d{2}):(\d{2})/.exec(value)
  const y0 = new Date().getFullYear()
  const openIt = () => { setDay(p ? value.slice(0, 10) : ''); setHh(tm ? tm[1] : '15'); setMm(tm ? tm[2] : '00'); setOpen(true) }
  const commit = () => { if (day) onChange(`${day}T${hh}:${mm}`); setOpen(false) }
  return (
    <>
      <button id={id} type="button" disabled={disabled} aria-haspopup="dialog" onClick={openIt} className={`${TRIGGER} ${className || ''} disabled:opacity-50`}>
        <span className={`min-w-0 truncate ${p ? '' : 'text-[var(--c-textMid)]'}`}>{p ? <>{fmt.format(new Date(p.y, p.m, p.d))}{tm && <span className="ms-2 tabular-nums text-[#f6c744]" dir="ltr">{tm[1]}:{tm[2]}</span>}</> : (title ?? t.pickDateTime)}</span>
        <CalendarDays size={14} className="shrink-0 text-[#f6c744]" />
      </button>
      {open && (
        <Sheet title={title ?? t.pickDateTime} onClose={() => setOpen(false)}>
          <MonthGrid value={day} minYear={minYear ?? y0 - 1} maxYear={maxYear ?? y0 + 5} onPick={setDay} />
          <p className="px-5 pt-2 text-[11px] font-black uppercase tracking-[.25em] text-[var(--c-textMid)]">{t.pickTime}</p>
          <TimeWheels hh={hh} mm={mm} rows={3} onHour={setHh} onMinute={setMm} />
          <Footer onClear={value ? () => { onChange(''); setOpen(false) } : undefined} onDone={commit} />
        </Sheet>
      )}
    </>
  )
}
