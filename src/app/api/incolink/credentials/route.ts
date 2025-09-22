import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { encryptWithEnvKey, decryptWithEnvKey } from '@/lib/crypto/secrets'

const ALLOWED_ROLES = ['organiser', 'lead_organiser', 'admin'] as const
type AllowedRole = typeof ALLOWED_ROLES[number]
const ROLE_SET = new Set<AllowedRole>(ALLOWED_ROLES)

const PROVIDER = 'incolink'
const KEY_ENV = 'INCOLINK_CREDENTIAL_KEY'

type SupabaseServerClient = Awaited<ReturnType<typeof createServerSupabase>>

export const dynamic = 'force-dynamic'

async function requireUserWithRole(): Promise<
  | { supabase: SupabaseServerClient; userId: string }
  | { supabase: SupabaseServerClient; response: NextResponse }
> {
  const supabase = await createServerSupabase()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { supabase, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, role')
    .eq('id', user.id)
    .maybeSingle()

  if (profileError) {
    console.error('Credentials profile load failed:', profileError)
    return { supabase, response: NextResponse.json({ error: 'Unable to load user profile' }, { status: 500 }) }
  }

  const role = profile?.role as AllowedRole | undefined
  if (!role || !ROLE_SET.has(role)) {
    return { supabase, response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }

  return { supabase, userId: user.id }
}

export async function GET() {
  const result = await requireUserWithRole()
  if ('response' in result) return result.response
  const { supabase, userId } = result

  const { data, error } = await supabase
    .from('user_external_credentials')
    .select('secret_encrypted, updated_at')
    .eq('user_id', userId)
    .eq('provider', PROVIDER)
    .maybeSingle()

  if (error && error.code !== 'PGRST116') {
    console.error('Failed to load stored Incolink credentials:', error)
    return NextResponse.json({ error: 'Unable to load stored credentials' }, { status: 500 })
  }

  if (!data) {
    return NextResponse.json({ hasCredentials: false })
  }

  let email: string | undefined
  try {
    const decrypted = decryptWithEnvKey(KEY_ENV, data.secret_encrypted)
    const parsed = JSON.parse(decrypted)
    email = parsed?.email
  } catch (err) {
    console.warn('Failed to decrypt stored Incolink credentials for metadata display:', err)
  }

  return NextResponse.json({
    hasCredentials: true,
    email: email || null,
    updatedAt: data.updated_at || null,
  })
}

export async function POST(request: NextRequest) {
  const result = await requireUserWithRole()
  if ('response' in result) return result.response
  const { supabase, userId } = result

  let payload: { email?: string; password?: string }
  try {
    payload = await request.json()
  } catch (error) {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 })
  }

  const email = payload.email?.trim()
  const password = payload.password?.trim()

  if (!email || !password) {
    return NextResponse.json({ error: 'Both email and password are required' }, { status: 400 })
  }

  const encrypted = encryptWithEnvKey(KEY_ENV, JSON.stringify({ email, password }))

  const updatedAt = new Date().toISOString()

  const { error } = await supabase
    .from('user_external_credentials')
    .upsert({
      user_id: userId,
      provider: PROVIDER,
      secret_encrypted: encrypted,
      updated_at: updatedAt,
    }, { onConflict: 'user_id,provider' })

  if (error) {
    console.error('Failed to store Incolink credentials:', error)
    return NextResponse.json({ error: 'Unable to store credentials' }, { status: 500 })
  }

  return NextResponse.json({ success: true, updatedAt })
}

export async function DELETE() {
  const result = await requireUserWithRole()
  if ('response' in result) return result.response
  const { supabase, userId } = result

  const { error } = await supabase
    .from('user_external_credentials')
    .delete()
    .eq('user_id', userId)
    .eq('provider', PROVIDER)

  if (error) {
    console.error('Failed to delete Incolink credentials:', error)
    return NextResponse.json({ error: 'Unable to delete credentials' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
