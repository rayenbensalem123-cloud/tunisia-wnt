"use client"
import React, { useState } from "react"
import { ChevronLeft, X, Plus, ArrowLeft, Calendar, MapPin, Users, FileText, Image as ImageIcon, Trash2, Save, Pencil, Download, Check, Briefcase, CalendarRange, Clock } from "lucide-react"
import ThemeToggle from "@/components/theme-toggle"

type Stage = {
  id?: number
  name: string
  location: string
  startDate: string
  endDate: string
  teamCategory: string
  program: { day: string; time: string; activity: string; details?: string }[]
  players: number[]
  staff: number[]
  staffRoles: { memberId: number; role: string }[]
  reportUrl: string
  reportName: string
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
  user?: { username?: string }
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

export function StagesManager({ open, onClose, stages, members, teamCat, canManage, onSave, onDelete, onRefresh, user }: Props) {
  const [view, setView] = useState<"list" | "edit" | "detail">("list")
  const [editing, setEditing] = useState<Stage | null>(null)
  const [tab, setTab] = useState<TabKey>("program")
  const [draft, setDraft] = useState<Stage>(emptyStage(teamCat))
  const [busy, setBusy] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Stage | null>(null)
  const [filtCat, setFiltCat] = useState<string>("ALL")
  const { msg, show } = useToast()

  const sorted = [...stages].sort((a, b) => (b.startDate || "").localeCompare(a.startDate || ""))
  const filtered = filtCat === "ALL" ? sorted : sorted.filter(s => s.teamCategory === filtCat)

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
      show("Stage enregistré ✓")
      onRefresh?.()
      setView("list")
    }
  }

  const upload = async (file: File, folder: string): Promise<string | null> => {
    const fd = new FormData()
    fd.append('file', file, file.name)
    fd.append('folder', folder)
    try {
      const r = await fetch('/api/upload', { method: 'POST', body: fd })
      const d = await r.json()
      return d.url || null
    } catch { return null }
  }

  const onReportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    e.target.value = ""
    if (!f || f.type !== 'application/pdf') return
    setBusy(true)
    const url = await upload(f, 'camps-reports')
    setBusy(false)
    if (url) setDraft(d => ({ ...d, reportUrl: url, reportName: f.name }))
    else show("Erreur d'upload")
  }

  const onPhotos = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    e.target.value = ""
    if (!files.length) return
    setBusy(true)
    const urls: string[] = []
    for (const f of files.slice(0, 12)) {
      const url = await upload(f, 'camps-photos')
      if (url) urls.push(url)
    }
    setBusy(false)
    if (urls.length) setDraft(d => ({ ...d, images: [...(d.images || []), ...urls] }))
    else show("Erreur d'upload")
  }

  const allCandidates = members.filter(m => m.name && m.role)
  const availablePlayers = allCandidates.filter(m => (m.role || '').toUpperCase() === 'PLAYERS')
  const availableStaff = allCandidates.filter(m => (m.role || '').toUpperCase() !== 'PLAYERS')

  if (!open) return null

  return (
    <div className="min-h-screen flex flex-col">
      {/* ═══ TOP BAR ═══ */}
      <div className="sticky top-0 z-[100] border-b border-[rgba(var(--line-rgb),.12)] bg-[rgba(var(--c-bg),.82)] backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={onClose} title="Retour au tableau de bord" className="p-2 rounded-xl border border-[rgba(var(--line-rgb),.2)] text-[var(--c-textDim)] hover:text-[var(--c-text)] hover:bg-[var(--c-panel3)]/60 transition-all shrink-0">
              <ChevronLeft size={17}/>
            </button>
            <img src="/ftf-logo.png" className="h-9" alt="FTF"/>
            <div className="leading-tight min-w-0">
              <h1 className="text-sm font-black italic uppercase tracking-wider text-[var(--c-text)] truncate">Stages de Préparation</h1>
              <p className="text-[8px] font-black text-[#E30613] uppercase tracking-[0.3em]">Rassemblements & Camps</p>
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

            {/* ─── HERO ─── */}
            <div className="relative overflow-hidden rounded-[28px] mt-6 px-7 sm:px-10 py-10 sm:py-12 bg-gradient-to-br from-[#142c52] via-[#0b1322] to-[#8a0f1c] text-white">
              <div className="absolute -right-4 -top-8 text-[110px] sm:text-[150px] font-black italic uppercase tracking-tighter text-white/[0.05] select-none pointer-events-none">Stages</div>
              <div className="relative">
                <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#f6c744]/15 border border-[#f6c744]/40 text-[#f6c744] text-[8px] font-black uppercase tracking-[0.25em]">
                  <CalendarRange size={12}/> Portail Camps
                </span>
                <h2 className="mt-5 text-4xl sm:text-5xl font-black italic uppercase tracking-tighter leading-[0.95]">
                  Stages de <span className="text-[#f6c744]">Préparation</span>
                </h2>
                <p className="mt-4 text-[10px] font-black text-white/60 uppercase tracking-[0.22em]">Programme · Convocations · Encadrement · Rapport · Photos</p>
              </div>
            </div>

            {/* ─── FILTER + CREATE ─── */}
            <div className="mt-8 flex flex-col lg:flex-row lg:items-center gap-4 justify-between">
              <div className="flex p-1 rounded-2xl bg-[var(--c-panel3)] border border-[rgba(var(--line-rgb),.14)] self-start">
                <button onClick={() => setFiltCat("ALL")} className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${filtCat === "ALL" ? 'bg-[#E30613] text-white shadow-md shadow-[#E30613]/25' : 'text-[var(--c-textMid)] hover:text-[var(--c-text)]'}`}>Tous</button>
                {CATS.map(c => (
                  <button key={c.value} onClick={() => setFiltCat(c.value)} className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${filtCat === c.value ? 'bg-[#E30613] text-white shadow-md shadow-[#E30613]/25' : 'text-[var(--c-textMid)] hover:text-[var(--c-text)]'}`}>{c.label}</button>
                ))}
              </div>
              <p className="text-[9px] font-black uppercase tracking-widest text-[var(--c-textDim)]">{filtered.length} stage(s)</p>
            </div>

            {/* ─── CREATE CTA ─── */}
            {canManage && (
              <button onClick={startCreate} className="group mt-5 w-full flex items-center justify-center gap-3 py-5 px-6 rounded-2xl bg-gradient-to-r from-[#b30510] via-[#E30613] to-[#ff2b3a] text-white text-[11px] font-black uppercase tracking-widest shadow-xl shadow-[#E30613]/30 hover:shadow-[#E30613]/55 hover:scale-[1.004] active:scale-[0.99] transition-all">
                <span className="w-8 h-8 rounded-full bg-[#f6c744] text-[#7a4b00] flex items-center justify-center shadow-md shadow-black/25 group-hover:rotate-90 transition-transform duration-300">
                  <Plus size={16} strokeWidth={3}/>
                </span>
                <span className="leading-none">Créer un nouveau stage</span>
                <span className="hidden md:inline text-[8px] font-semibold tracking-[0.18em] text-white/60 uppercase ml-1">Programme · Convocations · Staff · Rapport · Photos</span>
              </button>
            )}

            {/* ─── EMPTY STATE ─── */}
            {filtered.length === 0 && (
              <div className="mt-8 flex flex-col items-center justify-center py-20 gap-5 rounded-3xl border-2 border-dashed border-[rgba(var(--line-rgb),.18)] text-center">
                <div className="w-16 h-16 rounded-2xl bg-[var(--c-panel2)] border border-[rgba(var(--line-rgb),.16)] flex items-center justify-center">
                  <CalendarRange size={26} className="text-[#f6c744]"/>
                </div>
                <div>
                  <p className="text-[13px] font-black uppercase tracking-widest text-[var(--c-text)]">Aucun stage enregistré</p>
                  <p className="text-[9px] font-bold uppercase tracking-wider text-[var(--c-textMid)] mt-1.5">Créez votre premier stage de préparation</p>
                </div>
                {canManage && (
                  <button onClick={startCreate} className="mt-1 px-6 py-3 rounded-full bg-[#E30613] text-white text-[10px] font-black uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-[#E30613]/25 hover:bg-red-700 transition-all">
                    <Plus size={15}/> Créer un stage
                  </button>
                )}
              </div>
            )}

            {/* ─── CARDS GRID ─── */}
            <div className="mt-8 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {filtered.map((s, idx) => {
                const hasPlayers = (s.players?.length || 0) > 0
                const hasReport = !!s.reportUrl
                const hasPhotos = (s.images?.length || 0) > 0
                const hasProgram = (s.program?.length || 0) > 0
                const hasStaff = (s.staff?.length || 0) > 0
                const dur = durDays(s)
                const d = s.startDate ? new Date(s.startDate + "T00:00:00") : null
                return (
                  <div key={s.id ?? s.name} className="group rounded-3xl border border-[rgba(var(--line-rgb),.16)] bg-[var(--c-panel2)]/55 hover:bg-[var(--c-panel2)] hover:border-[#f6c744]/35 hover:-translate-y-1.5 transition-all duration-300 overflow-hidden shadow-none hover:shadow-2xl hover:shadow-black/10">
                    <div className="h-1.5 bg-gradient-to-r from-[#E30613] via-[#f6c744] to-[#E30613]"/>
                    <div className="p-6">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <span className="inline-block px-2.5 py-1 rounded-md bg-[#E30613]/12 border border-[#E30613]/30 text-[#ff5f72] text-[7px] font-black uppercase tracking-widest">{catName(s.teamCategory)}</span>
                          <h3 className="mt-3 text-[15px] font-black uppercase tracking-tight text-[var(--c-text)] truncate">{s.name}</h3>
                          <p className="mt-1.5 flex items-center gap-1.5 text-[9px] font-bold text-[var(--c-textDim)]">
                            <MapPin size={11}/>{s.location || "Lieu —"}
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
                        {dur !== null && <span className="px-2 py-0.5 rounded-md bg-[var(--c-panel3)] border border-[rgba(var(--line-rgb),.16)]">{dur} j</span>}
                      </div>

                      <div className="mt-4 flex gap-1.5 flex-wrap">
                        {hasProgram && <span className="px-2 py-0.5 rounded-md bg-[var(--c-panel3)] border border-[rgba(var(--line-rgb),.18)] text-[var(--c-textMid)] text-[7px] font-black uppercase tracking-wider">Programme</span>}
                        {hasPlayers && <span className="px-2 py-0.5 rounded-md bg-[var(--c-panel3)] border border-[rgba(var(--line-rgb),.18)] text-[var(--c-textMid)] text-[7px] font-black uppercase tracking-wider">{s.players.length} joueurs</span>}
                        {hasStaff && <span className="px-2 py-0.5 rounded-md bg-[var(--c-panel3)] border border-[rgba(var(--line-rgb),.18)] text-[var(--c-textMid)] text-[7px] font-black uppercase tracking-wider">Staff</span>}
                        {hasReport && <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 text-[7px] font-black uppercase tracking-wider">Rapport</span>}
                        {hasPhotos && <span className="px-2 py-0.5 rounded-md bg-[#7ec3ff]/10 border border-[#7ec3ff]/30 text-[#7ec3ff] text-[7px] font-black uppercase tracking-wider">{s.images.length} photos</span>}
                      </div>

                      <div className="mt-6 flex items-center gap-2">
                        <button onClick={() => s.id && openDetail(s)} className="flex-1 px-4 py-2.5 rounded-xl bg-[#E30613] text-white text-[9px] font-black uppercase tracking-wider hover:bg-red-700 transition-all shadow-md shadow-[#E30613]/20">
                          Ouvrir le dossier
                        </button>
                        {canManage && (
                          <button onClick={(e) => { e.stopPropagation(); startEdit(s) }} title="Modifier" className="p-2.5 rounded-xl border border-[rgba(var(--line-rgb),.2)] text-[var(--c-textDim)] hover:text-[#f6c744] hover:border-[#f6c744]/40 transition-all"><Pencil size={15}/></button>
                        )}
                        {canManage && (
                          <button onClick={(e) => { e.stopPropagation(); setDeleteTarget(s) }} title="Supprimer" className="p-2.5 rounded-xl border border-[rgba(var(--line-rgb),.2)] text-[var(--c-textDim)] hover:bg-[#E30613] hover:text-white transition-all"><Trash2 size={15}/></button>
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
          <StageDetail stage={editing} members={members} canManage={canManage}
            onBack={() => setView("list")}
            onEdit={() => { setDraft(JSON.parse(JSON.stringify(editing))); setTab("program"); setView("edit") }}
            onDelete={() => setDeleteTarget(editing)} />
        )}

        {view === "edit" && (
          <>
            {/* ─── EDIT HEADER ─── */}
            <div className="mt-6 flex items-end justify-between gap-4 flex-wrap">
              <div>
                <p className="text-[8px] font-black uppercase tracking-[0.25em] text-[var(--c-textDim)]">Stages / {editing ? "Modifier" : "Nouveau"}</p>
                <h2 className="mt-1 text-2xl font-black italic uppercase tracking-tight text-[var(--c-text)]">{editing ? "Modifier le Stage" : "Nouveau Stage"}</h2>
                <p className="mt-1 text-[9px] font-bold text-[var(--c-textDim)] uppercase tracking-wider">Programme · Convocations · Staff · Rapport · Photos</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setView("list")} className="px-5 py-2.5 rounded-xl border border-[rgba(var(--line-rgb),.2)] text-[var(--c-textDim)] hover:text-[var(--c-text)] hover:bg-[var(--c-panel3)]/40 text-[9px] font-black uppercase tracking-wider transition-all">Annuler</button>
                <button onClick={save} disabled={!canSubmit || busy} className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#E30613] text-white text-[9px] font-black uppercase tracking-wider hover:bg-red-700 transition-all disabled:opacity-40 shadow-lg shadow-[#E30613]/25">
                  <Save size={14}/> {busy ? 'Enregistrement…' : editing ? 'Enregistrer' : 'Créer le stage'}
                </button>
              </div>
            </div>

            {/* ─── BASIC INFO ─── */}
            <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-[8px] font-black uppercase tracking-widest text-[var(--c-textDim)] mb-1.5">Nom du stage *</label>
                <input
                  value={draft.name}
                  onChange={e => setDraft({ ...draft, name: e.target.value })}
                  placeholder="ex: Stage de préparation — Mars"
                  className="w-full px-4 py-3 rounded-xl bg-[var(--c-panel3)] border border-[rgba(var(--line-rgb),.22)] text-[var(--c-text)] placeholder-[var(--c-textFaint)] text-[11px] font-bold outline-none focus:border-[#E30613]/50 transition-all"/>
              </div>
              <div>
                <label className="block text-[8px] font-black uppercase tracking-widest text-[var(--c-textDim)] mb-1.5">Lieu</label>
                <input
                  value={draft.location}
                  onChange={e => setDraft({ ...draft, location: e.target.value })}
                  placeholder="ex: Tunis"
                  className="w-full px-4 py-3 rounded-xl bg-[var(--c-panel3)] border border-[rgba(var(--line-rgb),.22)] text-[var(--c-text)] placeholder-[var(--c-textFaint)] text-[11px] font-bold outline-none focus:border-[#E30613]/50 transition-all"/>
              </div>
              <div>
                <label className="block text-[8px] font-black uppercase tracking-widest text-[var(--c-textDim)] mb-1.5">Catégorie</label>
                <select value={draft.teamCategory} onChange={e => setDraft({ ...draft, teamCategory: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl bg-[var(--c-panel3)] border border-[rgba(var(--line-rgb),.22)] text-[var(--c-text)] text-[11px] font-bold outline-none focus:border-[#E30613]/50 transition-all">
                  {CATS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[8px] font-black uppercase tracking-widest text-[var(--c-textDim)] mb-1.5">Début</label>
                <input type="date" value={draft.startDate} onChange={e => setDraft({ ...draft, startDate: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl bg-[var(--c-panel3)] border border-[rgba(var(--line-rgb),.22)] text-[var(--c-text)] text-[11px] font-bold outline-none focus:border-[#E30613]/50 transition-all"/>
              </div>
              <div>
                <label className="block text-[8px] font-black uppercase tracking-widest text-[var(--c-textDim)] mb-1.5">Fin</label>
                <input type="date" value={draft.endDate} onChange={e => setDraft({ ...draft, endDate: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl bg-[var(--c-panel3)] border border-[rgba(var(--line-rgb),.22)] text-[var(--c-text)] text-[11px] font-bold outline-none focus:border-[#E30613]/50 transition-all"/>
              </div>
            </div>

            {/* ─── TABS ─── */}
            <div className="mt-6 flex gap-1.5 flex-wrap">
              {([["program","Programme"],["players","Convocations"],["staff","Staff"],["report","Rapport PDF"],["photos","Photos"]] as [TabKey,string][]).map(([k,label]) => (
                <button key={k} onClick={() => setTab(k)} className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all ${tab===k?'bg-[#E30613] text-white shadow-md shadow-[#E30613]/25':'bg-[var(--c-panel3)] text-[var(--c-textMid)] border border-[rgba(var(--line-rgb),.16)] hover:text-[var(--c-text)]'}`}>{label}</button>
              ))}
            </div>

            {/* ─── TAB CONTENT ─── */}
            <div className="mt-5">
              {tab === "program" && (
                <ProgramTab draft={draft} setDraft={setDraft}/>
              )}

              {tab === "players" && (
                <PlayersTab draft={draft} setDraft={setDraft} members={availablePlayers.length ? availablePlayers : allCandidates.filter(m => (m.role||'').toUpperCase()==='PLAYERS')}/>
              )}

              {tab === "staff" && (
                <StaffTab draft={draft} setDraft={setDraft} members={availableStaff.length ? availableStaff : allCandidates.filter(m => (m.role||'').toUpperCase()!=='PLAYERS')}/>
              )}

              {tab === "report" && (
                <div>
                  <p className="text-[8px] font-black uppercase tracking-widest text-[var(--c-textDim)] mb-3">Rapport de fin de stage (PDF)</p>
                  <label className={`flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-9 cursor-pointer transition-all ${draft.reportUrl ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-[rgba(var(--line-rgb),.25)] bg-[var(--c-panel3)]/60 hover:border-[#E30613]/50'}`}>
                    <input type="file" accept=".pdf,application/pdf" className="hidden" onChange={onReportFile}/>
                    <FileText size={30} className={draft.reportUrl ? 'text-emerald-500' : 'text-[var(--c-textDim)]'}/>
                    <span className="text-[11px] font-black uppercase tracking-widest text-[var(--c-text)]">{busy ? 'Upload…' : draft.reportUrl ? draft.reportName || 'Rapport joint ✓' : 'Déposez le rapport PDF ici'}</span>
                    <span className="text-[8px] text-[var(--c-textDim)]">Glissez-déposez ou cliquez pour choisir · PDF uniquement</span>
                  </label>
                  {draft.reportUrl && (
                    <div className="flex gap-2 mt-3 flex-wrap">
                      <a href={draft.reportUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 text-[9px] font-black uppercase tracking-wider hover:bg-emerald-500/15 transition-all">
                        <Download size={12}/> Ouvrir le rapport
                      </a>
                      <button onClick={() => setDraft({ ...draft, reportUrl: "", reportName: "" })} className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-[rgba(var(--line-rgb),.2)] text-[#ff4f66] text-[9px] font-black uppercase tracking-wider hover:bg-[#E30613]/10 transition-all">
                        <Trash2 size={12}/> Retirer
                      </button>
                    </div>
                  )}
                </div>
              )}

              {tab === "photos" && (
                <div>
                  <p className="text-[8px] font-black uppercase tracking-widest text-[var(--c-textDim)] mb-3">Photos du stage</p>
                  <label className={`flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-7 cursor-pointer transition-all mb-4 ${'border-[rgba(var(--line-rgb),.25)] bg-[var(--c-panel3)]/60 hover:border-[#f6c744]/50'}`}>
                    <input type="file" accept="image/*" multiple className="hidden" onChange={onPhotos}/>
                    <ImageIcon size={26} className="text-[var(--c-textDim)]"/>
                    <span className="text-[10px] font-black uppercase tracking-widest text-[var(--c-text)]">{busy ? 'Upload…' : 'Ajouter des photos'}</span>
                    <span className="text-[8px] text-[var(--c-textDim)]">Glissez-déposez ou cliquez · jusqu'à 12 images</span>
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {(draft.images || []).map((img, i) => (
                      <div key={img + i} className="group relative rounded-xl overflow-hidden border border-[rgba(var(--line-rgb),.16)]">
                        <img src={img} alt={`photo ${i+1}`} className="w-full h-32 object-cover"/>
                        <button onClick={() => setDraft(d => ({ ...d, images: (d.images || []).filter((_, j) => j !== i) }))} className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/70 text-white opacity-0 group-hover:opacity-100 hover:bg-[#E30613] transition-all" title="Remove">
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
        <div className="fixed inset-0 z-[450] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-2xl bg-[var(--c-surface)] border border-[rgba(var(--line-rgb),.18)] shadow-2xl p-6">
            <h3 className="text-sm font-black uppercase tracking-tight text-[var(--c-text)] mb-2">Supprimer ce stage ?</h3>
            <p className="text-[10px] font-bold text-[var(--c-textDim)] mb-5">« {deleteTarget.name} » sera définitivement supprimé, ainsi que son programme, ses convocations et ses documents.</p>
            <div className="flex gap-2">
              <button onClick={() => setDeleteTarget(null)} className="flex-1 py-2.5 rounded-xl border border-[rgba(var(--line-rgb),.2)] text-[var(--c-textDim)] text-[9px] font-black uppercase tracking-wider transition-all">Annuler</button>
              <button onClick={async () => {
                if (deleteTarget.id && onDelete) await onDelete(deleteTarget.id)
                onRefresh?.()
                setDeleteTarget(null)
                setView("list")
              }} className="flex-1 py-2.5 rounded-xl bg-[#E30613] text-white text-[9px] font-black uppercase tracking-wider hover:bg-red-700 transition-all">Supprimer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function StageDetail({ stage, members, canManage, onBack, onEdit, onDelete }: {
  stage: Stage
  members: any[]
  canManage: boolean
  onBack: () => void
  onEdit: () => void
  onDelete?: () => void
}) {
  const [tab, setTab] = useState<TabKey>("program")
  const memberById = (id: number) => members.find(m => m.id === id)
  const dur = durDays(stage)
  const d = stage.startDate ? new Date(stage.startDate + "T00:00:00") : null
  return (
    <>
      {/* Breadcrumb */}
      <div className="mt-6 flex items-center justify-between gap-3 flex-wrap">
        <button onClick={onBack} className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[rgba(var(--line-rgb),.2)] bg-[var(--c-panel3)]/70 text-[var(--c-textMid)] hover:text-[var(--c-text)] text-[9px] font-black uppercase tracking-wider transition-all">
          <ArrowLeft size={13}/> Tous les stages
        </button>
        <div className="flex gap-2">
          {canManage && (
            <>
              <button onClick={onEdit} className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-[rgba(var(--line-rgb),.2)] bg-[var(--c-panel3)]/70 text-[var(--c-textDim)] hover:text-[#f6c744] hover:border-[#f6c744]/40 text-[9px] font-black uppercase tracking-wider transition-all">
                <Pencil size={13}/> Modifier
              </button>
              <button onClick={onDelete} className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-[#ff4f66]/30 bg-[#E30613]/10 text-[#ff5f72] hover:bg-[#E30613]/20 text-[9px] font-black uppercase tracking-wider transition-all">
                <Trash2 size={13}/> Supprimer
              </button>
            </>
          )}
        </div>
      </div>

      {/* Detail hero */}
      <div className="relative overflow-hidden rounded-[28px] mt-5 px-7 sm:px-10 py-9 bg-gradient-to-br from-[#142c52] via-[#0b1322] to-[#8a0f1c] text-white">
        <div className="absolute inset-0 opacity-[0.08] pointer-events-none" style={{ backgroundImage: "radial-gradient(circle at 82% 16%, #f6c744 0, transparent 40%)" }}/>
        <div className="absolute -right-3 -top-8 text-[90px] font-black italic uppercase tracking-tighter text-white/[0.05] select-none pointer-events-none">{stage.name.slice(0, 12)}</div>
        <div className="relative">
          <div className="flex items-start justify-between gap-6 flex-wrap">
            <div className="flex items-center gap-5 flex-wrap">
              {d && (
                <div className="rounded-2xl bg-white/[0.08] border border-white/20 px-5 py-3.5 text-center min-w-[88px]">
                  <p className="text-[30px] font-black italic leading-none text-[#f6c744]">{String(d.getDate()).padStart(2, "0")}</p>
                  <p className="mt-1 text-[8px] font-black text-white/65 uppercase tracking-widest">{MONTHS[d.getMonth()]} {d.getFullYear()}</p>
                </div>
              )}
              <div>
                <span className="inline-block px-2.5 py-1 rounded-md bg-[#E30613]/40 border border-[#ff5f72]/50 text-[#ffd0d7] text-[7px] font-black uppercase tracking-widest">{CATS.find(c => c.value === stage.teamCategory)?.label || stage.teamCategory}</span>
                <h2 className="mt-3 text-3xl sm:text-4xl font-black italic uppercase tracking-tighter leading-none">{stage.name}</h2>
                <div className="mt-3 flex items-center gap-3 text-[9px] font-bold text-white/60 flex-wrap">
                  <span className="flex items-center gap-1.5"><MapPin size={11}/>{stage.location || "Lieu —"}</span>
                  <span className="flex items-center gap-1.5"><Calendar size={11}/>{fmtDate(stage.startDate)} → {fmtDate(stage.endDate)}</span>
                  {dur !== null && <span className="px-2 py-0.5 rounded-md bg-white/[0.08] border border-white/15">{dur} jours</span>}
                  {stage.createdByUsername && <span className="flex items-center gap-1.5 opacity-70">Créé par {stage.createdByUsername}</span>}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="mt-6 flex gap-1 flex-wrap">
        {([["program","Programme"],["players",`Joueurs (${(stage.players||[]).length})`],["staff",`Staff (${(stage.staff||[]).length})`],["report","Rapport"],["photos",`Photos (${(stage.images||[]).length})`]] as [TabKey,string][]).map(([k,label]) => (
          <button key={k} onClick={() => setTab(k)} className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all ${tab===k?'bg-[#E30613] text-white shadow-md shadow-[#E30613]/25':'bg-[var(--c-panel3)] text-[var(--c-textMid)] border border-[rgba(var(--line-rgb),.16)] hover:text-[var(--c-text)]'}`}>{label}</button>
        ))}
      </div>

      <div className="mt-5">
        {tab === "program" && (
          <div>
            {(stage.program || []).length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-center rounded-2xl border border-dashed border-[rgba(var(--line-rgb),.2)]">
                <Calendar size={30} className="text-[var(--c-textDim)] opacity-50 mb-3"/>
                <p className="text-[10px] font-black uppercase tracking-widest text-[var(--c-textDim)]">Aucun programme enregistré.</p>
              </div>
            )}
            {(stage.program || []).length > 0 && (
              <div className="relative pl-7">
                <div className="absolute left-[13px] top-2 bottom-2 w-px bg-gradient-to-b from-[#f6c744]/50 via-[rgba(var(--line-rgb),.3)] to-transparent"/>
                <div className="space-y-4">
                  {(stage.program || []).map((p, i) => (
                    <div key={i} className="relative">
                      <span className="absolute -left-7 top-3.5 w-[9px] h-[9px] rounded-full bg-[#f6c744] border-2 border-[var(--c-surface)] shadow-[0_0_0_3px_rgba(246,199,68,.15)]"/>
                      <div className="rounded-2xl border border-[rgba(var(--line-rgb),.14)] bg-[var(--c-panel3)]/50 p-4 sm:p-5">
                        <div className="flex items-center gap-3 flex-wrap text-[9px] font-bold text-[var(--c-textDim)]">
                          <span className="flex items-center gap-1.5"><Calendar size={11}/>{p.day || "Jour"}</span>
                          {p.time && <span className="flex items-center gap-1.5"><Clock size={11}/>{p.time}</span>}
                        </div>
                        <p className="mt-2 text-[13px] font-black uppercase tracking-wide text-[var(--c-text)]">{p.activity || ""}</p>
                        {p.details && <p className="mt-1 text-[10px] font-bold text-[var(--c-textDim)]">{p.details}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
        {tab === "players" && (
          <div>
            {(stage.players || []).length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-center rounded-2xl border border-dashed border-[rgba(var(--line-rgb),.2)]">
                <Users size={30} className="text-[var(--c-textDim)] opacity-50 mb-3"/>
                <p className="text-[10px] font-black uppercase tracking-widest text-[var(--c-textDim)]">Aucune convocation.</p>
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {(stage.players || []).map(id => {
                const m = memberById(id)
                return (
                  <div key={id} className="flex items-center gap-3 rounded-2xl border border-[rgba(var(--line-rgb),.14)] bg-[var(--c-panel3)]/50 p-3">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#f6c744]/25 to-[#E30613]/25 flex items-center justify-center text-[11px] font-black text-[#f6c744] uppercase shrink-0">{(m?.name||"?")[0]}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-black uppercase text-[var(--c-text)] truncate">{m?.name || `#${id}`}</p>
                      <p className="text-[8px] font-bold text-[var(--c-textDim)] uppercase">{m?.position || "—"}</p>
                    </div>
                    <span className="px-2 py-1 rounded-md bg-[var(--c-panel2)] border border-[#E30613]/25 text-[#ff5f72] text-[7px] font-black uppercase tracking-wider shrink-0">CONVOQUÉ</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}
        {tab === "staff" && (
          <div>
            {(stage.staff || []).length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-center rounded-2xl border border-dashed border-[rgba(var(--line-rgb),.2)]">
                <Briefcase size={30} className="text-[var(--c-textDim)] opacity-50 mb-3"/>
                <p className="text-[10px] font-black uppercase tracking-widest text-[var(--c-textDim)]">Aucun staff enregistré.</p>
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {(stage.staff || []).map((id, idx) => {
                const m = memberById(id)
                const role = (stage.staffRoles || []).find(r => r.memberId === id)?.role
                return (
                  <div key={`${id}-${idx}`} className="flex items-center gap-3 rounded-2xl border border-[rgba(var(--line-rgb),.14)] bg-[var(--c-panel3)]/50 p-3">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#7ec3ff]/25 to-[#E30613]/25 flex items-center justify-center text-[11px] font-black text-[#7ec3ff] uppercase shrink-0">{(m?.name||"?")[0]}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-black uppercase text-[var(--c-text)] truncate">{m?.name || `#${id}`}</p>
                      {role && <p className="text-[8px] font-bold text-[#7ec3ff] uppercase tracking-wider">{role}</p>}
                    </div>
                    <Briefcase size={14} className="text-[var(--c-textDim)] shrink-0"/>
                  </div>
                )
              })}
            </div>
          </div>
        )}
        {tab === "report" && (
          <div>
            {stage.reportUrl ? (
              <div className="flex flex-col items-center justify-center gap-4 rounded-3xl border border-emerald-500/30 bg-emerald-500/5 p-12 text-center">
                <div className="w-14 h-14 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
                  <FileText size={26} className="text-emerald-500"/>
                </div>
                <p className="text-[12px] font-black uppercase tracking-wider text-[var(--c-text)]">{stage.reportName || "Rapport de stage"}</p>
                <a href={stage.reportUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 text-[9px] font-black uppercase tracking-wider hover:bg-emerald-500/15 transition-all">
                  <Download size={14}/> Ouvrir le rapport PDF
                </a>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-center rounded-2xl border border-dashed border-[rgba(var(--line-rgb),.2)]">
                <FileText size={30} className="text-[var(--c-textDim)] opacity-50 mb-3"/>
                <p className="text-[10px] font-black uppercase tracking-widest text-[var(--c-textDim)]">Aucun rapport de fin de stage déposé.</p>
              </div>
            )}
          </div>
        )}
        {tab === "photos" && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {(stage.images || []).length === 0 && (
              <div className="col-span-full flex flex-col items-center justify-center py-16 text-center rounded-2xl border border-dashed border-[rgba(var(--line-rgb),.2)]">
                <ImageIcon size={30} className="text-[var(--c-textDim)] opacity-50 mb-3"/>
                <p className="text-[10px] font-black uppercase tracking-widest text-[var(--c-textDim)]">Aucune photo du stage.</p>
              </div>
            )}
            {(stage.images || []).map((img, i) => (
              <a key={img + i} href={img} target="_blank" rel="noreferrer" className="group relative rounded-xl overflow-hidden border border-[rgba(var(--line-rgb),.16)]">
                <img src={img} alt={`photo ${i+1}`} className="w-full h-32 object-cover group-hover:scale-105 transition-transform duration-300"/>
              </a>
            ))}
          </div>
        )}
      </div>
    </>
  )
}

// ── Programme editor ──
function ProgramTab({ draft, setDraft }: { draft: Stage; setDraft: React.Dispatch<React.SetStateAction<Stage>> }) {
  const items = draft.program || []
  const add = () => setDraft(d => ({ ...d, program: [...(d.program || []), { day: "", time: "", activity: "", details: "" }] }))
  const upd = (i: number, k: string, v: string) => setDraft(d => ({ ...d, program: (d.program || []).map((p, j) => j === i ? { ...p, [k]: v } : p) }))
  const del = (i: number) => setDraft(d => ({ ...d, program: (d.program || []).filter((_, j) => j !== i) }))
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-[8px] font-black uppercase tracking-widest text-[var(--c-textDim)]">Programme d'entraînement</p>
        <button onClick={add} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--c-panel3)] border border-[#f6c744]/30 text-[#f6c744] text-[8px] font-black uppercase tracking-wider hover:border-[#f6c744]/60 transition-all"><Plus size={11}/> Ajouter</button>
      </div>
      {items.length === 0 && <p className="text-[10px] font-bold text-[var(--c-textDim)] py-8 text-center border border-dashed border-[rgba(var(--line-rgb),.2)] rounded-xl">Aucune séance — ajoutez la première.</p>}
      <div className="space-y-2.5">
        {items.map((p, i) => (
          <div key={i} className="grid grid-cols-[80px_100px_1fr_40px] gap-2.5 items-start rounded-xl border border-[rgba(var(--line-rgb),.14)] bg-[var(--c-panel3)]/40 p-3">
            <input value={p.day} onChange={e => upd(i, 'day', e.target.value)} placeholder="Jour" className="px-3 py-2.5 rounded-lg bg-[var(--c-panel3)] border border-[rgba(var(--line-rgb),.2)] text-[var(--c-text)] placeholder-[var(--c-textFaint)] text-[10px] font-bold outline-none focus:border-[#E30613]/50"/>
            <input value={p.time} onChange={e => upd(i, 'time', e.target.value)} placeholder="9h00" className="px-3 py-2.5 rounded-lg bg-[var(--c-panel3)] border border-[rgba(var(--line-rgb),.2)] text-[var(--c-text)] placeholder-[var(--c-textFaint)] text-[10px] font-bold outline-none focus:border-[#E30613]/50"/>
            <div className="space-y-2">
              <input value={p.activity} onChange={e => upd(i, 'activity', e.target.value)} placeholder="Activité (ex: Séance physique AM / Match amical)" className="w-full px-3 py-2.5 rounded-lg bg-[var(--c-panel3)] border border-[rgba(var(--line-rgb),.2)] text-[var(--c-text)] placeholder-[var(--c-textFaint)] text-[10px] font-bold outline-none focus:border-[#E30613]/50"/>
              <input value={p.details || ''} onChange={e => upd(i, 'details', e.target.value)} placeholder="Détails (optionnel)" className="w-full px-3 py-2.5 rounded-lg bg-[var(--c-panel3)] border border-[rgba(var(--line-rgb),.2)] text-[var(--c-text)] placeholder-[var(--c-textFaint)] text-[10px] font-bold outline-none focus:border-[#E30613]/50"/>
            </div>
            <button onClick={() => del(i)} className="p-2 rounded-lg text-[var(--c-textDim)] hover:bg-[#E30613] hover:text-white transition-all"><Trash2 size={14}/></button>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Convocation editor ──
function PlayersTab({ draft, setDraft, members }: { draft: Stage; setDraft: React.Dispatch<React.SetStateAction<Stage>>; members: any[] }) {
  const [q, setQ] = useState("")
  const list = draft.players || []
  const pool = members
    .filter(m => m.name)
    .filter(m => list.indexOf(m.id) < 0)
    .filter(m => !q.trim() || m.name.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
  const toggle = (id: number) => setDraft(d => ({ ...d, players: (d.players || []).includes(id) ? (d.players || []).filter(x => x !== id) : [...(d.players || []), id] }))
  return (
    <div>
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <p className="text-[8px] font-black uppercase tracking-widest text-[var(--c-textDim)]">{list.length} joueur(s) convoqué(s)</p>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Rechercher…" className="w-56 px-3.5 py-2.5 rounded-xl bg-[var(--c-panel3)] border border-[rgba(var(--line-rgb),.22)] text-[var(--c-text)] placeholder-[var(--c-textFaint)] text-[10px] font-bold outline-none focus:border-[#E30613]/50 transition-all"/>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
        {pool.map(m => (
          <button key={m.id} onClick={() => toggle(m.id)} className="flex items-center gap-2.5 rounded-xl border border-[rgba(var(--line-rgb),.14)] bg-[var(--c-panel3)]/40 p-2.5 text-left hover:border-[#f6c744]/40 hover:bg-[var(--c-panel3)]/70 transition-all">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#f6c744]/25 to-[#E30613]/25 flex items-center justify-center text-[10px] font-black text-[#f6c744] uppercase shrink-0">{(m.name||"?")[0]}</div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-black uppercase text-[var(--c-text)] truncate">{m.name}</p>
              <p className="text-[7px] font-bold text-[var(--c-textDim)] uppercase">{m.position || "—"}</p>
            </div>
            <span className="w-6 h-6 rounded-md border border-[rgba(var(--line-rgb),.25)] flex items-center justify-center text-[#f6c744]"><Plus size={11}/></span>
          </button>
        ))}
        {pool.length === 0 && <p className="col-span-full text-[10px] font-bold text-[var(--c-textDim)] text-center py-8 border border-dashed border-[rgba(var(--line-rgb),.2)] rounded-xl">Aucun joueur disponible.</p>}
      </div>
      {list.length > 0 && (
        <div className="mt-5">
          <p className="text-[8px] font-black uppercase tracking-widest text-[var(--c-textDim)] mb-2.5">Convoqués ({list.length})</p>
          <div className="flex flex-wrap gap-2">
            {list.map(id => {
              const m = members.find(x => x.id === id)
              return (
                <span key={id} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#E30613]/12 border border-[#E30613]/40 text-[var(--c-text)] text-[9px] font-black uppercase tracking-wide">
                  {m?.name || `#${id}`}
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
function StaffTab({ draft, setDraft, members }: { draft: Stage; setDraft: React.Dispatch<React.SetStateAction<Stage>>; members: any[] }) {
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
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <p className="text-[8px] font-black uppercase tracking-widest text-[var(--c-textDim)]">{list.length} membre(s) du staff</p>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Rechercher…" className="w-56 px-3.5 py-2.5 rounded-xl bg-[var(--c-panel3)] border border-[rgba(var(--line-rgb),.22)] text-[var(--c-text)] placeholder-[var(--c-textFaint)] text-[10px] font-bold outline-none focus:border-[#E30613]/50 transition-all"/>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
        {pool.map(m => (
          <button key={m.id} onClick={() => toggle(m.id)} className="flex items-center gap-2.5 rounded-xl border border-[rgba(var(--line-rgb),.14)] bg-[var(--c-panel3)]/40 p-2.5 text-left hover:border-[#7ec3ff]/40 hover:bg-[var(--c-panel3)]/70 transition-all">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#7ec3ff]/25 to-[#E30613]/25 flex items-center justify-center text-[10px] font-black text-[#7ec3ff] uppercase shrink-0">{(m.name||"?")[0]}</div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-black uppercase text-[var(--c-text)] truncate">{m.name}</p>
              <p className="text-[7px] font-bold text-[var(--c-textDim)] uppercase">{m.role || "STAFF"}</p>
            </div>
            <span className="w-6 h-6 rounded-md border border-[rgba(var(--line-rgb),.25)] flex items-center justify-center text-[#7ec3ff]"><Plus size={11}/></span>
          </button>
        ))}
        {pool.length === 0 && <p className="col-span-full text-[10px] font-bold text-[var(--c-textDim)] text-center py-8 border border-dashed border-[rgba(var(--line-rgb),.2)] rounded-xl">Aucun staff disponible.</p>}
      </div>
      {list.length > 0 && (
        <div className="mt-5 space-y-2.5">
          <p className="text-[8px] font-black uppercase tracking-widest text-[var(--c-textDim)]">Staff affecté</p>
          {list.map(id => {
            const m = members.find(x => x.id === id)
            const roleVal = (draft.staffRoles || []).find(r => r.memberId === id)?.role || ""
            return (
              <div key={id} className="flex items-center gap-3 rounded-xl border border-[rgba(var(--line-rgb),.14)] bg-[var(--c-panel3)]/40 p-3 flex-wrap">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#7ec3ff]/25 to-[#E30613]/25 flex items-center justify-center text-[10px] font-black text-[#7ec3ff] uppercase shrink-0">{(m?.name||"?")[0]}</div>
                <p className="flex-1 min-w-32 text-[10px] font-black uppercase text-[var(--c-text)] truncate">{m?.name || `#${id}`}</p>
                <input value={roleVal} onChange={e => setRole(id, e.target.value)} placeholder="Rôle (ex: Sélectionneur, Kiné…)" className="w-52 px-3 py-2 rounded-lg bg-[var(--c-panel3)] border border-[rgba(var(--line-rgb),.2)] text-[var(--c-text)] placeholder-[var(--c-textFaint)] text-[9px] font-bold outline-none focus:border-[#7ec3ff]/50"/>
                <button onClick={() => toggle(id)} className="p-1.5 rounded-lg text-[var(--c-textDim)] hover:bg-[#E30613] hover:text-white transition-all"><X size={13}/></button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}