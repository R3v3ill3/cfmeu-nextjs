import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { FourPointRating, AssessmentType } from '@/types/assessments'

// GET - Get 4-point rating distribution statistics
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabase()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const employerType = searchParams.get('employer_type')
    const trade = searchParams.get('trade')
    const location = searchParams.get('location')
    const dateRange = searchParams.get('date_range')
    const includeAssessmentBreakdown = searchParams.get('include_assessment_breakdown') === 'true'

    // Base query for employers with current 4-point ratings
    let employerQuery = supabase
      .from('employers')
      .select(`
        id,
        name,
        employer_type,
        primary_trade,
        location,
        current_4_point_rating,
        rating_confidence,
        rating_calculation_date
      `)
      .not('current_4_point_rating', 'is', null)

    // Apply filters
    if (employerType) {
      employerQuery = employerQuery.eq('employer_type', employerType)
    }
    if (trade) {
      employerQuery = employerQuery.eq('primary_trade', trade)
    }
    if (location) {
      employerQuery = employerQuery.ilike('location', `%${location}%`)
    }

    if (dateRange) {
      const [startDate, endDate] = dateRange.split(',')
      if (startDate && endDate) {
        employerQuery = employerQuery
          .gte('rating_calculation_date', startDate)
          .lte('rating_calculation_date', endDate)
      }
    }

    const { data: employers, error: employerError } = await employerQuery

    if (employerError) {
      console.error('Error fetching employer ratings:', employerError)
      return NextResponse.json(
        { success: false, message: 'Failed to fetch rating data', error: employerError.message },
        { status: 500 }
      )
    }

    if (!employers || employers.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          overall_distribution: {
            1: 0, 2: 0, 3: 0, 4: 0
          },
          total_employers: 0,
          average_rating: 0,
          statistics: {
            median: 0,
            mode: 0,
            standard_deviation: 0,
          },
          breakdowns: {},
        },
      })
    }

    // Calculate overall distribution
    const overallDistribution: Record<FourPointRating, number> = { 1: 0, 2: 0, 3: 0, 4: 0 }
    const ratings = employers.map(e => e.current_4_point_rating)
    const confidences = employers.map(e => e.rating_confidence || 0)

    employers.forEach(employer => {
      const rating = employer.current_4_point_rating as FourPointRating
      overallDistribution[rating]++
    })

    // Calculate statistics
    const totalEmployers = employers.length
    const averageRating = ratings.reduce((sum, rating) => sum + rating, 0) / totalEmployers
    const averageConfidence = confidences.reduce((sum, conf) => sum + conf, 0) / totalEmployers

    // Calculate median
    const sortedRatings = [...ratings].sort((a, b) => a - b)
    const median = totalEmployers % 2 === 0
      ? (sortedRatings[totalEmployers / 2 - 1] + sortedRatings[totalEmployers / 2]) / 2
      : sortedRatings[Math.floor(totalEmployers / 2)]

    // Calculate mode
    const ratingCounts = ratings.reduce((acc, rating) => {
      acc[rating] = (acc[rating] || 0) + 1
      return acc
    }, {} as Record<number, number>)
    const mode = Number(Object.entries(ratingCounts).reduce((a, b) =>
      ratingCounts[Number(a[0])] > ratingCounts[Number(b[0])] ? a : b
    )[0])

    // Calculate standard deviation
    const variance = ratings.reduce((sum, rating) => {
      return sum + Math.pow(rating - averageRating, 2)
    }, 0) / totalEmployers
    const standardDeviation = Math.sqrt(variance)

    // Create breakdowns
    const breakdowns: any = {}

    // Breakdown by employer type
    const typeBreakdown: Record<string, Record<FourPointRating, number>> = {}
    employers.forEach(employer => {
      const type = employer.employer_type || 'unknown'
      if (!typeBreakdown[type]) {
        typeBreakdown[type] = { 1: 0, 2: 0, 3: 0, 4: 0 }
      }
      typeBreakdown[type][employer.current_4_point_rating as FourPointRating]++
    })
    breakdowns.by_employer_type = typeBreakdown

    // Breakdown by trade
    const tradeBreakdown: Record<string, Record<FourPointRating, number>> = {}
    employers.forEach(employer => {
      const trade = employer.primary_trade || 'unknown'
      if (!tradeBreakdown[trade]) {
        tradeBreakdown[trade] = { 1: 0, 2: 0, 3: 0, 4: 0 }
      }
      tradeBreakdown[trade][employer.current_4_point_rating as FourPointRating]++
    })
    breakdowns.by_trade = tradeBreakdown

    // Breakdown by confidence level ranges
    const confidenceBreakdown = {
      high: { 1: 0, 2: 0, 3: 0, 4: 0 },    // 80-100%
      medium: { 1: 0, 2: 0, 3: 0, 4: 0 },  // 50-79%
      low: { 1: 0, 2: 0, 3: 0, 4: 0 },     // 0-49%
    }

    employers.forEach(employer => {
      const confidence = employer.rating_confidence || 0
      const rating = employer.current_4_point_rating as FourPointRating

      if (confidence >= 80) {
        confidenceBreakdown.high[rating]++
      } else if (confidence >= 50) {
        confidenceBreakdown.medium[rating]++
      } else {
        confidenceBreakdown.low[rating]++
      }
    })
    breakdowns.by_confidence_level = confidenceBreakdown

    // Breakdown by recency of calculation
    const now = new Date()
    const recencyBreakdown = {
      recent: { 1: 0, 2: 0, 3: 0, 4: 0 },      // Last 30 days
      moderate: { 1: 0, 2: 0, 3: 0, 4: 0 },   // 31-90 days
      old: { 1: 0, 2: 0, 3: 0, 4: 0 },        // 91+ days
    }

    employers.forEach(employer => {
      if (!employer.rating_calculation_date) return

      const daysSinceCalculation = Math.floor(
        (now.getTime() - new Date(employer.rating_calculation_date).getTime()) / (1000 * 60 * 60 * 24)
      )

      const rating = employer.current_4_point_rating as FourPointRating

      if (daysSinceCalculation <= 30) {
        recencyBreakdown.recent[rating]++
      } else if (daysSinceCalculation <= 90) {
        recencyBreakdown.moderate[rating]++
      } else {
        recencyBreakdown.old[rating]++
      }
    })
    breakdowns.by_recency = recencyBreakdown

    // Assessment type breakdown (if requested)
    if (includeAssessmentBreakdown) {
      const assessmentBreakdown: Record<AssessmentType, Record<FourPointRating, number>> = {
        union_respect: { 1: 0, 2: 0, 3: 0, 4: 0 },
        safety_4_point: { 1: 0, 2: 0, 3: 0, 4: 0 },
        subcontractor_use: { 1: 0, 2: 0, 3: 0, 4: 0 },
        role_specific: { 1: 0, 2: 0, 3: 0, 4: 0 },
      }

      // Get latest assessments for each employer
      for (const assessmentType of Object.keys(assessmentBreakdown) as AssessmentType[]) {
        const tableName = {
          union_respect: 'union_respect_assessments',
          safety_4_point: 'safety_4_point_assessments',
          subcontractor_use: 'subcontractor_use_assessments',
          role_specific: 'role_specific_assessments',
        }[assessmentType]

        const { data: assessments } = await supabase
          .from(tableName)
          .select('employer_id, overall_score, overall_safety_score, overall_subcontractor_score, overall_role_score')
          .eq('status', 'approved')
          .in('employer_id', employers.map(e => e.id))

        if (assessments) {
          assessments.forEach(assessment => {
            let score = 0
            switch (assessmentType) {
              case 'union_respect':
                score = assessment.overall_score
                break
              case 'safety_4_point':
                score = assessment.overall_safety_score
                break
              case 'subcontractor_use':
                score = assessment.overall_subcontractor_score
                break
              case 'role_specific':
                score = assessment.overall_role_score
                break
            }
            if (score >= 1 && score <= 4) {
              assessmentBreakdown[assessmentType][score as FourPointRating]++
            }
          })
        }
      }

      breakdowns.by_assessment_type = assessmentBreakdown
    }

    // Calculate trends (compare with previous period if date range provided)
    let trends = null
    if (dateRange) {
      const [startDate, endDate] = dateRange.split(',')
      if (startDate && endDate) {
        const previousPeriodStart = new Date(startDate)
        previousPeriodStart.setDate(previousPeriodStart.getDate() - 30)
        const previousPeriodEnd = new Date(startDate)

        const { data: previousEmployers } = await supabase
          .from('employers')
          .select('current_4_point_rating')
          .not('current_4_point_rating', 'is', null)
          .gte('rating_calculation_date', previousPeriodStart.toISOString())
          .lte('rating_calculation_date', previousPeriodEnd.toISOString())

        if (previousEmployers && previousEmployers.length > 0) {
          const previousRatings = previousEmployers.map(e => e.current_4_point_rating)
          const previousAverage = previousRatings.reduce((sum, rating) => sum + rating, 0) / previousRatings.length

          trends = {
            previous_period_average: Math.round(previousAverage * 100) / 100,
            current_period_average: Math.round(averageRating * 100) / 100,
            change: Math.round((averageRating - previousAverage) * 100) / 100,
            change_percentage: previousAverage > 0
              ? Math.round(((averageRating - previousAverage) / previousAverage) * 10000) / 100
              : 0,
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        overall_distribution: overallDistribution,
        total_employers: totalEmployers,
        average_rating: Math.round(averageRating * 100) / 100,
        average_confidence: Math.round(averageConfidence),
        statistics: {
          median: Math.round(median * 100) / 100,
          mode: mode,
          standard_deviation: Math.round(standardDeviation * 100) / 100,
        },
        breakdowns,
        trends,
        rating_labels: {
          1: 'Poor',
          2: 'Fair',
          3: 'Good',
          4: 'Excellent'
        },
        confidence_labels: {
          high: 'High (80-100%)',
          medium: 'Medium (50-79%)',
          low: 'Low (0-49%)'
        },
        recency_labels: {
          recent: 'Recent (≤30 days)',
          moderate: 'Moderate (31-90 days)',
          old: 'Old (>90 days)'
        }
      },
      metadata: {
        filters_applied: {
          employer_type: employerType,
          trade: trade,
          location: location,
          date_range: dateRange,
        },
        generated_at: new Date().toISOString(),
      },
    })
  } catch (error) {
    console.error('Error in rating distribution GET:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
}