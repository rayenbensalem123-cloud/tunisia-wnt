import { NextResponse } from 'next/server'
import { requireActiveUser, can, safeError, userClient } from '@/lib/api-auth'
import { zoomConfigured, zoomCreateMeeting } from '@/lib/zoom'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    const auth = await requireActiveUser(req)
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
    if (!can(auth.caller, 'manageMeetings')) {
      return NextResponse.json({ error: 'Not permitted' }, { status: 403 })
    }

    if (!zoomConfigured()) {
      return NextResponse.json(
        { error: 'Zoom integration not configured. Set ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID and ZOOM_CLIENT_SECRET (see supabase-meetings.sql for how to get them).' },
        { status: 503 }
      )
    }

    const body = await req.json().catch(() => ({}))
    const title = String(body.title || '').trim()
    const scheduledAt = String(body.scheduledAt || '').trim()
    const teamCategory = body.teamCategory ? String(body.teamCategory) : null
    if (!title) return NextResponse.json({ error: 'Missing title' }, { status: 400 })
    if (!scheduledAt || isNaN(new Date(scheduledAt).getTime())) {
      return NextResponse.json({ error: 'Missing or invalid scheduledAt' }, { status: 400 })
    }

    const zoom = await zoomCreateMeeting({ title, startTime: new Date(scheduledAt).toISOString() })

    const asCaller = userClient(auth.token)
    const { data, error } = await asCaller
      .from('meetings')
      .insert({
        title,
        team_category: teamCategory,
        scheduled_at: scheduledAt,
        zoom_meeting_id: zoom.id,
        join_url: zoom.joinUrl,
        start_url: zoom.startUrl,
        created_by: auth.caller.id,
        created_by_username: auth.caller.username,
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ meeting: data })
  } catch (e) {
    return NextResponse.json({ error: safeError(e, 'Failed to schedule meeting') }, { status: 500 })
  }
}
