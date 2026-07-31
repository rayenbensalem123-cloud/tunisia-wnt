import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const path = searchParams.get('path')
  if (!path) return NextResponse.json({ error: 'Missing path' }, { status: 400 })

  // If it's a full URL (old Blob private URL), try to fetch and serve it
  if (path.startsWith('http')) {
    try {
      const res = await fetch(path, { headers: { authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}` } })
      if (res.ok) {
        const buffer = Buffer.from(await res.arrayBuffer())
        return new NextResponse(buffer, {
          headers: { 'Content-Type': res.headers.get('content-type') || 'image/jpeg', 'Cache-Control': 'public, max-age=31536000, immutable' },
        })
      }
    } catch {}
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Redirect to Supabase public URL for new images
  const publicUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/members/${path}`
  return NextResponse.redirect(publicUrl)
}
