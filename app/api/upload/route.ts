import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function POST(req: Request) {
  const form = await req.formData()
  const file = form.get('file') as File
  if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 })
  const ext = file.name.split('.').pop()
  const path = `images/${Date.now()}.${ext}`
  const { data, error } = await supabaseAdmin.storage.from('members').upload(path, file, { upsert: true })
  if (error) {
    console.error('upload err', error)
    return NextResponse.json({ url: '/placeholder.jpg', path: '' })
  }
  const { data: urlData } = supabaseAdmin.storage.from('members').getPublicUrl(path)
  return NextResponse.json({ url: urlData.publicUrl, path })
}
