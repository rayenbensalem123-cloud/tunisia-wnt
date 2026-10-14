import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { buildCampsIcs, campsForMember } from '@/lib/ics'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Personal camp calendar feed. Calendar apps can't send auth headers, so the
// secret token in the URL is the credential (same model as Google Calendar's
// private ICS address). Each feed only contains camps this person is called up to.
export async function GET(_req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token: raw } = await ctx.params
  const token = raw.replace(/\.ics$/i, '')
  if (!/^[0-9a-f]{48}$/.test(token)) return new NextResponse('Not found', { status: 404 })

  const { data: profile } = await supabaseAdmin
    .from('profiles').select('role, status, member_id').eq('calendar_token', token).maybeSingle()
  if (!profile || profile.status !== 'active') return new NextResponse('Not found', { status: 404 })

  const { data: camps } = await supabaseAdmin
    .from('camps').select('id,name,location,start_date,end_date,team_category,players,staff,updated_at')

  const mine = campsForMember(camps || [], profile.role, profile.member_id)
  return new NextResponse(buildCampsIcs(mine), {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'inline; filename="tunisia-wnt-camps.ics"',
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex',
    },
  })
}
