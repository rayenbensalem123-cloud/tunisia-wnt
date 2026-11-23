"use client"
import React, { useState, useRef, useLayoutEffect, useEffect } from "react"
import { createPortal } from "react-dom"
import { Download, Upload, Printer, FileSpreadsheet, FileJson, X, FileText, Check } from "lucide-react"
import { useTranslate } from "@/lib/language-context"
import { useFileDrop, isPdfFile, isImageFile } from "@/lib/use-file-drop"
import { authHeaders } from "@/lib/auth-headers"
import { norm } from "@/lib/callups"

type ImportRow = { name: string; team?: string; camp?: string; isNew?: boolean }

type Props = {
  members: any[]
  matches: any[]
  teamCat: string | null
  onImport: (data: { members: any[]; matches: any[] }) => void
  onImportPlayers?: (rows: { name: string; team?: string; camp?: string }[]) => void
  camps?: any[]
  // Fetched on demand (not pre-loaded into app state) so the full backup
  // stays cheap for callers who never open this menu. Omit either to leave
  // that data out of the backup — e.g. a non-medical exporter never gets
  // the injuries fetcher passed in, so it's just absent from the file.
  fetchInjuriesAll?: () => Promise<any[]>
  fetchClubReportsAll?: () => Promise<any[]>
}

export function ExportTools({ members, matches, teamCat, onImport, onImportPlayers, camps, fetchInjuriesAll, fetchClubReportsAll }: Props) {
  const { tr } = useTranslate()
  const [open, setOpen] = useState(false)
  // The parent menu is a scrollable dropdown, so this submenu is portalled to
  // the body and positioned next to the button — otherwise it renders on top
  // of the other menu items and gets clipped by the dropdown's overflow.
  const buttonRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const [importOpen, setImportOpen] = useState(false)
  const [importData, setImportData] = useState("")
  const [pdfOpen, setPdfOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [pdfError, setPdfError] = useState("")
  const [rows, setRows] = useState<ImportRow[]>([])
  const [fileName, setFileName] = useState("")
  const [scanInfo, setScanInfo] = useState("")

  const placeMenu = () => {
    const b = buttonRef.current?.getBoundingClientRect()
    const m = menuRef.current?.getBoundingClientRect()
    if (!b || !m) return
    const gap = 8
    const pad = 8
    let left = b.left - m.width - gap // open to the left of the menu
    if (left < pad) left = Math.min(b.right + gap, window.innerWidth - m.width - pad)
    if (left < pad) left = pad
    let top = b.top
    const maxTop = window.innerHeight - m.height - pad
    if (top > maxTop) top = Math.max(pad, maxTop)
    setPos({ top, left })
  }

  useLayoutEffect(() => { if (open) placeMenu() }, [open])
  useEffect(() => {
    if (!open) return
    const onMove = () => placeMenu()
    window.addEventListener('resize', onMove)
    window.addEventListener('scroll', onMove, true)
    return () => {
      window.removeEventListener('resize', onMove)
      window.removeEventListener('scroll', onMove, true)
    }
  }, [open])

  const catMembers = members.filter(m => m.teamCategory === teamCat)

  const exportCSV = () => {
    const headers = ["Name", "Position", "Club", "Age", "Caps", "Goals", "Assists", "Yellow Cards", "Red Cards", "Suspended", "FIFA Connect ID"]
    const rows = catMembers.map((m: any) => [
      m.name, m.position, m.club, m.birthdate ? calculateAge(m.birthdate) : "N/A",
      m.natMatches || "0", m.goals || "0", m.assists || "0",
      m.yellowCards || 0, m.redCards || 0, m.suspended ? "YES" : "NO", m.fifaConnectId || ""
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

  const exportFullJSON = async () => {
    setBusy(true)
    const [injuries, clubReports] = await Promise.all([
      fetchInjuriesAll ? fetchInjuriesAll() : Promise.resolve(undefined),
      fetchClubReportsAll ? fetchClubReportsAll() : Promise.resolve(undefined),
    ])
    const data: any = {
      exportedAt: new Date().toISOString(),
      members,
      matches,
      camps: camps || [],
    }
    if (injuries) data.injuries = injuries
    if (clubReports) data.clubMatchReports = clubReports
    setBusy(false)
    download(JSON.stringify(data, null, 2), `full-backup-${new Date().toISOString().split("T")[0]}.json`, "application/json")
  }

  const exportClubReportsCSV = async () => {
    if (!fetchClubReportsAll) return
    setBusy(true)
    const reports = await fetchClubReportsAll()
    setBusy(false)
    const byId = new Map(members.map((m: any) => [m.id, m.name]))
    const headers = ["Player", "Date", "Opponent", "Competition", "Minutes", "Goals", "Assists", "Yellow Cards", "Red Cards", "Result", "Notes"]
    const rows = reports.map((r: any) => [
      byId.get(r.member_id) || r.member_id, r.match_date || "", r.opponent || "", r.competition || "",
      r.minutes_played ?? "", r.goals ?? 0, r.assists ?? 0, r.yellow_cards ?? 0, r.red_cards ?? 0, r.result || "", r.notes || "",
    ])
    const csv = [headers.join(","), ...rows.map((r: any) => r.map((v: any) => `"${String(v).replace(/"/g, '""')}"`).join(","))].join("\n")
    download(csv, `club-match-reports-${new Date().toISOString().split("T")[0]}.csv`, "text/csv")
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

  const openPdf = () => { setPdfOpen(true); setRows([]); setFileName(""); setPdfError(""); setScanInfo(""); setBusy(false) }

  const handleFiles = async (files: File[]) => {
    const accepted = files.filter((f) => isPdfFile(f) || isImageFile(f))
    if (!accepted.length) { setPdfError(tr.importPlayers.couldNotProcess + 'PDF / PNG / JPG / WEBP'); return }
    if (accepted.length > 8) { setPdfError('Up to 8 files at a time'); return }
    setBusy(true); setPdfError(""); setScanInfo(""); setRows([])
    setFileName(accepted.map((f) => f.name).join(", "))
    try {
      const fd = new FormData()
      for (const f of accepted) fd.append('file', f, f.name)
      fd.append('campNames', JSON.stringify((camps || []).map((c: any) => c.name).filter(Boolean)))
      const r = await fetch('/api/import-players', { method: 'POST', headers: await authHeaders(), body: fd })
      const d = await r.json()
      if (!r.ok || d.error) {
        setPdfError(d.error || 'Could not read the files')
      } else {
        // Compare against every player card in the platform, not just the
        // currently selected team category.
        const known = new Set(members.filter((m: any) => m.role === 'PLAYERS').map((m: any) => norm(m.name)))
        setRows((d.rows || []).map((row: ImportRow) => ({ ...row, isNew: !known.has(norm(row.name)) })))
        const bits: string[] = []
        if (d.ocredPages) bits.push(`${d.ocredPages} OCR`)
        if (d.scannedPages) bits.push(`${d.scannedPages} scanned`)
        if (bits.length) setScanInfo(bits.join(' · '))
        if (d.scannedPages > 0 && !d.ocredPages && !(d.rows || []).length) {
          setPdfError(`${d.scannedPages} ${tr.importPlayers.scannedNoText}`)
        }
      }
    } catch (e: any) {
      setPdfError(tr.importPlayers.couldNotProcess + (e?.message || 'unknown'))
    }
    setBusy(false)
  }
  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    e.target.value = ""
    if (files.length) handleFiles(files)
  }
  const pdfDrop = useFileDrop((files) => handleFiles(files), (f) => isPdfFile(f) || isImageFile(f))

  const updateRow = (i: number, key: 'name' | 'team' | 'camp', val: string) => {
    setRows(prev => prev.map((r, idx) => idx === i ? { ...r, [key]: val } : r))
  }

  const confirmImport = () => {
    const valid = rows.filter(r => r.name && r.name.trim())
    if (!valid.length) return
    onImportPlayers?.(valid.map(({ name, team, camp }) => ({ name, team, camp })))
    setPdfOpen(false); setRows([]); setFileName(""); setOpen(false)
  }

  return (
    <div ref={buttonRef} className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-zinc-300 bg-white text-zinc-500 hover:text-zinc-900 text-[11px] font-black uppercase tracking-widest transition-all"
      >
        <Download size={14} />
        <span className="hidden sm:inline">{tr.exportTools.export}</span>
      </button>

      {open && typeof document !== "undefined" && createPortal(
        <div onMouseDownCapture={(e) => e.stopPropagation()}>
          <div className="fixed inset-0 z-[180]" onClick={() => setOpen(false)} />
          <div ref={menuRef} style={{ top: pos.top, left: pos.left }} className="fixed z-[190] w-56 rounded-2xl border border-zinc-200 bg-white shadow-2xl max-h-[calc(100dvh-1rem)] overflow-y-auto text-zinc-900">
            <div className="divide-y divide-zinc-200">
              <button onClick={() => { exportCSV(); setOpen(false) }} className="w-full text-left px-4 py-3 flex items-center gap-3 text-[11px] font-black uppercase transition-all hover:bg-zinc-50">
                <FileSpreadsheet size={13} className="text-green-500" /> {tr.exportTools.csvRoster}
              </button>
              <button onClick={() => { exportJSON(); setOpen(false) }} className="w-full text-left px-4 py-3 flex items-center gap-3 text-[11px] font-black uppercase transition-all hover:bg-zinc-50">
                <FileJson size={13} className="text-blue-500" /> {tr.exportTools.jsonCategory}
              </button>
              <button onClick={() => { setOpen(false); exportFullJSON() }} className="w-full text-left px-4 py-3 flex items-center gap-3 text-[11px] font-black uppercase transition-all hover:bg-zinc-50">
                <FileJson size={13} className="text-[#E30613]" /> {tr.exportTools.jsonFullBackup}
              </button>
              {fetchClubReportsAll && (
                <button onClick={() => { setOpen(false); exportClubReportsCSV() }} className="w-full text-left px-4 py-3 flex items-center gap-3 text-[11px] font-black uppercase transition-all hover:bg-zinc-50">
                  <FileSpreadsheet size={13} className="text-emerald-500" /> {tr.exportTools.csvClubReports}
                </button>
              )}
              <button onClick={() => { setOpen(false); setImportOpen(true) }} className="w-full text-left px-4 py-3 flex items-center gap-3 text-[11px] font-black uppercase transition-all hover:bg-zinc-50">
                <Upload size={13} className="text-orange-500" /> {tr.exportTools.importJson}
              </button>
              {onImportPlayers && (
                <button onClick={() => { setOpen(false); openPdf() }} className="w-full text-left px-4 py-3 flex items-center gap-3 text-[11px] font-black uppercase transition-all hover:bg-zinc-50">
                  <FileText size={13} className="text-red-500" /> {tr.exportTools.importPlayersPdf}
                </button>
              )}
              <div className="h-px bg-zinc-200" />
              <button onClick={() => { handlePrint(); setOpen(false) }} className="w-full text-left px-4 py-3 flex items-center gap-3 text-[11px] font-black uppercase transition-all hover:bg-zinc-50">
                <Printer size={13} /> {tr.exportTools.printRoster}
              </button>
            </div>
          </div>
        </div>
      , document.body)}

      {
  importOpen && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/80" onMouseDownCapture={(e) => e.stopPropagation()}>
          <div className="w-full max-w-lg p-6 rounded-[2rem] border border-zinc-200 bg-white text-zinc-900">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-black italic uppercase tracking-tighter">{tr.exportTools.importJson}</h2>
              <button onClick={() => setImportOpen(false)} className="p-2 hover:bg-red-500/10 rounded-xl"><X size={20} /></button>
            </div>
            <textarea
              value={importData}
              onChange={e => setImportData(e.target.value)}
              placeholder={tr.exportTools.pasteJsonHere}
              rows={8}
              className="w-full p-3 rounded-xl border border-zinc-200 bg-zinc-50 text-[12px] font-bold outline-none resize-none"
            />
            <div className="flex gap-3 mt-4">
              <button onClick={() => setImportOpen(false)} className="flex-1 py-3 rounded-xl text-[12px] font-black uppercase tracking-wider border border-zinc-300 bg-zinc-100">{tr.common.cancel}</button>
              <button onClick={handleImport} className="flex-[2] py-3 bg-[#E30613] text-white rounded-xl text-[12px] font-black uppercase tracking-wider">{tr.exportTools.import}</button>
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
                <h2 className="text-xl font-black italic uppercase tracking-tighter">{tr.exportTools.importPlayersPdf}</h2>
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-400 mt-1">{tr.importPlayers.ocrNote}</p>
              </div>
              <button onClick={() => setPdfOpen(false)} className="p-2 hover:bg-red-500/10 rounded-xl"><X size={20} /></button>
            </div>

            <label {...pdfDrop.dropProps} className={`shrink-0 flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-6 cursor-pointer transition-all ${pdfDrop.isDragging ? 'border-red-400 bg-red-50 scale-[1.01]' : fileName ? 'border-green-400 bg-green-50' : 'border-zinc-300 bg-zinc-50 hover:border-red-400'}`}>
              <input type="file" multiple accept=".pdf,application/pdf,image/png,image/jpeg,image/webp" className="hidden" onChange={onFile} />
              <FileText size={24} className={fileName ? 'text-green-500' : 'text-zinc-400'} />
              <span className="text-[12px] font-black uppercase tracking-widest text-zinc-500">{busy ? tr.importPlayers.readingPdf : fileName ? fileName : tr.importPlayers.clickToChoosePdf}</span>
              <span className="text-[10px] text-zinc-400">{tr.importPlayers.columnsNote}</span>
            </label>

            {pdfError && <p className="shrink-0 mt-3 text-[12px] font-bold text-red-500 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{pdfError}</p>}
            {scanInfo && <p className="shrink-0 mt-2 text-[10px] font-black uppercase tracking-wider text-emerald-600">{scanInfo}</p>}

            {rows.length > 0 && (
              <>
                <div className="flex-1 min-h-0 mt-4 overflow-y-auto rounded-2xl border border-zinc-200">
                  <div className="sticky top-0 bg-zinc-100 grid grid-cols-[1fr_1fr_1fr] gap-2 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-zinc-500">
                    <span>{tr.importPlayers.nameHeader}</span><span>{tr.importPlayers.teamHeader}</span><span>{tr.importPlayers.campHeader}</span>
                  </div>
                  {rows.map((r, i) => (
                    <div key={i} className={`grid grid-cols-[1fr_1fr_1fr] gap-2 px-3 py-1.5 ${i>0?'border-t border-zinc-100':''}`}>
                      <div className="min-w-0">
                        <input value={r.name} onChange={e => updateRow(i, 'name', e.target.value)} className="w-full text-[13px] font-bold outline-none border-b border-transparent focus:border-red-400 px-1 py-0.5"/>
                        <span className={`text-[8px] font-black uppercase tracking-wider ${r.isNew ? 'text-red-500' : 'text-emerald-600'}`}>
                          {r.isNew ? tr.importPlayers.newBadge : tr.importPlayers.existingBadge}
                        </span>
                      </div>
                      <input value={r.team || ''} onChange={e => updateRow(i, 'team', e.target.value)} className="w-full text-[13px] outline-none border-b border-transparent focus:border-red-400 px-1 py-0.5"/>
                      <input value={r.camp || ''} onChange={e => updateRow(i, 'camp', e.target.value)} className="w-full text-[13px] outline-none border-b border-transparent focus:border-red-400 px-1 py-0.5"/>
                    </div>
                  ))}
                </div>
                <p className="shrink-0 mt-2 text-[10px] font-black uppercase tracking-wider text-zinc-400">{rows.length} {tr.importPlayers.playersDetectedNote}</p>
                <div className="shrink-0 flex gap-3 mt-3">
                  <button onClick={() => setPdfOpen(false)} className="flex-1 py-3 rounded-xl text-[12px] font-black uppercase tracking-wider border border-zinc-300 bg-zinc-100">{tr.common.cancel}</button>
                  <button onClick={confirmImport} className="flex items-center justify-center gap-1.5 flex-[2] py-3 bg-[#E30613] text-white rounded-xl text-[12px] font-black uppercase tracking-wider hover:bg-red-700">
                    <Check size={13}/> {tr.importPlayers.importCount} {rows.filter(r => r.name && r.name.trim()).length}
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
