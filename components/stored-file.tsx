'use client'
import React, { useEffect, useState } from 'react'
import { signedImageUrl } from '@/lib/app-data'

// Files in the private bucket are stored as "/api/image?path=…". Browsers can't send the auth header
// for <img>/<a>, so resolve them to short-lived signed URLs instead.
const pathOf = (url: string): string | null => {
  const m = /^\/api\/image\?path=(.+)$/.exec(url || '')
  return m ? decodeURIComponent(m[1]) : null
}

export async function resolveStored(url: string): Promise<string> {
  const p = pathOf(url)
  return p ? await signedImageUrl(p) : url
}

export function StoredImg({ url, ...rest }: { url: string } & React.ImgHTMLAttributes<HTMLImageElement>) {
  const [src, setSrc] = useState('')
  useEffect(() => { let ok = true; resolveStored(url).then((u) => { if (ok) setSrc(u) }); return () => { ok = false } }, [url])
  // eslint-disable-next-line @next/next/no-img-element
  return src ? <img src={src} {...rest} /> : <div className={rest.className} style={{ minHeight: 140, background: 'rgba(128,128,128,.12)' }} />
}

export function openStored(url: string) {
  const w = window.open('', '_blank')
  resolveStored(url).then((u) => { if (u && w) w.location.href = u; else w?.close() })
}
