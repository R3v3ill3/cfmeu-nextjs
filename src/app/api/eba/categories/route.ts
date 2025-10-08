import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { KEY_CONTRACTOR_TRADES_SET } from '@/constants/keyContractorTrades'

export const dynamic = 'force-dynamic'

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
    const keyOnly = (searchParams.get('keyOnly') || '').toLowerCase() === 'true'

    const supabase = await createServerSupabase()
    let query = supabase
      .from('v_contractor_categories_catalog')
      .select('category_type, category_code, category_name, current_employers, total_employers')

    if (typeParam) {
      query = query.eq('category_type', typeParam)
    }

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    let categories = (data || []) as Array<any>
    if (keyOnly) {
      if (typeParam && typeParam !== 'trade') {
        categories = []
      } else {
        categories = categories.filter((c) => c.category_type === 'trade' && KEY_CONTRACTOR_TRADES_SET.has(c.category_code))
      }
    }

    return NextResponse.json({ data: categories })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Unexpected error' }, { status: 500 })
  }
}


