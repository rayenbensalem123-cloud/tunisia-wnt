'use client'
import { useTheme } from '@/lib/theme-context'
import { Sun, Moon } from 'lucide-react'

export default function ThemeToggle({ className = '' }: { className?: string }) {
  const { theme, toggle } = useTheme()
  return (
    <button
      onClick={toggle}
      title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
      className={`p-2.5 rounded-lg border border-[rgba(246,199,68,.28)] bg-[#0d1f3c]/70 backdrop-blur-md text-[#f6c744] hover:text-[#0c1f3d] hover:bg-[#f6c744] hover:border-[#f6c744] hover:shadow-[0_0_16px_rgba(246,199,68,.25)] transition-all ${className}`}
    >
      {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  )
}
