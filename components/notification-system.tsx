"use client"
import React, { useState, useMemo } from "react"
import { Bell, Ban, AlertTriangle, Calendar, X, ChevronRight } from "lucide-react"

type Notification = {
  id: string
  type: "suspension" | "warning" | "upcoming"
  message: string
  playerId?: number
  matchId?: number
}

type Props = {
  members: any[]
  matches: any[]
  teamCat: string | null
  onSelectMember: (m: any) => void
}

export function NotificationBell({ members, matches, teamCat, onSelectMember }: Props) {
  const [open, setOpen] = useState(false)

  const notifications = useMemo(() => {
    const n: Notification[] = []
    const catPlayers = members.filter(m => m.role === "PLAYERS" && m.teamCategory === teamCat)

    catPlayers.forEach(p => {
      const yc = p.yellowCards || 0
      if (p.suspended || (p.redCards || 0) > 0 || yc >= 2) {
        n.push({ id: `s-${p.id}`, type: "suspension", message: `${p.name} — SUSPENDED`, playerId: p.id })
      } else if (yc === 1) {
        n.push({ id: `w-${p.id}`, type: "warning", message: `${p.name} — 1 yellow away from ban`, playerId: p.id })
      }
    })

    const catMatches = matches.filter(m => m.teamCategory === teamCat)
    catMatches.forEach(m => {
      if (!m.result) {
        n.push({ id: `m-${m.id}`, type: "upcoming", message: `vs ${m.opponent} (${m.date || "TBD"}) — no result`, matchId: m.id })
      }
    })

    return n
  }, [members, matches, teamCat])

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-xl border border-zinc-300 bg-white text-zinc-500 hover:text-zinc-900 transition-all"
      >
        <Bell size={16} />
        {notifications.length > 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-[#E30613] text-white rounded-full text-[7px] font-black flex items-center justify-center shadow-lg">
            {notifications.length > 9 ? "9+" : notifications.length}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-[180]" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-12 z-[190] w-80 rounded-2xl border border-zinc-200 bg-white shadow-2xl overflow-hidden text-zinc-900">
            <div className="px-4 py-3 border-b border-zinc-200 flex items-center justify-between">
              <h3 className="text-[9px] font-black uppercase tracking-widest">Notifications</h3>
              <span className={`text-[8px] font-black px-2 py-0.5 rounded-lg ${notifications.length > 0 ? 'bg-[#E30613]/10 text-[#E30613]' : 'bg-zinc-500/10 text-zinc-500'}`}>
                {notifications.length}
              </span>
            </div>
            <div className="max-h-64 overflow-y-auto divide-y divide-zinc-200">
              {notifications.length === 0 && (
                <div className="p-6 text-center text-[10px] font-black uppercase tracking-widest opacity-40">All clear</div>
              )}
              {notifications.map(n => (
                <button
                  key={n.id}
                  onClick={() => {
                    if (n.playerId) {
                      const m = members.find(x => x.id === n.playerId)
                      if (m) onSelectMember(m)
                    }
                    setOpen(false)
                  }}
                  className="w-full text-left px-4 py-3 flex items-center gap-3 transition-all hover:bg-zinc-50"
                >
                  <div className={`p-2 rounded-xl shrink-0 ${n.type === 'suspension' ? 'bg-red-600/10 text-red-500' : n.type === 'warning' ? 'bg-yellow-400/10 text-yellow-500' : 'bg-blue-500/10 text-blue-500'}`}>
                    {n.type === 'suspension' ? <Ban size={12} /> : n.type === 'warning' ? <AlertTriangle size={12} /> : <Calendar size={12} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[9px] font-black uppercase truncate">{n.message}</p>
                    <p className="text-[7px] uppercase mt-0.5 text-zinc-400">
                      {n.type === 'suspension' ? 'Cannot play next match' : n.type === 'warning' ? 'CAF rule: 2 yellows = ban' : 'Upcoming match'}
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
