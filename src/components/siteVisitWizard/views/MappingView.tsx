"use client"

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { WizardButton } from '../shared/WizardButton'
import { ShareLinkGenerator } from '@/components/projects/mapping/ShareLinkGenerator'
import { cn } from '@/lib/utils'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { MappingSheetEditor } from '@/components/projects/mapping/MappingSheetEditor'
import { useToast } from '@/hooks/use-toast'
import { 
  ClipboardList, 
  Building, 
  ExternalLink,
  Loader2,
  CheckCircle,
  Plus,
  Share2,
  FileText,
} from 'lucide-react'

interface MappingViewProps {
  projectId: string
  projectName: string
  projectAddress?: string | null
  builderName?: string | null
}

interface TradeSummary {
  trade: string
  employerCount: number
  hasEba: boolean
}

export function MappingView({ projectId, projectName, projectAddress, builderName }: MappingViewProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [isAddMappingOpen, setIsAddMappingOpen] = useState(false)
  
  // Fetch mapping summary data
  const { data: mappingData, isLoading, error } = useQuery({
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

  useEffect(() => {
    if (error) {
      console.error('[MappingView] Failed to load mapping summary', error)
      toast({
        title: 'Failed to load mapping summary',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      })
    }
  }, [error, toast])

  // Navigate to full mapping sheet page
  const handleFullMappingSheet = () => {
    const params = new URLSearchParams({
      tab: 'mappingsheets',
      fromSiteVisit: '1',
      wizardPhase: 'action-menu',
      wizardView: 'mapping',
      wizardProjectName: projectName,
    })
    if (projectAddress) params.set('wizardProjectAddress', projectAddress)
    if (builderName) params.set('wizardBuilderName', builderName)
    router.push(`/projects/${projectId}?${params.toString()}`)
  }
  
  return (
    <div className="p-4 space-y-4 pb-safe-bottom">
      {/* Summary cards */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">
          Unable to load mapping summary right now. Please try again.
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
                <p className="text-sm text-gray-400 mt-1">
                  Use &quot;Add Mapping&quot; below to start mapping trades
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {mappingData?.trades.slice(0, 5).map((trade) => (
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
                {(mappingData?.trades.length || 0) > 5 && (
                  <p className="text-sm text-gray-500 text-center py-2">
                    + {(mappingData?.trades.length || 0) - 5} more trades
                  </p>
                )}
              </div>
            )}
          </div>
        </>
      )}
      
      {/* Actions - 3 distinct options */}
      <div className="space-y-3 pt-4">
        {/* 1. Add Mapping - opens the mobile mapping workflow */}
        <WizardButton
          variant="primary"
          size="lg"
          fullWidth
          onClick={() => setIsAddMappingOpen(true)}
          icon={<Plus className="h-5 w-5" />}
        >
          Add Mapping
        </WizardButton>
        
        {/* 2. Share Mapping Sheet - generates shareable link/QR */}
        <ShareLinkGenerator
          projectId={projectId}
          projectName={projectName}
          trigger={
            <WizardButton
              variant="secondary"
              size="lg"
              fullWidth
              icon={<Share2 className="h-5 w-5" />}
            >
              Share Mapping Sheet
            </WizardButton>
          }
        />
        
        {/* 3. Full Mapping Sheet - opens detailed view */}
        <WizardButton
          variant="outline"
          size="md"
          fullWidth
          onClick={handleFullMappingSheet}
          icon={<FileText className="h-4 w-4" />}
        >
          Full Mapping Sheet
        </WizardButton>
      </div>

      <Dialog open={isAddMappingOpen} onOpenChange={setIsAddMappingOpen}>
        <DialogContent className="max-w-3xl p-0 overflow-hidden">
          <DialogHeader className="px-4 pt-4">
            <DialogTitle>Add Mapping</DialogTitle>
          </DialogHeader>
          <div className="max-h-[70vh] overflow-y-auto px-4 pb-4">
            <MappingSheetEditor
              dataSource={{ type: 'project', projectId }}
              variant="embedded"
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
