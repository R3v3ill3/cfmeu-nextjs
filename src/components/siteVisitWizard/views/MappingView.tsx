"use client"

import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { WizardButton } from '../shared/WizardButton'
import { ShareLinkGenerator } from '@/components/projects/mapping/ShareLinkGenerator'
import { cn } from '@/lib/utils'
import { 
  ClipboardList, 
  Building, 
  ExternalLink,
  Loader2,
  CheckCircle,
} from 'lucide-react'

interface MappingViewProps {
  projectId: string
  projectName: string
}

interface TradeSummary {
  trade: string
  employerCount: number
  hasEba: boolean
}

export function MappingView({ projectId, projectName }: MappingViewProps) {
  
  // Fetch mapping summary data
  const { data: mappingData, isLoading } = useQuery({
    queryKey: ['wizard-mapping-summary', projectId],
    queryFn: async () => {
      // Get trade assignments
      const { data: assignments, error } = await supabase
        .from('project_assignments')
        .select(`
          id,
          employers (
            id,
            name,
            enterprise_agreement_status
          ),
          trade_types (
            name
          )
        `)
        .eq('project_id', projectId)
        .eq('assignment_type', 'trade_contractor')
      
      if (error) throw error
      
      // Group by trade
      const tradeMap = new Map<string, { count: number; hasEba: boolean }>()
      
      ;(assignments || []).forEach((assignment: any) => {
        const tradeName = assignment.trade_types?.name || 'Other'
        const hasEba = assignment.employers?.enterprise_agreement_status === true
        
        if (!tradeMap.has(tradeName)) {
          tradeMap.set(tradeName, { count: 0, hasEba: false })
        }
        
        const current = tradeMap.get(tradeName)!
        current.count += 1
        if (hasEba) current.hasEba = true
        tradeMap.set(tradeName, current)
      })
      
      const trades: TradeSummary[] = Array.from(tradeMap.entries())
        .map(([trade, data]) => ({
          trade,
          employerCount: data.count,
          hasEba: data.hasEba,
        }))
        .sort((a, b) => b.employerCount - a.employerCount)
      
      // Get totals
      const { data: allAssignments } = await supabase
        .from('project_assignments')
        .select('id, employers(enterprise_agreement_status)')
        .eq('project_id', projectId)
      
      const totalEmployers = allAssignments?.length || 0
      const ebaEmployers = allAssignments?.filter(
        (a: any) => a.employers?.enterprise_agreement_status === true
      ).length || 0
      
      return {
        trades,
        totalEmployers,
        ebaEmployers,
        totalTrades: trades.length,
      }
    },
    staleTime: 30000,
  })
  
  return (
    <div className="p-4 space-y-4 pb-safe-bottom">
      {/* Summary cards */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      ) : (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
              <div className="text-3xl font-bold text-gray-900">
                {mappingData?.totalTrades || 0}
              </div>
              <div className="text-sm text-gray-500 mt-1">Trades Mapped</div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
              <div className="text-3xl font-bold text-gray-900">
                {mappingData?.totalEmployers || 0}
              </div>
              <div className="text-sm text-gray-500 mt-1">Employers</div>
            </div>
          </div>
          
          {/* EBA coverage */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-600">EBA Coverage</span>
              <span className="text-lg font-bold text-gray-900">
                {mappingData?.ebaEmployers || 0} / {mappingData?.totalEmployers || 0}
              </span>
            </div>
            <div className="mt-2 h-2 bg-gray-200 rounded-full overflow-hidden">
              <div 
                className="h-full bg-green-500 rounded-full transition-all duration-500"
                style={{ 
                  width: `${mappingData?.totalEmployers 
                    ? (mappingData.ebaEmployers / mappingData.totalEmployers) * 100 
                    : 0}%` 
                }}
              />
            </div>
          </div>
          
          {/* Trade list */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide px-1">
              Mapped Trades
            </h3>
            
            {mappingData?.trades.length === 0 ? (
              <div className="text-center py-8 bg-white rounded-xl border border-gray-200">
                <ClipboardList className="h-10 w-10 text-gray-300 mx-auto mb-2" />
                <p className="text-gray-500">No trades mapped yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {mappingData?.trades.map((trade) => (
                  <div 
                    key={trade.trade}
                    className="bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        'w-10 h-10 rounded-lg flex items-center justify-center',
                        trade.hasEba ? 'bg-green-100' : 'bg-gray-100'
                      )}>
                        <Building className={cn(
                          'h-5 w-5',
                          trade.hasEba ? 'text-green-600' : 'text-gray-500'
                        )} />
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">{trade.trade}</div>
                        <div className="text-sm text-gray-500">
                          {trade.employerCount} employer{trade.employerCount !== 1 ? 's' : ''}
                        </div>
                      </div>
                    </div>
                    {trade.hasEba && (
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
      
      {/* Actions */}
      <div className="space-y-3 pt-4">
        {/* Share Link Generator - has its own dialog trigger */}
        <ShareLinkGenerator
          projectId={projectId}
          projectName={projectName}
        />
        
        <WizardButton
          variant="outline"
          size="md"
          fullWidth
          onClick={() => window.open(`/projects/${projectId}?tab=mappingsheets`, '_blank')}
          icon={<ExternalLink className="h-4 w-4" />}
        >
          Open Full Mapping Sheet
        </WizardButton>
      </div>
    </div>
  )
}

