'use client'
// Ligue Féminine: club teams and their players.
//   admin  -> grid of clubs (big centred logo) -> a club's player cards
//   club   -> straight to its own team page; can add and edit its players
// Players are ordinary `members` rows with team_category 'LIGUE' and a league_team_id,
// so saving goes through the app's existing members sync (RLS decides who may write what).
import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, LogOut, Plus, Trash2, X, Users, Pencil, Camera } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useTranslate } from '@/lib/language-context'
import { authHeaders } from '@/lib/auth-headers'
import { signedImageUrls, fetchLeagueTeams, createLeagueTeam, deleteLeagueTeam, type LeagueTeam } from '@/lib/app-data'
import { PlayerCard } from '@/components/player-card'
import { CvImport } from '@/components/cv-import'
import ThemeToggle from '@/components/theme-toggle'
import LanguageToggle from '@/components/language-toggle'

const POSITIONS = ['GOALKEEPER', 'DEFENDER', 'MIDFIELDER', 'FORWARD'] as const
const POS_ORDER: Record<string, number> = { GOALKEEPER: 0, DEFENDER: 1, MIDFIELDER: 2, FORWARD: 3 }
const BIRTH_RE = /^\d{2}\/\d{2}\/\d{4}$/

const ageOf = (bd: string): number => {
  if (!BIRTH_RE.test(bd || '')) return 0
  const [d, m, y] = bd.split('/').map(Number)
  const now = new Date()
  let age = now.getFullYear() - y
  if (now.getMonth() + 1 < m || (now.getMonth() + 1 === m && now.getDate() < d)) age--
  return age > 0 && age < 70 ? age : 0
}

const emptyForm = { name: '', position: '', birthdate: '', jerseyNumber: '', nationality: '', image: '', imagePath: '' }

type Props = {
  mode: 'admin' | 'club'
  /** The club this login belongs to (club mode). */
  clubTeamId: number | null
  members: any[]
  setMembers: (fn: (prev: any[]) => any[]) => void
  onBack?: () => void
  onLogout: () => void
}

export function LigueView({ mode, clubTeamId, members, setMembers, onBack, onLogout }: Props) {
  const { tr } = useTranslate()
  const t = tr.league
  const [teams, setTeams] = useState<LeagueTeam[]>([])
  const [loadedTeams, setLoadedTeams] = useState(false)
  const [selTeamId, setSelTeamId] = useState<number | null>(mode === 'club' ? clubTeamId : null)
  const [urls, setUrls] = useState<Record<string, string>>({})
  const [selMember, setSelMember] = useState<any>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState<any>(emptyForm)
  const [formErr, setFormErr] = useState('')
  const [uploading, setUploading] = useState(false)
  const [teamQuery, setTeamQuery] = useState('')
  const [playerQuery, setPlayerQuery] = useState('')
  const [teamOpen, setTeamOpen] = useState(false)
  const [teamForm, setTeamForm] = useState({ name: '', username: '', password: '', logoPath: '' })
  const [teamErr, setTeamErr] = useState('')
  const [teamBusy, setTeamBusy] = useState(false)
  const photoRef = useRef<HTMLInputElement>(null)
  const logoRef = useRef<HTMLInputElement>(null)
  const logoChangeRef = useRef<HTMLInputElement>(null)
  const logoTarget = useRef<number | null>(null)
  const [logoBusy, setLogoBusy] = useState<number | null>(null)

  const reloadTeams = async () => { setTeams(await fetchLeagueTeams()); setLoadedTeams(true) }
  useEffect(() => { void reloadTeams() }, [])

  const league = useMemo(() => members.filter(m => m.teamCategory === 'LIGUE' && m.role === 'PLAYERS'), [members])
  const countFor = (id: number) => league.filter(m => m.leagueTeamId === id).length
  const team = teams.find(x => x.id === selTeamId) || null
  const players = useMemo(
    () => league.filter(m => m.leagueTeamId === selTeamId).sort((a, b) => {
      const d = (POS_ORDER[a.position] ?? 9) - (POS_ORDER[b.position] ?? 9)
      return d || String(a.name).localeCompare(String(b.name))
    }),
    [league, selTeamId],
  )
  const q = (s: string) => s.trim().toLowerCase()
  const visibleTeams = useMemo(() => teams.filter(x => x.name.toLowerCase().includes(q(teamQuery))), [teams, teamQuery])
  const visiblePlayers = useMemo(() => players.filter(m => String(m.name || '').toLowerCase().includes(q(playerQuery))), [players, playerQuery])

  // Private-bucket images (logos and portraits) need short-lived signed URLs.
  useEffect(() => {
    const paths = [...teams.map(x => x.logoPath), ...league.map(m => m.imagePath), form.imagePath].filter(Boolean).map(String)
    if (!paths.length) return
    let alive = true
    signedImageUrls(paths).then(next => { if (alive) setUrls(prev => ({ ...prev, ...next })) })
    return () => { alive = false }
  }, [teams, league, form.imagePath])

  const upload = async (file: File, extra: Record<string, string>): Promise<{ path: string } | { error: string }> => {
    const body = new FormData()
    body.set('file', file)
    body.set('folder', 'league')
    for (const [k, v] of Object.entries(extra)) body.set(k, v)
    try {
      const res = await fetch('/api/upload', { method: 'POST', headers: await authHeaders(), body })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json.path) return { error: typeof json?.error === 'string' ? json.error : t.uploadFailed }
      return { path: json.path }
    } catch {
      return { error: t.uploadFailed }
    }
  }

  // ── players ──
  const openAdd = () => { setEditingId(null); setForm(emptyForm); setFormErr(''); setFormOpen(true) }
  const openEdit = (m: any) => {
    setEditingId(m.id)
    setForm({
      name: m.name || '', position: m.position || '', birthdate: m.birthdate || '',
      jerseyNumber: m.jerseyNumber ?? '', nationality: m.nationality || '',
      image: m.image || '', imagePath: m.imagePath || '',
    })
    setFormErr(''); setSelMember(null); setFormOpen(true)
  }
  const onPhoto = async (file: File) => {
    if (!selTeamId) return
    setUploading(true); setFormErr('')
    const r = await upload(file, mode === 'admin' ? { leagueTeamId: String(selTeamId) } : {})
    setUploading(false)
    if ('error' in r) { setFormErr(r.error); return }
    setForm((f: any) => ({ ...f, imagePath: r.path, image: '' }))
  }
  const savePlayer = (e: React.FormEvent) => {
    e.preventDefault()
    const name = String(form.name || '').trim()
    if (name.length < 2) { setFormErr(t.nameRequired); return }
    if (form.birthdate && !BIRTH_RE.test(form.birthdate)) { setFormErr(t.birthdateFormat); return }
    if (!selTeamId) return
    const jersey = form.jerseyNumber === '' || form.jerseyNumber == null ? null : Number(form.jerseyNumber)
    if (jersey != null && (!Number.isInteger(jersey) || jersey < 0 || jersey > 99)) { setFormErr(t.jerseyRange); return }
    const simple = {
      name, position: POSITIONS.includes(form.position) ? form.position : '',
      birthdate: form.birthdate || '', jerseyNumber: jersey,
      nationality: String(form.nationality || '').trim(),
      image: form.imagePath ? '' : form.image, imagePath: form.imagePath || '',
    }
    setMembers(prev => {
      if (editingId) return prev.map(m => (m.id === editingId ? { ...m, ...simple, updatedAt: Date.now() } : m))
      return [...prev, {
        ...simple, id: Date.now(), role: 'PLAYERS', teamCategory: 'LIGUE', leagueTeamId: selTeamId,
        club: team?.name || '', languages: [], history: [], camps: [], cleansheets: 0,
        yellowCards: 0, redCards: 0, suspended: false, updatedAt: Date.now(),
      }]
    })
    setFormOpen(false)
  }
  const removePlayer = (m: any) => {
    if (mode !== 'admin') return
    if (!window.confirm(t.confirmDeletePlayer)) return
    setMembers(prev => prev.filter(x => x.id !== m.id))
    setSelMember(null)
  }

  // ── teams (admin) ──
  const onLogo = async (file: File) => {
    setTeamBusy(true); setTeamErr('')
    const r = await upload(file, { logo: '1' })
    setTeamBusy(false)
    if ('error' in r) { setTeamErr(r.error); return }
    setTeamForm(f => ({ ...f, logoPath: r.path }))
    void signedImageUrls([r.path]).then(next => setUrls(prev => ({ ...prev, ...next })))
  }
  const submitTeam = async (e: React.FormEvent) => {
    e.preventDefault()
    setTeamBusy(true); setTeamErr('')
    const r = await createLeagueTeam({ ...teamForm, name: teamForm.name.trim(), username: teamForm.username.trim().toLowerCase() })
    setTeamBusy(false)
    if (r.error) { setTeamErr(r.error); return }
    setTeamOpen(false); setTeamForm({ name: '', username: '', password: '', logoPath: '' })
    await reloadTeams()
  }
  // Admin: set or replace the logo of a team that already exists.
  const pickLogoFor = (id: number) => { logoTarget.current = id; logoChangeRef.current?.click() }
  const changeLogo = async (file: File) => {
    const id = logoTarget.current
    if (!id) return
    setLogoBusy(id)
    const r = await upload(file, { logo: '1' })
    if ('error' in r) { setLogoBusy(null); window.alert(r.error); return }
    const { error } = await supabase.from('league_teams').update({ logo_path: r.path }).eq('id', id)
    if (error) { setLogoBusy(null); window.alert(t.uploadFailed); return }
    await reloadTeams()
    setLogoBusy(null)
  }
  const removeTeam = async (x: LeagueTeam) => {
    if (!window.confirm(t.confirmDeleteTeam.replace('{name}', x.name))) return
    const r = await deleteLeagueTeam(x.id)
    if (r.error) { window.alert(r.error); return }
    await reloadTeams()
  }

  const logoUrl = (x: LeagueTeam | null) => (x?.logoPath ? urls[x.logoPath] || '' : '')
  const portrait = (m: any) => (m.imagePath ? urls[String(m.imagePath)] || '' : String(m.image || ''))
  const input = 'w-full rounded-xl border border-[rgba(var(--line-rgb),.25)] bg-[var(--c-deep)] px-3.5 py-3 text-sm font-semibold text-[var(--c-text)] outline-none focus:border-[#f6c744]/70'
  const label = 'mb-1 block text-[9px] font-black uppercase tracking-[.2em] text-[var(--c-textMid)]'

  const goBack = () => {
    if (mode === 'admin' && selTeamId) { setSelTeamId(null); setSelMember(null); setPlayerQuery(''); return }
    onBack?.()
  }
  const openTeam = (id: number) => { setSelTeamId(id); setPlayerQuery('') }
  const showTeamGrid = mode === 'admin' && !selTeamId

  return (
    <div className="fed-screen min-h-screen relative overflow-x-hidden text-[var(--c-text)]">
      <header className="sticky top-0 z-[100] border-b border-[rgba(var(--line-rgb),.18)] bg-[var(--c-bg)]/85 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {(mode === 'admin') && (
              <button onClick={goBack} title={t.back} className="p-2.5 rounded-lg border border-[rgba(var(--line-rgb),.25)] hover:border-[#f6c744]/60 transition-all shrink-0"><ChevronLeft size={16} /></button>
            )}
            <img src="/ftf-logo.png" className="h-10 shrink-0" alt="" />
            <div className="leading-tight min-w-0">
              <h1 className="text-xs sm:text-xl font-black italic uppercase tracking-wider leading-none truncate">{team && !showTeamGrid ? team.name : t.title}</h1>
              <p className="text-[9px] font-black text-[#E30613] uppercase tracking-[0.3em] truncate">{t.title}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <ThemeToggle className="p-2.5" />
            <LanguageToggle />
            {mode === 'club' && (
              <button onClick={() => { void supabase.auth.signOut(); onLogout() }} title={t.logout} className="p-2.5 rounded-lg border border-[rgba(227,6,44,.4)] bg-[#3a0b18]/70 text-[#ff5f72] hover:bg-[#e3062c] hover:text-white transition-all"><LogOut size={15} /></button>
            )}
          </div>
        </div>
      </header>

      <input ref={logoChangeRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void changeLogo(f) }} />

      {/* ── ADMIN: grid of clubs ── */}
      {showTeamGrid && (
        <main className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
          <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
            <p className="text-[9px] font-black uppercase tracking-[.4em] text-[#f6c744]">{t.teams} · {visibleTeams.length}/{teams.length}</p>
            <div className="flex items-center gap-2 flex-wrap">
              <input value={teamQuery} onChange={e => setTeamQuery(e.target.value)} placeholder={t.searchTeams}
                className="w-52 px-3.5 py-2.5 rounded-xl bg-[var(--c-deep)] border border-[rgba(var(--line-rgb),.25)] text-[var(--c-text)] placeholder-[var(--c-textMid)] text-xs font-semibold outline-none focus:border-[#f6c744]/70" />
              <button onClick={() => { setTeamErr(''); setTeamOpen(true) }} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#E30613] text-white text-[10px] font-black uppercase tracking-widest hover:bg-red-700 transition-all"><Plus size={14} />{t.addTeam}</button>
            </div>
          </div>
          {loadedTeams && teams.length === 0 && (
            <div className="py-24 flex flex-col items-center gap-4 text-[var(--c-textMid)]"><Users size={56} /><p className="text-[11px] font-black uppercase tracking-[.3em] text-center">{t.noTeams}</p></div>
          )}
          {loadedTeams && teams.length > 0 && visibleTeams.length === 0 && (
            <div className="py-24 flex flex-col items-center gap-4 text-[var(--c-textMid)]"><p className="text-[11px] font-black uppercase tracking-[.3em] text-center">{t.noMatch}</p></div>
          )}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
            {visibleTeams.map((x, i) => (
              <div key={x.id} className="group relative animate-[fadeUp_0.5s_ease-out_both]" style={{ animationDelay: `${i * 60}ms` }}>
                <button onClick={() => openTeam(x.id)} className="w-full aspect-[3/4] rounded-2xl overflow-hidden border border-[rgba(var(--line-rgb),.18)] bg-[#101b33] hover:border-[#f6c744]/60 hover:-translate-y-1.5 hover:shadow-[0_22px_60px_rgba(0,0,0,.5)] transition-all duration-300 flex flex-col items-center justify-center p-4 gap-4">
                  <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-[#ff2747] to-[#8f0319]" />
                  <div className="flex-1 w-full flex items-center justify-center min-h-0">
                    {logoUrl(x)
                      ? <img src={logoUrl(x)} alt={x.name} className="max-h-full max-w-[88%] object-contain drop-shadow-[0_8px_24px_rgba(0,0,0,.5)]" />
                      : <span className="text-6xl font-black text-white/25">{x.name.slice(0, 1).toUpperCase()}</span>}
                  </div>
                  <div className="text-center w-full">
                    <h2 className="text-sm sm:text-base font-black uppercase tracking-tight text-white leading-tight line-clamp-2">{x.name}</h2>
                    <p className="mt-1 text-[8px] font-bold uppercase tracking-[.25em] text-[#f6c744]">{countFor(x.id)} {t.playersWord}</p>
                  </div>
                </button>
                <button onClick={() => pickLogoFor(x.id)} title={t.changeLogo} className="absolute top-2 left-2 p-1.5 rounded-full bg-black/50 text-white/80 hover:bg-[#f6c744] hover:text-[#0c1f3d] opacity-0 group-hover:opacity-100 focus:opacity-100 [@media(hover:none)]:opacity-100 transition-all">{logoBusy === x.id ? <span className="text-[8px] font-black px-1">…</span> : <Camera size={12} />}</button>
                <button onClick={() => void removeTeam(x)} title={t.deleteTeam} className="absolute top-2 right-2 p-1.5 rounded-full bg-black/50 text-white/70 hover:bg-[#e3062c] hover:text-white opacity-0 group-hover:opacity-100 focus:opacity-100 [@media(hover:none)]:opacity-100 transition-all"><Trash2 size={12} /></button>
              </div>
            ))}
          </div>
        </main>
      )}

      {/* ── TEAM PAGE: player cards ── */}
      {!showTeamGrid && (
        <main className="max-w-[1400px] mx-auto px-4 sm:px-6 py-8">
          {mode === 'club' && !loadedTeams && <p className="text-center text-[10px] font-black uppercase tracking-[.3em] text-[var(--c-textMid)] py-24">{t.loading}</p>}
          {mode === 'club' && loadedTeams && !team && (
            <p className="text-center text-sm text-[var(--c-textMid)] py-24">{t.noClub}</p>
          )}
          {team && (
            <>
              <div className="flex items-center justify-between gap-3 mb-8">
                <div className="flex items-center gap-4 min-w-0">
                  {logoUrl(team) && <img src={logoUrl(team)} alt="" className="h-14 w-14 object-contain shrink-0" />}
                  {mode === 'admin' && <button onClick={() => pickLogoFor(team.id)} title={t.changeLogo} className="p-2 rounded-lg border border-[rgba(var(--line-rgb),.25)] hover:border-[#f6c744]/60 shrink-0"><Camera size={14} /></button>}
                  <p className="text-[9px] font-black uppercase tracking-[.4em] text-[#f6c744]">{players.length} {t.playersWord}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                  <input value={playerQuery} onChange={e => setPlayerQuery(e.target.value)} placeholder={t.searchPlayers}
                    className="w-44 sm:w-52 px-3.5 py-2.5 rounded-xl bg-[var(--c-deep)] border border-[rgba(var(--line-rgb),.25)] text-[var(--c-text)] placeholder-[var(--c-textMid)] text-xs font-semibold outline-none focus:border-[#f6c744]/70" />
                  <button onClick={openAdd} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#E30613] text-white text-[10px] font-black uppercase tracking-widest hover:bg-red-700 transition-all"><Plus size={14} />{t.addPlayer}</button>
                </div>
              </div>
              {players.length === 0 && (
                <div className="py-24 flex flex-col items-center gap-4 text-[var(--c-textMid)]"><Users size={56} /><p className="text-[11px] font-black uppercase tracking-[.3em] text-center">{t.noPlayers}</p></div>
              )}
              {players.length > 0 && visiblePlayers.length === 0 && (
                <div className="py-24 flex flex-col items-center gap-4 text-[var(--c-textMid)]"><p className="text-[11px] font-black uppercase tracking-[.3em] text-center">{t.noMatch}</p></div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6">
                {visiblePlayers.map((m, i) => (
                  <div key={m.id} onClick={() => setSelMember(m)} className="cursor-pointer animate-[fadeUp_0.5s_ease-out_both]" style={{ animationDelay: `${i * 60}ms` }}>
                    <PlayerCard
                      name={m.name}
                      club={team.name}
                      position={m.position || 'PLAYER'}
                      age={ageOf(m.birthdate)}
                      imageSrc={portrait(m)}
                      n={m.jerseyNumber != null && m.jerseyNumber !== '' ? Number(m.jerseyNumber) : undefined}
                      nationality={m.nationality}
                      entranceDelay={i * 60}
                    />
                  </div>
                ))}
              </div>
            </>
          )}
        </main>
      )}

      {/* ── simple profile ── */}
      {selMember && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={() => setSelMember(null)}>
          <div className="relative w-full max-w-md rounded-2xl border border-[rgba(var(--line-rgb),.25)] bg-[var(--c-bg)] overflow-hidden" onClick={e => e.stopPropagation()}>
            <button onClick={() => setSelMember(null)} className="absolute top-3 right-3 z-10 p-2 rounded-full bg-black/40 text-white"><X size={14} /></button>
            <div className="aspect-[4/3] bg-[#101b33] flex items-center justify-center overflow-hidden">
              {portrait(selMember) ? <img src={portrait(selMember)} alt="" className="w-full h-full object-cover object-top" /> : <Users size={64} className="text-white/25" />}
            </div>
            <div className="p-5">
              <h3 className="text-xl font-black uppercase tracking-tight">{selMember.name}</h3>
              <p className="mt-1 text-[9px] font-black uppercase tracking-[.25em] text-[#E30613]">{team?.name}</p>
              <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                {([
                  [t.position, selMember.position || '—'],
                  [t.age, ageOf(selMember.birthdate) || '—'],
                  [t.birthdate, selMember.birthdate || '—'],
                  [t.jersey, selMember.jerseyNumber ?? '—'],
                  [t.nationality, selMember.nationality || '—'],
                ] as [string, any][]).map(([k, v]) => (
                  <div key={k}><dt className={label}>{k}</dt><dd className="font-bold">{String(v)}</dd></div>
                ))}
              </dl>
              <div className="mt-5 flex gap-2">
                <button onClick={() => openEdit(selMember)} className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-[rgba(var(--line-rgb),.3)] text-[10px] font-black uppercase tracking-widest hover:border-[#f6c744]/60"><Pencil size={13} />{t.edit}</button>
                {mode === 'admin' && <button onClick={() => removePlayer(selMember)} className="px-4 py-2.5 rounded-xl border border-[#e3062c]/50 text-[#ff5f72] hover:bg-[#e3062c] hover:text-white transition-all"><Trash2 size={14} /></button>}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── player form ── */}
      {formOpen && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={() => setFormOpen(false)}>
          <form onSubmit={savePlayer} className="relative w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl border border-[rgba(var(--line-rgb),.25)] bg-[var(--c-bg)] p-5" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-black uppercase tracking-[.2em]">{editingId ? t.editPlayer : t.addPlayer}</h3>
              <button type="button" onClick={() => setFormOpen(false)} className="p-2 rounded-full hover:bg-white/10"><X size={14} /></button>
            </div>
            <CvImport role="PLAYERS" form={form} setForm={setForm} />
            <input ref={photoRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void onPhoto(f) }} />
            <button type="button" onClick={() => photoRef.current?.click()} className="w-full mb-4 flex flex-col items-center gap-2 py-4 rounded-xl border border-dashed border-[rgba(var(--line-rgb),.35)] bg-[var(--c-deep)] overflow-hidden">
              {(form.imagePath ? urls[form.imagePath] : form.image)
                ? <img src={form.imagePath ? urls[form.imagePath] : form.image} alt="" className="h-28 w-28 object-cover rounded-full" />
                : <Camera size={26} className="text-[var(--c-textMid)]" />}
              <span className="text-[8px] font-black uppercase tracking-[.2em] text-[var(--c-textMid)]">{uploading ? t.uploading : t.photo}</span>
            </button>
            <div className="space-y-3">
              <div><label className={label}>{t.fullName} *</label><input className={input} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} maxLength={80} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className={label}>{t.position}</label>
                  <select className={input} value={form.position} onChange={e => setForm({ ...form, position: e.target.value })}>
                    <option value="">—</option>
                    {POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div><label className={label}>{t.jersey}</label><input className={input} inputMode="numeric" value={form.jerseyNumber} onChange={e => setForm({ ...form, jerseyNumber: e.target.value.replace(/\D/g, '').slice(0, 2) })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className={label}>{t.birthdate}</label><input className={input} placeholder="DD/MM/YYYY" inputMode="numeric" value={form.birthdate} onChange={e => setForm({ ...form, birthdate: e.target.value.replace(/[^\d/]/g, '').slice(0, 10) })} /></div>
                <div><label className={label}>{t.nationality}</label><input className={input} value={form.nationality} onChange={e => setForm({ ...form, nationality: e.target.value })} maxLength={60} /></div>
              </div>
            </div>
            {formErr && <p role="alert" className="mt-3 text-xs text-[#ff5f72]">{formErr}</p>}
            <div className="mt-5 flex gap-2">
              <button type="button" onClick={() => setFormOpen(false)} className="flex-1 px-4 py-3 rounded-xl border border-[rgba(var(--line-rgb),.3)] text-[10px] font-black uppercase tracking-widest">{t.cancel}</button>
              <button type="submit" disabled={uploading} className="flex-1 px-4 py-3 rounded-xl bg-[#E30613] text-white text-[10px] font-black uppercase tracking-widest hover:bg-red-700 disabled:opacity-60">{t.save}</button>
            </div>
          </form>
        </div>
      )}

      {/* ── new team + its login (admin) ── */}
      {teamOpen && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={() => setTeamOpen(false)}>
          <form onSubmit={submitTeam} className="relative w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl border border-[rgba(var(--line-rgb),.25)] bg-[var(--c-bg)] p-5" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-black uppercase tracking-[.2em]">{t.addTeam}</h3>
              <button type="button" onClick={() => setTeamOpen(false)} className="p-2 rounded-full hover:bg-white/10"><X size={14} /></button>
            </div>
            <input ref={logoRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void onLogo(f) }} />
            <button type="button" onClick={() => logoRef.current?.click()} className="w-full mb-4 flex flex-col items-center gap-2 py-5 rounded-xl border border-dashed border-[rgba(var(--line-rgb),.35)] bg-[var(--c-deep)]">
              {teamForm.logoPath && urls[teamForm.logoPath] ? <img src={urls[teamForm.logoPath]} alt="" className="h-24 object-contain" /> : <Camera size={26} className="text-[var(--c-textMid)]" />}
              <span className="text-[8px] font-black uppercase tracking-[.2em] text-[var(--c-textMid)]">{teamBusy ? t.uploading : t.logo}</span>
            </button>
            <div className="space-y-3">
              <div><label className={label}>{t.teamName} *</label><input className={input} value={teamForm.name} onChange={e => setTeamForm({ ...teamForm, name: e.target.value })} maxLength={80} required /></div>
              <p className="pt-1 text-[8px] font-black uppercase tracking-[.25em] text-[#f6c744]">{t.clubLogin}</p>
              <div><label className={label}>{t.username} *</label><input className={input} value={teamForm.username} onChange={e => setTeamForm({ ...teamForm, username: e.target.value })} autoCapitalize="none" autoComplete="off" required /></div>
              <div><label className={label}>{t.password} *</label><input className={input} type="text" value={teamForm.password} onChange={e => setTeamForm({ ...teamForm, password: e.target.value })} autoComplete="off" minLength={6} required /></div>
            </div>
            {teamErr && <p role="alert" className="mt-3 text-xs text-[#ff5f72]">{teamErr}</p>}
            <div className="mt-5 flex gap-2">
              <button type="button" onClick={() => setTeamOpen(false)} className="flex-1 px-4 py-3 rounded-xl border border-[rgba(var(--line-rgb),.3)] text-[10px] font-black uppercase tracking-widest">{t.cancel}</button>
              <button type="submit" disabled={teamBusy} className="flex-1 px-4 py-3 rounded-xl bg-[#E30613] text-white text-[10px] font-black uppercase tracking-widest hover:bg-red-700 disabled:opacity-60">{t.createTeam}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
