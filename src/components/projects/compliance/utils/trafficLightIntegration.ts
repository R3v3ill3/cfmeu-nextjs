import { supabase } from "@/integrations/supabase/client";

export interface TrafficLightRating {
  rating: 1 | 2 | 3 | 4; // 1=Critical, 2=Red, 3=Amber, 4=Green
  label: string;
  color: 'red' | 'amber' | 'green';
  confidence: 'low' | 'medium' | 'high' | 'very_high';
}

export interface ProjectComplianceRating {
  overallRating: 1 | 2 | 3 | 4;
  coreComplianceScore: number;
  trafficLightScore: number;
  builderRating: TrafficLightRating | null;
  contractorAverageRating: TrafficLightRating | null;
  componentScores: {
    delegateIdentified: boolean;
    hsrChairExists: boolean;
    builderScore: number;
    contractorScore: number;
  };
}

export const TRAFFIC_LIGHT_LABELS = {
  1: { label: 'Critical', color: 'red' as const },
  2: { label: 'Poor', color: 'red' as const },
  3: { label: 'Moderate', color: 'amber' as const },
  4: { label: 'Good', color: 'green' as const }
};

export function getTrafficLightColor(rating: number): 'red' | 'amber' | 'green' {
  if (rating >= 3.5) return 'green';
  if (rating >= 2.5) return 'amber';
  return 'red';
}

export function getTrafficLightLabel(rating: number): string {
  if (rating >= 3.5) return 'Good';
  if (rating >= 2.5) return 'Moderate';
  if (rating >= 1.5) return 'Poor';
  return 'Critical';
}

// Function to get traffic light rating for an employer on a specific project
export async function getEmployerTrafficLightRating(
  employerId: string,
  projectId: string
): Promise<TrafficLightRating | null> {
  try {
    // Get the latest rating from project_data_ratings table
    const { data, error } = await supabase
      .from("project_data_ratings")
      .select("*")
      .eq("project_id", projectId)
      .eq("employer_id", employerId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) {
      console.warn(`No traffic light rating found for employer ${employerId} on project ${projectId}`);
      return null;
    }

    const rating = Math.round(data.compliance_score) as 1 | 2 | 3 | 4;

    return {
      rating,
      label: getTrafficLightLabel(rating),
      color: getTrafficLightColor(rating),
      confidence: (data.confidence_level || 'medium') as 'low' | 'medium' | 'high' | 'very_high'
    };
  } catch (error) {
    console.error("Error fetching traffic light rating:", error);
    return null;
  }
}

// Function to calculate project compliance rating
export function calculateProjectComplianceRating(params: {
  delegateIdentified: boolean;
  hsrChairExists: boolean;
  builderRating: TrafficLightRating | null;
  contractorAverageRating: TrafficLightRating | null;
}): ProjectComplianceRating {
  const { delegateIdentified, hsrChairExists, builderRating, contractorAverageRating } = params;

  // Core compliance score (10% total - 5% each)
  const coreComplianceScore =
    (delegateIdentified ? 0.05 : 0) +
    (hsrChairExists ? 0.05 : 0);

  // Traffic light component (90% total - 45% each)
  let builderScore = 0;
  let contractorScore = 0;

  if (builderRating) {
    builderScore = builderRating.rating;
  }

  if (contractorAverageRating) {
    contractorScore = contractorAverageRating.rating;
  }

  // If no ratings available, default to lowest score
  const effectiveBuilderScore = builderScore || 1;
  const effectiveContractorScore = contractorScore || 1;

  const trafficLightScore = (effectiveBuilderScore * 0.45) + (effectiveContractorScore * 0.45);

  // Calculate final score
  const finalScore = coreComplianceScore + trafficLightScore;

  // Convert to 4-point scale
  let overallRating: 1 | 2 | 3 | 4;
  if (finalScore >= 3.5) overallRating = 4; // Green
  else if (finalScore >= 2.5) overallRating = 3; // Amber
  else if (finalScore >= 1.5) overallRating = 2; // Red
  else overallRating = 1; // Critical

  return {
    overallRating,
    coreComplianceScore,
    trafficLightScore,
    builderRating,
    contractorAverageRating,
    componentScores: {
      delegateIdentified,
      hsrChairExists,
      builderScore: effectiveBuilderScore,
      contractorScore: effectiveContractorScore
    }
  };
}

// Function to get average traffic light rating for multiple contractors
export function getAverageContractorRating(
  contractorRatings: TrafficLightRating[]
): TrafficLightRating | null {
  if (contractorRatings.length === 0) return null;

  const averageRating = contractorRatings.reduce((sum, rating) => sum + rating.rating, 0) / contractorRatings.length;
  const roundedRating = Math.round(averageRating) as 1 | 2 | 3 | 4;

  return {
    rating: roundedRating,
    label: getTrafficLightLabel(roundedRating),
    color: getTrafficLightColor(roundedRating),
    confidence: 'medium' as const // Default confidence for averages
  };
}