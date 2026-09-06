"use client"
import React from 'react'
import { flagCodeFor } from '@/lib/country-flags'

interface CountryFlagProps {
  name?: string | null
  className?: string
  rounded?: boolean
  title?: string
}

export const CountryFlag: React.FC<CountryFlagProps> = ({ name, className, rounded = true, title }) => {
  const code = flagCodeFor(name)
  if (!code) return null
  return (
    <img
      src={`/flags/4x3/${code}.svg`}
      alt={name || code}
      title={title ?? (name || code)}
      loading="lazy"
      className={`inline-block object-cover align-middle w-7 h-[17px] ${rounded ? 'rounded-[3px]' : ''} ring-1 ring-white/15 shrink-0 ${className || ''}`}
    />
  )
}