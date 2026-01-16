import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { fetchEbaEmployersData } from '@/lib/eba/ebaEmployersData'

export const dynamic = 'force-dynamic'

function parseBool(value: string | null, fallback: boolean): boolean {
  if (value === null) return fallback
  const v = value.toLowerCase()
  if (v === 'true' || v === '1' || v === 'yes') return true
  if (v === 'false' || v === '0' || v === 'no') return false
  return fallback
}

function mapCategoryType(t: string | null): 'contractor_role' | 'trade' | null {
  if (!t) return null
  if (t === 'role' || t === 'contractor_role') return 'contractor_role'
  if (t === 'trade') return 'trade'
  return null
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const typeParam = mapCategoryType(searchParams.get('type'))
    const code = searchParams.get('code') || undefined
    const currentOnly = parseBool(searchParams.get('currentOnly'), true)
    const includeDerived = parseBool(searchParams.get('includeDerived'), true)
    const includeManual = parseBool(searchParams.get('includeManual'), true)
    const keyOnly = parseBool(searchParams.get('keyOnly'), false)
    const includeExtendedData = parseBool(searchParams.get('includeExtendedData'), false)
    const includePatchData = parseBool(searchParams.get('includePatchData'), false)

    if (!includeDerived && !includeManual) {
      return NextResponse.json({ data: [] })
    }

    const supabase = await createServerSupabase()
    const data = await fetchEbaEmployersData(
      supabase,
      {
        typeParam,
        code,
        currentOnly,
        includeDerived,
        includeManual,
        keyOnly,
        includeExtendedData,
        includePatchData,
      },
      'non-eba'
    )

    return NextResponse.json({ data })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Unexpected error' }, { status: 500 })
  }
}
