import { useQuery } from "@tanstack/react-query";
import { useMappingSheetData } from "@/hooks/useMappingSheetData";
import { useKeyContractorTradesSet } from "@/hooks/useKeyContractorTrades";
import {
  getEmployerTrafficLightRating,
  calculateProjectComplianceRating,
  getAverageContractorRating,
  ProjectComplianceRating,
  TrafficLightRating
} from "../utils/trafficLightIntegration";
import { useCoreComplianceData } from "./useCoreComplianceData";

export function useProjectComplianceRating(projectId: string) {
  const { data: coreCompliance } = useCoreComplianceData(projectId);
  const { data: mappingData } = useMappingSheetData(projectId);
  const { tradeSet: KEY_CONTRACTOR_TRADES } = useKeyContractorTradesSet();

  return useQuery({
    queryKey: ["project-compliance-rating", projectId],
    queryFn: async (): Promise<ProjectComplianceRating | null> => {
      if (!mappingData || !coreCompliance) return null;

      // Find the builder (head_contractor or builder role)
      const builder = mappingData.contractorRoles.find(
        role => role.role === 'head_contractor' || role.role === 'builder'
      );

      // Find key contractors (trade contractors with key trades)
      const keyContractors = mappingData.tradeContractors.filter(
        trade => KEY_CONTRACTOR_TRADES.has(trade.tradeType)
      );

      let builderRating: TrafficLightRating | null = null;
      let contractorRatings: TrafficLightRating[] = [];

      // Get builder traffic light rating
      if (builder) {
        builderRating = await getEmployerTrafficLightRating(builder.employerId, projectId);
      }

      // Get contractor traffic light ratings in parallel
      if (keyContractors.length > 0) {
        const contractorPromises = keyContractors.map(contractor =>
          getEmployerTrafficLightRating(contractor.employerId, projectId)
        );

        const resolvedRatings = await Promise.all(contractorPromises);
        contractorRatings = resolvedRatings.filter((rating): rating is TrafficLightRating => rating !== null);
      }

      // Calculate average contractor rating
      const contractorAverageRating = contractorRatings.length > 0
        ? getAverageContractorRating(contractorRatings)
        : null;

      // Calculate final project rating
      const projectRating = calculateProjectComplianceRating({
        delegateIdentified: coreCompliance.delegateIdentified,
        hsrChairExists: coreCompliance.hsrChairExists,
        builderRating,
        contractorAverageRating
      });

      return projectRating;
    },
    enabled: !!projectId && !!mappingData && !!coreCompliance
  });
}

// Hook to get detailed breakdown for display
export function useProjectComplianceBreakdown(projectId: string) {
  const { data: rating } = useProjectComplianceRating(projectId);
  const { data: coreCompliance } = useCoreComplianceData(projectId);
  const { data: mappingData } = useMappingSheetData(projectId);
  const { tradeSet: KEY_CONTRACTOR_TRADES } = useKeyContractorTradesSet();

  return useQuery({
    queryKey: ["project-compliance-breakdown", projectId],
    queryFn: async () => {
      if (!mappingData || !coreCompliance || !rating) return null;

      // Find builder and key contractors
      const builder = mappingData.contractorRoles.find(
        role => role.role === 'head_contractor' || role.role === 'builder'
      );

      const keyContractors = mappingData.tradeContractors.filter(
        trade => KEY_CONTRACTOR_TRADES.has(trade.tradeType)
      );

      // Get detailed contractor information with ratings
      const contractorDetails = await Promise.all(
        keyContractors.map(async (contractor) => {
          const trafficLightRating = await getEmployerTrafficLightRating(contractor.employerId, projectId);
          return {
            employerId: contractor.employerId,
            employerName: contractor.employerName,
            tradeLabel: contractor.tradeLabel,
            hasEba: contractor.ebaStatus || false,
            trafficLightRating
          };
        })
      );

      return {
        rating,
        coreCompliance,
        builder: builder ? {
          employerId: builder.employerId,
          employerName: builder.employerName,
          roleLabel: builder.roleLabel,
          hasEba: builder.ebaStatus || false,
          trafficLightRating: rating.builderRating
        } : null,
        keyContractors: contractorDetails,
        summary: {
          totalKeyContractors: keyContractors.length,
          contractorsWithRatings: contractorDetails.filter(c => c.trafficLightRating).length,
          overallProjectHealth: rating.overallRating
        }
      };
    },
    enabled: !!projectId && !!mappingData && !!coreCompliance && !!rating
  });
}