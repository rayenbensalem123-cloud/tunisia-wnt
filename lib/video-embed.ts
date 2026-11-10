// Turns a pasted address into something the browser can play.
//   iframe : YouTube (watch, youtu.be, shorts, live), Vimeo, Twitch
//   file   : a direct .mp4 / .webm / .mov address, played in a <video> tag
// Anything else returns null so the form can reject it up front instead of
// saving a card that shows a broken player.

export type Playback = { type: 'iframe' | 'file'; src: string }

export function videoPlayback(raw: string, parentHost?: string): Playback | null {
  const s = (raw || '').trim()
  if (!s) return null
  let u: URL
  try { u = new URL(s) } catch { return null }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return null
  const host = u.hostname.replace(/^www\./, '')
  const seg = u.pathname.split('/').filter(Boolean)

  const yt = (id?: string) => (id && /^[\w-]{6,}$/.test(id) ? { type: 'iframe' as const, src: `https://www.youtube.com/embed/${id}?rel=0` } : null)

  if (host === 'youtu.be') return yt(seg[0])
  if (host === 'youtube.com' || host === 'm.youtube.com') {
    if (u.pathname === '/watch') return yt(u.searchParams.get('v') || undefined)
    if (seg[0] === 'embed' || seg[0] === 'shorts' || seg[0] === 'live') return yt(seg[1])
    return null
  }
  if (host === 'vimeo.com') return /^\d+$/.test(seg[0] || '') ? { type: 'iframe', src: `https://player.vimeo.com/video/${seg[0]}` } : null
  if (host === 'player.vimeo.com') return seg[0] === 'video' && /^\d+$/.test(seg[1] || '') ? { type: 'iframe', src: s } : null
  if (host === 'twitch.tv') {
    const parent = parentHost || (typeof window !== 'undefined' ? window.location.hostname : '')
    if (!parent) return null
    if (seg[0] === 'videos' && /^\d+$/.test(seg[1] || '')) return { type: 'iframe', src: `https://player.twitch.tv/?video=${seg[1]}&parent=${parent}` }
    if (seg.length === 1 && /^\w{3,25}$/.test(seg[0])) return { type: 'iframe', src: `https://player.twitch.tv/?channel=${seg[0]}&parent=${parent}` }
    return null
  }
  if (/\.(mp4|webm|mov)$/i.test(u.pathname)) return { type: 'file', src: s }
  return null
}
