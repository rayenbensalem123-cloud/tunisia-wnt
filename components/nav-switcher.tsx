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
    <div className="flex bg-zinc-100 p-1 rounded-2xl border border-zinc-200">
      <Link href="/">
        <button
          className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all ${
            isPlayersActive
              ? "bg-white text-black shadow-sm"
              : "text-zinc-400 hover:text-zinc-600"
          }`}
        >
          <Users size={14} className={isPlayersActive ? "text-[#E30613]" : "text-zinc-400"} />
          Players
        </button>
      </Link>

      <Link href="/coaches">
        <button
          className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all ${
            isCoachesActive
              ? "bg-white text-black shadow-sm"
              : "text-zinc-400 hover:text-zinc-600"
          }`}
        >
          <Briefcase size={14} className={isCoachesActive ? "text-[#E30613]" : "text-zinc-400"} />
          Coaches
        </button>
      </Link>
    </div>
  )
}