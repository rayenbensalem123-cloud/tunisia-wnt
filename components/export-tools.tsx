"use client"
import React, { useState } from "react"
import { createPortal } from "react-dom"
import { Download, Upload, Printer, FileSpreadsheet, FileJson, X, FileText, Check } from "lucide-react"

type Props = {
  members: any[]
  matches: any[]
  teamCat: string | null
  onImport: (data: { members: any[]; matches: any[] }) => void
  onImportPlayers?: (rows: { name: string; team?: string; camp?: string }[]) => void
}

export function ExportTools({ members, matches, teamCat, onImport, onImportPlayers }: Props) {
  const [open, setOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [importData, setImportData] = useState("")
  const [pdfOpen, setPdfOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [pdfError, setPdfError] = useState("")
  const [rows, setRows] = useState<{ name: string; team?: string; camp?: string }[]>([])
  const [fileName, setFileName] = useState("")

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

  const openPdf = () => { setPdfOpen(true); setRows([]); setFileName(""); setPdfError(""); setBusy(false) }

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    e.target.value = ""
    if (!f) return
    setBusy(true); setPdfError(""); setFileName(f.name); setRows([])
    try {
      const fd = new FormData()
      fd.append('file', f, f.name)
      const r = await fetch('/api/import-players', { method: 'POST', body: fd })
      const d = await r.json()
      if (d.error) { setPdfError(d.error) }
      else {
        setRows(d.rows || [])
        if (d.scannedPages > 0 && (d.rows || []).length === 0) {
          setPdfError(`This PDF has ${d.scannedPages} scanned page(s) with no text. Scanned files can't be auto-read — please type the names manually or use a text PDF.`)
        }
      }
    } catch (e: any) {
      setPdfError('Could not process PDF: ' + (e?.message || 'unknown'))
    }
    setBusy(false)
  }

  const updateRow = (i: number, key: 'name' | 'team' | 'camp', val: string) => {
    setRows(prev => prev.map((r, idx) => idx === i ? { ...r, [key]: val } : r))
  }

  const confirmImport = () => {
    const valid = rows.filter(r => r.name && r.name.trim())
    if (!valid.length) return
    onImportPlayers?.(valid)
    setPdfOpen(false); setRows([]); setFileName(""); setOpen(false)
  }

  return (
    <div className="relative" onClick={(e) => e.stopPropagation()}>
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
          <div className="absolute right-0 top-12 z-[190] w-56 rounded-2xl border border-zinc-200 bg-white shadow-2xl max-h-[calc(100dvh-6rem)] overflow-y-auto text-zinc-900">
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
              {onImportPlayers && (
                <button onClick={() => { setOpen(false); openPdf() }} className="w-full text-left px-4 py-3 flex items-center gap-3 text-[9px] font-black uppercase transition-all hover:bg-zinc-50">
                  <FileText size={13} className="text-red-500" /> Import Players (PDF)
                </button>
              )}
              <div className="h-px bg-zinc-200" />
              <button onClick={() => { handlePrint(); setOpen(false) }} className="w-full text-left px-4 py-3 flex items-center gap-3 text-[9px] font-black uppercase transition-all hover:bg-zinc-50">
                <Printer size={13} /> Print Roster
              </button>
            </div>
          </div>
        </>
      )}

      {
  importOpen && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/80" onMouseDownCapture={(e) => e.stopPropagation()}>
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
      , document.body)
      }

      {
      pdfOpen && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/80" onMouseDownCapture={(e) => e.stopPropagation()}>
          <div className="w-full max-w-2xl flex flex-col max-h-[90vh] overflow-hidden p-6 rounded-[2rem] border border-zinc-200 bg-white text-zinc-900">
            <div className="flex items-center justify-between mb-4 shrink-0">
              <div>
                <h2 className="text-xl font-black italic uppercase tracking-tighter">Import Players (PDF)</h2>
                <p className="text-[8px] font-black uppercase tracking-[0.3em] text-zinc-400 mt-1">New names create cards · existing names update team · camps recorded</p>
              </div>
              <button onClick={() => setPdfOpen(false)} className="p-2 hover:bg-red-500/10 rounded-xl"><X size={20} /></button>
            </div>

            <label className={`shrink-0 flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-6 cursor-pointer transition-all ${fileName ? 'border-green-400 bg-green-50' : 'border-zinc-300 bg-zinc-50 hover:border-red-400'}`}>
              <input type="file" accept=".pdf,application/pdf" className="hidden" onChange={onFile} />
              <FileText size={24} className={fileName ? 'text-green-500' : 'text-zinc-400'} />
              <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">{busy ? 'Reading PDF…' : fileName ? fileName : 'Click to choose a PDF'}</span>
              <span className="text-[8px] text-zinc-400">Columns: Name, Team, Camp (one player per row)</span>
            </label>

            {pdfError && <p className="shrink-0 mt-3 text-[10px] font-bold text-red-500 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{pdfError}</p>}

            {rows.length > 0 && (
              <>
                <div className="flex-1 min-h-0 mt-4 overflow-y-auto rounded-2xl border border-zinc-200">
                  <div className="sticky top-0 bg-zinc-100 grid grid-cols-[1fr_1fr_1fr] gap-2 px-3 py-2 text-[8px] font-black uppercase tracking-wider text-zinc-500">
                    <span>Name</span><span>Team</span><span>Camp</span>
                  </div>
                  {rows.map((r, i) => (
                    <div key={i} className={`grid grid-cols-[1fr_1fr_1fr] gap-2 px-3 py-1.5 ${i>0?'border-t border-zinc-100':''}`}>
                      <input value={r.name} onChange={e => updateRow(i, 'name', e.target.value)} className="text-[11px] font-bold outline-none border-b border-transparent focus:border-red-400 px-1 py-0.5"/>
                      <input value={r.team || ''} onChange={e => updateRow(i, 'team', e.target.value)} className="text-[11px] outline-none border-b border-transparent focus:border-red-400 px-1 py-0.5"/>
                      <input value={r.camp || ''} onChange={e => updateRow(i, 'camp', e.target.value)} className="text-[11px] outline-none border-b border-transparent focus:border-red-400 px-1 py-0.5"/>
                    </div>
                  ))}
                </div>
                <p className="shrink-0 mt-2 text-[8px] font-black uppercase tracking-wider text-zinc-400">{rows.length} player(s) detected — review/edit then confirm</p>
                <div className="shrink-0 flex gap-3 mt-3">
                  <button onClick={() => setPdfOpen(false)} className="flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-wider border border-zinc-300 bg-zinc-100">Cancel</button>
                  <button onClick={confirmImport} className="flex items-center justify-center gap-1.5 flex-[2] py-3 bg-[#E30613] text-white rounded-xl text-[10px] font-black uppercase tracking-wider hover:bg-red-700">
                    <Check size={13}/> Import {rows.filter(r => r.name && r.name.trim()).length}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      , document.body)
      }
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
