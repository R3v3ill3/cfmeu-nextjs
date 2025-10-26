import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { withRateLimit, RATE_LIMIT_PRESETS } from '@/lib/rateLimit';

// Role-based access control
const ALLOWED_ROLES = ['organiser', 'lead_organiser', 'admin'] as const;
type AllowedRole = typeof ALLOWED_ROLES[number];
const ROLE_SET = new Set<AllowedRole>(ALLOWED_ROLES);

export const dynamic = 'force-dynamic';

// TypeScript types
export interface WizardStepSubmission {
  wizard_step_id: string;
  step_response: any;
  response_value?: string;
  session_started_at: string;
}

export interface WizardSubmissionRequest {
  employer_id: string;
  wizard_session_id?: string;
  steps: WizardStepSubmission[];
  session_completed_at?: string;
  organiser_notes?: string;
}

export interface WizardSubmissionResponse {
  wizard_session_id: string;
  employer_id: string;
  organiser_id: string;
  session_date: string;
  total_score: number;
  final_rating: 'green' | 'amber' | 'red' | 'unknown';
  completion_percentage: number;
  time_spent_minutes: number;
  assessment_summary: string;
  key_factors: string[];
  confidence_level: 'high' | 'medium' | 'low' | 'very_low';
  is_complete: boolean;
  expires_date: string;
  steps_processed: number;
  steps_successful: number;
  created_expertise_rating_id?: string;
}

export interface WizardConfigurationResponse {
  steps: Array<{
    id: string;
    wizard_step: number;
    step_name: string;
    step_description: string;
    step_type: 'question' | 'info' | 'calculation';
    is_required: boolean;
    display_order: number;
    options?: Array<{
      id: string;
      option_value: string;
      option_text: string;
      score_impact: number;
      explanation: string;
      display_order: number;
    }>;
  }>;
  version: string;
  last_updated: string;
}

// GET handler - Get wizard configuration
async function getWizardConfigHandler(request: NextRequest) {
  try {
    const supabase = await createServerSupabase();

    // Authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Authorization
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Unable to load user profile' }, { status: 500 });
    }

    const role = profile.role as AllowedRole;
    if (!role || !ROLE_SET.has(role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get wizard configuration
    const { data: configSteps, error: configError } = await supabase
      .from('organiser_wizard_config')
      .select(`
        id,
        wizard_step,
        step_name,
        step_description,
        step_type,
        is_required,
        display_order,
        organiser_wizard_step_options(
          id,
          option_value,
          option_text,
          score_impact,
          explanation,
          display_order
        )
      `)
      .eq('is_active', true)
      .order('display_order', { ascending: true });

    if (configError) {
      console.error('Failed to fetch wizard configuration:', configError);
      return NextResponse.json({ error: 'Failed to fetch wizard configuration' }, { status: 500 });
    }

    // Transform data for response
    const steps = (configSteps || []).map((step: any) => ({
      id: step.id,
      wizard_step: step.wizard_step,
      step_name: step.step_name,
      step_description: step.step_description,
      step_type: step.step_type,
      is_required: step.is_required,
      display_order: step.display_order,
      options: step.organiser_wizard_step_options || [],
    }));

    const response: WizardConfigurationResponse = {
      steps,
      version: '1.0',
      last_updated: new Date().toISOString(),
    };

    // Add cache headers for configuration
    const headers = {
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200', // 1 hour cache
      'Content-Type': 'application/json',
    };

    return NextResponse.json(response, { headers });

  } catch (error) {
    console.error('Get wizard config API unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST handler - Submit wizard assessment
async function submitWizardHandler(request: NextRequest) {
  try {
    const supabase = await createServerSupabase();

    // Authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Authorization
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, role, first_name, surname')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Unable to load user profile' }, { status: 500 });
    }

    const role = profile.role as AllowedRole;
    if (!role || !ROLE_SET.has(role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Parse and validate request body
    const body: WizardSubmissionRequest = await request.json();

    if (!body.employer_id) {
      return NextResponse.json({ error: 'employer_id is required' }, { status: 400 });
    }

    if (!body.steps || !Array.isArray(body.steps) || body.steps.length === 0) {
      return NextResponse.json({ error: 'steps array is required and cannot be empty' }, { status: 400 });
    }

    // Validate employer exists
    const { data: employer, error: employerError } = await supabase
      .from('employers')
      .select('id, name')
      .eq('id', body.employer_id)
      .single();

    if (employerError || !employer) {
      return NextResponse.json({ error: 'Employer not found' }, { status: 404 });
    }

    // Generate wizard session ID if not provided
    const wizardSessionId = body.wizard_session_id || crypto.randomUUID();

    // Validate each step
    const wizardStepIds = body.steps.map(step => step.wizard_step_id);
    const { data: validSteps, error: stepsError } = await supabase
      .from('organiser_wizard_config')
      .select('id, wizard_step, step_name, step_type, is_required')
      .in('id', wizardStepIds)
      .eq('is_active', true);

    if (stepsError || !validSteps || validSteps.length !== wizardStepIds.length) {
      return NextResponse.json({ error: 'Invalid wizard steps provided' }, { status: 400 });
    }

    let stepsProcessed = 0;
    let stepsSuccessful = 0;
    let totalScore = 0;

    // Process each step
    for (const stepSubmission of body.steps) {
      try {
        stepsProcessed++;

        // Get step configuration
        const stepConfig = validSteps.find(s => s.id === stepSubmission.wizard_step_id);
        if (!stepConfig) {
          console.warn(`Step configuration not found for ${stepSubmission.wizard_step_id}`);
          continue;
        }

        // Calculate score impact
        let scoreImpact = 0;
        if (stepConfig.step_type === 'question' && stepSubmission.response_value) {
          const { data: stepOption, error: optionError } = await supabase
            .from('organiser_wizard_step_options')
            .select('score_impact, option_text')
            .eq('wizard_step_id', stepSubmission.wizard_step_id)
            .eq('option_value', stepSubmission.response_value)
            .single();

          if (!optionError && stepOption) {
            scoreImpact = stepOption.score_impact;
          }
        }

        totalScore += scoreImpact;

        // Insert step assessment
        const { error: insertError } = await supabase
          .from('organiser_wizard_assessments')
          .insert({
            employer_id: body.employer_id,
            organiser_id: user.id,
            wizard_session_id: wizardSessionId,
            wizard_step_id: stepSubmission.wizard_step_id,
            step_response: stepSubmission.step_response,
            response_value: stepSubmission.response_value,
            score_impact: scoreImpact,
            response_date: new Date().toISOString(),
            session_started_at: stepSubmission.session_started_at,
            session_completed_at: stepSubmission.session_completed_at || null,
            is_complete: stepSubmission.session_completed_at ? true : false,
          });

        if (insertError) {
          console.error(`Failed to insert step ${stepSubmission.wizard_step_id}:`, insertError);
        } else {
          stepsSuccessful++;
        }

      } catch (error) {
        console.error(`Error processing step ${stepSubmission.wizard_step_id}:`, error);
      }
    }

    // Calculate completion percentage
    const { data: totalSteps } = await supabase
      .from('organiser_wizard_config')
      .select('id')
      .eq('is_active', true);

    const completionPercentage = totalSteps ? Math.round((stepsSuccessful / totalSteps.length) * 100) : 0;

    // Calculate time spent
    const firstStep = body.steps[0];
    const lastStep = body.steps[body.steps.length - 1];
    const timeSpentMinutes = firstStep && lastStep && firstStep.session_started_at && lastStep.session_completed_at
      ? Math.round((new Date(lastStep.session_completed_at).getTime() - new Date(firstStep.session_started_at).getTime()) / (1000 * 60))
      : 0;

    // Determine final rating based on score
    let finalRating: 'green' | 'amber' | 'red' | 'unknown' = 'unknown';
    if (totalScore >= 80) finalRating = 'green';
    else if (totalScore >= 50) finalRating = 'amber';
    else if (totalScore >= 0) finalRating = 'red';

    // Determine confidence level
    let confidenceLevel: 'high' | 'medium' | 'low' | 'very_low' = 'low';
    if (completionPercentage >= 100 && Math.abs(totalScore) > 30) confidenceLevel = 'high';
    else if (completionPercentage >= 75 && Math.abs(totalScore) > 15) confidenceLevel = 'medium';

    // Generate assessment summary
    const assessmentSummary = generateAssessmentSummary(body.steps, totalScore, finalRating);

    // Generate key factors
    const keyFactors = generateKeyFactors(body.steps, validSteps);

    // Set expiry date (6 months from now)
    const expiresDate = new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // The summary will be automatically created by the trigger in the database
    // But we can also manually update it if needed

    // Create overall expertise rating if session is complete
    let expertiseRatingId: string | undefined;
    if (completionPercentage >= 100) {
      const { data: expertiseRating, error: expertiseError } = await supabase
        .from('organiser_overall_expertise_ratings')
        .insert({
          employer_id: body.employer_id,
          organiser_id: user.id,
          assessment_date: new Date().toISOString().split('T')[0],
          overall_score: totalScore,
          overall_rating: finalRating,
          confidence_level: confidenceLevel,
          assessment_basis: `Wizard assessment session ${wizardSessionId}`,
          assessment_context: body.organiser_notes || null,
          knowledge_beyond_projects: true,
          assessment_notes: assessmentSummary,
          is_active: true,
          expires_date: expiresDate,
          created_by: user.id,
          updated_by: user.id,
        })
        .select('id')
        .single();

      if (!expertiseError && expertiseRating) {
        expertiseRatingId = expertiseRating.id;
      }
    }

    const response: WizardSubmissionResponse = {
      wizard_session_id: wizardSessionId,
      employer_id: body.employer_id,
      organiser_id: user.id,
      session_date: new Date().toISOString().split('T')[0],
      total_score: totalScore,
      final_rating: finalRating,
      completion_percentage: completionPercentage,
      time_spent_minutes: timeSpentMinutes,
      assessment_summary: assessmentSummary,
      key_factors: keyFactors,
      confidence_level: confidenceLevel,
      is_complete: completionPercentage >= 100,
      expires_date: expiresDate,
      steps_processed: stepsProcessed,
      steps_successful: stepsSuccessful,
      created_expertise_rating_id: expertiseRatingId,
    };

    return NextResponse.json(response, { status: 201 });

  } catch (error) {
    console.error('Submit wizard assessment API unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Helper function to generate assessment summary
function generateAssessmentSummary(
  steps: WizardStepSubmission[],
  totalScore: number,
  finalRating: string
): string {
  const completedSteps = steps.filter(s => s.response_value).length;
  const assessmentType = finalRating === 'green' ? 'positive' : finalRating === 'red' ? 'concerning' : 'mixed';

  return `Wizard assessment completed with ${completedSteps} steps evaluated. ` +
    `Overall assessment indicates ${assessmentType} profile with a score of ${totalScore}. ` +
    `Rating: ${finalRating.toUpperCase()}. ` +
    `Assessment based on systematic evaluation of EBA status, compliance factors, and union relationship.`;
}

// Helper function to generate key factors
function generateKeyFactors(
  steps: WizardStepSubmission[],
  validSteps: any[]
): string[] {
  const factors: string[] = [];

  steps.forEach(step => {
    const stepConfig = validSteps.find(s => s.id === step.wizard_step_id);
    if (!stepConfig || !step.response_value) return;

    // Map step responses to key factors
    switch (stepConfig.step_name) {
      case 'EBA Status':
        if (step.response_value === 'yes') {
          factors.push('Active enterprise agreement in place');
        } else if (step.response_value === 'none') {
          factors.push('No enterprise agreement history');
        }
        break;
      case 'CBUS Compliance':
        if (step.response_value === 'yes') {
          factors.push('Compliant with CBUS requirements');
        } else {
          factors.push('CBUS compliance issues identified');
        }
        break;
      case 'Safety Record':
        if (step.response_value === 'excellent') {
          factors.push('Excellent safety record');
        } else if (step.response_value === 'poor') {
          factors.push('Safety concerns identified');
        }
        break;
      case 'Payment History':
        if (step.response_value === 'yes') {
          factors.push('Good payment and wage compliance');
        } else {
          factors.push('Payment compliance issues');
        }
        break;
      case 'Union Relationship':
        if (step.response_value === 'excellent') {
          factors.push('Excellent union relationship');
        } else if (step.response_value === 'poor') {
          factors.push('Poor union relationship');
        }
        break;
    }
  });

  return factors;
}

// Export handlers with rate limiting
export const GET = withRateLimit(
  getWizardConfigHandler,
  RATE_LIMIT_PRESETS.RELAXED
);

export const POST = withRateLimit(
  submitWizardHandler,
  RATE_LIMIT_PRESETS.STANDARD
);

// Health check endpoint
export async function HEAD() {
  try {
    const supabase = await createServerSupabase();

    const { count, error } = await supabase
      .from('organiser_wizard_config')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true);

    if (error) throw error;

    return new NextResponse(null, {
      status: 200,
      headers: {
        'X-Total-Wizard-Steps': count?.toString() || '0',
        'X-Wizard-Version': '1.0',
        'X-Last-Updated': new Date().toISOString()
      }
    });
  } catch (error) {
    return new NextResponse(null, { status: 503 });
  }
}