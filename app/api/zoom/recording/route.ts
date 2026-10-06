import { NextResponse } from 'next/server'
import { requireActiveUser, can, safeError, userClient } from '@/lib/api-auth'
import { zoomConfigured, zoomGetRecordingUrl } from '@/lib/zoom'

export const dynamic = 'force-dynamic'

// Pulled on demand (a "Check for recording" button), not via webhook — a
// Zoom webhook needs a public verification handshake and a stored secret
// token, which is more moving parts than a federation admin clicking a
// button the day after a meeting. Can be upgraded to a webhook later
// without changing the meetings table.
export async function POST(req: Request) {
  try {
    const auth = await requireActiveUser(req)
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
    if (!can(auth.caller, 'manageMeetings')) {
      return NextResponse.json({ error: 'Not permitted' }, { status: 403 })
    }
    if (!zoomConfigured()) {
      return NextResponse.json({ error: 'Zoom integration not configured.' }, { status: 503 })
    }

    const body = await req.json().catch(() => ({}))
    const meetingId = Number(body.meetingId)
    if (!meetingId) return NextResponse.json({ error: 'Missing meetingId' }, { status: 400 })

    const asCaller = userClient(auth.token)
    const { data: row, error: fetchErr } = await asCaller.from('meetings').select('zoom_meeting_id').eq('id', meetingId).maybeSingle()
    if (fetchErr || !row?.zoom_meeting_id) return NextResponse.json({ error: 'Meeting not found' }, { status: 404 })

    const url = await zoomGetRecordingUrl(row.zoom_meeting_id)
    if (!url) return NextResponse.json({ recordingUrl: null, message: 'No recording available yet' })

    const { error: updateErr } = await asCaller.from('meetings').update({ recording_url: url, status: 'recorded' }).eq('id', meetingId)
    if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 400 })

    return NextResponse.json({ recordingUrl: url })
  } catch (e) {
    return NextResponse.json({ error: safeError(e, 'Failed to check recording') }, { status: 500 })
  }
}
