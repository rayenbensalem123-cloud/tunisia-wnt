'use client'
// One club in the Ligue Féminine grid. The tile takes its colour from the club's own logo
// (dominant colour read in the browser), so every card looks like its club. Clubs without a
// logo get a colour derived from the name and an initials shield. Name and player count only.
import { useEffect, useState, type ReactNode } from 'react'

type Tint = { h: number; s: number }

function hueOf(name: string) {
  let h = 0
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) % 360
  return h
}

const GENERIC = new Set(['as', 'asf', 'ans', 'us', 'ms', 'psf', 'cs', 'es', 'fc', 'sc', 'ca', 'club', 'de', 'la', 'le', 'el', 'al', "l'"])
function initialsOf(name: string) {
  const all = name.replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(Boolean)
  const w = all.filter((x) => !GENERIC.has(x.toLowerCase()) && x.length > 1)
  const use = w.length ? w : all
  const out = use.length > 1 ? use.slice(0, 2).map((x) => x[0]).join('') : (use[0] || '?').slice(0, 3)
  return out.toUpperCase()
}

/** Dominant colour of a logo: the most populated hue among its clearly coloured pixels. */
function dominantTint(img: HTMLImageElement): Tint | null {
  const size = 40
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return null
  ctx.drawImage(img, 0, 0, size, size)
  const { data } = ctx.getImageData(0, 0, size, size) // throws if the image is cross-origin tainted
  const bins = new Array(36).fill(0)
  const sat = new Array(36).fill(0)
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3]
    if (a < 200) continue
    const r = data[i] / 255, g = data[i + 1] / 255, b = data[i + 2] / 255
    const max = Math.max(r, g, b), min = Math.min(r, g, b)
    const l = (max + min) / 2, d = max - min
    if (d < 0.18 || l < 0.12 || l > 0.9) continue // greys, near-black and near-white say nothing about the club
    const s = d / (1 - Math.abs(2 * l - 1))
    let h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4
    h = (h * 60 + 360) % 360
    const k = Math.floor(h / 10) % 36
    bins[k] += s
    sat[k] += s * s
  }
  let best = 0
  for (let k = 1; k < 36; k++) if (bins[k] > bins[best]) best = k
  if (bins[best] < 6) return null // logo is basically black/white/grey
  return { h: best * 10 + 5, s: Math.min(0.75, Math.max(0.4, sat[best] / bins[best])) }
}

function useTint(logoSrc: string, name: string): Tint | 'neutral' {
  const fallback: Tint = { h: hueOf(name), s: 0.55 }
  const [tint, setTint] = useState<Tint | 'neutral'>(fallback)
  useEffect(() => {
    setTint(fallback)
    if (!logoSrc) return
    let live = true
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      try {
        const t = dominantTint(img)
        if (live) setTint(t ?? 'neutral')
      } catch {
        /* image not readable from this origin: keep the name colour */
      }
    }
    img.src = logoSrc
    return () => {
      live = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logoSrc, name])
  return tint
}

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
  const tint = useTint(logoSrc, name)
  const bg =
    tint === 'neutral'
      ? 'linear-gradient(150deg, #3b4658, #121926)'
      : `linear-gradient(150deg, hsl(${tint.h} ${Math.round(tint.s * 100)}% 34%), hsl(${(tint.h + 24) % 360} ${Math.round(tint.s * 100)}% 14%))`
  const edge = tint === 'neutral' ? 'hsl(215 20% 70%)' : `hsl(${tint.h} 60% 72%)`
  const hue = tint === 'neutral' ? 215 : tint.h

  return (
    <div className="group relative">
      <button
        type="button"
        onClick={onOpen}
        aria-label={`${name}, ${count} ${playersWord}`}
        style={{ background: bg }}
        className="relative flex w-full aspect-[4/5] sm:aspect-square flex-col overflow-hidden rounded-2xl text-left text-white
          shadow-[0_12px_30px_rgba(2,8,23,.45)] ring-1 ring-inset ring-white/15
          motion-safe:transition-[transform,box-shadow] motion-safe:duration-300
          hover:-translate-y-1 hover:shadow-[0_20px_44px_rgba(2,8,23,.6)]
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f6c744] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a1322]"
      >
        {/* big faded initials as a watermark */}
        <span aria-hidden className="pointer-events-none absolute -top-6 -left-3 rtl:-right-3 rtl:left-auto select-none text-[150px] leading-none font-black text-white/[.09]">
          {initialsOf(name).slice(0, 2)}
        </span>
        {/* soft light behind the crest */}
        <span aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(55%_55%_at_50%_34%,rgba(255,255,255,.16),transparent_70%)]" />

        {/* crest, always fully visible */}
        <div className="relative flex min-h-0 flex-1 items-center justify-center px-4 pb-2 pt-4">
          {logoSrc ? (
            <img
              src={logoSrc}
              alt=""
              className="max-h-full max-w-[72%] object-contain drop-shadow-[0_10px_16px_rgba(0,0,0,.5)] motion-safe:transition-transform motion-safe:duration-300 group-hover:scale-105"
            />
          ) : (
            <svg aria-hidden viewBox="0 0 100 116" className="h-full max-h-[8rem] w-auto drop-shadow-[0_10px_16px_rgba(0,0,0,.45)] motion-safe:transition-transform motion-safe:duration-300 group-hover:scale-105">
              <path d="M50 3 93 17v38c0 31-19 49-43 58C26 104 7 86 7 55V17z" fill={`hsl(${hue} 45% 22% / .85)`} stroke={edge} strokeWidth="3" />
              <text x="50" y="68" textAnchor="middle" fontSize={initialsOf(name).length > 2 ? 27 : 34} fontWeight="900" fill="#fff" fillOpacity=".92" fontFamily="inherit">
                {initialsOf(name)}
              </text>
            </svg>
          )}
        </div>

        {/* frosted name bar */}
        <div className="relative m-2 flex items-center justify-between gap-2 rounded-xl bg-black/30 px-3 py-2.5 ring-1 ring-inset ring-white/10 backdrop-blur-sm">
          <div className="min-w-0">
            <h2 className="text-[13px] sm:text-[15px] font-black leading-tight line-clamp-2 break-words min-h-[2.2em] flex items-center">{name}</h2>
            <p className="mt-0.5 text-[11.5px] text-white/70 tabular-nums">
              {count} {playersWord}
            </p>
          </div>
          <span aria-hidden className="hidden sm:grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/15 motion-safe:transition-colors group-hover:bg-white/30">
            <svg className="h-4 w-4 rtl:rotate-180" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
          </span>
        </div>
      </button>
      {children}
    </div>
  )
}
