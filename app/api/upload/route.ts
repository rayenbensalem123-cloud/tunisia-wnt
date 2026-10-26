import { NextResponse } from 'next/server'
import { requireActiveUser, safeError, userClient } from '@/lib/api-auth'
import { checkRateLimit } from '@/lib/rate-limit'

const MAX_BYTES = 5 * 1024 * 1024 // 5 MB
const ALLOWED_FOLDERS = ['passports', 'images', 'camps', 'camps-reports', 'camps-photos', 'league', 'medical']

const IMAGE_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/avif': 'avif',
}
const DOC_TYPES: Record<string, string> = {
  'application/pdf': 'pdf',
}

function folderAllows(folder: string, type: string): boolean {
  if (folder === 'images' || folder === 'camps' || folder === 'camps-photos' || folder === 'league') return type in IMAGE_TYPES
  // IRM pictures and PDF reports: both belong under medical/.
  if (folder === 'passports' || folder === 'medical') return type in IMAGE_TYPES || type in DOC_TYPES
  return type in DOC_TYPES
}

export async function POST(req: Request) {
  try {
    const auth = await requireActiveUser(req)
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

    const rl = await checkRateLimit(`upload:${auth.caller.id}`, { limit: 20, windowSeconds: 300 })
    if (!rl.ok) {
      return NextResponse.json({ error: 'Too many requests, please try again shortly' }, { status: 429 })
    }

    const len = Number(req.headers.get('content-length') || '0')
    if (len > MAX_BYTES) {
      return NextResponse.json({ error: 'File too large (max 5 MB)' }, { status: 413 })
    }

    const form = await req.formData()
    const file = form.get('file')
    if (!(file instanceof File)) return NextResponse.json({ error: 'No file' }, { status: 400 })

    if (file.size === 0) return NextResponse.json({ error: 'Empty file' }, { status: 400 })
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: 'File too large (max 5 MB)' }, { status: 413 })
    }

    // Trust the sniffed MIME type, never the client-supplied extension.
    const type = (file.type || '').toLowerCase().split(';')[0].trim()
    const ext = IMAGE_TYPES[type] ?? DOC_TYPES[type]
    if (!ext) {
      return NextResponse.json({ error: 'Unsupported file type' }, { status: 415 })
    }

    const folderRaw = (form.get('folder') as string) || 'images'
    const folder = ALLOWED_FOLDERS.includes(folderRaw) ? folderRaw : 'images'
    if (!folderAllows(folder, type)) {
      return NextResponse.json({ error: 'File type not allowed in this folder' }, { status: 415 })
    }

    // Ligue Féminine images live under league/<team id>/ (a club's own player photos)
    // or league/logos/ (team logos, admin only). The server decides the prefix from
    // WHO is calling, never from a client-supplied path.
    // Medical documents always land under medical/<member id>/ so both the
    // storage policy (has_permission('editMedical')) and the signed-URL read
    // rule in /api/image can tell whose file a path belongs to.
    let prefix = folder
    if (folder === 'medical') {
      const memberId = Number(form.get('memberId'))
      if (!Number.isInteger(memberId) || memberId <= 0) return NextResponse.json({ error: 'Player required' }, { status: 400 })
      prefix = `medical/${memberId}`
    }
    if (folder === 'league') {
      if (auth.caller.role === 'club') {
        const { data: me } = await userClient(auth.token).from('profiles').select('league_team_id').eq('id', auth.caller.id).maybeSingle()
        if (!me?.league_team_id) return NextResponse.json({ error: 'No club linked to this account' }, { status: 403 })
        if (form.get('logo') === '1') return NextResponse.json({ error: 'Only an admin can change a logo' }, { status: 403 })
        prefix = `league/${me.league_team_id}`
      } else if (auth.caller.role === 'admin') {
        if (form.get('logo') === '1') {
          prefix = 'league/logos'
        } else {
          const tid = Number(form.get('leagueTeamId'))
          if (!Number.isInteger(tid) || tid <= 0) return NextResponse.json({ error: 'Team required' }, { status: 400 })
          prefix = `league/${tid}`
        }
      } else {
        return NextResponse.json({ error: 'Not allowed' }, { status: 403 })
      }
    }

    const safeName = (file.name || 'upload').replace(/[^a-zA-Z0-9._-]/g, '_').slice(-60)
    const path = `${prefix}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeName}`

    // Uploaded as the CALLER, so the storage RLS policy
    // (has_permission('addPlayer')) is what actually authorises this write.
    const { error } = await userClient(auth.token).storage.from('members').upload(path, file, {
      contentType: type,
      upsert: false,
    })
    if (error) {
      return NextResponse.json({ error: safeError(error, 'upload failed') }, { status: 400 })
    }

    // The bucket is private (passport data must never be public). Store a
    // stable path in the database and mint short-lived signed URLs on demand
    // - never persist an expiring signed URL.
    return NextResponse.json({ url: `/api/image?path=${encodeURIComponent(path)}`, path })
  } catch (e) {
    return NextResponse.json({ error: safeError(e) }, { status: 500 })
  }
}
