"use client"

import { useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useWizardState, type BCIImportData, type SelectedProject } from './hooks/useWizardState'
import { WizardHeader } from './shared/WizardHeader'
import { SiteVisitRecordDialog } from './shared/SiteVisitRecordDialog'
import { ProjectSelector } from './phases/ProjectSelector'
import { ActionMenu } from './phases/ActionMenu'
import { AddProjectOptions } from './phases/AddProjectOptions'
import { BCIImportPanel } from './phases/BCIImportPanel'
import { BCIProjectSelector } from './phases/BCIProjectSelector'
import { MobileManualProjectForm } from './phases/MobileManualProjectForm'
import { MobileBCIImport } from '@/components/upload/MobileBCIImport'
import { ContactsView } from './views/ContactsView'
import { MappingView } from './views/MappingView'
import { RatingsView } from './views/RatingsView'
import { EbaView } from './views/EbaView'
import { IncolinkView } from './views/IncolinkView'
import { ProjectDetailsView } from './views/ProjectDetailsView'
import { toast } from 'sonner'

export function SiteVisitWizard() {
  const router = useRouter()
  const {
    state,
    goToProjectSelection,
    goToActionMenu,
    goToAddProjectOptions,
    goToBCIImport,
    goToBCIProjectSelect,
    goToBCIImporting,
    goToManualCreate,
    openView,
    closeView,
    showExitDialog,
    closeSiteVisitDialog,
    setBCIImportData,
    canGoBack,
    goBack,
    getPreSelectedReasonNames,
  } = useWizardState()
  
  // Local error state for BCI import
  const [bciImportError, setBciImportError] = useState<string | null>(null)
  
  // Handle project selection - just go to action menu, no entry dialog
  const handleProjectSelected = useCallback((project: {
    id: string
    name: string
    address?: string | null
    builderName?: string | null
    mainJobSiteId?: string | null
  }) => {
    goToActionMenu(project)
  }, [goToActionMenu])
  
  // Handle exit from wizard
  const handleExit = useCallback(() => {
    router.push('/patch')
  }, [router])
  
  // Handle site visit dialog completion
  const handleSiteVisitComplete = useCallback(() => {
    closeSiteVisitDialog()
    handleExit()
  }, [closeSiteVisitDialog, handleExit])
  
  // Handle site visit skip
  const handleSiteVisitSkip = useCallback(() => {
    closeSiteVisitDialog()
    handleExit()
  }, [closeSiteVisitDialog, handleExit])
  
  // Confirm exit with site visit prompt (only if a project was selected)
  const handleRequestExit = useCallback(() => {
    if (state.selectedProject) {
      showExitDialog()
    } else {
      handleExit()
    }
  }, [state.selectedProject, showExitDialog, handleExit])
  
  // Handle BCI file processed
  const handleBCIFileProcessed = useCallback((data: BCIImportData) => {
    if (data.projects.length === 1) {
      // Single project - go straight to importing
      goToBCIImporting(data.projects[0].projectId)
      setBCIImportData(data)
    } else {
      // Multiple projects - show selector
      goToBCIProjectSelect(data)
    }
  }, [goToBCIImporting, goToBCIProjectSelect, setBCIImportData])
  
  // Handle BCI project selected
  const handleBCIProjectSelected = useCallback((projectId: string) => {
    goToBCIImporting(projectId)
  }, [goToBCIImporting])
  
  // Handle BCI import complete
  const handleBCIImportComplete = useCallback((project: SelectedProject) => {
    toast.success('Project imported successfully')
    goToActionMenu(project)
  }, [goToActionMenu])
  
  // Handle BCI import error
  const handleBCIImportError = useCallback((error: string) => {
    setBciImportError(error)
    toast.error('Import failed: ' + error)
  }, [])
  
  // Handle manual project created
  const handleManualProjectComplete = useCallback((project: SelectedProject) => {
    toast.success('Project created successfully')
    goToActionMenu(project)
  }, [goToActionMenu])
  
  // Get header title and subtitle
  const getHeaderContent = () => {
    if (state.view && state.selectedProject) {
      const viewTitles: Record<string, string> = {
        contacts: 'Site Contacts',
        mapping: 'Mapping',
        ratings: 'Employer Ratings',
        eba: 'EBA Status',
        incolink: 'Incolink',
        'project-details': 'Project Details',
      }
      return {
        title: viewTitles[state.view] || 'Site Visit',
        subtitle: state.selectedProject.name,
      }
    }
    
    if (state.phase === 'action-menu' && state.selectedProject) {
      return {
        title: state.selectedProject.name,
        subtitle: state.selectedProject.address || undefined,
      }
    }
    
    // Add project flow headers
    if (state.phase === 'add-project-options') {
      return {
        title: 'Add New Project',
        subtitle: undefined,
      }
    }
    
    if (state.phase === 'bci-import') {
      return {
        title: 'Import from BCI',
        subtitle: undefined,
      }
    }
    
    if (state.phase === 'bci-project-select') {
      return {
        title: 'Select Project',
        subtitle: undefined,
      }
    }
    
    if (state.phase === 'bci-importing') {
      return {
        title: 'Importing...',
        subtitle: undefined,
      }
    }
    
    if (state.phase === 'manual-create') {
      return {
        title: 'Create Project',
        subtitle: undefined,
      }
    }
    
    return {
      title: 'Site Visit',
      subtitle: 'Select a project',
    }
  }
  
  const { title, subtitle } = getHeaderContent()
  
  // Render current view
  const renderView = () => {
    if (!state.selectedProject) return null
    
    switch (state.view) {
      case 'contacts':
        return (
          <ContactsView 
            projectId={state.selectedProject.id}
            mainJobSiteId={state.selectedProject.mainJobSiteId}
          />
        )
      case 'mapping':
        return (
          <MappingView 
            projectId={state.selectedProject.id}
            projectName={state.selectedProject.name}
            projectAddress={state.selectedProject.address}
            builderName={state.selectedProject.builderName}
          />
        )
      case 'ratings':
        return (
          <RatingsView 
            projectId={state.selectedProject.id}
            projectName={state.selectedProject.name}
          />
        )
      case 'eba':
        return (
          <EbaView 
            projectId={state.selectedProject.id}
            projectName={state.selectedProject.name}
          />
        )
      case 'incolink':
        return (
          <IncolinkView 
            projectId={state.selectedProject.id}
            projectName={state.selectedProject.name}
          />
        )
      case 'project-details':
        return (
          <ProjectDetailsView 
            projectId={state.selectedProject.id}
          />
        )
      default:
        return null
    }
  }
  
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <WizardHeader
        title={title}
        subtitle={subtitle}
        onBack={canGoBack ? goBack : undefined}
        onClose={handleRequestExit}
        showBack={canGoBack}
        showClose={false}
      />
      
      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        {state.view ? (
          renderView()
        ) : state.phase === 'project-selection' ? (
          <ProjectSelector 
            onProjectSelected={handleProjectSelected}
            onAddNewProject={goToAddProjectOptions}
          />
        ) : state.phase === 'add-project-options' ? (
          <AddProjectOptions
            onSelectBCIImport={goToBCIImport}
            onSelectManualCreate={goToManualCreate}
            onBack={goBack}
          />
        ) : state.phase === 'bci-import' ? (
          <BCIImportPanel
            onFileProcessed={handleBCIFileProcessed}
            onBack={goBack}
          />
        ) : state.phase === 'bci-project-select' && state.bciImportData ? (
          <BCIProjectSelector
            projects={state.bciImportData.projects}
            onSelectProject={handleBCIProjectSelected}
            onBack={goBack}
          />
        ) : state.phase === 'bci-importing' && state.bciImportData?.selectedProjectId ? (
          (() => {
            const selectedProject = state.bciImportData.projects.find(
              p => p.projectId === state.bciImportData?.selectedProjectId
            )
            if (!selectedProject) return null
            return (
              <MobileBCIImport
                project={selectedProject}
                companies={state.bciImportData.companies.filter(
                  c => c.projectId === selectedProject.projectId
                )}
                onComplete={handleBCIImportComplete}
                onError={handleBCIImportError}
              />
            )
          })()
        ) : state.phase === 'manual-create' ? (
          <MobileManualProjectForm
            onComplete={handleManualProjectComplete}
            onBack={goBack}
          />
        ) : state.phase === 'action-menu' && state.selectedProject ? (
          <ActionMenu
            project={state.selectedProject}
            onViewSelect={openView}
            onPickNewProject={goToProjectSelection}
            onExit={handleRequestExit}
          />
        ) : null}
      </main>
      
      {/* Site Visit Recording Dialog - only shown on exit */}
      {state.selectedProject && (
        <SiteVisitRecordDialog
          open={state.showSiteVisitDialog}
          onOpenChange={closeSiteVisitDialog}
          projectId={state.selectedProject.id}
          projectName={state.selectedProject.name}
          mainJobSiteId={state.selectedProject.mainJobSiteId}
          onComplete={handleSiteVisitComplete}
          onSkip={handleSiteVisitSkip}
          preSelectedReasonNames={getPreSelectedReasonNames()}
        />
      )}
    </div>
  )
}
