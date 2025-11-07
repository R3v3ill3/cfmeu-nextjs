"use client"

import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/integrations/supabase/client"
import { useKeyContractorTradesSet } from "./useKeyContractorTrades"

export interface ProjectKeyContractorMetricsData {
  identifiedCount: number
  totalSlots: number
  ebaCount: number
  auditsCount: number
  trafficLightRatings: {
    red: number
    amber: number
    yellow: number
    green: number
  }
}

export function useProjectKeyContractorMetrics(projectId: string | null | undefined) {
  const { tradeSet: KEY_CONTRACTOR_TRADES } = useKeyContractorTradesSet()
  
  return useQuery<ProjectKeyContractorMetricsData>({
    queryKey: ["project-key-contractor-metrics", projectId],
    enabled: !!projectId,
    staleTime: 30000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      if (!projectId) throw new Error("Project ID required")

      // Get project assignments with key contractor data
      const { data: assignments, error: assignmentsError } = await supabase
        .from("project_assignments")
        .select(`
          id,
          employer_id,
          assignment_type,
          contractor_role_types(code),
          trade_types(code),
          employers(
            id,
            enterprise_agreement_status
          )
        `)
        .eq("project_id", projectId)

      if (assignmentsError) throw assignmentsError

      const KEY_CONTRACTOR_ROLES = new Set(['builder', 'project_manager'])
      const totalKeyCategories = KEY_CONTRACTOR_TRADES.size + KEY_CONTRACTOR_ROLES.size

      // Track identified key contractors
      const identifiedKeyContractors = new Set<string>()
      const keyContractorsWithEba = new Set<string>()
      const keyContractorEmployerIds = new Set<string>()

      // Process assignments to find key contractors
      ;(assignments || []).forEach((assignment) => {
        let isKeyContractor = false

        if (assignment.assignment_type === 'contractor_role' && assignment.contractor_role_types) {
          const roleCode = assignment.contractor_role_types.code
          if (KEY_CONTRACTOR_ROLES.has(roleCode)) {
            isKeyContractor = true
          }
        }

        if (assignment.assignment_type === 'trade_work' && assignment.trade_types) {
          const tradeCode = assignment.trade_types.code
          if (KEY_CONTRACTOR_TRADES.has(tradeCode)) {
            isKeyContractor = true
          }
        }

        if (isKeyContractor && assignment.employer_id) {
          keyContractorEmployerIds.add(assignment.employer_id)
          identifiedKeyContractors.add(assignment.employer_id)
          
          if (assignment.employers?.enterprise_agreement_status === true) {
            keyContractorsWithEba.add(assignment.employer_id)
          }
        }
      })

      // Get audit counts for key contractors
      const keyContractorIdsArray = Array.from(keyContractorEmployerIds)
      let auditsCount = 0
      
      if (keyContractorIdsArray.length > 0) {
        const { data: audits, error: auditsError } = await supabase
          .from("project_compliance_assessments")
          .select("employer_id")
          .eq("project_id", projectId)
          .in("employer_id", keyContractorIdsArray)
          .eq("is_active", true)

        if (!auditsError && audits) {
          auditsCount = new Set(audits.map(a => a.employer_id)).size
        }
      }

      // Get all assigned trades (key contractors + any additional assigned trades)
      const allAssignedEmployerIds = new Set<string>()
      
      // Add key contractors
      keyContractorIdsArray.forEach(id => allAssignedEmployerIds.add(id))
      
      // Add all other assigned trades (trades with an employer assigned)
      ;(assignments || []).forEach((assignment) => {
        if (assignment.assignment_type === 'trade_work' && assignment.employer_id) {
          // Check if it's not already a key contractor
          if (!keyContractorIdsArray.includes(assignment.employer_id)) {
            allAssignedEmployerIds.add(assignment.employer_id)
          }
        }
      })

      // Get traffic light ratings for all assigned contractors (key + additional trades)
      const trafficLightRatings = {
        red: 0,
        amber: 0,
        yellow: 0,
        green: 0
      }

      const allAssignedIdsArray = Array.from(allAssignedEmployerIds)
      if (allAssignedIdsArray.length > 0) {
        // Get ratings for this project or general ratings (project_id is null)
        const { data: ratings, error: ratingsError } = await supabase
          .from("employer_ratings_4point")
          .select("employer_id, overall_rating_label, project_id, rating_date")
          .in("employer_id", allAssignedIdsArray)
          .or(`project_id.eq.${projectId},project_id.is.null`)
          .order("rating_date", { ascending: false })

        if (!ratingsError && ratings) {
          // Get most recent rating per employer (prefer project-specific, then general)
          const latestRatings = new Map<string, string>()
          ratings.forEach((rating) => {
            const key = rating.employer_id
            if (!latestRatings.has(key) && rating.overall_rating_label) {
              latestRatings.set(key, rating.overall_rating_label)
            } else if (latestRatings.has(key) && rating.project_id === projectId && rating.overall_rating_label) {
              // Prefer project-specific rating over general rating
              latestRatings.set(key, rating.overall_rating_label)
            }
          })

          latestRatings.forEach((label) => {
            if (label === 'red') trafficLightRatings.red++
            else if (label === 'amber') trafficLightRatings.amber++
            else if (label === 'yellow') trafficLightRatings.yellow++
            else if (label === 'green') trafficLightRatings.green++
          })
        }
      }

      return {
        identifiedCount: identifiedKeyContractors.size,
        totalSlots: totalKeyCategories,
        ebaCount: keyContractorsWithEba.size,
        auditsCount,
        trafficLightRatings
      }
    }
  })
}

