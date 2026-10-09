"use client"
import React, { useMemo, useState } from "react"
import { ChevronLeft, ClipboardCheck, Trash2, AlertTriangle } from "lucide-react"

type Report = {
  id: number
  member_id: number
  match_date?: string | null
  opponent?: string | null
  competition?: string | null
  result?: string | null
  minutes_played?: number | null
  goals?: number | null
  assists?: number | null
  position_played?: string | null
  is_starting?: boolean | null
  did_not_play?: boolean
  rating?: number | null
  had_injury?: boolean | null
  injury_notes?: string | null
  highlights_url?: string | null
  verified?: boolean
  verified_by_username?: string | null
  notes?: string | null
}

type Props = {
  open: boolean
  onClose: () => void
  reports: Report[]
  members: any[]
  teamCat: string | null
  canVerify: boolean
  canDelete: boolean
  onVerify: (id: number, verified: boolean) => Promise<{ error?: string | null }>
  onDelete: (id: number) => Promise<void>
  onSelectPlayer: (memberId: number) => void
  tr: any
}

const CATS = ["SENIORS", "U20", "U17"] as const

export function ClubReportsPanel({ open, onClose, reports, members, teamCat, canVerify, canDelete, onVerify, onDelete, onSelectPlayer, tr }: Props) {
  const [catFilter, setCatFilter] = useState<string>(teamCat || "ALL")
  const [statusFilter, setStatusFilter] = useState<"ALL" | "VERIFIED" | "UNVERIFIED">("ALL")

  if (!open) return null

  const byId = new Map(members.map(m => [m.id, m]))

  const enriched = reports
    .map(r => ({ r, member: byId.get(r.member_id) }))
    .filter(x => !!x.member)
    .filter(x => catFilter === "ALL" || x.member.teamCategory === catFilter)
    .filter(x => statusFilter === "ALL" || (statusFilter === "VERIFIED" ? x.r.verified : !x.r.verified))
    .sort((a, b) => (b.r.match_date || "").localeCompare(a.r.match_date || ""))

  const unverifiedCount = reports.filter(r => !r.verified).length

  return (
    <div className="min-h-screen flex flex-col">
      <div className="sticky top-0 z-[100] border-b border-[rgba(var(--line-rgb),.12)] bg-[var(--c-bg)]">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center gap-3">
          <button onClick={onClose} className="p-2 rounded-xl border border-[rgba(var(--line-rgb),.2)] text-[var(--c-textDim)] hover:text-[var(--c-text)] hover:bg-[var(--c-panel3)]/60 transition-all shrink-0">
            <ChevronLeft size={17}/>
          </button>
          <div className="leading-tight min-w-0">
            <h1 className="text-sm font-black italic uppercase tracking-wider text-[var(--c-text)] truncate">{tr.clubReportsPage.title}</h1>
            <p className="text-[8px] font-black text-[#7ec3ff] uppercase tracking-[0.3em]">{tr.clubReportsPage.subtitle}</p>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 pb-20 w-full">
        <div className="mt-6 flex items-center gap-3 flex-wrap">
          <div className="flex p-1 rounded-xl bg-zinc-100 border border-zinc-200">
            {(["ALL", ...CATS] as string[]).map(c => (
              <button key={c} onClick={() => setCatFilter(c)} className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${catFilter === c ? "bg-[#E30613] text-white" : "text-zinc-500 hover:text-zinc-800"}`}>
                {c === "ALL" ? tr.clubReportsPage.allCategories : c === "U20" ? tr.header.u20 : c === "U17" ? tr.header.u17 : tr.header.seniors}
              </button>
            ))}
          </div>
          <div className="w-px h-6 bg-zinc-200"/>
          <div className="flex p-1 rounded-xl bg-zinc-100 border border-zinc-200">
            {(["ALL", "UNVERIFIED", "VERIFIED"] as const).map(s => (
              <button key={s} onClick={() => setStatusFilter(s)} className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all flex items-center gap-1.5 ${statusFilter === s ? "bg-[#E30613] text-white" : "text-zinc-500 hover:text-zinc-800"}`}>
                {s === "UNVERIFIED" && <span className="w-1.5 h-1.5 rounded-full bg-[#ff4f66] inline-block"/>}
                {s === "VERIFIED" && <span className="w-1.5 h-1.5 rounded-full bg-[#2fd46b] inline-block"/>}
                {s === "ALL" ? tr.clubReportsPage.allStatus : s === "UNVERIFIED" ? tr.clubReportsPage.unverified : tr.clubReportsPage.verified}
              </button>
            ))}
          </div>
          {unverifiedCount > 0 && (
            <span className="text-[9px] font-black uppercase tracking-wider text-[#ff4f66]">{unverifiedCount} {tr.clubReportsPage.toReview}</span>
          )}
        </div>

        {enriched.length === 0 && (
          <div className="mt-8 flex flex-col items-center justify-center py-20 gap-4 rounded-3xl border-2 border-dashed border-[rgba(var(--line-rgb),.18)] text-center">
            <ClipboardCheck size={28} className="text-[var(--c-textDim)]"/>
            <p className="text-[10px] font-black uppercase tracking-widest text-[var(--c-textDim)]">{tr.clubReportsPage.none}</p>
          </div>
        )}

        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {enriched.map(({ r, member }) => (
            <div key={r.id} className="rounded-2xl border border-[rgba(var(--line-rgb),.14)] bg-[var(--c-panel2)]/50 p-4">
              <div className="flex items-start justify-between gap-2">
                <button onClick={() => onSelectPlayer(member.id)} className="min-w-0 text-left">
                  <p className="text-[13px] font-black text-[var(--c-text)] truncate hover:underline">{member.name}</p>
                  <p className="text-[10px] font-bold text-[var(--c-textDim)] mt-0.5">{r.opponent || tr.clubReports.unknownOpponent}{r.match_date ? ` · ${r.match_date}` : ""}{r.competition ? ` · ${r.competition}` : ""}</p>
                </button>
                <span title={r.verified ? `${tr.clubReports.verified}${r.verified_by_username ? ` · ${r.verified_by_username}` : ""}` : tr.clubReportsPage.unverified} className={`shrink-0 w-2.5 h-2.5 rounded-full mt-1 ${r.verified ? "bg-[#2fd46b] shadow-[0_0_8px_rgba(47,212,107,.6)]" : "bg-[#ff4f66] shadow-[0_0_8px_rgba(255,79,102,.5)]"}`}/>
              </div>
              {r.did_not_play ? (
                <p className="mt-2 text-[11px] font-bold text-[var(--c-textDim)] italic">{tr.clubReports.didNotPlay}</p>
              ) : (
                <div className="flex flex-wrap gap-2.5 mt-2 text-[11px] font-bold text-[var(--c-textMid)]">
                  {r.position_played && <span>{r.position_played}</span>}
                  <span>{r.minutes_played ?? 0}&apos; {tr.clubReports.mins}</span>
                  <span className="text-[#7fd6a8]">{r.goals || 0} {tr.clubReports.goals}</span>
                  <span className="text-[#7ec3ff]">{r.assists || 0} {tr.clubReports.assists}</span>
                  {typeof r.rating === "number" && <span className="text-[#c89a1e]">{r.rating}/10</span>}
                </div>
              )}
              {r.had_injury && (
                <div className="mt-2 rounded-lg border border-[#ff4f66]/30 bg-[#ff4f66]/10 px-2 py-1 flex items-start gap-1.5">
                  <AlertTriangle size={11} className="text-[#ff4f66] shrink-0 mt-0.5"/>
                  <p className="text-[10px] font-bold text-[#ff4f66]">{tr.clubReports.injuryFlag}</p>
                </div>
              )}
              <div className="flex items-center gap-3 mt-3">
                {canVerify && (
                  <button onClick={async () => { const res = await onVerify(r.id, !r.verified); if (res.error) alert(res.error) }} className="text-[10px] font-black uppercase tracking-wider text-[#7fd6a8] hover:underline">
                    {r.verified ? tr.clubReports.unverify : tr.clubReports.verify}
                  </button>
                )}
                {canDelete && (
                  <button onClick={() => onDelete(r.id)} className="text-[10px] font-black uppercase tracking-wider text-[#ff4f66] hover:underline flex items-center gap-1"><Trash2 size={11}/>{tr.common.remove}</button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
