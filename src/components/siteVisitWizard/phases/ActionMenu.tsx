"use client"

import { type WizardView, type SelectedProject } from '../hooks/useWizardState'
import { WizardButton } from '../shared/WizardButton'
import { cn } from '@/lib/utils'
import { 
  Users, 
  ClipboardList, 
  Star, 
  FileCheck, 
  Link2, 
  Building,
  ArrowLeftRight 
} from 'lucide-react'

interface ActionMenuProps {
  project: SelectedProject
  onViewSelect: (view: WizardView) => void
  onPickNewProject: () => void
}

interface ActionMenuItem {
  id: WizardView
  label: string
  icon: React.ReactNode
  description: string
  color: string
}

const menuItems: ActionMenuItem[] = [
  {
    id: 'contacts',
    label: 'Contacts',
    icon: <Users className="h-8 w-8" />,
    description: 'View and edit site contacts',
    color: 'bg-blue-500',
  },
  {
    id: 'mapping',
    label: 'Mapping',
    icon: <ClipboardList className="h-8 w-8" />,
    description: 'Map trades and employers',
    color: 'bg-green-500',
  },
  {
    id: 'ratings',
    label: 'Ratings',
    icon: <Star className="h-8 w-8" />,
    description: 'Employer compliance ratings',
    color: 'bg-amber-500',
  },
  {
    id: 'eba',
    label: 'EBA',
    icon: <FileCheck className="h-8 w-8" />,
    description: 'Enterprise agreement status',
    color: 'bg-purple-500',
  },
  {
    id: 'incolink',
    label: 'Incolink',
    icon: <Link2 className="h-8 w-8" />,
    description: 'Incolink payment status',
    color: 'bg-emerald-500',
  },
  {
    id: 'project-details',
    label: 'Project Details',
    icon: <Building className="h-8 w-8" />,
    description: 'Full project information',
    color: 'bg-gray-500',
  },
]

export function ActionMenu({ 
  project, 
  onViewSelect, 
  onPickNewProject 
}: ActionMenuProps) {
  return (
    <div className="p-4 space-y-6 pb-safe-bottom">
      {/* Project summary card */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
            <Building className="h-6 w-6 text-blue-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold text-gray-900 truncate">
              {project.name}
            </h2>
            {project.builderName && (
              <p className="text-sm text-gray-600 mt-0.5 truncate">
                {project.builderName}
              </p>
            )}
            {project.address && (
              <p className="text-sm text-gray-500 mt-1 truncate">
                {project.address}
              </p>
            )}
          </div>
        </div>
      </div>
      
      {/* Action buttons grid */}
      <div className="grid grid-cols-2 gap-3">
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onViewSelect(item.id)}
            className={cn(
              'flex flex-col items-center justify-center',
              'p-5 bg-white rounded-2xl border border-gray-200',
              'hover:border-gray-300 hover:shadow-md active:scale-[0.98]',
              'transition-all duration-200 touch-manipulation',
              'min-h-[120px]'
            )}
          >
            <div className={cn(
              'w-14 h-14 rounded-xl flex items-center justify-center mb-3',
              'text-white',
              item.color
            )}>
              {item.icon}
            </div>
            <span className="text-base font-semibold text-gray-900">
              {item.label}
            </span>
          </button>
        ))}
      </div>
      
      {/* Pick new project button */}
      <WizardButton
        variant="outline"
        size="lg"
        fullWidth
        onClick={onPickNewProject}
        icon={<ArrowLeftRight className="h-5 w-5" />}
      >
        Pick New Project
      </WizardButton>
    </div>
  )
}

