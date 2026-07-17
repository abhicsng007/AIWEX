import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let client: SupabaseClient | null | undefined

/** Server-only Supabase client. Never expose SUPABASE_SERVICE_ROLE_KEY to the browser. */
export function getSupabaseAdmin() {
  if (client !== undefined) return client
  const url = process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceRoleKey) {
    client = null
    return client
  }
  client = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })
  return client
}

export function isSupabaseConfigured() { return getSupabaseAdmin() !== null }
