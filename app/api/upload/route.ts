import { NextResponse } from 'next/server'
import { requireActiveUser, safeError, userClient } from '@/lib/api-auth'

const MAX_BYTES = 5 * 1024 * 1024 // 5 MB
const ALLOWED_FOLDERS = ['passports', 'images', 'camps', 'camps-reports', 'camps-photos']

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
  if (folder === 'images' || folder === 'camps' || folder === 'camps-photos') return type in IMAGE_TYPES
  if (folder === 'passports') return type in IMAGE_TYPES || type in DOC_TYPES
  return type in DOC_TYPES
}

export async function POST(req: Request) {
  try {
    const auth = await requireActiveUser(req)
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

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

    const safeName = (file.name || 'upload').replace(/[^a-zA-Z0-9._-]/g, '_').slice(-60)
    const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeName}`

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
