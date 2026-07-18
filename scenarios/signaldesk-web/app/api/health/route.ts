import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({ status: 'ok', service: 'signaldesk-scenario', environment: 'disposable-staging', timestamp: new Date().toISOString() })
}
