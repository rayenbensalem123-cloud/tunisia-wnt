"use client"
import React, { useState, useMemo, useEffect, useRef } from "react"
import {
  Plus, X, User, Search, Edit3, Camera, Check,
  LogOut, Goal, History, Trash2, Trophy, Loader2,
  Star, ClipboardCheck, Award, ShieldCheck, Briefcase, Sparkles,
  ChevronRight, AlertTriangle, Ban, BookOpen, Save,
  Users, Calendar, ChevronDown, ChevronLeft, Globe, MapPin, Bell, Key, Activity, Newspaper
} from "lucide-react"
import { useTranslate } from "@/lib/language-context"
import { NotificationBell } from "@/components/notification-system"
import { ExportTools } from "@/components/export-tools"
import { ScoutPanel } from "@/components/scout-panel"
import { searchPlayerDatabase } from "@/lib/player-database"
import { PlayerCard } from "@/components/player-card"
import { FormationPitch, FORMATIONS } from "@/components/formation-pitch"
import { supabase } from "@/lib/supabase"
import {
  signInUsername, fetchMyProfile, registerUser,
  fetchAllProfiles, updateProfile, deleteProfile,
  fetchMembers, fetchMatches, syncMembers, syncMatches,
  subscribeRealtime, changeMyPassword, adminResetPassword, fetchActivityLog,
  fetchInjuries, addInjury, updateInjuryStatus,
  fetchSquadTemplates, saveSquadTemplate, deleteSquadTemplate,
} from "@/lib/app-data"

// ─────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────
const COACH_POSITIONS = ["HEAD COACH","ASSISTANT COACH","GOALKEEPER COACH","FITNESS COACH","MEDICAL STAFF","TECHNICAL DIRECTOR","ANALYST"]
const CAF_LICENSES = ["CAF D","CAF C","CAF B","CAF A","CAF PRO","GOALKEEPER LEVEL 1","GOALKEEPER LEVEL 2","PRÉPARATEUR PHYSIQUE"]
const LANGUAGES = ["ARABIC","FRENCH","ENGLISH","ITALIAN","SPANISH","GERMAN","PORTUGUESE"]
const PLAYER_POSITIONS = ["ALL","FORWARD","MIDFIELDER","DEFENDER","GOALKEEPER"]
type TeamCategory = "SENIORS" | "U20" | "U17"

// CAF/FIFA WOMEN'S RULE:
// 2 yellow cards in separate matches → automatic 1-match suspension
// Direct red card → automatic 1-match suspension (minimum)
const YELLOW_SUSPENSION = 2

// ─────────────────────────────────────────────
// REAL TUNISIAN WOMEN'S SENIOR SQUAD (2025)
// Source: Sofascore / WAFCON 2025 roster
// ─────────────────────────────────────────────
const REAL_TUNISIA_SENIORS: any[] = []

const titleCase=(s:string)=>s.toLowerCase().replace(/\b\w/g,c=>c.toUpperCase())
const getImageSrc=(m:any)=>{if(m?.imagePath)return `https://vtjdmuzeohtqxwknfmhw.supabase.co/storage/v1/object/public/members/${m.imagePath}`;return m?.image||"/placeholder.jpg"}
const compressImage=async(file:File,maxDim=1200,quality=0.82):Promise<Blob>=>{
  const img=await new Promise<HTMLImageElement>((res,rej)=>{const o=new Image();o.onload=()=>res(o);o.onerror=rej;o.src=URL.createObjectURL(file)})
  let w=img.width,h=img.height
  if(!w||!h)throw new Error("bad image")
  if(Math.max(w,h)>maxDim){const s=maxDim/Math.max(w,h);w=Math.round(w*s);h=Math.round(h*s)}
  const c=document.createElement('canvas');c.width=w;c.height=h
  const ctx=c.getContext('2d');if(!ctx)throw new Error("no ctx")
  ctx.drawImage(img,0,0,w,h)
  return await new Promise<Blob>((res,rej)=>c.toBlob(b=>b?res(b):rej(new Error("no blob")),'image/jpeg',quality))
}
const calculateAge = (bd: string): number => {
  if (!bd?.includes('/')) return 0
  const [d,m,y] = bd.split('/').map(Number)
  const birth = new Date(y,m-1,d), now = new Date()
  let age = now.getFullYear()-birth.getFullYear()
  if (now.getMonth()<birth.getMonth()||(now.getMonth()===birth.getMonth()&&now.getDate()<birth.getDate())) age--
  return age
}

// CAF rule: 2 yellows = suspended for 1 match; red = suspended
const getCardStatus = (m: any) => {
  if (m.role!=="PLAYERS") return null
  const yc = m.yellowCards||0
  if (m.suspended||(m.redCards||0)>0) return "suspended"
  if (yc>=YELLOW_SUSPENSION) return "suspended"
  if (yc===YELLOW_SUSPENSION-1) return "warning"   // 1 yellow = 1 more will ban
  return null
}

// ─────────────────────────────────────────────
// USER / AUTH TYPES & HELPERS
// ─────────────────────────────────────────────
interface UserPerms {
  addPlayer: boolean; editPlayer: boolean; deletePlayer: boolean
  addMatch: boolean; deleteMatch: boolean
  useScout: boolean; exportData: boolean
  viewMedical: boolean; editMedical: boolean
}
interface AppUser {
  username: string; firstName: string; lastName: string; status: "active" | "pending"
  perms: UserPerms
}

const DEFAULT_PERMS: UserPerms = { addPlayer:false, editPlayer:false, deletePlayer:false, addMatch:false, deleteMatch:false, useScout:false, exportData:false, viewMedical:false, editMedical:false }
const FULL_PERMS: UserPerms = { addPlayer:true, editPlayer:true, deletePlayer:true, addMatch:true, deleteMatch:true, useScout:true, exportData:true, viewMedical:true, editMedical:true }

// Maps a DB profiles row -> the shape the UI already expects
const profileToAppUser = (p: any): AppUser => ({
  username: p.username,
  firstName: p.first_name,
  lastName: p.last_name,
  status: p.status,
  perms: p.permissions,
})

const LOGIN_AND_REGISTER_STYLE = "min-h-screen flex items-center justify-center bg-zinc-50 text-zinc-900"
const LOGIN_CARD_STYLE = "p-10 rounded-[3rem] text-center space-y-6 max-w-md w-full mx-4 bg-white shadow-xl border border-zinc-200"

// ─────────────────────────────────────────────
// REGISTER SCREEN
// ─────────────────────────────────────────────
const RegisterScreen = ({onBack}:{onBack:()=>void}) => {
  const {lang,setLang,tr}=useTranslate()
  const [fn,setFn]=useState(""), [ln,setLn]=useState(""), [u,setU]=useState(""), [p,setP]=useState(""), [msg,setMsg]=useState(""), [busy,setBusy]=useState(false)
  const submit=async(e:React.FormEvent)=>{
    e.preventDefault()
    if(!fn.trim()||!ln.trim()||!u.trim()||!p.trim()){setMsg("Fill all fields");return}
    if(p.length<6){setMsg("Password min 6 chars");return}
    setBusy(true)
    const res = await registerUser({ firstName: fn.trim(), lastName: ln.trim(), username: u.trim().toLowerCase(), password: p })
    setBusy(false)
    if(res.error){setMsg(res.error);return}
    setMsg(""); setFn(""); setLn(""); setU(""); setP("")
    onBack()
  }
  return(
    <div className={LOGIN_AND_REGISTER_STYLE}>
      <div className={`${LOGIN_CARD_STYLE} relative`}>
        <button onClick={()=>setLang(lang==="en"?"fr":lang==="fr"?"ar":"en")}
          className="absolute top-5 right-5 p-2 rounded-xl border border-zinc-300 bg-white/80 text-zinc-600 hover:text-black hover:bg-white transition-all text-[9px] font-black uppercase tracking-widest">
          <Globe size={14} className="inline"/><span className="ml-1">{lang.toUpperCase()}</span>
        </button>
        <img src="/ftf-logo.png" className="h-20 mx-auto" alt=""/>
        <div><h2 className="text-2xl font-black italic uppercase tracking-tighter">Register</h2><p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest mt-1">Create an account</p></div>
        <form onSubmit={submit} className="space-y-3">
          <input type="text" placeholder={tr.login.firstName} value={fn} onChange={e=>setFn(e.target.value)} className="w-full p-4 rounded-2xl border text-center font-bold outline-none bg-zinc-50 border-zinc-300 focus:border-[#E30613]"/>
          <input type="text" placeholder={tr.login.lastName} value={ln} onChange={e=>setLn(e.target.value)} className="w-full p-4 rounded-2xl border text-center font-bold outline-none bg-zinc-50 border-zinc-300 focus:border-[#E30613]"/>
          <input type="text" placeholder={tr.login.username} value={u} onChange={e=>setU(e.target.value)} className="w-full p-4 rounded-2xl border text-center font-bold outline-none bg-zinc-50 border-zinc-300 focus:border-[#E30613]"/>
          <input type="password" placeholder={tr.login.password} value={p} onChange={e=>setP(e.target.value)} className="w-full p-4 rounded-2xl border text-center font-black tracking-[0.3em] outline-none bg-zinc-50 border-zinc-300 focus:border-[#E30613]"/>
          {msg&&<p className="text-[9px] font-black text-red-500 uppercase">{msg}</p>}
          <button disabled={busy} className="w-full py-4 rounded-2xl font-black uppercase italic tracking-tighter bg-[#E30613] text-white hover:bg-red-700 transition-all disabled:opacity-50">{busy?"...":"Register"}</button>
        </form>
        <p className="text-[8px] text-zinc-400">After registering, wait for admin approval.</p>
        <button onClick={onBack} className="text-[9px] font-black uppercase text-zinc-500 hover:text-[#E30613] transition-all">← Back to Login</button>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// LOGIN
// ─────────────────────────────────────────────
// Simple reusable dropdown menu — click trigger to open, click outside or an item to close
// Formats a date as "7 October 2026" instead of raw numeric strings
const fmtDateWords = (dateStr?: string) => {
  if (!dateStr) return ""
  const d = new Date(dateStr + "T00:00:00")
  if (isNaN(d.getTime())) return dateStr
  return d.toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" })
}

const LEAGUES_BY_REGION = [
  { region: "Tunisia", options: ["Championnat National Féminin (Tunisia)"] },
  { region: "North Africa", options: ["Botola Nsawiya (Morocco)", "Championnat National Féminin (Algeria)", "Egyptian Women's Premier League", "Libya Women's League"] },
  { region: "Middle East", options: ["UAE Women's Football League", "Saudi Women's Football League", "Qatar Women's League", "Jordan Women's League"] },
  { region: "France", options: ["Ligue 1 Féminine", "Seconde Ligue (D2 Féminine)"] },
  { region: "Europe", options: ["WSL (England)", "Liga F (Spain)", "Frauen-Bundesliga (Germany)", "Serie A Femminile (Italy)", "Damallsvenskan (Sweden)"] },
  { region: "Americas", options: ["NWSL (USA)", "Liga MX Femenil (Mexico)"] },
  { region: "Other", options: ["Other / Diaspora"] },
]

const COMPETITIONS = [
  {value:"",label:"Friendly"},
  {value:"World Cup Qualification",label:"WCQ"},
  {value:"African Cup Qualification",label:"AFCONQ"},
  {value:"UNAF",label:"UNAF"},
  {value:"World Cup",label:"World Cup"},
  {value:"African Cup",label:"AFCON"},
]

// Custom-styled date picker — replaces the plain native browser calendar
const DatePicker = ({value,onChange,placeholder="Select date"}:{value:string;onChange:(v:string)=>void;placeholder?:string}) => {
  const [open,setOpen]=useState(false)
  const ref=useRef<HTMLDivElement>(null)
  const today=new Date()
  const selected=value?new Date(value+"T00:00:00"):null
  const [viewMonth,setViewMonth]=useState(selected||today)

  useEffect(()=>{
    if(!open)return
    const onClick=(e:MouseEvent)=>{ if(ref.current&&!ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener("mousedown",onClick)
    return ()=>document.removeEventListener("mousedown",onClick)
  },[open])

  const year=viewMonth.getFullYear(), month=viewMonth.getMonth()
  const firstDay=new Date(year,month,1).getDay()
  const daysInMonth=new Date(year,month+1,0).getDate()
  const monthName=viewMonth.toLocaleDateString(undefined,{month:"long",year:"numeric"})
  const fmt=(d:Date)=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
  const isSameDay=(a:Date,b:Date)=>a.getFullYear()===b.getFullYear()&&a.getMonth()===b.getMonth()&&a.getDate()===b.getDate()

  const cells=[]
  for(let i=0;i<firstDay;i++)cells.push(null)
  for(let d=1;d<=daysInMonth;d++)cells.push(d)

  return(
    <div ref={ref} className="relative">
      <button type="button" onClick={()=>setOpen(o=>!o)} className="w-full flex items-center gap-2 p-2.5 bg-zinc-50 rounded-lg border border-zinc-200 text-[11px] font-bold text-left">
        <Calendar size={13} className="text-[#E30613] shrink-0"/>
        <span className={value?"text-zinc-900":"text-zinc-400"}>{value?new Date(value+"T00:00:00").toLocaleDateString(undefined,{day:"2-digit",month:"short",year:"numeric"}):placeholder}</span>
      </button>
      {open&&(
        <div className="absolute z-[300] top-full mt-1.5 left-0 w-64 rounded-2xl bg-[#FAF8F3] border border-zinc-200 shadow-2xl p-3">
          <div className="flex items-center justify-between mb-2 px-1">
            <button type="button" onClick={()=>setViewMonth(new Date(year,month-1,1))} className="p-1.5 rounded-full hover:bg-zinc-200/60 transition-all"><ChevronLeft size={14}/></button>
            <span className="text-[11px] font-black uppercase tracking-wider">{monthName}</span>
            <button type="button" onClick={()=>setViewMonth(new Date(year,month+1,1))} className="p-1.5 rounded-full hover:bg-zinc-200/60 transition-all"><ChevronRight size={14}/></button>
          </div>
          <div className="grid grid-cols-7 gap-0.5 mb-1">
            {["S","M","T","W","T","F","S"].map((d,i)=>(<div key={i} className="text-[8px] font-black text-zinc-400 text-center py-1">{d}</div>))}
          </div>
          <div className="grid grid-cols-7 gap-0.5">
            {cells.map((d,i)=>{
              if(d===null)return <div key={i}/>
              const cellDate=new Date(year,month,d)
              const isToday=isSameDay(cellDate,today)
              const isSelected=selected&&isSameDay(cellDate,selected)
              return(
                <button type="button" key={i} onClick={()=>{onChange(fmt(cellDate));setOpen(false)}}
                  className={`aspect-square rounded-full text-[10px] font-bold transition-all flex items-center justify-center
                    ${isSelected?'bg-[#E30613] text-white':isToday?'border border-[#E30613] text-[#E30613]':'text-zinc-700 hover:bg-zinc-200/60'}`}>
                  {d}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

const Dropdown = ({trigger,children,align="right"}:{trigger:React.ReactNode;children:React.ReactNode;align?:"left"|"right"}) => {
  const [open,setOpen]=useState(false)
  const ref=useRef<HTMLDivElement>(null)
  useEffect(()=>{
    if(!open)return
    const onClick=(e:MouseEvent)=>{ if(ref.current&&!ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener("mousedown",onClick)
    return ()=>document.removeEventListener("mousedown",onClick)
  },[open])
  return(
    <div ref={ref} className="relative">
      <div onClick={()=>setOpen(o=>!o)}>{trigger}</div>
      {open&&(
        <div onClick={()=>setOpen(false)} className={`absolute top-full mt-1.5 ${align==="right"?"right-0":"left-0"} z-[150] min-w-[180px] rounded-xl bg-white border border-zinc-200 shadow-xl py-1.5 flex flex-col`}>
          {children}
        </div>
      )}
    </div>
  )
}

const LoginScreen = ({onLogin}:{onLogin:()=>void}) => {
  const { tr } = useTranslate()
  const [uname,setUname]=useState(""), [pw,setPw]=useState(""), [err,setErr]=useState(""), [reg,setReg]=useState(false), [busy,setBusy]=useState(false)
  if(reg) return <RegisterScreen onBack={()=>setReg(false)}/>
  const doLogin=async()=>{
    if(!uname.trim()||!pw){setErr("Enter username & password");setTimeout(()=>setErr(""),2000);return}
    setBusy(true)
    const { error } = await signInUsername(uname, pw)
    if(error){setBusy(false);setErr(error);setTimeout(()=>setErr(""),2500);return}
    const profile = await fetchMyProfile()
    if(!profile || profile.status!=="active"){
      await supabase.auth.signOut()
      setBusy(false)
      setErr(profile?"Pending approval":"User not found")
      setTimeout(()=>setErr(""),2500)
      return
    }
    setBusy(false)
    onLogin()
  }
  return(
    <div className={LOGIN_AND_REGISTER_STYLE}>
      <div className={LOGIN_CARD_STYLE}>
        <img src="/ftf-logo.png" className="h-20 mx-auto" alt=""/>
        <div><h2 className="text-2xl font-black italic uppercase tracking-tighter">{tr.login.systemLocked}</h2><p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest mt-1">{tr.login.authRequired}</p></div>
        <div className="space-y-3">
          <input type="text" placeholder="Username" value={uname} onChange={e=>setUname(e.target.value)} className="w-full p-4 rounded-2xl border text-center font-bold outline-none bg-zinc-50 border-zinc-300 focus:border-[#E30613]"/>
          <input type="password" placeholder={tr.login.accessKey} value={pw} onChange={e=>setPw(e.target.value)} onKeyDown={e=>e.key==="Enter"&&doLogin()} className={`w-full p-4 rounded-2xl border text-center font-black tracking-[0.3em] outline-none bg-zinc-50 ${err?'border-red-500 ring-4 ring-red-500/20':'border-zinc-300 focus:border-[#E30613]'}`}/>
          {err&&<p className="text-[9px] font-black text-red-500 uppercase tracking-widest">{err}</p>}
          <button disabled={busy} onClick={doLogin} className="w-full py-4 rounded-2xl font-black uppercase italic tracking-tighter hover:scale-[1.02] transition-all shadow-lg bg-[#E30613] text-white disabled:opacity-50">{busy?"...":tr.login.authorize}</button>
          <button onClick={()=>setReg(true)} className="w-full text-center text-[9px] font-black uppercase text-zinc-500 hover:text-[#E30613] transition-all">Register ↗</button>
      </div>
    </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// TEAM SELECTOR
// ─────────────────────────────────────────────
const TeamSelector=({onSelect}:{onSelect:(c:TeamCategory)=>void})=>{
  const { tr } = useTranslate()
  const teams:{cat:TeamCategory;label:string;sub:string;abbr:string;color:string;bg:string;pattern:string}[]=[
    {cat:"SENIORS",label:"SENIORS",sub:"Senior National Team",abbr:"S",color:"#E30613",bg:"from-red-500 to-red-700",pattern:"M20,40 C8.954,40 0,31.046 0,20 S8.954,0 20,0 S40,8.954 40,20 S31.046,40 20,40 Z"},
    {cat:"U20",label:"U-20",sub:"Under 20 National Team",abbr:"20",color:"#2563eb",bg:"from-blue-500 to-blue-700",pattern:"M0,0 L40,0 L40,40 L0,40 Z M20,20 m-8,0 a8,8 0 1,1 16,0 a8,8 0 1,1 -16,0"},
    {cat:"U17",label:"U-17",sub:"Under 17 National Team",abbr:"17",color:"#059669",bg:"from-emerald-500 to-emerald-700",pattern:"M20,2 L38,20 L20,38 L2,20 Z M20,10 L30,20 L20,30 L10,20 Z"},
  ]
  return(
    <div className="min-h-screen flex flex-col text-zinc-900 relative overflow-hidden">
      {/* Dynamic mesh gradient background */}
      <div className="fixed inset-0 z-0">
        <div className="absolute inset-0 bg-gradient-to-b from-zinc-50 via-white to-zinc-50"/>
        <div className="absolute top-0 left-0 right-0 h-64 bg-gradient-to-b from-[#E30613]/[0.03] to-transparent"/>
        <div className="absolute bottom-0 left-0 right-0 h-64 bg-gradient-to-t from-zinc-100/50 to-transparent"/>
      </div>
      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-6 py-12">
        {/* Header */}
        <div className="flex flex-col items-center mb-16 animate-[fadeUp_0.8s_ease-out_both]">
          <div className="relative mb-6">
            <div className="absolute inset-0 bg-[#E30613]/10 blur-2xl rounded-full w-20 h-20"/>
            <div className="w-20 h-20 rounded-2xl bg-white shadow-lg border border-zinc-200 flex items-center justify-center relative">
              <img src="/ftf-logo.png" className="h-11" alt=""/>
            </div>
          </div>
          <h1 className="text-4xl md:text-5xl font-black italic uppercase tracking-tighter text-center leading-none">{tr.teamSelect.eliteSquad}</h1>
          <div className="flex items-center gap-2 mt-4">
            <div className="h-px w-8 bg-zinc-300"/>
            <p className="text-[8px] font-black uppercase tracking-[0.5em] text-zinc-400">{tr.teamSelect.selectCat}</p>
            <div className="h-px w-8 bg-zinc-300"/>
          </div>
        </div>
        {/* Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 w-full max-w-5xl">
          {teams.map((t,i)=>(
            <button key={t.cat} onClick={()=>onSelect(t.cat)} className="group relative h-[380px] rounded-[2rem] overflow-hidden transition-all duration-700 hover:-translate-y-1 animate-[fadeUp_0.6s_ease-out_both]" style={{animationDelay:`${i*150+200}ms`}}>
              {/* Shadow layer */}
              <div className="absolute inset-0 rounded-[2rem] shadow-lg group-hover:shadow-2xl transition-shadow duration-500"/>
              {/* Card body */}
              <div className="absolute inset-0 bg-white rounded-[2rem] border border-zinc-200/80 group-hover:border-zinc-300 transition-colors duration-500"/>
              {/* Main visual area with team color */}
              <div className={`absolute inset-0 bg-gradient-to-br ${t.bg} opacity-[0.04] group-hover:opacity-[0.08] transition-opacity duration-500`}/>
              {/* Large pattern */}
              <div className="absolute inset-0 overflow-hidden">
                <svg className="w-full h-full opacity-[0.04]" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="100" cy="100" r="80" stroke="currentColor" strokeWidth="0.5"/>
                  <circle cx="100" cy="100" r="60" stroke="currentColor" strokeWidth="0.5"/>
                  <circle cx="100" cy="100" r="40" stroke="currentColor" strokeWidth="0.5"/>
                  <circle cx="100" cy="100" r="20" stroke="currentColor" strokeWidth="0.5"/>
                </svg>
              </div>
              {/* Big background number */}
              <div className="absolute -right-6 -top-6 text-[140px] font-black italic text-black/[0.03] select-none leading-none group-hover:scale-110 transition-transform duration-700">{t.abbr}</div>
              {/* Top accent bar */}
              <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${t.bg} origin-left scale-x-0 group-hover:scale-x-100 transition-transform duration-700`}/>
              {/* Color dot top right */}
              <div className={`absolute top-5 right-5 w-2.5 h-2.5 rounded-full opacity-0 group-hover:opacity-100 transition-all duration-500`} style={{backgroundColor:t.color}}/>
              {/* Bottom accent line */}
              <div className="absolute bottom-0 left-[10%] right-[10%] h-[1px] bg-zinc-200 group-hover:bg-zinc-300 transition-colors duration-500"/>
              {/* Content */}
              <div className="absolute inset-0 flex flex-col items-center justify-center p-8">
                {/* Shield/Crest */}
                <div className="relative mb-8 transition-all duration-500 group-hover:scale-110 group-hover:-translate-y-1">
                  <svg width="80" height="90" viewBox="0 0 80 90" className="drop-shadow-lg">
                    <defs>
                      <linearGradient id={`shield-${i}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={t.color} stopOpacity="0.15"/>
                        <stop offset="100%" stopColor={t.color} stopOpacity="0.05"/>
                      </linearGradient>
                    </defs>
                    <path d="M40 2 L78 18 L78 48 C78 68 40 88 40 88 C40 88 2 68 2 48 L2 18 Z" fill={`url(#shield-${i})`} stroke={t.color} strokeWidth="1.5" strokeOpacity="0.3"/>
                    <text x="40" y="48" textAnchor="middle" dominantBaseline="middle" fontSize="28" fontWeight="900" fill={t.color} fontStyle="italic">{t.abbr}</text>
                  </svg>
                </div>
                {/* Team name */}
                <h2 className="text-[26px] font-black italic uppercase tracking-tighter leading-none text-center">{t.label}</h2>
                <p className="text-[9px] font-bold uppercase tracking-[0.3em] text-zinc-400 mt-2">{t.sub}</p>
                {/* Bottom content */}
                <div className="flex items-center gap-3 mt-auto pt-6 w-full justify-center">
                  <span className="text-[8px] font-bold uppercase tracking-widest text-zinc-300 group-hover:text-zinc-500 transition-colors duration-500">{tr.teamSelect.enter}</span>
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center transition-all duration-500 group-hover:scale-110`} style={{backgroundColor:t.color}}>
                    <ChevronRight size={14} className="text-white"/>
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
      <div className="relative z-10 text-center pb-6">
        <p className="text-[7px] font-black uppercase tracking-[0.5em] text-zinc-300">Fédération Tunisienne de Football</p>
      </div>
    </div>
  )
}
// ─────────────────────────────────────────────
// PERMISSION LABELS
// ─────────────────────────────────────────────
const PERM_LABELS: {key:keyof UserPerms;label:string}[] = [
  {key:"addPlayer",label:"Add Player"},{key:"editPlayer",label:"Edit Player"},{key:"deletePlayer",label:"Delete Player"},
  {key:"addMatch",label:"Add Match"},{key:"deleteMatch",label:"Delete Match"},
  {key:"useScout",label:"Scout Button"},{key:"exportData",label:"Export Data"},
  {key:"viewMedical",label:"View Medical"},{key:"editMedical",label:"Edit Medical"},
]

// ═════════════════════════════════════════════
// MAIN APP
// ═════════════════════════════════════════════
export default function EliteSquadApp() {
  const { tr, setLang, lang } = useTranslate()
  const [user,setUser]=useState<{id:string;username:string;firstName:string;lastName:string;role:string;perms:UserPerms}|null>(null)
  const [authChecked,setAuthChecked]=useState(false)
  const [buffering,setBuffering]=useState(false)
  const [members,setMembers]=useState<any[]>([])
  const [matches,setMatches]=useState<any[]>([])
  const membersSnapshot=useRef<Map<any,any>>(new Map())
  const matchesSnapshot=useRef<Map<any,any>>(new Map())
  const applyingRemote=useRef(false)
  const handleChangePassword=async()=>{
    const pw1=window.prompt("New password (min 6 characters):")
    if(!pw1)return
    if(pw1.length<6){alert("Password must be at least 6 characters");return}
    const pw2=window.prompt("Confirm new password:")
    if(pw1!==pw2){alert("Passwords don't match");return}
    const {error}=await changeMyPassword(pw1)
    if(error){alert("Failed: "+error)}else{alert("Password updated!")}
  }
  const loadMyUser=async()=>{
    const profile=await fetchMyProfile()
    if(!profile||profile.status!=="active"){ setUser(null); return null }
    const u={id:profile.id,username:profile.username,firstName:profile.first_name,lastName:profile.last_name,role:profile.role,perms:profile.permissions}
    setUser(u)
    return u
  }
  const mergeById=(local:any[],remote:any[])=>{const m=new Map();remote.forEach(i=>m.set(i.id,i));local.forEach(i=>{const e=m.get(i.id);if(!e||(i.updatedAt||0)>=(e.updatedAt||0))m.set(i.id,i)});return[...m.values()]}
  const [activeTab,setActiveTab]=useState("PLAYERS")
  const [teamCat,setTeamCat]=useState<TeamCategory|null>(null)
  const [search,setSearch]=useState("")
  const [filterPos,setFilterPos]=useState("ALL")
  const [selectedIds,setSelectedIds]=useState<Set<string>>(new Set())
  const [opponentFilter,setOpponentFilter]=useState("")
  const [rawProfiles,setRawProfiles]=useState<any[]>([])
  const fetchedUsers:AppUser[]=rawProfiles.map(profileToAppUser)
  const reloadProfiles=async()=>{const data=await fetchAllProfiles();setRawProfiles(data)}
  const syncUsers=()=>{reloadProfiles()}
  const [selMember,setSelMember]=useState<any>(null)
  const [profileTab,setProfileTab]=useState<"profile"|"medical">("profile")
  const [injuries,setInjuries]=useState<any[]>([])
  const [addInjuryOpen,setAddInjuryOpen]=useState(false)
  const [injForm,setInjForm]=useState({injury_type:"",body_part:"",severity:"moderate",occurred_on:"",expected_return:"",notes:""})
  useEffect(()=>{
    setProfileTab("profile")
    if(selMember&&(p.viewMedical||canManageUsers)) fetchInjuries(selMember.id).then(setInjuries)
    else setInjuries([])
  },[selMember?.id])
  const [isFormOpen,setIsFormOpen]=useState(false)
  const [editingId,setEditingId]=useState<number|null>(null)
  const [confirmState,setConfirmState]=useState<{message:string;resolve:(v:boolean)=>void}|null>(null)
  const askConfirm=(message:string):Promise<boolean>=>new Promise(resolve=>setConfirmState({message,resolve}))
  const [isMatchOpen,setIsMatchOpen]=useState(false)
  const [scheduleOpen,setScheduleOpen]=useState(false)
  const [scheduleForm,setScheduleForm]=useState({opponent:"",date:"",competition:"",venue:""})
  const [isHistoryOpen,setIsHistoryOpen]=useState(false)
  const [matchSheetTarget,setMatchSheetTarget]=useState<any>(null)
  const [selMatch,setSelMatch]=useState<any>(null)
  const [usersOpen,setUsersOpen]=useState(false)
  const [activityLogOpen,setActivityLogOpen]=useState(false)
  const [activityLog,setActivityLog]=useState<any[]>([])
  const [newsOpen,setNewsOpen]=useState(false)
  const [upcomingOpen,setUpcomingOpen]=useState(false)
  const [newsItems,setNewsItems]=useState<any[]|null>(null)
  const [newsLoading,setNewsLoading]=useState(false)
  const [pendingReviewOpen,setPendingReviewOpen]=useState(false)
  const [pendingMatchesOpen,setPendingMatchesOpen]=useState(false)
  const [renderTick,setRenderTick]=useState(0)
  const [actionPick,setActionPick]=useState<"goal"|"yellow"|"red"|"sub"|null>(null)
  const [subOutId,setSubOutId]=useState<number|null>(null)
  const [matchStep,setMatchStep]=useState(0)
  const pendingUsers = fetchedUsers.filter(u=>u.status==="pending")
  const pendingCount = pendingUsers.length
  const fileRef=useRef<HTMLInputElement>(null)

  const initForm={name:"",club:"",position:"",image:"",natMatches:"",goals:"",assists:"",cleansheets:0,height:"",birthdate:"",yellowCards:0,redCards:0,suspended:false,history:[],foot:"R",nationality:"",languages:"",contract:"",bioQuote:"",leagueRegion:"",dualNationality:false,secondNationality:""}
  const [form,setForm]=useState<any>(initForm)
  const initMatch={opponent:"",date:"",result:"",venue:"",competition:"",squad:[] as number[],scorers:[] as {playerId:number,goals:number}[],yellowCards:[] as number[],redCards:[] as number[],subs:[] as {out:number;in:number}[],notes:"",opponentSquad:[] as string[],opponentScorers:[] as {name:string,goals:number}[],opponentYellowCards:[] as string[],opponentRedCards:[] as string[],opponentSubs:[] as {out:string;in:string}[],tunisiaPossession:"",opponentPossession:"",tunisiaShots:"",opponentShots:"",tunisiaShotsOnTarget:"",opponentShotsOnTarget:"",tunisiaCorners:"",opponentCorners:"",tunisiaFouls:"",opponentFouls:""}
  const countryFlags:Record<string,string>={"Tunisia":"tn","Algeria":"dz","Egypt":"eg","Morocco":"ma","Senegal":"sn","Nigeria":"ng","Cameroon":"cm","Ghana":"gh","Ivory Coast":"ci","Côte d'Ivoire":"ci","Cote d'Ivoire":"ci","Mali":"ml","Burkina Faso":"bf","South Africa":"za","DR Congo":"cd","DRC":"cd","Congo":"cg","Zambia":"zm","Equatorial Guinea":"gq","Guinea":"gn","Guinea-Bissau":"gw","Benin":"bj","Togo":"tg","Sierra Leone":"sl","Liberia":"lr","Sudan":"sd","South Sudan":"ss","Uganda":"ug","Kenya":"ke","Tanzania":"tz","Rwanda":"rw","Burundi":"bi","Ethiopia":"et","Eritrea":"er","Somalia":"so","Angola":"ao","Namibia":"na","Botswana":"bw","Zimbabwe":"zw","Mozambique":"mz","Malawi":"mw","Lesotho":"ls","Eswatini":"sz","Madagascar":"mg","Mauritius":"mu","Cape Verde":"cv","Mauritania":"mr","Gambia":"gm","Gabon":"ga","Chad":"td","Niger":"ne","Libya":"ly","France":"fr","England":"gb-eng","Spain":"es","Germany":"de","Italy":"it","Netherlands":"nl","Portugal":"pt","Belgium":"be","Croatia":"hr","Switzerland":"ch","Sweden":"se","Denmark":"dk","Norway":"no","Poland":"pl","Brazil":"br","Argentina":"ar","Uruguay":"uy","Colombia":"co","Chile":"cl","Peru":"pe","Ecuador":"ec","Mexico":"mx","USA":"us","United States":"us","Canada":"ca","Japan":"jp","South Korea":"kr","Korea Republic":"kr","Saudi Arabia":"sa","Iran":"ir","Australia":"au","New Zealand":"nz"}
  const flagImg=(name:string)=>{const c=countryFlags[name];return c?<img src={`https://flagcdn.com/16x12/${c}.png`} alt="" className="w-4 h-3 inline-block align-middle rounded-sm"/>:null}
  const [matchForm,setMatchForm]=useState<any>(initMatch)
  const initScoutUse={club:false,position:false,birthdate:false,height:false,natMatches:false,goals:false,assists:false,history:false}
  const [scoutPlayer,setScoutPlayer]=useState<any>(null)
  const [scoutResult,setScoutResult]=useState<any>(null)
  const [scoutLoading,setScoutLoading]=useState(false)
  const [scoutUseWiki,setScoutUseWiki]=useState(initScoutUse)
  const scoutFields=[{key:"club" as const,label:"Club"},{key:"position" as const,label:"Position"},{key:"birthdate" as const,label:"Birthdate"},{key:"height" as const,label:"Height"},{key:"natMatches" as const,label:"Caps"},{key:"goals" as const,label:"Goals"},{key:"assists" as const,label:"Assists"},{key:"history" as const,label:"History"}]

  const [loaded,setLoaded]=useState(false)

  const reloadMembers=async()=>{
    const data=await fetchMembers()
    applyingRemote.current=true
    membersSnapshot.current=new Map(data.map((m:any)=>[m.id,m]))
    setMembers(data)
    setTimeout(()=>{applyingRemote.current=false},0)
  }
  const reloadMatches=async()=>{
    const data=await fetchMatches()
    applyingRemote.current=true
    matchesSnapshot.current=new Map(data.map((m:any)=>[m.id,m]))
    setMatches(data)
    setTimeout(()=>{applyingRemote.current=false},0)
  }

  // Check for an existing Supabase Auth session on mount, then load data
  useEffect(()=>{
    ;(async()=>{
      await loadMyUser()
      setAuthChecked(true)
      await Promise.all([reloadMembers(),reloadMatches()])
      await reloadProfiles()
      setLoaded(true)
    })()
    const { data: sub } = supabase.auth.onAuthStateChange((event)=>{
      if(event==="SIGNED_OUT") setUser(null)
    })
    return ()=>{sub.subscription.unsubscribe()}
  },[])

  // (Re)subscribe to realtime whenever we have a confirmed authenticated user,
  // so the websocket carries a valid JWT for RLS-checked postgres_changes events.
  useEffect(()=>{
    if(!user)return
    let unsub=()=>{}
    let cancelled=false
    subscribeRealtime({
      onMembers:reloadMembers,
      onMatches:reloadMatches,
      onProfiles:reloadProfiles,
    }).then(fn=>{ if(!cancelled) unsub=fn; else fn() })
    return ()=>{cancelled=true;unsub()}
  },[user?.id])

  // Push local edits to Supabase (diffed against last known server state) whenever members/matches change
  useEffect(()=>{
    if(!loaded||applyingRemote.current)return
    if(JSON.stringify([...membersSnapshot.current.values()])===JSON.stringify(members))return
    syncMembers(membersSnapshot.current,members).then(()=>{
      membersSnapshot.current=new Map(members.map((m:any)=>[m.id,m]))
    })
  },[members])
  useEffect(()=>{
    if(!loaded||applyingRemote.current)return
    if(JSON.stringify([...matchesSnapshot.current.values()])===JSON.stringify(matches))return
    syncMatches(matchesSnapshot.current,matches).then(()=>{
      matchesSnapshot.current=new Map(matches.map((m:any)=>[m.id,m]))
    })
  },[matches])

  const selectCat=(cat:TeamCategory)=>{
    setTeamCat(cat);setFilterPos("ALL");setActiveTab("PLAYERS");setSearch("")
  }

  const [scoutRegionFilter,setScoutRegionFilter]=useState<Set<string>>(new Set())
  const [scoutDualOnly,setScoutDualOnly]=useState(false)
  const [scoutFilterOpen,setScoutFilterOpen]=useState(false)
  const [squadLabOpen,setSquadLabOpen]=useState(false)
  const [labFormation,setLabFormation]=useState("4-3-3")
  const [labSlots,setLabSlots]=useState<Record<string,number|null>>({})
  const [labPickerSlot,setLabPickerSlot]=useState<string|null>(null)
  const [labTemplates,setLabTemplates]=useState<any[]>([])
  const [labTemplateName,setLabTemplateName]=useState("")
  const filtered=useMemo(()=>members.filter(m=>
    m.role===activeTab&&m.teamCategory===teamCat&&
    m.name.toLowerCase().includes(search.toLowerCase())&&
    (filterPos==="ALL"||m.position===filterPos)&&
    (scoutRegionFilter.size===0||(m.leagueRegion&&scoutRegionFilter.has(m.leagueRegion)))&&
    (!scoutDualOnly||m.dualNationality)
  ),[members,activeTab,search,filterPos,teamCat,scoutRegionFilter,scoutDualOnly])

  const catPlayers=useMemo(()=>members.filter(m=>m.role==="PLAYERS"&&m.teamCategory===teamCat),[members,teamCat])
  const catMatches=useMemo(()=>matches.filter(m=>m.teamCategory===teamCat&&m.status==="approved"),[matches,teamCat])
  const pendingMatches=useMemo(()=>matches.filter(m=>m.teamCategory===teamCat&&m.status==="pending"),[matches,teamCat])
  const catLabel=(c:TeamCategory|null)=>!c?"":(c==="SENIORS"?"SENIORS":c==="U20"?"U-20":"U-17")

  const saveForm=(e:React.FormEvent)=>{
    e.preventDefault()
    const payload={...form,id:editingId||Date.now(),role:activeTab,teamCategory:teamCat,yellowCards:Number(form.yellowCards)||0,redCards:Number(form.redCards)||0,updatedAt:Date.now()}
    const newMembers=editingId?members.map(m=>m.id===editingId?payload:m):[...members,payload]
    setMembers(newMembers)
    setIsFormOpen(false)
  }

  const handleImport=(data:{members:any[],matches:any[]})=>{
    if(data.members?.length) setMembers(data.members)
    if(data.matches?.length) setMatches(data.matches)
  }

  const handleAIUpdate=async ()=>{
    try{
      const res=await fetch("/api/scout",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name:form.name})})
      if(res.ok){
        const result=await res.json()
        const d=result?.sources?.database || result?.sources?.wikipedia || result?.data
        if(d){
          setForm({...form, club: d.club||"", position: d.position||"", birthdate: d.birthdate||"", height: d.height||"", natMatches: String(d.natMatches||""), goals: String(d.goals||""), assists: String(d.assists||""), yellowCards: d.yellowCards||0, redCards: d.redCards||0, history: (d.history||[]).filter((h:any)=>h.year&&!h.year.startsWith("0000"))})
          return
        }
      }
    }catch{}
    const result=searchPlayerDatabase(form.name)
    if(result.found&&result.data){
      const d=result.data
      setForm({...form, club: d.club, position: d.position, birthdate: d.birthdate, height: d.height, natMatches: String(d.natMatches), goals: String(d.goals), assists: String(d.assists), yellowCards: d.yellowCards, redCards: d.redCards, history: (d.history||[]).filter((h:any)=>h.year&&!h.year.startsWith("0000"))})
    }
  }

  const handleCardScout=async(player:any)=>{
    setScoutPlayer(player)
    setScoutUseWiki(initScoutUse)
    setScoutLoading(true)
    try{
      const res=await fetch("/api/scout",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name:player.name})})
      if(res.ok){
        const data=await res.json()
        setScoutResult(data)
        // Auto-prefer Wikipedia when available (more reliable than static DB)
        if(data?.sources?.wikipedia){
          const w=data.sources.wikipedia
          setScoutUseWiki({
            club:!!w.club, position:!!w.position, birthdate:!!w.birthdate, height:!!w.height,
            natMatches:w.natMatches!=null, goals:w.goals!=null, assists:w.assists!=null,
            history:!!(w.history?.length),
          })
        }
      }
    }catch{}
    setScoutLoading(false)
  }
  const toggleScoutField=(field:keyof typeof initScoutUse)=>setScoutUseWiki(p=>({...p,[field]:!p[field]}))
  const selectAllDbScout=()=>setScoutUseWiki(initScoutUse)
  const selectAllWikiScout=()=>setScoutUseWiki({club:true,position:true,birthdate:true,height:true,natMatches:true,goals:true,assists:true,history:true})
  const applyCardScout=()=>{
    if(!scoutResult?.sources||!scoutPlayer)return
    const{ database:dbData, wikipedia:wikiData }=scoutResult.sources
    const updated={...scoutPlayer}
    if(scoutUseWiki.club&&wikiData?.club)updated.club=wikiData.club
    else if(dbData?.club)updated.club=dbData.club
    if(scoutUseWiki.position&&wikiData?.position)updated.position=wikiData.position
    else if(dbData?.position)updated.position=dbData.position
    if(scoutUseWiki.birthdate&&wikiData?.birthdate)updated.birthdate=wikiData.birthdate
    else if(dbData?.birthdate)updated.birthdate=dbData.birthdate
    if(scoutUseWiki.height&&wikiData?.height)updated.height=wikiData.height
    else if(dbData?.height)updated.height=dbData.height
    if(scoutUseWiki.natMatches&&wikiData?.natMatches!=null)updated.natMatches=String(wikiData.natMatches)
    else if(dbData?.natMatches!=null)updated.natMatches=String(dbData.natMatches)
    if(scoutUseWiki.goals&&wikiData?.goals!=null)updated.goals=String(wikiData.goals)
    else if(dbData?.goals!=null)updated.goals=String(dbData.goals)
    if(scoutUseWiki.assists&&wikiData?.assists!=null)updated.assists=String(wikiData.assists)
    else if(dbData?.assists!=null)updated.assists=String(dbData.assists)
    if(scoutUseWiki.history&&wikiData?.history?.length)updated.history=wikiData.history.filter((h:any)=>h.year&&!h.year.startsWith("0000"))
    else if(dbData?.history?.length)updated.history=dbData.history.filter((h:any)=>h.year&&!h.year.startsWith("0000"))
    setMembers(p=>p.map(m=>m.id===updated.id?{...updated,updatedAt:Date.now()}:m))
    setScoutPlayer(null);setScoutResult(null)
  }
  const approveMatch=(match:any)=>{
    setMatches(p=>p.map((x:any)=>x.id===match.id?{...x,status:"approved"}:x))
    const cat=match.teamCategory
    // Accumulate yellow/red cards from match onto player records
    setMembers(p=>p.map(m=>{
      if(m.role!=="PLAYERS"||m.teamCategory!==cat) return m
      const gotYellow=match.yellowCards?.includes(m.id)?1:0
      const gotRed=match.redCards?.includes(m.id)?1:0
      const ny=(m.yellowCards||0)+gotYellow
      const nr=(m.redCards||0)+gotRed
      return {...m,yellowCards:ny,redCards:nr,suspended:ny>=YELLOW_SUSPENSION||nr>0?true:(m.suspended||false)}
    }))
    setPendingMatchesOpen(false)
  }
  const saveMatch=(e:React.FormEvent)=>{
    e.preventDefault()
    const id=Date.now()
    const newMatch={...matchForm,id,teamCategory:teamCat,status:canManageUsers?"approved":"pending",submittedBy:user?.username}
    setMatches(p=>[...p,newMatch])
    if(canManageUsers) approveMatch(newMatch)
    setIsMatchOpen(false); setMatchForm(initMatch)
  }

  const toggleSquad=(id:number)=>setMatchForm((p:any)=>({...p,squad:p.squad.includes(id)?p.squad.filter((x:number)=>x!==id):[...p.squad,id]}))
  const moveDown=(id:number,i:number)=>setMatchForm((p:any)=>{const s=[...p.squad];s.splice(i,1);s.push(id);return{...p,squad:s}})
  const moveUp=(id:number)=>setMatchForm((p:any)=>{const s=[...p.squad];const ri=s.indexOf(id);s.splice(ri,1);s.splice(10,0,id);return{...p,squad:s}})
  const subOut=(id:number)=>setMatchForm((p:any)=>{const bi=p.squad.slice(11);if(bi.length<1)return p;const si=bi[0];return{...p,squad:p.squad.map((x:number)=>x===id?si:x===si?id:x),subs:[...p.subs,{out:id,"in":si}]}})
  const subOutWith=(xiId:number,bnId:number)=>setMatchForm((p:any)=>({...p,squad:p.squad.map((x:number)=>x===xiId?bnId:x===bnId?xiId:x),subs:[...p.subs,{out:xiId,"in":bnId}]}))
  const removeSub=(idx:number)=>setMatchForm((p:any)=>{const s=p.subs[idx];if(!s)return p;return{...p,squad:p.squad.map((x:number)=>x===s.out?s["in"]:x===s["in"]?s.out:x),subs:p.subs.filter((_:any,i:number)=>i!==idx)}})
  const subIn=(id:number)=>setMatchForm((p:any)=>{const xi=p.squad.slice(0,11);const so=xi[10];return{...p,squad:p.squad.map((x:number)=>x===so?id:x===id?so:x),subs:[...p.subs,{out:so,"in":id}]}})
  const undoSub=(id:number,isIn:boolean)=>setMatchForm((p:any)=>{const ms=isIn?p.subs.find((s:any)=>s["in"]===id):p.subs.find((s:any)=>s.out===id);if(!ms)return p;return{...p,squad:p.squad.map((x:number)=>x===ms.out?ms["in"]:x===ms["in"]?ms.out:x),subs:p.subs.filter((s:any)=>s.out!==ms.out||s["in"]!==ms["in"])}})
  const editGoals=(id:number,delta:number)=>setMatchForm((p:any)=>{const g=(p.scorers.find((s:any)=>s.playerId===id)?.goals||0)+delta;if(g<=0)return{...p,scorers:p.scorers.filter((s:any)=>s.playerId!==id)};if(p.scorers.find((s:any)=>s.playerId===id))return{...p,scorers:p.scorers.map((s:any)=>s.playerId===id?{...s,goals:g}:s)};return{...p,scorers:[...p.scorers,{playerId:id,goals:g}]}})
  const removeGoal=(id:number)=>setMatchForm((p:any)=>({...p,scorers:p.scorers.filter((s:any)=>s.playerId!==id)}))
  const toggleYellow=(id:number)=>setMatchForm((p:any)=>({...p,yellowCards:p.yellowCards.includes(id)?p.yellowCards.filter((x:number)=>x!==id):[...p.yellowCards,id]}))
  const toggleRed=(id:number)=>setMatchForm((p:any)=>({...p,redCards:p.redCards.includes(id)?p.redCards.filter((x:number)=>x!==id):[...p.redCards,id]}))
  const PickerCard=({title,color,players,onPick,onClose,filter}:{title:string;color:"green"|"yellow"|"red"|"blue";players:number[];onPick:(id:number)=>void;onClose:()=>void;filter?:(id:number)=>boolean})=>{
    const cMap:Record<string,string>={green:"border-green-200 bg-green-50 text-green-700 hover:bg-green-100",yellow:"border-yellow-200 bg-yellow-50 text-yellow-700 hover:bg-yellow-100",red:"border-red-200 bg-red-50 text-red-700 hover:bg-red-100",blue:"border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"}
    const tMap:Record<string,string>={green:"text-green-700",yellow:"text-yellow-700",red:"text-red-700",blue:"text-blue-700"}
    return(
      <div className="mb-4 rounded-xl border border-zinc-200 bg-zinc-50 p-3">
        <div className="flex items-center justify-between mb-2">
          <p className={`text-[9px] font-black uppercase tracking-wider ${tMap[color]}`}>{title}</p>
          <button onClick={onClose} className="text-[9px] font-bold text-zinc-400 hover:text-zinc-600">✕ Cancel</button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {players.filter(pid=>!filter||filter(pid)).map((pid:number)=>{
            const pl=catPlayers.find((p:any)=>p.id===pid)
            if(!pl) return null
            return(
              <button key={pid} onClick={()=>onPick(pid)} className={`px-3 py-2 rounded-lg border text-xs font-bold transition-all ${cMap[color]}`}>
                {pl.name}
              </button>
            )
          })}
          {players.filter(pid=>!filter||filter(pid)).length===0&&<p className="text-xs text-zinc-400 py-2">No available players</p>}
        </div>
      </div>
    )
  }
  const p = user?.perms || DEFAULT_PERMS
  const canManageUsers = user?.role === "admin"

  // ── STATS DASHBOARD ──
  const StatsView = () => {
    const squad = catPlayers.filter(p=>p.role==="PLAYERS")
    const topScorers = [...squad].sort((a,b)=>(b.goals||0)-(a.goals||0)).slice(0,10)
    const topAssists = [...squad].sort((a,b)=>(b.assists||0)-(a.assists||0)).slice(0,10)
    const topCaps = [...squad].sort((a,b)=>(b.natMatches||0)-(a.natMatches||0)).slice(0,10)
    const recent = catMatches.slice(-5).map(m=>{const r=m.result;if(!r||!r.includes('-'))return null;const [a,b]=r.split('-').map(Number);return isNaN(a)||isNaN(b)?null:a>b?'W':a<b?'L':'D'}).filter(Boolean)
    const posCount = {GOALKEEPER:0,DEFENDER:0,MIDFIELDER:0,FORWARD:0}
    squad.forEach(p=>{if(p.position in posCount)posCount[p.position as keyof typeof posCount]++})
    return(
      <div className="p-4 sm:p-5 space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Object.entries(posCount).map(([pos,count])=>(<div key={pos} className="bg-white rounded-xl border border-zinc-100 p-3 text-center shadow-sm hover:shadow-md hover:border-[#E30613]/20 transition-all duration-300 hover:-translate-y-0.5"><p className="text-[18px] font-black text-zinc-800">{count}</p><p className="text-[7px] font-black uppercase tracking-wider text-zinc-400">{pos==='GOALKEEPER'?'GK':pos==='DEFENDER'?'DEF':pos==='MIDFIELDER'?'MID':'FWD'}</p></div>))}
        </div>
        {recent.length>0&&<div className="bg-white rounded-xl border border-zinc-100 p-3 shadow-sm hover:shadow-md transition-all duration-300"><p className="text-[7px] font-black uppercase tracking-wider text-zinc-400 mb-2">Recent Form</p><div className="flex gap-1.5">{recent.map((r,i)=><div key={i} className={`w-7 h-7 rounded-lg flex items-center justify-center text-[9px] font-black text-white ${r==='W'?'bg-green-500':r==='D'?'bg-yellow-500':'bg-red-500'} hover:scale-110 transition-transform`}>{r}</div>)}</div></div>}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[{title:"Top Scorers",key:"goals",data:topScorers},{title:"Most Assists",key:"assists",data:topAssists},{title:"Most Caps",key:"natMatches",data:topCaps}].map(section=>(
            <div key={section.title} className="bg-white rounded-xl border border-zinc-100 p-3 shadow-sm">
              <p className="text-[7px] font-black uppercase tracking-wider text-zinc-400 mb-2">{section.title}</p>
              <div className="space-y-1.5">
                {section.data.map((p,i)=>(
                  <div key={p.id} className="flex items-center gap-2 text-[10px]">
                    <span className="w-4 text-right font-black text-zinc-300">{i+1}</span>
                    <span className="text-[6px] font-black px-1 py-0.5 rounded bg-[#E30613]/10 text-[#E30613]">{p.position.slice(0,3)}</span>
                    <span className="font-bold truncate text-zinc-800">{p.name}</span>
                    <span className="ml-auto font-black text-zinc-500">{p[section.key as keyof typeof p]||0}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // ── RENDER GATES ──
  if(buffering||!authChecked) return(
    <div className="min-h-screen flex flex-col items-center justify-center bg-white text-zinc-900 relative overflow-hidden">
      {/* Ambient glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-[#E30613]/5 blur-[100px] animate-pulse"/>
      <div className="relative flex flex-col items-center gap-8">
        {/* Logo with floating effect */}
        <div className="relative animate-[float_3s_ease-in-out_infinite]">
          <div className="w-40 h-40 rounded-full bg-white shadow-2xl shadow-red-500/10 flex items-center justify-center border border-zinc-100">
            <img src="/ftf-logo.png" className="h-24" alt=""/>
          </div>
          {/* Ring spinner */}
          <div className="absolute -inset-3">
            <div className="w-full h-full rounded-full border-[3px] border-transparent border-t-[#E30613] border-r-[#E30613]/30 animate-spin" style={{animationDuration:'1.8s'}}/>
          </div>
          <div className="absolute -inset-1.5">
            <div className="w-full h-full rounded-full border border-transparent border-b-[#E30613]/20 border-l-[#E30613]/10 animate-spin" style={{animationDuration:'2.5s',animationDirection:'reverse'}}/>
          </div>
        </div>
        {/* Loading dots */}
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-[#E30613] animate-[loadDot_1.4s_ease-in-out_infinite]"/>
          <div className="w-2 h-2 rounded-full bg-[#E30613] animate-[loadDot_1.4s_ease-in-out_infinite_0.2s]"/>
          <div className="w-2 h-2 rounded-full bg-[#E30613] animate-[loadDot_1.4s_ease-in-out_infinite_0.4s]"/>
        </div>
        {/* Text */}
        <div className="flex flex-col items-center gap-1">
          <p className="text-[11px] font-bold uppercase tracking-[0.35em] text-zinc-500">{tr.login.loadingDb}</p>
          <p className="text-[7px] font-medium text-zinc-300 uppercase tracking-[0.25em]">Fédération Tunisienne de Football</p>
        </div>
      </div>
      <style>{`@keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}@keyframes loadDot{0%,80%,100%{opacity:0.2;transform:scale(0.8)}40%{opacity:1;transform:scale(1)}}`}</style>
    </div>
  )
  if(authChecked&&!user) return <LoginScreen onLogin={()=>{setBuffering(true);(async()=>{await loadMyUser();await Promise.all([reloadMembers(),reloadMatches(),reloadProfiles()]);setLoaded(true)})().finally(()=>setTimeout(()=>setBuffering(false),1200))}}/>
  if(!teamCat) return(
    <div className="relative">
      <div className="fixed top-6 right-6 z-[999] flex gap-3">
        <button onClick={()=>setLang(lang==="en"?"fr":lang==="fr"?"ar":"en")} title="Change language" className="p-3 rounded-xl border border-zinc-300 bg-white/80 text-zinc-600 hover:text-black transition-all text-[10px] font-black uppercase tracking-widest"><Globe size={16}/><span className="ml-1">{lang.toUpperCase()}</span></button>
        <span className="text-[9px] font-black uppercase tracking-wider text-zinc-400 self-center">{user?.username}</span>
        <button onClick={handleChangePassword} title="Change your password" className="p-3 rounded-xl border border-zinc-300 bg-white/80 text-zinc-600 hover:bg-blue-500 hover:text-white transition-all"><Key size={18}/></button><button onClick={()=>{supabase.auth.signOut();setUser(null)}} title="Log out" className="p-3 rounded-xl border border-zinc-300 bg-white/80 text-zinc-600 hover:bg-red-500 hover:text-white transition-all"><LogOut size={18}/></button>
      </div>
      <TeamSelector onSelect={selectCat}/>
    </div>
  )

  // ── MAIN SQUAD VIEW ──
  return(
    <main className="min-h-screen bg-zinc-50 text-zinc-900 relative">
      {!loaded&&<div className="fixed inset-0 z-[999] bg-white flex items-center justify-center"><div className="flex flex-col items-center gap-3"><div className="w-6 h-6 border-2 border-[#E30613] border-t-transparent rounded-full animate-spin"/><p className="text-[9px] font-black uppercase tracking-widest text-zinc-400">Loading...</p></div></div>}
      {/* Ambient animated background */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 left-1/3 w-[600px] h-[600px] rounded-full bg-[#E30613]/5 blur-[120px] animate-[pulse_4s_ease-in-out_infinite]"/>
        <div className="absolute bottom-1/4 right-1/3 w-[400px] h-[400px] rounded-full bg-amber-500/5 blur-[100px] animate-[pulse_5s_ease-in-out_infinite_1s]"/>
        <div className="absolute inset-0 flex items-center justify-center">
          <img src="/ftf-logo.png" className="w-[60%] opacity-[0.03] grayscale animate-[spin_60s_linear_infinite]" alt=""/>
        </div>
      </div>

      {/* ─── HEADER ─── */}
      <header className="sticky top-0 z-[100] bg-white/95 backdrop-blur-md border-b border-zinc-200 relative">
        <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[#E30613]/40 to-transparent animate-[pulse_3s_ease-in-out_infinite]"/>
        <div className="max-w-7xl mx-auto px-6 pt-3 pb-2 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button onClick={()=>{setTeamCat(null);setSearch("")}} title="Back to team categories" className="p-2 rounded-xl border border-zinc-200 text-zinc-500 hover:bg-zinc-100 transition-all"><ChevronLeft size={16}/></button>
            <img src="/ftf-logo.png" className="h-10" alt=""/>
            <div className="leading-tight">
              <h1 className="text-xs sm:text-xl font-black italic uppercase tracking-wider leading-none">{tr.header.eliteSquad}</h1>
              <p className="text-[9px] font-black text-[#E30613] uppercase tracking-[0.3em]">{catLabel(teamCat)}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="hidden sm:flex items-center px-3 py-2 rounded-xl border border-zinc-200 bg-zinc-50 w-40">
              <Search size={13} className="mr-2 text-zinc-400 shrink-0"/>
              <input placeholder={tr.header.search} className="bg-transparent text-[10px] font-bold outline-none w-full uppercase text-zinc-900 placeholder-zinc-400" value={search} onChange={e=>setSearch(e.target.value)}/>
            </div>
            <button onClick={()=>{if(canManageUsers&&pendingMatches.length>0)setPendingMatchesOpen(true);else setIsHistoryOpen(true)}} title="Match history" className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-zinc-200 text-[9px] font-black uppercase tracking-widest transition-all text-zinc-500 hover:bg-[#E30613]/10 hover:border-[#E30613]/30 hover:text-[#E30613]">
              <BookOpen size={14}/>
              <span className="hidden sm:inline">{tr.header.matches}</span>
              {canManageUsers&&pendingMatches.length>0&&<span className="bg-amber-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-[7px] font-black">{pendingMatches.length}</span>}
              {catMatches.length>0&&<span className="bg-[#E30613] text-white rounded-full w-4 h-4 flex items-center justify-center text-[7px] font-black">{catMatches.length}</span>}
            </button>
            {p.addMatch&&<button onClick={()=>{setMatchForm(initMatch);setIsMatchOpen(true)}} title="Add a new match" className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-zinc-200 text-[9px] font-black uppercase tracking-widest transition-all text-zinc-500 hover:bg-green-50 hover:border-green-300 hover:text-green-600">
              <Users size={14}/><span className="hidden sm:inline">Add Match</span>
            </button>}
            {p.addMatch&&<button onClick={()=>{setScheduleForm({opponent:"",date:"",competition:"",venue:""});setScheduleOpen(true)}} title="Schedule an upcoming fixture" className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-zinc-200 text-[9px] font-black uppercase tracking-widest transition-all text-zinc-500 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-600">
              <Calendar size={14}/><span className="hidden sm:inline">Schedule Match</span>
            </button>}
            <NotificationBell members={members} matches={matches} teamCat={teamCat} onSelectMember={setSelMember} />

            <div className="w-px h-6 bg-zinc-200 mx-0.5"/>

            <Dropdown trigger={
              <button title="Tools" className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-zinc-200 text-[9px] font-black uppercase tracking-widest transition-all text-zinc-500 hover:bg-zinc-100">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
                <span className="hidden sm:inline">Tools</span><ChevronDown size={11}/>
              </button>
            }>
              {p.exportData&&<div className="px-1"><ExportTools members={members} matches={matches} teamCat={teamCat} onImport={handleImport} /></div>}
              <button onClick={()=>window.print()} className="flex items-center gap-2 px-3.5 py-2 text-[10px] font-bold text-zinc-600 hover:bg-zinc-50 transition-all text-left">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                Print
              </button>
              <button onClick={()=>setLang(lang==="en"?"fr":lang==="fr"?"ar":"en")} className="flex items-center gap-2 px-3.5 py-2 text-[10px] font-bold text-zinc-600 hover:bg-zinc-50 transition-all text-left">
                <Globe size={14}/>Language ({lang.toUpperCase()})
              </button>
              <button onClick={()=>setUpcomingOpen(true)} className="flex items-center gap-2 px-3.5 py-2 text-[10px] font-bold text-zinc-600 hover:bg-zinc-50 transition-all text-left">
                <Calendar size={14}/>Upcoming Matches
              </button>
              {p.addMatch&&<button onClick={async()=>{setLabSlots({});setLabTemplateName("");setSquadLabOpen(true);setLabTemplates(await fetchSquadTemplates(teamCat))}} className="flex items-center gap-2 px-3.5 py-2 text-[10px] font-bold text-zinc-600 hover:bg-zinc-50 transition-all text-left">
                <Users size={14}/>Squad Lab
              </button>}
              <button onClick={()=>{setNewsOpen(true);if(newsItems===null){setNewsLoading(true);fetch('/api/news').then(r=>r.json()).then(d=>{setNewsItems(d.items||[]);setNewsLoading(false)}).catch(()=>setNewsLoading(false))}}} className="flex items-center gap-2 px-3.5 py-2 text-[10px] font-bold text-zinc-600 hover:bg-zinc-50 transition-all text-left">
                <Newspaper size={14}/>Women's Football News
              </button>
            </Dropdown>

            {canManageUsers&&(
              <Dropdown trigger={
                <button title="Admin" className="relative flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#E30613]/20 bg-[#E30613]/5 text-[9px] font-black uppercase tracking-widest transition-all text-[#E30613] hover:bg-[#E30613]/10">
                  <ShieldCheck size={14}/><span className="hidden sm:inline">Admin</span><ChevronDown size={11}/>
                  {pendingCount>0&&<span className="absolute -top-1.5 -right-1.5 bg-[#E30613] text-white rounded-full w-4 h-4 flex items-center justify-center text-[6px] font-black">{pendingCount}</span>}
                </button>
              }>
                <button onClick={()=>setPendingReviewOpen(true)} className="flex items-center gap-2 px-3.5 py-2 text-[10px] font-bold text-zinc-600 hover:bg-zinc-50 transition-all text-left">
                  <Bell size={14}/>Pending Approvals{pendingCount>0&&<span className="ml-auto bg-[#E30613] text-white rounded-full w-4 h-4 flex items-center justify-center text-[7px] font-black">{pendingCount}</span>}
                </button>
                <button onClick={()=>setUsersOpen(true)} className="flex items-center gap-2 px-3.5 py-2 text-[10px] font-bold text-zinc-600 hover:bg-zinc-50 transition-all text-left">
                  <Users size={14}/>Manage Users
                </button>
                <button onClick={async()=>{setActivityLogOpen(true);setActivityLog(await fetchActivityLog())}} className="flex items-center gap-2 px-3.5 py-2 text-[10px] font-bold text-zinc-600 hover:bg-zinc-50 transition-all text-left">
                  <Activity size={14}/>Activity Log
                </button>
              </Dropdown>
            )}

            <Dropdown trigger={
              <button title="Account" className="flex items-center gap-1.5 px-2 py-1.5 rounded-xl border border-zinc-200 hover:bg-zinc-100 transition-all">
                <div className="w-6 h-6 rounded-full bg-zinc-800 text-white flex items-center justify-center text-[9px] font-black uppercase shrink-0">{(user?.username||"?")[0]}</div>
                <span className="hidden sm:inline text-[8px] font-black uppercase tracking-wider text-zinc-500">{user?.username}</span>
                <ChevronDown size={11} className="text-zinc-400"/>
              </button>
            }>
              <button onClick={handleChangePassword} className="flex items-center gap-2 px-3.5 py-2 text-[10px] font-bold text-zinc-600 hover:bg-zinc-50 transition-all text-left">
                <Key size={14}/>Change Password
              </button>
              <button onClick={()=>{supabase.auth.signOut();setUser(null)}} className="flex items-center gap-2 px-3.5 py-2 text-[10px] font-bold text-red-500 hover:bg-red-50 transition-all text-left">
                <LogOut size={14}/>Log Out
              </button>
            </Dropdown>

            {p.addPlayer&&<button onClick={()=>{setEditingId(null);setForm(initForm);setIsFormOpen(true)}} title="Add new player/staff" className="p-2 rounded-full bg-[#E30613] text-white hover:bg-red-700 transition-all"><Plus size={16}/></button>}
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-6 pb-3 flex items-center gap-3 flex-wrap">
          <div className="flex p-1 rounded-xl bg-zinc-100 border border-zinc-200">
            <button onClick={()=>{setActiveTab("STATS");setFilterPos("ALL")}} className={`px-5 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${activeTab==="STATS"?'bg-[#E30613] text-white':'text-zinc-500 hover:text-zinc-800'}`}>Stats</button>
            <button onClick={()=>{setActiveTab("PLAYERS");setFilterPos("ALL")}} className={`px-5 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${activeTab==="PLAYERS"?'bg-[#E30613] text-white':'text-zinc-500 hover:text-zinc-800'}`}>{tr.header.players}</button>
            <button onClick={()=>{setActiveTab("COACHES");setFilterPos("ALL")}} className={`px-5 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${activeTab==="COACHES"?'bg-[#E30613] text-white':'text-zinc-500 hover:text-zinc-800'}`}>{tr.header.staff}</button>
          </div>
          <div className="w-px h-6 bg-zinc-200"/>
          <div className="flex p-1 rounded-xl bg-zinc-100 border border-zinc-200">
            {(["SENIORS","U20","U17"] as TeamCategory[]).map(c=>(
              <button key={c} onClick={()=>selectCat(c)} className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${teamCat===c?'bg-[#E30613] text-white':'text-zinc-500 hover:text-zinc-800'}`}>
                {c==="SENIORS"?tr.header.seniors:c==="U20"?tr.header.u20:tr.header.u17}
              </button>
            ))}
          </div>
          <div className="w-px h-6 bg-zinc-200"/>
          <div className="flex gap-1.5 flex-wrap">
            {(activeTab==="PLAYERS"?PLAYER_POSITIONS:["ALL",...COACH_POSITIONS]).map(pos=>(
              <button key={pos} onClick={()=>setFilterPos(pos)} className={`px-3 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-widest border transition-all ${filterPos===pos?'bg-[#E30613] border-[#E30613] text-white':'border-zinc-200 bg-white text-zinc-500 hover:bg-zinc-50'}`}>{pos}</button>
            ))}
          </div>
        </div>

        {/* Scout filter — button opens a full panel with every league/region + dual nationality */}
        {activeTab==="PLAYERS"&&(
          <div className="max-w-7xl mx-auto px-6 pb-3">
            <button onClick={()=>setScoutFilterOpen(true)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[8px] font-black uppercase tracking-wider border transition-all ${(scoutRegionFilter.size>0||scoutDualOnly)?'bg-blue-600 border-blue-600 text-white':'border-zinc-200 bg-white text-zinc-500 hover:border-blue-300'}`}>
              <Globe size={11}/>Filter{(scoutRegionFilter.size>0||scoutDualOnly)&&<span className="bg-white/25 rounded-full px-1.5">{scoutRegionFilter.size+(scoutDualOnly?1:0)}</span>}
            </button>
          </div>
        )}
      </header>

      {/* ─── DISCIPLINE LEGEND ─── */}
      {activeTab==="PLAYERS"&&(
        <div className="max-w-7xl mx-auto px-6 py-2 flex items-center gap-3 flex-wrap border-b border-zinc-200">
          <div className="flex items-center gap-3 flex-wrap">
            <p className="text-[7px] font-black uppercase tracking-widest text-zinc-400">{tr.discipline.key}</p>
            <div className="flex items-center gap-1"><span className="text-[9px]">🟨</span><span className="text-[7px] font-black uppercase tracking-widest text-zinc-400">{tr.discipline.oneYellow}</span></div>
            <div className="flex items-center gap-1"><span className="text-[9px]">🟨🟨</span><span className="text-[7px] font-black uppercase tracking-widest text-zinc-400">{tr.discipline.twoYellows}</span></div>
            <div className="flex items-center gap-1"><span className="text-[9px]">🟥</span><span className="text-[7px] font-black uppercase tracking-widest text-zinc-400">{tr.discipline.redCard}</span></div>
          </div>
          <span className="text-[7px] text-zinc-300 italic hidden sm:block">{tr.discipline.cafRule}</span>
          <div className="ml-auto flex items-center gap-2">
            <button onClick={async()=>{if(await askConfirm("Reset all yellow/red cards for all players in this category?")){setMembers((p:any[])=>p.map(m=>m.teamCategory===teamCat?{...m,yellowCards:0,redCards:0,suspended:false}:m))}}}
              className="px-2 py-1 rounded-lg border border-zinc-200 text-[6px] font-black uppercase tracking-widest text-zinc-400 hover:text-red-500 hover:border-red-200 hover:bg-red-50 transition-all">Reset</button>
            {p.deletePlayer&&(selectedIds.size===0
              ?<button onClick={()=>setSelectedIds(new Set(members.filter(m=>m.role==="PLAYERS"&&m.teamCategory===teamCat).map(m=>m.id)))} className="flex items-center gap-1 px-2 py-1 rounded-lg border border-red-200 text-[6px] font-black uppercase tracking-widest text-red-400 hover:bg-red-50 transition-all"><Trash2 size={9}/>Select</button>
              :<><span className="text-[7px] font-bold text-red-500">{selectedIds.size}</span><button onClick={async()=>{const names=members.filter(m=>selectedIds.has(m.id)).map(m=>m.name).join(", ");if(await askConfirm(`Delete ${selectedIds.size} player(s)?\n\n${names}`)){setMembers(members.filter(m=>!selectedIds.has(m.id)));setSelectedIds(new Set())}}} className="px-2 py-1 rounded-lg bg-red-600 text-white text-[6px] font-black uppercase tracking-widest hover:bg-red-700 transition-all">Delete</button><button onClick={()=>setSelectedIds(new Set())} className="px-2 py-1 rounded-lg border border-zinc-300 text-[6px] font-black uppercase tracking-widest text-zinc-500 hover:bg-zinc-100 transition-all">X</button></>)}
          </div>
        </div>
      )}

      {/* ─── STATS DASHBOARD ─── */}
      {activeTab==="STATS"&&<StatsView/>}

      {/* ─── PLAYER GRID ─── */}
      <div className="max-w-[1400px] mx-auto px-6 py-10 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6 justify-items-center">
        {filtered.length===0&&(
          <div className="col-span-6 flex flex-col items-center justify-center py-24 gap-6 text-zinc-300"><User size={64}/><p className="text-[11px] font-black uppercase tracking-[0.4em]">{tr.empty.noRecords}</p></div>
        )}
        {filtered.map((m,i)=>{
          const cs=getCardStatus(m);const sel=selectedIds.has(m.id)
          return(
            <div key={m.id} onClick={()=>setSelMember(m)} className={`group cursor-pointer relative animate-[fadeUp_0.5s_ease-out_both] ${sel?'ring-2 ring-[#E30613] rounded-xl':''}`} style={{animationDelay:`${i*60}ms`}}>
              {cs&&(
                <div className={`absolute z-10 px-2 py-0.5 rounded-full text-[6px] font-black uppercase tracking-wider translate-x-3 translate-y-3 ${cs==="suspended"?'bg-red-600 text-white':'bg-yellow-400 text-yellow-900'}`}>
                  {cs==="suspended"?"BANNED":"WARN"}
                </div>
              )}
              {m.dualNationality&&(
                <div title={`Dual nationality${m.secondNationality?': '+m.secondNationality:''}`} className="absolute z-10 top-2 right-2 w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center shadow">
                  <Globe size={10} className="text-white"/>
                </div>
              )}
              {p.deletePlayer&&<div onClick={e=>{e.stopPropagation();setSelectedIds(p=>{const n=new Set(p);if(n.has(m.id))n.delete(m.id);else n.add(m.id);return n})}} className={`absolute z-10 top-2 left-2 w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${sel?'bg-[#E30613] border-[#E30613]':'bg-white/80 border-zinc-400 hover:border-[#E30613]'}`}>{sel&&<Check size={12} className="text-white"/>}</div>}
              {p.useScout&&<button onClick={e=>{e.stopPropagation();handleCardScout(m)}} className="absolute z-10 translate-x-3 translate-y-12 w-7 h-7 rounded-lg bg-zinc-100 hover:bg-[#E30613]/10 border border-zinc-200 hover:border-[#E30613]/30 flex items-center justify-center transition-all opacity-0 group-hover:opacity-100">
                <Sparkles size={12} className="text-zinc-400 group-hover:text-[#E30613] transition-colors"/>
              </button>}
              <PlayerCard
                name={m.name}
                club={m.role==="PLAYERS"?m.club||"TUNISIA":m.nationality||"TUNISIA"}
                position={m.position||"PLAYER"}
                age={calculateAge(m.birthdate)}
                caps={m.role==="PLAYERS"?Number(m.natMatches)||0:undefined}
                goals={m.role==="PLAYERS"?Number(m.goals)||0:undefined}
                imageSrc={getImageSrc(m)}
                fullPosition={m.role!=="PLAYERS"}
              />
            </div>
          )
        })}
      </div>

      {/* ═══════════════════════════════════════════
          PROFILE MODAL
      ═══════════════════════════════════════════ */}
      {selMember&&(()=>{
        const cs=getCardStatus(selMember)
        const isPlayer=selMember.role==="PLAYERS"
        const yc=selMember.yellowCards||0
        const rc=selMember.redCards||0
        const ringPct=Math.min(yc/YELLOW_SUSPENSION,1)
        const ringCircum=2*Math.PI*50
        const ringOffset=ringCircum*(1-ringPct)
        const ringColor=yc===0?"#639922":"#BA7517"
        return(
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/60 overflow-y-auto" onClick={()=>setSelMember(null)}>
            <div className="relative w-full max-w-lg bg-white rounded-lg shadow-xl overflow-hidden" onClick={e=>e.stopPropagation()}>

              {/* PL-style header */}
              <div className="relative h-36 bg-[#E30613] overflow-hidden">
                {/* Logo - left, radiant fade */}
                <div className="absolute left-0 top-0 h-full w-36 z-10" style={{maskImage:'linear-gradient(to right, black 30%, transparent 100%)',WebkitMaskImage:'linear-gradient(to right, black 30%, transparent 100%)'}}>
                  <div className="w-full h-full flex items-center justify-center">
                    <img src="/ftf-logo.png" className="w-20 h-20 object-contain drop-shadow" alt="FTF"/>
                  </div>
                </div>
                {/* Player image - right */}
                <div className="absolute right-0 top-0 h-full w-44">
                  {getImageSrc(selMember)!=="/placeholder.jpg"?<div className="w-full h-full" style={{maskImage:'linear-gradient(to left, black 40%, transparent 100%)',WebkitMaskImage:'linear-gradient(to left, black 40%, transparent 100%)'}}><img src={getImageSrc(selMember)} onError={e=>{(e.target as HTMLImageElement).src='/placeholder.jpg'}} className="w-full h-full object-cover object-top" alt=""/></div>:null}
                </div>
                {/* Name - center */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <h2 className="text-white font-black text-2xl text-center drop-shadow-lg px-16">{titleCase(selMember.name)}</h2>
                </div>
                {/* Position */}
                <div className="absolute bottom-3 left-0 right-0 text-center z-10">
                  <span className="text-[13px] font-bold text-white bg-black/20 px-2.5 py-1 rounded-sm uppercase backdrop-blur-sm">{selMember.position||"STAFF"}</span>
                </div>
                {/* Actions */}
                <div className="absolute top-2 right-2 z-10 flex gap-0.5">
                  {p.editPlayer&&<button onClick={()=>{setEditingId(selMember.id);setForm({...selMember});setSelMember(null);setIsFormOpen(true)}} className="w-6 h-6 rounded bg-white/20 hover:bg-white/30 flex items-center justify-center transition-all"><Edit3 size={10} className="text-white"/></button>}
                  {p.deletePlayer&&<button onClick={async()=>{if(await askConfirm(tr.profile.delete+"?")){{setMembers(members.filter(m=>m.id!==selMember.id));setSelMember(null)}}}} className="w-6 h-6 rounded bg-white/20 hover:bg-white/30 flex items-center justify-center transition-all"><Trash2 size={10} className="text-red-200"/></button>}
                  <button onClick={()=>setSelMember(null)} title="Close" className="w-6 h-6 rounded bg-white/20 hover:bg-white/30 flex items-center justify-center transition-all"><X size={10} className="text-white"/></button>
                </div>
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-black/20"/>
              </div>

              {/* Team + category bar */}
              <div className="flex items-center justify-between px-5 py-2.5 border-b border-zinc-100 bg-zinc-50">
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                  <span className="text-[13px] font-semibold text-zinc-500 uppercase">{catLabel(selMember.teamCategory)}</span>
                  <span className="text-zinc-300">|</span>
                  <span className="text-[13px] font-bold text-zinc-700">{selMember.club||"—"}</span>
                </div>
              </div>

              {/* Stat row */}
              <div className={`grid ${isPlayer?'grid-cols-4':'grid-cols-1'} border-b border-zinc-100`}>
                <div className={`py-3 text-center ${isPlayer?'border-r border-zinc-100':''}`}>
                  <p className="text-xl font-bold text-zinc-900">{calculateAge(selMember.birthdate)}</p>
                  <p className="text-[12px] text-zinc-400 uppercase font-medium">{tr.profile.age}</p>
                </div>
                {isPlayer&&<div className="py-3 text-center border-r border-zinc-100">
                  <p className="text-xl font-bold text-zinc-900 uppercase">{selMember.natMatches||"—"}</p>
                  <p className="text-[12px] text-zinc-400 uppercase font-medium">{tr.profile.caps}</p>
                </div>}
                {isPlayer&&<div className="py-3 text-center border-r border-zinc-100">
                  <p className="text-xl font-bold text-zinc-900 uppercase">{selMember.height||"—"}</p>
                  <p className="text-[12px] text-zinc-400 uppercase font-medium">Height</p>
                </div>}
                {isPlayer&&<div className="py-3 text-center">
                  <p className="text-xl font-bold text-zinc-900 uppercase">{selMember.foot||"R"}</p>
                  <p className="text-[12px] text-zinc-400 uppercase font-medium">Foot</p>
                </div>}
              </div>

              {/* Body */}
              <div className="px-5 py-4 space-y-4 max-h-[55vh] overflow-y-auto">

                {isPlayer?(
                  (p.viewMedical||canManageUsers)&&(
                    <div className="flex gap-1.5 -mt-1 mb-1">
                      <button onClick={()=>setProfileTab("profile")} className={`flex-1 py-1.5 rounded-full text-[12px] font-black uppercase tracking-wider transition-all ${profileTab==="profile"?'bg-[#E30613] text-white':'bg-zinc-100 text-zinc-500'}`}>Profile</button>
                      <button onClick={()=>setProfileTab("medical")} className={`flex-1 py-1.5 rounded-full text-[12px] font-black uppercase tracking-wider transition-all ${profileTab==="medical"?'bg-[#E30613] text-white':'bg-zinc-100 text-zinc-500'}`}>Medical</button>
                    </div>
                  )
                ):(
                  <div className="flex gap-1.5 -mt-1 mb-1">
                    <button onClick={()=>setProfileTab("profile")} className={`flex-1 py-1.5 rounded-full text-[12px] font-black uppercase tracking-wider transition-all ${profileTab==="profile"?'bg-[#E30613] text-white':'bg-zinc-100 text-zinc-500'}`}>Profile</button>
                    <button onClick={()=>setProfileTab("medical")} className={`flex-1 py-1.5 rounded-full text-[12px] font-black uppercase tracking-wider transition-all ${profileTab==="medical"?'bg-[#E30613] text-white':'bg-zinc-100 text-zinc-500'}`}>Info</button>
                  </div>
                )}

                {profileTab==="profile"&&(<>
                {/* Status banner */}
                {cs&&isPlayer&&(
                  <div className={`flex items-center gap-1.5 px-3 py-2 rounded text-[12px] font-semibold ${cs==="suspended"?'bg-red-50 text-red-600':'bg-yellow-50 text-yellow-700'}`}>
                    {cs==="suspended"?<Ban size={14}/>:<AlertTriangle size={14}/>}
                    {cs==="suspended"?tr.profile.suspended:tr.profile.oneMoreSuspended}
                  </div>
                )}

                {/* Stats: goals/assists tiles + centered card-accumulation ring */}
                {isPlayer&&(
                  <>
                  <div className="grid grid-cols-3 gap-px bg-zinc-200 rounded-xl overflow-hidden">
                    <div className="bg-white py-3.5 text-center">
                      <p className="font-mono text-xl font-bold text-zinc-900">{String(selMember.position==="GOALKEEPER"?(selMember.cleansheets??0):(selMember.goals||0)).padStart(2,'0')}</p>
                      <p className="text-[10px] text-zinc-400 uppercase tracking-wider">{selMember.position==="GOALKEEPER"?"Cleansheets":tr.profile.goals}</p>
                    </div>
                    <div className="bg-white py-3.5 text-center">
                      <p className="font-mono text-xl font-bold text-zinc-900">{String(selMember.assists||0).padStart(2,'0')}</p>
                      <p className="text-[10px] text-zinc-400 uppercase tracking-wider">Assists</p>
                    </div>
                    <div className="bg-white py-3.5 text-center">
                      <p className="font-mono text-xl font-bold text-zinc-900">{String(selMember.natMatches||0).padStart(2,'0')}</p>
                      <p className="text-[10px] text-zinc-400 uppercase tracking-wider">Matches</p>
                    </div>
                  </div>

                  <div className="bg-zinc-50 rounded-xl p-4 text-center">
                    <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider mb-3">{tr.profile.accumulation}</p>
                    <svg width="100" height="100" viewBox="0 0 120 120" className="mx-auto block">
                      <circle cx="60" cy="60" r="50" fill="none" stroke="#e4e4e7" strokeWidth="9"/>
                      {cs==="suspended"?(
                        <circle cx="60" cy="60" r="50" fill="#fee2e2" stroke="#E24B4A" strokeWidth="9"/>
                      ):(
                        <circle cx="60" cy="60" r="50" fill="none" stroke={ringColor} strokeWidth="9" strokeDasharray={ringCircum} strokeDashoffset={ringOffset} strokeLinecap="round" transform="rotate(-90 60 60)"/>
                      )}
                      {cs==="suspended"?(
                        <text x="60" y="66" textAnchor="middle" fontSize="22" fontWeight="700" fill="#791F1F">OUT</text>
                      ):(<>
                        <text x="60" y="58" textAnchor="middle" fontSize="30" fontWeight="700" fill="#18181b">{yc}</text>
                        <text x="60" y="78" textAnchor="middle" fontSize="12" fill="#a1a1aa">of {YELLOW_SUSPENSION}</text>
                      </>)}
                    </svg>
                    <p className={`mt-3 text-[13px] font-bold ${cs==="suspended"?'text-red-600':yc===0?'text-green-700':'text-amber-700'}`}>
                      {cs==="suspended"?tr.profile.suspended:yc===YELLOW_SUSPENSION-1?"One more yellow triggers a suspension":yc===0?"Clean disciplinary record":`${YELLOW_SUSPENSION-yc} more until suspension`}
                    </p>
                    <div className="mt-3 flex justify-center gap-6 border-t border-zinc-200 pt-2.5">
                      <div><p className="text-base font-bold text-zinc-800">{yc}</p><p className="text-[10px] text-zinc-400 uppercase tracking-wider">Yellow</p></div>
                      <div><p className="text-base font-bold text-red-600">{rc}</p><p className="text-[10px] text-zinc-400 uppercase tracking-wider">Red</p></div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3">
                    <div className="bg-zinc-50 rounded-lg border border-zinc-200/60 p-3.5 flex items-center justify-between">
                      <span className="text-[13px] font-medium text-zinc-600">{tr.profile.suspended}</span>
                      <span className={`text-sm font-bold ${selMember.suspended?'text-red-500':'text-zinc-500'}`}>{selMember.suspended?tr.profile.yes:tr.profile.no}</span>
                    </div>
                  </div>
                  </>
                )}

                {/* Staff info — Profile tab: core bio only */}
                {!isPlayer&&(()=>{
                  const validYears=(selMember.history||[]).map((h:any)=>parseInt(h?.year)).filter((y:number)=>!isNaN(y)&&y>1900)
                  const sinceYear=validYears.length>0?Math.min(...validYears):null
                  return(
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-zinc-50 rounded border border-zinc-200/60 p-3 flex items-center gap-3">
                        <Award size={16} className="text-[#E30613] shrink-0"/>
                        <div><p className="text-sm font-bold text-zinc-800 uppercase">{selMember.position||'COACH'}</p><span className="text-[12px] text-zinc-400 uppercase font-medium">{tr.profile.responsibility}</span></div>
                      </div>
                      <div className="bg-gradient-to-br from-amber-50 to-amber-100 rounded border border-amber-200 p-3 flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-amber-400 flex items-center justify-center shrink-0 shadow"><ShieldCheck size={14} className="text-white"/></div>
                        <div><p className="text-sm font-bold text-amber-900 uppercase">{selMember.natMatches||'N/A'}</p><span className="text-[12px] text-amber-600 uppercase font-medium">{tr.profile.license}</span></div>
                      </div>
                    </div>

                    {sinceYear&&(
                      <div className="flex justify-center">
                        <span className="text-[10px] font-black uppercase tracking-wider px-3 py-1.5 rounded-full bg-zinc-100 text-zinc-500">With the federation since {sinceYear}</span>
                      </div>
                    )}

                    <div className="grid grid-cols-3 gap-3">
                      {selMember.nationality&&<div className="bg-zinc-50 rounded border border-zinc-200/60 p-3 flex items-center gap-3">
                        <Globe size={14} className="text-[#E30613] shrink-0"/>
                        <div><p className="text-sm font-bold text-zinc-800 uppercase">{selMember.nationality}</p><span className="text-[12px] text-zinc-400 uppercase font-medium">{tr.profile.nationality}</span></div>
                      </div>}
                      {selMember.languages&&<div className="bg-zinc-50 rounded border border-zinc-200/60 p-3 flex items-center gap-3">
                        <BookOpen size={14} className="text-[#E30613] shrink-0"/>
                        <div><p className="text-sm font-bold text-zinc-800 uppercase">{selMember.languages}</p><span className="text-[12px] text-zinc-400 uppercase font-medium">{tr.profile.languages}</span></div>
                      </div>}
                      {selMember.contract&&<div className="bg-zinc-50 rounded border border-zinc-200/60 p-3 flex items-center gap-3">
                        <Calendar size={14} className="text-[#E30613] shrink-0"/>
                        <div><p className="text-sm font-bold text-zinc-800 uppercase">{selMember.contract}</p><span className="text-[12px] text-zinc-400 uppercase font-medium">{tr.profile.contract}</span></div>
                      </div>}
                    </div>
                  </div>
                )})()}

              {/* AI Update */}
              <button type="button" onClick={handleAIUpdate} className="w-full py-2.5 rounded-xl border border-purple-200 bg-purple-50 text-purple-600 hover:bg-purple-100 text-[12px] font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all hover:scale-[1.02]">
                🤖 AI Update Career
              </button>
              {/* History */}
                <div>
                  <h4 className="text-[12px] font-bold text-[#E30613] uppercase tracking-wider mb-2">{tr.profile.careerHistory}</h4>
                  <div className="border border-zinc-200/60 rounded overflow-hidden">
                    {selMember.history?.filter((h:any)=>h&&h.year&&!h.year.startsWith("0000")).length>0?(
                      <div className="divide-y divide-zinc-100">
                        {selMember.history.filter((h:any)=>h&&h.year&&!h.year.startsWith("0000")).map((h:any,i:number)=>(
                          <div key={i} className="flex items-center gap-2.5 px-3 py-2.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#E30613] shrink-0"/>
                            <span className="text-[12px] font-semibold text-[#E30613] w-12 shrink-0">{h.year}</span>
                            <span className="text-[12px] text-zinc-500">{h.event}</span>
                          </div>
                        ))}
                      </div>
                    ):<p className="text-[12px] text-zinc-400 py-4 text-center">No career history</p>}
                  </div>
                </div>

              </>)}

              {profileTab==="medical"&&(isPlayer?(
                <div className="space-y-2.5">
                  {p.editMedical&&(
                    <button onClick={()=>setAddInjuryOpen(true)} className="w-full py-2 rounded-lg border border-dashed border-[#E30613]/30 text-[12px] font-black uppercase tracking-wider text-[#E30613] hover:bg-[#E30613]/5 transition-all flex items-center justify-center gap-1.5">
                      <Plus size={11}/>Log Injury
                    </button>
                  )}
                  {injuries.length===0&&<p className="text-[12px] text-zinc-400 py-6 text-center">No medical history on record</p>}
                  {injuries.map((inj:any)=>{
                    const colors=inj.status==="active"?{bg:"bg-red-50",border:"border-red-200",text:"text-red-600",pill:"bg-red-500 text-white"}
                      :inj.status==="recovering"?{bg:"bg-amber-50",border:"border-amber-200",text:"text-amber-700",pill:"bg-amber-500 text-white"}
                      :{bg:"bg-zinc-50",border:"border-zinc-200",text:"text-zinc-500",pill:"bg-green-100 text-green-700"}
                    return(
                      <div key={inj.id} className={`rounded-lg border ${colors.border} ${colors.bg} p-3 ${inj.status==="recovered"?'opacity-70':''}`}>
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className={`text-[14px] font-bold ${colors.text}`}>{inj.injury_type}</p>
                            <p className="text-[12px] text-zinc-500 mt-0.5">{inj.body_part?`${inj.body_part} · `:""}{inj.occurred_on?`occurred ${fmtDateWords(inj.occurred_on)}`:""}</p>
                          </div>
                          <span className={`shrink-0 text-[12px] font-black uppercase px-2 py-1 rounded ${colors.pill}`}>{inj.status}</span>
                        </div>
                        {inj.expected_return&&<p className="text-[12px] text-zinc-400 mt-1.5">Expected return: {fmtDateWords(inj.expected_return)}</p>}
                        {inj.notes&&<p className="text-[12px] text-zinc-500 mt-1.5">{inj.notes}</p>}
                        <p className="text-[11px] text-zinc-400 mt-1.5">Logged by {inj.logged_by_username||"unknown"}</p>
                        {p.editMedical&&inj.status!=="recovered"&&(
                          <div className="flex gap-1.5 mt-2">
                            {inj.status==="active"&&<button onClick={()=>{updateInjuryStatus(inj.id,"recovering").then(()=>fetchInjuries(selMember.id).then(setInjuries))}} className="px-2.5 py-1 rounded-lg border border-amber-300 text-amber-600 text-[11px] font-black uppercase tracking-wider hover:bg-amber-50">Mark Recovering</button>}
                            <button onClick={()=>{updateInjuryStatus(inj.id,"recovered").then(()=>fetchInjuries(selMember.id).then(setInjuries))}} className="px-2.5 py-1 rounded-lg border border-green-300 text-green-600 text-[11px] font-black uppercase tracking-wider hover:bg-green-50">Mark Recovered</button>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              ):(()=>{
                const catMatchesPlayed=matches.filter((m:any)=>m.teamCategory===selMember.teamCategory&&m.result)
                let wins=0,draws=0,losses=0
                let biggestWin:{opponent:string,result:string,diff:number}|null=null
                catMatchesPlayed.forEach((m:any)=>{
                  const parts=(m.result||"").split("-").map((x:string)=>parseInt(x))
                  if(parts.length===2&&!isNaN(parts[0])&&!isNaN(parts[1])){
                    if(parts[0]>parts[1]){
                      wins++
                      const diff=parts[0]-parts[1]
                      if(!biggestWin||diff>biggestWin.diff)biggestWin={opponent:m.opponent,result:m.result,diff}
                    }
                    else if(parts[0]<parts[1])losses++
                    else draws++
                  }
                })
                const posGroup=(pos:string)=>{
                  const P=(pos||"").toUpperCase()
                  if(P.includes("GOAL")||P==="GK")return null
                  if(P.includes("DEF"))return "DEF"
                  if(P.includes("MID"))return "MID"
                  return "FWD"
                }
                const formationCounts:Record<string,number>={}
                catMatchesPlayed.forEach((m:any)=>{
                  const xi=(m.squad||[]).slice(0,11).map((pid:number)=>members.find((mm:any)=>mm.id===pid)).filter(Boolean)
                  if(xi.length<11)return
                  let def=0,mid=0,fwd=0
                  xi.forEach((pl:any)=>{const g=posGroup(pl.position);if(g==="DEF")def++;else if(g==="MID")mid++;else if(g==="FWD")fwd++})
                  if(def+mid+fwd===0)return
                  const shape=`${def}-${mid}-${fwd}`
                  formationCounts[shape]=(formationCounts[shape]||0)+1
                })
                const signatureFormation=Object.entries(formationCounts).sort((a,b)=>b[1]-a[1])[0]?.[0]
                const milestones:string[]=[]
                if(catMatchesPlayed.length>=50)milestones.push("50+ Matches")
                else if(catMatchesPlayed.length>=20)milestones.push("20+ Matches")
                if(wins>=10)milestones.push("10+ Wins")
                const sortedByDate=[...catMatchesPlayed].sort((a,b)=>(a.date||"").localeCompare(b.date||""))
                if(sortedByDate.length>=5&&sortedByDate.slice(0,5).every((m:any)=>{const parts=(m.result||"").split("-").map((x:string)=>parseInt(x));return !(parts[0]<parts[1])}))milestones.push("Unbeaten Start")
                return(
                <div className="space-y-3">
                  {selMember.bioQuote?(
                    <p className="text-[12px] italic text-zinc-500 text-center px-2 leading-snug">"{selMember.bioQuote}"</p>
                  ):(
                    <p className="text-[11px] text-zinc-300 text-center px-2 italic">No coaching philosophy added yet</p>
                  )}
                  <div className="grid grid-cols-3 gap-px bg-zinc-200 rounded-xl overflow-hidden">
                    <div className="bg-white py-3.5 text-center">
                      <p className="font-mono text-xl font-bold text-zinc-900">{String(catMatchesPlayed.length).padStart(2,'0')}</p>
                      <p className="text-[10px] text-zinc-400 uppercase tracking-wider">Overseen</p>
                    </div>
                    <div className="bg-white py-3.5 text-center">
                      <p className="text-xl font-bold"><span className="text-green-600">{wins}</span><span className="text-zinc-300 mx-0.5">-</span><span className="text-zinc-500">{draws}</span><span className="text-zinc-300 mx-0.5">-</span><span className="text-red-500">{losses}</span></p>
                      <p className="text-[10px] text-zinc-400 uppercase tracking-wider">W-D-L</p>
                    </div>
                    <div className="bg-white py-3.5 text-center">
                      <p className="text-xl font-bold text-zinc-900">{catMatchesPlayed.length>0?Math.round((wins/catMatchesPlayed.length)*100):0}%</p>
                      <p className="text-[10px] text-zinc-400 uppercase tracking-wider">Win Rate</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-gradient-to-br from-[#E30613] to-red-800 rounded-xl p-3 text-white">
                      <p className="text-[9px] font-black uppercase tracking-wider text-white/70">Biggest Win</p>
                      {biggestWin?(<>
                        <p className="text-lg font-black font-mono mt-0.5">{biggestWin.result}</p>
                        <p className="text-[10px] font-bold text-white/80 truncate">vs {biggestWin.opponent}</p>
                      </>):(
                        <p className="text-[10px] font-bold text-white/60 mt-1.5">No wins recorded yet</p>
                      )}
                    </div>
                    <div className="bg-zinc-900 rounded-xl p-3 text-white flex flex-col justify-center items-center text-center">
                      <p className="text-[9px] font-black uppercase tracking-wider text-white/50">Preferred Formation</p>
                      <p className="text-lg font-black font-mono mt-0.5">{signatureFormation||"—"}</p>
                    </div>
                  </div>

                  {milestones.length>0&&(
                    <div className="flex flex-wrap gap-1.5">
                      {milestones.map(ms=>(
                        <span key={ms} className="text-[9px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 flex items-center gap-1">🏅 {ms}</span>
                      ))}
                    </div>
                  )}
                </div>
                )
              })())}

              </div>
            </div>
          </div>
        )
      })()}

      {/* ═══════════════════════════════════════════
          LOG INJURY FORM
      ═══════════════════════════════════════════ */}
      {addInjuryOpen&&selMember&&(()=>{
        return(
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/80">
          <div className="w-full max-w-sm rounded-2xl bg-[#FAF8F3] text-zinc-900 shadow-2xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-black uppercase italic tracking-tighter">Log Injury — {selMember.name}</h2>
              <button onClick={()=>setAddInjuryOpen(false)} title="Close" className="p-1.5 rounded-lg hover:bg-zinc-100"><X size={18}/></button>
            </div>
            <input placeholder="Injury type (e.g. Hamstring strain)" value={injForm.injury_type} onChange={e=>setInjForm({...injForm,injury_type:e.target.value})} className="w-full p-2.5 bg-zinc-50 rounded-lg border border-zinc-200 text-[11px] font-bold outline-none"/>
            <input placeholder="Body part (e.g. Left leg)" value={injForm.body_part} onChange={e=>setInjForm({...injForm,body_part:e.target.value})} className="w-full p-2.5 bg-zinc-50 rounded-lg border border-zinc-200 text-[11px] font-bold outline-none"/>
            <div>
              <p className="text-[9px] font-black uppercase tracking-wider text-zinc-400 mb-1.5">Severity</p>
              <div className="flex gap-1.5">
                {["minor","moderate","severe"].map(sev=>(
                  <button key={sev} type="button" onClick={()=>setInjForm({...injForm,severity:sev})} className={`flex-1 py-1.5 rounded-full text-[9px] font-black uppercase tracking-wider transition-all ${injForm.severity===sev?'bg-[#E30613] text-white':'bg-zinc-100 text-zinc-500 hover:bg-zinc-200/60'}`}>{sev}</button>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <div className="flex-1"><DatePicker value={injForm.occurred_on} onChange={(v)=>setInjForm({...injForm,occurred_on:v})} placeholder="Date occurred"/></div>
              <div className="flex-1"><DatePicker value={injForm.expected_return} onChange={(v)=>setInjForm({...injForm,expected_return:v})} placeholder="Expected return"/></div>
            </div>
            <textarea placeholder="Notes (optional)" value={injForm.notes} onChange={e=>setInjForm({...injForm,notes:e.target.value})} rows={2} className="w-full p-2.5 bg-zinc-50 rounded-lg border border-zinc-200 text-[11px] font-bold outline-none resize-none"/>
            <div className="flex gap-2 pt-1">
              <button onClick={()=>setAddInjuryOpen(false)} className="flex-1 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-wider border border-zinc-300 bg-zinc-100">Cancel</button>
              <button onClick={async()=>{
                if(!injForm.injury_type.trim()){alert("Enter an injury type");return}
                const {error}=await addInjury(selMember.id,injForm)
                if(error){alert("Failed: "+error);return}
                setAddInjuryOpen(false)
                setInjForm({injury_type:"",body_part:"",severity:"moderate",occurred_on:"",expected_return:"",notes:""})
                fetchInjuries(selMember.id).then(setInjuries)
              }} className="flex-[2] py-2.5 bg-[#E30613] text-white rounded-xl text-[9px] font-black uppercase tracking-wider shadow-lg hover:scale-[1.02] transition-all">Save</button>
            </div>
          </div>
        </div>
      )})()}

      {/* ═══════════════════════════════════════════
          ADD / EDIT MEMBER MODAL
      ═══════════════════════════════════════════ */}
      {isFormOpen&&(
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-2 sm:p-4 bg-black/80 overflow-y-auto">
          <div className="w-full max-w-lg p-4 sm:p-5 rounded-[2rem] border border-zinc-200 bg-[#FAF8F3] text-zinc-900 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <div><h2 className="text-xl font-black italic uppercase tracking-tighter">{editingId?tr.form.update:tr.form.newEntry}</h2><p className="text-[8px] font-black text-[#E30613] uppercase tracking-[0.3em] mt-0.5">{catLabel(teamCat)} · {activeTab}</p></div>
              <button onClick={()=>setIsFormOpen(false)} title="Close" className="p-1.5 hover:bg-red-500/10 rounded-xl"><X size={20}/></button>
            </div>
            <form onSubmit={saveForm} className="space-y-3">
              <div className="relative">
                <div onClick={()=>fileRef.current?.click()} className="flex flex-col items-center gap-2 py-4 rounded-[1.5rem] border-2 border-dashed border-zinc-300 hover:border-[#E30613] cursor-pointer bg-zinc-50 transition-all">
                  <input type="file" ref={fileRef} onChange={async e=>{const f=e.target.files?.[0];if(f){try{const blob=await compressImage(f);const fd=new FormData();fd.append('file',blob,f.name.replace(/\.[^.]+$/,'')+'.jpg');const r=await fetch('/api/upload',{method:'POST',body:fd});const d=await r.json();if(d.url){setForm({...form,image:d.url,imagePath:d.path});return}}catch(err){}const r2=new FileReader();r2.onloadend=()=>setForm({...form,image:r2.result as string});r2.readAsDataURL(f)}}} className="hidden" accept="image/*"/>
                  {form.image?<img src={form.imagePath?`https://vtjdmuzeohtqxwknfmhw.supabase.co/storage/v1/object/public/members/${form.imagePath}`:form.image} onError={e=>{const t=e.target as HTMLImageElement;if(t.src!==t.getAttribute('data-fallback')){t.setAttribute('data-fallback','/placeholder.jpg');t.src='/placeholder.jpg'}}} className="w-14 h-14 rounded-2xl object-cover" alt=""/>:<Camera size={22} className="text-zinc-700"/>}
                  <span className="text-[8px] font-black uppercase tracking-[0.3em] text-zinc-500">{tr.form.portraitUpload}</span>
                </div>
                {form.image&&<button type="button" onClick={e=>{e.stopPropagation();setForm({...form,image:""})}} className="absolute -top-1 -right-1 p-1.5 bg-red-600 text-white rounded-full"><Trash2 size={11}/></button>}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2"><input placeholder={tr.form.fullName} value={form.name} onChange={e=>setForm({...form,name:e.target.value})} className="w-full p-3 rounded-xl border border-zinc-200 bg-zinc-50 text-[10px] font-bold uppercase outline-none" required/></div>
                <input placeholder={tr.form.clubTeam} value={form.club} onChange={e=>setForm({...form,club:e.target.value})} className="w-full p-3 rounded-xl border border-zinc-200 bg-zinc-50 text-[10px] font-bold uppercase outline-none"/>
                <input placeholder={tr.form.date} value={form.birthdate} onChange={e=>setForm({...form,birthdate:e.target.value})} className="w-full p-3 rounded-xl border border-zinc-200 bg-zinc-50 text-[10px] font-bold uppercase outline-none"/>
              </div>
              {activeTab==="PLAYERS"?(
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <select value={form.position} onChange={e=>setForm({...form,position:e.target.value})} className="w-full p-3 rounded-xl border border-zinc-200 bg-zinc-50 text-[10px] font-bold uppercase outline-none" required>
                      <option value="">{tr.form.position}</option>{PLAYER_POSITIONS.filter(p=>p!=="ALL").map(p=><option key={p} value={p}>{p}</option>)}
                    </select>
                    <input placeholder={tr.form.heightCm} value={form.height} onChange={e=>setForm({...form,height:e.target.value})} className="w-full p-3 rounded-xl border border-zinc-200 bg-zinc-50 text-[10px] font-bold uppercase outline-none"/>
                    <input placeholder={tr.form.caps} value={form.natMatches} onChange={e=>setForm({...form,natMatches:e.target.value})} className="w-full p-3 rounded-xl border border-zinc-200 bg-zinc-50 text-[10px] font-bold uppercase outline-none"/>
                    <div className="grid grid-cols-2 gap-2">
                      <input placeholder={tr.form.goals} value={form.goals} onChange={e=>setForm({...form,goals:e.target.value})} className="w-full p-3 rounded-xl border border-zinc-200 bg-zinc-50 text-[10px] font-bold uppercase outline-none"/>
                      <input placeholder={tr.form.assists} value={form.assists} onChange={e=>setForm({...form,assists:e.target.value})} className="w-full p-3 rounded-xl border border-zinc-200 bg-zinc-50 text-[10px] font-bold uppercase outline-none"/>
                    </div>
                  </div>
                  <div className="p-4 rounded-[1.5rem] border border-yellow-200 bg-yellow-50 space-y-3">
                    <p className="text-[8px] font-black text-yellow-500 uppercase tracking-[0.3em] flex items-center gap-2"><AlertTriangle size={9}/> {tr.form.discipline}</p>
                    <div className="grid grid-cols-3 gap-2">
                      <div><label className="text-[7px] font-black uppercase text-zinc-500 mb-1 block">{tr.form.yellowCards}</label><input type="number" min="0" max="10" value={form.yellowCards} onChange={e=>setForm({...form,yellowCards:e.target.value})} className="w-full p-2.5 rounded-lg border border-zinc-200 bg-white text-[10px] font-bold outline-none"/></div>
                      <div><label className="text-[7px] font-black uppercase text-zinc-500 mb-1 block">{tr.form.redCards}</label><input type="number" min="0" max="5" value={form.redCards} onChange={e=>setForm({...form,redCards:e.target.value})} className="w-full p-2.5 rounded-lg border border-zinc-200 bg-white text-[10px] font-bold outline-none"/></div>
                      <div><label className="text-[7px] font-black uppercase text-zinc-500 mb-1 block">{tr.form.suspended}</label><button type="button" onClick={()=>setForm({...form,suspended:!form.suspended})} className={`w-full p-2.5 rounded-lg border text-[9px] font-black uppercase transition-all ${form.suspended?'bg-red-600 border-red-600 text-white':'bg-white border-zinc-200 text-zinc-400'}`}>{form.suspended?tr.profile.yes:tr.profile.no}</button></div>
                    </div>
                  </div>
                  <div className="p-4 rounded-[1.5rem] border border-blue-200 bg-blue-50 space-y-3">
                    <p className="text-[8px] font-black text-blue-500 uppercase tracking-[0.3em] flex items-center gap-2"><Globe size={9}/> Scout Tags</p>
                    <div>
                      <label className="text-[7px] font-black uppercase text-zinc-500 mb-1.5 block">League / Region</label>
                      <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                        {LEAGUES_BY_REGION.map(group=>(
                          <div key={group.region}>
                            <p className="text-[6px] font-black uppercase text-zinc-400 mb-1">{group.region}</p>
                            <div className="flex flex-wrap gap-1.5">
                              {group.options.map(opt=>(
                                <button key={opt} type="button" onClick={()=>setForm({...form,leagueRegion:form.leagueRegion===opt?"":opt})}
                                  className={`px-2.5 py-1.5 rounded-full text-[8px] font-black uppercase tracking-wider transition-all ${form.leagueRegion===opt?'bg-blue-600 text-white':'bg-white border border-zinc-200 text-zinc-500 hover:border-blue-300'}`}>
                                  {opt}
                                </button>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={()=>setForm({...form,dualNationality:!form.dualNationality})}
                        className={`px-3 py-2 rounded-lg text-[8px] font-black uppercase tracking-wider transition-all shrink-0 ${form.dualNationality?'bg-blue-600 text-white':'bg-white border border-zinc-200 text-zinc-500'}`}>
                        {form.dualNationality?"✓ Dual Nationality":"Dual Nationality"}
                      </button>
                      {form.dualNationality&&(
                        <input placeholder="Second nationality (e.g. France)" value={form.secondNationality||""} onChange={e=>setForm({...form,secondNationality:e.target.value})} className="flex-1 p-2 rounded-lg border border-zinc-200 bg-white text-[9px] font-bold outline-none"/>
                      )}
                    </div>
                  </div>
                </>
              ):(
                <div className="grid grid-cols-2 gap-2">
                  <select value={form.position} onChange={e=>setForm({...form,position:e.target.value})} className="col-span-2 w-full p-2.5 rounded-xl border border-zinc-200 bg-zinc-50 text-[9px] font-bold uppercase outline-none" required>
                    <option value="">{tr.form.coachingRole}</option>{COACH_POSITIONS.map(p=><option key={p} value={p}>{p}</option>)}
                  </select>
                  <select value={form.natMatches} onChange={e=>setForm({...form,natMatches:e.target.value})} className="w-full p-2.5 rounded-xl border border-zinc-200 bg-zinc-50 text-[9px] font-bold uppercase outline-none">
                    <option value="">{tr.form.license}</option>{CAF_LICENSES.map(l=><option key={l} value={l}>{l}</option>)}
                  </select>
                  <input placeholder={tr.form.nationality} value={form.nationality} onChange={e=>setForm({...form,nationality:e.target.value})} className="w-full p-2.5 rounded-xl border border-zinc-200 bg-zinc-50 text-[9px] font-bold uppercase outline-none"/>
                  <div className="col-span-2">
                    <div className="flex flex-wrap gap-1">
                      {LANGUAGES.map(l=>{
                        const sel=(form.languages||"").split(",").map((s:string)=>s.trim()).includes(l)
                        return(
                          <button key={l} type="button" onClick={()=>{
                            const current=(form.languages||"").split(",").map((s:string)=>s.trim()).filter(Boolean)
                            const next=sel?current.filter((s:string)=>s!==l):[...current,l]
                            setForm({...form,languages:next.join(", ")})
                          }} className={`px-2 py-1 rounded text-[7px] font-black uppercase tracking-wider transition-all ${sel?'bg-[#E30613] text-white':'bg-zinc-50 border border-zinc-200 text-zinc-400 hover:border-[#E30613]/30'}`}>{l}</button>
                        )
                      })}
                    </div>
                  </div>
                  <div className="col-span-2">
                    <textarea placeholder="Coaching philosophy (optional, one line)" value={form.bioQuote||""} onChange={e=>setForm({...form,bioQuote:e.target.value})} rows={2} maxLength={140} className="w-full p-2.5 rounded-xl border border-zinc-200 bg-zinc-50 text-[10px] font-medium italic outline-none resize-none"/>
                  </div>
                  <input placeholder={tr.form.contract} value={form.contract} onChange={e=>setForm({...form,contract:e.target.value})} className="w-full p-2.5 rounded-xl border border-zinc-200 bg-zinc-50 text-[9px] font-bold uppercase outline-none"/>
                </div>
              )}
              {/* History */}
              <div className="p-3 rounded-xl border border-zinc-200 bg-zinc-50 space-y-2">
                <p className="text-[7px] font-black text-[#E30613] uppercase tracking-[0.3em] flex items-center gap-2"><Briefcase size={8}/> {tr.form.history}</p>
                <div className="max-h-[80px] overflow-y-auto space-y-1.5">
                  {form.history?.map((h:any,i:number)=>(
                    <div key={i} className="flex gap-1.5">
                      <input placeholder={tr.form.year} value={h.year} onChange={e=>{const nh=[...form.history];nh[i].year=e.target.value;setForm({...form,history:nh})}} className="w-16 p-1.5 bg-white rounded-lg border border-zinc-200 text-[8px] font-bold outline-none"/>
                      <input placeholder={tr.form.event} value={h.event} onChange={e=>{const nh=[...form.history];nh[i].event=e.target.value;setForm({...form,history:nh})}} className="flex-1 p-1.5 bg-white rounded-lg border border-zinc-200 text-[8px] font-bold outline-none"/>
                      <button type="button" onClick={()=>setForm({...form,history:form.history.filter((_:any,idx:number)=>idx!==i)})} className="p-1 text-zinc-500 hover:text-red-500"><X size={10}/></button>
                    </div>
                  ))}
                </div>
                <button type="button" onClick={()=>setForm({...form,history:[...(form.history||[]),{year:"",event:""}]})} className="w-full py-1.5 border border-dashed border-[#E30613]/20 rounded-lg text-[7px] font-black text-[#E30613] hover:bg-[#E30613]/5 uppercase tracking-widest">{tr.form.addEntry}</button>
              </div>
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={()=>setIsFormOpen(false)} className="flex-1 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-[0.2em] border border-zinc-300 bg-zinc-100">{tr.form.cancel}</button>
                <button className="flex-[2] py-2.5 bg-[#E30613] text-white rounded-xl text-[9px] font-black uppercase tracking-[0.2em] shadow-lg shadow-red-600/20 hover:scale-[1.02] transition-all">{tr.form.saveRecord}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════
          PENDING USERS REVIEW
      ═══════════════════════════════════════════ */}
      {pendingReviewOpen&&(
        <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-black/80">
          <div className="w-full max-w-2xl rounded-2xl border border-zinc-200 bg-[#FAF8F3] text-zinc-900 shadow-2xl flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-6 py-5 border-b border-zinc-200 shrink-0">
              <div>
                <h2 className="text-2xl font-black uppercase italic tracking-tight">Pending Users</h2>
                <p className="text-[8px] font-black text-[#E30613] uppercase tracking-[0.3em] mt-0.5">{pendingCount} awaiting approval</p>
              </div>
              <button onClick={()=>setPendingReviewOpen(false)} title="Close" className="p-2 rounded-xl border border-zinc-200 hover:bg-red-500 hover:text-white transition-all"><X size={18}/></button>
            </div>
            <div className="p-6 space-y-5 overflow-y-auto">
              {pendingUsers.map((u)=>{
                const allUsers=fetchedUsers
                const realIdx=allUsers.findIndex(x=>x.username===u.username)
                const togglePerm=(perm:keyof UserPerms)=>{
                  updateProfile(u.username,{permissions:{...allUsers[realIdx].perms,[perm]:!allUsers[realIdx].perms[perm]}}).then(reloadProfiles)
                }
                const doApprove=()=>{
                  updateProfile(u.username,{status:"active"}).then(reloadProfiles)
                }
                const doHold=()=>{ setPendingReviewOpen(false) }
                const doDelete=()=>{
                  deleteProfile(u.username).then(reloadProfiles)
                }
                return(
                  <div key={u.username} className="rounded-xl border border-zinc-200 bg-zinc-50 overflow-hidden">
                    <div className="p-5 pb-4 border-b border-zinc-200">
                      <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-2xl bg-[#E30613]/10 border border-[#E30613]/20 flex items-center justify-center"><User size={22} className="text-[#E30613]"/></div>
                        <div>
                          <p className="text-lg font-black uppercase leading-tight">{u.firstName} {u.lastName}</p>
                          <p className="text-[9px] font-medium tracking-wide text-zinc-500">@{u.username}</p>
                          <p className="text-[8px] font-black uppercase tracking-wider text-amber-600">PENDING · Awaiting your review</p>
                        </div>
                      </div>
                    </div>
                    <div className="p-5 space-y-4">
                      <p className="text-[7px] font-black uppercase text-zinc-500 tracking-wider">Assign Permissions</p>
                      <div className="flex flex-wrap gap-2">
                        {PERM_LABELS.map(({key,label})=>{
                          const on=allUsers[realIdx]?.perms[key]
                          return(
                            <button key={key} onClick={()=>togglePerm(key)}
                              className={`px-3.5 py-2 rounded-xl text-[7px] font-black uppercase tracking-wider border transition-all ${on?'bg-[#E30613] border-[#E30613] text-white shadow-md shadow-[#E30613]/30':'bg-white border-zinc-200 text-zinc-500 hover:border-[#E30613]/30'}`}>
                              {on&&<Check size={10} className="inline mr-1"/>}{label}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                    <div className="flex gap-3 px-5 pb-5">
                      <button onClick={doApprove} className="flex-1 py-3 rounded-full bg-[#E30613] text-white text-[8px] font-black uppercase tracking-wider hover:bg-red-700 transition-all shadow-lg shadow-[#E30613]/30"><Check size={12} className="inline mr-1.5"/>Save & Approve</button>
                      <button onClick={doHold} className="flex-1 py-3 rounded-xl border border-zinc-300 bg-white text-zinc-500 text-[8px] font-black uppercase tracking-wider hover:bg-zinc-100 transition-all">Hold</button>
                      <button onClick={doDelete} className="py-3 px-4 rounded-xl border border-red-200 text-red-500 text-[8px] font-black uppercase tracking-wider hover:bg-red-50 transition-all"><Trash2 size={12}/></button>
                    </div>
                  </div>
                )
              })}
              {pendingCount===0&&(
                <div className="flex flex-col items-center justify-center py-16 gap-4 text-zinc-300">
                  <Bell size={48}/>
                  <p className="text-[11px] font-black uppercase tracking-[0.3em]">No pending users</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════
          PENDING MATCHES REVIEW
      ═══════════════════════════════════════════ */}
      {pendingMatchesOpen&&(
        <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-black/80">
          <div className="w-full max-w-2xl rounded-2xl border border-zinc-200 bg-[#FAF8F3] text-zinc-900 shadow-2xl flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-6 py-5 border-b border-zinc-200 shrink-0">
              <div>
                <h2 className="text-2xl font-black uppercase italic tracking-tight">Pending Matches</h2>
                <p className="text-[8px] font-black text-[#E30613] uppercase tracking-[0.3em] mt-0.5">{pendingMatches.length} awaiting approval</p>
              </div>
              <button onClick={()=>setPendingMatchesOpen(false)} title="Close" className="p-2 rounded-xl border border-zinc-200 hover:bg-red-500 hover:text-white transition-all"><X size={18}/></button>
            </div>
            <div className="p-6 space-y-4 overflow-y-auto">
              {pendingMatches.map(m=>(
                <div key={m.id} className="rounded-xl border border-zinc-200 bg-zinc-50 overflow-hidden">
                  <div className="p-5 pb-4 border-b border-zinc-200">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center"><BookOpen size={18} className="text-amber-600"/></div>
                        <div>
                          <p className="font-black uppercase text-sm leading-tight">{m.opponent}</p>
                          <p className="text-[8px] text-zinc-500 font-bold uppercase tracking-wider">{fmtDateWords(m.date)} · {m.competition||"Friendly"} · by @{m.submittedBy}</p>
                        </div>
                      </div>
                      <span className="text-[9px] font-black text-amber-600 bg-amber-100 px-2.5 py-1 rounded-lg uppercase">Pending</span>
                    </div>
                  </div>
                  <div className="p-5 space-y-2 text-[9px] font-bold text-zinc-600">
                    {m.venue&&<p>Venue: {m.venue}</p>}
                    {m.result&&<p>Result: {m.result}</p>}
                    <p>Squad: {m.squad?.length||0} players · Scorers: {m.scorers?.length||0}</p>
                  </div>
                  <div className="flex gap-3 px-5 pb-5">
                    <button onClick={()=>approveMatch(m)} className="flex-1 py-3 rounded-full bg-[#E30613] text-white text-[8px] font-black uppercase tracking-wider hover:bg-red-700 transition-all shadow-lg shadow-[#E30613]/30"><Check size={12} className="inline mr-1.5"/>Approve Match</button>
                    <button onClick={()=>{setMatches(p=>p.filter((x:any)=>x.id!==m.id));setPendingMatchesOpen(false)}} className="py-3 px-5 rounded-xl border border-red-200 text-red-500 text-[8px] font-black uppercase tracking-wider hover:bg-red-50 transition-all"><Trash2 size={12} className="inline mr-1"/>Reject</button>
                  </div>
                </div>
              ))}
              {pendingMatches.length===0&&(
                <div className="flex flex-col items-center justify-center py-16 gap-4 text-zinc-300">
                  <BookOpen size={48}/>
                  <p className="text-[11px] font-black uppercase tracking-[0.3em]">No pending matches</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════
          USER MANAGEMENT MODAL
      ═══════════════════════════════════════════ */}
      {usersOpen&&(()=>{const users=fetchedUsers;return(
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80">
          <div className="w-full max-w-lg rounded-2xl border border-zinc-200 bg-[#FAF8F3] text-zinc-900 shadow-2xl flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-200 shrink-0">
              <h2 className="text-lg font-black uppercase italic tracking-tight">User Management</h2>
              <div className="flex items-center gap-2">
                <button onClick={()=>{syncUsers()}} className="p-2 rounded-xl border border-zinc-200 hover:bg-zinc-100 transition-all" title="Refresh"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg></button>
                <button onClick={()=>setUsersOpen(false)} title="Close" className="p-2 rounded-xl border border-zinc-200 hover:bg-red-500 hover:text-white transition-all"><X size={16}/></button>
              </div>
            </div>
            <div className="p-5 space-y-3 overflow-y-auto">
              {users.map((u,i)=>{
                const currentUser=u.username===user?.username
                const togglePerm=(perm:keyof UserPerms)=>{
                  const newPerms={...u.perms,[perm]:!u.perms[perm]}
                  updateProfile(u.username,{permissions:newPerms}).then(reloadProfiles)
                  if(currentUser) setUser({...user!,perms:newPerms})
                }
                const approveUser=()=>{
                  updateProfile(u.username,{status:"active"}).then(reloadProfiles)
                }
                return(
                  <div key={i} className="p-3 rounded-xl border border-zinc-200 bg-zinc-50">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="text-[11px] font-black uppercase leading-tight">{u.username}{currentUser&&<span className="text-[#E30613] ml-2 text-[8px]">(you)</span>}</p>
                        <p className="text-[7px] font-black uppercase tracking-wider" style={{color:u.status==="active"?"#16a34a":"#E30613"}}>{u.status==="active"?"ACTIVE":"PENDING"}</p>
                      </div>
                      <div className="flex gap-1.5">
                        {u.status==="pending"&&canManageUsers&&<button onClick={approveUser} className="px-3 py-1.5 rounded-lg border border-green-300 text-green-600 text-[7px] font-black uppercase tracking-wider hover:bg-green-50 transition-all">Approve</button>}
                        {canManageUsers&&!currentUser&&(<>
                          <button onClick={async()=>{
                            const pw1=window.prompt(`New password for ${u.username} (min 6 chars):`)
                            if(!pw1)return
                            if(pw1.length<6){alert("Password must be at least 6 characters");return}
                            const {error}=await adminResetPassword(u.username,pw1)
                            if(error){alert("Failed: "+error)}else{alert("Password reset for "+u.username)}
                          }} className="px-3 py-1.5 rounded-lg border border-blue-200 text-blue-500 text-[7px] font-black uppercase tracking-wider hover:bg-blue-50 transition-all">Reset PW</button>
                          <button onClick={()=>{deleteProfile(u.username).then(reloadProfiles)}} className="px-3 py-1.5 rounded-lg border border-red-200 text-red-500 text-[7px] font-black uppercase tracking-wider hover:bg-red-50 transition-all">Remove</button>
                        </>)}
                      </div>
                    </div>
                    {canManageUsers&&(
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {PERM_LABELS.map(({key,label})=>{
                          const on=u.perms[key]
                          return(
                            <button key={key} onClick={()=>togglePerm(key)}
                              className={`px-2.5 py-1 rounded-lg text-[6px] font-black uppercase tracking-wider border transition-all ${on?'bg-[#E30613]/15 border-[#E30613]/40 text-[#E30613]':'bg-zinc-100 border-zinc-200 text-zinc-400 hover:bg-zinc-200'}`}>
                              {label}
                            </button>
                          )
                        })}
          </div>
        )}
      </div>
                )
              })}
            </div>
          </div>
        </div>
      )})()}

      {/* ═══════════════════════════════════════════
          ACTIVITY LOG — WHO CHANGED WHAT, WHEN
      ═══════════════════════════════════════════ */}
      {activityLogOpen&&(
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80">
          <div className="w-full max-w-lg rounded-2xl bg-[#FAF8F3] text-zinc-900 shadow-2xl flex flex-col max-h-[85vh]">
            <div className="px-6 pt-5 pb-4 border-b border-zinc-100 shrink-0 flex items-center justify-between">
              <h2 className="text-sm font-black uppercase italic tracking-tighter flex items-center gap-2"><Activity size={16}/>Activity Log</h2>
              <button onClick={()=>setActivityLogOpen(false)} title="Close" className="p-1.5 rounded-lg hover:bg-zinc-100 transition-all"><X size={18}/></button>
            </div>
            <div className="p-4 overflow-y-auto space-y-1.5">
              {activityLog.length===0&&<p className="text-[10px] text-zinc-400 text-center py-8">No activity yet</p>}
              {activityLog.map((a:any)=>{
                const actionColor=a.action==="insert"?"text-green-600":a.action==="delete"?"text-red-500":"text-blue-600"
                const actionVerb=a.action==="insert"?"added":a.action==="delete"?"deleted":"updated"
                const buildSentence=()=>{
                  if(a.entity_type==="injuries"){
                    const playerName=(a.entity_label||"").split(" — ")[0]
                    return <><span className="font-black">{a.actor_username||"unknown user"}</span> <span className={`font-bold ${actionColor}`}>{actionVerb}</span> <span className="font-bold text-zinc-800">{playerName}</span><span className="text-zinc-500">'s injury record</span></>
                  }
                  if(a.entity_type==="members"){
                    if(a.action==="insert")return <><span className="font-black">{a.actor_username||"unknown user"}</span> <span className="font-bold text-green-600">added a new player/staff</span>: <span className="font-bold text-zinc-800">{a.entity_label}</span></>
                    if(a.action==="delete")return <><span className="font-black">{a.actor_username||"unknown user"}</span> <span className="font-bold text-red-500">removed</span> <span className="font-bold text-zinc-800">{a.entity_label}</span></>
                    return <><span className="font-black">{a.actor_username||"unknown user"}</span> <span className="font-bold text-blue-600">updated</span> <span className="font-bold text-zinc-800">{a.entity_label}</span>'s profile</>
                  }
                  if(a.entity_type==="matches"){
                    return <><span className="font-black">{a.actor_username||"unknown user"}</span> <span className={`font-bold ${actionColor}`}>{actionVerb}</span> the match vs <span className="font-bold text-zinc-800">{a.entity_label}</span></>
                  }
                  return <><span className="font-black">{a.actor_username||"unknown user"}</span> <span className={`font-bold ${actionColor}`}>{actionVerb}</span> account <span className="font-bold text-zinc-800">{a.entity_label}</span></>
                }
                const hiddenFields=new Set(["id","image_url","image_path","history","details"])
                const changeEntries=a.changes?Object.entries(a.changes).filter(([k]:any)=>!hiddenFields.has(k)):[]
                const fieldLabel=(k:string)=>k.replace(/_/g," ").replace(/\b\w/g,(c:string)=>c.toUpperCase())
                const fmtVal=(v:any)=>{
                  if(v===null||v===undefined)return "—"
                  if(typeof v==="object")return JSON.stringify(v)
                  return String(v)
                }
                const dt=new Date(a.created_at)
                const dateStr=dt.toLocaleDateString(undefined,{day:"2-digit",month:"short",year:"numeric"})
                const timeStr=dt.toLocaleTimeString(undefined,{hour:"2-digit",minute:"2-digit",second:"2-digit"})
                return(
                  <details key={a.id} className="group rounded-lg bg-zinc-50 border border-zinc-100 overflow-hidden">
                    <summary className="flex items-start justify-between gap-2 p-2.5 cursor-pointer list-none">
                      <div className="min-w-0">
                        <p className="text-[11px] leading-snug">
                          {buildSentence()}
                        </p>
                        <p className="text-[8px] text-zinc-400 mt-0.5">{dateStr} at {timeStr}</p>
                      </div>
                      {changeEntries.length>0&&<ChevronDown size={13} className="shrink-0 text-zinc-400 mt-0.5 group-open:rotate-180 transition-transform"/>}
                    </summary>
                    {changeEntries.length>0&&(
                      <div className="px-2.5 pb-2.5 space-y-1 border-t border-zinc-200 pt-2 mt-0.5">
                        {changeEntries.map(([field,val]:any)=>(
                          <div key={field} className="flex items-center gap-1.5 text-[9px]">
                            <span className="font-bold text-zinc-500 shrink-0">{fieldLabel(field)}:</span>
                            <span className="text-red-400 line-through truncate">{fmtVal(val.from)}</span>
                            <span className="text-zinc-300">→</span>
                            <span className="text-green-600 font-bold truncate">{fmtVal(val.to)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </details>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════
          UPCOMING MATCHES — its own special, featured space
      ═══════════════════════════════════════════ */}
      {upcomingOpen&&(()=>{
        const today=new Date().toISOString().slice(0,10)
        const upcoming=matches.filter((m:any)=>m.date&&m.date>=today&&!m.result).sort((a:any,b:any)=>a.date.localeCompare(b.date))
        const next=upcoming[0]
        const rest=upcoming.slice(1)
        const daysUntil=(dateStr:string)=>{
          const diff=Math.ceil((new Date(dateStr+"T00:00:00").getTime()-new Date(new Date().toDateString()).getTime())/86400000)
          return diff
        }
        return(
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-2 sm:p-4 bg-black/80">
          <div className="w-full max-w-lg rounded-2xl bg-[#FAF8F3] text-zinc-900 shadow-2xl flex flex-col max-h-[88vh]">
            <div className="px-6 pt-5 pb-4 border-b border-zinc-100 shrink-0 flex items-center justify-between">
              <h2 className="text-sm font-black uppercase italic tracking-tighter flex items-center gap-2"><Calendar size={16}/>Upcoming Matches</h2>
              <button onClick={()=>setUpcomingOpen(false)} title="Close" className="p-1.5 rounded-lg hover:bg-zinc-100 transition-all"><X size={18}/></button>
            </div>
            <div className="p-5 overflow-y-auto space-y-5">

              {!next&&<p className="text-[11px] text-zinc-400 py-10 text-center bg-zinc-100/60 rounded-2xl">No upcoming matches scheduled yet</p>}

              {/* Featured hero card — the very next match, given real visual weight */}
              {next&&(
                <div className="relative rounded-2xl overflow-hidden" style={{background:"linear-gradient(135deg, #1a1a1a 0%, #E30613 140%)"}}>
                  <div className="relative p-6 text-center">
                    <p className="text-[9px] font-black uppercase tracking-[0.25em] text-white/60 mb-2">Next Match {daysUntil(next.date)===0?"· Today":daysUntil(next.date)===1?"· Tomorrow":`· In ${daysUntil(next.date)} days`}</p>
                    <p className="text-2xl font-black uppercase italic tracking-tight text-white">Tunisia <span className="text-white/50 not-italic mx-1">vs</span> {next.opponent||"TBD"}</p>
                    <p className="text-[12px] font-bold text-white/80 mt-2">{fmtDateWords(next.date)}</p>
                    <div className="flex items-center justify-center gap-2 mt-3">
                      <span className="text-[8px] font-black uppercase tracking-wider px-3 py-1 rounded-full bg-white/15 text-white">{next.competition||"Friendly"}</span>
                      {next.venue&&<span className="text-[8px] font-black uppercase tracking-wider px-3 py-1 rounded-full bg-white/15 text-white">{next.venue}</span>}
                    </div>
                  </div>
                </div>
              )}

              {/* Later fixtures — smaller, secondary treatment */}
              {rest.length>0&&(
                <div>
                  <p className="text-[9px] font-black uppercase tracking-wider text-zinc-400 mb-2">Also Coming Up</p>
                  <div className="space-y-2">
                    {rest.map((m:any)=>(
                      <div key={m.id} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-white border border-zinc-200/60">
                        <div>
                          <p className="text-[12px] font-bold">Tunisia vs {m.opponent||"TBD"}</p>
                          <p className="text-[9px] text-zinc-500 mt-0.5">{m.competition||"Friendly"}{m.venue?` · ${m.venue}`:""}</p>
                        </div>
                        <span className="shrink-0 text-[10px] font-black text-zinc-600 bg-zinc-50 border border-zinc-200 rounded-full px-3 py-1.5">{fmtDateWords(m.date)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )})()}

      {/* ═══════════════════════════════════════════
          WOMEN'S FOOTBALL NEWS — automated feed
      ═══════════════════════════════════════════ */}
      {newsOpen&&(
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-2 sm:p-4 bg-black/80">
          <div className="w-full max-w-lg rounded-2xl bg-[#FAF8F3] text-zinc-900 shadow-2xl flex flex-col max-h-[88vh]">
            <div className="px-6 pt-5 pb-4 border-b border-zinc-100 shrink-0 flex items-center justify-between">
              <h2 className="text-sm font-black uppercase italic tracking-tighter flex items-center gap-2"><Newspaper size={16}/>Women's Football News</h2>
              <button onClick={()=>setNewsOpen(false)} title="Close" className="p-1.5 rounded-lg hover:bg-zinc-100 transition-all"><X size={18}/></button>
            </div>
            <div className="p-5 overflow-y-auto space-y-2">
              <div className="flex items-center justify-end mb-1">
                <span className="text-[8px] text-zinc-400">auto-updated</span>
              </div>
              {newsLoading&&<p className="text-[10px] text-zinc-400 py-6 text-center">Loading latest news…</p>}
              {!newsLoading&&newsItems&&newsItems.length===0&&<p className="text-[10px] text-zinc-400 py-6 text-center">No news found right now</p>}
              {!newsLoading&&newsItems&&newsItems.map((n:any,i:number)=>(
                <a key={i} href={n.link} target="_blank" rel="noopener noreferrer" className="block p-3 rounded-lg bg-white border border-zinc-200/60 hover:border-[#E30613]/30 hover:bg-[#E30613]/5 transition-all">
                  <p className="text-[11px] font-bold text-zinc-800 leading-snug">{n.title}</p>
                  <p className="text-[9px] text-zinc-400 mt-1">{n.source}{n.pubDate?` · ${new Date(n.pubDate).toLocaleDateString()}`:""}</p>
                </a>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════
          SCOUT FILTER PANEL — every league/region + dual nationality
      ═══════════════════════════════════════════ */}
      {scoutFilterOpen&&(
        <div className="fixed inset-0 z-[220] flex items-center justify-center p-2 sm:p-4 bg-black/80">
          <div className="w-full max-w-sm rounded-2xl bg-[#FAF8F3] text-zinc-900 shadow-2xl flex flex-col max-h-[85vh]">
            <div className="px-5 pt-4 pb-3 border-b border-zinc-200 shrink-0 flex items-center justify-between">
              <h2 className="text-sm font-black uppercase italic tracking-tighter flex items-center gap-2"><Globe size={15}/>Scout Filter</h2>
              <button onClick={()=>setScoutFilterOpen(false)} title="Close" className="p-1.5 rounded-lg hover:bg-zinc-200/60 transition-all"><X size={17}/></button>
            </div>
            <div className="p-4 overflow-y-auto space-y-4">
              <button onClick={()=>setScoutDualOnly(d=>!d)} className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl border text-[10px] font-black uppercase tracking-wider transition-all ${scoutDualOnly?'bg-blue-600 border-blue-600 text-white':'border-zinc-200 bg-white text-zinc-600'}`}>
                🌐 Dual Nationality Only {scoutDualOnly&&"✓"}
              </button>

              {LEAGUES_BY_REGION.map(group=>(
                <div key={group.region}>
                  <p className="text-[9px] font-black uppercase tracking-wider text-zinc-400 mb-1.5">{group.region}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {group.options.map(opt=>{
                      const active=scoutRegionFilter.has(opt)
                      return(
                        <button key={opt} onClick={()=>{
                          const next=new Set(scoutRegionFilter)
                          if(active)next.delete(opt);else next.add(opt)
                          setScoutRegionFilter(next)
                        }} className={`px-2.5 py-1.5 rounded-full text-[9px] font-bold transition-all ${active?'bg-blue-600 text-white':'bg-white border border-zinc-200 text-zinc-500 hover:border-blue-300'}`}>
                          {opt}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
            <div className="p-4 border-t border-zinc-200 shrink-0 flex gap-2">
              <button onClick={()=>{setScoutRegionFilter(new Set());setScoutDualOnly(false)}} className="flex-1 py-2.5 rounded-full text-[9px] font-black uppercase tracking-wider border border-zinc-300 bg-white hover:bg-zinc-100 transition-all">Clear All</button>
              <button onClick={()=>setScoutFilterOpen(false)} className="flex-[2] py-2.5 bg-[#E30613] text-white rounded-full text-[9px] font-black uppercase tracking-wider shadow-lg hover:scale-[1.02] transition-all">Show Results</button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════
          SQUAD LAB — test formations & lineups, FPL-style
      ═══════════════════════════════════════════ */}
      {squadLabOpen&&(()=>{
        const categoryPlayers=members.filter((m:any)=>m.role==="PLAYERS"&&m.teamCategory===teamCat)
        const usedIds=new Set(Object.values(labSlots).filter(Boolean))
        const availableForPicker=categoryPlayers.filter((m:any)=>!usedIds.has(m.id))
        const filledCount=Object.values(labSlots).filter(Boolean).length
        return(
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-2 sm:p-4 bg-black/80">
          <div className="w-full max-w-2xl rounded-2xl bg-[#FAF8F3] text-zinc-900 shadow-2xl flex flex-col max-h-[92vh]">
            <div className="px-6 pt-5 pb-4 border-b border-zinc-100 shrink-0 flex items-center justify-between">
              <h2 className="text-sm font-black uppercase italic tracking-tighter flex items-center gap-2"><Users size={16}/>Squad Lab</h2>
              <button onClick={()=>{setSquadLabOpen(false);setLabPickerSlot(null)}} title="Close" className="p-1.5 rounded-lg hover:bg-zinc-100 transition-all"><X size={18}/></button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex flex-wrap gap-1.5">
                  {Object.keys(FORMATIONS).map(f=>(
                    <button key={f} onClick={()=>{setLabFormation(f);setLabSlots({})}} className={`px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-wider transition-all ${labFormation===f?'bg-[#E30613] text-white':'bg-zinc-100 text-zinc-500 hover:bg-zinc-200/60'}`}>{f}</button>
                  ))}
                </div>
                <span className="text-[10px] font-bold text-zinc-500">{filledCount}/11 filled</span>
              </div>

              <FormationPitch
                formation={labFormation}
                slots={labSlots}
                members={categoryPlayers}
                editable
                onSlotClick={(slotKey)=>setLabPickerSlot(slotKey)}
              />

              {/* Player picker for the selected slot */}
              {labPickerSlot&&(
                <div className="rounded-xl bg-white border border-zinc-200 p-3 space-y-1.5 max-h-52 overflow-y-auto">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-[9px] font-black uppercase tracking-wider text-zinc-400">Assign to {labPickerSlot.toUpperCase()}</p>
                    <button onClick={()=>setLabPickerSlot(null)} className="text-[8px] font-bold text-zinc-400 hover:text-zinc-600">Cancel</button>
                  </div>
                  {labSlots[labPickerSlot]&&(
                    <button onClick={()=>{setLabSlots({...labSlots,[labPickerSlot]:null});setLabPickerSlot(null)}} className="w-full flex items-center gap-2 p-2 rounded-lg bg-red-50 text-red-600 text-[11px] font-bold text-left">
                      <X size={12}/>Remove {categoryPlayers.find((m:any)=>m.id===labSlots[labPickerSlot!])?.name}
                    </button>
                  )}
                  {availableForPicker.length===0&&<p className="text-[10px] text-zinc-400 py-3 text-center">No available players left</p>}
                  {availableForPicker.map((pl:any)=>(
                    <button key={pl.id} onClick={()=>{setLabSlots({...labSlots,[labPickerSlot]:pl.id});setLabPickerSlot(null)}} className="w-full flex items-center justify-between gap-2 p-2 rounded-lg hover:bg-zinc-50 text-left transition-all">
                      <span className="text-[11px] font-bold">{pl.name}</span>
                      <span className="text-[8px] font-black uppercase text-zinc-400">{pl.position}</span>
                    </button>
                  ))}
                </div>
              )}

              {/* Save as template */}
              <div className="flex gap-2">
                <input placeholder="Name this lineup (e.g. vs Algeria - Plan A)" value={labTemplateName} onChange={e=>setLabTemplateName(e.target.value)} className="flex-1 p-2.5 bg-white rounded-lg border border-zinc-200 text-[11px] font-bold outline-none"/>
                <button onClick={async()=>{
                  if(!labTemplateName.trim()){alert("Name this lineup first");return}
                  const {error}=await saveSquadTemplate({teamCategory:teamCat!,name:labTemplateName.trim(),formation:labFormation,slots:labSlots})
                  if(error){alert("Failed: "+error);return}
                  setLabTemplateName("")
                  setLabTemplates(await fetchSquadTemplates(teamCat!))
                }} className="px-4 py-2.5 bg-[#E30613] text-white rounded-full text-[9px] font-black uppercase tracking-wider shadow-lg hover:scale-[1.02] transition-all shrink-0">Save</button>
              </div>

              {/* Saved templates */}
              {labTemplates.length>0&&(
                <div>
                  <p className="text-[9px] font-black uppercase tracking-wider text-zinc-400 mb-2">Saved Lineups</p>
                  <div className="space-y-1.5">
                    {labTemplates.map((t:any)=>(
                      <div key={t.id} className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-white border border-zinc-200/60">
                        <button onClick={()=>{setLabFormation(t.formation);setLabSlots(t.slots||{})}} className="flex-1 text-left">
                          <p className="text-[11px] font-bold text-zinc-800">{t.name}</p>
                          <p className="text-[8px] text-zinc-400">{t.formation} · by {t.created_by_username||"unknown"}</p>
                        </button>
                        <button onClick={async()=>{if(await askConfirm(`Delete "${t.name}"?`)){await deleteSquadTemplate(t.id);setLabTemplates(await fetchSquadTemplates(teamCat!))}}} className="p-1.5 rounded-lg text-zinc-300 hover:text-red-500 hover:bg-red-50 transition-all"><Trash2 size={12}/></button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )})()}

      {isMatchOpen&&(
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80">
          <div className="w-full max-w-2xl rounded-2xl bg-[#FAF8F3] text-zinc-900 shadow-2xl flex flex-col max-h-[90vh]">

            {/* ── HEADER ── */}
            <div className="px-6 pt-5 pb-4 border-b border-zinc-100 shrink-0">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  {["Info","Squad","Opponent","Actions"].map((label,i)=>(
                    <div key={i} className="flex items-center gap-1.5">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-black transition-all ${i<=matchStep?'bg-[#E30613] text-white':'bg-zinc-100 text-zinc-300'}`}>{i+1}</div>
                      <span className={`text-[9px] font-bold uppercase tracking-wider hidden sm:inline ${i<=matchStep?'text-zinc-800':'text-zinc-300'}`}>{label}</span>
                      {i<3&&<span className="text-zinc-200 mx-1">—</span>}
                    </div>
                  ))}
                </div>
                <button onClick={()=>setIsMatchOpen(false)} title="Close" className="w-7 h-7 rounded-lg bg-zinc-100 hover:bg-red-50 hover:text-red-500 flex items-center justify-center transition-all"><X size={14} className="text-zinc-400"/></button>
              </div>

              {/* Step content in header */}
              {matchStep===0&&(
                <div className="grid grid-cols-[1fr_auto_auto] gap-3 items-end">
                  <div>
                    <label className="text-[7px] font-bold text-zinc-400 uppercase tracking-wider mb-1 block">Opponent</label>
                    <input placeholder="e.g. ALGERIA" value={matchForm.opponent} onChange={e=>setMatchForm({...matchForm,opponent:e.target.value.charAt(0).toUpperCase()+e.target.value.slice(1).toLowerCase()})}
                      className="w-full text-lg font-black italic uppercase tracking-tight border-b-2 border-zinc-200 pb-1 outline-none focus:border-[#E30613] bg-transparent placeholder-zinc-200"/>
                  </div>
                  <div>
                    <label className="text-[7px] font-bold text-zinc-400 uppercase tracking-wider mb-1 block">Date</label>
                    <div className="w-36"><DatePicker value={matchForm.date} onChange={(v)=>setMatchForm({...matchForm,date:v})} placeholder="Match date"/></div>
                  </div>
                  <div>
                    <label className="text-[7px] font-bold text-zinc-400 uppercase tracking-wider mb-1 block">Score</label>
                    <div className="flex items-center gap-1">
                      <input placeholder="0" value={matchForm.result.split('-')[0]||''} onChange={e=>{const h=e.target.value.replace(/\D/g,''),a=matchForm.result.split('-')[1]||'';setMatchForm({...matchForm,result:h||a?a?h+'-'+a:h:a})}} className="w-10 text-center p-2 rounded-lg border border-zinc-200 outline-none text-sm font-black"/>
                      <span className="text-sm font-black text-zinc-400">-</span>
                      <input placeholder="0" value={matchForm.result.split('-')[1]||''} onChange={e=>{const h=matchForm.result.split('-')[0]||'',a=e.target.value.replace(/\D/g,'');setMatchForm({...matchForm,result:h||a?a?h+'-'+a:h:a})}} className="w-10 text-center p-2 rounded-lg border border-zinc-200 outline-none text-sm font-black"/>
                    </div>
                  </div>
                  <div className="col-span-full flex items-center gap-3">
                    <div className="flex-1">
                      <label className="text-[7px] font-bold text-zinc-400 uppercase tracking-wider mb-1 block">Venue</label>
                      <input placeholder="Stadium name" value={matchForm.venue} onChange={e=>setMatchForm({...matchForm,venue:e.target.value})} className="w-full p-2 rounded-lg border border-zinc-200 outline-none text-xs font-bold uppercase"/>
                    </div>
                  </div>
                  <div className="col-span-full">
                    <label className="text-[7px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5 block">Competition</label>
                    <div className="flex flex-wrap gap-1.5">
                      {COMPETITIONS.map(comp=>(
                        <button key={comp.label} type="button" onClick={()=>setMatchForm({...matchForm,competition:comp.value})}
                          className={`px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-wider transition-all ${matchForm.competition===comp.value?'bg-[#E30613] text-white':'bg-zinc-100 text-zinc-500 hover:bg-zinc-200/60'}`}>
                          {comp.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  {/* ── MATCH STATS ── */}
                  <div className="col-span-full mt-4">
                    <p className="text-[7px] font-black uppercase tracking-wider text-zinc-400 mb-2">Match Stats (optional)</p>
                    <div className="grid grid-cols-[1fr_auto_1fr] gap-x-3 gap-y-2 items-center text-[10px] font-bold">
                      <span className="text-right text-zinc-600">Tunisia</span><span className="text-[7px] font-black text-zinc-400 text-center">vs</span><span className="text-zinc-600">{matchForm.opponent||"Opponent"}</span>
                      <input placeholder="%" value={matchForm.tunisiaPossession} onChange={e=>setMatchForm({...matchForm,tunisiaPossession:e.target.value.replace(/\D/g,'')})} className="text-right p-1.5 rounded border border-zinc-200 outline-none w-14 justify-self-end"/><span className="text-[7px] font-black text-zinc-400">Poss.</span><input placeholder="%" value={matchForm.opponentPossession} onChange={e=>setMatchForm({...matchForm,opponentPossession:e.target.value.replace(/\D/g,'')})} className="p-1.5 rounded border border-zinc-200 outline-none w-14"/>
                      <input placeholder="0" value={matchForm.tunisiaShots} onChange={e=>setMatchForm({...matchForm,tunisiaShots:e.target.value.replace(/\D/g,'')})} className="text-right p-1.5 rounded border border-zinc-200 outline-none w-14 justify-self-end"/><span className="text-[7px] font-black text-zinc-400">Shots</span><input placeholder="0" value={matchForm.opponentShots} onChange={e=>setMatchForm({...matchForm,opponentShots:e.target.value.replace(/\D/g,'')})} className="p-1.5 rounded border border-zinc-200 outline-none w-14"/>
                      <input placeholder="0" value={matchForm.tunisiaShotsOnTarget} onChange={e=>setMatchForm({...matchForm,tunisiaShotsOnTarget:e.target.value.replace(/\D/g,'')})} className="text-right p-1.5 rounded border border-zinc-200 outline-none w-14 justify-self-end"/><span className="text-[7px] font-black text-zinc-400">SOT</span><input placeholder="0" value={matchForm.opponentShotsOnTarget} onChange={e=>setMatchForm({...matchForm,opponentShotsOnTarget:e.target.value.replace(/\D/g,'')})} className="p-1.5 rounded border border-zinc-200 outline-none w-14"/>
                      <input placeholder="0" value={matchForm.tunisiaCorners} onChange={e=>setMatchForm({...matchForm,tunisiaCorners:e.target.value.replace(/\D/g,'')})} className="text-right p-1.5 rounded border border-zinc-200 outline-none w-14 justify-self-end"/><span className="text-[7px] font-black text-zinc-400">Corn.</span><input placeholder="0" value={matchForm.opponentCorners} onChange={e=>setMatchForm({...matchForm,opponentCorners:e.target.value.replace(/\D/g,'')})} className="p-1.5 rounded border border-zinc-200 outline-none w-14"/>
                      <input placeholder="0" value={matchForm.tunisiaFouls} onChange={e=>setMatchForm({...matchForm,tunisiaFouls:e.target.value.replace(/\D/g,'')})} className="text-right p-1.5 rounded border border-zinc-200 outline-none w-14 justify-self-end"/><span className="text-[7px] font-black text-zinc-400">Fouls</span><input placeholder="0" value={matchForm.opponentFouls} onChange={e=>setMatchForm({...matchForm,opponentFouls:e.target.value.replace(/\D/g,'')})} className="p-1.5 rounded border border-zinc-200 outline-none w-14"/>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* ── BODY ── */}
            <div className="flex-1 overflow-y-auto px-6 py-4">

              {/* ── STEP 2: OUR SQUAD ── */}
              {matchStep===1&&(
                <div className="space-y-5">
                  <button type="button" onClick={async()=>{
                    const templates=await fetchSquadTemplates(teamCat!)
                    if(templates.length===0){alert("No saved lineups yet — build one in Squad Lab first");return}
                    const names=templates.map((t:any,i:number)=>`${i+1}. ${t.name} (${t.formation})`).join("\n")
                    const pick=window.prompt(`Load which lineup?\n\n${names}\n\nEnter the number:`)
                    const idx=parseInt(pick||"")-1
                    if(isNaN(idx)||!templates[idx])return
                    const t=templates[idx]
                    const orderedIds=(FORMATIONS[t.formation]||[]).map((s:any)=>t.slots[s.slotKey]).filter(Boolean)
                    setMatchForm({...matchForm,squad:[...orderedIds,...matchForm.squad.slice(11)],formation:t.formation,formationSlots:t.slots})
                  }} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-blue-300 bg-blue-50 text-blue-600 text-[9px] font-black uppercase tracking-wider hover:bg-blue-100 transition-all">
                    <Users size={12}/>Load from Squad Lab
                  </button>
                  <div className="grid grid-cols-2 gap-4">
                    {/* Starting XI */}
                    <div className="bg-zinc-50 rounded-xl border border-zinc-100 p-4">
                      <p className="text-[8px] font-black uppercase tracking-wider text-[#E30613] mb-3 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-[#E30613]"/> STARTING XI
                        <span className="text-zinc-300 font-normal ml-auto text-[7px]">1–11</span>
                      </p>
                      <div className="space-y-1.5">
                        {matchForm.squad.slice(0,11).length>0?matchForm.squad.slice(0,11).map((pid:number,i:number)=>{
                          const pl=catPlayers.find((p:any)=>p.id===pid)
                          if(!pl) return null
                          return(
                            <div key={pl.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-white border border-zinc-200/60 text-xs">
                              <span className="text-[8px] font-black text-zinc-300 w-4 shrink-0">{i+1}</span>
                              <span className="text-[6px] font-black px-1 py-0.5 rounded bg-[#E30613]/10 text-[#E30613] shrink-0">{pl.position.slice(0,3)}</span>
                              <span className="font-bold truncate text-zinc-800">{pl.name}</span>
                              <button onClick={()=>moveDown(pl.id,i)} className="ml-auto text-zinc-300 hover:text-red-500 text-[9px] leading-none">✕</button>
                            </div>
                          )
                        }):<p className="text-[9px] text-zinc-400 text-center py-4">Add players from below</p>}
                      </div>
                    </div>

                    {/* Bench */}
                    <div className="bg-zinc-50 rounded-xl border border-zinc-100 p-4">
                      <p className="text-[8px] font-black uppercase tracking-wider text-amber-600 mb-3 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-amber-500"/> BENCH
                        <span className="text-zinc-300 font-normal ml-auto text-[7px]">{matchForm.squad.slice(11).length} players</span>
                      </p>
                      <div className="space-y-1.5">
                        {matchForm.squad.slice(11).length>0?matchForm.squad.slice(11).map((pid:number,i:number)=>{
                          const pl=catPlayers.find((p:any)=>p.id===pid)
                          if(!pl) return null
                          return(
                            <div key={pl.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-white border border-zinc-200/60 text-xs">
                              <span className="text-[6px] font-black px-1 py-0.5 rounded bg-amber-200/60 text-amber-700 shrink-0">BN</span>
                              <span className="font-bold truncate flex-1 text-zinc-800">{pl.name}</span>
                              <button onClick={()=>moveUp(pl.id)} className="text-zinc-300 hover:text-amber-500 text-[9px] leading-none">✕</button>
                            </div>
                          )
                        }):<p className="text-[9px] text-zinc-400 text-center py-4">No subs yet</p>}
                      </div>
                    </div>
                  </div>

                  {/* Available */}
                  {catPlayers.filter((p:any)=>!matchForm.squad.includes(p.id)).length>0&&(
                    <div>
                      <p className="text-[8px] font-black uppercase tracking-wider text-zinc-400 mb-2">Available Players</p>
                      <div className="flex flex-wrap gap-1.5">
                        {catPlayers.filter((p:any)=>!matchForm.squad.includes(p.id)).map((pl:any)=>(
                          <div key={pl.id} onClick={()=>toggleSquad(pl.id)} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-zinc-200 bg-white text-xs text-zinc-500 cursor-pointer hover:border-[#E30613]/30 hover:bg-[#E30613]/5 hover:text-[#E30613] transition-all">
                            <span className="text-[6px] font-black px-1 py-0.5 rounded bg-zinc-100 text-zinc-400">{pl.position.slice(0,3)}</span>
                            <span className="font-semibold">{pl.name}</span>
                            <span className="text-zinc-300 text-[10px]">+</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {matchForm.squad.length>0&&<p className="text-[8px] text-zinc-400 font-semibold text-center">{matchForm.squad.length}/11 selected {matchForm.squad.length<11&&`· Need ${11-matchForm.squad.length} more`}</p>}
                </div>
              )}

              {/* ── STEP 3: OPPONENT SQUAD ── */}
              {matchStep===2&&(
                <div>
                  <p className="text-[8px] font-black uppercase tracking-wider text-zinc-500 mb-3">Opposition Lineup</p>
                  <div className="grid grid-cols-2 gap-2">
                    {matchForm.opponentSquad.map((name:string,i:number)=>(
                      <div key={i} className="flex items-center gap-2 bg-zinc-50 rounded-lg border border-zinc-100 px-3 py-2">
                        <span className="text-[8px] font-black text-zinc-300 w-4 shrink-0">{i+1}.</span>
                        <input value={name} onChange={e=>{const s=[...matchForm.opponentSquad];s[i]=e.target.value;setMatchForm({...matchForm,opponentSquad:s})}} placeholder={`Player ${i+1}`} className="flex-1 bg-transparent outline-none text-xs font-bold text-zinc-700 placeholder-zinc-300"/>
                        <button onClick={()=>setMatchForm({...matchForm,opponentSquad:matchForm.opponentSquad.filter((_:any,idx:number)=>idx!==i)})} className="text-zinc-300 hover:text-red-500 text-[10px]">✕</button>
                      </div>
                    ))}
                    <button onClick={()=>setMatchForm({...matchForm,opponentSquad:[...matchForm.opponentSquad,""]})} className="col-span-full flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg border-2 border-dashed border-zinc-200 text-xs font-bold text-zinc-400 hover:border-[#E30613]/30 hover:text-[#E30613] transition-all">+ Add player</button>
                  </div>
                </div>
              )}

              {/* ── STEP 4: MATCH ACTIONS ── */}
              {matchStep===3&&(
                <div className="space-y-4">
                  {/* Action buttons */}
                  <div className="flex flex-wrap gap-2">
                    <button onClick={()=>setActionPick("goal")} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-green-50 border border-green-200 text-green-700 text-[9px] font-black uppercase tracking-wider hover:bg-green-100 transition-all shadow-sm">⚽ Goal</button>
                    <button onClick={()=>setActionPick("yellow")} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-yellow-50 border border-yellow-200 text-yellow-700 text-[9px] font-black uppercase tracking-wider hover:bg-yellow-100 transition-all shadow-sm">🟨 Yellow</button>
                    <button onClick={()=>setActionPick("red")} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-50 border border-red-200 text-red-700 text-[9px] font-black uppercase tracking-wider hover:bg-red-100 transition-all shadow-sm">🟥 Red</button>
                    <button onClick={()=>{setActionPick("sub");setSubOutId(null)}} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 text-[9px] font-black uppercase tracking-wider hover:bg-blue-100 transition-all shadow-sm">↔ Sub</button>
                  </div>

                  {/* Pickers */}
                  {actionPick==="goal"&&<PickerCard title="Select goal scorer" color="green" onClose={()=>setActionPick(null)} players={matchForm.squad.filter((pid:number)=>!matchForm.subs.find((s:any)=>s.out===pid))} onPick={(pid)=>editGoals(pid,1)}/>}
                  {actionPick==="yellow"&&<PickerCard title="Select player (yellow card)" color="yellow" onClose={()=>setActionPick(null)} players={matchForm.squad} onPick={(pid)=>toggleYellow(pid)} filter={(pid)=>!matchForm.redCards.includes(pid)}/>}
                  {actionPick==="red"&&<PickerCard title="Select player (red card)" color="red" onClose={()=>setActionPick(null)} players={matchForm.squad} onPick={(pid)=>toggleRed(pid)}/>}
                  {actionPick==="sub"&&!subOutId&&<PickerCard title="Select player to sub OUT" color="blue" onClose={()=>{setActionPick(null);setSubOutId(null)}} players={matchForm.squad.slice(0,11)} onPick={(pid)=>{setSubOutId(pid)}} filter={(pid)=>!matchForm.subs.find((s:any)=>s.out===pid)}/>}
                  {actionPick==="sub"&&subOutId&&<PickerCard title={`Replace ${members.find((m:any)=>m.id===subOutId)?.name||'?'} with...`} color="blue" onClose={()=>{setActionPick(null);setSubOutId(null)}} players={matchForm.squad.slice(11)} onPick={(pid)=>{subOutWith(subOutId,pid);setActionPick(null);setSubOutId(null)}} filter={(pid)=>!matchForm.subs.find((s:any)=>s["in"]===pid)}/>}

                  {/* Event cards */}
                  <div className="grid grid-cols-1 gap-2">
                    {matchForm.scorers.length>0&&<div className="bg-green-50/50 border border-green-100 rounded-xl p-3">
                      <p className="text-[8px] font-black uppercase tracking-wider text-green-700 mb-2">⚽ Goals</p>
                      <div className="space-y-1">
                        {matchForm.scorers.map((s:any)=>{
                          const pl=members.find((m:any)=>m.id===s.playerId)
                          if(!pl)return null
                          return(
                            <div key={s.playerId} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white border border-green-100/80 group">
                              <span className="font-bold text-xs flex-1 text-zinc-800">{pl.name}</span>
                              <div className="flex items-center gap-1">
                                <span onClick={()=>editGoals(pl.id,-1)} className={`w-4 h-4 rounded flex items-center justify-center text-[9px] font-black cursor-pointer ${s.goals>1?'bg-green-200 text-green-700':'text-green-200'}`}>–</span>
                                <span className="w-4 text-center text-xs font-black text-zinc-800">{s.goals}</span>
                                <span onClick={()=>editGoals(pl.id,1)} className="w-4 h-4 rounded flex items-center justify-center text-[9px] font-black cursor-pointer bg-green-200 text-green-700">+</span>
                              </div>
                              <button onClick={()=>removeGoal(pl.id)} title="Close" className="opacity-0 group-hover:opacity-100 text-zinc-400 hover:text-red-500 transition-all"><X size={10}/></button>
                            </div>
                          )
                        })}
                      </div>
                    </div>}

                    {(matchForm.yellowCards.length>0||matchForm.redCards.length>0)&&<div className="bg-zinc-50/50 border border-zinc-100 rounded-xl p-3">
                      <p className="text-[8px] font-black uppercase tracking-wider text-zinc-600 mb-2">🟨🟥 Cards</p>
                      <div className="flex flex-wrap gap-1.5">
                        {matchForm.yellowCards.map((pid:number)=>{
                          const pl=members.find((m:any)=>m.id===pid)
                          if(!pl)return null
                          return(
                            <span key={"y"+pid} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-yellow-200 text-[10px] font-bold group">
                              <span className="w-3 h-4 rounded-[2px] bg-yellow-400"/> {pl.name.split(' ').slice(-1)}
                              <button onClick={()=>toggleYellow(pid)} title="Close" className="opacity-0 group-hover:opacity-100 text-zinc-400 hover:text-red-500 transition-all"><X size={10}/></button>
                            </span>
                          )
                        })}
                        {matchForm.redCards.map((pid:number)=>{
                          const pl=members.find((m:any)=>m.id===pid)
                          if(!pl)return null
                          return(
                            <span key={"r"+pid} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-red-200 text-[10px] font-bold group">
                              <span className="w-3 h-4 rounded-[2px] bg-red-600"/> {pl.name.split(' ').slice(-1)}
                              <button onClick={()=>toggleRed(pid)} title="Close" className="opacity-0 group-hover:opacity-100 text-zinc-400 hover:text-red-500 transition-all"><X size={10}/></button>
                            </span>
                          )
                        })}
                      </div>
                    </div>}

                    {matchForm.subs.length>0&&<div className="bg-blue-50/50 border border-blue-100 rounded-xl p-3">
                      <p className="text-[8px] font-black uppercase tracking-wider text-blue-700 mb-2">↔ Substitutions</p>
                      <div className="flex flex-wrap gap-1.5">
                        {matchForm.subs.map((s:any,i:number)=>{
                          const on=members.find((m:any)=>m.id===s.out)?.name||'?'
                          const inn=members.find((m:any)=>m.id===s["in"])?.name||'?'
                          return(
                            <div key={i} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white border border-blue-200 text-[10px] font-bold group">
                              <span className="text-red-500 line-through">{on}</span>
                              <span className="text-zinc-300">→</span>
                              <span className="text-green-600">{inn}</span>
                              <button onClick={()=>removeSub(i)} title="Close" className="opacity-0 group-hover:opacity-100 text-zinc-400 hover:text-red-500 transition-all"><X size={10}/></button>
                            </div>
                          )
                        })}
                      </div>
                    </div>}
                  </div>

                  {matchForm.scorers.length===0&&matchForm.yellowCards.length===0&&matchForm.redCards.length===0&&matchForm.subs.length===0&&(
                    <div className="flex flex-col items-center justify-center py-8 opacity-40">
                      <p className="text-sm font-black text-zinc-400">No match events yet</p>
                      <p className="text-[10px] text-zinc-400 mt-1">Use the buttons above to add goals, cards, and subs</p>
                    </div>
                  )}
                </div>
              )}

            </div>

            {/* ── FOOTER ── */}
            <div className="px-6 py-4 border-t border-zinc-100 flex items-center justify-between">
              <span className="text-[9px] font-bold text-zinc-400">
                {matchStep===0&&"⚽ New match details"}
                {matchStep===1&&`👥 ${matchForm.squad.length} players in squad`}
                {matchStep===2&&`📋 ${matchForm.opponentSquad.filter((n:string)=>n.trim()).length} opponent players`}
                {matchStep===3&&`${matchForm.scorers.reduce((a:number,s:any)=>a+s.goals,0)}⚽ ${matchForm.yellowCards.length}🟨 ${matchForm.redCards.length}🟥${matchForm.subs.length>0&&` ${matchForm.subs.length}↔`}`}
              </span>
              <div className="flex gap-2">
                {matchStep>0&&<button onClick={()=>setMatchStep(matchStep-1)} className="px-4 py-2 rounded-lg border border-zinc-200 text-xs font-bold text-zinc-500 hover:bg-zinc-50 transition-all">Back</button>}
                {matchStep<3&&<button onClick={()=>setMatchStep(matchStep+1)} disabled={matchStep===0&&!matchForm.opponent.trim()} className="px-5 py-2 rounded-full bg-[#E30613] text-white text-xs font-black uppercase tracking-wider shadow-lg shadow-[#E30613]/20 hover:bg-red-700 transition-all disabled:opacity-40">Next</button>}
                {matchStep===3&&<button onClick={()=>{const id=Date.now();const nm={...matchForm,id,teamCategory:teamCat,status:canManageUsers?"approved":"pending",submittedBy:user?.username};setMatches((p:any)=>[...p,nm]);if(canManageUsers)approveMatch(nm);setIsMatchOpen(false);setMatchForm(initMatch);setMatchStep(0)}} className="px-5 py-2 rounded-full bg-[#E30613] text-white text-xs font-black uppercase tracking-wider shadow-lg shadow-[#E30613]/20 hover:bg-red-700 transition-all">Save Match</button>}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════
          CUSTOM CONFIRM DIALOG — replaces native browser confirm()
      ═══════════════════════════════════════════ */}
      {confirmState&&(
        <div className="fixed inset-0 z-[400] flex items-center justify-center p-4 bg-black/80">
          <div className="w-full max-w-xs rounded-2xl bg-[#FAF8F3] shadow-2xl p-5 text-center">
            <div className="w-11 h-11 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-3">
              <AlertTriangle size={20} className="text-[#E30613]"/>
            </div>
            <p className="text-[12px] font-bold text-zinc-800 leading-snug whitespace-pre-line">{confirmState.message}</p>
            <div className="flex gap-2 mt-4">
              <button onClick={()=>{confirmState.resolve(false);setConfirmState(null)}} className="flex-1 py-2.5 rounded-full text-[9px] font-black uppercase tracking-wider border border-zinc-300 bg-zinc-100 hover:bg-zinc-200 transition-all">Cancel</button>
              <button onClick={()=>{confirmState.resolve(true);setConfirmState(null)}} className="flex-1 py-2.5 rounded-full bg-[#E30613] text-white text-[9px] font-black uppercase tracking-wider shadow-lg hover:bg-red-700 transition-all">Confirm</button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════
          SCHEDULE MATCH — lightweight fixture planner
          (no result/squad/staff required — just the essentials for planning ahead)
      ═══════════════════════════════════════════ */}
      {scheduleOpen&&(
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80">
          <div className="w-full max-w-sm rounded-2xl bg-[#FAF8F3] text-zinc-900 shadow-2xl p-5 space-y-3.5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-black uppercase italic tracking-tighter flex items-center gap-2"><Calendar size={16}/>Schedule Match</h2>
              <button onClick={()=>setScheduleOpen(false)} title="Close" className="p-1.5 rounded-lg hover:bg-zinc-200/60 transition-all"><X size={18}/></button>
            </div>
            <p className="text-[10px] text-zinc-500">Planning ahead? Just set the date and opponent — no result or squad needed yet.</p>

            <input placeholder="Opponent" value={scheduleForm.opponent} onChange={e=>setScheduleForm({...scheduleForm,opponent:e.target.value})} className="w-full p-2.5 bg-zinc-50 rounded-lg border border-zinc-200 text-[12px] font-bold outline-none"/>

            <DatePicker value={scheduleForm.date} onChange={(v)=>setScheduleForm({...scheduleForm,date:v})} placeholder="Match date"/>

            <div>
              <p className="text-[9px] font-black uppercase tracking-wider text-zinc-400 mb-1.5">Competition</p>
              <div className="flex flex-wrap gap-1.5">
                {COMPETITIONS.map(comp=>(
                  <button key={comp.label} onClick={()=>setScheduleForm({...scheduleForm,competition:comp.value})}
                    className={`px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-wider transition-all ${scheduleForm.competition===comp.value?'bg-[#E30613] text-white':'bg-zinc-100 text-zinc-500 hover:bg-zinc-200/60'}`}>
                    {comp.label}
                  </button>
                ))}
              </div>
            </div>

            <input placeholder="Venue (optional)" value={scheduleForm.venue} onChange={e=>setScheduleForm({...scheduleForm,venue:e.target.value})} className="w-full p-2.5 bg-zinc-50 rounded-lg border border-zinc-200 text-[12px] font-bold outline-none"/>

            <div className="flex gap-2 pt-1">
              <button onClick={()=>setScheduleOpen(false)} className="flex-1 py-2.5 rounded-full text-[9px] font-black uppercase tracking-wider border border-zinc-300 bg-zinc-100">Cancel</button>
              <button onClick={()=>{
                if(!scheduleForm.opponent.trim()){alert("Enter an opponent");return}
                if(!scheduleForm.date){alert("Pick a date");return}
                const id=Date.now()
                const nm={...initMatch,id,opponent:scheduleForm.opponent.trim(),date:scheduleForm.date,competition:scheduleForm.competition,venue:scheduleForm.venue,teamCategory:teamCat,status:canManageUsers?"approved":"pending",submittedBy:user?.username}
                setMatches((p:any)=>[...p,nm])
                if(canManageUsers)approveMatch(nm)
                setScheduleOpen(false)
              }} className="flex-[2] py-2.5 bg-[#E30613] text-white rounded-full text-[9px] font-black uppercase tracking-wider shadow-lg hover:scale-[1.02] transition-all">Save Fixture</button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════
          MATCH HISTORY MODAL
      ═══════════════════════════════════════════ */}
      {isHistoryOpen&&(()=>{
        const uniqueOpponents=[...new Set(catMatches.map((m:any)=>m.opponent).filter(Boolean))].sort()
        const filteredMatches=opponentFilter?catMatches.filter((m:any)=>m.opponent===opponentFilter):catMatches
        const h2h=opponentFilter?(()=>{const w=filteredMatches.filter((m:any)=>{const p=m.result?.split('-');return p&&p[0]>p[1]}).length;const d=filteredMatches.filter((m:any)=>{const p=m.result?.split('-');return p&&p[0]===p[1]}).length;const l=filteredMatches.filter((m:any)=>{const p=m.result?.split('-');return p&&p[0]<p[1]}).length;return{w,d,l}})():null
        return(
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-2 sm:p-4 bg-black/80 overflow-y-auto">
          <div className="w-full max-w-4xl rounded-2xl bg-[#FAF8F3] text-zinc-900 shadow-2xl flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 shrink-0">
              <div className="flex items-center gap-4">
                <div>
                  <h2 className="text-xl font-black italic uppercase tracking-tighter">{tr.history.matchHistory}</h2>
                  <p className="text-[8px] font-bold text-[#E30613] uppercase tracking-wider mt-0.5">{catLabel(teamCat)} · {filteredMatches.length} {tr.history.matches}{opponentFilter&&` vs ${opponentFilter}`}</p>
                </div>
                {uniqueOpponents.length>0&&<select value={opponentFilter} onChange={e=>setOpponentFilter(e.target.value)} className="p-2 rounded-lg border border-zinc-200 outline-none text-[8px] font-bold bg-white">
                  <option value="">All opponents</option>
                  {uniqueOpponents.map((o:any)=><option key={o} value={o}>{o}</option>)}
                </select>}
                {h2h&&<div className="flex items-center gap-2 text-[10px] font-bold"><span className="text-green-600">{h2h.w}W</span><span className="text-yellow-600">{h2h.d}D</span><span className="text-red-600">{h2h.l}L</span></div>}
              </div>
              <button onClick={()=>{setIsHistoryOpen(false);setSelMatch(null);setOpponentFilter("")}} className="w-8 h-8 rounded-xl bg-zinc-100 hover:bg-red-50 hover:text-red-500 flex items-center justify-center transition-all"><X size={15} className="text-zinc-400"/></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-2.5">
              {filteredMatches.length===0&&(
                <div className="flex flex-col items-center justify-center py-20 gap-3 opacity-25"><Calendar size={40} className="text-zinc-300"/><p className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-400">{tr.history.noMatches}</p></div>
              )}
              {filteredMatches.map(match=>{
                let rs=match.result&&match.result!==''?String(match.result).trim().replace(/\s*-\s*/g,'-'):''
                if(rs&&!rs.includes('-')){const d=rs.replace(/\D/g,'');rs=d.length<2?'':d.slice(0,-1)+'-'+d.slice(-1)}
                const a=parseInt(rs.split('-')[0]), b=parseInt(rs.split('-')[1])
                const isWin=!isNaN(a)&&!isNaN(b)&&a>b
                const isDraw=!isNaN(a)&&!isNaN(b)&&a===b
                const isLoss=!isNaN(a)&&!isNaN(b)&&a<b
                const scoreBg=isWin?'bg-green-500':isDraw?'bg-yellow-500':isLoss?'bg-red-500':'bg-zinc-300'
                return(
                <div key={match.id} className="rounded-xl bg-white overflow-hidden shadow-sm border border-zinc-100">
                  <button onClick={()=>setSelMatch(selMatch?.id===match.id?null:match)} className="w-full text-left transition-all hover:bg-zinc-50">
                    {/* Scoreboard bar */}
                    <div className="flex items-center px-4 py-3 border-b border-zinc-100">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <div className={`w-2 h-2 rounded-full ${scoreBg} shrink-0`}/>
                        <div className="flex items-center gap-1.5 text-xs font-bold">
                          <span className="text-zinc-500">{fmtDateWords(match.date)}</span>
                          {match.competition&&<><span className="text-zinc-200">·</span><span className="text-zinc-400">{match.competition}</span></>}
                        </div>
                      </div>
                      <ChevronDown size={12} className={`text-zinc-300 transition-transform shrink-0 ${selMatch?.id===match.id?'rotate-180':''}`}/>
                    </div>
                    {/* Score */}
                    <div className="flex items-center justify-center gap-4 px-4 py-3">
                      <span className="text-sm font-black text-zinc-800 flex items-center gap-1.5">Tunisia</span>
                      <span className="text-xl font-black text-zinc-900 bg-zinc-100 px-4 py-1 rounded-lg tracking-widest">{match.result||"—"}</span>
                      <span className="text-sm font-black text-zinc-800 flex items-center gap-1.5">{match.opponent}</span>
                    </div>
                  </button>
                  {selMatch?.id===match.id&&(
                    <div className="border-t border-zinc-100 bg-zinc-50 p-4 space-y-4">

                      {/* Lineup */}
                      {Array.isArray(match.squad)&&<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="bg-white rounded-xl border border-zinc-200 p-3">
                          <p className="text-[7px] font-black uppercase tracking-wider text-[#E30613] mb-2">STARTING XI</p>
                          <div className="space-y-1">
                            {match.squad.slice(0,11).map((pid:number,i:number)=>{
                              const pl=members.find((m:any)=>m.id===pid)
                              if(!pl) return null
                              const isOut=match.subs?.find((s:any)=>s.out===pl.id)
                              return(
                                <div key={pid} className="flex items-center gap-2 text-[10px]">
                                  <span className="text-zinc-300 font-black w-4 shrink-0 text-right">{i+1}</span>
                                  <span className="text-[6px] font-black px-1 py-0.5 rounded bg-[#E30613]/10 text-[#E30613]">{pl.position.slice(0,3)}</span>
                                  <span className={`font-bold truncate ${isOut?'line-through text-zinc-400':''}`}>{pl.name}</span>
                                  {isOut&&<span className="text-[7px] font-black text-red-500 ml-auto">OUT</span>}
                                </div>
                              )
                            })}
                          </div>
                        </div>
                        <div className="bg-white rounded-xl border border-zinc-200 p-3">
                          <p className="text-[7px] font-black uppercase tracking-wider text-amber-600 mb-2">BENCH</p>
                          <div className="space-y-1">
                            {match.squad.slice(11).map((pid:number)=>{
                              const pl=members.find((m:any)=>m.id===pid)
                              if(!pl) return null
                              const isIn=match.subs?.find((s:any)=>s["in"]===pl.id)
                              return(
                                <div key={pid} className="flex items-center gap-2 text-[10px]">
                                  <span className="text-[6px] font-black px-1 py-0.5 rounded bg-amber-200/60 text-amber-700">BN</span>
                                  <span className={`font-bold truncate ${isIn?'line-through text-zinc-400':''}`}>{pl.name}</span>
                                  {isIn&&<span className="text-[7px] font-black text-green-600 ml-auto">IN</span>}
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      </div>}

                      {/* Opponent */}
                      {Array.isArray(match.opponentSquad)&&match.opponentSquad.length>0&&<div className="bg-white rounded-xl border border-zinc-200 p-3">
                        <p className="text-[7px] font-black uppercase tracking-wider text-zinc-500 mb-2">{match.opponent}</p>
                        <div className="space-y-1">
                          {match.opponentSquad.map((name:string,i:number)=>(
                            <div key={i} className="flex items-center gap-2 text-[10px]">
                              <span className="text-zinc-300 font-black w-4 shrink-0 text-right">{i+1}</span>
                              <span className="font-bold truncate">{name}</span>
                            </div>
                          ))}
                        </div>
                      </div>}

                      {/* Events */}
                      <div className="bg-white rounded-xl border border-zinc-200 p-3">
                        <p className="text-[7px] font-black uppercase tracking-wider text-zinc-500 mb-3">MATCH EVENTS</p>
                        <div className="space-y-1.5 relative before:absolute before:left-[9px] before:top-2 before:bottom-2 before:w-px before:bg-zinc-200">
                          {(Array.isArray(match.scorers)?match.scorers:[]).map((s:any,si:number)=>{
                            const pl=members.find((m:any)=>m.id===s.playerId)
                            if(!pl) return null
                            return Array.from({length:s.goals}).map((_,gi)=>(
                              <div key={`g-${s.playerId}-${gi}`} className="flex items-center gap-3 pl-0 relative">
                                <div className="w-[19px] h-[19px] rounded-full bg-green-100 border-2 border-green-400 flex items-center justify-center shrink-0 z-10 text-[9px]">⚽</div>
                                <span className="font-bold text-xs text-zinc-800">{pl.name}</span>
                                <span className="text-[7px] font-bold text-green-600 ml-auto uppercase tracking-wider">Goal</span>
                              </div>
                            ))
                          }).flat()}
                          {(Array.isArray(match.yellowCards)?match.yellowCards:[]).map((pid:number)=>{
                            const pl=members.find((m:any)=>m.id===pid)
                            if(!pl) return null
                            return(
                              <div key={`y-${pid}`} className="flex items-center gap-3 pl-0 relative">
                                <div className="w-[19px] h-[19px] rounded-full bg-yellow-100 border-2 border-yellow-400 shrink-0 z-10"/>
                                <span className="font-bold text-xs text-zinc-800">{pl.name}</span>
                                <span className="text-[7px] font-bold text-yellow-700 ml-auto uppercase tracking-wider">Yellow</span>
                              </div>
                            )
                          })}
                          {(Array.isArray(match.redCards)?match.redCards:[]).map((pid:number)=>{
                            const pl=members.find((m:any)=>m.id===pid)
                            if(!pl) return null
                            return(
                              <div key={`r-${pid}`} className="flex items-center gap-3 pl-0 relative">
                                <div className="w-[19px] h-[19px] rounded-full bg-red-100 border-2 border-red-500 shrink-0 z-10"/>
                                <span className="font-bold text-xs text-zinc-800">{pl.name}</span>
                                <span className="text-[7px] font-bold text-red-700 ml-auto uppercase tracking-wider">Red</span>
                              </div>
                            )
                          })}
                          {(Array.isArray(match.subs)?match.subs:[]).map((s:any,i:number)=>{
                            const on=members.find((m:any)=>m.id===s.out)?.name||'?'
                            const inn=members.find((m:any)=>m.id===s["in"])?.name||'?'
                            return(
                              <div key={`s-${i}`} className="flex items-center gap-3 pl-0 relative">
                                <div className="w-[19px] h-[19px] rounded-full bg-blue-100 border-2 border-blue-400 flex items-center justify-center shrink-0 z-10 text-[9px]">↔</div>
                                <span className="font-bold text-xs text-zinc-800"><span className="text-red-500 line-through">{on}</span> → <span className="text-green-600">{inn}</span></span>
                                <span className="text-[7px] font-bold text-blue-700 ml-auto uppercase tracking-wider">Sub</span>
                              </div>
                            )
                          })}
                          {(Array.isArray(match.opponentScorers)?match.opponentScorers:[]).map((s:any,si:number)=>Array.from({length:s.goals}).map((_,gi)=>(
                            <div key={`og-${si}-${gi}`} className="flex items-center gap-3 pl-0 relative">
                              <div className="w-[19px] h-[19px] rounded-full bg-orange-100 border-2 border-orange-400 flex items-center justify-center shrink-0 z-10 text-[9px]">⚽</div>
                              <span className="font-bold text-xs text-zinc-600">{s.name}</span>
                              <span className="text-[7px] font-bold text-orange-600 ml-auto uppercase tracking-wider">{match.opponent} Goal</span>
                            </div>
                          ))).flat()}
                          {(Array.isArray(match.opponentYellowCards)?match.opponentYellowCards:[]).map((name:string,i:number)=>(
                            <div key={`oy-${i}`} className="flex items-center gap-3 pl-0 relative">
                              <div className="w-[19px] h-[19px] rounded-full bg-yellow-100 border-2 border-yellow-400 shrink-0 z-10"/>
                              <span className="font-bold text-xs text-zinc-600">{name}</span>
                              <span className="text-[7px] font-bold text-yellow-700 ml-auto uppercase tracking-wider">{match.opponent} Yellow</span>
                            </div>
                          ))}
                          {(Array.isArray(match.opponentRedCards)?match.opponentRedCards:[]).map((name:string,i:number)=>(
                            <div key={`or-${i}`} className="flex items-center gap-3 pl-0 relative">
                              <div className="w-[19px] h-[19px] rounded-full bg-red-100 border-2 border-red-500 shrink-0 z-10"/>
                              <span className="font-bold text-xs text-zinc-600">{name}</span>
                              <span className="text-[7px] font-bold text-red-700 ml-auto uppercase tracking-wider">{match.opponent} Red</span>
                            </div>
                          ))}
                          {(Array.isArray(match.opponentSubs)?match.opponentSubs:[]).map((s:any,i:number)=>(
                            <div key={`os-${i}`} className="flex items-center gap-3 pl-0 relative">
                              <div className="w-[19px] h-[19px] rounded-full bg-blue-100 border-2 border-blue-400 flex items-center justify-center shrink-0 z-10 text-[9px]">↔</div>
                              <span className="font-bold text-xs text-zinc-600"><span className="text-red-500 line-through">{s.out}</span> → <span className="text-green-600">{s.in}</span></span>
                              <span className="text-[7px] font-bold text-blue-700 ml-auto uppercase tracking-wider">{match.opponent} Sub</span>
                            </div>
                          ))}
                          {(!match.scorers||match.scorers.length===0)&&(!match.yellowCards||match.yellowCards.length===0)&&(!match.redCards||match.redCards.length===0)&&(!match.subs||match.subs.length===0)&&(!match.opponentScorers||match.opponentScorers.length===0)&&(!match.opponentYellowCards||match.opponentYellowCards.length===0)&&(!match.opponentRedCards||match.opponentRedCards.length===0)&&(!match.opponentSubs||match.opponentSubs.length===0)&&(
                            <div className="flex items-center justify-center py-6"><span className="text-[9px] text-zinc-400 font-semibold">No match events recorded</span></div>
                          )}
                      </div>
                    </div>

                      {/* Match Stats */}
                      {(match.tunisiaPossession||match.opponentPossession||match.tunisiaShots||match.opponentShots)&&<div className="bg-white rounded-xl border border-zinc-200 p-3">
                        <p className="text-[7px] font-black uppercase tracking-wider text-zinc-500 mb-2">MATCH STATS</p>
                        <div className="grid grid-cols-[1fr_auto_1fr] gap-x-3 gap-y-1 text-[10px] font-bold items-center">
                          <span className="text-right text-zinc-700">{match.tunisiaPossession||"0"}%</span><span className="text-[7px] font-black text-zinc-400">Poss.</span><span className="text-zinc-500">{match.opponentPossession||"0"}%</span>
                          <span className="text-right text-zinc-700">{match.tunisiaShots||"0"}</span><span className="text-[7px] font-black text-zinc-400">Shots</span><span className="text-zinc-500">{match.opponentShots||"0"}</span>
                          <span className="text-right text-zinc-700">{match.tunisiaShotsOnTarget||"0"}</span><span className="text-[7px] font-black text-zinc-400">SOT</span><span className="text-zinc-500">{match.opponentShotsOnTarget||"0"}</span>
                          <span className="text-right text-zinc-700">{match.tunisiaCorners||"0"}</span><span className="text-[7px] font-black text-zinc-400">Corn.</span><span className="text-zinc-500">{match.opponentCorners||"0"}</span>
                          <span className="text-right text-zinc-700">{match.tunisiaFouls||"0"}</span><span className="text-[7px] font-black text-zinc-400">Fouls</span><span className="text-zinc-500">{match.opponentFouls||"0"}</span>
                        </div>
                      </div>}

                      {/* Match Sheet + Delete */}
                      <div className="flex justify-end gap-2">
                        <button onClick={()=>setMatchSheetTarget(match)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E30613]/30 bg-white text-[#E30613] text-[8px] font-black uppercase tracking-wider hover:bg-[#E30613] hover:text-white transition-all"><ClipboardCheck size={11}/> Match Sheet</button>
                        {p.deleteMatch&&<button onClick={async()=>{if(await askConfirm(tr.history.delete+" this match?")){setMatches(m=>m.filter((x:any)=>x.id!==match.id));setSelMatch(null)}}} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-200 bg-white text-red-500 text-[8px] font-black uppercase tracking-wider hover:bg-red-600 hover:text-white transition-all"><Trash2 size={11}/> {tr.history.delete}</button>}
                      </div>
                    </div>
                  )}
                </div>
              )})}
            </div>
          </div>
        </div>
      )})()}

      {/* ═══════════════════════════════════════════
          OFFICIAL MATCH SHEET (FEUILLE DE MATCH)
      ═══════════════════════════════════════════ */}
      {matchSheetTarget&&(()=>{
        const match=matchSheetTarget
        const xi=(match.squad||[]).slice(0,11).map((pid:number)=>members.find((m:any)=>m.id===pid)).filter(Boolean)
        const bench=(match.squad||[]).slice(11).map((pid:number)=>members.find((m:any)=>m.id===pid)).filter(Boolean)
        const staff=members.filter((m:any)=>m.role==="COACHES"&&m.teamCategory===match.teamCategory)
        const rowFor=(pos:string)=>{
          const P=(pos||"").toUpperCase()
          if(P.includes("GOAL")||P==="GK") return 0
          if(P.includes("DEF")||P==="CB"||P==="LB"||P==="RB") return 1
          if(P.includes("MID")) return 2
          return 3
        }
        const rows=[[],[],[],[]] as any[][]
        xi.forEach((pl:any)=>rows[rowFor(pl.position)].push(pl))
        const scorerNames=(match.scorers||[]).flatMap((s:any)=>{
          const pl=members.find((m:any)=>m.id===s.playerId); return pl?Array(s.goals).fill(pl.name):[]
        })
        return(
        <div className="fixed inset-0 z-[250] flex items-center justify-center p-2 sm:p-4 bg-black/85 match-sheet-print">
          <div className="w-full max-w-3xl bg-[#FAF8F3] text-zinc-900 rounded-2xl shadow-2xl flex flex-col max-h-[92vh]">

            <div className="match-sheet-print-btn flex items-center justify-between px-6 py-3 border-b border-zinc-100 bg-[#F3F0E8] rounded-t-2xl sticky top-0">
              <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Official Match Sheet</span>
              <div className="flex gap-2">
                <button onClick={()=>window.print()} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#E30613] text-white text-[9px] font-black uppercase tracking-wider hover:bg-red-700 transition-all">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                  Print / Save PDF
                </button>
                <button onClick={()=>setMatchSheetTarget(null)} title="Close" className="w-8 h-8 rounded-lg bg-zinc-100 hover:bg-red-50 hover:text-red-500 flex items-center justify-center transition-all"><X size={15} className="text-zinc-400"/></button>
              </div>
            </div>

            <div className="p-6 sm:p-8 overflow-y-auto flex-1">
              {/* Document header */}
              <div className="flex items-center gap-4 pb-4 border-b-2 border-zinc-900">
                <img src="/ftf-logo.png" className="h-16 w-16 object-contain" alt=""/>
                <div className="flex-1">
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">Fédération Tunisienne de Football</p>
                  <h1 className="text-xl font-black uppercase italic tracking-tight">Official Match Sheet</h1>
                  <p className="text-[10px] font-bold text-[#E30613] uppercase tracking-wider">{catLabel(match.teamCategory)} {match.competition&&`· ${match.competition}`}</p>
                </div>
                <div className="text-right text-[10px] font-bold text-zinc-500">
                  <p>{fmtDateWords(match.date)||"—"}</p>
                  <p className="mt-0.5">{match.venue||"Venue TBC"}</p>
                </div>
              </div>

              {/* Score line */}
              <div className="flex items-center justify-center gap-6 py-6">
                <span className="text-lg font-black uppercase">Tunisia</span>
                <span className="text-3xl font-black bg-zinc-900 text-white px-6 py-1.5 rounded-xl tracking-widest">{match.result||"—"}</span>
                <span className="text-lg font-black uppercase">{match.opponent||"Opponent"}</span>
              </div>

              {/* Formation pitch — uses the real saved formation if this match was built in Squad Lab, else auto-groups by position */}
              {match.formation&&match.formationSlots?(
                <div className="mb-6">
                  <FormationPitch formation={match.formation} slots={match.formationSlots} members={members} compact/>
                </div>
              ):(
              <div className="relative rounded-2xl overflow-hidden mb-6 max-h-56" style={{background:"linear-gradient(180deg, #2d7a3a 0%, #26692f 100%)", aspectRatio:"16/6"}}>
                <div className="absolute inset-3 border-2 border-white/40 rounded-lg"/>
                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-24 h-24 rounded-full border-2 border-white/40"/>
                <div className="absolute left-1/2 top-3 -translate-x-1/2 w-1/3 h-[15%] border-2 border-t-0 border-white/40"/>
                <div className="absolute left-1/2 bottom-3 -translate-x-1/2 w-1/3 h-[15%] border-2 border-b-0 border-white/40"/>
                <div className="absolute inset-0 flex flex-col-reverse justify-around py-2">
                  {rows.map((row,ri)=>row.length>0&&(
                    <div key={ri} className="flex items-center justify-center gap-3 flex-wrap px-4">
                      {row.map((pl:any,i:number)=>{
                        const overallIdx=xi.findIndex((x:any)=>x.id===pl.id)
                        return(
                          <div key={pl.id} className="flex flex-col items-center">
                            <div className="w-6 h-6 rounded-full bg-white text-zinc-900 flex items-center justify-center text-[9px] font-black shadow-md">{overallIdx+1}</div>
                            <span className="text-[7px] font-bold text-white mt-0.5 max-w-[60px] text-center truncate drop-shadow">{pl.name}</span>
                          </div>
                        )
                      })}
                    </div>
                  ))}
                </div>
              </div>
              )}

              {/* XI / Bench / Staff */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div>
                  <p className="text-[9px] font-black uppercase tracking-wider text-[#E30613] mb-2 pb-1 border-b border-zinc-200">Starting XI</p>
                  <div className="space-y-1">
                    {xi.map((pl:any,i:number)=>(
                      <div key={pl.id} className="flex items-center gap-2 text-[11px]">
                        <span className="font-black text-zinc-300 w-4">{i+1}</span>
                        <span className="font-bold truncate">{pl.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-[9px] font-black uppercase tracking-wider text-amber-600 mb-2 pb-1 border-b border-zinc-200">Substitutes</p>
                  <div className="space-y-1">
                    {bench.map((pl:any,i:number)=>(
                      <div key={pl.id} className="flex items-center gap-2 text-[11px]">
                        <span className="font-black text-zinc-300 w-4">{i+12}</span>
                        <span className="font-bold truncate">{pl.name}</span>
                      </div>
                    ))}
                    {bench.length===0&&<p className="text-[10px] text-zinc-300 italic">None listed</p>}
                  </div>
                </div>
                <div>
                  <p className="text-[9px] font-black uppercase tracking-wider text-zinc-500 mb-2 pb-1 border-b border-zinc-200">Coaching Staff</p>
                  <div className="space-y-1">
                    {staff.map((pl:any)=>(
                      <div key={pl.id} className="text-[11px]">
                        <span className="font-bold truncate block">{pl.name}</span>
                        <span className="text-[9px] text-zinc-400">{pl.position}</span>
                      </div>
                    ))}
                    {staff.length===0&&<p className="text-[10px] text-zinc-300 italic">None listed</p>}
                  </div>
                </div>
              </div>

              {/* Cards & scorers */}
              <div className="grid grid-cols-3 gap-4 mb-6 text-[11px]">
                <div className="bg-zinc-50 rounded-lg p-3">
                  <p className="text-[9px] font-black uppercase tracking-wider text-zinc-500 mb-1.5">Scorers</p>
                  {scorerNames.length>0?scorerNames.map((n:string,i:number)=><p key={i} className="font-bold">⚽ {n}</p>):<p className="text-zinc-300 italic text-[10px]">None</p>}
                </div>
                <div className="bg-zinc-50 rounded-lg p-3">
                  <p className="text-[9px] font-black uppercase tracking-wider text-yellow-600 mb-1.5">Yellow Cards</p>
                  {(match.yellowCards||[]).length>0?(match.yellowCards||[]).map((pid:number)=>{const pl=members.find((m:any)=>m.id===pid);return pl&&<p key={pid} className="font-bold">🟨 {pl.name}</p>}):<p className="text-zinc-300 italic text-[10px]">None</p>}
                </div>
                <div className="bg-zinc-50 rounded-lg p-3">
                  <p className="text-[9px] font-black uppercase tracking-wider text-red-600 mb-1.5">Red Cards</p>
                  {(match.redCards||[]).length>0?(match.redCards||[]).map((pid:number)=>{const pl=members.find((m:any)=>m.id===pid);return pl&&<p key={pid} className="font-bold">🟥 {pl.name}</p>}):<p className="text-zinc-300 italic text-[10px]">None</p>}
                </div>
              </div>

              {/* Signatures */}
              <div className="grid grid-cols-2 gap-8 pt-8 mt-4 border-t border-zinc-200">
                <div>
                  <div className="h-12 border-b border-zinc-300"/>
                  <p className="text-[9px] font-bold uppercase tracking-wider text-zinc-400 mt-1">Team Official Signature</p>
                </div>
                <div>
                  <div className="h-12 border-b border-zinc-300"/>
                  <p className="text-[9px] font-bold uppercase tracking-wider text-zinc-400 mt-1">Match Referee Signature</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )})()}

      {/* ═══════════════════════════════════════════
          QUICK SCOUT MODAL
      ═══════════════════════════════════════════ */}
      {scoutLoading&&(
        <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-black/60">
          <div className="p-6 rounded-2xl border border-zinc-200 bg-white shadow-2xl flex items-center gap-3">
            <Loader2 size={16} className="animate-spin text-[#E30613]"/>
            <span className="text-[10px] font-black uppercase tracking-wider">Searching Wikipedia + database...</span>
          </div>
        </div>
      )}
      {scoutPlayer&&scoutResult&&(
        <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-black/60" onClick={()=>{setScoutPlayer(null);setScoutResult(null)}}>
          <div className="w-full max-w-lg rounded-2xl border border-zinc-200 bg-[#FAF8F3] shadow-2xl" onClick={e=>e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-zinc-200">
              <h3 className="text-[11px] font-black uppercase tracking-[0.2em] flex items-center gap-2">
                <Sparkles size={14} className="text-[#E30613]"/> AI Search · {scoutPlayer.name.split(' ').slice(-1)}
              </h3>
              <button onClick={()=>{setScoutPlayer(null);setScoutResult(null)}} className="p-1.5 rounded-lg hover:bg-zinc-100 text-zinc-400 transition-colors">
                <X size={14}/>
              </button>
            </div>
            <div className="p-4 space-y-2 max-h-[60vh] overflow-y-auto">
              {scoutResult.sources?.wikipedia&&(
                <div className="p-2.5 rounded-xl border border-blue-200 bg-blue-50 text-blue-600 text-[8px] font-bold flex items-center gap-2 mb-3">
                  <Globe size={11}/> Wikipedia found data for <span className="underline">{scoutResult.sources.wikipedia.name}</span>
                </div>
              )}
              <div className="flex gap-2 mb-3">
                <button onClick={selectAllDbScout} className="flex-1 py-1.5 rounded-xl border text-[8px] font-black uppercase tracking-wider transition-all hover:bg-green-600 hover:text-white hover:border-green-600 bg-green-600/10 border-green-600/30 text-green-600">Use Database</button>
                {scoutResult.sources?.wikipedia&&(
                  <button onClick={selectAllWikiScout} className="flex-1 py-1.5 rounded-xl border text-[8px] font-black uppercase tracking-wider transition-all hover:bg-blue-600 hover:text-white hover:border-blue-600 bg-blue-600/10 border-blue-600/30 text-blue-600">Use Wikipedia</button>
                )}
              </div>
              <div className="grid grid-cols-[auto_1fr_1fr_auto] gap-x-3 gap-y-1.5 text-[9px] font-bold">
                <div className="text-zinc-500 uppercase tracking-wider">Field</div>
                <div className="text-green-500 uppercase tracking-wider text-center">Database</div>
                {scoutResult.sources?.wikipedia&&<div className="text-blue-500 uppercase tracking-wider text-center">Wikipedia</div>}
                <div className="text-zinc-500 uppercase tracking-wider text-right">Use</div>
                {scoutFields.map(f=>{
                  const dbData=scoutResult.sources?.database
                  const wikiData=scoutResult.sources?.wikipedia
                  const dbVal=f.key==="history"?`${dbData?.history?.length||0} entries`:(dbData?.[f.key]!=null&&dbData[f.key]!==""?String(dbData[f.key]):"—")
                  const wikiVal=wikiData?(f.key==="history"?`${wikiData?.history?.length||0} entries`:(wikiData?.[f.key]!=null&&wikiData[f.key]!==""?String(wikiData[f.key]):"—")):null
                  const checked=scoutUseWiki[f.key]
                  return(
                    <React.Fragment key={f.key}>
                      <div className="text-zinc-400">{f.label}</div>
                      <div className="text-center px-1.5 py-1 rounded-lg border border-green-200 bg-green-50">{dbVal}</div>
                      {wikiData&&(
                        <div className={`text-center px-1.5 py-1 rounded-lg border ${checked?'border-blue-300 bg-blue-50':'border-zinc-200'}`}>{wikiVal}</div>
                      )}
                      <button onClick={()=>toggleScoutField(f.key)} disabled={f.key==="assists"&&!wikiData?.assists}
                        className={`p-1 rounded-lg border transition-all text-center ${checked?'bg-blue-600 border-blue-600 text-white':'border-zinc-300 text-zinc-400 hover:border-zinc-400'} ${f.key==="assists"&&!wikiData?.assists?'opacity-30 cursor-not-allowed':'cursor-pointer'}`}>
                        {checked?<Check size={10}/>:null}
                      </button>
                    </React.Fragment>
                  )
                })}
              </div>
            </div>
            <div className="flex gap-2 p-4 border-t border-zinc-200">
              <button onClick={()=>{setScoutPlayer(null);setScoutResult(null)}} className="flex-1 py-2.5 rounded-xl border border-zinc-300 text-zinc-500 hover:border-zinc-400 text-[9px] font-black uppercase tracking-wider">Cancel</button>
              <button onClick={applyCardScout} className="flex-1 py-2.5 rounded-xl border text-[9px] font-black uppercase tracking-wider bg-[#E30613] border-[#E30613] text-white hover:bg-red-700">Apply Selection</button>
            </div>
          </div>
        </div>
      )}
      {/* Keyframes for alive UI */}
      <style>{`@keyframes fadeUp{0%{opacity:0;transform:translateY(20px)}100%{opacity:1;transform:translateY(0)}}@keyframes shine{0%{transform:translateX(-100%) skewX(-20deg)}100%{transform:translateX(200%) skewX(-20deg)}}`}</style>
    </main>
  )
}
