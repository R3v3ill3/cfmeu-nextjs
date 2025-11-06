import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { employerIds } = body

    if (!employerIds || !Array.isArray(employerIds) || employerIds.length === 0) {
      return NextResponse.json({ error: 'employerIds array is required' }, { status: 400 })
    }

    const supabase = await createServerSupabase()

    // Fetch current active ratings for all employers
    const { data: ratings, error } = await supabase
      .from('employer_final_ratings')
      .select(`
        id,
        employer_id,
        rating_date,
        final_rating,
        final_score,
        project_based_rating,
        project_based_score,
        project_data_quality,
        projects_included,
        latest_project_date,
        expertise_based_rating,
        expertise_based_score,
        expertise_confidence,
        expertise_assessments_included,
        latest_expertise_date,
        eba_status,
        rating_discrepancy,
        discrepancy_level,
        reconciliation_method,
        required_dispute_resolution,
        overall_confidence,
        data_completeness_score,
        rating_stability_score,
        rating_status,
        review_required,
        review_reason,
        next_review_date,
        expiry_date,
        project_weight,
        expertise_weight,
        eba_weight,
        calculation_method_id,
        custom_adjustment,
        adjustment_reason,
        calculated_by,
        approved_by,
        approved_at,
        approval_notes,
        is_active,
        created_at,
        updated_at,
        created_by,
        updated_by
      `)
      .in('employer_id', employerIds)
      .eq('is_active', true)
      .order('rating_date', { ascending: false })

    if (error) {
      console.error('Error fetching batch ratings:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Create a map of employer_id to rating (most recent for each employer)
    const ratingsMap: Record<string, any> = {}
    ;(ratings || []).forEach((rating: any) => {
      if (!ratingsMap[rating.employer_id]) {
        ratingsMap[rating.employer_id] = rating
      }
    })

    return NextResponse.json({ ratings: ratingsMap })
  } catch (err: any) {
    console.error('Error in batch ratings endpoint:', err)
    return NextResponse.json({ error: err?.message || 'Unexpected error' }, { status: 500 })
  }
}





