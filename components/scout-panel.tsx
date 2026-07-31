"use client"
import React, { useState } from "react"
import { Search, Sparkles, Database, Globe, Loader2, X, Check, AlertCircle } from "lucide-react"
import { getScoutingLinks } from "@/lib/external-data"

type ScoutPanelProps = {
  player: any
  onUpdatePlayer: (updated: any) => void
}

type FieldCheck = {
  club: boolean
  position: boolean
  birthdate: boolean
  height: boolean
  natMatches: boolean
  goals: boolean
  assists: boolean
  history: boolean
}

export function ScoutPanel({ player, onUpdatePlayer }: ScoutPanelProps) {
  const [searching, setSearching] = useState(false)
  const [status, setStatus] = useState<"idle" | "loading" | "done">("idle")
  const [showModal, setShowModal] = useState(false)
  const [wikiData, setWikiData] = useState<any>(null)
  const [dbData, setDbData] = useState<any>(null)
  const [useWiki, setUseWiki] = useState<FieldCheck>({
    club: false, position: false, birthdate: false, height: false,
    natMatches: false, goals: false, assists: false, history: false,
  })

  const links = getScoutingLinks(player.name)

  const toggleField = (field: keyof FieldCheck) => {
    setUseWiki(prev => ({ ...prev, [field]: !prev[field] }))
  }

  const handleLiveScout = async () => {
    setSearching(true)
    setStatus("loading")

    try {
      const res = await fetch("/api/scout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: player.name }),
      })

      if (res.ok) {
        const result = await res.json()
        if (result.sources) {
          setDbData(result.sources.database)
          setWikiData(result.sources.wikipedia)
          const w = result.sources.wikipedia
          if (w) {
            setUseWiki({
              club: !!w.club, position: !!w.position, birthdate: !!w.birthdate, height: !!w.height,
              natMatches: w.natMatches != null, goals: w.goals != null, assists: w.assists != null,
              history: !!(w.history?.length),
            })
          }
          setShowModal(true)
          setStatus("done")
        } else {
          setStatus("idle")
        }
      } else {
        setStatus("idle")
      }
    } catch {
      setStatus("idle")
    }

    setSearching(false)
  }

  const applySelection = () => {
    if (!dbData && !wikiData) return

    const src = useWiki.club || useWiki.position || useWiki.birthdate || useWiki.height ||
                useWiki.natMatches || useWiki.goals || useWiki.assists || useWiki.history
      ? wikiData : dbData

    if (!src) return

    const updated: any = { ...player }

    if (useWiki.club && wikiData?.club) updated.club = wikiData.club
    else if (dbData?.club) updated.club = dbData.club

    if (useWiki.position && wikiData?.position) updated.position = wikiData.position
    else if (dbData?.position) updated.position = dbData.position

    if (useWiki.birthdate && wikiData?.birthdate) updated.birthdate = wikiData.birthdate
    else if (dbData?.birthdate) updated.birthdate = dbData.birthdate

    if (useWiki.height && wikiData?.height) updated.height = wikiData.height
    else if (dbData?.height) updated.height = dbData.height

    if (useWiki.natMatches && wikiData?.natMatches) updated.natMatches = String(wikiData.natMatches)
    else if (dbData?.natMatches) updated.natMatches = String(dbData.natMatches)

    if (useWiki.goals && wikiData?.goals !== undefined) updated.goals = String(wikiData.goals)
    else if (dbData?.goals !== undefined) updated.goals = String(dbData.goals)

    if (useWiki.assists && wikiData?.assists !== undefined) updated.assists = String(wikiData.assists)
    else if (dbData?.assists !== undefined) updated.assists = String(dbData.assists)

    if (useWiki.history && wikiData?.history?.length) updated.history = wikiData.history.filter((h:any)=>h.year&&!h.year.startsWith("0000"))
    else if (dbData?.history?.length) updated.history = dbData.history.filter((h:any)=>h.year&&!h.year.startsWith("0000"))

    onUpdatePlayer(updated)
    setShowModal(false)
    setStatus("idle")
  }

  const selectAllWiki = () => setUseWiki({
    club: true, position: true, birthdate: true, height: true,
    natMatches: true, goals: true, assists: true, history: true,
  })

  const selectAllDb = () => setUseWiki({
    club: false, position: false, birthdate: false, height: false,
    natMatches: false, goals: false, assists: false, history: false,
  })

  const formatVal = (v: any) => v != null && v !== "" ? String(v) : "—"

  const fields: { key: keyof FieldCheck; label: string }[] = [
    { key: "club", label: "Club" },
    { key: "position", label: "Position" },
    { key: "birthdate", label: "Birthdate" },
    { key: "height", label: "Height" },
    { key: "natMatches", label: "Caps" },
    { key: "goals", label: "Goals" },
    { key: "assists", label: "Assists" },
    { key: "history", label: "History" },
  ]

  return (
    <>
      <div className="p-4 rounded-2xl border border-zinc-200 bg-zinc-50 space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-[9px] font-black uppercase tracking-[0.3em] flex items-center gap-2">
            <Globe size={11} className="text-[#E30613]" />
            AI Web Search
          </h4>
          <button
            onClick={handleLiveScout}
            disabled={searching}
            className="text-[8px] font-black uppercase px-3 py-1.5 rounded-xl border border-zinc-300 text-zinc-500 hover:border-[#E30613] hover:text-[#E30613] transition-all flex items-center gap-1.5"
          >
            {searching ? <><Loader2 size={10} className="animate-spin" /> Searching...</> : <><Search size={10} /> Search Web</>}
          </button>
        </div>

        {status === "loading" && (
          <div className="p-2.5 rounded-xl border border-blue-200 bg-blue-50 text-blue-600 text-[9px] font-bold flex items-center gap-2">
            <Loader2 size={12} className="animate-spin" /> Searching Wikipedia + database...
          </div>
        )}

        <div className="flex gap-2 flex-wrap">
          <a href={links.transfermarkt} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-zinc-300 text-zinc-500 text-[8px] font-black uppercase tracking-wider transition-all hover:bg-blue-600 hover:text-white hover:border-blue-600">
            <Globe size={10} /> Transfermarkt
          </a>
          <a href={links.soccerdonna} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-zinc-300 text-zinc-500 text-[8px] font-black uppercase tracking-wider transition-all hover:bg-pink-600 hover:text-white hover:border-pink-600">
            <Globe size={10} /> SoccerDonna
          </a>
          <a href={links.google} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-zinc-300 text-zinc-500 text-[8px] font-black uppercase tracking-wider transition-all hover:bg-zinc-800 hover:text-white">
            <Globe size={10} /> Google
          </a>
        </div>
      </div>

      {/* Approval Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={() => setShowModal(false)}>
          <div className="w-full max-w-lg rounded-2xl border border-zinc-200 bg-white shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-zinc-200">
              <h3 className="text-[11px] font-black uppercase tracking-[0.2em] flex items-center gap-2">
                <Sparkles size={14} className="text-[#E30613]" /> AI Search Results
              </h3>
              <button onClick={() => setShowModal(false)} className="p-1.5 rounded-lg hover:bg-zinc-100 text-zinc-400 transition-colors">
                <X size={14} />
              </button>
            </div>

            <div className="p-4 space-y-2 max-h-[60vh] overflow-y-auto">
              {wikiData && (
                <div className="p-2.5 rounded-xl border border-blue-200 bg-blue-50 text-blue-600 text-[8px] font-bold flex items-center gap-2 mb-3">
                  <Globe size={11} /> Wikipedia found data for <span className="underline">{wikiData.name}</span>
                </div>
              )}

              <div className="flex gap-2 mb-3">
                <button onClick={selectAllDb} className="flex-1 py-1.5 rounded-xl border text-[8px] font-black uppercase tracking-wider transition-all hover:bg-green-600 hover:text-white hover:border-green-600 bg-green-600/10 border-green-600/30 text-green-600">
                  Use Database
                </button>
                {wikiData && (
                  <button onClick={selectAllWiki} className="flex-1 py-1.5 rounded-xl border text-[8px] font-black uppercase tracking-wider transition-all hover:bg-blue-600 hover:text-white hover:border-blue-600 bg-blue-600/10 border-blue-600/30 text-blue-600">
                    Use Wikipedia
                  </button>
                )}
              </div>

              <div className="grid grid-cols-[auto_1fr_1fr_auto] gap-x-3 gap-y-1.5 text-[9px] font-bold">
                <div className="text-zinc-500 uppercase tracking-wider">Field</div>
                <div className="text-green-500 uppercase tracking-wider text-center">Database</div>
                {wikiData && <div className="text-blue-500 uppercase tracking-wider text-center">Wikipedia</div>}
                <div className="text-zinc-500 uppercase tracking-wider text-right">Use</div>

                {fields.map(f => {
                  const dbVal = formatVal(dbData?.[f.key === "natMatches" ? "natMatches" : f.key === "goals" ? "goals" : f.key === "assists" ? "assists" : f.key === "history" ? (dbData?.history?.length + " entries") : dbData?.[f.key]])
                  const wikiVal = wikiData ? formatVal(f.key === "history" ? (wikiData?.history?.length + " entries") : wikiData?.[f.key]) : null
                  const checked = useWiki[f.key]

                  return (
                    <React.Fragment key={f.key}>
                      <div className="text-zinc-400">{f.label}</div>
                      <div className="text-center px-1.5 py-1 rounded-lg border border-green-200 bg-green-50">
                        {f.key === "history" ? `${dbData?.history?.length || 0} entries` : dbVal}
                      </div>
                      {wikiData && (
                        <div className={`text-center px-1.5 py-1 rounded-lg border ${checked ? 'border-blue-300 bg-blue-50' : 'border-zinc-200'}`}>
                          {f.key === "history" ? `${wikiData?.history?.length || 0} entries` : wikiVal}
                        </div>
                      )}
                      <button
                        onClick={() => toggleField(f.key)}
                        disabled={f.key === "assists" && !wikiData?.assists}
                        className={`p-1 rounded-lg border transition-all text-center ${
                          checked
                            ? 'bg-blue-600 border-blue-600 text-white'
                            : 'border-zinc-300 text-zinc-400 hover:border-zinc-400'
                        } ${f.key === "assists" && !wikiData?.assists ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'}`}
                      >
                        {checked ? <Check size={10} /> : null}
                      </button>
                    </React.Fragment>
                  )
                })}
              </div>
            </div>

            <div className="flex gap-2 p-4 border-t border-zinc-200">
              <button onClick={() => setShowModal(false)} className="flex-1 py-2.5 rounded-xl border border-zinc-300 text-zinc-500 hover:border-zinc-400 text-[9px] font-black uppercase tracking-wider">
                Cancel
              </button>
              <button onClick={applySelection} className="flex-1 py-2.5 rounded-xl border text-[9px] font-black uppercase tracking-wider bg-[#E30613] border-[#E30613] text-white hover:bg-red-700">
                Apply Selection
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
