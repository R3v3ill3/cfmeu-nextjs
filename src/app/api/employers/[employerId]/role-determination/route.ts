import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { EmployerRole } from '@/types/assessments'

// GET - Determine employer role based on data analysis
export async function GET(
  request: NextRequest,
  { params }: { params: { employerId: string } }
) {
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

    // Check if employer exists
    const { data: employer, error: employerError } = await supabase
      .from('employers')
      .select('*')
      .eq('id', params.employerId)
      .single()

    if (employerError || !employer) {
      return NextResponse.json(
        { success: false, message: 'Employer not found' },
        { status: 404 }
      )
    }

    // If employer already has a role, return it with confidence
    if (employer.employer_type) {
      return NextResponse.json({
        success: true,
        data: {
          determined_role: employer.employer_type,
          confidence: 100,
          determination_method: 'existing_record',
          evidence: {
            existing_role: employer.employer_type,
            last_updated: employer.updated_at,
          },
        },
      })
    }

    // Analyze employer data to determine role
    const analysis = await analyzeEmployerRole(supabase, params.employerId)

    // Get role-specific assessment history
    const { data: roleAssessments } = await supabase
      .from('role_specific_assessments')
      .select('employer_role, role_confidence_level')
      .eq('employer_id', params.employerId)
      .order('assessment_date', { ascending: false })
      .limit(5)

    // Combine analysis with assessment history
    const finalDetermination = combineAnalysisWithHistory(analysis, roleAssessments)

    return NextResponse.json({
      success: true,
      data: finalDetermination,
    })
  } catch (error) {
    console.error('Error in employer role determination:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST - Manually set or update employer role
export async function POST(
  request: NextRequest,
  { params }: { params: { employerId: string } }
) {
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

    // Check permissions
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || !['admin', 'organiser'].includes(profile.role)) {
      return NextResponse.json(
        { success: false, message: 'Insufficient permissions to set employer role' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { role, justification, evidence } = body

    if (!role || !Object.values(['head_contractor', 'subcontractor', 'trade_contractor', 'labour_hire', 'consultant', 'other']).includes(role)) {
      return NextResponse.json(
        { success: false, message: 'Invalid role specified' },
        { status: 400 }
      )
    }

    // Update employer role
    const { data: updatedEmployer, error } = await supabase
      .from('employers')
      .update({
        employer_type: role,
        updated_at: new Date().toISOString(),
      })
      .eq('id', params.employerId)
      .select()
      .single()

    if (error) {
      console.error('Error updating employer role:', error)
      return NextResponse.json(
        { success: false, message: 'Failed to update employer role', error: error.message },
        { status: 500 }
      )
    }

    // Log the role change for audit purposes
    await supabase
      .from('employer_role_changes')
      .insert({
        employer_id: params.employerId,
        previous_role: null,
        new_role: role,
        changed_by: user.id,
        justification: justification || 'Manual role assignment',
        evidence: evidence || {},
        change_date: new Date().toISOString(),
      })

    return NextResponse.json({
      success: true,
      message: 'Employer role updated successfully',
      data: {
        employer_id: params.employerId,
        new_role: role,
        updated_at: updatedEmployer.updated_at,
        changed_by: user.id,
      },
    })
  } catch (error) {
    console.error('Error in employer role update:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
}

async function analyzeEmployerRole(supabase: any, employerId: string): Promise<{
  determined_role: EmployerRole
  confidence: number
  determination_method: string
  evidence: any
}> {
  const evidence: any = {}
  let roleScores: Record<EmployerRole, number> = {
    head_contractor: 0,
    subcontractor: 0,
    trade_contractor: 0,
    labour_hire: 0,
    consultant: 0,
    other: 0,
  }

  // Analyze project involvement
  const { data: projects } = await supabase
    .from('project_employers')
    .select(`
      role_in_project,
      projects!inner(id, name, project_type, contract_value)
    `)
    .eq('employer_id', employerId)

  if (projects && projects.length > 0) {
    evidence.projects = {
      total_projects: projects.length,
      roles: projects.reduce((acc: any, p: any) => {
        acc[p.role_in_project] = (acc[p.role_in_project] || 0) + 1
        return acc
      }, {}),
      average_contract_value: projects.reduce((sum: number, p: any) => sum + (p.projects.contract_value || 0), 0) / projects.length,
    }

    // Score based on project roles
    projects.forEach((project: any) => {
      switch (project.role_in_project) {
        case 'head_contractor':
          roleScores.head_contractor += 3
          break
        case 'subcontractor':
          roleScores.subcontractor += 2
          roleScores.trade_contractor += 1
          break
        case 'trade_contractor':
          roleScores.trade_contractor += 3
          roleScores.subcontractor += 1
          break
        case 'labour_hire':
          roleScores.labour_hire += 3
          break
        case 'consultant':
          roleScores.consultant += 3
          break
      }
    })
  }

  // Analyze subcontractor relationships
  const { data: subcontractorRelationships } = await supabase
    .from('employer_subcontractor_relationships')
    .select('*')
    .or(`head_contractor_id.eq.${employerId},subcontractor_id.eq.${employerId}`)

  if (subcontractorRelationships && subcontractorRelationships.length > 0) {
    const asHeadContractor = subcontractorRelationships.filter(r => r.head_contractor_id === employerId).length
    const asSubcontractor = subcontractorRelationships.filter(r => r.subcontractor_id === employerId).length

    evidence.subcontractor_relationships = {
      as_head_contractor: asHeadContractor,
      as_subcontractor: asSubcontractor,
      total_relationships: subcontractorRelationships.length,
    }

    if (asHeadContractor > 0) {
      roleScores.head_contractor += asHeadContractor * 2
    }
    if (asSubcontractor > 0) {
      roleScores.subcontractor += asSubcontractor * 2
      roleScores.trade_contractor += asSubcontractor
    }
  }

  // Analyze worker relationships
  const { data: workerCount } = await supabase
    .from('workers')
    .select('id', { count: 'exact' })
    .eq('employer_id', employerId)

  if (workerCount !== null) {
    evidence.workers = {
      total_workers: workerCount,
    }

    if (workerCount > 50) {
      roleScores.labour_hire += 2
      roleScores.head_contractor += 1
    }
    if (workerCount > 200) {
      roleScores.labour_hire += 2
      roleScores.head_contractor += 2
    }
  }

  // Analyze employer name and ABN patterns
  const { data: employer } = await supabase
    .from('employers')
    .select('name, abn')
    .eq('id', employerId)
    .single()

  if (employer) {
    const name = employer.name.toLowerCase()

    // Keyword analysis
    const keywords = {
      head_contractor: ['construction', 'building', 'contractors', 'group', 'developments'],
      subcontractor: ['services', 'specialist', 'technical'],
      trade_contractor: ['plumbing', 'electrical', 'carpentry', 'concrete', 'civil'],
      labour_hire: ['labour', 'personnel', 'staffing', 'workforce'],
      consultant: ['consulting', 'consultants', 'advisors', 'engineering'],
    }

    Object.entries(keywords).forEach(([role, words]) => {
      words.forEach(word => {
        if (name.includes(word)) {
          roleScores[role as EmployerRole] += 1
        }
      })
    })

    evidence.name_analysis = {
      name: employer.name,
      keywords_found: Object.entries(keywords)
        .filter(([_, words]) => words.some(word => name.includes(word)))
        .map(([role, words]) => ({
          role,
          words: words.filter(word => name.includes(word))
        })),
    }
  }

  // Determine the most likely role
  const maxScore = Math.max(...Object.values(roleScores))
  const determinedRoles = Object.entries(roleScores)
    .filter(([_, score]) => score === maxScore)
    .map(([role, _]) => role as EmployerRole)

  const determined_role = determinedRoles.length === 1 ? determinedRoles[0] : 'other'
  const confidence = maxScore > 0 ? Math.min(100, (maxScore / 10) * 100) : 0

  return {
    determined_role,
    confidence,
    determination_method: 'automated_analysis',
    evidence: {
      ...evidence,
      role_scores: roleScores,
      max_score: maxScore,
    },
  }
}

function combineAnalysisWithHistory(
  analysis: any,
  roleAssessments: any[]
): {
  determined_role: EmployerRole
  confidence: number
  determination_method: string
  evidence: any
} {
  if (roleAssessments && roleAssessments.length > 0) {
    // Weight recent assessments more heavily
    const recentAssessments = roleAssessments.slice(0, 3)
    const assessmentRoleCounts = recentAssessments.reduce((acc: any, assessment: any) => {
      acc[assessment.employer_role] = (acc[assessment.employer_role] || 0) + 1
      return acc
    }, {})

    const mostCommonRole = Object.entries(assessmentRoleCounts)
      .sort(([, a], [, b]) => (b as number) - (a as number))[0][0] as EmployerRole

    const assessmentConfidence = recentAssessments.reduce((sum: number, assessment: any) =>
      sum + assessment.role_confidence_level, 0) / recentAssessments.length

    // If assessments agree and have high confidence, use them
    if (assessmentConfidence > 70 && recentAssessments.length >= 2) {
      return {
        determined_role: mostCommonRole,
        confidence: Math.round(assessmentConfidence),
        determination_method: 'assessment_history',
        evidence: {
          ...analysis.evidence,
          assessment_history: {
            recent_assessments: recentAssessments.length,
            most_common_role: mostCommonRole,
            assessment_confidence: Math.round(assessmentConfidence),
            role_distribution: assessmentRoleCounts,
          },
        },
      }
    }
  }

  // Fall back to automated analysis
  return analysis
}