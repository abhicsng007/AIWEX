import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/features/simulator/server/supabase'

const bucket = 'workspace-artifacts'
const maxBytes = 20 * 1024 * 1024

function unavailable() { return NextResponse.json({ error: 'Artifact storage is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.' }, { status: 503 }) }

export async function GET(request: NextRequest) {
  const organizationId = request.nextUrl.searchParams.get('organizationId')
  if (!organizationId) return NextResponse.json({ error: 'organizationId is required' }, { status: 400 })
  const supabase = getSupabaseAdmin()
  if (!supabase) return unavailable()
  const { data, error } = await supabase.from('workspace_artifacts').select('id, object_path, file_name, content_type, byte_size, created_at').eq('organization_id', organizationId).order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: `Could not list artifacts: ${error.message}` }, { status: 500 })
  const artifacts = await Promise.all((data || []).map(async (artifact) => {
    const { data: signed } = await supabase.storage.from(bucket).createSignedUrl(artifact.object_path, 60 * 15)
    return { id: artifact.id, path: artifact.object_path, name: artifact.file_name, type: artifact.content_type, size: artifact.byte_size, createdAt: artifact.created_at, url: signed?.signedUrl || null }
  }))
  return NextResponse.json({ artifacts })
}

export async function POST(request: NextRequest) {
  const supabase = getSupabaseAdmin()
  if (!supabase) return unavailable()
  const form = await request.formData()
  const organizationId = form.get('organizationId')
  const file = form.get('file')
  if (typeof organizationId !== 'string' || !organizationId || !(file instanceof File)) return NextResponse.json({ error: 'organizationId and file are required' }, { status: 400 })
  if (file.size === 0) return NextResponse.json({ error: 'Empty files cannot be uploaded' }, { status: 400 })
  if (file.size > maxBytes) return NextResponse.json({ error: 'Files must be 20 MB or smaller' }, { status: 413 })
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-160) || 'artifact'
  const objectPath = `${organizationId}/${crypto.randomUUID()}-${safeName}`
  const { error: uploadError } = await supabase.storage.from(bucket).upload(objectPath, file, { contentType: file.type || 'application/octet-stream', upsert: false })
  if (uploadError) return NextResponse.json({ error: `Could not upload artifact: ${uploadError.message}` }, { status: 500 })
  const { data, error: metadataError } = await supabase.from('workspace_artifacts').insert({ organization_id: organizationId, object_path: objectPath, file_name: file.name, content_type: file.type || 'application/octet-stream', byte_size: file.size }).select('id, created_at').single()
  if (metadataError) {
    await supabase.storage.from(bucket).remove([objectPath])
    return NextResponse.json({ error: `Could not store artifact metadata: ${metadataError.message}` }, { status: 500 })
  }
  const { data: signed } = await supabase.storage.from(bucket).createSignedUrl(objectPath, 60 * 15)
  return NextResponse.json({ artifact: { id: data.id, path: objectPath, name: file.name, type: file.type || 'application/octet-stream', size: file.size, createdAt: data.created_at, url: signed?.signedUrl || null } }, { status: 201 })
}
