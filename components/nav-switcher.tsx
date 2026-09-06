"use client"

import React from "react"
import Link from "next/link"
import { Users, Briefcase } from "lucide-react"
import { usePathname } from "next/navigation"

export function NavSwitcher() {
  const pathname = usePathname()

  // Logic to determine which tab is active based on the URL
  const isPlayersActive = pathname === "/"
  const isCoachesActive = pathname === "/coaches"

  return (
    <div className="flex bg-[var(--c-ink)] p-1 rounded-2xl border border-[rgba(var(--line-rgb),.16)]">
      <Link href="/">
        <button
          className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all ${
            isPlayersActive
              ? "bg-[#E30613] text-white shadow-lg shadow-[#E30613]/25"
              : "text-[var(--c-textFaint)] hover:text-[var(--c-text)] hover:bg-[var(--c-panel2)]"
          }`}
        >
          <Users size={14} className={isPlayersActive ? "text-white" : "text-[var(--c-textDim)]"} />
          Players
        </button>
      </Link>

      <Link href="/coaches">
        <button
          className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all ${
            isCoachesActive
              ? "bg-[#E30613] text-white shadow-lg shadow-[#E30613]/25"
              : "text-[var(--c-textFaint)] hover:text-[var(--c-text)] hover:bg-[var(--c-panel2)]"
          }`}
        >
          <Briefcase size={14} className={isCoachesActive ? "text-white" : "text-[var(--c-textDim)]"} />
          Coaches
        </button>
      </Link>
    </div>
  )
}