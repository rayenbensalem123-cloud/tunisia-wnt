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

        {/* crest, large and unframed */}
        <div className="relative flex flex-1 min-h-0 items-center justify-center px-6 pt-8 pb-4">
          {logoSrc ? (
            <img
              src={logoSrc}
              alt=""
              className="max-h-full w-[74%] object-contain drop-shadow-[0_14px_22px_rgba(0,0,0,.55)] motion-safe:transition-transform motion-safe:duration-300 group-hover:scale-105"
            />
          ) : (
            <span aria-hidden className="text-[72px] leading-none font-black italic text-white/25">
              {name.slice(0, 1).toUpperCase()}
            </span>
          )}
        </div>

        {/* footer: name left-aligned block, count underneath, divided from the crest */}
        <div className="relative border-t border-white/10 bg-black/20 px-4 py-3.5 text-center">
          <h2 className="text-[15px] sm:text-[17px] font-black uppercase leading-tight tracking-tight line-clamp-2 min-h-[2.5em] flex items-center justify-center">{name}</h2>
          <p className="mt-1 text-[12px] font-semibold text-[#f6c744] tabular-nums">
            {count} {playersWord}
          </p>
        </div>
      </button>
      {children}
    </div>
  )
}
