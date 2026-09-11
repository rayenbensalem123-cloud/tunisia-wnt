'use client'
import { useTheme } from '@/lib/theme-context'
import { Sun, Moon } from 'lucide-react'

export default function ThemeToggle({ className = '' }: { className?: string }) {
  const { theme, toggle } = useTheme()
  return (
    <button
      onClick={toggle}
      title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
      className={`p-3 rounded-xl border border-[rgba(var(--line-rgb),.22)] bg-[var(--c-panel3)] text-[var(--c-textBlue2)] hover:text-[#f6c744] hover:border-[#f6c744]/40 hover:shadow-[0_0_18px_rgba(246,199,68,.12)] transition-all ${className}`}
    >
      {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  )
}
