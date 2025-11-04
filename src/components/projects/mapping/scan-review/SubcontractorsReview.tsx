"use client"

import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Building2, AlertCircle, Plus, Search, X, FileSearch, Tags, Users, Keyboard, HelpCircle, Zap, ChevronDown, Info, ArrowRight, Lightbulb, ChevronUp, ChevronLeft, ChevronRight, CheckCircle2 } from 'lucide-react'
import { supabase } from '@/integrations/supabase/client'
import { ConfidenceIndicator } from './ConfidenceIndicator'
import { EmployerMatchDialog } from './EmployerMatchDialog'
import { FwcEbaSearchModal } from '@/components/employers/FwcEbaSearchModal'
import { BatchEbaSearchModal } from './BatchEbaSearchModal'
import { AddAdditionalEmployerModal } from './AddAdditionalEmployerModal'
import { BulkAliasOperations } from './BulkAliasOperations'
import { findBestEmployerMatch } from '@/utils/fuzzyMatching'
import { useMappingSheetData } from '@/hooks/useMappingSheetData'
import { toast } from 'sonner'
import { StatusSelectSimple } from '@/components/ui/StatusSelect'
import { TradeStatus } from '@/components/ui/StatusBadge'
import { EbaEmployerQuickList } from './EbaEmployerQuickList'
import { useKeyContractorTradesSet } from '@/hooks/useKeyContractorTrades'
import { useIsMobile } from '@/hooks/use-mobile'

interface SubcontractorsReviewProps {
  extractedSubcontractors: Array<{
    stage: string
    trade: string
    company?: string
    eba?: boolean
  }>
  projectId?: string
  confidence: number[]
  onDecisionsChange: (decisions: any[]) => void
  allowProjectCreation?: boolean
}

const STAGE_LABELS: Record<string, string> = {
  early_works: 'Early Works',
  structure: 'Structure',
  finishing: 'Finishing',
  other: 'Other',
}

// Helper function to map trade names to codes (same as import route)
function mapTradeNameToCode(tradeName: string): string {
  const mapping: Record<string, string> = {
    'demo': 'demolition',
    'demolition': 'demolition',
    'piling': 'piling',
    'excavations': 'earthworks',
    'scaffold': 'scaffolding',
    'scaffolding': 'scaffolding',
    'cleaners': 'cleaning',
    'traffic control': 'traffic_control',
    'labour hire': 'labour_hire',
    'steel fixer': 'steel_fixing',
    'steel fixers': 'steel_fixing',
    'tower crane': 'tower_crane',
    'mobile crane': 'mobile_crane',
    'concreters': 'concreting',
    'concrete': 'concreting',
    'stressor': 'post_tensioning',
    'formwork': 'form_work',
    'bricklayer': 'bricklaying',
    'bricklaying': 'bricklaying',
    'structural steel': 'structural_steel',
    'facade': 'facade',
    'carpenter': 'carpentry',
    'carpentry': 'carpentry',
    'plasterer': 'plastering',
    'plastering': 'plastering',
    'painters': 'painting',
    'painting': 'painting',
    'tiling': 'tiling',
    'kitchens': 'kitchens',
    'flooring': 'flooring',
    'landscaping': 'landscaping',
    'final clean': 'cleaning',
  }

  const normalized = tradeName.toLowerCase().trim()
  return mapping[normalized] || normalized.replace(/\s+/g, '_')
}

export function SubcontractorsReview({
  extractedSubcontractors,
  projectId,
  confidence,
  onDecisionsChange,
  allowProjectCreation = false,
}: SubcontractorsReviewProps) {
  const isMobile = useIsMobile()
  const [decisions, setDecisions] = useState<any[]>([])
  const [matchDialogOpen, setMatchDialogOpen] = useState(false)
  const [selectedSubcontractor, setSelectedSubcontractor] = useState<any>(null)

  // Mobile-specific state
  const [expandedCards, setExpandedCards] = useState<Set<number>>(new Set())
  const [bulkSelectionMode, setBulkSelectionMode] = useState(false)
  const [bulkSelected, setBulkSelected] = useState<Set<number>>(new Set())
  const [currentCardIndex, setCurrentCardIndex] = useState(0)
  
  // EBA search state
  const [ebaSearchOpen, setEbaSearchOpen] = useState(false)
  const [batchEbaSearchOpen, setBatchEbaSearchOpen] = useState(false)
  const [selectedEbaEmployer, setSelectedEbaEmployer] = useState<{employerId: string, employerName: string} | null>(null)

  // EBA quick list state
  const [ebaQuickListOpen, setEbaQuickListOpen] = useState(false)
  const [selectedTradeForQuickList, setSelectedTradeForQuickList] = useState<string | null>(null)
  const [selectedIndexForQuickList, setSelectedIndexForQuickList] = useState<number | null>(null)

  // Fetch key contractor trades set for EBA filtering
  const { tradeSet: KEY_CONTRACTOR_TRADES } = useKeyContractorTradesSet()

  // Inline editing state for "other" trades with missing company names
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [editingCompanyName, setEditingCompanyName] = useState('')
  const [editingTradeName, setEditingTradeName] = useState('')

  // Add additional employer state
  const [addAdditionalOpen, setAddAdditionalOpen] = useState(false)
  const [addAdditionalIndex, setAddAdditionalIndex] = useState<number | null>(null)

  // Bulk alias operations state
  const [bulkAliasOpen, setBulkAliasOpen] = useState(false)

  // Enhanced UX state
  const [showGuidance, setShowGuidance] = useState(true)
  const [selectedFeatureTab, setSelectedFeatureTab] = useState<'overview' | 'aliases' | 'eba'>('overview')
  const [showKeyboardShortcuts, setShowKeyboardShortcuts] = useState(false)
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['basics']))
  const [showQuickActions, setShowQuickActions] = useState(true)
  const [processingAction, setProcessingAction] = useState<string | null>(null)
  const [actionResults, setActionResults] = useState<{[key: string]: {success: number, failed: number}}>({})
  const [selectedRowIndex, setSelectedRowIndex] = useState<number | null>(null)

  // Fetch all employers for matching
  // NOTE: Removed the Supabase default row limit to ensure we get ALL employers
  // This is necessary for search functionality to work across the entire employer database
  const { data: allEmployers = [] } = useQuery({
    queryKey: ['employers-all'],
    queryFn: async () => {
      let allData: any[] = []
      let from = 0
      const pageSize = 1000
      
      // Paginate through all employers to bypass Supabase's default limit
      while (true) {
        const { data, error } = await supabase
          .from('employers')
          .select('id, name, enterprise_agreement_status')
          .order('name')
          .range(from, from + pageSize - 1)

        if (error) throw error
        
        if (!data || data.length === 0) break
        
        allData = allData.concat(data)
        
        // If we got less than a full page, we've reached the end
        if (data.length < pageSize) break
        
        from += pageSize
      }

      return allData
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes to avoid repeated pagination
  })

  // Get existing trade assignments for the project
  const { data: mappingData } = useMappingSheetData(projectId)

  // Initialize decisions with fuzzy matching and existing assignments
  useEffect(() => {
    // Only initialize if we have the required data and haven't initialized yet
    if (!allEmployers.length || !extractedSubcontractors.length) return
    if (decisions.length > 0) return // Already initialized
    
    const initial = extractedSubcontractors.map((sub, index) => {
      // Find ALL existing assignments for this trade (there can be multiple)
      const mappedTradeCode = mapTradeNameToCode(sub.trade)
      const existingAssignments = mappingData?.tradeContractors.filter(
        tc => tc.tradeType === mappedTradeCode
      ) || []

      if (!sub.company) {
        return {
          ...sub,
          action: 'skip',
          matchedEmployer: null,
          matchConfidence: 0,
          confidence: confidence[index] || 0,
          status: 'unknown' as TradeStatus, // Default for empty companies
          existingEmployers: existingAssignments.map(ea => ({
            id: ea.employerId,
            name: ea.employerName,
            assignmentId: ea.id
          })),
        }
      }

      // Attempt fuzzy match
      const match = findBestEmployerMatch(sub.company, allEmployers)

      return {
        ...sub,
        action: match && match.confidence === 'exact' ? 'import' : 'skip', // Default to skip to prevent accidental imports
        matchedEmployer: match || null,
        matchConfidence: match ? (match.confidence === 'exact' ? 1.0 : match.confidence === 'high' ? 0.8 : 0.6) : 0,
        confidence: confidence[index] || 0,
        needsReview: !match || match.confidence !== 'exact',
        status: 'active' as TradeStatus, // Default for companies with names
        existingEmployers: existingAssignments.map(ea => ({
          id: ea.employerId,
          name: ea.employerName,
          assignmentId: ea.id,
          keepDecision: true // Default to keeping existing assignments
        })),
        trade_type_code: mappedTradeCode,
        // Track EBA status changes
        shouldUpdateEbaStatus: sub.eba === true && match, // If scanned EBA = Yes and we have a match
      }
    })
    setDecisions(initial)
  }, [extractedSubcontractors, allEmployers, mappingData]) // Removed confidence and decisions from deps

  // Notify parent (only when decisions actually change, not on every render)
  // Flatten decisions: create separate decision for each employer to add
  useEffect(() => {
    const flattenedDecisions: any[] = []

    decisions.forEach(decision => {
      // 1. Add scanned company (if action is import or replace_one)
      if (['import', 'replace_one'].includes(decision.action) && decision.matchedEmployer) {
        flattenedDecisions.push({
          ...decision,
          existingEmployersToKeep: decision.existingEmployers?.filter((e: any) => e.keepDecision) || [],
          existingEmployersToRemove: decision.existingEmployers?.filter((e: any) => !e.keepDecision) || [],
          importScannedCompany: true,
        })
      } else {
        // Skip action - still need to track existing employers
        flattenedDecisions.push({
          ...decision,
          existingEmployersToKeep: decision.existingEmployers?.filter((e: any) => e.keepDecision) || [],
          existingEmployersToRemove: decision.existingEmployers?.filter((e: any) => !e.keepDecision) || [],
          importScannedCompany: false,
        })
      }

      // 2. Add each additional employer as separate decision
      decision.additionalEmployers?.forEach((addEmp: any) => {
        flattenedDecisions.push({
          trade: decision.trade,
          stage: decision.stage,
          trade_type_code: decision.trade_type_code,
          company: addEmp.name,
          matchedEmployer: {
            id: addEmp.id,
            name: addEmp.name,
            confidence: 'exact'
          },
          status: addEmp.status,
          action: 'import',
          confidence: 1.0,
          matchConfidence: 1.0,
          needsReview: false,
          isAdditionalAssignment: true,  // Flag for tracking
          existingEmployers: [],
          existingEmployersToKeep: [],
          existingEmployersToRemove: [],
        })
      })
    })

    onDecisionsChange(flattenedDecisions)
  }, [decisions]) // Removed onDecisionsChange from deps to prevent infinite loop

  // Handle action change for subcontractor
  const handleActionChange = (index: number, action: 'import' | 'skip' | 'keep_existing' | 'replace_one') => {
    setDecisions(prev => {
      const updated = [...prev]
      updated[index].action = action
      return updated
    })
  }

  // Handle status change for subcontractor
  const handleStatusChange = (index: number, status: TradeStatus) => {
    setDecisions(prev => {
      const updated = [...prev]
      updated[index].status = status
      return updated
    })
  }

  const handleOpenMatchDialog = (index: number) => {
    setSelectedSubcontractor({ ...decisions[index], index })
    setMatchDialogOpen(true)
  }

  const handleMatchConfirm = async (employerId: string, employerName: string, isNewEmployer: boolean) => {
    if (selectedSubcontractor === null) return

    // Fetch current EBA status of matched employer
    let currentEbaStatus = false
    if (!isNewEmployer) {
      try {
        const { data: ebaData } = await supabase
          .from('employers')
          .select('enterprise_agreement_status')
          .eq('id', employerId)
          .single()
        
        currentEbaStatus = ebaData?.enterprise_agreement_status === true
      } catch (error) {
        console.error('Failed to fetch employer EBA status:', error)
      }
    }

    setDecisions(prev => {
      const updated = [...prev]
      updated[selectedSubcontractor.index] = {
        ...updated[selectedSubcontractor.index],
        action: 'import',
        matchedEmployer: {
          id: employerId,
          name: employerName,
          confidence: 'exact',
        },
        matchConfidence: 1.0,
        isNewEmployer,
        needsReview: false,
        currentEmployerEbaStatus: currentEbaStatus,
        shouldUpdateEbaStatus: updated[selectedSubcontractor.index].eba === true && !currentEbaStatus, // Need EBA update if scanned=Yes but employer=No
      }
      return updated
    })

    setMatchDialogOpen(false)
    setSelectedSubcontractor(null)
  }

  // Handle individual EBA search for a specific employer
  const handleIndividualEbaSearch = (employerId: string, employerName: string) => {
    setSelectedEbaEmployer({ employerId, employerName })
    setEbaSearchOpen(true)
  }

  // Handle batch EBA search for all employers needing EBA updates
  const handleBatchEbaSearch = () => {
    setBatchEbaSearchOpen(true)
  }

  // Handle inline editing for "other" trades with data entry errors
  const handleStartEdit = (index: number) => {
    const decision = decisions[index]
    setEditingIndex(index)
    // Pre-populate with current values - if company is missing, suggest using trade name
    setEditingCompanyName(decision.company || decision.trade)
    setEditingTradeName(decision.company ? decision.trade : '') // Clear trade if it's the company name
  }

  const handleSaveEdit = async (index: number) => {
    if (!editingCompanyName.trim()) {
      toast.error('Please enter a company name')
      return
    }

    // Try to find match for the edited company name
    const match = findBestEmployerMatch(editingCompanyName.trim(), allEmployers)

    setDecisions(prev => {
      const updated = [...prev]
      updated[index] = {
        ...updated[index],
        company: editingCompanyName.trim(),
        trade: editingTradeName.trim() || updated[index].trade, // Keep original if not changed
        matchedEmployer: match || null,
        matchConfidence: match ? (match.confidence === 'exact' ? 1.0 : match.confidence === 'high' ? 0.8 : 0.6) : 0,
        action: match && match.confidence === 'exact' ? 'import' : 'skip',
        needsReview: !match || match.confidence !== 'exact',
        trade_type_code: mapTradeNameToCode(editingTradeName.trim() || updated[index].trade),
      }
      return updated
    })

    setEditingIndex(null)
    setEditingCompanyName('')
    setEditingTradeName('')

    if (match) {
      toast.success('Match found', { description: `Matched to: ${match.name}` })
    } else {
      toast.info('No match found', { description: 'You can manually search for the employer' })
    }
  }

  const handleCancelEdit = () => {
    setEditingIndex(null)
    setEditingCompanyName('')
    setEditingTradeName('')
  }

  // Handle opening add additional employer modal
  const handleAddAdditional = (index: number) => {
    setAddAdditionalIndex(index)
    setAddAdditionalOpen(true)
  }

  // Handle confirming addition of employer
  const handleConfirmAdditional = (employerId: string, employerName: string, status: TradeStatus) => {
    if (addAdditionalIndex === null) return

    setDecisions(prev => {
      const updated = [...prev]
      const decision = updated[addAdditionalIndex]

      // Initialize additionalEmployers if not exists
      if (!decision.additionalEmployers) {
        decision.additionalEmployers = []
      }

      // Add new employer
      decision.additionalEmployers.push({
        id: employerId,
        name: employerName,
        status,
        isNew: true
      })

      return updated
    })

    setAddAdditionalOpen(false)
    setAddAdditionalIndex(null)

    toast.success('Subcontractor added', {
      description: `${employerName} will be added to ${decisions[addAdditionalIndex].trade}`
    })
  }

  // Handle EBA quick list for specific trade
  const handleOpenEbaQuickList = (index: number) => {
    const decision = decisions[index]
    const tradeTypeCode = mapTradeNameToCode(decision.trade)
    setSelectedTradeForQuickList(tradeTypeCode)
    setSelectedIndexForQuickList(index)
    setEbaQuickListOpen(true)
  }

  // Handle EBA employer selection from quick list
  const handleEbaEmployerSelect = (employer: any) => {
    if (selectedIndexForQuickList === null) return

    // Fetch current EBA status of selected employer
    const fetchEbaStatusAndUpdate = async () => {
      let currentEbaStatus = false
      try {
        const { data: ebaData } = await supabase
          .from('employers')
          .select('enterprise_agreement_status')
          .eq('id', employer.id)
          .single()

        currentEbaStatus = ebaData?.enterprise_agreement_status === true
      } catch (error) {
        console.error('Failed to fetch employer EBA status:', error)
      }

      setDecisions(prev => {
        const updated = [...prev]
        updated[selectedIndexForQuickList] = {
          ...updated[selectedIndexForQuickList],
          action: 'import',
          matchedEmployer: {
            id: employer.id,
            name: employer.name,
            confidence: 'exact',
          },
          matchConfidence: 1.0,
          isNewEmployer: false,
          needsReview: false,
          currentEmployerEbaStatus: currentEbaStatus,
          shouldUpdateEbaStatus: updated[selectedIndexForQuickList].eba === true && !currentEbaStatus,
        }
        return updated
      })
    }

    fetchEbaStatusAndUpdate()
    setEbaQuickListOpen(false)
    setSelectedTradeForQuickList(null)
    setSelectedIndexForQuickList(null)

    toast.success('EBA employer selected', {
      description: `${employer.name} has been selected for ${decisions[selectedIndexForQuickList].trade}`
    })
  }

  // Handle batch EBA employer selection from quick list
  const handleBatchEbaEmployerSelect = (employers: any[]) => {
    // This could be used to replace multiple subcontractors at once
    // For now, we'll show a message and not implement full batch replacement
    toast.info('Batch selection feature', {
      description: `${employers.length} EBA employers selected. Individual selection is currently supported.`
    })
    setEbaQuickListOpen(false)
  }

  // Handle removing additional employer
  const handleRemoveAdditional = (decisionIndex: number, additionalIndex: number) => {
    const employerName = decisions[decisionIndex].additionalEmployers[additionalIndex].name

    setDecisions(prev => {
      const updated = [...prev]
      updated[decisionIndex].additionalEmployers.splice(additionalIndex, 1)
      return updated
    })

    toast.info('Subcontractor removed', {
      description: `${employerName} will not be added`
    })
  }

  // Handle bulk alias operations
  const handleBulkAliasOperations = () => {
    setBulkAliasOpen(true)
  }

  const handleBulkAliasComplete = () => {
    // Refresh the employers list to include new aliases
    window.location.reload() // Simple refresh for now - could be optimized
  }

  // Get list of employers that need EBA status updated to Active
  const employersNeedingEbaUpdate = decisions
    .filter(d => d.action === 'import' && d.shouldUpdateEbaStatus && d.matchedEmployer)
    .map(d => ({
      id: d.matchedEmployer.id,
      name: d.matchedEmployer.name,
      trade: d.trade
    }))

  const needsReviewCount = decisions.filter(d => d.needsReview).length
  const needsEbaUpdateCount = employersNeedingEbaUpdate.length
  const needsEditingCount = decisions.filter(d => !d.company && d.stage === 'other').length

  // Enhanced UX: Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Don't handle shortcuts when typing in input fields
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        return
      }

      const { key, ctrlKey, shiftKey, metaKey } = event
      const isMod = ctrlKey || metaKey

      // Mobile-specific keyboard shortcuts
      if (isMobile) {
        // Arrow key navigation for mobile review mode
        if (key === 'ArrowLeft' && currentCardIndex > 0) {
          event.preventDefault()
          navigateToCard('prev')
          return
        }
        if (key === 'ArrowRight' && currentCardIndex < decisions.length - 1) {
          event.preventDefault()
          navigateToCard('next')
          return
        }
        // Space to toggle expand/collapse on mobile
        if (key === ' ') {
          event.preventDefault()
          toggleCardExpanded(currentCardIndex)
          return
        }
        // Number keys to jump to specific cards (1-9)
        if (key >= '1' && key <= '9') {
          const targetIndex = parseInt(key) - 1
          if (targetIndex < decisions.length) {
            event.preventDefault()
            setCurrentCardIndex(targetIndex)
            return
          }
        }
      }

      if (isMod && key === 'a' && selectedRowIndex !== null) {
        // Ctrl+A: Open alias management for selected employer
        event.preventDefault()
        const selectedDecision = decisions[selectedRowIndex]
        if (selectedDecision && selectedDecision.company) {
          setBulkAliasOpen(true)
        }
      } else if (isMod && key === 'e' && selectedRowIndex !== null) {
        // Ctrl+E: Open EBA search for current trade
        event.preventDefault()
        const selectedDecision = decisions[selectedRowIndex]
        if (selectedDecision?.matchedEmployer) {
          handleIndividualEbaSearch(selectedDecision.matchedEmployer.id, selectedDecision.matchedEmployer.name)
        }
      } else if (isMod && shiftKey && key === 's' && selectedRowIndex !== null) {
        // Ctrl+Shift+S: Suggest alias for selected entry
        event.preventDefault()
        const selectedDecision = decisions[selectedRowIndex]
        if (selectedDecision?.company && selectedDecision?.matchedEmployer) {
          setBulkAliasOpen(true)
          toast.info('Opening alias suggestions...', {
            description: `Analyzing "${selectedDecision.company}" for potential aliases`
          })
        }
      } else if (key === 'Escape') {
        // Escape: Close modals and return to review
        setMatchDialogOpen(false)
        setEbaSearchOpen(false)
        setBatchEbaSearchOpen(false)
        setAddAdditionalOpen(false)
        setBulkAliasOpen(false)
        setShowKeyboardShortcuts(false)
        setSelectedRowIndex(null)
      } else if (key === 'ArrowDown') {
        // Arrow Down: Select next row
        event.preventDefault()
        setSelectedRowIndex(prev => {
          if (prev === null || prev >= decisions.length - 1) return 0
          return prev + 1
        })
      } else if (key === 'ArrowUp') {
        // Arrow Up: Select previous row
        event.preventDefault()
        setSelectedRowIndex(prev => {
          if (prev === null || prev <= 0) return decisions.length - 1
          return prev - 1
        })
      } else if (key === '?') {
        // ?: Show keyboard shortcuts
        event.preventDefault()
        setShowKeyboardShortcuts(!showKeyboardShortcuts)
      } else if (isMod && key === 'k') {
        // Ctrl+K: Toggle quick actions
        event.preventDefault()
        setShowQuickActions(!showQuickActions)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [selectedRowIndex, decisions, showKeyboardShortcuts, showQuickActions, isMobile, currentCardIndex, expandedCards, bulkSelected])

  // Enhanced UX: Section expansion toggle
  const toggleSection = (sectionId: string) => {
    const newExpanded = new Set(expandedSections)
    if (newExpanded.has(sectionId)) {
      newExpanded.delete(sectionId)
    } else {
      newExpanded.add(sectionId)
    }
    setExpandedSections(newExpanded)
  }

  // Enhanced UX: Quick action handlers with feedback
  const handleQuickAliasCreation = async () => {
    setProcessingAction('alias-creation')
    try {
      // Auto-select high-confidence alias suggestions
      const highConfidenceSuggestions = decisions
        .filter(d => d.company && d.matchedEmployer && d.matchConfidence > 0.7 && d.matchConfidence < 1.0)

      if (highConfidenceSuggestions.length > 0) {
        setBulkAliasOpen(true)
        toast.success('Opening alias creation', {
          description: `Found ${highConfidenceSuggestions.length} high-confidence alias suggestions`
        })
      } else {
        toast.info('No alias suggestions', {
          description: 'No high-confidence alias matches found in current data'
        })
      }
    } finally {
      setProcessingAction(null)
    }
  }

  const handleQuickEbaSearch = async () => {
    setProcessingAction('eba-search')
    try {
      if (employersNeedingEbaUpdate.length > 0) {
        setBatchEbaSearchOpen(true)
        toast.success('Opening batch EBA search', {
          description: `Found ${employersNeedingEbaUpdate.length} employers needing EBA updates`
        })
      } else {
        toast.info('No EBA updates needed', {
          description: 'All employers have current EBA status'
        })
      }
    } finally {
      setProcessingAction(null)
    }
  }

  // Enhanced UX: Row selection handler
  const handleRowSelect = (index: number) => {
    setSelectedRowIndex(index)
  }

  // Mobile-specific helpers
  const toggleCardExpanded = (index: number) => {
    const newExpanded = new Set(expandedCards)
    if (newExpanded.has(index)) {
      newExpanded.delete(index)
    } else {
      newExpanded.add(index)
    }
    setExpandedCards(newExpanded)
  }

  const toggleBulkSelection = (index: number) => {
    const newSelected = new Set(bulkSelected)
    if (newSelected.has(index)) {
      newSelected.delete(index)
    } else {
      newSelected.add(index)
    }
    setBulkSelected(newSelected)
  }

  const toggleBulkMode = () => {
    setBulkSelectionMode(!bulkSelectionMode)
    if (bulkSelectionMode) {
      setBulkSelected(new Set())
    }
  }

  const navigateToCard = (direction: 'prev' | 'next') => {
    if (direction === 'prev') {
      setCurrentCardIndex(prev => Math.max(0, prev - 1))
    } else {
      setCurrentCardIndex(prev => Math.min(decisions.length - 1, prev + 1))
    }
  }

  const handleSwipeAction = (index: number, action: 'import' | 'skip' | 'review') => {
    if (action === 'review') {
      handleOpenMatchDialog(index)
    } else {
      handleActionChange(index, action)
      // Auto-advance to next card on mobile
      if (isMobile && index < decisions.length - 1) {
        navigateToCard('next')
      }
    }
  }

  const handleBulkAction = (action: 'import' | 'skip') => {
    bulkSelected.forEach(index => {
      handleActionChange(index, action)
    })
    setBulkSelected(new Set())
    setBulkSelectionMode(false)
    toast.success(`Bulk ${action} completed`, {
      description: `${bulkSelected.size} entries ${action}ed`
    })
  }

  // Enhanced UX: Progress indicators
  const getProgressStats = () => {
    const total = decisions.length
    const completed = decisions.filter(d =>
      !d.needsReview &&
      (d.action !== 'skip' || d.company === '') &&
      !d.shouldUpdateEbaStatus
    ).length
    const inProgress = decisions.filter(d => d.needsReview).length
    const pending = total - completed - inProgress

    return { total, completed, inProgress, pending }
  }

  const progressStats = getProgressStats()

  // Mobile Card Component
  const MobileSubcontractorCard = ({ decision, index }: { decision: any, index: number }) => {
    const isExpanded = expandedCards.has(index)
    const isSelected = bulkSelected.has(index)
    const isCurrentCard = isMobile && index === currentCardIndex

    return (
      <Card className={`
        mb-4 transition-all duration-200
        ${decision.needsReview ? 'border-yellow-300 bg-yellow-50' : ''}
        ${isCurrentCard ? 'ring-2 ring-blue-500 shadow-lg' : ''}
        ${isSelected ? 'ring-2 ring-green-500' : ''}
      `}>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              {/* Mobile selection checkbox */}
              {bulkSelectionMode && (
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={() => toggleBulkSelection(index)}
                  className="h-5 w-5 flex-shrink-0"
                />
              )}

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="outline" className="text-xs">
                    {STAGE_LABELS[decision.stage] || decision.stage}
                  </Badge>
                  <Badge variant={decision.eba ? 'default' : 'secondary'} className="text-xs">
                    EBA: {decision.eba ? 'Yes' : 'No'}
                  </Badge>
                  {decision.isNewEmployer && (
                    <Badge variant="secondary" className="text-xs">New</Badge>
                  )}
                </div>

                <div className="font-semibold text-base truncate">
                  {decision.trade}
                </div>

                {decision.company && (
                  <div className="text-sm text-gray-600 truncate">
                    {decision.company}
                  </div>
                )}
              </div>
            </div>

            {/* Action buttons - always visible on mobile */}
            <div className="flex flex-col gap-2 ml-2">
              <Button
                variant={decision.needsReview ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleOpenMatchDialog(index)}
                className="h-8 px-3 text-xs"
              >
                {decision.needsReview ? 'Review' : 'Match'}
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => toggleCardExpanded(index)}
                className="h-8 px-2"
              >
                {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          {/* Quick action buttons for mobile */}
          <div className="flex gap-2 mt-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleSwipeAction(index, 'import')}
              className="flex-1 h-10 text-sm border-green-200 hover:bg-green-50"
              disabled={!decision.matchedEmployer}
            >
              <CheckCircle2 className="h-4 w-4 mr-1" />
              Import
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleSwipeAction(index, 'skip')}
              className="flex-1 h-10 text-sm border-red-200 hover:bg-red-50"
            >
              <X className="h-4 w-4 mr-1" />
              Skip
            </Button>
          </div>
        </CardHeader>

        {/* Expanded content */}
        {isExpanded && (
          <CardContent className="pt-0 border-t">
            <div className="space-y-4">
              {/* Current Employers */}
              {decision.existingEmployers && decision.existingEmployers.length > 0 && (
                <div>
                  <div className="text-sm font-medium text-gray-700 mb-2">Current Employers ({decision.existingEmployers.length})</div>
                  <div className="space-y-2">
                    {decision.existingEmployers.map((emp: any, empIndex: number) => (
                      <div key={emp.id} className="flex items-center gap-2 p-2 bg-green-50 rounded border">
                        <Building2 className="h-4 w-4 text-green-600 flex-shrink-0" />
                        <span className="text-green-800 font-medium flex-1 text-sm">{emp.name}</span>
                        <div className="flex items-center space-x-1">
                          <Checkbox
                            id={`keep-${index}-${empIndex}`}
                            checked={emp.keepDecision}
                            onCheckedChange={(checked) => {
                              setDecisions(prev => {
                                const updated = [...prev]
                                updated[index].existingEmployers[empIndex].keepDecision = checked
                                return updated
                              })
                            }}
                            className="h-4 w-4"
                          />
                          <Label htmlFor={`keep-${index}-${empIndex}`} className="text-xs cursor-pointer">
                            Keep
                          </Label>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Matched Employer */}
              {decision.matchedEmployer && (
                <div>
                  <div className="text-sm font-medium text-gray-700 mb-2">Matched Employer</div>
                  <div className="flex items-center gap-2 p-3 bg-blue-50 rounded border">
                    <Building2 className="h-5 w-5 text-blue-600" />
                    <div className="flex-1">
                      <div className="font-medium text-blue-800">{decision.matchedEmployer.name}</div>
                      {decision.matchedEmployer.matchedAlias && (
                        <div className="text-xs text-blue-600 mt-1">
                          Matched via alias: "{decision.matchedEmployer.matchedAlias}"
                        </div>
                      )}
                    </div>
                    <Badge variant="default" className="text-xs">
                      {decision.matchedEmployer.confidence === 'exact' ? 'Exact Match' :
                       decision.matchedEmployer.confidence === 'high' ? 'High Confidence' :
                       'Possible Match'}
                    </Badge>
                  </div>
                </div>
              )}

              {/* Action Selection */}
              <div>
                <div className="text-sm font-medium text-gray-700 mb-2">Import Action</div>
                <RadioGroup
                  value={decision.action}
                  onValueChange={(value) => handleActionChange(index, value as any)}
                  className="space-y-2"
                >
                  {decision.matchedEmployer && (
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="import" id={`${index}-import-mobile`} />
                      <Label htmlFor={`${index}-import-mobile`} className="text-sm cursor-pointer">
                        Add as new assignment
                      </Label>
                    </div>
                  )}
                  {decision.existingEmployers && decision.existingEmployers.length > 0 && decision.matchedEmployer && (
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="replace_one" id={`${index}-replace-mobile`} />
                      <Label htmlFor={`${index}-replace-mobile`} className="text-sm cursor-pointer">
                        Replace existing employer
                      </Label>
                    </div>
                  )}
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="skip" id={`${index}-skip-mobile`} />
                    <Label htmlFor={`${index}-skip-mobile`} className="text-sm cursor-pointer">
                      Skip scanned company
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              {/* Status Selection */}
              <div>
                <div className="text-sm font-medium text-gray-700 mb-2">Status</div>
                <StatusSelectSimple
                  value={decision.status || 'active'}
                  onChange={(status) => handleStatusChange(index, status)}
                  size="sm"
                />
              </div>

              {/* Additional Actions */}
              <div className="space-y-2">
                {!decision.company && decision.stage === 'other' && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleStartEdit(index)}
                    className="w-full h-11"
                  >
                    <AlertCircle className="h-4 w-4 mr-2" />
                    Fix Data Entry
                  </Button>
                )}

                {decision.company && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleOpenEbaQuickList(index)}
                    className="w-full h-11 gap-2 border-blue-200 hover:bg-blue-50"
                  >
                    <Zap className="h-4 w-4 text-blue-600" />
                    <span className="text-blue-700">EBA Quick List</span>
                  </Button>
                )}

                {decision.shouldUpdateEbaStatus && decision.matchedEmployer && decision.action === 'import' && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleIndividualEbaSearch(decision.matchedEmployer.id, decision.matchedEmployer.name)}
                    className="w-full h-11 gap-2"
                  >
                    <FileSearch className="h-4 w-4" />
                    Search EBA Database
                  </Button>
                )}

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleAddAdditional(index)}
                  className="w-full h-11 gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Add Subcontractor
                </Button>
              </div>
            </div>
          </CardContent>
        )}
      </Card>
    )
  }

  return (
    <TooltipProvider>
    <div className={`space-y-4 ${isMobile ? 'pb-20 px-2' : ''}`}>
      {/* Enhanced Progress Overview */}
      <Card className="border-2 border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-xl font-bold text-blue-900 flex items-center gap-2">
                <Zap className="h-5 w-5" />
                Subcontractor Review Dashboard
              </CardTitle>
              <p className="text-sm text-blue-700 mt-1">
                Review and process subcontractor data with enhanced matching and EBA management
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowKeyboardShortcuts(!showKeyboardShortcuts)}
                    className="gap-2"
                  >
                    <Keyboard className="h-4 w-4" />
                    Shortcuts
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Press ? for keyboard shortcuts</p>
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowGuidance(!showGuidance)}
                    className="gap-2"
                  >
                    <HelpCircle className="h-4 w-4" />
                    {showGuidance ? 'Hide' : 'Show'} Help
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Toggle guided assistance</p>
                </TooltipContent>
              </Tooltip>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {/* Mobile-friendly progress grid */}
          <div className={`${isMobile ? 'grid grid-cols-2' : 'grid grid-cols-4'} gap-4 mb-4`}>
            <div className="text-center p-3 bg-white rounded-lg border">
              <div className={`font-bold ${isMobile ? 'text-xl' : 'text-2xl'} text-blue-600`}>{progressStats.total}</div>
              <div className="text-xs text-gray-600">Total Entries</div>
            </div>
            <div className="text-center p-3 bg-white rounded-lg border">
              <div className={`font-bold ${isMobile ? 'text-xl' : 'text-2xl'} text-green-600`}>{progressStats.completed}</div>
              <div className="text-xs text-gray-600">Completed</div>
            </div>
            <div className="text-center p-3 bg-white rounded-lg border">
              <div className={`font-bold ${isMobile ? 'text-xl' : 'text-2xl'} text-yellow-600`}>{progressStats.inProgress}</div>
              <div className="text-xs text-gray-600">Needs Review</div>
            </div>
            <div className="text-center p-3 bg-white rounded-lg border">
              <div className={`font-bold ${isMobile ? 'text-xl' : 'text-2xl'} text-gray-600`}>{progressStats.pending}</div>
              <div className="text-xs text-gray-600">Pending</div>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-gradient-to-r from-blue-500 to-green-500 h-2 rounded-full transition-all duration-500"
              style={{ width: `${(progressStats.completed / progressStats.total) * 100}%` }}
            />
          </div>
          <div className="text-xs text-gray-600 mt-1">
            {Math.round((progressStats.completed / progressStats.total) * 100)}% Complete
          </div>
        </CardContent>
      </Card>

      {/* Enhanced Guidance Section */}
      {showGuidance && (
        <Card className="border-amber-200 bg-amber-50">
          <Collapsible open={expandedSections.has('guidance')} onOpenChange={() => toggleSection('guidance')}>
            <CardHeader className="pb-3">
              <CollapsibleTrigger className="flex items-center justify-between w-full">
                <CardTitle className="text-lg font-semibold text-amber-900 flex items-center gap-2">
                  <Lightbulb className="h-5 w-5" />
                  Quick Start Guide
                </CardTitle>
                <ChevronDown className={`h-4 w-4 transition-transform ${expandedSections.has('guidance') ? 'rotate-180' : ''}`} />
              </CollapsibleTrigger>
            </CardHeader>
            <CollapsibleContent>
              <CardContent className="pt-0">
                <Tabs value={selectedFeatureTab} onValueChange={(value) => setSelectedFeatureTab(value as any)}>
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="aliases">Employer Aliases</TabsTrigger>
                    <TabsTrigger value="eba">EBA Management</TabsTrigger>
                  </TabsList>

                  <TabsContent value="overview" className="mt-4">
                    <div className="space-y-3">
                      <div className="flex items-start gap-3 p-3 bg-white rounded-lg border border-amber-200">
                        <ArrowRight className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
                        <div>
                          <div className="font-medium text-amber-900">Start with Data Entry Fixes</div>
                          <div className="text-sm text-amber-700">
                            Look for "Other" trades with missing company names - click "Fix Entry" to correct data entry errors.
                          </div>
                        </div>
                      </div>
                      <div className="flex items-start gap-3 p-3 bg-white rounded-lg border border-amber-200">
                        <ArrowRight className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
                        <div>
                          <div className="font-medium text-amber-900">Review Employer Matches</div>
                          <div className="text-sm text-amber-700">
                            Highlighted entries need manual review - click "Review Match" to confirm or change employer assignments.
                          </div>
                        </div>
                      </div>
                      <div className="flex items-start gap-3 p-3 bg-white rounded-lg border border-amber-200">
                        <ArrowRight className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
                        <div>
                          <div className="font-medium text-amber-900">Use Keyboard Shortcuts</div>
                          <div className="text-sm text-amber-700">
                            Navigate with arrow keys, press ? for shortcuts, Ctrl+A for aliases, Ctrl+E for EBA search.
                          </div>
                        </div>
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="aliases" className="mt-4">
                    <div className="space-y-3">
                      <div className="p-3 bg-white rounded-lg border border-blue-200">
                        <div className="font-medium text-blue-900 mb-2">What are Employer Aliases?</div>
                        <div className="text-sm text-blue-700 mb-2">
                          Aliases connect scanned company names to your existing employer database, improving future matching accuracy.
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            onClick={handleQuickAliasCreation}
                            disabled={processingAction === 'alias-creation'}
                            className="gap-2"
                          >
                            <Tags className="h-4 w-4" />
                            {processingAction === 'alias-creation' ? 'Analyzing...' : 'Quick Alias Creation'}
                          </Button>
                          <span className="text-xs text-gray-600">
                            Automatically find high-confidence suggestions
                          </span>
                        </div>
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="eba" className="mt-4">
                    <div className="space-y-3">
                      <div className="p-3 bg-white rounded-lg border border-green-200">
                        <div className="font-medium text-green-900 mb-2">EBA Status Management</div>
                        <div className="text-sm text-green-700 mb-2">
                          Update employer EBA status from scanned documents and search the Fair Work Commission database.
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            onClick={handleQuickEbaSearch}
                            disabled={processingAction === 'eba-search'}
                            className="gap-2"
                          >
                            <FileSearch className="h-4 w-4" />
                            {processingAction === 'eba-search' ? 'Loading...' : 'Batch EBA Search'}
                          </Button>
                          <span className="text-xs text-gray-600">
                            {employersNeedingEbaUpdate.length} employers need updates
                          </span>
                        </div>
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>
      )}

      {/* Keyboard Shortcuts Modal */}
      {showKeyboardShortcuts && (
        <Card className="border-purple-200 bg-purple-50">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-semibold text-purple-900 flex items-center gap-2">
                <Keyboard className="h-5 w-5" />
                Keyboard Shortcuts
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowKeyboardShortcuts(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between p-2 bg-white rounded border">
                  <span className="text-sm font-medium">Select Row</span>
                  <kbd className="px-2 py-1 text-xs bg-gray-100 border rounded">↑↓</kbd>
                </div>
                <div className="flex items-center justify-between p-2 bg-white rounded border">
                  <span className="text-sm font-medium">Manage Aliases</span>
                  <kbd className="px-2 py-1 text-xs bg-gray-100 border rounded">Ctrl+A</kbd>
                </div>
                <div className="flex items-center justify-between p-2 bg-white rounded border">
                  <span className="text-sm font-medium">EBA Search</span>
                  <kbd className="px-2 py-1 text-xs bg-gray-100 border rounded">Ctrl+E</kbd>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between p-2 bg-white rounded border">
                  <span className="text-sm font-medium">Suggest Alias</span>
                  <kbd className="px-2 py-1 text-xs bg-gray-100 border rounded">Ctrl+Shift+S</kbd>
                </div>
                <div className="flex items-center justify-between p-2 bg-white rounded border">
                  <span className="text-sm font-medium">Quick Actions</span>
                  <kbd className="px-2 py-1 text-xs bg-gray-100 border rounded">Ctrl+K</kbd>
                </div>
                <div className="flex items-center justify-between p-2 bg-white rounded border">
                  <span className="text-sm font-medium">Close Modals</span>
                  <kbd className="px-2 py-1 text-xs bg-gray-100 border rounded">Esc</kbd>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Enhanced Quick Actions Bar */}
      {showQuickActions && (
        <Card className="border-green-200 bg-gradient-to-r from-green-50 to-emerald-50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold text-green-900 flex items-center gap-2">
              <Zap className="h-4 w-4" />
              Quick Actions
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex items-center gap-3 flex-wrap">
              <Button
                variant="default"
                size="sm"
                onClick={handleQuickAliasCreation}
                disabled={processingAction === 'alias-creation'}
                className="gap-2"
              >
                <Tags className="h-4 w-4" />
                {processingAction === 'alias-creation' ? 'Processing...' : 'Create Aliases'}
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={handleQuickEbaSearch}
                disabled={processingAction === 'eba-search' || needsEbaUpdateCount === 0}
                className="gap-2"
              >
                <FileSearch className="h-4 w-4" />
                {processingAction === 'eba-search' ? 'Processing...' : `EBA Search (${needsEbaUpdateCount})`}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleBulkAliasOperations}
                className="gap-2"
              >
                <Users className="h-4 w-4" />
                Advanced Aliases
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Enhanced Alert Messages */}
      {needsEditingCount > 0 && (
        <Alert variant="destructive" className="border-red-300">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <div className="flex items-center justify-between">
              <div>
                <strong className="text-red-900">Data Entry Issues Found</strong>
                <br />
                {needsEditingCount} "Other" trade{needsEditingCount > 1 ? 's have' : ' has'} missing company names.
                This usually means the company name was entered in the wrong column.
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const firstErrorIndex = decisions.findIndex(d => !d.company && d.stage === 'other')
                  if (firstErrorIndex !== -1) {
                    setSelectedRowIndex(firstErrorIndex)
                    handleStartEdit(firstErrorIndex)
                  }
                }}
                className="ml-4 gap-2"
              >
                Fix First Issue
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {needsReviewCount > 0 && (
        <Alert className="border-yellow-300 bg-yellow-50">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <div className="flex items-center justify-between">
              <div>
                <strong className="text-yellow-900">Manual Review Required</strong>
                <br />
                {needsReviewCount} subcontractor{needsReviewCount > 1 ? 's' : ''} need manual employer matching review.
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const firstReviewIndex = decisions.findIndex(d => d.needsReview)
                  if (firstReviewIndex !== -1) {
                    setSelectedRowIndex(firstReviewIndex)
                  }
                }}
                className="ml-4 gap-2"
              >
                Go to First Review
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {needsEbaUpdateCount > 0 && (
        <Alert className="border-orange-300 bg-orange-50">
          <FileSearch className="h-4 w-4" />
          <AlertDescription>
            <div className="flex items-center justify-between">
              <div>
                <strong className="text-orange-900">EBA Status Updates Available</strong>
                <br />
                <span className="text-sm">{needsEbaUpdateCount} employer{needsEbaUpdateCount > 1 ? 's' : ''} can have EBA status updated to Active</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleBatchEbaSearch}
                className="ml-4 gap-2"
              >
                <FileSearch className="h-4 w-4" />
                Batch Search All ({needsEbaUpdateCount})
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Mobile Navigation and Bulk Controls */}
      {isMobile && (
        <Card className="border-2 border-indigo-200 bg-gradient-to-r from-indigo-50 to-purple-50 sticky top-0 z-40">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-bold text-indigo-900">
                Mobile Review Mode
              </CardTitle>
              <div className="flex items-center gap-2">
                <Button
                  variant={bulkSelectionMode ? "default" : "outline"}
                  size="sm"
                  onClick={toggleBulkMode}
                  className="gap-2 h-11 px-4"
                >
                  <Users className="h-4 w-4" />
                  {bulkSelectionMode ? `Selected (${bulkSelected.size})` : 'Bulk Select'}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {/* Mobile Navigation Controls */}
            <div className="flex items-center justify-between mb-4">
              <Button
                variant="outline"
                size="lg"
                onClick={() => navigateToCard('prev')}
                disabled={currentCardIndex === 0}
                className="gap-2 h-12 px-4"
              >
                <ChevronLeft className="h-5 w-5" />
                Previous
              </Button>
              <div className="text-base font-semibold text-gray-700 px-3">
                {currentCardIndex + 1} / {decisions.length}
              </div>
              <Button
                variant="outline"
                size="lg"
                onClick={() => navigateToCard('next')}
                disabled={currentCardIndex === decisions.length - 1}
                className="gap-2 h-12 px-4"
              >
                Next
                <ChevronRight className="h-5 w-5" />
              </Button>
            </div>

            {/* Bulk Action Buttons */}
            {bulkSelectionMode && bulkSelected.size > 0 && (
              <div className="space-y-2 p-3 bg-white rounded-lg border">
                <div className="text-sm font-medium text-gray-700">
                  {bulkSelected.size} item{bulkSelected.size > 1 ? 's' : ''} selected
                </div>
                <div className="flex gap-3">
                  <Button
                    variant="default"
                    size="lg"
                    onClick={() => handleBulkAction('import')}
                    className="flex-1 gap-2 h-12 bg-green-600 hover:bg-green-700"
                  >
                    <CheckCircle2 className="h-5 w-5" />
                    Import All
                  </Button>
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={() => handleBulkAction('skip')}
                    className="flex-1 gap-2 h-12 border-red-200 hover:bg-red-50"
                  >
                    <X className="h-5 w-5" />
                    Skip All
                  </Button>
                </div>
              </div>
            )}

            {/* Progress indicator */}
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-gradient-to-r from-indigo-500 to-purple-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${((currentCardIndex + 1) / decisions.length) * 100}%` }}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Content - Desktop Table or Mobile Cards */}
      {isMobile ? (
        /* Mobile View: Cards */
        <div className="space-y-4 px-1">
          {decisions.map((decision, index) => (
            <MobileSubcontractorCard key={index} decision={decision} index={index} />
          ))}
        </div>
      ) : (
        /* Desktop View: Table */
        <Card>
          <CardHeader>
            <CardTitle>Subcontractors</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto max-w-full relative">
            <Table className="w-full">
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[6rem]">Stage</TableHead>
                  <TableHead className="min-w-[8rem]">Trade</TableHead>
                  <TableHead className="min-w-[12rem]">Current Employers</TableHead>
                  <TableHead className="min-w-[12rem]">Additional to Add</TableHead>
                  <TableHead className="min-w-[10rem]">Scanned Company</TableHead>
                  <TableHead className="min-w-[12rem]">Matched Employer</TableHead>
                  <TableHead className="min-w-[10rem]">Action</TableHead>
                  <TableHead className="min-w-[8rem]">Status</TableHead>
                  <TableHead className="min-w-[4rem]">EBA</TableHead>
                  <TableHead className="min-w-[6rem]">Confidence</TableHead>
                  <TableHead className="sticky right-0 bg-white min-w-[13rem] border-l border-gray-200 z-10">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {decisions.map((decision, index) => (
                  <TableRow
                    key={index}
                    className={`
                      cursor-pointer transition-all duration-200
                      ${decision.needsReview ? 'bg-yellow-50' : ''}
                      ${selectedRowIndex === index ? 'bg-blue-100 border-l-4 border-l-blue-500' : 'hover:bg-gray-50'}
                    `}
                    onClick={() => handleRowSelect(index)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {selectedRowIndex === index && (
                          <div className="w-1 h-6 bg-blue-500 rounded-full animate-pulse" />
                        )}
                        <Badge variant="outline">
                          {STAGE_LABELS[decision.stage] || decision.stage}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">
                      {editingIndex === index ? (
                        <Input
                          value={editingTradeName}
                          onChange={(e) => setEditingTradeName(e.target.value)}
                          placeholder="Enter correct trade type"
                          className="h-8 text-sm"
                        />
                      ) : (
                        decision.trade
                      )}
                    </TableCell>
                    
                    {/* Current Employers */}
                    <TableCell>
                      {decision.existingEmployers && decision.existingEmployers.length > 0 ? (
                        <div className="space-y-1">
                          {decision.existingEmployers.map((emp: any, empIndex: number) => (
                            <div key={emp.id} className="flex items-center gap-2 p-2 bg-green-50 rounded border">
                              <Building2 className="h-4 w-4 text-green-600 flex-shrink-0" />
                              <span className="text-green-800 font-medium flex-1">{emp.name}</span>
                              <div className="flex items-center space-x-1">
                                <input
                                  type="checkbox"
                                  id={`keep-${index}-${empIndex}`}
                                  checked={emp.keepDecision}
                                  onChange={(e) => {
                                    setDecisions(prev => {
                                      const updated = [...prev]
                                      updated[index].existingEmployers[empIndex].keepDecision = e.target.checked
                                      return updated
                                    })
                                  }}
                                  className="h-3 w-3"
                                />
                                <Label htmlFor={`keep-${index}-${empIndex}`} className="text-xs cursor-pointer">
                                  Keep
                                </Label>
                              </div>
                            </div>
                          ))}
                          <div className="text-xs text-gray-500 mt-1">
                            {decision.existingEmployers.filter((e: any) => e.keepDecision).length} of {decision.existingEmployers.length} will be kept
                          </div>
                        </div>
                      ) : (
                        <span className="text-gray-400 italic">None assigned</span>
                      )}
                    </TableCell>

                    {/* Additional Employers to Add */}
                    <TableCell>
                      {decision.additionalEmployers && decision.additionalEmployers.length > 0 ? (
                        <div className="space-y-1">
                          {decision.additionalEmployers.map((emp: any, empIndex: number) => (
                            <div key={empIndex} className="flex items-center gap-2 p-2 bg-green-50 rounded border border-green-200">
                              <Plus className="h-4 w-4 text-green-600 flex-shrink-0" />
                              <span className="text-green-800 font-medium flex-1">{emp.name}</span>
                              <Badge variant="outline" className="text-xs">{emp.status}</Badge>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRemoveAdditional(index, empIndex)}
                                className="h-6 w-6 p-0 hover:bg-red-100"
                                title="Remove this subcontractor"
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          ))}
                          <div className="text-xs text-green-600 mt-1 font-medium">
                            +{decision.additionalEmployers.length} to be added
                          </div>
                        </div>
                      ) : (
                        <span className="text-gray-400 italic">None</span>
                      )}
                    </TableCell>

                    {/* Scanned Company */}
                    <TableCell>
                      {editingIndex === index ? (
                        <Input
                          value={editingCompanyName}
                          onChange={(e) => setEditingCompanyName(e.target.value)}
                          placeholder="Enter company name"
                          className="h-8 text-sm"
                        />
                      ) : (
                        decision.company || <span className="text-gray-400">—</span>
                      )}
                    </TableCell>
                    
                    {/* Matched Employer */}
                    <TableCell>
                      {decision.matchedEmployer ? (
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-blue-600" />
                            <span className="text-blue-800">{decision.matchedEmployer.name}</span>
                            {decision.isNewEmployer && (
                              <Badge variant="secondary" className="text-xs">New</Badge>
                            )}
                            {decision.matchedEmployer.matchedAlias && (
                              <Badge variant="outline" className="text-xs gap-1">
                                <Tags className="h-3 w-3" />
                                Alias Match
                              </Badge>
                            )}
                          </div>
                          {decision.matchedEmployer.matchedAlias && (
                            <div className="text-xs text-blue-600 ml-6">
                              Matched via alias: "{decision.matchedEmployer.matchedAlias}"
                            </div>
                          )}
                        </div>
                      ) : decision.company ? (
                        <span className="text-orange-600 text-sm">No match found</span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </TableCell>
                    
                    {/* Action Selection */}
                    <TableCell>
                      <div className="space-y-2">
                        {/* Action for scanned company */}
                        <div className="text-xs font-medium text-gray-700 mb-2">Scanned Company Action:</div>
                        <RadioGroup 
                          value={decision.action} 
                          onValueChange={(value) => handleActionChange(index, value as any)}
                          className="space-y-1"
                        >
                          {decision.matchedEmployer && (
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="import" id={`${index}-import`} />
                              <Label htmlFor={`${index}-import`} className="text-xs cursor-pointer">
                                Add as new assignment
                              </Label>
                            </div>
                          )}
                          {decision.existingEmployers && decision.existingEmployers.length > 0 && decision.matchedEmployer && (
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="replace_one" id={`${index}-replace`} />
                              <Label htmlFor={`${index}-replace`} className="text-xs cursor-pointer">
                                Replace existing employer
                              </Label>
                            </div>
                          )}
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="skip" id={`${index}-skip`} />
                            <Label htmlFor={`${index}-skip`} className="text-xs cursor-pointer">
                              Skip scanned company
                            </Label>
                          </div>
                        </RadioGroup>
                        
                        {decision.action === 'replace_one' && decision.existingEmployers && decision.existingEmployers.length > 1 && (
                          <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded">
                            <div className="text-xs text-yellow-800 mb-1">Which employer should be replaced?</div>
                            <RadioGroup
                              value={decision.replaceEmployerId || ''}
                              onValueChange={(empId) => {
                                setDecisions(prev => {
                                  const updated = [...prev]
                                  updated[index].replaceEmployerId = empId
                                  return updated
                                })
                              }}
                            >
                              {decision.existingEmployers.map((emp: any) => (
                                <div key={emp.id} className="flex items-center space-x-2">
                                  <RadioGroupItem value={emp.id} id={`replace-${index}-${emp.id}`} />
                                  <Label htmlFor={`replace-${index}-${emp.id}`} className="text-xs cursor-pointer">
                                    {emp.name}
                                  </Label>
                                </div>
                              ))}
                            </RadioGroup>
                          </div>
                        )}
                      </div>
                    </TableCell>
                    
                    {/* Status */}
                    <TableCell>
                      <StatusSelectSimple
                        value={decision.status || 'active'}
                        onChange={(status) => handleStatusChange(index, status)}
                        size="sm"
                      />
                    </TableCell>
                    
                    {/* EBA Status */}
                    <TableCell>
                      {decision.eba !== null && decision.eba !== undefined ? (
                        <Badge variant={decision.eba ? 'default' : 'secondary'}>
                          {decision.eba ? 'Yes' : 'No'}
                        </Badge>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </TableCell>
                    
                    {/* Confidence */}
                    <TableCell>
                      <ConfidenceIndicator confidence={decision.confidence} size="sm" />
                    </TableCell>
                    
                    {/* Actions */}
                    <TableCell className={`sticky right-0 min-w-[13rem] border-l border-gray-200 z-10 ${decision.needsReview ? 'bg-yellow-50' : 'bg-white'}`}>
                      <div className="space-y-1">
                        {editingIndex === index ? (
                          <>
                            <Button
                              variant="default"
                              size="sm"
                              onClick={() => handleSaveEdit(index)}
                              className="w-full"
                            >
                              Save
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={handleCancelEdit}
                              className="w-full"
                            >
                              Cancel
                            </Button>
                          </>
                        ) : (
                          <>
                            {!decision.company && decision.stage === 'other' && (
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => handleStartEdit(index)}
                                className="w-full"
                              >
                                <AlertCircle className="h-3 w-3 mr-1" />
                                Fix Entry
                              </Button>
                            )}
                            {decision.company && (
                              <Button
                                variant={decision.needsReview ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => handleOpenMatchDialog(index)}
                                className="w-full"
                              >
                                {decision.needsReview ? (
                                  <>
                                    <AlertCircle className="h-3 w-3 mr-1" />
                                    Review
                                  </>
                                ) : (
                                  <>
                                    <Search className="h-3 w-3 mr-1" />
                                    Change
                                  </>
                                )}
                              </Button>
                            )}

                            {/* EBA Quick List - Show alternative to manual search/match */}
                            {decision.company && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      handleOpenEbaQuickList(index)
                                    }}
                                    className="gap-1 w-full text-xs border-blue-200 hover:bg-blue-50"
                                  >
                                    <Zap className="h-3 w-3 text-blue-600" />
                                    <span className="truncate text-blue-700">EBA Quick List</span>
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Quickly select from EBA employers who work on {decision.trade}</p>
                                </TooltipContent>
                              </Tooltip>
                            )}

                            {/* Individual EBA Search - Show when employer matched and EBA status needs update */}
                            {decision.shouldUpdateEbaStatus && decision.matchedEmployer && decision.action === 'import' && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      handleIndividualEbaSearch(decision.matchedEmployer.id, decision.matchedEmployer.name)
                                    }}
                                    className="gap-1 w-full text-xs"
                                  >
                                    <FileSearch className="h-3 w-3" />
                                    <span className="truncate">Search EBA</span>
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Search FWC EBA database</p>
                                  <p className="text-xs text-gray-500">Press Ctrl+E when selected</p>
                                </TooltipContent>
                              </Tooltip>
                            )}

                            {/* Add Additional Subcontractor button */}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleAddAdditional(index)}
                              className="w-full gap-1"
                              title="Add another employer to this trade (useful for tender stage with multiple contractors)"
                            >
                              <Plus className="h-3 w-3" />
                              Add Subcontractor
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
      )}

      {/* Employer Match Dialog */}
      {matchDialogOpen && selectedSubcontractor && (
        <EmployerMatchDialog
          open={matchDialogOpen}
          onOpenChange={setMatchDialogOpen}
          companyName={selectedSubcontractor.company}
          suggestedMatch={selectedSubcontractor.matchedEmployer}
          allEmployers={allEmployers}
          onConfirm={handleMatchConfirm}
          tradeTypeCode={selectedSubcontractor.trade_type_code}
        />
      )}

      {/* Individual EBA Search Modal */}
      {ebaSearchOpen && selectedEbaEmployer && (
        <FwcEbaSearchModal
          isOpen={ebaSearchOpen}
          onClose={() => setEbaSearchOpen(false)}
          employerId={selectedEbaEmployer.employerId}
          employerName={selectedEbaEmployer.employerName}
          onLinkEba={() => {
            setEbaSearchOpen(false)
            // TODO: Refresh employer data to reflect new EBA status
          }}
        />
      )}

      {/* Batch EBA Search Modal */}
      {batchEbaSearchOpen && employersNeedingEbaUpdate.length > 0 && (
        <BatchEbaSearchModal
          open={batchEbaSearchOpen}
          onClose={() => setBatchEbaSearchOpen(false)}
          employers={employersNeedingEbaUpdate}
          onComplete={() => {
            setBatchEbaSearchOpen(false)
            // TODO: Refresh all employer data
          }}
        />
      )}

      {/* Add Additional Employer Modal */}
      {addAdditionalOpen && addAdditionalIndex !== null && (
        <AddAdditionalEmployerModal
          open={addAdditionalOpen}
          onClose={() => {
            setAddAdditionalOpen(false)
            setAddAdditionalIndex(null)
          }}
          trade={decisions[addAdditionalIndex]?.trade || ''}
          tradeCode={decisions[addAdditionalIndex]?.trade_type_code || ''}
          allEmployers={allEmployers}
          currentEmployers={decisions[addAdditionalIndex]?.existingEmployers?.map((e: any) => ({ id: e.id, name: e.name })) || []}
          additionalEmployers={decisions[addAdditionalIndex]?.additionalEmployers?.map((e: any) => ({ id: e.id, name: e.name })) || []}
          scannedEmployerId={decisions[addAdditionalIndex]?.matchedEmployer?.id || null}
          onConfirm={handleConfirmAdditional}
        />
      )}

      {/* Bulk Alias Operations Modal */}
      {bulkAliasOpen && (
        <BulkAliasOperations
          isOpen={bulkAliasOpen}
          onOpenChange={setBulkAliasOpen}
          subcontractors={decisions.map((decision, index) => ({
            index,
            trade: decision.trade,
            stage: decision.stage,
            company: decision.company || '',
            matchedEmployer: decision.matchedEmployer,
            existingEmployers: decision.existingEmployers,
            additionalEmployers: decision.additionalEmployers
          }))}
          allEmployers={allEmployers}
          onComplete={handleBulkAliasComplete}
        />
      )}

      {/* EBA Quick List Modal */}
      <EbaEmployerQuickList
        open={ebaQuickListOpen}
        onOpenChange={setEbaQuickListOpen}
        tradeType={selectedTradeForQuickList || undefined}
        projectId={projectId}
        onEmployerSelect={handleEbaEmployerSelect}
        onBatchSelect={handleBatchEbaEmployerSelect}
        excludeEmployerIds={decisions
          .filter(d => d.matchedEmployer && d.action === 'import')
          .map(d => d.matchedEmployer.id)
        }
      />
    </div>
    </TooltipProvider>
  )
}
