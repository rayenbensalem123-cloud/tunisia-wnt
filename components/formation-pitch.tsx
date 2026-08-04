"use client"
import React from "react"

export const FORMATIONS: Record<string, { slotKey: string; label: string; x: number; y: number }[]> = {
  "4-3-3": [
    { slotKey: "gk", label: "GK", x: 50, y: 92 },
    { slotKey: "lb", label: "LB", x: 14, y: 72 },
    { slotKey: "cb1", label: "CB", x: 36, y: 76 },
    { slotKey: "cb2", label: "CB", x: 64, y: 76 },
    { slotKey: "rb", label: "RB", x: 86, y: 72 },
    { slotKey: "cm1", label: "CM", x: 28, y: 50 },
    { slotKey: "cm2", label: "CM", x: 50, y: 45 },
    { slotKey: "cm3", label: "CM", x: 72, y: 50 },
    { slotKey: "lw", label: "LW", x: 18, y: 20 },
    { slotKey: "st", label: "ST", x: 50, y: 14 },
    { slotKey: "rw", label: "RW", x: 82, y: 20 },
  ],
  "4-4-2": [
    { slotKey: "gk", label: "GK", x: 50, y: 92 },
    { slotKey: "lb", label: "LB", x: 14, y: 72 },
    { slotKey: "cb1", label: "CB", x: 36, y: 76 },
    { slotKey: "cb2", label: "CB", x: 64, y: 76 },
    { slotKey: "rb", label: "RB", x: 86, y: 72 },
    { slotKey: "lm", label: "LM", x: 14, y: 45 },
    { slotKey: "cm1", label: "CM", x: 38, y: 48 },
    { slotKey: "cm2", label: "CM", x: 62, y: 48 },
    { slotKey: "rm", label: "RM", x: 86, y: 45 },
    { slotKey: "st1", label: "ST", x: 38, y: 16 },
    { slotKey: "st2", label: "ST", x: 62, y: 16 },
  ],
  "4-2-3-1": [
    { slotKey: "gk", label: "GK", x: 50, y: 92 },
    { slotKey: "lb", label: "LB", x: 14, y: 72 },
    { slotKey: "cb1", label: "CB", x: 36, y: 76 },
    { slotKey: "cb2", label: "CB", x: 64, y: 76 },
    { slotKey: "rb", label: "RB", x: 86, y: 72 },
    { slotKey: "cdm1", label: "CDM", x: 38, y: 58 },
    { slotKey: "cdm2", label: "CDM", x: 62, y: 58 },
    { slotKey: "lw", label: "LW", x: 18, y: 30 },
    { slotKey: "cam", label: "CAM", x: 50, y: 32 },
    { slotKey: "rw", label: "RW", x: 82, y: 30 },
    { slotKey: "st", label: "ST", x: 50, y: 12 },
  ],
  "3-5-2": [
    { slotKey: "gk", label: "GK", x: 50, y: 92 },
    { slotKey: "cb1", label: "CB", x: 30, y: 76 },
    { slotKey: "cb2", label: "CB", x: 50, y: 79 },
    { slotKey: "cb3", label: "CB", x: 70, y: 76 },
    { slotKey: "lwb", label: "LWB", x: 10, y: 50 },
    { slotKey: "cm1", label: "CM", x: 35, y: 48 },
    { slotKey: "cm2", label: "CM", x: 50, y: 52 },
    { slotKey: "cm3", label: "CM", x: 65, y: 48 },
    { slotKey: "rwb", label: "RWB", x: 90, y: 50 },
    { slotKey: "st1", label: "ST", x: 38, y: 16 },
    { slotKey: "st2", label: "ST", x: 62, y: 16 },
  ],
}

export function FormationPitch({
  formation, slots, members, editable, onSlotClick, compact,
}: {
  formation: string
  slots: Record<string, number | null>
  members: any[]
  editable?: boolean
  onSlotClick?: (slotKey: string) => void
  compact?: boolean
}) {
  const layout = FORMATIONS[formation] || FORMATIONS["4-3-3"]
  return (
    <div
      className="relative rounded-2xl overflow-hidden"
      style={{
        background: "linear-gradient(180deg, #2d7a3a 0%, #26692f 100%)",
        aspectRatio: compact ? "16/9" : "16/11",
      }}
    >
      <div className="absolute inset-3 border-2 border-white/40 rounded-lg" />
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20 rounded-full border-2 border-white/40" />
      <div className="absolute left-1/2 top-3 -translate-x-1/2 w-1/3 h-[14%] border-2 border-t-0 border-white/40" />
      <div className="absolute left-1/2 bottom-3 -translate-x-1/2 w-1/3 h-[14%] border-2 border-b-0 border-white/40" />

      {layout.map((slot) => {
        const playerId = slots[slot.slotKey]
        const player = playerId ? members.find((m) => m.id === playerId) : null
        return (
          <button
            key={slot.slotKey}
            type="button"
            disabled={!editable}
            onClick={() => onSlotClick?.(slot.slotKey)}
            className="absolute flex flex-col items-center -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${slot.x}%`, top: `${slot.y}%` }}
          >
            <div
              className={`rounded-full flex items-center justify-center font-black shadow-md transition-all
                ${compact ? "w-6 h-6 text-[9px]" : "w-9 h-9 text-[11px]"}
                ${player ? "bg-white text-zinc-900" : "bg-white/25 text-white border-2 border-dashed border-white/60"}
                ${editable ? "hover:scale-110 cursor-pointer" : ""}`}
            >
              {player ? "" : slot.label}
            </div>
            <span className={`font-bold text-white mt-0.5 text-center truncate drop-shadow ${compact ? "text-[6px] max-w-[44px]" : "text-[9px] max-w-[70px]"}`}>
              {player ? player.name : (editable ? "Tap to add" : "")}
            </span>
          </button>
        )
      })}
    </div>
  )
}
