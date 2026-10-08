"use client"
import { Suspense, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Key } from "lucide-react"
import { useTranslate } from "@/lib/language-context"
import { completePasswordReset } from "@/lib/app-data"
import ThemeToggle from "@/components/theme-toggle"
import LanguageToggle from "@/components/language-toggle"

const FIELD = "w-full rounded-xl border border-white/15 bg-black/25 pl-11 pr-4 py-3.5 text-sm font-semibold text-white outline-none transition-all placeholder:text-white/30 focus:border-[#e3062c]/80 focus:ring-4 focus:ring-[#e3062c]/15"
const BTN = "mt-5 w-full rounded-xl bg-gradient-to-r from-[#e3062c] to-[#8f0319] py-3.5 text-[10px] font-black uppercase tracking-[.2em] text-white shadow-lg shadow-[#e3062c]/30 hover:shadow-[#e3062c]/50 transition-all disabled:opacity-45"

const MIN = 6

function ResetPasswordForm() {
  const { tr } = useTranslate()
  const params = useSearchParams()
  const token = params.get("token") || ""
  const [pw, setPw] = useState("")
  const [confirm, setConfirm] = useState("")
  const [err, setErr] = useState("")
  const [done, setDone] = useState(false)
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    if (!token) { setErr(tr.resetPassword.invalidLink); return }
    if (pw.length < MIN) { setErr(tr.passwordModal.mustBeAtLeast.replace("{min}", String(MIN))); return }
    if (pw !== confirm) { setErr(tr.passwordModal.dontMatch); return }
    setBusy(true); setErr("")
    const { error } = await completePasswordReset(token, pw)
    setBusy(false)
    if (error) { setErr(error); return }
    setDone(true)
  }

  return (
    <div className="fed-screen min-h-screen relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-[#0a1c38] via-[#0a1322] to-[#0a1c38]" />
      <div className="absolute inset-0 bg-[radial-gradient(1100px_480px_at_50%_-180px,rgba(23,60,120,.18),transparent_70%)] pointer-events-none" />
      <ThemeToggle className="absolute top-6 right-16 z-20" />
      <LanguageToggle className="absolute top-6 right-4 z-20" />
      <div className="relative z-10 flex flex-col items-center justify-center min-h-[100dvh] w-full px-6 py-10">
        <div className="flex flex-col items-center text-center">
          <img src="/ftf-logo.png" className="h-20 drop-shadow-[0_12px_30px_rgba(0,0,0,.55)]" alt="" />
          <h2 className="mt-8 text-3xl font-black uppercase tracking-tight text-white leading-none">{tr.resetPassword.title}</h2>
        </div>
        <div className="backdrop-blur-xl bg-white/[0.07] border border-white/15 rounded-3xl shadow-2xl p-7 mt-8 w-full max-w-md">
          <div className="h-[3px] w-14 mx-auto rounded-full bg-gradient-to-r from-[#e3062c] to-[#f6c744]" />
          {!token ? (
            <p className="mt-6 text-center text-[11px] font-bold text-white/85">{tr.resetPassword.invalidLink}</p>
          ) : done ? (
            <div className="mt-6 space-y-4 text-center">
              <p className="text-[11px] font-bold text-white/85 leading-relaxed">{tr.resetPassword.success}</p>
              <a href="/" className={`${BTN} inline-block text-center`}>{tr.resetPassword.goToLogin}</a>
            </div>
          ) : (
            <div className="mt-6 space-y-3.5">
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40"><Key size={15} /></span>
                <input type="password" autoComplete="new-password" placeholder={tr.resetPassword.newPassword} value={pw} onChange={e => setPw(e.target.value)} className={FIELD} />
              </div>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40"><Key size={15} /></span>
                <input type="password" autoComplete="new-password" placeholder={tr.passwordModal.confirmPassword} value={confirm} onChange={e => setConfirm(e.target.value)} onKeyDown={e => e.key === "Enter" && submit()} className={FIELD} />
              </div>
              {err && <p className="text-center text-[9px] font-black uppercase tracking-widest text-[#ff4f66]">{err}</p>}
              <button disabled={busy} onClick={submit} className={BTN}>{busy ? "..." : tr.resetPassword.save}</button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm />
    </Suspense>
  )
}
