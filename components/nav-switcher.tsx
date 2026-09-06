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
    <div className="flex bg-[#0b1322] p-1 rounded-2xl border border-[rgba(148,170,210,.16)]">
      <Link href="/">
        <button
          className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all ${
            isPlayersActive
              ? "bg-[#E30613] text-white shadow-lg shadow-[#E30613]/25"
              : "text-[#8fa0bd] hover:text-[#EDEFF4] hover:bg-[#12294e]"
          }`}
        >
          <Users size={14} className={isPlayersActive ? "text-white" : "text-[#54647d]"} />
          Players
        </button>
      </Link>

      <Link href="/coaches">
        <button
          className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all ${
            isCoachesActive
              ? "bg-[#E30613] text-white shadow-lg shadow-[#E30613]/25"
              : "text-[#8fa0bd] hover:text-[#EDEFF4] hover:bg-[#12294e]"
          }`}
        >
          <Briefcase size={14} className={isCoachesActive ? "text-white" : "text-[#54647d]"} />
          Coaches
        </button>
      </Link>
    </div>
  )
}