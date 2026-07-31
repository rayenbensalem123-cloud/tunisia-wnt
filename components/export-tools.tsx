"use client"
import React, { useState } from "react"
import { Download, Upload, Printer, FileSpreadsheet, FileJson, X } from "lucide-react"

type Props = {
  members: any[]
  matches: any[]
  teamCat: string | null
  onImport: (data: { members: any[]; matches: any[] }) => void
}

export function ExportTools({ members, matches, teamCat, onImport }: Props) {
  const [open, setOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [importData, setImportData] = useState("")

  const catMembers = members.filter(m => m.teamCategory === teamCat)

  const exportCSV = () => {
    const headers = ["Name", "Position", "Club", "Age", "Caps", "Goals", "Assists", "Yellow Cards", "Red Cards", "Suspended"]
    const rows = catMembers.map((m: any) => [
      m.name, m.position, m.club, m.birthdate ? calculateAge(m.birthdate) : "N/A",
      m.natMatches || "0", m.goals || "0", m.assists || "0",
      m.yellowCards || 0, m.redCards || 0, m.suspended ? "YES" : "NO"
    ])
    const csv = [headers.join(","), ...rows.map(r => r.map((v: any) => `"${v}"`).join(","))].join("\n")
    download(csv, `squad-${teamCat}-${new Date().toISOString().split("T")[0]}.csv`, "text/csv")
  }

  const exportJSON = () => {
    const data = {
      exportedAt: new Date().toISOString(),
      teamCategory: teamCat,
      members: catMembers,
      matches: matches.filter(m => m.teamCategory === teamCat),
    }
    download(JSON.stringify(data, null, 2), `squad-backup-${new Date().toISOString().split("T")[0]}.json`, "application/json")
  }

  const exportFullJSON = () => {
    const data = {
      exportedAt: new Date().toISOString(),
      members,
      matches,
    }
    download(JSON.stringify(data, null, 2), `full-backup-${new Date().toISOString().split("T")[0]}.json`, "application/json")
  }

  const handlePrint = () => {
    window.print()
  }

  const handleImport = () => {
    try {
      const data = JSON.parse(importData)
      if (data.members || data.matches) {
        onImport({
          members: data.members || [],
          matches: data.matches || [],
        })
        setImportOpen(false)
        setImportData("")
      }
    } catch {}
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-zinc-300 bg-white text-zinc-500 hover:text-zinc-900 text-[9px] font-black uppercase tracking-widest transition-all"
      >
        <Download size={14} />
        <span className="hidden sm:inline">Export</span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-[180]" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-12 z-[190] w-52 rounded-2xl border border-zinc-200 bg-white shadow-2xl overflow-hidden text-zinc-900">
            <div className="divide-y divide-zinc-200">
              <button onClick={() => { exportCSV(); setOpen(false) }} className="w-full text-left px-4 py-3 flex items-center gap-3 text-[9px] font-black uppercase transition-all hover:bg-zinc-50">
                <FileSpreadsheet size={13} className="text-green-500" /> CSV Roster
              </button>
              <button onClick={() => { exportJSON(); setOpen(false) }} className="w-full text-left px-4 py-3 flex items-center gap-3 text-[9px] font-black uppercase transition-all hover:bg-zinc-50">
                <FileJson size={13} className="text-blue-500" /> JSON (Category)
              </button>
              <button onClick={() => { exportFullJSON(); setOpen(false) }} className="w-full text-left px-4 py-3 flex items-center gap-3 text-[9px] font-black uppercase transition-all hover:bg-zinc-50">
                <FileJson size={13} className="text-[#E30613]" /> JSON (Full Backup)
              </button>
              <button onClick={() => { setOpen(false); setImportOpen(true) }} className="w-full text-left px-4 py-3 flex items-center gap-3 text-[9px] font-black uppercase transition-all hover:bg-zinc-50">
                <Upload size={13} className="text-orange-500" /> Import JSON
              </button>
              <div className="h-px bg-zinc-200" />
              <button onClick={() => { handlePrint(); setOpen(false) }} className="w-full text-left px-4 py-3 flex items-center gap-3 text-[9px] font-black uppercase transition-all hover:bg-zinc-50">
                <Printer size={13} /> Print Roster
              </button>
            </div>
          </div>
        </>
      )}

      {importOpen && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-lg p-6 rounded-[2rem] border border-zinc-200 bg-white text-zinc-900">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-black italic uppercase tracking-tighter">Import JSON</h2>
              <button onClick={() => setImportOpen(false)} className="p-2 hover:bg-red-500/10 rounded-xl"><X size={20} /></button>
            </div>
            <textarea
              value={importData}
              onChange={e => setImportData(e.target.value)}
              placeholder="Paste JSON data here..."
              rows={8}
              className="w-full p-3 rounded-xl border border-zinc-200 bg-zinc-50 text-[10px] font-bold outline-none resize-none"
            />
            <div className="flex gap-3 mt-4">
              <button onClick={() => setImportOpen(false)} className="flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-wider border border-zinc-300 bg-zinc-100">Cancel</button>
              <button onClick={handleImport} className="flex-[2] py-3 bg-[#E30613] text-white rounded-xl text-[10px] font-black uppercase tracking-wider">Import</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function calculateAge(bd: string) {
  if (!bd?.includes("/")) return "N/A"
  const [d, m, y] = bd.split("/").map(Number)
  const birth = new Date(y, m - 1, d)
  const now = new Date()
  let age = now.getFullYear() - birth.getFullYear()
  if (now.getMonth() < birth.getMonth() || (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate())) age--
  return age
}

function download(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}
