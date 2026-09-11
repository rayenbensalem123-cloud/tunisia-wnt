import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function POST(req: Request) {
  const form = await req.formData()
  const file = form.get('file') as File
  if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 })
  const ext = file.name.split('.').pop() || 'bin'
  const folderRaw = (form.get('folder') as string) || 'images'
  const allowed = ['passports', 'images', 'camps', 'camps-reports', 'camps-photos']
  const folder = allowed.includes(folderRaw) ? folderRaw : 'images'
  const path = `${folder}/${Date.now()}.${ext}`
  const { data, error } = await supabaseAdmin.storage.from('members').upload(path, file, { contentType: file.type || undefined })
  if (error) {
    console.error('upload err', error)
    return NextResponse.json({ error: error.message || 'upload failed' }, { status: 200 })
  }
  const { data: urlData } = supabaseAdmin.storage.from('members').getPublicUrl(path)
  return NextResponse.json({ url: urlData.publicUrl, path })
}
