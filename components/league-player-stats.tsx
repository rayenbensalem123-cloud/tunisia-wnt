'use client'
// Player statistics for a season: the two leaderboards a league table alone
// cannot answer (who scored, who assisted), plus an admin editor.
//
// Fixtures record only a match's score, so these numbers are entered by an admin
// rather than derived. Everything the page shows therefore carries an "entered by
// an admin" note — it is not computed from the results.
import { useEffect, useMemo, useState } from 'react'
import { useTranslate } from '@/lib/language-context'
import {
  deleteLeaguePlayerStat,
  fetchLeaguePlayerStats,
  fetchLeagueSeasons,
  saveLeaguePlayerStat,
  type LeaguePlayerStat,
} from '@/lib/app-data'
import { NumberField } from '@/components/league-pickers'
import { ClubMark } from '@/components/league-ui'
import type { LeagueTeam } from '@/lib/app-data'

type Props = {
  teams: LeagueTeam[]
  logoUrl: (x: LeagueTeam | null) => string
  /** Players eligible for a line, for the admin editor. */
  players: { id: number; name: string; teamId: number | null }[]
  admin: boolean
  myTeamId: number | null
}

type Key = 'goals' | 'assists'

const MEDALS = [
  'bg-gradient-to-br from-[#fff3c4] via-[#f6c744] to-[#d9a916] text-[#1a1408] shadow-[0_0_12px_rgba(246,199,68,.35)]',
  'bg-zinc-200 text-zinc-600',
  'bg-[#f0d2b8] text-[#7c4a20]',
]

export function LeaguePlayerStats({ teams, logoUrl, players, admin, myTeamId }: Props) {
  const { tr } = useTranslate()
  const t = tr.league

  const [seasonId, setSeasonId] = useState<number | null>(null)
  const [rows, setRows] = useState<LeaguePlayerStat[]>([])
  const [loading, setLoading] = useState(false)
  const [key, setKey] = useState<Key>('goals')
  const [editing, setEditing] = useState<number | null>(null)
  const [draft, setDraft] = useState({ appearances: 0, goals: 0, assists: 0, yellows: 0, reds: 0 })
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')

  const byId = useMemo(() => new Map(teams.map((x) => [x.id, x])), [teams])

  // Stats belong to a season, so resolve the same one the rest of the league page
  // shows: the current season, else the newest one.
  useEffect(() => {
    let alive = true
    fetchLeagueSeasons().then((seasons) => {
      if (!alive) return
      setSeasonId((seasons.find((s) => s.isCurrent) ?? seasons[0])?.id ?? null)
    })
    return () => { alive = false }
  }, [])

  // Load on season change. A club account and an admin both have read access.
  useEffect(() => {
    if (seasonId == null) { setRows([]); setLoading(false); return }
    let live = true
    setLoading(true)
    fetchLeaguePlayerStats(seasonId)
      .then((d) => { if (live) setRows(d) })
      .finally(() => { if (live) setLoading(false) })
    return () => { live = false }
  }, [seasonId])

  const board = useMemo(() => {
    // Rows with nothing in the chosen column sink to the bottom rather than
    // padding the table with zeroes.
    const withStat = rows.filter((r) => r[key] > 0)
    const rest = rows.filter((r) => r[key] === 0)
      .sort((a, b) => (b.goals - a.goals) || (b.assists - a.assists) || a.name.localeCompare(b.name))
    return { top: withStat.sort((a, b) => (b[key] - a[key]) || (b.goals - a.goals) || a.name.localeCompare(b.name)), rest }
  }, [rows, key])

  const startEdit = (memberId: number) => {
    const r = rows.find((x) => x.memberId === memberId)
    setDraft({
      appearances: r?.appearances ?? 0, goals: r?.goals ?? 0, assists: r?.assists ?? 0,
      yellows: r?.yellows ?? 0, reds: r?.reds ?? 0,
    })
    setEditing(memberId)
  }

  const save = async (memberId: number) => {
    if (seasonId == null) return
    if (Object.values(draft).some((v) => v < 0 || !Number.isFinite(v))) { setNote(t.statRange); return }
    setBusy(true)
    const { error } = await saveLeaguePlayerStat({ seasonId, memberId, ...draft })
    setBusy(false)
    if (error) { setNote(t.errGeneric); return }
    setEditing(null)
    setNote(t.statsSaved)
    setTimeout(() => setNote(''), 2500)
    // The list is ordered by the stats just changed, so re-read rather than patch.
    setRows(await fetchLeaguePlayerStats(seasonId))
  }

  const clear = async (memberId: number) => {
    if (seasonId == null) return
    setBusy(true)
    await deleteLeaguePlayerStat(seasonId, memberId)
    setBusy(false)
    setEditing(null)
    setRows(await fetchLeaguePlayerStats(seasonId))
  }

  if (seasonId == null) {
    return <p className="py-16 text-center text-sm text-[var(--c-textMid)]">{t.noSeasonsClub}</p>
  }

  const num = 'w-full rounded-lg border border-[rgba(var(--line-rgb),.25)] bg-[var(--c-bg)] px-2 py-1.5 text-center text-sm font-bold text-[var(--c-text)]'

  return (
    <div className="space-y-4">
      {/* Switch between the two leaderboards */}
      <div className="flex items-center gap-2">
        {(['goals', 'assists'] as const).map((k) => (
          <button key={k} onClick={() => setKey(k)} aria-pressed={key === k}
            className={`px-4 py-2.5 rounded-full text-[10px] font-black uppercase tracking-[.16em] transition-all ring-1 ring-inset ${key === k ? 'bg-[#E30613] text-white ring-[#E30613]' : 'text-[var(--c-textMid)] ring-[rgba(var(--line-rgb),.3)] hover:ring-[#f6c744]/60 hover:text-[var(--c-text)]'}`}>
            {k === 'goals' ? t.topScorers : t.topAssists}
          </button>
        ))}
        {note && <span className="ml-auto text-[9px] font-black uppercase tracking-widest text-[#f6c744]">{note}</span>}
      </div>

      {loading && rows.length === 0 && <p className="py-10 text-center text-sm text-[var(--c-textMid)]">{t.loading}</p>}

      {!loading && rows.length === 0 && (
        <p className="py-16 text-center text-sm text-[var(--c-textMid)]">{t.noStatsYet}</p>
      )}

      {rows.length > 0 && (
        <div className="overflow-x-auto rounded-2xl border border-[rgba(var(--line-rgb),.22)] bg-gradient-to-b from-[#15294d] to-[#0c1730] shadow-[0_10px_24px_rgba(2,8,23,.35)]">
          <table className="w-full min-w-[520px] border-collapse text-white">
            <caption className="sr-only">{key === 'goals' ? t.topScorers : t.topAssists}</caption>
            <thead>
              <tr className="border-b border-white/10">
                <th scope="col" className="px-3 py-3 text-[10px] font-black uppercase tracking-[.14em] text-[var(--c-textMid)] text-center w-10">#</th>
                <th scope="col" className="px-2 py-3 text-start text-[10px] font-black uppercase tracking-[.14em] text-[var(--c-textMid)]">{t.fullName}</th>
                <th scope="col" className="px-2 py-3 text-start text-[10px] font-black uppercase tracking-[.14em] text-[var(--c-textMid)] hidden sm:table-cell">{t.clubWord}</th>
                <th scope="col" className="px-2 py-3 text-center text-[10px] font-black uppercase tracking-[.14em] text-[var(--c-textMid)]">{t.appearances}</th>
                <th scope="col" className="px-2 py-3 text-center text-[10px] font-black uppercase tracking-[.14em] text-[var(--c-textMid)]">{t.goals}</th>
                <th scope="col" className="px-2 py-3 text-center text-[10px] font-black uppercase tracking-[.14em] text-[var(--c-textMid)]">{t.assists}</th>
                <th scope="col" className="px-2 py-3 text-center text-[10px] font-black uppercase tracking-[.14em] text-[var(--c-textMid)] hidden md:table-cell">{t.yellows}</th>
                <th scope="col" className="px-2 py-3 text-center text-[10px] font-black uppercase tracking-[.14em] text-[var(--c-textMid)] hidden md:table-cell">{t.reds}</th>
              </tr>
            </thead>
            <tbody>
              {board.top.map((r, i) => {
                const team = r.teamId != null ? byId.get(r.teamId) ?? null : null
                return (
                  <tr key={r.memberId}
                    className={`border-t border-white/[.07] ${r.teamId != null && r.teamId === myTeamId ? 'bg-[#f6c744]/[.07]' : ''}`}>
                    <td className="px-3 py-2.5 text-center">
                      <span className={`inline-grid place-items-center w-6 h-6 rounded-md text-[10px] font-black ${MEDALS[i] ?? 'bg-white/10 text-white/60'}`}>{i + 1}</span>
                    </td>
                    <td className="px-2 py-2.5">
                      <span className="text-[13px] font-bold">{r.name}</span>
                      {admin && (
                        <button onClick={() => startEdit(r.memberId)} title={t.editStats}
                          className="ms-2 text-[8px] font-black uppercase tracking-widest text-[#f6c744]/70 hover:text-[#f6c744]">{t.edit}</button>
                      )}
                    </td>
                    <td className="px-2 py-2.5 hidden sm:table-cell">
                      <span className="flex items-center gap-2">
                        <ClubMark team={team ?? undefined} src={logoUrl(team)} size={20} />
                        <span className="text-[12px] text-white/70 truncate">{r.teamName ?? '—'}</span>
                      </span>
                    </td>
                    <td className="px-2 py-2.5 text-center text-sm font-semibold tabular-nums text-white/70">{r.appearances}</td>
                    <td className="px-2 py-2.5 text-center text-sm font-black tabular-nums">{r.goals}</td>
                    <td className="px-2 py-2.5 text-center text-sm font-black tabular-nums">{r.assists}</td>
                    <td className="px-2 py-2.5 text-center text-sm tabular-nums text-amber-300/80 hidden md:table-cell">{r.yellows}</td>
                    <td className="px-2 py-2.5 text-center text-sm tabular-nums text-rose-300/80 hidden md:table-cell">{r.reds}</td>
                  </tr>
                )
              })}
              {/* Players with no goals/assists yet still belong in the table, last. */}
              {board.rest.length > 0 && (
                <tr className="border-t border-white/10">
                  <td colSpan={8} className="px-3 pt-4 pb-1 text-[9px] font-black uppercase tracking-[.18em] text-white/35">
                    {board.rest.length} — {t.noStatsYet}
                  </td>
                </tr>
              )}
              {board.rest.map((r) => (
                <tr key={r.memberId} className="border-t border-white/[.05] opacity-60">
                  <td className="px-3 py-2 text-center text-xs text-white/30">—</td>
                  <td className="px-2 py-2">
                    <span className="text-[12px] text-white/70">{r.name}</span>
                    {admin && (
                      <button onClick={() => startEdit(r.memberId)} title={t.editStats}
                        className="ms-2 text-[8px] font-black uppercase tracking-widest text-[#f6c744]/70 hover:text-[#f6c744]">{t.edit}</button>
                    )}
                  </td>
                  <td className="px-2 py-2 text-[11px] text-white/45 hidden sm:table-cell truncate">{r.teamName ?? '—'}</td>
                  <td className="px-2 py-2 text-center text-xs tabular-nums">{r.appearances}</td>
                  <td className="px-2 py-2 text-center text-xs tabular-nums">{r.goals}</td>
                  <td className="px-2 py-2 text-center text-xs tabular-nums">{r.assists}</td>
                  <td className="px-2 py-2 text-center text-xs tabular-nums hidden md:table-cell">{r.yellows}</td>
                  <td className="px-2 py-2 text-center text-xs tabular-nums hidden md:table-cell">{r.reds}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Admin: add a line for any player, including one with no numbers yet */}
      {admin && (
        <details className="rounded-2xl border border-[rgba(var(--line-rgb),.22)] bg-[var(--c-deep)] p-4">
          <summary className="cursor-pointer text-[10px] font-black uppercase tracking-[.16em] text-[var(--c-textMid)] hover:text-[#f6c744]">
            {t.addWord} — {t.playerStats}
          </summary>
          <div className="mt-4 space-y-3">
            <label className="block">
              <span className="text-[8px] font-black uppercase tracking-[.16em] text-[var(--c-textMid)]">{t.fullName}</span>
              <select
                value=""
                onChange={(e) => {
                  const v = Number(e.target.value)
                  if (v) startEdit(v)
                }}
                className="mt-1 w-full rounded-lg border border-[rgba(var(--line-rgb),.25)] bg-[var(--c-bg)] px-2 py-2 text-xs font-bold text-[var(--c-text)]">
                <option value="">{t.choosePlayer}</option>
                {players.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </label>
            <p className="text-[9px] font-bold text-[var(--c-textDim)]">{t.statsEnteredBy}</p>
          </div>
        </details>
      )}

      {/* Editor */}
      {admin && editing != null && (
        <div className="fixed inset-0 z-[400] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={() => setEditing(null)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-2xl border border-[rgba(var(--line-rgb),.28)] bg-[var(--c-panel)] p-5 text-[var(--c-text)] shadow-2xl">
            <p className="text-[10px] font-black uppercase tracking-[.18em] text-[#f6c744]">
              {t.statsFor.replace('{name}', players.find((p) => p.id === editing)?.name ?? '')}
            </p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              {([
                ['appearances', t.appearances], ['goals', t.goals], ['assists', t.assists], ['yellows', t.yellows], ['reds', t.reds],
              ] as const).map(([field, label]) => (
                <div key={field}>
                  <label className="text-[8px] font-black uppercase tracking-[.16em] text-[var(--c-textMid)]">{label}</label>
                  <div className="mt-1">
                    <NumberField value={String(draft[field])} min={0} max={99} title={label} allowEmpty
                      onChange={(v) => setDraft((d) => ({ ...d, [field]: v === '' ? 0 : Number(v) }))} />
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-5 flex items-center gap-2">
              <button disabled={busy} onClick={() => save(editing)}
                className="flex-1 rounded-lg bg-[#E30613] py-2.5 text-[10px] font-black uppercase tracking-widest text-white hover:bg-red-700 disabled:opacity-50 transition-all">{t.save}</button>
              <button onClick={() => setEditing(null)}
                className="rounded-lg border border-[rgba(var(--line-rgb),.3)] px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-[var(--c-textMid)] hover:text-[var(--c-text)] transition-all">{t.cancel}</button>
              <button disabled={busy} onClick={() => clear(editing)} title={t.confirmDeleteStat}
                className="rounded-lg border border-[#E30613]/40 px-3 py-2.5 text-[#ff4f66] hover:bg-[#E30613]/15 disabled:opacity-50 transition-all" aria-label={t.confirmDeleteStat}>×</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
