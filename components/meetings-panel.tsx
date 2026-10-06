"use client"
import React, { useState } from "react"
import { ChevronLeft, Plus, Video, Calendar, Clock, Trash2, ExternalLink, RefreshCw, Check } from "lucide-react"
import { DatePicker, Select } from "@/components/pickers"

type Meeting = {
  id: number
  title: string
  team_category: string | null
  scheduled_at: string
  status: string
  join_url: string | null
  recording_url: string | null
  created_by_username: string | null
}

type Props = {
  open: boolean
  onClose: () => void
  meetings: Meeting[]
  canManage: boolean
  teamCat: string | null
  onSchedule: (payload: { title: string; scheduledAt: string; teamCategory?: string | null }) => Promise<{ error?: string }>
  onDelete: (id: number) => Promise<void>
  onCheckRecording: (id: number) => Promise<{ recordingUrl?: string | null; error?: string; message?: string }>
  tr: any
}

const CATS = [
  { value: "SENIORS", label: "Seniors" },
  { value: "U20", label: "U-20" },
  { value: "U17", label: "U-17" },
]

export function MeetingsPanel({ open, onClose, meetings, canManage, teamCat, onSchedule, onDelete, onCheckRecording, tr }: Props) {
  const [formOpen, setFormOpen] = useState(false)
  const [title, setTitle] = useState("")
  const [date, setDate] = useState("")
  const [time, setTime] = useState("10:00")
  const [cat, setCat] = useState(teamCat || "SENIORS")
  const [busy, setBusy] = useState(false)
  const [checking, setChecking] = useState<number | null>(null)
  const [err, setErr] = useState<string | null>(null)

  if (!open) return null

  const now = new Date()
  const sorted = [...meetings].sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at))
  const upcoming = sorted.filter(m => new Date(m.scheduled_at) >= now)
  const past = sorted.filter(m => new Date(m.scheduled_at) < now).reverse()

  const submit = async () => {
    if (!title.trim() || !date) { setErr(tr.meetings.needTitleDate); return }
    setBusy(true); setErr(null)
    const scheduledAt = new Date(`${date}T${time || "00:00"}:00`).toISOString()
    const res = await onSchedule({ title: title.trim(), scheduledAt, teamCategory: cat })
    setBusy(false)
    if (res.error) { setErr(res.error); return }
    setFormOpen(false); setTitle(""); setDate("")
  }

  const checkRecording = async (id: number) => {
    setChecking(id)
    const res = await onCheckRecording(id)
    setChecking(null)
    if (res.error) alert(res.error)
    else if (!res.recordingUrl) alert(tr.meetings.noRecordingYet)
  }

  const Row = ({ m }: { m: Meeting }) => {
    const d = new Date(m.scheduled_at)
    return (
      <div className="rounded-2xl border border-[rgba(var(--line-rgb),.14)] bg-[var(--c-panel2)]/50 p-4 flex flex-col gap-2.5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[12px] font-black uppercase tracking-tight text-[var(--c-text)] truncate">{m.title}</p>
            <p className="mt-1 flex items-center gap-2 text-[9px] font-bold text-[var(--c-textDim)]">
              <Calendar size={11}/>{d.toLocaleDateString()} <Clock size={11}/>{d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              {m.team_category && <span className="px-1.5 py-0.5 rounded bg-[var(--c-panel3)] text-[7px] font-black uppercase tracking-wider">{m.team_category}</span>}
            </p>
            {m.created_by_username && <p className="mt-1 text-[8px] font-bold text-[var(--c-textFaint)] uppercase tracking-wider">{tr.meetings.scheduledBy} {m.created_by_username}</p>}
          </div>
          {canManage && (
            <button onClick={() => onDelete(m.id)} className="shrink-0 p-1.5 rounded-lg text-[var(--c-textDim)] hover:bg-[#E30613] hover:text-white transition-all"><Trash2 size={13}/></button>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {m.join_url && (
            <a href={m.join_url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#2d8cff]/12 border border-[#2d8cff]/35 text-[#2d8cff] text-[8px] font-black uppercase tracking-wider hover:bg-[#2d8cff]/20 transition-all">
              <ExternalLink size={11}/> {tr.meetings.join}
            </a>
          )}
          {m.recording_url ? (
            <a href={m.recording_url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/12 border border-emerald-500/35 text-emerald-500 text-[8px] font-black uppercase tracking-wider hover:bg-emerald-500/20 transition-all">
              <Check size={11}/> {tr.meetings.recordingReady}
            </a>
          ) : canManage && (
            <button onClick={() => checkRecording(m.id)} disabled={checking === m.id} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[rgba(var(--line-rgb),.2)] text-[var(--c-textDim)] text-[8px] font-black uppercase tracking-wider hover:text-[var(--c-text)] transition-all disabled:opacity-40">
              <RefreshCw size={11} className={checking === m.id ? "animate-spin" : ""}/> {tr.meetings.checkRecording}
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col">
      <div className="sticky top-0 z-[100] border-b border-[rgba(var(--line-rgb),.12)] bg-[var(--c-bg)]">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center gap-3">
          <button onClick={onClose} className="p-2 rounded-xl border border-[rgba(var(--line-rgb),.2)] text-[var(--c-textDim)] hover:text-[var(--c-text)] hover:bg-[var(--c-panel3)]/60 transition-all shrink-0">
            <ChevronLeft size={17}/>
          </button>
          <div className="leading-tight min-w-0">
            <h1 className="text-sm font-black italic uppercase tracking-wider text-[var(--c-text)] truncate">{tr.meetings.title}</h1>
            <p className="text-[8px] font-black text-[#2d8cff] uppercase tracking-[0.3em]">{tr.meetings.subtitle}</p>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 pb-20 w-full">
        {canManage && (
          <button onClick={() => setFormOpen(v => !v)} className="mt-6 w-full flex items-center justify-center gap-3 py-5 px-6 rounded-2xl bg-gradient-to-r from-[#1a5fc4] via-[#2d8cff] to-[#5fb0ff] text-white text-[11px] font-black uppercase tracking-widest shadow-xl shadow-[#2d8cff]/25 hover:shadow-[#2d8cff]/45 transition-all">
            <Plus size={16} strokeWidth={3}/> {tr.meetings.schedule}
          </button>
        )}

        {formOpen && (
          <div className="mt-4 rounded-2xl border border-[rgba(var(--line-rgb),.16)] bg-[var(--c-panel2)]/60 p-5 space-y-3">
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder={tr.meetings.titleLabel}
              className="w-full px-4 py-3 rounded-xl bg-[var(--c-panel3)] border border-[rgba(var(--line-rgb),.22)] text-[var(--c-text)] placeholder-[var(--c-textFaint)] text-[11px] font-bold outline-none focus:border-[#2d8cff]/50 transition-all"/>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <DatePicker variant="stage" value={date} onChange={setDate} placeholder={tr.meetings.dateLabel}/>
              <input type="time" value={time} onChange={e => setTime(e.target.value)}
                className="px-4 py-3 rounded-xl bg-[var(--c-panel3)] border border-[rgba(var(--line-rgb),.22)] text-[var(--c-text)] text-[11px] font-bold outline-none focus:border-[#2d8cff]/50 transition-all"/>
              <Select variant="stage" allowEmpty={false} value={cat} onChange={setCat} options={CATS}/>
            </div>
            {err && <p className="text-[9px] font-bold text-[#ff4f66]">{err}</p>}
            <div className="flex justify-end gap-2">
              <button onClick={() => setFormOpen(false)} className="px-5 py-2.5 rounded-xl border border-[rgba(var(--line-rgb),.2)] text-[var(--c-textDim)] text-[9px] font-black uppercase tracking-wider">{tr.common.cancel}</button>
              <button onClick={submit} disabled={busy} className="px-6 py-2.5 rounded-xl bg-[#2d8cff] text-white text-[9px] font-black uppercase tracking-wider disabled:opacity-40">{busy ? "…" : tr.common.save}</button>
            </div>
          </div>
        )}

        {meetings.length === 0 && !formOpen && (
          <div className="mt-8 flex flex-col items-center justify-center py-20 gap-4 rounded-3xl border-2 border-dashed border-[rgba(var(--line-rgb),.18)] text-center">
            <Video size={28} className="text-[var(--c-textDim)]"/>
            <p className="text-[10px] font-black uppercase tracking-widest text-[var(--c-textDim)]">{tr.meetings.none}</p>
          </div>
        )}

        {upcoming.length > 0 && (
          <div className="mt-8">
            <p className="text-[8px] font-black uppercase tracking-[0.25em] text-[var(--c-textDim)] mb-3">{tr.meetings.upcoming}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{upcoming.map(m => <Row key={m.id} m={m}/>)}</div>
          </div>
        )}
        {past.length > 0 && (
          <div className="mt-8">
            <p className="text-[8px] font-black uppercase tracking-[0.25em] text-[var(--c-textDim)] mb-3">{tr.meetings.past}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{past.map(m => <Row key={m.id} m={m}/>)}</div>
          </div>
        )}
      </div>
    </div>
  )
}
