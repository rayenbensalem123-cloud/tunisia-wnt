"use client"
import React, { useEffect, useRef, useState } from "react"
import { Minus, Plus } from "lucide-react"

// ─────────────────────────────────────────────────────────────
// NUMBER STEPPER — remplace <input type="number">.
// Le widget natif affiche des fleches qui disparaissent sous Chrome,
// accepte la notation exponentielle et les valeurs negatives quand
// min=0, et son rendu ignore completement le theme.
// Ici : value strictly bornee, increment choisi, pave tactile,
// et le champ reste editable au clavier.
// ─────────────────────────────────────────────────────────────

export default function NumberStepper({
  value, onChange, min = 0, max = 99, step = 1, label, className = "",
  showInput = true, big = false,
}: {
  value: number | string
  onChange: (v: number) => void
  min?: number
  max?: number
  step?: number
  label?: string
  className?: string
  showInput?: boolean
  big?: boolean
}) {
  const clamp = (n: number) => Math.min(max, Math.max(min, n))
  const n = Number(value)
  const cur = Number.isFinite(n) ? clamp(n) : min
  const ref = useRef<HTMLInputElement>(null)
  const [typing, setTyping] = useState<string | null>(null)

  const bump = (d: number) => { setTyping(null); onChange(clamp(cur + d)) }

  // Au clavier sur le champ : fleches = +/- step, et on borne a chaque frappe.
  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowUp") { e.preventDefault(); bump(step) }
    else if (e.key === "ArrowDown") { e.preventDefault(); bump(-step) }
    else if (e.key === "Enter") { setTyping(null); ref.current?.blur() }
  }

  useEffect(() => {
    // Si la valeur change de l'exterieur pendant la saisie, on abandonne
    // le tampon local pour ne pas afficher un chiffre fantome.
    if (typing !== null) {
      const t = Number(typing)
      if (!Number.isFinite(t) || clamp(t) !== n) setTyping(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [n])

  const shown = typing ?? String(cur)
  const atMin = cur <= min
  const atMax = cur >= max

  const Btn = ({ dir, disabled, aria }: { dir: -1 | 1; disabled: boolean; aria: string }) => (
    <button
      type="button"
      disabled={disabled}
      aria-label={aria}
      onClick={() => bump(dir * step)}
      className={`grid place-items-center shrink-0 text-[var(--c-textDim)] transition-all active:scale-90 ${
        big ? "w-11 h-11" : "w-9 h-9"
      } ${disabled ? "opacity-25 cursor-not-allowed" : "hover:text-[#E30613] hover:bg-[#E30613]/10"}`}
    >
      {dir === -1 ? <Minus size={big ? 16 : 13} /> : <Plus size={big ? 16 : 13} />}
    </button>
  )

  return (
    <div className={`flex items-stretch gap-1 rounded-xl bg-[var(--c-panel3)] border border-[rgba(var(--line-rgb),.22)] focus-within:border-[#E30613]/50 transition-all ${className}`}>
      <Btn dir={-1} disabled={atMin} aria={label ? `${label} : moins` : "Diminuer"} />

      {showInput ? (
        <div className="flex-1 min-w-0 grid place-items-center">
          <input
            ref={ref}
            value={shown}
            onChange={e => {
              const raw = e.target.value.replace(/[^\d-]/g, "")
              setTyping(raw)
              const t = Number(raw)
              if (raw !== "" && Number.isFinite(t)) onChange(clamp(t))
            }}
            onFocus={() => setTyping(String(cur))}
            onBlur={() => setTyping(null)}
            onKeyDown={onKey}
            inputMode="numeric"
            aria-label={label}
            aria-valuenow={cur}
            aria-valuemin={min}
            aria-valuemax={max}
            role="spinbutton"
            data-od-picker="number"
            className={`w-full text-center bg-transparent outline-none font-black tabular-nums text-[var(--c-text)] ${big ? "text-3xl" : "text-[16px]"}`}
          />
        </div>
      ) : (
        <span data-od-picker="number" className={`flex-1 grid place-items-center font-black tabular-nums text-[var(--c-text)] ${big ? "text-3xl" : "text-[16px]"}`}>
          {cur}
        </span>
      )}

      <Btn dir={1} disabled={atMax} aria={label ? `${label} : plus` : "Augmenter"} />
    </div>
  )
}