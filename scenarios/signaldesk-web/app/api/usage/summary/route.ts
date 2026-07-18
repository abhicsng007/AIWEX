import { NextRequest, NextResponse } from 'next/server'
import { usageSummary } from '../../../../lib/usage'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const workspaceId = request.nextUrl.searchParams.get('workspaceId')
  if (!workspaceId || !/^[a-z0-9-]{3,80}$/i.test(workspaceId)) {
    return NextResponse.json({ error: 'workspaceId must be a 3-80 character slug' }, { status: 400 })
  }
  return NextResponse.json(usageSummary(workspaceId), {
    headers: { 'Cache-Control': 'private, max-age=0, must-revalidate' },
  })
}
