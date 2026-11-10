"use client"
import React, { useEffect, useMemo, useRef, useState } from "react"
import { ChevronLeft, Plus, Trash2, Link2, Upload, Play, X, Radio, ExternalLink, Square } from "lucide-react"
import { Select } from "@/components/pickers"
import { videoPlayback } from "@/lib/video-embed"
import { signedVideoUrl, uploadLibraryVideo, VIDEO_MAX_BYTES, type LibraryVideo } from "@/lib/app-data"

type Kind = LibraryVideo["kind"]
type NewVideo = {
  title: string; description: string; kind: Kind; teamCategory: string | null
  source: "link" | "upload"; url?: string; filePath?: string; fileName?: string; sizeBytes?: number
}

type Props = {
  onClose: () => void
  videos: LibraryVideo[]
  canManage: boolean
  teamCat: string | null
  onAdd: (v: NewVideo) => Promise<{ error?: string | null }>
  onDelete: (v: LibraryVideo) => Promise<void>
  onEndStream: (v: LibraryVideo) => Promise<void>
  tr: any
}

const CATS = [
  { value: "SENIORS", label: "Seniors" },
  { value: "U20", label: "U-20" },
  { value: "U17", label: "U-17" },
]
const KINDS: Kind[] = ["live", "match", "highlight", "training"]

const formatSize = (b: number | null) => {
  if (!b) return ""
  if (b >= 1024 ** 3) return `${(b / 1024 ** 3).toFixed(1)} GB`
  return `${(b / 1024 / 1024).toFixed(b > 10 * 1024 * 1024 ? 0 : 1)} MB`
}

// Preview picture for YouTube links; everything else gets a plain tile.
function youtubeThumb(url: string | null): string | null {
  if (!url) return null
  const p = videoPlayback(url)
  const m = p?.type === "iframe" ? p.src.match(/youtube\.com\/embed\/([\w-]+)/) : null
  return m ? `https://img.youtube.com/vi/${m[1]}/hqdefault.jpg` : null
}

function Player({ v, onClose, tr }: { v: LibraryVideo; onClose: () => void; tr: any }) {
  const [src, setSrc] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  const playback = useMemo(() => (v.source === "link" ? videoPlayback(v.url || "") : null), [v])

  useEffect(() => {
    let alive = true
    if (v.source === "upload" && v.file_path) {
      signedVideoUrl(v.file_path).then(u => { if (!alive) return; u ? setSrc(u) : setFailed(true) })
    }
    return () => { alive = false }
  }, [v])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  const fileSrc = v.source === "upload" ? src : playback?.type === "file" ? playback.src : null
  return (
    <div className="fixed inset-0 z-[400] flex items-center justify-center p-3 sm:p-6 bg-black/85" onClick={onClose} role="dialog" aria-modal="true" aria-label={v.title}>
      <div className="w-full max-w-4xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-3 mb-2">
          <div className="min-w-0 flex items-center gap-2">
            {v.kind === "live" && <LiveBadge tr={tr} />}
            <p className="text-[14px] font-black uppercase tracking-tight text-white truncate">{v.title}</p>
          </div>
          <button onClick={onClose} title={tr.library.close} className="shrink-0 p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition-all"><X size={16} /></button>
        </div>
        <div className="aspect-video w-full rounded-2xl overflow-hidden bg-black border border-white/10">
          {playback?.type === "iframe" ? (
            <iframe src={playback.src} title={v.title} className="w-full h-full" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />
          ) : fileSrc ? (
            <video src={fileSrc} controls autoPlay playsInline className="w-full h-full bg-black" />
          ) : failed || (v.source === "link" && !playback) ? (
            <div className="w-full h-full flex flex-col items-center justify-center gap-3 text-center px-6">
              <p className="text-[12px] font-bold text-white/80">{tr.library.loadFail}</p>
              {v.url && <a href={v.url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/25 text-white text-[10px] font-black uppercase tracking-wider"><ExternalLink size={11} /> {tr.library.openLink}</a>}
            </div>
          ) : (
            <div className="w-full h-full flex items-center justify-center text-white/60 text-[12px] font-bold">{tr.common.loading}</div>
          )}
        </div>
        {v.description && <p className="mt-3 text-[12px] font-bold text-white/75">{v.description}</p>}
      </div>
    </div>
  )
}

function LiveBadge({ tr }: { tr: any }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#E30613] text-white text-[9px] font-black uppercase tracking-widest">
      <span className="w-1.5 h-1.5 rounded-full bg-white motion-safe:animate-pulse" />{tr.library.live}
    </span>
  )
}

export function VideoLibrary({ onClose, videos, canManage, teamCat, onAdd, onDelete, onEndStream, tr }: Props) {
  const L = tr.library
  const [filter, setFilter] = useState<"all" | Kind>("all")
  const [formOpen, setFormOpen] = useState(false)
  const [title, setTitle] = useState("")
  const [desc, setDesc] = useState("")
  const [kind, setKind] = useState<Kind>("highlight")
  const [cat, setCat] = useState(teamCat || "SENIORS")
  const [source, setSource] = useState<"link" | "upload">("link")
  const [url, setUrl] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [progress, setProgress] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [playing, setPlaying] = useState<LibraryVideo | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const live = videos.filter(v => v.kind === "live")
  const shown = videos.filter(v => v.kind !== "live" && (filter === "all" || v.kind === filter))
  const showLive = filter === "all" || filter === "live"

  const reset = () => { setTitle(""); setDesc(""); setUrl(""); setFile(null); setProgress(null); setErr(null); if (fileRef.current) fileRef.current.value = "" }

  const submit = async () => {
    setErr(null)
    if (!title.trim()) { setErr(L.needTitle); return }
    if (source === "link") {
      if (!url.trim()) { setErr(L.needSource); return }
      if (!videoPlayback(url)) { setErr(L.invalidLink); return }
      setBusy(true)
      const res = await onAdd({ title, description: desc, kind, teamCategory: cat, source: "link", url })
      setBusy(false)
      if (res.error) { setErr(res.error); return }
    } else {
      if (!file) { setErr(L.needSource); return }
      if (file.size > VIDEO_MAX_BYTES) { setErr(L.tooBig); return }
      setBusy(true); setProgress(0)
      const up = await uploadLibraryVideo(file, setProgress)
      if (!up.path) { setBusy(false); setProgress(null); setErr(up.error === "tooBig" ? L.tooBig : up.error === "serverLimit" ? L.serverLimit : up.error || L.loadFail); return }
      const res = await onAdd({ title, description: desc, kind, teamCategory: cat, source: "upload", filePath: up.path, fileName: file.name, sizeBytes: file.size })
      setBusy(false); setProgress(null)
      if (res.error) { setErr(res.error); return }
    }
    reset(); setFormOpen(false)
  }

  const Card = ({ v, wide }: { v: LibraryVideo; wide?: boolean }) => {
    const thumb = youtubeThumb(v.url)
    const isLive = v.kind === "live"
    return (
      <div className={`w-full sm:w-[calc(50%-0.375rem)] ${wide ? "" : "lg:w-[calc(33.333%-0.5rem)]"} rounded-2xl border bg-[var(--c-panel2)]/50 overflow-hidden flex flex-col ${isLive ? "border-[#E30613]/50" : "border-[rgba(var(--line-rgb),.14)]"}`}>
        <button onClick={() => setPlaying(v)} aria-label={`${L.watch}: ${v.title}`}
          className="group relative aspect-video w-full bg-gradient-to-br from-[#0d1f3c] to-[#1a2f55] flex items-center justify-center overflow-hidden">
          {thumb && <img src={thumb} alt="" loading="lazy" onError={e => { e.currentTarget.style.display = "none" }} className="absolute inset-0 w-full h-full object-cover opacity-90" />}
          <span className="relative w-12 h-12 rounded-full bg-black/55 border border-white/30 flex items-center justify-center text-white transition-transform group-hover:scale-105"><Play size={18} fill="currentColor" /></span>
          {isLive && <span className="absolute top-2 left-2"><LiveBadge tr={tr} /></span>}
        </button>
        <div className="p-3.5 flex flex-col gap-2 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[13px] font-black uppercase tracking-tight text-[var(--c-text)] leading-snug">{v.title}</p>
              <p className="mt-1 flex items-center gap-1.5 flex-wrap text-[10px] font-bold text-[var(--c-textDim)]">
                <span className="px-1.5 py-0.5 rounded bg-[var(--c-panel3)] text-[9px] font-black uppercase tracking-wider">{L.kindOne[v.kind]}</span>
                {v.team_category && <span className="px-1.5 py-0.5 rounded bg-[var(--c-panel3)] text-[9px] font-black uppercase tracking-wider">{v.team_category}</span>}
                <span>{new Date(v.created_at).toLocaleDateString()}</span>
                {v.source === "upload" && v.size_bytes ? <span>{formatSize(v.size_bytes)}</span> : null}
              </p>
            </div>
            {canManage && (
              <button onClick={() => onDelete(v)} title={tr.common.delete} className="shrink-0 p-1.5 rounded-lg text-[var(--c-textDim)] hover:bg-[#E30613] hover:text-white transition-all"><Trash2 size={13} /></button>
            )}
          </div>
          {v.description && <p className="text-[11px] font-bold text-[var(--c-textDim)] line-clamp-2">{v.description}</p>}
          <div className="mt-auto flex items-center justify-between gap-2 pt-1">
            {v.created_by_username ? <p className="text-[9px] font-bold text-[var(--c-textFaint)] uppercase tracking-wider truncate">{L.addedBy} {v.created_by_username}</p> : <span />}
            {canManage && isLive && (
              <button onClick={() => onEndStream(v)} className="shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-lg border border-[#E30613]/50 text-[#ff6b7a] text-[9px] font-black uppercase tracking-wider hover:bg-[#E30613] hover:text-white transition-all">
                <Square size={9} fill="currentColor" /> {L.endStream}
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  const chip = (value: "all" | Kind, label: string) => (
    <button key={value} onClick={() => setFilter(value)} aria-pressed={filter === value}
      className={`px-3.5 py-1.5 rounded-full border text-[10px] font-black uppercase tracking-wider transition-all ${filter === value ? "bg-[#2d8cff] border-[#2d8cff] text-white" : "border-[rgba(var(--line-rgb),.2)] text-[var(--c-textDim)] hover:text-[var(--c-text)]"}`}>
      {label}
    </button>
  )

  const empty = videos.length === 0
  const nothingShown = !empty && shown.length === 0 && !(showLive && live.length > 0)

  return (
    <div className="min-h-screen flex flex-col">
      <div className="sticky top-0 z-[100] border-b border-[rgba(var(--line-rgb),.12)] bg-[var(--c-bg)]">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center gap-3">
          <button onClick={onClose} title={tr.common.back} className="p-2 rounded-xl border border-[rgba(var(--line-rgb),.2)] text-[var(--c-textDim)] hover:text-[var(--c-text)] hover:bg-[var(--c-panel3)]/60 transition-all shrink-0">
            <ChevronLeft size={17} />
          </button>
          <div className="leading-tight min-w-0">
            <h1 className="text-sm font-black italic uppercase tracking-wider text-[var(--c-text)] truncate">{L.title}</h1>
            <p className="text-[10px] font-black text-[#2d8cff] uppercase tracking-[0.3em] truncate">{L.subtitle}</p>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 pb-20 w-full">
        {canManage && (
          <button onClick={() => setFormOpen(v => !v)} className="mt-6 w-full flex items-center justify-center gap-3 py-5 px-6 rounded-2xl bg-gradient-to-r from-[#1a5fc4] via-[#2d8cff] to-[#5fb0ff] text-white text-[13px] font-black uppercase tracking-widest shadow-xl shadow-[#2d8cff]/25 hover:shadow-[#2d8cff]/45 transition-all">
            <Plus size={16} strokeWidth={3} /> {L.add}
          </button>
        )}

        {formOpen && canManage && (
          <div className="mt-4 rounded-2xl border border-[rgba(var(--line-rgb),.16)] bg-[var(--c-panel2)]/60 p-5 space-y-3">
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder={L.titleLabel} maxLength={120} aria-label={L.titleLabel}
              className="w-full px-4 py-3 rounded-xl bg-[var(--c-panel3)] border border-[rgba(var(--line-rgb),.22)] text-[var(--c-text)] placeholder-[var(--c-textFaint)] text-[13px] font-bold outline-none focus:border-[#2d8cff]/50 transition-all" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Select variant="stage" allowEmpty={false} value={kind} onChange={(v: string) => setKind(v as Kind)} options={KINDS.map(k => ({ value: k, label: L.kindOne[k] }))} />
              <Select variant="stage" allowEmpty={false} value={cat} onChange={setCat} options={CATS} />
            </div>

            <div className="flex gap-2" role="tablist">
              {([["link", L.sourceLink, Link2], ["upload", L.sourceUpload, Upload]] as const).map(([val, label, Icon]) => (
                <button key={val} role="tab" aria-selected={source === val} onClick={() => { setSource(val); setErr(null) }}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border text-[11px] font-black uppercase tracking-wider transition-all ${source === val ? "border-[#2d8cff] bg-[#2d8cff]/12 text-[#2d8cff]" : "border-[rgba(var(--line-rgb),.2)] text-[var(--c-textDim)] hover:text-[var(--c-text)]"}`}>
                  <Icon size={13} /> {label}
                </button>
              ))}
            </div>

            {source === "link" ? (
              <div>
                <input value={url} onChange={e => setUrl(e.target.value)} placeholder={L.linkPh} inputMode="url" aria-label={L.linkPh}
                  className="w-full px-4 py-3 rounded-xl bg-[var(--c-panel3)] border border-[rgba(var(--line-rgb),.22)] text-[var(--c-text)] placeholder-[var(--c-textFaint)] text-[13px] font-bold outline-none focus:border-[#2d8cff]/50 transition-all" />
                <p className="mt-1.5 text-[10px] font-bold text-[var(--c-textFaint)]">{L.linkHelp}</p>
              </div>
            ) : (
              <div>
                <input ref={fileRef} type="file" accept="video/mp4,video/quicktime,video/webm" className="sr-only" id="library-file" aria-label={L.chooseFile}
                  onChange={e => { const f = e.target.files?.[0] || null; setFile(f); setErr(f && f.size > VIDEO_MAX_BYTES ? L.tooBig : null) }} />
                <label htmlFor="library-file" className="flex items-center justify-center gap-2 px-4 py-4 rounded-xl border-2 border-dashed border-[rgba(var(--line-rgb),.3)] text-[var(--c-textDim)] text-[12px] font-black uppercase tracking-wider cursor-pointer hover:border-[#2d8cff]/60 hover:text-[var(--c-text)] transition-all">
                  <Upload size={14} /> {file ? `${file.name} · ${formatSize(file.size)}` : L.chooseFile}
                </label>
                <p className="mt-1.5 text-[10px] font-bold text-[var(--c-textFaint)]">{L.fileHelp}</p>
                {progress !== null && (
                  <div className="mt-2" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
                    <div className="h-2 rounded-full bg-[var(--c-panel3)] overflow-hidden"><div className="h-full bg-[#2d8cff] transition-[width]" style={{ width: `${progress}%` }} /></div>
                    <p className="mt-1 text-[10px] font-black uppercase tracking-wider text-[var(--c-textDim)]">{L.uploading} {progress}%</p>
                  </div>
                )}
              </div>
            )}

            <input value={desc} onChange={e => setDesc(e.target.value)} placeholder={L.descLabel} maxLength={300} aria-label={L.descLabel}
              className="w-full px-4 py-3 rounded-xl bg-[var(--c-panel3)] border border-[rgba(var(--line-rgb),.22)] text-[var(--c-text)] placeholder-[var(--c-textFaint)] text-[13px] font-bold outline-none focus:border-[#2d8cff]/50 transition-all" />

            {err && <p role="alert" className="text-[11px] font-bold text-[#ff4f66]">{err}</p>}
            <div className="flex justify-end gap-2">
              <button onClick={() => { reset(); setFormOpen(false) }} disabled={busy} className="px-5 py-2.5 rounded-xl border border-[rgba(var(--line-rgb),.2)] text-[var(--c-textDim)] text-[11px] font-black uppercase tracking-wider disabled:opacity-40">{tr.common.cancel}</button>
              <button onClick={submit} disabled={busy} className="px-6 py-2.5 rounded-xl bg-[#2d8cff] text-white text-[11px] font-black uppercase tracking-wider disabled:opacity-40">{busy ? "…" : tr.common.save}</button>
            </div>
          </div>
        )}

        {!empty && (
          <div className="mt-6 flex gap-2 flex-wrap justify-center">
            {chip("all", L.all)}
            {KINDS.map(k => chip(k, L.kinds[k]))}
          </div>
        )}

        {empty && !formOpen && (
          <div className="mt-8 flex flex-col items-center justify-center py-20 gap-3 rounded-3xl border-2 border-dashed border-[rgba(var(--line-rgb),.18)] text-center px-6">
            <Radio size={28} className="text-[var(--c-textDim)]" />
            <p className="text-[12px] font-black uppercase tracking-widest text-[var(--c-textDim)]">{L.none}</p>
            {canManage && <p className="text-[11px] font-bold text-[var(--c-textFaint)]">{L.noneManage}</p>}
          </div>
        )}

        {showLive && live.length > 0 && (
          <div className="mt-6 flex flex-wrap justify-center gap-3">{live.map(v => <Card key={v.id} v={v} wide />)}</div>
        )}
        {shown.length > 0 && (
          <div className="mt-6 flex flex-wrap justify-center gap-3">{shown.map(v => <Card key={v.id} v={v} />)}</div>
        )}
        {nothingShown && <p className="mt-10 text-center text-[12px] font-black uppercase tracking-widest text-[var(--c-textDim)]">{L.noneFiltered}</p>}
      </div>

      {playing && <Player v={playing} onClose={() => setPlaying(null)} tr={tr} />}
    </div>
  )
}
