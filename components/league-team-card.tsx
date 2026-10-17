'use client'
// One club in the Ligue Féminine grid. Same visual family as the category tiles on the first
// screen (dark navy card, red top edge, gold on hover): a large colour crest on a soft
// spotlight, the club name, and the number of registered players. Nothing else on the card.
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

export function LeagueTeamCard({ name, logoSrc, count, playersWord, onOpen, children }: Props) {
  return (
    <div className="group relative">
      <button
        type="button"
        onClick={onOpen}
        aria-label={`${name}, ${count} ${playersWord}`}
        className="relative flex w-full aspect-[4/5] flex-col overflow-hidden rounded-2xl border border-[rgba(var(--line-rgb),.22)]
          bg-gradient-to-b from-[#15294d] to-[#0a1322] text-white shadow-[0_12px_30px_rgba(2,8,23,.45)]
          motion-safe:transition-[transform,box-shadow,border-color] motion-safe:duration-300
          hover:-translate-y-1 hover:border-[#f6c744]/70 hover:shadow-[0_20px_44px_rgba(2,8,23,.6)]
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f6c744] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a1322]"
      >
        <span aria-hidden className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-[#ff2747] to-[#a30420]" />
        <span aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_42%_at_50%_36%,rgba(255,255,255,.11),transparent_72%)]" />

        {/* crest on a light plate, so dark or transparent logos stay readable on the navy card */}
        <div className="relative flex flex-1 min-h-0 items-center justify-center px-6 pt-8 pb-2">
          <span className="flex aspect-square w-[64%] shrink-0 items-center justify-center rounded-full bg-white shadow-[0_10px_24px_rgba(0,0,0,.45),0_0_0_5px_rgba(255,255,255,.08)] motion-safe:transition-transform motion-safe:duration-300 group-hover:scale-105">
            {logoSrc ? (
              <img src={logoSrc} alt="" className="h-[70%] w-[70%] object-contain" />
            ) : (
              <span aria-hidden className="text-5xl font-black italic text-[#15294d]/70">
                {name.slice(0, 1).toUpperCase()}
              </span>
            )}
          </span>
        </div>

        {/* name + squad size */}
        <div className="relative px-4 pb-5 pt-3 text-center">
          <h2 className="text-[16px] sm:text-[18px] font-black uppercase leading-tight tracking-tight line-clamp-2 min-h-[2.2em] flex items-center justify-center">{name}</h2>
          <p className="mt-2 inline-block rounded-full bg-[#f6c744]/12 px-3 py-0.5 text-[12px] font-semibold text-[#f6c744] tabular-nums ring-1 ring-inset ring-[#f6c744]/25">
            {count} {playersWord}
          </p>
        </div>
      </button>
      {children}
    </div>
  )
}
