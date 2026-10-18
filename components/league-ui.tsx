'use client'
// Small pieces shared by the Ligue Féminine screens.
import { hueOf, initialsOf } from '@/components/league-team-card'
import type { LeagueTeam } from '@/lib/app-data'

export const input = 'w-full rounded-xl border border-[rgba(var(--line-rgb),.25)] bg-[var(--c-deep)] px-3.5 py-3 text-sm font-semibold text-[var(--c-text)] outline-none focus:border-[#f6c744]/70'
export const label = 'mb-1 block text-[9px] font-black uppercase tracking-[.2em] text-[var(--c-textMid)]'
export const chip = (on: boolean) =>
  `px-3.5 py-2 rounded-full text-[10px] font-black uppercase tracking-[.16em] transition-all ring-1 ring-inset ${on ? 'bg-[#f6c744] text-[#0c1f3d] ring-[#f6c744]' : 'text-[var(--c-textMid)] ring-[rgba(var(--line-rgb),.3)] hover:ring-[#f6c744]/60 hover:text-[var(--c-text)]'}`

/** ISO timestamp -> value for <input type="datetime-local"> in the viewer's time zone. */
export const toLocalInput = (iso: string | null) => {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

export function ClubMark({ team, src, size = 44 }: { team: LeagueTeam | undefined; src: string; size?: number }) {
  const name = team?.name || '?'
  const h = hueOf(name)
  if (src) return <img src={src} alt="" width={size} height={size} className="object-contain shrink-0 drop-shadow-[0_4px_8px_rgba(0,0,0,.4)]" style={{ width: size, height: size }} />
  return (
    <svg aria-hidden viewBox="0 0 100 116" className="shrink-0" style={{ width: size * 0.9, height: size }}>
      <path d="M50 3 93 17v38c0 31-19 49-43 58C26 104 7 86 7 55V17z" fill={`hsl(${h} 45% 24%)`} stroke={`hsl(${h} 55% 62%)`} strokeWidth="4" />
      <text x="50" y="68" textAnchor="middle" fontSize={initialsOf(name).length > 2 ? 27 : 34} fontWeight="900" fill="#fff" fillOpacity=".92" fontFamily="inherit">{initialsOf(name)}</text>
    </svg>
  )
}

