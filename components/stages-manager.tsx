"use client"
import React, { useState } from "react"
import { createPortal } from "react-dom"
import { X, Plus, ArrowLeft, Calendar, MapPin, Users, ClipboardList, FileText, Image as ImageIcon, Trash2, Save, Pencil, Download, Check, Star, Briefcase } from "lucide-react"

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

export function StagesManager({ open, onClose, stages, members, teamCat, canManage, onSave, onDelete, onRefresh }: Props) {
  const [view, setView] = useState<"list" | "edit" | "detail">("list")
  const [editing, setEditing] = useState<Stage | null>(null)
  const [tab, setTab] = useState<TabKey>("program")
  const [draft, setDraft] = useState<Stage>(emptyStage(teamCat))
  const [busy, setBusy] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Stage | null>(null)
  const { msg, show } = useToast()

  const sorted = [...stages].sort((a, b) => (b.startDate || "").localeCompare(a.startDate || ""))

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

  return createPortal(
    <div className="fixed inset-0 z-[400] flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-sm" onMouseDownCapture={(e) => e.stopPropagation()}>
      <div className="w-full max-w-4xl rounded-3xl bg-[var(--c-surface)] border border-[rgba(var(--line-rgb),.18)] shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">

        {/* Header */}
        <div className="px-6 pt-5 pb-4 border-b border-[rgba(var(--line-rgb),.14)] shrink-0 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-[#E30613]/15 border border-[#E30613]/40 flex items-center justify-center shrink-0">
              <Calendar size={16} className="text-[#ff5f72]"/>
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-black italic uppercase tracking-tight truncate">{view === "edit" ? (editing ? "Modifier le Stage" : "Nouveau Stage") : "Stages (Camps)"}</h2>
              <p className="text-[8px] font-black uppercase tracking-[0.3em] text-[var(--c-textDim)]">Programme · Convocations · Staff · Rapport · Photos</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {view === "edit" && (
              <button onClick={() => setView("list")} className="p-2.5 rounded-xl border border-[rgba(var(--line-rgb),.2)] text-[var(--c-textDim)] hover:text-[var(--c-text)] hover:bg-[var(--c-panel3)]/60 transition-all" title="Back">
                <ArrowLeft size={16}/>
              </button>
            )}
            <button onClick={onClose} title="Close" className="p-2.5 rounded-xl border border-[rgba(var(--line-rgb),.2)] text-[var(--c-textDim)] hover:bg-[#E30613] hover:text-white transition-all"><X size={16}/></button>
          </div>
        </div>

        {msg && (
          <div className="shrink-0 mx-6 mt-4 px-4 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 text-[10px] font-black uppercase tracking-wider flex items-center gap-2">
            <Check size={13}/>{msg}
          </div>
        )}

        {/* ───────── List view ───────── */}
        {view === "list" && (
          <div className="flex-1 overflow-y-auto p-6 space-y-3">
            {canManage && (
              <button onClick={startCreate} className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl border-2 border-dashed border-[#E30613]/35 text-[#ff5f72] text-[11px] font-black uppercase tracking-widest hover:bg-[#E30613]/8 hover:border-[#E30613]/60 transition-all">
                <Plus size={16}/> Créer un nouveau stage
              </button>
            )}

            {sorted.length === 0 && !canManage && (
              <div className="text-center py-16 text-[var(--c-textDim)]">
                <Calendar size={40} className="mx-auto mb-3 opacity-40"/>
                <p className="text-[11px] font-black uppercase tracking-widest">Aucun stage enregistré</p>
              </div>
            )}

            {sorted.map(s => {
              const hasPlayers = (s.players?.length || 0) > 0
              const hasReport = !!s.reportUrl
              const hasPhotos = (s.images?.length || 0) > 0
              const hasProgram = (s.program?.length || 0) > 0
              const hasStaff = (s.staff?.length || 0) > 0
              const dateLabel = s.startDate && s.endDate ? `${s.startDate.slice(8,10)}/${s.startDate.slice(5,7)} → ${s.endDate.slice(8,10)}/${s.endDate.slice(5,7)}` : (s.startDate || "—")
              return (
                <div key={s.id ?? s.name} className="group rounded-2xl border border-[rgba(var(--line-rgb),.16)] bg-[var(--c-panel2)]/60 hover:bg-[var(--c-panel2)] hover:border-[#f6c744]/35 transition-all overflow-hidden">
                  <div className="flex items-center gap-4 p-4 cursor-pointer" onClick={() => s.id && openDetail(s)}>
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#f6c744]/25 to-[#E30613]/25 flex items-center justify-center shrink-0">
                      <Calendar size={17} className="text-[#f6c744]"/>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-[13px] font-black uppercase tracking-wide text-[var(--c-text)] truncate">{s.name}</p>
                        <span className="px-2 py-0.5 rounded-md bg-[#E30613]/12 border border-[#E30613]/30 text-[#ff5f72] text-[7px] font-black uppercase tracking-widest">{catName(s.teamCategory)}</span>
                      </div>
                      <div className="flex items-center gap-3 mt-1.5 text-[9px] font-bold text-[var(--c-textDim)] flex-wrap">
                        <span className="flex items-center gap-1"><MapPin size={10}/>{s.location || "Lieu —"}</span>
                        {s.startDate && <span className="flex items-center gap-1"><Calendar size={10}/>{dateLabel}</span>}
                      </div>
                      <div className="flex gap-1.5 mt-2 flex-wrap">
                        {hasProgram && <span className="px-2 py-0.5 rounded-md bg-[var(--c-panel3)] border border-[rgba(var(--line-rgb),.18)] text-[var(--c-textMid)] text-[7px] font-black uppercase tracking-wider">Programme</span>}
                        {hasPlayers && <span className="px-2 py-0.5 rounded-md bg-[var(--c-panel3)] border border-[rgba(var(--line-rgb),.18)] text-[var(--c-textMid)] text-[7px] font-black uppercase tracking-wider">{s.players.length} joueurs</span>}
                        {hasStaff && <span className="px-2 py-0.5 rounded-md bg-[var(--c-panel3)] border border-[rgba(var(--line-rgb),.18)] text-[var(--c-textMid)] text-[7px] font-black uppercase tracking-wider">Staff</span>}
                        {hasReport && <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 text-[7px] font-black uppercase tracking-wider">Rapport</span>}
                        {hasPhotos && <span className="px-2 py-0.5 rounded-md bg-[#7ec3ff]/10 border border-[#7ec3ff]/30 text-[#7ec3ff] text-[7px] font-black uppercase tracking-wider">{s.images.length} photos</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {canManage && (
                        <>
                          <button onClick={(e) => { e.stopPropagation(); startEdit(s) }} title="Edit" className="p-2 rounded-xl border border-[rgba(var(--line-rgb),.2)] text-[var(--c-textDim)] hover:text-[#f6c744] hover:border-[#f6c744]/40 transition-all"><Pencil size={14}/></button>
                          <button onClick={(e) => { e.stopPropagation(); setDeleteTarget(s) }} title="Delete" className="p-2 rounded-xl border border-[rgba(var(--line-rgb),.2)] text-[var(--c-textDim)] hover:bg-[#E30613] hover:text-white transition-all"><Trash2 size={14}/></button>
                        </>
                      )}
                      <button onClick={() => s.id && openDetail(s)} className="px-4 py-2 rounded-xl bg-[#E30613] text-white text-[9px] font-black uppercase tracking-wider hover:bg-red-700 transition-all">Ouvrir</button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* ───────── Detail view ───────── */}
        {view === "detail" && editing && (
          <StageDetail stage={editing} members={members} canManage={canManage}
            onBack={() => setView("list")}
            onEdit={() => { setDraft(JSON.parse(JSON.stringify(editing))); setTab("program"); setView("edit") }}
            onRefresh={onRefresh} />
        )}

        {/* ───────── Edit view ───────── */}
        {view === "edit" && (
          <>
            <div className="flex gap-1 px-6 pt-4 shrink-0 flex-wrap">
              {([["program","Programme"],["players","Convocations"],["staff","Staff"],["report","Rapport PDF"],["photos","Photos"]] as [TabKey,string][]).map(([k,label]) => (
                <button key={k} onClick={() => setTab(k)} className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all ${tab===k?'bg-[#E30613] text-white shadow-md shadow-[#E30613]/25':'bg-[var(--c-panel3)] text-[var(--c-textMid)] border border-[rgba(var(--line-rgb),.16)] hover:text-[var(--c-text)]'}`}>{label}</button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {/* Basic info */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mb-5">
                <div className="sm:col-span-2">
                  <label className="block text-[8px] font-black uppercase tracking-widest text-[var(--c-textDim)] mb-1.5">Nom du stage *</label>
                  <input
                    value={draft.name}
                    onChange={e => setDraft({ ...draft, name: e.target.value })}
                    placeholder="ex: Stage de préparation — Mars"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--c-panel3)] border border-[rgba(var(--line-rgb),.22)] text-[var(--c-text)] placeholder-[var(--c-textFaint)] text-[11px] font-bold outline-none focus:border-[#E30613]/50 transition-all"/>
                </div>
                <div>
                  <label className="block text-[8px] font-black uppercase tracking-widest text-[var(--c-textDim)] mb-1.5">Lieu</label>
                  <input
                    value={draft.location}
                    onChange={e => setDraft({ ...draft, location: e.target.value })}
                    placeholder="ex: Tunis"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--c-panel3)] border border-[rgba(var(--line-rgb),.22)] text-[var(--c-text)] placeholder-[var(--c-textFaint)] text-[11px] font-bold outline-none focus:border-[#E30613]/50 transition-all"/>
                </div>
                <div>
                  <label className="block text-[8px] font-black uppercase tracking-widest text-[var(--c-textDim)] mb-1.5">Catégorie</label>
                  <select value={draft.teamCategory} onChange={e => setDraft({ ...draft, teamCategory: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--c-panel3)] border border-[rgba(var(--line-rgb),.22)] text-[var(--c-text)] text-[11px] font-bold outline-none focus:border-[#E30613]/50 transition-all">
                    {CATS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[8px] font-black uppercase tracking-widest text-[var(--c-textDim)] mb-1.5">Début</label>
                  <input type="date" value={draft.startDate} onChange={e => setDraft({ ...draft, startDate: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--c-panel3)] border border-[rgba(var(--line-rgb),.22)] text-[var(--c-text)] text-[11px] font-bold outline-none focus:border-[#E30613]/50 transition-all"/>
                </div>
                <div>
                  <label className="block text-[8px] font-black uppercase tracking-widest text-[var(--c-textDim)] mb-1.5">Fin</label>
                  <input type="date" value={draft.endDate} onChange={e => setDraft({ ...draft, endDate: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--c-panel3)] border border-[rgba(var(--line-rgb),.22)] text-[var(--c-text)] text-[11px] font-bold outline-none focus:border-[#E30613]/50 transition-all"/>
                </div>
              </div>

              {/* Programme */}
              {tab === "program" && (
                <ProgramTab draft={draft} setDraft={setDraft}/>
              )}

              {/* Convocations */}
              {tab === "players" && (
                <PlayersTab draft={draft} setDraft={setDraft} members={availablePlayers.length ? availablePlayers : allCandidates.filter(m => (m.role||'').toUpperCase()==='PLAYERS')}/>
              )}

              {/* Staff */}
              {tab === "staff" && (
                <StaffTab draft={draft} setDraft={setDraft} members={availableStaff.length ? availableStaff : allCandidates.filter(m => (m.role||'').toUpperCase()!=='PLAYERS')}/>
              )}

              {/* Rapport */}
              {tab === "report" && (
                <div>
                  <p className="text-[8px] font-black uppercase tracking-widest text-[var(--c-textDim)] mb-3">Rapport de fin de stage (PDF)</p>
                  <label className={`flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-8 cursor-pointer transition-all ${draft.reportUrl ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-[rgba(var(--line-rgb),.25)] bg-[var(--c-panel3)]/60 hover:border-[#E30613]/50'}`}>
                    <input type="file" accept=".pdf,application/pdf" className="hidden" onChange={onReportFile}/>
                    <FileText size={28} className={draft.reportUrl ? 'text-emerald-500' : 'text-[var(--c-textDim)]'}/>
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

              {/* Photos */}
              {tab === "photos" && (
                <div>
                  <p className="text-[8px] font-black uppercase tracking-widest text-[var(--c-textDim)] mb-3">Photos du stage</p>
                  <label className={`flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-6 cursor-pointer transition-all mb-4 ${'border-[rgba(var(--line-rgb),.25)] bg-[var(--c-panel3)]/60 hover:border-[#f6c744]/50'}`}>
                    <input type="file" accept="image/*" multiple className="hidden" onChange={onPhotos}/>
                    <ImageIcon size={24} className="text-[var(--c-textDim)]"/>
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

            {/* Footer */}
            <div className="px-6 py-4 border-t border-[rgba(var(--line-rgb),.14)] shrink-0 flex items-center justify-between gap-3">
              <p className="text-[8px] font-black uppercase tracking-wider text-[var(--c-textDim)]">{canSubmit ? "Prêt à enregistrer" : "Nom du stage requis"}</p>
              <div className="flex gap-2">
                <button onClick={() => setView("list")} className="px-5 py-2.5 rounded-xl border border-[rgba(var(--line-rgb),.2)] text-[var(--c-textDim)] hover:text-[var(--c-text)] text-[9px] font-black uppercase tracking-wider transition-all">Annuler</button>
                <button onClick={save} disabled={!canSubmit || busy} className="flex items-center gap-1.5 px-6 py-2.5 rounded-xl bg-[#E30613] text-white text-[9px] font-black uppercase tracking-wider hover:bg-red-700 transition-all disabled:opacity-40 shadow-lg shadow-[#E30613]/25">
                  <Save size={13}/> {busy ? 'Enregistrement…' : editing ? 'Enregistrer' : 'Créer le stage'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Delete confirm */}
      {deleteTarget && (
        <div className="fixed inset-0 z-[410] flex items-center justify-center bg-black/60 backdrop-blur-sm" onMouseDownCapture={(e) => e.stopPropagation()}>
          <div className="w-full max-w-sm rounded-2xl bg-[var(--c-surface)] border border-[rgba(var(--line-rgb),.18)] shadow-2xl p-6">
            <h3 className="text-sm font-black uppercase tracking-tight mb-2">Supprimer ce stage ?</h3>
            <p className="text-[10px] font-bold text-[var(--c-textDim)] mb-4">« {deleteTarget.name} » sera définitivement supprimé.</p>
            <div className="flex gap-2">
              <button onClick={() => setDeleteTarget(null)} className="flex-1 py-2.5 rounded-xl border border-[rgba(var(--line-rgb),.2)] text-[var(--c-textDim)] text-[9px] font-black uppercase tracking-wider transition-all">Annuler</button>
              <button onClick={async () => {
                if (deleteTarget.id && onDelete) await onDelete(deleteTarget.id)
                onRefresh?.()
                setDeleteTarget(null)
              }} className="flex-1 py-2.5 rounded-xl bg-[#E30613] text-white text-[9px] font-black uppercase tracking-wider hover:bg-red-700 transition-all">Supprimer</button>
            </div>
          </div>
        </div>
      )}
    </div>,
  document.body)
}

function StageDetail({ stage, members, canManage, onBack, onEdit }: {
  stage: Stage
  members: any[]
  canManage: boolean
  onBack: () => void
  onEdit: () => void
  onRefresh?: () => void
  onDelete?: () => void
}) {
  const [tab, setTab] = useState<TabKey>("program")
  const memberById = (id: number) => members.find(m => m.id === id)
  return (
    <>
      <div className="flex items-center justify-between px-6 pt-4 pb-2 shrink-0 flex-wrap gap-3">
        <div>
          <h3 className="text-base font-black uppercase tracking-tight text-[var(--c-text)]">{stage.name}</h3>
          <p className="flex items-center gap-2 mt-1 text-[9px] font-bold text-[var(--c-textDim)] flex-wrap">
            <span className="flex items-center gap-1"><MapPin size={10}/>{stage.location || "Lieu —"}</span>
            {stage.startDate && <span className="flex items-center gap-1"><Calendar size={10}/>{stage.startDate} → {stage.endDate}</span>}
            <span className="px-2 py-0.5 rounded-md bg-[#E30613]/12 border border-[#E30613]/30 text-[#ff5f72] text-[7px] font-black uppercase tracking-widest">{(CATS.find(c=>c.value===stage.teamCategory)||{}).label || stage.teamCategory}</span>
          </p>
        </div>
        <div className="flex gap-2">
          {canManage && <button onClick={onEdit} className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-[rgba(var(--line-rgb),.2)] text-[var(--c-textDim)] hover:text-[#f6c744] hover:border-[#f6c744]/40 text-[9px] font-black uppercase tracking-wider transition-all"><Pencil size={13}/> Modifier</button>}
          <button onClick={onBack} className="px-4 py-2 rounded-xl bg-[var(--c-panel3)] border border-[rgba(var(--line-rgb),.2)] text-[var(--c-textMid)] text-[9px] font-black uppercase tracking-wider hover:text-[var(--c-text)] transition-all flex items-center gap-1.5"><ArrowLeft size={13}/> Retour</button>
        </div>
      </div>
      <div className="flex gap-1 px-6 pt-1 shrink-0 flex-wrap">
        {([["program","Programme"],["players",`Joueurs (${(stage.players||[]).length})`],["staff",`Staff (${(stage.staff||[]).length})`],["report","Rapport"],["photos",`Photos (${(stage.images||[]).length})`]] as [TabKey,string][]).map(([k,label]) => (
          <button key={k} onClick={() => setTab(k)} className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all ${tab===k?'bg-[#E30613] text-white shadow-md shadow-[#E30613]/25':'bg-[var(--c-panel3)] text-[var(--c-textMid)] border border-[rgba(var(--line-rgb),.16)] hover:text-[var(--c-text)]'}`}>{label}</button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto p-6">
        {tab === "program" && (
          <div className="space-y-2">
            {(stage.program || []).length === 0 && <p className="text-[10px] font-bold text-[var(--c-textDim)]">Aucun programme enregistré.</p>}
            {(stage.program || []).map((p, i) => (
              <div key={i} className="flex items-start gap-3 rounded-xl border border-[rgba(var(--line-rgb),.14)] bg-[var(--c-panel3)]/50 p-3">
                <div className="min-w-[46px] text-center">
                  <p className="text-[10px] font-black text-[#f6c744]">{p.day || "—"}</p>
                  <p className="text-[8px] font-bold text-[var(--c-textDim)]">{p.time || ""}</p>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-black uppercase tracking-wide text-[var(--c-text)]">{p.activity || ""}</p>
                  {p.details && <p className="text-[9px] text-[var(--c-textDim)] mt-0.5">{p.details}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
        {tab === "players" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {(stage.players || []).length === 0 && <p className="text-[10px] font-bold text-[var(--c-textDim)] col-span-2">Aucune convocation.</p>}
            {(stage.players || []).map(id => {
              const m = memberById(id)
              return (
                <div key={id} className="flex items-center gap-2.5 rounded-xl border border-[rgba(var(--line-rgb),.14)] bg-[var(--c-panel3)]/50 p-2.5">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#f6c744]/25 to-[#E30613]/25 flex items-center justify-center text-[10px] font-black text-[#f6c744] uppercase shrink-0">{(m?.name||"?")[0]}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-black uppercase text-[var(--c-text)] truncate">{m?.name || `#${id}`}</p>
                    <p className="text-[8px] font-bold text-[var(--c-textDim)] uppercase">{m?.position || "—"}</p>
                  </div>
                  <span className="px-2 py-0.5 rounded-md bg-[var(--c-panel3)] border border-[rgba(var(--line-rgb),.16)] text-[var(--c-textMid)] text-[7px] font-black uppercase tracking-wider">CONVOQUÉ</span>
                </div>
              )
            })}
          </div>
        )}
        {tab === "staff" && (
          <div className="space-y-2">
            {(stage.staff || []).length === 0 && <p className="text-[10px] font-bold text-[var(--c-textDim)]">Aucun staff enregistré.</p>}
            {(stage.staff || []).map((id, idx) => {
              const m = memberById(id)
              const role = (stage.staffRoles || []).find(r => r.memberId === id)?.role
              return (
                <div key={`${id}-${idx}`} className="flex items-center gap-3 rounded-xl border border-[rgba(var(--line-rgb),.14)] bg-[var(--c-panel3)]/50 p-3">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#7ec3ff]/25 to-[#E30613]/25 flex items-center justify-center text-[10px] font-black text-[#7ec3ff] uppercase shrink-0">{(m?.name||"?")[0]}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-black uppercase text-[var(--c-text)] truncate">{m?.name || `#${id}`}</p>
                    {role && <p className="text-[8px] font-bold text-[#7ec3ff] uppercase tracking-wider">{role}</p>}
                  </div>
                  <Briefcase size={13} className="text-[var(--c-textDim)]"/>
                </div>
              )
            })}
          </div>
        )}
        {tab === "report" && (
          <div>
            {stage.reportUrl ? (
              <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-8 text-center">
                <FileText size={32} className="text-emerald-500"/>
                <p className="text-[11px] font-black uppercase tracking-wider text-[var(--c-text)]">{stage.reportName || "Rapport de stage"}</p>
                <a href={stage.reportUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 text-[9px] font-black uppercase tracking-wider hover:bg-emerald-500/15 transition-all">
                  <Download size={13}/> Ouvrir le rapport PDF
                </a>
              </div>
            ) : (
              <p className="text-[10px] font-bold text-[var(--c-textDim)] text-center py-10">Aucun rapport de fin de stage déposé.</p>
            )}
          </div>
        )}
        {tab === "photos" && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {(stage.images || []).length === 0 && <p className="text-[10px] font-bold text-[var(--c-textDim)] col-span-4 text-center py-10">Aucune photo du stage.</p>}
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
      {items.length === 0 && <p className="text-[10px] font-bold text-[var(--c-textDim)] py-6 text-center border border-dashed border-[rgba(var(--line-rgb),.2)] rounded-xl">Aucune séance — ajoutez la première.</p>}
      <div className="space-y-2">
        {items.map((p, i) => (
          <div key={i} className="grid grid-cols-[70px_90px_1fr_36px] gap-2 items-start rounded-xl border border-[rgba(var(--line-rgb),.14)] bg-[var(--c-panel3)]/40 p-2">
            <input value={p.day} onChange={e => upd(i, 'day', e.target.value)} placeholder="Jour" className="px-2.5 py-2 rounded-lg bg-[var(--c-panel3)] border border-[rgba(var(--line-rgb),.2)] text-[var(--c-text)] placeholder-[var(--c-textFaint)] text-[10px] font-bold outline-none focus:border-[#E30613]/50"/>
            <input value={p.time} onChange={e => upd(i, 'time', e.target.value)} placeholder="9h00" className="px-2.5 py-2 rounded-lg bg-[var(--c-panel3)] border border-[rgba(var(--line-rgb),.2)] text-[var(--c-text)] placeholder-[var(--c-textFaint)] text-[10px] font-bold outline-none focus:border-[#E30613]/50"/>
            <div className="space-y-1.5">
              <input value={p.activity} onChange={e => upd(i, 'activity', e.target.value)} placeholder="Activité (ex: Séance physique AM / Match amical)" className="w-full px-2.5 py-2 rounded-lg bg-[var(--c-panel3)] border border-[rgba(var(--line-rgb),.2)] text-[var(--c-text)] placeholder-[var(--c-textFaint)] text-[10px] font-bold outline-none focus:border-[#E30613]/50"/>
              <input value={p.details || ''} onChange={e => upd(i, 'details', e.target.value)} placeholder="Détails (optionnel)" className="w-full px-2.5 py-2 rounded-lg bg-[var(--c-panel3)] border border-[rgba(var(--line-rgb),.2)] text-[var(--c-text)] placeholder-[var(--c-textFaint)] text-[10px] font-bold outline-none focus:border-[#E30613]/50"/>
            </div>
            <button onClick={() => del(i)} className="p-2 rounded-lg text-[var(--c-textDim)] hover:bg-[#E30613] hover:text-white transition-all"><Trash2 size={13}/></button>
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
      <div className="flex items-center justify-between mb-3 gap-3">
        <p className="text-[8px] font-black uppercase tracking-widest text-[var(--c-textDim)]">{list.length} joueur(s) convoqué(s)</p>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Rechercher…" className="w-56 px-3.5 py-2 rounded-xl bg-[var(--c-panel3)] border border-[rgba(var(--line-rgb),.22)] text-[var(--c-text)] placeholder-[var(--c-textFaint)] text-[10px] font-bold outline-none focus:border-[#E30613]/50 transition-all"/>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {pool.map(m => (
          <button key={m.id} onClick={() => toggle(m.id)} className="flex items-center gap-2.5 rounded-xl border border-[rgba(var(--line-rgb),.14)] bg-[var(--c-panel3)]/40 p-2 text-left hover:border-[#f6c744]/40 hover:bg-[var(--c-panel3)]/70 transition-all">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#f6c744]/25 to-[#E30613]/25 flex items-center justify-center text-[10px] font-black text-[#f6c744] uppercase shrink-0">{(m.name||"?")[0]}</div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-black uppercase text-[var(--c-text)] truncate">{m.name}</p>
              <p className="text-[7px] font-bold text-[var(--c-textDim)] uppercase">{m.position || "—"}</p>
            </div>
            <span className="w-5 h-5 rounded-md border border-[rgba(var(--line-rgb),.25)] flex items-center justify-center text-[#f6c744]"><Plus size={10}/></span>
          </button>
        ))}
        {pool.length === 0 && <p className="col-span-full text-[10px] font-bold text-[var(--c-textDim)] text-center py-6 border border-dashed border-[rgba(var(--line-rgb),.2)] rounded-xl">Aucun joueur disponible.</p>}
      </div>
      {list.length > 0 && (
        <div className="mt-4">
          <p className="text-[8px] font-black uppercase tracking-widest text-[var(--c-textDim)] mb-2">Convoqués</p>
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
      <div className="flex items-center justify-between mb-3 gap-3">
        <p className="text-[8px] font-black uppercase tracking-widest text-[var(--c-textDim)]">{list.length} membre(s) du staff</p>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Rechercher…" className="w-56 px-3.5 py-2 rounded-xl bg-[var(--c-panel3)] border border-[rgba(var(--line-rgb),.22)] text-[var(--c-text)] placeholder-[var(--c-textFaint)] text-[10px] font-bold outline-none focus:border-[#E30613]/50 transition-all"/>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {pool.map(m => (
          <button key={m.id} onClick={() => toggle(m.id)} className="flex items-center gap-2.5 rounded-xl border border-[rgba(var(--line-rgb),.14)] bg-[var(--c-panel3)]/40 p-2 text-left hover:border-[#7ec3ff]/40 hover:bg-[var(--c-panel3)]/70 transition-all">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#7ec3ff]/25 to-[#E30613]/25 flex items-center justify-center text-[10px] font-black text-[#7ec3ff] uppercase shrink-0">{(m.name||"?")[0]}</div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-black uppercase text-[var(--c-text)] truncate">{m.name}</p>
              <p className="text-[7px] font-bold text-[var(--c-textDim)] uppercase">{m.role || "STAFF"}</p>
            </div>
            <span className="w-5 h-5 rounded-md border border-[rgba(var(--line-rgb),.25)] flex items-center justify-center text-[#7ec3ff]"><Plus size={10}/></span>
          </button>
        ))}
        {pool.length === 0 && <p className="col-span-full text-[10px] font-bold text-[var(--c-textDim)] text-center py-6 border border-dashed border-[rgba(var(--line-rgb),.2)] rounded-xl">Aucun staff disponible.</p>}
      </div>
      {list.length > 0 && (
        <div className="mt-4 space-y-2">
          <p className="text-[8px] font-black uppercase tracking-widest text-[var(--c-textDim)]">Staff affecté</p>
          {list.map(id => {
            const m = members.find(x => x.id === id)
            const roleVal = (draft.staffRoles || []).find(r => r.memberId === id)?.role || ""
            return (
              <div key={id} className="flex items-center gap-2.5 rounded-xl border border-[rgba(var(--line-rgb),.14)] bg-[var(--c-panel3)]/40 p-2.5">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#7ec3ff]/25 to-[#E30613]/25 flex items-center justify-center text-[10px] font-black text-[#7ec3ff] uppercase shrink-0">{(m?.name||"?")[0]}</div>
                <p className="flex-1 text-[10px] font-black uppercase text-[var(--c-text)] truncate">{m?.name || `#${id}`}</p>
                <input value={roleVal} onChange={e => setRole(id, e.target.value)} placeholder="Rôle (ex: Sélectionneur, Kiné…)" className="w-44 px-2.5 py-1.5 rounded-lg bg-[var(--c-panel3)] border border-[rgba(var(--line-rgb),.2)] text-[var(--c-text)] placeholder-[var(--c-textFaint)] text-[9px] font-bold outline-none focus:border-[#7ec3ff]/50"/>
                <button onClick={() => toggle(id)} className="p-1.5 rounded-lg text-[var(--c-textDim)] hover:bg-[#E30613] hover:text-white transition-all"><X size={12}/></button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}