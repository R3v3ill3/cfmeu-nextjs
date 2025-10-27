import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { featureFlags } from '@/lib/feature-flags';

interface AssessmentDetailResponse {
  assessment: {
    id: string;
    type: 'union_respect' | 'safety' | 'subcontractor' | 'expertise';
    assessment_date: string;
    overall_rating: number;
    overall_rating_label: 'red' | 'amber' | 'yellow' | 'green';
    confidence_level: 'very_high' | 'high' | 'medium' | 'low';
    project_name?: string;
    organiser_name?: string;
    assessment_method?: string;
    notes?: string;
    // Union Respect specific fields
    union_respect_details?: {
      right_of_entry_rating?: number;
      delegate_accommodation_rating?: number;
      access_to_information_rating?: number;
      access_to_inductions_rating?: number;
      eba_status_rating?: number;
    };
    // Safety specific fields
    safety_details?: {
      hsr_respect_rating?: number;
      general_safety_rating?: number;
      safety_incidents_rating?: number;
    };
    // Subcontractor specific fields
    subcontractor_details?: {
      usage_rating?: number;
      subcontractor_count?: number;
      subcontractor_percentage?: number;
      assessment_basis?: string;
    };
    // Expertise specific fields
    expertise_details?: {
      assessment_basis?: string;
      knowledge_beyond_projects?: boolean;
      union_relationship_quality?: string;
      industry_reputation?: string;
    };
  };
  created_at: string;
  updated_at: string;
}

export async function GET(request: NextRequest, { params }: { params: { assessmentId: string } }) {
  try {
    const { assessmentId } = params;

    // Check if 4-point rating system is enabled
    if (!featureFlags.isEnabled('RATING_SYSTEM_4POINT')) {
      return NextResponse.json({ error: '4-point rating system not enabled' }, { status: 404 });
    }

    const supabase = await createServerSupabase();

    // First, try to find in union respect assessments
    let { data: unionRespectAssessment, error: unionRespectError } = await supabase
      .from('union_respect_assessments_4point')
      .select(`
        id,
        assessment_date,
        overall_union_respect_rating,
        confidence_level,
        assessment_method,
        notes,
        right_of_entry_rating,
        delegate_accommodation_rating,
        access_to_information_rating,
        access_to_inductions_rating,
        eba_status_rating,
        projects(name),
        profiles(name)
      `)
      .eq('id', assessmentId)
      .maybeSingle();

    if (!unionRespectError && unionRespectAssessment) {
      const response: AssessmentDetailResponse = {
        assessment: {
          id: unionRespectAssessment.id,
          type: 'union_respect',
          assessment_date: unionRespectAssessment.assessment_date,
          overall_rating: unionRespectAssessment.overall_union_respect_rating,
          overall_rating_label: convertNumericToLabel(unionRespectAssessment.overall_union_respect_rating),
          confidence_level: unionRespectAssessment.confidence_level as any,
          project_name: (unionRespectAssessment.projects as any)?.name,
          assessment_method: unionRespectAssessment.assessment_method,
          notes: unionRespectAssessment.notes,
          union_respect_details: {
            right_of_entry_rating: unionRespectAssessment.right_of_entry_rating,
            delegate_accommodation_rating: unionRespectAssessment.delegate_accommodation_rating,
            access_to_information_rating: unionRespectAssessment.access_to_information_rating,
            access_to_inductions_rating: unionRespectAssessment.access_to_inductions_rating,
            eba_status_rating: unionRespectAssessment.eba_status_rating
          }
        },
        created_at: unionRespectAssessment.created_at,
        updated_at: unionRespectAssessment.updated_at
      };
      return NextResponse.json(response);
    }

    // Try safety assessments
    let { data: safetyAssessment, error: safetyError } = await supabase
      .from('safety_assessments_4point')
      .select(`
        id,
        assessment_date,
        overall_safety_rating,
        confidence_level,
        assessment_method,
        notes,
        hsr_respect_rating,
        general_safety_rating,
        safety_incidents_rating,
        projects(name),
        profiles(name)
      `)
      .eq('id', assessmentId)
      .maybeSingle();

    if (!safetyError && safetyAssessment) {
      const response: AssessmentDetailResponse = {
        assessment: {
          id: safetyAssessment.id,
          type: 'safety',
          assessment_date: safetyAssessment.assessment_date,
          overall_rating: safetyAssessment.overall_safety_rating,
          overall_rating_label: convertNumericToLabel(safetyAssessment.overall_safety_rating),
          confidence_level: safetyAssessment.confidence_level as any,
          project_name: (safetyAssessment.projects as any)?.name,
          assessment_method: safetyAssessment.assessment_method,
          notes: safetyAssessment.notes,
          safety_details: {
            hsr_respect_rating: safetyAssessment.hsr_respect_rating,
            general_safety_rating: safetyAssessment.general_safety_rating,
            safety_incidents_rating: safetyAssessment.safety_incidents_rating
          }
        },
        created_at: safetyAssessment.created_at,
        updated_at: safetyAssessment.updated_at
      };
      return NextResponse.json(response);
    }

    // Try subcontractor assessments
    let { data: subcontractorAssessment, error: subcontractorError } = await supabase
      .from('subcontractor_assessments_4point')
      .select(`
        id,
        assessment_date,
        usage_rating,
        confidence_level,
        assessment_basis,
        notes,
        subcontractor_count,
        subcontractor_percentage,
        projects(name),
        profiles(name)
      `)
      .eq('id', assessmentId)
      .maybeSingle();

    if (!subcontractorError && subcontractorAssessment) {
      const response: AssessmentDetailResponse = {
        assessment: {
          id: subcontractorAssessment.id,
          type: 'subcontractor',
          assessment_date: subcontractorAssessment.assessment_date,
          overall_rating: subcontractorAssessment.usage_rating,
          overall_rating_label: convertNumericToLabel(subcontractorAssessment.usage_rating),
          confidence_level: subcontractorAssessment.confidence_level as any,
          project_name: (subcontractorAssessment.projects as any)?.name,
          assessment_method: subcontractorAssessment.assessment_basis,
          notes: subcontractorAssessment.notes,
          subcontractor_details: {
            usage_rating: subcontractorAssessment.usage_rating,
            subcontractor_count: subcontractorAssessment.subcontractor_count,
            subcontractor_percentage: subcontractorAssessment.subcontractor_percentage,
            assessment_basis: subcontractorAssessment.assessment_basis
          }
        },
        created_at: subcontractorAssessment.created_at,
        updated_at: subcontractorAssessment.updated_at
      };
      return NextResponse.json(response);
    }

    // Try organiser expertise assessments
    let { data: expertiseAssessment, error: expertiseError } = await supabase
      .from('organiser_overall_expertise_ratings')
      .select(`
        id,
        assessment_date,
        overall_score,
        overall_rating,
        confidence_level,
        assessment_basis,
        assessment_context,
        knowledge_beyond_projects,
        industry_reputation,
        union_relationship_quality,
        profiles(name)
      `)
      .eq('id', assessmentId)
      .maybeSingle();

    if (!expertiseError && expertiseAssessment) {
      const response: AssessmentDetailResponse = {
        assessment: {
          id: expertiseAssessment.id,
          type: 'expertise',
          assessment_date: expertiseAssessment.assessment_date,
          overall_rating: expertiseAssessment.overall_score || 1,
          overall_rating_label: expertiseAssessment.overall_rating || convertNumericToLabel(expertiseAssessment.overall_score || 1),
          confidence_level: expertiseAssessment.confidence_level as any,
          organiser_name: (expertiseAssessment.profiles as any)?.name,
          notes: expertiseAssessment.assessment_context,
          expertise_details: {
            assessment_basis: expertiseAssessment.assessment_basis,
            knowledge_beyond_projects: expertiseAssessment.knowledge_beyond_projects,
            union_relationship_quality: expertiseAssessment.union_relationship_quality,
            industry_reputation: expertiseAssessment.industry_reputation
          }
        },
        created_at: expertiseAssessment.created_at,
        updated_at: expertiseAssessment.updated_at
      };
      return NextResponse.json(response);
    }

    // If no assessment found
    return NextResponse.json({ error: 'Assessment not found' }, { status: 404 });

  } catch (error) {
    console.error('Error fetching assessment details:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

function convertNumericToLabel(rating: number): 'red' | 'amber' | 'yellow' | 'green' {
  switch (Math.round(rating)) {
    case 1: return 'red';
    case 2: return 'amber';
    case 3: return 'yellow';
    case 4: return 'green';
    default: return 'red';
  }
}
