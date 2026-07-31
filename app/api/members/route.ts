import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET() {
  try {
    const { data, error } = await supabase.from('app_data').select('data').eq('key', 'members').single()
    if (error || !data) return NextResponse.json(null)
    return NextResponse.json(data.data)
  } catch {
    return NextResponse.json(null)
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { error } = await supabase.from('app_data').upsert({ key: 'members', data: body }, { onConflict: 'key' })
    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('members save err', e)
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 })
  }
}
