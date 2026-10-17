'use client'
// One club in the Ligue Féminine grid. The club crest sits in the penalty area of a half pitch
// drawn in thin lines; the squad row under the name fills one dot per registered player (up to a
// full eleven), so a half-built squad reads at a glance. Logos stay in colour: the crest is the
// club's identity and the only thing on the card that should carry colour of its own.
import type { ReactNode } from 'react'

type Props = {
  name: string
  logoSrc: string
  count: number
  playersWord: string
  onOpen: () => void
  /** Small admin controls (change logo, delete) rendered over the card corners. */
  children?: ReactNode
}

const STARTING_ELEVEN = 11

export function LeagueTeamCard({ name, logoSrc, count, playersWord, onOpen, children }: Props) {
  const filled = Math.min(count, STARTING_ELEVEN)
  return (
    <div className="group relative">
      <button
        type="button"
        onClick={onOpen}
        className="relative block w-full aspect-[3/4] sm:aspect-[4/5] overflow-hidden rounded-[18px] text-left text-white
          bg-[linear-gradient(172deg,#17305b_0%,#0d1d3a_55%,#0a1630_100%)]
          ring-1 ring-white/10 shadow-[0_14px_34px_rgba(2,8,23,.5)]
          motion-safe:transition-[transform,box-shadow] motion-safe:duration-300
          hover:-translate-y-1 hover:ring-[#f6c744]/60 hover:shadow-[0_22px_48px_rgba(2,8,23,.65)]
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f6c744]"
      >
        {/* half pitch, seen from above: the penalty area and its arc */}
        <svg
          aria-hidden
          viewBox="0 0 300 220"
          preserveAspectRatio="xMidYMin slice"
          className="absolute inset-x-0 top-0 h-[68%] w-full fill-none stroke-white/[.16] group-hover:stroke-[#f6c744]/45 motion-safe:transition-[stroke] motion-safe:duration-500"
          strokeWidth="1.4"
        >
          <rect x="40" y="-2" width="220" height="150" />
          <path d="M118 148 A34 34 0 0 0 182 148" />
        </svg>

        {/* crest */}
        <div className="absolute inset-x-0 top-0 h-[58%] sm:h-[66%] flex items-center justify-center px-[17%] pt-1">
          {logoSrc ? (
            <img
              src={logoSrc}
              alt=""
              className="max-h-[84%] w-full object-contain drop-shadow-[0_10px_16px_rgba(0,0,0,.55)] motion-safe:transition-transform motion-safe:duration-300 group-hover:scale-[1.06]"
            />
          ) : (
            <span
              aria-hidden
              className="flex aspect-square w-[58%] items-center justify-center rounded-full bg-[#12264a] text-5xl font-black italic text-white/60 ring-2 ring-white/20"
            >
              {name.slice(0, 1).toUpperCase()}
            </span>
          )}
        </div>

        {/* name + squad */}
        <div className="absolute inset-x-0 bottom-0 px-3 pb-3 pt-6 sm:px-4 sm:pb-4 bg-gradient-to-t from-[#07101f]/90 to-transparent">
          <h2 className="text-[14px] sm:text-[19px] font-black italic uppercase leading-[1.04] tracking-tight line-clamp-2">{name}</h2>
          <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <span className="flex gap-[3px]" aria-hidden>
              {Array.from({ length: STARTING_ELEVEN }, (_, i) => (
                <span key={i} className={`h-1.5 w-1.5 rounded-full ${i < filled ? 'bg-[#E30613]' : 'bg-white/20'}`} />
              ))}
            </span>
            <span className="whitespace-nowrap text-[11px] font-semibold text-white/70 tabular-nums">
              {count} {playersWord}
            </span>
          </div>
        </div>
      </button>
      {children}
    </div>
  )
}
