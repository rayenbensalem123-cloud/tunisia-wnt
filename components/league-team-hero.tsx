'use client'
// Banner at the top of a club's page: same colour-from-logo treatment as the grid tile,
// with the crest, club name and squad size. Admin controls arrive as children.
import type { ReactNode } from 'react'
import { GRAIN, initialsOf, useTint, TeamCrest } from '@/components/league-team-card'

type Props = {
  name: string
  logoSrc: string
  count: number
  playersWord: string
  children?: ReactNode
}

export function LeagueTeamHero({ name, logoSrc, count, playersWord, children }: Props) {
  const tint = useTint(logoSrc, name)
  const neutral = tint === 'neutral'
  const h = neutral ? 215 : tint.h
  const sat = neutral ? 18 : Math.round(tint.s * 100)
  const bg = `linear-gradient(120deg, hsl(${h} ${sat}% 32%), hsl(${(h + 24) % 360} ${sat}% 13%))`

  return (
    <section style={{ background: bg }} className="relative mb-6 overflow-hidden rounded-3xl text-white shadow-[0_16px_40px_rgba(2,8,23,.4)] ring-1 ring-inset ring-white/15">
      <span aria-hidden className="pointer-events-none absolute inset-0 opacity-[.22] mix-blend-overlay" style={{ backgroundImage: GRAIN }} />
      <span aria-hidden className="pointer-events-none absolute -top-10 -right-4 rtl:-left-4 rtl:right-auto select-none text-[220px] leading-none font-black text-white/[.07]">
        {initialsOf(name).slice(0, 2)}
      </span>
      <span aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(40%_90%_at_14%_50%,rgba(255,255,255,.16),transparent_70%)] rtl:bg-[radial-gradient(40%_90%_at_86%_50%,rgba(255,255,255,.16),transparent_70%)]" />
      <div className="relative flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:gap-7 sm:p-8">
        <div className="flex h-24 w-24 shrink-0 items-center justify-center sm:h-32 sm:w-32">
          {logoSrc ? (
            <img src={logoSrc} alt="" className="max-h-full max-w-full object-contain drop-shadow-[0_12px_18px_rgba(0,0,0,.5)]" />
          ) : (
            <TeamCrest name={name} hue={h} className="h-full w-auto drop-shadow-[0_12px_18px_rgba(0,0,0,.45)]" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-2xl font-black leading-[1.05] tracking-tight sm:text-4xl">{name}</h2>
          <p className="mt-2 text-sm font-semibold text-white/75 tabular-nums">{count} {playersWord}</p>
          {children && <div className="mt-4 flex flex-wrap items-center gap-2">{children}</div>}
        </div>
      </div>
    </section>
  )
}
