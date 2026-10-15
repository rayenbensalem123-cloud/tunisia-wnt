"use client"
import React, { useState, useEffect, useRef } from "react"
import { ChevronLeft, X, Plus, ArrowLeft, Calendar, CalendarDays, MapPin, Users, FileText, Image as ImageIcon, Trash2, Save, Pencil, Download, Check, Briefcase, CalendarRange, Clock, Activity } from "lucide-react"
import ThemeToggle from "@/components/theme-toggle"
import { useTheme } from "@/lib/theme-context"
import { useTranslate } from "@/lib/language-context"
import { DatePicker, Select } from "@/components/pickers"
import { useFileDrop, isPdfFile } from "@/lib/use-file-drop"
import { supabase } from "@/lib/supabase"
import { matchCallups } from "@/lib/callups"
import { StoredImg, openStored } from "@/components/stored-file"
import { useCS } from "@/lib/camp-strings"
import { TripPanel } from "@/components/travel"
import { eligibilityFor } from "@/lib/eligibility"
import { passportStatus } from "@/lib/documents"

type CampReport = { id: string; url: string; name: string; staffId: number | null; staffName: string; role: string; addedAt: string }

type Stage = {
  id?: number
  name: string
  location: string
  startDate: string
  endDate: string
  teamCategory: string
  program: { day: string; time: string; activity: string; details?: string; attendance?: number[] }[]
  players: number[]
  staff: number[]
  staffRoles: { memberId: number; role: string }[]
  reportUrl: string
  reportName: string
  reports?: CampReport[]
  images: string[]
  createdByUsername?: string
}

type Props = {
  open: boolean
  onClose: () => void
  stages: Stage[]
  members: any[]
  teamCat: string | null
  canManage: boolean
  onSave: (stage: Stage) => Promise<boolean> | boolean
  onDelete?: (id: number) => Promise<boolean> | boolean
  onRefresh?: () => void
  user?: { username?: string } | null
  /** travel & documents: who may manage them, and the passport expiries the viewer may see */
  travel?: { canManage: boolean; expiries?: Record<number, string> }
}

const emptyStage = (cat: string | null): Stage => ({
  name: "", location: "", startDate: "", endDate: "", teamCategory: cat || "SENIORS",
  program: [], players: [], staff: [], staffRoles: [], reportUrl: "", reportName: "", images: [],
})

type TabKey = "program" | "players" | "staff" | "report" | "photos"

const CATS: { value: string; label: string }[] = [
  { value: "SENIORS", label: "Seniors" },
  { value: "U20", label: "U-20" },
  { value: "U17", label: "U-17" },
]

const MONTHS = ["JAN", "FÉV", "MAR", "AVR", "MAI", "JUIN", "JUIL", "AOÛT", "SEPT", "OCT", "NOV", "DÉC"]

const fmtDate = (iso: string) => {
  if (!iso) return "—"
  const [y, m, d] = iso.split("-")
  return `${d}/${m}/${y}`
}

const durDays = (s: Stage): number | null => {
  if (!s.startDate || !s.endDate) return null
  const a = new Date(s.startDate + "T00:00:00")
  const b = new Date(s.endDate + "T00:00:00")
  const d = Math.round((b.getTime() - a.getTime()) / 86400000)
  return d >= 0 ? d + 1 : null
}

const stageStatus = (s: Stage, tr: any): { key: "done" | "live" | "upcoming"; label: string } => {
  const today = new Date().toISOString().slice(0, 10)
  if (s.endDate && s.endDate < today) return { key: "done", label: tr.stages.doneStatus }
  if (s.startDate && s.startDate > today) return { key: "upcoming", label: tr.stages.upcomingStatus }
  return { key: "live", label: tr.stages.liveStatus }
}

let toastTimer: any = null
function useToast() {
  const [msg, setMsg] = useState<string | null>(null)
  const show = (m: string) => {
    setMsg(m)
    clearTimeout(toastTimer)
    toastTimer = setTimeout(() => setMsg(null), 3000)
  }
  return { msg, show }
}

export function StagesManager({ open, onClose, stages, members, teamCat, canManage, onSave, onDelete, onRefresh, user, travel }: Props) {
  const { tr } = useTranslate()
  const cs = useCS()
  const [view, setView] = useState<"list" | "edit" | "detail">("list")
  const [editing, setEditing] = useState<Stage | null>(null)
  const [tab, setTab] = useState<TabKey>("program")
  const [draft, setDraft] = useState<Stage>(emptyStage(teamCat))
  const [busy, setBusy] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Stage | null>(null)
  const [filtCat, setFiltCat] = useState<string>("ALL")
  const { msg, show } = useToast()

  const [q, setQ] = useState("")
  const [year, setYear] = useState<string>("ALL")
  const sorted = [...stages].sort((a, b) => (b.startDate || "").localeCompare(a.startDate || ""))
  const years = Array.from(new Set(sorted.map(x => (x.startDate || "").slice(0, 4)).filter(Boolean)))
  const filtered = sorted
    .filter(x => filtCat === "ALL" || x.teamCategory === filtCat)
    .filter(x => year === "ALL" || (x.startDate || "").startsWith(year))
    .filter(x => !q.trim() || `${x.name} ${x.location}`.toLowerCase().includes(q.trim().toLowerCase()))
  const todayStr = new Date().toISOString().slice(0, 10)
  const dayDiff = (a: string, b: string) => Math.round((new Date(b + "T00:00:00").getTime() - new Date(a + "T00:00:00").getTime()) / 86400000)
  const featured = filtered.find(x => stageStatus(x, tr).key === "live")
    || [...filtered].filter(x => x.startDate > todayStr).sort((a, b) => a.startDate.localeCompare(b.startDate))[0]
    || filtered[0]
  const tlYear = year !== "ALL" ? Number(year) : new Date().getFullYear()
  const yStart = new Date(tlYear, 0, 1).getTime()
  const yDays = (new Date(tlYear + 1, 0, 1).getTime() - yStart) / 86400000
  const statusLine = (x: Stage): string => {
    const st = stageStatus(x, tr).key
    if (st === "live") return cs("dayOf", { a: Math.max(1, dayDiff(x.startDate, todayStr) + 1), b: durDays(x) ?? "?" })
    if (st === "upcoming") { const n = dayDiff(todayStr, x.startDate); return n <= 1 ? cs("startsTomorrow") : cs("startsIn", { n }) }
    return cs("finished")
  }
  const reportsOf = (x: Stage) => (x.reports || []).length + (x.reportUrl ? 1 : 0)

  const startCreate = () => {
    const base = emptyStage(teamCat)
    const now = new Date()
    const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
    base.startDate = fmt(now)
    base.endDate = fmt(new Date(now.getTime() + 7 * 86400000))
    setDraft(base); setTab("program"); setView("edit"); setEditing(null)
  }

  const startEdit = (s: Stage) => {
    setDraft(JSON.parse(JSON.stringify(s))); setTab("program"); setView("edit"); setEditing(s)
  }

  const openDetail = (s: Stage) => {
    setEditing(s); setTab("program"); setView("detail")
  }

  const canSubmit = draft.name.trim().length > 0
  const catName = (c?: string) => CATS.find(x => x.value === c)?.label || c || "Seniors"
  const memberById = (id: number) => members.find(m => m.id === id)

  const save = async () => {
    if (!canSubmit || busy) return
    setBusy(true)
    const ok = await onSave(draft)
    setBusy(false)
    if (ok) {
      show(tr.stages.savedToast)
      onRefresh?.()
      setView("list")
    }
  }

  const upload = async (file: File, folder: string): Promise<string | null> => {
    const fd = new FormData()
    fd.append('file', file, file.name)
    fd.append('folder', folder)
    try {
      const { data: sess } = await supabase.auth.getSession()
      const token = sess?.session?.access_token
      const r = await fetch('/api/upload', { method: 'POST', body: fd, headers: token ? { Authorization: `Bearer ${token}` } : {}, signal: AbortSignal.timeout(60000) })
      const d = await r.json()
      return d.url || null
    } catch { return null }
  }

  const handleReportFile = async (f: File) => {
    if (!isPdfFile(f)) { show(tr.stages.uploadError); return }
    setBusy(true)
    const url = await upload(f, 'camps-reports')
    setBusy(false)
    if (url) setDraft(d => ({ ...d, reportUrl: url, reportName: f.name }))
    else show(tr.stages.uploadError)
  }
  const onReportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    e.target.value = ""
    if (f) handleReportFile(f)
  }
  const reportDrop = useFileDrop(files => handleReportFile(files[0]), isPdfFile)

  // Several staff members each file their own report: one entry per PDF, attributed to a staff member.
  const staffOf = (s: Stage) => (s.staff || []).map(id => {
    const m: any = members.find(x => x.id === id)
    return { id, name: m?.name || `#${id}`, role: (s.staffRoles || []).find(r => r.memberId === id)?.role || m?.position || '' }
  })
  const makeReport = async (f: File, byId: string, s: Stage): Promise<CampReport | null> => {
    if (!isPdfFile(f)) { show(cs("pdfOnly")); return null }
    setBusy(true)
    const url = await upload(f, 'camps-reports')
    setBusy(false)
    if (!url) { show(tr.stages.uploadError); return null }
    const who = staffOf(s).find(x => String(x.id) === byId)
    return { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5), url, name: f.name, staffId: who ? who.id : null, staffName: who?.name || '', role: who?.role || '', addedAt: new Date().toISOString().slice(0, 10) }
  }
  const current: Stage | null = editing ? (stages.find(x => x.id === editing.id) || editing) : null
  const detailAddReport = async (f: File, byId: string) => {
    if (!current) return
    const r = await makeReport(f, byId, current)
    if (!r) return
    const ok = await onSave({ ...current, reports: [...(current.reports || []), r] })
    if (ok) { show(cs("reportAdded")); onRefresh?.() }
  }
  const detailRemoveReport = async (id: string) => {
    if (!current) return
    const next = id === 'legacy' ? { ...current, reportUrl: '', reportName: '' } : { ...current, reports: (current.reports || []).filter(r => r.id !== id) }
    const ok = await onSave(next)
    if (ok) onRefresh?.()
  }
  const detailSaveProgram = async (program: Stage["program"]) => {
    if (!current) return
    const ok = await onSave({ ...current, program })
    if (ok) onRefresh?.()
  }
  const formAddReport = async (f: File, byId: string) => {
    const r = await makeReport(f, byId, draft)
    if (r) setDraft(d => ({ ...d, reports: [...(d.reports || []), r] }))
  }
  const formRemoveReport = (id: string) => setDraft(d => id === 'legacy' ? { ...d, reportUrl: '', reportName: '' } : { ...d, reports: (d.reports || []).filter(r => r.id !== id) })

  const [progress, setProgress] = useState('')
  // Shrink big phone photos (often 5-10 MB) so they pass the 5 MB limit and upload fast.
  const shrink = async (f: File): Promise<File> => {
    if (!/^image\/(jpeg|png|webp)$/.test(f.type)) return f
    try {
      const bmp = await createImageBitmap(f)
      const scale = Math.min(1, 2000 / Math.max(bmp.width, bmp.height))
      if (scale === 1 && f.size < 1.5 * 1024 * 1024) return f
      const c = document.createElement('canvas')
      c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale)
      c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height)
      const blob: Blob | null = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.85))
      return blob ? new File([blob], f.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' }) : f
    } catch { return f }
  }
  const handlePhotoFiles = async (files: File[]) => {
    if (!files.length) return
    setBusy(true)
    const urls: (string | null)[] = new Array(files.length).fill(null)
    let next = 0, done = 0
    const worker = async () => {
      while (next < files.length) {
        const i = next++
        const small = await shrink(files[i])
        urls[i] = await upload(small, 'camps-photos')
        setProgress(`${++done}/${files.length}`)
      }
    }
    await Promise.all([worker(), worker(), worker()])
    setBusy(false); setProgress('')
    const ok = urls.filter((u): u is string => !!u)
    if (ok.length) setDraft(d => ({ ...d, images: [...(d.images || []), ...ok] }))
    if (ok.length < files.length) show(cs("photosFailed", { n: files.length - ok.length }))
  }
  const onPhotos = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    e.target.value = ""
    handlePhotoFiles(files)
  }
  const photosDrop = useFileDrop(handlePhotoFiles, f => f.type.startsWith('image/'))

  const allCandidates = members.filter(m => m.name && m.role)
  const availablePlayers = allCandidates.filter(m => (m.role || '').toUpperCase() === 'PLAYERS')
  const availableStaff = allCandidates.filter(m => (m.role || '').toUpperCase() !== 'PLAYERS')

  if (!open) return null

  return (
    <div className="min-h-screen flex flex-col">
      {/* ═══ TOP BAR ═══ */}
      <div className="sticky top-0 z-[100] border-b border-[rgba(var(--line-rgb),.12)] bg-[var(--c-bg)]">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={onClose} title={tr.stages.backToDashboard} className="p-2 rounded-xl border border-[rgba(var(--line-rgb),.2)] text-[var(--c-textDim)] hover:text-[var(--c-text)] hover:bg-[var(--c-panel3)]/60 transition-all shrink-0">
              <ChevronLeft size={17}/>
            </button>
            <img src="/ftf-logo.png" className="h-9" alt="FTF"/>
            <div className="leading-tight min-w-0">
              <h1 className="text-sm font-black italic uppercase tracking-wider text-[var(--c-text)] truncate">{tr.stages.title}</h1>
              <p className="text-[8px] font-black text-[#E30613] uppercase tracking-[0.3em]">{tr.stages.subtitle}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl border border-[rgba(var(--line-rgb),.16)] bg-[var(--c-panel3)]/80">
              <div className="w-5 h-5 rounded-full bg-[#E30613] text-white flex items-center justify-center text-[8px] font-black uppercase">{(user?.username || "?")[0]}</div>
              <span className="text-[8px] font-black uppercase tracking-wider text-[var(--c-textMid)]">{user?.username || "—"}</span>
            </div>
            <ThemeToggle className="p-2"/>
          </div>
        </div>
      </div>

      {/* Toast */}
      {msg && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[500] flex items-center gap-2 px-5 py-3 rounded-2xl bg-emerald-500 text-white text-[10px] font-black uppercase tracking-wider shadow-2xl animate-[fadeUp_0.3s_ease-out_both]">
          <Check size={14}/>{msg}
        </div>
      )}

      <div className="max-w-7xl mx-auto px-6 pb-20 w-full">

        {view === "list" && (
          <>

            {/* ─── FEATURED CAMP ─── */}
            {featured ? (() => {
              const st = stageStatus(featured, tr).key
              const dur = durDays(featured) ?? 0
              const pct = st === "live" && dur ? Math.min(100, Math.round(100 * (dayDiff(featured.startDate, todayStr) + 1) / dur)) : st === "done" ? 100 : 0
              const cover = (featured.images || [])[0]
              return (
                <div className="relative overflow-hidden rounded-[28px] mt-6 px-7 sm:px-10 py-9 bg-gradient-to-br from-[#142c52] via-[#0b1322] to-[#8a0f1c] text-white">
                  {cover && (<><StoredImg url={cover} alt="" className="absolute inset-0 w-full h-full object-cover opacity-30"/><div className="absolute inset-0 bg-gradient-to-r from-[#0b1322] via-[#0b1322]/60 to-transparent"/></>)}
                  <div className="relative flex flex-col lg:flex-row lg:items-end justify-between gap-6">
                    <div className="min-w-0">
                      <span className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest ${st === "live" ? "bg-[#E30613]" : st === "upcoming" ? "bg-[#7ec3ff] text-[#0b1322]" : "bg-white/20"}`}>
                        {st === "live" && <span className="w-1.5 h-1.5 rounded-full bg-white"/>}
                        {st === "live" ? cs("liveNow") + " · " : st === "upcoming" ? cs("nextCamp") + " · " : cs("lastCamp") + " · "}{statusLine(featured)}
                      </span>
                      <h2 className="mt-4 text-4xl sm:text-5xl font-black italic uppercase tracking-tighter leading-[0.98]">{featured.name}</h2>
                      <p className="mt-3 text-[12px] font-bold text-white/70">{catName(featured.teamCategory)} · {featured.location || tr.stages.venueDash} · {fmtDate(featured.startDate)} → {fmtDate(featured.endDate)}</p>
                      <div className="mt-5 flex gap-2.5 flex-wrap">
                        <button onClick={() => featured.id && openDetail(featured)} className="px-6 py-3 rounded-xl bg-[#f6c744] text-[#0b1322] text-[10px] font-black uppercase tracking-wider hover:brightness-110 transition-all">{cs("openCamp")}</button>
                      </div>
                    </div>
                    <div className="w-full lg:w-72 shrink-0 rounded-2xl bg-[#0b1322]/60 border border-white/10 p-5">
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div><p className="text-2xl font-black italic text-[#f6c744] leading-none">{(featured.players || []).length}</p><p className="mt-1 text-[7px] font-black uppercase tracking-widest text-white/60">{tr.stages.playersLabel}</p></div>
                        <div><p className="text-2xl font-black italic text-[#f6c744] leading-none">{(featured.staff || []).length}</p><p className="mt-1 text-[7px] font-black uppercase tracking-widest text-white/60">{tr.common.staff}</p></div>
                        <div><p className="text-2xl font-black italic text-[#f6c744] leading-none">{reportsOf(featured)}</p><p className="mt-1 text-[7px] font-black uppercase tracking-widest text-white/60">{cs("reports")}</p></div>
                      </div>
                      <div className="mt-4 h-1.5 rounded-full bg-white/15"><div className="h-full rounded-full bg-[#f6c744]" style={{ width: pct + "%" }}/></div>
                    </div>
                  </div>
                </div>
              )
            })() : (
              <div className="relative overflow-hidden rounded-[28px] mt-6 px-7 sm:px-10 py-10 sm:py-12 bg-gradient-to-br from-[#142c52] via-[#0b1322] to-[#8a0f1c] text-white">
                <div className="absolute -right-4 -top-8 text-[110px] sm:text-[150px] font-black italic uppercase tracking-tighter text-white/[0.05] select-none pointer-events-none">{tr.stages.heroTitle1}</div>
                <div className="relative">
                  <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#f6c744]/15 border border-[#f6c744]/40 text-[#f6c744] text-[8px] font-black uppercase tracking-[0.25em]"><CalendarRange size={12}/> {tr.stages.portalBadge}</span>
                  <h2 className="mt-5 text-4xl sm:text-5xl font-black italic uppercase tracking-tighter leading-[0.95]">{tr.stages.heroTitle1} <span className="text-[#f6c744]">{tr.stages.heroTitle2}</span></h2>
                </div>
              </div>
            )}

            {/* ─── FILTER + CREATE ─── */}
            <div className="mt-8 flex flex-col lg:flex-row lg:items-center gap-4 justify-between">
              <div className="flex p-1 rounded-2xl bg-[var(--c-panel3)] border border-[rgba(var(--line-rgb),.14)] self-start">
                <button onClick={() => setFiltCat("ALL")} className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${filtCat === "ALL" ? 'bg-[#E30613] text-white shadow-md shadow-[#E30613]/25' : 'text-[var(--c-textMid)] hover:text-[var(--c-text)]'}`}>{tr.stages.all}</button>
                {CATS.map(c => (
                  <button key={c.value} onClick={() => setFiltCat(c.value)} className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${filtCat === c.value ? 'bg-[#E30613] text-white shadow-md shadow-[#E30613]/25' : 'text-[var(--c-textMid)] hover:text-[var(--c-text)]'}`}>{c.label}</button>
                ))}
              </div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <input value={q} onChange={e => setQ(e.target.value)} placeholder={cs("search")} className="w-56 sm:w-64 px-3.5 py-2.5 rounded-xl bg-[var(--c-panel3)] border border-[rgba(var(--line-rgb),.22)] text-[var(--c-text)] placeholder-[var(--c-textFaint)] text-[10px] font-bold outline-none focus:border-[#E30613]/50 transition-all"/>
                <select value={year} onChange={e => setYear(e.target.value)} className="px-3 py-2.5 rounded-xl bg-[var(--c-panel3)] border border-[rgba(var(--line-rgb),.22)] text-[var(--c-text)] text-[10px] font-bold outline-none">
                  <option value="ALL">{cs("allYears")}</option>
                  {years.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
                <p className="text-[9px] font-black uppercase tracking-widest text-[var(--c-textDim)]">{filtered.length} {filtered.length > 1 ? tr.stages.campWordPlural : tr.stages.campWord}</p>
              </div>
            </div>

            {/* ─── SEASON TIMELINE ─── */}
            {filtered.length > 0 && (
              <div className="mt-5 rounded-2xl bg-[var(--c-panel2)]/55 border border-[rgba(var(--line-rgb),.14)] px-5 py-4">
                <p className="text-[8px] font-black uppercase tracking-widest text-[var(--c-textDim)] mb-3">{cs("season")} {tlYear}</p>
                <div className="relative h-7">
                  <div className="absolute left-0 right-0 top-3 h-1.5 rounded-full bg-[rgba(var(--line-rgb),.14)]"/>
                  {filtered.filter(x => x.startDate && (x.startDate.startsWith(String(tlYear)) || (x.endDate || "").startsWith(String(tlYear)))).map(x => {
                    const l = Math.max(0, (new Date(x.startDate + "T00:00:00").getTime() - yStart) / 86400000 / yDays * 100)
                    const w = Math.max(1.4, (durDays(x) ?? 1) / yDays * 100)
                    const st = stageStatus(x, tr).key
                    return <button key={x.id ?? x.name} title={x.name} onClick={() => x.id && openDetail(x)} className={`absolute top-1.5 h-4 rounded-full hover:scale-y-125 transition-transform ${st === "live" ? "bg-[#E30613]" : st === "upcoming" ? "bg-[#7ec3ff]" : "bg-[#5a6b8c]"}`} style={{ left: l + "%", width: Math.min(w, 100 - l) + "%" }}/>
                  })}
                </div>
                <div className="mt-1 flex justify-between text-[8px] font-bold text-[var(--c-textDim)]">{["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"].map((m, i) => <span key={i}>{m}</span>)}</div>
              </div>
            )}

            {/* ─── CREATE CTA ─── */}
            {canManage && (
              <button onClick={startCreate} className="group mt-5 w-full flex items-center justify-center gap-3 py-5 px-6 rounded-2xl bg-gradient-to-r from-[#b30510] via-[#E30613] to-[#ff2b3a] text-white text-[11px] font-black uppercase tracking-widest shadow-xl shadow-[#E30613]/30 hover:shadow-[#E30613]/55 hover:scale-[1.004] active:scale-[0.99] transition-all">
                <span className="w-8 h-8 rounded-full bg-[#f6c744] text-[#7a4b00] flex items-center justify-center shadow-md shadow-black/25 group-hover:rotate-90 transition-transform duration-300">
                  <Plus size={16} strokeWidth={3}/>
                </span>
                <span className="leading-none">{tr.stages.createNew}</span>
              </button>
            )}

            {/* ─── EMPTY STATE ─── */}
            {filtered.length === 0 && (
              <div className="mt-8 flex flex-col items-center justify-center py-20 gap-5 rounded-3xl border-2 border-dashed border-[rgba(var(--line-rgb),.18)] text-center">
                <div className="w-16 h-16 rounded-2xl bg-[var(--c-panel2)] border border-[rgba(var(--line-rgb),.16)] flex items-center justify-center">
                  <CalendarRange size={26} className="text-[var(--acc-gold)]"/>
                </div>
                <div>
                  <p className="text-[13px] font-black uppercase tracking-widest text-[var(--c-text)]">{tr.stages.emptyTitle}</p>
                  <p className="text-[9px] font-bold uppercase tracking-wider text-[var(--c-textMid)] mt-1.5">{tr.stages.emptySubtitle}</p>
                </div>
                {canManage && (
                  <button onClick={startCreate} className="mt-1 px-6 py-3 rounded-full bg-[#E30613] text-white text-[10px] font-black uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-[#E30613]/25 hover:bg-red-700 transition-all">
                    <Plus size={15}/> {tr.stages.createFirst}
                  </button>
                )}
              </div>
            )}

            {/* ─── CARDS GRID ─── */}
            <div className="mt-8 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {filtered.map((s, idx) => {
                const hasPlayers = (s.players?.length || 0) > 0
                const hasReport = !!s.reportUrl || (s.reports?.length || 0) > 0
                const hasPhotos = (s.images?.length || 0) > 0
                const hasProgram = (s.program?.length || 0) > 0
                const hasStaff = (s.staff?.length || 0) > 0
                const dur = durDays(s)
                const d = s.startDate ? new Date(s.startDate + "T00:00:00") : null
                return (
                  <div key={s.id ?? s.name} className="group rounded-3xl border border-[rgba(var(--line-rgb),.16)] bg-[var(--c-panel2)]/55 hover:bg-[var(--c-panel2)] hover:border-[#f6c744]/35 hover:-translate-y-1.5 transition-all duration-300 overflow-hidden shadow-none hover:shadow-2xl hover:shadow-black/10">
                    <div className="relative h-32 bg-gradient-to-br from-[#1b3a6b] via-[#0e2347] to-[#3a0d16] overflow-hidden">
                      {(s.images || [])[0] && <StoredImg url={s.images[0]} alt="" className="absolute inset-0 w-full h-full object-cover object-top opacity-80"/>}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent"/>
                      {(() => { const stt = stageStatus(s, tr).key; return (
                        <span className={`absolute top-3 left-3 px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-wider ${stt === "live" ? "bg-[#E30613] text-white" : stt === "upcoming" ? "bg-[#7ec3ff] text-[#0b1322]" : "bg-black/50 text-white"}`}>{statusLine(s)}</span>
                      ) })()}
                    </div>
                    <div className="p-6">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <span className="inline-block px-2.5 py-1 rounded-md bg-[#E30613]/12 border border-[#E30613]/30 text-[var(--acc-red)] text-[7px] font-black uppercase tracking-widest">{catName(s.teamCategory)}</span>
                          <h3 className="mt-3 text-[15px] font-black uppercase tracking-tight text-[var(--c-text)] truncate">{s.name}</h3>
                          <p className="mt-1.5 flex items-center gap-1.5 text-[9px] font-bold text-[var(--c-textDim)]">
                            <MapPin size={11}/>{s.location || tr.stages.venueDash}
                          </p>
                        </div>
                        {d && (
                          <div className="shrink-0 text-center rounded-2xl bg-[#E30613]/10 border border-[#E30613]/25 px-3.5 py-2.5 min-w-[62px]">
                            <p className="text-[22px] font-black italic leading-none text-[#E30613]">{String(d.getDate()).padStart(2, "0")}</p>
                            <p className="mt-1 text-[7px] font-black text-[var(--c-textMid)] uppercase tracking-widest">{MONTHS[d.getMonth()]}</p>
                            <p className="text-[7px] font-bold text-[var(--c-textMid)]">{d.getFullYear()}</p>
                          </div>
                        )}
                      </div>

                      <div className="mt-4 flex items-center gap-3 text-[9px] font-bold text-[var(--c-textDim)] flex-wrap">
                        <span className="flex items-center gap-1.5"><Calendar size={11}/>{s.startDate ? fmtDate(s.startDate) : "—"} {s.endDate ? `→ ${fmtDate(s.endDate)}` : ""}</span>
                        {dur !== null && <span className="px-2 py-0.5 rounded-md bg-[var(--c-panel3)] border border-[rgba(var(--line-rgb),.16)]">{dur} {tr.stages.daysAbbrev}</span>}
                      </div>

                      <div className="mt-4 flex gap-1.5 flex-wrap">
                        {hasProgram && <span className="px-2 py-0.5 rounded-md bg-[var(--c-panel3)] border border-[rgba(var(--line-rgb),.18)] text-[var(--c-textMid)] text-[7px] font-black uppercase tracking-wider">{tr.stages.program}</span>}
                        {hasPlayers && <span className="px-2 py-0.5 rounded-md bg-[var(--c-panel3)] border border-[rgba(var(--line-rgb),.18)] text-[var(--c-textMid)] text-[7px] font-black uppercase tracking-wider">{s.players.length} {tr.stages.playersWord}</span>}
                        {hasStaff && <span className="px-2 py-0.5 rounded-md bg-[var(--c-panel3)] border border-[rgba(var(--line-rgb),.18)] text-[var(--c-textMid)] text-[7px] font-black uppercase tracking-wider">{tr.common.staff}</span>}
                        {hasReport
                          ? <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 text-[7px] font-black uppercase tracking-wider">{(s.staff || []).length ? cs("reportsOf", { a: reportsOf(s), b: (s.staff || []).length }) : cs("reportsN", { a: reportsOf(s) })}</span>
                          : stageStatus(s, tr).key === "done" && <span className="px-2 py-0.5 rounded-md bg-[#E30613]/12 border border-[#E30613]/30 text-[var(--acc-red)] text-[7px] font-black uppercase tracking-wider">{cs("noReport")}</span>}
                        {hasPhotos && <span className="px-2 py-0.5 rounded-md bg-[#7ec3ff]/10 border border-[#7ec3ff]/30 text-[var(--acc-blue)] text-[7px] font-black uppercase tracking-wider">{s.images.length} {tr.stages.photosWord}</span>}
                      </div>

                      <div className="mt-6 flex items-center gap-2">
                        <button onClick={() => s.id && openDetail(s)} className="flex-1 px-4 py-2.5 rounded-xl bg-[#E30613] text-white text-[9px] font-black uppercase tracking-wider hover:bg-red-700 transition-all shadow-md shadow-[#E30613]/20">
                          {tr.stages.openFile}
                        </button>
                        {canManage && (
                          <button onClick={(e) => { e.stopPropagation(); startEdit(s) }} title={tr.common.edit} className="p-2.5 rounded-xl border border-[rgba(var(--line-rgb),.2)] text-[var(--c-textDim)] hover:text-[var(--acc-gold)] hover:border-[#f6c744]/40 transition-all"><Pencil size={15}/></button>
                        )}
                        {canManage && (
                          <button onClick={(e) => { e.stopPropagation(); setDeleteTarget(s) }} title={tr.common.delete} className="p-2.5 rounded-xl border border-[rgba(var(--line-rgb),.2)] text-[var(--c-textDim)] hover:bg-[#E30613] hover:text-white transition-all"><Trash2 size={15}/></button>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}

        {view === "detail" && editing && (
          <StageDetail travel={travel} stage={current || editing} members={members} canManage={canManage} tr={tr} staff={staffOf(current || editing)} busy={busy} onAddReport={detailAddReport} onRemoveReport={detailRemoveReport} onSaveProgram={detailSaveProgram}
            onBack={() => setView("list")}
            onEdit={() => { setDraft(JSON.parse(JSON.stringify(editing))); setTab("program"); setView("edit") }}
            onDelete={() => setDeleteTarget(editing)} />
        )}

        {view === "edit" && (
          <>
            {/* ─── EDIT HEADER ─── */}
            <div className="mt-6 flex items-end justify-between gap-4 flex-wrap">
              <div>
                <p className="text-[8px] font-black uppercase tracking-[0.25em] text-[var(--c-textDim)]">{tr.stages.title} / {editing ? tr.stages.edit : tr.stages.new}</p>
                <h2 className="mt-1 text-2xl font-black italic uppercase tracking-tight text-[var(--c-text)]">{editing ? tr.stages.editTitle : tr.stages.newTitle}</h2>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setView("list")} className="px-5 py-2.5 rounded-xl border border-[rgba(var(--line-rgb),.2)] text-[var(--c-textDim)] hover:text-[var(--c-text)] hover:bg-[var(--c-panel3)]/40 text-[9px] font-black uppercase tracking-wider transition-all">{tr.common.cancel}</button>
                <button onClick={save} disabled={!canSubmit || busy} className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#E30613] text-white text-[9px] font-black uppercase tracking-wider hover:bg-red-700 transition-all disabled:opacity-40 shadow-lg shadow-[#E30613]/25">
                  <Save size={14}/> {busy ? tr.stages.saving : editing ? tr.common.save : tr.stages.createCamp}
                </button>
              </div>
            </div>

            {/* ─── BASIC INFO ─── */}
            <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-[8px] font-black uppercase tracking-widest text-[var(--c-textDim)] mb-1.5">{tr.stages.nameLabel}</label>
                <input
                  value={draft.name}
                  onChange={e => setDraft({ ...draft, name: e.target.value })}
                  placeholder={tr.stages.namePlaceholder}
                  className="w-full px-4 py-3 rounded-xl bg-[var(--c-panel3)] border border-[rgba(var(--line-rgb),.22)] text-[var(--c-text)] placeholder-[var(--c-textFaint)] text-[11px] font-bold outline-none focus:border-[#E30613]/50 transition-all"/>
              </div>
              <div>
                <label className="block text-[8px] font-black uppercase tracking-widest text-[var(--c-textDim)] mb-1.5">{tr.stages.locationLabel}</label>
                <input
                  value={draft.location}
                  onChange={e => setDraft({ ...draft, location: e.target.value })}
                  placeholder={tr.stages.locationPlaceholder}
                  className="w-full px-4 py-3 rounded-xl bg-[var(--c-panel3)] border border-[rgba(var(--line-rgb),.22)] text-[var(--c-text)] placeholder-[var(--c-textFaint)] text-[11px] font-bold outline-none focus:border-[#E30613]/50 transition-all"/>
              </div>
              <div>
                <label className="block text-[8px] font-black uppercase tracking-widest text-[var(--c-textDim)] mb-1.5">{tr.stages.categoryLabel}</label>
                <Select variant="stage" allowEmpty={false} value={draft.teamCategory} onChange={v => setDraft({ ...draft, teamCategory: v })}
                  options={CATS.map(c => ({ value: c.value, label: c.label }))}/>
              </div>
              <div>
                <label className="block text-[8px] font-black uppercase tracking-widest text-[var(--c-textDim)] mb-1.5">{tr.stages.startLabel}</label>
                <DatePicker variant="stage" value={draft.startDate} onChange={v => setDraft({ ...draft, startDate: v })} placeholder={tr.stages.startLabel}/>
              </div>
              <div>
                <label className="block text-[8px] font-black uppercase tracking-widest text-[var(--c-textDim)] mb-1.5">{tr.stages.endLabel}</label>
                <DatePicker variant="stage" value={draft.endDate} onChange={v => setDraft({ ...draft, endDate: v })} placeholder={tr.stages.endLabel}/>
              </div>
            </div>

            {/* ─── TABS ─── */}
            <div className="mt-6 flex gap-1.5 flex-wrap">
              {([["program",tr.stages.programTab],["players",tr.stages.callupsTab],["staff",tr.common.staff],["report",tr.stages.reportPdfTab],["photos",tr.stages.photosTab]] as [TabKey,string][]).map(([k,label]) => (
                <button key={k} onClick={() => setTab(k)} className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all ${tab===k?'bg-[#E30613] text-white shadow-md shadow-[#E30613]/25':'bg-[var(--c-panel3)] text-[var(--c-textMid)] border border-[rgba(var(--line-rgb),.16)] hover:text-[var(--c-text)]'}`}>{label}</button>
              ))}
            </div>

            {/* ─── TAB CONTENT ─── */}
            <div className="mt-5">
              {tab === "program" && (
                <ProgramTab draft={draft} setDraft={setDraft} tr={tr} members={members}/>
              )}

              {tab === "players" && (
                <PlayersTab travel={travel} all={allCandidates} draft={draft} setDraft={setDraft} members={availablePlayers.length ? availablePlayers : allCandidates.filter(m => (m.role||'').toUpperCase()==='PLAYERS')} tr={tr}/>
              )}

              {tab === "staff" && (
                <StaffTab all={allCandidates} draft={draft} setDraft={setDraft} members={availableStaff.length ? availableStaff : allCandidates.filter(m => (m.role||'').toUpperCase()!=='PLAYERS')} tr={tr}/>
              )}

              {tab === "report" && (
                <ReportsPanel reports={draft.reports || []} legacy={draft.reportUrl ? { url: draft.reportUrl, name: draft.reportName } : null} staff={staffOf(draft)} canManage edit busy={busy} onAdd={formAddReport} onRemove={formRemoveReport}/>
              )}

              {tab === "photos" && (
                <div>
                  <p className="text-[8px] font-black uppercase tracking-widest text-[var(--c-textDim)] mb-3">{tr.stages.photosSectionTitle}</p>
                  <label {...photosDrop.dropProps} className={`flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-7 cursor-pointer transition-all mb-4 ${photosDrop.isDragging ? 'border-[#f6c744] bg-[#f6c744]/10 scale-[1.01]' : 'border-[rgba(var(--line-rgb),.25)] bg-[var(--c-panel3)]/60 hover:border-[#f6c744]/50'}`}>
                    <input type="file" accept="image/*" multiple className="hidden" onChange={onPhotos}/>
                    <ImageIcon size={26} className="text-[var(--c-textDim)]"/>
                    <span className="text-[10px] font-black uppercase tracking-widest text-[var(--c-text)]">{busy ? `${tr.stages.uploading} ${progress}` : tr.stages.addPhotos}</span>
                    <span className="text-[8px] text-[var(--c-textDim)]">{tr.stages.dropHintPhotos}</span>
                  </label>
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2.5">
                    {(draft.images || []).map((img, i) => (
                      <div key={img + i} className="group relative rounded-xl overflow-hidden border border-[rgba(var(--line-rgb),.16)]">
                        <StoredImg url={img} alt={`photo ${i+1}`} className="w-full aspect-[4/3] object-contain bg-black/30"/>
                        <button onClick={() => setDraft(d => ({ ...d, images: (d.images || []).filter((_, j) => j !== i) }))} className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/70 text-white opacity-0 group-hover:opacity-100 hover:bg-[#E30613] transition-all" title={tr.common.remove}>
                          <Trash2 size={12}/>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* ─── DELETE CONFIRM ─── */}
      {deleteTarget && (
        <div className="fixed inset-0 z-[450] flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-[var(--c-surface)] border border-[rgba(var(--line-rgb),.18)] shadow-2xl p-6">
            <h3 className="text-sm font-black uppercase tracking-tight text-[var(--c-text)] mb-2">{tr.stages.deleteConfirmTitle}</h3>
            <p className="text-[10px] font-bold text-[var(--c-textDim)] mb-5">{tr.stages.deleteConfirmBody.replace('{name}', deleteTarget.name)}</p>
            <div className="flex gap-2">
              <button onClick={() => setDeleteTarget(null)} className="flex-1 py-2.5 rounded-xl border border-[rgba(var(--line-rgb),.2)] text-[var(--c-textDim)] text-[9px] font-black uppercase tracking-wider transition-all">{tr.common.cancel}</button>
              <button onClick={async () => {
                if (deleteTarget.id && onDelete) await onDelete(deleteTarget.id)
                onRefresh?.()
                setDeleteTarget(null)
                setView("list")
              }} className="flex-1 py-2.5 rounded-xl bg-[#E30613] text-white text-[9px] font-black uppercase tracking-wider hover:bg-red-700 transition-all">{tr.common.delete}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function StageDetail({ stage, members, canManage, onBack, onEdit, onDelete, tr, staff: staffOpts, busy, onAddReport, onRemoveReport, onSaveProgram, travel }: {
  travel?: Props["travel"]
  stage: Stage
  members: any[]
  canManage: boolean
  staff: { id: number; name: string; role: string }[]
  busy: boolean
  onAddReport: (f: File, byId: string) => Promise<void>
  onRemoveReport: (id: string) => Promise<void>
  onSaveProgram: (program: Stage["program"]) => Promise<void>
  onBack: () => void
  onEdit: () => void
  onDelete?: () => void
  tr: any
}) {
  const cs = useCS()
  const [viewer, setViewer] = useState<number | null>(null)
  const memberById = (id: number) => members.find(m => m.id === id)
  const dur = durDays(stage)
  const status = stageStatus(stage, tr)
  const d = stage.startDate ? new Date(stage.startDate + "T00:00:00") : null
  const sessions = (stage.program || []).length
  const photos = (stage.images || []).length
  const players = stage.players || []
  const staff = stage.staff || []

  const { theme } = useTheme()
  const light = theme === "light"

  const statusStyles = {
    done: light ? "bg-[#fff0f2] text-[#c2253c] border-[#ff5f72]/45" : "bg-[#E30613]/20 text-[#ffd0d7] border-[#ff5f72]/40",
    live: light ? "bg-[#fff7dd] text-[#8a6100] border-[#f6c744]/60" : "bg-[#f6c744]/20 text-[#f6c744] border-[#f6c744]/45",
    upcoming: light ? "bg-[#eaf4ff] text-[#1e66a8] border-[#7ec3ff]/55" : "bg-[#7ec3ff]/15 text-[#7ec3ff] border-[#7ec3ff]/40",
  } as const

  const statusDot = {
    done: "bg-[#ff5f72]",
    live: light ? "bg-[#b98a04]" : "bg-[#f6c744]",
    upcoming: "bg-[#7ec3ff]",
  } as const

  const groupedDays: { label: string; items: NonNullable<Stage["program"]> }[] = []
  for (const p of stage.program || []) {
    const label = (p.day || tr.stages.dayWord).trim().toUpperCase()
    const last = groupedDays[groupedDays.length - 1]
    if (last && last.label === label) last.items.push(p)
    else groupedDays.push({ label, items: [p] })
  }

  const reportCount = (stage.reports || []).length + (stage.reportUrl ? 1 : 0)
  const cover = (stage.images || [])[0]
  const takenSessionsCount = (stage.program || []).filter(p => (p.attendance || []).length > 0).length
  const sections: [string, string, number][] = [
    ["program", tr.stages.programTab, sessions],
    ["attendance", cs("attendance"), takenSessionsCount],
    ["players", tr.stages.playersLabel, players.length],
    ["staff", tr.common.staff, staff.length],
    ["report", tr.stages.report, reportCount],
    ["photos", tr.stages.photosTab, photos],
    ...((travel && stage.id != null) ? [["travel", tr.travel.tripTitle, 0] as [string, string, number]] : []),
  ]
  const [active, setActive] = useState("program")
  const jump = (k: string) => { setActive(k); document.getElementById("sec-" + k)?.scrollIntoView({ behavior: "smooth", block: "start" }) }

  // Attendance: a local copy of the programme so ticks feel instant, saved a moment after the last tap.
  const [prog, setProg] = useState<Stage["program"]>(stage.program || [])
  const dirty = useRef(false)
  const saveTimer = useRef<any>(null)
  const progKey = JSON.stringify(stage.program || [])
  useEffect(() => { if (!dirty.current) setProg(JSON.parse(progKey)) }, [progKey])
  const toggleAtt = (si: number, memberId: number) => {
    if (!canManage) return
    dirty.current = true
    setProg(cur => {
      const next = (cur || []).map((p, j) => {
        if (j !== si) return p
        const a = p.attendance || []
        return { ...p, attendance: a.includes(memberId) ? a.filter(x => x !== memberId) : [...a, memberId] }
      })
      clearTimeout(saveTimer.current)
      saveTimer.current = setTimeout(async () => { await onSaveProgram(next); dirty.current = false }, 900)
      return next
    })
  }
  const takenSessions = (prog || []).filter(p => (p.attendance || []).length > 0)
  const attRate = (players.length && takenSessions.length)
    ? Math.round(100 * takenSessions.reduce((n, p) => n + (p.attendance || []).filter(id => players.includes(id)).length, 0) / (takenSessions.length * players.length))
    : null
  const staffWithReport = new Set((stage.reports || []).map(r => r.staffId).filter(x => x != null))
  const waitingStaff = staffOpts.filter(x => !staffWithReport.has(x.id))

  return (
    <>
      {/* ─── COVER HERO ─── */}
      <div className="relative overflow-hidden rounded-[28px] mt-6 bg-gradient-to-br from-[#1b3a6b] via-[#0b1730] to-[#5a0f1a] text-white">
        {cover && (<StoredImg url={cover} alt="" className="absolute inset-0 w-full h-full object-cover object-center opacity-40"/>)}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0b1322] via-[#0b1322]/45 to-transparent"/>
        <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-gradient-to-r from-[#E30613] via-[#f6c744] to-[#E30613]"/>
        <div className="relative px-6 sm:px-10 pt-6 pb-8 min-h-[320px] flex flex-col justify-between gap-10">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <button onClick={onBack} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#0b1322]/70 border border-white/15 text-white/90 text-[9px] font-black uppercase tracking-wider hover:bg-[#0b1322] transition-all">
              <ArrowLeft size={13}/> {tr.stages.allCamps}
            </button>
            <div className="flex gap-2">
              <button onClick={() => window.print()} className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#0b1322]/70 border border-white/15 text-white/90 text-[9px] font-black uppercase tracking-wider hover:bg-[#0b1322] transition-all"><Download size={13}/> {cs("print")}</button>
              {canManage && (
                <>
                  <button onClick={onEdit} className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#E30613] text-white text-[9px] font-black uppercase tracking-wider hover:bg-red-700 transition-all"><Pencil size={13}/> {tr.common.edit}</button>
                  <button onClick={onDelete} className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#0b1322]/70 border border-[#ff4f66]/40 text-[#ff8a94] text-[9px] font-black uppercase tracking-wider hover:bg-[#E30613]/30 transition-all"><Trash2 size={13}/> {tr.common.delete}</button>
                </>
              )}
            </div>
          </div>
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-3 py-1 rounded-full bg-[#E30613] text-[8px] font-black uppercase tracking-widest">{CATS.find(c => c.value === stage.teamCategory)?.label || stage.teamCategory}</span>
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest ${status.key === "live" ? "bg-[#f6c744] text-[#0b1322]" : status.key === "upcoming" ? "bg-[#7ec3ff] text-[#0b1322]" : "bg-white/20"}`}>{status.label}{status.key === "live" && dur ? ` · ${cs("dayOf", { a: Math.max(1, Math.round((Date.now() - new Date(stage.startDate + "T00:00:00").getTime()) / 86400000) + 1), b: dur })}` : ""}</span>
              </div>
              <h2 className="mt-3 text-4xl sm:text-6xl font-black italic uppercase tracking-tighter leading-[0.98]">{stage.name}</h2>
              <p className="mt-3 flex items-center gap-4 flex-wrap text-[11px] font-bold text-white/75">
                <span className="flex items-center gap-1.5"><MapPin size={12}/>{stage.location || tr.stages.venueDash}</span>
                <span className="flex items-center gap-1.5"><Calendar size={12}/>{fmtDate(stage.startDate)} → {fmtDate(stage.endDate)}</span>
                {dur !== null && <span className="flex items-center gap-1.5"><Clock size={12}/>{dur} {tr.stages.daysWord}</span>}
              </p>
            </div>
            <div className="grid grid-cols-4 gap-2.5 shrink-0">
              {[
                { label: tr.stages.playersLabel, value: String(players.length) },
                { label: tr.common.staff, value: String(staff.length) },
                { label: cs("attendance"), value: attRate === null ? "—" : attRate + "%" },
                { label: cs("reportsInShort"), value: staff.length ? `${staff.length - waitingStaff.length}/${staff.length}` : String(reportCount) },
              ].map(x => (
                <div key={x.label} className="rounded-2xl bg-[#0b1322]/70 border border-white/10 px-4 py-3 text-center min-w-[74px]">
                  <p className="text-2xl sm:text-3xl font-black italic leading-none text-[#f6c744]">{x.value}</p>
                  <p className="mt-1.5 text-[7px] font-black uppercase tracking-widest text-white/60">{x.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ─── JUMP NAV ─── */}
      <div className="sticky top-16 z-[90] mt-4 flex gap-1 overflow-x-auto px-2 bg-[var(--c-bg)]/95 backdrop-blur border-b border-[rgba(var(--line-rgb),.14)]">
        {sections.map(([k, label, n]) => (
          <button key={k} onClick={() => jump(k)}
            className={`shrink-0 flex items-center gap-2 px-4 py-3.5 text-[10px] font-black uppercase tracking-wider border-b-[3px] transition-all ${active === k ? 'border-[#f6c744] text-[var(--acc-gold)]' : 'border-transparent text-[var(--c-textMid)] hover:text-[var(--c-text)]'}`}>
            {label}
            <span className="px-1.5 py-0.5 rounded-md bg-[var(--c-panel2)] text-[7px] font-black text-[var(--c-textDim)]">{n}</span>
          </button>
        ))}
      </div>

      <div className="mt-8 space-y-14">
        {/* ── PROGRAMME ── */}
        <section id="sec-program" className="scroll-mt-32">
          <h3 className="mb-5 flex items-center gap-3 text-[18px] font-black italic uppercase tracking-tight text-[var(--c-text)]">{tr.stages.programTab}<span className="flex-1 h-px bg-[rgba(var(--line-rgb),.14)]"/></h3>
          {(stage.program || []).length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 text-center rounded-2xl border border-dashed border-[rgba(var(--line-rgb),.2)]">
              <Calendar size={30} className="text-[var(--c-textDim)] opacity-50 mb-3"/>
              <p className="text-[10px] font-black uppercase tracking-widest text-[var(--c-textDim)]">{tr.stages.noProgramSaved}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
              {groupedDays.map((g, gi) => {
                const dayDate = stage.startDate ? new Date(new Date(stage.startDate + "T00:00:00").getTime() + gi * 86400000).toISOString().slice(0, 10) : ""
                const isToday = dayDate === new Date().toISOString().slice(0, 10)
                const marks = g.items.map(it => (it.attendance || []).length).filter(n => n > 0)
                return (
                  <div key={gi} className={`rounded-2xl p-4 ${isToday ? "bg-[#E30613] text-white" : "bg-[var(--c-panel3)]/55 border border-[rgba(var(--line-rgb),.14)]"}`}>
                    <p className={`text-[9px] font-black uppercase tracking-widest ${isToday ? "text-white" : "text-[var(--acc-gold)]"}`}>{g.label}{isToday ? " · " + tr.stages.liveStatus : ""}</p>
                    <div className="mt-3 space-y-2.5">
                      {g.items.map((it, ii) => (
                        <div key={ii}>
                          <p className={`text-[11px] font-black uppercase leading-tight ${isToday ? "text-white" : "text-[var(--c-text)]"}`}>{it.time && <span className={`mr-1.5 ${isToday ? "text-white/80" : "text-[var(--acc-red)]"}`}>{it.time}</span>}{it.activity || tr.stages.sessionWord}</p>
                          {it.details && <p className={`mt-0.5 text-[9px] font-bold leading-snug ${isToday ? "text-white/80" : "text-[var(--c-textDim)]"}`}>{it.details}</p>}
                        </div>
                      ))}
                    </div>
                    {marks.length > 0 && <p className={`mt-3 text-[8px] font-black uppercase tracking-wider ${isToday ? "text-white" : "text-emerald-500"}`}>{Math.max(...marks)} {tr.stages.presentCount}</p>}
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {/* ── ATTENDANCE ── */}
        <section id="sec-attendance" className="scroll-mt-32">
          <h3 className="mb-5 flex items-center gap-3 text-[18px] font-black italic uppercase tracking-tight text-[var(--c-text)]">{cs("attendance")}<span className="flex-1 h-px bg-[rgba(var(--line-rgb),.14)]"/>{canManage && <span className="text-[8px] font-bold normal-case tracking-normal not-italic text-[var(--c-textDim)]">{cs("tapDot")}</span>}</h3>
          {(prog || []).length === 0 || players.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center rounded-2xl border border-dashed border-[rgba(var(--line-rgb),.2)]">
              <Users size={28} className="text-[var(--c-textDim)] opacity-50 mb-3"/>
              <p className="text-[10px] font-black uppercase tracking-widest text-[var(--c-textDim)]">{cs("addSessions")}</p>
            </div>
          ) : (
            <div className="rounded-2xl border border-[rgba(var(--line-rgb),.14)] bg-[var(--c-panel2)]/40 overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[rgba(var(--line-rgb),.14)]">
                    <th className="sticky left-0 z-10 bg-[var(--c-panel2)] px-4 py-3 text-[8px] font-black uppercase tracking-widest text-[var(--c-textDim)] min-w-[190px]">{cs("player")}</th>
                    {(prog || []).map((p, si) => (
                      <th key={si} className="px-2 py-3 text-center text-[8px] font-black uppercase tracking-wider text-[var(--c-textDim)] min-w-[64px]">
                        <div>{p.day || "—"}</div><div className="font-bold normal-case tracking-normal opacity-70">{p.time || ""}</div>
                      </th>
                    ))}
                    <th className="px-3 py-3 text-center text-[8px] font-black uppercase tracking-widest text-[var(--c-textDim)] min-w-[64px]">{cs("rate")}</th>
                  </tr>
                </thead>
                <tbody>
                  {players.map(id => {
                    const m: any = memberById(id)
                    const got = takenSessions.filter(p => (p.attendance || []).includes(id)).length
                    const rate = takenSessions.length ? Math.round(100 * got / takenSessions.length) : null
                    return (
                      <tr key={id} className="border-b border-[rgba(var(--line-rgb),.07)] last:border-0">
                        <td className="sticky left-0 z-10 bg-[var(--c-panel2)] px-4 py-2 text-[10px] font-black uppercase text-[var(--c-text)] whitespace-nowrap">{m?.name || `#${id}`}</td>
                        {(prog || []).map((p, si) => {
                          const on = (p.attendance || []).includes(id)
                          const taken = (p.attendance || []).length > 0
                          return (
                            <td key={si} className="px-2 py-2 text-center">
                              <button disabled={!canManage} onClick={() => toggleAtt(si, id)} aria-label={`${m?.name || id} ${on ? "present" : "absent"}`}
                                className={`w-[18px] h-[18px] rounded-full align-middle transition-all ${on ? "bg-emerald-500" : taken ? "bg-[#E30613]" : "border-2 border-[rgba(var(--line-rgb),.35)]"} ${canManage ? "hover:scale-125 cursor-pointer" : "cursor-default"}`}/>
                            </td>
                          )
                        })}
                        <td className={`px-3 py-2 text-center text-[10px] font-black ${rate === null ? "text-[var(--c-textDim)]" : rate >= 85 ? "text-emerald-500" : rate >= 60 ? "text-[var(--acc-gold)]" : "text-[var(--acc-red)]"}`}>{rate === null ? "—" : rate + "%"}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* ── JOUEURS ── */}
        <section id="sec-players" className="scroll-mt-32">
          <h3 className="mb-5 flex items-center gap-3 text-[18px] font-black italic uppercase tracking-tight text-[var(--c-text)]">{tr.stages.playersLabel}<span className="flex-1 h-px bg-[rgba(var(--line-rgb),.14)]"/></h3>
          <div>
            {(stage.players || []).length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-center rounded-2xl border border-dashed border-[rgba(var(--line-rgb),.2)]">
                <Users size={30} className="text-[var(--c-textDim)] opacity-50 mb-3"/>
                <p className="text-[10px] font-black uppercase tracking-widest text-[var(--c-textDim)]">{tr.stages.noPlayers}</p>
              </div>
            )}
            {(stage.players || []).length > 0 && (
              <div className="space-y-7">
                {[["GOALKEEPER", "Goalkeepers"], ["DEFENDER", "Defenders"], ["MIDFIELDER", "Midfielders"], ["FORWARD", "Forwards"], ["", "Other"]].map(([pos, label]) => {
                  const grp = (stage.players || []).map(id => memberById(id) as any).filter(m => m && ((m.position || "").toUpperCase() === pos || (!pos && !["GOALKEEPER", "DEFENDER", "MIDFIELDER", "FORWARD"].includes((m.position || "").toUpperCase()))))
                  if (!grp.length) return null
                  return (
                    <div key={pos || "other"}>
                      <p className="mb-3 text-[9px] font-black uppercase tracking-widest text-[var(--c-textDim)]">{label} · {grp.length}</p>
                      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
                        {grp.map((m: any) => (
                          <div key={m.id} className="group">
                            <div className="relative aspect-[3/4] rounded-xl overflow-hidden border border-[rgba(var(--line-rgb),.16)] bg-gradient-to-br from-[#f6c744]/15 to-[#E30613]/20">
                              {m.imagePath ? (
                                <StoredImg url={`/api/image?path=${encodeURIComponent(m.imagePath)}`} alt={m.name} className="absolute inset-0 w-full h-full object-cover object-top"/>
                              ) : (
                                <div className="absolute inset-0 flex items-center justify-center text-[26px] font-black text-[var(--acc-gold)] uppercase">{(m.name || "?")[0]}</div>
                              )}
                              {m.jerseyNumber ? <span className="absolute top-1.5 left-1.5 min-w-[22px] h-[22px] px-1 rounded-md bg-[#E30613] text-white text-[10px] font-black italic flex items-center justify-center">{m.jerseyNumber}</span> : null}
                            </div>
                            <p className="mt-1.5 text-[10px] font-black uppercase text-[var(--c-text)] leading-tight">{m.name}</p>
                            {m.club && <p className="text-[8px] font-bold text-[var(--c-textDim)] uppercase truncate">{m.club}</p>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </section>

        {/* ── STAFF ── */}
        <section id="sec-staff" className="scroll-mt-32">
          <h3 className="mb-5 flex items-center gap-3 text-[18px] font-black italic uppercase tracking-tight text-[var(--c-text)]">{tr.common.staff}<span className="flex-1 h-px bg-[rgba(var(--line-rgb),.14)]"/></h3>
          <div>
            {(stage.staff || []).length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-center rounded-2xl border border-dashed border-[rgba(var(--line-rgb),.2)]">
                <Briefcase size={30} className="text-[var(--c-textDim)] opacity-50 mb-3"/>
                <p className="text-[10px] font-black uppercase tracking-widest text-[var(--c-textDim)]">{tr.stages.noStaffSaved}</p>
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {(stage.staff || []).map((id, idx) => {
                const m: any = memberById(id)
                const role = (stage.staffRoles || []).find(r => r.memberId === id)?.role
                return (
                  <div key={`${id}-${idx}`} className="flex items-center gap-3.5 rounded-2xl border border-[rgba(var(--line-rgb),.14)] bg-[var(--c-panel3)]/50 p-4 hover:border-[#7ec3ff]/35 transition-all">
                    <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#7ec3ff]/20 to-[#E30613]/20 border border-[#7ec3ff]/25 flex items-center justify-center text-[15px] font-black text-[var(--acc-blue)] uppercase shrink-0">{(m?.name || "?")[0]}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-black uppercase text-[var(--c-text)] truncate">{m?.name || `#${id}`}</p>
                      <p className="text-[8px] font-bold text-[var(--c-textDim)] uppercase tracking-wider">{m?.role === "PLAYERS" ? tr.common.staff : (m?.role || "—")}</p>
                      {role && <span className="inline-block mt-1.5 px-2 py-0.5 rounded-md bg-[#7ec3ff]/12 border border-[#7ec3ff]/35 text-[var(--acc-blue)] text-[7px] font-black uppercase tracking-widest">{role}</span>}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </section>

        {/* ── RAPPORT ── */}
        <section id="sec-report" className="scroll-mt-32">
          <h3 className="mb-5 flex items-center gap-3 text-[18px] font-black italic uppercase tracking-tight text-[var(--c-text)]">{cs("reports")}<span className="flex-1 h-px bg-[rgba(var(--line-rgb),.14)]"/></h3>
          <ReportsPanel reports={stage.reports || []} legacy={stage.reportUrl ? { url: stage.reportUrl, name: stage.reportName } : null} staff={staffOpts} waiting={waitingStaff} canManage={canManage} busy={busy} onAdd={onAddReport} onRemove={onRemoveReport}/>
        </section>

        {/* ── TRAVEL ── */}
        {travel && stage.id != null && (
          <section id="sec-travel" className="scroll-mt-32">
            <h3 className="mb-5 flex items-center gap-3 text-[18px] font-black italic uppercase tracking-tight text-[var(--c-text)]">{tr.travel.tripTitle}<span className="flex-1 h-px bg-[rgba(var(--line-rgb),.14)]"/></h3>
            <TripPanel type="camp" eventId={stage.id} startIso={stage.startDate} endIso={stage.endDate}
              people={[...players, ...staff].map(id => memberById(id)).filter(Boolean).map((m: any) => ({ id: m.id, name: m.name }))}
              canManage={travel.canManage} expiries={travel.expiries} />
          </section>
        )}

        {/* ── PHOTOS ── */}
        <section id="sec-photos" className="scroll-mt-32">
          <h3 className="mb-5 flex items-center gap-3 text-[18px] font-black italic uppercase tracking-tight text-[var(--c-text)]">{tr.stages.photosTab}<span className="flex-1 h-px bg-[rgba(var(--line-rgb),.14)]"/></h3>
          <div>
            {(stage.images || []).length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-center rounded-2xl border border-dashed border-[rgba(var(--line-rgb),.2)]">
                <ImageIcon size={30} className="text-[var(--c-textDim)] opacity-50 mb-3"/>
                <p className="text-[10px] font-black uppercase tracking-widest text-[var(--c-textDim)]">{tr.stages.noPhotosSaved}</p>
              </div>
            )}
            {(stage.images || []).length > 0 && (
              <>
              <div className="max-w-5xl mx-auto">
                <div className="flex items-end justify-between mb-4 pb-3 border-b border-[rgba(var(--line-rgb),.14)]">
                  <div>
                    <p className="text-[8px] font-black uppercase tracking-widest text-[var(--acc-gold)]">{tr.stages.photosSectionTitle}</p>
                    <p className="mt-1 text-[15px] font-black uppercase tracking-wide text-[var(--c-text)]">{stage.name}</p>
                  </div>
                  <span className="text-[10px] font-black text-[var(--c-textDim)]">{(stage.images || []).length} {tr.stages.photosWord}</span>
                </div>
                <div className="columns-2 sm:columns-3 lg:columns-4 gap-3">
                  {(stage.images || []).map((img, i) => (
                    <button key={img + i} onClick={() => setViewer(i)} className="group block w-full mb-3 break-inside-avoid rounded-xl overflow-hidden border border-[rgba(var(--line-rgb),.14)] bg-[var(--c-panel3)] hover:border-[#f6c744]/50 transition-all">
                      <StoredImg url={img} alt={`photo ${i+1}`} className="w-full h-auto block"/>
                    </button>
                  ))}
                </div>
              </div>
              {viewer !== null && (stage.images || [])[viewer] && (
                <div className="fixed inset-0 z-[500] bg-black/90 flex items-center justify-center p-4" onClick={() => setViewer(null)}>
                  <button onClick={() => setViewer(null)} className="absolute top-4 right-4 p-2.5 rounded-xl bg-white/10 text-white hover:bg-[#E30613] transition-all"><X size={18}/></button>
                  {(stage.images || []).length > 1 && <button onClick={e => { e.stopPropagation(); setViewer((viewer - 1 + stage.images.length) % stage.images.length) }} className="absolute left-3 sm:left-6 p-3 rounded-xl bg-white/10 text-white hover:bg-white/20"><ChevronLeft size={20}/></button>}
                  <StoredImg url={stage.images[viewer]} alt={`photo ${viewer+1}`} className="max-h-[78vh] max-w-[92vw] object-contain rounded-lg" onClick={(e: React.MouseEvent) => e.stopPropagation()}/>
                  {(stage.images || []).length > 1 && <button onClick={e => { e.stopPropagation(); setViewer((viewer + 1) % stage.images.length) }} className="absolute right-3 sm:right-6 p-3 rounded-xl bg-white/10 text-white hover:bg-white/20"><ChevronLeft size={20} className="rotate-180"/></button>}
                  <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 max-w-[92vw] overflow-x-auto p-1.5 rounded-xl bg-black/50" onClick={e => e.stopPropagation()}>
                    {stage.images.map((im: string, k: number) => (
                      <button key={im + k} onClick={() => setViewer(k)} className={`shrink-0 w-12 h-12 rounded-lg overflow-hidden border-2 ${k === viewer ? 'border-[#f6c744]' : 'border-transparent opacity-60 hover:opacity-100'}`}>
                        <StoredImg url={im} alt="" className="w-full h-full object-cover"/>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              </>
            )}
          </div>
        </section>
      </div>
    </>
  )
}

// ── Reports: one PDF per staff member ──
function ReportsPanel({ reports, legacy, staff, waiting, canManage, edit, busy, onAdd, onRemove }: {
  reports: CampReport[]
  legacy: { url: string; name: string } | null
  staff: { id: number; name: string; role: string }[]
  waiting?: { id: number; name: string; role: string }[]
  canManage: boolean
  edit?: boolean
  busy: boolean
  onAdd: (f: File, byId: string) => Promise<void> | void
  onRemove: (id: string) => Promise<void> | void
}) {
  const cs = useCS()
  const [by, setBy] = useState("")
  const drop = useFileDrop(files => { if (files[0]) onAdd(files[0], by) }, isPdfFile)
  const items: { id: string; url: string; name: string; staffName: string; role: string; addedAt: string }[] = [
    ...(legacy ? [{ id: "legacy", url: legacy.url, name: legacy.name || cs("campReport"), staffName: "", role: "", addedAt: "" }] : []),
    ...reports,
  ]
  return (
    <div className="space-y-5">
      {items.length === 0 && !(waiting && waiting.length) && (
        <div className="flex flex-col items-center justify-center py-12 text-center rounded-2xl border border-dashed border-[rgba(var(--line-rgb),.2)]">
          <FileText size={30} className="text-[var(--c-textDim)] opacity-50 mb-3"/>
          <p className="text-[10px] font-black uppercase tracking-widest text-[var(--c-textDim)]">{cs("noReportYet")}</p>
        </div>
      )}
      <div className="flex flex-col gap-2">
        {items.map(r => (
          <div key={r.id} className="flex items-center gap-3 rounded-xl border border-emerald-500/25 bg-emerald-500/5 px-3.5 py-2.5">
            <div className="w-8 h-10 rounded-md bg-[#E30613] text-white text-[10px] font-black flex items-center justify-center shrink-0">PDF</div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-black uppercase text-[var(--c-text)] truncate">{r.staffName || cs("campReport")}</p>
              <p className="text-[8px] font-bold text-[var(--c-textDim)] uppercase tracking-wider truncate">{[r.role, r.addedAt].filter(Boolean).join(" · ") || r.name}</p>
              <p className="text-[9px] text-[var(--c-textDim)] truncate">{r.name}</p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button onClick={() => openStored(r.url)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/35 text-emerald-500 text-[8px] font-black uppercase tracking-wider hover:bg-emerald-500/25 transition-all"><Download size={11}/> {cs("open")}</button>
              {canManage && edit && <button onClick={() => onRemove(r.id)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[rgba(var(--line-rgb),.2)] text-[var(--acc-red)] text-[8px] font-black uppercase tracking-wider hover:bg-[#E30613]/10 transition-all"><Trash2 size={11}/> {cs("remove")}</button>}
            </div>
          </div>
        ))}
        {(waiting || []).map(w => (
          <label key={"w" + w.id} className={`flex items-center gap-3 rounded-xl border border-dashed border-[rgba(var(--line-rgb),.28)] px-3.5 py-2.5 ${canManage && edit ? "cursor-pointer hover:border-[#E30613]/50" : ""}`}>
            {canManage && edit && <input type="file" accept=".pdf,application/pdf" className="hidden" onChange={e => { const f = e.target.files?.[0]; e.target.value = ""; if (f) onAdd(f, String(w.id)) }}/>}
            <div className="w-8 h-10 rounded-md border border-dashed border-[rgba(var(--line-rgb),.35)] shrink-0"/>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-black uppercase text-[var(--c-text)] truncate">{w.name}</p>
              <p className="text-[8px] font-bold uppercase tracking-wider text-[var(--acc-red)]">{w.role ? w.role + " · " : ""}{cs("waiting")}</p>
            </div>
            {canManage && edit && <span className="shrink-0 text-[8px] font-black uppercase tracking-wider text-[var(--acc-gold)]">{cs("upload")}</span>}
          </label>
        ))}
      </div>
      {canManage && edit && (
        <div className="rounded-2xl border border-[rgba(var(--line-rgb),.16)] bg-[var(--c-panel3)]/40 p-4 space-y-3">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-[8px] font-black uppercase tracking-widest text-[var(--c-textDim)]">{cs("reportBy")}</span>
            <select value={by} onChange={e => setBy(e.target.value)} className="px-3 py-2 rounded-lg bg-[var(--c-panel3)] border border-[rgba(var(--line-rgb),.22)] text-[var(--c-text)] text-[10px] font-bold outline-none">
              <option value="">{cs("campReportNoName")}</option>
              {staff.map(x => <option key={x.id} value={String(x.id)}>{x.name}{x.role ? ` · ${x.role}` : ""}</option>)}
            </select>
          </div>
          <label {...drop.dropProps} className={`flex items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-6 cursor-pointer transition-all ${drop.isDragging ? 'border-[#E30613] bg-[#E30613]/10' : 'border-[rgba(var(--line-rgb),.25)] hover:border-[#E30613]/50'}`}>
            <input type="file" accept=".pdf,application/pdf" className="hidden" onChange={e => { const f = e.target.files?.[0]; e.target.value = ""; if (f) onAdd(f, by) }}/>
            <FileText size={18} className="text-[var(--c-textDim)]"/>
            <span className="text-[10px] font-black uppercase tracking-widest text-[var(--c-text)]">{busy ? cs("uploading") : cs("dropPdf")}</span>
          </label>
          {staff.length === 0 && <p className="text-[9px] font-bold text-[var(--c-textDim)]">{cs("tipStaff")}</p>}
        </div>
      )}
    </div>
  )
}

// ── Programme editor ──
function ProgramTab({ draft, setDraft, tr, members }: { draft: Stage; setDraft: React.Dispatch<React.SetStateAction<Stage>>; tr: any; members: any[] }) {
  const items = draft.program || []
  const [openAttendance, setOpenAttendance] = useState<number | null>(null)
  const add = () => setDraft(d => ({ ...d, program: [...(d.program || []), { day: "", time: "", activity: "", details: "", attendance: [] }] }))
  const upd = (i: number, k: string, v: string) => setDraft(d => ({ ...d, program: (d.program || []).map((p, j) => j === i ? { ...p, [k]: v } : p) }))
  const del = (i: number) => setDraft(d => ({ ...d, program: (d.program || []).filter((_, j) => j !== i) }))
  const toggleAttendee = (i: number, memberId: number) => setDraft(d => ({
    ...d,
    program: (d.program || []).map((p, j) => {
      if (j !== i) return p
      const cur = p.attendance || []
      return { ...p, attendance: cur.includes(memberId) ? cur.filter(x => x !== memberId) : [...cur, memberId] }
    })
  }))
  const calledUp = (draft.players || []).map(id => members.find(m => m.id === id)).filter(Boolean)
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-[8px] font-black uppercase tracking-widest text-[var(--c-textDim)]">{tr.stages.trainingProgramTitle}</p>
        <button onClick={add} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--c-panel3)] border border-[#f6c744]/30 text-[var(--acc-gold)] text-[8px] font-black uppercase tracking-wider hover:border-[#f6c744]/60 transition-all"><Plus size={11}/> {tr.stages.addWord}</button>
      </div>
      {items.length === 0 && <p className="text-[10px] font-bold text-[var(--c-textDim)] py-8 text-center border border-dashed border-[rgba(var(--line-rgb),.2)] rounded-xl">{tr.stages.noSessionsAddFirst}</p>}
      <div className="space-y-2.5">
        {items.map((p, i) => (
          <div key={i} className="rounded-xl border border-[rgba(var(--line-rgb),.14)] bg-[var(--c-panel3)]/40 p-3">
            <div className="grid grid-cols-[80px_100px_1fr_40px] gap-2.5 items-start">
              <input value={p.day} onChange={e => upd(i, 'day', e.target.value)} placeholder={tr.stages.dayWord} className="px-3 py-2.5 rounded-lg bg-[var(--c-panel3)] border border-[rgba(var(--line-rgb),.2)] text-[var(--c-text)] placeholder-[var(--c-textFaint)] text-[10px] font-bold outline-none focus:border-[#E30613]/50"/>
              <input value={p.time} onChange={e => upd(i, 'time', e.target.value)} placeholder={tr.stages.timePlaceholder} className="px-3 py-2.5 rounded-lg bg-[var(--c-panel3)] border border-[rgba(var(--line-rgb),.2)] text-[var(--c-text)] placeholder-[var(--c-textFaint)] text-[10px] font-bold outline-none focus:border-[#E30613]/50"/>
              <div className="space-y-2">
                <input value={p.activity} onChange={e => upd(i, 'activity', e.target.value)} placeholder={tr.stages.activityPlaceholder} className="w-full px-3 py-2.5 rounded-lg bg-[var(--c-panel3)] border border-[rgba(var(--line-rgb),.2)] text-[var(--c-text)] placeholder-[var(--c-textFaint)] text-[10px] font-bold outline-none focus:border-[#E30613]/50"/>
                <input value={p.details || ''} onChange={e => upd(i, 'details', e.target.value)} placeholder={tr.stages.detailsPlaceholder} className="w-full px-3 py-2.5 rounded-lg bg-[var(--c-panel3)] border border-[rgba(var(--line-rgb),.2)] text-[var(--c-text)] placeholder-[var(--c-textFaint)] text-[10px] font-bold outline-none focus:border-[#E30613]/50"/>
              </div>
              <button onClick={() => del(i)} className="p-2 rounded-lg text-[var(--c-textDim)] hover:bg-[#E30613] hover:text-white transition-all"><Trash2 size={14}/></button>
            </div>
            <div className="mt-2.5 pt-2.5 border-t border-[rgba(var(--line-rgb),.12)]">
              <button onClick={() => setOpenAttendance(openAttendance === i ? null : i)} className="flex items-center gap-1.5 text-[8px] font-black uppercase tracking-widest text-[var(--c-textDim)] hover:text-[var(--acc-gold)] transition-all">
                <Users size={11}/> {tr.stages.attendanceLabel} — {(p.attendance || []).length}/{calledUp.length} {tr.stages.presentCount}
              </button>
              {openAttendance === i && (
                calledUp.length === 0 ? (
                  <p className="mt-2 text-[9px] font-bold text-[var(--c-textDim)]">{tr.stages.noCallupsForAttendance}</p>
                ) : (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {calledUp.map((m: any) => {
                      const on = (p.attendance || []).includes(m.id)
                      return (
                        <button key={m.id} onClick={() => toggleAttendee(i, m.id)}
                          className={`px-2.5 py-1 rounded-lg text-[8px] font-black uppercase tracking-wider border transition-all ${on ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-500' : 'bg-[var(--c-panel3)] border-[rgba(var(--line-rgb),.2)] text-[var(--c-textDim)] hover:border-[#f6c744]/40'}`}>
                          {m.name}
                        </button>
                      )
                    })}
                  </div>
                )
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}


// ── Import call-ups from a PDF (players and staff are matched to member cards automatically) ──
function CallupImport({ all, setDraft }: { all: any[]; setDraft: React.Dispatch<React.SetStateAction<Stage>> }) {
  const cs = useCS()
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string; unmatched: string[]; sample?: string[] } | null>(null)
  const run = async (f: File) => {
    if (!isPdfFile(f)) { setMsg({ ok: false, text: cs("pdfOnly"), unmatched: [] }); return }
    setBusy(true); setMsg(null)
    try {
      const { data: sess } = await supabase.auth.getSession()
      const token = sess?.session?.access_token
      const fd = new FormData(); fd.append('file', f, f.name)
      const r = await fetch('/api/parse-callups', { method: 'POST', body: fd, headers: token ? { Authorization: `Bearer ${token}` } : {} })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) { setMsg({ ok: false, text: d.error || cs("readFail"), unmatched: [] }); return }
      const lines: string[] = d.lines || []
      const people = all.map(m => ({ id: m.id, name: m.name, role: m.role, position: m.position }))
      const res = matchCallups(lines, people)
      // second pass: a name split over two lines (surname, then first name)
      const pairs = lines.slice(0, -1).map((l, i) => l + ' ' + lines[i + 1])
      const extra = matchCallups(pairs, people)
      res.players = Array.from(new Set([...res.players, ...extra.players]))
      for (const s2 of extra.staff) if (!res.staff.some(x => x.id === s2.id)) res.staff.push(s2)
      setDraft(dr => {
        const players = Array.from(new Set([...(dr.players || []), ...res.players]))
        const staff = Array.from(new Set([...(dr.staff || []), ...res.staff.map(s => s.id)]))
        const have = new Set((dr.staffRoles || []).map(x => x.memberId))
        const staffRoles = [...(dr.staffRoles || []), ...res.staff.filter(s => !have.has(s.id)).map(s => ({ memberId: s.id, role: s.role || '' }))]
        return { ...dr, players, staff, staffRoles }
      })
      if (res.players.length + res.staff.length === 0) {
        setMsg({ ok: false, text: cs("importNone", { l: lines.length }), unmatched: [], sample: lines.slice(0, 6) })
      } else {
        setMsg({ ok: true, text: cs("importOk", { l: lines.length, p: res.players.length, s: res.staff.length }), unmatched: res.unmatched })
      }
    } catch { setMsg({ ok: false, text: cs("readFail"), unmatched: [] }) }
    finally { setBusy(false) }
  }
  const drop = useFileDrop(files => run(files[0]), isPdfFile)
  return (
    <div className="mb-4">
      <label {...drop.dropProps} className={`flex items-center justify-center gap-2 px-4 py-5 rounded-xl border-2 border-dashed text-[var(--c-text)] text-[9px] font-black uppercase tracking-wider cursor-pointer transition-all ${drop.isDragging ? 'border-[#E30613] bg-[#E30613]/20' : 'border-[#E30613]/40 bg-[#E30613]/10 hover:bg-[#E30613]/20'}`}>
        <input type="file" accept="application/pdf,.pdf" className="hidden" onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) run(f) }}/>
        <FileText size={13}/> {busy ? cs("reading") : cs("importBtn")}
      </label>
      {msg && (
        <div className={`mt-3 rounded-xl border p-3 text-[10px] font-bold ${msg.ok ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-500' : 'border-[#E30613]/40 bg-[#E30613]/10 text-[var(--acc-red)]'}`}>
          <p>{msg.text}</p>
          {msg.sample && msg.sample.length > 0 && <p className="mt-1.5 text-[var(--c-textDim)]">{cs("firstLines")} {msg.sample.join(' | ')}</p>}
          {msg.unmatched.length > 0 && <p className="mt-1.5 text-[var(--c-textDim)]">{cs("notFound", { n: msg.unmatched.length })} {msg.unmatched.join(' · ')}</p>}
        </div>
      )}
    </div>
  )
}

// ── Convocation editor ──
function PlayersTab({ all, draft, setDraft, members, tr, travel }: { travel?: Props["travel"]; all: any[]; draft: Stage; setDraft: React.Dispatch<React.SetStateAction<Stage>>; members: any[]; tr: any }) {
  const [q, setQ] = useState("")
  const list = draft.players || []
  const pool = members
    .filter(m => m.name)
    .filter(m => list.indexOf(m.id) < 0)
    .filter(m => !q.trim() || m.name.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
  // Problems worth knowing about before calling someone up: over the category's age limit,
  // no birthdate for a youth category, or a passport that won't cover the trip.
  const warnings = (m: any): string[] => {
    if (!m) return []
    const out: string[] = []
    const year = /^\d{4}/.test(draft.startDate) ? Number(draft.startDate.slice(0, 4)) : new Date().getFullYear()
    const e = eligibilityFor(m.birthdate, draft.teamCategory, year)
    if (e.status === 'over') out.push(tr.travel.warnOverAge)
    if (e.status === 'unknown') out.push(tr.travel.warnNoBirthdate)
    if (travel?.expiries) {
      const ps = passportStatus(travel.expiries[m.id], draft.endDate || draft.startDate)
      if (ps.status === 'expired' || ps.status === 'short') out.push(tr.travel.warnPassport)
    }
    return out
  }
  const toggle = (id: number) => setDraft(d => ({ ...d, players: (d.players || []).includes(id) ? (d.players || []).filter(x => x !== id) : [...(d.players || []), id] }))
  return (
    <div>
      <CallupImport all={all} setDraft={setDraft}/>
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <p className="text-[8px] font-black uppercase tracking-widest text-[var(--c-textDim)]">{list.length} {tr.stages.callupsCountLabel}</p>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder={tr.stages.searchPlaceholder} className="w-56 px-3.5 py-2.5 rounded-xl bg-[var(--c-panel3)] border border-[rgba(var(--line-rgb),.22)] text-[var(--c-text)] placeholder-[var(--c-textFaint)] text-[10px] font-bold outline-none focus:border-[#E30613]/50 transition-all"/>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
        {pool.map(m => (
          <button key={m.id} onClick={() => toggle(m.id)} className="flex items-center gap-2.5 rounded-xl border border-[rgba(var(--line-rgb),.14)] bg-[var(--c-panel3)]/40 p-2.5 text-left hover:border-[#f6c744]/40 hover:bg-[var(--c-panel3)]/70 transition-all">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#f6c744]/25 to-[#E30613]/25 flex items-center justify-center text-[10px] font-black text-[var(--acc-gold)] uppercase shrink-0">{(m.name||"?")[0]}</div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-black uppercase text-[var(--c-text)] truncate">{m.name}{warnings(m).length > 0 && <span title={warnings(m).join(' · ')} className="ml-1 text-[#f6c744]">⚠</span>}</p>
              <p className="text-[7px] font-bold text-[var(--c-textDim)] uppercase">{m.position || "—"}</p>
            </div>
            <span className="w-6 h-6 rounded-md border border-[rgba(var(--line-rgb),.25)] flex items-center justify-center text-[var(--acc-gold)]"><Plus size={11}/></span>
          </button>
        ))}
        {pool.length === 0 && <p className="col-span-full text-[10px] font-bold text-[var(--c-textDim)] text-center py-8 border border-dashed border-[rgba(var(--line-rgb),.2)] rounded-xl">{tr.stages.noPlayersAvailable}</p>}
      </div>
      {list.length > 0 && (
        <div className="mt-5">
          <p className="text-[8px] font-black uppercase tracking-widest text-[var(--c-textDim)] mb-2.5">{tr.stages.calledUpLabel} ({list.length})</p>
          <div className="flex flex-wrap gap-2">
            {list.map(id => {
              const m = members.find(x => x.id === id)
              return (
                <span key={id} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#E30613]/12 border border-[#E30613]/40 text-[var(--c-text)] text-[9px] font-black uppercase tracking-wide">
                  {m?.name || `#${id}`}
                  {warnings(m).length > 0 && <span title={warnings(m).join(' · ')} className="text-[#f6c744]">⚠</span>}
                  <button onClick={() => toggle(id)} className="hover:text-white transition-all"><X size={11}/></button>
                </span>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Staff editor ──
function StaffTab({ all, draft, setDraft, members, tr }: { all: any[]; draft: Stage; setDraft: React.Dispatch<React.SetStateAction<Stage>>; members: any[]; tr: any }) {
  const [q, setQ] = useState("")
  const list = draft.staff || []
  const pool = members
    .filter(m => m.name)
    .filter(m => list.indexOf(m.id) < 0)
    .filter(m => !q.trim() || m.name.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
  const toggle = (id: number) => setDraft(d => ({ ...d, staff: (d.staff || []).includes(id) ? (d.staff || []).filter(x => x !== id) : [...(d.staff || []), id] }))
  const setRole = (id: number, role: string) => setDraft(d => ({
    ...d,
    staffRoles: [...(d.staffRoles || []).filter(r => r.memberId !== id), { memberId: id, role }],
  }))
  return (
    <div>
      <CallupImport all={all} setDraft={setDraft}/>
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <p className="text-[8px] font-black uppercase tracking-widest text-[var(--c-textDim)]">{list.length} {tr.stages.staffCountLabel}</p>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder={tr.stages.searchPlaceholder} className="w-56 px-3.5 py-2.5 rounded-xl bg-[var(--c-panel3)] border border-[rgba(var(--line-rgb),.22)] text-[var(--c-text)] placeholder-[var(--c-textFaint)] text-[10px] font-bold outline-none focus:border-[#E30613]/50 transition-all"/>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
        {pool.map(m => (
          <button key={m.id} onClick={() => toggle(m.id)} className="flex items-center gap-2.5 rounded-xl border border-[rgba(var(--line-rgb),.14)] bg-[var(--c-panel3)]/40 p-2.5 text-left hover:border-[#7ec3ff]/40 hover:bg-[var(--c-panel3)]/70 transition-all">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#7ec3ff]/25 to-[#E30613]/25 flex items-center justify-center text-[10px] font-black text-[var(--acc-blue)] uppercase shrink-0">{(m.name||"?")[0]}</div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-black uppercase text-[var(--c-text)] truncate">{m.name}</p>
              <p className="text-[7px] font-bold text-[var(--c-textDim)] uppercase">{m.role || tr.common.staff}</p>
            </div>
            <span className="w-6 h-6 rounded-md border border-[rgba(var(--line-rgb),.25)] flex items-center justify-center text-[var(--acc-blue)]"><Plus size={11}/></span>
          </button>
        ))}
        {pool.length === 0 && <p className="col-span-full text-[10px] font-bold text-[var(--c-textDim)] text-center py-8 border border-dashed border-[rgba(var(--line-rgb),.2)] rounded-xl">{tr.stages.noStaffAvailable}</p>}
      </div>
      {list.length > 0 && (
        <div className="mt-5 space-y-2.5">
          <p className="text-[8px] font-black uppercase tracking-widest text-[var(--c-textDim)]">{tr.stages.assignedStaff}</p>
          {list.map(id => {
            const m = members.find(x => x.id === id)
            const roleVal = (draft.staffRoles || []).find(r => r.memberId === id)?.role || ""
            return (
              <div key={id} className="flex items-center gap-3 rounded-xl border border-[rgba(var(--line-rgb),.14)] bg-[var(--c-panel3)]/40 p-3 flex-wrap">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#7ec3ff]/25 to-[#E30613]/25 flex items-center justify-center text-[10px] font-black text-[var(--acc-blue)] uppercase shrink-0">{(m?.name||"?")[0]}</div>
                <p className="flex-1 min-w-32 text-[10px] font-black uppercase text-[var(--c-text)] truncate">{m?.name || `#${id}`}</p>
                <input value={roleVal} onChange={e => setRole(id, e.target.value)} placeholder={tr.stages.rolePlaceholder} className="w-52 px-3 py-2 rounded-lg bg-[var(--c-panel3)] border border-[rgba(var(--line-rgb),.2)] text-[var(--c-text)] placeholder-[var(--c-textFaint)] text-[9px] font-bold outline-none focus:border-[#7ec3ff]/50"/>
                <button onClick={() => toggle(id)} className="p-1.5 rounded-lg text-[var(--c-textDim)] hover:bg-[#E30613] hover:text-white transition-all"><X size={13}/></button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}