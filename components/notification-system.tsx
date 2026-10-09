"use client"
import React, { useState, useMemo } from "react"
import { Bell, Ban, AlertTriangle, Calendar, UserPlus, ClipboardCheck, X, ChevronRight } from "lucide-react"
import { useTranslate } from "@/lib/language-context"

type Notification = {
  id: string
  type: "suspension" | "warning" | "upcoming" | "approval" | "clubReport"
  message: string
  playerId?: number
  matchId?: number
}

type PendingUser = { username: string; firstName: string; lastName: string }

type Props = {
  members: any[]
  matches: any[]
  teamCat: string | null
  onSelectMember: (m: any) => void
  pendingUsers?: PendingUser[]
  canManageUsers?: boolean
  onOpenApprovals?: () => void
  // Unverified club-match reports to surface to staff who can review them
  // (same set of people who can actually hit "Verify" on the Club tab).
  clubReports?: { id: number; member_id: number; verified?: boolean }[]
  canReviewClubReports?: boolean
  onOpenClubReport?: (memberId: number) => void
}

export function NotificationBell({ members, matches, teamCat, onSelectMember, pendingUsers = [], canManageUsers = false, onOpenApprovals, clubReports = [], canReviewClubReports = false, onOpenClubReport }: Props) {
  const { tr } = useTranslate()
  const [open, setOpen] = useState(false)
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set()
    try {
      const raw = localStorage.getItem("esq-dismissed-notifications")
      return raw ? new Set(JSON.parse(raw)) : new Set()
    } catch { return new Set() }
  })
  const dismiss = (id: string) => {
    setDismissedIds(prev => {
      const next = new Set(prev)
      next.add(id)
      try { localStorage.setItem("esq-dismissed-notifications", JSON.stringify([...next])) } catch {}
      return next
    })
  }

  const notifications = useMemo(() => {
    const n: Notification[] = []

    // Account approvals are admin-only and not tied to a team category, so they
    // always show regardless of which category is currently selected.
    if (canManageUsers) {
      pendingUsers.forEach(u => {
        n.push({ id: `approval-${u.username}`, type: "approval", message: `${u.firstName} ${u.lastName} — ${tr.notifications.pendingApproval}` })
      })
    }

    const catPlayers = members.filter(m => m.role === "PLAYERS" && m.teamCategory === teamCat)

    catPlayers.forEach(p => {
      const yc = p.yellowCards || 0
      if (p.suspended || (p.redCards || 0) > 0 || yc >= 2) {
        n.push({ id: `s-${p.id}`, type: "suspension", message: `${p.name} — ${tr.profile.suspended}`, playerId: p.id })
      } else if (yc === 1) {
        n.push({ id: `w-${p.id}`, type: "warning", message: `${p.name} — ${tr.notifications.oneYellowAway}`, playerId: p.id })
      }
    })

    const catMatches = matches.filter(m => m.teamCategory === teamCat)
    catMatches.forEach(m => {
      if (!m.result) {
        n.push({ id: `m-${m.id}`, type: "upcoming", message: `vs ${m.opponent} (${m.date || tr.notifications.tbd}) — ${tr.notifications.noResult}`, matchId: m.id })
      }
    })

    if (canReviewClubReports) {
      const catPlayerIds = new Set(catPlayers.map(p => p.id))
      clubReports.filter(r => !r.verified && catPlayerIds.has(r.member_id)).forEach(r => {
        const player = catPlayers.find(p => p.id === r.member_id)
        if (player) n.push({ id: `cr-${r.id}`, type: "clubReport", message: `${player.name} — ${tr.notifications.clubReportSubmitted}`, playerId: player.id })
      })
    }

    return n
  }, [members, matches, teamCat, pendingUsers, canManageUsers, clubReports, canReviewClubReports, tr])

  const visibleNotifications = notifications.filter(n => !dismissedIds.has(n.id))

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-lg border border-[rgba(148,170,210,.28)] bg-[#0d1f3c]/70 backdrop-blur-md text-[#cdc2b0] hover:text-[#f6c744] hover:border-[rgba(246,199,68,.55)] transition-all"
      >
        <Bell size={16} />
        {visibleNotifications.length > 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-[#E30613] text-white rounded-full text-[7px] font-black flex items-center justify-center shadow-lg">
            {visibleNotifications.length > 9 ? "9+" : visibleNotifications.length}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-[180]" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-12 z-[190] w-80 rounded-2xl border border-zinc-200 bg-white shadow-2xl overflow-hidden text-zinc-900">
            <div className="px-4 py-3 border-b border-zinc-200 flex items-center justify-between">
              <h3 className="text-[9px] font-black uppercase tracking-widest">{tr.notifications.title}</h3>
              <span className={`text-[8px] font-black px-2 py-0.5 rounded-lg ${visibleNotifications.length > 0 ? 'bg-[#E30613]/10 text-[#E30613]' : 'bg-zinc-500/10 text-zinc-500'}`}>
                {visibleNotifications.length}
              </span>
            </div>
            <div className="max-h-64 overflow-y-auto divide-y divide-zinc-200">
              {visibleNotifications.length === 0 && (
                <div className="p-6 text-center text-[10px] font-black uppercase tracking-widest opacity-40">{tr.notifications.allClear}</div>
              )}
              {visibleNotifications.map(n => (
                <button
                  key={n.id}
                  onClick={() => {
                    if (n.type === "approval") {
                      // Not dismissed here: it should only disappear once the
                      // account is actually approved or removed, not just viewed.
                      onOpenApprovals?.()
                      setOpen(false)
                      return
                    }
                    if (n.type === "clubReport") {
                      // Also not dismissed: stays until the report is actually
                      // verified, same reasoning as approvals above.
                      if (n.playerId) onOpenClubReport?.(n.playerId)
                      setOpen(false)
                      return
                    }
                    if (n.playerId) {
                      const m = members.find(x => x.id === n.playerId)
                      if (m) onSelectMember(m)
                    }
                    dismiss(n.id)
                    setOpen(false)
                  }}
                  className="w-full text-left px-4 py-3 flex items-center gap-3 transition-all hover:bg-zinc-50"
                >
                  <div className={`p-2 rounded-xl shrink-0 ${n.type === 'suspension' ? 'bg-red-600/10 text-red-500' : n.type === 'warning' ? 'bg-yellow-400/10 text-yellow-500' : n.type === 'approval' ? 'bg-emerald-500/10 text-emerald-600' : n.type === 'clubReport' ? 'bg-cyan-500/10 text-cyan-600' : 'bg-blue-500/10 text-blue-500'}`}>
                    {n.type === 'suspension' ? <Ban size={12} /> : n.type === 'warning' ? <AlertTriangle size={12} /> : n.type === 'approval' ? <UserPlus size={12} /> : n.type === 'clubReport' ? <ClipboardCheck size={12} /> : <Calendar size={12} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[9px] font-black uppercase truncate">{n.message}</p>
                    <p className="text-[7px] uppercase mt-0.5 text-zinc-400">
                      {n.type === 'suspension' ? tr.notifications.cannotPlayNext : n.type === 'warning' ? tr.notifications.cafRule2Yellows : n.type === 'approval' ? tr.notifications.tapToReview : n.type === 'clubReport' ? tr.notifications.tapToReviewReport : tr.notifications.upcomingMatch}
                    </p>
                  </div>
                  <ChevronRight size={12} className="opacity-30 shrink-0" />
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
