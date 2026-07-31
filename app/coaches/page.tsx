"use client"
import React, { useState } from "react"
import { UserPlus, Globe2, ShieldCheck, Edit2, Trash2, Activity } from "lucide-react"
import { usePlayers } from "@/lib/players-context"
import { NavSwitcher } from "@/components/nav-switcher"
import { CoachDialog } from "@/components/coach-dialog"
import { PlayerCard } from "@/components/player-card"

export default function CoachesPage() {
  const { coaches, deleteCoach } = usePlayers()
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [selectedCoach, setSelectedCoach] = useState<any>(null)

  const handleEdit = (coach: any) => {
    setSelectedCoach(coach)
    setIsDialogOpen(true)
  }

  const handleHire = () => {
    setSelectedCoach(null)
    setIsDialogOpen(true)
  }

  return (
    <main className="min-h-screen bg-[#F8F9FA] p-8">
      <div className="flex justify-between items-center mb-12">
        <div>
          <h1 className="text-4xl font-[1000] italic uppercase tracking-tighter">
            SQUAD <span className="text-[#E30613]">STAFF</span>
          </h1>
          <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mt-1">Management & Technical Body</p>
        </div>

        <NavSwitcher />

        <button 
          onClick={handleHire}
          className="bg-black text-white px-6 py-3 rounded-xl font-black uppercase text-[11px] flex items-center gap-2 hover:bg-[#E30613] transition-all shadow-lg"
        >
          <UserPlus size={16} /> Hire Staff
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-6">
        {coaches.map((coach: any) => (
          <div key={coach.id} className="group relative">
            {/* AUTHENTIC POINTED SHIELD DESIGN */}
            <div 
              className="relative w-full bg-white border border-zinc-200 shadow-sm transition-all duration-500 group-hover:shadow-2xl group-hover:-translate-y-3"
              style={{ 
                clipPath: "polygon(0% 0%, 100% 0%, 100% 85%, 50% 100%, 0% 85%)", 
                minHeight: "420px" 
              }}
            >
              {/* PHOTO SECTION */}
              <div className="w-full aspect-square overflow-hidden bg-zinc-50 relative">
                <img 
                  src={coach.image || "/api/placeholder/400/400"} 
                  className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-700 scale-105 group-hover:scale-100" 
                  alt={coach.name} 
                />
                <div className="absolute top-4 left-4 bg-black/80 backdrop-blur-md px-2 py-1 rounded-sm border border-white/10">
                  <span className="text-[8px] font-black text-white uppercase tracking-widest">{coach.role}</span>
                </div>
              </div>

              {/* REFINED TEXT AREA */}
              <div className="p-5 pt-6 flex flex-col items-center">
                <h3 className="text-xl font-black text-zinc-900 uppercase italic tracking-tighter leading-none mb-1 text-center">
                  {coach.name}
                </h3>
                
                <div className="flex items-center gap-2 mb-4">
                   <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest">{coach.nationality || "TUNISIA"}</span>
                   <span className="w-1 h-1 bg-zinc-300 rounded-full" />
                   <span className="text-[9px] font-black text-[#E30613] uppercase tracking-widest italic">STAFF</span>
                </div>

                {/* METADATA GRID FOR COACHES */}
                <div className="w-full grid grid-cols-2 gap-0.5 bg-zinc-100 border border-zinc-100 rounded-lg overflow-hidden mb-6">
                   <div className="bg-white p-2 flex flex-col items-center">
                      <span className="text-[7px] font-black text-zinc-400 uppercase tracking-tighter mb-0.5">LICENSE</span>
                      <span className="text-[10px] font-black italic text-zinc-800 uppercase">{coach.license || "PRO"}</span>
                   </div>
                   <div className="bg-white p-2 flex flex-col items-center">
                      <span className="text-[7px] font-black text-zinc-400 uppercase tracking-tighter mb-0.5">EXP</span>
                      <span className="text-[10px] font-black italic text-zinc-800 uppercase">10+ YRS</span>
                   </div>
                </div>

                {/* SECONDARY ACTION TAGS */}
                <div className="flex gap-2 mb-8">
                  <div className="flex items-center gap-1 px-2 py-0.5 bg-zinc-50 border border-zinc-200 rounded-full">
                    <Globe2 className="w-2 h-2 text-zinc-400" />
                    <span className="text-[7px] font-bold text-zinc-500 uppercase tracking-tight">Technical</span>
                  </div>
                  <div className="flex items-center gap-1 px-2 py-0.5 bg-red-50 border border-red-100 rounded-full">
                    <Activity className="w-2 h-2 text-[#E30613]" />
                    <span className="text-[7px] font-black text-[#E30613] uppercase tracking-tight">Active</span>
                  </div>
                </div>
              </div>

              {/* BUTTON OVERLAY */}
              <div className="absolute bottom-16 left-1/2 -translate-x-1/2 flex gap-2 opacity-0 group-hover:opacity-100 transition-all translate-y-2 group-hover:translate-y-0 duration-300">
                <button 
                  onClick={() => handleEdit(coach)} 
                  className="w-8 h-8 bg-zinc-900 text-white rounded-full flex items-center justify-center hover:bg-[#E30613] transition-colors shadow-lg"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button 
                  onClick={() => deleteCoach(coach.id)}
                  className="w-8 h-8 bg-zinc-900 text-white rounded-full flex items-center justify-center hover:bg-black transition-colors shadow-lg"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <CoachDialog 
        open={isDialogOpen} 
        onOpenChange={setIsDialogOpen} 
        coach={selectedCoach} 
      />
    </main>
  )
}